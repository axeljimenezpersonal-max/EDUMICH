/**
 * Ruta de la fotografía del expediente que puede usarse en documentos oficiales
 * (cédula, ficha de pre-registro y credencial digital).
 *
 * REGLA ÚNICA: la fotografía solo se propaga a esos documentos cuando el
 * documento 'foto' está APROBADO por la administración. Mientras esté pendiente
 * o rechazada, los documentos se generan sin fotografía.
 */
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { expedienteDocumentos } from '@workspace/db/schema';
import { archivoExiste } from '../services/storage';

export async function rutaFotoAprobada(estudianteId: number): Promise<string | null> {
  const [foto] = await db
    .select({ rutaArchivo: expedienteDocumentos.rutaArchivo })
    .from(expedienteDocumentos)
    .where(and(
      eq(expedienteDocumentos.estudianteId, estudianteId),
      eq(expedienteDocumentos.tipo, 'foto'),
      eq(expedienteDocumentos.estado, 'aprobado'),
    ));
  return foto && (await archivoExiste(foto.rutaArchivo)) ? foto.rutaArchivo : null;
}
