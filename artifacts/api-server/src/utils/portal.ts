/**
 * URL del portal para los enlaces de los correos (bienvenida, recuperar
 * contraseña, verificación de pase, etc.).
 *
 * El dominio oficial es modula22.mx. Antes esto salía de PUBLIC_PORTAL_URL a
 * secas, y si esa variable conservaba un valor viejo (el subdominio interno de
 * Railway o el dominio edumich, ambos muertos), los correos salían con un
 * enlace roto (404). Aquí se ignoran esos dominios heredados: si la variable
 * apunta a algo muerto, se usa modula22.mx.
 */

const DOMINIOS_MUERTOS = /railway\.app|edumich/i;

/** Base del portal, sin ruta. Ej.: "https://modula22.mx". */
export function urlPortalBase(): string {
  const raw = process.env.PUBLIC_PORTAL_URL?.trim();
  if (raw && !DOMINIOS_MUERTOS.test(raw)) {
    return raw.replace(/\/login\/?$/, '').replace(/\/$/, '');
  }
  return process.env.NODE_ENV === 'production' ? 'https://modula22.mx' : 'http://localhost:5173';
}

/**
 * Prefijo del estado en las direcciones del portal.
 *
 * Las rutas viven bajo el estado: `/michoacan/login`, no `/login`. El portal
 * redirige solo las direcciones viejas —hay QR impresos y correos enviados con
 * ellas—, pero los correos NUEVOS deben salir ya con la dirección buena, para
 * no gastarle un salto a nadie ni enseñar una URL que ya no es la oficial.
 *
 * Gemelo de `BASE_ESTADO` en `student-portal/src/lib/estado.ts`: si allá entra
 * otro estado, aquí también.
 */
const BASE_ESTADO = '/michoacan';

/** Base del portal CON el estado. Ej.: "https://prepa.modula22.mx/michoacan". */
export function urlPortalEstado(): string {
  return `${urlPortalBase()}${BASE_ESTADO}`;
}

/** URL de inicio de sesión. Ej.: "https://prepa.modula22.mx/michoacan/login". */
export function urlPortalLogin(): string {
  return `${urlPortalEstado()}/login`;
}
