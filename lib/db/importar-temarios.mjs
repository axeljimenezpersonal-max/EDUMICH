/**
 * CARGA LOS TEMARIOS (PDF) DE LOS MÓDULOS.
 *
 * Deja cada PDF en el almacenamiento de archivos y registra una fila en
 * `modulos_materiales` con `tipo = 'temario'`, que es lo que el alumno ve en
 * "Material de estudio" y lo que descarga con el botón "Descargar temario PDF"
 * del detalle del módulo.
 *
 *     node lib/db/importar-temarios.mjs <carpeta>             # ensayo
 *     node lib/db/importar-temarios.mjs <carpeta> --aplicar   # de verdad
 *
 * En el servidor, los PDF se copian primero al EC2 y el script corre DENTRO del
 * contenedor (ver docs/runbook-redeploy.md):
 *
 *     docker cp ~/temarios modula22:/tmp/temarios
 *     docker exec -it modula22 node lib/db/importar-temarios.mjs /tmp/temarios --aplicar
 *
 * Qué hace y qué NO hace:
 *
 * - El número de módulo sale del NOMBRE del archivo, con una lectura tolerante
 *   (`TEMARIO_MODULO_1.pdf`, `temario modulo 01.pdf`, `Modulo-1.pdf`, `M1.pdf`…).
 *   Si el nombre no lo dice con claridad, el archivo se SALTA y se avisa. No se
 *   adivina: cargar el temario equivocado en un módulo es peor que no cargarlo.
 *   Aun así, el ensayo imprime a qué módulo va cada PDF —con el nombre del
 *   módulo— justamente para que alguien lo lea antes de aplicar.
 * - Comprueba que el módulo exista en `modulos` y que el archivo sea PDF de
 *   verdad (cabecera `%PDF`). Lo que no pasa, se salta con su motivo.
 * - Es IDEMPOTENTE: si el módulo ya tiene un temario, lo REEMPLAZA (misma fila,
 *   ruta y tamaño nuevos). Correrlo dos veces no duplica nada.
 * - Por omisión NO escribe: enseña lo que haría y se sale.
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

const APLICAR = process.argv.includes('--aplicar');
const CARPETA = process.argv.slice(2).find((a) => !a.startsWith('--'));

if (!CARPETA) {
  console.error('✋ Falta la carpeta con los PDF.');
  console.error('   Uso:  node lib/db/importar-temarios.mjs <carpeta> [--aplicar]');
  process.exit(1);
}
if (!fs.existsSync(CARPETA) || !fs.statSync(CARPETA).isDirectory()) {
  console.error(`✋ No es una carpeta que se pueda leer: ${CARPETA}`);
  process.exit(1);
}

// El almacenamiento local resuelve igual que artifacts/api-server/src/services/
// storage.ts. Si el sistema está en S3 este script no aplica: subir a un bucket
// es otra operación y hacerla a medias dejaría la fila apuntando a un archivo
// que no existe (y el alumno bajaría el PDF de relleno sin enterarse).
if (process.env.STORAGE_DRIVER === 's3') {
  console.error('✋ STORAGE_DRIVER=s3: este script solo copia a disco local.');
  console.error('   Sube los PDF al bucket y registra las filas con la ruta "s3:<key>".');
  process.exit(1);
}
const STORAGE_DIR = process.env.STORAGE_DIR || path.join(process.cwd(), 'storage');
const CARPETA_DESTINO = 'modulos'; // dentro de STORAGE_DIR

/** Quita acentos y ñ para no dejar nada fuera de ASCII en un nombre de archivo. */
function aplanar(texto) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ñ/g, 'n')
    .replace(/Ñ/g, 'N');
}

/**
 * Número de módulo a partir del nombre del archivo.
 *
 * Devuelve `{ numero }` o `{ motivo }` explicando por qué no se pudo. Primero
 * busca la palabra "módulo" (o una "M" suelta) seguida del número, que es la
 * forma en que vienen nombrados; si no aparece, acepta un número suelto SOLO
 * cuando es el único del nombre — con dos números no hay manera de saber cuál
 * es el módulo.
 */
function deducirNumero(nombreArchivo) {
  const base = aplanar(path.basename(nombreArchivo, path.extname(nombreArchivo))).toLowerCase();

  const conPalabra = new Set();
  const re = /(?:^|[^a-z0-9])m(?:od(?:ulo)?)?[\s._-]*0*(\d{1,2})(?![0-9])/g;
  for (const m of base.matchAll(re)) conPalabra.add(Number(m[1]));

  if (conPalabra.size === 1) return { numero: [...conPalabra][0] };
  if (conPalabra.size > 1) {
    return { motivo: `el nombre menciona varios módulos (${[...conPalabra].join(', ')})` };
  }

  const sueltos = [...new Set((base.match(/\d+/g) ?? []).map(Number))];
  if (sueltos.length === 0) return { motivo: 'el nombre no trae ningún número' };
  if (sueltos.length > 1) {
    return { motivo: `el nombre trae varios números (${sueltos.join(', ')}) y ninguno dice "modulo"` };
  }
  // Un año o un folio suelto no es un módulo: hay 22, no 2026.
  if (sueltos[0] < 1 || sueltos[0] > 99) {
    return { motivo: `el único número del nombre (${sueltos[0]}) no puede ser un módulo` };
  }
  return { numero: sueltos[0] };
}

/** ¿Es un PDF de verdad? La cabecera del formato es `%PDF`. */
function esPdf(ruta) {
  const buf = Buffer.alloc(5);
  let fd;
  try {
    fd = fs.openSync(ruta, 'r');
    const leidos = fs.readSync(fd, buf, 0, 5, 0);
    return leidos >= 4 && buf.subarray(0, 4).toString('latin1') === '%PDF';
  } catch {
    return false;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

// ─── Archivos de entrada ─────────────────────────────────────────────────────
const archivos = fs
  .readdirSync(CARPETA)
  .filter((n) => n.toLowerCase().endsWith('.pdf'))
  .sort();

console.log(APLICAR ? '\n⚙️  MODO APLICAR: se van a escribir cambios.\n' : '\n👀 ENSAYO: no se escribe nada.\n');
console.log(`Carpeta:      ${path.resolve(CARPETA)}`);
console.log(`Almacenaje:   ${STORAGE_DIR}`);
console.log(`PDF hallados: ${archivos.length}\n`);

if (archivos.length === 0) {
  console.log('✋ No hay archivos .pdf en esa carpeta. Nada que hacer.\n');
  process.exit(0);
}

const cliente = new pg.Client({ connectionString: leerUrlBd() });
await cliente.connect();

const { rows: modulos } = await cliente.query(
  'SELECT id, numero, nombre FROM modulos ORDER BY numero',
);
const porNumero = new Map(modulos.map((m) => [m.numero, m]));

const saltados = [];
const conTemario = new Set(); // números que quedan (o quedarían) con temario
let cargados = 0;
let reemplazados = 0;
const yaVistos = new Map(); // numero -> archivo, para cazar dos PDF del mismo módulo

// ─── Primera pasada: leer los nombres y descartar lo que no sirve ────────────
const plan = [];
for (const archivo of archivos) {
  const completa = path.join(CARPETA, archivo);

  const { numero, motivo } = deducirNumero(archivo);
  if (!numero) {
    saltados.push({ archivo, motivo: `no se pudo deducir el módulo: ${motivo}` });
    continue;
  }
  const modulo = porNumero.get(numero);
  if (!modulo) {
    saltados.push({ archivo, motivo: `el módulo ${numero} no existe en la tabla "modulos"` });
    continue;
  }
  if (yaVistos.has(numero)) {
    saltados.push({
      archivo,
      motivo: `el módulo ${numero} ya lo cubre "${yaVistos.get(numero)}" — hay dos PDF para el mismo módulo`,
    });
    continue;
  }
  if (!esPdf(completa)) {
    saltados.push({ archivo, motivo: 'no es un PDF (le falta la cabecera %PDF)' });
    continue;
  }

  yaVistos.set(numero, archivo);
  plan.push({ archivo, completa, numero, modulo });
}

// En orden de módulo: así el listado se lee como el plan de estudios y salta a
// la vista si a un archivo le tocó un módulo que no le corresponde.
plan.sort((a, b) => a.numero - b.numero);

// ─── Segunda pasada: reportar (y escribir, si se pidió) ──────────────────────
for (const { archivo, completa, numero, modulo } of plan) {
  const tamano = fs.statSync(completa).size;
  const ruta = `${CARPETA_DESTINO}/temario-M${numero}.pdf`; // ASCII, sin acentos
  const destino = path.join(STORAGE_DIR, ruta);
  const nombre = `Temario oficial — Módulo ${numero}`;

  // ¿Ya hay temario para este módulo? Se reemplaza la fila más antigua.
  const { rows: previos } = await cliente.query(
    `SELECT id, ruta_archivo, tamano_bytes FROM modulos_materiales
      WHERE modulo_id = $1 AND tipo = 'temario' ORDER BY id`,
    [modulo.id],
  );

  const kb = (tamano / 1024).toFixed(0);
  console.log(`M${String(numero).padStart(2, '0')}  ${archivo}  (${kb} KB)`);
  console.log(`     ${modulo.nombre}`);
  console.log(`     archivo → ${destino}`);

  if (previos.length === 0) {
    console.log('     fila    → NUEVA en modulos_materiales');
  } else {
    console.log(`     fila    → REEMPLAZA la #${previos[0].id} ("${previos[0].ruta_archivo}")`);
    if (previos.length > 1) {
      console.log(`     ⚠️  hay ${previos.length - 1} temario(s) duplicado(s); se quitan: #${previos.slice(1).map((p) => p.id).join(', #')}`);
    }
  }

  if (APLICAR) {
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.copyFileSync(completa, destino);

    if (previos.length === 0) {
      await cliente.query(
        `INSERT INTO modulos_materiales (modulo_id, tipo, nombre, ruta_archivo, tamano_bytes)
         VALUES ($1, 'temario', $2, $3, $4)`,
        [modulo.id, nombre, ruta, tamano],
      );
      cargados++;
    } else {
      await cliente.query(
        `UPDATE modulos_materiales
            SET nombre = $1, ruta_archivo = $2, tamano_bytes = $3
          WHERE id = $4`,
        [nombre, ruta, tamano, previos[0].id],
      );
      if (previos.length > 1) {
        await cliente.query(
          'DELETE FROM modulos_materiales WHERE id = ANY($1::int[])',
          [previos.slice(1).map((p) => p.id)],
        );
      }
      reemplazados++;
    }
  }

  conTemario.add(numero);
  console.log('');
}

// ─── Estado final ────────────────────────────────────────────────────────────
const { rows: yaEnBd } = await cliente.query(
  `SELECT m.numero, mm.ruta_archivo
     FROM modulos_materiales mm JOIN modulos m ON m.id = mm.modulo_id
    WHERE mm.tipo = 'temario' ORDER BY m.numero`,
);
for (const r of yaEnBd) conTemario.add(r.numero);

const sinTemario = modulos.map((m) => m.numero).filter((n) => !conTemario.has(n));

// Una fila cuyo archivo no está en disco no da error: el alumno se baja un PDF
// de relleno que dice "material en preparación". Por eso se revisa aquí.
const huerfanos = [];
for (const r of yaEnBd) {
  if (String(r.ruta_archivo).startsWith('s3:')) continue; // vive en el bucket
  if (yaVistos.has(r.numero)) continue; // se acaba de copiar (o se copiaría)
  const abs = path.isAbsolute(r.ruta_archivo)
    ? r.ruta_archivo
    : path.join(STORAGE_DIR, String(r.ruta_archivo).replace(/^\//, ''));
  if (!fs.existsSync(abs)) huerfanos.push({ numero: r.numero, ruta: r.ruta_archivo });
}

console.log('═══════════════════════════════════════════════════════════');
if (APLICAR) {
  console.log(`✅ Temarios cargados: ${cargados} nuevo(s) · ${reemplazados} reemplazado(s).`);
} else {
  const n = yaVistos.size;
  console.log(`👀 Se cargarían ${n} temario(s). NO se escribió nada.`);
  console.log(`   Para aplicarlo:  node lib/db/importar-temarios.mjs ${CARPETA} --aplicar`);
}

const verbo = APLICAR ? 'quedaron' : 'quedarían';
console.log(`\n📚 ${conTemario.size} de ${modulos.length} módulos ${verbo} con temario.`);
if (sinTemario.length === 0) {
  console.log('   ✅ Ninguno se queda sin él.');
} else {
  console.log(`   ✋ Siguen SIN temario ${sinTemario.length}: ${sinTemario.map((n) => `M${n}`).join(', ')}`);
}

if (saltados.length) {
  console.log(`\n⚠️  ${saltados.length} archivo(s) saltado(s):`);
  for (const s of saltados) console.log(`   · ${s.archivo} — ${s.motivo}`);
}

if (huerfanos.length) {
  console.log(`\n⚠️  ${huerfanos.length} módulo(s) tienen fila de temario pero el archivo NO está en disco:`);
  for (const h of huerfanos) console.log(`   · M${h.numero} → "${h.ruta}"`);
  console.log('   El alumno se baja un PDF de relleno sin que nada avise. Vuelve a cargarlos.');
}
console.log('');

await cliente.end();
