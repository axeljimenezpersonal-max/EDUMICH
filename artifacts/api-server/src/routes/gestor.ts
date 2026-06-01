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
import { and, desc, eq, count, sql, inArray, ne, lte, gte } from 'drizzle-orm';
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
  modulos,
  inscripcionModulos,
  examenesInscripciones,
  convocatoriasEtapas,
  convocatoriasModulosHorarios,
  sedes,
  pagos,
  datosBancarios,
  conceptosPago,
} from '@workspace/db/schema';
import { authRequired, requireRol } from '../middleware/auth';
import { sendBienvenidaCredenciales } from '../services/email';
import { generarPasswordTemporal } from '../utils/password';
import { generarFolioPreregistro, agregarDiasHabiles } from '../utils/folio';
import { generarFichaPreregistro, generarFichaRegistro, generarFichaPago, type MetodoPagoFicha } from '../services/pdf';
import { tryAuditLog } from '../utils/audit';
import { notificar, notificarATodosLosAdmins } from '../utils/notificar';

const router = Router();

router.use(authRequired, requireRol('gestor'));

// Helper: fetch exam cost + bank data from DB (with fallbacks)
async function getConfigPago() {
  const [concepto] = await db
    .select({ monto: conceptosPago.monto })
    .from(conceptosPago)
    .where(and(eq(conceptosPago.clave, 'derecho_examen'), eq(conceptosPago.activo, true)))
    .limit(1);
  const costoExamen = concepto ? parseFloat(String(concepto.monto)) : 150;

  const [banco] = await db
    .select()
    .from(datosBancarios)
    .where(eq(datosBancarios.activo, true))
    .limit(1);

  return { costoExamen, banco: banco ?? null };
}

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
    res.status(409).json({ error: 'Ya existe una cuenta con ese correo electrónico', campo: 'email' });
    return;
  }

  const [curpExists] = await db
    .select()
    .from(estudiantes)
    .where(eq(estudiantes.curp, data.curp.toUpperCase()));
  if (curpExists) {
    res.status(409).json({ error: 'Ya existe un alumno con ese CURP', campo: 'curp' });
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

  const folio = await generarFolioPreregistro();
  const ahora = new Date();
  const vigenteHasta = agregarDiasHabiles(ahora, 15);

  await db.insert(estudiantes).values({
    userId: user.id,
    nombreCompleto: data.nombreCompleto,
    curp: data.curp.toUpperCase(),
    fechaNacimiento: data.fechaNacimiento,
    telefono: data.telefono,
    direccion: data.direccion,
    municipioId: ctx.municipioId,
    gestorId: userId,
    folioPreregistro: folio,
    preregistroGeneradoEn: ahora,
    preregistroVigenteHasta: vigenteHasta.toISOString().split('T')[0],
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

  await tryAuditLog({
    userId,
    accion: 'crear_alumno',
    entidad: 'estudiante',
    entidadId: user.id,
    detalle: `Registró nuevo alumno CURP ${data.curp}`,
    metadata: { curp: data.curp, convocatoriaId: data.convocatoriaId, emailEnviado },
    req,
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

    const allFiles = [docCurp, docActa, docIne, docDomicilio].filter(Boolean) as Express.Multer.File[];

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

    const [curpExistsRC] = await db
      .select()
      .from(estudiantes)
      .where(eq(estudiantes.curp, data.curp.toUpperCase()));
    if (curpExistsRC) {
      for (const f of allFiles) if (f) await fs.unlink(f.path).catch(() => {});
      res.status(409).json({ error: 'Ya existe un alumno con ese CURP', campo: 'curp' });
      return;
    }

    const [emailExistsRC] = await db
      .select()
      .from(users)
      .where(eq(users.email, data.email.toLowerCase()));
    if (emailExistsRC) {
      for (const f of allFiles) if (f) await fs.unlink(f.path).catch(() => {});
      res.status(409).json({ error: 'Ya existe una cuenta con ese correo electrónico', campo: 'email' });
      return;
    }

    const uploadedFiles = allFiles;
    const folioRC = await generarFolioPreregistro();
    const ahoraRC = new Date();
    const vigenteHastaRC = agregarDiasHabiles(ahoraRC, 15);

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
          folioPreregistro: folioRC,
          preregistroGeneradoEn: ahoraRC,
          preregistroVigenteHasta: vigenteHastaRC.toISOString().split('T')[0],
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
          { file: docCurp, tipo: 'curp', nombre: 'CURP' },
          { file: docActa, tipo: 'acta', nombre: 'Acta de nacimiento' },
          { file: docIne, tipo: 'ine', nombre: 'Identificación oficial (INE)' },
          { file: docDomicilio, tipo: 'domicilio', nombre: 'Comprobante de domicilio' },
        ].filter((d): d is { file: Express.Multer.File; tipo: string; nombre: string } => d.file != null);
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

      await tryAuditLog({
        userId,
        accion: 'registro_completo',
        entidad: 'estudiante',
        entidadId: result.alumno.userId,
        detalle: `Registró alumno completo CURP ${data.curp} con ${result.documentos.length} documentos`,
        metadata: { curp: data.curp, convocatoriaId: data.convocatoriaId, docs: result.documentos.length },
        req,
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

// ─── GET /gestor/alumnos-pendientes-docs ────────────────────────────
router.get('/alumnos-pendientes-docs', async (req, res) => {
  const userId = req.user!.userId;

  const rows = await db
    .select({
      userId: estudiantes.userId,
      nombreCompleto: estudiantes.nombreCompleto,
      createdAt: estudiantes.createdAt,
    })
    .from(estudiantes)
    .where(eq(estudiantes.gestorId, userId))
    .orderBy(desc(estudiantes.createdAt));

  const result = [];
  for (const r of rows) {
    const [insc] = await db
      .select({ id: inscripciones.id })
      .from(inscripciones)
      .where(eq(inscripciones.estudianteId, r.userId))
      .orderBy(desc(inscripciones.createdAt))
      .limit(1);

    const [{ c: docsCount }] = insc
      ? await db.select({ c: count() }).from(documentos).where(eq(documentos.inscripcionId, insc.id))
      : [{ c: 0 }];

    if (docsCount < 4) {
      const creadoEn = new Date(r.createdAt as string | Date);
      const diasDesdeRegistro = Math.floor((Date.now() - creadoEn.getTime()) / 86400000);
      const parts = r.nombreCompleto.split(' ').filter(Boolean);
      const iniciales = parts.length >= 2
        ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
        : r.nombreCompleto.substring(0, 2).toUpperCase();

      result.push({
        id: r.userId,
        nombreCompleto: r.nombreCompleto,
        iniciales,
        docsAprobados: docsCount,
        docsTotal: 4,
        docsFaltantes: 4 - docsCount,
        creadoEn: creadoEn.toISOString(),
        diasDesdeRegistro,
      });
    }
  }

  res.json({ alumnos: result, total: result.length });
});

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

// ─── PATCH /gestor/alumnos/:id ───────────────────────────────────────
// Gestor can update basic student profile fields (not email, not curp after initial entry)
const editarAlumnoSchema = z.object({
  nombreCompleto: z.string().min(2).max(200).optional(),
  telefono: z.string().max(30).nullable().optional(),
  direccion: z.string().max(500).nullable().optional(),
  fechaNacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  curp: z.string().length(18).toUpperCase().nullable().optional(),
});

router.patch('/alumnos/:id', async (req, res) => {
  const userId = req.user!.userId;
  const alumnoId = Number(req.params.id);
  if (Number.isNaN(alumnoId)) {
    res.status(400).json({ error: 'ID inválido' });
    return;
  }

  // Verify ownership
  const [alumno] = await db
    .select()
    .from(estudiantes)
    .where(and(eq(estudiantes.userId, alumnoId), eq(estudiantes.gestorId, userId)));

  if (!alumno) {
    res.status(404).json({ error: 'Alumno no encontrado' });
    return;
  }

  const parse = editarAlumnoSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Datos inválidos', detalles: parse.error.issues });
    return;
  }

  const data = parse.data;
  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: 'No hay campos para actualizar' });
    return;
  }

  const updateFields: Record<string, unknown> = {};
  if (data.nombreCompleto !== undefined) updateFields.nombreCompleto = data.nombreCompleto;
  if (data.telefono !== undefined) updateFields.telefono = data.telefono;
  if (data.direccion !== undefined) updateFields.direccion = data.direccion;
  if (data.fechaNacimiento !== undefined) updateFields.fechaNacimiento = data.fechaNacimiento;
  if (data.curp !== undefined) updateFields.curp = data.curp;
  updateFields.updatedAt = new Date();

  await db
    .update(estudiantes)
    .set(updateFields)
    .where(eq(estudiantes.userId, alumnoId));

  await tryAuditLog({
    userId,
    accion: 'editar_alumno',
    entidad: 'estudiantes',
    entidadId: alumnoId,
    detalle: `Gestor actualizó datos del alumno: ${Object.keys(updateFields).filter(k => k !== 'updatedAt').join(', ')}`,
    metadata: { campos: Object.keys(updateFields).filter(k => k !== 'updatedAt') },
    req,
  });

  res.json({ ok: true });
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

  await tryAuditLog({
    userId,
    accion: 'subir_documento',
    entidad: 'documento',
    entidadId: doc.id,
    detalle: `Subió documento tipo ${tipoSugerido} para alumno ID ${alumnoId}`,
    metadata: { tipoSugerido, alumnoId },
    req,
  });

  notificarATodosLosAdmins({
    tipo: 'documento_subido_revisar',
    prioridad: 'normal',
    titulo: 'Documento pendiente de revisión',
    cuerpo: `El gestor subió un documento (${tipoSugerido}) para el alumno ID ${alumnoId}.`,
    enlace: `/admin/alumnos/${alumnoId}`,
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
      id: d.id,
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

    await tryAuditLog({
      userId: gestorId,
      accion: 'subir_documento_expediente',
      entidad: 'expediente_documentos',
      entidadId: alumnoId,
      detalle: `Subió documento de expediente tipo ${tipo} para alumno ID ${alumnoId}`,
      metadata: { tipo, alumnoId },
      req,
    });

    notificarATodosLosAdmins({
      tipo: 'documento_subido_revisar',
      prioridad: 'normal',
      titulo: 'Documento de expediente para revisar',
      cuerpo: `Gestor subió documento "${tipo}" para alumno ID ${alumnoId}.`,
      enlace: `/admin/alumnos/${alumnoId}`,
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

  await tryAuditLog({
    userId: gestorUserId,
    accion: 'reenviar_credenciales',
    entidad: 'users',
    entidadId: alumnoId,
    detalle: `Reenvió credenciales al alumno ID ${alumnoId}`,
    metadata: { emailEnviado, modoEmail },
    req,
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

// ─── GET helper: find a gestors student by doc id ────────────────────
async function verificarAlumnoDelGestorPorDoc(gestorId: number, docId: number) {
  const [row] = await db
    .select({
      id: expedienteDocumentos.id,
      estado: expedienteDocumentos.estado,
      tipo: expedienteDocumentos.tipo,
      estudianteId: expedienteDocumentos.estudianteId,
    })
    .from(expedienteDocumentos)
    .innerJoin(
      estudiantes,
      and(
        eq(estudiantes.userId, expedienteDocumentos.estudianteId),
        eq(estudiantes.gestorId, gestorId)
      )
    )
    .where(eq(expedienteDocumentos.id, docId));
  return row ?? null;
}

// ─── PUT /gestor/expediente-documentos/:id/aprobar ────────────────────
router.patch('/expediente-documentos/:id/aprobar', async (req, res) => {
  const gestorId = req.user!.userId;
  const docId = Number(req.params.id);
  if (Number.isNaN(docId)) { res.status(400).json({ error: 'ID inválido' }); return; }

  const doc = await verificarAlumnoDelGestorPorDoc(gestorId, docId);
  if (!doc) { res.status(404).json({ error: 'Documento no encontrado o no pertenece a tus alumnos' }); return; }
  if (doc.estado !== 'pendiente_revision') { res.status(400).json({ error: 'El documento no está pendiente de revisión' }); return; }

  await db
    .update(expedienteDocumentos)
    .set({ estado: 'aprobado', revisadoPorUserId: gestorId, revisadoEn: new Date(), updatedAt: new Date() })
    .where(eq(expedienteDocumentos.id, docId));

  await tryAuditLog({
    userId: gestorId,
    accion: 'aprobar_documento',
    entidad: 'expediente_documentos',
    entidadId: docId,
    detalle: `Aprobó documento tipo ${doc.tipo} del alumno ID ${doc.estudianteId}`,
    metadata: { tipo: doc.tipo, estudianteId: doc.estudianteId },
    req,
  });

  notificar({
    userId: doc.estudianteId,
    tipo: 'documento_aprobado',
    prioridad: 'normal',
    titulo: 'Documento aprobado',
    cuerpo: `Tu documento "${doc.tipo}" fue aprobado por tu gestor.`,
    enlace: '/estudiante/expediente',
  });

  res.json({ ok: true });
});

// ─── PUT /gestor/expediente-documentos/:id/rechazar ───────────────────
const rechazarDocGestorSchema = z.object({ motivoRechazo: z.string().min(1).max(500) });

router.patch('/expediente-documentos/:id/rechazar', async (req, res) => {
  const gestorId = req.user!.userId;
  const docId = Number(req.params.id);
  if (Number.isNaN(docId)) { res.status(400).json({ error: 'ID inválido' }); return; }

  const parse = rechazarDocGestorSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: 'motivoRechazo es requerido' }); return; }

  const doc = await verificarAlumnoDelGestorPorDoc(gestorId, docId);
  if (!doc) { res.status(404).json({ error: 'Documento no encontrado o no pertenece a tus alumnos' }); return; }
  if (doc.estado !== 'pendiente_revision') { res.status(400).json({ error: 'El documento no está pendiente de revisión' }); return; }

  await db
    .update(expedienteDocumentos)
    .set({ estado: 'rechazado', motivoRechazo: parse.data.motivoRechazo, revisadoPorUserId: gestorId, revisadoEn: new Date(), updatedAt: new Date() })
    .where(eq(expedienteDocumentos.id, docId));

  await tryAuditLog({
    userId: gestorId,
    accion: 'rechazar_documento',
    entidad: 'expediente_documentos',
    entidadId: docId,
    detalle: `Rechazó documento tipo ${doc.tipo} del alumno ID ${doc.estudianteId}`,
    metadata: { tipo: doc.tipo, estudianteId: doc.estudianteId, motivo: parse.data.motivoRechazo },
    req,
  });

  notificar({
    userId: doc.estudianteId,
    tipo: 'documento_rechazado',
    prioridad: 'alta',
    titulo: 'Documento rechazado — acción requerida',
    cuerpo: `Tu documento "${doc.tipo}" fue rechazado. Motivo: ${parse.data.motivoRechazo}`,
    enlace: '/estudiante/expediente',
  });

  res.json({ ok: true });
});

// ─── POST /gestor/alumnos/:id/matricula ──────────────────────────────────────
const matriculaSchema = z.object({
  matricula: z.string().min(8).max(20).regex(/^[A-Z0-9]+$/, 'Solo caracteres alfanuméricos'),
});

router.post('/alumnos/:id/matricula', async (req, res) => {
  const gestorId = req.user!.userId;
  const alumnoId = Number(req.params.id);
  if (Number.isNaN(alumnoId)) { res.status(400).json({ error: 'ID inválido' }); return; }

  const parse = matriculaSchema.safeParse({ matricula: (req.body.matricula as string)?.toUpperCase() });
  if (!parse.success) { res.status(400).json({ error: parse.error.errors[0].message }); return; }
  const { matricula } = parse.data;

  const [alumno] = await db
    .select({ userId: estudiantes.userId })
    .from(estudiantes)
    .where(and(eq(estudiantes.userId, alumnoId), eq(estudiantes.gestorId, gestorId)));
  if (!alumno) { res.status(404).json({ error: 'Alumno no encontrado o no pertenece a tus alumnos' }); return; }

  const [duplicate] = await db
    .select({ userId: estudiantes.userId })
    .from(estudiantes)
    .where(and(eq(estudiantes.matriculaOficialDGB, matricula), sql`${estudiantes.userId} != ${alumnoId}`));
  if (duplicate) { res.status(409).json({ error: 'Esta matrícula ya está asignada a otro alumno' }); return; }

  await db.update(estudiantes).set({
    matriculaOficialDGB: matricula,
    matriculaCapturadaEn: new Date(),
    matriculaCapturadaPor: gestorId,
    updatedAt: new Date(),
  }).where(eq(estudiantes.userId, alumnoId));

  await tryAuditLog({
    userId: gestorId,
    accion: 'capturar_matricula',
    entidad: 'estudiante',
    entidadId: alumnoId,
    detalle: `Capturó matrícula DGB "${matricula}" para alumno ID ${alumnoId}`,
    metadata: { matricula },
    req,
  });

  notificar({
    userId: alumnoId,
    tipo: 'matricula_asignada',
    prioridad: 'alta',
    titulo: '¡Matrícula DGB asignada!',
    cuerpo: `Se te asignó la matrícula oficial ${matricula}. Ya puedes descargar tu ficha de registro.`,
    enlace: '/estudiante',
  });

  res.json({ ok: true, matricula });
});

// ─── GET /gestor/alumnos/:id/ficha-preregistro ───────────────────────────────
router.get('/alumnos/:id/ficha-preregistro', async (req, res) => {
  const gestorId = req.user!.userId;
  const alumnoId = Number(req.params.id);
  if (Number.isNaN(alumnoId)) { res.status(400).json({ error: 'ID inválido' }); return; }

  let [est] = await db
    .select()
    .from(estudiantes)
    .where(and(eq(estudiantes.userId, alumnoId), eq(estudiantes.gestorId, gestorId)));
  if (!est) { res.status(404).json({ error: 'Alumno no encontrado' }); return; }

  if (!est.folioPreregistro) {
    const folio = await generarFolioPreregistro();
    const ahora = new Date();
    const vigencia = agregarDiasHabiles(ahora, 15);
    await db.update(estudiantes).set({
      folioPreregistro: folio,
      preregistroGeneradoEn: ahora,
      preregistroVigenteHasta: vigencia.toISOString().split('T')[0],
    }).where(eq(estudiantes.userId, alumnoId));
    [est] = await db.select().from(estudiantes).where(eq(estudiantes.userId, alumnoId));
  }

  const [userRow] = await db.select({ email: users.email }).from(users).where(eq(users.id, alumnoId));
  const [municipio] = est.municipioId
    ? await db.select({ nombre: municipios.nombre }).from(municipios).where(eq(municipios.id, est.municipioId))
    : [null];
  const [gestorRow] = await db.select({ nombreCompleto: gestores.nombreCompleto, emailPublico: gestores.emailPublico }).from(gestores).where(eq(gestores.userId, gestorId));

  const pdf = await generarFichaPreregistro({
    folio: est.folioPreregistro!,
    generadoEn: est.preregistroGeneradoEn ?? new Date(),
    vigenteHasta: est.preregistroVigenteHasta ?? null,
    nombreCompleto: est.nombreCompleto,
    curp: est.curp ?? null,
    fechaNacimiento: est.fechaNacimiento ?? null,
    genero: (est as any).genero ?? null,
    nacionalidad: (est as any).nacionalidad ?? 'Mexicana',
    telefono: est.telefono ?? null,
    email: userRow?.email ?? '',
    municipio: municipio?.nombre ?? null,
    gestor: gestorRow ? { nombre: gestorRow.nombreCompleto, email: gestorRow.emailPublico ?? null } : null,
    fotoPath: (est as any).foto ?? null,
    qrVerifUrl: `${process.env.PUBLIC_PORTAL_URL || 'http://localhost:5173'}/verificar/${est.folioPreregistro}`,
  });

  const safeFolio = est.folioPreregistro!.replace(/[^a-zA-Z0-9-]/g, '');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="ficha-preregistro-${safeFolio}.pdf"`);
  res.send(pdf);
});

// ─── GET /gestor/alumnos/:id/ficha-registro ──────────────────────────────────
router.get('/alumnos/:id/ficha-registro', async (req, res) => {
  const gestorId = req.user!.userId;
  const alumnoId = Number(req.params.id);
  if (Number.isNaN(alumnoId)) { res.status(400).json({ error: 'ID inválido' }); return; }

  const [est] = await db
    .select()
    .from(estudiantes)
    .where(and(eq(estudiantes.userId, alumnoId), eq(estudiantes.gestorId, gestorId)));
  if (!est) { res.status(404).json({ error: 'Alumno no encontrado' }); return; }
  if (!est.matriculaOficialDGB) { res.status(400).json({ error: 'El alumno aún no tiene matrícula oficial asignada' }); return; }

  const [userRow] = await db.select({ email: users.email }).from(users).where(eq(users.id, alumnoId));
  const [municipio] = est.municipioId
    ? await db.select({ nombre: municipios.nombre }).from(municipios).where(eq(municipios.id, est.municipioId))
    : [null];
  const [gestorRow] = await db.select({ nombreCompleto: gestores.nombreCompleto }).from(gestores).where(eq(gestores.userId, gestorId));

  const docsValidados = await db
    .select({ tipo: expedienteDocumentos.tipo, revisadoEn: expedienteDocumentos.revisadoEn })
    .from(expedienteDocumentos)
    .where(and(eq(expedienteDocumentos.estudianteId, alumnoId), eq(expedienteDocumentos.estado, 'aprobado')));

  const pdf = await generarFichaRegistro({
    matricula: est.matriculaOficialDGB,
    folio: est.folioPreregistro ?? '—',
    nombreCompleto: est.nombreCompleto,
    curp: est.curp ?? null,
    fechaNacimiento: est.fechaNacimiento ?? null,
    telefono: est.telefono ?? null,
    email: userRow?.email ?? '',
    municipio: municipio?.nombre ?? null,
    gestor: gestorRow ? { nombre: gestorRow.nombreCompleto } : null,
    matriculaCapturadaEn: est.matriculaCapturadaEn ?? null,
    documentosValidados: docsValidados.map(d => ({ tipo: d.tipo, validadoEn: d.revisadoEn ?? null })),
    pagos: [],
  });

  const safeMat = est.matriculaOficialDGB.replace(/[^a-zA-Z0-9]/g, '');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="ficha-registro-${safeMat}.pdf"`);
  res.send(pdf);
});

// ─── GET /gestor/alumnos/:id/plan-modular ────────────────────────────────────
// Devuelve los 21 módulos con flag `enPlan` indicando cuáles están asignados
// a la inscripción más reciente del alumno.
router.get('/alumnos/:id/plan-modular', async (req, res) => {
  const gestorId = req.user!.userId;
  const alumnoId = Number(req.params.id);
  if (!alumnoId) { res.status(400).json({ error: 'ID inválido' }); return; }

  // Verificar que el alumno pertenece a este gestor
  const [alumno] = await db
    .select({ gestorId: estudiantes.gestorId })
    .from(estudiantes)
    .where(eq(estudiantes.userId, alumnoId));
  if (!alumno || alumno.gestorId !== gestorId) {
    res.status(403).json({ error: 'Sin acceso' }); return;
  }

  // Inscripción más reciente
  const [insc] = await db
    .select({ id: inscripciones.id })
    .from(inscripciones)
    .where(eq(inscripciones.estudianteId, alumnoId))
    .orderBy(desc(inscripciones.createdAt))
    .limit(1);

  // Módulos asignados en esa inscripción
  const asignados = insc
    ? await db
        .select({ moduloId: inscripcionModulos.moduloId })
        .from(inscripcionModulos)
        .where(eq(inscripcionModulos.inscripcionId, insc.id))
    : [];
  const asignadosSet = new Set(asignados.map((a) => a.moduloId));

  const todosModulos = await db
    .select({ id: modulos.id, numero: modulos.numero, nombre: modulos.nombre, nivel: modulos.nivel })
    .from(modulos)
    .orderBy(modulos.numero);

  res.json({
    inscripcionId: insc?.id ?? null,
    modulos: todosModulos.map((m) => ({ ...m, enPlan: asignadosSet.has(m.id) })),
  });
});

// ─── PUT /gestor/alumnos/:id/plan-modular ────────────────────────────────────
// Reemplaza los módulos del plan modular del alumno en su inscripción activa.
// Body: { moduloIds: number[] }
router.put('/alumnos/:id/plan-modular', async (req, res) => {
  const gestorId = req.user!.userId;
  const alumnoId = Number(req.params.id);
  if (!alumnoId) { res.status(400).json({ error: 'ID inválido' }); return; }

  const parsed = z.object({ moduloIds: z.array(z.number().int().positive()) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'moduloIds inválidos' }); return; }
  const { moduloIds } = parsed.data;

  // Verificar que el alumno pertenece a este gestor
  const [alumno] = await db
    .select({ gestorId: estudiantes.gestorId })
    .from(estudiantes)
    .where(eq(estudiantes.userId, alumnoId));
  if (!alumno || alumno.gestorId !== gestorId) {
    res.status(403).json({ error: 'Sin acceso' }); return;
  }

  // Inscripción más reciente
  const [insc] = await db
    .select({ id: inscripciones.id })
    .from(inscripciones)
    .where(eq(inscripciones.estudianteId, alumnoId))
    .orderBy(desc(inscripciones.createdAt))
    .limit(1);
  if (!insc) { res.status(400).json({ error: 'El alumno no tiene inscripción activa' }); return; }

  // Reemplazar: borrar existentes e insertar los nuevos
  await db.delete(inscripcionModulos).where(eq(inscripcionModulos.inscripcionId, insc.id));

  if (moduloIds.length > 0) {
    await db.insert(inscripcionModulos).values(
      moduloIds.map((moduloId) => ({ inscripcionId: insc.id, moduloId }))
    );
  }

  await tryAuditLog({
    userId: gestorId,
    accion: 'actualizar_plan_modular',
    entidad: 'inscripcion_modulos',
    entidadId: insc.id,
    detalle: `Gestor asignó ${moduloIds.length} módulos al alumno ${alumnoId}`,
    req,
  });

  res.json({ ok: true, inscripcionId: insc.id, total: moduloIds.length });
});

// ─── GET /gestor/alumnos/:id/convocatoria ────────────────────────────────────
// Devuelve la etapa activa, módulos disponibles, inscripciones activas y sede.
router.get('/alumnos/:id/convocatoria', async (req, res) => {
  const gestorId = req.user!.userId;
  const alumnoId = Number(req.params.id);
  if (!alumnoId) { res.status(400).json({ error: 'ID inválido' }); return; }

  const alumno = await verificarAlumnoDelGestor(gestorId, alumnoId);
  if (!alumno) { res.status(404).json({ error: 'Alumno no encontrado' }); return; }

  // 1. Find active etapa
  const hoy = new Date().toISOString().slice(0, 10);

  const [etapa] = await db
    .select({
      id: convocatoriasEtapas.id,
      clave: convocatoriasEtapas.clave,
      etapa: convocatoriasEtapas.etapa,
      fase: convocatoriasEtapas.fase,
      solicitudInicio: convocatoriasEtapas.solicitudInicio,
      solicitudFin: convocatoriasEtapas.solicitudFin,
      examenSabado: convocatoriasEtapas.examenSabado,
      examenDomingo: convocatoriasEtapas.examenDomingo,
      estado: convocatoriasEtapas.estado,
    })
    .from(convocatoriasEtapas)
    .where(
      sql`(${convocatoriasEtapas.estado} = 'inscripcion_abierta'
        OR (${convocatoriasEtapas.solicitudInicio} <= ${hoy}
            AND ${convocatoriasEtapas.solicitudFin} >= ${hoy}))`
    )
    .orderBy(desc(convocatoriasEtapas.id))
    .limit(1);

  // Exam cost from DB
  const { costoExamen } = await getConfigPago();

  if (!etapa) {
    res.json({
      etapa: null,
      modulosDisponibles: [],
      inscripcionesActivas: [],
      sede: null,
      costoExamen,
    });
    return;
  }

  // 2. All horarios for this etapa — show every module the convocatoria offers,
  //    regardless of the student's plan assignment.
  const horariosRows = await db
    .select({
      id: convocatoriasModulosHorarios.id,
      moduloId: convocatoriasModulosHorarios.moduloId,
      dia: convocatoriasModulosHorarios.dia,
      hora: convocatoriasModulosHorarios.hora,
    })
    .from(convocatoriasModulosHorarios)
    .where(eq(convocatoriasModulosHorarios.etapaId, etapa.id));

  const horariosByModuloId = new Map(horariosRows.map((h) => [h.moduloId, h]));

  // 4. Existing active inscriptions for student + etapa
  const inscripcionesActivas = await db
    .select({
      id: examenesInscripciones.id,
      folio: examenesInscripciones.folio,
      moduloId: examenesInscripciones.moduloId,
      horarioId: examenesInscripciones.horarioId,
      estado: examenesInscripciones.estado,
      sedeId: examenesInscripciones.sedeId,
    })
    .from(examenesInscripciones)
    .where(
      and(
        eq(examenesInscripciones.estudianteId, alumnoId),
        eq(examenesInscripciones.etapaId, etapa.id),
        ne(examenesInscripciones.estado, 'cancelado')
      )
    );

  const inscritosModuloIds = new Set(inscripcionesActivas.map((i) => i.moduloId));

  // 5. Enrich inscripcionesActivas with modulo info, horario info, sede
  const allModuloIds = [
    ...new Set([
      ...horariosRows.map((h) => h.moduloId),
      ...inscripcionesActivas.map((i) => i.moduloId),
    ]),
  ];
  const modulosRows = allModuloIds.length > 0
    ? await db
        .select({ id: modulos.id, numero: modulos.numero, nombre: modulos.nombre, nivel: modulos.nivel })
        .from(modulos)
        .where(inArray(modulos.id, allModuloIds))
    : [];
  const modulosById = new Map(modulosRows.map((m) => [m.id, m]));

  // Gather sedeIds for active inscriptions
  const sedeIds = [...new Set(inscripcionesActivas.map((i) => i.sedeId))];
  const sedesRows = sedeIds.length > 0
    ? await db
        .select({ id: sedes.id, nombre: sedes.nombre, direccion: sedes.direccion })
        .from(sedes)
        .where(inArray(sedes.id, sedeIds))
    : [];
  const sedesById = new Map(sedesRows.map((s) => [s.id, s]));

  // All horario ids referenced
  const horarioIds = [...new Set(inscripcionesActivas.map((i) => i.horarioId))];
  const horariosEnriquecidos = horarioIds.length > 0
    ? await db
        .select({
          id: convocatoriasModulosHorarios.id,
          dia: convocatoriasModulosHorarios.dia,
          hora: convocatoriasModulosHorarios.hora,
        })
        .from(convocatoriasModulosHorarios)
        .where(inArray(convocatoriasModulosHorarios.id, horarioIds))
    : [];
  const horariosEnriquecidosById = new Map(horariosEnriquecidos.map((h) => [h.id, h]));

  const inscripcionesActivasEnriquecidas = inscripcionesActivas.map((i) => {
    const mod = modulosById.get(i.moduloId);
    const hor = horariosEnriquecidosById.get(i.horarioId);
    const sed = sedesById.get(i.sedeId);
    const fechaExamen = hor?.dia === 'sabado' ? etapa.examenSabado : etapa.examenDomingo;
    return {
      id: i.id,
      folio: i.folio,
      moduloId: i.moduloId,
      moduloNumero: mod?.numero ?? null,
      moduloNombre: mod?.nombre ?? null,
      dia: hor?.dia ?? null,
      hora: hor?.hora ?? null,
      fechaExamen: fechaExamen ?? null,
      estado: i.estado,
      sede: sed ? { nombre: sed.nombre, direccion: sed.direccion } : null,
    };
  });

  // 6. modulosDisponibles: all modules that have a horario in this etapa
  const modulosDisponibles = horariosRows.map((h) => {
    const mod = modulosById.get(h.moduloId);
    return {
      id: h.moduloId,
      numero: mod?.numero ?? null,
      nombre: mod?.nombre ?? null,
      nivel: mod?.nivel ?? null,
      horarioId: h.id,
      dia: h.dia,
      hora: h.hora,
      yaInscrito: inscritosModuloIds.has(h.moduloId),
    };
  });

  // 7. Student's sede (from municipioId)
  let sedeAlumno: { nombre: string; direccion: string; telefono: string | null } | null = null;
  if (alumno.municipioId) {
    const [sedeRow] = await db
      .select({ nombre: sedes.nombre, direccion: sedes.direccion, telefono: sedes.telefono })
      .from(sedes)
      .where(eq(sedes.municipioId, alumno.municipioId))
      .limit(1);
    if (sedeRow) sedeAlumno = sedeRow;
  }
  if (!sedeAlumno) {
    const [sedeRow] = await db
      .select({ nombre: sedes.nombre, direccion: sedes.direccion, telefono: sedes.telefono })
      .from(sedes)
      .limit(1);
    if (sedeRow) sedeAlumno = sedeRow;
  }

  // 8. Most recent derecho_examen pago for this student
  const [pagoDerechos] = await db
    .select({
      id: pagos.id,
      estado: pagos.estado,
      monto: pagos.monto,
      fechaPago: pagos.fechaPago,
      createdAt: pagos.createdAt,
    })
    .from(pagos)
    .where(and(eq(pagos.estudianteId, alumnoId), eq(pagos.concepto, 'derecho_examen')))
    .orderBy(desc(pagos.createdAt))
    .limit(1);

  res.json({
    etapa,
    modulosDisponibles,
    inscripcionesActivas: inscripcionesActivasEnriquecidas,
    sede: sedeAlumno,
    costoExamen,
    pagoDerechos: pagoDerechos ?? null,
  });
});

// ─── GET /gestor/config-pago ─────────────────────────────────────────────────
// Devuelve el costo del examen y los datos bancarios para las fichas de pago.
router.get('/config-pago', async (_req, res) => {
  const config = await getConfigPago();
  res.json({
    costoExamen: config.costoExamen,
    datosBancarios: config.banco ? {
      banco: config.banco.banco,
      titular: config.banco.titular,
      clabe: config.banco.clabe,
      numeroCuenta: config.banco.numeroCuenta ?? null,
      rfc: config.banco.rfc ?? null,
      convenio: config.banco.convenio ?? null,
    } : null,
  });
});

// ─── POST /gestor/alumnos/:id/inscribir-examen ───────────────────────────────
// Body: { etapaId: number, modulosIds: number[] }
const inscribirExamenSchema = z.object({
  etapaId: z.number().int().positive(),
  modulosIds: z.array(z.number().int().positive()).min(1),
});

router.post('/alumnos/:id/inscribir-examen', async (req, res) => {
  const gestorId = req.user!.userId;
  const alumnoId = Number(req.params.id);
  if (!alumnoId) { res.status(400).json({ error: 'ID inválido' }); return; }

  const parse = inscribirExamenSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Datos inválidos', detalle: parse.error.errors });
    return;
  }
  const { etapaId, modulosIds } = parse.data;

  // 1. Verify student belongs to gestor
  const alumno = await verificarAlumnoDelGestor(gestorId, alumnoId);
  if (!alumno) { res.status(404).json({ error: 'Alumno no encontrado' }); return; }

  // 2. Validate etapa exists (don't require inscripcion_abierta)
  const [etapa] = await db
    .select({
      id: convocatoriasEtapas.id,
      clave: convocatoriasEtapas.clave,
      estado: convocatoriasEtapas.estado,
      examenSabado: convocatoriasEtapas.examenSabado,
      examenDomingo: convocatoriasEtapas.examenDomingo,
    })
    .from(convocatoriasEtapas)
    .where(eq(convocatoriasEtapas.id, etapaId));
  if (!etapa) { res.status(404).json({ error: 'Etapa no encontrada' }); return; }

  const periodoAbierto = etapa.estado === 'inscripcion_abierta';

  // 3. Get horarios for requested modules in this etapa
  const horariosRows = await db
    .select({
      id: convocatoriasModulosHorarios.id,
      moduloId: convocatoriasModulosHorarios.moduloId,
      dia: convocatoriasModulosHorarios.dia,
      hora: convocatoriasModulosHorarios.hora,
    })
    .from(convocatoriasModulosHorarios)
    .where(
      and(
        eq(convocatoriasModulosHorarios.etapaId, etapaId),
        inArray(convocatoriasModulosHorarios.moduloId, modulosIds)
      )
    );
  const horarioByModuloId = new Map(horariosRows.map((h) => [h.moduloId, h]));

  // 4. Existing active inscriptions for student + etapa
  const existingInsc = await db
    .select({
      moduloId: examenesInscripciones.moduloId,
      horarioId: examenesInscripciones.horarioId,
      dia: convocatoriasModulosHorarios.dia,
      hora: convocatoriasModulosHorarios.hora,
    })
    .from(examenesInscripciones)
    .innerJoin(
      convocatoriasModulosHorarios,
      eq(convocatoriasModulosHorarios.id, examenesInscripciones.horarioId)
    )
    .where(
      and(
        eq(examenesInscripciones.estudianteId, alumnoId),
        eq(examenesInscripciones.etapaId, etapaId),
        ne(examenesInscripciones.estado, 'cancelado')
      )
    );
  const inscritosModuloIds = new Set(existingInsc.map((i) => i.moduloId));
  // Existing horario slots: "dia-hora" for conflict check
  const existingSlots = new Set(existingInsc.map((i) => `${i.dia}-${i.hora}`));

  // 5. Get student's sede
  let sedeId: number | null = null;
  if (alumno.municipioId) {
    const [sedeRow] = await db
      .select({ id: sedes.id })
      .from(sedes)
      .where(eq(sedes.municipioId, alumno.municipioId))
      .limit(1);
    if (sedeRow) sedeId = sedeRow.id;
  }
  if (!sedeId) {
    const [sedeRow] = await db
      .select({ id: sedes.id })
      .from(sedes)
      .limit(1);
    if (sedeRow) sedeId = sedeRow.id;
  }
  if (!sedeId) { res.status(500).json({ error: 'No hay sedes configuradas en el sistema' }); return; }

  // 6. Get module names for response
  const modulosRows = await db
    .select({ id: modulos.id, numero: modulos.numero, nombre: modulos.nombre })
    .from(modulos)
    .where(inArray(modulos.id, modulosIds));
  const modulosById = new Map(modulosRows.map((m) => [m.id, m]));

  // 7. Process each requested module
  const sinHorario: number[] = [];
  const conflicto: number[] = [];
  const yaInscritos: number[] = [];
  const aInscribir: Array<{
    moduloId: number;
    horarioId: number;
    dia: string;
    hora: string;
    fechaExamen: string;
    folio: string;
  }> = [];

  for (const moduloId of modulosIds) {
    const horario = horarioByModuloId.get(moduloId);
    if (!horario) {
      sinHorario.push(moduloId);
      continue;
    }
    if (inscritosModuloIds.has(moduloId)) {
      yaInscritos.push(moduloId);
      continue;
    }
    const slot = `${horario.dia}-${horario.hora}`;
    if (existingSlots.has(slot)) {
      conflicto.push(moduloId);
      continue;
    }
    const folio = `${etapa.clave}-${Math.floor(1000 + Math.random() * 8999)}`;
    const fechaExamen = horario.dia === 'sabado' ? etapa.examenSabado : etapa.examenDomingo;
    aInscribir.push({ moduloId, horarioId: horario.id, dia: horario.dia, hora: horario.hora, fechaExamen, folio });
    // Track the new slot so subsequent modules in this request don't conflict
    existingSlots.add(slot);
    inscritosModuloIds.add(moduloId);
  }

  // 8. Insert
  const inscritos: Array<{
    folio: string;
    moduloId: number;
    moduloNombre: string | null;
    dia: string;
    hora: string;
    fechaExamen: string;
  }> = [];

  for (const item of aInscribir) {
    await db.insert(examenesInscripciones).values({
      estudianteId: alumnoId,
      etapaId: etapa.id,
      moduloId: item.moduloId,
      horarioId: item.horarioId,
      sedeId,
      folio: item.folio,
      estado: 'inscrito',
    });
    const mod = modulosById.get(item.moduloId);
    inscritos.push({
      folio: item.folio,
      moduloId: item.moduloId,
      moduloNombre: mod?.nombre ?? null,
      dia: item.dia,
      hora: item.hora,
      fechaExamen: item.fechaExamen,
    });
  }

  // 9. Audit log
  if (inscritos.length > 0) {
    await tryAuditLog({
      userId: gestorId,
      accion: 'inscribir_examenes',
      entidad: 'examenes_inscripciones',
      entidadId: alumnoId,
      detalle: `Gestor inscribió al alumno ${alumnoId} en ${inscritos.length} examen(es) — etapa ${etapa.clave}`,
      metadata: { etapaId: etapa.id, inscritos: inscritos.map((i) => i.folio) },
      req,
    });
  }

  res.json({
    ok: true,
    inscritos,
    sinHorario,
    conflicto,
    yaInscritos,
    periodoAbierto,
    ...(periodoAbierto ? {} : { advertencia: 'El período de inscripción no está abierto, pero el gestor puede inscribir manualmente.' }),
  });
});

// ─── GET /gestor/alumnos/:id/ficha-pago ──────────────────────────────────────
// Genera y devuelve una ficha PDF de pago de derecho de examen.
// Query param: metodo = 'spei' | 'banco_deposito' | 'tienda_conveniencia'
router.get('/alumnos/:id/ficha-pago', async (req, res) => {
  const gestorId = req.user!.userId;
  const alumnoId = Number(req.params.id);
  if (!alumnoId) { res.status(400).json({ error: 'ID inválido' }); return; }

  const metodoRaw = (req.query.metodo as string) || 'spei';
  const METODOS_VALIDOS: MetodoPagoFicha[] = ['spei', 'banco_deposito', 'tienda_conveniencia'];
  if (!METODOS_VALIDOS.includes(metodoRaw as MetodoPagoFicha)) {
    res.status(400).json({ error: 'Método inválido. Usa: spei, banco_deposito o tienda_conveniencia' });
    return;
  }
  const metodo = metodoRaw as MetodoPagoFicha;

  const alumno = await verificarAlumnoDelGestor(gestorId, alumnoId);
  if (!alumno) { res.status(404).json({ error: 'Alumno no encontrado' }); return; }

  // Get active etapa
  const hoy = new Date().toISOString().slice(0, 10);
  const [etapa] = await db
    .select({
      id: convocatoriasEtapas.id,
      clave: convocatoriasEtapas.clave,
      etapa: convocatoriasEtapas.etapa,
      fase: convocatoriasEtapas.fase,
    })
    .from(convocatoriasEtapas)
    .where(
      sql`(${convocatoriasEtapas.estado} = 'inscripcion_abierta'
        OR (${convocatoriasEtapas.solicitudInicio} <= ${hoy}
            AND ${convocatoriasEtapas.solicitudFin} >= ${hoy}))`
    )
    .orderBy(desc(convocatoriasEtapas.id))
    .limit(1);

  const etapaNombre = etapa
    ? `${etapa.etapa} — Fase ${etapa.fase}`
    : 'Convocatoria vigente';
  const etapaClave = etapa?.clave ?? '—';

  // Payment config from DB
  const config = await getConfigPago();

  // Reference = CURP (or alumno ID as fallback)
  const referencia = alumno.curp ?? `ID-${alumnoId}`;

  const pdf = await generarFichaPago({
    nombreCompleto: alumno.nombreCompleto,
    curp: alumno.curp ?? null,
    etapaClave,
    etapaNombre,
    metodo,
    monto: config.costoExamen,
    referencia,
    banco: config.banco?.banco ?? 'Banco no configurado',
    titular: config.banco?.titular ?? 'IEMSyS — Prepa Abierta Michoacán',
    clabe: config.banco?.clabe ?? '000000000000000000',
    numeroCuenta: config.banco?.numeroCuenta ?? null,
    convenio: config.banco?.convenio ?? null,
    generadoEn: new Date(),
  });

  const safeNombre = alumno.nombreCompleto.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 30);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="ficha-pago-${safeNombre}-${metodo}.pdf"`);
  res.send(pdf);
});

export default router;
