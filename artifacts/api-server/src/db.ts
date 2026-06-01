import { db, pool } from '@workspace/db';

export { db };

// Migraciones incrementales seguras (IF NOT EXISTS = idempotente).
// Se ejecutan al iniciar el servidor para mantener el esquema al día
// sin depender de drizzle-kit push en producción.

const migrations = [
  `ALTER TABLE estudiantes_modulos_progreso
     ADD COLUMN IF NOT EXISTS temas_debiles jsonb`,
];

export async function runStartupMigrations() {
  for (const sql of migrations) {
    await pool.query(sql).catch((err: unknown) => {
      console.warn('[db] startup migration warning:', err);
    });
  }
}
