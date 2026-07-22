/**
 * Pagos de examen — orden de pago vía Tesorería del Estado (SFA Michoacán).
 *
 * REGLAS DE ORO (no negociables):
 *  - Modula NO cobra, NO integra pasarelas, NO genera líneas de captura.
 *  - La orden de pago con línea de captura la emite la plataforma del Estado;
 *    aquí SOLO se almacena (la captura un admin/enlace) y se sirve.
 *  - 'pagado' SOLO se setea por conciliación/verificación de un admin.
 *  - Al alumno se le muestra únicamente el total ($145); el split 115/30 es interno.
 *
 * Montado en /api/pagos-examen con authRequired; cada handler valida el rol.
 */
import { Router } from 'express';
import { and, eq, desc, inArray, sql } from 'drizzle-orm';
import path from 'path';
import { createReadStream, existsSync } from 'fs';
import fsp from 'node:fs/promises';
import multer from 'multer';
import { db } from '../db';
import {
  pagosExamen,
  pagosExamenInscripciones,
  examenesInscripciones,
  estudiantes,
  gestores,
  modulos,
  convocatoriasEtapas,
  municipios,
  users,
} from '@workspace/db/schema';
import { authRequired } from '../middleware/auth';
import { nombreArchivoUtf8 } from '../utils/archivo';
import { assertTransicion, type PagoExamenEstado } from '../services/pagoExamen';
import { DIAS_ANTES_EXAMEN_VENCE_PAGO } from '../config/reglas';
import { STORAGE_ES_EFIMERO, guardarSubida, archivoStream, archivoExiste } from '../services/storage';
import { hoyEnMexico } from '../utils/fechas';
import { patronLike } from '../utils/like';
import {
  avisarOrdenPorEmitir,
  avisarComprobanteRecibido,
  avisarOrdenEmitida,
  avisarPagoVerificado,
  avisarPagoRechazado,
  avisarPagoVencido,
  avisarPagoCancelado,
} from '../utils/notificarPago';

// Mensaje claro cuando un archivo (orden/comprobante) figura en la BD pero su
// archivo físico ya no existe (almacenamiento efímero de Railway hasta migrar a S3).
const MSG_ARCHIVO_PERDIDO = STORAGE_ES_EFIMERO
  ? 'El archivo no está disponible: el almacenamiento es temporal y se reinició en el último despliegue. Vuelve a subirlo (migración a almacenamiento permanente pendiente).'
  : 'El archivo no está disponible.';

// Fecha del examen de una etapa + vencimiento del pago (regla: N días antes).
// Devuelve strings 'YYYY-MM-DD' o null si el pago no tiene etapa.
async function fechasDeEtapa(etapaId: number | null): Promise<{ fechaExamen: string | null; vencimientoSugerido: string | null }> {
  if (etapaId == null) return { fechaExamen: null, vencimientoSugerido: null };
  const [et] = await db
    .select({ examenSabado: convocatoriasEtapas.examenSabado })
    .from(convocatoriasEtapas)
    .where(eq(convocatoriasEtapas.id, etapaId))
    .limit(1);
  if (!et?.examenSabado) return { fechaExamen: null, vencimientoSugerido: null };
  const fechaExamen = String(et.examenSabado); // 'YYYY-MM-DD'
  const d = new Date(fechaExamen + 'T12:00:00');
  d.setDate(d.getDate() - DIAS_ANTES_EXAMEN_VENCE_PAGO);
  const vencimientoSugerido = d.toISOString().slice(0, 10);
  return { fechaExamen, vencimientoSugerido };
}

const router = Router();
router.use(authRequired);

// ── Almacenamiento de archivos (orden de pago + comprobante) ──────────────
const PAGOS_EXAMEN_DIR = process.env.STORAGE_DIR
  ? path.join(process.env.STORAGE_DIR, 'pagos-examen')
  : path.join(process.cwd(), 'storage', 'pagos-examen');

/**
 * Tipos aceptados como orden o comprobante de pago.
 *
 * Antes no había filtro alguno: se aceptaba cualquier archivo. Combinado con
 * que al servir se forzaba `inline` sin declarar `Content-Type`, un alumno o un
 * gestor podía subir como "comprobante" un HTML o un SVG con script, y ese
 * código se ejecutaba **en la sesión del administrador** que lo abría para
 * revisarlo. Desde ahí se podía aprobar pagos o leer el padrón.
 *
 * Se comprueba tanto el tipo declarado como la extensión: el tipo lo pone el
 * cliente y es falsificable, pero la extensión es la que decide con qué
 * `Content-Type` se sirve después, así que acotar ambas cierra el círculo.
 */
const MIMES_PAGO = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const EXTS_PAGO = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp']);

const upload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      await fsp.mkdir(PAGOS_EXAMEN_DIR, { recursive: true });
      cb(null, PAGOS_EXAMEN_DIR);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '';
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (MIMES_PAGO.has(file.mimetype) && EXTS_PAGO.has(ext)) {
      cb(null, true);
      return;
    }
    cb(new Error('Sólo se aceptan archivos PDF, JPG, PNG o WEBP.'));
  },
});

/**
 * Sirve un archivo de pago declarando su tipo real y forzando la descarga de
 * todo lo que no sea imagen. Mismo criterio que `routes/pagos.ts`.
 *
 * La clave es no dejar que el navegador adivine: sin `Content-Type` explícito,
 * `inline` invita a interpretar el archivo como documento.
 */
function servirArchivoPago(res: import('express').Response, ref: string, nombre: string) {
  const ext = path.extname(ref).toLowerCase();
  const mime =
    ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
    : ext === '.png' ? 'image/png'
    : ext === '.webp' ? 'image/webp'
    : 'application/pdf';
  const esImagen = mime.startsWith('image/');
  const seguro = nombre.replace(/[^a-zA-Z0-9._-]/g, '_');
  res.setHeader('Content-Type', mime);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', `${esImagen ? 'inline' : 'attachment'}; filename="${seguro}"`);
  return archivoStream(ref).pipe(res);
}

const esAdmin = (rol?: string) => rol === 'admin';

// Folio legible de la ficha de pago: FP-AAAA-000123
//
// El año sale de la fecha real en Michoacán, no de una constante: estuvo
// quemado a 2026 y en enero habría seguido emitiendo fichas FP-2026-*
// indefinidamente, sin que nada fallara ni avisara. El consecutivo es el id,
// que es global, así que el cambio de año no reinicia ni colisiona.
function folioFicha(id: number) {
  const anio = hoyEnMexico().slice(0, 4);
  return `FP-${anio}-${String(id).padStart(6, '0')}`;
}

/**
 * Gestor al que se le atribuye una ficha, congelado en el momento del pago.
 *
 * Antes solo se guardaba si la ficha la pedía un gestor; en el alta por admin
 * o por el propio alumno quedaba en NULL, y para saber "de quién era" había
 * que hacer un join contra `estudiantes.gestor_id`, que devuelve el gestor
 * ACTUAL. Consecuencia: si un alumno cambia de gestor, el histórico se
 * reescribe solo y la productividad pasada de cada gestor cambia sin que nadie
 * haya tocado nada. Guardarlo aquí lo vuelve un hecho, no una inferencia.
 *
 * Para fichas grupales (sin titular único) se deja NULL: no hay un gestor
 * al que atribuirla sin mentir.
 */
async function gestorParaFicha(
  rol: string,
  userId: number,
  estudianteId: number | null
): Promise<number | null> {
  if (rol === 'gestor') return userId;
  if (estudianteId == null) return null;
  const [alu] = await db
    .select({ gestorId: estudiantes.gestorId })
    .from(estudiantes)
    .where(eq(estudiantes.userId, estudianteId))
    .limit(1);
  return alu?.gestorId ?? null;
}

// ¿El usuario (alumno / gestor / admin) tiene acceso a este pago?
// - admin: siempre.
// - alumno: es el titular, o alguno de SUS exámenes está en la ficha (grupal).
// - gestor: solicitó la ficha, o algún examen es de uno de SUS alumnos.
async function tieneAcceso(
  pago: typeof pagosExamen.$inferSelect,
  user: { userId: number; rol: string }
): Promise<boolean> {
  if (esAdmin(user.rol)) return true;
  if (user.rol === 'estudiante') {
    if (pago.estudianteId === user.userId) return true;
    const rows = await db
      .select({ id: pagosExamenInscripciones.id })
      .from(pagosExamenInscripciones)
      .innerJoin(examenesInscripciones, eq(pagosExamenInscripciones.examenInscripcionId, examenesInscripciones.id))
      .where(and(eq(pagosExamenInscripciones.pagoExamenId, pago.id), eq(examenesInscripciones.estudianteId, user.userId)))
      .limit(1);
    return rows.length > 0;
  }
  if (user.rol === 'gestor') {
    if (pago.gestorId === user.userId) return true;
    const rows = await db
      .select({ id: pagosExamenInscripciones.id })
      .from(pagosExamenInscripciones)
      .innerJoin(examenesInscripciones, eq(pagosExamenInscripciones.examenInscripcionId, examenesInscripciones.id))
      .innerJoin(estudiantes, eq(examenesInscripciones.estudianteId, estudiantes.userId))
      .where(and(eq(pagosExamenInscripciones.pagoExamenId, pago.id), eq(estudiantes.gestorId, user.userId)))
      .limit(1);
    return rows.length > 0;
  }
  return false;
}

// ── Helper: arma el detalle de un pago con sus exámenes cubiertos ─────────
async function detallePago(pagoId: number) {
  const [pago] = await db.select().from(pagosExamen).where(eq(pagosExamen.id, pagoId)).limit(1);
  if (!pago) return null;

  const items = await db
    .select({
      inscripcionId: examenesInscripciones.id,
      folio: examenesInscripciones.folio,
      moduloNumero: modulos.numero,
      moduloNombre: modulos.nombre,
      estudianteId: examenesInscripciones.estudianteId,
      alumno: estudiantes.nombreCompleto,
      matricula: estudiantes.matriculaOficialDGB,
    })
    .from(pagosExamenInscripciones)
    .innerJoin(
      examenesInscripciones,
      eq(pagosExamenInscripciones.examenInscripcionId, examenesInscripciones.id)
    )
    .innerJoin(modulos, eq(examenesInscripciones.moduloId, modulos.id))
    .innerJoin(estudiantes, eq(examenesInscripciones.estudianteId, estudiantes.userId))
    .where(eq(pagosExamenInscripciones.pagoExamenId, pagoId));

  return { pago, items };
}

/** Vista pública para el ALUMNO — nunca expone el split 115/30. */
function vistaAlumno(pago: typeof pagosExamen.$inferSelect, items: any[]) {
  return {
    id: pago.id,
    folio: pago.folio,
    estado: pago.estado,
    concepto: pago.concepto,
    cantidadExamenes: pago.cantidadExamenes,
    montoTotal: Number(pago.montoTotal),
    referencia: pago.referencia,
    metodoPago: pago.metodoPago,
    lineaCaptura: pago.lineaCaptura,
    tieneOrden: !!pago.ordenPagoPath,
    linkPago: pago.linkPago,
    fechaEmision: pago.fechaEmision,
    fechaVencimiento: pago.fechaVencimiento,
    fechaPago: pago.fechaPago,
    tieneComprobante: !!pago.comprobantePath,
    motivoRechazo: pago.motivoRechazo,
    examenes: items,
  };
}

/** Vista para ADMIN — incluye el split interno. */
function vistaAdmin(pago: typeof pagosExamen.$inferSelect, items: any[]) {
  return {
    ...vistaAlumno(pago, items),
    estudianteId: pago.estudianteId,
    etapaId: pago.etapaId,
    montoIemsys: Number(pago.montoIemsys),
    montoSynapsis: Number(pago.montoSynapsis),
    notas: pago.notas,
    verificadoPorUserId: pago.verificadoPorUserId,
    verificadoEn: pago.verificadoEn,
    createdAt: pago.createdAt,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ALUMNO
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/pagos-examen/mios — órdenes de pago del alumno autenticado
router.get('/mios', async (req, res) => {
  if (req.user!.rol !== 'estudiante') return res.status(403).json({ error: 'Solo alumnos' });
  try {
    const userId = req.user!.userId;
    // Fichas donde el alumno es titular (individual) O aparece por el puente (grupal)
    const viaBridge = await db
      .selectDistinct({ id: pagosExamenInscripciones.pagoExamenId })
      .from(pagosExamenInscripciones)
      .innerJoin(examenesInscripciones, eq(pagosExamenInscripciones.examenInscripcionId, examenesInscripciones.id))
      .where(eq(examenesInscripciones.estudianteId, userId));
    const ids = new Set<number>(viaBridge.map((r) => r.id));
    const propias = await db.select().from(pagosExamen).where(eq(pagosExamen.estudianteId, userId));
    propias.forEach((p) => ids.add(p.id));

    const filas = ids.size
      ? await db.select().from(pagosExamen).where(inArray(pagosExamen.id, [...ids])).orderBy(desc(pagosExamen.createdAt))
      : [];

    const out = [];
    for (const p of filas) {
      const det = await detallePago(p.id);
      out.push(vistaAlumno(p, det?.items ?? []));
    }
    return res.json({ pagos: out });
  } catch {
    return res.status(500).json({ error: 'Error al obtener tus órdenes de pago' });
  }
});

// GET /api/pagos-examen/:id/orden — descarga la orden de pago (PDF del Estado)
router.get('/:id/orden', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [p] = await db.select().from(pagosExamen).where(eq(pagosExamen.id, id)).limit(1);
    if (!p) return res.status(404).json({ error: 'No existe' });
    if (!(await tieneAcceso(p, req.user!))) {
      return res.status(403).json({ error: 'Sin permiso' });
    }
    if (!p.ordenPagoPath) {
      return res.status(404).json({ error: 'Orden de pago aún no disponible' });
    }
    if (!(await archivoExiste(p.ordenPagoPath))) {
      return res.status(404).json({ error: MSG_ARCHIVO_PERDIDO });
    }
    return servirArchivoPago(res, p.ordenPagoPath, p.ordenPagoNombre ?? 'orden-de-pago.pdf');
  } catch {
    return res.status(500).json({ error: 'Error al descargar la orden' });
  }
});

// POST /api/pagos-examen/:id/comprobante — alumno o gestor sube comprobante + método
function subirComprobanteMw(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) {
  upload.single('comprobante')(req, res, (err: unknown) => {
    if (err) {
      const code = (err as { code?: string }).code;
      const msg = code === 'LIMIT_FILE_SIZE'
        ? 'El comprobante supera el máximo de 10 MB. Sube un archivo más ligero.'
        : 'No se pudo procesar el archivo del comprobante.';
      res.status(400).json({ error: msg });
      return;
    }
    next();
  });
}

router.post('/:id/comprobante', subirComprobanteMw, async (req, res) => {
  if (req.user!.rol !== 'estudiante' && req.user!.rol !== 'gestor') {
    return res.status(403).json({ error: 'Solo alumno o gestor' });
  }
  try {
    const id = Number(req.params.id);
    const [p] = await db.select().from(pagosExamen).where(eq(pagosExamen.id, id)).limit(1);
    if (!p || !(await tieneAcceso(p, req.user!))) return res.status(404).json({ error: 'No existe' });
    if (!req.file) return res.status(400).json({ error: 'Falta el archivo' });

    // CANDADO ESTRICTO DE PAGO: el comprobante solo se acepta DENTRO de la ventana
    // de solicitud de la etapa. Después del cierre (ej. el día 18 si cerró el 17)
    // ya no se puede pagar, igual que en SIOSAD.
    if (p.etapaId != null) {
      const [et] = await db
        .select({ clave: convocatoriasEtapas.clave, si: convocatoriasEtapas.solicitudInicio, sf: convocatoriasEtapas.solicitudFin })
        .from(convocatoriasEtapas)
        .where(eq(convocatoriasEtapas.id, p.etapaId));
      if (et) {
        const hoy = hoyEnMexico();
        const fmt = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
        if (et.si && hoy < String(et.si)) {
          return res.status(400).json({ error: `La ventana de solicitud de la etapa ${et.clave} aún no abre (abre el ${fmt(String(et.si))}).` });
        }
        if (et.sf && String(et.sf) < hoy) {
          return res.status(400).json({ error: `El plazo para pagar la etapa ${et.clave} venció el ${fmt(String(et.sf))}. Ya no se puede subir comprobante.` });
        }
      }
    }

    const { metodoPago } = req.body as { metodoPago?: string };

    try {
      assertTransicion(p.estado as PagoExamenEstado, 'en_revision');
    } catch {
      return res.status(409).json({ error: 'La orden no admite comprobante en su estado actual' });
    }

    const refComprobante = await guardarSubida(req.file, 'pagos-examen');
    await db
      .update(pagosExamen)
      .set({
        comprobantePath: refComprobante,
        comprobanteNombre: nombreArchivoUtf8(req.file.originalname),
        metodoPago: metodoPago ?? p.metodoPago,
        estado: 'en_revision',
        motivoRechazo: null,
        updatedAt: new Date(),
      })
      .where(eq(pagosExamen.id, id));

    await avisarComprobanteRecibido(p);

    return res.json({ ok: true });
  } catch (e) {
    console.error('[pagos-examen/comprobante] error:', e);
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Error al subir el comprobante' });
  }
});

// GET /api/pagos-examen/:id/comprobante — ver comprobante (dueño o admin)
router.get('/:id/comprobante', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [p] = await db.select().from(pagosExamen).where(eq(pagosExamen.id, id)).limit(1);
    if (!p) return res.status(404).json({ error: 'No existe' });
    if (!(await tieneAcceso(p, req.user!))) {
      return res.status(403).json({ error: 'Sin permiso' });
    }
    if (!p.comprobantePath) {
      return res.status(404).json({ error: 'Sin comprobante' });
    }
    if (!(await archivoExiste(p.comprobantePath))) {
      return res.status(404).json({ error: MSG_ARCHIVO_PERDIDO });
    }
    return servirArchivoPago(res, p.comprobantePath, p.comprobanteNombre ?? 'comprobante');
  } catch {
    return res.status(500).json({ error: 'Error al descargar el comprobante' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GESTOR / ALUMNO — solicitud de ficha
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/pagos-examen/gestor-candidatos — exámenes de MIS alumnos sin ficha activa
router.get('/gestor-candidatos', async (req, res) => {
  if (req.user!.rol !== 'gestor') return res.status(403).json({ error: 'Solo gestor' });
  try {
    const gestorId = req.user!.userId;
    const rows = await db.execute<{
      id: number; folio: string; estudiante_id: number; alumno: string;
      modulo_id: number; modulo_numero: number; modulo_nombre: string;
    }>(sql`
      SELECT ei.id, ei.folio, ei.estudiante_id, e.nombre_completo AS alumno,
             m.id AS modulo_id, m.numero AS modulo_numero, m.nombre AS modulo_nombre
      FROM examenes_inscripciones ei
      JOIN estudiantes e ON e.user_id = ei.estudiante_id
      JOIN modulos m ON m.id = ei.modulo_id
      WHERE e.gestor_id = ${gestorId}
        AND ei.estado = 'inscrito'
        AND NOT EXISTS (
          SELECT 1 FROM pagos_examen_inscripciones pei
          JOIN pagos_examen pe ON pe.id = pei.pago_examen_id
          WHERE pei.examen_inscripcion_id = ei.id AND pe.estado NOT IN ('cancelado','vencido')
        )
      ORDER BY m.numero, e.nombre_completo
    `);
    const [perm] = await db
      .select({ ind: gestores.pagoIndividualHabilitado, gru: gestores.pagoGrupalHabilitado })
      .from(gestores)
      .where(eq(gestores.userId, gestorId));
    return res.json({
      costoExamen: 145,
      permisos: { individual: perm?.ind ?? true, grupal: perm?.gru ?? true },
      examenes: rows.rows.map((r) => ({
        id: Number(r.id), folio: r.folio, estudianteId: Number(r.estudiante_id), alumno: r.alumno,
        moduloId: Number(r.modulo_id), moduloNumero: Number(r.modulo_numero), moduloNombre: r.modulo_nombre,
      })),
    });
  } catch {
    return res.status(500).json({ error: 'Error al obtener exámenes' });
  }
});

// POST /api/pagos-examen/solicitar — gestor o alumno solicita una ficha (pendiente_emision)
router.post('/solicitar', async (req, res) => {
  const rol = req.user!.rol;
  const userId = req.user!.userId;
  if (rol !== 'gestor' && rol !== 'estudiante') return res.status(403).json({ error: 'Sin permiso' });
  try {
    const { examenInscripcionIds } = req.body as { examenInscripcionIds: number[] };
    const ids = Array.isArray(examenInscripcionIds) ? [...new Set(examenInscripcionIds)] : [];
    if (ids.length === 0) return res.status(400).json({ error: 'Selecciona al menos un examen' });

    // Traer exámenes con su alumno y validar pertenencia + que no estén ya cubiertos
    const inscs = await db
      .select({
        id: examenesInscripciones.id,
        estudianteId: examenesInscripciones.estudianteId,
        etapaId: examenesInscripciones.etapaId,
        gestorId: estudiantes.gestorId,
        estado: examenesInscripciones.estado,
      })
      .from(examenesInscripciones)
      .innerJoin(estudiantes, eq(examenesInscripciones.estudianteId, estudiantes.userId))
      .where(inArray(examenesInscripciones.id, ids));

    if (inscs.length !== ids.length) return res.status(409).json({ error: 'Algún examen no es válido' });
    if (rol === 'estudiante' && inscs.some((i) => i.estudianteId !== userId)) {
      return res.status(403).json({ error: 'Solo tus exámenes' });
    }
    if (rol === 'gestor' && inscs.some((i) => i.gestorId !== userId)) {
      return res.status(403).json({ error: 'Solo exámenes de tus alumnos' });
    }

    // ¿ya cubiertos por una ficha activa?
    const cubiertos = await db
      .select({ id: pagosExamenInscripciones.examenInscripcionId })
      .from(pagosExamenInscripciones)
      .innerJoin(pagosExamen, eq(pagosExamenInscripciones.pagoExamenId, pagosExamen.id))
      .where(and(
        inArray(pagosExamenInscripciones.examenInscripcionId, ids),
        inArray(pagosExamen.estado, ['pendiente_emision', 'emitida', 'en_revision', 'pagado'])
      ));
    if (cubiertos.length > 0) {
      return res.status(409).json({ error: 'Algún examen ya está en una ficha. Actualiza la lista.' });
    }

    const estudianteIds = new Set(inscs.map((i) => i.estudianteId));
    const grupal = estudianteIds.size > 1;
    const estudianteId = grupal ? null : inscs[0].estudianteId;

    // Permisos de pago por centro: la administración puede habilitar/inhabilitar
    // el pago individual y/o grupal de cada gestor. La UI ya oculta lo no
    // permitido, pero esta es la barrera autoritativa (nadie la salta por API).
    if (rol === 'gestor') {
      const [perm] = await db
        .select({ ind: gestores.pagoIndividualHabilitado, gru: gestores.pagoGrupalHabilitado })
        .from(gestores)
        .where(eq(gestores.userId, userId));
      if (perm && grupal && !perm.gru) {
        return res.status(403).json({ error: 'La coordinación no tiene habilitado el pago grupal para tu centro.' });
      }
      if (perm && !grupal && !perm.ind) {
        return res.status(403).json({ error: 'La coordinación no tiene habilitado el pago individual para tu centro.' });
      }
    }
    const etapaId = inscs[0].etapaId ?? null;
    const cantidad = ids.length;

    // CANDADO ESTRICTO: solo se solicita ficha DENTRO de la ventana de solicitud.
    if (etapaId != null) {
      const [et] = await db
        .select({ clave: convocatoriasEtapas.clave, si: convocatoriasEtapas.solicitudInicio, sf: convocatoriasEtapas.solicitudFin })
        .from(convocatoriasEtapas)
        .where(eq(convocatoriasEtapas.id, etapaId));
      if (et) {
        const hoy = hoyEnMexico();
        const fmt = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
        if (et.si && hoy < String(et.si)) {
          return res.status(400).json({ error: `La ventana de solicitud de la etapa ${et.clave} aún no abre (abre el ${fmt(String(et.si))}).` });
        }
        if (et.sf && String(et.sf) < hoy) {
          return res.status(400).json({ error: `El plazo de solicitud/pago de la etapa ${et.clave} venció el ${fmt(String(et.sf))}. Ya no se pueden solicitar fichas.` });
        }
      }
    }

    let referencia: string | null = null;
    if (!grupal) {
      const [alu] = await db
        .select({ matricula: estudiantes.matriculaOficialDGB, curp: estudiantes.curp })
        .from(estudiantes).where(eq(estudiantes.userId, estudianteId!)).limit(1);
      referencia = alu?.matricula || alu?.curp || null;
    }

    const gestorAtribuido = await gestorParaFicha(rol, userId, estudianteId ?? null);

    const [nuevo] = await db.insert(pagosExamen).values({
      estudianteId,
      etapaId,
      gestorId: gestorAtribuido,
      solicitadoPorUserId: userId,
      concepto: 'derecho_examen',
      cantidadExamenes: cantidad,
      montoTotal: (cantidad * 145).toFixed(2),
      montoIemsys: (cantidad * 115).toFixed(2),
      montoSynapsis: (cantidad * 30).toFixed(2),
      referencia,
      estado: 'pendiente_emision',
    }).returning({ id: pagosExamen.id });

    const folio = folioFicha(nuevo.id);
    await db.update(pagosExamen).set({ folio, referencia: referencia ?? folio }).where(eq(pagosExamen.id, nuevo.id));
    await db.insert(pagosExamenInscripciones).values(
      ids.map((iid) => ({ pagoExamenId: nuevo.id, examenInscripcionId: iid }))
    );

    // La ficha nace esperando que la coordinación capture la línea de captura:
    // sin este aviso, nadie en administración sabía que había trabajo pendiente.
    const [ficha] = await db.select().from(pagosExamen).where(eq(pagosExamen.id, nuevo.id)).limit(1);
    if (ficha) await avisarOrdenPorEmitir(ficha);

    return res.json({ id: nuevo.id, folio });
  } catch {
    return res.status(500).json({ error: 'Error al solicitar la ficha' });
  }
});

// GET /api/pagos-examen/gestor-mios — fichas solicitadas por el gestor
router.get('/gestor-mios', async (req, res) => {
  if (req.user!.rol !== 'gestor') return res.status(403).json({ error: 'Solo gestor' });
  try {
    const gestorId = req.user!.userId;
    const filas = await db
      .select().from(pagosExamen)
      .where(eq(pagosExamen.gestorId, gestorId))
      .orderBy(desc(pagosExamen.createdAt));
    const out = [];
    for (const p of filas) {
      const det = await detallePago(p.id);
      out.push(vistaAlumno(p, det?.items ?? []));
    }
    return res.json({ pagos: out });
  } catch {
    return res.status(500).json({ error: 'Error al obtener tus fichas' });
  }
});

// GET /api/pagos-examen/gestor-detalle/:id — detalle de una ficha del gestor
router.get('/gestor-detalle/:id', async (req, res) => {
  if (req.user!.rol !== 'gestor') return res.status(403).json({ error: 'Solo gestor' });
  try {
    const det = await detallePago(Number(req.params.id));
    if (!det || !(await tieneAcceso(det.pago, req.user!))) return res.status(404).json({ error: 'No existe' });
    // Enriquecer los ítems con el alumno (para vista grupal)
    const items = [];
    for (const it of det.items) {
      const [alu] = await db
        .select({ nombre: estudiantes.nombreCompleto })
        .from(examenesInscripciones)
        .innerJoin(estudiantes, eq(examenesInscripciones.estudianteId, estudiantes.userId))
        .where(eq(examenesInscripciones.id, it.inscripcionId)).limit(1);
      items.push({ ...it, alumno: alu?.nombre ?? '' });
    }
    return res.json(vistaAlumno(det.pago, items));
  } catch {
    return res.status(500).json({ error: 'Error al obtener la ficha' });
  }
});

// Recalcula cantidad/montos/estudianteId de una ficha según sus exámenes.
// Si estaba 'emitida', vuelve a 'pendiente_emision' e invalida la orden
// (requiere re-validación/re-emisión por la coordinación).
export async function recalcularFicha(pagoId: number, estadoActual: PagoExamenEstado) {
  const items = await db
    .select({ estudianteId: examenesInscripciones.estudianteId })
    .from(pagosExamenInscripciones)
    .innerJoin(examenesInscripciones, eq(pagosExamenInscripciones.examenInscripcionId, examenesInscripciones.id))
    .where(eq(pagosExamenInscripciones.pagoExamenId, pagoId));

  if (items.length === 0) {
    await db.update(pagosExamen).set({ estado: 'cancelado', cantidadExamenes: 0, updatedAt: new Date() }).where(eq(pagosExamen.id, pagoId));
    return;
  }
  const estudianteIds = new Set(items.map((i) => i.estudianteId));
  const cantidad = items.length;
  const invalidar = estadoActual === 'emitida';
  await db.update(pagosExamen).set({
    cantidadExamenes: cantidad,
    montoTotal: (cantidad * 145).toFixed(2),
    montoIemsys: (cantidad * 115).toFixed(2),
    montoSynapsis: (cantidad * 30).toFixed(2),
    estudianteId: estudianteIds.size === 1 ? [...estudianteIds][0] : null,
    ...(invalidar ? {
      estado: 'pendiente_emision' as const,
      lineaCaptura: null, ordenPagoPath: null, ordenPagoNombre: null,
      linkPago: null, fechaEmision: null, fechaVencimiento: null, motivoRechazo: null,
    } : {}),
    updatedAt: new Date(),
  }).where(eq(pagosExamen.id, pagoId));
}

// POST /api/pagos-examen/:id/cancelar-mia — el solicitante cancela su ficha
router.post('/:id/cancelar-mia', async (req, res) => {
  const rol = req.user!.rol;
  if (rol !== 'gestor' && rol !== 'estudiante') return res.status(403).json({ error: 'Sin permiso' });
  try {
    const id = Number(req.params.id);
    const [p] = await db.select().from(pagosExamen).where(eq(pagosExamen.id, id)).limit(1);
    if (!p || !(await tieneAcceso(p, req.user!))) return res.status(404).json({ error: 'No existe' });
    if (!['pendiente_emision', 'emitida'].includes(p.estado)) {
      return res.status(409).json({ error: 'Solo puedes cancelar antes de pagar. Si ya subiste comprobante, contacta a la coordinación.' });
    }
    await db.update(pagosExamen).set({ estado: 'cancelado', updatedAt: new Date() }).where(eq(pagosExamen.id, id));
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Error al cancelar' });
  }
});

// POST /api/pagos-examen/:id/quitar-examen — el solicitante quita un examen (editar)
router.post('/:id/quitar-examen', async (req, res) => {
  const rol = req.user!.rol;
  if (rol !== 'gestor' && rol !== 'estudiante') return res.status(403).json({ error: 'Sin permiso' });
  try {
    const id = Number(req.params.id);
    const { examenInscripcionId } = req.body as { examenInscripcionId: number };
    const [p] = await db.select().from(pagosExamen).where(eq(pagosExamen.id, id)).limit(1);
    if (!p || !(await tieneAcceso(p, req.user!))) return res.status(404).json({ error: 'No existe' });
    if (!['pendiente_emision', 'emitida'].includes(p.estado)) {
      return res.status(409).json({ error: 'No se puede editar la ficha en su estado actual.' });
    }
    await db.delete(pagosExamenInscripciones).where(and(
      eq(pagosExamenInscripciones.pagoExamenId, id),
      eq(pagosExamenInscripciones.examenInscripcionId, examenInscripcionId)
    ));
    await recalcularFicha(id, p.estado as PagoExamenEstado);
    return res.json({ ok: true, reemitir: p.estado === 'emitida' });
  } catch {
    return res.status(500).json({ error: 'Error al editar la ficha' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN / ENLACE DE TESORERÍA
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/pagos-examen — listado admin con filtros (estado, gestorId, etapaId, q)
router.get('/', async (req, res) => {
  if (!esAdmin(req.user!.rol)) return res.status(403).json({ error: 'Solo administración' });
  try {
    const estado = typeof req.query.estado === 'string' && req.query.estado ? req.query.estado : null;
    const gestorId = req.query.gestorId ? Number(req.query.gestorId) : null;
    const etapaId = req.query.etapaId ? Number(req.query.etapaId) : null;
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    const cond = [] as ReturnType<typeof eq>[];
    if (estado) cond.push(eq(pagosExamen.estado, estado as PagoExamenEstado));
    if (gestorId) cond.push(eq(pagosExamen.gestorId, gestorId));
    if (etapaId) cond.push(eq(pagosExamen.etapaId, etapaId));
    if (q) {
      cond.push(sql`(
        ${estudiantes.nombreCompleto} ILIKE ${patronLike(q)} OR
        ${estudiantes.matriculaOficialDGB} ILIKE ${patronLike(q)} OR
        ${pagosExamen.folio} ILIKE ${patronLike(q)} OR
        ${gestores.nombreCompleto} ILIKE ${patronLike(q)}
      )` as any);
    }

    const filas = await db
      .select({
        pago: pagosExamen,
        alumno: estudiantes.nombreCompleto,
        matricula: estudiantes.matriculaOficialDGB,
        curp: estudiantes.curp,
        gestor: gestores.nombreCompleto,
        etapa: convocatoriasEtapas.clave,
      })
      .from(pagosExamen)
      .leftJoin(estudiantes, eq(pagosExamen.estudianteId, estudiantes.userId))
      .leftJoin(gestores, eq(pagosExamen.gestorId, gestores.userId))
      .leftJoin(convocatoriasEtapas, eq(pagosExamen.etapaId, convocatoriasEtapas.id))
      .where(cond.length ? and(...cond) : undefined)
      .orderBy(desc(pagosExamen.createdAt));

    return res.json({
      pagos: filas.map((f) => ({
        ...vistaAdmin(f.pago, []),
        alumno: f.alumno ?? (f.pago.cantidadExamenes > 1 ? 'Ficha grupal' : '—'),
        matricula: f.matricula,
        curp: f.curp,
        gestor: f.gestor ?? null,
        solicitante: f.gestor ? `Gestor · ${f.gestor}` : 'Alumno',
        etapaClave: f.etapa ?? null,
      })),
    });
  } catch {
    return res.status(500).json({ error: 'Error al listar pagos' });
  }
});

// GET /api/pagos-examen/:id/detalle — detalle admin con exámenes cubiertos
router.get('/:id/detalle', async (req, res) => {
  if (!esAdmin(req.user!.rol)) return res.status(403).json({ error: 'Solo administración' });
  try {
    const det = await detallePago(Number(req.params.id));
    if (!det) return res.status(404).json({ error: 'No existe' });
    let alu: { nombre: string; matricula: string | null; curp: string | null } | undefined;
    if (det.pago.estudianteId != null) {
      [alu] = await db
        .select({ nombre: estudiantes.nombreCompleto, matricula: estudiantes.matriculaOficialDGB, curp: estudiantes.curp })
        .from(estudiantes)
        .where(eq(estudiantes.userId, det.pago.estudianteId))
        .limit(1);
    }
    const { fechaExamen, vencimientoSugerido } = await fechasDeEtapa(det.pago.etapaId);
    return res.json({ ...vistaAdmin(det.pago, det.items), alumno: alu?.nombre ?? (det.pago.cantidadExamenes > 1 ? 'Ficha grupal' : '—'), matricula: alu?.matricula, curp: alu?.curp, fechaExamen, vencimientoSugerido });
  } catch {
    return res.status(500).json({ error: 'Error al obtener detalle' });
  }
});

// GET /api/pagos-examen/candidatos/:estudianteId — exámenes del alumno sin orden de pago
router.get('/candidatos/:estudianteId', async (req, res) => {
  if (!esAdmin(req.user!.rol)) return res.status(403).json({ error: 'Solo administración' });
  try {
    const estudianteId = Number(req.params.estudianteId);
    // Inscripciones cubiertas por una orden vigente (no cancelada/vencida)
    const cubiertas = await db
      .select({ id: pagosExamenInscripciones.examenInscripcionId })
      .from(pagosExamenInscripciones)
      .innerJoin(pagosExamen, eq(pagosExamenInscripciones.pagoExamenId, pagosExamen.id))
      .where(
        and(
          eq(pagosExamen.estudianteId, estudianteId),
          inArray(pagosExamen.estado, ['pendiente_emision', 'emitida', 'en_revision', 'pagado'])
        )
      );
    const cubiertasSet = new Set(cubiertas.map((c) => c.id));

    const inscs = await db
      .select({
        id: examenesInscripciones.id,
        folio: examenesInscripciones.folio,
        etapaId: examenesInscripciones.etapaId,
        moduloNumero: modulos.numero,
        moduloNombre: modulos.nombre,
      })
      .from(examenesInscripciones)
      .innerJoin(modulos, eq(examenesInscripciones.moduloId, modulos.id))
      .where(eq(examenesInscripciones.estudianteId, estudianteId));

    return res.json({ examenes: inscs.filter((i) => !cubiertasSet.has(i.id)) });
  } catch {
    return res.status(500).json({ error: 'Error al obtener candidatos' });
  }
});

// POST /api/pagos-examen — crea una orden (pendiente_emision) para un alumno
router.post('/', async (req, res) => {
  if (!esAdmin(req.user!.rol)) return res.status(403).json({ error: 'Solo administración' });
  try {
    const { estudianteId, examenInscripcionIds } = req.body as {
      estudianteId: number;
      examenInscripcionIds: number[];
    };
    if (!estudianteId || !Array.isArray(examenInscripcionIds) || examenInscripcionIds.length === 0) {
      return res.status(400).json({ error: 'Faltan datos (alumno y exámenes)' });
    }

    const [alu] = await db
      .select({ matricula: estudiantes.matriculaOficialDGB, curp: estudiantes.curp })
      .from(estudiantes)
      .where(eq(estudiantes.userId, estudianteId))
      .limit(1);
    if (!alu) return res.status(404).json({ error: 'Alumno no existe' });

    // Etapa: la del primer examen
    const inscs = await db
      .select({ id: examenesInscripciones.id, etapaId: examenesInscripciones.etapaId })
      .from(examenesInscripciones)
      .where(inArray(examenesInscripciones.id, examenInscripcionIds));
    const etapaId = inscs[0]?.etapaId ?? null;

    const cantidad = examenInscripcionIds.length;
    const UNIT = 145;
    const total = (cantidad * UNIT).toFixed(2);
    const iemsys = (cantidad * 115).toFixed(2);
    const synapsis = (cantidad * 30).toFixed(2);
    const referencia = alu.matricula || alu.curp || null;

    const gestorAtribuido = await gestorParaFicha(
      req.user!.rol, req.user!.userId, estudianteId ?? null
    );

    const [nuevo] = await db
      .insert(pagosExamen)
      .values({
        estudianteId,
        etapaId,
        gestorId: gestorAtribuido,
        concepto: 'derecho_examen',
        cantidadExamenes: cantidad,
        montoTotal: total,
        montoIemsys: iemsys,
        montoSynapsis: synapsis,
        referencia,
        estado: 'pendiente_emision',
      })
      .returning({ id: pagosExamen.id });

    await db.update(pagosExamen).set({ folio: folioFicha(nuevo.id) }).where(eq(pagosExamen.id, nuevo.id));
    await db.insert(pagosExamenInscripciones).values(
      examenInscripcionIds.map((iid) => ({ pagoExamenId: nuevo.id, examenInscripcionId: iid }))
    );

    return res.json({ id: nuevo.id });
  } catch {
    return res.status(500).json({ error: 'Error al crear la orden' });
  }
});

// POST /api/pagos-examen/:id/emitir — carga línea de captura + orden PDF + vencimiento
router.post('/:id/emitir', upload.single('orden'), async (req, res) => {
  if (!esAdmin(req.user!.rol)) return res.status(403).json({ error: 'Solo administración' });
  try {
    const id = Number(req.params.id);
    const [p] = await db.select().from(pagosExamen).where(eq(pagosExamen.id, id)).limit(1);
    if (!p) return res.status(404).json({ error: 'No existe' });

    const { lineaCaptura, fechaVencimiento, linkPago } = req.body as {
      lineaCaptura?: string;
      fechaVencimiento?: string;
      linkPago?: string;
    };
    if (!lineaCaptura && !req.file && !linkPago) {
      return res.status(400).json({ error: 'Captura al menos la línea de captura o la orden de pago' });
    }

    // Se puede emitir desde pendiente_emision/vencido, y RE-emitir (actualizar)
    // una orden que ya está 'emitida' — en ese caso solo se actualizan los datos.
    const yaEmitida = p.estado === 'emitida';
    if (!yaEmitida) {
      try {
        assertTransicion(p.estado as PagoExamenEstado, 'emitida');
      } catch {
        return res.status(409).json({ error: `No se puede emitir desde el estado ${p.estado}` });
      }
    }

    // Regla: el pago vence una semana antes del examen. Si el admin no capturó
    // una fecha, se calcula automáticamente desde la etapa del examen.
    const { vencimientoSugerido } = await fechasDeEtapa(p.etapaId);
    const vencimientoFinal = fechaVencimiento || p.fechaVencimiento || vencimientoSugerido;

    const refOrden = req.file ? await guardarSubida(req.file, 'pagos-examen') : null;
    await db
      .update(pagosExamen)
      .set({
        lineaCaptura: lineaCaptura ?? p.lineaCaptura,
        linkPago: linkPago ?? p.linkPago,
        fechaVencimiento: vencimientoFinal,
        ordenPagoPath: refOrden ?? p.ordenPagoPath,
        ordenPagoNombre: req.file ? nombreArchivoUtf8(req.file.originalname) : p.ordenPagoNombre,
        fechaEmision: new Date(),
        estado: 'emitida',
        updatedAt: new Date(),
      })
      .where(eq(pagosExamen.id, id));

    // Avisar SOLO en la primera emisión: re-emitir corrige datos de una orden que
    // el alumno ya conocía, y repetir «ya puedes pagar» cada vez sería ruido.
    if (!yaEmitida) {
      const [actualizado] = await db.select().from(pagosExamen).where(eq(pagosExamen.id, id)).limit(1);
      if (actualizado) await avisarOrdenEmitida(actualizado);
    }

    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Error al emitir la orden' });
  }
});

// POST /api/pagos-examen/:id/conciliar — marca PAGADO (conciliación / verificación)
router.post('/:id/conciliar', async (req, res) => {
  if (!esAdmin(req.user!.rol)) return res.status(403).json({ error: 'Solo administración' });
  try {
    const id = Number(req.params.id);
    const [p] = await db.select().from(pagosExamen).where(eq(pagosExamen.id, id)).limit(1);
    if (!p) return res.status(404).json({ error: 'No existe' });

    // No se puede marcar pagado sin que el gestor/alumno haya subido comprobante.
    if (!p.comprobantePath) {
      return res.status(409).json({ error: 'No se puede marcar pagado sin comprobante. Espera a que el gestor o alumno lo suba.' });
    }

    try {
      assertTransicion(p.estado as PagoExamenEstado, 'pagado');
    } catch {
      return res.status(409).json({ error: `No se puede conciliar desde el estado ${p.estado}` });
    }

    const { fechaPago, notas } = req.body as { fechaPago?: string; notas?: string };
    await db
      .update(pagosExamen)
      .set({
        estado: 'pagado',
        fechaPago: fechaPago || new Date().toISOString().slice(0, 10),
        notas: notas ?? p.notas,
        verificadoPorUserId: req.user!.userId,
        verificadoEn: new Date(),
        motivoRechazo: null,
        updatedAt: new Date(),
      })
      .where(eq(pagosExamen.id, id));

    await avisarPagoVerificado(p);

    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Error al conciliar' });
  }
});

// POST /api/pagos-examen/:id/rechazar-comprobante — regresa a 'emitida'
router.post('/:id/rechazar-comprobante', async (req, res) => {
  if (!esAdmin(req.user!.rol)) return res.status(403).json({ error: 'Solo administración' });
  try {
    const id = Number(req.params.id);
    const [p] = await db.select().from(pagosExamen).where(eq(pagosExamen.id, id)).limit(1);
    if (!p) return res.status(404).json({ error: 'No existe' });

    try {
      assertTransicion(p.estado as PagoExamenEstado, 'emitida');
    } catch {
      return res.status(409).json({ error: `No se puede rechazar desde el estado ${p.estado}` });
    }

    const { motivo } = req.body as { motivo?: string };
    const motivoFinal = motivo || 'Comprobante no válido';
    await db
      .update(pagosExamen)
      .set({ estado: 'emitida', motivoRechazo: motivoFinal, updatedAt: new Date() })
      .where(eq(pagosExamen.id, id));

    // El motivo viaja en el aviso: si no, el alumno solo ve que algo falló y no
    // sabe qué corregir.
    await avisarPagoRechazado(p, motivoFinal);

    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Error al rechazar' });
  }
});

// POST /api/pagos-examen/:id/cancelar — anula la orden
router.post('/:id/cancelar', async (req, res) => {
  if (!esAdmin(req.user!.rol)) return res.status(403).json({ error: 'Solo administración' });
  try {
    const id = Number(req.params.id);
    const [p] = await db.select().from(pagosExamen).where(eq(pagosExamen.id, id)).limit(1);
    if (!p) return res.status(404).json({ error: 'No existe' });

    try {
      assertTransicion(p.estado as PagoExamenEstado, 'cancelado');
    } catch {
      return res.status(409).json({ error: `No se puede cancelar desde el estado ${p.estado}` });
    }

    await db
      .update(pagosExamen)
      .set({ estado: 'cancelado', updatedAt: new Date() })
      .where(eq(pagosExamen.id, id));

    await avisarPagoCancelado(p);

    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Error al cancelar' });
  }
});

// GET /api/pagos-examen/reportes/desglose — split interno 115/30 (solo admin)
router.get('/reportes/desglose', async (req, res) => {
  if (!esAdmin(req.user!.rol)) return res.status(403).json({ error: 'Solo administración' });
  try {
    // Solo pagos conciliados cuentan como ingreso enterado
    const totales = await db
      .select({
        pagos: sql<number>`count(*)::int`,
        examenes: sql<number>`coalesce(sum(${pagosExamen.cantidadExamenes}),0)::int`,
        total: sql<string>`coalesce(sum(${pagosExamen.montoTotal}),0)`,
        iemsys: sql<string>`coalesce(sum(${pagosExamen.montoIemsys}),0)`,
        synapsis: sql<string>`coalesce(sum(${pagosExamen.montoSynapsis}),0)`,
      })
      .from(pagosExamen)
      .where(eq(pagosExamen.estado, 'pagado'));

    const porMunicipio = await db
      .select({
        municipio: municipios.nombre,
        pagos: sql<number>`count(*)::int`,
        total: sql<string>`coalesce(sum(${pagosExamen.montoTotal}),0)`,
        iemsys: sql<string>`coalesce(sum(${pagosExamen.montoIemsys}),0)`,
        synapsis: sql<string>`coalesce(sum(${pagosExamen.montoSynapsis}),0)`,
      })
      .from(pagosExamen)
      .innerJoin(estudiantes, eq(pagosExamen.estudianteId, estudiantes.userId))
      .leftJoin(municipios, eq(estudiantes.municipioId, municipios.id))
      .where(eq(pagosExamen.estado, 'pagado'))
      .groupBy(municipios.nombre);

    const t = totales[0];
    return res.json({
      totales: {
        pagos: t?.pagos ?? 0,
        examenes: t?.examenes ?? 0,
        total: Number(t?.total ?? 0),
        iemsys: Number(t?.iemsys ?? 0),
        synapsis: Number(t?.synapsis ?? 0),
      },
      porMunicipio: porMunicipio.map((m) => ({
        municipio: m.municipio ?? 'Sin municipio',
        pagos: m.pagos,
        total: Number(m.total),
        iemsys: Number(m.iemsys),
        synapsis: Number(m.synapsis),
      })),
    });
  } catch {
    return res.status(500).json({ error: 'Error al generar el reporte' });
  }
});

// GET /api/pagos-examen/contabilidad — control interno por examen (admin)
// Cada examen (alumno + módulo) con su folio y estado: registrado / pagado / aprobado.
router.get('/contabilidad', async (req, res) => {
  if (!esAdmin(req.user!.rol)) return res.status(403).json({ error: 'Solo administración' });
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const rows = await db.execute<{
      id: number; folio: string; estado: string; calificacion: number | null;
      alumno: string; matricula: string | null;
      modulo_numero: number; modulo_nombre: string;
      pagado: boolean; en_proceso: boolean; ficha_folio: string | null;
    }>(sql`
      SELECT ei.id, ei.folio, ei.estado, ei.calificacion,
             e.nombre_completo AS alumno, e.matricula_oficial_dgb AS matricula,
             m.numero AS modulo_numero, m.nombre AS modulo_nombre,
             EXISTS (
               SELECT 1 FROM pagos_examen_inscripciones pei
               JOIN pagos_examen pe ON pe.id = pei.pago_examen_id
               WHERE pei.examen_inscripcion_id = ei.id AND pe.estado = 'pagado'
             ) AS pagado,
             EXISTS (
               SELECT 1 FROM pagos_examen_inscripciones pei
               JOIN pagos_examen pe ON pe.id = pei.pago_examen_id
               WHERE pei.examen_inscripcion_id = ei.id
                 AND pe.estado IN ('pendiente_emision','emitida','en_revision')
             ) AS en_proceso,
             (
               SELECT pe.folio FROM pagos_examen_inscripciones pei
               JOIN pagos_examen pe ON pe.id = pei.pago_examen_id
               WHERE pei.examen_inscripcion_id = ei.id AND pe.estado != 'cancelado'
               ORDER BY pe.id DESC LIMIT 1
             ) AS ficha_folio
      FROM examenes_inscripciones ei
      JOIN estudiantes e ON e.user_id = ei.estudiante_id
      JOIN modulos m ON m.id = ei.modulo_id
      ${q ? sql`WHERE (e.nombre_completo ILIKE ${patronLike(q)} OR ei.folio ILIKE ${patronLike(q)} OR e.matricula_oficial_dgb ILIKE ${patronLike(q)})` : sql``}
      ORDER BY e.nombre_completo, m.numero
      LIMIT 1000
    `);

    const examenes = rows.rows.map((r) => ({
      id: Number(r.id),
      folio: r.folio,
      alumno: r.alumno,
      matricula: r.matricula,
      moduloNumero: Number(r.modulo_numero),
      moduloNombre: r.modulo_nombre,
      registrado: true,
      pagado: r.pagado,
      enProcesoPago: r.en_proceso && !r.pagado,
      presentado: ['presentado', 'aprobado', 'reprobado'].includes(r.estado),
      aprobado: r.estado === 'aprobado',
      calificacion: r.calificacion,
      fichaFolio: r.ficha_folio,
    }));

    const resumen = {
      total: examenes.length,
      pagados: examenes.filter((e) => e.pagado).length,
      enProcesoPago: examenes.filter((e) => e.enProcesoPago).length,
      presentados: examenes.filter((e) => e.presentado).length,
      aprobados: examenes.filter((e) => e.aprobado).length,
    };

    return res.json({ examenes, resumen });
  } catch {
    return res.status(500).json({ error: 'Error al generar la contabilidad' });
  }
});

/**
 * Marca fichas como 'vencido'. Se ejecuta por cron (cada hora) y al arrancar.
 * Nunca toca órdenes ya pagadas o canceladas. Dos reglas:
 *  (a) orden emitida/en_revisión cuya fecha de vencimiento ya pasó;
 *  (b) ficha aún NO pagada (pendiente_emision/emitida) cuya VENTANA DE SOLICITUD
 *      de la etapa ya cerró (solicitud_fin) — no se pagó a tiempo, como SIOSAD.
 *      'en_revision' se excluye: ya tiene comprobante, lo verifica la administración.
 */
export async function vencerPagosExamen(): Promise<number> {
  // El día se toma en horario de Michoacán, NO en UTC: con `toISOString()` el
  // corte se adelantaba después de las 18:00 locales y podía vencer una orden
  // un día antes de tiempo, dejando al alumno fuera del examen sin deberla.
  const hoy = hoyEnMexico();
  const res = await db
    .update(pagosExamen)
    .set({ estado: 'vencido', updatedAt: new Date() })
    .where(
      and(
        inArray(pagosExamen.estado, ['emitida', 'en_revision']),
        sql`${pagosExamen.fechaVencimiento} is not null and ${pagosExamen.fechaVencimiento} < ${hoy}`
      )
    )
    .returning({ id: pagosExamen.id });

  // (b) Vencimiento por cierre de la ventana de solicitud de la etapa.
  const porVentana = await db.execute<{ id: number }>(sql`
    UPDATE pagos_examen pe SET estado = 'vencido', updated_at = now()
    FROM convocatorias_etapas ce
    WHERE pe.etapa_id = ce.id
      AND pe.estado IN ('pendiente_emision', 'emitida')
      AND ce.solicitud_fin < ${hoy}
    RETURNING pe.id`);

  // Avisar a cada afectado. Vencer en silencio era lo peor del ciclo: el alumno
  // se enteraba el día del examen, cuando ya no había nada que hacer.
  const vencidos = [...res.map((r) => r.id), ...porVentana.rows.map((r) => Number(r.id))];
  if (vencidos.length > 0) {
    const fichas = await db.select().from(pagosExamen).where(inArray(pagosExamen.id, vencidos));
    await Promise.all(fichas.map((f) => avisarPagoVencido(f)));
  }

  return res.length + porVentana.rows.length;
}

export default router;
