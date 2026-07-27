/**
 * Plantillas de correo institucionales — datos reutilizables.
 *
 * Hoy las usa el seed mínimo de producción (`seed-produccion.ts`). Son una copia
 * fiel de las que `seed.ts` (el seed demo) todavía tiene inline; cuando se toque
 * ese archivo conviene migrarlo a importar de aquí para no mantener dos copias.
 *
 * Las variables entre {{dobles llaves}} las rellena el servicio de correo al
 * enviar (ver services/email). No cambies las claves: el código las busca por
 * `clave`.
 */

const headerHtml = `<div style="background:#6B0F3C;padding:20px 32px;margin-bottom:0"><p style="color:white;font-size:11px;margin:0;font-family:sans-serif;letter-spacing:0.1em;text-transform:uppercase">GOBIERNO DEL ESTADO DE MICHOACÁN</p><h1 style="color:white;font-size:20px;margin:8px 0 0;font-family:sans-serif;font-weight:700">Preparatoria Abierta Michoacán</h1></div>`;
const footerHtml = `<div style="background:#f5f0ea;padding:16px 32px;margin-top:32px;border-top:3px solid #6B0F3C"><p style="color:#78716c;font-size:11px;margin:0;font-family:sans-serif">Instituto de Educación Media Superior y Superior · Michoacán<br>prepaabierta.michoacan.gob.mx · soporte.preparatoria@michoacan.gob.mx</p></div>`;
const wrap = (body: string) => `${headerHtml}<div style="padding:32px;font-family:sans-serif;color:#2a2a2a">${body}</div>${footerHtml}`;

export interface PlantillaCorreoSeed {
  clave: string;
  nombre: string;
  descripcion: string;
  asunto: string;
  contenidoHtml: string;
  variablesDisponibles: string[];
  activa: boolean;
}

export const PLANTILLAS_CORREO: PlantillaCorreoSeed[] = [
  {
    clave: 'bienvenida_credenciales',
    nombre: 'Bienvenida con credenciales',
    descripcion: 'Se envía al alumno cuando el gestor crea su cuenta',
    asunto: 'Bienvenido a Preparatoria Abierta Michoacán — Tus credenciales de acceso',
    contenidoHtml: wrap(`<h2 style="color:#6B0F3C">Bienvenido, {{nombreCompleto}}</h2><p>Tu cuenta ha sido creada exitosamente en el Sistema de Preparatoria Abierta Michoacán.</p><div style="background:#fdf6fa;border-left:4px solid #6B0F3C;padding:16px 20px;margin:20px 0;border-radius:4px"><p style="margin:0 0 8px"><strong>Correo:</strong> {{email}}</p><p style="margin:0"><strong>Contraseña temporal:</strong> <code style="background:#e5e7eb;padding:2px 6px;border-radius:3px;font-size:15px">{{passwordTemporal}}</code></p></div><p>Tu gestor asignado es <strong>{{gestorNombre}}</strong> ({{gestorEmail}}).</p><p>Por seguridad, deberás cambiar tu contraseña en tu primer ingreso.</p><a href="{{linkPortal}}" style="display:inline-block;background:#6B0F3C;color:white;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin-top:8px">Ingresar al portal</a>`),
    variablesDisponibles: ['nombreCompleto', 'email', 'passwordTemporal', 'gestorNombre', 'gestorEmail', 'linkPortal'],
    activa: true,
  },
  {
    clave: 'verificacion_codigo',
    nombre: 'Verificación de correo (código)',
    descripcion: 'Código de 6 dígitos para verificar el correo en auto-registro',
    asunto: 'Preparatoria Abierta — Tu código de verificación: {{codigo}}',
    contenidoHtml: wrap(`<h2 style="color:#6B0F3C">Verifica tu correo electrónico</h2><p>Usa el siguiente código para completar tu registro:</p><div style="text-align:center;margin:32px 0"><span style="font-size:40px;font-weight:800;letter-spacing:0.3em;color:#6B0F3C;font-family:monospace">{{codigo}}</span></div><p style="color:#78716c;font-size:13px">Este código expira en 15 minutos. Si no solicitaste esto, ignora este correo.</p>`),
    variablesDisponibles: ['codigo', 'email'],
    activa: true,
  },
  {
    clave: 'recuperacion_password',
    nombre: 'Recuperación de contraseña',
    descripcion: 'Enlace de reset cuando el usuario solicita recuperar su contraseña',
    asunto: 'Preparatoria Abierta — Recupera tu contraseña',
    contenidoHtml: wrap(`<h2 style="color:#6B0F3C">Restablecer contraseña</h2><p>Recibimos una solicitud para restablecer la contraseña de <strong>{{email}}</strong>.</p><a href="{{linkReset}}" style="display:inline-block;background:#6B0F3C;color:white;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0">Restablecer contraseña</a><p style="color:#78716c;font-size:13px">Este enlace expira en 2 horas. Si no solicitaste el cambio, ignora este correo.</p>`),
    variablesDisponibles: ['email', 'linkReset', 'nombreCompleto'],
    activa: true,
  },
  {
    clave: 'solicitud_aprobada',
    nombre: 'Solicitud aprobada',
    descripcion: 'Notifica al solicitante que su solicitud fue aprobada y le da sus credenciales',
    asunto: 'Preparatoria Abierta — Tu solicitud fue aprobada',
    contenidoHtml: wrap(`<h2 style="color:#6B0F3C">¡Tu solicitud fue aprobada!</h2><p>Estimado/a <strong>{{nombreCompleto}}</strong>, nos complace informarte que tu solicitud de inscripción ha sido aprobada.</p><div style="background:#fdf6fa;border-left:4px solid #6B0F3C;padding:16px 20px;margin:20px 0;border-radius:4px"><p style="margin:0 0 8px"><strong>Correo:</strong> {{email}}</p><p style="margin:0"><strong>Contraseña temporal:</strong> <code style="background:#e5e7eb;padding:2px 6px;border-radius:3px">{{passwordTemporal}}</code></p></div><p>Tu gestor asignado: <strong>{{gestorNombre}}</strong></p><a href="{{linkPortal}}" style="display:inline-block;background:#6B0F3C;color:white;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600">Ingresar al portal</a>`),
    variablesDisponibles: ['nombreCompleto', 'email', 'passwordTemporal', 'gestorNombre', 'linkPortal'],
    activa: true,
  },
  {
    clave: 'solicitud_rechazada',
    nombre: 'Solicitud rechazada',
    descripcion: 'Notifica al solicitante que su solicitud fue rechazada con el motivo',
    asunto: 'Preparatoria Abierta — Actualización sobre tu solicitud',
    contenidoHtml: wrap(`<h2 style="color:#6B0F3C">Actualización sobre tu solicitud</h2><p>Estimado/a <strong>{{nombreCompleto}}</strong>, hemos revisado tu solicitud y lamentamos informarte que no fue posible aprobarla en este momento.</p><div style="background:#fff5f5;border-left:4px solid #ef4444;padding:16px 20px;margin:20px 0;border-radius:4px"><p style="margin:0"><strong>Motivo:</strong> {{motivoRechazo}}</p></div><p>Si tienes dudas, comunícate con nosotros en soporte.preparatoria@michoacan.gob.mx</p>`),
    variablesDisponibles: ['nombreCompleto', 'motivoRechazo', 'email'],
    activa: true,
  },
  {
    clave: 'anuncio_institucional',
    nombre: 'Anuncio institucional',
    descripcion: 'Plantilla genérica para comunicados y anuncios del sistema',
    asunto: '{{asuntoAnuncio}} — Preparatoria Abierta Michoacán',
    contenidoHtml: wrap(`<h2 style="color:#6B0F3C">{{tituloAnuncio}}</h2><div>{{contenidoAnuncio}}</div><p style="color:#78716c;font-size:12px;margin-top:24px">Para más información visita <a href="{{linkPortal}}" style="color:#6B0F3C">tu portal</a>.</p>`),
    variablesDisponibles: ['tituloAnuncio', 'asuntoAnuncio', 'contenidoAnuncio', 'linkPortal'],
    activa: true,
  },
  {
    clave: 'documento_rechazado',
    nombre: 'Documento rechazado',
    descripcion: 'Notifica al alumno que un documento de su expediente fue rechazado',
    asunto: 'Preparatoria Abierta — Documento requiere atención',
    contenidoHtml: wrap(`<h2 style="color:#6B0F3C">Documento requiere atención</h2><p>Estimado/a <strong>{{nombreCompleto}}</strong>, tu documento <strong>"{{tipoDocumento}}"</strong> fue revisado y requiere corrección.</p><div style="background:#fff5f5;border-left:4px solid #ef4444;padding:16px 20px;margin:20px 0;border-radius:4px"><p style="margin:0"><strong>Motivo:</strong> {{motivoRechazo}}</p></div><p>Vuelve a subir el documento corregido desde tu portal.</p><a href="{{linkPortal}}" style="display:inline-block;background:#6B0F3C;color:white;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600">Ir a mi expediente</a>`),
    variablesDisponibles: ['nombreCompleto', 'tipoDocumento', 'motivoRechazo', 'linkPortal'],
    activa: true,
  },
  {
    clave: 'matricula_asignada',
    nombre: 'Matrícula DGB asignada',
    descripcion: 'Notifica al alumno cuando se le captura su matrícula oficial DGB',
    asunto: 'Preparatoria Abierta — Tu matrícula oficial ha sido asignada',
    contenidoHtml: wrap(`<h2 style="color:#6B0F3C">¡Matrícula oficial asignada!</h2><p>Estimado/a <strong>{{nombreCompleto}}</strong>, nos complace informarte que tu matrícula oficial DGB ha sido registrada en el sistema.</p><div style="background:#fdf6fa;border-left:4px solid #6B0F3C;padding:16px 20px;margin:20px 0;border-radius:4px;text-align:center"><p style="margin:0 0 4px;font-size:12px;color:#78716c;text-transform:uppercase;letter-spacing:0.1em">Matrícula oficial DGB</p><p style="margin:0;font-size:24px;font-weight:800;color:#6B0F3C;font-family:monospace">{{matriculaDGB}}</p></div><p>Descarga tu ficha de registro oficial desde tu portal.</p><a href="{{linkPortal}}" style="display:inline-block;background:#6B0F3C;color:white;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600">Ver mi ficha de registro</a>`),
    variablesDisponibles: ['nombreCompleto', 'matriculaDGB', 'linkPortal'],
    activa: true,
  },
];
