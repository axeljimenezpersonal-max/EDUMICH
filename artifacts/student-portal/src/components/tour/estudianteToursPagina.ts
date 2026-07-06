import type { TourStep } from './Tour';

/** Tutoriales por página del portal del estudiante. */

export const TOUR_EXPEDIENTE: TourStep[] = [
  {
    target: "[data-tour='exp-titulo']",
    placement: 'bottom',
    title: 'Tu expediente',
    body: 'Aquí reúnes todo lo que necesitas para inscribirte. Arriba verás tu progreso: cuántos documentos llevas aprobados.',
  },
  {
    target: "[data-tour='exp-matricula']",
    placement: 'bottom',
    title: 'Tu matrícula oficial',
    body: 'Cuando la SEP-DGB valida tu registro, aquí aparece tu matrícula oficial y puedes descargar tu ficha de registro. Mientras tanto verás tu folio de pre-registro.',
  },
  {
    target: "[data-tour='exp-datos']",
    placement: 'bottom',
    title: 'Tus datos personales',
    body: 'Estos son tus datos. Puedes revisarlos y editarlos aquí en cualquier momento con el botón de editar.',
  },
  {
    target: "[data-tour='exp-obligatorios']",
    placement: 'top',
    title: 'Documentos obligatorios',
    body: 'Son los que SÍ o SÍ necesitas: CURP, acta de nacimiento, INE, comprobante de domicilio y certificado de secundaria. Toca cada uno para subir tu archivo (PDF o foto). La administración los revisa y te avisa si aprueba o rechaza.',
  },
  {
    target: "[data-tour='exp-credencial']",
    placement: 'top',
    title: 'Documentos para tu credencial',
    body: 'Aquí subes tu fotografía, que se usará en tu credencial y tu cédula. Cuídala: debe ser clara y de frente.',
  },
  {
    title: '¡Listo!',
    body: 'Sube todos tus obligatorios para poder avanzar a la inscripción. Repite este tutorial cuando quieras con el botón “Tutorial”.',
  },
];

export const TOUR_CEDULA: TourStep[] = [
  {
    target: "[data-tour='ced-titulo']",
    placement: 'bottom',
    title: 'Tu cédula de inscripción',
    body: 'Es tu documento oficial de inscripción. Se llena solo con tus datos y tu foto aprobada del expediente.',
  },
  {
    target: "[data-tour='ced-editar']",
    placement: 'auto',
    title: 'Completa y firma',
    body: 'Revisa que todo esté correcto, ajusta lo que falte y firma con tu dedo o mouse. Tu firma se guarda para reutilizarla.',
  },
  {
    target: "[data-tour='ced-preview']",
    placement: 'left',
    title: 'Vista previa y descarga',
    body: 'Aquí ves cómo queda tu cédula en PDF. Cuando esté lista, la descargas o imprimes.',
  },
];

export const TOUR_INSCRIPCION: TourStep[] = [
  {
    target: "[data-tour='insc-titulo']",
    placement: 'bottom',
    title: 'Tu inscripción a exámenes',
    body: 'Aquí eliges los módulos que quieres presentar en la convocatoria activa y realizas tu pago.',
  },
  {
    title: 'Cómo funciona',
    body: 'Primero necesitas tu expediente completo. Luego seleccionas tus módulos, generas tu pago y, una vez pagado, podrás presentar el examen. Recuerda: solo lo pagado se puede calificar.',
  },
];

export const TOUR_MODULOS: TourStep[] = [
  {
    target: "[data-tour='mod-titulo']",
    placement: 'bottom',
    title: 'Tu Plan Modular',
    body: 'Es el mapa de tu preparatoria: todos los módulos que debes acreditar para egresar y tu avance en cada uno.',
  },
  {
    target: "[data-tour='mod-lista']",
    placement: 'top',
    title: 'Estudia y practica',
    body: 'Entra a cada módulo para ver el material de estudio y resolver las evaluaciones de práctica antes de tu examen oficial.',
  },
];

export const TOUR_PAGOS: TourStep[] = [
  {
    target: "[data-tour='pagos-titulo']",
    placement: 'bottom',
    title: 'Tus pagos de examen',
    body: 'Aquí ves de un vistazo qué exámenes ya están pagados, cuáles van en proceso y cuáles faltan por cubrir.',
  },
  {
    target: "[data-tour='pagos-inscripciones']",
    placement: 'top',
    title: 'Estado por examen',
    body: 'Cada módulo inscrito muestra su etiqueta: Pagado, En proceso o Sin pagar. Si tienes exámenes sin pagar, solicita tu orden de pago con un clic.',
  },
  {
    title: 'Cómo se paga',
    body: 'El pago es ante la Tesorería del Estado: descargas tu orden con línea de captura, pagas en banco / tienda / en línea, y subes tu comprobante aquí. La coordinación lo confirma y quedas listo para tu examen.',
  },
];

export const TOUR_CALIFICACIONES: TourStep[] = [
  {
    target: "[data-tour='calif-titulo']",
    placement: 'bottom',
    title: 'Tu historial académico',
    body: 'Consulta tus módulos aprobados por nivel, tu avance hacia los 21 y tu promedio.',
  },
  {
    target: "[data-tour='calif-contenido']",
    placement: 'top',
    title: 'Oficiales y de práctica',
    body: 'Verás tus resultados de exámenes oficiales y también tus evaluaciones de práctica. Puedes descargar tu historial académico en PDF cuando lo necesites.',
  },
];

export const TOUR_IDENTIFICACION: TourStep[] = [
  {
    target: "[data-tour='id-titulo']",
    placement: 'bottom',
    title: 'Tu identificación',
    body: 'Aquí está tu credencial digital y tu pase de examen con código QR. Muéstralos el día de tu aplicación; el personal los escanea para validar tu asistencia.',
  },
];

export const TOUR_MENSAJES: TourStep[] = [
  {
    title: 'Chat con la Secretaría',
    body: 'Este es tu canal directo con la Secretaría para cualquier duda de tu trámite. Escribe tu mensaje y te responden en horario de oficina.',
  },
  {
    title: 'Ten en cuenta',
    body: 'La conversación queda registrada por privacidad y seguimiento. Mantén un trato formal y adjunta lo que te pidan. ¡Estamos para ayudarte!',
  },
];
