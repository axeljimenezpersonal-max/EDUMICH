import { useEffect, useState } from 'react';
import { useRoute, Link } from 'wouter';
import { AdminLayout } from './AdminLayout';
import { api, calif10 } from '../../lib/api';
import {
  ArrowLeft, Download, Users, GraduationCap, CheckCircle, XCircle,
  Clock, Search, ChevronDown, ChevronRight,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

type EtapaInfo = {
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
  createdAt: string;
};

type ModuloInscrito = {
  numero: number;
  nombre: string;
  folio: string;
  estado: string;
  calificacion: number | null;
};

type Inscrito = {
  estudianteId: number;
  nombreCompleto: string;
  curp: string | null;
  municipio: string | null;
  totalModulos: number;
  modulos: ModuloInscrito[];
};

type DetalleData = {
  etapa: EtapaInfo;
  stats: {
    totalInscritos: number;
    examenesTotal: number;
    aprobados: number;
    reprobados: number;
    pendientes: number;
  };
  inscritos: Inscrito[];
};

// ── Constants ─────────────────────────────────────────────────────────────────

const ESTADO_CONFIG: Record<string, { label: string; bg: string; textColor: string }> = {
  finalizada:           { label: 'Finalizada',            bg: '#f3f4f6', textColor: '#374151' },
  en_examen:            { label: 'En examen',             bg: '#fef3c7', textColor: '#92400e' },
  inscripcion_cerrada:  { label: 'Inscripción cerrada',   bg: '#fef9c3', textColor: '#92400e' },
  inscripcion_abierta:  { label: 'Inscripción abierta',   bg: '#d1fae5', textColor: '#065f46' },
  programada:           { label: 'Programada',            bg: '#f7f2ed', textColor: '#6b635e' },
};

const MESES_LONG = [
  'enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre',
];

function fmtDate(d: string): string {
  const [y, m, day] = d.split('-');
  return `${parseInt(day)} de ${MESES_LONG[parseInt(m) - 1]} de ${y}`;
}

function fmtShort(d: string): string {
  const [, m, day] = d.split('-');
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${parseInt(day)} ${meses[parseInt(m) - 1]}`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ConvocatoriaDetalle() {
  const [, params] = useRoute('/admin/convocatorias/:id');
  const etapaId = params?.id ? Number(params.id) : null;

  const [data, setData] = useState<DetalleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'inscritos' | 'resultados'>('inscritos');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'aprobados' | 'reprobados' | 'pendientes'>('todos');

  useEffect(() => {
    if (!etapaId) return;
    setLoading(true);
    api.get<DetalleData>(`/admin/convocatorias/${etapaId}`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [etapaId]);

  function toggleExpand(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleExportar() {
    window.open(`/api/admin/convocatorias/${etapaId}/exportar-lista`, '_blank');
  }

  const estadoCfg = data
    ? (ESTADO_CONFIG[data.etapa.estado] ?? ESTADO_CONFIG.programada)
    : ESTADO_CONFIG.programada;

  const inscritosFiltrados = (data?.inscritos ?? []).filter((i) => {
    const q = search.toLowerCase();
    const coincideBusqueda =
      i.nombreCompleto.toLowerCase().includes(q) ||
      (i.curp ?? '').toLowerCase().includes(q) ||
      (i.municipio ?? '').toLowerCase().includes(q);
    if (!coincideBusqueda) return false;

    if (filtroEstado === 'todos') return true;
    const tieneAprobado = i.modulos.some((m) => m.calificacion !== null && m.calificacion >= 60);
    const tieneReprobado = i.modulos.some((m) => m.calificacion !== null && m.calificacion < 60);
    const tienePendiente = i.modulos.some((m) => m.calificacion === null);
    if (filtroEstado === 'aprobados') return tieneAprobado;
    if (filtroEstado === 'reprobados') return tieneReprobado;
    return tienePendiente; // pendientes
  });

  // Resultados: aggregate by módulo
  type ModuloResult = {
    numero: number;
    nombre: string;
    total: number;
    aprobados: number;
    reprobados: number;
    pendientes: number;
    promedio: number | null;
  };

  const resultadosPorModulo: ModuloResult[] = (() => {
    if (!data) return [];
    const map = new Map<number, ModuloResult>();
    for (const insc of data.inscritos) {
      for (const mod of insc.modulos) {
        if (!map.has(mod.numero)) {
          map.set(mod.numero, {
            numero: mod.numero,
            nombre: mod.nombre,
            total: 0, aprobados: 0, reprobados: 0, pendientes: 0, promedio: null,
          });
        }
        const r = map.get(mod.numero)!;
        r.total++;
        if (mod.calificacion === null) {
          r.pendientes++;
        } else if (mod.calificacion >= 60) {
          r.aprobados++;
        } else {
          r.reprobados++;
        }
      }
    }
    // Compute promedio
    for (const [num, r] of map) {
      const notas = data.inscritos.flatMap((i) =>
        i.modulos.filter((m) => m.numero === num && m.calificacion !== null).map((m) => m.calificacion as number)
      );
      r.promedio = notas.length > 0 ? Math.round(notas.reduce((a, b) => a + b, 0) / notas.length) : null;
    }
    return Array.from(map.values()).sort((a, b) => a.numero - b.numero);
  })();

  return (
    <AdminLayout>
      {/* Back + header */}
      <div className="flex items-start gap-4 mb-6">
        <a
          href="/admin/convocatorias"
          className="mt-0.5 w-9 h-9 rounded-lg border border-stone-200 bg-white flex items-center justify-center flex-shrink-0 hover:border-stone-300 transition-colors no-underline"
          style={{ color: '#443e39' }}
        >
          <ArrowLeft size={16} />
        </a>
        <div className="flex-1 min-w-0">
          <div
            className="text-[11px] font-semibold uppercase mb-1"
            style={{ color: 'var(--color-guinda-700)', letterSpacing: '0.15em' }}
          >
            CONVOCATORIAS DGB / DETALLE
          </div>
          {loading ? (
            <div className="h-7 w-48 rounded bg-stone-200 animate-pulse" />
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <h1
                className="text-2xl font-bold tracking-tight"
                style={{ fontFamily: "'Poppins', sans-serif", color: '#2a2a2a' }}
              >
                Etapa {data?.etapa.clave}
              </h1>
              {data && (
                <span
                  className="text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full"
                  style={{ background: estadoCfg.bg, color: estadoCfg.textColor }}
                >
                  {estadoCfg.label}
                </span>
              )}
            </div>
          )}
        </div>
        <button
          onClick={handleExportar}
          disabled={!data}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg border border-stone-200 bg-white hover:border-stone-300 disabled:opacity-40 transition-colors"
          style={{ color: '#443e39' }}
        >
          <Download size={14} /> Exportar CSV
        </button>
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : !data ? (
        <div className="bg-white border border-stone-200 rounded-xl flex items-center justify-center py-20 text-sm" style={{ color: '#6b635e' }}>
          Etapa no encontrada
        </div>
      ) : (
        <>
          {/* Date info cards */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <DateCard
              label="Periodo de inscripciones"
              value={`${fmtDate(data.etapa.solicitudInicio)} — ${fmtDate(data.etapa.solicitudFin)}`}
              icon={<Clock size={14} />}
            />
            <DateCard
              label="Fechas de examen"
              value={`Sáb ${fmtShort(data.etapa.examenSabado)} · Dom ${fmtShort(data.etapa.examenDomingo)}`}
              icon={<GraduationCap size={14} />}
            />
          </div>

          {/* Stats row — las 3 de resultado filtran la lista al hacer clic */}
          <div className="grid grid-cols-5 gap-3 mb-6">
            <MiniStat
              num={data.stats.totalInscritos}
              label={filtroEstado === 'todos' ? 'Estudiantes' : 'Ver todos'}
              icon={<Users size={14} />}
              onClick={filtroEstado !== 'todos' ? () => setFiltroEstado('todos') : undefined}
              active={filtroEstado === 'todos'}
            />
            <MiniStat
              num={data.stats.examenesTotal}
              label="Exámenes totales"
              icon={<GraduationCap size={14} />}
            />
            <MiniStat
              num={data.stats.aprobados}
              label="Aprobados"
              icon={<CheckCircle size={14} />}
              color="#059669"
              bg="#d1fae5"
              onClick={() => setFiltroEstado((f) => (f === 'aprobados' ? 'todos' : 'aprobados'))}
              active={filtroEstado === 'aprobados'}
              dimmed={filtroEstado !== 'todos' && filtroEstado !== 'aprobados'}
            />
            <MiniStat
              num={data.stats.reprobados}
              label="Reprobados"
              icon={<XCircle size={14} />}
              color="#dc2626"
              bg="#fee2e2"
              onClick={() => setFiltroEstado((f) => (f === 'reprobados' ? 'todos' : 'reprobados'))}
              active={filtroEstado === 'reprobados'}
              dimmed={filtroEstado !== 'todos' && filtroEstado !== 'reprobados'}
            />
            <MiniStat
              num={data.stats.pendientes}
              label="Pendientes"
              icon={<Clock size={14} />}
              color="#c77700"
              bg="#fef9c3"
              onClick={() => setFiltroEstado((f) => (f === 'pendientes' ? 'todos' : 'pendientes'))}
              active={filtroEstado === 'pendientes'}
              dimmed={filtroEstado !== 'todos' && filtroEstado !== 'pendientes'}
            />
          </div>

          {/* Encabezado de la lista */}
          <div className="flex items-center gap-2 border-b border-stone-200 mb-5 pb-2.5">
            <h2 className="text-sm font-bold" style={{ color: 'var(--color-guinda-700)' }}>Lista de inscritos</h2>
            {data.stats.totalInscritos > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: 'var(--color-guinda-700)' }}>
                {filtroEstado === 'todos' ? data.stats.totalInscritos : `${inscritosFiltrados.length} de ${data.stats.totalInscritos}`}
              </span>
            )}
            {filtroEstado !== 'todos' && (
              <button
                onClick={() => setFiltroEstado('todos')}
                className="ml-auto text-[11px] font-semibold hover:underline"
                style={{ color: '#6b635e' }}
              >
                Filtrando por <strong style={{ color: 'var(--color-guinda-700)' }}>{filtroEstado}</strong> · quitar filtro
              </button>
            )}
          </div>

          {/* ── Lista de inscritos ── */}
          {(
            <>
              {/* Search */}
              <div className="relative mb-4" style={{ maxWidth: 360 }}>
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#6b635e' }} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-stone-200 bg-white"
                  placeholder="Buscar por nombre, CURP o municipio..."
                  style={{ color: '#443e39' }}
                />
              </div>

              {inscritosFiltrados.length === 0 ? (
                <div
                  className="bg-white border border-stone-200 rounded-xl flex items-center justify-center py-16 text-sm"
                  style={{ color: '#6b635e' }}
                >
                  {data.stats.totalInscritos === 0
                    ? 'No hay alumnos inscritos en esta etapa'
                    : 'Sin resultados para la búsqueda'}
                </div>
              ) : (
                <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
                  {/* Table header */}
                  <div
                    className="grid text-[11px] font-semibold uppercase tracking-wide px-4 py-2.5 border-b border-stone-100"
                    style={{
                      gridTemplateColumns: '28px 1fr 140px 90px 80px 32px',
                      gap: 12,
                      background: '#fafaf9',
                      color: '#6b635e',
                    }}
                  >
                    <span>#</span>
                    <span>Estudiante</span>
                    <span>Municipio</span>
                    <span>Módulos</span>
                    <span>Estado</span>
                    <span />
                  </div>

                  {inscritosFiltrados.map((insc, idx) => {
                    const isExpanded = expanded.has(insc.estudianteId);
                    const aprobados = insc.modulos.filter((m) => m.calificacion !== null && m.calificacion >= 60).length;
                    const reprobados = insc.modulos.filter((m) => m.calificacion !== null && m.calificacion < 60).length;

                    return (
                      <div key={insc.estudianteId} className="border-b border-stone-50 last:border-b-0">
                        {/* Row — clic en la fila expande módulos; clic en el nombre va al perfil */}
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => toggleExpand(insc.estudianteId)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(insc.estudianteId); } }}
                          className="grid items-center px-4 py-3 hover:bg-stone-50 transition-colors cursor-pointer"
                          style={{
                            gridTemplateColumns: '28px 1fr 140px 90px 80px 32px',
                            gap: 12,
                          }}
                        >
                          <span className="text-sm font-semibold" style={{ color: '#ddd0c5', fontFamily: "'Poppins', sans-serif" }}>
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <Link
                              href={`/admin/alumnos/${insc.estudianteId}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-[13px] font-semibold hover:underline"
                              style={{ color: 'var(--color-guinda-700)', fontFamily: "'Poppins', sans-serif" }}
                              title="Ver expediente del alumno"
                            >
                              {insc.nombreCompleto}
                            </Link>
                            {insc.curp && (
                              <div className="text-[10px] mt-0.5 font-mono" style={{ color: '#6b635e' }}>
                                {insc.curp}
                              </div>
                            )}
                          </div>
                          <span className="text-xs" style={{ color: '#6b635e' }}>
                            {insc.municipio ?? '—'}
                          </span>
                          <span className="text-sm font-semibold" style={{ color: '#443e39' }}>
                            {insc.totalModulos}
                          </span>
                          <div className="flex gap-1">
                            {aprobados > 0 && (
                              <span
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                style={{ background: '#d1fae5', color: '#065f46' }}
                              >
                                {aprobados}✓
                              </span>
                            )}
                            {reprobados > 0 && (
                              <span
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                style={{ background: '#fee2e2', color: '#991b1b' }}
                              >
                                {reprobados}✗
                              </span>
                            )}
                            {aprobados === 0 && reprobados === 0 && (
                              <span
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                style={{ background: '#fef9c3', color: '#92400e' }}
                              >
                                Pendiente
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-center">
                            {isExpanded
                              ? <ChevronDown size={14} style={{ color: '#6b635e' }} />
                              : <ChevronRight size={14} style={{ color: '#ddd0c5' }} />
                            }
                          </div>
                        </div>

                        {/* Expanded: modules */}
                        {isExpanded && (
                          <div className="px-12 pb-3 pt-1 border-t border-stone-50" style={{ background: '#fafaf9' }}>
                            <div className="flex flex-col gap-1.5">
                              {insc.modulos.map((mod) => {
                                const aprobado = mod.calificacion !== null && mod.calificacion >= 60;
                                const reprobado = mod.calificacion !== null && mod.calificacion < 60;
                                return (
                                  <div
                                    key={mod.numero}
                                    className="flex items-center justify-between gap-3 text-xs px-3 py-2 rounded-lg"
                                    style={{ background: 'white', border: '1px solid #f7f2ed' }}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span
                                        className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                                        style={{ background: '#f8f4ec', color: 'var(--color-guinda-700)' }}
                                      >
                                        {mod.numero}
                                      </span>
                                      <span className="truncate" style={{ color: '#443e39' }}>{mod.nombre}</span>
                                    </div>
                                    <div className="flex items-center gap-3 flex-shrink-0">
                                      <span
                                        className="font-mono text-[10px]"
                                        style={{ color: '#6b635e' }}
                                      >
                                        {mod.folio}
                                      </span>
                                      {mod.calificacion !== null ? (
                                        <span
                                          className="font-bold text-[11px] px-2 py-0.5 rounded-full"
                                          style={{
                                            background: aprobado ? '#d1fae5' : '#fee2e2',
                                            color: aprobado ? '#065f46' : '#991b1b',
                                          }}
                                        >
                                          {calif10(mod.calificacion)}
                                        </span>
                                      ) : (
                                        <span
                                          className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                                          style={{ background: '#fef9c3', color: '#92400e' }}
                                        >
                                          Pendiente
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="mt-2.5">
                              <Link
                                href={`/admin/alumnos/${insc.estudianteId}`}
                                className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50"
                                style={{ color: 'var(--color-guinda-700)' }}
                              >
                                Ver expediente del alumno <ChevronRight size={12} />
                              </Link>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

        </>
      )}
    </AdminLayout>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DateCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl px-5 py-3.5 flex items-center gap-3">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: '#f8f4ec', color: 'var(--color-guinda-700)' }}
      >
        {icon}
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: '#6b635e' }}>
          {label}
        </div>
        <div className="text-sm font-semibold mt-0.5" style={{ color: '#2a2a2a' }}>
          {value}
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  num, label, icon, color, bg, onClick, active, dimmed,
}: {
  num: number;
  label: string;
  icon: React.ReactNode;
  color?: string;
  bg?: string;
  onClick?: () => void;
  active?: boolean;
  dimmed?: boolean;
}) {
  const clickable = !!onClick;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={`text-left bg-white border rounded-xl px-4 py-3.5 transition-all ${clickable ? 'cursor-pointer hover:shadow-sm' : 'cursor-default'}`}
      style={{
        borderColor: active ? (color ?? 'var(--color-guinda-700)') : '#e7e5e4',
        boxShadow: active ? `0 0 0 1px ${color ?? 'var(--color-guinda-700)'}` : undefined,
        opacity: dimmed ? 0.55 : 1,
      }}
    >
      <div
        className="w-7 h-7 rounded-md flex items-center justify-center mb-2"
        style={{ background: bg ?? '#f8f4ec', color: color ?? 'var(--color-guinda-700)' }}
      >
        {icon}
      </div>
      <div
        className="text-2xl font-bold leading-none"
        style={{ fontFamily: "'Poppins', sans-serif", color: color ?? '#2a2a2a' }}
      >
        {num}
      </div>
      <div className="text-[10px] mt-1 flex items-center gap-1" style={{ color: '#6b635e' }}>
        {label}
        {active && <span style={{ color: color ?? 'var(--color-guinda-700)' }}>· filtrando</span>}
      </div>
    </button>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 gap-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-16 bg-stone-200 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-5 gap-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-20 bg-stone-200 rounded-xl" />
        ))}
      </div>
      <div className="h-8 bg-stone-200 rounded w-48" />
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-14 bg-stone-200 rounded-xl" />
      ))}
    </div>
  );
}
