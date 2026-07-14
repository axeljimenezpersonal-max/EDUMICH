import { useEffect, useState, useRef } from 'react';
import { Mail, Search, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { api } from '../../lib/api';
import { parseDbDate } from '../../lib/fechas';

const GUINDA = '#6B1530';

interface OutboxRow {
  id: number;
  toEmail: string;
  toName: string | null;
  ccEmail: string | null;
  fromEmail: string;
  fromName: string;
  subject: string;
  html: string;
  evento: string;
  estado: 'pendiente' | 'enviado' | 'fallido' | 'demo_mode';
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  sentAt: string | null;
}

interface OutboxResponse {
  rows: OutboxRow[];
  pagination: { page: number; perPage: number; total: number; totalPages: number };
}

const EVENTO_LABELS: Record<string, string> = {
  cuenta_creada_alumno: 'Bienvenida alumno',
  cuenta_creada_gestor: 'Bienvenida gestor',
  autoregistro_alumno: 'Confirmación solicitud',
  notificacion_admin_autoregistro: 'Alerta admin',
  aviso_eliminacion_cuenta: 'Aviso eliminación',
  recuperar_password: 'Recuperar contraseña',
  verificacion_email: 'Verificación email',
};

const ESTADO_STYLES: Record<string, { bg: string; color: string; border: string; label: string }> = {
  demo_mode: { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0', label: 'Demo' },
  enviado:   { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', label: 'Enviado' },
  fallido:   { bg: '#fff1f2', color: '#991b1b', border: '#fca5a5', label: 'Fallido' },
  pendiente: { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa', label: 'Pendiente' },
};

function tiempoRelativo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  return `Hace ${days} día${days !== 1 ? 's' : ''}`;
}

export default function CorreosEnviados() {
  const [data, setData] = useState<OutboxResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<OutboxRow | null>(null);
  const [page, setPage] = useState(1);
  const [evento, setEvento] = useState('');
  const [estado, setEstado] = useState('');
  const [q, setQ] = useState('');
  const [qInput, setQInput] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function fetchData(p = page, ev = evento, es = estado, search = q) {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), perPage: '25' });
    if (ev) params.set('evento', ev);
    if (es) params.set('estado', es);
    if (search) params.set('q', search);
    api.get<OutboxResponse>(`/admin/outbox?${params}`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchData(); }, []);

  function handleEvento(v: string) {
    setEvento(v); setPage(1); fetchData(1, v, estado, q);
  }
  function handleEstado(v: string) {
    setEstado(v); setPage(1); fetchData(1, evento, v, q);
  }
  function handleSearch(v: string) {
    setQInput(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setQ(v); setPage(1); fetchData(1, evento, estado, v);
    }, 300);
  }
  function handlePage(p: number) {
    setPage(p); fetchData(p, evento, estado, q);
  }

  const rows = data?.rows ?? [];
  const pagination = data?.pagination;

  return (
    <AdminLayout>
      <div style={{ fontFamily: "'Poppins', sans-serif" }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1c1917', margin: 0, fontFamily: "'Lora', Georgia, serif" }}>
            Correos enviados
          </h1>
          <p style={{ fontSize: 13, color: '#6b635e', margin: '4px 0 0 0' }}>
            Historial de notificaciones enviadas o guardadas en modo demo
          </p>
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <select
            value={evento}
            onChange={e => handleEvento(e.target.value)}
            style={{ fontSize: 13, padding: '6px 10px', border: '1px solid #eadfd7', borderRadius: 6, background: '#fff', color: '#443e39' }}
          >
            <option value="">Todos los eventos</option>
            {Object.entries(EVENTO_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={estado}
            onChange={e => handleEstado(e.target.value)}
            style={{ fontSize: 13, padding: '6px 10px', border: '1px solid #eadfd7', borderRadius: 6, background: '#fff', color: '#443e39' }}
          >
            <option value="">Todos los estados</option>
            <option value="demo_mode">Demo</option>
            <option value="enviado">Enviado</option>
            <option value="fallido">Fallido</option>
            <option value="pendiente">Pendiente</option>
          </select>
          <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
            <Search size={14} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#a89a8e' }} />
            <input
              type="text"
              placeholder="Buscar por email o asunto..."
              value={qInput}
              onChange={e => handleSearch(e.target.value)}
              style={{ width: '100%', fontSize: 13, padding: '6px 10px 6px 30px', border: '1px solid #eadfd7', borderRadius: 6, background: '#fff', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        {/* Body: lista + preview */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          {/* Lista */}
          <div style={{ width: '40%', flexShrink: 0 }}>
            <div style={{ background: '#fff', border: '1px solid #eadfd7', borderRadius: 8, overflow: 'hidden' }}>
              {loading ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: '#a89a8e', fontSize: 13 }}>Cargando...</div>
              ) : rows.length === 0 ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: '#a89a8e', fontSize: 13 }}>
                  <Mail size={32} style={{ color: '#ddd0c5', marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
                  Sin correos
                </div>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {rows.map((row, i) => {
                    const isSelected = selected?.id === row.id;
                    const estadoStyle = ESTADO_STYLES[row.estado] ?? ESTADO_STYLES.pendiente;
                    return (
                      <li
                        key={row.id}
                        onClick={() => setSelected(row)}
                        style={{
                          padding: '12px 14px',
                          borderBottom: i < rows.length - 1 ? '1px solid #f7f2ed' : 'none',
                          borderLeft: isSelected ? `3px solid ${GUINDA}` : '3px solid transparent',
                          background: isSelected ? '#fdf6fa' : '#fff',
                          cursor: 'pointer',
                          transition: 'background 0.1s',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#1c1917', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {row.toName || row.toEmail}
                            </div>
                            <div style={{ fontSize: 11, color: '#6b635e', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {row.toEmail}
                            </div>
                            <div style={{ fontSize: 11, color: GUINDA, fontWeight: 600 }}>
                              {EVENTO_LABELS[row.evento] ?? row.evento}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <span style={{ fontSize: 10, background: estadoStyle.bg, color: estadoStyle.color, border: `1px solid ${estadoStyle.border}`, padding: '2px 6px', borderRadius: 4, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                              {estadoStyle.label}
                            </span>
                            <span style={{ fontSize: 10, color: '#a89a8e' }}>
                              {tiempoRelativo(row.createdAt)}
                            </span>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Paginación */}
            {pagination && pagination.totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: '#6b635e' }}>
                <span>{pagination.total} correos · Pág. {pagination.page}/{pagination.totalPages}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    onClick={() => handlePage(page - 1)}
                    disabled={page === 1}
                    style={{ padding: '4px 8px', border: '1px solid #eadfd7', borderRadius: 4, background: '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer', color: page === 1 ? '#ddd0c5' : '#443e39' }}
                  >
                    <ChevronLeft size={13} />
                  </button>
                  <button
                    onClick={() => handlePage(page + 1)}
                    disabled={page >= (pagination.totalPages ?? 1)}
                    style={{ padding: '4px 8px', border: '1px solid #eadfd7', borderRadius: 4, background: '#fff', cursor: page >= pagination.totalPages ? 'not-allowed' : 'pointer', color: page >= pagination.totalPages ? '#ddd0c5' : '#443e39' }}
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Preview */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {selected ? (
              <div style={{ background: '#fff', border: '1px solid #eadfd7', borderRadius: 8, overflow: 'hidden' }}>
                {/* Meta del correo */}
                <div style={{ padding: '14px 18px', borderBottom: '1px solid #f7f2ed', background: '#fafaf9' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <tbody>
                      {[
                        ['De', `${selected.fromName} <${selected.fromEmail}>`],
                        ['Para', `${selected.toName ? selected.toName + ' ' : ''}<${selected.toEmail}>`],
                        ...(selected.ccEmail ? [['CC', selected.ccEmail]] : []),
                        ['Asunto', selected.subject],
                        ['Evento', EVENTO_LABELS[selected.evento] ?? selected.evento],
                        ['Fecha', parseDbDate(selected.createdAt).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Mexico_City' })],
                      ].map(([label, value]) => (
                        <tr key={label}>
                          <td style={{ color: '#6b635e', fontWeight: 700, paddingRight: 12, paddingBottom: 4, whiteSpace: 'nowrap', width: 60, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 10 }}>{label}</td>
                          <td style={{ color: '#1c1917', paddingBottom: 4 }}>{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {selected.estado === 'fallido' && selected.errorMessage && (
                    <div style={{ marginTop: 8, padding: '8px 12px', background: '#fff1f2', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 12, color: '#991b1b', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                      <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                      <span>Error: {selected.errorMessage}</span>
                    </div>
                  )}
                </div>
                {/* iframe con el HTML del correo */}
                <iframe
                  srcDoc={selected.html}
                  sandbox=""
                  style={{ width: '100%', height: 520, border: 'none', display: 'block' }}
                  title={`Preview: ${selected.subject}`}
                />
              </div>
            ) : (
              <div style={{ background: '#fff', border: '1px solid #eadfd7', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 400, color: '#a89a8e' }}>
                <Mail size={40} style={{ color: '#eadfd7', marginBottom: 12 }} />
                <p style={{ fontSize: 14, margin: 0 }}>Selecciona un correo para ver el preview</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
