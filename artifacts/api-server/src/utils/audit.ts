import type { Request } from 'express';
import crypto from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { auditLog, users, gestores, estudiantes, administradores } from '@workspace/db/schema';

/** Huella del primer eslabón: no hay entrada anterior a la que encadenarse. */
const GENESIS = '0'.repeat(64);

/**
 * El texto exacto que se firma. El orden y los separadores son parte del
 * contrato: si cambian, las huellas viejas dejan de reproducirse y toda la
 * cadena anterior se vuelve inverificable. No se toca.
 */
function contenidoFirmable(f: {
  createdAt: Date; userId: number | null; userRol: string | null;
  accion: string; entidad: string; entidadId: number | null;
  detalle: string | null; metadata: unknown; ip: string | null;
  hashPrevio: string;
}): string {
  return [
    f.createdAt.toISOString(),
    f.userId ?? '',
    f.userRol ?? '',
    f.accion,
    f.entidad,
    f.entidadId ?? '',
    f.detalle ?? '',
    f.metadata == null ? '' : JSON.stringify(f.metadata),
    f.ip ?? '',
    f.hashPrevio,
  ].join('|');
}

/** La huella de una entrada. Expuesta porque la verificación la recalcula. */
export function huellaEntrada(f: Parameters<typeof contenidoFirmable>[0]): string {
  return crypto.createHash('sha256').update(contenidoFirmable(f), 'utf8').digest('hex');
}

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

    // La cadena obliga a que las entradas se anexen de una en una: dos
    // simultáneas leerían la MISMA huella anterior y quedarían las dos
    // colgando del mismo eslabón, que es una cadena rota. El candado de aviso
    // las forma; la bitácora escribe poco, así que esperar no cuesta nada.
    const createdAt = new Date();
    const campos = {
      createdAt,
      userId: params.userId ?? null,
      userRol: userRol ?? null,
      accion: params.accion,
      entidad: params.entidad,
      entidadId: params.entidadId ?? null,
      detalle: params.detalle ?? null,
      metadata: (params.metadata ?? null) as unknown,
      ip: extractIp(params.req),
    };

    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('audit_log_cadena'))`);
      const [previa] = await tx
        .select({ hash: auditLog.hash })
        .from(auditLog)
        .orderBy(sql`${auditLog.id} DESC`)
        .limit(1);
      const hashPrevio = previa?.hash ?? GENESIS;
      const hash = huellaEntrada({ ...campos, hashPrevio });

      await tx.insert(auditLog).values({
        ...campos,
        metadata: params.metadata ?? null,
        userNombre: userNombre ?? null,
        userAgent: extractUserAgent(params.req),
        hashPrevio,
        hash,
      });
    });
  } catch (err) {
    console.error('[AuditLog] Failed to insert audit entry:', err);
  }
}
