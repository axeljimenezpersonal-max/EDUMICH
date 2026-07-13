/**
 * Aula virtual del alumno: lo que su gestor (centro de asesoría) publica —
 * anuncios, tareas (que puede marcar como entregadas) y materiales. Solo si su
 * gestor tiene el aula habilitada. Es aparte de sus módulos/pruebas oficiales.
 */
import { useEffect, useState } from 'react';
import { EstudianteLayout } from './EstudianteLayout';
import { School, Megaphone, ClipboardList, BookOpen, Link2, FileText, CheckCircle2, CalendarClock, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';

interface Tarea { id: number; titulo: string; instrucciones: string | null; fechaEntrega: string | null; createdAt: string; miEstado: string | null; miComentario: string | null }
interface Material { id: number; titulo: string; descripcion: string | null; tipo: string; url: string | null; contenido: string | null }
interface Anuncio { id: number; titulo: string; cuerpo: string; createdAt: string }
interface MiAula { habilitada: boolean; gestor?: { nombre: string; centro: string | null }; tareas: Tarea[]; materiales: Material[]; anuncios: Anuncio[] }

const G = 'var(--color-guinda-700)';
function fecha(s: string | null) { return s ? new Date(s).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : ''; }
function fechaHora(s: string) { return new Date(s).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }); }

export default function AlumnoAula() {
  const [d, setD] = useState<MiAula | null>(null);
  const cargar = () => api.get<MiAula>('/aula/mi-aula').then(setD).catch(() => setD({ habilitada: false, tareas: [], materiales: [], anuncios: [] }));
  useEffect(() => { cargar(); }, []);

  return (
    <EstudianteLayout>
      <div className="mb-5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: G }}>
          <School size={14} /> Aula de mi centro
        </div>
        <h1 className="font-serif text-2xl font-bold text-stone-900">Aula virtual</h1>
        {d?.gestor && <p className="text-sm text-stone-500 mt-0.5">{d.gestor.centro || d.gestor.nombre}</p>}
      </div>

      {!d ? (
        <div className="h-40 rounded-xl animate-pulse bg-stone-100" />
      ) : !d.habilitada ? (
        <div className="border-2 border-dashed border-stone-200 rounded-xl p-10 text-center text-sm text-stone-400">
          Tu centro de asesoría no tiene aula virtual activa.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Anuncios */}
          {d.anuncios.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-sm font-bold text-stone-800 mb-2"><Megaphone size={15} style={{ color: G }} /> Anuncios</h2>
              <div className="space-y-2">
                {d.anuncios.map((a) => (
                  <div key={a.id} className="bg-white border border-stone-200 rounded-xl p-4">
                    <div className="font-semibold text-stone-900">{a.titulo}</div>
                    <div className="text-sm text-stone-600 mt-0.5 whitespace-pre-wrap">{a.cuerpo}</div>
                    <div className="text-[11px] text-stone-400 mt-1">{fechaHora(a.createdAt)}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Tareas */}
          <section>
            <h2 className="flex items-center gap-2 text-sm font-bold text-stone-800 mb-2"><ClipboardList size={15} style={{ color: G }} /> Tareas</h2>
            {d.tareas.length === 0 ? <Vacio texto="No tienes tareas asignadas." /> : (
              <div className="space-y-2.5">
                {d.tareas.map((t) => <TareaCard key={t.id} t={t} onDone={cargar} />)}
              </div>
            )}
          </section>

          {/* Materiales */}
          <section>
            <h2 className="flex items-center gap-2 text-sm font-bold text-stone-800 mb-2"><BookOpen size={15} style={{ color: G }} /> Materiales de apoyo</h2>
            {d.materiales.length === 0 ? <Vacio texto="Aún no hay materiales." /> : (
              <div className="space-y-2.5">
                {d.materiales.map((m) => (
                  <div key={m.id} className="bg-white border border-stone-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 font-semibold text-stone-900">
                      {m.tipo === 'enlace' ? <Link2 size={15} style={{ color: G }} /> : <FileText size={15} style={{ color: G }} />}{m.titulo}
                    </div>
                    {m.descripcion && <div className="text-sm text-stone-600 mt-0.5">{m.descripcion}</div>}
                    {m.tipo === 'enlace' && m.url && <a href={m.url} target="_blank" rel="noreferrer" className="text-xs font-semibold break-all" style={{ color: G }}>Abrir enlace →</a>}
                    {m.tipo === 'texto' && m.contenido && <div className="text-sm text-stone-600 mt-1 whitespace-pre-wrap">{m.contenido}</div>}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </EstudianteLayout>
  );
}

function TareaCard({ t, onDone }: { t: Tarea; onDone: () => void }) {
  const [abrir, setAbrir] = useState(false);
  const [comentario, setComentario] = useState(t.miComentario ?? '');
  const [saving, setSaving] = useState(false);
  const entregada = !!t.miEstado;

  async function entregar() {
    setSaving(true);
    try { await api.post(`/aula/tareas/${t.id}/entregar`, { comentario }); onDone(); setAbrir(false); }
    finally { setSaving(false); }
  }

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
        <button onClick={() => setAbrir(true)} className="mt-3 text-xs font-semibold" style={{ color: G }}>
          {entregada ? 'Editar mi entrega' : 'Marcar como entregada'} →
        </button>
      ) : (
        <div className="mt-3 space-y-2">
          <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={2} placeholder="Comentario para tu gestor (opcional)"
            className="w-full text-sm border border-stone-300 rounded-lg px-3 py-2 focus:border-[var(--color-guinda-500)] focus:outline-none" />
          <div className="flex gap-2">
            <button onClick={entregar} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-40" style={{ background: G }}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} {entregada ? 'Actualizar' : 'Entregar'}
            </button>
            <button onClick={() => setAbrir(false)} className="px-4 py-2 text-sm font-medium rounded-lg border border-stone-300 text-stone-600">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Vacio({ texto }: { texto: string }) {
  return <div className="border-2 border-dashed border-stone-200 rounded-xl p-8 text-center text-sm text-stone-400">{texto}</div>;
}
