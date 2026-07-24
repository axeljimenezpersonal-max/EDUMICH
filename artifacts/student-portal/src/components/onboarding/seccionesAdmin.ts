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
export const GATE_ADMIN = 'bienvenida_admin';

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
    body: 'Esta es la PUERTA DE ENTRADA al sistema: aquí caen las personas que pidieron una cuenta desde la página pública. Nadie entra sin pasar por aquí. Tú decides: al aprobar se crea su cuenta de alumno, se le asigna un gestor y se le envían sus credenciales; al rechazar, se le explica el motivo.',
    illustration: 'solicitudFlow',
  },
  {
    id: 'a-sol-stats',
    anchor: 'a-sol-stats',
    placement: 'bottom',
    icon: 'BarChart3',
    title: 'El pulso de tu bandeja',
    body: 'Cuántas están pendientes y —muy importante— cuántas llevan MÁS DE 7 DÍAS esperando. Esas son las que urgen: una persona lleva una semana sin poder entrar. También ves lo aprobado y rechazado del mes.',
  },
  {
    id: 'a-sol-tabs',
    anchor: 'a-sol-tabs',
    placement: 'bottom',
    icon: 'LayoutGrid',
    title: 'Pendientes, aprobadas y rechazadas',
    body: 'Tu trabajo vive en “Pendientes”. Las otras dos pestañas son tu historial: sirven para consultar a quién ya diste de alta o a quién rechazaste y por qué, sin perder el rastro de nada.',
  },
  {
    id: 'a-sol-filtros',
    anchor: 'a-sol-filtros',
    placement: 'bottom',
    icon: 'Filter',
    title: 'Filtra para priorizar',
    body: 'Busca por nombre, CURP o correo; acota por municipio; y usa “Urgencia” para atacar primero las más viejas. “Ordenar por” con “Más antigua primero” es la mejor forma de no dejar a nadie esperando.',
  },
  {
    id: 'a-sol-lista',
    anchor: 'a-sol-lista',
    placement: 'top',
    icon: 'ListChecks',
    title: 'Aprueba o rechaza',
    body: 'Cada renglón muestra al solicitante con su CURP, municipio y cuánto lleva esperando. Ábrelo para revisar sus datos: verifica que la CURP sea correcta y no esté duplicada. Al aprobar, eliges el gestor de su municipio; al rechazar, escribe un motivo claro (esa persona lo va a leer).',
  },
  {
    id: 'a-sol-fin',
    anchor: 'btn-seccion-tutorial',
    placement: 'left',
    icon: 'RefreshCw',
    title: '¡Esas son las solicitudes!',
    body: 'Mantener esta bandeja en cero es lo que permite que entren nuevos alumnos. Repite este tutorial con el botón cuando quieras.',
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
    body: 'Dos vistas: “Órdenes de pago” para gestionar cada ficha una por una, y “Contabilidad de exámenes” para el desglose del dinero (el reparto $101/$30 y los totales). ',
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

// ── Verificación ───────────────────────────────────────────────
export const TOUR_A_VERIFICACION: TourStep[] = [
  {
    id: 'a-ver-intro',
    icon: 'ScanLine',
    title: 'Verificación de identidad',
    body: 'Tu herramienta de ventanilla: escanea el QR de la credencial digital de un alumno y su expediente se abre al instante. El QR está firmado, así que además te confirma que la credencial es AUTÉNTICA y no una imagen falsificada.',
    illustration: 'verificaFlow',
  },
  {
    id: 'a-ver-modo',
    anchor: 'a-ver-modo',
    placement: 'bottom',
    icon: 'LayoutGrid',
    title: 'Qué puedes escanear hoy',
    body: 'Por ahora solo “Alumno (credencial)” está disponible. “Pase de examen” aparece marcado como Próximamente: esa función aún no entra, así que no la ofrezcas todavía en sede.',
  },
  {
    id: 'a-ver-escaner',
    anchor: 'a-ver-escaner',
    placement: 'top',
    icon: 'QrCode',
    title: 'Cómo se usa',
    body: 'Pide al alumno que muestre el QR de su credencial en su teléfono y apúntalo a la cámara. El navegador te pedirá permiso de cámara la primera vez. Al leerlo, se abre su expediente completo sin teclear nada.',
  },
  {
    id: 'a-ver-fin',
    anchor: 'btn-seccion-tutorial',
    placement: 'left',
    icon: 'RefreshCw',
    title: '¡Esa es Verificación!',
    body: 'Identificar a un alumno en segundos, con certeza. Repite este tutorial con el botón cuando quieras.',
  },
];

// ── Convocatorias ──────────────────────────────────────────────
export const TOUR_A_CONVOCATORIAS: TourStep[] = [
  {
    id: 'a-conv-intro',
    icon: 'Calendar',
    title: 'El calendario que manda',
    body: 'Aquí viven las etapas oficiales de la DGB. Es la sección más delicada del panel: estas fechas GOBIERNAN todo el sistema. Definen cuándo un alumno puede inscribirse, pagar y presentar examen. Si una fecha está mal aquí, se bloquea o se abre indebidamente para todo el estado.',
  },
  {
    id: 'a-conv-acciones',
    anchor: 'a-conv-acciones',
    placement: 'bottom',
    icon: 'Upload',
    title: 'Carga el año completo',
    body: 'Con “Precargar etapas” subes de golpe el calendario oficial del año, en vez de capturar etapa por etapa. El selector de año te deja consultar o preparar otros ciclos.',
  },
  {
    id: 'a-conv-stats',
    anchor: 'a-conv-stats',
    placement: 'bottom',
    icon: 'BarChart3',
    title: 'Cómo va el año',
    body: 'Cuántas etapas hay programadas, cuántas ya finalizaron, cuántas tienen inscripción abierta ahora mismo y cuántos alumnos se han inscrito en el año.',
  },
  {
    id: 'a-conv-activa',
    anchor: 'a-conv-activa',
    placement: 'bottom',
    icon: 'Flag',
    title: 'La etapa activa',
    body: 'Esta es la etapa que está corriendo. Es la que ven alumnos y gestores en sus paneles, y de la que depende su ventana de inscripción. Antes de cambiar sus fechas, considera que afecta a todos en ese momento.',
  },
  {
    id: 'a-conv-fin',
    anchor: 'btn-seccion-tutorial',
    placement: 'left',
    icon: 'RefreshCw',
    title: '¡Esas son las Convocatorias!',
    body: 'El reloj oficial del sistema. Repite este tutorial con el botón cuando quieras.',
  },
];

// ── Anuncios ───────────────────────────────────────────────────
export const TOUR_A_ANUNCIOS: TourStep[] = [
  {
    id: 'a-anun-intro',
    icon: 'Megaphone',
    title: 'Comunicados institucionales',
    body: 'Tu megáfono hacia alumnos y gestores. Lo que publicas aquí les aparece como banner en su inicio. Úsalo para recordatorios de fechas, avisos de cierre o cambios importantes — no para conversaciones (eso es el Chat).',
  },
  {
    id: 'a-anun-nuevo',
    anchor: 'a-anun-nuevo',
    placement: 'bottom',
    icon: 'Plus',
    title: 'Crea un anuncio',
    body: 'Redacta el título y el mensaje, elige su prioridad (informativo, importante o urgente — define el color del banner), y opcionalmente añade un botón con enlace. Puedes dirigirlo a todos o segmentarlo por municipio, etapa o gestor.',
  },
  {
    id: 'a-anun-stats',
    anchor: 'a-anun-stats',
    placement: 'bottom',
    icon: 'BarChart3',
    title: 'Qué está al aire',
    body: 'De un vistazo: cuántos anuncios están publicados, cuántos son urgentes, cuántos siguen en borrador y cuántos ya archivaste. Vigila los urgentes: son los más intrusivos para el usuario.',
  },
  {
    id: 'a-anun-tabs',
    anchor: 'a-anun-tabs',
    placement: 'bottom',
    icon: 'LayoutGrid',
    title: 'Publica, guarda o archiva',
    body: 'Un anuncio en borrador no lo ve nadie: puedes prepararlo con calma y publicarlo cuando toque. Cuando ya no aplique, archívalo para que deje de mostrarse sin borrar el registro.',
  },
  {
    id: 'a-anun-fin',
    anchor: 'btn-seccion-tutorial',
    placement: 'left',
    icon: 'RefreshCw',
    title: '¡Esos son los Anuncios!',
    body: 'Tu canal de comunicación masiva. Repite este tutorial con el botón cuando quieras.',
  },
];

// ── Chat en vivo ───────────────────────────────────────────────
export const TOUR_A_CHAT: TourStep[] = [
  {
    id: 'a-chat-intro',
    icon: 'MessageSquare',
    title: 'Chat en vivo',
    body: 'Atiendes en tiempo real a alumnos y gestores de todo el estado. Ojo con la regla: ellos SOLO pueden escribirle a la Secretaría; tú puedes responderle a cualquiera. Eres su único canal directo de soporte.',
  },
  {
    id: 'a-chat-bandeja',
    anchor: 'a-chat-bandeja',
    placement: 'right',
    icon: 'Inbox',
    title: 'Tu bandeja',
    body: 'Aquí caen todas las conversaciones. Busca por nombre o correo, y usa el filtro para separar Alumnos de Gestores. Las que tienen mensajes sin leer se marcan, para que no se te escape ninguna.',
  },
  {
    id: 'a-chat-legal',
    icon: 'Lock',
    title: 'Todo queda registrado',
    body: 'Cada conversación se registra y se almacena por motivos legales y de privacidad de datos, y puede ser consultada. Responde siempre en tono formal e institucional: lo que escribas es un documento oficial.',
    illustration: 'chatLegal',
  },
  {
    id: 'a-chat-fin',
    anchor: 'btn-seccion-tutorial',
    placement: 'left',
    icon: 'RefreshCw',
    title: '¡Ese es el Chat!',
    body: 'Tu ventanilla de atención en vivo. Repite este tutorial con el botón cuando quieras.',
  },
];

// ── Reportes ───────────────────────────────────────────────────
export const TOUR_A_REPORTES: TourStep[] = [
  {
    id: 'a-rep-intro',
    icon: 'BarChart2',
    title: 'Panel de indicadores',
    body: 'El pulso de la operación en vivo y el lugar donde generas los reportes que necesitas presentar. Si el Inicio te dice “qué hacer hoy”, Reportes te dice “cómo vamos” y te da la evidencia para sustentarlo.',
  },
  {
    id: 'a-rep-indicadores',
    anchor: 'a-rep-indicadores',
    placement: 'bottom',
    icon: 'Activity',
    title: 'Los indicadores en vivo',
    body: 'Las métricas de la operación actualizadas al momento: avance, comportamiento por municipio y tendencias. Úsalas para detectar dónde hace falta empujar antes de que se convierta en problema.',
  },
  {
    id: 'a-rep-catalogo',
    anchor: 'a-rep-catalogo',
    placement: 'bottom',
    icon: 'Download',
    title: 'Centro de descargas',
    body: 'Ocho reportes listos, cada uno con su propio enfoque: inscripciones, financiero, académico, expedientes, gestores, solicitudes y el ejecutivo (todos los KPI juntos). Toca el que necesites y abajo se abre su panel para configurarlo.',
  },
  {
    id: 'a-rep-relacion',
    anchor: 'a-rep-relacion',
    placement: 'bottom',
    icon: 'FileText',
    title: 'Ejemplo: Relación de exámenes',
    body: 'Esta es la que más vas a usar. Es el documento OFICIAL IEMSyS por centro y convocatoria: trae la lista de alumnos con sus módulos, CURP e importe, y se autollena con los datos del sistema — no capturas nada a mano. Tócala y abajo aparece su panel.',
  },
  {
    id: 'a-rep-config',
    anchor: 'a-rep-config',
    placement: 'bottom',
    icon: 'Filter',
    title: 'Elige convocatoria, centro y formato',
    body: 'Para la Relación necesitas las dos primeras: la CONVOCATORIA y el CENTRO de asesoría (gestor) del que la vas a emitir. El FORMATO decide qué te llevas: en PDF obtienes el documento oficial IEMSyS listo para entregar; en Excel, la tabla de datos para trabajarla.',
  },
  {
    id: 'a-rep-acciones',
    anchor: 'a-rep-acciones',
    placement: 'top',
    icon: 'BarChart3',
    title: 'Revisa antes de descargar',
    body: 'Con “Previa” ves los alumnos que quedarían incluidos ANTES de generar el documento: así confirmas que el centro y la convocatoria son los correctos y no te llevas sorpresas. Cuando cuadre, “Descargar” te lo baja al instante.',
  },
  {
    id: 'a-rep-programar',
    anchor: 'a-rep-programar',
    placement: 'top',
    icon: 'Clock',
    title: 'Historial y reportes programados',
    body: 'En “Historial” consultas lo que ya generaste. Y si un reporte lo entregas cada semana o cada mes, “Programar reporte” lo genera solo en automático, para que no dependa de que te acuerdes.',
  },
  {
    id: 'a-rep-fin',
    anchor: 'btn-seccion-tutorial',
    placement: 'left',
    icon: 'RefreshCw',
    title: '¡Esos son los Reportes!',
    body: 'Tus números, siempre listos para rendir cuentas. Repite este tutorial con el botón cuando quieras.',
  },
];

// ── Configuración ──────────────────────────────────────────────
export const TOUR_A_CONFIGURACION: TourStep[] = [
  {
    id: 'a-cfg-intro',
    icon: 'Settings',
    title: 'Configuración del sistema',
    body: 'Los ajustes de fondo de la plataforma. Aquí se toca poco, pero lo que se toca afecta a todos: por eso conviene saber qué es cada cosa antes de mover nada.',
  },
  {
    id: 'a-cfg-nav',
    anchor: 'a-cfg-nav',
    placement: 'right',
    icon: 'PanelsTopLeft',
    title: 'Sus secciones',
    body: 'El menú de la izquierda agrupa los ajustes por tema. “Mi cuenta” es tu perfil y tu contraseña —eso lo puedes cambiar con confianza—; el resto son parámetros institucionales que conviene revisar con calma.',
  },
  {
    id: 'a-cfg-fin',
    anchor: 'btn-seccion-tutorial',
    placement: 'left',
    icon: 'RefreshCw',
    title: '¡Esa es la Configuración!',
    body: 'El cuarto de máquinas del sistema. Repite este tutorial con el botón cuando quieras.',
  },
];
