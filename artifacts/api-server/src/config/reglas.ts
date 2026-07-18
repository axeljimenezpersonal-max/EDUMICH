/**
 * Reglas de negocio configurables de la plataforma Modula.
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

/**
 * Días antes de la fecha del examen en que vence la orden de pago (línea de
 * captura). Regla: el pago siempre vence una semana antes del examen.
 * Se usa para autollenar/forzar el vencimiento al emitir la ficha.
 */
export const DIAS_ANTES_EXAMEN_VENCE_PAGO = 7;

/**
 * Documentos OBLIGATORIOS del expediente. El expediente se considera completo
 * cuando estos cinco están **aprobados** (no basta con subirlos).
 *
 * Estaba copiado en `routes/estudiante.ts` y `routes/gestor.ts`; al aparecer un
 * tercer consumidor (los avisos al gestor) se centralizó aquí para que agregar o
 * quitar un documento no deje una copia desactualizada decidiendo quién puede
 * inscribirse.
 */
export const DOCUMENTOS_OBLIGATORIOS = [
  'curp',
  'acta_nacimiento',
  'ine',
  'comprobante_domicilio',
  'certificado_secundaria',
] as const;
