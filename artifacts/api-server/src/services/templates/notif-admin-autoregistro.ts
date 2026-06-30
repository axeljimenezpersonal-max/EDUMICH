import { escapeHtml } from '../../utils/escapeHtml';

export interface NotifAdminAutoregistroData {
  nombreAspirante: string;
  emailAspirante: string;
  municipio: string;
  telefono: string;
  panelUrl: string;
}

export function notifAdminAutoregistroTemplate(data: NotifAdminAutoregistroData): {
  subject: string;
  html: string;
  textPlain: string;
} {
  const subject = `Nueva solicitud de registro — ${data.nombreAspirante}`;
  const fecha = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f4ec;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f4ec;padding:32px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e2d9d0;max-width:580px;">
        <tr><td style="background:#7b1e3a;padding:24px 32px;">
          <div style="color:#fff;font-size:16px;font-weight:bold;line-height:1.2;">EDUMICH · Panel de Administración</div>
          <div style="color:rgba(255,255,255,0.7);font-size:11px;letter-spacing:1.5px;text-transform:uppercase;">Notificación del sistema</div>
        </td></tr>
        <tr><td style="padding:32px 32px 20px 32px;">
          <div style="font-size:11px;font-weight:bold;letter-spacing:2px;color:#7b1e3a;text-transform:uppercase;margin-bottom:10px;">Nueva solicitud de cuenta</div>
          <h1 style="color:#1c1917;font-size:20px;margin:0 0 12px 0;font-family:Georgia,serif;">Aspirante solicita inscripción</h1>
          <p style="color:#44403c;font-size:14px;line-height:1.7;margin:0;">Se recibió una nueva solicitud de registro el <strong>${fecha}</strong>.</p>
        </td></tr>
        <tr><td style="padding:0 32px 24px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2d9d0;border-radius:8px;overflow:hidden;">
            <tr><td style="background:#f8f4ec;padding:10px 18px;"><span style="font-size:11px;font-weight:bold;letter-spacing:2px;color:#44403c;text-transform:uppercase;">Datos del aspirante</span></td></tr>
            <tr><td style="padding:16px 18px;">
              <table cellpadding="0" cellspacing="0" width="100%">
                ${[
                  ['Nombre completo', data.nombreAspirante],
                  ['Correo electrónico', data.emailAspirante],
                  ['Municipio', data.municipio],
                  ['Teléfono', data.telefono],
                ].map(([label, value]) => `
                <tr>
                  <td style="font-size:12px;color:#78716c;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:10px;width:40%;vertical-align:top;">${label}</td>
                  <td style="font-size:14px;color:#1c1917;padding-bottom:10px;">${escapeHtml(value)}</td>
                </tr>`).join('')}
              </table>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:0 32px 28px 32px;" align="center">
          <a href="${data.panelUrl}" style="display:inline-block;background:#7b1e3a;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:16px 40px;border-radius:8px;">Revisar en el panel</a>
        </td></tr>
        <tr><td style="background:#f8f4ec;padding:16px 32px;border-top:1px solid #e2d9d0;">
          <p style="color:#a8a29e;font-size:10px;margin:0;text-align:center;">EDUMICH · Plataforma Educativa Digital · Gobierno de Michoacán</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const textPlain = `Nueva solicitud de registro\n\nNombre: ${data.nombreAspirante}\nCorreo: ${data.emailAspirante}\nMunicipio: ${data.municipio}\nTeléfono: ${data.telefono}\n\nRevisa en: ${data.panelUrl}`;

  return { subject, html, textPlain };
}
