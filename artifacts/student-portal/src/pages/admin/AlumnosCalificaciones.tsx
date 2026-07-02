import { useEffect, useState } from 'react';
import { Search, Plus, ChevronRight, AlertCircle, Check } from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { api, type CalificacionesResponse } from '../../lib/api';

interface AlumnoItem {
  userId: number;
  nombreCompleto: string;
  curp: string | null;
  email: string;
}

export default function AlumnosCalificaciones() {
  const [alumnos, setAlumnos] = useState<AlumnoItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AlumnoItem | null>(null);
  const [califs, setCalifs] = useState<CalificacionesResponse | null>(null);
  const [califsLoading, setCalifesLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    moduloId: '',
    etapaClave: '',
    calificacion: '',
    fechaExamen: '',
    notas: '',
  });
  const [modulos, setModulos] = useState<Array<{ id: number; numero: number; nombre: string }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    api.get<{ estudiantes: AlumnoItem[] }>('/admin/estudiantes')
      .then((r) => setAlumnos(r.estudiantes))
      .catch(() => {})
      .finally(() => setLoading(false));
    // Load modulos list for the dropdown
    api.get<{ modulos?: Array<{ id: number; numero: number; nombre: string }> }>('/publico/modulos')
      .then((r) => setModulos(r.modulos ?? []))
      .catch(() => {});
  }, []);

  async function selectAlumno(a: AlumnoItem) {
    setSelected(a);
    setCalifs(null);
    setCalifesLoading(true);
    try {
      const r = await api.get<CalificacionesResponse>(`/calificaciones/estudiantes/${a.userId}`);
      setCalifs(r);
    } catch {} finally {
      setCalifesLoading(false);
    }
  }

  async function handleCapturar(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await api.post(`/admin/estudiantes/${selected.userId}/calificaciones`, {
        moduloId: Number(form.moduloId),
        etapaClave: form.etapaClave,
        calificacion: Number(form.calificacion),
        fechaExamen: form.fechaExamen,
        notas: form.notas || undefined,
      });
      setSubmitSuccess(true);
      // Reload calificaciones
      const r = await api.get<CalificacionesResponse>(`/calificaciones/estudiantes/${selected.userId}`);
      setCalifs(r);
      setTimeout(() => {
        setModalOpen(false);
        setSubmitSuccess(false);
        setForm({ moduloId: '', etapaClave: '', calificacion: '', fechaExamen: '', notas: '' });
      }, 1500);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSubmitting(false);
    }
  }

  const filteredAlumnos = alumnos.filter(
    (a) =>
      a.nombreCompleto.toLowerCase().includes(search.toLowerCase()) ||
      (a.curp ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-guinda-700)] mb-1">Admin</div>
        <h1 style={{ fontFamily: "'Poppins', sans-serif" }} className="text-2xl font-bold text-stone-900">
          Captura de calificaciones
        </h1>
      </div>

      <div className="grid grid-cols-[320px_1fr] gap-6">
        {/* Lista de alumnos */}
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden h-fit">
          <div className="px-4 py-3 border-b border-stone-200">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar alumno…"
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-guinda-700)]"
              />
            </div>
          </div>
          <div className="max-h-[520px] overflow-y-auto divide-y divide-stone-100">
            {loading ? (
              <div className="p-6 text-center text-sm text-stone-400">Cargando…</div>
            ) : filteredAlumnos.length === 0 ? (
              <div className="p-6 text-center text-sm text-stone-400">Sin resultados</div>
            ) : (
              filteredAlumnos.map((a) => (
                <button
                  key={a.userId}
                  onClick={() => selectAlumno(a)}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-stone-50 transition-colors ${
                    selected?.userId === a.userId ? 'bg-[var(--color-crema-100)]' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-stone-900 truncate">{a.nombreCompleto}</div>
                    <div className="text-xs text-stone-500 font-mono">{a.curp ?? a.email}</div>
                  </div>
                  <ChevronRight size={14} className="text-stone-400 shrink-0" />
                </button>
              ))
            )}
          </div>
        </div>

        {/* Panel de calificaciones */}
        <div>
          {!selected ? (
            <div className="border-2 border-dashed border-stone-200 rounded-xl p-12 text-center">
              <div className="text-sm text-stone-400">Selecciona un alumno para ver sus calificaciones</div>
            </div>
          ) : (
            <>
              <div className="bg-white border border-stone-200 rounded-xl p-5 mb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-[var(--color-guinda-700)] font-semibold uppercase tracking-widest mb-0.5">Alumno seleccionado</div>
                    <div style={{ fontFamily: "'Poppins', sans-serif" }} className="text-xl font-bold text-stone-900">
                      {selected.nombreCompleto}
                    </div>
                    <div className="text-sm font-mono text-stone-500">{selected.curp}</div>
                  </div>
                  <button
                    onClick={() => setModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[var(--color-guinda-700)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--color-guinda-800)]"
                  >
                    <Plus size={14} /> Capturar calificación
                  </button>
                </div>
              </div>

              {califsLoading ? (
                <div className="text-center text-stone-400 py-12 text-sm">Cargando calificaciones…</div>
              ) : califs ? (
                <div className="space-y-3">
                  {/* Summary */}
                  <div className="bg-white border border-stone-200 rounded-xl px-5 py-4 flex gap-8 text-sm">
                    <div><span className="text-stone-500">Aprobados:</span> <strong>{califs.resumen.totalAprobados}/21</strong></div>
                    <div><span className="text-stone-500">Promedio:</span> <strong>{califs.resumen.promedioGlobal}</strong></div>
                    <div><span className="text-stone-500">Exámenes:</span> <strong>{califs.resumen.examenesPresentados}</strong></div>
                    <div><span className="text-stone-500">Avance:</span> <strong>{califs.resumen.porcentajeAvance}%</strong></div>
                  </div>
                  {/* Historial */}
                  {califs.historial.length === 0 ? (
                    <div className="border-2 border-dashed border-stone-200 rounded-xl p-8 text-center text-sm text-stone-400">
                      Sin calificaciones registradas aún.
                    </div>
                  ) : (
                    califs.historial.map((row) => (
                      <div
                        key={row.id}
                        className={`bg-white border border-stone-200 border-l-4 rounded-xl px-5 py-3.5 flex items-center gap-4 ${
                          row.aprobado ? 'border-l-emerald-500' : 'border-l-red-500'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div style={{ fontFamily: "'Poppins', sans-serif" }} className="font-semibold text-stone-900 text-sm">
                            M{row.moduloNumero} — {row.moduloNombre}
                          </div>
                          <div className="text-xs text-stone-500 mt-0.5">
                            Etapa {row.etapaClave} · {row.intento}º intento · {new Date(row.fechaExamen + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        </div>
                        <div style={{ fontFamily: "'Poppins', sans-serif" }} className={`text-2xl font-bold ${row.aprobado ? 'text-emerald-600' : 'text-red-600'}`}>
                          {row.calificacion}
                        </div>
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${row.aprobado ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {row.aprobado ? 'Aprobado' : 'No aprobado'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* Captura modal */}
      {modalOpen && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 bg-[var(--color-guinda-700)] text-white rounded-t-xl">
              <h3 style={{ fontFamily: "'Poppins', sans-serif" }} className="text-base font-semibold">
                Capturar calificación — {selected.nombreCompleto}
              </h3>
            </div>
            <form onSubmit={handleCapturar} className="p-6 space-y-4">
              {submitSuccess ? (
                <div className="flex flex-col items-center py-6 gap-3">
                  <Check size={40} className="text-emerald-500" />
                  <div style={{ fontFamily: "'Poppins', sans-serif" }} className="font-bold text-stone-900">¡Calificación guardada!</div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-1 uppercase tracking-widest">Módulo *</label>
                    <select
                      value={form.moduloId}
                      onChange={(e) => setForm((f) => ({ ...f, moduloId: e.target.value }))}
                      required
                      className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-guinda-700)]"
                    >
                      <option value="">Selecciona módulo…</option>
                      {modulos.map((m) => (
                        <option key={m.id} value={m.id}>M{m.numero} — {m.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-stone-600 mb-1 uppercase tracking-widest">Calificación * (0-100)</label>
                      <input
                        type="number" min="0" max="100" required
                        value={form.calificacion}
                        onChange={(e) => setForm((f) => ({ ...f, calificacion: e.target.value }))}
                        className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-guinda-700)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-stone-600 mb-1 uppercase tracking-widest">Fecha de examen *</label>
                      <input
                        type="date" required
                        value={form.fechaExamen}
                        onChange={(e) => setForm((f) => ({ ...f, fechaExamen: e.target.value }))}
                        className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-guinda-700)]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-1 uppercase tracking-widest">Clave de etapa *</label>
                    <input
                      type="text" required placeholder="ej. 2606-A"
                      value={form.etapaClave}
                      onChange={(e) => setForm((f) => ({ ...f, etapaClave: e.target.value }))}
                      className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-guinda-700)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-1 uppercase tracking-widest">Notas (opcional)</label>
                    <textarea
                      rows={2} value={form.notas}
                      onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                      className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-guinda-700)] resize-none"
                    />
                  </div>
                  {submitError && (
                    <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                      <AlertCircle size={13} /> {submitError}
                    </div>
                  )}
                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-stone-600 border border-stone-300 rounded-lg">
                      Cancelar
                    </button>
                    <button type="submit" disabled={submitting} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-[var(--color-guinda-700)] text-white rounded-lg hover:bg-[var(--color-guinda-800)] disabled:opacity-60">
                      <Plus size={14} /> {submitting ? 'Guardando…' : 'Guardar'}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
