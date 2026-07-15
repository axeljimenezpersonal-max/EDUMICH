/**
 * SectionTour — recorrido PROFUNDO de una página, bloque por bloque.
 *
 * Reutiliza el mismo motor pulido que el recorrido de bienvenida (spotlight
 * dorado + tarjeta con framer-motion + accesibilidad), pero se define por
 * página: recibe sus propios pasos y su clave de persistencia, y ofrece un
 * botón flotante para repetirlo.
 *
 * Auto-inicia UNA sola vez por página (solo escritorio). Si se indica `gateKey`
 * (la clave del recorrido de bienvenida del rol), espera a que ese recorrido se
 * haya completado para no encimarse con él la primera vez.
 */

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { HelpCircle } from 'lucide-react';
import { SpotlightOverlay, type SpotRect } from './SpotlightOverlay';
import { TourCard } from './TourCard';
import type { TourStep } from './steps';

interface Props {
  steps: TourStep[];
  storageKey: string;
  gateKey?: string;
  buttonLabel?: string;
  autoStart?: boolean;
}

export function SectionTour({
  steps,
  storageKey,
  gateKey,
  buttonLabel = 'Tutorial de esta sección',
  autoStart = true,
}: Props) {
  const total = steps.length;
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<SpotRect | null>(null);

  useEffect(() => {
    if (!autoStart || total === 0) return;
    try {
      if (localStorage.getItem(storageKey)) return;              // ya visto
      if (gateKey && localStorage.getItem(gateKey) !== '1') return; // espera a la bienvenida
    } catch { /* ignore */ }
    if (typeof window !== 'undefined' && window.innerWidth < 768) return;
    const t = setTimeout(() => { setIndex(0); setActive(true); }, 700);
    return () => clearTimeout(t);
  }, [autoStart, total, storageKey, gateKey]);

  const close = useCallback((done: boolean) => {
    setActive(false);
    if (done) { try { localStorage.setItem(storageKey, '1'); } catch { /* ignore */ } }
  }, [storageKey]);

  const start = useCallback(() => { if (total > 0) { setIndex(0); setActive(true); } }, [total]);
  const next = useCallback(() => setIndex((i) => (i >= total - 1 ? (close(true), i) : i + 1)), [total, close]);
  const prev = useCallback(() => setIndex((i) => (i > 0 ? i - 1 : 0)), []);
  const skip = useCallback(() => close(true), [close]);

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

  const step = active ? steps[Math.min(index, total - 1)] : undefined;

  return (
    <>
      {active && step && (
        <AnimatePresence>
          <SpotlightOverlay
            key="overlay"
            anchor={step.anchor}
            onRectChange={handleRect}
            onBackdropClick={skip}
          />
          <TourCard
            key="card"
            icon={step.icon}
            title={step.title}
            body={step.body}
            illustration={step.illustration}
            index={index}
            total={total}
            rect={step.anchor ? rect : null}
            placement={step.placement}
            isFirst={index === 0}
            isLast={index === total - 1}
            onNext={next}
            onPrev={prev}
            onSkip={skip}
          />
        </AnimatePresence>
      )}

      <button
        type="button"
        data-tour="btn-seccion-tutorial"
        onClick={start}
        className="fixed right-4 bottom-20 md:bottom-5 z-40 inline-flex items-center gap-1.5 rounded-full border border-[var(--color-crema-200)] bg-white px-3.5 py-2 text-xs font-semibold shadow-md hover:bg-stone-50"
        style={{ color: 'var(--color-guinda-700)' }}
        title="Ver el tutorial de esta sección"
      >
        <HelpCircle size={15} /> {buttonLabel}
      </button>
    </>
  );
}
