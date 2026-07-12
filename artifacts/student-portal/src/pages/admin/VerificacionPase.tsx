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
  ScanLine,
  ShieldCheck,
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
  firmaValida: boolean;
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

      <div className="max-w-2xl mx-auto space-y-5">

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
          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div
              className="relative px-8 py-10 text-center text-white"
              style={{ background: 'linear-gradient(150deg, var(--color-guinda-700), var(--color-guinda-800) 90%)' }}
            >
              {/* trama sutil de puntos */}
              <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '14px 14px' }} />
              <div className="relative">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
                  <ScanLine size={30} className="text-white" />
                </div>
                <h2 className="font-serif text-2xl font-bold tracking-tight">
                  {modo === 'credencial' ? 'Escanear credencial del alumno' : 'Escanear pase de examen'}
                </h2>
                <p className="mx-auto mt-2 max-w-sm text-sm text-white/80">
                  {modo === 'credencial'
                    ? 'Pide al alumno que muestre el QR de su credencial digital. Al escanearlo, se abre su expediente al instante.'
                    : 'Pide al alumno que muestre el QR de su pase provisional para verificar y registrar su asistencia.'}
                </p>
                <button
                  onClick={iniciarCamara}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3 text-sm font-bold text-[var(--color-guinda-800)] shadow-md transition-transform hover:scale-[1.02] active:scale-95"
                >
                  <Camera size={17} /> Abrir cámara
                </button>
                <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] font-medium text-white/70">
                  <ShieldCheck size={13} /> Verificación con firma digital · procesada en el dispositivo
                </div>
              </div>
            </div>
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

              {/* Firma digital del QR: auténtica (verde) vs sin firma (ámbar) */}
              <div
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${
                  state.data.firmaValida
                    ? 'border-green-200 bg-green-50 text-green-800'
                    : 'border-amber-200 bg-amber-50 text-amber-800'
                }`}
              >
                <ShieldCheck size={15} className="shrink-0" />
                {state.data.firmaValida
                  ? 'Firma digital auténtica — este QR fue emitido por EDUMICH.'
                  : 'QR sin firma verificable. Revisa que sea la credencial oficial vigente del alumno.'}
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

        {/* ── ¿Cómo funciona? (3 pasos) ─────────────────────────────────────── */}
        {state.tipo === 'idle' && !camError && (
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <div className="mb-4 flex items-center gap-2">
              <ScanLine size={16} className="text-[var(--color-guinda-700)]" />
              <h3 className="font-serif text-base font-bold text-stone-900">¿Cómo funciona?</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {([
                { n: 1, Icon: IdCard, t: 'El alumno abre su credencial', d: 'Desde su portal muestra el QR de su credencial digital.' },
                { n: 2, Icon: Camera, t: 'Apunta la cámara al QR', d: 'Presiona “Abrir cámara” y encuadra el código.' },
                { n: 3, Icon: User, t: 'Se abre su expediente', d: 'La credencial se verifica y saltas directo a su ficha.' },
              ]).map((s) => (
                <div key={s.n} className="relative rounded-xl border border-stone-100 bg-stone-50/60 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: 'var(--color-guinda-700)' }}>{s.n}</span>
                    <s.Icon size={15} className="text-[var(--color-guinda-700)]" />
                  </div>
                  <div className="text-sm font-semibold text-stone-800">{s.t}</div>
                  <div className="mt-0.5 text-xs text-stone-500">{s.d}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
