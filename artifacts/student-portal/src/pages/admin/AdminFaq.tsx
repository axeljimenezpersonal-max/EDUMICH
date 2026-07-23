/**
 * Administración de Preguntas frecuentes: alta, edición, baja y activación.
 * Lo que se guarda aquí aparece en la sección "Preguntas frecuentes" del alumno
 * y del gestor (según la audiencia).
 */
import { useEffect, useState } from 'react';
import { AdminLayout } from './AdminLayout';
import { api } from '../../lib/api';
import { HelpCircle, Plus, Pencil, Trash2, Loader2, X, Check, AlertCircle } from 'lucide-react';

interface Faq {
  id: number;
  pregunta: string;
  respuesta: string;
  categoria: string;
  audiencia: string;
  orden: number;
  activa: boolean;
}
type Form = Omit<Faq, 'id'>;

const AUDIENCIAS = [
  { v: 'ambos', l: 'Alumno y gestor' },
  { v: 'estudiante', l: 'Solo alumno' },
  { v: 'gestor', l: 'Solo gestor' },
];
const VACIO: Form = { pregunta: '', respuesta: '', categoria: 'General', audiencia: 'ambos', orden: 0, activa: true };

export default function AdminFaq() {
  const [faqs, setFaqs] = useState<Faq[] | null>(null);
  const [modal, setModal] = useState<null | { id: number | null; form: Form }>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [borrando, setBorrando] = useState<number | null>(null);

  function cargar() {
    api.get<{ preguntas: Faq[] }>('/admin/faq').then((r) => setFaqs(r.preguntas)).catch(() => setFaqs([]));
  }
  useEffect(() => { cargar(); }, []);

  function abrirNueva() { setError(null); setModal({ id: null, form: { ...VACIO } }); }
  function abrirEditar(f: Faq) { setError(null); setModal({ id: f.id, form: { pregunta: f.pregunta, respuesta: f.respuesta, categoria: f.categoria, audiencia: f.audiencia, orden: f.orden, activa: f.activa } }); }

  async function guardar() {
    if (!modal) return;
    setGuardando(true); setError(null);
    try {
      if (modal.id === null) await api.post('/admin/faq', modal.form);
      else await api.patch(`/admin/faq/${modal.id}`, modal.form);
      setModal(null);
      cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  }

  async function toggleActiva(f: Faq) {
    await api.patch(`/admin/faq/${f.id}`, { activa: !f.activa }).catch(() => {});
    setFaqs((prev) => prev?.map((x) => (x.id === f.id ? { ...x, activa: !x.activa } : x)) ?? prev);
  }

  async function eliminar(id: number) {
    setBorrando(null);
    await api.delete(`/admin/faq/${id}`).catch(() => {});
    setFaqs((prev) => prev?.filter((x) => x.id !== id) ?? prev);
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setModal((m) => (m ? { ...m, form: { ...m.form, [k]: v } } : m));
  const inputCls = 'w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-guinda-700)]';

  return (
    <AdminLayout>
      <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-guinda-700)] flex items-center gap-1.5">
            <HelpCircle size={14} /> Ayuda
          </div>
          <h1 className="font-serif text-2xl font-bold text-stone-900">Preguntas frecuentes</h1>
        </div>
        <button onClick={abrirNueva} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--color-guinda-700)] text-white text-sm font-semibold hover:bg-[var(--color-guinda-800)]">
          <Plus size={15} /> Nueva pregunta
        </button>
      </div>
      <p className="text-stone-500 text-sm mb-5">Lo que agregues aquí aparece en la sección de ayuda del alumno y del gestor.</p>

      {faqs === null ? (
        <div className="flex items-center justify-center gap-2 text-sm text-stone-400 py-16"><Loader2 size={18} className="animate-spin" /> Cargando…</div>
      ) : faqs.length === 0 ? (
        <div className="border-2 border-dashed border-stone-200 rounded-xl p-12 text-center">
          <HelpCircle size={30} className="mx-auto text-stone-300 mb-3" />
          <div className="font-bold text-stone-900 mb-1">Aún no hay preguntas</div>
          <p className="text-sm text-stone-500">Agrega la primera con "Nueva pregunta".</p>
        </div>
      ) : (
        <div className="space-y-2">
          {faqs.map((f) => (
            <div key={f.id} className={`rounded-xl border bg-white p-4 ${f.activa ? 'border-stone-200' : 'border-stone-100 opacity-60'}`}>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-sm font-bold text-stone-900">{f.pregunta}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-500">{f.categoria}</span>
                    <span className="text-[10px] text-stone-400">{AUDIENCIAS.find((a) => a.v === f.audiencia)?.l ?? f.audiencia}</span>
                    {!f.activa && <span className="text-[10px] font-bold text-amber-700">Oculta</span>}
                  </div>
                  <div className="text-xs text-stone-500 line-clamp-2">{f.respuesta}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => toggleActiva(f)} title={f.activa ? 'Ocultar' : 'Mostrar'} className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100">
                    <Check size={15} className={f.activa ? 'text-emerald-600' : 'text-stone-300'} />
                  </button>
                  <button onClick={() => abrirEditar(f)} title="Editar" className="p-1.5 rounded-lg text-stone-400 hover:text-[var(--color-guinda-700)] hover:bg-stone-100"><Pencil size={15} /></button>
                  <button onClick={() => setBorrando(f.id)} title="Eliminar" className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={15} /></button>
                </div>
              </div>
              {borrando === f.id && (
                <div className="mt-3 flex items-center justify-end gap-2 border-t border-stone-100 pt-3">
                  <span className="text-xs text-stone-500 mr-auto">¿Eliminar esta pregunta?</span>
                  <button onClick={() => setBorrando(null)} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-stone-300 text-stone-600">Cancelar</button>
                  <button onClick={() => eliminar(f.id)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-600 text-white">Sí, eliminar</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal alta/edición */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => !guardando && setModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
              <h3 className="font-serif text-base font-bold text-stone-900">{modal.id === null ? 'Nueva pregunta' : 'Editar pregunta'}</h3>
              <button onClick={() => setModal(null)} className="text-stone-400 hover:text-stone-700"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Pregunta</label>
                <input className={inputCls} value={modal.form.pregunta} onChange={(e) => set('pregunta', e.target.value)} placeholder="¿Cómo…?" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Respuesta</label>
                <textarea className={inputCls} rows={4} value={modal.form.respuesta} onChange={(e) => set('respuesta', e.target.value)} placeholder="La respuesta clara y directa." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Categoría (badge)</label>
                  <input className={inputCls} value={modal.form.categoria} onChange={(e) => set('categoria', e.target.value)} placeholder="Pagos, Alumnos…" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Se muestra a</label>
                  <select className={inputCls} value={modal.form.audiencia} onChange={(e) => set('audiencia', e.target.value)}>
                    {AUDIENCIAS.map((a) => <option key={a.v} value={a.v}>{a.l}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Orden</label>
                  <input type="number" className={inputCls} value={modal.form.orden} onChange={(e) => set('orden', Number(e.target.value) || 0)} />
                </div>
                <label className="flex items-center gap-2 text-sm text-stone-700 pb-2 cursor-pointer">
                  <input type="checkbox" checked={modal.form.activa} onChange={(e) => set('activa', e.target.checked)} className="w-4 h-4 accent-[var(--color-guinda-700)]" />
                  Visible
                </label>
              </div>
              {error && <div className="text-xs text-red-600 bg-red-50 rounded p-2 flex items-center gap-1.5"><AlertCircle size={13} /> {error}</div>}
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 rounded-lg border border-stone-300 text-stone-700 text-sm font-semibold hover:bg-stone-50">Cancelar</button>
              <button onClick={guardar} disabled={guardando || !modal.form.pregunta.trim() || !modal.form.respuesta.trim()} className="flex-1 py-2.5 rounded-lg bg-[var(--color-guinda-700)] text-white text-sm font-semibold hover:bg-[var(--color-guinda-800)] disabled:opacity-50 flex items-center justify-center gap-2">
                {guardando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
