/**
 * La dirección "buena" (canónica) de cada página.
 *
 * ── El problema que resuelve ────────────────────────────────────────────────
 * Las mismas páginas responden en VARIOS dominios: `modula22.mx` (la puerta
 * nacional), `prepa.modula22.mx` (Michoacán) y `michoacan.modula22.mx`. Para un
 * buscador eso es la misma página tres veces, y sin una señal de cuál es la
 * buena reparte la fuerza entre las tres y no posiciona ninguna. Peor: puede
 * mostrarle a un michoacano la dirección nacional, o al revés.
 *
 * `<link rel="canonical">` es esa señal. Aquí se calcula por ruta y se
 * actualiza al navegar, porque el portal es una sola página y la etiqueta fija
 * de `index.html` decía "soy la raíz" en TODAS las rutas.
 *
 * ── Cómo se cambia cuando entre otro estado ─────────────────────────────────
 * Michoacán mudará su cara pública a `michoacan.modula22.mx` cuando ese
 * subdominio esté en el DNS y comprobado. Ese día se cambia UNA línea aquí
 * (`DOMINIO_MICHOACAN`) y nada más: `prepa` seguirá funcionando para siempre
 * —ahí apuntan los QR ya impresos y los correos ya enviados— pero dejará de
 * ser la dirección que el buscador anuncia.
 */

/** La puerta nacional: el selector de estados. */
export const DOMINIO_NACIONAL = 'https://modula22.mx';

/**
 * La operación de Michoacán. Hoy `prepa` porque es la que está viva, la que
 * llevan grabada los QR de las credenciales y la de los correos ya enviados.
 */
export const DOMINIO_MICHOACAN = 'https://prepa.modula22.mx';

/** Rutas públicas que un buscador debería indexar, y a qué dominio pertenecen. */
const RUTAS_NACIONALES = new Set(['/']);

/**
 * Dirección canónica de una ruta. Solo la raíz es nacional: todo lo demás
 * —login, solicitar cuenta, el portal— es la operación de un estado.
 */
export function canonicoDe(ruta: string): string {
  const limpia = ruta.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
  if (RUTAS_NACIONALES.has(limpia)) return `${DOMINIO_NACIONAL}/`;
  return `${DOMINIO_MICHOACAN}${limpia}`;
}

/**
 * Escribe la etiqueta en el documento. Crea el `<link>` si no existe, para no
 * depender de que `index.html` lo traiga.
 */
export function fijarCanonico(ruta: string): void {
  const url = canonicoDe(ruta);
  let etiqueta = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!etiqueta) {
    etiqueta = document.createElement('link');
    etiqueta.rel = 'canonical';
    document.head.appendChild(etiqueta);
  }
  etiqueta.href = url;

  // og:url acompaña al canónico: es lo que se ve al compartir el enlace en
  // WhatsApp o redes, y si se queda en la raíz todo se comparte como si fuera
  // la página de inicio.
  const og = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
  if (og) og.content = url;
}
