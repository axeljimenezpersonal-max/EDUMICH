import fs from 'node:fs';

/**
 * Gemelo en JS puro de `src/ssl.ts`, para los scripts sueltos `.mjs` (respaldo,
 * restaurar, seeds, etc.) que corren con `node` sin pasar por TypeScript.
 *
 * Misma lógica: el MODO de TLS se decide con DATABASE_SSL, sin hardcodear
 * certificados.
 *   - 'off'     → sin TLS.
 *   - 'require' → cifra sin validar el certificado (default).
 *   - 'verify'  → cifra y valida contra el CA de PGSSLROOTCERT.
 *
 * Si cambias la lógica, cámbiala también en `src/ssl.ts`.
 */
export function sslDeEntorno() {
  const modo = (process.env.DATABASE_SSL ?? 'require').toLowerCase();
  if (modo === 'off' || modo === 'disable' || modo === 'false') return false;
  if (modo === 'verify') {
    const ruta = process.env.PGSSLROOTCERT;
    if (!ruta) {
      throw new Error(
        'DATABASE_SSL=verify requiere PGSSLROOTCERT apuntando al CA (p. ej. el global-bundle.pem de RDS).',
      );
    }
    return { rejectUnauthorized: true, ca: fs.readFileSync(ruta, 'utf8') };
  }
  return { rejectUnauthorized: false };
}
