/**
 * ENSAYO DE EXAMEN — mete alumnos a un examen ficticio para poder VER qué les
 * aparece, y después lo borra sin dejar rastro.
 *
 * Por qué existe: la pantalla del examen —el conteo de días, el pase con QR, la
 * sede y la hora— está construida desde hace tiempo y **nunca se ha visto con
 * datos**. Nadie ha estado inscrito a un examen en esta base. Revisar ese
 * recorrido leyendo código tiene un límite; hay que mirarlo.
 *
 * Cómo correrlo (en el EC2, DENTRO del contenedor):
 *
 *     docker exec -it modula22 node lib/db/ensayo-examen.mjs --simular
 *     docker exec -it modula22 node lib/db/ensayo-examen.mjs --aplicar
 *     docker exec -it modula22 node lib/db/ensayo-examen.mjs --deshacer
 *
 * `--simular` no escribe una sola fila: imprime a quién metería y con qué datos.
 *
 * ── Las cinco decisiones que hacen que esto sea seguro en producción ────────
 *
 * 1. TODO LLEVA LA MARCA `ENSAYO`. La etapa se llama `ENSAYO-EXAMEN` y cada
 *    folio empieza con `ENSAYO-`. `--deshacer` borra exactamente lo que tiene
 *    esa marca y nada más: no adivina, no borra "lo reciente".
 *
 * 2. LA VENTANA DE SOLICITUD NACE CERRADA (terminó ayer). Una etapa con la
 *    ventana abierta se le aparecería a CUALQUIER alumno real como una
 *    convocatoria vigente donde puede inscribirse y pagar. Cerrada, el examen
 *    se ve —que es lo que se quiere mirar— pero no se puede entrar a ella.
 *
 * 3. NO SE MANDAN RECORDATORIOS DE ESTA ETAPA. El examen queda a tres días, y
 *    el recordatorio de la víspera saldría dentro de dos: correos reales, a
 *    gente real, sobre un examen que no existe. `recordatoriosExamen.ts`
 *    excluye las etapas marcadas como ensayo — ese candado vive en el servidor,
 *    no depende de que este script se borre a tiempo.
 *
 * 4. NO CREA PAGOS. Un pago falso ensucia la conciliación, que es dinero de
 *    verdad. Consecuencia visible: en el tablero el examen aparecerá SIN el
 *    listón de "ya está pagado". Es la única parte del recorrido que este
 *    ensayo no reproduce, y se dice aquí para que no se lea como un defecto.
 *
 * 5. POR OMISIÓN SOLO TOCA LAS CUENTAS DE PRUEBA. Meter a todos los alumnos de
 *    una base de producción a un examen inventado es una decisión que hay que
 *    tomar a propósito, escribiendo `--todos`, no por omisión.
 */
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..', '..');

const SIMULAR  = process.argv.includes('--simular') || !process.argv.some((a) => a === '--aplicar' || a === '--deshacer');
const APLICAR  = process.argv.includes('--aplicar');
const DESHACER = process.argv.includes('--deshacer');
const TODOS    = process.argv.includes('--todos');

/** A quién se le dan DOS módulos, para ver también el caso de varios exámenes. */
const DESTACADO = (process.argv.find((a) => a.startsWith('--destacado='))?.split('=')[1] ?? '').toLowerCase();

/** Días de aquí al examen. Tres por omisión, como se pidió. */
const DIAS = Number(process.argv.find((a) => a.startsWith('--dias='))?.split('=')[1] ?? 3);

const CLAVE_ETAPA = 'ENSAYO-EXAMEN';
const PREFIJO_FOLIO = 'ENSAYO-';

/** Cuentas de prueba conocidas. Ver CLAUDE.md. */
const CUENTAS_PRUEBA = [
  'axel@hotmail.com',
  'alumno1@prueba.mx', 'alumno2@prueba.mx', 'alumno3@prueba.mx',
  'alumno4@prueba.mx', 'alumno5@prueba.mx',
];

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

/** Fecha en Michoacán, YYYY-MM-DD, corrida `n` días. */
function fecha(n) {
  const hoy = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
  const t = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()));
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

const cliente = new pg.Client({
  connectionString: leerUrlBd(),
  ssl: { rejectUnauthorized: false },
});

async function deshacer() {
  const { rows: etapa } = await cliente.query(
    'SELECT id FROM convocatorias_etapas WHERE clave = $1', [CLAVE_ETAPA]);
  if (etapa.length === 0) {
    console.log('No hay nada que deshacer: la etapa de ensayo no existe.');
    return;
  }
  const etapaId = etapa[0].id;

  // El orden importa: primero lo que apunta a la etapa, al final la etapa.
  const insc = await cliente.query(
    'DELETE FROM examenes_inscripciones WHERE etapa_id = $1 AND folio LIKE $2',
    [etapaId, `${PREFIJO_FOLIO}%`]);
  const sobran = await cliente.query(
    'SELECT count(*)::int AS n FROM examenes_inscripciones WHERE etapa_id = $1', [etapaId]);

  // Si alguien inscribió algo a mano en esta etapa sin la marca, se para: el
  // script no borra filas que no creó.
  if (sobran.rows[0].n > 0) {
    console.error(`✋ Quedan ${sobran.rows[0].n} inscripción(es) en la etapa de ensayo SIN la marca "${PREFIJO_FOLIO}".`);
    console.error('   No se borra la etapa. Revísalas a mano antes de volver a intentar.');
    console.log(`Sí se borraron ${insc.rowCount} inscripción(es) marcadas.`);
    return;
  }

  const hor = await cliente.query('DELETE FROM convocatorias_modulos_horarios WHERE etapa_id = $1', [etapaId]);
  await cliente.query('DELETE FROM convocatorias_etapas_sedes WHERE etapa_id = $1', [etapaId]);
  await cliente.query('DELETE FROM convocatorias_etapas WHERE id = $1', [etapaId]);

  console.log(`Deshecho: ${insc.rowCount} inscripción(es), ${hor.rowCount} horario(s) y la etapa ${CLAVE_ETAPA}.`);
}

async function aplicar() {
  const examenSabado  = fecha(DIAS);
  const examenDomingo = fecha(DIAS + 1);
  const ventanaFin    = fecha(-1);   // cerrada AYER, a propósito
  const ventanaInicio = fecha(-6);

  console.log(`\n  Etapa de ensayo  ${CLAVE_ETAPA}`);
  console.log(`  Examen           ${examenSabado} (sábado) y ${examenDomingo} (domingo) — en ${DIAS} días`);
  console.log(`  Ventana          ${ventanaInicio} a ${ventanaFin}  ← cerrada, nadie puede inscribirse\n`);

  // ── A quién ────────────────────────────────────────────────────────────
  const { rows: alumnos } = TODOS
    ? await cliente.query(
        `SELECT u.id, u.email, e.nombre_completo
           FROM users u JOIN estudiantes e ON e.user_id = u.id
          WHERE u.rol = 'estudiante' AND u.activo = true
          ORDER BY e.nombre_completo`)
    : await cliente.query(
        `SELECT u.id, u.email, e.nombre_completo
           FROM users u JOIN estudiantes e ON e.user_id = u.id
          WHERE u.rol = 'estudiante' AND lower(u.email) = ANY($1)
          ORDER BY e.nombre_completo`, [CUENTAS_PRUEBA]);

  if (alumnos.length === 0) {
    console.error('✋ No hay alumnos que inscribir.');
    if (!TODOS) console.error('   (Sin --todos solo se buscan las cuentas de prueba de CLAUDE.md.)');
    return;
  }

  // ── Con qué ────────────────────────────────────────────────────────────
  const { rows: modulos } = await cliente.query(
    'SELECT id, numero, nombre FROM modulos ORDER BY numero LIMIT 2');
  if (modulos.length < 2) { console.error('✋ Hacen falta al menos 2 módulos en el catálogo.'); return; }

  const { rows: sedes } = await cliente.query('SELECT id, nombre FROM sedes ORDER BY id LIMIT 1');
  if (sedes.length === 0) {
    console.error('✋ No hay ninguna sede. La inscripción exige una: sin sede el pase no puede decir a dónde ir.');
    return;
  }
  const sede = sedes[0];

  console.log(`  Alumnos          ${alumnos.length}${TODOS ? ' (TODOS los activos)' : ' (solo cuentas de prueba)'}`);
  console.log(`  Módulos          ${modulos.map((m) => `${m.numero}. ${m.nombre}`).join('  |  ')}`);
  console.log(`  Sede             ${sede.nombre}`);
  if (DESTACADO) console.log(`  Con 2 módulos    ${DESTACADO}`);
  console.log('');

  if (SIMULAR) {
    for (const a of alumnos.slice(0, 12)) {
      const dos = DESTACADO && a.email.toLowerCase() === DESTACADO;
      console.log(`   · ${a.nombre_completo}  <${a.email}>  → ${dos ? '2 módulos' : '1 módulo'}`);
    }
    if (alumnos.length > 12) console.log(`   … y ${alumnos.length - 12} más`);
    console.log('\n[SIMULACIÓN] No se escribió nada. Corre con --aplicar para hacerlo.\n');
    return;
  }

  await cliente.query('BEGIN');
  try {
    // ── Etapa ────────────────────────────────────────────────────────────
    const { rows: [etapa] } = await cliente.query(
      `INSERT INTO convocatorias_etapas
         (clave, etapa, fase, solicitud_inicio, solicitud_fin, examen_sabado, examen_domingo, anio, estado)
       VALUES ($1, 'E0', '1', $2, $3, $4, $5, $6, 'programada')
       ON CONFLICT (clave) DO UPDATE
         SET solicitud_inicio = EXCLUDED.solicitud_inicio,
             solicitud_fin    = EXCLUDED.solicitud_fin,
             examen_sabado    = EXCLUDED.examen_sabado,
             examen_domingo   = EXCLUDED.examen_domingo
       RETURNING id`,
      [CLAVE_ETAPA, ventanaInicio, ventanaFin, examenSabado, examenDomingo, new Date().getFullYear()]);

    await cliente.query(
      `INSERT INTO convocatorias_etapas_sedes (etapa_id, sede_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`, [etapa.id, sede.id]);

    // ── Horarios: sábado, dos horas distintas para ver el orden en la lista
    const horarios = [];
    const horas = ['09:00', '12:00'];
    for (let i = 0; i < 2; i++) {
      const { rows: [h] } = await cliente.query(
        `INSERT INTO convocatorias_modulos_horarios (etapa_id, modulo_id, dia, hora)
         VALUES ($1, $2, 'sabado', $3)
         ON CONFLICT (etapa_id, modulo_id) DO UPDATE SET hora = EXCLUDED.hora
         RETURNING id`, [etapa.id, modulos[i].id, horas[i]]);
      horarios.push(h.id);
    }

    // ── Inscripciones ────────────────────────────────────────────────────
    let n = 0;
    for (const a of alumnos) {
      const dos = DESTACADO && a.email.toLowerCase() === DESTACADO;
      const cuantos = dos ? 2 : 1;
      for (let i = 0; i < cuantos; i++) {
        await cliente.query(
          `INSERT INTO examenes_inscripciones
             (estudiante_id, etapa_id, modulo_id, horario_id, sede_id, folio, estado)
           VALUES ($1, $2, $3, $4, $5, $6, 'inscrito')
           ON CONFLICT (estudiante_id, etapa_id, modulo_id) DO NOTHING`,
          [a.id, etapa.id, modulos[i].id, horarios[i], sede.id,
           `${PREFIJO_FOLIO}${a.id}-${modulos[i].id}`]);
        n++;
      }
    }

    await cliente.query('COMMIT');
    console.log(`Listo: ${n} inscripción(es) de ensayo sobre ${alumnos.length} alumno(s).`);
    console.log(`Para borrarlo todo:  node lib/db/ensayo-examen.mjs --deshacer\n`);
  } catch (e) {
    await cliente.query('ROLLBACK');
    throw e;
  }
}

await cliente.connect();
try {
  if (DESHACER) await deshacer();
  else await aplicar();
} finally {
  await cliente.end();
}
