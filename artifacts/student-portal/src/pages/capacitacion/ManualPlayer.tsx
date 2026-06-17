/**
 * ManualPlayer — reproductor reutilizable del Centro de capacitación.
 *
 * Recibe una lista de escenas y las reproduce como un "video": una escena a la
 * vez con fade, auto-avance ~6 s, controles (anterior · play/pausa · siguiente),
 * barra de progreso por escena, contador y navegación directa (chips o menú
 * lateral). Respeta `prefers-reduced-motion`.
 *
 * 100 % presentación/mock — no consume datos reales.
 *
 * Ubicación: artifacts/student-portal/src/pages/capacitacion/ManualPlayer.tsx
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';

export type EstadoBadge = 'ok' | 'wt' | 'no' | 'go' | 'nu';

export interface Escena {
  /** Etiqueta corta para chips / menú lateral. */
  name: string;
  /** Texto de la pill (módulo). */
  pill: string;
  /** Etiqueta izquierda del scr-tag, p.ej. "Vista · Alumno". */
  tag: string;
  /** Caption explicativo bajo el reproductor (admite <b>). */
  caption: ReactNode;
  /** Contenido mock de la escena (todo lo que va debajo del scr-tag). */
  content: ReactNode;
  /** Ícono lucide para el menú lateral (solo modo 'sidebar'). */
  icon?: ReactNode;
}

interface ManualPlayerProps {
  escenas: Escena[];
  /** URL mostrada en la barra del navegador, p.ej. "edumich.mx / alumno". */
  url: string;
  /** Tipo de navegación directa: chips (alumno/gestor) o menú lateral (admin). */
  nav?: 'chips' | 'sidebar';
  /** Encabezado del menú lateral (modo 'sidebar'). */
  sideHeading?: string;
  /** Etiqueta del contador: "Escena" (default) o "Sección". */
  counterLabel?: string;
  /** Duración del auto-avance en ms (default 6000). */
  durationMs?: number;
}

const pad = (i: number) => (i < 9 ? '0' : '') + (i + 1);
const padTotal = (n: number) => (n < 10 ? '0' : '') + n;

const IconPrev = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 5h2v14H6zM20 5L9 12l11 7z" />
  </svg>
);
const IconNext = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M16 5h2v14h-2zM4 5l11 7L4 19z" />
  </svg>
);
const IconPause = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="5" width="4" height="14" />
    <rect x="14" y="5" width="4" height="14" />
  </svg>
);
const IconPlay = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 5l12 7-12 7z" />
  </svg>
);

export default function ManualPlayer({
  escenas,
  url,
  nav = 'chips',
  sideHeading = 'Panel',
  counterLabel = 'Escena',
  durationMs = 6000,
}: ManualPlayerProps) {
  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(!prefersReduced);
  const navRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const n = escenas.length;
  const goto = (i: number) => setCurrent(((i % n) + n) % n);

  // Auto-avance accionado por temporizador (independiente del CSS).
  useEffect(() => {
    if (!playing || prefersReduced) return;
    const t = setTimeout(() => setCurrent((c) => (c + 1) % n), durationMs);
    return () => clearTimeout(t);
  }, [playing, current, durationMs, n, prefersReduced]);

  // Mantener visible el ítem activo del menú lateral.
  useEffect(() => {
    navRefs.current[current]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [current]);

  const escenasRender = (
    <>
      {escenas.map((s, i) => (
        <div key={i} className={`scene ${i === current ? 'active' : ''}`} aria-hidden={i !== current}>
          <div className="scr-tag">
            <span>{s.tag}</span>
            <span className="pill">{s.pill}</span>
          </div>
          {s.content}
        </div>
      ))}
    </>
  );

  return (
    <div className="stagewrap" style={{ ['--cap-dur' as string]: `${durationMs}ms` }}>
      <div className="device">
        <div className="bar">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
          <span className="url">{url}</span>
        </div>

        {nav === 'sidebar' ? (
          <div className="console">
            <nav className="side">
              <div className="shead">{sideHeading}</div>
              {escenas.map((s, i) => (
                <button
                  key={i}
                  ref={(el) => { navRefs.current[i] = el; }}
                  className={`nitem ${i === current ? 'on' : ''}`}
                  onClick={() => goto(i)}
                >
                  {s.icon}
                  {s.name}
                </button>
              ))}
            </nav>
            <div className="stage">{escenasRender}</div>
          </div>
        ) : (
          <div className="stage">{escenasRender}</div>
        )}
      </div>

      <div className="caption">
        <p>{escenas[current].caption}</p>
      </div>

      <div className="controls">
        <button className="ctrlbtn" onClick={() => goto(current - 1)} aria-label="Anterior">
          <IconPrev />
        </button>
        <button
          className="ctrlbtn play"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? 'Pausar' : 'Reproducir'}
        >
          {playing ? <IconPause /> : <IconPlay />}
        </button>
        <button className="ctrlbtn" onClick={() => goto(current + 1)} aria-label="Siguiente">
          <IconNext />
        </button>
        <div className="pbar">
          <div
            key={`${current}-${playing}`}
            className="fill run"
            style={{ animationPlayState: playing ? 'running' : 'paused' }}
          />
        </div>
        <div className="counter">
          {counterLabel} <b>{pad(current)}</b> / <span>{padTotal(n)}</span>
        </div>
      </div>

      {nav === 'chips' && (
        <div className="nav">
          {escenas.map((s, i) => (
            <button key={i} className={`chip ${i === current ? 'on' : ''}`} onClick={() => goto(i)}>
              <span className="ix">{pad(i)}</span>
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
