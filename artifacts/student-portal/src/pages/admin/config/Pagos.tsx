import { useEffect, useState } from 'react';
import { CreditCard, DollarSign, History, Edit2, Save, X, RefreshCw, Banknote, Check } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────

type DatosBancarios = {
  banco: string;
  titular: string;
  clabe: string;
  rfc: string;
  concepto: string;
};

type ConceptoPago = {
  id: number;
  concepto: string;
  monto: number;
  vigencia: string;
  activo: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────

function maskClabe(clabe: string): string {
  if (!clabe) return '—';
  if (clabe.length <= 4) return clabe;
  const last4 = clabe.slice(-4);
  const stars = '*'.repeat(Math.max(0, clabe.length - 4));
  // Format as groups for readability: *** ****** ***1234
  const masked = stars + last4;
  if (masked.length === 18) {
    return `${masked.slice(0, 3)} ${masked.slice(3, 9)} ${masked.slice(9)}`;
  }
  return masked;
}

function fmtMonto(n: number): string {
  return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatFecha(iso: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

// ─── Modal: Editar datos bancarios ───────────────────────────────────────

function EditarBancariosModal({
  datos,
  onClose,
  onSuccess,
}: {
  datos: DatosBancarios;
  onClose: () => void;
  onSuccess: (d: DatosBancarios) => void;
}) {
  const [form, setForm] = useState<DatosBancarios>({ ...datos });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(k: keyof DatosBancarios, v: string) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function handleSave() {
    if (!form.banco.trim() || !form.titular.trim() || !form.clabe.trim()) {
      setError('Banco, titular y CLABE son requeridos.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const r = await fetch('/api/admin/configuracion/datos-bancarios', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.message ?? 'Error al guardar.');
      }
      onSuccess(form);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar datos bancarios.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(42,42,42,0.75)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ background: '#6B1530', color: 'white' }}
        >
          <h3 className="font-semibold text-base" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Editar datos bancarios
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center hover:opacity-80"
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', color: 'white' }}
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-stone-500 block mb-1">Banco *</label>
            <input
              className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#6B1530]"
              value={form.banco}
              onChange={(e) => set('banco', e.target.value)}
              placeholder="Ej. BBVA Bancomer"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-stone-500 block mb-1">Titular de la cuenta *</label>
            <input
              className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#6B1530]"
              value={form.titular}
              onChange={(e) => set('titular', e.target.value)}
              placeholder="Nombre completo del titular"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-stone-500 block mb-1">CLABE interbancaria *</label>
            <input
              className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#6B1530] font-mono"
              value={form.clabe}
              onChange={(e) => set('clabe', e.target.value.replace(/\D/g, '').slice(0, 18))}
              placeholder="18 digitos"
              maxLength={18}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-stone-500 block mb-1">RFC</label>
            <input
              className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#6B1530] uppercase"
              value={form.rfc}
              onChange={(e) => set('rfc', e.target.value.toUpperCase())}
              placeholder="RFC del titular o institucion"
              maxLength={20}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-stone-500 block mb-1">Concepto de pago</label>
            <input
              className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#6B1530]"
              value={form.concepto}
              onChange={(e) => set('concepto', e.target.value)}
              placeholder="Ej. Inscripcion Preparatoria Abierta Michoacan"
            />
          </div>

          {error && <p className="text-xs font-medium" style={{ color: '#b91c1c' }}>{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold border border-stone-200 rounded-lg hover:bg-stone-50"
              style={{ color: '#443e39' }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50"
              style={{ background: '#6B1530' }}
            >
              {saving
                ? <RefreshCw size={14} strokeWidth={2} className="animate-spin" />
                : <Save size={14} strokeWidth={2} />}
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Section A: Cuenta bancaria ──────────────────────────────────────────

function CuentaBancaria({ onDirty }: { onDirty: (d: boolean) => void }) {
  const [datos, setDatos] = useState<DatosBancarios | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    fetch('/api/admin/configuracion/datos-bancarios', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setDatos(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="rounded-xl overflow-hidden border border-stone-200 mb-5" style={{ background: 'white' }}>
        <div className="px-5 py-3" style={{ background: '#6B1530' }}>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Banknote size={14} strokeWidth={2} /> Cuenta bancaria institucional
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-10">
            <RefreshCw size={20} className="animate-spin" style={{ color: '#6B1530' }} />
          </div>
        ) : (
          <div className="p-5">
            {/* Gradient display card */}
            <div
              className="rounded-xl p-5 mb-4 text-white"
              style={{
                background: 'linear-gradient(135deg, #6B1530 0%, #3d0822 100%)',
                boxShadow: '0 4px 16px rgba(107,15,60,0.25)',
              }}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-[10px] uppercase tracking-widest opacity-70 mb-0.5">Banco</div>
                  <div className="text-base font-bold" style={{ fontFamily: "'Poppins', sans-serif" }}>
                    {datos?.banco || <span style={{ opacity: 0.5 }}>Sin configurar</span>}
                  </div>
                </div>
                <CreditCard size={22} strokeWidth={2} style={{ opacity: 0.6 }} />
              </div>

              {/* CLABE */}
              <div className="mb-4">
                <div className="text-[10px] uppercase tracking-widest opacity-70 mb-0.5">CLABE interbancaria</div>
                <div className="font-mono text-lg tracking-wider">
                  {datos?.clabe ? maskClabe(datos.clabe) : <span style={{ opacity: 0.5 }}>No configurada</span>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-widest opacity-70 mb-0.5">Titular</div>
                  <div className="text-sm font-medium truncate">{datos?.titular || '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest opacity-70 mb-0.5">RFC</div>
                  <div className="text-sm font-mono">{datos?.rfc || '—'}</div>
                </div>
              </div>

              {datos?.concepto && (
                <div className="mt-3 pt-3 border-t border-white/20">
                  <div className="text-[10px] uppercase tracking-widest opacity-70 mb-0.5">Concepto</div>
                  <div className="text-sm">{datos.concepto}</div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg text-white"
              style={{ background: '#6B1530' }}
            >
              <Edit2 size={14} strokeWidth={2} /> Editar datos bancarios
            </button>
          </div>
        )}
      </div>

      {modalOpen && datos && (
        <EditarBancariosModal
          datos={datos}
          onClose={() => setModalOpen(false)}
          onSuccess={(updated) => {
            setDatos(updated);
            setModalOpen(false);
            onDirty(false);
          }}
        />
      )}

      {modalOpen && !datos && (
        <EditarBancariosModal
          datos={{ banco: '', titular: '', clabe: '', rfc: '', concepto: '' }}
          onClose={() => setModalOpen(false)}
          onSuccess={(updated) => {
            setDatos(updated);
            setModalOpen(false);
            onDirty(false);
          }}
        />
      )}
    </>
  );
}

// ─── Inline editable monto cell ───────────────────────────────────────────

function MontoCell({
  concepto,
  onSaved,
}: {
  concepto: ConceptoPago;
  onSaved: (id: number, monto: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(concepto.monto));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  async function handleSave() {
    const n = parseFloat(draft);
    if (isNaN(n) || n < 0) { setError(true); return; }
    setSaving(true);
    setError(false);
    try {
      const r = await fetch(`/api/admin/configuracion/conceptos-pago/${concepto.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monto: n }),
      });
      if (!r.ok) throw new Error();
      onSaved(concepto.id, n);
      setEditing(false);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setDraft(String(concepto.monto));
    setEditing(false);
    setError(false);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="group flex items-center gap-1.5 text-sm font-mono hover:opacity-70 transition-opacity"
        style={{ color: '#2a2a2a', background: 'none', border: 'none', cursor: 'pointer' }}
        title="Clic para editar"
      >
        {fmtMonto(concepto.monto)}
        <Edit2 size={11} strokeWidth={2} className="opacity-0 group-hover:opacity-50 transition-opacity" style={{ color: '#6B1530' }} />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min="0"
        step="0.01"
        className="w-24 text-sm border rounded-lg px-2 py-1 font-mono focus:outline-none"
        style={{
          borderColor: error ? '#b91c1c' : '#6B1530',
        }}
        value={draft}
        onChange={(e) => { setDraft(e.target.value); setError(false); }}
        autoFocus
        onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel(); }}
      />
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-6 h-6 flex items-center justify-center rounded disabled:opacity-50"
        style={{ background: '#6B1530', color: 'white', border: 'none', cursor: 'pointer' }}
      >
        {saving ? <RefreshCw size={11} strokeWidth={2} className="animate-spin" /> : <Check size={11} strokeWidth={2} />}
      </button>
      <button
        type="button"
        onClick={handleCancel}
        className="w-6 h-6 flex items-center justify-center rounded"
        style={{ background: '#f7f2ed', color: '#443e39', border: 'none', cursor: 'pointer' }}
      >
        <X size={11} strokeWidth={2} />
      </button>
    </div>
  );
}

// ─── Section B: Conceptos de pago ────────────────────────────────────────

function ConceptosPago({ onDirty }: { onDirty: (d: boolean) => void }) {
  const [conceptos, setConceptos] = useState<ConceptoPago[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/configuracion/conceptos-pago', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setConceptos(d.conceptos ?? d ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleSaved(id: number, monto: number) {
    setConceptos((prev) => prev.map((c) => c.id === id ? { ...c, monto } : c));
    onDirty(false);
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden mb-5">
      <div className="px-5 py-3" style={{ background: '#6B1530' }}>
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <DollarSign size={14} strokeWidth={2} /> Montos por concepto
        </h2>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-10">
          <RefreshCw size={20} className="animate-spin" style={{ color: '#6B1530' }} />
        </div>
      ) : conceptos.length === 0 ? (
        <div className="p-6 text-sm text-center" style={{ color: '#6b635e' }}>
          No hay conceptos de pago configurados.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100" style={{ background: '#fafaf9' }}>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#6b635e' }}>
                  Concepto
                </th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#6b635e' }}>
                  Monto MXN
                </th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#6b635e' }}>
                  Vigencia
                </th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#6b635e' }}>
                  Activo
                </th>
              </tr>
            </thead>
            <tbody>
              {conceptos.map((c) => (
                <tr key={c.id} className="border-b border-stone-50 last:border-b-0">
                  <td className="px-5 py-3 font-medium" style={{ color: '#2a2a2a' }}>
                    {c.concepto}
                  </td>
                  <td className="px-5 py-3">
                    <MontoCell concepto={c} onSaved={handleSaved} />
                  </td>
                  <td className="px-5 py-3 text-sm" style={{ color: '#6b635e' }}>
                    {formatFecha(c.vigencia)}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                      style={
                        c.activo
                          ? { background: '#d1fae5', color: '#2d7d46' }
                          : { background: '#f7f2ed', color: '#6b635e' }
                      }
                    >
                      {c.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-5 py-3 text-[11px]" style={{ color: '#a89a8e' }}>
            Haz clic en el monto para editarlo directamente. Presiona Enter para guardar o Escape para cancelar.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Section C: Historial de cambios ─────────────────────────────────────

function HistorialCambios() {
  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden mb-5">
      <div className="px-5 py-3" style={{ background: '#6B1530' }}>
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <History size={14} strokeWidth={2} /> Historial de cambios
        </h2>
      </div>
      <div className="p-5">
        <div
          className="flex items-center gap-2.5 px-4 py-3 rounded-lg text-sm"
          style={{ background: '#f7f2ed', color: '#6b635e' }}
        >
          <History size={14} strokeWidth={2} style={{ flexShrink: 0, color: '#a89a8e' }} />
          El historial de cambios en conceptos de pago se registra en la bitacora del sistema. Consulta la seccion
          de reportes o exporta la bitacora desde el modulo de administracion para ver el registro completo.
        </div>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────

export default function Pagos({ onDirty }: { onDirty: (d: boolean) => void }) {
  return (
    <div>
      <CuentaBancaria onDirty={onDirty} />
      <ConceptosPago onDirty={onDirty} />
      <HistorialCambios />
    </div>
  );
}
