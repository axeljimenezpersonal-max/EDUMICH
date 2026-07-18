/**
 * Aula virtual del alumno (estilo Canvas / Tec de Monterrey), integrada DENTRO
 * de su portal. La home del aula es un grid de "mis clases" (módulos). Al
 * entrar a una clase aparece un mini-portal a la izquierda —Foro (landing),
 * Tareas, Materiales, Videos— todo scoped a ESE módulo. Solo si su gestor
 * tiene aula. Es aparte de sus módulos/pruebas oficiales.
 */
import { useEffect, useRef, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { EstudianteLayout } from './EstudianteLayout';
import { ForoAula } from '../../components/ForoAula';
import {
  School, ClipboardList, BookOpen, Link2, FileText, CheckCircle2, CalendarClock, Loader2,
  Video, PlayCircle, ChevronRight, ChevronLeft, Inbox, MessageCircle, Paperclip, Download, X,
  Lock, Clock, GraduationCap, MapPin,
} from 'lucide-react';
import { api } from '../../lib/api';
import { parseDbDate, fechaCorta, fechaHoraCorta, vencioFecha, fechaVentana } from '../../lib/fechas';
import { ytEmbed, VideoFrame } from '../../components/VideoEmbed';
import { SectionTour } from '../../components/onboarding/SectionTour';
import { TOUR_AULA_HOME, TOUR_AULA_MODULO, GATE_ESTUDIANTE } from '../../components/onboarding/seccionesEstudiante';
import { TextoRico, AreaConFormato } from '../../components/TextoRico';
import { DocPreview } from '../../components/DocPreview';
import { safeUrl } from '../../lib/safeUrl';

interface Tarea {
  id: number; titulo: string; instrucciones: string | null; fechaEntrega: string | null;
  abreEn: string | null; cierraEn: string | null; archivoNombre: string | null;
  moduloId: number | null; moduloNumero: number | null; moduloNombre: string | null;
  createdAt: string; miEstado: string | null; miComentario: string | null; miArchivo: string | null;
}
interface Material { id: number; moduloId: number | null; titulo: string; descripcion: string | null; tipo: string; url: string | null; contenido: string | null; archivoNombre: string | null }
interface ModuloClase { moduloId: number; numero: number; nombre: string; tareas: number; pendientes: number; materiales: number; videos: number }
interface MiAula { habilitada: boolean; gestor?: { nombre: string; centro: string | null; clave: string | null; municipio: string | null }; tareas: Tarea[]; materiales: Material[]; misModulos?: { numero: number; nombre: string }[]; modulosClase?: ModuloClase[] }

/** Estado de una tarea según su ventana de disponibilidad (tiempos en UTC de la BD). */
function estadoVentana(t: { abreEn: string | null; cierraEn: string | null }): 'programada' | 'abierta' | 'cerrada' {
  const ahora = Date.now();
  if (t.abreEn && parseDbDate(t.abreEn).getTime() > ahora) return 'programada';
  if (t.cierraEn && parseDbDate(t.cierraEn).getTime() < ahora) return 'cerrada';
  return 'abierta';
}

const G = 'var(--color-guinda-700)';
// Tiempos SIEMPRE vía lib/fechas: la BD guarda UTC sin zona (ver parseDbDate).
function fecha(s: string | null) { return s ? fechaCorta(s) : ''; }
const fechaHora = fechaHoraCorta;

// Colores estables por módulo (portada tipo Canvas).
const MOD_COLORS = ['#6b1e3a', '#0d9488', '#4338ca', '#b45309', '#0369a1', '#9d174d', '#4d7c0f', '#7c3aed', '#be123c', '#0f766e'];
const colorModulo = (n: number) => MOD_COLORS[Math.abs(n) % MOD_COLORS.length];

export default function AlumnoAula() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const moduloParam = new URLSearchParams(search).get('modulo');
  const moduloId = moduloParam ? Number(moduloParam) : null;
  const [d, setD] = useState<MiAula | null>(null);
  const cargar = () => api.get<MiAula>('/aula/mi-aula').then(setD).catch(() => setD({ habilitada: false, tareas: [], materiales: [] }));
  useEffect(() => { cargar(); }, []);

  const pendientes = d ? d.tareas.filter((t) => !t.miEstado).length : 0;
  const abrirModulo = (id: number) => setLocation(`/estudiante/aula?modulo=${id}`);
  const volverAClases = () => setLocation('/estudiante/aula');

  return (
    <EstudianteLayout>
      {!d ? (
        <div className="h-52 rounded-xl animate-pulse bg-stone-100" />
      ) : !d.habilitada ? (
        <AulaNoDisponible />
      ) : moduloId != null ? (
        <ModuloDetalleAlumno moduloId={moduloId} volver={volverAClases} onRecargar={cargar} />
      ) : (
        <>
          {/* Banner */}
          <div className="rounded-2xl overflow-hidden mb-5 shadow-[0_10px_30px_-16px_rgba(74,14,32,0.55)]" style={{ background: 'linear-gradient(120deg, var(--color-guinda-800) 0%, var(--color-guinda-600) 60%, #7a1f3d 100%)' }}>
            <div className="relative px-6 py-6 text-white">
              <div className="absolute -right-8 -top-10 w-44 h-44 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} />
              <div className="relative flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}><School size={24} /></div>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">Aula de mi centro</div>
                  <h1 className="font-serif text-2xl font-bold leading-tight truncate">{d.gestor?.centro || (d.gestor?.municipio ? `Centro de asesoría · ${d.gestor.municipio}` : 'Aula virtual')}</h1>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-white/75">
                    {d.gestor?.municipio && <span className="inline-flex items-center gap-1"><MapPin size={11} /> {d.gestor.municipio}</span>}
                    {d.gestor?.clave && <span className="rounded bg-white/15 px-1.5 py-0.5 font-mono font-semibold">{d.gestor.clave}</span>}
                  </div>
                </div>
              </div>
              {(pendientes > 0 || (d.misModulos && d.misModulos.length > 0)) && (
                <div className="relative mt-4 flex flex-wrap gap-2">
                  {d.misModulos?.map((m) => (
                    <span key={m.numero} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm" style={{ background: 'rgba(255,255,255,0.15)' }} title={m.nombre}>
                      <GraduationCap size={14} /> <b>M{m.numero}</b> <span className="text-white/80 max-w-[180px] truncate">{m.nombre}</span>
                    </span>
                  ))}
                  {pendientes > 0 && (
                    <span className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm" style={{ background: 'rgba(255,255,255,0.15)' }}>
                      <ClipboardList size={14} /> <b>{pendientes}</b> tarea{pendientes === 1 ? '' : 's'} pendiente{pendientes === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <ModulosGridAlumno d={d} abrirModulo={abrirModulo} />
        </>
      )}
    </EstudianteLayout>
  );
}

/** Home del aula del alumno: mis clases (módulos) estilo Canvas. */
function ModulosGridAlumno({ d, abrirModulo }: { d: MiAula; abrirModulo: (id: number) => void }) {
  const mods = d.modulosClase ?? [];
  return (
    <div>
      <div className="mb-4">
        <div className="flex items-center gap-2 text-lg font-bold text-stone-900"><GraduationCap size={18} style={{ color: G }} /> Mis clases</div>
        <div className="text-xs text-stone-500 mt-0.5">Entra a cada módulo para ver su foro, tareas, materiales y videos.</div>
      </div>

      {mods.length === 0 ? (
        <Vacio icon={GraduationCap} texto="Tu profesor aún no ha abierto módulos de clase en el aula." />
      ) : (
        <div data-tour="aula-clases" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {mods.map((m, i) => {
            const col = colorModulo(m.numero);
            return (
              <button key={m.moduloId} onClick={() => abrirModulo(m.moduloId)}
                data-tour={i === 0 ? 'aula-clase' : undefined}
                className="text-left bg-white border border-stone-200 rounded-2xl overflow-hidden hover:-translate-y-0.5 hover:shadow-lg transition-all group">
                {/* Portada de color */}
                <div className="relative h-24 overflow-hidden" style={{ background: `linear-gradient(135deg, ${col} 0%, ${col}cc 100%)` }}>
                  <div className="absolute -right-4 -top-6 w-24 h-24 rounded-full" style={{ background: 'rgba(255,255,255,0.10)' }} />
                  <div className="absolute right-6 -bottom-8 w-20 h-20 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
                  <div className="relative px-4 pt-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">Módulo {m.numero}</div>
                    {m.pendientes > 0 && (
                      <span className="absolute right-3 top-0 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold" style={{ color: col }}>
                        {m.pendientes} pendiente{m.pendientes === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-4">
                  <div className="font-serif text-base font-bold text-stone-900 leading-tight line-clamp-2 min-h-[2.6em]">M{m.numero} — {m.nombre}</div>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-stone-500">
                    <span className="inline-flex items-center gap-1"><ClipboardList size={12} /> {m.tareas} tarea{m.tareas === 1 ? '' : 's'}</span>
                    <span className="inline-flex items-center gap-1"><BookOpen size={12} /> {m.materiales}</span>
                    <span className="inline-flex items-center gap-1"><Video size={12} /> {m.videos}</span>
                  </div>
                  <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold" style={{ color: col }}>
                    Entrar al módulo <ChevronRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <SectionTour steps={TOUR_AULA_HOME} storageKey="modula_sec_aula_home_v1" gateKey={GATE_ESTUDIANTE} buttonLabel="Tutorial de Mi aula" />
    </div>
  );
}

interface ModuloContenido {
  modulo: { id: number; numero: number; nombre: string };
  tareas: Tarea[]; materiales: Material[]; videos: Material[];
}
type TabModulo = 'foro' | 'tareas' | 'materiales' | 'videos';
const TABS_MODULO: TabModulo[] = ['foro', 'tareas', 'materiales', 'videos'];

/** Detalle de un módulo para el alumno: mini-portal a la izquierda (Foro ·
 *  Tareas · Materiales · Videos), contenido scoped a ese módulo a la derecha. */
function ModuloDetalleAlumno({ moduloId, volver, onRecargar }: { moduloId: number; volver: () => void; onRecargar: () => void }) {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const tabParam = new URLSearchParams(search).get('tab');
  const tab: TabModulo = TABS_MODULO.includes(tabParam as TabModulo) ? (tabParam as TabModulo) : 'foro';
  const setTab = (t: TabModulo) => setLocation(`/estudiante/aula?modulo=${moduloId}${t === 'foro' ? '' : `&tab=${t}`}`);

  const [d, setD] = useState<ModuloContenido | null>(null);
  const [tareaAbierta, setTareaAbierta] = useState<number | null>(null);
  const cargar = () => api.get<ModuloContenido>(`/aula/modulo/${moduloId}`).then(setD).catch(() => {});
  useEffect(() => { setD(null); setTareaAbierta(null); cargar(); }, [moduloId]);

  if (!d) return <div className="h-40 rounded-xl animate-pulse bg-stone-100" />;
  const col = colorModulo(d.modulo.numero);
  const tarea = tareaAbierta != null ? d.tareas.find((t) => t.id === tareaAbierta) ?? null : null;

  const NAV_ITEMS: { k: TabModulo; label: string; icon: typeof MessageCircle; n?: number }[] = [
    { k: 'foro', label: 'Foro', icon: MessageCircle },
    { k: 'tareas', label: 'Tareas', icon: ClipboardList, n: d.tareas.length },
    { k: 'materiales', label: 'Materiales', icon: BookOpen, n: d.materiales.length },
    { k: 'videos', label: 'Videos', icon: Video, n: d.videos.length },
  ];

  return (
    <div>
      <button onClick={volver} data-tour="aula-volver" className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-[var(--color-guinda-700)]">
        <ChevronLeft size={14} /> Volver a mis clases
      </button>
      {/* Portada del módulo */}
      <div data-tour="aula-portada" className="rounded-2xl overflow-hidden mb-4 relative" style={{ background: `linear-gradient(135deg, ${col} 0%, ${col}cc 100%)` }}>
        <div className="absolute -right-6 -top-8 w-32 h-32 rounded-full" style={{ background: 'rgba(255,255,255,0.10)' }} />
        <div className="relative px-6 py-5 text-white">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">Módulo de clase</div>
          <h1 className="font-serif text-2xl font-bold leading-tight">M{d.modulo.numero} — {d.modulo.nombre}</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4">
        {/* Mini portal a la izquierda */}
        <nav data-tour="aula-nav" className="md:sticky md:top-[114px] self-start">
          <div className="bg-white border border-stone-200 rounded-md overflow-hidden">
            <ul>
              {NAV_ITEMS.map((item) => {
                const active = tab === item.k;
                return (
                  <li key={item.k}>
                    <button onClick={() => { setTareaAbierta(null); setTab(item.k); }}
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

        {/* Contenido del tab seleccionado */}
        <main data-tour="aula-contenido" className="min-w-0">
          {tab === 'foro' && <ForoAula moduloId={moduloId} compacto hrefTareas={`/estudiante/aula?modulo=${moduloId}&tab=tareas`} />}
          {tab === 'tareas' && (tarea
            ? <TareaDetalle t={tarea} volver={() => setTareaAbierta(null)} onDone={() => { cargar(); onRecargar(); }} />
            : d.tareas.length === 0 ? <Vacio icon={ClipboardList} texto="Este módulo aún no tiene tareas." /> : (
              <div className="space-y-2.5">{d.tareas.map((t) => <TareaItem key={t.id} t={t} abrir={() => setTareaAbierta(t.id)} />)}</div>
            ))}
          {tab === 'materiales' && (d.materiales.length === 0 ? <Vacio icon={BookOpen} texto="Este módulo aún no tiene materiales." /> : (
            <div className="space-y-2.5">{d.materiales.map((m) => <MaterialAlumno key={m.id} m={m} />)}</div>
          ))}
          {tab === 'videos' && (d.videos.length === 0 ? <Vacio icon={PlayCircle} texto="Este módulo aún no tiene videos." /> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{d.videos.map((m) => { const emb = ytEmbed(m.url); return (
              <div key={m.id} className="bg-white border border-stone-200 rounded-xl overflow-hidden">
                {emb ? <div className="aspect-video bg-black"><VideoFrame src={emb} titulo={m.titulo} /></div>
                  : <a href={m.url ?? '#'} target="_blank" rel="noreferrer" className="aspect-video flex items-center justify-center bg-stone-900 text-white"><PlayCircle size={40} /></a>}
                <div className="p-3"><div className="font-semibold text-sm text-stone-900 truncate">{m.titulo}</div>{m.descripcion && <div className="text-xs text-stone-500 truncate">{m.descripcion}</div>}</div>
              </div>
            ); })}</div>
          ))}
        </main>
      </div>

      <SectionTour steps={TOUR_AULA_MODULO} storageKey="modula_sec_aula_modulo_v1" gateKey={GATE_ESTUDIANTE} buttonLabel="Tutorial de la clase" />
    </div>
  );
}

/** Tarjeta compacta de tarea en la lista: se abre en vista de detalle. */
function TareaItem({ t, abrir }: { t: Tarea; abrir: () => void }) {
  const entregada = !!t.miEstado;
  const ventana = estadoVentana(t);
  const vencida = !entregada && (ventana === 'cerrada' || (t.fechaEntrega && vencioFecha(t.fechaEntrega)));
  return (
    <button onClick={abrir} className="w-full text-left bg-white border rounded-xl p-4 hover:-translate-y-0.5 hover:shadow-md transition-all group" style={{ borderColor: entregada ? '#bbf7d0' : vencida ? '#fecaca' : '#e7e5e4' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-stone-900 flex flex-wrap items-center gap-1.5">
            {t.titulo} <ChevronRight size={14} className="text-stone-300 group-hover:translate-x-0.5 transition-transform shrink-0" />
          </div>
          {/* Fechas GRANDES y claras, con día de la semana */}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {ventana === 'programada' && t.abreEn && (
              <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold" style={{ background: '#fef3c7', color: '#92400e' }}>
                <Lock size={12} /> Abre el {fechaVentana(t.abreEn, 'abre')}
              </span>
            )}
            {t.cierraEn && ventana !== 'programada' && (
              <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold" style={ventana === 'cerrada' ? { background: '#fee2e2', color: '#991b1b' } : { background: 'var(--color-crema-100)', color: 'var(--color-guinda-800)' }}>
                <CalendarClock size={12} /> {ventana === 'cerrada' ? 'Cerró' : 'Cierra'} el {fechaVentana(t.cierraEn, 'cierra')}
              </span>
            )}
            {!t.cierraEn && t.fechaEntrega && (
              <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold" style={{ background: 'var(--color-crema-100)', color: 'var(--color-guinda-800)' }}>
                <CalendarClock size={12} /> Entrega: {fecha(t.fechaEntrega)}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-stone-500">
            {t.archivoNombre && <span className="inline-flex items-center gap-1"><FileText size={12} /> Incluye documento</span>}
            {t.miArchivo && <span className="inline-flex items-center gap-1"><Paperclip size={12} /> {t.miArchivo}</span>}
          </div>
        </div>
        {entregada
          ? <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: '#dcfce7', color: '#166534' }}><CheckCircle2 size={12} /> Entregada</span>
          : ventana === 'programada'
            ? <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: '#f5f5f4', color: '#78716c' }}><Lock size={11} /> Próximamente</span>
            : <span className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: vencida ? '#fee2e2' : '#fef3c7', color: vencida ? '#991b1b' : '#92400e' }}>{vencida ? (ventana === 'cerrada' ? 'Cerrada' : 'Vencida') : 'Pendiente'}</span>}
      </div>
    </button>
  );
}

/** Vista de detalle de una tarea: instrucciones completas + entrega con archivo. */
function TareaDetalle({ t, volver, onDone }: { t: Tarea; volver: () => void; onDone: () => void }) {
  const [comentario, setComentario] = useState(t.miComentario ?? '');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const entregada = !!t.miEstado;
  const ventana = estadoVentana(t);
  const vencida = !entregada && t.fechaEntrega && vencioFecha(t.fechaEntrega);
  const puedeEntregar = ventana === 'abierta';

  async function entregar() {
    setSaving(true); setErr('');
    try {
      const fd = new FormData();
      fd.append('comentario', comentario);
      if (archivo) fd.append('archivo', archivo);
      await api.post(`/aula/tareas/${t.id}/entregar`, fd);
      onDone(); volver();
    } catch (e) { setErr(e instanceof Error ? e.message : 'No se pudo entregar. Intenta de nuevo.'); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <button onClick={volver} className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-[var(--color-guinda-700)]">
        <ChevronLeft size={14} /> Volver a tareas
      </button>
      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100 flex items-start justify-between gap-3" style={{ background: 'var(--color-crema-50, #fdfaf5)' }}>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Tarea</div>
            <h2 className="font-serif text-xl font-bold text-stone-900">{t.titulo}</h2>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {t.abreEn && ventana === 'programada' && (
                <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold" style={{ background: '#fef3c7', color: '#92400e' }}>
                  <Clock size={12} /> Abre el {fechaVentana(t.abreEn, 'abre')}
                </span>
              )}
              {t.cierraEn && (
                <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold" style={ventana === 'cerrada' ? { background: '#fee2e2', color: '#991b1b' } : { background: 'var(--color-crema-100)', color: 'var(--color-guinda-800)' }}>
                  <CalendarClock size={12} /> {ventana === 'cerrada' ? 'Cerró' : 'Cierra'} el {fechaVentana(t.cierraEn, 'cierra')}
                </span>
              )}
              {!t.cierraEn && t.fechaEntrega && (
                <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold" style={{ background: vencida ? '#fee2e2' : 'var(--color-crema-100)', color: vencida ? '#991b1b' : 'var(--color-guinda-800)' }}>
                  <CalendarClock size={12} /> Entrega: {fecha(t.fechaEntrega)}
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-xs text-stone-400 px-1 py-1">Publicada: {fecha(t.createdAt)}</span>
            </div>
          </div>
          {entregada
            ? <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: '#dcfce7', color: '#166534' }}><CheckCircle2 size={12} /> Entregada</span>
            : <span className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: vencida ? '#fee2e2' : '#fef3c7', color: vencida ? '#991b1b' : '#92400e' }}>{vencida ? 'Vencida' : 'Pendiente'}</span>}
        </div>

        <div className="px-5 py-4">
          <div className="text-xs font-bold uppercase tracking-wide text-stone-400 mb-1.5">Instrucciones</div>
          {t.instrucciones
            ? <TextoRico texto={t.instrucciones} className="text-sm text-stone-700 space-y-1" />
            : <div className="text-sm text-stone-700">Tu gestor no agregó instrucciones adicionales.</div>}
          {t.archivoNombre && (
            <div className="mt-3">
              <DocPreview url={`/api/aula/tareas/${t.id}/documento`} nombre={t.archivoNombre} />
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-stone-100">
          <div className="text-xs font-bold uppercase tracking-wide text-stone-400 mb-2">{entregada ? 'Tu entrega (puedes actualizarla)' : 'Entregar tarea'}</div>
          {!puedeEntregar && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold" style={ventana === 'programada' ? { background: '#fffbeb', borderColor: '#fde68a', color: '#92400e' } : { background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>
              <Lock size={14} className="shrink-0" />
              {ventana === 'programada'
                ? <>Esta tarea abre el <b>{fechaVentana(t.abreEn!, 'abre')}</b>. Podrás entregar a partir de esa fecha.</>
                : <>Esta tarea cerró el <b>{fechaVentana(t.cierraEn!, 'cierra')}</b> y ya no acepta entregas.</>}
            </div>
          )}
          {entregada && t.miArchivo && !archivo && (
            <div className="mb-2 inline-flex items-center gap-2 rounded-lg bg-stone-50 border border-stone-200 px-3 py-2 text-xs text-stone-600">
              <FileText size={14} style={{ color: G }} /> Entregaste: <b>{t.miArchivo}</b>
            </div>
          )}
          {puedeEntregar ? (
            <>
              <AreaConFormato value={comentario} onChange={setComentario} rows={3} placeholder="Comentario para tu gestor (opcional)" />
              <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" className="hidden" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
              {archivo ? (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                  <FileText size={16} style={{ color: G }} />
                  <span className="min-w-0 flex-1 truncate text-xs text-stone-600">{archivo.name}</span>
                  <button onClick={() => { setArchivo(null); if (fileRef.current) fileRef.current.value = ''; }} className="text-stone-400 hover:text-red-500" aria-label="Quitar archivo"><X size={15} /></button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()} className="mt-2 w-full flex items-center justify-center gap-2 border-2 border-dashed border-stone-300 rounded-lg px-3 py-3.5 text-sm text-stone-500 hover:border-[var(--color-guinda-500)] hover:text-[var(--color-guinda-700)] transition-colors">
                  <Paperclip size={15} /> Adjuntar mi trabajo (foto, PDF, Word… máx. 15 MB)
                </button>
              )}
              {err && <div className="mt-2 text-xs font-semibold text-red-600">{err}</div>}
              <div className="mt-3 flex gap-2">
                <button onClick={entregar} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-40" style={{ background: G }}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} {entregada ? 'Actualizar entrega' : 'Entregar'}
                </button>
                <button onClick={volver} className="px-4 py-2 text-sm font-medium rounded-lg border border-stone-300 text-stone-600">Cancelar</button>
              </div>
            </>
          ) : (
            <button onClick={volver} className="px-4 py-2 text-sm font-medium rounded-lg border border-stone-300 text-stone-600">Volver a tareas</button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Tarjeta didáctica de material para el alumno. */
function MaterialAlumno({ m }: { m: Material }) {
  const meta = m.tipo === 'enlace'
    ? { icon: Link2, chip: 'Enlace', color: '#0369a1', bg: '#e0f2fe' }
    : m.tipo === 'archivo'
      ? { icon: Download, chip: 'Archivo', color: '#166534', bg: '#dcfce7' }
      : { icon: FileText, chip: 'Nota', color: '#92400e', bg: '#fef3c7' };
  const Icon = meta.icon;
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: meta.bg, color: meta.color }}><Icon size={18} /></div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-stone-900">{m.titulo}</span>
          <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: meta.bg, color: meta.color }}>{meta.chip}</span>
        </div>
        {m.descripcion && <div className="text-sm text-stone-600 mt-0.5">{m.descripcion}</div>}
        {m.tipo === 'enlace' && m.url && <a href={safeUrl(m.url)} target="_blank" rel="noreferrer" className="text-xs font-semibold" style={{ color: G }}>Abrir enlace →</a>}
        {m.tipo === 'archivo' && m.archivoNombre && (
          <div className="mt-2">
            <DocPreview url={`/api/aula/materiales/${m.id}/archivo`} nombre={m.archivoNombre} />
          </div>
        )}
        {m.tipo === 'texto' && m.contenido && <TextoRico texto={m.contenido} className="text-sm text-stone-600 mt-1 space-y-0.5" />}
      </div>
    </div>
  );
}

function Vacio({ icon: Icon, texto }: { icon: typeof Inbox; texto: string }) {
  return <div className="border-2 border-dashed border-stone-200 rounded-xl p-10 text-center"><Icon size={26} className="mx-auto mb-2 text-stone-300" /><div className="text-sm text-stone-400">{texto}</div></div>;
}

/** Pantalla cuando el centro del alumno aún no cuenta con Aula Virtual. */
function AulaNoDisponible() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-stone-200 bg-white">
      <div className="px-6 py-10 sm:px-10 sm:py-14 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'var(--color-crema-100)' }}>
          <Lock size={28} style={{ color: G }} />
        </div>
        <div className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: '#b39a56' }}>Aula Virtual</div>
        <h2 className="mt-1 font-serif text-2xl font-bold text-stone-900">Aún no disponible en tu centro</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-stone-600">
          El <b>Aula Virtual</b> es un espacio de clases en línea (foro, tareas, materiales y videos) que
          ofrecen algunos centros de asesoría. Tu gestor todavía <b>no ha activado</b> este beneficio.
        </p>
        <p className="mx-auto mt-3 max-w-md text-xs text-stone-500">
          Si te interesa, coméntalo con tu gestor o asesor de tu centro. Mientras tanto, puedes seguir
          usando tu portal con normalidad: inscripción, pagos, calificaciones y pruebas.
        </p>
      </div>
    </div>
  );
}
