import { db } from '../db';
import { estudiantes } from '@workspace/db/schema';
import { sql } from 'drizzle-orm';

// Mexican public holidays (fixed dates, month is 1-based)
const FESTIVOS_FIJOS: [number, number][] = [
  [1, 1],   // Año Nuevo
  [2, 5],   // Constitución
  [3, 21],  // Natalicio Juárez
  [5, 1],   // Día del Trabajo
  [9, 16],  // Independencia
  [11, 2],  // Día de Muertos (SEP)
  [11, 20], // Revolución
  [12, 25], // Navidad
];

function esFestivo(d: Date): boolean {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return FESTIVOS_FIJOS.some(([fm, fd]) => fm === m && fd === day);
}

export function agregarDiasHabiles(base: Date, dias: number): Date {
  const result = new Date(base);
  let restantes = dias;
  while (restantes > 0) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6 && !esFestivo(result)) {
      restantes--;
    }
  }
  return result;
}

export async function generarFolioPreregistro(): Promise<string> {
  // Formato: PREF-<consecutivo>-<MM>-<YYYY> (p. ej. PREF-000004-07-2026).
  // El consecutivo es global y va justo después de PREF; el mes/año son de emisión.
  const now = new Date();
  const mes = String(now.getMonth() + 1).padStart(2, '0');
  const año = now.getFullYear();

  const result = await db.execute(sql`
    SELECT COALESCE(MAX(
      CAST(SUBSTRING(folio_preregistro FROM '^PREF-0*([0-9]+)') AS INTEGER)
    ), 0) + 1 AS siguiente
    FROM estudiantes
    WHERE folio_preregistro LIKE 'PREF-%'
  `);

  const row = result.rows[0];
  const siguiente = Number((row as any)?.siguiente ?? 1);
  return `PREF-${String(siguiente).padStart(6, '0')}-${mes}-${año}`;
}

export async function generarFolioLicencia(): Promise<string> {
  const año = new Date().getFullYear();
  const prefix = `LIC-${año}-MICH-`;

  const result = await db.execute(sql`
    SELECT COALESCE(MAX(
      CAST(SUBSTRING(licencia_digital FROM '[0-9]+$') AS INTEGER)
    ), 0) + 1 AS siguiente
    FROM estudiantes
    WHERE licencia_digital LIKE ${prefix + '%'}
  `);

  const row = result.rows[0];
  const siguiente = Number((row as any)?.siguiente ?? 1);
  return `${prefix}${String(siguiente).padStart(6, '0')}`;
}
