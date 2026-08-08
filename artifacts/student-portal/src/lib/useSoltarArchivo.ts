/**
 * Arrastrar un archivo y soltarlo encima.
 *
 * Existía sólo en el alta de un alumno nuevo y resultó ser la forma en que la
 * gente prefiere subir documentos, así que vive aquí para poder usarse en
 * cualquier sitio donde se suba algo.
 *
 * ── Las tres cosas que no son obvias ────────────────────────────────────────
 *
 * 1. SE CUENTAN las entradas y salidas. `dragleave` se dispara también al pasar
 *    el cursor de un elemento a otro DENTRO de la misma zona —el icono, el
 *    texto—, así que apagar el resaltado ahí hace que parpadee mientras la
 *    persona se acerca. Con un contador, sólo se apaga cuando de verdad se
 *    salió de la zona.
 *
 * 2. SÓLO reacciona a archivos. Sin comprobarlo, arrastrar un texto
 *    seleccionado o un enlace enciende la zona y promete algo que no va a
 *    pasar.
 *
 * 3. SE BLOQUEA el resto de la ventana. Si alguien falla el tiro y suelta el
 *    archivo un centímetro al lado, el navegador ABRE ese archivo y se lleva la
 *    página por delante — con el formulario a medio llenar dentro. Es la peor
 *    consecuencia posible de un gesto que se está aprendiendo. El bloqueo se
 *    instala mientras haya al menos una zona montada y se quita sola cuando ya
 *    no hay ninguna, para no alterar el comportamiento del resto del portal.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Cuántas zonas hay vivas. Mientras sea > 0, soltar fuera de una zona no hace
 * nada en vez de navegar. El contador es de módulo porque el bloqueo es uno
 * solo para toda la ventana, no uno por zona.
 */
let zonasMontadas = 0;

function tragarEvento(e: DragEvent) {
  // Sólo los arrastres de archivos: no estorba a nada más de la página.
  if (e.dataTransfer?.types?.includes('Files')) e.preventDefault();
}

function usarBloqueoGlobal() {
  useEffect(() => {
    zonasMontadas++;
    if (zonasMontadas === 1) {
      window.addEventListener('dragover', tragarEvento);
      window.addEventListener('drop', tragarEvento);
    }
    return () => {
      zonasMontadas--;
      if (zonasMontadas === 0) {
        window.removeEventListener('dragover', tragarEvento);
        window.removeEventListener('drop', tragarEvento);
      }
    };
  }, []);
}

export interface ZonaSoltar {
  /** Hay un archivo encima, esperando a que lo suelten. Para el resaltado. */
  encima: boolean;
  /** Se hace spread en el elemento que recibe el archivo. */
  props: {
    onDragEnter: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
  };
}

/**
 * @param alSoltar  Recibe el primer archivo soltado. Se llama una sola vez por
 *                  gesto, aunque suelten varios: cada zona es un documento.
 * @param activo    En `false` la zona ignora todo (mientras sube, por ejemplo).
 */
export function useSoltarArchivo(alSoltar: (archivo: File) => void, activo = true): ZonaSoltar {
  const [encima, setEncima] = useState(false);
  const profundidad = useRef(0);
  usarBloqueoGlobal();

  // Si la zona se desactiva a media faena, el resaltado no se queda encendido.
  useEffect(() => {
    if (!activo) { profundidad.current = 0; setEncima(false); }
  }, [activo]);

  const traeArchivos = (e: React.DragEvent) => e.dataTransfer?.types?.includes('Files');

  const onDragEnter = useCallback((e: React.DragEvent) => {
    if (!activo || !traeArchivos(e)) return;
    e.preventDefault();
    profundidad.current++;
    setEncima(true);
  }, [activo]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    if (!activo || !traeArchivos(e)) return;
    // Sin este preventDefault el navegador no deja soltar aquí: es lo que
    // convierte al elemento en un destino válido.
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, [activo]);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (!activo || !traeArchivos(e)) return;
    profundidad.current = Math.max(0, profundidad.current - 1);
    if (profundidad.current === 0) setEncima(false);
  }, [activo]);

  const onDrop = useCallback((e: React.DragEvent) => {
    if (!activo || !traeArchivos(e)) return;
    e.preventDefault();
    e.stopPropagation();
    profundidad.current = 0;
    setEncima(false);
    const archivo = e.dataTransfer.files?.[0];
    if (archivo) alSoltar(archivo);
  }, [activo, alSoltar]);

  return { encima, props: { onDragEnter, onDragOver, onDragLeave, onDrop } };
}
