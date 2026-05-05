import { CreditCard, Check, Clock, X } from 'lucide-react';
import type { Pago } from '../lib/api';

const CONCEPTO_LABELS: Record<string, string> = {
  derecho_examen: 'Derecho de examen',
  examen_extraordinario: 'Examen extraordinario',
  reposicion_credencial: 'Reposición de credencial',
  duplicado_acta: 'Duplicado de acta',
  otro: 'Otro concepto',
};

const METODO_LABELS: Record<string, string> = {
  spei: 'Transferencia (SPEI)',
  banco_deposito: 'Banco – depósito',
  tienda_conveniencia: 'Tienda de conveniencia',
  efectivo: 'Efectivo',
  otro: 'Otro',
};

interface Props {
  pago: Pago;
  onVerComprobante?: (pago: Pago) => void;
}

function EstadoPill({ estado }: { estado: Pago['estado'] }) {
  if (estado === 'verificado')
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700">
        <Check size={10} strokeWidth={3} /> Verificado
      </span>
    );
  if (estado === 'rechazado')
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-red-100 text-red-700">
        <X size={10} strokeWidth={3} /> Rechazado
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-800">
      <Clock size={10} strokeWidth={3} /> Pendiente
    </span>
  );
}

export default function PagoCard({ pago, onVerComprobante }: Props) {
  const borderColor =
    pago.estado === 'verificado'
      ? 'border-l-emerald-500'
      : pago.estado === 'rechazado'
      ? 'border-l-red-500'
      : 'border-l-amber-400';

  const iconBg =
    pago.estado === 'verificado'
      ? 'bg-emerald-100 text-emerald-600'
      : pago.estado === 'rechazado'
      ? 'bg-red-100 text-red-600'
      : 'bg-amber-50 text-amber-600';

  const concepto = CONCEPTO_LABELS[pago.concepto] ?? pago.concepto;
  const titulo = pago.conceptoDetalle
    ? `${concepto} — ${pago.conceptoDetalle}`
    : concepto;

  const fechaStr = pago.fechaPago
    ? new Date(pago.fechaPago + 'T12:00:00').toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';

  return (
    <div
      className={`bg-white border border-stone-200 border-l-4 ${borderColor} rounded-lg px-5 py-4 flex items-center gap-4`}
    >
      {/* Icon */}
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        <CreditCard size={20} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div
          className="font-semibold text-stone-900 text-sm truncate"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          {titulo}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-stone-500">
          <span>Pagado: <strong className="text-stone-700">{fechaStr}</strong></span>
          {pago.referenciaBancaria && (
            <span>Ref: <strong className="text-stone-700 font-mono">{pago.referenciaBancaria}</strong></span>
          )}
          {pago.metodoPago && (
            <span>{METODO_LABELS[pago.metodoPago] ?? pago.metodoPago}</span>
          )}
          {pago.subidoPorEmail && (
            <span>Por: <strong className="text-stone-700">{pago.subidoPorEmail}</strong></span>
          )}
        </div>
        {pago.estado === 'rechazado' && pago.motivoRechazo && (
          <div className="mt-1.5 text-xs text-red-600 bg-red-50 rounded px-2 py-1">
            Motivo: {pago.motivoRechazo}
          </div>
        )}
      </div>

      {/* Monto */}
      <div className="text-right shrink-0">
        <div
          className="text-2xl font-bold text-stone-900 leading-none"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          ${parseFloat(pago.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          <span className="text-xs text-stone-400 font-normal ml-1">{pago.moneda}</span>
        </div>
        <div className="mt-1.5">
          <EstadoPill estado={pago.estado} />
        </div>
        {onVerComprobante && (
          <button
            onClick={() => onVerComprobante(pago)}
            className="mt-1.5 text-[10px] text-[var(--color-guinda-700)] hover:underline font-semibold"
          >
            Ver comprobante
          </button>
        )}
      </div>
    </div>
  );
}
