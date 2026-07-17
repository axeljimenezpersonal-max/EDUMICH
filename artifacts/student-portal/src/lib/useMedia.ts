/**
 * Breakpoints canónicos de Modula (mismos que Tailwind, en JS).
 *
 * REGLA DE ORO responsive del proyecto:
 *  - `< 640px`  → teléfono (una columna, tarjetas, barra inferior)
 *  - `< 768px`  → teléfono grande / tablet chica (aún sin barra lateral)
 *  - `≥ 768px`  → tablet y escritorio (barra lateral visible)
 *
 * En JSX se prefiere resolverlo con clases (`hidden md:block`), porque no
 * re-renderiza; este hook es para cuando la LÓGICA cambia según el tamaño
 * (p. ej. posicionar la tarjeta del tutorial o decidir columnas de un grid
 * calculado). Escucha cambios en vivo (rotación del teléfono incluida).
 */
import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, [query]);
  return match;
}

/** Teléfono: por debajo del breakpoint `sm` de Tailwind. */
export function useEsTelefono(): boolean {
  return useMediaQuery('(max-width: 639px)');
}

/** Sin barra lateral: por debajo del breakpoint `md` (teléfonos y tablets chicas). */
export function useEsMovil(): boolean {
  return useMediaQuery('(max-width: 767px)');
}
