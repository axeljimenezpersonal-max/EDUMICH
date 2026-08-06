import { escapeHtml } from '../../utils/escapeHtml';
import { emailLayout, EMAIL_COLORS } from './_shell';
import { CONTACTO_CORREO } from '../../config/contacto';

export interface ExamenDeManana {
  modulo: string;
  hora: string;
  sede: string;
  direccion: string;
}

export interface RecordatorioExamenAlumnoData {
  nombre: string;
  /** "sábado 22 de agosto" — ya formateada en hora de Michoacán. */
  fechaLarga: string;
  examenes: ExamenDeManana[];
}

/**
 * "Mañana presentas": el recordatorio del alumno, la víspera de su examen.
 *
 * Lo que decide si este correo sirve es lo que trae ARRIBA: hora, sede y
 * dirección. Alguien que lo abre en el camión a las 7 de la mañana no necesita
 * ánimos, necesita saber a dónde va. Por eso los datos van primero y el resto
 * es breve.
 *
 * No lleva enlaces al portal como acción principal: a esa hora el alumno puede
 * no tener datos ni batería. Lo importante tiene que caber en el propio correo.
 */
export function recordatorioExamenAlumnoTemplate(data: RecordatorioExamenAlumnoData): {
  subject: string;
  html: string;
  textPlain: string;
} {
  const { guinda, dorado, texto } = EMAIL_COLORS;
  const varios = data.examenes.length > 1;
  const subject = varios
    ? `Mañana presentas ${data.examenes.length} exámenes · Preparatoria Abierta`
    : 'Mañana es tu examen · Preparatoria Abierta';

  const tarjetas = data.examenes
    .map(
      (e) => `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#faf6ef;border:1px solid #ece3d6;border-radius:12px;margin-bottom:10px;">
      <tr><td style="padding:16px 18px;">
        <div style="font-size:10px;color:${dorado};font-weight:bold;letter-spacing:1.4px;text-transform:uppercase;">Módulo</div>
        <div style="font-size:15px;font-weight:bold;color:#1c1917;margin:3px 0 12px;">${escapeHtml(e.modulo)}</div>
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td style="padding:0 0 8px 0;font-size:12px;color:#78716c;width:70px;">Hora</td>
            <td style="padding:0 0 8px 0;font-size:15px;font-weight:bold;color:${guinda};">${escapeHtml(e.hora)}</td>
          </tr>
          <tr>
            <td style="padding:0;font-size:12px;color:#78716c;vertical-align:top;">Sede</td>
            <td style="padding:0;font-size:13.5px;color:#3f3a35;line-height:1.5;">
              <strong>${escapeHtml(e.sede)}</strong><br/>${escapeHtml(e.direccion)}
            </td>
          </tr>
        </table>
      </td></tr>
    </table>`,
    )
    .join('');

  const contenido = `
    <tr><td style="padding:30px 32px 6px 32px;">
      <div style="font-size:11px;font-weight:bold;letter-spacing:1.8px;color:${dorado};text-transform:uppercase;margin-bottom:8px;">Mañana · ${escapeHtml(data.fechaLarga)}</div>
      <h1 style="color:#1c1917;font-size:23px;margin:0 0 8px 0;font-family:Georgia,serif;">
        ${varios ? 'Mañana presentas tus exámenes' : 'Mañana es tu examen'}
      </h1>
      <p style="color:${texto};font-size:14.5px;line-height:1.7;margin:0;">Hola, ${escapeHtml(data.nombre)}. Esto es lo que necesitas saber:</p>
    </td></tr>

    <tr><td style="padding:16px 32px 4px 32px;">${tarjetas}</td></tr>

    <tr><td style="padding:8px 32px 6px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#fff8ec;border:1px solid #f6dfae;border-radius:12px;">
        <tr><td style="padding:16px 18px;">
          <div style="font-size:10px;font-weight:bold;letter-spacing:1.4px;color:#92400e;text-transform:uppercase;margin-bottom:6px;">Lleva contigo</div>
          <div style="font-size:13.5px;color:#7c5314;line-height:1.7;">
            Una <strong>identificación con fotografía</strong> y tu <strong>pase de examen</strong>
            —impreso o en el celular—. Llega <strong>30 minutos antes</strong>.
          </div>
        </td></tr>
      </table>
    </td></tr>

    <tr><td style="padding:14px 32px 28px 32px;">
      <p style="color:#a8a29e;font-size:12px;line-height:1.6;margin:0;">
        ¿Algo no cuadra? Habla con tu centro de asesoría, o escríbenos a
        <strong style="color:${guinda};">${escapeHtml(CONTACTO_CORREO)}</strong>.
      </p>
    </td></tr>
  `;

  const html = emailLayout({
    preheader: `${data.examenes[0]?.hora ?? ''} · ${data.examenes[0]?.sede ?? ''}`,
    contenido,
  });

  const lineas = data.examenes
    .map((e) => `- ${e.modulo}\n  Hora: ${e.hora}\n  Sede: ${e.sede}, ${e.direccion}`)
    .join('\n');

  const textPlain = `Hola ${data.nombre},\n\n${varios ? 'Manana presentas tus examenes' : 'Manana es tu examen'} (${data.fechaLarga}):\n\n${lineas}\n\nLleva identificacion con fotografia y tu pase de examen. Llega 30 minutos antes.\n\nDudas: ${CONTACTO_CORREO}\n\nInstituto de Educacion Media Superior y Superior — Gobierno de Michoacan`;

  return { subject, html, textPlain };
}
