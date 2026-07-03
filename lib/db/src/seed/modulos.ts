/**
 * Catálogo oficial de los 21 módulos del Plan Modular de Preparatoria Abierta.
 * Fuente: temarios oficiales del Instituto de Educación Media Superior y Superior
 * del Estado de Michoacán (IEMSyS).
 *
 * Niveles:
 *   1 — Comunicación y bases            (módulos 1-6)
 *   2 — Pensamiento matemático y textos (módulos 7-8)
 *   3 — Métodos y contextos             (módulos 9-13)
 *   4 — Especialidades                  (módulos 14-21)
 */

export interface ModuloSeed {
  numero: number;
  nombre: string;
  nivel: number;
}

export const MODULOS_PREPA_ABIERTA: ModuloSeed[] = [
  // Nivel 1 — Comunicación y bases
  { numero: 1, nombre: 'De la información al conocimiento', nivel: 1 },
  { numero: 2, nombre: 'El lenguaje en la relación del hombre con el mundo', nivel: 1 },
  { numero: 3, nombre: 'Representaciones simbólicas y algoritmos', nivel: 1 },
  { numero: 4, nombre: 'Ser social y sociedad', nivel: 1 },
  { numero: 5, nombre: 'Mi mundo en otra lengua', nivel: 1 },
  { numero: 6, nombre: 'Tecnología de información y comunicación', nivel: 1 },
  // Nivel 2 — Pensamiento matemático y textos
  { numero: 7, nombre: 'Textos y visiones del mundo', nivel: 2 },
  { numero: 8, nombre: 'Matemáticas y representaciones del sistema natural', nivel: 2 },
  // Nivel 3 — Métodos y contextos
  { numero: 9, nombre: 'Argumentación', nivel: 3 },
  { numero: 10, nombre: 'Universo natural', nivel: 3 },
  { numero: 11, nombre: 'Optimización en sistemas naturales y sociales', nivel: 3 },
  { numero: 12, nombre: 'Dinámica en la naturaleza: el movimiento', nivel: 3 },
  { numero: 13, nombre: 'Sociedad mexicana contemporánea', nivel: 3 },
  // Nivel 4 — Especialidades
  { numero: 14, nombre: 'Análisis y cambio social', nivel: 4 },
  { numero: 15, nombre: 'Hacia un desarrollo sustentable', nivel: 4 },
  { numero: 16, nombre: 'Variación en procesos sociales', nivel: 4 },
  { numero: 17, nombre: 'Conflicto y violencia social', nivel: 4 },
  { numero: 18, nombre: 'Comprensión y comunicación', nivel: 4 },
  { numero: 19, nombre: 'Ciencias experimentales', nivel: 4 },
  { numero: 20, nombre: 'Cultura digital', nivel: 4 },
  { numero: 21, nombre: 'Procesos educativos en el siglo XXI', nivel: 4 },
];
