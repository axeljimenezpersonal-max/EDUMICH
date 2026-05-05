import { useState, useCallback } from 'react';
import {
  BarChart2, Users, FileText, DollarSign, GraduationCap,
  UserCheck, Calendar, Inbox, TrendingUp, Download, RefreshCw,
  Clock, Trash2, ToggleLeft, ToggleRight, Plus, X,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { AdminLayout } from './AdminLayout';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type ReporteTipo =
  | 'inscripciones' | 'expedientes' | 'financiero' | 'academico'
  | 'productividad_gestores' | 'convocatorias' | 'solicitudes' | 'ejecutivo';

type Formato = 'excel' | 'pdf';

interface Filtros {
  fechaInicio: string;
  fechaFin: string;
  municipioId: string;
  gestorId: string;
}

interface KPI {
  label: string;
  valor: string | number;
  unidad?: string;
}

interface Preview {
  kpis: KPI[];
  columnas: string[];
  preview: (string | number | null)[][];
  totalRegistros: number;
}

interface Programado {
  id: number;
  nombre: string;
  tipo: string;
  formato: string;
  frecuencia: string;
  emailDestino: string;
  activo: boolean;
  proximaEjecucion: string;
  ultimaEjecucionEn: string | null;
}

interface Historial {
  id: number;
  tipo: string;
  formato: string;
  nombre: string;
  estado: string;
  totalRegistros: number | null;
  nombreArchivo: string | null;
  tamanoBytes: number | null;
  generadoEn: string | null;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────
// Report type cards config
// ─────────────────────────────────────────────────────────────

const REPORTES: { tipo: ReporteTipo; label: string; desc: string; icon: React.FC<{ size?: number; className?: string }> }[] = [
  { tipo: 'inscripciones',        label: 'Inscripciones',          desc: 'Estado de inscripciones por convocatoria, municipio y gestor',  icon: Users },
  { tipo: 'expedientes',          label: 'Expedientes',            desc: 'Revisión de documentos por alumno y estado de aprobación',      icon: FileText },
  { tipo: 'financiero',           label: 'Financiero',             desc: 'Pagos recibidos, verificados y pendientes con montos',          icon: DollarSign },
  { tipo: 'academico',            label: 'Académico',              desc: 'Calificaciones, tasas de aprobación y progreso modular',        icon: GraduationCap },
  { tipo: 'productividad_gestores', label: 'Gestores',             desc: 'Productividad por gestor: alumnos, documentos y matrículas',   icon: UserCheck },
  { tipo: 'convocatorias',        label: 'Convocatorias',          desc: 'Inscritos por etapa, módulo y sede de examen',                 icon: Calendar },
  { tipo: 'solicitudes',          label: 'Solicitudes de Cuenta',  desc: 'Flujo de solicitudes públicas por estado y municipio',        icon: Inbox },
  { tipo: 'ejecutivo',            label: 'Ejecutivo',              desc: 'Dashboard consolidado con todos los KPI institucionales',      icon: TrendingUp },
];

const GUINDA = '#6B0F3C';
const FRECUENCIAS = ['diaria', 'semanal', 'quincenal', 'mensual'];
const CHART_COLORS = [GUINDA, '#BF9000', '#4B5563', '#9D174D', '#1D4ED8', '#047857'];

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function fechaCorta(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────

export default function Reportes() {
  const [selected, setSelected] = useState<ReporteTipo | null>(null);
  const [formato, setFormato] = useState<Formato>('excel');
  const [filtros, setFiltros] = useState<Filtros>({ fechaInicio: '', fechaFin: '', municipioId: '', gestorId: '' });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingDescarga, setLoadingDescarga] = useState(false);

  const [historial, setHistorial] = useState<Historial[]>([]);
  const [historialLoaded, setHistorialLoaded] = useState(false);

  const [programados, setProgramados] = useState<Programado[]>([]);
  const [showProgramados, setShowProgramados] = useState(false);
  const [showModalProgramar, setShowModalProgramar] = useState(false);

  const [formProg, setFormProg] = useState({
    nombre: '', tipo: 'inscripciones' as ReporteTipo,
    formato: 'excel' as Formato, frecuencia: 'semanal',
    emailDestino: '',
  });
  const [savingProg, setSavingProg] = useState(false);

  // ── Preview ──
  const cargarPreview = useCallback(async () => {
    if (!selected) return;
    setLoadingPreview(true);
    setPreview(null);
    try {
      const res = await fetch('/api/admin/reportes/preview', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: selected, filtros }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setPreview(data);
    } catch (e) {
      alert('Error al cargar preview: ' + String(e));
    } finally {
      setLoadingPreview(false);
    }
  }, [selected, filtros]);

  // ── Download ──
  const descargar = useCallback(async () => {
    if (!selected) return;
    setLoadingDescarga(true);
    try {
      const res = await fetch('/api/admin/reportes/generar', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: selected, formato, filtros }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const ext = formato === 'excel' ? 'xlsx' : 'pdf';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selected}_${new Date().toISOString().slice(0, 10)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      // Reload historial after download
      cargarHistorial();
    } catch (e) {
      alert('Error al generar reporte: ' + String(e));
    } finally {
      setLoadingDescarga(false);
    }
  }, [selected, formato, filtros]);

  // ── Historial ──
  const cargarHistorial = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/reportes/historial', { credentials: 'include' });
      const data = await res.json();
      setHistorial(data);
      setHistorialLoaded(true);
    } catch {}
  }, []);

  const toggleHistorial = () => {
    if (!historialLoaded) cargarHistorial();
    setShowProgramados(false);
  };

  // ── Programados ──
  const cargarProgramados = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/reportes/programados', { credentials: 'include' });
      const data = await res.json();
      setProgramados(data);
    } catch {}
  }, []);

  const toggleProgramados = () => {
    setShowProgramados((v) => !v);
    if (!showProgramados) cargarProgramados();
  };

  const toggleActivo = async (prog: Programado) => {
    try {
      const res = await fetch(`/api/admin/reportes/programados/${prog.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !prog.activo }),
      });
      if (res.ok) setProgramados((prev) => prev.map((p) => p.id === prog.id ? { ...p, activo: !p.activo } : p));
    } catch {}
  };

  const eliminarProgramado = async (id: number) => {
    if (!confirm('¿Eliminar reporte programado?')) return;
    await fetch(`/api/admin/reportes/programados/${id}`, { method: 'DELETE', credentials: 'include' });
    setProgramados((prev) => prev.filter((p) => p.id !== id));
  };

  const guardarProgramado = async () => {
    setSavingProg(true);
    try {
      const res = await fetch('/api/admin/reportes/programados', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formProg),
      });
      if (!res.ok) throw new Error(await res.text());
      const nuevo = await res.json();
      setProgramados((prev) => [nuevo, ...prev]);
      setShowModalProgramar(false);
    } catch (e) {
      alert('Error: ' + String(e));
    } finally {
      setSavingProg(false);
    }
  };

  // ── Chart data from preview ──
  const chartData = preview?.kpis?.slice(0, 6).map((k) => ({
    name: k.label.length > 20 ? k.label.slice(0, 18) + '…' : k.label,
    value: typeof k.valor === 'number' ? k.valor : parseFloat(String(k.valor).replace(/[^0-9.]/g, '')) || 0,
  })) ?? [];

  return (
    <AdminLayout>
      <div style={{ fontFamily: "'Inter', sans-serif" }}>

        {/* ── Page header ── */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: GUINDA }}>Reportes Institucionales</h1>
            <p className="text-sm text-stone-500 mt-0.5">Genera y programa reportes en Excel o PDF</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { toggleHistorial(); setHistorialLoaded(true); cargarHistorial(); }}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border"
              style={{ borderColor: '#d6d3d1', color: '#44403c', background: 'white' }}
            >
              <Clock size={14} /> Historial
            </button>
            <button
              onClick={toggleProgramados}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border"
              style={{ borderColor: '#d6d3d1', color: '#44403c', background: 'white' }}
            >
              <RefreshCw size={14} /> Programados
            </button>
            <button
              onClick={() => setShowModalProgramar(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg text-white"
              style={{ background: GUINDA }}
            >
              <Plus size={14} /> Programar reporte
            </button>
          </div>
        </div>

        {/* ── Report type grid ── */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {REPORTES.map(({ tipo, label, desc, icon: Icon }) => (
            <button
              key={tipo}
              onClick={() => { setSelected(tipo); setPreview(null); }}
              className="text-left p-4 rounded-xl border transition-all"
              style={{
                background: selected === tipo ? '#fdf6fa' : 'white',
                borderColor: selected === tipo ? GUINDA : '#e7e5e4',
                borderWidth: selected === tipo ? 2 : 1,
                boxShadow: selected === tipo ? `0 0 0 3px ${GUINDA}22` : undefined,
              }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center mb-2.5"
                style={{ background: selected === tipo ? GUINDA : '#f5f0ea', color: selected === tipo ? 'white' : GUINDA }}
              >
                <Icon size={16} />
              </div>
              <div className="text-sm font-semibold" style={{ color: selected === tipo ? GUINDA : '#2a2a2a' }}>{label}</div>
              <div className="text-xs mt-0.5" style={{ color: '#78716c', lineHeight: 1.4 }}>{desc}</div>
            </button>
          ))}
        </div>

        {/* ── Filters + generate panel ── */}
        {selected && (
          <div className="bg-white rounded-xl border border-stone-200 p-5 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 size={16} style={{ color: GUINDA }} />
              <span className="font-semibold text-sm" style={{ color: GUINDA }}>
                {REPORTES.find((r) => r.tipo === selected)?.label}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-3 mb-4">
              <div>
                <label className="text-xs font-medium text-stone-500 block mb-1">Fecha inicio</label>
                <input type="date" className="w-full text-sm border rounded-lg px-2 py-1.5"
                  value={filtros.fechaInicio}
                  onChange={(e) => setFiltros((f) => ({ ...f, fechaInicio: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-stone-500 block mb-1">Fecha fin</label>
                <input type="date" className="w-full text-sm border rounded-lg px-2 py-1.5"
                  value={filtros.fechaFin}
                  onChange={(e) => setFiltros((f) => ({ ...f, fechaFin: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-stone-500 block mb-1">Municipio ID</label>
                <input type="number" placeholder="Todos" className="w-full text-sm border rounded-lg px-2 py-1.5"
                  value={filtros.municipioId}
                  onChange={(e) => setFiltros((f) => ({ ...f, municipioId: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-stone-500 block mb-1">Formato</label>
                <select className="w-full text-sm border rounded-lg px-2 py-1.5"
                  value={formato}
                  onChange={(e) => setFormato(e.target.value as Formato)}
                >
                  <option value="excel">Excel (.xlsx)</option>
                  <option value="pdf">PDF</option>
                </select>
              </div>
              <div className="flex items-end gap-2">
                <button
                  onClick={cargarPreview}
                  disabled={loadingPreview}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border"
                  style={{ borderColor: '#d6d3d1', background: 'white', color: '#44403c' }}
                >
                  {loadingPreview ? <RefreshCw size={13} className="animate-spin" /> : <BarChart2 size={13} />}
                  Vista previa
                </button>
                <button
                  onClick={descargar}
                  disabled={loadingDescarga}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg text-white"
                  style={{ background: GUINDA }}
                >
                  {loadingDescarga ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13} />}
                  Descargar
                </button>
              </div>
            </div>

            {/* ── Preview section ── */}
            {preview && (
              <div>
                {/* KPI cards */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {preview.kpis.slice(0, 4).map((kpi, i) => (
                    <div key={i} className="rounded-lg p-3" style={{ background: '#fdf6fa', borderLeft: `3px solid ${GUINDA}` }}>
                      <div className="text-xl font-bold" style={{ color: GUINDA }}>{kpi.valor}{kpi.unidad ? ` ${kpi.unidad}` : ''}</div>
                      <div className="text-xs text-stone-500 mt-0.5">{kpi.label}</div>
                    </div>
                  ))}
                </div>

                {/* Chart */}
                {chartData.length > 1 && (
                  <div className="mb-4 bg-stone-50 rounded-lg p-3">
                    <div className="text-xs font-semibold text-stone-500 mb-2">Distribución de indicadores</div>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ fontSize: 12 }} />
                        <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                          {chartData.map((_entry, index) => (
                            <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Data table */}
                <div className="text-xs font-semibold text-stone-500 mb-1.5">
                  Primeros registros — Total: {preview.totalRegistros.toLocaleString('es-MX')}
                </div>
                <div className="overflow-auto rounded-lg border border-stone-200" style={{ maxHeight: 300 }}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ background: GUINDA }}>
                        {preview.columnas.map((col) => (
                          <th key={col} className="px-3 py-2 text-left font-semibold text-white whitespace-nowrap">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.preview.map((fila, ri) => (
                        <tr key={ri} style={{ background: ri % 2 === 0 ? 'white' : '#fafafa' }}>
                          {fila.map((cell, ci) => (
                            <td key={ci} className="px-3 py-1.5 text-stone-700 whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis">
                              {cell ?? '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Historial ── */}
        {historialLoaded && historial.length > 0 && (
          <div className="bg-white rounded-xl border border-stone-200 p-5 mb-6">
            <h2 className="text-sm font-semibold mb-3" style={{ color: GUINDA }}>Historial de reportes generados</h2>
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-stone-100">
                    {['Nombre', 'Tipo', 'Formato', 'Registros', 'Tamaño', 'Generado', 'Estado'].map((h) => (
                      <th key={h} className="text-left px-2 py-2 text-stone-500 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {historial.map((h) => (
                    <tr key={h.id} className="border-b border-stone-50 hover:bg-stone-50">
                      <td className="px-2 py-2 font-medium text-stone-800">{h.nombre}</td>
                      <td className="px-2 py-2 text-stone-600">{h.tipo.replace(/_/g, ' ')}</td>
                      <td className="px-2 py-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                          style={{ background: h.formato === 'excel' ? '#e8f5e9' : '#fce4ec', color: h.formato === 'excel' ? '#2e7d32' : '#c62828' }}>
                          {h.formato.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-2 py-2">{h.totalRegistros?.toLocaleString('es-MX') ?? '—'}</td>
                      <td className="px-2 py-2">{h.tamanoBytes ? formatBytes(h.tamanoBytes) : '—'}</td>
                      <td className="px-2 py-2 text-stone-500">{fechaCorta(h.generadoEn ?? h.createdAt)}</td>
                      <td className="px-2 py-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                          style={{ background: h.estado === 'listo' ? '#e8f5e9' : '#fff8e1', color: h.estado === 'listo' ? '#2e7d32' : '#f57f17' }}>
                          {h.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Programados ── */}
        {showProgramados && (
          <div className="bg-white rounded-xl border border-stone-200 p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold" style={{ color: GUINDA }}>Reportes programados</h2>
              <button
                onClick={() => setShowModalProgramar(true)}
                className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg text-white"
                style={{ background: GUINDA }}
              >
                <Plus size={12} /> Nuevo
              </button>
            </div>
            {programados.length === 0 ? (
              <p className="text-sm text-stone-400 text-center py-6">No hay reportes programados</p>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-stone-100">
                      {['Nombre', 'Tipo', 'Frecuencia', 'Formato', 'Email destino', 'Próxima ejecución', 'Activo', ''].map((h) => (
                        <th key={h} className="text-left px-2 py-2 text-stone-500 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {programados.map((p) => (
                      <tr key={p.id} className="border-b border-stone-50 hover:bg-stone-50">
                        <td className="px-2 py-2 font-medium">{p.nombre}</td>
                        <td className="px-2 py-2 text-stone-600">{p.tipo.replace(/_/g, ' ')}</td>
                        <td className="px-2 py-2 capitalize">{p.frecuencia}</td>
                        <td className="px-2 py-2 uppercase">{p.formato}</td>
                        <td className="px-2 py-2 text-stone-500">{p.emailDestino}</td>
                        <td className="px-2 py-2 text-stone-500">{fechaCorta(p.proximaEjecucion)}</td>
                        <td className="px-2 py-2">
                          <button onClick={() => toggleActivo(p)}>
                            {p.activo
                              ? <ToggleRight size={18} style={{ color: '#16a34a' }} />
                              : <ToggleLeft size={18} style={{ color: '#9ca3af' }} />}
                          </button>
                        </td>
                        <td className="px-2 py-2">
                          <button onClick={() => eliminarProgramado(p.id)}>
                            <Trash2 size={13} style={{ color: '#ef4444' }} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Modal: Programar reporte ── */}
        {showModalProgramar && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.45)' }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowModalProgramar(false); }}
          >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-bold" style={{ color: GUINDA }}>Programar reporte automático</h3>
                <button onClick={() => setShowModalProgramar(false)}><X size={16} /></button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-stone-600 block mb-1">Nombre del reporte</label>
                  <input className="w-full text-sm border rounded-lg px-3 py-2"
                    value={formProg.nombre}
                    onChange={(e) => setFormProg((f) => ({ ...f, nombre: e.target.value }))}
                    placeholder="Ej. Inscripciones semanales"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-600 block mb-1">Tipo de reporte</label>
                  <select className="w-full text-sm border rounded-lg px-3 py-2"
                    value={formProg.tipo}
                    onChange={(e) => setFormProg((f) => ({ ...f, tipo: e.target.value as ReporteTipo }))}
                  >
                    {REPORTES.map((r) => <option key={r.tipo} value={r.tipo}>{r.label}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-stone-600 block mb-1">Formato</label>
                    <select className="w-full text-sm border rounded-lg px-3 py-2"
                      value={formProg.formato}
                      onChange={(e) => setFormProg((f) => ({ ...f, formato: e.target.value as Formato }))}
                    >
                      <option value="excel">Excel (.xlsx)</option>
                      <option value="pdf">PDF</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-stone-600 block mb-1">Frecuencia</label>
                    <select className="w-full text-sm border rounded-lg px-3 py-2"
                      value={formProg.frecuencia}
                      onChange={(e) => setFormProg((f) => ({ ...f, frecuencia: e.target.value }))}
                    >
                      {FRECUENCIAS.map((f) => <option key={f} value={f} className="capitalize">{f}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-600 block mb-1">Email destino</label>
                  <input type="email" className="w-full text-sm border rounded-lg px-3 py-2"
                    value={formProg.emailDestino}
                    onChange={(e) => setFormProg((f) => ({ ...f, emailDestino: e.target.value }))}
                    placeholder="director@michoacan.gob.mx"
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-5">
                <button
                  className="flex-1 py-2 text-sm font-medium rounded-lg border"
                  style={{ borderColor: '#d6d3d1', color: '#44403c' }}
                  onClick={() => setShowModalProgramar(false)}
                >
                  Cancelar
                </button>
                <button
                  className="flex-1 py-2 text-sm font-semibold rounded-lg text-white flex items-center justify-center gap-1.5"
                  style={{ background: GUINDA }}
                  onClick={guardarProgramado}
                  disabled={savingProg || !formProg.nombre || !formProg.emailDestino}
                >
                  {savingProg ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={13} />}
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
}
