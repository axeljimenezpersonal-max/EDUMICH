/**
 * AvisoBloqueo — modal profesional que se muestra cuando otro colaborador ya
 * está editando el mismo recurso (la respuesta de useBloqueoEdicion en estado
 * 'ajeno'). Informa quién lo tiene y desde cuándo, y ofrece ver en solo lectura
 * o reintentar (por si la otra persona acaba de salir).
 */
import { Lock, RefreshCw, Eye, Loader2 } from 'lucide-react';
import { horaCorta } from '../lib/fechas';
import type { TitularBloqueo } from '../lib/useBloqueoEdicion';

const ROL_ETIQUETA: Record<string, string> = {
  admin: 'Administración',
  gestor: 'Centro de asesoría',
  direccion: 'Dirección de programa',
  estudiante: 'Estudiante',
};

export default function AvisoBloqueo({
  titular,
  onSoloLectura,
  onReintentar,
  reintentando = false,
}: {
  titular: TitularBloqueo | null;
  onSoloLectura: () => void;
  onReintentar: () => void;
  reintentando?: boolean;
}) {
  const rolTxt = titular ? ROL_ETIQUETA[titular.rol] ?? titular.rol : '';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-5">
          <div className="w-11 h-11 rounded-full bg-amber-50 flex items-center justify-center mb-3">
            <Lock size={20} className="text-amber-600" />
          </div>
          <h3 className="text-base font-bold text-stone-900">Otro colaborador está editando esto</h3>
          {titular ? (
            <p className="text-sm text-stone-500 mt-1 leading-relaxed">
              <strong className="text-stone-800">{titular.nombre}</strong>
              {rolTxt && <span className="text-stone-500"> · {rolTxt}</span>} tiene esta pantalla abierta
              en edición{titular.desde ? <> desde las <strong className="text-stone-800">{horaCorta(titular.desde)}</strong></> : null}.
              Para no pisar sus cambios, aquí solo puedes consultar por ahora.
            </p>
          ) : (
            <p className="text-sm text-stone-500 mt-1 leading-relaxed">
              Esta pantalla está siendo editada por otra persona. Para no pisar sus cambios, aquí solo
              puedes consultar por ahora.
            </p>
          )}
          <p className="text-xs text-stone-400 mt-2 leading-relaxed">
            En cuanto salga de la edición, el candado se libera solo y podrás editar.
          </p>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={onSoloLectura}
            className="flex-1 py-2.5 rounded-lg border border-stone-300 text-stone-700 text-sm font-semibold hover:bg-stone-50 transition-colors flex items-center justify-center gap-2"
          >
            <Eye size={15} /> Ver en solo lectura
          </button>
          <button
            onClick={onReintentar}
            disabled={reintentando}
            className="flex-1 py-2.5 rounded-lg bg-[var(--color-guinda-700)] text-white text-sm font-semibold hover:bg-[var(--color-guinda-800)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {reintentando ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            Reintentar
          </button>
        </div>
      </div>
    </div>
  );
}
