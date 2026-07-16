/**
 * Primitivas responsive de EDUMICH — el patrón oficial para que NINGUNA tabla
 * quede ilegible en teléfono.
 *
 * Dos niveles, del piso al ideal:
 *
 * 1) `TablaScroll` (piso mínimo): envuelve cualquier <table> para que en
 *    pantallas angostas se deslice horizontalmente en su propio carril, en vez
 *    de aplastar columnas o desbordar la página. Toda tabla del proyecto debe
 *    vivir dentro de una (o de un contenedor con overflow-x-auto propio).
 *
 * 2) `SoloEscritorio` + `SoloMovil` con `FilaCard` (el ideal): la MISMA
 *    información dos veces — tabla en ≥md, lista de tarjetas en teléfono. Es el
 *    patrón que usan las páginas importantes (listas de alumnos, pagos,
 *    calificaciones). `FilaCard` estandariza la tarjeta: título, subtítulo,
 *    pares etiqueta/valor y un extremo derecho (chip de estado, chevron…).
 */
import type { ReactNode } from 'react';

export function TablaScroll({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto overscroll-x-contain ${className}`} style={{ WebkitOverflowScrolling: 'touch' }}>
      {children}
    </div>
  );
}

/** Visible solo con barra lateral (tablet/escritorio, ≥768px). */
export function SoloEscritorio({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`hidden md:block ${className}`}>{children}</div>;
}

/** Visible solo en teléfono / tablet chica (<768px). */
export function SoloMovil({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`md:hidden ${className}`}>{children}</div>;
}

/** Un par etiqueta/valor dentro de una FilaCard. */
export function DatoCard({ label, children, mono = false }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">{label}</div>
      <div className={`mt-0.5 text-[13px] text-stone-700 ${mono ? 'font-mono text-xs tracking-wide' : ''}`}>
        {children}
      </div>
    </div>
  );
}

/**
 * Tarjeta estándar que sustituye a una fila de tabla en teléfono.
 * - `titulo` / `sub`: lo que identifica el registro (nombre, folio…).
 * - `derecha`: chip de estado o acción, alineado al extremo.
 * - `datos`: pares DatoCard en rejilla de 2 columnas.
 * - `onClick`: si navega, toda la tarjeta es táctil (target grande).
 */
export function FilaCard({
  titulo,
  sub,
  derecha,
  datos,
  onClick,
  pie,
}: {
  titulo: ReactNode;
  sub?: ReactNode;
  derecha?: ReactNode;
  datos?: ReactNode;
  onClick?: () => void;
  pie?: ReactNode;
}) {
  const cuerpo = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-bold leading-snug text-stone-900">{titulo}</div>
          {sub && <div className="mt-0.5 text-xs text-stone-500">{sub}</div>}
        </div>
        {derecha && <div className="shrink-0">{derecha}</div>}
      </div>
      {datos && <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5">{datos}</div>}
      {pie && <div className="mt-3 border-t border-stone-100 pt-2.5">{pie}</div>}
    </>
  );
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className="block w-full rounded-xl border border-stone-200 bg-white p-3.5 text-left transition-colors active:bg-stone-50"
    >
      {cuerpo}
    </button>
  ) : (
    <div className="rounded-xl border border-stone-200 bg-white p-3.5">{cuerpo}</div>
  );
}

/** Contenedor de la lista de FilaCards (separación uniforme). */
export function ListaCards({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`space-y-2.5 ${className}`}>{children}</div>;
}
