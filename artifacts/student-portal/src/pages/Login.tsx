/**
 * Página de login.
 *
 * Ubicación destino en Replit: artifacts/student-portal/src/pages/Login.tsx
 */

import { useState } from 'react';
import { useLocation } from 'wouter';
import { api } from '../lib/api';
import { GraduationCap, Lock, Mail, Loader2, Edit3, HelpCircle } from 'lucide-react';

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
      const r = await api.post<{ user: { rol: string; passwordTemporal: boolean } }>(
        '/auth/login',
        { email, password }
      );
      if (r.user.rol === 'gestor') {
        setLocation('/gestor');
      } else if (r.user.rol === 'admin') {
        setLocation('/admin');
      } else if (r.user.rol === 'direccion') {
        setLocation('/direccion');
      } else if (r.user.passwordTemporal) {
        setLocation('/estudiante/cambiar-password');
      } else {
        setLocation('/estudiante');
      }
    } catch (err) {
      setError((err as Error).message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Cuerpo split — sin banda superior para que el login quepa en una
          sola pantalla; el sello de gobierno vive en la columna izquierda. */}
      <div className="flex-1 grid md:grid-cols-2">

        {/* Columna izquierda: branding — oculta en móvil */}
        <div
          className="hidden md:flex bg-[var(--color-guinda-800)] text-white relative overflow-hidden"
          style={{ flexDirection: 'column', padding: '36px 60px 28px' }}
        >
          {/* Patrón decorativo sutil */}
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.4) 0%, transparent 40%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.2) 0%, transparent 40%)',
            }}
          />

          {/* Brand — siempre arriba */}
          <div className="relative" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 0 }}>
            <img
              src="/logo-see-blanco-256.png"
              alt="Secretaría de Educación de Michoacán"
              style={{ width: 48, height: 48, objectFit: 'contain', display: 'block', flexShrink: 0 }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <div style={{ lineHeight: 1.25 }}>
              <div className="font-serif" style={{ fontSize: 15, fontWeight: 600 }}>Gobierno de Michoacán</div>
              <div style={{ fontSize: 9, letterSpacing: '0.14em', opacity: 0.75 }}>HONESTIDAD Y TRABAJO</div>
            </div>
          </div>

          {/* Centro — crece para llenar espacio, centra su contenido */}
          <div
            className="relative"
            style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: 20, paddingBottom: 20 }}
          >
            {/* Preparatoria Abierta pill (programa) — EDUMICH es la marca principal */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)',
                borderRadius: 999, padding: '6px 14px',
                fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                color: 'white', opacity: 0.9,
              }}>
                <GraduationCap size={10} />
                Preparatoria Abierta
                <span style={{ opacity: 0.5 }}>·</span>
                Michoacán
              </div>
            </div>
            <h1 className="font-serif font-bold" style={{ fontSize: 52, lineHeight: 1.1, marginBottom: 8, textAlign: 'center' }}>
              EDUMICH
            </h1>
            <div style={{
              fontSize: 13, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase',
              textAlign: 'center', marginBottom: 16, color: 'var(--color-dorado-soft)',
            }}>
              Plataforma Educativa Digital
            </div>
            <p style={{ fontSize: 14.5, lineHeight: 1.55, opacity: 0.88, marginBottom: 20, textAlign: 'center' }}>
              Sistema de gestión institucional para la coordinación, gestores municipales y
              estudiantes del Plan Modular del Instituto de Educación Media Superior y Superior.
            </p>

            {/* Ilustración centrada — compacta para que el login quepa en una pantalla */}
            <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
              <img
                src="/ilustracion-login.svg"
                alt=""
                style={{ width: '100%', maxWidth: 340, height: 'auto', opacity: 0.88, display: 'block' }}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </div>
          </div>

          {/* Footer — siempre abajo */}
          <div
            className="relative"
            style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 18 }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>
              Instituto de Educación Media Superior y Superior del Estado de Michoacán
            </div>
            <div style={{ fontSize: 11, opacity: 0.65, marginBottom: 8 }}>
              Una plataforma para acompañar tu camino al bachillerato.
            </div>
            <div style={{ fontSize: 10, opacity: 0.5, letterSpacing: '0.06em' }}>
              Powered by <strong>EDUMICH</strong> · Plataforma Educativa Digital
            </div>
          </div>
        </div>

        {/* Columna derecha: formulario */}
        <div
          className="flex items-center justify-center bg-[var(--color-crema-100)]"
          style={{ padding: '40px 60px' }}
        >
          <div className="w-full max-w-md">
            <div className="flex items-center gap-2 text-[var(--color-guinda-700)] mb-1.5">
              <GraduationCap size={18} />
              <span className="text-xs font-semibold uppercase tracking-widest">
                Acceso al sistema
              </span>
            </div>
            <h2 className="font-serif font-bold text-stone-900 mb-1" style={{ fontSize: 28 }}>
              Bienvenido
            </h2>
            <p className="text-sm text-stone-600 mb-5">
              Inicia sesión con tus credenciales institucionales.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="gov-label" htmlFor="email">
                  Correo institucional
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
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
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
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
                <div className="flex justify-end mt-1.5">
                  <a
                    href="/recuperar-password"
                    className="text-xs font-medium hover:underline"
                    style={{ color: 'var(--color-guinda-700)' }}
                  >
                    ¿Olvidaste tu contraseña?
                  </a>
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
                style={{ paddingTop: 10, paddingBottom: 10 }}
              >
                {loading ? <Loader2 className="animate-spin" size={17} /> : null}
                {loading ? 'Iniciando sesión...' : 'Entrar'}
              </button>
            </form>

            {/* Divisor */}
            <div className="flex items-center gap-3 mt-4 mb-3">
              <div className="flex-1 h-px bg-stone-200" />
              <span className="text-xs text-stone-400 whitespace-nowrap">¿No tienes cuenta?</span>
              <div className="flex-1 h-px bg-stone-200" />
            </div>

            {/* Opción de registro */}
            <a
              href="/solicitar-cuenta"
              className="flex items-center gap-3 p-3 border border-stone-200 rounded-md bg-white hover:bg-stone-50 hover:border-[var(--color-guinda-300)] transition-colors group"
            >
              <Edit3 size={16} className="text-stone-400 group-hover:text-[var(--color-guinda-600)] transition-colors shrink-0" />
              <div>
                <div className="text-xs font-semibold text-stone-700 group-hover:text-[var(--color-guinda-800)]">
                  Solicitar cuenta
                </div>
                <div className="text-[10px] text-stone-400 leading-tight">
                  La secretaría te dará acceso
                </div>
              </div>
            </a>

            {/* ¿No recuerdas si tienes cuenta? */}
            <a
              href="/encontrar-cuenta"
              className="mt-2 flex items-center gap-3 p-3 border border-stone-200 rounded-md bg-white hover:bg-stone-50 hover:border-[var(--color-guinda-300)] transition-colors group"
            >
              <HelpCircle size={16} className="text-stone-400 group-hover:text-[var(--color-guinda-600)] transition-colors shrink-0" />
              <div>
                <div className="text-xs font-semibold text-stone-700 group-hover:text-[var(--color-guinda-800)]">
                  No recuerdo si tengo cuenta
                </div>
                <div className="text-[10px] text-stone-400 leading-tight">
                  Búscala por CURP o por nombre
                </div>
              </div>
            </a>

            <div className="mt-4" style={{ fontSize: 11, color: '#6b635e', lineHeight: 1.4 }}>
              Al iniciar sesión aceptas el aviso de privacidad institucional. Tus datos se
              protegen conforme a la LGPDPPSO.{' '}
              <a
                href="/aviso-privacidad"
                style={{ color: 'var(--color-guinda-700)', textDecoration: 'underline' }}
                className="hover:no-underline"
              >
                Consultar aviso
              </a>
              .
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
