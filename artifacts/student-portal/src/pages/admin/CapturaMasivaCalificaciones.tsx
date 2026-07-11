import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { GraduationCap, ChevronLeft, Save, AlertCircle, Search, X, Filter } from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { api } from '../../lib/api';

type EtapaPendiente = { id: number; clave: string; label: string; pendientes: number };
type Inscripcion = {
  id: number;
  folio: string;
  alumnoNombre: string;
  moduloNombre: string;
  moduloNumero: number;
  fechaExamen: string;
  sedeNombre: string;
  estado: string;
  calificacion: number | null;
};

type EntradaCalif = {
  calificacion: string;
  noPresento: boolean;
};

export default function CapturaMasivaCalificaciones() {
  const [, setLocation] = useLocation();

  const [etapas, setEtapas] = useState<EtapaPendiente[]>([]);
  const [etapaId, setEtapaId] = useState<number | ''>('');
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([]);
  const [entradas, setEntradas] = useState<Record<number, EntradaCalif>>({});

  const [loadingEtapas, setLoadingEtapas] = useState(true);
  const [loadingInsc, setLoadingInsc] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filtros (cliente) para acotar cuando hay muchos alumnos.
  const [q, setQ] = useState('');
  const [fModulo, setFModulo] = useState<number | 'all'>('all');
  const [fFecha, setFFecha] = useState<string>('all');
  const [fSede, setFSede] = useState<string>('all');

  useEffect(() => {
    api.get<{ etapas: EtapaPendiente[] }>('/admin/calificaciones/etapas-pendientes')
      .then((r) => {
        setEtapas(r.etapas);
        if (r.etapas.length === 1) setEtapaId(r.etapas[0].id);
      })
      .catch(() => {})
      .finally(() => setLoadingEtapas(false));
  }, []);

  useEffect(() => {
    setQ(''); setFModulo('all'); setFFecha('all'); setFSede('all');
    if (!etapaId) { setInscripciones([]); setEntradas({}); return; }
    setLoadingInsc(true);
    api.get<{ inscripciones: Inscripcion[] }>(`/admin/calificaciones/batch-list?etapaId=${etapaId}`)
      .then((r) => {
        setInscripciones(r.inscripciones);
        const initial: Record<number, EntradaCalif> = {};
        for (const ins of r.inscripciones) {
          // El input es escala SEP (0–10); internamente se guarda en 0–100.
          initial[ins.id] = { calificacion: ins.calificacion !== null ? String(ins.calificacion / 10) : '', noPresento: false };
        }
        setEntradas(initial);
      })
      .catch(() => setInscripciones([]))
      .finally(() => setLoadingInsc(false));
  }, [etapaId]);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleGuardar() {
    setError(null);
    const payload = Object.entries(entradas)
      .map(([id, entrada]) => {
        const inscripcionId = Number(id);
        if (entrada.noPresento) return { inscripcionId, noPresento: true };
        const val = entrada.calificacion.trim();
        if (!val) return null;
        const n = parseFloat(val);
        if (isNaN(n) || n < 0 || n > 10) return null;
        // Escala SEP (0–10) → interno (0–100).
        return { inscripcionId, calificacion: Math.round(n * 10) };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (payload.length === 0) {
      setError('No hay calificaciones para guardar. Ingresa al menos una.');
      return;
    }

    setSaving(true);
    try {
      const r = await api.post<{ ok: boolean; procesadas: number }>('/admin/calificaciones/batch', {
        calificaciones: payload,
      });
      showToast(`${r.procesadas} calificaciones guardadas correctamente`, true);
      // Reload
      if (etapaId) {
        const fresh = await api.get<{ inscripciones: Inscripcion[] }>(`/admin/calificaciones/batch-list?etapaId=${etapaId}`);
        setInscripciones(fresh.inscripciones);
        const initial: Record<number, EntradaCalif> = {};
        for (const ins of fresh.inscripciones) {
          initial[ins.id] = { calificacion: '', noPresento: false };
        }
        setEntradas(initial);
      }
    } catch (e) {
      showToast('Error al guardar. Intenta de nuevo.', false);
    } finally {
      setSaving(false);
    }
  }

  function setCalif(id: number, val: string) {
    setEntradas((prev) => ({ ...prev, [id]: { ...prev[id], calificacion: val, noPresento: false } }));
  }

  function toggleNoPresento(id: number) {
    setEntradas((prev) => ({
      ...prev,
      [id]: { calificacion: '', noPresento: !prev[id]?.noPresento },
    }));
  }

  const totalCapturadas = Object.values(entradas).filter(
    (e) => e.noPresento || (e.calificacion.trim() !== '' && !isNaN(parseFloat(e.calificacion)))
  ).length;

  // Opciones de filtro derivadas de las inscripciones cargadas.
  const modulosOpts = useMemo(() => {
    const m = new Map<number, string>();
    inscripciones.forEach((i) => m.set(i.moduloNumero, i.moduloNombre));
    return Array.from(m, ([numero, nombre]) => ({ numero, nombre })).sort((a, b) => a.numero - b.numero);
  }, [inscripciones]);
  const fechasOpts = useMemo(
    () => Array.from(new Set(inscripciones.map((i) => i.fechaExamen))).sort(),
    [inscripciones]
  );
  const sedesOpts = useMemo(
    () => Array.from(new Set(inscripciones.map((i) => i.sedeNombre))).sort((a, b) => a.localeCompare(b)),
    [inscripciones]
  );

  const inscripcionesFiltradas = useMemo(() => {
    const query = q.trim().toLowerCase();
    return inscripciones.filter((i) => {
      if (fModulo !== 'all' && i.moduloNumero !== fModulo) return false;
      if (fFecha !== 'all' && i.fechaExamen !== fFecha) return false;
      if (fSede !== 'all' && i.sedeNombre !== fSede) return false;
      if (query && !`${i.alumnoNombre} ${i.folio}`.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [inscripciones, q, fModulo, fFecha, fSede]);

  const hayFiltros = q !== '' || fModulo !== 'all' || fFecha !== 'all' || fSede !== 'all';
  function limpiarFiltros() { setQ(''); setFModulo('all'); setFFecha('all'); setFSede('all'); }

  return (
    <AdminLayout>
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-lg flex items-center gap-2"
          style={{
            background: toast.ok ? '#d1fae5' : '#fee2e2',
            color: toast.ok ? '#2d7d46' : '#b91c1c',
            border: `1px solid ${toast.ok ? '#a7f3d0' : '#fca5a5'}`,
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => setLocation('/admin/calificaciones')}
          className="flex items-center gap-1.5 text-xs mb-3 hover:opacity-70 transition-opacity"
          style={{ color: 'var(--color-guinda-700)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <ChevronLeft size={14} /> Volver a Calificaciones
        </button>
        <div
          className="flex items-center gap-1.5 text-[11px] font-semibold uppercase mb-1.5"
          style={{ color: 'var(--color-guinda-700)', letterSpacing: '0.15em' }}
        >
          <GraduationCap size={12} /> CAPTURA MASIVA
        </div>
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ fontFamily: "'Poppins', sans-serif", color: '#2a2a2a' }}
        >
          Captura masiva de calificaciones
        </h1>
        <p className="text-sm mt-1" style={{ color: '#6b635e' }}>
          Selecciona una etapa y teclea las calificaciones para todos los alumnos que presentaron examen.
        </p>
      </div>

      {/* Selector de etapa */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 mb-6">
        <label className="block text-sm font-semibold mb-2" style={{ color: '#443e39' }}>
          Etapa de examen con calificaciones pendientes
        </label>
        {loadingEtapas ? (
          <div className="text-sm" style={{ color: '#6b635e' }}>Cargando etapas…</div>
        ) : etapas.length === 0 ? (
          <div className="text-sm" style={{ color: '#6b635e' }}>No hay etapas con calificaciones pendientes.</div>
        ) : (
          <select
            className="w-full max-w-lg px-3 py-2 text-sm rounded-lg border border-stone-200 focus:outline-none focus:border-stone-400 bg-white"
            value={etapaId}
            onChange={(e) => setEtapaId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">— Selecciona una etapa —</option>
            {etapas.map((e) => (
              <option key={e.id} value={e.id}>{e.label}</option>
            ))}
          </select>
        )}
      </div>

      {/* Tabla de inscripciones */}
      {etapaId && (
        <>
          {loadingInsc ? (
            <div className="py-12 text-center text-sm" style={{ color: '#6b635e' }}>Cargando inscripciones…</div>
          ) : inscripciones.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-xl py-12 text-center text-sm" style={{ color: '#6b635e' }}>
              No hay inscripciones pendientes para esta etapa.
            </div>
          ) : (
            <>
              {/* Barra de filtros */}
              <div className="bg-white border border-stone-200 rounded-xl p-3 mb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: '#a89a8e' }}>
                    <Filter size={12} /> Filtrar
                  </span>
                  <div className="relative min-w-[200px] flex-1">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Buscar por alumno o folio…"
                      className="w-full rounded-lg border border-stone-200 py-2 pl-9 pr-3 text-sm focus:border-[var(--color-guinda-500)] focus:outline-none"
                    />
                  </div>
                  <select
                    value={String(fModulo)}
                    onChange={(e) => setFModulo(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                    className="rounded-lg border border-stone-200 bg-white py-2 pl-3 pr-8 text-sm text-stone-700 focus:outline-none"
                  >
                    <option value="all">Todos los módulos</option>
                    {modulosOpts.map((m) => <option key={m.numero} value={m.numero}>Mód. {m.numero} — {m.nombre}</option>)}
                  </select>
                  <select
                    value={fFecha}
                    onChange={(e) => setFFecha(e.target.value)}
                    className="rounded-lg border border-stone-200 bg-white py-2 pl-3 pr-8 text-sm text-stone-700 focus:outline-none"
                  >
                    <option value="all">Toda fecha de examen</option>
                    {fechasOpts.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <select
                    value={fSede}
                    onChange={(e) => setFSede(e.target.value)}
                    className="rounded-lg border border-stone-200 bg-white py-2 pl-3 pr-8 text-sm text-stone-700 focus:outline-none max-w-[200px]"
                  >
                    <option value="all">Todas las sedes</option>
                    {sedesOpts.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {hayFiltros && (
                    <button onClick={limpiarFiltros} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-medium text-stone-500 hover:bg-stone-100">
                      <X size={13} /> Limpiar
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between mb-3">
                <p className="text-sm" style={{ color: '#6b635e' }}>
                  {hayFiltros
                    ? `${inscripcionesFiltradas.length} de ${inscripciones.length} alumnos`
                    : `${inscripciones.length} alumnos`}{' '}· {totalCapturadas} calificaciones ingresadas
                </p>
                {error && (
                  <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#b91c1c' }}>
                    <AlertCircle size={13} /> {error}
                  </div>
                )}
                <button
                  onClick={handleGuardar}
                  disabled={saving || totalCapturadas === 0}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition-opacity"
                  style={{ background: 'var(--color-guinda-700)' }}
                >
                  <Save size={14} /> {saving ? 'Guardando…' : `Guardar ${totalCapturadas > 0 ? totalCapturadas : ''} calificaciones`}
                </button>
              </div>

              <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
                {/* Header */}
                <div
                  className="grid text-[11px] font-semibold uppercase tracking-wide px-5 py-3 border-b border-stone-100"
                  style={{
                    gridTemplateColumns: '100px 1fr 160px 120px 140px 160px',
                    gap: 12,
                    background: '#fafaf9',
                    color: '#6b635e',
                  }}
                >
                  <div>Folio</div>
                  <div>Alumno</div>
                  <div>Módulo</div>
                  <div>Fecha examen</div>
                  <div>Sede</div>
                  <div>Calificación (0–10)</div>
                </div>

                {inscripcionesFiltradas.length === 0 ? (
                  <div className="px-5 py-10 text-center text-sm" style={{ color: '#6b635e' }}>
                    Ningún alumno coincide con los filtros.
                  </div>
                ) : inscripcionesFiltradas.map((ins) => {
                  const entrada = entradas[ins.id] ?? { calificacion: '', noPresento: false };
                  const califNum = parseFloat(entrada.calificacion);
                  const esValida = !isNaN(califNum) && califNum >= 0 && califNum <= 10;
                  const esAprobado = esValida && califNum >= 6;

                  return (
                    <div
                      key={ins.id}
                      className="grid items-center px-5 py-3 border-b border-stone-50 last:border-b-0"
                      style={{
                        gridTemplateColumns: '100px 1fr 160px 120px 140px 160px',
                        gap: 12,
                        background: entrada.noPresento ? '#fafaf9' : 'white',
                      }}
                    >
                      <div
                        className="text-xs font-mono"
                        style={{ color: 'var(--color-guinda-700)', background: '#fbe6ea', padding: '2px 6px', borderRadius: 4 }}
                      >
                        {ins.folio}
                      </div>
                      <div>
                        <div className="text-sm font-semibold" style={{ fontFamily: "'Poppins', sans-serif", color: '#2a2a2a' }}>
                          {ins.alumnoNombre}
                        </div>
                      </div>
                      <div className="text-xs" style={{ color: '#443e39' }}>
                        Mód. {ins.moduloNumero} — {ins.moduloNombre}
                      </div>
                      <div className="text-xs" style={{ color: '#6b635e' }}>
                        {ins.fechaExamen}
                      </div>
                      <div className="text-xs truncate" style={{ color: '#6b635e' }}>
                        {ins.sedeNombre}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={10}
                          step={0.1}
                          placeholder="—"
                          value={entrada.calificacion}
                          disabled={entrada.noPresento}
                          onChange={(e) => setCalif(ins.id, e.target.value)}
                          className="w-20 px-2 py-1.5 text-sm text-center rounded-lg border focus:outline-none"
                          style={{
                            borderColor: entrada.noPresento ? '#eadfd7' :
                              entrada.calificacion === '' ? '#eadfd7' :
                              esValida ? (esAprobado ? '#a7f3d0' : '#fca5a5') : '#fca5a5',
                            background: entrada.noPresento ? '#f7f2ed' : 'white',
                            color: entrada.noPresento ? '#a89a8e' :
                              (esValida ? (esAprobado ? '#2d7d46' : '#b91c1c') : '#2a2a2a'),
                            fontFamily: "'Poppins', sans-serif",
                            fontWeight: 700,
                          }}
                        />
                        {esValida && !entrada.noPresento && (
                          <span
                            className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
                            style={{
                              background: esAprobado ? '#d1fae5' : '#fee2e2',
                              color: esAprobado ? '#2d7d46' : '#b91c1c',
                            }}
                          >
                            {esAprobado ? 'APRO' : 'REP'}
                          </span>
                        )}
                        <label className="flex items-center gap-1 text-[11px] cursor-pointer select-none" style={{ color: '#6b635e' }}>
                          <input
                            type="checkbox"
                            checked={entrada.noPresento}
                            onChange={() => toggleNoPresento(ins.id)}
                            className="rounded"
                          />
                          No presentó
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom save button */}
              <div className="flex justify-end mt-4">
                <button
                  onClick={handleGuardar}
                  disabled={saving || totalCapturadas === 0}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition-opacity"
                  style={{ background: 'var(--color-guinda-700)' }}
                >
                  <Save size={14} /> {saving ? 'Guardando…' : `Guardar ${totalCapturadas} calificaciones`}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </AdminLayout>
  );
}
