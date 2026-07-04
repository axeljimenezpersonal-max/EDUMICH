import { useEffect, useState, useCallback } from 'react';
import { useSearch, useLocation } from 'wouter';
import {
  Inbox, Clock, CheckCircle, XCircle, AlertTriangle, Search, Download,
  Eye, Check, X, User, Mail, Phone, Calendar, MapPin, BookOpen,
  MessageSquare, Target, Lock, Info, ChevronLeft, ChevronRight, Copy,
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { api } from '../../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────

type Solicitud = {
  id: number;
  folio: string;
  nombreCompleto: string;
  iniciales: string;
  curp: string;
  email: string;
  telefono: string;
  fechaNacimiento: string;
  edad: number;
  municipio: { id: number; nombre: string } | null;
  ultimoNivelCursado: string | null;
  anioUltimoNivel: number | null;
  justificacion: string | null;
  modalidadPreferida: 'con_gestor' | 'auto_gestion' | null;
  quiereInfoGestores?: boolean;
  disponibilidad: string | null;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  procesadaEn: string | null;
  procesadaPor: { nombreCorto: string } | null;
  gestorAsignado: { id: number; nombreCorto: string } | null;
  estudianteCreadoId: number | null;
  motivoRechazo: string | null;
  detallesRechazo: string | null;
  notasInternas: string | null;
  createdAt: string;
  diasDesdeCreacion: number;
  urgencia: 'alta' | 'media' | 'baja';
  fechaTexto: string;
};

type ListaResp = {
  solicitudes: Solicitud[];
  total: number;
  page: number;
  totalPages: number;
  resumen: {
    pendientes: number;
    pendientesUrgentes: number;
    aprobadasEsteMes: number;
    rechazadasEsteMes: number;
    tiempoPromedioAprobacion: string;
    tasaEnvioCredenciales: number;
  };
};

type GestorDisp = {
  id: number;
  nombreCompleto: string;
  nombreCorto: string;
  municipio: { id: number; nombre: string } | null;
  alumnosActuales: number;
  capacidadMaxima: number;
  disponible: boolean;
};

type Municipio = { id: number; nombre: string };

// ─── Color helpers ────────────────────────────────────────────────────────

function useDebounce<T>(value: T, ms: number): T {
  const [dv, setDv] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDv(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return dv;
}

// ─── UrgenciaPill ─────────────────────────────────────────────────────────

function UrgenciaPill({ urgencia }: { urgencia: 'alta' | 'media' | 'baja' }) {
  if (urgencia === 'alta') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase" style={{ background: '#fee2e2', color: '#b91c1c' }}>
      <AlertTriangle size={10} /> Alta
    </span>
  );
  if (urgencia === 'media') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase" style={{ background: '#fef9c3', color: '#92400e' }}>
      Media
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase" style={{ background: '#f7f2ed', color: '#6b635e' }}>
      Baja
    </span>
  );
}

// ─── EstadoPill ───────────────────────────────────────────────────────────

function EstadoPill({ estado, fechaTexto }: { estado: string; fechaTexto: string }) {
  const cfg = {
    pendiente: { bg: '#fef9c3', color: '#92400e', label: 'Pendiente' },
    aprobada:  { bg: '#d1fae5', color: '#2d7d46', label: 'Aprobada' },
    rechazada: { bg: '#fee2e2', color: '#b91c1c', label: 'Rechazada' },
  }[estado] ?? { bg: '#f7f2ed', color: '#6b635e', label: estado };

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />
      {cfg.label} · {fechaTexto}
    </span>
  );
}

// ─── SolicitanteAvatar ────────────────────────────────────────────────────

function SolicitanteAvatar({ iniciales }: { iniciales: string }) {
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
      style={{ background: '#efe7d6', color: 'var(--color-guinda-700)', fontFamily: "'Poppins', sans-serif" }}
    >
      {iniciales}
    </div>
  );
}

// ─── IconWrap ─────────────────────────────────────────────────────────────

function IconWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#f8f4ec', color: 'var(--color-guinda-700)' }}>
      {children}
    </div>
  );
}

// ─── FieldRow ─────────────────────────────────────────────────────────────

function FieldRow({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2.5 mb-3">
      <IconWrap>{icon}</IconWrap>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-widest font-semibold mb-0.5" style={{ color: '#6b635e' }}>{label}</div>
        <div className={`text-sm font-medium ${mono ? 'font-mono tracking-wide text-xs' : ''}`} style={{ color: '#2a2a2a' }}>{value}</div>
      </div>
    </div>
  );
}

// ─── HelperNote ───────────────────────────────────────────────────────────

function HelperNote({ variant = 'info', children }: { variant?: 'info' | 'success' | 'warning'; children: React.ReactNode }) {
  const cfg = {
    info:    { bg: '#dbeafe', border: '#93c5fd', color: '#1e3a8a' },
    success: { bg: '#d1fae5', border: '#86efac', color: '#14532d' },
    warning: { bg: '#fef9c3', border: '#fcd34d', color: '#92400e' },
  }[variant];
  return (
    <div
      className="flex items-start gap-2.5 p-3 rounded-lg text-xs"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}
    >
      <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
      <div>{children}</div>
    </div>
  );
}

// ─── SolicitudDrawer ──────────────────────────────────────────────────────

function SolicitudDrawer({
  solicitud,
  onClose,
  onApprove,
  onReject,
}: {
  solicitud: Solicitud | null;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  if (!solicitud) return null;

  const isPendiente = solicitud.estado === 'pendiente';

  return (
    <aside
      className="bg-white border border-stone-200 rounded-xl overflow-hidden flex flex-col"
      style={{ position: 'sticky', top: 104, maxHeight: 'calc(100vh - 130px)' }}
    >
      {/* Header */}
      <div
        className="relative px-5 py-4 flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, var(--color-guinda-700) 0%, #4a0e20 100%)' }}
      >
        <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 90% 20%, rgba(255,255,255,0.18) 0%, transparent 50%)' }} />
        <div className="relative flex items-start justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest font-bold mb-1 opacity-80 text-white">
              SOLICITUD #{solicitud.folio}
            </div>
            <h3
              className="text-lg font-bold text-white"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              {solicitud.nombreCompleto}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:opacity-80 flex-shrink-0 ml-2"
            style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none', cursor: 'pointer' }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="overflow-y-auto flex-1 p-5">
        {/* Estado pill */}
        <div className="mb-4">
          <EstadoPill estado={solicitud.estado} fechaTexto={solicitud.fechaTexto} />
        </div>

        {/* Datos personales */}
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-widest font-bold mb-3" style={{ color: '#6b635e' }}>
            DATOS PERSONALES
          </div>
          <FieldRow icon={<User size={13} />} label="CURP" value={solicitud.curp} mono />
          <FieldRow icon={<Mail size={13} />} label="Correo" value={solicitud.email} />
          <FieldRow icon={<Phone size={13} />} label="Teléfono" value={solicitud.telefono} />
          <FieldRow
            icon={<Calendar size={13} />}
            label="Fecha de nacimiento"
            value={`${new Date(solicitud.fechaNacimiento + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })} (${solicitud.edad} años)`}
          />
          <FieldRow icon={<MapPin size={13} />} label="Municipio" value={solicitud.municipio?.nombre ?? '—'} />
        </div>

        {/* Formación previa */}
        {(solicitud.ultimoNivelCursado) && (
          <div className="mb-4">
            <div className="text-[10px] uppercase tracking-widest font-bold mb-3" style={{ color: '#6b635e' }}>
              FORMACIÓN PREVIA
            </div>
            <FieldRow
              icon={<BookOpen size={13} />}
              label="Último nivel cursado"
              value={`${solicitud.ultimoNivelCursado}${solicitud.anioUltimoNivel ? ` (concluida en ${solicitud.anioUltimoNivel})` : ''}`}
            />
          </div>
        )}

        {/* Justificación */}
        {solicitud.justificacion && (
          <div className="mb-4">
            <div className="text-[10px] uppercase tracking-widest font-bold mb-3 flex items-center gap-1.5" style={{ color: '#6b635e' }}>
              <MessageSquare size={11} /> ¿POR QUÉ QUIERE ESTUDIAR?
            </div>
            <div
              className="p-3 rounded-lg"
              style={{ background: '#fdfaf3', borderLeft: '3px solid var(--color-guinda-700)', border: '1px solid #eadfd7', borderLeftWidth: 3 }}
            >
              <p className="text-sm leading-relaxed italic" style={{ color: '#2a2a2a' }}>
                "{solicitud.justificacion}"
              </p>
              <div className="flex items-center gap-1 mt-2 text-[11px]" style={{ color: '#6b635e' }}>
                <Clock size={10} /> Capturada el{' '}
                {new Date(solicitud.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>
          </div>
        )}

        {/* Acompañamiento / preferencia de gestor */}
        {(solicitud.modalidadPreferida || solicitud.quiereInfoGestores || solicitud.disponibilidad) && (
          <div className="mb-4">
            <div className="text-[10px] uppercase tracking-widest font-bold mb-3" style={{ color: '#6b635e' }}>
              ACOMPAÑAMIENTO
            </div>
            {solicitud.modalidadPreferida && (
              <FieldRow
                icon={<User size={13} />}
                label="¿Viene por parte de un gestor?"
                value={solicitud.modalidadPreferida === 'con_gestor' ? 'Sí, un gestor lo apoya' : 'No, por su cuenta'}
              />
            )}
            {solicitud.quiereInfoGestores && (
              <div className="flex items-center gap-2 py-1.5">
                <span className="flex-shrink-0" style={{ color: '#6b635e' }}><Mail size={13} /></span>
                <span className="text-xs" style={{ color: '#6b635e' }}>Info de gestores</span>
                <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#dbeafe', color: '#1e40af' }}>
                  Solicitó que se le envíe
                </span>
              </div>
            )}
            {solicitud.disponibilidad && (
              <FieldRow icon={<Clock size={13} />} label="Disponibilidad" value={solicitud.disponibilidad} />
            )}
          </div>
        )}

        {/* Si aprobada: info de aprobación */}
        {solicitud.estado === 'aprobada' && (
          <div className="mb-4">
            <div className="text-[10px] uppercase tracking-widest font-bold mb-3" style={{ color: '#2d7d46' }}>
              INFORMACIÓN DE APROBACIÓN
            </div>
            <div className="p-3 rounded-lg" style={{ background: '#d1fae5', border: '1px solid #a7f3d0' }}>
              <div className="text-xs space-y-1.5">
                {solicitud.procesadaPor && (
                  <div className="flex justify-between">
                    <span style={{ color: '#6b635e' }}>Aprobada por</span>
                    <span className="font-semibold" style={{ color: '#2a2a2a' }}>{solicitud.procesadaPor.nombreCorto}</span>
                  </div>
                )}
                {solicitud.procesadaEn && (
                  <div className="flex justify-between">
                    <span style={{ color: '#6b635e' }}>Fecha</span>
                    <span className="font-semibold" style={{ color: '#2a2a2a' }}>
                      {new Date(solicitud.procesadaEn).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span style={{ color: '#6b635e' }}>Gestor asignado</span>
                  <span className="font-semibold" style={{ color: '#2a2a2a' }}>
                    {solicitud.gestorAsignado?.nombreCorto ?? <em style={{ color: '#6b635e', fontWeight: 400 }}>Sin gestor</em>}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Si rechazada: info de rechazo */}
        {solicitud.estado === 'rechazada' && (
          <div className="mb-4">
            <div className="text-[10px] uppercase tracking-widest font-bold mb-3" style={{ color: '#b91c1c' }}>
              INFORMACIÓN DE RECHAZO
            </div>
            <div className="p-3 rounded-lg" style={{ background: '#fee2e2', border: '1px solid #fca5a5' }}>
              <div className="text-xs space-y-1.5">
                {solicitud.procesadaPor && (
                  <div className="flex justify-between">
                    <span style={{ color: '#6b635e' }}>Rechazada por</span>
                    <span className="font-semibold" style={{ color: '#2a2a2a' }}>{solicitud.procesadaPor.nombreCorto}</span>
                  </div>
                )}
                {solicitud.procesadaEn && (
                  <div className="flex justify-between">
                    <span style={{ color: '#6b635e' }}>Fecha</span>
                    <span className="font-semibold" style={{ color: '#2a2a2a' }}>
                      {new Date(solicitud.procesadaEn).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                )}
                {solicitud.motivoRechazo && (
                  <div className="flex justify-between">
                    <span style={{ color: '#6b635e' }}>Motivo</span>
                    <span className="font-semibold" style={{ color: '#2a2a2a' }}>{solicitud.motivoRechazo}</span>
                  </div>
                )}
              </div>
              {solicitud.detallesRechazo && (
                <p className="text-xs mt-2 pt-2 border-t border-red-200 leading-relaxed" style={{ color: '#7f1d1d' }}>
                  {solicitud.detallesRechazo}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Notas internas */}
        {solicitud.notasInternas && (
          <div className="mb-4">
            <div className="text-[10px] uppercase tracking-widest font-bold mb-3 flex items-center gap-1.5" style={{ color: '#6b635e' }}>
              <Lock size={11} /> NOTAS INTERNAS
            </div>
            <div className="p-3 rounded-lg text-xs leading-relaxed" style={{ background: '#fef9c3', border: '1px solid #fcd34d', color: '#92400e' }}>
              {solicitud.notasInternas}
            </div>
          </div>
        )}
      </div>

      {/* Footer (solo si pendiente) */}
      {isPendiente && (
        <div className="flex gap-2 px-5 py-3 border-t border-stone-100 flex-shrink-0">
          <button
            onClick={onReject}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-semibold text-white rounded-lg"
            style={{ background: '#b91c1c' }}
          >
            <X size={13} /> Rechazar
          </button>
          <button
            onClick={onApprove}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-semibold text-white rounded-lg"
            style={{ background: '#2d7d46' }}
          >
            <Check size={13} /> Aprobar
          </button>
        </div>
      )}
    </aside>
  );
}

// ─── AprobarModal ─────────────────────────────────────────────────────────

function AprobarModal({
  solicitud,
  onClose,
  onSuccess,
}: {
  solicitud: Solicitud;
  onClose: () => void;
  onSuccess: (email: string, cred?: string) => void;
}) {
  const [gestores, setGestores] = useState<GestorDisp[]>([]);
  const [gestorId, setGestorId] = useState('');
  const [notasInternas, setNotasInternas] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credTemp, setCredTemp] = useState<string | null>(null);

  useEffect(() => {
    if (solicitud.municipio?.id) {
      api.get<{ gestores: GestorDisp[] }>(`/admin/gestores-disponibles?municipioId=${solicitud.municipio.id}`)
        .then((r) => setGestores(r.gestores))
        .catch(() => {});
    }
  }, [solicitud.municipio?.id]);

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {};
      if (gestorId) body.gestorAsignadoId = Number(gestorId);
      if (notasInternas.trim()) body.notasInternas = notasInternas.trim();

      const r = await api.post<{ ok: boolean; alumno: { email: string }; credencialTemporal?: string }>(
        `/admin/solicitudes/${solicitud.id}/aprobar`,
        body
      );
      setCredTemp(r.credencialTemporal ?? null);
      onSuccess(r.alumno.email, r.credencialTemporal);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al aprobar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(42,42,42,0.75)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col" style={{ maxHeight: '92vh' }}>
        {/* Header verde */}
        <div className="flex items-center justify-between px-5 py-4" style={{ background: '#2d7d46', color: 'white' }}>
          <h3 className="font-semibold text-base flex items-center gap-2" style={{ fontFamily: "'Poppins', sans-serif" }}>
            <Check size={16} /> Aprobar solicitud de cuenta
          </h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center hover:opacity-80" style={{ background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer' }}>
            <X size={14} />
          </button>
        </div>

        <div className="overflow-y-auto p-5 flex-1">
          {/* Resumen solicitante */}
          <div className="flex items-center gap-3 p-3 rounded-lg mb-4" style={{ background: '#fdfaf3', border: '1px solid #eadfd7' }}>
            <SolicitanteAvatar iniciales={solicitud.iniciales} />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm truncate" style={{ fontFamily: "'Poppins', sans-serif", color: '#2a2a2a' }}>
                {solicitud.nombreCompleto}
              </div>
              <div className="text-xs" style={{ color: '#6b635e' }}>
                {solicitud.municipio?.nombre}{solicitud.municipio && ' · '}{solicitud.email}
              </div>
            </div>
          </div>

          {/* Selector de gestor */}
          <div className="mb-4">
            <label className="block text-xs font-semibold mb-1" style={{ color: '#443e39' }}>
              Asignar gestor <span className="font-normal" style={{ color: '#6b635e' }}>(opcional)</span>
            </label>
            <select
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400 bg-white"
              value={gestorId}
              onChange={(e) => setGestorId(e.target.value)}
            >
              <option value="">Sin gestor (auto-gestión)</option>
              {gestores.map((g) => (
                <option key={g.id} value={g.id} disabled={!g.disponible}>
                  {g.nombreCorto} ({g.municipio?.nombre ?? '—'}) — {g.alumnosActuales}/{g.capacidadMaxima} alumnos{!g.disponible ? ' · LLENO' : ''}
                </option>
              ))}
            </select>
            <p className="text-[11px] mt-1" style={{ color: '#6b635e' }}>
              Solo se muestran gestores del municipio del solicitante con capacidad disponible
            </p>
          </div>

          {/* Notas internas */}
          <div className="mb-4">
            <label className="block text-xs font-semibold mb-1" style={{ color: '#443e39' }}>
              Notas administrativas internas
            </label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400 resize-none"
              placeholder="Notas para tu equipo (no se envían al solicitante)..."
              value={notasInternas}
              onChange={(e) => setNotasInternas(e.target.value)}
            />
            <p className="text-[11px] mt-1" style={{ color: '#6b635e' }}>
              Estas notas son visibles solo para el equipo administrativo
            </p>
          </div>

          <HelperNote variant="success">
            Al aprobar, se creará la cuenta de <strong>{solicitud.nombreCompleto}</strong> y se enviará
            automáticamente un correo a <strong>{solicitud.email}</strong> con sus credenciales
            temporales para entrar al portal.
          </HelperNote>

          {/* Credencial temporal (modo dev) */}
          {credTemp && (
            <div className="mt-3 p-3 rounded-lg" style={{ background: '#fef9c3', border: '1px solid #fcd34d' }}>
              <div className="text-[10px] uppercase font-bold tracking-wider mb-1" style={{ color: '#92400e' }}>
                Modo dev — contraseña temporal:
              </div>
              <div className="flex items-center gap-2">
                <code className="font-mono text-lg font-bold tracking-widest" style={{ color: 'var(--color-guinda-700)' }}>
                  {credTemp}
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText(credTemp)}
                  className="p-1 rounded hover:opacity-70"
                  style={{ color: '#92400e', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>
          )}

          {error && <p className="mt-3 text-xs font-medium" style={{ color: '#b91c1c' }}>{error}</p>}
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-stone-100">
          <a
            href={`/api/admin/solicitudes/${solicitud.id}/correo/aprobacion`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-stone-200 rounded-lg hover:bg-stone-50"
            style={{ color: 'var(--color-guinda-700)' }}
          >
            <Mail size={14} /> Ver correo
          </a>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm font-semibold border border-stone-200 rounded-lg hover:bg-stone-50" style={{ color: '#443e39' }}>
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50"
              style={{ background: '#2d7d46' }}
            >
              <Check size={14} /> {saving ? 'Creando cuenta...' : 'Aprobar y crear cuenta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── RechazarModal ────────────────────────────────────────────────────────

const MOTIVOS = [
  'CURP no válida o no coincide',
  'Datos incompletos o ilegibles',
  'Solicitud duplicada (ya tiene cuenta)',
  'Edad menor a 15 años',
  'Información sospechosa',
  'Otro motivo (especificar)',
];

function RechazarModal({
  solicitud,
  onClose,
  onSuccess,
}: {
  solicitud: Solicitud;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [detalles, setDetalles] = useState('');
  const [notasInternas, setNotasInternas] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!motivo) { setError('Selecciona un motivo de rechazo.'); return; }
    setSaving(true);
    setError(null);
    try {
      await api.post(`/admin/solicitudes/${solicitud.id}/rechazar`, {
        motivoRechazo: motivo,
        detallesRechazo: detalles.trim() || undefined,
        notasInternas: notasInternas.trim() || undefined,
      });
      onSuccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al rechazar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(42,42,42,0.75)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col" style={{ maxHeight: '92vh' }}>
        {/* Header rojo */}
        <div className="flex items-center justify-between px-5 py-4" style={{ background: '#b91c1c', color: 'white' }}>
          <h3 className="font-semibold text-base flex items-center gap-2" style={{ fontFamily: "'Poppins', sans-serif" }}>
            <X size={16} /> Rechazar solicitud
          </h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center hover:opacity-80" style={{ background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer' }}>
            <X size={14} />
          </button>
        </div>

        <div className="overflow-y-auto p-5 flex-1">
          {/* Resumen solicitante */}
          <div className="flex items-center gap-3 p-3 rounded-lg mb-4" style={{ background: '#fdfaf3', border: '1px solid #eadfd7' }}>
            <SolicitanteAvatar iniciales={solicitud.iniciales} />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm truncate" style={{ fontFamily: "'Poppins', sans-serif", color: '#2a2a2a' }}>
                {solicitud.nombreCompleto}
              </div>
              <div className="text-xs" style={{ color: '#6b635e' }}>
                {solicitud.municipio?.nombre}{solicitud.municipio && ' · '}{solicitud.email}
              </div>
            </div>
          </div>

          <HelperNote variant="warning">
            Esta acción <strong>no se puede deshacer</strong>. Si rechazas la solicitud, la persona
            deberá hacer una nueva solicitud para entrar al sistema.
          </HelperNote>

          <div className="mt-4 mb-3">
            <label className="block text-xs font-semibold mb-1" style={{ color: '#443e39' }}>
              Motivo del rechazo <span style={{ color: '#b91c1c' }}>*</span>
            </label>
            <select
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400 bg-white"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            >
              <option value="">Selecciona un motivo...</option>
              {MOTIVOS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="mb-3">
            <label className="block text-xs font-semibold mb-1" style={{ color: '#443e39' }}>
              Detalles del rechazo
            </label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400 resize-none"
              placeholder="Explica brevemente el motivo del rechazo..."
              value={detalles}
              onChange={(e) => setDetalles(e.target.value)}
            />
            <p className="text-[11px] mt-1" style={{ color: '#6b635e' }}>
              El solicitante recibirá un correo con esta información para que pueda corregir y volver a solicitar
            </p>
          </div>

          <div className="mb-3">
            <label className="block text-xs font-semibold mb-1" style={{ color: '#443e39' }}>
              Notas administrativas internas <span className="font-normal" style={{ color: '#6b635e' }}>(opcional)</span>
            </label>
            <textarea
              rows={2}
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400 resize-none"
              placeholder="Notas privadas para el equipo administrativo..."
              value={notasInternas}
              onChange={(e) => setNotasInternas(e.target.value)}
            />
          </div>

          {error && <p className="text-xs font-medium" style={{ color: '#b91c1c' }}>{error}</p>}
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-stone-100">
          <a
            href={`/api/admin/solicitudes/${solicitud.id}/correo/rechazo?motivo=${encodeURIComponent(motivo)}&detalle=${encodeURIComponent(detalles)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-stone-200 rounded-lg hover:bg-stone-50"
            style={{ color: 'var(--color-guinda-700)' }}
          >
            <Mail size={14} /> Ver correo
          </a>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm font-semibold border border-stone-200 rounded-lg hover:bg-stone-50" style={{ color: '#443e39' }}>
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50"
              style={{ background: '#b91c1c' }}
            >
              <X size={14} /> {saving ? 'Rechazando...' : 'Rechazar solicitud'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────

function Toast({ msg, ok, onDismiss }: { msg: string; ok: boolean; onDismiss: () => void }) {
  return (
    <div
      className="fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold shadow-lg"
      style={{ background: ok ? '#d1fae5' : '#fee2e2', color: ok ? '#2d7d46' : '#b91c1c', border: `1px solid ${ok ? '#a7f3d0' : '#fca5a5'}` }}
    >
      {ok ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
      {msg}
      <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.6 }}>
        <X size={13} />
      </button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────

export default function SolicitudesLista() {
  const search = useSearch();
  const [, setLocation] = useLocation();

  const params = new URLSearchParams(search);
  const estadoParam = (params.get('estado') as 'pendiente' | 'aprobada' | 'rechazada') || 'pendiente';

  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [resumen, setResumen] = useState<ListaResp['resumen'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);

  // Filters
  const [searchRaw, setSearchRaw] = useState('');
  const [municipioId, setMunicipioId] = useState('');
  const [urgencia, setUrgencia] = useState('');
  const [sortBy, setSortBy] = useState('mas_antigua');
  const searchD = useDebounce(searchRaw, 300);

  // Drawer
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selectedSolicitud = solicitudes.find((s) => s.id === selectedId) ?? null;

  // Modal
  const [modal, setModal] = useState<'aprobar' | 'rechazar' | null>(null);
  const modalSolicitud = modal && selectedId ? selectedSolicitud : null;

  // Toast
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 5000);
  }

  function setEstado(e: 'pendiente' | 'aprobada' | 'rechazada') {
    const p = new URLSearchParams();
    p.set('estado', e);
    setLocation(`/admin/solicitudes?${p.toString()}`);
    setSelectedId(null);
    setPage(1);
  }

  // Load municipios once
  useEffect(() => {
    api.get<{ municipios: Municipio[] }>('/admin/municipios')
      .then((r) => setMunicipios(r.municipios))
      .catch(() => {});
  }, []);

  // Load solicitudes
  const loadSolicitudes = useCallback(async () => {
    setLoading(true);
    try {
      const qp = new URLSearchParams({ estado: estadoParam, page: String(page), limit: '20', sortBy });
      if (searchD) qp.set('search', searchD);
      if (municipioId) qp.set('municipioId', municipioId);
      if (urgencia) qp.set('urgencia', urgencia);

      const r = await api.get<ListaResp>(`/admin/solicitudes?${qp.toString()}`);
      setSolicitudes(r.solicitudes);
      setTotal(r.total);
      setTotalPages(r.totalPages);
      setResumen(r.resumen);
    } catch {}
    setLoading(false);
  }, [estadoParam, page, searchD, municipioId, urgencia, sortBy]);

  useEffect(() => {
    loadSolicitudes();
  }, [loadSolicitudes]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [estadoParam, searchD, municipioId, urgencia, sortBy]);

  function handleApproveSuccess(email: string, cred?: string) {
    setModal(null);
    setSelectedId(null);
    showToast(`Cuenta creada y credenciales enviadas a ${email}`, true);
    if (cred) console.info(`[DEV] Contraseña temporal: ${cred}`);
    loadSolicitudes();
  }

  function handleRejectSuccess() {
    setModal(null);
    setSelectedId(null);
    showToast('Solicitud rechazada correctamente', true);
    loadSolicitudes();
  }

  const drawerOpen = selectedId !== null;

  // ── Render ──────────────────────────────────────────────────────────────

  const subtabSuffix = estadoParam === 'pendiente'
    ? `${resumen?.pendientes ?? '…'} pendientes de revisión`
    : estadoParam === 'aprobada'
      ? `${resumen?.aprobadasEsteMes ?? '…'} este mes`
      : 'Histórico de solicitudes rechazadas';

  return (
    <AdminLayout>
      {toast && <Toast msg={toast.msg} ok={toast.ok} onDismiss={() => setToast(null)} />}

      {/* ── PAGE HEADER ──────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--color-guinda-700)' }}>
            <Inbox size={12} /> PERSONAS · SOLICITUDES
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Poppins', sans-serif", color: '#1a1a1a' }}>
            Solicitudes de cuenta
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#6b635e' }}>
            Bandeja de personas que quieren entrar al sistema · {subtabSuffix}
          </p>
        </div>
        <button
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold border border-stone-200 rounded-lg hover:bg-stone-50"
          style={{ color: '#443e39' }}
        >
          <Download size={13} /> Exportar
        </button>
      </div>

      {/* ── STATS ────────────────────────────────────────────────────── */}
      {resumen && (
        <div className="flex gap-3 mb-5 flex-wrap">
          {estadoParam === 'pendiente' ? (
            <>
              <StatCard icon={<Clock size={14} />} num={resumen.pendientes} label="Pendientes" variant="warning" />
              <StatCard icon={<AlertTriangle size={14} />} num={resumen.pendientesUrgentes} label="Más de 7 días" variant="alert" />
              <StatCard icon={<CheckCircle size={14} />} num={resumen.aprobadasEsteMes} label="Aprobadas este mes" variant="success" />
              <StatCard icon={<XCircle size={14} />} num={resumen.rechazadasEsteMes} label="Rechazadas este mes" variant="rechazado" />
            </>
          ) : estadoParam === 'aprobada' ? (
            <>
              <StatCard icon={<CheckCircle size={14} />} num={resumen.aprobadasEsteMes} label="Aprobadas este mes" variant="success" />
              <StatCard icon={<Clock size={14} />} num={resumen.tiempoPromedioAprobacion} label="Tiempo promedio" variant="info" />
              <StatCard icon={<Mail size={14} />} num={`${resumen.tasaEnvioCredenciales}%`} label="Envío credenciales" variant="success" />
            </>
          ) : (
            <>
              <StatCard icon={<XCircle size={14} />} num={resumen.rechazadasEsteMes} label="Rechazadas este mes" variant="rechazado" />
              <StatCard icon={<Clock size={14} />} num={resumen.tiempoPromedioAprobacion} label="Tiempo promedio" variant="info" />
            </>
          )}
        </div>
      )}

      {/* ── SUB-TABS ─────────────────────────────────────────────────── */}
      <div className="flex gap-0 border-b-2 border-stone-200 mb-4">
        {[
          { key: 'pendiente' as const, label: 'Pendientes', icon: <Clock size={13} />, count: resumen?.pendientes, urgent: true },
          { key: 'aprobada' as const, label: 'Aprobadas', icon: <Check size={13} />, count: resumen?.aprobadasEsteMes, urgent: false },
          { key: 'rechazada' as const, label: 'Rechazadas', icon: <X size={13} />, count: resumen?.rechazadasEsteMes, urgent: false },
        ].map(({ key, label, icon, count, urgent }) => {
          const active = estadoParam === key;
          return (
            <button
              key={key}
              onClick={() => setEstado(key)}
              className="flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors"
              style={{
                fontFamily: "'Poppins', sans-serif",
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                borderBottom: active ? '2px solid var(--color-guinda-700)' : '2px solid transparent',
                marginBottom: -2,
                color: active ? 'var(--color-guinda-700)' : '#6b635e',
                background: 'none',
                cursor: 'pointer',
              }}
            >
              {icon} {label}
              {count !== undefined && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{
                    background: active && urgent ? '#d97706' : active ? '#fbe6ea' : '#f7f2ed',
                    color: active && urgent ? 'white' : active ? 'var(--color-guinda-700)' : '#6b635e',
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── FILTROS ──────────────────────────────────────────────────── */}
      <div className="bg-white border border-stone-200 rounded-xl p-4 mb-4">
        <div className="grid gap-3" style={{ gridTemplateColumns: '1.6fr 1fr 1fr 1fr' }}>
          {/* Search */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-semibold mb-1" style={{ color: '#6b635e' }}>Buscar</label>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#6b635e' }} />
              <input
                className="w-full pl-8 pr-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400"
                placeholder="Nombre, CURP o email..."
                value={searchRaw}
                onChange={(e) => setSearchRaw(e.target.value)}
              />
            </div>
          </div>
          {/* Municipio */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-semibold mb-1" style={{ color: '#6b635e' }}>
              {estadoParam === 'pendiente' ? 'Municipio' : 'Municipio'}
            </label>
            <select
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400 bg-white"
              value={municipioId}
              onChange={(e) => setMunicipioId(e.target.value)}
            >
              <option value="">Todos</option>
              {municipios.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
          </div>
          {/* Urgencia / Mes */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-semibold mb-1" style={{ color: '#6b635e' }}>
              {estadoParam === 'pendiente' ? 'Urgencia' : 'Período'}
            </label>
            {estadoParam === 'pendiente' ? (
              <select
                className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400 bg-white"
                value={urgencia}
                onChange={(e) => setUrgencia(e.target.value)}
              >
                <option value="">Cualquiera</option>
                <option value="alta">Alta (&gt;7 días)</option>
                <option value="media">Media (3–7 días)</option>
                <option value="baja">Baja (&lt;3 días)</option>
              </select>
            ) : (
              <select
                className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400 bg-white"
              >
                <option>Cualquier período</option>
              </select>
            )}
          </div>
          {/* Ordenar */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-semibold mb-1" style={{ color: '#6b635e' }}>Ordenar por</label>
            <select
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400 bg-white"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="mas_antigua">Más antigua primero</option>
              <option value="mas_reciente">Más reciente</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── TABLE + DRAWER ────────────────────────────────────────────── */}
      <div
        className="transition-all duration-300"
        style={{ display: 'grid', gridTemplateColumns: drawerOpen ? '1fr 460px' : '1fr', gap: 16 }}
      >
        {/* TABLE */}
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          {/* Results bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-50" style={{ background: 'white' }}>
            <span className="text-sm" style={{ color: '#443e39' }}>
              Mostrando <strong>{solicitudes.length}</strong> de <strong>{total}</strong>{' '}
              solicitudes {estadoParam === 'pendiente' ? 'pendientes' : estadoParam === 'aprobada' ? 'aprobadas' : 'rechazadas'}
            </span>
          </div>

          {loading ? (
            <div className="py-16 text-center text-sm" style={{ color: '#6b635e' }}>Cargando solicitudes…</div>
          ) : solicitudes.length === 0 ? (
            <EmptyState estado={estadoParam} />
          ) : (
            <>
              {/* Table header */}
              <div
                className="grid text-[10px] font-bold uppercase tracking-widest px-4 py-3 border-b border-stone-200"
                style={{
                  gridTemplateColumns: drawerOpen
                    ? estadoParam === 'pendiente' ? '1fr 80px 80px' : '1fr 100px 100px'
                    : estadoParam === 'pendiente' ? '1.4fr 180px 140px 90px 90px 100px' : '1.4fr 180px 140px 120px 120px',
                  gap: 8,
                  background: '#fdfaf3',
                  color: '#6b635e',
                }}
              >
                {drawerOpen ? (
                  <>
                    <div>Solicitante</div>
                    <div>Municipio</div>
                    <div>Urgencia</div>
                  </>
                ) : estadoParam === 'pendiente' ? (
                  <>
                    <div>Solicitante</div>
                    <div>Email</div>
                    <div>Municipio</div>
                    <div>Fecha</div>
                    <div>Urgencia</div>
                    <div style={{ textAlign: 'right' }}>Acciones</div>
                  </>
                ) : estadoParam === 'aprobada' ? (
                  <>
                    <div>Solicitante</div>
                    <div>Email</div>
                    <div>Municipio</div>
                    <div>Aprobada</div>
                    <div>Gestor asignado</div>
                  </>
                ) : (
                  <>
                    <div>Solicitante</div>
                    <div>Email</div>
                    <div>Municipio</div>
                    <div>Rechazada</div>
                    <div>Motivo</div>
                  </>
                )}
              </div>

              {/* Rows */}
              {solicitudes.map((s) => (
                <SolicitudRow
                  key={s.id}
                  solicitud={s}
                  estado={estadoParam}
                  drawerOpen={drawerOpen}
                  selected={s.id === selectedId}
                  onClick={() => setSelectedId(s.id === selectedId ? null : s.id)}
                  onApprove={(e) => { e.stopPropagation(); setSelectedId(s.id); setModal('aprobar'); }}
                  onReject={(e) => { e.stopPropagation(); setSelectedId(s.id); setModal('rechazar'); }}
                />
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-stone-100">
                  <span className="text-xs" style={{ color: '#6b635e' }}>Página {page} de {totalPages}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="w-8 h-8 flex items-center justify-center border border-stone-200 rounded-lg disabled:opacity-40 hover:bg-stone-50"
                    >
                      <ChevronLeft size={13} />
                    </button>
                    {buildPageRange(page, totalPages).map((p2, i) =>
                      p2 === '...' ? (
                        <span key={i} className="w-8 h-8 flex items-center justify-center text-xs" style={{ color: '#6b635e' }}>…</span>
                      ) : (
                        <button
                          key={p2}
                          onClick={() => setPage(p2 as number)}
                          className="w-8 h-8 flex items-center justify-center text-xs font-semibold border rounded-lg"
                          style={{
                            background: p2 === page ? 'var(--color-guinda-700)' : 'white',
                            color: p2 === page ? 'white' : '#443e39',
                            borderColor: p2 === page ? 'var(--color-guinda-700)' : '#eadfd7',
                          }}
                        >
                          {p2}
                        </button>
                      )
                    )}
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="w-8 h-8 flex items-center justify-center border border-stone-200 rounded-lg disabled:opacity-40 hover:bg-stone-50"
                    >
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* DRAWER */}
        {drawerOpen && (
          <SolicitudDrawer
            solicitud={selectedSolicitud}
            onClose={() => setSelectedId(null)}
            onApprove={() => setModal('aprobar')}
            onReject={() => setModal('rechazar')}
          />
        )}
      </div>

      {/* ── MODALS ────────────────────────────────────────────────────── */}
      {modal === 'aprobar' && modalSolicitud && (
        <AprobarModal
          solicitud={modalSolicitud}
          onClose={() => setModal(null)}
          onSuccess={handleApproveSuccess}
        />
      )}

      {modal === 'rechazar' && modalSolicitud && (
        <RechazarModal
          solicitud={modalSolicitud}
          onClose={() => setModal(null)}
          onSuccess={handleRejectSuccess}
        />
      )}
    </AdminLayout>
  );
}

// ─── SolicitudRow ─────────────────────────────────────────────────────────

function SolicitudRow({
  solicitud: s, estado, drawerOpen, selected, onClick, onApprove, onReject,
}: {
  solicitud: Solicitud;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  drawerOpen: boolean;
  selected: boolean;
  onClick: () => void;
  onApprove: (e: React.MouseEvent) => void;
  onReject: (e: React.MouseEvent) => void;
}) {
  const cols = drawerOpen
    ? (estado === 'pendiente' ? '1fr 80px 80px' : '1fr 100px 100px')
    : (estado === 'pendiente' ? '1.4fr 180px 140px 90px 90px 100px' : '1.4fr 180px 140px 120px 120px');

  return (
    <div
      className="grid items-center px-4 py-3 border-b border-stone-50 last:border-b-0 cursor-pointer transition-colors"
      style={{
        gridTemplateColumns: cols,
        gap: 8,
        background: selected ? '#fdf2f4' : 'white',
        borderLeft: selected ? '3px solid var(--color-guinda-700)' : '3px solid transparent',
      }}
      onClick={onClick}
      onMouseEnter={(e) => { if (!selected) (e.currentTarget as HTMLElement).style.background = '#fafaf9'; }}
      onMouseLeave={(e) => { if (!selected) (e.currentTarget as HTMLElement).style.background = 'white'; }}
    >
      {/* Solicitante */}
      <div className="flex items-center gap-2.5 min-w-0">
        <SolicitanteAvatar iniciales={s.iniciales} />
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate" style={{ fontFamily: "'Poppins', sans-serif", color: '#2a2a2a' }}>
            {s.nombreCompleto}
          </div>
          <div className="text-[11px] font-mono truncate" style={{ color: '#6b635e' }}>{s.curp}</div>
        </div>
      </div>

      {/* Compact drawer mode */}
      {drawerOpen ? (
        <>
          <div>
            <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ background: '#f8f4ec', color: '#443e39' }}>
              {s.municipio?.nombre ?? '—'}
            </span>
          </div>
          <div>
            {estado === 'pendiente' && <UrgenciaPill urgencia={s.urgencia} />}
          </div>
        </>
      ) : estado === 'pendiente' ? (
        <>
          <div className="text-xs font-mono truncate" style={{ color: '#6b635e' }}>{s.email}</div>
          <div>
            <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ background: '#f8f4ec', color: '#443e39' }}>
              {s.municipio?.nombre ?? '—'}
            </span>
          </div>
          <div>
            <div className="text-xs" style={{ color: '#443e39' }}>
              {new Date(s.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
            </div>
            <div className="text-[11px]" style={{ color: '#6b635e' }}>{s.fechaTexto}</div>
          </div>
          <div><UrgenciaPill urgencia={s.urgencia} /></div>
          {/* Inline actions */}
          <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
            <ActionBtn variant="success" title="Aprobar" onClick={onApprove}><Check size={12} /></ActionBtn>
            <ActionBtn variant="danger" title="Rechazar" onClick={onReject}><X size={12} /></ActionBtn>
            <ActionBtn variant="default" title="Ver detalle" onClick={(e) => { e.stopPropagation(); onClick(); }}>
              <Eye size={12} />
            </ActionBtn>
          </div>
        </>
      ) : estado === 'aprobada' ? (
        <>
          <div className="text-xs font-mono truncate" style={{ color: '#6b635e' }}>{s.email}</div>
          <div>
            <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ background: '#f8f4ec', color: '#443e39' }}>
              {s.municipio?.nombre ?? '—'}
            </span>
          </div>
          <div className="text-xs" style={{ color: '#6b635e' }}>
            {s.procesadaEn
              ? new Date(s.procesadaEn).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
              : '—'}
          </div>
          <div className="text-xs" style={{ color: s.gestorAsignado ? '#443e39' : '#a89a8e' }}>
            {s.gestorAsignado ? s.gestorAsignado.nombreCorto : <em>Sin gestor</em>}
          </div>
        </>
      ) : (
        <>
          <div className="text-xs font-mono truncate" style={{ color: '#6b635e' }}>{s.email}</div>
          <div>
            <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ background: '#f8f4ec', color: '#443e39' }}>
              {s.municipio?.nombre ?? '—'}
            </span>
          </div>
          <div className="text-xs" style={{ color: '#6b635e' }}>
            {s.procesadaEn
              ? new Date(s.procesadaEn).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
              : '—'}
          </div>
          <div className="text-xs truncate" style={{ color: '#443e39' }}>{s.motivoRechazo ?? '—'}</div>
        </>
      )}
    </div>
  );
}

// ─── ActionBtn ────────────────────────────────────────────────────────────

function ActionBtn({
  variant, title, onClick, children,
}: {
  variant: 'success' | 'danger' | 'default';
  title: string;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  const styles = {
    success: { bg: '#d1fae5', border: '#86efac', color: '#2d7d46', hoverBg: '#2d7d46', hoverColor: 'white' },
    danger:  { bg: '#fee2e2', border: '#fca5a5', color: '#b91c1c', hoverBg: '#b91c1c', hoverColor: 'white' },
    default: { bg: 'white',   border: '#eadfd7', color: '#443e39', hoverBg: 'var(--color-guinda-700)', hoverColor: 'white' },
  }[variant];

  return (
    <button
      title={title}
      onClick={onClick}
      className="w-7 h-7 flex items-center justify-center rounded-md border transition-all"
      style={{ background: styles.bg, borderColor: styles.border, color: styles.color }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = styles.hoverBg;
        (e.currentTarget as HTMLElement).style.color = styles.hoverColor;
        (e.currentTarget as HTMLElement).style.borderColor = styles.hoverBg;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = styles.bg;
        (e.currentTarget as HTMLElement).style.color = styles.color;
        (e.currentTarget as HTMLElement).style.borderColor = styles.border;
      }}
    >
      {children}
    </button>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────

function StatCard({ icon, num, label, variant }: { icon: React.ReactNode; num: number | string | undefined; label: string; variant: string }) {
  const cfg: Record<string, { iconBg: string; iconColor: string }> = {
    warning:  { iconBg: '#fef9c3', iconColor: '#c77700' },
    alert:    { iconBg: '#fee2e2', iconColor: '#b91c1c' },
    success:  { iconBg: '#d1fae5', iconColor: '#2d7d46' },
    rechazado:{ iconBg: '#fee2e2', iconColor: '#b91c1c' },
    info:     { iconBg: '#dbeafe', iconColor: '#1d4ed8' },
  };
  const c = cfg[variant] ?? cfg.info;

  return (
    <div className="bg-white border border-stone-200 rounded-xl px-4 py-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: c.iconBg, color: c.iconColor }}>
        {icon}
      </div>
      <div>
        <div className="text-xl font-bold" style={{ fontFamily: "'Poppins', sans-serif", color: '#1a1a1a' }}>{num ?? '—'}</div>
        <div className="text-[11px] uppercase tracking-wide font-medium" style={{ color: '#6b635e' }}>{label}</div>
      </div>
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────

function EmptyState({ estado }: { estado: string }) {
  return (
    <div className="py-16 text-center">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
        style={{ background: '#d1fae5', color: '#2d7d46' }}
      >
        <CheckCircle size={28} />
      </div>
      <h3 className="text-lg font-bold mb-1" style={{ fontFamily: "'Poppins', sans-serif", color: '#1a1a1a' }}>
        {estado === 'pendiente' ? 'Todo al día ✓' : 'Sin resultados'}
      </h3>
      <p className="text-sm" style={{ color: '#6b635e' }}>
        {estado === 'pendiente'
          ? 'No hay solicitudes pendientes de revisión por ahora.'
          : 'No hay solicitudes con los filtros seleccionados.'}
      </p>
    </div>
  );
}

// ─── buildPageRange ───────────────────────────────────────────────────────

function buildPageRange(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '...')[] = [1];
  if (current > 3) pages.push('...');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}

