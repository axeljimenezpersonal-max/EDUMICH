/**
 * Página de login.
 *
 * Ubicación destino en Replit: artifacts/student-portal/src/pages/Login.tsx
 */

import { useState } from 'react';
import { useLocation } from 'wouter';
import { api } from '../lib/api';
import { GraduationCap, Lock, Mail, Loader2 } from 'lucide-react';

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const r = await api.post<{ user: { rol: string } }>('/auth/login', { email, password });
      if (r.user.rol === 'gestor') setLocation('/gestor');
      else if (r.user.rol === 'admin') setLocation('/admin');
      else setLocation('/estudiante');
    } catch (err) {
      setError((err as Error).message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Banda institucional */}
      <div className="bg-[var(--color-guinda-700)] text-white text-xs">
        <div className="max-w-7xl mx-auto px-4 py-1.5">
          <span className="font-medium tracking-wide">
            GOBIERNO DEL ESTADO DE MICHOACÁN · HONESTIDAD Y TRABAJO
          </span>
        </div>
      </div>

      {/* Cuerpo split */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Columna izquierda: branding */}
        <div className="md:w-1/2 bg-[var(--color-guinda-700)] text-white p-10 md:p-16 flex flex-col justify-between relative overflow-hidden">
          {/* Patrón decorativo sutil */}
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.4) 0%, transparent 40%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.2) 0%, transparent 40%)',
            }}
          />
          <div className="relative">
            <div className="flex items-center gap-3 mb-12">
              <div className="w-14 h-14 rounded-sm bg-white text-[var(--color-guinda-700)] flex items-center justify-center font-serif text-xl font-bold">
                GM
              </div>
              <div className="leading-tight">
                <div className="font-serif text-base font-semibold">Gobierno de Michoacán</div>
                <div className="text-[10px] tracking-widest opacity-80">
                  HONESTIDAD Y TRABAJO
                </div>
              </div>
            </div>

            <h1 className="font-serif text-4xl md:text-5xl font-bold leading-tight mb-4">
              Prepa Abierta
            </h1>
            <p className="text-lg opacity-90 max-w-md leading-relaxed">
              Sistema de gestión institucional para la coordinación, gestores municipales y
              estudiantes del Plan Modular del Instituto de Educación Media Superior y Superior.
            </p>
          </div>

          <div className="relative text-sm opacity-80 border-t border-white/20 pt-6 mt-12">
            <div className="font-medium mb-1">
              Instituto de Educación Media Superior y Superior del Estado de Michoacán
            </div>
            <div className="text-xs opacity-75">
              Una plataforma para acompañar tu camino al bachillerato.
            </div>
          </div>
        </div>

        {/* Columna derecha: formulario */}
        <div className="md:w-1/2 flex items-center justify-center p-8 md:p-16 bg-[var(--color-crema-100)]">
          <div className="w-full max-w-md">
            <div className="flex items-center gap-2 text-[var(--color-guinda-700)] mb-2">
              <GraduationCap size={20} />
              <span className="text-xs font-semibold uppercase tracking-widest">
                Acceso al sistema
              </span>
            </div>
            <h2 className="font-serif text-3xl font-bold text-stone-900 mb-1">Bienvenido</h2>
            <p className="text-stone-600 mb-8">
              Inicia sesión con tus credenciales institucionales.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="gov-label" htmlFor="email">
                  Correo institucional
                </label>
                <div className="relative">
                  <Mail
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                  />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@michoacan.gob.mx"
                    className="gov-input pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="gov-label" htmlFor="password">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                  />
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="gov-input pl-10"
                  />
                </div>
              </div>

              {error && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="gov-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : null}
                {loading ? 'Iniciando sesión...' : 'Entrar'}
              </button>
            </form>

            <div className="mt-8 text-xs text-stone-500 leading-relaxed">
              Al iniciar sesión aceptas el aviso de privacidad institucional. Tus datos personales
              son protegidos conforme a la Ley General de Protección de Datos Personales en
              Posesión de Sujetos Obligados (LGPDPPSO).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
