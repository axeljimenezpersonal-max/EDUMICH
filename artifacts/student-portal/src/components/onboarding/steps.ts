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
const GESTOR: TourStep[] = [
  {
    id: 'ges-welcome',
    icon: 'Sparkles',
    title: '¡Hola, {nombre}!',
    body: 'Esta es tu plataforma para gestionar a los alumnos de Preparatoria Abierta en {municipio}. Te doy un recorrido corto para que empieces con el pie derecho.',
  },
  {
    id: 'ges-kpis',
    anchor: 'kpis',
    placement: 'bottom',
    icon: 'LayoutDashboard',
    title: 'Tu resumen de un vistazo',
    body: 'Aquí ves tus números clave: cuántos alumnos tienes, cuántos ya están inscritos y cuántos documentos están pendientes de revisar.',
  },
  {
    id: 'ges-alumnos',
    anchor: 'nav-alumnos',
    placement: 'right',
    icon: 'Users',
    title: 'Aquí están tus alumnos',
    body: 'Da clic en "Mis alumnos" para ver la lista completa. Desde ahí revisas el estado, los documentos y el avance de cada uno.',
  },
  {
    id: 'ges-nuevo',
    anchor: 'nav-nuevo',
    placement: 'right',
    icon: 'FilePlus2',
    title: 'Dar de alta a alguien nuevo',
    body: '¿Llega un alumno nuevo? Usa "Nuevo alumno", captura sus datos básicos y queda vinculado a la convocatoria activa con su cuenta lista.',
  },
  {
    id: 'ges-pagos',
    anchor: 'nav-pagos',
    placement: 'right',
    icon: 'CreditCard',
    title: 'Pagos de exámenes',
    body: 'Consulta el estado de pago de cada alumno. También puedes hacer un pago grupal ante Tesorería con un solo comprobante para varios exámenes.',
  },
  {
    id: 'ges-calificaciones',
    anchor: 'nav-calificaciones nav-mas',
    placement: 'right',
    icon: 'GraduationCap',
    title: 'Calificaciones',
    body: 'Sigue los resultados de tus alumnos: exámenes oficiales y evaluaciones de práctica, para saber quién ya está listo para presentar.',
  },
  {
    id: 'ges-mensajes',
    anchor: 'nav-faq nav-mas',
    placement: 'right',
    icon: 'HelpCircle',
    title: 'Preguntas frecuentes',
    body: 'Las dudas comunes del trámite ya resueltas: altas, pagos, documentos. Búscalas o léelas al instante.',
  },
  {
    id: 'ges-help',
    anchor: 'help-button',
    placement: 'bottom',
    icon: 'CheckCircle2',
    title: '¡Listo, {nombre}!',
    body: 'Ya conoces lo esencial de tu panel. Si quieres repasar, el botón de ayuda (?) está siempre aquí arriba. ¡Mucho éxito con tus alumnos!',
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
    id: 'adm-vista',
    anchor: 'a-ini-kpis',
    placement: 'top',
    icon: 'BarChart3',
    title: 'Vista general del sistema',
    body: 'Los números del estado de un vistazo: alumnos activos, gestores, expedientes completos y egresados. Un pulso rápido del programa.',
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
    title: 'Alumnos · aquí están todos',
    body: 'Tu sección más usada: TODOS los alumnos del estado. Entra a cualquiera para ver su expediente, documentos, pagos y avance, y aprobar o rechazar lo que suben.',
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
    id: 'adm-reportes',
    anchor: 'nav-reportes nav-mas',
    placement: 'right',
    icon: 'BarChart2',
    title: 'Reportes',
    body: 'Descargas reportes del programa para rendir cuentas y tomar decisiones.',
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
