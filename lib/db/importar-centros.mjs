/**
 * Carga el PADRÓN DE CENTROS DE ASESORÍA desde `docs/datos/centros-asesoria.csv`
 * a la tabla `centros_padron`. Es la lista maestra que entregó la coordinación:
 * un centro puede estar aquí sin tener todavía cuenta de gestor.
 *
 * Cómo correrlo (en el EC2, DENTRO del contenedor):
 *
 *     docker exec -it modula22 node lib/db/importar-centros.mjs
 *
 * Es idempotente y CONSERVADOR: inserta los que faltan y, en los que ya existen,
 * solo rellena campos vacíos. Nunca pisa ediciones hechas desde el panel ni
 * cambia la bandera `activo`.
 */
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..', '..');
// El CSV vive en lib/db/datos porque ESA carpeta sí viaja en la imagen de
// Docker (el Dockerfile no copia docs/). Se admite ruta por argumento.
const CANDIDATOS = [
  process.argv[2],
  path.join(RAIZ, 'lib', 'db', 'datos', 'centros-asesoria.csv'),
  path.join(RAIZ, 'docs', 'datos', 'centros-asesoria.csv'),
].filter(Boolean);
const CSV = CANDIDATOS.find((c) => fs.existsSync(c)) ?? CANDIDATOS[CANDIDATOS.length - 1];

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

if (!fs.existsSync(CSV)) { console.error(`✋ No encontré el archivo: ${CSV}`); process.exit(1); }

// CSV simple (sin comillas ni comas dentro de los campos, como el archivo fuente).
const lineas = fs.readFileSync(CSV, 'utf8').split(/\r?\n/).filter((l) => l.trim());
const cols = lineas[0].split(',').map((c) => c.trim());
const idx = (n) => cols.indexOf(n);
const iCentro = idx('centro'), iRfc = idx('rfc'), iContacto = idx('contacto');
const iMuni = idx('municipio_inferido'), iRevisar = idx('revisar');
if (iCentro === -1) { console.error('✋ Falta la columna "centro".'); process.exit(1); }

const filas = [];
for (let i = 1; i < lineas.length; i++) {
  const p = lineas[i].split(',');
  const centro = (p[iCentro] ?? '').trim();
  if (!centro) continue; // la fila sin centro (solo contacto) no se puede cargar
  filas.push({
    centro,
    rfc: (p[iRfc] ?? '').trim() || null,
    contacto: (p[iContacto] ?? '').trim() || null,
    municipio: (iMuni !== -1 ? (p[iMuni] ?? '').trim() : '') || null,
    notas: (iRevisar !== -1 ? (p[iRevisar] ?? '').trim() : '') || null,
  });
}

console.log(`Centros a cargar: ${filas.length}`);

const cliente = new pg.Client({ connectionString: leerUrlBd() });
await cliente.connect();

let nuevos = 0;
let completados = 0;
for (const f of filas) {
  const r = await cliente.query(
    `INSERT INTO centros_padron (centro, rfc, contacto, municipio, notas)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (centro) DO UPDATE SET
       rfc       = COALESCE(centros_padron.rfc,       EXCLUDED.rfc),
       contacto  = COALESCE(centros_padron.contacto,  EXCLUDED.contacto),
       municipio = COALESCE(centros_padron.municipio, EXCLUDED.municipio),
       notas     = COALESCE(centros_padron.notas,     EXCLUDED.notas),
       updated_at = now()
     RETURNING (xmax = 0) AS insertado`,
    [f.centro, f.rfc, f.contacto, f.municipio, f.notas],
  );
  if (r.rows[0]?.insertado) nuevos++; else completados++;
}

const { rows: [tot] } = await cliente.query(
  `SELECT count(*)::int AS n,
          count(*) FILTER (WHERE activo)::int AS activos,
          count(*) FILTER (WHERE rfc IS NULL)::int AS sin_rfc,
          count(*) FILTER (WHERE contacto IS NULL)::int AS sin_contacto
     FROM centros_padron`,
);
console.log(`\n✅ Listo. Nuevos: ${nuevos} · ya existían: ${completados}.`);
console.log(`   Total en padrón: ${tot.n} (activos ${tot.activos}) · sin RFC: ${tot.sin_rfc} · sin contacto: ${tot.sin_contacto}`);
await cliente.end();
