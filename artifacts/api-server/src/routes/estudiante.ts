/**
 * Rutas del perfil de estudiante.
 *
 * GET  /estudiante/dashboard
 * GET  /estudiante/avisos
 * POST /estudiante/avisos/:id/marcar-leido
 * GET  /estudiante/contactos
 * POST /estudiante/cambiar-password
 */

import { Router } from 'express';
import { and, eq, isNull, or, gt, sql, desc, inArray, ne } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { z } from 'zod';
import path from 'path';
import { createReadStream, existsSync } from 'fs';
import fsp from 'node:fs/promises';
import multer from 'multer';
import { db } from '../db';
import {
  users,
  estudiantes,
  gestores,
  administradores,
  inscripciones,
  documentos,
  convocatorias,
  municipios,
  avisos,
  avisosLeidos,
  auditLog,
  modulos,
  modulosUnidades,
  modulosTemas,
  modulosMateriales,
  estudiantesModulosProgreso,
  expedienteDocumentos,
  sedes,
  convocatoriasEtapas,
  convocatoriasModulosHorarios,
  examenesInscripciones,
} from '@workspace/db/schema';
import { authRequired, requireRol } from '../middleware/auth';
import { generarFichaPreregistro, generarFichaRegistro } from '../services/pdf';
import { tryAuditLog } from '../utils/audit';

const QR_SECRET = process.env.QR_SECRET || 'prepa-qr-secret-dev';

// ── Multer para expediente ────────────────────────────────────────────────
const EXPEDIENTE_DIR = process.env.STORAGE_DIR
  ? path.join(process.env.STORAGE_DIR, 'expediente')
  : '/tmp/prepa-storage/expediente';

const uploadExpediente = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      await fsp.mkdir(EXPEDIENTE_DIR, { recursive: true });
      cb(null, EXPEDIENTE_DIR);
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

// ── Utilidad: PDF stub sin dependencias externas ──────────────────────────
function generarPdfStub(titulo: string): Buffer {
  const safe = titulo.replace(/[()\\]/g, (c) => `\\${c}`);
  const stream =
    `BT /F1 14 Tf 72 720 Td (${safe}) Tj ` +
    `0 -30 Td /F1 10 Tf (Material en preparacion - estara disponible proximamente.) Tj ` +
    `0 -20 Td (IEMSyS - Prepa Abierta Michoacan) Tj ET`;

  const parts: string[] = [];
  const offsets: number[] = [0];
  let pos = 0;

  const header = '%PDF-1.4\n';
  parts.push(header);
  pos += header.length;

  const objs = [
    '',
    '1 0 obj\n<</Type /Catalog /Pages 2 0 R>>\nendobj\n',
    '2 0 obj\n<</Type /Pages /Kids [3 0 R] /Count 1>>\nendobj\n',
    `3 0 obj\n<</Type /Page /MediaBox [0 0 612 792] /Parent 2 0 R /Resources <</Font <</F1 4 0 R>>>> /Contents 5 0 R>>\nendobj\n`,
    '4 0 obj\n<</Type /Font /Subtype /Type1 /BaseFont /Helvetica>>\nendobj\n',
    `5 0 obj\n<</Length ${stream.length}>>\nstream\n${stream}\nendstream\nendobj\n`,
  ];

  for (let i = 1; i <= 5; i++) {
    offsets[i] = pos;
    parts.push(objs[i]);
    pos += objs[i].length;
  }

  const xrefPos = pos;
  let xref = 'xref\n0 6\n0000000000 65535 f \r\n';
  for (let i = 1; i <= 5; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \r\n`;
  }
  xref += `trailer\n<</Size 6 /Root 1 0 R>>\nstartxref\n${xrefPos}\n%%EOF\n`;
  parts.push(xref);

  return Buffer.from(parts.join(''), 'ascii');
}

const router = Router();

router.use(authRequired, requireRol('estudiante'));

// ─── GET /estudiante/dashboard ───────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  const userId = req.user!.userId;

  const [est] = await db
    .select({
      nombreCompleto: estudiantes.nombreCompleto,
      curp: estudiantes.curp,
      municipioId: estudiantes.municipioId,
      gestorId: estudiantes.gestorId,
      folioPreregistro: estudiantes.folioPreregistro,
      preregistroVigenteHasta: estudiantes.preregistroVigenteHasta,
      matriculaOficialDGB: estudiantes.matriculaOficialDGB,
    })
    .from(estudiantes)
    .where(eq(estudiantes.userId, userId));

  if (!est) {
    res.status(404).json({ error: 'Estudiante no encontrado' });
    return;
  }

  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId));

  const [municipio] = est.municipioId
    ? await db
        .select({ nombre: municipios.nombre })
        .from(municipios)
        .where(eq(municipios.id, est.municipioId))
    : [null];

  // Inscripción activa más reciente
  const [insc] = await db
    .select({
      id: inscripciones.id,
      estado: inscripciones.estado,
      convocatoriaId: inscripciones.convocatoriaId,
      convocatoriaNombre: convocatorias.nombre,
      fechaCierre: convocatorias.fechaCierre,
      fechaExamen: convocatorias.fechaExamen,
    })
    .from(inscripciones)
    .leftJoin(convocatorias, eq(inscripciones.convocatoriaId, convocatorias.id))
    .where(eq(inscripciones.estudianteId, userId))
    .orderBy(desc(inscripciones.createdAt))
    .limit(1);

  // Documentos de la inscripción activa
  let documentosAprobados = 0;
  let documentosPendientes = 0;
  let tieneRechazados = false;

  if (insc) {
    const docs = await db
      .select({ estado: documentos.estado })
      .from(documentos)
      .where(eq(documentos.inscripcionId, insc.id));

    documentosAprobados = docs.filter((d) => d.estado === 'aprobado').length;
    documentosPendientes = docs.filter((d) => d.estado === 'pendiente_revision').length;
    tieneRechazados = docs.some((d) => d.estado === 'rechazado');
  }

  // Avisos no leídos
  const [{ avisosNoLeidos }] = await db
    .select({ avisosNoLeidos: sql<number>`count(*)` })
    .from(avisos)
    .where(
      and(
        or(isNull(avisos.activoHasta), gt(avisos.activoHasta, new Date())),
        sql`NOT EXISTS (
          SELECT 1 FROM avisos_leidos al
          WHERE al.aviso_id = ${avisos.id}
          AND al.estudiante_id = ${userId}
        )`
      )
    );

  // Siguientes pasos dinámicos
  const siguientesPasos: Array<{ texto: string; urgencia: 'baja' | 'media' | 'alta' }> = [];

  if (!insc) {
    siguientesPasos.push({
      texto: 'No tienes una inscripción activa. Contacta a tu gestor municipal.',
      urgencia: 'alta',
    });
  } else if (tieneRechazados) {
    siguientesPasos.push({
      texto: 'Tienes documentos rechazados. Contacta a tu gestor para corregirlos.',
      urgencia: 'alta',
    });
  } else if (documentosPendientes > 0) {
    siguientesPasos.push({
      texto: 'Tu administración está revisando tus documentos. Espera la validación.',
      urgencia: 'baja',
    });
  } else if (insc.estado === 'pago_pendiente') {
    siguientesPasos.push({
      texto: 'Sube tu comprobante de pago para continuar con tu inscripción.',
      urgencia: 'media',
    });
  } else if (
    insc.estado === 'confirmado_alumno' ||
    insc.estado === 'registrado' ||
    insc.estado === 'en_curso'
  ) {
    siguientesPasos.push({
      texto: 'Tu inscripción está completa. Prepárate para el examen.',
      urgencia: 'baja',
    });
  } else {
    siguientesPasos.push({
      texto: 'Revisa tu expediente y asegúrate de tener todos los documentos en orden.',
      urgencia: 'baja',
    });
  }

  res.json({
    estudiante: {
      nombreCompleto: est.nombreCompleto,
      curp: est.curp,
      email: user?.email ?? '',
      municipio: municipio?.nombre ?? '',
    },
    folioPreregistro: est.folioPreregistro ?? null,
    preregistroVigenteHasta: est.preregistroVigenteHasta ?? null,
    matriculaOficialDGB: est.matriculaOficialDGB ?? null,
    inscripcionActiva: insc
      ? {
          id: insc.id,
          estado: insc.estado,
          convocatoriaNombre: insc.convocatoriaNombre ?? '',
          fechaCierre: insc.fechaCierre,
          fechaExamen: insc.fechaExamen,
        }
      : null,
    kpis: {
      modulosAprobados: 0,
      modulosTotales: 21,
      documentosAprobados,
      documentosPendientes,
    },
    siguientesPasos,
    avisosNoLeidos: Number(avisosNoLeidos),
  });
});

// ─── GET /estudiante/avisos ──────────────────────────────────────────────
router.get('/avisos', async (req, res) => {
  const userId = req.user!.userId;

  const rows = await db
    .select({
      id: avisos.id,
      titulo: avisos.titulo,
      contenido: avisos.contenido,
      prioridad: avisos.prioridad,
      publicadoEn: avisos.publicadoEn,
      activoHasta: avisos.activoHasta,
      leidoEn: avisosLeidos.leidoEn,
    })
    .from(avisos)
    .leftJoin(
      avisosLeidos,
      and(eq(avisosLeidos.avisoId, avisos.id), eq(avisosLeidos.estudianteId, userId))
    )
    .where(or(isNull(avisos.activoHasta), gt(avisos.activoHasta, new Date())))
    .orderBy(desc(avisos.prioridad), desc(avisos.publicadoEn))
    .limit(50);

  res.json(
    rows.map((r) => ({
      ...r,
      leido: r.leidoEn !== null,
    }))
  );
});

// ─── POST /estudiante/avisos/:id/marcar-leido ────────────────────────────
router.post('/avisos/:id/marcar-leido', async (req, res) => {
  const userId = req.user!.userId;
  const avisoId = Number(req.params.id);

  if (!avisoId) {
    res.status(400).json({ error: 'ID inválido' });
    return;
  }

  await db
    .insert(avisosLeidos)
    .values({ avisoId, estudianteId: userId })
    .onConflictDoNothing();

  res.json({ ok: true });
});

// ─── GET /estudiante/contactos ───────────────────────────────────────────
router.get('/contactos', async (req, res) => {
  const userId = req.user!.userId;

  const [est] = await db
    .select({ gestorId: estudiantes.gestorId })
    .from(estudiantes)
    .where(eq(estudiantes.userId, userId));

  let gestor: Record<string, unknown> | null = null;
  if (est?.gestorId) {
    const [g] = await db
      .select({
        nombreCompleto: gestores.nombreCompleto,
        emailPublico: gestores.emailPublico,
        telefonoPublico: gestores.telefonoPublico,
        municipio: municipios.nombre,
      })
      .from(gestores)
      .leftJoin(municipios, eq(gestores.municipioId, municipios.id))
      .where(eq(gestores.userId, est.gestorId));
    gestor = g ?? null;
  }

  const [admin] = await db
    .select({
      nombreCompleto: administradores.nombreCompleto,
      puesto: administradores.puesto,
      emailPublico: administradores.emailPublico,
      telefonoPublico: administradores.telefonoPublico,
    })
    .from(administradores)
    .limit(1);

  res.json({ gestor, admin: admin ?? null });
});

// ─── POST /estudiante/cambiar-password ───────────────────────────────────
const cambiarPasswordSchema = z.object({
  passwordActual: z.string().min(1),
  passwordNueva: z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres'),
  confirmacion: z.string().min(1),
});

router.post('/cambiar-password', async (req, res) => {
  const userId = req.user!.userId;

  const parse = cambiarPasswordSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }
  const { passwordActual, passwordNueva, confirmacion } = parse.data;

  if (passwordNueva !== confirmacion) {
    res.status(400).json({ error: 'La nueva contraseña y la confirmación no coinciden' });
    return;
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) {
    res.status(404).json({ error: 'Usuario no encontrado' });
    return;
  }

  const ok = await bcrypt.compare(passwordActual, user.passwordHash);
  if (!ok) {
    res.status(400).json({ error: 'La contraseña actual es incorrecta' });
    return;
  }

  const newHash = await bcrypt.hash(passwordNueva, 10);
  await db
    .update(users)
    .set({ passwordHash: newHash, passwordTemporal: false, updatedAt: new Date() })
    .where(eq(users.id, userId));

  await tryAuditLog({
    userId,
    accion: 'cambiar_password',
    entidad: 'users',
    entidadId: userId,
    detalle: 'Cambió su contraseña',
    metadata: { passwordTemporal: false },
    req,
  });

  res.json({ ok: true });
});

// ─── GET /estudiante/modulos ──────────────────────────────────────────────
router.get('/modulos', async (req, res) => {
  const userId = req.user!.userId;

  const rows = await db
    .select({
      id: modulos.id,
      numero: modulos.numero,
      nivel: modulos.nivel,
      nombre: modulos.nombre,
      descripcion: modulos.descripcion,
      estado: estudiantesModulosProgreso.estado,
      intentosQuiz: estudiantesModulosProgreso.intentosQuiz,
      mejorCalificacion: estudiantesModulosProgreso.mejorCalificacion,
      ultimaCalificacion: estudiantesModulosProgreso.ultimaCalificacion,
    })
    .from(modulos)
    .leftJoin(
      estudiantesModulosProgreso,
      and(
        eq(estudiantesModulosProgreso.moduloId, modulos.id),
        eq(estudiantesModulosProgreso.estudianteId, userId)
      )
    )
    .orderBy(modulos.numero);

  const aprobados = rows.filter((r) => r.estado === 'aprobado').length;
  const enCurso = rows.filter((r) => r.estado === 'en_curso').length;
  const totalQuizzes = rows.reduce((s, r) => s + (r.intentosQuiz ?? 0), 0);
  const conCal = rows.filter((r) => r.mejorCalificacion !== null);
  const promedioGlobal =
    conCal.length > 0
      ? Math.round(conCal.reduce((s, r) => s + (r.mejorCalificacion ?? 0), 0) / conCal.length)
      : 0;

  res.json({
    modulos: rows.map((r) => ({
      id: r.id,
      numero: r.numero,
      nivel: r.nivel,
      nombre: r.nombre,
      descripcionCorta: r.descripcion ?? null,
      progreso: {
        estado: r.estado ?? 'no_iniciado',
        intentosQuiz: r.intentosQuiz ?? 0,
        mejorCalificacion: r.mejorCalificacion ?? null,
        ultimaCalificacion: r.ultimaCalificacion ?? null,
      },
    })),
    resumen: {
      totalModulos: rows.length,
      aprobados,
      enCurso,
      totalQuizzes,
      promedioGlobal,
    },
  });
});

// ─── GET /estudiante/modulos/:moduloId ────────────────────────────────────
router.get('/modulos/:moduloId', async (req, res) => {
  const userId = req.user!.userId;
  const moduloId = Number(req.params.moduloId);

  if (!moduloId) {
    res.status(400).json({ error: 'ID inválido' });
    return;
  }

  const [mod] = await db.select().from(modulos).where(eq(modulos.id, moduloId));
  if (!mod) {
    res.status(404).json({ error: 'Módulo no encontrado' });
    return;
  }

  const unidades = await db
    .select()
    .from(modulosUnidades)
    .where(eq(modulosUnidades.moduloId, moduloId))
    .orderBy(modulosUnidades.numero);

  let rawTemas: Array<{
    id: number;
    unidadId: number;
    parentId: number | null;
    orden: number;
    titulo: string;
  }> = [];

  if (unidades.length > 0) {
    rawTemas = await db
      .select({
        id: modulosTemas.id,
        unidadId: modulosTemas.unidadId,
        parentId: modulosTemas.parentId,
        orden: modulosTemas.orden,
        titulo: modulosTemas.titulo,
      })
      .from(modulosTemas)
      .where(inArray(modulosTemas.unidadId, unidades.map((u) => u.id)))
      .orderBy(modulosTemas.orden);
  }

  type TemaNode = {
    id: number;
    titulo: string;
    parentId: number | null;
    orden: number;
    subtemas: TemaNode[];
  };

  function buildTree(unidadId: number, parentId: number | null): TemaNode[] {
    return rawTemas
      .filter((t) => t.unidadId === unidadId && t.parentId === parentId)
      .sort((a, b) => a.orden - b.orden)
      .map((t) => ({
        id: t.id,
        titulo: t.titulo,
        parentId: t.parentId,
        orden: t.orden,
        subtemas: buildTree(unidadId, t.id),
      }));
  }

  const materiales = await db
    .select()
    .from(modulosMateriales)
    .where(eq(modulosMateriales.moduloId, moduloId));

  const [progreso] = await db
    .select()
    .from(estudiantesModulosProgreso)
    .where(
      and(
        eq(estudiantesModulosProgreso.estudianteId, userId),
        eq(estudiantesModulosProgreso.moduloId, moduloId)
      )
    );

  res.json({
    modulo: {
      id: mod.id,
      numero: mod.numero,
      nivel: mod.nivel,
      nombre: mod.nombre,
      descripcionCorta: mod.descripcion ?? null,
      totalPreguntas: null,
      tiempoEstimadoMin: null,
    },
    unidades: unidades.map((u) => ({
      id: u.id,
      numero: u.numero,
      titulo: u.titulo,
      proposito: u.proposito,
      temas: buildTree(u.id, null),
    })),
    materiales: materiales.map((m) => ({
      id: m.id,
      tipo: m.tipo,
      nombre: m.nombre,
      tamanoBytes: m.tamanoBytes,
      urlDescarga: `/api/estudiante/modulos/${moduloId}/material/${m.id}/descargar`,
    })),
    progreso: {
      estado: progreso?.estado ?? 'no_iniciado',
      intentosQuiz: progreso?.intentosQuiz ?? 0,
      mejorCalificacion: progreso?.mejorCalificacion ?? null,
      ultimaCalificacion: progreso?.ultimaCalificacion ?? null,
    },
    intentosRecientes: [],
    areasOportunidad: [],
  });
});

// ─── GET /estudiante/modulos/:moduloId/material/:materialId/descargar ─────
router.get('/modulos/:moduloId/material/:materialId/descargar', async (req, res) => {
  const moduloId = Number(req.params.moduloId);
  const materialId = Number(req.params.materialId);

  if (!moduloId || !materialId) {
    res.status(400).json({ error: 'ID inválido' });
    return;
  }

  const [material] = await db
    .select()
    .from(modulosMateriales)
    .where(
      and(eq(modulosMateriales.id, materialId), eq(modulosMateriales.moduloId, moduloId))
    );

  if (!material) {
    res.status(404).json({ error: 'Material no encontrado' });
    return;
  }

  const STORAGE_DIR = path.join(process.cwd(), 'storage');
  const filePath = path.join(STORAGE_DIR, material.rutaArchivo.replace(/^\//, ''));

  const safeName = material.nombre.replace(/[^a-zA-Z0-9_\- ]/g, '').trim() || 'material';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`);

  if (existsSync(filePath)) {
    createReadStream(filePath).pipe(res);
    return;
  }

  const stub = generarPdfStub(material.nombre);
  res.setHeader('Content-Length', stub.length);
  res.send(stub);
});

// ─── Tipos de documento válidos ───────────────────────────────────────────
const TIPOS_VALIDOS = [
  'curp',
  'acta_nacimiento',
  'ine',
  'comprobante_domicilio',
  'foto',
  'certificado_secundaria',
  'comprobante_pago',
] as const;

type TipoDoc = (typeof TIPOS_VALIDOS)[number];

function esTipoValido(t: string): t is TipoDoc {
  return (TIPOS_VALIDOS as readonly string[]).includes(t);
}

// ─── GET /estudiante/expediente ───────────────────────────────────────────
router.get('/expediente', async (req, res) => {
  const userId = req.user!.userId;

  const [est] = await db
    .select({
      nombreCompleto: estudiantes.nombreCompleto,
      curp: estudiantes.curp,
      fechaNacimiento: estudiantes.fechaNacimiento,
      telefono: estudiantes.telefono,
      direccion: estudiantes.direccion,
      municipioId: estudiantes.municipioId,
    })
    .from(estudiantes)
    .where(eq(estudiantes.userId, userId));

  if (!est) {
    res.status(404).json({ error: 'Estudiante no encontrado' });
    return;
  }

  const [municipio] = est.municipioId
    ? await db
        .select({ nombre: municipios.nombre })
        .from(municipios)
        .where(eq(municipios.id, est.municipioId))
    : [null];

  const docs = await db
    .select()
    .from(expedienteDocumentos)
    .where(eq(expedienteDocumentos.estudianteId, userId));

  const docsPorTipo: Record<string, {
    estado: string;
    motivoRechazo: string | null;
    nombreOriginal: string;
    tamanoBytes: number | null;
    subidoEn: Date;
  }> = {};

  for (const d of docs) {
    docsPorTipo[d.tipo] = {
      estado: d.estado,
      motivoRechazo: d.motivoRechazo ?? null,
      nombreOriginal: d.nombreOriginal,
      tamanoBytes: d.tamanoBytes ?? null,
      subidoEn: d.subidoEn,
    };
  }

  res.json({
    datosPersonales: {
      nombreCompleto: est.nombreCompleto,
      curp: est.curp ?? '',
      fechaNacimiento: est.fechaNacimiento ?? null,
      telefono: est.telefono ?? '',
      direccion: est.direccion ?? '',
      municipio: municipio?.nombre ?? '',
    },
    documentos: docsPorTipo,
  });
});

// ─── PATCH /estudiante/datos-personales ───────────────────────────────────
const datosPersonalesSchema = z.object({
  nombreCompleto: z.string().min(3).max(200).optional(),
  curp: z
    .string()
    .regex(/^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z\d]\d$/, 'CURP inválida')
    .optional()
    .or(z.literal('')),
  fechaNacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  telefono: z.string().max(30).optional(),
  direccion: z.string().max(500).optional(),
});

router.patch('/datos-personales', async (req, res) => {
  const userId = req.user!.userId;

  const parse = datosPersonalesSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }

  const data = parse.data;
  const set: Partial<typeof estudiantes.$inferInsert> = { updatedAt: new Date() };
  if (data.nombreCompleto !== undefined) set.nombreCompleto = data.nombreCompleto;
  if (data.curp !== undefined) set.curp = data.curp || null;
  if (data.fechaNacimiento !== undefined) set.fechaNacimiento = data.fechaNacimiento ?? null;
  if (data.telefono !== undefined) set.telefono = data.telefono;
  if (data.direccion !== undefined) set.direccion = data.direccion;

  await db.update(estudiantes).set(set).where(eq(estudiantes.userId, userId));

  res.json({ ok: true });
});

// ─── POST /estudiante/expediente/documento/:tipo ──────────────────────────
router.post(
  '/expediente/documento/:tipo',
  uploadExpediente.single('archivo'),
  async (req, res) => {
    const userId = req.user!.userId;
    const tipo = req.params.tipo as string;

    if (!esTipoValido(tipo)) {
      res.status(400).json({ error: 'Tipo de documento inválido' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No se recibió archivo' });
      return;
    }

    const rutaRelativa = path.relative(EXPEDIENTE_DIR, req.file.path);

    await db
      .insert(expedienteDocumentos)
      .values({
        estudianteId: userId,
        tipo,
        estado: 'pendiente_revision',
        rutaArchivo: req.file.path,
        nombreOriginal: req.file.originalname,
        tamanoBytes: req.file.size,
        subidoPorUserId: userId,
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
          subidoPorUserId: userId,
          subidoEn: new Date(),
          motivoRechazo: null,
          updatedAt: new Date(),
        },
      });

    res.json({ ok: true, tipo, nombreOriginal: req.file.originalname });
  }
);

// ─── Función compartida para servir documento de expediente ───────────────
async function servirDocExpediente(
  userId: number,
  tipo: string,
  disposition: 'inline' | 'attachment',
  res: import('express').Response
) {
  if (!esTipoValido(tipo)) {
    res.status(400).json({ error: 'Tipo de documento inválido' });
    return;
  }

  const [doc] = await db
    .select()
    .from(expedienteDocumentos)
    .where(
      and(
        eq(expedienteDocumentos.estudianteId, userId),
        eq(expedienteDocumentos.tipo, tipo)
      )
    );

  if (!doc) {
    res.status(404).json({ error: 'Documento no encontrado' });
    return;
  }

  if (!existsSync(doc.rutaArchivo)) {
    res.status(404).json({ error: 'Archivo no disponible en almacenamiento' });
    return;
  }

  const safe = doc.nombreOriginal.replace(/[^a-zA-Z0-9_\-. ]/g, '').trim() || 'documento';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${disposition}; filename="${safe}"`);
  createReadStream(doc.rutaArchivo).pipe(res);
}

// ─── GET /estudiante/expediente/documento/:tipo/preview ──────────────────
router.get('/expediente/documento/:tipo/preview', async (req, res) => {
  await servirDocExpediente(req.user!.userId, req.params.tipo, 'inline', res);
});

// ─── GET /estudiante/expediente/documento/:tipo/descargar ─────────────────
router.get('/expediente/documento/:tipo/descargar', async (req, res) => {
  await servirDocExpediente(req.user!.userId, req.params.tipo, 'attachment', res);
});

// ─────────────────────────────────────────────────────────────────────────
// Helpers convocatoria
// ─────────────────────────────────────────────────────────────────────────

async function expedienteCompleto(
  estudianteId: number
): Promise<{ completo: boolean; faltantes: string[] }> {
  const OBLIGATORIOS = ['curp', 'acta_nacimiento', 'ine', 'comprobante_domicilio'];
  const docs = await db
    .select()
    .from(expedienteDocumentos)
    .where(
      and(
        eq(expedienteDocumentos.estudianteId, estudianteId),
        eq(expedienteDocumentos.estado, 'aprobado')
      )
    );
  const aprobados = docs.map((d) => d.tipo);
  const faltantes = OBLIGATORIOS.filter((t) => !aprobados.includes(t));
  return { completo: faltantes.length === 0, faltantes };
}

function firmarQrPayload(data: Record<string, unknown>): string {
  const json = JSON.stringify(data);
  const sig = crypto.createHmac('sha256', QR_SECRET).update(json).digest('hex').slice(0, 16);
  return JSON.stringify({ ...data, sig });
}

// ─── GET /estudiante/convocatoria ─────────────────────────────────────────
router.get('/convocatoria', async (req, res) => {
  const userId = req.user!.userId;

  const [est] = await db
    .select({
      nombreCompleto: estudiantes.nombreCompleto,
      curp: estudiantes.curp,
      municipioId: estudiantes.municipioId,
    })
    .from(estudiantes)
    .where(eq(estudiantes.userId, userId));

  if (!est) {
    res.status(404).json({ error: 'Estudiante no encontrado' });
    return;
  }

  // Etapa activa
  const [etapaActiva] = await db
    .select()
    .from(convocatoriasEtapas)
    .where(eq(convocatoriasEtapas.estado, 'inscripcion_abierta'))
    .limit(1);

  // Mis exámenes (all non-cancelled)
  const misExamenesRaw = await db
    .select({
      id: examenesInscripciones.id,
      folio: examenesInscripciones.folio,
      estado: examenesInscripciones.estado,
      calificacion: examenesInscripciones.calificacion,
      paseValidadoEn: examenesInscripciones.paseValidadoEn,
      etapaClave: convocatoriasEtapas.clave,
      etapaExamenSabado: convocatoriasEtapas.examenSabado,
      etapaExamenDomingo: convocatoriasEtapas.examenDomingo,
      moduloId: modulos.id,
      moduloNumero: modulos.numero,
      moduloNombre: modulos.nombre,
      dia: convocatoriasModulosHorarios.dia,
      hora: convocatoriasModulosHorarios.hora,
      sedeNombre: sedes.nombre,
      sedeDireccion: sedes.direccion,
      sedeLatitud: sedes.latitud,
      sedeLongitud: sedes.longitud,
    })
    .from(examenesInscripciones)
    .innerJoin(convocatoriasEtapas, eq(examenesInscripciones.etapaId, convocatoriasEtapas.id))
    .innerJoin(modulos, eq(examenesInscripciones.moduloId, modulos.id))
    .innerJoin(
      convocatoriasModulosHorarios,
      eq(examenesInscripciones.horarioId, convocatoriasModulosHorarios.id)
    )
    .innerJoin(sedes, eq(examenesInscripciones.sedeId, sedes.id))
    .where(
      and(
        eq(examenesInscripciones.estudianteId, userId),
        ne(examenesInscripciones.estado, 'cancelado')
      )
    )
    .orderBy(desc(examenesInscripciones.createdAt));

  const misExamenes = misExamenesRaw.map((r) => ({
    id: r.id,
    folio: r.folio,
    estado: r.estado,
    calificacion: r.calificacion,
    paseValidadoEn: r.paseValidadoEn,
    etapa: {
      clave: r.etapaClave,
      examenSabado: r.etapaExamenSabado,
      examenDomingo: r.etapaExamenDomingo,
    },
    modulo: { id: r.moduloId, numero: r.moduloNumero, nombre: r.moduloNombre },
    fechaExamen: r.dia === 'sabado' ? r.etapaExamenSabado : r.etapaExamenDomingo,
    hora: r.hora,
    dia: r.dia,
    sede: {
      nombre: r.sedeNombre,
      direccion: r.sedeDireccion,
      latitud: r.sedeLatitud ? parseFloat(r.sedeLatitud) : null,
      longitud: r.sedeLongitud ? parseFloat(r.sedeLongitud) : null,
    },
  }));

  // Sede asignada por municipio
  let sedeAsignada: {
    nombre: string;
    direccion: string;
    telefono: string | null;
    latitud: number | null;
    longitud: number | null;
  } | null = null;

  if (est.municipioId) {
    const [sd] = await db
      .select()
      .from(sedes)
      .where(eq(sedes.municipioId, est.municipioId))
      .limit(1);
    if (sd) {
      sedeAsignada = {
        nombre: sd.nombre,
        direccion: sd.direccion,
        telefono: sd.telefono ?? null,
        latitud: sd.latitud ? parseFloat(sd.latitud) : null,
        longitud: sd.longitud ? parseFloat(sd.longitud) : null,
      };
    }
  }
  if (!sedeAsignada) {
    const [sd] = await db.select().from(sedes).limit(1);
    if (sd) {
      sedeAsignada = {
        nombre: sd.nombre,
        direccion: sd.direccion,
        telefono: sd.telefono ?? null,
        latitud: sd.latitud ? parseFloat(sd.latitud) : null,
        longitud: sd.longitud ? parseFloat(sd.longitud) : null,
      };
    }
  }

  // Próximas etapas (next 3)
  const proximasEtapas = await db
    .select()
    .from(convocatoriasEtapas)
    .where(
      or(
        eq(convocatoriasEtapas.estado, 'programada'),
        eq(convocatoriasEtapas.estado, 'inscripcion_abierta')
      )
    )
    .orderBy(convocatoriasEtapas.examenSabado)
    .limit(3);

  const { completo: expedienteCompleto_, faltantes: documentosFaltantes } =
    await expedienteCompleto(userId);

  res.json({
    etapaActiva: etapaActiva
      ? {
          id: etapaActiva.id,
          clave: etapaActiva.clave,
          etapa: etapaActiva.etapa,
          fase: etapaActiva.fase,
          solicitudInicio: etapaActiva.solicitudInicio,
          solicitudFin: etapaActiva.solicitudFin,
          examenSabado: etapaActiva.examenSabado,
          examenDomingo: etapaActiva.examenDomingo,
        }
      : null,
    misExamenes,
    sedeAsignada,
    proximasEtapas: proximasEtapas.map((e) => ({
      id: e.id,
      clave: e.clave,
      etapa: e.etapa,
      fase: e.fase,
      solicitudInicio: e.solicitudInicio,
      solicitudFin: e.solicitudFin,
      examenSabado: e.examenSabado,
      examenDomingo: e.examenDomingo,
      estado: e.estado,
    })),
    requisitos: {
      expedienteCompleto: expedienteCompleto_,
      documentosFaltantes,
      puedeInscribirse: expedienteCompleto_ && etapaActiva !== undefined,
    },
  });
});

// ─── GET /estudiante/convocatoria/calendario ──────────────────────────────
router.get('/convocatoria/calendario', async (req, res) => {
  const userId = req.user!.userId;
  const mes = (req.query.mes as string) || new Date().toISOString().slice(0, 7);

  // Get etapas where exam dates fall within the month
  const etapasEnMes = await db
    .select()
    .from(convocatoriasEtapas)
    .where(
      or(
        sql`to_char(${convocatoriasEtapas.examenSabado}, 'YYYY-MM') = ${mes}`,
        sql`to_char(${convocatoriasEtapas.examenDomingo}, 'YYYY-MM') = ${mes}`
      )
    )
    .orderBy(convocatoriasEtapas.examenSabado);

  const today = new Date();

  const etapasResult = await Promise.all(
    etapasEnMes.map(async (etapa) => {
      // Get horarios for this etapa
      const horarios = await db
        .select({
          id: convocatoriasModulosHorarios.id,
          moduloId: convocatoriasModulosHorarios.moduloId,
          dia: convocatoriasModulosHorarios.dia,
          hora: convocatoriasModulosHorarios.hora,
          moduloNumero: modulos.numero,
          moduloNombre: modulos.nombre,
        })
        .from(convocatoriasModulosHorarios)
        .innerJoin(modulos, eq(convocatoriasModulosHorarios.moduloId, modulos.id))
        .where(eq(convocatoriasModulosHorarios.etapaId, etapa.id))
        .orderBy(modulos.numero);

      // Get student's existing inscriptions for this etapa
      const yaInscritas = await db
        .select({ moduloId: examenesInscripciones.moduloId })
        .from(examenesInscripciones)
        .where(
          and(
            eq(examenesInscripciones.estudianteId, userId),
            eq(examenesInscripciones.etapaId, etapa.id),
            ne(examenesInscripciones.estado, 'cancelado')
          )
        );

      const yaInscritoEnModulos = yaInscritas.map((y) => y.moduloId);

      // Build horariosDisponibles
      type ModItem = { id: number; numero: number; nombre: string };
      const horariosDisponibles: {
        sabado: { '09:00': ModItem[]; '11:00': ModItem[] };
        domingo: { '09:00': ModItem[]; '11:00': ModItem[] };
      } = {
        sabado: { '09:00': [], '11:00': [] },
        domingo: { '09:00': [], '11:00': [] },
      };

      for (const h of horarios) {
        const dayKey = h.dia as 'sabado' | 'domingo';
        const horaKey = h.hora as '09:00' | '11:00';
        if (horariosDisponibles[dayKey] && horariosDisponibles[dayKey][horaKey] !== undefined) {
          horariosDisponibles[dayKey][horaKey].push({
            id: h.moduloId,
            numero: h.moduloNumero,
            nombre: h.moduloNombre,
          });
        }
      }

      // Days remaining until solicitudFin
      const solicitudFinDate = new Date(etapa.solicitudFin);
      const diffMs = solicitudFinDate.getTime() - today.getTime();
      const diasRestantesParaInscribirse = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

      return {
        id: etapa.id,
        clave: etapa.clave,
        etapa: etapa.etapa,
        fase: etapa.fase,
        solicitudInicio: etapa.solicitudInicio,
        solicitudFin: etapa.solicitudFin,
        examenSabado: etapa.examenSabado,
        examenDomingo: etapa.examenDomingo,
        estado: etapa.estado,
        inscripcionAbierta: etapa.estado === 'inscripcion_abierta',
        diasRestantesParaInscribirse,
        horariosDisponibles,
        yaInscritoEnModulos,
      };
    })
  );

  res.json({ mes, etapas: etapasResult });
});

// ─── POST /estudiante/convocatoria/inscribirme ────────────────────────────
const inscribirmeSchema = z.object({
  etapaId: z.number().int().positive(),
  modulosIds: z.array(z.number().int().positive()).min(1),
});

router.post('/convocatoria/inscribirme', async (req, res) => {
  const userId = req.user!.userId;

  const parse = inscribirmeSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }
  const { etapaId, modulosIds } = parse.data;

  // a. Etapa exists and open
  const [etapa] = await db
    .select()
    .from(convocatoriasEtapas)
    .where(eq(convocatoriasEtapas.id, etapaId));
  if (!etapa) {
    res.status(404).json({ error: 'Etapa no encontrada' });
    return;
  }
  if (etapa.estado !== 'inscripcion_abierta') {
    res.status(400).json({ error: 'La inscripción no está abierta para esta etapa' });
    return;
  }

  // b. Expediente completo
  const { completo, faltantes } = await expedienteCompleto(userId);
  if (!completo) {
    res.status(400).json({
      error: `Expediente incompleto. Documentos faltantes: ${faltantes.join(', ')}`,
    });
    return;
  }

  // c & d. Validate horarios and check not already inscribed
  const horariosPorModulo: Array<{
    moduloId: number;
    horario: typeof convocatoriasModulosHorarios.$inferSelect;
    moduloNombre: string;
  }> = [];

  for (const moduloId of modulosIds) {
    const [horarioRow] = await db
      .select({
        horario: convocatoriasModulosHorarios,
        moduloNombre: modulos.nombre,
      })
      .from(convocatoriasModulosHorarios)
      .innerJoin(modulos, eq(convocatoriasModulosHorarios.moduloId, modulos.id))
      .where(
        and(
          eq(convocatoriasModulosHorarios.etapaId, etapaId),
          eq(convocatoriasModulosHorarios.moduloId, moduloId)
        )
      );

    if (!horarioRow) {
      res.status(400).json({ error: `No hay horario asignado para el módulo ${moduloId}` });
      return;
    }

    // Check not already inscribed
    const [existente] = await db
      .select({ id: examenesInscripciones.id })
      .from(examenesInscripciones)
      .where(
        and(
          eq(examenesInscripciones.estudianteId, userId),
          eq(examenesInscripciones.etapaId, etapaId),
          eq(examenesInscripciones.moduloId, moduloId),
          ne(examenesInscripciones.estado, 'cancelado')
        )
      );
    if (existente) {
      res.status(400).json({ error: `Ya estás inscrito en el módulo ${moduloId} para esta etapa` });
      return;
    }

    horariosPorModulo.push({ moduloId, horario: horarioRow.horario, moduloNombre: horarioRow.moduloNombre });
  }

  // e. Check schedule conflicts among new modules + existing for this etapa
  const existingInscripciones = await db
    .select({
      dia: convocatoriasModulosHorarios.dia,
      hora: convocatoriasModulosHorarios.hora,
    })
    .from(examenesInscripciones)
    .innerJoin(
      convocatoriasModulosHorarios,
      eq(examenesInscripciones.horarioId, convocatoriasModulosHorarios.id)
    )
    .where(
      and(
        eq(examenesInscripciones.estudianteId, userId),
        eq(examenesInscripciones.etapaId, etapaId),
        ne(examenesInscripciones.estado, 'cancelado')
      )
    );

  const occupiedSlots = new Set(existingInscripciones.map((e) => `${e.dia}|${e.hora}`));

  // Check conflicts within new modules too
  const newSlots = new Set<string>();
  for (const { horario, moduloId } of horariosPorModulo) {
    const slotKey = `${horario.dia}|${horario.hora}`;
    if (occupiedSlots.has(slotKey)) {
      res.status(400).json({
        error: `El módulo ${moduloId} tiene un conflicto de horario (${horario.dia} ${horario.hora})`,
      });
      return;
    }
    if (newSlots.has(slotKey)) {
      res.status(400).json({
        error: `Conflicto de horario entre los módulos seleccionados (${horario.dia} ${horario.hora})`,
      });
      return;
    }
    newSlots.add(slotKey);
  }

  // Get sede by student's municipio
  const [est] = await db
    .select({ municipioId: estudiantes.municipioId })
    .from(estudiantes)
    .where(eq(estudiantes.userId, userId));

  let sedeId: number;
  if (est?.municipioId) {
    const [sd] = await db
      .select({ id: sedes.id })
      .from(sedes)
      .where(eq(sedes.municipioId, est.municipioId))
      .limit(1);
    if (sd) {
      sedeId = sd.id;
    } else {
      const [defaultSede] = await db.select({ id: sedes.id }).from(sedes).limit(1);
      sedeId = defaultSede.id;
    }
  } else {
    const [defaultSede] = await db.select({ id: sedes.id }).from(sedes).limit(1);
    sedeId = defaultSede.id;
  }

  // Insert inscriptions
  const inscripcionesResult: Array<{ folio: string; moduloNombre: string; fecha: string; hora: string }> = [];

  for (const { moduloId, horario, moduloNombre } of horariosPorModulo) {
    const folio = `${etapa.clave}-${Math.floor(1000 + Math.random() * 8999)}`;
    await db.insert(examenesInscripciones).values({
      estudianteId: userId,
      etapaId,
      moduloId,
      horarioId: horario.id,
      sedeId,
      folio,
      estado: 'inscrito',
    });

    const fechaExamen = horario.dia === 'sabado' ? etapa.examenSabado : etapa.examenDomingo;
    inscripcionesResult.push({ folio, moduloNombre, fecha: fechaExamen ?? '', hora: horario.hora });
  }

  await tryAuditLog({
    userId,
    accion: 'inscribir_examen',
    entidad: 'examenes_inscripciones',
    entidadId: userId,
    detalle: `Se inscribió a ${modulosIds.length} examen(es) de la etapa ID ${etapaId}`,
    metadata: { etapaId, modulosIds, cantidad: modulosIds.length },
    req,
  });

  res.json({ ok: true, inscripciones: inscripcionesResult });
});

// ─── GET /estudiante/convocatoria/pase/:inscripcionId ─────────────────────
router.get('/convocatoria/pase/:inscripcionId', async (req, res) => {
  const userId = req.user!.userId;
  const inscripcionId = Number(req.params.inscripcionId as string);

  if (!inscripcionId) {
    res.status(400).json({ error: 'ID inválido' });
    return;
  }

  const [row] = await db
    .select({
      id: examenesInscripciones.id,
      folio: examenesInscripciones.folio,
      estado: examenesInscripciones.estado,
      calificacion: examenesInscripciones.calificacion,
      paseValidadoEn: examenesInscripciones.paseValidadoEn,
      estudianteId: examenesInscripciones.estudianteId,
      etapaId: examenesInscripciones.etapaId,
      moduloId: examenesInscripciones.moduloId,
      sedeId: examenesInscripciones.sedeId,
      etapaClave: convocatoriasEtapas.clave,
      etapaExamenSabado: convocatoriasEtapas.examenSabado,
      etapaExamenDomingo: convocatoriasEtapas.examenDomingo,
      moduloNumero: modulos.numero,
      moduloNombre: modulos.nombre,
      dia: convocatoriasModulosHorarios.dia,
      hora: convocatoriasModulosHorarios.hora,
      sedeNombre: sedes.nombre,
      sedeDireccion: sedes.direccion,
      sedeTelefono: sedes.telefono,
      sedeLatitud: sedes.latitud,
      sedeLongitud: sedes.longitud,
      estudianteNombre: estudiantes.nombreCompleto,
      estudianteCurp: estudiantes.curp,
    })
    .from(examenesInscripciones)
    .innerJoin(convocatoriasEtapas, eq(examenesInscripciones.etapaId, convocatoriasEtapas.id))
    .innerJoin(modulos, eq(examenesInscripciones.moduloId, modulos.id))
    .innerJoin(
      convocatoriasModulosHorarios,
      eq(examenesInscripciones.horarioId, convocatoriasModulosHorarios.id)
    )
    .innerJoin(sedes, eq(examenesInscripciones.sedeId, sedes.id))
    .innerJoin(estudiantes, eq(examenesInscripciones.estudianteId, estudiantes.userId))
    .where(eq(examenesInscripciones.id, inscripcionId));

  if (!row) {
    res.status(404).json({ error: 'Inscripción no encontrada' });
    return;
  }

  if (row.estudianteId !== userId) {
    res.status(403).json({ error: 'No autorizado' });
    return;
  }

  const fechaExamen = row.dia === 'sabado' ? row.etapaExamenSabado : row.etapaExamenDomingo;

  const qrData = {
    folio: row.folio,
    estudianteId: userId,
    etapa: row.etapaClave,
    moduloId: row.moduloId,
    sedeId: row.sedeId,
    ts: Date.now(),
  };

  res.json({
    folio: row.folio,
    estado: row.estado,
    paseValidadoEn: row.paseValidadoEn,
    calificacion: row.calificacion,
    etapa: {
      clave: row.etapaClave,
      examenSabado: row.etapaExamenSabado,
      examenDomingo: row.etapaExamenDomingo,
    },
    estudiante: {
      nombreCompleto: row.estudianteNombre,
      curp: row.estudianteCurp ?? '',
    },
    modulo: { numero: row.moduloNumero, nombre: row.moduloNombre },
    fechaExamen,
    hora: row.hora,
    dia: row.dia,
    sede: {
      nombre: row.sedeNombre,
      direccion: row.sedeDireccion,
      telefono: row.sedeTelefono ?? null,
      latitud: row.sedeLatitud ? parseFloat(row.sedeLatitud) : null,
      longitud: row.sedeLongitud ? parseFloat(row.sedeLongitud) : null,
    },
    qrPayload: firmarQrPayload(qrData),
  });
});

// ─── GET /estudiante/convocatoria/pase/:inscripcionId/pdf ─────────────────
router.get('/convocatoria/pase/:inscripcionId/pdf', async (req, res) => {
  const userId = req.user!.userId;
  const inscripcionId = Number(req.params.inscripcionId as string);

  if (!inscripcionId) {
    res.status(400).json({ error: 'ID inválido' });
    return;
  }

  const [row] = await db
    .select({
      id: examenesInscripciones.id,
      folio: examenesInscripciones.folio,
      estado: examenesInscripciones.estado,
      estudianteId: examenesInscripciones.estudianteId,
      etapaId: examenesInscripciones.etapaId,
      moduloId: examenesInscripciones.moduloId,
      sedeId: examenesInscripciones.sedeId,
      etapaClave: convocatoriasEtapas.clave,
      etapaExamenSabado: convocatoriasEtapas.examenSabado,
      etapaExamenDomingo: convocatoriasEtapas.examenDomingo,
      moduloNumero: modulos.numero,
      moduloNombre: modulos.nombre,
      dia: convocatoriasModulosHorarios.dia,
      hora: convocatoriasModulosHorarios.hora,
      sedeNombre: sedes.nombre,
      sedeDireccion: sedes.direccion,
      estudianteNombre: estudiantes.nombreCompleto,
      estudianteCurp: estudiantes.curp,
    })
    .from(examenesInscripciones)
    .innerJoin(convocatoriasEtapas, eq(examenesInscripciones.etapaId, convocatoriasEtapas.id))
    .innerJoin(modulos, eq(examenesInscripciones.moduloId, modulos.id))
    .innerJoin(
      convocatoriasModulosHorarios,
      eq(examenesInscripciones.horarioId, convocatoriasModulosHorarios.id)
    )
    .innerJoin(sedes, eq(examenesInscripciones.sedeId, sedes.id))
    .innerJoin(estudiantes, eq(examenesInscripciones.estudianteId, estudiantes.userId))
    .where(eq(examenesInscripciones.id, inscripcionId));

  if (!row) {
    res.status(404).json({ error: 'Inscripción no encontrada' });
    return;
  }

  if (row.estudianteId !== userId) {
    res.status(403).json({ error: 'No autorizado' });
    return;
  }

  // Update estado if still 'inscrito'
  if (row.estado === 'inscrito') {
    await db
      .update(examenesInscripciones)
      .set({ estado: 'pase_descargado' })
      .where(eq(examenesInscripciones.id, inscripcionId));
  }

  const fechaExamen = row.dia === 'sabado' ? row.etapaExamenSabado : row.etapaExamenDomingo;
  const qrData = { folio: row.folio, estudianteId: userId, etapa: row.etapaClave, moduloId: row.moduloId, sedeId: row.sedeId };
  const qrPayload = firmarQrPayload(qrData);

  const titulo = `PASE DE EXAMEN PROVISIONAL - ${row.folio}`;
  const contenido = [
    titulo,
    '',
    `Alumno: ${row.estudianteNombre}`,
    `CURP: ${row.estudianteCurp ?? ''}`,
    '',
    `Modulo: ${row.moduloNumero} - ${row.moduloNombre}`,
    `Fecha de examen: ${fechaExamen}`,
    `Dia: ${row.dia === 'sabado' ? 'Sabado' : 'Domingo'}`,
    `Hora: ${row.hora}`,
    '',
    `Sede: ${row.sedeNombre}`,
    `Direccion: ${row.sedeDireccion}`,
    '',
    `Folio: ${row.folio}`,
    `Etapa: ${row.etapaClave}`,
    '',
    'CODIGO QR (presentar en sede):',
    qrPayload,
    '',
    'IEMSyS - Prepa Abierta Michoacan',
    'Este pase es PROVISIONAL. Presentarlo el dia del examen.',
  ].join('\n');

  const pdfBuffer = generarPdfStub(contenido);

  const safeForename = row.folio.replace(/[^a-zA-Z0-9-]/g, '');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="pase-${safeForename}.pdf"`);
  res.setHeader('Content-Length', pdfBuffer.length);
  res.send(pdfBuffer);
});

// ─── POST /estudiante/convocatoria/inscripcion/:id/cancelar ──────────────
router.post('/convocatoria/inscripcion/:id/cancelar', async (req, res) => {
  const userId = req.user!.userId;
  const inscripcionId = Number(req.params.id as string);

  if (!inscripcionId) {
    res.status(400).json({ error: 'ID inválido' });
    return;
  }

  const [insc] = await db
    .select({
      id: examenesInscripciones.id,
      estudianteId: examenesInscripciones.estudianteId,
      estado: examenesInscripciones.estado,
      solicitudFin: convocatoriasEtapas.solicitudFin,
    })
    .from(examenesInscripciones)
    .innerJoin(convocatoriasEtapas, eq(examenesInscripciones.etapaId, convocatoriasEtapas.id))
    .where(eq(examenesInscripciones.id, inscripcionId));

  if (!insc) {
    res.status(404).json({ error: 'Inscripción no encontrada' });
    return;
  }
  if (insc.estudianteId !== userId) {
    res.status(403).json({ error: 'No autorizado' });
    return;
  }
  if (insc.estado !== 'inscrito') {
    res.status(400).json({ error: 'Solo se puede cancelar una inscripción en estado "inscrito"' });
    return;
  }
  const solicitudFinDate = insc.solicitudFin ? new Date(insc.solicitudFin) : null;
  if (!solicitudFinDate || solicitudFinDate < new Date()) {
    res.status(400).json({ error: 'El período de inscripción ya cerró, no se puede cancelar' });
    return;
  }

  await db
    .update(examenesInscripciones)
    .set({ estado: 'cancelado' })
    .where(eq(examenesInscripciones.id, inscripcionId));

  await tryAuditLog({
    userId,
    accion: 'cancelar_inscripcion_examen',
    entidad: 'examenes_inscripciones',
    entidadId: inscripcionId,
    detalle: `Canceló inscripción a examen ID ${inscripcionId}`,
    metadata: {},
    req,
  });

  res.json({ ok: true });
});

// ─── GET /estudiante/ficha-preregistro ───────────────────────────────────────
router.get('/ficha-preregistro', async (req, res) => {
  const userId = req.user!.userId;

  let [est] = await db.select().from(estudiantes).where(eq(estudiantes.userId, userId));
  if (!est) { res.status(404).json({ error: 'Datos de estudiante no encontrados' }); return; }

  if (!est.folioPreregistro) {
    const { generarFolioPreregistro, agregarDiasHabiles } = await import('../utils/folio');
    const folio = await generarFolioPreregistro();
    const ahora = new Date();
    const vigencia = agregarDiasHabiles(ahora, 15);
    await db.update(estudiantes).set({
      folioPreregistro: folio,
      preregistroGeneradoEn: ahora,
      preregistroVigenteHasta: vigencia.toISOString().split('T')[0],
    }).where(eq(estudiantes.userId, userId));
    [est] = await db.select().from(estudiantes).where(eq(estudiantes.userId, userId));
  }

  const [userRow] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId));
  const [municipio] = est.municipioId
    ? await db.select({ nombre: municipios.nombre }).from(municipios).where(eq(municipios.id, est.municipioId))
    : [null];
  const [gestorRow] = est.gestorId
    ? await db.select({ nombreCompleto: gestores.nombreCompleto, emailPublico: gestores.emailPublico }).from(gestores).where(eq(gestores.userId, est.gestorId))
    : [null];

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

// ─── GET /estudiante/ficha-registro ──────────────────────────────────────────
router.get('/ficha-registro', async (req, res) => {
  const userId = req.user!.userId;

  const [est] = await db
    .select({
      nombreCompleto: estudiantes.nombreCompleto,
      curp: estudiantes.curp,
      fechaNacimiento: estudiantes.fechaNacimiento,
      telefono: estudiantes.telefono,
      municipioId: estudiantes.municipioId,
      gestorId: estudiantes.gestorId,
      folioPreregistro: estudiantes.folioPreregistro,
      matriculaOficialDGB: estudiantes.matriculaOficialDGB,
      matriculaCapturadaEn: estudiantes.matriculaCapturadaEn,
    })
    .from(estudiantes)
    .where(eq(estudiantes.userId, userId));

  if (!est || !est.matriculaOficialDGB) {
    res.status(400).json({ error: 'Aún no tienes matrícula oficial asignada.' });
    return;
  }

  const [userRow] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId));
  const [municipio] = est.municipioId
    ? await db.select({ nombre: municipios.nombre }).from(municipios).where(eq(municipios.id, est.municipioId))
    : [null];
  const [gestor] = est.gestorId
    ? await db.select({ nombreCompleto: gestores.nombreCompleto }).from(gestores).where(eq(gestores.userId, est.gestorId))
    : [null];

  const docsValidados = await db
    .select({ tipo: expedienteDocumentos.tipo, revisadoEn: expedienteDocumentos.revisadoEn })
    .from(expedienteDocumentos)
    .where(and(eq(expedienteDocumentos.estudianteId, userId), eq(expedienteDocumentos.estado, 'aprobado')));

  const pdf = await generarFichaRegistro({
    matricula: est.matriculaOficialDGB,
    folio: est.folioPreregistro ?? '—',
    nombreCompleto: est.nombreCompleto,
    curp: est.curp ?? null,
    fechaNacimiento: est.fechaNacimiento ?? null,
    telefono: est.telefono ?? null,
    email: userRow?.email ?? '',
    municipio: municipio?.nombre ?? null,
    gestor: gestor ? { nombre: gestor.nombreCompleto } : null,
    matriculaCapturadaEn: est.matriculaCapturadaEn ?? null,
    documentosValidados: docsValidados.map(d => ({ tipo: d.tipo, validadoEn: d.revisadoEn ?? null })),
    pagos: [],
  });

  const safeMat = est.matriculaOficialDGB.replace(/[^a-zA-Z0-9]/g, '');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="ficha-registro-${safeMat}.pdf"`);
  res.send(pdf);
});

export default router;
