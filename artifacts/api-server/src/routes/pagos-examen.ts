/**
 * Pagos de examen — orden de pago vía Tesorería del Estado (SFA Michoacán).
 *
 * REGLAS DE ORO (no negociables):
 *  - EDUMICH NO cobra, NO integra pasarelas, NO genera líneas de captura.
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
  modulos,
  convocatoriasEtapas,
  municipios,
  users,
} from '@workspace/db/schema';
import { authRequired } from '../middleware/auth';
import { nombreArchivoUtf8 } from '../utils/archivo';
import { assertTransicion, type PagoExamenEstado } from '../services/pagoExamen';

const router = Router();
router.use(authRequired);

// ── Almacenamiento de archivos (orden de pago + comprobante) ──────────────
const PAGOS_EXAMEN_DIR = process.env.STORAGE_DIR
  ? path.join(process.env.STORAGE_DIR, 'pagos-examen')
  : path.join(process.cwd(), 'storage', 'pagos-examen');

const upload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      await fsp.mkdir(PAGOS_EXAMEN_DIR, { recursive: true });
      cb(null, PAGOS_EXAMEN_DIR);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '';
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const esAdmin = (rol?: string) => rol === 'admin';

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
    })
    .from(pagosExamenInscripciones)
    .innerJoin(
      examenesInscripciones,
      eq(pagosExamenInscripciones.examenInscripcionId, examenesInscripciones.id)
    )
    .innerJoin(modulos, eq(examenesInscripciones.moduloId, modulos.id))
    .where(eq(pagosExamenInscripciones.pagoExamenId, pagoId));

  return { pago, items };
}

/** Vista pública para el ALUMNO — nunca expone el split 115/30. */
function vistaAlumno(pago: typeof pagosExamen.$inferSelect, items: any[]) {
  return {
    id: pago.id,
    estado: pago.estado,
    concepto: pago.concepto,
    cantidadExamenes: pago.cantidadExamenes,
    montoTotal: Number(pago.montoTotal),
    referencia: pago.referencia,
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
    const filas = await db
      .select()
      .from(pagosExamen)
      .where(eq(pagosExamen.estudianteId, userId))
      .orderBy(desc(pagosExamen.createdAt));

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
    // El alumno solo puede ver la suya; el admin cualquiera
    if (!esAdmin(req.user!.rol) && p.estudianteId !== req.user!.userId) {
      return res.status(403).json({ error: 'Sin permiso' });
    }
    if (!p.ordenPagoPath || !existsSync(p.ordenPagoPath)) {
      return res.status(404).json({ error: 'Orden de pago aún no disponible' });
    }
    res.setHeader('Content-Disposition', `inline; filename="${p.ordenPagoNombre ?? 'orden-de-pago.pdf'}"`);
    return createReadStream(p.ordenPagoPath).pipe(res);
  } catch {
    return res.status(500).json({ error: 'Error al descargar la orden' });
  }
});

// POST /api/pagos-examen/:id/comprobante — el alumno sube comprobante (ruta interina)
router.post('/:id/comprobante', upload.single('comprobante'), async (req, res) => {
  if (req.user!.rol !== 'estudiante') return res.status(403).json({ error: 'Solo alumnos' });
  try {
    const id = Number(req.params.id);
    const [p] = await db.select().from(pagosExamen).where(eq(pagosExamen.id, id)).limit(1);
    if (!p || p.estudianteId !== req.user!.userId) return res.status(404).json({ error: 'No existe' });
    if (!req.file) return res.status(400).json({ error: 'Falta el archivo' });

    try {
      assertTransicion(p.estado as PagoExamenEstado, 'en_revision');
    } catch {
      return res.status(409).json({ error: 'La orden no admite comprobante en su estado actual' });
    }

    await db
      .update(pagosExamen)
      .set({
        comprobantePath: req.file.path,
        comprobanteNombre: nombreArchivoUtf8(req.file.originalname),
        estado: 'en_revision',
        motivoRechazo: null,
        updatedAt: new Date(),
      })
      .where(eq(pagosExamen.id, id));

    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Error al subir el comprobante' });
  }
});

// GET /api/pagos-examen/:id/comprobante — ver comprobante (dueño o admin)
router.get('/:id/comprobante', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [p] = await db.select().from(pagosExamen).where(eq(pagosExamen.id, id)).limit(1);
    if (!p) return res.status(404).json({ error: 'No existe' });
    if (!esAdmin(req.user!.rol) && p.estudianteId !== req.user!.userId) {
      return res.status(403).json({ error: 'Sin permiso' });
    }
    if (!p.comprobantePath || !existsSync(p.comprobantePath)) {
      return res.status(404).json({ error: 'Sin comprobante' });
    }
    res.setHeader('Content-Disposition', `inline; filename="${p.comprobanteNombre ?? 'comprobante'}"`);
    return createReadStream(p.comprobantePath).pipe(res);
  } catch {
    return res.status(500).json({ error: 'Error al descargar el comprobante' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN / ENLACE DE TESORERÍA
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/pagos-examen — listado admin (filtro opcional ?estado=)
router.get('/', async (req, res) => {
  if (!esAdmin(req.user!.rol)) return res.status(403).json({ error: 'Solo administración' });
  try {
    const estado = typeof req.query.estado === 'string' ? req.query.estado : null;
    const base = db
      .select({
        pago: pagosExamen,
        alumno: estudiantes.nombreCompleto,
        matricula: estudiantes.matriculaOficialDGB,
        curp: estudiantes.curp,
      })
      .from(pagosExamen)
      .innerJoin(estudiantes, eq(pagosExamen.estudianteId, estudiantes.userId))
      .orderBy(desc(pagosExamen.createdAt));

    const filas = estado
      ? await base.where(eq(pagosExamen.estado, estado as PagoExamenEstado))
      : await base;

    return res.json({
      pagos: filas.map((f) => ({
        ...vistaAdmin(f.pago, []),
        alumno: f.alumno,
        matricula: f.matricula,
        curp: f.curp,
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
    const [alu] = await db
      .select({ nombre: estudiantes.nombreCompleto, matricula: estudiantes.matriculaOficialDGB, curp: estudiantes.curp })
      .from(estudiantes)
      .where(eq(estudiantes.userId, det.pago.estudianteId))
      .limit(1);
    return res.json({ ...vistaAdmin(det.pago, det.items), alumno: alu?.nombre, matricula: alu?.matricula, curp: alu?.curp });
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

    const [nuevo] = await db
      .insert(pagosExamen)
      .values({
        estudianteId,
        etapaId,
        concepto: 'derecho_examen',
        cantidadExamenes: cantidad,
        montoTotal: total,
        montoIemsys: iemsys,
        montoSynapsis: synapsis,
        referencia,
        estado: 'pendiente_emision',
      })
      .returning({ id: pagosExamen.id });

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

    try {
      assertTransicion(p.estado as PagoExamenEstado, 'emitida');
    } catch {
      return res.status(409).json({ error: `No se puede emitir desde el estado ${p.estado}` });
    }

    await db
      .update(pagosExamen)
      .set({
        lineaCaptura: lineaCaptura ?? p.lineaCaptura,
        linkPago: linkPago ?? p.linkPago,
        fechaVencimiento: fechaVencimiento || p.fechaVencimiento,
        ordenPagoPath: req.file ? req.file.path : p.ordenPagoPath,
        ordenPagoNombre: req.file ? nombreArchivoUtf8(req.file.originalname) : p.ordenPagoNombre,
        fechaEmision: new Date(),
        estado: 'emitida',
        updatedAt: new Date(),
      })
      .where(eq(pagosExamen.id, id));

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

    try {
      assertTransicion(p.estado as PagoExamenEstado, 'pagado');
    } catch {
      return res.status(409).json({ error: `No se puede conciliar desde el estado ${p.estado}` });
    }

    const { fechaPago } = req.body as { fechaPago?: string };
    await db
      .update(pagosExamen)
      .set({
        estado: 'pagado',
        fechaPago: fechaPago || new Date().toISOString().slice(0, 10),
        verificadoPorUserId: req.user!.userId,
        verificadoEn: new Date(),
        motivoRechazo: null,
        updatedAt: new Date(),
      })
      .where(eq(pagosExamen.id, id));

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
    await db
      .update(pagosExamen)
      .set({ estado: 'emitida', motivoRechazo: motivo || 'Comprobante no válido', updatedAt: new Date() })
      .where(eq(pagosExamen.id, id));

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

/**
 * Marca como 'vencido' toda orden emitida/en_revisión cuya fecha de vencimiento
 * ya pasó. Se ejecuta por cron. Nunca toca órdenes ya pagadas o canceladas.
 */
export async function vencerPagosExamen(): Promise<number> {
  const hoy = new Date().toISOString().slice(0, 10);
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
  return res.length;
}

export default router;
