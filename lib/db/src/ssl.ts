import fs from 'node:fs';

/**
 * Configuración SSL para el Pool/Client de `pg`, elegida por entorno.
 *
 * Existe para el corte de Neon → AWS RDS: la conexión (DATABASE_URL) sigue
 * siendo la única fuente, pero el MODO de TLS se decide con una variable, sin
 * hardcodear certificados en el código.
 *
 * DATABASE_SSL:
 *   - 'off'      → sin TLS (Postgres local de desarrollo).
 *   - 'require'  → cifra, pero NO valida el certificado. **Default.**
 *   - 'verify'   → cifra y VALIDA el certificado contra el CA de PGSSLROOTCERT.
 *                  Para RDS: el global-bundle.pem de AWS (se descarga al
 *                  servidor y se apunta con la variable; nunca va en el repo).
 *
 * Hay un GEMELO en JS puro para los scripts sueltos: `lib/db/ssl.mjs`. Si
 * cambias la lógica aquí, cámbiala allá (no se pueden compartir por la frontera
 * TS/ESM de los `.mjs`).
 */
export function sslDeEntorno(): false | { rejectUnauthorized: boolean; ca?: string } {
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
  // 'require' (default) y cualquier otro valor → cifra sin validar el CA.
  return { rejectUnauthorized: false };
}
