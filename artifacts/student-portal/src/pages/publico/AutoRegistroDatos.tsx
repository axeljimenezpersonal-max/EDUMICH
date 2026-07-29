import { useEffect, useState } from 'react';
import { useCodigoPostal } from '../../lib/useCodigoPostal';
import { useLocation } from 'wouter';
import { CheckCircle2, Loader2, UserPlus, Eye, EyeOff } from 'lucide-react';
import { format } from 'date-fns';
import { AutoRegistroLayout } from './AutoRegistroLayout';
import { DatePicker } from '../../components/DatePicker';
import { api } from '../../lib/api';
import { fechaMinNacimiento, fechaMaxNacimiento, validarEdad } from '../../lib/edad';
import { ENTIDADES_MEXICO } from '../../data/entidadesMexico';

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
    nombres: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    telefono: '',
    municipioId: '',
    sexo: '',
    lugarNacimiento: '',
    entidadNacimiento: '',
    estadoCivil: '',
    ultimoEstudio: '',
    calleNumero: '',
    colonia: '',
    cp: '',
    ciudad: '',
    estadoDomicilio: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Al CREAR la contraseña ver lo escrito importa aún más que al iniciar sesión.
  const [verPw, setVerPw] = useState(false);

  // Autollenado de domicilio por código postal (catálogo SEPOMEX de Michoacán).
  const {
    colonias: coloniasCp,
    buscando: buscandoCp,
    manual: coloniaManualCp,
    setManual: setColoniaManualCp,
  } = useCodigoPostal(form.cp, (p) => {
    setForm((f) => ({
      ...f,
      estadoDomicilio: f.estadoDomicilio?.trim() ? f.estadoDomicilio : (p.estado ?? ''),
      ciudad: f.ciudad?.trim() ? f.ciudad : (p.ciudad ?? p.municipio ?? ''),
    }));
  });

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
    const errEdad = validarEdad(fechaNacimiento);
    if (errEdad) { setError(errEdad); return; }
    setError(null);
    setLoading(true);
    try {
      await api.post('/publico/auto-registro', {
        emailVerificadoToken: token,
        email,
        nombreCompleto: [form.nombres, form.apellidoPaterno, form.apellidoMaterno].filter(Boolean).join(' '),
        nombres: form.nombres,
        apellidoPaterno: form.apellidoPaterno,
        apellidoMaterno: form.apellidoMaterno,
        fechaNacimiento: fechaNacimiento ? format(fechaNacimiento, 'yyyy-MM-dd') : undefined,
        sexo: form.sexo || undefined,
        lugarNacimiento: form.lugarNacimiento || undefined,
        entidadNacimiento: form.entidadNacimiento || undefined,
        estadoCivil: form.estadoCivil || undefined,
        ultimoEstudio: form.ultimoEstudio || undefined,
        telefono: form.telefono,
        municipioId: Number(form.municipioId),
        calleNumero: form.calleNumero || undefined,
        colonia: form.colonia || undefined,
        cp: form.cp || undefined,
        ciudad: form.ciudad || undefined,
        estadoDomicilio: form.estadoDomicilio || undefined,
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="gov-label" htmlFor="nombres">Nombre(s)</label>
              <input id="nombres" type="text" required value={form.nombres} onChange={set('nombres')} className="gov-input" autoComplete="given-name" placeholder="José María" />
            </div>
            <div>
              <label className="gov-label" htmlFor="apP">Apellido paterno</label>
              <input id="apP" type="text" required value={form.apellidoPaterno} onChange={set('apellidoPaterno')} className="gov-input" placeholder="Morelos" />
            </div>
            <div>
              <label className="gov-label" htmlFor="apM">Apellido materno</label>
              <input id="apM" type="text" value={form.apellidoMaterno} onChange={set('apellidoMaterno')} className="gov-input" placeholder="Pavón" />
            </div>
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
                minDate={fechaMinNacimiento()}
                maxDate={fechaMaxNacimiento()}
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
                placeholder="+52 443 123 4567"
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="gov-label" htmlFor="sexo">Sexo</label>
              <select id="sexo" value={form.sexo} onChange={set('sexo')} className="gov-input">
                <option value="">Selecciona…</option>
                <option value="hombre">Hombre</option>
                <option value="mujer">Mujer</option>
                <option value="no_definir">No definir</option>
              </select>
            </div>
            <div>
              <label className="gov-label" htmlFor="ecivil">Estado civil</label>
              <select id="ecivil" value={form.estadoCivil} onChange={set('estadoCivil')} className="gov-input">
                <option value="">Selecciona…</option>
                <option value="Soltero(a)">Soltero(a)</option>
                <option value="Casado(a)">Casado(a)</option>
                <option value="Unión libre">Unión libre</option>
                <option value="Divorciado(a)">Divorciado(a)</option>
                <option value="Viudo(a)">Viudo(a)</option>
              </select>
            </div>
            <div>
              <label className="gov-label" htmlFor="ultest">Último estudio</label>
              <input id="ultest" type="text" value={form.ultimoEstudio} onChange={set('ultimoEstudio')} className="gov-input" placeholder="Secundaria" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="gov-label" htmlFor="lugarNac">Lugar de nacimiento (ciudad)</label>
              <input id="lugarNac" type="text" value={form.lugarNacimiento} onChange={set('lugarNacimiento')} className="gov-input" placeholder="Morelia" />
            </div>
            <div>
              <label className="gov-label" htmlFor="entNac">Entidad donde nació</label>
              <select id="entNac" value={form.entidadNacimiento} onChange={set('entidadNacimiento')} className="gov-input">
                <option value="">Selecciona… (se deduce de la CURP)</option>
                {ENTIDADES_MEXICO.map((ent) => (
                  <option key={ent} value={ent}>{ent}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="gov-label">Domicilio (opcional)</label>
            <div className="space-y-2">
              <input value={form.calleNumero} onChange={set('calleNumero')} className="gov-input" placeholder="Calle y número" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* CP primero: autollena estado/ciudad y ofrece las colonias.
                    Con etiqueta por casilla: cuatro campos seguidos sin rótulo
                    invitan a escribir el dato en el hueco equivocado. */}
                <div>
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-stone-500">Código postal</span>
                <input
                  value={form.cp}
                  onChange={(e) => setForm((f) => ({ ...f, cp: e.target.value.replace(/\D/g, '').slice(0, 5) }))}
                  inputMode="numeric"
                  maxLength={5}
                  className="gov-input"
                  placeholder="58280"
                />
                </div>
                <div>
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-stone-500">Colonia</span>
                {coloniasCp.length > 0 && !coloniaManualCp ? (
                  <select
                    value={form.colonia}
                    onChange={(e) => {
                      if (e.target.value === '__otra__') { setColoniaManualCp(true); setForm((f) => ({ ...f, colonia: '' })); return; }
                      setForm((f) => ({ ...f, colonia: e.target.value }));
                    }}
                    className="gov-input"
                  >
                    <option value="">Selecciona tu colonia…</option>
                    {coloniasCp.map((c) => <option key={c} value={c}>{c}</option>)}
                    <option value="__otra__">Otra… (escribirla)</option>
                  </select>
                ) : (
                  <input value={form.colonia} onChange={set('colonia')} className="gov-input" placeholder="Escribe tu colonia" />
                )}
                </div>
                <div>
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-stone-500">Ciudad / municipio</span>
                <input value={form.ciudad} onChange={set('ciudad')} className="gov-input" placeholder="Morelia" />
                </div>
                <div>
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-stone-500">Estado</span>
                <input value={form.estadoDomicilio} onChange={set('estadoDomicilio')} className="gov-input" placeholder="Michoacán" />
                </div>
              </div>
              <p className="text-[11px] text-stone-400">
                {buscandoCp
                  ? 'Buscando tu código postal…'
                  : coloniasCp.length > 0
                    ? `${coloniasCp.length} colonia(s) encontradas para ese código postal.`
                    : 'Escribe tu código postal y te ofrecemos las colonias de esa zona.'}
              </p>
            </div>
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
                <div className="relative">
                <input
                  id="pw"
                  type={verPw ? 'text' : 'password'}
                  required
                  value={form.password}
                  onChange={set('password')}
                  className="gov-input pr-10"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setVerPw((v) => !v)}
                  tabIndex={-1}
                  aria-label={verPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 transition-colors hover:text-[var(--color-guinda-700)]"
                >
                  {verPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                </div>
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
                <div className="relative">
                <input
                  id="pw2"
                  type={verPw ? 'text' : 'password'}
                  required
                  value={form.confirmPassword}
                  onChange={set('confirmPassword')}
                  className="gov-input pr-10"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setVerPw((v) => !v)}
                  tabIndex={-1}
                  aria-label={verPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 transition-colors hover:text-[var(--color-guinda-700)]"
                >
                  {verPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                </div>
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
