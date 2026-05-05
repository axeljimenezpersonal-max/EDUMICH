const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghjkmnpqrstuvwxyz';
const DIGITS = '23456789';

function pick(chars: string, n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

// Returns a human-friendly temp password like "Mh-7342-kn"
export function generarPasswordTemporal(): string {
  return `${pick(UPPER, 1)}${pick(LOWER, 1)}-${pick(DIGITS, 4)}-${pick(LOWER, 2)}`;
}
