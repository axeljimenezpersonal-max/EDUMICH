/**
 * Primer ingreso — el usuario entró con la contraseña TEMPORAL y aquí define la
 * suya (dos veces) y acepta los términos. Aplica a TODOS los roles (alumno,
 * gestor, admin, dirección): sin este paso no se entra al sistema. Al terminar,
 * pasa directo a su panel según el rol.
 */
import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { api } from '../lib/api';
import { Lock, Eye, EyeOff, ShieldCheck, Check, Loader2, LogOut } from 'lucide-react';
import ModulaLogo from '../components/ModulaLogo';

export default function CambiarPasswordInicial() {
  const [, setLocation] = useLocation();
  const [nueva, setNueva] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [acepta, setAcepta] = useState(false);
  const [ver, setVer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tieneLargo = nueva.length >= 8;
  const tieneMayus = /[A-Z]/.test(nueva);
  const tieneNumero = /[0-9]/.test(nueva);
  const nuevaValida = tieneLargo && tieneMayus && tieneNumero;
  const coinciden = nueva === confirmacion && confirmacion.length > 0;
  const listo = nuevaValida && coinciden && acepta;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!listo || loading) return;
    setError(null);
    setLoading(true);
    try {
      await api.post('/auth/establecer-password', { passwordNueva: nueva, aceptaTerminos: true });
      // Ya sin contraseña temporal: al panel que corresponde al rol.
      const me = await api.get<{ rol: string }>('/auth/me');
      const destino =
        me.rol === 'gestor' ? '/gestor' :
        me.rol === 'admin' ? '/admin' :
        me.rol === 'direccion' ? '/direccion' : '/estudiante';
      setLocation(destino);
    } catch (err) {
      setError((err as Error).message || 'No se pudo guardar la contraseña.');
      setLoading(false);
    }
  }

  async function handleLogout() {
    try { await api.post('/auth/logout', {}); } catch { /* ignore */ }
    setLocation('/login');
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-crema-100)]">
      <div className="bg-[var(--color-guinda-800)] text-white text-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-1.5">
          <span className="font-medium tracking-wide">GOBIERNO DEL ESTADO DE MICHOACÁN · HONESTIDAD Y TRABAJO</span>
          <button onClick={handleLogout} className="inline-flex items-center gap-1 opacity-80 hover:opacity-100">
            <LogOut size={12} /> Cerrar sesión
          </button>
        </div>
      </div>

      <div className="flex-1 grid md:grid-cols-2">
        {/* Panel de marca */}
        <div className="relative hidden overflow-hidden bg-[var(--color-guinda-800)] p-12 text-white md:flex md:flex-col md:justify-center"
          style={{ background: 'linear-gradient(135deg, var(--color-guinda-800), var(--color-guinda-600))' }}>
          <div className="pointer-events-none absolute -right-20 -top-16 h-64 w-64 rounded-full bg-white/5" />
          <ModulaLogo titulo="Módula 22" acento="var(--color-dorado-soft,#e6c78a)" className="h-14 w-auto self-start" />
          <h1 className="mt-8 font-serif text-3xl font-bold leading-tight">Te damos la bienvenida</h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/85">
            Estás a un paso de entrar. Por tu seguridad, crea una contraseña personal: la temporal
            que recibiste por correo deja de funcionar en cuanto definas la tuya.
          </p>
        </div>

        {/* Formulario */}
        <div className="flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-md">
            <div className="mb-1 flex items-center gap-2 text-[var(--color-guinda-700)]">
              <Lock size={18} />
              <span className="text-xs font-semibold uppercase tracking-widest">Primer ingreso</span>
            </div>
            <h2 className="font-serif text-2xl font-bold text-stone-900">Crea tu contraseña</h2>
            <p className="mt-1 text-sm text-stone-500">Escríbela dos veces y acepta los términos para continuar.</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="gov-label" htmlFor="nueva">Nueva contraseña</label>
                <div className="relative">
                  <input id="nueva" type={ver ? 'text' : 'password'} value={nueva} onChange={(e) => setNueva(e.target.value)}
                    required autoComplete="new-password" className="gov-input pr-10" />
                  <button type="button" onClick={() => setVer((v) => !v)} tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                    {ver ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {/* Requisitos en vivo */}
                <div className="mt-2 grid grid-cols-1 gap-1 text-xs sm:grid-cols-3">
                  <Requisito ok={tieneLargo} texto="8+ caracteres" />
                  <Requisito ok={tieneMayus} texto="1 mayúscula" />
                  <Requisito ok={tieneNumero} texto="1 número" />
                </div>
              </div>

              <div>
                <label className="gov-label" htmlFor="conf">Confirmar contraseña</label>
                <input id="conf" type={ver ? 'text' : 'password'} value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)}
                  required autoComplete="new-password" className="gov-input" />
                {confirmacion.length > 0 && (
                  <div className={`mt-1 text-xs ${coinciden ? 'text-green-700' : 'text-red-600'}`}>
                    {coinciden ? '✓ Las contraseñas coinciden' : 'Las contraseñas no coinciden'}
                  </div>
                )}
              </div>

              <label className="flex items-start gap-2.5 rounded-xl border border-stone-200 bg-white px-3 py-3">
                <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[var(--color-guinda-700)]" />
                <span className="text-sm text-stone-600">
                  Acepto los <strong>términos y condiciones</strong> y el{' '}
                  <Link href="/aviso-privacidad" className="text-[var(--color-guinda-700)] underline">aviso de privacidad</Link>{' '}
                  del tratamiento de mis datos personales (LGPDPPSO).
                </span>
              </label>

              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
              )}

              <button type="submit" disabled={!listo || loading}
                className="gov-btn-primary flex w-full items-center justify-center gap-2 disabled:opacity-50" style={{ paddingTop: 11, paddingBottom: 11 }}>
                {loading ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={17} />}
                {loading ? 'Guardando…' : 'Guardar y entrar'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function Requisito({ ok, texto }: { ok: boolean; texto: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${ok ? 'text-green-700' : 'text-stone-400'}`}>
      <Check size={13} className={ok ? '' : 'opacity-40'} /> {texto}
    </span>
  );
}
