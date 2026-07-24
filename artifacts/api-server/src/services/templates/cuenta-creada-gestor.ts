import { escapeHtml } from '../../utils/escapeHtml';
import { emailLayout, emailBoton, EMAIL_COLORS } from './_shell';

export interface CuentaCreadaGestorData {
  nombreGestor: string;
  email: string;
  passwordTemporal: string;
  municipio: string;
  portalUrl: string;
}

/**
 * Bienvenida para un gestor (centro de asesoría). Usa el shell compartido, así
 * que hereda el encabezado Módula 22 igual que los correos de alumno y admin.
 * La contraseña es temporal: se cambia en el primer ingreso.
 */
export function cuentaCreadaGestorTemplate(data: CuentaCreadaGestorData): {
  subject: string;
  html: string;
  textPlain: string;
} {
  const subject = 'Tu acceso a Módula 22 · Gestor de Preparatoria Abierta';
  const { guinda, dorado, texto, borde } = EMAIL_COLORS;

  const responsabilidades = [
    'Dar de alta a aspirantes de tu municipio.',
    'Revisar y subir los documentos del expediente.',
    'Dar seguimiento al proceso de inscripción.',
    'Orientar a los alumnos durante su trayectoria.',
  ];

  const contenido = `
    <tr><td style="padding:30px 32px 8px 32px;">
      <div style="font-size:11px;font-weight:bold;letter-spacing:1.8px;color:${dorado};text-transform:uppercase;margin-bottom:8px;">Designación como gestor</div>
      <h1 style="color:#1c1917;font-size:24px;margin:0 0 10px 0;font-family:Georgia,serif;">¡Bienvenido(a), ${escapeHtml(data.nombreGestor)}!</h1>
      <p style="color:${texto};font-size:14.5px;line-height:1.75;margin:0;">Fuiste designado(a) como <strong>Gestor de ${escapeHtml(data.municipio)}</strong> en <strong>Módula 22</strong>, la plataforma de Preparatoria Abierta del Gobierno de Michoacán. Desde tu panel acompañas a los alumnos de tu centro de asesoría.</p>
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
      ${emailBoton(data.portalUrl, 'Entrar al panel →')}
    </td></tr>

    <tr><td style="padding:20px 32px 26px 32px;">
      <div style="font-size:11px;font-weight:bold;letter-spacing:1.6px;color:${guinda};text-transform:uppercase;margin-bottom:12px;">Tus responsabilidades</div>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        ${responsabilidades.map((r, i) => `
        <tr>
          <td width="26" valign="top" style="padding:0 0 10px 0;">
            <div style="width:16px;height:16px;background:#f6ede0;border:1px solid ${dorado};border-radius:50%;color:${guinda};font-size:10px;font-weight:bold;text-align:center;line-height:16px;">✓</div>
          </td>
          <td valign="top" style="padding:0 0 10px 0;border-bottom:${i < responsabilidades.length - 1 ? `1px solid ${borde}` : '0'};">
            <div style="font-size:13.5px;color:#4b453f;line-height:1.5;">${r}</div>
          </td>
        </tr>`).join('')}
      </table>
    </td></tr>
  `;

  const html = emailLayout({ preheader: 'Tu acceso como gestor ya está listo. Aquí están tus datos.', contenido });

  const textPlain = `Bienvenido(a) ${data.nombreGestor},\n\nFuiste designado(a) como Gestor de ${data.municipio} en Módula 22 (Preparatoria Abierta Michoacán).\n\nCorreo: ${data.email}\nContraseña temporal: ${data.passwordTemporal}\n(La cambiarás al entrar por primera vez.)\n\nEntra en: ${data.portalUrl}\n\nInstituto de Educación Media Superior y Superior — Gobierno de Michoacán`;

  return { subject, html, textPlain };
}
