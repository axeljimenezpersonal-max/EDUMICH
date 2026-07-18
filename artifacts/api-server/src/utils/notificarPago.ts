/**
 * Avisos del ciclo de la orden de pago — fuente única.
 *
 * El modelo `pagos_examen` cambiaba de estado once veces sin avisarle a nadie:
 * la coordinación emitía la orden y el alumno no se enteraba; el alumno subía su
 * comprobante y la administración no se enteraba. Aquí vive TODO lo que se avisa
 * en ese ciclo, para que agregar un estado nuevo obligue a decidir a quién le
 * importa.
 *
 * Dos cosas que hay que tener presentes:
 *
 *  1. Una ficha puede ser INDIVIDUAL (`estudianteId`) o GRUPAL (`estudianteId`
 *     nulo y los alumnos colgando de `pagos_examen_inscripciones`). Todo aviso
 *     al alumno resuelve ambos casos vía `destinatariosDePago`.
 *  2. Avisar nunca debe tumbar la operación: `notificar` ya traga sus errores, y
 *     estas funciones se llaman después de que el cambio de estado quedó
 *     guardado. Si el aviso falla, el pago igual avanzó.
 */
import { eq } from 'drizzle-orm';
import { db } from '../db';
import {
  pagosExamen,
  pagosExamenInscripciones,
  examenesInscripciones,
} from '@workspace/db/schema';
import { notificar, notificarATodosLosAdmins } from './notificar';

type Pago = typeof pagosExamen.$inferSelect;

/** A quién le importa esta ficha: sus alumnos y, si la armó un gestor, él. */
export async function destinatariosDePago(
  pago: Pick<Pago, 'id' | 'estudianteId' | 'gestorId'>,
): Promise<{ alumnos: number[]; gestorId: number | null }> {
  if (pago.estudianteId) {
    return { alumnos: [pago.estudianteId], gestorId: pago.gestorId ?? null };
  }

  // Ficha grupal: los alumnos viven en el puente.
  const filas = await db
    .select({ estudianteId: examenesInscripciones.estudianteId })
    .from(pagosExamenInscripciones)
    .innerJoin(
      examenesInscripciones,
      eq(pagosExamenInscripciones.examenInscripcionId, examenesInscripciones.id),
    )
    .where(eq(pagosExamenInscripciones.pagoExamenId, pago.id));

  return {
    alumnos: [...new Set(filas.map((f) => f.estudianteId))],
    gestorId: pago.gestorId ?? null,
  };
}

/** Referencia legible de la ficha para el texto del aviso. */
function ref(pago: Pick<Pago, 'folio' | 'id'>): string {
  return pago.folio ? `Ficha ${pago.folio}` : `Ficha #${pago.id}`;
}

function dinero(monto: string | null | undefined): string {
  const n = Number(monto ?? 0);
  return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Envía el mismo aviso a varios alumnos (y opcionalmente a su gestor). */
async function aTodos(
  userIds: Array<number | null | undefined>,
  datos: { tipo: Parameters<typeof notificar>[0]['tipo']; prioridad: Parameters<typeof notificar>[0]['prioridad']; titulo: string; cuerpo: string; enlace: string },
): Promise<void> {
  const unicos = [...new Set(userIds.filter((u): u is number => typeof u === 'number'))];
  await Promise.all(unicos.map((userId) => notificar({ userId, ...datos })));
}

// ─── Administración ─────────────────────────────────────────────────────────

/** El alumno o el gestor pidió ficha: hay una orden esperando emisión. */
export async function avisarOrdenPorEmitir(pago: Pago): Promise<void> {
  await notificarATodosLosAdmins({
    tipo: 'pago_por_emitir',
    prioridad: 'normal',
    titulo: 'Ficha de pago por emitir',
    cuerpo: `${ref(pago)} — ${pago.cantidadExamenes} examen(es), ${dinero(pago.montoTotal)}. Falta capturar la línea de captura de Tesorería.`,
    enlace: '/admin/ordenes-pago',
  });
}

/** Llegó un comprobante: administración debe verificarlo, y el gestor se entera. */
export async function avisarComprobanteRecibido(pago: Pago): Promise<void> {
  await notificarATodosLosAdmins({
    tipo: 'pago_subido_verificar',
    prioridad: 'alta',
    titulo: 'Comprobante de pago por verificar',
    cuerpo: `${ref(pago)} — se subió un comprobante y está en revisión.`,
    enlace: '/admin/ordenes-pago',
  });

  // `mi_alumno_subio_pago` existía en el modelo pero nunca se disparaba: el
  // gestor administraba sin enterarse de lo que hacían sus alumnos.
  const { gestorId } = await destinatariosDePago(pago);
  if (gestorId) {
    await notificar({
      userId: gestorId,
      tipo: 'mi_alumno_subio_pago',
      prioridad: 'normal',
      titulo: 'Tu alumno subió un comprobante',
      cuerpo: `${ref(pago)} quedó en revisión de la administración.`,
      enlace: '/gestor/pagos',
    });
  }
}

// ─── Alumno (y su gestor) ───────────────────────────────────────────────────

/** La orden ya tiene línea de captura: se puede pagar. */
export async function avisarOrdenEmitida(pago: Pago): Promise<void> {
  const { alumnos, gestorId } = await destinatariosDePago(pago);
  const vence = pago.fechaVencimiento
    ? ` Vence el ${String(pago.fechaVencimiento).slice(0, 10).split('-').reverse().join('/')}.`
    : '';
  await aTodos([...alumnos, gestorId], {
    tipo: 'orden_pago_emitida',
    prioridad: 'alta',
    titulo: 'Tu orden de pago ya está lista',
    cuerpo: `${ref(pago)} — ${dinero(pago.montoTotal)}. Ya puedes pagarla en Tesorería del Estado con tu línea de captura.${vence}`,
    enlace: '/estudiante/pagos',
  });
}

/** Conciliado: el lugar del alumno queda confirmado. */
export async function avisarPagoVerificado(pago: Pago): Promise<void> {
  const { alumnos, gestorId } = await destinatariosDePago(pago);
  await aTodos([...alumnos, gestorId], {
    tipo: 'pago_verificado',
    prioridad: 'alta',
    titulo: 'Pago confirmado',
    cuerpo: `${ref(pago)} quedó pagada y verificada. Tu lugar en el examen está confirmado.`,
    enlace: '/estudiante/pagos',
  });
}

/** El comprobante no procedió: hay que volver a pagar o subir otro. */
export async function avisarPagoRechazado(pago: Pago, motivo: string): Promise<void> {
  const { alumnos, gestorId } = await destinatariosDePago(pago);
  await aTodos([...alumnos, gestorId], {
    tipo: 'pago_rechazado',
    prioridad: 'urgente',
    titulo: 'Tu comprobante no procedió',
    cuerpo: `${ref(pago)} — ${motivo} Puedes subir otro comprobante desde tu sección de Pagos.`,
    enlace: '/estudiante/pagos',
  });
}

/** La orden venció sin pagarse. */
export async function avisarPagoVencido(pago: Pago): Promise<void> {
  const { alumnos, gestorId } = await destinatariosDePago(pago);
  await aTodos([...alumnos, gestorId], {
    tipo: 'pago_vencido',
    prioridad: 'urgente',
    titulo: 'Tu orden de pago venció',
    cuerpo: `${ref(pago)} venció sin registrarse el pago. Solicita una nueva ficha si aún estás a tiempo de la convocatoria.`,
    enlace: '/estudiante/pagos',
  });
}

/** La administración anuló la orden. */
export async function avisarPagoCancelado(pago: Pago): Promise<void> {
  const { alumnos, gestorId } = await destinatariosDePago(pago);
  await aTodos([...alumnos, gestorId], {
    tipo: 'pago_rechazado',
    prioridad: 'alta',
    titulo: 'Tu orden de pago fue cancelada',
    cuerpo: `${ref(pago)} fue anulada por la administración. Tus exámenes quedan libres para solicitarse de nuevo.`,
    enlace: '/estudiante/pagos',
  });
}

export type { Pago };
