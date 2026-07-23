/**
 * SectionTour — recorrido PROFUNDO de una página, bloque por bloque.
 *
 * Reutiliza el mismo motor pulido que el recorrido de bienvenida (spotlight
 * dorado + tarjeta con framer-motion + accesibilidad), pero se define por
 * página: recibe sus propios pasos y su clave, y ofrece un botón flotante para
 * repetirlo.
 *
 * ── Reglas de los tutoriales (ver también lib/tutoriales.ts) ─────────────────
 *
 * R1. Saltar NO es haber visto. Solo llegar al final marca el tutorial como
 *     completado; «Saltar» y el clic en el fondo significan «ahora no» y el
 *     tutorial se vuelve a ofrecer. Para no volver a verlo está el botón
 *     explícito «No volver a mostrar». Antes CUALQUIER salida lo marcaba visto
 *     para siempre: un roce del dedo en el fondo mataba la ayuda de por vida.
 *
 * R2. Un paso cuyo bloque NO está en pantalla se omite. Antes se mostraba igual,
 *     centrado y sin foco, explicando algo invisible — el alumno leía sobre
 *     inscribirse mientras la página le decía «primero completa tu expediente».
 *     Al omitirlos, el contador «Paso 3 de 7» tampoco miente.
 *
 * R3. El «visto» se guarda por ETAPA (`etapa`), no por página. Cuando el alumno
 *     avanza y hay contenido nuevo que enseñar, el tutorial se ofrece una vez
 *     más. Si en esa etapa no hay nada nuevo, no aparece.
 *
 * R4. `autoStart` es la ETAPA MÍNIMA: la página lo pone en false cuando su
 *     contenido aún no existe (p. ej. Inscripción sin expediente). El tutorial
 *     no auto-arranca —la página ya muestra su candado— pero el botón sigue ahí.
 *
 * R5. Un tutorial a la vez: `gateKey` espera a que termine la bienvenida del rol
 *     para no encimarse con ella.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { HelpCircle } from 'lucide-react';
import { SpotlightOverlay, resolver, type SpotRect } from './SpotlightOverlay';
import { TourCard } from './TourCard';
import type { TourStep } from './steps';
import { cargarTutoriales, estaVisto, marcarVisto, silenciar } from '../../lib/tutoriales';

interface Props {
  steps: TourStep[];
  /** Identidad del tutorial (p. ej. "sec_inscripcion"). Persistida en BD. */
  storageKey: string;
  /**
   * Punto del trámite que este tutorial está enseñando ahora mismo (R3).
   * Al cambiar, el tutorial vuelve a ofrecerse UNA vez porque hay contenido
   * nuevo. Omitir si el tutorial enseña lo mismo siempre.
   */
  etapa?: string;
  /** Clave del recorrido de bienvenida del rol: espera a que termine (R5). */
  gateKey?: string;
  buttonLabel?: string;
  /** false = la etapa mínima aún no se cumple: no auto-arranca (R4). */
  autoStart?: boolean;
}

export function SectionTour({
  steps,
  storageKey,
  etapa = '',
  gateKey,
  buttonLabel = 'Tutorial de esta sección',
  autoStart = true,
}: Props) {
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<SpotRect | null>(null);
  /** Pasos realmente mostrables: se fijan al arrancar (R2). */
  const [visibles, setVisibles] = useState<TourStep[]>([]);

  const total = visibles.length;

  /**
   * R2 — un paso se muestra si no apunta a nada (intro/cierre) o si su bloque
   * existe en el DOM. Se evalúa al arrancar, no al definir los pasos: el mismo
   * tutorial enseña más o menos según lo que la página esté pintando.
   */
  const calcularVisibles = useCallback(
    () => steps.filter((s) => !s.anchor || resolver(s.anchor) !== null),
    [steps],
  );

  const start = useCallback(() => {
    const v = calcularVisibles();
    if (v.length === 0) return;
    setVisibles(v);
    setIndex(0);
    setActive(true);
  }, [calcularVisibles]);

  // Auto-arranque: una vez por (clave, etapa), y solo si la etapa mínima se
  // cumple. Espera al registro de la BD para no repetir lo ya visto.
  useEffect(() => {
    if (!autoStart || steps.length === 0) return;
    let vivo = true;
    let t: ReturnType<typeof setTimeout> | undefined;

    cargarTutoriales().then(() => {
      if (!vivo) return;
      if (estaVisto(storageKey, etapa)) return;
      if (gateKey && !estaVisto(gateKey)) return; // R5: la bienvenida va primero
      // Margen para que la página termine de pintar: R2 mide el DOM real.
      t = setTimeout(() => { if (vivo) start(); }, 700);
    });

    return () => { vivo = false; if (t) clearTimeout(t); };
  }, [autoStart, steps.length, storageKey, etapa, gateKey, start]);

  /** R1: solo `completado` registra. Salir sin terminar = «ahora no». */
  const cerrar = useCallback((completado: boolean) => {
    setActive(false);
    if (completado) marcarVisto(storageKey, etapa);
  }, [storageKey, etapa]);

  const next = useCallback(() => {
    // En el último paso, completar: marca visto (fuera del updater de setIndex,
    // que es un efecto secundario y no debe vivir ahí — antes podía no persistir).
    if (index >= total - 1) { cerrar(true); return; }
    setIndex((i) => i + 1);
  }, [index, total, cerrar]);
  const prev = useCallback(() => setIndex((i) => (i > 0 ? i - 1 : 0)), []);
  /** Saltar / clic fuera: NO marca visto (R1). */
  const skip = useCallback(() => cerrar(false), [cerrar]);
  /** «No volver a mostrar»: silencia el auto-arranque en todas las etapas. */
  const noMostrar = useCallback(() => {
    setActive(false);
    silenciar(storageKey);
  }, [storageKey]);

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

  const step = active ? visibles[Math.min(index, total - 1)] : undefined;

  // El botón sobra si la página no tiene ni un bloque que enseñar.
  const hayAlgoQueEnsenar = useMemo(() => steps.length > 0, [steps.length]);

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
            onNoMostrar={noMostrar}
          />
        </AnimatePresence>
      )}

      {hayAlgoQueEnsenar && (
        <button
          type="button"
          data-tour="btn-seccion-tutorial"
          onClick={start}
          // La altura la fija `.tour-boton-flotante` (index.css): este botón y la
          // burbuja del chat compartían esquina, así que se apilan.
          className="tour-boton-flotante fixed right-4 z-40 inline-flex items-center gap-1.5 rounded-full border border-[var(--color-crema-200)] bg-white px-3.5 py-2 text-xs font-semibold shadow-md hover:bg-stone-50"
          style={{ color: 'var(--color-guinda-700)' }}
          title="Ver el tutorial de esta sección"
        >
          <HelpCircle size={15} /> {buttonLabel}
        </button>
      )}
    </>
  );
}
