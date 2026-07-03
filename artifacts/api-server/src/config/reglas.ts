/**
 * Reglas de negocio configurables de la plataforma EDUMICH.
 *
 * Centralizadas aquí para que un cambio de política se haga en un solo lugar.
 */

/**
 * Vigencia de la credencial digital (identificación de "alumno activo") contada
 * desde su fecha de emisión (`licenciaEmitidaEn`).
 *
 * Cambiado de 12 → 6 meses (2026-07) para evitar el abuso de inscribir un solo
 * examen y conservar la ventaja de alumno vigente durante todo un año.
 *
 * La vigencia se calcula al vuelo, por lo que este cambio aplica también a las
 * credenciales ya emitidas.
 */
export const VIGENCIA_CREDENCIAL_MESES = 6;
