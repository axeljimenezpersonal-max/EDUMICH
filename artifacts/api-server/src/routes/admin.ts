/**
 * Rutas del administrador — Prepa Abierta Michoacán
 *
 * POST /admin/convocatoria/pase/validar  — escaneo QR en sede
 */

import { Router } from 'express';
import { and, eq, sql, desc, gte, count, countDistinct, isNull, SQL } from 'drizzle-orm';
import crypto from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import {
  examenesInscripciones,
  estudiantes,
  modulos,
  pagos,
  calificaciones,
  estudiantesModulosProgreso,
  auditLog,
  sedes,
  users,
  solicitudesCuenta,
  gestores,
  municipios,
  inscripciones,
  convocatorias,
  expedienteDocumentos,
  administradores,
  convocatoriasEtapas,
  anuncios,
  anunciosVistos,
  outbox,
} from '@workspace/db/schema';
import { authRequired, requireRol } from '../middleware/auth';
import { sendBienvenidaCredenciales, sendBienvenidaGestor } from '../services/email';
import { generarPasswordTemporal } from '../utils/password';
import { generarFolioPreregistro, generarFolioLicencia, agregarDiasHabiles } from '../utils/folio';
import { generarFichaPreregistro, generarFichaRegistro } from '../services/pdf';
import { tryAuditLog } from '../utils/audit';
import { armarDireccion } from '../utils/estudianteDatos';
import {
  obtenerDatosCedula,
  guardarDatosCedula,
  generarCedulaPdf,
  dispositionCedula,
  cedulaDatosSchema,
} from '../services/cedula';
import { notificar, notificarATodosLosAdmins } from '../utils/notificar';
import { QR_SECRET } from '../config/env';

const router = Router();

router.use(authRequired, requireRol('admin'));

// ─── POST /admin/convocatoria/pase/validar ────────────────────────────────
const validarPaseSchema = z.object({
  qrPayload: z.string().min(1),
});

router.post('/convocatoria/pase/validar', async (req, res) => {
  const userId = req.user!.userId;

  const parse = validarPaseSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Payload inválido' });
    return;
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(parse.data.qrPayload) as Record<string, unknown>;
  } catch {
    res.status(400).json({ error: 'QR payload malformado' });
    return;
  }

  const { sig, ...dataWithoutSig } = payload;
  if (typeof sig !== 'string') {
    res.status(400).json({ error: 'QR sin firma' });
    return;
  }

  // Verify HMAC: rebuild the original JSON without sig and check
  const json = JSON.stringify(dataWithoutSig);
  const expectedSig = crypto
    .createHmac('sha256', QR_SECRET)
    .update(json)
    .digest('hex')
    .slice(0, 16);

  if (sig !== expectedSig) {
    res.status(400).json({ error: 'Firma QR inválida' });
    return;
  }

  const folio = payload.folio as string;
  if (!folio) {
    res.status(400).json({ error: 'Folio no encontrado en QR' });
    return;
  }

  const [insc] = await db
    .select({
      id: examenesInscripciones.id,
      estado: examenesInscripciones.estado,
      estudianteId: examenesInscripciones.estudianteId,
      moduloId: examenesInscripciones.moduloId,
      estudianteNombre: estudiantes.nombreCompleto,
      estudianteCurp: estudiantes.curp,
      moduloNumero: modulos.numero,
      moduloNombre: modulos.nombre,
    })
    .from(examenesInscripciones)
    .innerJoin(estudiantes, eq(examenesInscripciones.estudianteId, estudiantes.userId))
    .innerJoin(modulos, eq(examenesInscripciones.moduloId, modulos.id))
    .where(eq(examenesInscripciones.folio, folio));

  if (!insc) {
    res.status(404).json({ error: `Folio ${folio} no encontrado` });
    return;
  }

  await db
    .update(examenesInscripciones)
    .set({
      estado: 'pase_validado',
      paseValidadoEn: new Date(),
      paseValidadoPorUserId: userId,
    })
    .where(eq(examenesInscripciones.id, insc.id));

  res.json({
    ok: true,
    folio,
    estudiante: { nombre: insc.estudianteNombre, curp: insc.estudianteCurp ?? '' },
    modulo: { numero: insc.moduloNumero, nombre: insc.moduloNombre },
  });
});

// ─── POST /admin/pagos/:pagoId/verificar ─────────────────────────────────
const verificarPagoSchema = z.object({
  aprobado: z.boolean(),
  motivoRechazo: z.string().optional(),
});

router.post('/pagos/:pagoId/verificar', async (req, res) => {
  const pagoId = Number(req.params.pagoId);
  if (!pagoId) { res.status(400).json({ error: 'ID inválido' }); return; }

  const parse = verificarPagoSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: 'Datos inválidos' }); return; }
  const { aprobado, motivoRechazo } = parse.data;

  if (!aprobado && !motivoRechazo) {
    res.status(400).json({ error: 'motivoRechazo es requerido al rechazar' }); return;
  }

  const [pago] = await db.select().from(pagos).where(eq(pagos.id, pagoId));
  if (!pago) { res.status(404).json({ error: 'Pago no encontrado' }); return; }

  await db
    .update(pagos)
    .set({
      estado: aprobado ? 'verificado' : 'rechazado',
      motivoRechazo: aprobado ? null : (motivoRechazo ?? null),
      verificadoPorUserId: req.user!.userId,
      verificadoEn: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(pagos.id, pagoId));

  await tryAuditLog({
    userId: req.user!.userId,
    accion: aprobado ? 'verificar_pago' : 'rechazar_pago',
    entidad: 'pagos',
    entidadId: pagoId,
    detalle: aprobado ? `Verificó pago ID ${pagoId}` : `Rechazó pago ID ${pagoId}`,
    metadata: { aprobado, motivoRechazo: motivoRechazo ?? null },
    req,
  });

  if (pago.estudianteId) {
    notificar({
      userId: pago.estudianteId,
      tipo: 'pago_verificado',
      prioridad: aprobado ? 'alta' : 'normal',
      titulo: aprobado ? 'Pago verificado' : 'Pago rechazado',
      cuerpo: aprobado
        ? `Tu comprobante de pago fue verificado y aprobado.`
        : `Tu comprobante de pago fue rechazado. Motivo: ${motivoRechazo ?? '—'}`,
      enlace: '/estudiante',
    });
  }

  res.json({ ok: true });
});

// ─── GET /admin/pagos/pendientes ──────────────────────────────────────────
router.get('/pagos/pendientes', async (_req, res) => {
  const rows = await db
    .select({
      id: pagos.id,
      estudianteId: pagos.estudianteId,
      concepto: pagos.concepto,
      conceptoDetalle: pagos.conceptoDetalle,
      monto: pagos.monto,
      moneda: pagos.moneda,
      fechaPago: pagos.fechaPago,
      metodoPago: pagos.metodoPago,
      referenciaBancaria: pagos.referenciaBancaria,
      nombreComprobante: pagos.nombreComprobante,
      tamanoBytes: pagos.tamanoBytes,
      estado: pagos.estado,
      createdAt: pagos.createdAt,
      nombreEstudiante: estudiantes.nombreCompleto,
      curpEstudiante: estudiantes.curp,
    })
    .from(pagos)
    .innerJoin(estudiantes, eq(pagos.estudianteId, estudiantes.userId))
    .where(eq(pagos.estado, 'pendiente'))
    .orderBy(pagos.createdAt);

  res.json({ pagos: rows });
});

// ─── GET /admin/pagos ─────────────────────────────────────────────────────
// Lista completa con datos enriquecidos: alumno, gestor, municipio, quién subió
router.get('/pagos', async (req, res) => {
  const estadoFiltro = (req.query.estado as string) || '';
  const search = (req.query.search as string) || '';
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
  const offset = (page - 1) * limit;

  // Alias para la tabla gestores usada en el join
  const gestoresAlias = gestores;
  const subidoPorUsers = users;
  const municipiosAlias = municipios;

  const where: SQL[] = [];
  if (estadoFiltro && ['pendiente', 'verificado', 'rechazado'].includes(estadoFiltro)) {
    where.push(eq(pagos.estado, estadoFiltro as 'pendiente' | 'verificado' | 'rechazado'));
  }
  if (search) {
    where.push(sql`(${estudiantes.nombreCompleto} ILIKE ${'%' + search + '%'} OR ${estudiantes.curp} ILIKE ${'%' + search + '%'})`);
  }

  const whereClause = where.length > 0 ? and(...where) : undefined;

  const rows = await db
    .select({
      id: pagos.id,
      estudianteId: pagos.estudianteId,
      alumnoNombre: estudiantes.nombreCompleto,
      alumnoCurp: estudiantes.curp,
      municipioNombre: municipiosAlias.nombre,
      gestorNombre: gestoresAlias.nombreCompleto,
      subidoPorUserId: pagos.subidoPorUserId,
      subidoPorEmail: subidoPorUsers.email,
      concepto: pagos.concepto,
      conceptoDetalle: pagos.conceptoDetalle,
      monto: pagos.monto,
      moneda: pagos.moneda,
      fechaPago: pagos.fechaPago,
      metodoPago: pagos.metodoPago,
      referenciaBancaria: pagos.referenciaBancaria,
      notas: pagos.notas,
      nombreComprobante: pagos.nombreComprobante,
      tamanoBytes: pagos.tamanoBytes,
      estado: pagos.estado,
      motivoRechazo: pagos.motivoRechazo,
      verificadoEn: pagos.verificadoEn,
      createdAt: pagos.createdAt,
    })
    .from(pagos)
    .innerJoin(estudiantes, eq(pagos.estudianteId, estudiantes.userId))
    .leftJoin(municipiosAlias, eq(estudiantes.municipioId, municipiosAlias.id))
    .leftJoin(gestoresAlias, eq(estudiantes.gestorId, gestoresAlias.userId))
    .leftJoin(subidoPorUsers, eq(pagos.subidoPorUserId, subidoPorUsers.id))
    .where(whereClause)
    .orderBy(desc(pagos.createdAt))
    .limit(limit)
    .offset(offset);

  // Determinar si fue subido por el propio alumno o por un gestor/admin
  const enriched = rows.map((r) => ({
    ...r,
    subidoPorAlumno: r.subidoPorUserId === r.estudianteId,
  }));

  // Resumen global (sin filtro de página)
  const [resumenRaw] = await db
    .select({
      pendientes: sql<number>`count(*) filter (where ${pagos.estado} = 'pendiente')`,
      verificados: sql<number>`count(*) filter (where ${pagos.estado} = 'verificado')`,
      rechazados: sql<number>`count(*) filter (where ${pagos.estado} = 'rechazado')`,
      montoVerificado: sql<string>`coalesce(sum(${pagos.monto}) filter (where ${pagos.estado} = 'verificado'), 0)`,
    })
    .from(pagos);

  const [{ totalFiltrado }] = await db
    .select({ totalFiltrado: count() })
    .from(pagos)
    .innerJoin(estudiantes, eq(pagos.estudianteId, estudiantes.userId))
    .where(whereClause);

  res.json({
    pagos: enriched,
    total: Number(totalFiltrado),
    page,
    totalPages: Math.ceil(Number(totalFiltrado) / limit),
    resumen: {
      pendientes: Number(resumenRaw.pendientes),
      verificados: Number(resumenRaw.verificados),
      rechazados: Number(resumenRaw.rechazados),
      montoVerificado: parseFloat(resumenRaw.montoVerificado),
    },
  });
});

// ─── POST /admin/estudiantes/:estudianteId/calificaciones ─────────────────
const crearCalifSchema = z.object({
  moduloId: z.number().int().positive(),
  etapaClave: z.string().min(1).max(20),
  calificacion: z.number().int().min(0).max(100),
  fechaExamen: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sedeId: z.number().int().positive().optional(),
  inscripcionExamenId: z.number().int().positive().optional(),
  intento: z.number().int().positive().optional(),
  notas: z.string().optional(),
});

router.post('/estudiantes/:estudianteId/calificaciones', async (req, res) => {
  const estudianteId = Number(req.params.estudianteId);
  if (!estudianteId) { res.status(400).json({ error: 'ID inválido' }); return; }

  const parse = crearCalifSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Datos inválidos', detalles: parse.error.issues }); return;
  }
  const data = parse.data;

  // Auto-calculate intento if not provided
  let intento = data.intento;
  if (!intento) {
    const [{ cnt }] = await db
      .select({ cnt: sql<number>`count(*)` })
      .from(calificaciones)
      .where(
        and(
          eq(calificaciones.estudianteId, estudianteId),
          eq(calificaciones.moduloId, data.moduloId)
        )
      );
    intento = Number(cnt) + 1;
  }

  const aprobado = data.calificacion >= 70;

  const [calif] = await db
    .insert(calificaciones)
    .values({
      estudianteId,
      moduloId: data.moduloId,
      inscripcionExamenId: data.inscripcionExamenId ?? null,
      etapaClave: data.etapaClave,
      calificacion: data.calificacion,
      aprobado,
      intento,
      fechaExamen: data.fechaExamen,
      sedeId: data.sedeId ?? null,
      capturadoPorUserId: req.user!.userId,
      notas: data.notas ?? null,
    })
    .returning();

  // If approved, update estudiantesModulosProgreso
  if (aprobado) {
    const existing = await db
      .select()
      .from(estudiantesModulosProgreso)
      .where(
        and(
          eq(estudiantesModulosProgreso.estudianteId, estudianteId),
          eq(estudiantesModulosProgreso.moduloId, data.moduloId)
        )
      );

    if (existing.length === 0) {
      await db.insert(estudiantesModulosProgreso).values({
        estudianteId,
        moduloId: data.moduloId,
        estado: 'aprobado',
        mejorCalificacion: data.calificacion,
        ultimaCalificacion: data.calificacion,
        ultimaActividad: new Date(),
      });
    } else {
      const current = existing[0];
      await db
        .update(estudiantesModulosProgreso)
        .set({
          estado: 'aprobado',
          mejorCalificacion: Math.max(current.mejorCalificacion ?? 0, data.calificacion),
          ultimaCalificacion: data.calificacion,
          ultimaActividad: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(estudiantesModulosProgreso.id, current.id));
    }
  }

  await tryAuditLog({
    userId: req.user!.userId,
    accion: 'capturar_calificacion',
    entidad: 'calificaciones',
    entidadId: calif.id,
    detalle: `Capturó calificación ${data.calificacion} para alumno ID ${estudianteId} en módulo ${data.moduloId}`,
    metadata: { estudianteId, moduloId: data.moduloId, calificacion: data.calificacion, aprobado },
    req,
  });

  res.status(201).json({ ok: true, calificacion: calif });
});

// ─── PATCH /admin/calificaciones/:califId ─────────────────────────────────
const patchCalifSchema = z.object({
  calificacion: z.number().int().min(0).max(100).optional(),
  etapaClave: z.string().min(1).max(20).optional(),
  fechaExamen: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notas: z.string().optional(),
});

router.patch('/calificaciones/:califId', async (req, res) => {
  const califId = Number(req.params.califId);
  if (!califId) { res.status(400).json({ error: 'ID inválido' }); return; }

  const parse = patchCalifSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: 'Datos inválidos' }); return; }

  const data = parse.data;
  const setValues: Record<string, unknown> = { updatedAt: new Date() };
  if (data.calificacion !== undefined) {
    setValues.calificacion = data.calificacion;
    setValues.aprobado = data.calificacion >= 70;
  }
  if (data.etapaClave !== undefined) setValues.etapaClave = data.etapaClave;
  if (data.fechaExamen !== undefined) setValues.fechaExamen = data.fechaExamen;
  if (data.notas !== undefined) setValues.notas = data.notas;

  await db.update(calificaciones).set(setValues).where(eq(calificaciones.id, califId));

  await tryAuditLog({
    userId: req.user!.userId,
    accion: 'editar_calificacion',
    entidad: 'calificaciones',
    entidadId: califId,
    detalle: `Editó calificación ID ${califId}`,
    metadata: data as Record<string, unknown>,
    req,
  });

  res.json({ ok: true });
});

// ─── GET /admin/estudiantes → lista para captura de calificaciones ─────────
router.get('/estudiantes', async (_req, res) => {
  const rows = await db
    .select({
      userId: estudiantes.userId,
      nombreCompleto: estudiantes.nombreCompleto,
      curp: estudiantes.curp,
      email: users.email,
    })
    .from(estudiantes)
    .innerJoin(users, eq(estudiantes.userId, users.id))
    .orderBy(estudiantes.nombreCompleto);

  res.json({ estudiantes: rows });
});

// ─── GET /admin/solicitudes-cuenta ───────────────────────────────────────
router.get('/solicitudes-cuenta', async (req, res) => {
  const estadoFilter = (req.query.estado as string) || 'pendiente';
  const rows = await db
    .select({
      id: solicitudesCuenta.id,
      nombreCompleto: solicitudesCuenta.nombreCompleto,
      curp: solicitudesCuenta.curp,
      email: solicitudesCuenta.email,
      telefono: solicitudesCuenta.telefono,
      municipioId: solicitudesCuenta.municipioId,
      municipioNombre: municipios.nombre,
      mensaje: solicitudesCuenta.mensaje,
      estado: solicitudesCuenta.estado,
      procesadaEn: solicitudesCuenta.procesadaEn,
      comentarioAdmin: solicitudesCuenta.comentarioAdmin,
      createdAt: solicitudesCuenta.createdAt,
    })
    .from(solicitudesCuenta)
    .leftJoin(municipios, eq(solicitudesCuenta.municipioId, municipios.id))
    .where(eq(solicitudesCuenta.estado, estadoFilter as 'pendiente' | 'aprobada' | 'rechazada'))
    .orderBy(solicitudesCuenta.createdAt);

  res.json({ solicitudes: rows });
});

// ─── GET /admin/solicitudes-cuenta/count ─────────────────────────────────
router.get('/solicitudes-cuenta/count', async (_req, res) => {
  const [{ cnt }] = await db
    .select({ cnt: sql<number>`count(*)` })
    .from(solicitudesCuenta)
    .where(eq(solicitudesCuenta.estado, 'pendiente'));
  res.json({ pendientes: Number(cnt) });
});

// ─── GET /admin/gestores → lista rica con métricas ───────────────────────
const VALID_SORT_GESTORES = ['nombre', 'tasa_exito', 'mas_alumnos', 'ultima_actividad'] as const;

router.get('/gestores', async (req, res) => {
  const search = ((req.query.search as string) || '').trim();
  const estadoFilter = (req.query.estado as string) || '';
  const municipioIdParam = parseInt(req.query.municipioId as string) || 0;
  const sortByParam = (req.query.sortBy as string) || 'nombre';
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(10, parseInt(req.query.limit as string) || 20));
  const offset = (page - 1) * limit;

  const sortBy = VALID_SORT_GESTORES.includes(sortByParam as typeof VALID_SORT_GESTORES[number])
    ? sortByParam : 'nombre';

  const searchSnippet = search
    ? sql`AND (g.nombre_completo ILIKE ${`%${search}%`} OR u.email ILIKE ${`%${search}%`})`
    : sql``;
  const estadoSnippet = (estadoFilter === 'activo' || estadoFilter === 'inactivo')
    ? sql`AND g.estado = ${estadoFilter}`
    : sql``;
  const municipioSnippet = municipioIdParam > 0
    ? sql`AND g.municipio_id = ${municipioIdParam}`
    : sql``;

  const sortColMap: Record<string, string> = {
    nombre: 'g.nombre_completo ASC',
    tasa_exito: 'total_alumnos_sub DESC NULLS LAST',
    mas_alumnos: 'total_alumnos_sub DESC NULLS LAST',
    ultima_actividad: 'u.ultimo_login DESC NULLS LAST',
  };
  const orderSnippet = sql.raw(sortColMap[sortBy] ?? 'g.nombre_completo ASC');

  try {
    type GestorRow = {
      user_id: number;
      nombre_completo: string;
      titulo: string | null;
      email_publico: string | null;
      telefono: string | null;
      municipio_id: number | null;
      municipio_nombre: string | null;
      estado: string;
      capacidad_maxima: number;
      email: string;
      ultimo_login: Date | null;
      total_alumnos: number;
      expedientes_completos: number;
      egresados: number;
      sin_reasignar: number | null;
    };

    const whereClause = sql`WHERE 1=1 ${searchSnippet} ${estadoSnippet} ${municipioSnippet}`;

    const [countResult, rowsResult, resumenResult] = await Promise.all([
      db.execute<{ total: string }>(sql`
        SELECT count(*)::text AS total
        FROM gestores g
        LEFT JOIN users u ON g.user_id = u.id
        ${whereClause}
      `),
      db.execute<GestorRow>(sql`
        SELECT
          g.user_id,
          g.nombre_completo,
          g.titulo,
          g.email_publico,
          g.telefono,
          g.municipio_id,
          m.nombre AS municipio_nombre,
          g.estado,
          g.capacidad_maxima,
          u.email,
          u.ultimo_login,
          (SELECT count(*) FROM estudiantes e WHERE e.gestor_id = g.user_id)::int AS total_alumnos_sub,
          (SELECT count(*) FROM estudiantes e WHERE e.gestor_id = g.user_id AND (
            SELECT count(DISTINCT tipo) FROM expediente_documentos x
            WHERE x.estudiante_id = e.user_id AND x.estado = 'aprobado'
            AND tipo IN ('curp','acta_nacimiento','ine','comprobante_domicilio','certificado_secundaria')
          ) >= 5)::int AS expedientes_completos,
          (SELECT count(*) FROM estudiantes e WHERE e.gestor_id = g.user_id AND (
            SELECT count(*) FROM estudiantes_modulos_progreso emp
            WHERE emp.estudiante_id = e.user_id AND emp.estado = 'aprobado'
          ) >= 21)::int AS egresados,
          CASE WHEN g.estado = 'inactivo' THEN
            (SELECT count(*) FROM estudiantes e WHERE e.gestor_id = g.user_id)::int
          ELSE NULL END AS sin_reasignar,
          (SELECT count(*) FROM estudiantes e WHERE e.gestor_id = g.user_id)::int AS total_alumnos
        FROM gestores g
        LEFT JOIN municipios m ON g.municipio_id = m.id
        LEFT JOIN users u ON g.user_id = u.id
        ${whereClause}
        ORDER BY ${orderSnippet}
        LIMIT ${limit} OFFSET ${offset}
      `),
      db.execute<{ total_activos: string; inactivos: string }>(sql`
        SELECT
          count(*) FILTER (WHERE estado = 'activo')::text AS total_activos,
          count(*) FILTER (WHERE estado = 'inactivo')::text AS inactivos
        FROM gestores
      `),
    ]);

    const total = Number(countResult.rows[0]?.total ?? 0);
    const r0 = resumenResult.rows[0];
    const totalActivos = Number(r0?.total_activos ?? 0);
    const inactivos = Number(r0?.inactivos ?? 0);

    const gestoresMapped = (rowsResult.rows as GestorRow[]).map((r) => {
      const partes = (r.nombre_completo ?? '').trim().split(/\s+/);
      const iniciales = partes.slice(0, 2).map((p: string) => p[0]?.toUpperCase() ?? '').join('');
      const totalAlumnos = Number(r.total_alumnos ?? 0);
      const expedientesCompletos = Number(r.expedientes_completos ?? 0);
      const egresados = Number(r.egresados ?? 0);
      const pendientes = totalAlumnos - expedientesCompletos;
      const tasaExito = totalAlumnos > 0 ? Math.round((expedientesCompletos / totalAlumnos) * 100) : 0;
      const tasaExitoNivel: 'alta' | 'media' | 'baja' = tasaExito >= 70 ? 'alta' : tasaExito >= 50 ? 'media' : 'baja';
      const ultimaActividad = r.ultimo_login ? new Date(r.ultimo_login as string | Date) : null;
      const sinReasignar = r.sin_reasignar != null ? Number(r.sin_reasignar) : null;

      return {
        id: r.user_id,
        userId: r.user_id,
        nombreCompleto: r.nombre_completo,
        iniciales,
        titulo: r.titulo ?? null,
        email: r.email,
        telefono: r.telefono ?? null,
        municipio: r.municipio_id ? { id: r.municipio_id, nombre: r.municipio_nombre ?? '' } : null,
        estado: r.estado as 'activo' | 'inactivo',
        capacidadMaxima: r.capacidad_maxima,
        metricas: {
          totalAlumnos,
          expedientesCompletos,
          pendientes,
          egresados,
          tasaExito,
          tasaExitoNivel,
        },
        ultimaActividad: ultimaActividad ? ultimaActividad.toISOString() : null,
        ultimaActividadTexto: relativaActividad(ultimaActividad),
        alertas: sinReasignar != null ? { sinReasignar } : null,
      };
    });

    // Compute summary stats from all gestores data
    const tasaExitoPromedio = gestoresMapped.length > 0
      ? Math.round(gestoresMapped.reduce((s, g) => s + g.metricas.tasaExito, 0) / gestoresMapped.length)
      : 0;
    const totalAlumnosAsignados = gestoresMapped.reduce((s, g) => s + g.metricas.totalAlumnos, 0);
    const alumnosPorGestor = totalActivos > 0 ? Math.round((totalAlumnosAsignados / totalActivos) * 10) / 10 : 0;

    res.json({
      gestores: gestoresMapped,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      resumen: {
        totalActivos,
        tasaExitoPromedio,
        alumnosPorGestor,
        inactivos,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno';
    res.status(500).json({ error: message });
  }
});

// ─── POST /admin/solicitudes-cuenta/:id/aprobar ───────────────────────────
const aprobarSolicitudSchema = z.object({
  asignarGestorId: z.number().int().positive().optional(),
  comentarioAdmin: z.string().optional(),
});

router.post('/solicitudes-cuenta/:id/aprobar', async (req, res) => {
  const solicitudId = Number(req.params.id);
  if (!solicitudId) { res.status(400).json({ error: 'ID inválido' }); return; }

  const parse = aprobarSolicitudSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: 'Datos inválidos' }); return; }
  const { asignarGestorId, comentarioAdmin } = parse.data;

  const [solicitud] = await db
    .select()
    .from(solicitudesCuenta)
    .where(eq(solicitudesCuenta.id, solicitudId));

  if (!solicitud) { res.status(404).json({ error: 'Solicitud no encontrada' }); return; }
  if (solicitud.estado !== 'pendiente') {
    res.status(400).json({ error: `La solicitud ya fue procesada (estado: ${solicitud.estado})` });
    return;
  }

  // Check email is not already taken
  const [emailExists] = await db.select().from(users).where(eq(users.email, solicitud.email));
  if (emailExists) {
    res.status(409).json({ error: 'Ya existe una cuenta con ese correo electrónico' });
    return;
  }

  const tempPassword = generarPasswordTemporal();
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  const adminId = req.user!.userId;

  // Get gestor info if assigning
  let gestorInfo: { nombre: string; telefono: string | null; municipio: string | null } | undefined;
  if (asignarGestorId) {
    const [g] = await db
      .select({ nombre: gestores.nombreCompleto, telefono: gestores.telefonoPublico, municipioId: gestores.municipioId })
      .from(gestores)
      .where(eq(gestores.userId, asignarGestorId));
    if (g) {
      const [mun] = await db.select({ nombre: municipios.nombre }).from(municipios).where(eq(municipios.id, g.municipioId));
      gestorInfo = { nombre: g.nombre, telefono: g.telefono ?? null, municipio: mun?.nombre ?? null };
    }
  }

  const folioSol = await generarFolioPreregistro();
  const ahoraSol = new Date();
  const vigenteHastaSol = agregarDiasHabiles(ahoraSol, 15);

  const newUser = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        email: solicitud.email,
        passwordHash,
        rol: 'estudiante',
        passwordTemporal: true,
        privacidadAceptadaEn: new Date(),
      })
      .returning();

    await tx.insert(estudiantes).values({
      userId: user.id,
      nombreCompleto: solicitud.nombreCompleto,
      nombres: solicitud.nombres,
      apellidoPaterno: solicitud.apellidoPaterno,
      apellidoMaterno: solicitud.apellidoMaterno,
      curp: solicitud.curp,
      fechaNacimiento: solicitud.fechaNacimiento,
      sexo: solicitud.sexo,
      lugarNacimiento: solicitud.lugarNacimiento,
      entidadNacimiento: solicitud.entidadNacimiento,
      estadoCivil: solicitud.estadoCivil,
      ultimoEstudio: solicitud.ultimoEstudio,
      telefono: solicitud.telefono,
      direccion: armarDireccion(solicitud) || null,
      calleNumero: solicitud.calleNumero,
      colonia: solicitud.colonia,
      cp: solicitud.cp,
      ciudad: solicitud.ciudad,
      estadoDomicilio: solicitud.estadoDomicilio,
      municipioId: solicitud.municipioId,
      gestorId: asignarGestorId ?? null,
      emailVerificado: true,
      registroTipo: 'solicitud_cuenta',
      folioPreregistro: folioSol,
      preregistroGeneradoEn: ahoraSol,
      preregistroVigenteHasta: vigenteHastaSol.toISOString().split('T')[0],
    });

    // Inscribir en convocatoria activa si existe
    const [convActiva] = await tx
      .select()
      .from(convocatorias)
      .where(eq(convocatorias.estado, 'abierta'))
      .limit(1);
    if (convActiva) {
      await tx.insert(inscripciones).values({
        estudianteId: user.id,
        convocatoriaId: convActiva.id,
        estado: 'documentos_pendientes',
        creadoPorUserId: adminId,
      });
    }

    await tx
      .update(solicitudesCuenta)
      .set({
        estado: 'aprobada',
        procesadaPorUserId: adminId,
        procesadaEn: new Date(),
        comentarioAdmin: comentarioAdmin ?? null,
      })
      .where(eq(solicitudesCuenta.id, solicitudId));

    return user;
  });

  await tryAuditLog({
    userId: adminId,
    accion: 'aprobar_solicitud_cuenta',
    entidad: 'solicitudes_cuenta',
    entidadId: solicitudId,
    detalle: `Aprobó solicitud de cuenta de ${solicitud.nombreCompleto} (nuevo userId: ${newUser.id})`,
    metadata: { nuevoUserId: newUser.id, asignarGestorId: asignarGestorId ?? null },
    req,
  });

  // Send welcome email
  let emailEnviado = false;
  let modoEmail: 'dev' | 'production' = 'dev';
  try {
    const emailResult = await sendBienvenidaCredenciales(solicitud.email, {
      nombreAlumno: solicitud.nombreCompleto,
      email: solicitud.email,
      passwordTemporal: tempPassword,
      portalUrl: process.env.PUBLIC_PORTAL_URL || 'http://localhost:5173/login',
      gestor: gestorInfo,
    });
    emailEnviado = emailResult.enviado;
    modoEmail = emailResult.modo;
    if (emailEnviado) {
      await db.update(users).set({ bienvenidaEnviadaEn: new Date() }).where(eq(users.id, newUser.id));
    }
  } catch {}

  if (asignarGestorId) {
    notificar({
      userId: asignarGestorId,
      tipo: 'alumno_asignado',
      prioridad: 'normal',
      titulo: 'Nuevo alumno asignado',
      cuerpo: `${solicitud.nombreCompleto} fue asignado a tu cartera de alumnos.`,
      enlace: `/gestor/alumnos/${newUser.id}`,
    });
  }

  res.status(201).json({
    ok: true,
    alumno: { userId: newUser.id, email: solicitud.email, nombreCompleto: solicitud.nombreCompleto },
    emailEnviado,
    modoEmail,
    ...(modoEmail === 'dev' ? { credencialTemporal: tempPassword } : {}),
  });
});

// ─── POST /admin/solicitudes-cuenta/:id/rechazar ──────────────────────────
const rechazarSolicitudSchema = z.object({
  motivoRechazo: z.string().optional(),
});

router.post('/solicitudes-cuenta/:id/rechazar', async (req, res) => {
  const solicitudId = Number(req.params.id);
  if (!solicitudId) { res.status(400).json({ error: 'ID inválido' }); return; }

  const parse = rechazarSolicitudSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: 'Datos inválidos' }); return; }

  const [solicitud] = await db.select().from(solicitudesCuenta).where(eq(solicitudesCuenta.id, solicitudId));
  if (!solicitud) { res.status(404).json({ error: 'Solicitud no encontrada' }); return; }
  if (solicitud.estado !== 'pendiente') {
    res.status(400).json({ error: `La solicitud ya fue procesada (estado: ${solicitud.estado})` });
    return;
  }

  await db
    .update(solicitudesCuenta)
    .set({
      estado: 'rechazada',
      procesadaPorUserId: req.user!.userId,
      procesadaEn: new Date(),
      comentarioAdmin: parse.data.motivoRechazo ?? null,
    })
    .where(eq(solicitudesCuenta.id, solicitudId));

  await tryAuditLog({
    userId: req.user!.userId,
    accion: 'rechazar_solicitud_cuenta',
    entidad: 'solicitudes_cuenta',
    entidadId: solicitudId,
    detalle: `Rechazó solicitud de cuenta ID ${solicitudId}`,
    metadata: { motivo: parse.data.motivoRechazo ?? null },
    req,
  });

  res.json({ ok: true });
});

// ─── POST /admin/alumnos/:id/reenviar-credenciales ────────────────────────
router.post('/alumnos/:id/reenviar-credenciales', async (req, res) => {
  const alumnoId = Number(req.params.id);
  if (Number.isNaN(alumnoId)) { res.status(400).json({ error: 'ID inválido' }); return; }

  const [alumno] = await db.select().from(estudiantes).where(eq(estudiantes.userId, alumnoId));
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

  // Load gestor info if assigned
  let gestorInfo: { nombre: string; telefono: string | null; municipio: string | null } | undefined;
  if (alumno.gestorId) {
    const [g] = await db
      .select({ nombre: gestores.nombreCompleto, telefono: gestores.telefonoPublico, municipioId: gestores.municipioId })
      .from(gestores)
      .where(eq(gestores.userId, alumno.gestorId));
    if (g) {
      const [mun] = await db.select({ nombre: municipios.nombre }).from(municipios).where(eq(municipios.id, g.municipioId));
      gestorInfo = { nombre: g.nombre, telefono: g.telefono ?? null, municipio: mun?.nombre ?? null };
    }
  }

  let emailEnviado = false;
  let modoEmail: 'dev' | 'production' = 'dev';
  try {
    const result = await sendBienvenidaCredenciales(userRow.email, {
      nombreAlumno: alumno.nombreCompleto,
      email: userRow.email,
      passwordTemporal: newPassword,
      portalUrl: process.env.PUBLIC_PORTAL_URL || 'http://localhost:5173/login',
      gestor: gestorInfo,
    });
    emailEnviado = result.enviado;
    modoEmail = result.modo;
    if (emailEnviado) {
      await db.update(users).set({ bienvenidaEnviadaEn: new Date() }).where(eq(users.id, alumnoId));
    }
  } catch {}

  await tryAuditLog({
    userId: req.user!.userId,
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

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

router.get('/dashboard', async (req, res) => {
  try {
    const userId = req.user!.userId;

    const [adminRow] = await db
      .select({ nombreCompleto: administradores.nombreCompleto })
      .from(administradores)
      .where(eq(administradores.userId, userId));

    const nombreAdmin = adminRow?.nombreCompleto ?? '';

    const fechaHoy = new Date().toLocaleDateString('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    let accesosHoy = 0;
    try {
      const [{ cnt }] = await db
        .select({ cnt: count() })
        .from(users)
        .where(gte(users.ultimoLogin, startOfToday));
      accesosHoy = Number(cnt);
    } catch {}

    let etapaActiva: typeof convocatoriasEtapas.$inferSelect | null = null;
    let convocatoriaActiva: {
      id: number;
      clave: string;
      titulo: string;
      inscritos: number;
      diasParaCierre: number;
      fase: string;
    } | null = null;

    try {
      const [etapa] = await db
        .select()
        .from(convocatoriasEtapas)
        .where(eq(convocatoriasEtapas.estado, 'inscripcion_abierta'))
        .limit(1);

      if (etapa) {
        etapaActiva = etapa;
        const examenDate = new Date(etapa.examenSabado);
        const titulo = `Etapa ${etapa.etapa} · Fase ${etapa.fase} · ${MESES[examenDate.getMonth()]} ${etapa.anio}`;
        const diasParaCierre = Math.max(0, Math.ceil((new Date(etapa.solicitudFin).getTime() - Date.now()) / 86400000));

        const [{ inscritosCount }] = await db
          .select({ inscritosCount: count() })
          .from(examenesInscripciones)
          .where(eq(examenesInscripciones.etapaId, etapa.id));

        convocatoriaActiva = {
          id: etapa.id,
          clave: etapa.clave,
          titulo,
          inscritos: Number(inscritosCount),
          diasParaCierre,
          fase: etapa.fase,
        };
      }
    } catch {}

    let documentosPorRevisar = 0;
    let pagosPorVerificar = 0;
    let solicitudesCuentaPendientes = 0;
    let calificacionesPorCapturar = 0;

    try {
      const [{ cnt }] = await db
        .select({ cnt: count() })
        .from(expedienteDocumentos)
        .where(eq(expedienteDocumentos.estado, 'pendiente_revision'));
      documentosPorRevisar = Number(cnt);
    } catch {}

    try {
      const [{ cnt }] = await db
        .select({ cnt: count() })
        .from(pagos)
        .where(eq(pagos.estado, 'pendiente'));
      pagosPorVerificar = Number(cnt);
    } catch {}

    try {
      const [{ cnt }] = await db
        .select({ cnt: count() })
        .from(solicitudesCuenta)
        .where(eq(solicitudesCuenta.estado, 'pendiente'));
      solicitudesCuentaPendientes = Number(cnt);
    } catch {}

    try {
      const [{ cnt }] = await db
        .select({ cnt: count() })
        .from(examenesInscripciones)
        .where(
          and(
            isNull(examenesInscripciones.calificacion),
            eq(examenesInscripciones.estado, 'presentado')
          )
        );
      calificacionesPorCapturar = Number(cnt);
    } catch {
      calificacionesPorCapturar = 0;
    }

    const totalTareasPendientes =
      documentosPorRevisar + pagosPorVerificar + solicitudesCuentaPendientes + calificacionesPorCapturar;

    let alumnosActivosTotal = 0;
    let alumnosActivosDelta = 0;

    try {
      const [{ cnt }] = await db.select({ cnt: count() }).from(estudiantes);
      alumnosActivosTotal = Number(cnt);
    } catch {}

    try {
      const [{ cnt }] = await db
        .select({ cnt: count() })
        .from(estudiantes)
        .where(gte(estudiantes.createdAt, sql`NOW() - INTERVAL '7 days'`));
      alumnosActivosDelta = Number(cnt);
    } catch {}

    let gestoresTotal = 0;
    let municipiosCubiertos = 0;

    try {
      const [{ cnt }] = await db.select({ cnt: count() }).from(gestores);
      gestoresTotal = Number(cnt);
    } catch {}

    try {
      const [{ cnt }] = await db
        .select({ cnt: countDistinct(gestores.municipioId) })
        .from(gestores);
      municipiosCubiertos = Number(cnt);
    } catch {}

    let expedientesCompletos = 0;
    let expedientesTotal = 0;
    let expedientesCompletosLastWeek = 0;

    try {
      const completosResult = await db.execute(sql`
        SELECT count(DISTINCT estudiante_id) as completos
        FROM (
          SELECT estudiante_id
          FROM expediente_documentos
          WHERE estado = 'aprobado'
            AND tipo IN ('curp','acta_nacimiento','ine','comprobante_domicilio','certificado_secundaria')
          GROUP BY estudiante_id
          HAVING count(DISTINCT tipo) >= 5
        ) x
      `);
      expedientesCompletos = Number((completosResult.rows[0] as { completos: string | number })?.completos ?? 0);
    } catch {}

    try {
      const [{ cnt }] = await db
        .select({ cnt: countDistinct(expedienteDocumentos.estudianteId) })
        .from(expedienteDocumentos);
      expedientesTotal = Number(cnt);
    } catch {}

    try {
      const deltaResult = await db.execute(sql`
        SELECT count(DISTINCT estudiante_id) as completos
        FROM (
          SELECT estudiante_id
          FROM expediente_documentos
          WHERE estado = 'aprobado'
            AND tipo IN ('curp','acta_nacimiento','ine','comprobante_domicilio','certificado_secundaria')
            AND created_at >= NOW() - INTERVAL '7 days'
          GROUP BY estudiante_id
          HAVING count(DISTINCT tipo) >= 5
        ) x
      `);
      expedientesCompletosLastWeek = Number((deltaResult.rows[0] as { completos: string | number })?.completos ?? 0);
    } catch {}

    let egresadosTotal = 0;
    let egresadosDelta = 0;

    try {
      const egresadosResult = await db.execute(sql`
        SELECT count(*) as total
        FROM (
          SELECT estudiante_id
          FROM estudiantes_modulos_progreso
          WHERE estado = 'aprobado'
          GROUP BY estudiante_id
          HAVING count(*) >= 21
        ) x
      `);
      egresadosTotal = Number((egresadosResult.rows[0] as { total: string | number })?.total ?? 0);
    } catch {}

    try {
      const egresadosDeltaResult = await db.execute(sql`
        SELECT count(*) as total
        FROM (
          SELECT estudiante_id
          FROM estudiantes_modulos_progreso
          WHERE estado = 'aprobado'
            AND created_at >= NOW() - INTERVAL '30 days'
          GROUP BY estudiante_id
          HAVING count(*) >= 21
        ) x
      `);
      egresadosDelta = Number((egresadosDeltaResult.rows[0] as { total: string | number })?.total ?? 0);
    } catch {}

    const currentYear = new Date().getFullYear();
    const today = new Date();

    let graficaEtapas: Array<{
      clave: string;
      inscritos: number;
      activa: boolean;
      futura: boolean;
    }> = [];

    try {
      const etapasAnio = await db
        .select()
        .from(convocatoriasEtapas)
        .where(eq(convocatoriasEtapas.anio, currentYear))
        .orderBy(convocatoriasEtapas.solicitudInicio);

      graficaEtapas = await Promise.all(
        etapasAnio.map(async (etapa) => {
          let inscritosEtapa = 0;
          try {
            const [{ cnt }] = await db
              .select({ cnt: count() })
              .from(examenesInscripciones)
              .where(eq(examenesInscripciones.etapaId, etapa.id));
            inscritosEtapa = Number(cnt);
          } catch {}
          return {
            clave: etapa.clave,
            inscritos: inscritosEtapa,
            activa: etapa.estado === 'inscripcion_abierta',
            futura: new Date(etapa.solicitudInicio) > today,
          };
        })
      );
    } catch {}

    type AuditRow = {
      id: number;
      accion: string;
      metadata: unknown;
      createdAt: Date;
      userEmail: string | null;
      userRol: string | null;
      adminNombre: string | null;
      gestorNombre: string | null;
      estudianteNombre: string | null;
    };

    let actividadReciente: Array<{
      id: number;
      tipo: string;
      actorNombre: string;
      actorRol: string;
      descripcion: string;
      descripcionExtra: string | null;
      referencia: string | null;
      creadoEn: string;
    }> = [];

    try {
      const auditRows = await db
        .select({
          id: auditLog.id,
          accion: auditLog.accion,
          entidadId: auditLog.entidadId,
          metadata: auditLog.metadata,
          createdAt: auditLog.createdAt,
          userEmail: users.email,
          userRol: users.rol,
          adminNombre: administradores.nombreCompleto,
          gestorNombre: gestores.nombreCompleto,
          estudianteNombre: estudiantes.nombreCompleto,
        })
        .from(auditLog)
        .leftJoin(users, eq(users.id, auditLog.userId))
        .leftJoin(administradores, eq(administradores.userId, auditLog.userId))
        .leftJoin(gestores, eq(gestores.userId, auditLog.userId))
        .leftJoin(estudiantes, eq(estudiantes.userId, auditLog.userId))
        .orderBy(desc(auditLog.createdAt))
        .limit(10);

      actividadReciente = (auditRows as AuditRow[]).map((row) => {
        const meta = (row.metadata ?? {}) as Record<string, unknown>;
        let tipo = row.accion;
        let descripcion = row.accion;
        let descripcionExtra: string | null = null;

        if (row.accion === 'crear_alumno' || row.accion === 'registro_completo') {
          tipo = 'alumno_registrado';
          descripcion = 'Nuevo alumno registrado';
          descripcionExtra = typeof meta.curp === 'string' ? meta.curp : null;
        } else if (row.accion === 'verificar_pago') {
          tipo = 'pago_verificado';
          descripcion = 'Pago verificado';
        } else if (row.accion === 'rechazar_pago') {
          tipo = 'pago_rechazado';
          descripcion = 'Pago rechazado';
        } else if (row.accion === 'capturar_calificacion') {
          tipo = 'calificacion_capturada';
          descripcion = `Calificación ${meta.calificacion} capturada`;
        } else if (row.accion === 'aprobar_solicitud_cuenta') {
          tipo = 'solicitud_aprobada';
          descripcion = 'Solicitud de cuenta aprobada';
        } else if (row.accion === 'rechazar_solicitud_cuenta') {
          tipo = 'solicitud_rechazada';
          descripcion = 'Solicitud rechazada';
        }

        const actorNombre = row.adminNombre ?? row.gestorNombre ?? row.estudianteNombre ?? row.userEmail ?? 'Sistema';
        const actorRol = row.userRol ?? 'desconocido';

        return {
          id: row.id,
          tipo,
          actorNombre,
          actorRol,
          descripcion,
          descripcionExtra,
          referencia: null,
          creadoEn: row.createdAt.toISOString(),
        };
      });
    } catch {}

    type AlumnoRow = {
      userId: number;
      nombreCompleto: string;
      municipioNombre: string | null;
      gestorNombre: string | null;
      createdAt: Date;
      matriculaOficialDGB: string | null;
    };

    let alumnosRecientes: Array<{
      id: number;
      nombreCompleto: string;
      iniciales: string;
      municipio: string | null;
      gestorNombre: string | null;
      estadoExpediente: 'activo' | 'esperando_matricula' | 'pago_pendiente' | 'en_proceso' | 'rechazado' | 'sin_documentos' | 'inactivo';
      estadoTexto: string;
      creadoEn: string;
    }> = [];

    try {
      const gestoresAlias = gestores;
      const alumnoRows = await db
        .select({
          userId: estudiantes.userId,
          nombreCompleto: estudiantes.nombreCompleto,
          municipioNombre: municipios.nombre,
          gestorNombre: gestoresAlias.nombreCompleto,
          createdAt: estudiantes.createdAt,
          matriculaOficialDGB: estudiantes.matriculaOficialDGB,
        })
        .from(estudiantes)
        .leftJoin(municipios, eq(estudiantes.municipioId, municipios.id))
        .leftJoin(gestoresAlias, eq(estudiantes.gestorId, gestoresAlias.userId))
        .orderBy(desc(estudiantes.createdAt))
        .limit(5);

      alumnosRecientes = await Promise.all(
        (alumnoRows as AlumnoRow[]).map(async (alumno) => {
          const palabras = alumno.nombreCompleto.trim().split(/\s+/);
          const iniciales = palabras.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');

          let estadoExpediente: 'activo' | 'esperando_matricula' | 'pago_pendiente' | 'en_proceso' | 'rechazado' | 'sin_documentos' | 'inactivo' = 'sin_documentos';
          let estadoTexto = 'Sin docs';

          try {
            const [docsResult, pagosVerif] = await Promise.all([
              db.select({ estado: expedienteDocumentos.estado, tipo: expedienteDocumentos.tipo }).from(expedienteDocumentos).where(eq(expedienteDocumentos.estudianteId, alumno.userId)),
              db.select({ id: pagos.id }).from(pagos).where(and(eq(pagos.estudianteId, alumno.userId), eq(pagos.estado, 'verificado'))).limit(1),
            ]);
            const docs = docsResult;
            const OBLIGATORIOS = ['curp', 'acta_nacimiento', 'ine', 'comprobante_domicilio', 'certificado_secundaria'];
            const aprobados = docs.filter((d) => d.estado === 'aprobado' && OBLIGATORIOS.includes(d.tipo));
            const rechazados = docs.filter((d) => d.estado === 'rechazado');

            if (docs.length === 0) {
              estadoExpediente = 'sin_documentos';
              estadoTexto = 'Sin docs';
            } else if (rechazados.length > 0) {
              estadoExpediente = 'rechazado';
              estadoTexto = `${rechazados.length} rechazado`;
            } else if (aprobados.length < 5) {
              estadoExpediente = 'en_proceso';
              estadoTexto = `${aprobados.length}/5 docs`;
            } else if (pagosVerif.length === 0) {
              estadoExpediente = 'pago_pendiente';
              estadoTexto = 'Pago pendiente';
            } else if (!alumno.matriculaOficialDGB) {
              estadoExpediente = 'esperando_matricula';
              estadoTexto = 'Sin matrícula';
            } else {
              estadoExpediente = 'activo';
              estadoTexto = 'Activo';
            }
          } catch {}

          return {
            id: alumno.userId,
            nombreCompleto: alumno.nombreCompleto,
            iniciales,
            municipio: alumno.municipioNombre ?? null,
            gestorNombre: alumno.gestorNombre ?? null,
            estadoExpediente,
            estadoTexto,
            creadoEn: alumno.createdAt.toISOString(),
          };
        })
      );
    } catch {}

    let topMunicipios: Array<{ municipio: string; count: number; porcentaje: number }> = [];

    try {
      const munRows = await db.execute<{ nombre: string; count: string }>(sql`
        SELECT m.nombre, count(e.user_id)::text as count
        FROM estudiantes e
        JOIN municipios m ON e.municipio_id = m.id
        GROUP BY m.nombre
        ORDER BY count(e.user_id) DESC
      `);

      const allRows = munRows.rows.map((r) => ({ municipio: r.nombre, count: Number(r.count) }));
      const totalAll = allRows.reduce((s, r) => s + r.count, 0);
      const top6 = allRows.slice(0, 6);
      const resto = allRows.slice(6);

      const topWithPct = top6.map((r) => ({
        municipio: r.municipio,
        count: r.count,
        porcentaje: totalAll > 0 ? Math.round((r.count / totalAll) * 100) : 0,
      }));

      if (resto.length > 0) {
        const otrosCount = resto.reduce((s, r) => s + r.count, 0);
        topWithPct.push({
          municipio: `Otros ${resto.length} municipios`,
          count: otrosCount,
          porcentaje: totalAll > 0 ? Math.round((otrosCount / totalAll) * 100) : 0,
        });
      }

      topMunicipios = topWithPct;
    } catch {}

    const etapaActivaId = etapaActiva?.id;

    res.json({
      greeting: {
        nombreAdmin,
        fechaHoy,
        accesosHoy,
        totalTareasPendientes,
      },
      convocatoriaActiva,
      tareasPendientes: {
        documentosPorRevisar,
        pagosPorVerificar,
        solicitudesCuenta: solicitudesCuentaPendientes,
        calificacionesPorCapturar,
      },
      kpisGenerales: {
        alumnosActivos: { total: alumnosActivosTotal, deltaSemana: alumnosActivosDelta },
        gestoresActivos: { total: gestoresTotal, municipiosCubiertos },
        expedientesCompletos: { completos: expedientesCompletos, total: expedientesTotal, deltaSemana: expedientesCompletosLastWeek },
        egresados: { total: egresadosTotal, deltaMes: egresadosDelta },
      },
      graficaInscripciones: { etapas: graficaEtapas },
      actividadReciente,
      alumnosRecientes,
      topMunicipios,
      _meta: { etapaActivaId: etapaActivaId ?? null },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno';
    res.status(500).json({ error: message });
  }
});

// ─── GET /admin/municipios ────────────────────────────────────────────────
router.get('/municipios', async (req, res) => {
  try {
    const activos = req.query.activos === 'true';
    const result = await db.execute<{ id: number; nombre: string; alumnos_count: number }>(
      activos
        ? sql`SELECT m.id, m.nombre, COUNT(e.user_id)::int AS alumnos_count
              FROM municipios m
              LEFT JOIN estudiantes e ON e.municipio_id = m.id
              GROUP BY m.id, m.nombre
              HAVING COUNT(e.user_id) > 0
              ORDER BY m.nombre ASC`
        : sql`SELECT m.id, m.nombre, COUNT(e.user_id)::int AS alumnos_count
              FROM municipios m
              LEFT JOIN estudiantes e ON e.municipio_id = m.id
              GROUP BY m.id, m.nombre
              ORDER BY m.nombre ASC`
    );
    res.json({ municipios: result.rows.map(r => ({ id: r.id, nombre: r.nombre, alumnosCount: Number(r.alumnos_count) })) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error interno' });
  }
});

// ─── GET /admin/gestores-list ─────────────────────────────────────────────
router.get('/gestores-list', async (_req, res) => {
  try {
    type GestorRow = { user_id: number; nombre_completo: string; municipio_id: number | null; municipio_nombre: string | null; alumnos_count: number };
    const result = await db.execute<GestorRow>(sql`
      SELECT g.user_id, g.nombre_completo, g.municipio_id, m.nombre AS municipio_nombre,
             COUNT(e.user_id)::int AS alumnos_count
      FROM gestores g
      LEFT JOIN municipios m ON g.municipio_id = m.id
      LEFT JOIN estudiantes e ON e.gestor_id = g.user_id
      WHERE g.estado = 'activo'
      GROUP BY g.user_id, g.nombre_completo, g.municipio_id, m.nombre
      ORDER BY g.nombre_completo ASC
    `);
    res.json({
      gestores: result.rows.map((r) => {
        const partes = (r.nombre_completo ?? '').trim().split(/\s+/);
        const iniciales = partes.slice(0, 2).map((p: string) => p[0]?.toUpperCase() ?? '').join('');
        return {
          id: r.user_id,
          nombreCompleto: r.nombre_completo,
          iniciales,
          municipioId: r.municipio_id ?? null,
          municipioNombre: r.municipio_nombre ?? null,
          alumnosCount: Number(r.alumnos_count),
        };
      }),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error interno' });
  }
});

// ─── GET /admin/etapas ────────────────────────────────────────────────────
router.get('/etapas', async (_req, res) => {
  try {
    type EtapaRow = { id: number; clave: string; etapa: string; fase: string; anio: number; estado: string; examen_sabado: string; inscritos_count: number };
    const result = await db.execute<EtapaRow>(sql`
      SELECT ce.id, ce.clave, ce.etapa, ce.fase, ce.anio, ce.estado, ce.examen_sabado::text,
             COUNT(DISTINCT ei.estudiante_id)::int AS inscritos_count
      FROM convocatorias_etapas ce
      LEFT JOIN examenes_inscripciones ei ON ei.etapa_id = ce.id
      GROUP BY ce.id, ce.clave, ce.etapa, ce.fase, ce.anio, ce.estado, ce.examen_sabado
      ORDER BY ce.examen_sabado DESC
    `);
    res.json({
      etapas: result.rows.map((r) => ({
        id: r.id,
        label: `Etapa ${r.etapa} Fase ${r.fase} · ${r.anio}`,
        nombreCompleto: `Etapa ${r.etapa} · Fase ${r.fase} · ${r.anio}`,
        clave: r.clave,
        fase: r.fase,
        anio: r.anio,
        estado: r.estado,
        inscritosCount: Number(r.inscritos_count),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error interno' });
  }
});

// ─── POST /admin/alumnos/:id/asignar-gestor ───────────────────────────────
const asignarGestorSchema = z.object({ gestorId: z.number().int().positive().nullable() });

router.post('/alumnos/:id/asignar-gestor', async (req, res) => {
  const alumnoId = Number(req.params.id);
  if (!alumnoId) { res.status(400).json({ error: 'ID inválido' }); return; }
  const parse = asignarGestorSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: 'Datos inválidos' }); return; }
  try {
    await db.execute(sql`
      UPDATE estudiantes SET gestor_id = ${parse.data.gestorId}, updated_at = now()
      WHERE user_id = ${alumnoId}
    `);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error interno' });
  }
});

// ─── GET /admin/alumnos ───────────────────────────────────────────────────
const VALID_FILTROS = [
  'docs_en_revision',
  'docs_rechazados',
  'pagos_pendientes',
  'calif_pendientes',
  'expediente_completo',
  'expediente_incompleto',
] as const;
type FiltroAlumnos = (typeof VALID_FILTROS)[number];

const VALID_SORT_ALUMNOS = ['nombre', 'municipio', 'gestor', 'estado', 'actividad', 'registro'] as const;

function relativaActividad(date: Date | null): string {
  if (!date) return 'Sin actividad';
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days < 7) return `Hace ${days} días`;
  if (days < 30) return `Hace ${Math.floor(days / 7)} sem.`;
  if (days < 365) {
    const m = Math.floor(days / 30);
    return `Hace ${m} ${m > 1 ? 'meses' : 'mes'}`;
  }
  const y = Math.floor(days / 365);
  return `Hace ${y} ${y > 1 ? 'años' : 'año'}`;
}

router.get('/alumnos', async (req, res) => {
  const filtro = (req.query.filtro as string) || '';
  const search = ((req.query.search as string) || (req.query.q as string) || '').trim();
  const municipioIdParam = parseInt(req.query.municipioId as string) || 0;
  const estadoExpParam = (req.query.estadoExpediente as string) || '';
  const gestorIdParam = (req.query.gestorId as string) || '';
  const etapaIdParam = (req.query.etapaId as string) || '';
  const sortByParam = (req.query.sortBy as string) || 'registro';
  const sortDirParam = (req.query.sortDir as string) || 'desc';
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(10, parseInt(req.query.limit as string) || 20));
  const offset = (page - 1) * limit;

  const filtroValido = VALID_FILTROS.includes(filtro as FiltroAlumnos) ? (filtro as FiltroAlumnos) : null;
  const sortBy = VALID_SORT_ALUMNOS.includes(sortByParam as typeof VALID_SORT_ALUMNOS[number]) ? sortByParam : 'registro';
  const sortDir = sortDirParam === 'asc' ? 'ASC' : 'DESC';

  const FILTRO_DESC: Record<FiltroAlumnos, string> = {
    docs_en_revision: 'Documentos en revisión',
    docs_rechazados: 'Documentos rechazados',
    pagos_pendientes: 'Pagos pendientes',
    calif_pendientes: 'Calificaciones por capturar',
    expediente_completo: 'Expediente completo',
    expediente_incompleto: 'Expediente incompleto',
  };

  const filterSqlSnippets: Record<FiltroAlumnos, string> = {
    docs_en_revision: `AND EXISTS (SELECT 1 FROM expediente_documentos ed WHERE ed.estudiante_id = e.user_id AND ed.estado = 'pendiente_revision')`,
    docs_rechazados: `AND EXISTS (SELECT 1 FROM expediente_documentos ed WHERE ed.estudiante_id = e.user_id AND ed.estado = 'rechazado')`,
    pagos_pendientes: `AND EXISTS (SELECT 1 FROM pagos p WHERE p.estudiante_id = e.user_id AND p.estado = 'pendiente')`,
    calif_pendientes: `AND EXISTS (SELECT 1 FROM examenes_inscripciones ei WHERE ei.estudiante_id = e.user_id AND ei.estado = 'presentado' AND ei.calificacion IS NULL)`,
    expediente_completo: `AND (SELECT count(DISTINCT tipo) FROM expediente_documentos ed WHERE ed.estudiante_id = e.user_id AND ed.estado = 'aprobado' AND tipo IN ('curp','acta_nacimiento','ine','comprobante_domicilio','certificado_secundaria')) = 5`,
    expediente_incompleto: `AND (SELECT count(DISTINCT tipo) FROM expediente_documentos ed WHERE ed.estudiante_id = e.user_id AND ed.estado = 'aprobado' AND tipo IN ('curp','acta_nacimiento','ine','comprobante_domicilio','certificado_secundaria')) < 5`,
  };

  const estadoCuentaParam = (req.query.estadoCuenta as string) || '';
  const VALID_ESTADO_CUENTA = ['activa', 'aviso_enviado', 'soft_deleted'];
  const estadoCuentaSnippet = VALID_ESTADO_CUENTA.includes(estadoCuentaParam)
    ? sql`AND e.estado_cuenta = ${estadoCuentaParam}`
    : sql`AND COALESCE(e.estado_cuenta, 'activa') != 'soft_deleted' AND COALESCE(e.estado_cuenta, 'activa') != 'hard_deleted'`;

  const VALID_ESTADO_EXP = ['activo', 'esperando_matricula', 'pago_pendiente', 'en_proceso', 'rechazado', 'sin_documentos', 'inactivo'];
  const estadoExpSnippets: Record<string, string> = {
    activo: `AND u.activo = true AND NOT EXISTS (SELECT 1 FROM expediente_documentos ed WHERE ed.estudiante_id = e.user_id AND ed.estado = 'rechazado') AND (SELECT count(DISTINCT tipo) FROM expediente_documentos ed WHERE ed.estudiante_id = e.user_id AND ed.estado = 'aprobado' AND tipo IN ('curp','acta_nacimiento','ine','comprobante_domicilio','certificado_secundaria')) >= 5 AND EXISTS (SELECT 1 FROM pagos p WHERE p.estudiante_id = e.user_id AND p.estado = 'verificado') AND e.matricula_oficial_dgb IS NOT NULL`,
    esperando_matricula: `AND (SELECT count(DISTINCT tipo) FROM expediente_documentos ed WHERE ed.estudiante_id = e.user_id AND ed.estado = 'aprobado' AND tipo IN ('curp','acta_nacimiento','ine','comprobante_domicilio','certificado_secundaria')) >= 5 AND EXISTS (SELECT 1 FROM pagos p WHERE p.estudiante_id = e.user_id AND p.estado = 'verificado') AND e.matricula_oficial_dgb IS NULL`,
    pago_pendiente: `AND (SELECT count(DISTINCT tipo) FROM expediente_documentos ed WHERE ed.estudiante_id = e.user_id AND ed.estado = 'aprobado' AND tipo IN ('curp','acta_nacimiento','ine','comprobante_domicilio','certificado_secundaria')) >= 5 AND NOT EXISTS (SELECT 1 FROM pagos p WHERE p.estudiante_id = e.user_id AND p.estado = 'verificado')`,
    en_proceso: `AND EXISTS (SELECT 1 FROM expediente_documentos ed WHERE ed.estudiante_id = e.user_id) AND NOT EXISTS (SELECT 1 FROM expediente_documentos ed WHERE ed.estudiante_id = e.user_id AND ed.estado = 'rechazado') AND (SELECT count(DISTINCT tipo) FROM expediente_documentos ed WHERE ed.estudiante_id = e.user_id AND ed.estado = 'aprobado' AND tipo IN ('curp','acta_nacimiento','ine','comprobante_domicilio','certificado_secundaria')) < 5`,
    rechazado: `AND EXISTS (SELECT 1 FROM expediente_documentos ed WHERE ed.estudiante_id = e.user_id AND ed.estado = 'rechazado')`,
    sin_documentos: `AND NOT EXISTS (SELECT 1 FROM expediente_documentos ed WHERE ed.estudiante_id = e.user_id)`,
    inactivo: `AND u.activo = false`,
  };

  const sortColMap: Record<string, string> = {
    nombre: 'e.nombre_completo',
    municipio: 'm.nombre',
    gestor: 'g.nombre_completo',
    estado: 'estado_expediente',
    actividad: 'ultima_actividad',
    registro: 'e.created_at',
  };

  const presetSnippet = filtroValido ? sql.raw(filterSqlSnippets[filtroValido]) : sql``;
  const searchSnippet = search
    ? sql`AND (e.nombre_completo ILIKE ${`%${search}%`} OR e.curp ILIKE ${`%${search}%`} OR u.email ILIKE ${`%${search}%`})`
    : sql``;
  const municipioSnippet = municipioIdParam > 0 ? sql`AND e.municipio_id = ${municipioIdParam}` : sql``;
  const estadoSnippet = VALID_ESTADO_EXP.includes(estadoExpParam) ? sql.raw(estadoExpSnippets[estadoExpParam]) : sql``;
  const gestorSnippet = gestorIdParam === 'sin_gestor'
    ? sql`AND e.gestor_id IS NULL`
    : parseInt(gestorIdParam) > 0 ? sql`AND e.gestor_id = ${parseInt(gestorIdParam)}` : sql``;
  const etapaSnippet = etapaIdParam === 'sin_inscripcion'
    ? sql`AND NOT EXISTS (SELECT 1 FROM examenes_inscripciones ei WHERE ei.estudiante_id = e.user_id)`
    : parseInt(etapaIdParam) > 0 ? sql`AND EXISTS (SELECT 1 FROM examenes_inscripciones ei WHERE ei.estudiante_id = e.user_id AND ei.etapa_id = ${parseInt(etapaIdParam)})` : sql``;
  const orderSnippet = sql.raw(`${sortColMap[sortBy] ?? 'e.created_at'} ${sortDir} NULLS LAST`);

  try {
    type AlumnoRow = {
      user_id: number;
      nombre_completo: string;
      curp: string | null;
      email: string;
      municipio_id: number | null;
      municipio_nombre: string | null;
      gestor_id: number | null;
      gestor_nombre: string | null;
      estado_expediente: string;
      docs_aprobados: number;
      docs_total: number;
      ultima_actividad: Date | null;
      ultima_actividad_en: Date | null;
      estado_cuenta: string | null;
      created_at: Date;
    };

    const allSnippets = sql`${searchSnippet} ${presetSnippet} ${municipioSnippet} ${estadoSnippet} ${gestorSnippet} ${etapaSnippet} ${estadoCuentaSnippet}`;

    const [countResult, rowsResult, resumenResult] = await Promise.all([
      db.execute<{ total: string }>(sql`
        SELECT count(*)::text AS total
        FROM estudiantes e
        LEFT JOIN users u ON e.user_id = u.id
        LEFT JOIN municipios m ON e.municipio_id = m.id
        LEFT JOIN gestores g ON e.gestor_id = g.user_id
        WHERE 1=1 ${allSnippets}
      `),
      db.execute<AlumnoRow>(sql`
        SELECT
          e.user_id,
          e.nombre_completo,
          e.curp,
          u.email,
          e.municipio_id,
          m.nombre AS municipio_nombre,
          e.gestor_id,
          g.nombre_completo AS gestor_nombre,
          CASE
            WHEN u.activo = false THEN 'inactivo'
            WHEN EXISTS (SELECT 1 FROM expediente_documentos x WHERE x.estudiante_id = e.user_id AND x.estado = 'rechazado') THEN 'rechazado'
            WHEN NOT EXISTS (SELECT 1 FROM expediente_documentos x WHERE x.estudiante_id = e.user_id) THEN 'sin_documentos'
            WHEN (SELECT count(DISTINCT tipo) FROM expediente_documentos x WHERE x.estudiante_id = e.user_id AND x.estado = 'aprobado' AND tipo IN ('curp','acta_nacimiento','ine','comprobante_domicilio','certificado_secundaria')) < 5 THEN 'en_proceso'
            WHEN NOT EXISTS (SELECT 1 FROM pagos p WHERE p.estudiante_id = e.user_id AND p.estado = 'verificado') THEN 'pago_pendiente'
            WHEN e.matricula_oficial_dgb IS NULL THEN 'esperando_matricula'
            ELSE 'activo'
          END AS estado_expediente,
          (SELECT count(*) FROM expediente_documentos x WHERE x.estudiante_id = e.user_id AND x.estado = 'aprobado')::int AS docs_aprobados,
          (SELECT count(*) FROM expediente_documentos x WHERE x.estudiante_id = e.user_id)::int AS docs_total,
          GREATEST(
            (SELECT MAX(updated_at) FROM expediente_documentos WHERE estudiante_id = e.user_id),
            (SELECT MAX(updated_at) FROM pagos WHERE estudiante_id = e.user_id),
            (SELECT MAX(created_at) FROM examenes_inscripciones WHERE estudiante_id = e.user_id),
            e.updated_at
          ) AS ultima_actividad,
          e.ultima_actividad_en,
          COALESCE(e.estado_cuenta, 'activa') AS estado_cuenta,
          e.created_at
        FROM estudiantes e
        LEFT JOIN users u ON e.user_id = u.id
        LEFT JOIN municipios m ON e.municipio_id = m.id
        LEFT JOIN gestores g ON e.gestor_id = g.user_id
        WHERE 1=1 ${allSnippets}
        ORDER BY ${orderSnippet}
        LIMIT ${limit} OFFSET ${offset}
      `),
      db.execute<{ total_alumnos: string; expediente_completo: string; pendientes: string; egresados: string }>(sql`
        SELECT
          count(*)::text AS total_alumnos,
          count(*) FILTER (WHERE (
            SELECT count(DISTINCT tipo) FROM expediente_documentos x
            WHERE x.estudiante_id = e.user_id AND x.estado = 'aprobado'
            AND tipo IN ('curp','acta_nacimiento','ine','comprobante_domicilio','certificado_secundaria')
          ) = 5)::text AS expediente_completo,
          count(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM expediente_documentos x WHERE x.estudiante_id = e.user_id
          ) AND (
            SELECT count(DISTINCT tipo) FROM expediente_documentos x
            WHERE x.estudiante_id = e.user_id AND x.estado = 'aprobado'
            AND tipo IN ('curp','acta_nacimiento','ine','comprobante_domicilio','certificado_secundaria')
          ) < 5)::text AS pendientes,
          count(*) FILTER (WHERE (
            SELECT count(*) FROM estudiantes_modulos_progreso emp
            WHERE emp.estudiante_id = e.user_id AND emp.estado = 'aprobado'
          ) >= 21)::text AS egresados
        FROM estudiantes e
      `),
    ]);

    const total = Number(countResult.rows[0]?.total ?? 0);
    const r0 = resumenResult.rows[0];

    const alumnos = rowsResult.rows.map((r) => {
      const palabras = r.nombre_completo.trim().split(/\s+/);
      const iniciales = palabras.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
      const docsAprobados = Number(r.docs_aprobados ?? 0);
      const ultimaActividad = r.ultima_actividad ? new Date(r.ultima_actividad as string | Date) : null;

      const gestorPartes = (r.gestor_nombre ?? '').trim().split(/\s+/);
      const gestorIniciales = gestorPartes.slice(0, 2).map((p: string) => p[0]?.toUpperCase() ?? '').join('');

      const ultimaActividadEn = r.ultima_actividad_en
        ? new Date(r.ultima_actividad_en as string | Date)
        : null;
      const diasSinActividad = ultimaActividadEn
        ? Math.floor((Date.now() - ultimaActividadEn.getTime()) / 86400000)
        : null;

      return {
        id: r.user_id,
        nombreCompleto: r.nombre_completo,
        iniciales,
        curp: r.curp ?? null,
        email: r.email,
        municipio: r.municipio_id ? { id: r.municipio_id, nombre: r.municipio_nombre ?? '' } : null,
        gestor: r.gestor_id ? { id: r.gestor_id, nombreCompleto: r.gestor_nombre ?? '', iniciales: gestorIniciales } : null,
        estadoExpediente: r.estado_expediente as 'activo' | 'esperando_matricula' | 'pago_pendiente' | 'en_proceso' | 'rechazado' | 'sin_documentos' | 'inactivo',
        estadoCuenta: (r.estado_cuenta ?? 'activa') as 'activa' | 'aviso_enviado' | 'soft_deleted' | 'hard_deleted',
        docsAprobados,
        docsTotal: Number(r.docs_total ?? 0),
        ultimaActividad: ultimaActividad ? ultimaActividad.toISOString() : null,
        ultimaActividadTexto: relativaActividad(ultimaActividad),
        ultimaActividadEn: ultimaActividadEn ? ultimaActividadEn.toISOString() : null,
        diasSinActividad,
        creadoEn: new Date(r.created_at as string | Date).toISOString(),
      };
    });

    res.json({
      alumnos,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      resumen: {
        totalAlumnos: Number(r0?.total_alumnos ?? 0),
        expedienteCompleto: Number(r0?.expediente_completo ?? 0),
        pendientes: Number(r0?.pendientes ?? 0),
        egresados: Number(r0?.egresados ?? 0),
      },
      filtrosAplicados: {
        desdeDigitalDashboard: !!filtroValido,
        descripcionFiltro: filtroValido ? FILTRO_DESC[filtroValido] : undefined,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno';
    res.status(500).json({ error: message });
  }
});

// ─── GET /admin/alumnos/:id ───────────────────────────────────────────────
router.get('/alumnos/:id', async (req, res) => {
  const alumnoId = Number(req.params.id);
  if (!alumnoId) { res.status(400).json({ error: 'ID inválido' }); return; }

  try {
    type AlumnoDetalleRow = {
      user_id: number;
      nombre_completo: string;
      curp: string | null;
      fecha_nacimiento: string | null;
      telefono: string | null;
      direccion: string | null;
      municipio_id: number | null;
      municipio_nombre: string | null;
      gestor_id: number | null;
      gestor_nombre: string | null;
      gestor_email: string | null;
      email: string;
      password_temporal: boolean;
      bienvenida_enviada_en: Date | null;
      ultimo_login: Date | null;
      created_at: Date;
      estado_expediente: string;
      docs_aprobados: number;
      docs_total: number;
      folio_preregistro: string | null;
      preregistro_vigente_hasta: string | null;
      matricula_oficial_dgb: string | null;
      matricula_capturada_en: Date | null;
      licencia_digital: string | null;
      licencia_emitida_en: Date | null;
    };

    type ExamenRow = {
      id: number;
      modulo_id: number;
      modulo_numero: number | null;
      modulo_nombre: string | null;
      etapa_id: number;
      etapa_clave: string | null;
      etapa: string | null;
      fase: string | null;
      anio: number | null;
      estado: string;
      calificacion: number | null;
      created_at: Date;
    };

    const [alumnoResult, docs, pagosRows, examenResult] = await Promise.all([
      db.execute<AlumnoDetalleRow>(sql`
        SELECT
          e.user_id, e.nombre_completo, e.curp,
          e.fecha_nacimiento::text AS fecha_nacimiento,
          e.telefono, e.direccion,
          e.municipio_id, m.nombre AS municipio_nombre,
          e.gestor_id, g.nombre_completo AS gestor_nombre, gu.email AS gestor_email,
          u.email, u.password_temporal, u.bienvenida_enviada_en, u.ultimo_login,
          e.created_at,
          e.folio_preregistro, e.preregistro_vigente_hasta::text AS preregistro_vigente_hasta,
          e.matricula_oficial_dgb, e.matricula_capturada_en,
          e.licencia_digital, e.licencia_emitida_en,
          CASE
            WHEN u.activo = false THEN 'inactivo'
            WHEN EXISTS (SELECT 1 FROM expediente_documentos ed WHERE ed.estudiante_id = e.user_id AND ed.estado = 'rechazado') THEN 'rechazado'
            WHEN NOT EXISTS (SELECT 1 FROM expediente_documentos ed WHERE ed.estudiante_id = e.user_id) THEN 'sin_documentos'
            WHEN (SELECT count(DISTINCT tipo) FROM expediente_documentos ed WHERE ed.estudiante_id = e.user_id AND ed.estado = 'aprobado' AND tipo IN ('curp','acta_nacimiento','ine','comprobante_domicilio','certificado_secundaria')) < 5 THEN 'en_proceso'
            WHEN NOT EXISTS (SELECT 1 FROM pagos p WHERE p.estudiante_id = e.user_id AND p.estado = 'verificado') THEN 'pago_pendiente'
            WHEN e.matricula_oficial_dgb IS NULL THEN 'esperando_matricula'
            ELSE 'activo'
          END AS estado_expediente,
          (SELECT count(*) FROM expediente_documentos ed WHERE ed.estudiante_id = e.user_id AND ed.estado = 'aprobado')::int AS docs_aprobados,
          (SELECT count(*) FROM expediente_documentos ed WHERE ed.estudiante_id = e.user_id)::int AS docs_total
        FROM estudiantes e
        LEFT JOIN users u ON e.user_id = u.id
        LEFT JOIN municipios m ON e.municipio_id = m.id
        LEFT JOIN gestores g ON e.gestor_id = g.user_id
        LEFT JOIN users gu ON g.user_id = gu.id
        WHERE e.user_id = ${alumnoId}
      `),
      db.select().from(expedienteDocumentos).where(eq(expedienteDocumentos.estudianteId, alumnoId)).orderBy(desc(expedienteDocumentos.createdAt)),
      db.select().from(pagos).where(eq(pagos.estudianteId, alumnoId)).orderBy(desc(pagos.createdAt)),
      db.execute<ExamenRow>(sql`
        SELECT
          ei.id, ei.modulo_id, ei.etapa_id, ei.estado, ei.calificacion, ei.created_at,
          mo.numero AS modulo_numero, mo.nombre AS modulo_nombre,
          ce.clave AS etapa_clave, ce.etapa, ce.fase, ce.anio
        FROM examenes_inscripciones ei
        LEFT JOIN modulos mo ON ei.modulo_id = mo.id
        LEFT JOIN convocatorias_etapas ce ON ei.etapa_id = ce.id
        WHERE ei.estudiante_id = ${alumnoId}
        ORDER BY ei.created_at DESC
      `),
    ]);

    const r = alumnoResult.rows[0];
    if (!r) { res.status(404).json({ error: 'Alumno no encontrado' }); return; }

    const palabras = r.nombre_completo.trim().split(/\s+/);
    const iniciales = palabras.slice(0, 2).map((p: string) => p[0]?.toUpperCase() ?? '').join('');

    res.json({
      alumno: {
        id: r.user_id,
        nombreCompleto: r.nombre_completo,
        iniciales,
        curp: r.curp ?? null,
        fechaNacimiento: r.fecha_nacimiento ?? null,
        telefono: r.telefono ?? null,
        direccion: r.direccion ?? null,
        municipio: r.municipio_id ? { id: r.municipio_id, nombre: r.municipio_nombre ?? '' } : null,
        gestor: r.gestor_id ? { id: r.gestor_id, nombreCompleto: r.gestor_nombre ?? '', email: r.gestor_email ?? '' } : null,
        email: r.email,
        passwordTemporal: r.password_temporal ?? false,
        bienvenidaEnviadaEn: r.bienvenida_enviada_en ? new Date(r.bienvenida_enviada_en as string | Date).toISOString() : null,
        ultimaActividad: r.ultimo_login ? new Date(r.ultimo_login as string | Date).toISOString() : null,
        estadoExpediente: r.estado_expediente as 'activo' | 'esperando_matricula' | 'pago_pendiente' | 'en_proceso' | 'rechazado' | 'sin_documentos' | 'inactivo',
        docsAprobados: Number(r.docs_aprobados ?? 0),
        docsTotal: Number(r.docs_total ?? 0),
        creadoEn: new Date(r.created_at as string | Date).toISOString(),
        folioPreregistro: r.folio_preregistro ?? null,
        preregistroVigenteHasta: r.preregistro_vigente_hasta ?? null,
        matriculaOficialDGB: r.matricula_oficial_dgb ?? null,
        matriculaCapturadaEn: r.matricula_capturada_en ? new Date(r.matricula_capturada_en as string | Date).toISOString() : null,
        licenciaDigital: r.licencia_digital ?? null,
        licenciaEmitidaEn: r.licencia_emitida_en ? new Date(r.licencia_emitida_en as string | Date).toISOString() : null,
      },
      documentos: docs.map((d) => ({
        id: d.id,
        tipo: d.tipo,
        estado: d.estado,
        motivoRechazo: d.motivoRechazo ?? null,
        rutaArchivo: d.rutaArchivo,
        nombreOriginal: d.nombreOriginal,
        tamanoBytes: d.tamanoBytes ?? null,
        subidoEn: new Date(d.subidoEn as string | Date).toISOString(),
        revisadoEn: d.revisadoEn ? new Date(d.revisadoEn as string | Date).toISOString() : null,
      })),
      pagos: pagosRows.map((p) => ({
        id: p.id,
        concepto: p.concepto,
        conceptoDetalle: p.conceptoDetalle ?? null,
        monto: p.monto,
        fechaPago: p.fechaPago,
        metodoPago: p.metodoPago,
        estado: p.estado,
        motivoRechazo: p.motivoRechazo ?? null,
        notas: p.notas ?? null,
        createdAt: new Date(p.createdAt as string | Date).toISOString(),
      })),
      examenes: examenResult.rows.map((e) => ({
        id: e.id,
        moduloId: e.modulo_id,
        moduloNumero: e.modulo_numero ?? null,
        moduloNombre: e.modulo_nombre ?? null,
        etapaId: e.etapa_id,
        etapaClave: e.etapa_clave ?? null,
        etapaFase: e.fase ?? null,
        etapaAnio: e.anio ?? null,
        estado: e.estado,
        calificacion: e.calificacion ?? null,
        createdAt: new Date(e.created_at as string | Date).toISOString(),
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno';
    res.status(500).json({ error: message });
  }
});

// ─── GET /admin/calificaciones/etapas-pendientes ──────────────────────────
router.get('/calificaciones/etapas-pendientes', async (req, res) => {
  try {
    const result = await db.execute<{
      id: number; clave: string; etapa: string; fase: string; anio: number;
      examen_sabado: string; pendientes: string;
    }>(sql`
      SELECT
        ce.id, ce.clave, ce.etapa, ce.fase, ce.anio, ce.examen_sabado,
        count(ei.id)::text AS pendientes
      FROM convocatorias_etapas ce
      JOIN examenes_inscripciones ei ON ei.etapa_id = ce.id
        AND ei.estado = 'presentado'
        AND ei.calificacion IS NULL
      GROUP BY ce.id
      ORDER BY ce.examen_sabado DESC
    `);

    res.json({
      etapas: result.rows.map((r) => ({
        id: r.id,
        clave: r.clave,
        label: `Etapa ${r.etapa} Fase ${r.fase} · ${r.anio} (${r.pendientes} pendientes)`,
        pendientes: Number(r.pendientes),
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno';
    res.status(500).json({ error: message });
  }
});

// ─── GET /admin/calificaciones/batch-list ─────────────────────────────────
router.get('/calificaciones/batch-list', async (req, res) => {
  const etapaId = parseInt(req.query.etapaId as string) || 0;
  if (!etapaId) { res.status(400).json({ error: 'etapaId requerido' }); return; }

  const moduloId = parseInt(req.query.moduloId as string) || 0;
  const sedeId = parseInt(req.query.sedeId as string) || 0;

  try {
    type InscRow = {
      id: number; folio: string; alumno_nombre: string; modulo_nombre: string;
      modulo_numero: number; fecha_examen: string; sede_nombre: string;
      estado: string; calificacion: number | null;
    };

    const modFilter = moduloId ? sql`AND ei.modulo_id = ${moduloId}` : sql``;
    const sedeFilter = sedeId ? sql`AND ei.sede_id = ${sedeId}` : sql``;

    const result = await db.execute<InscRow>(sql`
      SELECT
        ei.id,
        ei.folio,
        es.nombre_completo AS alumno_nombre,
        m.nombre AS modulo_nombre,
        m.numero AS modulo_numero,
        ce.examen_sabado::text AS fecha_examen,
        s.nombre AS sede_nombre,
        ei.estado,
        ei.calificacion
      FROM examenes_inscripciones ei
      JOIN estudiantes es ON es.user_id = ei.estudiante_id
      JOIN modulos m ON m.id = ei.modulo_id
      JOIN convocatorias_etapas ce ON ce.id = ei.etapa_id
      JOIN sedes s ON s.id = ei.sede_id
      WHERE ei.etapa_id = ${etapaId}
        AND ei.estado = 'presentado'
        AND ei.calificacion IS NULL
      ${modFilter}
      ${sedeFilter}
      ORDER BY m.numero ASC, es.nombre_completo ASC
    `);

    res.json({
      inscripciones: result.rows.map((r) => ({
        id: r.id,
        folio: r.folio,
        alumnoNombre: r.alumno_nombre,
        moduloNombre: r.modulo_nombre,
        moduloNumero: r.modulo_numero,
        fechaExamen: r.fecha_examen,
        sedeNombre: r.sede_nombre,
        estado: r.estado,
        calificacion: r.calificacion ?? null,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno';
    res.status(500).json({ error: message });
  }
});

// ─── POST /admin/calificaciones/batch ────────────────────────────────────
const batchCalifSchema = z.object({
  calificaciones: z.array(
    z.object({
      inscripcionId: z.number().int().positive(),
      calificacion: z.number().int().min(0).max(100).optional(),
      noPresento: z.boolean().optional(),
    })
  ).min(1),
});

router.post('/calificaciones/batch', async (req, res) => {
  const userId = req.user!.userId;
  const parse = batchCalifSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: 'Datos inválidos' }); return; }

  const { calificaciones: items } = parse.data;

  try {
    await db.transaction(async (tx) => {
      for (const item of items) {
        const [inscripcion] = await tx
          .select()
          .from(examenesInscripciones)
          .where(eq(examenesInscripciones.id, item.inscripcionId));

        if (!inscripcion) continue;

        if (item.noPresento) {
          await tx
            .update(examenesInscripciones)
            .set({ estado: 'no_presento' })
            .where(eq(examenesInscripciones.id, item.inscripcionId));
          continue;
        }

        if (item.calificacion === undefined) continue;

        const calif = item.calificacion;
        const aprobado = calif >= 60;
        const nuevoEstado = aprobado ? 'aprobado' : 'reprobado';

        await tx
          .update(examenesInscripciones)
          .set({ calificacion: calif, estado: nuevoEstado })
          .where(eq(examenesInscripciones.id, item.inscripcionId));

        const [etapa] = await tx
          .select({ clave: convocatoriasEtapas.clave, examenSabado: convocatoriasEtapas.examenSabado })
          .from(convocatoriasEtapas)
          .where(eq(convocatoriasEtapas.id, inscripcion.etapaId));

        await tx.insert(calificaciones).values({
          estudianteId: inscripcion.estudianteId,
          moduloId: inscripcion.moduloId,
          inscripcionExamenId: item.inscripcionId,
          etapaClave: etapa?.clave ?? 'DESCONOCIDA',
          calificacion: calif,
          aprobado,
          intento: 1,
          fechaExamen: etapa?.examenSabado ?? new Date().toISOString().slice(0, 10),
          sedeId: inscripcion.sedeId,
          capturadoPorUserId: userId,
        }).onConflictDoNothing();

        if (aprobado) {
          await tx
            .insert(estudiantesModulosProgreso)
            .values({
              estudianteId: inscripcion.estudianteId,
              moduloId: inscripcion.moduloId,
              estado: 'aprobado',
              mejorCalificacion: calif,
              ultimaCalificacion: calif,
              ultimaActividad: new Date(),
            })
            .onConflictDoUpdate({
              target: [estudiantesModulosProgreso.estudianteId, estudiantesModulosProgreso.moduloId],
              set: {
                estado: 'aprobado',
                mejorCalificacion: sql`GREATEST(EXCLUDED.mejor_calificacion, ${calif})`,
                ultimaCalificacion: calif,
                ultimaActividad: new Date(),
              },
            });
        }
      }
    });

    await tryAuditLog({
      userId,
      accion: 'capturar_calificacion_batch',
      entidad: 'calificaciones',
      detalle: `Capturó ${items.length} calificaciones en lote`,
      metadata: { count: items.length },
      req,
    });

    res.json({ ok: true, procesadas: items.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno';
    res.status(500).json({ error: message });
  }
});

// ─── GET /admin/gestores/:gestorId ───────────────────────────────────────
router.get('/gestores/:gestorId', async (req, res) => {
  const gestorId = Number(req.params.gestorId);
  if (!gestorId) { res.status(400).json({ error: 'ID inválido' }); return; }

  try {
    type GestorDetailRow = {
      user_id: number;
      nombre_completo: string;
      titulo: string | null;
      email_publico: string | null;
      telefono: string | null;
      municipio_id: number | null;
      municipio_nombre: string | null;
      estado: string;
      capacidad_maxima: number;
      email: string;
      ultimo_login: Date | null;
      total_alumnos: number;
      expedientes_completos: number;
      egresados: number;
      sin_reasignar: number | null;
      alumnos_nuevos_este_mes: number;
      docs_por_revisar: number;
      calificacion_promedio: number | null;
    };

    const result = await db.execute<GestorDetailRow>(sql`
      SELECT
        g.user_id,
        g.nombre_completo,
        g.titulo,
        g.email_publico,
        g.telefono,
        g.municipio_id,
        m.nombre AS municipio_nombre,
        g.estado,
        g.capacidad_maxima,
        u.email,
        u.ultimo_login,
        (SELECT count(*) FROM estudiantes e WHERE e.gestor_id = g.user_id)::int AS total_alumnos,
        (SELECT count(*) FROM estudiantes e WHERE e.gestor_id = g.user_id AND (
          SELECT count(DISTINCT tipo) FROM expediente_documentos x
          WHERE x.estudiante_id = e.user_id AND x.estado = 'aprobado'
          AND tipo IN ('curp','acta_nacimiento','ine','comprobante_domicilio','certificado_secundaria')
        ) = 5)::int AS expedientes_completos,
        (SELECT count(*) FROM estudiantes e WHERE e.gestor_id = g.user_id AND (
          SELECT count(*) FROM estudiantes_modulos_progreso emp
          WHERE emp.estudiante_id = e.user_id AND emp.estado = 'aprobado'
        ) >= 21)::int AS egresados,
        CASE WHEN g.estado = 'inactivo' THEN
          (SELECT count(*) FROM estudiantes e WHERE e.gestor_id = g.user_id)::int
        ELSE NULL END AS sin_reasignar,
        (SELECT count(*) FROM estudiantes e WHERE e.gestor_id = g.user_id
          AND e.created_at >= date_trunc('month', now()))::int AS alumnos_nuevos_este_mes,
        (SELECT count(*) FROM expediente_documentos ed
          JOIN estudiantes e ON e.user_id = ed.estudiante_id
          WHERE e.gestor_id = g.user_id AND ed.estado = 'pendiente_revision')::int AS docs_por_revisar,
        (SELECT round(avg(c.calificacion), 1) FROM calificaciones c
          JOIN estudiantes e ON e.user_id = c.estudiante_id
          WHERE e.gestor_id = g.user_id) AS calificacion_promedio
      FROM gestores g
      LEFT JOIN municipios m ON g.municipio_id = m.id
      LEFT JOIN users u ON g.user_id = u.id
      WHERE g.user_id = ${gestorId}
    `);

    const r = result.rows[0];
    if (!r) { res.status(404).json({ error: 'Gestor no encontrado' }); return; }

    const partes = (r.nombre_completo ?? '').trim().split(/\s+/);
    const iniciales = partes.slice(0, 2).map((p: string) => p[0]?.toUpperCase() ?? '').join('');
    const totalAlumnos = Number(r.total_alumnos ?? 0);
    const expedientesCompletos = Number(r.expedientes_completos ?? 0);
    const egresados = Number(r.egresados ?? 0);
    const pendientes = totalAlumnos - expedientesCompletos;
    const tasaExito = totalAlumnos > 0 ? Math.round((expedientesCompletos / totalAlumnos) * 100) : 0;
    const tasaExitoNivel: 'alta' | 'media' | 'baja' = tasaExito >= 70 ? 'alta' : tasaExito >= 50 ? 'media' : 'baja';
    const ultimaActividad = r.ultimo_login ? new Date(r.ultimo_login as string | Date) : null;
    const sinReasignar = r.sin_reasignar != null ? Number(r.sin_reasignar) : null;

    res.json({
      id: r.user_id,
      userId: r.user_id,
      nombreCompleto: r.nombre_completo,
      iniciales,
      titulo: r.titulo ?? null,
      email: r.email,
      telefono: r.telefono ?? null,
      municipio: r.municipio_id ? { id: r.municipio_id, nombre: r.municipio_nombre ?? '' } : null,
      estado: r.estado as 'activo' | 'inactivo',
      capacidadMaxima: r.capacidad_maxima,
      metricas: {
        totalAlumnos,
        expedientesCompletos,
        pendientes,
        egresados,
        tasaExito,
        tasaExitoNivel,
      },
      ultimaActividad: ultimaActividad ? ultimaActividad.toISOString() : null,
      ultimaActividadTexto: relativaActividad(ultimaActividad),
      alertas: sinReasignar != null ? { sinReasignar } : null,
      alumnosNuevosEsteMes: Number(r.alumnos_nuevos_este_mes ?? 0),
      docsPorRevisar: Number(r.docs_por_revisar ?? 0),
      calificacionPromedio: r.calificacion_promedio != null ? Number(r.calificacion_promedio) : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno';
    res.status(500).json({ error: message });
  }
});

// ─── POST /admin/gestores ─────────────────────────────────────────────────
const crearGestorSchema = z.object({
  nombre: z.string().min(1),
  apellidos: z.string().min(1),
  email: z.string().email(),
  municipioId: z.number().int().positive(),
  titulo: z.string().optional(),
  telefono: z.string().optional(),
  capacidadMaxima: z.number().int().positive().optional(),
});

router.post('/gestores', async (req, res) => {
  const parse = crearGestorSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Datos inválidos', detalles: parse.error.issues });
    return;
  }
  const data = parse.data;
  const nombreCompleto = `${data.nombre} ${data.apellidos}`.trim();

  try {
    const [emailExists] = await db.select({ id: users.id }).from(users).where(eq(users.email, data.email));
    if (emailExists) {
      res.status(409).json({ error: 'Ya existe una cuenta con ese correo electrónico' });
      return;
    }

    const tempPassword = generarPasswordTemporal();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const newGestor = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email: data.email,
          passwordHash,
          rol: 'gestor',
          activo: true,
          passwordTemporal: true,
        })
        .returning();

      const [gestor] = await tx
        .insert(gestores)
        .values({
          userId: user.id,
          nombreCompleto,
          municipioId: data.municipioId,
          capacidadMaxima: data.capacidadMaxima ?? 50,
          titulo: data.titulo ?? 'Gestor Municipal',
          telefono: data.telefono ?? undefined,
          estado: 'activo',
        })
        .returning();

      return { user, gestor };
    });

    const [munRow] = await db.select({ nombre: municipios.nombre }).from(municipios).where(eq(municipios.id, data.municipioId));
    const municipioNombre = munRow?.nombre ?? 'sin municipio';

    let emailEnviado = false;
    try {
      const emailResult = await sendBienvenidaGestor(data.email, {
        nombreGestor: nombreCompleto,
        email: data.email,
        passwordTemporal: tempPassword,
        municipio: municipioNombre,
        portalUrl: process.env.PUBLIC_PORTAL_URL || 'http://localhost:5173/login',
      }, { triggeredBy: req.user!.userId, relatedUserId: newGestor.user.id });
      emailEnviado = emailResult.enviado;
      if (emailEnviado) {
        await db.update(users).set({ bienvenidaEnviadaEn: new Date() }).where(eq(users.id, newGestor.user.id));
      }
    } catch {}

    res.status(201).json({
      ok: true,
      gestor: {
        id: newGestor.gestor.userId,
        userId: newGestor.gestor.userId,
        nombreCompleto,
        email: data.email,
        municipioId: data.municipioId,
        capacidadMaxima: newGestor.gestor.capacidadMaxima,
        estado: newGestor.gestor.estado,
      },
      emailEnviado,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno';
    res.status(500).json({ error: message });
  }
});

// ─── PATCH /admin/gestores/:gestorId ─────────────────────────────────────
const patchGestorSchema = z.object({
  nombreCompleto: z.string().min(1).optional(),
  titulo: z.string().optional(),
  telefono: z.string().optional(),
  capacidadMaxima: z.number().int().positive().optional(),
});

router.patch('/gestores/:gestorId', async (req, res) => {
  const gestorId = Number(req.params.gestorId);
  if (!gestorId) { res.status(400).json({ error: 'ID inválido' }); return; }

  const parse = patchGestorSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: 'Datos inválidos' }); return; }

  const data = parse.data;
  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: 'No se proporcionaron campos a actualizar' });
    return;
  }

  try {
    const [existente] = await db.select({ userId: gestores.userId }).from(gestores).where(eq(gestores.userId, gestorId));
    if (!existente) { res.status(404).json({ error: 'Gestor no encontrado' }); return; }

    const setValues: Record<string, unknown> = { updatedAt: new Date() };
    if (data.nombreCompleto !== undefined) setValues.nombreCompleto = data.nombreCompleto;
    if (data.titulo !== undefined) setValues.titulo = data.titulo;
    if (data.telefono !== undefined) setValues.telefono = data.telefono;
    if (data.capacidadMaxima !== undefined) setValues.capacidadMaxima = data.capacidadMaxima;

    await db.update(gestores).set(setValues).where(eq(gestores.userId, gestorId));

    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno';
    res.status(500).json({ error: message });
  }
});

// ─── POST /admin/gestores/:gestorId/reset-password ────────────────────────
router.post('/gestores/:gestorId/reset-password', async (req, res) => {
  const gestorId = Number(req.params.gestorId);
  if (!gestorId) { res.status(400).json({ error: 'ID inválido' }); return; }

  try {
    const [gestor] = await db
      .select({ nombreCompleto: gestores.nombreCompleto })
      .from(gestores)
      .where(eq(gestores.userId, gestorId));
    if (!gestor) { res.status(404).json({ error: 'Gestor no encontrado' }); return; }

    const [userRow] = await db.select({ email: users.email }).from(users).where(eq(users.id, gestorId));
    if (!userRow) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }

    const tempPassword = generarPasswordTemporal();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    await db.update(users)
      .set({ passwordHash, passwordTemporal: true, bienvenidaEnviadaEn: null, updatedAt: new Date() })
      .where(eq(users.id, gestorId));

    let emailEnviado = false;
    try {
      const emailResult = await sendBienvenidaCredenciales(userRow.email, {
        nombreAlumno: gestor.nombreCompleto,
        email: userRow.email,
        passwordTemporal: tempPassword,
        portalUrl: process.env.PUBLIC_PORTAL_URL || 'http://localhost:5173/login',
      });
      emailEnviado = emailResult.enviado;
      if (emailEnviado) {
        await db.update(users).set({ bienvenidaEnviadaEn: new Date() }).where(eq(users.id, gestorId));
      }
    } catch {}

    res.json({ ok: true, emailEnviado });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno';
    res.status(500).json({ error: message });
  }
});

// ─── POST /admin/gestores/:gestorId/desactivar ────────────────────────────
const desactivarGestorSchema = z.object({
  razon: z.string().optional(),
  reasignarAGestorId: z.number().int().positive().optional(),
});

router.post('/gestores/:gestorId/desactivar', async (req, res) => {
  const gestorId = Number(req.params.gestorId);
  if (!gestorId) { res.status(400).json({ error: 'ID inválido' }); return; }

  const parse = desactivarGestorSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: 'Datos inválidos' }); return; }
  const { razon, reasignarAGestorId } = parse.data;
  const adminId = (req as any).user?.userId ?? req.user!.userId;

  try {
    const [gestor] = await db.select({ estado: gestores.estado }).from(gestores).where(eq(gestores.userId, gestorId));
    if (!gestor) { res.status(404).json({ error: 'Gestor no encontrado' }); return; }
    if (gestor.estado === 'inactivo') {
      res.status(400).json({ error: 'El gestor ya está inactivo' });
      return;
    }

    let alumnosReasignados = 0;

    await db.transaction(async (tx) => {
      await tx.update(gestores)
        .set({
          estado: 'inactivo',
          desactivadoEn: new Date(),
          desactivadoPorUserId: adminId,
          razonDesactivacion: razon ?? null,
          updatedAt: new Date(),
        })
        .where(eq(gestores.userId, gestorId));

      await tx.update(users)
        .set({ activo: false, updatedAt: new Date() })
        .where(eq(users.id, gestorId));

      if (reasignarAGestorId) {
        const result = await tx.execute(sql`
          UPDATE estudiantes SET gestor_id = ${reasignarAGestorId}, updated_at = now()
          WHERE gestor_id = ${gestorId}
        `);
        alumnosReasignados = Number(result.rowCount ?? 0);
      }
    });

    res.json({ ok: true, alumnosReasignados });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno';
    res.status(500).json({ error: message });
  }
});

// ─── POST /admin/gestores/:gestorId/reasignar-alumnos ────────────────────
const reasignarAlumnosSchema = z.object({
  aGestorId: z.number().int().positive(),
  razon: z.string().optional(),
});

router.post('/gestores/:gestorId/reasignar-alumnos', async (req, res) => {
  const gestorId = Number(req.params.gestorId);
  if (!gestorId) { res.status(400).json({ error: 'ID inválido' }); return; }

  const parse = reasignarAlumnosSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: 'Datos inválidos' }); return; }
  const { aGestorId } = parse.data;

  try {
    const [gestor] = await db.select({ userId: gestores.userId }).from(gestores).where(eq(gestores.userId, gestorId));
    if (!gestor) { res.status(404).json({ error: 'Gestor origen no encontrado' }); return; }

    const [destino] = await db.select({ userId: gestores.userId }).from(gestores).where(eq(gestores.userId, aGestorId));
    if (!destino) { res.status(404).json({ error: 'Gestor destino no encontrado' }); return; }

    const result = await db.execute(sql`
      UPDATE estudiantes SET gestor_id = ${aGestorId}, updated_at = now()
      WHERE gestor_id = ${gestorId}
    `);
    const alumnosReasignados = Number(result.rowCount ?? 0);

    res.json({ ok: true, alumnosReasignados });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno';
    res.status(500).json({ error: message });
  }
});

// ─── POST /admin/gestores/:gestorId/activar ───────────────────────────────
router.post('/gestores/:gestorId/activar', async (req, res) => {
  const gestorId = Number(req.params.gestorId);
  if (!gestorId) { res.status(400).json({ error: 'ID inválido' }); return; }

  try {
    const [gestor] = await db.select({ estado: gestores.estado }).from(gestores).where(eq(gestores.userId, gestorId));
    if (!gestor) { res.status(404).json({ error: 'Gestor no encontrado' }); return; }
    if (gestor.estado === 'activo') {
      res.status(400).json({ error: 'El gestor ya está activo' });
      return;
    }

    await db.transaction(async (tx) => {
      await tx.update(gestores)
        .set({
          estado: 'activo',
          desactivadoEn: null,
          desactivadoPorUserId: null,
          updatedAt: new Date(),
        })
        .where(eq(gestores.userId, gestorId));

      await tx.update(users)
        .set({ activo: true, updatedAt: new Date() })
        .where(eq(users.id, gestorId));
    });

    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno';
    res.status(500).json({ error: message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Solicitudes de Cuenta — new rich endpoints
// ═══════════════════════════════════════════════════════════════════════════

function calcUrgencia(createdAt: Date): 'alta' | 'media' | 'baja' {
  const dias = Math.floor((Date.now() - createdAt.getTime()) / 86400000);
  if (dias > 7) return 'alta';
  if (dias >= 3) return 'media';
  return 'baja';
}

function fechaTextoSolicitud(createdAt: Date): string {
  const dias = Math.floor((Date.now() - createdAt.getTime()) / 86400000);
  if (dias === 0) {
    const hhmm = createdAt.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    return `Hoy ${hhmm}`;
  }
  if (dias === 1) return 'Ayer';
  return `Hace ${dias} días`;
}

function calcEdad(fechaNac: string): number {
  const hoy = new Date();
  const nac = new Date(fechaNac);
  let age = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) age--;
  return age;
}

// ─── GET /admin/solicitudes ───────────────────────────────────────────────
router.get('/solicitudes', async (req, res) => {
  const estado = (req.query.estado as string) || 'pendiente';
  if (!['pendiente', 'aprobada', 'rechazada'].includes(estado)) {
    res.status(400).json({ error: 'estado inválido' }); return;
  }

  const search = (req.query.search as string)?.trim() || null;
  const municipioId = req.query.municipioId ? Number(req.query.municipioId) : null;
  const urgenciaFiltro = req.query.urgencia as string | undefined;
  const mes = req.query.mes as string | undefined; // YYYY-MM
  const sortByParam = req.query.sortBy === 'mas_reciente' ? 'DESC' : 'ASC';
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  try {
    type SolicitudRow = {
      id: number; folio: string | null; nombre_completo: string; curp: string; email: string;
      telefono: string; fecha_nacimiento: string; municipio_id: number; municipio_nombre: string | null;
      ultimo_nivel_cursado: string | null; anio_ultimo_nivel: number | null;
      justificacion: string | null; mensaje: string | null;
      modalidad_preferida: string | null; disponibilidad: string | null;
      estado: string; procesada_por_user_id: number | null; procesada_en: Date | null;
      procesada_por_nombre: string | null;
      gestor_asignado_id: number | null; gestor_asignado_nombre: string | null;
      estudiante_creado_id: number | null;
      motivo_rechazo: string | null; detalles_rechazo: string | null; notas_internas: string | null;
      created_at: Date;
    };

    // Build safe WHERE conditions using sql template
    const whereParts: ReturnType<typeof sql>[] = [sql`sc.estado = ${estado}`];
    if (search) {
      const s = `%${search}%`;
      whereParts.push(sql`(sc.nombre_completo ILIKE ${s} OR sc.curp ILIKE ${s} OR sc.email ILIKE ${s})`);
    }
    if (municipioId) whereParts.push(sql`sc.municipio_id = ${municipioId}`);
    if (mes) {
      whereParts.push(sql`date_trunc('month', sc.created_at) = date_trunc('month', ${mes + '-01'}::date)`);
    }

    const whereClause = whereParts.reduce((acc, part, i) =>
      i === 0 ? part : sql`${acc} AND ${part}`
    );

    const sortSql = sortByParam === 'DESC' ? sql`DESC` : sql`ASC`;

    const [rowsResult, countResult, resResult] = await Promise.all([
      db.execute<SolicitudRow>(sql`
        SELECT
          sc.id, sc.folio, sc.nombre_completo, sc.curp, sc.email, sc.telefono,
          sc.fecha_nacimiento::text, sc.municipio_id, m.nombre AS municipio_nombre,
          sc.ultimo_nivel_cursado, sc.anio_ultimo_nivel,
          sc.justificacion, sc.mensaje,
          sc.modalidad_preferida, sc.disponibilidad,
          sc.estado, sc.procesada_por_user_id, sc.procesada_en,
          upro.nombre_completo AS procesada_por_nombre,
          sc.gestor_asignado_id, g.nombre_completo AS gestor_asignado_nombre,
          sc.estudiante_creado_id,
          sc.motivo_rechazo, sc.detalles_rechazo, sc.notas_internas,
          sc.created_at
        FROM solicitudes_cuenta sc
        LEFT JOIN municipios m ON m.id = sc.municipio_id
        LEFT JOIN gestores upro ON upro.user_id = sc.procesada_por_user_id
        LEFT JOIN gestores g ON g.user_id = sc.gestor_asignado_id
        WHERE ${whereClause}
        ORDER BY sc.created_at ${sortSql}
        LIMIT ${limit} OFFSET ${offset}
      `),
      db.execute<{ total: number }>(sql`
        SELECT count(*)::int AS total FROM solicitudes_cuenta sc WHERE ${whereClause}
      `),
      db.execute<{
        pendientes: number; urgentes: number;
        aprobadas_mes: number; rechazadas_mes: number;
        promedio_dias: number | null;
      }>(sql`
        SELECT
          (SELECT count(*)::int FROM solicitudes_cuenta WHERE estado = 'pendiente') AS pendientes,
          (SELECT count(*)::int FROM solicitudes_cuenta WHERE estado = 'pendiente'
            AND created_at < now() - interval '7 days') AS urgentes,
          (SELECT count(*)::int FROM solicitudes_cuenta WHERE estado = 'aprobada'
            AND date_trunc('month', procesada_en) = date_trunc('month', now())) AS aprobadas_mes,
          (SELECT count(*)::int FROM solicitudes_cuenta WHERE estado = 'rechazada'
            AND date_trunc('month', procesada_en) = date_trunc('month', now())) AS rechazadas_mes,
          (SELECT round(avg(extract(epoch FROM (procesada_en - created_at)) / 86400), 1)
            FROM solicitudes_cuenta WHERE estado = 'aprobada'
            AND date_trunc('month', procesada_en) = date_trunc('month', now())) AS promedio_dias
      `),
    ]);

    const total = Number(countResult.rows[0]?.total ?? 0);
    const res2 = resResult.rows[0];
    const pendientes = Number(res2?.pendientes ?? 0);
    const urgentes = Number(res2?.urgentes ?? 0);
    const aprobadasMes = Number(res2?.aprobadas_mes ?? 0);
    const rechazadasMes = Number(res2?.rechazadas_mes ?? 0);
    const promDias = res2?.promedio_dias != null ? `${res2.promedio_dias} días` : '—';

    const solicitudes = rowsResult.rows.map((r) => {
      const createdAt = new Date(r.created_at);
      const dias = Math.floor((Date.now() - createdAt.getTime()) / 86400000);
      const urgencia = calcUrgencia(createdAt);
      if (urgenciaFiltro && urgenciaFiltro !== urgencia) return null;
      const partes = (r.nombre_completo ?? '').trim().split(/\s+/);
      const iniciales = partes.slice(0, 2).map((p: string) => p[0]?.toUpperCase() ?? '').join('');
      return {
        id: r.id,
        folio: r.folio ?? `SOL-${String(r.id).padStart(4, '0')}`,
        nombreCompleto: r.nombre_completo,
        iniciales,
        curp: r.curp,
        email: r.email,
        telefono: r.telefono,
        fechaNacimiento: r.fecha_nacimiento,
        edad: calcEdad(r.fecha_nacimiento),
        municipio: r.municipio_id ? { id: r.municipio_id, nombre: r.municipio_nombre ?? '' } : null,
        ultimoNivelCursado: r.ultimo_nivel_cursado,
        anioUltimoNivel: r.anio_ultimo_nivel,
        justificacion: r.justificacion ?? r.mensaje,
        modalidadPreferida: r.modalidad_preferida,
        disponibilidad: r.disponibilidad,
        estado: r.estado,
        procesadaPorUserId: r.procesada_por_user_id,
        procesadaEn: r.procesada_en ? new Date(r.procesada_en as string | Date).toISOString() : null,
        procesadaPor: r.procesada_por_nombre
          ? { nombreCorto: r.procesada_por_nombre.split(' ').slice(0, 2).join(' ') }
          : null,
        gestorAsignado: r.gestor_asignado_id
          ? { id: r.gestor_asignado_id, nombreCorto: (r.gestor_asignado_nombre ?? '').split(' ').slice(0, 2).join(' ') }
          : null,
        estudianteCreadoId: r.estudiante_creado_id,
        motivoRechazo: r.motivo_rechazo,
        detallesRechazo: r.detalles_rechazo,
        notasInternas: r.notas_internas,
        createdAt: createdAt.toISOString(),
        diasDesdeCreacion: dias,
        urgencia,
        fechaTexto: fechaTextoSolicitud(createdAt),
      };
    }).filter((x): x is NonNullable<typeof x> => x !== null);

    res.json({
      solicitudes,
      total: urgenciaFiltro ? solicitudes.length : total,
      page,
      totalPages: Math.ceil((urgenciaFiltro ? solicitudes.length : total) / limit),
      resumen: {
        pendientes,
        pendientesUrgentes: urgentes,
        aprobadasEsteMes: aprobadasMes,
        rechazadasEsteMes: rechazadasMes,
        tiempoPromedioAprobacion: promDias,
        tasaEnvioCredenciales: 100,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno';
    res.status(500).json({ error: message });
  }
});

// ─── GET /admin/solicitudes/:solicitudId ──────────────────────────────────
router.get('/solicitudes/:solicitudId', async (req, res) => {
  const id = Number(req.params.solicitudId);
  if (!id) { res.status(400).json({ error: 'ID inválido' }); return; }

  try {
    type SolicitudDetailRow = {
      id: number; folio: string | null; nombre_completo: string; curp: string; email: string;
      telefono: string; fecha_nacimiento: string; municipio_id: number; municipio_nombre: string | null;
      ultimo_nivel_cursado: string | null; anio_ultimo_nivel: number | null;
      justificacion: string | null; mensaje: string | null;
      modalidad_preferida: string | null; disponibilidad: string | null;
      estado: string; procesada_por_user_id: number | null; procesada_en: Date | null;
      procesada_por_nombre: string | null;
      gestor_asignado_id: number | null; gestor_asignado_nombre: string | null;
      estudiante_creado_id: number | null;
      motivo_rechazo: string | null; detalles_rechazo: string | null; notas_internas: string | null;
      created_at: Date;
    };

    const result = await db.execute<SolicitudDetailRow>(sql`
      SELECT
        sc.id, sc.folio, sc.nombre_completo, sc.curp, sc.email, sc.telefono,
        sc.fecha_nacimiento::text, sc.municipio_id, m.nombre AS municipio_nombre,
        sc.ultimo_nivel_cursado, sc.anio_ultimo_nivel,
        sc.justificacion, sc.mensaje,
        sc.modalidad_preferida, sc.disponibilidad,
        sc.estado, sc.procesada_por_user_id, sc.procesada_en,
        upro.nombre_completo AS procesada_por_nombre,
        sc.gestor_asignado_id, g.nombre_completo AS gestor_asignado_nombre,
        sc.estudiante_creado_id,
        sc.motivo_rechazo, sc.detalles_rechazo, sc.notas_internas,
        sc.created_at
      FROM solicitudes_cuenta sc
      LEFT JOIN municipios m ON m.id = sc.municipio_id
      LEFT JOIN gestores upro ON upro.user_id = sc.procesada_por_user_id
      LEFT JOIN gestores g ON g.user_id = sc.gestor_asignado_id
      WHERE sc.id = ${id}
    `);

    const r = result.rows[0];
    if (!r) { res.status(404).json({ error: 'Solicitud no encontrada' }); return; }

    const createdAt = new Date(r.created_at);
    const dias = Math.floor((Date.now() - createdAt.getTime()) / 86400000);
    const partes = (r.nombre_completo ?? '').trim().split(/\s+/);
    const iniciales = partes.slice(0, 2).map((p: string) => p[0]?.toUpperCase() ?? '').join('');

    res.json({
      id: r.id,
      folio: r.folio ?? `SOL-${String(r.id).padStart(4, '0')}`,
      nombreCompleto: r.nombre_completo,
      iniciales,
      curp: r.curp,
      email: r.email,
      telefono: r.telefono,
      fechaNacimiento: r.fecha_nacimiento,
      edad: calcEdad(r.fecha_nacimiento),
      municipio: r.municipio_id ? { id: r.municipio_id, nombre: r.municipio_nombre ?? '' } : null,
      ultimoNivelCursado: r.ultimo_nivel_cursado,
      anioUltimoNivel: r.anio_ultimo_nivel,
      justificacion: r.justificacion ?? r.mensaje,
      modalidadPreferida: r.modalidad_preferida,
      disponibilidad: r.disponibilidad,
      estado: r.estado,
      procesadaPorUserId: r.procesada_por_user_id,
      procesadaEn: r.procesada_en ? (r.procesada_en as Date).toISOString() : null,
      procesadaPor: r.procesada_por_nombre
        ? { nombreCorto: r.procesada_por_nombre.split(' ').slice(0, 2).join(' ') }
        : null,
      gestorAsignado: r.gestor_asignado_id
        ? { id: r.gestor_asignado_id, nombreCorto: (r.gestor_asignado_nombre ?? '').split(' ').slice(0, 2).join(' ') }
        : null,
      estudianteCreadoId: r.estudiante_creado_id,
      motivoRechazo: r.motivo_rechazo,
      detallesRechazo: r.detalles_rechazo,
      notasInternas: r.notas_internas,
      createdAt: createdAt.toISOString(),
      diasDesdeCreacion: dias,
      urgencia: calcUrgencia(createdAt),
      fechaTexto: fechaTextoSolicitud(createdAt),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno';
    res.status(500).json({ error: message });
  }
});

// ─── POST /admin/solicitudes/:solicitudId/aprobar ────────────────────────
const aprobarSolicitudV2Schema = z.object({
  gestorAsignadoId: z.number().int().positive().optional(),
  notasInternas: z.string().optional(),
  comentarioAdmin: z.string().optional(),
});

router.post('/solicitudes/:solicitudId/aprobar', async (req, res) => {
  const solicitudId = Number(req.params.solicitudId);
  if (!solicitudId) { res.status(400).json({ error: 'ID inválido' }); return; }

  const parse = aprobarSolicitudV2Schema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: 'Datos inválidos' }); return; }
  const { gestorAsignadoId, notasInternas, comentarioAdmin } = parse.data;

  const [solicitud] = await db
    .select()
    .from(solicitudesCuenta)
    .where(eq(solicitudesCuenta.id, solicitudId));

  if (!solicitud) { res.status(404).json({ error: 'Solicitud no encontrada' }); return; }
  if (solicitud.estado !== 'pendiente') {
    res.status(400).json({ error: `La solicitud ya fue procesada (estado: ${solicitud.estado})` });
    return;
  }

  // Check email is not already taken
  const [emailExists] = await db.select().from(users).where(eq(users.email, solicitud.email));
  if (emailExists) {
    res.status(409).json({ error: 'Ya existe una cuenta con ese correo electrónico' });
    return;
  }

  // Validate gestor capacity if provided
  if (gestorAsignadoId) {
    const capacityResult = await db.execute<{ total_alumnos: number; capacidad_maxima: number }>(sql`
      SELECT
        g.capacidad_maxima,
        (SELECT count(*)::int FROM estudiantes e WHERE e.gestor_id = g.user_id) AS total_alumnos
      FROM gestores g WHERE g.user_id = ${gestorAsignadoId}
    `);
    const cap = capacityResult.rows[0];
    if (cap && Number(cap.total_alumnos) >= Number(cap.capacidad_maxima)) {
      res.status(400).json({ error: 'El gestor seleccionado ya alcanzó su capacidad máxima de alumnos' });
      return;
    }
  }

  const tempPassword = generarPasswordTemporal();
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  const adminId = req.user!.userId;

  // Get gestor info if assigning
  let gestorInfo: { nombre: string; telefono: string | null; municipio: string | null } | undefined;
  if (gestorAsignadoId) {
    const [g] = await db
      .select({ nombre: gestores.nombreCompleto, telefono: gestores.telefonoPublico, municipioId: gestores.municipioId })
      .from(gestores)
      .where(eq(gestores.userId, gestorAsignadoId));
    if (g) {
      const [mun] = await db.select({ nombre: municipios.nombre }).from(municipios).where(eq(municipios.id, g.municipioId));
      gestorInfo = { nombre: g.nombre, telefono: g.telefono ?? null, municipio: mun?.nombre ?? null };
    }
  }

  const newUser = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        email: solicitud.email,
        passwordHash,
        rol: 'estudiante',
        passwordTemporal: true,
        privacidadAceptadaEn: new Date(),
      })
      .returning();

    await tx.insert(estudiantes).values({
      userId: user.id,
      nombreCompleto: solicitud.nombreCompleto,
      nombres: solicitud.nombres,
      apellidoPaterno: solicitud.apellidoPaterno,
      apellidoMaterno: solicitud.apellidoMaterno,
      curp: solicitud.curp,
      fechaNacimiento: solicitud.fechaNacimiento,
      sexo: solicitud.sexo,
      lugarNacimiento: solicitud.lugarNacimiento,
      entidadNacimiento: solicitud.entidadNacimiento,
      estadoCivil: solicitud.estadoCivil,
      ultimoEstudio: solicitud.ultimoEstudio,
      telefono: solicitud.telefono,
      direccion: armarDireccion(solicitud) || null,
      calleNumero: solicitud.calleNumero,
      colonia: solicitud.colonia,
      cp: solicitud.cp,
      ciudad: solicitud.ciudad,
      estadoDomicilio: solicitud.estadoDomicilio,
      municipioId: solicitud.municipioId,
      gestorId: gestorAsignadoId ?? null,
      emailVerificado: true,
      registroTipo: 'solicitud_cuenta',
    });

    // Inscribir en convocatoria activa si existe
    const [convActiva] = await tx
      .select()
      .from(convocatorias)
      .where(eq(convocatorias.estado, 'abierta'))
      .limit(1);
    if (convActiva) {
      await tx.insert(inscripciones).values({
        estudianteId: user.id,
        convocatoriaId: convActiva.id,
        estado: 'documentos_pendientes',
        creadoPorUserId: adminId,
      });
    }

    await tx
      .update(solicitudesCuenta)
      .set({
        estado: 'aprobada',
        procesadaPorUserId: adminId,
        procesadaEn: new Date(),
        gestorAsignadoId: gestorAsignadoId ?? null,
        estudianteCreadoId: user.id,
        notasInternas: notasInternas ?? null,
        comentarioAdmin: comentarioAdmin ?? null,
      })
      .where(eq(solicitudesCuenta.id, solicitudId));

    return user;
  });

  await tryAuditLog({
    userId: adminId,
    accion: 'aprobar_solicitud_cuenta',
    entidad: 'solicitudes_cuenta',
    entidadId: solicitudId,
    detalle: `Aprobó solicitud de cuenta de ${solicitud.nombreCompleto} (nuevo userId: ${newUser.id})`,
    metadata: { nuevoUserId: newUser.id, gestorAsignadoId: gestorAsignadoId ?? null },
    req,
  });

  // Send welcome email
  let emailEnviado = false;
  let modoEmail: 'dev' | 'production' = 'dev';
  try {
    const emailResult = await sendBienvenidaCredenciales(solicitud.email, {
      nombreAlumno: solicitud.nombreCompleto,
      email: solicitud.email,
      passwordTemporal: tempPassword,
      portalUrl: process.env.PUBLIC_PORTAL_URL || 'http://localhost:5173/login',
      gestor: gestorInfo,
    });
    emailEnviado = emailResult.enviado;
    modoEmail = emailResult.modo;
    if (emailEnviado) {
      await db.update(users).set({ bienvenidaEnviadaEn: new Date() }).where(eq(users.id, newUser.id));
    }
  } catch {}

  res.status(201).json({
    ok: true,
    alumno: { userId: newUser.id, email: solicitud.email, nombreCompleto: solicitud.nombreCompleto },
    emailEnviado,
    modoEmail,
    ...(modoEmail === 'dev' ? { credencialTemporal: tempPassword } : {}),
  });
});

// ─── POST /admin/solicitudes/:solicitudId/rechazar ───────────────────────
const rechazarSolicitudV2Schema = z.object({
  motivoRechazo: z.string().min(1),
  detallesRechazo: z.string().optional(),
  notasInternas: z.string().optional(),
});

router.post('/solicitudes/:solicitudId/rechazar', async (req, res) => {
  const solicitudId = Number(req.params.solicitudId);
  if (!solicitudId) { res.status(400).json({ error: 'ID inválido' }); return; }

  const parse = rechazarSolicitudV2Schema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: 'Datos inválidos', detalles: parse.error.issues }); return; }
  const { motivoRechazo, detallesRechazo, notasInternas } = parse.data;

  const [solicitud] = await db
    .select()
    .from(solicitudesCuenta)
    .where(eq(solicitudesCuenta.id, solicitudId));
  if (!solicitud) { res.status(404).json({ error: 'Solicitud no encontrada' }); return; }
  if (solicitud.estado !== 'pendiente') {
    res.status(400).json({ error: `La solicitud ya fue procesada (estado: ${solicitud.estado})` });
    return;
  }

  await db
    .update(solicitudesCuenta)
    .set({
      estado: 'rechazada',
      procesadaPorUserId: req.user!.userId,
      procesadaEn: new Date(),
      motivoRechazo,
      detallesRechazo: detallesRechazo ?? null,
      notasInternas: notasInternas ?? null,
      comentarioAdmin: motivoRechazo,
    })
    .where(eq(solicitudesCuenta.id, solicitudId));

  await tryAuditLog({
    userId: req.user!.userId,
    accion: 'rechazar_solicitud_cuenta',
    entidad: 'solicitudes_cuenta',
    entidadId: solicitudId,
    detalle: `Rechazó solicitud de cuenta ID ${solicitudId}: ${motivoRechazo}`,
    metadata: { motivoRechazo, detallesRechazo: detallesRechazo ?? null },
    req,
  });

  res.json({ ok: true });
});

// ─── GET /admin/gestores-disponibles ─────────────────────────────────────
router.get('/gestores-disponibles', async (req, res) => {
  const municipioId = req.query.municipioId ? Number(req.query.municipioId) : null;

  try {
    type GestorDisp = {
      user_id: number; nombre_completo: string; municipio_id: number | null;
      municipio_nombre: string | null; capacidad_maxima: number; total_alumnos: number;
    };

    const municipioSnippet = municipioId ? sql`AND g.municipio_id = ${municipioId}` : sql``;

    const rows = await db.execute<GestorDisp>(sql`
      SELECT
        g.user_id, g.nombre_completo, g.municipio_id, m.nombre AS municipio_nombre,
        g.capacidad_maxima,
        (SELECT count(*)::int FROM estudiantes e WHERE e.gestor_id = g.user_id) AS total_alumnos
      FROM gestores g
      LEFT JOIN municipios m ON m.id = g.municipio_id
      WHERE g.estado = 'activo'
      ${municipioSnippet}
      ORDER BY g.nombre_completo
    `);

    const gestores2 = rows.rows.map((r) => {
      const partes = r.nombre_completo.split(' ');
      const nombreCorto = partes.slice(0, 2).join(' ');
      const total = Number(r.total_alumnos ?? 0);
      return {
        id: r.user_id,
        nombreCompleto: r.nombre_completo,
        nombreCorto,
        municipio: r.municipio_id ? { id: r.municipio_id, nombre: r.municipio_nombre ?? '' } : null,
        alumnosActuales: total,
        capacidadMaxima: r.capacidad_maxima,
        disponible: total < r.capacidad_maxima,
      };
    });

    res.json({ gestores: gestores2 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno';
    res.status(500).json({ error: message });
  }
});

// ─── GET /admin/convocatorias ─────────────────────────────────────────────────
router.get('/convocatorias', async (req, res) => {
  try {
    const año = req.query['año'] ? parseInt(req.query['año'] as string, 10) : new Date().getFullYear();

    const etapas = await db
      .select()
      .from(convocatoriasEtapas)
      .where(eq(convocatoriasEtapas.anio, año))
      .orderBy(convocatoriasEtapas.solicitudInicio);

    const etapasConInscritos = await Promise.all(
      etapas.map(async (etapa) => {
        const [row] = await db
          .select({ total: countDistinct(examenesInscripciones.estudianteId) })
          .from(examenesInscripciones)
          .where(eq(examenesInscripciones.etapaId, etapa.id));
        return { ...etapa, totalInscritos: Number(row?.total ?? 0) };
      }),
    );

    const etapasTotal = etapas.length;
    const etapasFinalizadas = etapas.filter((e) => e.estado === 'finalizada').length;
    const etapasConInscripcionAbierta = etapas.filter((e) => e.estado === 'inscripcion_abierta').length;
    const totalInscritosAnio = etapasConInscritos.reduce((sum, e) => sum + e.totalInscritos, 0);

    const etapaActiva = etapas.find((e) => e.estado === 'inscripcion_abierta');
    const etapaActivaId = etapaActiva ? etapaActiva.id : null;

    res.json({
      año,
      etapas: etapasConInscritos,
      stats: {
        etapasTotal,
        etapasFinalizadas,
        etapasConInscripcionAbierta,
        totalInscritosAnio,
      },
      etapaActivaId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno';
    res.status(500).json({ error: message });
  }
});

// ─── GET /admin/convocatorias/:etapaId ───────────────────────────────────────
router.get('/convocatorias/:etapaId', async (req, res) => {
  try {
    const etapaId = parseInt(req.params.etapaId, 10);
    if (isNaN(etapaId)) { res.status(400).json({ error: 'etapaId inválido' }); return; }

    const [etapa] = await db
      .select()
      .from(convocatoriasEtapas)
      .where(eq(convocatoriasEtapas.id, etapaId));

    if (!etapa) { res.status(404).json({ error: 'Etapa no encontrada' }); return; }

    const rows = await db
      .select({
        estudianteId: examenesInscripciones.estudianteId,
        nombreCompleto: estudiantes.nombreCompleto,
        curp: estudiantes.curp,
        municipioNombre: municipios.nombre,
        folio: examenesInscripciones.folio,
        estado: examenesInscripciones.estado,
        calificacion: examenesInscripciones.calificacion,
        moduloNumero: modulos.numero,
        moduloNombre: modulos.nombre,
      })
      .from(examenesInscripciones)
      .innerJoin(estudiantes, eq(examenesInscripciones.estudianteId, estudiantes.userId))
      .leftJoin(municipios, eq(estudiantes.municipioId, municipios.id))
      .innerJoin(modulos, eq(examenesInscripciones.moduloId, modulos.id))
      .where(eq(examenesInscripciones.etapaId, etapaId))
      .orderBy(estudiantes.nombreCompleto, modulos.numero);

    interface InscritoModulo {
      numero: number | null;
      nombre: string | null;
      folio: string | null;
      estado: string | null;
      calificacion: number | null;
    }
    interface Inscrito {
      estudianteId: number;
      nombreCompleto: string | null;
      curp: string | null;
      municipio: string | null;
      modulos: InscritoModulo[];
      totalModulos: number;
    }

    const estudiantesMap = new Map<number, Inscrito>();
    for (const row of rows) {
      if (!estudiantesMap.has(row.estudianteId)) {
        estudiantesMap.set(row.estudianteId, {
          estudianteId: row.estudianteId,
          nombreCompleto: row.nombreCompleto,
          curp: row.curp ?? null,
          municipio: row.municipioNombre ?? null,
          modulos: [],
          totalModulos: 0,
        });
      }
      const est = estudiantesMap.get(row.estudianteId)!;
      est.modulos.push({
        numero: row.moduloNumero,
        nombre: row.moduloNombre,
        folio: row.folio,
        estado: row.estado,
        calificacion: row.calificacion ?? null,
      });
      est.totalModulos++;
    }
    const inscritos = Array.from(estudiantesMap.values());

    const totalInscritos = estudiantesMap.size;
    const examenesTotal = rows.length;
    const aprobados = rows.filter((r) => r.calificacion !== null && r.calificacion >= 70).length;
    const reprobados = rows.filter((r) => r.calificacion !== null && r.calificacion < 70).length;
    const pendientes = rows.filter((r) => r.calificacion === null).length;

    res.json({
      etapa,
      stats: { totalInscritos, examenesTotal, aprobados, reprobados, pendientes },
      inscritos,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno';
    res.status(500).json({ error: message });
  }
});

// ─── GET /admin/convocatorias/:etapaId/exportar-lista ────────────────────────
router.get('/convocatorias/:etapaId/exportar-lista', async (req, res) => {
  try {
    const etapaId = parseInt(req.params.etapaId, 10);
    if (isNaN(etapaId)) { res.status(400).json({ error: 'etapaId inválido' }); return; }

    const [etapa] = await db
      .select()
      .from(convocatoriasEtapas)
      .where(eq(convocatoriasEtapas.id, etapaId));

    if (!etapa) { res.status(404).json({ error: 'Etapa no encontrada' }); return; }

    const rows = await db
      .select({
        estudianteId: examenesInscripciones.estudianteId,
        nombreCompleto: estudiantes.nombreCompleto,
        curp: estudiantes.curp,
        municipioNombre: municipios.nombre,
        folio: examenesInscripciones.folio,
        estado: examenesInscripciones.estado,
        calificacion: examenesInscripciones.calificacion,
        moduloNumero: modulos.numero,
        moduloNombre: modulos.nombre,
      })
      .from(examenesInscripciones)
      .innerJoin(estudiantes, eq(examenesInscripciones.estudianteId, estudiantes.userId))
      .leftJoin(municipios, eq(estudiantes.municipioId, municipios.id))
      .innerJoin(modulos, eq(examenesInscripciones.moduloId, modulos.id))
      .where(eq(examenesInscripciones.etapaId, etapaId))
      .orderBy(estudiantes.nombreCompleto, modulos.numero);

    const escapeCSV = (value: string | number | null | undefined): string => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const header = 'Folio,Estudiante,CURP,Municipio,Módulo,Estado,Calificación\n';
    const csvRows = rows.map((r) =>
      [
        escapeCSV(r.folio),
        escapeCSV(r.nombreCompleto),
        escapeCSV(r.curp),
        escapeCSV(r.municipioNombre),
        escapeCSV(r.moduloNombre),
        escapeCSV(r.estado),
        escapeCSV(r.calificacion),
      ].join(','),
    );
    const csv = header + csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="inscritos-${etapa.clave}.csv"`);
    res.send(csv);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno';
    res.status(500).json({ error: message });
  }
});

// ─── PUT /admin/expediente-documentos/:id/aprobar ────────────────────────────
router.patch('/expediente-documentos/:id/aprobar', async (req, res) => {
  const userId = req.user!.userId;
  const docId = Number(req.params.id);
  if (Number.isNaN(docId)) { res.status(400).json({ error: 'ID inválido' }); return; }

  const [doc] = await db.select().from(expedienteDocumentos).where(eq(expedienteDocumentos.id, docId));
  if (!doc) { res.status(404).json({ error: 'Documento no encontrado' }); return; }
  if (doc.estado !== 'pendiente_revision') { res.status(400).json({ error: 'El documento no está pendiente de revisión' }); return; }

  const [updated] = await db
    .update(expedienteDocumentos)
    .set({ estado: 'aprobado', revisadoPorUserId: userId, revisadoEn: new Date(), updatedAt: new Date() })
    .where(eq(expedienteDocumentos.id, docId))
    .returning();

  await tryAuditLog({
    userId,
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
    cuerpo: `Tu documento "${doc.tipo}" fue aprobado.`,
    enlace: '/estudiante/expediente',
  });

  res.json({ ok: true, documento: { id: updated.id, estado: updated.estado } });
});

// ─── PUT /admin/expediente-documentos/:id/rechazar ───────────────────────────
const rechazarDocAdminSchema = z.object({ motivoRechazo: z.string().min(1).max(500) });

router.patch('/expediente-documentos/:id/rechazar', async (req, res) => {
  const userId = req.user!.userId;
  const docId = Number(req.params.id);
  if (Number.isNaN(docId)) { res.status(400).json({ error: 'ID inválido' }); return; }

  const parse = rechazarDocAdminSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: 'motivoRechazo es requerido' }); return; }

  const [doc] = await db.select().from(expedienteDocumentos).where(eq(expedienteDocumentos.id, docId));
  if (!doc) { res.status(404).json({ error: 'Documento no encontrado' }); return; }
  if (doc.estado !== 'pendiente_revision') { res.status(400).json({ error: 'El documento no está pendiente de revisión' }); return; }

  const [updated] = await db
    .update(expedienteDocumentos)
    .set({ estado: 'rechazado', motivoRechazo: parse.data.motivoRechazo, revisadoPorUserId: userId, revisadoEn: new Date(), updatedAt: new Date() })
    .where(eq(expedienteDocumentos.id, docId))
    .returning();

  await tryAuditLog({
    userId,
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

  res.json({ ok: true, documento: { id: updated.id, estado: updated.estado } });
});

// ─── Helpers: servir archivo de expediente (admin ve todos los alumnos) ───────
const TIPOS_EXPEDIENTE_ADMIN = ['curp', 'acta_nacimiento', 'ine', 'comprobante_domicilio', 'certificado_secundaria', 'foto'] as const;
type TipoExpedienteAdmin = (typeof TIPOS_EXPEDIENTE_ADMIN)[number];
function esTipoExpedienteAdmin(t: string): t is TipoExpedienteAdmin {
  return (TIPOS_EXPEDIENTE_ADMIN as readonly string[]).includes(t);
}

async function servirDocExpedienteAdmin(
  alumnoId: number,
  tipo: string,
  disposition: 'inline' | 'attachment',
  res: import('express').Response
) {
  if (!esTipoExpedienteAdmin(tipo)) {
    res.status(400).json({ error: 'Tipo inválido' });
    return;
  }

  const [doc] = await db
    .select()
    .from(expedienteDocumentos)
    .where(
      and(eq(expedienteDocumentos.estudianteId, alumnoId), eq(expedienteDocumentos.tipo, tipo))
    );

  if (!doc) { res.status(404).json({ error: 'Documento no encontrado' }); return; }
  if (!existsSync(doc.rutaArchivo)) {
    res.status(404).json({ error: 'Archivo no disponible en el servidor' });
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

// ─── GET /admin/alumnos/:id/expediente/:tipo/preview ─────────────────────────
router.get('/alumnos/:id/expediente/:tipo/preview', async (req, res) => {
  const alumnoId = Number(req.params.id);
  if (!alumnoId) { res.status(400).json({ error: 'ID inválido' }); return; }
  await servirDocExpedienteAdmin(alumnoId, req.params.tipo, 'inline', res);
});

// ─── GET /admin/alumnos/:id/expediente/:tipo/descargar ────────────────────────
router.get('/alumnos/:id/expediente/:tipo/descargar', async (req, res) => {
  const alumnoId = Number(req.params.id);
  if (!alumnoId) { res.status(400).json({ error: 'ID inválido' }); return; }
  await servirDocExpedienteAdmin(alumnoId, req.params.tipo, 'attachment', res);
});

// ─── Anuncios CRUD ────────────────────────────────────────────────────────────

const anuncioSchema = z.object({
  titulo: z.string().min(1).max(200),
  contenido: z.string().min(1),
  prioridad: z.enum(['informativo', 'importante', 'urgente']).default('informativo'),
  audiencia: z.enum(['todos', 'alumnos', 'gestores', 'alumnos_municipio', 'alumnos_etapa', 'gestor_especifico']).default('todos'),
  audienciaParam: z.string().max(120).optional().nullable(),
  estado: z.enum(['borrador', 'publicado', 'archivado']).default('borrador'),
  ctaTexto: z.string().max(80).optional().nullable(),
  ctaUrl: z.string().max(500).optional().nullable(),
  activoHasta: z.string().optional().nullable(),
});

router.get('/anuncios', async (req, res) => {
  const estado = (req.query.estado as string) || 'publicado';
  const rows = await db
    .select({
      id: anuncios.id,
      titulo: anuncios.titulo,
      contenido: anuncios.contenido,
      prioridad: anuncios.prioridad,
      audiencia: anuncios.audiencia,
      audienciaParam: anuncios.audienciaParam,
      estado: anuncios.estado,
      ctaTexto: anuncios.ctaTexto,
      ctaUrl: anuncios.ctaUrl,
      publicadoEn: anuncios.publicadoEn,
      activoHasta: anuncios.activoHasta,
      createdAt: anuncios.createdAt,
      creadoPorUserId: anuncios.creadoPorUserId,
    })
    .from(anuncios)
    .where(estado === 'todos' ? sql`true` : eq(anuncios.estado, estado as 'borrador' | 'publicado' | 'archivado'))
    .orderBy(desc(anuncios.createdAt));

  const resumen = {
    total: rows.length,
    publicados: rows.filter(r => r.estado === 'publicado').length,
    borradores: rows.filter(r => r.estado === 'borrador').length,
    archivados: rows.filter(r => r.estado === 'archivado').length,
    urgentes: rows.filter(r => r.prioridad === 'urgente' && r.estado === 'publicado').length,
  };

  res.json({ anuncios: rows, resumen });
});

router.post('/anuncios', async (req, res) => {
  const userId = req.user!.userId;
  const parse = anuncioSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: parse.error.errors[0].message }); return; }

  const d = parse.data;
  const publicadoEn = d.estado === 'publicado' ? new Date() : null;

  const [created] = await db.insert(anuncios).values({
    titulo: d.titulo,
    contenido: d.contenido,
    prioridad: d.prioridad,
    audiencia: d.audiencia,
    audienciaParam: d.audienciaParam ?? null,
    estado: d.estado,
    ctaTexto: d.ctaTexto ?? null,
    ctaUrl: d.ctaUrl ?? null,
    publicadoEn,
    activoHasta: d.activoHasta ? new Date(d.activoHasta) : null,
    creadoPorUserId: userId,
  }).returning();

  if (d.estado === 'publicado') {
    notificarATodosLosAdmins({
      tipo: 'anuncio_dirigido',
      prioridad: d.prioridad === 'urgente' ? 'urgente' : 'normal',
      titulo: `Anuncio publicado: ${d.titulo}`,
      cuerpo: `Se publicó un anuncio para "${d.audiencia}".`,
      enlace: '/admin/anuncios',
    });
  }

  res.status(201).json({ anuncio: created });
});

router.put('/anuncios/:id', async (req, res) => {
  const userId = req.user!.userId;
  const anuncioId = Number(req.params.id);
  if (Number.isNaN(anuncioId)) { res.status(400).json({ error: 'ID inválido' }); return; }

  const parse = anuncioSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: parse.error.errors[0].message }); return; }

  const [existing] = await db.select().from(anuncios).where(eq(anuncios.id, anuncioId));
  if (!existing) { res.status(404).json({ error: 'Anuncio no encontrado' }); return; }

  const d = parse.data;
  const publicadoEn = d.estado === 'publicado' && !existing.publicadoEn ? new Date() : existing.publicadoEn;

  const [updated] = await db.update(anuncios)
    .set({
      titulo: d.titulo,
      contenido: d.contenido,
      prioridad: d.prioridad,
      audiencia: d.audiencia,
      audienciaParam: d.audienciaParam ?? null,
      estado: d.estado,
      ctaTexto: d.ctaTexto ?? null,
      ctaUrl: d.ctaUrl ?? null,
      publicadoEn,
      activoHasta: d.activoHasta ? new Date(d.activoHasta) : null,
      updatedAt: new Date(),
    })
    .where(eq(anuncios.id, anuncioId))
    .returning();

  await tryAuditLog({ userId, accion: 'editar_anuncio', entidad: 'anuncios', entidadId: anuncioId, detalle: `Editó anuncio "${d.titulo}"`, metadata: { titulo: d.titulo }, req });

  res.json({ anuncio: updated });
});

router.patch('/anuncios/:id', async (req, res) => {
  const userId = req.user!.userId;
  const anuncioId = Number(req.params.id);
  if (Number.isNaN(anuncioId)) { res.status(400).json({ error: 'ID inválido' }); return; }

  const parse = anuncioSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: parse.error.errors[0].message }); return; }

  const [existing] = await db.select().from(anuncios).where(eq(anuncios.id, anuncioId));
  if (!existing) { res.status(404).json({ error: 'Anuncio no encontrado' }); return; }

  const d = parse.data;
  const publicadoEn = d.estado === 'publicado' && !existing.publicadoEn ? new Date() : existing.publicadoEn;

  const [updated] = await db.update(anuncios)
    .set({
      titulo: d.titulo,
      contenido: d.contenido,
      prioridad: d.prioridad,
      audiencia: d.audiencia,
      audienciaParam: d.audienciaParam ?? null,
      estado: d.estado,
      ctaTexto: d.ctaTexto ?? null,
      ctaUrl: d.ctaUrl ?? null,
      publicadoEn,
      activoHasta: d.activoHasta ? new Date(d.activoHasta) : null,
      updatedAt: new Date(),
    })
    .where(eq(anuncios.id, anuncioId))
    .returning();

  await tryAuditLog({ userId, accion: 'editar_anuncio', entidad: 'anuncios', entidadId: anuncioId, detalle: `Editó anuncio "${d.titulo}"`, metadata: { titulo: d.titulo }, req });

  res.json({ anuncio: updated });
});

router.post('/anuncios/:id/archivar', async (req, res) => {
  const anuncioId = Number(req.params.id);
  if (Number.isNaN(anuncioId)) { res.status(400).json({ error: 'ID inválido' }); return; }

  const [existing] = await db.select().from(anuncios).where(eq(anuncios.id, anuncioId));
  if (!existing) { res.status(404).json({ error: 'Anuncio no encontrado' }); return; }

  await db.update(anuncios).set({ estado: 'archivado', updatedAt: new Date() }).where(eq(anuncios.id, anuncioId));
  res.json({ ok: true });
});

router.post('/anuncios/:id/desarchivar', async (req, res) => {
  const anuncioId = Number(req.params.id);
  if (Number.isNaN(anuncioId)) { res.status(400).json({ error: 'ID inválido' }); return; }

  const [existing] = await db.select().from(anuncios).where(eq(anuncios.id, anuncioId));
  if (!existing) { res.status(404).json({ error: 'Anuncio no encontrado' }); return; }

  await db.update(anuncios).set({ estado: 'publicado', updatedAt: new Date() }).where(eq(anuncios.id, anuncioId));
  res.json({ ok: true });
});

router.delete('/anuncios/:id', async (req, res) => {
  const userId = req.user!.userId;
  const anuncioId = Number(req.params.id);
  if (Number.isNaN(anuncioId)) { res.status(400).json({ error: 'ID inválido' }); return; }

  const [existing] = await db.select().from(anuncios).where(eq(anuncios.id, anuncioId));
  if (!existing) { res.status(404).json({ error: 'Anuncio no encontrado' }); return; }

  await db.delete(anuncios).where(eq(anuncios.id, anuncioId));
  await tryAuditLog({ userId, accion: 'eliminar_anuncio', entidad: 'anuncios', entidadId: anuncioId, detalle: `Eliminó anuncio "${existing.titulo}"`, metadata: { titulo: existing.titulo }, req });

  res.json({ ok: true });
});

// ─── Cédula de inscripción (admin) ───────────────────────────────────────────
async function adminVerAlumno(alumnoId: number) {
  const [a] = await db.select({ userId: estudiantes.userId }).from(estudiantes).where(eq(estudiantes.userId, alumnoId));
  return a ?? null;
}

// GET /admin/alumnos/:id/cedula — datos consolidados de la cédula
router.get('/alumnos/:id/cedula', async (req, res) => {
  const alumnoId = Number(req.params.id);
  if (Number.isNaN(alumnoId)) { res.status(400).json({ error: 'ID inválido' }); return; }
  if (!(await adminVerAlumno(alumnoId))) { res.status(404).json({ error: 'Alumno no encontrado' }); return; }
  res.json(await obtenerDatosCedula(alumnoId));
});

// PATCH /admin/alumnos/:id/cedula — el admin arma/edita la cédula
router.patch('/alumnos/:id/cedula', async (req, res) => {
  const alumnoId = Number(req.params.id);
  if (Number.isNaN(alumnoId)) { res.status(400).json({ error: 'ID inválido' }); return; }
  if (!(await adminVerAlumno(alumnoId))) { res.status(404).json({ error: 'Alumno no encontrado' }); return; }
  const parse = cedulaDatosSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: parse.error.issues[0]?.message ?? 'Datos inválidos' }); return; }
  await guardarDatosCedula(alumnoId, parse.data);
  res.json({ ok: true });
});

// GET /admin/alumnos/:id/cedula/pdf — cédula rellenada
router.get('/alumnos/:id/cedula/pdf', async (req, res) => {
  const alumnoId = Number(req.params.id);
  if (Number.isNaN(alumnoId)) { res.status(400).json({ error: 'ID inválido' }); return; }
  if (!(await adminVerAlumno(alumnoId))) { res.status(404).json({ error: 'Alumno no encontrado' }); return; }
  try {
    const { pdf, nombreArchivo } = await generarCedulaPdf(alumnoId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', dispositionCedula(nombreArchivo));
    res.send(Buffer.from(pdf));
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'No se pudo generar la cédula' });
  }
});

// ─── POST /admin/alumnos/:id/matricula ───────────────────────────────────────
const adminMatriculaSchema = z.object({
  matricula: z.string().min(8).max(20).regex(/^[A-Z0-9]+$/, 'Solo caracteres alfanuméricos'),
});

router.post('/alumnos/:id/matricula', async (req, res) => {
  const adminId = req.user!.userId;
  const alumnoId = Number(req.params.id);
  if (Number.isNaN(alumnoId)) { res.status(400).json({ error: 'ID inválido' }); return; }

  const parse = adminMatriculaSchema.safeParse({ matricula: (req.body.matricula as string)?.toUpperCase() });
  if (!parse.success) { res.status(400).json({ error: parse.error.errors[0].message }); return; }
  const { matricula } = parse.data;

  const [alumno] = await db.select({ userId: estudiantes.userId }).from(estudiantes).where(eq(estudiantes.userId, alumnoId));
  if (!alumno) { res.status(404).json({ error: 'Alumno no encontrado' }); return; }

  const [duplicate] = await db
    .select({ userId: estudiantes.userId })
    .from(estudiantes)
    .where(and(eq(estudiantes.matriculaOficialDGB, matricula), sql`${estudiantes.userId} != ${alumnoId}`));
  if (duplicate) { res.status(409).json({ error: 'Esta matrícula ya está asignada a otro alumno' }); return; }

  await db.update(estudiantes).set({
    matriculaOficialDGB: matricula,
    matriculaCapturadaEn: new Date(),
    matriculaCapturadaPor: adminId,
    updatedAt: new Date(),
  }).where(eq(estudiantes.userId, alumnoId));

  await tryAuditLog({
    userId: adminId,
    accion: 'capturar_matricula',
    entidad: 'estudiante',
    entidadId: alumnoId,
    detalle: `Capturó matrícula DGB "${matricula}" para alumno ID ${alumnoId}`,
    metadata: { matricula },
    req,
  });

  res.json({ ok: true, matricula });
});

// ─── POST /admin/alumnos/:id/licencia ────────────────────────────────────────
router.post('/alumnos/:id/licencia', async (req, res) => {
  const adminId = req.user!.userId;
  const alumnoId = Number(req.params.id);
  if (Number.isNaN(alumnoId)) { res.status(400).json({ error: 'ID inválido' }); return; }

  const [alumno] = await db
    .select({ userId: estudiantes.userId, licenciaDigital: estudiantes.licenciaDigital, matriculaOficialDGB: estudiantes.matriculaOficialDGB })
    .from(estudiantes)
    .where(eq(estudiantes.userId, alumnoId));
  if (!alumno) { res.status(404).json({ error: 'Alumno no encontrado' }); return; }

  if (!alumno.matriculaOficialDGB) {
    res.status(422).json({ error: 'El alumno debe tener matrícula oficial asignada antes de emitir una licencia digital' });
    return;
  }

  if (alumno.licenciaDigital) {
    res.status(409).json({ error: 'El alumno ya tiene una licencia digital emitida', licencia: alumno.licenciaDigital });
    return;
  }

  const licencia = await generarFolioLicencia();

  await db.update(estudiantes).set({
    licenciaDigital: licencia,
    licenciaEmitidaEn: new Date(),
    licenciaEmitidaPor: adminId,
    updatedAt: new Date(),
  }).where(eq(estudiantes.userId, alumnoId));

  await tryAuditLog({
    userId: adminId,
    accion: 'emitir_licencia',
    entidad: 'estudiante',
    entidadId: alumnoId,
    detalle: `Emitió licencia digital "${licencia}" para alumno ID ${alumnoId}`,
    metadata: { licencia },
    req,
  });

  res.status(201).json({ ok: true, licencia });
});

// ─── GET /admin/alumnos/:id/ficha-preregistro ────────────────────────────────
router.get('/alumnos/:id/ficha-preregistro', async (req, res) => {
  const alumnoId = Number(req.params.id);
  if (Number.isNaN(alumnoId)) { res.status(400).json({ error: 'ID inválido' }); return; }

  let [est] = await db.select().from(estudiantes).where(eq(estudiantes.userId, alumnoId));
  if (!est) { res.status(404).json({ error: 'Alumno no encontrado' }); return; }

  // Auto-generate folio if missing (all students should have one)
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

// ─── POST /admin/alumnos/:id/renovar-preregistro ─────────────────────────────
router.post('/alumnos/:id/renovar-preregistro', async (req, res) => {
  const alumnoId = Number(req.params.id);
  if (Number.isNaN(alumnoId)) { res.status(400).json({ error: 'ID inválido' }); return; }

  const [est] = await db.select({ folioPreregistro: estudiantes.folioPreregistro }).from(estudiantes).where(eq(estudiantes.userId, alumnoId));
  if (!est) { res.status(404).json({ error: 'Alumno no encontrado' }); return; }

  const ahora = new Date();
  const vigencia = agregarDiasHabiles(ahora, 15);
  const folio = est.folioPreregistro ?? await generarFolioPreregistro();

  await db.update(estudiantes).set({
    folioPreregistro: folio,
    preregistroGeneradoEn: ahora,
    preregistroVigenteHasta: vigencia.toISOString().split('T')[0],
  }).where(eq(estudiantes.userId, alumnoId));

  await tryAuditLog({
    userId: req.user!.userId,
    accion: 'renovar_preregistro',
    entidad: 'estudiante',
    entidadId: alumnoId,
    detalle: `Renovó pre-registro del alumno ID ${alumnoId}, vigente hasta ${vigencia.toISOString().split('T')[0]}`,
    metadata: { folio, vigenteHasta: vigencia.toISOString().split('T')[0] },
    req,
  });

  res.json({ ok: true, folio, vigenteHasta: vigencia.toISOString().split('T')[0] });
});

// ─── GET /admin/alumnos/:id/ficha-registro ───────────────────────────────────
router.get('/alumnos/:id/ficha-registro', async (req, res) => {
  const alumnoId = Number(req.params.id);
  if (Number.isNaN(alumnoId)) { res.status(400).json({ error: 'ID inválido' }); return; }

  const [est] = await db.select().from(estudiantes).where(eq(estudiantes.userId, alumnoId));
  if (!est) { res.status(404).json({ error: 'Alumno no encontrado' }); return; }
  if (!est.matriculaOficialDGB) { res.status(400).json({ error: 'El alumno aún no tiene matrícula oficial asignada' }); return; }

  const [userRow] = await db.select({ email: users.email }).from(users).where(eq(users.id, alumnoId));
  const [municipio] = est.municipioId
    ? await db.select({ nombre: municipios.nombre }).from(municipios).where(eq(municipios.id, est.municipioId))
    : [null];
  const [gestorRow] = est.gestorId
    ? await db.select({ nombreCompleto: gestores.nombreCompleto }).from(gestores).where(eq(gestores.userId, est.gestorId))
    : [null];

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

// ─── GET /admin/outbox ────────────────────────────────────────────────────
router.get('/outbox', async (req, res) => {
  const {
    evento,
    estado,
    q,
    page = '1',
    perPage = '25',
  } = req.query as Record<string, string>;

  const pageNum = Math.max(1, parseInt(page, 10));
  const limit = Math.min(100, parseInt(perPage, 10));
  const offset = (pageNum - 1) * limit;

  const conditions: SQL[] = [];
  if (evento) conditions.push(eq(outbox.evento, evento as any));
  if (estado) conditions.push(eq(outbox.estado, estado as any));
  if (q) conditions.push(
    sql`(${outbox.toEmail} ILIKE ${'%' + q + '%'} OR ${outbox.toName} ILIKE ${'%' + q + '%'} OR ${outbox.subject} ILIKE ${'%' + q + '%'})`
  );

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db.select({
      id: outbox.id,
      toEmail: outbox.toEmail,
      toName: outbox.toName,
      ccEmail: outbox.ccEmail,
      fromEmail: outbox.fromEmail,
      fromName: outbox.fromName,
      subject: outbox.subject,
      html: outbox.html,
      evento: outbox.evento,
      estado: outbox.estado,
      errorMessage: outbox.errorMessage,
      metadata: outbox.metadata,
      createdAt: outbox.createdAt,
      sentAt: outbox.sentAt,
    })
      .from(outbox)
      .where(where)
      .orderBy(desc(outbox.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(outbox).where(where),
  ]);

  res.json({
    rows,
    pagination: { page: pageNum, perPage: limit, total: Number(total), totalPages: Math.ceil(Number(total) / limit) },
  });
});

export default router;

