/**
 * Seed MÍNIMO de PRODUCCIÓN (Opción B).
 *
 * A diferencia de `seed.ts` (que crea cuentas y datos DEMO con password
 * `demo1234`), este script deja la base lista para operar SIN basura de prueba:
 *
 *   ✔ Catálogos: municipios, módulos del Plan 22, conceptos de pago.
 *   ✔ Etapas DGB 2026.
 *   ✔ Plantillas de correo (fuente única en `seed/plantillas.ts`).
 *   ✔ UN administrador titular, con correo y contraseña que se pasan por
 *     variables de entorno (NUNCA hardcodeados aquí).
 *
 *   ✘ NO crea gestor/estudiante/dirección demo, avisos, anuncios, sedes de
 *     prueba, alumnos, pagos ni integraciones con llaves ficticias.
 *   ✘ NO toca el banco de preguntas (vive solo en Neon / se re-importa aparte).
 *
 * Es idempotente: cada bloque revisa antes de insertar, así que correrlo dos
 * veces no duplica nada ni pisa la contraseña de un admin ya existente.
 *
 * ── Uso ─────────────────────────────────────────────────────────────────────
 *   SEED_CONFIRMO_NO_ES_PRODUCCION=si \
 *   SEED_ADMIN_EMAIL='<correo del admin>' \
 *   SEED_ADMIN_PASSWORD='<contraseña segura>' \
 *   DATABASE_URL='postgresql://...?sslmode=verify-full&sslrootcert=/app/rds-ca.pem' \
 *     pnpm --filter @workspace/db exec tsx src/seed-produccion.ts
 *
 * El flag SEED_CONFIRMO_NO_ES_PRODUCCION=si es obligatorio: este seed está
 * pensado para correr contra una base REAL (RDS vacía), y el candado evita que
 * se ejecute por distracción.
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { users, administradores } from './schema';
import { sembrarCatalogos } from './seed/catalogos';

function abortar(msg: string): never {
  console.error(`\n✋ ${msg}\n`);
  process.exit(1);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) abortar('No hay DATABASE_URL. Nada que sembrar.');

  // Candado explícito: este seed escribe en una base real.
  if (process.env.SEED_CONFIRMO_NO_ES_PRODUCCION !== 'si') {
    abortar(
      'Este seed escribe en una base real. Para confirmar, corre con:\n' +
        '   SEED_CONFIRMO_NO_ES_PRODUCCION=si ...',
    );
  }

  // Sin default: el correo del admin NO se hornea en el repo. Se pasa al correr.
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail)) {
    abortar('Falta SEED_ADMIN_EMAIL (un correo válido). NO se hardcodea en el repo.');
  }
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword || adminPassword.length < 12) {
    abortar('Falta SEED_ADMIN_PASSWORD (mínimo 12 caracteres). NO se hardcodea en el repo.');
  }

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);

  console.log('🌱 Seed MÍNIMO de producción — Preparatoria Abierta Michoacán\n');
  console.log(`   Destino: ${url.replace(/^.*@/, '').split(/[:/?]/)[0]}\n`);

  await sembrarCatalogos(db);

  // ── Administrador titular ─────────────────────────────────────────────────
  const [yaExiste] = await db.select({ id: users.id }).from(users).where(eq(users.email, adminEmail));
  if (yaExiste) {
    console.log(`\n👤 Admin ${adminEmail} ya existía — NO se toca su contraseña.`);
  } else {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const [adminUser] = await db
      .insert(users)
      .values({
        email: adminEmail,
        passwordHash,
        rol: 'admin',
        activo: true,
        // Entra directo con la contraseña segura reportada (no es temporal).
        passwordTemporal: false,
        privacidadAceptadaEn: new Date(),
      })
      .returning();
    await db.insert(administradores).values({
      userId: adminUser.id,
      nombreCompleto: 'Administración — Preparatoria Abierta Michoacán',
      puesto: 'Administrador(a) titular',
      esJefe: true,
      perfilConfirmado: false,
    });
    console.log(`\n👤 Admin creado: ${adminEmail} (titular)`);
  }

  await pool.end();
  console.log('\n✅ Seed mínimo de producción completado.');
}

main().catch((e) => {
  console.error('❌ Falló el seed:', e);
  process.exit(1);
});
