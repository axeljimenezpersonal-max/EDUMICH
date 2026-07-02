import { useEffect, useState, useCallback, useRef } from 'react';
import { useLocation, useSearch } from 'wouter';
import {
  Search, X, ChevronUp, ChevronDown, RefreshCw, Users,
  Eye, UserCheck, MoreHorizontal, ChevronLeft,
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { api } from '../../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────

type Municipio = { id: number; nombre: string };
type GestorItem = { id: number; nombreCompleto: string; iniciales: string; municipioId: number | null; municipioNombre: string | null };
type EtapaItem = { id: number; label: string };

type Alumno = {
  id: number;
  nombreCompleto: string;
  iniciales: string;
  curp: string | null;
  email: string;
  municipio: { id: number; nombre: string } | null;
  gestor: { id: number; nombreCompleto: string; iniciales: string } | null;
  estadoExpediente: 'activo' | 'esperando_matricula' | 'pago_pendiente' | 'en_proceso' | 'rechazado' | 'sin_documentos' | 'inactivo';
  estadoCuenta: 'activa' | 'aviso_enviado' | 'soft_deleted' | 'hard_deleted';
  docsAprobados: number;
  docsTotal: number;
  ultimaActividad: string | null;
  ultimaActividadTexto: string;
  ultimaActividadEn: string | null;
  diasSinActividad: number | null;
  creadoEn: string;
};

type ListaResp = {
  alumnos: Alumno[];
  total: number;
  page: number;
  totalPages: number;
  resumen: { totalAlumnos: number; expedienteCompleto: number; pendientes: number; egresados: number };
  filtrosAplicados: { desdeDigitalDashboard: boolean; descripcionFiltro?: string };
};

// ─── Constants ────────────────────────────────────────────────────────────

const FILTRO_DESC: Record<string, string> = {
  docs_en_revision: 'Documentos en revisión',
  docs_rechazados: 'Documentos rechazados',
  pagos_pendientes: 'Pagos pendientes',
  calif_pendientes: 'Calificaciones por capturar',
  expediente_completo: 'Expediente completo',
  expediente_incompleto: 'Expediente incompleto',
};

const ESTADO_CONFIG: Record<string, { label: string; dot: string; bg: string; color: string }> = {
  activo:              { label: 'Activo',                dot: '#2d7d46', bg: '#d1fae5', color: '#2d7d46' },
  esperando_matricula: { label: 'Esperando matrícula',   dot: '#1d4ed8', bg: '#dbeafe', color: '#1d4ed8' },
  pago_pendiente:      { label: 'Pago pendiente',        dot: '#b45309', bg: '#fff7ed', color: '#b45309' },
  en_proceso:          { label: 'En proceso',            dot: '#92400e', bg: '#fef9c3', color: '#92400e' },
  rechazado:           { label: 'Doc. rechazado',        dot: '#b91c1c', bg: '#fee2e2', color: '#b91c1c' },
  sin_documentos:      { label: 'Sin documentos',        dot: '#6b635e', bg: '#f7f2ed', color: '#6b635e' },
  inactivo:            { label: 'Inactivo',              dot: '#6b635e', bg: '#f7f2ed', color: '#6b635e' },
};

const ESTADO_CUENTA_OPTIONS = [
  { value: '', label: 'Cuenta' },
  { value: 'activa', label: 'Solo activas' },
  { value: 'aviso_enviado', label: 'En aviso (riesgo)' },
  { value: 'soft_deleted', label: 'En soft delete' },
];

function actividadBadge(diasSinActividad: number | null, ultimaActividadEn: string | null) {
  if (!ultimaActividadEn && diasSinActividad === null) {
    return { label: 'Sin actividad', bg: '#eadfd7', color: '#6b635e' };
  }
  const dias = diasSinActividad ?? 0;
  if (dias < 7) return { label: `Hace ${dias}d`, bg: '#d1fae5', color: '#065f46' };
  if (dias < 20) return { label: `Hace ${dias}d`, bg: '#fef9c3', color: '#92400e' };
  if (dias < 25) return { label: `Hace ${dias}d`, bg: '#fed7aa', color: '#c2410c' };
  return { label: `Hace ${dias}d`, bg: '#fee2e2', color: '#991b1b' };
}

const ESTADO_OPTIONS = [
  { value: '', label: 'Estado' },
  { value: 'activo', label: 'Activo' },
  { value: 'esperando_matricula', label: 'Esperando matrícula' },
  { value: 'pago_pendiente', label: 'Pago pendiente' },
  { value: 'en_proceso', label: 'En proceso' },
  { value: 'rechazado', label: 'Doc. rechazado' },
  { value: 'sin_documentos', label: 'Sin documentos' },
  { value: 'inactivo', label: 'Inactivo' },
];

// ─── Debounce hook ────────────────────────────────────────────────────────

function useDebounce<T>(value: T, ms: number): T {
  const [dv, setDv] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDv(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return dv;
}

// ─── AsignarGestorModal ───────────────────────────────────────────────────

function AsignarGestorModal({
  alumnoId,
  alumnoNombre,
  municipioId,
  gestores,
  onClose,
  onSaved,
}: {
  alumnoId: number;
  alumnoNombre: string;
  municipioId: number | null;
  gestores: GestorItem[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [gestorId, setGestorId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = municipioId
    ? gestores.filter((g) => g.municipioId === municipioId || !g.municipioId)
    : gestores;

  async function handleSave() {
    const id = gestorId ? parseInt(gestorId) : null;
    setSaving(true);
    setError(null);
    try {
      await api.post(`/admin/alumnos/${alumnoId}/asignar-gestor`, { gestorId: id });
      onSaved();
    } catch {
      setError('Error al guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.35)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-widest mb-0.5" style={{ color: 'var(--color-guinda-700)' }}>
              Asignar gestor
            </div>
            <h2 className="text-lg font-bold" style={{ color: '#2a2a2a', fontFamily: "'Poppins', sans-serif" }}>
              {alumnoNombre}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-100 transition-colors">
            <X size={16} style={{ color: '#6b635e' }} />
          </button>
        </div>

        <label className="block text-sm font-semibold mb-1.5" style={{ color: '#443e39' }}>
          Gestor municipal
        </label>
        <select
          className="w-full px-3 py-2 text-sm rounded-lg border border-stone-200 focus:outline-none focus:border-stone-400 bg-white mb-1.5"
          value={gestorId}
          onChange={(e) => setGestorId(e.target.value)}
        >
          <option value="">— Sin gestor asignado —</option>
          {options.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nombreCompleto}{g.municipioNombre ? ` · ${g.municipioNombre}` : ''}
            </option>
          ))}
        </select>
        {municipioId && (
          <p className="text-[11px] mb-4" style={{ color: '#6b635e' }}>
            Mostrando gestores del municipio del alumno primero.
          </p>
        )}

        {error && <p className="text-xs font-medium mb-3" style={{ color: '#b91c1c' }}>{error}</p>}

        <div className="flex items-center gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold rounded-lg border border-stone-200 bg-white hover:bg-stone-50 transition-colors"
            style={{ color: '#443e39' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition-opacity"
            style={{ background: 'var(--color-guinda-700)' }}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Stats card ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl px-5 py-4 flex-1 min-w-0">
      <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#6b635e' }}>
        {label}
      </div>
      <div className="text-2xl font-bold" style={{ fontFamily: "'Poppins', sans-serif", color: '#2a2a2a' }}>
        {typeof value === 'number' ? value.toLocaleString('es-MX') : value}
      </div>
      {sub && <div className="text-[11px] mt-0.5" style={{ color: '#a89a8e' }}>{sub}</div>}
    </div>
  );
}

// ─── Sort header ──────────────────────────────────────────────────────────

function SortTh({
  label, col, sortBy, sortDir, onSort,
}: {
  label: string; col: string; sortBy: string; sortDir: 'asc' | 'desc'; onSort: (col: string) => void;
}) {
  const active = sortBy === col;
  return (
    <button
      onClick={() => onSort(col)}
      className="flex items-center gap-0.5 text-[11px] font-semibold uppercase tracking-wide hover:opacity-70 transition-opacity"
      style={{ color: active ? 'var(--color-guinda-700)' : '#6b635e', background: 'none', border: 'none', cursor: 'pointer' }}
    >
      {label}
      {active ? (
        sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />
      ) : (
        <ChevronDown size={11} style={{ opacity: 0.3 }} />
      )}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────

export default function AlumnosLista() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const filtroPreset = params.get('filtro') ?? '';

  // Filters
  const [searchInput, setSearchInput] = useState('');
  const [municipioId, setMunicipioId] = useState('');
  const [estadoExp, setEstadoExp] = useState('');
  const [estadoCuenta, setEstadoCuenta] = useState('');
  const [gestorId, setGestorId] = useState('');
  const [etapaId, setEtapaId] = useState('');
  const debouncedSearch = useDebounce(searchInput, 300);

  // Sort
  const [sortBy, setSortBy] = useState('registro');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Data
  const [data, setData] = useState<ListaResp | null>(null);
  const [loading, setLoading] = useState(true);

  // Dropdowns
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [gestores, setGestores] = useState<GestorItem[]>([]);
  const [etapas, setEtapas] = useState<EtapaItem[]>([]);

  // Row actions
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Modal
  const [modalAlumno, setModalAlumno] = useState<Alumno | null>(null);

  // Load filter options once
  useEffect(() => {
    Promise.all([
      api.get<{ municipios: Municipio[] }>('/admin/municipios').catch(() => ({ municipios: [] })),
      api.get<{ gestores: GestorItem[] }>('/admin/gestores-list').catch(() => ({ gestores: [] })),
      api.get<{ etapas: EtapaItem[] }>('/admin/etapas').catch(() => ({ etapas: [] })),
    ]).then(([m, g, e]) => {
      setMunicipios(m.municipios);
      setGestores(g.gestores);
      setEtapas(e.etapas);
    });
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qp = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (filtroPreset) qp.set('filtro', filtroPreset);
      if (debouncedSearch) qp.set('search', debouncedSearch);
      if (municipioId) qp.set('municipioId', municipioId);
      if (estadoExp) qp.set('estadoExpediente', estadoExp);
      if (estadoCuenta) qp.set('estadoCuenta', estadoCuenta);
      if (gestorId) qp.set('gestorId', gestorId);
      if (etapaId) qp.set('etapaId', etapaId);
      if (sortBy !== 'registro') qp.set('sortBy', sortBy);
      if (sortDir !== 'desc') qp.set('sortDir', sortDir);
      const resp = await api.get<ListaResp>(`/admin/alumnos?${qp.toString()}`);
      setData(resp);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [filtroPreset, debouncedSearch, municipioId, estadoExp, estadoCuenta, gestorId, etapaId, sortBy, sortDir, page, limit]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [filtroPreset, debouncedSearch, municipioId, estadoExp, estadoCuenta, gestorId, etapaId, sortBy, sortDir, limit]);

  useEffect(() => { load(); }, [load]);

  function handleSort(col: string) {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
  }

  function clearAllFilters() {
    setSearchInput('');
    setMunicipioId('');
    setEstadoExp('');
    setEstadoCuenta('');
    setGestorId('');
    setEtapaId('');
    if (filtroPreset) setLocation('/admin/alumnos');
  }

  const hasManualFilters = !!(searchInput || municipioId || estadoExp || estadoCuenta || gestorId || etapaId);
  const hasAnyFilter = !!(filtroPreset || hasManualFilters);

  const municipioLabel = municipioId ? municipios.find((m) => m.id === Number(municipioId))?.nombre : '';
  const gestorLabel = gestorId === 'sin_gestor'
    ? 'Sin gestor'
    : gestorId ? gestores.find((g) => g.id === Number(gestorId))?.nombreCompleto ?? '' : '';
  const etapaLabel = etapaId === 'sin_inscripcion'
    ? 'Sin inscripción'
    : etapaId ? etapas.find((e) => e.id === Number(etapaId))?.label ?? '' : '';

  const resumen = data?.resumen;

  return (
    <AdminLayout>
      {/* Modal */}
      {modalAlumno && (
        <AsignarGestorModal
          alumnoId={modalAlumno.id}
          alumnoNombre={modalAlumno.nombreCompleto}
          municipioId={modalAlumno.municipio?.id ?? null}
          gestores={gestores}
          onClose={() => setModalAlumno(null)}
          onSaved={() => { setModalAlumno(null); load(); }}
        />
      )}

      {/* Header */}
      <div className="mb-5">
        {filtroPreset && (
          <button
            onClick={() => setLocation('/admin')}
            className="flex items-center gap-1 text-xs mb-3 hover:opacity-70 transition-opacity"
            style={{ color: 'var(--color-guinda-700)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <ChevronLeft size={13} /> Volver al inicio
          </button>
        )}
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase mb-1.5" style={{ color: 'var(--color-guinda-700)', letterSpacing: '0.15em' }}>
          <Users size={12} /> PERSONAS · ALUMNOS
        </div>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Poppins', sans-serif", color: '#2a2a2a' }}>
            Alumnos
            {data && (
              <span className="ml-2 text-base font-normal" style={{ color: '#6b635e' }}>
                ({data.total.toLocaleString('es-MX')})
              </span>
            )}
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="p-2 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 transition-colors"
              title="Recargar"
            >
              <RefreshCw size={14} style={{ color: '#6b635e' }} />
            </button>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      {resumen && (
        <div className="flex gap-3 mb-5 flex-wrap">
          <StatCard label="Total alumnos" value={resumen.totalAlumnos} />
          <StatCard label="Expediente completo" value={resumen.expedienteCompleto} sub={`${resumen.totalAlumnos > 0 ? Math.round(resumen.expedienteCompleto / resumen.totalAlumnos * 100) : 0}% del total`} />
          <StatCard label="Pendientes" value={resumen.pendientes} sub="Con docs por completar" />
          <StatCard label="Egresados" value={resumen.egresados} sub="21 módulos aprobados" />
        </div>
      )}

      {/* Active filter chips */}
      {hasAnyFilter && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {filtroPreset && (
            <span
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
              Desde tareas: {data?.filtrosAplicados?.descripcionFiltro ?? FILTRO_DESC[filtroPreset] ?? filtroPreset}
              <button onClick={() => setLocation('/admin/alumnos')} className="ml-0.5 hover:opacity-70 transition-opacity" title="Quitar">
                <X size={12} />
              </button>
            </span>
          )}
          {municipioLabel && (
            <Chip label={`Municipio: ${municipioLabel}`} onRemove={() => setMunicipioId('')} />
          )}
          {estadoExp && (
            <Chip label={`Estado: ${ESTADO_CONFIG[estadoExp]?.label ?? estadoExp}`} onRemove={() => setEstadoExp('')} />
          )}
          {gestorLabel && (
            <Chip label={`Gestor: ${gestorLabel}`} onRemove={() => setGestorId('')} />
          )}
          {etapaLabel && (
            <Chip label={`Etapa: ${etapaLabel}`} onRemove={() => setEtapaId('')} />
          )}
          {searchInput && (
            <Chip label={`"${searchInput}"`} onRemove={() => setSearchInput('')} />
          )}
          {hasAnyFilter && (
            <button
              onClick={clearAllFilters}
              className="text-[11px] font-semibold hover:opacity-70 transition-opacity px-2 py-1 rounded-lg"
              style={{ color: 'var(--color-guinda-700)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Limpiar todo
            </button>
          )}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-1.5 mb-4 overflow-x-auto">
        {/* Search */}
        <div className="relative flex-shrink-0">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: '#6b635e' }} />
          <input
            className="pl-8 pr-8 py-1.5 text-sm rounded-lg border border-stone-200 focus:outline-none focus:border-stone-400 w-44"
            style={{ background: '#f8f4ec' }}
            placeholder="Nombre, CURP…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          {searchInput && (
            <button className="absolute right-2.5 top-1/2 -translate-y-1/2" onClick={() => setSearchInput('')}>
              <X size={12} style={{ color: '#6b635e' }} />
            </button>
          )}
        </div>

        {/* Municipio */}
        <select
          className="px-2.5 py-1.5 text-sm rounded-lg border border-stone-200 focus:outline-none focus:border-stone-400 bg-white flex-shrink-0"
          style={{ maxWidth: 130 }}
          value={municipioId}
          onChange={(e) => setMunicipioId(e.target.value)}
        >
          <option value="">Municipio</option>
          {municipios.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
        </select>

        {/* Estado expediente */}
        <select
          className="px-2.5 py-1.5 text-sm rounded-lg border border-stone-200 focus:outline-none focus:border-stone-400 bg-white flex-shrink-0"
          style={{ maxWidth: 130 }}
          value={estadoExp}
          onChange={(e) => setEstadoExp(e.target.value)}
        >
          {ESTADO_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {/* Estado de cuenta */}
        <select
          className="px-2.5 py-1.5 text-sm rounded-lg border border-stone-200 focus:outline-none focus:border-stone-400 bg-white flex-shrink-0"
          style={{ maxWidth: 120 }}
          value={estadoCuenta}
          onChange={(e) => setEstadoCuenta(e.target.value)}
        >
          {ESTADO_CUENTA_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {/* Gestor */}
        <select
          className="px-2.5 py-1.5 text-sm rounded-lg border border-stone-200 focus:outline-none focus:border-stone-400 bg-white flex-shrink-0"
          style={{ maxWidth: 130 }}
          value={gestorId}
          onChange={(e) => setGestorId(e.target.value)}
        >
          <option value="">Gestor</option>
          <option value="sin_gestor">Sin gestor</option>
          {gestores.map((g) => <option key={g.id} value={g.id}>{g.nombreCompleto}</option>)}
        </select>

        {/* Etapa */}
        {etapas.length > 0 && (
          <select
            className="px-2.5 py-1.5 text-sm rounded-lg border border-stone-200 focus:outline-none focus:border-stone-400 bg-white flex-shrink-0"
            style={{ maxWidth: 150 }}
            value={etapaId}
            onChange={(e) => setEtapaId(e.target.value)}
          >
            <option value="">Etapa</option>
            <option value="sin_inscripcion">Sin inscripción</option>
            {etapas.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
          </select>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-20 text-center text-sm" style={{ color: '#6b635e' }}>Cargando alumnos…</div>
      ) : !data || data.alumnos.length === 0 ? (
        <EmptyState hasFilters={hasAnyFilter} onClear={clearAllFilters} />
      ) : (
        <>
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
            {/* Table header */}
            <div
              className="grid px-5 py-3 border-b border-stone-100"
              style={{ gridTemplateColumns: '44px 1fr 150px 180px 130px 110px 90px 80px', gap: 10, background: '#fafaf9' }}
            >
              <div />
              <SortTh label="Alumno"      col="nombre"   sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortTh label="Municipio"   col="municipio" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortTh label="Gestor"      col="gestor"   sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortTh label="Expediente"  col="estado"   sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortTh label="Actividad"   col="actividad" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortTh label="Registro"    col="registro" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <div />
            </div>

            {/* Rows */}
            <div ref={dropdownRef}>
              {data.alumnos.map((alumno) => (
                <AlumnoRow
                  key={alumno.id}
                  alumno={alumno}
                  dropdownOpen={openDropdown === alumno.id}
                  onToggleDropdown={() => setOpenDropdown((prev) => prev === alumno.id ? null : alumno.id)}
                  onViewDetail={() => setLocation(`/admin/alumnos/${alumno.id}`)}
                  onAsignarGestor={() => { setModalAlumno(alumno); setOpenDropdown(null); }}
                />
              ))}
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
            <div className="flex items-center gap-3 text-sm">
              <span style={{ color: '#6b635e' }}>
                Página {data.page} de {data.totalPages} · {data.total.toLocaleString('es-MX')} alumnos
              </span>
              <select
                className="text-xs px-2 py-1.5 rounded-lg border border-stone-200 bg-white focus:outline-none"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
              >
                <option value={20}>20 por página</option>
                <option value={50}>50 por página</option>
                <option value={100}>100 por página</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <PaginationButton label="←" disabled={page <= 1} onClick={() => setPage(1)} title="Primera" />
              <PaginationButton label="‹" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} title="Anterior" />
              {buildPageRange(page, data.totalPages).map((p, i) =>
                p === '…' ? (
                  <span key={`e${i}`} className="px-2 text-xs" style={{ color: '#a89a8e' }}>…</span>
                ) : (
                  <PaginationButton
                    key={p}
                    label={String(p)}
                    disabled={p === page}
                    active={p === page}
                    onClick={() => setPage(Number(p))}
                    title={`Página ${p}`}
                  />
                )
              )}
              <PaginationButton label="›" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)} title="Siguiente" />
              <PaginationButton label="→" disabled={page >= data.totalPages} onClick={() => setPage(data.totalPages)} title="Última" />
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
}

// ─── AlumnoRow ────────────────────────────────────────────────────────────

function AlumnoRow({
  alumno, dropdownOpen, onToggleDropdown, onViewDetail, onAsignarGestor,
}: {
  alumno: Alumno;
  dropdownOpen: boolean;
  onToggleDropdown: () => void;
  onViewDetail: () => void;
  onAsignarGestor: () => void;
}) {
  const est = ESTADO_CONFIG[alumno.estadoExpediente] ?? ESTADO_CONFIG.sin_documentos;
  const docsWidth = alumno.docsTotal > 0 ? (alumno.docsAprobados / alumno.docsTotal) * 100 : 0;

  const fechaReg = new Date(alumno.creadoEn).toLocaleDateString('es-MX', {
    day: 'numeric', month: 'short', year: '2-digit',
  });

  return (
    <div
      className="group grid items-center px-5 py-3 border-b border-stone-50 last:border-b-0 hover:bg-stone-50 transition-colors cursor-pointer relative"
      style={{ gridTemplateColumns: '44px 1fr 150px 180px 130px 110px 90px 80px', gap: 10 }}
      onClick={onViewDetail}
    >
      {/* Avatar */}
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0"
        style={{
          fontFamily: "'Poppins', sans-serif",
          background: alumno.gestor ? '#dbeafe' : '#efe7d6',
          color: alumno.gestor ? '#1e40af' : 'var(--color-guinda-700)',
        }}
      >
        {alumno.iniciales}
      </div>

      {/* Nombre + CURP */}
      <div className="min-w-0">
        <div className="text-sm font-semibold truncate" style={{ fontFamily: "'Poppins', sans-serif", color: '#2a2a2a' }}>
          {alumno.nombreCompleto}
        </div>
        <div className="text-[11px] truncate" style={{ color: '#6b635e' }}>
          {alumno.curp ?? alumno.email}
        </div>
      </div>

      {/* Municipio */}
      <div>
        {alumno.municipio ? (
          <span className="text-[11px] font-medium px-2.5 py-1 rounded-full truncate block max-w-full" style={{ background: '#f8f4ec', color: '#443e39' }}>
            {alumno.municipio.nombre}
          </span>
        ) : (
          <span className="text-[11px]" style={{ color: '#a89a8e' }}>—</span>
        )}
      </div>

      {/* Gestor */}
      <div className="min-w-0">
        {alumno.gestor ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
              style={{ background: '#dbeafe', color: '#1e40af' }}
            >
              {alumno.gestor.iniciales}
            </div>
            <span className="text-[12px] truncate" style={{ color: '#443e39' }}>
              {alumno.gestor.nombreCompleto}
            </span>
          </div>
        ) : (
          <span className="text-[11px]" style={{ color: '#a89a8e' }}>Sin gestor</span>
        )}
      </div>

      {/* Expediente */}
      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: est.dot }} />
          <span
            className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
            style={{ background: est.bg, color: est.color }}
          >
            {est.label}
          </span>
        </div>
        {alumno.docsAprobados > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: '#eadfd7', maxWidth: 60 }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${docsWidth}%`, background: docsWidth >= 100 ? '#2d7d46' : 'var(--color-guinda-700)' }}
              />
            </div>
            <span className="text-[10px]" style={{ color: '#6b635e' }}>{alumno.docsAprobados}/{alumno.docsTotal}</span>
          </div>
        )}
      </div>

      {/* Última actividad (docs/pagos) */}
      <div>
        {(() => {
          const badge = actividadBadge(alumno.diasSinActividad, alumno.ultimaActividadEn);
          return (
            <span style={{
              background: badge.bg, color: badge.color,
              padding: '2px 7px', borderRadius: 6, fontSize: 11, fontWeight: 600,
            }}>
              {badge.label}
            </span>
          );
        })()}
        {alumno.estadoCuenta === 'aviso_enviado' && (
          <div style={{ marginTop: 3, fontSize: 10, color: '#dc2626', fontWeight: 700 }}>
            ⚠ AVISO ENVIADO
          </div>
        )}
      </div>

      {/* Registro */}
      <div className="text-[11px]" style={{ color: '#6b635e' }}>
        {fechaReg}
      </div>

      {/* Actions */}
      <div
        className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <ActionBtn title="Ver detalle" onClick={onViewDetail}>
          <Eye size={13} />
        </ActionBtn>
        <ActionBtn title="Asignar gestor" onClick={onAsignarGestor}>
          <UserCheck size={13} />
        </ActionBtn>
        <div className="relative">
          <ActionBtn title="Más opciones" onClick={onToggleDropdown}>
            <MoreHorizontal size={13} />
          </ActionBtn>
          {dropdownOpen && (
            <RowDropdown alumno={alumno} onViewDetail={onViewDetail} onAsignarGestor={onAsignarGestor} />
          )}
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="p-1.5 rounded-lg hover:bg-stone-200 transition-colors"
      style={{ color: '#6b635e', background: 'none', border: 'none', cursor: 'pointer' }}
    >
      {children}
    </button>
  );
}

function RowDropdown({
  alumno, onViewDetail, onAsignarGestor,
}: {
  alumno: Alumno;
  onViewDetail: () => void;
  onAsignarGestor: () => void;
}) {
  return (
    <div
      className="absolute right-0 top-full mt-1 z-20 bg-white border border-stone-200 rounded-xl shadow-lg py-1 w-48"
      style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.10)' }}
    >
      <DropItem onClick={onViewDetail} icon={<Eye size={13} />} label="Ver detalle" />
      <DropItem onClick={onAsignarGestor} icon={<UserCheck size={13} />} label={alumno.gestor ? 'Reasignar gestor' : 'Asignar gestor'} />
      {alumno.gestor && (
        <>
          <div className="my-1 border-t border-stone-100" />
          <DropItem
            onClick={() => { /* noop — gesture to remove gestor could be wired */ onAsignarGestor(); }}
            icon={<X size={13} />}
            label="Quitar gestor"
            danger
          />
        </>
      )}
    </div>
  );
}

function DropItem({
  onClick, icon, label, danger,
}: {
  onClick: () => void; icon: React.ReactNode; label: string; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-stone-50 transition-colors text-left"
      style={{ color: danger ? '#b91c1c' : '#443e39', background: 'none', border: 'none', cursor: 'pointer' }}
    >
      {icon} {label}
    </button>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
      style={{ background: '#fbe6ea', color: 'var(--color-guinda-700)' }}
    >
      {label}
      <button onClick={onRemove} className="hover:opacity-70 transition-opacity">
        <X size={12} />
      </button>
    </span>
  );
}

function EmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-20 rounded-xl border-2"
      style={{ borderColor: '#eadfd7', borderStyle: 'dashed', color: '#6b635e' }}
    >
      <Users size={32} style={{ color: '#ddd0c5', marginBottom: 12 }} />
      <p className="text-sm font-semibold mb-1" style={{ color: '#443e39' }}>
        {hasFilters ? 'Ningún alumno coincide con los filtros' : 'No hay alumnos registrados aún'}
      </p>
      {hasFilters && (
        <button
          onClick={onClear}
          className="mt-3 text-xs font-semibold px-4 py-2 rounded-lg"
          style={{ background: '#fbe6ea', color: 'var(--color-guinda-700)', border: 'none', cursor: 'pointer' }}
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}

function PaginationButton({
  label, disabled, active, onClick, title,
}: {
  label: string; disabled: boolean; active?: boolean; onClick: () => void; title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-40"
      style={{
        background: active ? 'var(--color-guinda-700)' : 'white',
        color: active ? 'white' : '#443e39',
        borderColor: active ? 'var(--color-guinda-700)' : '#eadfd7',
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function buildPageRange(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '…')[] = [1];
  if (current > 3) pages.push('…');
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
  if (current < total - 2) pages.push('…');
  pages.push(total);
  return pages;
}
