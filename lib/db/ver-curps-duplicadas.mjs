/**
 * DIAGNÓSTICO DE CURP (solo lectura).
 *
 * El esquema de Drizzle declara un índice ÚNICO sobre `estudiantes.curp`
 * (`estudiantes_curp_idx`), pero ese índice NO está en el arreglo `migrations`
 * de `artifacts/api-server/src/db.ts`, que es lo único que corre contra la base.
 * Es decir: puede no existir en la base real, y entonces la unicidad solo la
 * sostiene el código de la aplicación.
 *
 * Este script NO modifica nada: solo hace SELECT y responde dos preguntas.
 *
 *   1. ¿Existe el índice único en la base?
 *   2. ¿Hay CURPs repetidas hoy? (si las hay, crear el índice fallaría, y
 *      además significa que ya hay expedientes duplicados que revisar)
 *
 * Cómo correrlo (en el EC2, DENTRO del contenedor, que ahí vive DATABASE_URL):
 *
 *     docker exec -it modula22 node lib/db/ver-curps-duplicadas.mjs
 *
 * Si sale limpio, el índice se puede crear a mano sin riesgo:
 *
 *     CREATE UNIQUE INDEX CONCURRENTLY estudiantes_curp_idx ON estudiantes (curp);
 *
 * (Postgres no cuenta los NULL como repetidos, así que los alumnos de
 * auto-registro —que se guardan con CURP nula— no estorban.)
 */
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..', '..');
function leerUrlBd() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = path.join(RAIZ, '.env');
  if (fs.existsSync(env)) {
    const m = fs.readFileSync(env, 'utf8').match(/^DATABASE_URL=(.*)$/m);
    if (m) return m[1].trim();
  }
  console.error('✋ No hay DATABASE_URL.');
  process.exit(1);
}

const cliente = new pg.Client({ connectionString: leerUrlBd() });
await cliente.connect();

// 1. ¿Existe ya algún índice único sobre la columna curp?
const { rows: indices } = await cliente.query(`
  SELECT indexname, indexdef
    FROM pg_indexes
   WHERE tablename = 'estudiantes'
     AND indexdef ILIKE '%(curp)%'
`);
console.log('\n── Índices sobre estudiantes(curp) ─────────────────────────');
if (indices.length === 0) {
  console.log('  ❌ NINGUNO. La unicidad de la CURP hoy solo la sostiene el código.');
} else {
  for (const i of indices) {
    const unico = /UNIQUE/i.test(i.indexdef) ? '✅ único' : '· no único';
    console.log(`  ${unico}  ${i.indexname}`);
  }
}

// 2. ¿Hay CURPs repetidas? (los NULL no cuentan: son los de auto-registro)
const { rows: dup } = await cliente.query(`
  SELECT curp, count(*)::int AS n,
         string_agg(user_id::text || ' · ' || nombre_completo, '  |  ' ORDER BY user_id) AS quienes
    FROM estudiantes
   WHERE curp IS NOT NULL AND curp <> ''
   GROUP BY curp
  HAVING count(*) > 1
   ORDER BY count(*) DESC, curp
`);
const hayIndiceUnico = indices.some((i) => /UNIQUE/i.test(i.indexdef));
console.log('\n── CURPs repetidas en estudiantes ──────────────────────────');
if (dup.length === 0) {
  console.log(
    hayIndiceUnico
      ? '  ✅ Ninguna, y el índice único ya la está sosteniendo.'
      : '  ✅ Ninguna. Se puede crear el índice único sin tocar datos.',
  );
} else {
  console.log(`  ⚠️  ${dup.length} CURP(s) con más de un expediente:\n`);
  for (const r of dup) console.log(`  ${r.curp}  (${r.n})\n      ${r.quienes}`);
  console.log('\n  Hay que decidir cuál expediente queda ANTES de crear el índice.');
}

// 3. Formatos que romperían la comparación exacta (minúsculas, espacios).
const { rows: raros } = await cliente.query(`
  SELECT user_id, nombre_completo, curp
    FROM estudiantes
   WHERE curp IS NOT NULL
     AND curp <> upper(btrim(curp))
   ORDER BY user_id
`);
console.log('\n── CURPs con formato irregular (minúsculas o espacios) ─────');
if (raros.length === 0) {
  console.log('  ✅ Ninguna: todas están en mayúsculas y sin espacios.');
} else {
  console.log(`  ⚠️  ${raros.length}. Estas NO las detectan las búsquedas exactas:\n`);
  for (const r of raros) console.log(`  #${r.user_id}  ${r.nombre_completo}  →  "${r.curp}"`);
}

// 4. Solicitudes pendientes cuya CURP ya es de un alumno: aprobarlas duplicaría.
const { rows: choque } = await cliente.query(`
  SELECT s.id, s.nombre_completo, s.curp, s.email, e.user_id AS alumno_id
    FROM solicitudes_cuenta s
    JOIN estudiantes e ON upper(btrim(e.curp)) = upper(btrim(s.curp))
   WHERE s.estado = 'pendiente'
   ORDER BY s.id
`);
console.log('\n── Solicitudes pendientes que chocan con un alumno ─────────');
if (choque.length === 0) {
  console.log('  ✅ Ninguna.');
} else {
  console.log(`  ⚠️  ${choque.length}. Aprobarlas crearía un segundo expediente:\n`);
  for (const r of choque) {
    console.log(`  solicitud #${r.id}  ${r.nombre_completo}  (${r.email})`);
    console.log(`      misma CURP que el alumno #${r.alumno_id}`);
  }
}
console.log('');

await cliente.end();
