/**
 * Búsqueda transversal (fase 2 del buscador global).
 *
 * Devuelve PERSONAS y FOLIOS en una sola llamada, para que el buscador del
 * portal encuentre "Ana Sofía", una CURP o un folio de pago sin que el usuario
 * tenga que adivinar en qué pantalla se busca cada cosa.
 *
 * ── Quién puede usarlo ──────────────────────────────────────────────────────
 *  · gestor → SÓLO sus propios alumnos y sus propios pagos.
 *  · admin  → alumnos, gestores, pagos y convocatorias.
 *  · estudiante → NO. Sus datos propios los resuelve el portal con sus
 *    endpoints de siempre; aquí no tiene nada que buscar y darle acceso sería
 *    abrir una vía de enumeración de otros alumnos.
 *  · direccion → NO. Es un perfil de indicadores agregados por definición y no
 *    debe poder llegar a datos personales de un alumno concreto.
 *
 * El aislamiento del gestor NO se apoya en el middleware: se inyecta en el
 * WHERE de cada consulta, que es como lo resuelve el resto de `gestor.ts`.
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { estudiantes, gestores, users, pagosExamen, convocatorias } from '@workspace/db';
import { authRequired, requireRol } from '../middleware/auth';
import { tryAuditLog } from '../utils/audit';

const router = Router();

/**
 * Más holgado que el de login porque aquí se teclea: el portal manda una
 * consulta por pausa de escritura. Aun así acotado, porque este endpoint lee
 * datos personales y no queremos que sirva para raspar el padrón.
 */
const busquedaLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas búsquedas seguidas. Espera un momento.' },
});

router.use(authRequired, requireRol('gestor', 'admin'), busquedaLimiter);

/** Cuántos resultados por bloque de entidad. */
const TOPE_POR_BLOQUE = 6;

/**
 * Neutraliza los comodines de LIKE que venían del usuario.
 *
 * Sin esto, escribir "%" hace que el patrón sea `%%%` y devuelva la tabla
 * entera, y "_" casa con cualquier carácter. Además de dar resultados
 * absurdos, es la forma barata de sacarle el padrón completo a un ILIKE sobre
 * una columna indexada. El repo no tenía este escape en ningún lado.
 */
function escaparLike(s: string): string {
  return s.replace(/[\\%_]/g, '\\$&');
}

/** Patrón `%texto%` ya escapado, listo para interpolar. */
function patron(token: string): string {
  return `%${escaparLike(token)}%`;
}

interface Resultado {
  id: string;
  tipo: 'entidad';
  titulo: string;
  cuerpo?: string;
  ruta?: string;
  icono?: string;
  pista?: string;
}

router.get('/', async (req, res) => {
  const rol = req.user!.rol;
  const userId = req.user!.userId;

  const consulta = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  // Con 1 sola letra cualquier búsqueda devuelve medio padrón sin informar de
  // nada; se corta antes de tocar la base.
  if (consulta.length < 2) {
    res.json({ resultados: [] });
    return;
  }

  const tokens = consulta.split(/\s+/).filter(Boolean).slice(0, 6);
  if (tokens.length === 0) {
    res.json({ resultados: [] });
    return;
  }

  const resultados: Resultado[] = [];

  try {
    // ── Alumnos ────────────────────────────────────────────────────────────
    // Los tokens se combinan con Y para que "jimenez gonzalez" encuentre a
    // quien lleva ambos apellidos en cualquier orden, y `unaccent` para que
    // "ramirez" encuentre a "Ramírez".
    const condAlumno = and(
      ...tokens.map(
        (t) => sql`(
          unaccent(lower(${estudiantes.nombreCompleto})) LIKE unaccent(lower(${patron(t)})) ESCAPE '\\'
          OR ${estudiantes.curp} ILIKE ${patron(t)} ESCAPE '\\'
          OR ${estudiantes.folioPreregistro} ILIKE ${patron(t)} ESCAPE '\\'
          OR ${estudiantes.matriculaOficialDGB} ILIKE ${patron(t)} ESCAPE '\\'
        )`,
      ),
      // EL candado del gestor. Si esto falta, ve el padrón entero.
      rol === 'gestor' ? eq(estudiantes.gestorId, userId) : undefined,
    );

    const alumnos = await db
      .select({
        userId: estudiantes.userId,
        nombre: estudiantes.nombreCompleto,
        curp: estudiantes.curp,
        folio: estudiantes.folioPreregistro,
        matricula: estudiantes.matriculaOficialDGB,
      })
      .from(estudiantes)
      .where(condAlumno)
      .limit(TOPE_POR_BLOQUE);

    for (const a of alumnos) {
      resultados.push({
        id: `alumno-${a.userId}`,
        tipo: 'entidad',
        titulo: a.nombre ?? 'Alumno sin nombre',
        // La CURP no se muestra completa: identifica de sobra con los últimos
        // caracteres y no deja el dato a la vista de quien mire la pantalla.
        cuerpo: [a.matricula ? `Matrícula ${a.matricula}` : null, a.folio ? `Folio ${a.folio}` : null]
          .filter(Boolean)
          .join(' · ') || undefined,
        ruta: rol === 'gestor' ? `/gestor/alumnos/${a.userId}` : `/admin/alumnos/${a.userId}`,
        icono: 'User',
        pista: 'Alumno',
      });
    }

    // ── Pagos ──────────────────────────────────────────────────────────────
    // Ojo: los pagos grupales tienen `estudianteId` en null, así que acotar
    // por alumno dejaría fuera —o peor, dejaría ver— los del gestor. Se acota
    // por `gestorId`, que sí está en todas las filas.
    const condPago = and(
      ...tokens.map(
        (t) => sql`(
          ${pagosExamen.folio} ILIKE ${patron(t)} ESCAPE '\\'
          OR ${pagosExamen.referencia} ILIKE ${patron(t)} ESCAPE '\\'
          OR ${pagosExamen.lineaCaptura} ILIKE ${patron(t)} ESCAPE '\\'
        )`,
      ),
      rol === 'gestor' ? eq(pagosExamen.gestorId, userId) : undefined,
    );

    const pagos = await db
      .select({
        id: pagosExamen.id,
        folio: pagosExamen.folio,
        estado: pagosExamen.estado,
        monto: pagosExamen.montoTotal,
      })
      .from(pagosExamen)
      .where(condPago)
      .limit(TOPE_POR_BLOQUE);

    for (const p of pagos) {
      resultados.push({
        id: `pago-${p.id}`,
        tipo: 'entidad',
        titulo: `Pago ${p.folio}`,
        cuerpo: `Estado: ${String(p.estado).replace(/_/g, ' ')}`,
        ruta: rol === 'gestor' ? '/gestor/pagos' : '/admin/ordenes-pago',
        icono: 'CreditCard',
        pista: 'Pago',
      });
    }

    // ── Sólo para admin: gestores y convocatorias ──────────────────────────
    if (rol === 'admin') {
      const gs = await db
        .select({
          userId: gestores.userId,
          nombre: gestores.nombreCompleto,
          email: users.email,
          estado: gestores.estado,
        })
        .from(gestores)
        .innerJoin(users, eq(users.id, gestores.userId))
        .where(
          and(
            ...tokens.map(
              (t) => sql`(
                unaccent(lower(${gestores.nombreCompleto})) LIKE unaccent(lower(${patron(t)})) ESCAPE '\\'
                OR ${users.email} ILIKE ${patron(t)} ESCAPE '\\'
              )`,
            ),
          ),
        )
        .limit(TOPE_POR_BLOQUE);

      for (const g of gs) {
        resultados.push({
          id: `gestor-${g.userId}`,
          tipo: 'entidad',
          titulo: g.nombre ?? 'Gestor sin nombre',
          cuerpo: g.email ?? undefined,
          ruta: `/admin/gestores/${g.userId}`,
          icono: 'Users',
          pista: g.estado === 'activo' ? 'Gestor' : 'Gestor inactivo',
        });
      }

      const convs = await db
        .select({ id: convocatorias.id, nombre: convocatorias.nombre, estado: convocatorias.estado })
        .from(convocatorias)
        .where(
          and(
            ...tokens.map(
              (t) => sql`unaccent(lower(${convocatorias.nombre})) LIKE unaccent(lower(${patron(t)})) ESCAPE '\\'`,
            ),
          ),
        )
        .limit(TOPE_POR_BLOQUE);

      for (const c of convs) {
        resultados.push({
          id: `convocatoria-${c.id}`,
          tipo: 'entidad',
          titulo: c.nombre,
          cuerpo: `Estado: ${String(c.estado).replace(/_/g, ' ')}`,
          ruta: `/admin/convocatorias/${c.id}`,
          icono: 'CalendarClock',
          pista: 'Convocatoria',
        });
      }
    }

    // Se audita el HECHO de buscar y cuánto salió, nunca el término tecleado
    // ni los datos encontrados: el término suele ser el nombre de una persona
    // y la bitácora la lee mucha gente.
    await tryAuditLog({
      userId,
      accion: 'busqueda_transversal',
      entidad: 'busqueda',
      detalle: `Búsqueda transversal desde el portal (${resultados.length} resultados)`,
      metadata: { rol, tokens: tokens.length, n: resultados.length },
      req,
    });

    res.json({ resultados });
  } catch (e) {
    console.error('[busqueda] fallo', e);
    res.status(500).json({ error: 'No se pudo completar la búsqueda' });
  }
});

export default router;
