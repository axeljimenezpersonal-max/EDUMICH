import { useEffect, useRef, useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import {
  ChevronLeft, MapPin, Mail, Phone, Users, FileText, CreditCard,
  GraduationCap, Calendar, Clock, UserCheck, KeyRound, Send,
  CheckCircle, XCircle, AlertTriangle, Clock3, X, ThumbsUp, ThumbsDown,
  Award, Plus, Edit2, Download, RefreshCw, BadgeCheck, Loader2, ClipboardList,
  CalendarClock, ExternalLink, Trash2,
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { api, calif10 } from '../../lib/api';
import { ConfirmModal } from '../../components/ConfirmModal';
import CalificacionesTabContent from '../../components/CalificacionesTabContent';
import { CedulaEditor } from '../../components/CedulaEditor';
import { CredencialPreview } from '../../components/CredencialPreview';

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
  estadoExpediente: 'activo' | 'esperando_matricula' | 'modulos_pendientes' | 'pago_pendiente' | 'en_proceso' | 'rechazado' | 'sin_documentos' | 'inactivo';
  docsAprobados: number;
  docsTotal: number;
  creadoEn: string;
  folioPreregistro?: string | null;
  preregistroVigenteHasta?: string | null;
  matriculaOficialDGB?: string | null;
  matriculaCapturadaEn?: string | null;
  licenciaDigital?: string | null;
  licenciaEmitidaEn?: string | null;
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
  dia: string | null;
  hora: string | null;
  fechaExamen: string | null;
  estado: string;
  moduloEstado: 'pagado' | 'en_pago' | 'solicitado';
  calificacion: number | null;
  createdAt: string;
};

type OrdenPago = {
  id: number;
  folio: string | null;
  estado: string;
  montoTotal: string;
  cantidadExamenes: number;
  fechaVencimiento: string | null;
  esGrupal: boolean;
  modulosAlumno: string | null;
};

type DetalleResp = {
  alumno: Alumno;
  documentos: Documento[];
  pagos: Pago[];
  examenes: Examen[];
  ordenesPago: OrdenPago[];
};

const ORDEN_PAGO_CFG: Record<string, { label: string; bg: string; color: string }> = {
  pendiente_emision: { label: 'Por emitir',    bg: '#fef9c3', color: '#92400e' },
  emitida:           { label: 'Emitida',       bg: '#dbeafe', color: '#1e40af' },
  en_revision:       { label: 'En revisión',   bg: '#ede9fe', color: '#6d28d9' },
  pagado:            { label: 'Pagado',        bg: '#d1fae5', color: '#166534' },
  vencido:           { label: 'Vencido',       bg: '#fee2e2', color: '#b91c1c' },
  cancelado:         { label: 'Cancelado',     bg: '#f5f5f4', color: '#78716c' },
};

type ActiveTab = 'docs' | 'cedula' | 'pagos' | 'modulos' | 'examenes' | 'credencial';

// ─── Helpers ──────────────────────────────────────────────────────────────

const ESTADO_EXP_CFG: Record<string, { label: string; dot: string; bg: string; color: string }> = {
  activo:              { label: 'Activo',                dot: '#2d7d46', bg: '#d1fae5', color: '#2d7d46' },
  esperando_matricula: { label: 'Esperando matrícula',   dot: '#1d4ed8', bg: '#dbeafe', color: '#1d4ed8' },
  modulos_pendientes:  { label: 'Módulos pendientes',    dot: '#2563eb', bg: '#dbeafe', color: '#1e40af' },
  pago_pendiente:      { label: 'Pago pendiente',        dot: '#ea580c', bg: '#ffedd5', color: '#c2410c' },
  en_proceso:          { label: 'En proceso',            dot: '#92400e', bg: '#fef9c3', color: '#92400e' },
  rechazado:           { label: 'Doc. rechazado',        dot: '#b91c1c', bg: '#fee2e2', color: '#b91c1c' },
  sin_documentos:      { label: 'Sin documentos',        dot: '#6b635e', bg: '#f7f2ed', color: '#6b635e' },
  inactivo:            { label: 'Inactivo',              dot: '#6b635e', bg: '#f7f2ed', color: '#6b635e' },
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

// Lista canónica de documentos obligatorios del expediente (los 5).
const DOCS_REQUERIDOS: { tipo: string; label: string; descripcion: string }[] = [
  { tipo: 'curp', label: 'CURP', descripcion: 'Clave Única de Registro de Población (PDF oficial)' },
  { tipo: 'acta_nacimiento', label: 'Acta de nacimiento', descripcion: 'Acta oficial o copia certificada' },
  { tipo: 'ine', label: 'Identificación oficial', descripcion: 'INE / IFE vigente por ambos lados' },
  { tipo: 'comprobante_domicilio', label: 'Comprobante de domicilio', descripcion: 'No mayor a 3 meses de antigüedad' },
  { tipo: 'certificado_secundaria', label: 'Certificado de secundaria', descripcion: 'Certificado o constancia de secundaria' },
];

// Documentos opcionales que igual se muestran y se verifican.
// REGLA: la fotografía se usa para la credencial digital del alumno.
const DOCS_OPCIONALES: { tipo: string; label: string; descripcion: string; nota?: string }[] = [
  { tipo: 'foto', label: 'Fotografía', descripcion: 'Foto tipo selfie/normal, rostro de frente y fondo claro (JPG o PNG)', nota: 'Se usa para la credencial digital y la cédula. Se ajusta automáticamente a cualquier tamaño.' },
];

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
  if (!vigenteHasta) return { label: 'Sin vigencia', bg: '#f7f2ed', color: '#6b635e', border: '#eadfd7', diasRestantes: null };
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
  alumnoId,
  onAprobar,
  onRechazar,
}: {
  doc: Documento;
  alumnoId: number;
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
        <div className="text-xs mt-0.5 truncate" style={{ color: '#6b635e' }}>
          {doc.nombreOriginal}
        </div>
        {doc.motivoRechazo && (
          <div className="text-xs mt-1 px-2 py-1 rounded" style={{ background: '#fee2e2', color: '#b91c1c' }}>
            Motivo: {doc.motivoRechazo}
          </div>
        )}
        <div className="text-[11px] mt-1" style={{ color: '#a89a8e' }}>
          Subido {fmtDate(doc.subidoEn)}
          {doc.revisadoEn && ` · Revisado ${fmtDate(doc.revisadoEn)}`}
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
        <a
          href={`/api/admin/alumnos/${alumnoId}/expediente/${doc.tipo}/preview`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-2.5 py-1 text-xs font-semibold border rounded-lg transition-colors"
          style={{ color: '#443e39', border: '1px solid #ddd0c5', background: 'white' }}
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
        {doc.estado === 'aprobado' && (
          <button
            onClick={() => onRechazar(doc)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold border rounded-lg transition-colors"
            style={{ color: '#b91c1c', border: '1px solid #fca5a5', background: 'white' }}
            title="Revertir aprobación y rechazar"
          >
            <ThumbsDown size={11} /> Rechazar
          </button>
        )}
      </div>
    </div>
  );
}

// Fila para un documento que el alumno AÚN NO ha subido (obligatorio u opcional).
function DocFaltante({ label, descripcion, opcional }: { label: string; descripcion: string; opcional?: boolean }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-stone-50 last:border-b-0">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: '#f5f5f4' }}>
        <Clock3 size={15} style={{ color: '#a8a29e' }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold" style={{ color: '#57534e' }}>{label}</span>
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: '#f5f5f4', color: '#a8a29e' }}>
            {opcional ? 'Opcional · falta' : 'Falta subir'}
          </span>
        </div>
        <div className="text-xs mt-0.5" style={{ color: '#a89a8e' }}>{descripcion}</div>
        <div className="text-[11px] mt-1" style={{ color: '#c4bcb2' }}>El alumno o su gestor aún no lo ha subido.</div>
      </div>
    </div>
  );
}

// Checklist completo: muestra los 5 obligatorios (subidos o no) + adicionales.
function DocumentosChecklist({
  documentos, alumnoId, onAprobar, onRechazar,
}: {
  documentos: Documento[];
  alumnoId: number;
  onAprobar: (doc: Documento) => void;
  onRechazar: (doc: Documento) => void;
}) {
  const porTipo = new Map(documentos.map((d) => [d.tipo, d]));
  const tiposReq = new Set(DOCS_REQUERIDOS.map((r) => r.tipo));
  const tiposOpc = new Set(DOCS_OPCIONALES.map((r) => r.tipo));
  const subidos = DOCS_REQUERIDOS.filter((r) => porTipo.has(r.tipo)).length;
  const aprobados = DOCS_REQUERIDOS.filter((r) => porTipo.get(r.tipo)?.estado === 'aprobado').length;
  const adicionales = documentos.filter((d) => !tiposReq.has(d.tipo) && !tiposOpc.has(d.tipo));
  const pct = Math.round((aprobados / DOCS_REQUERIDOS.length) * 100);

  return (
    <div>
      {/* Cabecera con progreso */}
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <h4 className="text-xs font-bold uppercase tracking-widest text-stone-500">Documentos obligatorios</h4>
        <span className="text-[11px] font-semibold" style={{ color: aprobados === DOCS_REQUERIDOS.length ? '#2d7d46' : '#6b635e' }}>
          {aprobados}/{DOCS_REQUERIDOS.length} aprobados · {subidos}/{DOCS_REQUERIDOS.length} subidos
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: '#eadfd7' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct >= 100 ? '#2d7d46' : 'var(--color-guinda-700)' }} />
      </div>

      {DOCS_REQUERIDOS.map((r) => {
        const doc = porTipo.get(r.tipo);
        return doc
          ? <DocRow key={r.tipo} doc={doc} alumnoId={alumnoId} onAprobar={onAprobar} onRechazar={onRechazar} />
          : <DocFaltante key={r.tipo} label={r.label} descripcion={r.descripcion} />;
      })}

      {/* Documentos para la credencial (se muestran siempre y también se verifican) */}
      <h4 className="text-xs font-bold uppercase tracking-widest text-stone-500 mt-5 mb-2">Documentos para la credencial</h4>
      {DOCS_OPCIONALES.map((r) => {
        const doc = porTipo.get(r.tipo);
        return (
          <div key={r.tipo}>
            {doc
              ? <DocRow doc={doc} alumnoId={alumnoId} onAprobar={onAprobar} onRechazar={onRechazar} />
              : <DocFaltante label={r.label} descripcion={r.descripcion} opcional />}
            {r.nota && (
              <div className="flex items-center gap-1.5 text-[11px] font-medium ml-11 -mt-1.5 mb-2" style={{ color: 'var(--color-guinda-700)' }}>
                <BadgeCheck size={12} className="shrink-0" /> {r.nota}
              </div>
            )}
          </div>
        );
      })}

      {adicionales.length > 0 && (
        <>
          <h4 className="text-xs font-bold uppercase tracking-widest text-stone-500 mt-5 mb-2">Documentos adicionales</h4>
          {adicionales.map((d) => (
            <DocRow key={d.id} doc={d} alumnoId={alumnoId} onAprobar={onAprobar} onRechazar={onRechazar} />
          ))}
        </>
      )}
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
            <p className="text-xs" style={{ color: '#6b635e' }}>El documento se contabilizará como completo en el expediente.</p>
          </div>
        </div>
        <div className="rounded-xl p-3 mb-5" style={{ background: '#f7f2ed' }}>
          <div className="text-sm font-semibold mb-0.5" style={{ color: '#1a1a1a' }}>{DOC_TIPO_LABEL[doc.tipo] ?? doc.tipo}</div>
          <div className="text-xs" style={{ color: '#6b635e' }}>{doc.nombreOriginal}</div>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-semibold border border-stone-200 rounded-xl"
            style={{ color: '#443e39' }}
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
            <p className="text-xs" style={{ color: '#6b635e' }}>{DOC_TIPO_LABEL[doc.tipo] ?? doc.tipo} · {doc.nombreOriginal}</p>
          </div>
        </div>
        <div className="mb-3">
          <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#6b635e' }}>
            Motivo del rechazo <span style={{ color: '#b91c1c' }}>*</span>
          </label>
          <textarea
            ref={textareaRef}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="El alumno verá esta razón para volver a subir el documento…"
            rows={3}
            className="w-full text-sm border rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2"
            style={{ border: '1px solid #ddd0c5', color: '#1a1a1a' }}
          />
        </div>
        <div className="flex flex-wrap gap-1.5 mb-5">
          {MOTIVOS_RAPIDOS.map((m) => (
            <button
              key={m}
              onClick={() => { setMotivo(m); textareaRef.current?.focus(); }}
              className="text-[11px] px-2.5 py-1 border rounded-full transition-colors"
              style={{
                border: motivo === m ? '1px solid #b91c1c' : '1px solid #ddd0c5',
                background: motivo === m ? '#fee2e2' : 'white',
                color: motivo === m ? '#b91c1c' : '#443e39',
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
            style={{ color: '#443e39' }}
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
        <div className="text-xs mt-0.5" style={{ color: '#6b635e' }}>
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

// ─── Módulos inscritos (por convocatoria + tiempo de aplicación) ────────────
function fmtFechaExamen(iso: string): string {
  const s = new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Estado del módulo según el proceso de pago: Solicitado → En pago → Inscrito (pagado, verde).
const MODULO_ESTADO_CFG: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  pagado:     { label: 'Inscrito',    bg: '#d1fae5', color: '#166534', dot: '#16a34a' },
  en_pago:    { label: 'En pago',     bg: '#dbeafe', color: '#1e40af', dot: '#2563eb' },
  solicitado: { label: 'Solicitado',  bg: '#fef9c3', color: '#854d0e', dot: '#d97706' },
};

const MAX_MODULOS_POR_ETAPA = 4;

function ModulosInscritos({ examenes, alumnoId, onChanged, showToast }: {
  examenes: Examen[];
  alumnoId: number;
  onChanged: () => Promise<void> | void;
  showToast: (msg: string, ok: boolean) => void;
}) {
  const [inscribirOpen, setInscribirOpen] = useState(false);
  const [quitarTarget, setQuitarTarget] = useState<Examen | null>(null);
  const [quitando, setQuitando] = useState(false);

  async function handleQuitar(e: Examen) {
    setQuitando(true);
    try {
      await api.delete(`/admin/estudiantes/${alumnoId}/examenes/${e.id}`);
      showToast('Módulo quitado del alumno.', true);
      setQuitarTarget(null);
      await onChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo quitar el módulo', false);
    } finally {
      setQuitando(false);
    }
  }

  // Agrupar por convocatoria (etapa)
  const grupos = new Map<number, { clave: string; anio: number | null; items: Examen[] }>();
  for (const e of examenes) {
    let g = grupos.get(e.etapaId);
    if (!g) { g = { clave: e.etapaClave ?? `Etapa #${e.etapaId}`, anio: e.etapaAnio, items: [] }; grupos.set(e.etapaId, g); }
    g.items.push(e);
  }

  return (
    <div className="space-y-4">
      {/* Barra de acción */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs" style={{ color: '#6b635e' }}>
          Máximo <strong>{MAX_MODULOS_POR_ETAPA} módulos</strong> por convocatoria.
        </p>
        <button
          onClick={() => setInscribirOpen(true)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg text-white shadow-sm hover:opacity-90"
          style={{ background: 'var(--color-guinda-700)' }}
        >
          <Plus size={14} /> Inscribir módulo
        </button>
      </div>

      {examenes.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: '#a89a8e' }}>Este alumno no tiene módulos inscritos todavía.</p>
      ) : (
        [...grupos.values()].map((g) => (
          <div key={g.clave} style={{ border: '1px solid #eadfd7', borderRadius: 12, overflow: 'hidden' }}>
            {/* Encabezado de la convocatoria */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'linear-gradient(135deg,#fbf7f8,#fff)', borderBottom: '1px solid #f0e9e3' }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: '#fbe6ea', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CalendarClock size={17} style={{ color: 'var(--color-guinda-700)' }} />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#a89a8e' }}>Convocatoria</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#2a2a2a', fontFamily: "'Poppins', sans-serif" }}>{g.clave}{g.anio ? ` · ${g.anio}` : ''}</div>
              </div>
              <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: g.items.length > MAX_MODULOS_POR_ETAPA ? '#b91c1c' : '#6b635e' }}>
                {g.items.length} de {MAX_MODULOS_POR_ETAPA} módulos{g.items.length > MAX_MODULOS_POR_ETAPA ? ' · excede el máximo' : ''}
              </span>
            </div>
            {/* Módulos con su tiempo de aplicación */}
            <div>
              {g.items.map((e) => {
                const cfg = MODULO_ESTADO_CFG[e.moduloEstado] ?? MODULO_ESTADO_CFG.solicitado;
                // Se puede quitar solo si no tiene orden de pago y no se presentó.
                const removible = e.moduloEstado === 'solicitado' && e.estado !== 'presentado';
                return (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: '1px solid #f7f2ed' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: '#2a2a2a' }}>
                        {e.moduloNumero != null ? `Módulo ${e.moduloNumero} — ` : ''}{e.moduloNombre ?? 'Módulo'}
                      </div>
                      <div style={{ fontSize: 12, color: '#6b635e', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <CalendarClock size={12} style={{ color: '#a89a8e', flexShrink: 0 }} />
                        {e.fechaExamen ? fmtFechaExamen(e.fechaExamen) : 'Fecha por definir'}
                        {e.hora && <span style={{ color: '#a89a8e' }}>· {e.hora} h</span>}
                      </div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '3px 9px', borderRadius: 99, background: cfg.bg, color: cfg.color, flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 6, height: 6, borderRadius: 99, background: cfg.dot }} />
                      {cfg.label}
                    </span>
                    {removible ? (
                      <button
                        onClick={() => setQuitarTarget(e)}
                        title="Quitar módulo"
                        className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-stone-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : (
                      <span className="flex-shrink-0 w-7 h-7" title="No se puede quitar: tiene pago o ya se presentó" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {inscribirOpen && (
        <InscribirModuloModal
          alumnoId={alumnoId}
          onClose={() => setInscribirOpen(false)}
          onDone={async () => { setInscribirOpen(false); await onChanged(); }}
          showToast={showToast}
        />
      )}

      {quitarTarget && (
        <ConfirmModal
          danger
          icon={<Trash2 size={18} />}
          title="Quitar módulo"
          message={<>¿Quitar <strong>{quitarTarget.moduloNombre ?? `Módulo ${quitarTarget.moduloNumero}`}</strong> de la convocatoria <strong>{quitarTarget.etapaClave}</strong>? La inscripción se eliminará.</>}
          confirmLabel={quitando ? 'Quitando…' : 'Quitar módulo'}
          onConfirm={() => handleQuitar(quitarTarget)}
          onClose={() => { if (!quitando) setQuitarTarget(null); }}
        />
      )}
    </div>
  );
}

// Modal para inscribir módulos (admin): elige convocatoria → módulos (respeta máx. 4).
type ModuloOpcion = { id: number; numero: number | null; nombre: string | null; dia: string; hora: string; yaInscrito: boolean };
type EtapaOpcion = { id: number; clave: string; anio: number; estado: string; nombreCompleto: string };

function InscribirModuloModal({ alumnoId, onClose, onDone, showToast }: {
  alumnoId: number;
  onClose: () => void;
  onDone: () => Promise<void> | void;
  showToast: (msg: string, ok: boolean) => void;
}) {
  const [etapas, setEtapas] = useState<EtapaOpcion[]>([]);
  const [etapaId, setEtapaId] = useState<number | ''>('');
  const [modulos, setModulos] = useState<ModuloOpcion[]>([]);
  const [activos, setActivos] = useState(0);
  const [maxModulos, setMaxModulos] = useState(MAX_MODULOS_POR_ETAPA);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [loadingMods, setLoadingMods] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<{ etapas: EtapaOpcion[] }>('/admin/etapas').then((r) => setEtapas(r.etapas)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!etapaId) { setModulos([]); setSel(new Set()); return; }
    setLoadingMods(true); setSel(new Set());
    api.get<{ modulos: ModuloOpcion[]; activos: number; maxModulos: number }>(`/admin/estudiantes/${alumnoId}/convocatoria/${etapaId}/modulos`)
      .then((r) => { setModulos(r.modulos); setActivos(r.activos); setMaxModulos(r.maxModulos); })
      .catch(() => { setModulos([]); })
      .finally(() => setLoadingMods(false));
  }, [etapaId, alumnoId]);

  const cupo = Math.max(0, maxModulos - activos); // cuántos más puede inscribir
  const puedeMas = cupo - sel.size;

  function toggle(m: ModuloOpcion) {
    if (m.yaInscrito) return;
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(m.id)) { n.delete(m.id); return n; }
      if (n.size >= cupo) return prev; // no exceder el cupo
      n.add(m.id);
      return n;
    });
  }

  async function guardar() {
    if (!etapaId || sel.size === 0) return;
    setSaving(true);
    try {
      const r = await api.post<{ inscritos: unknown[]; excedeLimite: number[]; conflicto: number[]; maxModulos: number }>(
        `/admin/estudiantes/${alumnoId}/inscribir-examen`,
        { etapaId: Number(etapaId), modulosIds: [...sel] }
      );
      const n = r.inscritos?.length ?? 0;
      if (n > 0) showToast(`${n} módulo${n === 1 ? '' : 's'} inscrito${n === 1 ? '' : 's'}.`, true);
      if (r.excedeLimite?.length) showToast(`Máximo ${r.maxModulos} módulos por convocatoria; ${r.excedeLimite.length} no se inscribieron.`, false);
      else if (r.conflicto?.length) showToast(`${r.conflicto.length} módulo(s) con choque de horario.`, false);
      else if (n === 0) showToast('No se inscribió ningún módulo.', false);
      await onDone();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo inscribir', false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(20,10,15,0.45)', backdropFilter: 'blur(2px)' }} onClick={() => { if (!saving) onClose(); }}>
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <h3 className="font-serif text-lg font-bold text-stone-900">Inscribir módulos</h3>
          <button onClick={() => { if (!saving) onClose(); }} className="text-stone-400 hover:text-stone-600"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1 uppercase tracking-widest">Convocatoria</label>
            <select
              value={String(etapaId)}
              onChange={(e) => setEtapaId(e.target.value ? Number(e.target.value) : '')}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-guinda-700)]"
            >
              <option value="">Selecciona convocatoria…</option>
              {etapas.map((e) => <option key={e.id} value={e.id}>{e.clave} · {e.anio}</option>)}
            </select>
          </div>

          {etapaId !== '' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-stone-600 uppercase tracking-widest">Módulos ofertados</label>
                <span className={`text-xs font-semibold ${cupo === 0 ? 'text-red-600' : 'text-stone-500'}`}>
                  {activos} de {maxModulos} inscritos · {puedeMas > 0 ? `puedes agregar ${puedeMas}` : 'sin cupo'}
                </span>
              </div>
              {loadingMods ? (
                <div className="py-8 text-center text-sm text-stone-400"><Loader2 size={16} className="inline animate-spin" /> Cargando módulos…</div>
              ) : modulos.length === 0 ? (
                <p className="py-6 text-center text-sm text-stone-400">Esta convocatoria no tiene módulos con horario configurado.</p>
              ) : (
                <div className="max-h-64 overflow-y-auto rounded-lg border border-stone-200 divide-y divide-stone-100">
                  {modulos.map((m) => {
                    const checked = sel.has(m.id);
                    const disabled = m.yaInscrito || (!checked && sel.size >= cupo);
                    return (
                      <button
                        key={m.id}
                        onClick={() => toggle(m)}
                        disabled={disabled}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[var(--color-crema-50)]'}`}
                      >
                        <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${checked ? 'border-[var(--color-guinda-700)] bg-[var(--color-guinda-700)]' : 'border-stone-300'}`}>
                          {checked && <CheckCircle size={12} className="text-white" />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium text-stone-800">
                            {m.numero != null ? `Módulo ${m.numero} — ` : ''}{m.nombre ?? 'Módulo'}
                          </span>
                          <span className="block text-[11px] text-stone-500 capitalize">{m.dia} · {m.hora} h {m.yaInscrito && '· ya inscrito'}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-2 px-6 py-4 border-t border-stone-100">
          <button onClick={() => { if (!saving) onClose(); }} className="flex-1 py-2.5 rounded-lg border border-stone-300 text-stone-600 text-sm font-semibold hover:bg-stone-50">Cancelar</button>
          <button
            onClick={guardar}
            disabled={saving || sel.size === 0}
            className="flex-1 py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            style={{ background: 'var(--color-guinda-700)' }}
          >
            {saving ? <><Loader2 size={14} className="animate-spin" /> Inscribiendo…</> : <>Inscribir {sel.size > 0 ? `(${sel.size})` : ''}</>}
          </button>
        </div>
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
          background: examen.calificacion === null ? '#f7f2ed' : aprobado ? '#d1fae5' : '#fee2e2',
          color: examen.calificacion === null ? '#6b635e' : aprobado ? '#2d7d46' : '#b91c1c',
        }}
      >
        {examen.calificacion !== null ? calif10(examen.calificacion) : '—'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold" style={{ color: '#2a2a2a' }}>
          {examen.moduloNombre ?? (examen.moduloNumero !== null ? `Módulo ${examen.moduloNumero}` : `Módulo ${examen.moduloId}`)}
        </div>
        <div className="text-xs mt-0.5" style={{ color: '#6b635e' }}>
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
  const [emitiendo, setEmitiendo] = useState(false);
  const [modalLicencia, setModalLicencia] = useState<null | 'renovar' | 'reponer'>(null);
  const [confirmarLicencia, setConfirmarLicencia] = useState(false);

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

  // ── Asignar / cambiar gestor (centro de asesoría) ──
  const [asignandoGestor, setAsignandoGestor] = useState(false);
  const [gestoresLista, setGestoresLista] = useState<{ id: number; nombreCompleto: string; municipio: { nombre: string } | null }[]>([]);
  const [gestorSel, setGestorSel] = useState('');
  const [guardandoGestor, setGuardandoGestor] = useState(false);

  async function abrirAsignarGestor() {
    setGestorSel(String(data?.alumno.gestor?.id ?? ''));
    setAsignandoGestor(true);
    try {
      const r = await api.get<{ gestores: { id: number; nombreCompleto: string; municipio: { nombre: string } | null }[] }>('/admin/gestores?limit=100');
      setGestoresLista(r.gestores ?? []);
    } catch {
      showToast('No se pudo cargar la lista de gestores', false);
      setAsignandoGestor(false);
    }
  }
  async function handleAsignarGestor() {
    setGuardandoGestor(true);
    try {
      await api.post(`/admin/alumnos/${alumnoId}/asignar-gestor`, { gestorId: gestorSel ? Number(gestorSel) : null });
      const fresh = await api.get<DetalleResp>(`/admin/alumnos/${alumnoId}`);
      setData(fresh);
      setAsignandoGestor(false);
      showToast(gestorSel ? 'Gestor asignado al alumno' : 'Gestor removido del alumno', true);
    } catch (e) {
      showToast((e as Error).message || 'Error al asignar gestor', false);
    } finally {
      setGuardandoGestor(false);
    }
  }

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

  async function handleEmitirLicencia() {
    setConfirmarLicencia(false);
    setEmitiendo(true);
    try {
      await api.post(`/admin/alumnos/${alumnoId}/licencia`, {});
      showToast('Credencial digital emitida correctamente', true);
      const fresh = await api.get<DetalleResp>(`/admin/alumnos/${alumnoId}`);
      setData(fresh);
    } catch (e) {
      showToast((e as Error).message || 'Error al emitir la credencial', false);
    } finally {
      setEmitiendo(false);
    }
  }

  async function handleRenovarLicencia(motivo: 'vencimiento' | 'reposicion') {
    setModalLicencia(null);
    setEmitiendo(true);
    try {
      await api.post(`/admin/alumnos/${alumnoId}/renovar-licencia`, { motivo });
      showToast(motivo === 'reposicion' ? 'Credencial repuesta (folio nuevo)' : 'Credencial renovada', true);
      const fresh = await api.get<DetalleResp>(`/admin/alumnos/${alumnoId}`);
      setData(fresh);
    } catch (e) {
      showToast((e as Error).message || 'Error al renovar la credencial', false);
    } finally {
      setEmitiendo(false);
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="py-24 text-center text-sm" style={{ color: '#6b635e' }}>Cargando alumno…</div>
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

  const { alumno, documentos, pagos: pagosData, examenes, ordenesPago } = data;
  const expCfg = ESTADO_EXP_CFG[alumno.estadoExpediente] ?? ESTADO_EXP_CFG.sin_documentos;
  const edad = calcEdad(alumno.fechaNacimiento);

  const TABS: { key: ActiveTab; label: string; icon: typeof FileText; count?: number }[] = [
    { key: 'docs',    label: 'Documentos',   icon: FileText,     count: documentos.length },
    { key: 'cedula',  label: 'Cédula',       icon: ClipboardList },
    { key: 'modulos', label: 'Módulos inscritos', icon: CalendarClock, count: examenes.length },
    { key: 'pagos',   label: 'Pagos',        icon: CreditCard,   count: pagosData.length },
    { key: 'examenes', label: 'Calificaciones', icon: GraduationCap, count: examenes.length },
    { key: 'credencial', label: 'Credencial digital', icon: BadgeCheck },
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

      {/* ── HEADER CARD (fondo guinda) ──────────────────────────── */}
      <div className="border border-stone-200 rounded-xl mb-6 overflow-hidden">
        {/* Bloque del alumno sobre fondo guinda degradado izquierda→derecha */}
        <div style={{ background: 'linear-gradient(90deg, var(--color-guinda-800) 0%, var(--color-guinda-600) 100%)', padding: '20px 24px' }}>
          <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {/* Avatar */}
            <div style={{
              width: 88, height: 88, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#efe7d6', color: 'var(--color-guinda-700)', border: '4px solid rgba(255,255,255,0.9)',
              fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 30, letterSpacing: '-0.02em',
              flexShrink: 0, boxShadow: '0 3px 12px rgba(0,0,0,0.18)',
            }}>
              {alumno.iniciales}
            </div>

            {/* Nombre + badges */}
            <div style={{ flex: 1, minWidth: 220 }}>
              <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.65)' }}>
                ALUMNO · ID-{alumno.id}
              </div>
              <h1 className="text-2xl font-bold tracking-tight leading-tight" style={{ fontFamily: "'Poppins', sans-serif", color: '#ffffff' }}>
                {alumno.nombreCompleto}
              </h1>
              <div className="flex items-center gap-2 flex-wrap mt-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: expCfg.bg, color: expCfg.color }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: expCfg.dot }} />
                  {expCfg.label}
                </span>
                {alumno.municipio && (
                  <span className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.92)', color: '#443e39' }}>
                    <MapPin size={11} /> {alumno.municipio.nombre}
                  </span>
                )}
                {alumno.gestor && (
                  <span className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: '#ede9fe', color: '#7c3aed' }}>
                    <Users size={11} /> {alumno.gestor.nombreCompleto.split(' ').slice(0, 2).join(' ')}
                  </span>
                )}
                {alumno.passwordTemporal && (
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: '#fff7ed', color: '#c77700' }}>
                    Contraseña temporal
                  </span>
                )}
              </div>
            </div>

            {/* Acciones (sobre el guinda) */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
              <button onClick={handleResetPassword} disabled={resettingPwd}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                style={{ color: '#fff', border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.08)' }}>
                <KeyRound size={12} /> {resettingPwd ? 'Enviando...' : 'Reset password'}
              </button>
              <button onClick={handleReenviarCredenciales} disabled={reenviando}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                style={{ color: '#fff', border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.08)' }}>
                <Send size={12} /> {reenviando ? 'Enviando...' : 'Reenviar credenciales'}
              </button>
              <button onClick={abrirAsignarGestor}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors"
                style={{ color: '#fff', border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.08)' }}>
                <Users size={12} /> {alumno.gestor ? 'Cambiar gestor' : 'Asignar gestor'}
              </button>
              {alumno.gestor && (
                <button onClick={() => setLocation(`/admin/gestores/${alumno.gestor!.id}`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg"
                  style={{ background: '#fff', color: 'var(--color-guinda-700)' }}>
                  <UserCheck size={12} /> Ver gestor
                </button>
              )}
            </div>
          </div>

          {/* Selector de gestor (centro de asesoría) */}
          {asignandoGestor && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.12)' }}>
              <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.75)' }}>Centro de asesoría / gestor:</span>
              <select value={gestorSel} onChange={(e) => setGestorSel(e.target.value)}
                className="min-w-[220px] rounded-lg border-0 px-3 py-1.5 text-xs font-semibold focus:outline-none"
                style={{ background: '#fff', color: '#443e39' }}>
                <option value="">— Sin gestor —</option>
                {gestoresLista.map((g) => (
                  <option key={g.id} value={g.id}>{g.nombreCompleto}{g.municipio ? ` · ${g.municipio.nombre}` : ''}</option>
                ))}
              </select>
              <button onClick={handleAsignarGestor} disabled={guardandoGestor}
                className="px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-50"
                style={{ background: '#fff', color: 'var(--color-guinda-700)' }}>
                {guardandoGestor ? 'Guardando…' : 'Guardar'}
              </button>
              <button onClick={() => setAsignandoGestor(false)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg"
                style={{ color: '#fff', border: '1px solid rgba(255,255,255,0.4)' }}>
                Cancelar
              </button>
            </div>
          )}
        </div>

        {/* Meta con etiquetas (fondo blanco) */}
        <div className="bg-white grid grid-cols-2 md:grid-cols-4 gap-4 px-6 py-4">
          <div>
            <div className="text-[11px] uppercase tracking-wide font-semibold mb-0.5" style={{ color: '#a89a8e' }}>Correo</div>
            <div className="flex items-center gap-1.5 text-sm" style={{ color: '#443e39' }}>
              <Mail size={13} style={{ color: '#6b635e' }} /><span className="truncate">{alumno.email}</span>
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide font-semibold mb-0.5" style={{ color: '#a89a8e' }}>Teléfono</div>
            <div className="flex items-center gap-1.5 text-sm" style={{ color: '#443e39' }}>
              <Phone size={13} style={{ color: '#6b635e' }} />{alumno.telefono ?? <span style={{ color: '#a89a8e' }}>No registrado</span>}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide font-semibold mb-0.5" style={{ color: '#a89a8e' }}>CURP</div>
            <div className="text-sm font-mono" style={{ color: '#443e39' }}>
              {alumno.curp ?? <span style={{ color: '#a89a8e', fontFamily: 'inherit' }}>No registrada</span>}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide font-semibold mb-0.5" style={{ color: '#a89a8e' }}>Registro</div>
            <div className="flex items-center gap-1.5 text-sm" style={{ color: '#443e39' }}>
              <Calendar size={13} style={{ color: '#6b635e' }} />{fmtDate(alumno.creadoEn)}{edad !== null && <span style={{ color: '#a89a8e' }}> · {edad} años</span>}
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
          { label: 'Último acceso', value: alumno.ultimaActividad ? fmtDate(alumno.ultimaActividad) : '—', sub: '', icon: Clock, bg: '#f7f2ed', color: '#443e39' },
        ].map((k) => (
          <div key={k.label} className="bg-white border border-stone-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: k.bg }}>
                <k.icon size={14} style={{ color: k.color }} />
              </div>
              <span className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: '#a89a8e' }}>{k.label}</span>
            </div>
            <div className="text-xl font-bold" style={{ fontFamily: "'Poppins', sans-serif", color: '#1a1a1a' }}>{k.value}</div>
            {k.sub && <div className="text-xs mt-0.5" style={{ color: '#6b635e' }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* ── MATRÍCULA OFICIAL DGB ───────────────────────────────── */}
      {!alumno.matriculaOficialDGB ? (
        <div style={{ background: '#fff', border: '1px solid #eadfd7', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#efe7d6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Award size={18} style={{ color: 'var(--color-guinda-700)' }} />
            </div>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: '#2a2a2a' }}>Matrícula oficial DGB</h3>
              <p style={{ fontSize: 12, color: '#6b635e', margin: '3px 0 0' }}>Aún no se ha capturado la matrícula oficial asignada por la SEP-DGB.</p>
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
              <p style={{ fontSize: 12, color: '#6b635e', margin: '3px 0 0' }}>
                Capturada el {alumno.matriculaCapturadaEn ? new Date(alumno.matriculaCapturadaEn).toLocaleDateString('es-MX', {day:'numeric',month:'short',year:'numeric'}) : '—'}
              </p>
            </div>
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #eadfd7', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b635e', marginBottom: 3 }}>MATRÍCULA</div>
              <div style={{ fontFamily: "'JetBrains Mono', 'Courier New', monospace", fontSize: 22, fontWeight: 700, color: 'var(--color-guinda-700)', letterSpacing: '0.05em' }}>
                {alumno.matriculaOficialDGB}
              </div>
            </div>
            <button onClick={() => setModalMatricula({ matriculaActual: alumno.matriculaOficialDGB! })} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', border: '1px solid #eadfd7', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12, color: '#443e39' }}>
              <Edit2 size={12} /> Editar
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <button type="button"
              onClick={() => { setActiveTab('cedula'); document.getElementById('tabs-alumno')?.scrollIntoView({ behavior: 'smooth' }); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--color-guinda-700)', fontSize: 13, fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 3 }}>
              <ClipboardList size={14} /> Ver cédula de inscripción
            </button>
            <a href={`/api/admin/alumnos/${alumnoId}/cedula/pdf`} download
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: '1px solid #eadfd7', borderRadius: 8, background: '#fff', fontSize: 12, fontWeight: 600, color: '#443e39', textDecoration: 'none' }}>
              <Download size={13} /> Descargar
            </a>
          </div>
        </div>
      )}

      {/* ── TABS ────────────────────────────────────────────────── */}
      <div id="tabs-alumno" className="bg-white border border-stone-200 rounded-xl overflow-hidden scroll-mt-24 mb-6">
        {/* Tab bar */}
        <div className="flex border-b border-stone-100">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className="flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-colors"
              style={{
                color: activeTab === t.key ? 'var(--color-guinda-700)' : '#6b635e',
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
                  style={{ background: activeTab === t.key ? '#fbe6ea' : '#f7f2ed', color: activeTab === t.key ? 'var(--color-guinda-700)' : '#6b635e' }}
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
            <DocumentosChecklist
              documentos={documentos}
              alumnoId={alumnoId}
              onAprobar={(doc) => setModalAprobar(doc)}
              onRechazar={(doc) => setModalRechazar(doc)}
            />
          )}
          {activeTab === 'pagos' && (
            (ordenesPago.length === 0 && pagosData.length === 0)
              ? (
                <div className="flex flex-col items-center justify-center text-center rounded-xl border-2 border-dashed border-stone-200 py-12 px-6">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3" style={{ background: '#f7f2ed' }}>
                    <CreditCard size={24} style={{ color: '#c4b5a5' }} />
                  </div>
                  <div className="text-sm font-bold" style={{ color: '#57534e' }}>Sin órdenes de pago</div>
                  <div className="text-xs mt-1 max-w-xs" style={{ color: '#a89a8e' }}>
                    Aquí aparecerán las órdenes de pago (derecho de examen) en las que este alumno esté incluido.
                  </div>
                </div>
              )
              : (
                <div className="space-y-3">
                  {ordenesPago.length > 0 && (
                    <div className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: '#a89a8e' }}>Órdenes de pago · Tesorería</div>
                  )}
                  {ordenesPago.map((o) => {
                    const cfg = ORDEN_PAGO_CFG[o.estado] ?? { label: o.estado, bg: '#f5f5f4', color: '#78716c' };
                    return (
                      <div key={o.id} className="flex items-center gap-3 rounded-xl border border-stone-200 p-3.5">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#fbe6ea' }}>
                          <CreditCard size={18} style={{ color: 'var(--color-guinda-700)' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-bold" style={{ color: 'var(--color-guinda-700)' }}>{o.folio ?? `Orden #${o.id}`}</span>
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                            {o.esGrupal && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: '#f7f2ed', color: '#6b635e' }}>Grupal</span>}
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: '#6b635e' }}>
                            {o.modulosAlumno ?? '—'}
                            {o.fechaVencimiento && <span style={{ color: '#a89a8e' }}> · Vence {fmtDate(o.fechaVencimiento)}</span>}
                          </div>
                        </div>
                        <a href={`/admin/ordenes-pago?orden=${o.id}`}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-stone-300 flex-shrink-0" style={{ color: 'var(--color-guinda-700)' }}>
                          Ver orden <ExternalLink size={12} />
                        </a>
                      </div>
                    );
                  })}
                  {pagosData.map((p) => <PagoRow key={p.id} pago={p} />)}
                </div>
              )
          )}
          {activeTab === 'examenes' && (
            <CalificacionesTabContent estudianteId={alumnoId} readOnly={false} />
          )}
          {activeTab === 'cedula' && (
            <CedulaEditor basePath={`/admin/alumnos/${alumnoId}`} mostrarFirmaResponsable />
          )}
          {activeTab === 'modulos' && (
            <ModulosInscritos
              examenes={examenes}
              alumnoId={alumnoId}
              showToast={showToast}
              onChanged={async () => {
                const fresh = await api.get<DetalleResp>(`/admin/alumnos/${alumnoId}`);
                setData(fresh);
              }}
            />
          )}
          {activeTab === 'credencial' && (
            !alumno.licenciaDigital ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: '#ede9fe' }}>
                  <BadgeCheck size={22} style={{ color: '#7c3aed' }} />
                </div>
                <div className="text-sm font-bold" style={{ color: '#2a2a2a' }}>Credencial digital sin emitir</div>
                <p className="text-xs mt-1 mb-4 max-w-sm mx-auto" style={{ color: '#6b635e' }}>
                  {!alumno.matriculaOficialDGB
                    ? 'Primero asigna la matrícula oficial DGB; después podrás emitir la credencial digital.'
                    : 'Emite la credencial digital para generar el carnet (PDF) del alumno.'}
                </p>
                {alumno.matriculaOficialDGB ? (
                  <button
                    onClick={() => setConfirmarLicencia(true)}
                    disabled={emitiendo}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-60"
                    style={{ background: '#7c3aed' }}
                  >
                    {emitiendo ? <Loader2 size={14} className="animate-spin" /> : <BadgeCheck size={14} />}
                    {emitiendo ? 'Emitiendo…' : 'Emitir credencial digital'}
                  </button>
                ) : (
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg" style={{ color: '#b45309', background: '#fff7ed', border: '1px solid #fed7aa' }}>
                    <AlertTriangle size={12} /> Falta la matrícula oficial DGB
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-5">
                {/* Preview del carnet (frente + reverso) */}
                <CredencialPreview basePath={`/admin/alumnos/${alumnoId}`} />

                <div className="flex flex-wrap items-center gap-2 justify-center">
                  <a href={`/api/admin/alumnos/${alumnoId}/credencial/pdf`} download
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-lg" style={{ background: 'var(--color-guinda-700)' }}>
                    <Download size={15} /> Descargar credencial
                  </a>
                  <button onClick={() => setModalLicencia('renovar')} disabled={emitiendo}
                    className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold rounded-lg bg-white disabled:opacity-60" style={{ color: '#7c3aed', border: '1px solid #c4b5fd' }}>
                    <RefreshCw size={13} /> Renovar vigencia
                  </button>
                  <button onClick={() => setModalLicencia('reponer')} disabled={emitiendo}
                    className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold rounded-lg bg-white disabled:opacity-60" style={{ color: '#6b635e', border: '1px solid #eadfd7' }}>
                    <BadgeCheck size={13} /> Reponer (folio nuevo)
                  </button>
                </div>
                <p className="text-[11px] text-center" style={{ color: '#a89a8e' }}>
                  La credencial usa la fotografía aprobada del expediente. Si no hay foto aprobada, el carnet se genera sin fotografía.
                </p>
              </div>
            )
          )}
        </div>
      </div>

      {/* ── FOLIO PRE-REGISTRO (solo en la pestaña Documentos) ──────────── */}
      {activeTab === 'docs' && alumno.folioPreregistro && (() => {
        const vig = vigenciaInfo(alumno.preregistroVigenteHasta);
        return (
          <div style={{ background: '#fff', border: '1px solid #eadfd7', borderRadius: 12, padding: '16px 24px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#efe7d6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <FileText size={18} style={{ color: 'var(--color-guinda-700)' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#a89a8e', marginBottom: 3 }}>Folio de pre-registro</div>
              <div style={{ fontFamily: "'JetBrains Mono', 'Courier New', monospace", fontSize: 16, fontWeight: 700, color: 'var(--color-guinda-700)', letterSpacing: '0.04em' }}>
                {alumno.folioPreregistro}
              </div>
              {alumno.preregistroVigenteHasta && (
                <div style={{ fontSize: 11, color: '#6b635e', marginTop: 2 }}>
                  Vigente hasta {new Date(alumno.preregistroVigenteHasta + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              )}
            </div>
            <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', border: `1px solid ${vig.border}`, background: vig.bg, color: vig.color, flexShrink: 0 }}>
              {vig.label}
            </span>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <a href={`/api/admin/alumnos/${alumnoId}/ficha-preregistro`} target="_blank" rel="noopener" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', border: '1px solid #eadfd7', borderRadius: 6, background: '#fff', textDecoration: 'none', fontSize: 12, color: '#443e39' }}>
                <Download size={12} /> Descargar
              </a>
              {!alumno.matriculaOficialDGB && (
                <button onClick={handleRenovarPreregistro} disabled={renovando} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', border: '1px solid #eadfd7', borderRadius: 6, background: vig.diasRestantes !== null && vig.diasRestantes <= 0 ? 'var(--color-guinda-700)' : '#fff', color: vig.diasRestantes !== null && vig.diasRestantes <= 0 ? 'white' : '#443e39', cursor: 'pointer', fontSize: 12, opacity: renovando ? 0.5 : 1 }}>
                  <RefreshCw size={12} /> {renovando ? 'Renovando...' : 'Renovar'}
                </button>
              )}
            </div>
          </div>
        );
      })()}

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

      {modalLicencia === 'renovar' && (
        <ConfirmModal
          icon={<RefreshCw size={20} />}
          title="Renovar vigencia de la credencial"
          message="Se reiniciará la vigencia a 6 meses conservando el mismo folio. Úsalo cuando la credencial venció o está por vencer."
          confirmLabel="Renovar vigencia"
          onConfirm={() => handleRenovarLicencia('vencimiento')}
          onClose={() => setModalLicencia(null)}
        />
      )}
      {modalLicencia === 'reponer' && (
        <ConfirmModal
          danger
          icon={<BadgeCheck size={20} />}
          title="Reponer credencial (folio nuevo)"
          message={<>Esto <strong>invalida el folio actual</strong> y emite una credencial <strong>nueva</strong> con folio distinto y vigencia de 6 meses. Úsalo solo por <strong>pérdida de la credencial física</strong>. No se puede deshacer.</>}
          confirmLabel="Reponer credencial"
          requireText="REPONER"
          onConfirm={() => handleRenovarLicencia('reposicion')}
          onClose={() => setModalLicencia(null)}
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
                <p style={{ fontSize: 12, color: '#6b635e', marginTop: 4, marginBottom: 0 }}>
                  Ingresa la matrícula que la SEP-DGB asignó a este alumno.
                </p>
              </div>
              <button onClick={() => setModalMatricula(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b635e' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ background: '#faf9f8', border: '1px solid #eadfd7', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#2a2a2a' }}>{alumno.nombreCompleto}</div>
              <div style={{ fontSize: 12, color: '#6b635e' }}>CURP: {alumno.curp}</div>
              {alumno.folioPreregistro && <div style={{ fontSize: 12, color: '#6b635e' }}>Pre-registro: {alumno.folioPreregistro}</div>}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#57504a', display: 'block', marginBottom: 6 }}>Matrícula oficial DGB *</label>
              <input
                type="text"
                value={matriculaInput}
                onChange={e => setMatriculaInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="Ej. 26016000142X"
                maxLength={20}
                style={{ width: '100%', border: '1px solid #eadfd7', borderRadius: 6, padding: '9px 12px', fontSize: 15, fontFamily: 'monospace', letterSpacing: '0.05em', background: '#faf9f8' }}
              />
              <div style={{ fontSize: 11, color: '#6b635e', marginTop: 4 }}>Entre 8 y 20 caracteres alfanuméricos. Tal como la asignó la SEP-DGB.</div>
            </div>

            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: '#443e39', cursor: 'pointer', marginBottom: 16 }}>
              <input type="checkbox" checked={matriculaConfirmado} onChange={e => setMatriculaConfirmado(e.target.checked)} style={{ marginTop: 2 }} />
              <span>Confirmo que esta matrícula fue asignada oficialmente por la SEP-DGB y corresponde a este alumno.</span>
            </label>

            {matriculaError && <div style={{ color: '#be123c', fontSize: 12, padding: '8px 12px', background: '#fff1f2', borderRadius: 6, marginBottom: 12 }}>{matriculaError}</div>}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalMatricula(null)} style={{ padding: '9px 20px', border: '1px solid #eadfd7', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
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
      {/* Modal: confirmar emisión de licencia */}
      {confirmarLicencia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#ede9fe' }}>
                <BadgeCheck size={20} style={{ color: '#7c3aed' }} />
              </div>
              <div>
                <h3 className="font-bold text-base" style={{ color: '#1a1a1a' }}>Emitir credencial digital</h3>
                <p className="text-xs" style={{ color: '#6b635e' }}>Esta acción genera un folio único e irreversible.</p>
              </div>
            </div>
            <div className="rounded-xl p-3 mb-5" style={{ background: '#f7f2ed' }}>
              <div className="text-sm font-semibold mb-0.5" style={{ color: '#1a1a1a' }}>{alumno.nombreCompleto}</div>
              <div className="text-xs font-mono" style={{ color: '#6b635e' }}>{alumno.curp}</div>
              <div className="text-xs mt-1" style={{ color: '#6b635e' }}>Matrícula: {alumno.matriculaOficialDGB}</div>
            </div>
            <div className="rounded-lg p-3 mb-5 text-xs" style={{ background: '#fff7ed', color: '#92400e', border: '1px solid #fed7aa' }}>
              <strong>Importante:</strong> La credencial digital se genera automáticamente con un folio único del sistema. Una vez emitida no puede eliminarse, solo el administrador puede verla.
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmarLicencia(false)}
                className="px-4 py-2 text-sm font-semibold border border-stone-200 rounded-xl"
                style={{ color: '#443e39' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleEmitirLicencia}
                disabled={emitiendo}
                className="px-4 py-2 text-sm font-semibold rounded-xl disabled:opacity-60 flex items-center gap-1.5"
                style={{ background: '#7c3aed', color: 'white' }}
              >
                {emitiendo && <Loader2 size={13} className="animate-spin" />}
                Sí, emitir credencial
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
