/**
 * Crea las CUENTAS DE GESTOR de los centros de asesoría a partir de
 * `lib/db/datos/centros-asesoria.csv`.
 *
 * No confundir con `importar-centros.mjs`: ese carga el PADRÓN (la lista
 * maestra que entregó la coordinación, donde un centro puede existir sin tener
 * cuenta). Éste da el paso siguiente: convertir esas filas en cuentas con las
 * que el centro entra a la plataforma.
 *
 * Cómo correrlo (en el EC2, DENTRO del contenedor):
 *
 *     docker exec -it modula22 node lib/db/crear-cuentas-centros.mjs --simular
 *     docker exec -it modula22 node lib/db/crear-cuentas-centros.mjs
 *
 * Corre SIEMPRE `--simular` primero: imprime exactamente lo que haría sin
 * escribir una sola fila.
 *
 * ── Dos cosas que este script NO hace, a propósito ──────────────────────────
 *
 * 1. NO manda ningún correo. El correo de acceso que se crea aquí es
 *    institucional (`caed.morelia@modula22.mx`) y NO tiene buzón detrás: mandar
 *    ahí la contraseña temporal sería tirarla al vacío. El camino correcto es
 *    capturar después el «correo de contacto» de cada centro en Accesos y
 *    entonces darle a «Reenviar primer acceso», que genera una contraseña nueva
 *    y la entrega al buzón que sí recibe.
 *
 * 2. NO inventa datos. Una fila sin municipio o sin correo de acceso se salta y
 *    se reporta. El municipio decide en qué sede aparece el centro; adivinarlo
 *    es meter un dato falso al padrón de un estado.
 *
 * Es idempotente: si el correo de acceso ya existe, no toca nada y lo reporta
 * como omitido. Se puede correr las veces que haga falta.
 */
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

const SIMULAR = process.argv.includes('--simular');
const RAIZ = path.resolve(import.meta.dirname, '..', '..');
const CSV = process.argv.find((a) => a.endsWith('.csv'))
  ?? path.join(RAIZ, 'lib', 'db', 'datos', 'centros-asesoria.csv');

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

/** Para comparar municipios sin que un acento decida si el centro existe. */
const plano = (t) => (t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

// CSV simple (sin comas dentro de los campos, como el archivo fuente).
const lineas = fs.readFileSync(CSV, 'utf8').split(/\r?\n/).filter((l) => l.trim());
const cols = lineas[0].split(',').map((c) => c.trim());
const idx = (n) => cols.indexOf(n);
const iCentro = idx('centro'), iRfc = idx('rfc'), iMuni = idx('municipio_inferido');
const iCorreo = idx('correo_acceso'), iContacto = idx('contacto');
if (iCentro === -1 || iCorreo === -1) {
  console.error('✋ El CSV necesita al menos las columnas "centro" y "correo_acceso".');
  process.exit(1);
}

const filas = [];
const saltadas = [];
for (let i = 1; i < lineas.length; i++) {
  const p = lineas[i].split(',');
  const centro = (p[iCentro] ?? '').trim();
  const correo = (p[iCorreo] ?? '').trim().toLowerCase();
  const municipio = (iMuni !== -1 ? (p[iMuni] ?? '').trim() : '');
  if (!centro) { saltadas.push({ centro: '(fila sin nombre de centro)', razon: 'fila incompleta' }); continue; }
  if (!correo) { saltadas.push({ centro, razon: 'sin correo_acceso en el CSV' }); continue; }
  if (!municipio) { saltadas.push({ centro, razon: 'sin municipio: no se puede asignar sede' }); continue; }
  filas.push({
    centro,
    correo,
    municipio,
    rfc: (iRfc !== -1 ? (p[iRfc] ?? '').trim() : '') || null,
    contacto: (iContacto !== -1 ? (p[iContacto] ?? '').trim() : '') || null,
  });
}

const cliente = new pg.Client({ connectionString: leerUrlBd() });
await cliente.connect();

// Catálogo de municipios, indexado sin acentos.
const { rows: munis } = await cliente.query('SELECT id, nombre FROM municipios');
const porNombre = new Map(munis.map((m) => [plano(m.nombre), m]));

const creados = [];
const omitidos = [];
const errores = [];

for (const f of filas) {
  const muni = porNombre.get(plano(f.municipio));
  if (!muni) {
    errores.push({ ...f, razon: `el municipio "${f.municipio}" no está en el catálogo` });
    continue;
  }

  const { rows: yaExiste } = await cliente.query(
    'SELECT id FROM users WHERE lower(email) = $1', [f.correo],
  );
  if (yaExiste.length) {
    omitidos.push({ ...f, razon: 'ese correo de acceso ya tiene cuenta' });
    continue;
  }

  if (SIMULAR) { creados.push({ ...f, municipioNombre: muni.nombre, userId: '(simulado)' }); continue; }

  // Contraseña inservible a propósito: nadie la conoce y nadie la va a usar.
  // El acceso real se entrega con «Reenviar primer acceso» una vez que el
  // centro tenga su correo de contacto capturado.
  const hash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);

  try {
    await cliente.query('BEGIN');
    const { rows: [user] } = await cliente.query(
      `INSERT INTO users (email, password_hash, rol, activo, password_temporal)
       VALUES ($1, $2, 'gestor', true, true) RETURNING id`,
      [f.correo, hash],
    );
    await cliente.query(
      `INSERT INTO gestores (user_id, nombre_completo, municipio_id, capacidad_maxima,
                             estado, centro_asesoria, rfc_centro)
       VALUES ($1, $2, $3, 50, 'activo', $4, $5)`,
      [user.id, f.centro, muni.id, f.centro, f.rfc],
    );
    await cliente.query('COMMIT');
    creados.push({ ...f, municipioNombre: muni.nombre, userId: user.id });
  } catch (e) {
    await cliente.query('ROLLBACK');
    errores.push({ ...f, razon: e.message });
  }
}

await cliente.end();

// ── Reporte ───────────────────────────────────────────────────────────────
const linea = (t) => console.log(t);
linea('');
linea(SIMULAR ? '── SIMULACIÓN (no se escribió nada) ──' : '── CUENTAS CREADAS ──');
linea('');
if (creados.length) {
  for (const c of creados) linea(`  ✓ ${c.centro}\n      ${c.correo}  ·  ${c.municipioNombre}`);
} else {
  linea('  (ninguna)');
}

if (omitidos.length) {
  linea('');
  linea('── YA EXISTÍAN (no se tocaron) ──');
  for (const o of omitidos) linea(`  – ${o.centro}: ${o.razon}`);
}

if (saltadas.length) {
  linea('');
  linea('── SALTADAS POR FALTA DE DATOS (hay que completarlas en el CSV) ──');
  for (const s of saltadas) linea(`  ! ${s.centro}: ${s.razon}`);
}

if (errores.length) {
  linea('');
  linea('── ERRORES ──');
  for (const e of errores) linea(`  ✗ ${e.centro}: ${e.razon}`);
}

linea('');
linea(`Resumen: ${creados.length} creadas · ${omitidos.length} ya existían · ${saltadas.length} sin datos · ${errores.length} con error`);
if (!SIMULAR && creados.length) {
  linea('');
  linea('SIGUIENTE PASO: ninguna de estas cuentas puede entrar todavía.');
  linea('En Accesos, captura el «correo de contacto» de cada centro y dale a');
  linea('«Reenviar primer acceso»: ahí se genera la contraseña y se entrega al');
  linea('buzón que sí recibe.');
}
linea('');
