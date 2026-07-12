import { useEffect, useState } from 'react';
import { AdminLayout } from './AdminLayout';
import { api } from '../../lib/api';
import { Calendar, Users, ChevronRight, ArrowRight, Flag, Upload, X, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

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
  const [precargaOpen, setPrecargaOpen] = useState(false);

  function cargar() {
    setLoading(true);
    api.get<ConvocatoriasData>(`/admin/convocatorias?año=${año}`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargar(); }, [año]);

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

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPrecargaOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
            style={{ background: 'var(--color-guinda-700)' }}
          >
            <Upload size={15} /> Precargar etapas
          </button>
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
      </div>

      {precargaOpen && (
        <PrecargarEtapasModal
          etapasExistentes={data?.etapas ?? []}
          onClose={() => setPrecargaOpen(false)}
          onDone={() => { setPrecargaOpen(false); cargar(); }}
        />
      )}

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

// ── Precargar etapas (calendario del ciclo) ─────────────────────────────────
type FilaPreview = {
  clave: string; etapa: string; fase: string;
  solicitudInicio: string; solicitudFin: string; examenSabado: string; examenDomingo: string; anio: number;
  estado: 'nueva' | 'existe' | 'error'; motivo?: string;
};
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

function parsearEtapas(texto: string, clavesExistentes: Set<string>): FilaPreview[] {
  const filas: FilaPreview[] = [];
  const vistas = new Set<string>();
  for (const raw of texto.split('\n')) {
    const linea = raw.trim();
    if (!linea || /^clave/i.test(linea)) continue; // ignora vacías y encabezado
    const t = linea.split(/[\s,;|\t]+/).filter(Boolean);
    let clave = '', etapa = '', fase = '', si = '', sf = '', es = '', ed = '';
    if (t.length >= 7 && RE_FECHA.test(t[3] ?? '')) { [clave, etapa, fase, si, sf, es, ed] = t; }
    else { [clave, si, sf, es, ed] = t; const p = (clave ?? '').split('-'); etapa = p[0] ?? ''; fase = p[1] ?? ''; }
    const anio = parseInt((si ?? '').slice(0, 4)) || 0;
    let estado: FilaPreview['estado'] = 'nueva';
    let motivo: string | undefined;
    if (!clave || !etapa || !fase) { estado = 'error'; motivo = 'Clave inválida (usa ETAPA-FASE, ej. 2608-A)'; }
    else if (fase.length > 2) { estado = 'error'; motivo = 'La fase debe ser de 1–2 caracteres'; }
    else if (![si, sf, es, ed].every((x) => RE_FECHA.test(x ?? ''))) { estado = 'error'; motivo = 'Faltan fechas o formato ≠ AAAA-MM-DD'; }
    else if (!(si <= sf && sf <= es && es <= ed)) { estado = 'error'; motivo = 'Orden: inicio ≤ fin ≤ sábado ≤ domingo'; }
    else if (vistas.has(clave) || clavesExistentes.has(clave)) { estado = 'existe'; motivo = 'Ya existe'; }
    vistas.add(clave);
    filas.push({ clave, etapa, fase, solicitudInicio: si, solicitudFin: sf, examenSabado: es, examenDomingo: ed, anio, estado, motivo });
  }
  return filas;
}

const EJEMPLO_PRECARGA = `2608-A  2026-08-03  2026-08-24  2026-09-05  2026-09-06
2609-B  2026-09-07  2026-09-28  2026-10-10  2026-10-11`;

function PrecargarEtapasModal({ etapasExistentes, onClose, onDone }: {
  etapasExistentes: Etapa[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [texto, setTexto] = useState('');
  const [copiarHorariosDe, setCopiarHorariosDe] = useState<number | ''>('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ creadas: string[]; omitidas: string[]; errores: { clave: string; motivo: string }[] } | null>(null);

  const clavesExist = new Set(etapasExistentes.map((e) => e.clave));
  const filas = texto.trim() ? parsearEtapas(texto, clavesExist) : [];
  const nuevas = filas.filter((f) => f.estado === 'nueva');
  const conError = filas.filter((f) => f.estado === 'error').length;
  const yaExisten = filas.filter((f) => f.estado === 'existe').length;

  async function guardar() {
    if (nuevas.length === 0) return;
    setGuardando(true); setError(null);
    try {
      const r = await api.post<{ creadas: string[]; omitidas: string[]; errores: { clave: string; motivo: string }[] }>(
        '/admin/convocatorias/precargar',
        {
          etapas: nuevas.map((f) => ({
            clave: f.clave, etapa: f.etapa, fase: f.fase,
            solicitudInicio: f.solicitudInicio, solicitudFin: f.solicitudFin,
            examenSabado: f.examenSabado, examenDomingo: f.examenDomingo, anio: f.anio,
          })),
          copiarHorariosDe: copiarHorariosDe === '' ? null : Number(copiarHorariosDe),
        }
      );
      setResultado(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron crear las etapas');
    } finally {
      setGuardando(false);
    }
  }

  const badge = (estado: FilaPreview['estado']) =>
    estado === 'nueva' ? { t: 'Nueva', bg: '#d1fae5', c: '#065f46' }
      : estado === 'existe' ? { t: 'Ya existe', bg: '#fef9c3', c: '#92400e' }
        : { t: 'Error', bg: '#fee2e2', c: '#991b1b' };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(20,10,15,0.45)', backdropFilter: 'blur(2px)' }} onClick={() => !guardando && onClose()}>
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
          <div>
            <h3 className="font-serif text-lg font-bold text-stone-900">Precargar etapas del ciclo</h3>
            <p className="text-xs text-stone-500">Pega el calendario oficial; se crean todas de un jalón. Solo tú (admin) puedes hacerlo.</p>
          </div>
          <button onClick={() => !guardando && onClose()} className="text-stone-400 hover:text-stone-600"><X size={18} /></button>
        </div>

        {resultado ? (
          <div className="p-6">
            <div className="flex items-center gap-2 text-emerald-700 mb-3"><CheckCircle2 size={20} /><span className="font-bold">{resultado.creadas.length} etapa(s) creada(s)</span></div>
            {resultado.creadas.length > 0 && <div className="text-sm text-stone-600 mb-2">Nuevas: <span className="font-mono">{resultado.creadas.join(', ')}</span></div>}
            {resultado.omitidas.length > 0 && <div className="text-sm text-amber-700 mb-2">Omitidas (ya existían): <span className="font-mono">{resultado.omitidas.join(', ')}</span></div>}
            {resultado.errores.length > 0 && <div className="text-sm text-red-700 mb-2">Con error: {resultado.errores.map((e) => `${e.clave} (${e.motivo})`).join('; ')}</div>}
            <div className="mt-4 flex justify-end">
              <button onClick={onDone} className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: 'var(--color-guinda-700)' }}>Listo</button>
            </div>
          </div>
        ) : (
          <>
            <div className="p-6 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-stone-600">Calendario (una etapa por renglón)</label>
                <p className="mb-2 text-[11px] text-stone-500">
                  Formato: <span className="font-mono">CLAVE  inicio-solicitud  fin-solicitud  examen-sábado  examen-domingo</span> (fechas AAAA-MM-DD). La etapa, fase y año se deducen solos.
                </p>
                <textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder={EJEMPLO_PRECARGA}
                  rows={6}
                  spellCheck={false}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-guinda-700)]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-stone-600">Copiar horarios de módulos desde</label>
                <select
                  value={String(copiarHorariosDe)}
                  onChange={(e) => setCopiarHorariosDe(e.target.value ? Number(e.target.value) : '')}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-guinda-700)]"
                >
                  <option value="">Sin horarios (agregarlos después)</option>
                  {etapasExistentes.map((e) => <option key={e.id} value={e.id}>{e.clave} · {e.anio}</option>)}
                </select>
                <p className="mt-1 text-[11px] text-stone-500">Recomendado: copia los horarios de una etapa previa para que los alumnos puedan inscribirse desde el día 1.</p>
              </div>

              {filas.length > 0 && (
                <div className="max-h-56 overflow-auto rounded-lg border border-stone-200">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-stone-100 text-left uppercase tracking-wide text-stone-500">
                      <tr><th className="px-3 py-2">Clave</th><th className="px-3 py-2">Solicitud</th><th className="px-3 py-2">Examen</th><th className="px-3 py-2">Estado</th></tr>
                    </thead>
                    <tbody>
                      {filas.map((f, i) => { const b = badge(f.estado); return (
                        <tr key={i} className={`border-t border-stone-100 ${f.estado === 'error' ? 'bg-red-50/50' : ''}`}>
                          <td className="px-3 py-1.5 font-mono font-semibold text-stone-800">{f.clave || '—'}</td>
                          <td className="px-3 py-1.5 text-stone-600">{f.solicitudInicio} → {f.solicitudFin}</td>
                          <td className="px-3 py-1.5 text-stone-600">{f.examenSabado} / {f.examenDomingo}</td>
                          <td className="px-3 py-1.5"><span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: b.bg, color: b.c }} title={f.motivo}>{b.t}</span></td>
                        </tr>
                      ); })}
                    </tbody>
                  </table>
                </div>
              )}

              {error && <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"><AlertTriangle size={14} /> {error}</div>}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-stone-100 px-6 py-4">
              <div className="text-xs text-stone-500">
                {filas.length > 0 && <><span className="font-semibold text-emerald-700">{nuevas.length} nuevas</span>{yaExisten > 0 && <> · {yaExisten} ya existen</>}{conError > 0 && <> · <span className="text-red-700">{conError} con error</span></>}</>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => !guardando && onClose()} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-50">Cancelar</button>
                <button
                  onClick={guardar}
                  disabled={guardando || nuevas.length === 0}
                  className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                  style={{ background: 'var(--color-guinda-700)' }}
                >
                  {guardando ? <><Loader2 size={14} className="animate-spin" /> Creando…</> : <>Crear {nuevas.length > 0 ? `${nuevas.length} etapa${nuevas.length === 1 ? '' : 's'}` : 'etapas'}</>}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
