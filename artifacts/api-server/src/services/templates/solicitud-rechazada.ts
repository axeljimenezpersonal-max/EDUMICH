import { escapeHtml } from '../../utils/escapeHtml';
import { emailLayout, emailBoton, EMAIL_COLORS } from './_shell';

export interface SolicitudRechazadaData {
  nombre: string;
  motivo: string;            // motivo principal (variable)
  detalle?: string | null;   // explicación adicional (opcional)
  contactoEmail?: string;    // correo de atención
  portalUrl?: string;        // enlace para volver a solicitar
}

/**
 * Correo para una solicitud de cuenta RECHAZADA.
 * El motivo (y el detalle opcional) se inyectan como variables.
 */
export function solicitudRechazadaTemplate(data: SolicitudRechazadaData): {
  subject: string;
  html: string;
  textPlain: string;
} {
  const contacto = data.contactoEmail || 'atencion.edumich@michoacan.gob.mx';
  const portal = data.portalUrl || 'https://edumich.up.railway.app/solicitar-cuenta';
  const subject = 'Sobre tu solicitud de cuenta · Preparatoria Abierta Michoacán';
  const { guinda, dorado, texto } = EMAIL_COLORS;

  const detalleBloque = data.detalle
    ? `<div style="border-top:1px solid #f0dcae;margin-top:12px;padding-top:12px;">
         <div style="font-size:10px;color:#92400e;font-weight:bold;letter-spacing:1px;text-transform:uppercase;margin-bottom:5px;">Detalle</div>
         <div style="font-size:13px;color:#7c5314;line-height:1.6;">${escapeHtml(data.detalle)}</div>
       </div>`
    : '';

  const contenido = `
    <tr><td style="padding:30px 32px 8px 32px;">
      <div style="font-size:11px;font-weight:bold;letter-spacing:1.8px;color:${dorado};text-transform:uppercase;margin-bottom:8px;">Solicitud de cuenta</div>
      <h1 style="color:#1c1917;font-size:23px;margin:0 0 10px 0;font-family:Georgia,serif;">Hola, ${escapeHtml(data.nombre)}</h1>
      <p style="color:${texto};font-size:14.5px;line-height:1.75;margin:0;">Gracias por tu interés en Preparatoria Abierta Michoacán. Revisamos tu solicitud con cuidado y, por ahora, <strong>no pudimos aprobarla</strong>. Queremos ayudarte a completarla.</p>
    </td></tr>

    <tr><td style="padding:20px 32px 4px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#fff8ec;border:1px solid #f6dfae;border-radius:12px;">
        <tr><td style="padding:16px 18px;">
          <div style="font-size:10px;color:#92400e;font-weight:bold;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">Motivo</div>
          <div style="font-size:14.5px;color:#7c2d12;line-height:1.55;font-weight:bold;">${escapeHtml(data.motivo)}</div>
          ${detalleBloque}
        </td></tr>
      </table>
    </td></tr>

    <tr><td style="padding:18px 32px 6px 32px;">
      <p style="color:${texto};font-size:14px;line-height:1.75;margin:0;">Puedes corregir lo indicado y <strong>volver a enviar tu solicitud</strong>. Es rápido y podrás retomar justo donde lo dejaste.</p>
    </td></tr>

    <tr><td style="padding:16px 32px 8px 32px;" align="center">
      ${emailBoton(portal, 'Volver a solicitar')}
    </td></tr>

    <tr><td style="padding:14px 32px 28px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#faf6ef;border:1px solid #ece3d6;border-radius:12px;">
        <tr><td style="padding:16px 18px;">
          <div style="font-size:10px;font-weight:bold;letter-spacing:1.4px;color:${guinda};text-transform:uppercase;margin-bottom:6px;">¿Necesitas ayuda?</div>
          <div style="font-size:13px;color:${texto};line-height:1.6;">Escríbenos a <strong style="color:${guinda};">${escapeHtml(contacto)}</strong> con tu nombre completo y CURP, y con gusto te orientamos.</div>
        </td></tr>
      </table>
    </td></tr>
  `;

  const html = emailLayout({ preheader: 'Revisamos tu solicitud. Aquí te decimos cómo continuar.', contenido });

  const textPlain = `Hola ${data.nombre},\n\nRevisamos tu solicitud de cuenta y por ahora no pudimos aprobarla.\n\nMotivo: ${data.motivo}${data.detalle ? `\nDetalle: ${data.detalle}` : ''}\n\nPuedes corregir lo indicado y volver a solicitar en: ${portal}\n¿Dudas? ${contacto}\n\nInstituto de Educación Media Superior y Superior — Gobierno de Michoacán`;

  return { subject, html, textPlain };
}
