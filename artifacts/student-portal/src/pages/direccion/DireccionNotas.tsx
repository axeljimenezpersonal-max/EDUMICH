/**
 * Notas del creador — recordatorios sueltos tipo post-it. Solo el creador ve y
 * edita las suyas. Se usan para pendientes rápidos (p. ej. "reactivar la Vista
 * general del sistema del admin").
 */
import { useEffect, useState } from 'react';
import { StickyNote, Plus, Trash2, Check, X } from 'lucide-react';
import { DireccionLayout } from './DireccionLayout';
import { api } from '../../lib/api';
import { avisar } from '../../components/Avisador';
import { confirmar } from '../../components/Confirmador';
import { fechaCorta } from '../../lib/fechas';

type Color = 'amarillo' | 'rosa' | 'azul' | 'verde' | 'guinda';
type Nota = { id: number; contenido: string; color: Color; updatedAt: string };

const COLORES: { c: Color; bg: string; borde: string; chip: string }[] = [
  { c: 'amarillo', bg: '#fef9c3', borde: '#fde047', chip: '#facc15' },
  { c: 'rosa', bg: '#fce7f3', borde: '#f9a8d4', chip: '#ec4899' },
  { c: 'azul', bg: '#dbeafe', borde: '#93c5fd', chip: '#3b82f6' },
  { c: 'verde', bg: '#dcfce7', borde: '#86efac', chip: '#22c55e' },
  { c: 'guinda', bg: '#f7e6ec', borde: '#e3b5c4', chip: 'var(--color-guinda-700)' },
];
const estilo = (c: Color) => COLORES.find((x) => x.c === c) ?? COLORES[0];

export default function DireccionNotas() {
  const [notas, setNotas] = useState<Nota[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nuevo, setNuevo] = useState('');
  const [nuevoColor, setNuevoColor] = useState<Color>('amarillo');
  const [guardando, setGuardando] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editTexto, setEditTexto] = useState('');

  function cargar() {
    setCargando(true);
    api.get<{ notas: Nota[] }>('/direccion/notas')
      .then((r) => setNotas(r.notas))
      .catch(() => setNotas([]))
      .finally(() => setCargando(false));
  }
  useEffect(cargar, []);

  async function agregar() {
    if (!nuevo.trim() || guardando) return;
    setGuardando(true);
    try {
      await api.post('/direccion/notas', { contenido: nuevo.trim(), color: nuevoColor });
      setNuevo('');
      cargar();
    } catch (e) {
      avisar((e as Error).message || 'No se pudo crear la nota.', 'error');
    } finally {
      setGuardando(false);
    }
  }

  async function guardarEdicion(id: number) {
    if (!editTexto.trim()) return;
    try {
      await api.patch(`/direccion/notas/${id}`, { contenido: editTexto.trim() });
      setEditId(null);
      cargar();
    } catch (e) {
      avisar((e as Error).message || 'No se pudo guardar.', 'error');
    }
  }

  async function cambiarColor(id: number, color: Color) {
    try {
      await api.patch(`/direccion/notas/${id}`, { color });
      setNotas((ns) => ns.map((n) => (n.id === id ? { ...n, color } : n)));
    } catch { /* ignore */ }
  }

  async function eliminar(id: number) {
    const ok = await confirmar({ title: 'Eliminar nota', message: 'Se eliminará esta nota.', confirmLabel: 'Eliminar', danger: true });
    if (!ok) return;
    try {
      await api.delete(`/direccion/notas/${id}`);
      cargar();
    } catch (e) {
      avisar((e as Error).message || 'No se pudo eliminar.', 'error');
    }
  }

  return (
    <DireccionLayout>
      <div className="mx-auto max-w-4xl px-1 py-2">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: 'var(--color-crema-100)', color: 'var(--color-guinda-700)' }}>
            <StickyNote size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-stone-900">Notas</h1>
            <p className="mt-0.5 text-sm text-stone-500">Tus recordatorios sueltos. Solo tú los ves.</p>
          </div>
        </div>

        {/* Nueva nota */}
        <div className="mb-6 rounded-2xl border border-stone-200 bg-white p-4">
          <textarea
            value={nuevo}
            onChange={(e) => setNuevo(e.target.value)}
            placeholder="Escribe un recordatorio…"
            rows={2}
            className="w-full resize-none rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-[var(--color-guinda-700)] focus:outline-none"
          />
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {COLORES.map((o) => (
                <button key={o.c} type="button" onClick={() => setNuevoColor(o.c)} aria-label={o.c}
                  className={`h-5 w-5 rounded-full border-2 transition-transform ${nuevoColor === o.c ? 'scale-110' : 'border-transparent'}`}
                  style={{ background: o.bg, borderColor: nuevoColor === o.c ? o.chip : 'transparent' }} />
              ))}
            </div>
            <button type="button" onClick={agregar} disabled={!nuevo.trim() || guardando}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-guinda-800)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--color-guinda-700)] disabled:opacity-50">
              <Plus size={15} /> Agregar nota
            </button>
          </div>
        </div>

        {/* Tablero de post-its */}
        {cargando ? (
          <div className="rounded-xl border border-stone-200 bg-white p-6 text-center text-sm text-stone-400">Cargando…</div>
        ) : notas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-300 bg-white/60 p-8 text-center text-sm text-stone-400">
            No tienes notas todavía. Escribe tu primer recordatorio arriba.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {notas.map((n, i) => {
              const e = estilo(n.color);
              return (
                <div key={n.id} className="relative rounded-xl p-4 shadow-sm"
                  style={{ background: e.bg, border: `1px solid ${e.borde}`, transform: `rotate(${(i % 2 === 0 ? -1 : 1) * 0.6}deg)` }}>
                  <button type="button" onClick={() => eliminar(n.id)} aria-label="Eliminar"
                    className="absolute right-2 top-2 text-stone-400 hover:text-red-600">
                    <Trash2 size={14} />
                  </button>

                  {editId === n.id ? (
                    <div>
                      <textarea value={editTexto} onChange={(ev) => setEditTexto(ev.target.value)} rows={4} autoFocus
                        className="w-full resize-none rounded-md border border-black/10 bg-white/70 px-2 py-1.5 text-sm text-stone-800 focus:outline-none" />
                      <div className="mt-2 flex gap-1.5">
                        <button type="button" onClick={() => guardarEdicion(n.id)} className="inline-flex items-center gap-1 rounded-md bg-white/80 px-2 py-1 text-xs font-semibold text-stone-700 hover:bg-white">
                          <Check size={12} /> Guardar
                        </button>
                        <button type="button" onClick={() => setEditId(null)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-stone-500 hover:text-stone-700">
                          <X size={12} /> Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => { setEditId(n.id); setEditTexto(n.contenido); }}
                      className="block w-full whitespace-pre-wrap pr-4 text-left text-sm leading-relaxed text-stone-800">
                      {n.contenido}
                    </button>
                  )}

                  <div className="mt-3 flex items-center justify-between border-t border-black/5 pt-2">
                    <div className="flex items-center gap-1">
                      {COLORES.map((o) => (
                        <button key={o.c} type="button" onClick={() => cambiarColor(n.id, o.c)} aria-label={o.c}
                          className={`h-3.5 w-3.5 rounded-full border ${n.color === o.c ? 'ring-1 ring-black/30' : 'border-black/10'}`}
                          style={{ background: o.chip }} />
                      ))}
                    </div>
                    <span className="text-[10px] text-stone-500/70">{fechaCorta(n.updatedAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DireccionLayout>
  );
}
