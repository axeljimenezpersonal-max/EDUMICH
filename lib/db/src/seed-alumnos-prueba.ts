/**
 * Seed de ALUMNOS DE PRUEBA para el gestor UTEC (Morelia).
 *
 * Crea 3 alumnos "completos" para demo: cuenta + ficha de estudiante con datos
 * llenos + expediente 5/5 APROBADO. Aparecen en "Mis alumnos" del gestor UTEC.
 *
 * Los documentos usan rutas PRUEBA-SIN-ARCHIVO/... (no hay archivo real detrás,
 * igual que los demás demos). NO crea inscripción ni pagos (eso se muestra en
 * vivo desde el panel). Idempotente: si el correo ya existe, lo salta.
 *
 *   SEED_CONFIRMO_NO_ES_PRODUCCION=si \
 *     pnpm --filter @workspace/db exec tsx src/seed-alumnos-prueba.ts
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { users, estudiantes, expedienteDocumentos, municipios } from './schema';

const ALUMNOS = [
  { email: 'ana.prueba@correo.mx',  nombres: 'Ana Sofía',     apPat: 'Ramírez',   apMat: 'Torres',  curp: 'RATA050312MMNMRN08', sexo: 'mujer',  nac: '2005-03-12', tel: '443-100-2001', calle: 'Av. Madero 120', col: 'Centro',       cp: '58000', ciudad: 'Morelia' },
  { email: 'luis.prueba@correo.mx', nombres: 'Luis Fernando', apPat: 'García',    apMat: 'Mendoza', curp: 'GAML040722HMNRND05', sexo: 'hombre', nac: '2004-07-22', tel: '443-100-2002', calle: 'Calle Nigromante 45', col: 'Chapultepec', cp: '58260', ciudad: 'Morelia' },
  { email: 'maria.prueba@correo.mx',nombres: 'María José',    apPat: 'Hernández', apMat: 'López',   curp: 'HELM060118MMNRPS03', sexo: 'mujer',  nac: '2006-01-18', tel: '443-100-2003', calle: 'Prol. Cuautla 300',  col: 'Félix Ireta',  cp: '58070', ciudad: 'Morelia' },
];

// Los 5 documentos obligatorios del expediente.
const DOCS = ['curp', 'acta_nacimiento', 'ine', 'comprobante_domicilio', 'certificado_secundaria'];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error('✋ No hay DATABASE_URL.'); process.exit(1); }
  if (process.env.SEED_CONFIRMO_NO_ES_PRODUCCION !== 'si') {
    console.error('✋ Confirma con SEED_CONFIRMO_NO_ES_PRODUCCION=si');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);

  // Gestor UTEC y municipio Morelia (deben existir del seed de pruebas).
  const [utec] = await db.select({ id: users.id }).from(users).where(eq(users.email, 'UTEC@gmail.com'));
  if (!utec) { console.error('✋ No existe el gestor UTEC@gmail.com. Corre primero el seed de pruebas.'); process.exit(1); }
  const [morelia] = await db.select({ id: municipios.id }).from(municipios).where(eq(municipios.nombre, 'Morelia'));
  if (!morelia) { console.error('✋ No existe el municipio Morelia.'); process.exit(1); }

  const passwordHash = await bcrypt.hash('demo1234', 10);
  const ahora = new Date();

  console.log('🌱 Creando 3 alumnos de prueba para el gestor UTEC (Morelia)\n');

  for (const a of ALUMNOS) {
    const [existe] = await db.select({ id: users.id }).from(users).where(eq(users.email, a.email));
    if (existe) { console.log(`   • ${a.email} ya existía (se salta)`); continue; }

    const nombreCompleto = `${a.nombres} ${a.apPat} ${a.apMat}`;
    const direccion = `${a.calle}, ${a.col}, ${a.ciudad}, Michoacán, C.P. ${a.cp}`;

    const [u] = await db
      .insert(users)
      .values({ email: a.email, passwordHash, rol: 'estudiante', activo: true, passwordTemporal: false, privacidadAceptadaEn: ahora })
      .returning({ id: users.id });

    await db.insert(estudiantes).values({
      userId: u.id,
      nombreCompleto,
      nombres: a.nombres,
      apellidoPaterno: a.apPat,
      apellidoMaterno: a.apMat,
      curp: a.curp,
      fechaNacimiento: a.nac,
      sexo: a.sexo,
      genero: a.sexo,
      telefono: a.tel,
      direccion,
      calleNumero: a.calle,
      colonia: a.col,
      cp: a.cp,
      ciudad: a.ciudad,
      estadoDomicilio: 'Michoacán',
      entidadNacimiento: 'Michoacán',
      lugarNacimiento: 'Morelia',
      nacionalidad: 'Mexicana',
      ultimoEstudio: 'Secundaria terminada',
      municipioId: morelia.id,
      gestorId: utec.id,
      emailVerificado: true,
      registroTipo: 'gestor',
    });

    // Expediente 5/5 APROBADO (sin archivo real, ruta de prueba).
    await db.insert(expedienteDocumentos).values(
      DOCS.map((tipo) => ({
        estudianteId: u.id,
        tipo,
        estado: 'aprobado' as const,
        rutaArchivo: `PRUEBA-SIN-ARCHIVO/${a.curp}/${tipo}.pdf`,
        nombreOriginal: `${tipo}.pdf`,
        subidoPorUserId: utec.id,
        revisadoPorUserId: utec.id,
        revisadoEn: ahora,
      })),
    );

    console.log(`   ✓ ${nombreCompleto} — expediente 5/5 aprobado`);
  }

  await pool.end();
  console.log('\n✅ Listo. Entra como UTEC y revisa "Mis alumnos".');
}

main().catch((e) => { console.error('❌ Falló:', e); process.exit(1); });
