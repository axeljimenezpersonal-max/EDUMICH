/**
 * Resolución de la SEDE al inscribirse a exámenes — fuente única para los tres
 * flujos que inscriben (alumno, gestor, admin).
 *
 * Modelo canónico: la etapa define sus sedes habilitadas (convocatorias_etapas_
 * sedes) y se ELIGE una. Reglas:
 *
 *  1. Si la etapa tiene sedes configuradas:
 *     - con `sedeIdElegida` dentro del conjunto → esa.
 *     - con `sedeIdElegida` fuera del conjunto → error (no es válida aquí).
 *     - sin elección → la del municipio del alumno SI está en el conjunto; si no,
 *       y hay una sola sede habilitada, esa; si hay varias, error «elige sede».
 *  2. Si la etapa NO tiene sedes configuradas (transición / etapas viejas):
 *     - con `sedeIdElegida` existente → esa.
 *     - sin elección → la del municipio del alumno. Si no hay ninguna, error
 *       CLARO (antes se tomaba «la primera de la tabla», que era el bug: podía
 *       mandar a un alumno a una sede de otra ciudad).
 *
 * Nunca cae al respaldo ciego «primera sede que exista».
 */
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import { sedes, convocatoriasEtapasSedes } from '@workspace/db/schema';

export type ResultadoSede = { sedeId: number } | { error: string };

export async function resolverSedeParaInscripcion(opts: {
  etapaId: number;
  sedeIdElegida?: number | null;
  municipioId?: number | null;
}): Promise<ResultadoSede> {
  const { etapaId, sedeIdElegida, municipioId } = opts;

  // Sedes habilitadas para la etapa.
  const habilitadas = await db
    .select({ sedeId: convocatoriasEtapasSedes.sedeId })
    .from(convocatoriasEtapasSedes)
    .where(eq(convocatoriasEtapasSedes.etapaId, etapaId));
  const idsHabilitadas = habilitadas.map((h) => h.sedeId);

  // ── Caso 1: la etapa tiene sedes configuradas ──
  if (idsHabilitadas.length > 0) {
    if (sedeIdElegida != null) {
      if (!idsHabilitadas.includes(sedeIdElegida)) {
        return { error: 'La sede elegida no está disponible para esta etapa.' };
      }
      return { sedeId: sedeIdElegida };
    }
    // Sin elección: intenta la del municipio del alumno dentro del conjunto.
    if (municipioId != null) {
      const [porMun] = await db
        .select({ id: sedes.id })
        .from(sedes)
        .where(and(eq(sedes.municipioId, municipioId), inArray(sedes.id, idsHabilitadas)))
        .limit(1);
      if (porMun) return { sedeId: porMun.id };
    }
    // Si solo hay una sede habilitada, no hay nada que elegir.
    if (idsHabilitadas.length === 1) return { sedeId: idsHabilitadas[0] };
    return { error: 'Debes elegir una sede para presentar tu examen.' };
  }

  // ── Caso 2: etapa sin sedes configuradas ──
  if (sedeIdElegida != null) {
    const [existe] = await db.select({ id: sedes.id }).from(sedes).where(eq(sedes.id, sedeIdElegida));
    if (!existe) return { error: 'La sede elegida no existe.' };
    return { sedeId: sedeIdElegida };
  }
  if (municipioId != null) {
    const [porMun] = await db
      .select({ id: sedes.id })
      .from(sedes)
      .where(eq(sedes.municipioId, municipioId))
      .limit(1);
    if (porMun) return { sedeId: porMun.id };
  }
  return {
    error:
      'No hay sedes configuradas para esta etapa. Pide a la coordinación que habilite las sedes antes de inscribir.',
  };
}
