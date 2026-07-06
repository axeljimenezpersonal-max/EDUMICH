/**
 * PageTour — arranca un tour de página una sola vez (por `storageKey`) y deja
 * un botón flotante "Tutorial" para repetirlo. Reutiliza <Tour/>.
 *
 * Uso en cualquier página del portal:
 *   <PageTour storageKey="edumich_tour_expediente_v1" steps={EXPEDIENTE_TOUR} />
 */

import { useEffect, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { Tour, type TourStep } from './Tour';

export function PageTour({
  steps,
  storageKey,
  autoStart = true,
}: {
  steps: TourStep[];
  storageKey: string;
  autoStart?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    // Auto-inicio solo en escritorio y una sola vez.
    if (!autoStart || localStorage.getItem(storageKey) || window.innerWidth < 768) return;
    const t = setTimeout(() => setAbierto(true), 550);
    return () => clearTimeout(t);
  }, [autoStart, storageKey]);

  function cerrar() {
    setAbierto(false);
    localStorage.setItem(storageKey, '1');
  }

  return (
    <>
      {abierto && <Tour steps={steps} onClose={cerrar} />}
      <button
        onClick={() => setAbierto(true)}
        className="fixed right-4 bottom-20 md:bottom-5 z-40 inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold shadow-md hover:bg-stone-50"
        style={{ color: 'var(--color-guinda-700)' }}
        title="Ver tutorial de esta sección"
      >
        <HelpCircle size={15} /> Tutorial
      </button>
    </>
  );
}
