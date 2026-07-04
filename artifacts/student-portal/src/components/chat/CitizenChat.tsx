/**
 * CitizenChat — chat del alumno/gestor con la Secretaría.
 *
 * - Siempre muestra el AVISO LEGAL antes de abrir el chat (queda registrado el
 *   consentimiento). Solo tras aceptar se revela la conversación.
 * - El ciudadano solo puede escribir a la Secretaría.
 * - Sondea mensajes nuevos cada 5 s (near real-time).
 *
 * Se usa dentro del layout de cada rol (estudiante / gestor).
 */

import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Send, Lock, Info, Paperclip, X, FileText } from 'lucide-react';
import { api } from '../../lib/api';
import { ChatAdjunto } from './ChatAdjunto';

interface Mensaje {
  id: number;
  conversacionId: number;
  remitenteRol: string;
  esSecretaria: boolean;
  cuerpo: string;
  adjuntoNombre?: string | null;
  adjuntoMime?: string | null;
  createdAt: string;
}

function horaCorta(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function CitizenChat() {
  const [aceptado, setAceptado] = useState(false);
  const [check, setCheck] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [cargando, setCargando] = useState(false);
  const [texto, setTexto] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function scrollAlFinal(suave = true) {
    finRef.current?.scrollIntoView({ behavior: suave ? 'smooth' : 'auto' });
  }

  async function cargar(scroll = false) {
    try {
      const r = await api.get<{ mensajes: Mensaje[] }>('/chat/mi-conversacion');
      setMensajes((prev) => {
        if (prev.length !== r.mensajes.length && scroll) setTimeout(() => scrollAlFinal(), 60);
        return r.mensajes;
      });
    } catch {
      // Silencioso: el sondeo puede fallar transitoriamente (p. ej. durante un
      // redeploy). No mostramos error para no alarmar; el envío sí lo reporta.
    }
  }

  async function aceptar() {
    setCargando(true);
    try {
      await api.post('/chat/consentimiento');
      setAceptado(true);
      await cargar(true);
      setTimeout(() => scrollAlFinal(false), 80);
    } finally {
      setCargando(false);
    }
  }

  // Sondeo mientras el chat está abierto.
  useEffect(() => {
    if (!aceptado) return;
    const t = setInterval(() => cargar(true), 5000);
    return () => clearInterval(t);
  }, [aceptado]);

  function elegirArchivo(f: File | null) {
    if (!f) { setArchivo(null); return; }
    if (f.size > 10 * 1024 * 1024) { setError('El archivo supera 10 MB'); return; }
    setError(null);
    setArchivo(f);
  }

  async function enviar() {
    const cuerpo = texto.trim();
    if ((!cuerpo && !archivo) || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const fd = new FormData();
      if (cuerpo) fd.append('cuerpo', cuerpo);
      if (archivo) fd.append('archivo', archivo);
      const r = await api.post<{ mensaje: Mensaje }>('/chat/mensajes', fd);
      setMensajes((prev) => [...prev, r.mensaje]);
      setTexto('');
      setArchivo(null);
      if (fileRef.current) fileRef.current.value = '';
      setTimeout(() => scrollAlFinal(), 40);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar el mensaje');
    } finally {
      setEnviando(false);
    }
  }

  // ── Aviso legal (gate) ──────────────────────────────────────────────
  if (!aceptado) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="mb-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[var(--color-guinda-700)] font-semibold mb-1">
            <ShieldCheck size={13} /> Chat con la Secretaría
          </div>
          <h1 className="font-serif text-3xl font-bold text-stone-900">Antes de comenzar</h1>
        </div>

        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          <div
            className="flex items-center gap-3 px-6 py-4 text-white"
            style={{ background: 'linear-gradient(120deg, var(--color-guinda-800) 0%, var(--color-guinda-600) 100%)' }}
          >
            <ShieldCheck size={22} />
            <div>
              <div className="font-serif text-lg font-bold leading-tight">Aviso importante</div>
              <div className="text-xs text-white/80">Comunicación oficial con la Secretaría</div>
            </div>
          </div>

          <div className="space-y-3 px-6 py-5 text-sm leading-relaxed text-stone-700">
            <p className="flex gap-2">
              <Lock size={16} className="mt-0.5 flex-shrink-0 text-[var(--color-guinda-700)]" />
              <span>
                Esta conversación con la Secretaría <strong>queda registrada y almacenada</strong> por
                motivos legales y de seguimiento. El contenido puede ser consultado por el personal autorizado.
              </span>
            </p>
            <p className="flex gap-2">
              <Info size={16} className="mt-0.5 flex-shrink-0 text-[var(--color-guinda-700)]" />
              <span>
                Al continuar, aceptas el tratamiento de tus datos conforme al{' '}
                <a href="/aviso-privacidad" target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--color-guinda-700)] underline">
                  Aviso de Privacidad
                </a>. Este canal es <strong>exclusivamente</strong> para comunicarte con la Secretaría.
              </span>
            </p>
            <p className="flex gap-2">
              <ShieldCheck size={16} className="mt-0.5 flex-shrink-0 text-[var(--color-guinda-700)]" />
              <span>
                Mantén un <strong>trato formal y respetuoso</strong>. El uso indebido de este medio puede
                derivar en la suspensión del servicio.
              </span>
            </p>

            <label className="mt-2 flex cursor-pointer items-start gap-2.5 rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-3">
              <input
                type="checkbox"
                checked={check}
                onChange={(e) => setCheck(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[var(--color-guinda-700)]"
              />
              <span className="text-sm text-stone-700">
                He leído y acepto lo anterior. Entiendo que esta conversación queda registrada.
              </span>
            </label>
          </div>

          <div className="flex justify-end border-t border-stone-100 px-6 py-4">
            <button
              onClick={aceptar}
              disabled={!check || cargando}
              className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity disabled:opacity-40"
              style={{ background: 'var(--color-guinda-700)' }}
            >
              {cargando ? 'Abriendo…' : 'Entrar al chat'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Chat ────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto flex max-w-2xl flex-col" style={{ height: 'calc(100vh - 220px)', minHeight: 420 }}>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-stone-900">Chat con la Secretaría</h1>
          <p className="text-xs text-stone-500">Normalmente responden en horario de oficina.</p>
        </div>
      </div>

      {/* Aviso persistente */}
      <div className="mb-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
        <Lock size={12} className="flex-shrink-0" />
        Esta conversación queda registrada por motivos legales y de privacidad de datos.
      </div>

      {/* Mensajes */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto rounded-xl border border-stone-200 bg-[var(--color-crema-50)] p-4">
        {mensajes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-sm text-stone-400">
            <ShieldCheck size={28} className="mb-2 opacity-50" />
            Aún no hay mensajes. Escribe tu consulta a la Secretaría.
          </div>
        ) : (
          <div className="space-y-2.5">
            {mensajes.map((m) => {
              const mio = !m.esSecretaria;
              return (
                <div key={m.id} className={`flex ${mio ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[80%]">
                    {!mio && (
                      <div className="mb-0.5 ml-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-guinda-700)]">
                        Secretaría
                      </div>
                    )}
                    <div
                      className="rounded-2xl px-3.5 py-2 text-sm shadow-sm"
                      style={
                        mio
                          ? { background: 'var(--color-guinda-700)', color: '#fff', borderBottomRightRadius: 4 }
                          : { background: '#fff', color: '#292524', border: '1px solid #eaddd0', borderBottomLeftRadius: 4 }
                      }
                    >
                      {m.cuerpo && <div className="whitespace-pre-wrap break-words">{m.cuerpo}</div>}
                      {m.adjuntoNombre && (
                        <ChatAdjunto
                          previewUrl={`/api/chat/mensajes/${m.id}/preview`}
                          mime={m.adjuntoMime}
                          nombre={m.adjuntoNombre}
                          mio={mio}
                        />
                      )}
                    </div>
                    <div className={`mt-0.5 text-[10px] text-stone-400 ${mio ? 'text-right' : 'ml-1'}`}>
                      {horaCorta(m.createdAt)}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={finRef} />
          </div>
        )}
      </div>

      {error && <div className="mt-2 text-xs text-red-600">{error}</div>}

      {/* Archivo adjunto pendiente */}
      {archivo && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-700">
          <FileText size={14} className="flex-shrink-0 text-[var(--color-guinda-700)]" />
          <span className="min-w-0 flex-1 truncate">{archivo.name}</span>
          <span className="flex-shrink-0 text-stone-400">{(archivo.size / 1024 / 1024).toFixed(1)} MB</span>
          <button onClick={() => elegirArchivo(null)} className="flex-shrink-0 text-stone-400 hover:text-stone-700"><X size={14} /></button>
        </div>
      )}

      {/* Barra de envío */}
      <div className="mt-3 flex items-end gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => elegirArchivo(e.target.files?.[0] ?? null)}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={enviando}
          className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-stone-200 text-stone-500 transition-colors hover:bg-stone-50 hover:text-[var(--color-guinda-700)] disabled:opacity-40"
          aria-label="Adjuntar documento"
          title="Adjuntar documento (PDF o imagen)"
        >
          <Paperclip size={18} />
        </button>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); }
          }}
          rows={1}
          placeholder="Escribe tu mensaje a la Secretaría…"
          className="max-h-32 flex-1 resize-none rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm focus:border-[var(--color-guinda-500)] focus:outline-none"
        />
        <button
          onClick={enviar}
          disabled={(!texto.trim() && !archivo) || enviando}
          className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-white shadow-sm transition-opacity disabled:opacity-40"
          style={{ background: 'var(--color-guinda-700)' }}
          aria-label="Enviar"
        >
          <Send size={17} />
        </button>
      </div>
    </div>
  );
}
