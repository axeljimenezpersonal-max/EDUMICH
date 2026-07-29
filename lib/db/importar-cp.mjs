/**
 * Importa el catálogo de CÓDIGOS POSTALES de SEPOMEX (solo Michoacán) a la tabla
 * `codigos_postales`. Sirve para autollenar estado/municipio y ofrecer la colonia
 * como lista al capturar un domicilio.
 *
 * Fuente oficial (Correos de México, datos abiertos): archivo pipe-delimitado,
 * codificación ISO-8859-1. No son datos personales: es un catálogo público.
 *
 * Cómo correrlo (en el EC2, DENTRO del contenedor, que ahí existe la CA de RDS
 * y la variable DATABASE_URL):
 *
 *     docker exec -it modula22 node lib/db/importar-cp.mjs
 *
 * Es idempotente: se puede volver a correr (ON CONFLICT DO NOTHING). Para cargar
 * OTRO estado o el país completo, pásalo por variable: CP_ESTADO="" (vacío = todos)
 * o CP_ESTADO="Jalisco". Por defecto: Michoacán.
 */
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';

const URL_OFICIAL = 'https://www.correosdemexico.gob.mx/datosabiertos/cp/cpdescarga.txt';
const FUENTE = process.env.CP_URL || process.argv[2] || URL_OFICIAL;
// Filtro por estado (coincidencia parcial, sin acentos). Vacío = todos.
const FILTRO_ESTADO = process.env.CP_ESTADO ?? 'michoac';

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

function sinAcentos(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

console.log(`Descargando catálogo de CP desde: ${FUENTE}`);
const resp = await fetch(FUENTE);
if (!resp.ok) {
  console.error(`✋ No se pudo descargar (HTTP ${resp.status}). Revisa la conexión del servidor.`);
  process.exit(1);
}
// El archivo oficial viene en ISO-8859-1 (latin1): así se leen bien los acentos.
const buf = Buffer.from(await resp.arrayBuffer());
const texto = new TextDecoder('latin1').decode(buf);
const lineas = texto.split(/\r?\n/);

// Localizar la fila de ENCABEZADOS (la que trae d_codigo) y mapear columnas por
// nombre, para no depender del orden exacto.
let idxHeader = lineas.findIndex((l) => /(^|\|)\s*d_codigo\s*(\||$)/i.test(l));
if (idxHeader === -1) {
  // Algunos mirrors no traen el comentario inicial: probar la primera línea.
  idxHeader = /d_codigo/i.test(lineas[0]) ? 0 : -1;
}
if (idxHeader === -1) { console.error('✋ No reconocí el formato del archivo (falta d_codigo).'); process.exit(1); }

const cols = lineas[idxHeader].split('|').map((c) => c.trim().toLowerCase());
const col = (nombre) => cols.indexOf(nombre);
const iCp = col('d_codigo');
const iColonia = col('d_asenta');
const iMun = col('d_mnpio');
const iEstado = col('d_estado');
const iCiudad = col('d_ciudad');
if (iCp === -1 || iColonia === -1 || iEstado === -1) {
  console.error('✋ Faltan columnas esperadas (d_codigo/d_asenta/d_estado).');
  process.exit(1);
}

const filas = [];
const vistos = new Set();
for (let i = idxHeader + 1; i < lineas.length; i++) {
  const l = lineas[i];
  if (!l || l.indexOf('|') === -1) continue;
  const p = l.split('|');
  const estado = (p[iEstado] || '').trim();
  if (FILTRO_ESTADO && !sinAcentos(estado).includes(sinAcentos(FILTRO_ESTADO))) continue;
  const cp = (p[iCp] || '').trim();
  const colonia = (p[iColonia] || '').trim();
  if (!/^\d{5}$/.test(cp) || !colonia) continue;
  const clave = `${cp}|${colonia}`;
  if (vistos.has(clave)) continue;
  vistos.add(clave);
  filas.push({
    cp,
    colonia: colonia.slice(0, 200),
    municipio: (iMun !== -1 ? (p[iMun] || '').trim() : '').slice(0, 150) || null,
    ciudad: (iCiudad !== -1 ? (p[iCiudad] || '').trim() : '').slice(0, 150) || null,
    estado: estado.slice(0, 100),
  });
}

console.log(`Filas a importar (${FILTRO_ESTADO || 'todos los estados'}): ${filas.length}`);
if (filas.length === 0) { console.error('✋ 0 filas tras el filtro. ¿El estado se llama distinto?'); process.exit(1); }

const cliente = new pg.Client({ connectionString: leerUrlBd() });
await cliente.connect();
console.log(`Conectado a ${leerUrlBd().replace(/^.*@/, '').split(/[:/?]/)[0]}`);

let insertadas = 0;
const LOTE = 500;
for (let i = 0; i < filas.length; i += LOTE) {
  const trozo = filas.slice(i, i + LOTE);
  const vals = [];
  const params = [];
  trozo.forEach((f, k) => {
    const b = k * 5;
    vals.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5})`);
    params.push(f.cp, f.colonia, f.municipio, f.ciudad, f.estado);
  });
  const r = await cliente.query(
    `INSERT INTO codigos_postales (cp, colonia, municipio, ciudad, estado)
     VALUES ${vals.join(',')}
     ON CONFLICT (cp, colonia) DO NOTHING`,
    params,
  );
  insertadas += r.rowCount ?? 0;
  process.stdout.write(`\r  ${Math.min(i + LOTE, filas.length)}/${filas.length}…`);
}

const { rows: [tot] } = await cliente.query('SELECT count(*)::int AS n, count(distinct cp)::int AS cps FROM codigos_postales');
console.log(`\n✅ Listo. Nuevas: ${insertadas}. Total en tabla: ${tot.n} colonias en ${tot.cps} CP.`);
await cliente.end();
