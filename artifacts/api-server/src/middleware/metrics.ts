/**
 * Métricas de salud del API — "golden signals" (latencia, tráfico, errores).
 *
 * Registra cada request /api/* en buckets por minuto en memoria (últimas 24 h).
 * Sin dependencias externas ni escritura a base de datos: el costo por request
 * es un par de sumas. El resumen se expone al rol dirección vía /api/direccion/salud.
 *
 * Nota: al reiniciar el proceso el historial se pierde (se reporta el uptime
 * del proceso para que quede claro desde cuándo se acumula).
 */

import type { Request, Response, NextFunction } from 'express';

// Límites de los buckets del histograma de latencia (ms). El último es +inf.
const HIST_LIMITS = [25, 50, 100, 250, 500, 1000, 2500, 5000, Infinity];

interface MinuteBucket {
  minute: number; // epoch minutes
  total: number;
  errores4xx: number;
  errores5xx: number;
  sumMs: number;
  maxMs: number;
  hist: number[]; // paralelo a HIST_LIMITS
  porGrupo: Record<string, { total: number; errores: number; sumMs: number }>;
}

const RETENTION_MINUTES = 24 * 60;
const buckets = new Map<number, MinuteBucket>();

export const PROCESS_START = Date.now();

function nowMinute(): number {
  return Math.floor(Date.now() / 60_000);
}

function getBucket(minute: number): MinuteBucket {
  let b = buckets.get(minute);
  if (!b) {
    b = {
      minute,
      total: 0,
      errores4xx: 0,
      errores5xx: 0,
      sumMs: 0,
      maxMs: 0,
      hist: HIST_LIMITS.map(() => 0),
      porGrupo: {},
    };
    buckets.set(minute, b);
    // Poda de buckets viejos (barato: sólo al crear uno nuevo)
    const cutoff = minute - RETENTION_MINUTES;
    for (const key of buckets.keys()) {
      if (key < cutoff) buckets.delete(key);
    }
  }
  return b;
}

/** Agrupa el path en su prefijo de API: /api/admin/... → 'admin' */
function grupoDeRuta(path: string): string {
  const m = /^\/api\/([^/?]+)/.exec(path);
  return m ? m[1] : 'otro';
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith('/api/')) {
    next();
    return;
  }
  const inicio = process.hrtime.bigint();
  // Capturado AHORA: dentro de res.on('finish') los routers de Express ya
  // recortaron req.path a la ruta relativa del mount y el grupo saldría mal.
  const grupo = grupoDeRuta(req.originalUrl);

  res.on('finish', () => {
    try {
      const ms = Number(process.hrtime.bigint() - inicio) / 1e6;
      const b = getBucket(nowMinute());
      b.total += 1;
      b.sumMs += ms;
      if (ms > b.maxMs) b.maxMs = ms;
      const idx = HIST_LIMITS.findIndex((lim) => ms <= lim);
      b.hist[idx === -1 ? HIST_LIMITS.length - 1 : idx] += 1;
      if (res.statusCode >= 500) b.errores5xx += 1;
      else if (res.statusCode >= 400) b.errores4xx += 1;

      const g = (b.porGrupo[grupo] ??= { total: 0, errores: 0, sumMs: 0 });
      g.total += 1;
      g.sumMs += ms;
      if (res.statusCode >= 400) g.errores += 1;
    } catch {
      // Las métricas jamás deben tirar una request.
    }
  });

  next();
}

/** Estima un percentil a partir del histograma acumulado. */
function percentilDeHistograma(hist: number[], total: number, p: number): number {
  if (total === 0) return 0;
  const objetivo = total * p;
  let acumulado = 0;
  for (let i = 0; i < hist.length; i++) {
    acumulado += hist[i];
    if (acumulado >= objetivo) {
      return HIST_LIMITS[i] === Infinity ? 5000 : HIST_LIMITS[i];
    }
  }
  return 5000;
}

export interface ResumenVentana {
  ventanaMinutos: number;
  totalRequests: number;
  requestsPorMinuto: number;
  errores4xx: number;
  errores5xx: number;
  tasaError: number; // % de respuestas >= 500
  latenciaPromedioMs: number;
  latenciaP50Ms: number;
  latenciaP95Ms: number;
  latenciaMaxMs: number;
  porGrupo: Array<{ grupo: string; total: number; errores: number; promedioMs: number }>;
}

export function resumenMetricas(ventanaMinutos: number): ResumenVentana {
  const desde = nowMinute() - ventanaMinutos;
  let total = 0;
  let errores4xx = 0;
  let errores5xx = 0;
  let sumMs = 0;
  let maxMs = 0;
  const hist = HIST_LIMITS.map(() => 0);
  const grupos: Record<string, { total: number; errores: number; sumMs: number }> = {};

  for (const b of buckets.values()) {
    if (b.minute <= desde) continue;
    total += b.total;
    errores4xx += b.errores4xx;
    errores5xx += b.errores5xx;
    sumMs += b.sumMs;
    if (b.maxMs > maxMs) maxMs = b.maxMs;
    b.hist.forEach((n, i) => (hist[i] += n));
    for (const [nombre, g] of Object.entries(b.porGrupo)) {
      const acc = (grupos[nombre] ??= { total: 0, errores: 0, sumMs: 0 });
      acc.total += g.total;
      acc.errores += g.errores;
      acc.sumMs += g.sumMs;
    }
  }

  return {
    ventanaMinutos,
    totalRequests: total,
    requestsPorMinuto: ventanaMinutos > 0 ? Math.round((total / ventanaMinutos) * 100) / 100 : 0,
    errores4xx,
    errores5xx,
    tasaError: total > 0 ? Math.round((errores5xx / total) * 10000) / 100 : 0,
    latenciaPromedioMs: total > 0 ? Math.round(sumMs / total) : 0,
    latenciaP50Ms: percentilDeHistograma(hist, total, 0.5),
    latenciaP95Ms: percentilDeHistograma(hist, total, 0.95),
    latenciaMaxMs: Math.round(maxMs),
    porGrupo: Object.entries(grupos)
      .map(([grupo, g]) => ({
        grupo,
        total: g.total,
        errores: g.errores,
        promedioMs: g.total > 0 ? Math.round(g.sumMs / g.total) : 0,
      }))
      .sort((a, b) => b.total - a.total),
  };
}

/** Serie por minuto para graficar tráfico/latencia (últimos N minutos). */
export function serieMetricas(ventanaMinutos: number): Array<{
  minuto: string; // ISO
  requests: number;
  errores: number;
  promedioMs: number;
}> {
  const inicio = nowMinute() - ventanaMinutos + 1;
  const out: Array<{ minuto: string; requests: number; errores: number; promedioMs: number }> = [];
  for (let m = inicio; m <= nowMinute(); m++) {
    const b = buckets.get(m);
    out.push({
      minuto: new Date(m * 60_000).toISOString(),
      requests: b?.total ?? 0,
      errores: (b?.errores4xx ?? 0) + (b?.errores5xx ?? 0),
      promedioMs: b && b.total > 0 ? Math.round(b.sumMs / b.total) : 0,
    });
  }
  return out;
}
