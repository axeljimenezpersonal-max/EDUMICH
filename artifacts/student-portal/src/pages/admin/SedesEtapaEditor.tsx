/**
 * Sedes habilitadas de una etapa — editor incrustado en ConvocatoriaDetalle.
 *
 * Muestra el catálogo de sedes con casillas: las marcadas son en las que el
 * alumno podrá presentar esta etapa. El alumno elige UNA de ellas al inscribirse
 * (ver utils/sedeInscripcion en el backend). Guarda con PUT /admin/sedes/etapa/:id.
 */
import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { MapPin, Loader2, Check, Search, X } from 'lucide-react';
import { api } from '../../lib/api';

interface SedeEtapa {
  id: number;
  nombre: string;
  municipio: string;
  habilitada: boolean;
  cupo: number | null;
}

export function SedesEtapaEditor({ etapaId }: { etapaId: number }) {
  const [sedes, setSedes] = useState<SedeEtapa[]>([]);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [inicial, setInicial] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    let vivo = true;
    setLoading(true);
    api.get<{ sedes: SedeEtapa[] }>(`/admin/sedes/etapa/${etapaId}`)
      .then((r) => {
        if (!vivo) return;
        setSedes(r.sedes);
        const activas = new Set(r.sedes.filter((s) => s.habilitada).map((s) => s.id));
        setSel(new Set(activas));
        setInicial(activas);
      })
      .catch(() => { if (vivo) setError('No se pudieron cargar las sedes.'); })
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, [etapaId]);

  function toggle(id: number) {
    setGuardado(false);
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  const cambiado =
    sel.size !== inicial.size || [...sel].some((id) => !inicial.has(id));

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      await api.put(`/admin/sedes/etapa/${etapaId}`, { sedeIds: [...sel] });
      setInicial(new Set(sel));
      setGuardado(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  const habilitadas = sedes.filter((s) => sel.has(s.id));
  const consulta = q.trim().toLowerCase();
  const resultados = consulta
    ? sedes.filter((s) => `${s.nombre} ${s.municipio}`.toLowerCase().includes(consulta))
    : [];

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 sm:p-5 mb-6">
      <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
        <div className="flex items-center gap-2">
          <MapPin size={16} style={{ color: 'var(--color-guinda-700)' }} />
          <h2 className="text-sm font-bold" style={{ color: 'var(--color-guinda-700)' }}>Sedes habilitadas</h2>
        </div>
        {cambiado && (
          <button
            onClick={guardar}
            disabled={guardando}
            className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-40"
            style={{ background: 'var(--color-guinda-700)' }}
          >
            {guardando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            Guardar sedes
          </button>
        )}
        {guardado && !cambiado && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: '#2d7d46' }}>
            <Check size={13} /> Guardado
          </span>
        )}
      </div>
      <p className="text-xs text-stone-500 mb-3.5">
        El alumno elegirá una de estas al inscribirse. Si no marcas ninguna, se usa la sede de su municipio.
      </p>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 8, padding: '9px 12px', fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin" style={{ color: 'var(--color-guinda-700)' }} />
        </div>
      ) : sedes.length === 0 ? (
        <div className="text-center py-6 text-sm text-stone-500">
          Aún no hay sedes en el catálogo.{' '}
          <Link href="/admin/sedes" className="font-semibold underline" style={{ color: 'var(--color-guinda-700)' }}>
            Crea sedes primero
          </Link>.
        </div>
      ) : (
        <>
          {/* Habilitadas actuales */}
          <div className="mb-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-stone-400 mb-1.5">
              Habilitadas ({habilitadas.length})
            </div>
            {habilitadas.length === 0 ? (
              <div className="text-sm text-stone-400 rounded-lg border border-dashed border-stone-200 py-4 text-center">
                Todavía no habilitas ninguna sede. Búscala abajo para agregarla.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {habilitadas.map((s) => (
                  <span
                    key={s.id}
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs"
                    style={{ borderColor: 'var(--color-guinda-700)', background: '#fdf6f0', color: 'var(--color-guinda-800)' }}
                  >
                    <MapPin size={12} />
                    <span className="font-semibold">{s.nombre}</span>
                    <span className="text-stone-400">· {s.municipio}</span>
                    <button onClick={() => toggle(s.id)} className="ml-0.5 text-stone-400 hover:text-red-600" title="Quitar sede">
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Buscador */}
          <div className="relative mb-2">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Busca por municipio o nombre (Morelia, Pátzcuaro…)"
              className="w-full text-sm border border-stone-300 rounded-lg pl-9 pr-8 py-2 bg-white focus:outline-none focus:border-[var(--color-guinda-700)]"
            />
            {q && (
              <button onClick={() => setQ('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700" aria-label="Limpiar">
                <X size={15} />
              </button>
            )}
          </div>

          {/* Resultados de la búsqueda */}
          {!consulta ? (
            <div className="text-xs text-stone-400 py-2 px-1">
              Escribe un municipio o nombre para ver y agregar sedes (ej. «Morelia», «Pátzcuaro»).
            </div>
          ) : resultados.length === 0 ? (
            <div className="text-sm text-stone-400 py-4 text-center">Ninguna sede coincide con «{q}».</div>
          ) : (
            <>
              <div className="text-[11px] text-stone-400 mb-1 px-1">{resultados.length} sede(s) — toca para habilitar</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {resultados.map((s) => {
                  const on = sel.has(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggle(s.id)}
                      className="flex items-center gap-3 rounded-lg border p-2.5 text-left transition-colors"
                      style={{ borderColor: on ? 'var(--color-guinda-700)' : '#eadfd7', background: on ? '#fdf6f0' : 'white' }}
                    >
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border"
                        style={{ borderColor: on ? 'var(--color-guinda-700)' : '#ddd0c5', background: on ? 'var(--color-guinda-700)' : 'white' }}
                      >
                        {on && <Check size={13} color="white" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-stone-800 truncate">{s.nombre}</span>
                        <span className="block text-xs text-stone-500 truncate">{s.municipio}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
