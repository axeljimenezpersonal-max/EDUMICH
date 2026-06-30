/**
 * Valida URLs antes de usarlas en `href` o en `window.location` para evitar
 * open-redirect y, sobre todo, esquemas peligrosos como `javascript:` / `data:`
 * / `vbscript:` (XSS) cuando la URL proviene de contenido administrado
 * (enlaces de notificaciones, ctaUrl de anuncios, etc.).
 *
 * Devuelve la URL si es segura (ruta interna relativa, http(s) o mailto),
 * o `'#'` si no lo es.
 */
export function safeUrl(url: string | null | undefined): string {
  if (!url) return '#';
  const trimmed = url.trim();

  // Rutas internas relativas (no protocol-relative "//").
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;

  try {
    const u = new URL(trimmed, window.location.origin);
    if (u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'mailto:') {
      return u.href;
    }
  } catch {
    /* URL malformada */
  }
  return '#';
}
