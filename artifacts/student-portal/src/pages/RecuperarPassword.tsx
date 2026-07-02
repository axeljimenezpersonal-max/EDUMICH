import { useState } from 'react';
import { useLocation } from 'wouter';
import { api } from '../lib/api';
import { GraduationCap, Mail, HelpCircle, ShieldCheck, MapPin, Phone, Info, CheckCircle, Loader2 } from 'lucide-react';

type Metodo = 'correo' | 'admin' | null;

export default function RecuperarPassword() {
  const [, setLocation] = useLocation();
  const [metodo, setMetodo] = useState<Metodo>(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEnviarCorreo(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post('/auth/recuperar-password', { email });
      setEnviado(true);
    } catch {
      setEnviado(true);
    } finally {
      setLoading(false);
    }
  }

  const panelIzquierdo = (
    <div
      className="bg-[var(--color-guinda-800)] text-white relative overflow-hidden"
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
          Recupera el acceso a tu cuenta del sistema de gestión institucional.
        </p>
      </div>
      <div className="relative" style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>Instituto de Educación Media Superior y Superior del Estado de Michoacán</div>
        <div style={{ fontSize: 11, opacity: 0.65 }}>Tu seguridad es nuestra prioridad.</div>
      </div>
    </div>
  );

  // ── Vista: selección de método ──────────────────────────────────────
  if (metodo === null) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="bg-[var(--color-guinda-800)] text-white text-xs">
          <div className="max-w-7xl mx-auto px-4 py-1.5">
            <span className="font-medium tracking-wide">GOBIERNO DEL ESTADO DE MICHOACÁN · HONESTIDAD Y TRABAJO</span>
          </div>
        </div>
        <div className="flex-1 grid md:grid-cols-2">
          {panelIzquierdo}
          <div className="flex items-center justify-center bg-[var(--color-crema-100)]" style={{ padding: '40px 60px' }}>
            <div className="w-full max-w-md">
              <div className="flex items-center gap-2 text-[var(--color-guinda-700)] mb-1.5">
                <ShieldCheck size={18} />
                <span className="text-xs font-semibold uppercase tracking-widest">Recuperar acceso</span>
              </div>
              <h2 className="font-serif font-bold text-stone-900 mb-1" style={{ fontSize: 26 }}>¿Cómo quieres recuperar tu contraseña?</h2>
              <p className="text-sm text-stone-600 mb-6">Selecciona la opción que mejor se adapte a tu situación.</p>

              {/* Card: por correo */}
              <button
                onClick={() => setMetodo('correo')}
                className="w-full text-left mb-3 transition-all"
                style={{
                  background: 'white',
                  border: '1px solid #eadfd7',
                  borderRadius: 12,
                  padding: '18px 22px',
                  display: 'flex',
                  gap: 16,
                  alignItems: 'flex-start',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => { const el = e.currentTarget; el.style.borderColor = 'var(--color-guinda-500)'; el.style.background = 'var(--color-crema-50)'; el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.04)'; el.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={(e) => { const el = e.currentTarget; el.style.borderColor = '#eadfd7'; el.style.background = 'white'; el.style.boxShadow = 'none'; el.style.transform = 'none'; }}
              >
                <div style={{ width: 44, height: 44, background: 'var(--color-guinda-100)', color: 'var(--color-guinda-700)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Mail size={20} />
                </div>
                <div>
                  <div className="font-serif font-bold" style={{ fontSize: 15, color: '#1c1917', marginBottom: 4 }}>Recibir correo de recuperación</div>
                  <p className="text-sm text-stone-500 mb-2" style={{ lineHeight: 1.45 }}>Te enviaremos un enlace a tu correo para crear una nueva contraseña. Necesitas tener acceso al correo registrado.</p>
                  <span className="text-xs font-semibold" style={{ color: 'var(--color-guinda-700)' }}>Continuar →</span>
                </div>
              </button>

              {/* Card: contactar admin */}
              <button
                onClick={() => setMetodo('admin')}
                className="w-full text-left mb-6 transition-all"
                style={{
                  background: 'white',
                  border: '1px solid #eadfd7',
                  borderRadius: 12,
                  padding: '18px 22px',
                  display: 'flex',
                  gap: 16,
                  alignItems: 'flex-start',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => { const el = e.currentTarget; el.style.borderColor = 'var(--color-guinda-500)'; el.style.background = 'var(--color-crema-50)'; el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.04)'; el.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={(e) => { const el = e.currentTarget; el.style.borderColor = '#eadfd7'; el.style.background = 'white'; el.style.boxShadow = 'none'; el.style.transform = 'none'; }}
              >
                <div style={{ width: 44, height: 44, background: 'var(--color-guinda-100)', color: 'var(--color-guinda-700)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <HelpCircle size={20} />
                </div>
                <div>
                  <div className="font-serif font-bold" style={{ fontSize: 15, color: '#1c1917', marginBottom: 4 }}>Contactar al administrador</div>
                  <p className="text-sm text-stone-500 mb-2" style={{ lineHeight: 1.45 }}>Si ya no tienes acceso a tu correo o no recuerdas con cuál te registraste, comunícate con el equipo de soporte.</p>
                  <span className="text-xs font-semibold" style={{ color: 'var(--color-guinda-700)' }}>Ver instrucciones →</span>
                </div>
              </button>

              <button
                onClick={() => setLocation('/login')}
                className="text-sm font-medium hover:opacity-70 transition-opacity"
                style={{ color: 'var(--color-guinda-700)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                ← Volver al inicio de sesión
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Vista: recuperación por correo ──────────────────────────────────
  if (metodo === 'correo') {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="bg-[var(--color-guinda-800)] text-white text-xs">
          <div className="max-w-7xl mx-auto px-4 py-1.5">
            <span className="font-medium tracking-wide">GOBIERNO DEL ESTADO DE MICHOACÁN · HONESTIDAD Y TRABAJO</span>
          </div>
        </div>
        <div className="flex-1 grid md:grid-cols-2">
          {panelIzquierdo}
          <div className="flex items-center justify-center bg-[var(--color-crema-100)]" style={{ padding: '40px 60px' }}>
            <div className="w-full max-w-md">
              {!enviado ? (
                <>
                  <button
                    onClick={() => setMetodo(null)}
                    className="text-xs font-medium mb-5 hover:opacity-70 transition-opacity flex items-center gap-1"
                    style={{ color: 'var(--color-guinda-700)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    ← Volver a opciones
                  </button>
                  <div className="flex items-center gap-2 text-[var(--color-guinda-700)] mb-1.5">
                    <Mail size={18} />
                    <span className="text-xs font-semibold uppercase tracking-widest">Recuperar por correo</span>
                  </div>
                  <h2 className="font-serif font-bold text-stone-900 mb-1" style={{ fontSize: 26 }}>Te enviaremos un enlace</h2>
                  <p className="text-sm text-stone-600 mb-5">
                    Escribe el correo institucional con el que te registraste. Si existe en el sistema, recibirás un correo con instrucciones para crear una nueva contraseña.
                  </p>

                  <form onSubmit={handleEnviarCorreo} className="space-y-3">
                    <div>
                      <label className="gov-label" htmlFor="email-rec">Correo institucional</label>
                      <div className="relative">
                        <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                        <input
                          id="email-rec"
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
                      {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
                    </button>
                  </form>

                  <button
                    onClick={() => setLocation('/login')}
                    className="mt-4 text-sm font-medium hover:opacity-70 transition-opacity"
                    style={{ color: 'var(--color-guinda-700)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    ← Volver al inicio de sesión
                  </button>
                </>
              ) : (
                /* Estado de éxito */
                <div className="text-center">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
                    style={{ background: '#d1fae5' }}
                  >
                    <CheckCircle size={32} style={{ color: '#2d7d46' }} />
                  </div>
                  <h2 className="font-serif font-bold text-stone-900 mb-3" style={{ fontSize: 24 }}>Revisa tu correo</h2>
                  <p className="text-sm text-stone-600 mb-2" style={{ lineHeight: 1.6 }}>
                    Si <strong>{email}</strong> existe en nuestro sistema, recibirás un correo con un enlace para restablecer tu contraseña en los próximos minutos.
                  </p>
                  <p className="text-xs text-stone-400 mb-6" style={{ lineHeight: 1.5 }}>
                    ¿No ves el correo? Revisa tu carpeta de spam o asegúrate de haber escrito bien el correo.
                  </p>
                  <div className="space-y-2">
                    <button
                      onClick={() => { setEnviado(false); setEmail(''); }}
                      className="w-full gov-btn-secondary text-sm"
                    >
                      Intentar con otro correo
                    </button>
                    <button
                      onClick={() => setLocation('/login')}
                      className="gov-btn-primary w-full text-sm"
                      style={{ paddingTop: 10, paddingBottom: 10 }}
                    >
                      Volver al inicio de sesión
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Vista: contactar administrador ──────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col">
      <div className="bg-[var(--color-guinda-800)] text-white text-xs">
        <div className="max-w-7xl mx-auto px-4 py-1.5">
          <span className="font-medium tracking-wide">GOBIERNO DEL ESTADO DE MICHOACÁN · HONESTIDAD Y TRABAJO</span>
        </div>
      </div>
      <div className="flex-1 grid md:grid-cols-2">
        {panelIzquierdo}
        <div className="flex items-center justify-center bg-[var(--color-crema-100)]" style={{ padding: '40px 60px' }}>
          <div className="w-full max-w-md">
            <button
              onClick={() => setMetodo(null)}
              className="text-xs font-medium mb-5 hover:opacity-70 transition-opacity"
              style={{ color: 'var(--color-guinda-700)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              ← Volver a opciones
            </button>
            <div className="flex items-center gap-2 text-[var(--color-guinda-700)] mb-1.5">
              <HelpCircle size={18} />
              <span className="text-xs font-semibold uppercase tracking-widest">Contactar soporte</span>
            </div>
            <h2 className="font-serif font-bold text-stone-900 mb-1" style={{ fontSize: 26 }}>Comunícate con el administrador</h2>
            <p className="text-sm text-stone-600 mb-5" style={{ lineHeight: 1.55 }}>
              Si no tienes acceso a tu correo o tienes algún otro problema, ponte en contacto con el equipo de administración del sistema.
            </p>

            {/* Card de contacto */}
            <div className="mb-4" style={{ background: 'var(--color-crema-50)', border: '1px solid #eadfd7', borderRadius: 12 }}>
              {/* Correo */}
              <div style={{ padding: '16px 22px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ width: 40, height: 40, background: 'var(--color-guinda-100)', color: 'var(--color-guinda-700)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Mail size={18} />
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: '#6b635e' }}>Correo de soporte</div>
                  <a href="mailto:soporte.prepaabierta@michoacan.gob.mx" className="font-serif font-bold hover:text-[var(--color-guinda-700)] transition-colors" style={{ fontSize: 14, color: '#1c1917', display: 'block' }}>
                    soporte.prepaabierta@michoacan.gob.mx
                  </a>
                  <div className="text-xs mt-1" style={{ color: '#6b635e' }}>Respuesta en 24-48 horas hábiles</div>
                </div>
              </div>

              <div style={{ height: 1, background: '#eadfd7', margin: '0 22px' }} />

              {/* Teléfono */}
              <div style={{ padding: '16px 22px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ width: 40, height: 40, background: 'var(--color-guinda-100)', color: 'var(--color-guinda-700)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Phone size={18} />
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: '#6b635e' }}>Teléfono de atención</div>
                  <a href="tel:4433223456" className="font-serif font-bold hover:text-[var(--color-guinda-700)] transition-colors" style={{ fontSize: 14, color: '#1c1917', display: 'block' }}>
                    (443) 322-3456
                  </a>
                  <div className="text-xs mt-1" style={{ color: '#6b635e' }}>Lunes a viernes · 9:00 a 17:00 hrs</div>
                </div>
              </div>

              <div style={{ height: 1, background: '#eadfd7', margin: '0 22px' }} />

              {/* Presencial */}
              <div style={{ padding: '16px 22px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ width: 40, height: 40, background: 'var(--color-guinda-100)', color: 'var(--color-guinda-700)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <MapPin size={18} />
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: '#6b635e' }}>Atención presencial</div>
                  <div className="font-serif font-bold" style={{ fontSize: 14, color: '#1c1917' }}>IEMSyS · Edificio Sentimientos de la Nación</div>
                  <div className="text-xs mt-1" style={{ color: '#6b635e' }}>Av. Madero Pte. 401, Centro Histórico, Morelia, Mich.</div>
                </div>
              </div>
            </div>

            {/* Info tip */}
            <div className="mb-5 flex gap-3" style={{ background: '#eff6ff', border: '1px solid #93c5fd', borderLeft: '3px solid #3b82f6', borderRadius: 8, padding: '12px 16px', alignItems: 'flex-start' }}>
              <Info size={15} style={{ color: '#1d4ed8', flexShrink: 0, marginTop: 1 }} />
              <div className="text-xs" style={{ color: '#1e3a8a', lineHeight: 1.55 }}>
                <strong>Información que necesitas tener a la mano:</strong>
                <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                  <li style={{ marginBottom: 2 }}>Tu CURP completo</li>
                  <li style={{ marginBottom: 2 }}>Tu nombre completo</li>
                  <li style={{ marginBottom: 2 }}>El correo con el que te registraste (si lo recuerdas)</li>
                  <li>Tu municipio</li>
                </ul>
              </div>
            </div>

            <button
              onClick={() => setLocation('/login')}
              className="text-sm font-medium hover:opacity-70 transition-opacity"
              style={{ color: 'var(--color-guinda-700)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              ← Volver al inicio de sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
