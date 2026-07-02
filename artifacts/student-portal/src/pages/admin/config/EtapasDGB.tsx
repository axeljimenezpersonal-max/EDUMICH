import { useState } from 'react';
import { Info, RefreshCw, Calendar, CheckCircle, Clock, ChevronRight } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────

type EstadoEtapa = 'pasada' | 'activa' | 'proxima';

type Etapa = {
  clave: string;
  fase: string;
  solicitudInicio: string;
  solicitudFin: string;
  examenSab: string;
  examenDom: string;
  estado: EstadoEtapa;
};

// ─── Data ─────────────────────────────────────────────────────────────────

const ETAPAS_2026: Etapa[] = [
  { clave: '2601', fase: 'A', solicitudInicio: '2026-01-05', solicitudFin: '2026-01-09', examenSab: '2026-01-31', examenDom: '2026-02-01', estado: 'pasada' },
  { clave: '2602', fase: 'A', solicitudInicio: '2026-02-02', solicitudFin: '2026-02-06', examenSab: '2026-02-28', examenDom: '2026-03-01', estado: 'pasada' },
  { clave: '2603', fase: 'A', solicitudInicio: '2026-03-02', solicitudFin: '2026-03-06', examenSab: '2026-03-28', examenDom: '2026-03-29', estado: 'pasada' },
  { clave: '2604', fase: 'A', solicitudInicio: '2026-04-06', solicitudFin: '2026-04-10', examenSab: '2026-04-25', examenDom: '2026-04-26', estado: 'pasada' },
  { clave: '2605', fase: 'A', solicitudInicio: '2026-04-27', solicitudFin: '2026-05-01', examenSab: '2026-05-09', examenDom: '2026-05-10', estado: 'activa' },
  { clave: '2605', fase: 'B', solicitudInicio: '2026-05-11', solicitudFin: '2026-05-15', examenSab: '2026-05-23', examenDom: '2026-05-24', estado: 'proxima' },
  { clave: '2606', fase: 'A', solicitudInicio: '2026-06-01', solicitudFin: '2026-06-05', examenSab: '2026-06-27', examenDom: '2026-06-28', estado: 'proxima' },
  { clave: '2607', fase: 'A', solicitudInicio: '2026-07-06', solicitudFin: '2026-07-10', examenSab: '2026-07-25', examenDom: '2026-07-26', estado: 'proxima' },
];

const ETAPAS_2025: Etapa[] = [
  { clave: '2501', fase: 'A', solicitudInicio: '2025-01-06', solicitudFin: '2025-01-10', examenSab: '2025-02-01', examenDom: '2025-02-02', estado: 'pasada' },
  { clave: '2502', fase: 'A', solicitudInicio: '2025-02-03', solicitudFin: '2025-02-07', examenSab: '2025-03-01', examenDom: '2025-03-02', estado: 'pasada' },
  { clave: '2503', fase: 'A', solicitudInicio: '2025-03-03', solicitudFin: '2025-03-07', examenSab: '2025-03-29', examenDom: '2025-03-30', estado: 'pasada' },
  { clave: '2504', fase: 'A', solicitudInicio: '2025-04-07', solicitudFin: '2025-04-11', examenSab: '2025-04-26', examenDom: '2025-04-27', estado: 'pasada' },
  { clave: '2505', fase: 'A', solicitudInicio: '2025-04-28', solicitudFin: '2025-05-02', examenSab: '2025-05-10', examenDom: '2025-05-11', estado: 'pasada' },
  { clave: '2505', fase: 'B', solicitudInicio: '2025-05-12', solicitudFin: '2025-05-16', examenSab: '2025-05-24', examenDom: '2025-05-25', estado: 'pasada' },
  { clave: '2506', fase: 'A', solicitudInicio: '2025-06-02', solicitudFin: '2025-06-06', examenSab: '2025-06-28', examenDom: '2025-06-29', estado: 'pasada' },
  { clave: '2507', fase: 'A', solicitudInicio: '2025-07-07', solicitudFin: '2025-07-11', examenSab: '2025-07-26', examenDom: '2025-07-27', estado: 'pasada' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function formatDateEs(iso: string): string {
  const [, mes, dia] = iso.split('-');
  const m = parseInt(mes, 10) - 1;
  return `${parseInt(dia, 10)} ${MESES_CORTOS[m] ?? ''}`;
}

// ─── EstadoPill ───────────────────────────────────────────────────────────

function EstadoPill({ estado }: { estado: EstadoEtapa }) {
  if (estado === 'pasada') {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
        style={{ background: '#f7f2ed', color: '#6b635e' }}
      >
        PASADA
      </span>
    );
  }
  if (estado === 'activa') {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
        style={{ background: '#d1fae5', color: '#2d7d46' }}
      >
        <CheckCircle size={10} strokeWidth={2} />
        ACTIVA
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
      style={{ background: '#f5e6ef', color: '#6B1530' }}
    >
      <Clock size={10} strokeWidth={2} />
      PROXIMA
    </span>
  );
}

// ─── EtapaRow ─────────────────────────────────────────────────────────────

function EtapaRow({ etapa, index }: { etapa: Etapa; index: number }) {
  const isActiva = etapa.estado === 'activa';
  return (
    <div
      className="grid items-center gap-3 px-4 py-3 border-b border-stone-100 last:border-b-0"
      style={{
        gridTemplateColumns: '90px 1fr 1fr 1fr 100px',
        background: isActiva ? '#fdf8fb' : index % 2 === 0 ? 'white' : '#fafaf9',
        borderLeft: isActiva ? '3px solid #6B1530' : '3px solid transparent',
      }}
    >
      {/* Clave + Fase */}
      <div className="flex items-center gap-1.5">
        <span
          className="text-sm font-bold font-mono"
          style={{ color: '#6B1530' }}
        >
          {etapa.clave}
        </span>
        <span
          className="px-1.5 py-0.5 rounded text-[10px] font-bold"
          style={{ background: '#ede9fe', color: '#5b21b6' }}
        >
          {etapa.fase}
        </span>
      </div>

      {/* Solicitud */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-stone-400 mb-0.5">Solicitud</div>
        <div className="text-xs font-medium text-stone-700 flex items-center gap-1">
          {formatDateEs(etapa.solicitudInicio)}
          <ChevronRight size={10} strokeWidth={2} className="text-stone-400" />
          {formatDateEs(etapa.solicitudFin)}
        </div>
      </div>

      {/* Examen Sabado */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-stone-400 mb-0.5">Sabado</div>
        <div className="text-xs font-medium text-stone-700">{formatDateEs(etapa.examenSab)}</div>
      </div>

      {/* Examen Domingo */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-stone-400 mb-0.5">Domingo</div>
        <div className="text-xs font-medium text-stone-700">{formatDateEs(etapa.examenDom)}</div>
      </div>

      {/* Estado */}
      <div className="flex justify-end">
        <EstadoPill estado={etapa.estado} />
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────

type Year = 2025 | 2026 | 2027;

export default function EtapasDGB({ onDirty: _onDirty }: { onDirty?: (d: boolean) => void }) {
  const [selectedYear, setSelectedYear] = useState<Year>(2026);
  const [showToast, setShowToast] = useState(false);

  function handleSincronizar() {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  }

  const years: { year: Year; label: string; suffix?: string; isCurrent?: boolean }[] = [
    { year: 2025, label: '2025' },
    { year: 2026, label: '2026', isCurrent: true },
    { year: 2027, label: '2027', suffix: 'pendiente' },
  ];

  const etapas = selectedYear === 2026 ? ETAPAS_2026 : selectedYear === 2025 ? ETAPAS_2025 : [];

  return (
    <div>
      {/* Info banner */}
      <div
        className="flex items-start gap-3 px-4 py-3 rounded-lg border mb-5 text-sm"
        style={{ background: '#eff6ff', borderColor: '#bfdbfe', color: '#1d4ed8' }}
      >
        <Info size={16} strokeWidth={2} className="flex-shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          El calendario de etapas DGB es publicado anualmente por la SEP-DGB y no puede modificarse desde el sistema.
        </p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        {/* Header bar */}
        <div
          className="px-5 py-3 flex items-center justify-between"
          style={{ background: '#6B1530' }}
        >
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Calendar size={14} strokeWidth={2} />
            Etapas DGB — Calendario oficial
          </h2>
          <button
            type="button"
            onClick={handleSincronizar}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border border-white/30 text-white/70 cursor-not-allowed"
            style={{ background: 'rgba(255,255,255,0.08)' }}
          >
            <RefreshCw size={12} strokeWidth={2} />
            Sincronizar con SEP-DGB
          </button>
        </div>

        {/* Year tabs */}
        <div className="flex border-b border-stone-200 bg-stone-50">
          {years.map(({ year, label, suffix, isCurrent }) => (
            <button
              key={year}
              type="button"
              onClick={() => setSelectedYear(year)}
              className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors"
              style={{
                borderBottomColor: selectedYear === year ? '#6B1530' : 'transparent',
                color: selectedYear === year ? '#6B1530' : '#6b635e',
                background: 'transparent',
              }}
            >
              {label}
              {isCurrent && (
                <span
                  className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase"
                  style={{ background: '#d1fae5', color: '#2d7d46' }}
                >
                  actual
                </span>
              )}
              {suffix && (
                <span
                  className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase"
                  style={{ background: '#f7f2ed', color: '#6b635e' }}
                >
                  {suffix}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Column headers */}
        {selectedYear !== 2027 && (
          <div
            className="grid px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-stone-400"
            style={{ gridTemplateColumns: '90px 1fr 1fr 1fr 100px', background: '#fafaf9' }}
          >
            <div>Etapa</div>
            <div>Periodo solicitud</div>
            <div>Examen Sab</div>
            <div>Examen Dom</div>
            <div className="text-right">Estado</div>
          </div>
        )}

        {/* Rows */}
        {selectedYear === 2027 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <Clock size={32} strokeWidth={1.5} style={{ color: '#ddd0c5' }} />
            <p className="text-sm font-medium text-stone-500">Calendario 2027 pendiente de publicacion</p>
            <p className="text-xs text-stone-400">La SEP-DGB publicara las fechas aproximadamente en diciembre 2026.</p>
          </div>
        ) : (
          <div>
            {etapas.map((etapa, i) => (
              <EtapaRow key={`${etapa.clave}-${etapa.fase}-${i}`} etapa={etapa} index={i} />
            ))}
          </div>
        )}

        {/* Footer legend */}
        {selectedYear !== 2027 && (
          <div className="px-4 py-3 border-t border-stone-100 flex items-center gap-4" style={{ background: '#fafaf9' }}>
            <span className="text-[11px] text-stone-400 font-medium">Leyenda:</span>
            <EstadoPill estado="pasada" />
            <EstadoPill estado="activa" />
            <EstadoPill estado="proxima" />
            <span className="ml-auto text-[11px] text-stone-400">
              {etapas.length} etapas · Fuente: SEP-DGB
            </span>
          </div>
        )}
      </div>

      {/* Toast */}
      {showToast && (
        <div
          className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white flex items-center gap-2"
          style={{ background: '#443e39' }}
        >
          <Info size={14} strokeWidth={2} />
          Proximamente disponible
        </div>
      )}
    </div>
  );
}
