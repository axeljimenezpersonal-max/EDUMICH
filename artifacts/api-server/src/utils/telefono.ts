/**
 * Normalización de teléfonos — formato único en toda la base: `+52 NNNNNNNNNN`.
 *
 * La interfaz ya fija el `+52` y solo admite 10 dígitos, pero esto es la red de
 * abajo: cualquier número que entre por la API (una carga masiva, un formulario
 * viejo, una integración) se guarda con la misma forma. Así las consultas, los
 * PDF y los avisos por WhatsApp/teléfono no tienen que adivinar el formato.
 */

/** Devuelve `+52 NNNNNNNNNN`, o null si no hay un número usable. */
export function normalizarTelefonoMx(valor: string | null | undefined): string | null {
  const digitos = (valor ?? '').replace(/\D/g, '');
  if (!digitos) return null;
  // Con lada de país al frente (52…) se descarta para quedarnos con los 10 locales.
  const local = digitos.length > 10 && digitos.startsWith('52') ? digitos.slice(2) : digitos;
  if (local.length !== 10) return null; // incompleto o con dígitos de más: no se inventa
  return `+52 ${local}`;
}

/**
 * Igual que la anterior, pero conserva el valor original cuando no se puede
 * normalizar (p. ej. un número extranjero capturado a propósito). Se usa donde
 * perder el dato sería peor que tenerlo con otro formato.
 */
export function normalizarTelefonoOMantener(valor: string | null | undefined): string | null {
  const norm = normalizarTelefonoMx(valor);
  if (norm) return norm;
  const limpio = (valor ?? '').trim();
  return limpio || null;
}
