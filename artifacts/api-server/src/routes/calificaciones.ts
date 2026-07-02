/**
 * GET /calificaciones/estudiantes/:estudianteId → historial + resumen
 * Accesible por alumno (propio), gestor (su alumno), admin.
 */
import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import {
  calificaciones,
  modulos,
  sedes,
  estudiantes,
} from '@workspace/db/schema';
import { authRequired } from '../middleware/auth';
import { generarHistorialPdf } from '../services/historialPdf';

const router = Router();
router.use(authRequired);

async function canAccessStudent(
  requestUser: { userId: number; rol: string },
  estudianteId: number
): Promise<boolean> {
  if (requestUser.rol === 'admin') return true;
  if (requestUser.rol === 'estudiante') return requestUser.userId === estudianteId;
  if (requestUser.rol === 'gestor') {
    const [est] = await db
      .select({ gestorId: estudiantes.gestorId })
      .from(estudiantes)
      .where(eq(estudiantes.userId, estudianteId));
    return !!est && est.gestorId === requestUser.userId;
  }
  return false;
}

// GET /calificaciones/estudiantes/:estudianteId
router.get('/estudiantes/:estudianteId', async (req, res) => {
  const estudianteId = Number(req.params.estudianteId);
  if (!estudianteId) { res.status(400).json({ error: 'ID inválido' }); return; }

  if (!(await canAccessStudent(req.user!, estudianteId))) {
    res.status(403).json({ error: 'Sin acceso' }); return;
  }

  const rows = await db
    .select({
      id: calificaciones.id,
      moduloId: calificaciones.moduloId,
      etapaClave: calificaciones.etapaClave,
      calificacion: calificaciones.calificacion,
      aprobado: calificaciones.aprobado,
      intento: calificaciones.intento,
      fechaExamen: calificaciones.fechaExamen,
      notas: calificaciones.notas,
      createdAt: calificaciones.createdAt,
      moduloNumero: modulos.numero,
      moduloNombre: modulos.nombre,
      moduloNivel: modulos.nivel,
      sedeNombre: sedes.nombre,
    })
    .from(calificaciones)
    .leftJoin(modulos, eq(calificaciones.moduloId, modulos.id))
    .leftJoin(sedes, eq(calificaciones.sedeId, sedes.id))
    .where(eq(calificaciones.estudianteId, estudianteId))
    .orderBy(desc(calificaciones.fechaExamen));

  // Build modulosAprobados: best score per module, only approved
  const aprobadosMap = new Map<number, typeof rows[number]>();
  for (const r of rows) {
    if (!r.aprobado) continue;
    const existing = aprobadosMap.get(r.moduloId);
    if (!existing || r.calificacion > existing.calificacion) {
      aprobadosMap.set(r.moduloId, r);
    }
  }
  const modulosAprobados = Array.from(aprobadosMap.values()).sort(
    (a, b) => (a.moduloNumero ?? 0) - (b.moduloNumero ?? 0)
  );

  const totalAprobados = aprobadosMap.size;
  const examenesPresentados = rows.length;
  const promedioGlobal =
    rows.length > 0
      ? Math.round(rows.reduce((s, r) => s + r.calificacion, 0) / rows.length)
      : 0;
  const porcentajeAvance = Math.round((totalAprobados / 21) * 100);

  res.json({
    modulosAprobados,
    historial: rows,
    resumen: { totalAprobados, promedioGlobal, examenesPresentados, porcentajeAvance },
  });
});

// GET /calificaciones/estudiantes/:estudianteId/pdf → historial académico en PDF
router.get('/estudiantes/:estudianteId/pdf', async (req, res) => {
  const estudianteId = Number(req.params.estudianteId);
  if (!estudianteId) { res.status(400).json({ error: 'ID inválido' }); return; }
  if (!(await canAccessStudent(req.user!, estudianteId))) {
    res.status(403).json({ error: 'Sin acceso' }); return;
  }
  try {
    const { pdf, nombreArchivo } = await generarHistorialPdf(estudianteId);
    const ascii = nombreArchivo.normalize('NFKD').replace(/[^\x20-\x7E]/g, '').replace(/"/g, '') || 'historial.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nombreArchivo)}`);
    res.send(Buffer.from(pdf));
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'No se pudo generar el historial' });
  }
});

export default router;
