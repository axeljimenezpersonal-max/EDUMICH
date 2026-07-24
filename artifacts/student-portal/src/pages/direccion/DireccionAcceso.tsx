/**
 * "Dar acceso" — el creador (Sinapsis) da de alta a un administrador o a un
 * gestor y le envía su primer acceso por correo (contraseña temporal). El
 * usuario la cambia al entrar. Es la única pantalla del panel de dirección que
 * escribe datos; el resto es solo lectura.
 */
import { useEffect, useState } from 'react';
import { UserPlus, Building2, ShieldCheck, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { DireccionLayout } from './DireccionLayout';
import { api } from '../../lib/api';
import { avisar } from '../../components/Avisador';

type Tipo = 'gestor' | 'admin';
type Municipio = { id: number; nombre: string };

const GUINDA = 'var(--color-guinda-700)';

export default function DireccionAcceso() {
  const [tipo, setTipo] = useState<Tipo>('gestor');
  const [nombre, setNombre] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [email, setEmail] = useState('');
  // Gestor
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [municipioId, setMunicipioId] = useState<number | ''>('');
  const [telefono, setTelefono] = useState('');
  // Admin
  const [esJefe, setEsJefe] = useState(false);
  const [puesto, setPuesto] = useState('');

  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState<{ nombre: string; email: string; correoEnviado: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Municipio[]>('/publico/municipios').then(setMunicipios).catch(() => setMunicipios([]));
  }, []);

  function limpiar() {
    setNombre(''); setApellidos(''); setEmail('');
    setMunicipioId(''); setTelefono('');
    setEsJefe(false); setPuesto('');
  }

  const listo =
    nombre.trim() && apellidos.trim() && /\S+@\S+\.\S+/.test(email) &&
    (tipo === 'admin' || municipioId !== '');

  async function enviar() {
    if (!listo || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const cuerpo =
        tipo === 'gestor'
          ? { nombre: nombre.trim(), apellidos: apellidos.trim(), email: email.trim(), municipioId: Number(municipioId), telefono: telefono.trim() || undefined }
          : { nombre: nombre.trim(), apellidos: apellidos.trim(), email: email.trim(), esJefe, puesto: puesto.trim() || undefined };
      const r = await api.post<{ ok: boolean; correoEnviado: boolean }>(`/direccion/onboarding/${tipo}`, cuerpo);
      setExito({ nombre: `${nombre.trim()} ${apellidos.trim()}`, email: email.trim(), correoEnviado: r.correoEnviado });
      limpiar();
      avisar('Acceso creado.', 'ok');
    } catch (e) {
      setError((e as Error).message || 'No se pudo crear la cuenta.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <DireccionLayout>
      <div className="mx-auto max-w-2xl px-1 py-2">
        <div className="mb-6 flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: 'var(--color-crema-100)', color: GUINDA }}>
            <UserPlus size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-stone-900">Dar acceso</h1>
            <p className="mt-0.5 text-sm text-stone-500">
              Crea una cuenta de administración o de gestor y envía su primer acceso por correo. La
              contraseña es temporal: la persona la cambia al entrar.
            </p>
          </div>
        </div>

        {/* Éxito */}
        {exito && (
          <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0 text-emerald-600" />
              <div className="text-sm text-emerald-900">
                <p className="font-semibold">Cuenta creada para {exito.nombre}.</p>
                <p className="mt-1 text-emerald-800">
                  {exito.correoEnviado
                    ? <>Se envió el primer acceso a <strong>{exito.email}</strong>. Si no lo ve, que revise spam.</>
                    : <>La cuenta quedó lista, pero el correo <strong>no</strong> se envió (revisa la configuración de correo). Puedes reenviarle las credenciales más tarde.</>}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />{error}
          </div>
        )}

        <div className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
          {/* Tipo */}
          <div className="mb-5 grid grid-cols-2 gap-2">
            {([
              { v: 'gestor', icon: Building2, t: 'Gestor', d: 'Centro de asesoría' },
              { v: 'admin', icon: ShieldCheck, t: 'Administrador', d: 'Secretaría' },
            ] as const).map((o) => {
              const activo = tipo === o.v;
              return (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => { setTipo(o.v); setError(null); }}
                  className={`flex items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 text-left transition-colors ${activo ? 'border-[var(--color-guinda-700)] bg-[var(--color-crema-100)]' : 'border-stone-200 hover:border-stone-300'}`}
                >
                  <o.icon size={18} style={{ color: activo ? GUINDA : '#a8a29e' }} />
                  <div>
                    <div className={`text-sm font-semibold ${activo ? 'text-[var(--color-guinda-800)]' : 'text-stone-700'}`}>{o.t}</div>
                    <div className="text-[11px] text-stone-400">{o.d}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Datos comunes */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Nombre(s)" value={nombre} onChange={setNombre} placeholder="Ej. Ana María" />
            <Campo label="Apellidos" value={apellidos} onChange={setApellidos} placeholder="Ej. Pérez López" />
          </div>
          <div className="mt-4">
            <Campo label="Correo" type="email" value={email} onChange={setEmail} placeholder="persona@correo.mx" />
            <p className="mt-1 text-[11px] text-stone-400">A este correo se envía el primer acceso.</p>
          </div>

          {/* Específicos */}
          {tipo === 'gestor' ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-stone-700">Municipio (sede)</label>
                <select
                  value={municipioId}
                  onChange={(e) => setMunicipioId(e.target.value ? Number(e.target.value) : '')}
                  className="gov-input w-full"
                >
                  <option value="">Selecciona…</option>
                  {municipios.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
              </div>
              <Campo label="Teléfono (opcional)" value={telefono} onChange={setTelefono} placeholder="443 123 4567" />
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <Campo label="Puesto (opcional)" value={puesto} onChange={setPuesto} placeholder="Ej. Coordinación académica" />
              <label className="flex items-center gap-2.5 rounded-xl border border-stone-200 px-3 py-2.5">
                <input type="checkbox" checked={esJefe} onChange={(e) => setEsJefe(e.target.checked)} className="h-4 w-4 accent-[var(--color-guinda-700)]" />
                <span className="text-sm text-stone-700">
                  <strong>Administrador titular</strong> (jefe) — puede dar de alta/baja a gestores. Déjalo sin marcar para un admin operativo.
                </span>
              </label>
            </div>
          )}

          <button
            type="button"
            onClick={enviar}
            disabled={!listo || enviando}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-guinda-800)] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[var(--color-guinda-700)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send size={16} /> {enviando ? 'Creando y enviando…' : 'Crear y enviar primer acceso'}
          </button>
        </div>
      </div>
    </DireccionLayout>
  );
}

function Campo({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-stone-700">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="gov-input w-full" />
    </div>
  );
}
