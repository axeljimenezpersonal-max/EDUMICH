/**
 * Migración: dividir el `nombre_completo` de los estudiantes existentes en
 * nombres / apellido_paterno / apellido_materno (heurística: los últimos 2
 * tokens son apellidos). Solo toca filas donde `nombres` está vacío/NULL, así
 * que es idempotente y no pisa datos ya capturados desglosados.
 *
 * REQUISITOS:
 *   1) El esquema nuevo YA debe estar aplicado en la base (drizzle-kit push).
 *   2) DATABASE_URL en el entorno.
 *
 * USO (desde la raíz del repo):
 *   set -a && . ./.env && set +a && cd lib/db && node migrar-nombres.mjs
 *   (agrega --apply para ejecutar; sin él solo muestra el plan / dry-run)
 */
import pg from 'pg';

const APPLY = process.argv.includes('--apply');
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

function partirNombre(nombreCompleto) {
  const t = (nombreCompleto ?? '').trim().split(/\s+/).filter(Boolean);
  if (t.length === 0) return { nombres: '', apellidoPaterno: '', apellidoMaterno: '' };
  if (t.length === 1) return { nombres: t[0], apellidoPaterno: '', apellidoMaterno: '' };
  if (t.length === 2) return { nombres: t[0], apellidoPaterno: t[1], apellidoMaterno: '' };
  return { nombres: t.slice(0, t.length - 2).join(' '), apellidoPaterno: t[t.length - 2], apellidoMaterno: t[t.length - 1] };
}

try {
  const { rows } = await pool.query(
    `SELECT user_id, nombre_completo FROM estudiantes
     WHERE (nombres IS NULL OR nombres = '') AND nombre_completo IS NOT NULL AND nombre_completo <> ''`
  );
  console.log(`Estudiantes a migrar: ${rows.length}${APPLY ? '' : '  (DRY-RUN — usa --apply para escribir)'}\n`);

  for (const r of rows) {
    const p = partirNombre(r.nombre_completo);
    console.log(`  #${r.user_id}: "${r.nombre_completo}" → nombres="${p.nombres}" | paterno="${p.apellidoPaterno}" | materno="${p.apellidoMaterno}"`);
    if (APPLY) {
      await pool.query(
        `UPDATE estudiantes SET nombres=$1, apellido_paterno=$2, apellido_materno=$3, updated_at=now() WHERE user_id=$4`,
        [p.nombres, p.apellidoPaterno, p.apellidoMaterno, r.user_id]
      );
    }
  }
  console.log(`\n${APPLY ? '✅ Migración aplicada.' : 'ℹ️  Dry-run. Revisa las divisiones; corre con --apply para escribir.'}`);
} catch (e) {
  console.error('ERROR:', e.message);
} finally {
  await pool.end();
}
