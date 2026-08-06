import { escapeHtml } from '../../utils/escapeHtml';
import { emailLayout, EMAIL_COLORS } from './_shell';
import { CONTACTO_CORREO } from '../../config/contacto';

export interface AlumnoDeManana {
  nombre: string;
  modulo: string;
  hora: string;
  sede: string;
}

export interface RecordatorioExamenCentroData {
  nombreCentro: string;
  /** "sábado 22 de agosto" — ya formateada en hora de Michoacán. */
  fechaLarga: string;
  alumnos: AlumnoDeManana[];
}

/**
 * "Mañana presentan tus alumnos": el recordatorio del centro de asesoría.
 *
 * Es un correo distinto al del alumno, no el mismo reenviado. El alumno
 * necesita saber a dónde va; el centro necesita saber A QUIÉN le toca, para
 * poder llamar a quien no confirmó o resolver un traslado la noche anterior.
 * Por eso aquí manda la LISTA, con nombre, módulo y hora.
 *
 * Va ordenada por hora: es el orden en que el centro va a necesitarla.
 */
export function recordatorioExamenCentroTemplate(data: RecordatorioExamenCentroData): {
  subject: string;
  html: string;
  textPlain: string;
} {
  const { guinda, dorado, texto } = EMAIL_COLORS;
  const n = data.alumnos.length;
  const subject = `Mañana presentan ${n} ${n === 1 ? 'alumno' : 'alumnos'} de tu centro · Preparatoria Abierta`;

  const filas = data.alumnos
    .map(
      (a, i) => `
      <tr>
        <td style="padding:9px 10px 9px 0;border-bottom:${i < n - 1 ? '1px solid #ece3d6' : '0'};font-size:13.5px;color:#1c1917;">
          <strong>${escapeHtml(a.nombre)}</strong><br/>
          <span style="font-size:12px;color:#78716c;">${escapeHtml(a.modulo)}</span>
        </td>
        <td style="padding:9px 0;border-bottom:${i < n - 1 ? '1px solid #ece3d6' : '0'};font-size:13.5px;font-weight:bold;color:${guinda};white-space:nowrap;vertical-align:top;text-align:right;">
          ${escapeHtml(a.hora)}<br/>
          <span style="font-size:11px;font-weight:normal;color:#a8a29e;">${escapeHtml(a.sede)}</span>
        </td>
      </tr>`,
    )
    .join('');

  const contenido = `
    <tr><td style="padding:30px 32px 6px 32px;">
      <div style="font-size:11px;font-weight:bold;letter-spacing:1.8px;color:${dorado};text-transform:uppercase;margin-bottom:8px;">Mañana · ${escapeHtml(data.fechaLarga)}</div>
      <h1 style="color:#1c1917;font-size:23px;margin:0 0 8px 0;font-family:Georgia,serif;">
        ${n === 1 ? 'Mañana presenta un alumno tuyo' : `Mañana presentan ${n} de tus alumnos`}
      </h1>
      <p style="color:${texto};font-size:14.5px;line-height:1.7;margin:0;">
        ${escapeHtml(data.nombreCentro)} — ésta es tu lista, en el orden en que les toca.
      </p>
    </td></tr>

    <tr><td style="padding:16px 32px 6px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#faf6ef;border:1px solid #ece3d6;border-radius:12px;">
        <tr><td style="padding:6px 18px 10px 18px;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">${filas}</table>
        </td></tr>
      </table>
    </td></tr>

    <tr><td style="padding:10px 32px 6px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#fff8ec;border:1px solid #f6dfae;border-radius:12px;">
        <tr><td style="padding:16px 18px;">
          <div style="font-size:10px;font-weight:bold;letter-spacing:1.4px;color:#92400e;text-transform:uppercase;margin-bottom:6px;">Hoy todavía se puede</div>
          <div style="font-size:13.5px;color:#7c5314;line-height:1.7;">
            A cada uno le llegó este mismo aviso con su hora y su sede. Si alguno no
            te ha confirmado, hoy es el día de llamarle: mañana ya no hay margen.
          </div>
        </td></tr>
      </table>
    </td></tr>

    <tr><td style="padding:14px 32px 28px 32px;">
      <p style="color:#a8a29e;font-size:12px;line-height:1.6;margin:0;">
        ¿Un dato no cuadra? Escríbenos a <strong style="color:${guinda};">${escapeHtml(CONTACTO_CORREO)}</strong>.
      </p>
    </td></tr>
  `;

  const html = emailLayout({
    preheader: `${n} ${n === 1 ? 'alumno' : 'alumnos'} · ${data.fechaLarga}`,
    contenido,
  });

  const lineas = data.alumnos
    .map((a) => `- ${a.hora}  ${a.nombre} — ${a.modulo} (${a.sede})`)
    .join('\n');

  const textPlain = `${data.nombreCentro},\n\nManana ${data.fechaLarga} presentan ${n} de tus alumnos:\n\n${lineas}\n\nA cada uno le llego este mismo aviso con su hora y su sede. Si alguno no te ha confirmado, hoy es el dia de llamarle.\n\nDudas: ${CONTACTO_CORREO}\n\nInstituto de Educacion Media Superior y Superior — Gobierno de Michoacan`;

  return { subject, html, textPlain };
}
