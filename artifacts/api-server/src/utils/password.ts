import { randomInt } from 'node:crypto';

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghjkmnpqrstuvwxyz';
const DIGITS = '23456789';

function pick(chars: string, n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) {
    s += chars[randomInt(0, chars.length)];
  }
  return s;
}

// Returns a human-friendly temp password like "Mh-7342-kn".
// Se usa para cuentas de STAFF (gestores), que no tienen cambio forzoso.
export function generarPasswordTemporal(): string {
  return `${pick(UPPER, 1)}${pick(LOWER, 1)}-${pick(DIGITS, 4)}-${pick(LOWER, 2)}`;
}

/**
 * Credencial temporal para ALUMNOS nuevos (aprobados por admin o creados por
 * gestor). Se genera una sola vez, se envía por correo, y sólo sirve para el
 * primer inicio de sesión: ahí el sistema obliga a crear la definitiva
 * (`users.password_temporal = true` → `/estudiante/cambiar-password`).
 *
 * ANTES ERAN 5 DÍGITOS: 100,000 combinaciones, y sin caducar hasta el primer
 * acceso. Con ~1,700 altas al mes y sin bloqueo por cuenta, era el punto más
 * débil del sistema — y llamativamente, los gestores ya recibían una credencial
 * miles de veces más fuerte generada en este mismo archivo.
 *
 * Ahora usa el mismo formato: ~1,200 millones de combinaciones, y conserva lo
 * que hacía práctico al código de 5 dígitos — el alfabeto excluye caracteres
 * que se confunden al dictarlo por teléfono o al copiarlo de un correo
 * (I/l/1, O/0), y los guiones lo hacen legible en trozos.
 */
export function generarCodigoTemporal(): string {
  return generarPasswordTemporal();
}
