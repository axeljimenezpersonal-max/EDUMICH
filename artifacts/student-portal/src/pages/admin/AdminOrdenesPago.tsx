/**
 * Órdenes de pago de examen (admin / enlace de tesorería).
 *
 * EDUMICH no cobra ni genera líneas de captura: aquí el enlace CARGA la orden de
 * pago (línea de captura + PDF + vencimiento) que emitió la plataforma del Estado,
 * y CONCILIA los pagos (marca 'pagado' solo tras verificar). Incluye el reporte
 * de ingresos por examen (órdenes conciliadas).
 */
import { useEffect, useState } from 'react';
import {
  Landmark, Plus, Search, Loader2, ChevronLeft, FileUp, CheckCircle2,
  XCircle, Ban, Copy, Check, Download, BarChart3, Clock, AlertCircle, ClipboardList, X,
  Lock, Pencil, ExternalLink, FileText,
} from 'lucide-react';
import { Link } from 'wouter';
import { AdminLayout } from './AdminLayout';
import { SectionTour } from '../../components/onboarding/SectionTour';
import { TOUR_A_PAGOS, GATE_ADMIN } from '../../components/onboarding/seccionesAdmin';
import { SoloEscritorio, SoloMovil, ListaCards, FilaCard, DatoCard } from '../../components/ui/responsive';
import { ContabilidadExamenesPanel } from './AdminContabilidadExamenes';
import { ConfirmModal } from '../../components/ConfirmModal';
import { PagoStepper } from '../../components/PagoStepper';
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

// ─── Agrupación de exámenes por alumno (para "Alumnos involucrados") ──────────
type GrupoAlumno = {
  estudianteId: number | null;
  nombre: string;
  matricula: string | null;
  examenes: PagoExamenAdmin['examenes'];
};
function agruparPorAlumno(examenes: PagoExamenAdmin['examenes']): GrupoAlumno[] {
  const mapa = new Map<string, GrupoAlumno>();
  for (const e of examenes) {
    const key = e.estudianteId != null ? `id:${e.estudianteId}` : `n:${e.alumno ?? 'Alumno'}`;
    let g = mapa.get(key);
    if (!g) {
      g = { estudianteId: e.estudianteId ?? null, nombre: e.alumno ?? 'Alumno', matricula: e.matricula ?? null, examenes: [] };
      mapa.set(key, g);
    }
    g.examenes.push(e);
  }
  return [...mapa.values()];
}
const nAlumnos = (p: PagoExamenAdmin) => agruparPorAlumno(p.examenes).length;
const esGrupal = (p: PagoExamenAdmin) => nAlumnos(p) > 1;

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
  const [filtro, setFiltro] = useState(() => new URLSearchParams(window.location.search).get('estado') || '');
  const [gestorId, setGestorId] = useState('');
  const [etapaId, setEtapaId] = useState('');
  const [q, setQ] = useState('');
  const [pagos, setPagos] = useState<PagoExamenAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<number | null>(() => {
    const q = new URLSearchParams(window.location.search).get('orden');
    return q ? Number(q) || null : null;
  });
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
          <div data-tour="a-pag-tabs" className="flex border-b-2 border-stone-200 mb-5 gap-0.5">
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
          <div data-tour="a-pag-filtros" className="bg-white border border-stone-200 rounded-xl p-3 mb-4 flex flex-wrap items-center gap-2">
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
            <div data-tour="a-pag-tabla">
            {/* Teléfono: tarjetas; tablet/escritorio: la tabla completa. */}
            <SoloMovil>
              <ListaCards>
                {pagos.map((p) => (
                  <FilaCard
                    key={p.id}
                    onClick={() => setSel(p.id)}
                    titulo={p.alumno ?? `#${p.estudianteId}`}
                    sub={<span className="font-mono">{p.folio ?? `#${p.id}`}{p.etapaClave ? ` · ${p.etapaClave}` : ''}</span>}
                    derecha={<EstadoChip estado={p.estado} />}
                    datos={
                      <>
                        <DatoCard label="Total"><span className="text-base font-bold text-stone-900">{fmtMoney(p.montoTotal)}</span></DatoCard>
                        <DatoCard label="Exámenes" mono>{p.cantidadExamenes}</DatoCard>
                      </>
                    }
                    pie={<span className="text-xs text-stone-500">Solicitó: {p.solicitante ?? (p.gestor ? `Gestor · ${p.gestor}` : 'Alumno')}</span>}
                  />
                ))}
              </ListaCards>
            </SoloMovil>
            <SoloEscritorio>
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
            </SoloEscritorio>
            </div>
          )}
          </>
          )}
        </>
      )}

      <SectionTour
        steps={TOUR_A_PAGOS}
        storageKey="edumich_sec_a_pagos_v1"
        gateKey={GATE_ADMIN}
        buttonLabel="Tutorial de pagos"
      />
    </AdminLayout>
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
  const [editando, setEditando] = useState(false);
  const [modal, setModal] = useState<null | 'editar' | 'cancelar' | 'rechazar'>(null);

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
      onToast(editando ? 'Orden actualizada' : 'Orden emitida');
      setEditando(false);
      setOrden(null);
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

      {/* Folio de la orden — protagonista arriba */}
      <div className="rounded-xl overflow-hidden border border-[#e8c4d4] mb-5">
        <div className="px-5 py-4 flex items-start justify-between gap-3" style={{ background: 'linear-gradient(90deg, var(--color-guinda-800) 0%, var(--color-guinda-600) 100%)' }}>
          <div className="text-white">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-80">Folio de la orden de pago</div>
            <div className="font-mono text-2xl sm:text-3xl font-bold tracking-tight leading-none mt-1">{p.folio}</div>
            <div className="text-[12px] opacity-90 mt-1.5">
              {(p.gestor || esGrupal(p))
                ? `${p.cantidadExamenes} examen${p.cantidadExamenes === 1 ? '' : 'es'} · ${nAlumnos(p)} alumno${nAlumnos(p) === 1 ? '' : 's'}`
                : (p.alumno ?? `Alumno #${p.estudianteId}`)}
            </div>
          </div>
          <div className="shrink-0"><EstadoChip estado={p.estado} /></div>
        </div>
      </div>

      <div className="mb-5">
        <PagoStepper estado={p.estado} perspectiva="admin" />
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Columna izq: datos + exámenes */}
        <div className="md:col-span-2 space-y-4">
          <div className="bg-white border border-stone-200 rounded-xl p-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Dato label="Concepto" val="Derecho de examen" />
              <Dato label="Exámenes" val={String(p.cantidadExamenes)} />
              <Dato label="Total" val={fmtMoney(p.montoTotal)} />
              <Dato label="Vencimiento" val={fmtFecha(p.fechaVencimiento)} />
            </div>
          </div>

          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-[var(--color-crema-100)] border-b border-stone-200 text-xs font-bold uppercase tracking-wide text-stone-600 flex items-center justify-between">
              <span>Alumnos involucrados</span>
              <span className="text-[10px] text-stone-400 font-semibold">{nAlumnos(p)} · {p.examenes.length} examen{p.examenes.length === 1 ? '' : 'es'}</span>
            </div>
            <div className="divide-y divide-stone-100">
              {agruparPorAlumno(p.examenes).map((grupo) => (
                <div key={grupo.estudianteId ?? grupo.nombre} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-stone-900 truncate">{grupo.nombre}</div>
                      {grupo.matricula && (
                        <div className="text-[11px] font-mono text-stone-400 mt-0.5">Matrícula: {grupo.matricula}</div>
                      )}
                    </div>
                    {grupo.estudianteId != null && (
                      <Link
                        href={`/admin/alumnos/${grupo.estudianteId}`}
                        className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-stone-300 text-[var(--color-guinda-700)] hover:bg-[var(--color-crema-100)]">
                        <ExternalLink size={12} /> Ver alumno
                      </Link>
                    )}
                  </div>
                  <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {grupo.examenes.map((e) => (
                      <div key={e.inscripcionId} className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50/70 pl-1.5 pr-2.5 py-1.5">
                        <span className="w-7 h-7 rounded-md bg-[var(--color-guinda-700)] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                          {e.moduloNumero}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[12px] font-medium text-stone-700 leading-tight truncate" title={e.moduloNombre}>
                            {e.moduloNombre}
                          </div>
                          <div className="font-mono text-[9px] text-stone-400 leading-tight">Folio {e.folio}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {p.tieneComprobante && (
            <div className="bg-white border-2 border-[#e8c4d4] rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-[var(--color-guinda-50,#faf0f3)] border-b border-[#e8c4d4] flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-sm font-bold text-[var(--color-guinda-800)]">
                  <FileText size={15} /> Comprobante de pago del alumno / gestor
                </div>
                <a
                  href={`/api/pagos-examen/${id}/comprobante`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-lg border-2 border-[var(--color-guinda-700)] text-[var(--color-guinda-700)] hover:bg-[var(--color-guinda-100,#f3dbe4)] transition-colors"
                >
                  <ExternalLink size={13} /> Ver completo
                </a>
              </div>
              <iframe
                title="Comprobante de pago"
                src={`/api/pagos-examen/${id}/comprobante#toolbar=0&view=FitH`}
                className="w-full bg-stone-100"
                style={{ height: 480, border: 'none' }}
              />
            </div>
          )}
        </div>

        {/* Columna der: acciones según estado */}
        <div className="space-y-4">
          {/* ── Orden EMITIDA y bloqueada (candado) ── */}
          {(p.estado === 'emitida' || p.estado === 'en_revision') && !editando && (
            <div className="rounded-xl overflow-hidden border border-[#e8c4d4]">
              <div className="flex items-center gap-2 px-4 py-2.5 text-white" style={{ background: 'linear-gradient(135deg, var(--color-guinda-800), var(--color-guinda-600))' }}>
                <Lock size={14} /> <span className="text-sm font-bold">Orden emitida</span>
                <span className="ml-auto text-[10px] uppercase tracking-widest opacity-80">Bloqueada</span>
              </div>
              <div className="p-4 space-y-3 bg-white">
                {p.lineaCaptura ? (
                  <div>
                    <div className="text-[10px] font-semibold text-stone-500 uppercase tracking-wide mb-1">Línea de captura</div>
                    <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2">
                      <code className="flex-1 text-sm font-mono text-stone-800 break-all">{p.lineaCaptura}</code>
                      <button onClick={() => { navigator.clipboard.writeText(p.lineaCaptura!); setCopiado(true); setTimeout(() => setCopiado(false), 1500); }} className="text-stone-400 hover:text-[var(--color-guinda-700)] shrink-0">
                        {copiado ? <Check size={15} /> : <Copy size={15} />}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-stone-500">Sin línea de captura (se emitió con orden PDF o link).</div>
                )}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Dato label="Vence" val={fmtFecha(p.fechaVencimiento)} />
                  <Dato label="Emitida" val={p.tieneOrden ? 'Con PDF' : '—'} />
                </div>
                <div className="flex flex-col gap-2">
                  {p.tieneOrden && (
                    <a href={`/api/pagos-examen/${id}/orden`} target="_blank" rel="noreferrer" className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[var(--color-guinda-700)] text-white text-xs font-bold hover:bg-[var(--color-guinda-800)] transition-colors shadow-sm">
                      <Download size={14} /> Ver orden (PDF)
                    </a>
                  )}
                  {p.linkPago && (
                    <a href={p.linkPago} target="_blank" rel="noreferrer" className="w-full inline-flex items-center justify-center gap-2 py-2 rounded-lg border border-stone-300 text-stone-700 text-xs font-semibold hover:bg-stone-50">
                      <ExternalLink size={14} /> Link de pago
                    </a>
                  )}
                  {p.estado === 'emitida' && (
                    <button
                      onClick={() => setModal('editar')}
                      className="w-full inline-flex items-center justify-center gap-2 py-2.5 border-2 border-[var(--color-guinda-700)] text-[var(--color-guinda-700)] text-xs font-bold rounded-lg hover:bg-[var(--color-guinda-50,#faf0f3)] transition-colors">
                      <Pencil size={13} /> Editar orden (requiere confirmación)
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Formulario de emisión / edición ── */}
          {(p.estado === 'pendiente_emision' || p.estado === 'vencido' || editando) && (
            <div className="rounded-xl overflow-hidden border-2 border-[#e8c4d4]">
              <div className="px-4 py-2.5 flex items-center justify-between text-white" style={{ background: 'linear-gradient(90deg, var(--color-guinda-800) 0%, var(--color-guinda-600) 100%)' }}>
                <div className="text-sm font-bold">
                  {editando ? 'Editar orden emitida' : p.estado === 'vencido' ? 'Re-emitir orden' : 'Cargar orden de pago'}
                </div>
                {editando && (
                  <button onClick={() => { setEditando(false); cargar(); }} className="text-xs text-white/80 hover:text-white inline-flex items-center gap-1"><X size={13} /> Cancelar</button>
                )}
              </div>
              <div className="p-4 space-y-3 bg-white">
              <p className="text-[11px] text-stone-500 leading-snug">
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
                <span className="truncate flex-1">{orden ? orden.name : (p.tieneOrden ? 'Reemplazar orden (PDF) — opcional' : 'Orden de pago (PDF)')}</span>
                <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => setOrden(e.target.files?.[0] ?? null)} />
              </label>
              <button onClick={emitir} disabled={busy} className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-[var(--color-guinda-700)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--color-guinda-800)] disabled:opacity-50">
                {busy ? <Loader2 size={15} className="animate-spin" /> : editando ? <Check size={15} /> : <FileUp size={15} />} {editando ? 'Guardar cambios' : 'Emitir orden'}
              </button>
              </div>
            </div>
          )}

          {/* Comprobante en revisión: validar = pagar */}
          {p.estado === 'en_revision' && (
            <div className="bg-white border-2 border-[var(--color-guinda-200,#e8c4d4)] rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-stone-800">
                <Clock size={15} className="text-amber-600" /> Comprobante por validar
              </div>
              <p className="text-[11px] text-stone-500 -mt-1">El gestor/alumno subió su comprobante; revísalo en el <strong>recuadro del comprobante</strong> y valida o rechaza aquí abajo. Al validar, la orden se marca pagada automáticamente.</p>
            </div>
          )}

          {/* Esperando comprobante — NO se puede marcar pagado sin él */}
          {p.estado === 'emitida' && !p.tieneComprobante && (
            <div className="text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2">
              <Clock size={14} className="shrink-0 mt-0.5 text-blue-500" />
              <span>Orden emitida. <strong>Esperando el comprobante</strong> del gestor/alumno. No se puede marcar pagado hasta que lo suban.</span>
            </div>
          )}

          {/* Validar comprobante (= marcar pagado). Solo cuando ya lo subieron. */}
          {p.estado === 'en_revision' && (
            <div className="space-y-2 bg-white border border-stone-200 rounded-xl p-4">
              <label className="block text-xs font-semibold text-stone-600 mb-1">Notas (opcional)</label>
              <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} placeholder="Referencia bancaria, observación de conciliación…" className="w-full text-sm border border-stone-300 rounded-lg px-3 py-2 resize-none" />
              <button onClick={() => accion('conciliar', 'Pago conciliado', { notas })} disabled={busy} className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50">
                <CheckCircle2 size={15} /> Validar comprobante y marcar pagado
              </button>
              <button onClick={() => setModal('rechazar')} disabled={busy} className="w-full inline-flex items-center justify-center gap-2 py-2 border border-amber-300 text-amber-700 text-sm font-semibold rounded-lg hover:bg-amber-50 disabled:opacity-50">
                <XCircle size={15} /> Rechazar comprobante
              </button>
            </div>
          )}
          {p.estado !== 'pagado' && p.estado !== 'cancelado' && (
            <button onClick={() => setModal('cancelar')} disabled={busy} className="w-full inline-flex items-center justify-center gap-2 py-2 border border-stone-300 text-stone-600 text-sm font-semibold rounded-lg hover:bg-stone-50 disabled:opacity-50">
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

      {/* ── Modales de confirmación ── */}
      {modal === 'editar' && (
        <ConfirmModal
          icon={<Pencil size={20} />}
          title="Editar orden emitida"
          message="Podrás corregir la línea de captura, el vencimiento, el link o el PDF. La orden se re-emitirá con los nuevos datos y seguirá vigente."
          confirmLabel="Editar orden"
          onConfirm={() => { setEditando(true); setModal(null); }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'cancelar' && (
        <ConfirmModal
          danger icon={<Ban size={20} />}
          title="Cancelar orden de pago"
          message="La orden quedará cancelada y los exámenes volverán a quedar libres para solicitarse. Esta acción no se puede deshacer."
          confirmLabel="Sí, cancelar orden"
          onConfirm={() => { setModal(null); accion('cancelar', 'Orden cancelada'); }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'rechazar' && (
        <ConfirmModal
          danger icon={<XCircle size={20} />}
          title="Rechazar comprobante"
          message="El comprobante se rechazará y la orden volverá a estado 'emitida' para que suban uno nuevo. Indica el motivo:"
          confirmLabel="Rechazar comprobante"
          withInput inputPlaceholder="Motivo del rechazo (ej. comprobante ilegible, monto incorrecto)…"
          onConfirm={(motivo) => { setModal(null); accion('rechazar-comprobante', 'Comprobante rechazado', { motivo: motivo || 'Comprobante no válido' }); }}
          onClose={() => setModal(null)}
        />
      )}
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
const COSTO_EXAMEN = 145;

interface AlumnoBusqueda {
  id: number; nombreCompleto: string; curp: string | null;
  municipio: { nombre: string } | null;
  gestor: { id: number; nombreCompleto: string } | null;
}
interface GestorBusqueda { id: number; nombreCompleto: string; municipio: { nombre: string } | null }

function iniciales(n: string) { const p = (n || '?').trim().split(/\s+/); return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '?'; }

function NuevaOrden({ onBack, onCreada, onToast }: { onBack: () => void; onCreada: (id: number) => void; onToast: (m: string, ok?: boolean) => void }) {
  const [modo, setModo] = useState<'alumno' | 'gestor'>('alumno');
  const [q, setQ] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [resAlumnos, setResAlumnos] = useState<AlumnoBusqueda[]>([]);
  const [resGestores, setResGestores] = useState<GestorBusqueda[]>([]);
  const [gestor, setGestor] = useState<GestorBusqueda | null>(null);
  const [alumnosDeGestor, setAlumnosDeGestor] = useState<AlumnoBusqueda[]>([]);
  const [alumno, setAlumno] = useState<AlumnoBusqueda | null>(null);
  const [candidatos, setCandidatos] = useState<PagoExamenCandidato[]>([]);
  const [cargandoCand, setCargandoCand] = useState(false);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [creando, setCreando] = useState(false);

  function reset() {
    setQ(''); setResAlumnos([]); setResGestores([]); setGestor(null);
    setAlumnosDeGestor([]); setAlumno(null); setCandidatos([]); setSel(new Set());
  }
  function cambiarModo(m: 'alumno' | 'gestor') { setModo(m); reset(); }

  // Lista SIEMPRE precargada de la A a la Z. Sin texto muestra el directorio
  // completo; conforme escribes filtra en vivo (con retardo corto) y el backend
  // busca por palabras sueltas en cualquier orden. Sin botón "Buscar".
  useEffect(() => {
    if (alumno) return;                       // ya se eligió alumno
    if (modo === 'gestor' && gestor) return;  // ya se eligió centro → se listan sus alumnos
    let alive = true;
    const term = q.trim();
    setBuscando(true);
    const t = setTimeout(async () => {
      try {
        const qs = term ? `&search=${encodeURIComponent(term)}` : '';
        if (modo === 'alumno') {
          const r = await api.get<{ alumnos: AlumnoBusqueda[] }>(`/admin/alumnos?sortBy=nombre&sortDir=asc&limit=100${qs}`);
          if (alive) setResAlumnos(r.alumnos);
        } else {
          const r = await api.get<{ gestores: GestorBusqueda[] }>(`/admin/gestores?limit=100${qs}`);
          if (alive) setResGestores(r.gestores);
        }
      } catch {
        if (alive) onToast('Error al buscar', false);
      } finally {
        if (alive) setBuscando(false);
      }
    }, term ? 250 : 0);
    return () => { alive = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, modo, gestor, alumno]);

  async function elegirGestor(g: GestorBusqueda) {
    setGestor(g); setResGestores([]);
    try {
      const r = await api.get<{ alumnos: AlumnoBusqueda[] }>(`/admin/alumnos?gestorId=${g.id}&sortBy=nombre&sortDir=asc&limit=100`);
      setAlumnosDeGestor(r.alumnos);
    } catch { onToast('Error al cargar alumnos del centro', false); }
  }

  async function elegirAlumno(a: AlumnoBusqueda) {
    setAlumno(a); setResAlumnos([]); setSel(new Set()); setCargandoCand(true);
    try {
      const r = await api.get<{ examenes: PagoExamenCandidato[] }>(`/pagos-examen/candidatos/${a.id}`);
      setCandidatos(r.examenes);
      setSel(new Set(r.examenes.map((e) => e.id)));
    } catch { onToast('Error al cargar exámenes', false); } finally { setCargandoCand(false); }
  }

  async function crear() {
    if (!alumno || sel.size === 0) return;
    setCreando(true);
    try {
      const r = await api.post<{ id: number }>('/pagos-examen', { estudianteId: alumno.id, examenInscripcionIds: [...sel] });
      onToast('Orden de pago creada'); onCreada(r.id);
    } catch (e) { onToast(e instanceof Error ? e.message : 'Error', false); } finally { setCreando(false); }
  }

  const toggle = (id: number) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const todos = candidatos.length > 0 && sel.size === candidatos.length;

  return (
    <>
      <button onClick={onBack} className="text-sm text-stone-600 hover:text-[var(--color-guinda-700)] inline-flex items-center gap-1.5 mb-4">
        <ChevronLeft size={15} /> Volver a órdenes
      </button>
      <h1 className="font-serif text-2xl font-bold text-stone-900">Nueva orden de pago</h1>
      <p className="text-sm text-stone-500 mb-5">Genera la orden ante Tesorería para los exámenes de un alumno. ${COSTO_EXAMEN} por examen.</p>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">
        {/* Columna izquierda: selección */}
        <div className="space-y-4">
          {/* Paso 1 — a quién */}
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-stone-800"><span className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] text-white" style={{ background: 'var(--color-guinda-700)' }}>1</span> ¿Para quién es la orden?</div>
              {(alumno || gestor) && <button onClick={reset} className="text-xs font-semibold text-[var(--color-guinda-700)] hover:underline">Reiniciar</button>}
            </div>
            <div className="p-4">
              {/* Toggle modo */}
              {!alumno && (
                <div className="inline-flex rounded-lg border border-stone-200 p-0.5 mb-3">
                  {(['alumno', 'gestor'] as const).map((m) => (
                    <button key={m} onClick={() => cambiarModo(m)}
                      className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors ${modo === m ? 'text-white' : 'text-stone-600'}`}
                      style={modo === m ? { background: 'var(--color-guinda-700)' } : undefined}>
                      {m === 'alumno' ? 'Alumno individual' : 'Por centro (gestor)'}
                    </button>
                  ))}
                </div>
              )}

              {/* Alumno ya elegido */}
              {alumno ? (
                <div className="flex items-center gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: 'var(--color-guinda-700)' }}>{iniciales(alumno.nombreCompleto)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-stone-900 truncate">{alumno.nombreCompleto}</div>
                    <div className="text-xs text-stone-500 flex flex-wrap gap-x-2">
                      <span className="font-mono">{alumno.curp ?? '—'}</span>
                      {alumno.municipio && <span>· {alumno.municipio.nombre}</span>}
                      {alumno.gestor && <span>· {alumno.gestor.nombreCompleto}</span>}
                    </div>
                  </div>
                  <button onClick={() => { setAlumno(null); setCandidatos([]); setSel(new Set()); }} className="text-xs font-semibold text-[var(--color-guinda-700)] hover:underline shrink-0">Cambiar</button>
                </div>
              ) : (
                <>
                  {/* Buscador (o alumnos del gestor elegido) */}
                  {!(modo === 'gestor' && gestor) && (
                    <div className="relative">
                      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                      <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus
                        placeholder={modo === 'alumno' ? 'Filtra por nombre, CURP o correo…' : 'Filtra por nombre o correo del gestor…'}
                        className="w-full text-sm border border-stone-300 rounded-lg pl-9 pr-9 py-2 focus:border-[var(--color-guinda-500)] focus:outline-none" />
                      {buscando ? (
                        <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-stone-400" />
                      ) : q ? (
                        <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600" aria-label="Limpiar">
                          <X size={14} />
                        </button>
                      ) : null}
                    </div>
                  )}

                  {/* Directorio de alumnos — precargado A→Z, filtra en vivo */}
                  {modo === 'alumno' && (resAlumnos.length === 0 ? (
                    !buscando && (
                      <div className="mt-3 py-6 text-center text-sm text-stone-400">
                        {q.trim() ? 'Ningún alumno coincide con esa búsqueda.' : 'Aún no hay alumnos registrados.'}
                      </div>
                    )
                  ) : (
                    <div className="mt-3 max-h-72 overflow-y-auto space-y-1">
                      {resAlumnos.map((a) => (
                        <button key={a.id} onClick={() => elegirAlumno(a)} className="w-full flex items-center gap-3 text-left px-2.5 py-2 hover:bg-stone-50 rounded-lg">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: '#a8a29e' }}>{iniciales(a.nombreCompleto)}</div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-stone-800 truncate">{a.nombreCompleto}</div>
                            <div className="text-xs text-stone-400 flex flex-wrap gap-x-2"><span className="font-mono">{a.curp ?? '—'}</span>{a.municipio && <span>· {a.municipio.nombre}</span>}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ))}

                  {/* Directorio de centros (gestores) — precargado A→Z, filtra en vivo */}
                  {modo === 'gestor' && !gestor && (resGestores.length === 0 ? (
                    !buscando && (
                      <div className="mt-3 py-6 text-center text-sm text-stone-400">
                        {q.trim() ? 'Ningún centro coincide con esa búsqueda.' : 'Aún no hay gestores registrados.'}
                      </div>
                    )
                  ) : (
                    <div className="mt-3 max-h-72 overflow-y-auto space-y-1">
                      {resGestores.map((g) => (
                        <button key={g.id} onClick={() => elegirGestor(g)} className="w-full flex items-center gap-3 text-left px-2.5 py-2 hover:bg-stone-50 rounded-lg">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: '#7c3aed' }}>{iniciales(g.nombreCompleto)}</div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-stone-800 truncate">{g.nombreCompleto}</div>
                            {g.municipio && <div className="text-xs text-stone-400">{g.municipio.nombre}</div>}
                          </div>
                        </button>
                      ))}
                    </div>
                  ))}

                  {/* Gestor elegido → sus alumnos */}
                  {modo === 'gestor' && gestor && (
                    <div>
                      <div className="mb-2 flex items-center justify-between rounded-lg bg-[var(--color-crema-100)] px-3 py-2">
                        <span className="text-xs font-semibold text-stone-700">Centro: <b>{gestor.nombreCompleto}</b></span>
                        <button onClick={() => { setGestor(null); setAlumnosDeGestor([]); }} className="text-xs font-semibold text-[var(--color-guinda-700)] hover:underline">Cambiar centro</button>
                      </div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-400 mb-1">Elige un alumno del centro</div>
                      {alumnosDeGestor.length === 0 ? (
                        <div className="text-sm text-stone-400 py-4 text-center">Este centro no tiene alumnos.</div>
                      ) : (
                        <div className="max-h-72 overflow-y-auto space-y-1">
                          {alumnosDeGestor.map((a) => (
                            <button key={a.id} onClick={() => elegirAlumno(a)} className="w-full flex items-center gap-3 text-left px-2.5 py-2 hover:bg-stone-50 rounded-lg">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: '#a8a29e' }}>{iniciales(a.nombreCompleto)}</div>
                              <div className="min-w-0"><div className="text-sm font-medium text-stone-800 truncate">{a.nombreCompleto}</div><div className="text-xs text-stone-400 font-mono">{a.curp ?? '—'}</div></div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Paso 2 — módulos/exámenes */}
          {alumno && (
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-stone-800"><span className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] text-white" style={{ background: 'var(--color-guinda-700)' }}>2</span> Módulos a cubrir</div>
                {candidatos.length > 0 && (
                  <button onClick={() => setSel(todos ? new Set() : new Set(candidatos.map((c) => c.id)))} className="text-xs font-semibold text-[var(--color-guinda-700)] hover:underline">
                    {todos ? 'Quitar todos' : 'Seleccionar todos'}
                  </button>
                )}
              </div>
              {cargandoCand ? (
                <div className="py-10 text-center text-sm text-stone-400"><Loader2 size={18} className="animate-spin inline mr-2" /> Cargando exámenes…</div>
              ) : candidatos.length === 0 ? (
                <div className="p-8 text-center">
                  <ClipboardList size={26} className="mx-auto mb-2 text-stone-300" />
                  <div className="text-sm font-semibold text-stone-600">Sin exámenes pendientes</div>
                  <div className="text-xs text-stone-400 mt-1 max-w-xs mx-auto">Este alumno no tiene módulos inscritos sin orden de pago. Inscríbele módulos primero desde su expediente.</div>
                </div>
              ) : (
                <div className="divide-y divide-stone-100">
                  {candidatos.map((c) => {
                    const on = sel.has(c.id);
                    return (
                      <label key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50 cursor-pointer">
                        <input type="checkbox" checked={on} onChange={() => toggle(c.id)} className="w-4 h-4 accent-[var(--color-guinda-700)]" />
                        <span className="flex h-8 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold" style={{ background: on ? 'var(--color-guinda-700)' : '#f5f5f4', color: on ? '#fff' : '#78716c' }}>M{c.moduloNumero}</span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium text-stone-800 truncate">{c.moduloNombre}</span>
                          <span className="block text-[11px] text-stone-400 font-mono">Folio {c.folio}</span>
                        </span>
                        <span className="text-sm font-semibold text-stone-500 shrink-0">{fmtMoney(COSTO_EXAMEN)}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Columna derecha: resumen sticky */}
        <div className="lg:sticky lg:top-[100px] bg-white border border-stone-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-[var(--color-guinda-700)] text-white">
            <div className="text-[10px] font-bold uppercase tracking-widest opacity-80">Resumen de la orden</div>
            <div className="font-serif text-lg font-bold">{fmtMoney(sel.size * COSTO_EXAMEN)}</div>
          </div>
          <div className="p-4 space-y-2.5 text-sm">
            <div className="flex justify-between"><span className="text-stone-500">Alumno</span><span className="font-semibold text-stone-800 text-right truncate max-w-[170px]">{alumno?.nombreCompleto ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-stone-500">Exámenes</span><span className="font-semibold text-stone-800">{sel.size}</span></div>
            <div className="flex justify-between"><span className="text-stone-500">Precio unitario</span><span className="text-stone-800">{fmtMoney(COSTO_EXAMEN)}</span></div>
            <div className="border-t border-stone-100 pt-2.5 flex justify-between"><span className="font-bold text-stone-900">Total</span><span className="font-bold text-stone-900">{fmtMoney(sel.size * COSTO_EXAMEN)}</span></div>
            <button onClick={crear} disabled={creando || !alumno || sel.size === 0}
              className="mt-2 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--color-guinda-700)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--color-guinda-800)] disabled:opacity-40">
              {creando ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Crear orden de pago
            </button>
            <p className="text-[11px] text-stone-400 leading-relaxed">La línea de captura la emite Tesorería del Estado. EDUMICH solo genera y concilia la orden.</p>
          </div>
        </div>
      </div>
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
      <h1 className="font-serif text-2xl font-bold text-stone-900 mb-1">Ingresos por examen</h1>
      <p className="text-stone-500 text-sm mb-5">Solo órdenes conciliadas (pagadas).</p>

      {loading || !data ? (
        <div className="text-center text-stone-400 py-16 text-sm">Cargando…</div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Tarjeta label="Órdenes pagadas" val={String(data.totales.pagos)} />
            <Tarjeta label="Total recaudado" val={fmtMoney(data.totales.total)} destacado />
          </div>

          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-[var(--color-crema-100)] border-b border-stone-200 text-xs font-bold uppercase tracking-wide text-stone-600">Por municipio</div>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-stone-500 border-b border-stone-100">
                <tr>
                  <th className="px-4 py-2 font-semibold">Municipio</th>
                  <th className="px-4 py-2 font-semibold text-center">Pagos</th>
                  <th className="px-4 py-2 font-semibold text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.porMunicipio.map((m) => (
                  <tr key={m.municipio} className="border-b border-stone-100 last:border-0">
                    <td className="px-4 py-2.5 text-stone-800">{m.municipio}</td>
                    <td className="px-4 py-2.5 text-center text-stone-600">{m.pagos}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-stone-800">{fmtMoney(m.total)}</td>
                  </tr>
                ))}
                {data.porMunicipio.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-6 text-center text-stone-400 text-sm">Aún no hay pagos conciliados.</td></tr>
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
