/**
 * Preguntas frecuentes — administrables por la administración.
 *  - GET /api/faq            → preguntas activas para el rol del usuario.
 *  - /api/admin/faq (CRUD)   → alta/edición/baja (solo admin).
 */
import { Router } from 'express';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { preguntasFrecuentes } from '@workspace/db/schema';
import { authRequired, requireRol } from '../middleware/auth';

const router = Router();
router.use(authRequired);

// GET /api/faq — preguntas activas visibles para el rol de quien consulta.
router.get('/', async (req, res) => {
  const rol = req.user!.rol;
  const audiencias =
    rol === 'estudiante' ? ['estudiante', 'ambos']
    : rol === 'gestor' ? ['gestor', 'ambos']
    : ['estudiante', 'gestor', 'ambos']; // admin/dirección: vista previa de todo
  const rows = await db
    .select()
    .from(preguntasFrecuentes)
    .where(and(eq(preguntasFrecuentes.activa, true), inArray(preguntasFrecuentes.audiencia, audiencias)))
    .orderBy(asc(preguntasFrecuentes.orden), asc(preguntasFrecuentes.id));
  res.json({ preguntas: rows });
});

// ── CRUD de administración ─────────────────────────────────────────────────
export const adminFaqRouter = Router();
adminFaqRouter.use(authRequired, requireRol('admin'));

adminFaqRouter.get('/', async (_req, res) => {
  const rows = await db
    .select()
    .from(preguntasFrecuentes)
    .orderBy(asc(preguntasFrecuentes.orden), asc(preguntasFrecuentes.id));
  res.json({ preguntas: rows });
});

const faqSchema = z.object({
  pregunta: z.string().min(3).max(300),
  respuesta: z.string().min(1),
  categoria: z.string().min(1).max(60),
  audiencia: z.enum(['estudiante', 'gestor', 'ambos']),
  orden: z.number().int().optional(),
  activa: z.boolean().optional(),
});

adminFaqRouter.post('/', async (req, res) => {
  const p = faqSchema.safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: p.error.issues[0]?.message ?? 'Datos inválidos' }); return; }
  const [row] = await db.insert(preguntasFrecuentes).values({ ...p.data }).returning();
  res.json({ pregunta: row });
});

adminFaqRouter.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: 'ID inválido' }); return; }
  const p = faqSchema.partial().safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: 'Datos inválidos' }); return; }
  await db.update(preguntasFrecuentes).set({ ...p.data, updatedAt: new Date() }).where(eq(preguntasFrecuentes.id, id));
  res.json({ ok: true });
});

adminFaqRouter.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: 'ID inválido' }); return; }
  await db.delete(preguntasFrecuentes).where(eq(preguntasFrecuentes.id, id));
  res.json({ ok: true });
});

export default router;
