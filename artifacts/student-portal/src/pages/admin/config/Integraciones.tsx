import { useEffect, useState } from 'react';
import {
  RefreshCw, Settings, Zap, CheckCircle, XCircle, Eye, EyeOff,
  X, Save, PlayCircle,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────

type Integracion = {
  clave: string;
  nombre: string;
  descripcion: string;
  conectada: boolean;
  ultimaPrueba: string | null;
  ultimaPruebaExitosa: boolean | null;
  config: Record<string, string>;
};

// ─── Config field definitions ──────────────────────────────────────────────

type FieldDef = { key: string; label: string; placeholder: string; masked?: boolean; textarea?: boolean };

const CONFIG_FIELDS: Record<string, FieldDef[]> = {
  resend: [
    { key: 'apiKey', label: 'API Key', placeholder: 're_xxxxxxxxxxxx', masked: true },
    { key: 'domain', label: 'Dominio remitente', placeholder: 'prepa.michoacan.gob.mx' },
  ],
  neon: [
    { key: 'connectionString', label: 'Connection String', placeholder: 'postgresql://user:pass@host/db', masked: true, textarea: true },
  ],
  s3: [
    { key: 'bucket', label: 'Nombre del bucket', placeholder: 'prepa-michoacan-docs' },
    { key: 'region', label: 'Region', placeholder: 'us-east-1' },
    { key: 'accessKey', label: 'Access Key ID', placeholder: 'AKIAIOSFODNN7EXAMPLE', masked: true },
    { key: 'secretKey', label: 'Secret Access Key', placeholder: 'wJalrXUtnFEMI/K7MDENG...', masked: true },
  ],
  sep_dgb: [],
};

// ─── Helpers ──────────────────────────────────────────────────────────────

function timeAgo(iso: string | null): string {
  if (!iso) return 'Nunca';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'hace un momento';
  if (mins < 60) return `hace ${mins} minuto${mins === 1 ? '' : 's'}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs} hora${hrs === 1 ? '' : 's'}`;
  const days = Math.floor(hrs / 24);
  return `hace ${days} dia${days === 1 ? '' : 's'}`;
}

function providerInitials(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

// ─── Toast ────────────────────────────────────────────────────────────────

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div
      className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white flex items-center gap-2"
      style={{ background: ok ? '#2d7d46' : '#b91c1c' }}
    >
      {ok ? <CheckCircle size={14} strokeWidth={2} /> : <XCircle size={14} strokeWidth={2} />}
      {msg}
    </div>
  );
}

// ─── Masked input ─────────────────────────────────────────────────────────

function MaskedInput({
  value,
  onChange,
  placeholder,
  textarea,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  if (textarea) {
    return (
      <div className="relative">
        <textarea
          rows={3}
          className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 pr-9 focus:outline-none focus:border-[#6B0F3C] font-mono resize-none"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ WebkitTextSecurity: visible ? 'none' : 'disc' } as React.CSSProperties}
        />
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); setVisible((v) => !v); }}
          className="absolute top-2 right-2 text-stone-400 hover:text-stone-600"
        >
          {visible ? <EyeOff size={14} strokeWidth={2} /> : <Eye size={14} strokeWidth={2} />}
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 pr-9 focus:outline-none focus:border-[#6B0F3C] font-mono"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); setVisible((v) => !v); }}
        className="absolute top-1/2 -translate-y-1/2 right-2.5 text-stone-400 hover:text-stone-600"
      >
        {visible ? <EyeOff size={14} strokeWidth={2} /> : <Eye size={14} strokeWidth={2} />}
      </button>
    </div>
  );
}

// ─── Config modal ─────────────────────────────────────────────────────────

function ConfigModal({
  integracion,
  onClose,
  onSaved,
}: {
  integracion: Integracion;
  onClose: () => void;
  onSaved: (updated: Integracion) => void;
}) {
  const fields = CONFIG_FIELDS[integracion.clave] ?? [];
  const [values, setValues] = useState<Record<string, string>>({ ...integracion.config });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setValue(key: string, val: string) {
    setValues((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/configuracion/integraciones/${integracion.clave}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error();
      onSaved({ ...integracion, config: values });
      onClose();
    } catch {
      setError('Error al guardar la configuracion. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-stone-200" style={{ background: '#6B0F3C' }}>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Settings size={14} strokeWidth={2} />
            Configurar {integracion.nombre}
          </h3>
          <button type="button" onClick={onClose} className="text-white/70 hover:text-white">
            <X size={16} strokeWidth={2} />
          </button>
        </div>
        <div className="px-5 py-4">
          {fields.length === 0 ? (
            <p className="text-sm text-stone-500 py-4 text-center">
              Esta integracion no requiere configuracion manual.
            </p>
          ) : (
            <div className="space-y-3">
              {fields.map((f) => (
                <div key={f.key}>
                  <label className="text-xs font-semibold text-stone-500 block mb-1">{f.label}</label>
                  {f.masked ? (
                    <MaskedInput
                      value={values[f.key] ?? ''}
                      onChange={(v) => setValue(f.key, v)}
                      placeholder={f.placeholder}
                      textarea={f.textarea}
                    />
                  ) : (
                    <input
                      className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#6B0F3C]"
                      value={values[f.key] ?? ''}
                      onChange={(e) => setValue(f.key, e.target.value)}
                      placeholder={f.placeholder}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
          {error && <p className="text-xs mt-3" style={{ color: '#b91c1c' }}>{error}</p>}
        </div>
        <div className="px-5 py-3 border-t border-stone-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm font-medium rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-50"
          >
            Cancelar
          </button>
          {fields.length > 0 && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg text-white disabled:opacity-60"
              style={{ background: '#6B0F3C' }}
            >
              {saving ? <RefreshCw size={13} strokeWidth={2} className="animate-spin" /> : <Save size={13} strokeWidth={2} />}
              Guardar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Integration card ──────────────────────────────────────────────────────

function IntegracionCard({
  integracion,
  onUpdate,
  onToast,
}: {
  integracion: Integracion;
  onUpdate: (updated: Integracion) => void;
  onToast: (msg: string, ok: boolean) => void;
}) {
  const [testing, setTesting] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const isSepDgb = integracion.clave === 'sep_dgb';

  async function handleTest() {
    setTesting(true);
    try {
      const res = await fetch(`/api/admin/configuracion/integraciones/${integracion.clave}/probar`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? '');
      onToast(`Conexion con ${integracion.nombre} exitosa`, true);
      onUpdate({ ...integracion, ultimaPrueba: new Date().toISOString(), ultimaPruebaExitosa: true });
    } catch {
      onToast(`Error en la conexion con ${integracion.nombre}`, false);
      onUpdate({ ...integracion, ultimaPrueba: new Date().toISOString(), ultimaPruebaExitosa: false });
    } finally {
      setTesting(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-4 px-5 py-4 border-b border-stone-100 last:border-b-0 hover:bg-stone-50 transition-colors">
        {/* Avatar */}
        <div
          className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-sm font-bold"
          style={{ background: isSepDgb ? '#78716c' : '#6B0F3C' }}
        >
          {providerInitials(integracion.nombre)}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-stone-800">{integracion.nombre}</span>
            {isSepDgb && (
              <span
                className="px-2 py-0.5 rounded text-[10px] font-bold"
                style={{ background: '#fef9c3', color: '#92400e' }}
              >
                Disponible en 2027
              </span>
            )}
          </div>
          <p className="text-xs text-stone-400 mt-0.5">{integracion.descripcion}</p>
          {integracion.ultimaPrueba && (
            <p className="text-[11px] mt-1 flex items-center gap-1" style={{ color: integracion.ultimaPruebaExitosa ? '#2d7d46' : '#b91c1c' }}>
              {integracion.ultimaPruebaExitosa
                ? <CheckCircle size={10} strokeWidth={2} />
                : <XCircle size={10} strokeWidth={2} />}
              Ultima prueba: {timeAgo(integracion.ultimaPrueba)} &middot;{' '}
              {integracion.ultimaPruebaExitosa ? 'Exitosa' : 'Fallida'}
            </p>
          )}
        </div>

        {/* Status pill */}
        <span
          className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase flex-shrink-0 flex items-center gap-1"
          style={
            integracion.conectada
              ? { background: '#d1fae5', color: '#2d7d46' }
              : { background: '#f5f5f4', color: '#78716c' }
          }
        >
          {integracion.conectada ? (
            <><CheckCircle size={10} strokeWidth={2} /> CONECTADO</>
          ) : (
            <><XCircle size={10} strokeWidth={2} /> NO CONECTADO</>
          )}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {integracion.conectada && !isSepDgb && (
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-50 disabled:opacity-50"
            >
              {testing ? (
                <RefreshCw size={11} strokeWidth={2} className="animate-spin" />
              ) : (
                <PlayCircle size={11} strokeWidth={2} />
              )}
              Probar conexion
            </button>
          )}
          {!isSepDgb && (
            <button
              type="button"
              onClick={() => setConfigOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-50"
            >
              <Settings size={11} strokeWidth={2} />
              Configurar
            </button>
          )}
          {!integracion.conectada && !isSepDgb && (
            <button
              type="button"
              onClick={() => setConfigOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg text-white"
              style={{ background: '#6B0F3C' }}
            >
              <Zap size={11} strokeWidth={2} />
              Conectar
            </button>
          )}
          {isSepDgb && (
            <button
              type="button"
              disabled
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-stone-200 text-stone-400 cursor-not-allowed opacity-50"
            >
              <Settings size={11} strokeWidth={2} />
              Proximamente
            </button>
          )}
        </div>
      </div>

      {configOpen && (
        <ConfigModal
          integracion={integracion}
          onClose={() => setConfigOpen(false)}
          onSaved={(updated) => {
            onUpdate(updated);
            setConfigOpen(false);
          }}
        />
      )}
    </>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────

export default function Integraciones({ onDirty: _onDirty }: { onDirty?: (d: boolean) => void }) {
  const [integraciones, setIntegraciones] = useState<Integracion[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    fetch('/api/admin/configuracion/integraciones', { credentials: 'include' })
      .then((r) => r.json())
      .then((data: Integracion[]) => setIntegraciones(data))
      .catch(() => showToast('Error al cargar integraciones', false))
      .finally(() => setLoading(false));
  }, []);

  function handleUpdate(updated: Integracion) {
    setIntegraciones((prev) => prev.map((i) => (i.clave === updated.clave ? updated : i)));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw size={20} className="animate-spin" style={{ color: '#6B0F3C' }} />
      </div>
    );
  }

  const conectadas = integraciones.filter((i) => i.conectada).length;

  return (
    <div>
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="px-5 py-3 flex items-center justify-between" style={{ background: '#6B0F3C' }}>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Zap size={14} strokeWidth={2} />
            Integraciones
          </h2>
          <span className="text-white/70 text-xs">
            {conectadas} de {integraciones.length} conectadas
          </span>
        </div>
        <div>
          {integraciones.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-stone-400">
              No se encontraron integraciones configuradas.
            </div>
          ) : (
            integraciones.map((i) => (
              <IntegracionCard
                key={i.clave}
                integracion={i}
                onUpdate={handleUpdate}
                onToast={showToast}
              />
            ))
          )}
        </div>
      </div>

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </div>
  );
}
