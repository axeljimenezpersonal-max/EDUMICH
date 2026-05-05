import { useEffect, useState } from 'react';
import { User, Save, RefreshCw, Mail, Phone, Briefcase } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────

type Cuenta = {
  nombreCompleto: string;
  cargo: string;
  email: string;
  telefono: string;
};

type Preferencias = {
  notificacionesCorreo: boolean;
  notificacionesNavegador: boolean;
  resumenDiario: boolean;
  modoOscuro: boolean;
};

// ─── Toggle ───────────────────────────────────────────────────────────────

function Toggle({
  value,
  onChange,
  label,
  sublabel,
  disabled,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
  sublabel?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-stone-100">
      <div>
        <div className="text-sm font-medium text-stone-800">{label}</div>
        {sublabel && <div className="text-xs text-stone-400 mt-0.5">{sublabel}</div>}
      </div>
      <button
        type="button"
        onClick={() => !disabled && onChange(!value)}
        disabled={disabled}
        className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
        style={{ background: value ? '#6B0F3C' : '#d6d3d1', opacity: disabled ? 0.5 : 1 }}
      >
        <span
          className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform"
          style={{ transform: value ? 'translateX(20px)' : 'translateX(0)' }}
        />
      </button>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────

export default function MiCuenta({ onDirty }: { onDirty: (d: boolean) => void }) {
  const [cuenta, setCuenta] = useState<Cuenta>({
    nombreCompleto: '',
    cargo: '',
    email: '',
    telefono: '',
  });
  const [prefs, setPrefs] = useState<Preferencias>({
    notificacionesCorreo: true,
    notificacionesNavegador: false,
    resumenDiario: false,
    modoOscuro: false,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch('/api/admin/mi-cuenta', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        setCuenta({
          nombreCompleto: data.nombreCompleto ?? '',
          cargo: data.cargo ?? '',
          email: data.email ?? '',
          telefono: data.telefono ?? '',
        });
        if (data.preferencias) {
          setPrefs({
            notificacionesCorreo: data.preferencias.notificacionesCorreo ?? true,
            notificacionesNavegador: data.preferencias.notificacionesNavegador ?? false,
            resumenDiario: data.preferencias.resumenDiario ?? false,
            modoOscuro: data.preferencias.modoOscuro ?? false,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function setCuentaField(k: keyof Cuenta, v: string) {
    setCuenta((prev) => ({ ...prev, [k]: v }));
    onDirty(true);
  }

  function setPrefField(k: keyof Preferencias, v: boolean) {
    setPrefs((prev) => ({ ...prev, [k]: v }));
    onDirty(true);
  }

  function showSuccess() {
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2500);
  }

  async function handleSave() {
    if (!cuenta.nombreCompleto.trim()) {
      setError('El nombre completo es requerido.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await Promise.all([
        fetch('/api/admin/mi-cuenta', {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombreCompleto: cuenta.nombreCompleto.trim(),
            cargo: cuenta.cargo.trim() || null,
            telefono: cuenta.telefono.trim() || null,
          }),
        }),
        fetch('/api/admin/mi-cuenta/preferencias', {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(prefs),
        }),
      ]);
      onDirty(false);
      showSuccess();
    } catch {
      setError('Error al guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  const initials = cuenta.nombreCompleto
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div>
      {/* AVATAR + NOMBRE */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden mb-5">
        <div className="px-5 py-3" style={{ background: '#6B0F3C' }}>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <User size={14} strokeWidth={2} /> Mi cuenta
          </h2>
        </div>
        <div className="p-5">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <RefreshCw size={20} className="animate-spin" style={{ color: '#6B0F3C' }} />
            </div>
          ) : (
            <div className="flex items-start gap-5 mb-5">
              {/* Avatar */}
              <div
                className="flex-shrink-0 flex items-center justify-center rounded-full text-white font-bold text-lg"
                style={{ width: 60, height: 60, background: '#6B0F3C', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                {initials || <User size={24} strokeWidth={2} />}
              </div>
              <div className="flex-1">
                <div className="text-base font-bold" style={{ color: '#1a1a1a', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  {cuenta.nombreCompleto || 'Sin nombre'}
                </div>
                <div className="text-sm" style={{ color: '#78716c' }}>{cuenta.cargo || 'Administrador'}</div>
                <div className="text-xs mt-0.5" style={{ color: '#a8a29e' }}>{cuenta.email}</div>
              </div>
            </div>
          )}

          {/* Fields */}
          {!loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-stone-500 block mb-1 flex items-center gap-1">
                  <User size={11} strokeWidth={2} /> Nombre completo *
                </label>
                <input
                  className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#6B0F3C]"
                  value={cuenta.nombreCompleto}
                  onChange={(e) => setCuentaField('nombreCompleto', e.target.value)}
                  placeholder="Ej. María López Hernández"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-500 block mb-1 flex items-center gap-1">
                  <Briefcase size={11} strokeWidth={2} /> Cargo
                </label>
                <input
                  className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#6B0F3C]"
                  value={cuenta.cargo}
                  onChange={(e) => setCuentaField('cargo', e.target.value)}
                  placeholder="Ej. Administrador del Sistema"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-500 block mb-1 flex items-center gap-1">
                  <Phone size={11} strokeWidth={2} /> Teléfono
                </label>
                <input
                  type="tel"
                  className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#6B0F3C]"
                  value={cuenta.telefono}
                  onChange={(e) => setCuentaField('telefono', e.target.value)}
                  placeholder="443-123-4567"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-stone-500 block mb-1 flex items-center gap-1">
                  <Mail size={11} strokeWidth={2} /> Correo institucional
                </label>
                <input
                  type="email"
                  readOnly
                  className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 cursor-not-allowed"
                  style={{ color: '#78716c' }}
                  value={cuenta.email}
                />
                <p className="text-[11px] mt-1" style={{ color: '#a8a29e' }}>
                  El correo institucional no puede modificarse desde aqui. Contacta al soporte tecnico para realizar este cambio.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PREFERENCIAS */}
      {!loading && (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden mb-5">
          <div className="px-5 py-3" style={{ background: '#6B0F3C' }}>
            <h2 className="text-sm font-semibold text-white">Preferencias</h2>
          </div>
          <div className="px-5 py-2">
            <Toggle
              value={prefs.notificacionesCorreo}
              onChange={(v) => setPrefField('notificacionesCorreo', v)}
              label="Notificaciones por correo"
              sublabel="Recibe alertas de nuevas solicitudes y actividad relevante"
            />
            <Toggle
              value={prefs.notificacionesNavegador}
              onChange={(v) => setPrefField('notificacionesNavegador', v)}
              label="Notificaciones en navegador"
              sublabel="Notificaciones push mientras usas el sistema"
            />
            <Toggle
              value={prefs.resumenDiario}
              onChange={(v) => setPrefField('resumenDiario', v)}
              label="Resumen diario por correo"
              sublabel="Recibe un resumen cada manana con las tareas pendientes"
            />
            <Toggle
              value={prefs.modoOscuro}
              onChange={(v) => setPrefField('modoOscuro', v)}
              label="Modo oscuro"
              sublabel="Proximamente disponible"
              disabled
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
            style={{ background: '#6B0F3C' }}
          >
            {saving
              ? <RefreshCw size={14} strokeWidth={2} className="animate-spin" />
              : <Save size={14} strokeWidth={2} />}
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>

          {success && (
            <span
              className="text-sm font-medium px-3 py-1.5 rounded-lg"
              style={{ background: '#d1fae5', color: '#2d7d46' }}
            >
              Cambios guardados correctamente
            </span>
          )}
          {error && (
            <span className="text-sm font-medium" style={{ color: '#b91c1c' }}>{error}</span>
          )}
        </div>
      )}
    </div>
  );
}
