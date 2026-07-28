/**
 * Orquesta el recorrido de bienvenida de un rol: overlay + spotlight + tarjeta.
 * Se monta una vez dentro de cada layout. El botón de ayuda "?" del header lo
 * relanza disparando el evento `modula:start-tour`.
 */

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { Rol } from '../../lib/api';
import { SpotlightOverlay, type SpotRect } from './SpotlightOverlay';
import { TourCard } from './TourCard';
import { useOnboarding } from './useOnboarding';

/** Evento global para relanzar el tour desde cualquier parte (p. ej. el header). */
export const START_TOUR_EVENT = 'modula:start-tour';

interface Props {
  rol: Rol | null | undefined;
  nombre?: string;
  municipio?: string;
  /**
   * Por defecto el saludo usa solo el PRIMER nombre ("¡Hola, Juan!"), que es lo
   * natural para una persona. Cuando el "nombre" es el de una institución —el
   * centro de asesoría del gestor, p. ej. "Centro UTEC"— conviene mostrarlo
   * completo: pásalo en false para no truncarlo a "Centro".
   */
  abreviarNombre?: boolean;
}

function personalize(text: string, nombre?: string, municipio?: string, abreviar = true): string {
  const limpio = nombre?.trim();
  const mostrado = abreviar ? limpio?.split(/\s+/)[0] : limpio;
  return text
    .replaceAll('{nombre}', mostrado || 'te')
    .replaceAll('{municipio}', municipio?.trim() || 'tu municipio');
}

export function OnboardingTour({ rol, nombre, municipio, abreviarNombre = true }: Props) {
  const tour = useOnboarding(rol);
  const { active, step, index, total, next, prev, skip, start } = tour;
  const [rect, setRect] = useState<SpotRect | null>(null);

  // Relanzar desde el botón de ayuda del header.
  useEffect(() => {
    const onStart = () => start();
    window.addEventListener(START_TOUR_EVENT, onStart);
    return () => window.removeEventListener(START_TOUR_EVENT, onStart);
  }, [start]);

  // Teclado: Esc cierra, flechas navegan.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); skip(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, skip, next, prev]);

  useEffect(() => { if (!active) setRect(null); }, [active]);

  const handleRect = useCallback((r: SpotRect | null) => setRect(r), []);

  if (!active || !step) return null;

  const title = personalize(step.title, nombre, municipio, abreviarNombre);
  const body = personalize(step.body, nombre, municipio, abreviarNombre);
  const anchor = step.anchor;

  return (
    <AnimatePresence>
      <SpotlightOverlay
        key="overlay"
        anchor={anchor}
        onRectChange={handleRect}
        onBackdropClick={skip}
      />
      <TourCard
        key="card"
        icon={step.icon}
        title={title}
        body={body}
        illustration={step.illustration}
        index={index}
        total={total}
        rect={anchor ? rect : null}
        placement={step.placement}
        isFirst={index === 0}
        isLast={index === total - 1}
        onNext={next}
        onPrev={prev}
        onSkip={skip}
      />
    </AnimatePresence>
  );
}
