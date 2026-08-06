/**
 * Vista previa — el lado del navegador.
 *
 * El portal completo se abre dentro de un marco desde el panel del creador, y
 * cada petición que sale de ese marco lleva la cabecera `X-Preview-Usuario`.
 * El servidor la atiende como si viniera de esa persona, en sólo lectura
 * (ver `middleware/preview.ts` en el API). Así lo que se ve es la aplicación
 * de verdad —no una maqueta que se queda vieja a la primera mejora— con los
 * datos de verdad.
 *
 * ── Por qué `window.name` y no sessionStorage ni la URL ─────────────────────
 *
 * `sessionStorage` es de la PESTAÑA: el marco y el panel del creador lo
 * comparten, así que el propio panel empezaría a mandar la cabecera y se vería
 * a sí mismo como el alumno. Sería un error difícil de entender viéndolo.
 *
 * La URL tampoco sirve sola: en cuanto se navega dentro del portal, wouter
 * reescribe la dirección y el parámetro se pierde a la primera pantalla.
 *
 * `window.name` es de ESE marco y de nadie más, y sobrevive tanto a la
 * navegación interna como a una recarga completa. Es exactamente la vida útil
 * que necesita la marca.
 *
 * Nada de esto es una medida de seguridad: es una comodidad del cliente. Quien
 * decide qué se puede ver y que no se pueda escribir es el servidor.
 */

const PREFIJO = 'modula-preview:';

function leerMarca(): number | null {
  if (typeof window === 'undefined') return null;

  // 1) La marca del marco, puesta por el panel del creador.
  if (window.name.startsWith(PREFIJO)) {
    const id = Number(window.name.slice(PREFIJO.length));
    if (Number.isInteger(id) && id > 0) return id;
  }

  // 2) O el parámetro de la dirección, para poder abrir la vista previa en una
  //    pestaña aparte. Se copia a `window.name` de inmediato: al primer clic
  //    dentro del portal el parámetro ya no estará.
  const desdeUrl = Number(new URLSearchParams(window.location.search).get('preview'));
  if (Number.isInteger(desdeUrl) && desdeUrl > 0) {
    window.name = `${PREFIJO}${desdeUrl}`;
    return desdeUrl;
  }

  return null;
}

/** El usuario que se está observando, o `null` si esto no es una vista previa. */
export const USUARIO_PREVIEW: number | null = leerMarca();

export const EN_VISTA_PREVIA = USUARIO_PREVIEW !== null;

/** Nombre del marco que hay que ponerle al `<iframe>` para que arranque así. */
export function marcaDeMarco(userId: number): string {
  return `${PREFIJO}${userId}`;
}

/**
 * Mensaje para cuando alguien intenta guardar algo estando en vista previa.
 * El servidor lo rechaza igual; esto evita el viaje y, sobre todo, evita que
 * la pantalla muestre un "no tienes permiso" que aquí sería desconcertante.
 */
export const AVISO_SOLO_LECTURA =
  'Esto es una vista previa de sólo lectura: se ve lo que ve esta persona, pero no se puede guardar nada en su nombre.';

/** Le pega el parámetro `_vp` a una dirección del API. */
function conMarca(url: string, id: number): string {
  if (!url.startsWith('/api/') || url.includes('_vp=')) return url;
  return url + (url.includes('?') ? '&' : '?') + `_vp=${id}`;
}

/**
 * Prende la vista previa en TODO lo que sale de este marco.
 *
 * Son dos enganches porque el navegador pide cosas por dos caminos distintos y
 * cubrir sólo uno deja la mitad de la pantalla rota:
 *
 *  1. `fetch` — el cliente de `lib/api.ts` y las cuarenta llamadas sueltas que
 *     nunca pasaron por él. Se les pone la cabecera.
 *
 *  2. El HTML — `<img src="/api/...">` de las fotos del expediente y los
 *     enlaces de descarga, que NO admiten cabeceras. A ésos se les pega el
 *     parámetro `_vp`. Sin esto, previsualizar el expediente de un alumno
 *     mostraría todos los documentos rotos y parecería un problema de sus
 *     datos y no de la herramienta.
 *
 * Todo esto vive sólo dentro de la vista previa: si `USUARIO_PREVIEW` es nulo
 * —o sea, en el portal de cualquier persona real— esta función no hace nada y
 * no queda ni un enganche puesto.
 */
export function activarVistaPrevia(): void {
  const id = USUARIO_PREVIEW;
  if (id === null || typeof window === 'undefined') return;

  const fetchOriginal = window.fetch.bind(window);
  window.fetch = (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.toString() : entrada.url;
    if (url.startsWith('/api/')) {
      const cabeceras = new Headers(init?.headers ?? (entrada instanceof Request ? entrada.headers : undefined));
      cabeceras.set('X-Preview-Usuario', String(id));
      return fetchOriginal(entrada, { ...init, headers: cabeceras });
    }
    return fetchOriginal(entrada, init);
  };

  const SELECTOR = 'img[src^="/api/"], iframe[src^="/api/"], a[href^="/api/"], embed[src^="/api/"], object[data^="/api/"]';

  const marcarUno = (el: Element) => {
    for (const attr of ['src', 'href', 'data']) {
      const valor = el.getAttribute(attr);
      if (!valor?.startsWith('/api/')) continue;
      const marcado = conMarca(valor, id);
      // Sólo se escribe si de verdad cambia. Reescribir el mismo valor dispara
      // otra mutación, que volvería a entrar aquí: sería un bucle infinito.
      if (marcado !== valor) el.setAttribute(attr, marcado);
    }
  };

  const marcarNodo = (n: Node) => {
    if (!(n instanceof HTMLElement)) return;
    marcarUno(n);
    n.querySelectorAll(SELECTOR).forEach(marcarUno);
  };

  const observador = new MutationObserver((cambios) => {
    for (const c of cambios) {
      if (c.type === 'childList') c.addedNodes.forEach(marcarNodo);
      else if (c.target) marcarNodo(c.target);
    }
  });
  observador.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'href'],
  });
  marcarNodo(document.body);
}
