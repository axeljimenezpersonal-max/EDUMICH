import { useEffect, useRef, useState } from 'react';
import { Edit3, CheckCircle2, Loader2, RefreshCw, KeyRound, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { AutoRegistroLayout } from './AutoRegistroLayout';
import { DatePicker } from '../../components/DatePicker';
import { CurpHelpLink } from '../../components/CurpHelpLink';
import { api } from '../../lib/api';

interface Municipio {
  id: number;
  nombre: string;
}

type Fase = 'formulario' | 'verificando' | 'exito';

export default function SolicitarCuenta() {
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [fase, setFase] = useState<Fase>('formulario');

  const [fechaNacimiento, setFechaNacimiento] = useState<Date | undefined>(undefined);
  const [form, setForm] = useState({
    nombres: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    curp: '',
    email: '',
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
    mensaje: '',
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [aceptaAviso, setAceptaAviso] = useState(false);

  // Verificación de código
  const [codigoDev, setCodigoDev] = useState<string | null>(null);
  const [modoCodigo, setModoCodigo] = useState<string>('dev');
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [verLoading, setVerLoading] = useState(false);
  const [verError, setVerError] = useState<string | null>(null);
  const [reenvioSecs, setReenvioSecs] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(600);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [emailVerificadoToken, setEmailVerificadoToken] = useState('');

  useEffect(() => {
    api
      .get<Municipio[]>('/publico/municipios')
      .then(setMunicipios)
      .catch(() => {});
  }, []);

  // Cuenta regresiva código
  useEffect(() => {
    if (fase !== 'verificando' || secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [fase, secondsLeft]);

  useEffect(() => {
    if (reenvioSecs <= 0) return;
    const t = setTimeout(() => setReenvioSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [reenvioSecs]);

  function setField(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSolicitarCodigo(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormLoading(true);
    try {
      const r = await api.post<{ ok: boolean; modo: string; codigoDev?: string }>(
        '/publico/email/solicitar-codigo',
        { email: form.email, tipo: 'solicitud_cuenta' }
      );
      setCodigoDev(r.codigoDev ?? null);
      setModoCodigo(r.modo);
      setDigits(['', '', '', '', '', '']);
      setSecondsLeft(600);
      setFase('verificando');
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setFormLoading(false);
    }
  }

  function handleDigitChange(i: number, val: string) {
    const ch = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = ch;
    setDigits(next);
    if (ch && i < 5) inputRefs.current[i + 1]?.focus();
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputRefs.current[i - 1]?.focus();
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!paste) return;
    const next = [...digits];
    for (let i = 0; i < 6; i++) next[i] = paste[i] ?? '';
    setDigits(next);
    inputRefs.current[Math.min(paste.length, 5)]?.focus();
  }

  async function handleVerificarCodigo() {
    const codigo = digits.join('');
    if (codigo.length !== 6) return;
    setVerError(null);
    setVerLoading(true);
    try {
      const r = await api.post<{ ok: boolean; token: string }>(
        '/publico/email/verificar-codigo',
        { email: form.email, codigo, tipo: 'solicitud_cuenta' }
      );
      setEmailVerificadoToken(r.token);
      // Enviar solicitud inmediatamente
      await api.post('/publico/solicitudes-cuenta', {
        emailVerificadoToken: r.token,
        nombreCompleto: [form.nombres, form.apellidoPaterno, form.apellidoMaterno].filter(Boolean).join(' '),
        nombres: form.nombres,
        apellidoPaterno: form.apellidoPaterno,
        apellidoMaterno: form.apellidoMaterno,
        curp: form.curp.toUpperCase(),
        fechaNacimiento: fechaNacimiento ? format(fechaNacimiento, 'yyyy-MM-dd') : '',
        sexo: form.sexo || undefined,
        lugarNacimiento: form.lugarNacimiento || undefined,
        entidadNacimiento: form.entidadNacimiento || undefined,
        estadoCivil: form.estadoCivil || undefined,
        ultimoEstudio: form.ultimoEstudio || undefined,
        email: form.email,
        telefono: form.telefono,
        calleNumero: form.calleNumero || undefined,
        colonia: form.colonia || undefined,
        cp: form.cp || undefined,
        ciudad: form.ciudad || undefined,
        estadoDomicilio: form.estadoDomicilio || undefined,
        municipioId: Number(form.municipioId),
        mensaje: form.mensaje || undefined,
      });
      setFase('exito');
    } catch (err) {
      setVerError((err as Error).message);
    } finally {
      setVerLoading(false);
    }
  }

  async function handleReenviar() {
    setVerError(null);
    try {
      const r = await api.post<{ ok: boolean; modo: string; codigoDev?: string }>(
        '/publico/email/solicitar-codigo',
        { email: form.email, tipo: 'solicitud_cuenta' }
      );
      setCodigoDev(r.codigoDev ?? null);
      setDigits(['', '', '', '', '', '']);
      setSecondsLeft(600);
      setReenvioSecs(60);
    } catch (err) {
      setVerError((err as Error).message);
    }
  }

  function formatTime(s: number) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  // ── Pantalla de éxito ─────────────────────────────────────────────────
  if (fase === 'exito') {
    return (
      <AutoRegistroLayout>
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 size={44} className="text-green-600" />
            </div>
          </div>
          <h1 className="font-serif text-3xl font-bold text-stone-900 mb-2">
            ¡Solicitud enviada!
          </h1>
          <p className="text-stone-600 mb-6 max-w-sm mx-auto">
            Recibimos tu solicitud de cuenta. La administración de Prepa Abierta Michoacán
            la revisará y se pondrá en contacto contigo en los próximos días hábiles.
          </p>
          <div className="bg-[var(--color-crema-100)] border border-stone-200 rounded-md p-4 text-left mb-6 text-sm text-stone-700">
            <div className="font-medium mb-1">¿Qué sigue?</div>
            <ul className="space-y-1 text-stone-600">
              <li>• El administrador revisará tus datos y documentos.</li>
              <li>• Recibirás un correo con tus credenciales de acceso.</li>
              <li>• Si hay algún problema, te contactarán al número que proporcionaste.</li>
            </ul>
          </div>
          <a href="/login" className="gov-btn-primary inline-block">
            Volver al inicio
          </a>
        </div>
      </AutoRegistroLayout>
    );
  }

  // ── Verificación de código ────────────────────────────────────────────
  if (fase === 'verificando') {
    return (
      <AutoRegistroLayout>
        {modoCodigo === 'dev' && codigoDev && (
          <div className="mb-4 bg-orange-100 border border-orange-300 rounded-md px-4 py-3 flex items-start gap-2">
            <span className="text-orange-700 font-bold text-xs bg-orange-200 px-1.5 py-0.5 rounded shrink-0">
              DEV
            </span>
            <div className="text-sm text-orange-800">
              Modo desarrollo — código:{' '}
              <span className="font-mono font-bold tracking-widest text-orange-900">
                {codigoDev}
              </span>
            </div>
          </div>
        )}

        <div className="bg-white border border-stone-200 rounded-md p-8 shadow-sm">
          <div className="flex items-center gap-2 text-[var(--color-guinda-700)] mb-2">
            <KeyRound size={18} />
            <span className="text-xs font-semibold uppercase tracking-widest">
              Verifica tu correo
            </span>
          </div>
          <h1 className="font-serif text-2xl font-bold text-stone-900 mb-1">
            Código de verificación
          </h1>
          <p className="text-stone-500 text-sm mb-6">
            Enviamos un código a{' '}
            <span className="font-medium text-stone-700">{form.email}</span>
          </p>

          <div className="flex gap-2 justify-center mb-4">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onPaste={handlePaste}
                className={`w-11 text-center text-xl font-bold border-2 rounded-md bg-white focus:outline-none transition-colors ${
                  d
                    ? 'border-[var(--color-guinda-500)] text-[var(--color-guinda-800)]'
                    : 'border-stone-300'
                } focus:border-[var(--color-guinda-500)]`}
                style={{ height: '52px' }}
              />
            ))}
          </div>

          <div
            className={`text-center text-sm mb-4 ${
              secondsLeft < 60 ? 'text-red-600 font-semibold' : 'text-stone-500'
            }`}
          >
            {secondsLeft > 0 ? `Expira en ${formatTime(secondsLeft)}` : 'Código expirado'}
          </div>

          {verError && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">
              {verError}
            </div>
          )}

          <button
            onClick={handleVerificarCodigo}
            disabled={digits.join('').length !== 6 || verLoading || secondsLeft === 0}
            className="gov-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 mb-3"
          >
            {verLoading ? <Loader2 className="animate-spin" size={18} /> : null}
            {verLoading ? 'Enviando solicitud...' : 'Verificar y enviar solicitud'}
          </button>

          <button
            onClick={handleReenviar}
            disabled={reenvioSecs > 0}
            className="gov-btn-secondary w-full flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
          >
            <RefreshCw size={15} />
            {reenvioSecs > 0 ? `Reenviar en ${reenvioSecs}s` : 'Reenviar código'}
          </button>

          <button
            onClick={() => setFase('formulario')}
            className="mt-3 w-full text-xs text-stone-500 hover:underline"
          >
            Volver al formulario
          </button>
        </div>
      </AutoRegistroLayout>
    );
  }

  // ── Formulario principal ─────────────────────────────────────────────
  return (
    <AutoRegistroLayout>
      <div className="bg-white border border-stone-200 rounded-md p-8 shadow-sm">
        <div className="flex items-center gap-2 text-[var(--color-guinda-700)] mb-2">
          <Edit3 size={18} />
          <span className="text-xs font-semibold uppercase tracking-widest">
            Solicitud de cuenta
          </span>
        </div>
        <h1 className="font-serif text-2xl font-bold text-stone-900 mb-1">
          Solicitar acceso
        </h1>
        <p className="text-stone-500 text-sm mb-6">
          Completa tus datos. Un administrador procesará tu solicitud y te enviará tus
          credenciales de acceso.
        </p>

        <form onSubmit={handleSolicitarCodigo} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="gov-label" htmlFor="sc-nombres">Nombre(s)</label>
              <input id="sc-nombres" type="text" required value={form.nombres} onChange={setField('nombres')} className="gov-input" placeholder="Axel Eduardo" />
            </div>
            <div>
              <label className="gov-label" htmlFor="sc-apP">Apellido paterno</label>
              <input id="sc-apP" type="text" required value={form.apellidoPaterno} onChange={setField('apellidoPaterno')} className="gov-input" placeholder="González" />
            </div>
            <div>
              <label className="gov-label" htmlFor="sc-apM">Apellido materno</label>
              <input id="sc-apM" type="text" value={form.apellidoMaterno} onChange={setField('apellidoMaterno')} className="gov-input" placeholder="Pérez" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="gov-label" htmlFor="sc-sexo">Sexo</label>
              <select id="sc-sexo" value={form.sexo} onChange={setField('sexo')} className="gov-input">
                <option value="">Selecciona…</option>
                <option value="hombre">Hombre</option>
                <option value="mujer">Mujer</option>
                <option value="no_definir">No definir</option>
              </select>
            </div>
            <div>
              <label className="gov-label" htmlFor="sc-ecivil">Estado civil</label>
              <select id="sc-ecivil" value={form.estadoCivil} onChange={setField('estadoCivil')} className="gov-input">
                <option value="">Selecciona…</option>
                <option value="Soltero(a)">Soltero(a)</option>
                <option value="Casado(a)">Casado(a)</option>
                <option value="Unión libre">Unión libre</option>
                <option value="Divorciado(a)">Divorciado(a)</option>
                <option value="Viudo(a)">Viudo(a)</option>
              </select>
            </div>
            <div>
              <label className="gov-label" htmlFor="sc-ultest">Último estudio</label>
              <input id="sc-ultest" type="text" value={form.ultimoEstudio} onChange={setField('ultimoEstudio')} className="gov-input" placeholder="Secundaria" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="gov-label" htmlFor="sc-lugarNac">Lugar de nacimiento (ciudad)</label>
              <input id="sc-lugarNac" type="text" value={form.lugarNacimiento} onChange={setField('lugarNacimiento')} className="gov-input" placeholder="Morelia" />
            </div>
            <div>
              <label className="gov-label" htmlFor="sc-entNac">Entidad donde nació</label>
              <input id="sc-entNac" type="text" value={form.entidadNacimiento} onChange={setField('entidadNacimiento')} className="gov-input" placeholder="Michoacán" />
            </div>
          </div>

          <div>
            <label className="gov-label">Domicilio</label>
            <div className="space-y-2">
              <input value={form.calleNumero} onChange={setField('calleNumero')} className="gov-input" placeholder="Calle y número" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input value={form.colonia} onChange={setField('colonia')} className="gov-input" placeholder="Colonia" />
                <input value={form.cp} onChange={setField('cp')} className="gov-input" placeholder="Código postal" />
                <input value={form.ciudad} onChange={setField('ciudad')} className="gov-input" placeholder="Ciudad / municipio" />
                <input value={form.estadoDomicilio} onChange={setField('estadoDomicilio')} className="gov-input" placeholder="Estado" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="gov-label" htmlFor="sc-curp">
                CURP
              </label>
              <input
                id="sc-curp"
                type="text"
                required
                maxLength={18}
                value={form.curp}
                onChange={(e) =>
                  setForm((p) => ({ ...p, curp: e.target.value.toUpperCase() }))
                }
                className="gov-input font-mono text-sm"
                placeholder="18 caracteres"
              />
              <div className="text-[10px] text-stone-400 mt-0.5">{form.curp.length}/18</div>
              <CurpHelpLink />
            </div>
            <div>
              <label className="gov-label" htmlFor="sc-nacimiento">
                Fecha de nacimiento
              </label>
              <DatePicker
                id="sc-nacimiento"
                value={fechaNacimiento}
                onChange={setFechaNacimiento}
                maxDate={new Date()}
              />
            </div>
          </div>

          <div>
            <label className="gov-label" htmlFor="sc-email">
              Correo electrónico
            </label>
            <input
              id="sc-email"
              type="email"
              required
              value={form.email}
              onChange={setField('email')}
              className="gov-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="gov-label" htmlFor="sc-tel">
                Teléfono
              </label>
              <input
                id="sc-tel"
                type="tel"
                required
                value={form.telefono}
                onChange={setField('telefono')}
                className="gov-input"
              />
            </div>
            <div>
              <label className="gov-label" htmlFor="sc-mun">
                Municipio
              </label>
              <select
                id="sc-mun"
                required
                value={form.municipioId}
                onChange={setField('municipioId')}
                className="gov-input"
              >
                <option value="">Selecciona...</option>
                {municipios.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="gov-label" htmlFor="sc-msg">
              Mensaje adicional (opcional)
            </label>
            <textarea
              id="sc-msg"
              rows={3}
              value={form.mensaje}
              onChange={setField('mensaje')}
              className="gov-input resize-none"
              placeholder="Información adicional que quieras compartir..."
            />
          </div>

          {formError && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {formError}
            </div>
          )}

          {/* Aviso de privacidad simplificado */}
          <div className="border border-stone-200 rounded-md bg-stone-50 px-4 py-3">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--color-guinda-700)] mb-2">
              <ShieldCheck size={12} />
              Aviso de privacidad
            </div>
            <p className="text-xs text-stone-600 leading-relaxed mb-3">
              El Instituto de Educación Media Superior y Superior del Estado de Michoacán
              (IEMSyS), a través de la Coordinación Estatal de Preparatoria Abierta, tratará sus
              datos personales para registrarle, integrar su expediente académico, gestionar pagos
              y exámenes, y emitir sus documentos oficiales. Algunos datos son sensibles
              (fotografía e identificación oficial). No se transferirán salvo a las autoridades
              educativas que la ley señala. Consulte el{' '}
              <a
                href="/aviso-privacidad"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline hover:no-underline"
                style={{ color: 'var(--color-guinda-700)' }}
              >
                aviso de privacidad integral
              </a>{' '}
              y ejerza sus derechos ARCO ante la Unidad de Transparencia.
            </p>
            <label className="flex items-start gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={aceptaAviso}
                onChange={(e) => setAceptaAviso(e.target.checked)}
                className="mt-0.5 shrink-0 accent-[var(--color-guinda-700)]"
              />
              <span className="text-xs text-stone-700 leading-snug">
                He leído y acepto el tratamiento de mis datos personales conforme al aviso de
                privacidad.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={formLoading || !aceptaAviso}
            className="gov-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {formLoading ? <Loader2 className="animate-spin" size={18} /> : null}
            {formLoading ? 'Enviando...' : 'Continuar a verificación'}
          </button>
        </form>

        <div className="mt-4 text-center text-xs text-stone-500">
          ¿Ya tienes cuenta?{' '}
          <a href="/login" className="text-[var(--color-guinda-700)] hover:underline">
            Inicia sesión
          </a>
        </div>
      </div>
    </AutoRegistroLayout>
  );
}
