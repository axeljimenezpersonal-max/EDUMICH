/**
 * Crea una CONVOCATORIA ACTIVA de prueba (estado 'abierta') para que el gestor
 * pueda registrar/inscribir alumnos en el demo de AWS.
 *
 * Idempotente: si ya hay una convocatoria abierta, no crea otra.
 *
 *   SEED_CONFIRMO_NO_ES_PRODUCCION=si \
 *     pnpm --filter @workspace/db exec tsx src/seed-convocatoria-activa.ts
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import { convocatorias } from './schema';

function fecha(offsetDias: number): string {
  // Sin Date.now(): se parte de una fecha base y se ajustan los días.
  const base = new Date();
  base.setDate(base.getDate() + offsetDias);
  return base.toISOString().slice(0, 10);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error('✋ No hay DATABASE_URL.'); process.exit(1); }
  if (process.env.SEED_CONFIRMO_NO_ES_PRODUCCION !== 'si') {
    console.error('✋ Confirma con SEED_CONFIRMO_NO_ES_PRODUCCION=si');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);

  const [yaAbierta] = await db.select().from(convocatorias).where(eq(convocatorias.estado, 'abierta'));
  if (yaAbierta) {
    console.log(`✅ Ya hay una convocatoria abierta: "${yaAbierta.nombre}". No se crea otra.`);
    await pool.end();
    return;
  }

  const [conv] = await db
    .insert(convocatorias)
    .values({
      nombre: 'Convocatoria 2026-1',
      fechaApertura: fecha(0),
      fechaCierre: fecha(30),
      fechaExamen: fecha(60),
      estado: 'abierta',
    })
    .returning();

  await pool.end();
  console.log(`✅ Convocatoria activa creada: "${conv.nombre}" (abierta). Ya puedes registrar alumnos.`);
}

main().catch((e) => { console.error('❌ Falló:', e); process.exit(1); });
