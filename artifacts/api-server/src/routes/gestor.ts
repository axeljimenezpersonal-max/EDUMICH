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
  pagosExamen,
  pagosExamenInscripciones,
  convocatoriasEtapas,
  convocatoriasModulosHorarios,
  sedes,
  pagos,
  pagosGrupales,
  pagosGrupalesExamenes,
  datosBancarios,
  conceptosPago,
} from '@workspace/db/schema';
import { authRequired, requireRol } from '../middleware/auth';
import { sendBienvenidaCredenciales } from '../services/email';
import { generarPasswordTemporal } from '../utils/password';
import { generarFolioPreregistro, agregarDiasHabiles } from '../utils/folio';
import { generarFichaPreregistro, generarFichaRegistro, generarFichaPago, type MetodoPagoFicha } from '../services/pdf';
import {
  obtenerDatosCedula,
  guardarDatosCedula,
  generarCedulaPdf,
  dispositionCedula,
  cedulaDatosSchema,
} from '../services/cedula';
import { generarCredencialPdf, obtenerDatosCredencial } from '../services/credencialPdf';
import { rutaFotoAprobada } from '../utils/fotoExpediente';
import { tryAuditLog } from '../utils/audit';
import { validarEdad } from '../utils/edad';
import { notificar, notificarATodosLosAdmins } from '../utils/notificar';
import { armarNombreCompleto, armarDireccion } from '../utils/estudianteDatos';
import { generarFichaPagoGrupal } from '../services/fichaPagoGrupal';
import { nombreArchivoUtf8 } from '../utils/archivo';

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

  // Documentos del EXPEDIENTE en revisión (fuente de verdad), no la tabla legacy.
  const docsPendientes = await db
    .select({ c: count() })
    .from(expedienteDocumentos)
    .innerJoin(estudiantes, eq(estudiantes.userId, expedienteDocumentos.estudianteId))
    .where(
      and(
        eq(estudiantes.gestorId, userId),
        eq(expedienteDocumentos.estado, 'pendiente_revision')
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

      // Documentos del EXPEDIENTE: obligatorios aprobados (0-5) + opcionales faltantes
      const OBLIG_LISTA = ['curp', 'acta_nacimiento', 'ine', 'comprobante_domicilio', 'certificado_secundaria'];
      const OPCIONALES_LISTA = ['foto'];
      const docsRows = await db
        .select({ tipo: expedienteDocumentos.tipo, estado: expedienteDocumentos.estado })
        .from(expedienteDocumentos)
        .where(eq(expedienteDocumentos.estudianteId, r.userId));
      const obligAprobados = new Set(
        docsRows.filter((d) => d.estado === 'aprobado' && OBLIG_LISTA.includes(d.tipo)).map((d) => d.tipo)
      ).size;
      const obligRechazados = docsRows.filter((d) => d.estado === 'rechazado' && OBLIG_LISTA.includes(d.tipo)).length;
      const opcSubidos = new Set(docsRows.filter((d) => OPCIONALES_LISTA.includes(d.tipo)).map((d) => d.tipo)).size;

      // Inscripción a examen (módulos) y pago conciliado, para el estado de proceso.
      const examRes = await db.execute<{ inscritos: number; pagados: number }>(sql`
        SELECT
          (SELECT count(*) FROM examenes_inscripciones ei WHERE ei.estudiante_id = ${r.userId})::int AS inscritos,
          (SELECT count(*) FROM examenes_inscripciones ei
             JOIN pagos_examen_inscripciones pei ON pei.examen_inscripcion_id = ei.id
             JOIN pagos_examen pe ON pe.id = pei.pago_examen_id
             WHERE ei.estudiante_id = ${r.userId} AND pe.estado = 'pagado')::int AS pagados
      `);
      const examInscritos = Number((examRes.rows[0] as { inscritos?: number } | undefined)?.inscritos ?? 0);
      const examPagados = Number((examRes.rows[0] as { pagados?: number } | undefined)?.pagados ?? 0);

      // Pipeline del alumno (por prioridad). "Al corriente" solo si TODOS los
      // módulos inscritos están pagados.
      const modulosPorPagar = Math.max(examInscritos - examPagados, 0);
      let estadoProceso: string;
      if (obligRechazados > 0) estadoProceso = 'documento_rechazado';
      else if (obligAprobados < OBLIG_LISTA.length) estadoProceso = 'faltan_documentos';
      else if (examInscritos === 0) estadoProceso = 'listo_inscribir';
      else if (modulosPorPagar > 0) estadoProceso = 'pago_pendiente';
      else estadoProceso = 'al_corriente';

      return {
        ...r,
        inscripcion: insc ?? null,
        obligAprobados,
        obligRechazados,
        obligTotal: OBLIG_LISTA.length,
        opcionalesFaltantes: OPCIONALES_LISTA.length - opcSubidos,
        estadoProceso,
        modulosPorPagar,
        modulosInscritos: examInscritos,
      };
    })
  );

  res.json({ alumnos: alumnosConDetalle });
});

// ─── POST /gestor/alumnos ────────────────────────────────────────────
const crearAlumnoSchema = z.object({
  // nombreCompleto sigue aceptándose (compat) pero si vienen las partes se deriva
  nombreCompleto: z.string().min(3).max(200).optional(),
  nombres: z.string().max(120).optional(),
  apellidoPaterno: z.string().max(100).optional(),
  apellidoMaterno: z.string().max(100).optional(),
  curp: z.string().length(18),
  email: z.string().email(),
  telefono: z.string().min(7).max(30).optional(),
  fechaNacimiento: z.string().optional(),
  sexo: z.string().max(20).optional(),
  lugarNacimiento: z.string().max(120).optional(),
  entidadNacimiento: z.string().max(80).optional(),
  estadoCivil: z.string().max(30).optional(),
  ultimoEstudio: z.string().max(120).optional(),
  direccion: z.string().optional(),
  calleNumero: z.string().max(200).optional(),
  colonia: z.string().max(120).optional(),
  cp: z.string().max(10).optional(),
  ciudad: z.string().max(120).optional(),
  estadoDomicilio: z.string().max(80).optional(),
  convocatoriaId: z.number().int().positive(),
}).refine((d) => (d.nombreCompleto && d.nombreCompleto.trim()) || (d.nombres && d.apellidoPaterno), {
  message: 'Falta el nombre del alumno (nombres y apellido paterno)',
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

  if (data.fechaNacimiento) {
    const errEdad = validarEdad(data.fechaNacimiento);
    if (errEdad) { res.status(400).json({ error: errEdad, campo: 'fechaNacimiento' }); return; }
  }

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
    nombreCompleto: armarNombreCompleto(data) || data.nombreCompleto || '',
    nombres: data.nombres,
    apellidoPaterno: data.apellidoPaterno,
    apellidoMaterno: data.apellidoMaterno,
    curp: data.curp.toUpperCase(),
    fechaNacimiento: data.fechaNacimiento,
    sexo: data.sexo,
    lugarNacimiento: data.lugarNacimiento,
    entidadNacimiento: data.entidadNacimiento,
    estadoCivil: data.estadoCivil,
    ultimoEstudio: data.ultimoEstudio,
    telefono: data.telefono,
    direccion: armarDireccion(data) || data.direccion,
    calleNumero: data.calleNumero,
    colonia: data.colonia,
    cp: data.cp,
    ciudad: data.ciudad,
    estadoDomicilio: data.estadoDomicilio,
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
      nombreAlumno: armarNombreCompleto(data) || data.nombreCompleto || '',
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
    { name: 'doc_certificado', maxCount: 1 },
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
    const docCertificado = files?.['doc_certificado']?.[0];

    const allFiles = [docCurp, docActa, docIne, docDomicilio, docCertificado].filter(Boolean) as Express.Multer.File[];

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
          nombreCompleto: armarNombreCompleto(data) || data.nombreCompleto || '',
          nombres: data.nombres,
          apellidoPaterno: data.apellidoPaterno,
          apellidoMaterno: data.apellidoMaterno,
          curp: data.curp.toUpperCase(),
          fechaNacimiento: data.fechaNacimiento,
          sexo: data.sexo,
          lugarNacimiento: data.lugarNacimiento,
          entidadNacimiento: data.entidadNacimiento,
          estadoCivil: data.estadoCivil,
          ultimoEstudio: data.ultimoEstudio,
          telefono: data.telefono,
          direccion: armarDireccion(data) || data.direccion,
          calleNumero: data.calleNumero,
          colonia: data.colonia,
          cp: data.cp,
          ciudad: data.ciudad,
          estadoDomicilio: data.estadoDomicilio,
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
          { file: docCertificado, tipo: 'certificado', nombre: 'Certificado de secundaria' },
        ].filter((d): d is { file: Express.Multer.File; tipo: string; nombre: string } => d.file != null);
        const docsInserted = [];
        for (const def of docDefs) {
          const [doc] = await tx
            .insert(documentos)
            .values({
              inscripcionId: insc.id,
              nombre: def.nombre,
              archivoOriginal: nombreArchivoUtf8(def.file.originalname),
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
          nombreAlumno: armarNombreCompleto(data) || data.nombreCompleto || '',
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

  // Documentos del EXPEDIENTE (fuente de verdad): obligatorios aprobados 0-5.
  const OBLIG_LISTA = ['curp', 'acta_nacimiento', 'ine', 'comprobante_domicilio', 'certificado_secundaria'];
  const result = [];
  for (const r of rows) {
    const docsRows = await db
      .select({ tipo: expedienteDocumentos.tipo, estado: expedienteDocumentos.estado })
      .from(expedienteDocumentos)
      .where(eq(expedienteDocumentos.estudianteId, r.userId));
    const obligAprobados = new Set(
      docsRows.filter((d) => d.estado === 'aprobado' && OBLIG_LISTA.includes(d.tipo)).map((d) => d.tipo)
    ).size;

    if (obligAprobados < OBLIG_LISTA.length) {
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
        docsAprobados: obligAprobados,
        docsTotal: OBLIG_LISTA.length,
        docsFaltantes: OBLIG_LISTA.length - obligAprobados,
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
    .where(and(eq(estudiantes.userId, alumnoId), eq(estudiantes.gestorId, userId)));

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
      archivoOriginal: nombreArchivoUtf8(file.originalname),
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
// GET /gestor/calificaciones
// Todas las calificaciones (exámenes) de los alumnos del gestor, en forma
// tabular. El frontend filtra / agrupa / exporta a Excel del lado del cliente
// (el volumen por municipio es pequeño), lo que da filtrado instantáneo.
// ─────────────────────────────────────────────────────────────────────────
router.get('/calificaciones', async (req, res) => {
  try {
    const userId = req.user!.userId;

    const rows = await db
      .select({
        inscripcionId: examenesInscripciones.id,
        estudianteId: examenesInscripciones.estudianteId,
        alumno: estudiantes.nombreCompleto,
        curp: estudiantes.curp,
        etapaId: examenesInscripciones.etapaId,
        etapaClave: convocatoriasEtapas.clave,
        etapaEtapa: convocatoriasEtapas.etapa,
        etapaFase: convocatoriasEtapas.fase,
        etapaAnio: convocatoriasEtapas.anio,
        etapaExamenSabado: convocatoriasEtapas.examenSabado,
        moduloId: examenesInscripciones.moduloId,
        moduloNumero: modulos.numero,
        moduloNombre: modulos.nombre,
        folio: examenesInscripciones.folio,
        estadoExamen: examenesInscripciones.estado,
        calificacion: examenesInscripciones.calificacion,
        paseValidadoEn: examenesInscripciones.paseValidadoEn,
      })
      .from(examenesInscripciones)
      .innerJoin(estudiantes, eq(examenesInscripciones.estudianteId, estudiantes.userId))
      .innerJoin(convocatoriasEtapas, eq(examenesInscripciones.etapaId, convocatoriasEtapas.id))
      .innerJoin(modulos, eq(examenesInscripciones.moduloId, modulos.id))
      .where(and(
        eq(estudiantes.gestorId, userId),
        // Solo exámenes con pago verificado (o ya resueltos): lo no pagado
        // no entra al flujo de calificación.
        sql`(EXISTS (
          SELECT 1 FROM pagos_examen_inscripciones pei
          JOIN pagos_examen pe ON pe.id = pei.pago_examen_id
          WHERE pei.examen_inscripcion_id = ${examenesInscripciones.id} AND pe.estado = 'pagado'
        ) OR ${examenesInscripciones.calificacion} IS NOT NULL
          OR ${examenesInscripciones.estado} IN ('aprobado', 'reprobado', 'no_presento'))`
      ))
      .orderBy(estudiantes.nombreCompleto, modulos.numero);

    res.json({ calificaciones: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno';
    res.status(500).json({ error: message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// GET /gestor/evaluaciones
// Evaluaciones de práctica (quizzes de módulo en la plataforma) de los
// alumnos del gestor. Complementa /gestor/calificaciones (exámenes oficiales).
// ─────────────────────────────────────────────────────────────────────────
router.get('/evaluaciones', async (req, res) => {
  try {
    const userId = req.user!.userId;
    type Row = {
      estudiante_id: number; alumno: string | null; curp: string | null;
      modulo_numero: number; modulo_nombre: string; estado: string;
      intentos_quiz: number; mejor_calificacion: number | null;
      ultima_calificacion: number | null; ultima_actividad: Date | null;
    };
    const result = await db.execute<Row>(sql`
      SELECT emp.estudiante_id, es.nombre_completo AS alumno, es.curp,
             m.numero AS modulo_numero, m.nombre AS modulo_nombre,
             emp.estado, emp.intentos_quiz, emp.mejor_calificacion,
             emp.ultima_calificacion, emp.ultima_actividad
      FROM estudiantes_modulos_progreso emp
      JOIN estudiantes es ON es.user_id = emp.estudiante_id
      JOIN modulos m ON m.id = emp.modulo_id
      WHERE es.gestor_id = ${userId}
      ORDER BY es.nombre_completo, m.numero
    `);
    res.json({
      evaluaciones: result.rows.map((r) => ({
        estudianteId: r.estudiante_id,
        alumno: r.alumno,
        curp: r.curp,
        moduloNumero: r.modulo_numero,
        moduloNombre: r.modulo_nombre,
        estado: r.estado,
        intentos: Number(r.intentos_quiz ?? 0),
        mejorCalificacion: r.mejor_calificacion,
        ultimaCalificacion: r.ultima_calificacion,
        ultimaActividad: r.ultima_actividad,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno';
    res.status(500).json({ error: message });
  }
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
  'certificado_secundaria', 'foto',
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
        nombreOriginal: nombreArchivoUtf8(req.file.originalname),
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
          nombreOriginal: nombreArchivoUtf8(req.file.originalname),
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

  const mime = doc.rutaArchivo.match(/\.(jpe?g)$/i)
    ? 'image/jpeg'
    : doc.rutaArchivo.match(/\.png$/i)
    ? 'image/png'
    : 'application/pdf';
  const ext = mime === 'image/jpeg' ? 'jpg' : mime === 'image/png' ? 'png' : 'pdf';

  // Nombre definido por nosotros: <Tipo>_<matrícula o folio>.<ext>
  const TIPO_ARCHIVO: Record<string, string> = {
    curp: 'CURP', acta_nacimiento: 'Acta-de-nacimiento', ine: 'Identificacion-oficial',
    comprobante_domicilio: 'Comprobante-de-domicilio', certificado_secundaria: 'Certificado-de-secundaria', foto: 'Fotografia',
  };
  const [est] = await db
    .select({ folio: estudiantes.folioPreregistro, matricula: estudiantes.matriculaOficialDGB })
    .from(estudiantes).where(eq(estudiantes.userId, alumnoId));
  const idInterno = est?.matricula || est?.folio || `alumno-${alumnoId}`;
  const safe = `${TIPO_ARCHIVO[tipo] ?? tipo}_${idInterno}.${ext}`.replace(/[^a-zA-Z0-9_\-.]/g, '');

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

// ─── Cédula de inscripción (gestor) ──────────────────────────────────

// GET /gestor/alumnos/:id/cedula — datos consolidados
router.get('/alumnos/:id/cedula', async (req, res) => {
  const alumnoId = Number(req.params.id as string);
  if (!alumnoId) { res.status(400).json({ error: 'ID inválido' }); return; }
  const alumno = await verificarAlumnoDelGestor(req.user!.userId, alumnoId);
  if (!alumno) { res.status(404).json({ error: 'Alumno no encontrado' }); return; }
  res.json(await obtenerDatosCedula(alumnoId));
});

// PATCH /gestor/alumnos/:id/cedula — el gestor también puede completar datos
router.patch('/alumnos/:id/cedula', async (req, res) => {
  const alumnoId = Number(req.params.id as string);
  if (!alumnoId) { res.status(400).json({ error: 'ID inválido' }); return; }
  const alumno = await verificarAlumnoDelGestor(req.user!.userId, alumnoId);
  if (!alumno) { res.status(404).json({ error: 'Alumno no encontrado' }); return; }
  const parse = cedulaDatosSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }
  await guardarDatosCedula(alumnoId, parse.data);
  res.json({ ok: true });
});

// GET /gestor/alumnos/:id/cedula/pdf — cédula rellenada (incluye firma del gestor responsable)
router.get('/alumnos/:id/cedula/pdf', async (req, res) => {
  const alumnoId = Number(req.params.id as string);
  if (!alumnoId) { res.status(400).json({ error: 'ID inválido' }); return; }
  const alumno = await verificarAlumnoDelGestor(req.user!.userId, alumnoId);
  if (!alumno) { res.status(404).json({ error: 'Alumno no encontrado' }); return; }
  try {
    const { pdf, nombreArchivo } = await generarCedulaPdf(alumnoId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', dispositionCedula(nombreArchivo));
    res.send(Buffer.from(pdf));
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'No se pudo generar la cédula' });
  }
});

// GET /gestor/alumnos/:id/credencial/pdf — carnet de la credencial digital
// DELETE /gestor/alumnos/:id/examenes/:inscId — quitar un módulo inscrito (si no está pagado)
router.delete('/alumnos/:id/examenes/:inscId', async (req, res) => {
  const alumnoId = Number(req.params.id as string);
  const inscId = Number(req.params.inscId as string);
  if (!alumnoId || !inscId) { res.status(400).json({ error: 'Parámetros inválidos' }); return; }
  const alumno = await verificarAlumnoDelGestor(req.user!.userId, alumnoId);
  if (!alumno) { res.status(404).json({ error: 'Alumno no encontrado' }); return; }

  const [insc] = await db
    .select({ id: examenesInscripciones.id, estado: examenesInscripciones.estado })
    .from(examenesInscripciones)
    .where(and(eq(examenesInscripciones.id, inscId), eq(examenesInscripciones.estudianteId, alumnoId)));
  if (!insc) { res.status(404).json({ error: 'Inscripción no encontrada' }); return; }
  if (insc.estado === 'presentado') { res.status(409).json({ error: 'No se puede quitar: el examen ya se presentó.' }); return; }

  // Órdenes de pago ligadas a esta inscripción.
  const linked = await db.execute<{ id: number; estado: string }>(sql`
    SELECT pe.id, pe.estado FROM pagos_examen pe
    JOIN pagos_examen_inscripciones pei ON pei.pago_examen_id = pe.id
    WHERE pei.examen_inscripcion_id = ${inscId}`);
  // Una vez que el módulo tiene una orden de pago (en cualquier estado activo),
  // ya no se puede quitar desde aquí: primero hay que cancelar la orden.
  if (linked.rows.length > 0) {
    res.status(409).json({ error: 'No se puede quitar: el módulo ya tiene una orden de pago. Cancela la orden primero.' });
    return;
  }

  try {
    await db.delete(examenesInscripciones).where(eq(examenesInscripciones.id, inscId));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'No se pudo quitar el módulo' });
  }
});

router.get('/alumnos/:id/credencial/pdf', async (req, res) => {
  const alumnoId = Number(req.params.id as string);
  if (!alumnoId) { res.status(400).json({ error: 'ID inválido' }); return; }
  const alumno = await verificarAlumnoDelGestor(req.user!.userId, alumnoId);
  if (!alumno) { res.status(404).json({ error: 'Alumno no encontrado' }); return; }
  try {
    const cred = await generarCredencialPdf(alumnoId);
    if (!cred) { res.status(409).json({ error: 'El alumno aún no tiene credencial digital emitida.' }); return; }
    const nombre = `${cred.folio.replace(/[^a-zA-Z0-9_\-.]/g, '')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${nombre}"`);
    res.send(Buffer.from(cred.pdf));
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'No se pudo generar la credencial' });
  }
});

// GET /gestor/alumnos/:id/credencial — datos de la credencial (preview)
router.get('/alumnos/:id/credencial', async (req, res) => {
  const alumnoId = Number(req.params.id as string);
  if (!alumnoId) { res.status(400).json({ error: 'ID inválido' }); return; }
  const alumno = await verificarAlumnoDelGestor(req.user!.userId, alumnoId);
  if (!alumno) { res.status(404).json({ error: 'Alumno no encontrado' }); return; }
  const data = await obtenerDatosCredencial(alumnoId);
  if (!data) { res.json({ emitida: false }); return; }
  res.json({ emitida: true, ...data, fotoUrl: data.tieneFoto ? `/api/gestor/alumnos/${alumnoId}/expediente/documento/foto/preview` : null });
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
    fotoPath: await rutaFotoAprobada(est.userId),
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

  // Estado de pago por examen (vía orden de pago Tesorería): pagado / en_pago / sin_pagar
  const examIds = inscripcionesActivas.map((i) => i.id);
  const pagoInfoRows = examIds.length > 0
    ? await db
        .select({
          examenId: pagosExamenInscripciones.examenInscripcionId,
          folio: pagosExamen.folio,
          estado: pagosExamen.estado,
        })
        .from(pagosExamenInscripciones)
        .innerJoin(pagosExamen, eq(pagosExamen.id, pagosExamenInscripciones.pagoExamenId))
        .where(and(inArray(pagosExamenInscripciones.examenInscripcionId, examIds), ne(pagosExamen.estado, 'cancelado')))
    : [];
  const pagoByExamen = new Map(pagoInfoRows.map((p) => [p.examenId, p]));

  const inscripcionesActivasEnriquecidas = inscripcionesActivas.map((i) => {
    const mod = modulosById.get(i.moduloId);
    const hor = horariosEnriquecidosById.get(i.horarioId);
    const sed = sedesById.get(i.sedeId);
    const fechaExamen = hor?.dia === 'sabado' ? etapa.examenSabado : etapa.examenDomingo;
    const pg = pagoByExamen.get(i.id);
    const pagoEstado: 'pagado' | 'en_pago' | 'sin_pagar' = pg
      ? pg.estado === 'pagado' ? 'pagado' : 'en_pago'
      : 'sin_pagar';
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
      pagoEstado,
      pagoFolio: pg?.folio ?? null,
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

  // 1.b Gating: expediente aprobado (5 obligatorios) + matrícula oficial
  if (!alumno.matriculaOficialDGB) {
    res.status(400).json({ error: 'El alumno aún no tiene matrícula oficial registrada. La asigna la administración cuando la Secretaría valida el expediente.' });
    return;
  }
  const OBLIG_INSCRIBIR = ['curp', 'acta_nacimiento', 'ine', 'comprobante_domicilio', 'certificado_secundaria'];
  const aprobadosRows = await db
    .select({ tipo: expedienteDocumentos.tipo })
    .from(expedienteDocumentos)
    .where(and(eq(expedienteDocumentos.estudianteId, alumnoId), eq(expedienteDocumentos.estado, 'aprobado')));
  const aprobadosOblig = new Set(aprobadosRows.map((r) => r.tipo).filter((t) => OBLIG_INSCRIBIR.includes(t)));
  if (aprobadosOblig.size < OBLIG_INSCRIBIR.length) {
    res.status(400).json({ error: 'El expediente del alumno no está completo y aprobado (5 documentos obligatorios).' });
    return;
  }

  // 2. Validate etapa exists (don't require inscripcion_abierta)
  const [etapa] = await db
    .select({
      id: convocatoriasEtapas.id,
      clave: convocatoriasEtapas.clave,
      estado: convocatoriasEtapas.estado,
      solicitudFin: convocatoriasEtapas.solicitudFin,
      examenSabado: convocatoriasEtapas.examenSabado,
      examenDomingo: convocatoriasEtapas.examenDomingo,
    })
    .from(convocatoriasEtapas)
    .where(eq(convocatoriasEtapas.id, etapaId));
  if (!etapa) { res.status(404).json({ error: 'Etapa no encontrada' }); return; }

  // 2.b. No se puede inscribir a una etapa cuyo período ya cerró (o cuyo examen
  // ya pasó). El gestor puede inscribir fuera del estado 'abierta', pero NUNCA
  // después de la fecha límite de solicitud.
  const hoyStr = new Date().toISOString().slice(0, 10);
  const cierre = etapa.solicitudFin ? String(etapa.solicitudFin) : null;
  const examen = etapa.examenSabado ? String(etapa.examenSabado) : null;
  if ((cierre && cierre < hoyStr) || (examen && examen < hoyStr)) {
    const fmt = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
    res.status(400).json({
      error: `El período de inscripción de la etapa ${etapa.clave} ya cerró${cierre ? ` (venció el ${fmt(cierre)})` : ''}. No se puede inscribir a una convocatoria pasada.`,
    });
    return;
  }

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
    titular: config.banco?.titular ?? 'IEMSyS — Preparatoria Abierta Michoacán',
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

// ═════════════════════════════════════════════════════════════════════════
// PAGOS GRUPALES — el gestor paga N exámenes de golpe ante la Tesorería del
// Estado y sube UN comprobante; el admin verifica y todos quedan cubiertos.
// ═════════════════════════════════════════════════════════════════════════

const PAGOS_GRUPALES_DIR = process.env.STORAGE_DIR
  ? path.join(process.env.STORAGE_DIR, 'pagos-grupales')
  : path.join(process.cwd(), 'storage', 'pagos-grupales');

const uploadComprobanteGrupal = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      await fs.mkdir(PAGOS_GRUPALES_DIR, { recursive: true });
      cb(null, PAGOS_GRUPALES_DIR);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.pdf';
      cb(null, `pg-${req.params.id}-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowed.includes(file.mimetype)) { cb(new Error('Solo PDF, JPG o PNG')); return; }
    cb(null, true);
  },
});

const MIME_POR_EXT: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};

async function pagoGrupalDelGestor(gestorId: number, id: number) {
  const [pg] = await db
    .select()
    .from(pagosGrupales)
    .where(and(eq(pagosGrupales.id, id), eq(pagosGrupales.gestorId, gestorId)));
  return pg ?? null;
}

// ─── GET /gestor/pagos-grupales — mis pagos grupales ──────────────────────
router.get('/pagos-grupales', async (req, res) => {
  const rows = await db
    .select()
    .from(pagosGrupales)
    .where(eq(pagosGrupales.gestorId, req.user!.userId))
    .orderBy(desc(pagosGrupales.createdAt));
  res.json({
    pagos: rows.map((r) => ({
      id: r.id,
      folio: r.folio,
      cantidadExamenes: r.cantidadExamenes,
      montoUnitario: Number(r.montoUnitario),
      montoTotal: Number(r.montoTotal),
      estado: r.estado,
      tieneComprobante: !!r.rutaComprobante,
      fechaPago: r.fechaPago,
      motivoRechazo: r.motivoRechazo,
      creadoEn: r.createdAt,
    })),
  });
});

// ─── GET /gestor/pagos-grupales/examenes-disponibles ──────────────────────
// Exámenes inscritos de MIS alumnos que aún no están cubiertos por ningún
// pago (ni grupal activo ni individual vigente del alumno).
router.get('/pagos-grupales/examenes-disponibles', async (req, res) => {
  const gestorId = req.user!.userId;
  const { costoExamen } = await getConfigPago();

  const rows = await db.execute<{
    id: number; folio: string; estudiante_id: number; alumno: string;
    modulo_id: number; modulo_numero: number; modulo_nombre: string;
  }>(sql`
    SELECT ei.id, ei.folio, ei.estudiante_id, e.nombre_completo AS alumno,
           m.id AS modulo_id, m.numero AS modulo_numero, m.nombre AS modulo_nombre
    FROM examenes_inscripciones ei
    JOIN estudiantes e ON e.user_id = ei.estudiante_id
    JOIN modulos m ON m.id = ei.modulo_id
    WHERE e.gestor_id = ${gestorId}
      AND ei.estado = 'inscrito'
      AND NOT EXISTS (
        SELECT 1 FROM pagos_grupales_examenes pge
        JOIN pagos_grupales pg ON pg.id = pge.pago_grupal_id
        WHERE pge.examen_inscripcion_id = ei.id AND pg.estado != 'rechazado'
      )
      AND NOT EXISTS (
        SELECT 1 FROM pagos p
        WHERE p.estudiante_id = ei.estudiante_id
          AND p.concepto = 'derecho_examen' AND p.estado != 'rechazado'
      )
    ORDER BY m.numero, e.nombre_completo
  `);

  res.json({
    costoExamen,
    examenes: rows.rows.map((r) => ({
      id: Number(r.id),
      folio: r.folio,
      estudianteId: Number(r.estudiante_id),
      alumno: r.alumno,
      moduloId: Number(r.modulo_id),
      moduloNumero: Number(r.modulo_numero),
      moduloNombre: r.modulo_nombre,
    })),
  });
});

// ─── POST /gestor/pagos-grupales — crear (genera folio de referencia) ─────
const crearPagoGrupalSchema = z.object({
  examenIds: z.array(z.number().int().positive()).min(1).max(500),
});

router.post('/pagos-grupales', async (req, res) => {
  const gestorId = req.user!.userId;
  const parse = crearPagoGrupalSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: 'Selecciona al menos un examen' }); return; }
  const examenIds = [...new Set(parse.data.examenIds)];

  // Validar que todos los exámenes sean elegibles (mismos criterios que la lista)
  const validos = await db.execute<{ id: number; estudiante_id: number }>(sql`
    SELECT ei.id, ei.estudiante_id
    FROM examenes_inscripciones ei
    JOIN estudiantes e ON e.user_id = ei.estudiante_id
    WHERE ei.id IN (${sql.join(examenIds.map((i) => sql`${i}`), sql`, `)})
      AND e.gestor_id = ${gestorId}
      AND ei.estado = 'inscrito'
      AND NOT EXISTS (
        SELECT 1 FROM pagos_grupales_examenes pge
        JOIN pagos_grupales pg ON pg.id = pge.pago_grupal_id
        WHERE pge.examen_inscripcion_id = ei.id AND pg.estado != 'rechazado'
      )
  `);
  if (validos.rows.length !== examenIds.length) {
    res.status(409).json({ error: 'Algún examen ya está cubierto por otro pago o no es elegible. Actualiza la lista.' });
    return;
  }

  const { costoExamen } = await getConfigPago();
  const total = costoExamen * examenIds.length;

  const creado = await db.transaction(async (tx) => {
    const [pg] = await tx
      .insert(pagosGrupales)
      .values({
        folio: `PG-TMP-${Date.now()}-${gestorId}`,
        gestorId,
        cantidadExamenes: examenIds.length,
        montoUnitario: String(costoExamen),
        montoTotal: String(total),
      })
      .returning();

    const anio = new Date().getFullYear();
    const folio = `PG-${anio}-G${gestorId}-${String(pg.id).padStart(4, '0')}`;
    await tx.update(pagosGrupales).set({ folio }).where(eq(pagosGrupales.id, pg.id));

    await tx.insert(pagosGrupalesExamenes).values(
      validos.rows.map((v) => ({
        pagoGrupalId: pg.id,
        estudianteId: Number(v.estudiante_id),
        examenInscripcionId: Number(v.id),
        monto: String(costoExamen),
      }))
    );
    return { id: pg.id, folio };
  });

  await tryAuditLog({
    userId: gestorId,
    accion: 'crear_pago_grupal',
    entidad: 'pagos_grupales',
    entidadId: creado.id,
    detalle: `Creó pago grupal ${creado.folio}: ${examenIds.length} exámenes por $${total}`,
    metadata: { examenIds, total },
    req,
  });

  res.status(201).json({ ok: true, id: creado.id, folio: creado.folio, montoTotal: total });
});

// ─── GET /gestor/pagos-grupales/:id — detalle con exámenes ────────────────
router.get('/pagos-grupales/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: 'ID inválido' }); return; }
  const pg = await pagoGrupalDelGestor(req.user!.userId, id);
  if (!pg) { res.status(404).json({ error: 'Pago no encontrado' }); return; }

  const items = await db
    .select({
      alumno: estudiantes.nombreCompleto,
      folioExamen: examenesInscripciones.folio,
      moduloNumero: modulos.numero,
      moduloNombre: modulos.nombre,
      monto: pagosGrupalesExamenes.monto,
    })
    .from(pagosGrupalesExamenes)
    .leftJoin(estudiantes, eq(pagosGrupalesExamenes.estudianteId, estudiantes.userId))
    .leftJoin(examenesInscripciones, eq(pagosGrupalesExamenes.examenInscripcionId, examenesInscripciones.id))
    .leftJoin(modulos, eq(examenesInscripciones.moduloId, modulos.id))
    .where(eq(pagosGrupalesExamenes.pagoGrupalId, id));

  res.json({
    id: pg.id,
    folio: pg.folio,
    estado: pg.estado,
    cantidadExamenes: pg.cantidadExamenes,
    montoUnitario: Number(pg.montoUnitario),
    montoTotal: Number(pg.montoTotal),
    tieneComprobante: !!pg.rutaComprobante,
    fechaPago: pg.fechaPago,
    motivoRechazo: pg.motivoRechazo,
    creadoEn: pg.createdAt,
    examenes: items.map((i) => ({ ...i, monto: Number(i.monto) })),
  });
});

// ─── GET /gestor/pagos-grupales/:id/ficha — ficha de depósito PDF ─────────
router.get('/pagos-grupales/:id/ficha', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: 'ID inválido' }); return; }
  const pg = await pagoGrupalDelGestor(req.user!.userId, id);
  if (!pg) { res.status(404).json({ error: 'Pago no encontrado' }); return; }
  const { pdf, nombreArchivo } = await generarFichaPagoGrupal(id);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${nombreArchivo.replace(/[^\x20-\x7E]/g, '')}"`);
  res.send(Buffer.from(pdf));
});

// ─── POST /gestor/pagos-grupales/:id/comprobante — subir comprobante ──────
router.post('/pagos-grupales/:id/comprobante', uploadComprobanteGrupal.single('comprobante'), async (req, res) => {
  const gestorId = req.user!.userId;
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: 'ID inválido' }); return; }
  const pg = await pagoGrupalDelGestor(gestorId, id);
  if (!pg) { res.status(404).json({ error: 'Pago no encontrado' }); return; }
  if (pg.estado === 'verificado') { res.status(400).json({ error: 'Este pago ya fue verificado' }); return; }
  if (!req.file) { res.status(400).json({ error: 'No se recibió archivo' }); return; }

  const fechaPago = typeof req.body.fechaPago === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.body.fechaPago)
    ? req.body.fechaPago
    : new Date().toISOString().slice(0, 10);

  await db.update(pagosGrupales)
    .set({
      rutaComprobante: req.file.path,
      nombreComprobante: nombreArchivoUtf8(req.file.originalname),
      fechaPago,
      estado: 'en_revision',
      motivoRechazo: null,
      updatedAt: new Date(),
    })
    .where(eq(pagosGrupales.id, id));

  await notificarATodosLosAdmins({
    tipo: 'pago_subido_verificar',
    prioridad: 'alta',
    titulo: 'Pago grupal por verificar',
    cuerpo: `El gestor subió comprobante del pago grupal ${pg.folio} (${pg.cantidadExamenes} exámenes, $${Number(pg.montoTotal).toLocaleString('es-MX')}).`,
    enlace: '/admin/pagos-grupales',
  });

  res.json({ ok: true });
});

// ─── GET /gestor/pagos-grupales/:id/comprobante — ver comprobante ─────────
router.get('/pagos-grupales/:id/comprobante', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: 'ID inválido' }); return; }
  const pg = await pagoGrupalDelGestor(req.user!.userId, id);
  if (!pg?.rutaComprobante || !existsSync(pg.rutaComprobante)) {
    res.status(404).json({ error: 'Sin comprobante' }); return;
  }
  const ext = path.extname(pg.rutaComprobante).toLowerCase();
  res.setHeader('Content-Type', MIME_POR_EXT[ext] ?? 'application/octet-stream');
  res.setHeader('Content-Disposition', 'inline; filename="comprobante' + ext + '"');
  createReadStream(pg.rutaComprobante).pipe(res);
});

// ─── DELETE /gestor/pagos-grupales/:id — cancelar (si no está verificado) ─
router.delete('/pagos-grupales/:id', async (req, res) => {
  const gestorId = req.user!.userId;
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: 'ID inválido' }); return; }
  const pg = await pagoGrupalDelGestor(gestorId, id);
  if (!pg) { res.status(404).json({ error: 'Pago no encontrado' }); return; }
  if (pg.estado === 'verificado') { res.status(400).json({ error: 'No se puede cancelar un pago verificado' }); return; }

  if (pg.rutaComprobante && existsSync(pg.rutaComprobante)) {
    try { await fs.unlink(pg.rutaComprobante); } catch { /* noop */ }
  }
  await db.delete(pagosGrupales).where(eq(pagosGrupales.id, id));

  await tryAuditLog({
    userId: gestorId,
    accion: 'cancelar_pago_grupal',
    entidad: 'pagos_grupales',
    entidadId: id,
    detalle: `Canceló el pago grupal ${pg.folio}`,
    req,
  });
  res.json({ ok: true });
});

export default router;
