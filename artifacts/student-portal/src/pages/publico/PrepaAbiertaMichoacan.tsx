import { useEffect } from 'react';
import Login from '../Login';

/**
 * Portal de Michoacán servido bajo la URL con palabras clave
 * `/prepaabierta/michoacan`. El propósito es SEO: que la página posicione para
 * búsquedas como "prepa abierta michoacán". Renderiza exactamente el mismo login
 * que `/login`, pero fija un `<title>` optimizado mientras se está en esta ruta
 * (Google ejecuta el JS, así que sí toma este título para el índice).
 */
export default function PrepaAbiertaMichoacan() {
  useEffect(() => {
    const anterior = document.title;
    document.title = 'Prepa Abierta Michoacán · 22 módulos · Módula 22';
    return () => {
      document.title = anterior;
    };
  }, []);
  return <Login />;
}
