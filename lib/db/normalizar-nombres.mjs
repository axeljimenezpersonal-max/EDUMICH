/**
 * PASAR LOS NOMBRES YA CAPTURADOS A SU FORMA CANÓNICA (MAYÚSCULAS).
 *
 * A partir de ahora el API guarda todo nombre de alumno en MAYÚSCULAS con
 * acentos (`utils/estudianteDatos.ts` → `normalizarNombre`). Lo que ya estaba
 * en la base se quedó como se tecleó, y mientras convivan las dos formas el
 * problema sigue: el mismo alumno capturado desde la página pública y desde un
 * centro no empata, ni al buscar ni al cotejar contra la Relación de la DGB.
 *
 * Cómo correrlo (en el EC2, DENTRO del contenedor):
 *
 *     docker exec -it modula22 node lib/db/normalizar-nombres.mjs            # simula
 *     docker exec -it modula22 node lib/db/normalizar-nombres.mjs --aplicar
 *
 * ── Lo que toca y lo que no ─────────────────────────────────────────────────
 *
 * Toca `estudiantes` (nombres, apellido_paterno, apellido_materno,
 * nombre_completo) y `solicitudes_cuenta`, que es la misma información antes de
 * aprobarse.
 *
 * NO toca los nombres de gestores ni de administradores. Ésos no son parte del
 * padrón: no van a la DGB, no se cotejan contra nada y sí se leen en pantalla
 * todo el día ("Hola, Centro UTEC"). Pasarlos a mayúsculas sería gritar sin
 * ganar nada.
 *
 * ── Por qué sólo cambia mayúsculas ──────────────────────────────────────────
 *
 * Se conservan los acentos y NO se reacomodan las palabras. Un nombre mal
 * partido —apellido en el campo del nombre— no se arregla aquí: eso se corrige
 * en la ficha del alumno, a la vista de quien sabe cómo se llama. Este script
 * hace una sola cosa y es reversible en su intención: no destruye información.
 */
import pg from 'pg';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..', '..');
const APLICAR = process.argv.includes('--aplicar');

/** El MISMO criterio que el API. Si uno cambia, hay que cambiar el otro. */
function normalizarNombre(v) {
  return v.normalize('NFC').replace(/\s+/g, ' ').trim().toLocaleUpperCase('es-MX');
}

function leerUrlBd() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const m = readFileSync(path.join(RAIZ, '.env'), 'utf8').match(/^DATABASE_URL=(.*)$/m);
    if (m) return m[1].trim();
  } catch { /* sigue */ }
  console.error('✋ No hay DATABASE_URL.');
  process.exit(1);
}

const TABLAS = [
  { tabla: 'estudiantes', llave: 'user_id',
    columnas: ['nombres', 'apellido_paterno', 'apellido_materno', 'nombre_completo'] },
  { tabla: 'solicitudes_cuenta', llave: 'id',
    columnas: ['nombres', 'apellido_paterno', 'apellido_materno', 'nombre_completo'] },
];

const cliente = new pg.Client({ connectionString: leerUrlBd(), ssl: { rejectUnauthorized: false } });
await cliente.connect();

try {
  console.log(`\n══ NOMBRES A MAYÚSCULAS ${APLICAR ? '— APLICANDO' : '— SIMULACIÓN (no escribe nada)'} ══\n`);

  const pendientes = [];
  for (const t of TABLAS) {
    const { rows } = await cliente.query(
      `SELECT ${t.llave} AS llave, ${t.columnas.join(', ')} FROM ${t.tabla}`);
    for (const r of rows) {
      const cambios = {};
      for (const c of t.columnas) {
        const actual = r[c];
        if (typeof actual !== 'string' || actual.length === 0) continue;
        const nuevo = normalizarNombre(actual);
        if (nuevo !== actual) cambios[c] = nuevo;
      }
      if (Object.keys(cambios).length > 0) pendientes.push({ ...t, llaveValor: r.llave, cambios, antes: r });
    }
    console.log(`  ${t.tabla}: ${rows.length} fila(s) revisada(s).`);
  }

  console.log(`\n  Filas por corregir: ${pendientes.length}\n`);
  // Se listan las primeras para poder mirarlas antes de escribir. Si hay un
  // nombre que se ve raro aquí, se ve ANTES de tocar la base y no después.
  for (const p of pendientes.slice(0, 25)) {
    const detalle = Object.entries(p.cambios)
      .map(([c, v]) => `${c}: "${p.antes[c]}" → "${v}"`).join(' · ');
    console.log(`    ${p.tabla}#${p.llaveValor}  ${detalle}`);
  }
  if (pendientes.length > 25) console.log(`    … y ${pendientes.length - 25} más.`);

  if (!APLICAR) {
    console.log('\n[SIMULACIÓN] Nada se escribió. Corre con --aplicar para hacerlo.\n');
    await cliente.end();
    process.exit(0);
  }

  if (pendientes.length === 0) {
    console.log('Nada que hacer: todos los nombres ya están en su forma canónica.\n');
    await cliente.end();
    process.exit(0);
  }

  await cliente.query('BEGIN');
  for (const p of pendientes) {
    const cols = Object.keys(p.cambios);
    const sets = cols.map((c, i) => `${c} = $${i + 1}`).join(', ');
    await cliente.query(
      `UPDATE ${p.tabla} SET ${sets} WHERE ${p.llave} = $${cols.length + 1}`,
      [...cols.map((c) => p.cambios[c]), p.llaveValor]);
  }
  await cliente.query('COMMIT');

  console.log(`\nListo: ${pendientes.length} fila(s) actualizada(s).`);
  console.log('No hace falta reiniciar el contenedor: esto es sólo datos.\n');
} catch (e) {
  await cliente.query('ROLLBACK').catch(() => {});
  console.error('\n✋ Falló y se revirtió todo:\n', e);
  process.exitCode = 1;
} finally {
  await cliente.end();
}
