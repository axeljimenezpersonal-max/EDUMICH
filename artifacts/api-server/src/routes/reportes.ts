import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { authRequired, requireRol } from '../middleware/auth';
import { reportesGenerados, reportesProgramados } from '@workspace/db/schema';
import { eq, desc, and, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { generarExcelReporte } from '../services/excelGenerator';
import { generarPDFReporte } from '../services/pdfReport';
import type { ReporteData } from '../services/excelGenerator';

const router = Router();
router.use(authRequired, requireRol('admin'));

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

interface FiltrosReporte {
  fechaInicio?: string;
  fechaFin?: string;
  municipioId?: string;
  gestorId?: string;
  estado?: string;
}

// SEGURIDAD: valida y normaliza los filtros que llegan del cliente antes de que
// toquen cualquier query. Fechas en ISO, ids numéricos, estado acotado.
const filtrosSchema = z
  .object({
    fechaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    fechaFin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    municipioId: z.string().regex(/^\d+$/).optional(),
    gestorId: z.string().regex(/^\d+$/).optional(),
    estado: z.string().max(50).optional(),
  })
  .strip();

function parseFiltros(raw: unknown): FiltrosReporte {
  const r = filtrosSchema.safeParse(raw ?? {});
  return r.success ? r.data : {};
}

// SEGURIDAD: las fechas se interpolan dentro de sql.raw(), así que se valida
// estrictamente el formato ISO (YYYY-MM-DD). Cualquier valor que no calce se
// IGNORA — esto cierra el vector de SQL injection por `fechaInicio`/`fechaFin`.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
function sqlFechaFiltro(col: string, inicio?: string, fin?: string): string {
  const parts: string[] = [];
  if (inicio && ISO_DATE.test(inicio)) parts.push(`${col} >= '${inicio}'`);
  if (fin && ISO_DATE.test(fin)) parts.push(`${col} <= '${fin} 23:59:59'`);
  return parts.length ? 'AND ' + parts.join(' AND ') : '';
}

async function datosInscripciones(f: FiltrosReporte) {
  const fechaFiltro = sqlFechaFiltro('i.created_at', f.fechaInicio, f.fechaFin);
  const municipioFiltro = f.municipioId ? `AND e.municipio_id = ${Number(f.municipioId)}` : '';
  const gestorFiltro = f.gestorId ? `AND e.gestor_id = ${Number(f.gestorId)}` : '';

  const rows = await db.execute<{
    alumno: string; curp: string; municipio: string; gestor: string;
    estado: string; convocatoria: string; fecha: string;
  }>(sql.raw(`
    SELECT e.nombre_completo AS alumno, e.curp, m.nombre AS municipio,
           g.nombre_completo AS gestor, i.estado, c.nombre AS convocatoria,
           i.created_at::date::text AS fecha
    FROM inscripciones i
    JOIN estudiantes e ON e.user_id = i.estudiante_id
    LEFT JOIN municipios m ON m.id = e.municipio_id
    LEFT JOIN gestores g ON g.user_id = e.gestor_id
    LEFT JOIN convocatorias c ON c.id = i.convocatoria_id
    WHERE 1=1 ${fechaFiltro} ${municipioFiltro} ${gestorFiltro}
    ORDER BY i.created_at DESC
    LIMIT 2000
  `));

  const filas = rows.rows.map((r) => [r.alumno, r.curp, r.municipio, r.gestor, r.estado, r.convocatoria, r.fecha]);

  const estadosRes = await db.execute<{ estado: string; total: string }>(sql.raw(`
    SELECT i.estado, COUNT(*) AS total
    FROM inscripciones i
    JOIN estudiantes e ON e.user_id = i.estudiante_id
    WHERE 1=1 ${municipioFiltro} ${gestorFiltro}
    GROUP BY i.estado ORDER BY total DESC
  `));

  const totalRes = await db.execute<{ total: string }>(sql.raw(`
    SELECT COUNT(*) AS total FROM inscripciones i
    JOIN estudiantes e ON e.user_id = i.estudiante_id
    WHERE 1=1 ${municipioFiltro} ${gestorFiltro}
  `));

  const total = Number(totalRes.rows[0]?.total ?? 0);
  const kpis = [
    { label: 'Total inscripciones', valor: total },
    ...estadosRes.rows.slice(0, 5).map((r) => ({
      label: r.estado.replace(/_/g, ' '),
      valor: Number(r.total),
      unidad: 'alumnos',
    })),
  ];

  return {
    kpis,
    columnas: ['Alumno', 'CURP', 'Municipio', 'Gestor', 'Estado', 'Convocatoria', 'Fecha'],
    filas,
  };
}

async function datosExpedientes(f: FiltrosReporte) {
  const municipioFiltro = f.municipioId ? `AND e.municipio_id = ${Number(f.municipioId)}` : '';

  const rows = await db.execute<{
    alumno: string; curp: string; tipo: string; estado: string;
    revisado_en: string; revisor: string;
  }>(sql.raw(`
    SELECT e.nombre_completo AS alumno, e.curp, ed.tipo, ed.estado,
           ed.revisado_en::date::text AS revisado_en, u.email AS revisor
    FROM expediente_documentos ed
    JOIN estudiantes e ON e.user_id = ed.estudiante_id
    LEFT JOIN users u ON u.id = ed.revisado_por_user_id
    WHERE 1=1 ${municipioFiltro}
    ORDER BY ed.created_at DESC
    LIMIT 2000
  `));

  const statsRes = await db.execute<{ estado: string; total: string }>(sql.raw(`
    SELECT ed.estado, COUNT(*) AS total
    FROM expediente_documentos ed
    JOIN estudiantes e ON e.user_id = ed.estudiante_id
    WHERE 1=1 ${municipioFiltro}
    GROUP BY ed.estado
  `));

  const stats = Object.fromEntries(statsRes.rows.map((r) => [r.estado, Number(r.total)]));
  const kpis = [
    { label: 'Total documentos', valor: rows.rows.length },
    { label: 'Aprobados', valor: stats.aprobado ?? 0 },
    { label: 'Pendientes revisión', valor: stats.pendiente_revision ?? 0 },
    { label: 'Rechazados', valor: stats.rechazado ?? 0 },
  ];

  return {
    kpis,
    columnas: ['Alumno', 'CURP', 'Tipo', 'Estado', 'Revisado el', 'Revisor'],
    filas: rows.rows.map((r) => [r.alumno, r.curp, r.tipo, r.estado, r.revisado_en ?? '—', r.revisor ?? '—']),
  };
}

async function datosFinanciero(f: FiltrosReporte) {
  const fechaFiltro = sqlFechaFiltro('p.created_at', f.fechaInicio, f.fechaFin);

  const rows = await db.execute<{
    alumno: string; concepto: string; monto: string; metodo: string;
    estado: string; fecha_pago: string; referencia: string;
  }>(sql.raw(`
    SELECT e.nombre_completo AS alumno, p.concepto, p.monto::text, p.metodo_pago AS metodo,
           p.estado, p.fecha_pago::text, p.referencia_bancaria AS referencia
    FROM pagos p
    JOIN estudiantes e ON e.user_id = p.estudiante_id
    WHERE 1=1 ${fechaFiltro}
    ORDER BY p.created_at DESC
    LIMIT 2000
  `));

  const sumRes = await db.execute<{ estado: string; total: string; monto: string }>(sql.raw(`
    SELECT p.estado, COUNT(*) AS total, COALESCE(SUM(p.monto), 0)::text AS monto
    FROM pagos p WHERE 1=1 ${fechaFiltro}
    GROUP BY p.estado
  `));

  const stats = Object.fromEntries(sumRes.rows.map((r) => [r.estado, { total: Number(r.total), monto: Number(r.monto) }]));
  const totalRecaudado = sumRes.rows.reduce((s, r) => s + Number(r.monto), 0);

  const kpis = [
    { label: 'Total recaudado', valor: `$${totalRecaudado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, unidad: 'MXN' },
    { label: 'Pagos verificados', valor: stats.verificado?.total ?? 0 },
    { label: 'Pagos pendientes', valor: stats.pendiente?.total ?? 0 },
    { label: 'Pagos rechazados', valor: stats.rechazado?.total ?? 0 },
  ];

  return {
    kpis,
    columnas: ['Alumno', 'Concepto', 'Monto', 'Método', 'Estado', 'Fecha Pago', 'Referencia'],
    filas: rows.rows.map((r) => [r.alumno, r.concepto, `$${Number(r.monto).toFixed(2)}`, r.metodo, r.estado, r.fecha_pago, r.referencia ?? '—']),
  };
}

async function datosAcademico(f: FiltrosReporte) {
  const fechaFiltro = sqlFechaFiltro('c.fecha_examen', f.fechaInicio, f.fechaFin);

  const rows = await db.execute<{
    alumno: string; modulo: string; calificacion: number;
    aprobado: boolean; fecha_examen: string; etapa: string;
  }>(sql.raw(`
    SELECT e.nombre_completo AS alumno, m.nombre AS modulo, c.calificacion,
           c.aprobado, c.fecha_examen::text, c.etapa_clave AS etapa
    FROM calificaciones c
    JOIN estudiantes e ON e.user_id = c.estudiante_id
    JOIN modulos m ON m.id = c.modulo_id
    WHERE 1=1 ${fechaFiltro}
    ORDER BY c.created_at DESC
    LIMIT 2000
  `));

  const totalRows = rows.rows.length;
  const aprobados = rows.rows.filter((r) => r.aprobado).length;
  const promedio = totalRows > 0
    ? (rows.rows.reduce((s, r) => s + Number(r.calificacion), 0) / totalRows).toFixed(1)
    : '0';

  const kpis = [
    { label: 'Total evaluaciones', valor: totalRows },
    { label: 'Aprobados', valor: aprobados },
    { label: 'Tasa aprobación', valor: totalRows > 0 ? `${((aprobados / totalRows) * 100).toFixed(1)}%` : '0%' },
    { label: 'Promedio general', valor: promedio, unidad: 'pts' },
  ];

  return {
    kpis,
    columnas: ['Alumno', 'Módulo', 'Calificación', 'Aprobado', 'Fecha Examen', 'Etapa'],
    filas: rows.rows.map((r) => [r.alumno, r.modulo, r.calificacion, r.aprobado ? 'Sí' : 'No', r.fecha_examen, r.etapa]),
  };
}

async function datosProductividadGestores(f: FiltrosReporte) {
  const municipioFiltro = f.municipioId ? `AND g.municipio_id = ${Number(f.municipioId)}` : '';

  const rows = await db.execute<{
    gestor: string; municipio: string; total_alumnos: string;
    con_matricula: string; documentos_completos: string; estado: string;
  }>(sql.raw(`
    SELECT g.nombre_completo AS gestor, m.nombre AS municipio,
           COUNT(DISTINCT e.user_id)::text AS total_alumnos,
           COUNT(DISTINCT CASE WHEN e.matricula_oficial_dgb IS NOT NULL THEN e.user_id END)::text AS con_matricula,
           COUNT(DISTINCT CASE WHEN e.user_id IN (
             SELECT estudiante_id FROM expediente_documentos WHERE estado = 'aprobado'
           ) THEN e.user_id END)::text AS documentos_completos,
           g.estado
    FROM gestores g
    LEFT JOIN municipios m ON m.id = g.municipio_id
    LEFT JOIN estudiantes e ON e.gestor_id = g.user_id
    WHERE 1=1 ${municipioFiltro}
    GROUP BY g.user_id, g.nombre_completo, m.nombre, g.estado
    ORDER BY total_alumnos::int DESC
  `));

  const totalAlumnos = rows.rows.reduce((s, r) => s + Number(r.total_alumnos), 0);
  const promedio = rows.rows.length > 0 ? (totalAlumnos / rows.rows.length).toFixed(1) : '0';

  const kpis = [
    { label: 'Total gestores', valor: rows.rows.length },
    { label: 'Total alumnos', valor: totalAlumnos },
    { label: 'Promedio alumnos/gestor', valor: promedio },
    { label: 'Gestores activos', valor: rows.rows.filter((r) => r.estado === 'activo').length },
  ];

  return {
    kpis,
    columnas: ['Gestor', 'Municipio', 'Total Alumnos', 'Con Matrícula', 'Docs Completos', 'Estado'],
    filas: rows.rows.map((r) => [r.gestor, r.municipio, r.total_alumnos, r.con_matricula, r.documentos_completos, r.estado]),
  };
}

async function datosConvocatorias(f: FiltrosReporte) {
  const rows = await db.execute<{
    alumno: string; etapa: string; modulo: string; sede: string;
    estado: string; calificacion: string;
  }>(sql.raw(`
    SELECT e.nombre_completo AS alumno,
           ce.clave AS etapa, m.nombre AS modulo,
           s.nombre AS sede, ei.estado,
           COALESCE(ei.calificacion::text, '—') AS calificacion
    FROM examenes_inscripciones ei
    JOIN estudiantes e ON e.user_id = ei.estudiante_id
    JOIN convocatorias_etapas ce ON ce.id = ei.etapa_id
    JOIN modulos m ON m.id = ei.modulo_id
    JOIN sedes s ON s.id = ei.sede_id
    ORDER BY ei.created_at DESC
    LIMIT 2000
  `));

  const etapasRes = await db.execute<{ etapa: string; total: string }>(sql.raw(`
    SELECT ce.clave AS etapa, COUNT(*) AS total
    FROM examenes_inscripciones ei
    JOIN convocatorias_etapas ce ON ce.id = ei.etapa_id
    GROUP BY ce.clave ORDER BY total DESC
  `));

  const kpis = [
    { label: 'Total inscripciones examen', valor: rows.rows.length },
    ...etapasRes.rows.slice(0, 3).map((r) => ({ label: `Etapa ${r.etapa}`, valor: Number(r.total), unidad: 'inscritos' })),
  ];

  return {
    kpis,
    columnas: ['Alumno', 'Etapa', 'Módulo', 'Sede', 'Estado', 'Calificación'],
    filas: rows.rows.map((r) => [r.alumno, r.etapa, r.modulo, r.sede, r.estado, r.calificacion]),
  };
}

async function datosSolicitudes(f: FiltrosReporte) {
  const fechaFiltro = sqlFechaFiltro('sc.created_at', f.fechaInicio, f.fechaFin);
  const municipioFiltro = f.municipioId ? `AND sc.municipio_id = ${Number(f.municipioId)}` : '';

  const rows = await db.execute<{
    folio: string; nombre: string; municipio: string;
    modalidad: string; estado: string; fecha: string; email: string;
  }>(sql.raw(`
    SELECT sc.folio, sc.nombre_completo AS nombre, m.nombre AS municipio,
           sc.modalidad_preferida AS modalidad, sc.estado,
           sc.created_at::date::text AS fecha, sc.email
    FROM solicitudes_cuenta sc
    LEFT JOIN municipios m ON m.id = sc.municipio_id
    WHERE 1=1 ${fechaFiltro} ${municipioFiltro}
    ORDER BY sc.created_at DESC
    LIMIT 2000
  `));

  const statsRes = await db.execute<{ estado: string; total: string }>(sql.raw(`
    SELECT estado, COUNT(*) AS total
    FROM solicitudes_cuenta WHERE 1=1 ${fechaFiltro}
    GROUP BY estado
  `));

  const stats = Object.fromEntries(statsRes.rows.map((r) => [r.estado, Number(r.total)]));

  const kpis = [
    { label: 'Total solicitudes', valor: rows.rows.length },
    { label: 'Pendientes', valor: stats.pendiente ?? 0 },
    { label: 'Aprobadas', valor: stats.aprobada ?? 0 },
    { label: 'Rechazadas', valor: stats.rechazada ?? 0 },
  ];

  return {
    kpis,
    columnas: ['Folio', 'Nombre', 'Municipio', 'Modalidad', 'Estado', 'Fecha', 'Email'],
    filas: rows.rows.map((r) => [r.folio ?? '—', r.nombre, r.municipio, r.modalidad ?? '—', r.estado, r.fecha, r.email]),
  };
}

async function datosEjecutivo(f: FiltrosReporte) {
  const [alumnos, gestores_, solicitudes_, inscripciones_, pagos_] = await Promise.all([
    db.execute<{ total: string; con_matricula: string }>(sql.raw(`
      SELECT COUNT(*) AS total,
             COUNT(CASE WHEN matricula_oficial_dgb IS NOT NULL THEN 1 END) AS con_matricula
      FROM estudiantes
    `)),
    db.execute<{ total: string; activos: string }>(sql.raw(`
      SELECT COUNT(*) AS total,
             COUNT(CASE WHEN estado = 'activo' THEN 1 END) AS activos
      FROM gestores
    `)),
    db.execute<{ pendientes: string; aprobadas: string }>(sql.raw(`
      SELECT COUNT(CASE WHEN estado = 'pendiente' THEN 1 END) AS pendientes,
             COUNT(CASE WHEN estado = 'aprobada' THEN 1 END) AS aprobadas
      FROM solicitudes_cuenta
    `)),
    db.execute<{ total: string }>(sql.raw(`SELECT COUNT(*) AS total FROM inscripciones`)),
    db.execute<{ verificados: string; monto: string }>(sql.raw(`
      SELECT COUNT(CASE WHEN estado = 'verificado' THEN 1 END) AS verificados,
             COALESCE(SUM(CASE WHEN estado = 'verificado' THEN monto END), 0)::text AS monto
      FROM pagos
    `)),
  ]);

  const kpis = [
    { label: 'Total alumnos', valor: Number(alumnos.rows[0]?.total ?? 0) },
    { label: 'Con matrícula DGB', valor: Number(alumnos.rows[0]?.con_matricula ?? 0) },
    { label: 'Gestores activos', valor: Number(gestores_.rows[0]?.activos ?? 0) },
    { label: 'Solicitudes pendientes', valor: Number(solicitudes_.rows[0]?.pendientes ?? 0) },
    { label: 'Total inscripciones', valor: Number(inscripciones_.rows[0]?.total ?? 0) },
    { label: 'Recaudación verificada', valor: `$${Number(pagos_.rows[0]?.monto ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, unidad: 'MXN' },
  ];

  const filas: (string | number | null)[][] = kpis.map((k) => ['Resumen ejecutivo', k.label, k.valor]);

  return {
    kpis,
    columnas: ['Categoría', 'Indicador', 'Valor'],
    filas,
  };
}

const DATA_FN: Record<string, (f: FiltrosReporte) => Promise<{ kpis: ReporteData['kpis']; columnas: string[]; filas: ReporteData['filas'] }>> = {
  inscripciones: datosInscripciones,
  expedientes: datosExpedientes,
  financiero: datosFinanciero,
  academico: datosAcademico,
  productividad_gestores: datosProductividadGestores,
  convocatorias: datosConvocatorias,
  solicitudes: datosSolicitudes,
  ejecutivo: datosEjecutivo,
};

const NOMBRES: Record<string, string> = {
  inscripciones: 'Reporte de Inscripciones',
  expedientes: 'Reporte de Expedientes',
  financiero: 'Reporte Financiero',
  academico: 'Reporte Académico',
  productividad_gestores: 'Productividad de Gestores',
  convocatorias: 'Reporte de Convocatorias',
  solicitudes: 'Reporte de Solicitudes de Cuenta',
  ejecutivo: 'Reporte Ejecutivo',
};

// ─────────────────────────────────────────────────────────────
// POST /api/admin/reportes/preview
// ─────────────────────────────────────────────────────────────
router.post('/preview', async (req, res) => {
  const { tipo } = req.body as { tipo: string };
  const filtros = parseFiltros((req.body as { filtros?: unknown }).filtros);
  const fn = DATA_FN[tipo];
  if (!fn) { res.status(400).json({ error: 'Tipo de reporte inválido' }); return; }

  const { kpis, columnas, filas } = await fn(filtros);
  res.json({ kpis, columnas, preview: filas.slice(0, 50), totalRegistros: filas.length });
});

// ─────────────────────────────────────────────────────────────
// POST /api/admin/reportes/generar
// ─────────────────────────────────────────────────────────────
router.post('/generar', async (req, res) => {
  const { tipo, formato = 'excel' } = req.body as {
    tipo: string;
    formato: 'excel' | 'pdf';
  };
  const filtros = parseFiltros((req.body as { filtros?: unknown }).filtros);

  const fn = DATA_FN[tipo];
  if (!fn) { res.status(400).json({ error: 'Tipo de reporte inválido' }); return; }
  if (!['excel', 'pdf'].includes(formato)) { res.status(400).json({ error: 'Formato inválido' }); return; }

  const { kpis, columnas, filas } = await fn(filtros);

  const user = (req as any).user;
  const nombre = NOMBRES[tipo] ?? tipo;
  const reporteData: ReporteData = {
    tipo,
    nombre,
    filtros: filtros as unknown as Record<string, unknown>,
    kpis,
    columnas,
    filas,
    generadoEn: new Date(),
    generadoPor: user?.email ?? 'sistema',
  };

  // Save record
  const [registro] = await db
    .insert(reportesGenerados)
    .values({
      tipo: tipo as any,
      formato: formato as any,
      nombre,
      filtros,
      estado: 'generando',
      generadoPorUserId: user?.id,
      totalRegistros: filas.length,
    })
    .returning({ id: reportesGenerados.id });

  let buffer: Buffer;
  let mimeType: string;
  let ext: string;

  if (formato === 'excel') {
    buffer = await generarExcelReporte(reporteData);
    mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    ext = 'xlsx';
  } else {
    buffer = await generarPDFReporte(reporteData);
    mimeType = 'application/pdf';
    ext = 'pdf';
  }

  const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const nombreArchivo = `${tipo}_${fecha}.${ext}`;

  await db
    .update(reportesGenerados)
    .set({ estado: 'listo', nombreArchivo, tamanoBytes: buffer.length, generadoEn: new Date() })
    .where(eq(reportesGenerados.id, registro.id));

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
  res.setHeader('Content-Length', buffer.length);
  res.end(buffer);
});

// ─────────────────────────────────────────────────────────────
// GET /api/admin/reportes/historial
// ─────────────────────────────────────────────────────────────
router.get('/historial', async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const historial = await db
    .select()
    .from(reportesGenerados)
    .orderBy(desc(reportesGenerados.createdAt))
    .limit(limit);
  res.json(historial);
});

// ─────────────────────────────────────────────────────────────
// GET /api/admin/reportes/programados
// ─────────────────────────────────────────────────────────────
router.get('/programados', async (_req, res) => {
  const programados = await db
    .select()
    .from(reportesProgramados)
    .orderBy(desc(reportesProgramados.createdAt));
  res.json(programados);
});

// ─────────────────────────────────────────────────────────────
// POST /api/admin/reportes/programados
// ─────────────────────────────────────────────────────────────
router.post('/programados', async (req, res) => {
  const { nombre, tipo, formato, frecuencia, filtros, emailDestino } = req.body;
  if (!nombre || !tipo || !formato || !frecuencia || !emailDestino) {
    res.status(400).json({ error: 'Faltan campos requeridos' }); return;
  }
  if (!DATA_FN[tipo]) { res.status(400).json({ error: 'Tipo inválido' }); return; }

  const proximaEjecucion = calcularProximaEjecucion(frecuencia);
  const user = (req as any).user;

  const [nuevo] = await db
    .insert(reportesProgramados)
    .values({ nombre, tipo, formato, frecuencia, filtros: filtros ?? {}, emailDestino, proximaEjecucion, creadoPorUserId: user?.id })
    .returning();

  res.status(201).json(nuevo);
});

// ─────────────────────────────────────────────────────────────
// PATCH /api/admin/reportes/programados/:id
// ─────────────────────────────────────────────────────────────
router.patch('/programados/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { activo, nombre, emailDestino } = req.body;

  const updates: Partial<typeof reportesProgramados.$inferInsert> = { updatedAt: new Date() };
  if (typeof activo === 'boolean') updates.activo = activo;
  if (nombre) updates.nombre = nombre;
  if (emailDestino) updates.emailDestino = emailDestino;

  const [updated] = await db
    .update(reportesProgramados)
    .set(updates)
    .where(eq(reportesProgramados.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: 'No encontrado' }); return; }
  res.json(updated);
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/admin/reportes/programados/:id
// ─────────────────────────────────────────────────────────────
router.delete('/programados/:id', async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(reportesProgramados).where(eq(reportesProgramados.id, id));
  res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────
// Cron execution helper (exported for index.ts)
// ─────────────────────────────────────────────────────────────
export async function ejecutarReportesProgramados() {
  const ahora = new Date();
  const pendientes = await db
    .select()
    .from(reportesProgramados)
    .where(and(eq(reportesProgramados.activo, true), lte(reportesProgramados.proximaEjecucion, ahora)));

  for (const prog of pendientes) {
    const fn = DATA_FN[prog.tipo];
    if (!fn) continue;

    const filtros = (prog.filtros as FiltrosReporte) ?? {};
    const { kpis, columnas, filas } = await fn(filtros);
    const nombre = NOMBRES[prog.tipo] ?? prog.tipo;

    const reporteData: ReporteData = {
      tipo: prog.tipo,
      nombre: prog.nombre ?? nombre,
      filtros: filtros as unknown as Record<string, unknown>,
      kpis,
      columnas,
      filas,
      generadoEn: ahora,
      generadoPor: 'sistema-automático',
    };

    const [registro] = await db
      .insert(reportesGenerados)
      .values({
        tipo: prog.tipo,
        formato: prog.formato,
        nombre: prog.nombre ?? nombre,
        filtros,
        estado: 'generando',
        programadoId: prog.id,
        totalRegistros: filas.length,
      })
      .returning({ id: reportesGenerados.id });

    const buffer = prog.formato === 'pdf'
      ? await generarPDFReporte(reporteData)
      : await generarExcelReporte(reporteData);

    const ext = prog.formato === 'pdf' ? 'pdf' : 'xlsx';
    const fecha = ahora.toISOString().slice(0, 10).replace(/-/g, '');
    const nombreArchivo = `${prog.tipo}_${fecha}.${ext}`;

    await db
      .update(reportesGenerados)
      .set({ estado: 'listo', nombreArchivo, tamanoBytes: buffer.length, generadoEn: ahora })
      .where(eq(reportesGenerados.id, registro.id));

    const proximaEjecucion = calcularProximaEjecucion(prog.frecuencia);
    await db
      .update(reportesProgramados)
      .set({ ultimaEjecucionEn: ahora, proximaEjecucion, updatedAt: ahora })
      .where(eq(reportesProgramados.id, prog.id));
  }
}

function calcularProximaEjecucion(frecuencia: string): Date {
  const d = new Date();
  switch (frecuencia) {
    case 'diaria': d.setDate(d.getDate() + 1); break;
    case 'semanal': d.setDate(d.getDate() + 7); break;
    case 'quincenal': d.setDate(d.getDate() + 15); break;
    case 'mensual': d.setMonth(d.getMonth() + 1); break;
    default: d.setDate(d.getDate() + 7);
  }
  d.setHours(8, 0, 0, 0);
  return d;
}

export default router;
