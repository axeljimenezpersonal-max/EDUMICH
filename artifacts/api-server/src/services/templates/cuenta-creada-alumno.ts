import { escapeHtml } from '../../utils/escapeHtml';

export interface CuentaCreadaAlumnoData {
  nombreAlumno: string;
  email: string;
  passwordTemporal: string;
  portalUrl: string;
  gestor?: { nombre: string; telefono: string | null; municipio: string | null };
}

export function cuentaCreadaAlumnoTemplate(data: CuentaCreadaAlumnoData): {
  subject: string;
  html: string;
  textPlain: string;
} {
  const subject = '¡Bienvenido a Preparatoria Abierta Michoacán! Tus datos de acceso';

  const gestorSection = data.gestor
    ? `<tr><td style="padding:0 32px 24px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#fdf2f4;border:1px solid #e8c4cc;border-radius:8px;padding:20px;">
          <tr><td>
            <div style="font-size:10px;font-weight:bold;letter-spacing:2px;color:#7b1e3a;text-transform:uppercase;margin-bottom:10px;">Tu gestor asignado</div>
            <div style="font-size:15px;font-weight:bold;color:#1c1917;margin-bottom:4px;">${escapeHtml(data.gestor.nombre)}</div>
            ${data.gestor.municipio ? `<div style="font-size:13px;color:#44403c;margin-bottom:4px;">${escapeHtml(data.gestor.municipio)}</div>` : ''}
            ${data.gestor.telefono ? `<div style="font-size:13px;color:#44403c;margin-bottom:10px;">${escapeHtml(data.gestor.telefono)}</div>` : ''}
            <div style="font-size:13px;color:#44403c;line-height:1.6;">Si tienes dudas, contacta a tu gestor o visita las oficinas.</div>
          </td></tr>
        </table>
      </td></tr>`
    : `<tr><td style="padding:0 32px 24px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f4ec;border:1px solid #e2d9d0;border-radius:8px;padding:20px;">
          <tr><td>
            <div style="font-size:10px;font-weight:bold;letter-spacing:2px;color:#78716c;text-transform:uppercase;margin-bottom:8px;">Atención a usuarios</div>
            <div style="font-size:13px;color:#44403c;line-height:1.6;">Si tienes dudas, comunícate con las oficinas del IEMSyS en tu municipio.</div>
          </td></tr>
        </table>
      </td></tr>`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f4ec;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f4ec;padding:32px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e2d9d0;max-width:580px;">
        <tr><td style="background:#7b1e3a;padding:24px 32px;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="padding-left:0;">
              <div style="color:#fff;font-size:16px;font-weight:bold;line-height:1.2;">Preparatoria Abierta · IEMSyS</div>
              <div style="color:rgba(255,255,255,0.7);font-size:11px;letter-spacing:1.5px;text-transform:uppercase;">Gobierno de Michoacán</div>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:32px 32px 20px 32px;">
          <h1 style="color:#1c1917;font-size:22px;margin:0 0 12px 0;font-family:Georgia,serif;">¡Hola, ${escapeHtml(data.nombreAlumno)}!</h1>
          <p style="color:#44403c;font-size:14px;line-height:1.7;margin:0;">Te damos la bienvenida al <strong>Sistema de Gestión de Preparatoria Abierta</strong> del Gobierno de Michoacán.</p>
        </td></tr>
        <tr><td style="padding:0 32px 24px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#fdf8f9;border:2px solid #7b1e3a;border-radius:8px;overflow:hidden;">
            <tr><td style="background:#7b1e3a;padding:10px 18px;"><span style="color:#fff;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">Tus datos de acceso</span></td></tr>
            <tr><td style="padding:20px 18px;">
              <div style="font-size:11px;color:#78716c;font-weight:bold;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Correo electrónico</div>
              <div style="font-family:'Courier New',Courier,monospace;font-size:14px;color:#1c1917;background:#f0e8e8;padding:8px 12px;border-radius:4px;margin-bottom:14px;">${data.email}</div>
              <div style="font-size:11px;color:#78716c;font-weight:bold;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Contraseña temporal</div>
              <div style="font-family:'Courier New',Courier,monospace;font-size:24px;font-weight:bold;color:#7b1e3a;letter-spacing:6px;background:#fdf2f4;border:1px dashed #c43759;padding:12px 18px;border-radius:4px;">${data.passwordTemporal}</div>
              <div style="font-size:12px;color:#a02440;margin-top:8px;font-style:italic;">Esta contraseña es temporal. La cambiarás al entrar por primera vez.</div>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:0 32px 28px 32px;" align="center">
          <a href="${data.portalUrl}" style="display:inline-block;background:#7b1e3a;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:16px 40px;border-radius:8px;letter-spacing:1px;text-transform:uppercase;">ENTRAR AL PORTAL</a>
        </td></tr>
        ${gestorSection}
        <tr><td style="background:#f8f4ec;padding:16px 32px;border-top:1px solid #e2d9d0;">
          <p style="color:#78716c;font-size:11px;margin:0;text-align:center;"><strong>Instituto de Educación Media Superior y Superior — Gobierno de Michoacán</strong></p>
          <p style="color:#a8a29e;font-size:10px;margin:6px 0 0 0;text-align:center;line-height:1.5;">Este correo fue enviado desde <strong>EDUMICH</strong> · Este mensaje fue generado automáticamente.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const textPlain = `Hola ${data.nombreAlumno},\n\nBienvenido a Preparatoria Abierta Michoacán.\n\nTus datos de acceso:\nCorreo: ${data.email}\nContraseña temporal: ${data.passwordTemporal}\n\nAccede en: ${data.portalUrl}\n\nInstituto de Educación Media Superior y Superior — Gobierno de Michoacán`;

  return { subject, html, textPlain };
}
