import { useEffect, useRef, useState } from 'react';
import { User, Save, RefreshCw, Mail, Phone, Briefcase, Lock } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────

type Cuenta = {
  nombreCompleto: string;
  cargo: string;      // ↔ backend: puesto
  email: string;
  telefono: string;   // ↔ backend: telefonoPublico
};

type Preferencias = {
  notifEmail: boolean;
  notifNavegador: boolean;
};

const BASE = '/api/admin/configuracion/mi-cuenta';

// ─── Toggle ───────────────────────────────────────────────────────────────

function Toggle({
  value, onChange, label, sublabel,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
  sublabel?: string;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-stone-100 last:border-b-0">
      <div className="pr-4">
        <div className="text-sm font-medium text-stone-800">{label}</div>
        {sublabel && <div className="text-xs text-stone-400 mt-0.5">{sublabel}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
        style={{ background: value ? 'var(--color-guinda-700)' : '#ddd0c5' }}
      >
        <span
          className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform"
          style={{ transform: value ? 'translateX(20px)' : 'translateX(0)' }}
        />
      </button>
    </div>
  );
}

// Campo de texto que se bloquea una vez que tiene un valor guardado.
function CampoBloqueable({
  icon, label, value, onChange, placeholder, bloqueado, type = 'text',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  bloqueado: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-stone-500 mb-1 flex items-center gap-1">
        {icon} {label} {bloqueado && <Lock size={10} strokeWidth={2.5} style={{ color: '#a89a8e' }} />}
      </label>
      <input
        type={type}
        readOnly={bloqueado}
        className={`w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none ${
          bloqueado ? 'bg-stone-50 cursor-not-allowed' : 'focus:border-[var(--color-guinda-700)]'
        }`}
        style={bloqueado ? { color: '#6b635e' } : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────

interface Props {
  onDirty: (d: boolean) => void;
  registerSave?: (fn: () => Promise<void>) => void;
  registerDiscard?: (fn: () => void) => void;
}

export default function MiCuenta({ onDirty, registerSave, registerDiscard }: Props) {
  const [cuenta, setCuenta] = useState<Cuenta>({ nombreCompleto: '', cargo: '', email: '', telefono: '' });
  const [prefs, setPrefs] = useState<Preferencias>({ notifEmail: true, notifNavegador: false });
  const [confirmado, setConfirmado] = useState(false);
  // Valores originales (para saber qué bloquear y para descartar).
  const original = useRef<{ cuenta: Cuenta; prefs: Preferencias } | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function cargar() {
    try {
      const r = await fetch(BASE, { credentials: 'include' });
      const data = await r.json();
      const c: Cuenta = {
        nombreCompleto: data.nombreCompleto ?? '',
        cargo: data.puesto ?? '',
        email: data.email ?? '',
        telefono: data.telefonoPublico ?? '',
      };
      const p: Preferencias = {
        notifEmail: data.preferencias?.notifEmail ?? true,
        notifNavegador: data.preferencias?.notifNavegador ?? false,
      };
      setCuenta(c);
      setPrefs(p);
      setConfirmado(!!data.perfilConfirmado);
      original.current = { cuenta: c, prefs: p };
    } catch { /* noop */ }
    finally { setLoading(false); }
  }

  useEffect(() => { cargar(); }, []);

  function setCuentaField(k: keyof Cuenta, v: string) {
    setCuenta((prev) => ({ ...prev, [k]: v }));
    onDirty(true);
  }
  function setPrefField(k: keyof Preferencias, v: boolean) {
    setPrefs((prev) => ({ ...prev, [k]: v }));
    onDirty(true);
  }

  async function handleSave() {
    if (!confirmado && !cuenta.nombreCompleto.trim()) { setError('El nombre completo es requerido.'); return; }
    setSaving(true);
    setError(null);
    try {
      // El perfil (nombre/cargo/tel) solo se envía si aún no está confirmado.
      if (!confirmado) {
        const r1 = await fetch(BASE, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombreCompleto: cuenta.nombreCompleto.trim(),
            puesto: cuenta.cargo.trim() || null,
            telefonoPublico: cuenta.telefono.trim() || null,
          }),
        });
        if (!r1.ok) throw new Error('save');
      }
      const r2 = await fetch(`${BASE}/preferencias`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifEmail: prefs.notifEmail, notifNavegador: prefs.notifNavegador }),
      });
      if (!r2.ok) throw new Error('save');
      onDirty(false);
      setSuccess(true);
      // Si acabamos de confirmar el perfil, recarga para reflejar el saludo y el bloqueo.
      if (!confirmado) {
        setTimeout(() => window.location.reload(), 700);
      } else {
        setSaving(false);
        setTimeout(() => setSuccess(false), 2500);
      }
    } catch {
      setError('Error al guardar. Intenta de nuevo.');
      setSaving(false);
    }
  }

  function handleDiscard() {
    if (original.current) {
      setCuenta(original.current.cuenta);
      setPrefs(original.current.prefs);
    }
    onDirty(false);
    setError(null);
  }

  // Registra con la barra global (se re-registra cada render → siempre la última versión).
  useEffect(() => {
    registerSave?.(handleSave);
    registerDiscard?.(handleDiscard);
  });

  // Bloqueo: los 3 campos se bloquean una vez que el perfil fue confirmado
  // (guardado la primera vez). Antes de eso son editables (para corregir).
  const bloqNombre = confirmado;
  const bloqCargo = confirmado;
  const bloqTel = confirmado;

  const initials = cuenta.nombreCompleto.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');

  return (
    <div>
      {/* AVATAR + NOMBRE */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden mb-5">
        <div className="px-5 py-3" style={{ background: 'var(--color-guinda-700)' }}>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <User size={14} strokeWidth={2} /> Mi cuenta
          </h2>
        </div>
        <div className="p-5">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <RefreshCw size={20} className="animate-spin" style={{ color: 'var(--color-guinda-700)' }} />
            </div>
          ) : (
            <>
              <div className="flex items-start gap-5 mb-5">
                <div
                  className="flex-shrink-0 flex items-center justify-center rounded-full text-white font-bold text-lg"
                  style={{ width: 60, height: 60, background: 'var(--color-guinda-700)', fontFamily: "'Poppins', sans-serif" }}
                >
                  {initials || <User size={24} strokeWidth={2} />}
                </div>
                <div className="flex-1">
                  <div className="text-base font-bold" style={{ color: '#1a1a1a', fontFamily: "'Poppins', sans-serif" }}>
                    {cuenta.nombreCompleto || 'Sin nombre'}
                  </div>
                  <div className="text-sm" style={{ color: '#6b635e' }}>{cuenta.cargo || 'Administrador'}</div>
                  <div className="text-xs mt-0.5" style={{ color: '#a89a8e' }}>{cuenta.email}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <CampoBloqueable
                    icon={<User size={11} strokeWidth={2} />}
                    label="Nombre completo *"
                    value={cuenta.nombreCompleto}
                    onChange={(v) => setCuentaField('nombreCompleto', v)}
                    placeholder="Ej. José María Morelos y Pavón"
                    bloqueado={bloqNombre}
                  />
                </div>
                <CampoBloqueable
                  icon={<Briefcase size={11} strokeWidth={2} />}
                  label="Cargo"
                  value={cuenta.cargo}
                  onChange={(v) => setCuentaField('cargo', v)}
                  placeholder="Ej. Administrador del Sistema"
                  bloqueado={bloqCargo}
                />
                <CampoBloqueable
                  icon={<Phone size={11} strokeWidth={2} />}
                  label="Teléfono"
                  type="tel"
                  value={cuenta.telefono}
                  onChange={(v) => setCuentaField('telefono', v)}
                  placeholder="+52 443 123 4567"
                  bloqueado={bloqTel}
                />
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-stone-500 mb-1 flex items-center gap-1">
                    <Mail size={11} strokeWidth={2} /> Correo institucional
                    <Lock size={10} strokeWidth={2.5} style={{ color: '#a89a8e' }} />
                  </label>
                  <input
                    type="email"
                    readOnly
                    className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 cursor-not-allowed"
                    style={{ color: '#6b635e' }}
                    value={cuenta.email}
                  />
                </div>
              </div>

              {(bloqNombre || bloqCargo || bloqTel) && (
                <p className="text-[11px] mt-3 flex items-start gap-1.5" style={{ color: '#a89a8e' }}>
                  <Lock size={11} strokeWidth={2.5} className="mt-0.5 flex-shrink-0" />
                  Los datos ya registrados quedan bloqueados. Para corregirlos, contacta al soporte técnico.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* PREFERENCIAS */}
      {!loading && (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden mb-5">
          <div className="px-5 py-3" style={{ background: 'var(--color-guinda-700)' }}>
            <h2 className="text-sm font-semibold text-white">Preferencias</h2>
          </div>
          <div className="px-5 py-2">
            <Toggle
              value={prefs.notifEmail}
              onChange={(v) => setPrefField('notifEmail', v)}
              label="Notificaciones por correo"
              sublabel="Solo cuando un gestor registra un nuevo alumno o llega una nueva solicitud"
            />
            <Toggle
              value={prefs.notifNavegador}
              onChange={(v) => setPrefField('notifNavegador', v)}
              label="Notificaciones en navegador"
              sublabel="Notificaciones push mientras usas el sistema"
            />
          </div>
        </div>
      )}

      {/* ACTIONS */}
      {!loading && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-60"
            style={{ background: 'var(--color-guinda-700)' }}
          >
            {saving ? <RefreshCw size={14} strokeWidth={2} className="animate-spin" /> : <Save size={14} strokeWidth={2} />}
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
          {success && (
            <span className="text-sm font-medium px-3 py-1.5 rounded-lg" style={{ background: '#d1fae5', color: '#2d7d46' }}>
              Guardado ✓
            </span>
          )}
          {error && <span className="text-sm font-medium" style={{ color: '#b91c1c' }}>{error}</span>}
        </div>
      )}
    </div>
  );
}
