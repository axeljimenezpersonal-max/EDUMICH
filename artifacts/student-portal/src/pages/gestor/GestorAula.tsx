/**
 * Aula virtual del gestor (estilo Canvas / Tec de Monterrey), integrada DENTRO
 * del panel del gestor. La home del aula es el grid de "mis módulos de clase".
 * Al entrar a un módulo aparece un mini-portal a la izquierda —Foro (landing,
 * donde el profesor publica avisos destacados y encuestas), Tareas, Materiales,
 * Videos— todo scoped a ESE módulo. Solo si el aula está habilitada.
 */
import { useEffect, useRef, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { GestorLayout } from './GestorLayout';
import { ForoAula } from '../../components/ForoAula';
import {
  School, ClipboardList, BookOpen, Plus, Trash2, Users, Link2, FileText,
  Loader2, CalendarClock, LayoutDashboard, Video, PlayCircle, CheckCircle2, ChevronRight,
  Inbox, MessageCircle, X, Clock, Download, Paperclip, GraduationCap, Lock, ChevronLeft, Eye, EyeOff,
} from 'lucide-react';
import { api } from '../../lib/api';
import { parseDbDate, fechaCorta, fechaHoraCorta, fechaVentana } from '../../lib/fechas';
import { ytEmbed, VideoFrame } from '../../components/VideoEmbed';
import { TextoRico, AreaConFormato } from '../../components/TextoRico';

interface Tarea {
  id: number; titulo: string; instrucciones: string | null; fechaEntrega: string | null;
  abreEn: string | null; cierraEn: string | null; archivoNombre: string | null;
  moduloId: number | null; moduloNumero: number | null; moduloNombre: string | null;
  publicada: boolean; createdAt: string; entregas: number;
}
interface ModuloGrupo { moduloId: number; numero: number; nombre: string; alumnos: number }
interface ModulosGrupo { convocatoria: string | null; enCurso: ModuloGrupo[]; todos: { id: number; numero: number; nombre: string }[] }
interface Material { id: number; moduloId: number | null; titulo: string; descripcion: string | null; tipo: string; url: string | null; contenido: string | null; archivoNombre: string | null; createdAt: string }
interface Entrega { id: number; alumno: string; estado: string; comentario: string | null; archivoNombre: string | null; entregada_en: string }
interface Resumen { tareas: number; materiales: number; foro: number; alumnos: number }

const G = 'var(--color-guinda-700)';
// Tiempos SIEMPRE vía lib/fechas: la BD guarda UTC sin zona (ver parseDbDate).
function fecha(s: string | null) { return s ? fechaCorta(s) : '—'; }
const fechaHora = fechaHoraCorta;
const inputCls = 'w-full text-sm border border-stone-300 rounded-lg px-3 py-2 focus:border-[var(--color-guinda-500)] focus:outline-none';

export default function GestorAula() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const moduloParam = new URLSearchParams(search).get('modulo');
  const moduloId = moduloParam ? Number(moduloParam) : null;
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [habilitada, setHabilitada] = useState<boolean | null>(null);
  const cargarResumen = () => api.get<Resumen>('/aula/gestor/resumen').then(setResumen).catch(() => {});
  useEffect(() => {
    api.get<{ habilitada: boolean }>('/aula/estado')
      .then((r) => { setHabilitada(!!r.habilitada); if (r.habilitada) cargarResumen(); })
      .catch(() => setHabilitada(false));
  }, []);

  if (habilitada === false) {
    return <GestorLayout><AulaNoContratada /></GestorLayout>;
  }

  // Dentro de un módulo: mini-portal (Foro · Tareas · Materiales · Videos).
  if (moduloId != null) {
    return (
      <GestorLayout>
        <ModuloDetalleGestor moduloId={moduloId} volver={() => setLocation('/gestor/aula')} />
      </GestorLayout>
    );
  }

  return (
    <GestorLayout>
      {/* Banner tipo curso */}
      <div className="rounded-2xl overflow-hidden mb-5 shadow-[0_10px_30px_-16px_rgba(74,14,32,0.55)]"
        style={{ background: 'linear-gradient(120deg, var(--color-guinda-800) 0%, var(--color-guinda-600) 60%, #7a1f3d 100%)' }}>
        <div className="relative px-6 py-6 text-white">
          <div className="absolute -right-8 -top-10 w-44 h-44 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <div className="absolute right-16 -bottom-14 w-40 h-40 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }} />
          <div className="relative flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}><School size={24} /></div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">Aula virtual · tu centro</div>
              <h1 className="font-serif text-2xl font-bold leading-tight">Tablero del aula</h1>
            </div>
          </div>
          {resumen && (
            <div className="relative flex flex-wrap gap-2.5 mt-4">
              {[
                { l: 'Alumnos', v: resumen.alumnos, icon: Users },
                { l: 'Tareas', v: resumen.tareas, icon: ClipboardList },
                { l: 'Materiales', v: resumen.materiales, icon: BookOpen },
                { l: 'Mensajes', v: resumen.foro, icon: MessageCircle },
              ].map((c) => (
                <div key={c.l} className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm" style={{ background: 'rgba(255,255,255,0.13)' }}>
                  <c.icon size={14} className="text-white/80" /> <b>{c.v}</b> <span className="text-white/70">{c.l}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ResumenSec abrirModulo={(id) => setLocation(`/gestor/aula?modulo=${id}`)} />
    </GestorLayout>
  );
}

/** Pantalla cuando el centro (gestor) aún no tiene contratada el Aula Virtual. */
function AulaNoContratada() {
  const beneficios = [
    { icon: MessageCircle, t: 'Foro del grupo', d: 'Chat con anuncios destacados y encuestas.' },
    { icon: ClipboardList, t: 'Tareas', d: 'Asignaciones por módulo con entrega de archivos.' },
    { icon: BookOpen, t: 'Materiales', d: 'Lecturas, PDFs y enlaces para tus alumnos.' },
    { icon: Video, t: 'Videos', d: 'Clases y repasos incrustados.' },
  ];
  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className="relative px-6 py-10 sm:px-10 text-center overflow-hidden" style={{ background: 'linear-gradient(120deg, var(--color-guinda-800) 0%, var(--color-guinda-600) 60%, #7a1f3d 100%)' }}>
        <div className="absolute -right-8 -top-10 w-44 h-44 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <div className="absolute left-10 -bottom-12 w-36 h-36 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }} />
        <div className="relative">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <School size={30} className="text-white" />
          </div>
          <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/70">Beneficio adicional</div>
          <h1 className="mt-1 font-serif text-3xl font-bold text-white">Aula Virtual</h1>
          <p className="mx-auto mt-2 max-w-lg text-sm text-white/85">
            Convierte tu centro en un salón en línea tipo Canvas: imparte clase híbrida o remota con foro,
            tareas, materiales y videos para tus alumnos.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-6">
        {beneficios.map((b) => (
          <div key={b.t} className="flex items-start gap-3 rounded-xl border border-stone-200 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-crema-100)]" style={{ color: G }}><b.icon size={17} /></div>
            <div><div className="font-semibold text-stone-900">{b.t}</div><div className="text-xs text-stone-500">{b.d}</div></div>
          </div>
        ))}
      </div>
      <div className="border-t border-stone-100 px-6 py-5 text-center">
        <div className="inline-flex flex-col items-center gap-1.5 rounded-xl px-5 py-4" style={{ background: 'var(--color-crema-50, #fdfaf5)' }}>
          <Lock size={18} style={{ color: G }} />
          <div className="text-sm font-bold text-stone-900">Tu centro aún no tiene activada esta función</div>
          <div className="text-xs text-stone-600 max-w-sm">
            Comunícate con la <b>Secretaría (IEMSyS)</b> para adquirir el Aula Virtual y activarla en tu centro de asesoría.
          </div>
        </div>
      </div>
    </div>
  );
}

function SecHeader({ icon: Icon, titulo, sub }: { icon: typeof LayoutDashboard; titulo: string; sub: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 text-lg font-bold text-stone-900"><Icon size={18} style={{ color: G }} /> {titulo}</div>
      <div className="text-xs text-stone-500 mt-0.5">{sub}</div>
    </div>
  );
}
function Vacio({ icon: Icon, texto }: { icon: typeof Inbox; texto: string }) {
  return <div className="border-2 border-dashed border-stone-200 rounded-xl p-10 text-center"><Icon size={26} className="mx-auto mb-2 text-stone-300" /><div className="text-sm text-stone-400">{texto}</div></div>;
}
function BtnCrear({ label, on, toggle }: { label: string; on: boolean; toggle: () => void }) {
  return <button onClick={toggle} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg text-white transition-transform hover:-translate-y-0.5 shrink-0" style={{ background: G }}>{on ? <X size={15} /> : <Plus size={15} />} {on ? 'Cerrar' : label}</button>;
}

// ── Resumen ──
interface ModuloClase { moduloId: number; numero: number; nombre: string; tareas: number; materiales: number; videos: number; alumnos: number }
const MOD_COLORS = ['#6b1e3a', '#0d9488', '#4338ca', '#b45309', '#0369a1', '#9d174d', '#4d7c0f', '#7c3aed', '#be123c', '#0f766e'];
const colorModulo = (n: number) => MOD_COLORS[Math.abs(n) % MOD_COLORS.length];

/** Home del aula del gestor: sus módulos de clase (Canvas) + administración. */
function ResumenSec({ abrirModulo }: { abrirModulo: (id: number) => void }) {
  const [mods, setMods] = useState<ModuloClase[]>([]);
  const [grupo, setGrupo] = useState<ModulosGrupo | null>(null);
  const [admin, setAdmin] = useState(false);
  const cargar = () => api.get<{ modulos: ModuloClase[] }>('/aula/gestor/modulos-clase').then((r) => setMods(r.modulos)).catch(() => {});
  useEffect(() => { cargar(); api.get<ModulosGrupo>('/aula/gestor/modulos-grupo').then(setGrupo).catch(() => {}); }, []);

  async function agregar(moduloId: number) { const r = await api.post<{ modulos: ModuloClase[] }>('/aula/gestor/modulos-clase', { moduloId }); setMods(r.modulos); }
  async function quitar(moduloId: number) { if (!confirm('¿Quitar este módulo del aula? El contenido no se borra, pero deja de mostrarse como clase.')) return; const r = await api.delete<{ modulos: ModuloClase[] }>(`/aula/gestor/modulos-clase/${moduloId}`); setMods(r.modulos); }

  const yaTiene = new Set(mods.map((m) => m.moduloId));
  const disponibles = (grupo?.todos ?? []).filter((m) => !yaTiene.has(m.id));
  const enCursoIds = new Set((grupo?.enCurso ?? []).map((m) => m.moduloId));

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <SecHeader icon={GraduationCap} titulo="Mis módulos de clase" sub="Organiza tu aula por módulo, como en Canvas. Elige qué módulos impartes y publica su contenido." />
        <button onClick={() => setAdmin((v) => !v)} className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg text-white transition-transform hover:-translate-y-0.5" style={{ background: G }}>
          {admin ? <X size={15} /> : <Plus size={15} />} {admin ? 'Cerrar' : 'Administrar módulos'}
        </button>
      </div>

      {/* Panel de administración: agregar/quitar módulos */}
      {admin && (
        <div className="bg-white border border-stone-200 rounded-xl p-4 mb-4">
          <div className="text-xs font-bold uppercase tracking-wide text-stone-500 mb-2">Agregar un módulo a tu aula</div>
          {disponibles.length === 0 ? (
            <div className="text-sm text-stone-400">Ya agregaste todos los módulos del plan.</div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {disponibles.map((m) => (
                <button key={m.id} onClick={() => agregar(m.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-semibold text-stone-700 hover:border-[var(--color-guinda-500)] hover:bg-stone-50">
                  <Plus size={12} style={{ color: G }} /> <b>M{m.numero}</b> <span className="max-w-[160px] truncate">{m.nombre}</span>
                  {enCursoIds.has(m.id) && <span className="rounded-full bg-[var(--color-crema-100)] px-1.5 text-[9px] font-bold" style={{ color: G }}>en curso</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {mods.length === 0 ? (
        <Vacio icon={GraduationCap} texto="Aún no has agregado módulos. Toca “Administrar módulos” para empezar a armar tu clase." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {mods.map((m) => {
            const col = colorModulo(m.numero);
            return (
              <div key={m.moduloId} className="bg-white border border-stone-200 rounded-2xl overflow-hidden group">
                <button onClick={() => abrirModulo(m.moduloId)} className="block w-full text-left">
                  <div className="relative h-24 overflow-hidden" style={{ background: `linear-gradient(135deg, ${col} 0%, ${col}cc 100%)` }}>
                    <div className="absolute -right-4 -top-6 w-24 h-24 rounded-full" style={{ background: 'rgba(255,255,255,0.10)' }} />
                    <div className="relative px-4 pt-3 flex items-start justify-between">
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">Módulo {m.numero}</div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold" style={{ color: col }}><Users size={10} /> {m.alumnos}</span>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="font-serif text-base font-bold text-stone-900 leading-tight line-clamp-2 min-h-[2.6em]">M{m.numero} — {m.nombre}</div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-stone-500">
                      <span className="inline-flex items-center gap-1"><ClipboardList size={12} /> {m.tareas}</span>
                      <span className="inline-flex items-center gap-1"><BookOpen size={12} /> {m.materiales}</span>
                      <span className="inline-flex items-center gap-1"><Video size={12} /> {m.videos}</span>
                    </div>
                  </div>
                </button>
                <div className="flex items-center justify-between border-t border-stone-100 px-4 py-2">
                  <button onClick={() => abrirModulo(m.moduloId)} className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: col }}>Abrir módulo <ChevronRight size={13} /></button>
                  <button onClick={() => quitar(m.moduloId)} className="text-stone-300 hover:text-red-500" aria-label="Quitar módulo"><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

type TabModulo = 'foro' | 'tareas' | 'materiales' | 'videos';
const TABS_MODULO: TabModulo[] = ['foro', 'tareas', 'materiales', 'videos'];

/** Detalle de un módulo para el gestor: mini-portal a la izquierda (Foro ·
 *  Tareas · Materiales · Videos), todo scoped al módulo. El Foro es la portada:
 *  ahí el profesor publica avisos destacados y encuestas para la clase. */
function ModuloDetalleGestor({ moduloId, volver }: { moduloId: number; volver: () => void }) {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const tabParam = new URLSearchParams(search).get('tab');
  const tab: TabModulo = TABS_MODULO.includes(tabParam as TabModulo) ? (tabParam as TabModulo) : 'foro';
  const setTab = (t: TabModulo) => setLocation(`/gestor/aula?modulo=${moduloId}${t === 'foro' ? '' : `&tab=${t}`}`);

  const [info, setInfo] = useState<{ modulo: { id: number; numero: number; nombre: string }; totalAlumnos: number; tareas: unknown[]; materiales: unknown[]; videos: unknown[] } | null>(null);
  const cargarInfo = () => api.get<typeof info>(`/aula/gestor/modulo/${moduloId}`).then((r) => setInfo(r)).catch(() => {});
  useEffect(() => { setInfo(null); cargarInfo(); }, [moduloId]);

  if (!info) return <div className="h-40 rounded-xl animate-pulse bg-stone-100" />;
  const col = colorModulo(info.modulo.numero);

  const NAV_ITEMS: { k: TabModulo; label: string; icon: typeof MessageCircle; n?: number }[] = [
    { k: 'foro', label: 'Foro', icon: MessageCircle },
    { k: 'tareas', label: 'Tareas', icon: ClipboardList, n: info.tareas.length },
    { k: 'materiales', label: 'Materiales', icon: BookOpen, n: info.materiales.length },
    { k: 'videos', label: 'Videos', icon: Video, n: info.videos.length },
  ];

  return (
    <div>
      <button onClick={volver} className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-[var(--color-guinda-700)]"><ChevronLeft size={14} /> Volver a mis módulos</button>
      {/* Portada del módulo */}
      <div className="rounded-2xl overflow-hidden mb-4 relative" style={{ background: `linear-gradient(135deg, ${col} 0%, ${col}cc 100%)` }}>
        <div className="absolute -right-6 -top-8 w-32 h-32 rounded-full" style={{ background: 'rgba(255,255,255,0.10)' }} />
        <div className="relative px-6 py-5 text-white flex items-center justify-between gap-3">
          <div className="min-w-0"><div className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">Módulo de clase</div><h1 className="font-serif text-2xl font-bold leading-tight">M{info.modulo.numero} — {info.modulo.nombre}</h1></div>
          <span className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm text-white"><Users size={14} /> {info.totalAlumnos} alumno{info.totalAlumnos === 1 ? '' : 's'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4">
        {/* Mini portal a la izquierda */}
        <nav className="md:sticky md:top-[114px] self-start">
          <div className="bg-white border border-stone-200 rounded-md overflow-hidden">
            <ul>
              {NAV_ITEMS.map((item) => {
                const active = tab === item.k;
                return (
                  <li key={item.k}>
                    <button onClick={() => setTab(item.k)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm border-l-4 transition-colors"
                      style={active ? { background: `${col}14`, borderColor: col, color: col, fontWeight: 600 } : { borderColor: 'transparent', color: '#44403c' }}>
                      <item.icon size={16} />
                      <span className="flex-1 text-left">{item.label}</span>
                      {typeof item.n === 'number' && item.n > 0 && (
                        <span className="text-[10px] font-bold rounded-full px-1.5 py-0.5" style={{ background: active ? col : '#f0f0ee', color: active ? '#fff' : '#78716c' }}>{item.n}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        {/* Contenido del tab (formularios y listas scoped al módulo) */}
        <main className="min-w-0">
          {tab === 'foro' && <ForoAula moduloId={moduloId} compacto hrefTareas={`/gestor/aula?modulo=${moduloId}&tab=tareas`} />}
          {tab === 'tareas' && <TareasTab moduloId={moduloId} onChange={cargarInfo} />}
          {tab === 'materiales' && <MaterialesTab modo="materiales" moduloId={moduloId} onChange={cargarInfo} />}
          {tab === 'videos' && <MaterialesTab modo="videos" moduloId={moduloId} onChange={cargarInfo} />}
        </main>
      </div>
    </div>
  );
}

// ── Tareas ──
/** Estado de una tarea según su ventana de disponibilidad (tiempos en UTC de la BD). */
function estadoVentana(t: { abreEn: string | null; cierraEn: string | null }): 'programada' | 'abierta' | 'cerrada' {
  const ahora = Date.now();
  if (t.abreEn && parseDbDate(t.abreEn).getTime() > ahora) return 'programada';
  if (t.cierraEn && parseDbDate(t.cierraEn).getTime() < ahora) return 'cerrada';
  return 'abierta';
}

function TareasTab({ onChange, moduloId }: { onChange: () => void; moduloId?: number }) {
  const [items, setItems] = useState<Tarea[]>([]);
  const [totalAlumnos, setTotalAlumnos] = useState(0);
  const [grupo, setGrupo] = useState<ModulosGrupo | null>(null);
  const [form, setForm] = useState(false);
  const [t, setT] = useState({ titulo: '', instrucciones: '', moduloId: '', abreEn: '', cierraEn: '' });
  // Modo de fechas: "todo el día" (por defecto) usa solo fechas — abre a las
  // 00:00 y cierra a las 23:59 del día elegido. Con hora usa datetime-local.
  const [conHora, setConHora] = useState(false);
  const [documento, setDocumento] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [entregasDe, setEntregasDe] = useState<number | null>(null);
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const docRef = useRef<HTMLInputElement>(null);
  const cargar = () => api.get<{ tareas: Tarea[]; totalAlumnos: number }>(`/aula/gestor/tareas${moduloId ? `?moduloId=${moduloId}` : ''}`).then((r) => { setItems(r.tareas); setTotalAlumnos(r.totalAlumnos); }).catch(() => {});
  useEffect(() => { cargar(); if (!moduloId) api.get<ModulosGrupo>('/aula/gestor/modulos-grupo').then(setGrupo).catch(() => {}); }, [moduloId]);

  const puedePublicar = !!t.titulo.trim() && !!t.instrucciones.trim();
  async function crear() {
    if (!puedePublicar) return;
    setSaving(true); setErr('');
    try {
      const fd = new FormData();
      fd.append('titulo', t.titulo); fd.append('instrucciones', t.instrucciones);
      // Dentro de un módulo la tarea SIEMPRE pertenece a ese módulo.
      const mid = moduloId ? String(moduloId) : t.moduloId;
      if (mid) fd.append('moduloId', mid);
      // Todo-el-día: abre a las 00:00 y cierra a las 23:59 del día elegido.
      if (t.abreEn) fd.append('abreEn', new Date(conHora ? t.abreEn : `${t.abreEn}T00:00:00`).toISOString());
      if (t.cierraEn) {
        fd.append('cierraEn', new Date(conHora ? t.cierraEn : `${t.cierraEn}T23:59:00`).toISOString());
        // La fecha de entrega ES el día del cierre (campo derivado, ya sin input propio).
        fd.append('fechaEntrega', t.cierraEn.slice(0, 10));
      }
      if (documento) fd.append('documento', documento);
      await api.post('/aula/gestor/tareas', fd);
      setT({ titulo: '', instrucciones: '', moduloId: '', abreEn: '', cierraEn: '' });
      setDocumento(null); if (docRef.current) docRef.current.value = '';
      setForm(false); cargar(); onChange();
    } catch (e) { setErr(e instanceof Error ? e.message : 'No se pudo publicar.'); }
    finally { setSaving(false); }
  }
  async function borrar(id: number) { if (!confirm('¿Eliminar esta tarea?')) return; await api.delete(`/aula/gestor/tareas/${id}`); cargar(); onChange(); }
  async function verEntregas(id: number) { if (entregasDe === id) { setEntregasDe(null); return; } const r = await api.get<{ entregas: Entrega[] }>(`/aula/gestor/tareas/${id}/entregas`); setEntregas(r.entregas); setEntregasDe(id); }
  async function togglePublicada(id: number) {
    await api.patch(`/aula/gestor/tareas/${id}/publicar`, {});
    cargar();
  }

  const lblCls = 'text-xs font-semibold text-stone-500 block mb-1';

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-4">
        <SecHeader icon={ClipboardList} titulo="Tareas" sub={moduloId ? 'Asignaciones de este módulo, con documento, apertura, cierre y fecha límite.' : 'Asignaciones por módulo, con documento, apertura, cierre y fecha límite.'} />
        <BtnCrear label="Nueva tarea" on={form} toggle={() => setForm((v) => !v)} />
      </div>

      {/* Módulos que cursa el grupo esta convocatoria */}
      {!moduloId && grupo && grupo.enCurso.length > 0 && (
        <div className="mb-4 rounded-xl border border-stone-200 bg-white p-3.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-stone-700 mb-2">
            <GraduationCap size={14} style={{ color: G }} />
            Tu grupo este periodo{grupo.convocatoria ? ` · ${grupo.convocatoria}` : ''}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {grupo.enCurso.map((m) => (
              <span key={m.moduloId} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs" style={{ background: 'var(--color-crema-100)' }}>
                <b style={{ color: G }}>M{m.numero}</b>
                <span className="text-stone-700">{m.nombre}</span>
                <span className="rounded-full px-1.5 text-[10px] font-bold text-white" style={{ background: G }}>{m.alumnos} alumno{m.alumnos === 1 ? '' : 's'}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {form && (
        <div className="bg-white border border-stone-200 rounded-xl p-5 mb-4 space-y-3.5">
          <div>
            <label className={lblCls}>Título *</label>
            <input className={inputCls} placeholder="Ej. Ensayo: La sociedad mexicana" value={t.titulo} onChange={(e) => setT((s) => ({ ...s, titulo: e.target.value }))} />
          </div>
          <div>
            <label className={lblCls}>Instrucciones * <span className="font-normal text-stone-400">(qué debe hacer y entregar el alumno)</span></label>
            <AreaConFormato value={t.instrucciones} onChange={(v) => setT((s) => ({ ...s, instrucciones: v }))} rows={4}
              placeholder="Describe la actividad, criterios de evaluación y formato de entrega…" />
          </div>
          {!moduloId && (
          <div>
            <label className={lblCls}>Módulo</label>
            <select className={inputCls} value={t.moduloId} onChange={(e) => setT((s) => ({ ...s, moduloId: e.target.value }))}>
              <option value="">General (todo el grupo, sin módulo)</option>
              {grupo?.enCurso.length ? (
                <optgroup label={`En curso${grupo.convocatoria ? ` — ${grupo.convocatoria}` : ''}`}>
                  {grupo.enCurso.map((m) => <option key={m.moduloId} value={m.moduloId}>M{m.numero} · {m.nombre} ({m.alumnos} alumno{m.alumnos === 1 ? '' : 's'})</option>)}
                </optgroup>
              ) : null}
              <optgroup label="Todos los módulos del plan">
                {grupo?.todos.map((m) => <option key={m.id} value={m.id}>M{m.numero} · {m.nombre}</option>)}
              </optgroup>
            </select>
          </div>
          )}
          <div>
            <label className={lblCls}>Documento de apoyo <span className="font-normal text-stone-400">(actividad, rúbrica, lectura… opcional)</span></label>
            <input ref={docRef} type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" className="hidden" onChange={(e) => setDocumento(e.target.files?.[0] ?? null)} />
            {documento ? (
              <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                <FileText size={16} style={{ color: G }} />
                <span className="min-w-0 flex-1 truncate text-xs text-stone-600">{documento.name}</span>
                <button onClick={() => { setDocumento(null); if (docRef.current) docRef.current.value = ''; }} className="text-stone-400 hover:text-red-500" aria-label="Quitar documento"><X size={15} /></button>
              </div>
            ) : (
              <button onClick={() => docRef.current?.click()} className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-stone-300 rounded-lg px-3 py-3 text-sm text-stone-500 hover:border-[var(--color-guinda-500)] hover:text-[var(--color-guinda-700)] transition-colors">
                <Paperclip size={15} /> Adjuntar documento (máx. 15 MB)
              </button>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={lblCls + ' !mb-0'}>Disponibilidad <span className="font-normal text-stone-400">(opcional)</span></label>
              <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-stone-500 cursor-pointer">
                <input type="checkbox" checked={conHora} onChange={(e) => { setConHora(e.target.checked); setT((s) => ({ ...s, abreEn: '', cierraEn: '' })); }} className="accent-[var(--color-guinda-700)]" />
                Especificar hora
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={lblCls}>Abre {!conHora && <span className="font-normal text-stone-400">(desde las 12:00 a.m.)</span>}</label>
                <input type={conHora ? 'datetime-local' : 'date'} className={inputCls} value={t.abreEn} onChange={(e) => setT((s) => ({ ...s, abreEn: e.target.value }))} />
              </div>
              <div>
                <label className={lblCls}>Cierra — fecha límite de entrega {!conHora && <span className="font-normal text-stone-400">(hasta las 11:59 p.m.)</span>}</label>
                <input type={conHora ? 'datetime-local' : 'date'} className={inputCls} value={t.cierraEn} onChange={(e) => setT((s) => ({ ...s, cierraEn: e.target.value }))} />
              </div>
            </div>
            <div className="text-[11px] text-stone-400 mt-1">El día del cierre es la fecha límite: hasta entonces pueden entregar los alumnos.</div>
          </div>
          {t.abreEn && t.cierraEn && new Date(conHora ? t.cierraEn : `${t.cierraEn}T23:59:00`) <= new Date(conHora ? t.abreEn : `${t.abreEn}T00:00:00`) && <div className="text-xs font-semibold text-red-600">El cierre debe ser después de la apertura.</div>}
          {err && <div className="text-xs font-semibold text-red-600">{err}</div>}
          <button onClick={crear} disabled={saving || !puedePublicar} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-40" style={{ background: G }}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Publicar tarea</button>
        </div>
      )}
      {items.length === 0 ? <Vacio icon={ClipboardList} texto="Aún no has publicado tareas." /> : (
        <div className="space-y-2.5">
          {items.map((it) => {
            const pct = totalAlumnos > 0 ? Math.round((it.entregas / totalAlumnos) * 100) : 0;
            const estado = estadoVentana(it);
            return (
            <div key={it.id} className={`bg-white border rounded-xl p-4 ${it.publicada ? 'border-stone-200' : 'border-dashed border-stone-300 opacity-75'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-stone-900">{it.titulo}</span>
                    {!moduloId && it.moduloNumero != null && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded text-white" style={{ background: G }} title={it.moduloNombre ?? ''}>M{it.moduloNumero}</span>}
                    {!it.publicada && <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: '#f5f5f4', color: '#78716c' }}><EyeOff size={9} /> Oculta para alumnos</span>}
                    {estado === 'cerrada' && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: '#fee2e2', color: '#991b1b' }}>Cerrada</span>}
                  </div>
                  {!moduloId && it.moduloNombre && <div className="text-[11px] text-stone-400 mt-0.5">Módulo {it.moduloNumero}: {it.moduloNombre}</div>}
                  {it.instrucciones && <TextoRico texto={it.instrucciones} className="text-sm text-stone-600 mt-0.5 space-y-0.5" />}
                  {it.archivoNombre && (
                    <a href={`/api/aula/tareas/${it.id}/documento`} className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: G }}>
                      <FileText size={13} /> {it.archivoNombre}
                    </a>
                  )}
                  {/* Fechas GRANDES y claras, con día de la semana */}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {it.abreEn && estado === 'programada' && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold" style={{ background: '#fef3c7', color: '#92400e' }}>
                        <Clock size={12} /> Abre el {fechaVentana(it.abreEn, 'abre')}
                      </span>
                    )}
                    {it.cierraEn && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold" style={estado === 'cerrada' ? { background: '#fee2e2', color: '#991b1b' } : { background: 'var(--color-crema-100)', color: 'var(--color-guinda-800)' }}>
                        <CalendarClock size={12} /> {estado === 'cerrada' ? 'Cerró' : 'Cierra'} el {fechaVentana(it.cierraEn, 'cierra')}
                      </span>
                    )}
                    {!it.cierraEn && it.fechaEntrega && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold" style={{ background: 'var(--color-crema-100)', color: 'var(--color-guinda-800)' }}>
                        <CalendarClock size={12} /> Entrega: {fecha(it.fechaEntrega)}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-stone-500">
                    <button onClick={() => verEntregas(it.id)} className="inline-flex items-center gap-1 font-semibold" style={{ color: G }}><Users size={12} /> {it.entregas}/{totalAlumnos} entregaron {entregasDe === it.id ? '▴' : '▾'}</button>
                  </div>
                  {/* Barra de progreso de entregas */}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 max-w-[240px] rounded-full bg-stone-100 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct >= 100 ? '#16a34a' : G }} />
                    </div>
                    <span className="text-[10px] font-bold text-stone-400">{pct}%</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => togglePublicada(it.id)}
                    className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 hover:text-[var(--color-guinda-700)]"
                    title={it.publicada ? 'Ocultar a los alumnos (deja de verse en su aula)' : 'Mostrar a los alumnos'}
                    aria-label={it.publicada ? 'Ocultar tarea' : 'Mostrar tarea'}>
                    {it.publicada ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                  <button onClick={() => borrar(it.id)} className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 hover:text-red-500" aria-label="Eliminar tarea"><Trash2 size={15} /></button>
                </div>
              </div>
              {entregasDe === it.id && (
                <div className="mt-3 border-t border-stone-100 pt-3">
                  {entregas.length === 0 ? <div className="text-xs text-stone-400">Nadie ha entregado aún.</div> : (
                    <div className="space-y-2">{entregas.map((e) => (
                      <div key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-600 rounded-lg bg-stone-50 px-3 py-2">
                        <CheckCircle2 size={13} className="text-green-600 shrink-0" />
                        <b className="text-stone-800">{e.alumno}</b>
                        <span className="text-stone-400">{fechaHora(e.entregada_en)}</span>
                        {e.comentario && <span className="w-full sm:w-auto italic text-stone-500">"{e.comentario}"</span>}
                        {e.archivoNombre && (
                          <a href={`/api/aula/gestor/entregas/${e.id}/archivo`} className="inline-flex items-center gap-1 font-semibold" style={{ color: G }}>
                            <Download size={12} /> {e.archivoNombre}
                          </a>
                        )}
                      </div>
                    ))}</div>
                  )}
                </div>
              )}
            </div>
          ); })}
        </div>
      )}
    </div>
  );
}

// ── Materiales / Videos (mismo backend, distinto tipo) ──
function MaterialesTab({ modo, onChange, moduloId }: { modo: 'materiales' | 'videos'; onChange: () => void; moduloId?: number }) {
  const esVideo = modo === 'videos';
  const [items, setItems] = useState<Material[]>([]);
  const [form, setForm] = useState(false);
  const [m, setM] = useState({ titulo: '', descripcion: '', tipo: (esVideo ? 'video' : 'enlace') as 'enlace' | 'texto' | 'video' | 'archivo', url: '', contenido: '', moduloId: '' });
  const [archivo, setArchivo] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [modulos, setModulos] = useState<ModuloClase[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const cargar = () => api.get<{ materiales: Material[] }>('/aula/gestor/materiales').then((r) => setItems(r.materiales)).catch(() => {});
  useEffect(() => { cargar(); if (!moduloId) api.get<{ modulos: ModuloClase[] }>('/aula/gestor/modulos-clase').then((r) => setModulos(r.modulos)).catch(() => {}); }, [moduloId]);
  const visibles = items
    .filter((x) => (esVideo ? x.tipo === 'video' : x.tipo !== 'video'))
    .filter((x) => (moduloId ? x.moduloId === moduloId : true));
  async function crear() {
    if (!m.titulo.trim()) return;
    setSaving(true); setErr('');
    try {
      const fd = new FormData();
      fd.append('titulo', m.titulo); fd.append('descripcion', m.descripcion); fd.append('tipo', m.tipo);
      fd.append('url', m.url); fd.append('contenido', m.contenido);
      // Dentro de un módulo el material SIEMPRE pertenece a ese módulo.
      const mid = moduloId ? String(moduloId) : m.moduloId;
      if (mid) fd.append('moduloId', mid);
      if (m.tipo === 'archivo' && archivo) fd.append('archivo', archivo);
      await api.post('/aula/gestor/materiales', fd);
      setM({ titulo: '', descripcion: '', tipo: esVideo ? 'video' : 'enlace', url: '', contenido: '', moduloId: '' });
      setArchivo(null); if (fileRef.current) fileRef.current.value = '';
      setForm(false); cargar(); onChange();
    } catch (e) { setErr(e instanceof Error ? e.message : 'No se pudo publicar.'); }
    finally { setSaving(false); }
  }
  async function borrar(id: number) { if (!confirm('¿Eliminar?')) return; await api.delete(`/aula/gestor/materiales/${id}`); cargar(); onChange(); }

  const puedePublicar = !!m.titulo.trim() && (m.tipo !== 'archivo' || !!archivo);

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-4">
        <SecHeader icon={esVideo ? Video : BookOpen} titulo={esVideo ? 'Videos' : 'Materiales'} sub={esVideo ? 'Clases y repasos en video (YouTube, etc.).' : 'Lecturas, archivos (PDF, Word…), enlaces y notas de apoyo.'} />
        <BtnCrear label={esVideo ? 'Nuevo video' : 'Nuevo material'} on={form} toggle={() => setForm((v) => !v)} />
      </div>
      {form && (
        <div className="bg-white border border-stone-200 rounded-xl p-5 mb-4 space-y-3">
          <input className={inputCls} placeholder={esVideo ? 'Título del video' : 'Título del material'} value={m.titulo} onChange={(e) => setM((s) => ({ ...s, titulo: e.target.value }))} />
          <input className={inputCls} placeholder="Descripción (opcional)" value={m.descripcion} onChange={(e) => setM((s) => ({ ...s, descripcion: e.target.value }))} />
          {!moduloId && (
          <div>
            <label className="text-xs font-semibold text-stone-500 block mb-1">Módulo de clase</label>
            <select className={inputCls} value={m.moduloId} onChange={(e) => setM((s) => ({ ...s, moduloId: e.target.value }))}>
              <option value="">General (sin módulo)</option>
              {modulos.map((mm) => <option key={mm.moduloId} value={mm.moduloId}>M{mm.numero} · {mm.nombre}</option>)}
            </select>
            {modulos.length === 0 && <div className="text-[11px] text-stone-400 mt-1">Agrega módulos desde “Mis módulos de clase” para poder organizarlos por módulo.</div>}
          </div>
          )}
          {!esVideo && (
            <div className="flex flex-wrap gap-2">
              {([['enlace', 'Enlace'], ['archivo', 'Archivo (PDF, Word…)'], ['texto', 'Texto/Nota']] as const).map(([tp, lbl]) => (
                <button key={tp} onClick={() => setM((s) => ({ ...s, tipo: tp }))} className={`px-3 py-1.5 text-xs font-semibold rounded-lg border ${m.tipo === tp ? 'text-white' : 'text-stone-600 border-stone-300'}`} style={m.tipo === tp ? { background: G, borderColor: G } : undefined}>{lbl}</button>
              ))}
            </div>
          )}
          {m.tipo === 'archivo' ? (
            <div>
              <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" className="hidden" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
              <button onClick={() => fileRef.current?.click()} className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-stone-300 rounded-lg px-3 py-4 text-sm text-stone-500 hover:border-[var(--color-guinda-500)] hover:text-[var(--color-guinda-700)] transition-colors">
                <Paperclip size={16} /> {archivo ? archivo.name : 'Elegir archivo (máx. 15 MB)'}
              </button>
            </div>
          ) : (esVideo || m.tipo === 'enlace' || m.tipo === 'video')
            ? <input className={inputCls} placeholder={esVideo ? 'https://youtu.be/… (o cualquier enlace)' : 'https://… (video, PDF, drive, etc.)'} value={m.url} onChange={(e) => setM((s) => ({ ...s, url: e.target.value }))} />
            : <AreaConFormato value={m.contenido} onChange={(v) => setM((s) => ({ ...s, contenido: v }))} rows={4} placeholder="Contenido / nota" />}
          {err && <div className="text-xs font-semibold text-red-600">{err}</div>}
          <button onClick={crear} disabled={saving || !puedePublicar} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-40" style={{ background: G }}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Publicar</button>
        </div>
      )}
      {visibles.length === 0 ? <Vacio icon={esVideo ? PlayCircle : BookOpen} texto={esVideo ? 'Aún no hay videos.' : 'Aún no hay materiales.'} /> : esVideo ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {visibles.map((it) => { const emb = ytEmbed(it.url); return (
            <div key={it.id} className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              {emb ? <div className="aspect-video bg-black"><VideoFrame src={emb} titulo={it.titulo} /></div>
                : <a href={it.url ?? '#'} target="_blank" rel="noreferrer" className="aspect-video flex items-center justify-center bg-stone-900 text-white"><PlayCircle size={40} /></a>}
              <div className="p-3 flex items-start justify-between gap-2">
                <div className="min-w-0"><div className="font-semibold text-sm text-stone-900 truncate">{it.titulo}</div>{it.descripcion && <div className="text-xs text-stone-500 truncate">{it.descripcion}</div>}</div>
                <button onClick={() => borrar(it.id)} className="shrink-0 text-stone-400 hover:text-red-500" aria-label="Eliminar video"><Trash2 size={14} /></button>
              </div>
            </div>
          ); })}
        </div>
      ) : (
        <div className="space-y-2.5">
          {visibles.map((it) => <MaterialCard key={it.id} it={it} onBorrar={() => borrar(it.id)} />)}
        </div>
      )}
    </div>
  );
}

/** Tarjeta didáctica de material (compartida en espíritu con la del alumno). */
function MaterialCard({ it, onBorrar }: { it: Material; onBorrar?: () => void }) {
  const meta = it.tipo === 'enlace'
    ? { icon: Link2, chip: 'Enlace', color: '#0369a1', bg: '#e0f2fe' }
    : it.tipo === 'archivo'
      ? { icon: Download, chip: 'Archivo', color: '#166534', bg: '#dcfce7' }
      : { icon: FileText, chip: 'Nota', color: '#92400e', bg: '#fef3c7' };
  const Icon = meta.icon;
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: meta.bg, color: meta.color }}><Icon size={18} /></div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-stone-900">{it.titulo}</span>
          <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: meta.bg, color: meta.color }}>{meta.chip}</span>
        </div>
        {it.descripcion && <div className="text-sm text-stone-600 mt-0.5">{it.descripcion}</div>}
        {it.tipo === 'enlace' && it.url && <a href={it.url} target="_blank" rel="noreferrer" className="text-xs font-semibold break-all" style={{ color: G }}>{it.url}</a>}
        {it.tipo === 'archivo' && it.archivoNombre && (
          <a href={`/api/aula/materiales/${it.id}/archivo`} className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: G }}>
            <Download size={13} /> {it.archivoNombre}
          </a>
        )}
        {it.tipo === 'texto' && it.contenido && <TextoRico texto={it.contenido} className="text-sm text-stone-600 mt-1 space-y-0.5" />}
      </div>
      {onBorrar && <button onClick={onBorrar} className="shrink-0 text-stone-400 hover:text-red-500" aria-label="Eliminar material"><Trash2 size={15} /></button>}
    </div>
  );
}

