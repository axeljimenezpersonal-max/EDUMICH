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
 *
 * Y para las ventanas: `ModalHoja` — hoja inferior en teléfono, tarjeta
 * centrada en ≥sm. Todo modal del proyecto debe montarse dentro de una.
 */
import { useEffect, type ReactNode } from 'react';
import { motion } from 'framer-motion';

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

/**
 * Envoltura estándar de TODA ventana modal del proyecto.
 *
 * En teléfono se comporta como hoja inferior (pegada abajo, ancho completo,
 * esquinas superiores redondeadas y asa) — el mismo gesto que la hoja «Más» de
 * la barra inferior, y el lugar donde el pulgar ya está. En ≥sm vuelve a ser la
 * tarjeta centrada de siempre.
 *
 * Resuelve de una vez tres fallas que cada modal repetía por su cuenta:
 *  - los botones del pie caían bajo el indicador de inicio del iPhone
 *    (`--sa-inferior`, ver index.css);
 *  - el fondo seguía desplazándose detrás de la ventana;
 *  - `100vh` miente en Safari móvil cuando aparece la barra del navegador, por
 *    eso la altura máxima usa `dvh`.
 *
 * El pie se pasa aparte (`pie`) para que quede fijo mientras el cuerpo se
 * desplaza: en teléfono con el teclado abierto, el botón de confirmar debe
 * seguir visible.
 */
export function ModalHoja({
  children,
  pie,
  onClose,
  etiqueta,
  ancho = 'sm:max-w-md',
}: {
  children: ReactNode;
  /** Barra de acciones fija al fondo (botones). Opcional. */
  pie?: ReactNode;
  onClose: () => void;
  /** Título accesible de la ventana. */
  etiqueta: string;
  /** Ancho máximo en ≥sm (clase Tailwind). En teléfono siempre es completo. */
  ancho?: string;
}) {
  // Con la ventana abierta el fondo no se desplaza.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Escape cierra, como cualquier ventana del sistema.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4"
      style={{ background: 'rgba(20,10,15,0.45)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={etiqueta}
        onClick={(e) => e.stopPropagation()}
        className={`relative flex w-full flex-col overflow-hidden bg-white shadow-2xl rounded-t-2xl sm:rounded-2xl max-h-[92dvh] ${ancho}`}
        style={{ fontFamily: "'Poppins', sans-serif" }}
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 38 }}
      >
        {/* Asa: solo en teléfono, donde esto es una hoja. Va superpuesta y no en
            su propia franja, para no abrir una costura blanca sobre las ventanas
            que traen su propio encabezado de color. El gris cálido a media
            opacidad se lee tanto sobre blanco como sobre guinda. */}
        <div
          className="absolute left-1/2 top-2 z-20 h-1 w-10 -translate-x-1/2 rounded-full bg-stone-400/70 sm:hidden"
          aria-hidden
        />

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>

        {pie && <div className="shrink-0 hoja-pie-seguro">{pie}</div>}
      </motion.div>
    </div>
  );
}
