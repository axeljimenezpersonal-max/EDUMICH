/**
 * Aula virtual del alumno (estilo Canvas): banner + mini-panel con secciones
 * (Foro · Anuncios · Tareas · Materiales · Videos). Solo si su gestor tiene aula.
 * Es aparte de sus módulos/pruebas oficiales. Las tareas se abren en una vista
 * de detalle donde el alumno entrega con comentario y archivo.
 */
import { useEffect, useRef, useState } from 'react';
import { AulaShell } from '../../components/AulaShell';
import { ForoAula } from '../../components/ForoAula';
import {
  School, Megaphone, ClipboardList, BookOpen, Link2, FileText, CheckCircle2, CalendarClock, Loader2,
  Video, PlayCircle, LayoutDashboard, ChevronRight, ChevronLeft, Inbox, MessageCircle, Pin, Paperclip, Download, X,
} from 'lucide-react';
import { api } from '../../lib/api';
import { ytEmbed, VideoFrame } from '../../components/VideoEmbed';

type Sec = 'resumen' | 'foro' | 'anuncios' | 'tareas' | 'materiales' | 'videos';
interface Tarea { id: number; titulo: string; instrucciones: string | null; fechaEntrega: string | null; createdAt: string; miEstado: string | null; miComentario: string | null; miArchivo: string | null }
interface Material { id: number; titulo: string; descripcion: string | null; tipo: string; url: string | null; contenido: string | null; archivoNombre: string | null }
interface Anuncio { id: number; titulo: string; cuerpo: string; fijado: boolean; tieneImagen: boolean; createdAt: string }
interface MiAula { habilitada: boolean; gestor?: { nombre: string; centro: string | null }; tareas: Tarea[]; materiales: Material[]; anuncios: Anuncio[] }

const G = 'var(--color-guinda-700)';
function fecha(s: string | null) { return s ? new Date(s).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : ''; }
function fechaHora(s: string) { return new Date(s).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }); }

export default function AlumnoAula() {
  const [d, setD] = useState<MiAula | null>(null);
  const [sec, setSec] = useState<Sec>('resumen');
  const [tareaAbierta, setTareaAbierta] = useState<number | null>(null);
  const cargar = () => api.get<MiAula>('/aula/mi-aula').then(setD).catch(() => setD({ habilitada: false, tareas: [], materiales: [], anuncios: [] }));
  useEffect(() => { cargar(); }, []);

  const pendientes = d ? d.tareas.filter((t) => !t.miEstado).length : 0;
  const videos = d ? d.materiales.filter((m) => m.tipo === 'video') : [];
  const materiales = d ? d.materiales.filter((m) => m.tipo !== 'video') : [];
  const NAV = [
    { k: 'resumen' as Sec, label: 'Resumen', icon: LayoutDashboard },
    { k: 'foro' as Sec, label: 'Foro', icon: MessageCircle },
    { k: 'anuncios' as Sec, label: 'Anuncios', icon: Megaphone, n: d?.anuncios.length },
    { k: 'tareas' as Sec, label: 'Tareas', icon: ClipboardList, n: pendientes },
    { k: 'materiales' as Sec, label: 'Materiales', icon: BookOpen, n: materiales.length },
    { k: 'videos' as Sec, label: 'Videos', icon: Video, n: videos.length },
  ];

  const irSec: React.Dispatch<React.SetStateAction<Sec>> = (v) => { setTareaAbierta(null); setSec(v); };
  const tarea = tareaAbierta != null ? d?.tareas.find((t) => t.id === tareaAbierta) ?? null : null;

  return (
    <AulaShell rol="estudiante" volverHref="/estudiante" sec={sec} setSec={irSec} nav={NAV}>
      {!d ? (
        <div className="h-52 rounded-xl animate-pulse bg-stone-100" />
      ) : !d.habilitada ? (
        <div className="border-2 border-dashed border-stone-200 rounded-xl p-12 text-center">
          <School size={30} className="mx-auto mb-2 text-stone-300" />
          <div className="text-sm text-stone-400">Tu centro de asesoría no tiene aula virtual activa.</div>
        </div>
      ) : (
      <>
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

      <div className="min-w-0">
          {sec === 'resumen' && <ResumenSec d={d} pendientes={pendientes} videos={videos.length} materiales={materiales.length} ir={irSec} />}
          {sec === 'foro' && <ForoAula />}
          {sec === 'anuncios' && (d.anuncios.length === 0 ? <Vacio icon={Megaphone} texto="No hay anuncios." /> : (
            <div className="space-y-2.5">{d.anuncios.map((a) => (
              <div key={a.id} className="bg-white border rounded-xl overflow-hidden" style={{ borderColor: a.fijado ? '#d8a48f' : '#e7e5e4' }}>
                {a.tieneImagen && <img src={`/api/aula/anuncios/${a.id}/imagen`} alt="" className="w-full max-h-56 object-cover" loading="lazy" />}
                <div className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-stone-900">{a.titulo}</span>
                    {a.fijado && <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded text-white" style={{ background: G }}><Pin size={9} /> Fijado</span>}
                  </div>
                  <div className="text-sm text-stone-600 mt-0.5 whitespace-pre-wrap">{a.cuerpo}</div>
                  <div className="text-[11px] text-stone-400 mt-1">{fechaHora(a.createdAt)}</div>
                </div>
              </div>
            ))}</div>
          ))}
          {sec === 'tareas' && (tarea
            ? <TareaDetalle t={tarea} volver={() => setTareaAbierta(null)} onDone={() => { cargar(); }} />
            : d.tareas.length === 0 ? <Vacio icon={ClipboardList} texto="No tienes tareas asignadas." /> : (
            <div className="space-y-2.5">{d.tareas.map((t) => <TareaItem key={t.id} t={t} abrir={() => setTareaAbierta(t.id)} />)}</div>
          ))}
          {sec === 'materiales' && (materiales.length === 0 ? <Vacio icon={BookOpen} texto="Aún no hay materiales." /> : (
            <div className="space-y-2.5">{materiales.map((m) => <MaterialAlumno key={m.id} m={m} />)}</div>
          ))}
          {sec === 'videos' && (videos.length === 0 ? <Vacio icon={PlayCircle} texto="Aún no hay videos." /> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{videos.map((m) => { const emb = ytEmbed(m.url); return (
              <div key={m.id} className="bg-white border border-stone-200 rounded-xl overflow-hidden">
                {emb ? <div className="aspect-video bg-black"><VideoFrame src={emb} titulo={m.titulo} /></div>
                  : <a href={m.url ?? '#'} target="_blank" rel="noreferrer" className="aspect-video flex items-center justify-center bg-stone-900 text-white"><PlayCircle size={40} /></a>}
                <div className="p-3"><div className="font-semibold text-sm text-stone-900 truncate">{m.titulo}</div>{m.descripcion && <div className="text-xs text-stone-500 truncate">{m.descripcion}</div>}</div>
              </div>
            ); })}</div>
          ))}
      </div>
      </>
      )}
    </AulaShell>
  );
}

function ResumenSec({ d, pendientes, videos, materiales, ir }: { d: MiAula; pendientes: number; videos: number; materiales: number; ir: (s: Sec) => void }) {
  const cards: { k: Sec; label: string; desc: string; icon: typeof LayoutDashboard; n: number }[] = [
    { k: 'anuncios', label: 'Anuncios', desc: 'Avisos de tu centro', icon: Megaphone, n: d.anuncios.length },
    { k: 'tareas', label: 'Tareas', desc: pendientes > 0 ? `${pendientes} pendiente(s)` : 'Al día', icon: ClipboardList, n: d.tareas.length },
    { k: 'materiales', label: 'Materiales', desc: 'Lecturas, archivos y enlaces', icon: BookOpen, n: materiales },
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

/** Tarjeta compacta de tarea en la lista: se abre en vista de detalle. */
function TareaItem({ t, abrir }: { t: Tarea; abrir: () => void }) {
  const entregada = !!t.miEstado;
  const vencida = !entregada && t.fechaEntrega && new Date(t.fechaEntrega).getTime() < Date.now();
  return (
    <button onClick={abrir} className="w-full text-left bg-white border rounded-xl p-4 hover:-translate-y-0.5 hover:shadow-md transition-all group" style={{ borderColor: entregada ? '#bbf7d0' : vencida ? '#fecaca' : '#e7e5e4' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-stone-900 flex items-center gap-1.5">{t.titulo} <ChevronRight size={14} className="text-stone-300 group-hover:translate-x-0.5 transition-transform shrink-0" /></div>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-stone-500">
            {t.fechaEntrega && <span className="inline-flex items-center gap-1"><CalendarClock size={12} /> Entrega: {fecha(t.fechaEntrega)}</span>}
            {t.miArchivo && <span className="inline-flex items-center gap-1"><Paperclip size={12} /> {t.miArchivo}</span>}
          </div>
        </div>
        {entregada
          ? <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: '#dcfce7', color: '#166534' }}><CheckCircle2 size={12} /> Entregada</span>
          : <span className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: vencida ? '#fee2e2' : '#fef3c7', color: vencida ? '#991b1b' : '#92400e' }}>{vencida ? 'Vencida' : 'Pendiente'}</span>}
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
  const vencida = !entregada && t.fechaEntrega && new Date(t.fechaEntrega).getTime() < Date.now();

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
            <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-stone-500">
              <span>Publicada: {fecha(t.createdAt)}</span>
              {t.fechaEntrega && <span className="inline-flex items-center gap-1 font-semibold" style={{ color: vencida ? '#b91c1c' : undefined }}><CalendarClock size={12} /> Entrega: {fecha(t.fechaEntrega)}</span>}
            </div>
          </div>
          {entregada
            ? <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: '#dcfce7', color: '#166534' }}><CheckCircle2 size={12} /> Entregada</span>
            : <span className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: vencida ? '#fee2e2' : '#fef3c7', color: vencida ? '#991b1b' : '#92400e' }}>{vencida ? 'Vencida' : 'Pendiente'}</span>}
        </div>

        <div className="px-5 py-4">
          <div className="text-xs font-bold uppercase tracking-wide text-stone-400 mb-1.5">Instrucciones</div>
          <div className="text-sm text-stone-700 whitespace-pre-wrap">{t.instrucciones || 'Tu gestor no agregó instrucciones adicionales.'}</div>
        </div>

        <div className="px-5 py-4 border-t border-stone-100">
          <div className="text-xs font-bold uppercase tracking-wide text-stone-400 mb-2">{entregada ? 'Tu entrega (puedes actualizarla)' : 'Entregar tarea'}</div>
          {entregada && t.miArchivo && !archivo && (
            <div className="mb-2 inline-flex items-center gap-2 rounded-lg bg-stone-50 border border-stone-200 px-3 py-2 text-xs text-stone-600">
              <FileText size={14} style={{ color: G }} /> Entregaste: <b>{t.miArchivo}</b>
            </div>
          )}
          <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={3} placeholder="Comentario para tu gestor (opcional)" className="w-full text-sm border border-stone-300 rounded-lg px-3 py-2 focus:border-[var(--color-guinda-500)] focus:outline-none" />
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
        {m.tipo === 'enlace' && m.url && <a href={m.url} target="_blank" rel="noreferrer" className="text-xs font-semibold" style={{ color: G }}>Abrir enlace →</a>}
        {m.tipo === 'archivo' && m.archivoNombre && (
          <a href={`/api/aula/materiales/${m.id}/archivo`} className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: G }}>
            <Download size={13} /> Descargar {m.archivoNombre}
          </a>
        )}
        {m.tipo === 'texto' && m.contenido && <div className="text-sm text-stone-600 mt-1 whitespace-pre-wrap">{m.contenido}</div>}
      </div>
    </div>
  );
}

function Vacio({ icon: Icon, texto }: { icon: typeof Inbox; texto: string }) {
  return <div className="border-2 border-dashed border-stone-200 rounded-xl p-10 text-center"><Icon size={26} className="mx-auto mb-2 text-stone-300" /><div className="text-sm text-stone-400">{texto}</div></div>;
}
