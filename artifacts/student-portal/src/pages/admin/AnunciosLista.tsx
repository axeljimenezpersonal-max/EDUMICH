import { useEffect, useState } from 'react';
import { AdminLayout } from './AdminLayout';
import { SectionTour } from '../../components/onboarding/SectionTour';
import { TOUR_A_ANUNCIOS, GATE_ADMIN } from '../../components/onboarding/seccionesAdmin';
import { api } from '../../lib/api';
import {
  Megaphone, Plus, Archive, ArchiveRestore, Trash2, Edit2,
  AlertTriangle, Info, AlertCircle, X, Loader2,
  Users, UserCheck, Globe, MapPin, Calendar,
} from 'lucide-react';
import { ConfirmModal } from '../../components/ConfirmModal';
import { avisar } from '../../components/Avisador';

// ── Types ──────────────────────────────────────────────────────────────────

type MunicipioOpt = { id: number; nombre: string; alumnosCount: number };
type EtapaOpt = { id: number; label: string; nombreCompleto: string; clave: string; fase: string; anio: number; estado: string; inscritosCount: number };
type GestorOpt = { id: number; nombreCompleto: string; municipioNombre: string | null; alumnosCount: number };

type AnuncioPrioridad = 'informativo' | 'importante' | 'urgente';
type AnuncioAudiencia = 'todos' | 'alumnos' | 'gestores' | 'alumnos_municipio' | 'alumnos_etapa' | 'gestor_especifico';
type AnuncioEstado = 'borrador' | 'publicado' | 'archivado';

interface Anuncio {
  id: number;
  titulo: string;
  contenido: string;
  prioridad: AnuncioPrioridad;
  audiencia: AnuncioAudiencia;
  audienciaParam: string | null;
  estado: AnuncioEstado;
  ctaTexto: string | null;
  ctaUrl: string | null;
  publicadoEn: string | null;
  activoHasta: string | null;
  createdAt: string;
}

interface Resumen {
  total: number;
  publicados: number;
  borradores: number;
  archivados: number;
  urgentes: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const PRIORIDAD_CFG: Record<AnuncioPrioridad, { label: string; icon: typeof Info; bg: string; color: string; border: string }> = {
  informativo: { label: 'Informativo', icon: Info, bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  importante:  { label: 'Importante',  icon: AlertTriangle, bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
  urgente:     { label: 'Urgente',     icon: AlertCircle,   bg: '#fff1f2', color: '#be123c', border: '#fecdd3' },
};

const AUDIENCIA_CFG: Record<AnuncioAudiencia, { label: string; icon: typeof Globe }> = {
  todos:              { label: 'Todos',                icon: Globe },
  alumnos:            { label: 'Solo alumnos',         icon: Users },
  gestores:           { label: 'Solo gestores',        icon: UserCheck },
  alumnos_municipio:  { label: 'Alumnos por municipio', icon: MapPin },
  alumnos_etapa:      { label: 'Alumnos por etapa',    icon: Calendar },
  gestor_especifico:  { label: 'Gestor específico',    icon: UserCheck },
};

const ESTADO_CFG: Record<AnuncioEstado, { label: string; bg: string; color: string }> = {
  borrador:  { label: 'Borrador',   bg: '#f3f4f6', color: '#6b7280' },
  publicado: { label: 'Publicado',  bg: '#f0fdf4', color: '#16a34a' },
  archivado: { label: 'Archivado',  bg: '#f8fafc', color: '#94a3b8' },
};

function fmt(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Empty form ──────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  titulo: '',
  contenido: '',
  prioridad: 'informativo' as AnuncioPrioridad,
  audiencia: 'todos' as AnuncioAudiencia,
  audienciaParam: '',
  estado: 'publicado' as AnuncioEstado,
  ctaTexto: '',
  ctaUrl: '',
  activoHasta: '',
};

// ── Modal crear/editar ──────────────────────────────────────────────────────

const AUDIENCIA_NEEDS_PARAM = new Set<AnuncioAudiencia>(['alumnos_municipio', 'alumnos_etapa', 'gestor_especifico']);

function ModalAnuncio({
  initial,
  onClose,
  onSave,
}: {
  initial: typeof EMPTY_FORM & { id?: number };
  onClose: () => void;
  onSave: (data: typeof EMPTY_FORM) => Promise<void>;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const [opcionesMunicipios, setOpcionesMunicipios] = useState<MunicipioOpt[]>([]);
  const [opcionesEtapas, setOpcionesEtapas] = useState<EtapaOpt[]>([]);
  const [opcionesGestores, setOpcionesGestores] = useState<GestorOpt[]>([]);

  useEffect(() => {
    Promise.all([
      api.get<{ municipios: MunicipioOpt[] }>('/admin/municipios?activos=true'),
      api.get<{ etapas: EtapaOpt[] }>('/admin/etapas'),
      api.get<{ gestores: GestorOpt[] }>('/admin/gestores-list'),
    ]).then(([m, e, g]) => {
      setOpcionesMunicipios(m.municipios);
      setOpcionesEtapas(e.etapas);
      setOpcionesGestores(g.gestores);
    }).catch(console.error);
  }, []);

  function set(key: keyof typeof EMPTY_FORM, val: string) {
    setForm(f => ({ ...f, [key]: val }));
  }

  function handleAudienciaChange(val: AnuncioAudiencia) {
    setForm(f => ({ ...f, audiencia: val, audienciaParam: '' }));
  }

  function audienciaPreviewLabel(): string {
    const aud = form.audiencia as AnuncioAudiencia;
    if (aud === 'todos') return 'Todos los usuarios';
    if (aud === 'alumnos') return 'Todos los alumnos';
    if (aud === 'gestores') return 'Todos los gestores';
    if (!form.audienciaParam) return AUDIENCIA_CFG[aud]?.label ?? aud;
    if (aud === 'alumnos_municipio') {
      const m = opcionesMunicipios.find(x => String(x.id) === form.audienciaParam);
      return m ? `Alumnos de ${m.nombre} (${m.alumnosCount})` : 'Alumnos de un municipio';
    }
    if (aud === 'alumnos_etapa') {
      const e = opcionesEtapas.find(x => String(x.id) === form.audienciaParam);
      return e ? `Inscritos en ${e.nombreCompleto} (${e.inscritosCount})` : 'Alumnos de una etapa';
    }
    if (aud === 'gestor_especifico') {
      const g = opcionesGestores.find(x => String(x.id) === form.audienciaParam);
      return g ? `Solo para ${g.nombreCompleto}` : 'Gestor específico';
    }
    return String(aud);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.titulo.trim() || !form.contenido.trim()) { setErr('Título y contenido son requeridos'); return; }
    if (AUDIENCIA_NEEDS_PARAM.has(form.audiencia as AnuncioAudiencia) && !form.audienciaParam) {
      const noun = form.audiencia === 'alumnos_municipio' ? 'municipio'
        : form.audiencia === 'alumnos_etapa' ? 'etapa'
        : 'gestor';
      setErr(`Por favor selecciona el ${noun}`);
      return;
    }
    setSaving(true);
    setErr('');
    try {
      await onSave(form);
      onClose();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = { width: '100%', border: '1px solid #eadfd7', borderRadius: 6, padding: '8px 12px', fontSize: 13, background: '#faf9f8', color: '#2a2a2a' };
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#57504a', marginBottom: 4, display: 'block' };
  const filterBoxStyle: React.CSSProperties = { marginTop: 8, padding: '12px 14px', background: '#fdfaf3', border: '1px solid #eadfd7', borderLeft: '3px solid var(--color-guinda-700)', borderRadius: 8 };
  const filterLabelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-guinda-700)', marginBottom: 6, display: 'block' };
  const selectStyle: React.CSSProperties = { width: '100%', border: '1px solid #ddd0c5', borderRadius: 6, padding: '8px 12px', fontSize: 13, background: '#fff', color: '#2a2a2a', cursor: 'pointer', fontFamily: 'inherit' };

  const needsParam = AUDIENCIA_NEEDS_PARAM.has(form.audiencia as AnuncioAudiencia);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-xl shadow-2xl overflow-hidden flex"
        style={{ width: 780, maxHeight: '90vh', maxWidth: '95vw' }}
      >
        {/* Form */}
        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: 28 }}>
          <div className="flex items-center justify-between mb-5">
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#2a2a2a' }}>
              {initial.id ? 'Editar anuncio' : 'Nuevo anuncio'}
            </h2>
            <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b635e' }}>
              <X size={18} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Título *</label>
              <input style={inputStyle} value={form.titulo} onChange={e => set('titulo', e.target.value)} maxLength={200} placeholder="Ej. Recordatorio: examen de convocatoria 2026-1" />
            </div>

            <div>
              <label style={labelStyle}>Contenido *</label>
              <textarea style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }} value={form.contenido} onChange={e => set('contenido', e.target.value)} placeholder="Escribe el mensaje del anuncio..." />
            </div>

            {/* Prioridad */}
            <div>
              <label style={labelStyle}>Prioridad</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(Object.keys(PRIORIDAD_CFG) as AnuncioPrioridad[]).map(p => {
                  const cfg = PRIORIDAD_CFG[p];
                  const active = form.prioridad === p;
                  return (
                    <button key={p} type="button" onClick={() => set('prioridad', p)}
                      style={{ flex: 1, padding: '8px 12px', border: `1.5px solid ${active ? cfg.color : '#eadfd7'}`, borderRadius: 8, background: active ? cfg.bg : '#fff', color: active ? cfg.color : '#6b635e', fontSize: 12, fontWeight: active ? 700 : 400, cursor: 'pointer', transition: 'all 0.15s' }}>
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Audiencia */}
            <div>
              <label style={labelStyle}>Audiencia</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(Object.keys(AUDIENCIA_CFG) as AnuncioAudiencia[]).map(a => {
                  const cfg = AUDIENCIA_CFG[a];
                  const Icon = cfg.icon;
                  const active = form.audiencia === a;
                  return (
                    <div key={a}>
                      <button
                        type="button"
                        onClick={() => handleAudienciaChange(a)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px',
                          border: `1.5px solid ${active ? 'var(--color-guinda-700)' : '#eadfd7'}`,
                          borderRadius: 8, background: active ? '#fdf4f5' : '#fff', cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: active ? '#efe7d6' : '#f7f2ed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Icon size={14} style={{ color: active ? 'var(--color-guinda-700)' : '#6b635e' }} />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: active ? 700 : 400, color: active ? 'var(--color-guinda-700)' : '#443e39' }}>
                          {cfg.label}
                        </span>
                        {active && (
                          <span style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', background: 'var(--color-guinda-700)', flexShrink: 0 }} />
                        )}
                      </button>

                      {/* Dropdown de filtro — aparece SOLO cuando esta audiencia está activa */}
                      {active && AUDIENCIA_NEEDS_PARAM.has(a) && (
                        <div style={filterBoxStyle}>
                          <label style={filterLabelStyle}>
                            {a === 'alumnos_municipio' ? 'Selecciona el municipio'
                              : a === 'alumnos_etapa' ? 'Selecciona la etapa DGB'
                              : 'Selecciona el gestor'}
                          </label>
                          <select
                            style={selectStyle}
                            value={form.audienciaParam}
                            onChange={e => set('audienciaParam', e.target.value)}
                          >
                            <option value="">
                              {a === 'alumnos_municipio' ? '— Selecciona un municipio —'
                                : a === 'alumnos_etapa' ? '— Selecciona una etapa —'
                                : '— Selecciona un gestor —'}
                            </option>
                            {a === 'alumnos_municipio' && opcionesMunicipios.map(m => (
                              <option key={m.id} value={String(m.id)}>
                                {m.nombre} ({m.alumnosCount} {m.alumnosCount === 1 ? 'alumno' : 'alumnos'})
                              </option>
                            ))}
                            {a === 'alumnos_etapa' && opcionesEtapas.map(et => (
                              <option key={et.id} value={String(et.id)}>
                                {et.nombreCompleto} · {et.inscritosCount} inscritos{et.estado === 'inscripciones_abiertas' ? ' · ACTIVA' : ''}
                              </option>
                            ))}
                            {a === 'gestor_especifico' && opcionesGestores.map(g => (
                              <option key={g.id} value={String(g.id)}>
                                {g.nombreCompleto} · {g.municipioNombre ?? '—'} ({g.alumnosCount} {g.alumnosCount === 1 ? 'alumno' : 'alumnos'})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Estado */}
            <div>
              <label style={labelStyle}>Estado de publicación</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(Object.keys(ESTADO_CFG) as AnuncioEstado[]).map(e => {
                  const cfg = ESTADO_CFG[e];
                  const active = form.estado === e;
                  return (
                    <button key={e} type="button" onClick={() => set('estado', e)}
                      style={{ flex: 1, padding: '8px 12px', border: `1.5px solid ${active ? '#374151' : '#eadfd7'}`, borderRadius: 8, background: active ? cfg.bg : '#fff', color: active ? cfg.color : '#6b635e', fontSize: 12, fontWeight: active ? 700 : 400, cursor: 'pointer' }}>
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CTA */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Texto del botón CTA (opcional)</label>
                <input style={inputStyle} value={form.ctaTexto} onChange={e => set('ctaTexto', e.target.value)} maxLength={80} placeholder="Ej. Ver convocatoria" />
              </div>
              <div>
                <label style={labelStyle}>URL del CTA (opcional)</label>
                <input style={inputStyle} value={form.ctaUrl} onChange={e => set('ctaUrl', e.target.value)} maxLength={500} placeholder="Ej. /estudiante/convocatoria" />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Activo hasta (opcional)</label>
              <input type="datetime-local" style={inputStyle} value={form.activoHasta} onChange={e => set('activoHasta', e.target.value)} />
            </div>

            {err && <div style={{ color: '#be123c', fontSize: 12, padding: '8px 12px', background: '#fff1f2', borderRadius: 6 }}>{err}</div>}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
              <button type="button" onClick={onClose} style={{ padding: '9px 20px', border: '1px solid #eadfd7', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13 }}>
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{ padding: '9px 20px', borderRadius: 8, background: 'var(--color-guinda-700)', color: 'white', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {saving && <Loader2 size={13} className="animate-spin" />}
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </form>

        {/* Live preview */}
        <div style={{ width: 280, borderLeft: '1px solid #f0ece8', background: '#faf9f8', padding: 20, overflowY: 'auto', flexShrink: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b635e', marginBottom: 12 }}>
            Vista previa
          </div>
          <AnuncioCard
            anuncio={{ ...form, id: 0, publicadoEn: null, activoHasta: form.activoHasta || null, createdAt: new Date().toISOString() }}
            preview
            audienciaOverrideLabel={audienciaPreviewLabel()}
          />
          {/* Alcance del anuncio */}
          <div style={{ marginTop: 12, padding: '10px 12px', background: '#fff', border: '1px solid #eadfd7', borderRadius: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a89a8e', marginBottom: 4 }}>Alcance</div>
            <div style={{ fontSize: 12, color: '#443e39', lineHeight: 1.4 }}>
              {needsParam && !form.audienciaParam
                ? <span style={{ color: '#b45309' }}>Selecciona el filtro para ver el alcance</span>
                : audienciaPreviewLabel()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

function AnuncioCard({
  anuncio,
  preview,
  audienciaOverrideLabel,
  onEdit,
  onArchive,
  onUnarchive,
  onDelete,
}: {
  anuncio: Anuncio | (typeof EMPTY_FORM & { id: number; publicadoEn: null; activoHasta: string | null; createdAt: string });
  preview?: boolean;
  audienciaOverrideLabel?: string;
  onEdit?: () => void;
  onArchive?: () => void;
  onUnarchive?: () => void;
  onDelete?: () => void;
}) {
  const pCfg = PRIORIDAD_CFG[anuncio.prioridad];
  const PCfgIcon = pCfg.icon;
  const aCfg = AUDIENCIA_CFG[anuncio.audiencia as AnuncioAudiencia] ?? AUDIENCIA_CFG.todos;
  const ACfgIcon = aCfg.icon;
  const estadoCfg = ESTADO_CFG[(anuncio as Anuncio).estado ?? 'publicado'];

  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${pCfg.border}`,
        borderLeft: `4px solid ${pCfg.color}`,
        borderRadius: 10,
        padding: '14px 16px',
        marginBottom: 12,
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-start gap-2" style={{ flex: 1 }}>
          <PCfgIcon size={14} style={{ color: pCfg.color, flexShrink: 0, marginTop: 2 }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#2a2a2a', lineHeight: 1.35 }}>
            {anuncio.titulo || 'Sin título'}
          </span>
        </div>
        {!preview && (
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: estadoCfg.bg, color: estadoCfg.color, fontWeight: 600, flexShrink: 0 }}>
            {estadoCfg.label}
          </span>
        )}
      </div>

      <p style={{ fontSize: 12, color: '#57504a', lineHeight: 1.5, marginBottom: 10 }}>
        {anuncio.contenido || 'Sin contenido'}
      </p>

      <div className="flex items-center gap-3 flex-wrap" style={{ marginBottom: 8 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#6b635e' }}>
          <ACfgIcon size={11} />
          {audienciaOverrideLabel ?? (
            <>
              {aCfg.label}
              {anuncio.audienciaParam && <span style={{ color: '#a89a8e' }}> ({anuncio.audienciaParam})</span>}
            </>
          )}
        </span>
        <span style={{ fontSize: 11, color: '#a89a8e' }}>
          {fmt((anuncio as Anuncio).publicadoEn ?? anuncio.createdAt)}
        </span>
        {anuncio.activoHasta && (
          <span style={{ fontSize: 11, color: '#d97706' }}>hasta {fmt(anuncio.activoHasta)}</span>
        )}
      </div>

      {anuncio.ctaTexto && (
        <div style={{ marginBottom: 10 }}>
          <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: '#eff6ff', color: '#1d4ed8', fontWeight: 600 }}>
            {anuncio.ctaTexto} →
          </span>
        </div>
      )}

      {!preview && (
        <div className="flex items-center gap-1.5" style={{ borderTop: '1px solid #f0ece8', paddingTop: 10, marginTop: 4 }}>
          <button onClick={onEdit} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '4px 10px', border: '1px solid #eadfd7', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#443e39' }}>
            <Edit2 size={11} /> Editar
          </button>
          {(anuncio as Anuncio).estado !== 'archivado' ? (
            <button onClick={onArchive} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '4px 10px', border: '1px solid #eadfd7', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#443e39' }}>
              <Archive size={11} /> Archivar
            </button>
          ) : (
            <button onClick={onUnarchive} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '4px 10px', border: '1px solid #eadfd7', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#443e39' }}>
              <ArchiveRestore size={11} /> Desarchivar
            </button>
          )}
          <button onClick={onDelete} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '4px 10px', border: '1px solid #fecdd3', borderRadius: 6, background: '#fff1f2', cursor: 'pointer', color: '#be123c', marginLeft: 'auto' }}>
            <Trash2 size={11} /> Eliminar
          </button>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type TabFiltro = 'todos' | 'publicado' | 'borrador' | 'archivado';

export default function AnunciosLista() {
  const [tab, setTab] = useState<TabFiltro>('publicado');
  const [anunciosList, setAnunciosList] = useState<Anuncio[]>([]);
  const [resumen, setResumen] = useState<Resumen>({ total: 0, publicados: 0, borradores: 0, archivados: 0, urgentes: 0 });
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | { form: typeof EMPTY_FORM & { id?: number } }>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  /** Anuncio pendiente de confirmar borrado (sustituye al confirm() del navegador). */
  const [aBorrar, setABorrar] = useState<Anuncio | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<{ anuncios: Anuncio[]; resumen: Resumen }>('/admin/anuncios?estado=todos');
      setAnunciosList(data.anuncios);
      setResumen(data.resumen);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const visible = tab === 'todos' ? anunciosList : anunciosList.filter(a => a.estado === tab);

  async function handleSave(form: typeof EMPTY_FORM, id?: number) {
    if (id) {
      await api.patch(`/admin/anuncios/${id}`, form);
    } else {
      await (api as any).post('/admin/anuncios', form);
    }
    await load();
  }

  async function handleArchive(id: number) {
    setActionLoading(id);
    try { await api.post(`/admin/anuncios/${id}/archivar`); await load(); } catch {}
    setActionLoading(null);
  }

  async function handleUnarchive(id: number) {
    setActionLoading(id);
    try { await api.post(`/admin/anuncios/${id}/desarchivar`); await load(); } catch {}
    setActionLoading(null);
  }

  async function handleDelete(id: number) {
    setActionLoading(id);
    try { await api.delete(`/admin/anuncios/${id}`); await load(); }
    catch (e) { avisar(e instanceof Error ? e.message : 'No se pudo eliminar el anuncio.', 'error'); }
    setActionLoading(null);
  }

  const tabs: { key: TabFiltro; label: string; count: number }[] = [
    { key: 'publicado', label: 'Publicados',  count: resumen.publicados },
    { key: 'borrador',  label: 'Borradores',  count: resumen.borradores },
    { key: 'archivado', label: 'Archivados',  count: resumen.archivados },
    { key: 'todos',     label: 'Todos',       count: resumen.total },
  ];

  return (
    <AdminLayout>
      <div style={{ maxWidth: 860 }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#efe7d6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Megaphone size={20} style={{ color: 'var(--color-guinda-700)' }} />
            </div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: '#2a2a2a', margin: 0 }}>Anuncios</h1>
              <p style={{ fontSize: 12, color: '#6b635e', margin: 0 }}>Comunicados institucionales para alumnos y gestores</p>
            </div>
          </div>
          <button
            data-tour="a-anun-nuevo"
            onClick={() => setModal({ form: { ...EMPTY_FORM } })}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: 'var(--color-guinda-700)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            <Plus size={14} /> Nuevo anuncio
          </button>
        </div>

        {/* Stats grid */}
        <div data-tour="a-anun-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Publicados',  value: resumen.publicados, color: '#16a34a', bg: '#f0fdf4' },
            { label: 'Urgentes',    value: resumen.urgentes,   color: '#be123c', bg: '#fff1f2' },
            { label: 'Borradores',  value: resumen.borradores, color: '#6b7280', bg: '#f3f4f6' },
            { label: 'Archivados',  value: resumen.archivados, color: '#94a3b8', bg: '#f8fafc' },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.color}22`, borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#6b635e', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div data-tour="a-anun-tabs" style={{ display: 'flex', gap: 4, marginBottom: 16, background: '#f0ece8', borderRadius: 8, padding: 4 }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flex: 1, padding: '7px 12px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: tab === t.key ? '#fff' : 'transparent',
                color: tab === t.key ? '#2a2a2a' : '#6b635e',
                boxShadow: tab === t.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              {t.label} {t.count > 0 && <span style={{ opacity: 0.6 }}>({t.count})</span>}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center" style={{ padding: 60 }}>
            <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-guinda-700)' }} />
          </div>
        ) : visible.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#6b635e' }}>
            <Megaphone size={40} style={{ opacity: 0.25, margin: '0 auto 12px' }} />
            <p style={{ fontWeight: 600 }}>No hay anuncios en esta categoría</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>Crea uno con el botón "Nuevo anuncio"</p>
          </div>
        ) : (
          <div>
            {visible.map(a => (
              <div key={a.id} style={{ opacity: actionLoading === a.id ? 0.5 : 1 }}>
                <AnuncioCard
                  anuncio={a}
                  onEdit={() => setModal({ form: { id: a.id, titulo: a.titulo, contenido: a.contenido, prioridad: a.prioridad, audiencia: a.audiencia, audienciaParam: a.audienciaParam ?? '', estado: a.estado, ctaTexto: a.ctaTexto ?? '', ctaUrl: a.ctaUrl ?? '', activoHasta: a.activoHasta ? new Date(a.activoHasta).toISOString().slice(0, 16) : '' } })}
                  onArchive={() => handleArchive(a.id)}
                  onUnarchive={() => handleUnarchive(a.id)}
                  onDelete={() => setABorrar(a)}
                />
              </div>
            ))}
          </div>
        )}

        {/* Modal */}
        {modal && (
          <ModalAnuncio
            initial={modal.form}
            onClose={() => setModal(null)}
            onSave={form => handleSave(form, modal.form.id)}
          />
        )}
      </div>

      <SectionTour
        steps={TOUR_A_ANUNCIOS}
        storageKey="modula_sec_a_anuncios_v1"
        gateKey={GATE_ADMIN}
        buttonLabel="Tutorial de anuncios"
      />

      {aBorrar && (
        <ConfirmModal
          icon={<Trash2 size={18} />}
          danger
          title="Eliminar anuncio"
          message={<>¿Eliminar «<strong>{aBorrar.titulo}</strong>»? Esta acción no se puede deshacer.</>}
          confirmLabel="Eliminar"
          onConfirm={() => { const id = aBorrar.id; setABorrar(null); handleDelete(id); }}
          onClose={() => setABorrar(null)}
        />
      )}
    </AdminLayout>
  );
}
