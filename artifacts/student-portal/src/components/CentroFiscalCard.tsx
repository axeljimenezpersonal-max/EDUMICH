import { Building2, AlertCircle } from 'lucide-react';
import { CampoCopiable } from './CampoCopiable';
import type { CentroFiscal } from '../lib/api';

/**
 * Datos fiscales del centro de asesoría (persona moral, casi siempre) que la
 * ficha de pago menciona: razón social + RFC + clave. Cada dato se copia al
 * tocarlo, para recapturarlos rápido al emitir la orden o al pagar en la
 * ventanilla / portal del Estado.
 */
export function CentroFiscalCard({ centro }: { centro: CentroFiscal | null | undefined }) {
  if (!centro) return null;
  const sinDatos = !centro.razonSocial && !centro.rfc && !centro.clave;

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <Building2 size={16} className="text-[var(--color-guinda-700)]" />
        <h3 className="text-sm font-bold text-stone-900">Datos fiscales del centro (para el pago)</h3>
      </div>
      <p className="text-[11px] text-stone-500 mb-2">
        Persona moral o física a nombre de quien se emite la ficha. Toca un dato para copiarlo.
      </p>
      {sinDatos ? (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-start gap-2">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          Este centro aún no tiene razón social ni RFC registrados. Complétalos en la ficha del gestor.
        </div>
      ) : (
        <div>
          <CampoCopiable label="Razón social / nombre" value={centro.razonSocial ?? ''} />
          <CampoCopiable label="RFC" value={centro.rfc ?? ''} />
          <CampoCopiable label="Clave de centro" value={centro.clave ?? ''} />
          <CampoCopiable label="Responsable del centro" value={centro.nombre ?? ''} />
        </div>
      )}
    </div>
  );
}
