/**
 * AULA VIRTUAL (LMS-lite del gestor). Solo para gestores con `aulaHabilitada`
 * (módulo que Synapsis activa/cobra). NO tiene que ver con los módulos/pruebas
 * del alumno (que son un derecho aparte).
 *
 * - Gestor: crea Tareas, Materiales y Anuncios de su aula; ve las entregas.
 * - Alumno (de un gestor con aula): ve tareas/materiales/anuncios y entrega.
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { gestores, estudiantes, aulaTareas, aulaEntregas, aulaMateriales, aulaAnuncios } from '@workspace/db/schema';
import { authRequired, requireRol } from '../middleware/auth';

const router = Router();
router.use(authRequired);

async function aulaHabilitadaGestor(gestorUserId: number): Promise<boolean> {
  const [g] = await db.select({ h: gestores.aulaHabilitada }).from(gestores).where(eq(gestores.userId, gestorUserId));
  return !!g?.h;
}

// ── Estado del aula para el usuario actual (gatea el nav en el front) ──
router.get('/estado', async (req: Request, res: Response) => {
  const { userId, rol } = req.user!;
  let habilitada = false;
  if (rol === 'gestor') habilitada = await aulaHabilitadaGestor(userId);
  else if (rol === 'estudiante') {
    const [e] = await db.select({ gestorId: estudiantes.gestorId }).from(estudiantes).where(eq(estudiantes.userId, userId));
    if (e?.gestorId) habilitada = await aulaHabilitadaGestor(e.gestorId);
  }
  res.json({ habilitada });
});

// ═══════════════════════════ GESTOR ═══════════════════════════
async function soloGestorConAula(req: Request, res: Response, next: NextFunction) {
  if (req.user!.rol !== 'gestor') { res.status(403).json({ error: 'Solo para gestores.' }); return; }
  if (!(await aulaHabilitadaGestor(req.user!.userId))) { res.status(403).json({ error: 'Tu aula virtual no está habilitada.' }); return; }
  next();
}
const g = Router();
g.use(soloGestorConAula);

// Resumen (contadores + alumnos)
g.get('/resumen', async (req, res) => {
  const gid = req.user!.userId;
  const [[t], [m], [a], [al]] = await Promise.all([
    db.execute<{ n: string }>(sql`SELECT COUNT(*) n FROM aula_tareas WHERE gestor_user_id = ${gid}`).then(r => r.rows),
    db.execute<{ n: string }>(sql`SELECT COUNT(*) n FROM aula_materiales WHERE gestor_user_id = ${gid}`).then(r => r.rows),
    db.execute<{ n: string }>(sql`SELECT COUNT(*) n FROM aula_anuncios WHERE gestor_user_id = ${gid}`).then(r => r.rows),
    db.execute<{ n: string }>(sql`SELECT COUNT(*) n FROM estudiantes WHERE gestor_id = ${gid}`).then(r => r.rows),
  ]);
  res.json({ tareas: Number(t.n), materiales: Number(m.n), anuncios: Number(a.n), alumnos: Number(al.n) });
});

// ── Tareas ──
g.get('/tareas', async (req, res) => {
  const gid = req.user!.userId;
  const rows = await db.execute<{ id: number; titulo: string; instrucciones: string | null; fecha_entrega: string | null; created_at: string; entregas: string }>(sql`
    SELECT t.id, t.titulo, t.instrucciones, t.fecha_entrega::text, t.created_at::text,
           (SELECT COUNT(*) FROM aula_entregas e WHERE e.tarea_id = t.id) AS entregas
    FROM aula_tareas t WHERE t.gestor_user_id = ${gid} ORDER BY t.created_at DESC`).then(r => r.rows);
  const [al] = await db.execute<{ n: string }>(sql`SELECT COUNT(*) n FROM estudiantes WHERE gestor_id = ${gid}`).then(r => r.rows);
  res.json({ tareas: rows.map(r => ({ id: r.id, titulo: r.titulo, instrucciones: r.instrucciones, fechaEntrega: r.fecha_entrega, createdAt: r.created_at, entregas: Number(r.entregas) })), totalAlumnos: Number(al.n) });
});

const tareaSchema = z.object({
  titulo: z.string().trim().min(1).max(200),
  instrucciones: z.string().trim().max(5000).optional().or(z.literal('')),
  fechaEntrega: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().or(z.literal('')),
});
g.post('/tareas', async (req, res) => {
  const p = tareaSchema.safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: 'Datos inválidos' }); return; }
  const fe = p.data.fechaEntrega && p.data.fechaEntrega !== '' ? new Date(p.data.fechaEntrega) : null;
  const [t] = await db.insert(aulaTareas).values({
    gestorUserId: req.user!.userId, titulo: p.data.titulo,
    instrucciones: p.data.instrucciones || null, fechaEntrega: fe,
  }).returning();
  res.json({ tarea: t });
});
g.delete('/tareas/:id', async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  await db.delete(aulaTareas).where(and(eq(aulaTareas.id, id), eq(aulaTareas.gestorUserId, req.user!.userId)));
  res.json({ ok: true });
});
g.get('/tareas/:id/entregas', async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  // valida propiedad
  const [t] = await db.select().from(aulaTareas).where(and(eq(aulaTareas.id, id), eq(aulaTareas.gestorUserId, req.user!.userId)));
  if (!t) { res.status(404).json({ error: 'Tarea no encontrada' }); return; }
  const entregas = await db.execute<{ alumno: string; estado: string; comentario: string | null; entregada_en: string }>(sql`
    SELECT es.nombre_completo AS alumno, e.estado, e.comentario, e.entregada_en::text
    FROM aula_entregas e JOIN estudiantes es ON es.user_id = e.estudiante_id
    WHERE e.tarea_id = ${id} ORDER BY e.entregada_en DESC`).then(r => r.rows);
  res.json({ entregas });
});

// ── Materiales ──
g.get('/materiales', async (req, res) => {
  const rows = await db.select().from(aulaMateriales).where(eq(aulaMateriales.gestorUserId, req.user!.userId)).orderBy(desc(aulaMateriales.createdAt));
  res.json({ materiales: rows });
});
const materialSchema = z.object({
  titulo: z.string().trim().min(1).max(200),
  descripcion: z.string().trim().max(2000).optional().or(z.literal('')),
  tipo: z.enum(['enlace', 'texto', 'video']),
  url: z.string().trim().max(1000).optional().or(z.literal('')),
  contenido: z.string().trim().max(10000).optional().or(z.literal('')),
});
g.post('/materiales', async (req, res) => {
  const p = materialSchema.safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: 'Datos inválidos' }); return; }
  const [m] = await db.insert(aulaMateriales).values({
    gestorUserId: req.user!.userId, titulo: p.data.titulo, descripcion: p.data.descripcion || null,
    tipo: p.data.tipo, url: p.data.url || null, contenido: p.data.contenido || null,
  }).returning();
  res.json({ material: m });
});
g.delete('/materiales/:id', async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  await db.delete(aulaMateriales).where(and(eq(aulaMateriales.id, id), eq(aulaMateriales.gestorUserId, req.user!.userId)));
  res.json({ ok: true });
});

// ── Anuncios de aula ──
g.get('/anuncios', async (req, res) => {
  const rows = await db.select().from(aulaAnuncios).where(eq(aulaAnuncios.gestorUserId, req.user!.userId)).orderBy(desc(aulaAnuncios.createdAt));
  res.json({ anuncios: rows });
});
const anuncioSchema = z.object({ titulo: z.string().trim().min(1).max(200), cuerpo: z.string().trim().min(1).max(5000) });
g.post('/anuncios', async (req, res) => {
  const p = anuncioSchema.safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: 'Datos inválidos' }); return; }
  const [a] = await db.insert(aulaAnuncios).values({ gestorUserId: req.user!.userId, titulo: p.data.titulo, cuerpo: p.data.cuerpo }).returning();
  res.json({ anuncio: a });
});
g.delete('/anuncios/:id', async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  await db.delete(aulaAnuncios).where(and(eq(aulaAnuncios.id, id), eq(aulaAnuncios.gestorUserId, req.user!.userId)));
  res.json({ ok: true });
});

router.use('/gestor', g);

// ═══════════════════════════ ALUMNO ═══════════════════════════
router.get('/mi-aula', requireRol('estudiante'), async (req, res) => {
  const uid = req.user!.userId;
  const [e] = await db.select({ gestorId: estudiantes.gestorId }).from(estudiantes).where(eq(estudiantes.userId, uid));
  if (!e?.gestorId || !(await aulaHabilitadaGestor(e.gestorId))) { res.json({ habilitada: false }); return; }
  const gid = e.gestorId;
  const [gInfo] = await db.select({ nombre: gestores.nombreCompleto, centro: gestores.centroAsesoria }).from(gestores).where(eq(gestores.userId, gid));

  const tareas = await db.execute<{ id: number; titulo: string; instrucciones: string | null; fecha_entrega: string | null; created_at: string; mi_estado: string | null; mi_comentario: string | null }>(sql`
    SELECT t.id, t.titulo, t.instrucciones, t.fecha_entrega::text, t.created_at::text,
           e.estado AS mi_estado, e.comentario AS mi_comentario
    FROM aula_tareas t
    LEFT JOIN aula_entregas e ON e.tarea_id = t.id AND e.estudiante_id = ${uid}
    WHERE t.gestor_user_id = ${gid} AND t.publicada = true
    ORDER BY t.created_at DESC`).then(r => r.rows);
  const materiales = await db.select().from(aulaMateriales).where(eq(aulaMateriales.gestorUserId, gid)).orderBy(desc(aulaMateriales.createdAt));
  const anuncios = await db.select().from(aulaAnuncios).where(eq(aulaAnuncios.gestorUserId, gid)).orderBy(desc(aulaAnuncios.createdAt));

  res.json({
    habilitada: true,
    gestor: { nombre: gInfo?.nombre ?? '', centro: gInfo?.centro ?? null },
    tareas: tareas.map(t => ({ id: t.id, titulo: t.titulo, instrucciones: t.instrucciones, fechaEntrega: t.fecha_entrega, createdAt: t.created_at, miEstado: t.mi_estado, miComentario: t.mi_comentario })),
    materiales, anuncios,
  });
});

const entregaSchema = z.object({ comentario: z.string().trim().max(3000).optional().or(z.literal('')) });
router.post('/tareas/:id/entregar', requireRol('estudiante'), async (req, res) => {
  const uid = req.user!.userId;
  const id = parseInt(String(req.params.id), 10);
  const p = entregaSchema.safeParse(req.body ?? {});
  const comentario = p.success ? (p.data.comentario || null) : null;
  // valida que la tarea sea del aula de su gestor y esté publicada
  const [e] = await db.select({ gestorId: estudiantes.gestorId }).from(estudiantes).where(eq(estudiantes.userId, uid));
  const [t] = await db.select().from(aulaTareas).where(eq(aulaTareas.id, id));
  if (!t || !e?.gestorId || t.gestorUserId !== e.gestorId) { res.status(404).json({ error: 'Tarea no encontrada' }); return; }
  await db.insert(aulaEntregas).values({ tareaId: id, estudianteId: uid, estado: 'entregada', comentario })
    .onConflictDoUpdate({ target: [aulaEntregas.tareaId, aulaEntregas.estudianteId], set: { comentario, estado: 'entregada', entregadaEn: new Date() } });
  res.json({ ok: true });
});

export default router;
