/**
 * Índice del buscador: secciones a dónde ir y respuestas que resuelven dudas.
 *
 * ── Cómo escribir `terminos` ────────────────────────────────────────────────
 * Van las palabras que la GENTE escribe, no las que usa la interfaz. El alumno
 * no busca "expediente": busca "papeles", "acta", "mis documentos". El gestor
 * no busca "alta de alumno": busca "meter a alguien". Cada término que se
 * agrega aquí es una duda menos que llega al chat de la Secretaría.
 *
 * Incluye a propósito las formas mal escritas que son comunes y que la
 * tolerancia a erratas NO alcanza a cubrir porque son otra palabra entera
 * ("curriculum" por "CURP", "boleta" por "calificaciones").
 *
 * ── Sobre el contenido de las respuestas ────────────────────────────────────
 * Los textos de tipo `respuesta` son contenido institucional: dicen montos,
 * plazos y requisitos. Deben revisarse con la Secretaría antes de operar, y
 * actualizarse aquí cuando cambie la norma. Si un dato depende del alumno en
 * concreto (SU fecha, SU folio), no va aquí: va en la capa `dato` que arma
 * cada layout.
 */

import type { EntradaIndice } from './tipos';

const ALUMNO = ['estudiante'] as const;
const GESTOR = ['gestor'] as const;
const ADMIN = ['admin'] as const;
const DIRECCION = ['direccion'] as const;
const AMBOS = ['estudiante', 'gestor'] as const;
const TODOS = ['estudiante', 'gestor', 'admin', 'direccion'] as const;

// ── Secciones del alumno ────────────────────────────────────────────────────

const SECCIONES_ALUMNO: EntradaIndice[] = [
  {
    id: 'sec-alu-inicio',
    tipo: 'seccion',
    titulo: 'Inicio',
    cuerpo: 'Tu tablero: en qué punto va tu trámite y qué sigue.',
    ruta: '/estudiante',
    icono: 'LayoutDashboard',
    roles: [...ALUMNO],
    terminos: ['inicio', 'tablero', 'principal', 'dashboard', 'resumen', 'home', 'portada'],
  },
  {
    id: 'sec-alu-convocatoria',
    tipo: 'seccion',
    titulo: 'Mi convocatoria',
    cuerpo: 'La etapa en la que estás inscrito, sus fechas y tu sede.',
    ruta: '/estudiante/convocatoria',
    icono: 'CalendarClock',
    roles: [...ALUMNO],
    terminos: [
      'convocatoria', 'inscripcion', 'inscribirme', 'inscribir', 'registro',
      'etapa', 'periodo', 'vuelta', 'sede', 'donde presento', 'lugar del examen',
    ],
  },
  {
    id: 'sec-alu-calendario',
    tipo: 'seccion',
    titulo: 'Calendario de la convocatoria',
    cuerpo: 'Todas las fechas de la etapa: inscripción, pago, examen y resultados.',
    ruta: '/estudiante/convocatoria/calendario',
    icono: 'Calendar',
    roles: [...ALUMNO],
    terminos: ['calendario', 'fechas', 'cronograma', 'agenda', 'cuando', 'dias', 'plazos'],
  },
  {
    id: 'sec-alu-pagos',
    tipo: 'seccion',
    titulo: 'Mis pagos',
    cuerpo: 'Tus órdenes de pago, la línea de captura y el estado de cada una.',
    ruta: '/estudiante/pagos',
    icono: 'CreditCard',
    roles: [...ALUMNO],
    terminos: [
      'pago', 'pagos', 'pagar', 'orden de pago', 'linea de captura', 'referencia',
      'recibo', 'comprobante', 'deposito', 'banco', 'costo', 'precio', 'cuanto cuesta',
      'adeudo', 'ficha de pago',
    ],
  },
  {
    id: 'sec-alu-expediente',
    tipo: 'seccion',
    titulo: 'Mi expediente',
    cuerpo: 'Tus documentos, tu cédula de inscripción y tu matrícula oficial.',
    ruta: '/estudiante/expediente',
    icono: 'FolderOpen',
    roles: [...ALUMNO],
    terminos: [
      'expediente', 'documentos', 'papeles', 'requisitos', 'acta', 'acta de nacimiento',
      'curp', 'certificado', 'secundaria', 'comprobante de domicilio', 'fotografia',
      'foto', 'cedula', 'matricula', 'subir documentos', 'cargar papeles',
    ],
  },
  {
    id: 'sec-alu-modulos',
    tipo: 'seccion',
    titulo: 'Mis módulos',
    cuerpo: 'Los módulos del Plan 22 en los que estás inscrito y su material.',
    ruta: '/estudiante/modulos',
    icono: 'BookOpen',
    roles: [...ALUMNO],
    terminos: [
      'modulos', 'modulo', 'materias', 'materia', 'asignaturas', 'temario',
      'plan 22', 'estudiar', 'temas', 'apuntes', 'material',
    ],
  },
  {
    id: 'sec-alu-calificaciones',
    tipo: 'seccion',
    titulo: 'Mis calificaciones',
    cuerpo: 'Tus resultados de exámenes oficiales y de evaluaciones de práctica.',
    ruta: '/estudiante/calificaciones',
    icono: 'GraduationCap',
    roles: [...ALUMNO],
    terminos: [
      'calificaciones', 'calificacion', 'notas', 'nota', 'boleta', 'resultados',
      'resultado', 'promedio', 'pase', 'aprobe', 'reprobe', 'acreditado',
    ],
  },
  {
    id: 'sec-alu-identificacion',
    tipo: 'seccion',
    titulo: 'Mi identificación',
    cuerpo: 'Tu credencial digital con código QR, para mostrarla o descargarla.',
    ruta: '/estudiante/identificacion',
    icono: 'IdCard',
    roles: [...ALUMNO],
    terminos: [
      'identificacion', 'credencial', 'ine', 'gafete', 'carnet', 'qr',
      'codigo qr', 'mi id', 'tarjeton',
    ],
  },
  {
    id: 'sec-alu-aula',
    tipo: 'seccion',
    titulo: 'Aula virtual',
    cuerpo: 'Tareas, materiales y anuncios que publica tu gestor.',
    ruta: '/estudiante/aula',
    icono: 'School',
    roles: [...ALUMNO],
    terminos: ['aula', 'aula virtual', 'clases', 'tareas', 'tarea', 'materiales', 'plataforma'],
  },
  {
    id: 'sec-alu-mensajes',
    tipo: 'seccion',
    titulo: 'Mensajes',
    cuerpo: 'Chat directo con la Secretaría para dudas que no se resuelven aquí.',
    ruta: '/estudiante/mensajes',
    icono: 'MessageSquare',
    roles: [...ALUMNO],
    terminos: [
      'mensajes', 'mensaje', 'chat', 'contacto', 'ayuda', 'soporte', 'secretaria',
      'hablar', 'preguntar', 'escribir', 'reclamo', 'queja',
    ],
  },
  {
    id: 'sec-alu-avisos',
    tipo: 'seccion',
    titulo: 'Avisos',
    cuerpo: 'Comunicados oficiales de la Secretaría.',
    ruta: '/estudiante/avisos',
    icono: 'Bell',
    roles: [...ALUMNO],
    terminos: ['avisos', 'aviso', 'anuncios', 'comunicados', 'noticias', 'novedades'],
  },
  {
    id: 'sec-alu-perfil',
    tipo: 'seccion',
    titulo: 'Mi perfil',
    cuerpo: 'Tus datos personales, tu correo y tu contraseña.',
    ruta: '/estudiante/perfil',
    icono: 'User',
    roles: [...ALUMNO],
    terminos: [
      'perfil', 'mis datos', 'datos personales', 'cuenta', 'contrasena', 'password',
      'cambiar contrasena', 'correo', 'email', 'telefono', 'direccion', 'domicilio',
    ],
  },
];

// ── Secciones del gestor ────────────────────────────────────────────────────

const SECCIONES_GESTOR: EntradaIndice[] = [
  {
    id: 'sec-ges-inicio',
    tipo: 'seccion',
    titulo: 'Inicio',
    cuerpo: 'Resumen de tus alumnos y lo que requiere tu atención hoy.',
    ruta: '/gestor',
    icono: 'LayoutDashboard',
    roles: [...GESTOR],
    terminos: ['inicio', 'tablero', 'principal', 'dashboard', 'resumen', 'home'],
  },
  {
    id: 'sec-ges-alumnos',
    tipo: 'seccion',
    titulo: 'Mis alumnos',
    cuerpo: 'Todos los alumnos que tienes asignados y el estado de cada expediente.',
    ruta: '/gestor/alumnos',
    icono: 'Users',
    roles: [...GESTOR],
    terminos: [
      'alumnos', 'alumno', 'estudiantes', 'estudiante', 'lista', 'listado',
      'mi gente', 'buscar alumno', 'expedientes',
    ],
  },
  {
    id: 'sec-ges-nuevo',
    tipo: 'seccion',
    titulo: 'Registrar alumno',
    cuerpo: 'Da de alta a un alumno nuevo y captura su expediente.',
    ruta: '/gestor/alumnos/nuevo',
    icono: 'UserPlus',
    roles: [...GESTOR],
    terminos: [
      'nuevo alumno', 'registrar', 'alta', 'dar de alta', 'inscribir alumno',
      'agregar alumno', 'meter alumno', 'capturar', 'nuevo registro',
    ],
  },
  {
    id: 'sec-ges-pagos',
    tipo: 'seccion',
    titulo: 'Pagos',
    cuerpo: 'Pagos de tus alumnos, incluidos los pagos grupales ante Tesorería.',
    ruta: '/gestor/pagos',
    icono: 'CreditCard',
    roles: [...GESTOR],
    terminos: [
      'pagos', 'pago', 'pagar', 'pago grupal', 'pagos grupales', 'tesoreria',
      'comprobante', 'linea de captura', 'referencia', 'orden de pago', 'folio',
    ],
  },
  {
    id: 'sec-ges-calificaciones',
    tipo: 'seccion',
    titulo: 'Calificaciones',
    cuerpo: 'Exámenes oficiales de tus alumnos y evaluaciones de práctica.',
    ruta: '/gestor/calificaciones',
    icono: 'GraduationCap',
    roles: [...GESTOR],
    terminos: [
      'calificaciones', 'notas', 'boleta', 'resultados', 'promedio',
      'evaluaciones', 'practica', 'simulacro',
    ],
  },
  {
    id: 'sec-ges-aula',
    tipo: 'seccion',
    titulo: 'Aula virtual',
    cuerpo: 'Publica tareas, materiales y anuncios para tus alumnos.',
    ruta: '/gestor/aula',
    icono: 'School',
    roles: [...GESTOR],
    terminos: ['aula', 'aula virtual', 'tareas', 'materiales', 'anuncios', 'clases'],
  },
  {
    id: 'sec-ges-mensajes',
    tipo: 'seccion',
    titulo: 'Mensajes',
    cuerpo: 'Chat directo con la Secretaría.',
    ruta: '/gestor/mensajes',
    icono: 'MessageSquare',
    roles: [...GESTOR],
    terminos: ['mensajes', 'chat', 'contacto', 'ayuda', 'soporte', 'secretaria'],
  },
];

// ── Secciones compartidas ───────────────────────────────────────────────────

const SECCIONES_COMUNES: EntradaIndice[] = [
  {
    id: 'sec-com-notificaciones',
    tipo: 'seccion',
    titulo: 'Notificaciones',
    cuerpo: 'Todo lo que el sistema te ha avisado.',
    ruta: '/notificaciones',
    icono: 'Bell',
    roles: [...AMBOS],
    terminos: ['notificaciones', 'alertas', 'campana', 'avisos del sistema'],
  },
  {
    id: 'sec-com-capacitacion',
    tipo: 'seccion',
    titulo: 'Capacitación',
    cuerpo: 'Manuales paso a paso para aprender a usar la plataforma.',
    ruta: '/capacitacion',
    icono: 'BookMarked',
    roles: [...AMBOS],
    terminos: [
      'capacitacion', 'manual', 'manuales', 'tutorial', 'guia', 'como se usa',
      'aprender', 'curso', 'instrucciones',
    ],
  },
];

// ── Respuestas: la capa que evita el mensaje a la Secretaría ────────────────

const RESPUESTAS_ALUMNO: EntradaIndice[] = [
  {
    id: 'res-alu-como-inscribirme',
    tipo: 'respuesta',
    titulo: '¿Cómo me inscribo a una etapa?',
    cuerpo:
      'Entra a Mi convocatoria cuando haya una etapa abierta, elige tus módulos y la sede donde quieres presentar, y confirma. Después se genera tu orden de pago. La inscripción no queda firme hasta que el pago se registra.',
    ruta: '/estudiante/convocatoria',
    icono: 'HelpCircle',
    pista: 'Inscripción',
    roles: [...ALUMNO],
    terminos: [
      'como me inscribo', 'inscribirme', 'inscripcion', 'registrarme', 'darme de alta',
      'quiero inscribirme', 'apuntarme', 'como entro', 'proceso de inscripcion',
    ],
  },
  {
    id: 'res-alu-cuantos-modulos',
    tipo: 'respuesta',
    titulo: '¿Cuántos módulos puedo llevar por convocatoria?',
    cuerpo:
      'Puedes inscribir un máximo de 4 módulos en cada convocatoria. El Plan 22 tiene 22 módulos en total, así que el avance se hace por etapas.',
    ruta: '/estudiante/modulos',
    icono: 'HelpCircle',
    pista: 'Máximo 4',
    roles: [...ALUMNO],
    terminos: [
      'cuantos modulos', 'maximo de modulos', 'limite de modulos', 'cuantas materias',
      'puedo llevar', 'numero de modulos', 'cuantos puedo',
    ],
  },
  {
    id: 'res-alu-que-documentos',
    tipo: 'respuesta',
    titulo: '¿Qué documentos necesito?',
    cuerpo:
      'El expediente pide 5 documentos: acta de nacimiento, CURP, certificado de secundaria, comprobante de domicilio y fotografía. Se suben desde Mi expediente y la Secretaría los revisa uno por uno.',
    ruta: '/estudiante/expediente',
    icono: 'HelpCircle',
    pista: '5 documentos',
    roles: [...ALUMNO],
    terminos: [
      'que documentos', 'que papeles', 'requisitos', 'que necesito', 'documentacion',
      'que piden', 'que llevo', 'cuales documentos', 'que se necesita',
    ],
  },
  {
    id: 'res-alu-como-pago',
    tipo: 'respuesta',
    titulo: '¿Cómo pago mi examen?',
    cuerpo:
      'Cuando te inscribes se emite una orden de pago con una línea de captura del Estado. Págala en el banco o en línea con esa referencia. No se paga dentro de la plataforma: aquí sólo se consulta y se da seguimiento.',
    ruta: '/estudiante/pagos',
    icono: 'HelpCircle',
    pista: 'Pagos',
    roles: [...ALUMNO],
    terminos: [
      'como pago', 'donde pago', 'como pagar', 'forma de pago', 'linea de captura',
      'referencia bancaria', 'puedo pagar aqui', 'pagar en linea', 'metodo de pago',
    ],
  },
  {
    id: 'res-alu-ya-pague',
    tipo: 'respuesta',
    titulo: 'Ya pagué, ¿por qué no aparece?',
    cuerpo:
      'El pago no se refleja al instante: la Tesorería del Estado lo concilia y luego se marca como registrado aquí. Revisa el estado en Mis pagos. Si pasaron varios días hábiles y sigue pendiente, escribe a la Secretaría con tu comprobante.',
    ruta: '/estudiante/pagos',
    icono: 'HelpCircle',
    pista: 'Pagos',
    roles: [...ALUMNO],
    terminos: [
      'ya pague', 'no aparece mi pago', 'pago no registrado', 'pague y no sale',
      'mi pago no se ve', 'cuanto tarda el pago', 'pago pendiente', 'no me reconoce el pago',
    ],
  },
  {
    id: 'res-alu-donde-examen',
    tipo: 'respuesta',
    titulo: '¿Dónde presento mi examen?',
    cuerpo:
      'En la sede que elegiste al inscribirte. Aparece en Mi convocatoria junto con la fecha y la hora. La sede no se deduce de tu municipio: es la que tú seleccionaste, y sólo se puede cambiar dentro del periodo de inscripción.',
    ruta: '/estudiante/convocatoria',
    icono: 'HelpCircle',
    pista: 'Sede',
    roles: [...ALUMNO],
    terminos: [
      'donde presento', 'donde es el examen', 'mi sede', 'sede', 'lugar del examen',
      'a donde voy', 'direccion del examen', 'cambiar sede', 'en que escuela',
    ],
  },
  {
    id: 'res-alu-calificacion-aprueba',
    tipo: 'respuesta',
    titulo: '¿Con cuánto se aprueba?',
    cuerpo:
      'Se acredita un módulo con 60 o más. Debajo de 60 el módulo se puede volver a presentar en una convocatoria posterior.',
    ruta: '/estudiante/calificaciones',
    icono: 'HelpCircle',
    pista: '60 mínimo',
    roles: [...ALUMNO],
    terminos: [
      'con cuanto se aprueba', 'calificacion minima', 'cuanto necesito', 'pasar',
      'aprobar', 'reprobar', 'que pasa si repruebo', 'puedo repetir', 'recursar',
    ],
  },
  {
    id: 'res-alu-matricula',
    tipo: 'respuesta',
    titulo: '¿Dónde está mi matrícula?',
    cuerpo:
      'La matrícula oficial la asigna la SEP-DGB después de validar tu registro, así que no aparece de inmediato. Mientras tanto usas tu folio de pre-registro. Cuando llegue, la verás en Mi expediente junto con tu cédula de inscripción.',
    ruta: '/estudiante/expediente',
    icono: 'HelpCircle',
    pista: 'Expediente',
    roles: [...ALUMNO],
    terminos: [
      'matricula', 'mi matricula', 'numero de matricula', 'no tengo matricula',
      'cuando me dan matricula', 'folio', 'numero de control', 'dgb',
    ],
  },
  {
    id: 'res-alu-credencial',
    tipo: 'respuesta',
    titulo: '¿Cómo obtengo mi credencial?',
    cuerpo:
      'Tu credencial digital se genera sola en Mi identificación cuando tu expediente está completo. Puedes voltearla para ver el QR y tocar "Ver en grande" para mostrarla a pantalla completa el día del examen.',
    ruta: '/estudiante/identificacion',
    icono: 'HelpCircle',
    pista: 'Identificación',
    roles: [...ALUMNO],
    terminos: [
      'credencial', 'como saco mi credencial', 'identificacion', 'gafete',
      'mi id', 'codigo qr', 'no tengo credencial', 'imprimir credencial',
    ],
  },
  {
    id: 'res-alu-contrasena',
    tipo: 'respuesta',
    titulo: 'Olvidé mi contraseña',
    cuerpo:
      'Desde la pantalla de inicio de sesión usa "Recuperar contraseña" y te llega un enlace al correo con el que te registraste. Si ya no tienes acceso a ese correo, usa "Encontrar mi cuenta" con tu CURP.',
    ruta: '/estudiante/perfil',
    icono: 'HelpCircle',
    pista: 'Mi perfil',
    roles: [...ALUMNO],
    terminos: [
      'contrasena', 'password', 'olvide mi contrasena', 'recuperar contrasena',
      'cambiar contrasena', 'no puedo entrar', 'perdi mi cuenta', 'acceso',
    ],
  },
];

const RESPUESTAS_GESTOR: EntradaIndice[] = [
  {
    id: 'res-ges-alta-alumno',
    tipo: 'respuesta',
    titulo: '¿Cómo doy de alta a un alumno?',
    cuerpo:
      'Entra a Mis alumnos y usa "Registrar alumno". Captura sus datos y su CURP; el sistema valida la estructura de la CURP y que no exista ya. Después subes su expediente documento por documento.',
    ruta: '/gestor/alumnos/nuevo',
    icono: 'HelpCircle',
    pista: 'Alumnos',
    roles: [...GESTOR],
    terminos: [
      'dar de alta', 'alta de alumno', 'registrar alumno', 'nuevo alumno',
      'agregar alumno', 'meter alumno', 'como registro', 'inscribir a alguien',
    ],
  },
  {
    id: 'res-ges-pago-grupal',
    tipo: 'respuesta',
    titulo: '¿Cómo hago un pago grupal?',
    cuerpo:
      'Desde Pagos puedes cubrir varios exámenes con un solo comprobante ante Tesorería. Registras cuántos exámenes pagas y subes el comprobante; la Secretaría lo verifica y se generan los pagos individuales de cada alumno con la referencia del folio grupal.',
    ruta: '/gestor/pagos',
    icono: 'HelpCircle',
    pista: 'Pagos',
    roles: [...GESTOR],
    terminos: [
      'pago grupal', 'pagos grupales', 'pagar varios', 'un solo pago', 'pago en bloque',
      'pagar por todos', 'comprobante grupal', 'tesoreria',
    ],
  },
  {
    id: 'res-ges-documentos-rechazados',
    tipo: 'respuesta',
    titulo: 'Le rechazaron un documento a mi alumno',
    cuerpo:
      'En el expediente del alumno verás el motivo del rechazo escrito por quien lo revisó. Corrige lo señalado y vuelve a subir ese documento; no hace falta cargar de nuevo los demás.',
    ruta: '/gestor/alumnos',
    icono: 'HelpCircle',
    pista: 'Alumnos',
    roles: [...GESTOR],
    terminos: [
      'documento rechazado', 'rechazaron', 'me rechazaron', 'documento mal',
      'volver a subir', 'corregir documento', 'observaciones', 'por que rechazaron',
    ],
  },
  {
    id: 'res-ges-cuantos-modulos',
    tipo: 'respuesta',
    titulo: '¿Cuántos módulos puede llevar un alumno?',
    cuerpo:
      'Máximo 4 módulos por convocatoria, sin importar por cuál de las tres vías se inscriba. El sistema no deja pasar de ahí.',
    ruta: '/gestor/alumnos',
    icono: 'HelpCircle',
    pista: 'Máximo 4',
    roles: [...GESTOR],
    terminos: [
      'cuantos modulos', 'maximo de modulos', 'limite', 'cuantas materias',
      'puede llevar', 'numero de modulos',
    ],
  },
];

/** Índice completo. El motor filtra por rol; aquí van todas las entradas. */
export const INDICE: EntradaIndice[] = [
  ...SECCIONES_ALUMNO,
  ...SECCIONES_GESTOR,
  ...SECCIONES_COMUNES,
  ...RESPUESTAS_ALUMNO,
  ...RESPUESTAS_GESTOR,
];
