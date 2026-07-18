/**
 * Instantáneas diarias de métricas.
 *
 * EL PROBLEMA QUE RESUELVE: todos los indicadores de la plataforma se calculan
 * del estado ACTUAL. Se puede saber cuántos alumnos se dieron de alta en mayo
 * (por `created_at`), pero NO cuántos tenían el expediente completo en mayo:
 * ese dato se sobrescribe cada vez que alguien aprueba un documento. Sin una
 * foto diaria, la historia no existe — y a diferencia de casi todo lo demás,
 * **no se puede reconstruir hacia atrás**. Cada día sin esto es un día perdido
 * para siempre.
 *
 * CÓMO FUNCIONA: una vez al día se guarda un número por métrica en
 * `metricas_diarias (dia, clave, valor)`. Es idempotente: correrlo dos veces
 * el mismo día actualiza, no duplica. Si el servidor estuvo caído, la próxima
 * corrida rellena los días faltantes de las métricas reconstruibles.
 *
 * DOS FAMILIAS DE MÉTRICA, y la diferencia importa:
 *
 *  - `acumulada`: se deduce de una fecha de creación ("cuántos alumnos había
 *    al final del día X"). Se puede RELLENAR HACIA ATRÁS, y por eso el
 *    histórico arranca con datos desde el primer registro del sistema.
 *  - `estado`: es una foto del momento ("cuántos tienen expediente completo
 *    hoy"). NO se puede reconstruir; empieza a existir el día que se instala
 *    esto. Se marca como tal para que nadie confunda un hueco con un cero.
 */

import { pool } from '@workspace/db';
import { hoyEnMexico } from '../utils/fechas';

export type Familia = 'acumulada' | 'estado';

export interface Metrica {
  clave: string;
  titulo: string;
  familia: Familia;
  /** Valor de HOY. Se usa siempre. */
  sqlHoy: string;
  /**
   * Solo para `acumulada`: valor al final de un día cualquiera, con `$1` = día.
   * Permite rellenar el histórico desde el primer registro.
   */
  sqlAlDia?: string;
}

export const METRICAS: Metrica[] = [
  {
    clave: 'alumnos_total',
    titulo: 'Alumnos registrados',
    familia: 'acumulada',
    sqlHoy: `SELECT count(*)::float AS v FROM estudiantes`,
    sqlAlDia: `SELECT count(*)::float AS v FROM estudiantes WHERE created_at::date <= $1`,
  },
  {
    clave: 'solicitudes_total',
    titulo: 'Solicitudes de cuenta',
    familia: 'acumulada',
    sqlHoy: `SELECT count(*)::float AS v FROM solicitudes_cuenta`,
    sqlAlDia: `SELECT count(*)::float AS v FROM solicitudes_cuenta WHERE created_at::date <= $1`,
  },
  {
    clave: 'examenes_pagados',
    titulo: 'Exámenes pagados',
    familia: 'acumulada',
    sqlHoy: `SELECT COALESCE(sum(cantidad_examenes), 0)::float AS v
               FROM pagos_examen WHERE estado = 'pagado'`,
    // Ojo: usa el estado ACTUAL de la ficha, así que reconstruye "exámenes que
    // hoy sabemos pagados, creados hasta ese día". Es una aproximación honesta:
    // no sabemos en qué momento exacto se conciliaron los pagos viejos.
    sqlAlDia: `SELECT COALESCE(sum(cantidad_examenes), 0)::float AS v
                 FROM pagos_examen WHERE estado = 'pagado' AND created_at::date <= $1`,
  },
  {
    clave: 'ingreso_synapsis',
    titulo: 'Ingreso Synapsis',
    familia: 'acumulada',
    // Recalculado a partir de los exámenes, no de la columna guardada: hay
    // fichas heredadas con el desglose mal grabado. Ver el chequeo
    // `split_no_cuadra` en utils/chequeosIntegridad.ts.
    sqlHoy: `SELECT COALESCE(sum(cantidad_examenes), 0)::float * 30 AS v
               FROM pagos_examen WHERE estado = 'pagado'`,
    sqlAlDia: `SELECT COALESCE(sum(cantidad_examenes), 0)::float * 30 AS v
                 FROM pagos_examen WHERE estado = 'pagado' AND created_at::date <= $1`,
  },
  {
    clave: 'calificaciones_total',
    titulo: 'Calificaciones capturadas',
    familia: 'acumulada',
    sqlHoy: `SELECT count(*)::float AS v FROM calificaciones`,
    sqlAlDia: `SELECT count(*)::float AS v FROM calificaciones WHERE created_at::date <= $1`,
  },
  {
    clave: 'expediente_completo',
    titulo: 'Alumnos con expediente completo',
    familia: 'estado',
    sqlHoy: `SELECT count(*)::float AS v FROM (
               SELECT estudiante_id FROM expediente_documentos
                WHERE estado = 'aprobado'
                  AND tipo IN ('curp','acta_nacimiento','ine','comprobante_domicilio','certificado_secundaria')
                GROUP BY estudiante_id HAVING count(DISTINCT tipo) = 5) t`,
  },
  {
    clave: 'docs_por_revisar',
    titulo: 'Documentos esperando revisión',
    familia: 'estado',
    sqlHoy: `SELECT count(*)::float AS v FROM expediente_documentos
              WHERE estado = 'pendiente_revision'`,
  },
  {
    clave: 'gestores_activos',
    titulo: 'Gestores activos',
    familia: 'estado',
    sqlHoy: `SELECT count(*)::float AS v FROM gestores WHERE estado = 'activo'`,
  },
  {
    clave: 'municipios_cubiertos',
    titulo: 'Municipios con alumnos',
    familia: 'estado',
    sqlHoy: `SELECT count(DISTINCT municipio_id)::float AS v
               FROM estudiantes WHERE municipio_id IS NOT NULL`,
  },
  {
    clave: 'credenciales_activas',
    titulo: 'Credenciales activas',
    familia: 'estado',
    sqlHoy: `SELECT count(*)::float AS v FROM credenciales WHERE estado = 'activa'`,
  },
  {
    clave: 'tasa_aprobacion',
    titulo: 'Aprobación acumulada (%)',
    familia: 'estado',
    sqlHoy: `SELECT COALESCE(round(
               100.0 * count(*) FILTER (WHERE calificacion >= 60) / NULLIF(count(*), 0), 1
             ), 0)::float AS v
               FROM calificaciones WHERE calificacion IS NOT NULL`,
  },
];

async function guardar(dia: string, clave: string, valor: number): Promise<void> {
  await pool.query(
    `INSERT INTO metricas_diarias (dia, clave, valor)
     VALUES ($1, $2, $3)
     ON CONFLICT (dia, clave)
     DO UPDATE SET valor = EXCLUDED.valor, actualizado_en = now()`,
    [dia, clave, valor]
  );
}

/** Toma la foto de hoy. Idempotente. */
export async function tomarInstantanea(dia = hoyEnMexico()): Promise<number> {
  let guardadas = 0;
  for (const m of METRICAS) {
    try {
      const { rows } = await pool.query<{ v: number }>(m.sqlHoy);
      await guardar(dia, m.clave, Number(rows[0]?.v ?? 0));
      guardadas++;
    } catch (err) {
      // Una métrica rota no debe impedir que se guarden las demás: perder
      // un número es molesto, perder el día entero es irreparable.
      console.warn(`[metricas] falló "${m.clave}":`, err);
    }
  }
  return guardadas;
}

/**
 * Rellena el histórico de las métricas reconstruibles desde el primer registro
 * del sistema. Solo escribe días que falten, así que se puede correr las veces
 * que sea. Las métricas de familia `estado` no se tocan: inventarles un pasado
 * sería peor que no tenerlo.
 */
export async function rellenarHistorico(): Promise<number> {
  const { rows: r } = await pool.query<{ desde: string | null }>(
    `SELECT min(d)::text AS desde FROM (
       SELECT min(created_at)::date AS d FROM estudiantes
       UNION ALL SELECT min(created_at)::date FROM pagos_examen
       UNION ALL SELECT min(created_at)::date FROM solicitudes_cuenta) t`
  );
  const desde = r[0]?.desde;
  if (!desde) return 0;

  const acumuladas = METRICAS.filter((m) => m.familia === 'acumulada' && m.sqlAlDia);
  const { rows: dias } = await pool.query<{ dia: string }>(
    `SELECT generate_series($1::date, CURRENT_DATE, '1 day')::date::text AS dia`,
    [desde]
  );

  let escritos = 0;
  for (const { dia } of dias) {
    for (const m of acumuladas) {
      const { rows: ya } = await pool.query(
        `SELECT 1 FROM metricas_diarias WHERE dia = $1 AND clave = $2`, [dia, m.clave]
      );
      if (ya.length > 0) continue;
      try {
        const { rows } = await pool.query<{ v: number }>(m.sqlAlDia!, [dia]);
        await guardar(dia, m.clave, Number(rows[0]?.v ?? 0));
        escritos++;
      } catch (err) {
        console.warn(`[metricas] relleno falló "${m.clave}" en ${dia}:`, err);
      }
    }
  }
  return escritos;
}

/** Serie de una o varias métricas para el tablero. */
export async function serie(claves: string[], dias: number) {
  const { rows } = await pool.query(
    `SELECT dia::text AS dia, clave, valor::float AS valor
       FROM metricas_diarias
      WHERE clave = ANY($1) AND dia >= CURRENT_DATE - ($2::int - 1)
      ORDER BY dia, clave`,
    [claves, dias]
  );
  return rows as Array<{ dia: string; clave: string; valor: number }>;
}
