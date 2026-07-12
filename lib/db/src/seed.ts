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
  directores,
  convocatorias,
  avisos,
  anuncios,
  sedes,
  convocatoriasEtapas,
  convocatoriasModulosHorarios,
  expedienteDocumentos,
  examenesInscripciones,
  pagos,
  calificaciones,
  solicitudesCuenta,
  reportesGenerados,
  reportesProgramados,
  datosInstitucionales,
  datosBancarios,
  conceptosPago,
  plantillasCorreo,
  integraciones,
  preferenciasUsuario,
  auditLog,
  notificaciones,
  eliminacionesAuditoria,
  outbox,
} from './schema';
import { MUNICIPIOS_MICHOACAN } from './seed/municipios';
import { MODULOS_PREPA_ABIERTA } from './seed/modulos';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  console.log('🌱 Iniciando seed de Preparatoria Abierta Michoacán...\n');

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
      municipioId: patzcuaro.id,
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
      nombreCompleto: 'Dirección de Preparatoria Abierta Michoacán',
      puesto: 'Director(a)',
      emailPublico: 'contacto@michoacan.gob.mx',
      telefonoPublico: '443-322-9250',
    });
    console.log(`   ✓ Admin: admin@michoacan.gob.mx / demo1234\n`);
  } else {
    console.log(`   ✓ Admin ya existía: admin@michoacan.gob.mx\n`);
  }

  // ── Dirección de programa (cuenta oficial) ───────────────────────
  // En producción la contraseña ya fue cambiada por la dirección; este seed
  // solo aplica a instalaciones nuevas (password temporal demo).
  console.log('👤 Creando dirección de programa...');
  const [existingDireccion] = await db
    .select()
    .from(users)
    .where(eq(users.email, 'sinapsys@michoacan.gob.mx'));

  if (!existingDireccion) {
    const [direccionUser] = await db
      .insert(users)
      .values({
        email: 'sinapsys@michoacan.gob.mx',
        passwordHash,
        rol: 'direccion',
        privacidadAceptadaEn: new Date(),
      })
      .returning();

    await db.insert(directores).values({
      userId: direccionUser.id,
      nombreCompleto: 'Dirección del Programa en Línea',
      puesto: 'Dirección de Programa',
      emailPublico: 'sinapsys@michoacan.gob.mx',
      telefonoPublico: '443-322-9250',
    });
    console.log(`   ✓ Dirección: sinapsys@michoacan.gob.mx / demo1234\n`);
  } else {
    console.log(`   ✓ Dirección ya existía: sinapsys@michoacan.gob.mx\n`);
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
        titulo: 'Bienvenido al Sistema Preparatoria Abierta',
        contenido:
          'Te damos la bienvenida al Sistema de Gestión de Preparatoria Abierta Michoacán. ' +
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
          'Ya está disponible el material de apoyo para los 22 módulos del Plan Modular. ' +
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

    // ── Anuncios demo ──────────────────────────────────────────────────
    console.log('📢 Sembrando anuncios...');
    const anunciosData = [
      {
        titulo: 'Convocatoria 2026-1 abierta: inscripciones hasta el 30 de mayo',
        contenido: 'Ya está abierta la inscripción a la Convocatoria 2026-1. Para participar debes tener tu expediente completo y aprobado. Revisa tu expediente en la sección "Mi Expediente" y asegúrate de subir todos los documentos requeridos antes de la fecha límite.',
        prioridad: 'urgente' as const,
        audiencia: 'alumnos' as const,
        estado: 'publicado' as const,
        ctaTexto: 'Ver mi convocatoria',
        ctaUrl: '/estudiante/convocatoria',
        publicadoEn: new Date(),
        creadoPorUserId: adminForAvisos.id,
      },
      {
        titulo: 'Actualización de materiales de estudio — Módulos 1 al 7',
        contenido: 'Se han actualizado los materiales de apoyo para los Módulos 1 al 7. Los nuevos materiales incluyen resúmenes ampliados, ejercicios de práctica y simulacros de examen. Descárgalos desde la sección "Mis Módulos".',
        prioridad: 'importante' as const,
        audiencia: 'todos' as const,
        estado: 'publicado' as const,
        ctaTexto: 'Ir a Mis Módulos',
        ctaUrl: '/estudiante/modulos',
        publicadoEn: new Date(),
        creadoPorUserId: adminForAvisos.id,
      },
      {
        titulo: 'Gestores: Reporte trimestral de avance — entrega 15 de junio',
        contenido: 'Recordamos a todos los gestores municipales que el plazo para entregar el reporte trimestral de avance de alumnos es el 15 de junio. Asegúrense de que todos sus alumnos tengan el expediente actualizado. Cualquier duda, contacten a la coordinación.',
        prioridad: 'importante' as const,
        audiencia: 'gestores' as const,
        estado: 'publicado' as const,
        publicadoEn: new Date(),
        creadoPorUserId: adminForAvisos.id,
      },
      {
        titulo: 'Sistema en mantenimiento el sábado 10 de mayo de 00:00 a 06:00',
        contenido: 'El sistema estará en mantenimiento programado el sábado 10 de mayo de 2026 de 00:00 a 06:00 horas. Durante ese período no se podrán subir documentos ni realizar inscripciones. Disculpen los inconvenientes.',
        prioridad: 'informativo' as const,
        audiencia: 'todos' as const,
        estado: 'publicado' as const,
        publicadoEn: new Date(),
        activoHasta: new Date('2026-05-11T06:00:00'),
        creadoPorUserId: adminForAvisos.id,
      },
    ];

    for (const anuncio of anunciosData) {
      await db.insert(anuncios).values(anuncio as any).onConflictDoNothing();
    }
    const anunciosCount = await db.select({ c: sql<number>`count(*)` }).from(anuncios);
    console.log(`   ✓ ${anunciosCount[0].c} anuncios en BD\n`);
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

  // ── DEMO PRESENTACIÓN — datos realistas completos ─────────────────────────
  console.log('🎯 Sembrando datos demo para presentación...');

  const demoHash = await bcrypt.hash('demo1234', 10);

  // Referencias base
  const [dPat] = await db.select().from(municipios).where(eq(municipios.nombre, 'Pátzcuaro'));
  const [dMor] = await db.select().from(municipios).where(eq(municipios.nombre, 'Morelia'));
  const [dUru] = await db.select().from(municipios).where(eq(municipios.nombre, 'Uruapan'));
  const [dZam] = await db.select().from(municipios).where(eq(municipios.nombre, 'Zamora'));
  const [dSah] = await db.select().from(municipios).where(eq(municipios.nombre, 'Sahuayo'));
  const [dPied] = await db.select().from(municipios).where(eq(municipios.nombre, 'La Piedad'));
  const [dHid] = await db.select().from(municipios).where(eq(municipios.nombre, 'Hidalgo'));
  const [dAdmin] = await db.select().from(users).where(eq(users.email, 'admin@michoacan.gob.mx'));
  const [etapa6A] = await db.select().from(convocatoriasEtapas).where(eq(convocatoriasEtapas.clave, '2606-A'));
  const [etapa5B] = await db.select().from(convocatoriasEtapas).where(eq(convocatoriasEtapas.clave, '2605-B'));
  const [sedePat] = await db.select().from(sedes).where(eq(sedes.municipioId, dPat?.id ?? 0));
  const [sedeMor] = await db.select().from(sedes).where(eq(sedes.municipioId, dMor?.id ?? 0));
  const [sedeUru] = await db.select().from(sedes).where(eq(sedes.municipioId, dUru?.id ?? 0));
  const fallbackSede = sedeMor ?? sedePat ?? sedeUru;
  const allMods = await db.select().from(modulos).orderBy(modulos.numero);
  const gmod = (n: number) => allMods.find(m => m.numero === n)!;

  const daysAgoDate = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
  const hoursAgoDate = (h: number) => { const d = new Date(); d.setHours(d.getHours() - h); return d; };
  const daysFromNowStr = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0]; };

  // ── Helper: getOrCreate user ──────────────────────────────────────────────
  async function demoUser(email: string, rol: 'gestor' | 'estudiante', passTemp: boolean, createdAt?: Date) {
    const [ex] = await db.select().from(users).where(eq(users.email, email));
    if (ex) {
      // Siempre re-sincronizar contraseña a demo1234 para idempotencia
      await db.update(users).set({ passwordHash: demoHash, activo: true }).where(eq(users.id, ex.id));
      return ex.id;
    }
    const vals: Parameters<typeof db.insert>[0] extends never ? never : {
      email: string; passwordHash: string; rol: 'gestor'|'estudiante'; passwordTemporal: boolean; privacidadAceptadaEn?: Date; createdAt?: Date; updatedAt?: Date;
    } = {
      email, passwordHash: demoHash, rol, passwordTemporal: passTemp,
      ...(passTemp ? {} : { privacidadAceptadaEn: new Date() }),
      ...(createdAt ? { createdAt, updatedAt: createdAt } : {}),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [u] = await db.insert(users).values(vals as any).returning();
    return u.id;
  }

  // ── Helper: expediente doc ────────────────────────────────────────────────
  async function expDoc(
    estudianteId: number,
    tipo: string,
    estado: 'aprobado' | 'pendiente_revision' | 'rechazado',
    subidoEn?: Date,
    motivoRechazo?: string,
  ) {
    await db.insert(expedienteDocumentos).values({
      estudianteId, tipo, estado,
      motivoRechazo: motivoRechazo ?? null,
      rutaArchivo: `/demo/docs/${estudianteId}/${tipo}.pdf`,
      nombreOriginal: `${tipo}.pdf`,
      tamanoBytes: 245000,
      subidoPorUserId: dAdmin!.id,
      subidoEn: subidoEn ?? new Date(),
      revisadoPorUserId: estado !== 'pendiente_revision' ? dAdmin!.id : null,
      revisadoEn: estado !== 'pendiente_revision' ? new Date() : null,
    }).onConflictDoNothing();
  }

  // ── Helper: pago ──────────────────────────────────────────────────────────
  async function demoPago(
    estudianteId: number,
    monto: string,
    estado: 'pendiente' | 'verificado' | 'rechazado',
    fechaPago: string,
    detalle: string,
  ) {
    await db.insert(pagos).values({
      estudianteId, concepto: 'derecho_examen', conceptoDetalle: detalle,
      monto, moneda: 'MXN', fechaPago, metodoPago: 'spei',
      referenciaBancaria: `SPEI-${Math.floor(Math.random() * 9000000000 + 1000000000)}`,
      rutaComprobante: `/demo/pagos/${estudianteId}/${fechaPago}.pdf`,
      estado,
      subidoPorUserId: estudianteId,
      ...(estado === 'verificado' ? { verificadoPorUserId: dAdmin!.id, verificadoEn: new Date() } : {}),
    });
  }

  // ── Helper: examen inscripcion ────────────────────────────────────────────
  async function demoInscripcion(
    estudianteId: number,
    etapaId: number,
    moduloNum: number,
    folio: string,
    calificacion?: number,
  ) {
    const mod = gmod(moduloNum);
    if (!mod || !etapaId || !fallbackSede) return;
    const [horario] = await db.select().from(convocatoriasModulosHorarios)
      .where(eq(convocatoriasModulosHorarios.etapaId, etapaId))
      .limit(1);
    if (!horario) return;
    const sedeId = fallbackSede.id;
    await db.insert(examenesInscripciones).values({
      estudianteId, etapaId, moduloId: mod.id, horarioId: horario.id, sedeId,
      folio, estado: calificacion !== undefined ? 'evaluado' : 'inscrito',
      calificacion: calificacion ?? null,
    }).onConflictDoNothing();
  }

  // ── Helper: calificacion ──────────────────────────────────────────────────
  async function demoCalif(estudianteId: number, moduloNum: number, etapaClave: string, calificacion: number, fecha: string) {
    const mod = gmod(moduloNum);
    if (!mod) return;
    await db.insert(calificaciones).values({
      estudianteId, moduloId: mod.id, etapaClave, calificacion,
      aprobado: calificacion >= 60, intento: 1,
      fechaExamen: fecha, capturadoPorUserId: dAdmin!.id,
    }).onConflictDoNothing();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GESTORES (3)
  // ─────────────────────────────────────────────────────────────────────────

  const gRamirezId = await demoUser('m.ramirez@michoacan.gob.mx', 'gestor', true);
  await db.insert(gestores).values({
    userId: gRamirezId, nombreCompleto: 'María Elena Ramírez Soto',
    telefono: '434-342-9876', emailPublico: 'm.ramirez@michoacan.gob.mx',
    telefonoPublico: '434-342-9876', municipioId: dPat!.id,
    capacidadMaxima: 50, estado: 'activo',
  }).onConflictDoNothing();

  const gGonzalezId = await demoUser('l.gonzalez@michoacan.gob.mx', 'gestor', true);
  await db.insert(gestores).values({
    userId: gGonzalezId, nombreCompleto: 'Luis Alberto González Ríos',
    telefono: '443-152-1234', emailPublico: 'l.gonzalez@michoacan.gob.mx',
    telefonoPublico: '443-152-1234', municipioId: dMor!.id,
    capacidadMaxima: 60, estado: 'activo',
  }).onConflictDoNothing();

  const gHernandezId = await demoUser('j.hernandez@michoacan.gob.mx', 'gestor', true);
  await db.insert(gestores).values({
    userId: gHernandezId, nombreCompleto: 'Jaime Hernández Bautista',
    telefono: '452-518-7890', emailPublico: 'j.hernandez@michoacan.gob.mx',
    telefonoPublico: '452-518-7890', municipioId: dUru!.id,
    capacidadMaxima: 45, estado: 'activo',
  }).onConflictDoNothing();

  console.log('   ✓ 3 gestores demo');

  // ─────────────────────────────────────────────────────────────────────────
  // GRUPO A — Pátzcuaro (gestor: Ramírez)
  // ─────────────────────────────────────────────────────────────────────────

  // ALUMNO 1: Ana Cristina López Pérez — caso estrella
  const anaId = await demoUser('ana.lopez@correo.com', 'estudiante', false);
  await db.insert(estudiantes).values({
    userId: anaId, nombreCompleto: 'Ana Cristina López Pérez',
    curp: 'LOPA980916MMNPRR03', fechaNacimiento: '1998-09-16',
    telefono: '434-100-2233', municipioId: dPat!.id,
    gestorId: gRamirezId, emailVerificado: true, registroTipo: 'gestor',
    genero: 'femenino', nacionalidad: 'Mexicana',
    folioPreregistro: 'PRE-2026-MICH-000001',
    preregistroGeneradoEn: new Date('2026-01-15T10:00:00Z'),
    preregistroVigenteHasta: '2026-02-05',
    matriculaOficialDGB: '26016000142X',
    matriculaCapturadaEn: new Date('2026-02-01T14:30:00Z'),
    matriculaCapturadaPor: gRamirezId,
  }).onConflictDoNothing();
  await expDoc(anaId, 'acta_nacimiento', 'aprobado');
  await expDoc(anaId, 'curp', 'aprobado');
  await expDoc(anaId, 'certificado_secundaria', 'aprobado');
  await expDoc(anaId, 'ine', 'aprobado');
  await demoPago(anaId, '850.00', 'verificado', '2026-05-01', 'Derecho examen 2606-A');
  if (etapa6A) await demoInscripcion(anaId, etapa6A.id, 1, `FIC-ANA-2606A-M01`);
  await demoCalif(anaId, 1, '2605-A', 92, '2026-05-10');
  await demoCalif(anaId, 2, '2605-A', 85, '2026-05-10');
  await demoCalif(anaId, 3, '2605-B', 87, '2026-05-24');

  // ALUMNO 2: Jorge Ramírez Bedolla — en revisión
  const jorgeId = await demoUser('j.ramirez.b@correo.com', 'estudiante', false);
  await db.insert(estudiantes).values({
    userId: jorgeId, nombreCompleto: 'Jorge Ramírez Bedolla',
    curp: 'RABJ891015HMNMDR03', fechaNacimiento: '1989-10-15',
    telefono: '434-200-3344', municipioId: dPat!.id,
    gestorId: gRamirezId, emailVerificado: true, registroTipo: 'gestor',
    genero: 'masculino', nacionalidad: 'Mexicana',
    folioPreregistro: 'PRE-2026-MICH-000002',
    preregistroGeneradoEn: new Date('2026-04-01T09:00:00Z'),
    preregistroVigenteHasta: '2026-04-23',
  }).onConflictDoNothing();
  await expDoc(jorgeId, 'acta_nacimiento', 'aprobado');
  await expDoc(jorgeId, 'curp', 'aprobado');
  await expDoc(jorgeId, 'certificado_secundaria', 'pendiente_revision', hoursAgoDate(1));
  await expDoc(jorgeId, 'ine', 'aprobado');
  await demoPago(jorgeId, '850.00', 'pendiente', '2026-05-03', 'Derecho examen 2606-A');

  // ALUMNO 3: Elena Cisneros Romero — incompleta
  const elenaId = await demoUser('elena.cisneros@correo.com', 'estudiante', true);
  await db.insert(estudiantes).values({
    userId: elenaId, nombreCompleto: 'Elena Cisneros Romero',
    curp: 'CIRE950721MMNSMR04', fechaNacimiento: '1995-07-21',
    telefono: '434-300-4455', municipioId: dPat!.id,
    gestorId: gRamirezId, emailVerificado: false, registroTipo: 'gestor',
    genero: 'femenino', nacionalidad: 'Mexicana',
    folioPreregistro: 'PRE-2026-MICH-000003',
    preregistroGeneradoEn: daysAgoDate(20),
    preregistroVigenteHasta: daysFromNowStr(-5),
  }).onConflictDoNothing();
  await expDoc(elenaId, 'acta_nacimiento', 'aprobado');
  await expDoc(elenaId, 'curp', 'aprobado');

  console.log('   ✓ Grupo A — 3 alumnos Pátzcuaro');

  // ─────────────────────────────────────────────────────────────────────────
  // GRUPO B — Morelia (gestor: González)
  // ─────────────────────────────────────────────────────────────────────────

  // ALUMNO 4: Patricia Velázquez Núñez — egresada (22 módulos)
  const patriciaId = await demoUser('p.velazquez@correo.com', 'estudiante', false);
  await db.insert(estudiantes).values({
    userId: patriciaId, nombreCompleto: 'Patricia Velázquez Núñez',
    curp: 'VENP880412MMNLDR06', fechaNacimiento: '1988-04-12',
    telefono: '443-500-6677', municipioId: dMor!.id,
    gestorId: gGonzalezId, emailVerificado: true, registroTipo: 'gestor',
    genero: 'femenino', nacionalidad: 'Mexicana',
    folioPreregistro: 'PRE-2024-MICH-000001',
    preregistroGeneradoEn: new Date('2024-04-01T08:00:00Z'),
    preregistroVigenteHasta: '2024-04-24',
    matriculaOficialDGB: '26016000089K',
    matriculaCapturadaEn: new Date('2024-04-05T10:00:00Z'),
    matriculaCapturadaPor: gGonzalezId,
  }).onConflictDoNothing();
  await expDoc(patriciaId, 'acta_nacimiento', 'aprobado');
  await expDoc(patriciaId, 'curp', 'aprobado');
  await expDoc(patriciaId, 'certificado_secundaria', 'aprobado');
  await expDoc(patriciaId, 'ine', 'aprobado');
  const patriciaPagos = [
    ['2024-05-10', '2404-A'], ['2024-09-14', '2407-B'],
    ['2025-01-11', '2501-A'], ['2025-05-10', '2504-A'], ['2025-09-13', '2506-B'],
  ];
  for (const [fecha, detalle] of patriciaPagos) {
    await demoPago(patriciaId, '850.00', 'verificado', fecha, `Derecho examen ${detalle}`);
  }
  // 22 módulos con calificaciones históricas (egresada del Plan 22 completo)
  const patriciaScores = [85,87,90,88,86,84,89,91,87,85,88,92,83,86,89,85,87,90,88,84,87,86];
  const etapasHistPat = ['2404-A','2404-A','2404-A','2404-A','2407-B','2407-B','2407-B','2407-B','2407-B','2501-A','2501-A','2501-A','2501-A','2504-A','2504-A','2504-A','2504-A','2506-B','2506-B','2506-B','2506-B','2506-B'];
  const fechasHistPat = ['2024-05-10','2024-05-10','2024-05-10','2024-05-10','2024-09-13','2024-09-13','2024-09-14','2024-09-14','2024-09-14','2025-01-11','2025-01-11','2025-01-11','2025-01-12','2025-05-10','2025-05-10','2025-05-10','2025-05-11','2025-09-13','2025-09-13','2025-09-13','2025-09-14','2025-09-14'];
  for (let i = 0; i < 22; i++) {
    await demoCalif(patriciaId, i + 1, etapasHistPat[i], patriciaScores[i], fechasHistPat[i]);
  }

  // ALUMNO 5: Diego Ramírez Aguilar — inscrito etapa actual
  const diegoId = await demoUser('diego.ramirez@correo.com', 'estudiante', false);
  await db.insert(estudiantes).values({
    userId: diegoId, nombreCompleto: 'Diego Ramírez Aguilar',
    curp: 'RAAD970728HMNMGR02', fechaNacimiento: '1997-07-28',
    telefono: '443-600-7788', municipioId: dMor!.id,
    gestorId: gGonzalezId, emailVerificado: true, registroTipo: 'gestor',
    genero: 'masculino', nacionalidad: 'Mexicana',
    folioPreregistro: 'PRE-2026-MICH-000004',
    preregistroGeneradoEn: new Date('2026-01-20T09:00:00Z'),
    preregistroVigenteHasta: '2026-02-12',
    matriculaOficialDGB: '26016000201M',
    matriculaCapturadaEn: new Date('2026-01-28T15:00:00Z'),
    matriculaCapturadaPor: gGonzalezId,
  }).onConflictDoNothing();
  await expDoc(diegoId, 'acta_nacimiento', 'aprobado');
  await expDoc(diegoId, 'curp', 'aprobado');
  await expDoc(diegoId, 'certificado_secundaria', 'aprobado');
  await expDoc(diegoId, 'ine', 'aprobado');
  await demoPago(diegoId, '850.00', 'verificado', '2026-05-02', 'Derecho examen 2606-A');
  if (etapa6A) await demoInscripcion(diegoId, etapa6A.id, 2, `FIC-DIEGO-2606A-M02`);

  // ALUMNO 6: Sofía Mendoza Ríos — primer login (passwordTemporal)
  const sofiaM = hoursAgoDate(2);
  const sofiaMId = await demoUser('sofia.mendoza@correo.com', 'estudiante', true, sofiaM);
  await db.insert(estudiantes).values({
    userId: sofiaMId, nombreCompleto: 'Sofía Mendoza Ríos',
    curp: 'MERS920622MMNDS04', fechaNacimiento: '1992-06-22',
    telefono: '443-700-8899', municipioId: dMor!.id,
    gestorId: gGonzalezId, emailVerificado: false, registroTipo: 'gestor',
    genero: 'femenino', nacionalidad: 'Mexicana',
    createdAt: sofiaM,
    folioPreregistro: 'PRE-2026-MICH-000005',
    preregistroGeneradoEn: sofiaM,
    preregistroVigenteHasta: daysFromNowStr(22),
  }).onConflictDoNothing();
  await expDoc(sofiaMId, 'acta_nacimiento', 'aprobado');

  console.log('   ✓ Grupo B — 3 alumnos Morelia');

  // ─────────────────────────────────────────────────────────────────────────
  // GRUPO C — Uruapan (gestor: Hernández)
  // ─────────────────────────────────────────────────────────────────────────

  // ALUMNO 7: Roberto Vargas Salinas — doc rechazado
  const robertoId = await demoUser('r.vargas@correo.com', 'estudiante', false);
  await db.insert(estudiantes).values({
    userId: robertoId, nombreCompleto: 'Roberto Vargas Salinas',
    curp: 'VASR940318HMNRLR07', fechaNacimiento: '1994-03-18',
    telefono: '452-800-9900', municipioId: dUru!.id,
    gestorId: gHernandezId, emailVerificado: true, registroTipo: 'gestor',
    genero: 'masculino', nacionalidad: 'Mexicana',
    folioPreregistro: 'PRE-2026-MICH-000006',
    preregistroGeneradoEn: daysAgoDate(13),
    preregistroVigenteHasta: daysFromNowStr(2),
  }).onConflictDoNothing();
  await expDoc(robertoId, 'acta_nacimiento', 'aprobado');
  await expDoc(robertoId, 'curp', 'aprobado');
  await expDoc(robertoId, 'certificado_secundaria', 'rechazado', new Date(),
    'Documento ilegible, favor de subir nueva versión escaneada con buena resolución');
  await expDoc(robertoId, 'ine', 'aprobado');

  // ALUMNO 8: María Guadalupe Torres Ríos — esperando próxima etapa
  const maGuadId = await demoUser('m.torres@correo.com', 'estudiante', false);
  await db.insert(estudiantes).values({
    userId: maGuadId, nombreCompleto: 'María Guadalupe Torres Ríos',
    curp: 'TORG911105MMNRRR05', fechaNacimiento: '1991-11-05',
    telefono: '452-900-1010', municipioId: dUru!.id,
    gestorId: gHernandezId, emailVerificado: true, registroTipo: 'gestor',
    genero: 'femenino', nacionalidad: 'Mexicana',
    folioPreregistro: 'PRE-2026-MICH-000007',
    preregistroGeneradoEn: daysAgoDate(6),
    preregistroVigenteHasta: daysFromNowStr(9),
  }).onConflictDoNothing();
  await expDoc(maGuadId, 'acta_nacimiento', 'aprobado');
  await expDoc(maGuadId, 'curp', 'aprobado');
  await expDoc(maGuadId, 'certificado_secundaria', 'aprobado');
  await expDoc(maGuadId, 'ine', 'aprobado');
  await demoPago(maGuadId, '850.00', 'verificado', '2026-04-27', 'Derecho examen 2605-B');
  if (etapa5B) await demoInscripcion(maGuadId, etapa5B.id, 1, `FIC-MAGUAD-2605B-M01`, 80);
  await demoCalif(maGuadId, 1, '2605-B', 80, '2026-05-24');

  console.log('   ✓ Grupo C — 2 alumnos Uruapan');

  // ─────────────────────────────────────────────────────────────────────────
  // GRUPO D — Sin gestor (auto-registrados)
  // ─────────────────────────────────────────────────────────────────────────

  // ALUMNO 9: Carlos Hernández Soto — recién entrado
  const carlosId = await demoUser('carlos.hernandez@correo.com', 'estudiante', false, daysAgoDate(3));
  await db.insert(estudiantes).values({
    userId: carlosId, nombreCompleto: 'Carlos Hernández Soto',
    curp: 'HESC891204HMNRTR01', fechaNacimiento: '1989-12-04',
    telefono: '351-100-2233', municipioId: dZam!.id,
    gestorId: null, emailVerificado: true, registroTipo: 'auto',
    genero: 'masculino', nacionalidad: 'Mexicana',
    createdAt: daysAgoDate(3),
    folioPreregistro: 'PRE-2026-MICH-000008',
    preregistroGeneradoEn: daysAgoDate(3),
    preregistroVigenteHasta: daysFromNowStr(17),
  }).onConflictDoNothing();

  // ALUMNO 10: Axel Jiménez García — en proceso autodirigido
  const axelId = await demoUser('axel.jimenez@correo.com', 'estudiante', false, daysAgoDate(7));
  await db.insert(estudiantes).values({
    userId: axelId, nombreCompleto: 'Axel Jiménez García',
    curp: 'JIGA950315HMNMRX09', fechaNacimiento: '1995-03-15',
    telefono: '443-152-9876', municipioId: dMor!.id,
    gestorId: null, emailVerificado: true, registroTipo: 'auto',
    genero: 'masculino', nacionalidad: 'Mexicana',
    createdAt: daysAgoDate(7),
    folioPreregistro: 'PRE-2026-MICH-000009',
    preregistroGeneradoEn: daysAgoDate(7),
    preregistroVigenteHasta: daysFromNowStr(14),
  }).onConflictDoNothing();
  await expDoc(axelId, 'acta_nacimiento', 'aprobado');
  await expDoc(axelId, 'curp', 'aprobado');
  await expDoc(axelId, 'certificado_secundaria', 'pendiente_revision', daysAgoDate(5));
  await expDoc(axelId, 'ine', 'pendiente_revision', daysAgoDate(4));

  console.log('   ✓ Grupo D — 2 alumnos sin gestor');

  // ─────────────────────────────────────────────────────────────────────────
  // GRUPO E — DEPURACIÓN (cuentas en riesgo + soft-deleted + auditoria)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('🗑  Sembrando cuentas demo de depuración...');

  const [existDepuracion] = await db.select({ c: sql<number>`count(*)` })
    .from(users).where(eq(users.email, 'andres.soto@correo.com'))
    .then(r => r);

  if (Number(existDepuracion?.c ?? 0) === 0) {
    // Andrés Soto Lima — aviso enviado, eliminación en ~4 días
    const andresId = await demoUser('andres.soto@correo.com', 'estudiante', false, daysAgoDate(26));
    await db.insert(estudiantes).values({
      userId: andresId,
      nombreCompleto: 'Andrés Soto Lima',
      curp: 'SOLA990314HMNTML01',
      fechaNacimiento: '1999-03-14',
      telefono: '353-100-1234',
      municipioId: dSah?.id ?? dMor!.id,
      estadoCuenta: 'aviso_enviado',
      ultimaActividadEn: null,
      avisoEliminacionEnviadoEn: daysAgoDate(1),
      createdAt: daysAgoDate(26),
    }).onConflictDoNothing();

    // Marta Jiménez Pérez — aviso enviado, eliminación en ~2 días
    const martaId = await demoUser('marta.jimenez@correo.com', 'estudiante', false, daysAgoDate(28));
    await db.insert(estudiantes).values({
      userId: martaId,
      nombreCompleto: 'Marta Jiménez Pérez',
      curp: 'JIPM880521MMNNRR02',
      fechaNacimiento: '1988-05-21',
      telefono: '352-200-5678',
      municipioId: dPied?.id ?? dMor!.id,
      estadoCuenta: 'aviso_enviado',
      ultimaActividadEn: null,
      avisoEliminacionEnviadoEn: daysAgoDate(3),
      createdAt: daysAgoDate(28),
    }).onConflictDoNothing();

    // Pedro Lara Méndez — soft-deleted hace 30 días (60 días sin actividad)
    const pedroDepId = await demoUser('pedro.lara@correo.com', 'estudiante', false, daysAgoDate(60));
    await db.insert(estudiantes).values({
      userId: pedroDepId,
      nombreCompleto: 'Pedro Lara Méndez',
      curp: 'LAMP820709HMNNRD03',
      fechaNacimiento: '1982-07-09',
      telefono: '456-300-9012',
      municipioId: dHid?.id ?? dMor!.id,
      estadoCuenta: 'soft_deleted',
      ultimaActividadEn: null,
      softDeletedEn: daysAgoDate(30),
      softDeleteMotivo: 'Inactividad de 30 días sin documentos ni pagos',
      createdAt: daysAgoDate(60),
    }).onConflictDoNothing();
    // Deshabilitar su usuario
    await db.update(users).set({ activo: false }).where(eq(users.id, pedroDepId));

    // Auditoría: hard-delete ficticio de hace 95 días
    await db.insert(eliminacionesAuditoria).values({
      estudianteId: null,
      nombreCompleto: 'Carmen Ruiz Contreras',
      curp: 'RUCC791105MMNRND04',
      email: 'carmen.ruiz@correo.com',
      municipioNombre: dMor ? 'Morelia' : 'Michoacán',
      folioPreregistro: null,
      tipo: 'hard_delete',
      motivo: 'Eliminación automática LGPDPPSO — 90 días en soft_deleted sin actividad',
      diasSinActividad: 120,
      documentosTenia: 0,
      pagosTenia: 0,
      teniaMatriculaDGB: false,
      ejecutadoPorSistema: true,
      creadoEn: daysAgoDate(95),
    }).onConflictDoNothing();

    console.log('   ✓ Grupo E — 3 cuentas depuración + 1 entrada auditoría');
  } else {
    console.log('   ✓ Grupo E — cuentas depuración ya existían');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SOLICITUDES PENDIENTES (4 específicas para demo)
  // ─────────────────────────────────────────────────────────────────────────

  const solDemoFolios = ['SOL-DEMO-01','SOL-DEMO-02','SOL-DEMO-03','SOL-DEMO-04'];
  const [existSolDemo] = await db.select().from(solicitudesCuenta)
    .where(eq(solicitudesCuenta.folio, 'SOL-DEMO-01'));

  if (!existSolDemo) {
    await db.insert(solicitudesCuenta).values([
      {
        folio: 'SOL-DEMO-01',
        nombreCompleto: 'Juana Rodríguez Mendoza',
        curp: 'ROMJ900512MMNDND09',
        fechaNacimiento: '1990-05-12',
        email: 'juana.rodriguez@correo.com',
        telefono: '443-400-1122',
        municipioId: dMor!.id,
        justificacion: 'Tengo 35 años, dos hijos y trabajo en una tienda. Siempre quise terminar la prepa pero por la situación económica no pude seguir. Ahora que mis hijos están en la escuela quiero ponerles el ejemplo y poder buscar un mejor trabajo.',
        modalidadPreferida: 'con_gestor',
        estado: 'pendiente',
        emailVerificado: true,
        createdAt: daysAgoDate(12),
      },
      {
        folio: 'SOL-DEMO-02',
        nombreCompleto: 'Pedro Manuel Hernández Solís',
        curp: 'HESP780123HMNRRD03',
        fechaNacimiento: '1978-01-23',
        email: 'pedro.hernandez@correo.com',
        telefono: '434-400-3344',
        municipioId: dPat!.id,
        justificacion: 'Soy comerciante de 47 años, quiero terminar la prepa para cumplir un sueño que tengo desde joven y también para ayudar a mis hijos con la tarea.',
        modalidadPreferida: 'con_gestor',
        estado: 'pendiente',
        emailVerificado: true,
        createdAt: daysAgoDate(9),
      },
      {
        folio: 'SOL-DEMO-03',
        nombreCompleto: 'Luisa Fernanda Aguilar Pérez',
        curp: 'AUPL920815MMNGRR05',
        fechaNacimiento: '1992-08-15',
        email: 'l.aguilar@correo.com',
        telefono: '452-400-5566',
        municipioId: dUru!.id,
        justificacion: 'Trabajo como mesera y me gustaría seguir estudiando por las tardes.',
        modalidadPreferida: 'auto_gestion',
        estado: 'pendiente',
        emailVerificado: true,
        createdAt: daysAgoDate(6),
      },
      {
        folio: 'SOL-DEMO-04',
        nombreCompleto: 'Sofía Castañeda Reyes',
        curp: 'CARS890716MMNSYR02',
        fechaNacimiento: '1989-07-16',
        email: 'sofia.castaneda@correo.com',
        telefono: '443-400-7788',
        municipioId: dMor!.id,
        justificacion: 'Soy ama de casa de 36 años, quiero estudiar para ayudar a mis hijos con sus tareas y poder buscar trabajo formal.',
        modalidadPreferida: 'con_gestor',
        estado: 'pendiente',
        emailVerificado: true,
        createdAt: daysAgoDate(4),
      },
    ]).onConflictDoNothing();
    console.log('   ✓ 4 solicitudes demo insertadas');
  } else {
    console.log('   ✓ Solicitudes demo ya existían');
  }

  // ── Reportes programados demo ──────────────────────────────────────
  console.log('📊 Sembrando reportes programados y historial...');
  const repProgCount = await db.select({ c: sql<number>`count(*)` }).from(reportesProgramados);
  if (Number(repProgCount[0].c) === 0) {
    const adminUserRes = await db.select({ id: users.id }).from(users).where(eq(users.email, 'admin@michoacan.gob.mx'));
    const adminId = adminUserRes[0]?.id;

    const ahora = new Date();
    const manana = new Date(ahora); manana.setDate(manana.getDate() + 1); manana.setHours(8, 0, 0, 0);
    const proxSemana = new Date(ahora); proxSemana.setDate(proxSemana.getDate() + 7); proxSemana.setHours(8, 0, 0, 0);
    const proxMes = new Date(ahora); proxMes.setMonth(proxMes.getMonth() + 1); proxMes.setHours(8, 0, 0, 0);

    await db.insert(reportesProgramados).values([
      {
        nombre: 'Inscripciones semanales',
        tipo: 'inscripciones',
        formato: 'excel',
        frecuencia: 'semanal',
        emailDestino: 'admin@michoacan.gob.mx',
        activo: true,
        proximaEjecucion: proxSemana,
        creadoPorUserId: adminId,
      },
      {
        nombre: 'Reporte ejecutivo mensual',
        tipo: 'ejecutivo',
        formato: 'pdf',
        frecuencia: 'mensual',
        emailDestino: 'director@michoacan.gob.mx',
        activo: true,
        proximaEjecucion: proxMes,
        creadoPorUserId: adminId,
      },
      {
        nombre: 'Financiero diario',
        tipo: 'financiero',
        formato: 'excel',
        frecuencia: 'diaria',
        emailDestino: 'finanzas@michoacan.gob.mx',
        activo: false,
        proximaEjecucion: manana,
        creadoPorUserId: adminId,
      },
    ]);

    // Historial demo
    const hace7 = new Date(ahora); hace7.setDate(hace7.getDate() - 7);
    const hace14 = new Date(ahora); hace14.setDate(hace14.getDate() - 14);
    const hace3 = new Date(ahora); hace3.setDate(hace3.getDate() - 3);
    const hace1 = new Date(ahora); hace1.setDate(hace1.getDate() - 1);

    await db.insert(reportesGenerados).values([
      { tipo: 'inscripciones', formato: 'excel', nombre: 'Reporte de Inscripciones', estado: 'listo', totalRegistros: 87, nombreArchivo: 'inscripciones_20260428.xlsx', tamanoBytes: 42800, generadoPorUserId: adminId, generadoEn: hace7 },
      { tipo: 'ejecutivo', formato: 'pdf', nombre: 'Reporte Ejecutivo', estado: 'listo', totalRegistros: 6, nombreArchivo: 'ejecutivo_20260421.pdf', tamanoBytes: 185000, generadoPorUserId: adminId, generadoEn: hace14 },
      { tipo: 'financiero', formato: 'excel', nombre: 'Reporte Financiero', estado: 'listo', totalRegistros: 34, nombreArchivo: 'financiero_20260502.xlsx', tamanoBytes: 28400, generadoPorUserId: adminId, generadoEn: hace3 },
      { tipo: 'productividad_gestores', formato: 'excel', nombre: 'Productividad de Gestores', estado: 'listo', totalRegistros: 3, nombreArchivo: 'productividad_gestores_20260504.xlsx', tamanoBytes: 15200, generadoPorUserId: adminId, generadoEn: hace1 },
      { tipo: 'solicitudes', formato: 'pdf', nombre: 'Reporte de Solicitudes de Cuenta', estado: 'listo', totalRegistros: 12, nombreArchivo: 'solicitudes_20260504.pdf', tamanoBytes: 95600, generadoPorUserId: adminId, generadoEn: hace1 },
    ]);

    console.log('   ✓ 3 reportes programados + 5 historial insertados');
  } else {
    console.log('   ✓ Reportes demo ya existían');
  }

  // ── Configuración: datos institucionales ───────────────────────────────
  console.log('🏛️  Sembrando configuración institucional...');

  const confDatosCount = await db.select({ c: sql<number>`count(*)` }).from(datosInstitucionales);
  if (Number(confDatosCount[0].c) === 0) {
    await db.insert(datosInstitucionales).values({
      nombreOficial: 'Instituto de Educación Media Superior y Superior del Estado de Michoacán',
      nombreCorto: 'IEMSyS Michoacán',
      direccion: 'Av. Siervo de la Nación 2555, Col. Infonavit Popo, Morelia, Michoacán, C.P. 58070',
      telefonoGeneral: '443 299 5000',
      correoSoporte: 'soporte.preparatoria@michoacan.gob.mx',
      rfc: 'IEM200815AB1',
      sitioWeb: 'https://prepaabierta.michoacan.gob.mx',
    });
    console.log('   ✓ Datos institucionales insertados');
  }

  const confBancoCount = await db.select({ c: sql<number>`count(*)` }).from(datosBancarios);
  if (Number(confBancoCount[0].c) === 0) {
    await db.insert(datosBancarios).values({
      banco: 'BBVA',
      titular: 'Instituto de Educación Media Superior y Superior del Estado de Michoacán',
      clabe: '012470012345678901',
      numeroCuenta: '0123456789',
      rfc: 'IEM200815AB1',
      conceptoPago: 'CURP del alumno + clave de etapa DGB',
    });
    console.log('   ✓ Datos bancarios insertados');
  }

  const confConceptosCount = await db.select({ c: sql<number>`count(*)` }).from(conceptosPago);
  if (Number(confConceptosCount[0].c) === 0) {
    await db.insert(conceptosPago).values([
      { clave: 'inscripcion_inicial', nombre: 'Inscripción inicial', descripcion: 'Derecho de inscripción al sistema Preparatoria Abierta', monto: '850.00', vigencia: 2026, activo: true },
      { clave: 'examen_modulo', nombre: 'Examen por módulo', descripcion: 'Derecho de examen por cada módulo ordinario', monto: '95.00', vigencia: 2026, activo: true },
      { clave: 'examen_extraordinario', nombre: 'Examen extraordinario', descripcion: 'Derecho de examen en convocatoria extraordinaria', monto: '95.00', vigencia: 2026, activo: true },
      { clave: 'reposicion_credencial', nombre: 'Reposición de credencial', descripcion: 'Reposición por extravío o deterioro', monto: '44.00', vigencia: 2026, activo: true },
      { clave: 'certificado_parcial', nombre: 'Certificado parcial', descripcion: 'Constancia de módulos aprobados', monto: '73.00', vigencia: 2026, activo: true },
      { clave: 'certificado_total', nombre: 'Certificado total', descripcion: 'Certificado de terminación de bachillerato', monto: '51.00', vigencia: 2026, activo: true },
      { clave: 'constancia_inscripcion', nombre: 'Constancia de inscripción', descripcion: 'Documento de vigencia de inscripción activa', monto: '0.00', vigencia: 2026, activo: true },
    ]);
    console.log('   ✓ Conceptos de pago insertados (7)');
  }

  // ── Municipios activos ──────────────────────────────────────────────────
  const MUNICIPIOS_ACTIVOS = ['Morelia', 'Pátzcuaro', 'Uruapan', 'Zamora'];
  for (const nombre of MUNICIPIOS_ACTIVOS) {
    await db.update(municipios)
      .set({ activo: true })
      .where(eq(municipios.nombre, nombre));
  }
  // Desactivar el resto
  await db.execute(
    sql`UPDATE municipios SET activo = false WHERE nombre NOT IN ('Morelia', 'Pátzcuaro', 'Uruapan', 'Zamora')`
  );
  console.log('   ✓ Municipios activos actualizados (4 activos, resto inactivos)');

  // ── Plantillas de correo ────────────────────────────────────────────────
  const confPlantillasCount = await db.select({ c: sql<number>`count(*)` }).from(plantillasCorreo);
  if (Number(confPlantillasCount[0].c) === 0) {
    const headerHtml = `<div style="background:#6B0F3C;padding:20px 32px;margin-bottom:0"><p style="color:white;font-size:11px;margin:0;font-family:sans-serif;letter-spacing:0.1em;text-transform:uppercase">GOBIERNO DEL ESTADO DE MICHOACÁN</p><h1 style="color:white;font-size:20px;margin:8px 0 0;font-family:sans-serif;font-weight:700">Preparatoria Abierta Michoacán</h1></div>`;
    const footerHtml = `<div style="background:#f5f0ea;padding:16px 32px;margin-top:32px;border-top:3px solid #6B0F3C"><p style="color:#78716c;font-size:11px;margin:0;font-family:sans-serif">Instituto de Educación Media Superior y Superior · Michoacán<br>prepaabierta.michoacan.gob.mx · soporte.preparatoria@michoacan.gob.mx</p></div>`;
    const wrap = (body: string) => `${headerHtml}<div style="padding:32px;font-family:sans-serif;color:#2a2a2a">${body}</div>${footerHtml}`;

    await db.insert(plantillasCorreo).values([
      {
        clave: 'bienvenida_credenciales',
        nombre: 'Bienvenida con credenciales',
        descripcion: 'Se envía al alumno cuando el gestor crea su cuenta',
        asunto: 'Bienvenido a Preparatoria Abierta Michoacán — Tus credenciales de acceso',
        contenidoHtml: wrap(`<h2 style="color:#6B0F3C">Bienvenido, {{nombreCompleto}}</h2><p>Tu cuenta ha sido creada exitosamente en el Sistema de Preparatoria Abierta Michoacán.</p><div style="background:#fdf6fa;border-left:4px solid #6B0F3C;padding:16px 20px;margin:20px 0;border-radius:4px"><p style="margin:0 0 8px"><strong>Correo:</strong> {{email}}</p><p style="margin:0"><strong>Contraseña temporal:</strong> <code style="background:#e5e7eb;padding:2px 6px;border-radius:3px;font-size:15px">{{passwordTemporal}}</code></p></div><p>Tu gestor asignado es <strong>{{gestorNombre}}</strong> ({{gestorEmail}}).</p><p>Por seguridad, deberás cambiar tu contraseña en tu primer ingreso.</p><a href="{{linkPortal}}" style="display:inline-block;background:#6B0F3C;color:white;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin-top:8px">Ingresar al portal</a>`),
        variablesDisponibles: ['nombreCompleto', 'email', 'passwordTemporal', 'gestorNombre', 'gestorEmail', 'linkPortal'],
        activa: true,
      },
      {
        clave: 'verificacion_codigo',
        nombre: 'Verificación de correo (código)',
        descripcion: 'Código de 6 dígitos para verificar el correo en auto-registro',
        asunto: 'Preparatoria Abierta — Tu código de verificación: {{codigo}}',
        contenidoHtml: wrap(`<h2 style="color:#6B0F3C">Verifica tu correo electrónico</h2><p>Usa el siguiente código para completar tu registro:</p><div style="text-align:center;margin:32px 0"><span style="font-size:40px;font-weight:800;letter-spacing:0.3em;color:#6B0F3C;font-family:monospace">{{codigo}}</span></div><p style="color:#78716c;font-size:13px">Este código expira en 15 minutos. Si no solicitaste esto, ignora este correo.</p>`),
        variablesDisponibles: ['codigo', 'email'],
        activa: true,
      },
      {
        clave: 'recuperacion_password',
        nombre: 'Recuperación de contraseña',
        descripcion: 'Enlace de reset cuando el usuario solicita recuperar su contraseña',
        asunto: 'Preparatoria Abierta — Recupera tu contraseña',
        contenidoHtml: wrap(`<h2 style="color:#6B0F3C">Restablecer contraseña</h2><p>Recibimos una solicitud para restablecer la contraseña de <strong>{{email}}</strong>.</p><a href="{{linkReset}}" style="display:inline-block;background:#6B0F3C;color:white;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0">Restablecer contraseña</a><p style="color:#78716c;font-size:13px">Este enlace expira en 2 horas. Si no solicitaste el cambio, ignora este correo.</p>`),
        variablesDisponibles: ['email', 'linkReset', 'nombreCompleto'],
        activa: true,
      },
      {
        clave: 'solicitud_aprobada',
        nombre: 'Solicitud aprobada',
        descripcion: 'Notifica al solicitante que su solicitud fue aprobada y le da sus credenciales',
        asunto: 'Preparatoria Abierta — Tu solicitud fue aprobada',
        contenidoHtml: wrap(`<h2 style="color:#6B0F3C">¡Tu solicitud fue aprobada!</h2><p>Estimado/a <strong>{{nombreCompleto}}</strong>, nos complace informarte que tu solicitud de inscripción ha sido aprobada.</p><div style="background:#fdf6fa;border-left:4px solid #6B0F3C;padding:16px 20px;margin:20px 0;border-radius:4px"><p style="margin:0 0 8px"><strong>Correo:</strong> {{email}}</p><p style="margin:0"><strong>Contraseña temporal:</strong> <code style="background:#e5e7eb;padding:2px 6px;border-radius:3px">{{passwordTemporal}}</code></p></div><p>Tu gestor asignado: <strong>{{gestorNombre}}</strong></p><a href="{{linkPortal}}" style="display:inline-block;background:#6B0F3C;color:white;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600">Ingresar al portal</a>`),
        variablesDisponibles: ['nombreCompleto', 'email', 'passwordTemporal', 'gestorNombre', 'linkPortal'],
        activa: true,
      },
      {
        clave: 'solicitud_rechazada',
        nombre: 'Solicitud rechazada',
        descripcion: 'Notifica al solicitante que su solicitud fue rechazada con el motivo',
        asunto: 'Preparatoria Abierta — Actualización sobre tu solicitud',
        contenidoHtml: wrap(`<h2 style="color:#6B0F3C">Actualización sobre tu solicitud</h2><p>Estimado/a <strong>{{nombreCompleto}}</strong>, hemos revisado tu solicitud y lamentamos informarte que no fue posible aprobarla en este momento.</p><div style="background:#fff5f5;border-left:4px solid #ef4444;padding:16px 20px;margin:20px 0;border-radius:4px"><p style="margin:0"><strong>Motivo:</strong> {{motivoRechazo}}</p></div><p>Si tienes dudas, comunícate con nosotros en soporte.preparatoria@michoacan.gob.mx</p>`),
        variablesDisponibles: ['nombreCompleto', 'motivoRechazo', 'email'],
        activa: true,
      },
      {
        clave: 'anuncio_institucional',
        nombre: 'Anuncio institucional',
        descripcion: 'Plantilla genérica para comunicados y anuncios del sistema',
        asunto: '{{asuntoAnuncio}} — Preparatoria Abierta Michoacán',
        contenidoHtml: wrap(`<h2 style="color:#6B0F3C">{{tituloAnuncio}}</h2><div>{{contenidoAnuncio}}</div><p style="color:#78716c;font-size:12px;margin-top:24px">Para más información visita <a href="{{linkPortal}}" style="color:#6B0F3C">tu portal</a>.</p>`),
        variablesDisponibles: ['tituloAnuncio', 'asuntoAnuncio', 'contenidoAnuncio', 'linkPortal'],
        activa: true,
      },
      {
        clave: 'documento_rechazado',
        nombre: 'Documento rechazado',
        descripcion: 'Notifica al alumno que un documento de su expediente fue rechazado',
        asunto: 'Preparatoria Abierta — Documento requiere atención',
        contenidoHtml: wrap(`<h2 style="color:#6B0F3C">Documento requiere atención</h2><p>Estimado/a <strong>{{nombreCompleto}}</strong>, tu documento <strong>"{{tipoDocumento}}"</strong> fue revisado y requiere corrección.</p><div style="background:#fff5f5;border-left:4px solid #ef4444;padding:16px 20px;margin:20px 0;border-radius:4px"><p style="margin:0"><strong>Motivo:</strong> {{motivoRechazo}}</p></div><p>Vuelve a subir el documento corregido desde tu portal.</p><a href="{{linkPortal}}" style="display:inline-block;background:#6B0F3C;color:white;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600">Ir a mi expediente</a>`),
        variablesDisponibles: ['nombreCompleto', 'tipoDocumento', 'motivoRechazo', 'linkPortal'],
        activa: true,
      },
      {
        clave: 'matricula_asignada',
        nombre: 'Matrícula DGB asignada',
        descripcion: 'Notifica al alumno cuando se le captura su matrícula oficial DGB',
        asunto: 'Preparatoria Abierta — Tu matrícula oficial ha sido asignada',
        contenidoHtml: wrap(`<h2 style="color:#6B0F3C">¡Matrícula oficial asignada!</h2><p>Estimado/a <strong>{{nombreCompleto}}</strong>, nos complace informarte que tu matrícula oficial DGB ha sido registrada en el sistema.</p><div style="background:#fdf6fa;border-left:4px solid #6B0F3C;padding:16px 20px;margin:20px 0;border-radius:4px;text-align:center"><p style="margin:0 0 4px;font-size:12px;color:#78716c;text-transform:uppercase;letter-spacing:0.1em">Matrícula oficial DGB</p><p style="margin:0;font-size:24px;font-weight:800;color:#6B0F3C;font-family:monospace">{{matriculaDGB}}</p></div><p>Descarga tu ficha de registro oficial desde tu portal.</p><a href="{{linkPortal}}" style="display:inline-block;background:#6B0F3C;color:white;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600">Ver mi ficha de registro</a>`),
        variablesDisponibles: ['nombreCompleto', 'matriculaDGB', 'linkPortal'],
        activa: true,
      },
    ]);
    console.log('   ✓ Plantillas de correo insertadas (8)');
  }

  // ── Integraciones ───────────────────────────────────────────────────────
  const confIntCount = await db.select({ c: sql<number>`count(*)` }).from(integraciones);
  if (Number(confIntCount[0].c) === 0) {
    const ahora = new Date();
    await db.insert(integraciones).values([
      {
        clave: 'resend',
        nombre: 'Resend',
        descripcion: 'Servicio de envío de correos transaccionales',
        proveedor: 'Resend Inc.',
        conectada: true,
        configuracion: { apiKey: 're_demo_key_****', domain: 'michoacan.gob.mx', modo: 'produccion' },
        ultimaPruebaEn: ahora,
        ultimaPruebaExitosa: true,
      },
      {
        clave: 'neon',
        nombre: 'Neon',
        descripcion: 'Base de datos PostgreSQL serverless',
        proveedor: 'Neon Tech',
        conectada: true,
        configuracion: { connectionString: 'postgresql://***:***@ep-cool-name.neon.tech/neondb', region: 'us-east-1' },
        ultimaPruebaEn: ahora,
        ultimaPruebaExitosa: true,
      },
      {
        clave: 's3',
        nombre: 'AWS S3',
        descripcion: 'Almacenamiento de documentos y archivos',
        proveedor: 'Amazon Web Services',
        conectada: false,
        configuracion: { bucket: '', region: 'us-east-1', accessKey: '' },
        ultimaPruebaEn: null,
        ultimaPruebaExitosa: null,
      },
      {
        clave: 'sep_dgb',
        nombre: 'SEP-DGB',
        descripcion: 'Sincronización con el sistema central de la Dirección General de Bachillerato',
        proveedor: 'SEP México',
        conectada: false,
        configuracion: null,
        ultimaPruebaEn: null,
        ultimaPruebaExitosa: null,
      },
    ]);
    console.log('   ✓ Integraciones insertadas (4)');
  }

  // ── Preferencias del admin ──────────────────────────────────────────────
  const adminUserPref = await db.select({ id: users.id }).from(users).where(eq(users.email, 'admin@michoacan.gob.mx'));
  if (adminUserPref.length > 0) {
    const adminId = adminUserPref[0].id;
    const prefCount = await db.select({ c: sql<number>`count(*)` }).from(preferenciasUsuario).where(eq(preferenciasUsuario.userId, adminId));
    if (Number(prefCount[0].c) === 0) {
      await db.insert(preferenciasUsuario).values({
        userId: adminId,
        notifEmail: true,
        notifNavegador: false,
        resumenDiario: true,
        modoOscuro: false,
        idioma: 'es-MX',
        zonaHoraria: 'America/Mexico_City',
      });
      console.log('   ✓ Preferencias del admin insertadas');
    }
  }

  // ── Audit log demo ──────────────────────────────────────────────────────
  const auditCount = await db.select({ c: sql<number>`count(*)` }).from(auditLog);
  if (Number(auditCount[0].c) < 5) {
    const [adminUserAudit] = await db.select({ id: users.id }).from(users).where(eq(users.email, 'admin@michoacan.gob.mx'));
    const adminId2 = adminUserAudit?.id;
    const gestoresRes = await db.select({ id: gestores.userId, nombre: gestores.nombreCompleto }).from(gestores).limit(2);
    const g1 = gestoresRes[0];
    const g2 = gestoresRes[1];

    const makeDate = (daysAgo: number) => {
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      return d;
    };

    const auditEntries = [
      { userId: adminId2, userNombre: 'García Administrador', userRol: 'admin', accion: 'LOGIN', entidad: 'sesion', detalle: 'Inició sesión desde 187.190.12.45', ip: '187.190.12.45', createdAt: makeDate(0) },
      { userId: adminId2, userNombre: 'García Administrador', userRol: 'admin', accion: 'APROBAR', entidad: 'solicitud', entidadId: 1, detalle: 'Aprobó solicitud de Ana Cristina López y creó cuenta', ip: '187.190.12.45', createdAt: makeDate(1) },
      { userId: g1?.id, userNombre: g1?.nombre, userRol: 'gestor', accion: 'CREATE', entidad: 'estudiante', detalle: 'Creó alumno: Roberto Vargas Mendoza (CURP: VAMR990101HMN)', ip: '187.190.88.22', createdAt: makeDate(2) },
      { userId: adminId2, userNombre: 'García Administrador', userRol: 'admin', accion: 'UPDATE', entidad: 'documento', entidadId: 3, detalle: 'Aprobó documento "Acta de nacimiento" del alumno #3', ip: '187.190.12.45', createdAt: makeDate(2) },
      { userId: g2?.id, userNombre: g2?.nombre, userRol: 'gestor', accion: 'UPDATE', entidad: 'matricula', entidadId: 5, detalle: 'Capturó matrícula DGB 26016000201M para Diego Ramírez', ip: '172.31.0.10', createdAt: makeDate(3) },
      { userId: adminId2, userNombre: 'García Administrador', userRol: 'admin', accion: 'PUBLICAR', entidad: 'anuncio', entidadId: 1, detalle: 'Publicó anuncio "Convocatoria 2026-5A ya disponible"', ip: '187.190.12.45', createdAt: makeDate(3) },
      { userId: adminId2, userNombre: 'García Administrador', userRol: 'admin', accion: 'RECHAZAR', entidad: 'documento', entidadId: 8, detalle: 'Rechazó documento "INE" del alumno #7 — motivo: foto ilegible', ip: '187.190.12.45', createdAt: makeDate(4) },
      { userId: g1?.id, userNombre: g1?.nombre, userRol: 'gestor', accion: 'UPDATE', entidad: 'pago', detalle: 'Marcó pago $850 como verificado para alumno #2', ip: '192.168.1.5', createdAt: makeDate(4) },
      { userId: adminId2, userNombre: 'García Administrador', userRol: 'admin', accion: 'EXPORTAR', entidad: 'reporte', detalle: 'Generó reporte de inscripciones en formato Excel (87 registros)', ip: '187.190.12.45', createdAt: makeDate(5) },
      { userId: adminId2, userNombre: 'García Administrador', userRol: 'admin', accion: 'UPDATE', entidad: 'configuracion', detalle: 'Actualizó datos institucionales: teléfono general', ip: '187.190.12.45', createdAt: makeDate(6) },
      { userId: g2?.id, userNombre: g2?.nombre, userRol: 'gestor', accion: 'CREATE', entidad: 'estudiante', detalle: 'Creó alumno: Sofía Mendoza Torres (CURP: METS010203MML)', ip: '187.190.44.11', createdAt: makeDate(7) },
      { userId: adminId2, userNombre: 'García Administrador', userRol: 'admin', accion: 'LOGIN', entidad: 'sesion', detalle: 'Inició sesión desde 187.190.12.45', ip: '187.190.12.45', createdAt: makeDate(7) },
      { userId: adminId2, userNombre: 'García Administrador', userRol: 'admin', accion: 'APROBAR', entidad: 'solicitud', entidadId: 2, detalle: 'Aprobó solicitud de Patricia Velázquez Ríos', ip: '187.190.12.45', createdAt: makeDate(8) },
      { userId: g1?.id, userNombre: g1?.nombre, userRol: 'gestor', accion: 'UPDATE', entidad: 'expediente', detalle: 'Actualizó expediente del alumno #1: subió CURP', ip: '10.0.1.22', createdAt: makeDate(9) },
      { userId: adminId2, userNombre: 'García Administrador', userRol: 'admin', accion: 'UPDATE', entidad: 'conceptos_pago', detalle: 'Modificó concepto "Examen por módulo": monto $85.00 → $95.00', ip: '187.190.12.45', metadata: { antes: { monto: '85.00' }, despues: { monto: '95.00' } }, createdAt: makeDate(10) },
    ].filter((e) => e.userId != null);

    for (const entry of auditEntries) {
      await db.insert(auditLog).values(entry as any);
    }
    console.log(`   ✓ ${auditEntries.length} entradas de audit log demo insertadas`);
  }

  // ── Notificaciones demo ────────────────────────────────────────────────────
  console.log('🔔 Sembrando notificaciones demo...');
  const notifCount = await db.select({ c: sql<number>`count(*)` }).from(notificaciones);
  if (Number(notifCount[0].c) === 0) {
    const [adminUserNotif] = await db.select().from(users).where(eq(users.email, 'admin@michoacan.gob.mx'));
    const [gestorNotif] = await db.select().from(users).where(eq(users.email, 'm.ramirez@michoacan.gob.mx'));
    const [anaNotif] = await db.select().from(users).where(eq(users.email, 'ana.lopez@correo.com'));

    const minsAgo = (n: number) => { const d = new Date(); d.setMinutes(d.getMinutes() - n); return d; };

    const notifEntries = [
      ...(adminUserNotif ? [
        { userId: adminUserNotif.id, tipo: 'solicitud_nueva' as const, prioridad: 'alta' as const, titulo: 'Nueva solicitud de cuenta', cuerpo: 'Jorge Alfredo Ávila Mendoza solicitó una cuenta de acceso al sistema.', enlace: '/admin/solicitudes', leida: false, creadaEn: minsAgo(5) },
        { userId: adminUserNotif.id, tipo: 'solicitud_nueva' as const, prioridad: 'alta' as const, titulo: 'Nueva solicitud de cuenta', cuerpo: 'María Concepción Torres Reyes solicitó una cuenta de acceso al sistema.', enlace: '/admin/solicitudes', leida: false, creadaEn: minsAgo(90) },
        { userId: adminUserNotif.id, tipo: 'documento_subido_revisar' as const, prioridad: 'normal' as const, titulo: 'Documento pendiente de revisión', cuerpo: 'El gestor subió documento "acta_nacimiento" para un alumno.', enlace: '/admin/alumnos', leida: false, creadaEn: minsAgo(180) },
        { userId: adminUserNotif.id, tipo: 'pago_subido_verificar' as const, prioridad: 'alta' as const, titulo: 'Comprobante de pago recibido', cuerpo: 'Alumno subió comprobante de pago por $850. Pendiente de verificación.', enlace: '/admin/alumnos?filtro=pagos_pendientes', leida: true, creadaEn: minsAgo(300) },
        { userId: adminUserNotif.id, tipo: 'anuncio_dirigido' as const, prioridad: 'normal' as const, titulo: 'Anuncio publicado: Convocatoria 2026-5A', cuerpo: 'Se publicó un anuncio para "todos".', enlace: '/admin/anuncios', leida: true, creadaEn: minsAgo(1440) },
      ] : []),
      ...(gestorNotif ? [
        { userId: gestorNotif.id, tipo: 'alumno_asignado' as const, prioridad: 'normal' as const, titulo: 'Nuevo alumno asignado', cuerpo: 'Roberto Vargas Mendoza fue asignado a tu cartera de alumnos.', enlace: '/gestor/alumnos', leida: false, creadaEn: minsAgo(30) },
        { userId: gestorNotif.id, tipo: 'documento_aprobado' as const, prioridad: 'normal' as const, titulo: 'Documento aprobado', cuerpo: 'Tu revisión de "curp" para un alumno fue procesada correctamente.', enlace: '/gestor/alumnos', leida: true, creadaEn: minsAgo(720) },
        { userId: gestorNotif.id, tipo: 'mi_alumno_subio_documento' as const, prioridad: 'normal' as const, titulo: 'Alumno subió documento', cuerpo: 'Ana Cristina López subió su comprobante de domicilio para revisión.', enlace: '/gestor/alumnos', leida: false, creadaEn: minsAgo(45) },
        { userId: gestorNotif.id, tipo: 'matricula_asignada' as const, prioridad: 'alta' as const, titulo: 'Matrícula DGB confirmada', cuerpo: 'La matrícula 26016000201M fue validada por el sistema DGB.', enlace: '/gestor/alumnos', leida: true, creadaEn: minsAgo(2880) },
      ] : []),
      ...(anaNotif ? [
        { userId: anaNotif.id, tipo: 'documento_aprobado' as const, prioridad: 'normal' as const, titulo: 'Documento aprobado', cuerpo: 'Tu documento "curp" fue aprobado por tu gestor.', enlace: '/estudiante/expediente', leida: false, creadaEn: minsAgo(20) },
        { userId: anaNotif.id, tipo: 'documento_aprobado' as const, prioridad: 'normal' as const, titulo: 'Documento aprobado', cuerpo: 'Tu documento "acta_nacimiento" fue aprobado por tu gestor.', enlace: '/estudiante/expediente', leida: false, creadaEn: minsAgo(60) },
        { userId: anaNotif.id, tipo: 'pago_verificado' as const, prioridad: 'alta' as const, titulo: 'Pago verificado', cuerpo: 'Tu comprobante de pago fue verificado y aprobado.', enlace: '/estudiante', leida: false, creadaEn: minsAgo(120) },
        { userId: anaNotif.id, tipo: 'documento_rechazado' as const, prioridad: 'alta' as const, titulo: 'Documento rechazado — acción requerida', cuerpo: 'Tu documento "ine" fue rechazado. Motivo: La foto es ilegible, sube una imagen más clara.', enlace: '/estudiante/expediente', leida: true, creadaEn: minsAgo(1440) },
        { userId: anaNotif.id, tipo: 'anuncio_dirigido' as const, prioridad: 'normal' as const, titulo: 'Nuevo anuncio: Convocatoria 2026-5A disponible', cuerpo: 'Ya puedes consultar las fechas de la próxima convocatoria en el portal.', enlace: '/estudiante/avisos', leida: true, creadaEn: minsAgo(2160) },
      ] : []),
    ];

    if (notifEntries.length > 0) {
      for (const n of notifEntries) {
        await db.insert(notificaciones).values(n as any);
      }
      console.log(`   ✓ ${notifEntries.length} notificaciones demo insertadas`);
    } else {
      console.log('   ⚠ No se encontraron usuarios demo, omitiendo notificaciones');
    }
  } else {
    console.log(`   ✓ Notificaciones ya existían (${notifCount[0].c})`);
  }

  console.log('\n✅ Datos demo para presentación listos.\n');

  // ─── Outbox demo ──────────────────────────────────────────────────────────
  console.log('📧 Sembrando entradas de outbox demo...');
  const outboxCount = await db.select({ c: sql<number>`count(*)` }).from(outbox);
  if (Number(outboxCount[0].c) === 0) {
    // Buscar IDs de usuarios demo para relacionar
    const [anaUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, 'ana.lopez@correo.com'));
    const [adminUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, 'admin@michoacan.gob.mx'));
    const [gestorUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, 'm.ramirez@michoacan.gob.mx'));
    const [robertoUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, 'r.vargas@correo.com'));
    const [elenaUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, 'elena.cisneros@correo.com'));

    const PORTAL = process.env.PUBLIC_PORTAL_URL ?? 'https://edumich.up.railway.app';
    const FROM_EMAIL = process.env.EMAIL_FROM ?? 'noreply@edumich.up.railway.app';

    await db.insert(outbox).values([
      {
        toEmail: 'ana.lopez@correo.com',
        toName: 'Ana López',
        fromEmail: FROM_EMAIL,
        fromName: 'Preparatoria Abierta Michoacán',
        subject: '¡Bienvenida a Preparatoria Abierta Michoacán! Tus datos de acceso',
        html: `<p>Bienvenida Ana, tus credenciales son: ana.lopez@correo.com / demo1234</p>`,
        evento: 'cuenta_creada_alumno',
        estado: 'demo_mode',
        triggeredByUserId: gestorUser?.id ?? null,
        relatedUserId: anaUser?.id ?? null,
        metadata: { municipio: 'Pátzcuaro', gestor: 'M. Ramírez' },
        createdAt: daysAgoDate(5),
        sentAt: daysAgoDate(5),
      },
      {
        toEmail: 'r.vargas@correo.com',
        toName: 'Roberto Vargas Méndez',
        fromEmail: FROM_EMAIL,
        fromName: 'Preparatoria Abierta Michoacán',
        subject: '¡Bienvenido a Preparatoria Abierta Michoacán! Tus datos de acceso',
        html: `<p>Bienvenido Roberto, tus credenciales son: r.vargas@correo.com / demo1234</p>`,
        evento: 'cuenta_creada_alumno',
        estado: 'demo_mode',
        triggeredByUserId: gestorUser?.id ?? null,
        relatedUserId: robertoUser?.id ?? null,
        metadata: { municipio: 'Uruapan' },
        createdAt: daysAgoDate(3),
        sentAt: daysAgoDate(3),
      },
      {
        toEmail: 'elena.cisneros@correo.com',
        toName: 'Elena Cisneros',
        fromEmail: FROM_EMAIL,
        fromName: 'Preparatoria Abierta Michoacán',
        subject: '¡Bienvenida a Preparatoria Abierta Michoacán! Tus datos de acceso',
        html: `<p>Bienvenida Elena, tus credenciales son: elena.cisneros@correo.com / demo1234</p>`,
        evento: 'cuenta_creada_alumno',
        estado: 'demo_mode',
        triggeredByUserId: adminUser?.id ?? null,
        relatedUserId: elenaUser?.id ?? null,
        metadata: { municipio: 'Pátzcuaro', aprobadaVia: 'solicitud_cuenta' },
        createdAt: daysAgoDate(8),
        sentAt: daysAgoDate(8),
      },
      {
        toEmail: 'm.ramirez@michoacan.gob.mx',
        toName: 'Manuel Ramírez',
        fromEmail: FROM_EMAIL,
        fromName: 'Preparatoria Abierta Michoacán',
        subject: 'Bienvenido al sistema de gestión — Preparatoria Abierta Michoacán',
        html: `<p>Bienvenido Manuel, eres Gestor Municipal de Pátzcuaro.</p>`,
        evento: 'cuenta_creada_gestor',
        estado: 'demo_mode',
        triggeredByUserId: adminUser?.id ?? null,
        relatedUserId: gestorUser?.id ?? null,
        metadata: { municipio: 'Pátzcuaro', titulo: 'Gestor Municipal' },
        createdAt: daysAgoDate(14),
        sentAt: daysAgoDate(14),
      },
      {
        toEmail: 'admin@michoacan.gob.mx',
        toName: 'Administración IEMSyS',
        fromEmail: FROM_EMAIL,
        fromName: 'Preparatoria Abierta Michoacán',
        subject: 'Nueva solicitud de registro — Sofía Castañeda Reyes',
        html: `<p>Nueva solicitud de cuenta de Sofía Castañeda Reyes, municipio Morelia.</p>`,
        evento: 'notificacion_admin_autoregistro',
        estado: 'demo_mode',
        metadata: { aspirante: 'Sofía Castañeda Reyes', municipio: 'Morelia', folio: 'SOL-DEMO-04' },
        createdAt: daysAgoDate(4),
        sentAt: daysAgoDate(4),
      },
      {
        toEmail: 'juana.rodriguez@correo.com',
        toName: 'Juana Rodríguez Mendoza',
        fromEmail: FROM_EMAIL,
        fromName: 'Preparatoria Abierta Michoacán',
        subject: 'Recibimos tu solicitud — Preparatoria Abierta Michoacán',
        html: `<p>Hola Juana, recibimos tu solicitud de inscripción. Un gestor te contactará pronto.</p>`,
        evento: 'autoregistro_alumno',
        estado: 'demo_mode',
        metadata: { municipio: 'Morelia', folio: 'SOL-DEMO-01' },
        createdAt: daysAgoDate(12),
        sentAt: daysAgoDate(12),
      },
    ]);
    console.log('   ✓ 6 entradas de outbox demo insertadas');
  } else {
    console.log(`   ✓ Outbox ya tenía ${outboxCount[0].c} entradas`);
  }

  console.log('');
  console.log('✅ Seed completado.\n');
  console.log('Credenciales de demo:');
  console.log('  Admin:       admin@michoacan.gob.mx / demo1234');
  console.log('  Gestor 1:    m.ramirez@michoacan.gob.mx / demo1234  (Pátzcuaro)');
  console.log('  Gestor 2:    l.gonzalez@michoacan.gob.mx / demo1234 (Morelia)');
  console.log('  Gestor 3:    j.hernandez@michoacan.gob.mx / demo1234 (Uruapan)');
  console.log('  Alumna ⭐:   ana.lopez@correo.com / demo1234       (caso estrella)');
  console.log('  Alumno:      j.ramirez.b@correo.com / demo1234     (en revisión)');
  console.log('  Alumna:      elena.cisneros@correo.com / demo1234  (incompleta)');
  console.log('  Alumna:      p.velazquez@correo.com / demo1234     (22 módulos)');
  console.log('  Alumno:      diego.ramirez@correo.com / demo1234   (inscrito activo)');
  console.log('  Alumna 🔑:   sofia.mendoza@correo.com / demo1234   (primer login)');
  console.log('  Alumno:      r.vargas@correo.com / demo1234        (doc rechazado)');
  console.log('  Alumna:      m.torres@correo.com / demo1234        (espera etapa)');
  console.log('  Alumno:      carlos.hernandez@correo.com / demo1234 (sin gestor)');
  console.log('  Alumno:      axel.jimenez@correo.com / demo1234    (autodirigido)');
  console.log('  Alumno ⚠:   andres.soto@correo.com / demo1234     (aviso eliminación — 4 días)');
  console.log('  Alumna ⚠:   marta.jimenez@correo.com / demo1234   (aviso eliminación — 2 días)');
  console.log('  Alumno 🗑:   pedro.lara@correo.com / demo1234      (soft-deleted)\n');

  await pool.end();
}

main().catch((err) => {
  console.error('❌ Error en seed:', err);
  process.exit(1);
});
