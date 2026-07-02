import { useEffect, useState } from 'react';
import { Check, X, AlertCircle, RefreshCw } from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { api, type Pago } from '../../lib/api';

export default function PagosPendientes() {
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);
  const [modalRechazo, setModalRechazo] = useState<{ pagoId: number } | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await api.get<{ pagos: Pago[] }>('/admin/pagos/pendientes');
      setPagos(r.pagos);
    } catch {} finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function verificar(pagoId: number) {
    setActionId(pagoId);
    setError(null);
    try {
      await api.post(`/admin/pagos/${pagoId}/verificar`, { aprobado: true });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setActionId(null);
    }
  }

  async function rechazar() {
    if (!modalRechazo || !motivoRechazo.trim()) return;
    setActionId(modalRechazo.pagoId);
    setError(null);
    try {
      await api.post(`/admin/pagos/${modalRechazo.pagoId}/verificar`, {
        aprobado: false,
        motivoRechazo: motivoRechazo.trim(),
      });
      setModalRechazo(null);
      setMotivoRechazo('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setActionId(null);
    }
  }

  const CONCEPTO_LABELS: Record<string, string> = {
    derecho_examen: 'Derecho de examen',
    examen_extraordinario: 'Examen extraordinario',
    reposicion_credencial: 'Reposición de credencial',
    duplicado_acta: 'Duplicado de acta',
    otro: 'Otro',
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-guinda-700)] mb-1">Admin</div>
          <h1 style={{ fontFamily: "'Poppins', sans-serif" }} className="text-2xl font-bold text-stone-900">
            Pagos pendientes de verificación
          </h1>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-900">
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {loading ? (
        <div className="text-center text-stone-400 py-16">Cargando…</div>
      ) : pagos.length === 0 ? (
        <div className="border-2 border-dashed border-stone-200 rounded-xl p-12 text-center">
          <Check size={36} className="mx-auto text-emerald-500 mb-3" />
          <div style={{ fontFamily: "'Poppins', sans-serif" }} className="text-lg font-bold text-stone-900 mb-1">
            Sin pagos pendientes
          </div>
          <p className="text-sm text-stone-500">Todos los comprobantes han sido verificados.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pagos.map((pago) => (
            <div key={pago.id} className="bg-white border border-stone-200 border-l-4 border-l-amber-400 rounded-xl px-5 py-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div style={{ fontFamily: "'Poppins', sans-serif" }} className="font-semibold text-stone-900 text-sm">
                  {pago.nombreEstudiante} <span className="font-mono text-xs text-stone-500">{pago.curpEstudiante}</span>
                </div>
                <div className="text-xs text-stone-600 mt-0.5">
                  {CONCEPTO_LABELS[pago.concepto] ?? pago.concepto}
                  {pago.conceptoDetalle ? ` — ${pago.conceptoDetalle}` : ''}
                </div>
                <div className="flex gap-4 text-xs text-stone-500 mt-1">
                  <span>Fecha: {new Date(pago.fechaPago + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  {pago.referenciaBancaria && <span className="font-mono">Ref: {pago.referenciaBancaria}</span>}
                </div>
              </div>
              <div style={{ fontFamily: "'Poppins', sans-serif" }} className="text-2xl font-bold text-stone-900 text-right">
                ${parseFloat(pago.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                <div className="text-[10px] text-stone-400 font-normal">{pago.moneda}</div>
              </div>
              <div className="flex gap-2">
                <a
                  href={`/api/pagos/${pago.id}/comprobante`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 text-xs border border-stone-300 rounded-lg hover:bg-stone-50 text-stone-600"
                >
                  Ver PDF
                </a>
                <button
                  onClick={() => verificar(pago.id)}
                  disabled={actionId === pago.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60"
                >
                  <Check size={12} /> Verificar
                </button>
                <button
                  onClick={() => setModalRechazo({ pagoId: pago.id })}
                  disabled={actionId === pago.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-60"
                >
                  <X size={12} /> Rechazar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rechazo modal */}
      {modalRechazo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 style={{ fontFamily: "'Poppins', sans-serif" }} className="text-lg font-bold text-stone-900 mb-3">
              Rechazar comprobante
            </h3>
            <textarea
              rows={3}
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
              placeholder="Motivo del rechazo (requerido)"
              className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => { setModalRechazo(null); setMotivoRechazo(''); }}
                className="px-4 py-2 text-sm text-stone-600 border border-stone-300 rounded-lg hover:bg-stone-50"
              >
                Cancelar
              </button>
              <button
                onClick={rechazar}
                disabled={!motivoRechazo.trim() || actionId !== null}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60"
              >
                <X size={14} /> Rechazar
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
