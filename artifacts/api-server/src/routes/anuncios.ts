/**
 * Rutas de anuncios para usuarios autenticados (cualquier rol)
 * GET  /anuncios/mios   — lista anuncios relevantes al usuario (audience filter)
 * POST /anuncios/:id/cerrar — marca el anuncio como visto/cerrado
 */

import { Router } from 'express';
import { eq, sql, and, or, isNull, gte } from 'drizzle-orm';
import { db } from '../db';
import { anuncios, anunciosVistos, estudiantes, gestores } from '@workspace/db/schema';
import { authRequired } from '../middleware/auth';

const router = Router();
router.use(authRequired);

router.get('/mios', async (req, res) => {
  const { userId, rol } = req.user!;

  // Determine municipio of the user for audience filtering
  let municipioId: number | null = null;
  if (rol === 'estudiante') {
    const [e] = await db.select({ municipioId: estudiantes.municipioId }).from(estudiantes).where(eq(estudiantes.userId, userId));
    municipioId = e?.municipioId ?? null;
  } else if (rol === 'gestor') {
    const [g] = await db.select({ municipioId: gestores.municipioId }).from(gestores).where(eq(gestores.userId, userId));
    municipioId = g?.municipioId ?? null;
  }

  // Audience predicates
  const audiencePred = rol === 'admin'
    ? sql`true`
    : rol === 'gestor'
      ? sql`(a.audiencia IN ('todos','gestores') OR (a.audiencia = 'gestor_especifico' AND a.audiencia_param = ${String(userId)}) OR (a.audiencia = 'alumnos_municipio' AND a.audiencia_param = ${String(municipioId ?? 0)}))`
      : sql`(a.audiencia IN ('todos','alumnos') OR (a.audiencia = 'alumnos_municipio' AND a.audiencia_param = ${String(municipioId ?? 0)}))`;

  const now = new Date().toISOString();

  const rows = await db.execute(sql`
    SELECT
      a.id,
      a.titulo,
      a.contenido,
      a.prioridad,
      a.audiencia,
      a.cta_texto AS "ctaTexto",
      a.cta_url   AS "ctaUrl",
      a.publicado_en AS "publicadoEn",
      a.activo_hasta AS "activoHasta",
      EXISTS(SELECT 1 FROM anuncios_vistos av WHERE av.anuncio_id = a.id AND av.user_id = ${userId}) AS "yaVisto"
    FROM anuncios a
    WHERE a.estado = 'publicado'
      AND (a.activo_hasta IS NULL OR a.activo_hasta > NOW())
      AND ${audiencePred}
    ORDER BY
      CASE a.prioridad WHEN 'urgente' THEN 0 WHEN 'importante' THEN 1 ELSE 2 END,
      a.publicado_en DESC
    LIMIT 20
  `);

  res.json({ anuncios: rows.rows });
});

router.post('/:id/cerrar', async (req, res) => {
  const { userId } = req.user!;
  const anuncioId = Number(req.params.id);
  if (Number.isNaN(anuncioId)) { res.status(400).json({ error: 'ID inválido' }); return; }

  await db.insert(anunciosVistos)
    .values({ anuncioId, userId })
    .onConflictDoNothing();

  res.json({ ok: true });
});

export default router;
