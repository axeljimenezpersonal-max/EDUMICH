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

// Código temporal de 5 dígitos para ALUMNOS nuevos (aprobados por admin o
// creados por gestor). Se genera UNA sola vez, se envía por correo y el alumno
// lo usa únicamente para su primer inicio de sesión: ahí el sistema lo obliga
// a crear su contraseña definitiva (users.password_temporal = true →
// /estudiante/cambiar-password con confirmación).
export function generarCodigoTemporal(): string {
  let s = '';
  for (let i = 0; i < 5; i++) s += String(randomInt(0, 10));
  return s;
}
