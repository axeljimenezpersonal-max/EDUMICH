/**
 * Registro de tutoriales vistos — reglas de Modula.
 *
 * Fuente de verdad: la BD (`GET/POST /tutoriales`), para que el avance viaje con
 * la cuenta y no con el navegador. Se mantiene un espejo en localStorage con dos
 * propósitos: responder al instante en el primer render (antes de que llegue la
 * respuesta) y no reventar si el usuario está sin red.
 *
 * ── Las reglas que este módulo hace cumplir ──────────────────────────────────
 *
 * R1. Saltar NO es haber visto. Solo `marcarVisto` (último paso) registra. Antes
 *     el clic en el fondo marcaba el tutorial como visto PARA SIEMPRE — un roce
 *     del dedo en el teléfono mataba la ayuda de esa sección de por vida.
 *
 * R3. El registro es por ETAPA, no por página. Un mismo tutorial enseña cosas
 *     distintas según el punto del trámite: el de Inscripción visto en
 *     `pre_registro` solo mostró la página bloqueada. Al llegar a
 *     `documentos_completos` hay contenido nuevo, esa etapa cuenta como no vista
 *     y el tutorial se ofrece una vez más.
 *
 * «No volver a mostrar» (`silenciar`) apaga el auto-arranque en TODAS las
 * etapas; el botón para reproducirlo a mano sigue disponible.
 */
import { api } from './api';
import { demoActive } from './demo';

/** Silencia todas las etapas de una clave. Coincide con el backend. */
const SILENCIADO = '*';

const ESPEJO = 'modula_tut_v2';

type Visto = { clave: string; etapa: string };

/** `clave|etapa` — identidad de un tutorial en una etapa concreta. */
function id(clave: string, etapa: string): string {
  return `${clave}|${etapa}`;
}

let cache: Set<string> | null = null;
let cargando: Promise<void> | null = null;

function leerEspejo(): Set<string> {
  try {
    const raw = localStorage.getItem(ESPEJO);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function escribirEspejo(s: Set<string>): void {
  try { localStorage.setItem(ESPEJO, JSON.stringify([...s])); } catch { /* sin espejo */ }
}

/**
 * Carga el registro del usuario. Idempotente y compartida: varios SectionTour se
 * montan a la vez y todos esperan la MISMA petición, no una cada uno.
 */
export function cargarTutoriales(): Promise<void> {
  if (cargando) return cargando;
  cache = leerEspejo(); // respuesta inmediata mientras llega la de red

  // La demo no tiene sesión: el registro vive SOLO en el espejo. Si
  // preguntáramos al backend, su respuesta vacía pisaría lo que el visitante
  // acaba de ver y la bienvenida se repetiría en cada navegación.
  if (demoActive()) {
    cargando = Promise.resolve();
    return cargando;
  }

  cargando = api
    .get<{ vistos: Visto[] }>('/tutoriales')
    .then((r) => {
      const s = new Set((r.vistos ?? []).map((v) => id(v.clave, v.etapa ?? '')));
      cache = s;
      escribirEspejo(s);
    })
    .catch(() => {
      // Sin red o sin sesión: nos quedamos con el espejo. Peor caso, el tutorial
      // se repite — mucho menos grave que ocultarle al alumno algo sin enseñar.
    });
  return cargando;
}

/** ¿Ya vio este tutorial en esta etapa (o lo silenció por completo)? */
export function estaVisto(clave: string, etapa = ''): boolean {
  const c = cache ?? leerEspejo();
  if (c.has(id(clave, SILENCIADO))) return true; // «no volver a mostrar»
  return c.has(id(clave, etapa));
}

/** Registra el tutorial como completado en esa etapa (R1: solo al terminarlo). */
export function marcarVisto(clave: string, etapa = ''): void {
  const c = cache ?? (cache = leerEspejo());
  c.add(id(clave, etapa));
  escribirEspejo(c);
  // Optimista: la UI no espera a la red. Si falla, el espejo ya lo recuerda.
  api.post('/tutoriales', { clave, etapa }).catch(() => { /* queda en el espejo */ });
}

/** «No volver a mostrar»: apaga el auto-arranque en todas las etapas. */
export function silenciar(clave: string): void {
  const c = cache ?? (cache = leerEspejo());
  c.add(id(clave, SILENCIADO));
  escribirEspejo(c);
  api.post('/tutoriales/silenciar', { clave }).catch(() => { /* queda en el espejo */ });
}

/**
 * Borra el registro local y obliga a recargarlo.
 *
 * Lo usa la demo (`/demo/estudiante`), que retrata a un alumno entrando por
 * primera vez: sus tutoriales no pueden darse por vistos de una visita previa a
 * la demo. No toca la BD — la demo no tiene sesión.
 */
export function olvidarTutoriales(): void {
  cache = new Set();
  cargando = null;
  try { localStorage.removeItem(ESPEJO); } catch { /* ignore */ }
}
