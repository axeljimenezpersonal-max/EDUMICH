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
export const GATE_GESTOR = 'edumich_tour_v1_gestor';

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
    body: 'Aquí ves, siempre al día, cuándo está abierta la ventana para inscribir y pagar, y cuándo presentan examen tus alumnos. En el aviso morado del examen puedes descargar la lista de alumnos que participan.',
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
    body: 'Aquí das de alta a un nuevo alumno y lo vinculas a la convocatoria activa. El proceso tiene un camino claro: capturas sus datos, subes sus documentos y la administración los valida.',
    illustration: 'altaFlow',
  },
  {
    id: 'g-alta-conv',
    anchor: 'g-alta-conv',
    placement: 'bottom',
    icon: 'CalendarCheck',
    title: 'Se registra en esta convocatoria',
    body: 'El alumno queda vinculado a la convocatoria abierta que se muestra aquí. Si no hay convocatoria activa, no es posible registrar: espera a que abra la ventana.',
  },
  {
    id: 'g-alta-pasos',
    anchor: 'g-alta-pasos',
    placement: 'bottom',
    icon: 'ListChecks',
    title: 'Son dos pasos',
    body: 'Paso 1, datos personales; paso 2, documentos. Avanzas de uno al otro cuando el anterior está completo, así no se te olvida nada.',
  },
  {
    id: 'g-alta-datos',
    anchor: 'g-alta-datos',
    placement: 'top',
    icon: 'IdCard',
    title: 'Captura sus datos',
    body: 'Llena los campos marcados con asterisco. La CURP se valida automáticamente para evitar errores y duplicados. Al alumno le llegarán sus credenciales de acceso a la plataforma.',
  },
  {
    id: 'g-alta-fin',
    anchor: 'btn-seccion-tutorial',
    placement: 'left',
    icon: 'RefreshCw',
    title: '¡Listo para registrar!',
    body: 'Al terminar, el alumno queda “pendiente de revisión” hasta que la administración valide sus documentos. Repite este tutorial con el botón cuando quieras.',
  },
];

// ── Mis alumnos ────────────────────────────────────────────────
export const TOUR_G_ALUMNOS: TourStep[] = [
  {
    id: 'g-alu-intro',
    icon: 'Users',
    title: 'Tus alumnos',
    body: 'La lista de todos los alumnos de tu centro. Desde aquí das seguimiento a cada uno: su expediente, su inscripción, sus pagos y sus resultados.',
  },
  {
    id: 'g-alu-buscar',
    anchor: 'g-alu-buscar',
    placement: 'bottom',
    icon: 'Search',
    title: 'Busca y filtra',
    body: 'Encuentra a un alumno por nombre o CURP, o usa los filtros de estado para ver, por ejemplo, solo a quienes les faltan documentos o ya tienen inscripción. El número en cada filtro te dice cuántos hay.',
  },
  {
    id: 'g-alu-tabla',
    anchor: 'g-alu-tabla',
    placement: 'top',
    icon: 'Table',
    title: 'Su estado de un vistazo',
    body: 'Cada fila muestra al alumno, su CURP, su estado y cuántos documentos le faltan. Toca cualquier fila para abrir su expediente completo y actuar sobre él.',
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
    title: 'Calificaciones de tus alumnos',
    body: 'Consulta, filtra y descarga los resultados de tus alumnos. Tú no capturas ni cambias calificaciones —eso lo hace la administración—; aquí las revisas y les das seguimiento.',
  },
  {
    id: 'g-cal-vista',
    anchor: 'g-cal-vista',
    placement: 'bottom',
    icon: 'LayoutGrid',
    title: 'Dos tipos de resultado',
    body: 'Cambia entre dos vistas: “Exámenes oficiales” son las calificaciones oficiales que registra la administración (las que cuentan para el certificado); “Evaluaciones de práctica” son los ensayos que tus alumnos resuelven en la plataforma para prepararse.',
  },
  {
    id: 'g-cal-toolbar',
    anchor: 'g-cal-toolbar',
    placement: 'bottom',
    icon: 'Filter',
    title: 'Busca, filtra y descarga',
    body: 'Busca por nombre, matrícula, CURP o folio; filtra por convocatoria; y con “Descargar PDF” obtienes la Relación de Calificaciones y Aciertos oficial para tus registros.',
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
