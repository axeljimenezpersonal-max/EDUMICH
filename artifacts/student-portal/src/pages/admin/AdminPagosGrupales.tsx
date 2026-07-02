/**
 * Pagos grupales (admin) — verificación de los pagos que los gestores hacen
 * ante la Tesorería del Estado: preview del comprobante, lista de exámenes
 * cubiertos y verificar/rechazar. Al verificar se generan los pagos
 * individuales por alumno con el folio como referencia.
 */
import { useEffect, useState } from 'react';
import {
  CreditCard, CheckCircle2, XCircle, Clock, AlertCircle, ChevronLeft,
  UploadCloud, Loader2, Landmark,
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { api, type PagoGrupalResumen, type PagoGrupalDetalle, type PagoGrupalEstado } from '../../lib/api';

const FILTROS: { key: string; label: string }[] = [
  { key: '', label: 'Todos' },
  { key: 'en_revision', label: 'Por verificar' },
  { key: 'pendiente_comprobante', label: 'Sin comprobante' },
  { key: 'verificado', label: 'Verificados' },
  { key: 'rechazado', label: 'Rechazados' },
];

const ESTADO_CFG: Record<PagoGrupalEstado, { label: string; bg: string; color: string }> = {
  pendiente_comprobante: { label: 'Sin comprobante', bg: '#fff7ed', color: '#b45309' },
  en_revision: { label: 'Por verificar', bg: '#eff6ff', color: '#1d4ed8' },
  verificado: { label: 'Verificado', bg: '#f0fdf4', color: '#15803d' },
  rechazado: { label: 'Rechazado', bg: '#fef2f2', color: '#b91c1c' },
};

const fmtMoney = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
const fmtFecha = (iso: string | null) =>
  iso ? new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export default function AdminPagosGrupales() {
  const [filtro, setFiltro] = useState('en_revision');
  const [pagos, setPagos] = useState<PagoGrupalResumen[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  function cargar(f = filtro) {
    setLoading(true);
    return api
      .get<{ pagos: PagoGrupalResumen[] }>(`/admin/pagos-grupales${f ? `?estado=${f}` : ''}`)
      .then((r) => setPagos(r.pagos))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    cargar(filtro);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);

  return (
    <AdminLayout>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm max-w-sm ${
          toast.ok ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {toast.ok ? <CheckCircle2 size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
          {toast.msg}
        </div>
      )}

      {sel === null ? (
        <>
          <div className="mb-5">
            <h1 className="font-serif text-2xl font-bold text-stone-900">Pagos grupales de gestores</h1>
            <p className="text-stone-500 text-sm mt-1 max-w-2xl">
              Los gestores pagan varios exámenes de una sola vez ante la Tesorería del Estado y suben su
              comprobante. Al verificar, todos los alumnos incluidos quedan con su pago cubierto
              (referencia = folio del pago grupal).
            </p>
          </div>

          {/* Filtros */}
          <div className="flex gap-1.5 mb-4 flex-wrap">
            {FILTROS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFiltro(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  filtro === f.key
                    ? 'bg-[var(--color-guinda-700)] text-white'
                    : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-center text-stone-400 py-16 text-sm">Cargando…</div>
          ) : pagos.length === 0 ? (
            <div className="border-2 border-dashed border-stone-200 rounded-xl p-12 text-center">
              <CreditCard size={30} className="mx-auto text-stone-300 mb-3" />
              <div className="font-bold text-stone-900">Sin pagos grupales {FILTROS.find((f) => f.key === filtro)?.label.toLowerCase()}</div>
            </div>
          ) : (
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              <div className="hidden md:grid grid-cols-[150px_1fr_90px_100px_110px_120px] gap-3 px-5 py-2.5 bg-[var(--color-crema-100)] text-[10px] font-bold text-stone-500 uppercase tracking-wider border-b border-stone-200">
                <div>Folio</div>
                <div>Gestor</div>
                <div className="text-right">Exámenes</div>
                <div className="text-right">Total</div>
                <div>Fecha pago</div>
                <div className="text-center">Estado</div>
              </div>
              {pagos.map((p) => {
                const c = ESTADO_CFG[p.estado];
                return (
                  <button
                    key={p.id}
                    onClick={() => setSel(p.id)}
                    className="w-full grid grid-cols-1 md:grid-cols-[150px_1fr_90px_100px_110px_120px] gap-1 md:gap-3 px-5 py-3.5 border-b border-stone-100 last:border-0 hover:bg-stone-50 items-center text-left"
                  >
                    <div className="font-mono text-sm font-bold text-[var(--color-guinda-700)]">{p.folio}</div>
                    <div className="min-w-0">
                      <div className="text-sm text-stone-800 truncate">{p.gestorNombre}</div>
                      <div className="text-[11px] text-stone-400">{p.municipio ?? '—'}</div>
                    </div>
                    <div className="md:text-right text-sm text-stone-700">{p.cantidadExamenes}</div>
                    <div className="md:text-right text-sm font-bold text-stone-900">{fmtMoney(p.montoTotal)}</div>
                    <div className="text-xs text-stone-500">{fmtFecha(p.fechaPago)}</div>
                    <div className="md:text-center">
                      <span className="inline-block text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide" style={{ background: c.bg, color: c.color }}>
                        {c.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <DetalleAdmin
          id={sel}
          onBack={() => { setSel(null); cargar(filtro); }}
          onToast={showToast}
        />
      )}
    </AdminLayout>
  );
}

// ─── Detalle + verificación ────────────────────────────────────────────────
function DetalleAdmin({ id, onBack, onToast }: {
  id: number;
  onBack: () => void;
  onToast: (m: string, ok?: boolean) => void;
}) {
  const [pg, setPg] = useState<PagoGrupalDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [accion, setAccion] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [mostrarRechazo, setMostrarRechazo] = useState(false);

  function cargar() {
    return api.get<PagoGrupalDetalle>(`/admin/pagos-grupales/${id}`).then(setPg).catch(() => {});
  }

  useEffect(() => {
    cargar().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function verificar() {
    if (!confirm(`¿Verificar el pago ${pg?.folio}? Todos los alumnos incluidos quedarán con su pago cubierto.`)) return;
    setAccion(true);
    try {
      const r = await api.post<{ alumnosCubiertos: number }>(`/admin/pagos-grupales/${id}/verificar`, {});
      onToast(`Pago verificado — ${r.alumnosCubiertos} alumnos cubiertos`);
      onBack();
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'No se pudo verificar', false);
    } finally {
      setAccion(false);
    }
  }

  async function rechazar() {
    if (!motivo.trim()) { onToast('Indica el motivo del rechazo', false); return; }
    setAccion(true);
    try {
      await api.post(`/admin/pagos-grupales/${id}/rechazar`, { motivo: motivo.trim() });
      onToast('Pago rechazado — se notificó al gestor');
      onBack();
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'No se pudo rechazar', false);
    } finally {
      setAccion(false);
    }
  }

  if (loading) return <div className="text-center text-stone-400 py-16 text-sm">Cargando…</div>;
  if (!pg) return <div className="text-center text-stone-400 py-16 text-sm">No encontrado.</div>;

  const c = ESTADO_CFG[pg.estado];

  return (
    <>
      <button onClick={onBack} className="text-sm text-stone-600 hover:text-[var(--color-guinda-700)] inline-flex items-center gap-1.5 mb-5">
        <ChevronLeft size={15} /> Volver a pagos grupales
      </button>

      {/* Encabezado */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 mb-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="font-mono text-2xl font-bold text-[var(--color-guinda-700)]">{pg.folio}</div>
          <div className="text-sm text-stone-600 mt-1">
            {pg.gestor?.nombre} · {pg.gestor?.municipio ?? '—'}
          </div>
          <div className="text-xs text-stone-400 mt-0.5">
            {pg.cantidadExamenes} exámenes × {fmtMoney(pg.montoUnitario)} · pago: {fmtFecha(pg.fechaPago)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-stone-900">{fmtMoney(pg.montoTotal)}</div>
          <span className="inline-block mt-1 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide" style={{ background: c.bg, color: c.color }}>
            {c.label}
          </span>
        </div>
      </div>

      {/* Acciones */}
      {pg.estado === 'en_revision' && (
        <div className="bg-white border border-stone-200 rounded-xl p-4 mb-5">
          {!mostrarRechazo ? (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={verificar}
                disabled={accion}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {accion ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                Verificar pago ({pg.cantidadExamenes} exámenes)
              </button>
              <button
                onClick={() => setMostrarRechazo(true)}
                disabled={accion}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-red-200 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                <XCircle size={15} /> Rechazar
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-stone-600">Motivo del rechazo</label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={2}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                placeholder="Ej. El comprobante no corresponde al monto total…"
              />
              <div className="flex gap-2">
                <button
                  onClick={rechazar}
                  disabled={accion}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {accion ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />} Confirmar rechazo
                </button>
                <button onClick={() => setMostrarRechazo(false)} className="text-xs text-stone-500 hover:text-stone-700 font-semibold px-2">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {pg.estado === 'pendiente_comprobante' && (
        <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex items-center gap-2">
          <Clock size={16} className="shrink-0" /> El gestor aún no sube el comprobante de pago.
        </div>
      )}
      {pg.estado === 'rechazado' && pg.motivoRechazo && (
        <div className="mb-5 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800 flex items-start gap-2">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <div><strong>Rechazado:</strong> {pg.motivoRechazo}</div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* Comprobante */}
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-stone-100 flex items-center gap-2">
            <Landmark size={14} className="text-[var(--color-guinda-700)]" />
            <h3 className="text-sm font-bold text-stone-900">Comprobante de la Tesorería</h3>
          </div>
          {pg.tieneComprobante ? (
            <iframe
              title="Comprobante"
              src={`/api/admin/pagos-grupales/${pg.id}/comprobante`}
              className="w-full bg-stone-100"
              style={{ height: 560 }}
            />
          ) : (
            <div className="py-16 text-center text-stone-400 text-sm">
              <UploadCloud size={26} className="mx-auto mb-2 text-stone-300" />
              Sin comprobante todavía
            </div>
          )}
        </div>

        {/* Exámenes cubiertos */}
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-stone-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-900">Exámenes cubiertos</h3>
            <span className="text-xs text-stone-500">{pg.examenes.length}</span>
          </div>
          <div className="divide-y divide-stone-100 max-h-[520px] overflow-y-auto">
            {pg.examenes.map((e, i) => (
              <div key={i} className="px-5 py-2.5 flex items-center gap-3">
                <span className="text-[11px] text-stone-400 w-5 shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-stone-800 truncate">{e.alumno}</div>
                  <div className="text-[11px] text-stone-400">
                    M{e.moduloNumero} · {e.curp ?? '—'} · {e.folioExamen}
                  </div>
                </div>
                <span className="text-xs font-bold text-stone-600 shrink-0">{fmtMoney(e.monto)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
