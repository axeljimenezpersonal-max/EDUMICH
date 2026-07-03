/**
 * "No recuerdo si tengo cuenta" — búsqueda pública de cuenta.
 *
 * Política híbrida de privacidad (LGPDPPSO):
 *  · Por CURP (exacta) → correo completo, copiable.
 *  · Por nombre → correo enmascarado; la recuperación se dispara con un
 *    token firmado sin revelar el correo.
 */

import { useEffect, useState } from 'react';
import {
  Search, User, CreditCard, Copy, Check, LogIn, MailQuestion,
  Loader2, LifeBuoy, CheckCircle2, HelpCircle, Mail, Phone,
} from 'lucide-react';
import { AutoRegistroLayout } from './AutoRegistroLayout';
import { CurpHelpLink } from '../../components/CurpHelpLink';
import { api } from '../../lib/api';

type Modo = 'curp' | 'nombre';

interface Resultado {
  encontrada: boolean;
  multiple?: boolean;
  via?: 'curp' | 'nombre';
  nombre?: string;
  email?: string;
  emailEnmascarado?: string;
  recuperacionToken?: string;
}

export default function EncontrarCuenta() {
  const [modo, setModo] = useState<Modo>('curp');
  const [curp, setCurp] = useState('');
  const [nombres, setNombres] = useState('');
  const [apellidoPaterno, setApellidoPaterno] = useState('');
  const [apellidoMaterno, setApellidoMaterno] = useState('');

  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [copiado, setCopiado] = useState(false);
  const [enviandoRecuperacion, setEnviandoRecuperacion] = useState(false);
  const [recuperacionEnviada, setRecuperacionEnviada] = useState(false);

  // Contacto institucional — siempre visible al pie de la tarjeta
  const [contacto, setContacto] = useState<{ nombre: string; correo: string; telefono: string } | null>(null);
  const [contactoCopiado, setContactoCopiado] = useState(false);

  useEffect(() => {
    api.get<{ nombre: string; correo: string; telefono: string }>('/publico/contacto')
      .then(setContacto)
      .catch(() => {});
  }, []);

  function copiarContacto() {
    if (!contacto) return;
    navigator.clipboard.writeText(contacto.correo).then(() => {
      setContactoCopiado(true);
      setTimeout(() => setContactoCopiado(false), 2500);
    });
  }

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResultado(null);
    setRecuperacionEnviada(false);
    setCopiado(false);

    if (modo === 'curp' && curp.length !== 18) {
      setError('La CURP debe tener 18 caracteres.');
      return;
    }
    if (modo === 'nombre' && (!nombres.trim() || !apellidoPaterno.trim())) {
      setError('Escribe al menos tu nombre y apellido paterno.');
      return;
    }

    setBuscando(true);
    try {
      const r = await api.post<Resultado>(
        '/publico/buscar-cuenta',
        modo === 'curp'
          ? { curp: curp.toUpperCase() }
          : { nombres, apellidoPaterno, apellidoMaterno: apellidoMaterno || undefined }
      );
      setResultado(r);
    } catch (err) {
      setError((err as Error).message || 'No se pudo buscar. Intenta de nuevo.');
    } finally {
      setBuscando(false);
    }
  }

  function copiarEmail() {
    if (!resultado?.email) return;
    navigator.clipboard.writeText(resultado.email).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    });
  }

  async function enviarRecuperacion() {
    if (!resultado?.recuperacionToken) return;
    setEnviandoRecuperacion(true);
    try {
      await api.post('/publico/buscar-cuenta/recuperar', {
        recuperacionToken: resultado.recuperacionToken,
      });
      setRecuperacionEnviada(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviandoRecuperacion(false);
    }
  }

  const tabStyle = (activo: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '10px 12px',
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 8,
    border: activo ? '1.5px solid var(--color-guinda-700)' : '1.5px solid #eadfd7',
    background: activo ? '#fbf1f4' : 'white',
    color: activo ? 'var(--color-guinda-800)' : '#6b635e',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  });

  return (
    <AutoRegistroLayout>
      <div className="bg-white border border-stone-200 rounded-md p-8 shadow-sm">
        <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--color-dorado)' }}>
          <HelpCircle size={16} />
          <span className="text-xs font-semibold uppercase tracking-widest">
            Buscar mi cuenta
          </span>
        </div>
        <h1 className="font-serif text-2xl font-bold text-stone-900 mb-1">
          ¿No recuerdas si tienes cuenta?
        </h1>
        <p className="text-stone-500 text-sm mb-6">
          Búscala aquí. Si existe, te decimos con qué correo entras — y si olvidaste la
          contraseña, te mandamos el correo de recuperación.
        </p>

        {/* Selector de modo */}
        <div className="flex gap-2 mb-5">
          <button type="button" style={tabStyle(modo === 'curp')} onClick={() => { setModo('curp'); setResultado(null); setError(null); }}>
            <CreditCard size={14} /> Por CURP
          </button>
          <button type="button" style={tabStyle(modo === 'nombre')} onClick={() => { setModo('nombre'); setResultado(null); setError(null); }}>
            <User size={14} /> Por nombre
          </button>
        </div>

        <form onSubmit={buscar} className="space-y-4">
          {modo === 'curp' ? (
            <div>
              <label className="gov-label" htmlFor="ec-curp">CURP</label>
              <input
                id="ec-curp"
                type="text"
                maxLength={18}
                value={curp}
                onChange={(e) => setCurp(e.target.value.toUpperCase())}
                className="gov-input font-mono text-sm"
                placeholder="18 caracteres"
              />
              <div className="text-[10px] text-stone-400 mt-0.5">{curp.length}/18</div>
              <CurpHelpLink />
            </div>
          ) : (
            <>
              <div>
                <label className="gov-label" htmlFor="ec-nombres">Nombre(s)</label>
                <input id="ec-nombres" type="text" value={nombres} onChange={(e) => setNombres(e.target.value)} className="gov-input" placeholder="Axel Eduardo" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="gov-label" htmlFor="ec-apP">Apellido paterno</label>
                  <input id="ec-apP" type="text" value={apellidoPaterno} onChange={(e) => setApellidoPaterno(e.target.value)} className="gov-input" placeholder="González" />
                </div>
                <div>
                  <label className="gov-label" htmlFor="ec-apM">Apellido materno (opcional)</label>
                  <input id="ec-apM" type="text" value={apellidoMaterno} onChange={(e) => setApellidoMaterno(e.target.value)} className="gov-input" placeholder="Pérez" />
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={buscando}
            className="gov-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {buscando ? <Loader2 className="animate-spin" size={16} /> : <Search size={15} />}
            {buscando ? 'Buscando…' : 'Buscar mi cuenta'}
          </button>
        </form>

        {/* ── Resultado ── */}
        {resultado && (
          <div className="mt-6">
            {resultado.encontrada ? (
              <div className="border rounded-lg p-5" style={{ borderColor: '#c9dfc9', background: '#f6faf6' }}>
                <div className="flex items-center gap-2 mb-3" style={{ color: '#166534' }}>
                  <CheckCircle2 size={18} />
                  <span className="text-sm font-bold">¡Sí tienes cuenta!</span>
                </div>
                <div className="text-[13px] text-stone-700 mb-1">
                  {resultado.nombre && <span className="font-semibold">{resultado.nombre}</span>}
                </div>
                <div className="text-[12px] text-stone-500 mb-1">Tu correo de acceso:</div>

                {resultado.via === 'curp' && resultado.email ? (
                  <div className="flex items-center gap-2 mb-4">
                    <code
                      className="flex-1 text-[14px] font-semibold px-3 py-2 rounded-md border bg-white"
                      style={{ borderColor: '#eadfd7', color: 'var(--color-guinda-800)', overflowWrap: 'anywhere' }}
                    >
                      {resultado.email}
                    </code>
                    <button
                      type="button"
                      onClick={copiarEmail}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-md border text-[12px] font-semibold bg-white hover:bg-stone-50"
                      style={{ borderColor: '#eadfd7', color: copiado ? '#166534' : '#443e39', flexShrink: 0 }}
                    >
                      {copiado ? <Check size={13} /> : <Copy size={13} />}
                      {copiado ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                ) : (
                  <div className="mb-4">
                    <code
                      className="inline-block text-[14px] font-semibold px-3 py-2 rounded-md border bg-white"
                      style={{ borderColor: '#eadfd7', color: 'var(--color-guinda-800)' }}
                    >
                      {resultado.emailEnmascarado}
                    </code>
                    <div className="text-[11px] text-stone-500 mt-1.5">
                      Por tu seguridad mostramos el correo parcialmente. Si es tuyo, usa el botón
                      de recuperación (llega al correo completo) o búscate por CURP para verlo entero.
                    </div>
                  </div>
                )}

                {recuperacionEnviada ? (
                  <div className="text-[13px] font-medium px-3 py-2.5 rounded-md" style={{ background: '#eef4ee', color: '#166534' }}>
                    ✓ Enviamos el correo de recuperación. Revisa tu bandeja (y el spam).
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <a href="/login" className="gov-btn-primary flex-1 flex items-center justify-center gap-2 no-underline text-sm">
                      <LogIn size={14} /> Iniciar sesión
                    </a>
                    <button
                      type="button"
                      onClick={enviarRecuperacion}
                      disabled={enviandoRecuperacion}
                      className="gov-btn-secondary flex-1 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                    >
                      {enviandoRecuperacion ? <Loader2 className="animate-spin" size={14} /> : <MailQuestion size={14} />}
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                )}
              </div>
            ) : resultado.multiple ? (
              <div className="border rounded-lg p-5" style={{ borderColor: '#f0d9a8', background: '#fdf8ec' }}>
                <div className="text-sm font-bold mb-1" style={{ color: '#92600a' }}>
                  Hay varias personas con ese nombre
                </div>
                <p className="text-[12.5px] text-stone-600 mb-3">
                  Para darte tu correo con certeza, búscate mejor por CURP (es única para cada persona).
                </p>
                <button
                  type="button"
                  onClick={() => { setModo('curp'); setResultado(null); }}
                  className="gov-btn-primary text-sm"
                >
                  Buscar por CURP
                </button>
              </div>
            ) : (
              <div className="border rounded-lg p-5" style={{ borderColor: '#eadfd7', background: '#faf7f2' }}>
                <div className="text-sm font-bold text-stone-800 mb-1">
                  No encontramos una cuenta con esos datos
                </div>
                <p className="text-[12.5px] text-stone-600 mb-3">
                  Puede que aún no tengas cuenta, o que tus datos estén escritos distinto.
                  Puedes solicitar una cuenta nueva, o escribirnos al contacto de aquí abajo
                  para ayudarte a buscarla.
                </p>
                <a href="/solicitar-cuenta" className="gov-btn-primary inline-block text-center no-underline text-sm">
                  Solicitar cuenta
                </a>
              </div>
            )}
          </div>
        )}

        {/* ── Contacto institucional — SIEMPRE visible ── */}
        <div className="mt-6 border-t border-stone-200 pt-4">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--color-dorado)' }}>
            <LifeBuoy size={12} />
            ¿Necesitas ayuda? Contáctanos
          </div>
          <div className="text-[12px] font-semibold text-stone-800 mb-2">
            {contacto?.nombre ?? 'Coordinación de Preparatoria Abierta Michoacán'}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div
              className="flex items-center gap-2 flex-1 px-3 py-2 rounded-md border bg-stone-50"
              style={{ borderColor: '#eadfd7' }}
            >
              <Mail size={13} style={{ color: 'var(--color-guinda-700)', flexShrink: 0 }} />
              <span className="text-[12.5px] font-medium text-stone-800" style={{ overflowWrap: 'anywhere' }}>
                {contacto?.correo ?? 'contacto@michoacan.gob.mx'}
              </span>
              <button
                type="button"
                onClick={copiarContacto}
                className="ml-auto flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded border bg-white hover:bg-stone-50"
                style={{ borderColor: '#eadfd7', color: contactoCopiado ? '#166534' : '#443e39', flexShrink: 0 }}
              >
                {contactoCopiado ? <Check size={11} /> : <Copy size={11} />}
                {contactoCopiado ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-md border bg-stone-50"
              style={{ borderColor: '#eadfd7' }}
            >
              <Phone size={13} style={{ color: 'var(--color-guinda-700)', flexShrink: 0 }} />
              <span className="text-[12.5px] font-medium text-stone-800">
                {contacto?.telefono ?? '443-322-9250'}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-5 text-center text-xs text-stone-500">
          ¿Ya sabes tu correo?{' '}
          <a href="/login" className="text-[var(--color-guinda-700)] hover:underline">
            Inicia sesión
          </a>
        </div>
      </div>
    </AutoRegistroLayout>
  );
}
