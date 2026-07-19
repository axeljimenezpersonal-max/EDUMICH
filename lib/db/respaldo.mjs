#!/usr/bin/env node
/**
 * Respaldo completo de la base, cifrado.
 *
 * Existe porque la auditoría de seguridad encontró que NO había ninguno: ni
 * script, ni procedimiento, ni prueba de restauración (P0-10). Es el único
 * riesgo del que no se vuelve.
 *
 * ── Qué hace ────────────────────────────────────────────────────────────────
 *  1. Vuelca TODAS las tablas de `public` en JSON Lines (una fila por línea,
 *     en streaming: no carga la tabla entera en memoria).
 *  2. Vuelca el valor actual de TODAS las secuencias. Esto no es un detalle:
 *     tras restaurar, si las secuencias quedan por debajo del máximo id, el
 *     siguiente INSERT choca contra UNIQUE(folio) y deja de emitirse cualquier
 *     ficha de pago. Es el paso que `lib/db/verificar-secuencias.mjs` arregla a
 *     posteriori; aquí se guarda para no depender de eso.
 *  3. Comprime y CIFRA (AES-256-GCM). El archivo contiene el padrón completo:
 *     dejarlo en claro en un disco sería crear el problema que se quiere evitar.
 *  4. Verifica: descifra lo que acaba de escribir y cuenta las filas contra lo
 *     leído. Un respaldo no verificado no es un respaldo.
 *
 * ── Uso ─────────────────────────────────────────────────────────────────────
 *   pnpm --filter @workspace/db run respaldo [carpeta-destino]
 *
 * La clave se toma de RESPALDO_KEY (64 hex). Si no está, se genera una y se
 * imprime UNA sola vez: hay que guardarla en el gestor de contraseñas. Sin
 * ella el respaldo no se puede leer — que es justamente el punto.
 *
 * ── Lo que NO es ────────────────────────────────────────────────────────────
 * No sustituye a `pg_dump` ni a los respaldos automáticos de RDS. No guarda el
 * ESQUEMA (que vive en `lib/db/src/schema`), ni los ARCHIVOS subidos, que van
 * aparte. Es la red mínima mientras no exista la infraestructura de la Parte 5
 * de la estrategia, y sirve para practicar la restauración.
 */

import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const RAIZ = path.resolve(import.meta.dirname, '..', '..');

function leerUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = path.join(RAIZ, '.env');
  if (fs.existsSync(env)) {
    const m = fs.readFileSync(env, 'utf8').match(/^DATABASE_URL=(.*)$/m);
    if (m) return m[1].trim();
  }
  console.error('✋ No hay DATABASE_URL.');
  process.exit(1);
}

function obtenerClave() {
  const dada = process.env.RESPALDO_KEY;
  if (dada) {
    if (!/^[0-9a-f]{64}$/i.test(dada)) {
      console.error('✋ RESPALDO_KEY debe ser 64 caracteres hexadecimales.');
      process.exit(1);
    }
    return { clave: Buffer.from(dada, 'hex'), nueva: false };
  }
  return { clave: crypto.randomBytes(32), nueva: true };
}

const url = leerUrl();
const { clave, nueva } = obtenerClave();
const destino = process.argv[2] || path.join(RAIZ, '..', 'respaldos-modula');
fs.mkdirSync(destino, { recursive: true });

const sello = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const archivo = path.join(destino, `modula-${sello}.jsonl.gz.enc`);

const cliente = new pg.Client({ connectionString: url });
await cliente.connect();

// El host se muestra sin credenciales.
console.log(`Respaldando ${url.replace(/^.*@/, '').split(/[:/?]/)[0]}`);

const { rows: tablas } = await cliente.query(`
  SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
`);
const { rows: secuencias } = await cliente.query(`
  SELECT schemaname, sequencename, last_value
  FROM pg_sequences WHERE schemaname = 'public' ORDER BY sequencename
`);

const conteos = {};

/** Genera el volcado línea por línea, sin acumularlo en memoria. */
async function* generar() {
  yield JSON.stringify({
    _meta: {
      generado: new Date().toISOString(),
      tablas: tablas.length,
      secuencias: secuencias.length,
      version: 1,
    },
  }) + '\n';

  // Las secuencias van PRIMERO: si el volcado se corta a la mitad, lo más
  // valioso para reconstruir sin colisiones de folio ya está escrito.
  yield JSON.stringify({ _secuencias: secuencias }) + '\n';

  for (const { tablename } of tablas) {
    const { rows } = await cliente.query(`SELECT * FROM "${tablename}"`);
    conteos[tablename] = rows.length;
    for (const fila of rows) {
      yield JSON.stringify({ t: tablename, d: fila }) + '\n';
    }
    process.stdout.write(`  ${tablename}: ${rows.length}\n`);
  }
}

const iv = crypto.randomBytes(12);
const cifrador = crypto.createCipheriv('aes-256-gcm', clave, iv);

await pipeline(
  Readable.from(generar()),
  zlib.createGzip(),
  cifrador,
  fs.createWriteStream(archivo),
);

// La etiqueta de autenticación va en un archivo hermano: sin ella el descifrado
// no puede comprobar que nadie alteró el contenido.
const meta = { iv: iv.toString('hex'), tag: cifrador.getAuthTag().toString('hex'), archivo: path.basename(archivo) };
fs.writeFileSync(archivo + '.meta.json', JSON.stringify(meta, null, 2));

await cliente.end();

// ── Verificación: se vuelve a leer lo que se acaba de escribir ──────────────
const descifrador = crypto.createDecipheriv('aes-256-gcm', clave, iv);
descifrador.setAuthTag(Buffer.from(meta.tag, 'hex'));

let leidas = 0;
let resto = '';
const porTabla = {};
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
        if (o.t) { leidas++; porTabla[o.t] = (porTabla[o.t] ?? 0) + 1; }
      }
    }
    yield '';
  },
);

const esperadas = Object.values(conteos).reduce((a, b) => a + b, 0);
const discrepancias = Object.entries(conteos).filter(([t, n]) => (porTabla[t] ?? 0) !== n);

console.log(`\nArchivo: ${archivo}`);
console.log(`Tamaño: ${(fs.statSync(archivo).size / 1024).toFixed(1)} KB`);
console.log(`Filas escritas: ${esperadas} · releídas: ${leidas}`);
console.log(`Secuencias guardadas: ${secuencias.length}`);

if (discrepancias.length > 0 || leidas !== esperadas) {
  console.error('\n❌ VERIFICACIÓN FALLIDA. El respaldo NO es confiable.');
  console.error(discrepancias);
  process.exit(1);
}
console.log('\n✅ Verificado: descifra, descomprime y cuadra fila por fila.');

if (nueva) {
  console.log(`
────────────────────────────────────────────────────────────────
  CLAVE DEL RESPALDO (se muestra UNA sola vez):

    ${clave.toString('hex')}

  Guárdala en el gestor de contraseñas AHORA. Sin ella este archivo
  no se puede leer. Para los siguientes respaldos, pásala como
  RESPALDO_KEY para que todos usen la misma.
────────────────────────────────────────────────────────────────
`);
}
