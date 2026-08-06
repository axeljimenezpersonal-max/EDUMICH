/**
 * Lo que se le dice a la gente sobre el día del examen — en UN solo lugar.
 *
 * Estas frases estaban sueltas dentro del pase de examen. Traerlas aquí no es
 * orden por el orden: son **indicaciones de la Secretaría**, y en el momento en
 * que se validen o cambien hay que poder corregirlas en un archivo y no ir a
 * buscarlas por las pantallas. Que aparezcan distintas en el pase y en la lista
 * de exámenes es peor que no ponerlas.
 *
 * ⚠️ NO SE INVENTAN REGLAS AQUÍ. Lo de abajo es exactamente lo que la
 * plataforma ya venía diciendo, ni una línea más. Falta que alguien del IEMSyS
 * confirme por escrito la lista completa —duración, qué está permitido, qué
 * pasa si alguien llega tarde—, y hasta entonces callar es más honesto que
 * suponer: una regla inventada que se lee como oficial manda a alguien a su
 * examen con la información equivocada.
 */
import { parseDbDate } from './fechas';

/** Qué llevar. Ver la advertencia de arriba antes de agregarle nada. */
export const QUE_LLEVAR: { texto: string; detalle?: string }[] = [
  { texto: 'Tu pase de examen', detalle: 'Impreso o en la pantalla del teléfono' },
  { texto: 'Identificación oficial', detalle: 'INE o tu comprobante de CURP' },
  { texto: 'Pluma de tinta azul o negra' },
  { texto: 'Llegar 15 minutos antes de tu hora' },
];

/**
 * Días de hoy a la fecha del examen, en días de calendario.
 *
 * Con `parseDbDate`, que lleva las fechas puras al mediodía: parsear
 * "2026-08-08" con `new Date()` la deja en medianoche UTC, o sea las 18:00 del
 * día ANTERIOR en Michoacán, y el conteo sale un día corrido. En una pantalla
 * que dice "faltan 3 días" ese error no es cosmético.
 */
export function diasHastaExamen(fechaExamen: string | null | undefined): number | null {
  if (!fechaExamen) return null;
  const hoy = new Date();
  hoy.setHours(12, 0, 0, 0);
  const ex = parseDbDate(fechaExamen);
  ex.setHours(12, 0, 0, 0);
  return Math.round((ex.getTime() - hoy.getTime()) / 86_400_000);
}

/** "Faltan 3 días", "Es mañana", "Es hoy", "Fue hace 2 días". */
export function cuandoEs(dias: number | null): string {
  if (dias === null) return 'Fecha por confirmar';
  if (dias === 0) return 'Es hoy';
  if (dias === 1) return 'Es mañana';
  if (dias === -1) return 'Fue ayer';
  if (dias > 1) return `Faltan ${dias} días`;
  return `Fue hace ${Math.abs(dias)} días`;
}

export type FaseExamen =
  | 'sin_pago'      // pre-inscrito: el pase todavía no existe
  | 'listo'         // pagado, falta que llegue el día
  | 'hoy'           // es hoy
  | 'validado'      // ya le validaron el pase en la sede
  | 'esperando'     // ya pasó el examen, aún sin calificación
  | 'calificado';

/**
 * En qué punto va este examen.
 *
 * Se decide con el estado guardado Y con la fecha, no con uno solo: un examen
 * pagado cuya fecha ya pasó no es "listo para presentar", es "esperando
 * calificación", y decirle lo primero al alumno lo deja esperando un día que ya
 * ocurrió.
 */
export function faseDe(ex: {
  pagado: boolean;
  estado: string;
  calificacion: number | null;
  fechaExamen: string | null;
}): FaseExamen {
  if (ex.calificacion !== null && ex.calificacion !== undefined) return 'calificado';
  const dias = diasHastaExamen(ex.fechaExamen);
  if (dias !== null && dias < 0) return 'esperando';
  if (ex.estado === 'pase_validado') return 'validado';
  if (!ex.pagado) return 'sin_pago';
  if (dias === 0) return 'hoy';
  return 'listo';
}
