/**
 * Capa oscura con "spotlight" recortado sobre el elemento objetivo.
 * El objetivo se localiza por `[data-tour="<anchor>"]`. Si no existe o está
 * oculto (p. ej. la barra lateral en móvil), se muestra la capa plana y la
 * tarjeta se centra.
 */

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export interface SpotRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Props {
  anchor?: string;
  padding?: number;
  onRectChange?: (rect: SpotRect | null) => void;
  onBackdropClick?: () => void;
}

/** Elige el elemento VISIBLE entre los que coincidan (evita duplicados sidebar/móvil). */
function measure(anchor?: string): SpotRect | null {
  if (!anchor) return null;
  const els = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${anchor}"]`));
  const el = els.find((e) => e.offsetParent !== null && e.getClientRects().length > 0) ?? els[0];
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

const OVERLAY = 'rgba(28, 10, 18, 0.62)';

export function SpotlightOverlay({ anchor, padding = 8, onRectChange, onBackdropClick }: Props) {
  const [rect, setRect] = useState<SpotRect | null>(() => measure(anchor));

  useEffect(() => {
    // Medición SÍNCRONA (no dependemos de requestAnimationFrame, que el
    // navegador congela cuando la pestaña no está visible).
    const measureOnly = () => {
      const next = measure(anchor);
      setRect(next);
      onRectChange?.(next);
    };

    // Scroll UNA sola vez al cambiar de paso: deja el bloque objetivo justo
    // debajo del header si no está cómodamente visible. Predecible y sin dejar
    // huecos (a diferencia de scrollIntoView 'center'/'nearest').
    const el = anchor ? document.querySelector<HTMLElement>(`[data-tour="${anchor}"]`) : null;
    if (el) {
      const r = el.getBoundingClientRect();
      const topGap = 120;   // espacio bajo el header sticky
      const botMargin = 90;
      if (r.top < topGap || r.bottom > window.innerHeight - botMargin) {
        window.scrollTo({ top: Math.max(0, window.scrollY + r.top - topGap), behavior: 'smooth' });
      }
    }

    measureOnly();
    let frame = 0;
    const debounced = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measureOnly);
    };
    window.addEventListener('resize', debounced);
    window.addEventListener('scroll', debounced, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', debounced);
      window.removeEventListener('scroll', debounced, true);
    };
  }, [anchor, onRectChange]);

  const spring = { type: 'spring' as const, stiffness: 320, damping: 32 };

  if (!rect) {
    return (
      <motion.div
        className="fixed inset-0 z-[9998]"
        style={{ background: OVERLAY }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        onClick={onBackdropClick}
        aria-hidden
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[9998]" aria-hidden>
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        onClick={onBackdropClick}
      />
      <motion.div
        className="absolute rounded-lg pointer-events-none"
        initial={false}
        animate={{
          top: rect.top - padding,
          left: rect.left - padding,
          width: rect.width + padding * 2,
          height: rect.height + padding * 2,
        }}
        transition={spring}
        style={{
          boxShadow: `0 0 0 9999px ${OVERLAY}, 0 0 0 3px var(--color-dorado)`,
        }}
      />
    </div>
  );
}
