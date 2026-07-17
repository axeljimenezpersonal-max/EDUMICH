/**
 * Módulo de Calificaciones del gestor.
 *
 * Dos vistas:
 *  · Exámenes oficiales — calificaciones de exámenes DGB (examenes_inscripciones),
 *    filtrables por convocatoria/módulo/estado y exportables a Excel (CSV).
 *  · Evaluaciones de práctica — quizzes de módulo en la plataforma
 *    (estudiantes_modulos_progreso): intentos, mejor y última calificación.
 *
 * Ubicación destino: artifacts/student-portal/src/pages/gestor/GestorCalificaciones.tsx
 */

import { useEffect, useMemo, useState } from 'react';
import {
  GraduationCap, Download, Search, X, CheckCircle2, XCircle,
  MinusCircle, ArrowUpDown, Layers, BookOpen, User, CalendarDays,
  ClipboardList, FileCheck2,
} from 'lucide-react';
import { GestorLayout } from './GestorLayout';
import { api, calif10 } from '../../lib/api';
import { RelacionCalificacionesPivote } from '../../components/RelacionCalificacionesPivote';
import { SectionTour } from '../../components/onboarding/SectionTour';
import { TOUR_G_CALIFICACIONES, GATE_GESTOR } from '../../components/onboarding/seccionesGestor';

// Calificación mínima aprobatoria de exámenes oficiales (la que aplica la
// captura del admin: >= 60 aprueba).
const APROBATORIA = 60;

// ── Tipos ─────────────────────────────────────────────────────────────
interface CalifRow {
  inscripcionId: number;
  estudianteId: number;
  alumno: string | null;
  curp: string | null;
  matricula: string | null;
  etapaId: number;
  etapaClave: string;
  etapaEtapa: string;
  etapaFase: string;
  etapaAnio: number;
  etapaExamenSabado: string | null;
  moduloId: number;
  moduloNumero: number;
  moduloNombre: string;
  folio: string;
  estadoExamen: string;
  calificacion: number | null;
  aciertos: number | null;
}

interface EvalRow {
  estudianteId: number;
  alumno: string | null;
  curp: string | null;
  moduloNumero: number;
  moduloNombre: string;
  estado: string;
  intentos: number;
  mejorCalificacion: number | null;
  ultimaCalificacion: number | null;
  ultimaActividad: string | null;
}

type EstadoCalif = 'aprobado' | 'reprobado' | 'no_presento' | 'sin_calificar';
type GroupBy = 'ninguno' | 'modulo' | 'alumno' | 'convocatoria';
type SortKey = 'alumno' | 'modulo' | 'convocatoria' | 'calificacion';
type SortDir = 'asc' | 'desc';
type Vista = 'examenes' | 'evaluaciones';

function estadoDe(r: Pick<CalifRow, 'calificacion' | 'estadoExamen'>): EstadoCalif {
  if (r.estadoExamen === 'no_presento') return 'no_presento';
  if (r.estadoExamen === 'aprobado') return 'aprobado';
  if (r.estadoExamen === 'reprobado') return 'reprobado';
  if (r.calificacion === null || r.calificacion === undefined) return 'sin_calificar';
  return r.calificacion >= APROBATORIA ? 'aprobado' : 'reprobado';
}

const ESTADO_META: Record<EstadoCalif, { label: string; bg: string; color: string }> = {
  aprobado:      { label: 'Aprobado',      bg: '#d1fae5', color: '#065f46' },
  reprobado:     { label: 'No aprobado',   bg: '#fee2e2', color: '#991b1b' },
  no_presento:   { label: 'No presentó',   bg: '#f5f5f4', color: '#78716c' },
  sin_calificar: { label: 'Sin calificar', bg: '#fef9c3', color: '#92400e' },
};

function convLabel(r: Pick<CalifRow, 'etapaClave' | 'etapaAnio'>) {
  return `${r.etapaClave} · ${r.etapaAnio}`;
}
function moduloLabel(r: Pick<CalifRow, 'moduloNumero' | 'moduloNombre'>) {
  return `Módulo ${r.moduloNumero} — ${r.moduloNombre}`;
}

// ── CSV (Excel-compatible, con BOM para acentos) ──────────────────────
function csvCell(v: string | number | null): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function descargarCSV(headers: string[], cuerpo: (string | number | null)[][], nombre: string) {
  const csv = '﻿' + [headers.join(','), ...cuerpo.map((r) => r.map(csvCell).join(','))].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nombre}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════════════════
export default function GestorCalificaciones() {
  const [vista, setVista] = useState<Vista>('examenes');

  return (
    <GestorLayout>
      {/* Encabezado */}
      <div className="mb-5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[var(--color-guinda-700)] font-semibold mb-1">
          <GraduationCap size={13} />
          Resultados de tus alumnos
        </div>
        <h1 className="font-serif text-3xl font-bold text-stone-900">Calificaciones</h1>
        <p className="text-stone-600 mt-1">
          Consulta, filtra y descarga los resultados de tus alumnos.
        </p>
      </div>

      {/* Selector de vista */}
      <div data-tour="g-cal-vista" className="mb-5 flex gap-2">
        {([
          ['examenes', 'Exámenes oficiales', FileCheck2, 'Calificaciones de exámenes DGB'],
          ['evaluaciones', 'Evaluaciones de práctica', ClipboardList, 'Quizzes de módulo en la plataforma'],
        ] as const).map(([val, label, Icon, desc]) => {
          const activo = vista === val;
          return (
            <button
              key={val}
              onClick={() => setVista(val)}
              className="flex-1 rounded-xl border p-3.5 text-left transition-colors"
              style={activo
                ? { borderColor: 'var(--color-guinda-700)', background: '#fff', boxShadow: '0 0 0 1px var(--color-guinda-700)' }
                : { borderColor: '#e7e2da', background: '#fff' }}
            >
              <div className="flex items-center gap-2">
                <Icon size={16} style={{ color: activo ? 'var(--color-guinda-700)' : '#a89a8e' }} />
                <span className="text-sm font-bold" style={{ color: activo ? 'var(--color-guinda-800)' : '#57504a' }}>{label}</span>
              </div>
              <div className="mt-0.5 pl-6 text-[11px] text-stone-500">{desc}</div>
            </button>
          );
        })}
      </div>

      {vista === 'examenes' ? <ExamenesView /> : <EvaluacionesView />}

      <SectionTour
        steps={TOUR_G_CALIFICACIONES}
        storageKey="modula_sec_g_calificaciones_v1"
        gateKey={GATE_GESTOR}
        buttonLabel="Tutorial de calificaciones"
      />
    </GestorLayout>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Vista 1 · Exámenes oficiales
// ═══════════════════════════════════════════════════════════════════════
function ExamenesView() {
  const [rows, setRows] = useState<CalifRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [fEtapa, setFEtapa] = useState<number | 'all'>('all');

  useEffect(() => {
    api
      .get<{ calificaciones: CalifRow[] }>('/gestor/calificaciones')
      .then((r) => setRows(r.calificaciones))
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudieron cargar las calificaciones'));
  }, []);

  const etapas = useMemo(() => {
    const m = new Map<number, string>();
    (rows ?? []).forEach((r) => m.set(r.etapaId, convLabel(r)));
    return Array.from(m, ([id, label]) => ({ id, label })).sort((a, b) => b.label.localeCompare(a.label));
  }, [rows]);

  const filtradas = useMemo(() => {
    const query = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => {
      if (fEtapa !== 'all' && r.etapaId !== fEtapa) return false;
      if (query) {
        const hay = `${r.alumno ?? ''} ${r.curp ?? ''} ${r.matricula ?? ''} ${r.folio}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [rows, q, fEtapa]);

  const stats = useMemo(() => {
    const total = filtradas.length;
    const calificadas = filtradas.filter((r) => r.calificacion !== null);
    const aprobados = filtradas.filter((r) => estadoDe(r) === 'aprobado').length;
    const reprobados = filtradas.filter((r) => estadoDe(r) === 'reprobado').length;
    const sinCalificar = filtradas.filter((r) => estadoDe(r) === 'sin_calificar').length;
    const promedio = calificadas.length
      ? Math.round(calificadas.reduce((s, r) => s + (r.calificacion ?? 0), 0) / calificadas.length)
      : null;
    const tasa = calificadas.length ? Math.round((aprobados / calificadas.length) * 100) : null;
    return { total, aprobados, reprobados, sinCalificar, promedio, tasa };
  }, [filtradas]);

  function limpiarFiltros() { setQ(''); setFEtapa('all'); }
  const hayFiltros = q !== '' || fEtapa !== 'all';

  // Descarga la Relación de Calificaciones y Aciertos (PDF oficial), respetando
  // la convocatoria elegida (o todas).
  function descargarPdf() {
    const qs = fEtapa !== 'all' ? `?etapaId=${fEtapa}` : '';
    window.open(`/api/gestor/calificaciones/pdf${qs}`, '_blank');
  }

  return (
    <>
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      {/* KPIs */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Exámenes" value={stats.total} />
        <Kpi label="Aprobados" value={stats.aprobados} tone="green" />
        <Kpi label="No aprobados" value={stats.reprobados} tone="red" />
        <Kpi label="Sin calificar" value={stats.sinCalificar} tone="amber" />
        <Kpi label="Promedio" value={stats.promedio != null ? calif10(stats.promedio) : '—'} tone="guinda" />
        <Kpi label="% aprobación" value={stats.tasa === null ? '—' : `${stats.tasa}%`} tone="guinda" />
      </div>

      {/* Barra de herramientas */}
      <div data-tour="g-cal-toolbar" className="mb-4 rounded-xl border border-stone-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre, matrícula, CURP o folio…"
              className="w-full rounded-lg border border-stone-200 py-2 pl-9 pr-3 text-sm focus:border-[var(--color-guinda-500)] focus:outline-none"
            />
          </div>
          <Select value={String(fEtapa)} onChange={(v) => setFEtapa(v === 'all' ? 'all' : Number(v))}>
            <option value="all">Todas las convocatorias</option>
            {etapas.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
          </Select>
          {hayFiltros && (
            <button onClick={limpiarFiltros} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-medium text-stone-500 hover:bg-stone-100">
              <X size={13} /> Limpiar
            </button>
          )}
          <button
            onClick={descargarPdf}
            disabled={filtradas.length === 0}
            className="ml-auto inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-opacity disabled:opacity-40"
            style={{ background: 'var(--color-guinda-700)' }}
            title="Descarga la Relación de Calificaciones y Aciertos (PDF oficial)"
          >
            <Download size={14} />
            Descargar PDF
          </button>
        </div>
      </div>

      {/* Relación por convocatoria (idéntica a la del admin / SEP) */}
      {rows === null ? (
        <div className="rounded-xl border border-stone-200 bg-white p-12 text-center text-stone-500">Cargando calificaciones…</div>
      ) : rows.length === 0 ? (
        <EmptyState
          hayFiltros={false}
          onLimpiar={limpiarFiltros}
          totalCargadas={0}
          vacioTitulo="Aún no hay calificaciones"
          vacioTexto="Cuando tus alumnos presenten exámenes y se registren sus calificaciones, aparecerán aquí."
        />
      ) : (
        <RelacionCalificacionesPivote rows={filtradas} alumnoHref={(id) => `/gestor/alumnos/${id}`} />
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Vista 2 · Evaluaciones de práctica
// ═══════════════════════════════════════════════════════════════════════
const ESTADO_EVAL: Record<string, { label: string; bg: string; color: string }> = {
  no_iniciado: { label: 'No iniciado', bg: '#f5f5f4', color: '#78716c' },
  en_curso:    { label: 'En curso',    bg: '#dbeafe', color: '#1e40af' },
  aprobado:    { label: 'Aprobado',    bg: '#d1fae5', color: '#065f46' },
};

function EvaluacionesView() {
  const [rows, setRows] = useState<EvalRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [fModulo, setFModulo] = useState<number | 'all'>('all');
  const [fEstado, setFEstado] = useState<string>('all');

  useEffect(() => {
    api
      .get<{ evaluaciones: EvalRow[] }>('/gestor/evaluaciones')
      .then((r) => setRows(r.evaluaciones))
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudieron cargar las evaluaciones'));
  }, []);

  const modulosOpts = useMemo(() => {
    const m = new Map<number, { numero: number; nombre: string }>();
    (rows ?? []).forEach((r) => m.set(r.moduloNumero, { numero: r.moduloNumero, nombre: r.moduloNombre }));
    return Array.from(m.values()).sort((a, b) => a.numero - b.numero);
  }, [rows]);

  const filtradas = useMemo(() => {
    const query = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => {
      if (fModulo !== 'all' && r.moduloNumero !== fModulo) return false;
      if (fEstado !== 'all' && r.estado !== fEstado) return false;
      if (query) {
        const hay = `${r.alumno ?? ''} ${r.curp ?? ''}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [rows, q, fModulo, fEstado]);

  const stats = useMemo(() => {
    const total = filtradas.length;
    const conIntentos = filtradas.filter((r) => r.intentos > 0);
    const aprobados = filtradas.filter((r) => r.estado === 'aprobado').length;
    const promedio = conIntentos.length
      ? Math.round(conIntentos.reduce((s, r) => s + (r.mejorCalificacion ?? 0), 0) / conIntentos.length)
      : null;
    return { total, activos: conIntentos.length, aprobados, promedio };
  }, [filtradas]);

  const hayFiltros = q !== '' || fModulo !== 'all' || fEstado !== 'all';

  function exportar() {
    descargarCSV(
      ['Alumno', 'CURP', 'No. módulo', 'Módulo', 'Estado', 'Intentos', 'Mejor calificación', 'Última calificación', 'Última actividad'],
      filtradas.map((r) => [
        r.alumno ?? '', r.curp ?? '', r.moduloNumero, r.moduloNombre,
        ESTADO_EVAL[r.estado]?.label ?? r.estado, r.intentos,
        r.mejorCalificacion ?? '', r.ultimaCalificacion ?? '',
        r.ultimaActividad ? new Date(r.ultimaActividad).toLocaleDateString('es-MX') : '',
      ]),
      'evaluaciones_practica'
    );
  }

  return (
    <>
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      {/* KPIs */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Registros" value={stats.total} />
        <Kpi label="Con actividad" value={stats.activos} tone="guinda" />
        <Kpi label="Módulos aprobados" value={stats.aprobados} tone="green" />
        <Kpi label="Promedio (mejor)" value={stats.promedio ?? '—'} tone="guinda" />
      </div>

      {/* Filtros */}
      <div className="mb-4 rounded-xl border border-stone-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre o CURP…"
              className="w-full rounded-lg border border-stone-200 py-2 pl-9 pr-3 text-sm focus:border-[var(--color-guinda-500)] focus:outline-none"
            />
          </div>
          <Select value={String(fModulo)} onChange={(v) => setFModulo(v === 'all' ? 'all' : Number(v))}>
            <option value="all">Todos los módulos</option>
            {modulosOpts.map((m) => <option key={m.numero} value={m.numero}>Módulo {m.numero} — {m.nombre}</option>)}
          </Select>
          <Select value={fEstado} onChange={setFEstado}>
            <option value="all">Todos los estados</option>
            <option value="aprobado">Aprobado</option>
            <option value="en_curso">En curso</option>
            <option value="no_iniciado">No iniciado</option>
          </Select>
          {hayFiltros && (
            <button
              onClick={() => { setQ(''); setFModulo('all'); setFEstado('all'); }}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-medium text-stone-500 hover:bg-stone-100"
            >
              <X size={13} /> Limpiar
            </button>
          )}
          <button
            onClick={exportar}
            disabled={filtradas.length === 0}
            className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-opacity disabled:opacity-40"
            style={{ background: 'var(--color-guinda-700)' }}
          >
            <Download size={14} />
            Descargar Excel {filtradas.length > 0 && `(${filtradas.length})`}
          </button>
        </div>
      </div>

      {/* Tabla */}
      {rows === null ? (
        <div className="rounded-xl border border-stone-200 bg-white p-12 text-center text-stone-500">Cargando evaluaciones…</div>
      ) : filtradas.length === 0 ? (
        <EmptyState
          hayFiltros={hayFiltros}
          onLimpiar={() => { setQ(''); setFModulo('all'); setFEstado('all'); }}
          totalCargadas={(rows ?? []).length}
          vacioTitulo="Aún no hay evaluaciones"
          vacioTexto="Cuando tus alumnos practiquen los quizzes de módulo en la plataforma, su avance aparecerá aquí."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-white text-[11px] uppercase tracking-wider text-stone-500">
                  <th className="px-3 py-2.5 text-left font-semibold">Alumno</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Módulo</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Estado</th>
                  <th className="px-3 py-2.5 text-center font-semibold">Intentos</th>
                  <th className="px-3 py-2.5 text-center font-semibold">Mejor</th>
                  <th className="px-3 py-2.5 text-center font-semibold">Última</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Actividad</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((r, i) => {
                  const meta = ESTADO_EVAL[r.estado] ?? ESTADO_EVAL.no_iniciado;
                  return (
                    <tr key={`${r.estudianteId}-${r.moduloNumero}`} className={`border-b border-stone-100 last:border-0 ${i % 2 ? 'bg-stone-50/40' : 'bg-white'} hover:bg-[var(--color-crema-50)]`}>
                      <td className="px-3 py-2">
                        <div className="font-medium text-stone-900">{r.alumno ?? '—'}</div>
                        <div className="font-mono text-[10px] text-stone-400">{r.curp ?? ''}</div>
                      </td>
                      <td className="px-3 py-2 text-stone-700">
                        <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold" style={{ background: '#f8f4ec', color: 'var(--color-guinda-700)' }}>
                          {r.moduloNumero}
                        </span>
                        <span className="text-stone-600">{r.moduloNombre}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: meta.bg, color: meta.color }}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-stone-600">{r.intentos}</td>
                      <td className="px-3 py-2 text-center">
                        {r.mejorCalificacion === null ? <span className="text-stone-300">—</span> : (
                          <span className="inline-block min-w-[2.25rem] rounded-md px-2 py-0.5 font-mono text-sm font-bold" style={{ background: r.mejorCalificacion >= 60 ? '#d1fae5' : '#fee2e2', color: r.mejorCalificacion >= 60 ? '#065f46' : '#991b1b' }}>
                            {r.mejorCalificacion}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-stone-600">{r.ultimaCalificacion ?? '—'}</td>
                      <td className="px-3 py-2 text-xs text-stone-500">
                        {r.ultimaActividad ? new Date(r.ultimaActividad).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Piezas compartidas
// ═══════════════════════════════════════════════════════════════════════
function Tabla({
  rows, groupBy, sortKey, sortDir, onSort,
}: {
  rows: CalifRow[];
  groupBy: GroupBy;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const Th = ({ k, children, className = '' }: { k?: SortKey; children: React.ReactNode; className?: string }) => (
    <th className={`px-3 py-2.5 text-left font-semibold ${className}`}>
      {k ? (
        <button onClick={() => onSort(k)} className="inline-flex items-center gap-1 hover:text-[var(--color-guinda-700)]">
          {children}
          <ArrowUpDown size={11} className={sortKey === k ? 'opacity-100' : 'opacity-30'} />
          {sortKey === k && <span className="text-[9px]">{sortDir === 'asc' ? '▲' : '▼'}</span>}
        </button>
      ) : children}
    </th>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-200 bg-white text-[11px] uppercase tracking-wider text-stone-500">
            {groupBy !== 'alumno' && <Th k="alumno">Alumno</Th>}
            {groupBy !== 'alumno' && <th className="px-3 py-2.5 text-left font-semibold">CURP</th>}
            {groupBy !== 'convocatoria' && <Th k="convocatoria">Convocatoria</Th>}
            {groupBy !== 'modulo' && <Th k="modulo">Módulo</Th>}
            <Th k="calificacion" className="text-center">Calif.</Th>
            <th className="px-3 py-2.5 text-center font-semibold">Aciertos</th>
            <th className="px-3 py-2.5 text-left font-semibold">Estado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const est = estadoDe(r);
            const meta = ESTADO_META[est];
            return (
              <tr key={r.inscripcionId} className={`border-b border-stone-100 last:border-0 ${i % 2 ? 'bg-stone-50/40' : 'bg-white'} hover:bg-[var(--color-crema-50)]`}>
                {groupBy !== 'alumno' && (
                  <td className="px-3 py-2 font-medium text-stone-900">{r.alumno ?? '—'}</td>
                )}
                {groupBy !== 'alumno' && (
                  <td className="px-3 py-2 font-mono text-[11px] text-stone-500">{r.curp ?? '—'}</td>
                )}
                {groupBy !== 'convocatoria' && (
                  <td className="px-3 py-2 text-stone-600">{convLabel(r)}</td>
                )}
                {groupBy !== 'modulo' && (
                  <td className="px-3 py-2 text-stone-700">
                    <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold" style={{ background: '#f8f4ec', color: 'var(--color-guinda-700)' }}>
                      {r.moduloNumero}
                    </span>
                    <span className="text-stone-600">{r.moduloNombre}</span>
                  </td>
                )}
                <td className="px-3 py-2 text-center">
                  {r.calificacion === null ? (
                    <span className="font-mono text-stone-300">—</span>
                  ) : (
                    <span
                      className="inline-block min-w-[2.25rem] rounded-md px-2 py-0.5 font-mono text-sm font-bold"
                      style={{ background: meta.bg, color: meta.color }}
                    >
                      {calif10(r.calificacion)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-center font-mono text-sm text-stone-600">
                  {r.aciertos ?? <span className="text-stone-300">—</span>}
                </td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: meta.color }}>
                    {est === 'aprobado' && <CheckCircle2 size={13} />}
                    {est === 'reprobado' && <XCircle size={13} />}
                    {(est === 'sin_calificar' || est === 'no_presento') && <MinusCircle size={13} className="text-stone-400" />}
                    {meta.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Kpi({ label, value, tone = 'neutral' }: { label: string; value: number | string; tone?: 'neutral' | 'green' | 'red' | 'amber' | 'guinda' }) {
  const color =
    tone === 'green' ? '#059669'
    : tone === 'red' ? '#dc2626'
    : tone === 'guinda' ? 'var(--color-guinda-700)'
    : tone === 'amber' ? '#b45309'
    : '#1c1917';
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-4 py-3">
      <div className="font-serif text-2xl font-bold leading-none" style={{ color }}>{value}</div>
      <div className="mt-1.5 text-xs text-stone-500">{label}</div>
    </div>
  );
}

function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-stone-200 bg-white py-2 pl-3 pr-8 text-sm text-stone-700 focus:border-[var(--color-guinda-500)] focus:outline-none"
    >
      {children}
    </select>
  );
}

function EmptyState({
  hayFiltros, onLimpiar, totalCargadas, vacioTitulo, vacioTexto,
}: {
  hayFiltros: boolean;
  onLimpiar: () => void;
  totalCargadas: number;
  vacioTitulo: string;
  vacioTexto: string;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-12 text-center">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-crema-100)] text-[var(--color-guinda-700)]">
        <GraduationCap size={22} />
      </div>
      {totalCargadas === 0 ? (
        <>
          <h3 className="font-serif text-xl font-semibold text-stone-900">{vacioTitulo}</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-stone-600">{vacioTexto}</p>
        </>
      ) : (
        <>
          <h3 className="font-serif text-xl font-semibold text-stone-900">Sin resultados</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-stone-600">Ningún registro coincide con los filtros actuales.</p>
          {hayFiltros && (
            <button
              onClick={onLimpiar}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              <X size={14} /> Limpiar filtros
            </button>
          )}
        </>
      )}
    </div>
  );
}
