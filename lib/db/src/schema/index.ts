/**
 * Schema de base de datos — Prepa Abierta Michoacán
 *
 * Modelo central:
 *   users → (gestores | estudiantes | administradores)
 *   municipios y módulos son catálogos.
 *   convocatorias y inscripciones son las entidades cíclicas.
 *   La tabla `inscripciones` es la pivote de seguimiento del alumno en una convocatoria.
 *
 * Ubicación destino en Replit: lib/db/src/schema/index.ts
 */

import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  date,
  pgEnum,
  uniqueIndex,
  index,
  jsonb,
  bigint,
  numeric,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─────────────────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────────────────

export const rolEnum = pgEnum('rol', ['admin', 'gestor', 'estudiante', 'direccion']);

export const estadoCuentaEnum = pgEnum('estado_cuenta', [
  'activa',
  'aviso_enviado',
  'soft_deleted',
  'hard_deleted',
]);

export const avisosPrioridadEnum = pgEnum('avisos_prioridad', [
  'informativo',
  'importante',
  'urgente',
]);

export const solicitudEstadoEnum = pgEnum('solicitud_estado', [
  'pendiente',
  'aprobada',
  'rechazada',
]);

export const modalidadPreferidaEnum = pgEnum('modalidad_preferida', [
  'con_gestor',
  'auto_gestion',
]);

export const convocatoriaEstadoEnum = pgEnum('convocatoria_estado', [
  'borrador',
  'abierta',
  'cerrada',
  'concluida',
]);

export const inscripcionEstadoEnum = pgEnum('inscripcion_estado', [
  'pre_registro',
  'documentos_pendientes',
  'documentos_completos',
  'pago_pendiente',
  'pago_verificado',
  'ficha_generada',
  'confirmado_alumno',
  'registrado',
  'en_curso',
  'evaluado',
]);

export const documentoEstadoEnum = pgEnum('documento_estado', [
  'pendiente_revision',
  'aprobado',
  'rechazado',
]);

export const expedienteDocEstadoEnum = pgEnum('expediente_doc_estado', [
  'pendiente_revision',
  'aprobado',
  'rechazado',
]);

export const pagoConceptoEnum = pgEnum('pago_concepto', [
  'derecho_examen',
  'examen_extraordinario',
  'reposicion_credencial',
  'duplicado_acta',
  'otro',
]);

export const pagoMetodoEnum = pgEnum('pago_metodo', [
  'spei',
  'banco_deposito',
  'tienda_conveniencia',
  'efectivo',
  'otro',
]);

export const pagoEstadoEnum = pgEnum('pago_estado', [
  'pendiente',
  'verificado',
  'rechazado',
]);

export const gestorEstadoEnum = pgEnum('gestor_estado', ['activo', 'inactivo']);

export const anuncioPrioridadEnum = pgEnum('anuncio_prioridad', [
  'informativo',
  'importante',
  'urgente',
]);

export const anuncioAudienciaEnum = pgEnum('anuncio_audiencia', [
  'todos',
  'alumnos',
  'gestores',
  'alumnos_municipio',
  'alumnos_etapa',
  'gestor_especifico',
]);

export const anuncioEstadoEnum = pgEnum('anuncio_estado', [
  'borrador',
  'publicado',
  'archivado',
]);

// ─────────────────────────────────────────────────────────────────────────
// Catálogos (entidades estables)
// ─────────────────────────────────────────────────────────────────────────

export const municipios = pgTable(
  'municipios',
  {
    id: serial('id').primaryKey(),
    nombre: varchar('nombre', { length: 120 }).notNull(),
    estado: varchar('estado', { length: 80 }).notNull().default('Michoacán'),
    activo: boolean('activo').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    nombreEstadoIdx: uniqueIndex('municipios_nombre_estado_idx').on(t.nombre, t.estado),
  })
);

export const modulos = pgTable(
  'modulos',
  {
    id: serial('id').primaryKey(),
    numero: integer('numero').notNull(), // 1..21
    nombre: varchar('nombre', { length: 200 }).notNull(),
    descripcion: text('descripcion'),
    nivel: integer('nivel'), // nivel del plan modular (1-4)
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    numeroIdx: uniqueIndex('modulos_numero_idx').on(t.numero),
  })
);

// Temas son las subdivisiones de cada módulo (Unidades / Sections)
export const temas = pgTable('temas', {
  id: serial('id').primaryKey(),
  moduloId: integer('modulo_id')
    .notNull()
    .references(() => modulos.id, { onDelete: 'cascade' }),
  nombre: varchar('nombre', { length: 240 }).notNull(),
  orden: integer('orden').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────
// Usuarios y perfiles
// ─────────────────────────────────────────────────────────────────────────

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    rol: rolEnum('rol').notNull(),
    activo: boolean('activo').notNull().default(true),
    passwordTemporal: boolean('password_temporal').notNull().default(true),
    bienvenidaEnviadaEn: timestamp('bienvenida_enviada_en'),
    privacidadAceptadaEn: timestamp('privacidad_aceptada_en'),
    ultimoLogin: timestamp('ultimo_login'),
    passwordCambiadoEn: timestamp('password_cambiado_en'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex('users_email_idx').on(t.email),
    rolIdx: index('users_rol_idx').on(t.rol),
  })
);

export const gestores = pgTable('gestores', {
  userId: integer('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  nombreCompleto: varchar('nombre_completo', { length: 200 }).notNull(),
  telefono: varchar('telefono', { length: 30 }),
  emailPublico: varchar('email_publico', { length: 255 }),
  telefonoPublico: varchar('telefono_publico', { length: 30 }),
  municipioId: integer('municipio_id')
    .notNull()
    .references(() => municipios.id),
  // Datos del centro de asesoría (para la Relación de exámenes solicitados)
  centroAsesoria: varchar('centro_asesoria', { length: 200 }),
  claveCentro: varchar('clave_centro', { length: 20 }),
  rfcCentro: varchar('rfc_centro', { length: 20 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  titulo: varchar('titulo', { length: 80 }).notNull().default('Gestor Municipal'),
  capacidadMaxima: integer('capacidad_maxima').notNull().default(50),
  estado: gestorEstadoEnum('estado').notNull().default('activo'),
  fechaIngreso: date('fecha_ingreso').notNull().defaultNow(),
  ultimoAccesoEn: timestamp('ultimo_acceso_en'),
  desactivadoEn: timestamp('desactivado_en'),
  desactivadoPorUserId: integer('desactivado_por_user_id').references(() => users.id),
  razonDesactivacion: text('razon_desactivacion'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const estudiantes = pgTable(
  'estudiantes',
  {
    userId: integer('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    // nombreCompleto y direccion se MANTIENEN pero son DERIVADOS de las partes
    // (se arman al guardar). La fuente de verdad son los campos desglosados.
    nombreCompleto: varchar('nombre_completo', { length: 200 }).notNull(),
    nombres: varchar('nombres', { length: 120 }),
    apellidoPaterno: varchar('apellido_paterno', { length: 100 }),
    apellidoMaterno: varchar('apellido_materno', { length: 100 }),
    curp: varchar('curp', { length: 18 }),
    fechaNacimiento: date('fecha_nacimiento'),
    sexo: varchar('sexo', { length: 20 }), // 'hombre' | 'mujer' | 'no_definir'
    lugarNacimiento: varchar('lugar_nacimiento', { length: 120 }),
    entidadNacimiento: varchar('entidad_nacimiento', { length: 80 }),
    estadoCivil: varchar('estado_civil', { length: 30 }),
    ultimoEstudio: varchar('ultimo_estudio', { length: 120 }),
    telefono: varchar('telefono', { length: 30 }),
    direccion: text('direccion'),
    // dirección desglosada (fuente de verdad; direccion se deriva de estas)
    calleNumero: varchar('calle_numero', { length: 200 }),
    colonia: varchar('colonia', { length: 120 }),
    cp: varchar('cp', { length: 10 }),
    ciudad: varchar('ciudad', { length: 120 }),
    estadoDomicilio: varchar('estado_domicilio', { length: 80 }),
    observaciones: text('observaciones'), // opcional — se imprime en la cédula
    // PDF de calificaciones que sube la administración (preview + descarga)
    calificacionesPdfPath: varchar('calificaciones_pdf_path', { length: 500 }),
    calificacionesPdfSubidoEn: timestamp('calificaciones_pdf_subido_en'),
    municipioId: integer('municipio_id').references(() => municipios.id),
    gestorId: integer('gestor_id').references(() => users.id),
    emailVerificado: boolean('email_verificado').notNull().default(false),
    registroTipo: varchar('registro_tipo', { length: 20 }).default('gestor'),
    folioPreregistro: varchar('folio_preregistro', { length: 30 }),
    preregistroGeneradoEn: timestamp('preregistro_generado_en'),
    preregistroVigenteHasta: date('preregistro_vigente_hasta'),
    matriculaOficialDGB: varchar('matricula_oficial_dgb', { length: 30 }),
    matriculaCapturadaEn: timestamp('matricula_capturada_en'),
    matriculaCapturadaPor: integer('matricula_capturada_por').references(() => users.id),
    // ── Licencia digital ──
    licenciaDigital: varchar('licencia_digital', { length: 40 }),
    licenciaEmitidaEn: timestamp('licencia_emitida_en'),
    licenciaEmitidaPor: integer('licencia_emitida_por').references(() => users.id),
    genero: varchar('genero', { length: 20 }),
    nacionalidad: varchar('nacionalidad', { length: 50 }).default('Mexicana'),
    foto: varchar('foto', { length: 500 }),
    // ── Depuración automática de cuentas inactivas ──
    ultimaActividadEn: timestamp('ultima_actividad_en'),
    avisoEliminacionEnviadoEn: timestamp('aviso_eliminacion_enviado_en'),
    estadoCuenta: estadoCuentaEnum('estado_cuenta').notNull().default('activa'),
    softDeletedEn: timestamp('soft_deleted_en'),
    softDeleteMotivo: varchar('soft_delete_motivo', { length: 200 }),
    hardDeletedEn: timestamp('hard_deleted_en'),
    protegidaContraEliminacion: boolean('protegida_contra_eliminacion').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    curpIdx: uniqueIndex('estudiantes_curp_idx').on(t.curp),
    gestorIdx: index('estudiantes_gestor_idx').on(t.gestorId),
  })
);

export const administradores = pgTable('administradores', {
  userId: integer('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  nombreCompleto: varchar('nombre_completo', { length: 200 }).notNull(),
  puesto: varchar('puesto', { length: 120 }),
  emailPublico: varchar('email_publico', { length: 255 }),
  telefonoPublico: varchar('telefono_publico', { length: 30 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Dirección de programa — perfil ejecutivo de SOLO LECTURA sobre datos
// agregados (indicadores, proyecciones, salud del sistema, reportes).
// No opera alumnos ni ve expedientes individuales.
export const directores = pgTable('directores', {
  userId: integer('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  nombreCompleto: varchar('nombre_completo', { length: 200 }).notNull(),
  puesto: varchar('puesto', { length: 120 }).default('Dirección de Programa'),
  emailPublico: varchar('email_publico', { length: 255 }),
  telefonoPublico: varchar('telefono_publico', { length: 30 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────
// Entidades cíclicas (crecen cada convocatoria)
// ─────────────────────────────────────────────────────────────────────────

export const convocatorias = pgTable('convocatorias', {
  id: serial('id').primaryKey(),
  nombre: varchar('nombre', { length: 200 }).notNull(), // ej. "Convocatoria 2026-1"
  fechaApertura: date('fecha_apertura').notNull(),
  fechaCierre: date('fecha_cierre').notNull(),
  fechaExamen: date('fecha_examen'),
  estado: convocatoriaEstadoEnum('estado').notNull().default('borrador'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const inscripciones = pgTable(
  'inscripciones',
  {
    id: serial('id').primaryKey(),
    estudianteId: integer('estudiante_id')
      .notNull()
      .references(() => estudiantes.userId, { onDelete: 'cascade' }),
    convocatoriaId: integer('convocatoria_id')
      .notNull()
      .references(() => convocatorias.id),
    estado: inscripcionEstadoEnum('estado').notNull().default('pre_registro'),
    creadoPorUserId: integer('creado_por_user_id').references(() => users.id), // gestor que la creó
    notas: text('notas'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    estudianteConvocatoriaIdx: uniqueIndex('inscripciones_estudiante_convocatoria_idx').on(
      t.estudianteId,
      t.convocatoriaId
    ),
    estadoIdx: index('inscripciones_estado_idx').on(t.estado),
  })
);

// Módulos a los que está inscrito el alumno en esta convocatoria
export const inscripcionModulos = pgTable(
  'inscripcion_modulos',
  {
    id: serial('id').primaryKey(),
    inscripcionId: integer('inscripcion_id')
      .notNull()
      .references(() => inscripciones.id, { onDelete: 'cascade' }),
    moduloId: integer('modulo_id')
      .notNull()
      .references(() => modulos.id),
    calificacion: integer('calificacion'), // 0-100, null si no evaluado
    aprobado: boolean('aprobado'),
    fechaEvaluacion: date('fecha_evaluacion'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    inscModuloIdx: uniqueIndex('insc_modulo_idx').on(t.inscripcionId, t.moduloId),
  })
);

// Documentos: entidad genérica. El gestor o el estudiante los suben.
export const documentos = pgTable('documentos', {
  id: serial('id').primaryKey(),
  inscripcionId: integer('inscripcion_id')
    .notNull()
    .references(() => inscripciones.id, { onDelete: 'cascade' }),
  nombre: varchar('nombre', { length: 240 }).notNull(), // nombre que le pone el usuario
  archivoOriginal: varchar('archivo_original', { length: 240 }).notNull(), // nombre del PDF
  storageKey: varchar('storage_key', { length: 500 }).notNull(), // path en object storage
  tamanoBytes: integer('tamano_bytes'),
  tipoSugerido: varchar('tipo_sugerido', { length: 60 }), // 'curp' | 'acta' | 'ine' | 'pago' | 'otro' (etiqueta libre)
  estado: documentoEstadoEnum('estado').notNull().default('pendiente_revision'),
  comentarioAdmin: text('comentario_admin'),
  subidoPorUserId: integer('subido_por_user_id')
    .notNull()
    .references(() => users.id),
  revisadoPorUserId: integer('revisado_por_user_id').references(() => users.id),
  revisadoEn: timestamp('revisado_en'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Expediente documental del alumno (independiente de inscripción)
export const expedienteDocumentos = pgTable(
  'expediente_documentos',
  {
    id: serial('id').primaryKey(),
    estudianteId: integer('estudiante_id')
      .notNull()
      .references(() => estudiantes.userId, { onDelete: 'cascade' }),
    tipo: varchar('tipo', { length: 60 }).notNull(), // curp | acta_nacimiento | ine | comprobante_domicilio | foto | certificado_secundaria
    estado: expedienteDocEstadoEnum('estado').notNull().default('pendiente_revision'),
    motivoRechazo: text('motivo_rechazo'),
    rutaArchivo: varchar('ruta_archivo', { length: 500 }).notNull(),
    nombreOriginal: varchar('nombre_original', { length: 240 }).notNull(),
    tamanoBytes: bigint('tamano_bytes', { mode: 'number' }),
    subidoPorUserId: integer('subido_por_user_id')
      .notNull()
      .references(() => users.id),
    subidoEn: timestamp('subido_en').notNull().defaultNow(),
    revisadoPorUserId: integer('revisado_por_user_id').references(() => users.id),
    revisadoEn: timestamp('revisado_en'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    estudianteTipoIdx: uniqueIndex('expediente_documentos_estudiante_tipo_idx').on(
      t.estudianteId,
      t.tipo
    ),
  })
);

// Firmas reutilizables por usuario: hasta 2 espacios + cuál está activa
// (estilo "guardar firma" de Apple; se elige con un clic cuál usar).
export const firmasUsuario = pgTable('firmas_usuario', {
  userId: integer('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  imagenDataUrl: text('imagen_data_url'), // firma 1 (nullable: puede tener solo la 2)
  imagenDataUrl2: text('imagen_data_url_2'), // firma 2
  activa: integer('activa').notNull().default(1), // 1 | 2 — cuál se usa en la cédula
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────
// Pagos — comprobantes de pago del alumno
// ─────────────────────────────────────────────────────────────────────────

export const pagos = pgTable(
  'pagos',
  {
    id: serial('id').primaryKey(),
    estudianteId: integer('estudiante_id')
      .notNull()
      .references(() => estudiantes.userId, { onDelete: 'cascade' }),
    concepto: pagoConceptoEnum('concepto').notNull(),
    conceptoDetalle: varchar('concepto_detalle', { length: 200 }),
    monto: numeric('monto', { precision: 10, scale: 2 }).notNull(),
    moneda: varchar('moneda', { length: 3 }).notNull().default('MXN'),
    fechaPago: date('fecha_pago').notNull(),
    metodoPago: pagoMetodoEnum('metodo_pago').notNull(),
    referenciaBancaria: varchar('referencia_bancaria', { length: 100 }),
    notas: text('notas'),
    rutaComprobante: varchar('ruta_comprobante', { length: 500 }).notNull(),
    nombreComprobante: varchar('nombre_comprobante', { length: 200 }),
    tamanoBytes: bigint('tamano_bytes', { mode: 'number' }),
    estado: pagoEstadoEnum('estado').notNull().default('pendiente'),
    motivoRechazo: text('motivo_rechazo'),
    subidoPorUserId: integer('subido_por_user_id')
      .notNull()
      .references(() => users.id),
    verificadoPorUserId: integer('verificado_por_user_id').references(() => users.id),
    verificadoEn: timestamp('verificado_en'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    pagosEstudianteEstadoIdx: index('pagos_estudiante_estado_idx').on(t.estudianteId, t.estado),
  })
);

// ─────────────────────────────────────────────────────────────────────────
// Pagos grupales — el gestor paga N exámenes de golpe ante la Tesorería del
// Estado y sube UN comprobante; el admin verifica y se marcan todos pagados.
// ─────────────────────────────────────────────────────────────────────────

export const pagoGrupalEstadoEnum = pgEnum('pago_grupal_estado', [
  'pendiente_comprobante', // creado, aún sin comprobante
  'en_revision',           // comprobante subido, espera verificación del admin
  'verificado',
  'rechazado',
]);

export const pagosGrupales = pgTable('pagos_grupales', {
  id: serial('id').primaryKey(),
  folio: varchar('folio', { length: 30 }).notNull().unique(), // PG-2026-G12-0007
  gestorId: integer('gestor_id')
    .notNull()
    .references(() => gestores.userId, { onDelete: 'cascade' }),
  concepto: varchar('concepto', { length: 40 }).notNull().default('derecho_examen'),
  cantidadExamenes: integer('cantidad_examenes').notNull(),
  montoUnitario: numeric('monto_unitario', { precision: 10, scale: 2 }).notNull(),
  montoTotal: numeric('monto_total', { precision: 10, scale: 2 }).notNull(),
  estado: pagoGrupalEstadoEnum('estado').notNull().default('pendiente_comprobante'),
  rutaComprobante: varchar('ruta_comprobante', { length: 500 }),
  nombreComprobante: varchar('nombre_comprobante', { length: 240 }),
  fechaPago: date('fecha_pago'),
  motivoRechazo: text('motivo_rechazo'),
  verificadoPorUserId: integer('verificado_por_user_id').references(() => users.id),
  verificadoEn: timestamp('verificado_en'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const pagosGrupalesExamenes = pgTable(
  'pagos_grupales_examenes',
  {
    id: serial('id').primaryKey(),
    pagoGrupalId: integer('pago_grupal_id')
      .notNull()
      .references(() => pagosGrupales.id, { onDelete: 'cascade' }),
    estudianteId: integer('estudiante_id')
      .notNull()
      .references(() => estudiantes.userId, { onDelete: 'cascade' }),
    examenInscripcionId: integer('examen_inscripcion_id')
      .notNull()
      .references(() => examenesInscripciones.id, { onDelete: 'cascade' }),
    monto: numeric('monto', { precision: 10, scale: 2 }).notNull(),
  },
  (t) => ({
    pagoExamenIdx: uniqueIndex('pge_pago_examen_idx').on(t.pagoGrupalId, t.examenInscripcionId),
    examenIdx: index('pge_examen_idx').on(t.examenInscripcionId),
  })
);

// ─────────────────────────────────────────────────────────────────────────
// Pagos de examen (Tesorería del Estado) — modelo canónico "orden de pago con
// línea de captura". EDUMICH NO cobra ni genera líneas de captura: la orden la
// emite la plataforma del Estado (SFA); aquí solo se ALMACENA y se SIRVE.
// El estado 'pagado' solo se setea por conciliación/verificación de un admin.
// ─────────────────────────────────────────────────────────────────────────

export const pagoExamenEstadoEnum = pgEnum('pago_examen_estado', [
  'pendiente_emision', // alumno inscrito, aún sin línea de captura
  'emitida',           // admin/enlace cargó línea de captura + orden; ya se puede pagar
  'en_revision',       // (ruta interina) alumno subió comprobante, falta verificación
  'pagado',            // conciliado contra la plataforma del Estado / comprobante verificado
  'vencido',           // pasó la fecha de vencimiento sin pago
  'cancelado',         // anulado por admin
]);

export const pagosExamen = pgTable(
  'pagos_examen',
  {
    id: serial('id').primaryKey(),
    // Folio de la ficha de pago (referencia legible). Ej: FP-2026-000123
    folio: varchar('folio', { length: 30 }).unique(),
    // Individual = un alumno (estudianteId set). Grupal = varios (estudianteId null,
    // los alumnos reales viven en el puente pagos_examen_inscripciones).
    estudianteId: integer('estudiante_id').references(() => estudiantes.userId, { onDelete: 'cascade' }),
    etapaId: integer('etapa_id').references(() => convocatoriasEtapas.id),
    // Gestor que solicitó/armó la orden (si la disparó un gestor por sus alumnos)
    gestorId: integer('gestor_id').references(() => gestores.userId),
    // Quién solicitó la ficha (gestor o alumno)
    solicitadoPorUserId: integer('solicitado_por_user_id').references(() => users.id),
    // Cómo se pagó (lo declara quien sube el comprobante): banco / tienda / linea
    metodoPago: varchar('metodo_pago', { length: 30 }),
    concepto: pagoConceptoEnum('concepto').notNull().default('derecho_examen'),
    cantidadExamenes: integer('cantidad_examenes').notNull().default(1),
    // $145 = $115 IEMSyS + $30 Synapsis. El split es INTERNO (solo reportes admin).
    montoTotal: numeric('monto_total', { precision: 10, scale: 2 }).notNull().default('145.00'),
    montoIemsys: numeric('monto_iemsys', { precision: 10, scale: 2 }).notNull().default('115.00'),
    montoSynapsis: numeric('monto_synapsis', { precision: 10, scale: 2 }).notNull().default('30.00'),
    // Referencia visible: CURP o matrícula MIC-AAAA-NNNNN (nunca datos bancarios)
    referencia: varchar('referencia', { length: 40 }),
    // Emitido por el Estado y capturado por el admin/enlace — nunca generado aquí
    lineaCaptura: varchar('linea_captura', { length: 40 }),
    ordenPagoPath: varchar('orden_pago_path', { length: 500 }),
    ordenPagoNombre: varchar('orden_pago_nombre', { length: 240 }),
    linkPago: varchar('link_pago', { length: 500 }),
    fechaEmision: timestamp('fecha_emision'),
    fechaVencimiento: date('fecha_vencimiento'),
    fechaPago: date('fecha_pago'),
    // Ruta interina: comprobante subido por el alumno mientras no haya conciliación
    comprobantePath: varchar('comprobante_path', { length: 500 }),
    comprobanteNombre: varchar('comprobante_nombre', { length: 240 }),
    estado: pagoExamenEstadoEnum('estado').notNull().default('pendiente_emision'),
    motivoRechazo: text('motivo_rechazo'),
    verificadoPorUserId: integer('verificado_por_user_id').references(() => users.id),
    verificadoEn: timestamp('verificado_en'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    estadoIdx: index('pagos_examen_estudiante_estado_idx').on(t.estudianteId, t.estado),
  })
);

export const pagosExamenInscripciones = pgTable(
  'pagos_examen_inscripciones',
  {
    id: serial('id').primaryKey(),
    pagoExamenId: integer('pago_examen_id')
      .notNull()
      .references(() => pagosExamen.id, { onDelete: 'cascade' }),
    examenInscripcionId: integer('examen_inscripcion_id')
      .notNull()
      .references(() => examenesInscripciones.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    uniq: uniqueIndex('pei_pago_examen_idx').on(t.pagoExamenId, t.examenInscripcionId),
    examenIdx: index('pei_examen_idx').on(t.examenInscripcionId),
  })
);

// ─────────────────────────────────────────────────────────────────────────
// Calificaciones — exámenes presenciales capturados por admin
// ─────────────────────────────────────────────────────────────────────────

export const calificaciones = pgTable(
  'calificaciones',
  {
    id: serial('id').primaryKey(),
    estudianteId: integer('estudiante_id')
      .notNull()
      .references(() => estudiantes.userId, { onDelete: 'cascade' }),
    moduloId: integer('modulo_id')
      .notNull()
      .references(() => modulos.id),
    inscripcionExamenId: integer('inscripcion_examen_id').references(
      () => examenesInscripciones.id
    ),
    etapaClave: varchar('etapa_clave', { length: 20 }).notNull(),
    calificacion: integer('calificacion').notNull(),
    aprobado: boolean('aprobado').notNull(),
    intento: integer('intento').notNull().default(1),
    fechaExamen: date('fecha_examen').notNull(),
    sedeId: integer('sede_id').references(() => sedes.id),
    capturadoPorUserId: integer('capturado_por_user_id')
      .notNull()
      .references(() => users.id),
    notas: text('notas'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    califEstudianteModuloIdx: index('calificaciones_estudiante_modulo_idx').on(
      t.estudianteId,
      t.moduloId
    ),
  })
);

// ─────────────────────────────────────────────────────────────────────────
// Auto-registro y verificación de email
// ─────────────────────────────────────────────────────────────────────────

export const emailVerifications = pgTable(
  'email_verifications',
  {
    id: serial('id').primaryKey(),
    email: varchar('email', { length: 255 }).notNull(),
    codigoHash: varchar('codigo_hash', { length: 255 }).notNull(),
    expiraEn: timestamp('expira_en').notNull(),
    intentos: integer('intentos').notNull().default(0),
    verificado: boolean('verificado').notNull().default(false),
    tipo: varchar('tipo', { length: 40 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    emailVerificadoIdx: index('ev_email_verificado_idx').on(t.email, t.verificado),
  })
);

export const solicitudesCuenta = pgTable('solicitudes_cuenta', {
  id: serial('id').primaryKey(),
  folio: varchar('folio', { length: 20 }).unique(),
  nombreCompleto: varchar('nombre_completo', { length: 200 }).notNull(),
  nombres: varchar('nombres', { length: 120 }),
  apellidoPaterno: varchar('apellido_paterno', { length: 100 }),
  apellidoMaterno: varchar('apellido_materno', { length: 100 }),
  curp: varchar('curp', { length: 18 }).notNull(),
  fechaNacimiento: date('fecha_nacimiento').notNull(),
  sexo: varchar('sexo', { length: 20 }),
  lugarNacimiento: varchar('lugar_nacimiento', { length: 120 }),
  entidadNacimiento: varchar('entidad_nacimiento', { length: 80 }),
  estadoCivil: varchar('estado_civil', { length: 30 }),
  ultimoEstudio: varchar('ultimo_estudio', { length: 120 }),
  email: varchar('email', { length: 255 }).notNull(),
  telefono: varchar('telefono', { length: 30 }).notNull(),
  calleNumero: varchar('calle_numero', { length: 200 }),
  colonia: varchar('colonia', { length: 120 }),
  cp: varchar('cp', { length: 10 }),
  ciudad: varchar('ciudad', { length: 120 }),
  estadoDomicilio: varchar('estado_domicilio', { length: 80 }),
  municipioId: integer('municipio_id')
    .notNull()
    .references(() => municipios.id),
  mensaje: text('mensaje'),
  ultimoNivelCursado: varchar('ultimo_nivel_cursado', { length: 100 }),
  anioUltimoNivel: integer('anio_ultimo_nivel'),
  justificacion: text('justificacion'),
  modalidadPreferida: modalidadPreferidaEnum('modalidad_preferida'),
  disponibilidad: varchar('disponibilidad', { length: 200 }),
  emailVerificado: boolean('email_verificado').notNull().default(false),
  estado: solicitudEstadoEnum('estado').notNull().default('pendiente'),
  procesadaPorUserId: integer('procesada_por_user_id').references(() => users.id),
  procesadaEn: timestamp('procesada_en'),
  gestorAsignadoId: integer('gestor_asignado_id').references(() => gestores.userId),
  estudianteCreadoId: integer('estudiante_creado_id').references(() => estudiantes.userId),
  motivoRechazo: varchar('motivo_rechazo', { length: 50 }),
  detallesRechazo: text('detalles_rechazo'),
  notasInternas: text('notas_internas'),
  comentarioAdmin: text('comentario_admin'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────
// Comunicación institucional
// ─────────────────────────────────────────────────────────────────────────

export const avisos = pgTable('avisos', {
  id: serial('id').primaryKey(),
  titulo: varchar('titulo', { length: 200 }).notNull(),
  contenido: text('contenido').notNull(),
  prioridad: avisosPrioridadEnum('prioridad').notNull().default('informativo'),
  publicadoPorUserId: integer('publicado_por_user_id').references(() => users.id),
  publicadoEn: timestamp('publicado_en').notNull().defaultNow(),
  activoHasta: timestamp('activo_hasta'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const avisosLeidos = pgTable(
  'avisos_leidos',
  {
    id: serial('id').primaryKey(),
    avisoId: integer('aviso_id')
      .notNull()
      .references(() => avisos.id, { onDelete: 'cascade' }),
    estudianteId: integer('estudiante_id')
      .notNull()
      .references(() => estudiantes.userId, { onDelete: 'cascade' }),
    leidoEn: timestamp('leido_en').notNull().defaultNow(),
  },
  (t) => ({
    avisoEstudianteIdx: uniqueIndex('avisos_leidos_aviso_estudiante_idx').on(
      t.avisoId,
      t.estudianteId
    ),
  })
);

// ─────────────────────────────────────────────────────────────────────────
// Anuncios (módulo CMS — admin crea, audiencia segmentada ve)
// ─────────────────────────────────────────────────────────────────────────

export const anuncios = pgTable('anuncios', {
  id: serial('id').primaryKey(),
  titulo: varchar('titulo', { length: 200 }).notNull(),
  contenido: text('contenido').notNull(),
  prioridad: anuncioPrioridadEnum('prioridad').notNull().default('informativo'),
  audiencia: anuncioAudienciaEnum('audiencia').notNull().default('todos'),
  // audiencia extra params (municipioId para alumnos_municipio, etapaClave para alumnos_etapa, gestorId para gestor_especifico)
  audienciaParam: varchar('audiencia_param', { length: 120 }),
  estado: anuncioEstadoEnum('estado').notNull().default('borrador'),
  ctaTexto: varchar('cta_texto', { length: 80 }),
  ctaUrl: varchar('cta_url', { length: 500 }),
  publicadoEn: timestamp('publicado_en'),
  activoHasta: timestamp('activo_hasta'),
  creadoPorUserId: integer('creado_por_user_id').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const anunciosVistos = pgTable(
  'anuncios_vistos',
  {
    id: serial('id').primaryKey(),
    anuncioId: integer('anuncio_id')
      .notNull()
      .references(() => anuncios.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    vistoEn: timestamp('visto_en').notNull().defaultNow(),
  },
  (t) => ({
    anuncioUserIdx: uniqueIndex('anuncios_vistos_anuncio_user_idx').on(t.anuncioId, t.userId),
  })
);

// ─────────────────────────────────────────────────────────────────────────
// Auditoría (esencial para gobierno)
// ─────────────────────────────────────────────────────────────────────────

export const auditLog = pgTable('audit_log', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  userNombre: varchar('user_nombre', { length: 200 }),
  userRol: varchar('user_rol', { length: 30 }),
  accion: varchar('accion', { length: 80 }).notNull(),
  entidad: varchar('entidad', { length: 60 }).notNull(),
  entidadId: integer('entidad_id'),
  detalle: text('detalle'),
  metadata: jsonb('metadata'),
  ip: varchar('ip', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────
// Módulos — contenido temario y progreso del alumno
// ─────────────────────────────────────────────────────────────────────────

export const progresoEstadoEnum = pgEnum('progreso_estado', [
  'no_iniciado',
  'en_curso',
  'aprobado',
]);

export const modulosUnidades = pgTable(
  'modulos_unidades',
  {
    id: serial('id').primaryKey(),
    moduloId: integer('modulo_id')
      .notNull()
      .references(() => modulos.id, { onDelete: 'cascade' }),
    numero: integer('numero').notNull(),
    titulo: varchar('titulo', { length: 200 }).notNull(),
    proposito: text('proposito').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    moduloNumeroIdx: uniqueIndex('modulos_unidades_modulo_numero_idx').on(t.moduloId, t.numero),
  })
);

export const modulosTemas = pgTable('modulos_temas', {
  id: serial('id').primaryKey(),
  unidadId: integer('unidad_id')
    .notNull()
    .references(() => modulosUnidades.id, { onDelete: 'cascade' }),
  parentId: integer('parent_id').references((): AnyPgColumn => modulosTemas.id),
  orden: integer('orden').notNull(),
  titulo: varchar('titulo', { length: 300 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const modulosMateriales = pgTable('modulos_materiales', {
  id: serial('id').primaryKey(),
  moduloId: integer('modulo_id')
    .notNull()
    .references(() => modulos.id, { onDelete: 'cascade' }),
  tipo: varchar('tipo', { length: 40 }).notNull(),
  nombre: varchar('nombre', { length: 200 }).notNull(),
  rutaArchivo: varchar('ruta_archivo', { length: 500 }).notNull(),
  tamanoBytes: bigint('tamano_bytes', { mode: 'number' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const estudiantesModulosProgreso = pgTable(
  'estudiantes_modulos_progreso',
  {
    id: serial('id').primaryKey(),
    estudianteId: integer('estudiante_id')
      .notNull()
      .references(() => estudiantes.userId, { onDelete: 'cascade' }),
    moduloId: integer('modulo_id')
      .notNull()
      .references(() => modulos.id, { onDelete: 'cascade' }),
    estado: progresoEstadoEnum('estado').notNull().default('no_iniciado'),
    intentosQuiz: integer('intentos_quiz').notNull().default(0),
    mejorCalificacion: integer('mejor_calificacion'),
    ultimaCalificacion: integer('ultima_calificacion'),
    ultimaActividad: timestamp('ultima_actividad'),
    temasDebiles: jsonb('temas_debiles').$type<{ tema: string; correctas: number; total: number }[]>(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    empEstudianteModuloIdx: uniqueIndex('emp_estudiante_modulo_idx').on(
      t.estudianteId,
      t.moduloId
    ),
  })
);

// ─────────────────────────────────────────────────────────────────────────
// Convocatorias DGB — sedes, etapas y exámenes
// ─────────────────────────────────────────────────────────────────────────

export const sedes = pgTable('sedes', {
  id: serial('id').primaryKey(),
  nombre: varchar('nombre', { length: 150 }).notNull(),
  direccion: text('direccion').notNull(),
  municipioId: integer('municipio_id')
    .notNull()
    .references(() => municipios.id),
  telefono: varchar('telefono', { length: 30 }),
  horarioAtencion: varchar('horario_atencion', { length: 200 }),
  latitud: text('latitud'), // stored as text to avoid decimal precision issues; parse as float
  longitud: text('longitud'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const convocatoriasEtapas = pgTable(
  'convocatorias_etapas',
  {
    id: serial('id').primaryKey(),
    clave: varchar('clave', { length: 20 }).notNull(),
    etapa: varchar('etapa', { length: 10 }).notNull(),
    fase: varchar('fase', { length: 2 }).notNull(),
    solicitudInicio: date('solicitud_inicio').notNull(),
    solicitudFin: date('solicitud_fin').notNull(),
    examenSabado: date('examen_sabado').notNull(),
    examenDomingo: date('examen_domingo').notNull(),
    anio: integer('anio').notNull(),
    estado: varchar('estado', { length: 20 }).notNull().default('programada'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    claveIdx: uniqueIndex('convocatorias_etapas_clave_idx').on(t.clave),
  })
);

export const convocatoriasModulosHorarios = pgTable(
  'convocatorias_modulos_horarios',
  {
    id: serial('id').primaryKey(),
    etapaId: integer('etapa_id')
      .notNull()
      .references(() => convocatoriasEtapas.id),
    moduloId: integer('modulo_id')
      .notNull()
      .references(() => modulos.id),
    dia: varchar('dia', { length: 10 }).notNull(),
    hora: varchar('hora', { length: 5 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    etapaModuloIdx: uniqueIndex('cmh_etapa_modulo_idx').on(t.etapaId, t.moduloId),
  })
);

export const examenesInscripciones = pgTable(
  'examenes_inscripciones',
  {
    id: serial('id').primaryKey(),
    estudianteId: integer('estudiante_id')
      .notNull()
      .references(() => estudiantes.userId),
    etapaId: integer('etapa_id')
      .notNull()
      .references(() => convocatoriasEtapas.id),
    moduloId: integer('modulo_id')
      .notNull()
      .references(() => modulos.id),
    horarioId: integer('horario_id')
      .notNull()
      .references(() => convocatoriasModulosHorarios.id),
    sedeId: integer('sede_id')
      .notNull()
      .references(() => sedes.id),
    folio: varchar('folio', { length: 30 }).notNull(),
    estado: varchar('estado', { length: 30 }).notNull().default('inscrito'),
    paseValidadoEn: timestamp('pase_validado_en'),
    paseValidadoPorUserId: integer('pase_validado_por_user_id').references(() => users.id),
    calificacion: integer('calificacion'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    folioIdx: uniqueIndex('examenes_inscripciones_folio_idx').on(t.folio),
    estudianteEtapaModuloIdx: uniqueIndex('examenes_inscripciones_est_etapa_modulo_idx').on(
      t.estudianteId,
      t.etapaId,
      t.moduloId
    ),
  })
);

// ─────────────────────────────────────────────────────────────────────────
// Relaciones (Drizzle)
// ─────────────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ one }) => ({
  gestor: one(gestores, {
    fields: [users.id],
    references: [gestores.userId],
  }),
  estudiante: one(estudiantes, {
    fields: [users.id],
    references: [estudiantes.userId],
  }),
  administrador: one(administradores, {
    fields: [users.id],
    references: [administradores.userId],
  }),
}));

export const gestoresRelations = relations(gestores, ({ one, many }) => ({
  user: one(users, { fields: [gestores.userId], references: [users.id] }),
  municipio: one(municipios, { fields: [gestores.municipioId], references: [municipios.id] }),
  estudiantes: many(estudiantes),
}));

export const estudiantesRelations = relations(estudiantes, ({ one, many }) => ({
  user: one(users, { fields: [estudiantes.userId], references: [users.id] }),
  municipio: one(municipios, { fields: [estudiantes.municipioId], references: [municipios.id] }),
  gestor: one(users, { fields: [estudiantes.gestorId], references: [users.id] }),
  inscripciones: many(inscripciones),
}));

export const inscripcionesRelations = relations(inscripciones, ({ one, many }) => ({
  estudiante: one(estudiantes, {
    fields: [inscripciones.estudianteId],
    references: [estudiantes.userId],
  }),
  convocatoria: one(convocatorias, {
    fields: [inscripciones.convocatoriaId],
    references: [convocatorias.id],
  }),
  documentos: many(documentos),
  modulos: many(inscripcionModulos),
}));

export const documentosRelations = relations(documentos, ({ one }) => ({
  inscripcion: one(inscripciones, {
    fields: [documentos.inscripcionId],
    references: [inscripciones.id],
  }),
  subidoPor: one(users, {
    fields: [documentos.subidoPorUserId],
    references: [users.id],
  }),
}));

export const modulosRelations = relations(modulos, ({ many }) => ({
  temas: many(temas),
}));

export const temasRelations = relations(temas, ({ one }) => ({
  modulo: one(modulos, { fields: [temas.moduloId], references: [modulos.id] }),
}));

export const avisosRelations = relations(avisos, ({ one, many }) => ({
  publicadoPor: one(users, {
    fields: [avisos.publicadoPorUserId],
    references: [users.id],
  }),
  leidos: many(avisosLeidos),
}));

export const avisosLeidosRelations = relations(avisosLeidos, ({ one }) => ({
  aviso: one(avisos, { fields: [avisosLeidos.avisoId], references: [avisos.id] }),
  estudiante: one(estudiantes, {
    fields: [avisosLeidos.estudianteId],
    references: [estudiantes.userId],
  }),
}));

export const modulosUnidadesRelations = relations(modulosUnidades, ({ one, many }) => ({
  modulo: one(modulos, { fields: [modulosUnidades.moduloId], references: [modulos.id] }),
  temas: many(modulosTemas),
}));

export const modulosTemasRelations = relations(modulosTemas, ({ one, many }) => ({
  unidad: one(modulosUnidades, { fields: [modulosTemas.unidadId], references: [modulosUnidades.id] }),
  parent: one(modulosTemas, { fields: [modulosTemas.parentId], references: [modulosTemas.id] }),
  subtemas: many(modulosTemas),
}));

export const modulosMaterialesRelations = relations(modulosMateriales, ({ one }) => ({
  modulo: one(modulos, { fields: [modulosMateriales.moduloId], references: [modulos.id] }),
}));

export const estudiantesModulosProgresoRelations = relations(
  estudiantesModulosProgreso,
  ({ one }) => ({
    estudiante: one(estudiantes, {
      fields: [estudiantesModulosProgreso.estudianteId],
      references: [estudiantes.userId],
    }),
    modulo: one(modulos, {
      fields: [estudiantesModulosProgreso.moduloId],
      references: [modulos.id],
    }),
  })
);

export const expedienteDocumentosRelations = relations(expedienteDocumentos, ({ one }) => ({
  estudiante: one(estudiantes, {
    fields: [expedienteDocumentos.estudianteId],
    references: [estudiantes.userId],
  }),
  subidoPor: one(users, {
    fields: [expedienteDocumentos.subidoPorUserId],
    references: [users.id],
  }),
}));

export const sedesRelations = relations(sedes, ({ one, many }) => ({
  municipio: one(municipios, { fields: [sedes.municipioId], references: [municipios.id] }),
  examenesInscripciones: many(examenesInscripciones),
}));

export const convocatoriasEtapasRelations = relations(convocatoriasEtapas, ({ many }) => ({
  horarios: many(convocatoriasModulosHorarios),
  examenesInscripciones: many(examenesInscripciones),
}));

export const convocatoriasModulosHorariosRelations = relations(
  convocatoriasModulosHorarios,
  ({ one, many }) => ({
    etapa: one(convocatoriasEtapas, {
      fields: [convocatoriasModulosHorarios.etapaId],
      references: [convocatoriasEtapas.id],
    }),
    modulo: one(modulos, {
      fields: [convocatoriasModulosHorarios.moduloId],
      references: [modulos.id],
    }),
    examenesInscripciones: many(examenesInscripciones),
  })
);

export const examenesInscripcionesRelations = relations(examenesInscripciones, ({ one }) => ({
  estudiante: one(estudiantes, {
    fields: [examenesInscripciones.estudianteId],
    references: [estudiantes.userId],
  }),
  etapa: one(convocatoriasEtapas, {
    fields: [examenesInscripciones.etapaId],
    references: [convocatoriasEtapas.id],
  }),
  modulo: one(modulos, {
    fields: [examenesInscripciones.moduloId],
    references: [modulos.id],
  }),
  horario: one(convocatoriasModulosHorarios, {
    fields: [examenesInscripciones.horarioId],
    references: [convocatoriasModulosHorarios.id],
  }),
  sede: one(sedes, {
    fields: [examenesInscripciones.sedeId],
    references: [sedes.id],
  }),
  validadoPor: one(users, {
    fields: [examenesInscripciones.paseValidadoPorUserId],
    references: [users.id],
  }),
}));

export const pagosRelations = relations(pagos, ({ one }) => ({
  estudiante: one(estudiantes, {
    fields: [pagos.estudianteId],
    references: [estudiantes.userId],
  }),
  subidoPor: one(users, {
    fields: [pagos.subidoPorUserId],
    references: [users.id],
  }),
  verificadoPor: one(users, {
    fields: [pagos.verificadoPorUserId],
    references: [users.id],
  }),
}));

export const pagosExamenRelations = relations(pagosExamen, ({ one, many }) => ({
  estudiante: one(estudiantes, {
    fields: [pagosExamen.estudianteId],
    references: [estudiantes.userId],
  }),
  etapa: one(convocatoriasEtapas, {
    fields: [pagosExamen.etapaId],
    references: [convocatoriasEtapas.id],
  }),
  verificadoPor: one(users, {
    fields: [pagosExamen.verificadoPorUserId],
    references: [users.id],
  }),
  inscripciones: many(pagosExamenInscripciones),
}));

export const pagosExamenInscripcionesRelations = relations(pagosExamenInscripciones, ({ one }) => ({
  pago: one(pagosExamen, {
    fields: [pagosExamenInscripciones.pagoExamenId],
    references: [pagosExamen.id],
  }),
  inscripcion: one(examenesInscripciones, {
    fields: [pagosExamenInscripciones.examenInscripcionId],
    references: [examenesInscripciones.id],
  }),
}));

// ─────────────────────────────────────────────────────────────────────────
// Password reset tokens
// ─────────────────────────────────────────────────────────────────────────

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 255 }).notNull().unique(),
  expiraEn: timestamp('expira_en').notNull(),
  usadoEn: timestamp('usado_en'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const calificacionesRelations = relations(calificaciones, ({ one }) => ({
  estudiante: one(estudiantes, {
    fields: [calificaciones.estudianteId],
    references: [estudiantes.userId],
  }),
  modulo: one(modulos, {
    fields: [calificaciones.moduloId],
    references: [modulos.id],
  }),
  sede: one(sedes, {
    fields: [calificaciones.sedeId],
    references: [sedes.id],
  }),
  capturadoPor: one(users, {
    fields: [calificaciones.capturadoPorUserId],
    references: [users.id],
  }),
}));

export const anunciosRelations = relations(anuncios, ({ one, many }) => ({
  creadoPor: one(users, {
    fields: [anuncios.creadoPorUserId],
    references: [users.id],
  }),
  vistos: many(anunciosVistos),
}));

export const anunciosVistosRelations = relations(anunciosVistos, ({ one }) => ({
  anuncio: one(anuncios, { fields: [anunciosVistos.anuncioId], references: [anuncios.id] }),
  user: one(users, { fields: [anunciosVistos.userId], references: [users.id] }),
}));

// ─────────────────────────────────────────────────────────────────────────
// Reportes institucionales
// ─────────────────────────────────────────────────────────────────────────

export const reporteTipoEnum = pgEnum('reporte_tipo', [
  'inscripciones',
  'expedientes',
  'financiero',
  'academico',
  'productividad_gestores',
  'convocatorias',
  'solicitudes',
  'ejecutivo',
]);

export const reporteFormatoEnum = pgEnum('reporte_formato', ['excel', 'pdf']);

export const reporteFrecuenciaEnum = pgEnum('reporte_frecuencia', [
  'diaria',
  'semanal',
  'quincenal',
  'mensual',
]);

export const reporteEstadoEnum = pgEnum('reporte_estado', [
  'pendiente',
  'generando',
  'listo',
  'error',
]);

export const reportesGenerados = pgTable('reportes_generados', {
  id: serial('id').primaryKey(),
  tipo: reporteTipoEnum('tipo').notNull(),
  formato: reporteFormatoEnum('formato').notNull(),
  nombre: varchar('nombre', { length: 200 }).notNull(),
  filtros: jsonb('filtros'),
  estado: reporteEstadoEnum('estado').notNull().default('pendiente'),
  rutaArchivo: varchar('ruta_archivo', { length: 500 }),
  nombreArchivo: varchar('nombre_archivo', { length: 240 }),
  tamanoBytes: bigint('tamano_bytes', { mode: 'number' }),
  totalRegistros: integer('total_registros'),
  errorMensaje: text('error_mensaje'),
  generadoPorUserId: integer('generado_por_user_id').references(() => users.id),
  programadoId: integer('programado_id'),
  generadoEn: timestamp('generado_en'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const reportesProgramados = pgTable('reportes_programados', {
  id: serial('id').primaryKey(),
  nombre: varchar('nombre', { length: 200 }).notNull(),
  tipo: reporteTipoEnum('tipo').notNull(),
  formato: reporteFormatoEnum('formato').notNull(),
  frecuencia: reporteFrecuenciaEnum('frecuencia').notNull(),
  filtros: jsonb('filtros'),
  emailDestino: varchar('email_destino', { length: 255 }).notNull(),
  activo: boolean('activo').notNull().default(true),
  proximaEjecucion: timestamp('proxima_ejecucion').notNull(),
  ultimaEjecucionEn: timestamp('ultima_ejecucion_en'),
  creadoPorUserId: integer('creado_por_user_id').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const reportesGeneradosRelations = relations(reportesGenerados, ({ one }) => ({
  generadoPor: one(users, {
    fields: [reportesGenerados.generadoPorUserId],
    references: [users.id],
  }),
}));

export const reportesProgramadosRelations = relations(reportesProgramados, ({ one }) => ({
  creadoPor: one(users, {
    fields: [reportesProgramados.creadoPorUserId],
    references: [users.id],
  }),
}));

// ─────────────────────────────────────────────────────────────────────────
// Módulo de Configuración
// ─────────────────────────────────────────────────────────────────────────

export const datosInstitucionales = pgTable('datos_institucionales', {
  id: serial('id').primaryKey(),
  nombreOficial: varchar('nombre_oficial', { length: 200 }).notNull(),
  nombreCorto: varchar('nombre_corto', { length: 50 }).notNull(),
  direccion: text('direccion').notNull(),
  telefonoGeneral: varchar('telefono_general', { length: 30 }),
  correoSoporte: varchar('correo_soporte', { length: 200 }),
  rfc: varchar('rfc', { length: 20 }),
  sitioWeb: varchar('sitio_web', { length: 200 }),
  actualizadoPor: integer('actualizado_por').references(() => users.id),
  actualizadoEn: timestamp('actualizado_en').defaultNow(),
});

export const datosBancarios = pgTable('datos_bancarios', {
  id: serial('id').primaryKey(),
  banco: varchar('banco', { length: 100 }).notNull(),
  titular: varchar('titular', { length: 200 }).notNull(),
  clabe: varchar('clabe', { length: 20 }).notNull(),
  numeroCuenta: varchar('numero_cuenta', { length: 30 }),
  rfc: varchar('rfc', { length: 20 }),
  conceptoPago: text('concepto_pago'),
  // Número de convenio CIE para pago en tienda de conveniencia (OXXO, 7-Eleven, etc.)
  convenio: varchar('convenio', { length: 30 }),
  activo: boolean('activo').notNull().default(true),
  actualizadoPor: integer('actualizado_por').references(() => users.id),
  actualizadoEn: timestamp('actualizado_en').defaultNow(),
});

export const conceptosPago = pgTable('conceptos_pago', {
  id: serial('id').primaryKey(),
  clave: varchar('clave', { length: 50 }).notNull().unique(),
  nombre: varchar('nombre', { length: 100 }).notNull(),
  descripcion: text('descripcion'),
  monto: numeric('monto', { precision: 10, scale: 2 }).notNull(),
  vigencia: integer('vigencia').notNull().default(2026),
  activo: boolean('activo').notNull().default(true),
  actualizadoEn: timestamp('actualizado_en').defaultNow(),
});

export const plantillasCorreo = pgTable('plantillas_correo', {
  id: serial('id').primaryKey(),
  clave: varchar('clave', { length: 50 }).notNull().unique(),
  nombre: varchar('nombre', { length: 200 }).notNull(),
  descripcion: text('descripcion'),
  asunto: varchar('asunto', { length: 200 }).notNull(),
  contenidoHtml: text('contenido_html').notNull(),
  contenidoTexto: text('contenido_texto'),
  variablesDisponibles: jsonb('variables_disponibles'),
  activa: boolean('activa').notNull().default(true),
  actualizadoPor: integer('actualizado_por').references(() => users.id),
  actualizadoEn: timestamp('actualizado_en').defaultNow(),
});

export const integraciones = pgTable('integraciones', {
  id: serial('id').primaryKey(),
  clave: varchar('clave', { length: 50 }).notNull().unique(),
  nombre: varchar('nombre', { length: 100 }).notNull(),
  descripcion: text('descripcion'),
  proveedor: varchar('proveedor', { length: 100 }),
  conectada: boolean('conectada').notNull().default(false),
  configuracion: jsonb('configuracion'),
  ultimaPruebaEn: timestamp('ultima_prueba_en'),
  ultimaPruebaExitosa: boolean('ultima_prueba_exitosa'),
  actualizadoEn: timestamp('actualizado_en').defaultNow(),
});

export const preferenciasUsuario = pgTable('preferencias_usuario', {
  userId: integer('user_id').references(() => users.id).primaryKey(),
  notifEmail: boolean('notif_email').notNull().default(true),
  notifNavegador: boolean('notif_navegador').notNull().default(false),
  resumenDiario: boolean('resumen_diario').notNull().default(true),
  modoOscuro: boolean('modo_oscuro').notNull().default(false),
  idioma: varchar('idioma', { length: 5 }).notNull().default('es-MX'),
  zonaHoraria: varchar('zona_horaria', { length: 50 }).notNull().default('America/Mexico_City'),
  actualizadoEn: timestamp('actualizado_en').defaultNow(),
});

export const sesiones = pgTable('sesiones', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  ip: varchar('ip', { length: 45 }),
  userAgent: text('user_agent'),
  navegador: varchar('navegador', { length: 50 }),
  sistemaOperativo: varchar('sistema_operativo', { length: 50 }),
  ubicacion: varchar('ubicacion', { length: 100 }),
  creadaEn: timestamp('creada_en').defaultNow(),
  ultimaActividadEn: timestamp('ultima_actividad_en').defaultNow(),
  expiraEn: timestamp('expira_en').notNull(),
});

// ── Notificaciones ────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────
// Auditoría de eliminaciones de cuentas (LGPDPPSO)
// ─────────────────────────────────────────────────────────────────────────

export const eliminacionesAuditoria = pgTable('eliminaciones_auditoria', {
  id: serial('id').primaryKey(),
  estudianteId: integer('estudiante_id'),
  // Sin FK — el estudiante puede ya estar borrado
  nombreCompleto: varchar('nombre_completo', { length: 200 }),
  curp: varchar('curp', { length: 18 }),
  email: varchar('email', { length: 200 }),
  municipioNombre: varchar('municipio_nombre', { length: 100 }),
  folioPreregistro: varchar('folio_preregistro', { length: 30 }),
  tipo: varchar('tipo', { length: 20 }).notNull(),
  // 'soft_delete' | 'hard_delete' | 'restauracion'
  motivo: varchar('motivo', { length: 300 }).notNull(),
  diasSinActividad: integer('dias_sin_actividad'),
  documentosTenia: integer('documentos_tenia').default(0),
  pagosTenia: integer('pagos_tenia').default(0),
  teniaMatriculaDGB: boolean('tenia_matricula_dgb').default(false),
  ejecutadoPorSistema: boolean('ejecutado_por_sistema').default(true),
  ejecutadoPorUserId: integer('ejecutado_por_user_id'),
  creadoEn: timestamp('creado_en').defaultNow(),
});

export const notifTipoEnum = pgEnum('notif_tipo', [
  'solicitud_nueva',
  'documento_subido_revisar',
  'pago_subido_verificar',
  'alumno_sin_gestor',
  'expediente_completo',
  'reporte_enviado',
  'integracion_fallida',
  'alumno_asignado',
  'mi_alumno_subio_documento',
  'mi_alumno_subio_pago',
  'mi_alumno_completo_expediente',
  'documento_aprobado',
  'documento_rechazado',
  'pago_verificado',
  'matricula_asignada',
  'convocatoria_proxima',
  'anuncio_dirigido',
  'mensaje_admin',
  'cuenta_aviso_eliminacion',
  'cuentas_eliminadas_lote',
]);

export const notifPrioridadEnum = pgEnum('notif_prioridad', ['baja', 'normal', 'alta', 'urgente']);

export const notificaciones = pgTable('notificaciones', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  tipo: notifTipoEnum('tipo').notNull(),
  prioridad: notifPrioridadEnum('prioridad').notNull().default('normal'),
  titulo: varchar('titulo', { length: 120 }).notNull(),
  cuerpo: text('cuerpo').notNull(),
  enlace: varchar('enlace', { length: 255 }),
  leida: boolean('leida').notNull().default(false),
  creadaEn: timestamp('creada_en').defaultNow().notNull(),
  leidaEn: timestamp('leida_en'),
});

// ─────────────────────────────────────────────────────────────────────────
// Outbox de correos (modo demo + auditoría)
// ─────────────────────────────────────────────────────────────────────────

export const outboxEventoEnum = pgEnum('outbox_evento', [
  'cuenta_creada_alumno',
  'cuenta_creada_gestor',
  'autoregistro_alumno',
  'notificacion_admin_autoregistro',
  'aviso_eliminacion_cuenta',
  'recuperar_password',
  'verificacion_email',
]);

export const outboxEstadoEnum = pgEnum('outbox_estado', [
  'pendiente',
  'enviado',
  'fallido',
  'demo_mode',
]);

export const outbox = pgTable('outbox', {
  id: serial('id').primaryKey(),
  toEmail: text('to_email').notNull(),
  toName: text('to_name'),
  ccEmail: text('cc_email'),
  fromEmail: text('from_email').notNull(),
  fromName: text('from_name').notNull().default('Prepa Abierta Michoacán'),
  subject: text('subject').notNull(),
  html: text('html').notNull(),
  textPlain: text('text_plain'),
  evento: outboxEventoEnum('evento').notNull(),
  estado: outboxEstadoEnum('estado').notNull().default('pendiente'),
  errorMessage: text('error_message'),
  triggeredByUserId: integer('triggered_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  relatedUserId: integer('related_user_id').references(() => users.id, { onDelete: 'set null' }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  sentAt: timestamp('sent_at'),
});

// ─────────────────────────────────────────────────────────────────────────
// Banco de preguntas — 21 módulos, exámenes aleatorios de 20 preguntas
// ─────────────────────────────────────────────────────────────────────────

export const dificultadEnum = pgEnum('dificultad', ['facil', 'media', 'alta']);

export const bancoPreguntas = pgTable(
  'banco_preguntas',
  {
    id: serial('id').primaryKey(),
    preguntaDocId: varchar('pregunta_doc_id', { length: 20 }).notNull(), // e.g. M01-U1-001
    moduloNum: integer('modulo_num').notNull(), // 1-21
    moduloId: integer('modulo_id').references(() => modulos.id),
    unidadNum: integer('unidad_num').notNull(), // 1, 2, 3...
    tema: varchar('tema', { length: 300 }).notNull(),
    dificultad: dificultadEnum('dificultad').notNull(),
    pregunta: text('pregunta').notNull(),
    opcionA: text('opcion_a').notNull(),
    opcionB: text('opcion_b').notNull(),
    opcionC: text('opcion_c').notNull(),
    opcionD: text('opcion_d').notNull(),
    respuestaCorrecta: varchar('respuesta_correcta', { length: 1 }).notNull(), // A, B, C, D
    explicacion: text('explicacion').notNull(),
    paraRepasar: text('para_repasar'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    preguntaDocIdIdx: uniqueIndex('banco_preguntas_doc_id_idx').on(t.preguntaDocId),
    moduloNumIdx: index('banco_preguntas_modulo_num_idx').on(t.moduloNum),
  })
);

export const bancoPreguntas_relations = relations(bancoPreguntas, ({ one }) => ({
  modulo: one(modulos, {
    fields: [bancoPreguntas.moduloId],
    references: [modulos.id],
  }),
}));
