/**
 * Auth middleware — sesión por cookie firmada (sin JWT, lo más simple posible).
 *
 * Guarda en la cookie `pa_session` el JSON { userId, rol } firmado con HMAC.
 * Suficiente para el demo. En producción se migra a sessions tabla o JWT con refresh.
 *
 * Ubicación destino en Replit: artifacts/api-server/src/middleware/auth.ts
 */

import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { SESSION_SECRET as SECRET } from '../config/env';
import { tryAuditLog } from '../utils/audit';

const COOKIE_NAME = 'pa_session';

export interface SessionUser {
  userId: number;
  rol: 'admin' | 'gestor' | 'estudiante' | 'direccion';
}

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

// Edad máxima absoluta de la sesión, validada en el SERVIDOR a partir de `iat`.
// Evita que una cookie copiada siga siendo válida indefinidamente aunque el
// cliente la conserve (el maxAge de la cookie solo lo respeta el navegador).
const MAX_SESSION_AGE_MS = 1000 * 60 * 60 * 24 * 7; // 7 días

function sign(payload: string): string {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
}

export function encodeSession(user: SessionUser): string {
  const data = { userId: user.userId, rol: user.rol, iat: Date.now() };
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

export function decodeSession(cookie: string): SessionUser | null {
  const [payload, sig] = cookie.split('.');
  if (!payload || !sig) return null;
  if (sign(payload) !== sig) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    // Rechaza sesiones sin marca de tiempo o expiradas (expiración server-side).
    if (typeof data?.iat !== 'number' || Date.now() - data.iat > MAX_SESSION_AGE_MS) {
      return null;
    }
    return { userId: data.userId, rol: data.rol };
  } catch {
    return null;
  }
}

/**
 * Pone la cookie y DEVUELVE el valor exacto que puso.
 *
 * Importa que lo devuelva: `encodeSession` incluye `iat: Date.now()`, así que
 * llamarlo otra vez para, por ejemplo, calcular el hash de la sesión daría un
 * valor distinto al de la cookie real.
 */
export function setSessionCookie(res: Response, user: SessionUser): string {
  const value = encodeSession(user);
  res.cookie(COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 días
    path: '/',
  });
  return value;
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

export function authRequired(req: Request, res: Response, next: NextFunction) {
  const cookie = req.cookies?.[COOKIE_NAME];
  if (!cookie) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }
  const user = decodeSession(cookie);
  if (!user) {
    // Una cookie presente que no valida es la señal más fuerte de ataque activo
    // que produce este sistema: alguien está intentando falsificar una sesión, o
    // reutilizando una robada después de que se invalidara. Antes se descartaba
    // con un 401 mudo y no quedaba rastro.
    //
    // No se espera al registro (sin `await`): la respuesta al atacante no debe
    // depender de que la bitácora escriba, ni tardar más por ello.
    void tryAuditLog({
      accion: 'sesion_invalida',
      entidad: 'auth',
      detalle: `Cookie de sesión inválida o expirada en ${req.method} ${req.path}`,
      metadata: { ruta: req.path, metodo: req.method },
      req,
    });
    res.status(401).json({ error: 'Sesión inválida' });
    return;
  }
  req.user = user;
  next();
}

export function requireRol(...roles: SessionUser['rol'][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }
    if (!roles.includes(req.user.rol)) {
      // Un usuario autenticado pidiendo algo que su rol no permite. Puede ser un
      // enlace viejo, pero también alguien tanteando qué alcanza — y sin registro
      // no hay forma de distinguirlo ni de ver el patrón. Aquí SÍ hay usuario,
      // así que queda con nombre.
      void tryAuditLog({
        userId: req.user.userId,
        accion: 'acceso_denegado',
        entidad: 'auth',
        detalle: `Rol ${req.user.rol} intentó ${req.method} ${req.path} (requiere: ${roles.join(', ')})`,
        metadata: { rol: req.user.rol, requeridos: roles, ruta: req.path, metodo: req.method },
        req,
      });
      res.status(403).json({ error: 'Rol no autorizado' });
      return;
    }
    next();
  };
}
