import { useEffect, useState, useCallback, useRef } from 'react';
import { useLocation } from 'wouter';
import {
  UserCheck, MapPin, Mail, Users, AlertTriangle,
  Plus, Search, X, RefreshCw, UserPlus, Eye, MoreHorizontal, UserX,
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { SectionTour } from '../../components/onboarding/SectionTour';
import { TOUR_A_GESTORES, GATE_ADMIN } from '../../components/onboarding/seccionesAdmin';
import { api } from '../../lib/api';
import { useAdminPerfil } from '../../lib/useAdmin';

// ─── Types ────────────────────────────────────────────────────────────────

type GestorMetricas = {
  totalAlumnos: number;
  expedientesCompletos: number;
  pendientes: number;
  egresados: number;
  tasaExito: number;
  tasaExitoNivel: 'alta' | 'media' | 'baja';
};

type Gestor = {
  id: number;
  userId: number;
  nombreCompleto: string;
  iniciales: string;
  titulo: string;
  email: string;
  telefono: string | null;
  municipio: { id: number; nombre: string } | null;
  estado: 'activo' | 'inactivo';
  capacidadMaxima: number;
  metricas: GestorMetricas;
  ultimaActividad: string | null;
  ultimaActividadTexto: string;
  alertas: { sinReasignar: number } | null;
};

type ListaResp = {
  gestores: Gestor[];
  total: number;
  page: number;
  totalPages: number;
  resumen: {
    totalActivos: number;
    tasaExitoPromedio: number;
    alumnosPorGestor: number;
    inactivos: number;
  };
};

type GestorSimple = {
  id: number;
  nombreCompleto: string;
  iniciales: string;
  municipioId: number | null;
  municipioNombre: string | null;
};

type Municipio = { id: number; nombre: string };

// ─── Color helpers ────────────────────────────────────────────────────────

function tasaColor(nivel: 'alta' | 'media' | 'baja') {
  if (nivel === 'alta') return { text: '#2d7d46', bar: 'linear-gradient(to right, #2d7d46, #38a169)' };
  if (nivel === 'media') return { text: '#c77700', bar: 'linear-gradient(to right, #c77700, #d97706)' };
  return { text: '#b91c1c', bar: 'linear-gradient(to right, #b91c1c, #dc2626)' };
}

function useDebounce<T>(value: T, ms: number): T {
  const [dv, setDv] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDv(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return dv;
}

// ─── CrearGestorModal ─────────────────────────────────────────────────────

function CrearGestorModal({
  municipios,
  onClose,
  onSuccess,
}: {
  municipios: Municipio[];
  onClose: () => void;
  onSuccess: (email: string) => void;
}) {
  const [form, setForm] = useState({
    nombre: '', apellidos: '', email: '', telefono: '', municipioId: '', capacidadMaxima: '50',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit() {
    if (!form.nombre.trim() || !form.apellidos.trim()) { setError('Nombre y apellidos son requeridos.'); return; }
    if (!form.email.trim()) { setError('El correo institucional es requerido.'); return; }
    if (!form.municipioId) { setError('Selecciona un municipio.'); return; }
    setSaving(true);
    setError(null);
    try {
      await api.post('/admin/gestores', {
        nombre: form.nombre.trim(),
        apellidos: form.apellidos.trim(),
        email: form.email.trim(),
        telefono: form.telefono.trim() || null,
        municipioId: Number(form.municipioId),
        capacidadMaxima: Math.max(5, Math.min(200, Number(form.capacidadMaxima) || 50)),
      });
      onSuccess(form.email.trim());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al crear gestor.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(42,42,42,0.7)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 flex flex-col overflow-hidden" style={{ maxHeight: '92vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ background: 'var(--color-guinda-700)', color: 'white' }}>
          <h3 className="font-semibold text-base" style={{ fontFamily: "'Poppins', sans-serif" }}>Nuevo gestor municipal</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-6 flex-1">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <FormField label="Nombre(s) *">
              <input className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400" placeholder="María Elena" value={form.nombre} onChange={(e) => set('nombre', e.target.value)} />
            </FormField>
            <FormField label="Apellidos *">
              <input className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400" placeholder="Ramírez Soto" value={form.apellidos} onChange={(e) => set('apellidos', e.target.value)} />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <FormField label="Correo institucional *">
              <input type="email" className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400" placeholder="nombre@michoacan.gob.mx" value={form.email} onChange={(e) => set('email', e.target.value)} />
            </FormField>
            <FormField label="Teléfono">
              <input type="tel" className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400" placeholder="434-342-9876" value={form.telefono} onChange={(e) => set('telefono', e.target.value)} />
            </FormField>
          </div>

          <FormField label="Municipio asignado *" className="mb-3">
            <select className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400 bg-white" value={form.municipioId} onChange={(e) => set('municipioId', e.target.value)}>
              <option value="">Selecciona un municipio...</option>
              {municipios.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
            <p className="text-[11px] mt-1" style={{ color: '#6b635e' }}>El gestor podrá ver y gestionar los alumnos de este municipio</p>
          </FormField>

          <FormField label="Capacidad máxima de alumnos" className="mb-4">
            <input type="number" min={5} max={200} className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400" value={form.capacidadMaxima} onChange={(e) => set('capacidadMaxima', e.target.value)} />
            <p className="text-[11px] mt-1" style={{ color: '#6b635e' }}>Número máximo de alumnos que puede tener asignados al mismo tiempo</p>
          </FormField>

          {/* Helper note */}
          <div className="flex items-start gap-2.5 p-3 rounded-lg text-xs" style={{ background: '#dbeafe', border: '1px solid #93c5fd', color: '#1e3a8a' }}>
            <Users size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Al crear el gestor, se enviará automáticamente un correo a su dirección institucional con sus credenciales temporales para acceder al sistema.</span>
          </div>

          {error && <p className="mt-3 text-xs font-medium" style={{ color: '#b91c1c' }}>{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-stone-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors" style={{ color: '#443e39' }}>Cancelar</button>
          <button onClick={handleSubmit} disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50" style={{ background: 'var(--color-guinda-700)' }}>
            <UserPlus size={14} /> {saving ? 'Creando...' : 'Crear gestor'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ReasignarAlumnosModal ────────────────────────────────────────────────

function ReasignarAlumnosModal({
  gestor,
  gestoresActivos,
  onClose,
  onSuccess,
}: {
  gestor: Gestor;
  gestoresActivos: GestorSimple[];
  onClose: () => void;
  onSuccess: (count: number, nombre: string) => void;
}) {
  const [aGestorId, setAGestorId] = useState('');
  const [razon, setRazon] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const n = gestor.alertas?.sinReasignar ?? gestor.metricas.totalAlumnos;

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      await api.post(`/admin/gestores/${gestor.id}/reasignar-alumnos`, {
        aGestorId: aGestorId ? Number(aGestorId) : null,
        razon: razon.trim() || null,
      });
      const destino = gestoresActivos.find((g) => g.id === Number(aGestorId));
      onSuccess(n, destino?.nombreCompleto ?? 'gestor seleccionado');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al reasignar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(42,42,42,0.7)' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4" style={{ background: 'var(--color-guinda-700)', color: 'white' }}>
          <h3 className="font-semibold text-base" style={{ fontFamily: "'Poppins', sans-serif" }}>Reasignar alumnos de {gestor.nombreCompleto.split(' ')[0]}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center hover:opacity-80" style={{ background: 'rgba(255,255,255,0.15)' }}><X size={14} /></button>
        </div>

        <div className="p-6">
          {/* Alert */}
          <div className="flex items-start gap-2.5 p-3 rounded-lg mb-4 text-sm" style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderLeft: '3px solid #b91c1c', color: '#991b1b' }}>
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>{gestor.nombreCompleto}</strong> está inactivo y tiene <strong>{n} alumnos</strong>{gestor.municipio ? ` en ${gestor.municipio.nombre}` : ''} sin atención. Reasígnalos a otro gestor.
            </div>
          </div>

          <FormField label={`Nuevo gestor para los ${n} alumnos *`} className="mb-3">
            <select className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400 bg-white" value={aGestorId} onChange={(e) => setAGestorId(e.target.value)}>
              <option value="">Selecciona un gestor...</option>
              {gestoresActivos.filter((g) => g.id !== gestor.id).map((g) => (
                <option key={g.id} value={g.id}>{g.nombreCompleto}{g.municipioNombre ? ` · ${g.municipioNombre}` : ''}</option>
              ))}
              <option value="null" style={{ color: '#6b635e' }}>— No reasignar (alumnos quedan sin gestor) —</option>
            </select>
            <p className="text-[11px] mt-1" style={{ color: '#6b635e' }}>Solo se muestran gestores activos</p>
          </FormField>

          <FormField label="Razón del cambio (opcional)" className="mb-4">
            <input className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400" placeholder="Ej. Baja del gestor por jubilación..." value={razon} onChange={(e) => setRazon(e.target.value)} />
          </FormField>

          <div className="flex items-start gap-2.5 p-3 rounded-lg text-xs mb-4" style={{ background: '#dbeafe', border: '1px solid #93c5fd', color: '#1e3a8a' }}>
            <Users size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Los {n} alumnos serán notificados por correo del cambio de gestor con la información del nuevo gestor asignado.</span>
          </div>

          {error && <p className="text-xs font-medium mb-3" style={{ color: '#b91c1c' }}>{error}</p>}

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm font-semibold border border-stone-200 rounded-lg hover:bg-stone-50" style={{ color: '#443e39' }}>Cancelar</button>
            <button onClick={handleSubmit} disabled={saving || !aGestorId} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50" style={{ background: 'var(--color-guinda-700)' }}>
              <Users size={14} /> {saving ? 'Reasignando...' : `Reasignar ${n} alumnos`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── FormField helper ─────────────────────────────────────────────────────

function FormField({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold mb-1" style={{ color: '#443e39' }}>{label}</label>
      {children}
    </div>
  );
}

// ─── GestorCard ───────────────────────────────────────────────────────────

function GestorCard({
  gestor,
  onViewDetail,
  onReasignar,
}: {
  gestor: Gestor;
  onViewDetail: () => void;
  onReasignar: () => void;
}) {
  const tc = tasaColor(gestor.metricas.tasaExitoNivel);
  const inactivo = gestor.estado === 'inactivo';
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function h(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false);
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div
      className="bg-white border border-stone-200 rounded-xl overflow-hidden flex flex-col transition-all duration-150 cursor-pointer"
      style={{ opacity: inactivo ? 0.8 : 1 }}
      onClick={onViewDetail}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-guinda-500)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = '#eadfd7';
        (e.currentTarget as HTMLElement).style.boxShadow = '';
        (e.currentTarget as HTMLElement).style.transform = '';
      }}
    >
      {/* Banner */}
      <div className="h-14 relative flex-shrink-0" style={{
        background: inactivo
          ? 'linear-gradient(135deg, #6b635e 0%, #443e39 100%)'
          : 'linear-gradient(135deg, var(--color-guinda-700) 0%, #4a0e20 100%)',
      }}>
        <span
          className="absolute top-2.5 right-3 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full"
          style={{ background: 'rgba(255,255,255,0.95)', color: inactivo ? '#6b635e' : '#2d7d46' }}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${inactivo ? '' : 'animate-pulse'}`} style={{ background: inactivo ? '#6b635e' : '#2d7d46' }} />
          {inactivo ? 'Inactivo' : 'Activo'}
        </span>
      </div>

      {/* Avatar */}
      <div
        className="w-[76px] h-[76px] rounded-full flex items-center justify-center text-2xl font-bold border-4 border-white mx-auto text-center"
        style={{
          background: inactivo ? '#f7f2ed' : '#efe7d6',
          color: inactivo ? '#6b635e' : 'var(--color-guinda-700)',
          marginTop: -38,
          fontFamily: "'Poppins', sans-serif",
          position: 'relative',
          zIndex: 1,
        }}
      >
        {gestor.iniciales}
      </div>

      {/* Info */}
      <div className="px-5 pb-4 text-center">
        <div className="text-sm font-bold leading-tight mb-1" style={{ fontFamily: "'Poppins', sans-serif", color: '#2a2a2a' }}>
          {gestor.nombreCompleto}
        </div>
        <div className="text-[11px] mb-2" style={{ color: '#6b635e' }}>{gestor.titulo}</div>
        {gestor.municipio && (
          <span
            className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide"
            style={{
              background: inactivo ? '#f7f2ed' : 'var(--color-guinda-100)',
              color: inactivo ? '#6b635e' : 'var(--color-guinda-700)',
            }}
          >
            <MapPin size={10} /> {gestor.municipio.nombre}
          </span>
        )}
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 border-t border-b border-stone-100 py-3 px-5" style={{ background: '#fdfaf3', gap: 4 }}>
        <MetricItem num={gestor.metricas.totalAlumnos} label="Alumnos" />
        <MetricItem
          num={inactivo ? gestor.metricas.pendientes : gestor.metricas.expedientesCompletos}
          label={inactivo ? 'Pendientes' : 'Completos'}
          color={inactivo ? '#c77700' : '#2d7d46'}
        />
      </div>

      {/* Tasa de éxito */}
      <div className="px-5 py-3 border-b border-stone-100">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#6b635e' }}>Tasa de éxito</span>
          <span className="text-sm font-bold" style={{ color: tc.text }}>{gestor.metricas.tasaExito}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#f7f2ed' }}>
          <div className="h-full rounded-full" style={{ width: `${gestor.metricas.tasaExito}%`, background: tc.bar }} />
        </div>
      </div>

      {/* Email */}
      <div className="px-5 py-2.5 border-b border-stone-100">
        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: '#6b635e' }}>
          <Mail size={10} /> <span className="truncate">{gestor.email}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-2.5 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
        {gestor.alertas && gestor.alertas.sinReasignar > 0 ? (
          <div className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: '#b91c1c' }}>
            <AlertTriangle size={12} /> {gestor.alertas.sinReasignar} alumnos sin reasignar
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[11px]" style={{ color: '#6b635e' }}>
            {gestor.estado === 'activo' && <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-green-500 flex-shrink-0" />}
            {gestor.ultimaActividadTexto}
          </div>
        )}

        <div className="flex items-center gap-1">
          {gestor.alertas && gestor.alertas.sinReasignar > 0 ? (
            <ActionBtn title="Reasignar alumnos" onClick={onReasignar}>
              <Users size={13} />
            </ActionBtn>
          ) : (
            <ActionBtn title="Ver detalle" onClick={onViewDetail}>
              <Eye size={13} />
            </ActionBtn>
          )}
          <div className="relative" ref={dropRef}>
            <ActionBtn title="Más opciones" onClick={() => setDropOpen(!dropOpen)}>
              <MoreHorizontal size={13} />
            </ActionBtn>
            {dropOpen && (
              <div className="absolute right-0 bottom-full mb-1 z-20 bg-white border border-stone-200 rounded-xl shadow-lg py-1 w-44" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.10)' }}>
                <DropItem onClick={() => { setDropOpen(false); onViewDetail(); }} icon={<Eye size={13} />} label="Ver detalle" />
                {gestor.alertas && gestor.alertas.sinReasignar > 0 && (
                  <DropItem onClick={() => { setDropOpen(false); onReasignar(); }} icon={<Users size={13} />} label="Reasignar alumnos" />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricItem({ num, label, color }: { num: number; label: string; color?: string }) {
  return (
    <div className="text-center py-1">
      <div className="text-xl font-bold" style={{ fontFamily: "'Poppins', sans-serif", color: color ?? '#2a2a2a', letterSpacing: '-0.02em', lineHeight: 1 }}>{num}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wide mt-1" style={{ color: '#6b635e' }}>{label}</div>
    </div>
  );
}

function ActionBtn({ title, onClick, children }: { title: string; onClick: (e: React.MouseEvent) => void; children: React.ReactNode }) {
  return (
    <button
      title={title}
      onClick={(e) => { e.stopPropagation(); onClick(e); }}
      className="w-7 h-7 rounded-lg flex items-center justify-center border border-stone-200 bg-white transition-all hover:bg-[var(--color-guinda-700)] hover:border-[var(--color-guinda-700)] hover:text-white"
      style={{ color: '#443e39' }}
    >
      {children}
    </button>
  );
}

function DropItem({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-stone-50 transition-colors text-left" style={{ color: '#443e39', background: 'none', border: 'none', cursor: 'pointer' }}>
      {icon} {label}
    </button>
  );
}

// ─── Stats mini card ──────────────────────────────────────────────────────

function StatCard({ num, label, sub }: { num: number | string; label: string; sub?: string }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl px-5 py-4 flex-1 min-w-0">
      <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#6b635e' }}>
        {label}
      </div>
      <div className="text-2xl font-bold" style={{ fontFamily: "'Poppins', sans-serif", color: '#2a2a2a' }}>
        {typeof num === 'number' ? num.toLocaleString('es-MX') : num}
      </div>
      {sub && <div className="text-[11px] mt-0.5" style={{ color: '#a89a8e' }}>{sub}</div>}
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────

function Toast({ msg, ok, onDone }: { msg: string; ok: boolean; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 4000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="fixed top-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-lg" style={{
      background: ok ? '#d1fae5' : '#fee2e2',
      color: ok ? '#2d7d46' : '#b91c1c',
      border: `1px solid ${ok ? '#a7f3d0' : '#fca5a5'}`,
    }}>
      {msg}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────

export default function GestoresLista() {
  const [, setLocation] = useLocation();
  const { esJefe } = useAdminPerfil();

  // Filters
  const [searchInput, setSearchInput] = useState('');
  const [estado, setEstado] = useState('');
  const [municipioId, setMunicipioId] = useState('');
  const [sortBy, setSortBy] = useState('tasa_exito');
  const debouncedSearch = useDebounce(searchInput, 300);

  // Data
  const [data, setData] = useState<ListaResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);

  // Modals
  const [crearOpen, setCrearOpen] = useState(false);
  const [reasignarGestor, setReasignarGestor] = useState<Gestor | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Load municipios once
  useEffect(() => {
    api.get<{ municipios: Municipio[] }>('/admin/municipios').then((r) => setMunicipios(r.municipios)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qp = new URLSearchParams({ sortBy, limit: '50' });
      if (debouncedSearch) qp.set('search', debouncedSearch);
      if (estado) qp.set('estado', estado);
      if (municipioId) qp.set('municipioId', municipioId);
      const resp = await api.get<ListaResp>(`/admin/gestores?${qp.toString()}`);
      setData(resp);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, estado, municipioId, sortBy]);

  useEffect(() => { load(); }, [load]);

  function gestoresActivos(): GestorSimple[] {
    return (data?.gestores ?? [])
      .filter((g) => g.estado === 'activo')
      .map((g) => ({ id: g.id, nombreCompleto: g.nombreCompleto, iniciales: g.iniciales, municipioId: g.municipio?.id ?? null, municipioNombre: g.municipio?.nombre ?? null }));
  }

  const resumen = data?.resumen;

  return (
    <AdminLayout>
      {toast && <Toast msg={toast.msg} ok={toast.ok} onDone={() => setToast(null)} />}

      {crearOpen && (
        <CrearGestorModal
          municipios={municipios}
          onClose={() => setCrearOpen(false)}
          onSuccess={(email) => {
            setCrearOpen(false);
            load();
            setToast({ msg: `Gestor creado y credenciales enviadas a ${email}`, ok: true });
          }}
        />
      )}

      {reasignarGestor && (
        <ReasignarAlumnosModal
          gestor={reasignarGestor}
          gestoresActivos={gestoresActivos()}
          onClose={() => setReasignarGestor(null)}
          onSuccess={(count, nombre) => {
            setReasignarGestor(null);
            load();
            setToast({ msg: `${count} alumno${count !== 1 ? 's' : ''} reasignado${count !== 1 ? 's' : ''} a ${nombre}`, ok: true });
          }}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-5 flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase mb-1.5" style={{ color: 'var(--color-guinda-700)', letterSpacing: '0.15em' }}>
            <UserCheck size={12} /> PERSONAS · GESTORES
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Poppins', sans-serif", color: '#2a2a2a' }}>
            Gestores municipales
          </h1>
          {resumen && (
            <p className="text-sm mt-1" style={{ color: '#6b635e' }}>
              {resumen.totalActivos} gestores activos · {data?.gestores.reduce((s, g) => s + g.metricas.totalAlumnos, 0) ?? 0} alumnos en gestión
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 transition-colors" title="Recargar">
            <RefreshCw size={14} style={{ color: '#6b635e' }} />
          </button>
          {esJefe && (
            <button
              data-tour="a-ges-nuevo"
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg"
              style={{ background: 'var(--color-guinda-700)' }}
              onClick={() => setCrearOpen(true)}
            >
              <UserPlus size={14} /> Nuevo gestor
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      {resumen && (
        <div data-tour="a-ges-stats" className="flex gap-3 mb-5 flex-wrap">
          <StatCard num={resumen.totalActivos} label="Total activos" />
          <StatCard num={`${resumen.tasaExitoPromedio}%`} label="Tasa de éxito" sub="Promedio general" />
          <StatCard num={resumen.alumnosPorGestor} label="Alumnos por gestor" sub="Promedio activos" />
          <StatCard num={resumen.inactivos} label="Inactivos" />
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white border border-stone-200 rounded-xl p-4 mb-5">
        <div className="grid gap-3" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }}>
          {/* Search */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#6b635e' }}>Buscar</label>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: '#6b635e' }} />
              <input
                className="w-full pl-8 pr-8 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400"
                placeholder="Nombre del gestor o municipio..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              {searchInput && <button className="absolute right-2.5 top-1/2 -translate-y-1/2" onClick={() => setSearchInput('')}><X size={12} style={{ color: '#6b635e' }} /></button>}
            </div>
          </div>

          {/* Estado */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#6b635e' }}>Estado</label>
            <select className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400 bg-white" value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="">Todos</option>
              <option value="activo">Activos</option>
              <option value="inactivo">Inactivos</option>
            </select>
          </div>

          {/* Municipio */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#6b635e' }}>Municipio</label>
            <select className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400 bg-white" value={municipioId} onChange={(e) => setMunicipioId(e.target.value)}>
              <option value="">Cualquiera</option>
              {municipios.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
          </div>

          {/* Sort */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#6b635e' }}>Ordenar por</label>
            <select className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400 bg-white" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="tasa_exito">Mayor tasa de éxito</option>
              <option value="mas_alumnos">Más alumnos</option>
              <option value="ultima_actividad">Última actividad</option>
              <option value="nombre">Nombre A-Z</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="py-20 text-center text-sm" style={{ color: '#6b635e' }}>Cargando gestores...</div>
      ) : !data || data.gestores.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-xl border-2" style={{ borderColor: '#eadfd7', borderStyle: 'dashed' }}>
          <UserX size={32} style={{ color: '#ddd0c5', marginBottom: 12 }} />
          <p className="text-sm font-semibold" style={{ color: '#443e39' }}>No se encontraron gestores</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {data.gestores.map((g) => (
              <GestorCard
                key={g.id}
                gestor={g}
                onViewDetail={() => setLocation(`/admin/gestores/${g.id}`)}
                onReasignar={() => setReasignarGestor(g)}
              />
            ))}
          </div>
          {data.total > data.gestores.length && (
            <p className="text-center text-sm mt-5" style={{ color: '#6b635e' }}>
              Mostrando {data.gestores.length} de {data.total} gestores
            </p>
          )}
        </>
      )}

      <SectionTour
        steps={TOUR_A_GESTORES}
        storageKey="edumich_sec_a_gestores_v1"
        gateKey={GATE_ADMIN}
        buttonLabel="Tutorial de gestores"
      />
    </AdminLayout>
  );
}
