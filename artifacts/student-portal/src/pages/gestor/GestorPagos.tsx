/**
 * Pagos del gestor — pagos grupales de exámenes ante la Tesorería del Estado.
 *
 * Flujo: seleccionar exámenes pendientes (p. ej. 30 de módulo 1) → se genera
 * una ficha de depósito con FOLIO → el gestor paga en Tesorería → sube su
 * comprobante → la administración verifica → todos los alumnos quedan pagados.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  CreditCard, Plus, Download, UploadCloud, Loader2, CheckCircle2, Clock,
  AlertCircle, ChevronLeft, Trash2, FileText, Landmark, Copy, Check,
} from 'lucide-react';
import { GestorLayout } from './GestorLayout';
import {
  api,
  type PagoGrupalResumen,
  type PagoGrupalDetalle,
  type ExamenDisponible,
} from '../../lib/api';

type Vista = { t: 'lista' } | { t: 'nuevo' } | { t: 'detalle'; id: number };

const ESTADO_CFG: Record<string, { label: string; bg: string; color: string; icon: React.ReactNode }> = {
  pendiente_comprobante: { label: 'Falta comprobante', bg: '#fff7ed', color: '#b45309', icon: <UploadCloud size={12} /> },
  en_revision: { label: 'En revisión', bg: '#eff6ff', color: '#1d4ed8', icon: <Clock size={12} /> },
  verificado: { label: 'Verificado', bg: '#f0fdf4', color: '#15803d', icon: <CheckCircle2 size={12} /> },
  rechazado: { label: 'Rechazado', bg: '#fef2f2', color: '#b91c1c', icon: <AlertCircle size={12} /> },
};

function EstadoChip({ estado }: { estado: string }) {
  const c = ESTADO_CFG[estado] ?? ESTADO_CFG.pendiente_comprobante;
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide"
      style={{ background: c.bg, color: c.color }}
    >
      {c.icon} {c.label}
    </span>
  );
}

const fmtMoney = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
const fmtFecha = (iso: string | null) =>
  iso ? new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export default function GestorPagos() {
  const [vista, setVista] = useState<Vista>({ t: 'lista' });
  const [pagos, setPagos] = useState<PagoGrupalResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  function cargarLista() {
    return api
      .get<{ pagos: PagoGrupalResumen[] }>('/gestor/pagos-grupales')
      .then((r) => setPagos(r.pagos))
      .catch(() => {});
  }

  useEffect(() => {
    cargarLista().finally(() => setLoading(false));
  }, []);

  return (
    <GestorLayout>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm max-w-sm ${
          toast.ok ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {toast.ok ? <CheckCircle2 size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
          {toast.msg}
        </div>
      )}

      {vista.t === 'lista' && (
        <ListaView
          pagos={pagos}
          loading={loading}
          onNuevo={() => setVista({ t: 'nuevo' })}
          onVer={(id) => setVista({ t: 'detalle', id })}
        />
      )}
      {vista.t === 'nuevo' && (
        <NuevoView
          onCancel={() => setVista({ t: 'lista' })}
          onCreado={async (id) => {
            await cargarLista();
            setVista({ t: 'detalle', id });
            showToast('Pago creado — descarga tu ficha');
          }}
          onError={(m) => showToast(m, false)}
        />
      )}
      {vista.t === 'detalle' && (
        <DetalleView
          id={vista.id}
          onBack={async () => { await cargarLista(); setVista({ t: 'lista' }); }}
          onToast={showToast}
        />
      )}
    </GestorLayout>
  );
}

// ─── Vista: lista ──────────────────────────────────────────────────────────
function ListaView({ pagos, loading, onNuevo, onVer }: {
  pagos: PagoGrupalResumen[];
  loading: boolean;
  onNuevo: () => void;
  onVer: (id: number) => void;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-guinda-700)] mb-1">PAGOS</div>
          <h1 className="font-serif text-2xl font-bold text-stone-900">Pagos</h1>
          <p className="text-stone-500 text-sm mt-1 max-w-xl">
            Paga varios exámenes de tus alumnos de una sola vez ante la Tesorería del Estado:
            genera tu ficha con folio, realiza el pago y sube el comprobante.
          </p>
        </div>
        <button
          onClick={onNuevo}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--color-guinda-700)] text-white text-sm font-semibold rounded-xl hover:bg-[var(--color-guinda-800)] transition-colors shrink-0"
        >
          <Plus size={15} /> Nuevo pago
        </button>
      </div>

      {/* Cómo funciona */}
      <div className="bg-white border border-stone-200 rounded-xl p-4 mb-5 flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-[var(--color-crema-100)] text-[var(--color-guinda-700)] flex items-center justify-center shrink-0">
          <Landmark size={16} />
        </div>
        <div className="text-xs text-stone-600 leading-relaxed">
          <strong className="text-stone-800">El pago se realiza ante la Tesorería / Secretaría de Finanzas del Estado de Michoacán.</strong>{' '}
          Aquí solo generas la ficha de referencia (con folio) y subes tu comprobante; la administración lo
          verifica y todos los exámenes incluidos quedan cubiertos.
        </div>
      </div>

      {loading ? (
        <div className="text-center text-stone-400 py-16 text-sm">Cargando…</div>
      ) : pagos.length === 0 ? (
        <div className="border-2 border-dashed border-stone-200 rounded-xl p-12 text-center">
          <CreditCard size={30} className="mx-auto text-stone-300 mb-3" />
          <div className="font-bold text-stone-900 mb-1">Sin pagos aún</div>
          <p className="text-sm text-stone-500 max-w-sm mx-auto">
            Crea tu primer pago: selecciona los exámenes de tus alumnos (por ejemplo, 30 de Módulo 1) y genera la ficha.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1fr_110px_90px_110px_130px] gap-3 px-5 py-2.5 bg-[var(--color-crema-100)] text-[10px] font-bold text-stone-500 uppercase tracking-wider border-b border-stone-200">
            <div>Folio</div>
            <div className="text-right">Exámenes</div>
            <div className="text-right">Total</div>
            <div>Fecha pago</div>
            <div className="text-center">Estado</div>
          </div>
          {pagos.map((p) => (
            <button
              key={p.id}
              onClick={() => onVer(p.id)}
              className="w-full grid grid-cols-1 sm:grid-cols-[1fr_110px_90px_110px_130px] gap-1 sm:gap-3 px-5 py-3.5 border-b border-stone-100 last:border-0 hover:bg-stone-50 items-center text-left"
            >
              <div className="font-mono text-sm font-bold text-[var(--color-guinda-700)]">{p.folio}</div>
              <div className="sm:text-right text-sm text-stone-700">{p.cantidadExamenes}</div>
              <div className="sm:text-right text-sm font-bold text-stone-900">{fmtMoney(p.montoTotal)}</div>
              <div className="text-xs text-stone-500">{fmtFecha(p.fechaPago)}</div>
              <div className="sm:text-center"><EstadoChip estado={p.estado} /></div>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// ─── Vista: nuevo pago (selector de exámenes) ─────────────────────────────
function NuevoView({ onCancel, onCreado, onError }: {
  onCancel: () => void;
  onCreado: (id: number) => void;
  onError: (m: string) => void;
}) {
  const [examenes, setExamenes] = useState<ExamenDisponible[]>([]);
  const [costo, setCosto] = useState(150);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [creando, setCreando] = useState(false);

  useEffect(() => {
    api
      .get<{ costoExamen: number; examenes: ExamenDisponible[] }>('/gestor/pagos-grupales/examenes-disponibles')
      .then((r) => { setExamenes(r.examenes); setCosto(r.costoExamen); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const porModulo = useMemo(() => {
    const m = new Map<number, { numero: number; nombre: string; items: ExamenDisponible[] }>();
    for (const e of examenes) {
      if (!m.has(e.moduloId)) m.set(e.moduloId, { numero: e.moduloNumero, nombre: e.moduloNombre, items: [] });
      m.get(e.moduloId)!.items.push(e);
    }
    return [...m.values()].sort((a, b) => a.numero - b.numero);
  }, [examenes]);

  function toggle(id: number) {
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function toggleModulo(items: ExamenDisponible[]) {
    const ids = items.map((i) => i.id);
    const todos = ids.every((i) => sel.has(i));
    setSel((s) => {
      const n = new Set(s);
      ids.forEach((i) => (todos ? n.delete(i) : n.add(i)));
      return n;
    });
  }

  async function crear() {
    if (sel.size === 0) return;
    setCreando(true);
    try {
      const r = await api.post<{ id: number }>('/gestor/pagos-grupales', { examenIds: [...sel] });
      onCreado(r.id);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'No se pudo crear el pago');
    } finally {
      setCreando(false);
    }
  }

  const total = sel.size * costo;

  return (
    <>
      <button onClick={onCancel} className="text-sm text-stone-600 hover:text-[var(--color-guinda-700)] inline-flex items-center gap-1.5 mb-5">
        <ChevronLeft size={15} /> Volver a pagos
      </button>
      <h1 className="font-serif text-2xl font-bold text-stone-900 mb-1">Nuevo pago</h1>
      <p className="text-stone-500 text-sm mb-5">
        Selecciona los exámenes a cubrir. Cada examen cuesta <strong>{fmtMoney(costo)} MXN</strong>.
      </p>

      {loading ? (
        <div className="text-center text-stone-400 py-16 text-sm">Cargando exámenes…</div>
      ) : porModulo.length === 0 ? (
        <div className="border-2 border-dashed border-stone-200 rounded-xl p-12 text-center">
          <FileText size={30} className="mx-auto text-stone-300 mb-3" />
          <div className="font-bold text-stone-900 mb-1">No hay exámenes pendientes de pago</div>
          <p className="text-sm text-stone-500 max-w-md mx-auto">
            Todos los exámenes inscritos de tus alumnos ya están cubiertos por un pago, o aún no hay inscripciones activas.
          </p>
        </div>
      ) : (
        <div className="space-y-4 pb-24">
          {/* Atajo: seleccionar / quitar todos los pendientes */}
          <div className="flex items-center justify-between gap-3 bg-white border border-stone-200 rounded-xl px-4 py-3">
            <span className="text-sm text-stone-600">
              {examenes.length} examen{examenes.length !== 1 ? 'es' : ''} pendiente{examenes.length !== 1 ? 's' : ''} de pago
            </span>
            <button
              onClick={() => setSel((s) => (s.size === examenes.length ? new Set() : new Set(examenes.map((e) => e.id))))}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--color-guinda-700)] text-[var(--color-guinda-700)] hover:bg-[var(--color-guinda-50,#faf0f3)] transition-colors"
            >
              <Check size={13} /> {sel.size === examenes.length ? 'Quitar selección' : 'Seleccionar todos'}
            </button>
          </div>

          {porModulo.map((g) => {
            const todos = g.items.every((i) => sel.has(i.id));
            const algunos = g.items.some((i) => sel.has(i.id));
            return (
              <div key={g.numero} className="bg-white border border-stone-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleModulo(g.items)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-[var(--color-crema-100)] border-b border-stone-200 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                        todos ? 'bg-[var(--color-guinda-700)] border-[var(--color-guinda-700)]'
                        : algunos ? 'border-[var(--color-guinda-700)]' : 'border-stone-300 bg-white'
                      }`}
                    >
                      {todos && <Check size={13} className="text-white" />}
                      {!todos && algunos && <span className="w-2 h-2 bg-[var(--color-guinda-700)] rounded-sm" />}
                    </span>
                    <span className="text-sm font-bold text-stone-800">
                      Módulo {g.numero} — {g.nombre}
                    </span>
                  </div>
                  <span className="text-xs text-stone-500 shrink-0">
                    {g.items.filter((i) => sel.has(i.id)).length}/{g.items.length} seleccionados
                  </span>
                </button>
                <div className="divide-y divide-stone-100">
                  {g.items.map((e) => (
                    <label key={e.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-stone-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sel.has(e.id)}
                        onChange={() => toggle(e.id)}
                        className="w-4 h-4 accent-[var(--color-guinda-700)]"
                      />
                      <span className="flex-1 text-sm text-stone-800">{e.alumno}</span>
                      <span className="font-mono text-[11px] text-stone-400">{e.folio}</span>
                      <span className="text-xs font-bold text-stone-600 w-20 text-right">{fmtMoney(costo)}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Barra fija de total */}
      {sel.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-stone-200 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4 md:pl-[248px]">
            <div className="text-sm text-stone-600">
              <strong className="text-stone-900">{sel.size}</strong> examen{sel.size !== 1 ? 'es' : ''} × {fmtMoney(costo)} ={' '}
              <strong className="text-[var(--color-guinda-700)] text-base">{fmtMoney(total)} MXN</strong>
            </div>
            <button
              onClick={crear}
              disabled={creando}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--color-guinda-700)] text-white text-sm font-semibold rounded-xl hover:bg-[var(--color-guinda-800)] disabled:opacity-50 transition-colors"
            >
              {creando ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
              Generar ficha de pago
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Vista: detalle ────────────────────────────────────────────────────────
function DetalleView({ id, onBack, onToast }: {
  id: number;
  onBack: () => void;
  onToast: (m: string, ok?: boolean) => void;
}) {
  const [pg, setPg] = useState<PagoGrupalDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [subiendo, setSubiendo] = useState(false);
  const [copiado, setCopiado] = useState(false);

  function cargar() {
    return api.get<PagoGrupalDetalle>(`/gestor/pagos-grupales/${id}`).then(setPg).catch(() => {});
  }

  useEffect(() => {
    cargar().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function subirComprobante() {
    if (!file) return;
    setSubiendo(true);
    try {
      const fd = new FormData();
      fd.append('comprobante', file);
      fd.append('fechaPago', fecha);
      await api.post(`/gestor/pagos-grupales/${id}/comprobante`, fd);
      setFile(null);
      await cargar();
      onToast('Comprobante enviado — en revisión por la administración');
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'No se pudo subir el comprobante', false);
    } finally {
      setSubiendo(false);
    }
  }

  async function cancelar() {
    if (!confirm('¿Cancelar este pago? Los exámenes volverán a estar disponibles para otro pago.')) return;
    try {
      await api.delete(`/gestor/pagos-grupales/${id}`);
      onToast('Pago cancelado');
      onBack();
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'No se pudo cancelar', false);
    }
  }

  if (loading) return <div className="text-center text-stone-400 py-16 text-sm">Cargando…</div>;
  if (!pg) return <div className="text-center text-stone-400 py-16 text-sm">No encontrado.</div>;

  return (
    <>
      <button onClick={onBack} className="text-sm text-stone-600 hover:text-[var(--color-guinda-700)] inline-flex items-center gap-1.5 mb-5">
        <ChevronLeft size={15} /> Volver a pagos
      </button>

      {/* Encabezado con folio */}
      <div className="bg-gradient-to-r from-[var(--color-guinda-800)] to-[var(--color-guinda-600)] text-white rounded-xl p-5 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-1">Folio de referencia</div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-2xl font-bold">{pg.folio}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(pg.folio).then(() => {
                    setCopiado(true);
                    setTimeout(() => setCopiado(false), 1200);
                  }).catch(() => {});
                }}
                className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 transition-colors"
                title="Copiar folio"
              >
                {copiado ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
            <div className="text-xs opacity-80 mt-1">
              {pg.cantidadExamenes} exámenes × {fmtMoney(pg.montoUnitario)} · creado el {fmtFecha(pg.creadoEn)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{fmtMoney(pg.montoTotal)}</div>
            <div className="text-[10px] uppercase tracking-wider opacity-80">MXN Total</div>
            <div className="mt-2"><EstadoChip estado={pg.estado} /></div>
          </div>
        </div>
      </div>

      {pg.estado === 'rechazado' && pg.motivoRechazo && (
        <div className="mb-5 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800 flex items-start gap-2">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <div><strong>Rechazado:</strong> {pg.motivoRechazo}. Corrige y vuelve a subir tu comprobante.</div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* Columna izquierda: pasos */}
        <div className="space-y-4">
          {/* Paso 1: ficha */}
          <div className="bg-white border border-stone-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-6 h-6 rounded-full bg-[var(--color-guinda-700)] text-white text-xs font-bold flex items-center justify-center">1</span>
              <span className="text-sm font-bold text-stone-800">Descarga tu ficha de depósito</span>
            </div>
            <p className="text-xs text-stone-500 mb-3">
              Contiene la lista de exámenes, el total y tu folio de referencia.
            </p>
            <a
              href={`/api/gestor/pagos-grupales/${pg.id}/ficha`}
              download=""
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--color-guinda-700)] text-white text-xs font-semibold rounded-lg hover:bg-[var(--color-guinda-800)] transition-colors"
            >
              <Download size={13} /> Ficha de depósito (PDF)
            </a>
          </div>

          {/* Paso 2: pagar */}
          <div className="bg-white border border-stone-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-6 h-6 rounded-full bg-[var(--color-guinda-700)] text-white text-xs font-bold flex items-center justify-center">2</span>
              <span className="text-sm font-bold text-stone-800">Paga ante la Tesorería del Estado</span>
            </div>
            <p className="text-xs text-stone-500">
              Realiza el pago de derechos en la Tesorería / Secretaría de Finanzas de Michoacán
              (formato de pago). Conserva tu comprobante o línea de captura.
            </p>
          </div>

          {/* Paso 3: comprobante */}
          <div className="bg-white border border-stone-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-6 h-6 rounded-full bg-[var(--color-guinda-700)] text-white text-xs font-bold flex items-center justify-center">3</span>
              <span className="text-sm font-bold text-stone-800">Sube tu comprobante</span>
            </div>

            {pg.estado === 'verificado' ? (
              <div className="flex items-center gap-2 text-sm text-emerald-700 font-semibold">
                <CheckCircle2 size={16} /> Pago verificado — los {pg.cantidadExamenes} exámenes quedaron cubiertos.
              </div>
            ) : (
              <>
                {pg.tieneComprobante && pg.estado === 'en_revision' && (
                  <div className="mb-3 flex items-center justify-between gap-2 text-xs bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-blue-800">
                    <span className="flex items-center gap-1.5"><Clock size={13} /> Comprobante en revisión por la administración.</span>
                    <a href={`/api/gestor/pagos-grupales/${pg.id}/comprobante`} target="_blank" rel="noopener" className="font-semibold underline shrink-0">Ver</a>
                  </div>
                )}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-1">Fecha en que realizaste el pago</label>
                    <input
                      type="date"
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                      className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-guinda-700)]"
                    />
                  </div>
                  <label className={`flex items-center gap-3 border-2 border-dashed rounded-xl p-4 cursor-pointer transition-colors ${
                    file ? 'border-[var(--color-guinda-700)] bg-[var(--color-guinda-50,#faf0f3)]' : 'border-stone-300 hover:border-stone-400 bg-white'
                  }`}>
                    <UploadCloud size={20} className={file ? 'text-[var(--color-guinda-700)]' : 'text-stone-400'} />
                    <div className="flex-1 min-w-0">
                      {file
                        ? <span className="text-sm font-semibold text-[var(--color-guinda-700)] truncate block">{file.name}</span>
                        : <span className="text-sm text-stone-500">Comprobante (PDF o imagen)</span>}
                    </div>
                    <input type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                  </label>
                  <button
                    onClick={subirComprobante}
                    disabled={!file || subiendo}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-[var(--color-guinda-700)] text-white text-sm font-semibold rounded-xl hover:bg-[var(--color-guinda-800)] disabled:opacity-50 transition-colors"
                  >
                    {subiendo ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
                    {pg.tieneComprobante ? 'Reemplazar comprobante' : 'Enviar comprobante'}
                  </button>
                </div>
              </>
            )}
          </div>

          {pg.estado !== 'verificado' && (
            <button
              onClick={cancelar}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={13} /> Cancelar este pago
            </button>
          )}
        </div>

        {/* Columna derecha: exámenes incluidos */}
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-stone-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-900">Exámenes incluidos</h3>
            <span className="text-xs text-stone-500">{pg.examenes.length}</span>
          </div>
          <div className="divide-y divide-stone-100 max-h-[480px] overflow-y-auto">
            {pg.examenes.map((e, i) => (
              <div key={i} className="px-5 py-2.5 flex items-center gap-3">
                <span className="text-[11px] text-stone-400 w-5 shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-stone-800 truncate">{e.alumno}</div>
                  <div className="text-[11px] text-stone-400">M{e.moduloNumero} · {e.folioExamen}</div>
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
