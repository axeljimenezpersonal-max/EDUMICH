/**
 * Paleta ÚNICA del calendario — se usa en todas las vistas donde aparecen
 * fechas (cuadrícula del calendario, banners de inicio y leyendas), para que
 * "inscripción" y "examen" signifiquen siempre lo mismo en cualquier pantalla.
 *
 * Criterio de la marca: la INSCRIPCIÓN va en guinda suave (el color de Módula
 * 22, en su tono claro — presente pero sin gritar) y el EXAMEN en morado, que
 * es el acento reservado a la fecha de aplicación.
 */

export const CAL_INSCRIPCION = {
  /** Relleno del día en la cuadrícula. */
  fondo: '#f7e6ec',
  /** Borde de chips y muestras de la leyenda. */
  borde: '#e3b5c4',
  /** Texto e iconos sobre el fondo claro. */
  texto: '#6b1530',
  /** Fondo de tarjetas/banners grandes. */
  fondoSuave: '#fdf7f9',
} as const;

export const CAL_EXAMEN = {
  /** Relleno del día en la cuadrícula (lleva texto blanco encima). */
  fondo: '#6d28d9',
  borde: '#ddd6fe',
  texto: '#6d28d9',
  fondoSuave: '#f5f3ff',
  /** Fondo del contador de días en los banners. */
  fondoContador: '#ede9fe',
} as const;
