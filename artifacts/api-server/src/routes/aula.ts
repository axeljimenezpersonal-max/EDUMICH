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
import { gestores, estudiantes, aulaTareas, aulaEntregas, aulaMateriales, aulaAnuncios, aulaForo, modulos } from '@workspace/db/schema';
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
const SOLO_IMAGEN = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

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
const uploadImagen = crearUpload(SOLO_IMAGEN);

// Envuelve multer para responder 400 con mensaje claro en vez de 500.
function conArchivo(campo: string, up: multer.Multer = uploadAula) {
  return (req: Request, res: Response, next: NextFunction) => {
    up.single(campo)(req, res, (err: unknown) => {
      if (err) { res.status(400).json({ error: err instanceof Error ? err.message : 'Archivo inválido' }); return; }
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
  const [[t], [m], [a], [al]] = await Promise.all([
    db.execute<{ n: string }>(sql`SELECT COUNT(*) n FROM aula_tareas WHERE gestor_user_id = ${gid}`).then(r => r.rows),
    db.execute<{ n: string }>(sql`SELECT COUNT(*) n FROM aula_materiales WHERE gestor_user_id = ${gid}`).then(r => r.rows),
    db.execute<{ n: string }>(sql`SELECT COUNT(*) n FROM aula_anuncios WHERE gestor_user_id = ${gid}`).then(r => r.rows),
    db.execute<{ n: string }>(sql`SELECT COUNT(*) n FROM estudiantes WHERE gestor_id = ${gid}`).then(r => r.rows),
  ]);
  res.json({ tareas: Number(t.n), materiales: Number(m.n), anuncios: Number(a.n), alumnos: Number(al.n) });
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

// ── Tareas ──
g.get('/tareas', async (req, res) => {
  const gid = req.user!.userId;
  const rows = await db.execute<{ id: number; titulo: string; instrucciones: string | null; fecha_entrega: string | null; abre_en: string | null; cierra_en: string | null; archivo_nombre: string | null; modulo_numero: number | null; modulo_nombre: string | null; created_at: string; entregas: string }>(sql`
    SELECT t.id, t.titulo, t.instrucciones, t.fecha_entrega::text, t.abre_en::text, t.cierra_en::text,
           t.archivo_nombre, m.numero AS modulo_numero, m.nombre AS modulo_nombre, t.created_at::text,
           (SELECT COUNT(*) FROM aula_entregas e WHERE e.tarea_id = t.id) AS entregas
    FROM aula_tareas t LEFT JOIN modulos m ON m.id = t.modulo_id
    WHERE t.gestor_user_id = ${gid} ORDER BY t.created_at DESC`).then(r => r.rows);
  const [al] = await db.execute<{ n: string }>(sql`SELECT COUNT(*) n FROM estudiantes WHERE gestor_id = ${gid}`).then(r => r.rows);
  res.json({
    tareas: rows.map(r => ({
      id: r.id, titulo: r.titulo, instrucciones: r.instrucciones, fechaEntrega: r.fecha_entrega,
      abreEn: r.abre_en, cierraEn: r.cierra_en, archivoNombre: r.archivo_nombre,
      moduloNumero: r.modulo_numero, moduloNombre: r.modulo_nombre,
      createdAt: r.created_at, entregas: Number(r.entregas),
    })),
    totalAlumnos: Number(al.n),
  });
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
    gestorUserId: req.user!.userId, titulo: p.data.titulo, descripcion: p.data.descripcion || null,
    tipo: p.data.tipo, url: p.data.url || null, contenido: p.data.contenido || null,
    archivoRef, archivoNombre: req.file?.originalname ?? null, archivoTipo: req.file?.mimetype ?? null,
  }).returning();
  res.json({ material: m });
});
g.delete('/materiales/:id', async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  await db.delete(aulaMateriales).where(and(eq(aulaMateriales.id, id), eq(aulaMateriales.gestorUserId, req.user!.userId)));
  res.json({ ok: true });
});

// ── Anuncios de aula (imagen + fijado + programación) ──
g.get('/anuncios', async (req, res) => {
  const rows = await db.select().from(aulaAnuncios).where(eq(aulaAnuncios.gestorUserId, req.user!.userId))
    .orderBy(desc(aulaAnuncios.fijado), desc(aulaAnuncios.createdAt));
  res.json({ anuncios: rows.map(a => ({ ...a, tieneImagen: !!a.imagenRef, imagenRef: undefined })) });
});
const anuncioSchema = z.object({
  titulo: z.string().trim().min(1).max(200),
  cuerpo: z.string().trim().min(1).max(5000),
  fijado: z.union([z.boolean(), z.enum(['true', 'false'])]).optional(),
  programadoPara: z.string().trim().optional().or(z.literal('')),
});
g.post('/anuncios', conArchivo('imagen', uploadImagen), async (req, res) => {
  const p = anuncioSchema.safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: 'Datos inválidos' }); return; }
  const prog = p.data.programadoPara ? new Date(p.data.programadoPara) : null;
  if (prog && Number.isNaN(prog.getTime())) { res.status(400).json({ error: 'Fecha de programación inválida' }); return; }
  const imagenRef = req.file ? await guardarSubida(req.file, 'aula') : null;
  const [a] = await db.insert(aulaAnuncios).values({
    gestorUserId: req.user!.userId, titulo: p.data.titulo, cuerpo: p.data.cuerpo,
    fijado: p.data.fijado === true || p.data.fijado === 'true',
    programadoPara: prog, imagenRef, imagenTipo: req.file?.mimetype ?? null,
  }).returning();
  res.json({ anuncio: { ...a, tieneImagen: !!a.imagenRef, imagenRef: undefined } });
});
g.patch('/anuncios/:id/fijar', async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  const [a] = await db.select().from(aulaAnuncios).where(and(eq(aulaAnuncios.id, id), eq(aulaAnuncios.gestorUserId, req.user!.userId)));
  if (!a) { res.status(404).json({ error: 'Anuncio no encontrado' }); return; }
  await db.update(aulaAnuncios).set({ fijado: !a.fijado }).where(eq(aulaAnuncios.id, id));
  res.json({ ok: true, fijado: !a.fijado });
});
g.delete('/anuncios/:id', async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  await db.delete(aulaAnuncios).where(and(eq(aulaAnuncios.id, id), eq(aulaAnuncios.gestorUserId, req.user!.userId)));
  res.json({ ok: true });
});

router.use('/gestor', g);

// ═══════════════ ARCHIVOS COMPARTIDOS DEL AULA (gestor + sus alumnos) ═══════════════
// Imagen de un anuncio
router.get('/anuncios/:id/imagen', async (req, res) => {
  const gid = await aulaDelUsuario(req.user!.userId, req.user!.rol);
  if (gid == null) { res.status(403).json({ error: 'Sin aula.' }); return; }
  const id = parseInt(String(req.params.id), 10);
  const [a] = await db.select().from(aulaAnuncios).where(and(eq(aulaAnuncios.id, id), eq(aulaAnuncios.gestorUserId, gid)));
  if (!a) { res.status(404).json({ error: 'Anuncio no encontrado' }); return; }
  await servirArchivo(res, a.imagenRef, 'imagen', a.imagenTipo, true);
});
// Archivo de un material
router.get('/materiales/:id/archivo', async (req, res) => {
  const gid = await aulaDelUsuario(req.user!.userId, req.user!.rol);
  if (gid == null) { res.status(403).json({ error: 'Sin aula.' }); return; }
  const id = parseInt(String(req.params.id), 10);
  const [m] = await db.select().from(aulaMateriales).where(and(eq(aulaMateriales.id, id), eq(aulaMateriales.gestorUserId, gid)));
  if (!m) { res.status(404).json({ error: 'Material no encontrado' }); return; }
  await servirArchivo(res, m.archivoRef, m.archivoNombre, m.archivoTipo);
});
// Documento de apoyo de una tarea
router.get('/tareas/:id/documento', async (req, res) => {
  const gid = await aulaDelUsuario(req.user!.userId, req.user!.rol);
  if (gid == null) { res.status(403).json({ error: 'Sin aula.' }); return; }
  const id = parseInt(String(req.params.id), 10);
  const [t] = await db.select().from(aulaTareas).where(and(eq(aulaTareas.id, id), eq(aulaTareas.gestorUserId, gid)));
  if (!t) { res.status(404).json({ error: 'Tarea no encontrada' }); return; }
  await servirArchivo(res, t.archivoRef, t.archivoNombre, t.archivoTipo);
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
router.get('/mi-aula', requireRol('estudiante'), async (req, res) => {
  const uid = req.user!.userId;
  const [e] = await db.select({ gestorId: estudiantes.gestorId }).from(estudiantes).where(eq(estudiantes.userId, uid));
  if (!e?.gestorId || !(await aulaHabilitadaGestor(e.gestorId))) { res.json({ habilitada: false }); return; }
  const gid = e.gestorId;
  const [gInfo] = await db.select({ nombre: gestores.nombreCompleto, centro: gestores.centroAsesoria }).from(gestores).where(eq(gestores.userId, gid));

  const tareas = await db.execute<{ id: number; titulo: string; instrucciones: string | null; fecha_entrega: string | null; abre_en: string | null; cierra_en: string | null; archivo_nombre: string | null; modulo_numero: number | null; modulo_nombre: string | null; created_at: string; mi_estado: string | null; mi_comentario: string | null; mi_archivo: string | null }>(sql`
    SELECT t.id, t.titulo, t.instrucciones, t.fecha_entrega::text, t.abre_en::text, t.cierra_en::text,
           t.archivo_nombre, m.numero AS modulo_numero, m.nombre AS modulo_nombre, t.created_at::text,
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
  const materiales = await db.select().from(aulaMateriales).where(eq(aulaMateriales.gestorUserId, gid)).orderBy(desc(aulaMateriales.createdAt));
  // Solo anuncios ya publicados (los programados a futuro no se muestran); fijados primero.
  const anuncios = await db.execute<{ id: number; titulo: string; cuerpo: string; fijado: boolean; imagen_ref: string | null; created_at: string }>(sql`
    SELECT id, titulo, cuerpo, fijado, imagen_ref, COALESCE(programado_para, created_at)::text AS created_at
    FROM aula_anuncios
    WHERE gestor_user_id = ${gid} AND (programado_para IS NULL OR programado_para <= NOW())
    ORDER BY fijado DESC, COALESCE(programado_para, created_at) DESC`).then(r => r.rows);

  res.json({
    habilitada: true,
    gestor: { nombre: gInfo?.nombre ?? '', centro: gInfo?.centro ?? null },
    tareas: tareas.map(t => ({
      id: t.id, titulo: t.titulo, instrucciones: t.instrucciones, fechaEntrega: t.fecha_entrega,
      abreEn: t.abre_en, cierraEn: t.cierra_en, archivoNombre: t.archivo_nombre,
      moduloNumero: t.modulo_numero, moduloNombre: t.modulo_nombre,
      createdAt: t.created_at, miEstado: t.mi_estado, miComentario: t.mi_comentario, miArchivo: t.mi_archivo,
    })),
    misModulos,
    materiales: materiales.map(m => ({ ...m, archivoRef: undefined })),
    anuncios: anuncios.map(a => ({ id: a.id, titulo: a.titulo, cuerpo: a.cuerpo, fijado: a.fijado, tieneImagen: !!a.imagen_ref, createdAt: a.created_at })),
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

// ═══════════════════════════ FORO (gestor + alumnos del aula) ═══════════════════════════
router.get('/foro', async (req, res) => {
  const gid = await aulaDelUsuario(req.user!.userId, req.user!.rol);
  if (gid == null) { res.status(403).json({ error: 'Sin aula.' }); return; }
  const mensajes = await db.execute<{ id: number; autor_user_id: number; autor: string; autor_rol: string; cuerpo: string; adjunto_nombre: string | null; adjunto_tipo: string | null; created_at: string }>(sql`
    SELECT f.id, f.autor_user_id, f.autor_rol, f.cuerpo, f.adjunto_nombre, f.adjunto_tipo, f.created_at::text,
           COALESCE(g.nombre_completo, es.nombre_completo, 'Usuario') AS autor
    FROM aula_foro f
    LEFT JOIN gestores g ON g.user_id = f.autor_user_id
    LEFT JOIN estudiantes es ON es.user_id = f.autor_user_id
    WHERE f.gestor_user_id = ${gid}
    ORDER BY f.created_at ASC`).then(r => r.rows);
  res.json({
    yo: req.user!.userId,
    mensajes: mensajes.map(m => ({
      id: m.id, autorId: m.autor_user_id, autor: m.autor, esGestor: m.autor_rol === 'gestor',
      cuerpo: m.cuerpo, adjuntoNombre: m.adjunto_nombre, adjuntoTipo: m.adjunto_tipo, createdAt: m.created_at,
    })),
  });
});

const foroSchema = z.object({ cuerpo: z.string().trim().max(3000).optional().or(z.literal('')) });
router.post('/foro', conArchivo('adjunto'), async (req, res) => {
  const gid = await aulaDelUsuario(req.user!.userId, req.user!.rol);
  if (gid == null) { res.status(403).json({ error: 'Sin aula.' }); return; }
  const p = foroSchema.safeParse(req.body ?? {});
  const cuerpo = p.success ? (p.data.cuerpo ?? '').trim() : '';
  if (!cuerpo && !req.file) { res.status(400).json({ error: 'Escribe un mensaje o adjunta un archivo' }); return; }
  const adjuntoRef = req.file ? await guardarSubida(req.file, 'aula') : null;
  const [m] = await db.insert(aulaForo).values({
    gestorUserId: gid, autorUserId: req.user!.userId, autorRol: req.user!.rol, cuerpo,
    adjuntoRef, adjuntoNombre: req.file?.originalname ?? null, adjuntoTipo: req.file?.mimetype ?? null,
  }).returning();
  res.json({ mensaje: { ...m, adjuntoRef: undefined } });
});

export default router;
