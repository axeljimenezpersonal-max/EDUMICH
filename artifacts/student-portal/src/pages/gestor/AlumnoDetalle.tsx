import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useRoute } from 'wouter';
import {
  ArrowLeft,
  Calendar,
  Phone,
  MapPin,
  Mail,
  AlertCircle,
  FolderOpen,
  CreditCard,
  GraduationCap,
  Plus,
  Info,
  MoreVertical,
  Send,
  X,
  CheckCircle2,
  Copy,
  Loader2,
  Award,
  Download,
  FileText,
  Lock,
  BookOpen,
  Save,
} from 'lucide-react';
import { GestorLayout } from './GestorLayout';
import {
  api,
  type AlumnoDetalle as AlumnoDetalleType,
  type GestorExpedienteResponse,
  type TipoDocumento,
  type PagosResponse,
  type GestorPlanModularResponse,
  type GestorPlanModularModulo,
} from '../../lib/api';
import { StatusBadge } from '../../components/StatusBadge';
import DocumentoUploader from '../../components/DocumentoUploader';
import PagoCard from '../../components/PagoCard';
import SubirPagoModal from '../../components/SubirPagoModal';
import CalificacionesTabContent from '../../components/CalificacionesTabContent';

interface AlumnoConMatricula {
  userId: number;
  nombreCompleto: string;
  curp: string;
  fechaNacimiento: string | null;
  telefono: string | null;
  direccion: string | null;
  email: string;
  createdAt: string;
  passwordTemporal: boolean;
  bienvenidaEnviadaEn: string | null;
  folioPreregistro?: string | null;
  preregistroVigenteHasta?: string | null;
  matriculaOficialDGB?: string | null;
  matriculaCapturadaEn?: string | null;
  licenciaDigital?: string | null;
  licenciaEmitidaEn?: string | null;
}

interface DocDef {
  tipo: TipoDocumento;
  label: string;
  descripcion: string;
  obligatorio: boolean;
  acceptImages?: boolean;
}

const DOCUMENTOS_EXPEDIENTE: DocDef[] = [
  { tipo: 'curp', label: 'CURP', descripcion: 'Clave Única de Registro de Población (PDF oficial)', obligatorio: true },
  { tipo: 'acta_nacimiento', label: 'Acta de nacimiento', descripcion: 'Acta de nacimiento oficial o copia certificada', obligatorio: true },
  { tipo: 'ine', label: 'Identificación oficial', descripcion: 'INE / IFE vigente por ambos lados', obligatorio: true },
  { tipo: 'comprobante_domicilio', label: 'Comprobante de domicilio', descripcion: 'No mayor a 3 meses de antigüedad', obligatorio: true },
  { tipo: 'foto', label: 'Fotografía', descripcion: 'Foto tamaño infantil, fondo blanco (JPG, PNG o PDF)', obligatorio: false, acceptImages: true },
  { tipo: 'comprobante_pago', label: 'Comprobante de pago', descripcion: 'Comprobante de pago de derechos de inscripción', obligatorio: false },
];

type ActiveTab = 'docs' | 'pagos' | 'calificaciones' | 'plan';

interface ToastState {
  msg: string;
  type: 'success' | 'error';
  detail?: string;
}

export default function AlumnoDetalle() {
  const [, params] = useRoute('/gestor/alumnos/:id');
  const [, setLocation] = useLocation();
  const id = params?.id ? Number(params.id) : null;

  const [data, setData] = useState<AlumnoDetalleType | null>(null);
  const [expediente, setExpediente] = useState<GestorExpedienteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>('docs');
  const [pagosData, setPagosData] = useState<PagosResponse | null>(null);
  const [pagosLoading, setPagosLoading] = useState(false);
  const [modalPago, setModalPago] = useState(false);

  // Plan modular
  const [planData, setPlanData] = useState<GestorPlanModularResponse | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planSeleccion, setPlanSeleccion] = useState<Set<number>>(new Set());
  const [planGuardando, setPlanGuardando] = useState(false);

  // Acciones menu
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Reenviar modal
  const [reenviarModal, setReenviarModal] = useState(false);
  const [reenviarLoading, setReenviarLoading] = useState(false);
  const [reenviarResult, setReenviarResult] = useState<{ credencial?: string } | null>(null);

  // Toast
  const [toast, setToast] = useState<ToastState | null>(null);

  function showToast(msg: string, type: 'success' | 'error', detail?: string) {
    setToast({ msg, type, detail });
    setTimeout(() => setToast(null), 4000);
  }

  // Aprobar / rechazar documentos
  const [modalAprobarDoc, setModalAprobarDoc] = useState<{ id: number; tipo: string; nombre: string } | null>(null);
  const [modalRechazarDoc, setModalRechazarDoc] = useState<{ id: number; tipo: string; nombre: string } | null>(null);
  const [docActionLoading, setDocActionLoading] = useState(false);
  const [motivoRechazoGestor, setMotivoRechazoGestor] = useState('');

  async function handleAprobarDoc(docId: number) {
    setDocActionLoading(true);
    try {
      await api.patch(`/gestor/expediente-documentos/${docId}/aprobar`, {});
      showToast('Documento aprobado', 'success');
      setModalAprobarDoc(null);
      await reloadExpediente();
    } catch (e) {
      showToast((e as Error).message || 'Error al aprobar', 'error');
    } finally {
      setDocActionLoading(false);
    }
  }

  async function handleRechazarDoc(docId: number, motivo: string) {
    setDocActionLoading(true);
    try {
      await api.patch(`/gestor/expediente-documentos/${docId}/rechazar`, { motivoRechazo: motivo });
      showToast('Documento rechazado', 'error');
      setModalRechazarDoc(null);
      setMotivoRechazoGestor('');
      await reloadExpediente();
    } catch (e) {
      showToast((e as Error).message || 'Error al rechazar', 'error');
    } finally {
      setDocActionLoading(false);
    }
  }

  // Close menu on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function load() {
    if (!id) return;
    try {
      const [alumnoData, expData] = await Promise.all([
        api.get<AlumnoDetalleType>(`/gestor/alumnos/${id}`),
        api.get<GestorExpedienteResponse>(`/gestor/alumnos/${id}/expediente`),
      ]);
      setData(alumnoData);
      setExpediente(expData);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function reloadExpediente() {
    if (!id) return;
    try {
      const expData = await api.get<GestorExpedienteResponse>(`/gestor/alumnos/${id}/expediente`);
      setExpediente(expData);
    } catch {}
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (activeTab !== 'pagos' || !id) return;
    setPagosLoading(true);
    api.get<PagosResponse>(`/pagos/estudiantes/${id}`)
      .then(setPagosData)
      .catch(() => {})
      .finally(() => setPagosLoading(false));
  }, [activeTab, id]);

  useEffect(() => {
    if (activeTab !== 'plan' || !id) return;
    setPlanLoading(true);
    api.get<GestorPlanModularResponse>(`/gestor/alumnos/${id}/plan-modular`)
      .then((d) => {
        setPlanData(d);
        setPlanSeleccion(new Set(d.modulos.filter((m) => m.enPlan).map((m) => m.id)));
      })
      .catch(() => {})
      .finally(() => setPlanLoading(false));
  }, [activeTab, id]);

  async function handleGuardarPlan() {
    if (!id) return;
    setPlanGuardando(true);
    try {
      await api.put(`/gestor/alumnos/${id}/plan-modular`, {
        moduloIds: Array.from(planSeleccion),
      });
      showToast(`Plan guardado — ${planSeleccion.size} módulo${planSeleccion.size !== 1 ? 's' : ''} asignado${planSeleccion.size !== 1 ? 's' : ''}`, 'success');
      // Reload plan data to sync enPlan flags
      const d = await api.get<GestorPlanModularResponse>(`/gestor/alumnos/${id}/plan-modular`);
      setPlanData(d);
      setPlanSeleccion(new Set(d.modulos.filter((m) => m.enPlan).map((m) => m.id)));
    } catch (e) {
      showToast((e as Error).message || 'Error al guardar el plan', 'error');
    } finally {
      setPlanGuardando(false);
    }
  }

  async function handleReenviar() {
    if (!id) return;
    setReenviarLoading(true);
    try {
      const r = await api.post<{
        ok: boolean;
        emailEnviado: boolean;
        modoEmail: 'dev' | 'production';
        credencialTemporal?: string;
      }>(`/gestor/alumnos/${id}/reenviar-credenciales`);

      setReenviarResult(r.credencialTemporal ? { credencial: r.credencialTemporal } : {});
      showToast('Credenciales enviadas correctamente', 'success');
      // Reload to update badge
      load();
    } catch (e) {
      const msg = (e as Error).message;
      setReenviarModal(false);
      showToast('Error al reenviar credenciales', 'error', msg);
    } finally {
      setReenviarLoading(false);
    }
  }

  if (error) {
    return (
      <GestorLayout>
        <div className="bg-white border border-red-200 rounded-md p-6">
          <div className="flex items-start gap-2 text-red-700">
            <AlertCircle size={18} />
            <div>{error}</div>
          </div>
          <button
            onClick={() => setLocation('/gestor/alumnos')}
            className="gov-btn-secondary mt-4"
          >
            Volver
          </button>
        </div>
      </GestorLayout>
    );
  }

  if (!data) {
    return (
      <GestorLayout>
        <div className="bg-white border border-stone-200 rounded-md p-12 text-center text-stone-500">
          Cargando...
        </div>
      </GestorLayout>
    );
  }

  const { alumno: alumnoBase, inscripciones } = data;
  const alumno = alumnoBase as AlumnoConMatricula;
  const inscripcionActiva = inscripciones[0];
  const docs = expediente?.documentos ?? {};

  const obligatorios = DOCUMENTOS_EXPEDIENTE.filter((d) => d.obligatorio);
  const opcionales = DOCUMENTOS_EXPEDIENTE.filter((d) => !d.obligatorio);
  const docsCount = Object.keys(docs).length;
  const obligatoriosFaltantes = obligatorios.filter((d) => !docs[d.tipo]);

  const planAsignadosCount = planData
    ? planData.modulos.filter((m) => m.enPlan).length
    : planSeleccion.size;

  const tabItems: { key: ActiveTab; label: string; icon: React.ReactNode; badge: string }[] = [
    {
      key: 'docs',
      label: 'Documentos',
      icon: <FolderOpen size={15} />,
      badge: `${docsCount}/6`,
    },
    {
      key: 'pagos',
      label: 'Pagos',
      icon: <CreditCard size={15} />,
      badge: pagosData !== null ? String(pagosData.pagos.length) : '—',
    },
    {
      key: 'calificaciones',
      label: 'Calificaciones',
      icon: <GraduationCap size={15} />,
      badge: '—',
    },
    {
      key: 'plan',
      label: 'Plan Modular',
      icon: <BookOpen size={15} />,
      badge: planAsignadosCount > 0 ? String(planAsignadosCount) : '—',
    },
  ];

  const bienvenidaFecha = alumno.bienvenidaEnviadaEn
    ? new Date(alumno.bienvenidaEnviadaEn).toLocaleDateString('es-MX', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : null;

  return (
    <GestorLayout>
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-start gap-2 px-4 py-3 rounded-lg shadow-lg text-sm max-w-sm ${
            toast.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
          <div>
            <div className="font-semibold">{toast.msg}</div>
            {toast.detail && <div className="text-xs opacity-75 mt-0.5">{toast.detail}</div>}
          </div>
          <button onClick={() => setToast(null)} className="ml-2 opacity-60 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

      <Link
        href="/gestor/alumnos"
        className="text-sm text-stone-600 hover:text-[var(--color-guinda-700)] inline-flex items-center gap-1.5 mb-4"
      >
        <ArrowLeft size={14} />
        Volver a mis alumnos
      </Link>

      {/* Cabecera */}
      <div className="bg-white border border-stone-200 rounded-md p-6 mb-6">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[var(--color-guinda-700)] font-semibold mb-1">
              Alumno
            </div>
            <h1 className="font-serif text-3xl font-bold text-stone-900 mb-1">
              {alumno.nombreCompleto}
            </h1>
            <div className="font-mono text-sm text-stone-600 mb-2">{alumno.curp}</div>
            {/* Primer ingreso badge */}
            {alumno.passwordTemporal && (
              <div className="inline-flex items-center gap-1.5" title={bienvenidaFecha ? `Credenciales enviadas el ${bienvenidaFecha}` : 'Credenciales aún no enviadas'}>
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold border border-amber-200">
                  <Send size={10} />
                  PRIMER INGRESO PENDIENTE
                </span>
                {bienvenidaFecha && (
                  <span className="text-[10px] text-stone-400">Enviado el {bienvenidaFecha}</span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-start gap-3">
            {/* Inscripción estado */}
            {inscripcionActiva && (
              <div className="text-right">
                <div className="text-xs uppercase tracking-widest text-stone-500 font-semibold mb-1">
                  Estado de inscripción
                </div>
                <StatusBadge estado={inscripcionActiva.estado} />
                <div className="text-xs text-stone-500 mt-1">
                  {inscripcionActiva.convocatoria}
                </div>
              </div>
            )}

            {/* Acciones "..." menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="p-2 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-500 hover:text-stone-700 transition-colors"
                title="Acciones"
              >
                <MoreVertical size={16} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-stone-200 rounded-lg shadow-lg z-20 py-1 overflow-hidden">
                  {alumno.passwordTemporal ? (
                    <button
                      onClick={() => { setMenuOpen(false); setReenviarModal(true); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-stone-700 hover:bg-stone-50 text-left"
                    >
                      <Send size={14} className="text-amber-500 shrink-0" />
                      Reenviar credenciales por correo
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2.5 text-sm text-stone-400 cursor-not-allowed">
                      <Send size={14} className="shrink-0" />
                      <span>
                        Reenviar credenciales
                        <div className="text-[10px] leading-tight">El alumno ya cambió su contraseña</div>
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Datos personales */}
        <div className="mt-6 pt-6 border-t border-stone-200 grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-8 text-sm">
          <DataRow icon={Mail} label="Correo" value={alumno.email} />
          <DataRow icon={Phone} label="Teléfono" value={alumno.telefono ?? '—'} />
          <DataRow
            icon={Calendar}
            label="Fecha de nacimiento"
            value={
              alumno.fechaNacimiento
                ? new Date(alumno.fechaNacimiento).toLocaleDateString('es-MX', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })
                : '—'
            }
          />
          <DataRow icon={MapPin} label="Dirección" value={alumno.direccion ?? '—'} />
        </div>
      </div>

      {/* Matrícula oficial DGB — solo lectura para el gestor */}
      {!alumno.matriculaOficialDGB ? (
        <div style={{ background: '#fff', border: '1px solid #e7e5e4', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f5f5f4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Award size={18} style={{ color: '#a8a29e' }} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: '#2a2a2a' }}>Matrícula oficial DGB</h3>
              <p style={{ fontSize: 12, color: '#78716c', margin: '3px 0 8px' }}>Pendiente de asignación por la administración.</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#78716c', background: '#f5f5f4', border: '1px solid #e7e5e4', borderRadius: 6, padding: '7px 12px' }}>
                <Lock size={11} style={{ flexShrink: 0 }} />
                La matrícula la asigna exclusivamente la administración una vez validado el expediente completo.
              </div>
            </div>
          </div>
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
                Asignada el {alumno.matriculaCapturadaEn ? new Date(alumno.matriculaCapturadaEn).toLocaleDateString('es-MX', {day:'numeric',month:'short',year:'numeric'}) : '—'}
              </p>
            </div>
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #e7e5e4', borderRadius: 10, padding: '14px 18px', marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#78716c', marginBottom: 3 }}>MATRÍCULA</div>
            <div style={{ fontFamily: "'JetBrains Mono', 'Courier New', monospace", fontSize: 22, fontWeight: 700, color: 'var(--color-guinda-700)', letterSpacing: '0.05em' }}>
              {alumno.matriculaOficialDGB}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a href={`/api/gestor/alumnos/${id}/ficha-registro`} target="_blank" rel="noopener" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#16a34a', color: 'white', borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
              <Download size={12} /> Ficha de registro PDF
            </a>
            <a href={`/api/gestor/alumnos/${id}/ficha-preregistro`} target="_blank" rel="noopener" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1px solid #e7e5e4', borderRadius: 8, fontSize: 12, color: '#44403c', textDecoration: 'none' }}>
              <FileText size={12} /> Ficha de pre-registro
            </a>
          </div>
        </div>
      )}

      {/* Licencia digital — solo lectura para el gestor */}
      {alumno.licenciaDigital ? (
        <div style={{ background: 'linear-gradient(135deg, #f5f3ff 0%, #fff 100%)', border: '1px solid #c4b5fd', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Award size={18} style={{ color: '#7c3aed' }} />
            </div>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: '#2a2a2a' }}>Licencia digital</h3>
              <p style={{ fontSize: 12, color: '#78716c', margin: '3px 0 0' }}>
                Emitida el {alumno.licenciaEmitidaEn ? new Date(alumno.licenciaEmitidaEn).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
              </p>
            </div>
          </div>
          <div style={{ background: '#faf8ff', border: '1px solid #e7e5e4', borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#78716c', marginBottom: 3 }}>LICENCIA DIGITAL</div>
            <div style={{ fontFamily: "'JetBrains Mono', 'Courier New', monospace", fontSize: 20, fontWeight: 700, color: '#7c3aed', letterSpacing: '0.05em' }}>
              {alumno.licenciaDigital}
            </div>
          </div>
        </div>
      ) : null}

      {/* Tab bar */}
      <div className="bg-white border border-stone-200 rounded-xl p-1.5 flex gap-0.5 mb-5">
        {tabItems.map(({ key, label, icon, badge }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                active
                  ? 'bg-[var(--color-guinda-700)] text-white'
                  : 'text-stone-500 hover:bg-[var(--color-crema-50)] hover:text-stone-900'
              }`}
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {icon}
              {label}
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  active
                    ? 'bg-white/20 text-white'
                    : 'bg-[var(--color-crema-100)] text-stone-700'
                }`}
              >
                {badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* TAB: Documentos */}
      {activeTab === 'docs' && (
        <>
          {obligatoriosFaltantes.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4 flex items-start gap-2">
              <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-amber-900 mb-0.5">
                  Faltan {obligatoriosFaltantes.length} documento{obligatoriosFaltantes.length > 1 ? 's' : ''} obligatorio{obligatoriosFaltantes.length > 1 ? 's' : ''}
                </div>
                <div className="text-xs text-amber-700">
                  {obligatoriosFaltantes.map((d) => d.label).join(', ')}
                </div>
              </div>
            </div>
          )}
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4 flex items-start gap-2 text-xs text-blue-900">
            <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
            El alumno tiene 4 documentos obligatorios y 2 opcionales. Tú puedes subir documentos por él si los trae físicamente, o él mismo desde su portal.
          </div>

          {[
            { title: 'Documentos obligatorios', defs: obligatorios, isRequired: true },
            { title: 'Documentos opcionales',   defs: opcionales,   isRequired: false },
          ].map(({ title, defs, isRequired }) => (
            <section key={title} className="mb-6">
              <h3 className="text-sm font-semibold text-stone-700 uppercase tracking-widest mb-3">
                {title}
              </h3>
              <div className="space-y-3">
                {defs.map((def) => {
                  const doc = docs[def.tipo];
                  return (
                    <div key={def.tipo}>
                      <DocumentoUploader
                        tipo={def.tipo}
                        label={def.label}
                        descripcion={def.descripcion}
                        isRequired={isRequired}
                        doc={doc}
                        endpoints={{
                          upload: `/api/gestor/alumnos/${id}/expediente/documento/${def.tipo}`,
                          preview: `/api/gestor/alumnos/${id}/expediente/documento/${def.tipo}/preview`,
                          descargar: `/api/gestor/alumnos/${id}/expediente/documento/${def.tipo}/descargar`,
                        }}
                        acceptImages={def.acceptImages}
                        onUploaded={reloadExpediente}
                      />
                      {doc && doc.estado === 'pendiente_revision' && (
                        <div className="flex items-center gap-2 mt-1.5 pl-2">
                          <span className="text-[11px] text-amber-700 font-semibold uppercase tracking-wide">
                            Pendiente de aprobación
                          </span>
                          <button
                            onClick={() => setModalAprobarDoc({ id: doc.id, tipo: def.tipo, nombre: doc.nombreOriginal })}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold border rounded-lg"
                            style={{ color: '#2d7d46', border: '1px solid #86efac', background: '#f0fdf4' }}
                          >
                            <CheckCircle2 size={11} /> Aprobar
                          </button>
                          <button
                            onClick={() => { setMotivoRechazoGestor(''); setModalRechazarDoc({ id: doc.id, tipo: def.tipo, nombre: doc.nombreOriginal }); }}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold border rounded-lg"
                            style={{ color: '#b91c1c', border: '1px solid #fca5a5', background: 'white' }}
                          >
                            <AlertCircle size={11} /> Rechazar
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </>
      )}

      {/* TAB: Pagos */}
      {activeTab === 'pagos' && (
        <>
          {pagosLoading ? (
            <div className="text-center text-stone-400 py-16 text-sm">Cargando pagos…</div>
          ) : pagosData ? (
            <>
              <div className="bg-gradient-to-r from-[var(--color-guinda-800)] to-[var(--color-guinda-600)] text-white rounded-xl p-5 mb-5 grid grid-cols-[1fr_auto_auto_auto] gap-6 items-center">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-1">
                    Total pagado y verificado
                  </div>
                  <div
                    className="text-4xl font-bold leading-none"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  >
                    ${pagosData.resumen.totalPagado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="h-14 w-px bg-white/20" />
                <div className="text-center">
                  <div className="text-4xl font-bold leading-none" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    {pagosData.resumen.verificados}
                  </div>
                  <div className="text-[9px] uppercase tracking-wider opacity-80 mt-1">Verificados</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold leading-none" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    {pagosData.resumen.pendientes}
                  </div>
                  <div className="text-[9px] uppercase tracking-wider opacity-80 mt-1">Pendientes</div>
                </div>
              </div>

              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-stone-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Historial de pagos
                </h3>
                <button
                  onClick={() => setModalPago(true)}
                  className="bg-[var(--color-guinda-700)] text-white text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 hover:bg-[var(--color-guinda-800)] transition-colors"
                >
                  <Plus size={12} />
                  Subir comprobante de pago
                </button>
              </div>

              {pagosData.pagos.length === 0 ? (
                <div className="border-2 border-dashed border-stone-200 rounded-xl p-12 text-center">
                  <CreditCard size={36} className="mx-auto text-stone-300 mb-3" />
                  <div className="text-sm font-bold text-stone-500" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    Sin pagos registrados
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {pagosData.pagos.map((pago) => (
                    <PagoCard
                      key={pago.id}
                      pago={pago}
                      onVerComprobante={(p) => window.open(`/api/pagos/${p.id}/comprobante`, '_blank')}
                    />
                  ))}
                </div>
              )}
            </>
          ) : null}

          {id !== null && (
            <SubirPagoModal
              open={modalPago}
              onClose={() => setModalPago(false)}
              estudianteId={id}
              onSuccess={() => {
                setPagosLoading(true);
                api.get<PagosResponse>(`/pagos/estudiantes/${id}`)
                  .then(setPagosData)
                  .catch(() => {})
                  .finally(() => setPagosLoading(false));
              }}
            />
          )}
        </>
      )}

      {/* TAB: Calificaciones */}
      {activeTab === 'calificaciones' && id !== null && (
        <CalificacionesTabContent estudianteId={id} readOnly={true} />
      )}

      {/* TAB: Plan Modular */}
      {activeTab === 'plan' && (
        <>
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-5 flex items-start gap-2 text-xs text-blue-900">
            <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
            Selecciona los módulos que debe cursar este alumno para acreditar. Solo estos módulos aparecerán en su portal.
          </div>

          {planLoading && (
            <div className="text-center text-stone-400 py-16 text-sm">Cargando plan modular…</div>
          )}

          {!planLoading && planData && (
            <PlanModularGrid
              modulos={planData.modulos}
              planSeleccion={planSeleccion}
              setPlanSeleccion={setPlanSeleccion}
              planGuardando={planGuardando}
              onGuardar={handleGuardarPlan}
            />
          )}
        </>
      )}

      {/* Modal: Reenviar credenciales */}
      {reenviarModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={() => { if (!reenviarLoading) { setReenviarModal(false); setReenviarResult(null); } }}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200">
              <div className="font-semibold text-stone-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Reenviar credenciales por correo
              </div>
              {!reenviarLoading && (
                <button onClick={() => { setReenviarModal(false); setReenviarResult(null); }} className="p-1 rounded hover:bg-stone-100 text-stone-500">
                  <X size={18} />
                </button>
              )}
            </div>

            <div className="p-5">
              {reenviarResult === null ? (
                <>
                  <p className="text-sm text-stone-700 mb-1">
                    ¿Reenviar correo de credenciales a <strong>{alumno.email}</strong>?
                  </p>
                  <p className="text-xs text-stone-500 mb-5">
                    Se generará una nueva contraseña temporal y se enviará al correo del alumno. La contraseña anterior quedará invalidada.
                  </p>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => { setReenviarModal(false); setReenviarResult(null); }}
                      disabled={reenviarLoading}
                      className="px-4 py-2 text-sm text-stone-600 border border-stone-300 rounded-lg hover:bg-stone-50 disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleReenviar}
                      disabled={reenviarLoading}
                      className="px-4 py-2 text-sm bg-[var(--color-guinda-700)] text-white rounded-lg hover:bg-[var(--color-guinda-800)] disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Send size={13} />
                      {reenviarLoading ? 'Enviando…' : 'Reenviar'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-emerald-700 mb-3">
                    <CheckCircle2 size={18} />
                    <span className="font-semibold text-sm">Credenciales enviadas correctamente</span>
                  </div>
                  {reenviarResult.credencial && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                      <div className="text-xs font-semibold text-amber-800 uppercase tracking-wider mb-1">
                        Modo dev — contraseña temporal generada:
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-lg font-bold text-[var(--color-guinda-700)] tracking-widest">
                          {reenviarResult.credencial}
                        </code>
                        <button
                          onClick={() => navigator.clipboard.writeText(reenviarResult.credencial!)}
                          className="p-1 rounded hover:bg-amber-100 text-amber-600"
                          title="Copiar"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                      <div className="text-[10px] text-amber-700 mt-1">
                        Anota esta contraseña para dársela al alumno si el correo falla.
                      </div>
                    </div>
                  )}
                  <button
                    onClick={() => { setReenviarModal(false); setReenviarResult(null); }}
                    className="w-full px-4 py-2 text-sm bg-stone-100 text-stone-700 rounded-lg hover:bg-stone-200"
                  >
                    Cerrar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: aprobar documento */}
      {modalAprobarDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 size={20} className="text-green-700" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-stone-900">¿Aprobar este documento?</h3>
                <p className="text-xs text-stone-500">Se contabilizará como completo en el expediente.</p>
              </div>
            </div>
            <div className="bg-stone-50 rounded-md p-3 mb-5">
              <div className="text-sm font-semibold text-stone-800">{modalAprobarDoc.tipo}</div>
              <div className="text-xs text-stone-500">{modalAprobarDoc.nombre}</div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setModalAprobarDoc(null)} className="gov-btn-secondary">Cancelar</button>
              <button
                onClick={() => handleAprobarDoc(modalAprobarDoc.id)}
                disabled={docActionLoading}
                className="gov-btn-primary inline-flex items-center gap-2 disabled:opacity-60"
                style={{ background: '#2d7d46', border: 'none' }}
              >
                {docActionLoading ? <Loader2 size={13} className="animate-spin" /> : null}
                Sí, aprobar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: rechazar documento */}
      {modalRechazarDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle size={20} className="text-red-700" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-stone-900">Rechazar documento</h3>
                <p className="text-xs text-stone-500">{modalRechazarDoc.tipo} · {modalRechazarDoc.nombre}</p>
              </div>
            </div>
            <div className="mb-3">
              <label className="gov-label">Motivo del rechazo <span className="text-red-600">*</span></label>
              <textarea
                value={motivoRechazoGestor}
                onChange={(e) => setMotivoRechazoGestor(e.target.value)}
                placeholder="El alumno verá esta razón para volver a subir el documento…"
                rows={3}
                className="gov-input resize-none"
              />
            </div>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {['Documento ilegible', 'Documento incompleto', 'Tipo incorrecto', 'Documento vencido'].map((m) => (
                <button
                  key={m}
                  onClick={() => setMotivoRechazoGestor(m)}
                  className="text-[11px] px-2.5 py-1 border rounded-full"
                  style={{
                    border: motivoRechazoGestor === m ? '1px solid #b91c1c' : '1px solid #d6d3d1',
                    background: motivoRechazoGestor === m ? '#fee2e2' : 'white',
                    color: motivoRechazoGestor === m ? '#b91c1c' : '#44403c',
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setModalRechazarDoc(null)} className="gov-btn-secondary">Cancelar</button>
              <button
                onClick={() => motivoRechazoGestor.trim() && handleRechazarDoc(modalRechazarDoc.id, motivoRechazoGestor.trim())}
                disabled={docActionLoading || !motivoRechazoGestor.trim()}
                className="gov-btn-primary inline-flex items-center gap-2 disabled:opacity-60"
                style={{ background: '#b91c1c', border: 'none' }}
              >
                {docActionLoading ? <Loader2 size={13} className="animate-spin" /> : null}
                Rechazar documento
              </button>
            </div>
          </div>
        </div>
      )}

    </GestorLayout>
  );
}

// ─────────────────────────────────────────────────────────────────

const NIVEL_LABELS: Record<number, string> = {
  1: 'Comunicación y bases',
  2: 'Pensamiento matemático y textos',
  3: 'Métodos y contextos',
  4: 'Especialidades',
};

function ModuloCheckbox({
  m,
  checked,
  onChange,
}: {
  m: GestorPlanModularModulo;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors select-none ${
        checked
          ? 'border-[var(--color-guinda-700)] bg-[var(--color-guinda-50,#faf0f3)]'
          : 'border-stone-200 bg-white hover:bg-stone-50'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="w-4 h-4 accent-[var(--color-guinda-700)] shrink-0"
      />
      <div className="min-w-0">
        <div className={`text-[11px] font-bold ${checked ? 'text-[var(--color-guinda-700)]' : 'text-stone-400'}`}>
          Módulo {m.numero}
        </div>
        <div className="text-xs text-stone-700 leading-snug truncate">{m.nombre}</div>
      </div>
    </label>
  );
}

function PlanModularGrid({
  modulos,
  planSeleccion,
  setPlanSeleccion,
  planGuardando,
  onGuardar,
}: {
  modulos: GestorPlanModularModulo[];
  planSeleccion: Set<number>;
  setPlanSeleccion: React.Dispatch<React.SetStateAction<Set<number>>>;
  planGuardando: boolean;
  onGuardar: () => void;
}) {
  const niveles = [1, 2, 3, 4];

  function toggleModulo(id: number) {
    setPlanSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {niveles.map((nivel) => {
        const modulosNivel = modulos.filter((m) => m.nivel === nivel);
        if (modulosNivel.length === 0) return null;
        return (
          <section key={nivel}>
            <h3 className="text-xs font-bold uppercase tracking-widest text-stone-500 mb-3">
              Nivel {nivel} — {NIVEL_LABELS[nivel]}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {modulosNivel.map((m) => (
                <ModuloCheckbox
                  key={m.id}
                  m={m}
                  checked={planSeleccion.has(m.id)}
                  onChange={() => toggleModulo(m.id)}
                />
              ))}
            </div>
          </section>
        );
      })}

      {modulos.filter((m) => !m.nivel).length > 0 && (
        <section>
          <h3 className="text-xs font-bold uppercase tracking-widest text-stone-500 mb-3">Otros módulos</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {modulos.filter((m) => !m.nivel).map((m) => (
              <ModuloCheckbox
                key={m.id}
                m={m}
                checked={planSeleccion.has(m.id)}
                onChange={() => toggleModulo(m.id)}
              />
            ))}
          </div>
        </section>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-stone-200">
        <div className="text-sm text-stone-500">
          <span className="font-bold text-stone-900">{planSeleccion.size}</span>{' '}
          módulo{planSeleccion.size !== 1 ? 's' : ''} seleccionado{planSeleccion.size !== 1 ? 's' : ''}
        </div>
        <button
          onClick={onGuardar}
          disabled={planGuardando}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-guinda-700)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--color-guinda-800)] disabled:opacity-60 transition-colors"
        >
          {planGuardando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Guardar plan modular
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
function DataRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={14} className="text-stone-400 mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-widest text-stone-500 font-semibold">{label}</div>
        <div className="text-stone-800 break-words">{value}</div>
      </div>
    </div>
  );
}
