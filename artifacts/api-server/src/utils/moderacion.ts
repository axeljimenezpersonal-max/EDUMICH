/**
 * Moderación MÍNIMA de lenguaje para el chat con la Secretaría.
 *
 * No es un "motor" de moderación: es una lista corta de groserías/insultos
 * evidentes (incluyendo insultos de odio) para mantener el trato mínimo
 * respetuoso que exige el aviso legal del chat. Se aplica en el backend antes
 * de guardar el mensaje. Ante duda, NO bloquea (preferimos falsos negativos a
 * censurar de más).
 */

// Normaliza para atrapar variantes simples: minúsculas, sin acentos, sustituciones
// de "leet" comunes y letras repetidas colapsadas (puuuta → puta).
const ACENTOS = /[̀-ͯ]/g;
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD').replace(ACENTOS, '') // quita acentos
    .replace(/[0@]/g, 'o')
    .replace(/[3]/g, 'e')
    .replace(/[1!|]/g, 'i')
    .replace(/[$]/g, 's')
    .replace(/[4]/g, 'a')
    .replace(/(.)\1+/g, '$1'); // colapsa letras repetidas (puuuta → puta)
}

// Raíces claramente ofensivas. Se comparan por palabra (límites), así "disputa"
// o "computadora" NO caen. Mantener corto y evidente.
const RAICES = [
  'pendej', 'puta', 'puto', 'putos', 'putas', 'verga', 'vergas', 'pinche', 'pinches',
  'cabron', 'cabrones', 'chinga', 'chingar', 'chingada', 'chingado', 'chingue', 'chingas', 'chingen',
  'mierda', 'culero', 'culera', 'joto', 'jotos', 'maricon', 'maricones', 'marica',
  'coger', 'coja', 'zorra', 'perra', 'imbecil', 'idiota', 'estupid', 'mamon', 'mamada', 'mamadas',
  'nigga', 'nigger', 'negro de mierda',
];

// Frases ofensivas comunes (multi-palabra), atrapadas aparte.
const FRASES = ['chinga tu madre', 'chingas tu madre', 'vete a la verga', 'hijo de puta', 'hija de puta', 'vete al carajo'];

// Se normaliza cada raíz igual que el texto (p. ej. "nigga" → "niga") para que
// coincidan tras colapsar letras repetidas.
const REGEX_RAICES = RAICES.map((r) => new RegExp(`\\b${normalizar(r)}[a-z]*\\b`, 'i'));

/** Devuelve true si el texto contiene lenguaje ofensivo evidente. */
export function tieneLenguajeOfensivo(texto: string): boolean {
  const n = normalizar(texto);
  if (FRASES.some((f) => n.includes(normalizar(f)))) return true;
  return REGEX_RAICES.some((re) => re.test(n));
}

export const MENSAJE_MODERACION =
  'Tu mensaje contiene lenguaje ofensivo. Este es un canal oficial: mantén un trato respetuoso para que podamos ayudarte.';
