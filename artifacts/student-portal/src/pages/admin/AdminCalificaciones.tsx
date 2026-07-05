/**
 * Calificaciones (admin) — carga profesional por Excel + tabla general.
 *
 * Flujo Excel:
 *  1. Elegir etapa y descargar la plantilla .xlsx (folios pendientes de calificar).
 *  2. Capturar CALIFICACIÓN (0-100) o marcar NO PRESENTÓ y subir el archivo.
 *  3. El sistema cruza por FOLIO, registra (misma lógica que la captura manual:
 *     ≥60 aprueba) y muestra el resumen con omitidas y motivos.
 *
 * También incluye la tabla de TODAS las calificaciones con filtros y export,
 * y enlace a la captura manual existente.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import {
  GraduationCap, Download, Search, X, CheckCircle2, XCircle, MinusCircle,
  FileSpreadsheet, UploadCloud, Loader2, PencilLine, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { api } from '../../lib/api';

// ── Tipos ─────────────────────────────────────────────────────────────
interface Row {
  inscripcionId: number;
  estudianteId: number;
  alumno: string | null;
  curp: string | null;
  municipio: string | null;
  etapaId: number;
  etapaClave: string;
  etapaAnio: number;
  moduloNumero: number;
  moduloNombre: string;
  folio: string;
  estadoExamen: string;
  calificacion: number | null;
  sede: string | null;
}

interface ResumenSubida {
  ok: boolean;
  aplicadas: number;
  noPresento: number;
  omitidas: { folio: string; motivo: string }[];
}

type EstadoCalif = 'aprobado' | 'reprobado' | 'no_presento' | 'sin_calificar';

function estadoDe(r: Pick<Row, 'calificacion' | 'estadoExamen'>): EstadoCalif {
  if (r.estadoExamen === 'no_presento') return 'no_presento';
  if (r.estadoExamen === 'aprobado') return 'aprobado';
  if (r.estadoExamen === 'reprobado') return 'reprobado';
  if (r.calificacion === null) return 'sin_calificar';
  return r.calificacion >= 60 ? 'aprobado' : 'reprobado';
}

const ESTADO_META: Record<EstadoCalif, { label: string; bg: string; color: string }> = {
  aprobado:      { label: 'Aprobado',      bg: '#d1fae5', color: '#065f46' },
  reprobado:     { label: 'No aprobado',   bg: '#fee2e2', color: '#991b1b' },
  no_presento:   { label: 'No presentó',   bg: '#f5f5f4', color: '#78716c' },
  sin_calificar: { label: 'Sin calificar', bg: '#fef9c3', color: '#92400e' },
};

function csvCell(v: string | number | null): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// ═══════════════════════════════════════════════════════════════════════
export default function AdminCalificaciones() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    try {
      const r = await api.get<{ calificaciones: Row[] }>('/admin/calificaciones/tabla');
      setRows(r.calificaciones);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las calificaciones');
    }
  }
  useEffect(() => { cargar(); }, []);

  return (
    <AdminLayout>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[var(--color-guinda-700)] font-semibold mb-1">
            <GraduationCap size={13} /> Resultados de exámenes
          </div>
          <h1 className="font-serif text-3xl font-bold text-stone-900">Calificaciones</h1>
          <p className="text-stone-600 mt-1">
            Registra las calificaciones oficiales por Excel y consulta el histórico completo.
          </p>
        </div>
        <Link
          href="/admin/captura-masiva-calificaciones"
          className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
        >
          <PencilLine size={14} /> Captura manual
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      <SubidaExcel rows={rows} onAplicado={cargar} />
      <TablaGeneral rows={rows} />
    </AdminLayout>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Carga por Excel (3 pasos)
// ═══════════════════════════════════════════════════════════════════════
function SubidaExcel({ rows, onAplicado }: { rows: Row[] | null; onAplicado: () => void }) {
  const [etapaId, setEtapaId] = useState<number | ''>('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [resumen, setResumen] = useState<ResumenSubida | null>(null);
  const [errorSubida, setErrorSubida] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Etapas con exámenes pendientes de calificar (derivadas de la tabla).
  const etapas = useMemo(() => {
    const m = new Map<number, { id: number; label: string; pendientes: number }>();
    (rows ?? []).forEach((r) => {
      const pendiente = r.calificacion === null && !['cancelado', 'no_presento'].includes(r.estadoExamen);
      const cur = m.get(r.etapaId) ?? { id: r.etapaId, label: `${r.etapaClave} · ${r.etapaAnio}`, pendientes: 0 };
      if (pendiente) cur.pendientes++;
      m.set(r.etapaId, cur);
    });
    return Array.from(m.values()).sort((a, b) => b.label.localeCompare(a.label));
  }, [rows]);

  function elegirArchivo(f: File | null) {
    setResumen(null);
    setErrorSubida(null);
    if (f && !f.name.toLowerCase().endsWith('.xlsx')) {
      setErrorSubida('El archivo debe ser .xlsx (usa la plantilla descargable).');
      return;
    }
    setArchivo(f);
  }

  async function subir() {
    if (!archivo || subiendo) return;
    setSubiendo(true);
    setErrorSubida(null);
    setResumen(null);
    try {
      const fd = new FormData();
      fd.append('archivo', archivo);
      const r = await api.post<ResumenSubida>('/admin/calificaciones/subir-excel', fd);
      setResumen(r);
      setArchivo(null);
      if (fileRef.current) fileRef.current.value = '';
      onAplicado();
    } catch (e) {
      setErrorSubida(e instanceof Error ? e.message : 'No se pudo procesar el archivo');
    } finally {
      setSubiendo(false);
    }
  }

  const etapaSel = etapas.find((e) => e.id === etapaId);

  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-stone-200 bg-white">
      <div className="flex items-center gap-2 px-5 py-3" style={{ background: 'var(--color-guinda-700)' }}>
        <FileSpreadsheet size={15} className="text-white" />
        <h2 className="text-sm font-semibold text-white">Subir calificaciones desde Excel</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-3">
        {/* Paso 1 */}
        <div className="rounded-xl border border-stone-200 p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: 'var(--color-guinda-700)' }}>1</span>
            <span className="text-sm font-bold text-stone-900">Descarga la plantilla</span>
          </div>
          <p className="mb-3 text-xs leading-relaxed text-stone-500">
            Elige la convocatoria; la plantilla trae los folios <strong>con pago verificado</strong> pendientes de calificar.
          </p>
          <select
            value={etapaId}
            onChange={(e) => setEtapaId(e.target.value ? Number(e.target.value) : '')}
            className="mb-2.5 w-full rounded-lg border border-stone-200 bg-white py-2 pl-3 pr-8 text-sm text-stone-700 focus:border-[var(--color-guinda-500)] focus:outline-none"
          >
            <option value="">Selecciona convocatoria…</option>
            {etapas.map((e) => (
              <option key={e.id} value={e.id}>{e.label} ({e.pendientes} pendientes)</option>
            ))}
          </select>
          <a
            href={etapaId ? `/api/admin/calificaciones/plantilla-excel?etapaId=${etapaId}` : undefined}
            aria-disabled={!etapaId}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
              etapaId
                ? 'border-stone-200 bg-white text-[var(--color-guinda-700)] hover:bg-stone-50'
                : 'pointer-events-none border-stone-100 bg-stone-50 text-stone-300'
            }`}
          >
            <Download size={14} /> Descargar plantilla {etapaSel ? `(${etapaSel.pendientes})` : ''}
          </a>
        </div>

        {/* Paso 2 */}
        <div className="rounded-xl border border-stone-200 p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: 'var(--color-guinda-700)' }}>2</span>
            <span className="text-sm font-bold text-stone-900">Captura y sube</span>
          </div>
          <p className="mb-3 text-xs leading-relaxed text-stone-500">
            Llena <strong>CALIFICACIÓN</strong> (0–100) o marca <strong>NO PRESENTÓ</strong> con una X, sin tocar el FOLIO.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => elegirArchivo(e.target.files?.[0] ?? null)}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="mb-2.5 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-stone-200 px-3 py-3 text-xs font-medium text-stone-500 hover:border-[var(--color-guinda-500)] hover:text-[var(--color-guinda-700)]"
          >
            <UploadCloud size={16} />
            {archivo ? archivo.name : 'Elegir archivo .xlsx…'}
          </button>
          <button
            onClick={subir}
            disabled={!archivo || subiendo}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white shadow-sm transition-opacity disabled:opacity-40"
            style={{ background: 'var(--color-guinda-700)' }}
          >
            {subiendo ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
            {subiendo ? 'Procesando…' : 'Subir y registrar'}
          </button>
        </div>

        {/* Paso 3 — resultado */}
        <div className="rounded-xl border border-stone-200 p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: 'var(--color-guinda-700)' }}>3</span>
            <span className="text-sm font-bold text-stone-900">Resultado</span>
          </div>
          {errorSubida && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{errorSubida}</div>
          )}
          {!errorSubida && !resumen && (
            <p className="text-xs leading-relaxed text-stone-400">
              Aquí verás cuántas calificaciones se registraron y cuáles filas se omitieron (con el motivo).
            </p>
          )}
          {resumen && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                <CheckCircle2 size={14} /> {resumen.aplicadas} calificaciones registradas
              </div>
              {resumen.noPresento > 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-stone-100 px-3 py-2 text-xs font-semibold text-stone-600">
                  <MinusCircle size={14} /> {resumen.noPresento} marcados como no presentó
                </div>
              )}
              {resumen.omitidas.length > 0 && (
                <details className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <summary className="flex cursor-pointer items-center gap-1.5 font-semibold">
                    <AlertTriangle size={13} /> {resumen.omitidas.length} omitidas — ver motivos
                  </summary>
                  <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto">
                    {resumen.omitidas.map((o, i) => (
                      <li key={i}><span className="font-mono">{o.folio}</span>: {o.motivo}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Tabla general
// ═══════════════════════════════════════════════════════════════════════
function TablaGeneral({ rows }: { rows: Row[] | null }) {
  const [q, setQ] = useState('');
  const [fEtapa, setFEtapa] = useState<number | 'all'>('all');
  const [fModulo, setFModulo] = useState<number | 'all'>('all');
  const [fEstado, setFEstado] = useState<EstadoCalif | 'all'>('all');

  const etapas = useMemo(() => {
    const m = new Map<number, string>();
    (rows ?? []).forEach((r) => m.set(r.etapaId, `${r.etapaClave} · ${r.etapaAnio}`));
    return Array.from(m, ([id, label]) => ({ id, label })).sort((a, b) => b.label.localeCompare(a.label));
  }, [rows]);

  const modulosOpts = useMemo(() => {
    const m = new Map<number, { numero: number; nombre: string }>();
    (rows ?? []).forEach((r) => m.set(r.moduloNumero, { numero: r.moduloNumero, nombre: r.moduloNombre }));
    return Array.from(m.values()).sort((a, b) => a.numero - b.numero);
  }, [rows]);

  const filtradas = useMemo(() => {
    const query = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => {
      if (fEtapa !== 'all' && r.etapaId !== fEtapa) return false;
      if (fModulo !== 'all' && r.moduloNumero !== fModulo) return false;
      if (fEstado !== 'all' && estadoDe(r) !== fEstado) return false;
      if (query) {
        const hay = `${r.alumno ?? ''} ${r.curp ?? ''} ${r.folio} ${r.municipio ?? ''}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [rows, q, fEtapa, fModulo, fEstado]);

  const stats = useMemo(() => {
    const total = filtradas.length;
    const aprobados = filtradas.filter((r) => estadoDe(r) === 'aprobado').length;
    const reprobados = filtradas.filter((r) => estadoDe(r) === 'reprobado').length;
    const sinCalificar = filtradas.filter((r) => estadoDe(r) === 'sin_calificar').length;
    const calificadas = filtradas.filter((r) => r.calificacion !== null);
    const promedio = calificadas.length
      ? Math.round(calificadas.reduce((s, r) => s + (r.calificacion ?? 0), 0) / calificadas.length)
      : null;
    return { total, aprobados, reprobados, sinCalificar, promedio };
  }, [filtradas]);

  const hayFiltros = q !== '' || fEtapa !== 'all' || fModulo !== 'all' || fEstado !== 'all';

  function exportar() {
    const headers = ['Alumno', 'CURP', 'Municipio', 'Convocatoria', 'No. módulo', 'Módulo', 'Folio', 'Sede', 'Calificación', 'Estado'];
    const cuerpo = filtradas.map((r) =>
      [
        r.alumno ?? '', r.curp ?? '', r.municipio ?? '', `${r.etapaClave} · ${r.etapaAnio}`,
        r.moduloNumero, r.moduloNombre, r.folio, r.sede ?? '', r.calificacion ?? '',
        ESTADO_META[estadoDe(r)].label,
      ].map(csvCell).join(',')
    );
    const csv = '﻿' + [headers.join(','), ...cuerpo].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'calificaciones.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Kpi label="Exámenes" value={stats.total} />
        <Kpi label="Aprobados" value={stats.aprobados} tone="green" />
        <Kpi label="No aprobados" value={stats.reprobados} tone="red" />
        <Kpi label="Sin calificar" value={stats.sinCalificar} tone="amber" />
        <Kpi label="Promedio" value={stats.promedio ?? '—'} tone="guinda" />
      </div>

      {/* Filtros */}
      <div className="mb-4 rounded-xl border border-stone-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por alumno, CURP, folio o municipio…"
              className="w-full rounded-lg border border-stone-200 py-2 pl-9 pr-3 text-sm focus:border-[var(--color-guinda-500)] focus:outline-none"
            />
          </div>
          <select
            value={String(fEtapa)}
            onChange={(e) => setFEtapa(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="rounded-lg border border-stone-200 bg-white py-2 pl-3 pr-8 text-sm text-stone-700 focus:outline-none"
          >
            <option value="all">Todas las convocatorias</option>
            {etapas.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
          </select>
          <select
            value={String(fModulo)}
            onChange={(e) => setFModulo(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="rounded-lg border border-stone-200 bg-white py-2 pl-3 pr-8 text-sm text-stone-700 focus:outline-none"
          >
            <option value="all">Todos los módulos</option>
            {modulosOpts.map((m) => <option key={m.numero} value={m.numero}>Módulo {m.numero} — {m.nombre}</option>)}
          </select>
          <select
            value={fEstado}
            onChange={(e) => setFEstado(e.target.value as EstadoCalif | 'all')}
            className="rounded-lg border border-stone-200 bg-white py-2 pl-3 pr-8 text-sm text-stone-700 focus:outline-none"
          >
            <option value="all">Todos los estados</option>
            <option value="aprobado">Aprobados</option>
            <option value="reprobado">No aprobados</option>
            <option value="sin_calificar">Sin calificar</option>
            <option value="no_presento">No presentó</option>
          </select>
          {hayFiltros && (
            <button
              onClick={() => { setQ(''); setFEtapa('all'); setFModulo('all'); setFEstado('all'); }}
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
            <Download size={14} /> Exportar ({filtradas.length})
          </button>
        </div>
      </div>

      {/* Tabla */}
      {rows === null ? (
        <div className="rounded-xl border border-stone-200 bg-white p-12 text-center text-stone-500">
          <RefreshCw size={18} className="mx-auto mb-2 animate-spin" /> Cargando…
        </div>
      ) : filtradas.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white p-12 text-center text-sm text-stone-500">
          {rows.length === 0 ? 'Aún no hay exámenes registrados.' : 'Ningún registro coincide con los filtros.'}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-white text-[11px] uppercase tracking-wider text-stone-500">
                  <th className="px-3 py-2.5 text-left font-semibold">Alumno</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Municipio</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Convocatoria</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Módulo</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Folio</th>
                  <th className="px-3 py-2.5 text-center font-semibold">Calif.</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((r, i) => {
                  const est = estadoDe(r);
                  const meta = ESTADO_META[est];
                  return (
                    <tr key={r.inscripcionId} className={`border-b border-stone-100 last:border-0 ${i % 2 ? 'bg-stone-50/40' : 'bg-white'} hover:bg-[var(--color-crema-50)]`}>
                      <td className="px-3 py-2">
                        <Link href={`/admin/alumnos/${r.estudianteId}`} className="font-medium text-stone-900 hover:text-[var(--color-guinda-700)]">
                          {r.alumno ?? '—'}
                        </Link>
                        <div className="font-mono text-[10px] text-stone-400">{r.curp ?? ''}</div>
                      </td>
                      <td className="px-3 py-2 text-xs text-stone-500">{r.municipio ?? '—'}</td>
                      <td className="px-3 py-2 text-xs text-stone-600">{r.etapaClave} · {r.etapaAnio}</td>
                      <td className="px-3 py-2 text-stone-700">
                        <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold" style={{ background: '#f8f4ec', color: 'var(--color-guinda-700)' }}>
                          {r.moduloNumero}
                        </span>
                        <span className="text-xs text-stone-600">{r.moduloNombre}</span>
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-stone-500">{r.folio}</td>
                      <td className="px-3 py-2 text-center">
                        {r.calificacion !== null ? (
                          <span className="inline-block min-w-[2.25rem] rounded-md px-2 py-0.5 font-mono text-sm font-bold" style={{ background: meta.bg, color: meta.color }}>
                            {r.calificacion}
                          </span>
                        ) : (
                          <span className="font-mono text-stone-300">—</span>
                        )}
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
        </div>
      )}
    </>
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
