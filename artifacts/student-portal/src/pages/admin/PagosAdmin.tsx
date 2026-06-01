import { useEffect, useState, useCallback } from 'react';
import {
  CreditCard, Check, X, Search, RefreshCw, AlertCircle,
  FileText, ChevronLeft, ChevronRight,
  Building2, Smartphone, Landmark, User, UserCheck,
  ZoomIn,
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { api } from '../../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────

type PagoAdmin = {
  id: number;
  estudianteId: number;
  alumnoNombre: string;
  alumnoCurp: string | null;
  municipioNombre: string | null;
  gestorNombre: string | null;
  subidoPorUserId: number;
  subidoPorEmail: string | null;
  subidoPorAlumno: boolean;
  concepto: string;
  conceptoDetalle: string | null;
  monto: string;
  moneda: string;
  fechaPago: string;
  metodoPago: string;
  referenciaBancaria: string | null;
  notas: string | null;
  nombreComprobante: string | null;
  tamanoBytes: number | null;
  estado: 'pendiente' | 'verificado' | 'rechazado';
  motivoRechazo: string | null;
  verificadoEn: string | null;
  createdAt: string;
};

type Resumen = {
  pendientes: number;
  verificados: number;
  rechazados: number;
  montoVerificado: number;
};

type ListaResp = {
  pagos: PagoAdmin[];
  total: number;
  page: number;
  totalPages: number;
  resumen: Resumen;
};

// ─── Constants ────────────────────────────────────────────────────────────

const CONCEPTO_LABELS: Record<string, string> = {
  derecho_examen: 'Derecho de examen',
  examen_extraordinario: 'Examen extraordinario',
  reposicion_credencial: 'Reposición de credencial',
  duplicado_acta: 'Duplicado de acta',
  otro: 'Otro',
};

const METODO_CONFIG: Record<string, { label: string; bg: string; color: string; icon: React.ComponentType<{ size?: number }> }> = {
  spei: { label: 'SPEI', bg: '#dbeafe', color: '#1d4ed8', icon: Landmark },
  banco_deposito: { label: 'Depósito banco', bg: '#dcfce7', color: '#15803d', icon: Building2 },
  tienda_conveniencia: { label: 'Tienda / Oxxo', bg: '#ffedd5', color: '#c2410c', icon: Smartphone },
  otro: { label: 'Otro', bg: '#f5f5f4', color: '#78716c', icon: CreditCard },
};

const ESTADO_CONFIG = {
  pendiente: { label: 'Pendiente', bg: '#fef9c3', color: '#a16207', dot: '#ca8a04' },
  verificado: { label: 'Verificado', bg: '#d1fae5', color: '#065f46', dot: '#10b981' },
  rechazado: { label: 'Rechazado', bg: '#fee2e2', color: '#991b1b', dot: '#ef4444' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, ms: number): T {
  const [dv, setDv] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDv(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return dv;
}

function iniciales(nombre: string): string {
  return nombre.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('');
}

function fmtMonto(monto: string): string {
  return `$${parseFloat(monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
}

function fmtFecha(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtFechaCorta(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: '2-digit' });
}

// ─── StatCard ─────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, active, onClick }: {
  label: string; value: number | string; sub?: string;
  active?: boolean; onClick?: () => void;
}) {
  return (
    <div
      className={`bg-white border rounded-xl px-5 py-4 flex-1 min-w-0 transition-all ${onClick ? 'cursor-pointer' : ''} ${active ? 'border-[var(--color-guinda-700)] shadow-sm' : 'border-stone-200 hover:border-stone-300'}`}
      onClick={onClick}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: active ? 'var(--color-guinda-700)' : '#78716c' }}>
        {label}
      </div>
      <div className="text-2xl font-bold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#2a2a2a' }}>
        {typeof value === 'number' ? value.toLocaleString('es-MX') : value}
      </div>
      {sub && <div className="text-[11px] mt-0.5" style={{ color: '#a8a29e' }}>{sub}</div>}
    </div>
  );
}

// ─── RechazarModal ────────────────────────────────────────────────────────

function RechazarModal({ pagoId, onClose, onSuccess }: {
  pagoId: number; onClose: () => void; onSuccess: () => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRechazar() {
    if (!motivo.trim()) { setError('El motivo es requerido.'); return; }
    setSaving(true);
    setError(null);
    try {
      await api.post(`/admin/pagos/${pagoId}/verificar`, { aprobado: false, motivoRechazo: motivo.trim() });
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al rechazar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#2a2a2a' }}>
            Rechazar comprobante
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-100 transition-colors">
            <X size={16} style={{ color: '#78716c' }} />
          </button>
        </div>
        <p className="text-sm mb-3" style={{ color: '#78716c' }}>
          El alumno recibirá una notificación con el motivo del rechazo.
        </p>
        <textarea
          rows={3}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Motivo del rechazo (ej. comprobante ilegible, datos incorrectos…)"
          className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-stone-400 resize-none mb-1"
        />
        {error && <p className="text-xs mb-3" style={{ color: '#b91c1c' }}>{error}</p>}
        <div className="flex items-center gap-3 justify-end mt-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold rounded-lg border border-stone-200 bg-white hover:bg-stone-50 transition-colors"
            style={{ color: '#44403c' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleRechazar}
            disabled={saving || !motivo.trim()}
            className="px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition-opacity"
            style={{ background: '#dc2626' }}
          >
            {saving ? 'Rechazando…' : 'Rechazar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DetalleModal — comprobante + acciones ────────────────────────────────

function DetalleModal({
  pago,
  onClose,
  onVerificar,
  onRechazar,
  actionId,
}: {
  pago: PagoAdmin;
  onClose: () => void;
  onVerificar: (id: number) => void;
  onRechazar: (id: number) => void;
  actionId: number | null;
}) {
  const metodo = METODO_CONFIG[pago.metodoPago] ?? METODO_CONFIG.otro;
  const MetodoIcon = metodo.icon;
  const estado = ESTADO_CONFIG[pago.estado];
  const ini = iniciales(pago.alumnoNombre);
  const comprobanteUrl = `/api/pagos/${pago.id}/comprobante`;
  const esImagen = /\.(jpe?g|png|webp|heic|heif)$/i.test(pago.nombreComprobante ?? '');

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-end"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Side panel */}
      <div
        className="flex flex-col bg-white h-full overflow-hidden"
        style={{ width: '100%', maxWidth: 900 }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b border-stone-100 flex-shrink-0"
          style={{ background: '#fafaf9' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
              style={{ background: '#efe7d6', color: 'var(--color-guinda-700)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {ini}
            </div>
            <div>
              <div className="text-base font-bold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#2a2a2a' }}>
                {pago.alumnoNombre}
              </div>
              <div className="text-[11px]" style={{ color: '#78716c' }}>
                {pago.alumnoCurp ?? '—'}
                {pago.municipioNombre ? ` · ${pago.municipioNombre}` : ''}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-stone-100 transition-colors">
            <X size={18} style={{ color: '#78716c' }} />
          </button>
        </div>

        {/* Body: split — info left / PDF right */}
        <div className="flex flex-1 min-h-0">

          {/* Left: payment details + actions */}
          <div className="flex flex-col w-72 flex-shrink-0 border-r border-stone-100 overflow-y-auto">
            <div className="p-5 space-y-4">

              {/* Estado */}
              <div>
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded"
                  style={{ background: estado.bg, color: estado.color }}
                >
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: estado.dot }} />
                  {estado.label}
                </span>
              </div>

              {/* Concepto */}
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#78716c' }}>Concepto</div>
                <div className="text-sm font-semibold" style={{ color: '#2a2a2a' }}>
                  {CONCEPTO_LABELS[pago.concepto] ?? pago.concepto}
                </div>
                {pago.conceptoDetalle && (
                  <div className="text-xs mt-0.5" style={{ color: '#78716c' }}>{pago.conceptoDetalle}</div>
                )}
              </div>

              {/* Monto */}
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#78716c' }}>Monto</div>
                <div className="text-2xl font-bold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#2a2a2a' }}>
                  {fmtMonto(pago.monto)}
                </div>
                <div className="text-[10px]" style={{ color: '#a8a29e' }}>{pago.moneda}</div>
              </div>

              {/* Método */}
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#78716c' }}>Método de pago</div>
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg"
                  style={{ background: metodo.bg, color: metodo.color }}
                >
                  <MetodoIcon size={12} /> {metodo.label}
                </span>
              </div>

              {/* Fecha */}
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#78716c' }}>Fecha de pago</div>
                <div className="text-sm" style={{ color: '#2a2a2a' }}>{fmtFecha(pago.fechaPago)}</div>
              </div>

              {/* Referencia */}
              {pago.referenciaBancaria && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#78716c' }}>Referencia</div>
                  <div className="text-xs font-mono bg-stone-50 px-2 py-1.5 rounded" style={{ color: '#44403c' }}>
                    {pago.referenciaBancaria}
                  </div>
                </div>
              )}

              {/* Notas */}
              {pago.notas && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#78716c' }}>Notas</div>
                  <div className="text-xs bg-stone-50 px-2 py-1.5 rounded" style={{ color: '#44403c' }}>
                    {pago.notas}
                  </div>
                </div>
              )}

              {/* Quién subió */}
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#78716c' }}>Subido por</div>
                <div className="flex items-center gap-1.5 text-xs" style={{ color: '#44403c' }}>
                  {pago.subidoPorAlumno ? (
                    <><User size={12} style={{ color: '#78716c' }} /> El propio alumno</>
                  ) : (
                    <><UserCheck size={12} style={{ color: '#1d4ed8' }} /> {pago.gestorNombre ?? 'Gestor'}</>
                  )}
                </div>
              </div>

              {/* Motivo rechazo si aplica */}
              {pago.estado === 'rechazado' && pago.motivoRechazo && (
                <div className="rounded-lg p-3" style={{ background: '#fee2e2' }}>
                  <div className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#991b1b' }}>Motivo de rechazo</div>
                  <div className="text-xs" style={{ color: '#7f1d1d' }}>{pago.motivoRechazo}</div>
                </div>
              )}
            </div>

            {/* Action buttons — pinned to bottom */}
            {pago.estado === 'pendiente' && (
              <div className="mt-auto p-5 border-t border-stone-100 space-y-2">
                <button
                  onClick={() => onVerificar(pago.id)}
                  disabled={actionId === pago.id}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-50 transition-opacity"
                  style={{ background: '#059669' }}
                >
                  <Check size={16} /> Verificar pago
                </button>
                <button
                  onClick={() => onRechazar(pago.id)}
                  disabled={actionId === pago.id}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-xl border disabled:opacity-50 transition-opacity"
                  style={{ background: '#fee2e2', color: '#b91c1c', borderColor: '#fca5a5' }}
                >
                  <X size={16} /> Rechazar
                </button>
              </div>
            )}
          </div>

          {/* Right: PDF viewer */}
          <div className="flex-1 flex flex-col bg-stone-100 min-w-0">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-200 bg-white flex-shrink-0">
              <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: '#44403c' }}>
                <FileText size={14} style={{ color: '#78716c' }} />
                {pago.nombreComprobante ?? 'comprobante.pdf'}
              </div>
              <a
                href={comprobanteUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 transition-colors"
                style={{ color: '#44403c' }}
              >
                <ZoomIn size={12} /> Abrir en nueva pestaña
              </a>
            </div>
            {pago.nombreComprobante ? (
              esImagen ? (
                <div className="flex-1 overflow-auto flex items-start justify-center p-4">
                  <img
                    src={comprobanteUrl}
                    alt="Comprobante de pago"
                    className="max-w-full rounded-lg shadow"
                    style={{ maxHeight: '100%', objectFit: 'contain' }}
                  />
                </div>
              ) : (
                <iframe
                  src={comprobanteUrl}
                  title="Comprobante de pago"
                  className="flex-1 w-full border-0"
                  style={{ minHeight: 0 }}
                />
              )
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <FileText size={40} style={{ color: '#d6d3d1', margin: '0 auto 12px' }} />
                  <p className="text-sm font-semibold" style={{ color: '#44403c' }}>Sin comprobante adjunto</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PagoRow ──────────────────────────────────────────────────────────────

function PagoRow({
  pago,
  onClick,
}: {
  pago: PagoAdmin;
  onClick: () => void;
}) {
  const metodo = METODO_CONFIG[pago.metodoPago] ?? METODO_CONFIG.otro;
  const MetodoIcon = metodo.icon;
  const estado = ESTADO_CONFIG[pago.estado];
  const ini = iniciales(pago.alumnoNombre);

  return (
    <div
      className="grid items-center px-5 py-3.5 border-b border-stone-50 last:border-b-0 hover:bg-stone-50 transition-colors cursor-pointer"
      style={{ gridTemplateColumns: '44px 1fr 130px 100px 90px 90px 44px', gap: 12 }}
      onClick={onClick}
    >
      {/* Avatar */}
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0"
        style={{ background: '#efe7d6', color: 'var(--color-guinda-700)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        {ini}
      </div>

      {/* Alumno + concepto */}
      <div className="min-w-0">
        <div className="text-sm font-semibold truncate" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#2a2a2a' }}>
          {pago.alumnoNombre}
        </div>
        <div className="text-[11px] truncate" style={{ color: '#78716c' }}>
          {CONCEPTO_LABELS[pago.concepto] ?? pago.concepto}
          {pago.conceptoDetalle ? ` · ${pago.conceptoDetalle}` : ''}
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          {pago.subidoPorAlumno ? (
            <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: '#78716c' }}>
              <User size={10} /> Alumno
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: '#1d4ed8' }}>
              <UserCheck size={10} /> Gestor
            </span>
          )}
          {pago.municipioNombre && (
            <span className="text-[10px]" style={{ color: '#a8a29e' }}>· {pago.municipioNombre}</span>
          )}
        </div>
      </div>

      {/* Método */}
      <div>
        <span
          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full"
          style={{ background: metodo.bg, color: metodo.color }}
        >
          <MetodoIcon size={10} /> {metodo.label}
        </span>
      </div>

      {/* Monto */}
      <div className="text-right">
        <div className="text-sm font-bold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#2a2a2a' }}>
          {fmtMonto(pago.monto)}
        </div>
        <div className="text-[10px]" style={{ color: '#a8a29e' }}>{pago.moneda}</div>
      </div>

      {/* Fecha */}
      <div className="text-[11px]" style={{ color: '#78716c' }}>
        {fmtFechaCorta(pago.fechaPago)}
      </div>

      {/* Estado */}
      <div>
        <span
          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded"
          style={{ background: estado.bg, color: estado.color }}
        >
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: estado.dot }} />
          {estado.label}
        </span>
      </div>

      {/* Arrow */}
      <div className="flex items-center justify-center opacity-40">
        <ChevronRight size={14} style={{ color: '#78716c' }} />
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────

export default function PagosAdmin() {
  const [data, setData] = useState<ListaResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('pendiente');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(searchInput, 300);

  const [actionId, setActionId] = useState<number | null>(null);
  const [detallePago, setDetallePago] = useState<PagoAdmin | null>(null);
  const [rechazarModal, setRechazarModal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qp = new URLSearchParams({ page: String(page), limit: '20' });
      if (estadoFiltro) qp.set('estado', estadoFiltro);
      if (debouncedSearch) qp.set('search', debouncedSearch);
      const resp = await api.get<ListaResp>(`/admin/pagos?${qp.toString()}`);
      setData(resp);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [estadoFiltro, debouncedSearch, page]);

  useEffect(() => { setPage(1); }, [estadoFiltro, debouncedSearch]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleVerificar(pagoId: number) {
    setActionId(pagoId);
    setError(null);
    try {
      await api.post(`/admin/pagos/${pagoId}/verificar`, { aprobado: true });
      setToast({ msg: 'Pago verificado correctamente', ok: true });
      setDetallePago(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al verificar');
    } finally {
      setActionId(null);
    }
  }

  async function handleRechazarSuccess() {
    setRechazarModal(null);
    setDetallePago(null);
    setToast({ msg: 'Comprobante rechazado', ok: false });
    await load();
  }

  const resumen = data?.resumen;

  return (
    <AdminLayout>
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-lg"
          style={{
            background: toast.ok ? '#d1fae5' : '#fee2e2',
            color: toast.ok ? '#065f46' : '#991b1b',
            border: `1px solid ${toast.ok ? '#a7f3d0' : '#fca5a5'}`,
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* Detalle modal (side panel with PDF) */}
      {detallePago && (
        <DetalleModal
          pago={detallePago}
          onClose={() => setDetallePago(null)}
          onVerificar={handleVerificar}
          onRechazar={(id) => setRechazarModal(id)}
          actionId={actionId}
        />
      )}

      {/* Rechazo modal (shown on top of detalle) */}
      {rechazarModal && (
        <RechazarModal
          pagoId={rechazarModal}
          onClose={() => setRechazarModal(null)}
          onSuccess={handleRechazarSuccess}
        />
      )}

      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase mb-1.5" style={{ color: 'var(--color-guinda-700)', letterSpacing: '0.15em' }}>
          <CreditCard size={12} /> PERSONAS · PAGOS
        </div>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#2a2a2a' }}>
            Verificación de pagos
            {data && estadoFiltro === 'pendiente' && data.total > 0 && (
              <span className="ml-2 text-base font-normal" style={{ color: '#78716c' }}>
                ({data.total} pendiente{data.total !== 1 ? 's' : ''})
              </span>
            )}
          </h1>
          <button
            onClick={load}
            className="p-2 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 transition-colors"
            title="Recargar"
          >
            <RefreshCw size={14} style={{ color: '#78716c' }} />
          </button>
        </div>
      </div>

      {/* Stats */}
      {resumen && (
        <div className="flex gap-3 mb-5 flex-wrap">
          <StatCard
            label="Pendientes"
            value={resumen.pendientes}
            sub="Por verificar"
            active={estadoFiltro === 'pendiente'}
            onClick={() => setEstadoFiltro('pendiente')}
          />
          <StatCard
            label="Verificados"
            value={resumen.verificados}
            sub="Aprobados"
            active={estadoFiltro === 'verificado'}
            onClick={() => setEstadoFiltro('verificado')}
          />
          <StatCard
            label="Monto verificado"
            value={`$${resumen.montoVerificado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`}
            sub="Total aprobado MXN"
          />
          <StatCard
            label="Rechazados"
            value={resumen.rechazados}
            sub="Comprobantes inválidos"
            active={estadoFiltro === 'rechazado'}
            onClick={() => setEstadoFiltro('rechazado')}
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center gap-2 text-sm rounded-lg px-4 py-3" style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }}>
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-1 bg-stone-100 rounded-lg p-1">
          {(['', 'pendiente', 'verificado', 'rechazado'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setEstadoFiltro(v)}
              className="px-3 py-1.5 text-xs font-semibold rounded-md transition-all"
              style={{
                background: estadoFiltro === v ? 'white' : 'transparent',
                color: estadoFiltro === v ? 'var(--color-guinda-700)' : '#78716c',
                boxShadow: estadoFiltro === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {v === '' ? 'Todos' : v === 'pendiente' ? 'Pendientes' : v === 'verificado' ? 'Verificados' : 'Rechazados'}
            </button>
          ))}
        </div>

        <div className="relative ml-auto">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: '#78716c' }} />
          <input
            className="pl-8 pr-8 py-1.5 text-sm rounded-lg border border-stone-200 focus:outline-none focus:border-stone-400 w-48"
            style={{ background: '#f8f4ec' }}
            placeholder="Nombre, CURP…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          {searchInput && (
            <button className="absolute right-2.5 top-1/2 -translate-y-1/2" onClick={() => setSearchInput('')}>
              <X size={12} style={{ color: '#78716c' }} />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-20 text-center text-sm" style={{ color: '#78716c' }}>Cargando pagos…</div>
      ) : !data || data.pagos.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 rounded-xl border-2"
          style={{ borderColor: '#e7e5e4', borderStyle: 'dashed', color: '#78716c' }}
        >
          {estadoFiltro === 'pendiente' ? (
            <>
              <Check size={36} style={{ color: '#10b981', marginBottom: 12 }} />
              <p className="text-sm font-semibold mb-1" style={{ color: '#44403c' }}>Sin pagos pendientes</p>
              <p className="text-xs" style={{ color: '#a8a29e' }}>Todos los comprobantes han sido verificados.</p>
            </>
          ) : (
            <>
              <CreditCard size={32} style={{ color: '#d6d3d1', marginBottom: 12 }} />
              <p className="text-sm font-semibold" style={{ color: '#44403c' }}>No hay pagos en esta categoría</p>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
            {/* Table header */}
            <div
              className="grid px-5 py-3 border-b border-stone-100"
              style={{ gridTemplateColumns: '44px 1fr 130px 100px 90px 90px 44px', gap: 12, background: '#fafaf9' }}
            >
              <div />
              <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#78716c' }}>Alumno</div>
              <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#78716c' }}>Método</div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-right" style={{ color: '#78716c' }}>Monto</div>
              <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#78716c' }}>Fecha</div>
              <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#78716c' }}>Estado</div>
              <div />
            </div>

            {data.pagos.map((pago) => (
              <PagoRow
                key={pago.id}
                pago={pago}
                onClick={() => setDetallePago(pago)}
              />
            ))}
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
              <span className="text-sm" style={{ color: '#78716c' }}>
                Página {data.page} de {data.totalPages} · {data.total.toLocaleString('es-MX')} pagos
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page <= 1}
                  className="p-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft size={14} style={{ color: '#44403c' }} />
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= data.totalPages}
                  className="p-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-40 transition-colors"
                >
                  <ChevronRight size={14} style={{ color: '#44403c' }} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </AdminLayout>
  );
}
