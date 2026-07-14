/**
 * Foro del aula — canal central estilo Discord/WhatsApp: mensajes con avatar,
 * adjuntos, ANUNCIOS destacados del gestor, encuestas con votación en vivo y
 * modo "solo anuncios" (candado: únicamente el gestor escribe). El gestor
 * modera: puede borrar cualquier mensaje.
 */
import { useEffect, useRef, useState } from 'react';
import {
  Send, MessageCircle, ShieldCheck, Loader2, Lock, Unlock, AlertTriangle, Paperclip, ImagePlus,
  FileText, Download, X, Megaphone, BarChart3, Trash2, CheckCircle2, Plus,
} from 'lucide-react';
import { api } from '../lib/api';

interface Voto { opcion: number; n: number; mio: boolean }
interface Msg {
  id: number; autorId: number; autor: string; esGestor: boolean;
  tipo: string; destacado: boolean; opciones: string[] | null; votos: Voto[];
  cuerpo: string; adjuntoNombre: string | null; adjuntoTipo: string | null; createdAt: string;
}
interface ForoData { yo: number; soyGestor: boolean; bloqueado: boolean; mensajes: Msg[] }

function hora(iso: string) { return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }); }
function diaDe(iso: string) { return new Date(iso).toLocaleDateString('es-MX', { weekday: 'long', day: '2-digit', month: 'long' }); }
function iniciales(n: string) { const p = (n || '?').trim().split(/\s+/); return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '?'; }
// Color estable por autor (para el avatar), estilo Discord.
const AVATAR_COLORS = ['#6b1e3a', '#0d9488', '#4338ca', '#b45309', '#0369a1', '#9d174d', '#4d7c0f', '#7c3aed'];
function colorAutor(id: number) { return AVATAR_COLORS[Math.abs(id) % AVATAR_COLORS.length]; }
const G = 'var(--color-guinda-700)';
const MAX_ADJUNTO_MB = 15;

export function ForoAula() {
  const [data, setData] = useState<ForoData | null>(null);
  const [texto, setTexto] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [avisoAbierto, setAvisoAbierto] = useState(false);
  // Modos del gestor
  const [modoAnuncio, setModoAnuncio] = useState(false);
  const [modoEncuesta, setModoEncuesta] = useState(false);
  const [opciones, setOpciones] = useState<string[]>(['', '']);
  const finRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  const cargar = (scroll = false) => api.get<ForoData>('/aula/foro')
    .then((r) => setData((prev) => {
      if (scroll && prev && prev.mensajes.length !== r.mensajes.length) setTimeout(() => finRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
      return r;
    }))
    .catch(() => {});

  useEffect(() => { cargar(); const t = setInterval(() => cargar(true), 6000); return () => clearInterval(t); }, []);
  useEffect(() => { if (data) setTimeout(() => finRef.current?.scrollIntoView(), 120); }, [data === null]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const soyGestor = !!data?.soyGestor;
  const bloqueado = !!data?.bloqueado;
  const puedoEscribir = soyGestor || !bloqueado;

  function elegirArchivo(f: File | null) {
    setError('');
    if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
    if (!f) { setArchivo(null); return; }
    if (f.size > MAX_ADJUNTO_MB * 1024 * 1024) { setError(`El archivo pasa de ${MAX_ADJUNTO_MB} MB.`); return; }
    setArchivo(f);
    if (f.type.startsWith('image/')) setPreviewUrl(URL.createObjectURL(f));
  }

  const opcionesValidas = opciones.map(o => o.trim()).filter(Boolean);
  const puedeEnviar = modoEncuesta
    ? !!texto.trim() && opcionesValidas.length >= 2
    : (!!texto.trim() || !!archivo);

  async function enviar() {
    if (!puedeEnviar || enviando) return;
    setEnviando(true); setError('');
    try {
      const fd = new FormData();
      fd.append('cuerpo', texto.trim());
      if (soyGestor && modoAnuncio && !modoEncuesta) fd.append('destacado', 'true');
      if (soyGestor && modoEncuesta) fd.append('opciones', JSON.stringify(opcionesValidas));
      if (archivo && !modoEncuesta) fd.append('adjunto', archivo);
      await api.post('/aula/foro', fd);
      setTexto(''); elegirArchivo(null); setModoAnuncio(false); setModoEncuesta(false); setOpciones(['', '']);
      if (fileRef.current) fileRef.current.value = '';
      if (imgRef.current) imgRef.current.value = '';
      await cargar(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar. Intenta de nuevo.');
    } finally { setEnviando(false); }
  }

  async function votar(msgId: number, opcion: number) {
    try { await api.post(`/aula/foro/${msgId}/votar`, { opcion }); await cargar(); } catch { /* silencioso */ }
  }
  async function borrar(msgId: number) {
    if (!confirm('¿Borrar este mensaje?')) return;
    try { await api.delete(`/aula/foro/${msgId}`); await cargar(); } catch { /* silencioso */ }
  }
  async function toggleBloqueo() {
    try { await api.patch('/aula/gestor/foro-bloqueo', {}); await cargar(); } catch { /* silencioso */ }
  }

  const msgs = data?.mensajes ?? [];
  // Agrupa mensajes consecutivos del mismo autor (≤5 min) y separadores por día.
  const items: ({ tipo: 'dia'; dia: string } | { tipo: 'msg'; m: Msg; compacto: boolean })[] = [];
  msgs.forEach((m, i) => {
    const prev = msgs[i - 1];
    const dia = diaDe(m.createdAt);
    if (!prev || diaDe(prev.createdAt) !== dia) items.push({ tipo: 'dia', dia });
    const especial = m.destacado || m.tipo === 'encuesta';
    const prevEspecial = !!prev && (prev.destacado || prev.tipo === 'encuesta');
    const compacto = !especial && !prevEspecial && !!prev && prev.autorId === m.autorId && diaDe(prev.createdAt) === dia
      && (new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime()) < 5 * 60 * 1000;
    items.push({ tipo: 'msg', m, compacto });
  });

  return (
    <div>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-lg font-bold text-stone-900"><MessageCircle size={18} style={{ color: G }} /> Foro del aula</div>
          <div className="text-xs text-stone-500 mt-0.5">El canal de tu grupo: mensajes, anuncios y encuestas. Todos los del aula lo ven.</div>
        </div>
        {soyGestor && data && (
          <button onClick={toggleBloqueo}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors"
            style={bloqueado ? { background: G, borderColor: G, color: '#fff' } : { borderColor: '#d6d3d1', color: '#57534e' }}
            title={bloqueado ? 'Solo tú puedes escribir. Toca para abrir el foro a tus alumnos.' : 'Toca para que solo tú puedas escribir (modo anuncios).'}>
            {bloqueado ? <Lock size={13} /> : <Unlock size={13} />} {bloqueado ? 'Solo anuncios' : 'Foro abierto'}
          </button>
        )}
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

      <div className="bg-white border border-stone-200 rounded-xl flex flex-col overflow-hidden" style={{ height: 'min(64vh, 600px)' }}>
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
                <MensajeRow key={it.m.id} m={it.m} mio={it.m.autorId === data?.yo} compacto={it.compacto}
                  puedeBorrar={soyGestor || it.m.autorId === data?.yo}
                  onVotar={(op) => votar(it.m.id, op)} onBorrar={() => borrar(it.m.id)} />
              ))}
              <div ref={finRef} />
            </div>
          )}
        </div>

        {/* Compositor */}
        <div className="border-t border-stone-100 p-2.5">
          {!puedoEscribir ? (
            <div className="flex items-center gap-2 rounded-lg bg-stone-50 border border-stone-200 px-3 py-3 text-xs font-semibold text-stone-500">
              <Lock size={14} className="shrink-0" style={{ color: G }} />
              El gestor activó el modo "solo anuncios". Por ahora únicamente él puede escribir; tú puedes seguir leyendo y votar en las encuestas.
            </div>
          ) : (
            <>
              {/* Barra de herramientas del gestor */}
              {soyGestor && (
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <button onClick={() => { setModoAnuncio((v) => !v); setModoEncuesta(false); }}
                    className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors"
                    style={modoAnuncio && !modoEncuesta ? { background: G, borderColor: G, color: '#fff' } : { borderColor: '#d6d3d1', color: '#57534e' }}>
                    <Megaphone size={12} /> Anuncio
                  </button>
                  <button onClick={() => { setModoEncuesta((v) => !v); setModoAnuncio(false); }}
                    className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors"
                    style={modoEncuesta ? { background: G, borderColor: G, color: '#fff' } : { borderColor: '#d6d3d1', color: '#57534e' }}>
                    <BarChart3 size={12} /> Encuesta
                  </button>
                  {modoAnuncio && !modoEncuesta && <span className="text-[10px] text-stone-400">El mensaje saldrá resaltado como anuncio del aula.</span>}
                </div>
              )}

              {/* Compositor de encuesta */}
              {modoEncuesta && (
                <div className="mb-2 space-y-1.5 rounded-lg border border-stone-200 bg-stone-50 p-3">
                  <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wide flex items-center gap-1"><BarChart3 size={12} style={{ color: G }} /> Encuesta — escribe la pregunta arriba y sus opciones aquí</div>
                  {opciones.map((op, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <input value={op} onChange={(e) => setOpciones((s) => s.map((x, j) => j === i ? e.target.value : x))}
                        placeholder={`Opción ${i + 1}`} maxLength={120}
                        className="flex-1 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs focus:border-[var(--color-guinda-500)] focus:outline-none" />
                      {opciones.length > 2 && (
                        <button onClick={() => setOpciones((s) => s.filter((_, j) => j !== i))} className="text-stone-400 hover:text-red-500" aria-label="Quitar opción"><X size={14} /></button>
                      )}
                    </div>
                  ))}
                  {opciones.length < 6 && (
                    <button onClick={() => setOpciones((s) => [...s, ''])} className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: G }}>
                      <Plus size={12} /> Agregar opción
                    </button>
                  )}
                </div>
              )}

              {archivo && !modoEncuesta && (
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
                {!modoEncuesta && (
                  <>
                    <button onClick={() => imgRef.current?.click()} className="flex h-11 w-9 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-[var(--color-guinda-700)]" title="Subir foto" aria-label="Subir foto"><ImagePlus size={18} /></button>
                    <button onClick={() => fileRef.current?.click()} className="flex h-11 w-9 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-[var(--color-guinda-700)]" title="Adjuntar archivo" aria-label="Adjuntar archivo"><Paperclip size={18} /></button>
                  </>
                )}
                <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={1}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                  placeholder={modoEncuesta ? 'Pregunta de la encuesta…' : modoAnuncio ? 'Escribe el anuncio…' : 'Escribe en el foro…'}
                  className="max-h-28 flex-1 resize-none rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm focus:border-[var(--color-guinda-500)] focus:outline-none" />
                <button onClick={enviar} disabled={!puedeEnviar || enviando} className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-white shadow-sm transition-opacity disabled:opacity-40" style={{ background: G }} aria-label="Enviar">
                  {enviando ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MensajeRow({ m, mio, compacto, puedeBorrar, onVotar, onBorrar }: {
  m: Msg; mio: boolean; compacto: boolean; puedeBorrar: boolean;
  onVotar: (opcion: number) => void; onBorrar: () => void;
}) {
  const esImagen = !!m.adjuntoTipo?.startsWith('image/');
  const adjuntoUrl = m.adjuntoNombre ? `/api/aula/foro/${m.id}/adjunto` : null;

  // ── ANUNCIO destacado del gestor ──
  if (m.destacado && m.tipo !== 'encuesta') {
    return (
      <div className="group my-2.5 overflow-hidden rounded-xl border" style={{ borderColor: '#d8a48f', background: 'var(--color-crema-50, #fdfaf5)' }}>
        <div className="flex items-center justify-between gap-2 px-3.5 py-1.5" style={{ background: G }}>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white"><Megaphone size={11} /> Anuncio · {m.autor}</span>
          <span className="flex items-center gap-2">
            <span className="text-[10px] text-white/70">{hora(m.createdAt)}</span>
            {puedeBorrar && <button onClick={onBorrar} className="text-white/60 hover:text-white" aria-label="Borrar anuncio"><Trash2 size={12} /></button>}
          </span>
        </div>
        <div className="px-3.5 py-2.5">
          {m.cuerpo && <div className="whitespace-pre-wrap break-words text-sm font-medium text-stone-800">{m.cuerpo}</div>}
          {adjuntoUrl && <AdjuntoView url={adjuntoUrl} nombre={m.adjuntoNombre} esImagen={esImagen} />}
        </div>
      </div>
    );
  }

  // ── ENCUESTA ──
  if (m.tipo === 'encuesta' && m.opciones) {
    const total = m.votos.reduce((s, v) => s + v.n, 0);
    const porOpcion = (i: number) => m.votos.find((v) => v.opcion === i);
    return (
      <div className="group my-2.5 rounded-xl border border-stone-200 bg-white p-3.5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: G }}>
            <BarChart3 size={11} /> Encuesta · {m.autor}
          </span>
          <span className="flex items-center gap-2">
            <span className="text-[10px] text-stone-400">{hora(m.createdAt)}</span>
            {puedeBorrar && <button onClick={onBorrar} className="text-stone-300 hover:text-red-500" aria-label="Borrar encuesta"><Trash2 size={12} /></button>}
          </span>
        </div>
        <div className="mt-1 text-sm font-semibold text-stone-900">{m.cuerpo}</div>
        <div className="mt-2 space-y-1.5">
          {m.opciones.map((op, i) => {
            const v = porOpcion(i);
            const n = v?.n ?? 0;
            const pct = total > 0 ? Math.round((n / total) * 100) : 0;
            const mia = !!v?.mio;
            return (
              <button key={i} onClick={() => onVotar(i)}
                className="relative block w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-xs transition-colors hover:border-[var(--color-guinda-500)]"
                style={{ borderColor: mia ? G : '#e7e5e4' }}>
                <div className="absolute inset-y-0 left-0 transition-all" style={{ width: `${pct}%`, background: mia ? 'rgba(107,30,58,0.14)' : 'rgba(120,113,108,0.08)' }} />
                <div className="relative flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-medium text-stone-800">
                    {mia && <CheckCircle2 size={13} style={{ color: G }} />}{op}
                  </span>
                  <span className="shrink-0 text-[10px] font-bold text-stone-500">{n} · {pct}%</span>
                </div>
              </button>
            );
          })}
        </div>
        <div className="mt-1.5 text-[10px] text-stone-400">{total} voto{total === 1 ? '' : 's'} · toca una opción para votar o cambiar tu voto</div>
      </div>
    );
  }

  // ── Mensaje normal ──
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
        {adjuntoUrl && <AdjuntoView url={adjuntoUrl} nombre={m.adjuntoNombre} esImagen={esImagen} />}
      </div>
      {puedeBorrar && (
        <button onClick={onBorrar} className="shrink-0 self-start pt-1 text-stone-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100" aria-label="Borrar mensaje">
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}

function AdjuntoView({ url, nombre, esImagen }: { url: string; nombre: string | null; esImagen: boolean }) {
  return esImagen ? (
    <a href={url} target="_blank" rel="noreferrer" className="mt-1 block max-w-xs">
      <img src={url} alt={nombre ?? 'imagen'} className="max-h-64 rounded-lg border border-stone-200 object-cover" loading="lazy" />
    </a>
  ) : (
    <a href={url} className="mt-1 inline-flex max-w-xs items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-semibold text-stone-700 transition-colors hover:border-[var(--color-guinda-500)]">
      <FileText size={16} style={{ color: G }} />
      <span className="min-w-0 flex-1 truncate">{nombre}</span>
      <Download size={13} className="shrink-0 text-stone-400" />
    </a>
  );
}

export default ForoAula;
