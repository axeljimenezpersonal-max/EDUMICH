/**
 * Las dos cifras que definen si un alumno avanza: cuánto se necesita para
 * aprobar un módulo, y cuántos módulos son el plan completo.
 *
 * ── Por qué viven aquí y no sueltas ─────────────────────────────────────────
 * Estaban escritas a mano en una docena de archivos y se separaron: la captura
 * manual de calificaciones exigía 70 mientras la carga masiva de resultados de
 * la DGB y TODO el portal usaban 60. Un alumno con 6.5 veía su módulo en verde
 * en pantalla y "No aprob." en su historial académico en PDF, porque una vía
 * calcula al vuelo y la otra lee la columna `aprobado` que se guardó mal.
 *
 * El total tenía el mismo problema: el historial imprimía "11/22 módulos" y en
 * el renglón de al lado calculaba el avance sobre 21.
 *
 * Cualquier cifra nueva que dependa de estas dos se deriva de aquí. No se
 * vuelve a escribir un 60 ni un 22 a mano.
 */

/**
 * Mínimo aprobatorio, en la escala interna 0–100.
 *
 * Equivale al 6 de la escala SEP que ve el alumno: internamente se guarda
 * 0–100 y se divide entre 10 para presentarlo (65 → "6.5"). Es el mismo
 * criterio con el que llegan los resultados oficiales de la DGB.
 */
export const CALIF_MINIMA_APROBATORIA = 60;

/** Módulos que componen el Plan 22 completo. */
export const TOTAL_MODULOS_PLAN22 = 22;

/**
 * ¿Esta calificación aprueba? `null` (no evaluado) NO aprueba.
 *
 * Se usa en todo lo que ESCRIBE la columna `aprobado`, para que lo guardado
 * y lo que se calcula en pantalla no puedan volver a discrepar.
 */
export function esAprobatoria(calificacion: number | null | undefined): boolean {
  return calificacion !== null && calificacion !== undefined && calificacion >= CALIF_MINIMA_APROBATORIA;
}
