/**
 * Saneado de texto para PDFs generados con pdf-lib + fuentes estándar (WinAnsi).
 *
 * El problema: las fuentes estándar de pdf-lib (Helvetica/Times) usan codificación
 * WinAnsi (CP1252). El español (ñ, Ñ, á-ú, ü, ¿, ¡, etc.) SÍ está en WinAnsi y se
 * dibuja perfecto — pero pdf-lib LANZA un error si encuentra un carácter fuera de
 * WinAnsi (comillas/guiones tipográficos, elipsis "…", etc.). Antes el código
 * "resolvía" esto borrando TODOS los acentos (ñ → n), lo que rompía nombres como
 * "Peña" o "Pátzcuaro".
 *
 * Este helper, en cambio:
 *  1) Reemplaza los caracteres tipográficos problemáticos por su equivalente ASCII.
 *  2) PRESERVA los caracteres latinos (incl. todo el español), que sí son WinAnsi.
 *  3) Solo como último recurso, transcribe (quita diacríticos) los caracteres que
 *     quedan fuera de Latin-1, y descarta lo verdaderamente exótico (emojis, CJK),
 *     para que la generación del PDF NUNCA lance una excepción.
 *
 * NOTA: para cobertura Unicode total (p.ej. nombres en purépecha con diacríticos
 * fuera de Latin-1) lo correcto a futuro es EMBEBER una fuente TTF Unicode con
 * @pdf-lib/fontkit. Este helper cubre el 100% del español sin agregar binarios.
 */

// Caracteres tipográficos comunes (no-WinAnsi) → equivalente seguro.
const REEMPLAZOS: Record<string, string> = {
  '…': '...', // … elipsis
  '—': '-', // — raya (em dash)
  '–': '-', // – guion medio (en dash)
  '−': '-', // − signo menos
  '‘': "'", // ' comilla simple izq
  '’': "'", // ' comilla simple der
  '‚': "'", // ‚
  '“': '"', // " comilla doble izq
  '”': '"', // " comilla doble der
  '„': '"', // „
  '•': '-', // • viñeta
  ' ': ' ', // espacio duro (nbsp)
  ' ': ' ', // espacio fino duro
  ' ': ' ', // espacio fino
};

// Marcas diacríticas combinantes (resultado de normalizar a NFD).
const RANGO_DIACRITICOS = /[̀-ͯ]/g;
// Cualquier carácter fuera de Latin-1 imprimible (0x20–0xFF) — Latin-1 incluye
// TODO el español, así que esto NO toca ñ/á/é/í/ó/ú/ü/¿/¡.
const FUERA_DE_LATIN1 = /[^ -ÿ]/g;

/**
 * Devuelve una versión del texto segura para dibujar con fuentes WinAnsi,
 * conservando los caracteres del español.
 */
export function winAnsiSafe(text: string): string {
  if (!text) return '';
  let t = text;
  for (const [from, to] of Object.entries(REEMPLAZOS)) {
    if (t.includes(from)) t = t.split(from).join(to);
  }
  // Transcribe lo que quede fuera de Latin-1 (quita diacríticos) y descarta lo
  // exótico restante (emojis, CJK), para que pdf-lib nunca lance excepción.
  t = t.replace(FUERA_DE_LATIN1, (ch) =>
    ch.normalize('NFD').replace(RANGO_DIACRITICOS, '').replace(FUERA_DE_LATIN1, ''),
  );
  return t;
}
