/**
 * Recorridos PROFUNDOS por página del portal del estudiante (bloque por bloque).
 * Se muestran con <SectionTour/> dentro de cada página. Los anclajes viven en el
 * JSX de cada página como `data-tour="..."`.
 */

import type { TourStep } from './steps';

/**
 * Clave del recorrido de bienvenida del estudiante (para no encimarse, R5).
 * Debe coincidir con `claveBienvenida('estudiante')` de useOnboarding.
 */
export const GATE_ESTUDIANTE = 'bienvenida_estudiante';

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
    title: 'Inscripción abierta',
    body: 'Cuando hay una etapa abierta para inscribirte a tu examen, aquí aparece con sus fechas exactas y los días que faltan para el cierre. Tócalo para ir directo a inscribirte. El pago se realiza después, en las fechas que indica la Secretaría. Si no ves este aviso, es que no hay una ventana abierta por ahora.',
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
    body: 'Esta es la etapa cuya inscripción está abierta ahora. Aquí ves las fechas exactas y los días que faltan para el cierre. Solo dentro de esta ventana puedes inscribirte; el pago se realiza después, en las fechas que indica la Secretaría.',
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
    // Solo aparece si la convocatoria abrió VARIAS sedes: con una sola no hay
    // nada que elegir y el motor omite este paso (no existe el anclaje).
    id: 'insc-act-sede-elegir',
    anchor: 'insc-sede-elegir',
    placement: 'top',
    icon: 'MapPin',
    title: 'Elige dónde presentas',
    body: 'Esta convocatoria abrió varias sedes. Escoge en cuál quieres presentar: será la misma para todos los módulos que inscribas ahora. Te marcamos la de tu municipio, pero puedes elegir otra si te queda mejor.',
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
    body: 'Aquí queda la sede que elegiste al inscribirte, con su dirección y el botón para verla en el mapa. Es donde presentas todos los módulos de esta convocatoria. Si aún no te inscribes, dirá que se asignará al hacerlo.',
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
    title: 'Cómo se paga · paso a paso',
    body: 'El pago es ante la Tesorería del Estado. El camino es siempre el mismo: solicitas tu orden, la Tesorería la emite con tu línea de captura, la pagas en banco / tienda / en línea y subes tu comprobante. La coordinación lo confirma y quedas listo.',
    illustration: 'pagoFlow',
  },
  {
    id: 'pagos-orden',
    anchor: 'pagos-ordenes',
    placement: 'top',
    icon: 'Receipt',
    title: 'Dónde está tu orden de pago',
    body: 'Aquí abajo vive cada orden de pago. Con “Solicitar orden” la pides; cuando la Tesorería la emite, aparece tu línea de captura para copiar y pagar; y ya pagada, subes tu comprobante en este mismo bloque. Cada orden muestra en qué paso va (solicitada, emitida, pagada, confirmada).',
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
    body: 'Aquí llevas la cuenta de tu avance en el Plan Modular: cuántos módulos de los 22 llevas aprobados, tu promedio y todos tus resultados. Hay dos cosas distintas que conviene no confundir — te las explico una por una.',
  },
  {
    id: 'calif-calificaciones',
    anchor: 'calif-tab-calif',
    placement: 'bottom',
    icon: 'Award',
    title: '1) Calificaciones · tus exámenes oficiales',
    body: 'Son los resultados de los exámenes OFICIALES que presentas y que la administración captura. Cada módulo muestra tu calificación (sobre 10), tus aciertos y su estado: por presentar, aprobado o no aprobado. Un módulo se aprueba con 6 (60 de 100) o más — solo estos cuentan para tu certificado.',
  },
  {
    id: 'calif-tiempo',
    anchor: 'calif-tab-calif',
    placement: 'bottom',
    icon: 'Clock',
    title: '¿Cuándo aparece mi calificación?',
    body: 'No es inmediata: tras presentar tu examen oficial, la calificación suele tardar de 3 a 5 días hábiles en registrarse. Mientras tanto verás el módulo como “examen por presentar” o sin nota; en cuanto la administración la sube, aparece aquí sola.',
  },
  {
    id: 'calif-pruebas',
    anchor: 'calif-tab-pruebas',
    placement: 'bottom',
    icon: 'ClipboardCheck',
    title: '2) Pruebas · tu práctica (no cuentan)',
    body: 'Distinto a lo anterior: las Pruebas son evaluaciones de PRÁCTICA que tú resuelves en la plataforma para prepararte y medir cómo vas. Son un ensayo — no son oficiales y no aprueban módulos. Te sirven para llegar más seguro al examen real.',
  },
  {
    id: 'calif-descargar',
    anchor: 'calif-descargar',
    placement: 'bottom',
    icon: 'Download',
    title: 'Descarga tu historial',
    body: 'Con este botón se descarga tu historial académico oficial en PDF, con tus módulos y calificaciones. Útil para tus trámites o para guardarlo. Se descarga al instante en tu dispositivo.',
  },
  {
    id: 'calif-fin',
    anchor: 'btn-seccion-tutorial',
    placement: 'left',
    icon: 'RefreshCw',
    title: '¡Eso es Calificaciones!',
    body: 'Ya sabes distinguir tus calificaciones oficiales de tus pruebas de práctica y cómo descargar tu historial. Repite este tutorial con el botón cuando quieras.',
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
    icon: 'LockOpen',
    title: 'La prueba viene incluida al pagar',
    body: 'Buena noticia: en esta versión digital, la prueba de práctica queda INCLUIDA al pagar tu examen — no se compra aparte. En cuanto tu pago se confirma, la prueba de ese módulo se desbloquea sola para que practiques cuantas veces quieras antes del examen oficial.',
    illustration: 'pruebaFlow',
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
    title: 'Tu credencial digital',
    body: 'Esta es tu identificación oficial como estudiante de Preparatoria Abierta (IEMSyS). Aquí la consultas, la volteas para ver todos tus datos, la verificas y la descargas cuando la necesites.',
  },
  {
    id: 'id-estado',
    anchor: 'id-estado',
    placement: 'bottom',
    icon: 'IdCard',
    title: 'Cómo se emite',
    body: 'Tu credencial se emite cuando la administración valida tu registro y tu fotografía. Si aún no está lista, aquí verás su estado; una vez emitida, aparece la tarjeta completa lista para usar.',
  },
  {
    id: 'id-credencial',
    anchor: 'id-credencial',
    placement: 'top',
    icon: 'CreditCard',
    title: 'Tus dos caras',
    body: 'El FRENTE lleva tu nombre, tu matrícula oficial DGB, tu folio de credencial y una foto. El REVERSO reúne tus datos: CURP, centro de servicios, Plan 22, vigencia y las convocatorias en las que estás inscrito, junto al código QR.',
  },
  {
    id: 'id-voltear',
    anchor: 'id-voltear',
    placement: 'top',
    icon: 'RotateCcw',
    title: 'Voltéala con un toque',
    body: 'Toca la tarjeta —o usa este botón— y gira: frente ↔ reverso. El QR del reverso es verificable: cualquier institución puede confirmar en el portal oficial que tu credencial es auténtica y está vigente.',
  },
  {
    id: 'id-acciones',
    anchor: 'id-acciones',
    placement: 'top',
    icon: 'Download',
    title: 'Descárgala o renuévala',
    body: 'Con “Descargar PDF” guardas tu credencial en tu dispositivo para imprimirla o compartirla. Si se venció o necesitas reponerla, “Renovar / reponer” pide una nueva a la administración.',
  },
  {
    id: 'id-fin',
    anchor: 'btn-seccion-tutorial',
    placement: 'left',
    icon: 'RefreshCw',
    title: '¡Esa es tu credencial!',
    body: 'Tu identificación oficial, siempre a la mano y verificable. Repite este tutorial con el botón cuando quieras.',
  },
];

// ── Mi aula · parrilla de clases ───────────────────────────────
export const TOUR_AULA_HOME: TourStep[] = [
  {
    id: 'aula-intro',
    icon: 'GraduationCap',
    title: 'Bienvenido a tu aula virtual',
    body: 'Si tu centro de asesoría la tiene activa, aquí tomas clase en línea sin costo extra. Todo se organiza por MÓDULO, como en la universidad: cada materia tiene su propio espacio con foro, tareas, materiales y videos. Es aparte de tus exámenes: es un apoyo para estudiar mejor.',
  },
  {
    id: 'aula-clases',
    anchor: 'aula-clases',
    placement: 'top',
    icon: 'School',
    title: 'Estas son tus clases',
    body: 'Cada tarjeta es un módulo que tu profesor abrió. De un vistazo te dice cuántas tareas, materiales y videos tiene, y si tienes algo PENDIENTE por entregar (el aviso de color). Así sabes a qué clase entrar primero.',
    illustration: 'aulaCard',
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
    body: 'Dentro del módulo te mueves con este menú de cuatro secciones. Cada una es para algo distinto —mira cómo cambia en la animación— y el numerito te avisa cuando hay algo nuevo o pendiente.',
    illustration: 'aulaNav',
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
    icon: 'Lock',
    title: 'Queda registrada y almacenada',
    body: 'Importante: toda esta conversación se registra y se almacena por motivos legales y de privacidad de datos, y puede ser consultada por el personal. Por eso mantén un trato formal y respetuoso, como en cualquier trámite oficial.',
    illustration: 'chatLegal',
  },
  {
    id: 'msg-ejemplo',
    icon: 'MessagesSquare',
    title: 'Así se ve una conversación',
    body: 'Escribes tu duda, la Secretaría la lee y te responde en horario de oficina (lunes a viernes, 9:00 a 17:00). Sé claro y concreto; si te piden un documento, puedes adjuntarlo en el chat.',
    illustration: 'chatDemo',
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
