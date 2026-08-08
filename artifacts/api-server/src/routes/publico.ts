/**
 * Rutas PÚBLICAS — sin autenticación requerida.
 *
 * POST /publico/email/solicitar-codigo
 * POST /publico/email/verificar-codigo
 * POST /publico/auto-registro
 * POST /publico/solicitudes-cuenta
 */

import { Router } from 'express';
import { eq, and, or, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
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
  codigosPostales,
} from '@workspace/db/schema';
import { setSessionCookie } from '../middleware/auth';
import { armarNombreCompleto, armarDireccion, normalizarNombre } from '../utils/estudianteDatos';
import { urlPortalEstado } from '../utils/portal';
import { patronLike } from '../utils/like';
import { parseCredencialQr } from '../utils/credencialQr';
import { VIGENCIA_CREDENCIAL_MESES } from '../config/reglas';
import { puedeRevelarCredenciales, sendVerificationCode, sendEmail, sendRecuperarPassword } from '../services/email';
import { autoregistroConfirmacionTemplate } from '../services/templates/autoregistro-confirmacion';
import { notifAdminAutoregistroTemplate } from '../services/templates/notif-admin-autoregistro';
import { tryAuditLog } from '../utils/audit';
import { notificarATodosLosAdmins } from '../utils/notificar';
import multer from 'multer';
import { leerDocumento } from '../services/lecturaDocumentos';
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

/**
 * ¿La CURP ya está ocupada por un alumno o una solicitud activa?
 *
 * Devuelve además el MOTIVO, porque la salida no es la misma: quien ya es
 * alumno tiene cuenta y lo que necesita es recuperarla; quien solo tiene una
 * solicitud en revisión todavía no tiene nada que recuperar y lo único que
 * corresponde es esperar. Mandarlo a "recupera tu contraseña" ahí sería
 * mandarlo a una pantalla que no le va a servir.
 */
type MotivoCurp = 'alumno' | 'solicitud_pendiente' | 'solicitud_aprobada';

async function curpOcupada(curp: string): Promise<{ mensaje: string; motivo: MotivoCurp } | null> {
  const [alumno] = await db
    .select({ userId: estudiantes.userId })
    .from(estudiantes)
    .where(eq(estudiantes.curp, curp));
  if (alumno) {
    return { mensaje: 'Ya existe un alumno registrado con esa CURP.', motivo: 'alumno' };
  }

  const [solicitud] = await db
    .select({ id: solicitudesCuenta.id, estado: solicitudesCuenta.estado })
    .from(solicitudesCuenta)
    .where(and(eq(solicitudesCuenta.curp, curp), sql`${solicitudesCuenta.estado} IN ('pendiente','aprobada')`));
  if (solicitud) {
    return solicitud.estado === 'pendiente'
      ? {
          mensaje: 'Ya hay una solicitud en revisión con esa CURP. Espera la respuesta de la administración: te llegará por correo.',
          motivo: 'solicitud_pendiente',
        }
      : {
          mensaje: 'Esa CURP ya tiene una solicitud aprobada, así que la cuenta ya existe. Revisa tu correo o recupera tu contraseña.',
          motivo: 'solicitud_aprobada',
        };
  }
  return null;
}

// ─── Buscar cuenta ("no recuerdo si tengo cuenta") ────────────────────────
// Privacidad: el correo SIEMPRE se devuelve enmascarado (por CURP o por nombre).
// La recuperación se dispara con un token firmado, sin revelar el correo completo
// (evita cosechar emails aunque alguien tenga la CURP o el nombre).
/**
 * Leer un documento cuesta CPU de verdad —abrir un PDF, o reconocer caracteres
 * en una imagen— a diferencia de validar una CURP, que es aritmética. Por eso
 * tiene su propio tope, más bajo: sin él, un endpoint público que acepta
 * archivos es una forma cómoda de tumbar el servidor.
 */
const lecturaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, aviso: 'Demasiadas lecturas seguidas. Espera unos minutos o captura los datos a mano.' },
});

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
    nombres: z.string().min(2).max(120).transform(normalizarNombre).optional(),
    apellidoPaterno: z.string().min(2).max(100).transform(normalizarNombre).optional(),
    apellidoMaterno: z.string().max(100).transform(normalizarNombre).optional(),
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
    const condiciones = palabras.map((p) => sql`unaccent(lower(${estudiantes.nombreCompleto})) LIKE unaccent(lower(${patronLike(p)}))`);
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
      const portalBase = urlPortalEstado();
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
  nombres: z.string().max(120).transform(normalizarNombre).optional(),
  apellidoPaterno: z.string().max(100).transform(normalizarNombre).optional(),
  apellidoMaterno: z.string().max(100).transform(normalizarNombre).optional(),
  fechaNacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sexo: z.string().max(20).optional(),
});

// ─── POST /publico/leer-documento ────────────────────────────────────────
/**
 * Lee un documento y PROPONE los datos que trae. No guarda nada.
 *
 * Es público —sin sesión— porque el aspirante que se registra por su cuenta
 * todavía no la tiene, y es justo quien más gana con esto. A cambio lleva
 * cuatro candados: tope de peticiones, tope de tamaño, tipos permitidos, y
 * **el archivo nunca toca el disco**: se procesa en memoria y se descarta. Un
 * documento que no se guarda no se puede filtrar.
 *
 * Responde 200 incluso cuando no pudo leer: "no se pudo" es una respuesta
 * legítima de esta función, no un error del sistema. La persona teclea, como
 * siempre.
 */
const subidaLectura = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
});

router.post('/leer-documento', lecturaLimiter, subidaLectura.single('archivo'), async (req, res) => {
  const archivo = req.file;
  if (!archivo) {
    res.json({ ok: false, aviso: 'No llegó ningún archivo.' });
    return;
  }
  const permitidos = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'];
  if (!permitidos.includes(archivo.mimetype)) {
    res.json({ ok: false, aviso: 'Sube un PDF o una foto (JPG o PNG).' });
    return;
  }
  try {
    const lectura = await leerDocumento(archivo.buffer, archivo.mimetype);
    res.json(lectura);
  } catch (e) {
    console.error('[publico/leer-documento]', e);
    res.json({ ok: false, aviso: 'No se pudo leer el documento. Captura los datos a mano.' });
  }
});

router.post('/validar-curp', curpLimiter, async (req, res) => {
  const parse = validarCurpSchema.safeParse(req.body);
  if (!parse.success) {
    // El contrato de este endpoint es { valida, errores }: un dato mal formado
    // se responde como validación fallida (200), no como 400 crudo. Así el
    // cliente muestra un mensaje útil en vez del código de estado pelón.
    res.json({ valida: false, errores: ['No se pudo validar la CURP con los datos capturados. Revísalos e intenta de nuevo.'] });
    return;
  }
  const { curp, ...datos } = parse.data;
  const resultado = validarCurp(curp, datos);

  if (resultado.valida) {
    const ocupada = await curpOcupada(curp.toUpperCase().trim());
    if (ocupada) {
      // `ocupada` distingue "esa CURP ya está en el sistema" de "esa CURP está
      // mal escrita": lo primero no se arregla corrigiendo el dato, así que la
      // interfaz ofrece la salida correcta en vez de dejar a la persona
      // reescribiendo una CURP que estaba bien.
      res.json({
        valida: false,
        ocupada: ocupada.motivo,
        errores: [ocupada.mensaje],
        entidadNacimiento: resultado.entidadNacimiento,
      });
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

// ─── GET /publico/cp/:cp ──────────────────────────────────────────────────
// Catálogo de código postal (SEPOMEX): dado un CP devuelve estado, municipio y
// la lista de colonias, para autollenar el domicilio. Referencia pública; si el
// CP no está cargado, devuelve colonias vacías (el domicilio sigue a mano).
router.get('/cp/:cp', async (req, res) => {
  const cp = String(req.params.cp || '').trim();
  if (!/^\d{5}$/.test(cp)) { res.status(400).json({ error: 'CP inválido' }); return; }
  try {
    const rows = await db
      .select({
        colonia: codigosPostales.colonia,
        municipio: codigosPostales.municipio,
        ciudad: codigosPostales.ciudad,
        estado: codigosPostales.estado,
      })
      .from(codigosPostales)
      .where(eq(codigosPostales.cp, cp))
      .orderBy(codigosPostales.colonia);
    if (rows.length === 0) { res.json({ encontrado: false, estado: null, municipio: null, ciudad: null, colonias: [] }); return; }
    res.json({
      encontrado: true,
      estado: rows[0].estado,
      municipio: rows[0].municipio,
      ciudad: rows[0].ciudad || rows[0].municipio,
      colonias: rows.map((r) => r.colonia),
    });
  } catch {
    // Si la tabla aún no existe / no se ha importado, no rompe el formulario.
    res.json({ encontrado: false, estado: null, municipio: null, ciudad: null, colonias: [] });
  }
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
      correo: datos?.correo || CONTACTO_CORREO,
      telefono: datos?.telefono || '+52 443 322 9250',
    });
  } catch {
    res.json({
      nombre: 'Coordinación de Preparatoria Abierta Michoacán',
      correo: CONTACTO_CORREO,
      telefono: '+52 443 322 9250',
    });
  }
});

// ─── Token helpers (HMAC, 30 min) ────────────────────────────────────────
import { SESSION_SECRET as TOKEN_SECRET } from '../config/env';
import { normalizarTelefonoOMantener, exigirTelefonoMx } from '../utils/telefono';
import { CONTACTO_CORREO } from '../config/contacto';
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
// ─── GET /publico/correo-existe ───────────────────────────────────────────
// ¿Ese correo ya tiene cuenta? Sirve para avisarlo EN EL FORMULARIO, cuando la
// persona aún puede corregir, en vez de dejarla capturar todo el trámite para
// que choque al final.
//
// Sobre la privacidad: esto permitiría sondear si un correo está registrado.
// Se acota a lo mínimo —devuelve solo sí/no, sin nombre ni estado de la
// cuenta— y va con límite de peticiones. El propio login ya revela lo mismo a
// quien insista, y aquí el beneficio (no perder un trámite completo) pesa más.
const limiteCorreoExiste = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas consultas. Espera unos minutos.' },
});

router.get('/correo-existe', limiteCorreoExiste, async (req, res) => {
  const email = String(req.query.email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.json({ existe: false });
    return;
  }
  try {
    const [fila] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    res.json({ existe: !!fila });
  } catch {
    // Ante un fallo se responde "no existe": el candado de verdad está al pedir
    // el código y al guardar la solicitud, no en este aviso de cortesía.
    res.json({ existe: false });
  }
});

router.post('/email/solicitar-codigo', async (req, res) => {
  const parse = z
    .object({
      email: z.string().trim().toLowerCase().email(),
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

  // NINGÚN camino (auto-registro NI solicitud de cuenta) debe avanzar si ese
  // correo ya tiene cuenta. Antes solo se revisaba en `auto_registro`, así que
  // por "solicitud_cuenta" se colaban solicitudes imposibles: se capturaba todo
  // el trámite y el choque aparecía hasta que la administración intentaba
  // aprobarla. Se corta aquí, al pedir el código, que es cuando la persona aún
  // puede corregir. Cuenta ACTIVA o dada de baja: si existe, existe.
  const [existing] = await db.select({ activo: users.activo }).from(users).where(eq(users.email, email));
  if (existing) {
    res.status(409).json({
      error: 'Ya existe una cuenta con este correo.',
      yaExiste: true,
      cuentaActiva: existing.activo,
    });
    return;
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
    ...(puedeRevelarCredenciales() ? { codigoDev: result.codigo } : {}),
  });
});

// ─── POST /publico/email/verificar-codigo ─────────────────────────────────
router.post('/email/verificar-codigo', async (req, res) => {
  const parse = z
    .object({
      email: z.string().trim().toLowerCase().email(),
      codigo: z.string().length(6),
      tipo: z.string(),
    })
    .safeParse(req.body);

  if (!parse.success) {
    res.status(400).json({ error: 'Datos inválidos' });
    return;
  }
  const { email, codigo, tipo } = parse.data;

  // Atajo de PRUEBAS: acepta "111111" sin mandar correo, para poder recorrer el
  // alta en desarrollo. NUNCA en producción.
  //
  // Estuvo activo en producción sin este candado y era explotable por cualquiera:
  // pedir código para el correo de un tercero, mandar "111111", recibir un token
  // firmado válido y auto-registrarse con ese correo — quedándoselo, porque el
  // correo es único y la persona real ya no podría darse de alta.
  //
  // El candado va contra NODE_ENV y no contra una bandera propia a propósito: una
  // bandera se puede encender por error en producción; esto no.
  if (codigo === '111111' && process.env.NODE_ENV !== 'production') {
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
  nombres: z.string().max(120).transform(normalizarNombre).optional(),
  apellidoPaterno: z.string().max(100).transform(normalizarNombre).optional(),
  apellidoMaterno: z.string().max(100).transform(normalizarNombre).optional(),
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

/**
 * Los tres del domicilio y nacimiento que SÍ son obligatorios.
 *
 * La entidad de nacimiento va en el acta y en la matrícula oficial; el código
 * postal y la colonia son lo que hace localizable el domicilio. Si nacen vacíos
 * hay que perseguir a la persona después para completarlos, y para entonces ya
 * no contesta. Van con mensaje propio porque el texto por omisión de Zod está
 * en inglés y le tocaría leerlo al alumno.
 */
const camposObligatorios = {
  entidadNacimiento: z.string().min(1, 'Selecciona tu estado de nacimiento.').max(80),
  cp: z.string().regex(/^\d{5}$/, 'Escribe tu código postal (5 dígitos).'),
  colonia: z.string().min(1, 'Escribe o selecciona tu colonia.').max(120),
};

// ─── POST /publico/auto-registro ──────────────────────────────────────────
const autoRegistroSchema = z.object({
  emailVerificadoToken: z.string(),
  email: z.string().trim().toLowerCase().email(),
  nombreCompleto: z.string().min(2).max(200).transform(normalizarNombre),
  fechaNacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  telefono: z
    .string()
    // Obligatorio y completo: la pantalla ya solo admite 10 dígitos, y un
    // número a medias no sirve para avisarle nada a nadie.
    .transform((v) => exigirTelefonoMx(v))
    .refine((v): v is string => v !== null, 'El teléfono debe tener 10 dígitos, sin la lada de país.'),
  municipioId: z.number().int().positive(),
  direccion: z.string().optional(),
  password: z.string().min(8),
  ...camposDesglosados,
  ...camposObligatorios,
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
  nombreCompleto: z.string().min(2).max(200).transform(normalizarNombre),
  curp: z.string().length(18),
  fechaNacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  email: z.string().trim().toLowerCase().email(),
  telefono: z
    .string()
    // Obligatorio y completo: la pantalla ya solo admite 10 dígitos, y un
    // número a medias no sirve para avisarle nada a nadie.
    .transform((v) => exigirTelefonoMx(v))
    .refine((v): v is string => v !== null, 'El teléfono debe tener 10 dígitos, sin la lada de país.'),
  municipioId: z.number().int().positive(),
  mensaje: z.string().optional(),
  /**
   * De dónde salió cada dato: `{ curp: 'pdf_curp' }`. Se valida contra la lista
   * cerrada de fuentes en vez de aceptar cualquier objeto — es un campo que
   * llega de fuera y termina guardado, así que no puede ser texto libre.
   */
  datosLeidosDe: z.record(z.enum(['pdf_curp', 'pdf_acta', 'ine_mrz'])).optional(),
  modalidadPreferida: z.enum(['con_gestor', 'auto_gestion']).optional(),
  quiereInfoGestores: z.boolean().optional(),
  ...camposDesglosados,
  ...camposObligatorios,
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

  // Última barrera antes de guardar: aunque el token de correo sea válido, la
  // cuenta pudo crearse en el intervalo. Una solicitud para un correo que ya
  // tiene cuenta es imposible de aprobar, así que no debe nacer.
  const [cuentaExistente] = await db.select({ id: users.id }).from(users).where(eq(users.email, data.email));
  if (cuentaExistente) {
    res.status(409).json({
      error: 'Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña en vez de solicitar una cuenta nueva.',
      yaExiste: true,
    });
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
    res.status(409).json({ error: ocupada.mensaje, ocupada: ocupada.motivo });
    return;
  }

  await db.insert(solicitudesCuenta).values({
    nombreCompleto: armarNombreCompleto(data) || data.nombreCompleto,
    nombres: data.nombres,
    apellidoPaterno: data.apellidoPaterno,
    apellidoMaterno: data.apellidoMaterno,
    curp: curpNormalizada,
    datosLeidosDe: data.datosLeidosDe ?? null,
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
  const portalUrl = urlPortalEstado();
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
      portadorActivo: users.activo,
    })
    .from(estudiantes)
    .leftJoin(municipios, eq(estudiantes.municipioId, municipios.id))
    .leftJoin(gestores, eq(estudiantes.gestorId, gestores.userId))
    .leftJoin(users, eq(users.id, estudiantes.userId))
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
  // Si el portador causó BAJA, su ficha deja de ser un documento vigente aunque
  // la fecha no haya pasado (mismo criterio que la credencial y el pase).
  const dadoDeBaja = row.portadorActivo === false;
  const estado: 'vigente' | 'por_vencer' | 'vencido' | 'baja' =
    dadoDeBaja            ? 'baja'
    : diasRestantes === null ? 'vigente'
    : diasRestantes <= 0   ? 'vencido'
    : diasRestantes <= 3   ? 'por_vencer'
    : 'vigente';

  const estadoCfg = {
    vigente:    { label: 'VIGENTE',    bg: '#d1fae5', color: '#166534', border: '#86efac' },
    por_vencer: { label: 'POR VENCER', bg: '#fef9c3', color: '#854d0e', border: '#fde047' },
    vencido:    { label: 'VENCIDO',    bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
    baja:       { label: 'DADO DE BAJA', bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
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

// ─── GET /publico/guias/:rol ─────────────────────────────────────────────
/**
 * Las guías en PDF, descargables sin sesión.
 *
 * Van SIN login a propósito: el enlace viaja dentro del correo de bienvenida,
 * y a esa altura la persona todavía no ha entrado nunca. Pedirle sesión para
 * leer la guía que le explica cómo iniciar sesión es un círculo.
 *
 * No hay nada sensible dentro: son instrucciones de uso con capturas de datos
 * ficticios (ver docs/guias/LEEME.md, regla 22).
 *
 * Los archivos viven en `artifacts/api-server/assets/guias/` y no en `docs/`
 * porque el Dockerfile copia `artifacts/` y NO copia `docs/`: desde docs no
 * viajarían en la imagen y el enlace daría 404 en producción.
 */
const GUIAS: Record<string, { archivo: string; titulo: string }> = {
  alumno: { archivo: 'Guia-Alumno-Modula22.pdf', titulo: 'Guia del alumno' },
  gestor: { archivo: 'Guia-Gestor-Modula22.pdf', titulo: 'Guia del centro de asesoria' },
  admin: { archivo: 'Guia-Administracion-Modula22.pdf', titulo: 'Guia de administracion' },
};

function rutaGuia(archivo: string): string | null {
  const candidatos = [
    path.join(process.cwd(), 'assets', 'guias', archivo),
    path.join(process.cwd(), 'artifacts', 'api-server', 'assets', 'guias', archivo),
  ];
  return candidatos.find((c) => fs.existsSync(c)) ?? null;
}

router.get('/guias/:rol', (req, res) => {
  const guia = GUIAS[req.params.rol];
  if (!guia) { res.status(404).json({ error: 'Esa guía no existe' }); return; }

  const ruta = rutaGuia(guia.archivo);
  if (!ruta) {
    console.error('[publico/guias] no encontré el archivo:', guia.archivo);
    res.status(404).json({ error: 'La guía no está disponible en este momento' });
    return;
  }

  // El nombre de descarga va en ASCII (regla 7): quien la abre puede estar en
  // Windows con una configuración que rompe los acentos.
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${guia.archivo}"`);
  // Se cachea un día: el archivo cambia cuando se regenera la guía, no a diario.
  res.setHeader('Cache-Control', 'public, max-age=86400');
  fs.createReadStream(ruta).pipe(res);
});

// ─── GET /publico/credencial/:folio ──────────────────────────────────────
/**
 * Verificación pública de una credencial de estudiante.
 *
 * Es a donde apunta el QR impreso en la credencial. Sin sesión: quien verifica
 * es un vigilante en la puerta de una sede, alguien de la DGB o quien aplica el
 * examen — gente que no tiene cuenta en la plataforma y que necesita una
 * respuesta en el celular, en segundos.
 *
 * ── Qué protege los datos ───────────────────────────────────────────────────
 * El folio es legible y secuencial, así que por sí solo no protege nada: quien
 * quisiera podría recorrerlos y sacar el padrón. Lo que impide eso es la FIRMA
 * (`?t=`), un HMAC del folio con QR_SECRET. Sin firma válida esta ruta no
 * devuelve NADA de la persona; solo dice que no se pudo verificar. Y para tener
 * una firma válida hay que haber escaneado una credencial de verdad.
 *
 * Se devuelve lo mínimo para confirmar que la credencial es auténtica y de
 * quien la trae: nombre, folio, sede y vigencia. Ni CURP, ni correo, ni
 * teléfono, ni calificaciones — nada que convierta un escaneo en una ficha.
 */
router.get('/credencial/:folio', async (req, res) => {
  const crudo = `${req.params.folio}${req.query.t ? `?t=${String(req.query.t)}` : ''}`;
  const { folio, firmaValida } = parseCredencialQr(crudo);

  // Respuesta deliberadamente idéntica para "firma inválida" y "no existe": si
  // fueran distintas, se podría averiguar qué folios existen probando.
  const noVerificada = { valida: false as const, motivo: 'No se pudo verificar esta credencial.' };
  if (!firmaValida) { res.json(noVerificada); return; }

  try {
    const [est] = await db
      .select({
        userId: estudiantes.userId,
        nombre: estudiantes.nombreCompleto,
        matricula: estudiantes.matriculaOficialDGB,
        municipioId: estudiantes.municipioId,
        emitidaEn: estudiantes.licenciaEmitidaEn,
        estadoCuenta: estudiantes.estadoCuenta,
      })
      .from(estudiantes)
      // El QR de la credencial trae el folio de la licencia; el de las fichas
      // trae el de preregistro. Los dos van firmados con la misma llave, así
      // que la misma pantalla atiende ambos documentos.
      .where(or(eq(estudiantes.licenciaDigital, folio), eq(estudiantes.folioPreregistro, folio)));

    if (!est) { res.json(noVerificada); return; }

    const [muni] = est.municipioId
      ? await db.select({ nombre: municipios.nombre }).from(municipios).where(eq(municipios.id, est.municipioId))
      : [];

    const vence = est.emitidaEn ? new Date(est.emitidaEn) : null;
    if (vence) vence.setMonth(vence.getMonth() + VIGENCIA_CREDENCIAL_MESES);
    const vencida = vence ? vence.getTime() < Date.now() : true;

    // Una cuenta dada de baja invalida la credencial aunque la fecha no haya
    // pasado: el documento acredita ser estudiante, y ya no lo es.
    // `users.activo` es el interruptor de acceso; `estado_cuenta` marca la baja
    // administrativa y la depuración. Cualquiera de los dos invalida el
    // documento: acredita ser estudiante, y ya no lo es.
    const [cuenta] = await db
      .select({ activo: users.activo })
      .from(users)
      .where(eq(users.id, est.userId));
    const deBaja =
      cuenta?.activo === false ||
      est.estadoCuenta === 'baja_definitiva' ||
      est.estadoCuenta === 'soft_deleted' ||
      est.estadoCuenta === 'hard_deleted';

    res.json({
      valida: true as const,
      folio,
      nombre: est.nombre ?? '',
      matricula: est.matricula ?? null,
      sede: muni?.nombre ?? null,
      vigenteHasta: vence ? vence.toISOString() : null,
      vigente: !vencida && !deBaja,
      motivo: deBaja ? 'La cuenta de esta persona ya no está activa.' : vencida ? 'La credencial está vencida.' : null,
    });
  } catch (e) {
    console.error('[publico/credencial]', e);
    res.status(500).json({ valida: false, motivo: 'No se pudo verificar en este momento.' });
  }
});

export default router;
