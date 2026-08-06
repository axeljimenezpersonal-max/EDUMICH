/**
 * Recordatorio de examen, la víspera.
 *
 * Es el primer correo del sistema que sale **porque llegó una fecha** y no
 * porque alguien apretó un botón. Todo lo demás es reacción a un trámite; esto
 * es el sistema acordándose por su cuenta.
 *
 * Manda dos correos distintos, no el mismo dos veces:
 *
 *  · Al ALUMNO  — a dónde va: módulo, hora, sede y dirección.
 *  · Al CENTRO  — a quién le toca: la lista de sus alumnos, ordenada por hora,
 *                 para poder llamar hoy a quien no ha confirmado.
 *
 * ── Tres cosas que lo hacen seguro de correr ────────────────────────────────
 *
 * 1. IDEMPOTENTE. Cada aviso deja su huella en `recordatorios_enviados` con
 *    clave única. Puede correr de más, reintentarse o solaparse: nadie recibe
 *    el mismo recordatorio dos veces. Un aviso repetido no es un detalle
 *    cosmético — al tercer correo idéntico la gente deja de abrirlos.
 *
 * 2. CON CANDADO. Mismo mecanismo que la depuración de las 3 AM: con más de una
 *    instancia, este trabajo correría N veces.
 *
 * 3. NO CONTRADICE EL DOCUMENTO OFICIAL. Filtra por `estado <> 'cancelado'`,
 *    exactamente el mismo criterio que la Relación de exámenes que se entrega
 *    a la DGB. Inventar aquí un filtro propio significaría avisarle a alguien
 *    que no está en la lista, o callarle a alguien que sí.
 */
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { sendEmail } from './email';
import { recordatorioExamenAlumnoTemplate, type ExamenDeManana } from './templates/recordatorio-examen-alumno';
import { recordatorioExamenCentroTemplate, type AlumnoDeManana } from './templates/recordatorio-examen-centro';
import { notificar } from '../utils/notificar';
import { alertar } from './alertas';
import { hoyEnMexico } from '../utils/fechas';

/** "sábado 22 de agosto", en hora de Michoacán. */
function fechaLarga(iso: string): string {
  // Mediodía para que el cambio de zona no corra el día calendario.
  // Sin la coma que mete el formateador: "sábado 22 de agosto", no
  // "sábado, 22 de agosto". Igual que `fechaLarga` del portal.
  return new Date(`${iso}T12:00:00`).toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Mexico_City',
  }).replace(',', '');
}

/** El día siguiente a hoy en Michoacán, como YYYY-MM-DD. */
function mananaEnMexico(): string {
  const [a, m, d] = hoyEnMexico().split('-').map(Number);
  const t = new Date(Date.UTC(a, m - 1, d));
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
}

interface FilaExamen extends Record<string, unknown> {
  inscripcion_id: number;
  estudiante_id: number;
  alumno: string;
  modulo: string;
  hora: string;
  sede: string;
  direccion: string;
  gestor_id: number | null;
  gestor_nombre: string | null;
}

/**
 * ¿Ya se avisó de esto? Reserva la clave y devuelve si le tocaba a esta
 * corrida mandarlo. El `ON CONFLICT DO NOTHING` es lo que hace la reserva
 * atómica: si dos corridas coinciden, solo una consigue insertar.
 */
async function reservar(tipo: string, clave: string, userId: number | null): Promise<boolean> {
  const { rows } = await db.execute(sql`
    INSERT INTO recordatorios_enviados (tipo, clave, user_id)
    VALUES (${tipo}, ${clave}, ${userId})
    ON CONFLICT (tipo, clave) DO NOTHING
    RETURNING id`);
  return rows.length > 0;
}

export async function recordarExamenesDeManana(
  opciones: { ensayo?: boolean } = {},
): Promise<{ manana: string; alumnos: number; centros: number; ensayo: boolean }> {
  const ensayo = opciones.ensayo === true;
  const manana = mananaEnMexico();
  const hoy = hoyEnMexico();

  // Candado + una sola corrida al día, igual que la depuración. Ver
  // services/depuracion.ts para el porqué de las dos condiciones.
  if (!ensayo) {
    const lock = await db.execute(sql`
      INSERT INTO job_locks (nombre, bloqueado_hasta, ultimo_inicio_en, ejecuciones)
      VALUES ('recordatorios_examen', now() + interval '1 hour', now(), 1)
      ON CONFLICT (nombre) DO UPDATE
        SET bloqueado_hasta = now() + interval '1 hour',
            ultimo_inicio_en = now(),
            ejecuciones = job_locks.ejecuciones + 1
      WHERE job_locks.bloqueado_hasta < now()
        AND (job_locks.ultimo_dia_corrido IS NULL OR job_locks.ultimo_dia_corrido <> ${hoy})
      RETURNING nombre`);
    if (lock.rows.length === 0) {
      console.log('[RECORDATORIOS] Otra instancia lo tiene, o ya corrió hoy. Se salta.');
      return { manana, alumnos: 0, centros: 0, ensayo };
    }
  }

  let alumnosAvisados = 0;
  let centrosAvisados = 0;

  try {
    // La fecha del examen sale de la etapa según el día que le tocó al módulo:
    // el sábado y el domingo son fechas distintas de la misma etapa.
    const { rows } = await db.execute<FilaExamen>(sql`
      SELECT ei.id           AS inscripcion_id,
             ei.estudiante_id,
             e.nombre_completo AS alumno,
             m.nombre        AS modulo,
             h.hora,
             s.nombre        AS sede,
             s.direccion,
             g.user_id       AS gestor_id,
             g.nombre_completo AS gestor_nombre
        FROM examenes_inscripciones ei
        JOIN convocatorias_etapas ce ON ce.id = ei.etapa_id
        JOIN convocatorias_modulos_horarios h ON h.id = ei.horario_id
        JOIN modulos m ON m.id = ei.modulo_id
        JOIN estudiantes e ON e.user_id = ei.estudiante_id
        LEFT JOIN sedes s ON s.id = ei.sede_id
        LEFT JOIN gestores g ON g.user_id = e.gestor_id
       WHERE ei.estado <> 'cancelado'
         -- Las etapas de ENSAYO quedan fuera. Se crean para poder MIRAR la
         -- pantalla del examen con datos (ver lib/db/ensayo-examen.mjs), y la
         -- víspera cae dentro de la vida de esos datos: sin este filtro, un
         -- ensayo mandaría correos de verdad, a gente de verdad, sobre un
         -- examen que no existe. El candado vive aquí y no en el script porque
         -- no puede depender de que alguien se acuerde de borrar a tiempo.
         AND ce.clave NOT LIKE 'ENSAYO%'
         AND (CASE WHEN h.dia = 'sabado' THEN ce.examen_sabado ELSE ce.examen_domingo END) = ${manana}::date
       ORDER BY h.hora ASC, e.nombre_completo ASC`);

    console.log(`[RECORDATORIOS] ${manana}: ${rows.length} inscripción(es) que presentan mañana.`);
    if (rows.length === 0) return { manana, alumnos: 0, centros: 0, ensayo };

    const dia = fechaLarga(manana);

    // ── Al alumno: UN correo por persona, con todos sus módulos de mañana.
    // Un alumno puede llevar hasta 4: mandarle cuatro correos sería castigarlo
    // por inscribirse a más.
    const porAlumno = new Map<number, { nombre: string; examenes: ExamenDeManana[] }>();
    for (const r of rows) {
      const actual = porAlumno.get(r.estudiante_id) ?? { nombre: r.alumno, examenes: [] };
      actual.examenes.push({
        modulo: r.modulo,
        hora: r.hora,
        sede: r.sede ?? 'Por confirmar con tu centro',
        direccion: r.direccion ?? '',
      });
      porAlumno.set(r.estudiante_id, actual);
    }

    for (const [userId, info] of porAlumno) {
      const clave = `alumno:${userId}:${manana}`;
      if (ensayo) { alumnosAvisados += 1; continue; }
      if (!(await reservar('examen_manana', clave, userId))) continue;

      const { subject, html, textPlain } = recordatorioExamenAlumnoTemplate({
        nombre: info.nombre, fechaLarga: dia, examenes: info.examenes,
      });
      // Un envío que falla no puede tumbar los demás: cada persona va aparte.
      try {
        const [u] = await db.execute<{ email: string }>(
          sql`SELECT email FROM users WHERE id = ${userId}`).then((r) => r.rows);
        if (u?.email) {
          await sendEmail({ to: u.email, toName: info.nombre, subject, html, textPlain,
            evento: 'recordatorio_examen', relatedUserId: userId, metadata: { fecha: manana } });
        }
      } catch (e) {
        console.error('[RECORDATORIOS] alumno', userId, e);
      }
      // Y dentro de la plataforma, para quien entre al portal sin abrir su correo.
      await notificar({
        userId,
        tipo: 'recordatorio_examen',
        prioridad: 'alta',
        titulo: info.examenes.length > 1 ? 'Mañana presentas tus exámenes' : 'Mañana es tu examen',
        cuerpo: info.examenes.map((x) => `${x.modulo} · ${x.hora} · ${x.sede}`).join(' | '),
        enlace: '/estudiante/convocatoria',
      });
      alumnosAvisados += 1;
    }

    // ── Al centro: UN correo con su lista, ordenada por hora.
    const porCentro = new Map<number, { nombre: string; alumnos: AlumnoDeManana[] }>();
    for (const r of rows) {
      if (!r.gestor_id) continue; // alumno sin centro asignado
      const actual = porCentro.get(r.gestor_id) ?? { nombre: r.gestor_nombre ?? 'Tu centro', alumnos: [] };
      actual.alumnos.push({
        nombre: r.alumno, modulo: r.modulo, hora: r.hora, sede: r.sede ?? 'Por confirmar',
      });
      porCentro.set(r.gestor_id, actual);
    }

    for (const [gestorId, info] of porCentro) {
      const clave = `centro:${gestorId}:${manana}`;
      if (ensayo) { centrosAvisados += 1; continue; }
      if (!(await reservar('examen_manana_centro', clave, gestorId))) continue;

      const { subject, html, textPlain } = recordatorioExamenCentroTemplate({
        nombreCentro: info.nombre, fechaLarga: dia, alumnos: info.alumnos,
      });
      try {
        const [u] = await db.execute<{ email: string }>(
          sql`SELECT email FROM users WHERE id = ${gestorId}`).then((r) => r.rows);
        if (u?.email) {
          await sendEmail({ to: u.email, toName: info.nombre, subject, html, textPlain,
            evento: 'recordatorio_examen', relatedUserId: gestorId, metadata: { fecha: manana, alumnos: info.alumnos.length } });
        }
      } catch (e) {
        console.error('[RECORDATORIOS] centro', gestorId, e);
      }
      await notificar({
        userId: gestorId,
        tipo: 'recordatorio_examen',
        prioridad: 'alta',
        titulo: `Mañana presentan ${info.alumnos.length} de tus alumnos`,
        cuerpo: `${dia}. Si alguno no te ha confirmado, hoy es el día de llamarle.`,
        enlace: '/gestor/inscripcion',
      });
      centrosAvisados += 1;
    }

    if (!ensayo) {
      await db.execute(sql`
        UPDATE job_locks
           SET bloqueado_hasta = now(), ultimo_fin_en = now(), ultimo_exito_en = now(),
               ultimo_error = NULL, ultimo_dia_corrido = ${hoy}
         WHERE nombre = 'recordatorios_examen'`).catch(() => {});
    }

    console.log(`[RECORDATORIOS] ${alumnosAvisados} alumno(s) y ${centrosAvisados} centro(s) avisados.`);
    return { manana, alumnos: alumnosAvisados, centros: centrosAvisados, ensayo };
  } catch (e) {
    // Suelta el candado y deja el motivo: si no, el trabajo queda trabado hasta
    // que venza el arrendamiento y nadie sabe por qué no salieron los avisos.
    if (!ensayo) {
      await db.execute(sql`
        UPDATE job_locks
           SET bloqueado_hasta = now(), ultimo_fin_en = now(),
               ultimo_error = ${e instanceof Error ? e.message : String(e)}
         WHERE nombre = 'recordatorios_examen'`).catch(() => {});
      await alertar({
        clave: 'recordatorios:fallo',
        titulo: 'Falló el recordatorio de examen',
        detalle: `${e instanceof Error ? e.message : String(e)}. Los alumnos que presentan el ${manana} pueden no haber recibido su aviso.`,
        gravedad: 'critica',
      });
    }
    throw e;
  }
}
