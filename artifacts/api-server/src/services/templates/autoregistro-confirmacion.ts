import { escapeHtml } from '../../utils/escapeHtml';
import { emailLayout, EMAIL_COLORS } from './_shell';

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
  const subject = '¡Recibimos tu solicitud! · Preparatoria Abierta Michoacán';
  const { guinda, dorado, texto, borde } = EMAIL_COLORS;

  const pasos: string[] = [
    'Revisamos tu solicitud en los próximos días hábiles.',
    `Un gestor municipal de <strong>${escapeHtml(data.municipio)}</strong> puede contactarte para orientarte.`,
    'Cuando se apruebe, recibirás un correo con tus datos de acceso.',
    'Mientras tanto, ve reuniendo tu CURP, acta de nacimiento, INE y comprobante de domicilio.',
  ];

  const contenido = `
    <tr><td style="padding:30px 32px 6px 32px;" align="center">
      <div style="width:64px;height:64px;border-radius:50%;background:#e7f6ee;text-align:center;line-height:64px;margin:0 auto 6px;">
        <span style="color:#0f9d58;font-size:32px;font-weight:bold;">✓</span>
      </div>
    </td></tr>
    <tr><td style="padding:6px 32px 8px 32px;" align="center">
      <div style="font-size:11px;font-weight:bold;letter-spacing:1.8px;color:${dorado};text-transform:uppercase;margin-bottom:6px;">Solicitud recibida</div>
      <h1 style="color:#1c1917;font-size:24px;margin:0 0 10px 0;font-family:Georgia,serif;">¡Gracias, ${escapeHtml(data.nombreCompleto)}!</h1>
      <p style="color:${texto};font-size:14.5px;line-height:1.75;margin:0;max-width:400px;">Recibimos tu solicitud para <strong>Preparatoria Abierta Michoacán</strong>. Nos da mucho gusto que quieras continuar tu formación.</p>
    </td></tr>

    <tr><td style="padding:22px 32px 8px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid ${borde};border-radius:14px;">
        <tr><td style="padding:18px 20px 6px 20px;">
          <div style="font-size:11px;font-weight:bold;letter-spacing:1.6px;color:${guinda};text-transform:uppercase;margin-bottom:12px;">¿Qué sigue?</div>
        </td></tr>
        ${pasos.map((paso, i) => `
        <tr><td style="padding:0 20px ${i < pasos.length - 1 ? '14px' : '18px'} 20px;">
          <table cellpadding="0" cellspacing="0" role="presentation" width="100%"><tr>
            <td width="36" valign="top">
              <div style="width:26px;height:26px;background:#f6ede0;border:1px solid ${dorado};border-radius:50%;color:${guinda};font-size:12px;font-weight:bold;text-align:center;line-height:26px;">${i + 1}</div>
            </td>
            <td valign="top" style="font-size:13.5px;color:#5f574f;line-height:1.6;padding-top:3px;">${paso}</td>
          </tr></table>
        </td></tr>`).join('')}
      </table>
    </td></tr>

    <tr><td style="padding:16px 32px 30px 32px;">
      <div style="background:#fdf8f9;border-left:3px solid ${dorado};border-radius:0 8px 8px 0;padding:14px 18px;">
        <p style="color:#6b635b;font-size:13.5px;line-height:1.65;margin:0;font-style:italic;">"Terminar el bachillerato es posible sin importar tu edad o tu situación. El primer paso ya lo diste."</p>
      </div>
    </td></tr>
  `;

  const html = emailLayout({ preheader: 'Recibimos tu solicitud de cuenta. Esto es lo que sigue.', contenido });

  const textPlain = `Hola ${data.nombreCompleto},\n\n¡Recibimos tu solicitud para Preparatoria Abierta Michoacán!\n\n¿Qué sigue?\n1. Revisamos tu solicitud en los próximos días hábiles.\n2. Un gestor de ${data.municipio} puede contactarte.\n3. Al aprobarse, recibirás un correo con tus datos de acceso.\n4. Ve reuniendo tu CURP, acta, INE y comprobante de domicilio.\n\nInstituto de Educación Media Superior y Superior — Gobierno de Michoacán`;

  return { subject, html, textPlain };
}
