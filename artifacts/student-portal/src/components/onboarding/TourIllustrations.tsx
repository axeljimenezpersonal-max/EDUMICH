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
import {
  FileText, Landmark, Banknote, Upload, BadgeCheck,
  LockOpen, ClipboardCheck, GraduationCap, Lock, CheckCheck,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';

type Paso = { Icon: React.ComponentType<LucideProps>; label: string };

const PASOS_PAGO: Paso[] = [
  { Icon: FileText, label: 'Solicitas' },
  { Icon: Landmark, label: 'Orden' },
  { Icon: Banknote, label: 'Pagas' },
  { Icon: Upload, label: 'Comprobante' },
  { Icon: BadgeCheck, label: 'Confirmado' },
];

const PASOS_PRUEBA: Paso[] = [
  { Icon: Banknote, label: 'Pagas examen' },
  { Icon: LockOpen, label: 'Prueba incluida' },
  { Icon: ClipboardCheck, label: 'Practicas' },
  { Icon: GraduationCap, label: 'Llegas listo' },
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
 * Flujo animado genérico: los nodos se van "encendiendo" en secuencia y la línea
 * que los une se rellena a su paso; al completarse hace una pausa y reinicia.
 */
function FlowAnimation({ pasos }: { pasos: Paso[] }) {
  const reduce = usePrefiereMenosMovimiento();
  const N = pasos.length;
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
        {pasos.map((p, i) => {
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

/**
 * Aviso legal animado: el candado hace un "zoom" suave en bucle y las dos
 * etiquetas —Registrada y Almacenada— quedan encendidas con un pulso alterno.
 */
function ChatLegalAnimation() {
  const reduce = usePrefiereMenosMovimiento();
  return (
    <div
      className="mt-4 flex flex-col items-center gap-3 rounded-xl border px-4 py-4"
      style={{ background: 'var(--color-crema-100)', borderColor: 'var(--color-crema-200)' }}
      aria-hidden
    >
      <motion.div
        className="flex h-12 w-12 items-center justify-center rounded-full text-white"
        style={{ background: 'var(--color-guinda-700)' }}
        animate={reduce ? {} : {
          scale: [1, 1.1, 1],
          boxShadow: [
            '0 0 0 0 rgba(107,21,48,0)',
            '0 0 0 9px rgba(107,21,48,0.10)',
            '0 0 0 0 rgba(107,21,48,0)',
          ],
        }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Lock size={22} />
      </motion.div>
      <div className="flex gap-2">
        {['Registrada', 'Almacenada'].map((t, i) => (
          <motion.span
            key={t}
            className="rounded-full px-3 py-1 text-[11px] font-bold text-white"
            style={{ background: 'var(--color-guinda-700)' }}
            animate={reduce ? {} : { opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2.2, repeat: Infinity, delay: i * 1.1, ease: 'easeInOut' }}
          >
            {t}
          </motion.span>
        ))}
      </div>
      <p className="text-center text-[11px]" style={{ color: '#78716c' }}>
        Por motivos legales y de privacidad de datos
      </p>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex justify-start">
      <div
        className="flex items-center gap-1 rounded-2xl rounded-bl-sm border px-3 py-2.5"
        style={{ background: '#fff', borderColor: 'var(--color-crema-200)' }}
      >
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="block h-1.5 w-1.5 rounded-full"
            style={{ background: '#a8a29e' }}
            animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Ejemplo de conversación animado: aparece tu mensaje, se marca "Leído", la
 * Secretaría "escribe" y luego responde; hace una pausa y reinicia en bucle.
 */
function ChatDemoAnimation() {
  const reduce = usePrefiereMenosMovimiento();
  // 0 vacío · 1 tu mensaje · 2 leído · 3 escribiendo · 4 respuesta · 5 pausa
  const [fase, setFase] = useState(reduce ? 4 : 0);

  useEffect(() => {
    if (reduce) { setFase(4); return; }
    const t = setInterval(() => setFase((f) => (f >= 5 ? 0 : f + 1)), 1150);
    return () => clearInterval(t);
  }, [reduce]);

  return (
    <div
      className="mt-4 space-y-2 rounded-xl border p-3"
      style={{ background: 'var(--color-crema-100)', borderColor: 'var(--color-crema-200)', minHeight: 132 }}
      aria-hidden
    >
      {fase >= 1 && (
        <motion.div className="flex justify-end" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <div
            className="max-w-[82%] rounded-2xl rounded-br-sm px-3 py-2 text-[12px] leading-snug text-white"
            style={{ background: 'var(--color-guinda-700)' }}
          >
            Hola, ¿cuándo aparece mi calificación?
          </div>
        </motion.div>
      )}
      {fase >= 2 && (
        <div className="flex items-center justify-end gap-1 pr-1 text-[9px] font-semibold" style={{ color: '#78716c' }}>
          <CheckCheck size={11} style={{ color: 'var(--color-guinda-700)' }} /> Leído
        </div>
      )}
      {fase === 3 && <TypingDots />}
      {fase >= 4 && (
        <motion.div className="flex justify-start" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <div
            className="max-w-[82%] rounded-2xl rounded-bl-sm border px-3 py-2 text-[12px] leading-snug"
            style={{ background: '#fff', borderColor: 'var(--color-crema-200)', color: '#44403c' }}
          >
            En 3 a 5 días hábiles aparece en tu sección de Calificaciones. 😊
          </div>
        </motion.div>
      )}
    </div>
  );
}

/** Registro de ilustraciones disponibles por clave. */
export const ILLUSTRATIONS: Record<string, React.ComponentType> = {
  pagoFlow: () => <FlowAnimation pasos={PASOS_PAGO} />,
  pruebaFlow: () => <FlowAnimation pasos={PASOS_PRUEBA} />,
  chatLegal: ChatLegalAnimation,
  chatDemo: ChatDemoAnimation,
};
