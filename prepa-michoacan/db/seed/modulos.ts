/**
 * Catálogo de los 21 módulos oficiales del Plan Modular de Prepa Abierta.
 * Fuente: temarios oficiales del Instituto de Educación Media Superior y Superior
 * del Estado de Michoacán (IEMSyS).
 */

export interface ModuloSeed {
  numero: number;
  nombre: string;
  nivel: number; // 1 = Comunicación, 2 = Pensamiento matemático, 3 = Métodos y contextos, 4 = Especialidades
}

export const MODULOS_PREPA_ABIERTA: ModuloSeed[] = [
  { numero: 1, nombre: 'De la información al conocimiento', nivel: 1 },
  { numero: 2, nombre: 'El lenguaje en la relación del hombre con el mundo', nivel: 1 },
  { numero: 3, nombre: 'Representaciones simbólicas y algoritmos', nivel: 2 },
  { numero: 4, nombre: 'Ser social y sociedad', nivel: 1 },
  { numero: 5, nombre: 'Mi mundo en otra lengua', nivel: 1 },
  { numero: 6, nombre: 'Tecnología de información y comunicación', nivel: 1 },
  { numero: 7, nombre: 'Textos y visiones del mundo', nivel: 2 },
  { numero: 8, nombre: 'Matemáticas y representaciones del sistema natural', nivel: 2 },
  { numero: 9, nombre: 'Universo natural', nivel: 3 },
  { numero: 10, nombre: 'Sociedad mexicana contemporánea', nivel: 3 },
  { numero: 11, nombre: 'Transformaciones en el mundo contemporáneo', nivel: 3 },
  { numero: 12, nombre: 'Mi vida en otra lengua', nivel: 3 },
  { numero: 13, nombre: 'Argumentación', nivel: 3 },
  { numero: 14, nombre: 'Variación de procesos sociales', nivel: 4 },
  { numero: 15, nombre: 'Cálculo en fenómenos naturales y procesos sociales', nivel: 4 },
  { numero: 16, nombre: 'Hacia un desarrollo sustentable', nivel: 4 },
  { numero: 17, nombre: 'Evolución y sus repercusiones sociales', nivel: 4 },
  { numero: 18, nombre: 'Estadística en fenómenos naturales y procesos sociales', nivel: 4 },
  { numero: 19, nombre: 'Dinámica en la naturaleza: el movimiento', nivel: 4 },
  { numero: 20, nombre: 'Optimización en sistemas naturales y sociales', nivel: 4 },
  { numero: 21, nombre: 'Impacto de la ciencia y la tecnología', nivel: 4 },
];
