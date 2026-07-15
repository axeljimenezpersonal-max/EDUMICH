/**
 * Recorridos PROFUNDOS por página del panel de ADMINISTRACIÓN (IEMSyS).
 *
 * La administración es el rol PRINCIPAL: es quien mueve las piezas para que los
 * demás roles funcionen (aprueba solicitudes, emite pagos, captura calificaciones,
 * abre convocatorias…). Por eso estos tutoriales son los más específicos: deben
 * explicarse SOLOS, en tono formal, ordenado, moderno e intuitivo, con animaciones
 * que ayuden a comprender cada tema.
 */

import type { TourStep } from './steps';

/** El recorrido de bienvenida del admin marca esta clave al terminar. */
export const GATE_ADMIN = 'edumich_tour_v1_admin';

// ── Inicio ─────────────────────────────────────────────────────
export const TOUR_A_INICIO: TourStep[] = [
  {
    id: 'a-ini-intro',
    icon: 'LayoutDashboard',
    title: 'Tu centro de control',
    body: 'Desde aquí supervisas todo el sistema estatal de Preparatoria Abierta. La administración es quien mueve las piezas para que los demás roles funcionen: sin tus aprobaciones, pagos y capturas, el proceso del alumno no avanza. Este es el recorrido del trámite que tú habilitas.',
    illustration: 'cicloAdmin',
  },
  {
    id: 'a-ini-convocatoria',
    anchor: 'a-ini-convocatoria',
    placement: 'bottom',
    icon: 'Flag',
    title: 'La convocatoria activa',
    body: 'Arriba ves la convocatoria en curso y sus fechas clave. Todo el trabajo del periodo (inscripciones, pagos y exámenes) gira alrededor de ella; si no hay ninguna activa, aquí lo sabrás de inmediato.',
  },
  {
    id: 'a-ini-kpis',
    anchor: 'a-ini-kpis',
    placement: 'bottom',
    icon: 'BarChart3',
    title: 'Vista general del sistema',
    body: 'Los indicadores del estado en tiempo real: alumnos activos, gestores y municipios cubiertos, expedientes completos y egresados. Te dan el pulso general antes de entrar al detalle.',
  },
  {
    id: 'a-ini-tareas',
    anchor: 'a-ini-tareas',
    placement: 'top',
    icon: 'Zap',
    title: 'Tu día de hoy',
    body: 'Lo que depende de ti HOY, en cuatro tarjetas: documentos por revisar, pagos por emitir, pagos por verificar y solicitudes de cuenta. Cada tarjeta te lleva directo a resolverlo. Empieza tu jornada por aquí.',
  },
  {
    id: 'a-ini-actividad',
    anchor: 'a-ini-actividad',
    placement: 'top',
    icon: 'Activity',
    title: 'Avance y actividad reciente',
    body: 'La gráfica de inscripciones por etapa y la bitácora de lo último que ha pasado en el sistema. Útil para ver tendencias y quién hizo qué, sin salir del inicio.',
  },
  {
    id: 'a-ini-fin',
    anchor: 'btn-seccion-tutorial',
    placement: 'left',
    icon: 'RefreshCw',
    title: '¡Ese es tu centro de control!',
    body: 'Tu punto de partida cada día. Repite este tutorial con el botón cuando quieras.',
  },
];

// ── Alumnos ────────────────────────────────────────────────────
export const TOUR_A_ALUMNOS: TourStep[] = [
  {
    id: 'a-alu-intro',
    icon: 'Users',
    title: 'Todos los alumnos del estado',
    body: 'El padrón completo de alumnos de Preparatoria Abierta en Michoacán. Desde aquí revisas expedientes, validas documentos y das seguimiento a cualquier alumno, sin importar su municipio o gestor.',
  },
  {
    id: 'a-alu-stats',
    anchor: 'a-alu-stats',
    placement: 'bottom',
    icon: 'BarChart3',
    title: 'Resumen del padrón',
    body: 'De un vistazo: total de alumnos, cuántos tienen expediente completo, cuántos están pendientes y cuántos ya egresaron. El termómetro general antes de filtrar.',
  },
  {
    id: 'a-alu-filtros',
    anchor: 'a-alu-filtros',
    placement: 'bottom',
    icon: 'Filter',
    title: 'Busca y filtra con precisión',
    body: 'Encuentra a cualquier alumno por nombre o CURP, o combina filtros por municipio, estado del expediente, gestor y etapa. Cuando entras desde una tarjeta del inicio, el filtro ya viene aplicado.',
  },
  {
    id: 'a-alu-tabla',
    anchor: 'a-alu-tabla',
    placement: 'top',
    icon: 'Table',
    title: 'La lista y su detalle',
    body: 'Cada fila resume al alumno y su avance. Ábrela para entrar a su expediente, donde validas documentos, revisas su inscripción y su pago. Aquí tú tienes la última palabra sobre su expediente.',
  },
  {
    id: 'a-alu-fin',
    anchor: 'btn-seccion-tutorial',
    placement: 'left',
    icon: 'RefreshCw',
    title: '¡Esos son tus alumnos!',
    body: 'El padrón estatal, siempre a tu alcance. Repite este tutorial con el botón cuando quieras.',
  },
];

// ── Gestores ───────────────────────────────────────────────────
export const TOUR_A_GESTORES: TourStep[] = [
  {
    id: 'a-ges-intro',
    icon: 'UserCheck',
    title: 'Tus gestores municipales',
    body: 'Los gestores son tus aliados en cada municipio: registran y acompañan a los alumnos en su zona. Aquí los administras y ves su desempeño (cuántos alumnos llevan y su tasa de éxito).',
  },
  {
    id: 'a-ges-nuevo',
    anchor: 'a-ges-nuevo',
    placement: 'bottom',
    icon: 'UserPlus',
    title: 'Alta de un gestor',
    body: 'Con “Nuevo gestor” das de alta a un gestor y lo asignas a un municipio; el sistema le crea su cuenta y le envía sus credenciales por correo. (Esta acción es exclusiva de la titular.)',
  },
  {
    id: 'a-ges-stats',
    anchor: 'a-ges-stats',
    placement: 'bottom',
    icon: 'BarChart3',
    title: 'Su desempeño',
    body: 'El resumen de la red de gestores: cuántos están activos y su tasa de éxito promedio. Te ayuda a detectar dónde apoyar y qué municipios están mejor cubiertos.',
  },
  {
    id: 'a-ges-fin',
    anchor: 'btn-seccion-tutorial',
    placement: 'left',
    icon: 'RefreshCw',
    title: '¡Esos son tus gestores!',
    body: 'Tu red municipal. Repite este tutorial con el botón cuando quieras.',
  },
];

// ── Solicitudes ────────────────────────────────────────────────
export const TOUR_A_SOLICITUDES: TourStep[] = [
  {
    id: 'a-sol-intro',
    icon: 'Inbox',
    title: 'Solicitudes de cuenta',
    body: 'Aquí llegan las personas que pidieron una cuenta desde la página pública. Tú decides: al aprobarlas se crea su cuenta de alumno y se les asigna un gestor; al rechazarlas, se les explica por qué. Es la puerta de entrada al sistema.',
    illustration: 'solicitudFlow',
  },
  {
    id: 'a-sol-tabla',
    anchor: 'a-sol-tabla',
    placement: 'top',
    icon: 'ListChecks',
    title: 'Revisa cada solicitud',
    body: 'Cada renglón muestra al solicitante, su CURP, municipio y fecha. En “Acciones” la apruebas (se crea su cuenta y recibe sus accesos) o la rechazas indicando el motivo. Verifica que la CURP y los datos sean correctos antes de aprobar.',
  },
  {
    id: 'a-sol-fin',
    anchor: 'btn-seccion-tutorial',
    placement: 'left',
    icon: 'RefreshCw',
    title: '¡Esas son las solicitudes!',
    body: 'La bandeja de entrada del sistema. Repite este tutorial con el botón cuando quieras.',
  },
];

// ── Pagos (órdenes ante Tesorería) ─────────────────────────────
export const TOUR_A_PAGOS: TourStep[] = [
  {
    id: 'a-pag-intro',
    icon: 'Landmark',
    title: 'Pagos ante la Tesorería',
    body: 'Administras las órdenes de pago de examen de todo el estado. El circuito es claro: se solicita la ficha, TÚ emites su línea de captura ante la Tesorería, el alumno o gestor paga y tú verificas el comprobante contra el banco.',
    illustration: 'pagoFlow',
  },
  {
    id: 'a-pag-tabs',
    anchor: 'a-pag-tabs',
    placement: 'bottom',
    icon: 'LayoutGrid',
    title: 'Órdenes y contabilidad',
    body: 'Dos vistas: “Órdenes de pago” para gestionar cada ficha una por una, y “Contabilidad de exámenes” para el desglose del dinero (el reparto $115/$30 y los totales). ',
  },
  {
    id: 'a-pag-filtros',
    anchor: 'a-pag-filtros',
    placement: 'bottom',
    icon: 'Filter',
    title: 'Encuentra la orden',
    body: 'Busca por alumno, folio, matrícula o gestor, y filtra por gestor, etapa o estado. Los chips de estado te separan lo que está por emitir, por verificar o ya pagado.',
  },
  {
    id: 'a-pag-tabla',
    anchor: 'a-pag-tabla',
    placement: 'top',
    icon: 'ReceiptText',
    title: 'Emite y verifica',
    body: 'Cada orden muestra su estado. Ábrela para emitir su línea de captura cuando esté solicitada, o para verificar el comprobante contra el banco cuando ya se pagó. Al confirmar, el alumno queda listo para su examen.',
  },
  {
    id: 'a-pag-fin',
    anchor: 'btn-seccion-tutorial',
    placement: 'left',
    icon: 'RefreshCw',
    title: '¡Eso es Pagos!',
    body: 'El circuito del dinero, bajo control. Repite este tutorial con el botón cuando quieras.',
  },
];

// ── Calificaciones ─────────────────────────────────────────────
export const TOUR_A_CALIFICACIONES: TourStep[] = [
  {
    id: 'a-cal-intro',
    icon: 'GraduationCap',
    title: 'Calificaciones oficiales',
    body: 'Tú capturas los resultados oficiales que después ven alumnos y gestores. La fuente es la Relación oficial de la SEP: aquí la subes y el sistema la reparte a cada expediente.',
  },
  {
    id: 'a-cal-cargar',
    anchor: 'a-cal-cargar',
    placement: 'bottom',
    icon: 'Upload',
    title: 'Sube la Relación de la SEP',
    body: 'Carga el PDF oficial tal como llega. El sistema lo lee y te muestra una PREVIA con semáforos (qué folios reconoció y qué revisar) antes de aplicar. Si prefieres, “Captura manual” te deja registrar calificaciones a mano.',
  },
  {
    id: 'a-cal-tabla',
    anchor: 'a-cal-tabla',
    placement: 'top',
    icon: 'Table',
    title: 'El histórico completo',
    body: 'La tabla general reúne todas las calificaciones aplicadas. Búscala por alumno, matrícula o CURP para consultar o auditar cualquier resultado. Recuerda: un módulo se aprueba con 6 (60 de 100).',
  },
  {
    id: 'a-cal-fin',
    anchor: 'btn-seccion-tutorial',
    placement: 'left',
    icon: 'RefreshCw',
    title: '¡Eso es Calificaciones!',
    body: 'La fuente oficial de resultados del estado. Repite este tutorial con el botón cuando quieras.',
  },
];
