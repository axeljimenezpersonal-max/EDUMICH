import { useEffect, useRef, useState } from 'react';
import { Pen, Eraser, Check, Trash2, Loader2, RotateCcw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { api, type FirmaResponse } from '../lib/api';

/**
 * Firma reutilizable estilo Apple. El usuario dibuja una vez y se guarda para
 * estamparse en la cédula. Con `unaSola` se usa un único espacio (la firma
 * oficial del responsable); sin él, permite 2 espacios y elegir cuál usar.
 */
export default function FirmaPad({
  onChange,
  unaSola = false,
}: {
  onChange?: (tieneFirma: boolean) => void;
  unaSola?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  const huboTrazo = useRef(false);

  const [firma1, setFirma1] = useState<string | null>(null);
  const [firma2, setFirma2] = useState<string | null>(null);
  const [activa, setActiva] = useState<number>(1);
  const [drawingSlot, setDrawingSlot] = useState<1 | 2 | null>(null);
  const [confirmarBorrar, setConfirmarBorrar] = useState<1 | 2 | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function cargar() {
    return api
      .get<FirmaResponse>('/firma')
      .then((r) => {
        setFirma1(r.firma1);
        setFirma2(r.firma2);
        setActiva(r.activa);
        const activaTiene = (r.activa === 2 ? r.firma2 : r.firma1) !== null;
        onChange?.(activaTiene);
      })
      .catch(() => {});
  }

  useEffect(() => {
    cargar().finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Preparar el lienzo al entrar en modo dibujo
  useEffect(() => {
    if (drawingSlot === null) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1c1917';
    huboTrazo.current = false;
  }, [drawingSlot]);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    canvasRef.current!.setPointerCapture(e.pointerId);
    dibujando.current = true;
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }
  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dibujando.current) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    huboTrazo.current = true;
  }
  function onUp() {
    dibujando.current = false;
  }
  function limpiar() {
    const c = canvasRef.current;
    if (!c) return;
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    huboTrazo.current = false;
  }

  async function guardar() {
    if (drawingSlot === null) return;
    if (!huboTrazo.current) { setError('Dibuja tu firma antes de guardar.'); return; }
    setGuardando(true);
    setError(null);
    try {
      const dataUrl = canvasRef.current!.toDataURL('image/png');
      await api.put(`/firma/${drawingSlot}`, { imagenDataUrl: dataUrl });
      // En modo "una sola firma" el espacio 1 siempre es el activo.
      if (unaSola && drawingSlot === 1 && activa !== 1) {
        await api.patch('/firma/activa', { activa: 1 }).catch(() => {});
      }
      await cargar();
      setDrawingSlot(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la firma');
    } finally {
      setGuardando(false);
    }
  }

  async function usar(slot: 1 | 2) {
    setGuardando(true);
    setError(null);
    try {
      await api.patch('/firma/activa', { activa: slot });
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar la firma');
    } finally {
      setGuardando(false);
    }
  }

  async function quitar(slot: 1 | 2) {
    setGuardando(true);
    setError(null);
    try {
      await api.delete(`/firma/${slot}`);
      await cargar();
      setConfirmarBorrar(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo quitar la firma');
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <div className="flex items-center gap-2 text-sm text-stone-400 py-4">
        <Loader2 size={16} className="animate-spin" /> Cargando firmas…
      </div>
    );
  }

  // ── Modo dibujo ──
  if (drawingSlot !== null) {
    return (
      <div className="border border-stone-200 rounded-xl p-4 bg-white">
        <div className="text-xs font-semibold text-stone-500 mb-2">Firma {drawingSlot} — firma dentro del recuadro</div>
        <canvas
          ref={canvasRef}
          className="w-full h-40 border border-stone-300 rounded-lg bg-white touch-none cursor-crosshair"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
        />
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            onClick={guardar}
            disabled={guardando}
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg bg-[var(--color-guinda-700)] text-white hover:bg-[var(--color-guinda-800)] transition-colors disabled:opacity-50"
          >
            {guardando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Guardar firma {drawingSlot}
          </button>
          <button
            onClick={limpiar}
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors"
          >
            <Eraser size={14} /> Limpiar
          </button>
          <button
            onClick={() => { setDrawingSlot(null); setError(null); }}
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg text-stone-500 hover:text-stone-700 transition-colors"
          >
            Cancelar
          </button>
        </div>
        {error && <div className="text-xs text-red-600 mt-2">{error}</div>}
      </div>
    );
  }

  // ── Vista de los espacios (uno o dos según `unaSola`) ──
  const slots: { n: 1 | 2; img: string | null }[] = unaSola
    ? [{ n: 1, img: firma1 }]
    : [
        { n: 1, img: firma1 },
        { n: 2, img: firma2 },
      ];

  return (
    <div>
      <div className={`grid gap-3 ${unaSola ? 'grid-cols-1 max-w-sm' : 'grid-cols-1 sm:grid-cols-2'}`}>
        {slots.map(({ n, img }) => {
          // En modo una sola firma, la firma guardada siempre está "en uso".
          const enUso = unaSola ? img !== null : activa === n && img !== null;
          return (
            <div
              key={n}
              className={`rounded-2xl overflow-hidden border-2 transition-all ${
                enUso
                  ? 'border-[var(--color-guinda-700)] shadow-md'
                  : 'border-stone-200 bg-white'
              }`}
            >
              {/* Encabezado: nombre + acciones secundarias (editar / quitar) */}
              <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-widest text-stone-400">Firma {n}</span>
                {img && (
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => setDrawingSlot(n)}
                      title="Volver a firmar"
                      className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
                    >
                      <RotateCcw size={13} />
                    </button>
                    <button
                      onClick={() => setConfirmarBorrar(n)}
                      disabled={guardando}
                      title="Borrar firma"
                      className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>

              {img ? (
                <>
                  {/* Firma */}
                  <div className="mx-3 border border-dashed border-stone-200 rounded-xl bg-stone-50/60 flex items-center justify-center p-2 h-20">
                    <img src={img} alt={`Firma ${n}`} className="max-h-16 object-contain" />
                  </div>

                  {/* Estado principal: EN USO grande, o botón para usarla.
                      En modo una sola firma no hay que elegir: siempre está en uso. */}
                  {enUso ? (
                    <div className="mt-2 mx-3 mb-3 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[var(--color-guinda-700)] text-white font-bold text-sm">
                      <CheckCircle2 size={16} /> {unaSola ? 'Firma guardada' : 'EN USO'}
                    </div>
                  ) : (
                    <button
                      onClick={() => usar(n)}
                      disabled={guardando}
                      className="mt-2 mx-3 mb-3 w-[calc(100%-1.5rem)] flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-[var(--color-guinda-700)] text-[var(--color-guinda-700)] font-bold text-sm hover:bg-[var(--color-guinda-50,#faf0f3)] transition-colors disabled:opacity-50"
                    >
                      <Check size={16} /> Usar esta firma
                    </button>
                  )}
                </>
              ) : (
                <button
                  onClick={() => setDrawingSlot(n)}
                  className="m-3 w-[calc(100%-1.5rem)] h-[104px] flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-stone-300 rounded-xl text-stone-400 hover:border-[var(--color-guinda-700)] hover:text-[var(--color-guinda-700)] transition-colors"
                >
                  <Pen size={18} />
                  <span className="text-sm font-semibold">Agregar firma</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
      {error && <div className="text-xs text-red-600 mt-2">{error}</div>}

      {/* Popup: confirmar borrado permanente de una firma */}
      {confirmarBorrar !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={() => !guardando && setConfirmarBorrar(null)}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-5">
              <div className="w-11 h-11 rounded-full bg-red-50 flex items-center justify-center mb-3">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <h3 className="text-base font-bold text-stone-900">¿Borrar la Firma {confirmarBorrar}?</h3>
              <p className="text-sm text-stone-500 mt-1 leading-relaxed">
                Esta firma se eliminará <strong>para siempre</strong> y no se podrá recuperar. Si está en
                uso, deberás elegir o dibujar otra para que se estampe en las cédulas.
              </p>
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button
                onClick={() => setConfirmarBorrar(null)}
                disabled={guardando}
                className="flex-1 py-2.5 rounded-lg border border-stone-300 text-stone-700 text-sm font-semibold hover:bg-stone-50 transition-colors disabled:opacity-50"
              >
                No, conservar
              </button>
              <button
                onClick={() => quitar(confirmarBorrar)}
                disabled={guardando}
                className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {guardando ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Sí, borrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
