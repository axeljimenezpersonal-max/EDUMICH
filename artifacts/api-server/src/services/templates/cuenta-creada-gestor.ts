import { escapeHtml } from '../../utils/escapeHtml';

export interface CuentaCreadaGestorData {
  nombreGestor: string;
  email: string;
  passwordTemporal: string;
  municipio: string;
  portalUrl: string;
}

export function cuentaCreadaGestorTemplate(data: CuentaCreadaGestorData): {
  subject: string;
  html: string;
  textPlain: string;
} {
  const subject = `Bienvenido al sistema de gestión — Preparatoria Abierta Michoacán`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f4ec;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f4ec;padding:32px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e2d9d0;max-width:580px;">
        <tr><td style="background:#6b1530;padding:24px 32px;">
          <div style="color:#fff;font-size:16px;font-weight:bold;line-height:1.2;">Preparatoria Abierta · IEMSyS</div>
          <div style="color:rgba(255,255,255,0.7);font-size:11px;letter-spacing:1.5px;text-transform:uppercase;">Gobierno de Michoacán</div>
        </td></tr>
        <tr><td style="padding:32px 32px 20px 32px;">
          <div style="font-size:11px;font-weight:bold;letter-spacing:2px;color:#6b1530;text-transform:uppercase;margin-bottom:10px;">Designación como gestor municipal</div>
          <h1 style="color:#1c1917;font-size:22px;margin:0 0 12px 0;font-family:Georgia,serif;">Bienvenido(a), ${escapeHtml(data.nombreGestor)}</h1>
          <p style="color:#44403c;font-size:14px;line-height:1.7;margin:0 0 12px 0;">Has sido designado(a) como <strong>Gestor Municipal de ${escapeHtml(data.municipio)}</strong> en el Sistema de Preparatoria Abierta del Gobierno de Michoacán.</p>
          <p style="color:#44403c;font-size:14px;line-height:1.7;margin:0;">Como gestor podrás dar de alta aspirantes, subir documentación de expediente y dar seguimiento personalizado a cada alumno de tu municipio.</p>
        </td></tr>
        <tr><td style="padding:0 32px 24px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#fdf8f9;border:2px solid #6b1530;border-radius:8px;overflow:hidden;">
            <tr><td style="background:#6b1530;padding:10px 18px;"><span style="color:#fff;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">Tus credenciales de acceso</span></td></tr>
            <tr><td style="padding:20px 18px;">
              <div style="font-size:11px;color:#78716c;font-weight:bold;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Correo institucional</div>
              <div style="font-family:'Courier New',Courier,monospace;font-size:14px;color:#1c1917;background:#f0e8e8;padding:8px 12px;border-radius:4px;margin-bottom:14px;">${data.email}</div>
              <div style="font-size:11px;color:#78716c;font-weight:bold;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Contraseña temporal</div>
              <div style="font-family:'Courier New',Courier,monospace;font-size:24px;font-weight:bold;color:#6b1530;letter-spacing:6px;background:#fdf2f4;border:1px dashed #c43759;padding:12px 18px;border-radius:4px;">${data.passwordTemporal}</div>
              <div style="font-size:12px;color:#a02440;margin-top:8px;font-style:italic;">Cambia esta contraseña al ingresar por primera vez.</div>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:0 32px 24px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;">
            <tr><td>
              <div style="font-size:11px;font-weight:bold;letter-spacing:2px;color:#166534;text-transform:uppercase;margin-bottom:10px;">Tus responsabilidades</div>
              <ul style="color:#14532d;font-size:14px;line-height:1.9;margin:0;padding-left:20px;">
                <li>Dar de alta a aspirantes de tu municipio</li>
                <li>Revisar y subir documentos del expediente</li>
                <li>Dar seguimiento al proceso de inscripción</li>
                <li>Orientar a los alumnos durante su trayectoria</li>
              </ul>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:0 32px 28px 32px;" align="center">
          <a href="${data.portalUrl}" style="display:inline-block;background:#6b1530;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:16px 40px;border-radius:8px;letter-spacing:1px;text-transform:uppercase;">ACCEDER AL PANEL</a>
        </td></tr>
        <tr><td style="background:#f8f4ec;padding:16px 32px;border-top:1px solid #e2d9d0;">
          <p style="color:#78716c;font-size:11px;margin:0;text-align:center;"><strong>Instituto de Educación Media Superior y Superior — Gobierno de Michoacán</strong></p>
          <p style="color:#a8a29e;font-size:10px;margin:6px 0 0 0;text-align:center;line-height:1.5;">Este correo fue enviado desde <strong>Modula</strong> · Mensaje generado automáticamente.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const textPlain = `Bienvenido(a) ${data.nombreGestor},\n\nFuiste designado(a) Gestor Municipal de ${data.municipio} en Preparatoria Abierta Michoacán.\n\nCorreo: ${data.email}\nContraseña temporal: ${data.passwordTemporal}\n\nAccede en: ${data.portalUrl}`;

  return { subject, html, textPlain };
}
