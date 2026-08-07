/**
 * CAMBIAR EL PRECIO DEL EXAMEN en la base.
 *
 * El código ya toma el precio de `artifacts/api-server/src/config/precioExamen.ts`.
 * Este script sincroniza lo que vive en la BASE y que el código no controla:
 *
 *   · `conceptos_pago.derecho_examen` — el monto que la plataforma muestra y
 *     con el que nacen las fichas nuevas.
 *   · Las preguntas frecuentes, que dicen el precio con letra ("131 pesos").
 *     Si no se actualizan, el alumno lee un monto en la FAQ y paga otro.
 *
 * Cómo correrlo (en el EC2, DENTRO del contenedor):
 *
 *     docker exec -it modula22 node lib/db/precio-examen.mjs            # simula
 *     docker exec -it modula22 node lib/db/precio-examen.mjs --aplicar
 *
 * ── LO QUE ESTE SCRIPT NO HACE, A PROPÓSITO ─────────────────────────────────
 *
 * NO toca las fichas ya emitidas. Regla del producto (CLAUDE.md): un cambio de
 * precio aplica sólo a fichas NUEVAS. Una línea de captura ya generada trae su
 * importe impreso y el banco va a cobrar ése; recalcularla dejaría a la
 * plataforma diciendo un número y al comprobante otro.
 *
 * ── AGOSTO 2026 ─────────────────────────────────────────────────────────────
 *
 * El precio baja de $131 a $101: la parte de Synapsis queda en pausa hasta que
 * la Tesorería permita modificar la tarifa. Para revertirlo, pon
 * `PARTE_SYNAPSIS = 30` en precioExamen.ts, vuelve a correr esto y redespliega.
 */
import pg from 'pg';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..', '..');
const APLICAR = process.argv.includes('--aplicar');

/**
 * El precio vigente, leído del MISMO archivo que usa el servidor.
 *
 * Se lee con una expresión regular en vez de importarlo porque este script es
 * `.mjs` y aquel es TypeScript sin compilar a una ruta estable. Que salga de
 * ahí —y no de un número escrito aquí— es lo que impide que el script y la
 * aplicación cobren cosas distintas.
 */
function precioDelCodigo() {
  const archivo = path.join(RAIZ, 'artifacts', 'api-server', 'src', 'config', 'precioExamen.ts');
  const src = readFileSync(archivo, 'utf8');
  const iemsys = Number(/PARTE_IEMSYS\s*=\s*(\d+)/.exec(src)?.[1]);
  const synapsis = Number(/PARTE_SYNAPSIS\s*=\s*(\d+)/.exec(src)?.[1]);
  if (!Number.isFinite(iemsys) || !Number.isFinite(synapsis)) {
    console.error('✋ No pude leer el precio de precioExamen.ts. No se toca nada.');
    process.exit(1);
  }
  return { iemsys, synapsis, total: iemsys + synapsis };
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

const P = precioDelCodigo();
const cliente = new pg.Client({ connectionString: leerUrlBd(), ssl: { rejectUnauthorized: false } });
await cliente.connect();

try {
  const { rows: [concepto] } = await cliente.query(
    `SELECT monto::float AS monto FROM conceptos_pago WHERE clave = 'derecho_examen' AND activo = true`);
  const actual = concepto?.monto ?? null;

  const { rows: faqs } = await cliente.query(
    `SELECT id, pregunta, respuesta FROM preguntas_frecuentes
      WHERE respuesta ~ '[0-9]+ pesos' ORDER BY id`);
  const desactualizadas = faqs.filter((f) => !f.respuesta.includes(`${P.total} pesos`));

  const { rows: [fichas] } = await cliente.query(
    `SELECT count(*)::int AS n FROM pagos_examen WHERE estado <> 'cancelado'`);

  console.log(`\n══ PRECIO DEL EXAMEN ${APLICAR ? '— APLICANDO' : '— SIMULACIÓN (no escribe nada)'} ══\n`);
  console.log(`  En el código:  $${P.total}  (IEMSyS $${P.iemsys} + Synapsis $${P.synapsis})`);
  console.log(`  En la base:    ${actual === null ? '(no existe el concepto)' : `$${actual}`}`);
  if (P.synapsis === 0) console.log('  ⚠ La parte de Synapsis está EN PAUSA (ver precioExamen.ts).');
  console.log('');
  if (actual === P.total) console.log('  · El concepto ya está en el precio correcto.');
  else console.log(`  · Se actualiza el concepto: $${actual ?? '—'} → $${P.total}`);
  console.log(`  · Preguntas frecuentes con precio: ${faqs.length}, de las cuales ${desactualizadas.length} hay que corregir.`);
  for (const f of desactualizadas) console.log(`      #${f.id} ${f.pregunta}`);
  console.log(`\n  · Fichas existentes: ${fichas.n}. NO se tocan — conservan su importe (regla del producto).\n`);

  if (!APLICAR) {
    console.log('[SIMULACIÓN] Nada se escribió. Corre con --aplicar para hacerlo.\n');
    await cliente.end();
    process.exit(0);
  }

  await cliente.query('BEGIN');
  const c = await cliente.query(
    `UPDATE conceptos_pago SET monto = $1 WHERE clave = 'derecho_examen'`, [P.total.toFixed(2)]);
  // El precio escrito con letra en las FAQ. Se reemplaza cualquier "N pesos"
  // por el vigente: así una FAQ escrita en la época de $145 también se corrige.
  const f = await cliente.query(
    `UPDATE preguntas_frecuentes
        SET respuesta = regexp_replace(respuesta, '[0-9]+ pesos', $1, 'g')
      WHERE respuesta ~ '[0-9]+ pesos' AND respuesta !~ ($2 || ' pesos')`,
    [`${P.total} pesos`, String(P.total)]);
  // La nota en el panel del creador. Se pega SOLA porque este pendiente no
  // vive en el código —ahí ya está documentado— sino en el calendario de una
  // persona: hay que volver a subir el precio cuando la Tesorería lo permita, y
  // nadie va a leer un comentario de TypeScript para acordarse.
  let notas = 0;
  if (P.synapsis === 0) {
    const contenido = [
      'PENDIENTE · Volver a cobrar los $30 de Synapsis',
      '',
      `Hoy el examen cuesta $${P.total} (todo al IEMSyS). La parte de la`,
      'plataforma esta en PAUSA porque el precio ante la Tesoreria no se podia',
      'cambiar todavia.',
      '',
      'Cuando se pueda, son tres pasos:',
      '  1. PARTE_SYNAPSIS = 30 en artifacts/api-server/src/config/precioExamen.ts',
      '  2. docker exec -it modula22 node lib/db/precio-examen.mjs --aplicar',
      '  3. Redesplegar',
      '',
      'Las fichas ya emitidas NO cambian de precio: conservan el suyo.',
    ].join('\n');
    const { rows: creadores } = await cliente.query(
      `SELECT id FROM users WHERE rol = 'direccion' AND activo = true`);
    for (const u of creadores) {
      // Idempotente: si ya existe la nota de este pendiente, no se duplica.
      const r = await cliente.query(
        `INSERT INTO notas_creador (user_id, contenido, color)
         SELECT $1, $2, 'guinda'
          WHERE NOT EXISTS (
            SELECT 1 FROM notas_creador
             WHERE user_id = $1 AND contenido LIKE 'PENDIENTE · Volver a cobrar%')`,
        [u.id, contenido]);
      notas += r.rowCount ?? 0;
    }
  }

  await cliente.query('COMMIT');

  console.log(`Listo: concepto actualizado (${c.rowCount} fila) y ${f.rowCount} pregunta(s) frecuente(s) corregida(s).`);
  if (notas > 0) console.log(`Nota pegada en el panel del creador (${notas}) para no olvidar reactivar los $30.`);
  console.log('Reinicia el contenedor para que el cambio se vea en todas las pantallas:\n  docker restart modula22\n');
} catch (e) {
  await cliente.query('ROLLBACK').catch(() => {});
  console.error('\n✋ Falló y se revirtió todo:\n', e);
  process.exitCode = 1;
} finally {
  await cliente.end();
}
