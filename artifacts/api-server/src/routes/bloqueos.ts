/**
 * Bloqueos de edición concurrente — "candado suave" con latido (heartbeat).
 *
 * Evita que dos colaboradores editen a la vez el mismo recurso sensible (una
 * cédula, una inscripción, una convocatoria…). El cliente:
 *   1. POST /:recurso            → toma (o renueva) el candado. Sirve de latido.
 *   2. POST /:recurso, cada ~10s → mantiene el candado vivo mientras edita.
 *   3. DELETE /:recurso          → lo suelta al salir (guardar / cancelar / cerrar).
 *
 * El candado está VIVO solo si `refrescado_en` es más reciente que el TTL. Si el
 * cliente se cae, cierra la pestaña o pierde la red y deja de latir, el candado
 * expira solo — nadie queda bloqueado por un "fantasma", que es justo el falso
 * positivo que hay que evitar.
 *
 * La toma es ATÓMICA (INSERT … ON CONFLICT DO UPDATE … WHERE mío-o-vencido):
 * Postgres resuelve la carrera, así que el candado nunca se otorga a dos a la
 * vez, ni siquiera si dos personas entran en el mismo milisegundo.
 */
import { Router } from 'express';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  bloqueosEdicion,
  gestores,
  administradores,
  directores,
  estudiantes,
} from '@workspace/db/schema';
import { authRequired, type SessionUser } from '../middleware/auth';

const router = Router();
router.use(authRequired);

// El candado vive este tiempo sin latido. El cliente late cada ~10s, así que
// 30s deja margen para un latido perdido sin dejar candados fantasma colgados.
const TTL_SEGUNDOS = 30;

// Clave de recurso: "tipo:id" (ej. "alumno:123"). Acotada a propósito para que
// nadie pueda sembrar claves arbitrarias en la tabla.
const RECURSO_RE = /^[a-z][a-z0-9_]{1,40}:[0-9]{1,18}$/;

/** Nombre para mostrar del titular, según su rol. Las cuatro tablas de perfil
 *  tienen `nombreCompleto`; si no hubiera fila, cae a un genérico. */
async function nombreUsuario(user: SessionUser): Promise<string> {
  const tabla =
    user.rol === 'gestor' ? gestores
    : user.rol === 'admin' ? administradores
    : user.rol === 'direccion' ? directores
    : estudiantes;
  const [row] = await db
    .select({ nombre: tabla.nombreCompleto })
    .from(tabla)
    .where(eq(tabla.userId, user.userId));
  return row?.nombre ?? 'Colaborador';
}

interface Titular {
  userId: number;
  nombre: string;
  rol: string;
  desde: Date;
}

function aTitular(fila: typeof bloqueosEdicion.$inferSelect): Titular {
  return { userId: fila.userId, nombre: fila.nombre, rol: fila.rol, desde: fila.adquiridoEn };
}

/**
 * POST /:recurso — toma o renueva el candado. Idempotente: si ya es mío, lo
 * refresca (latido). Responde quién lo tiene en todos los casos.
 *   { ok: true,  propio: true,  titular }  → es tuyo, puedes editar
 *   { ok: false, propio: false, titular }  → lo tiene otra persona (viva)
 */
router.post('/:recurso', async (req, res) => {
  const recurso = req.params.recurso;
  if (!RECURSO_RE.test(recurso)) { res.status(400).json({ error: 'Recurso inválido' }); return; }
  const user = req.user!;
  const nombre = await nombreUsuario(user);

  // Toma atómica: solo actualiza si el candado es mío o ya venció.
  const upsert = await db.execute(sql`
    INSERT INTO bloqueos_edicion (recurso, user_id, nombre, rol, adquirido_en, refrescado_en)
    VALUES (${recurso}, ${user.userId}, ${nombre}, ${user.rol}, now(), now())
    ON CONFLICT (recurso) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      nombre = EXCLUDED.nombre,
      rol = EXCLUDED.rol,
      refrescado_en = now(),
      adquirido_en = CASE
        WHEN bloqueos_edicion.user_id = EXCLUDED.user_id THEN bloqueos_edicion.adquirido_en
        ELSE now()
      END
    WHERE bloqueos_edicion.user_id = EXCLUDED.user_id
       OR bloqueos_edicion.refrescado_en < now() - make_interval(secs => ${TTL_SEGUNDOS})
    RETURNING recurso
  `);
  const propio = (upsert.rows?.length ?? 0) > 0;

  const [fila] = await db.select().from(bloqueosEdicion).where(eq(bloqueosEdicion.recurso, recurso));
  // Si la fila desapareció entre medias (borrado concurrente), el recurso queda
  // libre: trátalo como tomado por mí.
  if (!fila) { res.json({ ok: true, propio: true, titular: null }); return; }
  res.json({ ok: propio, propio, titular: aTitular(fila) });
});

/**
 * GET /:recurso — estado del candado SIN tomarlo (para vistas de solo lectura
 * que solo quieren avisar "en edición por…"). Devuelve el titular solo si el
 * candado está vivo.
 */
router.get('/:recurso', async (req, res) => {
  const recurso = req.params.recurso;
  if (!RECURSO_RE.test(recurso)) { res.status(400).json({ error: 'Recurso inválido' }); return; }
  const [fila] = await db.select().from(bloqueosEdicion).where(eq(bloqueosEdicion.recurso, recurso));
  const vivo = fila && Date.now() - fila.refrescadoEn.getTime() < TTL_SEGUNDOS * 1000;
  if (!fila || !vivo) { res.json({ titular: null, propio: false }); return; }
  res.json({ titular: aTitular(fila), propio: fila.userId === req.user!.userId });
});

/**
 * DELETE /:recurso — suelta el candado. Solo borra si es tuyo (no puedes tirar
 * el candado de otro). Siempre responde ok — soltar es best-effort.
 */
router.delete('/:recurso', async (req, res) => {
  const recurso = req.params.recurso;
  if (!RECURSO_RE.test(recurso)) { res.json({ ok: true }); return; }
  await db
    .delete(bloqueosEdicion)
    .where(and(eq(bloqueosEdicion.recurso, recurso), eq(bloqueosEdicion.userId, req.user!.userId)));
  res.json({ ok: true });
});

export default router;
