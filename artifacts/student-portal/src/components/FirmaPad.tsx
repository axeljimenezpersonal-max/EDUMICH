import { useEffect, useRef, useState } from 'react';
import { Pen, Eraser, Check, Trash2, Loader2, RotateCcw } from 'lucide-react';
import { api, type FirmaResponse } from '../lib/api';

/**
 * Firma reutilizable estilo "guardar firma" (Apple):
 *  - Si ya hay una firma guardada, se muestra y solo se ofrece "Volver a firmar" / "Quitar".
 *  - Si no hay, se abre un lienzo donde el usuario firma (dedo, mouse o stylus) y guarda.
 * La firma se guarda en el perfil del usuario autenticado (endpoint /firma).
 */
export default function FirmaPad({ onChange }: { onChange?: (tieneFirma: boolean) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  const huboTrazo = useRef(false);

  const [firmaGuardada, setFirmaGuardada] = useState<string | null>(null);
  const [modoDibujo, setModoDibujo] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<FirmaResponse>('/firma')
      .then((r) => {
        setFirmaGuardada(r.imagenDataUrl);
        onChange?.(r.imagenDataUrl !== null);
      })
      .catch(() => {})
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Preparar el lienzo cuando entra en modo dibujo
  useEffect(() => {
    if (!modoDibujo) return;
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
  }, [modoDibujo]);

  function posicion(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    canvasRef.current!.setPointerCapture(e.pointerId);
    dibujando.current = true;
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = posicion(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dibujando.current) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = posicion(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    huboTrazo.current = true;
  }

  function onPointerUp() {
    dibujando.current = false;
  }

  function limpiar() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    huboTrazo.current = false;
  }

  async function guardar() {
    if (!huboTrazo.current) {
      setError('Dibuja tu firma antes de guardar.');
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const dataUrl = canvasRef.current!.toDataURL('image/png');
      await api.put('/firma', { imagenDataUrl: dataUrl });
      setFirmaGuardada(dataUrl);
      setModoDibujo(false);
      onChange?.(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la firma');
    } finally {
      setGuardando(false);
    }
  }

  async function quitar() {
    setGuardando(true);
    setError(null);
    try {
      await api.delete('/firma');
      setFirmaGuardada(null);
      onChange?.(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo quitar la firma');
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <div className="flex items-center gap-2 text-sm text-stone-400 py-4">
        <Loader2 size={16} className="animate-spin" /> Cargando firma…
      </div>
    );
  }

  // ── Firma ya guardada ──
  if (firmaGuardada && !modoDibujo) {
    return (
      <div className="border border-stone-200 rounded-xl p-4 bg-white">
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 mb-2">
          <Check size={14} /> Firma guardada
        </div>
        <div className="border border-dashed border-stone-200 rounded-lg bg-stone-50 flex items-center justify-center p-3">
          <img src={firmaGuardada} alt="Firma guardada" className="max-h-24 object-contain" />
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            onClick={() => setModoDibujo(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors"
          >
            <RotateCcw size={13} /> Volver a firmar
          </button>
          <button
            onClick={quitar}
            disabled={guardando}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            <Trash2 size={13} /> Quitar
          </button>
        </div>
        {error && <div className="text-xs text-red-600 mt-2">{error}</div>}
      </div>
    );
  }

  // ── Sin firma / modo dibujo ──
  if (!modoDibujo) {
    return (
      <div className="border border-dashed border-stone-300 rounded-xl p-5 bg-stone-50 text-center">
        <Pen size={22} className="mx-auto text-stone-400 mb-2" />
        <div className="text-sm text-stone-600 mb-3">Aún no has agregado tu firma.</div>
        <button
          onClick={() => setModoDibujo(true)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg bg-[var(--color-guinda-700)] text-white hover:bg-[var(--color-guinda-800)] transition-colors"
        >
          <Pen size={14} /> Agregar firma
        </button>
      </div>
    );
  }

  return (
    <div className="border border-stone-200 rounded-xl p-4 bg-white">
      <div className="text-xs font-semibold text-stone-500 mb-2">Firma dentro del recuadro</div>
      <canvas
        ref={canvasRef}
        className="w-full h-40 border border-stone-300 rounded-lg bg-white touch-none cursor-crosshair"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      />
      <div className="flex flex-wrap gap-2 mt-3">
        <button
          onClick={guardar}
          disabled={guardando}
          className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg bg-[var(--color-guinda-700)] text-white hover:bg-[var(--color-guinda-800)] transition-colors disabled:opacity-50"
        >
          {guardando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          Guardar firma
        </button>
        <button
          onClick={limpiar}
          className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors"
        >
          <Eraser size={14} /> Limpiar
        </button>
        {firmaGuardada && (
          <button
            onClick={() => { setModoDibujo(false); setError(null); }}
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg text-stone-500 hover:text-stone-700 transition-colors"
          >
            Cancelar
          </button>
        )}
      </div>
      {error && <div className="text-xs text-red-600 mt-2">{error}</div>}
    </div>
  );
}
