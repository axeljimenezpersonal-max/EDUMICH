import { Router } from 'express';
import { and, eq, desc, count, sql } from 'drizzle-orm';
import { db } from '../db';
import { notificaciones } from '@workspace/db/schema';
import { authRequired } from '../middleware/auth';

const router = Router();

router.use(authRequired);

// ─── GET /notificaciones ─────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const userId = req.user!.userId;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;
  const soloNoLeidas = req.query.noLeidas === 'true';

  const where = soloNoLeidas
    ? and(eq(notificaciones.userId, userId), eq(notificaciones.leida, false))
    : eq(notificaciones.userId, userId);

  const [{ total }] = await db
    .select({ total: count() })
    .from(notificaciones)
    .where(where);

  const rows = await db
    .select()
    .from(notificaciones)
    .where(where)
    .orderBy(desc(notificaciones.creadaEn))
    .limit(limit)
    .offset(offset);

  res.json({ notificaciones: rows, total, page, pages: Math.ceil(total / limit) });
});

// ─── GET /notificaciones/contador ────────────────────────────────────────────
router.get('/contador', async (req, res) => {
  const userId = req.user!.userId;
  const [{ noLeidas }] = await db
    .select({ noLeidas: count() })
    .from(notificaciones)
    .where(and(eq(notificaciones.userId, userId), eq(notificaciones.leida, false)));

  res.json({ noLeidas });
});

// ─── PUT /notificaciones/:id/leer ────────────────────────────────────────────
router.put('/:id/leer', async (req, res) => {
  const userId = req.user!.userId;
  const id = Number(req.params.id);
  if (Number.isNaN(id)) { res.status(400).json({ error: 'ID inválido' }); return; }

  const [notif] = await db
    .select({ id: notificaciones.id, userId: notificaciones.userId })
    .from(notificaciones)
    .where(and(eq(notificaciones.id, id), eq(notificaciones.userId, userId)));

  if (!notif) { res.status(404).json({ error: 'Notificación no encontrada' }); return; }

  await db
    .update(notificaciones)
    .set({ leida: true, leidaEn: new Date() })
    .where(eq(notificaciones.id, id));

  res.json({ ok: true });
});

// ─── PUT /notificaciones/leer-todas ──────────────────────────────────────────
router.put('/leer-todas', async (req, res) => {
  const userId = req.user!.userId;

  await db
    .update(notificaciones)
    .set({ leida: true, leidaEn: new Date() })
    .where(and(eq(notificaciones.userId, userId), eq(notificaciones.leida, false)));

  res.json({ ok: true });
});

// ─── DELETE /notificaciones/:id ──────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const userId = req.user!.userId;
  const id = Number(req.params.id);
  if (Number.isNaN(id)) { res.status(400).json({ error: 'ID inválido' }); return; }

  const [notif] = await db
    .select({ id: notificaciones.id })
    .from(notificaciones)
    .where(and(eq(notificaciones.id, id), eq(notificaciones.userId, userId)));

  if (!notif) { res.status(404).json({ error: 'Notificación no encontrada' }); return; }

  await db.delete(notificaciones).where(eq(notificaciones.id, id));

  res.json({ ok: true });
});

export default router;
