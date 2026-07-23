/**
 * Preguntas frecuentes — mini-módulo que reutiliza el MOTOR y el ÍNDICE del
 * buscador global. Reemplaza al chat/mensajes: en vez de escribirle a la
 * Secretaría, la persona busca su duda o revisa las preguntas comunes y obtiene
 * la respuesta al instante. Sin backend nuevo: el contenido son las entradas
 * `tipo:'respuesta'` del índice, ya categorizadas por rol.
 */
import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { Search, X, HelpCircle, ChevronDown, ArrowRight } from 'lucide-react';
import { INDICE } from '../lib/buscador/indice';
import { buscar } from '../lib/buscador/motor';
import type { RolBuscador } from '../lib/buscador/tipos';

export function PreguntasFrecuentes({ rol }: { rol: RolBuscador }) {
  const [, setLocation] = useLocation();
  const [q, setQ] = useState('');
  const [abierta, setAbierta] = useState<string | null>(null);

  // Todas las respuestas del rol = las preguntas frecuentes.
  const faqs = useMemo(
    () => INDICE.filter((e) => e.tipo === 'respuesta' && e.roles.includes(rol)),
    [rol],
  );
  // Al buscar, se usa el mismo motor del buscador global (respuestas + secciones).
  const resultados = useMemo(
    () => (q.trim() ? buscar(q, INDICE, { rol }, { limite: 20 }) : []),
    [q, rol],
  );

  return (
    <div className="max-w-3xl mx-auto pb-10">
      <div className="mb-1 text-xs font-bold uppercase tracking-widest text-[var(--color-guinda-700)] flex items-center gap-1.5">
        <HelpCircle size={14} /> Ayuda
      </div>
      <h1 className="font-serif text-2xl font-bold text-stone-900 mb-1">Preguntas frecuentes</h1>
      <p className="text-stone-500 text-sm mb-5">
        Busca tu duda o revisa las preguntas más comunes. Aquí encuentras la respuesta al instante.
      </p>

      {/* Buscador (mismo motor que ⌘K) */}
      <div className="relative mb-5">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
          placeholder="Busca lo que necesites…"
          className="w-full text-base border-2 border-stone-200 rounded-xl pl-11 pr-10 py-3 bg-white focus:outline-none focus:border-[var(--color-guinda-700)]"
        />
        {q && (
          <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700" aria-label="Limpiar">
            <X size={18} />
          </button>
        )}
      </div>

      {q.trim() ? (
        resultados.length === 0 ? (
          <div className="text-center py-10 text-sm text-stone-400">No encontramos nada para «{q}». Prueba con otras palabras.</div>
        ) : (
          <div className="space-y-2">
            {resultados.map((r) =>
              r.tipo === 'seccion' && r.ruta ? (
                <button
                  key={r.id}
                  onClick={() => setLocation(r.ruta!)}
                  className="w-full flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-4 text-left hover:border-[var(--color-guinda-400)] transition-colors"
                >
                  <ArrowRight size={16} className="text-[var(--color-guinda-700)] shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-stone-900">{r.titulo}</span>
                    {r.cuerpo && <span className="block text-xs text-stone-500 mt-0.5">{r.cuerpo}</span>}
                  </span>
                  {r.pista && <span className="text-[11px] text-stone-400 shrink-0">{r.pista}</span>}
                </button>
              ) : (
                <div key={r.id} className="rounded-xl border border-stone-200 bg-white p-4">
                  <div className="flex items-start gap-2.5">
                    <HelpCircle size={16} className="text-[var(--color-guinda-700)] shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-stone-900">{r.titulo}</div>
                      {r.cuerpo && <div className="text-sm text-stone-600 mt-1 leading-relaxed">{r.cuerpo}</div>}
                    </div>
                    {r.pista && <span className="text-[11px] font-semibold text-stone-400 shrink-0">{r.pista}</span>}
                  </div>
                </div>
              ),
            )}
          </div>
        )
      ) : (
        <div className="space-y-2">
          {faqs.length === 0 ? (
            <div className="text-center py-10 text-sm text-stone-400">No hay preguntas frecuentes para tu perfil.</div>
          ) : (
            faqs.map((f) => {
              const open = abierta === f.id;
              return (
                <div key={f.id} className="rounded-xl border border-stone-200 bg-white overflow-hidden">
                  <button
                    onClick={() => setAbierta(open ? null : f.id)}
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-stone-50 transition-colors"
                  >
                    <HelpCircle size={16} className="text-[var(--color-guinda-700)] shrink-0" />
                    <span className="min-w-0 flex-1 text-sm font-semibold text-stone-900">{f.titulo}</span>
                    {f.pista && <span className="text-[11px] font-semibold text-stone-400 shrink-0">{f.pista}</span>}
                    <ChevronDown size={16} className={`text-stone-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open && f.cuerpo && (
                    <div className="px-4 pb-4 text-sm text-stone-600 leading-relaxed" style={{ paddingLeft: 42 }}>{f.cuerpo}</div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
