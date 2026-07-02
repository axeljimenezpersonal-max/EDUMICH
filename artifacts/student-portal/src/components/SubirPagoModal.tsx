import { useRef, useState } from 'react';
import { X, Upload, AlertCircle, CheckCircle2, FileText } from 'lucide-react';

const CONCEPTOS = [
  { value: 'derecho_examen', label: 'Derecho de examen' },
  { value: 'examen_extraordinario', label: 'Examen extraordinario' },
  { value: 'reposicion_credencial', label: 'Reposición de credencial' },
  { value: 'duplicado_acta', label: 'Duplicado de acta' },
  { value: 'otro', label: 'Otro concepto' },
];

const METODOS = [
  { value: 'spei', label: 'Transferencia (SPEI)' },
  { value: 'banco_deposito', label: 'Banco – depósito' },
  { value: 'tienda_conveniencia', label: 'Tienda de conveniencia' },
  { value: 'otro', label: 'Otro' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  estudianteId: number;
  onSuccess: () => void;
}

export default function SubirPagoModal({ open, onClose, estudianteId, onSuccess }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [concepto, setConcepto] = useState('derecho_examen');
  const [conceptoDetalle, setConceptoDetalle] = useState('');
  const [monto, setMonto] = useState('');
  const [fechaPago, setFechaPago] = useState('');
  const [metodoPago, setMetodoPago] = useState('spei');
  const [referenciaBancaria, setReferenciaBancaria] = useState('');
  const [notas, setNotas] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function reset() {
    setConcepto('derecho_examen');
    setConceptoDetalle('');
    setMonto('');
    setFechaPago('');
    setMetodoPago('spei');
    setReferenciaBancaria('');
    setNotas('');
    setFileName(null);
    setError(null);
    setSuccess(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) { setError('Selecciona el comprobante (PDF o imagen)'); return; }
    if (!monto || isNaN(parseFloat(monto)) || parseFloat(monto) <= 0) {
      setError('Ingresa un monto válido'); return;
    }
    if (!fechaPago) { setError('Ingresa la fecha de pago'); return; }

    setError(null);
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('concepto', concepto);
      if (conceptoDetalle) fd.append('conceptoDetalle', conceptoDetalle);
      fd.append('monto', parseFloat(monto).toFixed(2));
      fd.append('fechaPago', fechaPago);
      fd.append('metodoPago', metodoPago);
      if (referenciaBancaria) fd.append('referenciaBancaria', referenciaBancaria);
      if (notas) fd.append('notas', notas);
      fd.append('comprobante', file);

      const res = await fetch(`/api/pagos/estudiantes/${estudianteId}`, {
        method: 'POST',
        body: fd,
        credentials: 'include',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? res.status.toString());
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        handleClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[480px] max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[var(--color-guinda-700)] text-white">
          <h3 style={{ fontFamily: "'Poppins', sans-serif" }} className="text-base font-semibold">
            Subir comprobante de pago
          </h3>
          <button onClick={handleClose} className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-6 space-y-4 flex-1">
          {success ? (
            <div className="flex flex-col items-center py-8 gap-3">
              <CheckCircle2 size={48} className="text-emerald-500" />
              <div className="text-base font-semibold text-stone-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
                ¡Comprobante registrado!
              </div>
              <p className="text-sm text-stone-500 text-center">
                El comprobante quedó en estado <em>pendiente</em> hasta que la administración lo verifique.
              </p>
            </div>
          ) : (
            <form id="pago-form" onSubmit={handleSubmit} className="space-y-4">
              {/* Concepto */}
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1 uppercase tracking-widest">
                  Concepto <span className="text-red-500">*</span>
                </label>
                <select
                  value={concepto}
                  onChange={(e) => setConcepto(e.target.value)}
                  className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-guinda-700)]"
                >
                  {CONCEPTOS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* Detalle */}
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1 uppercase tracking-widest">
                  Detalle (opcional)
                </label>
                <input
                  value={conceptoDetalle}
                  onChange={(e) => setConceptoDetalle(e.target.value)}
                  placeholder="ej. Convocatoria 2026-1, Módulo 5..."
                  className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-guinda-700)]"
                />
              </div>

              {/* Monto + Fecha */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1 uppercase tracking-widest">
                    Monto <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 text-sm">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={monto}
                      onChange={(e) => setMonto(e.target.value)}
                      placeholder="340.00"
                      className="w-full border border-stone-300 rounded-md pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-guinda-700)]"
                    />
                  </div>
                  <p className="text-[10px] text-stone-400 mt-0.5">Pesos mexicanos</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1 uppercase tracking-widest">
                    Fecha de pago <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={fechaPago}
                    onChange={(e) => setFechaPago(e.target.value)}
                    className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-guinda-700)]"
                  />
                </div>
              </div>

              {/* Método + Referencia */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1 uppercase tracking-widest">
                    Método <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={metodoPago}
                    onChange={(e) => setMetodoPago(e.target.value)}
                    className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-guinda-700)]"
                  >
                    {METODOS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1 uppercase tracking-widest">
                    Referencia bancaria
                  </label>
                  <input
                    value={referenciaBancaria}
                    onChange={(e) => setReferenciaBancaria(e.target.value)}
                    placeholder="SPEI-7745829301"
                    className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--color-guinda-700)]"
                  />
                </div>
              </div>

              {/* Comprobante PDF */}
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1 uppercase tracking-widest">
                  Comprobante (PDF o imagen) <span className="text-red-500">*</span>
                </label>
                {fileName ? (
                  <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-md px-3 py-2">
                    <FileText size={16} className="text-[var(--color-guinda-700)] shrink-0" />
                    <span className="text-xs text-stone-700 truncate flex-1">{fileName}</span>
                    <button
                      type="button"
                      onClick={() => { setFileName(null); if (fileRef.current) fileRef.current.value = ''; }}
                      className="text-stone-400 hover:text-stone-600"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="border-2 border-dashed border-stone-300 hover:border-[var(--color-guinda-700)] rounded-lg p-5 text-center cursor-pointer bg-[var(--color-crema-50)] hover:bg-[var(--color-crema-100)] transition-colors"
                  >
                    <Upload size={22} className="mx-auto text-stone-400 mb-2" />
                    <div className="text-sm font-medium text-stone-600">Arrastra el comprobante aquí</div>
                    <div className="text-[10px] text-stone-400 mt-1">PDF, JPG, PNG · máx 10 MB</div>
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf,image/*"
                  className="hidden"
                  onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
                />
              </div>

              {/* Notas */}
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1 uppercase tracking-widest">
                  Notas (opcional)
                </label>
                <textarea
                  rows={2}
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Cualquier nota adicional sobre este pago..."
                  className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-guinda-700)] resize-none"
                />
              </div>

              {/* Helper note */}
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 text-xs text-blue-800">
                <AlertCircle size={13} className="mt-0.5 text-blue-500 shrink-0" />
                El comprobante quedará en estado <em>pendiente</em> hasta que la administración lo verifique contra el sistema bancario.
              </div>

              {error && (
                <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <AlertCircle size={13} className="shrink-0" />
                  {error}
                </div>
              )}
            </form>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-stone-200">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-semibold text-stone-600 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              form="pago-form"
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-[var(--color-guinda-700)] text-white rounded-lg hover:bg-[var(--color-guinda-800)] disabled:opacity-60 transition-colors"
            >
              <Upload size={14} />
              {submitting ? 'Registrando…' : 'Registrar pago'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
