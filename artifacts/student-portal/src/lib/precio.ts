/**
 * El precio del examen — el RESPALDO del portal.
 *
 * La cifra buena siempre viene del servidor (`/config-pago`, que la lee del
 * concepto de la base). Esto es lo que se muestra en la fracción de segundo
 * antes de que llegue la respuesta, y si la petición falla.
 *
 * Vivía escrito a mano en cinco pantallas, así que un cambio de precio dejaba
 * a unas diciendo lo nuevo y a otras lo viejo mientras cargaban.
 *
 * ⚠️ Debe coincidir con `PRECIO_EXAMEN` de
 * `artifacts/api-server/src/config/precioExamen.ts`. Ahí está la explicación
 * de por qué hoy son $101 y qué hacer para volver a los $131.
 */
export const COSTO_EXAMEN_RESPALDO = 101;
