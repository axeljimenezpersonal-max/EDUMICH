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

/** URL de inicio de sesión. Ej.: "https://modula22.mx/login". */
export function urlPortalLogin(): string {
  return `${urlPortalBase()}/login`;
}
