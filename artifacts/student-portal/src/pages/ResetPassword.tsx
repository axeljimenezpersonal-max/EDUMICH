import { useEffect, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { api } from '../lib/api';
import { KeyRound, Loader2, CheckCircle, XCircle, Eye, EyeOff } from 'lucide-react';

type Estado = 'cargando' | 'invalido' | 'formulario' | 'exito';

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const token = params.get('token') ?? '';

  const [estado, setEstado] = useState<Estado>('cargando');
  const [tokenError, setTokenError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quita el token del query string una vez leído, para que no quede en el
  // historial del navegador ni en cabeceras Referer.
  useEffect(() => {
    if (token) window.history.replaceState(null, '', window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!token) { setTokenError('No se proporcionó un token de recuperación.'); setEstado('invalido'); return; }
    api.get<{ valido: boolean; error?: string }>(`/auth/validar-token-reset?token=${encodeURIComponent(token)}`)
      .then((r) => {
        if (r.valido) setEstado('formulario');
        else { setTokenError(r.error ?? 'Enlace no válido.'); setEstado('invalido'); }
      })
      .catch(() => { setTokenError('No se pudo validar el enlace. Intenta de nuevo.'); setEstado('invalido'); });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmar) { setError('Las contraseñas no coinciden.'); return; }
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return; }
    if (!/[0-9]/.test(password)) { setError('La contraseña debe incluir al menos un número.'); return; }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, nuevaPassword: password });
      setEstado('exito');
    } catch (err) {
      setError((err as Error).message || 'Error al restablecer la contraseña.');
    } finally {
      setLoading(false);
    }
  }

  const panelIzquierdo = (
    <div
      className="bg-[var(--color-guinda-700)] text-white relative overflow-hidden"
      style={{ display: 'flex', flexDirection: 'column', padding: '48px 60px' }}
    >
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.4) 0%, transparent 40%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.2) 0%, transparent 40%)' }} />
      <div className="relative" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <img src="/logo-see-blanco-256.png" alt="SEE" style={{ width: 48, height: 48, objectFit: 'contain', flexShrink: 0 }} />
        <div style={{ lineHeight: 1.25 }}>
          <div className="font-serif" style={{ fontSize: 15, fontWeight: 600 }}>Gobierno de Michoacán</div>
          <div style={{ fontSize: 9, letterSpacing: '0.14em', opacity: 0.75 }}>HONESTIDAD Y TRABAJO</div>
        </div>
      </div>
      <div className="relative" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: 32, paddingBottom: 32 }}>
        <h1 className="font-serif font-bold" style={{ fontSize: 44, lineHeight: 1.1, marginBottom: 16, textAlign: 'center' }}>Prepa Abierta</h1>
        <p style={{ fontSize: 15, lineHeight: 1.55, opacity: 0.88, textAlign: 'center' }}>
          Crea una nueva contraseña segura para tu cuenta.
        </p>
      </div>
      <div className="relative" style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>Instituto de Educación Media Superior y Superior del Estado de Michoacán</div>
        <div style={{ fontSize: 11, opacity: 0.65 }}>Tu seguridad es nuestra prioridad.</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <div className="bg-[var(--color-guinda-700)] text-white text-xs">
        <div className="max-w-7xl mx-auto px-4 py-1.5">
          <span className="font-medium tracking-wide">GOBIERNO DEL ESTADO DE MICHOACÁN · HONESTIDAD Y TRABAJO</span>
        </div>
      </div>
      <div className="flex-1 grid md:grid-cols-2">
        {panelIzquierdo}
        <div className="flex items-center justify-center bg-[var(--color-crema-100)]" style={{ padding: '40px 60px' }}>
          <div className="w-full max-w-md">

            {/* Cargando */}
            {estado === 'cargando' && (
              <div className="text-center py-12">
                <Loader2 className="animate-spin mx-auto mb-4" size={32} style={{ color: 'var(--color-guinda-700)' }} />
                <p className="text-sm text-stone-600">Verificando enlace…</p>
              </div>
            )}

            {/* Token inválido */}
            {estado === 'invalido' && (
              <div className="text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: '#fee2e2' }}>
                  <XCircle size={32} style={{ color: '#b91c1c' }} />
                </div>
                <h2 className="font-serif font-bold text-stone-900 mb-3" style={{ fontSize: 24 }}>Enlace no válido</h2>
                <p className="text-sm text-stone-600 mb-6" style={{ lineHeight: 1.6 }}>{tokenError}</p>
                <div className="space-y-2">
                  <button
                    onClick={() => setLocation('/recuperar-password')}
                    className="gov-btn-primary w-full text-sm"
                    style={{ paddingTop: 10, paddingBottom: 10 }}
                  >
                    Solicitar nuevo enlace
                  </button>
                  <button
                    onClick={() => setLocation('/login')}
                    className="w-full gov-btn-secondary text-sm"
                  >
                    Volver al inicio de sesión
                  </button>
                </div>
              </div>
            )}

            {/* Formulario */}
            {estado === 'formulario' && (
              <>
                <div className="flex items-center gap-2 text-[var(--color-guinda-700)] mb-1.5">
                  <KeyRound size={18} />
                  <span className="text-xs font-semibold uppercase tracking-widest">Nueva contraseña</span>
                </div>
                <h2 className="font-serif font-bold text-stone-900 mb-1" style={{ fontSize: 26 }}>Crea tu nueva contraseña</h2>
                <p className="text-sm text-stone-600 mb-5" style={{ lineHeight: 1.55 }}>
                  Elige una contraseña segura. Debe tener al menos 8 caracteres e incluir un número.
                </p>

                <form onSubmit={handleSubmit} className="space-y-3">
                  <div>
                    <label className="gov-label" htmlFor="pwd-nueva">Nueva contraseña</label>
                    <div className="relative">
                      <input
                        id="pwd-nueva"
                        type={showPwd ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="gov-input pr-10"
                        placeholder="Mínimo 8 caracteres, incluye un número"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwd((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {/* Indicadores visuales */}
                    {password.length > 0 && (
                      <div className="flex gap-4 mt-1.5">
                        <span className="text-[11px]" style={{ color: password.length >= 8 ? '#2d7d46' : '#78716c' }}>
                          {password.length >= 8 ? '✓' : '○'} 8 caracteres
                        </span>
                        <span className="text-[11px]" style={{ color: /[0-9]/.test(password) ? '#2d7d46' : '#78716c' }}>
                          {/[0-9]/.test(password) ? '✓' : '○'} Al menos un número
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="gov-label" htmlFor="pwd-confirmar">Confirmar contraseña</label>
                    <input
                      id="pwd-confirmar"
                      type={showPwd ? 'text' : 'password'}
                      required
                      value={confirmar}
                      onChange={(e) => setConfirmar(e.target.value)}
                      className="gov-input"
                      placeholder="Repite la contraseña"
                      autoComplete="new-password"
                    />
                    {confirmar.length > 0 && password !== confirmar && (
                      <p className="text-[11px] mt-1" style={{ color: '#b91c1c' }}>Las contraseñas no coinciden</p>
                    )}
                  </div>

                  {error && (
                    <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="gov-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
                    style={{ paddingTop: 10, paddingBottom: 10 }}
                  >
                    {loading ? <Loader2 className="animate-spin" size={17} /> : null}
                    {loading ? 'Guardando...' : 'Crear nueva contraseña'}
                  </button>
                </form>
              </>
            )}

            {/* Éxito */}
            {estado === 'exito' && (
              <div className="text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: '#d1fae5' }}>
                  <CheckCircle size={32} style={{ color: '#2d7d46' }} />
                </div>
                <h2 className="font-serif font-bold text-stone-900 mb-3" style={{ fontSize: 24 }}>¡Contraseña actualizada!</h2>
                <p className="text-sm text-stone-600 mb-6" style={{ lineHeight: 1.6 }}>
                  Tu contraseña fue cambiada exitosamente. Ya puedes iniciar sesión con tu nueva contraseña.
                </p>
                <button
                  onClick={() => setLocation('/login')}
                  className="gov-btn-primary w-full text-sm"
                  style={{ paddingTop: 10, paddingBottom: 10 }}
                >
                  Ir al inicio de sesión
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
