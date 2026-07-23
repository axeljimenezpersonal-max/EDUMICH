/**
 * Preguntas frecuentes — vista pública (alumno / gestor). Lee las preguntas
 * administrables desde /api/faq (las gestiona la administración). Diseño con
 * badges por categoría, filtros y buscador.
 */
import { useEffect, useMemo, useState } from 'react';
import { Search, X, HelpCircle, ChevronDown, Loader2, Sparkles } from 'lucide-react';
import { api } from '../lib/api';

interface Faq {
  id: number;
  pregunta: string;
  respuesta: string;
  categoria: string;
}

// Paleta suave para las badges de categoría (color estable por texto).
const PALETA = [
  { bg: '#eef1ff', color: '#3b3f8f' },
  { bg: '#eafaef', color: '#1a7a3e' },
  { bg: '#fff3e6', color: '#b45309' },
  { bg: '#fdedf3', color: '#8a1538' },
  { bg: '#e9f5fb', color: '#1d6fa5' },
  { bg: '#f3edfb', color: '#6b3fa0' },
  { bg: '#fbeeee', color: '#b23b3b' },
];
function colorCategoria(cat: string) {
  let h = 0;
  for (let i = 0; i < cat.length; i++) h = (h * 31 + cat.charCodeAt(i)) >>> 0;
  return PALETA[h % PALETA.length];
}

function Badge({ categoria }: { categoria: string }) {
  const c = colorCategoria(categoria);
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: c.bg, color: c.color }}>
      {categoria}
    </span>
  );
}

export function PreguntasFrecuentes({ rol: _rol }: { rol: string }) {
  const [faqs, setFaqs] = useState<Faq[] | null>(null);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<number | null>(null);

  useEffect(() => {
    api.get<{ preguntas: Faq[] }>('/faq').then((r) => setFaqs(r.preguntas)).catch(() => setFaqs([]));
  }, []);

  const categorias = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of faqs ?? []) m.set(f.categoria, (m.get(f.categoria) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [faqs]);

  const filtradas = useMemo(() => {
    const query = q.trim().toLowerCase();
    return (faqs ?? []).filter((f) => {
      if (cat && f.categoria !== cat) return false;
      if (query && !`${f.pregunta} ${f.respuesta} ${f.categoria}`.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [faqs, q, cat]);

  return (
    <div className="max-w-3xl mx-auto pb-12">
      {/* Encabezado tipo hero */}
      <div className="rounded-2xl p-6 sm:p-8 mb-5 text-white" style={{ background: 'linear-gradient(135deg, var(--color-guinda-800), var(--color-guinda-600))' }}>
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest opacity-80 mb-2">
          <Sparkles size={13} /> Centro de ayuda
        </div>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold leading-tight mb-1">¿En qué te ayudamos?</h1>
        <p className="text-sm opacity-90 mb-4 max-w-lg">Encuentra la respuesta al instante: busca tu duda o explora por categoría.</p>
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
            placeholder="Escribe tu pregunta…"
            className="w-full text-[15px] rounded-xl pl-11 pr-10 py-3.5 bg-white text-stone-800 shadow-lg focus:outline-none focus:ring-2 focus:ring-white/40"
          />
          {q && (
            <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700" aria-label="Limpiar">
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {faqs === null ? (
        <div className="flex items-center justify-center gap-2 text-sm text-stone-400 py-16">
          <Loader2 size={18} className="animate-spin" /> Cargando…
        </div>
      ) : (
        <>
          {/* Filtros por categoría (badges) */}
          {categorias.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-5">
              <button
                onClick={() => setCat(null)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${cat === null ? 'bg-[var(--color-guinda-700)] text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
              >
                Todas ({faqs.length})
              </button>
              {categorias.map(([c, n]) => (
                <button
                  key={c}
                  onClick={() => setCat(c === cat ? null : c)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${cat === c ? 'bg-[var(--color-guinda-700)] text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                >
                  {c} ({n})
                </button>
              ))}
            </div>
          )}

          {/* Lista */}
          {filtradas.length === 0 ? (
            <div className="text-center py-16 text-sm text-stone-400">
              {faqs.length === 0 ? 'Aún no hay preguntas frecuentes.' : `No encontramos nada${q ? ` para «${q}»` : ''}.`}
            </div>
          ) : (
            <div className="space-y-2.5">
              {filtradas.map((f) => {
                const open = abierta === f.id;
                return (
                  <div key={f.id} className={`rounded-xl border bg-white overflow-hidden transition-shadow ${open ? 'border-[var(--color-guinda-300,#e8c4d4)] shadow-sm' : 'border-stone-200'}`}>
                    <button
                      onClick={() => setAbierta(open ? null : f.id)}
                      className="w-full flex items-center gap-3 p-4 text-left hover:bg-stone-50/70 transition-colors"
                    >
                      <span className="w-8 h-8 rounded-lg bg-[var(--color-crema-100)] flex items-center justify-center shrink-0">
                        <HelpCircle size={16} className="text-[var(--color-guinda-700)]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-stone-900">{f.pregunta}</span>
                      </span>
                      <Badge categoria={f.categoria} />
                      <ChevronDown size={16} className={`text-stone-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                    </button>
                    {open && (
                      <div className="px-4 pb-4 text-sm text-stone-600 leading-relaxed" style={{ paddingLeft: 56 }}>
                        {f.respuesta}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
