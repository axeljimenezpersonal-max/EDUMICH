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

/**
 * La forma CANÓNICA de un nombre: MAYÚSCULAS, con acentos, sin espacios de más.
 *
 * ── Por qué se guarda así ───────────────────────────────────────────────────
 *
 * Un alumno puede entrar al padrón por tres puertas —se registra solo desde la
 * página pública, lo da de alta un centro de asesoría, o lo captura la
 * administración— y en cada una lo teclea una persona distinta. Sin una forma
 * canónica, "Adán", "ADAN" y "adan" son tres cadenas diferentes: se ven iguales
 * en pantalla pero no empatan al buscar, ni al cotejar contra la Relación que
 * se entrega a la DGB, ni al detectar que ya existe. Ahí es donde se duplica un
 * expediente sin que nadie lo note.
 *
 * MAYÚSCULAS y no minúsculas porque es la forma en que el Estado ya escribe
 * estos nombres: la CURP, el padrón y los documentos oficiales vienen así, y
 * guardar igual que la fuente evita una conversión más donde equivocarse.
 *
 * Los ACENTOS se conservan. La regla de ASCII de este repo es para nombres de
 * archivo, claves y encabezados de CSV, no para el nombre de una persona: quien
 * se llama Adán se llama Adán, y borrarle el acento en su expediente es
 * escribirle mal el nombre. `toLocaleUpperCase('es-MX')` respeta á→Á y ñ→Ñ.
 *
 * Esto NO afecta cómo se ve en pantalla: `lib/nombre.ts` en el portal sigue
 * presentándolo con capitalización normal donde corresponde.
 */
export function normalizarNombre(v: string): string {
  return v.normalize('NFC').replace(/\s+/g, ' ').trim().toLocaleUpperCase('es-MX');
}

/** Arma "NOMBRES APELLIDOP APELLIDOM" a partir de las partes, ya canónico. */
export function armarNombreCompleto(p: NombrePartes): string {
  return normalizarNombre(
    [p.nombres, p.apellidoPaterno, p.apellidoMaterno]
      .map((s) => (s ?? '').trim())
      .filter(Boolean)
      .join(' '),
  );
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
