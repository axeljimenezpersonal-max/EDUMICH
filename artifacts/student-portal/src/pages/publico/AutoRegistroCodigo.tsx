import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { Loader2, RefreshCw, KeyRound } from 'lucide-react';
import { AutoRegistroLayout } from './AutoRegistroLayout';
import { api } from '../../lib/api';

const EXPIRY_SECS = 10 * 60;

export default function AutoRegistroCodigo() {
  const [, setLocation] = useLocation();
  const email = sessionStorage.getItem('reg_email') ?? '';
  const codigoDev = sessionStorage.getItem('reg_codigo_dev');
  const modo = sessionStorage.getItem('reg_modo') ?? 'dev';

  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(EXPIRY_SECS);
  const [reenvioSecs, setReenvioSecs] = useState(0);
  const [reenvioLoading, setReenvioLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Redirige si no hay email
  useEffect(() => {
    if (!email) setLocation('/registro/email');
  }, [email, setLocation]);

  // Cuenta regresiva principal
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  // Cuenta regresiva de reenvío
  useEffect(() => {
    if (reenvioSecs <= 0) return;
    const t = setTimeout(() => setReenvioSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [reenvioSecs]);

  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  }

  function handleDigitChange(i: number, val: string) {
    const ch = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = ch;
    setDigits(next);
    if (ch && i < 5) inputRefs.current[i + 1]?.focus();
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!paste) return;
    const next = [...digits];
    for (let i = 0; i < 6; i++) next[i] = paste[i] ?? '';
    setDigits(next);
    const focusIdx = Math.min(paste.length, 5);
    inputRefs.current[focusIdx]?.focus();
  }

  async function handleVerificar() {
    const codigo = digits.join('');
    if (codigo.length !== 6) return;
    setError(null);
    setLoading(true);
    try {
      const r = await api.post<{ ok: boolean; token: string }>(
        '/publico/email/verificar-codigo',
        { email, codigo, tipo: 'auto_registro' }
      );
      sessionStorage.setItem('reg_token', r.token);
      setLocation('/registro/datos');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleReenviar() {
    setReenvioLoading(true);
    setError(null);
    try {
      const r = await api.post<{ ok: boolean; modo: string; codigoDev?: string }>(
        '/publico/email/solicitar-codigo',
        { email, tipo: 'auto_registro' }
      );
      if (r.codigoDev) sessionStorage.setItem('reg_codigo_dev', r.codigoDev);
      setDigits(['', '', '', '', '', '']);
      setSecondsLeft(EXPIRY_SECS);
      setReenvioSecs(60);
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setReenvioLoading(false);
    }
  }

  const codigoCompleto = digits.every((d) => d !== '');

  return (
    <AutoRegistroLayout paso={2}>
      {/* Banner DEV */}
      {modo === 'dev' && codigoDev && (
        <div className="mb-4 bg-orange-100 border border-orange-300 rounded-md px-4 py-3 flex items-start gap-2">
          <span className="text-orange-700 font-bold text-xs bg-orange-200 px-1.5 py-0.5 rounded shrink-0">
            DEV
          </span>
          <div className="text-sm text-orange-800">
            Modo desarrollo — el correo no se envió.{' '}
            <span className="font-mono font-bold tracking-widest text-orange-900">
              Código: {codigoDev}
            </span>
          </div>
        </div>
      )}

      <div className="bg-white border border-stone-200 rounded-md p-8 shadow-sm">
        <div className="flex items-center gap-2 text-[var(--color-guinda-700)] mb-2">
          <KeyRound size={18} />
          <span className="text-xs font-semibold uppercase tracking-widest">
            Verificación
          </span>
        </div>
        <h1 className="font-serif text-2xl font-bold text-stone-900 mb-1">
          Ingresa el código
        </h1>
        <p className="text-stone-500 text-sm mb-6">
          Enviamos un código de 6 dígitos a{' '}
          <span className="font-medium text-stone-700">{email}</span>
        </p>

        {/* 6 inputs cuadrados */}
        <div className="flex gap-2 justify-center mb-6">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleDigitChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={handlePaste}
              className={`w-11 h-13 text-center text-xl font-bold border-2 rounded-md bg-white focus:outline-none transition-colors ${
                d
                  ? 'border-[var(--color-guinda-500)] text-[var(--color-guinda-800)]'
                  : 'border-stone-300 text-stone-900'
              } focus:border-[var(--color-guinda-500)]`}
              style={{ height: '52px' }}
            />
          ))}
        </div>

        {/* Temporizador */}
        <div
          className={`text-center text-sm mb-4 ${
            secondsLeft < 60 ? 'text-red-600 font-semibold' : 'text-stone-500'
          }`}
        >
          {secondsLeft > 0 ? (
            <>Expira en {formatTime(secondsLeft)}</>
          ) : (
            <span className="text-red-600">El código expiró. Solicita uno nuevo.</span>
          )}
        </div>

        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">
            {error}
          </div>
        )}

        <button
          onClick={handleVerificar}
          disabled={!codigoCompleto || loading || secondsLeft === 0}
          className="gov-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 mb-3"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : null}
          {loading ? 'Verificando...' : 'Verificar código'}
        </button>

        <button
          onClick={handleReenviar}
          disabled={reenvioSecs > 0 || reenvioLoading}
          className="gov-btn-secondary w-full flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
        >
          {reenvioLoading ? (
            <Loader2 className="animate-spin" size={16} />
          ) : (
            <RefreshCw size={16} />
          )}
          {reenvioSecs > 0
            ? `Reenviar en ${reenvioSecs}s`
            : reenvioLoading
            ? 'Reenviando...'
            : 'Reenviar código'}
        </button>
      </div>
    </AutoRegistroLayout>
  );
}
