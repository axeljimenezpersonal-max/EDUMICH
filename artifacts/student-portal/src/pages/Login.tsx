/**
 * Página de login.
 *
 * Ubicación destino en Replit: artifacts/student-portal/src/pages/Login.tsx
 */

import { useState } from 'react';
import { useLocation } from 'wouter';
import { api } from '../lib/api';
import { GraduationCap, Lock, Mail, Loader2, Edit3, Search, ChevronRight, KeyRound } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import ModulaLogo from '../components/ModulaLogo';

const CLAVE_CORREO = 'modula_ultimo_correo';

export default function Login() {
  const [, setLocation] = useLocation();
  // Recordar el correo: se precarga el último con el que se entró (como en la
  // mayoría de los sitios). Solo el correo, nunca la contraseña.
  const [email, setEmail] = useState(() => {
    try { return localStorage.getItem(CLAVE_CORREO) ?? ''; } catch { return ''; }
  });
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
      // Se recuerda el correo para la próxima vez (no la contraseña).
      try { localStorage.setItem(CLAVE_CORREO, email); } catch { /* noop */ }
      // Primer ingreso (contraseña temporal): TODOS los roles deben crear su
      // contraseña antes de entrar. Se comprueba ANTES del destino por rol.
      if (r.user.passwordTemporal) {
        setLocation('/cambiar-password');
      } else if (r.user.rol === 'gestor') {
        setLocation('/gestor');
      } else if (r.user.rol === 'admin') {
        setLocation('/admin');
      } else if (r.user.rol === 'direccion') {
        setLocation('/direccion');
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

        {/* Banda de marca en teléfono. La columna de la izquierda no cabe, pero
            dejar al alumno sin marca tampoco es opción: la mayoría entra desde
            aquí. Va la versión sólida porque a este ancho la Ó queda por debajo
            de 32px y los cortes se cerrarían. */}
        {/* El layout va en clases, no en `style`: un `display` inline le gana a
            `md:hidden` y la banda se colaba también en escritorio. */}
        <div
          className="sobre-guinda md:hidden flex flex-col gap-3.5 bg-[var(--color-guinda-800)] text-white px-6 pt-[22px] pb-5"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <BrandLogo variante="blanco" className="w-8 h-8 object-contain shrink-0" />
            <div style={{ fontSize: 10, letterSpacing: '0.12em', opacity: 0.8 }}>
              GOBIERNO DE MICHOACÁN
            </div>
          </div>
          <div>
            <ModulaLogo solido titulo="Módula 22" acento="var(--color-dorado-soft)"
                        style={{ width: 190, height: 'auto', display: 'block' }} />
            <div style={{
              fontSize: 10, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase',
              marginTop: 10, color: 'var(--color-dorado-soft)',
            }}>
              Plan 22 · Preparatoria Abierta
            </div>
          </div>
        </div>

        {/* Columna izquierda: marca — oculta en móvil, donde va la banda compacta */}
        <div
          className="sobre-guinda hidden md:flex bg-[var(--color-guinda-800)] text-white relative overflow-hidden"
          style={{ flexDirection: 'column', padding: '36px 60px 28px' }}
        >
          {/* Brand — siempre arriba */}
          <div className="relative" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 0 }}>
            <BrandLogo variante="blanco" className="w-12 h-12 object-contain shrink-0" />
            <div style={{ lineHeight: 1.25 }}>
              <div className="font-serif" style={{ fontSize: 15, fontWeight: 600 }}>Gobierno de Michoacán</div>
              <div style={{ fontSize: 9, letterSpacing: '0.14em', opacity: 0.75 }}>HONESTIDAD Y TRABAJO</div>
            </div>
          </div>

          {/* Centro — la marca es el ancla, no un logo tímido en la esquina */}
          <div
            className="relative"
            style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: 20, paddingBottom: 20 }}
          >
            {/* El wordmark viene vectorizado: no depende de que cargue ninguna
                fuente. Los 22 arcos de la Ó se dibujan uno por uno al entrar. */}
            <ModulaLogo
              animar
              acento="var(--color-dorado-soft)"
              titulo="Módula 22"
              style={{ width: '100%', maxWidth: 420, margin: '0 auto', display: 'block' }}
            />
            <div style={{
              fontSize: 12, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase',
              textAlign: 'center', marginTop: 22, marginBottom: 14, color: 'var(--color-dorado-soft)',
            }}>
              Plan 22 · Preparatoria Abierta
            </div>
            <p style={{
              fontSize: 14.5, lineHeight: 1.6, opacity: 0.85, textAlign: 'center',
              maxWidth: 380, marginInline: 'auto',
            }}>
              Veintidós módulos, uno a la vez, hasta tu certificado de bachillerato.
              Aquí llevas tu avance, tus pagos y tus calificaciones.
            </p>
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
              Powered by <strong>Módula 22</strong> · Plataforma Educativa Digital
            </div>
          </div>
        </div>

        {/* Columna derecha: formulario */}
        <div
          className="flex items-center justify-center bg-[var(--color-crema-100)] px-5 py-8 sm:px-10 md:px-[60px] md:py-10"
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
                    name="email"
                    type="email"
                    // "username" (no "email") es el token que Chrome/Safari
                    // reconocen como el identificador de un login, y lo que
                    // dispara el "¿Guardar contraseña?" al entrar.
                    autoComplete="username"
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
                    name="password"
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

              {/* Si falla el acceso, la salida va JUNTO al error: es el momento
                  exacto en que la persona se pregunta si acaso tiene cuenta. */}
              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  {error}
                  {/* Si las credenciales no coinciden, lo útil es recuperar la
                      contraseña — no "buscar cuenta", que confunde: la cuenta ya
                      existe. Buscarla vive abajo, para quien no sabe si la tiene. */}
                  <a
                    href="/recuperar-password"
                    className="group mt-2 flex items-center gap-1.5 text-[13px] font-bold text-[var(--color-guinda-700)] hover:text-[var(--color-guinda-800)]"
                  >
                    <KeyRound size={13} />
                    <span className="underline decoration-2 underline-offset-2">Recuperar mi contraseña</span>
                    <ChevronRight size={14} className="transition-transform group-hover:translate-x-1" />
                  </a>
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
              <span className="text-xs text-stone-400 whitespace-nowrap">¿Primera vez aquí?</span>
              <div className="flex-1 h-px bg-stone-200" />
            </div>

            {/* Dos caminos, con el mismo peso visual que el resto de Módula:
                icono en pastilla guinda, texto legible y flecha que se desliza. */}
            <a
              href="/solicitar-cuenta"
              className="group flex items-center gap-3 rounded-xl border-2 border-[var(--color-crema-200)] bg-white p-3.5 transition-all hover:-translate-y-0.5 hover:border-[var(--color-guinda-700)] hover:shadow-md"
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors"
                style={{ background: 'var(--color-crema-100)', color: 'var(--color-guinda-700)' }}
              >
                <Edit3 size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-stone-800 group-hover:text-[var(--color-guinda-800)]">
                  Solicitar cuenta
                </div>
                <div className="text-[11px] leading-tight text-stone-500">
                  Eres nuevo: la Secretaría te dará acceso
                </div>
              </div>
              <ChevronRight size={18} className="shrink-0 text-stone-300 transition-all group-hover:translate-x-1 group-hover:text-[var(--color-guinda-700)]" />
            </a>

            {/* ¿No recuerdas si tienes cuenta? → aquí picas y listo. */}
            <a
              href="/encontrar-cuenta"
              className="group mt-2.5 flex items-center gap-3 rounded-xl border-2 border-[var(--color-crema-200)] bg-white p-3.5 transition-all hover:-translate-y-0.5 hover:border-[var(--color-guinda-700)] hover:shadow-md"
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors"
                style={{ background: 'var(--color-crema-100)', color: 'var(--color-guinda-700)' }}
              >
                <Search size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-stone-800 group-hover:text-[var(--color-guinda-800)]">
                  ¿No recuerdas si tienes cuenta?
                </div>
                <div className="text-[11px] leading-tight text-stone-500">
                  Búscala con tu CURP o tu nombre
                </div>
              </div>
              <ChevronRight size={18} className="shrink-0 text-stone-300 transition-all group-hover:translate-x-1 group-hover:text-[var(--color-guinda-700)]" />
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
