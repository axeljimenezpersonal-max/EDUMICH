/**
 * DIAGNÓSTICO DE CORREO (solo lectura).
 *
 * En modo prod, CADA intento de envío deja una fila en la tabla `outbox` con su
 * estado (`enviado` / `fallido`) y, si falló, el `error_message` que devolvió
 * Resend. Este script NO envía nada ni modifica datos: solo hace SELECT y
 * enseña los últimos correos para ver por qué no llegan.
 *
 * Cómo correrlo (en el EC2, DENTRO del contenedor, que ahí vive DATABASE_URL):
 *
 *     docker exec -it modula22 node lib/db/ver-correos.mjs
 *
 * Muestra los últimos 25 correos. Para ver solo los de alumnos:
 *
 *     docker exec -it modula22 node lib/db/ver-correos.mjs cuenta_creada_alumno
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

const filtroEvento = process.argv[2] || null;

const cliente = new pg.Client({ connectionString: leerUrlBd() });
await cliente.connect();

// Resumen por estado (para ver de un vistazo cuántos fallaron).
const { rows: resumen } = await cliente.query(
  `SELECT evento, estado, count(*)::int AS n
     FROM outbox
    ${filtroEvento ? 'WHERE evento = $1' : ''}
    GROUP BY evento, estado
    ORDER BY evento, estado`,
  filtroEvento ? [filtroEvento] : [],
);
console.log('\n── Resumen (evento · estado · cuántos) ─────────────────────');
if (resumen.length === 0) {
  console.log('  (no hay ninguna fila en outbox todavía)');
} else {
  for (const r of resumen) console.log(`  ${r.evento.padEnd(28)} ${r.estado.padEnd(10)} ${r.n}`);
}

// Detalle de los últimos correos, con el error si lo hubo.
const { rows } = await cliente.query(
  `SELECT id, evento, estado, to_email, from_email, error_message, created_at, sent_at
     FROM outbox
    ${filtroEvento ? 'WHERE evento = $1' : ''}
    ORDER BY id DESC
    LIMIT 25`,
  filtroEvento ? [filtroEvento] : [],
);

console.log('\n── Últimos correos (más reciente primero) ──────────────────');
if (rows.length === 0) {
  console.log('  (sin correos registrados)');
}
for (const r of rows) {
  const marca = r.estado === 'fallido' ? '❌' : r.estado === 'enviado' ? '✅' : '·';
  console.log(
    `\n${marca} #${r.id}  ${r.evento}  [${r.estado}]` +
      `\n    para: ${r.to_email}` +
      `\n    de:   ${r.from_email}` +
      `\n    creado: ${r.created_at?.toISOString?.() ?? r.created_at}` +
      (r.error_message ? `\n    ⚠️  ERROR: ${r.error_message}` : ''),
  );
}
console.log('');

await cliente.end();
