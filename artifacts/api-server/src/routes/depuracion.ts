/**
 * Rutas de administración de depuración automática de cuentas.
 * GET  /admin/depuracion/stats           → KPIs
 * GET  /admin/depuracion/en-riesgo       → cuentas con aviso pendiente
 * GET  /admin/depuracion/soft-delete     → cuentas en soft delete
 * GET  /admin/depuracion/historial       → eliminacionesAuditoria
 * POST /admin/depuracion/:id/restaurar   → restaurar cuenta soft-deleted
 * POST /admin/depuracion/:id/forzar      → forzar soft delete inmediato
 * POST /admin/depuracion/:id/reactivar   → reactivar manualmente (admin)
 */

import { Router } from 'express';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  estudiantes,
  users,
  municipios,
  eliminacionesAuditoria,
  notificaciones,
  expedienteDocumentos,
  pagos,
} from '@workspace/db/schema';
import { authRequired, requireRol } from '../middleware/auth';
import { tryAuditLog } from '../utils/audit';
import { evaluarProteccion } from '../services/depuracion';

const router = Router();
router.use(authRequired, requireRol('admin'));

// ── GET /admin/depuracion/stats ───────────────────────────────────────────
router.get('/stats', async (_req, res) => {
  const raw1 = await db.execute<{
    activas: string;
    aviso_enviado: string;
    soft_deleted: string;
    hard_deleted: string;
  }>(sql`
    SELECT
      count(*) FILTER (WHERE estado_cuenta = 'activa')::text AS activas,
      count(*) FILTER (WHERE estado_cuenta = 'aviso_enviado')::text AS aviso_enviado,
      count(*) FILTER (WHERE estado_cuenta = 'soft_deleted')::text AS soft_deleted,
      count(*) FILTER (WHERE estado_cuenta = 'hard_deleted')::text AS hard_deleted
    FROM estudiantes
  `);
  const result = raw1.rows[0];

  const rawHist = await db.execute<{ total: string }>(sql`
    SELECT count(*)::text AS total FROM eliminaciones_auditoria WHERE tipo = 'hard_delete'
  `);
  const histResult = rawHist.rows[0];

  res.json({
    activas: Number(result?.activas ?? 0),
    avisoEnviado: Number(result?.aviso_enviado ?? 0),
    softDeleted: Number(result?.soft_deleted ?? 0),
    totalDepuradas: Number(histResult?.total ?? 0),
  });
});

// ── GET /admin/depuracion/en-riesgo ──────────────────────────────────────
router.get('/en-riesgo', async (_req, res) => {
  const rows = await db.execute<{
    user_id: number;
    nombre_completo: string;
    email: string;
    municipio_nombre: string | null;
    ultima_actividad_en: Date | null;
    aviso_eliminacion_enviado_en: Date | null;
    created_at: Date;
  }>(sql`
    SELECT
      e.user_id,
      e.nombre_completo,
      u.email,
      m.nombre AS municipio_nombre,
      e.ultima_actividad_en,
      e.aviso_eliminacion_enviado_en,
      e.created_at
    FROM estudiantes e
    LEFT JOIN users u ON u.id = e.user_id
    LEFT JOIN municipios m ON m.id = e.municipio_id
    WHERE e.estado_cuenta = 'aviso_enviado'
    ORDER BY e.aviso_eliminacion_enviado_en ASC
  `);

  const ahora = Date.now();
  const resultado = rows.rows.map((r) => {
    const baseDate = r.ultima_actividad_en ?? r.created_at;
    const diasInactivo = Math.floor((ahora - new Date(baseDate).getTime()) / 86400000);
    const avisoEn = r.aviso_eliminacion_enviado_en ? new Date(r.aviso_eliminacion_enviado_en) : null;
    const eliminacionEn = avisoEn ? new Date(avisoEn.getTime() + 5 * 24 * 60 * 60 * 1000) : null;
    const diasParaEliminar = eliminacionEn
      ? Math.max(0, Math.ceil((eliminacionEn.getTime() - ahora) / 86400000))
      : 0;

    return {
      id: r.user_id,
      nombreCompleto: r.nombre_completo,
      email: r.email,
      municipio: r.municipio_nombre,
      diasInactivo,
      avisoEnviadoEn: avisoEn?.toISOString() ?? null,
      eliminacionEn: eliminacionEn?.toISOString() ?? null,
      diasParaEliminar,
    };
  });

  res.json({ enRiesgo: resultado });
});

// ── GET /admin/depuracion/soft-delete ────────────────────────────────────
router.get('/soft-delete', async (_req, res) => {
  const rows = await db.execute<{
    user_id: number;
    folio_preregistro: string | null;
    municipio_nombre: string | null;
    soft_deleted_en: Date | null;
    soft_delete_motivo: string | null;
  }>(sql`
    SELECT
      e.user_id,
      e.folio_preregistro,
      m.nombre AS municipio_nombre,
      e.soft_deleted_en,
      e.soft_delete_motivo
    FROM estudiantes e
    LEFT JOIN municipios m ON m.id = e.municipio_id
    WHERE e.estado_cuenta = 'soft_deleted'
    ORDER BY e.soft_deleted_en DESC
  `);

  const ahora = Date.now();
  const resultado = rows.rows.map((r) => {
    const softDeletedEn = r.soft_deleted_en ? new Date(r.soft_deleted_en) : null;
    const hardDeleteEn = softDeletedEn
      ? new Date(softDeletedEn.getTime() + 90 * 24 * 60 * 60 * 1000)
      : null;
    const diasParaHardDelete = hardDeleteEn
      ? Math.max(0, Math.ceil((hardDeleteEn.getTime() - ahora) / 86400000))
      : 0;

    return {
      id: r.user_id,
      folio: r.folio_preregistro ?? `#${r.user_id}`,
      municipio: r.municipio_nombre,
      softDeletedEn: softDeletedEn?.toISOString() ?? null,
      hardDeleteEn: hardDeleteEn?.toISOString() ?? null,
      diasParaHardDelete,
      motivo: r.soft_delete_motivo,
    };
  });

  res.json({ softDeleted: resultado });
});

// ── GET /admin/depuracion/historial ──────────────────────────────────────
router.get('/historial', async (req, res) => {
  const tipo = (req.query.tipo as string) || '';
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(10, parseInt(req.query.limit as string) || 20));
  const offset = (page - 1) * limit;

  const tipoSnippet = ['soft_delete', 'hard_delete', 'restauracion'].includes(tipo)
    ? sql`AND tipo = ${tipo}`
    : sql``;

  const rawCount = await db.execute<{ total: string }>(sql`
    SELECT count(*)::text AS total FROM eliminaciones_auditoria WHERE 1=1 ${tipoSnippet}
  `);
  const countResult = rawCount.rows[0];

  const rows = await db.execute<{
    id: number;
    estudiante_id: number | null;
    nombre_completo: string | null;
    municipio_nombre: string | null;
    folio_preregistro: string | null;
    tipo: string;
    motivo: string;
    dias_sin_actividad: number | null;
    documentos_tenia: number | null;
    pagos_tenia: number | null;
    creado_en: Date;
  }>(sql`
    SELECT id, estudiante_id, nombre_completo, municipio_nombre, folio_preregistro,
           tipo, motivo, dias_sin_actividad, documentos_tenia, pagos_tenia, creado_en
    FROM eliminaciones_auditoria
    WHERE 1=1 ${tipoSnippet}
    ORDER BY creado_en DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  res.json({
    rows: rows.rows.map((r) => ({
      ...r,
      creadoEn: new Date(r.creado_en).toISOString(),
    })),
    total: Number(countResult?.total ?? 0),
    page,
    totalPages: Math.ceil(Number(countResult?.total ?? 0) / limit),
  });
});

// ── POST /admin/depuracion/:id/restaurar ─────────────────────────────────
router.post('/:id/restaurar', async (req, res) => {
  const estudianteId = Number(req.params.id);
  if (!estudianteId) { res.status(400).json({ error: 'ID inválido' }); return; }

  const [est] = await db
    .select({ estadoCuenta: estudiantes.estadoCuenta, nombreCompleto: estudiantes.nombreCompleto })
    .from(estudiantes)
    .where(eq(estudiantes.userId, estudianteId));

  if (!est) { res.status(404).json({ error: 'Alumno no encontrado' }); return; }
  if (est.estadoCuenta !== 'soft_deleted') {
    res.status(400).json({ error: 'Solo se pueden restaurar cuentas en soft delete' });
    return;
  }

  await db
    .update(estudiantes)
    .set({
      estadoCuenta: 'activa',
      softDeletedEn: null,
      softDeleteMotivo: null,
      avisoEliminacionEnviadoEn: null,
      ultimaActividadEn: new Date(),
    })
    .where(eq(estudiantes.userId, estudianteId));

  await db.update(users).set({ activo: true }).where(eq(users.id, estudianteId));

  // Auditoría de restauración
  const [userRow] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, estudianteId));

  await db.insert(eliminacionesAuditoria).values({
    estudianteId,
    nombreCompleto: est.nombreCompleto,
    email: userRow?.email ?? null,
    tipo: 'restauracion',
    motivo: `Restaurada manualmente por admin (userId ${req.user!.userId})`,
    ejecutadoPorSistema: false,
    ejecutadoPorUserId: req.user!.userId,
  });

  await tryAuditLog({
    userId: req.user!.userId,
    accion: 'RESTAURAR_CUENTA',
    entidad: 'estudiante',
    entidadId: estudianteId,
    detalle: `Restauró cuenta soft-deleted de ${est.nombreCompleto}`,
    req,
  });

  res.json({ ok: true, mensaje: `Cuenta de ${est.nombreCompleto} restaurada` });
});

// ── POST /admin/depuracion/:id/forzar ────────────────────────────────────
router.post('/:id/forzar', async (req, res) => {
  const estudianteId = Number(req.params.id);
  if (!estudianteId) { res.status(400).json({ error: 'ID inválido' }); return; }

  const [est] = await db
    .select()
    .from(estudiantes)
    .where(and(
      eq(estudiantes.userId, estudianteId),
      sql`estado_cuenta IN ('activa', 'aviso_enviado')`
    ));

  if (!est) {
    res.status(404).json({ error: 'Alumno no encontrado o ya eliminado' });
    return;
  }

  const { protegida } = await evaluarProteccion(estudianteId);
  if (protegida) {
    res.status(400).json({ error: 'Esta cuenta está protegida y no puede eliminarse' });
    return;
  }

  const [userRow] = await db.select({ email: users.email }).from(users).where(eq(users.id, estudianteId));
  const [municipio] = est.municipioId
    ? await db.select({ nombre: municipios.nombre }).from(municipios).where(eq(municipios.id, est.municipioId))
    : [];
  const docs = await db.select().from(expedienteDocumentos).where(eq(expedienteDocumentos.estudianteId, estudianteId));
  const pagosRows = await db.select().from(pagos).where(eq(pagos.estudianteId, estudianteId));

  const ahora = new Date();
  const baseDate = est.ultimaActividadEn ?? est.createdAt;
  const diasInactivo = Math.floor((ahora.getTime() - new Date(baseDate).getTime()) / 86400000);

  await db.insert(eliminacionesAuditoria).values({
    estudianteId,
    nombreCompleto: est.nombreCompleto,
    curp: est.curp ?? null,
    email: userRow?.email ?? null,
    municipioNombre: municipio?.nombre ?? null,
    folioPreregistro: est.folioPreregistro ?? null,
    tipo: 'soft_delete',
    motivo: `Eliminación manual por admin (userId ${req.user!.userId}) tras ${diasInactivo} días`,
    diasSinActividad: diasInactivo,
    documentosTenia: docs.length,
    pagosTenia: pagosRows.length,
    teniaMatriculaDGB: !!est.matriculaOficialDGB,
    ejecutadoPorSistema: false,
    ejecutadoPorUserId: req.user!.userId,
  });

  await db.update(estudiantes).set({
    estadoCuenta: 'soft_deleted',
    softDeletedEn: ahora,
    softDeleteMotivo: `Eliminación manual por admin`,
  }).where(eq(estudiantes.userId, estudianteId));

  await db.update(users).set({ activo: false }).where(eq(users.id, estudianteId));

  await tryAuditLog({
    userId: req.user!.userId,
    accion: 'FORZAR_ELIMINACION',
    entidad: 'estudiante',
    entidadId: estudianteId,
    detalle: `Forzó soft delete de ${est.nombreCompleto}`,
    req,
  });

  res.json({ ok: true, mensaje: `Cuenta de ${est.nombreCompleto} marcada para eliminación` });
});

// ── POST /admin/depuracion/:id/reactivar ─────────────────────────────────
router.post('/:id/reactivar', async (req, res) => {
  const estudianteId = Number(req.params.id);
  if (!estudianteId) { res.status(400).json({ error: 'ID inválido' }); return; }

  const [est] = await db
    .select({ estadoCuenta: estudiantes.estadoCuenta, nombreCompleto: estudiantes.nombreCompleto })
    .from(estudiantes)
    .where(eq(estudiantes.userId, estudianteId));

  if (!est) { res.status(404).json({ error: 'Alumno no encontrado' }); return; }
  if (est.estadoCuenta !== 'aviso_enviado') {
    res.status(400).json({ error: 'Solo se pueden reactivar cuentas con aviso enviado' });
    return;
  }

  await db.update(estudiantes).set({
    estadoCuenta: 'activa',
    avisoEliminacionEnviadoEn: null,
    ultimaActividadEn: new Date(),
  }).where(eq(estudiantes.userId, estudianteId));

  await tryAuditLog({
    userId: req.user!.userId,
    accion: 'REACTIVAR_CUENTA',
    entidad: 'estudiante',
    entidadId: estudianteId,
    detalle: `Reactivó manualmente la cuenta de ${est.nombreCompleto}`,
    req,
  });

  res.json({ ok: true, mensaje: `Cuenta de ${est.nombreCompleto} reactivada` });
});

export default router;
