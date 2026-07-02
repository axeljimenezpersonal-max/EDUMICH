import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

/**
 * Muestra "etiqueta + valor" con un micro-botón de copiar (estilo macOS): al
 * hacer clic copia el valor al portapapeles y muestra un check por un momento.
 * Pensado para agilizar la recaptura de datos en otras plataformas.
 */
export function CampoCopiable({ label, value }: { label: string; value: string }) {
  const [copiado, setCopiado] = useState(false);
  const tiene = !!value && value.trim() !== '';

  function copiar() {
    if (!tiene) return;
    navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopiado(true);
        setTimeout(() => setCopiado(false), 1200);
      })
      .catch(() => {});
  }

  return (
    <div className="flex items-start justify-between gap-2 py-2 border-b border-stone-100 last:border-0">
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-stone-400 font-semibold">{label}</div>
        <div className={`text-sm break-words ${tiene ? 'text-stone-800' : 'text-stone-300 italic'}`}>
          {tiene ? value : 'Sin dato'}
        </div>
      </div>
      {tiene && (
        <button
          onClick={copiar}
          title="Copiar"
          className="shrink-0 p-1.5 rounded-md hover:bg-stone-100 text-stone-400 hover:text-[var(--color-guinda-700)] transition-colors"
        >
          {copiado ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
        </button>
      )}
    </div>
  );
}
