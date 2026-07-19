#!/usr/bin/env node
/**
 * Reinicia las PERSONAS y su trámite, dejando el catálogo de la plataforma.
 *
 * Para empezar pruebas realistas con cuentas limpias, sin perder lo que costó
 * trabajo: los 22 módulos del Plan 22, los 841 temas, las 1539 preguntas del
 * banco, los 113 municipios, las sedes y las convocatorias.
 *
 * ── SE BORRA ────────────────────────────────────────────────────────────────
 * Todas las cuentas (salvo la de dirección/creador) y todo su rastro:
 * expedientes, pagos, inscripciones, calificaciones, credenciales, mensajes,
 * notificaciones, solicitudes, sesiones, bitácora y métricas derivadas.
 *
 * ── SE CONSERVA ─────────────────────────────────────────────────────────────
 * Módulos, temas, banco de preguntas, municipios, sedes, convocatorias, etapas,
 * datos institucionales y la cuenta de dirección.
 *
 * ── SE CREA ─────────────────────────────────────────────────────────────────
 * Tres cuentas, todas con contraseña `demo1234`.
 *
 * IRREVERSIBLE. Exige `CONFIRMO=BORRAR` y que exista un respaldo reciente.
 */

import pg from 'pg';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..', '..');

if (process.env.CONFIRMO !== 'BORRAR') {
  console.error(`
✋ Operación IRREVERSIBLE: borra todas las cuentas y su trámite.

   Antes de correrla, asegúrate de tener un respaldo fresco:
       pnpm --filter @workspace/db run respaldo

   Y luego:
       CONFIRMO=BORRAR node lib/db/reiniciar-personas.mjs
`);
  process.exit(1);
}

const url = process.env.DATABASE_URL
  ?? fs.readFileSync(path.join(RAIZ, '.env'), 'utf8').match(/^DATABASE_URL=(.*)$/m)?.[1].trim();
if (!url) { console.error('✋ No hay DATABASE_URL.'); process.exit(1); }

const PASSWORD = 'demo1234';
const CORREO_DIRECCION = 'contacto@sinapsys.mx';

const c = new pg.Client({ connectionString: url });
await c.connect();
console.log(`Base: ${url.replace(/^.*@/, '').split(/[:/?]/)[0]}\n`);

// ── Quién se salva ──────────────────────────────────────────────────────────
const { rows: conservar } = await c.query(
  `SELECT id, email FROM users WHERE email = $1`, [CORREO_DIRECCION]
);
const idsConservar = conservar.map((r) => r.id);
console.log(idsConservar.length
  ? `Se conserva: ${conservar.map((r) => `${r.email} (#${r.id})`).join(', ')}\n`
  : `Aviso: no se encontró ${CORREO_DIRECCION}; se borrarán TODAS las cuentas.\n`);

/**
 * Orden de borrado: de las hojas hacia la raíz.
 *
 * Aunque varias tablas tienen borrado en cascada desde `users`, se vacían a
 * mano y en orden para poder REPORTAR cuánto se borró de cada una. Un borrado
 * silencioso en cascada no deja saber si se llevó algo que no debía.
 */
const EN_ORDEN = [
  // Orden derivado del grafo real de llaves foráneas (se consultó a la base,
  // no se adivinó): las hojas primero, y lo que cuelga de ellas después.
  // Aula
  'aula_foro_votos', 'aula_entregas', 'aula_foro', 'aula_materiales',
  'aula_tareas', 'aula_anuncios', 'aula_modulos_clase',
  // Trámite del alumno
  'calificaciones',
  'pagos_grupales_examenes', 'pagos_examen_inscripciones',
  'pagos_grupales', 'pagos_examen', 'pagos',
  'examenes_inscripciones', 'inscripciones',
  'expediente_documentos', 'documentos',
  'credenciales_verificaciones', 'credenciales',
  // Comunicación
  'chat_mensajes', 'chat_conversaciones', 'chat_consentimientos',
  'anuncios_vistos', 'anuncios', 'avisos',
  'notificaciones', 'outbox',
  // Operación
  'reportes_generados', 'reportes_programados',
  'tutoriales_vistos', 'preferencias_usuario', 'firmas_usuario', 'accesos_rapidos',
  'metricas_diarias', 'uso_diario',
  // Bitácoras
  'audit_log', 'eliminaciones_auditoria',
  // Accesos
  'sesiones', 'password_reset_tokens', 'email_verifications', 'solicitudes_cuenta',
  // Perfiles
  'estudiantes', 'gestores', 'administradores',
];

/**
 * Tablas de CATÁLOGO que apuntan a `users` por "quién lo actualizó".
 *
 * No se borran —son configuración de la plataforma, no personas—, pero su
 * referencia hay que soltarla o el borrado de usuarios choca contra la llave
 * foránea. Se pone en nulo: el dato institucional se queda, sólo se pierde la
 * firma de quién lo tocó por última vez, que era de una cuenta de prueba.
 */
const DESLIGAR = [
  ['datos_institucionales', 'actualizado_por'],
  ['plantillas_correo', 'actualizado_por'],
  ['datos_bancarios', 'actualizado_por'],
];

// Qué tablas existen de verdad. Se consulta ANTES de abrir la transacción a
// propósito: en Postgres, un error dentro de una transacción la aborta entera,
// así que un `catch` de "tabla inexistente" no sirve de nada ahí dentro.
const { rows: existentes } = await c.query(
  `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
);
const hay = new Set(existentes.map((r) => r.tablename));
const omitidas = EN_ORDEN.filter((t) => !hay.has(t));
if (omitidas.length) console.log(`Tablas que no existen (se omiten): ${omitidas.join(', ')}\n`);

const borrado = {};
await c.query('BEGIN');
try {
  for (const t of EN_ORDEN) {
    if (!hay.has(t)) continue;
    const r = await c.query(`DELETE FROM "${t}"`);
    if (r.rowCount > 0) borrado[t] = r.rowCount;
  }

  for (const [tabla, col] of DESLIGAR) {
    if (!hay.has(tabla)) continue;
    await c.query(`UPDATE "${tabla}" SET "${col}" = NULL WHERE "${col}" IS NOT NULL`);
  }

  // Los usuarios al final, respetando al de dirección.
  const rUsers = idsConservar.length
    ? await c.query(`DELETE FROM users WHERE id <> ALL($1::int[])`, [idsConservar])
    : await c.query(`DELETE FROM users`);
  borrado['users'] = rUsers.rowCount;

  // `directores` cuelga de users con cascada; se recrea si hiciera falta.
  const { rows: dir } = await c.query(`SELECT count(*)::int n FROM directores`);
  if (idsConservar.length && dir[0].n === 0) {
    await c.query(
      `INSERT INTO directores (user_id, nombre_completo, puesto) VALUES ($1, $2, $3)`,
      [idsConservar[0], 'Synapsis', 'Creador de la plataforma'],
    );
    console.log('Se recreó el perfil de dirección (se había ido en cascada).');
  }

  await c.query('COMMIT');
} catch (e) {
  await c.query('ROLLBACK');
  console.error('\n❌ Falló el borrado. Se revirtió TODO. Nada cambió.\n', e.message);
  await c.end();
  process.exit(1);
}

console.log('── Borrado ──');
for (const [t, n] of Object.entries(borrado)) console.log(`  ${t.padEnd(32)} ${n}`);

// ── Cuentas nuevas ──────────────────────────────────────────────────────────
const hash = await bcrypt.hash(PASSWORD, 10);

const { rows: mor } = await c.query(
  `SELECT id, nombre FROM municipios WHERE unaccent(lower(nombre)) LIKE unaccent(lower('%morelia%')) LIMIT 1`
);
if (!mor.length) { console.error('✋ No encontré el municipio de Morelia.'); await c.end(); process.exit(1); }

async function crearUsuario(email, rol) {
  const { rows } = await c.query(
    `INSERT INTO users (email, password_hash, rol, activo, password_temporal)
     VALUES ($1, $2, $3, true, false) RETURNING id`,
    [email, hash, rol],
  );
  return rows[0].id;
}

await c.query('BEGIN');
try {
  // 1. Titular
  const idVelia = await crearUsuario('velia@gmail.com', 'admin');
  await c.query(
    `INSERT INTO administradores (user_id, nombre_completo, puesto, es_jefe, perfil_confirmado)
     VALUES ($1, $2, $3, true, false)`,
    [idVelia, 'Velia', 'Administradora'],
  );

  // 2. Operativo: mismo rol, sin facultades de jefatura.
  const idAlex = await crearUsuario('alex@gmail.com', 'admin');
  await c.query(
    `INSERT INTO administradores (user_id, nombre_completo, puesto, es_jefe, perfil_confirmado)
     VALUES ($1, $2, $3, false, false)`,
    [idAlex, 'Alex', 'Administrativo'],
  );

  // 3. Gestor real de Morelia
  const idUtec = await crearUsuario('UTEC@gmail.com', 'gestor');
  await c.query(
    `INSERT INTO gestores (user_id, nombre_completo, municipio_id, centro_asesoria, estado)
     VALUES ($1, $2, $3, $4, 'activo')`,
    [idUtec, 'UTEC', mor[0].id, 'UTEC'],
  );

  await c.query('COMMIT');
  console.log('\n── Cuentas creadas ──');
  console.log(`  velia@gmail.com   admin   Velia · Administradora (TITULAR)   #${idVelia}`);
  console.log(`  alex@gmail.com    admin   Alex · Administrativo (operativo)  #${idAlex}`);
  console.log(`  UTEC@gmail.com    gestor  UTEC · ${mor[0].nombre}            #${idUtec}`);
  console.log(`\n  Contraseña de las tres: ${PASSWORD}`);
} catch (e) {
  await c.query('ROLLBACK');
  console.error('\n❌ Falló la creación de cuentas. Se revirtió.\n', e.message);
  await c.end();
  process.exit(1);
}

// ── Verificación ────────────────────────────────────────────────────────────
console.log('\n── Verificación ──');
const { rows: finales } = await c.query(
  `SELECT u.id, u.email, u.rol, a.es_jefe
   FROM users u LEFT JOIN administradores a ON a.user_id = u.id ORDER BY u.rol, u.id`
);
for (const f of finales) {
  console.log(`  #${String(f.id).padEnd(4)} ${f.rol.padEnd(11)} ${f.email}${f.es_jefe === true ? '  [titular]' : ''}`);
}

for (const t of ['modulos', 'modulos_temas', 'banco_preguntas', 'municipios', 'sedes', 'convocatorias_etapas']) {
  const { rows } = await c.query(`SELECT count(*)::int n FROM "${t}"`);
  console.log(`  catálogo · ${t.padEnd(22)} ${rows[0].n}`);
}

await c.end();
console.log('\n✅ Listo.');
