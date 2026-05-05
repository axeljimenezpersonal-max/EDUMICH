import type { Request } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { auditLog, users, gestores, estudiantes, administradores } from '@workspace/db/schema';

interface AuditParams {
  userId?: number | null;
  userNombre?: string | null;
  userRol?: string | null;
  accion: string;
  entidad: string;
  entidadId?: number | null;
  detalle?: string | null;
  metadata?: Record<string, unknown> | null;
  req?: Request;
}

function extractIp(req?: Request): string | null {
  if (!req) return null;
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.ip ?? null;
}

function extractUserAgent(req?: Request): string | null {
  return req?.headers['user-agent'] ?? null;
}

async function resolveUserInfo(userId: number): Promise<{ nombre: string | null; rol: string | null }> {
  const [user] = await db.select({ rol: users.rol }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return { nombre: null, rol: null };

  const rol = user.rol as string;
  let nombre: string | null = null;

  if (rol === 'gestor') {
    const [g] = await db.select({ nombreCompleto: gestores.nombreCompleto }).from(gestores).where(eq(gestores.userId, userId)).limit(1);
    nombre = g?.nombreCompleto ?? null;
  } else if (rol === 'estudiante') {
    const [e] = await db.select({ nombreCompleto: estudiantes.nombreCompleto }).from(estudiantes).where(eq(estudiantes.userId, userId)).limit(1);
    nombre = e?.nombreCompleto ?? null;
  } else if (rol === 'admin') {
    const [a] = await db.select({ nombreCompleto: administradores.nombreCompleto }).from(administradores).where(eq(administradores.userId, userId)).limit(1);
    nombre = a?.nombreCompleto ?? null;
  }

  return { nombre, rol };
}

/** Fire-and-forget audit insert. Never throws — audit failures are logged to console only. */
export async function tryAuditLog(params: AuditParams): Promise<void> {
  try {
    let { userNombre, userRol } = params;

    if (params.userId && (!userNombre || !userRol)) {
      const info = await resolveUserInfo(params.userId);
      userNombre = userNombre ?? info.nombre;
      userRol = userRol ?? info.rol;
    }

    await db.insert(auditLog).values({
      userId: params.userId ?? null,
      userNombre: userNombre ?? null,
      userRol: userRol ?? null,
      accion: params.accion,
      entidad: params.entidad,
      entidadId: params.entidadId ?? null,
      detalle: params.detalle ?? null,
      metadata: params.metadata ?? null,
      ip: extractIp(params.req),
      userAgent: extractUserAgent(params.req),
    });
  } catch (err) {
    console.error('[AuditLog] Failed to insert audit entry:', err);
  }
}
