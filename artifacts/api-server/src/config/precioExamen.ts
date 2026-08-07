/**
 * EL PRECIO DEL EXAMEN — un solo lugar.
 *
 * Antes vivía escrito a mano en 22 sitios (rutas, PDFs, chequeos, semilla,
 * preguntas frecuentes, y otros doce del portal). Cambiarlo obligaba a
 * encontrarlos todos, y bastaba olvidar uno para que la plataforma cobrara un
 * monto y el PDF oficial dijera otro. Aquí es un solo número.
 *
 * ── AGOSTO 2026: LOS $30 DE SYNAPSIS ESTÁN EN PAUSA ─────────────────────────
 *
 * El examen cuesta **$101**, todo para el IEMSyS. La parte de Synapsis quedó
 * en $0 a propósito: el precio ante la Tesorería no se puede modificar hasta
 * el mes que entra, y la plataforma tiene que entrar en operación ya.
 *
 * PARA VOLVER A COBRAR LOS $30, cuando la Tesorería lo permita:
 *
 *   1. Aquí: `PARTE_SYNAPSIS = 30`. El total y el split se recalculan solos.
 *   2. Corre `lib/db/precio-examen.mjs --aplicar` para actualizar el concepto
 *      en la base y el texto de las preguntas frecuentes.
 *   3. Redespliega.
 *
 * Y nada más. No hay que tocar ningún otro archivo — ése es justamente el
 * motivo de que este archivo exista.
 *
 * ── LO QUE NO CAMBIA AL CAMBIAR EL PRECIO ───────────────────────────────────
 *
 * Las fichas YA EMITIDAS conservan el monto con el que nacieron (regla del
 * producto, ver CLAUDE.md). Una línea de captura ya generada tiene ese importe
 * impreso y el banco va a cobrar ése: recalcularla hacia atrás dejaría a la
 * plataforma diciendo un número y al comprobante otro. Ver `precioDeFicha()`
 * en `routes/pagos-examen.ts`.
 */

/** Lo que recibe el IEMSyS por examen. Lo fija la Tesorería del Estado. */
export const PARTE_IEMSYS = 101;

/**
 * Lo que recibe Synapsis por examen. **En pausa desde agosto de 2026** —
 * ver el encabezado de este archivo para reactivarlo.
 */
export const PARTE_SYNAPSIS = 0;

/** Lo que paga el alumno. Es lo ÚNICO que se le muestra; el split es interno. */
export const PRECIO_EXAMEN = PARTE_IEMSYS + PARTE_SYNAPSIS;

/** ¿Se está cobrando la parte de la plataforma? Para avisos en el panel. */
export const SYNAPSIS_EN_PAUSA = PARTE_SYNAPSIS === 0;

/** Los tres montos de una ficha de N exámenes, listos para guardar. */
export function montosDeFicha(cantidad: number): {
  montoTotal: string;
  montoIemsys: string;
  montoSynapsis: string;
} {
  return {
    montoTotal: (cantidad * PRECIO_EXAMEN).toFixed(2),
    montoIemsys: (cantidad * PARTE_IEMSYS).toFixed(2),
    montoSynapsis: (cantidad * PARTE_SYNAPSIS).toFixed(2),
  };
}
