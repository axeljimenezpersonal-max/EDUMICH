/**
 * ¿Este alumno tiene pagado su derecho a examen?
 *
 * FUENTE ÚNICA. Existe porque la respuesta estaba escrita a mano en varios
 * sitios y todos apuntaban a la tabla `pagos`, que quedó VACÍA cuando el
 * modelo real pasó a ser `pagos_examen`. Consecuencia: ningún alumno salía
 * nunca de "pago pendiente" y el filtro de la lista devolvía siempre vacío,
 * con 7 de 7 alumnos pagados en la base. Si mañana cambia otra vez el modelo
 * de pago, se cambia aquí y en ningún otro lado.
 *
 * Un pago cubre al alumno por dos vías:
 *  - Individual: `pagos_examen.estudiante_id` apunta al alumno.
 *  - Grupal: `estudiante_id` es NULL y los alumnos cuelgan del puente
 *    `pagos_examen_inscripciones` → `examenes_inscripciones`.
 *
 * Solo cuenta el estado `pagado` (conciliado/verificado por un admin).
 * `en_revision` es "subió comprobante, falta verificar" y NO cuenta como
 * pagado.
 */

import { pool } from '@workspace/db';

/**
 * Fragmento SQL reutilizable. `aliasAlumno` es la expresión que identifica al
 * alumno en la consulta que lo embebe (por ejemplo `e.user_id`).
 *
 * Se devuelve como texto porque las consultas que lo usan se arman con SQL
 * crudo. No interpola nada que venga del usuario: `aliasAlumno` siempre es un
 * literal escrito en el código.
 */
export function sqlTieneExamenPagado(aliasAlumno: string): string {
  return `EXISTS (
    SELECT 1 FROM pagos_examen pe
     WHERE pe.estado = 'pagado'
       AND (
         pe.estudiante_id = ${aliasAlumno}
         OR EXISTS (
           SELECT 1 FROM pagos_examen_inscripciones pei
             JOIN examenes_inscripciones ei ON ei.id = pei.examen_inscripcion_id
            WHERE pei.pago_examen_id = pe.id
              AND ei.estudiante_id = ${aliasAlumno}
         )
       )
  )`;
}

/**
 * Ids de todos los alumnos con examen pagado, en UNA consulta.
 *
 * Pensado para listados: antes se preguntaba alumno por alumno dentro de un
 * `map`, lo que además de dar la respuesta equivocada hacía una consulta por
 * fila.
 */
export async function idsAlumnosConExamenPagado(): Promise<Set<number>> {
  const { rows } = await pool.query<{ id: number }>(`
    SELECT estudiante_id AS id
      FROM pagos_examen
     WHERE estado = 'pagado' AND estudiante_id IS NOT NULL
    UNION
    SELECT ei.estudiante_id AS id
      FROM pagos_examen pe
      JOIN pagos_examen_inscripciones pei ON pei.pago_examen_id = pe.id
      JOIN examenes_inscripciones ei ON ei.id = pei.examen_inscripcion_id
     WHERE pe.estado = 'pagado'
  `);
  return new Set(rows.map((r) => r.id).filter((id): id is number => id != null));
}
