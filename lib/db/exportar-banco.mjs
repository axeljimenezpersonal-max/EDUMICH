#!/usr/bin/env node
/**
 * Exporta `banco_preguntas` a JSON importable — la fuente de verdad es la base.
 *
 * POR QUÉ EXISTE
 * El banco de preguntas vive SOLO en Neon: no hay seed en el repo. Un re-seed o
 * la pérdida de la base se lleva ~1,190 preguntas reescritas. Este script saca
 * una copia versionable y sirve como respaldo previo a la migración a AWS.
 *
 * SALIDA (en el directorio que pases, o ./export-banco por defecto):
 *   - banco-preguntas.jsonl   → todas las preguntas, una por línea
 *   - modulo-01.json … 22.json → un arreglo por módulo (las 70 completas)
 *
 * Cada objeto trae EXACTAMENTE los campos del importador:
 *   preguntaDocId, moduloNum, unidadNum, tema, dificultad, pregunta,
 *   opcionA, opcionB, opcionC, opcionD, respuestaCorrecta (letra),
 *   explicacion, paraRepasar
 *
 * Valida integridad antes de escribir (correcta A-D, 4 opciones no vacías ni
 * duplicadas, dificultad en catálogo, explicación sin citar letras) y sale con
 * código 1 si encuentra algún problema, sin escribir archivos corruptos.
 *
 *   node lib/db/exportar-banco.mjs [directorio-salida]
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { Client } = require('pg');

function dbUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const env = fs.readFileSync(path.join(raiz, '.env'), 'utf8');
  const m = env.match(/^DATABASE_URL=["']?(.+?)["']?$/m);
  if (!m) throw new Error('No encontré DATABASE_URL (ni en el entorno ni en .env)');
  return m[1];
}

const OUT = process.argv[2] || path.join(process.cwd(), 'export-banco');
const CITA_LETRA = /\((?:la\s+)?[ABCD]\)|\bopci[óo]n(?:es)?\s+[ABCD]\b|\b(?:la|el|inciso)\s+[ABCD]\b(?![a-záéíóúñ])/;
const DIFICULTADES = ['facil', 'media', 'alta'];

const c = new Client({ connectionString: dbUrl() });
await c.connect();

try {
  const { rows } = await c.query(`
    SELECT pregunta_doc_id, modulo_num, unidad_num, tema, dificultad, pregunta,
           opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta,
           explicacion, para_repasar
      FROM banco_preguntas
     ORDER BY modulo_num, pregunta_doc_id`);

  // ── Integridad (no escribe nada si falla) ──
  let errores = 0;
  const problema = (doc, msg) => { console.error(`✗ ${doc}: ${msg}`); errores++; };
  for (const r of rows) {
    const ops = { A: r.opcion_a, B: r.opcion_b, C: r.opcion_c, D: r.opcion_d };
    if (!['A', 'B', 'C', 'D'].includes(r.respuesta_correcta)) problema(r.pregunta_doc_id, `respuestaCorrecta inválida: ${r.respuesta_correcta}`);
    if (Object.values(ops).some((o) => !o || !o.trim())) problema(r.pregunta_doc_id, 'opción vacía');
    if (new Set(Object.values(ops).map((o) => (o || '').trim())).size !== 4) problema(r.pregunta_doc_id, 'opciones duplicadas');
    if (r.dificultad && !DIFICULTADES.includes(r.dificultad)) problema(r.pregunta_doc_id, `dificultad fuera de catálogo: ${r.dificultad}`);
    if (r.explicacion && CITA_LETRA.test(r.explicacion)) problema(r.pregunta_doc_id, 'la explicación cita una letra (se rompe con el barajado)');
  }
  if (errores) {
    console.error(`\n❌ ${errores} problema(s) de integridad. No se exportó nada.`);
    process.exit(1);
  }

  const mapear = (r) => ({
    preguntaDocId: r.pregunta_doc_id,
    moduloNum: r.modulo_num,
    unidadNum: r.unidad_num,
    tema: r.tema,
    dificultad: r.dificultad || 'media',
    pregunta: r.pregunta,
    opcionA: r.opcion_a,
    opcionB: r.opcion_b,
    opcionC: r.opcion_c,
    opcionD: r.opcion_d,
    respuestaCorrecta: r.respuesta_correcta,
    explicacion: r.explicacion,
    paraRepasar: r.para_repasar ?? null,
  });

  fs.mkdirSync(OUT, { recursive: true });
  const todas = rows.map(mapear);

  fs.writeFileSync(path.join(OUT, 'banco-preguntas.jsonl'), todas.map((q) => JSON.stringify(q)).join('\n') + '\n');

  const porMod = {};
  for (const q of todas) (porMod[q.moduloNum] ??= []).push(q);
  for (const m of Object.keys(porMod).map(Number).sort((a, b) => a - b)) {
    fs.writeFileSync(path.join(OUT, `modulo-${String(m).padStart(2, '0')}.json`), JSON.stringify(porMod[m], null, 2));
  }

  // Distribución de la letra correcta por módulo — para confirmar que quedó repartida.
  const repartoLetra = {};
  for (const q of todas) {
    (repartoLetra[q.moduloNum] ??= { A: 0, B: 0, C: 0, D: 0 })[q.respuestaCorrecta]++;
  }

  console.log(`✓ integridad OK — ${todas.length} preguntas en ${Object.keys(porMod).length} módulos`);
  console.log(`  ${OUT}/banco-preguntas.jsonl  + ${Object.keys(porMod).length} archivos modulo-NN.json`);
} catch (e) {
  console.error('\n❌ Error: ' + e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
