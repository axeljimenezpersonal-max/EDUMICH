/**
 * Comodines de LIKE / ILIKE en texto escrito por el usuario.
 *
 * ── El problema ─────────────────────────────────────────────────────────────
 * En `ILIKE '%' || termino || '%'`, si el término trae `%` o `_` esos
 * caracteres NO se buscan: se ejecutan.
 *
 *   · escribir `%`      → el patrón queda `%%%` y casa con TODAS las filas.
 *   · escribir `a_a`    → el `_` casa con cualquier carácter.
 *
 * Aparte de dar resultados absurdos, es la forma barata de sacarle la tabla
 * entera a un buscador: basta un `%` en un campo que sólo debía filtrar. Y en
 * columnas grandes, un patrón de puros comodines es caro de evaluar.
 *
 * ── La solución ─────────────────────────────────────────────────────────────
 * Escapar con contrabarra. PostgreSQL usa la contrabarra como carácter de
 * escape de LIKE POR DEFECTO, así que NO hace falta añadir `ESCAPE '\'` a cada
 * consulta: basta con que el valor llegue escapado. Como además los valores
 * viajan siempre parametrizados (`$1`), la contrabarra llega literal.
 *
 * La propia contrabarra se escapa primero, si no `\` quedaría escapando al
 * carácter siguiente en vez de buscarse a sí misma.
 */

/** Convierte `%`, `_` y `\` del usuario en literales que se buscan a sí mismos. */
export function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, '\\$&');
}

/** `%texto%` con los comodines del usuario ya neutralizados. */
export function patronLike(texto: string): string {
  return `%${escaparLike(texto)}%`;
}
