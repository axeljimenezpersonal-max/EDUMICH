/**
 * Chat de la Secretaría (admin) — bandeja de conversaciones con alumnos/gestores.
 *
 * - Lista de conversaciones (con no leídos) a la izquierda.
 * - Hilo seleccionado a la derecha, con barra de respuesta.
 * - La Secretaría puede iniciar conversación con cualquier alumno o gestor.
 * - Sondeo cada 5 s (lista y hilo abierto).
 */

import { useEffect, useRef, useState } from 'react';
import { useSearch } from 'wouter';
import { MessageSquare, Send, Search, PenSquare, X, Lock, ChevronLeft, UserRound, GraduationCap, Users, Paperclip, FileText } from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { api } from '../../lib/api';
import { ChatAdjunto } from '../../components/chat/ChatAdjunto';

interface Conv {
  id: number;
  participanteUserId: number;
  participanteRol: string;
  nombre: string;
  email: string | null;
  ultimoMensajeEn: string;
  ultimoMensajeTexto: string | null;
  noLeidos: number;
  cerrada: boolean;
}
interface Mensaje {
  id: number;
  esSecretaria: boolean;
  remitenteRol: string;
  cuerpo: string;
  adjuntoNombre?: string | null;
  adjuntoMime?: string | null;
  createdAt: string;
}
interface Destinatario {
  userId: number;
  nombre: string;
  rol: 'estudiante' | 'gestor';
  detalle: string;
}

function horaCorta(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function AdminChat() {
  const search = useSearch();
  const [convs, setConvs] = useState<Conv[]>([]);
  const [q, setQ] = useState('');
  const [selId, setSelId] = useState<number | null>(null);
  const [sel, setSel] = useState<{ nombre: string; rol: string } | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Carga inicial: si viene ?c=ID lo abre.
  useEffect(() => {
    const params = new URLSearchParams(search);
    const c = params.get('c');
    if (c) setSelId(Number(c));
  }, [search]);

  async function cargarConvs() {
    try {
      const r = await api.get<{ conversaciones: Conv[] }>(`/admin/chat/conversaciones${q ? `?q=${encodeURIComponent(q)}` : ''}`);
      setConvs(r.conversaciones);
    } catch { /* noop */ }
  }

  async function cargarHilo(id: number, scroll = false) {
    try {
      const r = await api.get<{ conversacion: { nombre: string; participanteRol: string }; mensajes: Mensaje[] }>(`/admin/chat/conversaciones/${id}`);
      setSel({ nombre: r.conversacion.nombre, rol: r.conversacion.participanteRol });
      setMensajes((prev) => {
        if (scroll && prev.length !== r.mensajes.length) setTimeout(() => finRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
        return r.mensajes;
      });
      // refresca la lista (para bajar el contador de no leídos)
      cargarConvs();
    } catch { /* noop */ }
  }

  useEffect(() => { cargarConvs(); /* eslint-disable-next-line */ }, [q]);
  useEffect(() => {
    if (selId == null) return;
    cargarHilo(selId, true);
    setTimeout(() => finRef.current?.scrollIntoView({ behavior: 'auto' }), 100);
  }, [selId]);

  // Sondeo
  useEffect(() => {
    const t = setInterval(() => {
      cargarConvs();
      if (selId != null) cargarHilo(selId, true);
    }, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, [selId, q]);

  function elegirArchivo(f: File | null) {
    if (f && f.size > 10 * 1024 * 1024) return;
    setArchivo(f);
  }

  async function responder() {
    const cuerpo = texto.trim();
    if ((!cuerpo && !archivo) || selId == null || enviando) return;
    setEnviando(true);
    try {
      const fd = new FormData();
      if (cuerpo) fd.append('cuerpo', cuerpo);
      if (archivo) fd.append('archivo', archivo);
      const r = await api.post<{ mensaje: Mensaje }>(`/admin/chat/conversaciones/${selId}/mensajes`, fd);
      setMensajes((prev) => [...prev, r.mensaje]);
      setTexto('');
      setArchivo(null);
      if (fileRef.current) fileRef.current.value = '';
      setTimeout(() => finRef.current?.scrollIntoView({ behavior: 'smooth' }), 40);
      cargarConvs();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AdminLayout>
      <div className="mb-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[var(--color-guinda-700)] font-semibold mb-1">
          <MessageSquare size={13} /> Comunicación
        </div>
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="font-serif text-3xl font-bold text-stone-900">Chat en vivo</h1>
            <p className="text-stone-600 mt-1">Mensajes de alumnos y gestores. Las conversaciones quedan registradas.</p>
          </div>
          <button
            onClick={() => setNuevoOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
            style={{ background: 'var(--color-guinda-700)' }}
          >
            <PenSquare size={16} /> Nuevo mensaje
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[340px_1fr]" style={{ minHeight: 'calc(100vh - 260px)' }}>
        {/* Bandeja */}
        <div className={`overflow-hidden rounded-xl border border-stone-200 bg-white ${selId != null ? 'hidden md:block' : ''}`}>
          <div className="border-b border-stone-100 p-2.5">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nombre o correo…"
                className="w-full rounded-lg border border-stone-200 py-2 pl-9 pr-3 text-sm focus:border-[var(--color-guinda-500)] focus:outline-none"
              />
            </div>
          </div>
          <div className="max-h-[calc(100vh-330px)] overflow-y-auto">
            {convs.length === 0 ? (
              <div className="p-8 text-center text-sm text-stone-400">Sin conversaciones todavía.</div>
            ) : (
              convs.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelId(c.id)}
                  className={`flex w-full items-start gap-3 border-b border-stone-50 px-3.5 py-3 text-left transition-colors hover:bg-[var(--color-crema-50)] ${
                    selId === c.id ? 'bg-[var(--color-crema-100)]' : ''
                  }`}
                >
                  <div
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[var(--color-guinda-700)]"
                    style={{ background: 'var(--color-crema-200)' }}
                  >
                    {c.participanteRol === 'gestor' ? <UserRound size={16} /> : <GraduationCap size={16} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-stone-900">{c.nombre}</span>
                      <span className="flex-shrink-0 text-[10px] text-stone-400">{horaCorta(c.ultimoMensajeEn)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs text-stone-500">{c.ultimoMensajeTexto ?? 'Sin mensajes'}</span>
                      {c.noLeidos > 0 && (
                        <span className="ml-auto flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: 'var(--color-guinda-700)' }}>
                          {c.noLeidos}
                        </span>
                      )}
                    </div>
                    <span className="mt-0.5 inline-block text-[10px] uppercase tracking-wide text-stone-400">
                      {c.participanteRol === 'gestor' ? 'Gestor' : 'Alumno'}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Hilo */}
        <div className={`flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white ${selId == null ? 'hidden md:flex' : 'flex'}`}>
          {selId == null ? (
            <div className="flex flex-1 flex-col items-center justify-center p-10 text-center text-sm text-stone-400">
              <MessageSquare size={30} className="mb-2 opacity-40" />
              Selecciona una conversación para verla.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-stone-100 px-4 py-3">
                <button onClick={() => setSelId(null)} className="md:hidden text-stone-500">
                  <ChevronLeft size={18} />
                </button>
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-guinda-700)]"
                  style={{ background: 'var(--color-crema-200)' }}
                >
                  {sel?.rol === 'gestor' ? <UserRound size={16} /> : <GraduationCap size={16} />}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-stone-900">{sel?.nombre ?? 'Conversación'}</div>
                  <div className="text-[11px] text-stone-400">{sel?.rol === 'gestor' ? 'Gestor municipal' : 'Alumno'}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-amber-50 px-4 py-1.5 text-[11px] text-amber-800">
                <Lock size={11} /> Conversación registrada por motivos legales y de privacidad.
              </div>

              <div className="flex-1 overflow-y-auto bg-[var(--color-crema-50)] p-4">
                {mensajes.length === 0 ? (
                  <div className="py-10 text-center text-sm text-stone-400">Sin mensajes. Escribe el primero.</div>
                ) : (
                  <div className="space-y-2.5">
                    {mensajes.map((m) => {
                      const mio = m.esSecretaria;
                      return (
                        <div key={m.id} className={`flex ${mio ? 'justify-end' : 'justify-start'}`}>
                          <div className="max-w-[75%]">
                            {!mio && (
                              <div className="mb-0.5 ml-1 text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                                {sel?.nombre ?? 'Usuario'}
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
                                  previewUrl={`/api/admin/chat/mensajes/${m.id}/preview`}
                                  mime={m.adjuntoMime}
                                  nombre={m.adjuntoNombre}
                                  mio={mio}
                                />
                              )}
                            </div>
                            <div className={`mt-0.5 text-[10px] text-stone-400 ${mio ? 'text-right' : 'ml-1'}`}>{horaCorta(m.createdAt)}</div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={finRef} />
                  </div>
                )}
              </div>

              <div className="border-t border-stone-100 p-3">
                {archivo && (
                  <div className="mb-2 flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-700">
                    <FileText size={14} className="flex-shrink-0 text-[var(--color-guinda-700)]" />
                    <span className="min-w-0 flex-1 truncate">{archivo.name}</span>
                    <span className="flex-shrink-0 text-stone-400">{(archivo.size / 1024 / 1024).toFixed(1)} MB</span>
                    <button onClick={() => elegirArchivo(null)} className="flex-shrink-0 text-stone-400 hover:text-stone-700"><X size={14} /></button>
                  </div>
                )}
                <div className="flex items-end gap-2">
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
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); responder(); } }}
                    rows={1}
                    placeholder="Escribe una respuesta…"
                    className="max-h-32 flex-1 resize-none rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm focus:border-[var(--color-guinda-500)] focus:outline-none"
                  />
                  <button
                    onClick={responder}
                    disabled={(!texto.trim() && !archivo) || enviando}
                    className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-white shadow-sm transition-opacity disabled:opacity-40"
                    style={{ background: 'var(--color-guinda-700)' }}
                    aria-label="Enviar"
                  >
                    <Send size={17} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {nuevoOpen && (
        <NuevoMensajeModal
          onClose={() => setNuevoOpen(false)}
          onAbrir={(id) => { setNuevoOpen(false); setSelId(id); cargarConvs(); }}
        />
      )}
    </AdminLayout>
  );
}

// ─────────────────────────────────────────────────────────────────────
type RolFiltro = 'todos' | 'gestor' | 'estudiante';

function NuevoMensajeModal({ onClose, onAbrir }: { onClose: () => void; onAbrir: (convId: number) => void }) {
  const [q, setQ] = useState('');
  const [rol, setRol] = useState<RolFiltro>('todos');
  const [res, setRes] = useState<Destinatario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [abriendo, setAbriendo] = useState<number | null>(null);

  // Carga la tabla desde el inicio; refina al escribir o cambiar el filtro.
  useEffect(() => {
    let vivo = true;
    setCargando(true);
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (rol !== 'todos') params.set('rol', rol);
      api.get<{ destinatarios: Destinatario[] }>(`/admin/chat/destinatarios${params.toString() ? `?${params}` : ''}`)
        .then((r) => { if (vivo) setRes(r.destinatarios); })
        .catch(() => {})
        .finally(() => { if (vivo) setCargando(false); });
    }, 250);
    return () => { vivo = false; clearTimeout(t); };
  }, [q, rol]);

  async function abrir(d: Destinatario) {
    setAbriendo(d.userId);
    try {
      const r = await api.post<{ conversacionId: number }>('/admin/chat/nueva', { participanteUserId: d.userId });
      onAbrir(r.conversacionId);
    } finally {
      setAbriendo(null);
    }
  }

  const filtros: { val: RolFiltro; label: string; icon: typeof UserRound }[] = [
    { val: 'todos', label: 'Todos', icon: Users },
    { val: 'estudiante', label: 'Alumnos', icon: GraduationCap },
    { val: 'gestor', label: 'Gestores', icon: UserRound },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-20" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3.5">
          <div>
            <div className="font-serif text-lg font-bold text-stone-900">Nuevo mensaje</div>
            <div className="text-xs text-stone-500">Elige a quién enviar el mensaje</div>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700"><X size={18} /></button>
        </div>

        <div className="border-b border-stone-100 px-4 py-3">
          {/* Filtro por tipo */}
          <div className="mb-2.5 flex gap-2">
            {filtros.map(({ val, label, icon: Icon }) => (
              <button
                key={val}
                onClick={() => setRol(val)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  rol === val ? 'border-transparent text-white' : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                }`}
                style={rol === val ? { background: 'var(--color-guinda-700)' } : undefined}
              >
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>
          {/* Búsqueda */}
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Busca por nombre o CURP…"
              className="w-full rounded-lg border border-stone-200 py-2.5 pl-9 pr-3 text-sm focus:border-[var(--color-guinda-500)] focus:outline-none"
            />
          </div>
        </div>

        {/* Tabla de destinatarios */}
        <div className="min-h-[240px] flex-1 overflow-y-auto">
          {cargando ? (
            <div className="py-10 text-center text-xs text-stone-400">Cargando…</div>
          ) : res.length === 0 ? (
            <div className="py-10 text-center text-xs text-stone-400">Sin coincidencias.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[var(--color-crema-100)] text-[10px] uppercase tracking-wider text-stone-500">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Nombre</th>
                  <th className="px-3 py-2 text-left font-semibold">Tipo</th>
                  <th className="px-3 py-2 text-left font-semibold">Municipio</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {res.map((d) => (
                  <tr key={`${d.rol}-${d.userId}`} className="border-b border-stone-50 hover:bg-[var(--color-crema-50)]">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[var(--color-guinda-700)]" style={{ background: 'var(--color-crema-200)' }}>
                          {d.rol === 'gestor' ? <UserRound size={14} /> : <GraduationCap size={14} />}
                        </div>
                        <span className="font-medium text-stone-900">{d.nombre}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={d.rol === 'gestor'
                          ? { background: '#e0e7ff', color: '#3730a3' }
                          : { background: '#dcfce7', color: '#166534' }}
                      >
                        {d.rol === 'gestor' ? 'Gestor' : 'Alumno'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-stone-500">{d.detalle || '—'}</td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        onClick={() => abrir(d)}
                        disabled={abriendo === d.userId}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-opacity disabled:opacity-50"
                        style={{ background: 'var(--color-guinda-700)' }}
                      >
                        <Send size={12} /> {abriendo === d.userId ? '…' : 'Escribir'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
