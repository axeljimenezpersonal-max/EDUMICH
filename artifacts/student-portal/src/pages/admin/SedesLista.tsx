/**
 * Catálogo de sedes (administración) — CRUD accesible a ambos perfiles de admin.
 *
 * Las sedes son el lugar físico donde se presenta el examen. Aquí se dan de alta
 * y se editan; QUÉ sedes aplican a cada convocatoria se define en el detalle de
 * la etapa (ConvocatoriaDetalle). Ver routes/sedes.ts y [[reglas-tutoriales]]/
 * el modelo de sedes.
 */
import { useEffect, useState } from 'react';
import { MapPin, Plus, Pencil, Trash2, Loader2, Phone, Building2 } from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { api } from '../../lib/api';
import { ModalHoja } from '../../components/ui/responsive';
import { ConfirmModal } from '../../components/ConfirmModal';

interface Sede {
  id: number;
  nombre: string;
  direccion: string;
  municipioId: number;
  municipio: string;
  telefono: string | null;
  horarioAtencion: string | null;
  latitud: number | null;
  longitud: number | null;
  usos: number;
}

interface Municipio { id: number; nombre: string }

type FormSede = {
  nombre: string;
  direccion: string;
  municipioId: number | '';
  telefono: string;
  horarioAtencion: string;
  latitud: string;
  longitud: string;
};

const EMPTY: FormSede = {
  nombre: '', direccion: '', municipioId: '', telefono: '', horarioAtencion: '', latitud: '', longitud: '',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 11px', border: '1px solid #ddd0c5', borderRadius: 8,
  fontSize: 14, color: '#2a2a2a', background: 'white', outline: 'none',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#6b635e', marginBottom: 4,
};

/**
 * Catálogo de sedes.
 *
 * `embebido` la monta DENTRO de Convocatorias (que es donde vive
 * conceptualmente: la convocatoria define qué sedes se ofrecen, el alumno
 * elige). Sin la prop sigue funcionando como página propia, para que
 * `/admin/sedes` no se rompa.
 */
export default function SedesLista({ embebido = false }: { embebido?: boolean } = {}) {
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal de crear/editar: null = cerrado; { id? } = abierto (id presente = editar)
  const [modal, setModal] = useState<{ id?: number; form: FormSede } | null>(null);
  const [aBorrar, setABorrar] = useState<Sede | null>(null);

  function cargar() {
    setLoading(true);
    Promise.all([
      api.get<{ sedes: Sede[] }>('/admin/sedes'),
      api.get<{ municipios: Municipio[] }>('/admin/municipios'),
    ])
      .then(([s, m]) => { setSedes(s.sedes); setMunicipios(m.municipios); })
      .catch(() => setError('No se pudieron cargar las sedes.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { cargar(); }, []);

  function abrirNueva() { setError(null); setModal({ form: { ...EMPTY } }); }
  function abrirEditar(s: Sede) {
    setError(null);
    setModal({
      id: s.id,
      form: {
        nombre: s.nombre,
        direccion: s.direccion,
        municipioId: s.municipioId,
        telefono: s.telefono ?? '',
        horarioAtencion: s.horarioAtencion ?? '',
        latitud: s.latitud != null ? String(s.latitud) : '',
        longitud: s.longitud != null ? String(s.longitud) : '',
      },
    });
  }

  async function guardar() {
    if (!modal) return;
    const f = modal.form;
    if (f.nombre.trim().length < 3) { setError('El nombre es demasiado corto.'); return; }
    if (f.direccion.trim().length < 5) { setError('La dirección es demasiado corta.'); return; }
    if (!f.municipioId) { setError('Elige un municipio.'); return; }

    setGuardando(true);
    setError(null);
    const body = {
      nombre: f.nombre.trim(),
      direccion: f.direccion.trim(),
      municipioId: Number(f.municipioId),
      telefono: f.telefono.trim() || null,
      horarioAtencion: f.horarioAtencion.trim() || null,
      latitud: f.latitud.trim() || null,
      longitud: f.longitud.trim() || null,
    };
    try {
      if (modal.id) await api.put(`/admin/sedes/${modal.id}`, body);
      else await api.post('/admin/sedes', body);
      setModal(null);
      cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la sede.');
    } finally {
      setGuardando(false);
    }
  }

  async function borrar() {
    if (!aBorrar) return;
    try {
      await api.delete(`/admin/sedes/${aBorrar.id}`);
      setABorrar(null);
      cargar();
    } catch (e) {
      // El backend responde 409 con el motivo (sede en uso).
      setError(e instanceof Error ? e.message : 'No se pudo eliminar la sede.');
      setABorrar(null);
    }
  }

  function setF(patch: Partial<FormSede>) {
    setModal((m) => (m ? { ...m, form: { ...m.form, ...patch } } : m));
  }

  const Envoltura = embebido
    ? ({ children }: { children: React.ReactNode }) => <>{children}</>
    : AdminLayout;

  return (
    <Envoltura>
      <div style={{ maxWidth: 860 }}>
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          {embebido ? (
            // Embebida, el título lo pone la pestaña: repetirlo sería ruido.
            <p style={{ fontSize: 12, color: '#6b635e', margin: 0 }}>
              Lugares donde los alumnos presentan su examen. La convocatoria decide cuáles se ofrecen en cada etapa.
            </p>
          ) : (
            <div className="flex items-center gap-3">
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#efe7d6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MapPin size={20} style={{ color: 'var(--color-guinda-700)' }} />
              </div>
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: '#2a2a2a', margin: 0 }}>Sedes</h1>
                <p style={{ fontSize: 12, color: '#6b635e', margin: 0 }}>Lugares donde los alumnos presentan su examen</p>
              </div>
            </div>
          )}
          <button
            onClick={abrirNueva}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: 'var(--color-guinda-700)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            <Plus size={14} /> Nueva sede
          </button>
        </div>

        {/* Aviso de error a nivel de página (p. ej. no se pudo borrar) */}
        {error && !modal && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center" style={{ padding: 60 }}>
            <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-guinda-700)' }} />
          </div>
        ) : sedes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#6b635e' }}>
            <MapPin size={40} style={{ opacity: 0.25, margin: '0 auto 12px' }} />
            <p style={{ fontWeight: 600 }}>Aún no hay sedes registradas</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>Crea la primera con el botón «Nueva sede».</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {sedes.map((s) => (
              <div key={s.id} className="rounded-xl border border-stone-200 bg-white p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-bold leading-snug text-stone-900">{s.nombre}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-stone-500">
                      <Building2 size={12} /> {s.municipio}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => abrirEditar(s)}
                      aria-label="Editar sede"
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => { setError(null); setABorrar(s); }}
                      aria-label="Eliminar sede"
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 text-red-500 hover:bg-red-50"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <div className="mt-2.5 text-[13px] text-stone-700">{s.direccion}</div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500">
                  {s.telefono && (
                    <span className="flex items-center gap-1"><Phone size={12} /> {s.telefono}</span>
                  )}
                  <span
                    title="Inscripciones que usan esta sede"
                    style={{ color: s.usos > 0 ? 'var(--color-guinda-700)' : '#a89a8e' }}
                  >
                    {s.usos} inscripción{s.usos === 1 ? '' : 'es'} en uso
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal crear / editar */}
      {modal && (
        <ModalHoja
          onClose={() => setModal(null)}
          etiqueta={modal.id ? 'Editar sede' : 'Nueva sede'}
          ancho="sm:max-w-lg"
          pie={
            <div className="flex gap-2 border-t border-stone-100 bg-stone-50 px-5 py-3">
              <button
                onClick={() => setModal(null)}
                className="min-h-[44px] flex-1 rounded-lg border border-stone-300 text-sm font-semibold text-stone-600 hover:bg-white"
              >
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={guardando}
                className="min-h-[44px] flex-1 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
                style={{ background: 'var(--color-guinda-700)' }}
              >
                {guardando ? 'Guardando…' : modal.id ? 'Guardar cambios' : 'Crear sede'}
              </button>
            </div>
          }
        >
          <div className="p-5">
            <h3 className="font-serif text-lg font-bold text-stone-900 mb-4">
              {modal.id ? 'Editar sede' : 'Nueva sede'}
            </h3>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 8, padding: '9px 12px', fontSize: 13, marginBottom: 14 }}>
                {error}
              </div>
            )}

            <div className="space-y-3.5">
              <div>
                <label style={labelStyle}>Nombre de la sede</label>
                <input style={inputStyle} value={modal.form.nombre} onChange={(e) => setF({ nombre: e.target.value })} placeholder="Centro de Servicios Morelia" />
              </div>
              <div>
                <label style={labelStyle}>Municipio</label>
                <select style={inputStyle} value={modal.form.municipioId} onChange={(e) => setF({ municipioId: e.target.value ? Number(e.target.value) : '' })}>
                  <option value="">Elige un municipio…</option>
                  {municipios.map((m) => (
                    <option key={m.id} value={m.id}>{m.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Dirección</label>
                <input style={inputStyle} value={modal.form.direccion} onChange={(e) => setF({ direccion: e.target.value })} placeholder="Av. Madero Pte. 1234, Centro" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={labelStyle}>Teléfono</label>
                  <input style={inputStyle} value={modal.form.telefono} onChange={(e) => setF({ telefono: e.target.value })} placeholder="443 000 0000" />
                </div>
                <div>
                  <label style={labelStyle}>Horario</label>
                  <input style={inputStyle} value={modal.form.horarioAtencion} onChange={(e) => setF({ horarioAtencion: e.target.value })} placeholder="L-V 9:00-15:00" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={labelStyle}>Latitud <span style={{ fontWeight: 400, color: '#a89a8e' }}>(opcional)</span></label>
                  <input style={inputStyle} value={modal.form.latitud} onChange={(e) => setF({ latitud: e.target.value })} placeholder="19.7008" inputMode="decimal" />
                </div>
                <div>
                  <label style={labelStyle}>Longitud <span style={{ fontWeight: 400, color: '#a89a8e' }}>(opcional)</span></label>
                  <input style={inputStyle} value={modal.form.longitud} onChange={(e) => setF({ longitud: e.target.value })} placeholder="-101.1844" inputMode="decimal" />
                </div>
              </div>
              <p style={{ fontSize: 11, color: '#a89a8e', lineHeight: 1.5 }}>
                Las coordenadas permiten el botón «Ver en mapa» del alumno. Puedes copiarlas de Google Maps (clic derecho sobre el punto).
              </p>
            </div>
          </div>
        </ModalHoja>
      )}

      {/* Confirmar borrado */}
      {aBorrar && (
        <ConfirmModal
          icon={<Trash2 size={18} />}
          danger
          title="Eliminar sede"
          message={
            aBorrar.usos > 0
              ? `«${aBorrar.nombre}» tiene ${aBorrar.usos} inscripción(es). No se podrá eliminar; edítala si cambió de dirección.`
              : `¿Eliminar «${aBorrar.nombre}»? Esta acción no se puede deshacer.`
          }
          confirmLabel="Eliminar"
          onConfirm={borrar}
          onClose={() => setABorrar(null)}
        />
      )}
    </Envoltura>
  );
}
