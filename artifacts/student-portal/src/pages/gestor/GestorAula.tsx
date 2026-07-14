/**
 * Aula virtual del gestor (LMS-lite estilo Canvas). Panel propio con banner de
 * "curso" + sub-navegación (Resumen · Foro · Anuncios · Tareas · Materiales · Videos).
 * Solo visible si el aula del gestor está habilitada.
 */
import { useEffect, useRef, useState } from 'react';
import { AulaShell } from '../../components/AulaShell';
import { ForoAula } from '../../components/ForoAula';
import {
  School, ClipboardList, BookOpen, Megaphone, Plus, Trash2, Users, Link2, FileText,
  Loader2, CalendarClock, LayoutDashboard, Video, PlayCircle, CheckCircle2, ChevronRight,
  Inbox, MessageCircle, Pin, PinOff, ImagePlus, X, Clock, Download, Paperclip,
} from 'lucide-react';
import { api } from '../../lib/api';
import { ytEmbed, VideoFrame } from '../../components/VideoEmbed';

type Sec = 'resumen' | 'foro' | 'anuncios' | 'tareas' | 'materiales' | 'videos';

interface Tarea { id: number; titulo: string; instrucciones: string | null; fechaEntrega: string | null; createdAt: string; entregas: number }
interface Material { id: number; titulo: string; descripcion: string | null; tipo: string; url: string | null; contenido: string | null; archivoNombre: string | null; createdAt: string }
interface Anuncio { id: number; titulo: string; cuerpo: string; fijado: boolean; programadoPara: string | null; tieneImagen: boolean; createdAt: string }
interface Entrega { id: number; alumno: string; estado: string; comentario: string | null; archivoNombre: string | null; entregada_en: string }
interface Resumen { tareas: number; materiales: number; anuncios: number; alumnos: number }

const G = 'var(--color-guinda-700)';
function fecha(s: string | null) { return s ? new Date(s).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }
function fechaHora(s: string) { return new Date(s).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }); }
const inputCls = 'w-full text-sm border border-stone-300 rounded-lg px-3 py-2 focus:border-[var(--color-guinda-500)] focus:outline-none';

export default function GestorAula() {
  const [sec, setSec] = useState<Sec>('resumen');
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const cargarResumen = () => api.get<Resumen>('/aula/gestor/resumen').then(setResumen).catch(() => {});
  useEffect(() => { cargarResumen(); }, []);

  const NAV = [
    { k: 'resumen' as Sec, label: 'Resumen', icon: LayoutDashboard },
    { k: 'foro' as Sec, label: 'Foro', icon: MessageCircle },
    { k: 'anuncios' as Sec, label: 'Anuncios', icon: Megaphone, n: resumen?.anuncios },
    { k: 'tareas' as Sec, label: 'Tareas', icon: ClipboardList, n: resumen?.tareas },
    { k: 'materiales' as Sec, label: 'Materiales', icon: BookOpen, n: resumen?.materiales },
    { k: 'videos' as Sec, label: 'Videos', icon: Video },
  ];

  return (
    <AulaShell rol="gestor" volverHref="/gestor" sec={sec} setSec={setSec} nav={NAV}>
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

      {sec === 'resumen' && <ResumenSec resumen={resumen} ir={setSec} />}
      {sec === 'foro' && <ForoAula />}
      {sec === 'anuncios' && <AnunciosTab onChange={cargarResumen} />}
      {sec === 'tareas' && <TareasTab onChange={cargarResumen} />}
      {sec === 'materiales' && <MaterialesTab modo="materiales" onChange={cargarResumen} />}
      {sec === 'videos' && <MaterialesTab modo="videos" onChange={cargarResumen} />}
    </AulaShell>
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
function ResumenSec({ resumen, ir }: { resumen: Resumen | null; ir: (s: Sec) => void }) {
  const cards: { k: Sec; label: string; desc: string; icon: typeof LayoutDashboard; n?: number }[] = [
    { k: 'anuncios', label: 'Anuncios', desc: 'Con imagen, fijados y programados', icon: Megaphone, n: resumen?.anuncios },
    { k: 'tareas', label: 'Tareas', desc: 'Asignaciones con entrega de archivos', icon: ClipboardList, n: resumen?.tareas },
    { k: 'materiales', label: 'Materiales', desc: 'Lecturas, archivos, enlaces y notas', icon: BookOpen, n: resumen?.materiales },
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
      <div className="flex items-start justify-between gap-3 mb-4">
        <SecHeader icon={ClipboardList} titulo="Tareas" sub="Publica asignaciones; tus alumnos entregan con comentario y archivo." />
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
          {items.map((it) => {
            const pct = totalAlumnos > 0 ? Math.round((it.entregas / totalAlumnos) * 100) : 0;
            return (
            <div key={it.id} className="bg-white border border-stone-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-stone-900">{it.titulo}</div>
                  {it.instrucciones && <div className="text-sm text-stone-600 mt-0.5 whitespace-pre-wrap">{it.instrucciones}</div>}
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-stone-500">
                    {it.fechaEntrega && <span className="inline-flex items-center gap-1"><CalendarClock size={12} /> Entrega: {fecha(it.fechaEntrega)}</span>}
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
                <button onClick={() => borrar(it.id)} className="shrink-0 text-stone-400 hover:text-red-500" aria-label="Eliminar tarea"><Trash2 size={15} /></button>
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
function MaterialesTab({ modo, onChange }: { modo: 'materiales' | 'videos'; onChange: () => void }) {
  const esVideo = modo === 'videos';
  const [items, setItems] = useState<Material[]>([]);
  const [form, setForm] = useState(false);
  const [m, setM] = useState({ titulo: '', descripcion: '', tipo: (esVideo ? 'video' : 'enlace') as 'enlace' | 'texto' | 'video' | 'archivo', url: '', contenido: '' });
  const [archivo, setArchivo] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const cargar = () => api.get<{ materiales: Material[] }>('/aula/gestor/materiales').then((r) => setItems(r.materiales)).catch(() => {});
  useEffect(() => { cargar(); }, []);
  const visibles = items.filter((x) => (esVideo ? x.tipo === 'video' : x.tipo !== 'video'));
  async function crear() {
    if (!m.titulo.trim()) return;
    setSaving(true); setErr('');
    try {
      const fd = new FormData();
      fd.append('titulo', m.titulo); fd.append('descripcion', m.descripcion); fd.append('tipo', m.tipo);
      fd.append('url', m.url); fd.append('contenido', m.contenido);
      if (m.tipo === 'archivo' && archivo) fd.append('archivo', archivo);
      await api.post('/aula/gestor/materiales', fd);
      setM({ titulo: '', descripcion: '', tipo: esVideo ? 'video' : 'enlace', url: '', contenido: '' });
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
            : <textarea className={inputCls} rows={4} placeholder="Contenido / nota" value={m.contenido} onChange={(e) => setM((s) => ({ ...s, contenido: e.target.value }))} />}
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
        {it.tipo === 'texto' && it.contenido && <div className="text-sm text-stone-600 mt-1 whitespace-pre-wrap">{it.contenido}</div>}
      </div>
      {onBorrar && <button onClick={onBorrar} className="shrink-0 text-stone-400 hover:text-red-500" aria-label="Eliminar material"><Trash2 size={15} /></button>}
    </div>
  );
}

// ── Anuncios ──
function AnunciosTab({ onChange }: { onChange: () => void }) {
  const [items, setItems] = useState<Anuncio[]>([]);
  const [form, setForm] = useState(false);
  const [a, setA] = useState({ titulo: '', cuerpo: '', fijado: false, programadoPara: '' });
  const [imagen, setImagen] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const imgRef = useRef<HTMLInputElement>(null);
  const cargar = () => api.get<{ anuncios: Anuncio[] }>('/aula/gestor/anuncios').then((r) => setItems(r.anuncios)).catch(() => {});
  useEffect(() => { cargar(); }, []);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  function elegirImagen(f: File | null) {
    if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
    setImagen(f);
    if (f) setPreviewUrl(URL.createObjectURL(f));
  }
  async function crear() {
    if (!a.titulo.trim() || !a.cuerpo.trim()) return;
    setSaving(true); setErr('');
    try {
      const fd = new FormData();
      fd.append('titulo', a.titulo); fd.append('cuerpo', a.cuerpo);
      fd.append('fijado', String(a.fijado));
      if (a.programadoPara) fd.append('programadoPara', new Date(a.programadoPara).toISOString());
      if (imagen) fd.append('imagen', imagen);
      await api.post('/aula/gestor/anuncios', fd);
      setA({ titulo: '', cuerpo: '', fijado: false, programadoPara: '' });
      elegirImagen(null); if (imgRef.current) imgRef.current.value = '';
      setForm(false); cargar(); onChange();
    } catch (e) { setErr(e instanceof Error ? e.message : 'No se pudo publicar.'); }
    finally { setSaving(false); }
  }
  async function fijar(id: number) { await api.patch(`/aula/gestor/anuncios/${id}/fijar`, {}); cargar(); }
  async function borrar(id: number) { if (!confirm('¿Eliminar este anuncio?')) return; await api.delete(`/aula/gestor/anuncios/${id}`); cargar(); onChange(); }

  const ahora = Date.now();

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-4">
        <SecHeader icon={Megaphone} titulo="Anuncios del aula" sub="Con imagen, fijados arriba o programados para publicarse después." />
        <BtnCrear label="Nuevo anuncio" on={form} toggle={() => setForm((v) => !v)} />
      </div>
      {form && (
        <div className="bg-white border border-stone-200 rounded-xl p-5 mb-4 space-y-3">
          <input className={inputCls} placeholder="Título del anuncio" value={a.titulo} onChange={(e) => setA((s) => ({ ...s, titulo: e.target.value }))} />
          <textarea className={inputCls} rows={3} placeholder="Mensaje para tus alumnos" value={a.cuerpo} onChange={(e) => setA((s) => ({ ...s, cuerpo: e.target.value }))} />

          {/* Imagen opcional */}
          <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={(e) => elegirImagen(e.target.files?.[0] ?? null)} />
          {previewUrl ? (
            <div className="relative inline-block">
              <img src={previewUrl} alt="" className="max-h-40 rounded-lg border border-stone-200" />
              <button onClick={() => { elegirImagen(null); if (imgRef.current) imgRef.current.value = ''; }} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border border-stone-200 flex items-center justify-center text-stone-500 hover:text-red-500 shadow" aria-label="Quitar imagen"><X size={13} /></button>
            </div>
          ) : (
            <button onClick={() => imgRef.current?.click()} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-dashed border-stone-300 text-stone-500 hover:border-[var(--color-guinda-500)] hover:text-[var(--color-guinda-700)] transition-colors">
              <ImagePlus size={14} /> Agregar imagen
            </button>
          )}

          {/* Opciones pro: fijar + programar */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-stone-600 cursor-pointer">
              <input type="checkbox" checked={a.fijado} onChange={(e) => setA((s) => ({ ...s, fijado: e.target.checked }))} className="accent-[var(--color-guinda-700)]" />
              <Pin size={13} /> Fijar arriba
            </label>
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-stone-600">
              <Clock size={13} /> Programar publicación
              <input type="datetime-local" className="text-xs border border-stone-300 rounded-lg px-2 py-1.5 focus:border-[var(--color-guinda-500)] focus:outline-none" value={a.programadoPara} onChange={(e) => setA((s) => ({ ...s, programadoPara: e.target.value }))} />
            </label>
          </div>
          {a.programadoPara && <div className="text-[11px] text-stone-500">Se publicará automáticamente el {fechaHora(a.programadoPara)}. Hasta entonces tus alumnos no lo verán.</div>}
          {err && <div className="text-xs font-semibold text-red-600">{err}</div>}
          <button onClick={crear} disabled={saving || !a.titulo.trim() || !a.cuerpo.trim()} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-40" style={{ background: G }}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} {a.programadoPara ? 'Programar' : 'Publicar'}</button>
        </div>
      )}
      {items.length === 0 ? <Vacio icon={Megaphone} texto="Aún no hay anuncios de aula." /> : (
        <div className="space-y-2.5">
          {items.map((it) => {
            const programado = !!it.programadoPara && new Date(it.programadoPara).getTime() > ahora;
            return (
            <div key={it.id} className="bg-white border rounded-xl overflow-hidden" style={{ borderColor: it.fijado ? 'var(--color-guinda-300, #d8a48f)' : '#e7e5e4' }}>
              {it.tieneImagen && <img src={`/api/aula/anuncios/${it.id}/imagen`} alt="" className="w-full max-h-56 object-cover" loading="lazy" />}
              <div className="p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-stone-900">{it.titulo}</span>
                    {it.fijado && <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded text-white" style={{ background: G }}><Pin size={9} /> Fijado</span>}
                    {programado && <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: '#fef3c7', color: '#92400e' }}><Clock size={9} /> Programado · {fechaHora(it.programadoPara!)}</span>}
                  </div>
                  <div className="text-sm text-stone-600 mt-0.5 whitespace-pre-wrap">{it.cuerpo}</div>
                  <div className="text-[11px] text-stone-400 mt-1">{fechaHora(it.createdAt)}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => fijar(it.id)} className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 hover:text-[var(--color-guinda-700)]" title={it.fijado ? 'Desfijar' : 'Fijar arriba'} aria-label={it.fijado ? 'Desfijar' : 'Fijar'}>
                    {it.fijado ? <PinOff size={15} /> : <Pin size={15} />}
                  </button>
                  <button onClick={() => borrar(it.id)} className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 hover:text-red-500" aria-label="Eliminar anuncio"><Trash2 size={15} /></button>
                </div>
              </div>
            </div>
          ); })}
        </div>
      )}
    </div>
  );
}
