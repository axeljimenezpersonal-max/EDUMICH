import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { CheckCircle2, Loader2, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { AutoRegistroLayout } from './AutoRegistroLayout';
import { DatePicker } from '../../components/DatePicker';
import { api } from '../../lib/api';

interface Municipio {
  id: number;
  nombre: string;
}

export default function AutoRegistroDatos() {
  const [, setLocation] = useLocation();
  const email = sessionStorage.getItem('reg_email') ?? '';
  const token = sessionStorage.getItem('reg_token') ?? '';

  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [fechaNacimiento, setFechaNacimiento] = useState<Date | undefined>(undefined);
  const [form, setForm] = useState({
    nombreCompleto: '',
    telefono: '',
    municipioId: '',
    direccion: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!email || !token) {
      setLocation('/registro/email');
      return;
    }
    api
      .get<Municipio[]>('/publico/municipios')
      .then(setMunicipios)
      .catch(() => {});
  }, [email, token, setLocation]);

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  const passwordsCoinciden =
    form.password.length >= 8 &&
    form.confirmPassword.length > 0 &&
    form.password === form.confirmPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordsCoinciden) return;
    setError(null);
    setLoading(true);
    try {
      await api.post('/publico/auto-registro', {
        emailVerificadoToken: token,
        email,
        nombreCompleto: form.nombreCompleto,
        fechaNacimiento: fechaNacimiento ? format(fechaNacimiento, 'yyyy-MM-dd') : undefined,
        telefono: form.telefono,
        municipioId: Number(form.municipioId),
        direccion: form.direccion || undefined,
        password: form.password,
      });
      setLocation('/registro/exito');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AutoRegistroLayout paso={3}>
      <div className="bg-white border border-stone-200 rounded-md p-8 shadow-sm">
        {/* Banner correo verificado */}
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-md px-3 py-2 mb-5">
          <CheckCircle2 size={15} className="text-green-600 shrink-0" />
          <span className="text-xs text-green-800">
            Correo verificado: <strong>{email}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2 text-[var(--color-guinda-700)] mb-2">
          <UserPlus size={18} />
          <span className="text-xs font-semibold uppercase tracking-widest">
            Completa tu perfil
          </span>
        </div>
        <h1 className="font-serif text-2xl font-bold text-stone-900 mb-1">
          Tus datos personales
        </h1>
        <p className="text-stone-500 text-sm mb-6">
          Los documentos (CURP, acta, etc.) los podrás subir desde tu panel una vez creada tu
          cuenta.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="gov-label" htmlFor="nombre">
              Nombre completo
            </label>
            <input
              id="nombre"
              type="text"
              required
              value={form.nombreCompleto}
              onChange={set('nombreCompleto')}
              className="gov-input"
              autoComplete="name"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="gov-label" htmlFor="nacimiento">
                Fecha de nacimiento
              </label>
              <DatePicker
                id="nacimiento"
                value={fechaNacimiento}
                onChange={setFechaNacimiento}
                maxDate={new Date()}
              />
            </div>
            <div>
              <label className="gov-label" htmlFor="telefono">
                Teléfono
              </label>
              <input
                id="telefono"
                type="tel"
                required
                value={form.telefono}
                onChange={set('telefono')}
                className="gov-input"
                placeholder="442-100-0000"
              />
            </div>
          </div>

          <div>
            <label className="gov-label" htmlFor="municipio">
              Municipio
            </label>
            <select
              id="municipio"
              required
              value={form.municipioId}
              onChange={set('municipioId')}
              className="gov-input"
            >
              <option value="">Selecciona tu municipio...</option>
              {municipios.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="gov-label" htmlFor="direccion">
              Dirección (opcional)
            </label>
            <input
              id="direccion"
              type="text"
              value={form.direccion}
              onChange={set('direccion')}
              className="gov-input"
              placeholder="Calle, número, colonia"
            />
          </div>

          <div className="border-t border-stone-100 pt-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-stone-500 mb-3">
              Elige tu contraseña
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="gov-label" htmlFor="pw">
                  Contraseña
                </label>
                <input
                  id="pw"
                  type="password"
                  required
                  value={form.password}
                  onChange={set('password')}
                  className="gov-input"
                  autoComplete="new-password"
                />
                {form.password.length > 0 && form.password.length < 8 && (
                  <div className="text-xs text-red-600 mt-1">
                    Mín. {8 - form.password.length} caracteres más
                  </div>
                )}
              </div>
              <div>
                <label className="gov-label" htmlFor="pw2">
                  Confirmar
                </label>
                <input
                  id="pw2"
                  type="password"
                  required
                  value={form.confirmPassword}
                  onChange={set('confirmPassword')}
                  className="gov-input"
                  autoComplete="new-password"
                />
                {form.confirmPassword.length > 0 && form.password !== form.confirmPassword && (
                  <div className="text-xs text-red-600 mt-1">No coinciden</div>
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !passwordsCoinciden}
            className="gov-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : null}
            {loading ? 'Creando cuenta...' : 'Crear mi cuenta'}
          </button>
        </form>
      </div>
    </AutoRegistroLayout>
  );
}
