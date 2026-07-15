import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  User,
  X,
  RefreshCw,
  Copy,
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { api } from '../../lib/api';

interface Solicitud {
  id: number;
  nombreCompleto: string;
  curp: string;
  email: string;
  telefono: string;
  municipioId: number;
  municipioNombre: string | null;
  mensaje: string | null;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  procesadaEn: string | null;
  createdAt: string;
}

interface GestorItem {
  userId: number;
  nombreCompleto: string;
  municipioId: number;
  municipioNombre: string | null;
}

type ModalState =
  | { type: 'aprobar'; solicitud: Solicitud }
  | { type: 'rechazar'; solicitud: Solicitud }
  | null;

interface AprobarResult {
  alumno: { email: string; nombreCompleto: string };
  emailEnviado: boolean;
  modoEmail: 'dev' | 'production';
  credencialTemporal?: string;
}

export default function Solicitudes() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [gestores, setGestores] = useState<GestorItem[]>([]);
  const [modal, setModal] = useState<ModalState>(null);

  // Aprobar form
  const [gestorId, setGestorId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [aprobarResult, setAprobarResult] = useState<AprobarResult | null>(null);

  // Rechazar form
  const [motivoRechazo, setMotivoRechazo] = useState('');

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function loadSolicitudes() {
    setLoading(true);
    try {
      const r = await api.get<{ solicitudes: Solicitud[] }>('/admin/solicitudes-cuenta');
      setSolicitudes(r.solicitudes);
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    loadSolicitudes();
    api.get<{ gestores: GestorItem[] }>('/admin/gestores')
      .then((r) => setGestores(r.gestores))
      .catch(() => {});
  }, []);

  function openAprobar(s: Solicitud) {
    setGestorId('');
    setSubmitError(null);
    setAprobarResult(null);
    setModal({ type: 'aprobar', solicitud: s });
  }

  function openRechazar(s: Solicitud) {
    setMotivoRechazo('');
    setSubmitError(null);
    setModal({ type: 'rechazar', solicitud: s });
  }

  function closeModal() {
    if (submitting) return;
    setModal(null);
    setAprobarResult(null);
    setSubmitError(null);
  }

  async function handleAprobar() {
    if (!modal || modal.type !== 'aprobar') return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const body: Record<string, unknown> = {};
      if (gestorId) body.asignarGestorId = Number(gestorId);

      const r = await api.post<AprobarResult>(
        `/admin/solicitudes-cuenta/${modal.solicitud.id}/aprobar`,
        body
      );
      setAprobarResult(r);
      setSolicitudes((prev) => prev.filter((s) => s.id !== modal.solicitud.id));
      showToast(`Cuenta creada y credenciales enviadas a ${r.alumno.email}`, 'success');
    } catch (e) {
      setSubmitError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRechazar() {
    if (!modal || modal.type !== 'rechazar') return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await api.post(`/admin/solicitudes-cuenta/${modal.solicitud.id}/rechazar`, {
        motivoRechazo: motivoRechazo || undefined,
      });
      setSolicitudes((prev) => prev.filter((s) => s.id !== modal.solicitud.id));
      showToast('Solicitud rechazada', 'success');
      closeModal();
    } catch (e) {
      setSubmitError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  // Gestores filtered by municipio of the solicitud (if available)
  const gestoresFiltrados =
    modal?.type === 'aprobar' && modal.solicitud.municipioId
      ? gestores.filter((g) => g.municipioId === modal.solicitud.municipioId)
      : gestores;

  return (
    <AdminLayout>
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm max-w-sm ${
            toast.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
          <button onClick={() => setToast(null)} className="ml-2 opacity-60 hover:opacity-100"><X size={14} /></button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-bold text-stone-900">Solicitudes de cuenta</h1>
          <p className="text-sm text-stone-500 mt-0.5">Solicitudes pendientes de aprobación</p>
        </div>
        <button
          onClick={loadSolicitudes}
          className="flex items-center gap-1.5 text-sm text-stone-600 border border-stone-300 px-3 py-2 rounded-lg hover:bg-stone-50"
        >
          <RefreshCw size={13} />
          Actualizar
        </button>
      </div>

      {loading ? (
        <div className="bg-white border border-stone-200 rounded-xl p-12 text-center text-stone-400 text-sm">
          Cargando solicitudes…
        </div>
      ) : solicitudes.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl p-12 text-center">
          <CheckCircle2 size={36} className="mx-auto text-emerald-400 mb-3" />
          <div className="text-sm font-semibold text-stone-600" style={{ fontFamily: "'Poppins', sans-serif" }}>
            No hay solicitudes pendientes
          </div>
          <div className="text-xs text-stone-400 mt-1">Todas las solicitudes han sido procesadas.</div>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Solicitante</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">CURP</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider hidden md:table-cell">Municipio</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider hidden lg:table-cell">Fecha solicitud</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {solicitudes.map((s) => (
                <tr key={s.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-stone-900">{s.nombreCompleto}</div>
                    <div className="text-xs text-stone-400">{s.email}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-stone-600">{s.curp}</td>
                  <td className="px-4 py-3 text-stone-600 hidden md:table-cell">{s.municipioNombre ?? '—'}</td>
                  <td className="px-4 py-3 text-stone-500 text-xs hidden lg:table-cell">
                    {new Date(s.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => openAprobar(s)}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                      >
                        <CheckCircle2 size={12} />
                        Aprobar
                      </button>
                      <button
                        onClick={() => openRechazar(s)}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        <XCircle size={12} />
                        Rechazar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal APROBAR */}
      {modal?.type === 'aprobar' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 bg-emerald-50">
              <div className="font-semibold text-stone-900 flex items-center gap-2" style={{ fontFamily: "'Poppins', sans-serif" }}>
                <CheckCircle2 size={16} className="text-emerald-600" />
                Aprobar solicitud
              </div>
              {!submitting && (
                <button onClick={closeModal} className="p-1 rounded hover:bg-stone-100 text-stone-500">
                  <X size={18} />
                </button>
              )}
            </div>

            <div className="p-5">
              {aprobarResult ? (
                <>
                  <div className="flex items-center gap-2 text-emerald-700 mb-3">
                    <CheckCircle2 size={18} />
                    <span className="font-semibold text-sm">Cuenta creada correctamente</span>
                  </div>
                  <p className="text-sm text-stone-600 mb-3">
                    Se creó la cuenta para <strong>{aprobarResult.alumno.nombreCompleto}</strong> y se enviaron las credenciales a <strong>{aprobarResult.alumno.email}</strong>.
                  </p>
                  {aprobarResult.credencialTemporal && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                      <div className="text-xs font-semibold text-amber-800 uppercase tracking-wider mb-1">
                        Modo dev — contraseña temporal:
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-lg font-bold text-[var(--color-guinda-700)] tracking-widest">
                          {aprobarResult.credencialTemporal}
                        </code>
                        <button
                          onClick={() => navigator.clipboard.writeText(aprobarResult.credencialTemporal!)}
                          className="p-1 rounded hover:bg-amber-100 text-amber-600"
                          title="Copiar"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                  <button
                    onClick={closeModal}
                    className="w-full px-4 py-2 text-sm bg-stone-100 text-stone-700 rounded-lg hover:bg-stone-200"
                  >
                    Cerrar
                  </button>
                </>
              ) : (
                <>
                  {/* Resumen del solicitante */}
                  <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 mb-4 text-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <User size={14} className="text-stone-400" />
                      <span className="font-semibold text-stone-800">{modal.solicitud.nombreCompleto}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-xs text-stone-500">
                      <div>CURP: <span className="font-mono text-stone-700">{modal.solicitud.curp}</span></div>
                      <div>Municipio: {modal.solicitud.municipioNombre ?? '—'}</div>
                      <div className="col-span-2">Email: {modal.solicitud.email}</div>
                      {modal.solicitud.mensaje && (
                        <div className="col-span-2 mt-1 bg-white border border-stone-200 rounded p-2 text-stone-600 italic">
                          "{modal.solicitud.mensaje}"
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Asignar gestor */}
                  <div className="mb-4">
                    <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1.5">
                      Asignar gestor <span className="text-stone-400 normal-case font-normal">(opcional)</span>
                    </label>
                    <select
                      value={gestorId}
                      onChange={(e) => setGestorId(e.target.value)}
                      className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-guinda-700)]"
                    >
                      <option value="">— Sin gestor asignado —</option>
                      {gestoresFiltrados.length > 0 && (
                        <optgroup label={`Gestores de ${modal.solicitud.municipioNombre ?? 'este municipio'}`}>
                          {gestoresFiltrados.map((g) => (
                            <option key={g.userId} value={g.userId}>
                              {g.nombreCompleto} — {g.municipioNombre}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {gestoresFiltrados.length < gestores.length && (
                        <optgroup label="Otros municipios">
                          {gestores.filter((g) => g.municipioId !== modal.solicitud.municipioId).map((g) => (
                            <option key={g.userId} value={g.userId}>
                              {g.nombreCompleto} — {g.municipioNombre}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>

                  {submitError && (
                    <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                      <AlertCircle size={13} className="mt-0.5 shrink-0" />
                      {submitError}
                    </div>
                  )}

                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={closeModal}
                      disabled={submitting}
                      className="px-4 py-2 text-sm text-stone-600 border border-stone-300 rounded-lg hover:bg-stone-50 disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleAprobar}
                      disabled={submitting}
                      className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <CheckCircle2 size={13} />
                      {submitting ? 'Creando cuenta…' : 'Aprobar y crear cuenta'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal RECHAZAR */}
      {modal?.type === 'rechazar' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 bg-red-50">
              <div className="font-semibold text-stone-900 flex items-center gap-2" style={{ fontFamily: "'Poppins', sans-serif" }}>
                <XCircle size={16} className="text-red-500" />
                Rechazar solicitud
              </div>
              {!submitting && (
                <button onClick={closeModal} className="p-1 rounded hover:bg-stone-100 text-stone-500">
                  <X size={18} />
                </button>
              )}
            </div>

            <div className="p-5">
              <p className="text-sm text-stone-700 mb-1">
                ¿Rechazar la solicitud de <strong>{modal.solicitud.nombreCompleto}</strong>?
              </p>
              <p className="text-xs text-stone-500 mb-4">
                El solicitante no será notificado automáticamente por ahora.
              </p>

              <div className="mb-4">
                <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1.5">
                  Motivo del rechazo <span className="text-stone-400 normal-case font-normal">(opcional, uso interno)</span>
                </label>
                <textarea
                  value={motivoRechazo}
                  onChange={(e) => setMotivoRechazo(e.target.value)}
                  rows={3}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                  placeholder="Ej: CURP no coincide con documentos, solicitud duplicada…"
                />
              </div>

              {submitError && (
                <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <AlertCircle size={13} className="mt-0.5 shrink-0" />
                  {submitError}
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <button
                  onClick={closeModal}
                  disabled={submitting}
                  className="px-4 py-2 text-sm text-stone-600 border border-stone-300 rounded-lg hover:bg-stone-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRechazar}
                  disabled={submitting}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <XCircle size={13} />
                  {submitting ? 'Rechazando…' : 'Rechazar solicitud'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
