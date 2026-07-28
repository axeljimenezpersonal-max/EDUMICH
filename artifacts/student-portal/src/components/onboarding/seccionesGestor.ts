/**
 * Recorridos PROFUNDOS por página del panel del GESTOR municipal.
 *
 * Mismos principios que los del estudiante (ver seccionesEstudiante.ts): cada
 * paso ilumina un bloque real vía `anchor` y algunos muestran una animación que
 * explica la función por sí sola. Redactados en tono FORMAL e INTUITIVO para que
 * el gestor entienda qué es cada sección, para qué sirve y cómo aprovecharla sin
 * que nadie tenga que explicárselo.
 */

import type { TourStep } from './steps';

/** El recorrido de bienvenida del gestor marca esta clave al terminar. */
export const GATE_GESTOR = 'bienvenida_gestor';

// ── Inicio ─────────────────────────────────────────────────────
export const TOUR_G_INICIO: TourStep[] = [
  {
    id: 'g-ini-intro',
    icon: 'LayoutDashboard',
    title: 'Tu panel de gestor',
    body: 'Desde aquí acompañas a los alumnos de tu centro: los registras, revisas sus documentos, gestionas sus pagos y sigues sus calificaciones. Recuerda: tú eres el intermediario ante la Secretaría; no evalúas exámenes.',
  },
  {
    id: 'g-ini-fechas',
    anchor: 'g-ini-fechas',
    placement: 'bottom',
    icon: 'CalendarClock',
    title: 'Fechas que importan',
    body: 'Aquí ves, siempre al día, cuándo está abierta la ventana para inscribir, y cuándo presentan examen tus alumnos. El pago se realiza después, en las fechas que indica la Secretaría. En el aviso morado del examen puedes descargar la lista de alumnos que participan.',
  },
  {
    id: 'g-ini-kpis',
    anchor: 'g-ini-kpis',
    placement: 'top',
    icon: 'BarChart3',
    title: 'Tus indicadores',
    body: 'Un resumen de tu centro: alumnos totales, cuántos ya tienen inscripción, documentos pendientes de completar y pagos por resolver. Cada tarjeta es un atajo: tócala para ver esa lista filtrada.',
  },
  {
    id: 'g-ini-accesos',
    anchor: 'g-ini-accesos',
    placement: 'top',
    icon: 'MousePointerClick',
    title: 'Accesos rápidos',
    body: 'Las acciones más frecuentes a un clic: registrar un nuevo alumno o ir a tu lista. Úsalos para no perder tiempo buscando en el menú.',
  },
  {
    id: 'g-ini-fin',
    anchor: 'btn-seccion-tutorial',
    placement: 'left',
    icon: 'RefreshCw',
    title: '¡Ese es tu inicio!',
    body: 'Tu punto de partida cada día. Repite este tutorial con el botón cuando quieras.',
  },
];

// ── Nuevo alumno ───────────────────────────────────────────────
export const TOUR_G_NUEVO_ALUMNO: TourStep[] = [
  {
    id: 'g-alta-intro',
    icon: 'UserPlus',
    title: 'Registrar a un alumno',
    body: 'Su alta sigue un camino claro: datos, documentos, revisión y aprobación.',
    illustration: 'altaFlow',
  },
  {
    id: 'g-alta-conv',
    anchor: 'g-alta-conv',
    placement: 'bottom',
    icon: 'CalendarCheck',
    title: 'La convocatoria es opcional',
    body: 'Siempre puedes registrarlo. Con convocatoria abierta queda inscrito; sin ella, queda registrado y se inscribe después.',
    illustration: 'altaConvocatoria',
  },
  {
    id: 'g-alta-pasos',
    anchor: 'g-alta-pasos',
    placement: 'bottom',
    icon: 'ListChecks',
    title: 'Son dos pasos',
    body: 'Primero sus datos; luego sus documentos. Pasas al segundo cuando los datos están completos.',
    illustration: 'altaDosPasos',
  },
  {
    id: 'g-alta-datos',
    anchor: 'g-alta-datos',
    placement: 'top',
    icon: 'IdCard',
    title: 'La CURP se valida sola',
    body: 'El sistema revisa su estructura, sus datos y los duplicados al vuelo. Cuida el correo: ahí llegan sus accesos.',
    illustration: 'curpCheck',
  },
  {
    id: 'g-alta-cuenta',
    icon: 'KeyRound',
    title: 'Se crea su cuenta',
    body: 'Al registrarlo se le envían sus credenciales por correo para entrar a su propio portal. Si no le llegan, puedes reenviárselas.',
    illustration: 'cuentaCorreo',
  },
  {
    id: 'g-alta-fin',
    anchor: 'btn-seccion-tutorial',
    placement: 'left',
    icon: 'RefreshCw',
    title: '¡Listo para registrar!',
    body: 'Queda “pendiente de revisión” hasta que la administración valide sus documentos. Repite este tutorial cuando quieras.',
  },
];

// ── Mis alumnos ────────────────────────────────────────────────
export const TOUR_G_ALUMNOS: TourStep[] = [
  {
    id: 'g-alu-intro',
    icon: 'Users',
    title: 'Tus alumnos',
    body: 'Todos los alumnos de tu centro. Entra a cualquiera para darle seguimiento a su trámite.',
  },
  {
    id: 'g-alu-buscar',
    anchor: 'g-alu-buscar',
    placement: 'bottom',
    icon: 'Search',
    title: 'Busca y filtra',
    body: 'Por nombre o CURP, o por estado (a quién le faltan documentos, quién ya tiene inscripción…). El número dice cuántos hay en cada uno.',
  },
  {
    id: 'g-alu-tabla',
    anchor: 'g-alu-tabla',
    placement: 'top',
    icon: 'Table',
    title: 'En qué etapa va cada uno',
    body: 'El chip de cada fila te dice su etapa. El camino es: documentos → matrícula → módulos → pago → activo. Toca una fila para abrir su expediente.',
    illustration: 'estadoFlow',
  },
  {
    id: 'g-alu-fin',
    anchor: 'btn-seccion-tutorial',
    placement: 'left',
    icon: 'RefreshCw',
    title: '¡Esos son tus alumnos!',
    body: 'Tu directorio de seguimiento. Repite este tutorial con el botón cuando quieras.',
  },
];

// ── Ficha del alumno (/gestor/alumnos/:id) ─────────────────────
// La pantalla donde el gestor hace el grueso de su trabajo con cada alumno.
export const TOUR_G_FICHA: TourStep[] = [
  {
    id: 'g-ficha-intro',
    icon: 'UserSquare',
    title: 'La ficha del alumno',
    body: 'Todo su trámite en un solo lugar: documentos, inscripción, pago, calificaciones y credencial.',
  },
  {
    id: 'g-ficha-tabs',
    anchor: 'g-ficha-tabs',
    placement: 'bottom',
    icon: 'PanelsTopLeft',
    title: 'Su trámite, por pestañas',
    body: 'Van en orden. El número de cada pestaña te avisa qué falta. Te muestro para qué sirve cada una.',
    illustration: 'fichaFlow',
  },
  {
    id: 'g-ficha-docs',
    anchor: 'g-ficha-tab-docs',
    placement: 'bottom',
    icon: 'FolderOpen',
    title: '1) Documentos · los subes tú',
    body: 'Cargas su expediente (5 obligatorios) y su cédula. Tú y el alumno comparten el mismo expediente; la administración lo valida.',
  },
  {
    id: 'g-ficha-cuenta',
    anchor: 'g-ficha-credenciales',
    placement: 'bottom',
    icon: 'KeyRound',
    title: 'Su cuenta de acceso',
    body: 'Al registrarlo se le envían sus credenciales por correo, para su propio portal. Si no le llegaron, aquí las reenvías.',
  },
  {
    id: 'g-ficha-inscripcion',
    anchor: 'g-ficha-tab-plan',
    placement: 'bottom',
    icon: 'CalendarCheck',
    title: '2) Inscripción · a los módulos',
    body: 'Lo inscribes a los módulos de la convocatoria activa. Un mismo día y hora es un bloque: solo uno por bloque.',
  },
  {
    id: 'g-ficha-pagos',
    anchor: 'g-ficha-tab-convocatoria',
    placement: 'bottom',
    icon: 'Receipt',
    title: '3) Pagos · su examen',
    body: 'Gestionas el pago ante la Tesorería. Al confirmarse, su inscripción queda “confirmada” y obtiene su pase.',
  },
  {
    id: 'g-ficha-calif',
    anchor: 'g-ficha-tab-calificaciones',
    placement: 'bottom',
    icon: 'GraduationCap',
    title: 'Calificaciones',
    body: 'Sus resultados oficiales conforme la administración los registra. Solo lectura: das seguimiento, no capturas notas.',
  },
  {
    id: 'g-ficha-cred',
    anchor: 'g-ficha-tab-credencial',
    placement: 'bottom',
    icon: 'Award',
    title: 'Credencial',
    body: 'Su identificación oficial. Cuando está emitida, la consultas y descargas aquí.',
  },
  {
    id: 'g-ficha-fin',
    anchor: 'btn-seccion-tutorial',
    placement: 'left',
    icon: 'RefreshCw',
    title: '¡Ese es el proceso completo!',
    body: 'Documentos, inscripción, pago, pase, calificaciones y credencial: todo el acompañamiento del alumno vive aquí. Repite este tutorial con el botón cuando quieras.',
  },
];

// ── Inscripción en lote ────────────────────────────────────────
export const TOUR_G_INSCRIPCION: TourStep[] = [
  {
    id: 'g-insc-intro',
    icon: 'ClipboardList',
    title: 'Inscribe en lote',
    body: 'Inscribes a varios alumnos a uno o más módulos de una sola vez. Cada examen cuesta $131.',
    illustration: 'inscribeLote',
  },
  {
    id: 'g-insc-etapa',
    anchor: 'g-insc-etapa',
    placement: 'bottom',
    icon: 'CalendarClock',
    title: 'Solo con la ventana abierta',
    body: 'La inscripción únicamente se puede dentro de la ventana de la etapa activa. Fuera de esas fechas queda cerrada.',
  },
  {
    id: 'g-insc-modulos',
    anchor: 'g-insc-modulos',
    placement: 'top',
    icon: 'LayoutGrid',
    title: 'Elige los módulos',
    body: 'Máximo 4 por alumno. Un mismo día y hora es un bloque: solo puedes elegir uno de cada bloque, porque no se presentan dos exámenes a la vez.',
  },
  {
    id: 'g-insc-alumnos',
    anchor: 'g-insc-alumnos',
    placement: 'top',
    icon: 'UserCheck',
    title: 'Solo alumnos elegibles',
    body: 'Únicamente aparecen quienes tienen matrícula oficial Y expediente 5/5 aprobado. Si un alumno no está, aún le falta uno de esos dos.',
    illustration: 'elegibleCheck',
  },
  {
    id: 'g-insc-fin',
    anchor: 'btn-seccion-tutorial',
    placement: 'left',
    icon: 'RefreshCw',
    title: '¡Listo para inscribir!',
    body: 'Al inscribir, cada examen queda listo para solicitar su ficha en Pagos. Repite este tutorial cuando quieras.',
  },
];

// ── Pagos ──────────────────────────────────────────────────────
export const TOUR_G_PAGOS: TourStep[] = [
  {
    id: 'g-pag-intro',
    icon: 'Landmark',
    title: 'Pagos ante la Tesorería',
    body: 'Aquí gestionas el pago de los exámenes de tus alumnos. El pago es ante la Tesorería del Estado; tú solicitas la ficha, la coordinación la emite y tú subes el comprobante.',
    illustration: 'pagoFlow',
  },
  {
    id: 'g-pag-primero-inscritos',
    anchor: 'nav-inscripcion',
    placement: 'right',
    icon: 'AlertCircle',
    title: 'Primero: que estén inscritos',
    body: 'Ojo: el pago es POR examen inscrito. Antes de solicitar la ficha, asegúrate de que tus alumnos YA estén inscritos a sus módulos. Si te falta, ve primero a Inscripción (aquí resaltada) y regresa.',
  },
  {
    id: 'g-pag-solicitar',
    anchor: 'g-pag-solicitar',
    placement: 'bottom',
    icon: 'Plus',
    title: 'Solicita una ficha',
    body: 'Con “Solicitar ficha” eliges los exámenes de tus alumnos y pides su orden de pago. Puedes juntar varios alumnos en una sola ficha para pagarlos de una vez.',
  },
  {
    id: 'g-pag-fichas',
    anchor: 'g-pag-fichas',
    placement: 'top',
    icon: 'ReceiptText',
    title: 'Sigue cada ficha',
    body: 'Cada ficha muestra su folio, cuántos exámenes cubre, el total y su estado. Toca una para ver su línea de captura, pagar y subir tu comprobante; la coordinación lo valida y queda confirmada.',
  },
  {
    id: 'g-pag-fin',
    anchor: 'btn-seccion-tutorial',
    placement: 'left',
    icon: 'RefreshCw',
    title: '¡Eso es Pagos!',
    body: 'Aquí controlas todos los pagos de tus alumnos. Repite este tutorial con el botón cuando quieras.',
  },
];

// ── Calificaciones ─────────────────────────────────────────────
export const TOUR_G_CALIFICACIONES: TourStep[] = [
  {
    id: 'g-cal-intro',
    icon: 'GraduationCap',
    title: 'Los resultados de tus alumnos',
    body: 'Aquí consultas, filtras y descargas. Tú no capturas notas: eso lo hace la administración; aquí les das seguimiento.',
  },
  {
    id: 'g-cal-vista',
    anchor: 'g-cal-vista',
    placement: 'bottom',
    icon: 'LayoutGrid',
    title: 'Dos vistas',
    body: 'Oficiales (DGB, cuentan para el certificado) y de práctica (ensayos en la plataforma).',
    illustration: 'dosVistas',
  },
  {
    id: 'g-cal-stats',
    anchor: 'g-cal-stats',
    placement: 'bottom',
    icon: 'BarChart3',
    title: 'Tu resumen de un vistazo',
    body: 'Aprobados, no aprobados, sin calificar, promedio y % de aprobación de tu centro.',
    illustration: 'statsCalif',
  },
  {
    id: 'g-cal-toolbar',
    anchor: 'g-cal-toolbar',
    placement: 'bottom',
    icon: 'Filter',
    title: 'Busca, filtra y descarga',
    body: 'Por nombre, matrícula, CURP o folio; filtra por convocatoria; y con “Descargar PDF” bajas la Relación oficial.',
  },
  {
    id: 'g-cal-fin',
    anchor: 'btn-seccion-tutorial',
    placement: 'left',
    icon: 'RefreshCw',
    title: '¡Eso es Calificaciones!',
    body: 'Aquí sigues el desempeño de tu centro. Repite este tutorial con el botón cuando quieras.',
  },
];

// ── Mensajes ───────────────────────────────────────────────────
export const TOUR_G_MENSAJES: TourStep[] = [
  {
    id: 'g-msg-intro',
    icon: 'MessageSquare',
    title: 'Chat con la Secretaría',
    body: 'Este es tu canal directo con la Secretaría (IEMSyS) para cualquier duda de la gestión de tu centro. Escribe tu mensaje y te responden en horario de oficina.',
  },
  {
    id: 'g-msg-legal',
    icon: 'Lock',
    title: 'Queda registrada y almacenada',
    body: 'Importante: toda esta conversación se registra y se almacena por motivos legales y de privacidad de datos, y puede ser consultada por el personal. Mantén un trato formal, como en cualquier gestión oficial.',
    illustration: 'chatLegal',
  },
  {
    id: 'g-msg-ejemplo',
    icon: 'MessagesSquare',
    title: 'Así se ve una conversación',
    body: 'Planteas tu asunto, la Secretaría lo lee y te responde en horario de oficina. Sé claro y concreto; si te piden un documento, puedes adjuntarlo en el chat.',
    illustration: 'chatDemo',
  },
  {
    id: 'g-msg-fin',
    anchor: 'btn-seccion-tutorial',
    placement: 'left',
    icon: 'RefreshCw',
    title: '¡Eso es Mensajes!',
    body: 'Tu línea directa con la Secretaría. Repite este tutorial con el botón cuando quieras.',
  },
];

// ── Mi aula ────────────────────────────────────────────────────
export const TOUR_G_AULA: TourStep[] = [
  {
    id: 'g-aula-intro',
    icon: 'School',
    title: 'El aula virtual de tu centro',
    body: 'Si tu centro tiene activada esta función, aquí impartes clase en línea a tus alumnos. Todo se organiza por MÓDULO, como en la universidad: cada módulo tiene su foro, tareas, materiales y videos.',
  },
  {
    id: 'g-aula-tablero',
    anchor: 'g-aula-tablero',
    placement: 'bottom',
    icon: 'LayoutDashboard',
    title: 'Tu tablero',
    body: 'De un vistazo ves el pulso de tu aula: cuántos alumnos, tareas, materiales y mensajes hay en marcha. Es tu resumen de actividad.',
  },
  {
    id: 'g-aula-agregar',
    anchor: 'g-aula-agregar',
    placement: 'top',
    icon: 'PlusCircle',
    title: 'Arma tus clases por módulo',
    body: 'Agrega los módulos que vas a impartir. Al entrar a cada uno gestionas sus cuatro secciones: Foro para conversar y dar avisos, Tareas para asignar y recibir trabajos, Materiales para compartir recursos y Videos para tus clases.',
    illustration: 'aulaNav',
  },
  {
    id: 'g-aula-fin',
    anchor: 'btn-seccion-tutorial',
    placement: 'left',
    icon: 'RefreshCw',
    title: '¡Esa es tu aula!',
    body: 'Aquí acompañas el estudio de tus alumnos más allá del examen. Repite este tutorial con el botón cuando quieras.',
  },
];
