/**
 * Banco de preguntas — endpoints para quizzes aleatorios.
 *
 * GET  /banco/modulo/:num/quiz          → 20 preguntas aleatorias del módulo (sin respuesta)
 * POST /banco/modulo/:num/quiz/verificar → corrige las respuestas del alumno
 * GET  /banco/modulo/:num/stats         → cuántas preguntas hay, por dificultad (admin/gestor)
 */

import { Router } from 'express';
import { eq, inArray, sql, and } from 'drizzle-orm';
import { db } from '../db';
import { bancoPreguntas, estudiantesModulosProgreso, modulos } from '@workspace/db/schema';
import { authRequired } from '../middleware/auth';
import { z } from 'zod';

const router = Router();
router.use(authRequired);

const PREGUNTAS_POR_QUIZ = 20;

// ── GET /banco/modulo/:num/quiz ───────────────────────────────────────────
// Returns 20 random questions for the module. Correct answer is EXCLUDED
// from the response so the client cannot peek in DevTools.
router.get('/modulo/:num/quiz', async (req, res) => {
  const moduloNum = Number(req.params.num);
  if (!moduloNum || moduloNum < 1 || moduloNum > 21) {
    res.status(400).json({ error: 'Módulo inválido (1–21)' });
    return;
  }

  const rows = await db
    .select({
      id: bancoPreguntas.id,
      preguntaDocId: bancoPreguntas.preguntaDocId,
      unidadNum: bancoPreguntas.unidadNum,
      tema: bancoPreguntas.tema,
      dificultad: bancoPreguntas.dificultad,
      pregunta: bancoPreguntas.pregunta,
      opcionA: bancoPreguntas.opcionA,
      opcionB: bancoPreguntas.opcionB,
      opcionC: bancoPreguntas.opcionC,
      opcionD: bancoPreguntas.opcionD,
      // respuestaCorrecta intentionally omitted
      paraRepasar: bancoPreguntas.paraRepasar,
    })
    .from(bancoPreguntas)
    .where(eq(bancoPreguntas.moduloNum, moduloNum))
    .orderBy(sql`RANDOM()`)
    .limit(PREGUNTAS_POR_QUIZ);

  if (rows.length === 0) {
    res.status(404).json({ error: 'No hay preguntas para este módulo' });
    return;
  }

  res.json({
    moduloNum,
    total: rows.length,
    preguntas: rows,
  });
});

// ── POST /banco/modulo/:num/quiz/verificar ────────────────────────────────
// Body: { respuestas: { [preguntaId]: "A" | "B" | "C" | "D" } }
// Returns: score, per-question feedback with correct answer + explanation.
const verificarSchema = z.object({
  respuestas: z.record(z.string(), z.enum(['A', 'B', 'C', 'D'])),
});

router.post('/modulo/:num/quiz/verificar', async (req, res) => {
  const moduloNum = Number(req.params.num);
  if (!moduloNum || moduloNum < 1 || moduloNum > 21) {
    res.status(400).json({ error: 'Módulo inválido (1–21)' });
    return;
  }

  const parse = verificarSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Datos inválidos', detalles: parse.error.issues });
    return;
  }

  const { respuestas } = parse.data;
  const ids = Object.keys(respuestas).map(Number).filter(Boolean);

  if (ids.length === 0) {
    res.status(400).json({ error: 'Sin respuestas' });
    return;
  }

  // Fetch the questions with correct answers
  const rows = await db
    .select({
      id: bancoPreguntas.id,
      preguntaDocId: bancoPreguntas.preguntaDocId,
      tema: bancoPreguntas.tema,
      dificultad: bancoPreguntas.dificultad,
      pregunta: bancoPreguntas.pregunta,
      opcionA: bancoPreguntas.opcionA,
      opcionB: bancoPreguntas.opcionB,
      opcionC: bancoPreguntas.opcionC,
      opcionD: bancoPreguntas.opcionD,
      respuestaCorrecta: bancoPreguntas.respuestaCorrecta,
      explicacion: bancoPreguntas.explicacion,
      paraRepasar: bancoPreguntas.paraRepasar,
    })
    .from(bancoPreguntas)
    .where(inArray(bancoPreguntas.id, ids));

  let correctas = 0;
  const feedback = rows.map((q) => {
    const respuestaAlumno = respuestas[String(q.id)] ?? null;
    const acerto = respuestaAlumno === q.respuestaCorrecta;
    if (acerto) correctas++;
    return {
      id: q.id,
      preguntaDocId: q.preguntaDocId,
      tema: q.tema,
      dificultad: q.dificultad,
      pregunta: q.pregunta,
      opcionA: q.opcionA,
      opcionB: q.opcionB,
      opcionC: q.opcionC,
      opcionD: q.opcionD,
      respuestaCorrecta: q.respuestaCorrecta,
      respuestaAlumno,
      acerto,
      explicacion: q.explicacion,
      paraRepasar: q.paraRepasar,
    };
  });

  const total = rows.length;
  const calificacion = Math.round((correctas / total) * 100);
  const aprobado = calificacion >= 60;

  // Actualizar progreso del alumno
  try {
    const userId = req.user!.userId;
    const [mod] = await db
      .select({ id: modulos.id })
      .from(modulos)
      .where(eq(modulos.numero, moduloNum))
      .limit(1);

    if (mod) {
      const [progExist] = await db
        .select({
          intentosQuiz: estudiantesModulosProgreso.intentosQuiz,
          mejorCalificacion: estudiantesModulosProgreso.mejorCalificacion,
          estado: estudiantesModulosProgreso.estado,
        })
        .from(estudiantesModulosProgreso)
        .where(
          and(
            eq(estudiantesModulosProgreso.estudianteId, userId),
            eq(estudiantesModulosProgreso.moduloId, mod.id)
          )
        );

      const nuevoEstado =
        progExist?.estado === 'aprobado'
          ? 'aprobado'
          : calificacion >= 60
          ? 'aprobado'
          : 'en_curso';

      const nuevaMejor = Math.max(calificacion, progExist?.mejorCalificacion ?? 0);

      // Calcular temas débiles (temas con al menos 1 respuesta incorrecta)
      const temaMap = new Map<string, { correctas: number; total: number }>();
      for (const f of feedback) {
        const key = f.tema || 'General';
        const entry = temaMap.get(key) ?? { correctas: 0, total: 0 };
        entry.total++;
        if (f.acerto) entry.correctas++;
        temaMap.set(key, entry);
      }
      // Solo incluir temas donde no fue 100% correcto, ordenar de peor a mejor
      const temasDebiles = Array.from(temaMap.entries())
        .filter(([, v]) => v.correctas < v.total)
        .sort((a, b) => (a[1].correctas / a[1].total) - (b[1].correctas / b[1].total))
        .map(([tema, v]) => ({ tema, correctas: v.correctas, total: v.total }));

      if (progExist) {
        await db
          .update(estudiantesModulosProgreso)
          .set({
            intentosQuiz: (progExist.intentosQuiz ?? 0) + 1,
            ultimaCalificacion: calificacion,
            mejorCalificacion: nuevaMejor,
            estado: nuevoEstado,
            temasDebiles: temasDebiles.length > 0 ? temasDebiles : null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(estudiantesModulosProgreso.estudianteId, userId),
              eq(estudiantesModulosProgreso.moduloId, mod.id)
            )
          );
      } else {
        await db.insert(estudiantesModulosProgreso).values({
          estudianteId: userId,
          moduloId: mod.id,
          estado: nuevoEstado,
          intentosQuiz: 1,
          ultimaCalificacion: calificacion,
          mejorCalificacion: calificacion,
          temasDebiles: temasDebiles.length > 0 ? temasDebiles : null,
        });
      }
    }
  } catch {
    // No fallar el request si el tracking falla
  }

  res.json({
    moduloNum,
    total,
    correctas,
    incorrectas: total - correctas,
    calificacion,
    aprobado,
    feedback,
  });
});

// ── GET /banco/modulo/:num/stats ──────────────────────────────────────────
// Admin/gestor only — count of questions per difficulty level
router.get('/modulo/:num/stats', async (req, res) => {
  if (!['admin', 'gestor'].includes(req.user!.rol)) {
    res.status(403).json({ error: 'Sin acceso' });
    return;
  }

  const moduloNum = Number(req.params.num);
  if (!moduloNum || moduloNum < 1 || moduloNum > 21) {
    res.status(400).json({ error: 'Módulo inválido (1–21)' });
    return;
  }

  const byDif = await db
    .select({
      dificultad: bancoPreguntas.dificultad,
      total: sql<number>`COUNT(*)::int`,
    })
    .from(bancoPreguntas)
    .where(eq(bancoPreguntas.moduloNum, moduloNum))
    .groupBy(bancoPreguntas.dificultad);

  const totalPreguntas = byDif.reduce((s, r) => s + (r.total ?? 0), 0);

  res.json({
    moduloNum,
    totalPreguntas,
    porDificultad: byDif,
  });
});

export default router;
