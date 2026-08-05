/**
 * Rutas del perfil DIRECCIÓN DE PROGRAMA — solo lectura, solo agregados.
 *
 * Principio de diseño (modelo Blackboard/Anthology + Canvas Admin Analytics):
 * este perfil ve indicadores y tendencias del programa completo, pero NUNCA
 * datos personales de un alumno (nombre, CURP, expediente, documentos).
 * Todos los endpoints devuelven conteos, tasas, promedios y series.
 *
 * GET /panorama     — KPIs, funnel de inscripción, tendencia, etapas, municipios
 * GET /academico    — aprobación por módulo, distribución de avance, riesgo agregado
 * GET /operacion    — productividad de gestores, tiempos de respuesta, backlog
 * GET /salud        — golden signals del API, base de datos, correo, uptime
 * GET /proyecciones — series históricas mensuales + proyección lineal
 */

import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { sql, eq, count, gte, lte, like, isNull, and, countDistinct, inArray, desc } from 'drizzle-orm';
import { db } from '../db';
import {
  users,
  directores,
  estudiantes,
  gestores,
  administradores,
  municipios,
  solicitudesCuenta,
  expedienteDocumentos,
  pagos,
  pagosExamen,
  examenesInscripciones,
  convocatoriasEtapas,
  outbox,
  notasCreador,
  auditLog,
  centrosPadron,
} from '@workspace/db/schema';
import { authRequired, requireRol } from '../middleware/auth';
import { patronLike } from '../utils/like';
import { generarPasswordTemporal } from '../utils/password';
import { urlPortalLogin } from '../utils/portal';
import { invalidarSesiones } from '../utils/revocacion';
import { tryAuditLog } from '../utils/audit';
import { verificarBitacora } from '../services/verificarBitacora';
import { CALIF_MINIMA_APROBATORIA, TOTAL_MODULOS_PLAN22 } from '../utils/calificacion';
import { puedeRevelarCredenciales, sendBienvenidaGestor, sendBienvenidaAdmin, sendCorreoAccesoCambiado } from '../services/email';
import { metricasSinMovimiento } from '../services/depuracion';
import { resumenMetricas, serieMetricas, PROCESS_START, obtenerErroresRecientes } from '../middleware/metrics';
import { correrChequeos } from '../utils/chequeosIntegridad';
import { serie, METRICAS } from '../services/metricasDiarias';
import { pool } from '@workspace/db';

const router = Router();
router.use(authRequired, requireRol('direccion'));

// Métricas de cuentas sin movimiento (para decidir la depuración consciente).
// El creador (dirección) las ve aunque el resto del panel esté en preparación.
router.get('/depuracion-metricas', async (_req, res) => {
  res.json(await metricasSinMovimiento());
});

const DOCS_OBLIGATORIOS = `('curp','acta_nacimiento','ine','comprobante_domicilio','certificado_secundaria')`;
const TOTAL_MODULOS = TOTAL_MODULOS_PLAN22;

function num(v: unknown): number {
  return Number(v ?? 0);
}

/** Regresión lineal simple sobre una serie; devuelve proyección de n puntos. */
function proyectarLineal(valores: number[], puntos: number): number[] {
  const n = valores.length;
  if (n < 2) return Array(puntos).fill(valores[0] ?? 0);
  const xMean = (n - 1) / 2;
  const yMean = valores.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (i - xMean) * (valores[i] - yMean);
    sxx += (i - xMean) * (i - xMean);
  }
  const pendiente = sxx === 0 ? 0 : sxy / sxx;
  const intercepto = yMean - pendiente * xMean;
  return Array.from({ length: puntos }, (_, k) =>
    Math.max(0, Math.round(intercepto + pendiente * (n + k)))
  );
}

/** Serie mensual de conteos: rellena meses vacíos con 0. */
async function serieMensual(query: string, meses: number): Promise<Array<{ mes: string; total: number }>> {
  const result = await db.execute<{ mes: string; total: string | number }>(sql.raw(query));
  const porMes = new Map<string, number>();
  for (const row of result.rows) porMes.set(String(row.mes), num(row.total));

  const out: Array<{ mes: string; total: number }> = [];
  const hoy = new Date();
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push({ mes: clave, total: porMes.get(clave) ?? 0 });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────
// GET /panorama
// ─────────────────────────────────────────────────────────────────────────
router.get('/panorama', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const [dir] = await db
      .select({ nombreCompleto: directores.nombreCompleto, puesto: directores.puesto })
      .from(directores)
      .where(eq(directores.userId, userId));

    // ── KPIs generales ──
    const [{ cnt: alumnosTotal }] = await db
      .select({ cnt: count() })
      .from(estudiantes)
      .where(eq(estudiantes.estadoCuenta, 'activa'));
    const [{ cnt: alumnosNuevos7d }] = await db
      .select({ cnt: count() })
      .from(estudiantes)
      .where(gte(estudiantes.createdAt, sql`NOW() - INTERVAL '7 days'`));
    const [{ cnt: gestoresActivos }] = await db
      .select({ cnt: count() })
      .from(gestores)
      .where(eq(gestores.estado, 'activo'));
    const [{ cnt: municipiosCubiertos }] = await db
      .select({ cnt: countDistinct(gestores.municipioId) })
      .from(gestores)
      .where(eq(gestores.estado, 'activo'));
    const [{ cnt: accesosHoy }] = await db
      .select({ cnt: count() })
      .from(users)
      .where(gte(users.ultimoLogin, sql`date_trunc('day', NOW())`));

    // ── Funnel de inscripción (modelo Coursera: dónde se fuga la gente) ──
    const [{ cnt: solicitudesTotal }] = await db.select({ cnt: count() }).from(solicitudesCuenta);
    const [{ cnt: solicitudesAprobadas }] = await db
      .select({ cnt: count() })
      .from(solicitudesCuenta)
      .where(eq(solicitudesCuenta.estado, 'aprobada'));

    const expCompletos = await db.execute(sql.raw(`
      SELECT count(*) AS total FROM (
        SELECT estudiante_id FROM expediente_documentos
        WHERE estado = 'aprobado' AND tipo IN ${DOCS_OBLIGATORIOS}
        GROUP BY estudiante_id HAVING count(DISTINCT tipo) >= 5
      ) x
    `));
    const expedientesCompletos = num((expCompletos.rows[0] as { total?: unknown })?.total);

    const [{ cnt: conMatricula }] = await db
      .select({ cnt: count() })
      .from(estudiantes)
      .where(sql`${estudiantes.matriculaOficialDGB} IS NOT NULL`);

    const egresadosRes = await db.execute(sql.raw(`
      SELECT count(*) AS total FROM (
        SELECT estudiante_id FROM estudiantes_modulos_progreso
        WHERE estado = 'aprobado'
        GROUP BY estudiante_id HAVING count(*) >= ${TOTAL_MODULOS}
      ) x
    `));
    const egresados = num((egresadosRes.rows[0] as { total?: unknown })?.total);

    // ── Inscripciones por etapa DGB del año ──
    const anio = new Date().getFullYear();
    const etapasRows = await db
      .select()
      .from(convocatoriasEtapas)
      .where(eq(convocatoriasEtapas.anio, anio))
      .orderBy(convocatoriasEtapas.solicitudInicio);

    const inscripcionesPorEtapa = await Promise.all(
      etapasRows.map(async (etapa) => {
        const [{ cnt }] = await db
          .select({ cnt: count() })
          .from(examenesInscripciones)
          .where(eq(examenesInscripciones.etapaId, etapa.id));
        return {
          clave: etapa.clave,
          inscritos: num(cnt),
          activa: etapa.estado === 'inscripcion_abierta',
          futura: new Date(etapa.solicitudInicio) > new Date(),
        };
      })
    );

    // ── Tendencia mensual de registros (12 meses) ──
    const tendenciaRegistros = await serieMensual(
      `SELECT to_char(created_at, 'YYYY-MM') AS mes, count(*) AS total
       FROM estudiantes
       WHERE created_at >= NOW() - INTERVAL '12 months'
       GROUP BY 1 ORDER BY 1`,
      12
    );

    // ── Distribución por municipio (agregado, top 8) ──
    const municipiosTop = await db
      .select({ nombre: municipios.nombre, total: count(estudiantes.userId) })
      .from(estudiantes)
      .innerJoin(municipios, eq(estudiantes.municipioId, municipios.id))
      .groupBy(municipios.nombre)
      .orderBy(sql`count(*) DESC`)
      .limit(8);

    res.json({
      director: { nombre: dir?.nombreCompleto ?? 'Dirección', puesto: dir?.puesto ?? null },
      kpis: {
        alumnosActivos: { total: num(alumnosTotal), nuevosSemana: num(alumnosNuevos7d) },
        gestoresActivos: { total: num(gestoresActivos), municipiosCubiertos: num(municipiosCubiertos) },
        accesosHoy: num(accesosHoy),
        egresados,
      },
      funnel: [
        { etapa: 'Solicitudes recibidas', total: num(solicitudesTotal) },
        { etapa: 'Cuentas aprobadas', total: num(solicitudesAprobadas) },
        { etapa: 'Alumnos registrados', total: num(alumnosTotal) },
        { etapa: 'Expediente completo', total: expedientesCompletos },
        { etapa: 'Con matrícula DGB', total: num(conMatricula) },
        { etapa: 'Egresados', total: egresados },
      ],
      inscripcionesPorEtapa,
      tendenciaRegistros,
      municipiosTop: municipiosTop.map((m) => ({ nombre: m.nombre, total: num(m.total) })),
    });
  } catch (e) {
    console.error('[direccion/panorama]', e);
    res.status(500).json({ error: 'Error al calcular el panorama' });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// GET /academico
// ─────────────────────────────────────────────────────────────────────────
router.get('/academico', async (_req, res) => {
  try {
    // Tasa de aprobación y promedio por módulo (exámenes DGB capturados)
    const porModulo = await db.execute(sql.raw(`
      SELECT m.numero, m.nombre, m.nivel,
             count(c.id) AS presentados,
             count(c.id) FILTER (WHERE c.aprobado) AS aprobados,
             round(avg(c.calificacion)) AS promedio
      FROM modulos m
      LEFT JOIN calificaciones c ON c.modulo_id = m.id
      GROUP BY m.id, m.numero, m.nombre, m.nivel
      ORDER BY m.numero
    `));

    // Distribución de avance: cuántos alumnos llevan N módulos aprobados
    const distribucion = await db.execute(sql.raw(`
      WITH avance AS (
        SELECT e.user_id,
               count(p.id) FILTER (WHERE p.estado = 'aprobado') AS aprobados
        FROM estudiantes e
        LEFT JOIN estudiantes_modulos_progreso p ON p.estudiante_id = e.user_id
        WHERE e.estado_cuenta = 'activa'
        GROUP BY e.user_id
      )
      SELECT CASE
               WHEN aprobados = 0 THEN 'Sin iniciar'
               WHEN aprobados BETWEEN 1 AND 5 THEN '1–5 módulos'
               WHEN aprobados BETWEEN 6 AND 10 THEN '6–10 módulos'
               WHEN aprobados BETWEEN 11 AND 15 THEN '11–15 módulos'
               WHEN aprobados BETWEEN 16 AND 21 THEN '16–21 módulos'
               ELSE 'Egresado (22)'
             END AS rango,
             min(aprobados) AS orden,
             count(*) AS alumnos
      FROM avance GROUP BY 1 ORDER BY 2
    `));

    // Alumnos en riesgo (agregado): sin actividad en 90+ días, por municipio
    const riesgo = await db.execute(sql.raw(`
      SELECT count(*) AS total,
             count(*) FILTER (WHERE ultima_actividad_en < NOW() - INTERVAL '180 days'
                              OR ultima_actividad_en IS NULL) AS criticos
      FROM estudiantes
      WHERE estado_cuenta = 'activa'
        AND (ultima_actividad_en < NOW() - INTERVAL '90 days' OR ultima_actividad_en IS NULL)
    `));
    const riesgoPorMunicipio = await db.execute(sql.raw(`
      SELECT m.nombre, count(*) AS total
      FROM estudiantes e
      JOIN municipios m ON m.id = e.municipio_id
      WHERE e.estado_cuenta = 'activa'
        AND (e.ultima_actividad_en < NOW() - INTERVAL '90 days' OR e.ultima_actividad_en IS NULL)
      GROUP BY m.nombre ORDER BY count(*) DESC LIMIT 6
    `));

    // Resumen global
    const global = await db.execute(sql.raw(`
      SELECT round(avg(calificacion)) AS promedio_global,
             count(*) AS examenes_totales,
             count(*) FILTER (WHERE aprobado) AS examenes_aprobados
      FROM calificaciones
    `));
    const g = global.rows[0] as Record<string, unknown>;

    const riesgoRow = riesgo.rows[0] as Record<string, unknown>;
    res.json({
      resumen: {
        promedioGlobal: num(g?.promedio_global),
        examenesTotales: num(g?.examenes_totales),
        tasaAprobacion:
          num(g?.examenes_totales) > 0
            ? Math.round((num(g?.examenes_aprobados) / num(g?.examenes_totales)) * 100)
            : 0,
      },
      porModulo: (porModulo.rows as Array<Record<string, unknown>>).map((r) => ({
        numero: num(r.numero),
        nombre: String(r.nombre),
        nivel: r.nivel === null ? null : num(r.nivel),
        presentados: num(r.presentados),
        aprobados: num(r.aprobados),
        promedio: num(r.promedio),
        tasaAprobacion: num(r.presentados) > 0 ? Math.round((num(r.aprobados) / num(r.presentados)) * 100) : 0,
      })),
      distribucionAvance: (distribucion.rows as Array<Record<string, unknown>>).map((r) => ({
        rango: String(r.rango),
        alumnos: num(r.alumnos),
      })),
      riesgo: {
        total: num(riesgoRow?.total),
        criticos: num(riesgoRow?.criticos),
        porMunicipio: (riesgoPorMunicipio.rows as Array<Record<string, unknown>>).map((r) => ({
          nombre: String(r.nombre),
          total: num(r.total),
        })),
      },
    });
  } catch (e) {
    console.error('[direccion/academico]', e);
    res.status(500).json({ error: 'Error al calcular indicadores académicos' });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// GET /operacion
// ─────────────────────────────────────────────────────────────────────────
router.get('/operacion', async (_req, res) => {
  try {
    // Backlog operativo actual
    const [{ cnt: docsPendientes }] = await db
      .select({ cnt: count() })
      .from(expedienteDocumentos)
      .where(eq(expedienteDocumentos.estado, 'pendiente_revision'));
    // OJO: este indicador leía la tabla `pagos`, que tiene 0 filas desde que
    // el modelo real pasó a ser `pagos_examen`. Marcaba 0 pasara lo que
    // pasara — un indicador que no puede subir no informa, tranquiliza.
    // 'en_revision' = el alumno subió comprobante y falta verificarlo;
    // 'pagado' ya está conciliado y por eso no cuenta aquí.
    const [{ cnt: pagosPendientes }] = await db
      .select({ cnt: count() })
      .from(pagosExamen)
      .where(eq(pagosExamen.estado, 'en_revision'));
    const [{ cnt: solicitudesPendientes }] = await db
      .select({ cnt: count() })
      .from(solicitudesCuenta)
      .where(eq(solicitudesCuenta.estado, 'pendiente'));
    const [{ cnt: califPendientes }] = await db
      .select({ cnt: count() })
      .from(examenesInscripciones)
      .where(and(isNull(examenesInscripciones.calificacion), eq(examenesInscripciones.estado, 'presentado')));

    // Tiempos de respuesta (horas promedio, últimos 90 días)
    const tiempos = await db.execute(sql.raw(`
      SELECT
        (SELECT round(avg(EXTRACT(EPOCH FROM (revisado_en - subido_en)) / 3600))
           FROM expediente_documentos
           WHERE revisado_en IS NOT NULL AND subido_en >= NOW() - INTERVAL '90 days') AS docs_horas,
        (SELECT round(avg(EXTRACT(EPOCH FROM (verificado_en - created_at)) / 3600))
           FROM pagos_examen
           WHERE verificado_en IS NOT NULL AND created_at >= NOW() - INTERVAL '90 days') AS pagos_horas,
        (SELECT round(avg(EXTRACT(EPOCH FROM (procesada_en - created_at)) / 3600))
           FROM solicitudes_cuenta
           WHERE procesada_en IS NOT NULL AND created_at >= NOW() - INTERVAL '90 days') AS solicitudes_horas
    `));
    const t = tiempos.rows[0] as Record<string, unknown>;

    // Productividad de gestores (agregado por gestor — personal interno)
    const gestoresProd = await db.execute(sql.raw(`
      SELECT g.nombre_completo AS nombre,
             m.nombre AS municipio,
             g.estado,
             count(e.user_id) AS alumnos,
             count(e.user_id) FILTER (WHERE e.matricula_oficial_dgb IS NOT NULL) AS con_matricula
      FROM gestores g
      LEFT JOIN municipios m ON m.id = g.municipio_id
      LEFT JOIN estudiantes e ON e.gestor_id = g.user_id AND e.estado_cuenta = 'activa'
      GROUP BY g.user_id, g.nombre_completo, m.nombre, g.estado
      ORDER BY count(e.user_id) DESC
      LIMIT 10
    `));

    // Salud del correo (últimos 7 días)
    const correos = await db.execute(sql.raw(`
      SELECT estado, count(*) AS total
      FROM outbox
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY estado
    `));
    const correosPorEstado: Record<string, number> = {};
    for (const r of correos.rows as Array<Record<string, unknown>>) {
      correosPorEstado[String(r.estado)] = num(r.total);
    }

    res.json({
      backlog: {
        documentosPorRevisar: num(docsPendientes),
        pagosPorVerificar: num(pagosPendientes),
        solicitudesPendientes: num(solicitudesPendientes),
        calificacionesPorCapturar: num(califPendientes),
      },
      tiemposRespuestaHoras: {
        revisionDocumentos: num(t?.docs_horas),
        verificacionPagos: num(t?.pagos_horas),
        procesamientoSolicitudes: num(t?.solicitudes_horas),
      },
      gestores: (gestoresProd.rows as Array<Record<string, unknown>>).map((r) => ({
        nombre: String(r.nombre),
        municipio: r.municipio ? String(r.municipio) : null,
        estado: String(r.estado),
        alumnos: num(r.alumnos),
        conMatricula: num(r.con_matricula),
      })),
      correos7d: {
        enviados: correosPorEstado['enviado'] ?? 0,
        fallidos: correosPorEstado['fallido'] ?? 0,
        pendientes: correosPorEstado['pendiente'] ?? 0,
      },
    });
  } catch (e) {
    console.error('[direccion/operacion]', e);
    res.status(500).json({ error: 'Error al calcular indicadores de operación' });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// GET /salud — golden signals (latencia, tráfico, errores) + dependencias
// ─────────────────────────────────────────────────────────────────────────
router.get('/salud', async (_req, res) => {
  try {
    // Ping a la base de datos (medido)
    const dbInicio = process.hrtime.bigint();
    let dbOk = true;
    try {
      await db.execute(sql`SELECT 1`);
    } catch {
      dbOk = false;
    }
    const dbPingMs = Math.round(Number(process.hrtime.bigint() - dbInicio) / 1e6);

    // Correo: acumulado 24 h y fallidos recientes
    const correos = await db.execute(sql.raw(`
      SELECT estado, count(*) AS total
      FROM outbox
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY estado
    `));
    const correos24h: Record<string, number> = {};
    for (const r of correos.rows as Array<Record<string, unknown>>) {
      correos24h[String(r.estado)] = num(r.total);
    }

    // ¿Corrió la depuración? Es el trabajo que BORRA cuentas y corre a las 3
    // de la mañana: que deje de correr no se nota, porque no pasa nada. Aquí se
    // ve la última corrida buena y si viene retrasada.
    const { rows: trabajos } = await db.execute<{
      ultimo_exito_en: Date | null; ultimo_error: string | null;
      ultimo_dia_corrido: string | null; ejecuciones: number;
    }>(sql`SELECT ultimo_exito_en, ultimo_error, ultimo_dia_corrido, ejecuciones
             FROM job_locks WHERE nombre = 'depuracion'`);
    const dep = trabajos[0] ?? null;
    const horasDesdeExito = dep?.ultimo_exito_en
      ? (Date.now() - new Date(dep.ultimo_exito_en).getTime()) / 36e5
      : null;

    res.json({
      depuracion: {
        ultimoExitoEn: dep?.ultimo_exito_en ?? null,
        ultimoDiaCorrido: dep?.ultimo_dia_corrido ?? null,
        ultimoError: dep?.ultimo_error ?? null,
        ejecuciones: dep?.ejecuciones ?? 0,
        // Debería correr cada noche. Pasadas 48 h algo dejó de funcionar.
        atrasada: horasDesdeExito === null ? null : horasDesdeExito > 48,
      },
      uptime: {
        desdeMs: PROCESS_START,
        segundos: Math.floor((Date.now() - PROCESS_START) / 1000),
      },
      api: {
        ultimaHora: resumenMetricas(60),
        ultimas24h: resumenMetricas(24 * 60),
        seriePorMinuto: serieMetricas(60),
      },
      baseDatos: { ok: dbOk, pingMs: dbPingMs },
      correo24h: {
        enviados: correos24h['enviado'] ?? 0,
        fallidos: correos24h['fallido'] ?? 0,
        pendientes: correos24h['pendiente'] ?? 0,
      },
      erroresRecientes: obtenerErroresRecientes(30),
      tareasProgramadas: [
        { nombre: 'Reportes programados', horario: 'Cada hora (minuto 0)' },
        { nombre: 'Depuración de cuentas inactivas (LGPDPPSO)', horario: '03:00 America/Mexico_City' },
      ],
    });
  } catch (e) {
    console.error('[direccion/salud]', e);
    res.status(500).json({ error: 'Error al calcular salud del sistema' });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// GET /proyecciones — series históricas + regresión lineal a 3 meses
// ─────────────────────────────────────────────────────────────────────────
router.get('/proyecciones', async (_req, res) => {
  try {
    const MESES_HISTORIA = 12;
    const MESES_PROYECCION = 3;

    const registros = await serieMensual(
      `SELECT to_char(created_at, 'YYYY-MM') AS mes, count(*) AS total
       FROM estudiantes WHERE created_at >= NOW() - INTERVAL '${MESES_HISTORIA} months'
       GROUP BY 1 ORDER BY 1`,
      MESES_HISTORIA
    );
    const inscripcionesExamen = await serieMensual(
      `SELECT to_char(created_at, 'YYYY-MM') AS mes, count(*) AS total
       FROM examenes_inscripciones WHERE created_at >= NOW() - INTERVAL '${MESES_HISTORIA} months'
       GROUP BY 1 ORDER BY 1`,
      MESES_HISTORIA
    );
    const modulosAprobados = await serieMensual(
      `SELECT to_char(fecha_examen, 'YYYY-MM') AS mes, count(*) AS total
       FROM calificaciones WHERE aprobado AND fecha_examen >= NOW() - INTERVAL '${MESES_HISTORIA} months'
       GROUP BY 1 ORDER BY 1`,
      MESES_HISTORIA
    );

    function conProyeccion(serie: Array<{ mes: string; total: number }>) {
      const valores = serie.map((s) => s.total);
      const proyectados = proyectarLineal(valores.slice(-6), MESES_PROYECCION);
      const ultimo = serie[serie.length - 1];
      const [anio, mes] = ultimo.mes.split('-').map(Number);
      const proyeccion = proyectados.map((total, k) => {
        const d = new Date(anio, mes - 1 + k + 1, 1);
        return {
          mes: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
          total,
        };
      });
      return { historia: serie, proyeccion };
    }

    // Ritmo de egreso: promedio de módulos aprobados por alumno activo al mes
    // (últimos 6 meses) → estimación de meses restantes promedio para egresar.
    const ritmo = await db.execute(sql.raw(`
      WITH activos AS (
        SELECT count(*) AS n FROM estudiantes WHERE estado_cuenta = 'activa'
      ),
      aprobados6m AS (
        SELECT count(*) AS n FROM calificaciones
        WHERE aprobado AND fecha_examen >= NOW() - INTERVAL '6 months'
      ),
      avance AS (
        SELECT avg(cnt) AS prom FROM (
          SELECT count(*) AS cnt FROM estudiantes_modulos_progreso
          WHERE estado = 'aprobado' GROUP BY estudiante_id
        ) x
      )
      SELECT activos.n AS activos, aprobados6m.n AS aprobados_6m, round(avance.prom, 1) AS avance_promedio
      FROM activos, aprobados6m, avance
    `));
    const r = ritmo.rows[0] as Record<string, unknown>;
    const activos = num(r?.activos);
    const aprobadosPorMes = num(r?.aprobados_6m) / 6;
    const avancePromedio = Number(r?.avance_promedio ?? 0);
    const ritmoPorAlumno = activos > 0 ? aprobadosPorMes / activos : 0;
    const mesesParaEgresoPromedio =
      ritmoPorAlumno > 0 ? Math.round((TOTAL_MODULOS - avancePromedio) / ritmoPorAlumno) : null;

    res.json({
      registrosAlumnos: conProyeccion(registros),
      inscripcionesExamen: conProyeccion(inscripcionesExamen),
      modulosAprobados: conProyeccion(modulosAprobados),
      ritmoEgreso: {
        alumnosActivos: activos,
        modulosAprobadosPorMes: Math.round(aprobadosPorMes * 10) / 10,
        avancePromedioModulos: avancePromedio,
        mesesParaEgresoPromedio,
      },
      nota: 'Proyección por regresión lineal sobre los últimos 6 meses. Es una tendencia estadística, no una meta.',
    });
  } catch (e) {
    console.error('[direccion/proyecciones]', e);
    res.status(500).json({ error: 'Error al calcular proyecciones' });
  }
});

/**
 * GET /integridad — estado de salud de los DATOS (no del servidor).
 *
 * Responde la lista completa de chequeos, sanos incluidos: ver que algo se
 * está vigilando vale tanto como ver la alarma. Un chequeo que no se pudo
 * ejecutar viene con `hallazgos: null` y su error, en vez de desaparecer.
 */
router.get('/integridad', async (_req, res) => {
  try {
    const chequeos = await correrChequeos();
    const criticos = chequeos.filter((c) => c.nivel === 'critico' && (c.hallazgos ?? 0) > 0).length;
    const avisos = chequeos.filter((c) => c.nivel === 'aviso' && (c.hallazgos ?? 0) > 0).length;
    const rotos = chequeos.filter((c) => c.hallazgos === null).length;
    res.json({
      revisadoEn: new Date().toISOString(),
      resumen: { total: chequeos.length, criticos, avisos, rotos },
      chequeos,
    });
  } catch (e) {
    console.error('[direccion/integridad]', e);
    res.status(500).json({ error: 'No se pudo revisar la integridad de los datos' });
  }
});

/**
 * GET /insights — el panorama del creador, sin abrir la base.
 *
 * Todo lo que aquí aparece sale de consultas agregadas: dinero, embudo,
 * crecimiento, cobertura, resultados académicos y contenido. Ningún dato
 * personal de alumnos.
 *
 * Sobre el dinero: se reporta el desglose GUARDADO y también el RECALCULADO
 * a partir de cantidad_examenes × tarifa. Cuando no coinciden es que hay
 * fichas con el reparto mal grabado, y conviene verlo en vez de elegir en
 * silencio el número que más nos guste.
 */
router.get('/insights', async (_req, res) => {
  try {
    const uno = async (sqlTexto: string) => (await pool.query(sqlTexto)).rows;

    const [dinero] = await uno(`
      SELECT
        count(*) FILTER (WHERE estado = 'pagado')::int AS fichas_pagadas,
        COALESCE(sum(cantidad_examenes) FILTER (WHERE estado = 'pagado'), 0)::int AS examenes_pagados,
        COALESCE(sum(monto_total)    FILTER (WHERE estado = 'pagado'), 0)::float AS cobrado,
        COALESCE(sum(monto_iemsys)   FILTER (WHERE estado = 'pagado'), 0)::float AS iemsys_guardado,
        COALESCE(sum(monto_synapsis) FILTER (WHERE estado = 'pagado'), 0)::float AS synapsis_guardado,
        COALESCE(sum(cantidad_examenes) FILTER (WHERE estado = 'pagado'), 0)::float * 101 AS iemsys_recalculado,
        COALESCE(sum(cantidad_examenes) FILTER (WHERE estado = 'pagado'), 0)::float * 30  AS synapsis_recalculado,
        count(*) FILTER (WHERE estado <> 'cancelado'
                         AND (monto_iemsys + monto_synapsis) <> monto_total)::int AS fichas_descuadradas,
        COALESCE(sum(monto_total) FILTER (WHERE estado IN ('emitida','en_revision')), 0)::float AS por_cobrar
      FROM pagos_examen`);

    const porMes = await uno(`
      SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS mes,
             count(*)::int AS fichas,
             COALESCE(sum(cantidad_examenes), 0)::int AS examenes,
             COALESCE(sum(cantidad_examenes), 0)::float * 30 AS synapsis
        FROM pagos_examen WHERE estado = 'pagado'
       GROUP BY 1 ORDER BY 1`);

    const [embudo] = await uno(`
      SELECT
        (SELECT count(*) FROM solicitudes_cuenta)::int AS solicitudes,
        (SELECT count(*) FROM estudiantes)::int AS alumnos,
        (SELECT count(*) FROM (
           SELECT estudiante_id FROM expediente_documentos
            WHERE estado = 'aprobado' AND tipo IN ${DOCS_OBLIGATORIOS}
            GROUP BY estudiante_id HAVING count(DISTINCT tipo) = 5) t)::int AS expediente_completo,
        (SELECT count(DISTINCT estudiante_id) FROM pagos_examen
          WHERE estado = 'pagado' AND estudiante_id IS NOT NULL)::int AS con_pago,
        (SELECT count(DISTINCT estudiante_id) FROM examenes_inscripciones)::int AS inscritos_examen,
        (SELECT count(DISTINCT estudiante_id) FROM calificaciones)::int AS con_calificacion,
        (SELECT count(*) FROM credenciales WHERE estado = 'activa')::int AS credenciales`);

    const crecimiento = await uno(`
      SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS mes, count(*)::int AS alumnos
        FROM estudiantes GROUP BY 1 ORDER BY 1`);

    const [cobertura] = await uno(`
      SELECT (SELECT count(DISTINCT municipio_id) FROM estudiantes WHERE municipio_id IS NOT NULL)::int AS con_alumnos,
             (SELECT count(*) FROM municipios)::int AS totales,
             (SELECT count(*) FROM gestores WHERE estado = 'activo')::int AS gestores_activos,
             (SELECT count(*) FROM sedes)::int AS sedes`);

    const [academico] = await uno(`
      SELECT count(*)::int AS calificaciones,
             count(*) FILTER (WHERE calificacion >= ${CALIF_MINIMA_APROBATORIA})::int AS aprobadas,
             round(avg(calificacion)::numeric, 1)::float AS promedio
        FROM calificaciones WHERE calificacion IS NOT NULL`);

    const [contenido] = await uno(`
      SELECT (SELECT count(*) FROM modulos)::int AS modulos,
             (SELECT count(*) FROM banco_preguntas)::int AS preguntas,
             (SELECT count(DISTINCT estudiante_id) FROM estudiantes_modulos_progreso)::int AS alumnos_practicando`);

    res.json({ dinero, porMes, embudo, crecimiento, cobertura, academico, contenido });
  } catch (e) {
    console.error('[direccion/insights]', e);
    res.status(500).json({ error: 'No se pudieron calcular los insights' });
  }
});

/**
 * GET /tendencias?dias=90 — series históricas de las instantáneas diarias.
 *
 * Devuelve también el catálogo con la familia de cada métrica: las de tipo
 * `estado` no tienen pasado reconstruible y su serie empieza el día que se
 * instaló la instantánea. Decirlo evita leer un hueco como un cero.
 */
router.get('/tendencias', async (req, res) => {
  try {
    const dias = Math.min(Math.max(Number(req.query.dias) || 90, 2), 730);
    const claves = METRICAS.map((m) => m.clave);
    const puntos = await serie(claves, dias);
    res.json({
      dias,
      metricas: METRICAS.map((m) => ({ clave: m.clave, titulo: m.titulo, familia: m.familia })),
      puntos,
    });
  } catch (e) {
    console.error('[direccion/tendencias]', e);
    res.status(500).json({ error: 'No se pudieron cargar las tendencias' });
  }
});

// ─── Onboarding: el creador (Sinapsis) da el primer acceso ───────────────
// Excepción consciente al "solo lectura" de este panel: por decisión de
// producto, el creador puede dar de alta administradores y gestores y enviarles
// su primer acceso por correo. La contraseña es temporal y se cambia al entrar.

const onboardingGestorSchema = z.object({
  nombre: z.string().trim().min(1).max(100),
  apellidos: z.string().trim().min(1).max(100),
  // Identidad: con lo que entra. Puede ser institucional y no recibir nada.
  email: z.string().trim().email(),
  // Entrega: a donde llega el primer acceso. Vacío = al de arriba.
  correoNotificaciones: z.string().trim().email().optional().or(z.literal('')),
  municipioId: z.number().int().positive(),
  telefono: z.string().trim().max(30).optional(),
  capacidadMaxima: z.number().int().positive().max(500).optional(),
});

router.post('/onboarding/gestor', async (req, res) => {
  const parse = onboardingGestorSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Datos inválidos', detalles: parse.error.issues });
    return;
  }
  const data = parse.data;
  const email = data.email.toLowerCase();
  const nombreCompleto = `${data.nombre} ${data.apellidos}`.trim();
  try {
    const [existe] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (existe) {
      res.status(409).json({ error: 'Ya existe una cuenta con ese correo electrónico' });
      return;
    }
    const [mun] = await db.select({ nombre: municipios.nombre }).from(municipios).where(eq(municipios.id, data.municipioId));
    if (!mun) {
      res.status(400).json({ error: 'Municipio no válido' });
      return;
    }

    const tempPassword = generarPasswordTemporal();
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const nuevo = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email,
          correoNotificaciones: data.correoNotificaciones?.trim().toLowerCase() || null,
          passwordHash, rol: 'gestor', activo: true, passwordTemporal: true,
        })
        .returning();
      await tx.insert(gestores).values({
        userId: user.id,
        nombreCompleto,
        municipioId: data.municipioId,
        capacidadMaxima: data.capacidadMaxima ?? 50,
        telefono: data.telefono ?? undefined,
        estado: 'activo',
      });
      return user;
    });

    let correoEnviado = false;
    try {
      const r = await sendBienvenidaGestor(
        email,
        {
          nombreGestor: nombreCompleto,
          email,
          passwordTemporal: tempPassword,
          municipio: mun.nombre,
          portalUrl: urlPortalLogin(),
        },
        { triggeredBy: req.user!.userId, relatedUserId: nuevo.id },
      );
      correoEnviado = r.enviado;
      if (correoEnviado) await db.update(users).set({ bienvenidaEnviadaEn: new Date() }).where(eq(users.id, nuevo.id));
    } catch { /* el alta ya quedó; el correo se puede reenviar */ }

    await tryAuditLog({
      userId: req.user!.userId,
      accion: 'onboarding_gestor',
      entidad: 'gestores',
      entidadId: nuevo.id,
      detalle: `El creador dio primer acceso al gestor ${nombreCompleto} (${mun.nombre})`,
      metadata: { email },
      req,
    });

    res.status(201).json({
      ok: true,
      correoEnviado,
      ...(puedeRevelarCredenciales() ? { credencialTemporal: tempPassword } : {}),
    });
  } catch (e) {
    console.error('[direccion/onboarding/gestor]', e);
    res.status(500).json({ error: 'No se pudo crear el gestor' });
  }
});

const onboardingAdminSchema = z.object({
  nombre: z.string().trim().min(1).max(100),
  apellidos: z.string().trim().min(1).max(100),
  // Identidad: con lo que entra. Puede ser institucional y no recibir nada.
  email: z.string().trim().email(),
  // Entrega: a donde llega el primer acceso. Vacío = al de arriba.
  correoNotificaciones: z.string().trim().email().optional().or(z.literal('')),
  esJefe: z.boolean().optional(),
  puesto: z.string().trim().max(120).optional(),
});

router.post('/onboarding/admin', async (req, res) => {
  const parse = onboardingAdminSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Datos inválidos', detalles: parse.error.issues });
    return;
  }
  const data = parse.data;
  const email = data.email.toLowerCase();
  const nombreCompleto = `${data.nombre} ${data.apellidos}`.trim();
  const esJefe = data.esJefe ?? false;
  try {
    const [existe] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (existe) {
      res.status(409).json({ error: 'Ya existe una cuenta con ese correo electrónico' });
      return;
    }

    const tempPassword = generarPasswordTemporal();
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const nuevo = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email,
          correoNotificaciones: data.correoNotificaciones?.trim().toLowerCase() || null,
          passwordHash, rol: 'admin', activo: true, passwordTemporal: true,
        })
        .returning();
      await tx.insert(administradores).values({
        userId: user.id,
        nombreCompleto,
        puesto: data.puesto ?? undefined,
        esJefe,
      });
      return user;
    });

    let correoEnviado = false;
    try {
      const r = await sendBienvenidaAdmin(
        email,
        {
          nombre: nombreCompleto,
          email,
          passwordTemporal: tempPassword,
          portalUrl: urlPortalLogin(),
          esJefe,
        },
        { triggeredBy: req.user!.userId, relatedUserId: nuevo.id },
      );
      correoEnviado = r.enviado;
      if (correoEnviado) await db.update(users).set({ bienvenidaEnviadaEn: new Date() }).where(eq(users.id, nuevo.id));
    } catch { /* el alta ya quedó; el correo se puede reenviar */ }

    await tryAuditLog({
      userId: req.user!.userId,
      accion: 'onboarding_admin',
      entidad: 'administradores',
      entidadId: nuevo.id,
      detalle: `El creador dio primer acceso a Administración ${nombreCompleto}${esJefe ? ' (titular)' : ''}`,
      metadata: { email, esJefe },
      req,
    });

    res.status(201).json({
      ok: true,
      correoEnviado,
      ...(puedeRevelarCredenciales() ? { credencialTemporal: tempPassword } : {}),
    });
  } catch (e) {
    console.error('[direccion/onboarding/admin]', e);
    res.status(500).json({ error: 'No se pudo crear la cuenta de administración' });
  }
});

// ─── Seguimiento de accesos: cuentas de staff y su estado ────────────────
// Lista los administradores y gestores para que el creador vea a quién dio de
// alta, si el correo salió y si la persona ya entró (cambió su temporal).

router.get('/accesos', async (_req, res) => {
  try {
    const rows = await db
      .select({
        userId: users.id,
        email: users.email,
        correoNotificaciones: users.correoNotificaciones,
        rol: users.rol,
        activo: users.activo,
        passwordTemporal: users.passwordTemporal,
        bienvenidaEnviadaEn: users.bienvenidaEnviadaEn,
        createdAt: users.createdAt,
        adminNombre: administradores.nombreCompleto,
        esJefe: administradores.esJefe,
        puesto: administradores.puesto,
        adminEmailPublico: administradores.emailPublico,
        gestorEmailPublico: gestores.emailPublico,
        gestorNombre: gestores.nombreCompleto,
        municipio: municipios.nombre,
        municipioId: gestores.municipioId,
        telefono: gestores.telefono,
      })
      .from(users)
      .leftJoin(administradores, eq(administradores.userId, users.id))
      .leftJoin(gestores, eq(gestores.userId, users.id))
      .leftJoin(municipios, eq(municipios.id, gestores.municipioId))
      .where(inArray(users.rol, ['admin', 'gestor']))
      .orderBy(desc(users.createdAt));

    const accesos = rows.map((r) => ({
      userId: r.userId,
      email: r.email,
      rol: r.rol as 'admin' | 'gestor',
      nombre: (r.rol === 'admin' ? r.adminNombre : r.gestorNombre) ?? r.email,
      detalle: r.rol === 'admin' ? (r.esJefe ? 'Titular' : 'Operativo') : (r.municipio ?? 'Sin municipio'),
      // Campos para prellenar el formulario de edición:
      municipioId: r.municipioId ?? null,
      telefono: r.telefono ?? null,
      puesto: r.puesto ?? null,
      esJefe: r.esJefe ?? false,
      // Correo INSTITUCIONAL: el que se publica y va en documentos. Es otra
      // cosa que `email`, que es con el que se entra y a donde llegan las
      // credenciales — ése suele ser el personal de quien atiende.
      emailPublico: (r.rol === 'admin' ? r.adminEmailPublico : r.gestorEmailPublico) ?? null,
      // Correo de CONTACTO: a donde llega de verdad el correo. Nulo = llega al
      // de acceso, que es como se comportaba antes de que existiera el campo.
      correoNotificaciones: r.correoNotificaciones ?? null,
      activo: r.activo,
      // "sin_entrar" = sigue con la contraseña temporal (nunca entró);
      // "activo" = ya la cambió en su primer ingreso.
      estado: r.passwordTemporal ? 'sin_entrar' : 'activo',
      correoEnviadoEn: r.bienvenidaEnviadaEn,
      creadoEn: r.createdAt,
      puedeReenviar: r.passwordTemporal,
    }));
    res.json({ accesos });
  } catch (e) {
    console.error('[direccion/accesos]', e);
    res.status(500).json({ error: 'No se pudieron cargar los accesos' });
  }
});

router.post('/accesos/:userId/reenviar', async (req, res) => {
  const userId = Number(req.params.userId);
  if (Number.isNaN(userId)) {
    res.status(400).json({ error: 'ID inválido' });
    return;
  }
  try {
    const [u] = await db
      .select({ email: users.email, rol: users.rol, passwordTemporal: users.passwordTemporal })
      .from(users)
      .where(eq(users.id, userId));
    if (!u || (u.rol !== 'admin' && u.rol !== 'gestor')) {
      res.status(404).json({ error: 'Cuenta no encontrada' });
      return;
    }
    if (!u.passwordTemporal) {
      res.status(400).json({
        error: 'La persona ya cambió su contraseña. Por seguridad no se reenvía la temporal; debe usar "Recuperar contraseña" desde el login.',
      });
      return;
    }

    const nueva = generarPasswordTemporal();
    const passwordHash = await bcrypt.hash(nueva, 10);
    await db.update(users).set({ passwordHash, bienvenidaEnviadaEn: null, updatedAt: new Date() }).where(eq(users.id, userId));

    const portalUrl = urlPortalLogin();
    let correoEnviado = false;
    if (u.rol === 'gestor') {
      const [g] = await db
        .select({ nombre: gestores.nombreCompleto, municipio: municipios.nombre })
        .from(gestores)
        .leftJoin(municipios, eq(municipios.id, gestores.municipioId))
        .where(eq(gestores.userId, userId));
      const r = await sendBienvenidaGestor(
        u.email,
        { nombreGestor: g?.nombre ?? u.email, email: u.email, passwordTemporal: nueva, municipio: g?.municipio ?? '', portalUrl },
        { triggeredBy: req.user!.userId, relatedUserId: userId },
      );
      correoEnviado = r.enviado;
    } else {
      const [a] = await db
        .select({ nombre: administradores.nombreCompleto, esJefe: administradores.esJefe })
        .from(administradores)
        .where(eq(administradores.userId, userId));
      const r = await sendBienvenidaAdmin(
        u.email,
        { nombre: a?.nombre ?? u.email, email: u.email, passwordTemporal: nueva, portalUrl, esJefe: a?.esJefe ?? false },
        { triggeredBy: req.user!.userId, relatedUserId: userId },
      );
      correoEnviado = r.enviado;
    }
    if (correoEnviado) await db.update(users).set({ bienvenidaEnviadaEn: new Date() }).where(eq(users.id, userId));

    await tryAuditLog({
      userId: req.user!.userId,
      accion: 'reenviar_acceso',
      entidad: u.rol === 'gestor' ? 'gestores' : 'administradores',
      entidadId: userId,
      detalle: `El creador reenvió el primer acceso a ${u.email}`,
      metadata: { rol: u.rol },
      req,
    });

    res.json({ ok: true, correoEnviado, ...(puedeRevelarCredenciales() ? { credencialTemporal: nueva } : {}) });
  } catch (e) {
    console.error('[direccion/accesos/reenviar]', e);
    res.status(500).json({ error: 'No se pudo reenviar el acceso' });
  }
});

const editarAccesoSchema = z.object({
  nombreCompleto: z.string().trim().min(1).max(200).optional(),
  email: z.string().trim().email().optional(),
  municipioId: z.number().int().positive().optional(),
  telefono: z.string().trim().max(30).nullable().optional(),
  puesto: z.string().trim().max(120).nullable().optional(),
  esJefe: z.boolean().optional(),
  // Correo institucional (el que se publica). Cadena vacía = quitarlo.
  emailPublico: z.string().trim().max(255).nullable().optional(),
  // Correo de CONTACTO: a donde se entrega de verdad. Nulo = al de acceso.
  correoNotificaciones: z.string().trim().max(255).nullable().optional(),
});

router.patch('/accesos/:userId', async (req, res) => {
  const userId = Number(req.params.userId);
  if (Number.isNaN(userId)) {
    res.status(400).json({ error: 'ID inválido' });
    return;
  }
  const parse = editarAccesoSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Datos inválidos', detalles: parse.error.issues });
    return;
  }
  const d = parse.data;
  try {
    const [u] = await db.select({ rol: users.rol, email: users.email }).from(users).where(eq(users.id, userId));
    if (!u || (u.rol !== 'admin' && u.rol !== 'gestor')) {
      res.status(404).json({ error: 'Cuenta no encontrada' });
      return;
    }

    // Cambio del correo de ACCESO. Se avisa a las dos direcciones, igual que
    // en administración (utils/email → sendCorreoAccesoCambiado): quien pierde
    // el acceso tiene que enterarse, y sólo la dirección anterior lo alcanza.
    let correoAnterior: string | null = null;
    if (d.email) {
      const email = d.email.toLowerCase();
      const [dup] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
      if (dup && dup.id !== userId) {
        res.status(409).json({ error: 'Ya existe una cuenta con ese correo electrónico' });
        return;
      }
      if (email !== u.email.toLowerCase()) {
        correoAnterior = u.email;
        await db.update(users).set({ email, updatedAt: new Date() }).where(eq(users.id, userId));
      }
    }

    if (d.correoNotificaciones !== undefined) {
      await db
        .update(users)
        .set({ correoNotificaciones: d.correoNotificaciones?.trim().toLowerCase() || null, updatedAt: new Date() })
        .where(eq(users.id, userId));
    }

    if (u.rol === 'gestor') {
      const set: Partial<typeof gestores.$inferInsert> = {};
      if (d.nombreCompleto !== undefined) set.nombreCompleto = d.nombreCompleto;
      if (d.municipioId !== undefined) set.municipioId = d.municipioId;
      if (d.telefono !== undefined) set.telefono = d.telefono ?? null;
      if (d.emailPublico !== undefined) set.emailPublico = d.emailPublico?.trim() || null;
      if (Object.keys(set).length) await db.update(gestores).set(set).where(eq(gestores.userId, userId));
    } else {
      const set: Partial<typeof administradores.$inferInsert> = {};
      if (d.nombreCompleto !== undefined) set.nombreCompleto = d.nombreCompleto;
      if (d.puesto !== undefined) set.puesto = d.puesto ?? null;
      if (d.esJefe !== undefined) set.esJefe = d.esJefe;
      if (d.emailPublico !== undefined) set.emailPublico = d.emailPublico?.trim() || null;
      if (Object.keys(set).length) await db.update(administradores).set(set).where(eq(administradores.userId, userId));
    }

    await tryAuditLog({
      userId: req.user!.userId,
      accion: 'editar_acceso',
      entidad: u.rol === 'gestor' ? 'gestores' : 'administradores',
      entidadId: userId,
      detalle: correoAnterior
        ? `El creador editó la cuenta ${u.rol} #${userId}. Correo de acceso: ${correoAnterior} → ${d.email!.toLowerCase()}`
        : `El creador editó la cuenta ${u.rol} #${userId}`,
      metadata: correoAnterior
        ? { cambios: Object.keys(d), correoAnterior, correoNuevo: d.email!.toLowerCase() }
        : { cambios: Object.keys(d) },
      req,
    });

    if (correoAnterior) {
      const [persona] = u.rol === 'gestor'
        ? await db.select({ nombre: gestores.nombreCompleto }).from(gestores).where(eq(gestores.userId, userId))
        : await db.select({ nombre: administradores.nombreCompleto }).from(administradores).where(eq(administradores.userId, userId));
      void sendCorreoAccesoCambiado(
        {
          nombre: persona?.nombre ?? 'Hola',
          correoAnterior,
          correoNuevo: d.email!.toLowerCase(),
          loginUrl: urlPortalLogin(),
        },
        { triggeredBy: req.user!.userId, relatedUserId: userId },
      );
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('[direccion/accesos/editar]', e);
    res.status(500).json({ error: 'No se pudo editar la cuenta' });
  }
});

router.delete('/accesos/:userId', async (req, res) => {
  const userId = Number(req.params.userId);
  if (Number.isNaN(userId)) {
    res.status(400).json({ error: 'ID inválido' });
    return;
  }
  if (userId === req.user!.userId) {
    res.status(400).json({ error: 'No puedes eliminar tu propia cuenta.' });
    return;
  }
  try {
    const [u] = await db.select({ rol: users.rol, email: users.email }).from(users).where(eq(users.id, userId));
    if (!u || (u.rol !== 'admin' && u.rol !== 'gestor')) {
      res.status(404).json({ error: 'Cuenta no encontrada' });
      return;
    }

    // Un gestor con alumnos no se puede borrar: sus alumnos lo referencian.
    if (u.rol === 'gestor') {
      const [{ n }] = await db.select({ n: count() }).from(estudiantes).where(eq(estudiantes.gestorId, userId));
      if (Number(n) > 0) {
        res.status(409).json({
          error: `Este gestor tiene ${n} alumno(s) asignado(s). Reasígnalos a otro centro antes de eliminarlo.`,
        });
        return;
      }
    }

    try {
      await db.delete(users).where(eq(users.id, userId));
    } catch {
      // Borrado duro bloqueado por historial (bitácora, etc.).
      res.status(409).json({
        error: 'No se puede eliminar: la cuenta ya tiene actividad registrada en el sistema. Si necesitas retirarla, avísame y agregamos "desactivar" (deja el historial, quita el acceso).',
      });
      return;
    }

    await tryAuditLog({
      userId: req.user!.userId,
      accion: 'eliminar_acceso',
      entidad: u.rol === 'gestor' ? 'gestores' : 'administradores',
      entidadId: userId,
      detalle: `El creador eliminó la cuenta ${u.rol} ${u.email}`,
      metadata: { rol: u.rol, email: u.email },
      req,
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('[direccion/accesos/eliminar]', e);
    res.status(500).json({ error: 'No se pudo eliminar la cuenta' });
  }
});

// Desactivar = quitar el acceso SIN borrar (reversible, conserva el historial).
// Es lo correcto para cuentas que ya trabajaron. Doble candado: no te desactivas
// a ti mismo, ni al único administrador titular activo.
router.post('/accesos/:userId/desactivar', async (req, res) => {
  const userId = Number(req.params.userId);
  if (Number.isNaN(userId)) {
    res.status(400).json({ error: 'ID inválido' });
    return;
  }
  if (userId === req.user!.userId) {
    res.status(400).json({ error: 'No puedes desactivar tu propia cuenta.' });
    return;
  }
  try {
    const [u] = await db.select({ rol: users.rol, email: users.email }).from(users).where(eq(users.id, userId));
    if (!u || (u.rol !== 'admin' && u.rol !== 'gestor')) {
      res.status(404).json({ error: 'Cuenta no encontrada' });
      return;
    }

    if (u.rol === 'admin') {
      const [a] = await db.select({ esJefe: administradores.esJefe }).from(administradores).where(eq(administradores.userId, userId));
      if (a?.esJefe) {
        const [{ n }] = await db
          .select({ n: count() })
          .from(administradores)
          .innerJoin(users, eq(users.id, administradores.userId))
          .where(and(eq(administradores.esJefe, true), eq(users.activo, true)));
        if (Number(n) <= 1) {
          res.status(409).json({ error: 'Es el único administrador titular activo. Nombra a otro titular antes de desactivarlo.' });
          return;
        }
      }
    }

    await db.update(users).set({ activo: false, updatedAt: new Date() }).where(eq(users.id, userId));
    if (u.rol === 'gestor') await db.update(gestores).set({ estado: 'inactivo' }).where(eq(gestores.userId, userId));
    await invalidarSesiones(userId);

    await tryAuditLog({
      userId: req.user!.userId,
      accion: 'desactivar_acceso',
      entidad: u.rol === 'gestor' ? 'gestores' : 'administradores',
      entidadId: userId,
      detalle: `El creador desactivó la cuenta ${u.rol} ${u.email}`,
      metadata: { rol: u.rol, email: u.email },
      req,
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('[direccion/accesos/desactivar]', e);
    res.status(500).json({ error: 'No se pudo desactivar la cuenta' });
  }
});

router.post('/accesos/:userId/reactivar', async (req, res) => {
  const userId = Number(req.params.userId);
  if (Number.isNaN(userId)) {
    res.status(400).json({ error: 'ID inválido' });
    return;
  }
  try {
    const [u] = await db.select({ rol: users.rol, email: users.email }).from(users).where(eq(users.id, userId));
    if (!u || (u.rol !== 'admin' && u.rol !== 'gestor')) {
      res.status(404).json({ error: 'Cuenta no encontrada' });
      return;
    }
    await db.update(users).set({ activo: true, updatedAt: new Date() }).where(eq(users.id, userId));
    if (u.rol === 'gestor') await db.update(gestores).set({ estado: 'activo' }).where(eq(gestores.userId, userId));

    await tryAuditLog({
      userId: req.user!.userId,
      accion: 'reactivar_acceso',
      entidad: u.rol === 'gestor' ? 'gestores' : 'administradores',
      entidadId: userId,
      detalle: `El creador reactivó la cuenta ${u.rol} ${u.email}`,
      metadata: { rol: u.rol, email: u.email },
      req,
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('[direccion/accesos/reactivar]', e);
    res.status(500).json({ error: 'No se pudo reactivar la cuenta' });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// PADRÓN DE CENTROS DE ASESORÍA
// Lista maestra de la coordinación, cruzada con los gestores REALES del
// sistema. Un centro puede existir en el padrón sin tener cuenta todavía.
// ─────────────────────────────────────────────────────────────────────────

/** Normaliza para comparar nombres de centro: sin acentos, sin puntuación. */
function claveCentro(s: string | null): string {
  return (s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]/g, '');
}

router.get('/centros', async (_req, res) => {
  try {
    const padron = await db.select().from(centrosPadron).orderBy(centrosPadron.centro);

    // Gestores reales, con su municipio y cuántos alumnos tienen a cargo.
    const reales = await db
      .select({
        userId: gestores.userId,
        nombreCompleto: gestores.nombreCompleto,
        centroAsesoria: gestores.centroAsesoria,
        rfcCentro: gestores.rfcCentro,
        municipio: municipios.nombre,
      })
      .from(gestores)
      .leftJoin(municipios, eq(gestores.municipioId, municipios.id));

    const alumnosPorGestor = await db
      .select({ gestorId: estudiantes.gestorId, n: count() })
      .from(estudiantes)
      .groupBy(estudiantes.gestorId);
    const conteo = new Map<number, number>();
    for (const a of alumnosPorGestor) if (a.gestorId != null) conteo.set(a.gestorId, Number(a.n));

    // Índices para cruzar: por nombre normalizado y por RFC.
    const porNombre = new Map<string, typeof reales[number]>();
    const porRfc = new Map<string, typeof reales[number]>();
    for (const g of reales) {
      const k = claveCentro(g.centroAsesoria);
      if (k) porNombre.set(k, g);
      const r = (g.rfcCentro ?? '').toUpperCase().trim();
      if (r) porRfc.set(r, g);
    }

    const usados = new Set<number>();
    const filas = padron.map((c) => {
      // Enlace explícito primero; si no, se busca por nombre y luego por RFC.
      let g = c.gestorUserId != null ? reales.find((x) => x.userId === c.gestorUserId) : undefined;
      if (!g) g = porNombre.get(claveCentro(c.centro));
      if (!g && c.rfc) g = porRfc.get(c.rfc.toUpperCase().trim());
      if (g) usados.add(g.userId);
      return {
        id: c.id,
        centro: c.centro,
        rfc: c.rfc,
        contacto: c.contacto,
        municipio: c.municipio,
        activo: c.activo,
        notas: c.notas,
        cuenta: g
          ? { userId: g.userId, nombre: g.nombreCompleto, municipio: g.municipio, alumnos: conteo.get(g.userId) ?? 0 }
          : null,
      };
    });

    // Gestores con cuenta que NO aparecen en el padrón (para no perderlos de vista).
    const fueraDelPadron = reales
      .filter((g) => !usados.has(g.userId))
      .map((g) => ({
        userId: g.userId,
        nombre: g.nombreCompleto,
        centro: g.centroAsesoria,
        rfc: g.rfcCentro,
        municipio: g.municipio,
        alumnos: conteo.get(g.userId) ?? 0,
      }));

    res.json({
      centros: filas,
      fueraDelPadron,
      resumen: {
        total: filas.length,
        activos: filas.filter((f) => f.activo).length,
        conCuenta: filas.filter((f) => f.cuenta).length,
        sinRfc: filas.filter((f) => !f.rfc).length,
        sinContacto: filas.filter((f) => !f.contacto).length,
      },
    });
  } catch (e) {
    console.error('[direccion/centros]', e);
    res.status(500).json({ error: 'Error al cargar el padrón de centros' });
  }
});

const centroPatchSchema = z.object({
  activo: z.boolean().optional(),
  rfc: z.string().max(13).nullable().optional(),
  contacto: z.string().max(150).nullable().optional(),
  municipio: z.string().max(120).nullable().optional(),
  notas: z.string().max(500).nullable().optional(),
});

router.patch('/centros/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) { res.status(400).json({ error: 'ID inválido' }); return; }
    const parse = centroPatchSchema.safeParse(req.body);
    if (!parse.success) { res.status(400).json({ error: 'Datos inválidos' }); return; }
    const cambios = parse.data;
    if (Object.keys(cambios).length === 0) { res.status(400).json({ error: 'Nada que actualizar' }); return; }

    await db.update(centrosPadron)
      .set({ ...cambios, updatedAt: new Date() })
      .where(eq(centrosPadron.id, id));

    await tryAuditLog({
      userId: req.user!.userId, accion: 'editar_centro_padron', entidad: 'centros_padron', entidadId: id,
      detalle: `Creador actualizó el centro ${id}`, metadata: cambios, req,
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('[direccion/centros PATCH]', e);
    res.status(500).json({ error: 'No se pudo actualizar el centro' });
  }
});

// ─── Notas tipo post-it del panel del creador ────────────────────────────
const COLORES_NOTA = ['amarillo', 'rosa', 'azul', 'verde', 'guinda'] as const;

router.get('/notas', async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(notasCreador)
      .where(eq(notasCreador.userId, req.user!.userId))
      .orderBy(desc(notasCreador.updatedAt));
    res.json({ notas: rows });
  } catch (e) {
    console.error('[direccion/notas]', e);
    res.status(500).json({ error: 'No se pudieron cargar las notas' });
  }
});

const notaSchema = z.object({
  contenido: z.string().trim().min(1).max(2000),
  color: z.enum(COLORES_NOTA).optional(),
});

router.post('/notas', async (req, res) => {
  const parse = notaSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Datos inválidos' });
    return;
  }
  try {
    const [nota] = await db
      .insert(notasCreador)
      .values({ userId: req.user!.userId, contenido: parse.data.contenido, color: parse.data.color ?? 'amarillo' })
      .returning();
    res.status(201).json({ nota });
  } catch (e) {
    console.error('[direccion/notas/crear]', e);
    res.status(500).json({ error: 'No se pudo crear la nota' });
  }
});

const notaEditSchema = z.object({
  contenido: z.string().trim().min(1).max(2000).optional(),
  color: z.enum(COLORES_NOTA).optional(),
});

router.patch('/notas/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) { res.status(400).json({ error: 'ID inválido' }); return; }
  const parse = notaEditSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: 'Datos inválidos' }); return; }
  try {
    const set: Partial<typeof notasCreador.$inferInsert> = { updatedAt: new Date() };
    if (parse.data.contenido !== undefined) set.contenido = parse.data.contenido;
    if (parse.data.color !== undefined) set.color = parse.data.color;
    const [nota] = await db
      .update(notasCreador)
      .set(set)
      .where(and(eq(notasCreador.id, id), eq(notasCreador.userId, req.user!.userId)))
      .returning();
    if (!nota) { res.status(404).json({ error: 'Nota no encontrada' }); return; }
    res.json({ nota });
  } catch (e) {
    console.error('[direccion/notas/editar]', e);
    res.status(500).json({ error: 'No se pudo editar la nota' });
  }
});

router.delete('/notas/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) { res.status(400).json({ error: 'ID inválido' }); return; }
  try {
    await db.delete(notasCreador).where(and(eq(notasCreador.id, id), eq(notasCreador.userId, req.user!.userId)));
    res.json({ ok: true });
  } catch (e) {
    console.error('[direccion/notas/eliminar]', e);
    res.status(500).json({ error: 'No se pudo eliminar la nota' });
  }
});

// ── Bitácora de actividad (creador) ──────────────────────────────────
// El creador (Sinapsis) SÍ ve todo el historial —incluidas sus propias
// acciones de operación— para auditar "quién hizo qué" en el equipo. La
// bitácora del admin, en cambio, oculta las acciones del creador.
function maskIpBitacora(ip: string | null): string | null {
  if (!ip) return null;
  const p = ip.split('.');
  return p.length === 4 ? `${p[0]}.${p[1]}.x.x` : ip;
}

// ── GET /direccion/bitacora/integridad ───────────────────────────────────
/**
 * ¿Alguien tocó la bitácora? Recorre la cadena de huellas y dice dónde se
 * rompe, si es que se rompe. Ver services/verificarBitacora.ts.
 *
 * Se consulta a petición y no en cada carga de la pantalla: recorre la tabla
 * entera, y una comprobación que se corre sola cada vez acaba siendo una
 * consulta pesada que nadie mira.
 */
router.get('/bitacora/integridad', async (_req, res) => {
  try {
    res.json(await verificarBitacora());
  } catch (e) {
    console.error('[direccion/bitacora/integridad]', e);
    res.status(500).json({ error: 'No se pudo verificar la bitácora' });
  }
});

router.get('/bitacora', async (req, res) => {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = (page - 1) * limit;
  const { buscar, accion, entidad, fechaInicio, fechaFin } = req.query as Record<string, string>;

  try {
    const conditions: any[] = [];
    if (accion) conditions.push(eq(auditLog.accion, accion));
    if (entidad) conditions.push(eq(auditLog.entidad, entidad));
    if (buscar) conditions.push(like(auditLog.detalle, patronLike(buscar)));
    if (fechaInicio) conditions.push(gte(auditLog.createdAt, new Date(fechaInicio)));
    if (fechaFin) conditions.push(lte(auditLog.createdAt, new Date(fechaFin + 'T23:59:59')));
    const where = conditions.length ? and(...conditions) : undefined;

    const base = db.select({
      id: auditLog.id,
      userId: auditLog.userId,
      userNombre: auditLog.userNombre,
      userRol: auditLog.userRol,
      accion: auditLog.accion,
      entidad: auditLog.entidad,
      entidadId: auditLog.entidadId,
      detalle: auditLog.detalle,
      metadata: auditLog.metadata,
      ip: auditLog.ip,
      createdAt: auditLog.createdAt,
    }).from(auditLog).$dynamic();
    const rows = await (where ? base.where(where) : base)
      .orderBy(desc(auditLog.createdAt)).limit(limit).offset(offset);

    const totalRes = where
      ? await db.select({ total: count() }).from(auditLog).where(where)
      : await db.select({ total: count() }).from(auditLog);
    const total = Number(totalRes[0]?.total ?? 0);

    res.json({
      rows: rows.map((r) => ({ ...r, ip: maskIpBitacora(r.ip) })),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      limit,
    });
  } catch (e) {
    console.error('[direccion/bitacora]', e);
    res.status(500).json({ error: 'No se pudo cargar la bitácora' });
  }
});

export default router;
