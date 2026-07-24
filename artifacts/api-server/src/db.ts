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

  // Permisos de pago por centro de asesoría: la administración habilita/inhabilita
  // el pago individual y/o grupal por gestor. Default true → nadie pierde la
  // capacidad al desplegar; la admin la retira caso por caso. Ver schema.gestores.
  `ALTER TABLE gestores ADD COLUMN IF NOT EXISTS pago_individual_habilitado boolean NOT NULL DEFAULT true`,
  `ALTER TABLE gestores ADD COLUMN IF NOT EXISTS pago_grupal_habilitado boolean NOT NULL DEFAULT true`,

  // Preguntas frecuentes administrables. Ver schema.preguntasFrecuentes.
  `CREATE TABLE IF NOT EXISTS preguntas_frecuentes (
     id serial PRIMARY KEY,
     pregunta varchar(300) NOT NULL,
     respuesta text NOT NULL,
     categoria varchar(60) NOT NULL DEFAULT 'General',
     audiencia varchar(20) NOT NULL DEFAULT 'ambos',
     orden integer NOT NULL DEFAULT 0,
     activa boolean NOT NULL DEFAULT true,
     created_at timestamp NOT NULL DEFAULT now(),
     updated_at timestamp NOT NULL DEFAULT now()
   )`,
  // Semilla inicial SOLO si la tabla está vacía (no re-siembra tras ediciones).
  `INSERT INTO preguntas_frecuentes (pregunta, respuesta, categoria, audiencia, orden)
   SELECT * FROM (VALUES
     ('¿Cómo doy de alta a un alumno?', 'Entra a "Nuevo alumno", captura sus datos y sube los 5 documentos obligatorios (CURP, acta, identificación, comprobante de domicilio y certificado de secundaria). La administración revisa el expediente y asigna la matrícula.', 'Alumnos', 'gestor', 10),
     ('¿Cómo hago un pago grupal?', 'En "Pagos" → "Nuevo pago" elige "Pago grupal", selecciona los exámenes de varios alumnos y solicita la ficha. La coordinación la emite con su línea de captura.', 'Pagos', 'gestor', 20),
     ('¿Cuántos módulos puede llevar un alumno por convocatoria?', 'Máximo 4 módulos por convocatoria.', 'Inscripción', 'ambos', 30),
     ('¿Qué documentos necesita el expediente?', 'Cinco: CURP, acta de nacimiento, identificación, comprobante de domicilio y certificado de secundaria. Todos deben quedar aprobados para poder inscribir a examen.', 'Documentos', 'ambos', 40),
     ('¿Con cuánto se aprueba un módulo?', 'Con 60 de calificación mínima.', 'Calificaciones', 'estudiante', 50),
     ('¿Cuánto cuesta el examen?', 'El derecho de examen es de 145 pesos por módulo. El pago se hace ante la Tesorería del Estado con la línea de captura.', 'Pagos', 'ambos', 60)
   ) AS v(pregunta, respuesta, categoria, audiencia, orden)
   WHERE NOT EXISTS (SELECT 1 FROM preguntas_frecuentes)`,

  // "Principal": las 5 destacadas por categoría se muestran en el listado del
  // Centro de ayuda; el resto solo aparece en el buscador.
  `ALTER TABLE preguntas_frecuentes ADD COLUMN IF NOT EXISTS principal boolean NOT NULL DEFAULT false`,
  // Marca como principales las semillas originales SOLO la primera vez (cuando
  // aún no hay ninguna principal), para no pisar lo que la administración
  // destaque o quite después.
  `UPDATE preguntas_frecuentes SET principal = true
   WHERE NOT EXISTS (SELECT 1 FROM preguntas_frecuentes WHERE principal = true)
     AND pregunta IN (
       '¿Cómo doy de alta a un alumno?',
       '¿Cómo hago un pago grupal?',
       '¿Cuántos módulos puede llevar un alumno por convocatoria?',
       '¿Qué documentos necesita el expediente?',
       '¿Con cuánto se aprueba un módulo?',
       '¿Cuánto cuesta el examen?'
     )`,
  // Banco ampliado de preguntas frecuentes (10 por categoría; 5 principales).
  // Cada fila se inserta solo si aún no existe (idempotente por texto de pregunta).
  `INSERT INTO preguntas_frecuentes (pregunta, respuesta, categoria, audiencia, orden, principal)
   SELECT v.pregunta, v.respuesta, v.categoria, v.audiencia, v.orden, v.principal FROM (VALUES
     ('¿Cómo doy de alta a un alumno?', 'Entra a "Nuevo alumno", captura sus datos y sube los 5 documentos obligatorios (CURP, acta, identificación, comprobante de domicilio y certificado de secundaria). La administración revisa el expediente y asigna la matrícula.', 'Alumnos', 'gestor', 101, true),
     ('¿Cómo se asigna la matrícula de un alumno?', 'La administración la asigna cuando el expediente queda 5/5 aprobado. Mientras tanto el alumno aparece como "esperando matrícula".', 'Alumnos', 'gestor', 102, true),
     ('¿Qué significa que un alumno no sea elegible para inscribir?', 'Le falta la matrícula oficial o su expediente no está 5/5 aprobado. En cuanto tenga ambos, aparece como elegible.', 'Alumnos', 'gestor', 103, true),
     ('¿Cómo busco a un alumno?', 'En "Mis alumnos" usa el buscador por nombre o matrícula.', 'Alumnos', 'gestor', 104, true),
     ('¿Puedo editar los datos de un alumno después de darlo de alta?', 'Sí, desde su perfil en "Mis alumnos" y "Ver perfil". Si ya tiene matrícula y cambias datos oficiales, avisa a la administración.', 'Alumnos', 'gestor', 105, true),
     ('¿Un alumno puede estar en dos centros de asesoría a la vez?', 'No. Cada alumno pertenece a un solo centro de asesoría (gestor).', 'Alumnos', 'gestor', 106, false),
     ('¿Qué hago si registré mal la CURP de un alumno?', 'Corrígela desde su perfil; el sistema la valida. Si el alumno ya tiene matrícula, avisa a la administración.', 'Alumnos', 'gestor', 107, false),
     ('¿Cómo veo el avance de un alumno?', 'En su perfil aparecen los módulos inscritos, sus calificaciones y el estado del expediente.', 'Alumnos', 'gestor', 108, false),
     ('¿Puedo dar de baja a un alumno?', 'La baja definitiva la maneja la administración. Contáctala indicando el motivo.', 'Alumnos', 'gestor', 109, false),
     ('¿El alumno necesita correo para registrarse?', 'Sí. El correo es su usuario de acceso al portal.', 'Alumnos', 'ambos', 110, false)
   ) AS v(pregunta, respuesta, categoria, audiencia, orden, principal)
   WHERE NOT EXISTS (SELECT 1 FROM preguntas_frecuentes pf WHERE pf.pregunta = v.pregunta)`,

  `INSERT INTO preguntas_frecuentes (pregunta, respuesta, categoria, audiencia, orden, principal)
   SELECT v.pregunta, v.respuesta, v.categoria, v.audiencia, v.orden, v.principal FROM (VALUES
     ('¿Qué documentos necesita el expediente?', 'Cinco: CURP, acta de nacimiento, identificación, comprobante de domicilio y certificado de secundaria. Todos deben quedar aprobados para poder inscribir a examen.', 'Documentos', 'ambos', 201, true),
     ('¿En qué formato subo los documentos?', 'Archivos legibles, en PDF o imagen clara. Cada documento se sube en su casilla correspondiente.', 'Documentos', 'ambos', 202, true),
     ('¿Por qué me rechazaron un documento?', 'Suele ser porque está ilegible, incompleto o no corresponde. Revisa el motivo del rechazo y vuelve a subirlo corregido.', 'Documentos', 'ambos', 203, true),
     ('¿Cuándo queda listo el expediente?', 'Cuando los 5 documentos obligatorios están aprobados (5/5).', 'Documentos', 'ambos', 204, true),
     ('¿Dónde veo el estado de mis documentos?', 'En el expediente cada documento muestra si está aprobado, pendiente de revisión o rechazado.', 'Documentos', 'ambos', 205, true),
     ('¿La identificación puede ser cualquiera?', 'Debe ser una identificación oficial vigente, por ejemplo INE o pasaporte.', 'Documentos', 'ambos', 206, false),
     ('¿Qué vigencia debe tener el comprobante de domicilio?', 'De preferencia reciente. Confirma el requisito exacto en la convocatoria vigente.', 'Documentos', 'ambos', 207, false),
     ('¿Puedo reemplazar un documento ya aprobado?', 'Sí. Si necesitas corregirlo, súbelo de nuevo y quedará otra vez como pendiente de revisión.', 'Documentos', 'ambos', 208, false),
     ('¿Qué hago si no tengo el certificado de secundaria a la mano?', 'Es obligatorio para completar el expediente. Consíguelo con tu escuela o instancia emisora; sin él no se puede inscribir a examen.', 'Documentos', 'ambos', 209, false),
     ('¿El certificado de secundaria es obligatorio?', 'Sí, es uno de los 5 documentos obligatorios del expediente.', 'Documentos', 'ambos', 210, false)
   ) AS v(pregunta, respuesta, categoria, audiencia, orden, principal)
   WHERE NOT EXISTS (SELECT 1 FROM preguntas_frecuentes pf WHERE pf.pregunta = v.pregunta)`,

  `INSERT INTO preguntas_frecuentes (pregunta, respuesta, categoria, audiencia, orden, principal)
   SELECT v.pregunta, v.respuesta, v.categoria, v.audiencia, v.orden, v.principal FROM (VALUES
     ('¿Cuántos módulos puede llevar un alumno por convocatoria?', 'Máximo 4 módulos por convocatoria. El sistema no deja pasar de ahí.', 'Inscripción', 'ambos', 301, true),
     ('¿Cuándo puedo inscribir a examen?', 'Solo dentro de la ventana de solicitud de la etapa. Fuera de esa ventana el sistema no permite inscribir.', 'Inscripción', 'ambos', 302, true),
     ('¿Cómo inscribo a varios alumnos a la vez?', 'En "Inscripción" (en lote): eliges el o los módulos, luego a los alumnos elegibles y confirmas.', 'Inscripción', 'gestor', 303, true),
     ('¿Cómo se eligen las sedes de examen?', 'Las define la convocatoria. El alumno elige entre las sedes habilitadas para esa etapa.', 'Inscripción', 'ambos', 304, true),
     ('¿Puedo inscribir un módulo que el alumno ya trae?', 'No. El sistema omite los módulos que ya tiene inscritos y respeta el máximo de 4.', 'Inscripción', 'gestor', 305, true),
     ('¿Qué pasa si dos módulos son el mismo día y hora?', 'Están empalmados: solo puedes elegir uno de ese bloque, porque nadie presenta dos exámenes a la vez.', 'Inscripción', 'ambos', 306, false),
     ('¿Cuándo son los exámenes?', 'En sábado y domingo, en los horarios que marca la etapa (por lo general 9:00 y 11:00). Confirma la fecha en la convocatoria.', 'Inscripción', 'ambos', 307, false),
     ('¿Puedo cambiar de módulo después de inscribir?', 'Dentro de la ventana, consúltalo con tu centro o con la administración. Fuera de la ventana ya no se puede.', 'Inscripción', 'ambos', 308, false),
     ('¿Cuántas etapas de inscripción hay al año?', 'El calendario contempla varias etapas cortas a lo largo del año. Revísalas en "Convocatorias".', 'Inscripción', 'ambos', 309, false),
     ('¿La inscripción tiene costo?', 'La inscripción no. Lo que se paga es el derecho de examen: 145 pesos por módulo.', 'Inscripción', 'ambos', 310, false)
   ) AS v(pregunta, respuesta, categoria, audiencia, orden, principal)
   WHERE NOT EXISTS (SELECT 1 FROM preguntas_frecuentes pf WHERE pf.pregunta = v.pregunta)`,

  `INSERT INTO preguntas_frecuentes (pregunta, respuesta, categoria, audiencia, orden, principal)
   SELECT v.pregunta, v.respuesta, v.categoria, v.audiencia, v.orden, v.principal FROM (VALUES
     ('¿Cuánto cuesta el examen?', 'El derecho de examen es de 145 pesos por módulo. El pago se hace ante la Tesorería del Estado con la línea de captura.', 'Pagos', 'ambos', 401, true),
     ('¿Cómo hago un pago grupal?', 'En "Pagos" eliges los exámenes de varios alumnos y solicitas la ficha grupal. La administración la emite con su línea de captura.', 'Pagos', 'gestor', 402, true),
     ('¿Quién emite la línea de captura?', 'La emite el Estado y la administración la carga en la ficha. Módula no cobra: solo almacena y concilia.', 'Pagos', 'ambos', 403, true),
     ('¿Cuándo se paga?', 'En los días hábiles siguientes al cierre de la ventana de inscripción, cuando la administración manda el pago.', 'Pagos', 'ambos', 404, true),
     ('¿Dónde subo el comprobante de pago?', 'En la ficha de pago correspondiente, mientras se concilia contra la plataforma del Estado.', 'Pagos', 'ambos', 405, true),
     ('¿Puedo pagar individual en vez de grupal?', 'Depende de lo que la administración habilite para tu centro: puede tener activado el pago individual, el grupal o ambos.', 'Pagos', 'gestor', 406, false),
     ('¿Qué es una ficha por emitir?', 'Es la orden de pago ya armada que espera a que la administración capture la línea de captura.', 'Pagos', 'ambos', 407, false),
     ('¿La ficha de pago tiene fecha de vencimiento?', 'Sí. Si no se paga a tiempo, la ficha vence y hay que solicitarla de nuevo dentro de la ventana.', 'Pagos', 'ambos', 408, false),
     ('¿Módula recibe el dinero del pago?', 'No. El cobro lo hace la Tesorería del Estado. Módula solo almacena la línea de captura y concilia el pago.', 'Pagos', 'ambos', 409, false),
     ('¿Puedo juntar pagos de varias etapas en una ficha?', 'No. Cada ficha corresponde a los exámenes de una misma etapa.', 'Pagos', 'ambos', 410, false)
   ) AS v(pregunta, respuesta, categoria, audiencia, orden, principal)
   WHERE NOT EXISTS (SELECT 1 FROM preguntas_frecuentes pf WHERE pf.pregunta = v.pregunta)`,

  `INSERT INTO preguntas_frecuentes (pregunta, respuesta, categoria, audiencia, orden, principal)
   SELECT v.pregunta, v.respuesta, v.categoria, v.audiencia, v.orden, v.principal FROM (VALUES
     ('¿Con cuánto se aprueba un módulo?', 'Con 60 de calificación mínima.', 'Calificaciones', 'estudiante', 501, true),
     ('¿Dónde veo mis calificaciones?', 'En "Calificaciones" o en tu perfil, una vez que la administración las captura.', 'Calificaciones', 'estudiante', 502, true),
     ('¿Cuándo salen las calificaciones?', 'Después de que se aplica el examen y la administración carga los resultados.', 'Calificaciones', 'ambos', 503, true),
     ('¿Qué pasa si repruebo un módulo?', 'Puedes volver a presentarlo en una etapa posterior, con una nueva inscripción y su pago.', 'Calificaciones', 'ambos', 504, true),
     ('¿Cuántos módulos tiene el Plan 22?', 'El Plan 22 son 22 módulos en total.', 'Calificaciones', 'ambos', 505, true),
     ('¿Cómo obtengo mi certificado al terminar?', 'Al acreditar los 22 módulos, la administración gestiona la certificación correspondiente.', 'Calificaciones', 'ambos', 506, false),
     ('¿La calificación se puede corregir?', 'Si hubo un error, la administración es quien la ajusta con el soporte correspondiente.', 'Calificaciones', 'gestor', 507, false),
     ('¿Debo llevar los módulos en un orden?', 'Se recomienda seguir el orden sugerido del plan, respetando el máximo de 4 módulos por convocatoria.', 'Calificaciones', 'ambos', 508, false),
     ('¿El examen es presencial?', 'Sí. Se presenta en la sede y el horario asignados para la etapa.', 'Calificaciones', 'ambos', 509, false),
     ('¿Puedo ver el historial de mis módulos acreditados?', 'Sí. En tu perfil aparece el avance por módulo.', 'Calificaciones', 'estudiante', 510, false)
   ) AS v(pregunta, respuesta, categoria, audiencia, orden, principal)
   WHERE NOT EXISTS (SELECT 1 FROM preguntas_frecuentes pf WHERE pf.pregunta = v.pregunta)`,

  // Padrón histórico (alumnos que ya existen en la base del Estado). Ver
  // schema.padronHistorico. Los datos se cargan por la pantalla de importación,
  // nunca desde el repo (son datos personales reales).
  `CREATE TABLE IF NOT EXISTS padron_historico (
     id serial PRIMARY KEY,
     matricula varchar(20) NOT NULL UNIQUE,
     curp varchar(20),
     primer_apellido varchar(120),
     segundo_apellido varchar(120),
     nombre varchar(160),
     sexo varchar(1),
     fecha_nacimiento date,
     fecha_alta date,
     created_at timestamp NOT NULL DEFAULT now(),
     updated_at timestamp NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS padron_historico_curp_idx ON padron_historico (curp)`,

  // Lock por arrendamiento para trabajos programados (ver schema.jobLocks).
  `CREATE TABLE IF NOT EXISTS job_locks (
     nombre varchar(60) PRIMARY KEY,
     bloqueado_hasta timestamp NOT NULL
   )`,
];

export async function runStartupMigrations() {
  for (const sql of migrations) {
    await pool.query(sql).catch((err: unknown) => {
      console.warn('[db] startup migration warning:', err);
    });
  }
}
