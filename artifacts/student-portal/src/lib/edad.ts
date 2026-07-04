/**
 * Reglas de edad para la fecha de nacimiento.
 * Prepa Abierta exige al menos 15 años; el tope de 100 evita fechas irreales.
 */

export const EDAD_MIN = 15;
export const EDAD_MAX = 100;

/** Fecha de nacimiento más reciente permitida (hoy − EDAD_MIN años). */
export function fechaMaxNacimiento(): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - EDAD_MIN);
  return d;
}

/** Fecha de nacimiento más antigua permitida (hoy − EDAD_MAX años). */
export function fechaMinNacimiento(): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - EDAD_MAX);
  return d;
}

/** Edad en años cumplidos a partir de una fecha de nacimiento. */
export function calcularEdad(fecha: Date): number {
  const hoy = new Date();
  let edad = hoy.getFullYear() - fecha.getFullYear();
  const m = hoy.getMonth() - fecha.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < fecha.getDate())) edad--;
  return edad;
}

/** Devuelve un mensaje de error si la edad está fuera de rango, o null si es válida. */
export function validarEdad(fecha: Date | undefined): string | null {
  if (!fecha) return 'Selecciona tu fecha de nacimiento.';
  const edad = calcularEdad(fecha);
  if (edad < EDAD_MIN) return `Debes tener al menos ${EDAD_MIN} años para inscribirte.`;
  if (edad > EDAD_MAX) return 'Verifica tu fecha de nacimiento: la edad no es válida.';
  return null;
}
