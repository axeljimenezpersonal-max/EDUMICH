/**
 * CALENDARIO OFICIAL — 3er cuatrimestre 2026 (septiembre a diciembre).
 *
 * Carga las 7 etapas del calendario de exámenes ordinarios del Plan Modular
 * publicado por la DGB (2609-A a 2612-A; la 2612-B dice "NO APLICA" en el
 * documento y por eso no existe aquí), con la ventana de solicitud, las dos
 * fechas de examen y el horario de CADA uno de los 22 módulos.
 *
 * Fuente: "Calendario Exámenes Ordinarios · Plan Modular · 2026
 * septiembre–diciembre" (PDF oficial, entregado el 2026-08-06). Los datos de
 * abajo son transcripción de ese documento, no invención: si algo no cuadra,
 * lo que manda es el PDF.
 *
 * Cómo correrlo (en el EC2, DENTRO del contenedor):
 *
 *     docker exec -it modula22 node lib/db/cargar-calendario-2026-3er.mjs            # simula
 *     docker exec -it modula22 node lib/db/cargar-calendario-2026-3er.mjs --aplicar
 *
 * Es idempotente: la etapa se identifica por su clave (2609-A...) y correrlo
 * dos veces actualiza en vez de duplicar.
 *
 * ── Las sedes ───────────────────────────────────────────────────────────────
 * Las sedes las define la convocatoria (regla del producto), y este documento
 * no trae sedes: son decisión del estado. Se COPIAN de la etapa más reciente
 * que tenga, y la simulación dice cuáles son — se ajustan después en
 * Convocatorias como siempre.
 *
 * ── El patrón de horarios ───────────────────────────────────────────────────
 * En el documento, cada módulo tiene un lugar fijo en las etapas de fase A, y
 * en las de fase B ocupa el espejo exacto (día contrario, hora contraria).
 * Se transcribió la fase A completa y la B se deriva, que es como el propio
 * calendario está construido.
 */
import pg from 'pg';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..', '..');
const APLICAR = process.argv.includes('--aplicar');

/** Las 7 etapas del documento. Fechas tal cual el PDF (año 2026). */
const ETAPAS = [
  { clave: '2609-A', etapa: '2609', fase: 'A', solicitudInicio: '2026-08-10', solicitudFin: '2026-08-14', examenSabado: '2026-09-05', examenDomingo: '2026-09-06' },
  { clave: '2609-B', etapa: '2609', fase: 'B', solicitudInicio: '2026-08-24', solicitudFin: '2026-08-28', examenSabado: '2026-09-19', examenDomingo: '2026-09-20' },
  { clave: '2610-A', etapa: '2610', fase: 'A', solicitudInicio: '2026-09-07', solicitudFin: '2026-09-11', examenSabado: '2026-10-03', examenDomingo: '2026-10-04' },
  { clave: '2610-B', etapa: '2610', fase: 'B', solicitudInicio: '2026-09-21', solicitudFin: '2026-09-25', examenSabado: '2026-10-17', examenDomingo: '2026-10-18' },
  { clave: '2611-A', etapa: '2611', fase: 'A', solicitudInicio: '2026-10-12', solicitudFin: '2026-10-16', examenSabado: '2026-11-07', examenDomingo: '2026-11-08' },
  { clave: '2611-B', etapa: '2611', fase: 'B', solicitudInicio: '2026-10-26', solicitudFin: '2026-10-30', examenSabado: '2026-11-21', examenDomingo: '2026-11-22' },
  { clave: '2612-A', etapa: '2612', fase: 'A', solicitudInicio: '2026-11-09', solicitudFin: '2026-11-13', examenSabado: '2026-12-05', examenDomingo: '2026-12-06' },
];

/**
 * Horario de cada módulo en las etapas de FASE A, transcrito del PDF.
 * En fase B es el espejo: día contrario y hora contraria.
 */
const FASE_A = {
  1:  ['domingo', '13:30'],
  2:  ['sabado',  '13:30'],
  3:  ['domingo', '10:00'],
  4:  ['sabado',  '10:00'],
  5:  ['domingo', '10:00'],
  6:  ['sabado',  '13:30'],
  7:  ['domingo', '13:30'],
  8:  ['sabado',  '10:00'],
  9:  ['sabado',  '10:00'],
  10: ['domingo', '13:30'],
  11: ['sabado',  '13:30'],
  12: ['domingo', '10:00'],
  13: ['sabado',  '10:00'],
  14: ['domingo', '13:30'],
  15: ['sabado',  '13:30'],
  16: ['domingo', '10:00'],
  17: ['domingo', '13:30'],
  18: ['domingo', '10:00'],
  19: ['sabado',  '13:30'],
  20: ['domingo', '13:30'],
  21: ['sabado',  '10:00'],
  22: ['sabado',  '13:30'],
};

function espejo([dia, hora]) {
  return [dia === 'sabado' ? 'domingo' : 'sabado', hora === '10:00' ? '13:30' : '10:00'];
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

const cliente = new pg.Client({ connectionString: leerUrlBd(), ssl: { rejectUnauthorized: false } });
await cliente.connect();

try {
  // Los 22 módulos, por número.
  const { rows: mods } = await cliente.query('SELECT id, numero, nombre FROM modulos ORDER BY numero');
  const porNumero = new Map(mods.map((m) => [m.numero, m]));
  const faltan = Object.keys(FASE_A).filter((n) => !porNumero.has(Number(n)));
  if (faltan.length > 0) {
    console.error(`✋ Faltan módulos en el catálogo: ${faltan.join(', ')}. No se carga nada.`);
    process.exit(1);
  }

  // Sedes de referencia: las de la etapa más reciente que tenga.
  const { rows: sedesRef } = await cliente.query(`
    SELECT ces.sede_id, s.nombre, ce.clave
      FROM convocatorias_etapas_sedes ces
      JOIN convocatorias_etapas ce ON ce.id = ces.etapa_id
      JOIN sedes s ON s.id = ces.sede_id
     WHERE ce.clave NOT LIKE 'ENSAYO%'
       AND ce.id = (
         SELECT ce2.id FROM convocatorias_etapas ce2
           JOIN convocatorias_etapas_sedes x ON x.etapa_id = ce2.id
          WHERE ce2.clave NOT LIKE 'ENSAYO%'
          ORDER BY ce2.examen_sabado DESC LIMIT 1
       )`);

  const { rows: existentes } = await cliente.query(
    `SELECT clave FROM convocatorias_etapas WHERE clave = ANY($1)`,
    [ETAPAS.map((e) => e.clave)]);
  const yaExisten = new Set(existentes.map((r) => r.clave));

  console.log(`\n══ CALENDARIO 3er CUATRIMESTRE 2026 ${APLICAR ? '— APLICANDO' : '— SIMULACIÓN (no escribe nada)'} ══\n`);
  for (const e of ETAPAS) {
    console.log(`  ${e.clave}  solicitud ${e.solicitudInicio} a ${e.solicitudFin} · examen ${e.examenSabado} y ${e.examenDomingo}` +
      (yaExisten.has(e.clave) ? '  (ya existe: se actualiza)' : '  (nueva)'));
  }
  console.log(`\n  Horarios: 22 módulos por etapa (10:00 y 13:30, sábado/domingo, fase B en espejo de la A).`);
  if (sedesRef.length > 0) {
    console.log(`  Sedes: se copian ${sedesRef.length} de la etapa ${sedesRef[0].clave}: ${sedesRef.map((s) => s.nombre).join(', ')}`);
    console.log('         (se ajustan después en Convocatorias, como siempre).');
  } else {
    console.log('  ⚠ Sedes: ninguna etapa previa tiene sedes. Las etapas quedan SIN sede y hay que asignarlas en Convocatorias.');
  }

  if (!APLICAR) {
    console.log('\n[SIMULACIÓN] Nada se escribió. Corre con --aplicar para cargarlo.\n');
    await cliente.end();
    process.exit(0);
  }

  await cliente.query('BEGIN');
  let horariosTotales = 0;
  for (const e of ETAPAS) {
    const { rows: [etapa] } = await cliente.query(
      `INSERT INTO convocatorias_etapas
         (clave, etapa, fase, solicitud_inicio, solicitud_fin, examen_sabado, examen_domingo, anio, estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 2026, 'programada')
       ON CONFLICT (clave) DO UPDATE
         SET solicitud_inicio = EXCLUDED.solicitud_inicio,
             solicitud_fin    = EXCLUDED.solicitud_fin,
             examen_sabado    = EXCLUDED.examen_sabado,
             examen_domingo   = EXCLUDED.examen_domingo
       RETURNING id`,
      [e.clave, e.etapa, e.fase, e.solicitudInicio, e.solicitudFin, e.examenSabado, e.examenDomingo]);

    for (const [numero, slotA] of Object.entries(FASE_A)) {
      const [dia, hora] = e.fase === 'A' ? slotA : espejo(slotA);
      await cliente.query(
        `INSERT INTO convocatorias_modulos_horarios (etapa_id, modulo_id, dia, hora)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (etapa_id, modulo_id) DO UPDATE SET dia = EXCLUDED.dia, hora = EXCLUDED.hora`,
        [etapa.id, porNumero.get(Number(numero)).id, dia, hora]);
      horariosTotales++;
    }

    for (const s of sedesRef) {
      await cliente.query(
        `INSERT INTO convocatorias_etapas_sedes (etapa_id, sede_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`, [etapa.id, s.sede_id]);
    }
  }
  await cliente.query('COMMIT');

  console.log(`\nListo: ${ETAPAS.length} etapa(s) y ${horariosTotales} horario(s) cargados.`);
  console.log('Revisalo en el portal: la proxima ventana de solicitud es 2609-A (10 al 14 de agosto).\n');
} catch (e) {
  await cliente.query('ROLLBACK').catch(() => {});
  console.error('\n✋ Falló y se revirtió todo:\n', e);
  process.exitCode = 1;
} finally {
  await cliente.end();
}
