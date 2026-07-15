/**
 * Recorridos PROFUNDOS por página del portal del estudiante (bloque por bloque).
 * Se muestran con <SectionTour/> dentro de cada página. Los anclajes viven en el
 * JSX de cada página como `data-tour="..."`.
 */

import type { TourStep } from './steps';

/** Clave del recorrido de bienvenida del estudiante (para no encimarse). */
export const GATE_ESTUDIANTE = 'edumich_tour_v1_estudiante';

// ── Inicio (dashboard) ─────────────────────────────────────────
export const TOUR_INICIO: TourStep[] = [
  {
    id: 'ini-intro',
    icon: 'LayoutDashboard',
    title: 'Bienvenido a tu página de Inicio',
    body: 'Este es tu tablero: cada vez que entres, aquí ves de un vistazo en qué punto vas de tu trámite y qué sigue. Te lo muestro bloque por bloque, en orden. ¡Empecemos!',
  },
  {
    id: 'ini-inscripcion',
    anchor: 'dash-inscripcion',
    placement: 'bottom',
    icon: 'CalendarClock',
    title: 'Inscripción y pago abiertos',
    body: 'Cuando hay una etapa abierta para inscribirte y pagar tu examen, aquí aparece con sus fechas exactas y los días que faltan para el cierre. Tócalo para ir directo a inscribirte. Si no ves este aviso, es que no hay una ventana abierta por ahora.',
  },
  {
    id: 'ini-ficha',
    anchor: 'dash-ficha',
    placement: 'bottom',
    icon: 'FileText',
    title: 'Tus documentos: cédula, matrícula y credencial',
    body: 'Estas tres tarjetas son tus documentos clave. Al inicio verás tu FICHA DE PRE-REGISTRO con tu folio; cuando la SEP-DGB valide tu registro, aparecen tu MATRÍCULA oficial y tu CÉDULA de inscripción. La tercera es tu IDENTIFICACIÓN digital. Todo descargable.',
  },
  {
    id: 'ini-estado',
    anchor: 'dash-estado',
    placement: 'top',
    icon: 'CheckCircle2',
    title: 'Estado de tu inscripción',
    body: 'Te dice en qué punto del proceso vas y qué te toca hacer. Si aún no te inscribes a una convocatoria, aquí verás que no tienes inscripción activa.',
  },
  {
    id: 'ini-examen',
    anchor: 'dash-examen',
    placement: 'top',
    icon: 'CalendarCheck',
    title: 'Tu próximo examen',
    body: 'Si ya estás inscrito, aquí ves tu convocatoria, la fecha de presentación, tu sede y una cuenta regresiva. Justo abajo aparecen tus exámenes de esa convocatoria.',
  },
  {
    id: 'ini-kpis',
    anchor: 'dash-kpis',
    placement: 'top',
    icon: 'BarChart3',
    title: 'Tus números clave',
    body: 'Cuatro indicadores de tu avance: módulos aprobados de los 22 que necesitas, documentos aprobados, documentos que te faltan y avisos sin leer. Toca cada uno para ir a su sección.',
  },
  {
    id: 'ini-avisos',
    anchor: 'dash-avisos',
    placement: 'top',
    icon: 'Bell',
    title: 'Avisos importantes',
    body: 'Los comunicados de la coordinación aparecen aquí: fechas, requisitos y recordatorios. Toca "Ver todos" para revisar el historial completo.',
  },
  {
    id: 'ini-ayuda',
    anchor: 'dash-ayuda',
    placement: 'top',
    icon: 'LifeBuoy',
    title: '¿Necesitas ayuda?',
    body: 'Aquí están los datos de contacto de tu gestor y de la administración. Si algo no te queda claro en tu trámite, ya sabes a quién acudir.',
  },
  {
    id: 'ini-fin',
    anchor: 'btn-seccion-tutorial',
    placement: 'left',
    icon: 'RefreshCw',
    title: '¡Listo! Repítelo cuando quieras',
    body: 'Con este botón vuelves a ver el tutorial de esta sección las veces que necesites. Cada página del portal tiene el suyo. ¡Empieza por tu expediente y sigue el camino!',
  },
];

// ── Expediente ─────────────────────────────────────────────────
export const TOUR_EXPEDIENTE: TourStep[] = [
  {
    id: 'exp-intro',
    icon: 'FolderOpen',
    title: 'Tu Expediente',
    body: 'Aquí reúnes todo lo que la administración necesita para inscribirte: tus datos y tus documentos oficiales. Es el primer paso de tu proceso; te lo explico bloque por bloque.',
  },
  {
    id: 'exp-progreso',
    anchor: 'exp-progreso',
    placement: 'bottom',
    icon: 'BarChart3',
    title: 'Tu avance',
    body: 'Esta barra te dice cuántos de tus documentos obligatorios ya fueron aprobados y cuántos subiste que están en revisión. Tu meta: los 5 aprobados.',
  },
  {
    id: 'exp-matricula',
    anchor: 'exp-matricula',
    placement: 'bottom',
    icon: 'Award',
    title: 'Tu matrícula / folio',
    body: 'Mientras la SEP-DGB valida tu registro, aquí ves tu folio de pre-registro. Cuando te asignen tu matrícula oficial, aparecerá aquí junto con el acceso a tu cédula de inscripción.',
  },
  {
    id: 'exp-datos',
    anchor: 'exp-datos',
    placement: 'bottom',
    icon: 'UserCog',
    title: 'Tus datos personales',
    body: 'Revisa que tu nombre, CURP, fecha de nacimiento y dirección sean correctos. Si algo cambió, usa "Editar" y guarda. Estos datos aparecen en tus documentos oficiales.',
  },
  {
    id: 'exp-obligatorios',
    anchor: 'exp-obligatorios',
    placement: 'top',
    icon: 'FileCheck2',
    title: 'Documentos obligatorios',
    body: 'Los 5 que sí o sí necesitas: CURP, acta de nacimiento, INE, comprobante de domicilio y certificado de secundaria. Toca cada uno para subir tu archivo (PDF o foto). La administración los revisa y te avisa si aprueba o pide corregir. Aquí abajo también consultas tu cédula de inscripción.',
  },
  {
    id: 'exp-credencial',
    anchor: 'exp-credencial',
    placement: 'top',
    icon: 'BadgeCheck',
    title: 'Documentos para tu credencial',
    body: 'Aquí subes tu fotografía, que se usa para tu credencial digital y tu cédula. No es obligatoria para inscribirte, pero cuídala: debe ser clara, de frente y con buena luz.',
  },
  {
    id: 'exp-fin',
    anchor: 'btn-seccion-tutorial',
    placement: 'left',
    icon: 'RefreshCw',
    title: '¡Eso es tu Expediente!',
    body: 'Sube tus 5 obligatorios para poder avanzar a la inscripción. ¿Necesitas repasar? Este botón repite el tutorial cuando quieras.',
  },
];

// ── Inscripción (convocatoria) ─────────────────────────────────
export const TOUR_INSCRIPCION: TourStep[] = [
  {
    id: 'insc-intro',
    icon: 'Calendar',
    title: 'Tu Inscripción a exámenes',
    body: 'Aquí te inscribes a los módulos que quieres presentar en la convocatoria activa. Es el paso después de completar tu expediente.',
  },
  {
    id: 'insc-requisitos',
    anchor: 'insc-requisitos',
    placement: 'bottom',
    icon: 'ListChecks',
    title: 'Requisitos para inscribirte',
    body: 'Antes de elegir módulos, necesitas tu expediente completo. Esta lista te muestra qué documentos ya tienes y cuáles te faltan; en cuanto estén aprobados, se abre la inscripción.',
  },
  {
    id: 'insc-como',
    icon: 'Route',
    title: 'Cómo funciona',
    body: 'Cuando la convocatoria esté abierta y tu expediente listo: eliges tus módulos, se te asigna sede y fecha, y generas tu pago. Recuerda: solo lo pagado se puede calificar.',
  },
  {
    id: 'insc-fin',
    anchor: 'btn-seccion-tutorial',
    placement: 'left',
    icon: 'RefreshCw',
    title: '¡Eso es Inscripción!',
    body: 'Cuando abra la convocatoria, aquí eliges tus exámenes. Repite este tutorial con el botón cuando quieras.',
  },
];

/**
 * Recorrido de Inscripción cuando la convocatoria está ABIERTA y el alumno ya
 * puede (o ya empezó a) inscribir módulos. Adapta el mensaje al estado real de
 * la página: si un bloque aún no existe (p. ej. la sede todavía no se asigna),
 * su tarjeta simplemente se centra en lugar de iluminar un elemento.
 */
export const TOUR_INSCRIPCION_ACTIVA: TourStep[] = [
  {
    id: 'insc-act-intro',
    icon: 'CalendarCheck',
    title: 'Tu inscripción está abierta',
    body: 'Estás justo en la ventana para inscribir tus exámenes de esta convocatoria. Te muestro cada parte de la pantalla y cómo dejar tu inscripción lista.',
  },
  {
    id: 'insc-act-abierta',
    anchor: 'insc-abierta',
    placement: 'bottom',
    icon: 'CalendarClock',
    title: 'Paso 1 · Esta es la convocatoria abierta',
    body: 'Esta es la etapa cuya inscripción y pago están abiertos ahora. Aquí ves las fechas exactas y los días que faltan para el cierre. Solo dentro de esta ventana puedes inscribir y pagar.',
  },
  {
    id: 'insc-act-modulos',
    anchor: 'insc-modulos',
    placement: 'top',
    icon: 'BookOpenCheck',
    title: 'Módulos disponibles para inscribir',
    body: 'Estos son los módulos que puedes presentar en esta convocatoria. Elige los que quieras (hasta 4) y confírmalos: con eso quedas pre-inscrito y se genera tu ficha de pago.',
  },
  {
    id: 'insc-act-examenes',
    anchor: 'insc-examenes',
    placement: 'top',
    icon: 'ClipboardCheck',
    title: 'Tus exámenes inscritos',
    body: 'Aquí aparecen los exámenes que ya inscribiste, agrupados por convocatoria. Cada uno muestra su estado (pre-inscrito o confirmado) y, más abajo, guardamos como historial los que ya presentaste.',
  },
  {
    id: 'insc-act-sede',
    anchor: 'insc-sede',
    placement: 'top',
    icon: 'MapPin',
    title: 'Tu sede de examen',
    body: 'Aquí verás la sede donde presentarás. Se asigna más adelante, cuando la coordinación la publique — si todavía no aparece, es normal: te avisaremos en cuanto se sepa.',
  },
  {
    id: 'insc-act-pasos',
    anchor: 'insc-pasos',
    placement: 'top',
    icon: 'ListChecks',
    title: 'Siguientes pasos · ¿Cómo termino?',
    body: 'Tu lugar se confirma solo cuando el pago se valida. Aquí tienes los pasos: descarga tu ficha, paga antes de la fecha límite, espera la confirmación y descarga tu pase para el día del examen.',
  },
  {
    id: 'insc-act-proximas',
    anchor: 'insc-proximas',
    placement: 'top',
    icon: 'CalendarRange',
    title: 'Próximas etapas',
    body: 'Además de la convocatoria abierta, aquí ves las etapas que vienen con sus fechas. Así puedes planear qué módulos presentar en cada una.',
  },
  {
    id: 'insc-act-fin',
    anchor: 'btn-seccion-tutorial',
    placement: 'left',
    icon: 'RefreshCw',
    title: '¡Listo, esa es tu Inscripción!',
    body: 'Elige módulos, genera tu ficha, paga y confirma. Puedes repetir este tutorial cuando quieras con este botón.',
  },
];

// ── Pagos ──────────────────────────────────────────────────────
export const TOUR_PAGOS: TourStep[] = [
  {
    id: 'pagos-intro',
    icon: 'CreditCard',
    title: 'Tus pagos de examen',
    body: 'Aquí ves qué exámenes están cubiertos, solicitas tu orden de pago ante la Tesorería del Estado y subes tu comprobante.',
  },
  {
    id: 'pagos-resumen',
    anchor: 'pagos-resumen',
    placement: 'bottom',
    icon: 'BarChart3',
    title: 'Tu resumen de pagos',
    body: 'De un vistazo: cuántos exámenes tienes inscritos, cuántos ya están pagados y el costo por examen ($145 MXN).',
  },
  {
    id: 'pagos-inscripciones',
    anchor: 'pagos-inscripciones',
    placement: 'top',
    icon: 'ListChecks',
    title: 'Estado por examen',
    body: 'Cada examen inscrito muestra su etiqueta: Pagado, En proceso o Sin pagar. Si tienes exámenes sin pagar, solicitas tu orden de pago con un clic.',
  },
  {
    id: 'pagos-como',
    icon: 'Landmark',
    title: 'Cómo se paga',
    body: 'El pago es ante la Tesorería del Estado: descargas tu orden con línea de captura, pagas en banco / tienda / en línea, y subes tu comprobante aquí. La coordinación lo confirma y quedas listo para tu examen.',
  },
  {
    id: 'pagos-fin',
    anchor: 'btn-seccion-tutorial',
    placement: 'left',
    icon: 'RefreshCw',
    title: '¡Eso es Pagos!',
    body: 'Aquí controlas todo tu pago de exámenes. Repite este tutorial con el botón cuando quieras.',
  },
];

// ── Calificaciones ─────────────────────────────────────────────
export const TOUR_CALIFICACIONES: TourStep[] = [
  {
    id: 'calif-intro',
    icon: 'GraduationCap',
    title: 'Tu historial académico',
    body: 'Aquí llevas la cuenta de tu avance: módulos aprobados de los 22, tu promedio y tus resultados de examen.',
  },
  {
    id: 'calif-contenido',
    anchor: 'calif-contenido',
    placement: 'top',
    icon: 'ClipboardList',
    title: 'Oficiales y de práctica',
    body: 'Verás tus resultados de exámenes oficiales y también tus evaluaciones de práctica. Un módulo se aprueba con 60 o más. Cuando tengas calificaciones, podrás descargar tu historial en PDF.',
  },
  {
    id: 'calif-fin',
    anchor: 'btn-seccion-tutorial',
    placement: 'left',
    icon: 'RefreshCw',
    title: '¡Eso es Calificaciones!',
    body: 'Aquí consultas todo tu desempeño. Repite este tutorial con el botón cuando quieras.',
  },
];

// ── Módulos ────────────────────────────────────────────────────
export const TOUR_MODULOS: TourStep[] = [
  {
    id: 'mod-intro',
    icon: 'BookOpen',
    title: 'Tus pruebas de práctica',
    body: 'Son prácticas tipo mini-examen (una por cada módulo del Plan 22) para que llegues preparado a tu examen oficial. No son tus calificaciones: solo sirven para practicar y medir tu avance.',
  },
  {
    id: 'mod-progreso',
    anchor: 'mod-progreso',
    placement: 'bottom',
    icon: 'BarChart3',
    title: 'Tu progreso global',
    body: 'Aquí ves tu avance general: módulos aprobados en el examen oficial, cuántos tienes con examen inscrito, pruebas hechas y tu promedio.',
  },
  {
    id: 'mod-bloqueo',
    anchor: 'mod-bloqueo',
    placement: 'bottom',
    icon: 'Lock',
    title: 'Cómo desbloquear tus pruebas',
    body: 'Las prácticas se activan cuando tienes un pago verificado de tus derechos de examen. En cuanto se confirme tu pago, las pruebas se desbloquean para estudiar y practicar.',
  },
  {
    id: 'mod-fin',
    anchor: 'btn-seccion-tutorial',
    placement: 'left',
    icon: 'RefreshCw',
    title: '¡Esas son tus pruebas!',
    body: 'Aquí estudias y practicas antes de cada examen. Repite este tutorial con el botón cuando quieras.',
  },
];

// ── Identificación ─────────────────────────────────────────────
export const TOUR_IDENTIFICACION: TourStep[] = [
  {
    id: 'id-intro',
    icon: 'BadgeCheck',
    title: 'Tu identificación',
    body: 'Aquí vivirán tu credencial digital y tu pase de examen con código QR: lo que muestras el día de la aplicación.',
  },
  {
    id: 'id-estado',
    anchor: 'id-estado',
    placement: 'bottom',
    icon: 'IdCard',
    title: 'Tu credencial digital',
    body: 'Tu credencial se emite cuando la administración valida tu registro y tu fotografía. Mientras tanto, aquí verás el estado. Una vez lista, podrás verla por ambos lados y descargarla.',
  },
  {
    id: 'id-qr',
    icon: 'QrCode',
    title: 'Tu pase con código QR',
    body: 'El día del examen, el personal escanea el QR de tu pase para validar tu asistencia. Es tu documento oficial de acceso, así que tenlo a la mano.',
  },
  {
    id: 'id-fin',
    anchor: 'btn-seccion-tutorial',
    placement: 'left',
    icon: 'RefreshCw',
    title: '¡Eso es tu Identificación!',
    body: 'Aquí tendrás tu credencial y tu pase de examen. Repite este tutorial con el botón cuando quieras.',
  },
];

// ── Mi aula · parrilla de clases ───────────────────────────────
export const TOUR_AULA_HOME: TourStep[] = [
  {
    id: 'aula-intro',
    icon: 'GraduationCap',
    title: 'Bienvenido a tu aula virtual',
    body: 'Si tu centro de asesoría la tiene activa, aquí tomas clase en línea. Todo se organiza por MÓDULO, igual que en una universidad. Te muestro cómo se usa.',
  },
  {
    id: 'aula-clases',
    anchor: 'aula-clases',
    placement: 'top',
    icon: 'School',
    title: 'Estas son tus clases',
    body: 'Cada tarjeta es un módulo que tu profesor abrió. El número de color te dice cuántas tareas, materiales y videos tiene, y si hay tareas pendientes.',
  },
  {
    id: 'aula-entrar',
    anchor: 'aula-clase',
    placement: 'bottom',
    icon: 'MousePointerClick',
    title: 'Entra a una clase',
    body: 'Toca una tarjeta para abrir el módulo. Adentro encontrarás su foro, sus tareas, materiales y videos, todos juntos.',
  },
  {
    id: 'aula-home-fin',
    anchor: 'btn-seccion-tutorial',
    placement: 'left',
    icon: 'RefreshCw',
    title: '¡Eso es tu aula!',
    body: 'Entra a cualquier clase para ver su contenido. ¿Necesitas repasar? Este botón repite el tutorial cuando quieras.',
  },
];

// ── Mi aula · dentro de una clase (módulo) ─────────────────────
export const TOUR_AULA_MODULO: TourStep[] = [
  {
    id: 'aulamod-intro',
    anchor: 'aula-portada',
    placement: 'bottom',
    icon: 'School',
    title: 'Dentro de tu clase',
    body: 'Arriba ves qué módulo estás cursando. Todo lo de aquí pertenece SOLO a esta materia.',
  },
  {
    id: 'aulamod-nav',
    anchor: 'aula-nav',
    placement: 'right',
    icon: 'PanelsTopLeft',
    title: 'Tu menú de la clase',
    body: 'Con este menú te mueves dentro del módulo: Foro para conversar, Tareas para entregar, Materiales para leer y Videos para ver. El número te avisa si hay algo nuevo.',
  },
  {
    id: 'aulamod-foro',
    anchor: 'aula-contenido',
    placement: 'top',
    icon: 'MessageCircle',
    title: 'El Foro es tu punto de entrada',
    body: 'Aquí tu profesor pone avisos y encuestas, y puedes preguntar tus dudas. En Tareas entregas tu trabajo (con foto o archivo) antes de la fecha límite.',
  },
  {
    id: 'aulamod-volver',
    anchor: 'aula-volver',
    placement: 'bottom',
    icon: 'ChevronLeft',
    title: 'Volver a tus clases',
    body: 'Con este enlace regresas a la lista de todas tus clases para entrar a otro módulo.',
  },
  {
    id: 'aulamod-fin',
    anchor: 'btn-seccion-tutorial',
    placement: 'left',
    icon: 'RefreshCw',
    title: '¡Ya sabes usar tu clase!',
    body: 'Revisa el foro, entrega tus tareas y repasa los materiales. Este botón repite el tutorial cuando quieras.',
  },
];

// ── Mensajes ───────────────────────────────────────────────────
export const TOUR_MENSAJES: TourStep[] = [
  {
    id: 'msg-intro',
    icon: 'MessageSquare',
    title: 'Chat con la Secretaría',
    body: 'Este es tu canal directo con la Secretaría para cualquier duda de tu trámite. Escribe tu mensaje y te responden en horario de oficina.',
  },
  {
    id: 'msg-privacidad',
    icon: 'ShieldCheck',
    title: 'Ten en cuenta',
    body: 'La conversación queda registrada por privacidad y seguimiento. Mantén un trato formal y adjunta lo que te pidan. ¡Estamos para ayudarte!',
  },
  {
    id: 'msg-fin',
    anchor: 'btn-seccion-tutorial',
    placement: 'left',
    icon: 'RefreshCw',
    title: '¡Eso es Mensajes!',
    body: 'Tu línea directa con la Secretaría. Repite este tutorial con el botón cuando quieras.',
  },
];
