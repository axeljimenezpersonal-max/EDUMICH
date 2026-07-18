/**
 * Normalización y comparación de texto para el buscador.
 *
 * Regla de oro: aquí se asume que el usuario escribe MAL. Sin acentos, con
 * erratas, en singular cuando la interfaz dice plural, y con la palabra que usa
 * en su casa y no la que usa el sistema. El motor se adapta a él.
 */

/**
 * Marca temporal para poner la ñ a salvo del barrido de acentos.
 * U+0001 no aparece en texto escrito por humanos, así que no colisiona.
 */
const ENYE = '\u0001';

/**
 * Minúsculas, sin acentos, sin puntuación, con espacios colapsados.
 *
 * NFD separa cada letra de su tilde y luego se borran los diacríticos, de modo
 * que "inscripción" e "inscripcion" acaban siendo la misma cadena. La ñ se
 * aparta ANTES del barrido y se restaura después: "ano" y "año" no son lo
 * mismo, y confundirlos en un portal de gobierno sería vergonzoso.
 */
export function normalizar(s: string): string {
  return s
    // A NFC primero: si el teclado mandó la ñ ya descompuesta, aquí se
    // recompone y el apartado de abajo sí la encuentra.
    .normalize('NFC')
    .replace(/ñ/g, ENYE)
    .replace(/Ñ/g, ENYE)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(ENYE).join('ñ')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Palabras vacías: no aportan a la búsqueda y ensucian el puntaje. */
const VACIAS = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'y', 'o', 'a', 'en', 'con', 'por', 'para', 'que', 'mi', 'mis', 'tu', 'tus',
  'su', 'sus', 'se', 'es', 'al', 'lo', 'como', 'donde', 'cuando', 'cual',
  'cuanto', 'cuanta', 'quiero', 'necesito', 'puedo',
]);

/**
 * Parte la consulta en palabras útiles.
 *
 * Si TODAS las palabras son vacías (alguien escribió sólo "cómo" o "dónde"),
 * se devuelven tal cual: es preferible buscar algo a no buscar nada.
 */
export function tokenizar(s: string): string[] {
  const todas = normalizar(s).split(' ').filter(Boolean);
  const utiles = todas.filter((t) => !VACIAS.has(t));
  return utiles.length > 0 ? utiles : todas;
}

/**
 * Distancia de edición con corte temprano.
 *
 * Se detiene en cuanto la fila mínima supera `max`, porque para el buscador da
 * igual si la distancia es 5 o 12: ambas son "no se parece". Evita recorrer
 * matrices completas por cada entrada del índice en cada tecleo.
 */
export function distancia(a: string, b: string, max = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let previa = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const actual = [i];
    let minFila = i;
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min(actual[j - 1] + 1, previa[j] + 1, previa[j - 1] + costo);
      actual.push(v);
      if (v < minFila) minFila = v;
    }
    if (minFila > max) return max + 1;
    previa = actual;
  }
  return previa[b.length];
}

/**
 * Erratas toleradas según el largo de la palabra.
 *
 * Escalonado a propósito: en una palabra de 4 letras, dos erratas ya la
 * convierten en otra distinta ("pago" → "sala"). En una de 12, dos erratas
 * siguen siendo un dedazo.
 */
export function erratasPermitidas(palabra: string): number {
  if (palabra.length <= 3) return 0;
  if (palabra.length <= 6) return 1;
  return 2;
}
