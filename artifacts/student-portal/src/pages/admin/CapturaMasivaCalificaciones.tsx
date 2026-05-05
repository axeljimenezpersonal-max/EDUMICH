import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { GraduationCap, ChevronLeft, Save, AlertCircle } from 'lucide-react';
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
    if (!etapaId) { setInscripciones([]); setEntradas({}); return; }
    setLoadingInsc(true);
    api.get<{ inscripciones: Inscripcion[] }>(`/admin/calificaciones/batch-list?etapaId=${etapaId}`)
      .then((r) => {
        setInscripciones(r.inscripciones);
        const initial: Record<number, EntradaCalif> = {};
        for (const ins of r.inscripciones) {
          initial[ins.id] = { calificacion: ins.calificacion !== null ? String(ins.calificacion) : '', noPresento: false };
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
        const n = parseInt(val);
        if (isNaN(n) || n < 0 || n > 100) return null;
        return { inscripcionId, calificacion: n };
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
    (e) => e.noPresento || (e.calificacion.trim() !== '' && !isNaN(parseInt(e.calificacion)))
  ).length;

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
          onClick={() => setLocation('/admin/alumnos?filtro=calif_pendientes')}
          className="flex items-center gap-1.5 text-xs mb-3 hover:opacity-70 transition-opacity"
          style={{ color: 'var(--color-guinda-700)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <ChevronLeft size={14} /> Volver a alumnos
        </button>
        <div
          className="flex items-center gap-1.5 text-[11px] font-semibold uppercase mb-1.5"
          style={{ color: 'var(--color-guinda-700)', letterSpacing: '0.15em' }}
        >
          <GraduationCap size={12} /> CAPTURA MASIVA
        </div>
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#2a2a2a' }}
        >
          Captura masiva de calificaciones
        </h1>
        <p className="text-sm mt-1" style={{ color: '#78716c' }}>
          Selecciona una etapa y teclea las calificaciones para todos los alumnos que presentaron examen.
        </p>
      </div>

      {/* Selector de etapa */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 mb-6">
        <label className="block text-sm font-semibold mb-2" style={{ color: '#44403c' }}>
          Etapa de examen con calificaciones pendientes
        </label>
        {loadingEtapas ? (
          <div className="text-sm" style={{ color: '#78716c' }}>Cargando etapas…</div>
        ) : etapas.length === 0 ? (
          <div className="text-sm" style={{ color: '#78716c' }}>No hay etapas con calificaciones pendientes.</div>
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
            <div className="py-12 text-center text-sm" style={{ color: '#78716c' }}>Cargando inscripciones…</div>
          ) : inscripciones.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-xl py-12 text-center text-sm" style={{ color: '#78716c' }}>
              No hay inscripciones pendientes para esta etapa.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm" style={{ color: '#78716c' }}>
                  {inscripciones.length} alumnos · {totalCapturadas} calificaciones ingresadas
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
                    color: '#78716c',
                  }}
                >
                  <div>Folio</div>
                  <div>Alumno</div>
                  <div>Módulo</div>
                  <div>Fecha examen</div>
                  <div>Sede</div>
                  <div>Calificación (0–100)</div>
                </div>

                {inscripciones.map((ins) => {
                  const entrada = entradas[ins.id] ?? { calificacion: '', noPresento: false };
                  const califNum = parseInt(entrada.calificacion);
                  const esValida = !isNaN(califNum) && califNum >= 0 && califNum <= 100;
                  const esAprobado = esValida && califNum >= 60;

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
                        <div className="text-sm font-semibold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#2a2a2a' }}>
                          {ins.alumnoNombre}
                        </div>
                      </div>
                      <div className="text-xs" style={{ color: '#44403c' }}>
                        Mód. {ins.moduloNumero} — {ins.moduloNombre}
                      </div>
                      <div className="text-xs" style={{ color: '#78716c' }}>
                        {ins.fechaExamen}
                      </div>
                      <div className="text-xs truncate" style={{ color: '#78716c' }}>
                        {ins.sedeNombre}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          placeholder="—"
                          value={entrada.calificacion}
                          disabled={entrada.noPresento}
                          onChange={(e) => setCalif(ins.id, e.target.value)}
                          className="w-20 px-2 py-1.5 text-sm text-center rounded-lg border focus:outline-none"
                          style={{
                            borderColor: entrada.noPresento ? '#e7e5e4' :
                              entrada.calificacion === '' ? '#e7e5e4' :
                              esValida ? (esAprobado ? '#a7f3d0' : '#fca5a5') : '#fca5a5',
                            background: entrada.noPresento ? '#f5f5f4' : 'white',
                            color: entrada.noPresento ? '#a8a29e' :
                              (esValida ? (esAprobado ? '#2d7d46' : '#b91c1c') : '#2a2a2a'),
                            fontFamily: "'Plus Jakarta Sans', sans-serif",
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
                        <label className="flex items-center gap-1 text-[11px] cursor-pointer select-none" style={{ color: '#78716c' }}>
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
