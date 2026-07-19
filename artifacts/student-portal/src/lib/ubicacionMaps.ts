/**
 * Saca coordenadas de lo que sea que la persona pegue.
 *
 * Se guardan COORDENADAS y no el enlace, por tres razones:
 *
 *  1. Las coordenadas abren en cualquier app —Google Maps, Apple Maps, Waze—.
 *     Un enlace de Google obliga a Google, y muchos alumnos traen iPhone.
 *  2. Permiten ofrecer "cómo llegar" con ruta, no sólo mostrar el punto.
 *  3. Guardar una URL ajena y pintarla como `href` para miles de alumnos es
 *     superficie de open-redirect y de `javascript:`. Un par de números no.
 *
 * Los enlaces cortos (`maps.app.goo.gl`) NO traen coordenadas: habría que
 * seguir la redirección desde el servidor, y hoy el API no hace ni una sola
 * petición saliente. Eso es una propiedad de seguridad que no vale la pena
 * cambiar por comodidad, así que se detectan y se explica qué hacer.
 */

export type Ubicacion = { lat: number; lng: number };

export type ResultadoUbicacion =
  | { ok: true; ubicacion: Ubicacion }
  | { ok: false; motivo: 'vacio' | 'enlace_corto' | 'sin_coordenadas' | 'fuera_de_rango' };

/** ¿El par cae dentro del planeta? Atrapa lat/lng invertidas o dedazos. */
function enRango(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng)
    && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

/**
 * Formas que se aceptan, en orden de intento:
 *
 *  · "19.7008, -101.1844"                         ← clic derecho en Google Maps
 *  · ".../maps/@19.7008,-101.1844,17z"            ← barra de direcciones
 *  · ".../maps/place/X/@19.7008,-101.1844,17z"    ← al abrir un lugar
 *  · ".../maps?q=19.7008,-101.1844"               ← enlace de compartir clásico
 *  · ".../maps?ll=19.7008,-101.1844"
 *  · ".../maps/search/?api=1&query=19.7,-101.1"
 *  · "geo:19.7008,-101.1844"                      ← Android
 */
export function parseUbicacion(texto: string): ResultadoUbicacion {
  const t = (texto ?? '').trim();
  if (!t) return { ok: false, motivo: 'vacio' };

  if (/(maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(t)) {
    return { ok: false, motivo: 'enlace_corto' };
  }

  // Un par de números suelto: es lo que da el clic derecho de Google Maps.
  const par = t.match(/^\s*(-?\d{1,3}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
  if (par) {
    const lat = parseFloat(par[1]);
    const lng = parseFloat(par[2]);
    return enRango(lat, lng)
      ? { ok: true, ubicacion: { lat, lng } }
      : { ok: false, motivo: 'fuera_de_rango' };
  }

  // Dentro de una URL. El @ va primero porque en las URLs de "place" aparecen
  // las dos cosas y el @ es el punto real; `q=` suele traer el nombre escrito.
  const patrones = [
    /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,
    /[?&](?:q|ll|query|daddr|center)=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/i,
    /^geo:(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/i,
    /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/, // formato interno de los enlaces largos
  ];
  for (const re of patrones) {
    const m = t.match(re);
    if (m) {
      const lat = parseFloat(m[1]);
      const lng = parseFloat(m[2]);
      if (enRango(lat, lng)) return { ok: true, ubicacion: { lat, lng } };
      return { ok: false, motivo: 'fuera_de_rango' };
    }
  }

  return { ok: false, motivo: 'sin_coordenadas' };
}

/** Mensaje para la persona que está capturando, no para un programador. */
export function explicar(motivo: Exclude<ResultadoUbicacion, { ok: true }>['motivo']): string {
  switch (motivo) {
    case 'enlace_corto':
      return 'Ese enlace corto no trae la ubicación dentro. Ábrelo en el navegador y copia la dirección completa que aparece arriba, o haz clic derecho sobre el punto en Google Maps y copia las coordenadas.';
    case 'fuera_de_rango':
      return 'Esas coordenadas no existen. Revisa que no estén invertidas (primero la latitud, luego la longitud).';
    case 'sin_coordenadas':
      return 'No encontré coordenadas ahí. Pega el enlace de Google Maps del navegador, o haz clic derecho sobre el punto y copia los dos números.';
    default:
      return '';
  }
}

/** Para el botón de comprobación al capturar la sede. */
export function urlDeMapa(u: Ubicacion): string {
  return `https://www.google.com/maps?q=${u.lat},${u.lng}`;
}

/**
 * A dónde manda el botón del alumno.
 *
 * Devuelve una URL de RUTA, no de "ver el punto": el día del examen el alumno
 * no necesita saber dónde queda, necesita llegar. Google resuelve el origen
 * solo, desde donde esté.
 *
 * Se usa la forma universal `maps/dir/?api=1`, que es la que Google documenta
 * como estable: en el teléfono abre la aplicación si está instalada, y si no,
 * el navegador — sin necesidad de detectar el sistema operativo, que siempre
 * acaba fallando con algún dispositivo.
 *
 * Sin coordenadas cae en el nombre y la dirección, que sigue dando ruta: es
 * menos preciso, pero mejor que no ofrecer nada. Por eso capturar la ubicación
 * es opcional y no bloquea.
 */
export function urlComoLlegar(sede: {
  latitud?: string | number | null;
  longitud?: string | number | null;
  nombre: string;
  direccion: string;
}): string {
  const destino =
    sede.latitud != null && sede.longitud != null && String(sede.latitud) !== '' && String(sede.longitud) !== ''
      ? `${sede.latitud},${sede.longitud}`
      : `${sede.nombre} ${sede.direccion}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}`;
}

/** ¿Se capturó la ubicación exacta, o vamos a depender de la búsqueda por texto? */
export function tieneUbicacionExacta(sede: {
  latitud?: string | number | null;
  longitud?: string | number | null;
}): boolean {
  return sede.latitud != null && sede.longitud != null
    && String(sede.latitud) !== '' && String(sede.longitud) !== '';
}
