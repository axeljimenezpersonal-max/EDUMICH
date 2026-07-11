import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import {
  Home, Users, UserCheck,
  GraduationCap, BarChart2, Download, Zap, ArrowRight, TrendingUp,
  FileCheck, Flag, Check, X, Mail, Folder, CreditCard, Inbox,
} from 'lucide-react';
import { api } from '../../lib/api';
import { AdminLayout } from './AdminLayout';
import { AvisosCalendario } from '../../components/AvisosCalendario';

// ── Types ──────────────────────────────────────────────────────────────────────

type DashboardData = {
  greeting: {
    nombreAdmin: string;
    fechaHoy: string;
    accesosHoy: number;
    totalTareasPendientes: number;
  };
  convocatoriaActiva: {
    id: number;
    clave: string;
    titulo: string;
    inscritos: number;
    diasParaCierre: number;
    fase: string;
  } | null;
  tareasPendientes: {
    documentosPorRevisar: number;
    pagosPorEmitir: number;
    pagosPorRevisar: number;
    solicitudesCuenta: number;
  };
  kpisGenerales: {
    alumnosActivos: { total: number; deltaSemana: number };
    gestoresActivos: { total: number; municipiosCubiertos: number };
    expedientesCompletos: { completos: number; total: number; deltaSemana: number };
    egresados: { total: number; deltaMes: number };
  };
  graficaInscripciones: {
    etapas: Array<{ clave: string; inscritos: number; activa: boolean; futura: boolean }>;
  };
  actividadReciente: Array<{
    id: number;
    tipo: string;
    actorNombre: string;
    actorRol: string;
    descripcion: string;
    descripcionExtra: string | null;
    referencia: string | null;
    creadoEn: string;
  }>;
  alumnosRecientes: Array<{
    id: number;
    nombreCompleto: string;
    iniciales: string;
    municipio: string | null;
    gestorNombre: string | null;
    estadoExpediente: 'activo' | 'esperando_matricula' | 'pago_pendiente' | 'en_proceso' | 'rechazado' | 'sin_documentos' | 'inactivo';
    estadoTexto: string;
    creadoEn: string;
  }>;
  topMunicipios: Array<{ municipio: string; count: number; porcentaje: number }>;
  _meta: { etapaActivaId: number | null };
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function saludo(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function tiempoRelativo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'Hace un momento';
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
  return `Hace ${Math.floor(diff / 86400)} días`;
}

function apellido(nombre: string): string {
  const parts = nombre.trim().split(/\s+/);
  return parts[parts.length - 1] ?? nombre;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ActivityIcon({ tipo }: { tipo: string }) {
  const configs: Record<string, { Icon: typeof Check; bg: string; color: string }> = {
    alumno_registrado:    { Icon: UserCheck,    bg: '#fbe6ea', color: 'var(--color-guinda-700)' },
    pago_verificado:      { Icon: Check,        bg: '#d1fae5', color: '#2d7d46' },
    pago_rechazado:       { Icon: X,            bg: '#fee2e2', color: '#b91c1c' },
    calificacion_capturada: { Icon: GraduationCap, bg: '#d1fae5', color: '#2d7d46' },
    solicitud_aprobada:   { Icon: Check,        bg: '#d1fae5', color: '#2d7d46' },
    solicitud_rechazada:  { Icon: X,            bg: '#fee2e2', color: '#b91c1c' },
  };
  const cfg = configs[tipo] ?? { Icon: Mail, bg: '#dbeafe', color: '#1e40af' };
  const { Icon, bg, color } = cfg;
  return (
    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: bg, color }}>
      <Icon size={13} />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AdminInicio() {
  const [, setLocation] = useLocation();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<DashboardData>('/admin/dashboard')
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminLayout>
      {loading ? (
        <div className="flex items-center justify-center py-24 text-stone-400 text-sm">
          Cargando panel...
        </div>
      ) : (
        <>
          {/* Page header */}
          <div className="flex items-start justify-between mb-6 flex-wrap gap-5">
            <div>
              <div
                className="flex items-center gap-1.5 text-[11px] font-semibold uppercase mb-1.5"
                style={{ color: 'var(--color-guinda-700)', letterSpacing: '0.15em' }}
              >
                <Home size={12} /> INICIO · ADMINISTRACIÓN
              </div>
              <h1
                className="text-[30px] font-bold tracking-tight"
                style={{ fontFamily: "'Poppins', sans-serif", color: '#2a2a2a', lineHeight: 1.1 }}
              >
                {saludo()}, {data?.greeting.nombreAdmin ? apellido(data.greeting.nombreAdmin) : 'Administrador'}
              </h1>
              <p className="text-sm mt-1 capitalize" style={{ color: '#6b635e' }}>
                {data?.greeting.fechaHoy} · Tienes {data?.greeting.totalTareasPendientes ?? 0} tareas pendientes hoy
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-white border border-stone-200 rounded-[10px] px-3.5 py-2.5 flex items-center gap-2.5">
                <div>
                  <div className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: '#6b635e' }}>Día activo</div>
                  <div className="font-bold text-lg leading-none mt-0.5" style={{ fontFamily: "'Poppins', sans-serif", color: '#2a2a2a' }}>
                    {data?.greeting.accesosHoy ?? 0}{' '}
                    <span className="text-[11px] font-medium" style={{ color: '#6b635e' }}>accesos</span>
                  </div>
                </div>
              </div>
              <button
                className="flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold text-white rounded-md"
                style={{ background: 'var(--color-guinda-700)' }}
              >
                <Download size={14} /> Reportes
              </button>
            </div>
          </div>

          {/* Convocatoria strip */}
          {data?.convocatoriaActiva ? (
            <ConvocatoriaStrip conv={data.convocatoriaActiva} />
          ) : (
            <div
              className="rounded-xl text-white px-7 py-5 mb-6 flex items-center gap-4"
              style={{ background: 'linear-gradient(135deg, #6B1530 0%, #4a0e20 100%)' }}
            >
              <Flag size={24} style={{ opacity: 0.7 }} />
              <p className="text-sm" style={{ opacity: 0.9 }}>No hay convocatoria activa en este momento.</p>
            </div>
          )}

          {/* Fechas del calendario oficial (ventana de solicitud/pago, examen) */}
          <div className="mb-6"><AvisosCalendario /></div>

          {/* KPIs generales — Vista general del sistema */}
          <div className="mb-8">
            <div
              className="flex items-center gap-2.5 mb-4 font-bold text-base tracking-tight"
              style={{ fontFamily: "'Poppins', sans-serif", color: '#2a2a2a' }}
            >
              <div
                className="w-[30px] h-[30px] rounded-[7px] flex items-center justify-center"
                style={{ background: '#fbe6ea', color: 'var(--color-guinda-700)' }}
              >
                <BarChart2 size={14} />
              </div>
              Vista general del sistema
            </div>

            <div className="grid grid-cols-4 gap-3.5">
              <KpiCard
                icon={<Users size={18} />}
                num={data?.kpisGenerales.alumnosActivos.total ?? 0}
                label="Alumnos activos"
                delta={`+${data?.kpisGenerales.alumnosActivos.deltaSemana ?? 0}`}
                deltaUp
                sub={<><strong style={{ color: '#2a2a2a' }}>+{data?.kpisGenerales.alumnosActivos.deltaSemana ?? 0}</strong> esta semana</>}
              />
              <KpiCard
                icon={<UserCheck size={18} />}
                num={data?.kpisGenerales.gestoresActivos.total ?? 0}
                label="Gestores municipales"
                delta="="
                deltaFlat
                sub={<><strong style={{ color: '#2a2a2a' }}>{data?.kpisGenerales.gestoresActivos.municipiosCubiertos ?? 0}</strong> municipios cubiertos</>}
              />
              <KpiCard
                icon={<FileCheck size={18} />}
                numEl={
                  <span>
                    {data?.kpisGenerales.expedientesCompletos.completos ?? 0}
                    <small style={{ fontSize: 16, color: '#6b635e', fontWeight: 500 }}>
                      /{data?.kpisGenerales.expedientesCompletos.total ?? 0}
                    </small>
                  </span>
                }
                label="Expedientes completos"
                delta={`+${data?.kpisGenerales.expedientesCompletos.deltaSemana ?? 0}`}
                deltaUp
                sub={
                  data?.kpisGenerales.expedientesCompletos.total
                    ? <><strong style={{ color: '#2a2a2a' }}>{Math.round((data.kpisGenerales.expedientesCompletos.completos / data.kpisGenerales.expedientesCompletos.total) * 100)}%</strong> del total</>
                    : <>0% del total</>
                }
              />
              <KpiCard
                icon={<GraduationCap size={18} />}
                num={data?.kpisGenerales.egresados.total ?? 0}
                label="Egresados este año"
                delta={`+${data?.kpisGenerales.egresados.deltaMes ?? 0}`}
                deltaUp
                sub={<><strong style={{ color: '#2a2a2a' }}>21/21</strong> módulos aprobados</>}
              />
            </div>
          </div>

          {/* Tareas pendientes */}
          <div className="mb-8">
            <div
              className="flex items-center gap-2.5 mb-4 font-bold text-base tracking-tight"
              style={{ fontFamily: "'Poppins', sans-serif", color: '#2a2a2a' }}
            >
              <div
                className="w-[30px] h-[30px] rounded-[7px] flex items-center justify-center"
                style={{ background: '#fbe6ea', color: 'var(--color-guinda-700)' }}
              >
                <Zap size={14} />
              </div>
              Tu día de hoy — Tareas pendientes
              <span className="ml-auto text-xs font-medium" style={{ color: '#6b635e', fontFamily: 'Inter, sans-serif' }}>
                Click en cualquier tarjeta para ir directo
              </span>
            </div>

            <div className="grid grid-cols-4 gap-3.5">
              <TareaCard
                variant="revision"
                icon={<Folder size={22} />}
                num={data?.tareasPendientes.documentosPorRevisar ?? 0}
                label="Documentos por revisar"
                cta="Revisar ahora"
                onClick={() => setLocation('/admin/alumnos?filtro=docs_en_revision')}
              />
              <TareaCard
                variant="pendiente"
                icon={<FileCheck size={22} />}
                num={data?.tareasPendientes.pagosPorEmitir ?? 0}
                label="Pagos por emitir"
                cta="Emitir línea de captura"
                onClick={() => setLocation('/admin/ordenes-pago?estado=pendiente_emision')}
              />
              <TareaCard
                variant="guinda"
                icon={<CreditCard size={22} />}
                num={data?.tareasPendientes.pagosPorRevisar ?? 0}
                label="Pagos por revisar"
                cta="Verificar contra banco"
                onClick={() => setLocation('/admin/ordenes-pago?estado=en_revision')}
              />
              <TareaCard
                variant="info"
                icon={<Inbox size={22} />}
                num={data?.tareasPendientes.solicitudesCuenta ?? 0}
                label="Solicitudes de cuenta"
                cta="Aprobar o rechazar"
                onClick={() => setLocation('/admin/solicitudes')}
              />
            </div>
          </div>

          {/* Gráfica + Actividad reciente */}
          <div className="grid gap-4 mb-8" style={{ gridTemplateColumns: '1.6fr 1fr' }}>
            <GraficaEtapas etapas={data?.graficaInscripciones.etapas ?? []} />
            <ActividadReciente actividad={data?.actividadReciente ?? []} />
          </div>

          {/* Alumnos recientes + top municipios */}
          <div className="grid gap-4 mb-8" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
            <AlumnosRecientes
              alumnos={data?.alumnosRecientes ?? []}
              total={data?.kpisGenerales.alumnosActivos.total ?? 0}
            />
            <TopMunicipios municipios={data?.topMunicipios ?? []} />
          </div>
        </>
      )}
    </AdminLayout>
  );
}

// ── Convocatoria strip ─────────────────────────────────────────────────────────

function ConvocatoriaStrip({ conv }: { conv: NonNullable<DashboardData['convocatoriaActiva']> }) {
  return (
    <div
      className="rounded-xl text-white px-7 py-5 mb-6 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #6B1530 0%, #4a0e20 100%)',
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto auto',
        gap: 24,
        alignItems: 'center',
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 90% 30%, rgba(255,255,255,0.15) 0%, transparent 50%)' }}
      />
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center relative"
        style={{ background: 'rgba(255,255,255,0.15)' }}
      >
        <Flag size={28} />
      </div>
      <div className="relative">
        <div className="text-[11px] uppercase font-semibold tracking-widest mb-0.5" style={{ opacity: 0.85 }}>CONVOCATORIA ACTIVA</div>
        <h3 className="text-[22px] font-bold tracking-tight mt-0.5" style={{ fontFamily: "'Poppins', sans-serif" }}>
          {conv.titulo}
        </h3>
        <div className="text-[13px] mt-1" style={{ opacity: 0.9 }}>{conv.inscritos} alumnos inscritos</div>
      </div>
      <div className="relative text-center border-l border-white/20 pl-6">
        <div className="text-[36px] font-bold leading-none tracking-tight" style={{ fontFamily: "'Poppins', sans-serif" }}>
          {conv.diasParaCierre}
        </div>
        <div className="text-[11px] uppercase tracking-wide mt-1" style={{ opacity: 0.85 }}>Días para cierre</div>
      </div>
      <a
        href="/admin/convocatorias"
        className="relative flex items-center gap-1.5 px-4 py-2.5 font-bold text-[13px] rounded-lg no-underline"
        style={{ background: 'white', color: 'var(--color-guinda-700)' }}
      >
        Ver detalle <ArrowRight size={14} />
      </a>
    </div>
  );
}

// ── Tarea card ─────────────────────────────────────────────────────────────────

type TareaVariant = 'pendiente' | 'revision' | 'info' | 'guinda';

const tareaStyles: Record<TareaVariant, { iconBg: string; iconColor: string; ctaColor: string }> = {
  pendiente: { iconBg: '#fef9c3', iconColor: '#c77700', ctaColor: '#c77700' },
  revision:  { iconBg: '#f3e8ff', iconColor: '#6b21a8', ctaColor: '#6b21a8' },
  info:      { iconBg: '#dbeafe', iconColor: '#1e40af', ctaColor: '#1e40af' },
  guinda:    { iconBg: '#fbe6ea', iconColor: 'var(--color-guinda-700)', ctaColor: 'var(--color-guinda-700)' },
};

function TareaCard({
  variant, icon, num, label, cta, onClick,
}: {
  variant: TareaVariant;
  icon: React.ReactNode;
  num: number;
  label: string;
  cta: string;
  onClick: () => void;
}) {
  const s = tareaStyles[variant];
  return (
    <button
      onClick={onClick}
      className="block bg-white border border-stone-200 rounded-xl p-5 relative overflow-hidden transition-all hover:-translate-y-1 text-left w-full"
      style={{ cursor: 'pointer' }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 20px rgba(0,0,0,0.06)';
        (e.currentTarget as HTMLElement).style.borderColor = '#c43759';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = '';
        (e.currentTarget as HTMLElement).style.borderColor = '#eadfd7';
      }}
    >
      <div className="w-11 h-11 rounded-[10px] flex items-center justify-center mb-3" style={{ background: s.iconBg, color: s.iconColor }}>
        {icon}
      </div>
      <div className="text-[38px] font-bold leading-none mb-1 tracking-tight" style={{ fontFamily: "'Poppins', sans-serif", color: '#2a2a2a' }}>
        {num}
      </div>
      <div className="text-sm font-semibold mb-2" style={{ fontFamily: "'Poppins', sans-serif", color: '#443e39' }}>
        {label}
      </div>
      <div className="flex items-center gap-1 text-[12px] font-semibold" style={{ color: s.ctaColor }}>
        {cta} <ArrowRight size={12} />
      </div>
    </button>
  );
}

// ── KPI card ───────────────────────────────────────────────────────────────────

function KpiCard({
  icon, num, numEl, label, delta, deltaUp, deltaFlat, sub,
}: {
  icon: React.ReactNode;
  num?: number;
  numEl?: React.ReactNode;
  label: string;
  delta: string;
  deltaUp?: boolean;
  deltaFlat?: boolean;
  sub: React.ReactNode;
}) {
  const trendBg    = deltaFlat ? '#f7f2ed' : deltaUp ? '#d1fae5' : '#fee2e2';
  const trendColor = deltaFlat ? '#6b635e' : deltaUp ? '#2d7d46' : '#b91c1c';
  return (
    <div className="bg-white border border-stone-200 rounded-xl" style={{ padding: '18px 20px' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#f8f4ec', color: 'var(--color-guinda-700)' }}>
          {icon}
        </div>
        <span
          className="text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
          style={{ background: trendBg, color: trendColor }}
        >
          {deltaUp && <TrendingUp size={11} />}
          {delta}
        </span>
      </div>
      <div className="text-[32px] font-bold leading-none tracking-tight mt-3.5 mb-1" style={{ fontFamily: "'Poppins', sans-serif", color: '#2a2a2a' }}>
        {numEl ?? num}
      </div>
      <div className="text-xs font-medium" style={{ color: '#6b635e' }}>{label}</div>
      <div className="text-[11px] flex items-center gap-1 mt-2 pt-2" style={{ color: '#6b635e', borderTop: '1px solid #f7f2ed' }}>
        {sub}
      </div>
    </div>
  );
}

// ── Gráfica de etapas ──────────────────────────────────────────────────────────

function GraficaEtapas({ etapas }: { etapas: DashboardData['graficaInscripciones']['etapas'] }) {
  const maxVal = Math.max(...etapas.map((e) => e.inscritos), 1);
  return (
    <div className="bg-white border border-stone-200 rounded-xl px-6 py-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-[15px] font-bold tracking-tight" style={{ fontFamily: "'Poppins', sans-serif", color: '#2a2a2a' }}>
            Alumnos inscritos por etapa
          </h3>
          <div className="text-xs mt-0.5" style={{ color: '#6b635e' }}>
            Convocatoria {new Date().getFullYear()} · {etapas.length} etapas
          </div>
        </div>
      </div>

      {etapas.length === 0 ? (
        <div className="flex items-center justify-center h-36 text-sm" style={{ color: '#6b635e' }}>Sin datos de etapas este año</div>
      ) : (
        <>
          <div className="flex items-end gap-3.5 border-b border-stone-200" style={{ height: 150, paddingBottom: 8, paddingTop: 20 }}>
            {etapas.map((etapa) => {
              const heightPct = Math.max(5, Math.round((etapa.inscritos / maxVal) * 85));
              const opacity = etapa.futura ? 0.45 : 1;
              return (
                <div key={etapa.clave} className="flex-1 flex flex-col items-center justify-end gap-1.5 min-w-0">
                  <div
                    className="w-full rounded-t-md relative"
                    style={{ height: `${heightPct}%`, background: 'linear-gradient(to top, #6B1530, #c43759)', opacity, minHeight: 8 }}
                    title={`${etapa.inscritos} inscritos`}
                  >
                    <span
                      className="absolute left-1/2 -translate-x-1/2 text-[11px] font-bold whitespace-nowrap"
                      style={{ top: -22, color: '#2a2a2a', fontFamily: "'Poppins', sans-serif" }}
                    >
                      {etapa.inscritos}
                    </span>
                  </div>
                  <div
                    className="text-[10px] text-center uppercase font-medium whitespace-nowrap"
                    style={{
                      color: etapa.activa ? 'var(--color-guinda-700)' : etapa.futura ? '#a89a8e' : '#6b635e',
                      fontWeight: etapa.activa ? 700 : 500,
                      letterSpacing: '0.05em',
                    }}
                  >
                    {etapa.clave}
                    {etapa.activa && <><br /><span style={{ fontSize: 9 }}>ACTIVA</span></>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-6 mt-3.5 pt-3.5 border-t border-stone-100 text-xs flex-wrap" style={{ color: '#6b635e' }}>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm inline-block" style={{ background: '#6B1530' }} /> Inscritos cerrados
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm inline-block" style={{ background: '#c43759' }} /> Convocatoria activa
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm inline-block" style={{ background: '#f5c2cd' }} /> Próximas etapas
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Actividad reciente ─────────────────────────────────────────────────────────

function ActividadReciente({ actividad }: { actividad: DashboardData['actividadReciente'] }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl px-5 py-5">
      <div className="flex items-center justify-between mb-3.5">
        <h3 className="text-[15px] font-bold tracking-tight" style={{ fontFamily: "'Poppins', sans-serif", color: '#2a2a2a' }}>
          Actividad reciente
        </h3>
        <button style={{ background: 'none', border: 'none', color: 'var(--color-guinda-700)', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
          Ver todo
        </button>
      </div>
      {actividad.length === 0 ? (
        <div className="text-sm text-center py-8" style={{ color: '#6b635e' }}>Sin actividad reciente</div>
      ) : (
        <ul className="list-none">
          {actividad.slice(0, 5).map((item) => (
            <li key={item.id} className="flex items-start gap-3 py-2.5 border-b border-stone-50 last:border-b-0">
              <ActivityIcon tipo={item.tipo} />
              <div className="flex-1 min-w-0">
                <div className="text-xs leading-relaxed" style={{ color: '#443e39' }}>
                  <strong style={{ color: '#2a2a2a' }}>{item.actorNombre}</strong>
                  {' · '}
                  {item.descripcion}
                  {item.descripcionExtra && (
                    <span className="ml-1 px-1 rounded-sm text-[11px]" style={{ fontFamily: 'ui-monospace, monospace', background: '#f8f4ec', color: 'var(--color-guinda-700)' }}>
                      {item.descripcionExtra}
                    </span>
                  )}
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: '#6b635e' }}>{tiempoRelativo(item.creadoEn)}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Alumnos recientes ──────────────────────────────────────────────────────────

const estadoStyles: Record<string, { bg: string; color: string }> = {
  activo:              { bg: '#d1fae5', color: '#2d7d46' },
  esperando_matricula: { bg: '#dbeafe', color: '#1d4ed8' },
  pago_pendiente:      { bg: '#fff7ed', color: '#b45309' },
  en_proceso:          { bg: '#fef9c3', color: '#92400e' },
  rechazado:           { bg: '#fee2e2', color: '#b91c1c' },
  sin_documentos:      { bg: '#f7f2ed', color: '#6b635e' },
  inactivo:            { bg: '#f7f2ed', color: '#6b635e' },
};

function AlumnosRecientes({ alumnos, total }: { alumnos: DashboardData['alumnosRecientes']; total: number }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200">
        <div>
          <h3 className="text-[15px] font-bold tracking-tight" style={{ fontFamily: "'Poppins', sans-serif", color: '#2a2a2a' }}>
            Alumnos recientes
          </h3>
          <div className="text-xs mt-0.5" style={{ color: '#6b635e' }}>Últimos {alumnos.length} registros del sistema</div>
        </div>
        <a href="/admin/alumnos" className="text-xs font-semibold px-3 py-1.5 bg-white border border-stone-300 rounded-md no-underline" style={{ color: '#443e39' }}>
          Ver todos →
        </a>
      </div>
      {alumnos.length === 0 ? (
        <div className="text-sm text-center py-8" style={{ color: '#6b635e' }}>Sin alumnos registrados aún</div>
      ) : (
        <>
          {alumnos.map((alumno) => {
            const estilo = estadoStyles[alumno.estadoExpediente] ?? estadoStyles.sin_documentos;
            return (
              <a
                key={alumno.id}
                href={`/gestor/alumnos/${alumno.id}`}
                className="no-underline grid items-center px-5 py-3 border-b border-stone-50 last:border-b-0 hover:bg-stone-50 transition-colors"
                style={{ gridTemplateColumns: '36px 1fr auto auto auto', gap: 14 }}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold"
                  style={{
                    fontFamily: "'Poppins', sans-serif",
                    background: alumno.gestorNombre ? '#dbeafe' : '#efe7d6',
                    color: alumno.gestorNombre ? '#1e40af' : 'var(--color-guinda-700)',
                  }}
                >
                  {alumno.iniciales}
                </div>
                <div>
                  <div className="text-[13px] font-semibold" style={{ fontFamily: "'Poppins', sans-serif", color: '#2a2a2a' }}>
                    {alumno.nombreCompleto}
                  </div>
                  <div className="text-[11px] mt-0.5" style={{ color: '#6b635e' }}>
                    {alumno.gestorNombre ? `Gestor: ${alumno.gestorNombre}` : 'Auto-registro · Sin gestor'}
                  </div>
                </div>
                {alumno.municipio && (
                  <span className="text-[11px] font-medium px-2.5 py-1 rounded-full" style={{ background: '#f8f4ec', color: '#443e39' }}>
                    {alumno.municipio}
                  </span>
                )}
                <span className="text-[10px] font-semibold uppercase px-2 py-1 rounded-full tracking-wide" style={{ background: estilo.bg, color: estilo.color }}>
                  {alumno.estadoTexto}
                </span>
                <ArrowRight size={14} style={{ color: '#ddd0c5' }} />
              </a>
            );
          })}
          <div className="px-5 py-3 text-center" style={{ background: '#fdfaf3' }}>
            <a href="/admin/alumnos" className="text-xs font-semibold px-4 py-1.5 bg-white border border-stone-300 rounded-md no-underline" style={{ color: '#443e39' }}>
              Ver los {total} alumnos →
            </a>
          </div>
        </>
      )}
    </div>
  );
}

// ── Top municipios ─────────────────────────────────────────────────────────────

function TopMunicipios({ municipios }: { municipios: DashboardData['topMunicipios'] }) {
  const maxCount = Math.max(...municipios.map((m) => m.count), 1);
  return (
    <div className="bg-white border border-stone-200 rounded-xl px-5 py-5">
      <div className="flex items-center justify-between mb-3.5">
        <div>
          <h3 className="text-[15px] font-bold tracking-tight" style={{ fontFamily: "'Poppins', sans-serif", color: '#2a2a2a' }}>
            Top municipios
          </h3>
          <div className="text-xs mt-0.5" style={{ color: '#6b635e' }}>Por número de alumnos</div>
        </div>
      </div>
      {municipios.length === 0 ? (
        <div className="text-sm text-center py-8" style={{ color: '#6b635e' }}>Sin datos de municipios</div>
      ) : (
        <ul className="list-none">
          {municipios.map((m) => {
            const isOtros = m.municipio.startsWith('Otros');
            const barWidth = Math.round((m.count / maxCount) * 100);
            return (
              <li key={m.municipio} className="py-2.5 border-b border-stone-50 last:border-b-0">
                <div className="flex justify-between items-center mb-1 text-xs">
                  <span className="font-semibold" style={{ color: isOtros ? '#6b635e' : '#2a2a2a' }}>{m.municipio}</span>
                  <span className="font-bold text-[13px]" style={{ fontFamily: "'Poppins', sans-serif", color: isOtros ? '#6b635e' : 'var(--color-guinda-700)' }}>
                    {m.count}
                  </span>
                </div>
                <div className="w-full h-[5px] rounded-full overflow-hidden" style={{ background: '#f7f2ed' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${barWidth}%`,
                      background: isOtros
                        ? 'linear-gradient(to right, #6b635e, #ddd0c5)'
                        : 'linear-gradient(to right, #6B1530, #c43759)',
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
