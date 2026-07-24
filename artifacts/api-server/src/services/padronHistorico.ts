/**
 * Padrón histórico — registro PERMANENTE. Cada alumno que recibe matrícula se
 * agrega aquí y NUNCA se depura: aunque su cuenta se elimine por inactividad,
 * el rastro en el padrón se conserva. Es la fuente histórica del Estado.
 */
import { eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { estudiantes, padronHistorico } from '@workspace/db/schema';

const sexoAPadron = (s: string | null): string | null =>
  s === 'hombre' ? 'M' : s === 'mujer' ? 'F' : null;

const soloFecha = (d: string | Date | null): string | null => {
  if (!d) return null;
  return (d instanceof Date ? d.toISOString() : String(d)).slice(0, 10);
};

/**
 * Registra (o actualiza) al alumno en el padrón histórico. Requiere matrícula
 * (es la llave del padrón); sin ella no hace nada. Idempotente por matrícula:
 * si ya está, actualiza sus datos pero conserva su fecha de alta original.
 */
export async function registrarEnPadronHistorico(estudianteId: number): Promise<void> {
  try {
    const [e] = await db
      .select({
        matricula: estudiantes.matriculaOficialDGB,
        curp: estudiantes.curp,
        apellidoPaterno: estudiantes.apellidoPaterno,
        apellidoMaterno: estudiantes.apellidoMaterno,
        nombres: estudiantes.nombres,
        nombreCompleto: estudiantes.nombreCompleto,
        sexo: estudiantes.sexo,
        fechaNacimiento: estudiantes.fechaNacimiento,
        createdAt: estudiantes.createdAt,
      })
      .from(estudiantes)
      .where(eq(estudiantes.userId, estudianteId))
      .limit(1);
    if (!e || !e.matricula) return;

    await db.insert(padronHistorico).values({
      matricula: e.matricula,
      curp: e.curp ? e.curp.toUpperCase() : null,
      primerApellido: e.apellidoPaterno ?? null,
      segundoApellido: e.apellidoMaterno ?? null,
      nombre: e.nombres ?? e.nombreCompleto ?? null,
      sexo: sexoAPadron(e.sexo),
      fechaNacimiento: soloFecha(e.fechaNacimiento),
      fechaAlta: soloFecha(e.createdAt),
    }).onConflictDoUpdate({
      target: padronHistorico.matricula,
      set: {
        curp: sql`excluded.curp`,
        primerApellido: sql`excluded.primer_apellido`,
        segundoApellido: sql`excluded.segundo_apellido`,
        nombre: sql`excluded.nombre`,
        sexo: sql`excluded.sexo`,
        fechaNacimiento: sql`excluded.fecha_nacimiento`,
        // fecha_alta NO se pisa: la primera alta manda.
        updatedAt: sql`now()`,
      },
    });
  } catch (err) {
    console.error('[padron] No se pudo registrar en el padrón histórico:', err);
  }
}
