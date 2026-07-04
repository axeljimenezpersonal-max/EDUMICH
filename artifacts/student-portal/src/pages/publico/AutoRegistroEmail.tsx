import { useState } from 'react';
import { useLocation } from 'wouter';
import { Mail, Loader2 } from 'lucide-react';
import { AutoRegistroLayout } from './AutoRegistroLayout';
import { api } from '../../lib/api';

export default function AutoRegistroEmail() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const r = await api.post<{ ok: boolean; modo: string; codigoDev?: string }>(
        '/publico/email/solicitar-codigo',
        { email, tipo: 'auto_registro' }
      );
      sessionStorage.setItem('reg_email', email);
      if (r.codigoDev) sessionStorage.setItem('reg_codigo_dev', r.codigoDev);
      sessionStorage.setItem('reg_modo', r.modo);
      setLocation('/registro/codigo');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AutoRegistroLayout paso={1}>
      <div className="bg-white border border-stone-200 rounded-md p-8 shadow-sm">
        <div className="flex items-center gap-2 text-[var(--color-guinda-700)] mb-2">
          <Mail size={18} />
          <span className="text-xs font-semibold uppercase tracking-widest">
            Nuevo registro
          </span>
        </div>
        <h1 className="font-serif text-2xl font-bold text-stone-900 mb-1">
          ¿Cuál es tu correo?
        </h1>
        <p className="text-stone-500 text-sm mb-6">
          Te enviaremos un código de 6 dígitos para verificar tu identidad.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="gov-label" htmlFor="email">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jose.morelos@ejemplo.com"
              className="gov-input"
            />
          </div>

          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email}
            className="gov-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : null}
            {loading ? 'Enviando...' : 'Enviarme el código'}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-stone-500">
          ¿Ya tienes cuenta?{' '}
          <a href="/login" className="text-[var(--color-guinda-700)] hover:underline">
            Inicia sesión
          </a>
        </div>
      </div>
    </AutoRegistroLayout>
  );
}
