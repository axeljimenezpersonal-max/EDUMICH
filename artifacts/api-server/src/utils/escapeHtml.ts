/**
 * Escapa entidades HTML para interpolar texto controlado por el usuario dentro
 * de plantillas de correo (HTML). Evita inyección de HTML/enlaces de phishing en
 * correos oficiales del gobierno.
 *
 * Usar SIEMPRE alrededor de datos de usuario (nombres, municipio, teléfono,
 * correo, etc.) al construir el cuerpo HTML de un correo.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
