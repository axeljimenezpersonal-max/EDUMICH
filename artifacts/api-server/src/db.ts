import { db, pool } from '@workspace/db';

export { db };

// Migraciones incrementales seguras (IF NOT EXISTS = idempotente).
// Se ejecutan al iniciar el servidor para mantener el esquema al día
// sin depender de drizzle-kit push en producción.

const migrations = [
  // Corte de sesiones por usuario (revocación real sin consultar por petición)
  `ALTER TABLE users
     ADD COLUMN IF NOT EXISTS sesiones_invalidadas_en timestamp`,
  `ALTER TABLE estudiantes_modulos_progreso
     ADD COLUMN IF NOT EXISTS temas_debiles jsonb`,
  // Búsqueda de cuenta por nombre sin sensibilidad a acentos
  `CREATE EXTENSION IF NOT EXISTS unaccent`,
  // Rol de dirección de programa (perfil ejecutivo solo-lectura)
  `ALTER TYPE rol ADD VALUE IF NOT EXISTS 'direccion'`,
  // Tipos de notificación para renovación de credencial
  `ALTER TYPE notif_tipo ADD VALUE IF NOT EXISTS 'credencial_renovada'`,
  `ALTER TYPE notif_tipo ADD VALUE IF NOT EXISTS 'solicitud_renovacion_credencial'`,
  `CREATE TABLE IF NOT EXISTS directores (
     user_id integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
     nombre_completo varchar(200) NOT NULL,
     puesto varchar(120) DEFAULT 'Dirección de Programa',
     email_publico varchar(255),
     telefono_publico varchar(30),
     created_at timestamp NOT NULL DEFAULT now()
   )`,
  // Concepto "derecho de examen" a $145 (Tesorería del Estado). Idempotente:
  // solo se siembra si no existe; ediciones posteriores del admin persisten.
  `INSERT INTO conceptos_pago (clave, nombre, descripcion, monto, vigencia, activo)
     VALUES ('derecho_examen', 'Derecho de examen', 'Pago de derecho de examen ante la Tesorería del Estado', 145.00, 2026, true)
     ON CONFLICT (clave) DO NOTHING`,
  // Renombre de marca "Prepa Abierta" → "Preparatoria Abierta" en datos ya
  // sembrados en producción. Idempotente (solo afecta filas con el texto viejo).
  `UPDATE plantillas_correo SET
     asunto = REPLACE(asunto, 'Prepa Abierta', 'Preparatoria Abierta'),
     contenido_html = REPLACE(contenido_html, 'Prepa Abierta', 'Preparatoria Abierta'),
     contenido_texto = REPLACE(COALESCE(contenido_texto, ''), 'Prepa Abierta', 'Preparatoria Abierta')
     WHERE asunto LIKE '%Prepa Abierta%' OR contenido_html LIKE '%Prepa Abierta%' OR contenido_texto LIKE '%Prepa Abierta%'`,
  `UPDATE conceptos_pago SET descripcion = REPLACE(descripcion, 'Prepa Abierta', 'Preparatoria Abierta') WHERE descripcion LIKE '%Prepa Abierta%'`,
  `UPDATE outbox SET from_name = REPLACE(from_name, 'Prepa Abierta', 'Preparatoria Abierta') WHERE from_name LIKE '%Prepa Abierta%'`,
  // Reformateo de folio de pre-registro: PRE-<año>-MICH-<consec> → PREF-<consec>-<MM>-<YYYY>.
  // Mes/año de la fecha de emisión (o de creación como respaldo). Idempotente: los
  // folios ya reformateados empiezan con 'PREF-' y no vuelven a coincidir.
  `UPDATE estudiantes
     SET folio_preregistro =
       'PREF-' || LPAD(SUBSTRING(folio_preregistro FROM '([0-9]+)$'), 6, '0')
       || '-' || LPAD(EXTRACT(MONTH FROM COALESCE(preregistro_generado_en, created_at))::text, 2, '0')
       || '-' || EXTRACT(YEAR FROM COALESCE(preregistro_generado_en, created_at))::text
     WHERE folio_preregistro LIKE 'PRE-%MICH-%'`,
  // Correo de solicitud rechazada (outbox).
  `ALTER TYPE outbox_evento ADD VALUE IF NOT EXISTS 'solicitud_rechazada'`,
  // Solicitud de cuenta: preferencia de gestor.
  `ALTER TABLE solicitudes_cuenta ADD COLUMN IF NOT EXISTS quiere_info_gestores boolean NOT NULL DEFAULT false`,
  // Admin: perfil confirmado (bloquea nombre/cargo/tel tras la primera vez).
  `ALTER TABLE administradores ADD COLUMN IF NOT EXISTS perfil_confirmado boolean NOT NULL DEFAULT false`,
  // Chat con la Secretaría: nuevo tipo de notificación + tablas.
  `ALTER TYPE notif_tipo ADD VALUE IF NOT EXISTS 'chat_mensaje'`,
  `CREATE TABLE IF NOT EXISTS chat_conversaciones (
     id serial PRIMARY KEY,
     participante_user_id integer NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
     participante_rol varchar(20) NOT NULL,
     asunto varchar(160),
     cerrada boolean NOT NULL DEFAULT false,
     ultimo_mensaje_en timestamp NOT NULL DEFAULT now(),
     ultimo_mensaje_texto varchar(300),
     no_leidos_admin integer NOT NULL DEFAULT 0,
     no_leidos_participante integer NOT NULL DEFAULT 0,
     created_at timestamp NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS chat_mensajes (
     id serial PRIMARY KEY,
     conversacion_id integer NOT NULL REFERENCES chat_conversaciones(id) ON DELETE CASCADE,
     remitente_user_id integer NOT NULL REFERENCES users(id),
     remitente_rol varchar(20) NOT NULL,
     es_secretaria boolean NOT NULL DEFAULT false,
     cuerpo text NOT NULL,
     created_at timestamp NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS chat_mensajes_conv_idx ON chat_mensajes(conversacion_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS chat_consentimientos (
     id serial PRIMARY KEY,
     user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     rol varchar(20) NOT NULL,
     aceptado_en timestamp NOT NULL DEFAULT now(),
     ip varchar(60)
   )`,
  // Tutoriales vistos por usuario y etapa (antes en localStorage: se perdían al
  // cambiar de dispositivo o limpiar el navegador). Ver schema.tutorialesVistos
  // para el porqué de la clave (user_id, clave, etapa).
  `CREATE TABLE IF NOT EXISTS tutoriales_vistos (
     id serial PRIMARY KEY,
     user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     clave varchar(80) NOT NULL,
     etapa varchar(60) NOT NULL DEFAULT '',
     completado_en timestamp NOT NULL DEFAULT now()
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS tutoriales_vistos_uq ON tutoriales_vistos(user_id, clave, etapa)`,
  `CREATE INDEX IF NOT EXISTS tutoriales_vistos_user_idx ON tutoriales_vistos(user_id)`,
  // Sedes habilitadas por etapa: la convocatoria define dónde se puede presentar
  // y el alumno elige una al inscribirse. Ver schema.convocatoriasEtapasSedes.
  `CREATE TABLE IF NOT EXISTS convocatorias_etapas_sedes (
     id serial PRIMARY KEY,
     etapa_id integer NOT NULL REFERENCES convocatorias_etapas(id) ON DELETE CASCADE,
     sede_id integer NOT NULL REFERENCES sedes(id) ON DELETE CASCADE,
     cupo integer,
     created_at timestamp NOT NULL DEFAULT now()
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS convocatorias_etapas_sedes_uq ON convocatorias_etapas_sedes(etapa_id, sede_id)`,
  `CREATE INDEX IF NOT EXISTS convocatorias_etapas_sedes_etapa_idx ON convocatorias_etapas_sedes(etapa_id)`,
  // Avisos del ciclo de la orden de pago. Ver utils/notificarPago.ts.
  `ALTER TYPE notif_tipo ADD VALUE IF NOT EXISTS 'pago_por_emitir'`,
  `ALTER TYPE notif_tipo ADD VALUE IF NOT EXISTS 'orden_pago_emitida'`,
  `ALTER TYPE notif_tipo ADD VALUE IF NOT EXISTS 'pago_rechazado'`,
  `ALTER TYPE notif_tipo ADD VALUE IF NOT EXISTS 'pago_vencido'`,

  // ── Credencial digital: historial de emisiones ────────────────────────────
  // Antes el folio vivía como columna suelta en `estudiantes` y la reposición lo
  // SOBRESCRIBÍA: el folio viejo desaparecía y una credencial impresa dejaba de
  // resolver sin que nadie pudiera explicar por qué. Ahora cada emisión es una
  // fila y la reposición es baja lógica + alta. Ver schema.credenciales.
  `DO $$ BEGIN
     CREATE TYPE credencial_estado AS ENUM ('activa','repuesta','cancelada');
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
     CREATE TYPE credencial_motivo AS ENUM ('emision','reposicion','vencimiento','correccion');
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `CREATE TABLE IF NOT EXISTS credenciales (
     id serial PRIMARY KEY,
     estudiante_id integer NOT NULL REFERENCES estudiantes(user_id) ON DELETE CASCADE,
     folio varchar(40) NOT NULL,
     estado credencial_estado NOT NULL DEFAULT 'activa',
     motivo credencial_motivo NOT NULL DEFAULT 'emision',
     emitida_en timestamp NOT NULL DEFAULT now(),
     emitida_por integer REFERENCES users(id) ON DELETE SET NULL,
     vigente_hasta timestamp,
     reemplazada_por_id integer REFERENCES credenciales(id) ON DELETE SET NULL,
     notas text,
     created_at timestamp NOT NULL DEFAULT now(),
     updated_at timestamp NOT NULL DEFAULT now()
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS credenciales_folio_uq ON credenciales(folio)`,
  `CREATE INDEX IF NOT EXISTS credenciales_estudiante_idx ON credenciales(estudiante_id, emitida_en)`,
  // Un alumno no puede tener dos credenciales activas al mismo tiempo.
  `CREATE UNIQUE INDEX IF NOT EXISTS credenciales_una_activa_uq
     ON credenciales(estudiante_id) WHERE estado = 'activa'`,
  // Backfill idempotente: las credenciales ya emitidas viven hoy solo como
  // columnas en `estudiantes`. Se traen como la fila 'activa' de cada alumno.
  `INSERT INTO credenciales (estudiante_id, folio, estado, motivo, emitida_en, emitida_por)
     SELECT e.user_id, e.licencia_digital, 'activa', 'emision',
            COALESCE(e.licencia_emitida_en, now()), e.licencia_emitida_por
       FROM estudiantes e
      WHERE e.licencia_digital IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM credenciales c WHERE c.folio = e.licencia_digital)`,

  // La tabla de verificaciones existía a mano en la base: sin esto, un entorno
  // nuevo (AWS) no la creaba y el traqueo de escaneos se perdía en silencio.
  `CREATE TABLE IF NOT EXISTS credenciales_verificaciones (
     id serial PRIMARY KEY,
     estudiante_id integer REFERENCES estudiantes(user_id) ON DELETE SET NULL,
     folio varchar(60) NOT NULL,
     firma_valida boolean NOT NULL DEFAULT false,
     resultado varchar(30) NOT NULL,
     verificado_por integer REFERENCES users(id) ON DELETE SET NULL,
     created_at timestamp NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS credverif_estudiante_idx ON credenciales_verificaciones(estudiante_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS credverif_folio_idx ON credenciales_verificaciones(folio, created_at)`,
  // El folio de credencial es único (parcial: muchos alumnos aún no tienen).
  `CREATE UNIQUE INDEX IF NOT EXISTS estudiantes_licencia_digital_uq
     ON estudiantes(licencia_digital) WHERE licencia_digital IS NOT NULL`,

  // Telemetría de uso: contadores por (día, rol, tipo, clave). Sin user_id
  // a propósito — ver el comentario de la tabla en el esquema.
  `CREATE TABLE IF NOT EXISTS uso_diario (
     id serial PRIMARY KEY,
     dia date NOT NULL,
     rol varchar(20) NOT NULL,
     tipo varchar(12) NOT NULL,
     clave varchar(80) NOT NULL,
     conteo integer NOT NULL DEFAULT 0,
     actualizado_en timestamp NOT NULL DEFAULT now()
   )`,
  // El ON CONFLICT de la ingesta depende de este índice único.
  `CREATE UNIQUE INDEX IF NOT EXISTS uso_diario_unico_idx
     ON uso_diario(dia, rol, tipo, clave)`,
  `CREATE INDEX IF NOT EXISTS uso_diario_consulta_idx ON uso_diario(dia, rol)`,

  // Accesos rápidos del inicio, aprobados a mano a partir de lo que sugiere
  // la telemetría.
  `CREATE TABLE IF NOT EXISTS accesos_rapidos (
     id serial PRIMARY KEY,
     rol varchar(20) NOT NULL,
     clave varchar(80) NOT NULL,
     etiqueta varchar(60) NOT NULL,
     orden integer NOT NULL DEFAULT 0,
     activo boolean NOT NULL DEFAULT true,
     creado_por integer REFERENCES users(id) ON DELETE SET NULL,
     created_at timestamp NOT NULL DEFAULT now()
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS accesos_rapidos_rol_clave_idx
     ON accesos_rapidos(rol, clave)`,
  `CREATE INDEX IF NOT EXISTS accesos_rapidos_rol_orden_idx
     ON accesos_rapidos(rol, orden)`,

  // Instantáneas diarias: sin esto la historia de los indicadores no existe,
  // y no se puede reconstruir después.
  `CREATE TABLE IF NOT EXISTS metricas_diarias (
     id serial PRIMARY KEY,
     dia date NOT NULL,
     clave varchar(60) NOT NULL,
     valor numeric(14,2) NOT NULL,
     actualizado_en timestamp NOT NULL DEFAULT now()
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS metricas_diarias_unico_idx
     ON metricas_diarias(dia, clave)`,
  `CREATE INDEX IF NOT EXISTS metricas_diarias_clave_idx
     ON metricas_diarias(clave, dia)`,

  // Bloqueos de edición concurrente ("candado suave" con latido). Impide que
  // dos colaboradores editen a la vez el mismo recurso sensible. El candado se
  // considera vivo mientras `refrescado_en` sea reciente; expira solo si el
  // cliente deja de latir. Ver schema.bloqueosEdicion y routes/bloqueos.ts.
  `CREATE TABLE IF NOT EXISTS bloqueos_edicion (
     recurso varchar(120) PRIMARY KEY,
     user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     nombre varchar(200) NOT NULL,
     rol varchar(20) NOT NULL,
     adquirido_en timestamp NOT NULL DEFAULT now(),
     refrescado_en timestamp NOT NULL DEFAULT now()
   )`,
  // Barrido de candados vencidos hace tiempo (por si algún cliente nunca liberó).
  `CREATE INDEX IF NOT EXISTS bloqueos_edicion_refrescado_idx
     ON bloqueos_edicion(refrescado_en)`,
];

export async function runStartupMigrations() {
  for (const sql of migrations) {
    await pool.query(sql).catch((err: unknown) => {
      console.warn('[db] startup migration warning:', err);
    });
  }
}
