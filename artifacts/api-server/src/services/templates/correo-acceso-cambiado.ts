import { escapeHtml } from '../../utils/escapeHtml';
import { emailLayout, emailBoton, EMAIL_COLORS } from './_shell';
import { CONTACTO_CORREO } from '../../config/contacto';

export interface CorreoAccesoCambiadoData {
  nombre: string;
  correoAnterior: string;
  correoNuevo: string;
  /** A cuál de las dos direcciones va este mensaje. Cambia el tono, no el dato. */
  destino: 'nueva' | 'anterior';
  loginUrl: string;
  contactoEmail?: string;
}

/**
 * Aviso de que el correo con el que se entra a la plataforma cambió.
 *
 * Se manda DOS veces: a la dirección nueva y a la anterior. La copia a la
 * anterior es la importante: si el cambio no lo pidió el dueño de la cuenta,
 * ése es el único aviso que va a recibir, porque a partir de ese momento ya no
 * puede entrar con el correo que conocía.
 *
 * No lleva contraseña ni enlace de sesión: solo dice qué pasó y a quién avisar
 * si estuvo mal.
 */
export function correoAccesoCambiadoTemplate(data: CorreoAccesoCambiadoData): {
  subject: string;
  html: string;
  textPlain: string;
} {
  const contacto = data.contactoEmail || CONTACTO_CORREO;
  const { guinda, dorado, texto } = EMAIL_COLORS;
  const aLaAnterior = data.destino === 'anterior';

  const subject = aLaAnterior
    ? 'Tu correo de acceso cambió · Modula · Plan 22'
    : 'Este es tu nuevo correo de acceso · Modula · Plan 22';

  const entrada = aLaAnterior
    ? 'La administración cambió el correo con el que entras a la plataforma. <strong>Esta dirección ya no sirve para iniciar sesión.</strong>'
    : 'La administración actualizó el correo con el que entras a la plataforma. <strong>A partir de ahora inicias sesión con esta dirección.</strong>';

  const contenido = `
    <tr><td style="padding:30px 32px 8px 32px;">
      <div style="font-size:11px;font-weight:bold;letter-spacing:1.8px;color:${dorado};text-transform:uppercase;margin-bottom:8px;">Acceso a la plataforma</div>
      <h1 style="color:#1c1917;font-size:23px;margin:0 0 10px 0;font-family:Georgia,serif;">Hola, ${escapeHtml(data.nombre)}</h1>
      <p style="color:${texto};font-size:14.5px;line-height:1.75;margin:0;">${entrada}</p>
    </td></tr>

    <tr><td style="padding:20px 32px 4px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#faf6ef;border:1px solid #ece3d6;border-radius:12px;">
        <tr><td style="padding:16px 18px;">
          <div style="font-size:10px;color:#78716c;font-weight:bold;letter-spacing:1px;text-transform:uppercase;margin-bottom:5px;">Antes entrabas con</div>
          <div style="font-size:14px;color:#78716c;line-height:1.5;text-decoration:line-through;">${escapeHtml(data.correoAnterior)}</div>
          <div style="border-top:1px solid #ece3d6;margin-top:12px;padding-top:12px;">
            <div style="font-size:10px;color:${guinda};font-weight:bold;letter-spacing:1px;text-transform:uppercase;margin-bottom:5px;">Ahora entras con</div>
            <div style="font-size:15px;color:#1c1917;line-height:1.5;font-weight:bold;">${escapeHtml(data.correoNuevo)}</div>
          </div>
        </td></tr>
      </table>
    </td></tr>

    <tr><td style="padding:18px 32px 6px 32px;">
      <p style="color:${texto};font-size:14px;line-height:1.75;margin:0;"><strong>Tu contraseña no cambió.</strong> Es la misma de siempre; lo único distinto es el correo con el que la usas.</p>
    </td></tr>

    <tr><td style="padding:16px 32px 8px 32px;" align="center">
      ${emailBoton(data.loginUrl, 'Ir a iniciar sesión')}
    </td></tr>

    <tr><td style="padding:14px 32px 28px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#fff8ec;border:1px solid #f6dfae;border-radius:12px;">
        <tr><td style="padding:16px 18px;">
          <div style="font-size:10px;font-weight:bold;letter-spacing:1.4px;color:#92400e;text-transform:uppercase;margin-bottom:6px;">¿Tú no pediste este cambio?</div>
          <div style="font-size:13px;color:#7c5314;line-height:1.6;">Avísanos de inmediato a <strong>${escapeHtml(contacto)}</strong>. Nadie debe cambiar tu correo de acceso sin que tú lo sepas.</div>
        </td></tr>
      </table>
    </td></tr>
  `;

  const html = emailLayout({
    preheader: aLaAnterior
      ? 'Esta dirección ya no sirve para iniciar sesión.'
      : 'A partir de ahora inicias sesión con esta dirección.',
    contenido,
  });

  const textPlain = `Hola ${data.nombre},\n\n${aLaAnterior
    ? 'La administracion cambio el correo con el que entras a la plataforma. Esta direccion ya no sirve para iniciar sesion.'
    : 'La administracion actualizo el correo con el que entras a la plataforma. A partir de ahora inicias sesion con esta direccion.'}\n\nAntes: ${data.correoAnterior}\nAhora: ${data.correoNuevo}\n\nTu contrasena NO cambio: es la misma de siempre.\n\nIniciar sesion: ${data.loginUrl}\n\nSi tu no pediste este cambio, avisanos de inmediato a ${contacto}.\n\nInstituto de Educacion Media Superior y Superior — Gobierno de Michoacan`;

  return { subject, html, textPlain };
}
