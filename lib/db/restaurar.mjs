#!/usr/bin/env node
/**
 * Restaura un respaldo hecho con `respaldo.mjs`.
 *
 * ── LO MÁS IMPORTANTE ───────────────────────────────────────────────────────
 * Este script SOBRESCRIBE la base de destino. Por eso se niega a correr contra
 * cualquier base cuyo nombre no diga explícitamente que es de restauración,
 * salvo que se pase `DESTINO_ES_DESECHABLE=si`. El accidente que evita —
 * restaurar sobre producción un respaldo de ayer — es peor que el problema que
 * resuelve.
 *
 * ── Uso ─────────────────────────────────────────────────────────────────────
 *   RESPALDO_KEY=<clave> DATABASE_URL=<destino> \
 *     node lib/db/restaurar.mjs <archivo.jsonl.gz.enc>
 *
 * ── Qué hace, en orden ──────────────────────────────────────────────────────
 *  1. Descifra y verifica la integridad (AES-256-GCM: si alguien alteró el
 *     archivo, falla aquí y no escribe nada).
 *  2. Vacía las tablas de destino.
 *  3. Inserta las filas.
 *  4. **Restaura las secuencias.** Sin esto el sistema arranca y parece sano,
 *     pero el siguiente pago choca contra UNIQUE(folio) y deja de emitirse
 *     cualquier ficha. Es el paso que se olvida.
 *  5. Cuenta y compara contra lo que traía el archivo.
 *
 * NO restaura el ESQUEMA: hay que aplicarlo antes (`pnpm --filter
 * @workspace/db run push`). Tampoco los archivos subidos, que van aparte.
 */

import pg from 'pg';
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

const archivo = process.argv[2];
if (!archivo) {
  console.error('Uso: node lib/db/restaurar.mjs <archivo.jsonl.gz.enc>');
  process.exit(1);
}
if (!fs.existsSync(archivo)) { console.error(`✋ No existe: ${archivo}`); process.exit(1); }

const metaPath = archivo + '.meta.json';
if (!fs.existsSync(metaPath)) {
  console.error(`✋ Falta ${path.basename(metaPath)}. Sin el vector y la etiqueta no se puede descifrar.`);
  process.exit(1);
}

const claveHex = process.env.RESPALDO_KEY;
if (!/^[0-9a-f]{64}$/i.test(claveHex ?? '')) {
  console.error('✋ Falta RESPALDO_KEY (64 hex). Es la clave que se mostró al hacer el respaldo.');
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) { console.error('✋ Falta DATABASE_URL (la base DESTINO).'); process.exit(1); }

// ── Candado de destino ──────────────────────────────────────────────────────
const nombreBase = decodeURIComponent((url.split('/').pop() ?? '').split('?')[0]);
const pareceDesechable = /restaur|prueba|test|scratch|tmp|temp/i.test(nombreBase);
if (!pareceDesechable && process.env.DESTINO_ES_DESECHABLE !== 'si') {
  console.error(`
✋ RESTAURACIÓN CANCELADA.

   Destino: base "${nombreBase}"

   Este script BORRA y reescribe la base de destino. El nombre no contiene
   "restauracion", "prueba" ni "test", así que podría ser la base real.

   Si de verdad quieres restaurar aquí —por ejemplo, en una recuperación real
   tras perder los datos— hazlo explícito:
       DESTINO_ES_DESECHABLE=si ...
`);
  process.exit(1);
}

const t0 = Date.now();
const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

// ── 1. Descifrar y leer ─────────────────────────────────────────────────────
console.log(`Leyendo ${path.basename(archivo)}…`);
const descifrador = crypto.createDecipheriv(
  'aes-256-gcm', Buffer.from(claveHex, 'hex'), Buffer.from(meta.iv, 'hex'),
);
descifrador.setAuthTag(Buffer.from(meta.tag, 'hex'));

const porTabla = new Map();
let secuencias = [];
let cabecera = null;
let resto = '';

await pipeline(
  fs.createReadStream(archivo),
  descifrador,
  zlib.createGunzip(),
  async function* (fuente) {
    for await (const trozo of fuente) {
      resto += trozo.toString('utf8');
      const lineas = resto.split('\n');
      resto = lineas.pop() ?? '';
      for (const l of lineas) {
        if (!l) continue;
        const o = JSON.parse(l);
        if (o._meta) { cabecera = o._meta; continue; }
        if (o._secuencias) { secuencias = o._secuencias; continue; }
        if (!porTabla.has(o.t)) porTabla.set(o.t, []);
        porTabla.get(o.t).push(o.d);
      }
    }
    yield '';
  },
);

const totalFilas = [...porTabla.values()].reduce((a, b) => a + b.length, 0);
console.log(`  Respaldo del ${cabecera?.generado ?? '(sin fecha)'}`);
console.log(`  ${porTabla.size} tablas · ${totalFilas} filas · ${secuencias.length} secuencias`);

const c = new pg.Client({ connectionString: url });
await c.connect();
console.log(`\nDestino: ${nombreBase} en ${url.replace(/^.*@/, '').split(/[:/?]/)[0]}`);

// ── 2 y 3. Vaciar e insertar ────────────────────────────────────────────────
//
// Se desactivan los disparadores de integridad durante la carga
// (`session_replication_role = replica`, que es lo que hace pg_restore). Así no
// hace falta calcular el orden topológico de 67 tablas: se inserta en cualquier
// orden y al final la integridad se comprueba sola, porque los datos vienen de
// una base que ya era consistente.
let modoReplica = false;
try {
  await c.query(`SET session_replication_role = replica`);
  modoReplica = true;
} catch {
  // Neon no concede ese permiso al rol dueño. No es problema: se calcula el
  // orden de dependencias desde el catálogo, que además es más honesto —
  // documenta el grafo real en vez de esquivarlo.
}

/**
 * Ordena las tablas para que ninguna se inserte antes que aquellas de las que
 * depende. Se lee el grafo de llaves foráneas de la base DESTINO, no una lista
 * escrita a mano: una lista a mano se desactualiza en silencio en cuanto
 * alguien agrega una relación.
 */
async function ordenPorDependencias(tablas) {
  const { rows: fks } = await c.query(`
    SELECT tc.table_name AS hija, ccu.table_name AS padre
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
  `);

  const enJuego = new Set(tablas);
  const depende = new Map([...enJuego].map((t) => [t, new Set()]));
  for (const { hija, padre } of fks) {
    // Las autorreferencias no ordenan tablas entre sí; se resuelven dentro de
    // la propia tabla y no deben bloquear el algoritmo.
    if (hija === padre) continue;
    if (enJuego.has(hija) && enJuego.has(padre)) depende.get(hija).add(padre);
  }

  const orden = [];
  const puestas = new Set();
  let quedan = [...enJuego];
  while (quedan.length) {
    const listas = quedan.filter((t) => [...depende.get(t)].every((p) => puestas.has(p)));
    if (listas.length === 0) {
      // Ciclo entre tablas: se meten las restantes tal cual y que la base
      // decida. Mejor avisar que fallar en silencio.
      console.log(`  ⚠️ dependencia circular entre: ${quedan.join(', ')}`);
      orden.push(...quedan);
      break;
    }
    for (const t of listas) { orden.push(t); puestas.add(t); }
    quedan = quedan.filter((t) => !puestas.has(t));
  }
  return orden;
}

const { rows: tablasDestino } = await c.query(
  `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
);
const hay = new Set(tablasDestino.map((r) => r.tablename));

const faltantes = [...porTabla.keys()].filter((t) => !hay.has(t));
if (faltantes.length) {
  console.error(`\n✋ El destino no tiene estas tablas: ${faltantes.join(', ')}`);
  console.error('   Aplica el esquema primero: pnpm --filter @workspace/db run push');
  await c.end();
  process.exit(1);
}

const orden = modoReplica ? [...porTabla.keys()] : await ordenPorDependencias([...porTabla.keys()]);

/**
 * Columnas JSON de cada tabla.
 *
 * Hay que saber cuáles son porque el driver de Postgres, al recibir un ARREGLO
 * de JavaScript, lo traduce a un arreglo de Postgres (`{1,2,3}`) en vez de a
 * JSON. Para una columna `jsonb` que guarda un arreglo, eso rompe la inserción
 * o —peor— guarda basura sin avisar. Se serializan a mano.
 */
const columnasDestino = new Map();
{
  const { rows } = await c.query(`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'public'
  `);
  for (const r of rows) {
    if (!columnasDestino.has(r.table_name)) columnasDestino.set(r.table_name, new Set());
    columnasDestino.get(r.table_name).add(r.column_name);
  }
}

const columnasJson = new Map();
{
  const { rows } = await c.query(`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND data_type IN ('json', 'jsonb')
  `);
  for (const r of rows) {
    if (!columnasJson.has(r.table_name)) columnasJson.set(r.table_name, new Set());
    columnasJson.get(r.table_name).add(r.column_name);
  }
}

const avisosEsquema = [];
await c.query('BEGIN');
const insertadas = {};
try {
  // Vaciar en orden INVERSO al de inserción: primero las hojas, al final las
  // raíces. Al revés chocaría contra las mismas llaves foráneas.
  for (const t of [...orden].reverse()) {
    await c.query(`DELETE FROM "${t}"`);
  }

  for (const tabla of orden) {
    const filas = porTabla.get(tabla) ?? [];
    if (filas.length === 0) continue;
    // El esquema pudo cambiar entre el respaldo y hoy. Las columnas que ya no
    // existen se descartan, PERO SE AVISA: si alguien quitó una columna que
    // guardaba algo importante, la restauración lo pierde en silencio y eso es
    // justo lo que no debe pasar sin que nadie lo sepa.
    const enDestino = columnasDestino.get(tabla) ?? new Set();
    const todas = Object.keys(filas[0]);
    const columnas = todas.filter((k) => enDestino.has(k));
    const descartadas = todas.filter((k) => !enDestino.has(k));
    if (descartadas.length) {
      avisosEsquema.push(`${tabla}: el respaldo trae ${descartadas.join(', ')}, que ya no existe(n) en el esquema actual`);
    }
    if (columnas.length === 0) continue;
    const listaCols = columnas.map((k) => `"${k}"`).join(', ');

    // Se insertan por lotes: una sentencia por fila sobre 3,800 filas son 3,800
    // viajes de ida y vuelta a un servidor remoto, y eso convierte una
    // restauración de segundos en una de minutos.
    const LOTE = 200;
    for (let i = 0; i < filas.length; i += LOTE) {
      const trozo = filas.slice(i, i + LOTE);
      const valores = [];
      const jsonDeEstaTabla = columnasJson.get(tabla) ?? new Set();
      const marcadores = trozo.map((fila, j) => {
        const base = j * columnas.length;
        columnas.forEach((k) => {
          const v = fila[k];
          valores.push(
            jsonDeEstaTabla.has(k) && v !== null && v !== undefined ? JSON.stringify(v) : v,
          );
        });
        return `(${columnas.map((_, x) => `$${base + x + 1}`).join(', ')})`;
      });
      await c.query(
        `INSERT INTO "${tabla}" (${listaCols}) VALUES ${marcadores.join(', ')}`,
        valores,
      );
    }
    insertadas[tabla] = filas.length;
  }

  // ── 4. Secuencias ─────────────────────────────────────────────────────────
  // El paso que se olvida y que rompe los folios de pago.
  let seqOk = 0;
  for (const s of secuencias) {
    try {
      await c.query(`SELECT setval($1, $2, true)`, [`${s.schemaname}.${s.sequencename}`, s.last_value ?? 1]);
      seqOk++;
    } catch (e) {
      console.error(`  ⚠️ secuencia ${s.sequencename}: ${e.message}`);
    }
  }
  console.log(`\nSecuencias restauradas: ${seqOk}/${secuencias.length}`);

  await c.query('COMMIT');
} catch (e) {
  await c.query('ROLLBACK');
  console.error('\n❌ Falló la restauración. Se revirtió TODO.\n', e.message);
  await c.end();
  process.exit(1);
}

if (modoReplica) await c.query(`SET session_replication_role = origin`);

// ── 5. Verificación ─────────────────────────────────────────────────────────
if (avisosEsquema.length) {
  console.log('\n⚠️  DERIVA DE ESQUEMA — el respaldo y el código ya no coinciden:');
  for (const a of avisosEsquema) console.log(`   · ${a}`);
  console.log('   Esos datos NO se restauraron. Si alguno importaba, hay que');
  console.log('   recuperarlo a mano del archivo antes de dar por buena la restauración.');
}

console.log('\n── Verificación ──');
let discrepancias = 0;
for (const [tabla, filas] of porTabla) {
  const { rows } = await c.query(`SELECT count(*)::int n FROM "${tabla}"`);
  if (rows[0].n !== filas.length) {
    discrepancias++;
    console.error(`  ❌ ${tabla}: esperaba ${filas.length}, hay ${rows[0].n}`);
  }
}
console.log(discrepancias === 0
  ? `  ✅ Las ${porTabla.size} tablas cuadran fila por fila (${totalFilas} en total)`
  : `  ❌ ${discrepancias} tabla(s) no cuadran`);

const segundos = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\nTiempo: ${segundos} s`);
await c.end();
process.exit(discrepancias === 0 ? 0 : 1);
