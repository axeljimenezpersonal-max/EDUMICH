import { escapeHtml } from '../../utils/escapeHtml';
import { emailLayout, emailBoton, EMAIL_COLORS } from './_shell';

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
  const subject = '¡Tu cuenta está lista! · Preparatoria Abierta Michoacán';
  const { guinda, dorado, texto, borde } = EMAIL_COLORS;

  const pasos: [string, string][] = [
    ['Inicia sesión', 'Entra al portal con tu correo y la contraseña temporal de arriba.'],
    ['Crea tu contraseña', 'En tu primer ingreso definirás una contraseña personal.'],
    ['Completa tu expediente', 'Sube CURP, acta, INE, comprobante, certificado y tu foto.'],
    ['Inscríbete a exámenes', 'Elige tus módulos y realiza tu pago para presentar.'],
  ];

  const gestorSection = data.gestor
    ? `<tr><td style="padding:4px 32px 26px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#fdf7f2;border:1px solid #efdcc9;border-radius:12px;">
          <tr><td style="padding:16px 18px;">
            <div style="font-size:10px;font-weight:bold;letter-spacing:1.6px;color:${guinda};text-transform:uppercase;margin-bottom:8px;">Tu gestor asignado</div>
            <div style="font-size:15px;font-weight:bold;color:#1c1917;">${escapeHtml(data.gestor.nombre)}</div>
            ${data.gestor.municipio ? `<div style="font-size:13px;color:${texto};margin-top:2px;">${escapeHtml(data.gestor.municipio)}</div>` : ''}
            ${data.gestor.telefono ? `<div style="font-size:13px;color:${texto};margin-top:2px;">${escapeHtml(data.gestor.telefono)}</div>` : ''}
          </td></tr>
        </table>
      </td></tr>`
    : '';

  const contenido = `
    <tr><td style="padding:30px 32px 8px 32px;">
      <div style="font-size:11px;font-weight:bold;letter-spacing:1.8px;color:${dorado};text-transform:uppercase;margin-bottom:8px;">Bienvenida</div>
      <h1 style="color:#1c1917;font-size:24px;margin:0 0 10px 0;font-family:Georgia,serif;">¡Hola, ${escapeHtml(data.nombreAlumno)}!</h1>
      <p style="color:${texto};font-size:14.5px;line-height:1.75;margin:0;">Nos alegra acompañarte. Tu cuenta en <strong>Preparatoria Abierta Michoacán</strong> ya está lista; con ella harás todo tu proceso en línea.</p>
    </td></tr>

    <tr><td style="padding:22px 32px 8px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#fdf8f9;border:1px solid #eccdd6;border-radius:14px;overflow:hidden;">
        <tr><td style="background:${guinda};padding:10px 20px;">
          <span style="color:#fff;font-size:10.5px;font-weight:bold;letter-spacing:1.6px;text-transform:uppercase;">Tus datos de acceso</span>
        </td></tr>
        <tr><td style="padding:20px;">
          <div style="font-size:10.5px;color:#9a8f86;font-weight:bold;letter-spacing:0.8px;text-transform:uppercase;margin-bottom:5px;">Correo</div>
          <div style="font-family:'Courier New',Courier,monospace;font-size:14px;color:#1c1917;background:#f3ebeb;padding:9px 13px;border-radius:7px;margin-bottom:14px;">${escapeHtml(data.email)}</div>
          <div style="font-size:10.5px;color:#9a8f86;font-weight:bold;letter-spacing:0.8px;text-transform:uppercase;margin-bottom:5px;">Contraseña temporal</div>
          <div style="font-family:'Courier New',Courier,monospace;font-size:22px;font-weight:bold;color:${guinda};letter-spacing:4px;background:#fdf2f4;border:1px dashed #d08ba0;padding:12px 16px;border-radius:8px;text-align:center;">${escapeHtml(data.passwordTemporal)}</div>
          <div style="font-size:12px;color:#a24a63;margin-top:9px;text-align:center;">La cambiarás al entrar por primera vez.</div>
        </td></tr>
      </table>
    </td></tr>

    <tr><td style="padding:22px 32px 6px 32px;" align="center">
      ${emailBoton(data.portalUrl, 'Entrar al portal →')}
    </td></tr>

    <tr><td style="padding:20px 32px 8px 32px;">
      <div style="font-size:11px;font-weight:bold;letter-spacing:1.6px;color:${guinda};text-transform:uppercase;margin-bottom:14px;">Próximos pasos</div>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        ${pasos.map(([titulo, desc], i) => `
        <tr>
          <td width="40" valign="top" style="padding:0 0 14px 0;">
            <div style="width:28px;height:28px;background:#f6ede0;border:1px solid ${dorado};border-radius:50%;color:${guinda};font-size:13px;font-weight:bold;text-align:center;line-height:28px;">${i + 1}</div>
          </td>
          <td valign="top" style="padding:0 0 14px 0;border-bottom:${i < pasos.length - 1 ? `1px solid ${borde}` : '0'};">
            <div style="font-size:14px;font-weight:bold;color:#1c1917;line-height:1.3;">${titulo}</div>
            <div style="font-size:13px;color:#6b635b;line-height:1.55;margin-top:1px;">${desc}</div>
          </td>
        </tr>`).join('')}
      </table>
    </td></tr>

    ${gestorSection}
  `;

  const html = emailLayout({ preheader: 'Tu cuenta ya está lista. Aquí están tus datos de acceso.', contenido });

  const textPlain = `Hola ${data.nombreAlumno},\n\n¡Tu cuenta en Preparatoria Abierta Michoacán ya está lista!\n\nCorreo: ${data.email}\nContraseña temporal: ${data.passwordTemporal}\n(La cambiarás al entrar por primera vez.)\n\nEntra en: ${data.portalUrl}\n\nPróximos pasos:\n1. Inicia sesión.\n2. Crea tu contraseña.\n3. Completa tu expediente.\n4. Inscríbete a exámenes.\n\nInstituto de Educación Media Superior y Superior — Gobierno de Michoacán`;

  return { subject, html, textPlain };
}
