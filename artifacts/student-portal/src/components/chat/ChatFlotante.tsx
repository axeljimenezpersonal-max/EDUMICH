/**
 * ChatFlotante — la Secretaría, a un toque desde cualquier pantalla.
 *
 * Antes había que navegar a «Mensajes» para escribir o para enterarse de una
 * respuesta. Esto pone el mismo chat (mismo backend, mismas reglas) en una
 * burbuja que vive sobre el portal del alumno y del gestor.
 *
 * Decisiones que valen la pena conocer:
 *
 *  - En TELÉFONO es una hoja a pantalla completa, no un panelito flotante: en
 *    375px un panel de 380px no cabe, y el pulgar vive abajo.
 *  - El aviso legal se pide UNA vez y la respuesta viene de la BD
 *    (`consentimientoAceptado`), no del navegador: es un registro legal y debe
 *    valer en cualquier dispositivo.
 *  - Cerrado sondea cada 30 s (solo el contador); abierto cada 5 s (la
 *    conversación). Sondear la conversación siempre sería gastar por gusto.
 *  - Los mensajes seguidos del mismo lado se agrupan y no repiten avatar ni
 *    etiqueta, como cualquier mensajería moderna.
 *  - El envío es optimista: el mensaje aparece de inmediato y se confirma
 *    después. Si falla, se marca y se puede reintentar — no se pierde el texto.
 *
 * Solo se monta para alumno y gestor; la Secretaría tiene su propia bandeja.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  MessageCircle, X, Send, Headset, Lock, ShieldCheck, ChevronDown,
  AlertCircle, RefreshCw,
} from 'lucide-react';
import { api } from '../../lib/api';
import { parseDbDate } from '../../lib/fechas';

interface Mensaje {
  id: number;
  conversacionId?: number;
  remitenteRol?: string;
  esSecretaria: boolean;
  cuerpo: string;
  createdAt: string;
  /** Solo en el cliente: aún no confirmado por el servidor. */
  pendiente?: boolean;
  /** Solo en el cliente: el envío falló y se puede reintentar. */
  fallido?: boolean;
}

const HORARIO = 'Lunes a viernes, 9:00 a 17:00 h';

// ── Utilidades de fecha (siempre vía parseDbDate: la BD guarda UTC sin zona) ──

function hora(iso: string): string {
  return parseDbDate(iso).toLocaleString('es-MX', {
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City',
  });
}

function claveDia(iso: string): string {
  return parseDbDate(iso).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
}

function etiquetaDia(iso: string): string {
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
  const ayer = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
  const d = claveDia(iso);
  if (d === hoy) return 'Hoy';
  if (d === ayer) return 'Ayer';
  return parseDbDate(iso).toLocaleDateString('es-MX', {
    day: 'numeric', month: 'long', timeZone: 'America/Mexico_City',
  });
}

/** ¿Está abierta la Secretaría ahora? (L-V 9:00–17:00, hora de Michoacán) */
function enHorario(): boolean {
  const ahora = new Date();
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Mexico_City', weekday: 'short', hour: 'numeric', hour12: false,
  }).formatToParts(ahora);
  const dia = partes.find((p) => p.type === 'weekday')?.value ?? '';
  const h = Number(partes.find((p) => p.type === 'hour')?.value ?? '0');
  const entreSemana = !['Sat', 'Sun'].includes(dia);
  return entreSemana && h >= 9 && h < 17;
}

/**
 * Agrupa mensajes consecutivos del mismo lado dentro de una ventana corta, e
 * intercala separadores de día. Es lo que evita el muro de avatares repetidos.
 */
type Fila =
  | { tipo: 'dia'; clave: string; etiqueta: string }
  | { tipo: 'grupo'; clave: string; esSecretaria: boolean; mensajes: Mensaje[] };

const VENTANA_AGRUPADO_MS = 5 * 60 * 1000;

function agrupar(mensajes: Mensaje[]): Fila[] {
  const filas: Fila[] = [];
  let diaActual = '';
  let grupo: Mensaje[] = [];

  const cerrarGrupo = () => {
    if (grupo.length === 0) return;
    filas.push({
      tipo: 'grupo',
      clave: `g-${grupo[0].id}`,
      esSecretaria: grupo[0].esSecretaria,
      mensajes: grupo,
    });
    grupo = [];
  };

  for (const m of mensajes) {
    const dia = claveDia(m.createdAt);
    if (dia !== diaActual) {
      cerrarGrupo();
      filas.push({ tipo: 'dia', clave: `d-${dia}`, etiqueta: etiquetaDia(m.createdAt) });
      diaActual = dia;
    }
    const ultimo = grupo[grupo.length - 1];
    const seguido =
      ultimo &&
      ultimo.esSecretaria === m.esSecretaria &&
      parseDbDate(m.createdAt).getTime() - parseDbDate(ultimo.createdAt).getTime() < VENTANA_AGRUPADO_MS;
    if (!seguido) cerrarGrupo();
    grupo.push(m);
  }
  cerrarGrupo();
  return filas;
}

export function ChatFlotante() {
  const sinMovimiento = useReducedMotion();
  const [abierto, setAbierto] = useState(false);
  const [noLeidos, setNoLeidos] = useState(0);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [consentimiento, setConsentimiento] = useState<boolean | null>(null); // null = aún no sabemos
  const [aceptando, setAceptando] = useState(false);
  const [check, setCheck] = useState(false);
  const [texto, setTexto] = useState('');
  const [cargandoInicial, setCargandoInicial] = useState(true);
  const [alFinal, setAlFinal] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const finRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  /** id temporal para los mensajes optimistas (negativos, no chocan con la BD). */
  const tempId = useRef(-1);

  const filas = useMemo(() => agrupar(mensajes), [mensajes]);

  const irAlFinal = useCallback((suave = true) => {
    finRef.current?.scrollIntoView({ behavior: suave && !sinMovimiento ? 'smooth' : 'auto' });
  }, [sinMovimiento]);

  // ── Contador (también con el chat cerrado) ────────────────────────────────
  const cargarContador = useCallback(async () => {
    try {
      const r = await api.get<{ noLeidos: number }>('/chat/no-leidos');
      setNoLeidos(r.noLeidos ?? 0);
    } catch { /* el sondeo falla en silencio: no alarmamos por un 502 pasajero */ }
  }, []);

  useEffect(() => {
    cargarContador();
    const t = setInterval(cargarContador, 30000);
    return () => clearInterval(t);
  }, [cargarContador]);

  // ── Conversación (solo con el chat abierto) ───────────────────────────────
  const cargarConversacion = useCallback(async (irAbajo = false) => {
    try {
      const r = await api.get<{ mensajes: Mensaje[]; consentimientoAceptado: boolean }>('/chat/mi-conversacion');
      setConsentimiento(r.consentimientoAceptado);
      setMensajes((prev) => {
        // Conserva los optimistas que aún no confirma el servidor.
        const pendientes = prev.filter((m) => m.pendiente || m.fallido);
        const llegoAlgo = r.mensajes.length !== prev.filter((m) => !m.pendiente && !m.fallido).length;
        if (llegoAlgo && irAbajo) setTimeout(() => irAlFinal(), 60);
        return [...r.mensajes, ...pendientes];
      });
      setNoLeidos(0); // abrir la conversación la marca leída en el backend
    } catch { /* silencioso */ } finally {
      setCargandoInicial(false);
    }
  }, [irAlFinal]);

  useEffect(() => {
    if (!abierto) return;
    cargarConversacion(true);
    const t = setInterval(() => cargarConversacion(alFinal), 5000);
    return () => clearInterval(t);
  }, [abierto, cargarConversacion, alFinal]);

  // Al abrir, baja al último mensaje y enfoca el campo (en escritorio).
  useEffect(() => {
    if (!abierto) return;
    const t = setTimeout(() => {
      irAlFinal(false);
      if (window.matchMedia('(min-width: 640px)').matches) areaRef.current?.focus();
    }, 220);
    return () => clearTimeout(t);
  }, [abierto, irAlFinal]);

  // Esc cierra.
  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [abierto]);

  // Con la hoja abierta en teléfono, el fondo no se desplaza.
  useEffect(() => {
    if (!abierto) return;
    if (!window.matchMedia('(max-width: 639px)').matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [abierto]);

  function alDesplazar() {
    const el = scrollRef.current;
    if (!el) return;
    setAlFinal(el.scrollHeight - el.scrollTop - el.clientHeight < 60);
  }

  function autoCrecer() {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  async function aceptar() {
    setAceptando(true);
    try {
      await api.post('/chat/consentimiento');
      setConsentimiento(true);
      await cargarConversacion(true);
    } finally {
      setAceptando(false);
    }
  }

  async function enviar(reintento?: Mensaje) {
    const cuerpo = (reintento?.cuerpo ?? texto).trim();
    if (!cuerpo) return;

    const id = reintento?.id ?? tempId.current--;
    const optimista: Mensaje = {
      id, esSecretaria: false, cuerpo, createdAt: new Date().toISOString(), pendiente: true,
    };

    setMensajes((prev) => reintento
      ? prev.map((m) => (m.id === id ? optimista : m))
      : [...prev, optimista]);
    if (!reintento) {
      setTexto('');
      if (areaRef.current) areaRef.current.style.height = 'auto';
    }
    setTimeout(() => irAlFinal(), 40);

    try {
      const r = await api.post<{ mensaje?: Mensaje }>('/chat/mensajes', { cuerpo });
      // Si el servidor no devuelve el mensaje (forma inesperada), damos por bueno
      // el optimista en vez de meter `undefined` en la lista y tumbar la vista.
      const confirmado: Mensaje = r?.mensaje ?? { ...optimista, pendiente: false };
      setMensajes((prev) => prev.map((m) => (m.id === id ? confirmado : m)));
    } catch {
      // No se pierde el texto: queda marcado y con botón de reintentar.
      setMensajes((prev) => prev.map((m) => (m.id === id ? { ...optimista, pendiente: false, fallido: true } : m)));
    }
  }

  const resorte = sinMovimiento
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 380, damping: 32 };

  return (
    <>
      {/* ── Lanzador ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {!abierto && (
          <motion.button
            key="lanzador"
            onClick={() => setAbierto(true)}
            aria-label={noLeidos > 0 ? `Abrir chat, ${noLeidos} mensaje(s) sin leer` : 'Abrir chat con la Secretaría'}
            className="chat-lanzador fixed right-4 z-[55] flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg"
            style={{ background: 'linear-gradient(135deg, var(--color-guinda-700), var(--color-guinda-500))' }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={resorte}
            whileHover={sinMovimiento ? undefined : { scale: 1.06 }}
            whileTap={sinMovimiento ? undefined : { scale: 0.94 }}
          >
            <MessageCircle size={24} />
            {noLeidos > 0 && (
              <>
                {/* Aro que late: se nota sin gritar, y se apaga si el usuario
                    pidió menos movimiento. */}
                {!sinMovimiento && (
                  <motion.span
                    className="absolute inset-0 rounded-full"
                    style={{ border: '2px solid var(--color-dorado)' }}
                    animate={{ scale: [1, 1.35], opacity: [0.7, 0] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                  />
                )}
                <span
                  className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[11px] font-bold text-white"
                  style={{ background: '#b91c1c', border: '2px solid white' }}
                >
                  {noLeidos > 9 ? '9+' : noLeidos}
                </span>
              </>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Panel ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {abierto && (
          <>
            {/* Velo solo en teléfono, donde el chat toma toda la pantalla. */}
            <motion.div
              key="velo"
              className="fixed inset-0 z-[54] sm:hidden"
              style={{ background: 'rgba(28,10,18,0.45)' }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setAbierto(false)}
            />

            <motion.div
              key="panel"
              role="dialog"
              aria-label="Chat con la Secretaría"
              className="chat-panel fixed z-[55] flex flex-col overflow-hidden bg-white shadow-2xl"
              initial={sinMovimiento ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={sinMovimiento ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 16 }}
              transition={resorte}
              style={{ transformOrigin: 'bottom right' }}
            >
              {/* Encabezado: a quién le escribes */}
              <div
                className="flex items-center gap-3 px-4 py-3 text-white"
                style={{ background: 'linear-gradient(120deg, var(--color-guinda-800), var(--color-guinda-600))' }}
              >
                <div className="relative shrink-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: 'rgba(255,255,255,0.18)' }}>
                    <Headset size={19} />
                  </div>
                  <span
                    className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white"
                    style={{ background: enHorario() ? '#34d399' : '#a8a29e' }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-serif text-[15px] font-bold leading-tight">Atención a estudiantes</div>
                  <div className="text-[11px] text-white/75">
                    {enHorario() ? 'En línea ahora' : `Fuera de horario · ${HORARIO}`}
                  </div>
                </div>
                <button
                  onClick={() => setAbierto(false)}
                  aria-label="Cerrar chat"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-white/80 hover:bg-white/15 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Cuerpo */}
              {consentimiento === null && cargandoInicial ? (
                <div className="flex flex-1 items-center justify-center text-sm text-stone-400">
                  <RefreshCw size={18} className="mr-2 animate-spin" /> Abriendo…
                </div>
              ) : consentimiento === false ? (
                /* Aviso legal — se pide una sola vez, queda registrado en la BD. */
                <div className="flex-1 overflow-y-auto px-5 py-5">
                  <div className="mb-3 flex items-center gap-2">
                    <ShieldCheck size={17} className="text-[var(--color-guinda-700)]" />
                    <h3 className="font-serif text-base font-bold text-stone-900">Antes de comenzar</h3>
                  </div>
                  <ul className="space-y-2.5 text-[13px] leading-relaxed text-stone-600">
                    <li className="flex gap-2">
                      <Lock size={14} className="mt-0.5 shrink-0 text-[var(--color-guinda-700)]" />
                      <span>Esta conversación <strong className="text-stone-800">queda registrada</strong> por motivos legales y de seguimiento.</span>
                    </li>
                    <li className="flex gap-2">
                      <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[var(--color-guinda-700)]" />
                      <span>
                        Aceptas el tratamiento de tus datos conforme al{' '}
                        <a href="/aviso-privacidad" target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--color-guinda-700)] underline">
                          Aviso de Privacidad
                        </a>. Es un canal exclusivo con la Secretaría.
                      </span>
                    </li>
                  </ul>

                  <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-3">
                    <input
                      type="checkbox"
                      checked={check}
                      onChange={(e) => setCheck(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-[var(--color-guinda-700)]"
                    />
                    <span className="text-[13px] text-stone-700">He leído y acepto lo anterior.</span>
                  </label>

                  <button
                    onClick={aceptar}
                    disabled={!check || aceptando}
                    className="mt-4 w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-40"
                    style={{ background: 'var(--color-guinda-700)' }}
                  >
                    {aceptando ? 'Abriendo…' : 'Entrar al chat'}
                  </button>
                </div>
              ) : (
                <>
                  {/* Mensajes */}
                  <div
                    ref={scrollRef}
                    onScroll={alDesplazar}
                    className="relative flex-1 overflow-y-auto overscroll-contain px-3.5 py-3"
                    style={{ background: 'var(--color-crema-50)' }}
                  >
                    {mensajes.length === 0 ? (
                      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                        <div
                          className="mb-3 flex h-12 w-12 items-center justify-center rounded-full"
                          style={{ background: 'var(--color-crema-200)' }}
                        >
                          <Headset size={22} className="text-[var(--color-guinda-700)]" />
                        </div>
                        <p className="text-sm font-semibold text-stone-700">¿En qué te ayudamos?</p>
                        <p className="mt-1 text-xs leading-relaxed text-stone-500">
                          Escríbele a la Secretaría sobre tu expediente, tu pago o tu examen.
                          Te respondemos en horario de oficina.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filas.map((fila) =>
                          fila.tipo === 'dia' ? (
                            <div key={fila.clave} className="flex justify-center py-1.5">
                              <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-400 shadow-sm">
                                {fila.etiqueta}
                              </span>
                            </div>
                          ) : (
                            <div
                              key={fila.clave}
                              className={`flex items-end gap-2 ${fila.esSecretaria ? 'justify-start' : 'justify-end'}`}
                            >
                              {fila.esSecretaria && (
                                <div
                                  className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
                                  style={{ background: 'linear-gradient(135deg, var(--color-guinda-700), var(--color-guinda-500))' }}
                                >
                                  <Headset size={13} />
                                </div>
                              )}
                              <div className="max-w-[80%] space-y-1">
                                {fila.esSecretaria && (
                                  <div className="ml-1 text-[10px] font-bold uppercase tracking-wide text-[var(--color-guinda-700)]">
                                    Secretaría
                                  </div>
                                )}
                                {fila.mensajes.map((m, i) => (
                                  <motion.div
                                    key={m.id}
                                    initial={sinMovimiento ? false : { opacity: 0, y: 6 }}
                                    animate={{ opacity: m.pendiente ? 0.65 : 1, y: 0 }}
                                    transition={{ duration: 0.18 }}
                                  >
                                    <div
                                      className="rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed shadow-sm"
                                      style={
                                        fila.esSecretaria
                                          ? {
                                              background: '#fff', color: '#292524',
                                              border: '1px solid var(--color-crema-200)',
                                              borderBottomLeftRadius: i === fila.mensajes.length - 1 ? 5 : undefined,
                                            }
                                          : {
                                              background: m.fallido ? '#b91c1c' : 'var(--color-guinda-700)',
                                              color: '#fff',
                                              borderBottomRightRadius: i === fila.mensajes.length - 1 ? 5 : undefined,
                                            }
                                      }
                                    >
                                      <div className="whitespace-pre-wrap break-words">{m.cuerpo}</div>
                                    </div>
                                    <div
                                      className={`mt-0.5 flex items-center gap-1 text-[10px] text-stone-400 ${
                                        fila.esSecretaria ? 'ml-1' : 'justify-end'
                                      }`}
                                    >
                                      {m.fallido ? (
                                        <button
                                          onClick={() => enviar(m)}
                                          className="inline-flex items-center gap-1 font-semibold text-red-600 hover:underline"
                                        >
                                          <AlertCircle size={11} /> No se envió · Reintentar
                                        </button>
                                      ) : m.pendiente ? (
                                        <span>Enviando…</span>
                                      ) : (
                                        <span>{hora(m.createdAt)}</span>
                                      )}
                                    </div>
                                  </motion.div>
                                ))}
                              </div>
                            </div>
                          ),
                        )}
                        <div ref={finRef} />
                      </div>
                    )}
                  </div>

                  {/* Volver al último mensaje (solo si te alejaste) */}
                  <AnimatePresence>
                    {!alFinal && (
                      <motion.button
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        onClick={() => irAlFinal()}
                        className="absolute bottom-[76px] left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold shadow-md"
                        style={{ color: 'var(--color-guinda-700)' }}
                      >
                        <ChevronDown size={13} /> Últimos mensajes
                      </motion.button>
                    )}
                  </AnimatePresence>

                  {/* Redacción */}
                  <div className="chat-pie border-t border-stone-200 bg-white px-3 py-2.5">
                    <div className="flex items-end gap-2">
                      <textarea
                        ref={areaRef}
                        value={texto}
                        onChange={(e) => { setTexto(e.target.value); autoCrecer(); }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); }
                        }}
                        rows={1}
                        maxLength={2000}
                        placeholder="Escribe tu mensaje…"
                        className="max-h-[120px] flex-1 resize-none rounded-xl border border-stone-200 px-3.5 py-2.5 text-[13.5px] outline-none transition-colors focus:border-[var(--color-guinda-500)]"
                      />
                      <motion.button
                        onClick={() => enviar()}
                        disabled={!texto.trim()}
                        aria-label="Enviar mensaje"
                        whileTap={sinMovimiento || !texto.trim() ? undefined : { scale: 0.9 }}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white transition-opacity disabled:opacity-30"
                        style={{ background: 'var(--color-guinda-700)' }}
                      >
                        <Send size={17} />
                      </motion.button>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1 px-0.5 text-[10px] text-stone-400">
                      <Lock size={9} /> Conversación registrada · Enter envía, Shift+Enter salta de línea
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
