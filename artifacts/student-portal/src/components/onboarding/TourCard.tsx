/**
 * Tarjeta flotante del tour: icono, título, cuerpo, contador de pasos y
 * controles. Se posiciona junto al objetivo iluminado (o centrada si no hay).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import * as Icons from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import { X, ArrowLeft, ArrowRight, Check } from 'lucide-react';
import type { Placement } from './steps';
import type { SpotRect } from './SpotlightOverlay';
import { ILLUSTRATIONS } from './TourIllustrations';
import { useEsTelefono } from '../../lib/useMedia';

interface Props {
  icon?: string;
  title: string;
  body: string;
  index: number;
  total: number;
  rect: SpotRect | null;
  placement?: Placement;
  isLast: boolean;
  isFirst: boolean;
  onNext: () => void;
  onPrev: () => void;
  /** «Ahora no»: cierra SIN marcar visto — se volverá a ofrecer (R1). */
  onSkip: () => void;
  /**
   * «No volver a mostrar»: silencia el auto-arranque para siempre. Necesario
   * desde que saltar dejó de significar «nunca más»; sin esto, quien no quiere
   * el tutorial no tendría forma de apagarlo. Ausente en la bienvenida del rol.
   */
  onNoMostrar?: () => void;
  illustration?: string;
}

const CARD_W = 416;
const GAP = 16;
const MARGIN = 12;

function resolveIcon(name?: string): React.ComponentType<LucideProps> {
  const lib = Icons as unknown as Record<string, React.ComponentType<LucideProps>>;
  return (name && lib[name]) || Icons.Sparkles;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(v, max));
}

function computePosition(
  rect: SpotRect | null,
  placement: Placement | undefined,
  cardW: number,
  cardH: number,
): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (!rect) {
    return {
      top: clamp(vh / 2 - cardH / 2, MARGIN, vh - cardH - MARGIN),
      left: clamp(vw / 2 - cardW / 2, MARGIN, vw - cardW - MARGIN),
    };
  }

  let side = placement ?? 'auto';
  if (side === 'auto') {
    const space = {
      bottom: vh - (rect.top + rect.height),
      top: rect.top,
      right: vw - (rect.left + rect.width),
      left: rect.left,
    };
    side = (Object.keys(space) as Placement[]).reduce((best, k) =>
      space[k as 'bottom' | 'top' | 'right' | 'left'] >
      space[best as 'bottom' | 'top' | 'right' | 'left'] ? k : best,
      'bottom' as Placement,
    );
  }

  let top: number;
  let left: number;
  switch (side) {
    case 'top':
      top = rect.top - cardH - GAP;
      left = rect.left + rect.width / 2 - cardW / 2;
      break;
    case 'left':
      top = rect.top + rect.height / 2 - cardH / 2;
      left = rect.left - cardW - GAP;
      break;
    case 'right':
      top = rect.top + rect.height / 2 - cardH / 2;
      left = rect.left + rect.width + GAP;
      break;
    case 'bottom':
    default:
      top = rect.top + rect.height + GAP;
      left = rect.left + rect.width / 2 - cardW / 2;
      break;
  }

  return {
    top: clamp(top, MARGIN, vh - cardH - MARGIN),
    left: clamp(left, MARGIN, vw - cardW - MARGIN),
  };
}

export function TourCard({ icon, title, body, index, total, rect, placement, isLast, isFirst, onNext, onPrev, onSkip, onNoMostrar, illustration }: Props) {
  const Icon = useMemo(() => resolveIcon(icon), [icon]);
  const Illustration = illustration ? ILLUSTRATIONS[illustration] : undefined;
  const cardRef = useRef<HTMLDivElement>(null);
  const nextBtnRef = useRef<HTMLButtonElement>(null);
  // En teléfono la tarjeta es una HOJA INFERIOR a lo ancho (estilo app): no se
  // posiciona junto al elemento —no cabría— sino anclada abajo, y el spotlight
  // sigue iluminando el bloque del que se habla.
  const esTelefono = useEsTelefono();

  const [pos, setPos] = useState(() => computePosition(rect, placement, CARD_W, 240));

  useEffect(() => {
    if (esTelefono) return;
    const place = () => {
      const h = cardRef.current?.offsetHeight ?? 240;
      setPos(computePosition(rect, placement, CARD_W, h));
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [rect, placement, index, esTelefono]);

  // Foco en el botón principal al cambiar de paso (accesibilidad por teclado).
  useEffect(() => { nextBtnRef.current?.focus(); }, [index]);

  return (
    <motion.div
      ref={cardRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-card-title"
      aria-describedby="tour-card-body"
      className="fixed z-[9999] bg-white rounded-2xl overflow-hidden"
      style={esTelefono ? (
        // Si el elemento iluminado vive en la zona BAJA de la pantalla (p. ej.
        // la barra de navegación inferior), la hoja brinca arriba para no taparlo.
        rect && rect.top > window.innerHeight * 0.6 ? {
          left: 8,
          right: 8,
          top: 'calc(env(safe-area-inset-top, 0px) + 84px)',
          maxHeight: 'calc(100dvh - 200px)',
          overflowY: 'auto',
          boxShadow: '0 18px 50px -12px rgba(74,14,32,0.5)',
        } : {
          left: 8,
          right: 8,
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
          maxHeight: 'calc(100dvh - 96px)',
          overflowY: 'auto',
          boxShadow: '0 -12px 50px -12px rgba(74,14,32,0.5)',
        }
      ) : {
        width: CARD_W,
        maxWidth: 'calc(100vw - 24px)',
        top: pos.top,
        left: pos.left,
        boxShadow: '0 18px 50px -12px rgba(74,14,32,0.45)',
      }}
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
    >
      {/* Barra de progreso superior */}
      <div style={{ height: 4, background: 'var(--color-crema-200)' }}>
        <motion.div
          style={{ height: 4, background: 'var(--color-guinda-700)' }}
          initial={false}
          animate={{ width: `${((index + 1) / total) * 100}%` }}
          transition={{ duration: 0.25 }}
        />
      </div>

      <div className="p-6">
        <div className="flex items-start gap-3.5 mb-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-white"
            style={{ background: 'var(--color-guinda-700)' }}
            aria-hidden
          >
            <Icon size={24} />
          </div>
          <div className="min-w-0 pt-0.5">
            <div
              className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] mb-1"
              style={{ color: 'var(--color-dorado)' }}
            >
              Paso {index + 1} de {total}
            </div>
            <h2
              id="tour-card-title"
              className="font-serif text-xl font-bold leading-snug"
              style={{ color: '#1c1917' }}
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onSkip}
            aria-label="Cerrar tutorial"
            className="ml-auto -mt-1 -mr-1 p-1.5 rounded-md text-stone-400 hover:text-[var(--color-guinda-700)] hover:bg-[var(--color-crema-100)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <p id="tour-card-body" className="text-[15px] text-stone-600 leading-relaxed">
          {body}
        </p>

        {Illustration && <Illustration />}

        {/* Puntos de progreso */}
        <div className="flex items-center gap-1.5 mt-4 mb-4" aria-hidden>
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === index ? 20 : 7,
                height: 7,
                background: i === index ? 'var(--color-guinda-700)' : 'var(--color-crema-200)',
              }}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          {/* Salidas: «Saltar» solo aplaza (se vuelve a ofrecer); «No volver a
              mostrar» es la única que apaga el tutorial de forma permanente. */}
          <div className="flex min-w-0 flex-col items-start gap-0.5">
            <button
              type="button"
              onClick={onSkip}
              className="text-[13px] font-semibold text-stone-400 hover:text-[var(--color-guinda-700)] transition-colors"
            >
              {isLast ? 'Cerrar' : 'Saltar tutorial'}
            </button>
            {onNoMostrar && !isLast && (
              <button
                type="button"
                onClick={onNoMostrar}
                className="text-[11px] text-stone-300 underline underline-offset-2 hover:text-stone-500 transition-colors"
              >
                No volver a mostrar
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                type="button"
                onClick={onPrev}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-crema-200)] bg-white px-4 py-2.5 text-[15px] font-semibold text-stone-600 hover:bg-stone-50 transition-colors"
              >
                <ArrowLeft size={16} /> Atrás
              </button>
            )}
            <button
              ref={nextBtnRef}
              type="button"
              onClick={onNext}
              className="inline-flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-[15px] font-bold text-white transition-colors"
              style={{ background: 'var(--color-guinda-700)' }}
            >
              {isLast ? <>Entendido <Check size={16} /></> : <>Siguiente <ArrowRight size={16} /></>}
            </button>
          </div>
        </div>
      </div>

      <span className="sr-only">Paso {index + 1} de {total}</span>
    </motion.div>
  );
}
