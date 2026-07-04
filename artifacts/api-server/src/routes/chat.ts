/**
 * Chat con la Secretaría.
 *
 * Reglas de negocio:
 *  - Alumno y gestor tienen UNA conversación con la Secretaría y solo pueden
 *    escribir a la Secretaría (no entre ellos). Rol 'direccion' no participa.
 *  - La Secretaría (admin) puede escribir a cualquier alumno o gestor.
 *  - Todos los mensajes se conservan (temas legales / privacidad de datos).
 *  - Antes de abrir el chat, el frontend muestra un aviso legal; la aceptación
 *    se registra en chat_consentimientos.
 *
 * Dos routers:
 *  - `router` (default): endpoints del ciudadano (alumno/gestor), auth normal.
 *  - `adminChatRouter`: endpoints de la Secretaría, requiere rol admin.
 */

import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import multer from 'multer';
import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import {
  chatConversaciones,
  chatMensajes,
  chatConsentimientos,
  estudiantes,
  gestores,
  municipios,
  users,
} from '@workspace/db/schema';
import { authRequired, requireRol } from '../middleware/auth';
import { notificar, notificarATodosLosAdmins } from '../utils/notificar';

const cuerpoSchema = z.object({ cuerpo: z.string().trim().min(1, 'Escribe un mensaje').max(4000) });

// ── Adjuntos ──────────────────────────────────────────────────────────
const CHAT_DIR = process.env.STORAGE_DIR ? path.join(process.env.STORAGE_DIR, 'chat') : '/tmp/prepa-storage/chat';
const CHAT_MIMES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

const uploadChat = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      await fs.mkdir(CHAT_DIR, { recursive: true });
      cb(null, CHAT_DIR);
    },
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}_${Math.round(Math.random() * 1e6)}_${safe}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!CHAT_MIMES.includes(file.mimetype)) { cb(new Error('Formato no aceptado. Usa PDF, JPG, PNG o WEBP.')); return; }
    cb(null, true);
  },
});

// Envuelve multer para devolver un error legible en vez de tirar la conexión.
function subirAdjuntoMw(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) {
  uploadChat.single('archivo')(req, res, (err: unknown) => {
    if (err) {
      const msg = err instanceof Error
        ? (err.message.includes('File too large') ? 'El archivo supera 10 MB' : err.message)
        : 'No se pudo subir el archivo';
      res.status(400).json({ error: msg });
      return;
    }
    next();
  });
}

// Sirve un adjunto inline (preview) validando que exista.
function servirAdjunto(rutaArchivo: string | null, mime: string | null, nombre: string | null, res: import('express').Response) {
  if (!rutaArchivo || !existsSync(rutaArchivo)) { res.status(404).json({ error: 'Archivo no disponible' }); return; }
  const safe = (nombre ?? 'documento').replace(/[^a-zA-Z0-9_\-.]/g, '_');
  res.setHeader('Content-Type', mime ?? 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${safe}"`);
  createReadStream(rutaArchivo).pipe(res);
}

function rolParticipante(rol: string): 'estudiante' | 'gestor' | null {
  if (rol === 'estudiante') return 'estudiante';
  if (rol === 'gestor') return 'gestor';
  return null;
}

// Obtiene (o crea) la conversación única del participante.
async function obtenerOCrearConversacion(userId: number, rol: 'estudiante' | 'gestor') {
  const [existente] = await db
    .select()
    .from(chatConversaciones)
    .where(eq(chatConversaciones.participanteUserId, userId));
  if (existente) return existente;
  const [creada] = await db
    .insert(chatConversaciones)
    .values({ participanteUserId: userId, participanteRol: rol })
    .returning();
  return creada;
}

// Nombre para mostrar de un participante (según su rol).
async function nombreParticipante(userId: number, rol: string): Promise<string> {
  if (rol === 'gestor') {
    const [g] = await db.select({ n: gestores.nombreCompleto }).from(gestores).where(eq(gestores.userId, userId));
    if (g?.n) return g.n;
  } else {
    const [e] = await db.select({ n: estudiantes.nombreCompleto }).from(estudiantes).where(eq(estudiantes.userId, userId));
    if (e?.n) return e.n;
  }
  const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId));
  return u?.email ?? 'Usuario';
}

// ═══════════════════════════════════════════════════════════════════════
// CIUDADANO (alumno / gestor)
// ═══════════════════════════════════════════════════════════════════════
const router = Router();
router.use(authRequired);

// Registra la aceptación del aviso legal antes de abrir el chat.
router.post('/consentimiento', async (req, res) => {
  const { userId, rol } = req.user!;
  if (!rolParticipante(rol)) { res.status(403).json({ error: 'Este chat es para alumnos y gestores.' }); return; }
  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req.ip || null;
  await db.insert(chatConsentimientos).values({ userId, rol, ip: ip ?? undefined }).catch(() => {});
  res.json({ ok: true });
});

// Mi conversación con la Secretaría (la crea si no existe) + mensajes.
router.get('/mi-conversacion', async (req, res) => {
  const { userId, rol } = req.user!;
  const pr = rolParticipante(rol);
  if (!pr) { res.status(403).json({ error: 'Este chat es para alumnos y gestores.' }); return; }

  const conv = await obtenerOCrearConversacion(userId, pr);
  if (conv.noLeidosParticipante > 0) {
    await db.update(chatConversaciones).set({ noLeidosParticipante: 0 }).where(eq(chatConversaciones.id, conv.id));
  }
  const mensajes = await db
    .select()
    .from(chatMensajes)
    .where(eq(chatMensajes.conversacionId, conv.id))
    .orderBy(asc(chatMensajes.createdAt));

  res.json({ conversacion: { ...conv, noLeidosParticipante: 0 }, mensajes });
});

// Enviar un mensaje a la Secretaría (texto y/o adjunto).
router.post('/mensajes', subirAdjuntoMw, async (req, res) => {
  const { userId, rol } = req.user!;
  const pr = rolParticipante(rol);
  const file = req.file;
  const limpiarArchivo = () => { if (file) fs.unlink(file.path).catch(() => {}); };
  if (!pr) { limpiarArchivo(); res.status(403).json({ error: 'Este chat es para alumnos y gestores.' }); return; }

  const cuerpo = typeof req.body?.cuerpo === 'string' ? req.body.cuerpo.trim().slice(0, 4000) : '';
  if (!cuerpo && !file) { res.status(400).json({ error: 'Escribe un mensaje o adjunta un documento' }); return; }

  const conv = await obtenerOCrearConversacion(userId, pr);
  const [msg] = await db
    .insert(chatMensajes)
    .values({
      conversacionId: conv.id, remitenteUserId: userId, remitenteRol: pr, esSecretaria: false, cuerpo,
      adjuntoRuta: file?.path, adjuntoNombre: file?.originalname, adjuntoMime: file?.mimetype,
    })
    .returning();
  const resumen = cuerpo || (file ? `📎 ${file.originalname}` : '');
  await db
    .update(chatConversaciones)
    .set({
      ultimoMensajeEn: sql`now()`,
      ultimoMensajeTexto: resumen.slice(0, 300),
      noLeidosAdmin: sql`${chatConversaciones.noLeidosAdmin} + 1`,
    })
    .where(eq(chatConversaciones.id, conv.id));

  const nombre = await nombreParticipante(userId, pr);
  await notificarATodosLosAdmins({
    tipo: 'chat_mensaje',
    prioridad: 'normal',
    titulo: 'Nuevo mensaje en el chat',
    cuerpo: `${nombre} (${pr === 'gestor' ? 'gestor' : 'alumno'}): "${resumen.slice(0, 80)}"`,
    enlace: `/admin/chat?c=${conv.id}`,
  }).catch(() => {});

  res.json({ mensaje: msg });
});

// Preview de un adjunto (solo de la conversación del propio participante).
router.get('/mensajes/:id/preview', async (req, res) => {
  const { userId, rol } = req.user!;
  if (!rolParticipante(rol)) { res.status(403).json({ error: 'No autorizado' }); return; }
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'id inválido' }); return; }
  const [row] = await db
    .select({ ruta: chatMensajes.adjuntoRuta, mime: chatMensajes.adjuntoMime, nombre: chatMensajes.adjuntoNombre, participante: chatConversaciones.participanteUserId })
    .from(chatMensajes)
    .innerJoin(chatConversaciones, eq(chatMensajes.conversacionId, chatConversaciones.id))
    .where(eq(chatMensajes.id, id));
  if (!row || row.participante !== userId) { res.status(404).json({ error: 'No encontrado' }); return; }
  servirAdjunto(row.ruta, row.mime, row.nombre, res);
});

// Contador de no leídos para el badge del participante.
router.get('/no-leidos', async (req, res) => {
  const { userId, rol } = req.user!;
  if (!rolParticipante(rol)) { res.json({ noLeidos: 0 }); return; }
  const [c] = await db
    .select({ n: chatConversaciones.noLeidosParticipante })
    .from(chatConversaciones)
    .where(eq(chatConversaciones.participanteUserId, userId));
  res.json({ noLeidos: c?.n ?? 0 });
});

// ═══════════════════════════════════════════════════════════════════════
// SECRETARÍA (admin)
// ═══════════════════════════════════════════════════════════════════════
const adminChatRouter = Router();
adminChatRouter.use(authRequired, requireRol('admin'));

// Bandeja: todas las conversaciones con nombre del participante.
adminChatRouter.get('/conversaciones', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const rows = await db
    .select({
      id: chatConversaciones.id,
      participanteUserId: chatConversaciones.participanteUserId,
      participanteRol: chatConversaciones.participanteRol,
      ultimoMensajeEn: chatConversaciones.ultimoMensajeEn,
      ultimoMensajeTexto: chatConversaciones.ultimoMensajeTexto,
      noLeidosAdmin: chatConversaciones.noLeidosAdmin,
      cerrada: chatConversaciones.cerrada,
      nombreEstudiante: estudiantes.nombreCompleto,
      nombreGestor: gestores.nombreCompleto,
      email: users.email,
    })
    .from(chatConversaciones)
    .leftJoin(estudiantes, eq(chatConversaciones.participanteUserId, estudiantes.userId))
    .leftJoin(gestores, eq(chatConversaciones.participanteUserId, gestores.userId))
    .leftJoin(users, eq(chatConversaciones.participanteUserId, users.id))
    .orderBy(desc(chatConversaciones.ultimoMensajeEn));

  let conversaciones = rows.map((r) => ({
    id: r.id,
    participanteUserId: r.participanteUserId,
    participanteRol: r.participanteRol,
    nombre: r.nombreGestor ?? r.nombreEstudiante ?? r.email ?? 'Usuario',
    email: r.email,
    ultimoMensajeEn: r.ultimoMensajeEn,
    ultimoMensajeTexto: r.ultimoMensajeTexto,
    noLeidos: r.noLeidosAdmin,
    cerrada: r.cerrada,
  }));
  if (q) {
    const ql = q.toLowerCase();
    conversaciones = conversaciones.filter(
      (c) => c.nombre.toLowerCase().includes(ql) || (c.email ?? '').toLowerCase().includes(ql)
    );
  }
  res.json({ conversaciones });
});

// Total de conversaciones con mensajes sin leer (badge del sidebar).
adminChatRouter.get('/no-leidos', async (_req, res) => {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(chatConversaciones)
    .where(sql`${chatConversaciones.noLeidosAdmin} > 0`);
  res.json({ noLeidos: r?.n ?? 0 });
});

// Listar/buscar destinatarios (alumnos/gestores) para iniciar una conversación.
// - `q` opcional: sin q lista todos (limitado). Con q filtra por nombre/CURP.
// - `rol` opcional: 'estudiante' | 'gestor' | 'todos' (default).
adminChatRouter.get('/destinatarios', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const rolFiltro = typeof req.query.rol === 'string' ? req.query.rol : 'todos';
  const patt = q ? `%${q}%` : null;
  const LIMITE = 40;

  let als: { userId: number; nombre: string | null; curp: string | null; municipio: string | null }[] = [];
  let gs: { userId: number; nombre: string | null; municipio: string | null }[] = [];

  if (rolFiltro === 'todos' || rolFiltro === 'estudiante') {
    als = await db
      .select({ userId: estudiantes.userId, nombre: estudiantes.nombreCompleto, curp: estudiantes.curp, municipio: municipios.nombre })
      .from(estudiantes)
      .leftJoin(municipios, eq(estudiantes.municipioId, municipios.id))
      .where(patt ? or(ilike(estudiantes.nombreCompleto, patt), ilike(estudiantes.curp, patt)) : undefined)
      .orderBy(asc(estudiantes.nombreCompleto))
      .limit(LIMITE);
  }
  if (rolFiltro === 'todos' || rolFiltro === 'gestor') {
    gs = await db
      .select({ userId: gestores.userId, nombre: gestores.nombreCompleto, municipio: municipios.nombre })
      .from(gestores)
      .leftJoin(municipios, eq(gestores.municipioId, municipios.id))
      .where(patt ? ilike(gestores.nombreCompleto, patt) : undefined)
      .orderBy(asc(gestores.nombreCompleto))
      .limit(LIMITE);
  }

  const destinatarios = [
    ...gs.map((g) => ({ userId: g.userId, nombre: g.nombre ?? '—', rol: 'gestor' as const, detalle: g.municipio ?? 'Gestor municipal' })),
    ...als.map((a) => ({ userId: a.userId, nombre: a.nombre ?? '—', rol: 'estudiante' as const, detalle: a.municipio ?? (a.curp ?? '') })),
  ];
  res.json({ destinatarios });
});

// Iniciar (o abrir) conversación con un usuario específico.
adminChatRouter.post('/nueva', async (req, res) => {
  const schema = z.object({ participanteUserId: z.number().int().positive() });
  const parse = schema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: 'Destinatario inválido' }); return; }
  const uid = parse.data.participanteUserId;
  const [u] = await db.select({ rol: users.rol }).from(users).where(eq(users.id, uid));
  const pr = u ? rolParticipante(u.rol) : null;
  if (!pr) { res.status(400).json({ error: 'Solo puedes escribir a alumnos o gestores.' }); return; }
  const conv = await obtenerOCrearConversacion(uid, pr);
  res.json({ conversacionId: conv.id });
});

// Ver una conversación (mensajes) y marcarla leída para la Secretaría.
adminChatRouter.get('/conversaciones/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'id inválido' }); return; }
  const [conv] = await db.select().from(chatConversaciones).where(eq(chatConversaciones.id, id));
  if (!conv) { res.status(404).json({ error: 'Conversación no encontrada' }); return; }
  if (conv.noLeidosAdmin > 0) {
    await db.update(chatConversaciones).set({ noLeidosAdmin: 0 }).where(eq(chatConversaciones.id, id));
  }
  const nombre = await nombreParticipante(conv.participanteUserId, conv.participanteRol);
  const mensajes = await db
    .select()
    .from(chatMensajes)
    .where(eq(chatMensajes.conversacionId, id))
    .orderBy(asc(chatMensajes.createdAt));
  res.json({ conversacion: { ...conv, noLeidosAdmin: 0, nombre }, mensajes });
});

// Responder como Secretaría (texto y/o adjunto).
adminChatRouter.post('/conversaciones/:id/mensajes', subirAdjuntoMw, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  const file = req.file;
  const limpiarArchivo = () => { if (file) fs.unlink(file.path).catch(() => {}); };
  if (isNaN(id)) { limpiarArchivo(); res.status(400).json({ error: 'id inválido' }); return; }

  const cuerpo = typeof req.body?.cuerpo === 'string' ? req.body.cuerpo.trim().slice(0, 4000) : '';
  if (!cuerpo && !file) { res.status(400).json({ error: 'Escribe un mensaje o adjunta un documento' }); return; }

  const [conv] = await db.select().from(chatConversaciones).where(eq(chatConversaciones.id, id));
  if (!conv) { limpiarArchivo(); res.status(404).json({ error: 'Conversación no encontrada' }); return; }

  const adminUserId = req.user!.userId;
  const [msg] = await db
    .insert(chatMensajes)
    .values({
      conversacionId: id, remitenteUserId: adminUserId, remitenteRol: 'administrador', esSecretaria: true, cuerpo,
      adjuntoRuta: file?.path, adjuntoNombre: file?.originalname, adjuntoMime: file?.mimetype,
    })
    .returning();
  const resumen = cuerpo || (file ? `📎 ${file.originalname}` : '');
  await db
    .update(chatConversaciones)
    .set({
      ultimoMensajeEn: sql`now()`,
      ultimoMensajeTexto: resumen.slice(0, 300),
      noLeidosParticipante: sql`${chatConversaciones.noLeidosParticipante} + 1`,
    })
    .where(eq(chatConversaciones.id, id));

  await notificar({
    userId: conv.participanteUserId,
    tipo: 'mensaje_admin',
    prioridad: 'normal',
    titulo: 'Mensaje de la Secretaría',
    cuerpo: resumen.slice(0, 120),
    enlace: conv.participanteRol === 'gestor' ? '/gestor/mensajes' : '/estudiante/mensajes',
  }).catch(() => {});

  res.json({ mensaje: msg });
});

// Preview de un adjunto (cualquier conversación; solo admin).
adminChatRouter.get('/mensajes/:id/preview', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'id inválido' }); return; }
  const [row] = await db
    .select({ ruta: chatMensajes.adjuntoRuta, mime: chatMensajes.adjuntoMime, nombre: chatMensajes.adjuntoNombre })
    .from(chatMensajes)
    .where(eq(chatMensajes.id, id));
  if (!row) { res.status(404).json({ error: 'No encontrado' }); return; }
  servirAdjunto(row.ruta, row.mime, row.nombre, res);
});

export default router;
export { adminChatRouter };
