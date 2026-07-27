/**
 * Seed de PRUEBAS para AWS (Opción B).
 *
 * Recrea el entorno de demo conocido en la RDS vacía, para poder mostrar la
 * plataforma HOY (sin esperar el respaldo de Neon del 1-ago, que luego lo
 * sobrescribe con los datos reales). Crea:
 *
 *   • Catálogos base (municipios, módulos, conceptos, etapas 2026, plantillas).
 *   • Las 4 cuentas de prueba conocidas, TODAS con contraseña `demo1234`:
 *       velia@gmail.com     → admin TITULAR (es_jefe = true)
 *       alex@gmail.com      → admin operativo (es_jefe = false)
 *       UTEC@gmail.com      → gestor · Morelia (centro UTEC)
 *       contacto@sinapsys.mx→ dirección (el creador, Synapsis)
 *
 * NO crea alumnos, pagos ni banco de preguntas (los quizzes saldrán vacíos).
 * Es idempotente y trae el candado SEED_CONFIRMO_NO_ES_PRODUCCION=si.
 *
 * ⚠️ demo1234 es SOLO para pruebas. Antes del arranque real hay que cambiar
 *    todas las contraseñas por unas seguras.
 *
 * ── Uso ─────────────────────────────────────────────────────────────────────
 *   SEED_CONFIRMO_NO_ES_PRODUCCION=si \
 *     pnpm --filter @workspace/db exec tsx src/seed-pruebas-aws.ts
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { users, administradores, gestores, directores, municipios } from './schema';
import { sembrarCatalogos } from './seed/catalogos';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('✋ No hay DATABASE_URL. Nada que sembrar.');
    process.exit(1);
  }
  if (process.env.SEED_CONFIRMO_NO_ES_PRODUCCION !== 'si') {
    console.error('✋ Este seed escribe en una base real. Confirma con SEED_CONFIRMO_NO_ES_PRODUCCION=si');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);

  console.log('🌱 Seed de PRUEBAS (AWS) — Preparatoria Abierta Michoacán\n');
  console.log(`   Destino: ${url.replace(/^.*@/, '').split(/[:/?]/)[0]}\n`);

  await sembrarCatalogos(db);

  const passwordHash = await bcrypt.hash('demo1234', 10);

  /** Crea una cuenta de usuario si no existe (idempotente). Devuelve el id. */
  async function crearUsuario(email: string, rol: 'admin' | 'gestor' | 'direccion'): Promise<number | null> {
    const [existe] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (existe) {
      console.log(`   • ${email} ya existía (no se toca)`);
      return null;
    }
    const [u] = await db
      .insert(users)
      .values({ email, passwordHash, rol, activo: true, passwordTemporal: false, privacidadAceptadaEn: new Date() })
      .returning({ id: users.id });
    return u.id;
  }

  console.log('\n👥 Cuentas de prueba (demo1234):');

  // velia — admin TITULAR
  const veliaId = await crearUsuario('velia@gmail.com', 'admin');
  if (veliaId) {
    await db.insert(administradores).values({
      userId: veliaId,
      nombreCompleto: 'Velia López',
      puesto: 'Administradora titular',
      esJefe: true,
      perfilConfirmado: true,
    });
    console.log('   ✓ velia@gmail.com — admin TITULAR');
  }

  // alex — admin operativo
  const alexId = await crearUsuario('alex@gmail.com', 'admin');
  if (alexId) {
    await db.insert(administradores).values({
      userId: alexId,
      nombreCompleto: 'Alex',
      puesto: 'Administrativo operativo',
      esJefe: false,
      perfilConfirmado: true,
    });
    console.log('   ✓ alex@gmail.com — admin operativo');
  }

  // UTEC — gestor de Morelia
  const utecId = await crearUsuario('UTEC@gmail.com', 'gestor');
  if (utecId) {
    const [morelia] = await db.select({ id: municipios.id }).from(municipios).where(eq(municipios.nombre, 'Morelia'));
    if (!morelia) throw new Error('No se encontró el municipio de Morelia (¿corrió el seed de catálogos?)');
    await db.insert(gestores).values({
      userId: utecId,
      nombreCompleto: 'Centro UTEC',
      emailPublico: 'UTEC@gmail.com',
      municipioId: morelia.id,
      centroAsesoria: 'UTEC',
    });
    console.log('   ✓ UTEC@gmail.com — gestor · Morelia');
  }

  // contacto@sinapsys.mx — dirección (creador)
  const creadorId = await crearUsuario('contacto@sinapsys.mx', 'direccion');
  if (creadorId) {
    await db.insert(directores).values({
      userId: creadorId,
      nombreCompleto: 'Dirección del Programa (Synapsis)',
      puesto: 'Dirección de Programa',
      emailPublico: 'contacto@sinapsys.mx',
    });
    console.log('   ✓ contacto@sinapsys.mx — dirección (creador)');
  }

  await pool.end();
  console.log('\n✅ Seed de pruebas completado. Entra con cualquiera de las 4 cuentas / demo1234.');
}

main().catch((e) => {
  console.error('❌ Falló el seed de pruebas:', e);
  process.exit(1);
});
