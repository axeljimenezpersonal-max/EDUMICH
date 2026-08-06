/**
 * Vista previa — ver la plataforma con los ojos de otro, sin entrar a su cuenta.
 *
 * El problema que resuelve: para mejorar la pantalla del alumno hay que verla
 * como la ve el alumno, y hasta hoy la única forma era pedirle su contraseña o
 * abrirle la cuenta. Las dos son inaceptables: la primera regala el acceso, la
 * segunda ensucia la bitácora —queda como si el alumno hubiera entrado— y deja
 * su sesión abierta en una máquina que no es la suya.
 *
 * Cómo funciona: el creador manda la cabecera `X-Preview-Usuario: <id>` y el
 * servidor atiende esa petición COMO si viniera de esa persona. Los datos son
 * los de verdad, en vivo, servidos por los mismos manejadores del rol real: no
 * hay una copia de las pantallas que se pueda quedar vieja.
 *
 * ── Lo que lo hace seguro ───────────────────────────────────────────────────
 *
 * 1. SÓLO LECTURA, y no como promesa de la interfaz sino como candado aquí:
 *    cualquier método que no sea GET/HEAD se rechaza ANTES de tocar `req.user`.
 *    Aunque alguien arme la petición a mano, no escribe.
 *
 * 2. SÓLO EL CREADOR. La cabecera la ignora cualquier sesión que no sea
 *    `direccion`, y quien la intente sin serlo queda registrado.
 *
 * 3. NO SE PUEDE VER A OTRO CREADOR. Ver un panel de dirección desde otra
 *    cuenta de dirección no aporta nada y sí abre una vía lateral.
 *
 * 4. QUEDA EN LA BITÁCORA. Cada vista previa se registra con quién miró y a
 *    quién. Con la bitácora encadenada, ese registro ya no se puede borrar.
 *
 * 5. LAS PANTALLAS QUE ESCRIBEN AL LEERLAS SE BLOQUEAN. Hay cuatro GET que
 *    crean datos como efecto de consultarlos (ver `RUTAS_QUE_ESCRIBEN`). Un
 *    filtro por método no las detiene, porque son GET de verdad.
 */
import type { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '@workspace/db';
import { decodeSession, type SessionUser } from './auth';
import { tryAuditLog } from '../utils/audit';

const CABECERA = 'x-preview-usuario';

declare global {
  namespace Express {
    interface Request {
      /** Identidad simulada. La pone esta capa; `authRequired` la respeta. */
      usuarioSimulado?: SessionUser;
      /** userId del creador que está mirando (para la bitácora y los logs). */
      previewPor?: number;
    }
  }
}

/**
 * GET que escriben al ser consultados.
 *
 * `ficha-preregistro` genera el folio si el alumno todavía no lo tiene: en una
 * vista previa nacería un folio real que nadie pidió. `chat/mi-conversacion`
 * marca los mensajes como leídos: el gestor vería "ya lo leyó" de alguien que
 * ni siquiera abrió el portal, y dejaría de insistirle.
 *
 * Se prefiere bloquearlas y decirlo en pantalla antes que previsualizarlas
 * dejando rastro en los datos de una persona real.
 */
const RUTAS_QUE_ESCRIBEN: { patron: RegExp; motivo: string }[] = [
  {
    patron: /\/ficha-preregistro$/,
    motivo: 'Esta pantalla genera el folio de preregistro al consultarse. En vista previa se omite para no crear un folio real.',
  },
  {
    patron: /^\/chat\/mi-conversacion$/,
    motivo: 'Abrir el chat marca los mensajes como leídos. En vista previa se omite para no alterar lo que ve el gestor.',
  },
];

/**
 * Un apunte en la bitácora por cada pantalla sería ilegible: una sola vista
 * dispara diez o quince GET. Se registra el INICIO de la observación y se
 * silencia el resto por diez minutos; si el creador sigue mirando después,
 * vuelve a quedar asentado.
 */
const VENTANA_REGISTRO_MS = 10 * 60 * 1000;
const ultimoRegistro = new Map<string, number>();

function yaSeRegistro(creadorId: number, objetivoId: number): boolean {
  const clave = `${creadorId}:${objetivoId}`;
  const ahora = Date.now();
  const previo = ultimoRegistro.get(clave);
  if (previo !== undefined && ahora - previo < VENTANA_REGISTRO_MS) return true;
  ultimoRegistro.set(clave, ahora);
  // El mapa no crece sin límite: son pocas parejas y se limpian las viejas.
  if (ultimoRegistro.size > 500) {
    for (const [k, t] of ultimoRegistro) {
      if (ahora - t > VENTANA_REGISTRO_MS) ultimoRegistro.delete(k);
    }
  }
  return false;
}

export async function vistaPrevia(req: Request, res: Response, next: NextFunction) {
  // La cabecera es la vía normal. El parámetro `_vp` existe porque hay cosas
  // que el navegador pide SIN pasar por el cliente HTTP y a las que, por lo
  // tanto, no se les puede poner una cabecera: las fotos del expediente
  // (`<img src="/api/...">`) y los enlaces de descarga. Sin él, la vista previa
  // del expediente saldría con todas las imágenes rotas y parecería un problema
  // de los datos del alumno.
  //
  // No debilita nada: pasa por las mismas comprobaciones, incluida la de que
  // sólo se atiendan métodos de lectura.
  const crudo = req.header(CABECERA) ?? (typeof req.query._vp === 'string' ? req.query._vp : undefined);
  if (!crudo) { next(); return; }

  const objetivoId = Number(crudo);
  if (!Number.isInteger(objetivoId) || objetivoId <= 0) {
    res.status(400).json({ error: 'Vista previa: identificador inválido' });
    return;
  }

  // Quién pide. Se lee la cookie aquí porque `authRequired` corre después, ya
  // dentro de cada router: para entonces sería tarde.
  const creador = req.cookies?.pa_session ? decodeSession(req.cookies.pa_session) : null;
  if (!creador || creador.rol !== 'direccion') {
    void tryAuditLog({
      userId: creador?.userId,
      accion: 'preview_denegado',
      entidad: 'auth',
      detalle: `Intento de vista previa del usuario ${objetivoId} sin ser creador`,
      metadata: { objetivoId, rol: creador?.rol ?? null, ruta: req.path, metodo: req.method },
      req,
    });
    res.status(403).json({ error: 'La vista previa es exclusiva del panel del creador' });
    return;
  }

  // El candado de sólo lectura. Va ANTES de resolver al usuario: si el método
  // no es de lectura, la petición no llega a tener identidad prestada.
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(403).json({
      error: 'La vista previa es de sólo lectura. Para hacer un cambio hay que entrar con la cuenta que corresponde.',
      soloLectura: true,
    });
    return;
  }

  const bloqueada = RUTAS_QUE_ESCRIBEN.find((r) => r.patron.test(req.path));
  if (bloqueada) {
    res.status(409).json({ error: bloqueada.motivo, soloLectura: true });
    return;
  }

  const [objetivo] = await db.select().from(users).where(eq(users.id, objetivoId));
  if (!objetivo) {
    res.status(404).json({ error: 'Vista previa: esa cuenta no existe' });
    return;
  }
  if (objetivo.rol === 'direccion') {
    res.status(403).json({ error: 'No se puede previsualizar otra cuenta de creador' });
    return;
  }

  if (!yaSeRegistro(creador.userId, objetivoId)) {
    void tryAuditLog({
      userId: creador.userId,
      accion: 'preview_inicio',
      entidad: 'usuario',
      entidadId: objetivoId,
      detalle: `Vista previa (sólo lectura) de ${objetivo.email} — rol ${objetivo.rol}`,
      metadata: { objetivoId, objetivoRol: objetivo.rol, objetivoEmail: objetivo.email },
      req,
    });
  }

  req.usuarioSimulado = { userId: objetivo.id, rol: objetivo.rol as SessionUser['rol'] };
  req.previewPor = creador.userId;
  next();
}
