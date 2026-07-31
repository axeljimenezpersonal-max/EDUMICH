/**
 * EMPAREJAR EL FORMATO DE LOS TELÉFONOS.
 *
 * La regla del sistema es que todo teléfono se guarda como `+52 NNNNNNNNNN`.
 * Los que se capturaron antes de esa regla siguen ahí con otra forma
 * (`4431234567`, `443-123-4567`, `+524431234567`…). Son números BUENOS: solo
 * están escritos distinto, y eso hace que las búsquedas exactas fallen.
 *
 * Este script SOLO cambia el formato. Nunca inventa ni completa un número:
 * si no tiene diez dígitos reconocibles, lo deja intacto y lo reporta. Un
 * teléfono a medias es un dato que hay que volver a pedir, no que rellenar.
 *
 * Por omisión NO escribe nada: enseña lo que haría y se sale. Para aplicarlo
 * hay que pedirlo explícitamente.
 *
 *     docker exec -it modula22 node lib/db/normalizar-telefonos.mjs             # ensayo
 *     docker exec -it modula22 node lib/db/normalizar-telefonos.mjs --aplicar   # de verdad
 *
 * Corre `ver-telefonos.mjs` antes y después para comparar.
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

/** Mismo criterio que el portal y la API. Devuelve null si no es aprovechable. */
function canonico(valor) {
  const texto = (valor ?? '').trim();
  if (!texto) return null;
  const yaCanonico = texto.match(/^\+\s?52[\s.-]?(\d{10})$/);
  if (yaCanonico) return `+52 ${yaCanonico[1]}`;
  const d = texto.replace(/\D/g, '');
  const local = d.length > 10 && d.startsWith('52') ? d.slice(2) : d;
  if (local.length !== 10) return null; // incompleto: no se inventa
  return `+52 ${local}`;
}

// Solo registros activos: a quien está de baja no hay que llamarle.
const FUENTES = [
  {
    nombre: 'Alumnos',
    tabla: 'estudiantes',
    columna: 'telefono',
    llave: 'user_id',
    sql: `SELECT e.user_id AS id, e.nombre_completo AS quien, e.telefono AS tel
            FROM estudiantes e JOIN users u ON u.id = e.user_id
           WHERE u.activo = true AND e.telefono IS NOT NULL AND e.telefono <> ''`,
  },
  {
    nombre: 'Gestores · teléfono',
    tabla: 'gestores',
    columna: 'telefono',
    llave: 'user_id',
    sql: `SELECT g.user_id AS id, g.nombre_completo AS quien, g.telefono AS tel
            FROM gestores g JOIN users u ON u.id = g.user_id
           WHERE u.activo = true AND g.telefono IS NOT NULL AND g.telefono <> ''`,
  },
  {
    nombre: 'Gestores · teléfono público',
    tabla: 'gestores',
    columna: 'telefono_publico',
    llave: 'user_id',
    sql: `SELECT g.user_id AS id, g.nombre_completo AS quien, g.telefono_publico AS tel
            FROM gestores g JOIN users u ON u.id = g.user_id
           WHERE u.activo = true AND g.telefono_publico IS NOT NULL AND g.telefono_publico <> ''`,
  },
  {
    nombre: 'Administración',
    tabla: 'administradores',
    columna: 'telefono_publico',
    llave: 'user_id',
    sql: `SELECT a.user_id AS id, a.nombre_completo AS quien, a.telefono_publico AS tel
            FROM administradores a JOIN users u ON u.id = a.user_id
           WHERE u.activo = true AND a.telefono_publico IS NOT NULL AND a.telefono_publico <> ''`,
  },
  {
    nombre: 'Sedes',
    tabla: 'sedes',
    columna: 'telefono',
    llave: 'id',
    sql: `SELECT s.id, s.nombre AS quien, s.telefono AS tel
            FROM sedes s WHERE s.telefono IS NOT NULL AND s.telefono <> ''`,
  },
];

const cliente = new pg.Client({ connectionString: leerUrlBd() });
await cliente.connect();

console.log(APLICAR ? '\n⚙️  MODO APLICAR: se van a escribir cambios.\n' : '\n👀 ENSAYO: no se escribe nada.\n');

let porCambiar = 0;
let cambiados = 0;
const intocables = [];

for (const f of FUENTES) {
  let filas;
  try {
    ({ rows: filas } = await cliente.query(f.sql));
  } catch (e) {
    console.log(`── ${f.nombre} ──\n  (no se pudo consultar: ${e.message})\n`);
    continue;
  }

  const pendientes = [];
  for (const fila of filas) {
    const nuevo = canonico(fila.tel);
    if (!nuevo) { intocables.push({ ...fila, fuente: f.nombre }); continue; }
    if (nuevo === fila.tel) continue; // ya está bien
    pendientes.push({ ...fila, nuevo });
  }

  console.log(`── ${f.nombre} — ${filas.length} con teléfono ──`);
  if (pendientes.length === 0) {
    console.log('  ✅ Todos ya están en el formato correcto.\n');
    continue;
  }
  porCambiar += pendientes.length;
  for (const p of pendientes) {
    console.log(`  #${p.id}  ${p.quien}`);
    console.log(`      "${p.tel}"  →  "${p.nuevo}"`);
    if (APLICAR) {
      await cliente.query(
        `UPDATE ${f.tabla} SET ${f.columna} = $1 WHERE ${f.llave} = $2`,
        [p.nuevo, p.id],
      );
      cambiados++;
    }
  }
  console.log('');
}

console.log('═══════════════════════════════════════════════════════════');
if (porCambiar === 0) {
  console.log('✅ No hay nada que emparejar: todos los teléfonos ya están igual.');
} else if (APLICAR) {
  console.log(`✅ ${cambiados} teléfono(s) emparejados al formato "+52 NNNNNNNNNN".`);
} else {
  console.log(`👀 ${porCambiar} teléfono(s) se emparejarían. NO se escribió nada.`);
  console.log('   Para aplicarlo:  node lib/db/normalizar-telefonos.mjs --aplicar');
}

if (intocables.length) {
  console.log(`\n⚠️  ${intocables.length} sin diez dígitos reconocibles. NO se tocan:`);
  for (const i of intocables) console.log(`  [${i.fuente}] #${i.id}  ${i.quien}  →  "${i.tel}"`);
  console.log('   Estos hay que volver a preguntarlos: completarlos sería inventar.');
}
console.log('');

await cliente.end();
