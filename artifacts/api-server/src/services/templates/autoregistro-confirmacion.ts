export interface AutoregistroConfirmacionData {
  nombreCompleto: string;
  municipio: string;
  portalUrl: string;
}

export function autoregistroConfirmacionTemplate(data: AutoregistroConfirmacionData): {
  subject: string;
  html: string;
  textPlain: string;
} {
  const subject = 'Recibimos tu solicitud — Prepa Abierta Michoacán';

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f4ec;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f4ec;padding:32px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e2d9d0;max-width:580px;">
        <tr><td style="background:#7b1e3a;padding:24px 32px;">
          <div style="color:#fff;font-size:16px;font-weight:bold;line-height:1.2;">Prepa Abierta · IEMSyS</div>
          <div style="color:rgba(255,255,255,0.7);font-size:11px;letter-spacing:1.5px;text-transform:uppercase;">Gobierno de Michoacán</div>
        </td></tr>
        <tr><td style="padding:32px 32px 20px 32px;">
          <h1 style="color:#1c1917;font-size:22px;margin:0 0 12px 0;font-family:Georgia,serif;">Hola, ${data.nombreCompleto}</h1>
          <p style="color:#44403c;font-size:14px;line-height:1.7;margin:0 0 12px 0;">Recibimos tu solicitud de inscripción al programa <strong>Prepa Abierta Michoacán</strong>. Nos da mucho gusto que quieras continuar tu formación académica.</p>
        </td></tr>
        <tr><td style="padding:0 32px 24px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:20px;">
            <tr><td>
              <div style="font-size:11px;font-weight:bold;letter-spacing:2px;color:#1d4ed8;text-transform:uppercase;margin-bottom:12px;">¿Qué sigue?</div>
              ${[
                'Nuestro equipo revisará tu solicitud en los próximos días hábiles.',
                `Un gestor municipal de <strong>${data.municipio}</strong> te contactará para orientarte.`,
                'Cuando aprueben tu solicitud, recibirás un correo con tus datos de acceso.',
                'Mientras tanto, puedes ir reuniendo tu CURP, acta de nacimiento, INE y comprobante de domicilio.',
              ].map((paso, i) => `
              <table cellpadding="0" cellspacing="0" style="margin-bottom:10px;width:100%;"><tr>
                <td style="vertical-align:top;padding-right:12px;width:28px;">
                  <div style="background:#1d4ed8;color:#fff;border-radius:50%;width:22px;height:22px;text-align:center;line-height:22px;font-size:11px;font-weight:bold;">${i + 1}</div>
                </td>
                <td style="font-size:13px;color:#1e3a5f;line-height:1.6;">${paso}</td>
              </tr></table>`).join('')}
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:0 32px 28px 32px;">
          <p style="color:#78716c;font-size:13px;line-height:1.6;margin:0;font-style:italic;">"Terminar el bachillerato es posible sin importar tu edad o situación. El primer paso ya lo diste."</p>
        </td></tr>
        <tr><td style="background:#f8f4ec;padding:16px 32px;border-top:1px solid #e2d9d0;">
          <p style="color:#78716c;font-size:11px;margin:0;text-align:center;"><strong>Instituto de Educación Media Superior y Superior — Gobierno de Michoacán</strong></p>
          <p style="color:#a8a29e;font-size:10px;margin:6px 0 0 0;text-align:center;">Este correo fue enviado desde EDUMICH · Mensaje automático, no respondas.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const textPlain = `Hola ${data.nombreCompleto},\n\nRecibimos tu solicitud de inscripción a Prepa Abierta Michoacán.\n\nUn gestor de ${data.municipio} te contactará pronto.\n\nInstituto de Educación Media Superior y Superior — Gobierno de Michoacán`;

  return { subject, html, textPlain };
}
