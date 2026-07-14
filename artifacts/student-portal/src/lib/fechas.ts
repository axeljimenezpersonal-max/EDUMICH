/**
 * Fechas de la BD → hora de Michoacán, SIEMPRE.
 *
 * El servidor guarda timestamps en UTC sin zona horaria (defaultNow() en
 * Railway corre en UTC). Cuando llegan por SQL crudo (`::text`) vienen como
 * "2026-07-14 05:49:00.123" SIN zona — si se parsean con `new Date()` el
 * navegador los toma como hora local y todo se corre 6 horas.
 *
 * Regla: TODO tiempo que venga de la API se parsea con `parseDbDate` y se
 * formatea con los helpers de aquí (fijados a America/Mexico_City).
 */
const TZ = 'America/Mexico_City';

const SOLO_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const TIENE_ZONA = /(?:[zZ]|[+-]\d{2}:?\d{2})$/;

/** Interpreta correctamente un timestamp de la BD (UTC sin zona) o una fecha pura. */
export function parseDbDate(s: string): Date {
  if (SOLO_FECHA.test(s)) return new Date(`${s}T12:00:00`); // fecha pura → mediodía local (sin corrimiento de día)
  if (TIENE_ZONA.test(s)) return new Date(s);               // ISO con zona (Date de drizzle) → correcto tal cual
  return new Date(`${s.replace(' ', 'T')}Z`);               // timestamp UTC sin zona → marcar como UTC
}

// Timestamps a medianoche UTC vienen de inputs de FECHA pura (p. ej. fecha de
// entrega "2026-07-28" → "2026-07-28 00:00:00"): se muestran como ese día
// calendario, sin corrimiento de zona.
const MEDIANOCHE_UTC = /^(\d{4}-\d{2}-\d{2})[T ]00:00:00(?:\.0+)?(?:[zZ])?$/;
function parteFechaPura(s: string): string | null {
  if (SOLO_FECHA.test(s)) return s;
  const m = MEDIANOCHE_UTC.exec(s);
  return m ? m[1] : null;
}

/** "13 jul 2026" */
export function fechaCorta(s: string | null | undefined): string {
  if (!s) return '';
  const puro = parteFechaPura(s);
  if (puro) return new Date(`${puro}T12:00:00`).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  return parseDbDate(s).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ });
}

/** ¿Ya venció esta fecha de entrega? Vence al TERMINAR ese día calendario. */
export function vencioFecha(s: string): boolean {
  const puro = parteFechaPura(s);
  if (puro) return new Date(`${puro}T23:59:59`).getTime() < Date.now();
  return parseDbDate(s).getTime() < Date.now();
}

/** "13/07/26, 10:16 p.m." */
export function fechaHoraCorta(s: string | null | undefined): string {
  if (!s) return '';
  return parseDbDate(s).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short', timeZone: TZ });
}

/** "10:16 p.m." */
export function horaCorta(s: string | null | undefined): string {
  if (!s) return '';
  return parseDbDate(s).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
}

/** "lunes, 13 de julio" — para separadores de día en chats. */
export function diaLargo(s: string | null | undefined): string {
  if (!s) return '';
  return parseDbDate(s).toLocaleDateString('es-MX', { weekday: 'long', day: '2-digit', month: 'long', timeZone: TZ });
}
