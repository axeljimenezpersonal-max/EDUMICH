import { useEffect, useRef, useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import {
  ChevronLeft, MapPin, Mail, Phone, Users, FileText, CreditCard,
  GraduationCap, Calendar, Clock, UserCheck, KeyRound, Send,
  CheckCircle, XCircle, AlertTriangle, Clock3, X, ThumbsUp, ThumbsDown,
  Award, Plus, Edit2, Download, RefreshCw,
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { api } from '../../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────

type Alumno = {
  id: number;
  nombreCompleto: string;
  iniciales: string;
  curp: string | null;
  fechaNacimiento: string | null;
  telefono: string | null;
  direccion: string | null;
  municipio: { id: number; nombre: string } | null;
  gestor: { id: number; nombreCompleto: string; email: string } | null;
  email: string;
  passwordTemporal: boolean;
  bienvenidaEnviadaEn: string | null;
  ultimaActividad: string | null;
  estadoExpediente: 'activo' | 'esperando_matricula' | 'pago_pendiente' | 'en_proceso' | 'rechazado' | 'sin_documentos' | 'inactivo';
  docsAprobados: number;
  docsTotal: number;
  creadoEn: string;
  folioPreregistro?: string | null;
  preregistroVigenteHasta?: string | null;
  matriculaOficialDGB?: string | null;
  matriculaCapturadaEn?: string | null;
};

type Documento = {
  id: number;
  tipo: string;
  estado: string;
  motivoRechazo: string | null;
  rutaArchivo: string;
  nombreOriginal: string;
  tamanoBytes: number | null;
  subidoEn: string;
  revisadoEn: string | null;
};

type Pago = {
  id: number;
  concepto: string;
  conceptoDetalle: string | null;
  monto: string;
  fechaPago: string;
  metodoPago: string;
  estado: string;
  motivoRechazo: string | null;
  notas: string | null;
  createdAt: string;
};

type Examen = {
  id: number;
  moduloId: number;
  moduloNumero: number | null;
  moduloNombre: string | null;
  etapaId: number;
  etapaClave: string | null;
  etapaFase: string | null;
  etapaAnio: number | null;
  estado: string;
  calificacion: number | null;
  createdAt: string;
};

type DetalleResp = {
  alumno: Alumno;
  documentos: Documento[];
  pagos: Pago[];
  examenes: Examen[];
};

type ActiveTab = 'docs' | 'pagos' | 'examenes';

// ─── Helpers ──────────────────────────────────────────────────────────────

const ESTADO_EXP_CFG: Record<string, { label: string; dot: string; bg: string; color: string }> = {
  activo:              { label: 'Activo',                dot: '#2d7d46', bg: '#d1fae5', color: '#2d7d46' },
  esperando_matricula: { label: 'Esperando matrícula',   dot: '#1d4ed8', bg: '#dbeafe', color: '#1d4ed8' },
  pago_pendiente:      { label: 'Pago pendiente',        dot: '#b45309', bg: '#fff7ed', color: '#b45309' },
  en_proceso:          { label: 'En proceso',            dot: '#92400e', bg: '#fef9c3', color: '#92400e' },
  rechazado:           { label: 'Doc. rechazado',        dot: '#b91c1c', bg: '#fee2e2', color: '#b91c1c' },
  sin_documentos:      { label: 'Sin documentos',        dot: '#78716c', bg: '#f5f5f4', color: '#78716c' },
  inactivo:            { label: 'Inactivo',              dot: '#78716c', bg: '#f5f5f4', color: '#78716c' },
};

const DOC_TIPO_LABEL: Record<string, string> = {
  curp: 'CURP',
  acta_nacimiento: 'Acta de nacimiento',
  ine: 'Identificación oficial',
  comprobante_domicilio: 'Comprobante de domicilio',
  foto: 'Fotografía',
  certificado_secundaria: 'Certificado de secundaria',
  otro: 'Otro',
};

const DOC_ESTADO_CFG: Record<string, { label: string; icon: typeof CheckCircle; color: string; bg: string }> = {
  aprobado:           { label: 'Aprobado',                 icon: CheckCircle,    color: '#2d7d46', bg: '#d1fae5' },
  pendiente_revision: { label: 'Pendiente de aprobación',  icon: Clock3,         color: '#92400e', bg: '#fef9c3' },
  rechazado:          { label: 'Rechazado',                icon: XCircle,        color: '#b91c1c', bg: '#fee2e2' },
  pendiente:          { label: 'Sin subir',                icon: AlertTriangle,  color: '#b45309', bg: '#fff7ed' },
};

const PAGO_ESTADO_CFG: Record<string, { label: string; color: string; bg: string }> = {
  pendiente:   { label: 'Pendiente',   color: '#b45309', bg: '#fff7ed' },
  verificado:  { label: 'Verificado',  color: '#2d7d46', bg: '#d1fae5' },
  rechazado:   { label: 'Rechazado',   color: '#b91c1c', bg: '#fee2e2' },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function vigenciaInfo(vigenteHasta: string | null | undefined): { label: string; bg: string; color: string; border: string; diasRestantes: number | null } {
  if (!vigenteHasta) return { label: 'Sin vigencia', bg: '#f5f5f4', color: '#78716c', border: '#e7e5e4', diasRestantes: null };
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const fecha = new Date(vigenteHasta + 'T00:00:00');
  const dias = Math.ceil((fecha.getTime() - hoy.getTime()) / 86_400_000);
  if (dias <= 0) return { label: 'VENCIDA', bg: '#fee2e2', color: '#991b1b', border: '#fca5a5', diasRestantes: dias };
  if (dias <= 3) return { label: `POR VENCER · ${dias}d`, bg: '#fef9c3', color: '#854d0e', border: '#fde047', diasRestantes: dias };
  return { label: `VIGENTE · ${dias}d`, bg: '#d1fae5', color: '#166534', border: '#86efac', diasRestantes: dias };
}

function calcEdad(fechaNacimiento: string | null): number | null {
  if (!fechaNacimiento) return null;
  const d = new Date(fechaNacimiento);
  const hoy = new Date();
  let edad = hoy.getFullYear() - d.getFullYear();
  if (hoy.getMonth() < d.getMonth() || (hoy.getMonth() === d.getMonth() && hoy.getDate() < d.getDate())) edad--;
  return edad;
}

// ─── Sub-components ───────────────────────────────────────────────────────

function DocRow({
  doc,
  onAprobar,
  onRechazar,
}: {
  doc: Documento;
  onAprobar: (doc: Documento) => void;
  onRechazar: (doc: Documento) => void;
}) {
  const cfg = DOC_ESTADO_CFG[doc.estado] ?? DOC_ESTADO_CFG.pendiente;
  const Icon = cfg.icon;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-stone-50 last:border-b-0">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: cfg.bg }}
      >
        <Icon size={15} style={{ color: cfg.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold" style={{ color: '#2a2a2a' }}>
            {DOC_TIPO_LABEL[doc.tipo] ?? doc.tipo}
          </span>
          <span
            className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
            style={{ background: cfg.bg, color: cfg.color }}
          >
            {cfg.label}
          </span>
        </div>
        <div className="text-xs mt-0.5 truncate" style={{ color: '#78716c' }}>
          {doc.nombreOriginal}
        </div>
        {doc.motivoRechazo && (
          <div className="text-xs mt-1 px-2 py-1 rounded" style={{ background: '#fee2e2', color: '#b91c1c' }}>
            Motivo: {doc.motivoRechazo}
          </div>
        )}
        <div className="text-[11px] mt-1" style={{ color: '#a8a29e' }}>
          Subido {fmtDate(doc.subidoEn)}
          {doc.revisadoEn && ` · Revisado ${fmtDate(doc.revisadoEn)}`}
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
        <a
          href={`/api/admin/alumnos/${doc.tipo}/expediente/preview`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-2.5 py-1 text-xs font-semibold border rounded-lg transition-colors"
          style={{ color: '#44403c', border: '1px solid #d6d3d1', background: 'white' }}
          title="Ver PDF"
        >
          Ver PDF
        </a>
        {doc.estado === 'pendiente_revision' && (
          <>
            <button
              onClick={() => onAprobar(doc)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold border rounded-lg transition-colors"
              style={{ color: '#2d7d46', border: '1px solid #86efac', background: '#f0fdf4' }}
              title="Aprobar documento"
            >
              <ThumbsUp size={11} /> Aprobar
            </button>
            <button
              onClick={() => onRechazar(doc)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold border rounded-lg transition-colors"
              style={{ color: '#b91c1c', border: '1px solid #fca5a5', background: 'white' }}
              title="Rechazar documento"
            >
              <ThumbsDown size={11} /> Rechazar
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Modal: aprobar documento ─────────────────────────────────────────
function ModalAprobar({
  doc,
  onConfirm,
  onCancel,
  loading,
}: {
  doc: Documento;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#d1fae5' }}>
            <CheckCircle size={20} style={{ color: '#2d7d46' }} />
          </div>
          <div>
            <h3 className="font-bold text-base" style={{ color: '#1a1a1a' }}>¿Aprobar este documento?</h3>
            <p className="text-xs" style={{ color: '#78716c' }}>El documento se contabilizará como completo en el expediente.</p>
          </div>
        </div>
        <div className="rounded-xl p-3 mb-5" style={{ background: '#f5f5f4' }}>
          <div className="text-sm font-semibold mb-0.5" style={{ color: '#1a1a1a' }}>{DOC_TIPO_LABEL[doc.tipo] ?? doc.tipo}</div>
          <div className="text-xs" style={{ color: '#78716c' }}>{doc.nombreOriginal}</div>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-semibold border border-stone-200 rounded-xl"
            style={{ color: '#44403c' }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm font-semibold rounded-xl disabled:opacity-60"
            style={{ background: '#2d7d46', color: 'white' }}
          >
            {loading ? 'Aprobando…' : 'Sí, aprobar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: rechazar documento ────────────────────────────────────────
const MOTIVOS_RAPIDOS = ['Documento ilegible', 'Documento incompleto', 'Tipo de documento incorrecto', 'Documento vencido'];

function ModalRechazar({
  doc,
  onConfirm,
  onCancel,
  loading,
}: {
  doc: Documento;
  onConfirm: (motivo: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [motivo, setMotivo] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#fee2e2' }}>
            <XCircle size={20} style={{ color: '#b91c1c' }} />
          </div>
          <div>
            <h3 className="font-bold text-base" style={{ color: '#1a1a1a' }}>Rechazar documento</h3>
            <p className="text-xs" style={{ color: '#78716c' }}>{DOC_TIPO_LABEL[doc.tipo] ?? doc.tipo} · {doc.nombreOriginal}</p>
          </div>
        </div>
        <div className="mb-3">
          <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#78716c' }}>
            Motivo del rechazo <span style={{ color: '#b91c1c' }}>*</span>
          </label>
          <textarea
            ref={textareaRef}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="El alumno verá esta razón para volver a subir el documento…"
            rows={3}
            className="w-full text-sm border rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2"
            style={{ border: '1px solid #d6d3d1', color: '#1a1a1a' }}
          />
        </div>
        <div className="flex flex-wrap gap-1.5 mb-5">
          {MOTIVOS_RAPIDOS.map((m) => (
            <button
              key={m}
              onClick={() => { setMotivo(m); textareaRef.current?.focus(); }}
              className="text-[11px] px-2.5 py-1 border rounded-full transition-colors"
              style={{
                border: motivo === m ? '1px solid #b91c1c' : '1px solid #d6d3d1',
                background: motivo === m ? '#fee2e2' : 'white',
                color: motivo === m ? '#b91c1c' : '#44403c',
              }}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-semibold border border-stone-200 rounded-xl"
            style={{ color: '#44403c' }}
          >
            Cancelar
          </button>
          <button
            onClick={() => motivo.trim() && onConfirm(motivo.trim())}
            disabled={loading || !motivo.trim()}
            className="px-4 py-2 text-sm font-semibold rounded-xl disabled:opacity-60"
            style={{ background: '#b91c1c', color: 'white' }}
          >
            {loading ? 'Rechazando…' : 'Rechazar documento'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PagoRow({ pago }: { pago: Pago }) {
  const cfg = PAGO_ESTADO_CFG[pago.estado] ?? PAGO_ESTADO_CFG.pendiente;
  const monto = parseFloat(pago.monto);
  return (
    <div className="flex items-center gap-3 py-3 border-b border-stone-50 last:border-b-0">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: cfg.bg }}
      >
        <CreditCard size={15} style={{ color: cfg.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold" style={{ color: '#2a2a2a' }}>
            {pago.conceptoDetalle ?? pago.concepto}
          </span>
          <span
            className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
            style={{ background: cfg.bg, color: cfg.color }}
          >
            {cfg.label}
          </span>
        </div>
        <div className="text-xs mt-0.5" style={{ color: '#78716c' }}>
          {pago.metodoPago} · {fmtDate(pago.fechaPago)}
        </div>
        {pago.motivoRechazo && (
          <div className="text-xs mt-1 px-2 py-1 rounded" style={{ background: '#fee2e2', color: '#b91c1c' }}>
            {pago.motivoRechazo}
          </div>
        )}
      </div>
      <div className="text-sm font-bold flex-shrink-0" style={{ color: '#1a1a1a' }}>
        ${monto.toFixed(2)} MXN
      </div>
    </div>
  );
}

function ExamenRow({ examen }: { examen: Examen }) {
  const aprobado = examen.calificacion !== null && examen.calificacion >= 60;
  const pendiente = examen.estado === 'inscrito' || examen.estado === 'presentado';
  return (
    <div className="flex items-center gap-3 py-3 border-b border-stone-50 last:border-b-0">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
        style={{
          background: examen.calificacion === null ? '#f5f5f4' : aprobado ? '#d1fae5' : '#fee2e2',
          color: examen.calificacion === null ? '#78716c' : aprobado ? '#2d7d46' : '#b91c1c',
        }}
      >
        {examen.calificacion !== null ? examen.calificacion : '—'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold" style={{ color: '#2a2a2a' }}>
          {examen.moduloNombre ?? (examen.moduloNumero !== null ? `Módulo ${examen.moduloNumero}` : `Módulo ${examen.moduloId}`)}
        </div>
        <div className="text-xs mt-0.5" style={{ color: '#78716c' }}>
          {examen.etapaClave ?? `Etapa ${examen.etapaId}`}
          {examen.etapaFase && ` · ${examen.etapaFase}`}
          {examen.etapaAnio && ` ${examen.etapaAnio}`}
        </div>
      </div>
      <span
        className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex-shrink-0"
        style={{
          background: pendiente ? '#fff7ed' : aprobado ? '#d1fae5' : '#fee2e2',
          color: pendiente ? '#b45309' : aprobado ? '#2d7d46' : '#b91c1c',
        }}
      >
        {pendiente ? 'Pendiente' : aprobado ? 'Aprobado' : 'Reprobado'}
      </span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────

export default function AdminAlumnoDetalle() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute('/admin/alumnos/:id');
  const alumnoId = Number(params?.id);

  const [data, setData] = useState<DetalleResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('docs');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [resettingPwd, setResettingPwd] = useState(false);
  const [reenviando, setReenviando] = useState(false);

  const [modalAprobar, setModalAprobar] = useState<Documento | null>(null);
  const [modalRechazar, setModalRechazar] = useState<Documento | null>(null);
  const [docActionLoading, setDocActionLoading] = useState(false);

  const [modalMatricula, setModalMatricula] = useState<{ matriculaActual: string | null } | null>(null);
  const [matriculaInput, setMatriculaInput] = useState('');
  const [matriculaConfirmado, setMatriculaConfirmado] = useState(false);
  const [matriculaSaving, setMatriculaSaving] = useState(false);
  const [matriculaError, setMatriculaError] = useState('');
  const [renovando, setRenovando] = useState(false);

  useEffect(() => {
    if (modalMatricula !== null) {
      setMatriculaInput(modalMatricula.matriculaActual ?? '');
      setMatriculaConfirmado(false);
      setMatriculaError('');
    }
  }, [modalMatricula]);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  useEffect(() => {
    if (!alumnoId) return;
    setLoading(true);
    api.get<DetalleResp>(`/admin/alumnos/${alumnoId}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error al cargar alumno'))
      .finally(() => setLoading(false));
  }, [alumnoId]);

  async function handleResetPassword() {
    if (!data) return;
    if (!confirm(`¿Enviar contraseña temporal a ${data.alumno.email}?`)) return;
    setResettingPwd(true);
    try {
      await api.post(`/admin/gestores/${alumnoId}/reset-password`, {});
      showToast('Contraseña temporal enviada al correo del alumno', true);
    } catch {
      showToast('Error al enviar contraseña temporal', false);
    } finally {
      setResettingPwd(false);
    }
  }

  async function handleAprobarDoc(doc: Documento) {
    setDocActionLoading(true);
    try {
      await api.patch(`/admin/expediente-documentos/${doc.id}/aprobar`, {});
      showToast('Documento aprobado', true);
      setModalAprobar(null);
      const fresh = await api.get<DetalleResp>(`/admin/alumnos/${alumnoId}`);
      setData(fresh);
    } catch (e) {
      showToast((e as Error).message || 'Error al aprobar documento', false);
    } finally {
      setDocActionLoading(false);
    }
  }

  async function handleRechazarDoc(doc: Documento, motivo: string) {
    setDocActionLoading(true);
    try {
      await api.patch(`/admin/expediente-documentos/${doc.id}/rechazar`, { motivoRechazo: motivo });
      showToast('Documento rechazado. El alumno deberá volver a subir el documento.', false);
      setModalRechazar(null);
      const fresh = await api.get<DetalleResp>(`/admin/alumnos/${alumnoId}`);
      setData(fresh);
    } catch (e) {
      showToast((e as Error).message || 'Error al rechazar documento', false);
    } finally {
      setDocActionLoading(false);
    }
  }

  async function handleReenviarCredenciales() {
    if (!data) return;
    setReenviando(true);
    try {
      await api.post(`/admin/alumnos/${alumnoId}/reenviar-credenciales`, {});
      showToast('Credenciales reenviadas al correo del alumno', true);
    } catch {
      showToast('Error al reenviar credenciales', false);
    } finally {
      setReenviando(false);
    }
  }

  async function handleRenovarPreregistro() {
    if (!confirm('¿Renovar la ficha de pre-registro? Se extenderá 15 días hábiles desde hoy.')) return;
    setRenovando(true);
    try {
      await api.post(`/admin/alumnos/${alumnoId}/renovar-preregistro`, {});
      showToast('Pre-registro renovado por 15 días hábiles', true);
      const fresh = await api.get<DetalleResp>(`/admin/alumnos/${alumnoId}`);
      setData(fresh);
    } catch {
      showToast('Error al renovar pre-registro', false);
    } finally {
      setRenovando(false);
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="py-24 text-center text-sm" style={{ color: '#78716c' }}>Cargando alumno…</div>
      </AdminLayout>
    );
  }

  if (error || !data) {
    return (
      <AdminLayout>
        <div className="py-24 text-center">
          <p className="text-sm font-medium mb-4" style={{ color: '#b91c1c' }}>{error ?? 'Alumno no encontrado'}</p>
          <button
            onClick={() => setLocation('/admin/alumnos')}
            className="text-sm font-semibold"
            style={{ color: 'var(--color-guinda-700)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            ← Volver a alumnos
          </button>
        </div>
      </AdminLayout>
    );
  }

  const { alumno, documentos, pagos: pagosData, examenes } = data;
  const expCfg = ESTADO_EXP_CFG[alumno.estadoExpediente] ?? ESTADO_EXP_CFG.sin_documentos;
  const edad = calcEdad(alumno.fechaNacimiento);

  const TABS: { key: ActiveTab; label: string; icon: typeof FileText; count?: number }[] = [
    { key: 'docs',    label: 'Documentos',   icon: FileText,     count: documentos.length },
    { key: 'pagos',   label: 'Pagos',        icon: CreditCard,   count: pagosData.length },
    { key: 'examenes', label: 'Evaluaciones', icon: GraduationCap, count: examenes.length },
  ];

  return (
    <AdminLayout>
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-lg"
          style={{
            background: toast.ok ? '#d1fae5' : '#fee2e2',
            color: toast.ok ? '#2d7d46' : '#b91c1c',
            border: `1px solid ${toast.ok ? '#a7f3d0' : '#fca5a5'}`,
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* Back */}
      <button
        onClick={() => setLocation('/admin/alumnos')}
        className="flex items-center gap-1.5 text-xs mb-5 hover:opacity-70 transition-opacity"
        style={{ color: 'var(--color-guinda-700)', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <ChevronLeft size={14} /> Volver a Alumnos
      </button>

      {/* ── HEADER CARD ─────────────────────────────────────────── */}
      <div className="bg-white border border-stone-200 rounded-xl mb-6">
        {/* Banner */}
        <div
          style={{
            height: 100,
            borderRadius: '12px 12px 0 0',
            background: 'linear-gradient(135deg, var(--color-guinda-700) 0%, #5C1428 100%)',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '12px 12px 0 0',
              background: 'radial-gradient(circle at 80% 30%, rgba(255,255,255,0.18) 0%, transparent 50%)',
              pointerEvents: 'none',
            }}
          />
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
          {/* Avatar */}
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#efe7d6',
              color: 'var(--color-guinda-700)',
              border: '5px solid white',
              marginTop: -60,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: 700,
              fontSize: 36,
              letterSpacing: '-0.02em',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              position: 'relative',
              zIndex: 2,
            }}
          >
            {alumno.iniciales}
          </div>

          {/* Texto */}
          <div style={{ paddingTop: 16 }}>
            <div className="text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: '#a8a29e' }}>
              ALUMNO · ID-{alumno.id}
            </div>
            <h1
              className="text-2xl font-bold tracking-tight mb-2"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#1a1a1a' }}
            >
              {alumno.nombreCompleto}
            </h1>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                style={{ background: expCfg.bg, color: expCfg.color }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: expCfg.dot }} />
                {expCfg.label}
              </span>
              {alumno.municipio && (
                <span
                  className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full"
                  style={{ background: '#f5f5f4', color: '#44403c' }}
                >
                  <MapPin size={11} /> {alumno.municipio.nombre}
                </span>
              )}
              {alumno.gestor && (
                <span
                  className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full"
                  style={{ background: '#ede9fe', color: '#7c3aed' }}
                >
                  <Users size={11} /> {alumno.gestor.nombreCompleto.split(' ').slice(0, 2).join(' ')}
                </span>
              )}
              {alumno.passwordTemporal && (
                <span
                  className="flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                  style={{ background: '#fff7ed', color: '#c77700' }}
                >
                  Contraseña temporal
                </span>
              )}
            </div>
          </div>

          {/* Acciones */}
          <div style={{ paddingTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
            <button
              onClick={handleResetPassword}
              disabled={resettingPwd}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors disabled:opacity-50"
              style={{ color: '#44403c' }}
            >
              <KeyRound size={12} /> {resettingPwd ? 'Enviando...' : 'Reset password'}
            </button>
            <button
              onClick={handleReenviarCredenciales}
              disabled={reenviando}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors disabled:opacity-50"
              style={{ color: '#44403c' }}
            >
              <Send size={12} /> {reenviando ? 'Enviando...' : 'Reenviar credenciales'}
            </button>
            {alumno.gestor && (
              <button
                onClick={() => setLocation(`/admin/gestores/${alumno.gestor!.id}`)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg"
                style={{ background: 'var(--color-guinda-700)' }}
              >
                <UserCheck size={12} /> Ver gestor
              </button>
            )}
          </div>
        </div>

        {/* Meta row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mx-8 pb-6 pt-5 border-t border-stone-100">
          <div>
            <div className="text-[11px] uppercase tracking-wide font-semibold mb-0.5" style={{ color: '#a8a29e' }}>Correo</div>
            <div className="flex items-center gap-1 text-sm" style={{ color: '#44403c' }}>
              <Mail size={12} style={{ color: '#78716c' }} />
              <span className="truncate">{alumno.email}</span>
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide font-semibold mb-0.5" style={{ color: '#a8a29e' }}>Teléfono</div>
            <div className="flex items-center gap-1 text-sm" style={{ color: '#44403c' }}>
              <Phone size={12} style={{ color: '#78716c' }} />
              {alumno.telefono ?? <span style={{ color: '#a8a29e' }}>No registrado</span>}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide font-semibold mb-0.5" style={{ color: '#a8a29e' }}>CURP</div>
            <div className="text-sm font-mono" style={{ color: '#44403c' }}>
              {alumno.curp ?? <span style={{ color: '#a8a29e', fontFamily: 'inherit', fontWeight: 400 }}>No registrada</span>}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide font-semibold mb-0.5" style={{ color: '#a8a29e' }}>Registro</div>
            <div className="flex items-center gap-1 text-sm" style={{ color: '#44403c' }}>
              <Calendar size={12} style={{ color: '#78716c' }} />
              {fmtDate(alumno.creadoEn)}
              {edad !== null && <span style={{ color: '#a8a29e' }}> · {edad} años</span>}
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI STRIP ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Documentos', value: `${alumno.docsAprobados}/${alumno.docsTotal}`, sub: 'aprobados', icon: FileText, bg: '#fbe6ea', color: 'var(--color-guinda-700)' },
          { label: 'Pagos',      value: pagosData.length, sub: 'registrados',  icon: CreditCard,   bg: '#ede9fe', color: '#7c3aed' },
          { label: 'Evaluaciones', value: examenes.length, sub: 'realizadas',  icon: GraduationCap, bg: '#d1fae5', color: '#2d7d46' },
          { label: 'Último acceso', value: alumno.ultimaActividad ? fmtDate(alumno.ultimaActividad) : '—', sub: '', icon: Clock, bg: '#f5f5f4', color: '#44403c' },
        ].map((k) => (
          <div key={k.label} className="bg-white border border-stone-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: k.bg }}>
                <k.icon size={14} style={{ color: k.color }} />
              </div>
              <span className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: '#a8a29e' }}>{k.label}</span>
            </div>
            <div className="text-xl font-bold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#1a1a1a' }}>{k.value}</div>
            {k.sub && <div className="text-xs mt-0.5" style={{ color: '#78716c' }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* ── MATRÍCULA OFICIAL DGB ───────────────────────────────── */}
      {!alumno.matriculaOficialDGB ? (
        <div style={{ background: '#fff', border: '1px solid #e7e5e4', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#efe7d6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Award size={18} style={{ color: 'var(--color-guinda-700)' }} />
            </div>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: '#2a2a2a' }}>Matrícula oficial DGB</h3>
              <p style={{ fontSize: 12, color: '#78716c', margin: '3px 0 0' }}>Aún no se ha capturado la matrícula oficial asignada por la SEP-DGB.</p>
            </div>
          </div>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#1d4ed8', marginBottom: 14 }}>
            Una vez que la SEP-DGB asigne la matrícula, captúrala aquí para generar la <strong>Ficha de Registro Oficial</strong>.
          </div>
          <button onClick={() => setModalMatricula({ matriculaActual: null })} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: 'var(--color-guinda-700)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <Plus size={13} /> Capturar matrícula oficial
          </button>
        </div>
      ) : (
        <div style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #fff 100%)', border: '1px solid #86efac', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Award size={18} style={{ color: '#16a34a' }} />
            </div>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: '#2a2a2a' }}>Matrícula oficial DGB</h3>
              <p style={{ fontSize: 12, color: '#78716c', margin: '3px 0 0' }}>
                Capturada el {alumno.matriculaCapturadaEn ? new Date(alumno.matriculaCapturadaEn).toLocaleDateString('es-MX', {day:'numeric',month:'short',year:'numeric'}) : '—'}
              </p>
            </div>
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #e7e5e4', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#78716c', marginBottom: 3 }}>MATRÍCULA</div>
              <div style={{ fontFamily: "'JetBrains Mono', 'Courier New', monospace", fontSize: 22, fontWeight: 700, color: 'var(--color-guinda-700)', letterSpacing: '0.05em' }}>
                {alumno.matriculaOficialDGB}
              </div>
            </div>
            <button onClick={() => setModalMatricula({ matriculaActual: alumno.matriculaOficialDGB! })} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', border: '1px solid #e7e5e4', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12, color: '#44403c' }}>
              <Edit2 size={12} /> Editar
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a href={`/api/admin/alumnos/${alumnoId}/ficha-registro`} target="_blank" rel="noopener" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#16a34a', color: 'white', borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
              <Download size={12} /> Ficha de registro PDF
            </a>
            <a href={`/api/admin/alumnos/${alumnoId}/ficha-preregistro`} target="_blank" rel="noopener" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1px solid #e7e5e4', borderRadius: 8, fontSize: 12, color: '#44403c', textDecoration: 'none' }}>
              <FileText size={12} /> Ficha de pre-registro
            </a>
          </div>
        </div>
      )}

      {/* ── FOLIO PRE-REGISTRO ──────────────────────────────────── */}
      {alumno.folioPreregistro && (() => {
        const vig = vigenciaInfo(alumno.preregistroVigenteHasta);
        return (
          <div style={{ background: '#fff', border: '1px solid #e7e5e4', borderRadius: 12, padding: '16px 24px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#efe7d6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <FileText size={18} style={{ color: 'var(--color-guinda-700)' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#a8a29e', marginBottom: 3 }}>Folio de pre-registro</div>
              <div style={{ fontFamily: "'JetBrains Mono', 'Courier New', monospace", fontSize: 16, fontWeight: 700, color: 'var(--color-guinda-700)', letterSpacing: '0.04em' }}>
                {alumno.folioPreregistro}
              </div>
              {alumno.preregistroVigenteHasta && (
                <div style={{ fontSize: 11, color: '#78716c', marginTop: 2 }}>
                  Vigente hasta {new Date(alumno.preregistroVigenteHasta + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              )}
            </div>
            <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', border: `1px solid ${vig.border}`, background: vig.bg, color: vig.color, flexShrink: 0 }}>
              {vig.label}
            </span>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <a href={`/api/admin/alumnos/${alumnoId}/ficha-preregistro`} target="_blank" rel="noopener" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', border: '1px solid #e7e5e4', borderRadius: 6, background: '#fff', textDecoration: 'none', fontSize: 12, color: '#44403c' }}>
                <Download size={12} /> Descargar
              </a>
              {!alumno.matriculaOficialDGB && (
                <button onClick={handleRenovarPreregistro} disabled={renovando} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', border: '1px solid #e7e5e4', borderRadius: 6, background: vig.diasRestantes !== null && vig.diasRestantes <= 0 ? 'var(--color-guinda-700)' : '#fff', color: vig.diasRestantes !== null && vig.diasRestantes <= 0 ? 'white' : '#44403c', cursor: 'pointer', fontSize: 12, opacity: renovando ? 0.5 : 1 }}>
                  <RefreshCw size={12} /> {renovando ? 'Renovando...' : 'Renovar'}
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── TABS ────────────────────────────────────────────────── */}
      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-stone-100">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className="flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-colors"
              style={{
                color: activeTab === t.key ? 'var(--color-guinda-700)' : '#78716c',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === t.key ? '2px solid var(--color-guinda-700)' : '2px solid transparent',
                cursor: 'pointer',
              }}
            >
              <t.icon size={14} />
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: activeTab === t.key ? '#fbe6ea' : '#f5f5f4', color: activeTab === t.key ? 'var(--color-guinda-700)' : '#78716c' }}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-5">
          {activeTab === 'docs' && (
            documentos.length === 0
              ? <p className="text-sm text-center py-8" style={{ color: '#a8a29e' }}>No hay documentos registrados</p>
              : documentos.map((d) => (
                  <DocRow
                    key={d.id}
                    doc={d}
                    onAprobar={(doc) => setModalAprobar(doc)}
                    onRechazar={(doc) => setModalRechazar(doc)}
                  />
                ))
          )}
          {activeTab === 'pagos' && (
            pagosData.length === 0
              ? <p className="text-sm text-center py-8" style={{ color: '#a8a29e' }}>No hay pagos registrados</p>
              : pagosData.map((p) => <PagoRow key={p.id} pago={p} />)
          )}
          {activeTab === 'examenes' && (
            examenes.length === 0
              ? <p className="text-sm text-center py-8" style={{ color: '#a8a29e' }}>No hay evaluaciones registradas</p>
              : examenes.map((e) => <ExamenRow key={e.id} examen={e} />)
          )}
        </div>
      </div>
      {/* Modal aprobar */}
      {modalAprobar && (
        <ModalAprobar
          doc={modalAprobar}
          loading={docActionLoading}
          onConfirm={() => handleAprobarDoc(modalAprobar)}
          onCancel={() => setModalAprobar(null)}
        />
      )}

      {/* Modal rechazar */}
      {modalRechazar && (
        <ModalRechazar
          doc={modalRechazar}
          loading={docActionLoading}
          onConfirm={(motivo) => handleRechazarDoc(modalRechazar, motivo)}
          onCancel={() => setModalRechazar(null)}
        />
      )}

      {modalMatricula !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={e => { if (e.target === e.currentTarget) setModalMatricula(null); }}>
          <div style={{ background: '#fff', borderRadius: 12, width: 520, maxWidth: '95vw', padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#2a2a2a' }}>
                  {modalMatricula.matriculaActual ? 'Editar matrícula oficial DGB' : 'Capturar matrícula oficial DGB'}
                </h2>
                <p style={{ fontSize: 12, color: '#78716c', marginTop: 4, marginBottom: 0 }}>
                  Ingresa la matrícula que la SEP-DGB asignó a este alumno.
                </p>
              </div>
              <button onClick={() => setModalMatricula(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#78716c' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ background: '#faf9f8', border: '1px solid #e7e5e4', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#2a2a2a' }}>{alumno.nombreCompleto}</div>
              <div style={{ fontSize: 12, color: '#78716c' }}>CURP: {alumno.curp}</div>
              {alumno.folioPreregistro && <div style={{ fontSize: 12, color: '#78716c' }}>Pre-registro: {alumno.folioPreregistro}</div>}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#57534e', display: 'block', marginBottom: 6 }}>Matrícula oficial DGB *</label>
              <input
                type="text"
                value={matriculaInput}
                onChange={e => setMatriculaInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="Ej. 26016000142X"
                maxLength={20}
                style={{ width: '100%', border: '1px solid #e7e5e4', borderRadius: 6, padding: '9px 12px', fontSize: 15, fontFamily: 'monospace', letterSpacing: '0.05em', background: '#faf9f8' }}
              />
              <div style={{ fontSize: 11, color: '#78716c', marginTop: 4 }}>Entre 8 y 20 caracteres alfanuméricos. Tal como la asignó la SEP-DGB.</div>
            </div>

            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: '#44403c', cursor: 'pointer', marginBottom: 16 }}>
              <input type="checkbox" checked={matriculaConfirmado} onChange={e => setMatriculaConfirmado(e.target.checked)} style={{ marginTop: 2 }} />
              <span>Confirmo que esta matrícula fue asignada oficialmente por la SEP-DGB y corresponde a este alumno.</span>
            </label>

            {matriculaError && <div style={{ color: '#be123c', fontSize: 12, padding: '8px 12px', background: '#fff1f2', borderRadius: 6, marginBottom: 12 }}>{matriculaError}</div>}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalMatricula(null)} style={{ padding: '9px 20px', border: '1px solid #e7e5e4', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
              <button
                disabled={matriculaSaving || matriculaInput.length < 8 || !matriculaConfirmado}
                onClick={async () => {
                  if (matriculaInput.length < 8 || matriculaInput.length > 20) { setMatriculaError('La matrícula debe tener entre 8 y 20 caracteres alfanuméricos'); return; }
                  if (!matriculaConfirmado) { setMatriculaError('Debes confirmar que la matrícula es correcta'); return; }
                  setMatriculaSaving(true);
                  setMatriculaError('');
                  try {
                    await api.post(`/admin/alumnos/${alumnoId}/matricula`, { matricula: matriculaInput });
                    setModalMatricula(null);
                    const updated = await api.get<DetalleResp>(`/admin/alumnos/${alumnoId}`);
                    setData(updated);
                  } catch (ex: unknown) {
                    setMatriculaError(ex instanceof Error ? ex.message : 'Error al guardar');
                  } finally {
                    setMatriculaSaving(false);
                  }
                }}
                style={{ padding: '9px 20px', borderRadius: 8, background: 'var(--color-guinda-700)', color: 'white', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: (matriculaInput.length < 8 || !matriculaConfirmado) ? 0.5 : 1 }}
              >
                {matriculaSaving ? 'Guardando...' : 'Guardar matrícula'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
