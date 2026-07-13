import { useState, useCallback, useEffect } from 'react';
import {
  BarChart2, Users, FileText, DollarSign, GraduationCap,
  UserCheck, Calendar, Inbox, TrendingUp, Download, RefreshCw,
  Clock, Trash2, ToggleLeft, ToggleRight, Plus, X,
  UserPlus, CheckCircle2, Award, Send, Loader2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, CartesianGrid,
} from 'recharts';
import { AdminLayout } from './AdminLayout';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type ReporteTipo =
  | 'inscripciones' | 'expedientes' | 'financiero' | 'academico'
  | 'productividad_gestores' | 'convocatorias' | 'solicitudes' | 'ejecutivo';

type Formato = 'excel' | 'pdf';

interface Filtros {
  fechaInicio: string;
  fechaFin: string;
  municipioId: string;
  gestorId: string;
  etapaId: string;
}

interface KPI { label: string; valor: string | number; unidad?: string }
interface Preview { kpis: KPI[]; columnas: string[]; preview: (string | number | null)[][]; totalRegistros: number }

interface Programado {
  id: number; nombre: string; tipo: string; formato: string; frecuencia: string;
  emailDestino: string; activo: boolean; proximaEjecucion: string; ultimaEjecucionEn: string | null;
}
interface Historial {
  id: number; tipo: string; formato: string; nombre: string; estado: string;
  totalRegistros: number | null; nombreArchivo: string | null; tamanoBytes: number | null;
  generadoEn: string | null; createdAt: string;
}

interface EtapaOpt { id: number; clave: string; etapa: string; fase: string; anio: number }
interface GestorOpt { id: number; nombreCompleto: string; municipioNombre: string | null; centroAsesoria: string | null; claveCentro: string | null; rfcCentro: string | null }

interface Dashboard {
  anio: number;
  etapaId: number | null;
  kpis: {
    inscritos: number; examenesPagados: number; montoPagado: number;
    tasaAprobacion: number; egresados: number; solicitudesPendientes: number; gestoresActivos: number;
  };
  inscritosPorEtapa: { etapa: string; inscritos: number }[];
  pagosPorEstado: { estado: string; total: number }[];
  aprobacionPorEtapa: { etapa: string; aprobados: number; reprobados: number }[];
  solicitudesPorEstado: { estado: string; total: number }[];
  aprobacionPorModulo: { numero: number; nombre: string; evaluados: number; aprobados: number; tasa: number }[];
  rankingCentros: { gestor: string; municipio: string; alumnos: number; pctExpediente: number; pctPagado: number; pctAprobacion: number }[];
  embudo: { paso: string; n: number }[];
  solicitudesRecibidas: number;
  avanceEgreso: { rango: string; n: number }[];
  etapas: { id: number; clave: string; anio: number }[];
  aniosDisponibles: number[];
}

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────

const REPORTES: { tipo: ReporteTipo; label: string; desc: string; icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }> }[] = [
  { tipo: 'inscripciones',        label: 'Inscripciones',          desc: 'Estado de inscripciones por convocatoria, municipio y gestor', icon: Users },
  { tipo: 'convocatorias',        label: 'Exámenes por etapa',     desc: 'Inscritos a examen por etapa, módulo y sede',                  icon: Calendar },
  { tipo: 'financiero',           label: 'Financiero',             desc: 'Pagos recibidos, verificados y pendientes con montos',         icon: DollarSign },
  { tipo: 'academico',            label: 'Académico',              desc: 'Calificaciones, tasas de aprobación y progreso modular',       icon: GraduationCap },
  { tipo: 'expedientes',          label: 'Expedientes',            desc: 'Revisión de documentos por alumno y estado de aprobación',     icon: FileText },
  { tipo: 'productividad_gestores', label: 'Gestores',             desc: 'Productividad por gestor: alumnos, documentos y matrículas',   icon: UserCheck },
  { tipo: 'solicitudes',          label: 'Solicitudes de cuenta',  desc: 'Flujo de solicitudes públicas por estado y municipio',        icon: Inbox },
  { tipo: 'ejecutivo',            label: 'Ejecutivo',              desc: 'Consolidado con todos los KPI institucionales',                icon: TrendingUp },
];

const GUINDA = '#6B1530';
// Paleta "índigo tech" para el panel de indicadores (moderno, sobrio).
const INDIGO = '#4338CA';
const INDIGO_L = '#6366F1';
const TEAL = '#0D9488';
const TEAL_L = '#2DD4BF';
const AMBAR = '#D97706';
const AMBAR_L = '#FBBF24';
const ROSA = '#E11D48';
const SLATE_900 = '#0F172A';
const SLATE_500 = '#64748B';
const SLATE_400 = '#94A3B8';
const LINEA = '#EEF2F7';
const FRECUENCIAS = ['diaria', 'semanal', 'quincenal', 'mensual'];

// Color semántico por estado (pagos / solicitudes).
function colorEstado(estado: string): string {
  const e = estado.toLowerCase();
  if (e.includes('pagad') || e.includes('aprobad') || e.includes('verificad')) return TEAL;
  if (e.includes('cancel') || e.includes('rechaz')) return ROSA;
  if (e.includes('pendiente') || e.includes('emision') || e.includes('emisión')) return AMBAR;
  if (e.includes('revision') || e.includes('revisión') || e.includes('emitid')) return INDIGO;
  return SLATE_400;
}
function humaniza(s: string): string {
  const t = s.replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
function fechaCorta(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
}
function pesos(n: number): string {
  return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 0 })}`;
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────

export default function Reportes() {
  return (
    <AdminLayout>
      <div style={{ fontFamily: "'Poppins', sans-serif" }}>
        <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: GUINDA }}>
              <BarChart2 size={13} /> Reportes
            </div>
            <h1 className="font-serif text-3xl font-bold text-stone-900">Panel de indicadores</h1>
            <p className="text-sm text-stone-500 mt-0.5">Pulso de la operación en vivo. Abajo puedes descargar reportes filtrados.</p>
          </div>
        </div>

        <PanelIndicadores />

        <div className="my-8 flex items-center gap-3">
          <div className="h-px flex-1 bg-stone-200" />
          <span className="text-xs font-semibold uppercase tracking-widest text-stone-400">Descargar reportes</span>
          <div className="h-px flex-1 bg-stone-200" />
        </div>

        <CentroDescargas />
      </div>
    </AdminLayout>
  );
}

// ─────────────────────────────────────────────────────────────
// ① Panel de indicadores (dashboard en vivo)
// ─────────────────────────────────────────────────────────────

function PanelIndicadores() {
  const [anio, setAnio] = useState<number>(new Date().getFullYear());
  const [etapaId, setEtapaId] = useState<string>('');
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ anio: String(anio), ...(etapaId ? { etapaId } : {}) });
      const res = await fetch(`/api/admin/reportes/dashboard?${qs}`, { credentials: 'include' });
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch { setData(null); } finally { setLoading(false); }
  }, [anio, etapaId]);

  useEffect(() => { cargar(); }, [cargar]);

  const k = data?.kpis;
  const kpiCards = [
    { label: 'Inscritos a examen', valor: k?.inscritos ?? 0, icon: UserPlus, color: INDIGO },
    { label: 'Exámenes pagados', valor: k?.examenesPagados ?? 0, sub: k ? pesos(k.montoPagado) : '', icon: DollarSign, color: TEAL },
    { label: 'Aprobación', valor: `${k?.tasaAprobacion ?? 0}%`, icon: CheckCircle2, color: AMBAR },
    { label: 'Egresados', valor: k?.egresados ?? 0, sub: 'de 22 módulos', icon: Award, color: INDIGO_L },
    { label: 'Solicitudes pendientes', valor: k?.solicitudesPendientes ?? 0, icon: Inbox, color: ROSA },
    { label: 'Gestores activos', valor: k?.gestoresActivos ?? 0, icon: UserCheck, color: TEAL },
  ];

  return (
    <div>
      {/* Degradados para las gráficas */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="gradIndigo" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={INDIGO_L} /><stop offset="100%" stopColor={INDIGO} /></linearGradient>
        </defs>
      </svg>

      {/* Filtro global */}
      <div className="flex flex-wrap items-end gap-3 mb-5">
        <Filtro label="Año">
          <select value={anio} onChange={(e) => { setAnio(Number(e.target.value)); setEtapaId(''); }} className={selCls}>
            {(data?.aniosDisponibles?.length ? data.aniosDisponibles : [anio]).map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </Filtro>
        <Filtro label="Etapa">
          <select value={etapaId} onChange={(e) => setEtapaId(e.target.value)} className={`${selCls} min-w-[180px]`}>
            <option value="">Todas las etapas</option>
            {data?.etapas.map((et) => <option key={et.id} value={et.id}>Etapa {et.clave}</option>)}
          </select>
        </Filtro>
        {loading && <div className="flex items-center gap-1.5 text-xs pb-2" style={{ color: SLATE_400 }}><Loader2 size={13} className="animate-spin" /> Actualizando…</div>}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        {kpiCards.map((c) => (
          <div key={c.label} className="rounded-2xl border bg-white p-4" style={{ borderColor: LINEA, boxShadow: '0 1px 3px rgba(15,23,42,.05)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: `${c.color}14`, color: c.color }}><c.icon size={15} /></div>
            <div className="text-2xl font-extrabold leading-none" style={{ color: SLATE_900 }}>{c.valor}</div>
            <div className="text-[11px] font-medium mt-1.5 leading-tight" style={{ color: SLATE_500 }}>{c.label}</div>
            {c.sub && <div className="text-[10px] mt-0.5" style={{ color: SLATE_400 }}>{c.sub}</div>}
          </div>
        ))}
      </div>

      {/* Embudo de conversión */}
      <Panel titulo="Embudo de conversión" icon={TrendingUp} sub={`De la inscripción al aprobado — % que sobrevive cada paso${data ? ` · ${data.solicitudesRecibidas} solicitudes recibidas` : ''}`} className="mb-4">
        {data && data.embudo.some((s) => s.n > 0) ? <Embudo pasos={data.embudo} /> : <Vacio />}
      </Panel>

      {/* Aprobación por módulo + avance hacia egreso */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2">
          <Panel titulo="Aprobación por módulo" icon={GraduationCap} sub="Ordenado del más reprobado al más aprobado — dónde reforzar">
            {data && data.aprobacionPorModulo.length > 0 ? <AprobModulo data={data.aprobacionPorModulo} /> : <Vacio />}
          </Panel>
        </div>
        <Panel titulo="Avance hacia egreso" icon={Award} sub="Alumnos por módulos aprobados">
          {data && data.avanceEgreso.some((d) => d.n > 0) ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.avanceEgreso} margin={{ top: 8, right: 8, left: -22, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={LINEA} vertical={false} />
                <XAxis dataKey="rango" tick={{ fontSize: 9, fill: SLATE_400 }} angle={-30} textAnchor="end" height={44} interval={0} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: SLATE_400 }} allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipCls} formatter={(v: number) => [v, 'Alumnos']} />
                <Bar dataKey="n" radius={[5, 5, 0, 0]}>
                  {data.avanceEgreso.map((d) => <Cell key={d.rango} fill={d.rango === 'Egresados' ? TEAL : 'url(#gradIndigo)'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <Vacio />}
        </Panel>
      </div>

      {/* Ranking de centros + estado de pagos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Panel titulo="Ranking de centros" icon={UserCheck} sub="Efectividad por gestor: % expediente completo, % pagado y % aprobación">
            {data && data.rankingCentros.length > 0 ? <RankingCentros data={data.rankingCentros} /> : <Vacio />}
          </Panel>
        </div>
        <Panel titulo="Estado de pagos" icon={DollarSign} sub="Exámenes por estado de pago">
          {data && data.pagosPorEstado.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={data.pagosPorEstado} dataKey="total" nameKey="estado" cx="50%" cy="50%" innerRadius={52} outerRadius={82} paddingAngle={3} cornerRadius={5}
                  label={(e: { estado: string; total: number }) => `${humaniza(e.estado)} (${e.total})`} labelLine={false} fontSize={11}>
                  {data.pagosPorEstado.map((d) => <Cell key={d.estado} fill={colorEstado(d.estado)} />)}
                </Pie>
                <Tooltip contentStyle={tooltipCls} formatter={(v: number, n: string) => [v, humaniza(n)]} />
              </PieChart>
            </ResponsiveContainer>
          ) : <Vacio />}
        </Panel>
      </div>
    </div>
  );
}

const selCls = 'text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white min-w-[110px] focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400';
const tooltipCls = { fontSize: 12, borderRadius: 10, border: `1px solid ${LINEA}`, boxShadow: '0 4px 12px rgba(15,23,42,.08)' } as const;

function Filtro({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: SLATE_500 }}>{label}</label>
      {children}
    </div>
  );
}

function Panel({ titulo, sub, icon: Icon, className, children }: { titulo: string; sub?: string; icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>; className?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-2xl border bg-white p-5 ${className ?? ''}`} style={{ borderColor: LINEA, boxShadow: '0 1px 3px rgba(15,23,42,.05)' }}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={15} style={{ color: INDIGO }} />
        <span className="text-sm font-bold" style={{ color: SLATE_900 }}>{titulo}</span>
      </div>
      {sub && <div className="text-[11px] mb-3" style={{ color: SLATE_400 }}>{sub}</div>}
      {children}
    </div>
  );
}

// Embudo de conversión: barras horizontales decrecientes con % de conversión.
function Embudo({ pasos }: { pasos: { paso: string; n: number }[] }) {
  const base = Math.max(1, pasos[0]?.n ?? 1);
  return (
    <div className="space-y-2.5 pt-1">
      {pasos.map((p, i) => {
        const pctBase = Math.round((p.n / base) * 100);      // % de los inscritos (la base)
        const prev = i > 0 ? pasos[i - 1].n : p.n;
        const caida = prev > 0 ? Math.round(((prev - p.n) / prev) * 100) : 0; // % que se cayó vs el paso previo
        return (
          <div key={p.paso} className="flex items-center gap-3">
            <div className="w-32 sm:w-40 shrink-0 text-right text-xs font-medium" style={{ color: SLATE_500 }}>{p.paso}</div>
            <div className="flex-1 h-9 rounded-lg overflow-hidden" style={{ background: '#f1f5f9' }}>
              <div className="h-full flex items-center px-3 rounded-lg" style={{ width: `${Math.max(6, pctBase)}%`, background: 'linear-gradient(90deg, #4338ca, #6366f1)', minWidth: 46 }}>
                <span className="text-sm font-bold text-white">{p.n}</span>
              </div>
            </div>
            <div className="w-12 shrink-0 text-xs font-bold text-right" style={{ color: SLATE_900 }}>{pctBase}%</div>
            <div className="w-20 shrink-0 text-[11px] font-semibold" style={{ color: i === 0 || caida <= 0 ? SLATE_400 : caida >= 50 ? ROSA : AMBAR }}>
              {i === 0 ? 'base' : caida > 0 ? `−${caida}% cae` : 'sin caída'}
            </div>
          </div>
        );
      })}
      <div className="text-[10px] pt-1" style={{ color: SLATE_400 }}>Barra y % = proporción sobre los inscritos (base). "Cae" = cuántos se pierden respecto al paso anterior.</div>
    </div>
  );
}

// Aprobación por módulo: barras horizontales, color según la tasa.
function AprobModulo({ data }: { data: { numero: number; nombre: string; evaluados: number; aprobados: number; tasa: number }[] }) {
  const color = (t: number) => (t >= 70 ? TEAL : t >= 50 ? AMBAR : ROSA);
  return (
    <div className="space-y-2 pt-1">
      {data.slice(0, 10).map((m) => (
        <div key={m.numero} className="flex items-center gap-3">
          <div className="w-6 shrink-0 text-xs font-bold text-center rounded" style={{ color: INDIGO, background: '#eef2ff' }}>{m.numero}</div>
          <div className="w-36 shrink-0 text-xs truncate" style={{ color: SLATE_500 }} title={m.nombre}>{m.nombre}</div>
          <div className="flex-1 h-6 rounded-md overflow-hidden" style={{ background: '#f1f5f9' }}>
            <div className="h-full rounded-md" style={{ width: `${Math.max(3, m.tasa)}%`, background: color(m.tasa) }} />
          </div>
          <div className="w-24 shrink-0 text-right text-xs font-bold" style={{ color: color(m.tasa) }}>
            {m.tasa}% <span className="font-normal" style={{ color: SLATE_400 }}>({m.aprobados}/{m.evaluados})</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// Ranking de centros: tabla con mini-barras de porcentaje.
function RankingCentros({ data }: { data: { gestor: string; municipio: string; alumnos: number; pctExpediente: number; pctPagado: number; pctAprobacion: number }[] }) {
  const Barra = ({ pct, color }: { pct: number; color: string }) => (
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-1.5 rounded-full overflow-hidden" style={{ background: '#f1f5f9' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[11px] font-semibold tabular-nums" style={{ color: SLATE_500 }}>{pct}%</span>
    </div>
  );
  return (
    <div className="overflow-auto">
      <table className="w-full text-xs">
        <thead>
          <tr style={{ color: SLATE_400 }}>
            <th className="text-left font-semibold pb-2">Centro / gestor</th>
            <th className="text-center font-semibold pb-2">Alumnos</th>
            <th className="text-left font-semibold pb-2">Expediente</th>
            <th className="text-left font-semibold pb-2">Pagado</th>
            <th className="text-left font-semibold pb-2">Aprobación</th>
          </tr>
        </thead>
        <tbody>
          {data.map((c, i) => (
            <tr key={i} className="border-t" style={{ borderColor: LINEA }}>
              <td className="py-2.5 pr-2">
                <div className="font-semibold" style={{ color: SLATE_900 }}>{c.gestor}</div>
                <div style={{ color: SLATE_400 }}>{c.municipio}</div>
              </td>
              <td className="py-2.5 text-center font-bold" style={{ color: INDIGO }}>{c.alumnos}</td>
              <td className="py-2.5"><Barra pct={c.pctExpediente} color={INDIGO} /></td>
              <td className="py-2.5"><Barra pct={c.pctPagado} color={TEAL} /></td>
              <td className="py-2.5"><Barra pct={c.pctAprobacion} color={c.pctAprobacion >= 60 ? TEAL : AMBAR} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Vacio() {
  return (
    <div className="flex h-[200px] flex-col items-center justify-center text-center text-sm" style={{ color: SLATE_400 }}>
      <BarChart2 size={24} className="mb-2 opacity-40" />
      Sin datos para este periodo
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ② Centro de descargas
// ─────────────────────────────────────────────────────────────

function CentroDescargas() {
  const [selected, setSelected] = useState<ReporteTipo | null>(null);
  const [formato, setFormato] = useState<Formato>('excel');
  const [filtros, setFiltros] = useState<Filtros>({ fechaInicio: '', fechaFin: '', municipioId: '', gestorId: '', etapaId: '' });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingDescarga, setLoadingDescarga] = useState(false);

  const [etapas, setEtapas] = useState<EtapaOpt[]>([]);
  const [gestores, setGestores] = useState<GestorOpt[]>([]);

  const [historial, setHistorial] = useState<Historial[]>([]);
  const [showHistorial, setShowHistorial] = useState(false);
  const [programados, setProgramados] = useState<Programado[]>([]);
  const [showProgramados, setShowProgramados] = useState(false);
  const [showModalProgramar, setShowModalProgramar] = useState(false);
  const [formProg, setFormProg] = useState({ nombre: '', tipo: 'inscripciones' as ReporteTipo, formato: 'excel' as Formato, frecuencia: 'semanal', emailDestino: '' });
  const [savingProg, setSavingProg] = useState(false);

  useEffect(() => {
    fetch('/api/admin/etapas', { credentials: 'include' }).then((r) => r.json()).then((d) => setEtapas(d.etapas ?? [])).catch(() => {});
    fetch('/api/admin/gestores-list', { credentials: 'include' }).then((r) => r.json()).then((d) => setGestores(d.gestores ?? [])).catch(() => {});
  }, []);

  const cargarPreview = useCallback(async () => {
    if (!selected) return;
    setLoadingPreview(true); setPreview(null);
    try {
      const res = await fetch('/api/admin/reportes/preview', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: selected, filtros: limpiaFiltros(filtros) }),
      });
      if (!res.ok) throw new Error(await res.text());
      setPreview(await res.json());
    } catch (e) { alert('Error al cargar vista previa: ' + String(e)); } finally { setLoadingPreview(false); }
  }, [selected, filtros]);

  const cargarHistorial = useCallback(async () => {
    try { const res = await fetch('/api/admin/reportes/historial', { credentials: 'include' }); setHistorial(await res.json()); } catch {}
  }, []);

  const descargar = useCallback(async () => {
    if (!selected) return;
    setLoadingDescarga(true);
    try {
      const res = await fetch('/api/admin/reportes/generar', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: selected, formato, filtros: limpiaFiltros(filtros) }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const ext = formato === 'excel' ? 'xlsx' : 'pdf';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${selected}_${new Date().toISOString().slice(0, 10)}.${ext}`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      cargarHistorial();
    } catch (e) { alert('Error al generar reporte: ' + String(e)); } finally { setLoadingDescarga(false); }
  }, [selected, formato, filtros, cargarHistorial]);

  const cargarProgramados = useCallback(async () => {
    try { const res = await fetch('/api/admin/reportes/programados', { credentials: 'include' }); setProgramados(await res.json()); } catch {}
  }, []);

  const toggleActivo = async (prog: Programado) => {
    try {
      const res = await fetch(`/api/admin/reportes/programados/${prog.id}`, {
        method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !prog.activo }),
      });
      if (res.ok) setProgramados((prev) => prev.map((p) => p.id === prog.id ? { ...p, activo: !p.activo } : p));
    } catch {}
  };
  const eliminarProgramado = async (id: number) => {
    if (!confirm('¿Eliminar reporte programado?')) return;
    await fetch(`/api/admin/reportes/programados/${id}`, { method: 'DELETE', credentials: 'include' });
    setProgramados((prev) => prev.filter((p) => p.id !== id));
  };
  const guardarProgramado = async () => {
    setSavingProg(true);
    try {
      const res = await fetch('/api/admin/reportes/programados', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formProg),
      });
      if (!res.ok) throw new Error(await res.text());
      const nuevo = await res.json();
      setProgramados((prev) => [nuevo, ...prev]);
      setShowModalProgramar(false);
    } catch (e) { alert('Error: ' + String(e)); } finally { setSavingProg(false); }
  };

  const sel = REPORTES.find((r) => r.tipo === selected);
  // Los filtros de etapa/centro solo aplican al reporte de exámenes por etapa.
  const usaEtapaCentro = selected === 'convocatorias';

  return (
    <div>
      {/* Documento oficial */}
      <RelacionExamenesCard etapas={etapas} gestores={gestores} setGestores={setGestores} />

      {/* Catálogo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {REPORTES.map(({ tipo, label, desc, icon: Icon }) => {
          const on = selected === tipo;
          return (
            <button key={tipo} onClick={() => { setSelected(on ? null : tipo); setPreview(null); }}
              className="text-left p-4 rounded-xl border transition-all"
              style={{ background: on ? '#fdf6fa' : 'white', borderColor: on ? GUINDA : '#eadfd7', borderWidth: on ? 2 : 1, boxShadow: on ? `0 0 0 3px ${GUINDA}18` : undefined }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2.5" style={{ background: on ? GUINDA : '#f5f0ea', color: on ? 'white' : GUINDA }}>
                <Icon size={16} />
              </div>
              <div className="text-sm font-semibold" style={{ color: on ? GUINDA : '#2a2a2a' }}>{label}</div>
              <div className="text-xs mt-0.5" style={{ color: '#6b635e', lineHeight: 1.4 }}>{desc}</div>
            </button>
          );
        })}
      </div>

      {/* Panel de filtros + generar */}
      {selected && (
        <div className="bg-white rounded-xl border border-stone-200 p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            {sel && <sel.icon size={16} style={{ color: GUINDA }} />}
            <span className="font-semibold text-sm" style={{ color: GUINDA }}>{sel?.label}</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
            {usaEtapaCentro && (
              <>
                <Campo label="Etapa">
                  <select className="w-full text-sm border border-stone-300 rounded-lg px-2 py-1.5 bg-white"
                    value={filtros.etapaId} onChange={(e) => setFiltros((f) => ({ ...f, etapaId: e.target.value }))}>
                    <option value="">Todas</option>
                    {etapas.map((et) => <option key={et.id} value={et.id}>Etapa {et.clave}</option>)}
                  </select>
                </Campo>
                <Campo label="Centro (gestor)">
                  <select className="w-full text-sm border border-stone-300 rounded-lg px-2 py-1.5 bg-white"
                    value={filtros.gestorId} onChange={(e) => setFiltros((f) => ({ ...f, gestorId: e.target.value }))}>
                    <option value="">Todos</option>
                    {gestores.map((g) => <option key={g.id} value={g.id}>{g.nombreCompleto}</option>)}
                  </select>
                </Campo>
              </>
            )}
            <Campo label="Fecha inicio">
              <input type="date" className="w-full text-sm border border-stone-300 rounded-lg px-2 py-1.5"
                value={filtros.fechaInicio} onChange={(e) => setFiltros((f) => ({ ...f, fechaInicio: e.target.value }))} />
            </Campo>
            <Campo label="Fecha fin">
              <input type="date" className="w-full text-sm border border-stone-300 rounded-lg px-2 py-1.5"
                value={filtros.fechaFin} onChange={(e) => setFiltros((f) => ({ ...f, fechaFin: e.target.value }))} />
            </Campo>
            <Campo label="Municipio ID">
              <input type="number" placeholder="Todos" className="w-full text-sm border border-stone-300 rounded-lg px-2 py-1.5"
                value={filtros.municipioId} onChange={(e) => setFiltros((f) => ({ ...f, municipioId: e.target.value }))} />
            </Campo>
            <Campo label="Formato">
              <select className="w-full text-sm border border-stone-300 rounded-lg px-2 py-1.5"
                value={formato} onChange={(e) => setFormato(e.target.value as Formato)}>
                <option value="excel">Excel (.xlsx)</option>
                <option value="pdf">PDF</option>
              </select>
            </Campo>
            <div className="flex items-end gap-2">
              <button onClick={cargarPreview} disabled={loadingPreview}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border"
                style={{ borderColor: '#ddd0c5', background: 'white', color: '#443e39' }}>
                {loadingPreview ? <RefreshCw size={13} className="animate-spin" /> : <BarChart2 size={13} />} Previa
              </button>
              <button onClick={descargar} disabled={loadingDescarga}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg text-white"
                style={{ background: GUINDA }}>
                {loadingDescarga ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13} />} Descargar
              </button>
            </div>
          </div>

          {preview && (
            <div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {preview.kpis.slice(0, 4).map((kpi, i) => (
                  <div key={i} className="rounded-lg p-3" style={{ background: '#fdf6fa', borderLeft: `3px solid ${GUINDA}` }}>
                    <div className="text-lg font-bold" style={{ color: GUINDA }}>{kpi.valor}{kpi.unidad ? ` ${kpi.unidad}` : ''}</div>
                    <div className="text-xs text-stone-500 mt-0.5">{kpi.label}</div>
                  </div>
                ))}
              </div>
              <div className="text-xs font-semibold text-stone-500 mb-1.5">
                Primeros registros — Total: {preview.totalRegistros.toLocaleString('es-MX')}
              </div>
              <div className="overflow-auto rounded-lg border border-stone-200" style={{ maxHeight: 300 }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: GUINDA }}>
                      {preview.columnas.map((col) => <th key={col} className="px-3 py-2 text-left font-semibold text-white whitespace-nowrap">{col}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.preview.map((fila, ri) => (
                      <tr key={ri} style={{ background: ri % 2 === 0 ? 'white' : '#fafafa' }}>
                        {fila.map((cell, ci) => (
                          <td key={ci} className="px-3 py-1.5 text-stone-700 whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis">{cell ?? '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Historial / Programados (colapsables) */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => { const n = !showHistorial; setShowHistorial(n); if (n) cargarHistorial(); }}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border" style={{ borderColor: '#ddd0c5', color: '#443e39', background: 'white' }}>
          <Clock size={14} /> Historial
        </button>
        <button onClick={() => { const n = !showProgramados; setShowProgramados(n); if (n) cargarProgramados(); }}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border" style={{ borderColor: '#ddd0c5', color: '#443e39', background: 'white' }}>
          <RefreshCw size={14} /> Programados
        </button>
        <button onClick={() => setShowModalProgramar(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg text-white" style={{ background: GUINDA }}>
          <Plus size={14} /> Programar reporte
        </button>
      </div>

      {showHistorial && (
        <div className="bg-white rounded-xl border border-stone-200 p-5 mb-6">
          <h2 className="text-sm font-semibold mb-3" style={{ color: GUINDA }}>Historial de reportes generados</h2>
          {historial.length === 0 ? <p className="text-sm text-stone-400 text-center py-6">Aún no se ha generado ningún reporte.</p> : (
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-stone-100">{['Nombre', 'Tipo', 'Formato', 'Registros', 'Tamaño', 'Generado', 'Estado'].map((h) => <th key={h} className="text-left px-2 py-2 text-stone-500 font-semibold">{h}</th>)}</tr></thead>
                <tbody>
                  {historial.map((h) => (
                    <tr key={h.id} className="border-b border-stone-50 hover:bg-stone-50">
                      <td className="px-2 py-2 font-medium text-stone-800">{h.nombre}</td>
                      <td className="px-2 py-2 text-stone-600">{h.tipo.replace(/_/g, ' ')}</td>
                      <td className="px-2 py-2"><span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: h.formato === 'excel' ? '#e8f5e9' : '#fce4ec', color: h.formato === 'excel' ? '#2e7d32' : '#c62828' }}>{h.formato.toUpperCase()}</span></td>
                      <td className="px-2 py-2">{h.totalRegistros?.toLocaleString('es-MX') ?? '—'}</td>
                      <td className="px-2 py-2">{h.tamanoBytes ? formatBytes(h.tamanoBytes) : '—'}</td>
                      <td className="px-2 py-2 text-stone-500">{fechaCorta(h.generadoEn ?? h.createdAt)}</td>
                      <td className="px-2 py-2"><span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: h.estado === 'listo' ? '#e8f5e9' : '#fff8e1', color: h.estado === 'listo' ? '#2e7d32' : '#f57f17' }}>{h.estado}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showProgramados && (
        <div className="bg-white rounded-xl border border-stone-200 p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold" style={{ color: GUINDA }}>Reportes programados</h2>
            <button onClick={() => setShowModalProgramar(true)} className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg text-white" style={{ background: GUINDA }}><Plus size={12} /> Nuevo</button>
          </div>
          {programados.length === 0 ? <p className="text-sm text-stone-400 text-center py-6">No hay reportes programados.</p> : (
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-stone-100">{['Nombre', 'Tipo', 'Frecuencia', 'Formato', 'Email destino', 'Próxima ejecución', 'Activo', ''].map((h) => <th key={h} className="text-left px-2 py-2 text-stone-500 font-semibold">{h}</th>)}</tr></thead>
                <tbody>
                  {programados.map((p) => (
                    <tr key={p.id} className="border-b border-stone-50 hover:bg-stone-50">
                      <td className="px-2 py-2 font-medium">{p.nombre}</td>
                      <td className="px-2 py-2 text-stone-600">{p.tipo.replace(/_/g, ' ')}</td>
                      <td className="px-2 py-2 capitalize">{p.frecuencia}</td>
                      <td className="px-2 py-2 uppercase">{p.formato}</td>
                      <td className="px-2 py-2 text-stone-500">{p.emailDestino}</td>
                      <td className="px-2 py-2 text-stone-500">{fechaCorta(p.proximaEjecucion)}</td>
                      <td className="px-2 py-2"><button onClick={() => toggleActivo(p)}>{p.activo ? <ToggleRight size={18} style={{ color: '#16a34a' }} /> : <ToggleLeft size={18} style={{ color: '#9ca3af' }} />}</button></td>
                      <td className="px-2 py-2"><button onClick={() => eliminarProgramado(p.id)}><Trash2 size={13} style={{ color: '#ef4444' }} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showModalProgramar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowModalProgramar(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold" style={{ color: GUINDA }}>Programar reporte automático</h3>
              <button onClick={() => setShowModalProgramar(false)}><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <Campo label="Nombre del reporte">
                <input className="w-full text-sm border rounded-lg px-3 py-2" value={formProg.nombre} onChange={(e) => setFormProg((f) => ({ ...f, nombre: e.target.value }))} placeholder="Ej. Inscripciones semanales" />
              </Campo>
              <Campo label="Tipo de reporte">
                <select className="w-full text-sm border rounded-lg px-3 py-2" value={formProg.tipo} onChange={(e) => setFormProg((f) => ({ ...f, tipo: e.target.value as ReporteTipo }))}>
                  {REPORTES.map((r) => <option key={r.tipo} value={r.tipo}>{r.label}</option>)}
                </select>
              </Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Formato">
                  <select className="w-full text-sm border rounded-lg px-3 py-2" value={formProg.formato} onChange={(e) => setFormProg((f) => ({ ...f, formato: e.target.value as Formato }))}>
                    <option value="excel">Excel (.xlsx)</option><option value="pdf">PDF</option>
                  </select>
                </Campo>
                <Campo label="Frecuencia">
                  <select className="w-full text-sm border rounded-lg px-3 py-2" value={formProg.frecuencia} onChange={(e) => setFormProg((f) => ({ ...f, frecuencia: e.target.value }))}>
                    {FRECUENCIAS.map((f) => <option key={f} value={f} className="capitalize">{f}</option>)}
                  </select>
                </Campo>
              </div>
              <Campo label="Email destino">
                <input type="email" className="w-full text-sm border rounded-lg px-3 py-2" value={formProg.emailDestino} onChange={(e) => setFormProg((f) => ({ ...f, emailDestino: e.target.value }))} placeholder="director@michoacan.gob.mx" />
              </Campo>
            </div>
            <div className="flex gap-2 mt-5">
              <button className="flex-1 py-2 text-sm font-medium rounded-lg border" style={{ borderColor: '#ddd0c5', color: '#443e39' }} onClick={() => setShowModalProgramar(false)}>Cancelar</button>
              <button className="flex-1 py-2 text-sm font-semibold rounded-lg text-white flex items-center justify-center gap-1.5" style={{ background: GUINDA }}
                onClick={guardarProgramado} disabled={savingProg || !formProg.nombre || !formProg.emailDestino}>
                {savingProg ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />} Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-wide text-stone-500 block mb-1">{label}</label>
      {children}
    </div>
  );
}

function limpiaFiltros(f: Filtros): Record<string, string> {
  const out: Record<string, string> = {};
  if (f.fechaInicio) out.fechaInicio = f.fechaInicio;
  if (f.fechaFin) out.fechaFin = f.fechaFin;
  if (f.municipioId) out.municipioId = f.municipioId;
  if (f.gestorId) out.gestorId = f.gestorId;
  if (f.etapaId) out.etapaId = f.etapaId;
  return out;
}

// ─────────────────────────────────────────────────────────────
// Relación de exámenes solicitados (documento oficial IEMSyS)
// ─────────────────────────────────────────────────────────────

function RelacionExamenesCard({ etapas, gestores, setGestores }: { etapas: EtapaOpt[]; gestores: GestorOpt[]; setGestores: React.Dispatch<React.SetStateAction<GestorOpt[]>> }) {
  const [etapaId, setEtapaId] = useState('');
  const [gestorId, setGestorId] = useState('');
  const [centro, setCentro] = useState({ centroAsesoria: '', claveCentro: '', rfcCentro: '' });
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState(false);

  const gestorSel = gestores.find((g) => String(g.id) === gestorId) ?? null;
  useEffect(() => {
    if (gestorSel) setCentro({ centroAsesoria: gestorSel.centroAsesoria ?? '', claveCentro: gestorSel.claveCentro ?? '', rfcCentro: gestorSel.rfcCentro ?? '' });
  }, [gestorId]); // eslint-disable-line

  async function guardarCentro() {
    if (!gestorId) return;
    setGuardando(true); setOk(false);
    try {
      await fetch(`/api/admin/gestores/${gestorId}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(centro) });
      setGestores((gs) => gs.map((g) => String(g.id) === gestorId ? { ...g, ...centro } : g));
      setOk(true); setTimeout(() => setOk(false), 2500);
    } finally { setGuardando(false); }
  }

  const puede = etapaId && gestorId;

  return (
    <div className="rounded-xl border mb-6 overflow-hidden" style={{ borderColor: '#e8c4d4' }}>
      <div className="px-5 py-3 flex items-center gap-2" style={{ background: 'linear-gradient(135deg,#6b1530,#4a0e20)' }}>
        <FileText size={16} className="text-white" />
        <div className="text-white font-semibold text-sm">Relación de exámenes solicitados</div>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-white/70">Documento oficial IEMSyS</span>
      </div>
      <div className="p-5 bg-white">
        <p className="text-sm text-stone-500 mb-4 max-w-3xl">
          Genera el documento oficial por centro de asesoría (gestor) y etapa, con la lista de alumnos, sus módulos, CURP e importe. Se autollena con los datos del sistema.
        </p>
        <div className="grid md:grid-cols-2 gap-3 mb-4">
          <Campo label="Etapa y fase">
            <select value={etapaId} onChange={(e) => setEtapaId(e.target.value)} className="w-full text-sm border border-stone-300 rounded-lg px-3 py-2 bg-white">
              <option value="">Elige la etapa…</option>
              {etapas.map((et) => <option key={et.id} value={et.id}>{et.etapa} {et.fase} · {et.anio}</option>)}
            </select>
          </Campo>
          <Campo label="Centro de asesoría (gestor)">
            <select value={gestorId} onChange={(e) => setGestorId(e.target.value)} className="w-full text-sm border border-stone-300 rounded-lg px-3 py-2 bg-white">
              <option value="">Elige el gestor…</option>
              {gestores.map((g) => <option key={g.id} value={g.id}>{g.nombreCompleto}{g.municipioNombre ? ` · ${g.municipioNombre}` : ''}</option>)}
            </select>
          </Campo>
        </div>

        {gestorSel && (
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 mb-4">
            <div className="text-xs font-semibold text-stone-600 mb-2">Datos del centro (se guardan en el gestor y se autollenan en el documento)</div>
            <div className="grid md:grid-cols-3 gap-2">
              <input value={centro.centroAsesoria} onChange={(e) => setCentro((c) => ({ ...c, centroAsesoria: e.target.value }))} placeholder="Nombre del centro (ej. Instituto IDEA)" className="text-sm border border-stone-300 rounded-lg px-3 py-2" />
              <input value={centro.claveCentro} onChange={(e) => setCentro((c) => ({ ...c, claveCentro: e.target.value }))} placeholder="Clave (ej. 010)" className="text-sm border border-stone-300 rounded-lg px-3 py-2" />
              <input value={centro.rfcCentro} onChange={(e) => setCentro((c) => ({ ...c, rfcCentro: e.target.value }))} placeholder="RFC del centro" className="text-sm border border-stone-300 rounded-lg px-3 py-2" />
            </div>
            <div className="flex items-center gap-2 mt-2">
              <button onClick={guardarCentro} disabled={guardando} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 hover:bg-white disabled:opacity-50">
                {guardando ? 'Guardando…' : 'Guardar datos del centro'}
              </button>
              {ok && <span className="text-xs text-green-600 font-semibold">Guardado ✓</span>}
            </div>
          </div>
        )}

        <button disabled={!puede} onClick={() => window.open(`/api/admin/relacion-examenes/pdf?etapaId=${etapaId}&gestorId=${gestorId}`, '_blank')}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg text-white disabled:opacity-40" style={{ background: GUINDA }}>
          <Download size={15} /> Generar documento (PDF)
        </button>
      </div>
    </div>
  );
}
