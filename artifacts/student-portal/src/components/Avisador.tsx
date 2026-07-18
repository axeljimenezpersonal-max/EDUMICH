/**
 * Avisador — mensajes breves (el reemplazo de `alert()` del navegador).
 *
 * `alert()` congela la página, se ve como ventana del sistema y en el teléfono
 * aparece pegada arriba, lejos del pulgar. Esto lo sustituye por un aviso que
 * entra por abajo, se va solo y no bloquea nada.
 *
 * Uso desde cualquier parte, sin contexto ni props:
 *
 *     import { avisar } from '../components/Avisador';
 *     avisar('No se pudo guardar', 'error');
 *
 * `<Avisador />` se monta UNA vez en App.tsx. No se usa para confirmar acciones
 * —para eso está <ConfirmModal>—; esto solo informa.
 */
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export type TipoAviso = 'error' | 'ok' | 'info';

interface Aviso {
  id: number;
  mensaje: string;
  tipo: TipoAviso;
}

let siguienteId = 1;
let avisos: Aviso[] = [];
const suscriptores = new Set<(a: Aviso[]) => void>();

function emitir() {
  for (const s of suscriptores) s([...avisos]);
}

function quitar(id: number) {
  avisos = avisos.filter((a) => a.id !== id);
  emitir();
}

/**
 * Muestra un aviso breve. Los errores duran más porque suelen traer texto que
 * el usuario necesita leer completo (p. ej. el motivo de un rechazo).
 */
export function avisar(mensaje: string, tipo: TipoAviso = 'info'): void {
  const id = siguienteId++;
  avisos = [...avisos, { id, mensaje, tipo }];
  emitir();
  setTimeout(() => quitar(id), tipo === 'error' ? 6500 : 4000);
}

const ESTILO: Record<TipoAviso, { color: string; fondo: string; borde: string; Icono: typeof Info }> = {
  error: { color: '#b91c1c', fondo: '#fef2f2', borde: '#fecaca', Icono: AlertCircle },
  ok:    { color: '#2d7d46', fondo: '#f0fdf4', borde: '#bbf7d0', Icono: CheckCircle2 },
  info:  { color: 'var(--color-guinda-700)', fondo: '#fdf6f0', borde: '#eadfd7', Icono: Info },
};

export function Avisador() {
  const [lista, setLista] = useState<Aviso[]>([]);

  useEffect(() => {
    suscriptores.add(setLista);
    return () => { suscriptores.delete(setLista); };
  }, []);

  return (
    <div
      // `avisador-pos` (index.css) resuelve el espacio inferior: en teléfono
      // libra la barra de navegación y la safe-area; en ≥sm se ancla abajo a la
      // derecha con un margen normal.
      className="avisador-pos pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex flex-col items-center gap-2 px-3 sm:inset-x-auto sm:right-5 sm:items-end sm:px-0"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {lista.map((a) => {
          const { color, fondo, borde, Icono } = ESTILO[a.tipo];
          return (
            <motion.div
              key={a.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              className="pointer-events-auto flex w-full max-w-[26rem] items-start gap-2.5 rounded-xl border px-3.5 py-3 shadow-lg"
              style={{ background: fondo, borderColor: borde, color }}
            >
              <Icono size={17} className="mt-0.5 shrink-0" />
              <span className="min-w-0 flex-1 text-[13.5px] font-medium leading-snug text-stone-800">
                {a.mensaje}
              </span>
              <button
                onClick={() => quitar(a.id)}
                aria-label="Cerrar aviso"
                className="-my-1 -mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-stone-400 hover:bg-black/5 hover:text-stone-600"
              >
                <X size={15} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
