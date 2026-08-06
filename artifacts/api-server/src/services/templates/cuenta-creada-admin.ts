import { escapeHtml } from '../../utils/escapeHtml';
import { emailLayout, emailDatosAcceso, emailBoton, emailBloqueGuia, EMAIL_COLORS } from './_shell';

export interface CuentaCreadaAdminData {
  nombre: string;
  email: string;
  passwordTemporal: string;
  portalUrl: string;
  esJefe: boolean;
}

/**
 * Bienvenida para una cuenta de Administración creada desde el panel del
 * creador (Sinapsis). Usa el shell compartido, así que hereda el encabezado
 * Módula 22. La contraseña es temporal: se cambia en el primer ingreso.
 */
export function cuentaCreadaAdminTemplate(data: CuentaCreadaAdminData): {
  subject: string;
  html: string;
  textPlain: string;
} {
  const subject = 'Tu acceso a Módula 22 · Administración';
  const { guinda, dorado, texto } = EMAIL_COLORS;
  const rolLabel = data.esJefe ? 'Administración · Titular' : 'Administración';

  const contenido = `
    <tr><td style="padding:30px 32px 8px 32px;">
      <div style="font-size:11px;font-weight:bold;letter-spacing:1.8px;color:${dorado};text-transform:uppercase;margin-bottom:8px;">Acceso al sistema</div>
      <h1 style="color:#1c1917;font-size:24px;margin:0 0 10px 0;font-family:Georgia,serif;">¡Hola, ${escapeHtml(data.nombre)}!</h1>
      <p style="color:${texto};font-size:14.5px;line-height:1.75;margin:0;">Se te dio acceso como <strong>${escapeHtml(rolLabel)}</strong> en <strong>Módula 22</strong>, la plataforma de Preparatoria Abierta del Gobierno de Michoacán. Desde aquí administras el programa: solicitudes, expedientes, calificaciones y pagos.</p>
    </td></tr>

    ${emailDatosAcceso(data.email, data.passwordTemporal)}

    <tr><td style="padding:22px 32px 26px 32px;" align="center">
      ${emailBoton(data.portalUrl, 'Entrar al panel →')}
    </td></tr>
  `;

  const html = emailLayout({ preheader: 'Tu acceso a Módula 22 ya está listo. Aquí están tus datos de acceso.', contenido: contenido + emailBloqueGuia(data.portalUrl, 'admin') });

  const textPlain = `Hola ${data.nombre},\n\nSe te dio acceso como ${rolLabel} en Módula 22 (Preparatoria Abierta Michoacán).\n\nCorreo: ${data.email}\nContraseña temporal: ${data.passwordTemporal}\n(La cambiarás al entrar por primera vez.)\n\nEntra en: ${data.portalUrl}\n\nTu guia paso a paso (PDF): ${data.portalUrl.replace(/\/$/, '')}/api/publico/guias/admin\n\nInstituto de Educación Media Superior y Superior — Gobierno de Michoacán`;

  return { subject, html, textPlain };
}
