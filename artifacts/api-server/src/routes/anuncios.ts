/**
 * Rutas de anuncios para usuarios autenticados (cualquier rol)
 * GET  /anuncios/mios   — lista anuncios relevantes al usuario (audience filter)
 * POST /anuncios/:id/cerrar — marca el anuncio como visto/cerrado
 */

import { Router } from 'express';
import { eq, sql, and, or, isNull, gte } from 'drizzle-orm';
import { db } from '../db';
import { anuncios, anunciosVistos, estudiantes, gestores, convocatoriasEtapas } from '@workspace/db/schema';
import { authRequired } from '../middleware/auth';
import { hoyEnMexico } from '../utils/fechas';

const router = Router();
router.use(authRequired);

// ─── GET /anuncios/calendario ─────────────────────────────────────────────
// Anuncios de FECHAS calculados en vivo desde el calendario oficial de etapas
// (siempre al día, sin cron). Visible para alumno, gestor y admin. Devuelve la
// ventana de solicitud abierta hoy (o la próxima en abrir) y el examen próximo.
router.get('/calendario', async (_req, res) => {
  const hoy = hoyEnMexico();
  const dias = (s: string) => Math.ceil((new Date(s + 'T00:00:00').getTime() - new Date(hoy + 'T00:00:00').getTime()) / 86400000);
  const eventos: Array<{
    tipo: 'ventana_abierta' | 'ventana_proxima' | 'examen';
    clave: string; fecha: string; fechaInicio?: string; fechaFin?: string; dias: number; urgencia: 'alta' | 'media' | 'baja';
  }> = [];

  // Ventana de inscripción/pago ABIERTA hoy → si no hay, la PRÓXIMA en abrir.
  const [abierta] = await db.execute<{ clave: string; si: string; sf: string }>(sql`
    SELECT clave, solicitud_inicio::text si, solicitud_fin::text sf FROM convocatorias_etapas
    WHERE solicitud_inicio <= ${hoy} AND solicitud_fin >= ${hoy}
    ORDER BY solicitud_fin ASC LIMIT 1`).then((r) => r.rows);
  if (abierta) {
    const d = dias(abierta.sf);
    // fecha = cierre (cuenta regresiva); fechaInicio = apertura (para el rango).
    eventos.push({ tipo: 'ventana_abierta', clave: abierta.clave, fecha: abierta.sf, fechaInicio: abierta.si, dias: d, urgencia: d <= 3 ? 'alta' : 'media' });
  } else {
    const [prox] = await db.execute<{ clave: string; si: string; sf: string }>(sql`
      SELECT clave, solicitud_inicio::text si, solicitud_fin::text sf FROM convocatorias_etapas
      WHERE solicitud_inicio > ${hoy} ORDER BY solicitud_inicio ASC LIMIT 1`).then((r) => r.rows);
    if (prox) eventos.push({ tipo: 'ventana_proxima', clave: prox.clave, fecha: prox.si, fechaFin: prox.sf, dias: dias(prox.si), urgencia: 'baja' });
  }

  // Próximo examen (dentro de los próximos 14 días).
  const [exam] = await db.execute<{ clave: string; es: string; ed: string }>(sql`
    SELECT clave, examen_sabado::text es, examen_domingo::text ed FROM convocatorias_etapas
    WHERE examen_sabado >= ${hoy} ORDER BY examen_sabado ASC LIMIT 1`).then((r) => r.rows);
  if (exam) {
    const d = dias(exam.es);
    if (d <= 14) eventos.push({ tipo: 'examen', clave: exam.clave, fecha: exam.es, fechaFin: exam.ed, dias: d, urgencia: d <= 3 ? 'alta' : 'media' });
  }

  res.json({ eventos });
});

// ─── GET /anuncios/calendario-etapas ──────────────────────────────────────
// Calendario COMPLETO: todas las etapas con su ventana de inscripción/pago y
// sus días de examen. Para el calendario visual del alumno/gestor. `estado`
// se recalcula en vivo (finalizada/activa/proxima) por si el guardado quedó
// atrás.
router.get('/calendario-etapas', async (_req, res) => {
  const hoy = hoyEnMexico();
  const rows = await db.execute<{
    clave: string; etapa: string; fase: string; anio: number;
    solicitud_inicio: string | null; solicitud_fin: string | null;
    examen_sabado: string | null; examen_domingo: string | null;
  }>(sql`
    SELECT clave, etapa, fase, anio,
           solicitud_inicio::date::text AS solicitud_inicio,
           solicitud_fin::date::text AS solicitud_fin,
           examen_sabado::date::text AS examen_sabado,
           examen_domingo::date::text AS examen_domingo
    FROM convocatorias_etapas
    ORDER BY solicitud_inicio ASC NULLS LAST, examen_sabado ASC NULLS LAST
  `).then((r) => r.rows);

  const etapas = rows.map((r) => {
    const finExamen = r.examen_domingo ?? r.examen_sabado;
    let estado: 'finalizada' | 'inscripcion' | 'proxima' | 'espera_examen';
    if (finExamen && finExamen < hoy) estado = 'finalizada';
    else if (r.solicitud_inicio && r.solicitud_fin && r.solicitud_inicio <= hoy && r.solicitud_fin >= hoy) estado = 'inscripcion';
    else if (r.solicitud_inicio && r.solicitud_inicio > hoy) estado = 'proxima';
    else estado = 'espera_examen'; // ventana cerrada, examen pendiente
    return {
      clave: r.clave, etapa: r.etapa, fase: r.fase, anio: r.anio,
      solicitudInicio: r.solicitud_inicio, solicitudFin: r.solicitud_fin,
      examenSabado: r.examen_sabado, examenDomingo: r.examen_domingo,
      estado,
    };
  });

  res.json({ etapas, hoy });
});

router.get('/mios', async (req, res) => {
  const { userId, rol } = req.user!;

  // Determine municipio of the user for audience filtering
  let municipioId: number | null = null;
  if (rol === 'estudiante') {
    const [e] = await db.select({ municipioId: estudiantes.municipioId }).from(estudiantes).where(eq(estudiantes.userId, userId));
    municipioId = e?.municipioId ?? null;
  } else if (rol === 'gestor') {
    const [g] = await db.select({ municipioId: gestores.municipioId }).from(gestores).where(eq(gestores.userId, userId));
    municipioId = g?.municipioId ?? null;
  }

  // Audience predicates
  const audiencePred = rol === 'admin'
    ? sql`true`
    : rol === 'gestor'
      ? sql`(a.audiencia IN ('todos','gestores') OR (a.audiencia = 'gestor_especifico' AND a.audiencia_param = ${String(userId)}) OR (a.audiencia = 'alumnos_municipio' AND a.audiencia_param = ${String(municipioId ?? 0)}))`
      : sql`(a.audiencia IN ('todos','alumnos') OR (a.audiencia = 'alumnos_municipio' AND a.audiencia_param = ${String(municipioId ?? 0)}))`;

  const now = new Date().toISOString();

  const rows = await db.execute(sql`
    SELECT
      a.id,
      a.titulo,
      a.contenido,
      a.prioridad,
      a.audiencia,
      a.cta_texto AS "ctaTexto",
      a.cta_url   AS "ctaUrl",
      a.publicado_en AS "publicadoEn",
      a.activo_hasta AS "activoHasta",
      EXISTS(SELECT 1 FROM anuncios_vistos av WHERE av.anuncio_id = a.id AND av.user_id = ${userId}) AS "yaVisto"
    FROM anuncios a
    WHERE a.estado = 'publicado'
      AND (a.activo_hasta IS NULL OR a.activo_hasta > NOW())
      AND ${audiencePred}
    ORDER BY
      CASE a.prioridad WHEN 'urgente' THEN 0 WHEN 'importante' THEN 1 ELSE 2 END,
      a.publicado_en DESC
    LIMIT 20
  `);

  res.json({ anuncios: rows.rows });
});

router.post('/:id/cerrar', async (req, res) => {
  const { userId } = req.user!;
  const anuncioId = Number(req.params.id);
  if (Number.isNaN(anuncioId)) { res.status(400).json({ error: 'ID inválido' }); return; }

  await db.insert(anunciosVistos)
    .values({ anuncioId, userId })
    .onConflictDoNothing();

  res.json({ ok: true });
});

export default router;
