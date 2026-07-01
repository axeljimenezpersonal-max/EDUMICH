/**
 * Firma reutilizable por usuario ("guardar firma" estilo Apple).
 * Disponible para cualquier usuario autenticado (alumno o gestor).
 */
import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { firmasUsuario } from '@workspace/db/schema';
import { authRequired } from '../middleware/auth';

const router = Router();
router.use(authRequired);

const firmaSchema = z.object({
  imagenDataUrl: z
    .string()
    .regex(/^data:image\/(png|jpe?g);base64,/, 'Formato de imagen inválido')
    .max(700_000, 'La firma es demasiado grande'),
});

// GET /firma — mi firma guardada (o null)
router.get('/', async (req, res) => {
  const [f] = await db.select().from(firmasUsuario).where(eq(firmasUsuario.userId, req.user!.userId));
  res.json({ imagenDataUrl: f?.imagenDataUrl ?? null, actualizadaEn: f?.updatedAt ?? null });
});

// PUT /firma — guardar/reemplazar mi firma
router.put('/', async (req, res) => {
  const parse = firmaSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }
  const userId = req.user!.userId;
  await db
    .insert(firmasUsuario)
    .values({ userId, imagenDataUrl: parse.data.imagenDataUrl })
    .onConflictDoUpdate({
      target: firmasUsuario.userId,
      set: { imagenDataUrl: parse.data.imagenDataUrl, updatedAt: new Date() },
    });
  res.json({ ok: true });
});

// DELETE /firma — borrar mi firma
router.delete('/', async (req, res) => {
  await db.delete(firmasUsuario).where(eq(firmasUsuario.userId, req.user!.userId));
  res.json({ ok: true });
});

export default router;
