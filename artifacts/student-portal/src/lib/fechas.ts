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

/**
 * "22 ago" — día y mes abreviado, sin año.
 * Para tarjetas y fichas donde el año se dice aparte (o se sobreentiende).
 */
export function diaMesCorto(s: string | null | undefined): string {
  if (!s) return '';
  const puro = parteFechaPura(s);
  const d = puro ? new Date(`${puro}T12:00:00`) : parseDbDate(s);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (!puro) opts.timeZone = TZ;
  // Algunas versiones de ICU devuelven "22 ago." — el punto sobra en una tarjeta.
  return d.toLocaleDateString('es-MX', opts).replace('.', '');
}

/**
 * "sáb" — día de la semana abreviado.
 * Se DERIVA de la fecha: nunca se escribe a mano el día de la semana, porque el
 * calendario de la DGB puede mover una aplicación y el texto quedaría mintiendo.
 */
export function diaSemanaCorto(s: string | null | undefined): string {
  if (!s) return '';
  const puro = parteFechaPura(s);
  const d = puro ? new Date(`${puro}T12:00:00`) : parseDbDate(s);
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short' };
  if (!puro) opts.timeZone = TZ;
  return d.toLocaleDateString('es-MX', opts).replace('.', '');
}

/** El año de una fecha, ya en hora de Michoacán ("2026"). */
export function anioDe(s: string | null | undefined): string {
  if (!s) return '';
  const puro = parteFechaPura(s);
  if (puro) return puro.slice(0, 4);
  return parseDbDate(s).toLocaleDateString('en-CA', { timeZone: TZ }).slice(0, 4);
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

/**
 * Las piezas de una fecha, ya en hora de Michoacán, para armar textos a la
 * medida: `{ diaSemana: 'lunes', dia: '27', mes: 'julio', anio: '2026' }`.
 */
export function partesFecha(s: string | null | undefined): {
  diaSemana: string; dia: string; mes: string; anio: string;
} {
  if (!s) return { diaSemana: '', dia: '', mes: '', anio: '' };
  const puro = parteFechaPura(s);
  const d = puro ? new Date(`${puro}T12:00:00`) : parseDbDate(s);
  const tz = puro ? undefined : TZ;
  const parte = (o: Intl.DateTimeFormatOptions) =>
    d.toLocaleDateString('es-MX', { ...o, timeZone: tz }).replace('.', '');
  return {
    diaSemana: parte({ weekday: 'long' }),
    dia: parte({ day: 'numeric' }),
    mes: parte({ month: 'long' }),
    anio: parte({ year: 'numeric' }),
  };
}

/** Primera letra en mayúscula. Para arrancar una frase con "Lunes 27…". */
export function mayusculaInicial(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/**
 * Un rango escrito como lo escribe una persona:
 *   mismo mes  → "Del lunes 27 al viernes 31 de julio"
 *   otro mes   → "Del lunes 28 de diciembre al sábado 2 de enero"
 * `union` cambia el conector: 'al' para un periodo, 'y' para dos días sueltos
 * ("Sábado 22 y domingo 23 de agosto").
 */
export function rangoLargo(
  a: string | null | undefined,
  b: string | null | undefined,
  union: 'al' | 'y' = 'al',
): string {
  const p = partesFecha(a);
  const q = partesFecha(b);
  if (!p.dia) return '';
  if (!q.dia) return mayusculaInicial(`${p.diaSemana} ${p.dia} de ${p.mes}`);
  const mismoMes = p.mes === q.mes && p.anio === q.anio;
  const izq = mismoMes
    ? `${p.diaSemana} ${p.dia}`
    : `${p.diaSemana} ${p.dia} de ${p.mes}`;
  const der = `${q.diaSemana} ${q.dia} de ${q.mes}`;
  const frase = union === 'al' ? `del ${izq} al ${der}` : `${izq} y ${der}`;
  return mayusculaInicial(frase);
}

/**
 * "sábado 22 de agosto" — día de la semana y mes COMPLETOS, sin el año.
 * Para tarjetas donde el año se muestra aparte y repetirlo en cada fecha
 * sobrecarga la línea. Igual que las demás: el día de la semana se DERIVA,
 * nunca se escribe a mano.
 */
export function fechaLargaSinAnio(s: string | null | undefined): string {
  if (!s) return '';
  const puro = parteFechaPura(s);
  const d = puro ? new Date(`${puro}T12:00:00`) : parseDbDate(s);
  const opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' };
  if (!puro) opts.timeZone = TZ;
  return d.toLocaleDateString('es-MX', opts).replace(',', '');
}

/** "miércoles 15 de julio de 2026" — fecha completa y clara, con día de la semana. */
export function fechaLarga(s: string | null | undefined): string {
  if (!s) return '';
  const puro = parteFechaPura(s);
  const d = puro ? new Date(`${puro}T12:00:00`) : parseDbDate(s);
  const opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  if (!puro) opts.timeZone = TZ;
  return d.toLocaleDateString('es-MX', opts).replace(',', '');
}

function horaHHMM(s: string): string {
  return parseDbDate(s).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ });
}
/** ¿El timestamp cae al INICIO del día (00:00) en hora de MX? (ventanas "todo el día") */
export function esInicioDeDia(s: string): boolean { return horaHHMM(s) === '00:00'; }
/** ¿El timestamp cae al FINAL del día (23:58-23:59) en hora de MX? (cierres "todo el día") */
export function esFinDeDia(s: string): boolean { const h = horaHHMM(s); return h === '23:59' || h === '23:58'; }

/** Fecha visible para ventanas de tareas: día de la semana + hora solo si NO es todo-el-día. */
export function fechaVentana(s: string, tipo: 'abre' | 'cierra'): string {
  const soloDia = tipo === 'abre' ? esInicioDeDia(s) : esFinDeDia(s);
  return soloDia ? fechaLarga(s) : `${fechaLarga(s)} · ${horaCorta(s)}`;
}

/** Valor para <input type="date"> (YYYY-MM-DD) en hora de MX — para prellenar formularios. */
export function aInputFecha(s: string): string {
  return parseDbDate(s).toLocaleDateString('en-CA', { timeZone: TZ });
}

/** Valor para <input type="datetime-local"> (YYYY-MM-DDTHH:mm) en hora de MX. */
export function aInputFechaHora(s: string): string {
  return `${aInputFecha(s)}T${horaHHMM(s)}`;
}
