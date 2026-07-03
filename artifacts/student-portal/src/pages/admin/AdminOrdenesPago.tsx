/**
 * Órdenes de pago de examen (admin / enlace de tesorería).
 *
 * EDUMICH no cobra ni genera líneas de captura: aquí el enlace CARGA la orden de
 * pago (línea de captura + PDF + vencimiento) que emitió la plataforma del Estado,
 * y CONCILIA los pagos (marca 'pagado' solo tras verificar). Incluye el reporte
 * interno del desglose $115 IEMSyS / $30 Synapsis.
 */
import { useEffect, useState } from 'react';
import {
  Landmark, Plus, Search, Loader2, ChevronLeft, FileUp, CheckCircle2,
  XCircle, Ban, Copy, Check, Download, BarChart3, Clock, AlertCircle, ClipboardList, X,
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { ContabilidadExamenesPanel } from './AdminContabilidadExamenes';
import { api, type PagoExamenAdmin, type PagoExamenEstado, type PagoExamenCandidato, type PagoExamenDesglose } from '../../lib/api';

const FILTROS: { key: string; label: string }[] = [
  { key: '', label: 'Todas' },
  { key: 'pendiente_emision', label: 'Por emitir' },
  { key: 'emitida', label: 'Emitidas' },
  { key: 'en_revision', label: 'Comprobante en revisión' },
  { key: 'pagado', label: 'Pagadas' },
  { key: 'vencido', label: 'Vencidas' },
  { key: 'cancelado', label: 'Canceladas' },
];

const ESTADO_CFG: Record<PagoExamenEstado, { label: string; bg: string; color: string }> = {
  pendiente_emision: { label: 'Por emitir', bg: '#fff7ed', color: '#b45309' },
  emitida: { label: 'Emitida — por pagar', bg: '#eff6ff', color: '#1d4ed8' },
  en_revision: { label: 'Comprobante en revisión', bg: '#fefce8', color: '#a16207' },
  pagado: { label: 'Pagado', bg: '#f0fdf4', color: '#15803d' },
  vencido: { label: 'Vencido', bg: '#fef2f2', color: '#b91c1c' },
  cancelado: { label: 'Cancelado', bg: '#f5f5f4', color: '#78716c' },
};

const fmtMoney = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
const fmtFecha = (iso: string | null) =>
  iso ? new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

function EstadoChip({ estado }: { estado: PagoExamenEstado }) {
  const c = ESTADO_CFG[estado];
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: c.bg, color: c.color }}>
      {c.label}
    </span>
  );
}

export default function AdminOrdenesPago() {
  const [seccion, setSeccion] = useState<'ordenes' | 'contabilidad'>('ordenes');
  const [filtro, setFiltro] = useState('');
  const [gestorId, setGestorId] = useState('');
  const [etapaId, setEtapaId] = useState('');
  const [q, setQ] = useState('');
  const [pagos, setPagos] = useState<PagoExamenAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<number | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [reporte, setReporte] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [gestores, setGestores] = useState<{ id: number; nombreCompleto: string }[]>([]);
  const [etapas, setEtapas] = useState<{ id: number; etapa: string; fase: string; anio: number }[]>([]);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  function cargar(over?: { estado?: string; gestorId?: string; etapaId?: string; q?: string }) {
    const est = over?.estado ?? filtro;
    const gid = over?.gestorId ?? gestorId;
    const eid = over?.etapaId ?? etapaId;
    const query = over?.q ?? q;
    const params = new URLSearchParams();
    if (est) params.set('estado', est);
    if (gid) params.set('gestorId', gid);
    if (eid) params.set('etapaId', eid);
    if (query.trim()) params.set('q', query.trim());
    setLoading(true);
    return api
      .get<{ pagos: PagoExamenAdmin[] }>(`/pagos-examen${params.toString() ? `?${params}` : ''}`)
      .then((r) => setPagos(r.pagos))
      .catch(() => showToast('Error al cargar', false))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    cargar();
    api.get<{ gestores: { id: number; nombreCompleto: string }[] }>('/admin/gestores-list').then((r) => setGestores(r.gestores)).catch(() => {});
    api.get<{ etapas: { id: number; etapa: string; fase: string; anio: number }[] }>('/admin/etapas').then((r) => setEtapas(r.etapas)).catch(() => {});
    /* eslint-disable-next-line */
  }, []);

  return (
    <AdminLayout>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${toast.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.msg}
        </div>
      )}

      {sel !== null ? (
        <Detalle id={sel} onBack={() => { setSel(null); cargar(); }} onToast={showToast} />
      ) : nuevo ? (
        <NuevaOrden onBack={() => setNuevo(false)} onCreada={(id) => { setNuevo(false); cargar().then(() => setSel(id)); }} onToast={showToast} />
      ) : reporte ? (
        <ReporteDesglose onBack={() => setReporte(false)} />
      ) : (
        <>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-[var(--color-guinda-700)] font-semibold mb-1">Tesorería del Estado</div>
              <h1 className="font-serif text-3xl font-bold text-stone-900">Pagos</h1>
            </div>
            {seccion === 'ordenes' && (
              <div className="flex gap-2 shrink-0">
                <button onClick={() => setReporte(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50">
                  <BarChart3 size={15} /> Desglose
                </button>
                <button onClick={() => setNuevo(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-lg bg-[var(--color-guinda-700)] text-white hover:bg-[var(--color-guinda-800)]">
                  <Plus size={15} /> Nueva orden
                </button>
              </div>
            )}
          </div>

          {/* Tabs internos */}
          <div className="flex border-b-2 border-stone-200 mb-5 gap-0.5">
            {([['ordenes', 'Órdenes de pago', Landmark], ['contabilidad', 'Contabilidad de exámenes', ClipboardList]] as const).map(([key, label, Icon]) => {
              const active = seccion === key;
              return (
                <button key={key} onClick={() => setSeccion(key)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${active ? 'text-[var(--color-guinda-700)] border-[var(--color-guinda-700)]' : 'text-stone-500 border-transparent hover:text-stone-700'}`}>
                  <Icon size={15} /> {label}
                </button>
              );
            })}
          </div>

          {seccion === 'contabilidad' ? (
            <ContabilidadExamenesPanel />
          ) : (
          <>
          {/* Filtros profesionales */}
          <div className="bg-white border border-stone-200 rounded-xl p-3 mb-4 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && cargar()}
                placeholder="Buscar por alumno, folio, matrícula o gestor…" className="w-full text-sm border border-stone-300 rounded-lg pl-9 pr-3 py-2" />
            </div>
            <select value={gestorId} onChange={(e) => { setGestorId(e.target.value); cargar({ gestorId: e.target.value }); }}
              className="text-sm border border-stone-300 rounded-lg px-3 py-2 bg-white max-w-[200px]">
              <option value="">Todos los gestores</option>
              {gestores.map((g) => <option key={g.id} value={g.id}>{g.nombreCompleto}</option>)}
            </select>
            <select value={etapaId} onChange={(e) => { setEtapaId(e.target.value); cargar({ etapaId: e.target.value }); }}
              className="text-sm border border-stone-300 rounded-lg px-3 py-2 bg-white">
              <option value="">Todas las etapas</option>
              {etapas.map((et) => <option key={et.id} value={et.id}>{et.etapa} {et.fase} · {et.anio}</option>)}
            </select>
            <button onClick={() => cargar()} className="text-sm font-semibold px-3 py-2 rounded-lg bg-stone-100 text-stone-700 hover:bg-stone-200">Buscar</button>
            {(q || gestorId || etapaId || filtro) && (
              <button onClick={() => { setQ(''); setGestorId(''); setEtapaId(''); setFiltro(''); cargar({ estado: '', gestorId: '', etapaId: '', q: '' }); }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-stone-700 px-2">
                <X size={13} /> Limpiar
              </button>
            )}
          </div>

          {/* Chips de estado */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {FILTROS.map((f) => (
              <button key={f.key} onClick={() => { setFiltro(f.key); cargar({ estado: f.key }); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${filtro === f.key ? 'bg-[var(--color-guinda-700)] text-white border-[var(--color-guinda-700)]' : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'}`}>
                {f.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-center text-stone-400 py-16 text-sm">Cargando…</div>
          ) : pagos.length === 0 ? (
            <div className="border-2 border-dashed border-stone-200 rounded-xl p-12 text-center">
              <Landmark size={30} className="mx-auto text-stone-300 mb-3" />
              <div className="font-bold text-stone-900 mb-1">Sin órdenes con estos filtros</div>
            </div>
          ) : (
            <div className="bg-white border border-stone-200 rounded-xl overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead className="bg-[var(--color-crema-100)] border-b border-stone-200 text-left text-xs uppercase tracking-widest text-stone-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Folio</th>
                    <th className="px-4 py-3 font-semibold">Alumno</th>
                    <th className="px-4 py-3 font-semibold">Solicitante</th>
                    <th className="px-4 py-3 font-semibold text-center">Exám.</th>
                    <th className="px-4 py-3 font-semibold text-right">Total</th>
                    <th className="px-4 py-3 font-semibold">Estado</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {pagos.map((p) => (
                    <tr key={p.id} onClick={() => setSel(p.id)} className="border-b border-stone-100 last:border-0 hover:bg-[var(--color-crema-50)] cursor-pointer">
                      <td className="px-4 py-3 font-mono text-xs text-stone-600">{p.folio ?? `#${p.id}`}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-stone-900">{p.alumno ?? `#${p.estudianteId}`}</div>
                        <div className="text-[11px] text-stone-400 font-mono">{p.matricula || p.curp || '—'}{p.etapaClave ? ` · ${p.etapaClave}` : ''}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-stone-600">{p.solicitante ?? (p.gestor ? `Gestor · ${p.gestor}` : 'Alumno')}</td>
                      <td className="px-4 py-3 text-center text-stone-700">{p.cantidadExamenes}</td>
                      <td className="px-4 py-3 text-right font-bold text-stone-800">{fmtMoney(p.montoTotal)}</td>
                      <td className="px-4 py-3"><EstadoChip estado={p.estado} /></td>
                      <td className="px-2 text-stone-300">›</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </>
          )}
        </>
      )}
    </AdminLayout>
  );
}

// ─── Stepper del proceso (mismo que ve el gestor) ──────────────────────────
function PagoStepper({ estado }: { estado: PagoExamenEstado }) {
  const pasos = ['Solicitada', 'Emisión', 'Pago', 'Confirmado'];
  const idx = estado === 'pendiente_emision' ? 0 : estado === 'emitida' ? 1 : estado === 'en_revision' ? 2 : estado === 'pagado' ? 3 : 1;
  const cancelado = estado === 'cancelado' || estado === 'vencido';
  return (
    <div className="bg-white border border-stone-200 rounded-xl px-5 py-4 mb-4">
      <div className="flex items-center">
        {pasos.map((label, i) => {
          const done = !cancelado && i < idx;
          const active = !cancelado && i === idx;
          return (
            <div key={label} className="flex items-center" style={{ flex: i < pasos.length - 1 ? 1 : '0 0 auto' }}>
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                  done ? 'bg-[var(--color-guinda-700)] border-[var(--color-guinda-700)] text-white'
                  : active ? 'border-[var(--color-guinda-700)] text-[var(--color-guinda-700)] bg-white'
                  : 'border-stone-200 text-stone-300 bg-white'}`}>
                  {done ? <Check size={14} /> : active ? <span className="w-2 h-2 rounded-full bg-[var(--color-guinda-700)] animate-pulse" /> : i + 1}
                </span>
                <span className={`text-[10px] font-semibold uppercase tracking-wide ${active ? 'text-[var(--color-guinda-700)]' : done ? 'text-stone-600' : 'text-stone-300'}`}>{label}</span>
              </div>
              {i < pasos.length - 1 && <div className="flex-1 h-0.5 mx-1 -mt-4 rounded-full" style={{ background: done ? 'var(--color-guinda-700)' : '#e7e0d9' }} />}
            </div>
          );
        })}
      </div>
      {cancelado && <div className="text-[11px] text-red-600 font-semibold mt-2 text-center">{estado === 'vencido' ? 'Orden vencida — requiere re-emisión.' : 'Orden cancelada.'}</div>}
    </div>
  );
}

// ─── Detalle + acciones ────────────────────────────────────────────────────
function Detalle({ id, onBack, onToast }: { id: number; onBack: () => void; onToast: (m: string, ok?: boolean) => void }) {
  const [p, setP] = useState<PagoExamenAdmin | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copiado, setCopiado] = useState(false);

  // Form emitir
  const [linea, setLinea] = useState('');
  const [venc, setVenc] = useState('');
  const [link, setLink] = useState('');
  const [orden, setOrden] = useState<File | null>(null);
  const [notas, setNotas] = useState('');

  function cargar() {
    setLoading(true);
    return api.get<PagoExamenAdmin>(`/pagos-examen/${id}/detalle`)
      .then((d) => { setP(d); setLinea(d.lineaCaptura ?? ''); setVenc(d.fechaVencimiento ?? d.vencimientoSugerido ?? ''); setLink(d.linkPago ?? ''); setNotas(d.notas ?? ''); })
      .catch(() => onToast('Error al cargar', false))
      .finally(() => setLoading(false));
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [id]);

  async function emitir() {
    if (!linea && !orden && !link) { onToast('Captura la línea de captura o la orden', false); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      if (linea) fd.append('lineaCaptura', linea);
      if (venc) fd.append('fechaVencimiento', venc);
      if (link) fd.append('linkPago', link);
      if (orden) fd.append('orden', orden);
      await api.post(`/pagos-examen/${id}/emitir`, fd);
      onToast('Orden emitida');
      cargar();
    } catch (e) { onToast(e instanceof Error ? e.message : 'Error', false); } finally { setBusy(false); }
  }

  async function accion(path: string, ok: string, body?: unknown) {
    setBusy(true);
    try { await api.post(`/pagos-examen/${id}/${path}`, body ?? {}); onToast(ok); cargar(); }
    catch (e) { onToast(e instanceof Error ? e.message : 'Error', false); } finally { setBusy(false); }
  }

  if (loading || !p) return <div className="text-center text-stone-400 py-16 text-sm">Cargando…</div>;

  return (
    <>
      <button onClick={onBack} className="text-sm text-stone-600 hover:text-[var(--color-guinda-700)] inline-flex items-center gap-1.5 mb-5">
        <ChevronLeft size={15} /> Volver a órdenes
      </button>

      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-stone-900">{p.alumno ?? `Alumno #${p.estudianteId}`}</h1>
          <div className="text-xs text-stone-500 font-mono mt-0.5">Ref: {p.matricula || p.curp || '—'}</div>
        </div>
        <EstadoChip estado={p.estado} />
      </div>

      <PagoStepper estado={p.estado} />

      <div className="grid md:grid-cols-3 gap-4">
        {/* Columna izq: datos + exámenes */}
        <div className="md:col-span-2 space-y-4">
          <div className="bg-white border border-stone-200 rounded-xl p-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Dato label="Concepto" val="Derecho de examen" />
              <Dato label="Exámenes" val={String(p.cantidadExamenes)} />
              <Dato label="Total (alumno ve)" val={fmtMoney(p.montoTotal)} />
              <Dato label="Vencimiento" val={fmtFecha(p.fechaVencimiento)} />
            </div>
            {/* Split interno — solo admin */}
            <div className="mt-3 pt-3 border-t border-dashed border-stone-200 grid grid-cols-2 gap-3 text-sm">
              <Dato label="IEMSyS (interno)" val={fmtMoney(p.montoIemsys)} />
              <Dato label="Synapsis (interno)" val={fmtMoney(p.montoSynapsis)} />
            </div>
          </div>

          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-[var(--color-crema-100)] border-b border-stone-200 text-xs font-bold uppercase tracking-wide text-stone-600">
              Exámenes cubiertos
            </div>
            <div className="divide-y divide-stone-100">
              {p.examenes.map((e) => (
                <div key={e.inscripcionId} className="px-4 py-2.5 flex items-center justify-between text-sm">
                  <span className="text-stone-800">Módulo {e.moduloNumero} — {e.moduloNombre}</span>
                  <span className="font-mono text-[11px] text-stone-400">{e.folio}</span>
                </div>
              ))}
            </div>
          </div>

          {p.tieneComprobante && (
            <a href={`/api/pagos-examen/${id}/comprobante`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-guinda-700)] hover:underline">
              <Download size={15} /> Ver comprobante del alumno
            </a>
          )}
        </div>

        {/* Columna der: acciones según estado */}
        <div className="space-y-4">
          {(p.estado === 'pendiente_emision' || p.estado === 'emitida' || p.estado === 'vencido') && (
            <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-3">
              <div className="text-sm font-bold text-stone-800">
                {p.estado === 'pendiente_emision' ? 'Cargar orden de pago' : 'Actualizar orden'}
              </div>
              <p className="text-[11px] text-stone-500 leading-snug -mt-1">
                Captura la línea de captura y sube la orden de pago que emitió la plataforma del Estado.
              </p>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">Línea de captura</label>
                <input value={linea} onChange={(e) => setLinea(e.target.value)} placeholder="3XXXXXXXXXXXXXXXXXXX" className="w-full text-sm border border-stone-300 rounded-lg px-3 py-2 font-mono" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">Vence</label>
                <input type="date" value={venc} onChange={(e) => setVenc(e.target.value)} className="w-full text-sm border border-stone-300 rounded-lg px-3 py-2" />
                {p.fechaExamen && (
                  <p className="text-[11px] text-stone-500 mt-1">
                    Regla: 1 semana antes del examen ({fmtFecha(p.fechaExamen)}).
                    {p.vencimientoSugerido && venc !== p.vencimientoSugerido && (
                      <button type="button" onClick={() => setVenc(p.vencimientoSugerido!)} className="ml-1 text-[var(--color-guinda-700)] font-semibold hover:underline">
                        Usar {fmtFecha(p.vencimientoSugerido)}
                      </button>
                    )}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">Link de pago (opcional)</label>
                <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" className="w-full text-sm border border-stone-300 rounded-lg px-3 py-2" />
              </div>
              <label className={`flex items-center gap-2 border-2 border-dashed rounded-lg p-3 cursor-pointer text-sm ${orden ? 'border-[var(--color-guinda-700)] bg-[var(--color-guinda-50,#faf0f3)] text-[var(--color-guinda-700)]' : 'border-stone-300 text-stone-500'}`}>
                <FileUp size={16} />
                <span className="truncate flex-1">{orden ? orden.name : 'Orden de pago (PDF)'}</span>
                <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => setOrden(e.target.files?.[0] ?? null)} />
              </label>
              <button onClick={emitir} disabled={busy} className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-[var(--color-guinda-700)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--color-guinda-800)] disabled:opacity-50">
                {busy ? <Loader2 size={15} className="animate-spin" /> : <FileUp size={15} />} Emitir orden
              </button>
            </div>
          )}

          {p.lineaCaptura && (
            <div className="bg-white border border-stone-200 rounded-xl p-4">
              <div className="text-xs font-semibold text-stone-600 mb-1">Línea de captura</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm font-mono text-stone-800 break-all">{p.lineaCaptura}</code>
                <button onClick={() => { navigator.clipboard.writeText(p.lineaCaptura!); setCopiado(true); setTimeout(() => setCopiado(false), 1500); }} className="text-stone-400 hover:text-[var(--color-guinda-700)]">
                  {copiado ? <Check size={15} /> : <Copy size={15} />}
                </button>
              </div>
              {p.tieneOrden && (
                <a href={`/api/pagos-examen/${id}/orden`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-guinda-700)] hover:underline">
                  <Download size={13} /> Descargar orden (PDF)
                </a>
              )}
            </div>
          )}

          {/* Comprobante en revisión: validar = pagar */}
          {p.estado === 'en_revision' && (
            <div className="bg-white border-2 border-[var(--color-guinda-200,#e8c4d4)] rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-stone-800">
                <Clock size={15} className="text-amber-600" /> Comprobante por validar
              </div>
              <p className="text-[11px] text-stone-500 -mt-1">El gestor/alumno subió su comprobante. Revísalo: al validarlo, la orden se marca pagada automáticamente.</p>
              {p.tieneComprobante && (
                <a href={`/api/pagos-examen/${id}/comprobante`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50 w-full justify-center">
                  <Download size={15} /> Ver comprobante
                </a>
              )}
            </div>
          )}

          {/* Esperando comprobante */}
          {p.estado === 'emitida' && !p.tieneComprobante && (
            <div className="text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2">
              <Clock size={14} className="shrink-0 mt-0.5 text-blue-500" />
              <span>Orden emitida. Esperando que el gestor/alumno pague y suba su comprobante. También puedes marcarla pagada directamente si concilias contra la plataforma del Estado.</span>
            </div>
          )}

          {/* Conciliar (validar) / rechazar */}
          {(p.estado === 'emitida' || p.estado === 'en_revision') && (
            <div className="space-y-2 bg-white border border-stone-200 rounded-xl p-4">
              <label className="block text-xs font-semibold text-stone-600 mb-1">Notas (opcional)</label>
              <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} placeholder="Referencia bancaria, observación de conciliación…" className="w-full text-sm border border-stone-300 rounded-lg px-3 py-2 resize-none" />
              <button onClick={() => accion('conciliar', 'Pago conciliado', { notas })} disabled={busy} className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50">
                <CheckCircle2 size={15} /> {p.estado === 'en_revision' ? 'Validar comprobante y marcar pagado' : 'Marcar pagado (conciliar)'}
              </button>
              {p.estado === 'en_revision' && (
                <button onClick={() => { const m = prompt('Motivo del rechazo del comprobante:') ?? undefined; if (m !== undefined) accion('rechazar-comprobante', 'Comprobante rechazado', { motivo: m }); }} disabled={busy} className="w-full inline-flex items-center justify-center gap-2 py-2 border border-amber-300 text-amber-700 text-sm font-semibold rounded-lg hover:bg-amber-50 disabled:opacity-50">
                  <XCircle size={15} /> Rechazar comprobante
                </button>
              )}
            </div>
          )}
          {p.estado !== 'pagado' && p.estado !== 'cancelado' && (
            <button onClick={() => { if (confirm('¿Cancelar esta orden de pago?')) accion('cancelar', 'Orden cancelada'); }} disabled={busy} className="w-full inline-flex items-center justify-center gap-2 py-2 border border-stone-300 text-stone-600 text-sm font-semibold rounded-lg hover:bg-stone-50 disabled:opacity-50">
              <Ban size={14} /> Cancelar orden
            </button>
          )}

          {p.motivoRechazo && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex gap-2">
              <AlertCircle size={14} className="shrink-0 mt-0.5" /> {p.motivoRechazo}
            </div>
          )}
          {p.estado === 'pagado' && (
            <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg p-2.5 space-y-1">
              <div className="flex gap-2"><CheckCircle2 size={14} className="shrink-0 mt-0.5" /> Conciliado el {fmtFecha(p.fechaPago)}. Alumno inscrito oficialmente.</div>
              {p.notas && <div className="text-stone-600 pl-6"><strong>Notas:</strong> {p.notas}</div>}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Dato({ label, val }: { label: string; val: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-stone-400 font-semibold">{label}</div>
      <div className="text-stone-800 font-medium">{val}</div>
    </div>
  );
}

// ─── Nueva orden ───────────────────────────────────────────────────────────
function NuevaOrden({ onBack, onCreada, onToast }: { onBack: () => void; onCreada: (id: number) => void; onToast: (m: string, ok?: boolean) => void }) {
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState<{ id: number; nombreCompleto: string; curp: string | null }[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [alumno, setAlumno] = useState<{ id: number; nombreCompleto: string } | null>(null);
  const [candidatos, setCandidatos] = useState<PagoExamenCandidato[]>([]);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [creando, setCreando] = useState(false);

  async function buscar() {
    if (q.trim().length < 2) return;
    setBuscando(true);
    try {
      const r = await api.get<{ alumnos: { id: number; nombreCompleto: string; curp: string | null }[] }>(`/admin/alumnos?search=${encodeURIComponent(q.trim())}&limit=10`);
      setResultados(r.alumnos);
    } catch { onToast('Error al buscar', false); } finally { setBuscando(false); }
  }

  async function elegir(a: { id: number; nombreCompleto: string }) {
    setAlumno(a); setResultados([]); setSel(new Set());
    try {
      const r = await api.get<{ examenes: PagoExamenCandidato[] }>(`/pagos-examen/candidatos/${a.id}`);
      setCandidatos(r.examenes);
      setSel(new Set(r.examenes.map((e) => e.id)));
    } catch { onToast('Error al cargar exámenes', false); }
  }

  async function crear() {
    if (!alumno || sel.size === 0) return;
    setCreando(true);
    try {
      const r = await api.post<{ id: number }>('/pagos-examen', { estudianteId: alumno.id, examenInscripcionIds: [...sel] });
      onToast('Orden creada'); onCreada(r.id);
    } catch (e) { onToast(e instanceof Error ? e.message : 'Error', false); } finally { setCreando(false); }
  }

  return (
    <>
      <button onClick={onBack} className="text-sm text-stone-600 hover:text-[var(--color-guinda-700)] inline-flex items-center gap-1.5 mb-5">
        <ChevronLeft size={15} /> Volver a órdenes
      </button>
      <h1 className="font-serif text-2xl font-bold text-stone-900 mb-4">Nueva orden de pago</h1>

      {!alumno ? (
        <div className="bg-white border border-stone-200 rounded-xl p-4 max-w-lg">
          <label className="block text-xs font-semibold text-stone-600 mb-1.5">Busca al alumno (nombre, CURP o matrícula)</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && buscar()} placeholder="Nombre o CURP…" className="w-full text-sm border border-stone-300 rounded-lg pl-9 pr-3 py-2" />
            </div>
            <button onClick={buscar} disabled={buscando} className="px-4 py-2 bg-[var(--color-guinda-700)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--color-guinda-800)] disabled:opacity-50">
              {buscando ? <Loader2 size={15} className="animate-spin" /> : 'Buscar'}
            </button>
          </div>
          <div className="mt-3 divide-y divide-stone-100">
            {resultados.map((a) => (
              <button key={a.id} onClick={() => elegir(a)} className="w-full text-left px-2 py-2.5 hover:bg-stone-50 rounded-lg">
                <div className="text-sm font-medium text-stone-800">{a.nombreCompleto}</div>
                <div className="text-xs text-stone-400 font-mono">{a.curp ?? '—'}</div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="max-w-lg space-y-4">
          <div className="bg-white border border-stone-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-stone-900">{alumno.nombreCompleto}</div>
              <div className="text-xs text-stone-400">Alumno seleccionado</div>
            </div>
            <button onClick={() => { setAlumno(null); setCandidatos([]); }} className="text-xs text-[var(--color-guinda-700)] font-semibold hover:underline">Cambiar</button>
          </div>

          {candidatos.length === 0 ? (
            <div className="border-2 border-dashed border-stone-200 rounded-xl p-8 text-center text-sm text-stone-500">
              Este alumno no tiene exámenes pendientes de orden de pago.
            </div>
          ) : (
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-[var(--color-crema-100)] border-b border-stone-200 text-xs font-bold uppercase tracking-wide text-stone-600">
                Exámenes a cubrir ($145 c/u)
              </div>
              <div className="divide-y divide-stone-100">
                {candidatos.map((c) => {
                  const on = sel.has(c.id);
                  return (
                    <label key={c.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-stone-50 cursor-pointer">
                      <input type="checkbox" checked={on} onChange={() => setSel((s) => { const n = new Set(s); on ? n.delete(c.id) : n.add(c.id); return n; })} className="w-4 h-4 accent-[var(--color-guinda-700)]" />
                      <span className="flex-1 text-sm text-stone-800">Módulo {c.moduloNumero} — {c.moduloNombre}</span>
                      <span className="font-mono text-[11px] text-stone-400">{c.folio}</span>
                    </label>
                  );
                })}
              </div>
              <div className="px-4 py-3 bg-stone-50 border-t border-stone-200 flex items-center justify-between">
                <span className="text-sm text-stone-600">{sel.size} × $145 = <strong className="text-stone-900">{fmtMoney(sel.size * 145)}</strong></span>
                <button onClick={crear} disabled={creando || sel.size === 0} className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-guinda-700)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--color-guinda-800)] disabled:opacity-50">
                  {creando ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Crear orden
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ─── Reporte de desglose ───────────────────────────────────────────────────
function ReporteDesglose({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<PagoExamenDesglose | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get<PagoExamenDesglose>('/pagos-examen/reportes/desglose').then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <>
      <button onClick={onBack} className="text-sm text-stone-600 hover:text-[var(--color-guinda-700)] inline-flex items-center gap-1.5 mb-5">
        <ChevronLeft size={15} /> Volver a órdenes
      </button>
      <h1 className="font-serif text-2xl font-bold text-stone-900 mb-1">Desglose de ingresos</h1>
      <p className="text-stone-500 text-sm mb-5">Solo órdenes conciliadas (pagadas). Split interno $115 IEMSyS / $30 Synapsis.</p>

      {loading || !data ? (
        <div className="text-center text-stone-400 py-16 text-sm">Cargando…</div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Tarjeta label="Órdenes pagadas" val={String(data.totales.pagos)} />
            <Tarjeta label="Total recaudado" val={fmtMoney(data.totales.total)} destacado />
            <Tarjeta label="IEMSyS" val={fmtMoney(data.totales.iemsys)} />
            <Tarjeta label="Synapsis" val={fmtMoney(data.totales.synapsis)} />
          </div>

          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-[var(--color-crema-100)] border-b border-stone-200 text-xs font-bold uppercase tracking-wide text-stone-600">Por municipio</div>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-stone-500 border-b border-stone-100">
                <tr>
                  <th className="px-4 py-2 font-semibold">Municipio</th>
                  <th className="px-4 py-2 font-semibold text-center">Pagos</th>
                  <th className="px-4 py-2 font-semibold text-right">Total</th>
                  <th className="px-4 py-2 font-semibold text-right">IEMSyS</th>
                  <th className="px-4 py-2 font-semibold text-right">Synapsis</th>
                </tr>
              </thead>
              <tbody>
                {data.porMunicipio.map((m) => (
                  <tr key={m.municipio} className="border-b border-stone-100 last:border-0">
                    <td className="px-4 py-2.5 text-stone-800">{m.municipio}</td>
                    <td className="px-4 py-2.5 text-center text-stone-600">{m.pagos}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-stone-800">{fmtMoney(m.total)}</td>
                    <td className="px-4 py-2.5 text-right text-stone-600">{fmtMoney(m.iemsys)}</td>
                    <td className="px-4 py-2.5 text-right text-stone-600">{fmtMoney(m.synapsis)}</td>
                  </tr>
                ))}
                {data.porMunicipio.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-stone-400 text-sm">Aún no hay pagos conciliados.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

function Tarjeta({ label, val, destacado }: { label: string; val: string; destacado?: boolean }) {
  return (
    <div className={`rounded-xl p-4 border ${destacado ? 'bg-[var(--color-guinda-700)] text-white border-[var(--color-guinda-700)]' : 'bg-white border-stone-200'}`}>
      <div className={`text-[10px] uppercase tracking-wide font-semibold mb-1 ${destacado ? 'text-white/80' : 'text-stone-400'}`}>{label}</div>
      <div className={`text-xl font-bold ${destacado ? 'text-white' : 'text-stone-900'}`}>{val}</div>
    </div>
  );
}
