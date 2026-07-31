/**
 * SONDEO DE TELÉFONOS (solo lectura).
 *
 * Durante un tiempo el campo de teléfono del portal se comía el prefijo: al
 * escribir, el `52` de `+52` se colaba dentro del número y crecía con cada
 * tecla (`1` → `521` → `525211` → …). Quien capturó en ese lapso pudo guardar
 * un número inservible sin darse cuenta.
 *
 * Este script NO modifica nada: solo hace SELECT y dice cuántos teléfonos hay
 * de cada forma y cuáles están rotos, para decidir con datos si hace falta
 * limpiar y a quién habría que volver a preguntarle su número.
 *
 * SOLO MIRA REGISTROS ACTIVOS. Un alumno dado de baja o una sede apagada no
 * son a quienes hay que llamar, y ensuciarían la cuenta.
 *
 * Cómo correrlo (en el EC2, DENTRO del contenedor, que ahí vive DATABASE_URL):
 *
 *     docker exec -it modula22 node lib/db/ver-telefonos.mjs
 *
 * Con `--listar` enseña además cada número roto con su dueño, para poder
 * corregirlos a mano:
 *
 *     docker exec -it modula22 node lib/db/ver-telefonos.mjs --listar
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

const LISTAR = process.argv.includes('--listar');

/**
 * Mismo criterio que usa el portal, para que el sondeo y la aplicación estén
 * de acuerdo sobre qué es un número bueno.
 */
function diagnosticar(valor) {
  const texto = (valor ?? '').trim();
  if (!texto) return { clase: 'vacio', local: '' };

  const canonico = texto.match(/^\+\s?52[\s.-]?(\d{0,10})$/);
  const local = canonico
    ? canonico[1]
    : (() => {
        const d = texto.replace(/\D/g, '');
        return d.length > 10 && d.startsWith('52') ? d.slice(2) : d;
      })();

  if (local.length !== 10) {
    return { clase: local.length < 10 ? 'incompleto' : 'largo', local };
  }
  // Huella del error: el prefijo se metió al número, así que el número local
  // empieza con 52 y arrastra lo que se tecleó después.
  if (local.startsWith('52')) return { clase: 'sospechoso', local };
  return { clase: texto === `+52 ${local}` ? 'ok' : 'ok_otro_formato', local };
}

const ETIQUETAS = {
  ok: '✅ correcto (+52 NNNNNNNNNN)',
  ok_otro_formato: '· válido, pero con otro formato',
  sospechoso: '⚠️  sospechoso (empieza con 52: posible prefijo comido)',
  incompleto: '❌ incompleto (menos de 10 dígitos)',
  largo: '❌ con dígitos de más',
  vacio: '· sin teléfono',
};

// Cada consulta trae SOLO registros activos.
const FUENTES = [
  {
    nombre: 'Alumnos',
    sql: `SELECT e.user_id AS id, e.nombre_completo AS quien, e.telefono AS tel
            FROM estudiantes e
            JOIN users u ON u.id = e.user_id
           WHERE u.activo = true`,
  },
  {
    nombre: 'Gestores · teléfono',
    sql: `SELECT g.user_id AS id, g.nombre_completo AS quien, g.telefono AS tel
            FROM gestores g
            JOIN users u ON u.id = g.user_id
           WHERE u.activo = true`,
  },
  {
    nombre: 'Gestores · teléfono público',
    sql: `SELECT g.user_id AS id, g.nombre_completo AS quien, g.telefono_publico AS tel
            FROM gestores g
            JOIN users u ON u.id = g.user_id
           WHERE u.activo = true`,
  },
  {
    nombre: 'Administración',
    sql: `SELECT a.user_id AS id, a.nombre_completo AS quien, a.telefono_publico AS tel
            FROM administradores a
            JOIN users u ON u.id = a.user_id
           WHERE u.activo = true`,
  },
  {
    nombre: 'Solicitudes pendientes',
    sql: `SELECT s.id, s.nombre_completo AS quien, s.telefono AS tel
            FROM solicitudes_cuenta s
           WHERE s.estado = 'pendiente'`,
  },
  {
    // Las sedes no se prenden ni se apagan: las que valen las define la
    // convocatoria de cada etapa. Por eso aquí no hay un "activo" que filtrar.
    nombre: 'Sedes',
    sql: `SELECT s.id, s.nombre AS quien, s.telefono AS tel FROM sedes s`,
  },
];

const cliente = new pg.Client({ connectionString: leerUrlBd() });
await cliente.connect();

const rotosGlobal = [];

for (const fuente of FUENTES) {
  let filas;
  try {
    ({ rows: filas } = await cliente.query(fuente.sql));
  } catch (e) {
    // Una columna que no existe en esta base no debe tumbar el sondeo entero.
    console.log(`\n── ${fuente.nombre} ──\n  (no se pudo consultar: ${e.message})`);
    continue;
  }

  const conteo = {};
  const rotos = [];
  for (const f of filas) {
    const { clase, local } = diagnosticar(f.tel);
    conteo[clase] = (conteo[clase] ?? 0) + 1;
    if (clase === 'sospechoso' || clase === 'incompleto' || clase === 'largo') {
      rotos.push({ ...f, clase, local, fuente: fuente.nombre });
    }
  }

  console.log(`\n── ${fuente.nombre} — ${filas.length} activo(s) ──`);
  if (filas.length === 0) {
    console.log('  (sin registros)');
    continue;
  }
  for (const clase of ['ok', 'ok_otro_formato', 'sospechoso', 'incompleto', 'largo', 'vacio']) {
    if (conteo[clase]) console.log(`  ${String(conteo[clase]).padStart(5)}  ${ETIQUETAS[clase]}`);
  }
  rotosGlobal.push(...rotos);
}

console.log('\n═══════════════════════════════════════════════════════════');
if (rotosGlobal.length === 0) {
  console.log('✅ Ningún teléfono roto entre los registros activos.');
} else {
  console.log(`⚠️  ${rotosGlobal.length} teléfono(s) que habría que corregir.`);
  const sospechosos = rotosGlobal.filter((r) => r.clase === 'sospechoso').length;
  if (sospechosos) {
    console.log(`   ${sospechosos} traen la huella del prefijo comido (empiezan con 52).`);
  }
  console.log(
    rotosGlobal.length && !LISTAR
      ? '\n   Vuelve a correrlo con --listar para ver quiénes son.'
      : '',
  );
  if (LISTAR) {
    console.log('');
    for (const r of rotosGlobal) {
      console.log(`  [${r.fuente}] #${r.id}  ${r.quien}`);
      console.log(`      guardado: "${r.tel}"   →   local: "${r.local}"  (${r.clase})`);
    }
    console.log(
      '\n  Ninguno se puede arreglar solo: no hay forma de saber qué dígitos\n' +
      '  quiso teclear la persona. Hay que volver a preguntarle el número.',
    );
  }
}
console.log('');

await cliente.end();
