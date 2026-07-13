/**
 * Aula virtual del gestor (LMS-lite estilo Canvas). Panel propio con banner de
 * "curso" + sub-navegación (Resumen · Anuncios · Tareas · Materiales · Videos).
 * Solo visible si el aula del gestor está habilitada.
 */
import { useEffect, useState } from 'react';
import { GestorLayout } from './GestorLayout';
import {
  School, ClipboardList, BookOpen, Megaphone, Plus, Trash2, Users, Link2, FileText,
  Loader2, CalendarClock, LayoutDashboard, Video, PlayCircle, CheckCircle2, ChevronRight, Inbox,
} from 'lucide-react';
import { api } from '../../lib/api';

type Sec = 'resumen' | 'anuncios' | 'tareas' | 'materiales' | 'videos';

interface Tarea { id: number; titulo: string; instrucciones: string | null; fechaEntrega: string | null; createdAt: string; entregas: number }
interface Material { id: number; titulo: string; descripcion: string | null; tipo: string; url: string | null; contenido: string | null; createdAt: string }
interface Anuncio { id: number; titulo: string; cuerpo: string; createdAt: string }
interface Entrega { alumno: string; estado: string; comentario: string | null; entregada_en: string }
interface Resumen { tareas: number; materiales: number; anuncios: number; alumnos: number }

const G = 'var(--color-guinda-700)';
function fecha(s: string | null) { return s ? new Date(s).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }
function fechaHora(s: string) { return new Date(s).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }); }
function ytEmbed(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

const inputCls = 'w-full text-sm border border-stone-300 rounded-lg px-3 py-2 focus:border-[var(--color-guinda-500)] focus:outline-none';

export default function GestorAula() {
  const [sec, setSec] = useState<Sec>('resumen');
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const cargarResumen = () => api.get<Resumen>('/aula/gestor/resumen').then(setResumen).catch(() => {});
  useEffect(() => { cargarResumen(); }, []);

  const NAV: { k: Sec; label: string; icon: typeof LayoutDashboard; n?: number }[] = [
    { k: 'resumen', label: 'Resumen', icon: LayoutDashboard },
    { k: 'anuncios', label: 'Anuncios', icon: Megaphone, n: resumen?.anuncios },
    { k: 'tareas', label: 'Tareas', icon: ClipboardList, n: resumen?.tareas },
    { k: 'materiales', label: 'Materiales', icon: BookOpen, n: resumen?.materiales },
    { k: 'videos', label: 'Videos', icon: Video },
  ];

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
                { l: 'Anuncios', v: resumen.anuncios, icon: Megaphone },
              ].map((c) => (
                <div key={c.l} className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm" style={{ background: 'rgba(255,255,255,0.13)' }}>
                  <c.icon size={14} className="text-white/80" /> <b>{c.v}</b> <span className="text-white/70">{c.l}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[208px_1fr] gap-5">
        {/* Mini-panel del aula */}
        <nav className="md:sticky md:top-[114px] self-start">
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3" style={{ background: G, color: '#fff' }}>
              <div className="text-[10px] tracking-widest opacity-80">PANEL</div>
              <div className="font-serif text-sm">Aula virtual</div>
            </div>
            <ul className="py-1">
              {NAV.map((it) => {
                const on = sec === it.k;
                return (
                  <li key={it.k}>
                    <button onClick={() => setSec(it.k)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors border-l-4 ${on ? 'bg-[var(--color-crema-100)] border-[var(--color-guinda-700)] text-[var(--color-guinda-800)] font-semibold' : 'border-transparent text-stone-700 hover:bg-stone-50'}`}>
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
          {sec === 'resumen' && <ResumenSec resumen={resumen} ir={setSec} />}
          {sec === 'anuncios' && <AnunciosTab onChange={cargarResumen} />}
          {sec === 'tareas' && <TareasTab onChange={cargarResumen} />}
          {sec === 'materiales' && <MaterialesTab modo="materiales" onChange={cargarResumen} />}
          {sec === 'videos' && <MaterialesTab modo="videos" onChange={cargarResumen} />}
        </div>
      </div>
    </GestorLayout>
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
  return <button onClick={toggle} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg text-white transition-transform hover:-translate-y-0.5" style={{ background: G }}>{on ? <Trash2 size={15} /> : <Plus size={15} />} {on ? 'Cerrar' : label}</button>;
}

// ── Resumen ──
function ResumenSec({ resumen, ir }: { resumen: Resumen | null; ir: (s: Sec) => void }) {
  const cards: { k: Sec; label: string; desc: string; icon: typeof LayoutDashboard; n?: number }[] = [
    { k: 'anuncios', label: 'Anuncios', desc: 'Avisos para tus alumnos', icon: Megaphone, n: resumen?.anuncios },
    { k: 'tareas', label: 'Tareas', desc: 'Asignaciones con entrega', icon: ClipboardList, n: resumen?.tareas },
    { k: 'materiales', label: 'Materiales', desc: 'Lecturas, enlaces y notas', icon: BookOpen, n: resumen?.materiales },
    { k: 'videos', label: 'Videos', desc: 'Clases y repasos en video', icon: Video },
  ];
  return (
    <div>
      <SecHeader icon={LayoutDashboard} titulo="Resumen del aula" sub="Todo lo que publiques aquí lo verán tus alumnos en su portal." />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {cards.map((c) => (
          <button key={c.k} onClick={() => ir(c.k)} className="text-left bg-white border border-stone-200 rounded-xl p-4 hover:-translate-y-0.5 hover:shadow-md transition-all group">
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[var(--color-crema-100)]" style={{ color: G }}><c.icon size={17} /></div>
              {typeof c.n === 'number' && <span className="text-2xl font-bold text-stone-900">{c.n}</span>}
            </div>
            <div className="mt-2 font-semibold text-stone-900 flex items-center gap-1">{c.label} <ChevronRight size={14} className="text-stone-300 group-hover:translate-x-0.5 transition-transform" /></div>
            <div className="text-xs text-stone-500">{c.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Tareas ──
function TareasTab({ onChange }: { onChange: () => void }) {
  const [items, setItems] = useState<Tarea[]>([]);
  const [totalAlumnos, setTotalAlumnos] = useState(0);
  const [form, setForm] = useState(false);
  const [t, setT] = useState({ titulo: '', instrucciones: '', fechaEntrega: '' });
  const [saving, setSaving] = useState(false);
  const [entregasDe, setEntregasDe] = useState<number | null>(null);
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const cargar = () => api.get<{ tareas: Tarea[]; totalAlumnos: number }>('/aula/gestor/tareas').then((r) => { setItems(r.tareas); setTotalAlumnos(r.totalAlumnos); }).catch(() => {});
  useEffect(() => { cargar(); }, []);
  async function crear() { if (!t.titulo.trim()) return; setSaving(true); try { await api.post('/aula/gestor/tareas', t); setT({ titulo: '', instrucciones: '', fechaEntrega: '' }); setForm(false); cargar(); onChange(); } finally { setSaving(false); } }
  async function borrar(id: number) { if (!confirm('¿Eliminar esta tarea?')) return; await api.delete(`/aula/gestor/tareas/${id}`); cargar(); onChange(); }
  async function verEntregas(id: number) { if (entregasDe === id) { setEntregasDe(null); return; } const r = await api.get<{ entregas: Entrega[] }>(`/aula/gestor/tareas/${id}/entregas`); setEntregas(r.entregas); setEntregasDe(id); }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <SecHeader icon={ClipboardList} titulo="Tareas" sub="Publica asignaciones con fecha de entrega." />
        <BtnCrear label="Nueva tarea" on={form} toggle={() => setForm((v) => !v)} />
      </div>
      {form && (
        <div className="bg-white border border-stone-200 rounded-xl p-5 mb-4 space-y-3">
          <input className={inputCls} placeholder="Título de la tarea" value={t.titulo} onChange={(e) => setT((s) => ({ ...s, titulo: e.target.value }))} />
          <textarea className={inputCls} rows={3} placeholder="Instrucciones (opcional)" value={t.instrucciones} onChange={(e) => setT((s) => ({ ...s, instrucciones: e.target.value }))} />
          <div><label className="text-xs font-semibold text-stone-500 block mb-1">Fecha de entrega (opcional)</label><input type="date" className={inputCls + ' max-w-[200px]'} value={t.fechaEntrega} onChange={(e) => setT((s) => ({ ...s, fechaEntrega: e.target.value }))} /></div>
          <button onClick={crear} disabled={saving || !t.titulo.trim()} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-40" style={{ background: G }}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Publicar</button>
        </div>
      )}
      {items.length === 0 ? <Vacio icon={ClipboardList} texto="Aún no has publicado tareas." /> : (
        <div className="space-y-2.5">
          {items.map((it) => (
            <div key={it.id} className="bg-white border border-stone-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-stone-900">{it.titulo}</div>
                  {it.instrucciones && <div className="text-sm text-stone-600 mt-0.5 whitespace-pre-wrap">{it.instrucciones}</div>}
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-stone-500">
                    {it.fechaEntrega && <span className="inline-flex items-center gap-1"><CalendarClock size={12} /> Entrega: {fecha(it.fechaEntrega)}</span>}
                    <button onClick={() => verEntregas(it.id)} className="inline-flex items-center gap-1 font-semibold" style={{ color: G }}><Users size={12} /> {it.entregas}/{totalAlumnos} entregaron</button>
                  </div>
                </div>
                <button onClick={() => borrar(it.id)} className="shrink-0 text-stone-400 hover:text-red-500"><Trash2 size={15} /></button>
              </div>
              {entregasDe === it.id && (
                <div className="mt-3 border-t border-stone-100 pt-3">
                  {entregas.length === 0 ? <div className="text-xs text-stone-400">Nadie ha entregado aún.</div> : (
                    <div className="space-y-1.5">{entregas.map((e, i) => <div key={i} className="text-xs text-stone-600"><CheckCircle2 size={11} className="inline mr-1 text-green-600" /><b className="text-stone-800">{e.alumno}</b> · {fechaHora(e.entregada_en)}{e.comentario ? ` · "${e.comentario}"` : ''}</div>)}</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Materiales / Videos (mismo backend, distinto tipo) ──
function MaterialesTab({ modo, onChange }: { modo: 'materiales' | 'videos'; onChange: () => void }) {
  const esVideo = modo === 'videos';
  const [items, setItems] = useState<Material[]>([]);
  const [form, setForm] = useState(false);
  const [m, setM] = useState({ titulo: '', descripcion: '', tipo: (esVideo ? 'video' : 'enlace') as 'enlace' | 'texto' | 'video', url: '', contenido: '' });
  const [saving, setSaving] = useState(false);
  const cargar = () => api.get<{ materiales: Material[] }>('/aula/gestor/materiales').then((r) => setItems(r.materiales)).catch(() => {});
  useEffect(() => { cargar(); }, []);
  const visibles = items.filter((x) => (esVideo ? x.tipo === 'video' : x.tipo !== 'video'));
  async function crear() { if (!m.titulo.trim()) return; setSaving(true); try { await api.post('/aula/gestor/materiales', m); setM({ titulo: '', descripcion: '', tipo: esVideo ? 'video' : 'enlace', url: '', contenido: '' }); setForm(false); cargar(); onChange(); } finally { setSaving(false); } }
  async function borrar(id: number) { if (!confirm('¿Eliminar?')) return; await api.delete(`/aula/gestor/materiales/${id}`); cargar(); onChange(); }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <SecHeader icon={esVideo ? Video : BookOpen} titulo={esVideo ? 'Videos' : 'Materiales'} sub={esVideo ? 'Clases y repasos en video (YouTube, etc.).' : 'Lecturas, enlaces y notas de apoyo.'} />
        <BtnCrear label={esVideo ? 'Nuevo video' : 'Nuevo material'} on={form} toggle={() => setForm((v) => !v)} />
      </div>
      {form && (
        <div className="bg-white border border-stone-200 rounded-xl p-5 mb-4 space-y-3">
          <input className={inputCls} placeholder={esVideo ? 'Título del video' : 'Título del material'} value={m.titulo} onChange={(e) => setM((s) => ({ ...s, titulo: e.target.value }))} />
          <input className={inputCls} placeholder="Descripción (opcional)" value={m.descripcion} onChange={(e) => setM((s) => ({ ...s, descripcion: e.target.value }))} />
          {!esVideo && (
            <div className="flex gap-2">
              {(['enlace', 'texto'] as const).map((tp) => (
                <button key={tp} onClick={() => setM((s) => ({ ...s, tipo: tp }))} className={`px-3 py-1.5 text-xs font-semibold rounded-lg border ${m.tipo === tp ? 'text-white' : 'text-stone-600 border-stone-300'}`} style={m.tipo === tp ? { background: G, borderColor: G } : undefined}>{tp === 'enlace' ? 'Enlace' : 'Texto/Nota'}</button>
              ))}
            </div>
          )}
          {(esVideo || m.tipo === 'enlace' || m.tipo === 'video')
            ? <input className={inputCls} placeholder={esVideo ? 'https://youtu.be/… (o cualquier enlace)' : 'https://… (video, PDF, drive, etc.)'} value={m.url} onChange={(e) => setM((s) => ({ ...s, url: e.target.value }))} />
            : <textarea className={inputCls} rows={4} placeholder="Contenido / nota" value={m.contenido} onChange={(e) => setM((s) => ({ ...s, contenido: e.target.value }))} />}
          <button onClick={crear} disabled={saving || !m.titulo.trim()} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-40" style={{ background: G }}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Publicar</button>
        </div>
      )}
      {visibles.length === 0 ? <Vacio icon={esVideo ? PlayCircle : BookOpen} texto={esVideo ? 'Aún no hay videos.' : 'Aún no hay materiales.'} /> : esVideo ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {visibles.map((it) => { const emb = ytEmbed(it.url); return (
            <div key={it.id} className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              {emb ? <div className="aspect-video bg-black"><iframe src={emb} title={it.titulo} className="w-full h-full" allowFullScreen /></div>
                : <a href={it.url ?? '#'} target="_blank" rel="noreferrer" className="aspect-video flex items-center justify-center bg-stone-900 text-white"><PlayCircle size={40} /></a>}
              <div className="p-3 flex items-start justify-between gap-2">
                <div className="min-w-0"><div className="font-semibold text-sm text-stone-900 truncate">{it.titulo}</div>{it.descripcion && <div className="text-xs text-stone-500 truncate">{it.descripcion}</div>}</div>
                <button onClick={() => borrar(it.id)} className="shrink-0 text-stone-400 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            </div>
          ); })}
        </div>
      ) : (
        <div className="space-y-2.5">
          {visibles.map((it) => (
            <div key={it.id} className="bg-white border border-stone-200 rounded-xl p-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-semibold text-stone-900">{it.tipo === 'enlace' ? <Link2 size={15} style={{ color: G }} /> : <FileText size={15} style={{ color: G }} />}{it.titulo}</div>
                {it.descripcion && <div className="text-sm text-stone-600 mt-0.5">{it.descripcion}</div>}
                {it.tipo === 'enlace' && it.url && <a href={it.url} target="_blank" rel="noreferrer" className="text-xs font-semibold break-all" style={{ color: G }}>{it.url}</a>}
                {it.tipo === 'texto' && it.contenido && <div className="text-sm text-stone-600 mt-1 whitespace-pre-wrap">{it.contenido}</div>}
              </div>
              <button onClick={() => borrar(it.id)} className="shrink-0 text-stone-400 hover:text-red-500"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Anuncios ──
function AnunciosTab({ onChange }: { onChange: () => void }) {
  const [items, setItems] = useState<Anuncio[]>([]);
  const [form, setForm] = useState(false);
  const [a, setA] = useState({ titulo: '', cuerpo: '' });
  const [saving, setSaving] = useState(false);
  const cargar = () => api.get<{ anuncios: Anuncio[] }>('/aula/gestor/anuncios').then((r) => setItems(r.anuncios)).catch(() => {});
  useEffect(() => { cargar(); }, []);
  async function crear() { if (!a.titulo.trim() || !a.cuerpo.trim()) return; setSaving(true); try { await api.post('/aula/gestor/anuncios', a); setA({ titulo: '', cuerpo: '' }); setForm(false); cargar(); onChange(); } finally { setSaving(false); } }
  async function borrar(id: number) { if (!confirm('¿Eliminar este anuncio?')) return; await api.delete(`/aula/gestor/anuncios/${id}`); cargar(); onChange(); }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <SecHeader icon={Megaphone} titulo="Anuncios del aula" sub="Avisos que verán todos tus alumnos." />
        <BtnCrear label="Nuevo anuncio" on={form} toggle={() => setForm((v) => !v)} />
      </div>
      {form && (
        <div className="bg-white border border-stone-200 rounded-xl p-5 mb-4 space-y-3">
          <input className={inputCls} placeholder="Título del anuncio" value={a.titulo} onChange={(e) => setA((s) => ({ ...s, titulo: e.target.value }))} />
          <textarea className={inputCls} rows={3} placeholder="Mensaje para tus alumnos" value={a.cuerpo} onChange={(e) => setA((s) => ({ ...s, cuerpo: e.target.value }))} />
          <button onClick={crear} disabled={saving || !a.titulo.trim() || !a.cuerpo.trim()} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-40" style={{ background: G }}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Publicar</button>
        </div>
      )}
      {items.length === 0 ? <Vacio icon={Megaphone} texto="Aún no hay anuncios de aula." /> : (
        <div className="space-y-2.5">
          {items.map((it) => (
            <div key={it.id} className="bg-white border border-stone-200 rounded-xl p-4 flex items-start justify-between gap-3">
              <div className="min-w-0"><div className="font-semibold text-stone-900">{it.titulo}</div><div className="text-sm text-stone-600 mt-0.5 whitespace-pre-wrap">{it.cuerpo}</div><div className="text-[11px] text-stone-400 mt-1">{fechaHora(it.createdAt)}</div></div>
              <button onClick={() => borrar(it.id)} className="shrink-0 text-stone-400 hover:text-red-500"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
