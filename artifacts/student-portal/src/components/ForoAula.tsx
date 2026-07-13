/**
 * Foro del aula — muro de mensajes tipo chat grupal entre el gestor y sus
 * alumnos. Mismo estilo del chat con la Secretaría: burbujas propias a la
 * derecha (guinda), ajenas a la izquierda con el nombre del autor.
 */
import { useEffect, useRef, useState } from 'react';
import { Send, MessageCircle, ShieldCheck, Loader2 } from 'lucide-react';
import { api } from '../lib/api';

interface Msg { id: number; autorId: number; autor: string; esGestor: boolean; cuerpo: string; createdAt: string }

function hora(iso: string) { return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
const G = 'var(--color-guinda-700)';

export function ForoAula() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [yo, setYo] = useState<number | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);

  const cargar = (scroll = false) => api.get<{ yo: number; mensajes: Msg[] }>('/aula/foro')
    .then((r) => { setYo(r.yo); setMsgs((prev) => { if (scroll && prev.length !== r.mensajes.length) setTimeout(() => finRef.current?.scrollIntoView({ behavior: 'smooth' }), 60); return r.mensajes; }); })
    .catch(() => {});

  useEffect(() => { cargar(); const t = setInterval(() => cargar(true), 6000); return () => clearInterval(t); }, []);
  useEffect(() => { setTimeout(() => finRef.current?.scrollIntoView(), 120); }, [yo]);

  async function enviar() {
    const cuerpo = texto.trim();
    if (!cuerpo || enviando) return;
    setEnviando(true);
    try { const r = await api.post<{ mensaje: Msg }>('/aula/foro', { cuerpo }); setMsgs((p) => [...p, { ...r.mensaje, autorId: yo ?? 0, autor: 'Tú', esGestor: false } as Msg]); setTexto(''); cargar(true); }
    finally { setEnviando(false); }
  }

  return (
    <div>
      <div className="mb-4">
        <div className="flex items-center gap-2 text-lg font-bold text-stone-900"><MessageCircle size={18} style={{ color: G }} /> Foro del aula</div>
        <div className="text-xs text-stone-500 mt-0.5">Espacio de dudas y avisos entre tú y el grupo. Todos los del aula lo ven.</div>
      </div>

      <div className="bg-white border border-stone-200 rounded-xl flex flex-col" style={{ height: 'min(60vh, 520px)' }}>
        <div className="flex-1 overflow-y-auto p-4 bg-[var(--color-crema-50)]">
          {msgs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-sm text-stone-400">
              <MessageCircle size={26} className="mb-2 opacity-50" /> Aún no hay mensajes. Escribe el primero.
            </div>
          ) : (
            <div className="space-y-2.5">
              {msgs.map((m) => {
                const mio = m.autorId === yo;
                return (
                  <div key={m.id} className={`flex ${mio ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[82%]">
                      {!mio && (
                        <div className="mb-0.5 ml-1 flex items-center gap-1 text-[10px] font-semibold" style={{ color: m.esGestor ? G : '#78716c' }}>
                          {m.autor}{m.esGestor && <span className="inline-flex items-center gap-0.5 px-1 rounded" style={{ background: 'var(--color-crema-100)' }}><ShieldCheck size={9} /> Gestor</span>}
                        </div>
                      )}
                      <div className="rounded-2xl px-3.5 py-2 text-sm shadow-sm" style={mio ? { background: G, color: '#fff', borderBottomRightRadius: 4 } : { background: '#fff', color: '#292524', border: '1px solid #eaddd0', borderBottomLeftRadius: 4 }}>
                        <div className="whitespace-pre-wrap break-words">{m.cuerpo}</div>
                      </div>
                      <div className={`mt-0.5 text-[10px] text-stone-400 ${mio ? 'text-right' : 'ml-1'}`}>{hora(m.createdAt)}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={finRef} />
            </div>
          )}
        </div>
        <div className="border-t border-stone-100 p-2.5 flex items-end gap-2">
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={1}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
            placeholder="Escribe en el foro…"
            className="max-h-28 flex-1 resize-none rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm focus:border-[var(--color-guinda-500)] focus:outline-none" />
          <button onClick={enviar} disabled={!texto.trim() || enviando} className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-white shadow-sm transition-opacity disabled:opacity-40" style={{ background: G }} aria-label="Enviar">
            {enviando ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ForoAula;
