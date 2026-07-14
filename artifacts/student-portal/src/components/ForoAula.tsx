/**
 * Foro del aula — estilo Discord: mensajes alineados a la izquierda con
 * avatar de color estable por autor, agrupación de mensajes consecutivos,
 * adjuntos (imagen inline / archivo descargable), candado de seguridad y
 * aviso de uso responsable.
 */
import { useEffect, useRef, useState } from 'react';
import { Send, MessageCircle, ShieldCheck, Loader2, Lock, AlertTriangle, Paperclip, ImagePlus, FileText, Download, X } from 'lucide-react';
import { api } from '../lib/api';

interface Msg {
  id: number; autorId: number; autor: string; esGestor: boolean; cuerpo: string;
  adjuntoNombre: string | null; adjuntoTipo: string | null; createdAt: string;
}

function hora(iso: string) { return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }); }
function diaDe(iso: string) { return new Date(iso).toLocaleDateString('es-MX', { weekday: 'long', day: '2-digit', month: 'long' }); }
function iniciales(n: string) { const p = (n || '?').trim().split(/\s+/); return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '?'; }
// Color estable por autor (para el avatar), estilo Discord.
const AVATAR_COLORS = ['#6b1e3a', '#0d9488', '#4338ca', '#b45309', '#0369a1', '#9d174d', '#4d7c0f', '#7c3aed'];
function colorAutor(id: number) { return AVATAR_COLORS[Math.abs(id) % AVATAR_COLORS.length]; }
const G = 'var(--color-guinda-700)';
const MAX_ADJUNTO_MB = 15;

export function ForoAula() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [yo, setYo] = useState<number | null>(null);
  const [texto, setTexto] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [avisoAbierto, setAvisoAbierto] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  const cargar = (scroll = false) => api.get<{ yo: number; mensajes: Msg[] }>('/aula/foro')
    .then((r) => { setYo(r.yo); setMsgs((prev) => { if (scroll && prev.length !== r.mensajes.length) setTimeout(() => finRef.current?.scrollIntoView({ behavior: 'smooth' }), 60); return r.mensajes; }); })
    .catch(() => {});

  useEffect(() => { cargar(); const t = setInterval(() => cargar(true), 6000); return () => clearInterval(t); }, []);
  useEffect(() => { setTimeout(() => finRef.current?.scrollIntoView(), 120); }, [yo]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  function elegirArchivo(f: File | null) {
    setError('');
    if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
    if (!f) { setArchivo(null); return; }
    if (f.size > MAX_ADJUNTO_MB * 1024 * 1024) { setError(`El archivo pasa de ${MAX_ADJUNTO_MB} MB.`); return; }
    setArchivo(f);
    if (f.type.startsWith('image/')) setPreviewUrl(URL.createObjectURL(f));
  }

  async function enviar() {
    const cuerpo = texto.trim();
    if ((!cuerpo && !archivo) || enviando) return;
    setEnviando(true); setError('');
    try {
      const fd = new FormData();
      fd.append('cuerpo', cuerpo);
      if (archivo) fd.append('adjunto', archivo);
      await api.post('/aula/foro', fd);
      setTexto(''); elegirArchivo(null);
      if (fileRef.current) fileRef.current.value = '';
      if (imgRef.current) imgRef.current.value = '';
      await cargar(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar. Intenta de nuevo.');
    } finally { setEnviando(false); }
  }

  // Agrupa mensajes consecutivos del mismo autor (≤5 min) y separadores por día.
  const items: ({ tipo: 'dia'; dia: string } | { tipo: 'msg'; m: Msg; compacto: boolean })[] = [];
  msgs.forEach((m, i) => {
    const prev = msgs[i - 1];
    const dia = diaDe(m.createdAt);
    if (!prev || diaDe(prev.createdAt) !== dia) items.push({ tipo: 'dia', dia });
    const compacto = !!prev && prev.autorId === m.autorId && diaDe(prev.createdAt) === dia
      && (new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime()) < 5 * 60 * 1000;
    items.push({ tipo: 'msg', m, compacto });
  });

  return (
    <div>
      <div className="mb-3">
        <div className="flex items-center gap-2 text-lg font-bold text-stone-900"><MessageCircle size={18} style={{ color: G }} /> Foro del aula</div>
        <div className="text-xs text-stone-500 mt-0.5">Espacio de dudas y avisos entre tú y el grupo. Todos los del aula lo ven.</div>
      </div>

      {/* Candado de seguridad + aviso de uso */}
      <div className="mb-3 space-y-1.5">
        <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs" style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534' }}>
          <Lock size={13} className="shrink-0" />
          <span><b>Conversación protegida.</b> Tus datos y mensajes están resguardados dentro de la plataforma y solo los ven los integrantes de tu aula.</span>
        </div>
        <div className="rounded-lg border px-3 py-2 text-xs" style={{ background: '#fffbeb', borderColor: '#fde68a', color: '#92400e' }}>
          <button onClick={() => setAvisoAbierto((v) => !v)} className="flex w-full items-center gap-2 text-left font-semibold">
            <AlertTriangle size={13} className="shrink-0" />
            Aviso de uso responsable {avisoAbierto ? '▴' : '▾'}
          </button>
          {avisoAbierto && (
            <p className="mt-1.5 pl-5 leading-relaxed">
              Este foro es un espacio institucional de estudio. Los mensajes se conservan y pueden ser
              revisados por la Secretaría en caso de reporte o auditoría. Evita compartir datos personales
              sensibles (CURP, teléfonos, domicilios) y usa un lenguaje respetuoso.
            </p>
          )}
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-xl flex flex-col overflow-hidden" style={{ height: 'min(62vh, 560px)' }}>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {msgs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-sm text-stone-400">
              <MessageCircle size={26} className="mb-2 opacity-50" /> Aún no hay mensajes. Escribe el primero.
            </div>
          ) : (
            <div>
              {items.map((it, i) => it.tipo === 'dia' ? (
                <div key={`d${i}`} className="my-3 flex items-center gap-3">
                  <div className="h-px flex-1 bg-stone-200" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">{it.dia}</span>
                  <div className="h-px flex-1 bg-stone-200" />
                </div>
              ) : (
                <MensajeRow key={it.m.id} m={it.m} mio={it.m.autorId === yo} compacto={it.compacto} />
              ))}
              <div ref={finRef} />
            </div>
          )}
        </div>

        {/* Compositor */}
        <div className="border-t border-stone-100 p-2.5">
          {archivo && (
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5">
              {previewUrl
                ? <img src={previewUrl} alt="" className="h-10 w-10 rounded object-cover" />
                : <FileText size={18} className="text-stone-400" />}
              <span className="min-w-0 flex-1 truncate text-xs text-stone-600">{archivo.name}</span>
              <button onClick={() => elegirArchivo(null)} className="text-stone-400 hover:text-red-500" aria-label="Quitar adjunto"><X size={15} /></button>
            </div>
          )}
          {error && <div className="mb-2 text-xs font-semibold text-red-600">{error}</div>}
          <div className="flex items-end gap-1.5">
            <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={(e) => elegirArchivo(e.target.files?.[0] ?? null)} />
            <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" className="hidden" onChange={(e) => elegirArchivo(e.target.files?.[0] ?? null)} />
            <button onClick={() => imgRef.current?.click()} className="flex h-11 w-9 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-[var(--color-guinda-700)]" title="Subir foto" aria-label="Subir foto"><ImagePlus size={18} /></button>
            <button onClick={() => fileRef.current?.click()} className="flex h-11 w-9 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-[var(--color-guinda-700)]" title="Adjuntar archivo" aria-label="Adjuntar archivo"><Paperclip size={18} /></button>
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={1}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
              placeholder="Escribe en el foro…"
              className="max-h-28 flex-1 resize-none rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm focus:border-[var(--color-guinda-500)] focus:outline-none" />
            <button onClick={enviar} disabled={(!texto.trim() && !archivo) || enviando} className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-white shadow-sm transition-opacity disabled:opacity-40" style={{ background: G }} aria-label="Enviar">
              {enviando ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MensajeRow({ m, mio, compacto }: { m: Msg; mio: boolean; compacto: boolean }) {
  const esImagen = !!m.adjuntoTipo?.startsWith('image/');
  const adjuntoUrl = m.adjuntoNombre ? `/api/aula/foro/${m.id}/adjunto` : null;
  return (
    <div className={`group flex gap-2.5 rounded-md px-1.5 hover:bg-stone-50 ${compacto ? 'py-0.5' : 'mt-2.5 py-0.5'}`}>
      {compacto ? (
        <div className="w-9 shrink-0 pt-1 text-right text-[9px] text-stone-300 opacity-0 group-hover:opacity-100">{hora(m.createdAt)}</div>
      ) : (
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: colorAutor(m.autorId) }}>
          {iniciales(m.autor)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        {!compacto && (
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-bold" style={{ color: mio ? G : colorAutor(m.autorId) }}>{mio ? 'Tú' : m.autor}</span>
            {m.esGestor && (
              <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-px text-[9px] font-bold text-white" style={{ background: G }}>
                <ShieldCheck size={9} /> GESTOR
              </span>
            )}
            <span className="text-[10px] text-stone-400">{hora(m.createdAt)}</span>
          </div>
        )}
        {m.cuerpo && <div className="whitespace-pre-wrap break-words text-sm text-stone-800">{m.cuerpo}</div>}
        {adjuntoUrl && (esImagen ? (
          <a href={adjuntoUrl} target="_blank" rel="noreferrer" className="mt-1 block max-w-xs">
            <img src={adjuntoUrl} alt={m.adjuntoNombre ?? 'imagen'} className="max-h-64 rounded-lg border border-stone-200 object-cover" loading="lazy" />
          </a>
        ) : (
          <a href={adjuntoUrl} className="mt-1 inline-flex max-w-xs items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-semibold text-stone-700 transition-colors hover:border-[var(--color-guinda-500)]">
            <FileText size={16} style={{ color: G }} />
            <span className="min-w-0 flex-1 truncate">{m.adjuntoNombre}</span>
            <Download size={13} className="shrink-0 text-stone-400" />
          </a>
        ))}
      </div>
    </div>
  );
}

export default ForoAula;
