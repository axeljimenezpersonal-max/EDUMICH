/**
 * Servicio de depuración automática de cuentas inactivas.
 * Política: cuentas sin subir docs/pagos en 30 días → soft delete.
 * Pasados 90 días en soft delete → hard delete (LGPDPPSO art. 11).
 */

import { and, eq, inArray, isNull, lte, sql } from 'drizzle-orm';
import cron from 'node-cron';
import { db } from '../db';
import {
  estudiantes,
  expedienteDocumentos,
  pagos,
  users,
  municipios,
  notificaciones,
  eliminacionesAuditoria,
  calificaciones,
  auditLog,
} from '@workspace/db/schema';
import { sendAvisoEliminacion } from './email';
import { notificarATodosLosAdmins } from '../utils/notificar';

// ── Registrar actividad ───────────────────────────────────────────────────

export async function registrarActividad(estudianteId: number): Promise<void> {
  try {
    await db
      .update(estudiantes)
      .set({
        ultimaActividadEn: new Date(),
        avisoEliminacionEnviadoEn: null,
        estadoCuenta: 'activa',
      })
      .where(eq(estudiantes.userId, estudianteId));
  } catch (e) {
    console.error('[depuracion] Error registrando actividad:', e);
  }
}

// ── Evaluar si está protegida ─────────────────────────────────────────────

export async function evaluarProteccion(
  estudianteId: number
): Promise<{ protegida: boolean; motivos: string[] }> {
  const motivos: string[] = [];

  const [est] = await db
    .select({
      matriculaOficialDGB: estudiantes.matriculaOficialDGB,
    })
    .from(estudiantes)
    .where(eq(estudiantes.userId, estudianteId));

  if (!est) return { protegida: false, motivos: [] };

  // 1. Matrícula DGB asignada
  if (est.matriculaOficialDGB) {
    motivos.push('Tiene matrícula DGB oficial');
  }

  // 2. Egresado (22 módulos aprobados)
  const rawCal = await db.execute<{ total: string }>(sql`
    SELECT count(DISTINCT modulo_id)::text AS total
    FROM calificaciones
    WHERE estudiante_id = ${estudianteId} AND aprobado = true
  `);
  const calResult = rawCal.rows[0];
  if (Number(calResult?.total ?? 0) >= 22) {
    motivos.push('Es egresado (22 módulos aprobados)');
  }

  // 3. Pago verificado
  const [pagoVerif] = await db
    .select({ id: pagos.id })
    .from(pagos)
    .where(and(eq(pagos.estudianteId, estudianteId), eq(pagos.estado, 'verificado')))
    .limit(1);
  if (pagoVerif) {
    motivos.push('Tiene al menos 1 pago verificado');
  }

  // 4. Expediente completo (5/5 docs aprobados)
  const rawDocs = await db.execute<{ total: string }>(sql`
    SELECT count(DISTINCT tipo)::text AS total
    FROM expediente_documentos
    WHERE estudiante_id = ${estudianteId}
      AND estado = 'aprobado'
      AND tipo IN ('curp','acta_nacimiento','ine','comprobante_domicilio','certificado_secundaria')
  `);
  const docsAprobadosResult = rawDocs.rows[0];
  if (Number(docsAprobadosResult?.total ?? 0) >= 5) {
    motivos.push('Expediente completo (5/5 aprobados)');
  }

  // 5. Al menos 1 documento subido (cualquier estado)
  const [docExiste] = await db
    .select({ id: expedienteDocumentos.id })
    .from(expedienteDocumentos)
    .where(eq(expedienteDocumentos.estudianteId, estudianteId))
    .limit(1);
  if (docExiste) {
    motivos.push('Ya subió al menos 1 documento');
  }

  return { protegida: motivos.length > 0, motivos };
}

// ── Job principal ─────────────────────────────────────────────────────────

export async function correrDepuracion(): Promise<{
  avisos: number;
  softDelete: number;
  hardDelete: number;
}> {
  console.log('[DEPURACION] Iniciando job de depuración de cuentas...');

  const ahora = new Date();
  const hace25Dias = new Date(ahora.getTime() - 25 * 24 * 60 * 60 * 1000);
  const hace30Dias = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);
  const hace90Dias = new Date(ahora.getTime() - 90 * 24 * 60 * 60 * 1000);

  // ── FASE 1: Aviso a 25 días ─────────────────────────────────────────────

  const candidatosAviso = await db
    .select()
    .from(estudiantes)
    .where(
      and(
        eq(estudiantes.estadoCuenta, 'activa'),
        lte(
          sql`COALESCE(${estudiantes.ultimaActividadEn}, ${estudiantes.createdAt})`,
          hace25Dias
        ),
        isNull(estudiantes.avisoEliminacionEnviadoEn)
      )
    );

  let avisosCount = 0;
  for (const est of candidatosAviso) {
    const { protegida, motivos } = await evaluarProteccion(est.userId);
    if (protegida) {
      console.log(`[DEPURACION] Saltando alumno protegido #${est.userId}:`, motivos);
      continue;
    }

    const [userRow] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, est.userId));

    if (!userRow) continue;

    const [gestorRow] = est.gestorId
      ? await db
          .select({ nombreCompleto: sql<string>`g.nombre_completo`, emailPublico: sql<string>`g.email_publico` })
          .from(sql`gestores g`)
          .where(sql`g.user_id = ${est.gestorId}`)
      : [];

    const fechaEliminacion = new Date(ahora.getTime() + 5 * 24 * 60 * 60 * 1000);

    await sendAvisoEliminacion(userRow.email, {
      nombreCompleto: est.nombreCompleto,
      fechaEliminacion: fechaEliminacion.toLocaleDateString('es-MX', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      gestor: gestorRow
        ? { nombre: gestorRow.nombreCompleto as string, email: gestorRow.emailPublico as string }
        : null,
    });

    await db
      .update(estudiantes)
      .set({
        avisoEliminacionEnviadoEn: ahora,
        estadoCuenta: 'aviso_enviado',
      })
      .where(eq(estudiantes.userId, est.userId));

    await notificarATodosLosAdmins({
      tipo: 'cuenta_aviso_eliminacion',
      prioridad: 'baja',
      titulo: 'Aviso de eliminación enviado',
      cuerpo: `${est.nombreCompleto} recibió el aviso. Será eliminado en 5 días si no sube documentos o pagos.`,
      enlace: `/admin/alumnos/${est.userId}`,
    });

    avisosCount++;
    console.log(`[DEPURACION] Aviso enviado a ${est.nombreCompleto} (#${est.userId})`);
  }

  // ── FASE 2: Soft delete a 30 días ──────────────────────────────────────

  const candidatosSoftDelete = await db
    .select()
    .from(estudiantes)
    .where(
      and(
        inArray(estudiantes.estadoCuenta, ['activa', 'aviso_enviado']),
        lte(
          sql`COALESCE(${estudiantes.ultimaActividadEn}, ${estudiantes.createdAt})`,
          hace30Dias
        )
      )
    );

  let softDeletedCount = 0;
  for (const est of candidatosSoftDelete) {
    const { protegida } = await evaluarProteccion(est.userId);
    if (protegida) continue;

    const baseDate = est.ultimaActividadEn ?? est.createdAt;
    const diasInactivo = Math.floor(
      (ahora.getTime() - new Date(baseDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    const docs = await db
      .select()
      .from(expedienteDocumentos)
      .where(eq(expedienteDocumentos.estudianteId, est.userId));

    const pagosRows = await db
      .select()
      .from(pagos)
      .where(eq(pagos.estudianteId, est.userId));

    const [municipio] = est.municipioId
      ? await db
          .select({ nombre: municipios.nombre })
          .from(municipios)
          .where(eq(municipios.id, est.municipioId))
      : [];

    const [userRow] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, est.userId));

    // Auditoría
    await db.insert(eliminacionesAuditoria).values({
      estudianteId: est.userId,
      nombreCompleto: est.nombreCompleto,
      curp: est.curp ?? null,
      email: userRow?.email ?? null,
      municipioNombre: municipio?.nombre ?? null,
      folioPreregistro: est.folioPreregistro ?? null,
      tipo: 'soft_delete',
      motivo: `Inactividad: ${docs.length} documentos, ${pagosRows.length} pagos en ${diasInactivo} días`,
      diasSinActividad: diasInactivo,
      documentosTenia: docs.length,
      pagosTenia: pagosRows.length,
      teniaMatriculaDGB: !!est.matriculaOficialDGB,
      ejecutadoPorSistema: true,
    });

    await db
      .update(estudiantes)
      .set({
        estadoCuenta: 'soft_deleted',
        softDeletedEn: ahora,
        softDeleteMotivo: `Inactividad: ${diasInactivo} días sin subir docs ni pagos`,
        protegidaContraEliminacion: false,
      })
      .where(eq(estudiantes.userId, est.userId));

    // Deshabilitar acceso
    await db.update(users).set({ activo: false }).where(eq(users.id, est.userId));

    softDeletedCount++;
    console.log(`[DEPURACION] Soft delete: ${est.nombreCompleto} (#${est.userId})`);
  }

  if (softDeletedCount > 0) {
    await notificarATodosLosAdmins({
      tipo: 'cuentas_eliminadas_lote',
      prioridad: 'normal',
      titulo: 'Depuración automática completada',
      cuerpo: `${softDeletedCount} cuentas inactivas pasaron a soft delete. Quedarán 90 días antes del borrado definitivo.`,
      enlace: '/admin/configuracion/depuracion',
    });
  }

  // ── FASE 3: Hard delete tras 90 días en soft delete ────────────────────

  const candidatosHardDelete = await db
    .select()
    .from(estudiantes)
    .where(
      and(
        eq(estudiantes.estadoCuenta, 'soft_deleted'),
        lte(estudiantes.softDeletedEn, hace90Dias)
      )
    );

  let hardDeletedCount = 0;
  for (const est of candidatosHardDelete) {
    // Auditoría anonimizada (LGPDPPSO)
    await db.insert(eliminacionesAuditoria).values({
      estudianteId: est.userId,
      nombreCompleto: `[ELIMINADO] ID ${est.userId}`,
      curp: null,
      email: null,
      municipioNombre: null,
      folioPreregistro: est.folioPreregistro ?? null,
      tipo: 'hard_delete',
      motivo: '90 días en soft delete completados',
      diasSinActividad: null,
      teniaMatriculaDGB: !!est.matriculaOficialDGB,
      ejecutadoPorSistema: true,
    });

    // Borrar datos (cascada manual)
    await db
      .delete(expedienteDocumentos)
      .where(eq(expedienteDocumentos.estudianteId, est.userId));
    await db.delete(pagos).where(eq(pagos.estudianteId, est.userId));
    await db
      .delete(notificaciones)
      .where(eq(notificaciones.userId, est.userId));
    await db.delete(estudiantes).where(eq(estudiantes.userId, est.userId));
    await db.delete(users).where(eq(users.id, est.userId));

    hardDeletedCount++;
    console.log(`[DEPURACION] Hard delete ID #${est.userId}`);
  }

  const resumen = {
    avisos: avisosCount,
    softDelete: softDeletedCount,
    hardDelete: hardDeletedCount,
  };

  // Audit log del sistema
  await db.insert(auditLog).values({
    userId: null,
    userNombre: 'Sistema',
    userRol: 'sistema',
    accion: 'DEPURACION_AUTOMATICA',
    entidad: 'sistema',
    detalle: `Job diario: ${avisosCount} avisos, ${softDeletedCount} soft delete, ${hardDeletedCount} hard delete`,
    metadata: resumen,
  });

  console.log(`[DEPURACION] Resumen: ${avisosCount} avisos, ${softDeletedCount} soft delete, ${hardDeletedCount} hard delete`);
  return resumen;
}

// ── Iniciar cron ──────────────────────────────────────────────────────────

export function iniciarCronDepuracion(): void {
  // Todos los días a las 3 AM hora de México
  cron.schedule(
    '0 3 * * *',
    () => {
      correrDepuracion().catch((e) => console.error('[DEPURACION] Error en job:', e));
    },
    { timezone: 'America/Mexico_City' }
  );
  console.log('[DEPURACION] Cron diario registrado (03:00 AM Mexico City)');
}
