/**
 * Fechas del calendario escolar — cálculo correcto en horario de Michoacán.
 *
 * Las fechas de convocatoria (`solicitud_inicio`, `examen_sabado`…) son días de
 * calendario, sin hora: en la BD viven como `date` y llegan como 'YYYY-MM-DD'.
 * Compararlas con `new Date()` a secas produce errores de un día, porque:
 *
 *  - `new Date('2026-08-31')` se interpreta como medianoche **UTC**, no local;
 *  - `new Date().toISOString()` devuelve el día **UTC**, así que en México a
 *    partir de las 18:00 ya reporta el día siguiente.
 *
 * Eso hacía que «faltan N días» pudiera mentir justo cuando más importa: el día
 * del cierre. Aquí el día de hoy se obtiene en America/Mexico_City y la resta se
 * hace entre días de calendario, no entre instantes.
 *
 * Equivale a la regla que el frontend ya sigue en `lib/fechas.ts`.
 */

const ZONA = 'America/Mexico_City';

/** Hoy en Michoacán, como 'YYYY-MM-DD'. */
export function hoyEnMexico(): string {
  // 'en-CA' formatea como YYYY-MM-DD, que es justo lo que necesitamos.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Convierte 'YYYY-MM-DD' a un instante fijo (mediodía UTC) para restar días sin sustos de horario de verano. */
function aDia(iso: string): number {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(a, (m ?? 1) - 1, d ?? 1, 12, 0, 0);
}

/**
 * Días completos de calendario entre dos fechas ('YYYY-MM-DD').
 * Positivo si `hasta` es posterior. Mismo día = 0.
 */
export function diasEntre(desdeISO: string, hastaISO: string): number {
  return Math.round((aDia(hastaISO) - aDia(desdeISO)) / 86400000);
}

/** Días que faltan desde hoy (Michoacán) hasta esa fecha. Negativo si ya pasó. */
export function diasDesdeHoy(hastaISO: string): number {
  return diasEntre(hoyEnMexico(), hastaISO);
}
