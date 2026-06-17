import { useEffect, useState, useCallback } from 'react';
import {
  ShieldCheck, AlertTriangle, Trash2, RotateCcw, Clock,
  Info, RefreshCw, ChevronLeft, ChevronRight, X, Check,
} from 'lucide-react';
import { api } from '../../../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────

type Stats = {
  activas: number;
  avisoEnviado: number;
  softDeleted: number;
  totalDepuradas: number;
};

type EnRiesgo = {
  id: number;
  nombreCompleto: string;
  email: string;
  municipio: string | null;
  diasInactivo: number;
  avisoEnviadoEn: string | null;
  eliminacionEn: string | null;
  diasParaEliminar: number;
};

type SoftDeleted = {
  id: number;
  folio: string;
  municipio: string | null;
  softDeletedEn: string | null;
  hardDeleteEn: string | null;
  diasParaHardDelete: number;
  motivo: string | null;
};

type HistorialRow = {
  id: number;
  estudianteId: number | null;
  nombreCompleto: string | null;
  municipioNombre: string | null;
  folioPreregistro: string | null;
  tipo: string;
  motivo: string;
  diasSinActividad: number | null;
  documentosTenia: number | null;
  pagosTenia: number | null;
  creadoEn: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────

function fechaCorta(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function tipoLabel(tipo: string) {
  switch (tipo) {
    case 'soft_delete': return { label: 'Soft delete', bg: '#fee2e2', color: '#991b1b' };
    case 'hard_delete': return { label: 'Hard delete', bg: '#fce7f3', color: '#9d174d' };
    case 'restauracion': return { label: 'Restauración', bg: '#d1fae5', color: '#065f46' };
    default: return { label: tipo, bg: '#f5f5f4', color: '#44403c' };
  }
}

// ── Confirm modal ─────────────────────────────────────────────────────────

function ConfirmModal({
  titulo,
  mensaje,
  onConfirm,
  onCancel,
  danger = false,
}: {
  titulo: string;
  mensaje: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{
        background: 'white', borderRadius: 12, padding: 28, maxWidth: 420, width: '90%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: '#1c1917' }}>
          {titulo}
        </h3>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: '#44403c', lineHeight: 1.6 }}>
          {mensaje}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 18px', borderRadius: 8, border: '1px solid #e7e5e4',
              background: 'white', fontSize: 13, cursor: 'pointer', color: '#44403c',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 18px', borderRadius: 8, border: 'none',
              background: danger ? '#dc2626' : '#6B1530',
              color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────

function KpiCard({ label, value, color, icon: Icon }: {
  label: string; value: number; color: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
}) {
  return (
    <div style={{
      background: 'white', border: '1px solid #e7e5e4', borderRadius: 10,
      padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10, background: `${color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={20} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 800, color: '#1c1917', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 12, color: '#78716c', marginTop: 3 }}>{label}</div>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────

export default function Depuracion() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [enRiesgo, setEnRiesgo] = useState<EnRiesgo[]>([]);
  const [softDeleted, setSoftDeleted] = useState<SoftDeleted[]>([]);
  const [historial, setHistorial] = useState<HistorialRow[]>([]);
  const [histTotal, setHistTotal] = useState(0);
  const [histPage, setHistPage] = useState(1);
  const [histTipo, setHistTipo] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirmModal, setConfirmModal] = useState<{
    titulo: string; mensaje: string; accion: () => Promise<void>; danger?: boolean;
  } | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r, sd, h] = await Promise.all([
        api.get<Stats>('/admin/depuracion/stats'),
        api.get<{ enRiesgo: EnRiesgo[] }>('/admin/depuracion/en-riesgo'),
        api.get<{ softDeleted: SoftDeleted[] }>('/admin/depuracion/soft-delete'),
        api.get<{ rows: HistorialRow[]; total: number }>(`/admin/depuracion/historial?page=${histPage}&tipo=${histTipo}`),
      ]);
      setStats(s);
      setEnRiesgo(r.enRiesgo);
      setSoftDeleted(sd.softDeleted);
      setHistorial(h.rows);
      setHistTotal(h.total);
    } catch {
      showToast('Error cargando datos', false);
    } finally {
      setLoading(false);
    }
  }, [histPage, histTipo]);

  useEffect(() => { cargar(); }, [cargar]);

  async function ejecutarAccion(accion: () => Promise<void>, titulo: string, mensaje: string, danger = false) {
    setConfirmModal({ titulo, mensaje, accion, danger });
  }

  async function confirmar() {
    if (!confirmModal) return;
    try {
      await confirmModal.accion();
      showToast('Acción completada');
      cargar();
    } catch {
      showToast('Error al ejecutar la acción', false);
    } finally {
      setConfirmModal(null);
    }
  }

  async function restaurar(id: number, nombre: string) {
    ejecutarAccion(
      () => api.post(`/admin/depuracion/${id}/restaurar`, {}),
      'Restaurar cuenta',
      `¿Restaurar la cuenta de "${nombre}"? El alumno podrá volver a iniciar sesión.`,
    );
  }

  async function forzar(id: number, nombre: string) {
    ejecutarAccion(
      () => api.post(`/admin/depuracion/${id}/forzar`, {}),
      'Forzar eliminación',
      `¿Forzar el soft delete de "${nombre}"? El alumno no podrá iniciar sesión y será borrado en 90 días.`,
      true,
    );
  }

  async function reactivar(id: number, nombre: string) {
    ejecutarAccion(
      () => api.post(`/admin/depuracion/${id}/reactivar`, {}),
      'Reactivar cuenta',
      `¿Reactivar manualmente la cuenta de "${nombre}"? Se cancelará el aviso de eliminación.`,
    );
  }

  const GUINDA = '#6B1530';

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: GUINDA, textTransform: 'uppercase', marginBottom: 6 }}>
          CONFIGURACIÓN · SISTEMA
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1c1917', margin: 0 }}>
          Depuración de cuentas
        </h1>
        <p style={{ fontSize: 13, color: '#78716c', marginTop: 6, lineHeight: 1.6 }}>
          Gestión automática de cuentas inactivas conforme a la política institucional y LGPDPPSO.
        </p>
      </div>

      {/* Card de política */}
      <div style={{
        background: 'white', border: '1px solid #e7e5e4', borderRadius: 12,
        padding: '20px 24px', marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <ShieldCheck size={18} color={GUINDA} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1c1917' }}>Política institucional de depuración</div>
            <div style={{ fontSize: 12, color: '#78716c' }}>Aprobada por la Dirección del IEMSyS · Solo lectura</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {[
            ['Días para aviso previo', '25 días sin subir docs/pagos'],
            ['Días para soft delete', '30 días sin actividad'],
            ['Días en soft delete → hard delete', '90 días adicionales (120 total)'],
            ['Cuenta como actividad', 'Subir documentos o comprobantes de pago'],
          ].map(([label, value]) => (
            <div key={label} style={{ background: '#fafaf9', borderRadius: 8, padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: '#78716c', marginBottom: 4, fontWeight: 600 }}>{label}</div>
              <div style={{ fontSize: 13, color: '#1c1917', fontWeight: 600 }}>{value}</div>
            </div>
          ))}
        </div>
        <div style={{
          marginTop: 14, background: '#fef9c3', border: '1px solid #fde047',
          borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 8,
        }}>
          <Info size={14} color='#a16207' style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12, color: '#713f12', margin: 0, lineHeight: 1.5 }}>
            Los cambios a esta política requieren autorización del Director General.
            Para solicitar un cambio, contacta a <strong>sistemas@iemsys.gob.mx</strong>
          </p>
        </div>
      </div>

      {/* KPIs */}
      {loading && !stats ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#78716c' }}>Cargando...</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
            <KpiCard label="Cuentas activas" value={stats?.activas ?? 0} color='#16a34a' icon={Check} />
            <KpiCard label="Con aviso enviado" value={stats?.avisoEnviado ?? 0} color='#d97706' icon={AlertTriangle} />
            <KpiCard label="En soft delete" value={stats?.softDeleted ?? 0} color='#dc2626' icon={Trash2} />
            <KpiCard label="Depuradas (hard delete)" value={stats?.totalDepuradas ?? 0} color='#6b7280' icon={X} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button
              onClick={cargar}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                borderRadius: 8, border: '1px solid #e7e5e4', background: 'white',
                fontSize: 12, cursor: 'pointer', color: '#44403c',
              }}
            >
              <RefreshCw size={12} /> Actualizar
            </button>
          </div>

          {/* Cuentas en riesgo */}
          <div style={{
            background: 'white', border: '1px solid #e7e5e4', borderRadius: 12,
            overflow: 'hidden', marginBottom: 24,
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f5f5f4', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={16} color='#d97706' />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1c1917' }}>
                Cuentas en riesgo de eliminación
              </span>
              <span style={{
                marginLeft: 4, background: '#fef3c7', color: '#92400e',
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
              }}>
                {enRiesgo.length}
              </span>
            </div>
            {enRiesgo.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: '#78716c', fontSize: 13 }}>
                Sin cuentas en riesgo
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#fafaf9' }}>
                    {['Alumno', 'Municipio', 'Días inactivo', 'Aviso enviado', 'Eliminación en', 'Acciones'].map((h) => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: '#78716c', borderBottom: '1px solid #f5f5f4' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {enRiesgo.map((r) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #f5f5f4' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#1c1917' }}>{r.nombreCompleto}</div>
                        <div style={{ fontSize: 11, color: '#78716c' }}>{r.email}</div>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#44403c' }}>{r.municipio ?? '—'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          background: r.diasInactivo >= 28 ? '#fee2e2' : '#fef3c7',
                          color: r.diasInactivo >= 28 ? '#991b1b' : '#92400e',
                          padding: '2px 8px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                        }}>
                          {r.diasInactivo} días
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#78716c', fontSize: 12 }}>
                        {fechaCorta(r.avisoEnviadoEn)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          background: r.diasParaEliminar <= 1 ? '#fee2e2' : '#fff7ed',
                          color: r.diasParaEliminar <= 1 ? '#991b1b' : '#c2410c',
                          padding: '2px 8px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                        }}>
                          {r.diasParaEliminar === 0 ? 'Hoy' : `${r.diasParaEliminar} días`}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => reactivar(r.id, r.nombreCompleto)}
                            style={{
                              padding: '5px 10px', borderRadius: 6, border: '1px solid #bbf7d0',
                              background: '#f0fdf4', color: '#166534', fontSize: 12, cursor: 'pointer', fontWeight: 600,
                            }}
                          >
                            Reactivar
                          </button>
                          <button
                            onClick={() => forzar(r.id, r.nombreCompleto)}
                            style={{
                              padding: '5px 10px', borderRadius: 6, border: '1px solid #fca5a5',
                              background: '#fff1f2', color: '#991b1b', fontSize: 12, cursor: 'pointer',
                            }}
                          >
                            Forzar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Cuentas en soft delete */}
          <div style={{
            background: 'white', border: '1px solid #e7e5e4', borderRadius: 12,
            overflow: 'hidden', marginBottom: 24,
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f5f5f4', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Trash2 size={16} color='#dc2626' />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1c1917' }}>
                Cuentas en soft delete (recuperables)
              </span>
              <span style={{
                marginLeft: 4, background: '#fee2e2', color: '#991b1b',
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
              }}>
                {softDeleted.length}
              </span>
            </div>
            {softDeleted.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: '#78716c', fontSize: 13 }}>
                Sin cuentas en soft delete
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#fafaf9' }}>
                    {['Folio', 'Municipio', 'Eliminada el', 'Hard delete en', 'Motivo', 'Acción'].map((h) => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: '#78716c', borderBottom: '1px solid #f5f5f4' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {softDeleted.map((r) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #f5f5f4' }}>
                      <td style={{ padding: '12px 16px', color: '#44403c', fontFamily: 'monospace', fontSize: 12 }}>
                        {r.folio}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#44403c' }}>{r.municipio ?? '—'}</td>
                      <td style={{ padding: '12px 16px', color: '#78716c', fontSize: 12 }}>{fechaCorta(r.softDeletedEn)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          background: r.diasParaHardDelete <= 7 ? '#fee2e2' : '#f5f5f4',
                          color: r.diasParaHardDelete <= 7 ? '#991b1b' : '#44403c',
                          padding: '2px 8px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                        }}>
                          {r.diasParaHardDelete} días ({fechaCorta(r.hardDeleteEn)})
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#78716c', fontSize: 12, maxWidth: 200 }}>
                        {r.motivo ?? '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <button
                          onClick={() => restaurar(r.id, r.folio)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            padding: '5px 10px', borderRadius: 6, border: '1px solid #bfdbfe',
                            background: '#eff6ff', color: '#1e40af', fontSize: 12, cursor: 'pointer', fontWeight: 600,
                          }}
                        >
                          <RotateCcw size={12} /> Restaurar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Historial */}
          <div style={{
            background: 'white', border: '1px solid #e7e5e4', borderRadius: 12,
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid #f5f5f4',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={16} color='#78716c' />
                <span style={{ fontSize: 14, fontWeight: 700, color: '#1c1917' }}>Historial de eliminaciones</span>
              </div>
              <select
                value={histTipo}
                onChange={(e) => { setHistTipo(e.target.value); setHistPage(1); }}
                style={{
                  padding: '5px 10px', borderRadius: 6, border: '1px solid #e7e5e4',
                  fontSize: 12, color: '#44403c', background: 'white',
                }}
              >
                <option value="">Todos los tipos</option>
                <option value="soft_delete">Soft delete</option>
                <option value="hard_delete">Hard delete</option>
                <option value="restauracion">Restauración</option>
              </select>
            </div>
            {historial.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: '#78716c', fontSize: 13 }}>
                Sin registros
              </div>
            ) : (
              <>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#fafaf9' }}>
                      {['Fecha', 'Tipo', 'Alumno / Folio', 'Municipio', 'Motivo', 'Días inactivo'].map((h) => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: '#78716c', borderBottom: '1px solid #f5f5f4' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {historial.map((r) => {
                      const { label, bg, color } = tipoLabel(r.tipo);
                      return (
                        <tr key={r.id} style={{ borderBottom: '1px solid #f5f5f4' }}>
                          <td style={{ padding: '10px 16px', color: '#78716c', fontSize: 12 }}>{fechaCorta(r.creadoEn)}</td>
                          <td style={{ padding: '10px 16px' }}>
                            <span style={{ background: bg, color, padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700 }}>
                              {label}
                            </span>
                          </td>
                          <td style={{ padding: '10px 16px', color: '#44403c' }}>
                            {r.nombreCompleto ?? r.folioPreregistro ?? `ID ${r.estudianteId}`}
                          </td>
                          <td style={{ padding: '10px 16px', color: '#78716c' }}>{r.municipioNombre ?? '—'}</td>
                          <td style={{ padding: '10px 16px', color: '#78716c', maxWidth: 200, fontSize: 12 }}>{r.motivo}</td>
                          <td style={{ padding: '10px 16px', color: '#44403c' }}>
                            {r.diasSinActividad !== null ? `${r.diasSinActividad} días` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Paginación */}
                {histTotal > 20 && (
                  <div style={{ padding: '12px 20px', borderTop: '1px solid #f5f5f4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: '#78716c' }}>
                      {histTotal} registros · Página {histPage}
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => setHistPage((p) => Math.max(1, p - 1))}
                        disabled={histPage === 1}
                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #e7e5e4', background: 'white', cursor: histPage === 1 ? 'not-allowed' : 'pointer', opacity: histPage === 1 ? 0.5 : 1 }}
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <button
                        onClick={() => setHistPage((p) => p + 1)}
                        disabled={histPage * 20 >= histTotal}
                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #e7e5e4', background: 'white', cursor: histPage * 20 >= histTotal ? 'not-allowed' : 'pointer', opacity: histPage * 20 >= histTotal ? 0.5 : 1 }}
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Confirm modal */}
      {confirmModal && (
        <ConfirmModal
          titulo={confirmModal.titulo}
          mensaje={confirmModal.mensaje}
          onConfirm={confirmar}
          onCancel={() => setConfirmModal(null)}
          danger={confirmModal.danger}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 2000,
          background: toast.ok ? '#1c1917' : '#dc2626',
          color: 'white', padding: '12px 20px', borderRadius: 10,
          fontSize: 13, fontWeight: 600,
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
