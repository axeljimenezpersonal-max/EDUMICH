/**
 * Mis pagos — sección propia del alumno (espejo del flujo del gestor).
 *
 * Muestra: inscripciones activas con su estado de pago (pagado / en proceso /
 * sin pagar), órdenes de pago ante la Tesorería del Estado (solicitar,
 * descargar, línea de captura, subir comprobante) e historial de comprobantes.
 */

import { useEffect, useState, type ReactNode } from 'react';
import {
  AlertCircle, Calendar, Check, CheckCircle2, Clock, Copy, CreditCard,
  Download, ExternalLink, FileText, Landmark, Loader2, MapPin, UploadCloud,
  X, AlertTriangle,
} from 'lucide-react';
import { EstudianteLayout } from './EstudianteLayout';
import { PageTour } from '../../components/tour/PageTour';
import { TOUR_PAGOS } from '../../components/tour/estudianteToursPagina';
import PagoCard from '../../components/PagoCard';
import { PagoStepper } from '../../components/PagoStepper';
import {
  api,
  type ConvocatoriaResponse,
  type GestorConfigPagoResponse,
  type MeResponse,
  type MetodoPago,
  type PagoExamenAlumno,
  type PagosResponse,
  METODOS_PAGO,
} from '../../lib/api';

const DIA_LABEL: Record<string, string> = { sabado: 'Sábado', domingo: 'Domingo' };

type EstadoPagoExamen = 'pagado' | 'en_proceso' | 'sin_pagar';

const ESTADO_EXAMEN_CFG: Record<EstadoPagoExamen, { label: string; bg: string; color: string; icon: ReactNode }> = {
  pagado:     { label: 'Pagado',     bg: '#f0fdf4', color: '#15803d', icon: <CheckCircle2 size={12} /> },
  en_proceso: { label: 'En proceso', bg: '#fefce8', color: '#a16207', icon: <Clock size={12} /> },
  sin_pagar:  { label: 'Sin pagar',  bg: '#fef2f2', color: '#b91c1c', icon: <AlertCircle size={12} /> },
};

export default function MisPagos() {
  const [meId, setMeId] = useState<number | null>(null);
  const [convData, setConvData] = useState<ConvocatoriaResponse | null>(null);
  const [configPago, setConfigPago] = useState<GestorConfigPagoResponse | null>(null);
  const [pagosData, setPagosData] = useState<PagosResponse | null>(null);
  const [ordenes, setOrdenes] = useState<PagoExamenAlumno[] | null>(null);
  const [loading, setLoading] = useState(true);

  const [solicitando, setSolicitando] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  function cargarOrdenes() {
    return api.get<{ pagos: PagoExamenAlumno[] }>('/pagos-examen/mios')
      .then((r) => setOrdenes(r.pagos))
      .catch(() => setOrdenes([]));
  }

  useEffect(() => {
    api.get<MeResponse>('/auth/me').then((me) => {
      setMeId(me.id);
      return Promise.all([
        api.get<ConvocatoriaResponse>('/estudiante/convocatoria').then(setConvData).catch(() => {}),
        api.get<GestorConfigPagoResponse>('/estudiante/config-pago').then(setConfigPago).catch(() => {}),
        api.get<PagosResponse>(`/pagos/estudiantes/${me.id}`).then(setPagosData).catch(() => {}),
        cargarOrdenes(),
      ]);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // ── Estado de pago por examen inscrito (derivado de las órdenes) ──
  const inscripcionesActivas = convData?.misExamenes.filter(
    (e) => !['cancelado', 'reprobado', 'no_presento'].includes(e.estado)
  ) ?? [];

  const ordenesVigentes = (ordenes ?? []).filter((o) => o.estado !== 'cancelado' && o.estado !== 'vencido');

  function estadoPagoDe(inscripcionId: number): EstadoPagoExamen {
    for (const o of ordenesVigentes) {
      if (o.examenes.some((e) => e.inscripcionId === inscripcionId)) {
        return o.estado === 'pagado' ? 'pagado' : 'en_proceso';
      }
    }
    return 'sin_pagar';
  }

  const sinPagar = inscripcionesActivas.filter((e) => estadoPagoDe(e.id) === 'sin_pagar');
  const pagados = inscripcionesActivas.filter((e) => estadoPagoDe(e.id) === 'pagado');
  const costoExamen = configPago?.costoExamen ?? 145;

  async function solicitarOrden() {
    if (sinPagar.length === 0) return;
    setSolicitando(true);
    try {
      await api.post('/pagos-examen/solicitar', {
        examenInscripcionIds: sinPagar.map((e) => e.id),
      });
      await cargarOrdenes();
      showToast('Orden de pago solicitada. La coordinación la emitirá ante la Tesorería.', 'success');
    } catch (e) {
      showToast((e as Error).message || 'No se pudo solicitar la orden', 'error');
    } finally {
      setSolicitando(false);
    }
  }

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <EstudianteLayout>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm max-w-sm ${
          toast.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-guinda-700)] mb-1">
          MIS PAGOS
        </div>
        <h1 data-tour="pagos-titulo" className="font-serif text-2xl font-bold text-stone-900">Pagos de examen</h1>
        <p className="text-stone-500 text-sm mt-1">
          Consulta qué exámenes ya están cubiertos, paga ante la Tesorería del Estado y sube tu comprobante.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-stone-400 gap-2 text-sm">
          <Loader2 size={18} className="animate-spin" /> Cargando…
        </div>
      ) : (
        <div className="space-y-5">

          {/* ── Resumen ── */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-stone-200 rounded-xl p-4">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">Exámenes inscritos</div>
              <div className="text-2xl font-bold font-serif text-stone-900 mt-1">{inscripcionesActivas.length}</div>
            </div>
            <div className="bg-white border border-stone-200 rounded-xl p-4">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">Pagados</div>
              <div className="text-2xl font-bold font-serif mt-1" style={{ color: '#15803d' }}>{pagados.length}</div>
            </div>
            <div className="bg-white border border-stone-200 rounded-xl p-4">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">Costo por examen</div>
              <div className="text-2xl font-bold font-serif text-stone-900 mt-1">${costoExamen.toLocaleString('es-MX')}<span className="text-xs font-medium text-stone-400"> MXN</span></div>
            </div>
          </div>

          {/* ── Inscripciones activas con estado de pago ── */}
          {inscripcionesActivas.length > 0 ? (
            <div data-tour="pagos-inscripciones" className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar size={15} className="text-[var(--color-guinda-700)]" />
                  <h3 className="text-sm font-bold text-stone-900">Mis inscripciones activas</h3>
                </div>
                <span className="text-xs text-stone-500">{inscripcionesActivas.length} examen{inscripcionesActivas.length !== 1 ? 'es' : ''}</span>
              </div>
              <div className="divide-y divide-stone-100">
                {inscripcionesActivas.map((insc) => {
                  const estado = estadoPagoDe(insc.id);
                  const cfg = ESTADO_EXAMEN_CFG[estado];
                  return (
                    <div key={insc.id} className="px-5 py-3.5 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-stone-800">
                          Módulo {insc.modulo.numero} — {insc.modulo.nombre}
                        </div>
                        <div className="flex flex-wrap gap-3 mt-1 text-xs text-stone-500">
                          <span className="flex items-center gap-1">
                            <Clock size={11} />{DIA_LABEL[insc.dia] ?? insc.dia} · {insc.hora}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar size={11} />{fmtDate(insc.fechaExamen)}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin size={11} />{insc.sede.nombre}
                          </span>
                        </div>
                      </div>
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0"
                        style={{ background: cfg.bg, color: cfg.color }}
                      >
                        {cfg.icon} {cfg.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Acción: solicitar orden por lo que falta */}
              {sinPagar.length > 0 && (
                <div className="px-5 py-4 bg-stone-50 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs text-stone-600">
                    Tienes <strong>{sinPagar.length} examen{sinPagar.length !== 1 ? 'es' : ''} sin pagar</strong> — total{' '}
                    <strong>${(sinPagar.length * costoExamen).toLocaleString('es-MX')} MXN</strong>.
                    Solicita tu orden de pago para cubrirlos ante la Tesorería.
                  </div>
                  <button
                    onClick={solicitarOrden}
                    disabled={solicitando}
                    className="shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--color-guinda-700)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--color-guinda-800)] disabled:opacity-50 transition-colors"
                  >
                    {solicitando ? <Loader2 size={14} className="animate-spin" /> : <Landmark size={14} />}
                    Solicitar orden de pago
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-8 text-center">
              <CreditCard size={32} className="mx-auto text-stone-300 mb-3" />
              <div className="text-sm font-semibold text-stone-500">Sin inscripciones activas</div>
              <div className="text-xs text-stone-400 mt-1 max-w-xs mx-auto mb-4">
                Cuando te inscribas a exámenes en la convocatoria, aquí verás su estado de pago.
              </div>
              <a
                href="/estudiante/convocatoria"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-guinda-700)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--color-guinda-800)] transition-colors no-underline"
              >
                Ir a inscripción →
              </a>
            </div>
          )}

          {/* ── Órdenes de pago (Tesorería del Estado) ── */}
          <div data-tour="pagos-ordenes">
            <OrdenesPagoExamen ordenes={ordenes} onReload={cargarOrdenes} />
          </div>

          {/* ── Historial de comprobantes (tabla pagos) ── */}
          {pagosData && pagosData.pagos.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-stone-900 mb-3">Historial de comprobantes</h3>
              <div className="space-y-3">
                {pagosData.pagos.map((p) => (
                  <PagoCard key={p.id} pago={p} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <PageTour storageKey="edumich_tour_pagos_v1" steps={TOUR_PAGOS} />
    </EstudianteLayout>
  );
}

// ─── Órdenes de pago de examen (Tesorería del Estado) ──────────────────────
const OP_ESTADO: Record<string, { label: string; bg: string; color: string; icon: ReactNode }> = {
  pendiente_emision: { label: 'Preparando tu orden', bg: '#fff7ed', color: '#b45309', icon: <Clock size={13} /> },
  emitida: { label: 'Lista para pagar', bg: '#eff6ff', color: '#1d4ed8', icon: <Landmark size={13} /> },
  en_revision: { label: 'Comprobante en revisión', bg: '#fefce8', color: '#a16207', icon: <Clock size={13} /> },
  pagado: { label: 'Pagado', bg: '#f0fdf4', color: '#15803d', icon: <CheckCircle2 size={13} /> },
  vencido: { label: 'Vencido', bg: '#fef2f2', color: '#b91c1c', icon: <AlertCircle size={13} /> },
  cancelado: { label: 'Cancelado', bg: '#f5f5f4', color: '#78716c', icon: <AlertCircle size={13} /> },
};

function OrdenesPagoExamen({ ordenes, onReload }: { ordenes: PagoExamenAlumno[] | null; onReload: () => Promise<unknown> }) {
  const [subiendo, setSubiendo] = useState<number | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [metodoPorId, setMetodoPorId] = useState<Record<number, MetodoPago>>({});
  // Confirmación en popup (en vez del confirm() nativo del navegador).
  const [confirmacion, setConfirmacion] = useState<
    | { tipo: 'quitar'; ordenId: number; inscId: number; modulo: number }
    | { tipo: 'cancelar'; ordenId: number }
    | null
  >(null);
  const [ejecutando, setEjecutando] = useState(false);

  async function subirComprobante(id: number, file: File) {
    const metodo = metodoPorId[id];
    if (!metodo) return;
    setSubiendo(id);
    try {
      const fd = new FormData();
      fd.append('comprobante', file);
      fd.append('metodoPago', metodo);
      await api.post(`/pagos-examen/${id}/comprobante`, fd);
      await onReload();
    } catch { /* noop */ } finally { setSubiendo(null); }
  }

  async function ejecutarConfirmacion() {
    if (!confirmacion) return;
    setEjecutando(true);
    try {
      if (confirmacion.tipo === 'cancelar') {
        await api.post(`/pagos-examen/${confirmacion.ordenId}/cancelar-mia`, {});
      } else {
        await api.post(`/pagos-examen/${confirmacion.ordenId}/quitar-examen`, { examenInscripcionId: confirmacion.inscId });
      }
      await onReload();
      setConfirmacion(null);
    } catch { /* noop */ } finally { setEjecutando(false); }
  }

  const fmtMoney = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
  const fmtFecha = (iso: string | null) =>
    iso ? new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

  const visibles = (ordenes ?? []).filter((o) => o.estado !== 'cancelado');
  if (visibles.length === 0) return null;

  return (
    <div className="space-y-4">
      {visibles.map((o) => {
        const cfg = OP_ESTADO[o.estado] ?? OP_ESTADO.emitida;
        return (
          <div key={o.id} className="bg-white border border-stone-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Landmark size={16} className="text-[var(--color-guinda-700)]" />
                <h3 className="text-sm font-bold text-stone-900">Orden de pago — Tesorería del Estado</h3>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: cfg.bg, color: cfg.color }}>
                {cfg.icon} {cfg.label}
              </span>
            </div>

            <div className="p-5 space-y-4">
              <PagoStepper estado={o.estado} />

              <div className="flex items-baseline justify-between">
                <span className="text-sm text-stone-500">{o.cantidadExamenes} examen{o.cantidadExamenes !== 1 ? 'es' : ''} de derecho a examen</span>
                <span className="text-2xl font-bold text-stone-900">{fmtMoney(o.montoTotal)} <span className="text-sm font-medium text-stone-400">MXN</span></span>
              </div>
              {o.examenes.length > 0 && (() => {
                const editable = o.estado === 'pendiente_emision' || o.estado === 'emitida';
                return (
                  <div className="flex flex-wrap gap-1.5">
                    {o.examenes.map((e) => (
                      <span key={e.inscripcionId} className="text-[11px] bg-stone-100 text-stone-600 rounded-full pl-2 pr-1 py-0.5 inline-flex items-center gap-1">
                        Módulo {e.moduloNumero}
                        {editable && o.examenes.length > 1 && (
                          <button onClick={() => setConfirmacion({ tipo: 'quitar', ordenId: o.id, inscId: e.inscripcionId, modulo: e.moduloNumero })} title="Quitar módulo" className="text-stone-400 hover:text-red-600 text-[13px] leading-none">
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                );
              })()}

              {(o.estado === 'emitida' || o.estado === 'en_revision' || o.estado === 'vencido') && (
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-3">
                  <div className="text-[11px] text-stone-500">La coordinación emitió tu orden de pago. Descárgala y paga ante la Tesorería.</div>
                  {o.tieneOrden ? (
                    <a href={`/api/pagos-examen/${o.id}/orden`} target="_blank" rel="noreferrer"
                      className="flex items-center gap-3 rounded-xl border-2 border-[var(--color-guinda-700)] bg-[var(--color-guinda-50,#faf0f3)] px-4 py-3 hover:bg-[var(--color-guinda-100,#f3dbe4)] transition-colors">
                      <FileText size={22} className="text-[var(--color-guinda-700)] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-[var(--color-guinda-800)]">Ver / descargar orden de pago (PDF)</div>
                        <div className="text-[11px] text-stone-500">Documento oficial de la plataforma del Estado</div>
                      </div>
                      <Download size={18} className="text-[var(--color-guinda-700)] shrink-0" />
                    </a>
                  ) : (
                    <div className="text-xs text-stone-500 bg-white border border-stone-200 rounded-lg p-2.5">La coordinación aún no adjuntó el PDF; usa la línea de captura o el link de pago.</div>
                  )}
                  {o.lineaCaptura && (
                    <div>
                      <div className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide mb-1">Línea de captura</div>
                      <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-lg px-3 py-2">
                        <code className="flex-1 text-sm font-mono text-stone-800 break-all">{o.lineaCaptura}</code>
                        <button onClick={() => { navigator.clipboard.writeText(o.lineaCaptura!); setCopiado(true); setTimeout(() => setCopiado(false), 1500); }} className="text-stone-400 hover:text-[var(--color-guinda-700)] shrink-0">
                          {copiado ? <Check size={15} /> : <Copy size={15} />}
                        </button>
                      </div>
                    </div>
                  )}
                  {o.linkPago && (
                    <a href={o.linkPago} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border border-stone-300 text-stone-700 hover:bg-white">
                      <ExternalLink size={15} /> Pagar en línea
                    </a>
                  )}
                  {o.fechaVencimiento && (
                    <div className="text-xs text-stone-500">Vence el <strong className="text-stone-700">{fmtFecha(o.fechaVencimiento)}</strong>. Paga en banco, tienda de conveniencia o en línea.</div>
                  )}
                  {o.estado === 'vencido' && (
                    <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5 flex gap-2">
                      <AlertCircle size={14} className="shrink-0 mt-0.5" /> Esta orden venció. Solicita a tu gestor o a la coordinación una nueva orden de pago.
                    </div>
                  )}
                </div>
              )}

              {o.estado === 'emitida' && (
                <div className="space-y-2.5">
                  <div className="text-xs font-semibold text-stone-600">¿Ya pagaste? Indica cómo y sube tu comprobante</div>
                  <div className="grid grid-cols-3 gap-2">
                    {METODOS_PAGO.map((m) => (
                      <button key={m.value} onClick={() => setMetodoPorId((s) => ({ ...s, [o.id]: m.value }))}
                        className={`text-left rounded-lg border-2 p-2.5 transition-colors ${metodoPorId[o.id] === m.value ? 'border-[var(--color-guinda-700)] bg-[var(--color-guinda-50,#faf0f3)]' : 'border-stone-200 hover:border-stone-300'}`}>
                        <div className="text-xs font-bold text-stone-800">{m.label}</div>
                      </button>
                    ))}
                  </div>
                  <label className={`flex items-center gap-3 border-2 border-dashed rounded-xl p-3 transition-colors ${!metodoPorId[o.id] ? 'opacity-50 cursor-not-allowed border-stone-200' : subiendo === o.id ? 'opacity-60 border-stone-300' : 'border-stone-300 hover:border-stone-400 cursor-pointer'}`}>
                    {subiendo === o.id ? <Loader2 size={18} className="animate-spin text-stone-400" /> : <UploadCloud size={18} className="text-stone-400" />}
                    <span className="text-sm text-stone-500">{subiendo === o.id ? 'Enviando…' : !metodoPorId[o.id] ? 'Primero elige el método de pago' : 'Seleccionar comprobante (PDF o imagen)'}</span>
                    <input type="file" accept="application/pdf,image/*" className="hidden" disabled={subiendo === o.id || !metodoPorId[o.id]} onChange={(e) => { const f = e.target.files?.[0]; if (f) subirComprobante(o.id, f); }} />
                  </label>
                </div>
              )}

              {o.estado === 'en_revision' && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex gap-2">
                  <Clock size={14} className="shrink-0 mt-0.5" /> Tu comprobante está en revisión. Te avisaremos cuando se confirme el pago.
                </div>
              )}
              {o.motivoRechazo && o.estado === 'emitida' && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5 flex gap-2">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" /> Tu comprobante anterior fue rechazado: {o.motivoRechazo}
                </div>
              )}
              {o.estado === 'pagado' && (
                <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3 flex gap-2">
                  <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> Pago confirmado{o.fechaPago ? ` el ${fmtFecha(o.fechaPago)}` : ''}. ¡Listo para tu examen!
                </div>
              )}
              {o.estado === 'pendiente_emision' && (
                <div className="text-xs text-stone-500 bg-stone-50 border border-stone-200 rounded-lg p-2.5 flex gap-2">
                  <Clock size={14} className="shrink-0 mt-0.5" /> La coordinación está generando tu orden de pago ante la Tesorería. Vuelve pronto.
                </div>
              )}

              {(o.estado === 'pendiente_emision' || o.estado === 'emitida') && (
                <div className="pt-1 flex items-center justify-between gap-2">
                  <button onClick={() => setConfirmacion({ tipo: 'cancelar', ordenId: o.id })} className="text-xs font-semibold text-red-600 hover:underline">
                    Cancelar orden
                  </button>
                  {o.estado === 'emitida' && (
                    <span className="text-[11px] text-stone-400">Editar/quitar un módulo requiere re-emisión de la coordinación.</span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Popup de confirmación (reemplaza el confirm() del navegador) */}
      {confirmacion && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={() => !ejecutando && setConfirmacion(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5">
              <div className="w-11 h-11 rounded-full bg-red-50 flex items-center justify-center mb-3">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <h3 className="text-base font-bold text-stone-900">
                {confirmacion.tipo === 'cancelar' ? 'Cancelar orden de pago' : `Quitar el Módulo ${confirmacion.modulo}`}
              </h3>
              <p className="text-sm text-stone-500 mt-1 leading-relaxed">
                {confirmacion.tipo === 'cancelar'
                  ? 'Se cancelará esta orden de pago. Podrás solicitarla de nuevo cuando quieras.'
                  : 'Se quitará este módulo de tu orden de pago. Podrás volver a agregarlo solicitando la orden de nuevo.'}
              </p>
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button
                onClick={() => setConfirmacion(null)}
                disabled={ejecutando}
                className="flex-1 py-2.5 rounded-lg border border-stone-300 text-stone-700 text-sm font-semibold hover:bg-stone-50 transition-colors disabled:opacity-50"
              >
                No, conservar
              </button>
              <button
                onClick={ejecutarConfirmacion}
                disabled={ejecutando}
                className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {ejecutando ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                {confirmacion.tipo === 'cancelar' ? 'Sí, cancelar' : 'Sí, quitar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
