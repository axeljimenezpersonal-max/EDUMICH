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
import { users, gestores, estudiantes, administradores, municipios } from '@workspace/db/schema';
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
    return res.status(400).json({ error: 'Datos inválidos' });
  }
  const { email, password } = parse.data;

  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user || !user.activo) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }

  await db
    .update(users)
    .set({ ultimoLogin: new Date() })
    .where(eq(users.id, user.id));

  const session: SessionUser = { userId: user.id, rol: user.rol };
  setSessionCookie(res, session);

  res.json({ ok: true, user: { id: user.id, email: user.email, rol: user.rol } });
});

router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/me', authRequired, async (req, res) => {
  const userId = req.user!.userId;
  const rol = req.user!.rol;

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

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
    perfil,
  });
});

export default router;
