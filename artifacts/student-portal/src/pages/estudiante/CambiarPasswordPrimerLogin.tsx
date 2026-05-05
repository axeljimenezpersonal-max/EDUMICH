import { useState } from 'react';
import { useLocation } from 'wouter';
import { api } from '../../lib/api';
import { Lock, Eye, EyeOff, ShieldAlert, Loader2 } from 'lucide-react';

export default function CambiarPasswordPrimerLogin() {
  const [, setLocation] = useLocation();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [showActual, setShowActual] = useState(false);
  const [showNueva, setShowNueva] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nuevaValida = nueva.length >= 8;
  const coinciden = nueva === confirmacion && confirmacion.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevaValida || !coinciden) return;
    setError(null);
    setLoading(true);
    try {
      await api.post('/estudiante/cambiar-password', {
        passwordActual: actual,
        passwordNueva: nueva,
        confirmacion,
      });
      setLocation('/estudiante');
    } catch (err) {
      setError((err as Error).message || 'Error al cambiar la contraseña');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await api.post('/auth/logout');
    setLocation('/login');
  }

  return (
    <div className="min-h-screen bg-[var(--color-crema-100)] flex flex-col">
      {/* Banda institucional */}
      <div className="bg-[var(--color-guinda-700)] text-white text-xs">
        <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center justify-between">
          <span className="font-medium tracking-wide">
            GOBIERNO DEL ESTADO DE MICHOACÁN · HONESTIDAD Y TRABAJO
          </span>
          <button
            onClick={handleLogout}
            className="opacity-80 hover:opacity-100 underline text-xs"
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Alerta de seguridad */}
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-md px-4 py-3 mb-6">
            <ShieldAlert size={20} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-semibold text-amber-800">
                Cambio de contraseña requerido
              </div>
              <div className="text-xs text-amber-700 mt-0.5">
                Por seguridad, debes cambiar tu contraseña antes de continuar. Esta contraseña fue
                generada temporalmente por tu gestor municipal.
              </div>
            </div>
          </div>

          <div className="bg-white border border-stone-200 rounded-md p-8 shadow-sm">
            <div className="flex items-center gap-2 text-[var(--color-guinda-700)] mb-2">
              <Lock size={18} />
              <span className="text-xs font-semibold uppercase tracking-widest">
                Nueva contraseña
              </span>
            </div>
            <h1 className="font-serif text-2xl font-bold text-stone-900 mb-1">
              Elige tu contraseña
            </h1>
            <p className="text-stone-500 text-sm mb-6">
              Mínimo 8 caracteres. Guárdala en un lugar seguro.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Contraseña actual */}
              <div>
                <label className="gov-label" htmlFor="actual">
                  Contraseña temporal (actual)
                </label>
                <div className="relative">
                  <input
                    id="actual"
                    type={showActual ? 'text' : 'password'}
                    value={actual}
                    onChange={(e) => setActual(e.target.value)}
                    required
                    className="gov-input pr-10"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowActual((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                    tabIndex={-1}
                  >
                    {showActual ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Nueva contraseña */}
              <div>
                <label className="gov-label" htmlFor="nueva">
                  Nueva contraseña
                </label>
                <div className="relative">
                  <input
                    id="nueva"
                    type={showNueva ? 'text' : 'password'}
                    value={nueva}
                    onChange={(e) => setNueva(e.target.value)}
                    required
                    className="gov-input pr-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNueva((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                    tabIndex={-1}
                  >
                    {showNueva ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {nueva.length > 0 && (
                  <div
                    className={`text-xs mt-1 ${nuevaValida ? 'text-green-700' : 'text-red-600'}`}
                  >
                    {nuevaValida ? '✓ Mínimo 8 caracteres' : `Faltan ${8 - nueva.length} caracteres`}
                  </div>
                )}
              </div>

              {/* Confirmación */}
              <div>
                <label className="gov-label" htmlFor="confirmacion">
                  Confirmar nueva contraseña
                </label>
                <input
                  id="confirmacion"
                  type="password"
                  value={confirmacion}
                  onChange={(e) => setConfirmacion(e.target.value)}
                  required
                  className="gov-input"
                  autoComplete="new-password"
                />
                {confirmacion.length > 0 && (
                  <div
                    className={`text-xs mt-1 ${coinciden ? 'text-green-700' : 'text-red-600'}`}
                  >
                    {coinciden ? '✓ Las contraseñas coinciden' : 'Las contraseñas no coinciden'}
                  </div>
                )}
              </div>

              {error && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !nuevaValida || !coinciden || !actual}
                className="gov-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : null}
                {loading ? 'Guardando...' : 'Cambiar contraseña y continuar'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
