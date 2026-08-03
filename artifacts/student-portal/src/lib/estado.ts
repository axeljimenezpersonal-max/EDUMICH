/**
 * El estado va en la dirección: `/michoacan/admin/alumnos`, no `/admin/alumnos`.
 *
 * ── Por qué ─────────────────────────────────────────────────────────────────
 * Módula es una plataforma para varios estados. Antes de esto la dirección no
 * decía en cuál estabas: `/admin` a secas. Y la entrada pública era
 * `prepa.modula22.mx/prepaabierta/michoacan`, que dice "prepa" dos veces —el
 * subdominio ya lo dice— y no deja lugar para el segundo estado.
 *
 * A partir de aquí la dirección se lee sola: dominio → estado → rol → pantalla.
 *
 *     prepa.modula22.mx / michoacan / admin / alumnos
 *                         └ estado    └ rol   └ pantalla
 *
 * ── Cómo está armado ────────────────────────────────────────────────────────
 * NO se reescribieron las 85 rutas ni los 178 enlaces del portal. wouter monta
 * todo dentro de `<Router base={BASE_ESTADO}>`: él le pone el prefijo tanto al
 * comparar la dirección como al generar los `<Link>`. Las rutas siguen escritas
 * `/admin/alumnos` y el navegador muestra `/michoacan/admin/alumnos`.
 *
 * Por eso el día que entre otro estado esto es una variable, no una migración.
 */

/** El estado que sirve esta instalación. Un solo lugar que cambiar. */
export const BASE_ESTADO = '/michoacan';

/**
 * Direcciones viejas que hay que seguir atendiendo para siempre: están
 * impresas en QR de credenciales, enviadas en correos y guardadas en los
 * favoritos de la gente. Se redirigen, no se rompen.
 */
const EQUIVALENCIAS_VIEJAS: Record<string, string> = {
  '/prepaabierta/michoacan': BASE_ESTADO,
};

/**
 * La pantalla sin el estado: `/michoacan/gestor/alumnos` → `/gestor/alumnos`.
 * Para métricas y para cualquier comparación que deba dar igual en todos los
 * estados.
 */
export function sinPrefijoDeEstado(ruta: string): string {
  if (ruta === BASE_ESTADO) return '/';
  return ruta.startsWith(`${BASE_ESTADO}/`) ? ruta.slice(BASE_ESTADO.length) : ruta;
}

/**
 * ¿A dónde debe irse esta dirección? `null` si ya está bien y no hay que mover
 * nada.
 *
 * Reglas, en orden:
 *  1. La raíz `/` es la puerta nacional (el selector de estados). No se toca.
 *  2. Lo que ya trae el prefijo del estado, se queda.
 *  3. Lo que tiene equivalencia explícita, va a su equivalente.
 *  4. Cualquier otra cosa es una dirección vieja sin estado: se le antepone.
 */
export function destinoConEstado(ruta: string): string | null {
  const limpia = ruta.replace(/\/+$/, '') || '/';
  if (limpia === '/') return null;
  if (limpia === BASE_ESTADO || limpia.startsWith(`${BASE_ESTADO}/`)) return null;
  const equivalente = EQUIVALENCIAS_VIEJAS[limpia];
  if (equivalente) return equivalente;
  return `${BASE_ESTADO}${limpia}`;
}
