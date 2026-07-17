/**
 * Tutoriales vistos — persistencia por usuario y ETAPA.
 *
 * Sustituye al localStorage: el avance viaja con la cuenta, así que el alumno
 * que entra desde otro teléfono o limpia Safari no repite lo que ya vio.
 *
 * Sirve a los cuatro roles (la clave es `users.id`, no `estudiantes.id`).
 * Ver `schema.tutorialesVistos` para el porqué de la clave (clave + etapa) y de
 * los valores especiales de `etapa`: '' = sin etapa, '*' = silenciado.
 */
import { Router } from 'express';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { tutorialesVistos } from '@workspace/db/schema';
import { authRequired } from '../middleware/auth';

const router = Router();

router.use(authRequired);

/** Silenciado para siempre: el usuario pidió no volver a ver ese tutorial. */
const SILENCIADO = '*';

/** Acota lo que llega del cliente a lo que la columna admite. */
function limpiarClave(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s || s.length > 80) return null;
  return s;
}

function limpiarEtapa(v: unknown): string | null {
  if (v === undefined || v === null) return '';
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (s.length > 60) return null;
  return s;
}

// ─── GET /tutoriales ─────────────────────────────────────────────────────────
// Todo lo que este usuario ya vio. El cliente decide con esto si auto-arranca.
router.get('/', async (req, res) => {
  const userId = req.user!.userId;
  const rows = await db
    .select({ clave: tutorialesVistos.clave, etapa: tutorialesVistos.etapa })
    .from(tutorialesVistos)
    .where(eq(tutorialesVistos.userId, userId));
  res.json({ vistos: rows });
});

// ─── POST /tutoriales ────────────────────────────────────────────────────────
// Marca un tutorial como COMPLETADO en una etapa. Idempotente: repetirlo no
// duplica ni falla (el alumno puede reproducir el tutorial cuantas veces quiera).
router.post('/', async (req, res) => {
  const userId = req.user!.userId;
  const clave = limpiarClave(req.body?.clave);
  const etapa = limpiarEtapa(req.body?.etapa);
  if (clave === null || etapa === null) {
    return res.status(400).json({ error: 'clave o etapa inválida' });
  }

  await db
    .insert(tutorialesVistos)
    .values({ userId, clave, etapa })
    .onConflictDoNothing();

  return res.json({ ok: true });
});

// ─── POST /tutoriales/silenciar ──────────────────────────────────────────────
// «No volver a mostrar»: silencia el tutorial en TODAS sus etapas. El botón para
// reproducirlo a mano sigue funcionando; esto solo apaga el auto-arranque.
router.post('/silenciar', async (req, res) => {
  const userId = req.user!.userId;
  const clave = limpiarClave(req.body?.clave);
  if (clave === null) return res.status(400).json({ error: 'clave inválida' });

  await db
    .insert(tutorialesVistos)
    .values({ userId, clave, etapa: SILENCIADO })
    .onConflictDoNothing();

  return res.json({ ok: true });
});

// ─── DELETE /tutoriales ──────────────────────────────────────────────────────
// Reinicia los tutoriales del usuario (soporte: «no entendí, muéstramelo todo
// otra vez»). Sin `clave` borra todos; con `clave` solo ese.
router.delete('/', async (req, res) => {
  const userId = req.user!.userId;
  const clave = req.query.clave === undefined ? null : limpiarClave(req.query.clave);
  if (req.query.clave !== undefined && clave === null) {
    return res.status(400).json({ error: 'clave inválida' });
  }

  await db
    .delete(tutorialesVistos)
    .where(
      clave
        ? and(eq(tutorialesVistos.userId, userId), eq(tutorialesVistos.clave, clave))
        : eq(tutorialesVistos.userId, userId),
    );

  return res.json({ ok: true });
});

export default router;
