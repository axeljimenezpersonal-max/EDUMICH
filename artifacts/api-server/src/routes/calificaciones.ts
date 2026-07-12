/**
 * GET /calificaciones/estudiantes/:estudianteId → historial + resumen
 * Accesible por alumno (propio), gestor (su alumno), admin.
 */
import { Router } from 'express';
import { and, desc, eq, sql } from 'drizzle-orm';
import { archivoStream, archivoExiste } from '../services/storage';
import { db } from '../db';
import {
  calificaciones,
  modulos,
  sedes,
  estudiantes,
} from '@workspace/db/schema';
import { authRequired } from '../middleware/auth';
import { generarHistorialPdf } from '../services/historialPdf';

const router = Router();
router.use(authRequired);

async function canAccessStudent(
  requestUser: { userId: number; rol: string },
  estudianteId: number
): Promise<boolean> {
  if (requestUser.rol === 'admin') return true;
  if (requestUser.rol === 'estudiante') return requestUser.userId === estudianteId;
  if (requestUser.rol === 'gestor') {
    const [est] = await db
      .select({ gestorId: estudiantes.gestorId })
      .from(estudiantes)
      .where(eq(estudiantes.userId, estudianteId));
    return !!est && est.gestorId === requestUser.userId;
  }
  return false;
}

// GET /calificaciones/estudiantes/:estudianteId
router.get('/estudiantes/:estudianteId', async (req, res) => {
  const estudianteId = Number(req.params.estudianteId);
  if (!estudianteId) { res.status(400).json({ error: 'ID inválido' }); return; }

  if (!(await canAccessStudent(req.user!, estudianteId))) {
    res.status(403).json({ error: 'Sin acceso' }); return;
  }

  const rows = await db
    .select({
      id: calificaciones.id,
      moduloId: calificaciones.moduloId,
      etapaClave: calificaciones.etapaClave,
      calificacion: calificaciones.calificacion,
      aciertos: calificaciones.aciertos,
      aprobado: calificaciones.aprobado,
      intento: calificaciones.intento,
      fechaExamen: calificaciones.fechaExamen,
      notas: calificaciones.notas,
      createdAt: calificaciones.createdAt,
      moduloNumero: modulos.numero,
      moduloNombre: modulos.nombre,
      moduloNivel: modulos.nivel,
      sedeNombre: sedes.nombre,
    })
    .from(calificaciones)
    .leftJoin(modulos, eq(calificaciones.moduloId, modulos.id))
    .leftJoin(sedes, eq(calificaciones.sedeId, sedes.id))
    .where(eq(calificaciones.estudianteId, estudianteId))
    .orderBy(desc(calificaciones.fechaExamen));

  // Build modulosAprobados: best score per module, only approved
  const aprobadosMap = new Map<number, typeof rows[number]>();
  for (const r of rows) {
    if (!r.aprobado) continue;
    const existing = aprobadosMap.get(r.moduloId);
    if (!existing || r.calificacion > existing.calificacion) {
      aprobadosMap.set(r.moduloId, r);
    }
  }
  const modulosAprobados = Array.from(aprobadosMap.values()).sort(
    (a, b) => (a.moduloNumero ?? 0) - (b.moduloNumero ?? 0)
  );

  const totalAprobados = aprobadosMap.size;
  const examenesPresentados = rows.length;
  const promedioGlobal =
    rows.length > 0
      ? Math.round(rows.reduce((s, r) => s + r.calificacion, 0) / rows.length)
      : 0;
  const porcentajeAvance = Math.round((totalAprobados / 22) * 100);

  const [estPdf] = await db
    .select({ p: estudiantes.calificacionesPdfPath, en: estudiantes.calificacionesPdfSubidoEn })
    .from(estudiantes)
    .where(eq(estudiantes.userId, estudianteId));

  // CALIFICACIONES = exámenes que el alumno PAGÓ (con folio). La calificación
  // aparece automáticamente cuando el admin la captura (ligada por folio/examen).
  const pagadosRows = await db.execute<{
    inscripcion_id: number; folio: string; modulo_numero: number; modulo_nombre: string;
    calificacion: number | null; aciertos: number | null; aprobado: boolean | null; fecha_examen: string | null; estado: string;
    examen_etapa: string | null;
  }>(sql`
    SELECT ei.id AS inscripcion_id, ei.folio, ei.estado,
           m.numero AS modulo_numero, m.nombre AS modulo_nombre,
           c.calificacion, c.aciertos, c.aprobado, c.fecha_examen::text AS fecha_examen,
           ce.examen_sabado::text AS examen_etapa
    FROM examenes_inscripciones ei
    JOIN modulos m ON m.id = ei.modulo_id
    JOIN pagos_examen_inscripciones pei ON pei.examen_inscripcion_id = ei.id
    JOIN pagos_examen pe ON pe.id = pei.pago_examen_id AND pe.estado = 'pagado'
    LEFT JOIN convocatorias_etapas ce ON ce.id = ei.etapa_id
    LEFT JOIN calificaciones c ON c.inscripcion_examen_id = ei.id
    WHERE ei.estudiante_id = ${estudianteId} AND ei.estado <> 'cancelado'
    GROUP BY ei.id, ei.folio, ei.estado, m.numero, m.nombre, c.calificacion, c.aciertos, c.aprobado, c.fecha_examen, ce.examen_sabado
    ORDER BY m.numero
  `);
  const hoyStr = new Date().toISOString().slice(0, 10);
  const calificacionesExamen = pagadosRows.rows.map((r) => ({
    inscripcionId: Number(r.inscripcion_id),
    folio: r.folio,
    moduloNumero: Number(r.modulo_numero),
    moduloNombre: r.modulo_nombre,
    calificacion: r.calificacion,
    aciertos: r.aciertos,
    aprobado: r.aprobado,
    fechaExamen: r.fecha_examen,
    capturada: r.calificacion != null,
    // Ya presentó (examen de la etapa pasó) pero aún sin calificación → en proceso.
    enProceso: r.calificacion == null && !!r.examen_etapa && String(r.examen_etapa) < hoyStr,
  }));

  // ── EVALUACIONES DE PRÁCTICA (quizzes de la plataforma) ──────────────────
  // OJO: son DISTINTAS de las calificaciones oficiales. Aquí SOLO cuentan las
  // pruebas que el alumno realmente hizo (intentos_quiz > 0); las filas de
  // progreso creadas por aprobación oficial (0 intentos) NO son pruebas.
  const practicaRows = await db.execute<{
    modulo_numero: number; modulo_nombre: string; estado: string;
    intentos_quiz: number; mejor_calificacion: number | null;
    ultima_calificacion: number | null; ultima_actividad: string | null; temas_debiles: unknown;
  }>(sql`
    SELECT m.numero AS modulo_numero, m.nombre AS modulo_nombre, emp.estado,
           emp.intentos_quiz, emp.mejor_calificacion, emp.ultima_calificacion,
           emp.ultima_actividad::text AS ultima_actividad, emp.temas_debiles
    FROM estudiantes_modulos_progreso emp
    JOIN modulos m ON m.id = emp.modulo_id
    WHERE emp.estudiante_id = ${estudianteId} AND emp.intentos_quiz > 0
    ORDER BY m.numero
  `);
  const evaluacionesPractica = practicaRows.rows.map((r) => ({
    moduloNumero: Number(r.modulo_numero),
    moduloNombre: r.modulo_nombre,
    estado: r.estado,
    intentos: Number(r.intentos_quiz ?? 0),
    mejorCalificacion: r.mejor_calificacion,
    ultimaCalificacion: r.ultima_calificacion,
    ultimaActividad: r.ultima_actividad,
    // temas_debiles es jsonb (array de strings); lo servimos como texto legible.
    temasDebiles: Array.isArray(r.temas_debiles)
      ? (r.temas_debiles as string[]).join(', ')
      : typeof r.temas_debiles === 'string' ? r.temas_debiles : null,
    // Una prueba se considera "aprobada" con ≥60 (misma escala interna 0–100).
    aprobada: r.mejor_calificacion != null && r.mejor_calificacion >= 60,
  }));
  const pruebasAprobadas = evaluacionesPractica.filter((e) => e.aprobada).length;

  res.json({
    calificacionesExamen,
    modulosAprobados,
    historial: rows,
    resumen: { totalAprobados, promedioGlobal, examenesPresentados, porcentajeAvance },
    evaluacionesPractica,
    resumenPractica: { pruebasRealizadas: evaluacionesPractica.length, pruebasAprobadas },
    pdfOficial: {
      disponible: !!estPdf?.p,
      subidoEn: estPdf?.en ?? null,
    },
  });
});

// GET /calificaciones/estudiantes/:id/pdf-oficial → PDF de calificaciones subido por admin
router.get('/estudiantes/:estudianteId/pdf-oficial', async (req, res) => {
  const estudianteId = Number(req.params.estudianteId);
  if (!estudianteId) { res.status(400).json({ error: 'ID inválido' }); return; }
  if (!(await canAccessStudent(req.user!, estudianteId))) { res.status(403).json({ error: 'Sin acceso' }); return; }
  const [est] = await db.select({ p: estudiantes.calificacionesPdfPath }).from(estudiantes).where(eq(estudiantes.userId, estudianteId));
  if (!est?.p || !(await archivoExiste(est.p))) { res.status(404).json({ error: 'Sin PDF de calificaciones' }); return; }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="calificaciones.pdf"');
  archivoStream(est.p).pipe(res);
});

// GET /calificaciones/estudiantes/:estudianteId/pdf → historial académico en PDF
router.get('/estudiantes/:estudianteId/pdf', async (req, res) => {
  const estudianteId = Number(req.params.estudianteId);
  if (!estudianteId) { res.status(400).json({ error: 'ID inválido' }); return; }
  if (!(await canAccessStudent(req.user!, estudianteId))) {
    res.status(403).json({ error: 'Sin acceso' }); return;
  }
  try {
    const { pdf, nombreArchivo } = await generarHistorialPdf(estudianteId);
    const ascii = nombreArchivo.normalize('NFKD').replace(/[^\x20-\x7E]/g, '').replace(/"/g, '') || 'historial.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nombreArchivo)}`);
    res.send(Buffer.from(pdf));
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'No se pudo generar el historial' });
  }
});

export default router;
