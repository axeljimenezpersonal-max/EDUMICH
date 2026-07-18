#!/usr/bin/env node
/**
 * Verifica (y opcionalmente repara) las secuencias de las columnas `serial`.
 *
 * POR QUÉ EXISTE
 * Varios folios del sistema se derivan del id: la ficha de pago es
 * `FP-<año>-<id>` y tiene UNIQUE(folio). Si tras restaurar un dump la secuencia
 * queda por debajo del max(id) real, el siguiente INSERT reutiliza un id, genera
 * un folio repetido y **la emisión de fichas revienta en producción**.
 *
 * CUÁNDO CORRERLO
 * Obligatorio justo después de restaurar la base en un entorno nuevo (la
 * migración a AWS), antes de dejar entrar tráfico.
 *
 *   node lib/db/verificar-secuencias.mjs             # solo diagnostica
 *   node lib/db/verificar-secuencias.mjs --reparar   # ajusta las desfasadas
 *
 * Sale con código 1 si encuentra alguna desfasada (útil en CI o en un runbook).
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { Client } = require('pg');

const REPARAR = process.argv.includes('--reparar');

function dbUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const env = fs.readFileSync(path.join(raiz, '.env'), 'utf8');
  const m = env.match(/^DATABASE_URL=["']?(.+?)["']?$/m);
  if (!m) throw new Error('No encontré DATABASE_URL (ni en el entorno ni en .env)');
  return m[1];
}

const c = new Client({ connectionString: dbUrl() });
await c.connect();

try {
  // Todas las columnas del esquema público respaldadas por una secuencia.
  const { rows: cols } = await c.query(`
    SELECT c.table_name, c.column_name,
           pg_get_serial_sequence(quote_ident(c.table_name), c.column_name) AS seq
      FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND pg_get_serial_sequence(quote_ident(c.table_name), c.column_name) IS NOT NULL
     ORDER BY c.table_name, c.column_name`);

  const desfasadas = [];
  console.log(`Revisando ${cols.length} secuencias…\n`);

  for (const { table_name: tabla, column_name: col, seq } of cols) {
    const { rows: v } = await c.query(`SELECT last_value, is_called FROM ${seq}`);
    const { rows: m } = await c.query(
      `SELECT COALESCE(MAX(${JSON.stringify(col).replace(/"/g, '"')}), 0)::bigint AS m FROM ${JSON.stringify(tabla).replace(/"/g, '"')}`
    );
    const actual = BigInt(v[0].last_value);
    const max = BigInt(m[0].m);
    // Si is_called=false, el próximo valor entregado será last_value (no +1).
    const proximo = v[0].is_called ? actual + 1n : actual;
    const ok = proximo > max;

    if (!ok) {
      desfasadas.push({ tabla, col, seq, actual, max });
      console.log(`  ⚠ ${tabla}.${col}  seq→${proximo}  max=${max}  COLISIONA`);
    }
  }

  if (!desfasadas.length) {
    console.log('✅ Todas las secuencias están por delante del max(id). Nada que reparar.');
    process.exit(0);
  }

  console.log(`\n${desfasadas.length} secuencia(s) desfasada(s).`);

  if (!REPARAR) {
    console.log('Corre con --reparar para ajustarlas.');
    process.exit(1);
  }

  await c.query('BEGIN');
  for (const d of desfasadas) {
    // setval(..., max, true) => el próximo valor será max+1.
    await c.query(`SELECT setval($1, $2, true)`, [d.seq, String(d.max)]);
    console.log(`  ✓ ${d.tabla}.${d.col} → próximo id ${d.max + 1n}`);
  }
  await c.query('COMMIT');
  console.log('\n✅ Secuencias reparadas.');
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('\n❌ Error, sin cambios: ' + e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
