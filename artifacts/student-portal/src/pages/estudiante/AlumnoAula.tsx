/**
 * Aula virtual del alumno (estilo Canvas): banner + mini-panel con secciones
 * (Anuncios · Tareas · Materiales · Videos). Solo si su gestor tiene aula.
 * Es aparte de sus módulos/pruebas oficiales.
 */
import { useEffect, useState } from 'react';
import { EstudianteLayout } from './EstudianteLayout';
import {
  School, Megaphone, ClipboardList, BookOpen, Link2, FileText, CheckCircle2, CalendarClock, Loader2,
  Video, PlayCircle, LayoutDashboard, ChevronRight, Inbox,
} from 'lucide-react';
import { api } from '../../lib/api';

type Sec = 'resumen' | 'anuncios' | 'tareas' | 'materiales' | 'videos';
interface Tarea { id: number; titulo: string; instrucciones: string | null; fechaEntrega: string | null; createdAt: string; miEstado: string | null; miComentario: string | null }
interface Material { id: number; titulo: string; descripcion: string | null; tipo: string; url: string | null; contenido: string | null }
interface Anuncio { id: number; titulo: string; cuerpo: string; createdAt: string }
interface MiAula { habilitada: boolean; gestor?: { nombre: string; centro: string | null }; tareas: Tarea[]; materiales: Material[]; anuncios: Anuncio[] }

const G = 'var(--color-guinda-700)';
function fecha(s: string | null) { return s ? new Date(s).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : ''; }
function fechaHora(s: string) { return new Date(s).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }); }
function ytEmbed(url: string | null): string | null { if (!url) return null; const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/); return m ? `https://www.youtube.com/embed/${m[1]}` : null; }

export default function AlumnoAula() {
  const [d, setD] = useState<MiAula | null>(null);
  const [sec, setSec] = useState<Sec>('resumen');
  const cargar = () => api.get<MiAula>('/aula/mi-aula').then(setD).catch(() => setD({ habilitada: false, tareas: [], materiales: [], anuncios: [] }));
  useEffect(() => { cargar(); }, []);

  if (!d) return <EstudianteLayout><div className="h-52 rounded-xl animate-pulse bg-stone-100" /></EstudianteLayout>;
  if (!d.habilitada) return (
    <EstudianteLayout>
      <div className="border-2 border-dashed border-stone-200 rounded-xl p-12 text-center">
        <School size={30} className="mx-auto mb-2 text-stone-300" />
        <div className="text-sm text-stone-400">Tu centro de asesoría no tiene aula virtual activa.</div>
      </div>
    </EstudianteLayout>
  );

  const pendientes = d.tareas.filter((t) => !t.miEstado).length;
  const videos = d.materiales.filter((m) => m.tipo === 'video');
  const materiales = d.materiales.filter((m) => m.tipo !== 'video');
  const NAV: { k: Sec; label: string; icon: typeof LayoutDashboard; n?: number }[] = [
    { k: 'resumen', label: 'Resumen', icon: LayoutDashboard },
    { k: 'anuncios', label: 'Anuncios', icon: Megaphone, n: d.anuncios.length },
    { k: 'tareas', label: 'Tareas', icon: ClipboardList, n: pendientes },
    { k: 'materiales', label: 'Materiales', icon: BookOpen, n: materiales.length },
    { k: 'videos', label: 'Videos', icon: Video, n: videos.length },
  ];

  return (
    <EstudianteLayout>
      {/* Banner */}
      <div className="rounded-2xl overflow-hidden mb-5 shadow-[0_10px_30px_-16px_rgba(74,14,32,0.55)]" style={{ background: 'linear-gradient(120deg, var(--color-guinda-800) 0%, var(--color-guinda-600) 60%, #7a1f3d 100%)' }}>
        <div className="relative px-6 py-6 text-white">
          <div className="absolute -right-8 -top-10 w-44 h-44 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <div className="relative flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}><School size={24} /></div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">Aula de mi centro</div>
              <h1 className="font-serif text-2xl font-bold leading-tight">{d.gestor?.centro || d.gestor?.nombre || 'Aula virtual'}</h1>
            </div>
          </div>
          {pendientes > 0 && (
            <div className="relative mt-4 inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm" style={{ background: 'rgba(255,255,255,0.15)' }}>
              <ClipboardList size={14} /> Tienes <b>{pendientes}</b> tarea{pendientes === 1 ? '' : 's'} pendiente{pendientes === 1 ? '' : 's'}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[208px_1fr] gap-5">
        {/* Mini-panel */}
        <nav className="md:sticky md:top-[114px] self-start">
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3" style={{ background: G, color: '#fff' }}>
              <div className="text-[10px] tracking-widest opacity-80">AULA</div>
              <div className="font-serif text-sm">Mi aula virtual</div>
            </div>
            <ul className="py-1">
              {NAV.map((it) => {
                const on = sec === it.k;
                return (
                  <li key={it.k}>
                    <button onClick={() => setSec(it.k)} className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors border-l-4 ${on ? 'bg-[var(--color-crema-100)] border-[var(--color-guinda-700)] text-[var(--color-guinda-800)] font-semibold' : 'border-transparent text-stone-700 hover:bg-stone-50'}`}>
                      <it.icon size={16} /> <span className="flex-1 text-left">{it.label}</span>
                      {typeof it.n === 'number' && it.n > 0 && <span className="text-[10px] font-bold rounded-full px-1.5 py-0.5" style={{ background: on ? G : '#eee', color: on ? '#fff' : '#78716c' }}>{it.n}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        {/* Contenido */}
        <div className="min-w-0">
          {sec === 'resumen' && <ResumenSec d={d} pendientes={pendientes} videos={videos.length} materiales={materiales.length} ir={setSec} />}
          {sec === 'anuncios' && (d.anuncios.length === 0 ? <Vacio icon={Megaphone} texto="No hay anuncios." /> : (
            <div className="space-y-2.5">{d.anuncios.map((a) => (
              <div key={a.id} className="bg-white border border-stone-200 rounded-xl p-4"><div className="font-semibold text-stone-900">{a.titulo}</div><div className="text-sm text-stone-600 mt-0.5 whitespace-pre-wrap">{a.cuerpo}</div><div className="text-[11px] text-stone-400 mt-1">{fechaHora(a.createdAt)}</div></div>
            ))}</div>
          ))}
          {sec === 'tareas' && (d.tareas.length === 0 ? <Vacio icon={ClipboardList} texto="No tienes tareas asignadas." /> : (
            <div className="space-y-2.5">{d.tareas.map((t) => <TareaCard key={t.id} t={t} onDone={cargar} />)}</div>
          ))}
          {sec === 'materiales' && (materiales.length === 0 ? <Vacio icon={BookOpen} texto="Aún no hay materiales." /> : (
            <div className="space-y-2.5">{materiales.map((m) => (
              <div key={m.id} className="bg-white border border-stone-200 rounded-xl p-4">
                <div className="flex items-center gap-2 font-semibold text-stone-900">{m.tipo === 'enlace' ? <Link2 size={15} style={{ color: G }} /> : <FileText size={15} style={{ color: G }} />}{m.titulo}</div>
                {m.descripcion && <div className="text-sm text-stone-600 mt-0.5">{m.descripcion}</div>}
                {m.tipo === 'enlace' && m.url && <a href={m.url} target="_blank" rel="noreferrer" className="text-xs font-semibold break-all" style={{ color: G }}>Abrir enlace →</a>}
                {m.tipo === 'texto' && m.contenido && <div className="text-sm text-stone-600 mt-1 whitespace-pre-wrap">{m.contenido}</div>}
              </div>
            ))}</div>
          ))}
          {sec === 'videos' && (videos.length === 0 ? <Vacio icon={PlayCircle} texto="Aún no hay videos." /> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{videos.map((m) => { const emb = ytEmbed(m.url); return (
              <div key={m.id} className="bg-white border border-stone-200 rounded-xl overflow-hidden">
                {emb ? <div className="aspect-video bg-black"><iframe src={emb} title={m.titulo} className="w-full h-full" allowFullScreen /></div>
                  : <a href={m.url ?? '#'} target="_blank" rel="noreferrer" className="aspect-video flex items-center justify-center bg-stone-900 text-white"><PlayCircle size={40} /></a>}
                <div className="p-3"><div className="font-semibold text-sm text-stone-900 truncate">{m.titulo}</div>{m.descripcion && <div className="text-xs text-stone-500 truncate">{m.descripcion}</div>}</div>
              </div>
            ); })}</div>
          ))}
        </div>
      </div>
    </EstudianteLayout>
  );
}

function ResumenSec({ d, pendientes, videos, materiales, ir }: { d: MiAula; pendientes: number; videos: number; materiales: number; ir: (s: Sec) => void }) {
  const cards: { k: Sec; label: string; desc: string; icon: typeof LayoutDashboard; n: number }[] = [
    { k: 'anuncios', label: 'Anuncios', desc: 'Avisos de tu centro', icon: Megaphone, n: d.anuncios.length },
    { k: 'tareas', label: 'Tareas', desc: pendientes > 0 ? `${pendientes} pendiente(s)` : 'Al día', icon: ClipboardList, n: d.tareas.length },
    { k: 'materiales', label: 'Materiales', desc: 'Lecturas y enlaces', icon: BookOpen, n: materiales },
    { k: 'videos', label: 'Videos', desc: 'Clases en video', icon: Video, n: videos },
  ];
  return (
    <div>
      <div className="mb-4"><div className="flex items-center gap-2 text-lg font-bold text-stone-900"><LayoutDashboard size={18} style={{ color: G }} /> Resumen</div><div className="text-xs text-stone-500 mt-0.5">Lo que tu centro de asesoría publicó para ti.</div></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {cards.map((c) => (
          <button key={c.k} onClick={() => ir(c.k)} className="text-left bg-white border border-stone-200 rounded-xl p-4 hover:-translate-y-0.5 hover:shadow-md transition-all group">
            <div className="flex items-center justify-between"><div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[var(--color-crema-100)]" style={{ color: G }}><c.icon size={17} /></div><span className="text-2xl font-bold text-stone-900">{c.n}</span></div>
            <div className="mt-2 font-semibold text-stone-900 flex items-center gap-1">{c.label} <ChevronRight size={14} className="text-stone-300 group-hover:translate-x-0.5 transition-transform" /></div>
            <div className="text-xs text-stone-500">{c.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function TareaCard({ t, onDone }: { t: Tarea; onDone: () => void }) {
  const [abrir, setAbrir] = useState(false);
  const [comentario, setComentario] = useState(t.miComentario ?? '');
  const [saving, setSaving] = useState(false);
  const entregada = !!t.miEstado;
  async function entregar() { setSaving(true); try { await api.post(`/aula/tareas/${t.id}/entregar`, { comentario }); onDone(); setAbrir(false); } finally { setSaving(false); } }
  return (
    <div className="bg-white border rounded-xl p-4" style={{ borderColor: entregada ? '#bbf7d0' : '#e7e5e4' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-stone-900">{t.titulo}</div>
          {t.instrucciones && <div className="text-sm text-stone-600 mt-0.5 whitespace-pre-wrap">{t.instrucciones}</div>}
          {t.fechaEntrega && <div className="text-xs text-stone-500 mt-1.5 inline-flex items-center gap-1"><CalendarClock size={12} /> Entrega: {fecha(t.fechaEntrega)}</div>}
        </div>
        {entregada
          ? <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: '#dcfce7', color: '#166534' }}><CheckCircle2 size={12} /> Entregada</span>
          : <span className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: '#fef3c7', color: '#92400e' }}>Pendiente</span>}
      </div>
      {!abrir ? (
        <button onClick={() => setAbrir(true)} className="mt-3 text-xs font-semibold" style={{ color: G }}>{entregada ? 'Editar mi entrega' : 'Marcar como entregada'} →</button>
      ) : (
        <div className="mt-3 space-y-2">
          <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={2} placeholder="Comentario para tu gestor (opcional)" className="w-full text-sm border border-stone-300 rounded-lg px-3 py-2 focus:border-[var(--color-guinda-500)] focus:outline-none" />
          <div className="flex gap-2">
            <button onClick={entregar} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-40" style={{ background: G }}>{saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} {entregada ? 'Actualizar' : 'Entregar'}</button>
            <button onClick={() => setAbrir(false)} className="px-4 py-2 text-sm font-medium rounded-lg border border-stone-300 text-stone-600">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Vacio({ icon: Icon, texto }: { icon: typeof Inbox; texto: string }) {
  return <div className="border-2 border-dashed border-stone-200 rounded-xl p-10 text-center"><Icon size={26} className="mx-auto mb-2 text-stone-300" /><div className="text-sm text-stone-400">{texto}</div></div>;
}
