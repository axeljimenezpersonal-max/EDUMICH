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

export const rolEnum = pgEnum('rol', ['admin', 'gestor', 'estudiante']);

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

// ─────────────────────────────────────────────────────────────────────────
// Catálogos (entidades estables)
// ─────────────────────────────────────────────────────────────────────────

export const municipios = pgTable(
  'municipios',
  {
    id: serial('id').primaryKey(),
    nombre: varchar('nombre', { length: 120 }).notNull(),
    estado: varchar('estado', { length: 80 }).notNull().default('Michoacán'),
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
    nombreCompleto: varchar('nombre_completo', { length: 200 }).notNull(),
    curp: varchar('curp', { length: 18 }),
    fechaNacimiento: date('fecha_nacimiento'),
    telefono: varchar('telefono', { length: 30 }),
    direccion: text('direccion'),
    municipioId: integer('municipio_id').references(() => municipios.id),
    gestorId: integer('gestor_id').references(() => users.id),
    emailVerificado: boolean('email_verificado').notNull().default(false),
    registroTipo: varchar('registro_tipo', { length: 20 }).default('gestor'),
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
  curp: varchar('curp', { length: 18 }).notNull(),
  fechaNacimiento: date('fecha_nacimiento').notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  telefono: varchar('telefono', { length: 30 }).notNull(),
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
// Auditoría (esencial para gobierno)
// ─────────────────────────────────────────────────────────────────────────

export const auditLog = pgTable('audit_log', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  accion: varchar('accion', { length: 80 }).notNull(), // 'crear_alumno', 'subir_documento', etc.
  entidad: varchar('entidad', { length: 60 }).notNull(),
  entidadId: integer('entidad_id'),
  metadata: jsonb('metadata'),
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
