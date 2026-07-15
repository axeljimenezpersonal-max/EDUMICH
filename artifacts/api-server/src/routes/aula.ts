/**
 * AULA VIRTUAL (LMS-lite del gestor). Solo para gestores con `aulaHabilitada`
 * (módulo que Synapsis activa/cobra). NO tiene que ver con los módulos/pruebas
 * del alumno (que son un derecho aparte).
 *
 * - Gestor: crea Tareas, Materiales (con archivo), Anuncios "pro" (imagen,
 *   fijado, programación) y ve/descarga las entregas de sus alumnos.
 * - Alumno (de un gestor con aula): ve todo y entrega tareas con archivo.
 * - Foro tipo chat con adjuntos (imagen/PDF) para gestor + alumnos del aula.
 */
import path from 'node:path';
import fsp from 'node:fs/promises';
import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { gestores, estudiantes, aulaTareas, aulaEntregas, aulaMateriales, aulaForo, aulaForoVotos, aulaModulosClase, modulos } from '@workspace/db/schema';
import { authRequired, requireRol } from '../middleware/auth';
import { guardarSubida, archivoStream, archivoExiste } from '../services/storage';

const router = Router();
router.use(authRequired);

// ── Multer para archivos del aula (adjuntos de foro, entregas, materiales, imágenes de anuncio) ──
const AULA_DIR = process.env.STORAGE_DIR
  ? path.join(process.env.STORAGE_DIR, 'aula')
  : '/tmp/prepa-storage/aula';

const TIPOS_AULA = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

function crearUpload(permitidos: string[]) {
  return multer({
    storage: multer.diskStorage({
      destination: async (_req, _file, cb) => {
        await fsp.mkdir(AULA_DIR, { recursive: true });
        cb(null, AULA_DIR);
      },
      filename: (_req, file, cb) => {
        const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `${Date.now()}_${safe}`);
      },
    }),
    limits: { fileSize: 15 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!permitidos.includes(file.mimetype)) {
        cb(new Error('Tipo de archivo no permitido (imagen, PDF u Office).'));
        return;
      }
      cb(null, true);
    },
  });
}
const uploadAula = crearUpload(TIPOS_AULA);

// Envuelve multer para responder 400 con mensaje claro en vez de 500.
function conArchivo(campo: string, up: multer.Multer = uploadAula) {
  return (req: Request, res: Response, next: NextFunction) => {
    up.single(campo)(req, res, (err: unknown) => {
      if (err) { res.status(400).json({ error: err instanceof Error ? err.message : 'Archivo inválido' }); return; }
      // Multer decodifica originalname como latin1: los acentos y espacios
      // especiales salen como mojibake ("â€¯"). Se re-decodifica a UTF-8.
      if (req.file) req.file.originalname = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
      next();
    });
  };
}

async function aulaHabilitadaGestor(gestorUserId: number): Promise<boolean> {
  const [g] = await db.select({ h: gestores.aulaHabilitada }).from(gestores).where(eq(gestores.userId, gestorUserId));
  return !!g?.h;
}

// Resuelve de qué aula (gestor) participa el usuario actual.
async function aulaDelUsuario(userId: number, rol: string): Promise<number | null> {
  if (rol === 'gestor') return (await aulaHabilitadaGestor(userId)) ? userId : null;
  if (rol === 'estudiante') {
    const [e] = await db.select({ gestorId: estudiantes.gestorId }).from(estudiantes).where(eq(estudiantes.userId, userId));
    if (e?.gestorId && (await aulaHabilitadaGestor(e.gestorId))) return e.gestorId;
  }
  return null;
}

// Sirve un archivo por ref con nombre de descarga y tipo.
async function servirArchivo(res: Response, ref: string | null, nombre?: string | null, tipo?: string | null, inline = false) {
  if (!ref || !(await archivoExiste(ref))) { res.status(404).json({ error: 'Archivo no disponible' }); return; }
  if (tipo) res.setHeader('Content-Type', tipo);
  const disp = inline || (tipo && tipo.startsWith('image/')) ? 'inline' : 'attachment';
  res.setHeader('Content-Disposition', `${disp}; filename="${encodeURIComponent(nombre || 'archivo')}"`);
  archivoStream(ref).pipe(res);
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
  const [[t], [m], [f], [al]] = await Promise.all([
    db.execute<{ n: string }>(sql`SELECT COUNT(*) n FROM aula_tareas WHERE gestor_user_id = ${gid}`).then(r => r.rows),
    db.execute<{ n: string }>(sql`SELECT COUNT(*) n FROM aula_materiales WHERE gestor_user_id = ${gid}`).then(r => r.rows),
    db.execute<{ n: string }>(sql`SELECT COUNT(*) n FROM aula_foro WHERE gestor_user_id = ${gid}`).then(r => r.rows),
    db.execute<{ n: string }>(sql`SELECT COUNT(*) n FROM estudiantes WHERE gestor_id = ${gid}`).then(r => r.rows),
  ]);
  res.json({ tareas: Number(t.n), materiales: Number(m.n), foro: Number(f.n), alumnos: Number(al.n) });
});

// Candado del foro: modo "solo anuncios" (únicamente el gestor escribe)
g.patch('/foro-bloqueo', async (req, res) => {
  const gid = req.user!.userId;
  const [gRow] = await db.select({ b: gestores.foroSoloGestor }).from(gestores).where(eq(gestores.userId, gid));
  const nuevo = !gRow?.b;
  await db.update(gestores).set({ foroSoloGestor: nuevo }).where(eq(gestores.userId, gid));
  res.json({ ok: true, bloqueado: nuevo });
});

// ── Módulos que cursa el grupo (convocatoria abierta) — para el selector y el tablero ──
g.get('/modulos-grupo', async (req, res) => {
  const gid = req.user!.userId;
  const [conv] = await db.execute<{ id: number; nombre: string }>(sql`
    SELECT id, nombre FROM convocatorias WHERE estado = 'abierta' ORDER BY fecha_apertura DESC LIMIT 1`).then(r => r.rows);
  let enCurso: { moduloId: number; numero: number; nombre: string; alumnos: number }[] = [];
  if (conv) {
    enCurso = await db.execute<{ modulo_id: number; numero: number; nombre: string; alumnos: string }>(sql`
      SELECT m.id AS modulo_id, m.numero, m.nombre, COUNT(DISTINCT i.estudiante_id) AS alumnos
      FROM inscripciones i
      JOIN inscripcion_modulos im ON im.inscripcion_id = i.id
      JOIN modulos m ON m.id = im.modulo_id
      JOIN estudiantes es ON es.user_id = i.estudiante_id AND es.gestor_id = ${gid}
      WHERE i.convocatoria_id = ${conv.id}
      GROUP BY m.id, m.numero, m.nombre ORDER BY m.numero`).then(r =>
      r.rows.map(x => ({ moduloId: x.modulo_id, numero: x.numero, nombre: x.nombre, alumnos: Number(x.alumnos) })));
  }
  const todos = await db.select({ id: modulos.id, numero: modulos.numero, nombre: modulos.nombre }).from(modulos).orderBy(modulos.numero);
  res.json({ convocatoria: conv?.nombre ?? null, enCurso, todos });
});

// ── Módulos de clase (los que imparte el gestor) — organización estilo Canvas ──
// Devuelve cada módulo con sus contadores de contenido y # de alumnos que lo cursan.
async function modulosClaseDe(gid: number) {
  return db.execute<{ modulo_id: number; numero: number; nombre: string; tareas: string; materiales: string; videos: string; alumnos: string }>(sql`
    SELECT m.id AS modulo_id, m.numero, m.nombre,
      (SELECT COUNT(*) FROM aula_tareas t WHERE t.gestor_user_id = ${gid} AND t.modulo_id = m.id) AS tareas,
      (SELECT COUNT(*) FROM aula_materiales x WHERE x.gestor_user_id = ${gid} AND x.modulo_id = m.id AND x.tipo <> 'video') AS materiales,
      (SELECT COUNT(*) FROM aula_materiales x WHERE x.gestor_user_id = ${gid} AND x.modulo_id = m.id AND x.tipo = 'video') AS videos,
      (SELECT COUNT(DISTINCT i.estudiante_id) FROM inscripciones i
         JOIN convocatorias c ON c.id = i.convocatoria_id AND c.estado = 'abierta'
         JOIN inscripcion_modulos im ON im.inscripcion_id = i.id AND im.modulo_id = m.id
         JOIN estudiantes es ON es.user_id = i.estudiante_id AND es.gestor_id = ${gid}) AS alumnos
    FROM aula_modulos_clase amc JOIN modulos m ON m.id = amc.modulo_id
    WHERE amc.gestor_user_id = ${gid} ORDER BY m.numero`).then(r => r.rows.map(x => ({
      moduloId: x.modulo_id, numero: x.numero, nombre: x.nombre,
      tareas: Number(x.tareas), materiales: Number(x.materiales), videos: Number(x.videos), alumnos: Number(x.alumnos),
    })));
}

g.get('/modulos-clase', async (req, res) => {
  res.json({ modulos: await modulosClaseDe(req.user!.userId) });
});
const moduloClaseSchema = z.object({ moduloId: z.coerce.number().int().positive() });
g.post('/modulos-clase', async (req, res) => {
  const p = moduloClaseSchema.safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: 'Módulo inválido' }); return; }
  await db.insert(aulaModulosClase).values({ gestorUserId: req.user!.userId, moduloId: p.data.moduloId })
    .onConflictDoNothing();
  res.json({ modulos: await modulosClaseDe(req.user!.userId) });
});
g.delete('/modulos-clase/:moduloId', async (req, res) => {
  const moduloId = parseInt(String(req.params.moduloId), 10);
  await db.delete(aulaModulosClase).where(and(eq(aulaModulosClase.gestorUserId, req.user!.userId), eq(aulaModulosClase.moduloId, moduloId)));
  res.json({ modulos: await modulosClaseDe(req.user!.userId) });
});

// ── Contenido de UN módulo (gestor): tareas, materiales y videos de ese módulo ──
g.get('/modulo/:moduloId', async (req, res) => {
  const gid = req.user!.userId;
  const moduloId = parseInt(String(req.params.moduloId), 10);
  const [modulo] = await db.select({ id: modulos.id, numero: modulos.numero, nombre: modulos.nombre }).from(modulos).where(eq(modulos.id, moduloId));
  if (!modulo) { res.status(404).json({ error: 'Módulo no encontrado' }); return; }
  const [al] = await db.execute<{ n: string }>(sql`SELECT COUNT(*) n FROM estudiantes WHERE gestor_id = ${gid}`).then(r => r.rows);
  const tareas = await db.execute<{ id: number; titulo: string; instrucciones: string | null; fecha_entrega: string | null; abre_en: string | null; cierra_en: string | null; archivo_nombre: string | null; created_at: string; entregas: string }>(sql`
    SELECT t.id, t.titulo, t.instrucciones, t.fecha_entrega::text, t.abre_en::text, t.cierra_en::text, t.archivo_nombre, t.created_at::text,
           (SELECT COUNT(*) FROM aula_entregas e WHERE e.tarea_id = t.id) AS entregas
    FROM aula_tareas t WHERE t.gestor_user_id = ${gid} AND t.modulo_id = ${moduloId} ORDER BY t.created_at DESC`).then(r => r.rows);
  const mats = await db.select().from(aulaMateriales).where(and(eq(aulaMateriales.gestorUserId, gid), eq(aulaMateriales.moduloId, moduloId))).orderBy(desc(aulaMateriales.createdAt));
  res.json({
    modulo, totalAlumnos: Number(al.n),
    tareas: tareas.map(t => ({ id: t.id, titulo: t.titulo, instrucciones: t.instrucciones, fechaEntrega: t.fecha_entrega, abreEn: t.abre_en, cierraEn: t.cierra_en, archivoNombre: t.archivo_nombre, createdAt: t.created_at, entregas: Number(t.entregas) })),
    materiales: mats.filter(m => m.tipo !== 'video').map(m => ({ ...m, archivoRef: undefined })),
    videos: mats.filter(m => m.tipo === 'video').map(m => ({ ...m, archivoRef: undefined })),
  });
});

// ── Tareas ──
g.get('/tareas', async (req, res) => {
  const gid = req.user!.userId;
  // Filtro opcional por módulo de clase (mini-portal dentro del módulo).
  const moduloId = req.query.moduloId ? parseInt(String(req.query.moduloId), 10) : null;
  const moduloSnippet = moduloId != null ? sql`AND t.modulo_id = ${moduloId}` : sql``;
  const rows = await db.execute<{ id: number; titulo: string; instrucciones: string | null; fecha_entrega: string | null; abre_en: string | null; cierra_en: string | null; archivo_nombre: string | null; modulo_id: number | null; modulo_numero: number | null; modulo_nombre: string | null; publicada: boolean; created_at: string; entregas: string }>(sql`
    SELECT t.id, t.titulo, t.instrucciones, t.fecha_entrega::text, t.abre_en::text, t.cierra_en::text,
           t.archivo_nombre, t.modulo_id, m.numero AS modulo_numero, m.nombre AS modulo_nombre, t.publicada, t.created_at::text,
           (SELECT COUNT(*) FROM aula_entregas e WHERE e.tarea_id = t.id) AS entregas
    FROM aula_tareas t LEFT JOIN modulos m ON m.id = t.modulo_id
    WHERE t.gestor_user_id = ${gid} ${moduloSnippet} ORDER BY t.created_at DESC`).then(r => r.rows);
  const [al] = await db.execute<{ n: string }>(sql`SELECT COUNT(*) n FROM estudiantes WHERE gestor_id = ${gid}`).then(r => r.rows);
  res.json({
    tareas: rows.map(r => ({
      id: r.id, titulo: r.titulo, instrucciones: r.instrucciones, fechaEntrega: r.fecha_entrega,
      abreEn: r.abre_en, cierraEn: r.cierra_en, archivoNombre: r.archivo_nombre,
      moduloId: r.modulo_id, moduloNumero: r.modulo_numero, moduloNombre: r.modulo_nombre,
      publicada: r.publicada, createdAt: r.created_at, entregas: Number(r.entregas),
    })),
    totalAlumnos: Number(al.n),
  });
});

// Editar una tarea existente (mismos campos que al crear; el documento se
// puede conservar, reemplazar o quitar con quitarDocumento='true').
g.patch('/tareas/:id', conArchivo('documento'), async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  const [existente] = await db.select().from(aulaTareas)
    .where(and(eq(aulaTareas.id, id), eq(aulaTareas.gestorUserId, req.user!.userId)));
  if (!existente) { res.status(404).json({ error: 'Tarea no encontrada' }); return; }
  const p = tareaSchema.safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: p.error.issues[0]?.message ?? 'Datos inválidos' }); return; }
  const d = p.data;
  const fecha = (s?: string) => (s && s !== '' ? new Date(s) : null);
  const abre = fecha(d.abreEn), cierra = fecha(d.cierraEn), fe = fecha(d.fechaEntrega);
  if (abre && cierra && cierra <= abre) { res.status(400).json({ error: 'El cierre debe ser después de la apertura.' }); return; }
  const set: Partial<typeof aulaTareas.$inferInsert> = {
    titulo: d.titulo, instrucciones: d.instrucciones,
    moduloId: d.moduloId ? Number(d.moduloId) : null,
    abreEn: abre, cierraEn: cierra, fechaEntrega: fe, updatedAt: new Date(),
  };
  if (req.file) {
    set.archivoRef = await guardarSubida(req.file, 'aula');
    set.archivoNombre = req.file.originalname;
    set.archivoTipo = req.file.mimetype;
  } else if ((req.body as { quitarDocumento?: string }).quitarDocumento === 'true') {
    set.archivoRef = null; set.archivoNombre = null; set.archivoTipo = null;
  }
  await db.update(aulaTareas).set(set).where(eq(aulaTareas.id, id));
  res.json({ ok: true });
});

// Ojito: ocultar/mostrar una tarea a los alumnos (precargar y destapar después).
g.patch('/tareas/:id/publicar', async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  const [t] = await db.select({ publicada: aulaTareas.publicada }).from(aulaTareas)
    .where(and(eq(aulaTareas.id, id), eq(aulaTareas.gestorUserId, req.user!.userId)));
  if (!t) { res.status(404).json({ error: 'Tarea no encontrada' }); return; }
  await db.update(aulaTareas).set({ publicada: !t.publicada, updatedAt: new Date() })
    .where(eq(aulaTareas.id, id));
  res.json({ ok: true, publicada: !t.publicada });
});

const fechaODia = z.string().trim().refine(s => s === '' || !Number.isNaN(new Date(s).getTime()), 'Fecha inválida');
const tareaSchema = z.object({
  titulo: z.string().trim().min(1).max(200),
  instrucciones: z.string().trim().min(1, 'Las instrucciones son obligatorias').max(5000),
  moduloId: z.string().trim().regex(/^\d*$/, 'Módulo inválido').optional(),
  fechaEntrega: fechaODia.optional(),
  abreEn: fechaODia.optional(),
  cierraEn: fechaODia.optional(),
});
g.post('/tareas', conArchivo('documento'), async (req, res) => {
  const p = tareaSchema.safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: p.error.issues[0]?.message ?? 'Datos inválidos' }); return; }
  const d = p.data;
  const fecha = (s?: string) => (s && s !== '' ? new Date(s) : null);
  const abre = fecha(d.abreEn), cierra = fecha(d.cierraEn), fe = fecha(d.fechaEntrega);
  if (abre && cierra && cierra <= abre) { res.status(400).json({ error: 'El cierre debe ser después de la apertura.' }); return; }
  const archivoRef = req.file ? await guardarSubida(req.file, 'aula') : null;
  const [t] = await db.insert(aulaTareas).values({
    gestorUserId: req.user!.userId, titulo: d.titulo, instrucciones: d.instrucciones,
    moduloId: d.moduloId ? Number(d.moduloId) : null,
    abreEn: abre, cierraEn: cierra, fechaEntrega: fe,
    archivoRef, archivoNombre: req.file?.originalname ?? null, archivoTipo: req.file?.mimetype ?? null,
  }).returning();
  res.json({ tarea: { ...t, archivoRef: undefined } });
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
  const entregas = await db.execute<{ id: number; alumno: string; estado: string; comentario: string | null; archivo_nombre: string | null; entregada_en: string }>(sql`
    SELECT e.id, es.nombre_completo AS alumno, e.estado, e.comentario, e.archivo_nombre, e.entregada_en::text
    FROM aula_entregas e JOIN estudiantes es ON es.user_id = e.estudiante_id
    WHERE e.tarea_id = ${id} ORDER BY e.entregada_en DESC`).then(r => r.rows);
  res.json({ entregas: entregas.map(e => ({ id: e.id, alumno: e.alumno, estado: e.estado, comentario: e.comentario, archivoNombre: e.archivo_nombre, entregada_en: e.entregada_en })) });
});
// Descarga del archivo de una entrega (solo el gestor dueño de la tarea)
g.get('/entregas/:id/archivo', async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  const [e] = await db.execute<{ archivo_ref: string | null; archivo_nombre: string | null; archivo_tipo: string | null }>(sql`
    SELECT e.archivo_ref, e.archivo_nombre, e.archivo_tipo
    FROM aula_entregas e JOIN aula_tareas t ON t.id = e.tarea_id
    WHERE e.id = ${id} AND t.gestor_user_id = ${req.user!.userId}`).then(r => r.rows);
  if (!e) { res.status(404).json({ error: 'Entrega no encontrada' }); return; }
  await servirArchivo(res, e.archivo_ref, e.archivo_nombre, e.archivo_tipo);
});

// ── Materiales ──
g.get('/materiales', async (req, res) => {
  const rows = await db.select().from(aulaMateriales).where(eq(aulaMateriales.gestorUserId, req.user!.userId)).orderBy(desc(aulaMateriales.createdAt));
  res.json({ materiales: rows.map(m => ({ ...m, archivoRef: undefined })) });
});
const materialSchema = z.object({
  titulo: z.string().trim().min(1).max(200),
  descripcion: z.string().trim().max(2000).optional().or(z.literal('')),
  tipo: z.enum(['enlace', 'texto', 'video', 'archivo']),
  url: z.string().trim().max(1000).optional().or(z.literal('')),
  contenido: z.string().trim().max(10000).optional().or(z.literal('')),
  moduloId: z.string().trim().regex(/^\d*$/, 'Módulo inválido').optional(),
});
g.post('/materiales', conArchivo('archivo'), async (req, res) => {
  const p = materialSchema.safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: 'Datos inválidos' }); return; }
  let archivoRef: string | null = null;
  if (p.data.tipo === 'archivo') {
    if (!req.file) { res.status(400).json({ error: 'Adjunta el archivo del material.' }); return; }
    archivoRef = await guardarSubida(req.file, 'aula');
  }
  const [m] = await db.insert(aulaMateriales).values({
    gestorUserId: req.user!.userId, moduloId: p.data.moduloId ? Number(p.data.moduloId) : null,
    titulo: p.data.titulo, descripcion: p.data.descripcion || null,
    tipo: p.data.tipo, url: p.data.url || null, contenido: p.data.contenido || null,
    archivoRef, archivoNombre: req.file?.originalname ?? null, archivoTipo: req.file?.mimetype ?? null,
  }).returning();
  res.json({ material: { ...m, archivoRef: undefined } });
});
g.delete('/materiales/:id', async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  await db.delete(aulaMateriales).where(and(eq(aulaMateriales.id, id), eq(aulaMateriales.gestorUserId, req.user!.userId)));
  res.json({ ok: true });
});

// NOTA: los "Anuncios" dejaron de ser sección propia (2026-07-13). Ahora los
// anuncios viven en el FORO como mensajes destacados del gestor (+ encuestas).
// La tabla aula_anuncios se conserva en BD por histórico, sin rutas.

router.use('/gestor', g);

// ═══════════════ ARCHIVOS COMPARTIDOS DEL AULA (gestor + sus alumnos) ═══════════════
// Archivo de un material (?inline=1 → vista previa en el navegador)
router.get('/materiales/:id/archivo', async (req, res) => {
  const gid = await aulaDelUsuario(req.user!.userId, req.user!.rol);
  if (gid == null) { res.status(403).json({ error: 'Sin aula.' }); return; }
  const id = parseInt(String(req.params.id), 10);
  const [m] = await db.select().from(aulaMateriales).where(and(eq(aulaMateriales.id, id), eq(aulaMateriales.gestorUserId, gid)));
  if (!m) { res.status(404).json({ error: 'Material no encontrado' }); return; }
  await servirArchivo(res, m.archivoRef, m.archivoNombre, m.archivoTipo, req.query.inline === '1');
});
// Documento de apoyo de una tarea (?inline=1 → vista previa en el navegador)
router.get('/tareas/:id/documento', async (req, res) => {
  const gid = await aulaDelUsuario(req.user!.userId, req.user!.rol);
  if (gid == null) { res.status(403).json({ error: 'Sin aula.' }); return; }
  const id = parseInt(String(req.params.id), 10);
  const [t] = await db.select().from(aulaTareas).where(and(eq(aulaTareas.id, id), eq(aulaTareas.gestorUserId, gid)));
  if (!t) { res.status(404).json({ error: 'Tarea no encontrada' }); return; }
  await servirArchivo(res, t.archivoRef, t.archivoNombre, t.archivoTipo, req.query.inline === '1');
});
// Adjunto de un mensaje del foro
router.get('/foro/:id/adjunto', async (req, res) => {
  const gid = await aulaDelUsuario(req.user!.userId, req.user!.rol);
  if (gid == null) { res.status(403).json({ error: 'Sin aula.' }); return; }
  const id = parseInt(String(req.params.id), 10);
  const [f] = await db.select().from(aulaForo).where(and(eq(aulaForo.id, id), eq(aulaForo.gestorUserId, gid)));
  if (!f) { res.status(404).json({ error: 'Mensaje no encontrado' }); return; }
  await servirArchivo(res, f.adjuntoRef, f.adjuntoNombre, f.adjuntoTipo);
});

// ═══════════════════════════ ALUMNO ═══════════════════════════
// Contenido de UN módulo de clase para el alumno (mini-portal del módulo):
// tareas con SU estado de entrega + materiales + videos, scoped al módulo.
router.get('/modulo/:moduloId', requireRol('estudiante'), async (req, res) => {
  const uid = req.user!.userId;
  const gid = await aulaDelUsuario(uid, 'estudiante');
  if (gid == null) { res.status(403).json({ error: 'Sin aula.' }); return; }
  const moduloId = parseInt(String(req.params.moduloId), 10);
  const [modulo] = await db.select({ id: modulos.id, numero: modulos.numero, nombre: modulos.nombre }).from(modulos).where(eq(modulos.id, moduloId));
  if (!modulo) { res.status(404).json({ error: 'Módulo no encontrado' }); return; }

  const tareas = await db.execute<{ id: number; titulo: string; instrucciones: string | null; fecha_entrega: string | null; abre_en: string | null; cierra_en: string | null; archivo_nombre: string | null; created_at: string; mi_estado: string | null; mi_comentario: string | null; mi_archivo: string | null }>(sql`
    SELECT t.id, t.titulo, t.instrucciones, t.fecha_entrega::text, t.abre_en::text, t.cierra_en::text,
           t.archivo_nombre, t.created_at::text,
           e.estado AS mi_estado, e.comentario AS mi_comentario, e.archivo_nombre AS mi_archivo
    FROM aula_tareas t
    LEFT JOIN aula_entregas e ON e.tarea_id = t.id AND e.estudiante_id = ${uid}
    WHERE t.gestor_user_id = ${gid} AND t.modulo_id = ${moduloId} AND t.publicada = true
    ORDER BY t.created_at DESC`).then(r => r.rows);
  const mats = await db.execute<{ id: number; modulo_id: number | null; tipo: string; titulo: string; descripcion: string | null; url: string | null; contenido: string | null; archivo_nombre: string | null }>(sql`
    SELECT id, modulo_id, tipo, titulo, descripcion, url, contenido, archivo_nombre
    FROM aula_materiales WHERE gestor_user_id = ${gid} AND modulo_id = ${moduloId}
    ORDER BY created_at DESC`).then(r => r.rows);

  const mapMat = (m: typeof mats[number]) => ({ id: m.id, moduloId: m.modulo_id, tipo: m.tipo, titulo: m.titulo, descripcion: m.descripcion, url: m.url, contenido: m.contenido, archivoNombre: m.archivo_nombre });
  res.json({
    modulo,
    tareas: tareas.map(t => ({
      id: t.id, titulo: t.titulo, instrucciones: t.instrucciones, fechaEntrega: t.fecha_entrega,
      abreEn: t.abre_en, cierraEn: t.cierra_en, archivoNombre: t.archivo_nombre,
      moduloId, moduloNumero: modulo.numero, moduloNombre: modulo.nombre,
      createdAt: t.created_at, miEstado: t.mi_estado, miComentario: t.mi_comentario, miArchivo: t.mi_archivo,
    })),
    materiales: mats.filter(m => m.tipo !== 'video').map(mapMat),
    videos: mats.filter(m => m.tipo === 'video').map(mapMat),
  });
});

router.get('/mi-aula', requireRol('estudiante'), async (req, res) => {
  const uid = req.user!.userId;
  const [e] = await db.select({ gestorId: estudiantes.gestorId }).from(estudiantes).where(eq(estudiantes.userId, uid));
  if (!e?.gestorId || !(await aulaHabilitadaGestor(e.gestorId))) { res.json({ habilitada: false }); return; }
  const gid = e.gestorId;
  const [gInfo] = await db.execute<{ nombre: string; centro: string | null; clave: string | null; municipio: string | null }>(sql`
    SELECT g.nombre_completo AS nombre, g.centro_asesoria AS centro, g.clave_centro AS clave, m.nombre AS municipio
    FROM gestores g LEFT JOIN municipios m ON m.id = g.municipio_id
    WHERE g.user_id = ${gid}`).then(r => r.rows);

  const tareas = await db.execute<{ id: number; titulo: string; instrucciones: string | null; fecha_entrega: string | null; abre_en: string | null; cierra_en: string | null; archivo_nombre: string | null; modulo_id: number | null; modulo_numero: number | null; modulo_nombre: string | null; created_at: string; mi_estado: string | null; mi_comentario: string | null; mi_archivo: string | null }>(sql`
    SELECT t.id, t.titulo, t.instrucciones, t.fecha_entrega::text, t.abre_en::text, t.cierra_en::text,
           t.archivo_nombre, t.modulo_id, m.numero AS modulo_numero, m.nombre AS modulo_nombre, t.created_at::text,
           e.estado AS mi_estado, e.comentario AS mi_comentario, e.archivo_nombre AS mi_archivo
    FROM aula_tareas t
    LEFT JOIN modulos m ON m.id = t.modulo_id
    LEFT JOIN aula_entregas e ON e.tarea_id = t.id AND e.estudiante_id = ${uid}
    WHERE t.gestor_user_id = ${gid} AND t.publicada = true
    ORDER BY t.created_at DESC`).then(r => r.rows);
  // Módulos que cursa ESTE alumno en la convocatoria abierta (contexto del aula)
  const misModulos = await db.execute<{ numero: number; nombre: string }>(sql`
    SELECT m.numero, m.nombre
    FROM inscripciones i
    JOIN convocatorias c ON c.id = i.convocatoria_id AND c.estado = 'abierta'
    JOIN inscripcion_modulos im ON im.inscripcion_id = i.id
    JOIN modulos m ON m.id = im.modulo_id
    WHERE i.estudiante_id = ${uid} ORDER BY m.numero`).then(r => r.rows);
  const materialesRaw = await db.execute<{ id: number; modulo_id: number | null; tipo: string; titulo: string; descripcion: string | null; url: string | null; contenido: string | null; archivo_nombre: string | null; created_at: string }>(sql`
    SELECT id, modulo_id, tipo, titulo, descripcion, url, contenido, archivo_nombre, created_at::text
    FROM aula_materiales WHERE gestor_user_id = ${gid} ORDER BY created_at DESC`).then(r => r.rows);
  const materiales = materialesRaw.map(m => ({ id: m.id, moduloId: m.modulo_id, tipo: m.tipo, titulo: m.titulo, descripcion: m.descripcion, url: m.url, contenido: m.contenido, archivoNombre: m.archivo_nombre, createdAt: m.created_at }));

  // Módulos de clase del gestor con contadores para el alumno (Canvas grid).
  const modulosClase = await db.execute<{ modulo_id: number; numero: number; nombre: string; tareas: string; pendientes: string; materiales: string; videos: string }>(sql`
    SELECT m.id AS modulo_id, m.numero, m.nombre,
      (SELECT COUNT(*) FROM aula_tareas t WHERE t.gestor_user_id = ${gid} AND t.modulo_id = m.id AND t.publicada = true) AS tareas,
      (SELECT COUNT(*) FROM aula_tareas t WHERE t.gestor_user_id = ${gid} AND t.modulo_id = m.id AND t.publicada = true
         AND NOT EXISTS (SELECT 1 FROM aula_entregas e WHERE e.tarea_id = t.id AND e.estudiante_id = ${uid})) AS pendientes,
      (SELECT COUNT(*) FROM aula_materiales x WHERE x.gestor_user_id = ${gid} AND x.modulo_id = m.id AND x.tipo <> 'video') AS materiales,
      (SELECT COUNT(*) FROM aula_materiales x WHERE x.gestor_user_id = ${gid} AND x.modulo_id = m.id AND x.tipo = 'video') AS videos
    FROM aula_modulos_clase amc JOIN modulos m ON m.id = amc.modulo_id
    WHERE amc.gestor_user_id = ${gid} ORDER BY m.numero`).then(r => r.rows.map(x => ({
      moduloId: x.modulo_id, numero: x.numero, nombre: x.nombre,
      tareas: Number(x.tareas), pendientes: Number(x.pendientes), materiales: Number(x.materiales), videos: Number(x.videos),
    })));

  res.json({
    habilitada: true,
    gestor: { nombre: gInfo?.nombre ?? '', centro: gInfo?.centro ?? null, clave: gInfo?.clave ?? null, municipio: gInfo?.municipio ?? null },
    tareas: tareas.map(t => ({
      id: t.id, titulo: t.titulo, instrucciones: t.instrucciones, fechaEntrega: t.fecha_entrega,
      abreEn: t.abre_en, cierraEn: t.cierra_en, archivoNombre: t.archivo_nombre,
      moduloId: t.modulo_id, moduloNumero: t.modulo_numero, moduloNombre: t.modulo_nombre,
      createdAt: t.created_at, miEstado: t.mi_estado, miComentario: t.mi_comentario, miArchivo: t.mi_archivo,
    })),
    misModulos, modulosClase, materiales,
  });
});

const entregaSchema = z.object({ comentario: z.string().trim().max(3000).optional().or(z.literal('')) });
router.post('/tareas/:id/entregar', requireRol('estudiante'), conArchivo('archivo'), async (req, res) => {
  const uid = req.user!.userId;
  const id = parseInt(String(req.params.id), 10);
  const p = entregaSchema.safeParse(req.body ?? {});
  const comentario = p.success ? (p.data.comentario || null) : null;
  // valida que la tarea sea del aula de su gestor y esté publicada
  const [e] = await db.select({ gestorId: estudiantes.gestorId }).from(estudiantes).where(eq(estudiantes.userId, uid));
  const [t] = await db.select().from(aulaTareas).where(eq(aulaTareas.id, id));
  if (!t || !e?.gestorId || t.gestorUserId !== e.gestorId) { res.status(404).json({ error: 'Tarea no encontrada' }); return; }
  // Ventana de disponibilidad: se respeta también en el servidor.
  const ahora = new Date();
  if (t.abreEn && t.abreEn > ahora) { res.status(400).json({ error: 'Esta tarea aún no abre.' }); return; }
  if (t.cierraEn && t.cierraEn < ahora) { res.status(400).json({ error: 'Esta tarea ya cerró; ya no acepta entregas.' }); return; }
  const archivoRef = req.file ? await guardarSubida(req.file, 'aula') : null;
  const nuevo = {
    comentario, estado: 'entregada', entregadaEn: new Date(),
    ...(archivoRef ? { archivoRef, archivoNombre: req.file!.originalname, archivoTipo: req.file!.mimetype } : {}),
  };
  await db.insert(aulaEntregas).values({ tareaId: id, estudianteId: uid, ...nuevo })
    .onConflictDoUpdate({ target: [aulaEntregas.tareaId, aulaEntregas.estudianteId], set: nuevo });
  res.json({ ok: true });
});

// ═══════════════════════════ FORO (canal central del aula) ═══════════════════════════
// El foro concentra mensajes, anuncios destacados del gestor y encuestas.
async function foroBloqueado(gid: number): Promise<boolean> {
  const [g] = await db.select({ b: gestores.foroSoloGestor }).from(gestores).where(eq(gestores.userId, gid));
  return !!g?.b;
}

router.get('/foro', async (req, res) => {
  const uid = req.user!.userId;
  const gid = await aulaDelUsuario(uid, req.user!.rol);
  if (gid == null) { res.status(403).json({ error: 'Sin aula.' }); return; }
  // Foro por módulo de clase (mini-portal dentro de cada módulo).
  const moduloId = req.query.moduloId ? parseInt(String(req.query.moduloId), 10) : null;
  const moduloSnippet = moduloId != null ? sql`AND f.modulo_id = ${moduloId}` : sql`AND f.modulo_id IS NULL`;
  const mensajes = await db.execute<{ id: number; autor_user_id: number; autor: string; autor_rol: string; tipo: string; destacado: boolean; opciones: string[] | null; cuerpo: string; adjunto_nombre: string | null; adjunto_tipo: string | null; created_at: string }>(sql`
    SELECT f.id, f.autor_user_id, f.autor_rol, f.tipo, f.destacado, f.opciones, f.cuerpo,
           f.adjunto_nombre, f.adjunto_tipo, f.created_at::text,
           COALESCE(g.nombre_completo, es.nombre_completo, 'Usuario') AS autor
    FROM aula_foro f
    LEFT JOIN gestores g ON g.user_id = f.autor_user_id
    LEFT JOIN estudiantes es ON es.user_id = f.autor_user_id
    WHERE f.gestor_user_id = ${gid} ${moduloSnippet}
    ORDER BY f.created_at ASC`).then(r => r.rows);
  // Votos de las encuestas del aula: conteo por opción + cuál es mi voto.
  const votos = await db.execute<{ mensaje_id: number; opcion: number; n: string; mio: boolean }>(sql`
    SELECT v.mensaje_id, v.opcion, COUNT(*) AS n, BOOL_OR(v.user_id = ${uid}) AS mio
    FROM aula_foro_votos v
    JOIN aula_foro f ON f.id = v.mensaje_id AND f.gestor_user_id = ${gid}
    GROUP BY v.mensaje_id, v.opcion`).then(r => r.rows);
  const votosPorMsg = new Map<number, { opcion: number; n: number; mio: boolean }[]>();
  for (const v of votos) {
    const arr = votosPorMsg.get(v.mensaje_id) ?? [];
    arr.push({ opcion: v.opcion, n: Number(v.n), mio: v.mio });
    votosPorMsg.set(v.mensaje_id, arr);
  }
  // Datos del centro (para el encabezado del foro) + tareas del módulo (para
  // los hipervínculos "#tarea" que se pueden insertar en los mensajes).
  const [centro] = await db.execute<{ centro: string | null; clave: string | null; municipio: string | null }>(sql`
    SELECT g.centro_asesoria AS centro, g.clave_centro AS clave, m.nombre AS municipio
    FROM gestores g LEFT JOIN municipios m ON m.id = g.municipio_id WHERE g.user_id = ${gid}`).then(r => r.rows);
  const tareasSnippet = moduloId != null ? sql`AND modulo_id = ${moduloId}` : sql``;
  const tareas = await db.execute<{ id: number; titulo: string }>(sql`
    SELECT id, titulo FROM aula_tareas WHERE gestor_user_id = ${gid} AND publicada = true ${tareasSnippet} ORDER BY created_at DESC`).then(r => r.rows);
  res.json({
    yo: uid,
    soyGestor: req.user!.rol === 'gestor',
    bloqueado: await foroBloqueado(gid),
    centro: { nombre: centro?.centro ?? null, clave: centro?.clave ?? null, municipio: centro?.municipio ?? null },
    tareas,
    mensajes: mensajes.map(m => ({
      id: m.id, autorId: m.autor_user_id, autor: m.autor, esGestor: m.autor_rol === 'gestor',
      tipo: m.tipo, destacado: m.destacado, opciones: m.opciones,
      votos: votosPorMsg.get(m.id) ?? [],
      cuerpo: m.cuerpo, adjuntoNombre: m.adjunto_nombre, adjuntoTipo: m.adjunto_tipo, createdAt: m.created_at,
    })),
  });
});

const foroSchema = z.object({
  cuerpo: z.string().trim().max(3000).optional().or(z.literal('')),
  destacado: z.enum(['true', 'false']).optional(),
  opciones: z.string().max(2000).optional(), // JSON: array de opciones (encuesta)
  moduloId: z.string().trim().regex(/^\d*$/, 'Módulo inválido').optional(),
});
router.post('/foro', conArchivo('adjunto'), async (req, res) => {
  const { userId, rol } = req.user!;
  const gid = await aulaDelUsuario(userId, rol);
  if (gid == null) { res.status(403).json({ error: 'Sin aula.' }); return; }
  if (rol !== 'gestor' && (await foroBloqueado(gid))) {
    res.status(403).json({ error: 'El gestor activó el modo "solo anuncios": por ahora solo él puede escribir.' });
    return;
  }
  const p = foroSchema.safeParse(req.body ?? {});
  if (!p.success) { res.status(400).json({ error: 'Datos inválidos' }); return; }
  const cuerpo = (p.data.cuerpo ?? '').trim();

  // Encuesta (solo el gestor): cuerpo = pregunta, opciones = 2 a 6 textos.
  let opciones: string[] | null = null;
  if (p.data.opciones) {
    if (rol !== 'gestor') { res.status(403).json({ error: 'Solo el gestor puede crear encuestas.' }); return; }
    try {
      const arr: unknown = JSON.parse(p.data.opciones);
      if (!Array.isArray(arr)) throw new Error();
      opciones = arr.map(o => String(o).trim().slice(0, 120)).filter(Boolean);
    } catch { res.status(400).json({ error: 'Opciones de encuesta inválidas' }); return; }
    if (opciones.length < 2 || opciones.length > 6) { res.status(400).json({ error: 'La encuesta necesita de 2 a 6 opciones.' }); return; }
    if (!cuerpo) { res.status(400).json({ error: 'Escribe la pregunta de la encuesta.' }); return; }
  }
  if (!cuerpo && !req.file) { res.status(400).json({ error: 'Escribe un mensaje o adjunta un archivo' }); return; }

  const adjuntoRef = req.file ? await guardarSubida(req.file, 'aula') : null;
  const [m] = await db.insert(aulaForo).values({
    gestorUserId: gid, moduloId: p.data.moduloId ? Number(p.data.moduloId) : null,
    autorUserId: userId, autorRol: rol, cuerpo,
    tipo: opciones ? 'encuesta' : 'mensaje',
    destacado: rol === 'gestor' && p.data.destacado === 'true',
    opciones,
    adjuntoRef, adjuntoNombre: req.file?.originalname ?? null, adjuntoTipo: req.file?.mimetype ?? null,
  }).returning();
  res.json({ mensaje: { ...m, adjuntoRef: undefined } });
});

// Votar en una encuesta (una opción por usuario; puede cambiarla, estilo WhatsApp)
const votoSchema = z.object({ opcion: z.number().int().min(0) });
router.post('/foro/:id/votar', async (req, res) => {
  const { userId, rol } = req.user!;
  const gid = await aulaDelUsuario(userId, rol);
  if (gid == null) { res.status(403).json({ error: 'Sin aula.' }); return; }
  const id = parseInt(String(req.params.id), 10);
  const p = votoSchema.safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: 'Voto inválido' }); return; }
  const [f] = await db.select().from(aulaForo).where(and(eq(aulaForo.id, id), eq(aulaForo.gestorUserId, gid)));
  if (!f || f.tipo !== 'encuesta' || !f.opciones) { res.status(404).json({ error: 'Encuesta no encontrada' }); return; }
  if (p.data.opcion >= f.opciones.length) { res.status(400).json({ error: 'Opción fuera de rango' }); return; }
  await db.insert(aulaForoVotos).values({ mensajeId: id, userId, opcion: p.data.opcion })
    .onConflictDoUpdate({ target: [aulaForoVotos.mensajeId, aulaForoVotos.userId], set: { opcion: p.data.opcion, createdAt: new Date() } });
  res.json({ ok: true });
});

// Borrar mensaje: el gestor modera todo su foro; cada quien puede borrar lo suyo.
router.delete('/foro/:id', async (req, res) => {
  const { userId, rol } = req.user!;
  const gid = await aulaDelUsuario(userId, rol);
  if (gid == null) { res.status(403).json({ error: 'Sin aula.' }); return; }
  const id = parseInt(String(req.params.id), 10);
  const [f] = await db.select().from(aulaForo).where(and(eq(aulaForo.id, id), eq(aulaForo.gestorUserId, gid)));
  if (!f) { res.status(404).json({ error: 'Mensaje no encontrado' }); return; }
  if (rol !== 'gestor' && f.autorUserId !== userId) { res.status(403).json({ error: 'Solo puedes borrar tus mensajes.' }); return; }
  await db.delete(aulaForo).where(eq(aulaForo.id, id));
  res.json({ ok: true });
});

export default router;
