import { useEffect, useState, useMemo } from 'react';
import { Search, X, Plus, RefreshCw, MapPin, AlertTriangle } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────

type Municipio = {
  id: number;
  nombre: string;
  activo: boolean;
  totalAlumnos: number;
};

// ─── Toast ────────────────────────────────────────────────────────────────

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div
      className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white flex items-center gap-2"
      style={{ background: ok ? '#2d7d46' : '#b91c1c' }}
    >
      {msg}
    </div>
  );
}

// ─── ConfirmModal ─────────────────────────────────────────────────────────

function ConfirmModal({
  municipio,
  onConfirm,
  onCancel,
}: {
  municipio: Municipio;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-200 flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: '#fff7ed' }}
          >
            <AlertTriangle size={18} strokeWidth={2} style={{ color: '#b45309' }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-stone-800">Desactivar municipio</h3>
            <p className="text-xs text-stone-500">{municipio.nombre}</p>
          </div>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-stone-700 leading-relaxed">
            Este municipio tiene{' '}
            <strong>{municipio.totalAlumnos}</strong>{' '}
            {municipio.totalAlumnos === 1 ? 'alumno asignado' : 'alumnos asignados'}. Si lo desactivas, no podras asignar
            nuevos alumnos pero los existentes seguiran activos. &iquest;Continuar?
          </p>
        </div>
        <div className="px-5 py-3 border-t border-stone-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm font-medium rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-3 py-1.5 text-sm font-semibold rounded-lg text-white"
            style={{ background: '#b45309' }}
          >
            Desactivar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────

export default function Municipios({ onDirty: _onDirty }: { onDirty?: (d: boolean) => void }) {
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [loading, setLoading] = useState(true);
  const [buscar, setBuscar] = useState('');
  const [confirmPending, setConfirmPending] = useState<Municipio | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [toggling, setToggling] = useState<Set<number>>(new Set());

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2800);
  }

  useEffect(() => {
    fetch('/api/admin/configuracion/municipios', { credentials: 'include' })
      .then((r) => r.json())
      .then((data: Municipio[]) => setMunicipios(data))
      .catch(() => showToast('Error al cargar municipios', false))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    if (!q) return municipios;
    return municipios.filter((m) => m.nombre.toLowerCase().includes(q));
  }, [municipios, buscar]);

  const activos = filtered.filter((m) => m.activo);
  const disponibles = filtered.filter((m) => !m.activo);

  async function doToggle(id: number, activo: boolean) {
    setToggling((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/admin/configuracion/municipios/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo }),
      });
      if (!res.ok) throw new Error();
      setMunicipios((prev) => prev.map((m) => (m.id === id ? { ...m, activo } : m)));
      showToast(activo ? 'Municipio activado' : 'Municipio desactivado');
    } catch {
      showToast('Error al actualizar', false);
    } finally {
      setToggling((prev) => {
        const s = new Set(prev);
        s.delete(id);
        return s;
      });
    }
  }

  function requestToggle(municipio: Municipio, newActivo: boolean) {
    if (!newActivo && municipio.totalAlumnos > 0) {
      setConfirmPending(municipio);
    } else {
      doToggle(municipio.id, newActivo);
    }
  }

  async function toggleAll(activo: boolean) {
    const targets = municipios.filter((m) => m.activo !== activo);
    for (const m of targets) {
      await doToggle(m.id, activo);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw size={20} className="animate-spin" style={{ color: '#6B1530' }} />
      </div>
    );
  }

  return (
    <div>
      {/* Card */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3 flex items-center justify-between" style={{ background: '#6B1530' }}>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <MapPin size={14} strokeWidth={2} />
            Municipios
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleAll(true)}
              className="px-3 py-1 text-xs font-semibold rounded border border-white/30 text-white hover:bg-white/10"
            >
              Activar todos
            </button>
            <button
              type="button"
              onClick={() => toggleAll(false)}
              className="px-3 py-1 text-xs font-semibold rounded border border-white/30 text-white/70 hover:bg-white/10"
            >
              Desactivar todos
            </button>
          </div>
        </div>

        <div className="p-5">
          {/* Search */}
          <div className="relative mb-5">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              className="w-full pl-9 pr-9 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-[#6B1530]"
              placeholder="Buscar municipio..."
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
            />
            {buscar && (
              <button
                type="button"
                onClick={() => setBuscar('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                <X size={13} strokeWidth={2} />
              </button>
            )}
          </div>

          {/* ACTIVOS */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: '#6B1530' }}>
                ACTIVOS
              </h3>
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: '#f5e6ef', color: '#6B1530' }}
              >
                {activos.length}
              </span>
            </div>
            {activos.length === 0 ? (
              <p className="text-xs text-stone-400 py-2">Ningun municipio activo{buscar ? ' coincide con la busqueda' : ''}.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {activos.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full text-sm font-medium"
                    style={{ background: '#6B1530', color: 'white' }}
                  >
                    <span>{m.nombre}</span>
                    {m.totalAlumnos > 0 && (
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}
                      >
                        {m.totalAlumnos}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => requestToggle(m, false)}
                      disabled={toggling.has(m.id)}
                      className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-white/20 disabled:opacity-50"
                    >
                      {toggling.has(m.id) ? (
                        <RefreshCw size={10} strokeWidth={2} className="animate-spin" />
                      ) : (
                        <X size={11} strokeWidth={2.5} />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* DISPONIBLES */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-stone-500">DISPONIBLES</h3>
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: '#f7f2ed', color: '#6b635e' }}
              >
                {disponibles.length}
              </span>
            </div>
            {disponibles.length === 0 ? (
              <p className="text-xs text-stone-400 py-2">Todos los municipios estan activos.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {disponibles.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full text-sm font-medium"
                    style={{ border: '1.5px dashed #6B1530', color: '#6B1530' }}
                  >
                    <span>{m.nombre}</span>
                    <button
                      type="button"
                      onClick={() => requestToggle(m, true)}
                      disabled={toggling.has(m.id)}
                      className="w-5 h-5 rounded-full flex items-center justify-center disabled:opacity-50"
                      style={{ background: '#f5e6ef' }}
                    >
                      {toggling.has(m.id) ? (
                        <RefreshCw size={10} strokeWidth={2} className="animate-spin" />
                      ) : (
                        <Plus size={11} strokeWidth={2.5} />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirm modal */}
      {confirmPending && (
        <ConfirmModal
          municipio={confirmPending}
          onConfirm={() => {
            doToggle(confirmPending.id, false);
            setConfirmPending(null);
          }}
          onCancel={() => setConfirmPending(null)}
        />
      )}

      {/* Toast */}
      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </div>
  );
}
