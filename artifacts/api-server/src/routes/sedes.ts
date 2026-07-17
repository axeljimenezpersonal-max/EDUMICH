/**
 * Sedes — catálogo institucional y sedes habilitadas por etapa.
 *
 * Modelo canónico (acordado 2026-07-16): la CONVOCATORIA (etapa) define en qué
 * sedes se puede presentar; al inscribirse, el alumno ELIGE una de esas. Antes
 * la sede se deducía del municipio del alumno con un respaldo «primera de la
 * tabla» que mostraba sedes equivocadas — se elimina.
 *
 * Acceso: ambos perfiles de administración (jefe y operativo comparten
 * `rol='admin'`), como se decidió. La lectura para el alumno vive en
 * routes/estudiante.ts (sedes disponibles de su etapa).
 */
import { Router } from 'express';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import {
  sedes,
  municipios,
  convocatoriasEtapas,
  convocatoriasEtapasSedes,
  examenesInscripciones,
} from '@workspace/db/schema';
import { authRequired, requireRol } from '../middleware/auth';
import { tryAuditLog } from '../utils/audit';

const router = Router();
router.use(authRequired, requireRol('admin'));

// Coordenadas se guardan como texto (evita imprecisión de decimal); se valida
// que, si vienen, sean números plausibles.
const coordSchema = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((v) => (v === undefined || v === null || v === '' ? null : String(v)))
  .refine((v) => v === null || !Number.isNaN(Number(v)), 'Coordenada inválida');

const sedeSchema = z.object({
  nombre: z.string().trim().min(3, 'Nombre demasiado corto').max(150),
  direccion: z.string().trim().min(5, 'Dirección demasiado corta'),
  municipioId: z.number().int().positive('Municipio requerido'),
  telefono: z.string().trim().max(30).optional().nullable(),
  horarioAtencion: z.string().trim().max(200).optional().nullable(),
  latitud: coordSchema,
  longitud: coordSchema,
});

// ─── GET /admin/sedes ────────────────────────────────────────────────────────
// Catálogo completo con municipio y cuántas veces está en uso (para avisar antes
// de borrar). `usos` = inscripciones que la referencian.
router.get('/', async (_req, res) => {
  const rows = await db.execute<{
    id: number; nombre: string; direccion: string; municipio_id: number; municipio: string;
    telefono: string | null; horario_atencion: string | null; latitud: string | null; longitud: string | null;
    usos: number;
  }>(sql`
    SELECT s.id, s.nombre, s.direccion, s.municipio_id, m.nombre AS municipio,
           s.telefono, s.horario_atencion, s.latitud, s.longitud,
           COUNT(ei.id)::int AS usos
    FROM sedes s
    JOIN municipios m ON m.id = s.municipio_id
    LEFT JOIN examenes_inscripciones ei ON ei.sede_id = s.id
    GROUP BY s.id, m.nombre
    ORDER BY m.nombre ASC, s.nombre ASC
  `);
  res.json({
    sedes: rows.rows.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      direccion: r.direccion,
      municipioId: r.municipio_id,
      municipio: r.municipio,
      telefono: r.telefono,
      horarioAtencion: r.horario_atencion,
      latitud: r.latitud ? Number(r.latitud) : null,
      longitud: r.longitud ? Number(r.longitud) : null,
      usos: Number(r.usos),
    })),
  });
});

// ─── POST /admin/sedes ───────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const parse = sedeSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.issues[0]?.message ?? 'Datos inválidos' });
  }
  const d = parse.data;

  const [mun] = await db.select({ id: municipios.id }).from(municipios).where(eq(municipios.id, d.municipioId));
  if (!mun) return res.status(400).json({ error: 'Municipio no encontrado' });

  const [nueva] = await db
    .insert(sedes)
    .values({
      nombre: d.nombre,
      direccion: d.direccion,
      municipioId: d.municipioId,
      telefono: d.telefono ?? null,
      horarioAtencion: d.horarioAtencion ?? null,
      latitud: d.latitud,
      longitud: d.longitud,
    })
    .returning({ id: sedes.id });

  await tryAuditLog({
    userId: req.user!.userId,
    accion: 'crear_sede',
    entidad: 'sedes',
    entidadId: nueva.id,
    detalle: d.nombre,
  });

  return res.json({ ok: true, id: nueva.id });
});

// ─── PUT /admin/sedes/:id ────────────────────────────────────────────────────
// Editar corrige los datos a FUTURO; NO reasigna a quien ya se inscribió: la
// sede del examen queda congelada en examenes_inscripciones.sede_id.
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id inválido' });

  const parse = sedeSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.issues[0]?.message ?? 'Datos inválidos' });
  }
  const d = parse.data;

  const [existe] = await db.select({ id: sedes.id }).from(sedes).where(eq(sedes.id, id));
  if (!existe) return res.status(404).json({ error: 'Sede no encontrada' });

  await db
    .update(sedes)
    .set({
      nombre: d.nombre,
      direccion: d.direccion,
      municipioId: d.municipioId,
      telefono: d.telefono ?? null,
      horarioAtencion: d.horarioAtencion ?? null,
      latitud: d.latitud,
      longitud: d.longitud,
    })
    .where(eq(sedes.id, id));

  await tryAuditLog({
    userId: req.user!.userId,
    accion: 'editar_sede',
    entidad: 'sedes',
    entidadId: id,
    detalle: d.nombre,
  });

  return res.json({ ok: true });
});

// ─── DELETE /admin/sedes/:id ─────────────────────────────────────────────────
// No se puede borrar una sede que ya usan inscripciones (integridad histórica):
// se avisa en vez de romper por la llave foránea.
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id inválido' });

  const [{ usos }] = await db
    .select({ usos: sql<number>`COUNT(*)::int` })
    .from(examenesInscripciones)
    .where(eq(examenesInscripciones.sedeId, id));
  if (Number(usos) > 0) {
    return res.status(409).json({
      error: `No se puede eliminar: ${usos} inscripción(es) usan esta sede. Puedes editarla, no borrarla.`,
    });
  }

  await db.delete(sedes).where(eq(sedes.id, id));
  await tryAuditLog({
    userId: req.user!.userId,
    accion: 'eliminar_sede',
    entidad: 'sedes',
    entidadId: id,
  });
  return res.json({ ok: true });
});

// ─── GET /admin/sedes/etapa/:etapaId ─────────────────────────────────────────
// Devuelve TODO el catálogo marcando cuáles están habilitadas para esta etapa,
// para pintar la lista de casillas del admin de un solo tirón.
router.get('/etapa/:etapaId', async (req, res) => {
  const etapaId = Number(req.params.etapaId);
  if (!Number.isInteger(etapaId)) return res.status(400).json({ error: 'Etapa inválida' });

  const [etapa] = await db.select({ id: convocatoriasEtapas.id }).from(convocatoriasEtapas).where(eq(convocatoriasEtapas.id, etapaId));
  if (!etapa) return res.status(404).json({ error: 'Etapa no encontrada' });

  const rows = await db.execute<{
    id: number; nombre: string; municipio: string; habilitada: boolean; cupo: number | null;
  }>(sql`
    SELECT s.id, s.nombre, m.nombre AS municipio,
           (ces.id IS NOT NULL) AS habilitada, ces.cupo
    FROM sedes s
    JOIN municipios m ON m.id = s.municipio_id
    LEFT JOIN convocatorias_etapas_sedes ces
      ON ces.sede_id = s.id AND ces.etapa_id = ${etapaId}
    ORDER BY m.nombre ASC, s.nombre ASC
  `);

  return res.json({
    sedes: rows.rows.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      municipio: r.municipio,
      habilitada: r.habilitada,
      cupo: r.cupo,
    })),
  });
});

// ─── PUT /admin/sedes/etapa/:etapaId ─────────────────────────────────────────
// Reemplaza el conjunto de sedes habilitadas de la etapa por el que se envía.
// Body: { sedeIds: number[] }.
const setEtapaSchema = z.object({ sedeIds: z.array(z.number().int().positive()) });

router.put('/etapa/:etapaId', async (req, res) => {
  const etapaId = Number(req.params.etapaId);
  if (!Number.isInteger(etapaId)) return res.status(400).json({ error: 'Etapa inválida' });

  const parse = setEtapaSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'sedeIds inválido' });
  const { sedeIds } = parse.data;

  const [etapa] = await db.select({ id: convocatoriasEtapas.id }).from(convocatoriasEtapas).where(eq(convocatoriasEtapas.id, etapaId));
  if (!etapa) return res.status(404).json({ error: 'Etapa no encontrada' });

  // Reemplazo simple del conjunto: borra las de la etapa y reinserta.
  await db.delete(convocatoriasEtapasSedes).where(eq(convocatoriasEtapasSedes.etapaId, etapaId));
  if (sedeIds.length > 0) {
    const unicas = [...new Set(sedeIds)];
    await db
      .insert(convocatoriasEtapasSedes)
      .values(unicas.map((sedeId) => ({ etapaId, sedeId })))
      .onConflictDoNothing();
  }

  await tryAuditLog({
    userId: req.user!.userId,
    accion: 'set_sedes_etapa',
    entidad: 'convocatorias_etapas',
    entidadId: etapaId,
    detalle: `${sedeIds.length} sede(s)`,
  });

  return res.json({ ok: true });
});

export default router;
