/**
 * Ilustraciones animadas opcionales para las tarjetas del tour.
 *
 * Se mantienen SOBRIAS (es una plataforma de gobierno): paleta guinda/dorado/
 * crema, movimiento suave y en bucle, sin destellos. Un paso del tour puede
 * pedir una ilustración por clave con `illustration: 'pagoFlow'`; si la clave no
 * existe, no se dibuja nada. Respetan `prefers-reduced-motion`.
 */

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Landmark, Banknote, Upload, BadgeCheck } from 'lucide-react';
import type { LucideProps } from 'lucide-react';

type Paso = { Icon: React.ComponentType<LucideProps>; label: string };

const PASOS_PAGO: Paso[] = [
  { Icon: FileText, label: 'Solicitas' },
  { Icon: Landmark, label: 'Orden' },
  { Icon: Banknote, label: 'Pagas' },
  { Icon: Upload, label: 'Comprobante' },
  { Icon: BadgeCheck, label: 'Confirmado' },
];

function usePrefiereMenosMovimiento(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduce(mq.matches);
    const on = () => setReduce(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduce;
}

/**
 * Flujo de pago animado: los nodos se van "encendiendo" en secuencia y la línea
 * que los une se rellena a su paso; al completarse hace una pausa y reinicia.
 */
function PagoFlowAnimation() {
  const reduce = usePrefiereMenosMovimiento();
  const N = PASOS_PAGO.length;
  // `activo` va de 0 a N (en N todos están encendidos → beat de "completado").
  const [activo, setActivo] = useState(reduce ? N : 0);

  useEffect(() => {
    if (reduce) { setActivo(N); return; }
    const t = setInterval(() => setActivo((v) => (v >= N ? 0 : v + 1)), 950);
    return () => clearInterval(t);
  }, [reduce, N]);

  return (
    <div
      className="mt-4 rounded-xl border px-3 py-4"
      style={{ background: 'var(--color-crema-100)', borderColor: 'var(--color-crema-200)' }}
      aria-hidden
    >
      <div className="flex items-start">
        {PASOS_PAGO.map((p, i) => {
          const encendido = i <= activo;
          const P = p.Icon;
          return (
            <div key={p.label} className="relative flex flex-1 flex-col items-center">
              {/* Conector hacia el nodo anterior */}
              {i > 0 && (
                <span
                  className="absolute top-[17px] right-1/2 h-[3px] w-full -translate-y-1/2 overflow-hidden rounded-full"
                  style={{ background: 'var(--color-crema-200)' }}
                >
                  <motion.span
                    className="block h-full rounded-full"
                    style={{ background: 'var(--color-dorado)' }}
                    initial={false}
                    animate={{ width: i <= activo ? '100%' : '0%' }}
                    transition={{ duration: 0.45, ease: 'easeInOut' }}
                  />
                </span>
              )}
              {/* Nodo */}
              <motion.div
                className="relative z-10 flex h-[34px] w-[34px] items-center justify-center rounded-full border-2"
                initial={false}
                animate={{
                  background: encendido ? 'var(--color-guinda-700)' : '#ffffff',
                  borderColor: encendido ? 'var(--color-guinda-700)' : 'var(--color-crema-200)',
                  scale: i === activo && !reduce ? 1.12 : 1,
                }}
                transition={{ type: 'spring', stiffness: 340, damping: 22 }}
              >
                <P size={16} color={encendido ? '#ffffff' : '#a8a29e'} strokeWidth={2.4} />
              </motion.div>
              <span
                className="mt-1.5 text-center text-[9px] font-semibold leading-tight transition-colors"
                style={{ color: encendido ? 'var(--color-guinda-700)' : '#a8a29e' }}
              >
                {p.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Registro de ilustraciones disponibles por clave. */
export const ILLUSTRATIONS: Record<string, React.ComponentType> = {
  pagoFlow: PagoFlowAnimation,
};
