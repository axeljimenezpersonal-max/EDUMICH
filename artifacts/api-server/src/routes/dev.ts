/**
 * Endpoints de testing solo disponibles en modo desarrollo.
 * POST /dev/correr-depuracion-ahora   → dispara el job manualmente
 * POST /dev/simular-inactividad/:id   → retrocede ultima_actividad_en N días
 */

import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { estudiantes } from '@workspace/db/schema';
import { authRequired, requireRol } from '../middleware/auth';
import { correrDepuracion } from '../services/depuracion';

const router = Router();

// Solo disponible en entornos no-producción
router.use((_req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(404).json({ error: 'Endpoint no disponible en producción' });
    return;
  }
  next();
});

router.use(authRequired, requireRol('admin'));

// POST /dev/correr-depuracion-ahora
router.post('/correr-depuracion-ahora', async (_req, res) => {
  console.log('[DEV] Disparando depuración manualmente...');
  const resultado = await correrDepuracion();
  res.json({ ok: true, ...resultado });
});

// POST /dev/simular-inactividad/:alumnoId
router.post('/simular-inactividad/:alumnoId', async (req, res) => {
  const estudianteId = Number(req.params.alumnoId);
  const diasAtras = Number(req.body?.diasAtras ?? 31);

  if (!estudianteId || isNaN(diasAtras) || diasAtras <= 0) {
    res.status(400).json({ error: 'ID y diasAtras requeridos' });
    return;
  }

  const nuevaFecha = new Date(Date.now() - diasAtras * 24 * 60 * 60 * 1000);

  const [est] = await db
    .select({ userId: estudiantes.userId, nombreCompleto: estudiantes.nombreCompleto })
    .from(estudiantes)
    .where(eq(estudiantes.userId, estudianteId));

  if (!est) { res.status(404).json({ error: 'Alumno no encontrado' }); return; }

  await db
    .update(estudiantes)
    .set({
      ultimaActividadEn: nuevaFecha,
      avisoEliminacionEnviadoEn: null,
      estadoCuenta: 'activa',
    })
    .where(eq(estudiantes.userId, estudianteId));

  res.json({
    ok: true,
    alumno: est.nombreCompleto,
    ultimaActividadEn: nuevaFecha.toISOString(),
    diasAtras,
  });
});

export default router;
