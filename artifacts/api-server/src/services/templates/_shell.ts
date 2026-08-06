/**
 * Shell compartido para los correos de Modula.
 * Da una estética cálida y consistente (guinda con degradado, acento dorado,
 * tarjetas suaves) en vez del look de "tabla robótica". Compatible con clientes
 * de correo: layout con tablas + estilos inline + fallbacks por bgcolor.
 */

import { escapeHtml } from '../../utils/escapeHtml';

// Pila de fuentes moderna y segura para correo (no se pueden incrustar webfonts
// de forma confiable): Segoe UI en Windows/Outlook, San Francisco en Apple Mail,
// Roboto en Android/Gmail; Arial como último respaldo.
export const EMAIL_FONT =
  "'Segoe UI', Roboto, -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif";
export const EMAIL_SERIF = "Georgia, 'Times New Roman', 'Iowan Old Style', serif";

export const EMAIL_COLORS = {
  guinda: '#6b1530',
  guindaDark: '#4a0e20',
  guindaSoft: '#7c1839',
  dorado: '#b89968',
  crema: '#f6f1e8',
  cremaSoft: '#faf6ef',
  borde: '#ece3d6',
  texto: '#3f3a35',
  textoSuave: '#8a8178',
};

/** Botón de acción (guinda, redondeado). */
export function emailBoton(href: string, texto: string): string {
  return `<table cellpadding="0" cellspacing="0" align="center" role="presentation"><tr>
    <td style="border-radius:10px;background:${EMAIL_COLORS.guinda};">
      <a href="${href}" style="display:inline-block;padding:14px 36px;color:#ffffff;font-family:${EMAIL_FONT};font-size:15px;font-weight:bold;text-decoration:none;border-radius:10px;">${texto}</a>
    </td>
  </tr></table>`;
}

/** Envuelve el contenido en el encabezado + pie institucional. */
export function emailLayout(opts: { preheader?: string; contenido: string }): string {
  const { guinda, guindaDark, guindaSoft, dorado, crema, cremaSoft, borde, textoSuave } = EMAIL_COLORS;
  const preheader = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${opts.preheader}</div>`
    : '';
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${crema};font-family:${EMAIL_FONT};">
  ${preheader}
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${crema};padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${borde};max-width:560px;box-shadow:0 1px 3px rgba(74,14,32,0.06);">
        <!-- Encabezado: wordmark Módula 22 (texto, no SVG: los clientes de
             correo no renderizan SVG y bloquean imágenes; el texto siempre se ve) -->
        <tr><td style="background-color:${guinda};background:linear-gradient(120deg,${guindaDark} 0%,${guinda} 55%,${guindaSoft} 100%);padding:30px 32px 26px 32px;" align="center">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:bold;color:#ffffff;letter-spacing:0.5px;line-height:1;">MÓDULA<span style="color:${dorado};font-size:15px;font-weight:bold;vertical-align:super;letter-spacing:1px;">&nbsp;22</span></div>
          <div style="height:1px;background:rgba(255,255,255,0.22);width:54px;margin:12px auto 0 auto;line-height:1px;font-size:0;">&nbsp;</div>
          <div style="color:rgba(255,255,255,0.78);font-size:10.5px;letter-spacing:2px;text-transform:uppercase;margin-top:11px;">Preparatoria Abierta · Plan 22 · Gobierno de Michoacán</div>
        </td></tr>
        <!-- Acento dorado -->
        <tr><td style="height:4px;background:${dorado};line-height:4px;font-size:0;">&nbsp;</td></tr>
        <!-- Contenido -->
        ${opts.contenido}
        <!-- Pie -->
        <tr><td style="background:${cremaSoft};padding:22px 32px;border-top:1px solid ${borde};">
          <div style="color:${textoSuave};font-size:11px;text-align:center;line-height:1.7;">
            <strong style="color:${guinda};">Preparatoria Abierta Michoacán</strong><br/>
            Instituto de Educación Media Superior y Superior — Gobierno de Michoacán
          </div>
          <div style="color:#b6ad9f;font-size:10px;text-align:center;margin-top:8px;">Este mensaje se envió automáticamente desde Modula.</div>
        </td></tr>
      </table>
      <div style="color:#c4bcae;font-size:10px;margin-top:14px;">© ${'2026'} Gobierno del Estado de Michoacán · Honestidad y Trabajo</div>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * El bloque de credenciales — compartido por los tres correos de acceso.
 *
 * Vivía copiado tres veces (alumno, gestor, admin) y las tres copias ya habían
 * empezado a divergir. Ahora un cambio de diseño se hace aquí y les llega a
 * los tres.
 *
 * Decisiones de diseño, todas al servicio de una sola escena: una persona
 * frente a la pantalla de login copiando estos dos datos.
 *
 *  · GRANDES. El correo y la contraseña son lo único que la persona vino a
 *    buscar; todo lo demás del correo es contexto.
 *  · Tipografía monoespaciada MODERNA (la pila del sistema: SF Mono, Cascadia,
 *    Consolas...) en vez de Courier New, que se veía a máquina de escribir.
 *    Sigue siendo mono a propósito: en una contraseña, confundir O con 0 o
 *    l con 1 cuesta un acceso fallido.
 *  · Espaciado moderado (2px, no 4): suficiente para distinguir caracteres,
 *    sin partir visualmente la contraseña en letras sueltas.
 *  · SELECCIONABLES de un doble toque: cada dato vive solo en su caja, sin
 *    texto pegado, así el doble clic (o el toque sostenido en el teléfono)
 *    agarra el dato completo y limpio. Es lo más cerca de "copiar y pegar"
 *    que un correo permite — los clientes de correo no ejecutan botones.
 */
export function emailDatosAcceso(email: string, passwordTemporal: string): string {
  const { guinda } = EMAIL_COLORS;
  const mono = "ui-monospace,'SF Mono','Cascadia Code',Menlo,Consolas,'Liberation Mono',monospace";
  return `
    <tr><td style="padding:22px 32px 8px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#fdf8f9;border:1px solid #eccdd6;border-radius:14px;overflow:hidden;">
        <tr><td style="background:${guinda};padding:11px 20px;">
          <span style="color:#fff;font-size:10.5px;font-weight:bold;letter-spacing:1.6px;text-transform:uppercase;">Tus datos de acceso</span>
        </td></tr>
        <tr><td style="padding:22px 20px 20px 20px;">
          <div style="font-size:10.5px;color:#9a8f86;font-weight:bold;letter-spacing:0.8px;text-transform:uppercase;margin-bottom:6px;">Correo de acceso</div>
          <div style="font-family:${mono};font-size:19px;font-weight:bold;color:#1c1917;background:#ffffff;border:1px solid #e8dcd2;padding:14px 16px;border-radius:10px;margin-bottom:18px;text-align:center;word-break:break-all;">${escapeHtml(email)}</div>
          <div style="font-size:10.5px;color:#9a8f86;font-weight:bold;letter-spacing:0.8px;text-transform:uppercase;margin-bottom:6px;">Contraseña temporal</div>
          <div style="font-family:${mono};font-size:34px;font-weight:bold;color:${guinda};letter-spacing:2px;background:#ffffff;border:2px solid ${guinda};padding:18px 16px;border-radius:12px;text-align:center;word-break:break-all;">${escapeHtml(passwordTemporal)}</div>
          <div style="font-size:12px;color:#78716c;margin-top:10px;text-align:center;line-height:1.6;">
            Tócala dos veces para seleccionarla completa y cópiala.<br/>
            <span style="color:#a24a63;">La cambiarás al entrar por primera vez.</span>
          </div>
        </td></tr>
      </table>
    </td></tr>`;
}

/**
 * Bloque "descarga tu guía" para los correos de bienvenida.
 *
 * Va en el correo y no solo en la plataforma porque es justo cuando hace falta:
 * la persona todavía no ha entrado nunca. Por eso la ruta `/publico/guias/:rol`
 * no pide sesión.
 *
 * `base` es la URL del portal SIN la ruta (p. ej. https://prepa.modula22.mx).
 */
export function emailBloqueGuia(base: string, rol: 'alumno' | 'gestor' | 'admin'): string {
  const texto = {
    alumno: 'Guía del alumno',
    gestor: 'Guía del centro de asesoría',
    admin: 'Guía de administración',
  }[rol];
  const url = `${base.replace(/\/$/, '')}/api/publico/guias/${rol}`;
  return `
    <tr><td style="padding:4px 32px 26px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#faf6ef;border:1px solid #ece3d6;border-radius:12px;">
        <tr><td style="padding:16px 18px;">
          <div style="font-size:10px;font-weight:bold;letter-spacing:1.4px;color:${EMAIL_COLORS.guinda};text-transform:uppercase;margin-bottom:6px;">Tu guía</div>
          <div style="font-size:13px;color:${EMAIL_COLORS.texto};line-height:1.6;">
            Paso a paso, con capturas de cada pantalla. <strong>Va adjunta a este
            correo</strong> — y si el adjunto se pierde, aquí está siempre:
            <a href="${url}" style="color:${EMAIL_COLORS.guinda};font-weight:bold;">descargar ${texto} (PDF)</a>.
          </div>
        </td></tr>
      </table>
    </td></tr>`;
}
