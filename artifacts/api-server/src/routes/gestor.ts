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
import { and, desc, eq, count } from 'drizzle-orm';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import path from 'path';
import fs from 'node:fs/promises';
import { createReadStream, existsSync } from 'fs';
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
  expedienteDocumentos,
} from '@workspace/db/schema';
import { authRequired, requireRol } from '../middleware/auth';
import { sendBienvenidaCredenciales } from '../services/email';
import { generarPasswordTemporal } from '../utils/password';

const router = Router();

router.use(authRequired, requireRol('gestor'));

// ─── Multer (shared by /registro-completo and /:id/documentos) ───────
const STORAGE_DIR = process.env.STORAGE_DIR || '/tmp/prepa-storage';

const upload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      await fs.mkdir(STORAGE_DIR, { recursive: true });
      cb(null, STORAGE_DIR);
    },
    filename: (_req, file, cb) => {
      const ts = Date.now();
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${ts}_${safe}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      cb(new Error('Solo se aceptan archivos PDF'));
      return;
    }
    cb(null, true);
  },
});

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
  if (!ctx) {
    res.status(404).json({ error: 'Gestor no encontrado' });
    return;
  }

  const [{ total }] = await db
    .select({ total: count() })
    .from(estudiantes)
    .where(eq(estudiantes.gestorId, userId));

  const conInscripcion = await db
    .select({ id: estudiantes.userId })
    .from(estudiantes)
    .innerJoin(inscripciones, eq(inscripciones.estudianteId, estudiantes.userId))
    .where(eq(estudiantes.gestorId, userId));

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
  fechaNacimiento: z.string().optional(),
  direccion: z.string().optional(),
  convocatoriaId: z.number().int().positive(),
});

router.post('/alumnos', async (req, res) => {
  const userId = req.user!.userId;
  const ctx = await getGestorContext(userId);
  if (!ctx) {
    res.status(404).json({ error: 'Gestor no encontrado' });
    return;
  }

  const parse = crearAlumnoSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Datos inválidos', detalles: parse.error.issues });
    return;
  }
  const data = parse.data;

  const [emailExists] = await db.select().from(users).where(eq(users.email, data.email.toLowerCase()));
  if (emailExists) {
    res.status(409).json({ error: 'Ya existe una cuenta con ese correo electrónico' });
    return;
  }

  const [curpExists] = await db
    .select()
    .from(estudiantes)
    .where(eq(estudiantes.curp, data.curp.toUpperCase()));
  if (curpExists) {
    res.status(409).json({ error: 'Ya existe un alumno con ese CURP' });
    return;
  }

  const tempPassword = generarPasswordTemporal();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const [user] = await db
    .insert(users)
    .values({
      email: data.email.toLowerCase(),
      passwordHash,
      rol: 'estudiante',
      passwordTemporal: true,
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

  const [insc] = await db
    .insert(inscripciones)
    .values({
      estudianteId: user.id,
      convocatoriaId: data.convocatoriaId,
      estado: 'pre_registro',
      creadoPorUserId: userId,
    })
    .returning();

  // Send welcome email
  let emailEnviado = false;
  let modoEmail: 'dev' | 'production' = 'dev';
  try {
    const result = await sendBienvenidaCredenciales(data.email.toLowerCase(), {
      nombreAlumno: data.nombreCompleto,
      email: data.email.toLowerCase(),
      passwordTemporal: tempPassword,
      portalUrl: process.env.PUBLIC_PORTAL_URL || 'http://localhost:5173/login',
      gestor: {
        nombre: ctx.nombreCompleto,
        telefono: null,
        municipio: ctx.nombreMunicipio ?? null,
      },
    });
    emailEnviado = result.enviado;
    modoEmail = result.modo;
    if (emailEnviado) {
      await db.update(users).set({ bienvenidaEnviadaEn: new Date() }).where(eq(users.id, user.id));
    }
  } catch {}

  await db.insert(auditLog).values({
    userId,
    accion: 'crear_alumno',
    entidad: 'estudiante',
    entidadId: user.id,
    metadata: { curp: data.curp, convocatoriaId: data.convocatoriaId, emailEnviado },
  });

  res.status(201).json({
    alumno: {
      userId: user.id,
      nombreCompleto: data.nombreCompleto,
      curp: data.curp.toUpperCase(),
      email: data.email.toLowerCase(),
    },
    inscripcionId: insc.id,
    emailEnviado,
    modoEmail,
    ...(modoEmail === 'dev' ? { credencialTemporal: tempPassword } : {}),
  });
});

// ─── POST /gestor/alumnos/registro-completo ──────────────────────────
router.post(
  '/alumnos/registro-completo',
  upload.fields([
    { name: 'doc_curp', maxCount: 1 },
    { name: 'doc_acta', maxCount: 1 },
    { name: 'doc_ine', maxCount: 1 },
    { name: 'doc_domicilio', maxCount: 1 },
  ]),
  async (req, res) => {
    const userId = req.user!.userId;
    const ctx = await getGestorContext(userId);
    if (!ctx) {
      res.status(404).json({ error: 'Gestor no encontrado' });
      return;
    }

    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const docCurp = files?.['doc_curp']?.[0];
    const docActa = files?.['doc_acta']?.[0];
    const docIne = files?.['doc_ine']?.[0];
    const docDomicilio = files?.['doc_domicilio']?.[0];

    const allFiles = [docCurp, docActa, docIne, docDomicilio];
    const missing: string[] = [];
    if (!docCurp) missing.push('CURP');
    if (!docActa) missing.push('Acta de nacimiento');
    if (!docIne) missing.push('Identificación oficial (INE)');
    if (!docDomicilio) missing.push('Comprobante de domicilio');

    if (missing.length > 0) {
      for (const f of allFiles) if (f) await fs.unlink(f.path).catch(() => {});
      res.status(400).json({ error: `Faltan documentos: ${missing.join(', ')}` });
      return;
    }

    const body = req.body as Record<string, string>;
    const parse = crearAlumnoSchema.safeParse({
      nombreCompleto: body.nombreCompleto,
      curp: body.curp,
      email: body.email,
      telefono: body.telefono || undefined,
      fechaNacimiento: body.fechaNacimiento || undefined,
      direccion: body.direccion || undefined,
      convocatoriaId: Number(body.convocatoriaId),
    });
    if (!parse.success) {
      for (const f of allFiles) if (f) await fs.unlink(f.path).catch(() => {});
      res.status(400).json({ error: 'Datos inválidos', detalles: parse.error.issues });
      return;
    }
    const data = parse.data;

    const [exists] = await db
      .select()
      .from(estudiantes)
      .where(eq(estudiantes.curp, data.curp.toUpperCase()));
    if (exists) {
      for (const f of allFiles) if (f) await fs.unlink(f.path).catch(() => {});
      res.status(409).json({ error: 'Ya existe un alumno con ese CURP' });
      return;
    }

    const uploadedFiles = [docCurp!, docActa!, docIne!, docDomicilio!];
    try {
      const result = await db.transaction(async (tx) => {
        const tempPassword = generarPasswordTemporal();
        const passwordHash = await bcrypt.hash(tempPassword, 10);

        const [user] = await tx
          .insert(users)
          .values({ email: data.email.toLowerCase(), passwordHash, rol: 'estudiante', passwordTemporal: true })
          .returning();

        await tx.insert(estudiantes).values({
          userId: user.id,
          nombreCompleto: data.nombreCompleto,
          curp: data.curp.toUpperCase(),
          fechaNacimiento: data.fechaNacimiento,
          telefono: data.telefono,
          direccion: data.direccion,
          municipioId: ctx.municipioId,
          gestorId: userId,
        });

        const [insc] = await tx
          .insert(inscripciones)
          .values({
            estudianteId: user.id,
            convocatoriaId: data.convocatoriaId,
            estado: 'documentos_pendientes',
            creadoPorUserId: userId,
          })
          .returning();

        const docDefs = [
          { file: docCurp!, tipo: 'curp', nombre: 'CURP' },
          { file: docActa!, tipo: 'acta', nombre: 'Acta de nacimiento' },
          { file: docIne!, tipo: 'ine', nombre: 'Identificación oficial (INE)' },
          { file: docDomicilio!, tipo: 'domicilio', nombre: 'Comprobante de domicilio' },
        ];
        const docsInserted = [];
        for (const def of docDefs) {
          const [doc] = await tx
            .insert(documentos)
            .values({
              inscripcionId: insc.id,
              nombre: def.nombre,
              archivoOriginal: def.file.originalname,
              storageKey: def.file.path,
              tamanoBytes: def.file.size,
              tipoSugerido: def.tipo,
              estado: 'pendiente_revision',
              subidoPorUserId: userId,
            })
            .returning();
          docsInserted.push(doc);
        }

        await tx.insert(auditLog).values({
          userId,
          accion: 'registro_completo',
          entidad: 'estudiante',
          entidadId: user.id,
          metadata: { curp: data.curp, convocatoriaId: data.convocatoriaId, docs: 4 },
        });

        return {
          alumno: {
            userId: user.id,
            nombreCompleto: data.nombreCompleto,
            curp: data.curp.toUpperCase(),
            email: data.email.toLowerCase(),
          },
          inscripcionId: insc.id,
          credencialTemporal: tempPassword,
          documentos: docsInserted,
        };
      });

      // Send welcome email after transaction
      let emailEnviado = false;
      let modoEmail: 'dev' | 'production' = 'dev';
      try {
        const emailResult = await sendBienvenidaCredenciales(data.email.toLowerCase(), {
          nombreAlumno: data.nombreCompleto,
          email: data.email.toLowerCase(),
          passwordTemporal: result.credencialTemporal,
          portalUrl: process.env.PUBLIC_PORTAL_URL || 'http://localhost:5173/login',
          gestor: {
            nombre: ctx.nombreCompleto,
            telefono: null,
            municipio: ctx.nombreMunicipio ?? null,
          },
        });
        emailEnviado = emailResult.enviado;
        modoEmail = emailResult.modo;
        if (emailEnviado) {
          await db.update(users).set({ bienvenidaEnviadaEn: new Date() }).where(eq(users.id, result.alumno.userId));
        }
      } catch {}

      res.status(201).json({
        ...result,
        emailEnviado,
        modoEmail,
        ...(modoEmail !== 'dev' ? { credencialTemporal: undefined } : {}),
      });
    } catch (err) {
      for (const f of uploadedFiles) await fs.unlink(f.path).catch(() => {});
      throw err;
    }
  }
);

// ─── GET /gestor/alumnos/:id ─────────────────────────────────────────
router.get('/alumnos/:id', async (req, res) => {
  const userId = req.user!.userId;
  const alumnoId = Number(req.params.id);
  if (Number.isNaN(alumnoId)) {
    res.status(400).json({ error: 'ID inválido' });
    return;
  }

  const [alumno] = await db
    .select()
    .from(estudiantes)
    .where(and(eq(estudiantes.userId, alumnoId), eq(estudiantes.gestorId, userId)));

  if (!alumno) {
    res.status(404).json({ error: 'Alumno no encontrado' });
    return;
  }

  const [userRow] = await db
    .select({
      email: users.email,
      passwordTemporal: users.passwordTemporal,
      bienvenidaEnviadaEn: users.bienvenidaEnviadaEn,
    })
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
    alumno: {
      ...alumno,
      email: userRow?.email,
      passwordTemporal: userRow?.passwordTemporal ?? true,
      bienvenidaEnviadaEn: userRow?.bienvenidaEnviadaEn ?? null,
    },
    inscripciones: inscs,
    documentos: docs,
  });
});

// ─── POST /gestor/alumnos/:id/documentos ─────────────────────────────
router.post('/alumnos/:id/documentos', upload.single('archivo'), async (req, res) => {
  const userId = req.user!.userId;
  const alumnoId = Number(req.params.id);
  const file = req.file;

  if (!file) {
    res.status(400).json({ error: 'Archivo PDF requerido' });
    return;
  }

  const [alumno] = await db
    .select()
    .from(estudiantes)
    .where(and(eq(estudiantes.userId, alumnoId), eq(estudiantes.gestorId, userId)));
  if (!alumno) {
    await fs.unlink(file.path).catch(() => {});
    res.status(404).json({ error: 'Alumno no encontrado' });
    return;
  }

  const [insc] = await db
    .select()
    .from(inscripciones)
    .where(eq(inscripciones.estudianteId, alumnoId))
    .orderBy(desc(inscripciones.createdAt))
    .limit(1);
  if (!insc) {
    await fs.unlink(file.path).catch(() => {});
    res.status(400).json({ error: 'El alumno no tiene inscripción activa' });
    return;
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

// ─────────────────────────────────────────────────────────────────────────
// Expediente del alumno — el gestor sube docs al mismo expedienteDocumentos
// que usa el alumno, garantizando que ambos vean lo mismo.
// ─────────────────────────────────────────────────────────────────────────

const EXPEDIENTE_GESTOR_DIR = process.env.STORAGE_DIR
  ? path.join(process.env.STORAGE_DIR, 'expediente')
  : '/tmp/prepa-storage/expediente';

// Acepta PDF + imágenes a nivel de multer; el handler filtra por tipo.
const uploadExpedienteGestor = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      await fs.mkdir(EXPEDIENTE_GESTOR_DIR, { recursive: true });
      cb(null, EXPEDIENTE_GESTOR_DIR);
    },
    filename: (_req, file, cb) => {
      const ts = Date.now();
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${ts}_${safe}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowed.includes(file.mimetype)) {
      cb(new Error('Formato no aceptado. Usa PDF, JPG o PNG.'));
      return;
    }
    cb(null, true);
  },
});

const TIPOS_EXPEDIENTE = [
  'curp', 'acta_nacimiento', 'ine', 'comprobante_domicilio',
  'foto', 'comprobante_pago',
] as const;
type TipoExpediente = (typeof TIPOS_EXPEDIENTE)[number];

function esTipoExpediente(t: string): t is TipoExpediente {
  return (TIPOS_EXPEDIENTE as readonly string[]).includes(t);
}

async function verificarAlumnoDelGestor(gestorUserId: number, alumnoId: number) {
  const [alumno] = await db
    .select()
    .from(estudiantes)
    .where(and(eq(estudiantes.userId, alumnoId), eq(estudiantes.gestorId, gestorUserId)));
  return alumno ?? null;
}

// ─── GET /gestor/alumnos/:id/expediente ──────────────────────────────
router.get('/alumnos/:id/expediente', async (req, res) => {
  const gestorId = req.user!.userId;
  const alumnoId = Number(req.params.id as string);

  if (!alumnoId) { res.status(400).json({ error: 'ID inválido' }); return; }

  const alumno = await verificarAlumnoDelGestor(gestorId, alumnoId);
  if (!alumno) { res.status(404).json({ error: 'Alumno no encontrado' }); return; }

  const docs = await db
    .select()
    .from(expedienteDocumentos)
    .where(eq(expedienteDocumentos.estudianteId, alumnoId));

  const docsPorTipo: Record<string, unknown> = {};
  for (const d of docs) {
    docsPorTipo[d.tipo] = {
      estado: d.estado,
      motivoRechazo: d.motivoRechazo ?? null,
      nombreOriginal: d.nombreOriginal,
      tamanoBytes: d.tamanoBytes ?? null,
      subidoEn: d.subidoEn,
    };
  }

  res.json({ documentos: docsPorTipo });
});

// ─── POST /gestor/alumnos/:id/expediente/documento/:tipo ──────────────
router.post(
  '/alumnos/:id/expediente/documento/:tipo',
  uploadExpedienteGestor.single('archivo'),
  async (req, res) => {
    const gestorId = req.user!.userId;
    const alumnoId = Number(req.params.id as string);
    const tipo = req.params.tipo as string;

    if (!alumnoId) {
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    if (!esTipoExpediente(tipo)) {
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
      res.status(400).json({ error: 'Tipo de documento inválido' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No se recibió archivo' });
      return;
    }

    // Solo foto acepta imágenes; el resto solo PDF
    if (tipo !== 'foto' && req.file.mimetype !== 'application/pdf') {
      await fs.unlink(req.file.path).catch(() => {});
      res.status(400).json({ error: 'Solo se aceptan archivos PDF para este documento' });
      return;
    }

    const alumno = await verificarAlumnoDelGestor(gestorId, alumnoId);
    if (!alumno) {
      await fs.unlink(req.file.path).catch(() => {});
      res.status(404).json({ error: 'Alumno no encontrado' });
      return;
    }

    await db
      .insert(expedienteDocumentos)
      .values({
        estudianteId: alumnoId,
        tipo,
        estado: 'pendiente_revision',
        rutaArchivo: req.file.path,
        nombreOriginal: req.file.originalname,
        tamanoBytes: req.file.size,
        subidoPorUserId: gestorId,
        subidoEn: new Date(),
        motivoRechazo: null,
      })
      .onConflictDoUpdate({
        target: [expedienteDocumentos.estudianteId, expedienteDocumentos.tipo],
        set: {
          estado: 'pendiente_revision',
          rutaArchivo: req.file.path,
          nombreOriginal: req.file.originalname,
          tamanoBytes: req.file.size,
          subidoPorUserId: gestorId,
          subidoEn: new Date(),
          motivoRechazo: null,
          updatedAt: new Date(),
        },
      });

    await db.insert(auditLog).values({
      userId: gestorId,
      accion: 'subir_documento_expediente',
      entidad: 'expediente_documentos',
      entidadId: alumnoId,
      metadata: { tipo, alumnoId },
    });

    res.json({ ok: true, tipo, nombreOriginal: req.file.originalname });
  }
);

// ─── Función compartida para servir doc de expediente (gestor) ────────
async function servirDocExpedienteGestor(
  gestorId: number,
  alumnoId: number,
  tipo: string,
  disposition: 'inline' | 'attachment',
  res: import('express').Response
) {
  if (!esTipoExpediente(tipo)) {
    res.status(400).json({ error: 'Tipo inválido' });
    return;
  }

  const alumno = await verificarAlumnoDelGestor(gestorId, alumnoId);
  if (!alumno) { res.status(404).json({ error: 'Alumno no encontrado' }); return; }

  const [doc] = await db
    .select()
    .from(expedienteDocumentos)
    .where(
      and(eq(expedienteDocumentos.estudianteId, alumnoId), eq(expedienteDocumentos.tipo, tipo))
    );

  if (!doc) { res.status(404).json({ error: 'Documento no encontrado' }); return; }
  if (!existsSync(doc.rutaArchivo)) {
    res.status(404).json({ error: 'Archivo no disponible' });
    return;
  }

  const safe = doc.nombreOriginal.replace(/[^a-zA-Z0-9_\-. ]/g, '').trim() || 'documento';
  const mime = doc.rutaArchivo.match(/\.(jpe?g)$/i)
    ? 'image/jpeg'
    : doc.rutaArchivo.match(/\.png$/i)
    ? 'image/png'
    : 'application/pdf';
  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Disposition', `${disposition}; filename="${safe}"`);
  createReadStream(doc.rutaArchivo).pipe(res);
}

// ─── POST /gestor/alumnos/:id/reenviar-credenciales ──────────────────
router.post('/alumnos/:id/reenviar-credenciales', async (req, res) => {
  const gestorUserId = req.user!.userId;
  const alumnoId = Number(req.params.id);
  if (Number.isNaN(alumnoId)) { res.status(400).json({ error: 'ID inválido' }); return; }

  const ctx = await getGestorContext(gestorUserId);
  if (!ctx) { res.status(404).json({ error: 'Gestor no encontrado' }); return; }

  // Verify alumno belongs to this gestor
  const [alumno] = await db
    .select()
    .from(estudiantes)
    .where(and(eq(estudiantes.userId, alumnoId), eq(estudiantes.gestorId, gestorUserId)));
  if (!alumno) { res.status(404).json({ error: 'Alumno no encontrado' }); return; }

  const [userRow] = await db
    .select({ email: users.email, passwordTemporal: users.passwordTemporal })
    .from(users)
    .where(eq(users.id, alumnoId));
  if (!userRow) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }

  if (!userRow.passwordTemporal) {
    res.status(400).json({
      error: 'El alumno ya cambió su contraseña. No se puede reenviar la temporal por seguridad. El alumno debe usar "Recuperar contraseña" desde el login.',
    });
    return;
  }

  const newPassword = generarPasswordTemporal();
  const passwordHash = await bcrypt.hash(newPassword, 10);

  await db.update(users)
    .set({ passwordHash, bienvenidaEnviadaEn: null, updatedAt: new Date() })
    .where(eq(users.id, alumnoId));

  let emailEnviado = false;
  let modoEmail: 'dev' | 'production' = 'dev';
  try {
    const result = await sendBienvenidaCredenciales(userRow.email, {
      nombreAlumno: alumno.nombreCompleto,
      email: userRow.email,
      passwordTemporal: newPassword,
      portalUrl: process.env.PUBLIC_PORTAL_URL || 'http://localhost:5173/login',
      gestor: { nombre: ctx.nombreCompleto, telefono: null, municipio: ctx.nombreMunicipio ?? null },
    });
    emailEnviado = result.enviado;
    modoEmail = result.modo;
    if (emailEnviado) {
      await db.update(users).set({ bienvenidaEnviadaEn: new Date() }).where(eq(users.id, alumnoId));
    }
  } catch {}

  await db.insert(auditLog).values({
    userId: gestorUserId,
    accion: 'reenviar_credenciales',
    entidad: 'users',
    entidadId: alumnoId,
    metadata: { emailEnviado, modoEmail },
  });

  res.json({
    ok: true,
    emailEnviado,
    modoEmail,
    ...(modoEmail === 'dev' ? { credencialTemporal: newPassword } : {}),
  });
});

// ─── GET /gestor/alumnos/:id/expediente/documento/:tipo/preview ───────
router.get('/alumnos/:id/expediente/documento/:tipo/preview', async (req, res) => {
  const alumnoId = Number(req.params.id as string);
  await servirDocExpedienteGestor(req.user!.userId, alumnoId, req.params.tipo as string, 'inline', res);
});

// ─── GET /gestor/alumnos/:id/expediente/documento/:tipo/descargar ─────
router.get('/alumnos/:id/expediente/documento/:tipo/descargar', async (req, res) => {
  const alumnoId = Number(req.params.id as string);
  await servirDocExpedienteGestor(req.user!.userId, alumnoId, req.params.tipo as string, 'attachment', res);
});

export default router;
