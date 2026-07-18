/**
 * Telemetría de uso — lado del navegador.
 *
 * Acumula en memoria y manda lotes cada 15 segundos y al cerrar la pestaña.
 * Nunca una petición por clic: el servidor escribe en Postgres de forma
 * síncrona y no tiene por qué recibir una tormenta.
 *
 * NO pasa por `lib/api.ts` a propósito, por dos razones: ahí vive el
 * interceptor de modo demo (contaminaría los datos con clics de la demo) y su
 * timeout de 90s no tiene sentido para algo que debe ser fuego y olvido.
 *
 * Qué se manda: una clave y un tipo. Nunca texto escrito por el usuario,
 * nunca nombres, nunca identificadores de personas. El servidor además
 * descarta cualquier clave que no case con su formato.
 */

type Tipo = 'pantalla' | 'accion';

const INTERVALO_MS = 15_000;
const MAX_BUFER = 60; // el servidor rechaza lotes más grandes
const RUTA = '/api/uso';

/** clave → veces vista desde el último envío. */
const bufer = new Map<string, { tipo: Tipo; clave: string; n: number }>();
let temporizador: ReturnType<typeof setInterval> | null = null;
let activa = false;

/**
 * Rutas con partes variables: `/gestor/alumnos/123` cuenta como
 * `/gestor/alumnos/:id`. Sin esto cada alumno sería una "pantalla" distinta
 * y el ranking no significaría nada — además de meter identificadores de
 * personas en la clave, que es justo lo que no queremos guardar.
 */
export function normalizarRuta(ruta: string): string {
  return (
    ruta
      .split('?')[0]
      .split('#')[0]
      .replace(/\/+$/, '')
      .toLowerCase()
      // ids numéricos: /gestor/alumnos/4821 → /gestor/alumnos/:id
      .replace(/\/\d+(?=\/|$)/g, '/:id')
      // Folios y tokens: /c/FP-2026-000007 → /c/:cod
      //
      // Exige que el segmento MEZCLE letras y dígitos. Sin esa condición la
      // regla se comía palabras largas del propio idioma —"direccion",
      // "estudiante", "calificaciones"— y guardaba /:cod/:cod, que es
      // justamente lo que no queremos saber. Pasó en producción.
      .replace(
        /\/(?=[a-z0-9-]*[a-z])(?=[a-z0-9-]*\d)[a-z0-9-]{10,}(?=\/|$)/g,
        '/:cod'
      ) || '/'
  );
}

function encolar(tipo: Tipo, clave: string) {
  if (!activa || !clave) return;
  const llave = `${tipo}|${clave}`;
  const previo = bufer.get(llave);
  if (previo) previo.n += 1;
  else bufer.set(llave, { tipo, clave, n: 1 });

  // Si el búfer se llena antes del intervalo, se manda de inmediato en vez
  // de tirar eventos.
  if (bufer.size >= MAX_BUFER) enviar();
}

/** Registra la vista de una pantalla. */
export function registrarPantalla(ruta: string) {
  encolar('pantalla', normalizarRuta(ruta));
}

/** Registra una acción con nombre (lo que lleva `data-uso`). */
export function registrarAccion(clave: string) {
  encolar('accion', clave);
}

function vaciarBufer() {
  const eventos = [...bufer.values()];
  bufer.clear();
  return eventos;
}

/**
 * Manda lo acumulado. Con `sendBeacon` cuando se puede: sobrevive al cierre
 * de la pestaña, que es justo cuando se perdería la última pantalla vista.
 */
function enviar(finalizando = false) {
  if (bufer.size === 0) return;
  const eventos = vaciarBufer();
  const cuerpo = JSON.stringify({ eventos });

  if (finalizando && typeof navigator.sendBeacon === 'function') {
    const ok = navigator.sendBeacon(RUTA, new Blob([cuerpo], { type: 'application/json' }));
    if (ok) return;
    // Si sendBeacon rechaza (cuota llena), se intenta el fetch de abajo.
  }

  fetch(RUTA, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: cuerpo,
    credentials: 'include',
    keepalive: true,
  }).catch(() => {
    // Silencio deliberado: la telemetría jamás debe ensuciar la consola del
    // usuario ni romper nada. Si se pierde un lote, se pierde.
  });
}

/**
 * Arranca la telemetría. Idempotente.
 *
 * No se activa en modo demo ni sin sesión: los clics de la demo no son uso
 * real y meterlos falsearía el ranking que después decide los accesos rápidos.
 */
export function iniciarTelemetria(opciones: { demo: boolean }) {
  if (activa || opciones.demo) return;
  activa = true;

  temporizador = setInterval(() => enviar(), INTERVALO_MS);

  // `pagehide` es el evento fiable en iOS; `visibilitychange` cubre el caso
  // de cambiar de app sin cerrar. Entre los dos no se pierde el último lote.
  window.addEventListener('pagehide', () => enviar(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') enviar(true);
  });

  // Captura delegada: un solo listener para toda la app. Sube por el árbol
  // hasta encontrar [data-uso]. Lo que no esté etiquetado NO se registra —
  // deliberado: derivar la clave del texto del botón acabaría guardando
  // nombres de alumnos.
  document.addEventListener(
    'click',
    (e) => {
      const objetivo = (e.target as HTMLElement | null)?.closest?.('[data-uso]');
      const clave = objetivo?.getAttribute('data-uso');
      if (clave) registrarAccion(clave);
    },
    { capture: true, passive: true }
  );
}

/** Solo para pruebas: apaga y limpia. */
export function detenerTelemetria() {
  activa = false;
  if (temporizador) clearInterval(temporizador);
  temporizador = null;
  bufer.clear();
}
