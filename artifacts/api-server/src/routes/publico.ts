/**
 * Rutas PÚBLICAS — sin autenticación requerida.
 *
 * POST /publico/email/solicitar-codigo
 * POST /publico/email/verificar-codigo
 * POST /publico/auto-registro
 * POST /publico/solicitudes-cuenta
 */

import { Router } from 'express';
import { eq, and, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import crypto from 'node:crypto';
import { db } from '../db';
import {
  users,
  estudiantes,
  inscripciones,
  convocatorias,
  municipios,
  emailVerifications,
  solicitudesCuenta,
  auditLog,
  modulos,
} from '@workspace/db/schema';
import { setSessionCookie } from '../middleware/auth';
import { sendVerificationCode } from '../services/email';

const router = Router();

// ─── GET /publico/modulos ─────────────────────────────────────────────────
router.get('/modulos', async (_req, res) => {
  const rows = await db
    .select({ id: modulos.id, numero: modulos.numero, nombre: modulos.nombre, nivel: modulos.nivel })
    .from(modulos)
    .orderBy(modulos.numero);
  res.json({ modulos: rows });
});

// ─── GET /publico/municipios ──────────────────────────────────────────────
router.get('/municipios', async (_req, res) => {
  const rows = await db
    .select({ id: municipios.id, nombre: municipios.nombre })
    .from(municipios)
    .orderBy(municipios.nombre);
  res.json(rows);
});

// ─── Token helpers (HMAC, 30 min) ────────────────────────────────────────
const TOKEN_SECRET = process.env.SESSION_SECRET || 'CAMBIAR_EN_PRODUCCION';
const TOKEN_TTL_MS = 30 * 60 * 1000;

function signEmailToken(email: string, tipo: string): string {
  const payload = Buffer.from(JSON.stringify({ email, tipo, iat: Date.now() })).toString(
    'base64url'
  );
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function verifyEmailToken(
  token: string
): { email: string; tipo: string } | null {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
  if (expected !== sig) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (Date.now() - data.iat > TOKEN_TTL_MS) return null;
    return { email: data.email, tipo: data.tipo };
  } catch {
    return null;
  }
}

// ─── POST /publico/email/solicitar-codigo ─────────────────────────────────
router.post('/email/solicitar-codigo', async (req, res) => {
  const parse = z
    .object({
      email: z.string().email(),
      tipo: z.enum(['auto_registro', 'solicitud_cuenta']),
    })
    .safeParse(req.body);

  if (!parse.success) {
    res.status(400).json({ error: 'Datos inválidos' });
    return;
  }
  const { email, tipo } = parse.data;

  // Rate limit: max 3 códigos en 15 min
  const [{ cnt }] = await db
    .select({ cnt: sql<number>`count(*)` })
    .from(emailVerifications)
    .where(
      and(
        eq(emailVerifications.email, email),
        sql`${emailVerifications.createdAt} > NOW() - INTERVAL '15 minutes'`
      )
    );
  if (Number(cnt) >= 3) {
    res
      .status(429)
      .json({ error: 'Demasiadas solicitudes. Espera 15 minutos antes de pedir un nuevo código.' });
    return;
  }

  // Para auto_registro: no debe existir ya un user con ese email
  if (tipo === 'auto_registro') {
    const [existing] = await db.select().from(users).where(eq(users.email, email));
    if (existing) {
      res.status(409).json({
        error: 'Ya existe una cuenta con este correo. Inicia sesión o recupera tu contraseña.',
      });
      return;
    }
  }

  // Generar código
  const codigo = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
  const codigoHash = await bcrypt.hash(codigo, 10);
  const expiraEn = new Date(Date.now() + 10 * 60 * 1000);

  await db.insert(emailVerifications).values({
    email,
    codigoHash,
    expiraEn,
    tipo,
  });

  const result = await sendVerificationCode(email, codigo);

  res.json({
    ok: true,
    modo: result.modo,
    ...(result.modo === 'dev' ? { codigoDev: result.codigo } : {}),
  });
});

// ─── POST /publico/email/verificar-codigo ─────────────────────────────────
router.post('/email/verificar-codigo', async (req, res) => {
  const parse = z
    .object({
      email: z.string().email(),
      codigo: z.string().length(6),
      tipo: z.string(),
    })
    .safeParse(req.body);

  if (!parse.success) {
    res.status(400).json({ error: 'Datos inválidos' });
    return;
  }
  const { email, codigo, tipo } = parse.data;

  // Busca el registro más reciente no verificado
  const rows = await db
    .select()
    .from(emailVerifications)
    .where(
      and(
        eq(emailVerifications.email, email),
        eq(emailVerifications.tipo, tipo),
        eq(emailVerifications.verificado, false)
      )
    )
    .orderBy(sql`${emailVerifications.createdAt} DESC`)
    .limit(1);

  const ev = rows[0];

  if (!ev) {
    res.status(404).json({ error: 'No hay código pendiente para este correo.' });
    return;
  }
  if (ev.expiraEn < new Date()) {
    res.status(410).json({ error: 'El código expiró. Solicita uno nuevo.' });
    return;
  }
  if (ev.intentos >= 5) {
    res.status(429).json({ error: 'Demasiados intentos. Solicita un nuevo código.' });
    return;
  }

  const ok = await bcrypt.compare(codigo, ev.codigoHash);
  if (!ok) {
    await db
      .update(emailVerifications)
      .set({ intentos: ev.intentos + 1 })
      .where(eq(emailVerifications.id, ev.id));
    res.status(400).json({ error: 'Código incorrecto.', intentosRestantes: 5 - ev.intentos - 1 });
    return;
  }

  await db
    .update(emailVerifications)
    .set({ verificado: true })
    .where(eq(emailVerifications.id, ev.id));

  const token = signEmailToken(email, tipo);
  res.json({ ok: true, token });
});

// ─── POST /publico/auto-registro ──────────────────────────────────────────
const autoRegistroSchema = z.object({
  emailVerificadoToken: z.string(),
  email: z.string().email(),
  nombreCompleto: z.string().min(2).max(200),
  fechaNacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  telefono: z.string().min(7).max(30),
  municipioId: z.number().int().positive(),
  direccion: z.string().optional(),
  password: z.string().min(8),
});

router.post('/auto-registro', async (req, res) => {
  const parse = autoRegistroSchema.safeParse({
    ...req.body,
    municipioId: Number(req.body.municipioId),
  });
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }
  const data = parse.data;

  // Valida token
  const tokenData = verifyEmailToken(data.emailVerificadoToken);
  if (!tokenData || tokenData.email !== data.email || tokenData.tipo !== 'auto_registro') {
    res.status(401).json({ error: 'Token de verificación de email inválido o expirado.' });
    return;
  }

  // Verifica que no exista el email
  const [existing] = await db.select().from(users).where(eq(users.email, data.email));
  if (existing) {
    res.status(409).json({ error: 'Ya existe una cuenta con este correo.' });
    return;
  }

  const passwordHash = await bcrypt.hash(data.password, 10);

  const result = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        email: data.email.toLowerCase(),
        passwordHash,
        rol: 'estudiante',
        passwordTemporal: false,
        privacidadAceptadaEn: new Date(),
      })
      .returning();

    await tx.insert(estudiantes).values({
      userId: user.id,
      nombreCompleto: data.nombreCompleto,
      curp: null,
      fechaNacimiento: data.fechaNacimiento,
      telefono: data.telefono,
      direccion: data.direccion ?? null,
      municipioId: data.municipioId,
      gestorId: null,
      emailVerificado: true,
      registroTipo: 'auto_registro',
    });

    // Inscribir en la convocatoria activa si existe
    const [convActiva] = await tx
      .select()
      .from(convocatorias)
      .where(eq(convocatorias.estado, 'abierta'))
      .limit(1);

    if (convActiva) {
      await tx.insert(inscripciones).values({
        estudianteId: user.id,
        convocatoriaId: convActiva.id,
        estado: 'documentos_pendientes',
        creadoPorUserId: null,
      });
    }

    await tx.insert(auditLog).values({
      userId: user.id,
      accion: 'auto_registro',
      entidad: 'users',
      entidadId: user.id,
      metadata: { email: data.email, registroTipo: 'auto_registro' },
    });

    return user;
  });

  setSessionCookie(res, { userId: result.id, rol: 'estudiante' });
  res.status(201).json({ ok: true, user: { id: result.id, email: result.email, rol: result.rol } });
});

// ─── POST /publico/solicitudes-cuenta ─────────────────────────────────────
const solicitudSchema = z.object({
  emailVerificadoToken: z.string(),
  nombreCompleto: z.string().min(2).max(200),
  curp: z.string().length(18),
  fechaNacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  email: z.string().email(),
  telefono: z.string().min(7).max(30),
  municipioId: z.number().int().positive(),
  mensaje: z.string().optional(),
});

router.post('/solicitudes-cuenta', async (req, res) => {
  const parse = solicitudSchema.safeParse({
    ...req.body,
    municipioId: Number(req.body.municipioId),
  });
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }
  const data = parse.data;

  const tokenData = verifyEmailToken(data.emailVerificadoToken);
  if (!tokenData || tokenData.email !== data.email || tokenData.tipo !== 'solicitud_cuenta') {
    res.status(401).json({ error: 'Token de verificación de email inválido o expirado.' });
    return;
  }

  // CURP único entre estudiantes existentes
  if (data.curp) {
    const [curpExist] = await db
      .select()
      .from(estudiantes)
      .where(eq(estudiantes.curp, data.curp.toUpperCase()));
    if (curpExist) {
      res.status(409).json({ error: 'Ya existe un alumno registrado con esa CURP.' });
      return;
    }
  }

  await db.insert(solicitudesCuenta).values({
    nombreCompleto: data.nombreCompleto,
    curp: data.curp.toUpperCase(),
    fechaNacimiento: data.fechaNacimiento,
    email: data.email.toLowerCase(),
    telefono: data.telefono,
    municipioId: data.municipioId,
    mensaje: data.mensaje ?? null,
    emailVerificado: true,
    estado: 'pendiente',
  });

  res.json({ ok: true });
});

export default router;
