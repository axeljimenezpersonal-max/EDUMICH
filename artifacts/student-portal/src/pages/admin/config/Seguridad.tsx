import { useEffect, useState } from 'react';
import { Lock, Eye, EyeOff, Monitor, Shield, RefreshCw, X } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────

type Sesion = {
  id: string;
  ip: string;
  creadoEn: string;
  ultimaActividad: string;
  isCurrent?: boolean;
};

// ─── Password strength ────────────────────────────────────────────────────

function calcStrength(pwd: string): number {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/\d/.test(pwd)) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return score;
}

function StrengthBar({ password }: { password: string }) {
  if (!password) return null;
  const score = calcStrength(password);
  const labels = ['', 'Debil', 'Media', 'Fuerte', 'Muy fuerte'];
  const colors = ['', '#b91c1c', '#d97706', '#2d7d46', '#6B1530'];
  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-all"
            style={{ background: i <= score ? colors[score] : '#eadfd7' }}
          />
        ))}
      </div>
      <span className="text-[11px] font-medium" style={{ color: colors[score] }}>
        {labels[score]}
      </span>
    </div>
  );
}

// ─── PasswordInput ────────────────────────────────────────────────────────

function PasswordInput({
  value,
  onChange,
  placeholder,
  label,
  required,
  showStrength,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label: string;
  required?: boolean;
  showStrength?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="text-xs font-semibold text-stone-500 block mb-1">
        {label}{required && ' *'}
      </label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 pr-9 focus:outline-none focus:border-[#6B1530]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="new-password"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2"
          style={{ color: '#6b635e', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
        >
          {show ? <EyeOff size={14} strokeWidth={2} /> : <Eye size={14} strokeWidth={2} />}
        </button>
      </div>
      {showStrength && <StrengthBar password={value} />}
    </div>
  );
}

// ─── Section A: Cambiar contraseña ────────────────────────────────────────

function CambiarPassword({ onDirty }: { onDirty: (d: boolean) => void }) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function validate(): string | null {
    if (!actual) return 'Ingresa tu contrasena actual.';
    if (nueva.length < 8) return 'La nueva contrasena debe tener al menos 8 caracteres.';
    if (!/\d/.test(nueva)) return 'La nueva contrasena debe incluir al menos un numero.';
    if (!/[A-Z]/.test(nueva)) return 'La nueva contrasena debe incluir al menos una mayuscula.';
    if (nueva !== confirmar) return 'Las contrasenas nuevas no coinciden.';
    return null;
  }

  async function handleSave() {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true);
    setError(null);
    try {
      const r = await fetch('/api/admin/configuracion/seguridad/cambiar-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actual, nueva }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.message ?? 'Error al cambiar contrasena.');
      }
      setActual(''); setNueva(''); setConfirmar('');
      onDirty(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cambiar contrasena.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden mb-5">
      <div className="px-5 py-3" style={{ background: '#6B1530' }}>
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Lock size={14} strokeWidth={2} /> Cambiar contrasena
        </h2>
      </div>
      <div className="p-5 flex flex-col gap-4">
        <PasswordInput
          label="Contrasena actual"
          required
          value={actual}
          onChange={(v) => { setActual(v); onDirty(true); }}
          placeholder="Tu contrasena actual"
        />
        <PasswordInput
          label="Nueva contrasena"
          required
          showStrength
          value={nueva}
          onChange={(v) => { setNueva(v); onDirty(true); }}
          placeholder="Minimo 8 caracteres"
        />
        <PasswordInput
          label="Confirmar nueva contrasena"
          required
          value={confirmar}
          onChange={(v) => { setConfirmar(v); onDirty(true); }}
          placeholder="Repite la nueva contrasena"
        />

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-60"
            style={{ background: '#6B1530' }}
          >
            {saving ? <RefreshCw size={14} strokeWidth={2} className="animate-spin" /> : <Lock size={14} strokeWidth={2} />}
            {saving ? 'Guardando...' : 'Cambiar contrasena'}
          </button>
          {success && (
            <span className="text-sm font-medium px-3 py-1.5 rounded-lg" style={{ background: '#d1fae5', color: '#2d7d46' }}>
              Contrasena actualizada
            </span>
          )}
          {error && <span className="text-sm font-medium" style={{ color: '#b91c1c' }}>{error}</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Section B: Sesiones activas ─────────────────────────────────────────

function maskIp(ip: string): string {
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.***.***`;
  }
  // IPv6 or other
  return ip.slice(0, 6) + '...';
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function SesionesActivas() {
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [loading, setLoading] = useState(true);
  const [cerrando, setCerrando] = useState<string | null>(null);
  const [cerrando_todas, setCerrandoTodas] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch('/api/admin/configuracion/seguridad/sesiones', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setSesiones(d.sesiones ?? d ?? []))
      .catch(() => setSesiones([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function cerrarSesion(id: string) {
    setCerrando(id);
    setError(null);
    try {
      await fetch(`/api/admin/configuracion/seguridad/sesiones/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      setSesiones((prev) => prev.filter((s) => s.id !== id));
    } catch {
      setError('Error al cerrar la sesion.');
    } finally {
      setCerrando(null);
    }
  }

  async function cerrarTodas() {
    setCerrandoTodas(true);
    setError(null);
    try {
      await fetch('/api/admin/configuracion/seguridad/sesiones/cerrar-todas', {
        method: 'POST',
        credentials: 'include',
      });
      load();
    } catch {
      setError('Error al cerrar las sesiones.');
    } finally {
      setCerrandoTodas(false);
    }
  }

  // Identify current session as the most recent one
  const sorted = [...sesiones].sort(
    (a, b) => new Date(b.ultimaActividad).getTime() - new Date(a.ultimaActividad).getTime()
  );
  const currentId = sorted[0]?.id;

  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden mb-5">
      <div className="px-5 py-3" style={{ background: '#6B1530' }}>
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Monitor size={14} strokeWidth={2} /> Sesiones activas
        </h2>
      </div>
      <div className="p-5">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw size={18} className="animate-spin" style={{ color: '#6B1530' }} />
          </div>
        ) : sesiones.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: '#6b635e' }}>
            No hay sesiones activas registradas.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {sorted.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-stone-100"
                style={{ background: s.id === currentId ? '#fdf8fb' : '#fafaf9' }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: s.id === currentId ? '#efe7d6' : '#f7f2ed', color: s.id === currentId ? '#6B1530' : '#6b635e' }}
                >
                  <Monitor size={14} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium" style={{ color: '#2a2a2a' }}>
                      {maskIp(s.ip)}
                    </span>
                    {s.id === currentId && (
                      <span
                        className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full text-white"
                        style={{ background: '#6B1530' }}
                      >
                        ESTA SESION
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] mt-0.5" style={{ color: '#a89a8e' }}>
                    Inicio: {formatDate(s.creadoEn)} · Ultima actividad: {formatDate(s.ultimaActividad)}
                  </div>
                </div>
                {s.id !== currentId && (
                  <button
                    type="button"
                    onClick={() => cerrarSesion(s.id)}
                    disabled={cerrando === s.id}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold border border-stone-200 rounded-lg disabled:opacity-50 hover:bg-stone-50"
                    style={{ color: '#443e39', flexShrink: 0 }}
                  >
                    {cerrando === s.id
                      ? <RefreshCw size={11} strokeWidth={2} className="animate-spin" />
                      : <X size={11} strokeWidth={2} />}
                    Cerrar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {error && (
          <p className="text-xs font-medium mt-3" style={{ color: '#b91c1c' }}>{error}</p>
        )}

        {sesiones.length > 1 && (
          <div className="mt-4 pt-4 border-t border-stone-100">
            <button
              type="button"
              onClick={cerrarTodas}
              disabled={cerrando_todas}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold border border-stone-200 rounded-lg hover:bg-stone-50 disabled:opacity-50"
              style={{ color: '#b91c1c' }}
            >
              {cerrando_todas
                ? <RefreshCw size={13} strokeWidth={2} className="animate-spin" />
                : <X size={13} strokeWidth={2} />}
              {cerrando_todas ? 'Cerrando...' : 'Cerrar todas las demas sesiones'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section C: 2FA ───────────────────────────────────────────────────────

function TwoFactorAuth() {
  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden mb-5">
      <div className="px-5 py-3" style={{ background: '#6B1530' }}>
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Shield size={14} strokeWidth={2} /> Autenticacion de dos factores
        </h2>
      </div>
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: '#efe7d6' }}
          >
            <Shield size={18} strokeWidth={2} style={{ color: '#6B1530' }} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>
                Autenticacion de dos factores (2FA)
              </span>
              <span
                className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full text-white"
                style={{ background: '#6B1530' }}
              >
                PROXIMAMENTE
              </span>
            </div>
            <p className="text-sm mb-3" style={{ color: '#6b635e' }}>
              Agrega una capa adicional de seguridad a tu cuenta. Al activar 2FA, necesitaras ingresar un codigo
              generado por una aplicacion autenticadora ademas de tu contrasena.
            </p>
            <p className="text-xs p-3 rounded-lg" style={{ background: '#f7f2ed', color: '#6b635e' }}>
              Esta funcion estara disponible en una proxima actualizacion del sistema. Por ahora, asegurate de
              usar una contrasena robusta y de no compartirla con nadie.
            </p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-stone-100">
          <button
            type="button"
            disabled
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg text-white cursor-not-allowed"
            style={{ background: '#6B1530', opacity: 0.4 }}
            title="Proximamente disponible"
          >
            <Shield size={14} strokeWidth={2} /> Activar 2FA
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────

export default function Seguridad({ onDirty }: { onDirty: (d: boolean) => void }) {
  return (
    <div>
      <CambiarPassword onDirty={onDirty} />
      <TwoFactorAuth />
    </div>
  );
}
