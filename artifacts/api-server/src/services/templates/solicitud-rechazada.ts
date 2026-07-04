import { escapeHtml } from '../../utils/escapeHtml';

export interface SolicitudRechazadaData {
  nombre: string;
  motivo: string;            // motivo principal (variable)
  detalle?: string | null;   // explicación adicional (opcional)
  contactoEmail?: string;    // correo de atención
  portalUrl?: string;        // enlace para volver a solicitar
}

/**
 * Plantilla de correo para una solicitud de cuenta RECHAZADA.
 * El motivo (y el detalle opcional) se inyectan como variables.
 */
export function solicitudRechazadaTemplate(data: SolicitudRechazadaData): {
  subject: string;
  html: string;
  textPlain: string;
} {
  const contacto = data.contactoEmail || 'atencion.edumich@michoacan.gob.mx';
  const portal = data.portalUrl || 'https://edumich.up.railway.app/solicitar-cuenta';
  const subject = 'Sobre tu solicitud de cuenta — Preparatoria Abierta Michoacán';

  const detalleBloque = data.detalle
    ? `<tr><td style="padding:14px 18px 0 18px;">
         <div style="font-size:11px;color:#78716c;font-weight:bold;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">Detalle</div>
         <div style="font-size:13px;color:#44403c;line-height:1.6;">${escapeHtml(data.detalle)}</div>
       </td></tr>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f4ec;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f4ec;padding:32px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e2d9d0;max-width:580px;">
        <tr><td style="background:#7b1e3a;padding:24px 32px;">
          <div style="color:#fff;font-size:16px;font-weight:bold;line-height:1.2;">Preparatoria Abierta · IEMSyS</div>
          <div style="color:rgba(255,255,255,0.7);font-size:11px;letter-spacing:1.5px;text-transform:uppercase;">Gobierno de Michoacán</div>
        </td></tr>
        <tr><td style="padding:32px 32px 16px 32px;">
          <div style="font-size:11px;font-weight:bold;letter-spacing:2px;color:#7b1e3a;text-transform:uppercase;margin-bottom:12px;">Solicitud de cuenta</div>
          <h1 style="color:#1c1917;font-size:22px;margin:0 0 12px 0;font-family:Georgia,serif;">Hola, ${escapeHtml(data.nombre)}</h1>
          <p style="color:#44403c;font-size:14px;line-height:1.7;margin:0;">
            Agradecemos tu interés en Preparatoria Abierta Michoacán. Revisamos tu solicitud de cuenta y,
            por el momento, <strong>no fue aprobada</strong>.
          </p>
        </td></tr>
        <tr><td style="padding:0 32px 8px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed;border:1px solid #fed7aa;border-left:4px solid #c77700;border-radius:8px;">
            <tr><td style="padding:14px 18px;">
              <div style="font-size:11px;color:#92400e;font-weight:bold;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">Motivo</div>
              <div style="font-size:14px;color:#7c2d12;line-height:1.6;font-weight:bold;">${escapeHtml(data.motivo)}</div>
            </td></tr>
            ${detalleBloque}
          </table>
        </td></tr>
        <tr><td style="padding:20px 32px 8px 32px;">
          <p style="color:#44403c;font-size:14px;line-height:1.7;margin:0;">
            Puedes corregir lo indicado y <strong>volver a enviar tu solicitud</strong>. Si crees que se trata de un
            error o necesitas ayuda, escríbenos y con gusto te orientamos.
          </p>
        </td></tr>
        <tr><td style="padding:16px 32px 28px 32px;" align="center">
          <a href="${portal}" style="display:inline-block;background:#7b1e3a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:14px 34px;border-radius:8px;">Volver a solicitar</a>
        </td></tr>
        <tr><td style="padding:0 32px 24px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f4ec;border:1px solid #e2d9d0;border-radius:8px;">
            <tr><td style="padding:16px 18px;">
              <div style="font-size:10px;font-weight:bold;letter-spacing:2px;color:#78716c;text-transform:uppercase;margin-bottom:6px;">¿Dudas?</div>
              <div style="font-size:13px;color:#44403c;line-height:1.6;">Escríbenos a <strong style="color:#7b1e3a;">${escapeHtml(contacto)}</strong> con tu nombre completo y CURP.</div>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="background:#f8f4ec;padding:16px 32px;border-top:1px solid #e2d9d0;">
          <p style="color:#a8a29e;font-size:10px;margin:0;text-align:center;line-height:1.5;">EDUMICH · Plataforma Educativa Digital · Gobierno de Michoacán</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const textPlain = `Hola ${data.nombre},\n\nRevisamos tu solicitud de cuenta y por el momento no fue aprobada.\n\nMotivo: ${data.motivo}${data.detalle ? `\nDetalle: ${data.detalle}` : ''}\n\nPuedes corregir lo indicado y volver a solicitar en: ${portal}\nDudas: ${contacto}\n\nEDUMICH · Gobierno de Michoacán`;

  return { subject, html, textPlain };
}
