/**
 * Fuente única de verdad de los recorridos de bienvenida por rol.
 *
 * Cada paso puede iluminar un elemento de la interfaz vía `anchor`, que se
 * resuelve como `[data-tour="<anchor>"]`. Sin `anchor`, la tarjeta se centra.
 * Los textos admiten los tokens {nombre} y {municipio}, que se sustituyen con
 * los datos del usuario en tiempo de ejecución.
 */

import type { Rol } from '../../lib/api';

export type Placement = 'top' | 'bottom' | 'left' | 'right' | 'auto';

export interface TourStep {
  id: string;
  anchor?: string;
  placement?: Placement;
  icon?: string;   // nombre de icono de lucide-react
  title: string;
  body: string;
  illustration?: string;  // clave de una ilustración animada (ver TourIllustrations)
}

// ── Estudiante ─────────────────────────────────────────────────
const ESTUDIANTE: TourStep[] = [
  {
    id: 'est-welcome',
    icon: 'GraduationCap',
    title: '¡Hola {nombre}! Este es tu portal',
    body: 'Aquí llevas todo tu proceso de Preparatoria Abierta en un solo lugar. Tu camino son 4 pasos: 1) arma tu expediente, 2) inscríbete, 3) paga y 4) presenta tu examen. Te lo muestro en 30 segundos.',
  },
  {
    id: 'est-inicio',
    anchor: 'nav-inicio',
    placement: 'right',
    icon: 'LayoutDashboard',
    title: 'Inicio · tu punto de partida',
    body: 'Cada vez que entres, aquí ves en qué punto vas y qué te toca hacer. Si te pierdes, vuelve a Inicio.',
  },
  {
    id: 'est-expediente',
    anchor: 'nav-expediente',
    placement: 'right',
    icon: 'FolderOpen',
    title: 'Paso 1 · Tu expediente',
    body: 'Sube tus 5 documentos (CURP, acta, INE, comprobante de domicilio y certificado de secundaria) y tu foto. La administración los revisa; es lo primero que necesitas para avanzar.',
  },
  {
    id: 'est-convocatoria',
    anchor: 'nav-convocatoria',
    placement: 'right',
    icon: 'Calendar',
    title: 'Paso 2 · Inscríbete',
    body: 'Cuando abra la convocatoria, eliges los módulos que vas a presentar y se te asigna sede y fecha. Aquí mismo consultas qué exámenes llevas y tu historial.',
  },
  {
    id: 'est-pagos',
    anchor: 'nav-pagos',
    placement: 'right',
    icon: 'CreditCard',
    title: 'Paso 3 · Paga tu examen',
    body: 'Solicitas tu orden de pago ante la Tesorería, pagas en banco o en línea, y subes tu comprobante. Ojo: solo lo pagado se puede calificar.',
  },
  {
    id: 'est-calificaciones',
    anchor: 'nav-calificaciones nav-mas',
    placement: 'right',
    icon: 'GraduationCap',
    title: 'Paso 4 · Tus resultados',
    body: 'Aquí ves tus calificaciones, cuántos de los 22 módulos ya aprobaste (con 60 o más) y tu promedio. Descargable en PDF.',
  },
  {
    id: 'est-modulos',
    anchor: 'nav-modulos nav-mas',
    placement: 'right',
    icon: 'BookOpen',
    title: 'Practica antes del examen',
    body: 'En "Pruebas" repasas cada módulo con evaluaciones de práctica para llegar preparado. No cuentan como calificación: son solo para ti.',
  },
  {
    id: 'est-aula',
    anchor: 'nav-aula nav-mas',
    placement: 'right',
    icon: 'School',
    title: 'Mi aula · clases en línea',
    body: 'Si tu centro de asesoría la tiene activa, aquí está tu aula virtual: clases por módulo con foro, tareas, materiales y videos. Si aparece con candado, tu gestor aún no la ha activado.',
  },
  {
    id: 'est-identificacion',
    anchor: 'nav-identificacion nav-mas',
    placement: 'right',
    icon: 'BadgeCheck',
    title: 'Herramientas · ID y pase',
    body: 'En "ID" están tu credencial digital y tu pase de examen con código QR: lo que muestras el día de la aplicación.',
  },
  {
    id: 'est-mensajes',
    anchor: 'nav-faq nav-mas',
    placement: 'right',
    icon: 'HelpCircle',
    title: '¿Dudas? Preguntas frecuentes',
    body: 'En "Preguntas frecuentes" están resueltas las dudas más comunes del trámite: inscripción, pago, documentos y examen. Búscalas o léelas al instante.',
  },
  {
    id: 'est-help',
    anchor: 'help-button',
    placement: 'bottom',
    icon: 'CheckCircle2',
    title: '¡Listo, ya conoces tu portal!',
    body: 'Empieza por tu expediente y sigue el camino. ¿Quieres repetir este recorrido? El botón de ayuda (?) aquí arriba lo reinicia cuando quieras. ¡Mucho éxito, {nombre}!',
  },
];

// ── Gestor ─────────────────────────────────────────────────────
// Recorrido en ORDEN CRONOLÓGICO: sigue el camino real del gestor —registrar,
// documentar, inscribir, pagar, calificar— para que el menú se entienda como
// una secuencia, no como una lista suelta.
const GESTOR: TourStep[] = [
  {
    id: 'ges-welcome',
    icon: 'Sparkles',
    title: '¡Hola, {nombre}!',
    body: 'Este es tu panel para acompañar a tus alumnos de Preparatoria Abierta en {municipio}. Te lo muestro EN EL ORDEN en que lo vas a usar, paso a paso, para que no te pierdas.',
  },
  {
    id: 'ges-inicio',
    anchor: 'nav-inicio',
    placement: 'right',
    icon: 'LayoutDashboard',
    title: 'Inicio · tu punto de partida',
    body: 'Cada día empiezas aquí. En esta pantalla ves cómo van tus alumnos y qué te toca atender. Si te pierdes, regresa a Inicio.',
  },
  {
    id: 'ges-kpis',
    anchor: 'g-ini-kpis',
    placement: 'bottom',
    icon: 'BarChart3',
    title: 'Tu resumen de un vistazo',
    body: 'Tus números clave: cuántos alumnos tienes, cuántos ya están inscritos y cuántos documentos están pendientes de revisar.',
  },
  {
    id: 'ges-nuevo',
    anchor: 'nav-nuevo',
    placement: 'right',
    icon: 'FilePlus2',
    title: 'Paso 1 · Da de alta a tu alumno',
    body: 'Todo empieza aquí: con "Nuevo alumno" registras a quien llega, capturas sus datos y le queda su cuenta lista, ligada a la convocatoria activa.',
  },
  {
    id: 'ges-alumnos',
    anchor: 'nav-alumnos',
    placement: 'right',
    icon: 'Users',
    title: 'Paso 2 · Sus documentos y avance',
    body: 'En "Mis alumnos" tienes a todos. Entra a cualquiera para subir sus 5 documentos, ver cómo va su expediente y darle seguimiento hasta que quede completo.',
  },
  {
    id: 'ges-inscripcion',
    anchor: 'nav-inscripcion',
    placement: 'right',
    icon: 'ClipboardList',
    title: 'Paso 3 · Inscríbelos',
    body: 'Cuando abre la ventana de la convocatoria, aquí eliges los módulos que va a presentar cada alumno. Ojo: solo se puede dentro de esas fechas.',
  },
  {
    id: 'ges-pagos',
    anchor: 'nav-pagos',
    placement: 'right',
    icon: 'CreditCard',
    title: 'Paso 4 · Paga sus exámenes',
    body: 'Solicitas la ficha de pago de cada examen. Puedes pagar uno por uno o hacer un pago grupal (varios alumnos en una sola ficha) y subir el comprobante.',
  },
  {
    id: 'ges-calificaciones',
    anchor: 'nav-calificaciones',
    placement: 'right',
    icon: 'GraduationCap',
    title: 'Paso 5 · Sus resultados',
    body: 'Aquí sigues las calificaciones de tus alumnos: qué presentaron, qué aprobaron y quién ya va avanzando hacia su certificado.',
  },
  {
    id: 'ges-aula',
    anchor: 'nav-aula',
    placement: 'right',
    icon: 'School',
    title: 'Mi aula · un extra',
    body: 'Si tu centro tiene el aula virtual activa, aquí están las clases, materiales y tareas para tus alumnos. Si aparece con candado, aún no está habilitada.',
  },
  {
    id: 'ges-faq',
    anchor: 'nav-faq',
    placement: 'right',
    icon: 'HelpCircle',
    title: '¿Dudas? Preguntas frecuentes',
    body: 'Las dudas comunes del trámite ya resueltas: altas, documentos, inscripción y pagos. Búscalas o léelas al instante.',
  },
  {
    id: 'ges-fin',
    icon: 'CheckCircle2',
    title: '¡Listo, {nombre}!',
    body: 'Ese es tu panel, en orden: registrar → documentar → inscribir → pagar → calificar. Puedes repetir este recorrido con el botón de ayuda (?) cuando quieras. ¡Mucho éxito con tus alumnos!',
  },
];

// ── Administrador ──────────────────────────────────────────────
const ADMIN: TourStep[] = [
  {
    id: 'adm-welcome',
    icon: 'Sparkles',
    title: '¡Hola, {nombre}!',
    body: 'Bienvenido(a) a tu panel de administración de Preparatoria Abierta. Este es tu Inicio: tu punto de partida cada día. Te doy un recorrido rápido por todo el panel.',
  },
  {
    id: 'adm-convocatoria',
    anchor: 'a-ini-convocatoria',
    placement: 'bottom',
    icon: 'Flag',
    title: 'La convocatoria activa',
    body: 'Aquí ves la etapa abierta: cuándo abrió, cuándo cierra la solicitud y el pago, y las fechas de examen. Es lo primero que conviene revisar.',
  },
  {
    id: 'adm-dia',
    anchor: 'a-ini-tareas',
    placement: 'top',
    icon: 'ListChecks',
    title: 'Tu día de hoy',
    body: 'Tus pendientes del día, lo que te toca resolver. Da clic en cualquier tarjeta para ir directo a esa tarea.',
  },
  {
    id: 'adm-alumnos',
    anchor: 'nav-alumnos nav-mas',
    placement: 'right',
    icon: 'Users',
    title: 'Alumnos · los activos de la convocatoria',
    body: 'Tu sección más usada: los alumnos ACTIVOS de la convocatoria en curso (no es el padrón histórico completo del estado). Entra a cualquiera para ver su expediente, documentos, pagos y avance, y aprobar o rechazar lo que suben.',
  },
  {
    id: 'adm-gestores',
    anchor: 'nav-gestores nav-mas',
    placement: 'right',
    icon: 'UserCheck',
    title: 'Gestores',
    body: 'Los centros de asesoría de cada municipio y cuántos alumnos tienen a su cargo.',
  },
  {
    id: 'adm-solicitudes',
    anchor: 'nav-solicitudes nav-mas',
    placement: 'right',
    icon: 'Inbox',
    title: 'Solicitudes',
    body: 'Las solicitudes de cuenta que esperan tu aprobación. Es tu bandeja de entrada del trámite.',
  },
  {
    id: 'adm-pagos',
    anchor: 'nav-pagos nav-mas',
    placement: 'right',
    icon: 'CreditCard',
    title: 'Pagos · revisa cada pago',
    body: 'Aquí revisas CADA pago: verificas los comprobantes contra las líneas de captura de Tesorería. Solo lo confirmado habilita el examen del alumno.',
  },
  {
    id: 'adm-calificaciones',
    anchor: 'nav-calificaciones nav-mas',
    placement: 'right',
    icon: 'GraduationCap',
    title: 'Calificaciones',
    body: 'Cargas y consultas los resultados: al cerrar cada etapa subes las calificaciones por Excel y el sistema cruza por folio y marca aprobados (60 o más).',
  },
  {
    id: 'adm-verificacion',
    anchor: 'nav-verificacion nav-mas',
    placement: 'right',
    icon: 'ScanLine',
    title: 'Verificación de pases',
    body: 'El día del examen, escaneas el código QR del pase de cada alumno para validar su asistencia en el momento.',
  },
  {
    id: 'adm-convocatorias',
    anchor: 'nav-convocatorias nav-mas',
    placement: 'right',
    icon: 'Calendar',
    title: 'Convocatorias',
    body: 'Creas y administras las convocatorias y sus etapas: fechas, sedes habilitadas y módulos que se ofrecen.',
  },
  {
    id: 'adm-anuncios',
    anchor: 'nav-anuncios nav-mas',
    placement: 'right',
    icon: 'Megaphone',
    title: 'Anuncios',
    body: 'Publicas avisos para gestores y alumnos: fechas importantes, recordatorios y comunicados.',
  },
  {
    id: 'adm-faq',
    anchor: 'nav-faq nav-mas',
    placement: 'right',
    icon: 'HelpCircle',
    title: 'Preguntas frecuentes',
    body: 'Administras las preguntas frecuentes que ven gestores y alumnos, y marcas cuáles son las principales.',
  },
  {
    id: 'adm-padron',
    anchor: 'nav-padron nav-mas',
    placement: 'right',
    icon: 'Database',
    title: 'Padrón histórico',
    body: 'El padrón del Estado: consultas y buscas en el historial de matrículas, y lo exportas cuando lo necesites.',
  },
  {
    id: 'adm-configuracion',
    anchor: 'nav-configuracion nav-mas',
    placement: 'right',
    icon: 'Settings',
    title: 'Configuración',
    body: 'Ajustes del sistema y de tu cuenta: tu perfil, tu contraseña y las opciones del programa.',
  },
  {
    id: 'adm-help',
    anchor: 'help-button',
    placement: 'bottom',
    icon: 'CheckCircle2',
    title: '¡Listo, {nombre}!',
    body: 'Ese es tu panel completo. El botón de ayuda (?) reinicia esta guía cuando quieras. Cada sección tiene además su propio detalle. ¡Mucho éxito!',
  },
];

// ── Dirección de Programa (solo lectura) ───────────────────────
const DIRECCION: TourStep[] = [
  {
    id: 'dir-welcome',
    icon: 'Sparkles',
    title: '¡Bienvenido, {nombre}!',
    body: 'Este es tu tablero de dirección: una vista estratégica y de solo lectura del programa en todo el estado. Aquí no se opera el trámite, se lee su pulso.',
  },
  {
    id: 'dir-panorama',
    anchor: 'nav-panorama',
    placement: 'right',
    icon: 'LayoutDashboard',
    title: 'Panorama general',
    body: 'Los indicadores clave del programa de un vistazo: alcance, inscripción y avance global del estado.',
  },
  {
    id: 'dir-academico',
    anchor: 'nav-academico',
    placement: 'right',
    icon: 'GraduationCap',
    title: 'Desempeño académico',
    body: 'Aprobación, avance modular y resultados por etapa. Para entender cómo va el aprendizaje, no solo la inscripción.',
  },
  {
    id: 'dir-salud',
    anchor: 'nav-salud',
    placement: 'right',
    icon: 'HeartPulse',
    title: 'Salud del sistema',
    body: 'El estado operativo de la plataforma y los cuellos de botella del trámite, para anticipar problemas.',
  },
  {
    id: 'dir-proyecciones',
    anchor: 'nav-proyecciones',
    placement: 'right',
    icon: 'TrendingUp',
    title: 'Proyecciones',
    body: 'Tendencias y estimaciones para planear las próximas convocatorias con datos, no con corazonadas.',
  },
  {
    id: 'dir-reportes',
    anchor: 'nav-reportes',
    placement: 'right',
    icon: 'BarChart2',
    title: 'Reportes',
    body: 'Descarga la información consolidada para tus informes institucionales.',
  },
  {
    id: 'dir-help',
    anchor: 'help-button',
    placement: 'bottom',
    icon: 'CheckCircle2',
    title: '¡Listo!',
    body: 'Ese es tu tablero. El botón de ayuda (?) repite esta guía cuando lo necesites.',
  },
];

export const STEPS_BY_ROL: Record<Rol, TourStep[]> = {
  estudiante: ESTUDIANTE,
  gestor: GESTOR,
  admin: ADMIN,
  direccion: DIRECCION,
};
