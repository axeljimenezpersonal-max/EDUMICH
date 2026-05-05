import { Resend } from 'resend';

const EMAIL_MODE: 'dev' | 'production' =
  process.env.RESEND_API_KEY ? ((process.env.EMAIL_MODE as 'dev' | 'production') || 'dev') : 'dev';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendVerificationCode(
  email: string,
  codigo: string
): Promise<{ enviado: boolean; modo: 'dev' | 'production'; codigo?: string }> {
  if (EMAIL_MODE === 'dev') {
    console.log(`\n📧 [DEV MODE] Código de verificación para ${email}: ${codigo}\n`);
    return { enviado: true, modo: 'dev', codigo };
  }

  if (!resend) throw new Error('Resend no configurado');

  await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: email,
    subject: `Tu código de verificación: ${codigo}`,
    html: getVerificationEmailHTML(codigo),
  });

  return { enviado: true, modo: 'production' };
}

// ─── Bienvenida con credenciales temporales ───────────────────────────────

export interface BienvenidaData {
  nombreAlumno: string;
  email: string;
  passwordTemporal: string;
  portalUrl: string;
  gestor?: { nombre: string; telefono: string | null; municipio: string | null };
}

export async function sendBienvenidaCredenciales(
  email: string,
  data: BienvenidaData
): Promise<{ enviado: boolean; modo: 'dev' | 'production' }> {
  if (EMAIL_MODE === 'dev') {
    console.log(`\n📧 [DEV MODE] Bienvenida para ${email}:`);
    console.log(`   Nombre: ${data.nombreAlumno}`);
    console.log(`   Password temporal: ${data.passwordTemporal}`);
    console.log(`   Portal: ${data.portalUrl}\n`);
    return { enviado: true, modo: 'dev' };
  }

  if (!resend) throw new Error('Resend no configurado');

  await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: email,
    subject: '¡Bienvenido a Prepa Abierta Michoacán! Tus datos de acceso',
    html: getBienvenidaEmailHTML(data),
  });

  return { enviado: true, modo: 'production' };
}

function getBienvenidaEmailHTML(data: BienvenidaData): string {
  const gestorSection = data.gestor
    ? `
    <tr>
      <td style="padding:0 32px 24px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0"
          style="background:#fdf2f4;border:1px solid #e8c4cc;border-radius:8px;padding:20px;">
          <tr>
            <td>
              <div style="font-size:10px;font-weight:bold;letter-spacing:2px;color:#7b1e3a;text-transform:uppercase;margin-bottom:10px;">
                Tu gestor asignado
              </div>
              <div style="font-size:15px;font-weight:bold;color:#1c1917;margin-bottom:4px;">${data.gestor.nombre}</div>
              ${data.gestor.municipio ? `<div style="font-size:13px;color:#44403c;margin-bottom:4px;">📍 ${data.gestor.municipio}</div>` : ''}
              ${data.gestor.telefono ? `<div style="font-size:13px;color:#44403c;margin-bottom:10px;">📞 ${data.gestor.telefono}</div>` : ''}
              <div style="font-size:13px;color:#44403c;line-height:1.6;">
                Si tienes dudas o problemas, puedes contactar a tu gestor o pasar a las oficinas.
                Ellos están para apoyarte en todo el proceso.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>`
    : `
    <tr>
      <td style="padding:0 32px 24px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0"
          style="background:#f8f4ec;border:1px solid #e2d9d0;border-radius:8px;padding:20px;">
          <tr>
            <td>
              <div style="font-size:10px;font-weight:bold;letter-spacing:2px;color:#78716c;text-transform:uppercase;margin-bottom:8px;">
                Atención a usuarios
              </div>
              <div style="font-size:13px;color:#44403c;line-height:1.6;">
                Si tienes dudas, comunícate con las oficinas del IEMSyS en tu municipio
                o visita el portal para encontrar a tu gestor asignado.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f4ec;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f4ec;padding:32px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0"
        style="background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e2d9d0;max-width:580px;">

        <!-- Header guinda -->
        <tr>
          <td style="background:#7b1e3a;padding:24px 32px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:56px;height:56px;text-align:center;vertical-align:middle;">
                  <img src="https://prepaabierta.michoacan.gob.mx/logo-see-blanco-256.png" alt="SEE Michoacán" width="56" height="56" style="display:block;object-fit:contain;" />
                </td>
                <td style="padding-left:14px;">
                  <div style="color:#fff;font-size:16px;font-weight:bold;line-height:1.2;">Prepa Abierta · IEMSyS</div>
                  <div style="color:rgba(255,255,255,0.7);font-size:11px;letter-spacing:1.5px;text-transform:uppercase;">Gobierno de Michoacán</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Saludo -->
        <tr>
          <td style="padding:32px 32px 20px 32px;">
            <h1 style="color:#1c1917;font-size:22px;margin:0 0 12px 0;font-family:Georgia,serif;">
              ¡Hola, ${data.nombreAlumno}!
            </h1>
            <p style="color:#44403c;font-size:14px;line-height:1.7;margin:0;">
              Te damos la bienvenida al <strong>Sistema de Gestión de Prepa Abierta</strong>
              del Gobierno de Michoacán. Aquí podrás estudiar, subir tus documentos
              y presentar tus exámenes para obtener tu certificado de bachillerato.
            </p>
          </td>
        </tr>

        <!-- Credenciales -->
        <tr>
          <td style="padding:0 32px 24px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#fdf8f9;border:2px solid #7b1e3a;border-radius:8px;overflow:hidden;">
              <tr>
                <td style="background:#7b1e3a;padding:10px 18px;">
                  <span style="color:#fff;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">
                    Tus datos de acceso
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding:20px 18px;">
                  <table cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td style="padding-bottom:12px;">
                        <div style="font-size:11px;color:#78716c;font-weight:bold;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">
                          Tu correo electrónico
                        </div>
                        <div style="font-family:'Courier New',Courier,monospace;font-size:14px;color:#1c1917;background:#f0e8e8;padding:8px 12px;border-radius:4px;display:inline-block;">
                          ${data.email}
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <div style="font-size:11px;color:#78716c;font-weight:bold;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">
                          Tu contraseña temporal
                        </div>
                        <div style="font-family:'Courier New',Courier,monospace;font-size:24px;font-weight:bold;color:#7b1e3a;letter-spacing:6px;background:#fdf2f4;border:1px dashed #c43759;padding:12px 18px;border-radius:4px;display:inline-block;">
                          ${data.passwordTemporal}
                        </div>
                        <div style="font-size:12px;color:#a02440;margin-top:8px;font-style:italic;">
                          ⚠️ Esta contraseña es temporal. La cambiarás al entrar por primera vez.
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Botón -->
        <tr>
          <td style="padding:0 32px 28px 32px;" align="center">
            <a href="${data.portalUrl}"
              style="display:inline-block;background:#7b1e3a;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:16px 40px;border-radius:8px;letter-spacing:1px;text-transform:uppercase;">
              ENTRAR AL PORTAL
            </a>
          </td>
        </tr>

        <!-- Qué hacer ahora -->
        <tr>
          <td style="padding:0 32px 28px 32px;border-top:1px solid #f0e8e8;">
            <div style="font-size:12px;font-weight:bold;letter-spacing:2px;color:#7b1e3a;text-transform:uppercase;margin:20px 0 14px 0;">
              Qué hacer ahora
            </div>
            <table cellpadding="0" cellspacing="0" width="100%">
              ${[
                'Entra al portal con tu correo y tu contraseña temporal.',
                'Cambia tu contraseña por una nueva que solo tú sepas.',
                'Sube tus documentos (CURP, acta de nacimiento, INE y comprobante de domicilio) en la sección <strong>Mi expediente</strong>.',
                'Cuando tu expediente esté completo, podrás inscribirte a tus exámenes.',
                'Estudia los módulos del bachillerato a tu propio ritmo.',
              ].map((paso, i) => `
              <tr>
                <td style="vertical-align:top;padding-bottom:10px;">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="vertical-align:top;padding-right:12px;">
                        <div style="background:#7b1e3a;color:#fff;border-radius:50%;width:22px;height:22px;text-align:center;line-height:22px;font-size:11px;font-weight:bold;min-width:22px;">
                          ${i + 1}
                        </div>
                      </td>
                      <td style="font-size:13px;color:#44403c;line-height:1.6;">${paso}</td>
                    </tr>
                  </table>
                </td>
              </tr>`).join('')}
            </table>
          </td>
        </tr>

        <!-- Gestor o atención -->
        ${gestorSection}

        <!-- Texto empático -->
        <tr>
          <td style="padding:0 32px 28px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#f8f4ec;border-radius:8px;padding:20px;">
              <tr>
                <td style="font-size:14px;color:#44403c;line-height:1.7;font-style:italic;">
                  "Sabemos que terminar la prepa puede sentirse difícil, pero estamos contigo.
                  Cada módulo que apruebas es un paso más cerca de tu meta."
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8f4ec;padding:16px 32px;border-top:1px solid #e2d9d0;">
            <p style="color:#78716c;font-size:11px;margin:0 0 6px 0;text-align:center;">
              <strong>Instituto de Educación Media Superior y Superior — Gobierno de Michoacán</strong><br>
              Morelia, Michoacán · Honestidad y Trabajo
            </p>
            <p style="color:#a8a29e;font-size:10px;margin:0;text-align:center;line-height:1.5;">
              Este correo fue enviado desde <strong>EDUMICH</strong> · Plataforma Educativa Digital<br>
              © ${new Date().getFullYear()} Gobierno del Estado de Michoacán · IEMSyS · Prepa Abierta<br>
              Este mensaje fue generado automáticamente. Por favor no respondas.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Recuperación de contraseña ───────────────────────────────────────────

export interface RecuperarPasswordData {
  nombre: string;
  resetUrl: string;
  token: string;
}

export async function sendRecuperarPassword(
  email: string,
  data: RecuperarPasswordData
): Promise<{ enviado: boolean; modo: 'dev' | 'production' }> {
  if (EMAIL_MODE === 'dev') {
    process.stderr.write(`\n📧 [DEV] Recuperación para ${email}\n   Token: ${data.token}\n   URL: ${data.resetUrl}\n\n`);
    return { enviado: true, modo: 'dev' };
  }

  if (!resend) throw new Error('Resend no configurado');

  await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: email,
    subject: 'Recupera tu contraseña — Prepa Abierta Michoacán',
    html: getRecuperarPasswordHTML(data),
  });

  return { enviado: true, modo: 'production' };
}

function getRecuperarPasswordHTML(data: RecuperarPasswordData): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f4ec;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f4ec;padding:32px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0"
        style="background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e2d9d0;max-width:580px;">

        <!-- Header guinda -->
        <tr>
          <td style="background:#7b1e3a;padding:24px 32px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:56px;height:56px;text-align:center;vertical-align:middle;">
                  <img src="https://prepaabierta.michoacan.gob.mx/logo-see-blanco-256.png" alt="SEE Michoacán" width="56" height="56" style="display:block;object-fit:contain;" />
                </td>
                <td style="padding-left:14px;">
                  <div style="color:#fff;font-size:16px;font-weight:bold;line-height:1.2;">Prepa Abierta · IEMSyS</div>
                  <div style="color:rgba(255,255,255,0.7);font-size:11px;letter-spacing:1.5px;text-transform:uppercase;">Gobierno de Michoacán</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Cuerpo -->
        <tr>
          <td style="padding:32px 32px 24px 32px;">
            <div style="font-size:11px;font-weight:bold;letter-spacing:2px;color:#7b1e3a;text-transform:uppercase;margin-bottom:12px;">
              Recuperación de contraseña
            </div>
            <h1 style="color:#1c1917;font-size:22px;margin:0 0 14px 0;font-family:Georgia,serif;">
              Crea una nueva contraseña
            </h1>
            <p style="color:#44403c;font-size:14px;line-height:1.7;margin:0 0 24px 0;">
              Hola, <strong>${data.nombre}</strong>. Recibimos una solicitud para restablecer
              la contraseña de tu cuenta en el sistema Prepa Abierta del IEMSyS.
              Haz clic en el botón para crear una nueva contraseña.
            </p>

            <!-- Botón -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
              <tr>
                <td align="center">
                  <a href="${data.resetUrl}"
                    style="display:inline-block;background:#7b1e3a;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:16px 40px;border-radius:8px;">
                    Crear nueva contraseña
                  </a>
                </td>
              </tr>
            </table>

            <!-- Link de respaldo -->
            <p style="color:#78716c;font-size:12px;line-height:1.6;margin:0 0 20px 0;">
              Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
              <span style="color:#7b1e3a;word-break:break-all;">${data.resetUrl}</span>
            </p>

            <!-- Advertencia -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#fff7ed;border:1px solid #fed7aa;border-left:3px solid #c77700;border-radius:6px;padding:14px 16px;">
                  <p style="color:#92400e;font-size:13px;line-height:1.6;margin:0;">
                    ⏱ <strong>Este enlace expira en 60 minutos.</strong><br>
                    Si no solicitaste este cambio, puedes ignorar este correo.
                    Tu contraseña actual no será modificada.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8f4ec;padding:16px 32px;border-top:1px solid #e2d9d0;">
            <p style="color:#78716c;font-size:11px;margin:0 0 4px 0;text-align:center;">
              <strong>Instituto de Educación Media Superior y Superior — Gobierno de Michoacán</strong>
            </p>
            <p style="color:#a8a29e;font-size:10px;margin:0;text-align:center;line-height:1.5;">
              Este correo fue enviado desde <strong>EDUMICH</strong> · Plataforma Educativa Digital<br>
              © ${new Date().getFullYear()} Gobierno del Estado de Michoacán · IEMSyS · Prepa Abierta<br>
              Este mensaje fue generado automáticamente. Por favor no respondas.
            </p>
          </td>
        </tr>

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
        <!-- Header guinda -->
        <tr>
          <td style="background:#7b1e3a;padding:24px 32px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:56px;height:56px;text-align:center;vertical-align:middle;">
                  <img src="https://prepaabierta.michoacan.gob.mx/logo-see-blanco-256.png" alt="SEE Michoacán" width="56" height="56" style="display:block;object-fit:contain;" />
                </td>
                <td style="padding-left:12px;">
                  <div style="color:#fff;font-size:15px;font-weight:bold;line-height:1.2;">Prepa Abierta · IEMSyS</div>
                  <div style="color:rgba(255,255,255,0.75);font-size:11px;letter-spacing:1px;">GOBIERNO DE MICHOACÁN</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Cuerpo -->
        <tr>
          <td style="padding:32px;">
            <h1 style="color:#2a2a2a;font-size:22px;margin:0 0 8px 0;">Verifica tu correo electrónico</h1>
            <p style="color:#44403c;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
              Recibimos una solicitud para crear o verificar tu cuenta en el Sistema Prepa Abierta Michoacán.
              Usa el siguiente código para continuar con tu registro:
            </p>
            <!-- Cuadro del código -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
              <tr>
                <td align="center" style="background:#fdf2f4;border:2px dashed #c43759;border-radius:8px;padding:28px 0;">
                  <span style="color:#7b1e3a;font-size:42px;font-weight:bold;letter-spacing:18px;font-family:'Courier New',monospace;">${codigo}</span>
                  <div style="color:#a02440;font-size:12px;margin-top:10px;">Este código expira en <strong>10 minutos</strong></div>
                </td>
              </tr>
            </table>
            <p style="color:#44403c;font-size:14px;line-height:1.6;margin:0 0 16px 0;">
              Ingresa este código en la pantalla de verificación para continuar con tu registro.
            </p>
            <p style="color:#78716c;font-size:12px;line-height:1.5;border-top:1px solid #e2d9d0;padding-top:16px;margin:0;">
              Si no solicitaste crear una cuenta en Prepa Abierta Michoacán, puedes ignorar este correo con seguridad. Nadie tendrá acceso a tu cuenta sin este código.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8f4ec;padding:16px 32px;border-top:1px solid #e2d9d0;">
            <p style="color:#78716c;font-size:11px;margin:0;text-align:center;line-height:1.5;">
              Este correo fue enviado desde <strong>EDUMICH</strong> · Plataforma Educativa Digital<br>
              Gobierno del Estado de Michoacán · IEMSyS · Prepa Abierta · edumich.michoacan.gob.mx
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
