/**
 * Calificaciones (admin) — carga por la RELACIÓN OFICIAL de la SEP (PDF) + tabla general.
 *
 * Flujo único (así trabaja la coordinación): la Secretaría manda la "Relación de
 * Calificaciones y Aciertos" en PDF. Se sube tal cual → previa con validación por
 * semáforos (cruce por matrícula DGB) → aplicar. El Excel se retiró (no se usa).
 *
 * Incluye también la tabla de TODAS las calificaciones con filtros y export, y
 * enlace a la captura manual (correcciones puntuales).
 */

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import {
  GraduationCap, Download, Search, X, CheckCircle2,
  UploadCloud, Loader2, PencilLine, AlertTriangle, RefreshCw,
  FileText, Bell, ShieldCheck,
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { api, calif10 } from '../../lib/api';

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
  aciertos: number | null;
  matricula: string | null;
  sede: string | null;
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
            Sube la Relación oficial de la SEP y consulta el histórico completo de calificaciones.
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

      <SubidaRelacionPdf onAplicado={cargar} />
      <TablaGeneral rows={rows} />
    </AdminLayout>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Carga de la RELACIÓN OFICIAL de calificaciones (PDF de la SEP)
// Sube el PDF tal cual llega → previa con validación por semáforos → aplicar.
// ═══════════════════════════════════════════════════════════════════════
interface FilaRelacion {
  matricula: string;
  nombrePdf: string;
  modulo: number;
  moduloNombre: string | null;
  calificacionPdf: number;
  calificacion: number;
  aciertos: number;
  aprobado: boolean;
  estudianteId: number | null;
  alumnoSistema: string | null;
  gestorId: number | null;
  calificacionPrevia: number | null;
  estado: 'nueva' | 'reemplazo' | 'sin_matricula' | 'sin_modulo';
}
interface AnalisisRelacion {
  loteRef: string;
  cabecera: { oficina: string | null; sede: string | null; etapa: string | null; fechaAplicacion: string | null; fecha: string | null; fechaExamenISO: string | null };
  resumen: { total: number; nuevas: number; reemplazos: number; sinMatricula: number; sinModulo: number; alumnos: number };
  filas: FilaRelacion[];
}
interface ResultadoRelacion { ok: boolean; aplicadas: number; alumnosNotificados: number; gestoresNotificados: number; etapaClave: string }

const REL_ESTADO: Record<FilaRelacion['estado'], { label: string; bg: string; color: string; dot: string }> = {
  nueva:         { label: 'Nueva',            bg: '#d1fae5', color: '#065f46', dot: '#10b981' },
  reemplazo:     { label: 'Ya existía',       bg: '#fef9c3', color: '#92400e', dot: '#f59e0b' },
  sin_matricula: { label: 'Matrícula no hallada', bg: '#fee2e2', color: '#991b1b', dot: '#ef4444' },
  sin_modulo:    { label: 'Módulo inválido',  bg: '#fee2e2', color: '#991b1b', dot: '#ef4444' },
};

function SubidaRelacionPdf({ onAplicado }: { onAplicado: () => void }) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [fase, setFase] = useState<'idle' | 'analizando' | 'previa' | 'aplicando' | 'hecho'>('idle');
  const [analisis, setAnalisis] = useState<AnalisisRelacion | null>(null);
  const [excluidas, setExcluidas] = useState<Set<string>>(new Set());
  const [reemplazar, setReemplazar] = useState(false);
  const [resultado, setResultado] = useState<ResultadoRelacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const keyFila = (f: FilaRelacion) => `${f.matricula}:${f.modulo}`;

  function elegir(f: File | null) {
    setError(null); setResultado(null); setAnalisis(null); setExcluidas(new Set());
    if (!f) { setArchivo(null); return; }
    if (f.type !== 'application/pdf') { setError('El archivo debe ser un PDF (la Relación oficial de la SEP).'); return; }
    setArchivo(f);
  }

  async function analizar() {
    if (!archivo || fase === 'analizando') return;
    setFase('analizando'); setError(null);
    try {
      const fd = new FormData();
      fd.append('pdf', archivo);
      const r = await api.post<AnalisisRelacion>('/admin/calificaciones/relacion/analizar', fd);
      setAnalisis(r);
      setReemplazar(false);
      setFase('previa');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el PDF');
      setFase('idle');
    }
  }

  function toggleFila(f: FilaRelacion) {
    if (f.estudianteId == null) return; // no aplicables no se togglean
    setExcluidas((prev) => {
      const n = new Set(prev);
      const k = keyFila(f);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  }

  async function aplicar() {
    if (!analisis || fase === 'aplicando') return;
    setFase('aplicando'); setError(null);
    try {
      const excluir = analisis.filas
        .filter((f) => excluidas.has(keyFila(f)))
        .map((f) => ({ matricula: f.matricula, modulo: f.modulo }));
      const r = await api.post<ResultadoRelacion>('/admin/calificaciones/relacion/aplicar', {
        loteRef: analisis.loteRef, reemplazar, excluir,
      });
      setResultado(r);
      setFase('hecho');
      setArchivo(null);
      if (fileRef.current) fileRef.current.value = '';
      onAplicado();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo aplicar');
      setFase('previa');
    }
  }

  function reiniciar() {
    setArchivo(null); setAnalisis(null); setExcluidas(new Set()); setResultado(null);
    setError(null); setFase('idle');
    if (fileRef.current) fileRef.current.value = '';
  }

  // Cuántas se aplicarán con la selección actual.
  const aplicables = analisis?.filas.filter(
    (f) => (f.estado === 'nueva' || (f.estado === 'reemplazo' && reemplazar)) &&
      f.estudianteId != null && !excluidas.has(keyFila(f))
  ).length ?? 0;

  return (
    <div className="mb-6 overflow-hidden rounded-xl border-2 border-[var(--color-guinda-200)] bg-white shadow-sm">
      <div className="flex items-center gap-2 px-5 py-3" style={{ background: 'var(--color-guinda-800)' }}>
        <FileText size={16} className="text-white" />
        <h2 className="text-sm font-semibold text-white">Relación oficial de calificaciones (PDF de la SEP)</h2>
      </div>

      {/* Paso 1: elegir archivo */}
      {fase === 'idle' && (
        <div className="p-5">
          <p className="mb-3 text-sm text-stone-600">
            Sube la <strong>Relación de Calificaciones y Aciertos</strong> tal como llega de la SEP.
            La plataforma la lee, cruza por <strong>matrícula DGB</strong> y te muestra una previa antes de guardar nada.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50">
              <UploadCloud size={16} />
              {archivo ? 'Cambiar PDF' : 'Elegir PDF'}
              <input ref={fileRef} type="file" accept="application/pdf" className="hidden"
                onChange={(e) => elegir(e.target.files?.[0] ?? null)} />
            </label>
            {archivo && <span className="text-sm text-stone-600 truncate max-w-[220px]">{archivo.name}</span>}
            <button onClick={analizar} disabled={!archivo}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-guinda-700)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-guinda-800)] disabled:opacity-40">
              <Search size={15} /> Analizar
            </button>
          </div>
          {error && <p className="mt-3 flex items-center gap-1.5 text-sm text-red-700"><AlertTriangle size={14} /> {error}</p>}
        </div>
      )}

      {/* Analizando */}
      {fase === 'analizando' && (
        <div className="flex items-center justify-center gap-3 p-10 text-stone-500">
          <Loader2 size={20} className="animate-spin" /> Leyendo el PDF y cruzando matrículas…
        </div>
      )}

      {/* Paso 2: previa con validación */}
      {(fase === 'previa' || fase === 'aplicando') && analisis && (
        <div className="p-5">
          {/* Cabecera detectada */}
          <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 rounded-lg bg-stone-50 px-4 py-3 text-sm">
            <span className="text-stone-500">Etapa: <strong className="text-stone-800">{analisis.cabecera.etapa ?? '—'}</strong></span>
            <span className="text-stone-500">Sede: <strong className="text-stone-800">{analisis.cabecera.sede ?? '—'}</strong></span>
            <span className="text-stone-500">Oficina: <strong className="text-stone-800">{analisis.cabecera.oficina ?? '—'}</strong></span>
            <span className="text-stone-500">Aplicación: <strong className="text-stone-800">{analisis.cabecera.fechaAplicacion ?? '—'}</strong></span>
          </div>

          {/* Semáforos */}
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <RelKpi label="Alumnos" value={analisis.resumen.alumnos} tone="neutral" />
            <RelKpi label="Nuevas" value={analisis.resumen.nuevas} tone="green" />
            <RelKpi label="Ya existían" value={analisis.resumen.reemplazos} tone="amber" />
            <RelKpi label="Sin matrícula" value={analisis.resumen.sinMatricula} tone="red" />
            <RelKpi label="Módulo inválido" value={analisis.resumen.sinModulo} tone="red" />
          </div>

          {analisis.resumen.sinMatricula > 0 && (
            <p className="mb-3 flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              {analisis.resumen.sinMatricula} calificación(es) traen una matrícula que no está registrada en la plataforma. Se muestran en rojo y NO se aplicarán (captura primero la matrícula DGB del alumno).
            </p>
          )}

          {/* Tabla de previa */}
          <div className="max-h-[420px] overflow-auto rounded-lg border border-stone-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-stone-100 text-left text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="w-10 px-3 py-2"></th>
                  <th className="px-3 py-2">Matrícula</th>
                  <th className="px-3 py-2">Alumno</th>
                  <th className="px-3 py-2">Módulo</th>
                  <th className="px-3 py-2 text-center">Calif.</th>
                  <th className="px-3 py-2 text-center">Aciertos</th>
                  <th className="px-3 py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {analisis.filas.map((f) => {
                  const meta = REL_ESTADO[f.estado];
                  const aplicable = f.estudianteId != null && (f.estado === 'nueva' || (f.estado === 'reemplazo' && reemplazar));
                  const incluida = aplicable && !excluidas.has(keyFila(f));
                  return (
                    <tr key={keyFila(f)} className={`border-t border-stone-100 ${!aplicable ? 'opacity-60' : ''}`}>
                      <td className="px-3 py-2">
                        <input type="checkbox" disabled={!aplicable} checked={incluida}
                          onChange={() => toggleFila(f)} className="h-4 w-4 accent-[var(--color-guinda-700)]" />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-stone-700">{f.matricula}</td>
                      <td className="px-3 py-2">
                        <div className="text-stone-800">{f.alumnoSistema ?? f.nombrePdf}</div>
                        {f.alumnoSistema && f.alumnoSistema.toUpperCase() !== f.nombrePdf.toUpperCase() && (
                          <div className="text-[11px] text-stone-400">PDF: {f.nombrePdf}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-stone-700">M{f.modulo}{f.moduloNombre ? ` · ${f.moduloNombre}` : ''}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`font-bold ${f.aprobado ? 'text-green-700' : 'text-amber-600'}`}>{f.calificacionPdf}</span>
                        <span className="text-stone-400">/10</span>
                        {f.calificacionPrevia != null && (
                          <div className="text-[11px] text-amber-600">antes: {Math.round(f.calificacionPrevia / 10)}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center text-stone-600">{f.aciertos}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold"
                          style={{ background: meta.bg, color: meta.color }}>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.dot }} /> {meta.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Controles */}
          <div className="mt-4 flex flex-wrap items-center gap-4">
            {analisis.resumen.reemplazos > 0 && (
              <label className="inline-flex items-center gap-2 text-sm text-stone-700">
                <input type="checkbox" checked={reemplazar} onChange={(e) => setReemplazar(e.target.checked)}
                  className="h-4 w-4 accent-[var(--color-guinda-700)]" />
                Reemplazar las {analisis.resumen.reemplazos} calificación(es) que ya existían en esta etapa
              </label>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button onClick={reiniciar} className="rounded-lg border border-stone-200 px-4 py-2.5 text-sm text-stone-600 hover:bg-stone-50">
                Cancelar
              </button>
              <button onClick={aplicar} disabled={aplicables === 0 || fase === 'aplicando'}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-guinda-700)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-guinda-800)] disabled:opacity-40">
                {fase === 'aplicando' ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                Aplicar {aplicables} calificación(es)
              </button>
            </div>
          </div>
          {error && <p className="mt-3 flex items-center gap-1.5 text-sm text-red-700"><AlertTriangle size={14} /> {error}</p>}
        </div>
      )}

      {/* Paso 3: resultado */}
      {fase === 'hecho' && resultado && (
        <div className="p-5">
          <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-4">
            <CheckCircle2 size={22} className="mt-0.5 shrink-0 text-green-600" />
            <div className="text-sm">
              <p className="font-semibold text-green-900">Se aplicaron {resultado.aplicadas} calificaciones de la etapa {resultado.etapaClave}.</p>
              <p className="mt-1 flex items-center gap-1.5 text-green-800">
                <Bell size={14} /> Se notificó a {resultado.alumnosNotificados} alumno(s) y {resultado.gestoresNotificados} gestor(es). Ya pueden verlas en su portal.
              </p>
            </div>
          </div>
          <button onClick={reiniciar} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-stone-200 px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50">
            <UploadCloud size={15} /> Subir otra relación
          </button>
        </div>
      )}
    </div>
  );
}

function RelKpi({ label, value, tone }: { label: string; value: number; tone: 'neutral' | 'green' | 'amber' | 'red' }) {
  const c = {
    neutral: { bg: '#f5f5f4', color: '#44403c' },
    green: { bg: '#d1fae5', color: '#065f46' },
    amber: { bg: '#fef9c3', color: '#92400e' },
    red: { bg: '#fee2e2', color: '#991b1b' },
  }[tone];
  return (
    <div className="rounded-lg px-3 py-2 text-center" style={{ background: c.bg }}>
      <div className="text-lg font-bold" style={{ color: c.color }}>{value}</div>
      <div className="text-[11px] font-medium" style={{ color: c.color }}>{label}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Tabla general (pivote por convocatoria, idéntico a la Relación de la SEP)
// ═══════════════════════════════════════════════════════════════════════
type ModCell = { modulo: number; moduloNombre: string; calif: number | null; aciertos: number | null; estado: string };
type AlumnoPivote = { estudianteId: number; nombre: string; curp: string | null; matricula: string | null; mods: ModCell[] };
type GrupoConvocatoria = { etapaId: number; etapaClave: string; etapaAnio: number; alumnos: AlumnoPivote[]; maxMods: number };

function TablaGeneral({ rows }: { rows: Row[] | null }) {
  const [q, setQ] = useState('');
  const [fEtapa, setFEtapa] = useState<number | 'all'>('all');

  const etapas = useMemo(() => {
    const m = new Map<number, string>();
    (rows ?? []).forEach((r) => m.set(r.etapaId, `${r.etapaClave} · ${r.etapaAnio}`));
    return Array.from(m, ([id, label]) => ({ id, label })).sort((a, b) => b.label.localeCompare(a.label));
  }, [rows]);

  const filtradas = useMemo(() => {
    const query = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => {
      if (fEtapa !== 'all' && r.etapaId !== fEtapa) return false;
      if (query) {
        const hay = `${r.alumno ?? ''} ${r.curp ?? ''} ${r.matricula ?? ''} ${r.folio} ${r.municipio ?? ''}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [rows, q, fEtapa]);

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

  // ── Pivote idéntico a la Relación de la SEP ──────────────────────────────
  // Una convocatoria = una sección. Dentro, UN renglón por alumno (sin repetir
  // nombre) con sus módulos en horizontal como tripletes (Módulo · Cal · Aci).
  const grupos = useMemo(() => {
    const convMap = new Map<number, GrupoConvocatoria>();
    for (const r of filtradas) {
      let g = convMap.get(r.etapaId);
      if (!g) {
        g = { etapaId: r.etapaId, etapaClave: r.etapaClave, etapaAnio: r.etapaAnio, alumnos: [], maxMods: 0 };
        convMap.set(r.etapaId, g);
      }
      let a = g.alumnos.find((x) => x.estudianteId === r.estudianteId);
      if (!a) {
        a = { estudianteId: r.estudianteId, nombre: r.alumno ?? '—', curp: r.curp, matricula: r.matricula, mods: [] };
        g.alumnos.push(a);
      }
      a.mods.push({ modulo: r.moduloNumero, moduloNombre: r.moduloNombre, calif: r.calificacion, aciertos: r.aciertos, estado: r.estadoExamen });
    }
    const arr = Array.from(convMap.values());
    for (const g of arr) {
      for (const a of g.alumnos) a.mods.sort((x, y) => x.modulo - y.modulo);
      g.alumnos.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      g.maxMods = g.alumnos.reduce((mx, a) => Math.max(mx, a.mods.length), 0);
    }
    arr.sort((a, b) => `${b.etapaClave} ${b.etapaAnio}`.localeCompare(`${a.etapaClave} ${a.etapaAnio}`, 'es'));
    return arr;
  }, [filtradas]);

  const hayFiltros = q !== '' || fEtapa !== 'all';

  function exportar() {
    const headers = ['Alumno', 'CURP', 'Matrícula', 'Municipio', 'Convocatoria', 'No. módulo', 'Módulo', 'Folio', 'Sede', 'Calificación', 'Aciertos', 'Estado'];
    const cuerpo = filtradas.map((r) =>
      [
        r.alumno ?? '', r.curp ?? '', r.matricula ?? '', r.municipio ?? '', `${r.etapaClave} · ${r.etapaAnio}`,
        r.moduloNumero, r.moduloNombre, r.folio, r.sede ?? '',
        r.calificacion == null ? '' : r.calificacion / 10, r.aciertos ?? '',
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
        <Kpi label="Promedio" value={stats.promedio != null ? calif10(stats.promedio) : '—'} tone="guinda" />
      </div>

      {/* Filtros */}
      <div className="mb-4 rounded-xl border border-stone-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por alumno, matrícula o CURP…"
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
          {hayFiltros && (
            <button
              onClick={() => { setQ(''); setFEtapa('all'); }}
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

      {/* Leyenda */}
      <p className="mb-3 text-xs text-stone-500">
        Un renglón por alumno; sus módulos en horizontal, tal cual la Relación de la SEP.
        {' '}<strong className="text-stone-700">Mód</strong> = módulo · <strong className="text-stone-700">Cal</strong> = calificación 0–10 (6 aprueba) · <strong className="text-stone-700">Aci</strong> = aciertos · <span className="text-stone-400">—</span> = aún sin registrar.
      </p>

      {/* Relación por convocatoria (idéntica al PDF de la SEP) */}
      {rows === null ? (
        <div className="rounded-xl border border-stone-200 bg-white p-12 text-center text-stone-500">
          <RefreshCw size={18} className="mx-auto mb-2 animate-spin" /> Cargando…
        </div>
      ) : grupos.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white p-12 text-center text-sm text-stone-500">
          {rows.length === 0 ? 'Aún no hay exámenes registrados.' : 'Ningún alumno coincide con la búsqueda.'}
        </div>
      ) : (
        <div className="space-y-6">
          {grupos.map((g) => (
            <div key={g.etapaId}>
              <div className="mb-2 flex items-baseline gap-2">
                <h3 className="font-serif text-lg font-bold text-stone-900">Convocatoria {g.etapaClave}</h3>
                <span className="text-xs text-stone-500">· {g.etapaAnio} · {g.alumnos.length} alumno{g.alumnos.length === 1 ? '' : 's'}</span>
              </div>
              <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="text-sm">
                    <thead>
                      <tr className="border-b-2 border-stone-200 bg-[var(--color-crema-100)] text-[10px] uppercase tracking-wider text-stone-600">
                        <th className="px-2 py-2 text-center font-semibold">Nº</th>
                        <th className="px-3 py-2 text-left font-semibold">Nombre</th>
                        <th className="px-3 py-2 text-left font-semibold">Matrícula</th>
                        {Array.from({ length: g.maxMods }).map((_, i) => (
                          <Fragment key={i}>
                            <th className="border-l border-stone-200 px-2 py-2 text-center font-semibold">Mód</th>
                            <th className="px-2 py-2 text-center font-semibold">Cal</th>
                            <th className="px-2 py-2 text-center font-semibold">Aci</th>
                          </Fragment>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {g.alumnos.map((a, idx) => (
                        <tr key={a.estudianteId} className={`border-b border-stone-100 last:border-0 ${idx % 2 ? 'bg-stone-50/40' : 'bg-white'} hover:bg-[var(--color-crema-50)]`}>
                          <td className="px-2 py-2 text-center text-xs text-stone-400">{idx + 1}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <Link href={`/admin/alumnos/${a.estudianteId}`} className="font-medium text-stone-900 hover:text-[var(--color-guinda-700)]">{a.nombre}</Link>
                            {a.curp && <div className="font-mono text-[10px] text-stone-400">{a.curp}</div>}
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px] text-stone-600 whitespace-nowrap">{a.matricula ?? '—'}</td>
                          {Array.from({ length: g.maxMods }).map((_, i) => {
                            const m = a.mods[i];
                            if (!m) return (
                              <Fragment key={i}>
                                <td className="border-l border-stone-100" />
                                <td />
                                <td />
                              </Fragment>
                            );
                            const est = estadoDe({ calificacion: m.calif, estadoExamen: m.estado });
                            const meta = ESTADO_META[est];
                            return (
                              <Fragment key={i}>
                                <td className="border-l border-stone-100 px-2 py-2 text-center">
                                  <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded px-1 text-[10px] font-bold" style={{ background: '#f8f4ec', color: 'var(--color-guinda-700)' }} title={m.moduloNombre}>{m.modulo}</span>
                                </td>
                                <td className="px-2 py-2 text-center">
                                  {m.calif !== null
                                    ? <span className="font-mono text-sm font-bold" style={{ color: meta.color }}>{calif10(m.calif)}</span>
                                    : <span className="font-mono text-[11px] text-stone-300">—</span>}
                                </td>
                                <td className="px-2 py-2 text-center font-mono text-xs text-stone-600">
                                  {m.aciertos ?? <span className="text-stone-300">—</span>}
                                </td>
                              </Fragment>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
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
