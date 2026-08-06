/**
 * REINICIO v2.2 — cierra la fase de construcción y deja la plataforma lista
 * para las pruebas reales.
 *
 * Qué hace, en orden:
 *
 *  1. BORRA A TODOS LOS ALUMNOS, de todos lados: cuentas, expedientes (filas y
 *     ARCHIVOS), inscripciones, exámenes, fichas de pago, chat, notificaciones
 *     y la etapa de ensayo. Todo lo que hay hoy es dato de prueba de la
 *     construcción; las pruebas reales empiezan con la casa vacía.
 *
 *  2. REINICIA LOS PERFILES de administración y de los centros:
 *     `password_temporal = true` (al entrar se les pide crear su contraseña) y
 *     sesiones invalidadas. La contraseña actual sigue sirviendo para ENTRAR
 *     hasta que desde Accesos se pulse «Reenviar primer acceso», que genera una
 *     nueva y la manda — ese botón queda habilitado para todos.
 *     ⚠️ El creador (rol `direccion`) NO se toca: conserva su contraseña.
 *
 *  3. REINICIA TODOS LOS TUTORIALES, de todos los roles: la bienvenida y los
 *     de sección vuelven a ofrecerse como el primer día. (El registro local del
 *     navegador se corrige solo: al cargar, la respuesta del servidor pisa el
 *     espejo.)
 *
 *  4. SUELTA LA LLAVE FORÁNEA de la bitácora (si sigue puesta). La bitácora es
 *     inmutable por trigger; con la FK puesta, un usuario con entradas era
 *     IMBORRABLE — la cascada exigiría tocar la bitácora y el trigger lo
 *     prohíbe. La bitácora NO se toca: conserva cada entrada con nombre y rol
 *     de la época, y la cadena de huellas queda intacta.
 *
 * Cada alumno borrado deja su constancia anonimizada en
 * `eliminaciones_auditoria`, igual que el borrado de las 3 AM.
 *
 * Cómo correrlo (en el EC2, DENTRO del contenedor, DESPUÉS de desplegar v2.2):
 *
 *     docker exec -it modula22 node lib/db/reinicio-v22.mjs            # simula
 *     docker exec -it modula22 node lib/db/reinicio-v22.mjs --aplicar
 *
 * La simulación no escribe una sola fila: dice exactamente qué borraría.
 */
import pg from 'pg';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..', '..');
const APLICAR = process.argv.includes('--aplicar');
const STORAGE = process.env.STORAGE_DIR || '/app/storage';

function leerUrlBd() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = path.join(RAIZ, '.env');
  try {
    const m = readFileSync(env, 'utf8').match(/^DATABASE_URL=(.*)$/m);
    if (m) return m[1].trim();
  } catch { /* sigue */ }
  console.error('✋ No hay DATABASE_URL.');
  process.exit(1);
}

const cliente = new pg.Client({ connectionString: leerUrlBd(), ssl: { rejectUnauthorized: false } });
await cliente.connect();

const n = async (q, p = []) => Number((await cliente.query(q, p)).rows[0].n);

try {
  // ── Fotografía de lo que hay ───────────────────────────────────────────
  const alumnos = await n(`SELECT count(*)::int AS n FROM users WHERE rol = 'estudiante'`);
  const cuentas = await cliente.query(
    `SELECT u.id, u.email, e.nombre_completo, e.folio_preregistro, e.matricula_oficial_dgb
       FROM users u JOIN estudiantes e ON e.user_id = u.id
      WHERE u.rol = 'estudiante' ORDER BY u.id`);
  const resumen = {
    'inscripciones a examen': await n('SELECT count(*)::int AS n FROM examenes_inscripciones'),
    'fichas de pago de examen': await n('SELECT count(*)::int AS n FROM pagos_examen'),
    'documentos de expediente': await n('SELECT count(*)::int AS n FROM expediente_documentos'),
    'conversaciones de chat': await n('SELECT count(*)::int AS n FROM chat_conversaciones'),
    'notificaciones': await n('SELECT count(*)::int AS n FROM notificaciones'),
    'tutoriales vistos (TODOS los roles)': await n('SELECT count(*)::int AS n FROM tutoriales_vistos'),
    'solicitudes de cuenta': await n('SELECT count(*)::int AS n FROM solicitudes_cuenta'),
  };
  const perfiles = await cliente.query(
    `SELECT email, rol FROM users WHERE rol IN ('admin','gestor') AND activo = true ORDER BY rol, email`);

  console.log(`\n══ REINICIO v2.2 ${APLICAR ? '— APLICANDO' : '— SIMULACIÓN (no escribe nada)'} ══\n`);
  console.log(`Alumnos a borrar: ${alumnos}`);
  for (const c of cuentas.rows.slice(0, 15)) console.log(`   · #${c.id}  ${c.nombre_completo}  <${c.email}>`);
  if (cuentas.rows.length > 15) console.log(`   … y ${cuentas.rows.length - 15} más`);
  console.log('\nSe borra junto con ellos:');
  for (const [k, v] of Object.entries(resumen)) console.log(`   ${String(v).padStart(5)}  ${k}`);
  console.log(`\nPerfiles a reiniciar (crear contraseña al entrar + Reenviar habilitado): ${perfiles.rows.length}`);
  for (const p of perfiles.rows) console.log(`   · ${p.rol.padEnd(6)} ${p.email}`);
  console.log('   · El creador (direccion) NO se toca.\n');

  if (!APLICAR) {
    console.log('[SIMULACIÓN] Nada se escribió. Corre con --aplicar para ejecutarlo.\n');
    await cliente.end();
    process.exit(0);
  }

  // ── Archivos primero: después de borrar la fila ya no se sabe qué archivo
  //    le correspondía (misma razón que en la depuración de las 3 AM). Se
  //    juntan ahora y se borran del disco DESPUÉS del COMMIT: si la
  //    transacción fallara, no habríamos borrado archivos de filas vivas.
  const archivos = [];
  for (const q of [
    'SELECT ruta_archivo AS r FROM expediente_documentos WHERE ruta_archivo IS NOT NULL',
    'SELECT ruta_archivo AS r FROM documentos WHERE ruta_archivo IS NOT NULL',
    `SELECT archivo_ref AS r FROM aula_entregas WHERE archivo_ref IS NOT NULL AND archivo_ref NOT LIKE 's3:%'`,
  ]) {
    try { archivos.push(...(await cliente.query(q)).rows.map((x) => x.r)); }
    catch { /* la tabla puede no tener esa columna en despliegues viejos */ }
  }

  await cliente.query('BEGIN');

  // La FK de la bitácora, si sigue puesta (el redeploy ya la quita; esto es el
  // cinturón por si el script corre antes).
  await cliente.query(`DO $$
    DECLARE c text;
    BEGIN
      SELECT conname INTO c FROM pg_constraint
       WHERE conrelid = 'audit_log'::regclass AND contype = 'f'
         AND conkey = (SELECT array_agg(attnum) FROM pg_attribute
                        WHERE attrelid = 'audit_log'::regclass AND attname = 'user_id');
      IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE audit_log DROP CONSTRAINT %I', c); END IF;
    END $$`);

  // Constancia anonimizada de cada cuenta, ANTES de borrarla.
  for (const c of cuentas.rows) {
    await cliente.query(
      `INSERT INTO eliminaciones_auditoria
         (estudiante_id, nombre_completo, curp, email, municipio_nombre, folio_preregistro,
          tipo, motivo, dias_sin_actividad, tenia_matricula_dgb, ejecutado_por_sistema)
       VALUES ($1, $2, NULL, NULL, NULL, $3, 'hard_delete',
               'Reinicio v2.2: fin de la fase de construccion, cuentas de prueba', NULL, $4, true)`,
      [c.id, `[ELIMINADO] ID ${c.id}`, c.folio_preregistro, !!c.matricula_oficial_dgb]);
  }

  // El orden importa: primero lo que apunta sin cascada, al final `users`
  // (que arrastra `estudiantes` y todo lo que cuelga de ella).
  const pasos = [
    ['pagos_examen_inscripciones', 'DELETE FROM pagos_examen_inscripciones'],
    ['pagos_grupales_examenes',    'DELETE FROM pagos_grupales_examenes'],
    ['pagos_grupales',             'DELETE FROM pagos_grupales'],
    ['pagos_examen',               'DELETE FROM pagos_examen'],
    ['examenes_inscripciones',     'DELETE FROM examenes_inscripciones'],
    ['horarios de ensayo',         `DELETE FROM convocatorias_modulos_horarios WHERE etapa_id IN (SELECT id FROM convocatorias_etapas WHERE clave LIKE 'ENSAYO%')`],
    ['sedes de ensayo',            `DELETE FROM convocatorias_etapas_sedes WHERE etapa_id IN (SELECT id FROM convocatorias_etapas WHERE clave LIKE 'ENSAYO%')`],
    ['etapa de ensayo',            `DELETE FROM convocatorias_etapas WHERE clave LIKE 'ENSAYO%'`],
    ['chat_mensajes',              'DELETE FROM chat_mensajes'],
    ['chat_conversaciones',        'DELETE FROM chat_conversaciones'],
    ['notificaciones',             'DELETE FROM notificaciones'],
    ['recordatorios_enviados',     'DELETE FROM recordatorios_enviados'],
    ['documentos (tabla vieja)',   'DELETE FROM documentos'],
    ['solicitudes_cuenta',         'DELETE FROM solicitudes_cuenta'],
    ['tutoriales_vistos (todos)',  'DELETE FROM tutoriales_vistos'],
    ['sesiones',                   `DELETE FROM sesiones WHERE user_id IN (SELECT id FROM users WHERE rol = 'estudiante')`],
    ['preferencias_usuario',       `DELETE FROM preferencias_usuario WHERE user_id IN (SELECT id FROM users WHERE rol = 'estudiante')`],
    // ── De aqui para abajo NO se confia en ninguna cascada. El esquema las
    // declara, pero la base real se creo antes y sus FKs son NO ACTION:
    // drizzle-kit push no altera FKs existentes. Lo probo el primer intento de
    // este script: fallo en subido_por_user_id y se revirtio completo. Cada
    // tabla hija se borra explicitamente, hijos antes que padres.
    ['inscripcion_modulos',        'DELETE FROM inscripcion_modulos'],
    ['inscripciones',              'DELETE FROM inscripciones'],
    ['avisos_leidos',              'DELETE FROM avisos_leidos'],
    ['estudiantes_modulos_progreso', 'DELETE FROM estudiantes_modulos_progreso'],
    ['relacion_observaciones',     'DELETE FROM relacion_observaciones'],
    ['calificaciones',             'DELETE FROM calificaciones'],
    ['credenciales',               'DELETE FROM credenciales'],
    ['expediente_documentos',      'DELETE FROM expediente_documentos'],
    ['pagos',                      'DELETE FROM pagos'],
    ['aula_foro_votos (alumnos)',  `DELETE FROM aula_foro_votos WHERE user_id IN (SELECT id FROM users WHERE rol = 'estudiante')`],
    ['aula_foro (alumnos)',        `DELETE FROM aula_foro WHERE autor_user_id IN (SELECT id FROM users WHERE rol = 'estudiante')`],
    ['aula_entregas',              'DELETE FROM aula_entregas'],
    ['anuncios_vistos (alumnos)',  `DELETE FROM anuncios_vistos WHERE user_id IN (SELECT id FROM users WHERE rol = 'estudiante')`],
    ['chat_consentimientos (alumnos)', `DELETE FROM chat_consentimientos WHERE user_id IN (SELECT id FROM users WHERE rol = 'estudiante')`],
    ['bloqueos_edicion (alumnos)', `DELETE FROM bloqueos_edicion WHERE user_id IN (SELECT id FROM users WHERE rol = 'estudiante')`],
    ['firmas_usuario (alumnos)',   `DELETE FROM firmas_usuario WHERE user_id IN (SELECT id FROM users WHERE rol = 'estudiante')`],
    ['password_reset_tokens (alumnos)', `DELETE FROM password_reset_tokens WHERE user_id IN (SELECT id FROM users WHERE rol = 'estudiante')`],
    ['estudiantes',                'DELETE FROM estudiantes'],
    ['users (alumnos)',            `DELETE FROM users WHERE rol = 'estudiante'`],
  ];
  for (const [nombre, q] of pasos) {
    try {
      const r = await cliente.query(q);
      console.log(`   ✓ ${nombre}: ${r.rowCount} fila(s)`);
    } catch (e) {
      // Una tabla que no existe en este despliegue no es un error del reinicio.
      if (e.code === '42P01') { console.log(`   – ${nombre}: la tabla no existe, se salta`); continue; }
      throw e;
    }
  }

  // Perfiles: crear contraseña al entrar + Reenviar habilitado + sesiones fuera.
  // La contraseña vigente sigue abriendo hasta que se reenvíe — el reenvío lo
  // hace una persona desde Accesos, no este script.
  const rp = await cliente.query(
    `UPDATE users
        SET password_temporal = true,
            bienvenida_enviada_en = NULL,
            sesiones_invalidadas_en = now(),
            updated_at = now()
      WHERE rol IN ('admin','gestor')`);
  console.log(`   ✓ perfiles reiniciados: ${rp.rowCount}`);

  await cliente.query('COMMIT');

  // Los archivos, ya con la transacción confirmada.
  let borrados = 0, huerfanos = 0;
  for (const r of archivos) {
    if (!r || r.startsWith('PRUEBA-SIN-ARCHIVO')) continue;
    try { await fs.rm(path.join(STORAGE, r), { force: true }); borrados++; }
    catch { huerfanos++; console.error(`   ⚠ no se pudo borrar el archivo: ${r}`); }
  }
  console.log(`   ✓ archivos del almacenamiento: ${borrados} borrado(s)${huerfanos ? `, ${huerfanos} huérfano(s) A REVISAR` : ''}`);

  console.log(`\nListo. La plataforma quedó vacía de alumnos y con los perfiles reiniciados.
Siguientes pasos (a mano, en este orden):
  1. Reinicia el contenedor para que las sesiones invalidadas surtan efecto:
       docker restart modula22
  2. Desde Accesos, «Reenviar primer acceso» a quien vaya a entrar (Velia, etc.).
  3. El creador entra igual que siempre: su contraseña no se tocó.\n`);
} catch (e) {
  await cliente.query('ROLLBACK').catch(() => {});
  console.error('\n✋ Falló y se revirtió todo. Nada quedó a medias:\n', e);
  process.exitCode = 1;
} finally {
  await cliente.end();
}
