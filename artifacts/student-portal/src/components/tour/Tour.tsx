/**
 * Tour interactivo (product tour) reutilizable.
 * Overlay oscuro + spotlight recortado sobre el elemento objetivo + tarjeta
 * flotante con título, texto, contador "Paso X de N" y botones.
 *
 * Los objetivos se marcan con `data-tour="id"` y el paso apunta con
 * target="[data-tour='id']". Si un paso no tiene target, la tarjeta se centra.
 */

import { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react';

export interface TourStep {
  target?: string;            // selector CSS; sin target → tarjeta centrada
  title: string;
  body: string;
  placement?: 'right' | 'bottom' | 'top' | 'left' | 'auto';
}

const CARD_W = 340;

// Elige el elemento VISIBLE entre los que coincidan (evita duplicados sidebar/móvil).
function targetVisible(sel: string): HTMLElement | null {
  const els = Array.from(document.querySelectorAll<HTMLElement>(sel));
  return els.find((el) => el.offsetParent !== null && el.getClientRects().length > 0) ?? els[0] ?? null;
}

export function Tour({ steps, onClose }: { steps: TourStep[]; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = steps[i];
  const total = steps.length;

  useLayoutEffect(() => {
    let raf = 0;
    function update() {
      if (!step.target) { setRect(null); return; }
      const el = targetVisible(step.target);
      const r = el?.getBoundingClientRect();
      if (el && r && r.width > 0 && r.height > 0) {
        el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
        setRect(r);
      } else {
        // Objetivo ausente u oculto (p. ej. sidebar en móvil) → tarjeta centrada.
        setRect(null);
      }
    }
    update();
    const loop = () => { update(); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    window.addEventListener('resize', update);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', update); };
  }, [i, step.target]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      else if (e.key === 'ArrowLeft') prev();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function next() { if (i < total - 1) setI(i + 1); else onClose(); }
  function prev() { if (i > 0) setI(i - 1); }

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

  // Posición de la tarjeta
  const cardStyle: React.CSSProperties = { width: CARD_W };
  if (!rect) {
    cardStyle.left = Math.round(vw / 2 - CARD_W / 2);
    cardStyle.top = Math.round(vh / 2 - 130);
  } else {
    const gap = 14;
    const placement = step.placement ?? 'auto';
    const cabeDerecha = rect.right + gap + CARD_W < vw;
    const usarDerecha = placement === 'right' || (placement === 'auto' && cabeDerecha);
    if (usarDerecha) {
      cardStyle.left = Math.min(rect.right + gap, vw - CARD_W - 12);
      cardStyle.top = Math.max(12, Math.min(rect.top, vh - 230));
    } else if (placement === 'left') {
      cardStyle.left = Math.max(12, rect.left - gap - CARD_W);
      cardStyle.top = Math.max(12, Math.min(rect.top, vh - 230));
    } else {
      // abajo (o arriba si no cabe)
      const abajo = rect.bottom + gap + 200 < vh;
      cardStyle.top = abajo ? rect.bottom + gap : Math.max(12, rect.top - gap - 200);
      cardStyle.left = Math.max(12, Math.min(rect.left, vw - CARD_W - 12));
    }
  }

  const spot = rect
    ? { left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12 }
    : null;

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
      {/* Capa oscura: con spotlight (box-shadow gigante) o plana si es centrado */}
      {spot ? (
        <div
          style={{
            position: 'fixed',
            left: spot.left, top: spot.top, width: spot.width, height: spot.height,
            borderRadius: 10,
            boxShadow: '0 0 0 9999px rgba(28,10,18,0.62)',
            outline: '2px solid rgba(255,255,255,0.85)',
            transition: 'all 0.18s ease',
            pointerEvents: 'none',
          }}
        />
      ) : (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,10,18,0.62)' }} onClick={onClose} />
      )}

      {/* Tarjeta */}
      <div
        style={{
          position: 'fixed',
          ...cardStyle,
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 18px 50px -12px rgba(74,14,32,0.45)',
          overflow: 'hidden',
          transition: 'left 0.18s ease, top 0.18s ease',
        }}
      >
        {/* Barra de progreso */}
        <div style={{ height: 4, background: '#f0e7dc' }}>
          <div style={{ height: 4, width: `${((i + 1) / total) * 100}%`, background: 'var(--color-guinda-700)', transition: 'width 0.2s ease' }} />
        </div>

        <div style={{ padding: '18px 20px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-dorado)' }}>
              <Sparkles size={12} /> Paso {i + 1} de {total}
            </span>
            <button onClick={onClose} aria-label="Cerrar tutorial" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a89a8e', padding: 2 }}>
              <X size={16} />
            </button>
          </div>
          <h3 style={{ margin: '0 0 6px', fontFamily: 'Georgia, serif', fontSize: 19, fontWeight: 700, color: '#1c1917' }}>{step.title}</h3>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: '#57504a' }}>{step.body}</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 16px' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#a89a8e' }}>
            Saltar tutorial
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {i > 0 && (
              <button
                onClick={prev}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: '1px solid #eadfd7', background: '#fff', fontSize: 13, fontWeight: 600, color: '#57504a', cursor: 'pointer' }}
              >
                <ArrowLeft size={14} /> Atrás
              </button>
            )}
            <button
              onClick={next}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, border: 'none', background: 'var(--color-guinda-700)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              {i === total - 1 ? <>Entendido <Check size={14} /></> : <>Siguiente <ArrowRight size={14} /></>}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
