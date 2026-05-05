import { useEffect, useState } from 'react';
import { Building2, Save, RefreshCw, Info } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────

type DatosInst = {
  nombreOficial: string;
  nombreCorto: string;
  direccionOficial: string;
  telefonoGeneral: string;
  correoSoporte: string;
  rfc: string;
  sitioWeb: string;
};

const EMPTY: DatosInst = {
  nombreOficial: '',
  nombreCorto: '',
  direccionOficial: '',
  telefonoGeneral: '',
  correoSoporte: '',
  rfc: '',
  sitioWeb: '',
};

// ─── Main ─────────────────────────────────────────────────────────────────

export default function DatosInstitucionales({ onDirty }: { onDirty: (d: boolean) => void }) {
  const [form, setForm] = useState<DatosInst>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch('/api/admin/configuracion/datos-institucionales', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        setForm({
          nombreOficial: d.nombreOficial ?? '',
          nombreCorto: d.nombreCorto ?? '',
          direccionOficial: d.direccionOficial ?? '',
          telefonoGeneral: d.telefonoGeneral ?? '',
          correoSoporte: d.correoSoporte ?? '',
          rfc: d.rfc ?? '',
          sitioWeb: d.sitioWeb ?? '',
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function set(k: keyof DatosInst, v: string) {
    setForm((prev) => ({ ...prev, [k]: v }));
    onDirty(true);
  }

  async function handleSave() {
    if (!form.nombreOficial.trim()) { setError('El nombre oficial es requerido.'); return; }
    if (!form.nombreCorto.trim()) { setError('El nombre corto es requerido.'); return; }
    if (!form.direccionOficial.trim()) { setError('La direccion oficial es requerida.'); return; }

    setSaving(true);
    setError(null);
    try {
      const r = await fetch('/api/admin/configuracion/datos-institucionales', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombreOficial: form.nombreOficial.trim(),
          nombreCorto: form.nombreCorto.trim(),
          direccionOficial: form.direccionOficial.trim(),
          telefonoGeneral: form.telefonoGeneral.trim() || null,
          correoSoporte: form.correoSoporte.trim() || null,
          rfc: form.rfc.trim().toUpperCase() || null,
          sitioWeb: form.sitioWeb.trim() || null,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.message ?? 'Error al guardar.');
      }
      onDirty(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar datos institucionales.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* Info note */}
      <div
        className="flex items-start gap-2.5 px-4 py-3 rounded-xl border mb-5 text-sm"
        style={{ background: '#fdf8fb', border: '1px solid #e8d5e0', color: '#5a0e32' }}
      >
        <Info size={15} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1, color: '#6B0F3C' }} />
        <span>
          Estos datos aparecen en los encabezados de PDFs, correos institucionales y en la pagina publica de
          verificacion.
        </span>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden mb-5">
        <div className="px-5 py-3" style={{ background: '#6B0F3C' }}>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Building2 size={14} strokeWidth={2} /> Datos institucionales
          </h2>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <RefreshCw size={20} className="animate-spin" style={{ color: '#6B0F3C' }} />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nombre oficial */}
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-stone-500 block mb-1">
                  Nombre oficial *
                </label>
                <input
                  className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#6B0F3C]"
                  value={form.nombreOficial}
                  onChange={(e) => set('nombreOficial', e.target.value)}
                  placeholder="Ej. Preparatoria Abierta del Estado de Michoacan"
                />
              </div>

              {/* Nombre corto */}
              <div>
                <label className="text-xs font-semibold text-stone-500 block mb-1">
                  Nombre corto *
                </label>
                <input
                  className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#6B0F3C]"
                  value={form.nombreCorto}
                  onChange={(e) => set('nombreCorto', e.target.value)}
                  maxLength={50}
                  placeholder="Ej. Prepa Abierta Michoacan"
                />
                <span className="text-[11px]" style={{ color: '#a8a29e' }}>
                  {form.nombreCorto.length}/50 caracteres
                </span>
              </div>

              {/* RFC */}
              <div>
                <label className="text-xs font-semibold text-stone-500 block mb-1">
                  RFC
                </label>
                <input
                  className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#6B0F3C] uppercase"
                  value={form.rfc}
                  onChange={(e) => set('rfc', e.target.value.toUpperCase())}
                  maxLength={20}
                  placeholder="XAXX010101000"
                />
              </div>

              {/* Direccion */}
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-stone-500 block mb-1">
                  Direccion oficial *
                </label>
                <textarea
                  rows={3}
                  className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#6B0F3C] resize-none"
                  value={form.direccionOficial}
                  onChange={(e) => set('direccionOficial', e.target.value)}
                  placeholder="Calle, numero, colonia, municipio, estado, CP"
                />
              </div>

              {/* Telefono */}
              <div>
                <label className="text-xs font-semibold text-stone-500 block mb-1">
                  Telefono general
                </label>
                <input
                  type="tel"
                  className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#6B0F3C]"
                  value={form.telefonoGeneral}
                  onChange={(e) => set('telefonoGeneral', e.target.value)}
                  placeholder="443-322-0000"
                />
              </div>

              {/* Correo soporte */}
              <div>
                <label className="text-xs font-semibold text-stone-500 block mb-1">
                  Correo de soporte
                </label>
                <input
                  type="email"
                  className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#6B0F3C]"
                  value={form.correoSoporte}
                  onChange={(e) => set('correoSoporte', e.target.value)}
                  placeholder="soporte@prepaabierta.edu.mx"
                />
              </div>

              {/* Sitio web */}
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-stone-500 block mb-1">
                  Sitio web
                </label>
                <input
                  type="url"
                  className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#6B0F3C]"
                  value={form.sitioWeb}
                  onChange={(e) => set('sitioWeb', e.target.value)}
                  placeholder="https://prepaabierta.michoacan.gob.mx"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      {!loading && (
        <div className="flex items-center gap-3">
          <button
            type="button"
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
              Datos guardados correctamente
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
