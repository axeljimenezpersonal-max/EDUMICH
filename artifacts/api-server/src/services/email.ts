import { Resend } from 'resend';
import { db } from '../db';
import { outbox } from '@workspace/db/schema';
import { cuentaCreadaAlumnoTemplate } from './templates/cuenta-creada-alumno';
import { cuentaCreadaGestorTemplate } from './templates/cuenta-creada-gestor';
import { escapeHtml } from '../utils/escapeHtml';

// ─── Configuración de modo ────────────────────────────────────────────────

type EmailMode = 'demo' | 'prod' | 'dev';

function getEmailMode(): EmailMode {
  const raw = process.env.EMAIL_MODE ?? 'dev';
  if (raw === 'demo') return 'demo';
  if (raw === 'prod' || raw === 'production') return 'prod';
  return 'dev';
}

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// ─── Tipos ────────────────────────────────────────────────────────────────

type OutboxEvento =
  | 'cuenta_creada_alumno'
  | 'cuenta_creada_gestor'
  | 'autoregistro_alumno'
  | 'notificacion_admin_autoregistro'
  | 'aviso_eliminacion_cuenta'
  | 'recuperar_password'
  | 'verificacion_email';

interface SendEmailOptions {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  textPlain?: string;
  evento: OutboxEvento;
  triggeredBy?: number;
  relatedUserId?: number;
  metadata?: Record<string, unknown>;
}

// ─── Función central ─────────────────────────────────────────────────────

export async function sendEmail(
  opts: SendEmailOptions
): Promise<{ enviado: boolean; modo: 'dev' | 'production' }> {
  const mode = getEmailMode();
  const cc = process.env.INSTITUTIONAL_CC_EMAIL ?? undefined;
  const fromEmail = process.env.EMAIL_FROM ?? 'noreply@edumich.up.railway.app';
  const fromName = 'Preparatoria Abierta Michoacán';

  if (mode === 'dev') {
    console.log(`\n📧 [DEV EMAIL] ${opts.evento} → ${opts.to} | ${opts.subject}\n`);
    return { enviado: true, modo: 'dev' };
  }

  if (mode === 'demo') {
    await new Promise(r => setTimeout(r, 300 + Math.random() * 200));
    try {
      await db.insert(outbox).values({
        toEmail: opts.to,
        toName: opts.toName ?? null,
        ccEmail: cc ?? null,
        fromEmail,
        fromName,
        subject: opts.subject,
        html: opts.html,
        textPlain: opts.textPlain ?? null,
        evento: opts.evento,
        estado: 'demo_mode',
        triggeredByUserId: opts.triggeredBy ?? null,
        relatedUserId: opts.relatedUserId ?? null,
        metadata: (opts.metadata ?? null) as any,
        sentAt: new Date(),
      });
    } catch (dbErr) {
      console.error('[OUTBOX] Error guardando en BD:', dbErr);
    }
    return { enviado: true, modo: 'production' };
  }

  // mode === 'prod'
  if (!resend) throw new Error('Resend no configurado (falta RESEND_API_KEY)');

  let estado: 'enviado' | 'fallido' = 'enviado';
  let errorMessage: string | null = null;

  try {
    await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: opts.to,
      cc: cc ? [cc] : undefined,
      subject: opts.subject,
      html: opts.html,
    });
  } catch (err) {
    estado = 'fallido';
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  try {
    await db.insert(outbox).values({
      toEmail: opts.to,
      toName: opts.toName ?? null,
      ccEmail: cc ?? null,
      fromEmail,
      fromName,
      subject: opts.subject,
      html: opts.html,
      textPlain: opts.textPlain ?? null,
      evento: opts.evento,
      estado,
      errorMessage,
      triggeredByUserId: opts.triggeredBy ?? null,
      relatedUserId: opts.relatedUserId ?? null,
      metadata: (opts.metadata ?? null) as any,
      sentAt: estado === 'enviado' ? new Date() : null,
    });
  } catch (dbErr) {
    console.error('[OUTBOX] Error guardando en BD:', dbErr);
  }

  if (estado === 'fallido') throw new Error(errorMessage!);
  return { enviado: true, modo: 'production' };
}

// ─── Bienvenida con credenciales para alumno ─────────────────────────────

export interface BienvenidaData {
  nombreAlumno: string;
  email: string;
  passwordTemporal: string;
  portalUrl: string;
  gestor?: { nombre: string; telefono: string | null; municipio: string | null };
}

export async function sendBienvenidaCredenciales(
  email: string,
  data: BienvenidaData,
  opts?: { triggeredBy?: number; relatedUserId?: number; metadata?: Record<string, unknown> }
): Promise<{ enviado: boolean; modo: 'dev' | 'production' }> {
  const { subject, html, textPlain } = cuentaCreadaAlumnoTemplate({
    nombreAlumno: data.nombreAlumno,
    email: data.email,
    passwordTemporal: data.passwordTemporal,
    portalUrl: data.portalUrl,
    gestor: data.gestor,
  });

  return sendEmail({
    to: email,
    toName: data.nombreAlumno,
    subject,
    html,
    textPlain,
    evento: 'cuenta_creada_alumno',
    triggeredBy: opts?.triggeredBy,
    relatedUserId: opts?.relatedUserId,
    metadata: opts?.metadata,
  });
}

export async function sendBienvenidaGestor(
  email: string,
  data: { nombreGestor: string; email: string; passwordTemporal: string; municipio: string; portalUrl: string },
  opts?: { triggeredBy?: number; relatedUserId?: number }
): Promise<{ enviado: boolean; modo: 'dev' | 'production' }> {
  const { subject, html, textPlain } = cuentaCreadaGestorTemplate(data);
  return sendEmail({
    to: email,
    toName: data.nombreGestor,
    subject,
    html,
    textPlain,
    evento: 'cuenta_creada_gestor',
    triggeredBy: opts?.triggeredBy,
    relatedUserId: opts?.relatedUserId,
    metadata: { municipio: data.municipio },
  });
}

// ─── Recuperación de contraseña ───────────────────────────────────────────

export interface RecuperarPasswordData {
  nombre: string;
  resetUrl: string;
  token: string;
}

export async function sendRecuperarPassword(
  email: string,
  data: RecuperarPasswordData,
  opts?: { relatedUserId?: number }
): Promise<{ enviado: boolean; modo: 'dev' | 'production' }> {
  const html = getRecuperarPasswordHTML(data);
  return sendEmail({
    to: email,
    toName: data.nombre,
    subject: 'Recupera tu contraseña — Preparatoria Abierta Michoacán',
    html,
    evento: 'recuperar_password',
    relatedUserId: opts?.relatedUserId,
  });
}

// ─── Aviso de eliminación de cuenta ──────────────────────────────────────

export interface AvisoEliminacionData {
  nombreCompleto: string;
  fechaEliminacion: string;
  gestor: { nombre: string; email: string } | null;
}

export async function sendAvisoEliminacion(
  email: string,
  data: AvisoEliminacionData,
  opts?: { relatedUserId?: number }
): Promise<{ enviado: boolean; modo: 'dev' | 'production' }> {
  const html = getAvisoEliminacionHTML(data);
  return sendEmail({
    to: email,
    toName: data.nombreCompleto,
    subject: 'Tu cuenta de Preparatoria Abierta Michoacán será eliminada en 5 días',
    html,
    evento: 'aviso_eliminacion_cuenta',
    relatedUserId: opts?.relatedUserId,
  });
}

// ─── Verificación de código ───────────────────────────────────────────────

export async function sendVerificationCode(
  email: string,
  codigo: string
): Promise<{ enviado: boolean; modo: 'dev' | 'production'; codigo?: string }> {
  const mode = getEmailMode();
  if (mode === 'dev') {
    console.log(`\n📧 [DEV MODE] Código de verificación para ${email}: ${codigo}\n`);
    return { enviado: true, modo: 'dev', codigo };
  }
  const html = getVerificationEmailHTML(codigo);
  const result = await sendEmail({
    to: email,
    subject: `Tu código de verificación: ${codigo}`,
    html,
    evento: 'verificacion_email',
  });
  return result;
}

// ─── HTML helpers (se mantienen igual para recuperar-password y otros) ────

function getRecuperarPasswordHTML(data: RecuperarPasswordData): string {
  return `<!DOCTYPE html>
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
        <tr><td style="padding:32px 32px 24px 32px;">
          <div style="font-size:11px;font-weight:bold;letter-spacing:2px;color:#7b1e3a;text-transform:uppercase;margin-bottom:12px;">Recuperación de contraseña</div>
          <h1 style="color:#1c1917;font-size:22px;margin:0 0 14px 0;font-family:Georgia,serif;">Crea una nueva contraseña</h1>
          <p style="color:#44403c;font-size:14px;line-height:1.7;margin:0 0 24px 0;">Hola, <strong>${escapeHtml(data.nombre)}</strong>. Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;"><tr><td align="center">
            <a href="${data.resetUrl}" style="display:inline-block;background:#7b1e3a;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:16px 40px;border-radius:8px;">Crear nueva contraseña</a>
          </td></tr></table>
          <p style="color:#78716c;font-size:12px;line-height:1.6;margin:0 0 20px 0;">Si el botón no funciona: <span style="color:#7b1e3a;word-break:break-all;">${data.resetUrl}</span></p>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:#fff7ed;border:1px solid #fed7aa;border-left:3px solid #c77700;border-radius:6px;padding:14px 16px;">
            <p style="color:#92400e;font-size:13px;line-height:1.6;margin:0;">Este enlace expira en <strong>60 minutos</strong>. Si no solicitaste este cambio, ignora este correo.</p>
          </td></tr></table>
        </td></tr>
        <tr><td style="background:#f8f4ec;padding:16px 32px;border-top:1px solid #e2d9d0;">
          <p style="color:#a8a29e;font-size:10px;margin:0;text-align:center;line-height:1.5;">EDUMICH · Plataforma Educativa Digital · Gobierno de Michoacán</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function getAvisoEliminacionHTML(data: AvisoEliminacionData): string {
  const gestorSection = data.gestor
    ? `<tr><td style="padding:0 32px 24px 32px;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#fdf2f4;border:1px solid #e8c4cc;border-radius:8px;padding:20px;"><tr><td>
        <div style="font-size:10px;font-weight:bold;letter-spacing:2px;color:#7b1e3a;text-transform:uppercase;margin-bottom:8px;">Gestor asignado</div>
        <div style="font-size:14px;font-weight:bold;color:#1c1917;margin-bottom:4px;">${escapeHtml(data.gestor.nombre)}</div>
        <div style="font-size:13px;color:#44403c;">${escapeHtml(data.gestor.email)}</div>
      </td></tr></table></td></tr>`
    : `<tr><td style="padding:0 32px 24px 32px;"><div style="font-size:13px;color:#44403c;">Soporte: <strong>soporte.prepaabierta@michoacan.gob.mx</strong></div></td></tr>`;

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f4ec;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f4ec;padding:32px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e2d9d0;max-width:580px;">
        <tr><td style="background:#7b1e3a;padding:24px 32px;">
          <div style="color:#fff;font-size:16px;font-weight:bold;">Preparatoria Abierta · IEMSyS</div>
          <div style="color:rgba(255,255,255,0.7);font-size:11px;letter-spacing:1.5px;text-transform:uppercase;">Gobierno de Michoacán</div>
        </td></tr>
        <tr><td style="padding:28px 32px 0 32px;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:#fff1f2;border:1px solid #fca5a5;border-left:4px solid #dc2626;border-radius:8px;padding:16px 20px;">
            <div style="font-size:15px;font-weight:bold;color:#991b1b;margin-bottom:6px;">Tu cuenta será eliminada el ${data.fechaEliminacion}</div>
            <div style="font-size:13px;color:#7f1d1d;line-height:1.6;">Han pasado más de 25 días sin actividad. Si no reactivas tu cuenta, todos tus datos serán eliminados.</div>
          </td></tr></table>
        </td></tr>
        <tr><td style="padding:24px 32px 20px 32px;">
          <h1 style="color:#1c1917;font-size:22px;margin:0 0 12px 0;font-family:Georgia,serif;">Hola, ${escapeHtml(data.nombreCompleto)}</h1>
          <p style="color:#44403c;font-size:14px;line-height:1.7;margin:0;">Para reactivar tu cuenta, sube al menos un documento o comprobante de pago en el portal.</p>
        </td></tr>
        <tr><td style="padding:0 32px 28px 32px;" align="center">
          <a href="${process.env.PORTAL_URL ?? 'https://edumich.up.railway.app'}/estudiante/expediente" style="display:inline-block;background:#7b1e3a;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:16px 40px;border-radius:8px;">Entrar al portal ahora</a>
        </td></tr>
        ${gestorSection}
        <tr><td style="background:#f8f4ec;padding:16px 32px;border-top:1px solid #e2d9d0;">
          <p style="color:#a8a29e;font-size:10px;margin:0;text-align:center;line-height:1.5;">EDUMICH · Plataforma Educativa Digital · Gobierno de Michoacán</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function getVerificationEmailHTML(codigo: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f4ec;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f4ec;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e2d9d0;">
        <tr><td style="background:#7b1e3a;padding:24px 32px;">
          <div style="color:#fff;font-size:15px;font-weight:bold;line-height:1.2;">Preparatoria Abierta · IEMSyS</div>
          <div style="color:rgba(255,255,255,0.75);font-size:11px;letter-spacing:1px;">GOBIERNO DE MICHOACÁN</div>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="color:#2a2a2a;font-size:22px;margin:0 0 8px 0;">Verifica tu correo electrónico</h1>
          <p style="color:#44403c;font-size:14px;line-height:1.6;margin:0 0 24px 0;">Usa el siguiente código para continuar con tu registro:</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;"><tr>
            <td align="center" style="background:#fdf2f4;border:2px dashed #c43759;border-radius:8px;padding:28px 0;">
              <span style="color:#7b1e3a;font-size:42px;font-weight:bold;letter-spacing:18px;font-family:'Courier New',monospace;">${codigo}</span>
              <div style="color:#a02440;font-size:12px;margin-top:10px;">Este código expira en <strong>10 minutos</strong></div>
            </td>
          </tr></table>
          <p style="color:#78716c;font-size:12px;line-height:1.5;border-top:1px solid #e2d9d0;padding-top:16px;margin:0;">Si no solicitaste crear una cuenta, puedes ignorar este correo.</p>
        </td></tr>
        <tr><td style="background:#f8f4ec;padding:16px 32px;border-top:1px solid #e2d9d0;">
          <p style="color:#78716c;font-size:11px;margin:0;text-align:center;">EDUMICH · Plataforma Educativa Digital · Gobierno de Michoacán</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
