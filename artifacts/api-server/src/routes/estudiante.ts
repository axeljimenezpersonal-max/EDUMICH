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
  inscripcionModulos,
  datosBancarios,
  conceptosPago,
  calificaciones,
  pagos,
  bancoPreguntas,
  pagosExamen,
  pagosExamenInscripciones,
} from '@workspace/db/schema';
import { recalcularFicha } from './pagos-examen';
import QRCode from 'qrcode';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { authRequired, requireRol } from '../middleware/auth';
import { generarFichaPreregistro, generarFichaRegistro } from '../services/pdf';
import { generarCredencialPdf } from '../services/credencialPdf';
import { rutaFotoAprobada } from '../utils/fotoExpediente';
import {
  obtenerDatosCedula,
  guardarDatosCedula,
  generarCedulaPdf,
  dispositionCedula,
  cedulaDatosSchema,
} from '../services/cedula';
import { armarNombreCompleto, armarDireccion } from '../utils/estudianteDatos';
import { nombreArchivoUtf8 } from '../utils/archivo';
import { tryAuditLog } from '../utils/audit';
import { notificarATodosLosAdmins } from '../utils/notificar';
import { QR_SECRET } from '../config/env';
import { VIGENCIA_CREDENCIAL_MESES } from '../config/reglas';

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
  fileFilter: (req, file, cb) => {
    // La fotografía acepta imágenes; el resto de documentos, solo PDF.
    const tipo = (req.params as { tipo?: string }).tipo;
    const permitidos =
      tipo === 'foto' ? ['application/pdf', 'image/jpeg', 'image/png'] : ['application/pdf'];
    if (!permitidos.includes(file.mimetype)) {
      cb(new Error(tipo === 'foto' ? 'La foto debe ser JPG, PNG o PDF' : 'Solo se aceptan archivos PDF'));
      return;
    }
    cb(null, true);
  },
});

// Envuelve multer para que un archivo inválido/pesado devuelva un 400 con
// mensaje claro, en vez del 500 genérico "Error interno del servidor".
function subirArchivoExpediente(
  req: import('express').Request,
  res: import('express').Response,
  next: import('express').NextFunction
) {
  uploadExpediente.single('archivo')(req, res, (err: unknown) => {
    if (err) {
      const msg = err instanceof Error ? err.message : 'Archivo inválido';
      res.status(400).json({ error: msg });
      return;
    }
    next();
  });
}

// ── Utilidad: PDF stub sin dependencias externas ──────────────────────────
function generarPdfStub(titulo: string): Buffer {
  const safe = titulo.replace(/[()\\]/g, (c) => `\\${c}`);
  const stream =
    `BT /F1 14 Tf 72 720 Td (${safe}) Tj ` +
    `0 -30 Td /F1 10 Tf (Material en preparacion - estara disponible proximamente.) Tj ` +
    `0 -20 Td (IEMSyS - Preparatoria Abierta Michoacan) Tj ET`;

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
      licenciaDigital: estudiantes.licenciaDigital,
      estadoCuenta: estudiantes.estadoCuenta,
      avisoEliminacionEnviadoEn: estudiantes.avisoEliminacionEnviadoEn,
      ultimaActividadEn: estudiantes.ultimaActividadEn,
      createdAt: estudiantes.createdAt,
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

  // Documentos del EXPEDIENTE (fuente de verdad), no la tabla legacy.
  // Aprobados = obligatorios aprobados (0-5); pendientes/rechazados en cualquier doc.
  const OBLIG_EXP = ['curp', 'acta_nacimiento', 'ine', 'comprobante_domicilio', 'certificado_secundaria'];
  const expDocs = await db
    .select({ tipo: expedienteDocumentos.tipo, estado: expedienteDocumentos.estado })
    .from(expedienteDocumentos)
    .where(eq(expedienteDocumentos.estudianteId, userId));

  const documentosAprobados = new Set(
    expDocs.filter((d) => d.estado === 'aprobado' && OBLIG_EXP.includes(d.tipo)).map((d) => d.tipo)
  ).size;
  const documentosPendientes = expDocs.filter((d) => d.estado === 'pendiente_revision').length;
  const tieneRechazados = expDocs.some((d) => d.estado === 'rechazado');

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

  // Exámenes inscritos (convocatoria activa)
  const examenesInscritos = await db
    .select({
      id: examenesInscripciones.id,
      folio: examenesInscripciones.folio,
      estado: examenesInscripciones.estado,
      moduloNumero: modulos.numero,
      moduloNombre: modulos.nombre,
      dia: convocatoriasModulosHorarios.dia,
      hora: convocatoriasModulosHorarios.hora,
      sedeNombre: sedes.nombre,
      etapaExamenSabado: convocatoriasEtapas.examenSabado,
      etapaExamenDomingo: convocatoriasEtapas.examenDomingo,
      etapaClave: convocatoriasEtapas.clave,
    })
    .from(examenesInscripciones)
    .innerJoin(modulos, eq(examenesInscripciones.moduloId, modulos.id))
    .innerJoin(convocatoriasModulosHorarios, eq(examenesInscripciones.horarioId, convocatoriasModulosHorarios.id))
    .innerJoin(sedes, eq(examenesInscripciones.sedeId, sedes.id))
    .innerJoin(convocatoriasEtapas, eq(examenesInscripciones.etapaId, convocatoriasEtapas.id))
    .where(eq(examenesInscripciones.estudianteId, userId))
    .orderBy(modulos.numero);

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
    licenciaDigital: est.licenciaDigital ?? null,
    avisoEliminacion: est.estadoCuenta === 'aviso_enviado'
      ? {
          estadoCuenta: est.estadoCuenta,
          avisoEnviadoEn: est.avisoEliminacionEnviadoEn?.toISOString() ?? null,
          diasRestantes: est.avisoEliminacionEnviadoEn
            ? Math.max(0, 5 - Math.floor((Date.now() - new Date(est.avisoEliminacionEnviadoEn).getTime()) / 86400000))
            : 0,
          diasInactivo: Math.floor(
            (Date.now() - new Date(est.ultimaActividadEn ?? est.createdAt).getTime()) / 86400000
          ),
        }
      : null,
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
    examenesInscritos: examenesInscritos.map((e) => ({
      id: e.id,
      folio: e.folio,
      estado: e.estado,
      moduloNumero: e.moduloNumero,
      moduloNombre: e.moduloNombre,
      fechaExamen: e.dia === 'sabado' ? e.etapaExamenSabado : e.etapaExamenDomingo,
      dia: e.dia,
      hora: e.hora,
      sedeNombre: e.sedeNombre,
      etapaClave: e.etapaClave,
    })),
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
// Devuelve los 21 módulos del Plan Modular con el progreso del alumno.
// GATING: el plan sólo se desbloquea cuando el alumno tiene al menos
// un pago verificado (pagos.estado = 'verificado').
// Los módulos con examen inscrito en examenesInscripciones se marcan
// como `inscritoExamen: true` y aparecen resaltados en el frontend.
router.get('/modulos', async (req, res) => {
  const userId = req.user!.userId;

  // 1. ¿Tiene pago verificado?
  const [pagoVerificado] = await db
    .select({ id: pagos.id })
    .from(pagos)
    .where(and(eq(pagos.estudianteId, userId), eq(pagos.estado, 'verificado')))
    .limit(1);

  const planDesbloqueado = !!pagoVerificado;

  // 2. Exámenes inscritos (para badge y contador)
  const examenes = await db
    .select({
      moduloId: examenesInscripciones.moduloId,
      estado: examenesInscripciones.estado,
    })
    .from(examenesInscripciones)
    .where(eq(examenesInscripciones.estudianteId, userId));

  const examenPorModulo = new Map(examenes.map((e) => [e.moduloId, e.estado]));
  const totalInscritos = examenes.length;
  const aprobadosInscritos = examenes.filter((e) => e.estado === 'aprobado').length;

  // 3. Los 21 módulos + progreso del alumno
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

  const enCurso = rows.filter((r) => r.estado === 'en_curso').length;
  const totalQuizzes = rows.reduce((s, r) => s + (r.intentosQuiz ?? 0), 0);
  const conCal = rows.filter((r) => r.mejorCalificacion !== null);
  const promedioGlobal =
    conCal.length > 0
      ? Math.round(conCal.reduce((s, r) => s + (r.mejorCalificacion ?? 0), 0) / conCal.length)
      : 0;

  res.json({
    planDesbloqueado,
    modulos: rows.map((r) => ({
      id: r.id,
      numero: r.numero,
      nivel: r.nivel,
      nombre: r.nombre,
      descripcionCorta: r.descripcion ?? null,
      inscritoExamen: examenPorModulo.has(r.id),
      estadoExamen: examenPorModulo.get(r.id) ?? null,
      progreso: {
        estado: r.estado ?? 'no_iniciado',
        intentosQuiz: r.intentosQuiz ?? 0,
        mejorCalificacion: r.mejorCalificacion ?? null,
        ultimaCalificacion: r.ultimaCalificacion ?? null,
      },
    })),
    resumen: {
      totalModulos: rows.length,
      totalInscritos,      // módulos con examen agendado
      aprobados: aprobadosInscritos,  // aprobados de los inscritos
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

  // Conteo de preguntas en el banco para este módulo
  const [{ totalPreguntas }] = await db
    .select({ totalPreguntas: sql<number>`COUNT(*)::int` })
    .from(bancoPreguntas)
    .where(eq(bancoPreguntas.moduloId, moduloId));

  res.json({
    modulo: {
      id: mod.id,
      numero: mod.numero,
      nivel: mod.nivel,
      nombre: mod.nombre,
      descripcionCorta: mod.descripcion ?? null,
      totalPreguntas: totalPreguntas > 0 ? totalPreguntas : null,
      tiempoEstimadoMin: totalPreguntas > 0 ? 20 : null, // ~1 min/pregunta
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
      temasDebiles: (progreso?.temasDebiles as { tema: string; correctas: number; total: number }[] | null) ?? null,
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
      matriculaOficialDGB: estudiantes.matriculaOficialDGB,
      matriculaCapturadaEn: estudiantes.matriculaCapturadaEn,
      folioPreregistro: estudiantes.folioPreregistro,
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
    matriculaOficialDGB: est.matriculaOficialDGB ?? null,
    matriculaCapturadaEn: est.matriculaCapturadaEn?.toISOString() ?? null,
    folioPreregistro: est.folioPreregistro ?? null,
  });
});

// ─── PATCH /estudiante/datos-personales ───────────────────────────────────
const datosPersonalesSchema = z.object({
  nombreCompleto: z.string().min(3).max(200).optional(),
  nombres: z.string().max(120).optional(),
  apellidoPaterno: z.string().max(100).optional(),
  apellidoMaterno: z.string().max(100).optional(),
  curp: z
    .string()
    .regex(/^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z\d]\d$/, 'CURP inválida')
    .optional()
    .or(z.literal('')),
  fechaNacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  sexo: z.string().max(20).optional(),
  lugarNacimiento: z.string().max(120).optional(),
  entidadNacimiento: z.string().max(80).optional(),
  estadoCivil: z.string().max(30).optional(),
  ultimoEstudio: z.string().max(120).optional(),
  telefono: z.string().max(30).optional(),
  direccion: z.string().max(500).optional(),
  calleNumero: z.string().max(200).optional(),
  colonia: z.string().max(120).optional(),
  cp: z.string().max(10).optional(),
  ciudad: z.string().max(120).optional(),
  estadoDomicilio: z.string().max(80).optional(),
});

router.patch('/datos-personales', async (req, res) => {
  const userId = req.user!.userId;

  const parse = datosPersonalesSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }

  const data = parse.data;
  const [est] = await db.select().from(estudiantes).where(eq(estudiantes.userId, userId));
  if (!est) { res.status(404).json({ error: 'Estudiante no encontrado' }); return; }

  const set: Partial<typeof estudiantes.$inferInsert> = { updatedAt: new Date() };
  if (data.nombres !== undefined) set.nombres = data.nombres;
  if (data.apellidoPaterno !== undefined) set.apellidoPaterno = data.apellidoPaterno;
  if (data.apellidoMaterno !== undefined) set.apellidoMaterno = data.apellidoMaterno;
  if (data.curp !== undefined) set.curp = data.curp || null;
  if (data.fechaNacimiento !== undefined) set.fechaNacimiento = data.fechaNacimiento ?? null;
  if (data.sexo !== undefined) set.sexo = data.sexo;
  if (data.lugarNacimiento !== undefined) set.lugarNacimiento = data.lugarNacimiento;
  if (data.entidadNacimiento !== undefined) set.entidadNacimiento = data.entidadNacimiento;
  if (data.estadoCivil !== undefined) set.estadoCivil = data.estadoCivil;
  if (data.ultimoEstudio !== undefined) set.ultimoEstudio = data.ultimoEstudio;
  if (data.telefono !== undefined) set.telefono = data.telefono;
  if (data.calleNumero !== undefined) set.calleNumero = data.calleNumero;
  if (data.colonia !== undefined) set.colonia = data.colonia;
  if (data.cp !== undefined) set.cp = data.cp;
  if (data.ciudad !== undefined) set.ciudad = data.ciudad;
  if (data.estadoDomicilio !== undefined) set.estadoDomicilio = data.estadoDomicilio;

  // Derivar nombreCompleto: preferir las partes; si no, respetar el enviado directo
  const nc = armarNombreCompleto({
    nombres: data.nombres ?? est.nombres,
    apellidoPaterno: data.apellidoPaterno ?? est.apellidoPaterno,
    apellidoMaterno: data.apellidoMaterno ?? est.apellidoMaterno,
  });
  if (nc) set.nombreCompleto = nc;
  else if (data.nombreCompleto !== undefined) set.nombreCompleto = data.nombreCompleto;

  // Derivar direccion: preferir las partes; si no, respetar la enviada directa
  const dir = armarDireccion({
    calleNumero: data.calleNumero ?? est.calleNumero,
    colonia: data.colonia ?? est.colonia,
    cp: data.cp ?? est.cp,
    ciudad: data.ciudad ?? est.ciudad,
    estadoDomicilio: data.estadoDomicilio ?? est.estadoDomicilio,
  });
  if (dir) set.direccion = dir;
  else if (data.direccion !== undefined) set.direccion = data.direccion;

  await db.update(estudiantes).set(set).where(eq(estudiantes.userId, userId));

  res.json({ ok: true });
});

// ─── POST /estudiante/expediente/documento/:tipo ──────────────────────────
router.post(
  '/expediente/documento/:tipo',
  subirArchivoExpediente,
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
        nombreOriginal: nombreArchivoUtf8(req.file.originalname),
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
          nombreOriginal: nombreArchivoUtf8(req.file.originalname),
          tamanoBytes: req.file.size,
          subidoPorUserId: userId,
          subidoEn: new Date(),
          motivoRechazo: null,
          updatedAt: new Date(),
        },
      });

    // Registrar actividad para el sistema de depuración
    const { registrarActividad } = await import('../services/depuracion');
    await registrarActividad(userId);

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

  // El Content-Type depende del archivo real: la foto puede ser imagen.
  const mime = doc.rutaArchivo.match(/\.(jpe?g)$/i)
    ? 'image/jpeg'
    : doc.rutaArchivo.match(/\.png$/i)
    ? 'image/png'
    : 'application/pdf';
  const safe = doc.nombreOriginal.replace(/[^a-zA-Z0-9_\-. ]/g, '').trim() || 'documento';
  res.setHeader('Content-Type', mime);
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

// ─── Cédula de inscripción ────────────────────────────────────────────────

// GET /estudiante/cedula — datos consolidados (autollenados) para el formulario
router.get('/cedula', async (req, res) => {
  try {
    const datos = await obtenerDatosCedula(req.user!.userId);
    res.json(datos);
  } catch (e) {
    res.status(404).json({ error: e instanceof Error ? e.message : 'No disponible' });
  }
});

// PATCH /estudiante/cedula — RETIRADO: la cédula solo la edita la
// administración (decisión 2026-07-05). El alumno la consulta y descarga.
router.patch('/cedula', (_req, res) => {
  res.status(403).json({ error: 'La cédula la elabora la administración. Puedes consultarla y descargarla desde tu expediente.' });
});

// GET /estudiante/cedula/pdf — cédula rellenada y aplanada
router.get('/cedula/pdf', async (req, res) => {
  try {
    const { pdf, nombreArchivo } = await generarCedulaPdf(req.user!.userId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', dispositionCedula(nombreArchivo));
    res.send(Buffer.from(pdf));
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'No se pudo generar la cédula' });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Helpers convocatoria
// ─────────────────────────────────────────────────────────────────────────

async function expedienteCompleto(
  estudianteId: number
): Promise<{ completo: boolean; faltantes: string[] }> {
  const OBLIGATORIOS = ['curp', 'acta_nacimiento', 'ine', 'comprobante_domicilio', 'certificado_secundaria'];
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

  // Qué exámenes tienen pago verificado (para distinguir pre-inscrito de inscrito).
  const pagadosSet = new Set<number>();
  if (misExamenesRaw.length > 0) {
    const pagRes = await db.execute<{ id: number }>(sql`
      SELECT DISTINCT pei.examen_inscripcion_id AS id
      FROM pagos_examen_inscripciones pei
      JOIN pagos_examen pe ON pe.id = pei.pago_examen_id
      WHERE pe.estado = 'pagado'
        AND pei.examen_inscripcion_id IN (${sql.join(misExamenesRaw.map((r) => sql`${r.id}`), sql`, `)})
    `);
    for (const row of pagRes.rows as { id: number }[]) pagadosSet.add(Number(row.id));
  }

  const misExamenes = misExamenesRaw.map((r) => ({
    id: r.id,
    folio: r.folio,
    estado: r.estado,
    pagado: pagadosSet.has(r.id),
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
  // "Próximas etapas" = solo las programadas (futuras). La etapa activa
  // (inscripcion_abierta) NO va aquí: ya se muestra arriba como activa.
  const proximasEtapas = await db
    .select()
    .from(convocatoriasEtapas)
    .where(eq(convocatoriasEtapas.estado, 'programada'))
    .orderBy(convocatoriasEtapas.examenSabado)
    .limit(3);

  const { completo: expedienteCompleto_, faltantes: documentosFaltantes } =
    await expedienteCompleto(userId);

  const [estConv] = await db
    .select({ matricula: estudiantes.matriculaOficialDGB })
    .from(estudiantes)
    .where(eq(estudiantes.userId, userId));
  const tieneMatricula = !!estConv?.matricula;

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
          // Sin este campo el frontend no muestra el grid de módulos.
          estado: etapaActiva.estado,
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
      tieneMatricula,
      puedeInscribirse: expedienteCompleto_ && tieneMatricula && etapaActiva != null,
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
  // Guard por fecha: nunca después del cierre de solicitud o si el examen ya pasó.
  const hoyStr = new Date().toISOString().slice(0, 10);
  const cierre = etapa.solicitudFin ? String(etapa.solicitudFin) : null;
  const examen = etapa.examenSabado ? String(etapa.examenSabado) : null;
  if ((cierre && cierre < hoyStr) || (examen && examen < hoyStr)) {
    res.status(400).json({ error: 'El período de inscripción de esta etapa ya cerró.' });
    return;
  }

  // b. Expediente completo (5 documentos obligatorios aprobados)
  const { completo, faltantes } = await expedienteCompleto(userId);
  if (!completo) {
    res.status(400).json({
      error: `Expediente incompleto. Documentos faltantes: ${faltantes.join(', ')}`,
    });
    return;
  }

  // b.2. Matrícula oficial registrada (requisito para inscribirse a módulos)
  const [estMat] = await db
    .select({ matricula: estudiantes.matriculaOficialDGB })
    .from(estudiantes)
    .where(eq(estudiantes.userId, userId));
  if (!estMat?.matricula) {
    res.status(400).json({
      error: 'Aún no tienes matrícula oficial registrada. La asigna la administración cuando la Secretaría (SEP-DGB) valida tu expediente.',
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
  const inscripcionesResult: Array<{ id: number; folio: string; moduloNombre: string; fecha: string; hora: string }> = [];

  for (const { moduloId, horario, moduloNombre } of horariosPorModulo) {
    // Si ya existe una inscripción CANCELADA para este (estudiante, etapa, módulo)
    // se revive: el índice único (est, etapa, módulo) impide insertar otra fila,
    // así que al modificar una pre-inscripción reusamos la fila previa.
    const [previa] = await db
      .select({ id: examenesInscripciones.id, folio: examenesInscripciones.folio })
      .from(examenesInscripciones)
      .where(
        and(
          eq(examenesInscripciones.estudianteId, userId),
          eq(examenesInscripciones.etapaId, etapaId),
          eq(examenesInscripciones.moduloId, moduloId)
        )
      );

    let inscId: number;
    let folio: string;
    if (previa) {
      folio = previa.folio;
      await db
        .update(examenesInscripciones)
        .set({
          horarioId: horario.id,
          sedeId,
          estado: 'inscrito',
          paseValidadoEn: null,
          paseValidadoPorUserId: null,
          calificacion: null,
        })
        .where(eq(examenesInscripciones.id, previa.id));
      inscId = previa.id;
    } else {
      folio = `${etapa.clave}-${Math.floor(1000 + Math.random() * 8999)}`;
      const [nueva] = await db
        .insert(examenesInscripciones)
        .values({
          estudianteId: userId,
          etapaId,
          moduloId,
          horarioId: horario.id,
          sedeId,
          folio,
          estado: 'inscrito',
        })
        .returning({ id: examenesInscripciones.id });
      inscId = nueva.id;
    }

    const fechaExamen = horario.dia === 'sabado' ? etapa.examenSabado : etapa.examenDomingo;
    inscripcionesResult.push({ id: inscId, folio, moduloNombre, fecha: fechaExamen ?? '', hora: horario.hora });
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

  // Candado: el pase SOLO existe si el examen tiene el pago verificado.
  const pagoRes = await db.execute<{ pagado: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1 FROM pagos_examen_inscripciones pei
      JOIN pagos_examen pe ON pe.id = pei.pago_examen_id
      WHERE pei.examen_inscripcion_id = ${inscripcionId} AND pe.estado = 'pagado'
    ) AS pagado
  `);
  const pagado = Boolean((pagoRes.rows[0] as { pagado?: boolean } | undefined)?.pagado);

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
    pagado,
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
    // Sin pago verificado no se entrega el QR (el pase aún no es válido).
    qrPayload: pagado ? firmarQrPayload(qrData) : null,
  });
});

// ─── Generador de PDF profesional para pase de examen ────────────────────
async function generarPasePDF(data: {
  folio: string;
  estudianteNombre: string;
  estudianteCurp: string | null;
  moduloNumero: number;
  moduloNombre: string;
  fechaExamen: string | null;
  dia: string;
  hora: string;
  sedeNombre: string;
  sedeDireccion: string;
  qrPayload: string;
}): Promise<Buffer> {
  const pdoc = await PDFDocument.create();
  const page = pdoc.addPage([595, 842]);
  const W = 595, H = 842;

  const boldFont = await pdoc.embedFont(StandardFonts.HelveticaBold);
  const regFont  = await pdoc.embedFont(StandardFonts.Helvetica);

  const GUINDA = rgb(0.4196, 0.0824, 0.1882); // #6b1530
  const WHITE  = rgb(1, 1, 1);
  const DARK   = rgb(0.08, 0.08, 0.08);
  const MUTED  = rgb(0.52, 0.48, 0.46);
  const CREMA  = rgb(0.98, 0.97, 0.95);
  const SEP    = rgb(0.88, 0.86, 0.84);
  const PINK   = rgb(0.96, 0.78, 0.84);

  // ── Header ──────────────────────────────────────────────────────────────
  const HDR = 118;
  page.drawRectangle({ x: 0, y: H - HDR, width: W, height: HDR, color: GUINDA });
  page.drawText('IEMSyS - Preparatoria Abierta Michoacan', {
    x: 40, y: H - 30, font: regFont, size: 8, color: PINK,
  });
  page.drawText('PASE DE EXAMEN PROVISIONAL', {
    x: 40, y: H - 56, font: boldFont, size: 21, color: WHITE,
  });
  page.drawText(data.folio, {
    x: 40, y: H - 78, font: boldFont, size: 12, color: PINK,
  });
  const now = new Date();
  const fecha_gen = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
  page.drawText(`Generado: ${fecha_gen}`, {
    x: 40, y: H - 98, font: regFont, size: 7.5, color: rgb(0.9, 0.65, 0.72),
  });

  // ── QR Code ──────────────────────────────────────────────────────────────
  const qrBuf = await QRCode.toBuffer(data.qrPayload, {
    width: 180, margin: 1,
    color: { dark: '#6b1530', light: '#FFFFFF' },
  });
  const qrImg = await pdoc.embedPng(qrBuf);
  const QR = 155;
  const QX = W - 45 - QR;
  const QY = H - HDR - 18 - QR;
  page.drawRectangle({ x: QX - 4, y: QY - 4, width: QR + 8, height: QR + 8, color: WHITE });
  page.drawImage(qrImg, { x: QX, y: QY, width: QR, height: QR });
  page.drawText('Codigo QR - presentar en sede', {
    x: QX - 2, y: QY - 14, font: regFont, size: 7, color: MUTED,
  });

  // ── Fields ────────────────────────────────────────────────────────────────
  const LX = 45;
  const LINE_RIGHT = QX - 18;
  let cy = H - HDR - 26;

  function field(label: string, value: string) {
    page.drawText(label, { x: LX, y: cy, font: regFont, size: 7.5, color: MUTED });
    cy -= 15;
    const safe = (value || '-').replace(/[-￿]/g, (c) => {
      // keep accented Latin chars (U+00C0–U+00FF) which are in WinAnsi
      return c.charCodeAt(0) <= 0x00FF ? c : '?';
    });
    page.drawText(safe, { x: LX, y: cy, font: boldFont, size: 11.5, color: DARK });
    cy -= 20;
    page.drawLine({ start: { x: LX, y: cy }, end: { x: LINE_RIGHT, y: cy }, thickness: 0.5, color: SEP });
    cy -= 13;
  }

  function formatFecha(ds: string | null): string {
    if (!ds) return 'Por definir';
    const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto',
                   'septiembre','octubre','noviembre','diciembre'];
    const DIAS  = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];
    const [y, m, d] = ds.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return `${DIAS[dt.getUTCDay()]}, ${d} de ${MESES[m - 1]} de ${y}`;
  }

  field('ALUMNO',           data.estudianteNombre);
  field('CURP',             data.estudianteCurp ?? '');
  field('MODULO',           `M${data.moduloNumero} - ${data.moduloNombre}`);
  field('FECHA DE EXAMEN',  formatFecha(data.fechaExamen));
  field('HORA',             `${data.hora} hrs`);
  field('SEDE',             data.sedeNombre);
  field('DIRECCION',        data.sedeDireccion);

  // ── Nota importante ──────────────────────────────────────────────────────
  cy -= 8;
  const NOTE_H = 50;
  page.drawRectangle({ x: 0, y: cy - NOTE_H, width: W, height: NOTE_H, color: CREMA });
  page.drawLine({ start: { x: 0, y: cy }, end: { x: W, y: cy }, thickness: 1, color: SEP });
  page.drawLine({ start: { x: 0, y: cy - NOTE_H }, end: { x: W, y: cy - NOTE_H }, thickness: 1, color: SEP });
  // barra lateral guinda
  page.drawRectangle({ x: 0, y: cy - NOTE_H, width: 5, height: NOTE_H, color: GUINDA });
  page.drawText('IMPORTANTE', { x: LX, y: cy - 18, font: boldFont, size: 9, color: GUINDA });
  page.drawText(
    'Presentar este pase con identificacion oficial el dia del examen.',
    { x: LX, y: cy - 34, font: regFont, size: 9, color: DARK }
  );

  // ── Footer ────────────────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: 0, width: W, height: 40, color: GUINDA });
  page.drawText(
    'Gobierno del Estado de Michoacan  -  IEMSyS  -  Preparatoria Abierta Michoacan',
    { x: 40, y: 15, font: regFont, size: 8, color: PINK }
  );

  return Buffer.from(await pdoc.save());
}

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

  // Candado: sin pago verificado no se genera el pase (aún no es válido).
  const pagoRes = await db.execute<{ pagado: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1 FROM pagos_examen_inscripciones pei
      JOIN pagos_examen pe ON pe.id = pei.pago_examen_id
      WHERE pei.examen_inscripcion_id = ${inscripcionId} AND pe.estado = 'pagado'
    ) AS pagado
  `);
  if (!Boolean((pagoRes.rows[0] as { pagado?: boolean } | undefined)?.pagado)) {
    res.status(403).json({ error: 'Tu pase estará disponible cuando se verifique el pago de este examen.' });
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

  const pdfBuffer = await generarPasePDF({
    folio:            row.folio,
    estudianteNombre: row.estudianteNombre,
    estudianteCurp:   row.estudianteCurp ?? null,
    moduloNumero:     row.moduloNumero,
    moduloNombre:     row.moduloNombre,
    fechaExamen,
    dia:              row.dia,
    hora:             row.hora,
    sedeNombre:       row.sedeNombre,
    sedeDireccion:    row.sedeDireccion,
    qrPayload,
  });

  const safeForename = row.folio.replace(/[^a-zA-Z0-9-]/g, '');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="pase-${safeForename}.pdf"`);
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
  // Se puede cancelar mientras el examen no se haya presentado ni calificado.
  // El bloqueo real es el pago (más abajo): si ya se pagó o está en revisión,
  // no se cancela sin intervención de la coordinación.
  const cancelables = ['inscrito', 'pase_descargado', 'pase_validado'];
  if (!cancelables.includes(insc.estado)) {
    res.status(400).json({ error: 'Esta inscripción ya no se puede cancelar' });
    return;
  }
  const solicitudFinDate = insc.solicitudFin ? new Date(insc.solicitudFin) : null;
  if (!solicitudFinDate || solicitudFinDate < new Date()) {
    res.status(400).json({ error: 'El período de inscripción ya cerró, no se puede cancelar' });
    return;
  }

  // Si el examen ya está pagado o con comprobante en revisión, no se puede
  // cancelar sin intervención de la coordinación (implicaría reembolso).
  const enPago = await db
    .select({ estado: pagosExamen.estado, id: pagosExamen.id })
    .from(pagosExamenInscripciones)
    .innerJoin(pagosExamen, eq(pagosExamenInscripciones.pagoExamenId, pagosExamen.id))
    .where(and(
      eq(pagosExamenInscripciones.examenInscripcionId, inscripcionId),
      inArray(pagosExamen.estado, ['pagado', 'en_revision'])
    ));
  if (enPago.length > 0) {
    res.status(409).json({ error: 'Este examen ya tiene un pago pagado o en revisión. Contacta a la coordinación para cancelarlo.' });
    return;
  }

  // Quitar el examen de fichas activas (solicitada/emitida) y re-validar cada una.
  const fichasActivas = await db
    .select({ id: pagosExamen.id, estado: pagosExamen.estado })
    .from(pagosExamenInscripciones)
    .innerJoin(pagosExamen, eq(pagosExamenInscripciones.pagoExamenId, pagosExamen.id))
    .where(and(
      eq(pagosExamenInscripciones.examenInscripcionId, inscripcionId),
      inArray(pagosExamen.estado, ['pendiente_emision', 'emitida'])
    ));
  for (const f of fichasActivas) {
    await db.delete(pagosExamenInscripciones).where(and(
      eq(pagosExamenInscripciones.pagoExamenId, f.id),
      eq(pagosExamenInscripciones.examenInscripcionId, inscripcionId)
    ));
    await recalcularFicha(f.id, f.estado as 'pendiente_emision' | 'emitida');
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
    fotoPath: await rutaFotoAprobada(est.userId),
    qrVerifUrl: `${process.env.PUBLIC_PORTAL_URL || 'http://localhost:5173'}/verificar/${est.folioPreregistro}`,
  });

  const safeFolio = est.folioPreregistro!.replace(/[^a-zA-Z0-9-]/g, '');
  res.setHeader('Content-Type', 'application/pdf');
  // `inline`: se abre en el navegador para verla (y desde ahí se puede descargar),
  // en vez de forzar la descarga directa.
  res.setHeader('Content-Disposition', `inline; filename="Ficha-de-Pre-registro-${safeFolio}.pdf"`);
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

  // Exámenes inscritos para reflejar la convocatoria actual
  const exInscritos = await db
    .select({
      moduloNumero: modulos.numero,
      moduloNombre: modulos.nombre,
      dia: convocatoriasModulosHorarios.dia,
      hora: convocatoriasModulosHorarios.hora,
      sedeNombre: sedes.nombre,
      etapaExamenSabado: convocatoriasEtapas.examenSabado,
      etapaExamenDomingo: convocatoriasEtapas.examenDomingo,
      etapaClave: convocatoriasEtapas.clave,
    })
    .from(examenesInscripciones)
    .innerJoin(modulos, eq(examenesInscripciones.moduloId, modulos.id))
    .innerJoin(convocatoriasModulosHorarios, eq(examenesInscripciones.horarioId, convocatoriasModulosHorarios.id))
    .innerJoin(sedes, eq(examenesInscripciones.sedeId, sedes.id))
    .innerJoin(convocatoriasEtapas, eq(examenesInscripciones.etapaId, convocatoriasEtapas.id))
    .where(eq(examenesInscripciones.estudianteId, userId))
    .orderBy(modulos.numero);

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
    examenesInscritos: exInscritos.map(e => ({
      moduloNumero: e.moduloNumero,
      moduloNombre: e.moduloNombre,
      fechaExamen: e.dia === 'sabado' ? e.etapaExamenSabado : e.etapaExamenDomingo,
      dia: e.dia,
      hora: e.hora,
      sedeNombre: e.sedeNombre,
      etapaClave: e.etapaClave,
    })),
  });

  const safeMat = est.matriculaOficialDGB.replace(/[^a-zA-Z0-9]/g, '');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="ficha-registro-${safeMat}.pdf"`);
  res.send(pdf);
});

// ─── GET /estudiante/mi-foto ─────────────────────────────────────────────
// Sirve la fotografía aprobada del alumno (para mostrar en credencial/header).
// 404 si no tiene foto aprobada o el archivo no existe.
router.get('/mi-foto', async (req, res) => {
  const userId = req.user!.userId;

  const [doc] = await db
    .select({ rutaArchivo: expedienteDocumentos.rutaArchivo, nombreOriginal: expedienteDocumentos.nombreOriginal })
    .from(expedienteDocumentos)
    .where(
      and(
        eq(expedienteDocumentos.estudianteId, userId),
        eq(expedienteDocumentos.tipo, 'foto'),
        eq(expedienteDocumentos.estado, 'aprobado'),
      )
    );

  if (!doc || !existsSync(doc.rutaArchivo)) {
    res.status(404).json({ error: 'Sin foto aprobada' });
    return;
  }

  const mime = doc.rutaArchivo.match(/\.(jpe?g)$/i) ? 'image/jpeg'
    : doc.rutaArchivo.match(/\.png$/i) ? 'image/png'
    : 'image/jpeg';
  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  createReadStream(doc.rutaArchivo).pipe(res);
});

// ─── GET /estudiante/mi-identificacion ───────────────────────────────────
router.get('/mi-identificacion', async (req, res) => {
  const userId = req.user!.userId;

  const [est] = await db
    .select({
      nombreCompleto: estudiantes.nombreCompleto,
      curp: estudiantes.curp,
      municipioId: estudiantes.municipioId,
      matriculaOficialDGB: estudiantes.matriculaOficialDGB,
      licenciaDigital: estudiantes.licenciaDigital,
      licenciaEmitidaEn: estudiantes.licenciaEmitidaEn,
    })
    .from(estudiantes)
    .where(eq(estudiantes.userId, userId));

  if (!est || !est.licenciaDigital) {
    res.json({ tieneIdentificacion: false });
    return;
  }

  // Municipio → Centro de servicios
  const [municipio] = est.municipioId
    ? await db.select({ nombre: municipios.nombre }).from(municipios).where(eq(municipios.id, est.municipioId))
    : [null];

  // Módulos aprobados (calificaciones con aprobado=true)
  const [califCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(calificaciones)
    .where(and(eq(calificaciones.estudianteId, userId), eq(calificaciones.aprobado, true)));
  const modulosAprobados = califCount?.count ?? 0;

  // Separar nombre y apellidos
  const partes = (est.nombreCompleto ?? '').trim().split(/\s+/);
  const nombre = partes[0] ?? '';
  const apellidos = partes.slice(1).join(' ');

  // Máscara CURP: mostrar primeros 6, ocultar 4 (día/mes nacimiento), mostrar resto
  const curp = est.curp ?? '';
  const curpMask = curp.length >= 10 ? `${curp.slice(0, 6)}••••${curp.slice(10)}` : curp;

  // Fechas de emisión y vigencia (regla: VIGENCIA_CREDENCIAL_MESES)
  const fmtDate = (d: Date) =>
    d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Mexico_City' });
  const emisionDate = est.licenciaEmitidaEn ? new Date(est.licenciaEmitidaEn) : null;
  const vigenciaDate = emisionDate ? new Date(emisionDate.getTime()) : null;
  if (vigenciaDate) vigenciaDate.setMonth(vigenciaDate.getMonth() + VIGENCIA_CREDENCIAL_MESES);

  const verifyUrl = `https://verifica.edumich.michoacan.gob.mx/c/${est.licenciaDigital}`;

  // ¿Tiene foto aprobada?
  const [fotoDoc] = await db
    .select({ rutaArchivo: expedienteDocumentos.rutaArchivo })
    .from(expedienteDocumentos)
    .where(and(
      eq(expedienteDocumentos.estudianteId, userId),
      eq(expedienteDocumentos.tipo, 'foto'),
      eq(expedienteDocumentos.estado, 'aprobado'),
    ));
  const tieneFoto = !!(fotoDoc && existsSync(fotoDoc.rutaArchivo));

  res.json({
    tieneIdentificacion: true,
    tieneFoto,
    identificacion: {
      nombreCompleto: est.nombreCompleto,
      nombre,
      apellidos,
      curp,
      curpMask,
      sede: municipio?.nombre ?? '',
      matriculaOficialDGB: est.matriculaOficialDGB ?? null,
      folio: est.licenciaDigital,
      licenciaEmitidaEn: est.licenciaEmitidaEn?.toISOString() ?? null,
      emision: emisionDate ? fmtDate(emisionDate) : null,
      vigencia: vigenciaDate ? fmtDate(vigenciaDate) : null,
      vencida: vigenciaDate ? vigenciaDate.getTime() < Date.now() : false,
      diasParaVencer: vigenciaDate ? Math.ceil((vigenciaDate.getTime() - Date.now()) / 86400000) : null,
      plan: 'Plan 22 · Modular',
      modulosAprobados,
      modulosTotales: 21,
      verifyUrl,
    },
  });
});

// ─── GET /estudiante/credencial/pdf — carnet de la credencial digital ────────
router.get('/credencial/pdf', async (req, res) => {
  const userId = req.user!.userId;
  try {
    const cred = await generarCredencialPdf(userId);
    if (!cred) { res.status(409).json({ error: 'Aún no tienes credencial digital emitida.' }); return; }
    const nombre = `${cred.folio.replace(/[^a-zA-Z0-9_\-.]/g, '')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${nombre}"`);
    res.send(Buffer.from(cred.pdf));
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'No se pudo generar la credencial' });
  }
});

// ─── POST /estudiante/solicitar-renovacion-credencial ─────────────────────
// El alumno pide a la administración renovar su credencial (vencida o por
// pérdida de la física). Solo notifica; el admin la renueva.
router.post('/solicitar-renovacion-credencial', async (req, res) => {
  const userId = req.user!.userId;
  try {
    const [est] = await db
      .select({ nombreCompleto: estudiantes.nombreCompleto, licenciaDigital: estudiantes.licenciaDigital })
      .from(estudiantes).where(eq(estudiantes.userId, userId));
    if (!est) { res.status(404).json({ error: 'Alumno no encontrado' }); return; }
    if (!est.licenciaDigital) { res.status(422).json({ error: 'Aún no tienes credencial emitida.' }); return; }

    const motivo = ((req.body?.motivo as string) || 'vencimiento').toLowerCase();
    const motivoLabel = motivo === 'reposicion' ? 'reposición por pérdida de la física' : 'renovación por vigencia';

    await notificarATodosLosAdmins({
      tipo: 'solicitud_renovacion_credencial',
      prioridad: 'normal',
      titulo: 'Solicitud de renovación de credencial',
      cuerpo: `${est.nombreCompleto} solicita ${motivoLabel} de su credencial.`,
      enlace: `/admin/alumnos/${userId}`,
    });

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'No se pudo enviar la solicitud' });
  }
});

// ─── GET /estudiante/mi-identificacion/descargar ──────────────────────────
router.get('/mi-identificacion/descargar', async (req, res) => {
  const userId = req.user!.userId;

  const [est] = await db
    .select({
      nombreCompleto: estudiantes.nombreCompleto,
      curp: estudiantes.curp,
      municipioId: estudiantes.municipioId,
      matriculaOficialDGB: estudiantes.matriculaOficialDGB,
      licenciaDigital: estudiantes.licenciaDigital,
      licenciaEmitidaEn: estudiantes.licenciaEmitidaEn,
    })
    .from(estudiantes)
    .where(eq(estudiantes.userId, userId));

  if (!est || !est.licenciaDigital) {
    res.status(403).json({ error: 'Aún no tienes una identificación digital emitida' });
    return;
  }

  const [municipio] = est.municipioId
    ? await db.select({ nombre: municipios.nombre }).from(municipios).where(eq(municipios.id, est.municipioId))
    : [null];

  // Separar nombre y apellidos
  const partes = (est.nombreCompleto ?? '').trim().split(/\s+/);
  const nombre  = partes[0] ?? '';
  const apellidos = partes.slice(1).join(' ');

  // Fechas
  const fmtShort = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  const emisionDate = est.licenciaEmitidaEn ? new Date(est.licenciaEmitidaEn) : null;
  const vigenciaDate = emisionDate ? new Date(emisionDate.getTime()) : null;
  if (vigenciaDate) vigenciaDate.setMonth(vigenciaDate.getMonth() + VIGENCIA_CREDENCIAL_MESES);
  const emision = emisionDate ? fmtShort(emisionDate) : '—';
  const vigencia = vigenciaDate ? fmtShort(vigenciaDate) : '—';
  const sede = municipio?.nombre ?? '—';

  // QR → URL de verificación
  const verifyUrl = `https://verifica.edumich.michoacan.gob.mx/c/${est.licenciaDigital}`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 220, margin: 1 });
  const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, '');
  const qrBytes = Buffer.from(qrBase64, 'base64');

  // ── Credencial: 85 mm × 54 mm ≈ 241 × 153 pts ──────────────────────────
  const CARD_W = 241;
  const CARD_H = 153;
  const GUINDA  = rgb(0.4196, 0.0824, 0.1882); // #6b1530
  const GUINDA2 = rgb(0.2902, 0.0549, 0.1255); // #4a0e20
  const CREMA   = rgb(0.973, 0.953, 0.925);   // #F8F4EC
  const CREMA2  = rgb(0.937, 0.906, 0.839);   // #EFE7D6
  const BLANCO  = rgb(1, 1, 1);
  const NEGRO   = rgb(0.165, 0.118, 0.173);
  const GRIS    = rgb(0.471, 0.443, 0.424);   // piedra500
  const VERDE   = rgb(0.176, 0.490, 0.275);   // aprobado

  const doc  = await PDFDocument.create();
  const page = doc.addPage([CARD_W, CARD_H]);
  const bold    = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);

  // Fondo crema
  page.drawRectangle({ x: 0, y: 0, width: CARD_W, height: CARD_H, color: CREMA });

  // Banda superior guinda
  const HDR = 36;
  page.drawRectangle({ x: 0, y: CARD_H - HDR, width: CARD_W, height: HDR, color: GUINDA });
  // Línea de acento bajo el header
  page.drawRectangle({ x: 0, y: CARD_H - HDR - 2, width: CARD_W, height: 2, color: rgb(0.863, 0.361, 0.471) });

  // Textos del header
  page.drawText('GOBIERNO DEL ESTADO DE MICHOACÁN · SECRETARÍA DE EDUCACIÓN', {
    x: 9, y: CARD_H - 10, size: 4.5, font: regular, color: rgb(1, 1, 1),
  });
  page.drawText('Preparatoria Abierta · IEMSyS', {
    x: 9, y: CARD_H - 19, size: 9, font: bold, color: BLANCO,
  });
  page.drawText('CREDENCIAL DEL ESTUDIANTE', {
    x: 9, y: CARD_H - 30, size: 5.5, font: bold, color: rgb(0.918, 0.702, 0.773),
  });

  // QR a la derecha
  const QR_SZ = 74;
  const QR_X  = CARD_W - QR_SZ - 8;
  const QR_Y  = 14;
  const qrImg = await doc.embedPng(qrBytes);
  page.drawRectangle({ x: QR_X - 2, y: QR_Y - 2, width: QR_SZ + 4, height: QR_SZ + 4, color: BLANCO });
  page.drawImage(qrImg, { x: QR_X, y: QR_Y, width: QR_SZ, height: QR_SZ });
  page.drawText('ESCANEAR', { x: QR_X + 15, y: QR_Y - 8, size: 4, font: bold, color: GRIS });

  // ── Foto del alumno (si está aprobada) ───────────────────────────────────
  const [fotoDocPDF] = await db
    .select({ rutaArchivo: expedienteDocumentos.rutaArchivo })
    .from(expedienteDocumentos)
    .where(and(
      eq(expedienteDocumentos.estudianteId, userId),
      eq(expedienteDocumentos.tipo, 'foto'),
      eq(expedienteDocumentos.estado, 'aprobado'),
    ));

  let fotoImg: any = null;
  if (fotoDocPDF && existsSync(fotoDocPDF.rutaArchivo)) {
    try {
      const fotoBytes = await fsp.readFile(fotoDocPDF.rutaArchivo);
      fotoImg = /\.png$/i.test(fotoDocPDF.rutaArchivo)
        ? await doc.embedPng(fotoBytes)
        : await doc.embedJpg(fotoBytes);
    } catch { /* skip si falla el embed */ }
  }

  const FOTO_W = 30;
  const FOTO_H = 37;
  const FOTO_X = 9;
  const FOTO_Y = CARD_H - HDR - 2 - FOTO_H; // flush bajo la línea de acento

  if (fotoImg) {
    // Marco blanco y foto
    page.drawRectangle({ x: FOTO_X - 1, y: FOTO_Y - 1, width: FOTO_W + 2, height: FOTO_H + 2, color: BLANCO });
    page.drawImage(fotoImg, { x: FOTO_X, y: FOTO_Y, width: FOTO_W, height: FOTO_H });
  }

  // Columna de datos: si hay foto, el texto arranca más a la derecha
  const LEFT   = fotoImg ? FOTO_X + FOTO_W + 5 : 9;
  const MAX_W  = QR_X - LEFT - 6;
  let cy = CARD_H - HDR - 11;

  const clip = (text: string, font: typeof bold, size: number, maxW: number) => {
    let t = text;
    while (t.length > 1 && font.widthOfTextAtSize(t, size) > maxW) t = t.slice(0, -1);
    return t !== text ? t.slice(0, -1) + '…' : t;
  };

  // Helper: thin separator line between fields
  const sep = (y: number) =>
    page.drawLine({ start: { x: LEFT, y }, end: { x: QR_X - 5, y }, thickness: 0.4, color: CREMA2 });

  // ── NOMBRE ──────────────────────────────────────────────────────────────
  page.drawText('NOMBRE', { x: LEFT, y: cy, size: 4.5, font: bold, color: GUINDA });
  cy -= 9;
  page.drawText(clip(`${nombre} ${apellidos}`, bold, 9.5, MAX_W), { x: LEFT, y: cy, size: 9.5, font: bold, color: NEGRO });
  cy -= 4;

  // ── MATRÍCULA ────────────────────────────────────────────────────────────
  sep(cy);
  cy -= 8;
  page.drawText('MATRÍCULA OFICIAL DGB', { x: LEFT, y: cy, size: 4.5, font: bold, color: GUINDA });
  cy -= 9;
  page.drawText(clip(est.matriculaOficialDGB ?? '—', bold, 9, MAX_W), { x: LEFT, y: cy, size: 9, font: bold, color: VERDE });
  cy -= 4;

  // ── PLAN / SEDE ───────────────────────────────────────────────────────────
  sep(cy);
  cy -= 8;
  page.drawText('PLAN / CENTRO DE SERVICIOS', { x: LEFT, y: cy, size: 4.5, font: bold, color: GUINDA });
  cy -= 8;
  page.drawText(clip(`Plan 22 · Modular · ${sede}`, regular, 7.5, MAX_W), { x: LEFT, y: cy, size: 7.5, font: regular, color: NEGRO });
  cy -= 4;

  // ── EMISIÓN / VIGENCIA ────────────────────────────────────────────────────
  sep(cy);
  cy -= 8;
  const COL2 = LEFT + MAX_W / 2 + 2;
  page.drawText('EMISIÓN',  { x: LEFT, y: cy, size: 4.5, font: bold, color: GUINDA });
  page.drawText('VIGENCIA', { x: COL2,  y: cy, size: 4.5, font: bold, color: GUINDA });
  cy -= 9;
  page.drawText(emision,  { x: LEFT, y: cy, size: 7.5, font: regular, color: NEGRO });
  page.drawText(vigencia, { x: COL2,  y: cy, size: 7.5, font: regular, color: NEGRO });

  // Pie guinda
  page.drawRectangle({ x: 0, y: 0, width: CARD_W, height: 11, color: GUINDA2 });
  page.drawText(`FOLIO: ${est.licenciaDigital}`, { x: 9, y: 3.5, size: 5, font: bold, color: BLANCO });
  page.drawText('edumich.michoacan.gob.mx', { x: CARD_W - 85, y: 3.5, size: 5, font: regular, color: rgb(0.918, 0.702, 0.773) });

  const pdfBytes = await doc.save();

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="credencial-digital-preparatoria-abierta.pdf"');
  res.send(Buffer.from(pdfBytes));
});

// ─── GET /estudiante/config-pago ─────────────────────────────────────────
// Devuelve datos bancarios activos y costo del examen para el flujo de pago
// del estudiante (mismo origen que gestor/config-pago).
router.get('/config-pago', async (_req, res) => {
  try {
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

    res.json({
      costoExamen,
      datosBancarios: banco
        ? {
            banco: banco.banco,
            titular: banco.titular,
            clabe: banco.clabe,
            numeroCuenta: banco.numeroCuenta ?? null,
            rfc: banco.rfc ?? null,
            convenio: banco.convenio ?? null,
          }
        : null,
    });
  } catch {
    res.status(500).json({ error: 'Error al obtener configuración de pago' });
  }
});

export default router;
