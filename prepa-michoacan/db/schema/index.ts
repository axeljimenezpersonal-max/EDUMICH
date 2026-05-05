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
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─────────────────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────────────────

export const rolEnum = pgEnum('rol', ['admin', 'gestor', 'estudiante']);

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
    privacidadAceptadaEn: timestamp('privacidad_aceptada_en'),
    ultimoLogin: timestamp('ultimo_login'),
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
  municipioId: integer('municipio_id')
    .notNull()
    .references(() => municipios.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const estudiantes = pgTable(
  'estudiantes',
  {
    userId: integer('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    nombreCompleto: varchar('nombre_completo', { length: 200 }).notNull(),
    curp: varchar('curp', { length: 18 }).notNull(),
    fechaNacimiento: date('fecha_nacimiento'),
    telefono: varchar('telefono', { length: 30 }),
    direccion: text('direccion'),
    municipioId: integer('municipio_id').references(() => municipios.id),
    gestorId: integer('gestor_id').references(() => users.id), // gestor asignado
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
