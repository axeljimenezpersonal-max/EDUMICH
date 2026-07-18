/**
 * Revocación real de sesiones, sin pagar una consulta por petición.
 *
 * ── El problema ─────────────────────────────────────────────────────────────
 * La sesión es una cookie firmada sin estado: se valida la firma y la edad, y
 * ya. Eso trae dos huecos que la auditoría marcó como abiertos:
 *
 *  · Un usuario dado de baja conservaba acceso hasta 7 días.
 *  · Cambiar la contraseña NO cerraba las sesiones abiertas. Si a alguien le
 *    robaban la cookie y hacía lo correcto —cambiar su contraseña—, el atacante
 *    seguía dentro una semana. El sistema castigaba a quien intentaba
 *    protegerse.
 *
 * ── Por qué se había pospuesto ──────────────────────────────────────────────
 * La solución evidente —consultar `users` en cada petición— añade una consulta
 * a absolutamente todo el tráfico. Por eso se difirió en la auditoría de junio.
 *
 * ── Cómo se resuelve sin ese costo ──────────────────────────────────────────
 * La cookie ya lleva `iat` (cuándo se emitió). Basta una marca por usuario,
 * `users.sesiones_invalidadas_en`, y la regla: **si la cookie se emitió antes de
 * esa marca, no vale**.
 *
 * Y no hace falta leer la base cada vez, porque sólo importan los usuarios
 * invalidados en los últimos 7 días —más allá, la cookie ya expiró sola por
 * edad—. Eso son unos pocos al día, no el padrón. Se mantienen en memoria y se
 * refrescan cada minuto.
 *
 * Coste: unos kilobytes y una consulta por minuto. La ventana de una sesión
 * revocada pasa de 7 días a, como mucho, lo que tarde el próximo refresco.
 *
 * ⚠️ Con varias instancias, cada una tiene su copia: la instancia que revoca se
 * entera al instante y las demás dentro del intervalo de refresco. Es aceptable
 * —un minuto frente a siete días—, pero conviene bajarlo o pasar a
 * invalidación por evento cuando se escale.
 */

import { gt, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { users } from '@workspace/db/schema';

/** Debe coincidir con MAX_SESSION_AGE_MS de middleware/auth.ts. */
const EDAD_MAX_SESION_MS = 7 * 24 * 60 * 60 * 1000;

const REFRESCO_MS = 60_000;

/** userId → momento del corte, en milisegundos. */
let cortes = new Map<number, number>();
let ultimoRefresco = 0;
let refrescando = false;

/**
 * Relee de la base los cortes vigentes.
 *
 * Sólo trae los de los últimos 7 días: un corte más viejo que la edad máxima de
 * sesión ya no puede invalidar nada, porque cualquier cookie anterior habría
 * caducado sola. Eso mantiene el mapa pequeño para siempre.
 */
async function refrescar(): Promise<void> {
  if (refrescando) return;
  refrescando = true;
  try {
    const desde = new Date(Date.now() - EDAD_MAX_SESION_MS);
    const filas = await db
      .select({ id: users.id, corte: users.sesionesInvalidadasEn })
      .from(users)
      .where(gt(users.sesionesInvalidadasEn, desde));

    const nuevo = new Map<number, number>();
    for (const f of filas) if (f.corte) nuevo.set(f.id, f.corte.getTime());

    // Se CONSERVAN los cortes locales más nuevos que lo que trajo la base, en
    // vez de reemplazar el mapa a secas.
    //
    // Sin esto hay una carrera silenciosa: si `registrarCorteLocal` anota un
    // corte y una lectura que empezó ANTES de que esa escritura se viera termina
    // después, el corte recién puesto desaparece del mapa y la sesión revocada
    // vuelve a valer hasta el siguiente refresco. Es exactamente el fallo que
    // esta función existe para evitar, y sería invisible.
    const corte = Date.now() - EDAD_MAX_SESION_MS;
    for (const [id, ts] of cortes) {
      if (ts <= corte) continue;                       // ya no puede revocar nada
      const deLaBase = nuevo.get(id);
      if (deLaBase === undefined || ts > deLaBase) nuevo.set(id, ts);
    }

    cortes = nuevo;
    ultimoRefresco = Date.now();
  } catch (e) {
    // Si falla, se conserva el mapa anterior. Preferir datos de hace un minuto
    // a quedarse sin ninguno: vaciarlo dejaría pasar sesiones ya revocadas.
    console.error('[revocacion] no se pudo refrescar la lista de cortes:', e);
  } finally {
    refrescando = false;
  }
}

/** Arranca el refresco periódico. Se llama una vez, al levantar el servidor. */
export function iniciarRevocacion(): void {
  void refrescar();
  const t = setInterval(() => { void refrescar(); }, REFRESCO_MS);
  // Que este temporizador no impida al proceso terminar.
  if (typeof t.unref === 'function') t.unref();
}

/**
 * ¿Esta sesión fue revocada?
 *
 * Síncrona a propósito: se llama en cada petición autenticada y no debe añadir
 * espera. Si el mapa está pasado de tiempo, dispara un refresco en segundo
 * plano y responde con lo que tiene.
 */
export function sesionRevocada(userId: number, iatMs: number): boolean {
  if (Date.now() - ultimoRefresco > REFRESCO_MS * 2) void refrescar();
  const corte = cortes.get(userId);
  return corte !== undefined && iatMs < corte;
}

/**
 * Invalida todas las sesiones de un usuario.
 *
 * Se llama al cambiar o restablecer la contraseña y al desactivar la cuenta. El
 * mapa local se actualiza en el acto para que la instancia que atiende la
 * petición corte de inmediato, sin esperar al refresco.
 */
export async function invalidarSesiones(userId: number): Promise<void> {
  const ahora = new Date();
  await db.update(users).set({ sesionesInvalidadasEn: ahora }).where(eq(users.id, userId));
  cortes.set(userId, ahora.getTime());
}

/**
 * Anota el corte en la caché local sin volver a escribir en la base.
 *
 * Para los sitios que ya ponen `sesiones_invalidadas_en` dentro de un `UPDATE`
 * que hacían de todos modos (cambio de contraseña, baja de cuenta): evita una
 * segunda escritura y, sobre todo, hace que ESTA instancia corte en el acto en
 * vez de esperar al refresco.
 */
export function registrarCorteLocal(userId: number, fecha: Date = new Date()): void {
  cortes.set(userId, fecha.getTime());
}

/** Sólo para pruebas. */
export function _estado() {
  return { cortes: new Map(cortes), ultimoRefresco };
}
