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
  modulosUnidades,
  modulosTemas,
  modulosMateriales,
  users,
  gestores,
  estudiantes,
  administradores,
  convocatorias,
  avisos,
  sedes,
  convocatoriasEtapas,
  convocatoriasModulosHorarios,
  pagos,
  calificaciones,
  solicitudesCuenta,
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

  // ── Módulos (upsert para corregir nombres oficiales) ───────────────
  console.log('📚 Sembrando módulos del Plan Modular...');
  for (const mod of MODULOS_PREPA_ABIERTA) {
    await db
      .insert(modulos)
      .values({ numero: mod.numero, nombre: mod.nombre, nivel: mod.nivel })
      .onConflictDoUpdate({
        target: modulos.numero,
        set: { nombre: mod.nombre, nivel: mod.nivel },
      });
  }
  const modCount = await db.select({ c: sql<number>`count(*)` }).from(modulos);
  console.log(`   ✓ ${modCount[0].c} módulos en BD\n`);

  // ── Contenido del Módulo 1 ─────────────────────────────────────────
  console.log('📖 Sembrando contenido del Módulo 1...');
  const [mod1] = await db.select().from(modulos).where(eq(modulos.numero, 1));
  if (mod1) {
    const existingUnidades = await db
      .select({ id: modulosUnidades.id })
      .from(modulosUnidades)
      .where(eq(modulosUnidades.moduloId, mod1.id));

    if (existingUnidades.length === 0) {
      // ─ Unidad 1
      const [u1] = await db
        .insert(modulosUnidades)
        .values({
          moduloId: mod1.id,
          numero: 1,
          titulo: 'Aprender y lograr metas personales',
          proposito:
            'Conocer y estar consciente de los retos que representa estudiar el bachillerato en relación con tus metas personales y condiciones de vida actuales, y prepararte para enfrentarlos de la mejor manera.',
        })
        .returning();

      const u1Top = await db
        .insert(modulosTemas)
        .values([
          { unidadId: u1.id, parentId: null, orden: 1, titulo: 'El contrato como una herramienta de gestión' },
          { unidadId: u1.id, parentId: null, orden: 2, titulo: 'Metas personales' },
          { unidadId: u1.id, parentId: null, orden: 3, titulo: 'Las ocho etapas en el ciclo vital de todas las personas (Erikson)' },
          { unidadId: u1.id, parentId: null, orden: 4, titulo: 'Realización personal — Abraham Maslow' },
          { unidadId: u1.id, parentId: null, orden: 5, titulo: 'Organizadores gráficos' },
          { unidadId: u1.id, parentId: null, orden: 6, titulo: 'Inteligencias múltiples — Howard Gardner' },
          { unidadId: u1.id, parentId: null, orden: 7, titulo: 'El equipo de cómputo como un recurso para el aprendizaje' },
          { unidadId: u1.id, parentId: null, orden: 8, titulo: 'Hardware y software' },
        ])
        .returning();

      const erikson = u1Top.find((t) => t.orden === 3)!;
      const organizadores = u1Top.find((t) => t.orden === 5)!;

      await db.insert(modulosTemas).values([
        { unidadId: u1.id, parentId: erikson.id, orden: 1, titulo: 'Confianza básica vs. desconfianza' },
        { unidadId: u1.id, parentId: erikson.id, orden: 2, titulo: 'Autonomía vs. vergüenza y duda' },
        { unidadId: u1.id, parentId: erikson.id, orden: 3, titulo: 'Iniciativa vs. culpa' },
        { unidadId: u1.id, parentId: erikson.id, orden: 4, titulo: 'Búsqueda de identidad vs. difusión de la identidad' },
        { unidadId: u1.id, parentId: erikson.id, orden: 5, titulo: 'Intimidad vs. aislamiento' },
        { unidadId: u1.id, parentId: erikson.id, orden: 6, titulo: 'Generatividad vs. estancamiento' },
        { unidadId: u1.id, parentId: erikson.id, orden: 7, titulo: 'Integridad del yo vs. desesperación' },
      ]);

      await db.insert(modulosTemas).values([
        { unidadId: u1.id, parentId: organizadores.id, orden: 1, titulo: 'Línea del tiempo' },
        { unidadId: u1.id, parentId: organizadores.id, orden: 2, titulo: 'Mapa conceptual' },
        { unidadId: u1.id, parentId: organizadores.id, orden: 3, titulo: 'Mapa mental' },
        { unidadId: u1.id, parentId: organizadores.id, orden: 4, titulo: 'Cuadro comparativo' },
        { unidadId: u1.id, parentId: organizadores.id, orden: 5, titulo: 'Análisis contextual' },
      ]);

      // ─ Unidad 2
      const [u2] = await db
        .insert(modulosUnidades)
        .values({
          moduloId: mod1.id,
          numero: 2,
          titulo: 'Leer y escribir para aprender',
          proposito:
            'Conocer los diversos tipos de textos mediante técnicas para la comprensión y elaborar resúmenes a partir de la identificación y organización de las ideas principales.',
        })
        .returning();

      const u2Top = await db
        .insert(modulosTemas)
        .values([
          { unidadId: u2.id, parentId: null, orden: 1, titulo: 'Leer para aprender' },
          { unidadId: u2.id, parentId: null, orden: 2, titulo: 'Tipos de texto' },
          { unidadId: u2.id, parentId: null, orden: 3, titulo: 'Fichas de trabajo' },
          { unidadId: u2.id, parentId: null, orden: 4, titulo: 'El resumen' },
        ])
        .returning();

      const tiposTema = u2Top.find((t) => t.orden === 2)!;
      await db.insert(modulosTemas).values([
        { unidadId: u2.id, parentId: tiposTema.id, orden: 1, titulo: 'Narrativos' },
        { unidadId: u2.id, parentId: tiposTema.id, orden: 2, titulo: 'Expositivos' },
        { unidadId: u2.id, parentId: tiposTema.id, orden: 3, titulo: 'Descriptivos' },
        { unidadId: u2.id, parentId: tiposTema.id, orden: 4, titulo: 'Argumentativos' },
        { unidadId: u2.id, parentId: tiposTema.id, orden: 5, titulo: 'Periodísticos: la entrevista, el reportaje' },
      ]);

      // ─ Unidad 3
      const [u3] = await db
        .insert(modulosUnidades)
        .values({
          moduloId: mod1.id,
          numero: 3,
          titulo: 'Analizar y escribir para comunicar',
          proposito:
            'Producir comentarios y reseñas coherentes y cohesionados a partir de la lectura analítica y crítica de textos, y del uso de las TIC para una comunicación eficiente.',
        })
        .returning();

      const u3Top = await db
        .insert(modulosTemas)
        .values([
          { unidadId: u3.id, parentId: null, orden: 1, titulo: 'Leer diferentes textos: estrategia para comparar' },
          { unidadId: u3.id, parentId: null, orden: 2, titulo: 'El comentario' },
          { unidadId: u3.id, parentId: null, orden: 3, titulo: 'La reseña — elementos estructurales' },
        ])
        .returning();

      const resenyaTema = u3Top.find((t) => t.orden === 3)!;
      await db.insert(modulosTemas).values([
        { unidadId: u3.id, parentId: resenyaTema.id, orden: 1, titulo: 'Resumen o sinopsis' },
        { unidadId: u3.id, parentId: resenyaTema.id, orden: 2, titulo: 'Crítica' },
      ]);

      // ─ Material
      await db.insert(modulosMateriales).values({
        moduloId: mod1.id,
        tipo: 'temario',
        nombre: 'Temario oficial — Módulo 1',
        rutaArchivo: '/materiales/modulo-01/temario.pdf',
      });

      console.log('   ✓ Contenido del Módulo 1 sembrado\n');
    } else {
      console.log('   ✓ Contenido del Módulo 1 ya existía\n');
    }
  }

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
      emailPublico: 'gestor.patzcuaro@michoacan.gob.mx',
      telefonoPublico: '434-100-0001',
      municipioId: patzcuaro.id,
    });
    console.log(`   ✓ Gestor: gestor.patzcuaro@michoacan.gob.mx / demo1234\n`);
  } else {
    console.log(`   ✓ Gestor ya existía: gestor.patzcuaro@michoacan.gob.mx\n`);
  }

  // ── Estudiante demo ───────────────────────────────────────────────
  console.log('👤 Creando estudiante demo...');
  const [existingEstudiante] = await db
    .select()
    .from(users)
    .where(eq(users.email, 'alumna.demo@correo.mx'));

  if (!existingEstudiante) {
    const [estUser] = await db
      .insert(users)
      .values({
        email: 'alumna.demo@correo.mx',
        passwordHash,
        rol: 'estudiante',
        passwordTemporal: false,
        privacidadAceptadaEn: new Date(),
      })
      .returning();

    const [gestorUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'gestor.patzcuaro@michoacan.gob.mx'));

    await db.insert(estudiantes).values({
      userId: estUser.id,
      nombreCompleto: 'María Fernanda López Rojas',
      curp: 'LORM950314MMCPJR08',
      fechaNacimiento: '1995-03-14',
      telefono: '443-555-0001',
      municipioId: patzcuaro?.id ?? primerMun.id,
      gestorId: gestorUser?.id ?? null,
      emailVerificado: true,
      registroTipo: 'gestor',
    });
    console.log(`   ✓ Estudiante: alumna.demo@correo.mx / demo1234\n`);
  } else {
    console.log(`   ✓ Estudiante ya existía: alumna.demo@correo.mx\n`);
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
      emailPublico: 'contacto@michoacan.gob.mx',
      telefonoPublico: '443-322-9250',
    });
    console.log(`   ✓ Admin: admin@michoacan.gob.mx / demo1234\n`);
  } else {
    console.log(`   ✓ Admin ya existía: admin@michoacan.gob.mx\n`);
  }

  // ── Avisos seed ───────────────────────────────────────────────────
  console.log('📣 Sembrando avisos...');
  const [adminForAvisos] = await db
    .select()
    .from(users)
    .where(eq(users.email, 'admin@michoacan.gob.mx'));

  if (adminForAvisos) {
    const avisosData = [
      {
        titulo: 'Bienvenido al Sistema Prepa Abierta',
        contenido:
          'Te damos la bienvenida al Sistema de Gestión de Prepa Abierta Michoacán. ' +
          'Aquí podrás consultar el estado de tu inscripción, revisar los avisos de la institución ' +
          'y estar al tanto de los próximos pasos en tu proceso de registro. ' +
          'Cualquier duda, contacta a tu gestor municipal asignado.',
        prioridad: 'informativo' as const,
        publicadoPorUserId: adminForAvisos.id,
      },
      {
        titulo: 'Recordatorio: examen de la Convocatoria 2026-1',
        contenido:
          'El examen de la Convocatoria 2026-1 está programado. ' +
          'Asegúrate de tener todos tus documentos al día y en estado "Aprobado" antes de la fecha límite. ' +
          'Recuerda llevar tu identificación oficial el día del examen. ' +
          'Consulta la sección "Mi convocatoria" para conocer tu sede y horario asignados.',
        prioridad: 'importante' as const,
        publicadoPorUserId: adminForAvisos.id,
      },
      {
        titulo: 'Nuevo material de estudio disponible',
        contenido:
          'Ya está disponible el material de apoyo para los 21 módulos del Plan Modular. ' +
          'Ingresa a la sección "Mis módulos" para acceder a las guías de estudio, ' +
          'resúmenes temáticos y ejercicios de práctica de cada unidad. ' +
          'El material está organizado por nivel y módulo para facilitar tu preparación.',
        prioridad: 'informativo' as const,
        publicadoPorUserId: adminForAvisos.id,
      },
    ];

    for (const aviso of avisosData) {
      await db.insert(avisos).values(aviso).onConflictDoNothing();
    }
    const avisosCount = await db.select({ c: sql<number>`count(*)` }).from(avisos);
    console.log(`   ✓ ${avisosCount[0].c} avisos en BD\n`);
  }

  // ── Sedes ─────────────────────────────────────────────────────────────
  console.log('🏢 Sembrando sedes...');
  const [morelia] = await db.select().from(municipios).where(eq(municipios.nombre, 'Morelia'));
  const [patzcuaroMun] = await db.select().from(municipios).where(eq(municipios.nombre, 'Pátzcuaro'));
  const [uruapan] = await db.select().from(municipios).where(eq(municipios.nombre, 'Uruapan'));
  const [primerMun] = await db.select().from(municipios).limit(1);

  const sedesData = [
    {
      nombre: 'Centro de Servicios Morelia',
      direccion: 'Av. Madero Pte. 1234, Centro, Morelia',
      municipioId: morelia?.id ?? primerMun.id,
      telefono: '443-322-9876',
      latitud: '19.7060',
      longitud: '-101.1950',
    },
    {
      nombre: 'Centro de Servicios Pátzcuaro',
      direccion: 'Calle Quiroga 45, Centro, Pátzcuaro',
      municipioId: patzcuaroMun?.id ?? primerMun.id,
      telefono: null,
      latitud: null,
      longitud: null,
    },
    {
      nombre: 'Centro de Servicios Uruapan',
      direccion: 'Av. Cupatitzio 89, Uruapan',
      municipioId: uruapan?.id ?? primerMun.id,
      telefono: null,
      latitud: null,
      longitud: null,
    },
  ];

  for (const sede of sedesData) {
    await db.insert(sedes).values(sede).onConflictDoNothing();
  }
  const sedesCount = await db.select({ c: sql<number>`count(*)` }).from(sedes);
  console.log(`   ✓ ${sedesCount[0].c} sedes en BD\n`);

  // ── Etapas DGB 2026 ────────────────────────────────────────────────────
  console.log('📅 Sembrando etapas DGB 2026...');
  const etapasData = [
    { clave: '2605-A', etapa: '2605', fase: 'A', solicitudInicio: '2026-04-13', solicitudFin: '2026-04-17', examenSabado: '2026-05-09', examenDomingo: '2026-05-10', anio: 2026, estado: 'inscripcion_cerrada' },
    { clave: '2605-B', etapa: '2605', fase: 'B', solicitudInicio: '2026-04-27', solicitudFin: '2026-04-30', examenSabado: '2026-05-23', examenDomingo: '2026-05-24', anio: 2026, estado: 'inscripcion_cerrada' },
    { clave: '2606-A', etapa: '2606', fase: 'A', solicitudInicio: '2026-05-11', solicitudFin: '2026-05-15', examenSabado: '2026-06-06', examenDomingo: '2026-06-07', anio: 2026, estado: 'inscripcion_abierta' },
    { clave: '2606-B', etapa: '2606', fase: 'B', solicitudInicio: '2026-05-25', solicitudFin: '2026-05-29', examenSabado: '2026-06-20', examenDomingo: '2026-06-21', anio: 2026, estado: 'programada' },
    { clave: '2607-A', etapa: '2607', fase: 'A', solicitudInicio: '2026-06-08', solicitudFin: '2026-06-12', examenSabado: '2026-07-04', examenDomingo: '2026-07-05', anio: 2026, estado: 'programada' },
    { clave: '2607-B', etapa: '2607', fase: 'B', solicitudInicio: '2026-06-22', solicitudFin: '2026-06-26', examenSabado: '2026-07-18', examenDomingo: '2026-07-19', anio: 2026, estado: 'programada' },
    { clave: '2608-A', etapa: '2608', fase: 'A', solicitudInicio: '2026-07-13', solicitudFin: '2026-07-17', examenSabado: '2026-08-08', examenDomingo: '2026-08-09', anio: 2026, estado: 'programada' },
    { clave: '2608-B', etapa: '2608', fase: 'B', solicitudInicio: '2026-07-27', solicitudFin: '2026-07-31', examenSabado: '2026-08-22', examenDomingo: '2026-08-23', anio: 2026, estado: 'programada' },
  ];

  for (const etapa of etapasData) {
    await db.insert(convocatoriasEtapas).values(etapa).onConflictDoNothing();
  }
  const etapasCount = await db.select({ c: sql<number>`count(*)` }).from(convocatoriasEtapas);
  console.log(`   ✓ ${etapasCount[0].c} etapas en BD\n`);

  // ── Horarios de módulos por etapa ──────────────────────────────────────
  console.log('🕐 Sembrando horarios de módulos...');

  // Distribution: number → { dia, hora }
  const horariosPorNumero: Record<number, { dia: string; hora: string }> = {};
  for (const n of [4, 8, 9, 13, 19]) horariosPorNumero[n] = { dia: 'sabado', hora: '09:00' };
  for (const n of [2, 6, 11, 14, 17]) horariosPorNumero[n] = { dia: 'sabado', hora: '11:00' };
  for (const n of [1, 3, 7, 10, 16, 21]) horariosPorNumero[n] = { dia: 'domingo', hora: '09:00' };
  for (const n of [5, 12, 15, 18, 20]) horariosPorNumero[n] = { dia: 'domingo', hora: '11:00' };

  const allModulos = await db.select({ id: modulos.id, numero: modulos.numero }).from(modulos);
  const allEtapas = await db.select({ id: convocatoriasEtapas.id }).from(convocatoriasEtapas);

  let horariosInserted = 0;
  for (const etapa of allEtapas) {
    for (const mod of allModulos) {
      const horario = horariosPorNumero[mod.numero];
      if (!horario) continue;
      const result = await db
        .insert(convocatoriasModulosHorarios)
        .values({ etapaId: etapa.id, moduloId: mod.id, dia: horario.dia, hora: horario.hora })
        .onConflictDoNothing()
        .returning({ id: convocatoriasModulosHorarios.id });
      if (result.length > 0) horariosInserted++;
    }
  }
  const horariosCount = await db.select({ c: sql<number>`count(*)` }).from(convocatoriasModulosHorarios);
  console.log(`   ✓ ${horariosCount[0].c} horarios en BD (${horariosInserted} nuevos)\n`);

  // ── Pagos y Calificaciones demo ────────────────────────────────────────
  console.log('💳 Sembrando pagos y calificaciones demo...');

  const [adminUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, 'admin@michoacan.gob.mx'));

  const demoStudents = await db.select().from(estudiantes).limit(2);

  if (adminUser && demoStudents.length > 0) {
    // Find modules for calificaciones
    const [mod1Cal] = await db.select().from(modulos).where(eq(modulos.numero, 1));
    const [mod2Cal] = await db.select().from(modulos).where(eq(modulos.numero, 2));
    const [mod4Cal] = await db.select().from(modulos).where(eq(modulos.numero, 4));

    for (const student of demoStudents) {
      // ── Pagos ──────────────────────────────────────────────────────
      const existingPagos = await db
        .select({ c: sql<number>`count(*)` })
        .from(pagos)
        .where(eq(pagos.estudianteId, student.userId));

      if (Number(existingPagos[0].c) === 0) {
        await db.insert(pagos).values([
          {
            estudianteId: student.userId,
            concepto: 'derecho_examen',
            conceptoDetalle: 'Convocatoria 2026-1',
            monto: '340.00',
            moneda: 'MXN',
            fechaPago: '2026-05-02',
            metodoPago: 'spei',
            referenciaBancaria: 'SPEI-7745829301',
            rutaComprobante: '/tmp/prepa-storage/demo-comprobante.pdf',
            estado: 'verificado',
            subidoPorUserId: adminUser.id,
            verificadoPorUserId: adminUser.id,
            verificadoEn: new Date(),
          },
          {
            estudianteId: student.userId,
            concepto: 'examen_extraordinario',
            conceptoDetalle: 'Módulo 5',
            monto: '340.00',
            moneda: 'MXN',
            fechaPago: '2026-05-04',
            metodoPago: 'efectivo',
            rutaComprobante: '/tmp/prepa-storage/demo-comprobante.pdf',
            estado: 'pendiente',
            subidoPorUserId: adminUser.id,
          },
        ]);
        console.log(`   ✓ 2 pagos insertados para estudiante ${student.userId}`);
      } else {
        console.log(`   ✓ Pagos ya existían para estudiante ${student.userId}`);
      }

      // ── Calificaciones ──────────────────────────────────────────────
      const existingCalifs = await db
        .select({ c: sql<number>`count(*)` })
        .from(calificaciones)
        .where(eq(calificaciones.estudianteId, student.userId));

      if (Number(existingCalifs[0].c) === 0) {
        const califsToInsert = [];

        if (mod1Cal) {
          califsToInsert.push({
            estudianteId: student.userId,
            moduloId: mod1Cal.id,
            etapaClave: '2606-A',
            calificacion: 88,
            aprobado: true,
            intento: 1,
            fechaExamen: '2026-06-12',
            capturadoPorUserId: adminUser.id,
          });
        }
        if (mod4Cal) {
          califsToInsert.push({
            estudianteId: student.userId,
            moduloId: mod4Cal.id,
            etapaClave: '2606-A',
            calificacion: 92,
            aprobado: true,
            intento: 1,
            fechaExamen: '2026-06-12',
            capturadoPorUserId: adminUser.id,
          });
        }
        if (mod2Cal) {
          califsToInsert.push({
            estudianteId: student.userId,
            moduloId: mod2Cal.id,
            etapaClave: '2605-A',
            calificacion: 58,
            aprobado: false,
            intento: 1,
            fechaExamen: '2026-05-14',
            capturadoPorUserId: adminUser.id,
          });
          califsToInsert.push({
            estudianteId: student.userId,
            moduloId: mod2Cal.id,
            etapaClave: '2605-B',
            calificacion: 75,
            aprobado: true,
            intento: 2,
            fechaExamen: '2026-05-28',
            capturadoPorUserId: adminUser.id,
          });
        }

        if (califsToInsert.length > 0) {
          await db.insert(calificaciones).values(califsToInsert).onConflictDoNothing();
          console.log(`   ✓ ${califsToInsert.length} calificaciones insertadas para estudiante ${student.userId}`);
        }
      } else {
        console.log(`   ✓ Calificaciones ya existían para estudiante ${student.userId}`);
      }
    }
  } else {
    console.log('   ⚠ No hay admin o estudiantes demo, omitiendo pagos/calificaciones');
  }

  // ── Solicitudes de Cuenta seed ─────────────────────────────────────────────
  console.log('📋 Sembrando solicitudes de cuenta...');

  const [adminUserSol] = await db
    .select()
    .from(users)
    .where(eq(users.email, 'admin@michoacan.gob.mx'));

  const existingSolicitudes = await db
    .select({ c: sql<number>`count(*)` })
    .from(solicitudesCuenta);

  if (Number(existingSolicitudes[0].c) === 0 && adminUserSol) {
    // Fetch municipios needed for seed
    const [moreliaMun] = await db.select().from(municipios).where(eq(municipios.nombre, 'Morelia'));
    const [patzcuaroMunSol] = await db.select().from(municipios).where(eq(municipios.nombre, 'Pátzcuaro'));
    const [uruapanMun] = await db.select().from(municipios).where(eq(municipios.nombre, 'Uruapan'));
    const [zamoraMun] = await db.select().from(municipios).where(eq(municipios.nombre, 'Zamora'));
    const [zitacuaroMun] = await db.select().from(municipios).where(eq(municipios.nombre, 'Zitácuaro'));
    const [laPiedadMun] = await db.select().from(municipios).where(eq(municipios.nombre, 'La Piedad'));
    const fallbackMun = moreliaMun ?? patzcuaroMunSol ?? { id: 1 };

    const morId = moreliaMun?.id ?? fallbackMun.id;
    const patId = patzcuaroMunSol?.id ?? fallbackMun.id;
    const uruId = uruapanMun?.id ?? fallbackMun.id;
    const zamId = zamoraMun?.id ?? fallbackMun.id;
    const zitId = zitacuaroMun?.id ?? fallbackMun.id;
    const lapId = laPiedadMun?.id ?? fallbackMun.id;

    // Helper: date offset from now
    const daysAgo = (n: number) => {
      const d = new Date();
      d.setDate(d.getDate() - n);
      return d;
    };

    // 8 pendientes — varied urgency
    // >7 días (alta): 3 solicitudes
    await db.insert(solicitudesCuenta).values({
      folio: 'SOL-0001',
      nombreCompleto: 'Jorge Alfredo Ávila Mendoza',
      curp: 'AVMJ850312HMNVNR06',
      fechaNacimiento: '1985-03-12',
      email: 'jorge.avila.demo@correo.mx',
      telefono: '443-100-1001',
      municipioId: morId,
      mensaje: 'Trabajé hasta el tercer año de preparatoria hace varios años y necesito concluirla para mejorar mis oportunidades de trabajo.',
      ultimoNivelCursado: '3er semestre',
      anioUltimoNivel: 2003,
      justificacion: 'Trabajé hasta el tercer año de preparatoria hace varios años y necesito concluirla para mejorar mis oportunidades de trabajo.',
      modalidadPreferida: 'con_gestor',
      disponibilidad: 'fines_de_semana',
      estado: 'pendiente',
      createdAt: daysAgo(10),
    });

    await db.insert(solicitudesCuenta).values({
      folio: 'SOL-0002',
      nombreCompleto: 'Leticia Guadalupe Torres Herrera',
      curp: 'TOHL920715MMCRRR09',
      fechaNacimiento: '1992-07-15',
      email: 'leticia.torres.demo@correo.mx',
      telefono: '452-100-2002',
      municipioId: patId,
      mensaje: 'Madre soltera que desea terminar sus estudios de bachillerato para dar un mejor ejemplo a sus hijos y acceder a mejores empleos.',
      ultimoNivelCursado: '2do semestre',
      anioUltimoNivel: 2010,
      justificacion: 'Madre soltera que desea terminar sus estudios de bachillerato para dar un mejor ejemplo a sus hijos y acceder a mejores empleos.',
      modalidadPreferida: 'con_gestor',
      disponibilidad: 'sabados',
      estado: 'pendiente',
      createdAt: daysAgo(9),
    });

    await db.insert(solicitudesCuenta).values({
      folio: 'SOL-0003',
      nombreCompleto: 'Ramón Eduardo Castillo Vega',
      curp: 'CAVR780901HMNSRM05',
      fechaNacimiento: '1978-09-01',
      email: 'ramon.castillo.demo@correo.mx',
      telefono: '443-100-3003',
      municipioId: morId,
      mensaje: 'Deseo obtener mi certificado de bachillerato para continuar mis estudios de licenciatura en administración.',
      ultimoNivelCursado: '4to semestre',
      anioUltimoNivel: 1998,
      justificacion: 'Deseo obtener mi certificado de bachillerato para continuar mis estudios de licenciatura en administración.',
      modalidadPreferida: 'auto_gestion',
      disponibilidad: 'entre_semana_tarde',
      estado: 'pendiente',
      createdAt: daysAgo(8),
    });

    // 3–7 días (media): 3 solicitudes
    await db.insert(solicitudesCuenta).values({
      folio: 'SOL-0004',
      nombreCompleto: 'Gabriela Sánchez Luna',
      curp: 'SALG960420MMCNNB07',
      fechaNacimiento: '1996-04-20',
      email: 'gabriela.sanchez.demo@correo.mx',
      telefono: '352-100-4004',
      municipioId: uruId,
      mensaje: 'Interrumpí mis estudios por motivos económicos; ahora tengo estabilidad y deseo concluir el bachillerato.',
      ultimoNivelCursado: '5to semestre',
      anioUltimoNivel: 2015,
      justificacion: 'Interrumpí mis estudios por motivos económicos; ahora tengo estabilidad y deseo concluir el bachillerato.',
      modalidadPreferida: 'con_gestor',
      disponibilidad: 'domingos',
      estado: 'pendiente',
      createdAt: daysAgo(5),
    });

    await db.insert(solicitudesCuenta).values({
      folio: 'SOL-0005',
      nombreCompleto: 'Miguel Ángel Reyes Padilla',
      curp: 'REPM000610HMNYNG09',
      fechaNacimiento: '2000-06-10',
      email: 'miguel.reyes.demo@correo.mx',
      telefono: '351-100-5005',
      municipioId: zamId,
      mensaje: 'Joven trabajador que necesita el bachillerato para ingresar al ejército o a la policía federal.',
      ultimoNivelCursado: '1er semestre',
      anioUltimoNivel: 2018,
      justificacion: 'Joven trabajador que necesita el bachillerato para ingresar al ejército o a la policía federal.',
      modalidadPreferida: 'auto_gestion',
      disponibilidad: 'fines_de_semana',
      estado: 'pendiente',
      createdAt: daysAgo(4),
    });

    await db.insert(solicitudesCuenta).values({
      folio: 'SOL-0006',
      nombreCompleto: 'Esperanza Díaz Fuentes',
      curp: 'DIFE830214MMNZRP02',
      fechaNacimiento: '1983-02-14',
      email: 'esperanza.diaz.demo@correo.mx',
      telefono: '715-100-6006',
      municipioId: zitId,
      mensaje: 'Ama de casa que busca superarse y ser un modelo de vida para sus hijos adolescentes.',
      ultimoNivelCursado: '2do semestre',
      anioUltimoNivel: 2001,
      justificacion: 'Ama de casa que busca superarse y ser un modelo de vida para sus hijos adolescentes.',
      modalidadPreferida: 'con_gestor',
      disponibilidad: 'sabados',
      estado: 'pendiente',
      createdAt: daysAgo(3),
    });

    // <3 días (baja): 2 solicitudes
    await db.insert(solicitudesCuenta).values({
      folio: 'SOL-0007',
      nombreCompleto: 'Carlos Iván Morales Jiménez',
      curp: 'MOJC011127HMNRRL04',
      fechaNacimiento: '2001-11-27',
      email: 'carlos.morales.demo@correo.mx',
      telefono: '443-100-7007',
      municipioId: morId,
      mensaje: 'Emprendedor joven que necesita el certificado para tramitar apoyos gubernamentales.',
      ultimoNivelCursado: '3er semestre',
      anioUltimoNivel: 2020,
      justificacion: 'Emprendedor joven que necesita el certificado para tramitar apoyos gubernamentales.',
      modalidadPreferida: 'auto_gestion',
      disponibilidad: 'entre_semana_manana',
      estado: 'pendiente',
      createdAt: daysAgo(1),
    });

    await db.insert(solicitudesCuenta).values({
      folio: 'SOL-0008',
      nombreCompleto: 'Adriana Pérez Villanueva',
      curp: 'PEVA990308MMCRRDR01',
      fechaNacimiento: '1999-03-08',
      email: 'adriana.perez.demo@correo.mx',
      telefono: '352-100-8008',
      municipioId: lapId,
      mensaje: 'Recién llegué a la ciudad y quiero reanudar mis estudios de preparatoria que dejé inconclusos.',
      ultimoNivelCursado: '4to semestre',
      anioUltimoNivel: 2017,
      justificacion: 'Recién llegué a la ciudad y quiero reanudar mis estudios de preparatoria que dejé inconclusos.',
      modalidadPreferida: 'con_gestor',
      disponibilidad: 'fines_de_semana',
      estado: 'pendiente',
      createdAt: daysAgo(0),
    });

    // 5 aprobadas
    await db.insert(solicitudesCuenta).values({
      folio: 'SOL-0009',
      nombreCompleto: 'Fernando Ruiz Elizondo',
      curp: 'RUEF880625HMNLZR03',
      fechaNacimiento: '1988-06-25',
      email: 'fernando.ruiz.demo@correo.mx',
      telefono: '443-200-9009',
      municipioId: morId,
      mensaje: 'Solicito cuenta para iniciar mis estudios de bachillerato en la modalidad abierta.',
      ultimoNivelCursado: '3er semestre',
      anioUltimoNivel: 2006,
      justificacion: 'Solicito cuenta para iniciar mis estudios de bachillerato en la modalidad abierta.',
      modalidadPreferida: 'con_gestor',
      disponibilidad: 'sabados',
      estado: 'aprobada',
      procesadaPorUserId: adminUserSol.id,
      procesadaEn: daysAgo(2),
      comentarioAdmin: 'Documentos verificados. Cuenta creada exitosamente.',
      createdAt: daysAgo(7),
    });

    await db.insert(solicitudesCuenta).values({
      folio: 'SOL-0010',
      nombreCompleto: 'Patricia Nava Guzmán',
      curp: 'NAGP910830MMCVZT08',
      fechaNacimiento: '1991-08-30',
      email: 'patricia.nava.demo@correo.mx',
      telefono: '452-200-1010',
      municipioId: patId,
      mensaje: 'Maestra de preescolar que desea tener el bachillerato oficial para consolidar su posición laboral.',
      ultimoNivelCursado: '6to semestre',
      anioUltimoNivel: 2009,
      justificacion: 'Maestra de preescolar que desea tener el bachillerato oficial para consolidar su posición laboral.',
      modalidadPreferida: 'auto_gestion',
      disponibilidad: 'fines_de_semana',
      estado: 'aprobada',
      procesadaPorUserId: adminUserSol.id,
      procesadaEn: daysAgo(3),
      comentarioAdmin: 'Aprobada. Expediente completo.',
      createdAt: daysAgo(10),
    });

    await db.insert(solicitudesCuenta).values({
      folio: 'SOL-0011',
      nombreCompleto: 'Juan Pablo Herrera Ochoa',
      curp: 'HEOJ870414HMNRCH05',
      fechaNacimiento: '1987-04-14',
      email: 'juanpablo.herrera.demo@correo.mx',
      telefono: '352-200-1011',
      municipioId: uruId,
      mensaje: 'Técnico electricista que busca el bachillerato para acceder a estudios de ingeniería.',
      ultimoNivelCursado: '2do semestre',
      anioUltimoNivel: 2004,
      justificacion: 'Técnico electricista que busca el bachillerato para acceder a estudios de ingeniería.',
      modalidadPreferida: 'con_gestor',
      disponibilidad: 'domingos',
      estado: 'aprobada',
      procesadaPorUserId: adminUserSol.id,
      procesadaEn: daysAgo(5),
      comentarioAdmin: 'Aceptada. Cuenta generada y correo enviado.',
      createdAt: daysAgo(15),
    });

    await db.insert(solicitudesCuenta).values({
      folio: 'SOL-0012',
      nombreCompleto: 'Silvia Margarita Lozano Campos',
      curp: 'LOCS930102MMCZNL04',
      fechaNacimiento: '1993-01-02',
      email: 'silvia.lozano.demo@correo.mx',
      telefono: '351-200-1012',
      municipioId: zamId,
      mensaje: 'Deseo obtener el certificado de bachillerato para poder cursar la licenciatura en enfermería.',
      ultimoNivelCursado: '4to semestre',
      anioUltimoNivel: 2011,
      justificacion: 'Deseo obtener el certificado de bachillerato para poder cursar la licenciatura en enfermería.',
      modalidadPreferida: 'con_gestor',
      disponibilidad: 'sabados',
      estado: 'aprobada',
      procesadaPorUserId: adminUserSol.id,
      procesadaEn: daysAgo(7),
      comentarioAdmin: 'Documentación en orden. Aprobada.',
      createdAt: daysAgo(20),
    });

    await db.insert(solicitudesCuenta).values({
      folio: 'SOL-0013',
      nombreCompleto: 'Roberto Armando Cisneros Bravo',
      curp: 'CIBR750519HMNSNB07',
      fechaNacimiento: '1975-05-19',
      email: 'roberto.cisneros.demo@correo.mx',
      telefono: '715-200-1013',
      municipioId: zitId,
      mensaje: 'Agricultor que desea estudiar para mejorar las técnicas de producción en su comunidad.',
      ultimoNivelCursado: '1er semestre',
      anioUltimoNivel: 1992,
      justificacion: 'Agricultor que desea estudiar para mejorar las técnicas de producción en su comunidad.',
      modalidadPreferida: 'con_gestor',
      disponibilidad: 'fines_de_semana',
      estado: 'aprobada',
      procesadaPorUserId: adminUserSol.id,
      procesadaEn: daysAgo(10),
      comentarioAdmin: 'Caso especial. Aprobado con seguimiento.',
      createdAt: daysAgo(25),
    });

    // 3 rechazadas
    await db.insert(solicitudesCuenta).values({
      folio: 'SOL-0014',
      nombreCompleto: 'Héctor Manuel Vargas Torres',
      curp: 'VATH990901HMNNRC03',
      fechaNacimiento: '1999-09-01',
      email: 'hector.vargas.demo@correo.mx',
      telefono: '443-300-1014',
      municipioId: morId,
      mensaje: 'Quiero inscribirme al sistema de prepa abierta.',
      ultimoNivelCursado: null,
      anioUltimoNivel: null,
      justificacion: 'Quiero inscribirme al sistema de prepa abierta.',
      modalidadPreferida: 'auto_gestion',
      disponibilidad: null,
      estado: 'rechazada',
      procesadaPorUserId: adminUserSol.id,
      procesadaEn: daysAgo(4),
      motivoRechazo: 'informacion_incompleta',
      detallesRechazo: 'La solicitud no incluye información sobre el último nivel cursado ni justificación suficiente. Se invita al solicitante a reenviar la solicitud con los datos completos.',
      notasInternas: 'Contactar por teléfono para orientación.',
      comentarioAdmin: 'informacion_incompleta',
      createdAt: daysAgo(12),
    });

    await db.insert(solicitudesCuenta).values({
      folio: 'SOL-0015',
      nombreCompleto: 'Ana Lucía Campos Reséndiz',
      curp: 'CARA010415MMCMPN05',
      fechaNacimiento: '2001-04-15',
      email: 'ana.campos.demo@correo.mx',
      telefono: '452-300-1015',
      municipioId: patId,
      mensaje: 'Solicito cuenta para la plataforma.',
      ultimoNivelCursado: '3er semestre',
      anioUltimoNivel: 2019,
      justificacion: 'Solicito cuenta para la plataforma.',
      modalidadPreferida: 'con_gestor',
      disponibilidad: 'sabados',
      estado: 'rechazada',
      procesadaPorUserId: adminUserSol.id,
      procesadaEn: daysAgo(6),
      motivoRechazo: 'curp_no_valido',
      detallesRechazo: 'La CURP proporcionada no pudo ser verificada con el RENAPO. Favor de verificar los datos e intentar de nuevo.',
      notasInternas: 'CURP reportada como inválida en la verificación del sistema.',
      comentarioAdmin: 'curp_no_valido',
      createdAt: daysAgo(18),
    });

    await db.insert(solicitudesCuenta).values({
      folio: 'SOL-0016',
      nombreCompleto: 'Javier Inocencio Bravo Pineda',
      curp: 'BAPJ820602HMNRVV01',
      fechaNacimiento: '1982-06-02',
      email: 'javier.bravo.demo@correo.mx',
      telefono: '352-300-1016',
      municipioId: uruId,
      mensaje: 'Deseo ingresar a la prepa abierta. Ya estudié la preparatoria completa en Jalisco pero perdí el certificado.',
      ultimoNivelCursado: '6to semestre',
      anioUltimoNivel: 2001,
      justificacion: 'Deseo ingresar a la prepa abierta. Ya estudié la preparatoria completa en Jalisco pero perdí el certificado.',
      modalidadPreferida: 'auto_gestion',
      disponibilidad: 'entre_semana_manana',
      estado: 'rechazada',
      procesadaPorUserId: adminUserSol.id,
      procesadaEn: daysAgo(8),
      motivoRechazo: 'ya_cuenta_bachillerato',
      detallesRechazo: 'El solicitante menciona haber concluido el bachillerato previamente. Se orienta a tramitar duplicado de certificado ante la institución de origen.',
      notasInternas: 'Orientado a SEJ Jalisco para duplicado de certificado.',
      comentarioAdmin: 'ya_cuenta_bachillerato',
      createdAt: daysAgo(22),
    });

    const solCount = await db.select({ c: sql<number>`count(*)` }).from(solicitudesCuenta);
    console.log(`   ✓ ${solCount[0].c} solicitudes de cuenta en BD\n`);
  } else {
    const solCount = await db.select({ c: sql<number>`count(*)` }).from(solicitudesCuenta);
    console.log(`   ✓ Solicitudes ya existían: ${solCount[0].c} en BD\n`);
  }

  console.log('');
  console.log('✅ Seed completado.\n');
  console.log('Credenciales de demo:');
  console.log('  Admin:      admin@michoacan.gob.mx / demo1234');
  console.log('  Gestor:     gestor.patzcuaro@michoacan.gob.mx / demo1234');
  console.log('  Estudiante: alumna.demo@correo.mx / demo1234\n');

  await pool.end();
}

main().catch((err) => {
  console.error('❌ Error en seed:', err);
  process.exit(1);
});
