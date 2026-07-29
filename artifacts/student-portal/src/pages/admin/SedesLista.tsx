/**
 * Catálogo de sedes (administración) — CRUD accesible a ambos perfiles de admin.
 *
 * Las sedes son el lugar físico donde se presenta el examen. Aquí se dan de alta
 * y se editan; QUÉ sedes aplican a cada convocatoria se define en el detalle de
 * la etapa (ConvocatoriaDetalle). Ver routes/sedes.ts y [[reglas-tutoriales]]/
 * el modelo de sedes.
 */
import { useEffect, useState } from 'react';
import { MapPin, Plus, Pencil, Trash2, Loader2, Phone, Building2, CheckCircle, AlertTriangle } from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { api } from '../../lib/api';
import { ModalHoja } from '../../components/ui/responsive';
import { ConfirmModal } from '../../components/ConfirmModal';
import { parseUbicacion, explicar, urlDeMapa } from '../../lib/ubicacionMaps';
import { soloDiezDigitos, telefonoCanonico } from '../../components/CampoTelefono';

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
  ubicacionTexto: string;
};

const EMPTY: FormSede = {
  nombre: '', direccion: '', municipioId: '', telefono: '', horarioAtencion: '', ubicacionTexto: '',
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
// Envoltorio "sin marco" para el modo embebido. DEBE vivir fuera del componente:
// si se define dentro del render, React lo ve como un componente nuevo en cada
// tecleo y REMONTA todo (el modal pierde el foco y la pantalla brinca).
function SinMarco({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// ── Selector de horario con "mini reloj" ───────────────────────────────────
// Días (preset) + hora de apertura y cierre con <input type="time">. Compone y
// guarda un texto tipo "L–V 9:00–15:00". Vive fuera del render (como SinMarco).
const HORARIO_DIAS = [
  { v: 'L–V', label: 'Lun a Vie' },
  { v: 'L–S', label: 'Lun a Sáb' },
  { v: 'Todos los días', label: 'Todos los días' },
  { v: 'Sáb–Dom', label: 'Sáb y Dom' },
  { v: 'custom', label: 'Otro…' },
];
function bonitoHora(hhmm: string): string {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  return m ? `${Number(m[1])}:${m[2]}` : hhmm; // "09:00" → "9:00"
}
function a24(hhmm: string): string {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : ''; // "9:00" → "09:00" (para el input)
}
function parseHorario(v: string): { dias: string; ini: string; fin: string } {
  const m = (v ?? '').trim().match(/^(.*?)\s+(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})\s*$/);
  if (m) return { dias: m[1].trim(), ini: m[2], fin: m[3] };
  return { dias: (v ?? '').trim(), ini: '', fin: '' };
}
function componerHorario(dias: string, ini: string, fin: string): string {
  const d = dias.trim();
  if (d && ini && fin) return `${d} ${bonitoHora(ini)}–${bonitoHora(fin)}`;
  if (d) return d;
  if (ini && fin) return `${bonitoHora(ini)}–${bonitoHora(fin)}`;
  return '';
}
function HorarioPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const init = parseHorario(value);
  const [dias, setDias] = useState(init.dias || 'L–V');
  const [ini, setIni] = useState(init.ini);
  const [fin, setFin] = useState(init.fin);
  const esPreset = HORARIO_DIAS.some((o) => o.v !== 'custom' && o.v === dias);
  const presetSel = esPreset ? dias : 'custom';
  const emit = (d: string, i: string, f: string) => { setDias(d); setIni(i); setFin(f); onChange(componerHorario(d, i, f)); };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 6 }}>
      <select style={inputStyle} value={presetSel} onChange={(e) => emit(e.target.value === 'custom' ? '' : e.target.value, ini, fin)}>
        {HORARIO_DIAS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
      </select>
      <input type="time" style={inputStyle} value={a24(ini)} onChange={(e) => emit(dias, e.target.value, fin)} aria-label="Hora de apertura" />
      <input type="time" style={inputStyle} value={a24(fin)} onChange={(e) => emit(dias, ini, e.target.value)} aria-label="Hora de cierre" />
      {presetSel === 'custom' && (
        <input style={{ ...inputStyle, gridColumn: '1 / -1' }} placeholder="Días (ej. Mar y Jue)" value={dias} onChange={(e) => emit(e.target.value, ini, fin)} />
      )}
    </div>
  );
}

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
        // Se precarga con el par ya guardado: el analizador lo entiende igual
        // que un enlace, así que editar no obliga a volver a buscar el lugar.
        ubicacionTexto: s.latitud != null && s.longitud != null ? `${s.latitud}, ${s.longitud}` : '',
      },
    });
  }

  async function guardar() {
    if (!modal) return;
    const f = modal.form;
    const ubic = parseUbicacion(f.ubicacionTexto);
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
      // Al servidor siguen viajando coordenadas: el campo de pegar es sólo la
      // forma de capturarlas. Si el texto no tiene ubicación válida, van nulas
      // y el alumno cae en la búsqueda por nombre y dirección, que ya existía.
      latitud: ubic.ok ? String(ubic.ubicacion.lat) : null,
      longitud: ubic.ok ? String(ubic.ubicacion.lng) : null,
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

  // Enlace CORTO de Google Maps (maps.app.goo.gl): no trae coordenadas dentro,
  // así que el servidor sigue la redirección (solo dominios de Google) y las
  // saca. Al pegarlo, se resuelve solo y el campo pasa a mostrar las coordenadas.
  const [resolviendoMapa, setResolviendoMapa] = useState(false);
  const [errorMapa, setErrorMapa] = useState<string | null>(null);
  const ubicacionTexto = modal?.form.ubicacionTexto ?? '';
  useEffect(() => {
    const r = parseUbicacion(ubicacionTexto);
    if (r.ok || r.motivo !== 'enlace_corto') { setErrorMapa(null); setResolviendoMapa(false); return; }
    let vivo = true;
    setErrorMapa(null);
    const t = setTimeout(async () => {
      setResolviendoMapa(true);
      try {
        const c = await api.post<{ lat: number; lng: number }>('/admin/sedes/resolver-mapa', { url: ubicacionTexto.trim() });
        if (vivo && c && typeof c.lat === 'number' && typeof c.lng === 'number') {
          setF({ ubicacionTexto: `${c.lat}, ${c.lng}` });
        }
      } catch (e) {
        if (vivo) setErrorMapa(e instanceof Error ? e.message : 'No pude resolver el enlace.');
      } finally {
        if (vivo) setResolviendoMapa(false);
      }
    }, 700);
    return () => { vivo = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ubicacionTexto]);

  const Envoltura = embebido ? SinMarco : AdminLayout;

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
          descartarAfuera={false}
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
              <div>
                <label style={labelStyle}>Teléfono</label>
                <div style={{ display: 'flex' }}>
                  <span style={{ display: 'flex', alignItems: 'center', padding: '9px 11px', border: '1px solid #ddd0c5', borderRight: 'none', borderRadius: '8px 0 0 8px', background: '#f7f2ed', fontSize: 14, fontWeight: 600, color: '#57534e', userSelect: 'none' }} aria-hidden>+52</span>
                  <input style={{ ...inputStyle, borderRadius: '0 8px 8px 0' }} inputMode="numeric" maxLength={10} value={soloDiezDigitos(modal.form.telefono)} onChange={(e) => setF({ telefono: telefonoCanonico(e.target.value) })} placeholder="443 000 0000" />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Horario de atención</label>
                <HorarioPicker value={modal.form.horarioAtencion} onChange={(v) => setF({ horarioAtencion: v })} />
              </div>
              {/* Ubicación: se pega el enlace de Google Maps y de ahí se sacan las
                  coordenadas. Se guardan coordenadas y no el enlace porque
                  abren en cualquier app de mapas —no sólo Google—, permiten
                  "cómo llegar" con ruta, y un par de números no puede ser un
                  `javascript:` disfrazado. Ver lib/ubicacionMaps.ts. */}
              <div>
                <label style={labelStyle}>
                  Ubicación en el mapa <span style={{ fontWeight: 400, color: '#a89a8e' }}>(opcional)</span>
                </label>
                <input
                  style={inputStyle}
                  value={modal.form.ubicacionTexto}
                  onChange={(e) => setF({ ubicacionTexto: e.target.value })}
                  placeholder="Pega el enlace de Google Maps (el de «Compartir» funciona)"
                />
                {(() => {
                  const r = parseUbicacion(modal.form.ubicacionTexto);
                  if (r.ok) {
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 12, color: '#166534' }}>
                        <CheckCircle size={13} />
                        <span>Ubicación detectada: {r.ubicacion.lat}, {r.ubicacion.lng}</span>
                        <a
                          href={urlDeMapa(r.ubicacion)}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: 'var(--color-guinda-700)', fontWeight: 600 }}
                        >
                          Comprobar en el mapa →
                        </a>
                      </div>
                    );
                  }
                  if (r.motivo === 'vacio') {
                    return (
                      <p style={{ fontSize: 11, color: '#a89a8e', lineHeight: 1.5, marginTop: 6 }}>
                        Pega el enlace de Google Maps: sirve el de «Compartir» (maps.app.goo.gl), la
                        dirección de la barra del navegador, o las coordenadas (clic derecho sobre el punto).
                        Sin esto el alumno igual puede buscar la sede por su nombre y dirección.
                      </p>
                    );
                  }
                  // Enlace corto: se resuelve solo en el servidor.
                  if (r.motivo === 'enlace_corto') {
                    if (resolviendoMapa) {
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 12, color: '#6b635e' }}>
                          <Loader2 size={13} className="animate-spin" />
                          <span>Detectando la ubicación del enlace…</span>
                        </div>
                      );
                    }
                    return (
                      <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 12, color: '#b45309', lineHeight: 1.5 }}>
                        <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 2 }} />
                        <span>{errorMapa ?? 'Detectando la ubicación del enlace…'}</span>
                      </div>
                    );
                  }
                  return (
                    <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 12, color: '#b45309', lineHeight: 1.5 }}>
                      <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 2 }} />
                      <span>{explicar(r.motivo)}</span>
                    </div>
                  );
                })()}
              </div>
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
