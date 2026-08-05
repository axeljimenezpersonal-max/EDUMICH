/**
 * Comprobación de la bitácora: ¿alguien la tocó?
 *
 * Cada entrada firma su contenido junto con la huella de la anterior. Recorrer
 * la cadena y recalcular cada huella responde tres preguntas que antes no
 * tenían respuesta:
 *
 *  · ¿se editó una entrada?      → su huella deja de cuadrar con su contenido
 *  · ¿se borró una entrada?      → la siguiente cuelga de una huella que ya no existe
 *  · ¿se insertó una en medio?   → rompe el encadenado igual que un borrado
 *
 * Lo que esto NO prueba: que la entrada diga la verdad. Prueba que nadie la
 * cambió DESPUÉS de escribirla. Que lo escrito corresponda a lo que pasó
 * depende de que el código lo registre bien, no de la cadena.
 *
 * Las entradas anteriores a agosto de 2026 no tienen huella: se escribieron
 * antes de que existiera la cadena. Se cuentan aparte y se dicen como lo que
 * son —sin protección— en vez de darlas por buenas.
 */
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { huellaEntrada } from '../utils/audit';

export interface ResultadoVerificacion {
  intacta: boolean;
  totalEntradas: number;
  /** Escritas antes de que existiera la cadena: no se pueden comprobar. */
  sinCadena: number;
  verificadas: number;
  /** Primer eslabón que no cuadra. `null` si la cadena está intacta. */
  primeraRota: null | {
    id: number;
    createdAt: string;
    accion: string;
    motivo: 'contenido_alterado' | 'eslabon_no_coincide';
  };
  revisadaEn: string;
}

interface Fila extends Record<string, unknown> {
  id: number;
  created_at: Date;
  user_id: number | null;
  user_rol: string | null;
  accion: string;
  entidad: string;
  entidad_id: number | null;
  detalle: string | null;
  metadata: unknown;
  ip: string | null;
  hash: string | null;
  hash_previo: string | null;
}

export async function verificarBitacora(): Promise<ResultadoVerificacion> {
  // En orden de escritura: la cadena solo tiene sentido recorrida hacia
  // adelante, desde el primer eslabón.
  const { rows } = await db.execute<Fila>(sql`
    SELECT id, created_at, user_id, user_rol, accion, entidad, entidad_id,
           detalle, metadata, ip, hash, hash_previo
      FROM audit_log
     ORDER BY id ASC`);

  const sinCadena = rows.filter((r) => !r.hash).length;
  let verificadas = 0;
  let esperado: string | null = null;
  let primeraRota: ResultadoVerificacion['primeraRota'] = null;

  for (const r of rows) {
    if (!r.hash) continue; // anterior a la cadena

    // 1. ¿Cuelga del eslabón correcto? El primero con huella marca el inicio,
    //    así que su `hash_previo` se acepta tal cual.
    if (esperado !== null && r.hash_previo !== esperado) {
      primeraRota = {
        id: r.id,
        createdAt: new Date(r.created_at).toISOString(),
        accion: r.accion,
        motivo: 'eslabon_no_coincide',
      };
      break;
    }

    // 2. ¿Su huella corresponde a su contenido?
    const recalculada = huellaEntrada({
      createdAt: new Date(r.created_at),
      userId: r.user_id,
      userRol: r.user_rol,
      accion: r.accion,
      entidad: r.entidad,
      entidadId: r.entidad_id,
      detalle: r.detalle,
      metadata: r.metadata ?? null,
      ip: r.ip,
      hashPrevio: r.hash_previo ?? '',
    });
    if (recalculada !== r.hash) {
      primeraRota = {
        id: r.id,
        createdAt: new Date(r.created_at).toISOString(),
        accion: r.accion,
        motivo: 'contenido_alterado',
      };
      break;
    }

    verificadas += 1;
    esperado = r.hash;
  }

  return {
    intacta: primeraRota === null,
    totalEntradas: rows.length,
    sinCadena,
    verificadas,
    primeraRota,
    revisadaEn: new Date().toISOString(),
  };
}
