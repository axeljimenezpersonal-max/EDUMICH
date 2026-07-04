/**
 * Módulo de Calificaciones del gestor.
 *
 * Muestra TODAS las calificaciones de los alumnos del municipio en una tabla
 * tipo Excel: filtrable (por convocatoria, módulo, estado y búsqueda de alumno),
 * agrupable (por módulo, alumno o convocatoria) y exportable a CSV/Excel.
 *
 * Ubicación destino: artifacts/student-portal/src/pages/gestor/GestorCalificaciones.tsx
 */

import { useEffect, useMemo, useState } from 'react';
import {
  GraduationCap, Download, Search, X, CheckCircle2, XCircle,
  MinusCircle, ArrowUpDown, Layers, BookOpen, User, CalendarDays,
} from 'lucide-react';
import { GestorLayout } from './GestorLayout';
import { api } from '../../lib/api';

// Calificación mínima aprobatoria (misma convención que la vista de convocatorias).
const APROBATORIA = 70;

interface CalifRow {
  inscripcionId: number;
  estudianteId: number;
  alumno: string | null;
  curp: string | null;
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
}

type EstadoCalif = 'aprobado' | 'reprobado' | 'sin_calificar';
type GroupBy = 'ninguno' | 'modulo' | 'alumno' | 'convocatoria';
type SortKey = 'alumno' | 'modulo' | 'convocatoria' | 'calificacion';
type SortDir = 'asc' | 'desc';

function estadoDe(cal: number | null): EstadoCalif {
  if (cal === null || cal === undefined) return 'sin_calificar';
  return cal >= APROBATORIA ? 'aprobado' : 'reprobado';
}

const ESTADO_META: Record<EstadoCalif, { label: string; bg: string; color: string }> = {
  aprobado:      { label: 'Aprobado',      bg: '#d1fae5', color: '#065f46' },
  reprobado:     { label: 'No aprobado',   bg: '#fee2e2', color: '#991b1b' },
  sin_calificar: { label: 'Sin calificar', bg: '#f5f5f4', color: '#78716c' },
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
function descargarCSV(rows: CalifRow[], nombre: string) {
  const headers = ['Alumno', 'CURP', 'Convocatoria', 'No. módulo', 'Módulo', 'Folio', 'Calificación', 'Estado'];
  const cuerpo = rows.map((r) =>
    [
      r.alumno ?? '',
      r.curp ?? '',
      convLabel(r),
      r.moduloNumero,
      r.moduloNombre,
      r.folio,
      r.calificacion ?? '',
      ESTADO_META[estadoDe(r.calificacion)].label,
    ].map(csvCell).join(',')
  );
  const csv = '﻿' + [headers.join(','), ...cuerpo].join('\r\n');
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

export default function GestorCalificaciones() {
  const [rows, setRows] = useState<CalifRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [q, setQ] = useState('');
  const [fEtapa, setFEtapa] = useState<number | 'all'>('all');
  const [fModulo, setFModulo] = useState<number | 'all'>('all');
  const [fEstado, setFEstado] = useState<EstadoCalif | 'all'>('all');
  const [groupBy, setGroupBy] = useState<GroupBy>('modulo');
  const [sortKey, setSortKey] = useState<SortKey>('alumno');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  useEffect(() => {
    api
      .get<{ calificaciones: CalifRow[] }>('/gestor/calificaciones')
      .then((r) => setRows(r.calificaciones))
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudieron cargar las calificaciones'));
  }, []);

  // Opciones de filtro derivadas de los datos.
  const etapas = useMemo(() => {
    const m = new Map<number, string>();
    (rows ?? []).forEach((r) => m.set(r.etapaId, convLabel(r)));
    return Array.from(m, ([id, label]) => ({ id, label })).sort((a, b) => b.label.localeCompare(a.label));
  }, [rows]);

  const modulosOpts = useMemo(() => {
    const m = new Map<number, { numero: number; nombre: string }>();
    (rows ?? []).forEach((r) => m.set(r.moduloNumero, { numero: r.moduloNumero, nombre: r.moduloNombre }));
    return Array.from(m.values()).sort((a, b) => a.numero - b.numero);
  }, [rows]);

  // Filtrado
  const filtradas = useMemo(() => {
    const query = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => {
      if (fEtapa !== 'all' && r.etapaId !== fEtapa) return false;
      if (fModulo !== 'all' && r.moduloNumero !== fModulo) return false;
      if (fEstado !== 'all' && estadoDe(r.calificacion) !== fEstado) return false;
      if (query) {
        const hay = `${r.alumno ?? ''} ${r.curp ?? ''}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [rows, q, fEtapa, fModulo, fEstado]);

  // Orden
  const ordenadas = useMemo(() => {
    const arr = [...filtradas];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'alumno': cmp = (a.alumno ?? '').localeCompare(b.alumno ?? ''); break;
        case 'modulo': cmp = a.moduloNumero - b.moduloNumero; break;
        case 'convocatoria': cmp = convLabel(a).localeCompare(convLabel(b)); break;
        case 'calificacion': {
          const av = a.calificacion ?? -1, bv = b.calificacion ?? -1;
          cmp = av - bv; break;
        }
      }
      if (cmp === 0) cmp = (a.alumno ?? '').localeCompare(b.alumno ?? '') || a.moduloNumero - b.moduloNumero;
      return cmp * dir;
    });
    return arr;
  }, [filtradas, sortKey, sortDir]);

  // Estadísticas del conjunto filtrado
  const stats = useMemo(() => {
    const total = filtradas.length;
    const calificadas = filtradas.filter((r) => r.calificacion !== null);
    const aprobados = calificadas.filter((r) => r.calificacion! >= APROBATORIA).length;
    const reprobados = calificadas.length - aprobados;
    const sinCalificar = total - calificadas.length;
    const promedio = calificadas.length
      ? Math.round(calificadas.reduce((s, r) => s + (r.calificacion ?? 0), 0) / calificadas.length)
      : null;
    const tasa = calificadas.length ? Math.round((aprobados / calificadas.length) * 100) : null;
    return { total, aprobados, reprobados, sinCalificar, promedio, tasa };
  }, [filtradas]);

  // Agrupación
  const grupos = useMemo(() => {
    if (groupBy === 'ninguno') return null;
    const map = new Map<string, { label: string; sub: string; rows: CalifRow[]; orden: number | string }>();
    for (const r of ordenadas) {
      let key: string, label: string, sub: string, orden: number | string;
      if (groupBy === 'modulo') {
        key = `m${r.moduloNumero}`; label = moduloLabel(r); sub = ''; orden = r.moduloNumero;
      } else if (groupBy === 'alumno') {
        key = `a${r.estudianteId}`; label = r.alumno ?? '—'; sub = r.curp ?? ''; orden = r.alumno ?? '';
      } else {
        key = `e${r.etapaId}`; label = convLabel(r); sub = ''; orden = r.etapaClave;
      }
      if (!map.has(key)) map.set(key, { label, sub, rows: [], orden });
      map.get(key)!.rows.push(r);
    }
    return Array.from(map.values()).sort((a, b) =>
      typeof a.orden === 'number' && typeof b.orden === 'number'
        ? a.orden - b.orden
        : String(a.orden).localeCompare(String(b.orden))
    );
  }, [ordenadas, groupBy]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('asc'); }
  }

  function limpiarFiltros() {
    setQ(''); setFEtapa('all'); setFModulo('all'); setFEstado('all');
  }
  const hayFiltros = q !== '' || fEtapa !== 'all' || fModulo !== 'all' || fEstado !== 'all';

  function exportar() {
    const partes = ['calificaciones'];
    if (fEtapa !== 'all') partes.push(etapas.find((e) => e.id === fEtapa)?.label.replace(/[^\w]/g, '') ?? '');
    if (fModulo !== 'all') partes.push(`M${fModulo}`);
    descargarCSV(ordenadas, partes.filter(Boolean).join('_'));
  }

  return (
    <GestorLayout>
      {/* Encabezado */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[var(--color-guinda-700)] font-semibold mb-1">
            <GraduationCap size={13} />
            Resultados de exámenes
          </div>
          <h1 className="font-serif text-3xl font-bold text-stone-900">Calificaciones</h1>
          <p className="text-stone-600 mt-1">
            Todas las calificaciones de tus alumnos. Filtra, agrupa y descárgalas en Excel.
          </p>
        </div>
        <button
          onClick={exportar}
          disabled={ordenadas.length === 0}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity disabled:opacity-40"
          style={{ background: 'var(--color-guinda-700)' }}
        >
          <Download size={16} />
          Descargar Excel {ordenadas.length > 0 && `(${ordenadas.length})`}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* KPIs */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Exámenes" value={stats.total} />
        <Kpi label="Aprobados" value={stats.aprobados} tone="green" />
        <Kpi label="No aprobados" value={stats.reprobados} tone="red" />
        <Kpi label="Sin calificar" value={stats.sinCalificar} tone="gray" />
        <Kpi label="Promedio" value={stats.promedio ?? '—'} tone="guinda" />
        <Kpi label="% aprobación" value={stats.tasa === null ? '—' : `${stats.tasa}%`} tone="guinda" />
      </div>

      {/* Barra de herramientas: agrupar + filtros */}
      <div className="mb-4 rounded-xl border border-stone-200 bg-white p-3">
        {/* Agrupar por */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Agrupar por</span>
          {([
            ['modulo', 'Módulo', BookOpen],
            ['alumno', 'Alumno', User],
            ['convocatoria', 'Convocatoria', CalendarDays],
            ['ninguno', 'Sin agrupar', Layers],
          ] as const).map(([val, label, Icon]) => (
            <button
              key={val}
              onClick={() => setGroupBy(val)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                groupBy === val
                  ? 'border-transparent text-white'
                  : 'border-stone-200 text-stone-600 hover:bg-stone-50'
              }`}
              style={groupBy === val ? { background: 'var(--color-guinda-700)' } : undefined}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {/* Filtros */}
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
          <Select value={String(fEtapa)} onChange={(v) => setFEtapa(v === 'all' ? 'all' : Number(v))}>
            <option value="all">Todas las convocatorias</option>
            {etapas.map((e) => (
              <option key={e.id} value={e.id}>{e.label}</option>
            ))}
          </Select>
          <Select value={String(fModulo)} onChange={(v) => setFModulo(v === 'all' ? 'all' : Number(v))}>
            <option value="all">Todos los módulos</option>
            {modulosOpts.map((m) => (
              <option key={m.numero} value={m.numero}>Módulo {m.numero} — {m.nombre}</option>
            ))}
          </Select>
          <Select value={fEstado} onChange={(v) => setFEstado(v as EstadoCalif | 'all')}>
            <option value="all">Todos los estados</option>
            <option value="aprobado">Aprobados</option>
            <option value="reprobado">No aprobados</option>
            <option value="sin_calificar">Sin calificar</option>
          </Select>
          {hayFiltros && (
            <button
              onClick={limpiarFiltros}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-medium text-stone-500 hover:bg-stone-100"
            >
              <X size={13} /> Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Contenido */}
      {rows === null ? (
        <div className="rounded-xl border border-stone-200 bg-white p-12 text-center text-stone-500">
          Cargando calificaciones…
        </div>
      ) : ordenadas.length === 0 ? (
        <EmptyState hayFiltros={hayFiltros} onLimpiar={limpiarFiltros} totalCargadas={(rows ?? []).length} />
      ) : grupos ? (
        <div className="space-y-4">
          {grupos.map((g) => {
            const gCal = g.rows.filter((r) => r.calificacion !== null);
            const gAprob = gCal.filter((r) => r.calificacion! >= APROBATORIA).length;
            const gProm = gCal.length ? Math.round(gCal.reduce((s, r) => s + (r.calificacion ?? 0), 0) / gCal.length) : null;
            return (
              <div key={g.label} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-[var(--color-crema-100)] px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-stone-900">{g.label}</div>
                    {g.sub && <div className="font-mono text-[11px] text-stone-500">{g.sub}</div>}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-medium text-stone-500">
                    <span>{g.rows.length} exam.</span>
                    <span className="text-emerald-700">{gAprob} aprob.</span>
                    <span>Prom. <strong className="text-stone-800">{gProm ?? '—'}</strong></span>
                  </div>
                </div>
                <Tabla rows={g.rows} groupBy={groupBy} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <Tabla rows={ordenadas} groupBy={groupBy} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
        </div>
      )}
    </GestorLayout>
  );
}

// ─────────────────────────────────────────────────────────────────────
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
            <th className="px-3 py-2.5 text-left font-semibold">Estado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const est = estadoDe(r.calificacion);
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
                      {r.calificacion}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: meta.color }}>
                    {est === 'aprobado' && <CheckCircle2 size={13} />}
                    {est === 'reprobado' && <XCircle size={13} />}
                    {est === 'sin_calificar' && <MinusCircle size={13} className="text-stone-400" />}
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

function Kpi({ label, value, tone = 'neutral' }: { label: string; value: number | string; tone?: 'neutral' | 'green' | 'red' | 'gray' | 'guinda' }) {
  const color =
    tone === 'green' ? '#059669'
    : tone === 'red' ? '#dc2626'
    : tone === 'guinda' ? 'var(--color-guinda-700)'
    : tone === 'gray' ? '#78716c'
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

function EmptyState({ hayFiltros, onLimpiar, totalCargadas }: { hayFiltros: boolean; onLimpiar: () => void; totalCargadas: number }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-12 text-center">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-crema-100)] text-[var(--color-guinda-700)]">
        <GraduationCap size={22} />
      </div>
      {totalCargadas === 0 ? (
        <>
          <h3 className="font-serif text-xl font-semibold text-stone-900">Aún no hay calificaciones</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-stone-600">
            Cuando tus alumnos presenten exámenes y se registren sus calificaciones, aparecerán aquí.
          </p>
        </>
      ) : (
        <>
          <h3 className="font-serif text-xl font-semibold text-stone-900">Sin resultados</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-stone-600">
            Ninguna calificación coincide con los filtros actuales.
          </p>
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
