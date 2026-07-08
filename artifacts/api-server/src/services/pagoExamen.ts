/**
 * Máquina de estados del "pago de examen" (orden de pago vía Tesorería del Estado).
 *
 * REGLA DE ORO: EDUMICH no cobra ni genera líneas de captura. El estado 'pagado'
 * SOLO se alcanza por conciliación / verificación de un admin — nunca de forma
 * automática porque el alumno subió un comprobante.
 *
 * Transiciones válidas:
 *   pendiente_emision → emitida           (admin carga línea de captura + orden)
 *   emitida           → en_revision       (alumno sube comprobante — ruta interina)
 *   emitida           → pagado            (admin concilia contra la plataforma del Estado)
 *   en_revision       → pagado            (admin verifica el comprobante)
 *   en_revision       → emitida           (admin rechaza el comprobante, vuelve a esperar pago)
 *   emitida           → vencido           (scheduler: pasó el vencimiento)
 *   en_revision       → vencido           (scheduler)
 *   *                 → cancelado         (solo admin)
 */

export type PagoExamenEstado =
  | 'pendiente_emision'
  | 'emitida'
  | 'en_revision'
  | 'pagado'
  | 'vencido'
  | 'cancelado';

const TRANSICIONES: Record<PagoExamenEstado, PagoExamenEstado[]> = {
  pendiente_emision: ['emitida', 'cancelado'],
  emitida: ['en_revision', 'pagado', 'vencido', 'cancelado'],
  // 'en_revision' → 'en_revision': el alumno/gestor puede REEMPLAZAR su
  // comprobante mientras sigue en revisión (subió uno equivocado).
  en_revision: ['en_revision', 'pagado', 'emitida', 'vencido', 'cancelado'],
  pagado: [], // estado terminal
  vencido: ['emitida', 'cancelado'], // el Estado puede reemitir
  cancelado: [], // estado terminal
};

export function transicionValida(from: PagoExamenEstado, to: PagoExamenEstado): boolean {
  return TRANSICIONES[from]?.includes(to) ?? false;
}

/** Lanza si la transición es ilegal. Usar en el servicio, no solo en la UI. */
export function assertTransicion(from: PagoExamenEstado, to: PagoExamenEstado): void {
  if (!transicionValida(from, to)) {
    throw new Error(`Transición de pago inválida: ${from} → ${to}`);
  }
}

export const ESTADO_LABEL: Record<PagoExamenEstado, string> = {
  pendiente_emision: 'Pendiente de emisión',
  emitida: 'Orden emitida — por pagar',
  en_revision: 'Comprobante en revisión',
  pagado: 'Pagado',
  vencido: 'Vencido',
  cancelado: 'Cancelado',
};
