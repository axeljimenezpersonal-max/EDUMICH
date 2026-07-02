/**
 * Firmas reutilizables por usuario (estilo "guardar firma" de Apple).
 * Hasta 2 espacios; el usuario elige cuál está activa (la que se usa en la cédula).
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

const imagenSchema = z
  .string()
  .regex(/^data:image\/(png|jpe?g);base64,/, 'Formato de imagen inválido')
  .max(700_000, 'La firma es demasiado grande');

async function getRow(userId: number) {
  const [row] = await db.select().from(firmasUsuario).where(eq(firmasUsuario.userId, userId));
  return row ?? null;
}

// GET /firma — mis firmas guardadas + cuál está activa
router.get('/', async (req, res) => {
  const row = await getRow(req.user!.userId);
  res.json({
    firma1: row?.imagenDataUrl ?? null,
    firma2: row?.imagenDataUrl2 ?? null,
    activa: row?.activa ?? 1,
  });
});

// PUT /firma/:slot (1|2) — guardar/reemplazar una firma
router.put('/:slot', async (req, res) => {
  const slot = Number(req.params.slot);
  if (slot !== 1 && slot !== 2) { res.status(400).json({ error: 'Espacio inválido' }); return; }
  const parse = imagenSchema.safeParse(req.body?.imagenDataUrl);
  if (!parse.success) { res.status(400).json({ error: parse.error.issues[0]?.message ?? 'Datos inválidos' }); return; }
  const userId = req.user!.userId;

  const campo = slot === 1 ? { imagenDataUrl: parse.data } : { imagenDataUrl2: parse.data };
  await db
    .insert(firmasUsuario)
    .values({ userId, activa: slot, ...campo })
    .onConflictDoUpdate({
      target: firmasUsuario.userId,
      // al guardar una firma, esa pasa a ser la activa
      set: { ...campo, activa: slot, updatedAt: new Date() },
    });
  res.json({ ok: true });
});

// PATCH /firma/activa — elegir cuál firma usar
router.patch('/activa', async (req, res) => {
  const activa = Number(req.body?.activa);
  if (activa !== 1 && activa !== 2) { res.status(400).json({ error: 'Valor inválido' }); return; }
  const row = await getRow(req.user!.userId);
  if (!row) { res.status(404).json({ error: 'No hay firmas guardadas' }); return; }
  const tiene = activa === 1 ? row.imagenDataUrl : row.imagenDataUrl2;
  if (!tiene) { res.status(400).json({ error: 'Ese espacio de firma está vacío' }); return; }
  await db.update(firmasUsuario).set({ activa, updatedAt: new Date() }).where(eq(firmasUsuario.userId, req.user!.userId));
  res.json({ ok: true });
});

// DELETE /firma/:slot — borrar una firma; si era la activa, cambia a la otra si existe
router.delete('/:slot', async (req, res) => {
  const slot = Number(req.params.slot);
  if (slot !== 1 && slot !== 2) { res.status(400).json({ error: 'Espacio inválido' }); return; }
  const userId = req.user!.userId;
  const row = await getRow(userId);
  if (!row) { res.json({ ok: true }); return; }

  const otra = slot === 1 ? row.imagenDataUrl2 : row.imagenDataUrl;
  const campo = slot === 1 ? { imagenDataUrl: null } : { imagenDataUrl2: null };
  const nuevaActiva = row.activa === slot ? (otra ? (slot === 1 ? 2 : 1) : 1) : row.activa;
  await db
    .update(firmasUsuario)
    .set({ ...campo, activa: nuevaActiva, updatedAt: new Date() })
    .where(eq(firmasUsuario.userId, userId));
  res.json({ ok: true });
});

export default router;
