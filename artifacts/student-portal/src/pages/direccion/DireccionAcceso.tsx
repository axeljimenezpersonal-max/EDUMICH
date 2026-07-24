/**
 * "Dar acceso" — el creador (Sinapsis) da de alta a un administrador o a un
 * gestor y le envía su primer acceso por correo (contraseña temporal). El
 * usuario la cambia al entrar. Es la única pantalla del panel de dirección que
 * escribe datos; el resto es solo lectura.
 */
import { useEffect, useState } from 'react';
import { UserPlus, Building2, ShieldCheck, Send, CheckCircle2, AlertCircle, RefreshCw, Mail, Clock } from 'lucide-react';
import { DireccionLayout } from './DireccionLayout';
import { api } from '../../lib/api';
import { avisar } from '../../components/Avisador';
import { confirmar } from '../../components/Confirmador';
import { formatearNombre } from '../../lib/nombre';
import { fechaCorta } from '../../lib/fechas';

type Acceso = {
  userId: number;
  email: string;
  rol: 'admin' | 'gestor';
  nombre: string;
  detalle: string;
  activo: boolean;
  estado: 'sin_entrar' | 'activo';
  correoEnviadoEn: string | null;
  puedeReenviar: boolean;
};

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

  // Seguimiento
  const [accesos, setAccesos] = useState<Acceso[]>([]);
  const [cargandoAccesos, setCargandoAccesos] = useState(true);
  const [reenviando, setReenviando] = useState<number | null>(null);

  function cargarAccesos() {
    setCargandoAccesos(true);
    api.get<{ accesos: Acceso[] }>('/direccion/accesos')
      .then((r) => setAccesos(r.accesos))
      .catch(() => setAccesos([]))
      .finally(() => setCargandoAccesos(false));
  }

  useEffect(() => {
    api.get<Municipio[]>('/publico/municipios').then(setMunicipios).catch(() => setMunicipios([]));
    cargarAccesos();
  }, []);

  async function reenviar(a: Acceso) {
    const ok = await confirmar({
      title: 'Reenviar primer acceso',
      message: `Se generará una NUEVA contraseña temporal para ${formatearNombre(a.nombre)} y se enviará a ${a.email}. La contraseña anterior dejará de funcionar.`,
      confirmLabel: 'Reenviar',
    });
    if (!ok) return;
    setReenviando(a.userId);
    try {
      const r = await api.post<{ correoEnviado: boolean }>(`/direccion/accesos/${a.userId}/reenviar`, {});
      avisar(r.correoEnviado ? 'Acceso reenviado.' : 'Se regeneró la contraseña, pero el correo no salió (revisa la configuración).', r.correoEnviado ? 'ok' : 'error');
      cargarAccesos();
    } catch (e) {
      avisar((e as Error).message || 'No se pudo reenviar.', 'error');
    } finally {
      setReenviando(null);
    }
  }

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
      cargarAccesos();
    } catch (e) {
      setError((e as Error).message || 'No se pudo crear la cuenta.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <DireccionLayout>
      <div className="mx-auto max-w-3xl px-1 py-2">
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

        {/* Seguimiento */}
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500">Seguimiento de accesos</h2>
            <button type="button" onClick={cargarAccesos} className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-[var(--color-guinda-700)]">
              <RefreshCw size={13} /> Actualizar
            </button>
          </div>

          {cargandoAccesos ? (
            <div className="rounded-xl border border-stone-200 bg-white p-6 text-center text-sm text-stone-400">Cargando…</div>
          ) : accesos.length === 0 ? (
            <div className="rounded-xl border border-stone-200 bg-white p-6 text-center text-sm text-stone-400">Aún no has dado de alta a nadie.</div>
          ) : (
            <div className="space-y-2">
              {accesos.map((a) => (
                <div key={a.userId} className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-stone-900">{formatearNombre(a.nombre)}</span>
                      <span className="shrink-0 rounded-full bg-[var(--color-crema-100)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--color-guinda-700)' }}>
                        {a.rol === 'admin' ? `Admin · ${a.detalle}` : `Gestor · ${a.detalle}`}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-stone-500">{a.email}</div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                      {a.estado === 'activo' ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Activo · ya entró</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-amber-700"><Clock size={11} /> Sin entrar · contraseña temporal</span>
                      )}
                      <span className="inline-flex items-center gap-1 text-stone-400">
                        <Mail size={11} /> {a.correoEnviadoEn ? `Correo enviado ${fechaCorta(a.correoEnviadoEn)}` : 'Correo no enviado'}
                      </span>
                    </div>
                  </div>
                  {a.puedeReenviar ? (
                    <button
                      type="button"
                      onClick={() => reenviar(a)}
                      disabled={reenviando === a.userId}
                      className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[var(--color-guinda-700)]/30 px-3 py-2 text-xs font-semibold text-[var(--color-guinda-700)] hover:bg-[var(--color-crema-100)] disabled:opacity-50"
                    >
                      <RefreshCw size={13} /> {reenviando === a.userId ? 'Reenviando…' : 'Reenviar acceso'}
                    </button>
                  ) : (
                    <span className="shrink-0 text-[11px] text-stone-400">—</span>
                  )}
                </div>
              ))}
            </div>
          )}
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
