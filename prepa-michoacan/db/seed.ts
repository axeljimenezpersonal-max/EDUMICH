/**
 * Script de seed para la base de datos.
 * Crea: municipios, módulos, convocatoria activa, gestor demo de Pátzcuaro.
 *
 * Ejecutar con:
 *   pnpm --filter @workspace/db run seed
 *
 * Ubicación destino en Replit: lib/db/src/seed.ts
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import {
  municipios,
  modulos,
  users,
  gestores,
  administradores,
  convocatorias,
} from './schema';
import { MUNICIPIOS_MICHOACAN } from './seed/municipios';
import { MODULOS_PREPA_ABIERTA } from './seed/modulos';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  console.log('🌱 Iniciando seed de Prepa Abierta Michoacán...\n');

  // ── Municipios ─────────────────────────────────────────────────────
  console.log('📍 Sembrando municipios...');
  for (const nombre of MUNICIPIOS_MICHOACAN) {
    await db
      .insert(municipios)
      .values({ nombre, estado: 'Michoacán' })
      .onConflictDoNothing();
  }
  const munCount = await db.select({ c: sql<number>`count(*)` }).from(municipios);
  console.log(`   ✓ ${munCount[0].c} municipios en BD\n`);

  // ── Módulos ────────────────────────────────────────────────────────
  console.log('📚 Sembrando módulos del Plan Modular...');
  for (const mod of MODULOS_PREPA_ABIERTA) {
    await db
      .insert(modulos)
      .values({
        numero: mod.numero,
        nombre: mod.nombre,
        nivel: mod.nivel,
      })
      .onConflictDoNothing();
  }
  const modCount = await db.select({ c: sql<number>`count(*)` }).from(modulos);
  console.log(`   ✓ ${modCount[0].c} módulos en BD\n`);

  // ── Convocatoria activa ───────────────────────────────────────────
  console.log('📅 Creando convocatoria activa de demo...');
  const fechaApertura = new Date();
  const fechaCierre = new Date();
  fechaCierre.setDate(fechaCierre.getDate() + 30);
  const fechaExamen = new Date();
  fechaExamen.setDate(fechaExamen.getDate() + 60);

  const [conv] = await db
    .insert(convocatorias)
    .values({
      nombre: 'Convocatoria 2026-1',
      fechaApertura: fechaApertura.toISOString().slice(0, 10),
      fechaCierre: fechaCierre.toISOString().slice(0, 10),
      fechaExamen: fechaExamen.toISOString().slice(0, 10),
      estado: 'abierta',
    })
    .onConflictDoNothing()
    .returning();
  console.log(`   ✓ Convocatoria: ${conv?.nombre ?? '(ya existía)'}\n`);

  // ── Gestor demo de Pátzcuaro ──────────────────────────────────────
  console.log('👤 Creando gestor demo de Pátzcuaro...');
  const [patzcuaro] = await db
    .select()
    .from(municipios)
    .where(eq(municipios.nombre, 'Pátzcuaro'));

  if (!patzcuaro) {
    throw new Error('No se encontró el municipio de Pátzcuaro en la BD');
  }

  const passwordHash = await bcrypt.hash('demo1234', 10);

  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, 'gestor.patzcuaro@michoacan.gob.mx'));

  if (!existingUser) {
    const [user] = await db
      .insert(users)
      .values({
        email: 'gestor.patzcuaro@michoacan.gob.mx',
        passwordHash,
        rol: 'gestor',
        privacidadAceptadaEn: new Date(),
      })
      .returning();

    await db.insert(gestores).values({
      userId: user.id,
      nombreCompleto: 'María Elena Ramírez Soto',
      telefono: '434-100-0001',
      municipioId: patzcuaro.id,
    });
    console.log(`   ✓ Gestor: gestor.patzcuaro@michoacan.gob.mx / demo1234\n`);
  } else {
    console.log(`   ✓ Gestor ya existía: gestor.patzcuaro@michoacan.gob.mx\n`);
  }

  // ── Administrador demo ────────────────────────────────────────────
  console.log('👤 Creando administrador demo...');
  const [existingAdmin] = await db
    .select()
    .from(users)
    .where(eq(users.email, 'admin@michoacan.gob.mx'));

  if (!existingAdmin) {
    const [adminUser] = await db
      .insert(users)
      .values({
        email: 'admin@michoacan.gob.mx',
        passwordHash,
        rol: 'admin',
        privacidadAceptadaEn: new Date(),
      })
      .returning();

    await db.insert(administradores).values({
      userId: adminUser.id,
      nombreCompleto: 'Dirección de Prepa Abierta Michoacán',
      puesto: 'Director(a)',
    });
    console.log(`   ✓ Admin: admin@michoacan.gob.mx / demo1234\n`);
  } else {
    console.log(`   ✓ Admin ya existía: admin@michoacan.gob.mx\n`);
  }

  console.log('✅ Seed completado.\n');
  console.log('Credenciales de demo:');
  console.log('  Gestor: gestor.patzcuaro@michoacan.gob.mx / demo1234');
  console.log('  Admin:  admin@michoacan.gob.mx / demo1234\n');

  await pool.end();
}

main().catch((err) => {
  console.error('❌ Error en seed:', err);
  process.exit(1);
});
