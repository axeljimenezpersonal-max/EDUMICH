import { useEffect, useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import {
  ChevronLeft, MapPin, Mail, Phone, Users, CheckCircle, GraduationCap,
  FileText, TrendingUp, Edit, KeyRound, UserX, UserCheck, ArrowUpRight,
  AlertTriangle, X, Calendar, Gauge, Clock, Send,
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { api, calif10 } from '../../lib/api';
import { useAdminPerfil } from '../../lib/useAdmin';

// ─── Types ────────────────────────────────────────────────────────────────

type GestorDetalle = {
  id: number;
  userId: number;
  nombreCompleto: string;
  iniciales: string;
  titulo: string | null;
  email: string;
  telefono: string | null;
  municipio: { id: number; nombre: string } | null;
  estado: 'activo' | 'inactivo';
  capacidadMaxima: number;
  aulaHabilitada: boolean;
  metricas: {
    totalAlumnos: number;
    expedientesCompletos: number;
    pendientes: number;
    egresados: number;
    tasaExito: number;
    tasaExitoNivel: 'alta' | 'media' | 'baja';
  };
  ultimaActividad: string | null;
  ultimaActividadTexto: string;
  alertas: { sinReasignar: number } | null;
  alumnosNuevosEsteMes: number;
  docsPorRevisar: number;
  calificacionPromedio: number | null;
};

type Alumno = {
  id: number;
  nombreCompleto: string;
  iniciales: string;
  curp: string | null;
  email: string;
  municipio: { id: number; nombre: string } | null;
  estadoExpediente: 'activo' | 'esperando_matricula' | 'pago_pendiente' | 'en_proceso' | 'rechazado' | 'sin_documentos' | 'inactivo';
  docsAprobados: number;
  docsTotal: number;
  ultimaActividadTexto: string;
  creadoEn: string;
};

type AlumnosResp = {
  alumnos: Alumno[];
  total: number;
  page: number;
  totalPages: number;
};

type GestorSimple = { id: number; nombreCompleto: string; iniciales: string; municipioNombre: string | null };

// ─── Color helpers ────────────────────────────────────────────────────────

const ESTADO_CONFIG: Record<string, { label: string; dot: string; bg: string; color: string }> = {
  activo:              { label: 'Activo',                dot: '#2d7d46', bg: '#d1fae5', color: '#2d7d46' },
  esperando_matricula: { label: 'Esperando matrícula',   dot: '#1d4ed8', bg: '#dbeafe', color: '#1d4ed8' },
  pago_pendiente:      { label: 'Pago pendiente',        dot: '#b45309', bg: '#fff7ed', color: '#b45309' },
  en_proceso:          { label: 'En proceso',            dot: '#92400e', bg: '#fef9c3', color: '#92400e' },
  rechazado:           { label: 'Doc. rechazado',        dot: '#b91c1c', bg: '#fee2e2', color: '#b91c1c' },
  sin_documentos:      { label: 'Sin documentos',        dot: '#6b635e', bg: '#f7f2ed', color: '#6b635e' },
  inactivo:            { label: 'Inactivo',              dot: '#6b635e', bg: '#f7f2ed', color: '#6b635e' },
};

function tasaColor(nivel: 'alta' | 'media' | 'baja') {
  if (nivel === 'alta') return { text: '#2d7d46', bar: 'linear-gradient(to right, #2d7d46, #38a169)' };
  if (nivel === 'media') return { text: '#c77700', bar: 'linear-gradient(to right, #c77700, #d97706)' };
  return { text: '#b91c1c', bar: 'linear-gradient(to right, #b91c1c, #dc2626)' };
}

// ─── DesactivarGestorModal ────────────────────────────────────────────────

function DesactivarGestorModal({
  gestor,
  gestoresActivos,
  onClose,
  onSuccess,
}: {
  gestor: GestorDetalle;
  gestoresActivos: GestorSimple[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [aGestorId, setAGestorId] = useState('');
  const [razon, setRazon] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalAlumnos = gestor.metricas.totalAlumnos;

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      await api.post(`/admin/gestores/${gestor.id}/desactivar`, {
        reasignarAGestorId: aGestorId && aGestorId !== 'null' ? Number(aGestorId) : null,
        razon: razon.trim() || null,
      });
      onSuccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al desactivar gestor.');
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ background: '#b91c1c', color: 'white' }}
        >
          <h3 className="font-semibold text-base" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Desactivar gestor
          </h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center hover:opacity-80"
            style={{ background: 'rgba(255,255,255,0.15)' }}
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-6">
          <div
            className="flex items-start gap-2.5 p-3 rounded-lg mb-4 text-sm"
            style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderLeft: '3px solid #b91c1c', color: '#991b1b' }}
          >
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              Estás a punto de desactivar a <strong>{gestor.nombreCompleto}</strong>.{' '}
              {totalAlumnos > 0 && (
                <>Tiene <strong>{totalAlumnos} alumnos</strong> asignados que quedarán sin gestor si no los reasignas.</>
              )}
            </div>
          </div>

          {totalAlumnos > 0 && (
            <div className="mb-3">
              <label className="block text-xs font-semibold mb-1" style={{ color: '#443e39' }}>
                Reasignar {totalAlumnos} alumnos a otro gestor
              </label>
              <select
                className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400 bg-white"
                value={aGestorId}
                onChange={(e) => setAGestorId(e.target.value)}
              >
                <option value="">— Sin reasignar (quedan sin gestor) —</option>
                {gestoresActivos.filter((g) => g.id !== gestor.id).map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nombreCompleto}{g.municipioNombre ? ` · ${g.municipioNombre}` : ''}
                  </option>
                ))}
              </select>
              <p className="text-[11px] mt-1" style={{ color: '#6b635e' }}>Solo se muestran gestores activos</p>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-xs font-semibold mb-1" style={{ color: '#443e39' }}>
              Razón de desactivación (opcional)
            </label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400 resize-none"
              placeholder="Ej. Baja por jubilación, traslado de plaza..."
              value={razon}
              onChange={(e) => setRazon(e.target.value)}
            />
          </div>

          {error && <p className="text-xs font-medium mb-3" style={{ color: '#b91c1c' }}>{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold border border-stone-200 rounded-lg hover:bg-stone-50"
              style={{ color: '#443e39' }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50"
              style={{ background: '#b91c1c' }}
            >
              <UserX size={14} /> {saving ? 'Desactivando...' : 'Desactivar gestor'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── EditarGestorModal ────────────────────────────────────────────────────

function EditarGestorModal({
  gestor,
  onClose,
  onSuccess,
}: {
  gestor: GestorDetalle;
  onClose: () => void;
  onSuccess: (updated: Partial<GestorDetalle>) => void;
}) {
  const [form, setForm] = useState({
    nombreCompleto: gestor.nombreCompleto,
    titulo: gestor.titulo ?? '',
    telefono: gestor.telefono ?? '',
    capacidadMaxima: String(gestor.capacidadMaxima),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit() {
    if (!form.nombreCompleto.trim()) { setError('El nombre es requerido.'); return; }
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/admin/gestores/${gestor.id}`, {
        nombreCompleto: form.nombreCompleto.trim(),
        titulo: form.titulo.trim() || null,
        telefono: form.telefono.trim() || null,
        capacidadMaxima: Math.max(5, Math.min(200, Number(form.capacidadMaxima) || 50)),
      });
      onSuccess({
        nombreCompleto: form.nombreCompleto.trim(),
        titulo: form.titulo.trim() || null,
        telefono: form.telefono.trim() || null,
        capacidadMaxima: Math.max(5, Math.min(200, Number(form.capacidadMaxima) || 50)),
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar cambios.');
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
          style={{ background: 'var(--color-guinda-700)', color: 'white' }}
        >
          <h3 className="font-semibold text-base" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Editar gestor
          </h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center hover:opacity-80"
            style={{ background: 'rgba(255,255,255,0.15)' }}
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: '#443e39' }}>Nombre completo *</label>
            <input
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400"
              value={form.nombreCompleto}
              onChange={(e) => set('nombreCompleto', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: '#443e39' }}>Título / cargo</label>
            <input
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400"
              placeholder="Gestor Municipal"
              value={form.titulo}
              onChange={(e) => set('titulo', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: '#443e39' }}>Teléfono</label>
            <input
              type="tel"
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400"
              placeholder="434-342-9876"
              value={form.telefono}
              onChange={(e) => set('telefono', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: '#443e39' }}>Capacidad máxima</label>
            <input
              type="number"
              min={5}
              max={200}
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400"
              value={form.capacidadMaxima}
              onChange={(e) => set('capacidadMaxima', e.target.value)}
            />
          </div>

          {error && <p className="text-xs font-medium" style={{ color: '#b91c1c' }}>{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold border border-stone-200 rounded-lg hover:bg-stone-50"
              style={{ color: '#443e39' }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50"
              style={{ background: 'var(--color-guinda-700)' }}
            >
              <Edit size={14} /> {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MetricCard ───────────────────────────────────────────────────────────

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  iconBg,
  iconColor,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sub?: string;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: iconBg }}
        >
          <Icon size={16} style={{ color: iconColor }} />
        </div>
      </div>
      <div
        className="text-2xl font-bold mb-0.5"
        style={{ fontFamily: "'Poppins', sans-serif", color: '#1a1a1a' }}
      >
        {value}
      </div>
      <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#6b635e' }}>{label}</div>
      {sub && <div className="text-[11px] mt-0.5" style={{ color: '#a89a8e' }}>{sub}</div>}
    </div>
  );
}

// ─── Inline alumno row ────────────────────────────────────────────────────

function AlumnoRow({ alumno, onNav }: { alumno: Alumno; onNav: () => void }) {
  const estadoCfg = ESTADO_CONFIG[alumno.estadoExpediente] ?? ESTADO_CONFIG.sin_documentos;
  const pct = alumno.docsTotal > 0 ? Math.round((alumno.docsAprobados / alumno.docsTotal) * 100) : 0;
  const partes = alumno.nombreCompleto.split(' ');
  const iniciales = partes.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');

  return (
    <div
      className="grid items-center px-5 py-3 border-b border-stone-50 last:border-b-0 cursor-pointer transition-colors"
      style={{ gridTemplateColumns: '40px 1fr 120px 140px 120px 40px', gap: 12 }}
      onClick={onNav}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#fafaf9'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'white'; }}
    >
      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
        style={{ background: '#efe7d6', color: 'var(--color-guinda-700)' }}
      >
        {iniciales}
      </div>

      {/* Nombre */}
      <div>
        <div className="text-sm font-semibold truncate" style={{ fontFamily: "'Poppins', sans-serif", color: '#2a2a2a' }}>
          {alumno.nombreCompleto}
        </div>
        <div className="text-[11px] truncate" style={{ color: '#6b635e' }}>{alumno.email}</div>
      </div>

      {/* Estado */}
      <div>
        <span
          className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: estadoCfg.bg, color: estadoCfg.color }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: estadoCfg.dot }} />
          {estadoCfg.label}
        </span>
      </div>

      {/* Docs progress */}
      <div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full" style={{ background: '#eadfd7' }}>
            <div
              className="h-1.5 rounded-full"
              style={{
                width: `${pct}%`,
                background: pct === 100 ? '#2d7d46' : pct >= 50 ? '#d97706' : 'var(--color-guinda-700)',
              }}
            />
          </div>
          <span className="text-[11px] font-mono flex-shrink-0" style={{ color: '#6b635e' }}>
            {alumno.docsAprobados}/{alumno.docsTotal}
          </span>
        </div>
      </div>

      {/* Última actividad */}
      <div className="text-xs" style={{ color: '#6b635e' }}>{alumno.ultimaActividadTexto}</div>

      {/* Arrow */}
      <div className="flex items-center justify-center opacity-30 hover:opacity-70">
        <ArrowUpRight size={14} style={{ color: '#443e39' }} />
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────

export default function GestorDetalle() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute('/admin/gestores/:id');
  const gestorId = Number(params?.id);
  const { esJefe } = useAdminPerfil();

  const [gestor, setGestor] = useState<GestorDetalle | null>(null);
  const [loadingGestor, setLoadingGestor] = useState(true);
  const [gestorError, setGestorError] = useState<string | null>(null);

  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [alumnosTotal, setAlumnosTotal] = useState(0);
  const [alumnosPage, setAlumnosPage] = useState(1);
  const [alumnosTotalPages, setAlumnosTotalPages] = useState(1);
  const [loadingAlumnos, setLoadingAlumnos] = useState(false);

  const [gestoresActivos, setGestoresActivos] = useState<GestorSimple[]>([]);

  const [modal, setModal] = useState<'editar' | 'desactivar' | null>(null);
  const [toastMsg, setToastMsg] = useState<{ msg: string; ok: boolean } | null>(null);
  const [resettingPwd, setResettingPwd] = useState(false);
  const [activating, setActivating] = useState(false);

  function showToast(msg: string, ok: boolean) {
    setToastMsg({ msg, ok });
    setTimeout(() => setToastMsg(null), 4000);
  }

  useEffect(() => {
    if (!gestorId) return;
    setLoadingGestor(true);
    api.get<GestorDetalle>(`/admin/gestores/${gestorId}`)
      .then((r) => setGestor(r))
      .catch((e) => setGestorError(e instanceof Error ? e.message : 'Error al cargar gestor'))
      .finally(() => setLoadingGestor(false));

    api.get<{ gestores: GestorSimple[] }>('/admin/gestores-list')
      .then((r) => setGestoresActivos(r.gestores))
      .catch(() => {});
  }, [gestorId]);

  useEffect(() => {
    if (!gestorId) return;
    setLoadingAlumnos(true);
    api.get<AlumnosResp>(`/admin/alumnos?gestorId=${gestorId}&page=${alumnosPage}&limit=15`)
      .then((r) => {
        setAlumnos(r.alumnos);
        setAlumnosTotal(r.total);
        setAlumnosTotalPages(r.totalPages);
      })
      .catch(() => {})
      .finally(() => setLoadingAlumnos(false));
  }, [gestorId, alumnosPage]);

  async function handleResetPassword() {
    if (!gestor) return;
    if (!confirm(`¿Enviar nueva contraseña temporal a ${gestor.email}?`)) return;
    setResettingPwd(true);
    try {
      await api.post(`/admin/gestores/${gestor.id}/reset-password`, {});
      showToast('Contraseña temporal enviada al correo del gestor', true);
    } catch {
      showToast('Error al enviar contraseña temporal', false);
    } finally {
      setResettingPwd(false);
    }
  }

  const [reenviando, setReenviando] = useState(false);
  async function handleReenviarCredenciales() {
    if (!gestor) return;
    if (!confirm(`¿Reenviar las credenciales de acceso al correo ${gestor.email}? Se generará una nueva contraseña temporal.`)) return;
    setReenviando(true);
    try {
      await api.post(`/admin/gestores/${gestor.id}/reset-password`, {});
      showToast('Credenciales de acceso reenviadas al correo del gestor', true);
    } catch {
      showToast('Error al reenviar las credenciales', false);
    } finally {
      setReenviando(false);
    }
  }

  async function handleActivar() {
    if (!gestor) return;
    setActivating(true);
    try {
      await api.post(`/admin/gestores/${gestor.id}/activar`, {});
      setGestor((g) => g ? { ...g, estado: 'activo' } : g);
      showToast(`${gestor.nombreCompleto} fue reactivado`, true);
    } catch {
      showToast('Error al activar gestor', false);
    } finally {
      setActivating(false);
    }
  }

  const [togglingAula, setTogglingAula] = useState(false);
  async function handleToggleAula() {
    if (!gestor || togglingAula) return;
    const nuevo = !gestor.aulaHabilitada;
    setTogglingAula(true);
    try {
      await api.patch(`/admin/gestores/${gestor.id}`, { aulaHabilitada: nuevo });
      setGestor((g) => g ? { ...g, aulaHabilitada: nuevo } : g);
      showToast(nuevo ? 'Aula virtual activada para este gestor y sus alumnos' : 'Aula virtual desactivada', true);
    } catch {
      showToast('Error al cambiar el aula virtual', false);
    } finally {
      setTogglingAula(false);
    }
  }

  if (loadingGestor) {
    return (
      <AdminLayout>
        <div className="py-24 text-center text-sm" style={{ color: '#6b635e' }}>Cargando gestor…</div>
      </AdminLayout>
    );
  }

  if (gestorError || !gestor) {
    return (
      <AdminLayout>
        <div className="py-24 text-center">
          <p className="text-sm font-medium mb-4" style={{ color: '#b91c1c' }}>{gestorError ?? 'Gestor no encontrado'}</p>
          <button
            onClick={() => setLocation('/admin/gestores')}
            className="text-sm font-semibold"
            style={{ color: 'var(--color-guinda-700)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            ← Volver a gestores
          </button>
        </div>
      </AdminLayout>
    );
  }

  const inactivo = gestor.estado === 'inactivo';
  const tc = tasaColor(gestor.metricas.tasaExitoNivel);
  const ocupacion = gestor.capacidadMaxima > 0
    ? Math.min(100, Math.round((gestor.metricas.totalAlumnos / gestor.capacidadMaxima) * 100))
    : 0;

  return (
    <AdminLayout>
      {/* Toast */}
      {toastMsg && (
        <div
          className="fixed top-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-lg"
          style={{
            background: toastMsg.ok ? '#d1fae5' : '#fee2e2',
            color: toastMsg.ok ? '#2d7d46' : '#b91c1c',
            border: `1px solid ${toastMsg.ok ? '#a7f3d0' : '#fca5a5'}`,
          }}
        >
          {toastMsg.msg}
        </div>
      )}

      {/* Back link */}
      <button
        onClick={() => setLocation('/admin/gestores')}
        className="flex items-center gap-1.5 text-xs mb-5 hover:opacity-70 transition-opacity"
        style={{ color: 'var(--color-guinda-700)', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <ChevronLeft size={14} /> Volver a Gestores
      </button>

      {/* ── HEADER CARD ─────────────────────────────────────────── */}
      <div className="bg-white border border-stone-200 rounded-xl mb-6">
        {/* Banner — sin overflow-hidden para que el avatar sobresalga */}
        <div
          style={{
            height: 100,
            borderRadius: '12px 12px 0 0',
            background: inactivo
              ? 'linear-gradient(135deg, #6b635e 0%, #443e39 100%)'
              : 'linear-gradient(135deg, var(--color-guinda-700) 0%, #4a0e20 100%)',
            position: 'relative',
          }}
        >
          {/* Overlay decorativo */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '12px 12px 0 0',
              background: 'radial-gradient(circle at 80% 30%, rgba(255,255,255,0.18) 0%, transparent 50%)',
              pointerEvents: 'none',
            }}
          />
          <span
            className="absolute top-3 right-4 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(255,255,255,0.95)', color: inactivo ? '#6b635e' : '#2d7d46' }}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${!inactivo ? 'animate-pulse' : ''}`}
              style={{ background: inactivo ? '#6b635e' : '#2d7d46' }}
            />
            {inactivo ? 'Inactivo' : 'Activo'}
          </span>
        </div>

        {/* Info grid: avatar | texto | acciones */}
        <div
          style={{
            padding: '0 32px 24px',
            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto',
            gap: 24,
            alignItems: 'flex-end',
            position: 'relative',
          }}
        >
          {/* Avatar — sobresale 60px hacia arriba del banner */}
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: inactivo ? '#f7f2ed' : '#efe7d6',
              color: inactivo ? '#6b635e' : 'var(--color-guinda-700)',
              border: '5px solid white',
              marginTop: -60,
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 700,
              fontSize: 36,
              letterSpacing: '-0.02em',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              position: 'relative',
              zIndex: 2,
            }}
          >
            {gestor.iniciales}
          </div>

          {/* Texto */}
          <div style={{ paddingTop: 16 }}>
            <div
              className="text-[11px] font-semibold uppercase tracking-widest mb-1"
              style={{ color: '#a89a8e' }}
            >
              GESTOR · ID-{gestor.id}
            </div>
            <h1
              className="text-2xl font-bold tracking-tight mb-2"
              style={{ fontFamily: "'Poppins', sans-serif", color: '#1a1a1a' }}
            >
              {gestor.nombreCompleto}
            </h1>
            {gestor.titulo && (
              <p className="text-sm mb-2" style={{ color: '#6b635e' }}>{gestor.titulo}</p>
            )}
            {/* Pills */}
            <div className="flex items-center gap-2 flex-wrap">
              {gestor.municipio && (
                <span
                  className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full"
                  style={{ background: '#f7f2ed', color: '#443e39' }}
                >
                  <MapPin size={11} /> {gestor.municipio.nombre}
                </span>
              )}
              <span
                className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full"
                style={{ background: '#f0f0ff', color: '#4338ca' }}
              >
                <Users size={11} /> Capacidad {gestor.metricas.totalAlumnos}/{gestor.capacidadMaxima}
              </span>
            </div>
          </div>

          {/* Acciones */}
          <div style={{ paddingTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
            <button
              onClick={() => setModal('editar')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
              style={{ color: '#443e39' }}
            >
              <Edit size={12} /> Editar
            </button>
            <button
              onClick={handleResetPassword}
              disabled={resettingPwd}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors disabled:opacity-50"
              style={{ color: '#443e39' }}
            >
              <KeyRound size={12} /> {resettingPwd ? 'Enviando...' : 'Reset password'}
            </button>
            <button
              onClick={handleReenviarCredenciales}
              disabled={reenviando}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors disabled:opacity-50"
              style={{ color: '#443e39' }}
            >
              <Send size={12} /> {reenviando ? 'Enviando...' : 'Reenviar credenciales'}
            </button>
            {esJefe && (inactivo ? (
              <button
                onClick={handleActivar}
                disabled={activating}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg disabled:opacity-50"
                style={{ background: '#2d7d46' }}
              >
                <UserCheck size={12} /> {activating ? 'Activando...' : 'Reactivar'}
              </button>
            ) : (
              <button
                onClick={() => setModal('desactivar')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg"
                style={{ background: '#b91c1c' }}
              >
                <UserX size={12} /> Desactivar
              </button>
            ))}
            <button
              onClick={() => setLocation(`/admin/alumnos?gestorId=${gestor.id}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg"
              style={{ background: 'var(--color-guinda-700)' }}
            >
              <Users size={12} /> Ver alumnos
            </button>
          </div>
        </div>

        {/* Aula virtual (módulo "plus" del gestor) */}
        <div className="mx-8 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
          style={gestor.aulaHabilitada ? { borderColor: '#bbf7d0', background: '#f0fdf4' } : { borderColor: '#e7e5e4', background: '#fafaf9' }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={gestor.aulaHabilitada ? { background: '#dcfce7', color: '#166534' } : { background: '#e7e5e4', color: '#78716c' }}>
              <GraduationCap size={17} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold" style={{ color: '#443e39' }}>
                Aula virtual {gestor.aulaHabilitada
                  ? <span className="ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{ background: '#dcfce7', color: '#166534' }}>Activa</span>
                  : <span className="ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{ background: '#e7e5e4', color: '#78716c' }}>Inactiva</span>}
              </div>
              <div className="text-xs" style={{ color: '#6b635e' }}>
                Beneficio adicional del centro: foro, tareas, materiales y videos para sus alumnos.
              </div>
            </div>
          </div>
          <button onClick={handleToggleAula} disabled={togglingAula}
            className="shrink-0 px-3.5 py-1.5 text-xs font-bold rounded-lg text-white disabled:opacity-50"
            style={{ background: gestor.aulaHabilitada ? '#78716c' : '#2d7d46' }}>
            {togglingAula ? 'Guardando…' : gestor.aulaHabilitada ? 'Desactivar aula' : 'Activar aula'}
          </button>
        </div>

        {/* Meta row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mx-8 pb-6 pt-5 border-t border-stone-100">
          <div>
            <div className="text-[11px] uppercase tracking-wide font-semibold mb-0.5" style={{ color: '#a89a8e' }}>Correo</div>
            <div className="flex items-center gap-1 text-sm" style={{ color: '#443e39' }}>
              <Mail size={12} style={{ color: '#6b635e' }} />
              <span className="truncate">{gestor.email}</span>
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide font-semibold mb-0.5" style={{ color: '#a89a8e' }}>Teléfono</div>
            <div className="flex items-center gap-1 text-sm" style={{ color: '#443e39' }}>
              <Phone size={12} style={{ color: '#6b635e' }} />
              {gestor.telefono ?? <span style={{ color: '#a89a8e' }}>No registrado</span>}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide font-semibold mb-0.5" style={{ color: '#a89a8e' }}>Nuevos este mes</div>
            <div className="flex items-center gap-1 text-sm" style={{ color: '#443e39' }}>
              <Calendar size={12} style={{ color: '#6b635e' }} />
              {gestor.alumnosNuevosEsteMes} alumnos
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide font-semibold mb-0.5" style={{ color: '#a89a8e' }}>Último acceso</div>
            <div className="flex items-center gap-1 text-sm" style={{ color: '#443e39' }}>
              <Clock size={12} style={{ color: '#6b635e' }} />
              {gestor.ultimaActividadTexto}
            </div>
          </div>
        </div>
      </div>

      {/* ── METRIC CARDS ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard
          icon={Users}
          label="Alumnos asignados"
          value={gestor.metricas.totalAlumnos}
          sub={`${ocupacion}% capacidad`}
          iconBg="#ede9fe"
          iconColor="#7c3aed"
        />
        <MetricCard
          icon={CheckCircle}
          label="Expedientes completos"
          value={gestor.metricas.expedientesCompletos}
          sub={`${gestor.metricas.tasaExito}% tasa`}
          iconBg="#d1fae5"
          iconColor="#2d7d46"
        />
        <MetricCard
          icon={GraduationCap}
          label="Egresados"
          value={gestor.metricas.egresados}
          sub="21+ módulos"
          iconBg="#dbeafe"
          iconColor="#1d4ed8"
        />
        <MetricCard
          icon={FileText}
          label="Docs por revisar"
          value={gestor.docsPorRevisar}
          sub={gestor.docsPorRevisar > 0 ? 'Requiere atención' : 'Al día'}
          iconBg={gestor.docsPorRevisar > 0 ? '#fee2e2' : '#f7f2ed'}
          iconColor={gestor.docsPorRevisar > 0 ? '#b91c1c' : '#6b635e'}
        />
      </div>

      {/* ── TASA DE ÉXITO ────────────────────────────────────────── */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={14} style={{ color: tc.text }} />
            <span className="text-sm font-semibold" style={{ color: '#443e39' }}>Tasa de éxito</span>
          </div>
          <span className="text-lg font-bold" style={{ fontFamily: "'Poppins', sans-serif", color: tc.text }}>
            {gestor.metricas.tasaExito}%
          </span>
        </div>
        <div className="h-2 rounded-full" style={{ background: '#f7f2ed' }}>
          <div
            className="h-2 rounded-full transition-all"
            style={{ width: `${gestor.metricas.tasaExito}%`, background: tc.bar }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[11px]" style={{ color: '#6b635e' }}>
            {gestor.metricas.expedientesCompletos} completos de {gestor.metricas.totalAlumnos}
          </span>
          {gestor.calificacionPromedio != null && (
            <span className="text-[11px]" style={{ color: '#6b635e' }}>
              Promedio calificaciones: <strong>{calif10(gestor.calificacionPromedio)}</strong>
            </span>
          )}
        </div>

        {/* Ocupación */}
        <div className="mt-4 pt-4 border-t border-stone-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Gauge size={14} style={{ color: '#6b635e' }} />
              <span className="text-sm font-semibold" style={{ color: '#443e39' }}>Ocupación</span>
            </div>
            <span className="text-sm font-bold" style={{ color: ocupacion >= 90 ? '#b91c1c' : ocupacion >= 70 ? '#d97706' : '#443e39' }}>
              {ocupacion}%
            </span>
          </div>
          <div className="h-2 rounded-full" style={{ background: '#f7f2ed' }}>
            <div
              className="h-2 rounded-full transition-all"
              style={{
                width: `${ocupacion}%`,
                background: ocupacion >= 90
                  ? 'linear-gradient(to right, #b91c1c, #dc2626)'
                  : ocupacion >= 70
                    ? 'linear-gradient(to right, #d97706, #f59e0b)'
                    : 'linear-gradient(to right, #2d7d46, #38a169)',
              }}
            />
          </div>
          <div className="text-[11px] mt-1" style={{ color: '#6b635e' }}>
            {gestor.metricas.totalAlumnos} de {gestor.capacidadMaxima} lugares usados
          </div>
        </div>
      </div>

      {/* ── ALUMNOS ASIGNADOS ─────────────────────────────────────── */}
      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
        {/* Section header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <div>
            <h2
              className="text-base font-bold"
              style={{ fontFamily: "'Poppins', sans-serif", color: '#1a1a1a' }}
            >
              Alumnos asignados a {gestor.nombreCompleto.split(' ')[0]}
            </h2>
            <p className="text-[11px] mt-0.5" style={{ color: '#6b635e' }}>
              {alumnosTotal} alumno{alumnosTotal !== 1 ? 's' : ''} en total
            </p>
          </div>
          <button
            onClick={() => setLocation(`/admin/alumnos?gestorId=${gestor.id}`)}
            className="flex items-center gap-1.5 text-xs font-semibold"
            style={{ color: 'var(--color-guinda-700)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Ver todos <ArrowUpRight size={12} />
          </button>
        </div>

        {loadingAlumnos ? (
          <div className="py-10 text-center text-sm" style={{ color: '#6b635e' }}>Cargando alumnos…</div>
        ) : alumnos.length === 0 ? (
          <div className="py-10 text-center text-sm" style={{ color: '#6b635e' }}>
            Este gestor no tiene alumnos asignados todavía.
          </div>
        ) : (
          <>
            {/* Table header */}
            <div
              className="grid text-[11px] font-semibold uppercase tracking-wide px-5 py-2.5 border-b border-stone-100"
              style={{ gridTemplateColumns: '40px 1fr 120px 140px 120px 40px', gap: 12, background: '#fafaf9', color: '#6b635e' }}
            >
              <div />
              <div>Alumno</div>
              <div>Estado</div>
              <div>Documentos</div>
              <div>Actividad</div>
              <div />
            </div>

            {alumnos.map((a) => (
              <AlumnoRow
                key={a.id}
                alumno={a}
                onNav={() => setLocation(`/gestor/alumnos/${a.id}`)}
              />
            ))}

            {/* Pagination */}
            {alumnosTotalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-stone-100">
                <span className="text-xs" style={{ color: '#6b635e' }}>
                  Página {alumnosPage} de {alumnosTotalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAlumnosPage((p) => Math.max(1, p - 1))}
                    disabled={alumnosPage === 1}
                    className="px-3 py-1 text-xs font-semibold border border-stone-200 rounded-lg disabled:opacity-40 hover:bg-stone-50"
                    style={{ color: '#443e39' }}
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setAlumnosPage((p) => Math.min(alumnosTotalPages, p + 1))}
                    disabled={alumnosPage === alumnosTotalPages}
                    className="px-3 py-1 text-xs font-semibold border border-stone-200 rounded-lg disabled:opacity-40 hover:bg-stone-50"
                    style={{ color: '#443e39' }}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── MODALS ─────────────────────────────────────────────────── */}
      {modal === 'editar' && (
        <EditarGestorModal
          gestor={gestor}
          onClose={() => setModal(null)}
          onSuccess={(updated) => {
            setGestor((g) => g ? { ...g, ...updated } : g);
            setModal(null);
            showToast('Datos del gestor actualizados', true);
          }}
        />
      )}

      {modal === 'desactivar' && (
        <DesactivarGestorModal
          gestor={gestor}
          gestoresActivos={gestoresActivos}
          onClose={() => setModal(null)}
          onSuccess={() => {
            setGestor((g) => g ? { ...g, estado: 'inactivo' } : g);
            setModal(null);
            showToast(`${gestor.nombreCompleto} fue desactivado`, true);
          }}
        />
      )}
    </AdminLayout>
  );
}

