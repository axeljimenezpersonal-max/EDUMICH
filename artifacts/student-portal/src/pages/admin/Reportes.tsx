import { useState, useCallback, useEffect } from 'react';
import { fechaHoraCorta } from '../../lib/fechas';
import {
  BarChart2, Users, FileText, DollarSign, GraduationCap,
  UserCheck, Inbox, TrendingUp, Download, RefreshCw,
  Clock, Trash2, ToggleLeft, ToggleRight, Plus, X,
  UserPlus, CheckCircle2, Award, Send, Loader2, AlertTriangle, Trophy,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, CartesianGrid,
} from 'recharts';
import { AdminLayout } from './AdminLayout';
import { SectionTour } from '../../components/onboarding/SectionTour';
import { TOUR_A_REPORTES, GATE_ADMIN } from '../../components/onboarding/seccionesAdmin';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type ReporteTipo =
  | 'inscripciones' | 'expedientes' | 'financiero' | 'academico'
  | 'productividad_gestores' | 'relacion' | 'solicitudes' | 'ejecutivo';

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
  { tipo: 'relacion',             label: 'Relación de exámenes',   desc: 'Documento oficial IEMSyS por centro y convocatoria (PDF)',      icon: FileText },
  { tipo: 'financiero',           label: 'Financiero',             desc: 'Pagos recibidos, verificados y pendientes con montos',         icon: DollarSign },
  { tipo: 'academico',            label: 'Académico',              desc: 'Calificaciones, tasas de aprobación y progreso modular',       icon: GraduationCap },
  { tipo: 'expedientes',          label: 'Expedientes',            desc: 'Revisión de documentos por alumno y estado de aprobación',     icon: FileText },
  { tipo: 'productividad_gestores', label: 'Gestores',             desc: 'Productividad por gestor: alumnos, documentos y matrículas',   icon: UserCheck },
  { tipo: 'solicitudes',          label: 'Solicitudes de cuenta',  desc: 'Flujo de solicitudes públicas por estado y municipio',        icon: Inbox },
  { tipo: 'ejecutivo',            label: 'Ejecutivo',              desc: 'Consolidado con todos los KPI institucionales',                icon: TrendingUp },
];

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
// Tiempos SIEMPRE vía lib/fechas: la BD guarda UTC sin zona (ver parseDbDate).
function fechaCorta(iso: string | null): string {
  if (!iso) return '—';
  return fechaHoraCorta(iso);
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
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: INDIGO }}>
              <BarChart2 size={13} /> Reportes
            </div>
            <h1 className="font-serif text-3xl font-bold text-stone-900">Panel de indicadores</h1>
            <p className="text-sm text-stone-500 mt-0.5">Pulso de la operación en vivo. Abajo puedes descargar reportes filtrados.</p>
          </div>
        </div>

        <div data-tour="a-rep-indicadores"><PanelIndicadores /></div>

        <div className="my-8 flex items-center gap-3">
          <div className="h-px flex-1 bg-stone-200" />
          <span className="text-xs font-semibold uppercase tracking-widest text-stone-400">Descargar reportes</span>
          <div className="h-px flex-1 bg-stone-200" />
        </div>

        <CentroDescargas />
      </div>

      <SectionTour
        steps={TOUR_A_REPORTES}
        storageKey="edumich_sec_a_reportes_v1"
        gateKey={GATE_ADMIN}
        buttonLabel="Tutorial de reportes"
      />
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

      <SeccionLabel texto="Conversión" />
      {/* Embudo de conversión */}
      <Panel titulo="Embudo de conversión" icon={TrendingUp} sub={`De la inscripción al aprobado — % que sobrevive cada paso${data ? ` · ${data.solicitudesRecibidas} solicitudes recibidas` : ''}`} className="mb-4">
        {data && data.embudo.some((s) => s.n > 0) ? <Embudo pasos={data.embudo} /> : <Vacio />}
      </Panel>

      <SeccionLabel texto="Desempeño académico" />
      {/* Aprobación por módulo + avance hacia egreso */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2">
          <Panel titulo="Aprobación por módulo" icon={GraduationCap} sub="Ordenado del más reprobado al más aprobado — dónde reforzar">
            {data && data.aprobacionPorModulo.length > 0 ? <AprobModulo data={data.aprobacionPorModulo} /> : <Vacio />}
          </Panel>
        </div>
        <Panel titulo="Avance hacia egreso" icon={Award} sub="Cuántos alumnos van en cada tramo de módulos aprobados (de 22)">
          {data && data.avanceEgreso.some((d) => d.n > 0) ? (
            <>
              <ResponsiveContainer width="100%" height={210}>
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
              {(() => {
                const tot = data.avanceEgreso.reduce((s, d) => s + d.n, 0);
                const egr = data.avanceEgreso.find((d) => d.rango === 'Egresados')?.n ?? 0;
                const sinIniciar = data.avanceEgreso.find((d) => d.rango === 'Sin iniciar')?.n ?? 0;
                return (
                  <div className="text-[11px] mt-1 leading-relaxed" style={{ color: SLATE_500 }}>
                    <b style={{ color: SLATE_900 }}>{tot}</b> alumnos en total · <b style={{ color: TEAL }}>{egr}</b> ya egresaron (22 módulos) · <b style={{ color: SLATE_900 }}>{sinIniciar}</b> aún sin iniciar.
                  </div>
                );
              })()}
            </>
          ) : <Vacio />}
        </Panel>
      </div>

      <SeccionLabel texto="Operación por centro" />
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

// Color por porcentaje: rojo (crítico) → ámbar (en riesgo) → teal (bien).
function tono(pct: number, warn = 50, good = 70): string {
  return pct >= good ? TEAL : pct >= warn ? AMBAR : ROSA;
}

function SeccionLabel({ texto }: { texto: string }) {
  return (
    <div className="flex items-center gap-2 mb-2 mt-1">
      <span className="h-4 w-1 rounded-full" style={{ background: INDIGO }} />
      <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: INDIGO }}>{texto}</span>
    </div>
  );
}

function Leyenda({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5 text-[11px]" style={{ color: SLATE_500 }}>
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: it.color }} /> {it.label}
        </span>
      ))}
    </div>
  );
}

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
  // Detecta el paso donde más gente se cae (la fuga a atender).
  let peor = { paso: '', caida: 0 };
  for (let i = 1; i < pasos.length; i++) {
    const prev = pasos[i - 1].n;
    const c = prev > 0 ? Math.round(((prev - pasos[i].n) / prev) * 100) : 0;
    if (c > peor.caida) peor = { paso: pasos[i].paso, caida: c };
  }
  return (
    <div>
      {/* Encabezado de columnas */}
      <div className="flex items-center gap-3 pb-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: SLATE_400 }}>
        <div className="w-28 sm:w-40 shrink-0 text-right">Paso</div>
        <div className="flex-1">Alumnos que llegan</div>
        <div className="w-12 shrink-0 text-right">% del total</div>
        <div className="w-24 shrink-0">Fuga vs. anterior</div>
      </div>
      <div className="space-y-2.5">
        {pasos.map((p, i) => {
          const pctBase = Math.round((p.n / base) * 100);
          const prev = i > 0 ? pasos[i - 1].n : p.n;
          const caida = prev > 0 ? Math.round(((prev - p.n) / prev) * 100) : 0;
          return (
            <div key={p.paso} className="flex items-center gap-3">
              <div className="w-28 sm:w-40 shrink-0 text-right text-xs font-medium" style={{ color: SLATE_500 }}>{p.paso}</div>
              <div className="flex-1 h-9 rounded-lg overflow-hidden" style={{ background: '#f1f5f9' }}>
                <div className="h-full flex items-center px-3 rounded-lg" style={{ width: `${Math.max(6, pctBase)}%`, background: 'linear-gradient(90deg, #4338ca, #6366f1)', minWidth: 46 }}>
                  <span className="text-sm font-bold text-white">{p.n}</span>
                </div>
              </div>
              <div className="w-12 shrink-0 text-xs font-bold text-right" style={{ color: SLATE_900 }}>{pctBase}%</div>
              <div className="w-24 shrink-0 text-[11px] font-semibold" style={{ color: i === 0 || caida <= 0 ? SLATE_400 : caida >= 50 ? ROSA : AMBAR }}>
                {i === 0 ? '— base —' : caida > 0 ? `▼ ${caida}% se pierde` : 'sin pérdida'}
              </div>
            </div>
          );
        })}
      </div>
      {peor.caida > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-xs" style={{ background: '#fff1f2', color: ROSA }}>
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span><b>Mayor fuga en “{peor.paso}”:</b> se pierde el {peor.caida}% de los que venían del paso anterior. Es donde conviene actuar.</span>
        </div>
      )}
    </div>
  );
}

// Aprobación por módulo: barras horizontales, color según la tasa.
function AprobModulo({ data }: { data: { numero: number; nombre: string; evaluados: number; aprobados: number; tasa: number }[] }) {
  return (
    <div>
      <Leyenda items={[
        { color: ROSA, label: 'Crítico (<50%)' },
        { color: AMBAR, label: 'En riesgo (50–69%)' },
        { color: TEAL, label: 'Bien (≥70%)' },
      ]} />
      <div className="flex items-center gap-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: SLATE_400 }}>
        <div className="w-6 shrink-0" />
        <div className="w-36 shrink-0">Módulo</div>
        <div className="flex-1">% que aprueba</div>
        <div className="w-24 shrink-0 text-right">Aprob./eval.</div>
      </div>
      <div className="space-y-2">
        {data.slice(0, 10).map((m) => (
          <div key={m.numero} className="flex items-center gap-3">
            <div className="w-6 shrink-0 text-xs font-bold text-center rounded" style={{ color: INDIGO, background: '#eef2ff' }}>{m.numero}</div>
            <div className="w-36 shrink-0 text-xs truncate" style={{ color: SLATE_500 }} title={m.nombre}>{m.nombre}</div>
            <div className="flex-1 h-6 rounded-md overflow-hidden" style={{ background: '#f1f5f9' }}>
              <div className="h-full rounded-md" style={{ width: `${Math.max(3, m.tasa)}%`, background: tono(m.tasa) }} />
            </div>
            <div className="w-24 shrink-0 text-right text-xs font-bold" style={{ color: tono(m.tasa) }}>
              {m.tasa}% <span className="font-normal" style={{ color: SLATE_400 }}>({m.aprobados}/{m.evaluados})</span>
            </div>
          </div>
        ))}
      </div>
      <div className="text-[10px] pt-2" style={{ color: SLATE_400 }}>Ordenado de menor a mayor aprobación: los de arriba son donde más conviene reforzar.</div>
    </div>
  );
}

// Ranking de centros: tabla con mini-barras de porcentaje.
function RankingCentros({ data }: { data: { gestor: string; municipio: string; alumnos: number; pctExpediente: number; pctPagado: number; pctAprobacion: number }[] }) {
  // Ordena por aprobación (el ranking); a igualdad, por más alumnos.
  const orden = [...data].sort((a, b) => b.pctAprobacion - a.pctAprobacion || b.alumnos - a.alumnos);
  const Celda = ({ pct }: { pct: number }) => (
    <div className="flex items-center gap-1.5">
      <div className="w-14 h-1.5 rounded-full overflow-hidden" style={{ background: '#f1f5f9' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: tono(pct) }} />
      </div>
      <span className="text-[11px] font-bold tabular-nums w-8" style={{ color: tono(pct) }}>{pct}%</span>
    </div>
  );
  const medalla = ['#EAB308', '#94A3B8', '#B45309']; // oro, plata, bronce
  return (
    <div>
      <Leyenda items={[
        { color: ROSA, label: '<50% bajo' },
        { color: AMBAR, label: '50–69% medio' },
        { color: TEAL, label: '≥70% alto' },
      ]} />
      <div className="overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ color: SLATE_400 }}>
              <th className="text-left font-semibold pb-2 pl-1">#</th>
              <th className="text-left font-semibold pb-2">Centro / gestor</th>
              <th className="text-center font-semibold pb-2" title="Alumnos a cargo del gestor">Alumnos</th>
              <th className="text-left font-semibold pb-2" title="% de alumnos con los 5 documentos aprobados">Expediente</th>
              <th className="text-left font-semibold pb-2" title="% de alumnos con examen pagado">Pagado</th>
              <th className="text-left font-semibold pb-2" title="% de exámenes aprobados">Aprobación</th>
            </tr>
          </thead>
          <tbody>
            {orden.map((c, i) => (
              <tr key={i} className="border-t" style={{ borderColor: LINEA }}>
                <td className="py-2.5 pl-1">
                  {i < 3
                    ? <Trophy size={14} style={{ color: medalla[i] }} />
                    : <span className="text-[11px] font-bold" style={{ color: SLATE_400 }}>{i + 1}</span>}
                </td>
                <td className="py-2.5 pr-2">
                  <div className="font-semibold" style={{ color: SLATE_900 }}>{c.gestor}</div>
                  <div style={{ color: SLATE_400 }}>{c.municipio}</div>
                </td>
                <td className="py-2.5 text-center font-bold" style={{ color: INDIGO }}>{c.alumnos}</td>
                <td className="py-2.5"><Celda pct={c.pctExpediente} /></td>
                <td className="py-2.5"><Celda pct={c.pctPagado} /></td>
                <td className="py-2.5"><Celda pct={c.pctAprobacion} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-[10px] pt-2" style={{ color: SLATE_400 }}>Ordenado por % de aprobación. Verde = va bien, rojo = necesita apoyo.</div>
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
  // La Relación de exámenes viene preseleccionada: es el reporte que más se
  // emite, así que su panel está listo al entrar sin un clic de más. Se puede
  // deseleccionar tocando su tarjeta, igual que cualquier otra.
  const [selected, setSelected] = useState<ReporteTipo | null>('relacion');
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
    // Relación en PDF = documento oficial IEMSyS (requiere convocatoria y centro).
    if (selected === 'relacion' && formato === 'pdf') {
      if (!filtros.etapaId || !filtros.gestorId) { alert('Para el PDF oficial elige una convocatoria y un centro.'); return; }
      window.open(`/api/admin/relacion-examenes/pdf?etapaId=${filtros.etapaId}&gestorId=${filtros.gestorId}`, '_blank');
      return;
    }
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

  const esRelacion = selected === 'relacion';

  return (
    <div>
      {/* Catálogo */}
      <div data-tour="a-rep-catalogo" className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {REPORTES.map(({ tipo, label, desc, icon: Icon }) => {
          const on = selected === tipo;
          return (
            <button key={tipo} data-tour={tipo === 'relacion' ? 'a-rep-relacion' : undefined}
              onClick={() => { setSelected(on ? null : tipo); setPreview(null); }}
              className="text-left p-4 rounded-2xl border transition-all hover:-translate-y-0.5"
              style={{ background: on ? '#eef2ff' : 'white', borderColor: on ? INDIGO : LINEA, borderWidth: on ? 2 : 1, boxShadow: on ? `0 0 0 3px ${INDIGO}1a` : '0 1px 3px rgba(15,23,42,.05)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2.5" style={{ background: on ? INDIGO : '#f1f5f9', color: on ? 'white' : INDIGO }}>
                <Icon size={16} />
              </div>
              <div className="text-sm font-semibold" style={{ color: on ? INDIGO : SLATE_900 }}>{label}</div>
              <div className="text-xs mt-0.5" style={{ color: SLATE_500, lineHeight: 1.4 }}>{desc}</div>
            </button>
          );
        })}
      </div>

      {/* Panel de filtros + generar */}
      {selected && (
        <div className="rounded-2xl border bg-white p-5 mb-6" style={{ borderColor: LINEA, boxShadow: '0 1px 3px rgba(15,23,42,.05)' }}>
          <div className="flex items-center gap-2 mb-1">
            {sel && <sel.icon size={16} style={{ color: INDIGO }} />}
            <span className="font-bold text-sm" style={{ color: SLATE_900 }}>{sel?.label}</span>
            {esRelacion && <span className="ml-1 text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: '#eef2ff', color: INDIGO }}>Oficial IEMSyS</span>}
          </div>
          <div className="text-[11px] mb-4" style={{ color: SLATE_400 }}>
            {esRelacion
              ? 'Documento oficial por centro y convocatoria, con la lista de alumnos, sus módulos, CURP e importe. Se autollena con los datos del sistema.'
              : 'Elige la convocatoria y el centro; luego previsualiza o descarga.'}
          </div>

          <>
          <div data-tour="a-rep-config" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4 items-end">
            <Campo label="Convocatoria">
              <select className={selCls + ' w-full'}
                value={filtros.etapaId} onChange={(e) => setFiltros((f) => ({ ...f, etapaId: e.target.value }))}>
                <option value="">{esRelacion ? 'Elige la convocatoria…' : 'Todas las convocatorias'}</option>
                {etapas.map((et) => <option key={et.id} value={et.id}>Etapa {et.clave} · {et.anio}</option>)}
              </select>
            </Campo>
            <Campo label="Centro de asesoría (gestor)">
              <select className={selCls + ' w-full'}
                value={filtros.gestorId} onChange={(e) => setFiltros((f) => ({ ...f, gestorId: e.target.value }))}>
                <option value="">{esRelacion ? 'Elige el centro…' : 'Todos los centros'}</option>
                {gestores.map((g) => <option key={g.id} value={g.id}>{g.nombreCompleto}</option>)}
              </select>
            </Campo>
            <Campo label="Formato">
              <select className={selCls + ' w-full'}
                value={formato} onChange={(e) => setFormato(e.target.value as Formato)}>
                <option value="excel">Excel (.xlsx)</option>
                <option value="pdf">PDF</option>
              </select>
            </Campo>
            <div data-tour="a-rep-acciones" className="flex gap-2">
              <button onClick={cargarPreview} disabled={loadingPreview}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg border transition-colors hover:bg-slate-50"
                style={{ borderColor: '#cbd5e1', background: 'white', color: SLATE_900 }}>
                {loadingPreview ? <RefreshCw size={13} className="animate-spin" /> : <BarChart2 size={13} />} Previa
              </button>
              <button onClick={descargar} disabled={loadingDescarga}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg text-white"
                style={{ background: INDIGO }}>
                {loadingDescarga ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13} />} Descargar
              </button>
            </div>
          </div>

          {esRelacion && (
            <>
              {filtros.gestorId && <EditorCentro gestorId={filtros.gestorId} gestores={gestores} setGestores={setGestores} />}
              <div className="text-[11px] mb-4 flex items-center gap-1.5" style={{ color: SLATE_400 }}>
                <FileText size={12} /> En <b>PDF</b> obtienes el documento oficial IEMSyS; en <b>Excel</b>, la tabla de datos. La vista previa muestra los alumnos incluidos.
              </div>
            </>
          )}

          {preview && (
            <div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {preview.kpis.slice(0, 4).map((kpi, i) => (
                  <div key={i} className="rounded-xl p-3" style={{ background: '#f8fafc', borderLeft: `3px solid ${INDIGO}` }}>
                    <div className="text-lg font-bold" style={{ color: SLATE_900 }}>{kpi.valor}{kpi.unidad ? ` ${kpi.unidad}` : ''}</div>
                    <div className="text-xs mt-0.5" style={{ color: SLATE_500 }}>{kpi.label}</div>
                  </div>
                ))}
              </div>
              <div className="text-xs font-semibold mb-1.5" style={{ color: SLATE_500 }}>
                Primeros registros — Total: {preview.totalRegistros.toLocaleString('es-MX')}
              </div>
              <div className="overflow-auto rounded-xl border" style={{ maxHeight: 300, borderColor: LINEA }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: INDIGO }}>
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
          </>
        </div>
      )}

      {/* Historial / Programados (colapsables) */}
      <div data-tour="a-rep-programar" className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => { const n = !showHistorial; setShowHistorial(n); if (n) cargarHistorial(); }}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border" style={{ borderColor: '#ddd0c5', color: '#443e39', background: 'white' }}>
          <Clock size={14} /> Historial
        </button>
        <button onClick={() => { const n = !showProgramados; setShowProgramados(n); if (n) cargarProgramados(); }}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border" style={{ borderColor: '#ddd0c5', color: '#443e39', background: 'white' }}>
          <RefreshCw size={14} /> Programados
        </button>
        <button onClick={() => setShowModalProgramar(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg text-white" style={{ background: INDIGO }}>
          <Plus size={14} /> Programar reporte
        </button>
      </div>

      {showHistorial && (
        <div className="bg-white rounded-xl border border-stone-200 p-5 mb-6">
          <h2 className="text-sm font-semibold mb-3" style={{ color: INDIGO }}>Historial de reportes generados</h2>
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
            <h2 className="text-sm font-semibold" style={{ color: INDIGO }}>Reportes programados</h2>
            <button onClick={() => setShowModalProgramar(true)} className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg text-white" style={{ background: INDIGO }}><Plus size={12} /> Nuevo</button>
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
              <h3 className="text-base font-bold" style={{ color: INDIGO }}>Programar reporte automático</h3>
              <button onClick={() => setShowModalProgramar(false)}><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <Campo label="Nombre del reporte">
                <input className="w-full text-sm border rounded-lg px-3 py-2" value={formProg.nombre} onChange={(e) => setFormProg((f) => ({ ...f, nombre: e.target.value }))} placeholder="Ej. Inscripciones semanales" />
              </Campo>
              <Campo label="Tipo de reporte">
                <select className="w-full text-sm border rounded-lg px-3 py-2" value={formProg.tipo} onChange={(e) => setFormProg((f) => ({ ...f, tipo: e.target.value as ReporteTipo }))}>
                  {REPORTES.filter((r) => r.tipo !== 'relacion').map((r) => <option key={r.tipo} value={r.tipo}>{r.label}</option>)}
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
              <button className="flex-1 py-2 text-sm font-semibold rounded-lg text-white flex items-center justify-center gap-1.5" style={{ background: INDIGO }}
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
// Editor de datos del centro (para la Relación oficial): se guardan en el gestor
// y se autollenan en el documento. Aparece al elegir un centro en la Relación.
// ─────────────────────────────────────────────────────────────

function EditorCentro({ gestorId, gestores, setGestores }: { gestorId: string; gestores: GestorOpt[]; setGestores: React.Dispatch<React.SetStateAction<GestorOpt[]>> }) {
  const [centro, setCentro] = useState({ centroAsesoria: '', claveCentro: '', rfcCentro: '' });
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState(false);

  const gestorSel = gestores.find((g) => String(g.id) === gestorId) ?? null;
  useEffect(() => {
    if (gestorSel) setCentro({ centroAsesoria: gestorSel.centroAsesoria ?? '', claveCentro: gestorSel.claveCentro ?? '', rfcCentro: gestorSel.rfcCentro ?? '' });
  }, [gestorId]); // eslint-disable-line

  async function guardarCentro() {
    setGuardando(true); setOk(false);
    try {
      await fetch(`/api/admin/gestores/${gestorId}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(centro) });
      setGestores((gs) => gs.map((g) => String(g.id) === gestorId ? { ...g, ...centro } : g));
      setOk(true); setTimeout(() => setOk(false), 2500);
    } finally { setGuardando(false); }
  }

  return (
    <div className="rounded-xl border p-3 mb-4" style={{ borderColor: LINEA, background: '#f8fafc' }}>
      <div className="text-xs font-semibold mb-2" style={{ color: SLATE_500 }}>Datos del centro (se guardan en el gestor y se autollenan en el documento)</div>
      <div className="grid md:grid-cols-3 gap-2">
        <input value={centro.centroAsesoria} onChange={(e) => setCentro((c) => ({ ...c, centroAsesoria: e.target.value }))} placeholder="Nombre del centro (ej. Instituto IDEA)" className="text-sm border border-slate-300 rounded-lg px-3 py-2" />
        <input value={centro.claveCentro} onChange={(e) => setCentro((c) => ({ ...c, claveCentro: e.target.value }))} placeholder="Clave (ej. 010)" className="text-sm border border-slate-300 rounded-lg px-3 py-2" />
        <input value={centro.rfcCentro} onChange={(e) => setCentro((c) => ({ ...c, rfcCentro: e.target.value }))} placeholder="RFC del centro" className="text-sm border border-slate-300 rounded-lg px-3 py-2" />
      </div>
      <div className="flex items-center gap-2 mt-2">
        <button onClick={guardarCentro} disabled={guardando} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-white disabled:opacity-50">
          {guardando ? 'Guardando…' : 'Guardar datos del centro'}
        </button>
        {ok && <span className="text-xs text-green-600 font-semibold">Guardado ✓</span>}
      </div>
    </div>
  );
}
