/**
 * Pagos del gestor — órdenes de pago del derecho de examen (Tesorería del Estado).
 *
 * Flujo unificado:
 *   1. El gestor SELECCIONA exámenes (individual o grupal) y SOLICITA la ficha.
 *   2. La coordinación (admin) EMITE la ficha con su línea de captura.
 *   3. El gestor PAGA ante la Tesorería, elige el método y sube el comprobante.
 *   4. El admin CONCILIA → los alumnos quedan pagados.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Plus, Download, UploadCloud, Loader2, CheckCircle2, Clock,
  AlertCircle, ChevronLeft, FileText, Landmark, Copy, Check, ExternalLink, Ban, Trash2, X,
} from 'lucide-react';
import { GestorLayout } from './GestorLayout';
import { PagoStepper } from '../../components/PagoStepper';
import { SectionTour } from '../../components/onboarding/SectionTour';
import { TOUR_G_PAGOS, GATE_GESTOR } from '../../components/onboarding/seccionesGestor';
import { SoloEscritorio, SoloMovil, ListaCards, FilaCard, DatoCard } from '../../components/ui/responsive';
import {
  api,
  type PagoExamenAlumno,
  type PagoExamenEstado,
  type ExamenDisponible,
  type MetodoPago,
  METODOS_PAGO,
} from '../../lib/api';

type Vista = { t: 'lista' } | { t: 'nuevo' } | { t: 'detalle'; id: number };

const ESTADO_CFG: Record<PagoExamenEstado, { label: string; bg: string; color: string; icon: React.ReactNode }> = {
  pendiente_emision: { label: 'Solicitada', bg: '#fff7ed', color: '#b45309', icon: <Clock size={12} /> },
  emitida: { label: 'Lista para pagar', bg: '#eff6ff', color: '#1d4ed8', icon: <Landmark size={12} /> },
  en_revision: { label: 'Comprobante en revisión', bg: '#fefce8', color: '#a16207', icon: <Clock size={12} /> },
  pagado: { label: 'Pagado', bg: '#f0fdf4', color: '#15803d', icon: <CheckCircle2 size={12} /> },
  vencido: { label: 'Vencido', bg: '#fef2f2', color: '#b91c1c', icon: <AlertCircle size={12} /> },
  cancelado: { label: 'Cancelado', bg: '#f5f5f4', color: '#78716c', icon: <Ban size={12} /> },
};

function EstadoChip({ estado }: { estado: PagoExamenEstado }) {
  const c = ESTADO_CFG[estado] ?? ESTADO_CFG.pendiente_emision;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide" style={{ background: c.bg, color: c.color }}>
      {c.icon} {c.label}
    </span>
  );
}

const fmtMoney = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
const fmtFecha = (iso: string | null) =>
  iso ? new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

export default function GestorPagos() {
  const [vista, setVista] = useState<Vista>({ t: 'lista' });
  const [pagos, setPagos] = useState<PagoExamenAlumno[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  function cargarLista() {
    setLoading(true);
    return api
      .get<{ pagos: PagoExamenAlumno[] }>('/pagos-examen/gestor-mios')
      .then((r) => setPagos(r.pagos))
      .catch(() => showToast('Error al cargar', false))
      .finally(() => setLoading(false));
  }

  useEffect(() => { if (vista.t === 'lista') cargarLista(); /* eslint-disable-next-line */ }, [vista.t]);

  return (
    <GestorLayout>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${toast.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.msg}
        </div>
      )}

      {vista.t === 'lista' && (
        <ListaView pagos={pagos} loading={loading} onNuevo={() => setVista({ t: 'nuevo' })} onAbrir={(id) => setVista({ t: 'detalle', id })} />
      )}
      {vista.t === 'nuevo' && (
        <NuevoView
          onCancel={() => setVista({ t: 'lista' })}
          onCreado={(id) => { showToast('Ficha solicitada — la coordinación la emitirá'); setVista({ t: 'detalle', id }); }}
          onError={(m) => showToast(m, false)}
        />
      )}
      {vista.t === 'detalle' && (
        <DetalleView id={vista.id} onBack={() => setVista({ t: 'lista' })} onToast={showToast} />
      )}

      {vista.t === 'lista' && (
        <SectionTour
          steps={TOUR_G_PAGOS}
          storageKey="edumich_sec_g_pagos_v1"
          gateKey={GATE_GESTOR}
          buttonLabel="Tutorial de pagos"
        />
      )}
    </GestorLayout>
  );
}

// ─── Lista ───────────────────────────────────────────────────────────────
function ListaView({ pagos, loading, onNuevo, onAbrir }: {
  pagos: PagoExamenAlumno[]; loading: boolean; onNuevo: () => void; onAbrir: (id: number) => void;
}) {
  // Puede llegar preseleccionado desde el inicio (KPI "Pagos pendientes" → ?estado=emitida).
  const [estadoFiltro, setEstadoFiltro] = useState<PagoExamenEstado | 'todos'>(() => {
    const q = new URLSearchParams(window.location.search).get('estado');
    const validos: (PagoExamenEstado | 'todos')[] = ['todos', 'pendiente_emision', 'emitida', 'en_revision', 'pagado', 'vencido'];
    return (validos as string[]).includes(q ?? '') ? (q as PagoExamenEstado) : 'todos';
  });
  const FILTROS: { val: PagoExamenEstado | 'todos'; label: string }[] = [
    { val: 'todos', label: 'Todas' },
    { val: 'pendiente_emision', label: 'Solicitadas' },
    { val: 'emitida', label: 'Listas para pagar' },
    { val: 'en_revision', label: 'En revisión' },
    { val: 'pagado', label: 'Pagadas' },
    { val: 'vencido', label: 'Vencidas' },
  ];
  const fichasFiltradas = estadoFiltro === 'todos' ? pagos : pagos.filter((p) => p.estado === estadoFiltro);
  return (
    <>
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-[var(--color-guinda-700)] font-semibold mb-1">Tesorería del Estado</div>
            <h1 className="font-serif text-3xl font-bold text-stone-900">Pagos de exámenes</h1>
          </div>
          <button data-tour="g-pag-solicitar" onClick={onNuevo} className="gov-btn-primary inline-flex items-center gap-2 whitespace-nowrap">
            <Plus size={16} /> Solicitar ficha
          </button>
        </div>

        {/* Instrucción prominente + flujo de 3 pasos */}
        <div className="mt-4 rounded-2xl border border-[var(--color-guinda-100)] p-5 sm:p-6" style={{ background: 'linear-gradient(150deg, var(--color-crema-50), #ffffff)' }}>
          <p className="font-serif text-lg sm:text-xl font-bold text-stone-900 leading-snug">
            Solicita la ficha de pago de tus alumnos o de los exámenes a realizar.
          </p>
          <p className="mt-1 text-sm sm:text-base text-stone-600">
            La coordinación emite las fichas ante la Tesorería y tú subes el comprobante.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              { n: 1, t: 'Solicitas la ficha', d: 'Eliges los exámenes de tus alumnos.' },
              { n: 2, t: 'La coordinación la emite', d: 'Genera la línea de captura ante Tesorería.' },
              { n: 3, t: 'Subes tu comprobante', d: 'Pagas y adjuntas el recibo.' },
            ].map((s) => (
              <div key={s.n} className="flex items-start gap-3 rounded-xl bg-white/70 border border-stone-100 px-3.5 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-guinda-700)] text-sm font-bold text-white">{s.n}</span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-stone-900 leading-tight">{s.t}</div>
                  <div className="text-xs text-stone-500 mt-0.5 leading-snug">{s.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filtro por estado */}
      {!loading && pagos.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {FILTROS.map((f) => {
            const activo = estadoFiltro === f.val;
            const n = f.val === 'todos' ? pagos.length : pagos.filter((p) => p.estado === f.val).length;
            return (
              <button
                key={f.val}
                onClick={() => setEstadoFiltro(f.val)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
                  activo
                    ? 'bg-[var(--color-guinda-700)] text-white border-[var(--color-guinda-700)]'
                    : 'bg-white text-stone-600 border-stone-200 hover:border-[var(--color-guinda-300)]'
                }`}
              >
                {f.label}
                <span className={`rounded-full px-1.5 text-[10px] ${activo ? 'bg-white/20' : 'bg-stone-100 text-stone-500'}`}>{n}</span>
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="text-center text-stone-400 py-16 text-sm">Cargando…</div>
      ) : pagos.length === 0 ? (
        <div className="border-2 border-dashed border-stone-200 rounded-xl p-12 text-center">
          <Landmark size={30} className="mx-auto text-stone-300 mb-3" />
          <div className="font-bold text-stone-900 mb-1">Sin fichas aún</div>
          <p className="text-sm text-stone-500 max-w-md mx-auto">Solicita una ficha de pago para cubrir los exámenes de tus alumnos.</p>
        </div>
      ) : (
        <div data-tour="g-pag-fichas">
        <SoloMovil>
          <ListaCards>
            {fichasFiltradas.length === 0 ? (
              <div className="rounded-xl border border-stone-200 bg-white px-4 py-8 text-center text-sm text-stone-400">Sin fichas en este estado.</div>
            ) : fichasFiltradas.map((p) => (
              <FilaCard
                key={p.id}
                onClick={() => onAbrir(p.id)}
                titulo={<span className="font-mono text-[13px]">{p.folio ?? `#${p.id}`}</span>}
                sub={`${p.cantidadExamenes} examen${p.cantidadExamenes === 1 ? '' : 'es'}`}
                derecha={<EstadoChip estado={p.estado} />}
                datos={<DatoCard label="Total"><span className="text-base font-bold text-stone-900">{fmtMoney(p.montoTotal)}</span></DatoCard>}
              />
            ))}
          </ListaCards>
        </SoloMovil>
        <SoloEscritorio>
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-crema-100)] border-b border-stone-200 text-left text-xs uppercase tracking-widest text-stone-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Folio</th>
                <th className="px-4 py-3 font-semibold text-center">Exám.</th>
                <th className="px-4 py-3 font-semibold text-right">Total</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {fichasFiltradas.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-stone-400">Sin fichas en este estado.</td></tr>
              ) : fichasFiltradas.map((p) => (
                <tr key={p.id} onClick={() => onAbrir(p.id)} className="border-b border-stone-100 last:border-0 hover:bg-[var(--color-crema-50)] cursor-pointer">
                  <td className="px-4 py-3 font-mono text-xs text-stone-700">{p.folio ?? `#${p.id}`}</td>
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
  );
}

// ─── Nuevo (solicitar ficha) ───────────────────────────────────────────────
function NuevoView({ onCancel, onCreado, onError }: {
  onCancel: () => void; onCreado: (id: number) => void; onError: (m: string) => void;
}) {
  const [examenes, setExamenes] = useState<ExamenDisponible[]>([]);
  const [costo, setCosto] = useState(145);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [creando, setCreando] = useState(false);
  const [modo, setModo] = useState<'individual' | 'grupal'>('grupal');
  const [alumnoSel, setAlumnoSel] = useState<number | null>(null);

  useEffect(() => {
    api.get<{ costoExamen: number; examenes: ExamenDisponible[] }>('/pagos-examen/gestor-candidatos')
      .then((r) => { setExamenes(r.examenes); setCosto(r.costoExamen); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const alumnos = useMemo(() => {
    const m = new Map<number, { id: number; nombre: string; count: number }>();
    for (const e of examenes) {
      if (!m.has(e.estudianteId)) m.set(e.estudianteId, { id: e.estudianteId, nombre: e.alumno, count: 0 });
      m.get(e.estudianteId)!.count++;
    }
    return [...m.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [examenes]);

  const visibles = useMemo(() => {
    if (modo === 'individual') return alumnoSel === null ? [] : examenes.filter((e) => e.estudianteId === alumnoSel);
    return examenes;
  }, [examenes, modo, alumnoSel]);

  const porModulo = useMemo(() => {
    const m = new Map<number, { numero: number; nombre: string; items: ExamenDisponible[] }>();
    for (const e of visibles) {
      if (!m.has(e.moduloId)) m.set(e.moduloId, { numero: e.moduloNumero, nombre: e.moduloNombre, items: [] });
      m.get(e.moduloId)!.items.push(e);
    }
    return [...m.values()].sort((a, b) => a.numero - b.numero);
  }, [visibles]);

  function cambiarModo(m: 'individual' | 'grupal') { setModo(m); setAlumnoSel(null); setSel(new Set()); }
  function elegirAlumno(id: number) { setAlumnoSel(id); setSel(new Set(examenes.filter((e) => e.estudianteId === id).map((e) => e.id))); }
  function toggle(id: number) { setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  function toggleModulo(items: ExamenDisponible[]) {
    const ids = items.map((i) => i.id); const todos = ids.every((i) => sel.has(i));
    setSel((s) => { const n = new Set(s); ids.forEach((i) => (todos ? n.delete(i) : n.add(i))); return n; });
  }

  async function solicitar() {
    if (sel.size === 0) return;
    setCreando(true);
    try {
      const r = await api.post<{ id: number }>('/pagos-examen/solicitar', { examenInscripcionIds: [...sel] });
      onCreado(r.id);
    } catch (e) { onError(e instanceof Error ? e.message : 'No se pudo solicitar la ficha'); } finally { setCreando(false); }
  }

  const total = sel.size * costo;

  return (
    <>
      <button onClick={onCancel} className="text-sm text-stone-600 hover:text-[var(--color-guinda-700)] inline-flex items-center gap-1.5 mb-5">
        <ChevronLeft size={15} /> Volver a pagos
      </button>
      <h1 className="font-serif text-2xl font-bold text-stone-900 mb-1">Nuevo pago</h1>
      <p className="text-stone-500 text-sm mb-5">
        Elige el tipo de pago y los exámenes. Se solicita la ficha a la coordinación, que la emitirá con su línea de captura. Cada examen cuesta <strong>{fmtMoney(costo)} MXN</strong>.
      </p>

      {loading ? (
        <div className="text-center text-stone-400 py-16 text-sm">Cargando exámenes…</div>
      ) : examenes.length === 0 ? (
        <div className="border-2 border-dashed border-stone-200 rounded-xl p-12 text-center">
          <FileText size={30} className="mx-auto text-stone-300 mb-3" />
          <div className="font-bold text-stone-900 mb-1">No hay exámenes pendientes de pago</div>
          <p className="text-sm text-stone-500 max-w-md mx-auto">Todos los exámenes inscritos de tus alumnos ya tienen ficha, o aún no hay inscripciones activas.</p>
        </div>
      ) : (
        <div className="space-y-4 pb-24">
          <div className="grid grid-cols-2 gap-3">
            {(['individual', 'grupal'] as const).map((m) => (
              <button key={m} onClick={() => cambiarModo(m)}
                className={`text-left rounded-xl border-2 p-4 transition-colors ${modo === m ? 'border-[var(--color-guinda-700)] bg-[var(--color-guinda-50,#faf0f3)]' : 'border-stone-200 bg-white hover:border-stone-300'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${modo === m ? 'border-[var(--color-guinda-700)]' : 'border-stone-300'}`}>
                    {modo === m && <span className="w-2 h-2 rounded-full bg-[var(--color-guinda-700)]" />}
                  </span>
                  <span className="text-sm font-bold text-stone-900">{m === 'individual' ? 'Pago individual' : 'Pago grupal'}</span>
                </div>
                <p className="text-xs text-stone-500 leading-snug">{m === 'individual' ? 'Los exámenes de un solo alumno.' : 'Exámenes de varios alumnos en una sola ficha.'}</p>
              </button>
            ))}
          </div>

          {modo === 'individual' && (
            <div className="bg-white border border-stone-200 rounded-xl px-4 py-3">
              <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wide mb-1.5">Alumno</label>
              <select value={alumnoSel ?? ''} onChange={(e) => e.target.value ? elegirAlumno(Number(e.target.value)) : (setAlumnoSel(null), setSel(new Set()))}
                className="w-full text-sm border border-stone-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-[var(--color-guinda-700)]">
                <option value="">Elige un alumno…</option>
                {alumnos.map((a) => (
                  <option key={a.id} value={a.id}>{a.nombre} — {a.count} examen{a.count !== 1 ? 'es' : ''} pendiente{a.count !== 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>
          )}

          {modo === 'individual' && alumnoSel === null ? (
            <div className="border-2 border-dashed border-stone-200 rounded-xl p-10 text-center">
              <FileText size={26} className="mx-auto text-stone-300 mb-2" />
              <p className="text-sm text-stone-500">Elige un alumno para ver sus exámenes pendientes.</p>
            </div>
          ) : (
          <>
          <div className="flex items-center justify-between gap-3 bg-white border border-stone-200 rounded-xl px-4 py-3">
            <span className="text-sm text-stone-600">{visibles.length} examen{visibles.length !== 1 ? 'es' : ''} pendiente{visibles.length !== 1 ? 's' : ''} de pago</span>
            <button onClick={() => setSel((s) => (visibles.every((e) => s.has(e.id)) ? new Set() : new Set(visibles.map((e) => e.id))))}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--color-guinda-700)] text-[var(--color-guinda-700)] hover:bg-[var(--color-guinda-50,#faf0f3)] transition-colors">
              <Check size={13} /> {visibles.length > 0 && visibles.every((e) => sel.has(e.id)) ? 'Quitar selección' : 'Seleccionar todos'}
            </button>
          </div>

          {porModulo.map((g) => {
            const todos = g.items.every((i) => sel.has(i.id));
            const algunos = g.items.some((i) => sel.has(i.id));
            return (
              <div key={g.numero} className="bg-white border border-stone-200 rounded-xl overflow-hidden">
                <button onClick={() => toggleModulo(g.items)} className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-[var(--color-crema-100)] border-b border-stone-200 text-left">
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${todos ? 'bg-[var(--color-guinda-700)] border-[var(--color-guinda-700)]' : algunos ? 'border-[var(--color-guinda-700)]' : 'border-stone-300 bg-white'}`}>
                      {todos && <Check size={13} className="text-white" />}
                      {!todos && algunos && <span className="w-2 h-2 bg-[var(--color-guinda-700)] rounded-sm" />}
                    </span>
                    <span className="text-sm font-bold text-stone-800">Módulo {g.numero} — {g.nombre}</span>
                  </div>
                  <span className="text-xs text-stone-500 shrink-0">{g.items.filter((i) => sel.has(i.id)).length}/{g.items.length} seleccionados</span>
                </button>
                <div className="divide-y divide-stone-100">
                  {g.items.map((e) => (
                    <label key={e.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-stone-50 cursor-pointer">
                      <input type="checkbox" checked={sel.has(e.id)} onChange={() => toggle(e.id)} className="w-4 h-4 accent-[var(--color-guinda-700)]" />
                      <span className="flex-1 text-sm text-stone-800">{e.alumno}</span>
                      <span className="font-mono text-[11px] text-stone-400">{e.folio}</span>
                      <span className="text-xs font-bold text-stone-600 w-20 text-right">{fmtMoney(costo)}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
          </>
          )}
        </div>
      )}

      {sel.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-stone-200 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4 md:pl-[248px]">
            <div className="text-sm text-stone-600">
              <strong className="text-stone-900">{sel.size}</strong> examen{sel.size !== 1 ? 'es' : ''} × {fmtMoney(costo)} = <strong className="text-[var(--color-guinda-700)] text-base">{fmtMoney(total)} MXN</strong>
            </div>
            <button onClick={solicitar} disabled={creando} className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--color-guinda-700)] text-white text-sm font-semibold rounded-xl hover:bg-[var(--color-guinda-800)] disabled:opacity-50 transition-colors">
              {creando ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />} Solicitar ficha de pago
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Detalle ────────────────────────────────────────────────────────────────
function DetalleView({ id, onBack, onToast }: { id: number; onBack: () => void; onToast: (m: string, ok?: boolean) => void }) {
  const [p, setP] = useState<PagoExamenAlumno | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiado, setCopiado] = useState(false);
  const [metodo, setMetodo] = useState<MetodoPago | ''>('');
  const [file, setFile] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  function cargar() {
    setLoading(true);
    return api.get<PagoExamenAlumno>(`/pagos-examen/gestor-detalle/${id}`)
      .then((d) => { setP(d); setMetodo((d.metodoPago as MetodoPago) ?? ''); })
      .catch(() => onToast('Error al cargar', false))
      .finally(() => setLoading(false));
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [id]);

  async function subir() {
    if (!file || !metodo) { onToast('Elige el método y el comprobante', false); return; }
    setSubiendo(true);
    try {
      const fd = new FormData();
      fd.append('comprobante', file);
      fd.append('metodoPago', metodo);
      await api.post(`/pagos-examen/${id}/comprobante`, fd);
      onToast('Comprobante enviado — en revisión');
      setFile(null);
      cargar();
    } catch (e) { onToast(e instanceof Error ? e.message : 'Error', false); } finally { setSubiendo(false); }
  }

  async function cancelarFicha() {
    if (!confirm('¿Cancelar esta ficha de pago? Los exámenes quedarán libres para solicitarse de nuevo.')) return;
    try { await api.post(`/pagos-examen/${id}/cancelar-mia`, {}); onToast('Ficha cancelada'); onBack(); }
    catch (e) { onToast(e instanceof Error ? e.message : 'Error', false); }
  }

  async function quitarExamen(inscripcionId: number) {
    if (!confirm('¿Quitar este examen de la ficha?')) return;
    try {
      const r = await api.post<{ reemitir?: boolean }>(`/pagos-examen/${id}/quitar-examen`, { examenInscripcionId: inscripcionId });
      onToast(r.reemitir ? 'Examen quitado — la coordinación debe re-emitir la ficha' : 'Examen quitado');
      cargar();
    } catch (e) { onToast(e instanceof Error ? e.message : 'Error', false); }
  }

  if (loading || !p) return <div className="text-center text-stone-400 py-16 text-sm">Cargando…</div>;

  const puedePagar = p.estado === 'emitida';
  const editable = p.estado === 'pendiente_emision' || p.estado === 'emitida';

  return (
    <>
      <button onClick={onBack} className="text-sm text-stone-600 hover:text-[var(--color-guinda-700)] inline-flex items-center gap-1.5 mb-5">
        <ChevronLeft size={15} /> Volver a pagos
      </button>

      {/* Encabezado */}
      <div className="rounded-2xl p-5 mb-5 text-white flex items-start justify-between gap-4" style={{ background: 'linear-gradient(135deg, var(--color-guinda-800), var(--color-guinda-600))' }}>
        <div>
          <div className="text-[10px] uppercase tracking-widest opacity-80 mb-1">Folio de referencia</div>
          <div className="text-2xl font-bold font-mono">{p.folio ?? `#${p.id}`}</div>
          <div className="text-xs opacity-80 mt-1">{p.cantidadExamenes} examen{p.cantidadExamenes !== 1 ? 'es' : ''} × {fmtMoney(p.montoTotal / p.cantidadExamenes)}</div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold">{fmtMoney(p.montoTotal)}</div>
          <div className="text-[10px] uppercase tracking-widest opacity-80">MXN total</div>
          <div className="mt-2"><EstadoChip estado={p.estado} /></div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4">
          {/* Estado por fase */}
          <PagoStepper estado={p.estado} />

          {/* ── Alertas destacadas (arriba de todo) ── */}
          {p.motivoRechazo && p.estado === 'emitida' && (
            <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0"><AlertCircle size={20} className="text-red-600" /></div>
                <div className="min-w-0">
                  <div className="text-base font-bold text-red-800">Comprobante rechazado</div>
                  <div className="text-sm text-red-700 mt-1"><span className="font-semibold">Motivo:</span> {p.motivoRechazo}</div>
                  <div className="text-xs text-red-600 mt-1.5">Corrige lo indicado y vuelve a subir tu comprobante más abajo.</div>
                </div>
              </div>
            </div>
          )}
          {p.estado === 'en_revision' && (
            <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0"><Clock size={20} className="text-amber-600" /></div>
              <div className="min-w-0">
                <div className="text-base font-bold text-amber-800">Comprobante en revisión</div>
                <div className="text-sm text-amber-700 mt-1">La coordinación está validando tu comprobante. Te avisaremos en cuanto se confirme el pago.</div>
              </div>
            </div>
          )}

          {(p.estado === 'emitida' || p.estado === 'en_revision' || p.estado === 'vencido') && (
            <div className="bg-white border border-stone-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1"><Landmark size={16} className="text-[var(--color-guinda-700)]" /><h3 className="text-sm font-bold text-stone-900">Orden de pago emitida por la coordinación</h3></div>
              <p className="text-[11px] text-stone-500 mb-3">Esta es la ficha oficial con la que pagas ante la Tesorería. Descárgala o ábrela para ver la línea de captura.</p>

              {/* Descargar / ver la orden (ficha técnica) — primaria */}
              {p.tieneOrden ? (
                <a href={`/api/pagos-examen/${id}/orden`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-3 rounded-xl border-2 border-[var(--color-guinda-700)] bg-[var(--color-guinda-50,#faf0f3)] px-4 py-3 mb-3 hover:bg-[var(--color-guinda-100,#f3dbe4)] transition-colors">
                  <FileText size={22} className="text-[var(--color-guinda-700)] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-[var(--color-guinda-800)]">Ver / descargar orden de pago (PDF)</div>
                    <div className="text-[11px] text-stone-500">Documento oficial que emitió la plataforma del Estado</div>
                  </div>
                  <Download size={18} className="text-[var(--color-guinda-700)] shrink-0" />
                </a>
              ) : (
                <div className="text-xs text-stone-500 bg-stone-50 border border-stone-200 rounded-lg p-2.5 mb-3">
                  La coordinación aún no adjuntó el PDF de la orden. Usa la línea de captura o el link de pago.
                </div>
              )}

              {/* Línea de captura */}
              {p.lineaCaptura && (
                <>
                  <div className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide mb-1">Línea de captura</div>
                  <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 mb-3">
                    <code className="flex-1 text-sm font-mono text-stone-800 break-all">{p.lineaCaptura}</code>
                    <button onClick={() => { navigator.clipboard.writeText(p.lineaCaptura!); setCopiado(true); setTimeout(() => setCopiado(false), 1500); }} className="text-stone-400 hover:text-[var(--color-guinda-700)] shrink-0">
                      {copiado ? <Check size={15} /> : <Copy size={15} />}
                    </button>
                  </div>
                </>
              )}

              {p.linkPago && (
                <a href={p.linkPago} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50">
                  <ExternalLink size={15} /> Pagar en línea
                </a>
              )}
              {p.fechaVencimiento && <div className="text-xs text-stone-500 mt-2">Vence el <strong className="text-stone-700">{fmtFecha(p.fechaVencimiento)}</strong>.</div>}
            </div>
          )}

          {/* Instrucciones + pago */}
          {puedePagar && (
            <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2"><span className="w-6 h-6 rounded-full bg-[var(--color-guinda-700)] text-white text-xs font-bold flex items-center justify-center">1</span><span className="text-sm font-bold text-stone-800">Paga ante la Tesorería del Estado</span></div>
                <p className="text-sm text-stone-600 leading-relaxed pl-8">Con la línea de captura, paga en <strong>ventanilla bancaria</strong>, <strong>tienda de conveniencia</strong> (OXXO, etc.) o <strong>en línea</strong> si hay link. Conserva tu comprobante o recibo oficial.</p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2"><span className="w-6 h-6 rounded-full bg-[var(--color-guinda-700)] text-white text-xs font-bold flex items-center justify-center">2</span><span className="text-sm font-bold text-stone-800">Indica cómo pagaste y sube el comprobante</span></div>
                <div className="pl-8 space-y-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {METODOS_PAGO.map((m) => (
                      <button key={m.value} onClick={() => setMetodo(m.value)}
                        className={`text-left rounded-lg border-2 p-2.5 transition-colors ${metodo === m.value ? 'border-[var(--color-guinda-700)] bg-[var(--color-guinda-50,#faf0f3)]' : 'border-stone-200 hover:border-stone-300'}`}>
                        <div className="text-xs font-bold text-stone-800">{m.label}</div>
                      </button>
                    ))}
                  </div>
                  <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl py-7 px-4 cursor-pointer text-center transition-colors ${file ? 'border-[var(--color-guinda-700)] bg-[var(--color-guinda-50,#faf0f3)]' : 'border-stone-300 hover:border-[var(--color-guinda-700)] hover:bg-stone-50'}`}>
                    <UploadCloud size={30} className={file ? 'text-[var(--color-guinda-700)]' : 'text-stone-400'} />
                    <div className="text-sm font-bold uppercase tracking-wide text-stone-700">Comprobante</div>
                    <span className="text-xs text-stone-500 truncate max-w-full">{file ? file.name : 'Toca para subir el PDF o la foto de tu recibo'}</span>
                    <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                  </label>
                  <button onClick={subir} disabled={!file || !metodo || subiendo} className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-[var(--color-guinda-700)] text-white text-sm font-semibold rounded-xl hover:bg-[var(--color-guinda-800)] disabled:opacity-50">
                    {subiendo ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />} Enviar comprobante
                  </button>
                </div>
              </div>
            </div>
          )}

          {p.estado === 'pagado' && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex gap-2 text-sm text-green-700"><CheckCircle2 size={16} className="shrink-0 mt-0.5" /> Pago confirmado{p.fechaPago ? ` el ${fmtFecha(p.fechaPago)}` : ''}. Alumnos inscritos oficialmente.</div>
          )}
          {p.estado === 'vencido' && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2 text-sm text-red-700"><AlertCircle size={16} className="shrink-0 mt-0.5" /> Esta ficha venció. Solicita una nueva a la coordinación.</div>
          )}
        </div>

        {/* Exámenes incluidos */}
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden self-start">
          <div className="px-4 py-3 bg-[var(--color-crema-100)] border-b border-stone-200 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-stone-600">Exámenes incluidos</span>
            <span className="text-xs text-stone-400">{p.examenes.length}</span>
          </div>
          <div className="divide-y divide-stone-100">
            {p.examenes.map((e, i) => (
              <div key={e.inscripcionId} className="px-4 py-2.5 flex items-center gap-3">
                <span className="text-stone-300 text-xs w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-stone-800 truncate">{e.alumno || `Módulo ${e.moduloNumero}`}</div>
                  <div className="text-[11px] text-stone-400 font-mono">M{e.moduloNumero} · {e.folio}</div>
                </div>
                <span className="text-sm font-semibold text-stone-600">{fmtMoney(p.montoTotal / p.cantidadExamenes)}</span>
                {editable && p.examenes.length > 1 && (
                  <button onClick={() => quitarExamen(e.inscripcionId)} title="Quitar de la ficha" className="text-stone-300 hover:text-red-600 shrink-0">
                    <X size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {editable && (
            <div className="px-4 py-3 border-t border-stone-100">
              <button onClick={cancelarFicha} className="w-full inline-flex items-center justify-center gap-2 py-2 border border-red-200 text-red-600 text-sm font-semibold rounded-lg hover:bg-red-50">
                <Trash2 size={14} /> Cancelar ficha
              </button>
              {p.estado === 'emitida' && (
                <p className="text-[11px] text-stone-400 mt-2 leading-snug">Editar o quitar un examen invalida la línea de captura: la coordinación deberá re-emitir la ficha.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
