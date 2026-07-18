/**
 * Sincroniza el `estado` de cada etapa de convocatoria con sus fechas.
 *
 * Ciclo de vida:
 *   programada          → hoy < solicitud_inicio
 *   inscripcion_abierta → solicitud_inicio ≤ hoy ≤ solicitud_fin
 *   inscripcion_cerrada → solicitud_fin < hoy ≤ examen_domingo
 *   finalizada          → hoy > examen_domingo
 *
 * Se ejecuta al arrancar y por cron diario. Solo escribe filas cuyo estado
 * calculado difiere del actual (idempotente).
 */
import { pool } from '@workspace/db';
import { hoyEnMexico } from '../utils/fechas';

export async function sincronizarEstadosEtapas(): Promise<number> {
  // El día se pasa desde la app en horario de Michoacán. `CURRENT_DATE` usaba la
  // zona del servidor de base de datos (UTC en Neon), así que a partir de las
  // 18:00 locales ya contaba el día siguiente: la ventana de inscripción se
  // CERRABA seis horas antes de tiempo su último día, y quien entraba esa noche
  // se topaba con «el período ya cerró» sin que fuera cierto.
  const hoy = hoyEnMexico();
  const res = await pool.query(
    `
    UPDATE convocatorias_etapas AS ce
    SET estado = c.nuevo
    FROM (
      SELECT id, CASE
        WHEN $1::date < solicitud_inicio THEN 'programada'
        WHEN $1::date <= solicitud_fin   THEN 'inscripcion_abierta'
        WHEN $1::date <= examen_domingo  THEN 'inscripcion_cerrada'
        ELSE 'finalizada'
      END AS nuevo
      FROM convocatorias_etapas
    ) c
    WHERE ce.id = c.id AND ce.estado <> c.nuevo
    RETURNING ce.id
  `,
    [hoy],
  );
  return res.rowCount ?? 0;
}
