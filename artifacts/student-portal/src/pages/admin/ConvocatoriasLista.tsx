import { useEffect, useState } from 'react';
import { AdminLayout } from './AdminLayout';
import { api } from '../../lib/api';
import { Calendar, Users, ChevronRight, ArrowRight, Flag } from 'lucide-react';

type Etapa = {
  id: number;
  clave: string;
  etapa: string;
  fase: string;
  anio: number;
  solicitudInicio: string;
  solicitudFin: string;
  examenSabado: string;
  examenDomingo: string;
  estado: string;
  totalInscritos: number;
};

type ConvocatoriasData = {
  año: number;
  etapas: Etapa[];
  stats: {
    etapasTotal: number;
    etapasFinalizadas: number;
    etapasConInscripcionAbierta: number;
    totalInscritosAnio: number;
  };
  etapaActivaId: number | null;
};

const ESTADO_CONFIG: Record<string, { label: string; dotColor: string; bg: string; textColor: string; pulse?: boolean }> = {
  finalizada:           { label: 'Finalizada',            dotColor: '#374151', bg: '#f3f4f6', textColor: '#374151' },
  en_examen:            { label: 'En examen',             dotColor: '#d97706', bg: '#fef3c7', textColor: '#92400e', pulse: true },
  inscripcion_cerrada:  { label: 'Inscripción cerrada',   dotColor: '#c77700', bg: '#fef9c3', textColor: '#92400e' },
  inscripcion_abierta:  { label: 'Inscripción abierta',   dotColor: '#059669', bg: '#d1fae5', textColor: '#065f46', pulse: true },
  programada:           { label: 'Programada',            dotColor: '#ddd0c5', bg: '#f7f2ed', textColor: '#6b635e' },
};

const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

function fmtDate(d: string): string {
  const [, m, day] = d.split('-');
  return `${parseInt(day)} ${MESES[parseInt(m) - 1]}`;
}

function fmtDateLong(d: string): string {
  const [y, m, day] = d.split('-');
  const mesesLong = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return `${parseInt(day)} de ${mesesLong[parseInt(m) - 1]} de ${y}`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ConvocatoriasLista() {
  const currentYear = new Date().getFullYear();
  const [año, setAño] = useState(currentYear);
  const [data, setData] = useState<ConvocatoriasData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<ConvocatoriasData>(`/admin/convocatorias?año=${año}`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [año]);

  const años = [currentYear - 1, currentYear, currentYear + 1];
  const etapaActiva = data?.etapaActivaId
    ? data.etapas.find((e) => e.id === data.etapaActivaId) ?? null
    : null;

  return (
    <AdminLayout>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div
            className="flex items-center gap-1.5 text-[11px] font-semibold uppercase mb-1"
            style={{ color: 'var(--color-guinda-700)', letterSpacing: '0.15em' }}
          >
            <Calendar size={12} /> CONVOCATORIAS DGB
          </div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ fontFamily: "'Poppins', sans-serif", color: '#2a2a2a' }}
          >
            Etapas {año}
          </h1>
        </div>

        {/* Year selector */}
        <div className="flex gap-1 bg-white border border-stone-200 rounded-lg p-1">
          {años.map((y) => (
            <button
              key={y}
              onClick={() => setAño(y)}
              className="px-4 py-1.5 rounded-md text-sm font-semibold transition-all"
              style={
                año === y
                  ? { background: 'var(--color-guinda-700)', color: 'white' }
                  : { color: '#6b635e', background: 'transparent' }
              }
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <StatCard
          icon={<Calendar size={16} />}
          num={data?.stats.etapasTotal ?? 0}
          label="Etapas programadas"
        />
        <StatCard
          icon={<Flag size={16} />}
          num={data?.stats.etapasFinalizadas ?? 0}
          label="Etapas finalizadas"
        />
        <StatCard
          icon={<Flag size={16} />}
          num={data?.stats.etapasConInscripcionAbierta ?? 0}
          label="Con inscripción abierta"
          highlight={!!data?.etapaActivaId}
        />
        <StatCard
          icon={<Users size={16} />}
          num={data?.stats.totalInscritosAnio ?? 0}
          label="Inscritos en el año"
        />
      </div>

      {/* Active etapa banner */}
      {etapaActiva && (
        <div
          className="rounded-xl mb-6 px-6 py-4 relative overflow-hidden flex items-center justify-between gap-6"
          style={{ background: 'linear-gradient(135deg, #6B1530 0%, #4a0e20 100%)', color: 'white' }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(circle at 85% 40%, rgba(255,255,255,0.12) 0%, transparent 60%)' }}
          />
          <div className="flex items-center gap-4 relative">
            <div className="relative">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.15)' }}
              >
                <Flag size={20} />
              </div>
              <span
                className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white"
                style={{ background: '#34d399', animation: 'pulse 2s infinite' }}
              />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest mb-0.5" style={{ opacity: 0.8 }}>
                ETAPA ACTIVA AHORA
              </div>
              <div className="text-lg font-bold" style={{ fontFamily: "'Poppins', sans-serif" }}>
                Etapa {etapaActiva.clave} — Fase {etapaActiva.fase}
              </div>
              <div className="text-xs mt-0.5" style={{ opacity: 0.85 }}>
                Inscripciones: {fmtDate(etapaActiva.solicitudInicio)}–{fmtDate(etapaActiva.solicitudFin)}
                {' · '}
                Examen: sáb {fmtDate(etapaActiva.examenSabado)} y dom {fmtDate(etapaActiva.examenDomingo)}
              </div>
            </div>
          </div>
          <a
            href={`/admin/convocatorias/${etapaActiva.id}`}
            className="relative flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-sm flex-shrink-0"
            style={{ background: 'white', color: 'var(--color-guinda-700)', textDecoration: 'none' }}
          >
            Ver lista de inscritos <ArrowRight size={14} />
          </a>
        </div>
      )}

      {/* Timeline */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm" style={{ color: '#6b635e' }}>
          Cargando etapas...
        </div>
      ) : !data || data.etapas.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl flex items-center justify-center py-20 text-sm" style={{ color: '#6b635e' }}>
          No hay etapas registradas para {año}
        </div>
      ) : (
        <div className="relative">
          {/* Connector line */}
          <div
            className="absolute"
            style={{ left: 19, top: 24, bottom: 24, width: 2, background: '#eadfd7', borderRadius: 1 }}
          />

          <div className="flex flex-col gap-3">
            {data.etapas.map((etapa) => {
              const cfg = ESTADO_CONFIG[etapa.estado] ?? ESTADO_CONFIG.programada;
              const isActiva = etapa.id === data.etapaActivaId;

              return (
                <div key={etapa.id} className="relative" style={{ paddingLeft: 52 }}>
                  {/* Timeline dot */}
                  <div
                    className="absolute"
                    style={{ left: 9, top: '50%', transform: 'translateY(-50%)', zIndex: 2 }}
                  >
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center"
                      style={{
                        background: cfg.dotColor,
                        boxShadow: `0 0 0 3px white, 0 0 0 4px ${cfg.dotColor}40`,
                      }}
                    >
                      {etapa.estado === 'finalizada' && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  </div>

                  {/* Card */}
                  <a
                    href={`/admin/convocatorias/${etapa.id}`}
                    className="block bg-white rounded-xl no-underline transition-all group"
                    style={{
                      border: `1.5px solid ${isActiva ? 'var(--color-guinda-700)' : '#eadfd7'}`,
                      padding: '14px 18px',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.07)';
                      if (!isActiva) (e.currentTarget as HTMLElement).style.borderColor = '#c4b5a0';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.boxShadow = '';
                      (e.currentTarget as HTMLElement).style.borderColor = isActiva ? 'var(--color-guinda-700)' : '#eadfd7';
                    }}
                  >
                    <div className="flex items-center justify-between gap-4">
                      {/* Left */}
                      <div className="flex items-start gap-3 min-w-0">
                        {/* Month marker */}
                        <div
                          className="flex-shrink-0 text-center rounded-lg px-2.5 py-1.5"
                          style={{ background: '#f8f4ec', minWidth: 44 }}
                        >
                          <div
                            className="text-[17px] font-bold leading-none"
                            style={{ fontFamily: "'Poppins', sans-serif", color: 'var(--color-guinda-700)' }}
                          >
                            {fmtDate(etapa.examenSabado).split(' ')[0]}
                          </div>
                          <div className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: '#6b635e', marginTop: 1 }}>
                            {fmtDate(etapa.examenSabado).split(' ')[1]}
                          </div>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="font-bold text-[15px]"
                              style={{ fontFamily: "'Poppins', sans-serif", color: '#2a2a2a' }}
                            >
                              Etapa {etapa.clave}
                            </span>
                            <span
                              className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                              style={{ background: cfg.bg, color: cfg.textColor }}
                            >
                              {cfg.label}
                            </span>
                            {isActiva && (
                              <span
                                className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                                style={{ background: 'var(--color-guinda-700)', color: 'white' }}
                              >
                                Activa
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-x-5 gap-y-0.5 mt-1.5 text-xs" style={{ color: '#6b635e' }}>
                            <span>
                              <span className="font-medium" style={{ color: '#443e39' }}>Inscripciones:</span>{' '}
                              {fmtDateLong(etapa.solicitudInicio)} al {fmtDateLong(etapa.solicitudFin)}
                            </span>
                            <span>
                              <span className="font-medium" style={{ color: '#443e39' }}>Examen:</span>{' '}
                              sáb {fmtDate(etapa.examenSabado)} y dom {fmtDate(etapa.examenDomingo)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: inscritos + arrow */}
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <div className="text-right">
                          <div
                            className="text-xl font-bold leading-none"
                            style={{ fontFamily: "'Poppins', sans-serif", color: '#2a2a2a' }}
                          >
                            {etapa.totalInscritos}
                          </div>
                          <div className="text-[10px] mt-0.5" style={{ color: '#6b635e' }}>inscritos</div>
                        </div>
                        <ChevronRight
                          size={16}
                          style={{ color: '#ddd0c5', transition: 'transform 0.15s' }}
                          className="group-hover:translate-x-0.5"
                        />
                      </div>
                    </div>
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon, num, label, highlight,
}: {
  icon: React.ReactNode;
  num: number;
  label: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl px-5 py-4">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
        style={{
          background: highlight ? '#fbe6ea' : '#f8f4ec',
          color: highlight ? 'var(--color-guinda-700)' : '#6b635e',
        }}
      >
        {icon}
      </div>
      <div
        className="text-2xl font-bold leading-none tracking-tight"
        style={{
          fontFamily: "'Poppins', sans-serif",
          color: highlight ? 'var(--color-guinda-700)' : '#2a2a2a',
        }}
      >
        {num}
      </div>
      <div className="text-xs mt-1" style={{ color: '#6b635e' }}>
        {label}
      </div>
    </div>
  );
}
