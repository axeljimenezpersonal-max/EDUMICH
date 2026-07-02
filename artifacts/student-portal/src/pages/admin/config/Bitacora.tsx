import { useEffect, useState, useCallback } from 'react';
import {
  Search, X, Download, ChevronLeft, ChevronRight, RefreshCw,
  ClipboardList, Filter,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────

type Accion =
  | 'CREATE' | 'UPDATE' | 'DELETE'
  | 'LOGIN' | 'LOGOUT'
  | 'APROBAR' | 'RECHAZAR'
  | 'PUBLICAR' | 'ARCHIVAR'
  | 'EXPORTAR';

type Entidad =
  | 'estudiante' | 'gestor' | 'documento' | 'pago' | 'anuncio'
  | 'configuracion' | 'reporte' | 'matricula' | 'plantilla_correo';

type Rol = 'admin' | 'gestor' | 'estudiante';

type BitacoraRow = {
  id: number;
  createdAt: string;
  userNombre: string;
  userRol: Rol;
  userId: number;
  accion: Accion;
  entidad: Entidad;
  detalle: string;
  ip: string;
  metadata?: Record<string, unknown> | null;
};

type BitacoraResp = {
  rows: BitacoraRow[];
  total: number;
  page: number;
  totalPages: number;
};

// ─── Constants ────────────────────────────────────────────────────────────

const ACCIONES: { value: string; label: string }[] = [
  { value: '', label: 'Todas las acciones' },
  { value: 'CREATE', label: 'CREATE' },
  { value: 'UPDATE', label: 'UPDATE' },
  { value: 'DELETE', label: 'DELETE' },
  { value: 'LOGIN', label: 'LOGIN' },
  { value: 'LOGOUT', label: 'LOGOUT' },
  { value: 'APROBAR', label: 'APROBAR' },
  { value: 'RECHAZAR', label: 'RECHAZAR' },
  { value: 'PUBLICAR', label: 'PUBLICAR' },
  { value: 'ARCHIVAR', label: 'ARCHIVAR' },
  { value: 'EXPORTAR', label: 'EXPORTAR' },
];

const ENTIDADES: { value: string; label: string }[] = [
  { value: '', label: 'Todas las entidades' },
  { value: 'estudiante', label: 'Estudiante' },
  { value: 'gestor', label: 'Gestor' },
  { value: 'documento', label: 'Documento' },
  { value: 'pago', label: 'Pago' },
  { value: 'anuncio', label: 'Anuncio' },
  { value: 'configuracion', label: 'Configuracion' },
  { value: 'reporte', label: 'Reporte' },
  { value: 'matricula', label: 'Matricula' },
  { value: 'plantilla_correo', label: 'Plantilla Correo' },
];

// ─── Style helpers ────────────────────────────────────────────────────────

function accionStyle(accion: Accion): React.CSSProperties {
  switch (accion) {
    case 'CREATE': return { background: '#d1fae5', color: '#065f46' };
    case 'UPDATE': return { background: '#e0f2fe', color: '#075985' };
    case 'DELETE': return { background: '#fee2e2', color: '#991b1b' };
    case 'LOGIN':
    case 'LOGOUT': return { background: '#f7f2ed', color: '#443e39' };
    case 'APROBAR': return { background: '#dcfce7', color: '#166534' };
    case 'RECHAZAR': return { background: '#fee2e2', color: '#991b1b' };
    case 'PUBLICAR':
    case 'ARCHIVAR': return { background: '#fef9c3', color: '#92400e' };
    case 'EXPORTAR': return { background: '#ede9fe', color: '#5b21b6' };
    default: return { background: '#f7f2ed', color: '#443e39' };
  }
}

function rolStyle(rol: Rol): React.CSSProperties {
  switch (rol) {
    case 'admin': return { background: '#f5e6ef', color: '#6B1530' };
    case 'gestor': return { background: '#dbeafe', color: '#1e40af' };
    case 'estudiante': return { background: '#d1fae5', color: '#2d7d46' };
  }
}

function maskIp(ip: string): string {
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.x.x`;
  }
  return ip;
}

// ─── Date/time formatting ─────────────────────────────────────────────────

function formatDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const time = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  return { date, time };
}

// ─── Detail modal ─────────────────────────────────────────────────────────

function DetailModal({ row, onClose }: { row: BitacoraRow; onClose: () => void }) {
  const { date, time } = formatDateTime(row.createdAt);
  const meta = row.metadata;
  const hasAntesDespues = meta && typeof meta === 'object' && ('antes' in meta || 'despues' in meta);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-stone-200 flex-shrink-0" style={{ background: '#6B1530' }}>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <ClipboardList size={14} strokeWidth={2} />
            Detalle del registro
          </h3>
          <button type="button" onClick={onClose} className="text-white/70 hover:text-white">
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Main fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">Fecha / Hora</div>
              <div className="text-sm font-mono text-stone-700">{date} {time}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">IP</div>
              <div className="text-sm font-mono text-stone-700">{maskIp(row.ip)}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">Usuario</div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-stone-700">{row.userNombre}</span>
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
                  style={rolStyle(row.userRol)}
                >
                  {row.userRol}
                </span>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">User ID</div>
              <div className="text-sm font-mono text-stone-700">#{row.userId}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">Accion</div>
              <span
                className="inline-block px-2 py-0.5 rounded text-[11px] font-bold"
                style={accionStyle(row.accion)}
              >
                {row.accion}
              </span>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">Entidad</div>
              <span
                className="inline-block px-2 py-0.5 rounded text-[11px] font-medium"
                style={{ background: '#f7f2ed', color: '#443e39' }}
              >
                {row.entidad}
              </span>
            </div>
            <div className="col-span-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">Detalle</div>
              <div className="text-sm text-stone-700">{row.detalle}</div>
            </div>
          </div>

          {/* Metadata */}
          {meta && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-2">Metadata</div>

              {hasAntesDespues ? (
                <div className="border border-stone-200 rounded-lg overflow-hidden">
                  <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <div className="border-r border-stone-200">
                      <div
                        className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider"
                        style={{ background: '#fee2e2', color: '#991b1b' }}
                      >
                        Antes
                      </div>
                      <pre className="text-[11px] font-mono p-3 overflow-auto max-h-48 text-stone-600 whitespace-pre-wrap">
                        {JSON.stringify((meta as Record<string, unknown>).antes, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <div
                        className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider"
                        style={{ background: '#d1fae5', color: '#065f46' }}
                      >
                        Despues
                      </div>
                      <pre className="text-[11px] font-mono p-3 overflow-auto max-h-48 text-stone-600 whitespace-pre-wrap">
                        {JSON.stringify((meta as Record<string, unknown>).despues, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              ) : (
                <pre
                  className="text-[11px] font-mono p-3 rounded-lg border border-stone-200 overflow-auto max-h-48 text-stone-600 whitespace-pre-wrap"
                  style={{ background: '#fafaf9' }}
                >
                  {JSON.stringify(meta, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────

export default function Bitacora({ onDirty: _onDirty }: { onDirty?: (d: boolean) => void }) {
  const [rows, setRows] = useState<BitacoraRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // Filters
  const [buscar, setBuscar] = useState('');
  const [accion, setAccion] = useState('');
  const [entidad, setEntidad] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  // Detail modal
  const [detailRow, setDetailRow] = useState<BitacoraRow | null>(null);

  const LIMIT = 50;

  const load = useCallback(
    async (p: number) => {
      setLoading(true);
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
      if (buscar.trim()) params.set('buscar', buscar.trim());
      if (accion) params.set('accion', accion);
      if (entidad) params.set('entidad', entidad);
      if (fechaInicio) params.set('fechaInicio', fechaInicio);
      if (fechaFin) params.set('fechaFin', fechaFin);

      try {
        const res = await fetch(`/api/admin/configuracion/bitacora?${params}`, { credentials: 'include' });
        if (!res.ok) throw new Error();
        const data: BitacoraResp = await res.json();
        setRows(data.rows);
        setTotal(data.total);
        setTotalPages(data.totalPages);
        setPage(data.page);
      } catch {
        // silent fail: show empty state
        setRows([]);
        setTotal(0);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    },
    [buscar, accion, entidad, fechaInicio, fechaFin],
  );

  useEffect(() => {
    setPage(1);
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscar, accion, entidad, fechaInicio, fechaFin]);

  function handlePageChange(newPage: number) {
    if (newPage < 1 || newPage > totalPages) return;
    load(newPage);
  }

  function handleClear() {
    setBuscar('');
    setAccion('');
    setEntidad('');
    setFechaInicio('');
    setFechaFin('');
  }

  function exportCsv() {
    const csvContent = [
      ['Fecha', 'Hora', 'Usuario', 'Rol', 'Accion', 'Entidad', 'Detalle', 'IP'].join(','),
      ...rows.map((r) => {
        const { date, time } = formatDateTime(r.createdAt);
        return [date, time, r.userNombre, r.userRol, r.accion, r.entidad, r.detalle, r.ip]
          .map((v) => `"${(v ?? '').toString().replace(/"/g, '""')}"`)
          .join(',');
      }),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bitacora-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const hasFilters = !!(buscar || accion || entidad || fechaInicio || fechaFin);

  return (
    <div>
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3 flex items-center justify-between" style={{ background: '#6B1530' }}>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <ClipboardList size={14} strokeWidth={2} />
            Bitacora de actividad
          </h2>
          <button
            type="button"
            onClick={exportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border border-white/30 text-white/80 hover:bg-white/10"
          >
            <Download size={12} strokeWidth={2} />
            Exportar CSV
          </button>
        </div>

        {/* Filters */}
        <div className="px-4 py-3 border-b border-stone-200 bg-stone-50 flex flex-wrap items-center gap-2">
          <Filter size={13} strokeWidth={2} className="text-stone-400 flex-shrink-0" />

          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-stone-200 rounded-lg focus:outline-none focus:border-[#6B1530]"
              placeholder="Buscar detalle, usuario..."
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
            />
          </div>

          {/* Accion dropdown */}
          <select
            className="text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#6B1530] bg-white"
            value={accion}
            onChange={(e) => setAccion(e.target.value)}
          >
            {ACCIONES.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>

          {/* Entidad dropdown */}
          <select
            className="text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#6B1530] bg-white"
            value={entidad}
            onChange={(e) => setEntidad(e.target.value)}
          >
            {ENTIDADES.map((e) => (
              <option key={e.value} value={e.value}>{e.label}</option>
            ))}
          </select>

          {/* Date range */}
          <input
            type="date"
            className="text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#6B1530] bg-white"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            title="Fecha inicio"
          />
          <input
            type="date"
            className="text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#6B1530] bg-white"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            title="Fecha fin"
          />

          {/* Clear */}
          {hasFilters && (
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-100"
            >
              <X size={11} strokeWidth={2} />
              Limpiar
            </button>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: '#fafaf9' }}>
                <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-stone-400 whitespace-nowrap border-b border-stone-100">
                  Fecha / Hora
                </th>
                <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-stone-400 whitespace-nowrap border-b border-stone-100">
                  Usuario
                </th>
                <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-stone-400 whitespace-nowrap border-b border-stone-100">
                  Accion
                </th>
                <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-stone-400 whitespace-nowrap border-b border-stone-100">
                  Entidad
                </th>
                <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-stone-400 border-b border-stone-100">
                  Detalle
                </th>
                <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-stone-400 whitespace-nowrap border-b border-stone-100">
                  IP
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <RefreshCw size={18} className="animate-spin mx-auto" style={{ color: '#6B1530' }} />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-stone-400 text-sm">
                    No se encontraron registros con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const { date, time } = formatDateTime(row.createdAt);
                  const detalleTruncado = row.detalle.length > 80 ? row.detalle.slice(0, 80) + '...' : row.detalle;
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-stone-100 hover:bg-stone-50 cursor-pointer transition-colors"
                      onClick={() => setDetailRow(row)}
                    >
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="font-mono text-stone-700">{date}</div>
                        <div className="font-mono text-stone-400">{time}</div>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="font-medium text-stone-700">{row.userNombre}</div>
                        <span
                          className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase mt-0.5"
                          style={rolStyle(row.userRol)}
                        >
                          {row.userRol}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span
                          className="inline-block px-2 py-0.5 rounded font-bold uppercase tracking-wide"
                          style={{ fontSize: 10, ...accionStyle(row.accion) }}
                        >
                          {row.accion}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span
                          className="inline-block px-2 py-0.5 rounded font-medium"
                          style={{ fontSize: 10, background: '#f7f2ed', color: '#443e39' }}
                        >
                          {row.entidad}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 max-w-[260px]">
                        <span
                          className="text-stone-600"
                          title={row.detalle}
                        >
                          {detalleTruncado}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap font-mono text-stone-400">
                        {maskIp(row.ip)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div
          className="flex items-center justify-between px-4 py-3 border-t border-stone-100"
          style={{ background: '#fafaf9' }}
        >
          <span className="text-xs text-stone-500">
            Pagina <strong>{page}</strong> de <strong>{totalPages}</strong> &middot;{' '}
            <strong>{total}</strong> registros totales
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1 || loading}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={12} strokeWidth={2} />
              Anterior
            </button>
            <button
              type="button"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages || loading}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Siguiente
              <ChevronRight size={12} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      {/* Detail modal */}
      {detailRow && <DetailModal row={detailRow} onClose={() => setDetailRow(null)} />}
    </div>
  );
}
