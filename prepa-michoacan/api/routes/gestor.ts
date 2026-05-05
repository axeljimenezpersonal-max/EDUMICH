/**
 * Rutas del gestor.
 *
 * GET    /gestor/dashboard          → KPIs del gestor (sus alumnos)
 * GET    /gestor/alumnos            → lista paginada con filtros
 * POST   /gestor/alumnos            → crear nuevo alumno + cuenta de usuario
 * GET    /gestor/alumnos/:id        → detalle del alumno con documentos
 * POST   /gestor/alumnos/:id/documentos  → subir documento (multipart)
 * GET    /gestor/convocatoria-activa → la convocatoria abierta actual
 *
 * Ubicación destino en Replit: artifacts/api-server/src/routes/gestor.ts
 */

import { Router } from 'express';
import { and, desc, eq, sql, count } from 'drizzle-orm';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import path from 'node:path';
import fs from 'node:fs/promises';
import { db } from '../db';
import {
  users,
  estudiantes,
  gestores,
  inscripciones,
  documentos,
  convocatorias,
  municipios,
  auditLog,
} from '@workspace/db/schema';
import { authRequired, requireRol } from '../middleware/auth';

const router = Router();

router.use(authRequired, requireRol('gestor'));

// ─── Helper: obtiene el municipio del gestor logueado ────────────────
async function getGestorContext(userId: number) {
  const [g] = await db
    .select({
      municipioId: gestores.municipioId,
      nombreMunicipio: municipios.nombre,
      nombreCompleto: gestores.nombreCompleto,
    })
    .from(gestores)
    .leftJoin(municipios, eq(gestores.municipioId, municipios.id))
    .where(eq(gestores.userId, userId));
  return g ?? null;
}

// ─── GET /gestor/dashboard ───────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  const userId = req.user!.userId;
  const ctx = await getGestorContext(userId);
  if (!ctx) return res.status(404).json({ error: 'Gestor no encontrado' });

  const [{ total }] = await db
    .select({ total: count() })
    .from(estudiantes)
    .where(eq(estudiantes.gestorId, userId));

  // alumnos con al menos una inscripción
  const conInscripcion = await db
    .select({ id: estudiantes.userId })
    .from(estudiantes)
    .innerJoin(inscripciones, eq(inscripciones.estudianteId, estudiantes.userId))
    .where(eq(estudiantes.gestorId, userId));

  // documentos pendientes por revisar (de mis alumnos)
  const docsPendientes = await db
    .select({ c: count() })
    .from(documentos)
    .innerJoin(inscripciones, eq(documentos.inscripcionId, inscripciones.id))
    .innerJoin(estudiantes, eq(estudiantes.userId, inscripciones.estudianteId))
    .where(
      and(
        eq(estudiantes.gestorId, userId),
        eq(documentos.estado, 'pendiente_revision')
      )
    );

  res.json({
    municipio: ctx.nombreMunicipio,
    gestorNombre: ctx.nombreCompleto,
    kpis: {
      alumnosTotales: total,
      alumnosConInscripcion: conInscripcion.length,
      documentosPendientes: docsPendientes[0]?.c ?? 0,
    },
  });
});

// ─── GET /gestor/alumnos ─────────────────────────────────────────────
router.get('/alumnos', async (req, res) => {
  const userId = req.user!.userId;

  const rows = await db
    .select({
      userId: estudiantes.userId,
      nombreCompleto: estudiantes.nombreCompleto,
      curp: estudiantes.curp,
      telefono: estudiantes.telefono,
      createdAt: estudiantes.createdAt,
    })
    .from(estudiantes)
    .where(eq(estudiantes.gestorId, userId))
    .orderBy(desc(estudiantes.createdAt));

  // Para cada alumno, su inscripción más reciente y conteo de documentos
  const alumnosConDetalle = await Promise.all(
    rows.map(async (r) => {
      const [insc] = await db
        .select({
          id: inscripciones.id,
          estado: inscripciones.estado,
          convocatoriaNombre: convocatorias.nombre,
        })
        .from(inscripciones)
        .leftJoin(convocatorias, eq(inscripciones.convocatoriaId, convocatorias.id))
        .where(eq(inscripciones.estudianteId, r.userId))
        .orderBy(desc(inscripciones.createdAt))
        .limit(1);

      const [{ docs }] = insc
        ? await db
            .select({ docs: count() })
            .from(documentos)
            .where(eq(documentos.inscripcionId, insc.id))
        : [{ docs: 0 }];

      return { ...r, inscripcion: insc ?? null, docsCount: docs };
    })
  );

  res.json({ alumnos: alumnosConDetalle });
});

// ─── POST /gestor/alumnos ────────────────────────────────────────────
const crearAlumnoSchema = z.object({
  nombreCompleto: z.string().min(3).max(200),
  curp: z.string().length(18),
  email: z.string().email(),
  telefono: z.string().min(7).max(30).optional(),
  fechaNacimiento: z.string().optional(), // YYYY-MM-DD
  direccion: z.string().optional(),
  convocatoriaId: z.number().int().positive(),
});

router.post('/alumnos', async (req, res) => {
  const userId = req.user!.userId;
  const ctx = await getGestorContext(userId);
  if (!ctx) return res.status(404).json({ error: 'Gestor no encontrado' });

  const parse = crearAlumnoSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: 'Datos inválidos', detalles: parse.error.issues });
  }
  const data = parse.data;

  // Verifica CURP duplicada
  const [exists] = await db
    .select()
    .from(estudiantes)
    .where(eq(estudiantes.curp, data.curp.toUpperCase()));
  if (exists) {
    return res.status(409).json({ error: 'Ya existe un alumno con ese CURP' });
  }

  // Crea cuenta de usuario (password = primeros 4 de CURP + año de nacimiento, simple para demo)
  const tempPassword = data.curp.slice(0, 4).toUpperCase() + (data.fechaNacimiento?.slice(0, 4) ?? '0000');
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const [user] = await db
    .insert(users)
    .values({
      email: data.email.toLowerCase(),
      passwordHash,
      rol: 'estudiante',
    })
    .returning();

  await db.insert(estudiantes).values({
    userId: user.id,
    nombreCompleto: data.nombreCompleto,
    curp: data.curp.toUpperCase(),
    fechaNacimiento: data.fechaNacimiento,
    telefono: data.telefono,
    direccion: data.direccion,
    municipioId: ctx.municipioId,
    gestorId: userId,
  });

  // Crea inscripción a la convocatoria seleccionada
  const [insc] = await db
    .insert(inscripciones)
    .values({
      estudianteId: user.id,
      convocatoriaId: data.convocatoriaId,
      estado: 'pre_registro',
      creadoPorUserId: userId,
    })
    .returning();

  await db.insert(auditLog).values({
    userId,
    accion: 'crear_alumno',
    entidad: 'estudiante',
    entidadId: user.id,
    metadata: { curp: data.curp, convocatoriaId: data.convocatoriaId },
  });

  res.status(201).json({
    alumno: {
      userId: user.id,
      nombreCompleto: data.nombreCompleto,
      curp: data.curp.toUpperCase(),
      email: data.email.toLowerCase(),
    },
    inscripcionId: insc.id,
    credencialTemporal: tempPassword,
  });
});

// ─── GET /gestor/alumnos/:id ─────────────────────────────────────────
router.get('/alumnos/:id', async (req, res) => {
  const userId = req.user!.userId;
  const alumnoId = Number(req.params.id);
  if (Number.isNaN(alumnoId)) return res.status(400).json({ error: 'ID inválido' });

  const [alumno] = await db
    .select()
    .from(estudiantes)
    .where(and(eq(estudiantes.userId, alumnoId), eq(estudiantes.gestorId, userId)));

  if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado' });

  const [userRow] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, alumnoId));

  const inscs = await db
    .select({
      id: inscripciones.id,
      estado: inscripciones.estado,
      convocatoria: convocatorias.nombre,
      convocatoriaId: convocatorias.id,
      createdAt: inscripciones.createdAt,
    })
    .from(inscripciones)
    .leftJoin(convocatorias, eq(inscripciones.convocatoriaId, convocatorias.id))
    .where(eq(inscripciones.estudianteId, alumnoId))
    .orderBy(desc(inscripciones.createdAt));

  const docs = inscs.length
    ? await db
        .select()
        .from(documentos)
        .where(eq(documentos.inscripcionId, inscs[0].id))
        .orderBy(desc(documentos.createdAt))
    : [];

  res.json({
    alumno: { ...alumno, email: userRow?.email },
    inscripciones: inscs,
    documentos: docs,
  });
});

// ─── POST /gestor/alumnos/:id/documentos ─────────────────────────────
const STORAGE_DIR = process.env.STORAGE_DIR || '/tmp/prepa-storage';

const upload = multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      await fs.mkdir(STORAGE_DIR, { recursive: true });
      cb(null, STORAGE_DIR);
    },
    filename: (req, file, cb) => {
      const ts = Date.now();
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${ts}_${safe}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Solo se aceptan archivos PDF'));
    }
    cb(null, true);
  },
});

router.post('/alumnos/:id/documentos', upload.single('archivo'), async (req, res) => {
  const userId = req.user!.userId;
  const alumnoId = Number(req.params.id);
  const file = req.file;

  if (!file) return res.status(400).json({ error: 'Archivo PDF requerido' });

  const [alumno] = await db
    .select()
    .from(estudiantes)
    .where(and(eq(estudiantes.userId, alumnoId), eq(estudiantes.gestorId, userId)));
  if (!alumno) {
    await fs.unlink(file.path).catch(() => {});
    return res.status(404).json({ error: 'Alumno no encontrado' });
  }

  const [insc] = await db
    .select()
    .from(inscripciones)
    .where(eq(inscripciones.estudianteId, alumnoId))
    .orderBy(desc(inscripciones.createdAt))
    .limit(1);
  if (!insc) {
    await fs.unlink(file.path).catch(() => {});
    return res.status(400).json({ error: 'El alumno no tiene inscripción activa' });
  }

  const tipoSugerido = (req.body.tipoSugerido as string) || 'otro';
  const nombre = (req.body.nombre as string) || file.originalname;

  const [doc] = await db
    .insert(documentos)
    .values({
      inscripcionId: insc.id,
      nombre,
      archivoOriginal: file.originalname,
      storageKey: file.path,
      tamanoBytes: file.size,
      tipoSugerido,
      estado: 'pendiente_revision',
      subidoPorUserId: userId,
    })
    .returning();

  // Actualiza estado de inscripción si estaba en pre_registro
  if (insc.estado === 'pre_registro') {
    await db
      .update(inscripciones)
      .set({ estado: 'documentos_pendientes', updatedAt: new Date() })
      .where(eq(inscripciones.id, insc.id));
  }

  await db.insert(auditLog).values({
    userId,
    accion: 'subir_documento',
    entidad: 'documento',
    entidadId: doc.id,
    metadata: { tipoSugerido, alumnoId },
  });

  res.status(201).json({ documento: doc });
});

// ─── GET /gestor/convocatoria-activa ─────────────────────────────────
router.get('/convocatoria-activa', async (_req, res) => {
  const [conv] = await db
    .select()
    .from(convocatorias)
    .where(eq(convocatorias.estado, 'abierta'))
    .orderBy(desc(convocatorias.fechaApertura))
    .limit(1);
  res.json({ convocatoria: conv ?? null });
});

export default router;
