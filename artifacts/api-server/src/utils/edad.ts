/**
 * Validación de edad en el servidor (autoridad final).
 * Prepa Abierta exige al menos 15 años; el tope de 100 evita fechas irreales.
 */

export const EDAD_MIN = 15;
export const EDAD_MAX = 100;

/** Edad en años cumplidos a partir de 'yyyy-MM-dd'. Devuelve NaN si es inválida. */
export function calcularEdad(fechaISO: string): number {
  const f = new Date(fechaISO + 'T00:00:00');
  if (isNaN(f.getTime())) return NaN;
  const hoy = new Date();
  let edad = hoy.getFullYear() - f.getFullYear();
  const m = hoy.getMonth() - f.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < f.getDate())) edad--;
  return edad;
}

/** Mensaje de error si la edad está fuera de rango, o null si es válida. */
export function validarEdad(fechaISO: string | undefined | null): string | null {
  if (!fechaISO) return 'Falta la fecha de nacimiento.';
  const edad = calcularEdad(fechaISO);
  if (isNaN(edad)) return 'Fecha de nacimiento inválida.';
  if (edad < EDAD_MIN) return `El alumno debe tener al menos ${EDAD_MIN} años.`;
  if (edad > EDAD_MAX) return 'La fecha de nacimiento no es válida (edad fuera de rango).';
  return null;
}
