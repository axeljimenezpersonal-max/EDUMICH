import { useState } from 'react';
import {
  X,
  ArrowRight,
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  Shield,
  AlertCircle,
} from 'lucide-react';
import { api } from '../lib/api';
import { ModalHoja } from './ui/responsive';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type Paso = 1 | 2 | 'success';

function ReqItem({ met, label }: { met: boolean; label: string }) {
  return (
    <li
      className={`flex items-center gap-2 text-xs py-0.5 transition-colors ${
        met ? 'text-green-700' : 'text-stone-400'
      }`}
    >
      <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
        {met ? (
          <Check size={12} strokeWidth={3} />
        ) : (
          <span className="w-1 h-1 rounded-full bg-stone-300 block mx-auto" />
        )}
      </span>
      {label}
    </li>
  );
}


export default function CambiarPasswordModal({ open, onClose, onSuccess }: Props) {
  const [paso, setPaso] = useState<Paso>(1);
  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNueva, setPasswordNueva] = useState('');
  const [passwordConfirma, setPasswordConfirma] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showActual, setShowActual] = useState(false);
  const [showNueva, setShowNueva] = useState(false);
  const [showConfirma, setShowConfirma] = useState(false);

  const req8chars = passwordNueva.length >= 8;
  const reqMayuscula = /[A-Z]/.test(passwordNueva);
  const reqNumero = /[0-9]/.test(passwordNueva);
  const reqCoinciden = passwordNueva.length > 0 && passwordNueva === passwordConfirma;
  const todosRequisitos = req8chars && reqMayuscula && reqNumero && reqCoinciden;

  function handleClose() {
    if (paso === 'success' && onSuccess) onSuccess();
    setPaso(1);
    setPasswordActual('');
    setPasswordNueva('');
    setPasswordConfirma('');
    setErrorMsg(null);
    setLoading(false);
    onClose();
  }

  function handleContinuar() {
    if (!passwordActual.trim()) {
      setErrorMsg('Ingresa tu contraseña actual');
      return;
    }
    setErrorMsg(null);
    setPaso(2);
  }

  async function handleCambiar() {
    if (!todosRequisitos) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      await api.post('/auth/cambiar-password', { passwordActual, passwordNueva });
      setPaso('success');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al cambiar la contraseña';
      if (msg.includes('actual')) {
        setPaso(1);
        setErrorMsg(msg);
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  const titulo = paso === 'success' ? 'Contraseña actualizada' : 'Cambiar contraseña';

  const pie = (
    <div className="flex items-center justify-between gap-2 border-t border-stone-200 bg-white px-5 py-3">
      {paso !== 'success' ? (
        <span className="text-xs font-medium text-stone-400">Paso {paso} de 2</span>
      ) : (
        <span />
      )}

      <div className="flex items-center gap-2">
        {paso === 1 && (
          <>
            <button
              onClick={handleClose}
              className="min-h-[44px] rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleContinuar}
              className="flex min-h-[44px] items-center gap-1.5 rounded-md bg-[var(--color-guinda-700)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-guinda-800)]"
            >
              Continuar
              <ArrowRight size={14} />
            </button>
          </>
        )}

        {paso === 2 && (
          <>
            <button
              onClick={() => { setPaso(1); setErrorMsg(null); }}
              className="flex min-h-[44px] items-center gap-1.5 rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-50"
            >
              <ArrowLeft size={14} />
              Atrás
            </button>
            <button
              onClick={handleCambiar}
              disabled={!todosRequisitos || loading}
              className="flex min-h-[44px] items-center gap-1.5 rounded-md bg-[var(--color-guinda-700)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-guinda-800)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Check size={14} />
              {loading ? 'Guardando…' : 'Cambiar contraseña'}
            </button>
          </>
        )}

        {paso === 'success' && (
          <button
            onClick={handleClose}
            className="min-h-[44px] rounded-md bg-[var(--color-guinda-700)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-guinda-800)]"
          >
            Entendido
          </button>
        )}
      </div>
    </div>
  );

  return (
    <ModalHoja onClose={handleClose} etiqueta={titulo} ancho="sm:max-w-[460px]" pie={pie}>
      <div>
        {/* Header — fijo mientras el cuerpo se desplaza. */}
        <div className="bg-[var(--color-guinda-700)] text-white px-5 py-4 flex items-center justify-between sticky top-0 z-10">
          <h3 className="font-serif text-base font-semibold">{titulo}</h3>
          <button
            onClick={handleClose}
            aria-label="Cerrar"
            className="w-11 h-11 -mr-2 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }}>
              <X size={14} />
            </span>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 sm:px-7 py-6">
          {/* Stepper (pasos 1 y 2) */}
          {paso !== 'success' && (
            <div className="flex items-center justify-center gap-2 mb-6">
              {/* Dot 1 */}
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold transition-colors ${
                  paso === 2
                    ? 'bg-green-600 text-white'
                    : 'bg-[var(--color-guinda-700)] text-white'
                }`}
              >
                {paso === 2 ? <Check size={13} strokeWidth={3} /> : '1'}
              </div>
              {/* Line */}
              <div
                className={`h-0.5 w-9 transition-colors ${
                  paso === 2 ? 'bg-green-600' : 'bg-stone-200'
                }`}
              />
              {/* Dot 2 */}
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold transition-colors ${
                  paso === 2
                    ? 'bg-[var(--color-guinda-700)] text-white'
                    : 'bg-stone-200 text-stone-500'
                }`}
              >
                2
              </div>
            </div>
          )}

          {/* ── Paso 1 ── */}
          {paso === 1 && (
            <>
              <div className="text-center mb-5">
                <p className="font-serif text-lg font-bold text-stone-900 mb-1">
                  Confirma tu identidad
                </p>
                <p className="text-xs text-stone-500">
                  Ingresa tu contraseña actual para continuar
                </p>
              </div>

              {errorMsg && (
                <div className="mb-4 flex items-start gap-2.5 text-sm text-red-800 bg-red-50 border border-red-200 border-l-2 border-l-red-600 rounded-md px-3 py-2.5">
                  <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-600" />
                  {errorMsg}
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  Contraseña actual
                </label>
                <div className="relative">
                  <input
                    type={showActual ? 'text' : 'password'}
                    value={passwordActual}
                    onChange={(e) => setPasswordActual(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleContinuar()}
                    autoComplete="current-password"
                    className="w-full border border-stone-300 rounded-md px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-guinda-500)] focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowActual((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                    tabIndex={-1}
                  >
                    {showActual ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded-md px-3 py-2.5">
                <Shield size={14} className="mt-0.5 shrink-0 text-blue-600" />
                Por seguridad, necesitamos verificar tu identidad antes de cambiar tu
                contraseña.
              </div>
            </>
          )}

          {/* ── Paso 2 ── */}
          {paso === 2 && (
            <>
              <div className="text-center mb-5">
                <p className="font-serif text-lg font-bold text-stone-900 mb-1">
                  Crea tu nueva contraseña
                </p>
                <p className="text-xs text-stone-500">
                  Elige una contraseña segura y fácil de recordar
                </p>
              </div>

              {errorMsg && (
                <div className="mb-4 flex items-start gap-2.5 text-sm text-red-800 bg-red-50 border border-red-200 border-l-2 border-l-red-600 rounded-md px-3 py-2.5">
                  <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-600" />
                  {errorMsg}
                </div>
              )}

              <div className="mb-3">
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  Nueva contraseña
                </label>
                <div className="relative">
                  <input
                    type={showNueva ? 'text' : 'password'}
                    value={passwordNueva}
                    onChange={(e) => setPasswordNueva(e.target.value)}
                    autoComplete="new-password"
                    className="w-full border border-stone-300 rounded-md px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-guinda-500)] focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNueva((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                    tabIndex={-1}
                  >
                    {showNueva ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  Confirmar nueva contraseña
                </label>
                <div className="relative">
                  <input
                    type={showConfirma ? 'text' : 'password'}
                    value={passwordConfirma}
                    onChange={(e) => setPasswordConfirma(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && todosRequisitos && handleCambiar()}
                    autoComplete="new-password"
                    className="w-full border border-stone-300 rounded-md px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-guinda-500)] focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirma((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                    tabIndex={-1}
                  >
                    {showConfirma ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="bg-[var(--color-crema-100)] rounded-lg px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-500 mb-2">
                  Tu nueva contraseña debe cumplir:
                </p>
                <ul className="space-y-0.5">
                  <ReqItem met={req8chars} label="Al menos 8 caracteres" />
                  <ReqItem met={reqMayuscula} label="Una letra mayúscula" />
                  <ReqItem met={reqNumero} label="Un número" />
                  <ReqItem met={reqCoinciden} label="Las dos contraseñas coinciden" />
                </ul>
              </div>
            </>
          )}

          {/* ── Éxito ── */}
          {paso === 'success' && (
            <div className="text-center py-3">
              <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4">
                <Check size={32} strokeWidth={3} />
              </div>
              <h3 className="font-serif text-xl font-bold text-stone-900 mb-2">¡Listo!</h3>
              <p className="text-sm text-stone-500 max-w-[30ch] mx-auto leading-relaxed">
                Tu contraseña fue cambiada correctamente. La próxima vez que inicies sesión usa tu
                nueva contraseña.
              </p>
            </div>
          )}
        </div>
      </div>
    </ModalHoja>
  );
}
