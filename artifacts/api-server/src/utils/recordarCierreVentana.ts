/**
 * Recordatorio de cierre de ventana — el último aviso antes de perder el lugar.
 *
 * `convocatoria_proxima` existía en el modelo y nunca se disparaba: una orden de
 * pago podía vencer sin que el alumno recibiera un solo recordatorio, y se
 * enteraba cuando ya no había nada que hacer.
 *
 * ALCANCE DELIBERADAMENTE ACOTADO: solo se avisa a quien **ya tiene una orden de
 * pago sin pagar** para la etapa que está por cerrar. Es decir, a quien ya
 * empezó el trámite y tiene algo concreto que perder.
 *
 * NO se avisa masivamente a "todos los que aún no se inscriben": ese conjunto es
 * enorme, el mensaje sería genérico y convertiría el aviso en ruido que la gente
 * aprende a ignorar. Si se decide hacerlo, debe ser una decisión explícita.
 *
 * Se dispara SOLO en dos cortes (faltando 3 días y faltando 1), así que cada
 * alumno recibe cuando mucho dos recordatorios por convocatoria.
 */
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { notificar } from './notificar';
import { hoyEnMexico, diasEntre } from './fechas';

/** Días antes del cierre en que se recuerda. */
const CORTES = [3, 1];

export async function recordarCierreDeVentana(): Promise<number> {
  const hoy = hoyEnMexico();

  // Etapas abiertas cuyo cierre cae justo en uno de los cortes.
  const etapas = await db.execute<{ id: number; clave: string; solicitud_fin: string }>(sql`
    SELECT id, clave, solicitud_fin::text AS solicitud_fin
    FROM convocatorias_etapas
    WHERE estado = 'inscripcion_abierta'
  `);

  let enviados = 0;

  for (const etapa of etapas.rows) {
    const faltan = diasEntre(hoy, String(etapa.solicitud_fin));
    if (!CORTES.includes(faltan)) continue;

    // Alumnos con orden de pago viva (sin pagar) en esta etapa. `en_revision` se
    // excluye a propósito: ya subieron comprobante y les toca esperar, no correr.
    const pendientes = await db.execute<{ estudiante_id: number; folio: string | null }>(sql`
      SELECT DISTINCT ei.estudiante_id, pe.folio
      FROM pagos_examen pe
      JOIN pagos_examen_inscripciones pei ON pei.pago_examen_id = pe.id
      JOIN examenes_inscripciones ei ON ei.id = pei.examen_inscripcion_id
      WHERE pe.etapa_id = ${etapa.id}
        AND pe.estado IN ('pendiente_emision', 'emitida')
    `);

    for (const p of pendientes.rows) {
      const dias = faltan === 1 ? 'mañana' : `en ${faltan} días`;
      await notificar({
        userId: Number(p.estudiante_id),
        tipo: 'convocatoria_proxima',
        prioridad: faltan === 1 ? 'urgente' : 'alta',
        titulo: faltan === 1 ? 'Último día para pagar tu examen' : 'Tu convocatoria está por cerrar',
        cuerpo: `La convocatoria ${etapa.clave} cierra ${dias}. Si no se registra tu pago antes del cierre, pierdes tu lugar en el examen.`,
        enlace: '/estudiante/pagos',
      });
      enviados++;
    }
  }

  return enviados;
}
