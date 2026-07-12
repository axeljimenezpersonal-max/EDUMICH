/**
 * Verificación de Pase de Examen — Admin
 *
 * Abre la cámara del dispositivo, escanea el QR del pase provisional del alumno,
 * llama a POST /admin/convocatoria/pase/validar y muestra el perfil del alumno.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import jsQR from 'jsqr';
import {
  Camera,
  CameraOff,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  User,
  BookOpen,
  QrCode,
  Loader2,
  IdCard,
  ExternalLink,
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { api } from '../../lib/api';

// ── Tipos ─────────────────────────────────────────────────────────────────

interface ValidarPaseResult {
  ok: boolean;
  folio: string;
  estudiante: { nombre: string; curp: string };
  modulo: { numero: number; nombre: string };
}

interface ValidarCredencialResult {
  ok: boolean;
  alumnoId: number;
  nombre: string;
  matricula: string | null;
  curp: string | null;
  folio: string;
  vencida: boolean;
}

type Modo = 'pase' | 'credencial';

type ScanState =
  | { tipo: 'idle' }
  | { tipo: 'scanning' }
  | { tipo: 'validando' }
  | { tipo: 'ok'; data: ValidarPaseResult }
  | { tipo: 'okCred'; data: ValidarCredencialResult }
  | { tipo: 'error'; mensaje: string; folio?: string };

// ── Componente principal ──────────────────────────────────────────────────

export default function VerificacionPase() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const processingRef = useRef(false);

  const [state, setState] = useState<ScanState>({ tipo: 'idle' });
  const [camError, setCamError] = useState<string | null>(null);
  // En esta primera versión el "Pase de examen" aún no está disponible, así que
  // la credencial del alumno es el modo principal/activo por defecto.
  const [modo, setModo] = useState<Modo>('credencial');
  const [, setLocation] = useLocation();

  // ── Cámara ────────────────────────────────────────────────────────────

  const detenerCamara = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    processingRef.current = false;
  }, []);

  const iniciarCamara = useCallback(async () => {
    setCamError(null);
    setState({ tipo: 'scanning' });
    processingRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setCamError('No se pudo acceder a la cámara. Verifica los permisos del navegador.');
      setState({ tipo: 'idle' });
    }
  }, []);

  // ── Validación ─────────────────────────────────────────────────────────

  const validarQr = useCallback(async (qrText: string) => {
    if (processingRef.current) return;
    processingRef.current = true;

    // Parsear para extraer el folio antes de llamar al API
    let folio: string | undefined;
    try {
      const parsed = JSON.parse(qrText) as { folio?: string };
      folio = parsed.folio;
    } catch {
      // Puede no ser JSON válido, igual lo mandamos al backend
    }

    setState({ tipo: 'validando' });
    detenerCamara();

    try {
      if (modo === 'credencial') {
        const result = await api.post<ValidarCredencialResult>(
          '/admin/credencial/validar',
          { qr: qrText }
        );
        setState({ tipo: 'okCred', data: result });
      } else {
        const result = await api.post<ValidarPaseResult>(
          '/admin/convocatoria/pase/validar',
          { qrPayload: qrText }
        );
        setState({ tipo: 'ok', data: result });
      }
    } catch (e) {
      const msg = (e as Error).message || (modo === 'credencial' ? 'No se pudo verificar la credencial' : 'Error al validar el pase');
      setState({ tipo: 'error', mensaje: msg, folio });
    }
  }, [detenerCamara, modo]);

  // ── Loop de escaneo ────────────────────────────────────────────────────

  const scanLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !streamRef.current) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });
        if (code?.data) {
          validarQr(code.data);
          return;
        }
      }
    }

    animFrameRef.current = requestAnimationFrame(scanLoop);
  }, [validarQr]);

  // Arrancar el loop cuando el video empieza
  function handleVideoPlay() {
    animFrameRef.current = requestAnimationFrame(scanLoop);
  }

  // Limpiar al desmontar
  useEffect(() => {
    return () => { detenerCamara(); };
  }, [detenerCamara]);

  // ── Reset ──────────────────────────────────────────────────────────────

  function reiniciar() {
    detenerCamara();
    setState({ tipo: 'idle' });
    setCamError(null);
  }

  // ── Render ─────────────────────────────────────────────────────────────

  const scanning = state.tipo === 'scanning' || state.tipo === 'validando';

  return (
    <AdminLayout>
      {/* Header */}
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-guinda-700)] mb-1">
          ADMINISTRACIÓN
        </div>
        <h1 className="font-serif text-2xl font-bold text-stone-900">Verificación</h1>
        <p className="text-stone-500 text-sm mt-1">
          Escanea el código QR de la <strong>credencial digital</strong> del alumno para abrir su expediente. <span className="text-stone-400">(La verificación de pase de examen llegará en una próxima versión.)</span>
        </p>
      </div>

      <div className="max-w-lg mx-auto space-y-5">

        {/* ── Selector de modo ─────────────────────────────────────────────── */}
        {(state.tipo === 'idle') && (
          <div className="bg-white border border-stone-200 rounded-2xl p-1.5 flex gap-1.5">
            {([
              { key: 'credencial' as Modo, label: 'Alumno (credencial)', disponible: true },
              { key: 'pase' as Modo, label: 'Pase de examen', disponible: false },
            ]).map((m) => (
              <button
                key={m.key}
                onClick={() => m.disponible && setModo(m.key)}
                disabled={!m.disponible}
                title={m.disponible ? undefined : 'Disponible en una próxima versión'}
                className={`relative flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors ${!m.disponible ? 'cursor-not-allowed' : ''}`}
                style={modo === m.key && m.disponible
                  ? { background: 'var(--color-guinda-700)', color: 'white' }
                  : { background: 'transparent', color: m.disponible ? '#6b635e' : '#c4bcb4' }}
              >
                {m.key === 'pase' ? <QrCode size={15} /> : <IdCard size={15} />}
                {m.label}
                {!m.disponible && (
                  <span className="ml-1 rounded-full bg-stone-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-stone-400">
                    Próximamente
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* ── Estado: IDLE ────────────────────────────────────────────────── */}
        {state.tipo === 'idle' && !camError && (
          <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'var(--color-guinda-700)' }}
            >
              {modo === 'credencial' ? <IdCard size={28} className="text-white" /> : <QrCode size={28} className="text-white" />}
            </div>
            <h2 className="font-serif text-lg font-bold text-stone-900 mb-2">
              {modo === 'credencial' ? 'Escanear credencial del alumno' : 'Escanear pase de examen'}
            </h2>
            <p className="text-sm text-stone-500 mb-6">
              {modo === 'credencial'
                ? 'Pide al alumno que muestre el QR de su credencial digital. Al escanearlo, abrirás su expediente en administración.'
                : 'Pide al alumno que muestre el código QR de su pase provisional. Apunta la cámara al código para verificar y registrar su asistencia.'}
            </p>
            <button
              onClick={iniciarCamara}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-guinda-700)] text-white text-sm font-semibold rounded-xl hover:bg-[var(--color-guinda-800)] transition-colors"
            >
              <Camera size={16} />
              Abrir cámara
            </button>
          </div>
        )}

        {/* ── Error de cámara ──────────────────────────────────────────────── */}
        {camError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <CameraOff size={28} className="mx-auto text-red-400 mb-3" />
            <div className="text-sm font-semibold text-red-800 mb-1">{camError}</div>
            <button
              onClick={() => { setCamError(null); iniciarCamara(); }}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors"
            >
              <RefreshCw size={13} />
              Reintentar
            </button>
          </div>
        )}

        {/* ── Cámara activa ─────────────────────────────────────────────────── */}
        {scanning && (
          <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
            {/* Video feed */}
            <div className="relative bg-black aspect-video">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
                onPlay={handleVideoPlay}
              />
              {/* Overlay: visor QR */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  className="w-52 h-52 rounded-xl"
                  style={{
                    border: '3px solid rgba(255,255,255,0.8)',
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
                  }}
                />
              </div>
              {/* Esquinas del visor */}
              {[
                'top-[calc(50%-108px)] left-[calc(50%-108px)]',
                'top-[calc(50%-108px)] right-[calc(50%-108px)] rotate-90',
                'bottom-[calc(50%-108px)] right-[calc(50%-108px)] rotate-180',
                'bottom-[calc(50%-108px)] left-[calc(50%-108px)] -rotate-90',
              ].map((pos, i) => (
                <div
                  key={i}
                  className={`absolute ${pos} w-7 h-7 pointer-events-none`}
                  style={{
                    borderTop: '3px solid var(--color-guinda-400, #c45d7a)',
                    borderLeft: '3px solid var(--color-guinda-400, #c45d7a)',
                    borderRadius: '4px 0 0 0',
                  }}
                />
              ))}
            </div>

            {/* Footer */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-stone-600">
                {state.tipo === 'validando' ? (
                  <>
                    <Loader2 size={14} className="animate-spin text-[var(--color-guinda-700)]" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    Buscando código QR...
                  </>
                )}
              </div>
              <button
                onClick={reiniciar}
                className="text-xs text-stone-500 hover:text-stone-700 underline"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* ── Canvas oculto para jsQR ───────────────────────────────────────── */}
        <canvas ref={canvasRef} className="hidden" />

        {/* ── Resultado: VÁLIDO ─────────────────────────────────────────────── */}
        {state.tipo === 'ok' && (
          <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
            {/* Banner verde */}
            <div className="bg-green-600 px-5 py-4 flex items-center gap-3 text-white">
              <CheckCircle2 size={22} />
              <div>
                <div className="font-bold text-sm">Pase validado correctamente</div>
                <div className="text-xs opacity-80 font-mono mt-0.5">{state.data.folio}</div>
              </div>
            </div>

            {/* Datos del alumno */}
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: '#f5f0eb', color: 'var(--color-guinda-700)' }}
                >
                  <User size={18} />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-widest text-stone-400 mb-0.5">Alumno</div>
                  <div className="font-bold text-stone-900">{state.data.estudiante.nombre}</div>
                  <div className="font-mono text-sm text-stone-500">{state.data.estudiante.curp}</div>
                </div>
              </div>

              <div className="h-px bg-stone-100" />

              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: '#f5f0eb', color: 'var(--color-guinda-700)' }}
                >
                  <BookOpen size={18} />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-widest text-stone-400 mb-0.5">Módulo</div>
                  <div className="font-bold text-stone-900">
                    M{state.data.modulo.numero} — {state.data.modulo.nombre}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-5 pb-5">
              <button
                onClick={reiniciar}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold border border-stone-200 rounded-xl text-stone-700 hover:bg-stone-50 transition-colors"
              >
                <QrCode size={14} />
                Escanear otro pase
              </button>
            </div>
          </div>
        )}

        {/* ── Resultado: CREDENCIAL VÁLIDA ──────────────────────────────────── */}
        {state.tipo === 'okCred' && (
          <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
            <div className={`px-5 py-4 flex items-center gap-3 text-white ${state.data.vencida ? 'bg-amber-600' : 'bg-green-600'}`}>
              {state.data.vencida ? <AlertCircle size={22} /> : <CheckCircle2 size={22} />}
              <div>
                <div className="font-bold text-sm">{state.data.vencida ? 'Credencial vencida' : 'Credencial válida'}</div>
                <div className="text-xs opacity-80 font-mono mt-0.5">{state.data.folio}</div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: '#f5f0eb', color: 'var(--color-guinda-700)' }}>
                  <IdCard size={18} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-widest text-stone-400 mb-0.5">Alumno</div>
                  <div className="font-bold text-stone-900">{state.data.nombre}</div>
                  {state.data.matricula && <div className="font-mono text-sm text-stone-500">Matrícula: {state.data.matricula}</div>}
                  {state.data.curp && <div className="font-mono text-xs text-stone-400">{state.data.curp}</div>}
                </div>
              </div>
            </div>

            <div className="px-5 pb-5 space-y-2">
              <button
                onClick={() => setLocation(`/admin/alumnos/${state.data.alumnoId}`)}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white rounded-xl"
                style={{ background: 'var(--color-guinda-700)' }}
              >
                <ExternalLink size={14} /> Ver alumno
              </button>
              <button
                onClick={reiniciar}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold border border-stone-200 rounded-xl text-stone-700 hover:bg-stone-50 transition-colors"
              >
                <IdCard size={14} /> Escanear otra credencial
              </button>
            </div>
          </div>
        )}

        {/* ── Resultado: ERROR ──────────────────────────────────────────────── */}
        {state.tipo === 'error' && (
          <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
            {/* Banner rojo */}
            <div className="bg-red-600 px-5 py-4 flex items-center gap-3 text-white">
              <AlertCircle size={22} />
              <div>
                <div className="font-bold text-sm">No se pudo validar</div>
                {state.folio && (
                  <div className="text-xs opacity-80 font-mono mt-0.5">{state.folio}</div>
                )}
              </div>
            </div>

            <div className="p-5">
              <p className="text-sm text-stone-700 mb-5">{state.mensaje}</p>
              <button
                onClick={reiniciar}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold border border-stone-200 rounded-xl text-stone-700 hover:bg-stone-50 transition-colors"
              >
                <RefreshCw size={14} />
                Intentar de nuevo
              </button>
            </div>
          </div>
        )}

        {/* ── Instrucciones ─────────────────────────────────────────────────── */}
        {state.tipo === 'idle' && !camError && (
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 text-xs text-stone-500 space-y-1.5">
            <div className="font-semibold text-stone-700 mb-2">Instrucciones para el operador</div>
            <div>1. Pide al alumno que abra su credencial digital en el portal.</div>
            <div>2. Presiona "Abrir cámara" y apunta al código QR de la credencial.</div>
            <div>3. El sistema verificará la credencial automáticamente.</div>
            <div>4. Si es válida, se abrirá el expediente del alumno en administración.</div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
