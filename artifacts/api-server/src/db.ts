import { db, pool } from '@workspace/db';

export { db };

// Migraciones incrementales seguras (IF NOT EXISTS = idempotente).
// Se ejecutan al iniciar el servidor para mantener el esquema al día
// sin depender de drizzle-kit push en producción.

const migrations = [
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
  `ALTER TABLE chat_mensajes ALTER COLUMN cuerpo SET DEFAULT ''`,
  `ALTER TABLE chat_mensajes ADD COLUMN IF NOT EXISTS adjunto_ruta varchar(500)`,
  `ALTER TABLE chat_mensajes ADD COLUMN IF NOT EXISTS adjunto_nombre varchar(255)`,
  `ALTER TABLE chat_mensajes ADD COLUMN IF NOT EXISTS adjunto_mime varchar(100)`,
  `CREATE TABLE IF NOT EXISTS chat_consentimientos (
     id serial PRIMARY KEY,
     user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     rol varchar(20) NOT NULL,
     aceptado_en timestamp NOT NULL DEFAULT now(),
     ip varchar(60)
   )`,
];

export async function runStartupMigrations() {
  for (const sql of migrations) {
    await pool.query(sql).catch((err: unknown) => {
      console.warn('[db] startup migration warning:', err);
    });
  }
}
