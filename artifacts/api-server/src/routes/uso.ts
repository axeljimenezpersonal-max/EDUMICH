/**
 * Telemetría de uso — qué pantallas y botones se usan, por rol.
 *
 * Guarda CONTADORES, no expedientes: una fila por (día, rol, tipo, clave) con
 * un número. No hay `user_id` en ninguna parte y es deliberado — así no se
 * puede reconstruir el recorrido de una persona ni aunque alguien entre a la
 * base, y el aviso de privacidad vigente ya ampara la estadística disociada
 * "para mejora del servicio".
 *
 * El rol SIEMPRE sale de la sesión, nunca del cuerpo de la petición: si el
 * cliente pudiera declarar su rol, cualquiera podría envenenar el ranking.
 *
 * Interruptor: con `TELEMETRIA_USO=off` el endpoint sigue respondiendo 200
 * pero no escribe nada. Sirve para apagarlo sin desplegar.
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { pool } from '@workspace/db';
import { authRequired, requireRol } from '../middleware/auth';
import { hoyEnMexico } from '../utils/fechas';

const router = Router();
router.use(authRequired);

const APAGADA = process.env.TELEMETRIA_USO === 'off';

/** Tope de eventos por lote. Un cliente sano manda 5-20. */
const MAX_EVENTOS = 60;
/** Tope de repeticiones de un mismo evento en un lote. */
const MAX_CONTEO = 500;
/**
 * Formato de clave permitido. Deja pasar rutas normalizadas
 * (`/gestor/alumnos/:id`) y slugs de acción (`pago.subir_comprobante`).
 * Todo lo demás se descarta: es la barrera que impide que llegue texto libre
 * —y con él, datos personales— desde el DOM.
 */
const CLAVE_OK = /^[a-z0-9:._/-]{2,80}$/;
const TIPOS = new Set(['pantalla', 'accion']);

const usoLimiter = rateLimit({
  windowMs: 60_000,
  max: 30, // 30 lotes por minuto por IP: sobra para un flush cada 15s
  standardHeaders: true,
  legacyHeaders: false,
});

type EventoEntrante = { tipo?: unknown; clave?: unknown; n?: unknown };

/**
 * POST /api/uso — ingesta por lote.
 *
 * Responde `{ ok: true }` y no 204 a propósito: el cliente del portal hace
 * `res.json()` en toda respuesta y un 204 lo haría reventar.
 */
router.post('/', usoLimiter, async (req, res) => {
  const rol = req.user!.rol;
  const cuerpo = req.body as { eventos?: unknown };
  const entrantes = Array.isArray(cuerpo?.eventos) ? cuerpo.eventos : [];

  if (entrantes.length === 0) return res.json({ ok: true, guardados: 0 });
  if (entrantes.length > MAX_EVENTOS) {
    return res.status(400).json({ error: 'Lote demasiado grande' });
  }
  if (APAGADA) return res.json({ ok: true, guardados: 0, apagada: true });

  // Se colapsan repeticiones en memoria antes de tocar la base: un lote con
  // 20 visitas a la misma pantalla debe ser un solo UPDATE, no veinte.
  const acumulado = new Map<string, { tipo: string; clave: string; n: number }>();
  for (const bruto of entrantes as EventoEntrante[]) {
    const tipo = String(bruto?.tipo ?? '');
    const clave = String(bruto?.clave ?? '');
    const n = Number(bruto?.n ?? 1);
    if (!TIPOS.has(tipo)) continue;
    if (!CLAVE_OK.test(clave)) continue;
    if (!Number.isFinite(n) || n < 1) continue;

    const llave = `${tipo}|${clave}`;
    const previo = acumulado.get(llave);
    const suma = Math.min((previo?.n ?? 0) + Math.floor(n), MAX_CONTEO);
    acumulado.set(llave, { tipo, clave, n: suma });
  }

  const eventos = [...acumulado.values()];
  if (eventos.length === 0) return res.json({ ok: true, guardados: 0 });

  // El día se calcula en horario de Michoacán, no en UTC: si no, todo lo que
  // pasa después de las 18:00 se contaría en el día siguiente.
  const dia = hoyEnMexico();

  const valores: unknown[] = [];
  const filas = eventos.map((e, i) => {
    const b = i * 5; // 5 columnas por fila
    valores.push(dia, rol, e.tipo, e.clave, e.n);
    return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5})`;
  });

  try {
    await pool.query(
      `INSERT INTO uso_diario (dia, rol, tipo, clave, conteo)
       VALUES ${filas.join(', ')}
       ON CONFLICT (dia, rol, tipo, clave)
       DO UPDATE SET conteo = uso_diario.conteo + EXCLUDED.conteo,
                     actualizado_en = now()`,
      valores
    );
    return res.json({ ok: true, guardados: eventos.length });
  } catch (err) {
    // La telemetría jamás debe romperle la sesión a nadie: se traga el error.
    console.warn('[uso] fallo al guardar lote:', err);
    return res.json({ ok: true, guardados: 0 });
  }
});

/**
 * GET /api/uso/resumen?dias=30 — ranking por rol.
 * Solo dirección (que hoy es la cuenta de Synapsis) y admin.
 */
router.get('/resumen', requireRol('direccion', 'admin'), async (req, res) => {
  const dias = Math.min(Math.max(Number(req.query.dias) || 30, 1), 365);

  const { rows } = await pool.query(
    `SELECT rol, tipo, clave, SUM(conteo)::int AS total
       FROM uso_diario
      WHERE dia >= (CURRENT_DATE - ($1::int - 1))
      GROUP BY rol, tipo, clave
      ORDER BY rol, total DESC`,
    [dias]
  );

  const { rows: cobertura } = await pool.query(
    `SELECT MIN(dia)::text AS desde, MAX(dia)::text AS hasta,
            COUNT(DISTINCT dia)::int AS dias_con_datos,
            SUM(conteo)::int AS eventos
       FROM uso_diario
      WHERE dia >= (CURRENT_DATE - ($1::int - 1))`,
    [dias]
  );

  res.json({
    dias,
    cobertura: cobertura[0] ?? { desde: null, hasta: null, dias_con_datos: 0, eventos: 0 },
    filas: rows,
  });
});

/**
 * GET /api/uso/accesos — accesos rápidos aprobados para el rol de quien pregunta.
 * Lo consume el inicio de cada perfil, así que lo puede leer cualquier sesión.
 */
router.get('/accesos', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT clave, etiqueta, orden
       FROM accesos_rapidos
      WHERE rol = $1 AND activo = true
      ORDER BY orden, id`,
    [req.user!.rol]
  );
  res.json({ accesos: rows });
});

/** GET /api/uso/accesos/:rol — para configurarlos desde el tablero. */
router.get('/accesos/:rol', requireRol('direccion', 'admin'), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, clave, etiqueta, orden, activo
       FROM accesos_rapidos WHERE rol = $1 ORDER BY orden, id`,
    [req.params.rol]
  );
  res.json({ accesos: rows });
});

/**
 * PUT /api/uso/accesos/:rol — reemplaza la lista completa de un rol.
 * Se manda entera y no por partes: reordenar y quitar en una sola operación
 * evita estados intermedios raros (dos accesos con el mismo orden).
 */
router.put('/accesos/:rol', requireRol('direccion', 'admin'), async (req, res) => {
  const rol = String(req.params.rol);
  if (!['estudiante', 'gestor', 'admin', 'direccion'].includes(rol)) {
    return res.status(400).json({ error: 'Rol desconocido' });
  }

  const entrantes = Array.isArray((req.body as { accesos?: unknown })?.accesos)
    ? ((req.body as { accesos: unknown[] }).accesos as Array<Record<string, unknown>>)
    : [];
  if (entrantes.length > 12) {
    return res.status(400).json({ error: 'Máximo 12 accesos rápidos por perfil' });
  }

  const limpios = entrantes
    .map((a, i) => ({
      clave: String(a.clave ?? ''),
      etiqueta: String(a.etiqueta ?? '').slice(0, 60).trim(),
      orden: i,
    }))
    .filter((a) => CLAVE_OK.test(a.clave) && a.etiqueta.length > 0);

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query('DELETE FROM accesos_rapidos WHERE rol = $1', [rol]);
    for (const a of limpios) {
      await cliente.query(
        `INSERT INTO accesos_rapidos (rol, clave, etiqueta, orden, creado_por)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (rol, clave) DO UPDATE
           SET etiqueta = EXCLUDED.etiqueta, orden = EXCLUDED.orden`,
        [rol, a.clave, a.etiqueta, a.orden, req.user!.userId]
      );
    }
    await cliente.query('COMMIT');
    return res.json({ ok: true, guardados: limpios.length });
  } catch (err) {
    await cliente.query('ROLLBACK');
    console.error('[uso] fallo al guardar accesos rápidos:', err);
    return res.status(500).json({ error: 'No se pudieron guardar los accesos rápidos' });
  } finally {
    cliente.release();
  }
});

export default router;
