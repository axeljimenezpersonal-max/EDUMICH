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

export async function sincronizarEstadosEtapas(): Promise<number> {
  const res = await pool.query(`
    UPDATE convocatorias_etapas AS ce
    SET estado = c.nuevo
    FROM (
      SELECT id, CASE
        WHEN CURRENT_DATE < solicitud_inicio THEN 'programada'
        WHEN CURRENT_DATE <= solicitud_fin   THEN 'inscripcion_abierta'
        WHEN CURRENT_DATE <= examen_domingo  THEN 'inscripcion_cerrada'
        ELSE 'finalizada'
      END AS nuevo
      FROM convocatorias_etapas
    ) c
    WHERE ce.id = c.id AND ce.estado <> c.nuevo
    RETURNING ce.id
  `);
  return res.rowCount ?? 0;
}
