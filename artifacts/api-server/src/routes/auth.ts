/**
 * Rutas de autenticación.
 *
 * POST /auth/login   { email, password }  → setea cookie de sesión
 * POST /auth/logout                       → limpia cookie
 * GET  /auth/me                           → datos del usuario autenticado
 *
 * Ubicación destino en Replit: artifacts/api-server/src/routes/auth.ts
 */

import { Router } from 'express';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../db'; // ajustar al path real del Replit
import { users, gestores, estudiantes, administradores, municipios, auditLog } from '@workspace/db/schema';
import {
  authRequired,
  setSessionCookie,
  clearSessionCookie,
  type SessionUser,
} from '../middleware/auth';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/login', async (req, res) => {
  const parse = loginSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Datos inválidos' });
    return;
  }
  const { email, password } = parse.data;

  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user || !user.activo) {
    res.status(401).json({ error: 'Credenciales incorrectas' });
    return;
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: 'Credenciales incorrectas' });
    return;
  }

  await db
    .update(users)
    .set({ ultimoLogin: new Date() })
    .where(eq(users.id, user.id));

  const session: SessionUser = { userId: user.id, rol: user.rol };
  setSessionCookie(res, session);

  res.json({
    ok: true,
    user: { id: user.id, email: user.email, rol: user.rol, passwordTemporal: user.passwordTemporal },
  });
});

router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/me', authRequired, async (req, res) => {
  const userId = req.user!.userId;
  const rol = req.user!.rol;

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) {
    res.status(404).json({ error: 'Usuario no encontrado' });
    return;
  }

  let perfil: Record<string, unknown> = {};
  if (rol === 'gestor') {
    const rows = await db
      .select({
        nombreCompleto: gestores.nombreCompleto,
        telefono: gestores.telefono,
        municipioId: gestores.municipioId,
        municipio: municipios.nombre,
      })
      .from(gestores)
      .leftJoin(municipios, eq(gestores.municipioId, municipios.id))
      .where(eq(gestores.userId, userId));
    perfil = rows[0] ?? {};
  } else if (rol === 'estudiante') {
    const [est] = await db.select().from(estudiantes).where(eq(estudiantes.userId, userId));
    perfil = est ?? {};
  } else if (rol === 'admin') {
    const [ad] = await db.select().from(administradores).where(eq(administradores.userId, userId));
    perfil = ad ?? {};
  }

  res.json({
    id: user.id,
    email: user.email,
    rol: user.rol,
    passwordTemporal: user.passwordTemporal,
    perfil,
  });
});

// ─── POST /auth/cambiar-password ─────────────────────────────────────────
const cambiarPasswordSchema = z.object({
  passwordActual: z.string().min(1, 'Ingresa tu contraseña actual'),
  passwordNueva: z
    .string()
    .min(8, 'La nueva contraseña debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'Debe incluir al menos una letra mayúscula')
    .regex(/[0-9]/, 'Debe incluir al menos un número'),
});

router.post('/cambiar-password', authRequired, async (req, res) => {
  const userId = req.user!.userId;

  const parse = cambiarPasswordSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }
  const { passwordActual, passwordNueva } = parse.data;

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) {
    res.status(404).json({ error: 'Usuario no encontrado' });
    return;
  }

  const actualOk = await bcrypt.compare(passwordActual, user.passwordHash);
  if (!actualOk) {
    res.status(401).json({ error: 'La contraseña actual es incorrecta' });
    return;
  }

  const mismaClave = await bcrypt.compare(passwordNueva, user.passwordHash);
  if (mismaClave) {
    res.status(400).json({ error: 'La nueva contraseña debe ser diferente a la actual' });
    return;
  }

  const nuevoHash = await bcrypt.hash(passwordNueva, 10);
  await db
    .update(users)
    .set({
      passwordHash: nuevoHash,
      passwordTemporal: false,
      passwordCambiadoEn: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  await db.insert(auditLog).values({
    userId,
    accion: 'cambiar_password',
    entidad: 'users',
    entidadId: userId,
    metadata: { via: 'perfil' },
  });

  res.json({ ok: true });
});

export default router;
