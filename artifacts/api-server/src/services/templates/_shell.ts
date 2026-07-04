/**
 * Shell compartido para los correos de EDUMICH.
 * Da una estética cálida y consistente (guinda con degradado, acento dorado,
 * tarjetas suaves) en vez del look de "tabla robótica". Compatible con clientes
 * de correo: layout con tablas + estilos inline + fallbacks por bgcolor.
 */

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
      <a href="${href}" style="display:inline-block;padding:14px 36px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;text-decoration:none;border-radius:10px;">${texto}</a>
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
<body style="margin:0;padding:0;background:${crema};font-family:Arial,Helvetica,sans-serif;">
  ${preheader}
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${crema};padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${borde};max-width:560px;box-shadow:0 1px 3px rgba(74,14,32,0.06);">
        <!-- Encabezado -->
        <tr><td style="background-color:${guinda};background:linear-gradient(120deg,${guindaDark} 0%,${guinda} 55%,${guindaSoft} 100%);padding:26px 32px;">
          <table cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="padding-right:14px;vertical-align:middle;">
              <div style="width:46px;height:46px;border-radius:12px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.28);text-align:center;line-height:46px;color:#ffffff;font-family:Georgia,serif;font-size:19px;font-weight:bold;letter-spacing:0.5px;">PA</div>
            </td>
            <td style="vertical-align:middle;">
              <div style="color:#ffffff;font-family:Georgia,serif;font-size:19px;font-weight:bold;line-height:1.2;">Preparatoria Abierta</div>
              <div style="color:rgba(255,255,255,0.72);font-size:10.5px;letter-spacing:1.4px;text-transform:uppercase;margin-top:2px;">EDUMICH · IEMSyS · Gobierno de Michoacán</div>
            </td>
          </tr></table>
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
          <div style="color:#b6ad9f;font-size:10px;text-align:center;margin-top:8px;">Este mensaje se envió automáticamente desde EDUMICH.</div>
        </td></tr>
      </table>
      <div style="color:#c4bcae;font-size:10px;margin-top:14px;">© ${'2026'} Gobierno del Estado de Michoacán · Honestidad y Trabajo</div>
    </td></tr>
  </table>
</body>
</html>`;
}
