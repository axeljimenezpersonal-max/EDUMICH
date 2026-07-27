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
import { eq, sql } from 'drizzle-orm';
import {
  users,
  administradores,
  municipios,
  modulos,
  conceptosPago,
  convocatoriasEtapas,
  plantillasCorreo,
} from './schema';
import { MUNICIPIOS_MICHOACAN } from './seed/municipios';
import { MODULOS_PREPA_ABIERTA } from './seed/modulos';
import { PLANTILLAS_CORREO } from './seed/plantillas';

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

  // ── Municipios (113) ──────────────────────────────────────────────────────
  for (const nombre of MUNICIPIOS_MICHOACAN) {
    await db.insert(municipios).values({ nombre, estado: 'Michoacán' }).onConflictDoNothing();
  }
  const munCount = await db.select({ c: sql<number>`count(*)` }).from(municipios);
  console.log(`📍 Municipios: ${munCount[0].c}`);

  // ── Módulos (22) ──────────────────────────────────────────────────────────
  for (const mod of MODULOS_PREPA_ABIERTA) {
    await db
      .insert(modulos)
      .values({ numero: mod.numero, nombre: mod.nombre, nivel: mod.nivel })
      .onConflictDoUpdate({ target: modulos.numero, set: { nombre: mod.nombre, nivel: mod.nivel } });
  }
  const modCount = await db.select({ c: sql<number>`count(*)` }).from(modulos);
  console.log(`📚 Módulos: ${modCount[0].c}`);

  // ── Conceptos de pago (tarifas 2026) ──────────────────────────────────────
  const concCount = await db.select({ c: sql<number>`count(*)` }).from(conceptosPago);
  if (Number(concCount[0].c) === 0) {
    await db.insert(conceptosPago).values([
      { clave: 'inscripcion_inicial', nombre: 'Inscripción inicial', descripcion: 'Derecho de inscripción al sistema Preparatoria Abierta', monto: '850.00', vigencia: 2026, activo: true },
      { clave: 'examen_modulo', nombre: 'Examen por módulo', descripcion: 'Derecho de examen por cada módulo ordinario', monto: '95.00', vigencia: 2026, activo: true },
      { clave: 'examen_extraordinario', nombre: 'Examen extraordinario', descripcion: 'Derecho de examen en convocatoria extraordinaria', monto: '95.00', vigencia: 2026, activo: true },
      { clave: 'reposicion_credencial', nombre: 'Reposición de credencial', descripcion: 'Reposición por extravío o deterioro', monto: '44.00', vigencia: 2026, activo: true },
      { clave: 'certificado_parcial', nombre: 'Certificado parcial', descripcion: 'Constancia de módulos aprobados', monto: '73.00', vigencia: 2026, activo: true },
      { clave: 'certificado_total', nombre: 'Certificado total', descripcion: 'Certificado de terminación de bachillerato', monto: '51.00', vigencia: 2026, activo: true },
      { clave: 'constancia_inscripcion', nombre: 'Constancia de inscripción', descripcion: 'Documento de vigencia de inscripción activa', monto: '0.00', vigencia: 2026, activo: true },
    ]);
    console.log('💵 Conceptos de pago: 7');
  } else {
    console.log(`💵 Conceptos de pago: ${concCount[0].c} (ya existían)`);
  }

  // ── Etapas DGB 2026 ───────────────────────────────────────────────────────
  const etapas2026 = [
    { clave: '2605-A', etapa: '2605', fase: 'A', solicitudInicio: '2026-04-13', solicitudFin: '2026-04-17', examenSabado: '2026-05-09', examenDomingo: '2026-05-10', anio: 2026, estado: 'inscripcion_cerrada' },
    { clave: '2605-B', etapa: '2605', fase: 'B', solicitudInicio: '2026-04-27', solicitudFin: '2026-04-30', examenSabado: '2026-05-23', examenDomingo: '2026-05-24', anio: 2026, estado: 'inscripcion_cerrada' },
    { clave: '2606-A', etapa: '2606', fase: 'A', solicitudInicio: '2026-05-11', solicitudFin: '2026-05-15', examenSabado: '2026-06-06', examenDomingo: '2026-06-07', anio: 2026, estado: 'inscripcion_abierta' },
    { clave: '2606-B', etapa: '2606', fase: 'B', solicitudInicio: '2026-05-25', solicitudFin: '2026-05-29', examenSabado: '2026-06-20', examenDomingo: '2026-06-21', anio: 2026, estado: 'programada' },
    { clave: '2607-A', etapa: '2607', fase: 'A', solicitudInicio: '2026-06-08', solicitudFin: '2026-06-12', examenSabado: '2026-07-04', examenDomingo: '2026-07-05', anio: 2026, estado: 'programada' },
    { clave: '2607-B', etapa: '2607', fase: 'B', solicitudInicio: '2026-06-22', solicitudFin: '2026-06-26', examenSabado: '2026-07-18', examenDomingo: '2026-07-19', anio: 2026, estado: 'programada' },
    { clave: '2608-A', etapa: '2608', fase: 'A', solicitudInicio: '2026-07-13', solicitudFin: '2026-07-17', examenSabado: '2026-08-08', examenDomingo: '2026-08-09', anio: 2026, estado: 'programada' },
    { clave: '2608-B', etapa: '2608', fase: 'B', solicitudInicio: '2026-07-27', solicitudFin: '2026-07-31', examenSabado: '2026-08-22', examenDomingo: '2026-08-23', anio: 2026, estado: 'programada' },
  ];
  for (const etapa of etapas2026) {
    await db.insert(convocatoriasEtapas).values(etapa).onConflictDoNothing();
  }
  const etCount = await db.select({ c: sql<number>`count(*)` }).from(convocatoriasEtapas);
  console.log(`📅 Etapas DGB: ${etCount[0].c}`);

  // ── Plantillas de correo (8) ──────────────────────────────────────────────
  const plCount = await db.select({ c: sql<number>`count(*)` }).from(plantillasCorreo);
  if (Number(plCount[0].c) === 0) {
    await db.insert(plantillasCorreo).values(PLANTILLAS_CORREO);
    console.log(`✉️  Plantillas de correo: ${PLANTILLAS_CORREO.length}`);
  } else {
    console.log(`✉️  Plantillas de correo: ${plCount[0].c} (ya existían)`);
  }

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
