/**
 * Estados de una etapa de convocatoria — UNA sola paleta para todo el panel.
 *
 * No son colores sueltos: son una ESCALA que cuenta en qué punto del ciclo va
 * la etapa, y se lee de un vistazo sin tener que leer la palabra.
 *
 *   crema  → verde  → ámbar  → morado sólido → morado suave
 *   aún no   inscribe  cerrada   aplicando       ya pasó
 *
 * El morado es el acento del EXAMEN en todo el producto (ver
 * `coloresCalendario.ts`), así que los dos estados que ya viven alrededor del
 * examen —"en examen" y "finalizada"— son los dos morados: el sólido para el
 * que está ocurriendo ahora, el suave para el que quedó atrás. Antes
 * "finalizada" era gris y no se distinguía del vacío de la pantalla.
 */
import { CAL_EXAMEN } from './coloresCalendario';

export type EstadoEtapaVisual = {
  /** Texto del chip (español, con acentos: es texto de pantalla). */
  label: string;
  /** Punto de la línea de tiempo. */
  punto: string;
  /** Fondo del chip. */
  fondo: string;
  /** Texto del chip. */
  texto: string;
  /** Está ocurriendo AHORA: el chip lleva un punto que late. */
  latido?: boolean;
};

export const ESTADOS_ETAPA: Record<string, EstadoEtapaVisual> = {
  programada:          { label: 'Programada',          punto: '#ddd0c5', fondo: '#f7f2ed',            texto: '#6b635e' },
  inscripcion_abierta: { label: 'Inscripción abierta', punto: '#059669', fondo: '#d1fae5',            texto: '#065f46', latido: true },
  inscripcion_cerrada: { label: 'Inscripción cerrada', punto: '#d97706', fondo: '#fef3c7',            texto: '#92400e' },
  en_examen:           { label: 'En examen',           punto: CAL_EXAMEN.fondo, fondo: CAL_EXAMEN.fondo, texto: '#ffffff', latido: true },
  finalizada:          { label: 'Finalizada',          punto: '#7c3aed', fondo: CAL_EXAMEN.fondoContador, texto: '#5b21b6' },
};

/** Config de un estado, con respaldo seguro si llega uno desconocido. */
export function estadoEtapa(estado: string | null | undefined): EstadoEtapaVisual {
  return (estado ? ESTADOS_ETAPA[estado] : undefined) ?? ESTADOS_ETAPA.programada!;
}
