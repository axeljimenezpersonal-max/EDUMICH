/**
 * Helpers de datos del estudiante.
 *
 * `nombreCompleto` y `direccion` son campos DERIVADOS: la fuente de verdad son
 * las partes (nombres/apellidos y calle/colonia/cp/ciudad/estado). Estos helpers
 * arman los derivados a partir de las partes, para que las ~44 pantallas que aún
 * leen `nombreCompleto`/`direccion` sigan funcionando sin cambios.
 */

export interface NombrePartes {
  nombres?: string | null;
  apellidoPaterno?: string | null;
  apellidoMaterno?: string | null;
}

export interface DireccionPartes {
  calleNumero?: string | null;
  colonia?: string | null;
  cp?: string | null;
  ciudad?: string | null;
  estadoDomicilio?: string | null;
}

/** Devuelve los campos DERIVADOS ({nombreCompleto?, direccion?}) listos para
 *  hacer spread en un insert/update de estudiante, omitiendo los vacíos. */
export function derivados(p: NombrePartes & DireccionPartes): { nombreCompleto?: string; direccion?: string } {
  const nc = armarNombreCompleto(p);
  const dir = armarDireccion(p);
  return { ...(nc ? { nombreCompleto: nc } : {}), ...(dir ? { direccion: dir } : {}) };
}

/** Arma "Nombres ApellidoP ApellidoM" a partir de las partes. */
export function armarNombreCompleto(p: NombrePartes): string {
  return [p.nombres, p.apellidoPaterno, p.apellidoMaterno]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Arma una dirección legible en una línea a partir de las partes. */
export function armarDireccion(p: DireccionPartes): string {
  const linea1 = [p.calleNumero, p.colonia].map((s) => (s ?? '').trim()).filter(Boolean).join(', ');
  const cp = (p.cp ?? '').trim();
  const linea2 = [p.ciudad, p.estadoDomicilio].map((s) => (s ?? '').trim()).filter(Boolean).join(', ');
  return [linea1, cp ? `C.P. ${cp}` : '', linea2]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' · ')
    .trim();
}

/**
 * Divide un "nombre completo" en partes (heurística para migración):
 * los últimos 2 tokens son apellidos (paterno, materno) y el resto son nombres.
 * Casos: 1 token → todo va a nombres; 2 → nombres + apellidoPaterno;
 * 3+ → nombres = todo menos los últimos 2. Los nombres/apellidos compuestos
 * pueden quedar mal: por eso queda editable para corregir a mano.
 */
export function partirNombre(nombreCompleto: string): Required<NombrePartes> {
  const tokens = (nombreCompleto ?? '').trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { nombres: '', apellidoPaterno: '', apellidoMaterno: '' };
  if (tokens.length === 1) return { nombres: tokens[0], apellidoPaterno: '', apellidoMaterno: '' };
  if (tokens.length === 2) return { nombres: tokens[0], apellidoPaterno: tokens[1], apellidoMaterno: '' };
  return {
    nombres: tokens.slice(0, tokens.length - 2).join(' '),
    apellidoPaterno: tokens[tokens.length - 2],
    apellidoMaterno: tokens[tokens.length - 1],
  };
}
