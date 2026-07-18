/**
 * Motor de puntaje del buscador.
 *
 * Decisiones que valen la pena entender antes de tocarlo:
 *
 * 1. Los tokens se combinan con Y, no con O. Si alguien escribe "pago examen",
 *    quiere lo que habla de pago Y de examen. Con O, la lista se llena de ruido
 *    y el resultado bueno queda sepultado. Es la misma regla que ya usa
 *    `buscar-cuenta` en el backend.
 *
 * 2. El tipo de resultado pesa más que la coincidencia textual. Una respuesta
 *    que resuelve la duda vale más que una sección que sólo lleva a una
 *    pantalla, aunque la sección coincida mejor de nombre. Ése es el punto de
 *    todo esto: contestar, no navegar.
 *
 * 3. La coincidencia difusa NUNCA aplica a prefijos cortos. Con 2 letras
 *    escritas, media plataforma está a distancia 2 y el buscador parecería
 *    tener opiniones aleatorias mientras el usuario aún teclea.
 */

import type { ContextoBuscador, EntradaIndice, Resultado, TipoResultado } from './tipos';
import { distancia, erratasPermitidas, normalizar, tokenizar } from './texto';

/** Cuánto vale de base cada capa. Ver decisión 2. */
const PESO_TIPO: Record<TipoResultado, number> = {
  dato: 400,
  respuesta: 200,
  seccion: 100,
  entidad: 150,
};

/** Puntaje mínimo para que un token cuente como encontrado. */
const UMBRAL_TOKEN = 30;

interface Campos {
  titulo: string[];
  terminos: string[];
  cuerpo: string[];
}

function prepararCampos(e: EntradaIndice): Campos {
  return {
    titulo: normalizar(e.titulo).split(' ').filter(Boolean),
    terminos: e.terminos.map(normalizar).filter(Boolean),
    cuerpo: normalizar(e.cuerpo ?? '').split(' ').filter(Boolean),
  };
}

/**
 * Qué tan bien un token explica esta entrada. 0 = nada.
 *
 * Se queda con el mejor golpe, no con la suma: que "pago" aparezca ocho veces
 * en el cuerpo no lo hace mejor resultado que un título que se llama "Pagos".
 */
function puntuarToken(token: string, c: Campos): number {
  let mejor = 0;
  const tolerancia = erratasPermitidas(token);

  for (const palabra of c.titulo) {
    if (palabra === token) mejor = Math.max(mejor, 100);
    else if (palabra.startsWith(token)) mejor = Math.max(mejor, 85);
    else if (tolerancia > 0 && token.length >= 4) {
      const d = distancia(token, palabra, tolerancia);
      if (d <= tolerancia) mejor = Math.max(mejor, 70 - d * 10);
    }
  }

  for (const termino of c.terminos) {
    // Los términos pueden ser frases ("fecha limite de pago"): se comparan
    // tanto enteros como palabra por palabra.
    if (termino === token) { mejor = Math.max(mejor, 95); continue; }
    for (const palabra of termino.split(' ')) {
      if (palabra === token) mejor = Math.max(mejor, 90);
      else if (palabra.startsWith(token)) mejor = Math.max(mejor, 72);
      else if (tolerancia > 0 && token.length >= 4) {
        const d = distancia(token, palabra, tolerancia);
        if (d <= tolerancia) mejor = Math.max(mejor, 62 - d * 10);
      }
    }
  }

  for (const palabra of c.cuerpo) {
    if (palabra === token) mejor = Math.max(mejor, 40);
    else if (palabra.startsWith(token) && token.length >= 4) mejor = Math.max(mejor, 33);
  }

  return mejor;
}

/**
 * Puntúa una entrada completa. Devuelve null si algún token no aparece: eso es
 * la semántica Y de la decisión 1.
 */
function puntuarEntrada(tokens: string[], e: EntradaIndice, c: Campos): number | null {
  let suma = 0;
  for (const t of tokens) {
    const p = puntuarToken(t, c);
    if (p < UMBRAL_TOKEN) return null;
    suma += p;
  }
  // Promedio, no suma: si no, escribir más palabras infla el puntaje y las
  // consultas largas dejarían de poder compararse con las cortas.
  return combinar(suma / tokens.length, e.tipo);
}

/**
 * Mezcla la fuerza textual con el bono del tipo, PROPORCIONALMENTE.
 *
 * El bono no puede ser fijo: si lo fuera, una respuesta que apenas menciona la
 * palabra de pasada en su cuerpo (40 puntos) le ganaría a la sección que se
 * llama exactamente así (95 puntos), sólo por ser respuesta. Pasaba de verdad:
 * buscar "inscripción" ponía "¿Dónde está mi matrícula?" encima de "Mi
 * convocatoria", porque su texto dice "cédula de inscripción".
 *
 * Escalando el bono por la fuerza del match, una respuesta sigue ganándole a
 * una sección IGUAL de relevante, que es lo que se quería, pero ya no le gana
 * a una sección claramente mejor.
 */
function combinar(fuerza: number, tipo: TipoResultado): number {
  return fuerza + PESO_TIPO[tipo] * (fuerza / 100);
}

export interface OpcionesBuscar {
  /** Máximo de resultados devueltos. */
  limite?: number;
}

/**
 * Busca en el índice estático y mezcla los datos vivos del contexto.
 *
 * Los `ctx.datos` NO se puntúan contra el texto: ya vienen resueltos por el
 * layout que sabe del usuario. Se filtran por coincidencia simple y se ponen
 * arriba, porque son la única capa que contesta con información real.
 */
export function buscar(
  consulta: string,
  indice: EntradaIndice[],
  ctx: ContextoBuscador,
  opciones: OpcionesBuscar = {},
): Resultado[] {
  const tokens = tokenizar(consulta);
  if (tokens.length === 0) return [];

  const limite = opciones.limite ?? 12;
  const salida: Resultado[] = [];

  // Capa de datos propios del usuario.
  for (const d of ctx.datos ?? []) {
    const campos: Campos = {
      titulo: normalizar(d.titulo).split(' ').filter(Boolean),
      terminos: [],
      cuerpo: normalizar(`${d.cuerpo ?? ''} ${d.pista ?? ''}`).split(' ').filter(Boolean),
    };
    let suma = 0;
    let todos = true;
    for (const t of tokens) {
      const p = puntuarToken(t, campos);
      if (p < UMBRAL_TOKEN) { todos = false; break; }
      suma += p;
    }
    if (todos) salida.push({ ...d, puntaje: combinar(suma / tokens.length, 'dato') });
  }

  // Capa estática: secciones y respuestas, filtradas por rol.
  for (const e of indice) {
    if (!e.roles.includes(ctx.rol)) continue;
    const p = puntuarEntrada(tokens, e, prepararCampos(e));
    if (p === null) continue;
    salida.push({
      id: e.id,
      tipo: e.tipo,
      titulo: e.titulo,
      cuerpo: e.cuerpo,
      ruta: e.ruta,
      ancla: e.ancla,
      icono: e.icono,
      pista: e.pista,
      puntaje: p,
    });
  }

  return salida
    .sort((a, b) => (b.puntaje ?? 0) - (a.puntaje ?? 0))
    .slice(0, limite);
}
