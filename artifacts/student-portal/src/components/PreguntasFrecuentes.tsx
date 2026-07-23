/**
 * Centro de ayuda (alumno / gestor). Es la ÚNICA superficie de búsqueda de
 * ayuda: el buscador de arriba se retiró y su motor se "bajó" aquí.
 *
 * - Al escribir en "¿En qué te ayudamos?" corre el MOTOR del buscador
 *   (lib/buscador/motor) sobre un índice combinado: las respuestas curadas del
 *   índice + las preguntas frecuentes que administra la administración.
 * - Sin texto, se navega por categoría con tarjetas grandes tipo acordeón.
 */
import { useEffect, useMemo, useState } from 'react';
import { Search, X, HelpCircle, ChevronDown, Loader2, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import { buscar } from '../lib/buscador/motor';
import { INDICE } from '../lib/buscador/indice';
import type { EntradaIndice, RolBuscador } from '../lib/buscador/tipos';

interface Faq {
  id: number;
  pregunta: string;
  respuesta: string;
  categoria: string;
  principal: boolean;
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

function Badge({ texto }: { texto: string }) {
  const c = colorCategoria(texto);
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold shrink-0" style={{ background: c.bg, color: c.color }}>
      {texto}
    </span>
  );
}

/** Tarjeta grande tipo acordeón, para resultados del motor y para el listado. */
function Tarjeta({
  id, pregunta, respuesta, etiqueta, abierta, onToggle,
}: {
  id: string; pregunta: string; respuesta: string; etiqueta?: string;
  abierta: boolean; onToggle: () => void;
}) {
  return (
    <div className={`rounded-2xl border bg-white overflow-hidden transition-shadow ${abierta ? 'border-[var(--color-guinda-300,#e8c4d4)] shadow-sm' : 'border-stone-200'}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3.5 p-5 text-left hover:bg-stone-50/70 transition-colors"
        aria-expanded={abierta}
        aria-controls={`faq-panel-${id}`}
      >
        <span className="w-10 h-10 rounded-xl bg-[var(--color-crema-100)] flex items-center justify-center shrink-0">
          <HelpCircle size={20} className="text-[var(--color-guinda-700)]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] sm:text-base font-bold text-stone-900 leading-snug">{pregunta}</span>
        </span>
        {etiqueta && <Badge texto={etiqueta} />}
        <ChevronDown size={18} className={`text-stone-400 shrink-0 transition-transform ${abierta ? 'rotate-180' : ''}`} />
      </button>
      {abierta && (
        <div id={`faq-panel-${id}`} className="px-5 pb-5 text-[15px] text-stone-600 leading-relaxed" style={{ paddingLeft: 70 }}>
          {respuesta}
        </div>
      )}
    </div>
  );
}

export function PreguntasFrecuentes({ rol }: { rol: string }) {
  const [faqs, setFaqs] = useState<Faq[] | null>(null);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ preguntas: Faq[] }>('/faq').then((r) => setFaqs(r.preguntas)).catch(() => setFaqs([]));
  }, []);

  // Índice combinado para el motor: respuestas curadas + preguntas frecuentes
  // administrables. Así "¿En qué te ayudamos?" busca en TODO con el mismo motor.
  const indiceCombinado = useMemo<EntradaIndice[]>(() => {
    const faqsIdx: EntradaIndice[] = (faqs ?? []).map((f) => ({
      id: `faq-${f.id}`,
      tipo: 'respuesta',
      titulo: f.pregunta,
      cuerpo: f.respuesta,
      roles: ['estudiante', 'gestor', 'admin', 'direccion'],
      terminos: [f.categoria.toLowerCase()],
      pista: f.categoria,
    }));
    return [...INDICE.filter((e) => e.tipo === 'respuesta'), ...faqsIdx];
  }, [faqs]);

  const buscando = q.trim().length > 0;
  const resultados = useMemo(
    () => (buscando ? buscar(q, indiceCombinado, { rol: rol as RolBuscador }, { limite: 20 }) : []),
    [q, buscando, indiceCombinado, rol],
  );

  // El listado (navegación) muestra solo las PRINCIPALES (5 por categoría); las
  // demás viven únicamente en el buscador de arriba.
  const principales = useMemo(() => (faqs ?? []).filter((f) => f.principal), [faqs]);

  const categorias = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of principales) m.set(f.categoria, (m.get(f.categoria) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [principales]);

  // Navegación por categoría (solo cuando no se está buscando).
  const filtradas = useMemo(() => {
    if (cat === null) return principales;
    return principales.filter((f) => f.categoria === cat);
  }, [principales, cat]);

  return (
    <div className="max-w-3xl mx-auto pb-12">
      {/* Encabezado tipo hero con el buscador (motor) */}
      <div className="rounded-2xl p-6 sm:p-9 mb-6 text-white" style={{ background: 'linear-gradient(135deg, var(--color-guinda-800), var(--color-guinda-600))' }}>
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest opacity-80 mb-2">
          <Sparkles size={13} /> Centro de ayuda
        </div>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold leading-tight mb-1">¿En qué te ayudamos?</h1>
        <p className="text-sm opacity-90 mb-5 max-w-lg">Escribe tu duda y te respondemos al instante, o explora por categoría.</p>
        <div className="relative">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
            placeholder="Escribe tu pregunta…"
            className="w-full text-base rounded-xl pl-12 pr-11 py-4 bg-white text-stone-800 shadow-lg focus:outline-none focus:ring-2 focus:ring-white/40"
          />
          {q && (
            <button onClick={() => setQ('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700" aria-label="Limpiar">
              <X size={19} />
            </button>
          )}
        </div>
      </div>

      {faqs === null ? (
        <div className="flex items-center justify-center gap-2 text-sm text-stone-400 py-16">
          <Loader2 size={18} className="animate-spin" /> Cargando…
        </div>
      ) : buscando ? (
        /* ── Resultados del motor ── */
        resultados.length === 0 ? (
          <div className="text-center py-16">
            <HelpCircle size={30} className="mx-auto text-stone-300 mb-3" />
            <div className="text-sm text-stone-500">No encontramos nada para «{q.trim()}».</div>
            <div className="text-xs text-stone-400 mt-1">Prueba con otras palabras.</div>
          </div>
        ) : (
          <>
            <div className="text-[11px] font-bold uppercase tracking-widest text-stone-400 mb-3 px-1">
              {resultados.length} resultado{resultados.length === 1 ? '' : 's'}
            </div>
            <div className="space-y-3">
              {resultados.map((r) => (
                <Tarjeta
                  key={r.id}
                  id={r.id}
                  pregunta={r.titulo}
                  respuesta={r.cuerpo ?? ''}
                  etiqueta={r.pista}
                  abierta={abierta === r.id}
                  onToggle={() => setAbierta(abierta === r.id ? null : r.id)}
                />
              ))}
            </div>
          </>
        )
      ) : (
        /* ── Navegación por categoría ── */
        <>
          {categorias.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              <button
                onClick={() => setCat(null)}
                className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${cat === null ? 'bg-[var(--color-guinda-700)] text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
              >
                Principales ({principales.length})
              </button>
              {categorias.map(([c, n]) => (
                <button
                  key={c}
                  onClick={() => setCat(c === cat ? null : c)}
                  className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${cat === c ? 'bg-[var(--color-guinda-700)] text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                >
                  {c} ({n})
                </button>
              ))}
            </div>
          )}

          {filtradas.length === 0 ? (
            <div className="text-center py-16 text-sm text-stone-400">Aún no hay preguntas frecuentes.</div>
          ) : (
            <>
            <p className="text-xs text-stone-400 mb-3 px-1">Estas son las principales. ¿No ves tu duda? Escríbela arriba y el buscador la encuentra entre todas.</p>
            <div className="space-y-3">
              {filtradas.map((f) => {
                const id = `faq-${f.id}`;
                return (
                  <Tarjeta
                    key={id}
                    id={id}
                    pregunta={f.pregunta}
                    respuesta={f.respuesta}
                    etiqueta={f.categoria}
                    abierta={abierta === id}
                    onToggle={() => setAbierta(abierta === id ? null : id)}
                  />
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
