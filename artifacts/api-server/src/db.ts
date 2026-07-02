import { db, pool } from '@workspace/db';

export { db };

// Migraciones incrementales seguras (IF NOT EXISTS = idempotente).
// Se ejecutan al iniciar el servidor para mantener el esquema al día
// sin depender de drizzle-kit push en producción.

const migrations = [
  `ALTER TABLE estudiantes_modulos_progreso
     ADD COLUMN IF NOT EXISTS temas_debiles jsonb`,
  // Rol de dirección de programa (perfil ejecutivo solo-lectura)
  `ALTER TYPE rol ADD VALUE IF NOT EXISTS 'direccion'`,
  `CREATE TABLE IF NOT EXISTS directores (
     user_id integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
     nombre_completo varchar(200) NOT NULL,
     puesto varchar(120) DEFAULT 'Dirección de Programa',
     email_publico varchar(255),
     telefono_publico varchar(30),
     created_at timestamp NOT NULL DEFAULT now()
   )`,
];

export async function runStartupMigrations() {
  for (const sql of migrations) {
    await pool.query(sql).catch((err: unknown) => {
      console.warn('[db] startup migration warning:', err);
    });
  }
}
