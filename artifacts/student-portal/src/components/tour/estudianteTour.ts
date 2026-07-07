import type { TourStep } from './Tour';

/** Guía de bienvenida para el estudiante nuevo. Los targets viven en EstudianteLayout. */
export const ESTUDIANTE_TOUR: TourStep[] = [
  {
    title: '¡Bienvenido a tu portal!',
    body: 'Este es tu espacio en Preparatoria Abierta Michoacán. En 30 segundos te muestro cómo avanzar en tu proceso, paso a paso.',
  },
  {
    target: "[data-tour='nav-expediente']",
    placement: 'right',
    title: '1. Completa tu expediente',
    body: 'Aquí subes tus documentos: CURP, acta de nacimiento, INE, comprobante de domicilio, certificado de secundaria y tu foto. Es lo primero que revisa la administración.',
  },
  {
    target: "[data-tour='nav-convocatoria']",
    placement: 'right',
    title: '2. Inscríbete a la convocatoria',
    body: 'Elige los módulos que quieres presentar en la etapa activa. Tu cédula de inscripción la elabora la administración y la puedes consultar en tu expediente.',
  },
  {
    target: "[data-tour='nav-pagos']",
    placement: 'right',
    title: '3. Paga tus exámenes',
    body: 'Aquí ves qué exámenes ya están pagados y cuáles faltan, solicitas tu orden de pago ante la Tesorería y subes tu comprobante. Solo lo pagado se puede calificar.',
  },
  {
    target: "[data-tour='nav-calificaciones']",
    placement: 'right',
    title: '4. Consulta tus calificaciones',
    body: 'Tu historial académico completo: módulos aprobados, promedio y descarga en PDF.',
  },
  {
    target: "[data-tour='nav-modulos']",
    placement: 'right',
    title: '5. Estudia y practica',
    body: 'Consulta el material de cada módulo y practica con las evaluaciones antes de tu examen oficial.',
  },
  {
    target: "[data-tour='nav-identificacion']",
    placement: 'right',
    title: '6. Tu identificación y pase',
    body: 'Aquí está tu credencial digital y tu pase de examen con código QR para el día de la aplicación.',
  },
  {
    target: "[data-tour='nav-mensajes']",
    placement: 'right',
    title: '7. ¿Dudas? Escríbenos',
    body: 'Chatea directo con la Secretaría cuando necesites ayuda. Respondemos en horario de oficina.',
  },
  {
    target: "[data-tour='btn-tutorial']",
    placement: 'auto',
    title: '¡Listo, ya sabes lo básico!',
    body: 'Puedes repetir este tutorial cuando quieras con este botón. ¡Mucho éxito en tu preparatoria!',
  },
];
