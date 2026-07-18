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
import { tieneLenguajeOfensivo, MENSAJE_MODERACION } from '../utils/moderacion';

const cuerpoSchema = z.object({ cuerpo: z.string().trim().min(1, 'Escribe un mensaje').max(4000) });

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

  // ¿Ya aceptó el aviso legal alguna vez? El consentimiento es un registro legal
  // y vive en la BD, no en el navegador: si no se consultara, el chat flotante
  // volvería a pedirlo en cada carga de página (y en cada dispositivo).
  const [consent] = await db
    .select({ id: chatConsentimientos.id })
    .from(chatConsentimientos)
    .where(eq(chatConsentimientos.userId, userId))
    .limit(1);

  res.json({
    conversacion: { ...conv, noLeidosParticipante: 0 },
    mensajes,
    consentimientoAceptado: !!consent,
  });
});

// Enviar un mensaje a la Secretaría.
router.post('/mensajes', async (req, res) => {
  const { userId, rol } = req.user!;
  const pr = rolParticipante(rol);
  if (!pr) { res.status(403).json({ error: 'Este chat es para alumnos y gestores.' }); return; }

  const parse = cuerpoSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: parse.error.issues[0]?.message ?? 'Mensaje inválido' }); return; }
  const cuerpo = parse.data.cuerpo;
  if (tieneLenguajeOfensivo(cuerpo)) { res.status(400).json({ error: MENSAJE_MODERACION }); return; }

  const conv = await obtenerOCrearConversacion(userId, pr);
  const [msg] = await db
    .insert(chatMensajes)
    .values({ conversacionId: conv.id, remitenteUserId: userId, remitenteRol: pr, esSecretaria: false, cuerpo })
    .returning();
  await db
    .update(chatConversaciones)
    .set({
      ultimoMensajeEn: sql`now()`,
      ultimoMensajeTexto: cuerpo.slice(0, 300),
      noLeidosAdmin: sql`${chatConversaciones.noLeidosAdmin} + 1`,
    })
    .where(eq(chatConversaciones.id, conv.id));

  const nombre = await nombreParticipante(userId, pr);
  await notificarATodosLosAdmins({
    tipo: 'chat_mensaje',
    prioridad: 'normal',
    titulo: 'Nuevo mensaje en el chat',
    cuerpo: `${nombre} (${pr === 'gestor' ? 'gestor' : 'alumno'}) escribió: "${cuerpo.slice(0, 80)}"`,
    enlace: `/admin/chat?c=${conv.id}`,
  }).catch(() => {});

  res.json({ mensaje: msg });
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

// Responder como Secretaría.
adminChatRouter.post('/conversaciones/:id/mensajes', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'id inválido' }); return; }
  const parse = cuerpoSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: parse.error.issues[0]?.message ?? 'Mensaje inválido' }); return; }
  const cuerpo = parse.data.cuerpo;
  if (tieneLenguajeOfensivo(cuerpo)) { res.status(400).json({ error: MENSAJE_MODERACION }); return; }

  const [conv] = await db.select().from(chatConversaciones).where(eq(chatConversaciones.id, id));
  if (!conv) { res.status(404).json({ error: 'Conversación no encontrada' }); return; }

  const adminUserId = req.user!.userId;
  const [msg] = await db
    .insert(chatMensajes)
    .values({ conversacionId: id, remitenteUserId: adminUserId, remitenteRol: 'administrador', esSecretaria: true, cuerpo })
    .returning();
  await db
    .update(chatConversaciones)
    .set({
      ultimoMensajeEn: sql`now()`,
      ultimoMensajeTexto: cuerpo.slice(0, 300),
      noLeidosParticipante: sql`${chatConversaciones.noLeidosParticipante} + 1`,
    })
    .where(eq(chatConversaciones.id, id));

  await notificar({
    userId: conv.participanteUserId,
    tipo: 'mensaje_admin',
    prioridad: 'normal',
    titulo: 'Mensaje de la Secretaría',
    cuerpo: cuerpo.slice(0, 120),
    enlace: conv.participanteRol === 'gestor' ? '/gestor/mensajes' : '/estudiante/mensajes',
  }).catch(() => {});

  res.json({ mensaje: msg });
});

export default router;
export { adminChatRouter };
