/**
 * Chequeos de integridad de la base — "si hay un problema, verlo al instante".
 *
 * Cada chequeo es una consulta que cuenta FILAS PROBLEMÁTICAS: 0 = sano.
 * No son métricas de negocio (eso está en Panorama/Académico); son preguntas
 * del tipo "¿hay algo aquí que no debería estar?".
 *
 * Por qué existe: varios bugs de este proyecto fueron silenciosos durante
 * semanas —indicadores leyendo una tabla vacía, folios que dejarían de
 * emitirse si una secuencia queda por debajo de max(id)— y ninguno daba error.
 * Un número que no puede subir no se nota; un chequeo que lo vigila, sí.
 *
 * Para agregar uno: añade una entrada aquí. Si su consulta falla (por ejemplo
 * porque la tabla aún no existe en ese entorno), el chequeo se reporta como
 * `error` y los demás siguen corriendo — nunca tumba el panel.
 */

import { pool } from '@workspace/db';

export type Nivel = 'critico' | 'aviso';

export interface Chequeo {
  clave: string;
  titulo: string;
  nivel: Nivel;
  /** Qué significa que este número sea mayor que cero. */
  significa: string;
  /** Qué hacer al respecto. */
  arreglo: string;
  sql: string;
}

export const CHEQUEOS: Chequeo[] = [
  {
    clave: 'secuencias_atrasadas',
    titulo: 'Secuencias por debajo del último id',
    nivel: 'critico',
    significa:
      'El contador de una tabla quedó por debajo de su id más alto. El próximo alta reutilizará un id y chocará contra la restricción de unicidad.',
    arreglo:
      'Correr lib/db/verificar-secuencias.mjs --reparar. Pasa típicamente después de restaurar un respaldo.',
    sql: `SELECT count(*)::int AS n FROM (
            SELECT s.sequencename,
                   COALESCE(s.last_value, 0) AS lv,
                   (SELECT COALESCE(max(id), 0) FROM pagos_examen) AS m
              FROM pg_sequences s
             WHERE s.schemaname = 'public' AND s.sequencename = 'pagos_examen_id_seq'
          ) t WHERE t.lv < t.m`,
  },
  {
    clave: 'fichas_sin_folio',
    titulo: 'Fichas de pago sin folio',
    nivel: 'critico',
    significa:
      'Una orden de pago viva sin folio no se puede presentar en ventanilla ni conciliar.',
    arreglo:
      'Revisar routes/pagos-examen.ts: el folio se asigna en un UPDATE posterior al INSERT, fuera de transacción, y deja una ventana con folio NULL.',
    sql: `SELECT count(*)::int AS n FROM pagos_examen
           WHERE folio IS NULL AND estado <> 'cancelado'`,
  },
  {
    clave: 'folios_duplicados',
    titulo: 'Folios de pago repetidos',
    nivel: 'critico',
    significa: 'Dos órdenes distintas con el mismo folio: la conciliación deja de ser fiable.',
    arreglo: 'Revisar el generador de folio (utils/folio.ts usa MAX+1 sin lock: tiene carrera).',
    sql: `SELECT count(*)::int AS n FROM (
            SELECT folio FROM pagos_examen WHERE folio IS NOT NULL
             GROUP BY folio HAVING count(*) > 1) t`,
  },
  {
    clave: 'curp_duplicada',
    titulo: 'CURP repetida entre alumnos',
    nivel: 'critico',
    significa: 'Dos expedientes para la misma persona. Rompe la unicidad del alumno.',
    arreglo: 'Fusionar los expedientes desde el panel de administración.',
    sql: `SELECT count(*)::int AS n FROM (
            SELECT curp FROM estudiantes
             WHERE curp IS NOT NULL AND curp <> ''
             GROUP BY curp HAVING count(*) > 1) t`,
  },
  {
    clave: 'credenciales_duplicadas',
    titulo: 'Alumnos con más de una credencial activa',
    nivel: 'critico',
    significa: 'Dos credenciales válidas para la misma persona.',
    arreglo:
      'La base lo impide con un índice único parcial; si aparece, es que el índice se perdió al migrar de entorno.',
    sql: `SELECT count(*)::int AS n FROM (
            SELECT estudiante_id FROM credenciales WHERE estado = 'activa'
             GROUP BY estudiante_id HAVING count(*) > 1) t`,
  },
  {
    clave: 'usuarios_sin_perfil',
    titulo: 'Usuarios activos sin su ficha de rol',
    nivel: 'critico',
    significa:
      'Puede iniciar sesión pero no tiene fila en estudiantes/gestores/administradores: la mayoría de pantallas le fallarán.',
    arreglo: 'Crear la ficha faltante o desactivar la cuenta.',
    sql: `SELECT count(*)::int AS n FROM users u
           WHERE u.activo = true
             AND ((u.rol = 'estudiante' AND NOT EXISTS (SELECT 1 FROM estudiantes e WHERE e.user_id = u.id))
               OR (u.rol = 'gestor'     AND NOT EXISTS (SELECT 1 FROM gestores g WHERE g.user_id = u.id))
               OR (u.rol = 'admin'      AND NOT EXISTS (SELECT 1 FROM administradores a WHERE a.user_id = u.id)))`,
  },
  {
    clave: 'modelos_pago_vivos',
    titulo: 'Dos modelos de pago con datos a la vez',
    nivel: 'aviso',
    significa:
      'La tabla vieja `pagos` volvió a tener filas mientras `pagos_examen` sigue siendo la real. Los indicadores empezarán a contradecirse.',
    arreglo: 'Decidir cuál es el modelo vigente y migrar el otro. Hoy el real es pagos_examen.',
    sql: `SELECT (CASE WHEN (SELECT count(*) FROM pagos) > 0
                        AND (SELECT count(*) FROM pagos_examen) > 0
                       THEN 1 ELSE 0 END)::int AS n`,
  },
  {
    clave: 'fichas_cero_examenes',
    titulo: 'Fichas vivas con 0 exámenes',
    nivel: 'aviso',
    significa: 'Una orden que no cubre ningún examen: cobra sin conceder derecho.',
    arreglo: 'Cancelarlas o corregir cantidad_examenes.',
    sql: `SELECT count(*)::int AS n FROM pagos_examen
           WHERE cantidad_examenes = 0 AND estado <> 'cancelado'`,
  },
  {
    clave: 'alumnos_sin_gestor',
    titulo: 'Alumnos sin gestor asignado',
    nivel: 'aviso',
    significa: 'Nadie los acompaña ni aparece en la carga de ningún gestor.',
    arreglo: 'Asignarles gestor desde el panel de administración.',
    sql: `SELECT count(*)::int AS n FROM estudiantes WHERE gestor_id IS NULL`,
  },
  {
    clave: 'alumnos_sin_municipio',
    titulo: 'Alumnos sin municipio',
    nivel: 'aviso',
    significa: 'Quedan fuera de todos los cortes territoriales y de la asignación de sede.',
    arreglo: 'Completar el municipio en su expediente.',
    sql: `SELECT count(*)::int AS n FROM estudiantes WHERE municipio_id IS NULL`,
  },
  {
    clave: 'correos_atascados',
    titulo: 'Correos pendientes hace más de 24 h',
    nivel: 'aviso',
    significa: 'La cola de envío no está avanzando: los avisos no están llegando.',
    arreglo: 'Revisar credenciales del proveedor de correo y el cron de outbox.',
    sql: `SELECT count(*)::int AS n FROM outbox
           WHERE estado = 'pendiente' AND created_at < now() - interval '24 hours'`,
  },
  {
    clave: 'docs_sin_revisor',
    titulo: 'Documentos aprobados sin revisor',
    nivel: 'aviso',
    significa: 'Se aprobaron sin dejar constancia de quién: hueco de auditoría.',
    arreglo: 'Revisar la ruta que aprueba documentos; debe registrar revisado_por_user_id.',
    sql: `SELECT count(*)::int AS n FROM expediente_documentos
           WHERE estado = 'aprobado' AND revisado_por_user_id IS NULL`,
  },
  {
    clave: 'telemetria_sin_normalizar',
    titulo: 'Telemetría con rutas mal normalizadas',
    nivel: 'aviso',
    significa:
      'Se están guardando claves con :cod donde debería ir el nombre de la sección. La medición de uso pierde sentido.',
    arreglo: 'Revisar normalizarRuta en student-portal/src/lib/uso.ts.',
    sql: `SELECT count(*)::int AS n FROM uso_diario WHERE clave LIKE '%:cod%'`,
  },
];

export interface ResultadoChequeo {
  clave: string;
  titulo: string;
  nivel: Nivel;
  significa: string;
  arreglo: string;
  /** Filas problemáticas. `null` si el chequeo no se pudo ejecutar. */
  hallazgos: number | null;
  error?: string;
}

/** Corre todos los chequeos. Uno que falla no tumba a los demás. */
export async function correrChequeos(): Promise<ResultadoChequeo[]> {
  return Promise.all(
    CHEQUEOS.map(async (c): Promise<ResultadoChequeo> => {
      const base = {
        clave: c.clave,
        titulo: c.titulo,
        nivel: c.nivel,
        significa: c.significa,
        arreglo: c.arreglo,
      };
      try {
        const { rows } = await pool.query<{ n: number }>(c.sql);
        return { ...base, hallazgos: Number(rows[0]?.n ?? 0) };
      } catch (err) {
        return {
          ...base,
          hallazgos: null,
          error: err instanceof Error ? err.message.slice(0, 160) : 'error desconocido',
        };
      }
    })
  );
}
