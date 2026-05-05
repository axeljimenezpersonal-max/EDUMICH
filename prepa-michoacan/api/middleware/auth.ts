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

const COOKIE_NAME = 'pa_session';
const SECRET = process.env.SESSION_SECRET || 'CAMBIAR_EN_PRODUCCION_michoacan_2026';

export interface SessionUser {
  userId: number;
  rol: 'admin' | 'gestor' | 'estudiante';
}

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
}

export function encodeSession(user: SessionUser): string {
  const payload = Buffer.from(JSON.stringify(user)).toString('base64url');
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

export function decodeSession(cookie: string): SessionUser | null {
  const [payload, sig] = cookie.split('.');
  if (!payload || !sig) return null;
  if (sign(payload) !== sig) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, user: SessionUser) {
  const value = encodeSession(user);
  res.cookie(COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 días
    path: '/',
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

export function authRequired(req: Request, res: Response, next: NextFunction) {
  const cookie = req.cookies?.[COOKIE_NAME];
  if (!cookie) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  const user = decodeSession(cookie);
  if (!user) {
    return res.status(401).json({ error: 'Sesión inválida' });
  }
  req.user = user;
  next();
}

export function requireRol(...roles: SessionUser['rol'][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'No autenticado' });
    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({ error: 'Rol no autorizado' });
    }
    next();
  };
}
