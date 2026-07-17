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
  gestores,
  inscripciones,
  convocatorias,
  municipios,
  emailVerifications,
  solicitudesCuenta,
  auditLog,
  modulos,
  passwordResetTokens,
  datosInstitucionales,
} from '@workspace/db/schema';
import { setSessionCookie } from '../middleware/auth';
import { armarNombreCompleto, armarDireccion } from '../utils/estudianteDatos';
import { sendVerificationCode, sendEmail, sendRecuperarPassword } from '../services/email';
import { autoregistroConfirmacionTemplate } from '../services/templates/autoregistro-confirmacion';
import { notifAdminAutoregistroTemplate } from '../services/templates/notif-admin-autoregistro';
import { tryAuditLog } from '../utils/audit';
import { notificarATodosLosAdmins } from '../utils/notificar';
import { validarCurp } from '../utils/curp';
import { validarEdad } from '../utils/edad';
import rateLimit from 'express-rate-limit';

const router = Router();

// ─── Validación de CURP (filtro de auditoría) ────────────────────────────
// Limitada por IP para impedir que alguien enumere CURPs registradas.
const curpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas consultas. Intenta de nuevo en unos minutos.' },
});

/** ¿La CURP ya está ocupada por un alumno o una solicitud activa? */
async function curpOcupada(curp: string): Promise<string | null> {
  const [alumno] = await db
    .select({ userId: estudiantes.userId })
    .from(estudiantes)
    .where(eq(estudiantes.curp, curp));
  if (alumno) return 'Ya existe un alumno registrado con esa CURP.';

  const [solicitud] = await db
    .select({ id: solicitudesCuenta.id, estado: solicitudesCuenta.estado })
    .from(solicitudesCuenta)
    .where(and(eq(solicitudesCuenta.curp, curp), sql`${solicitudesCuenta.estado} IN ('pendiente','aprobada')`));
  if (solicitud) {
    return solicitud.estado === 'pendiente'
      ? 'Ya hay una solicitud en revisión con esa CURP. Espera la respuesta de la administración.'
      : 'Esa CURP ya tiene una solicitud aprobada.';
  }
  return null;
}

// ─── Buscar cuenta ("no recuerdo si tengo cuenta") ────────────────────────
// Privacidad: el correo SIEMPRE se devuelve enmascarado (por CURP o por nombre).
// La recuperación se dispara con un token firmado, sin revelar el correo completo
// (evita cosechar emails aunque alguien tenga la CURP o el nombre).
const buscarCuentaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas búsquedas. Intenta de nuevo en unos minutos.' },
});

function enmascararEmail(email: string): string {
  const [local, dominio] = email.split('@');
  const [dom, ...tld] = dominio.split('.');
  const ocultar = (s: string) =>
    s.length <= 2 ? s[0] + '*' : s[0] + '*'.repeat(Math.min(s.length - 2, 5)) + s[s.length - 1];
  return `${ocultar(local)}@${ocultar(dom)}.${tld.join('.')}`;
}

const buscarCuentaSchema = z
  .object({
    curp: z.string().length(18).optional(),
    nombres: z.string().min(2).max(120).optional(),
    apellidoPaterno: z.string().min(2).max(100).optional(),
    apellidoMaterno: z.string().max(100).optional(),
  })
  .refine((d) => d.curp || (d.nombres && d.apellidoPaterno), {
    message: 'Proporciona tu CURP, o tu nombre y apellido paterno.',
  });

router.post('/buscar-cuenta', buscarCuentaLimiter, async (req, res) => {
  const parse = buscarCuentaSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }
  const { curp, nombres, apellidoPaterno, apellidoMaterno } = parse.data;

  try {
    if (curp) {
      const [fila] = await db
        .select({ email: users.email, nombreCompleto: estudiantes.nombreCompleto, activo: users.activo })
        .from(estudiantes)
        .innerJoin(users, eq(users.id, estudiantes.userId))
        .where(eq(estudiantes.curp, curp.toUpperCase().trim()));

      await tryAuditLog({
        accion: 'buscar_cuenta',
        entidad: 'estudiantes',
        detalle: `Búsqueda pública de cuenta por CURP (${fila ? 'encontrada' : 'sin resultado'})`,
        metadata: { via: 'curp' },
        req,
      });

      if (!fila || !fila.activo) {
        res.json({ encontrada: false });
        return;
      }
      res.json({
        encontrada: true,
        via: 'curp',
        nombre: fila.nombreCompleto,
        // Privacidad: nunca revelamos el correo completo (aunque tengan la CURP).
        emailEnmascarado: enmascararEmail(fila.email),
        recuperacionToken: signEmailToken(fila.email, 'recuperar_busqueda'),
      });
      return;
    }

    // Por nombre: todas las palabras deben aparecer en el nombre completo.
    const palabras = [nombres, apellidoPaterno, apellidoMaterno]
      .filter(Boolean)
      .join(' ')
      .trim()
      .split(/\s+/);
    const condiciones = palabras.map((p) => sql`unaccent(lower(${estudiantes.nombreCompleto})) LIKE unaccent(lower(${'%' + p + '%'}))`);
    const filas = await db
      .select({ email: users.email, nombreCompleto: estudiantes.nombreCompleto, activo: users.activo })
      .from(estudiantes)
      .innerJoin(users, eq(users.id, estudiantes.userId))
      .where(and(...condiciones))
      .limit(3);

    await tryAuditLog({
      accion: 'buscar_cuenta',
      entidad: 'estudiantes',
      detalle: `Búsqueda pública de cuenta por nombre (${filas.length} coincidencias)`,
      metadata: { via: 'nombre' },
      req,
    });

    const activas = filas.filter((f) => f.activo);
    if (activas.length === 0) {
      res.json({ encontrada: false });
      return;
    }
    if (activas.length > 1) {
      res.json({ encontrada: false, multiple: true });
      return;
    }
    res.json({
      encontrada: true,
      via: 'nombre',
      nombre: activas[0].nombreCompleto,
      emailEnmascarado: enmascararEmail(activas[0].email),
      recuperacionToken: signEmailToken(activas[0].email, 'recuperar_busqueda'),
    });
  } catch (e) {
    console.error('[publico/buscar-cuenta]', e);
    res.status(500).json({ error: 'Error al buscar la cuenta' });
  }
});

// Dispara el correo de recuperación de contraseña a la cuenta encontrada,
// sin que el solicitante necesite conocer el correo completo.
router.post('/buscar-cuenta/recuperar', buscarCuentaLimiter, async (req, res) => {
  const token = typeof req.body?.recuperacionToken === 'string' ? req.body.recuperacionToken : '';
  const datos = verifyEmailToken(token);
  if (!datos || datos.tipo !== 'recuperar_busqueda') {
    res.status(400).json({ error: 'La búsqueda expiró. Vuelve a buscar tu cuenta.' });
    return;
  }
  try {
    const [user] = await db.select({ id: users.id, activo: users.activo }).from(users).where(eq(users.email, datos.email));
    if (user && user.activo) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
      const expiraEn = new Date(Date.now() + 60 * 60 * 1000);
      await db.insert(passwordResetTokens).values({ userId: user.id, tokenHash, expiraEn });
      const portalBase = process.env.PUBLIC_PORTAL_URL || process.env.PORTAL_URL || 'http://localhost:5173';
      const resetUrl = `${portalBase}/reset-password?token=${resetToken}`;
      await sendRecuperarPassword(datos.email, { nombre: datos.email.split('@')[0], resetUrl, token: resetToken });
    }
    // Respuesta genérica siempre (no confirma si la cuenta existe).
    res.json({ ok: true, mensaje: 'Si la cuenta existe, enviamos el correo de recuperación.' });
  } catch {
    res.json({ ok: true, mensaje: 'Si la cuenta existe, enviamos el correo de recuperación.' });
  }
});

const validarCurpSchema = z.object({
  curp: z.string().min(1).max(18),
  nombres: z.string().max(120).optional(),
  apellidoPaterno: z.string().max(100).optional(),
  apellidoMaterno: z.string().max(100).optional(),
  fechaNacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sexo: z.string().max(20).optional(),
});

router.post('/validar-curp', curpLimiter, async (req, res) => {
  const parse = validarCurpSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ valida: false, errores: ['Datos inválidos.'] });
    return;
  }
  const { curp, ...datos } = parse.data;
  const resultado = validarCurp(curp, datos);

  if (resultado.valida) {
    const ocupada = await curpOcupada(curp.toUpperCase().trim());
    if (ocupada) {
      res.json({ valida: false, errores: [ocupada], entidadNacimiento: resultado.entidadNacimiento });
      return;
    }
  }
  res.json(resultado);
});

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

// ─── GET /publico/contacto ────────────────────────────────────────────────
// Datos de contacto institucionales (públicos por naturaleza): se muestran
// en páginas de ayuda como "encontrar cuenta".
router.get('/contacto', async (_req, res) => {
  try {
    const [datos] = await db
      .select({
        nombre: datosInstitucionales.nombreCorto,
        nombreOficial: datosInstitucionales.nombreOficial,
        correo: datosInstitucionales.correoSoporte,
        telefono: datosInstitucionales.telefonoGeneral,
      })
      .from(datosInstitucionales)
      .limit(1);
    res.json({
      nombre: datos?.nombre || datos?.nombreOficial || 'Coordinación de Preparatoria Abierta Michoacán',
      correo: datos?.correo || 'contacto@michoacan.gob.mx',
      telefono: datos?.telefono || '+52 443 322 9250',
    });
  } catch {
    res.json({
      nombre: 'Coordinación de Preparatoria Abierta Michoacán',
      correo: 'contacto@michoacan.gob.mx',
      telefono: '+52 443 322 9250',
    });
  }
});

// ─── Token helpers (HMAC, 30 min) ────────────────────────────────────────
import { SESSION_SECRET as TOKEN_SECRET } from '../config/env';
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

  // ⚠️ TODO(TEMPORAL — QUITAR): bypass de código para PRUEBAS mientras el envío
  // de correo (resend) no funciona. Acepta "111111" para cualquier correo/tipo.
  // BUSCAR "BYPASS_CODIGO_PRUEBAS" para eliminar esto antes de producción real.
  if (codigo === '111111') {
    // BYPASS_CODIGO_PRUEBAS
    await db
      .update(emailVerifications)
      .set({ verificado: true })
      .where(
        and(
          eq(emailVerifications.email, email),
          eq(emailVerifications.tipo, tipo),
          eq(emailVerifications.verificado, false)
        )
      )
      .catch(() => {});
    const token = signEmailToken(email, tipo);
    res.json({ ok: true, token });
    return;
  }

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

// Campos desglosados opcionales (compartidos por auto-registro y solicitud)
const camposDesglosados = {
  nombres: z.string().max(120).optional(),
  apellidoPaterno: z.string().max(100).optional(),
  apellidoMaterno: z.string().max(100).optional(),
  sexo: z.string().max(20).optional(),
  lugarNacimiento: z.string().max(120).optional(),
  entidadNacimiento: z.string().max(80).optional(),
  estadoCivil: z.string().max(30).optional(),
  ultimoEstudio: z.string().max(120).optional(),
  calleNumero: z.string().max(200).optional(),
  colonia: z.string().max(120).optional(),
  cp: z.string().max(10).optional(),
  ciudad: z.string().max(120).optional(),
  estadoDomicilio: z.string().max(80).optional(),
};

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
  ...camposDesglosados,
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

  const errEdadAR = validarEdad(data.fechaNacimiento);
  if (errEdadAR) { res.status(400).json({ error: errEdadAR }); return; }

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
      nombreCompleto: armarNombreCompleto(data) || data.nombreCompleto,
      nombres: data.nombres,
      apellidoPaterno: data.apellidoPaterno,
      apellidoMaterno: data.apellidoMaterno,
      curp: null,
      fechaNacimiento: data.fechaNacimiento,
      sexo: data.sexo,
      lugarNacimiento: data.lugarNacimiento,
      entidadNacimiento: data.entidadNacimiento,
      estadoCivil: data.estadoCivil,
      ultimoEstudio: data.ultimoEstudio,
      telefono: data.telefono,
      direccion: armarDireccion(data) || data.direccion || null,
      calleNumero: data.calleNumero,
      colonia: data.colonia,
      cp: data.cp,
      ciudad: data.ciudad,
      estadoDomicilio: data.estadoDomicilio,
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

    return user;
  });

  await tryAuditLog({
    userId: result.id,
    accion: 'auto_registro',
    entidad: 'users',
    entidadId: result.id,
    detalle: `Auto-registro completado para ${data.email}`,
    metadata: { email: data.email, registroTipo: 'auto_registro' },
    req,
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
  modalidadPreferida: z.enum(['con_gestor', 'auto_gestion']).optional(),
  quiereInfoGestores: z.boolean().optional(),
  ...camposDesglosados,
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

  const errEdad = validarEdad(data.fechaNacimiento);
  if (errEdad) { res.status(400).json({ error: errEdad }); return; }

  // Filtro de auditoría de CURP (servidor = autoridad final, aunque el
  // frontend ya haya validado): estructura + dígito verificador + cruce
  // contra los datos declarados.
  const curpNormalizada = data.curp.toUpperCase().trim();
  const resultadoCurp = validarCurp(curpNormalizada, {
    nombres: data.nombres,
    apellidoPaterno: data.apellidoPaterno,
    apellidoMaterno: data.apellidoMaterno,
    fechaNacimiento: data.fechaNacimiento,
    sexo: data.sexo,
  });
  if (!resultadoCurp.valida) {
    res.status(400).json({ error: resultadoCurp.errores[0] ?? 'CURP inválida.' });
    return;
  }

  // Unicidad: ni alumnos existentes ni solicitudes activas.
  const ocupada = await curpOcupada(curpNormalizada);
  if (ocupada) {
    res.status(409).json({ error: ocupada });
    return;
  }

  await db.insert(solicitudesCuenta).values({
    nombreCompleto: armarNombreCompleto(data) || data.nombreCompleto,
    nombres: data.nombres,
    apellidoPaterno: data.apellidoPaterno,
    apellidoMaterno: data.apellidoMaterno,
    curp: curpNormalizada,
    fechaNacimiento: data.fechaNacimiento,
    sexo: data.sexo,
    lugarNacimiento: data.lugarNacimiento,
    entidadNacimiento: data.entidadNacimiento,
    estadoCivil: data.estadoCivil,
    ultimoEstudio: data.ultimoEstudio,
    email: data.email.toLowerCase(),
    telefono: data.telefono,
    calleNumero: data.calleNumero,
    colonia: data.colonia,
    cp: data.cp,
    ciudad: data.ciudad,
    estadoDomicilio: data.estadoDomicilio,
    municipioId: data.municipioId,
    mensaje: data.mensaje ?? null,
    modalidadPreferida: data.modalidadPreferida ?? null,
    quiereInfoGestores: data.quiereInfoGestores ?? false,
    emailVerificado: true,
    estado: 'pendiente',
  });

  notificarATodosLosAdmins({
    tipo: 'solicitud_nueva',
    prioridad: 'alta',
    titulo: 'Nueva solicitud de cuenta',
    cuerpo: `${data.nombreCompleto} solicitó una cuenta de acceso al sistema.`,
    enlace: '/admin/solicitudes',
  });

  // Correos outbox (sin bloquear la respuesta)
  const [munRow] = await db.select({ nombre: municipios.nombre }).from(municipios).where(eq(municipios.id, data.municipioId));
  const municipioNombre = munRow?.nombre ?? 'Michoacán';
  const portalUrl = process.env.PUBLIC_PORTAL_URL ?? 'https://edumich.up.railway.app';
  const panelUrl = `${portalUrl}/admin/solicitudes`;

  sendEmail({
    to: data.email.toLowerCase(),
    toName: data.nombreCompleto,
    ...autoregistroConfirmacionTemplate({ nombreCompleto: data.nombreCompleto, municipio: municipioNombre, portalUrl }),
    evento: 'autoregistro_alumno',
    metadata: { municipio: municipioNombre },
  }).catch(() => {});

  const adminNotifEmail = process.env.ADMIN_NOTIFICATION_EMAIL ?? process.env.INSTITUTIONAL_CC_EMAIL;
  if (adminNotifEmail) {
    sendEmail({
      to: adminNotifEmail,
      ...notifAdminAutoregistroTemplate({ nombreAspirante: data.nombreCompleto, emailAspirante: data.email.toLowerCase(), municipio: municipioNombre, telefono: data.telefono, panelUrl }),
      evento: 'notificacion_admin_autoregistro',
      metadata: { aspirante: data.nombreCompleto, municipio: municipioNombre },
    }).catch(() => {});
  }

  res.json({ ok: true });
});

// ─── GET /publico/verificar/:folio ───────────────────────────────────────────
router.get('/verificar/:folio', async (req, res) => {
  const folio = req.params.folio?.replace(/[^a-zA-Z0-9-]/g, '');
  if (!folio) { res.status(400).send('<h1>Folio inválido</h1>'); return; }

  const [row] = await db
    .select({
      nombreCompleto: estudiantes.nombreCompleto,
      folioPreregistro: estudiantes.folioPreregistro,
      preregistroVigenteHasta: estudiantes.preregistroVigenteHasta,
      preregistroGeneradoEn: estudiantes.preregistroGeneradoEn,
      municipioNombre: municipios.nombre,
      gestorNombre: gestores.nombreCompleto,
    })
    .from(estudiantes)
    .leftJoin(municipios, eq(estudiantes.municipioId, municipios.id))
    .leftJoin(gestores, eq(estudiantes.gestorId, gestores.userId))
    .where(eq(estudiantes.folioPreregistro, folio))
    .limit(1);

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  if (!row) {
    res.status(404).type('html').send(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Folio no encontrado</title><style>body{font-family:system-ui,sans-serif;max-width:560px;margin:60px auto;padding:0 24px;color:#1a1a1a}</style></head><body><p style="color:#b91c1c;font-weight:700">Folio no encontrado</p><p>El código <code>${folio}</code> no corresponde a ningún pre-registro activo.</p></body></html>`);
    return;
  }

  const vigenteHasta = row.preregistroVigenteHasta ? new Date(row.preregistroVigenteHasta + 'T00:00:00') : null;
  const diasRestantes = vigenteHasta ? Math.ceil((vigenteHasta.getTime() - hoy.getTime()) / 86_400_000) : null;
  const estado: 'vigente' | 'por_vencer' | 'vencido' =
    diasRestantes === null ? 'vigente'
    : diasRestantes <= 0   ? 'vencido'
    : diasRestantes <= 3   ? 'por_vencer'
    : 'vigente';

  const estadoCfg = {
    vigente:    { label: 'VIGENTE',    bg: '#d1fae5', color: '#166534', border: '#86efac' },
    por_vencer: { label: 'POR VENCER', bg: '#fef9c3', color: '#854d0e', border: '#fde047' },
    vencido:    { label: 'VENCIDO',    bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
  }[estado];

  const fechaGen = row.preregistroGeneradoEn
    ? new Date(row.preregistroGeneradoEn).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';
  const fechaVig = vigenteHasta
    ? vigenteHasta.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verificar Pre-registro — Preparatoria Abierta Michoacán</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,-apple-system,sans-serif;background:#f5f5f4;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
    .card{background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:520px;width:100%;overflow:hidden}
    .header{background:linear-gradient(135deg,#6b1530 0%,#4a0e20 100%);padding:28px 32px;color:white;text-align:center}
    .header-logo{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;opacity:.8;margin-bottom:8px}
    .header-title{font-size:20px;font-weight:800;letter-spacing:-.01em}
    .header-sub{font-size:12px;opacity:.7;margin-top:4px}
    .verified-badge{margin:28px auto 20px;width:72px;height:72px;background:#d1fae5;border-radius:50%;display:flex;align-items:center;justify-content:center}
    .verified-label{text-align:center;font-size:16px;font-weight:700;color:#166534;margin-bottom:4px}
    .verified-sub{text-align:center;font-size:12px;color:#78716c;margin-bottom:24px}
    .body{padding:0 32px 32px}
    .folio-box{background:#faf9f8;border:1px solid #e7e5e4;border-left:4px solid #6b1530;border-radius:8px;padding:14px 18px;margin-bottom:20px}
    .folio-label{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#78716c;margin-bottom:4px}
    .folio-value{font-family:monospace;font-size:20px;font-weight:700;color:#6b1530;letter-spacing:.04em}
    .vigencia-pill{display:inline-block;padding:4px 12px;border-radius:99px;font-size:11px;font-weight:700;letter-spacing:.06em;border:1px solid ${estadoCfg.border};background:${estadoCfg.bg};color:${estadoCfg.color};margin-top:8px}
    .row{display:flex;gap:8px;margin-bottom:12px}
    .field{flex:1}
    .field-label{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#a8a29e;margin-bottom:3px}
    .field-value{font-size:14px;color:#1a1a1a;font-weight:500}
    .divider{height:1px;background:#f0ede9;margin:20px 0}
    .footer{text-align:center;font-size:11px;color:#a8a29e;padding-top:4px}
    ${estado === 'vencido' ? '.card{opacity:.9}' : ''}
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="header-logo">Gobierno del Estado de Michoacán</div>
      <div class="header-title">Modula · Sistema de Verificación de Documentos</div>
      <div class="header-sub">Plataforma Educativa Digital · Preparatoria Abierta · IEMSyS Michoacán</div>
    </div>
    <div class="body">
      <div class="verified-badge">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#166534" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      </div>
      <div class="verified-label">Documento verificado</div>
      <div class="verified-sub">Este folio de pre-registro existe en la base de datos oficial</div>

      <div class="folio-box">
        <div class="folio-label">Folio de pre-registro</div>
        <div class="folio-value">${row.folioPreregistro}</div>
        <div class="vigencia-pill">${estadoCfg.label}${diasRestantes !== null && diasRestantes > 0 ? ` · ${diasRestantes} día${diasRestantes !== 1 ? 's' : ''}` : ''}</div>
      </div>

      <div class="row">
        <div class="field">
          <div class="field-label">Nombre del aspirante</div>
          <div class="field-value">${row.nombreCompleto}</div>
        </div>
      </div>
      <div class="row">
        ${row.municipioNombre ? `<div class="field"><div class="field-label">Municipio</div><div class="field-value">${row.municipioNombre}</div></div>` : ''}
        ${row.gestorNombre ? `<div class="field"><div class="field-label">Gestor municipal</div><div class="field-value">${row.gestorNombre}</div></div>` : ''}
      </div>

      <div class="divider"></div>

      <div class="row">
        <div class="field">
          <div class="field-label">Generado el</div>
          <div class="field-value">${fechaGen}</div>
        </div>
        <div class="field">
          <div class="field-label">Vigente hasta</div>
          <div class="field-value" style="color:${estadoCfg.color}">${fechaVig}</div>
        </div>
      </div>

      <div class="footer">
        Modula &mdash; Plataforma Educativa Digital · Gobierno del Estado de Michoacán<br>
        Este documento es válido únicamente como comprobante de pre-registro.
      </div>
    </div>
  </div>
</body>
</html>`;

  res.type('html').send(html);
});

export default router;
