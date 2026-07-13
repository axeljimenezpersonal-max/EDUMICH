/**
 * Aula virtual del gestor (LMS-lite). Solo visible si su aula está habilitada.
 * Tres pestañas: Tareas, Materiales y Anuncios de aula.
 */
import { useEffect, useState } from 'react';
import { GestorLayout } from './GestorLayout';
import {
  School, ClipboardList, BookOpen, Megaphone, Plus, Trash2, Users, Link2, FileText, X, Loader2, CalendarClock,
} from 'lucide-react';
import { api } from '../../lib/api';

type Tab = 'tareas' | 'materiales' | 'anuncios';

interface Tarea { id: number; titulo: string; instrucciones: string | null; fechaEntrega: string | null; createdAt: string; entregas: number }
interface Material { id: number; titulo: string; descripcion: string | null; tipo: string; url: string | null; contenido: string | null; createdAt: string }
interface Anuncio { id: number; titulo: string; cuerpo: string; createdAt: string }
interface Entrega { alumno: string; estado: string; comentario: string | null; entregada_en: string }

const G = 'var(--color-guinda-700)';
function fecha(s: string | null) { return s ? new Date(s).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }
function fechaHora(s: string) { return new Date(s).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }); }

export default function GestorAula() {
  const [tab, setTab] = useState<Tab>('tareas');
  const [resumen, setResumen] = useState<{ tareas: number; materiales: number; anuncios: number; alumnos: number } | null>(null);

  const cargarResumen = () => api.get<typeof resumen>('/aula/gestor/resumen').then(setResumen).catch(() => {});
  useEffect(() => { cargarResumen(); }, []);

  return (
    <GestorLayout>
      <div className="mb-5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: G }}>
          <School size={14} /> Módulo del centro
        </div>
        <h1 className="font-serif text-2xl font-bold text-stone-900">Aula virtual</h1>
        <p className="text-sm text-stone-500 mt-0.5">Publica tareas, materiales y anuncios para tus alumnos. (Los módulos/pruebas oficiales del alumno son aparte.)</p>
      </div>

      {resumen && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Alumnos', v: resumen.alumnos, icon: Users },
            { label: 'Tareas', v: resumen.tareas, icon: ClipboardList },
            { label: 'Materiales', v: resumen.materiales, icon: BookOpen },
            { label: 'Anuncios', v: resumen.anuncios, icon: Megaphone },
          ].map((c) => (
            <div key={c.label} className="rounded-xl border border-stone-200 bg-white p-3.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2 bg-[var(--color-crema-100)]" style={{ color: G }}><c.icon size={15} /></div>
              <div className="text-xl font-bold text-stone-900">{c.v}</div>
              <div className="text-[11px] text-stone-500">{c.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Pestañas */}
      <div className="flex gap-1 rounded-lg bg-stone-100 p-1 mb-5 max-w-md">
        {([['tareas', 'Tareas', ClipboardList], ['materiales', 'Materiales', BookOpen], ['anuncios', 'Anuncios', Megaphone]] as const).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${tab === k ? 'bg-white shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
            style={tab === k ? { color: G } : undefined}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === 'tareas' && <TareasTab onChange={cargarResumen} />}
      {tab === 'materiales' && <MaterialesTab onChange={cargarResumen} />}
      {tab === 'anuncios' && <AnunciosTab onChange={cargarResumen} />}
    </GestorLayout>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="bg-white border border-stone-200 rounded-xl p-5">{children}</div>;
}
const inputCls = 'w-full text-sm border border-stone-300 rounded-lg px-3 py-2 focus:border-[var(--color-guinda-500)] focus:outline-none';

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

  async function crear() {
    if (!t.titulo.trim()) return;
    setSaving(true);
    try { await api.post('/aula/gestor/tareas', t); setT({ titulo: '', instrucciones: '', fechaEntrega: '' }); setForm(false); cargar(); onChange(); }
    finally { setSaving(false); }
  }
  async function borrar(id: number) { if (!confirm('¿Eliminar esta tarea?')) return; await api.delete(`/aula/gestor/tareas/${id}`); cargar(); onChange(); }
  async function verEntregas(id: number) {
    if (entregasDe === id) { setEntregasDe(null); return; }
    const r = await api.get<{ entregas: Entrega[] }>(`/aula/gestor/tareas/${id}/entregas`);
    setEntregas(r.entregas); setEntregasDe(id);
  }

  return (
    <div className="space-y-4">
      <button onClick={() => setForm((v) => !v)} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg text-white" style={{ background: G }}>
        <Plus size={15} /> Nueva tarea
      </button>
      {form && (
        <Panel>
          <div className="space-y-3">
            <input className={inputCls} placeholder="Título de la tarea" value={t.titulo} onChange={(e) => setT((s) => ({ ...s, titulo: e.target.value }))} />
            <textarea className={inputCls} rows={3} placeholder="Instrucciones (opcional)" value={t.instrucciones} onChange={(e) => setT((s) => ({ ...s, instrucciones: e.target.value }))} />
            <div>
              <label className="text-xs font-semibold text-stone-500 block mb-1">Fecha de entrega (opcional)</label>
              <input type="date" className={inputCls + ' max-w-[200px]'} value={t.fechaEntrega} onChange={(e) => setT((s) => ({ ...s, fechaEntrega: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <button onClick={crear} disabled={saving || !t.titulo.trim()} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-40" style={{ background: G }}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Publicar</button>
              <button onClick={() => setForm(false)} className="px-4 py-2 text-sm font-medium rounded-lg border border-stone-300 text-stone-600">Cancelar</button>
            </div>
          </div>
        </Panel>
      )}
      {items.length === 0 ? <Vacio texto="Aún no has publicado tareas." /> : (
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
                    <div className="space-y-1.5">
                      {entregas.map((e, i) => (
                        <div key={i} className="text-xs text-stone-600">
                          <b className="text-stone-800">{e.alumno}</b> · {fechaHora(e.entregada_en)}{e.comentario ? ` · "${e.comentario}"` : ''}
                        </div>
                      ))}
                    </div>
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

// ── Materiales ──
function MaterialesTab({ onChange }: { onChange: () => void }) {
  const [items, setItems] = useState<Material[]>([]);
  const [form, setForm] = useState(false);
  const [m, setM] = useState({ titulo: '', descripcion: '', tipo: 'enlace' as 'enlace' | 'texto', url: '', contenido: '' });
  const [saving, setSaving] = useState(false);

  const cargar = () => api.get<{ materiales: Material[] }>('/aula/gestor/materiales').then((r) => setItems(r.materiales)).catch(() => {});
  useEffect(() => { cargar(); }, []);
  async function crear() {
    if (!m.titulo.trim()) return;
    setSaving(true);
    try { await api.post('/aula/gestor/materiales', m); setM({ titulo: '', descripcion: '', tipo: 'enlace', url: '', contenido: '' }); setForm(false); cargar(); onChange(); }
    finally { setSaving(false); }
  }
  async function borrar(id: number) { if (!confirm('¿Eliminar este material?')) return; await api.delete(`/aula/gestor/materiales/${id}`); cargar(); onChange(); }

  return (
    <div className="space-y-4">
      <button onClick={() => setForm((v) => !v)} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg text-white" style={{ background: G }}><Plus size={15} /> Nuevo material</button>
      {form && (
        <Panel>
          <div className="space-y-3">
            <input className={inputCls} placeholder="Título del material" value={m.titulo} onChange={(e) => setM((s) => ({ ...s, titulo: e.target.value }))} />
            <input className={inputCls} placeholder="Descripción (opcional)" value={m.descripcion} onChange={(e) => setM((s) => ({ ...s, descripcion: e.target.value }))} />
            <div className="flex gap-2">
              {(['enlace', 'texto'] as const).map((tp) => (
                <button key={tp} onClick={() => setM((s) => ({ ...s, tipo: tp }))} className={`px-3 py-1.5 text-xs font-semibold rounded-lg border ${m.tipo === tp ? 'text-white' : 'text-stone-600 border-stone-300'}`} style={m.tipo === tp ? { background: G, borderColor: G } : undefined}>{tp === 'enlace' ? 'Enlace' : 'Texto/Nota'}</button>
              ))}
            </div>
            {m.tipo === 'enlace'
              ? <input className={inputCls} placeholder="https://… (video, PDF, drive, etc.)" value={m.url} onChange={(e) => setM((s) => ({ ...s, url: e.target.value }))} />
              : <textarea className={inputCls} rows={4} placeholder="Contenido / nota" value={m.contenido} onChange={(e) => setM((s) => ({ ...s, contenido: e.target.value }))} />}
            <div className="flex gap-2">
              <button onClick={crear} disabled={saving || !m.titulo.trim()} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-40" style={{ background: G }}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Publicar</button>
              <button onClick={() => setForm(false)} className="px-4 py-2 text-sm font-medium rounded-lg border border-stone-300 text-stone-600">Cancelar</button>
            </div>
          </div>
        </Panel>
      )}
      {items.length === 0 ? <Vacio texto="Aún no hay materiales." /> : (
        <div className="space-y-2.5">
          {items.map((it) => (
            <div key={it.id} className="bg-white border border-stone-200 rounded-xl p-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-semibold text-stone-900">
                  {it.tipo === 'enlace' ? <Link2 size={15} style={{ color: G }} /> : <FileText size={15} style={{ color: G }} />}{it.titulo}
                </div>
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
  async function crear() {
    if (!a.titulo.trim() || !a.cuerpo.trim()) return;
    setSaving(true);
    try { await api.post('/aula/gestor/anuncios', a); setA({ titulo: '', cuerpo: '' }); setForm(false); cargar(); onChange(); }
    finally { setSaving(false); }
  }
  async function borrar(id: number) { if (!confirm('¿Eliminar este anuncio?')) return; await api.delete(`/aula/gestor/anuncios/${id}`); cargar(); onChange(); }

  return (
    <div className="space-y-4">
      <button onClick={() => setForm((v) => !v)} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg text-white" style={{ background: G }}><Plus size={15} /> Nuevo anuncio</button>
      {form && (
        <Panel>
          <div className="space-y-3">
            <input className={inputCls} placeholder="Título del anuncio" value={a.titulo} onChange={(e) => setA((s) => ({ ...s, titulo: e.target.value }))} />
            <textarea className={inputCls} rows={3} placeholder="Mensaje para tus alumnos" value={a.cuerpo} onChange={(e) => setA((s) => ({ ...s, cuerpo: e.target.value }))} />
            <div className="flex gap-2">
              <button onClick={crear} disabled={saving || !a.titulo.trim() || !a.cuerpo.trim()} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-40" style={{ background: G }}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Publicar</button>
              <button onClick={() => setForm(false)} className="px-4 py-2 text-sm font-medium rounded-lg border border-stone-300 text-stone-600">Cancelar</button>
            </div>
          </div>
        </Panel>
      )}
      {items.length === 0 ? <Vacio texto="Aún no hay anuncios de aula." /> : (
        <div className="space-y-2.5">
          {items.map((it) => (
            <div key={it.id} className="bg-white border border-stone-200 rounded-xl p-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-stone-900">{it.titulo}</div>
                <div className="text-sm text-stone-600 mt-0.5 whitespace-pre-wrap">{it.cuerpo}</div>
                <div className="text-[11px] text-stone-400 mt-1">{fechaHora(it.createdAt)}</div>
              </div>
              <button onClick={() => borrar(it.id)} className="shrink-0 text-stone-400 hover:text-red-500"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Vacio({ texto }: { texto: string }) {
  return <div className="border-2 border-dashed border-stone-200 rounded-xl p-10 text-center text-sm text-stone-400"><X size={22} className="mx-auto mb-2 opacity-40" />{texto}</div>;
}
