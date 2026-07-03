import { Fragment, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useRoute } from 'wouter';
import {
  ArrowLeft,
  Calendar,
  Phone,
  MapPin,
  Mail,
  AlertCircle,
  FolderOpen,
  GraduationCap,
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
  CalendarCheck,
  Clock,
  AlertTriangle,
  UploadCloud,
  Receipt,
  UserCheck,
  Building2,
  Store,
  Banknote,
  Pencil,
  ClipboardList,
  FileSignature,
  RefreshCw,
  Landmark,
  CreditCard,
} from 'lucide-react';
import { GestorLayout } from './GestorLayout';
import {
  api,
  ApiError,
  type AlumnoDetalle as AlumnoDetalleType,
  type GestorExpedienteResponse,
  type TipoDocumento,
  type GestorConvocatoriaResponse,
  type GestorConvocatoriaPago,
  type GestorConfigPagoResponse,
  type CedulaDatos,
  type CedulaDatosEditable,
} from '../../lib/api';
import { StatusBadge } from '../../components/StatusBadge';
import DocumentoUploader from '../../components/DocumentoUploader';
import CalificacionesTabContent from '../../components/CalificacionesTabContent';
import FirmaPad from '../../components/FirmaPad';
import { CampoCopiable } from '../../components/CampoCopiable';

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
  { tipo: 'certificado_secundaria', label: 'Certificado de secundaria', descripcion: 'Certificado o constancia de secundaria (PDF, ambos lados)', obligatorio: true },
  { tipo: 'foto', label: 'Fotografía', descripcion: 'Foto tamaño infantil, fondo blanco (JPG, PNG o PDF)', obligatorio: false, acceptImages: true },
  { tipo: 'comprobante_pago', label: 'Comprobante de pago', descripcion: 'Comprobante de pago de derechos de inscripción', obligatorio: false },
];

const NIVEL_LABELS: Record<number, string> = {
  1: 'Comunicación y bases',
  2: 'Pensamiento matemático y textos',
  3: 'Métodos y contextos',
  4: 'Especialidades',
};


type ActiveTab = 'docs' | 'cedula' | 'plan' | 'convocatoria' | 'calificaciones';

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

  // Convocatoria + plan de estudios (shared state)
  const [convData, setConvData] = useState<GestorConvocatoriaResponse | null>(null);
  const [convLoading, setConvLoading] = useState(false);
  const [convSeleccion, setConvSeleccion] = useState<Set<number>>(new Set());
  const [convInscribiendo, setConvInscribiendo] = useState(false);

  // Configuración de pagos (datos bancarios + costo desde DB)
  const [configPago, setConfigPago] = useState<GestorConfigPagoResponse | null>(null);

  // Pago de derechos (dentro de convocatoria)
  const [pagoFile, setPagoFile] = useState<File | null>(null);
  const [pagoFecha, setPagoFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [pagoMetodo, setPagoMetodo] = useState('spei');
  const [pagoSubiendo, setPagoSubiendo] = useState(false);

  // Acciones menu
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Editar alumno modal
  const [editarModal, setEditarModal] = useState(false);
  const [editarLoading, setEditarLoading] = useState(false);
  const [editarFieldErrors, setEditarFieldErrors] = useState<Record<string, string>>({});

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
      const [alumnoData, expData, configData, convocatoriaData] = await Promise.all([
        api.get<AlumnoDetalleType>(`/gestor/alumnos/${id}`),
        api.get<GestorExpedienteResponse>(`/gestor/alumnos/${id}/expediente`),
        api.get<GestorConfigPagoResponse>(`/gestor/config-pago`),
        // Carga la convocatoria eagerly para que las badges de los tabs
        // muestren los conteos correctos desde el primer render.
        // Si falla (sin convocatoria activa), devuelve null sin romper la página.
        api.get<GestorConvocatoriaResponse>(`/gestor/alumnos/${id}/convocatoria`).catch(() => null),
      ]);
      setData(alumnoData);
      setExpediente(expData);
      setConfigPago(configData);
      setConvData(convocatoriaData);
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

  async function reloadConvocatoria() {
    if (!id) return;
    try {
      const d = await api.get<GestorConvocatoriaResponse>(`/gestor/alumnos/${id}/convocatoria`);
      setConvData(d);
    } catch {}
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Load convocatoria when Plan or Convocatoria tab is first opened
  useEffect(() => {
    if ((activeTab !== 'plan' && activeTab !== 'convocatoria') || !id) return;
    if (convData !== null) return; // already loaded
    setConvLoading(true);
    api.get<GestorConvocatoriaResponse>(`/gestor/alumnos/${id}/convocatoria`)
      .then((d) => {
        setConvData(d);
        setConvSeleccion(new Set());
      })
      .catch(() => {})
      .finally(() => setConvLoading(false));
  }, [activeTab, id, convData]);

  async function handleInscribir() {
    if (!id || !convData?.etapa || convSeleccion.size === 0) return;
    setConvInscribiendo(true);
    try {
      await api.post(`/gestor/alumnos/${id}/inscribir-examen`, {
        etapaId: convData.etapa.id,
        modulosIds: Array.from(convSeleccion),
      });
      showToast(`${convSeleccion.size} módulo${convSeleccion.size !== 1 ? 's' : ''} inscrito${convSeleccion.size !== 1 ? 's' : ''} correctamente`, 'success');
      setConvSeleccion(new Set());
      await reloadConvocatoria();
    } catch (e) {
      showToast((e as Error).message || 'Error al inscribir', 'error');
    } finally {
      setConvInscribiendo(false);
    }
  }

  async function handleSubirPago() {
    if (!id || !pagoFile || !convData?.inscripcionesActivas.length) return;
    setPagoSubiendo(true);
    try {
      const total = convData.inscripcionesActivas.length * convData.costoExamen;
      const folios = convData.inscripcionesActivas.map((i) => i.folio).join(', ');
      const form = new FormData();
      form.append('comprobante', pagoFile);
      form.append('concepto', 'derecho_examen');
      form.append('conceptoDetalle', `Folios: ${folios}`);
      form.append('monto', String(total));
      form.append('fechaPago', pagoFecha);
      form.append('metodoPago', pagoMetodo);
      await api.post(`/pagos/estudiantes/${id}`, form);
      showToast('Comprobante de pago subido correctamente', 'success');
      setPagoFile(null);
      await reloadConvocatoria();
    } catch (e) {
      showToast((e as Error).message || 'Error al subir comprobante', 'error');
    } finally {
      setPagoSubiendo(false);
    }
  }

  async function handleEditarAlumno(fields: {
    nombreCompleto: string;
    telefono: string;
    direccion: string;
    fechaNacimiento: string;
    curp: string;
  }) {
    if (!id) return;
    setEditarLoading(true);
    setEditarFieldErrors({});
    try {
      await api.patch(`/gestor/alumnos/${id}`, {
        nombreCompleto: fields.nombreCompleto.trim() || undefined,
        telefono: fields.telefono.trim() || null,
        direccion: fields.direccion.trim() || null,
        fechaNacimiento: fields.fechaNacimiento || null,
        curp: fields.curp.trim().toUpperCase() || undefined,
      });
      showToast('Información actualizada correctamente', 'success');
      setEditarModal(false);
      await load();
    } catch (e) {
      if (e instanceof ApiError && e.detalles.length > 0) {
        // Map Zod field errors back into the modal
        setEditarFieldErrors(e.fieldErrors());
      } else {
        showToast((e as Error).message || 'Error al actualizar', 'error');
      }
    } finally {
      setEditarLoading(false);
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
          <button onClick={() => setLocation('/gestor/alumnos')} className="gov-btn-secondary mt-4">
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

  const inscripcionesCount = convData?.inscripcionesActivas.length ?? 0;
  const modulosDisponiblesCount = convData?.modulosDisponibles.filter((m) => !m.yaInscrito).length ?? 0;

  // Gating de inscripción: 5 documentos obligatorios APROBADOS + matrícula oficial.
  const docsAprobadosOblig = obligatorios.filter((d) => docs[d.tipo]?.estado === 'aprobado').length;
  const expedienteAprobado = docsAprobadosOblig >= obligatorios.length;
  const puedeInscribir = expedienteAprobado && !!alumno.matriculaOficialDGB;

  // convLoading puede ser true solo si el lazy-effect se disparó (fallback).
  // En carga normal, convData ya viene populado junto con el resto de la página.
  const convBadgeLoading = convLoading && convData === null;

  const tabItems: {
    key: ActiveTab;
    label: string;
    icon: React.ReactNode;
    badge: string;
    badgeVariant?: 'default' | 'warn';
  }[] = [
    {
      key: 'docs',
      label: 'Documentos',
      icon: <FolderOpen size={15} />,
      badge: `${docsCount}/${DOCUMENTOS_EXPEDIENTE.length}`,
      badgeVariant: docsCount < 5 ? 'warn' : 'default', // 5 obligatorios
    },
    {
      key: 'plan',
      label: 'Inscripción',
      icon: <CalendarCheck size={15} />,
      badge: convBadgeLoading ? '…' : (modulosDisponiblesCount > 0 ? String(modulosDisponiblesCount) : '—'),
    },
    {
      key: 'convocatoria',
      label: 'Pagos',
      icon: <Receipt size={15} />,
      badge: convBadgeLoading ? '…' : (inscripcionesCount > 0 ? String(inscripcionesCount) : '—'),
    },
    {
      key: 'calificaciones',
      label: 'Calificaciones',
      icon: <GraduationCap size={15} />,
      badge: '—',
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
          {toast.type === 'success'
            ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
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

      {/* ── Cabecera ── */}
      <div className="bg-white border border-stone-200 rounded-xl p-6 mb-4">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-widest text-[var(--color-guinda-700)] font-semibold mb-1">
              Alumno
            </div>
            <h1 className="font-serif text-3xl font-bold text-stone-900 mb-1">
              {alumno.nombreCompleto}
            </h1>
            <div className="font-mono text-sm text-stone-500 mb-3">{alumno.curp}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-8 text-sm">
              <DataRow icon={Mail} label="Correo" value={alumno.email} />
              <DataRow icon={Phone} label="Teléfono" value={alumno.telefono ?? '—'} />
              <DataRow
                icon={Calendar}
                label="Fecha de nacimiento"
                value={
                  alumno.fechaNacimiento
                    ? new Date(alumno.fechaNacimiento).toLocaleDateString('es-MX', {
                        day: 'numeric', month: 'long', year: 'numeric',
                      })
                    : '—'
                }
              />
              <DataRow icon={MapPin} label="Dirección" value={alumno.direccion ?? '—'} />
            </div>
          </div>

          <div className="flex items-start gap-3">
            {inscripcionActiva && (
              <div className="text-right">
                <div className="text-xs uppercase tracking-widest text-stone-500 font-semibold mb-1">
                  Inscripción
                </div>
                <StatusBadge estado={inscripcionActiva.estado} />
                <div className="text-xs text-stone-500 mt-1">{inscripcionActiva.convocatoria}</div>
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
                <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-stone-200 rounded-xl shadow-lg z-20 py-1 overflow-hidden">
                  {/* Editar información */}
                  <button
                    onClick={() => { setMenuOpen(false); setEditarModal(true); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-stone-700 hover:bg-stone-50 text-left"
                  >
                    <Pencil size={14} className="text-[var(--color-guinda-700)] shrink-0" />
                    Editar información del alumno
                  </button>

                  <div className="border-t border-stone-100 my-1" />

                  {/* Reenviar credenciales */}
                  {alumno.passwordTemporal ? (
                    <button
                      onClick={() => { setMenuOpen(false); setReenviarModal(true); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-stone-700 hover:bg-stone-50 text-left"
                    >
                      <Send size={14} className="text-amber-500 shrink-0" />
                      Reenviar credenciales por correo
                    </button>
                  ) : (
                    <div className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-stone-400 cursor-not-allowed">
                      <Send size={14} className="shrink-0" />
                      <span>
                        Reenviar credenciales
                        <div className="text-[10px] leading-tight">El alumno ya inició sesión</div>
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="bg-white border border-stone-200 rounded-xl p-1.5 flex gap-0.5 mb-5">
        {tabItems.map(({ key, label, icon, badge, badgeVariant }) => {
          const active = activeTab === key;
          const isWarn = !active && badgeVariant === 'warn';
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                active
                  ? 'bg-[var(--color-guinda-700)] text-white'
                  : 'text-stone-500 hover:bg-[var(--color-crema-50)] hover:text-stone-900'
              }`}
            >
              {icon}
              {label}
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  active
                    ? 'bg-white/20 text-white'
                    : isWarn
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-[var(--color-crema-100)] text-stone-700'
                }`}
              >
                {badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* ══════════════ TAB: Documentos ══════════════ */}
      {activeTab === 'docs' && (
        <>
          {/* Matrícula oficial DGB */}
          {!alumno.matriculaOficialDGB ? (
            <div className="bg-white border border-stone-200 rounded-xl p-4 mb-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
                <Award size={16} className="text-stone-400" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-stone-800">Matrícula oficial DGB</div>
                <div className="text-xs text-stone-500 mt-0.5">Aún no asignada.</div>
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-stone-500 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2">
                  <Lock size={10} className="shrink-0" />
                  La administración la asigna cuando la Secretaría (SEP-DGB) valida el expediente del alumno.
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 rounded-xl p-4 mb-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                  <Award size={16} className="text-emerald-600" />
                </div>
                <div>
                  <div className="text-sm font-bold text-stone-800">Matrícula oficial DGB</div>
                  <div className="text-xs text-stone-500 mt-0.5">
                    Asignada el {alumno.matriculaCapturadaEn
                      ? new Date(alumno.matriculaCapturadaEn).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
                      : '—'}
                  </div>
                </div>
              </div>
              <div className="bg-white border border-stone-200 rounded-lg px-4 py-3 mb-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">MATRÍCULA</div>
                <div className="font-mono text-xl font-bold text-[var(--color-guinda-700)] tracking-wide">
                  {alumno.matriculaOficialDGB}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <a
                  href={`/api/gestor/alumnos/${id}/ficha-registro`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  <Download size={12} /> Ficha de registro PDF
                </a>
                <a
                  href={`/api/gestor/alumnos/${id}/ficha-preregistro`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-stone-200 text-stone-600 text-xs font-semibold rounded-lg hover:bg-stone-50 transition-colors"
                >
                  <FileText size={12} /> Ficha de pre-registro
                </a>
              </div>
            </div>
          )}

          {/* Licencia digital */}
          {alumno.licenciaDigital && (
            <div className="bg-gradient-to-br from-violet-50 to-white border border-violet-200 rounded-xl p-4 mb-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                  <Award size={16} className="text-violet-600" />
                </div>
                <div>
                  <div className="text-sm font-bold text-stone-800">Licencia digital</div>
                  <div className="text-xs text-stone-500 mt-0.5">
                    Emitida el {alumno.licenciaEmitidaEn
                      ? new Date(alumno.licenciaEmitidaEn).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
                      : '—'}
                  </div>
                </div>
              </div>
              <div className="bg-white border border-stone-200 rounded-lg px-4 py-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">LICENCIA DIGITAL</div>
                <div className="font-mono text-lg font-bold text-violet-700 tracking-wide">
                  {alumno.licenciaDigital}
                </div>
              </div>
            </div>
          )}

          {/* Acceso del alumno — va después de matrícula y licencia */}
          {alumno.passwordTemporal ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                <Send size={16} className="text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-amber-900">Credenciales de acceso pendientes</div>
                <div className="text-xs text-amber-700 mt-0.5">
                  {bienvenidaFecha
                    ? `Enviadas el ${bienvenidaFecha}, pero el alumno aún no ha iniciado sesión.`
                    : 'El alumno aún no ha recibido sus credenciales de acceso.'}
                  {' '}Tanto tú como él pueden subir documentos desde sus respectivos portales.
                </div>
              </div>
              <button
                onClick={() => setReenviarModal(true)}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 transition-colors"
              >
                <Send size={12} />
                {bienvenidaFecha ? 'Reenviar' : 'Enviar acceso'}
              </button>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                <UserCheck size={16} className="text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-emerald-900">El alumno tiene acceso activo</div>
                <div className="text-xs text-emerald-700 mt-0.5">
                  Ya inició sesión y puede subir documentos directamente desde su portal.
                </div>
              </div>
            </div>
          )}

          {/* Documentos */}
          {obligatoriosFaltantes.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 flex items-start gap-2">
              <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-amber-900 mb-0.5">
                  {obligatoriosFaltantes.length} documento{obligatoriosFaltantes.length > 1 ? 's' : ''} obligatorio{obligatoriosFaltantes.length > 1 ? 's' : ''} faltante{obligatoriosFaltantes.length > 1 ? 's' : ''}
                </div>
                <div className="text-xs text-amber-700">
                  {obligatoriosFaltantes.map((d) => d.label).join(', ')}
                </div>
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-5 flex items-start gap-2 text-xs text-blue-900">
            <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
            Tú y el alumno comparten el mismo expediente. Si el alumno trae documentos físicamente, los puedes subir tú; él también puede subirlos desde su portal.
          </div>

          {/* Inscribir exámenes — arriba de los documentos */}
          <button
            onClick={() => setActiveTab('plan')}
            className="w-full mb-5 bg-white border border-stone-200 rounded-xl p-4 flex items-center gap-3 hover:border-[var(--color-guinda-700)] transition-colors group text-left"
          >
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-[var(--color-crema-100)] text-[var(--color-guinda-700)]">
              <CalendarCheck size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-stone-900">Inscribir exámenes</div>
              <div className="text-xs text-stone-500">Inscribe al alumno a los módulos de la convocatoria activa.</div>
            </div>
            <span className="shrink-0 text-xs font-semibold text-[var(--color-guinda-700)] group-hover:underline">Inscribir →</span>
          </button>

          {[
            { title: 'Documentos obligatorios', defs: obligatorios, isRequired: true },
            { title: 'Documentos opcionales', defs: opcionales, isRequired: false },
          ].map(({ title, defs, isRequired }) => (
            <section key={title} className="mb-6">
              <h3 className="text-sm font-semibold text-stone-700 uppercase tracking-widest mb-3">{title}</h3>
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
                        <div className="flex items-center gap-1.5 mt-1.5 pl-2 text-[11px] text-amber-700 font-semibold uppercase tracking-wide">
                          <Clock size={11} className="shrink-0" />
                          En revisión por la administración
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          {/* Cédula de inscripción — como un documento más, descargable */}
          <section className="mb-6">
            <h3 className="text-sm font-semibold text-stone-700 uppercase tracking-widest mb-3">Cédula de inscripción</h3>
            <div className="bg-white border border-stone-200 rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-[var(--color-crema-100)] text-[var(--color-guinda-700)]">
                <ClipboardList size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-stone-900">Cédula de inscripción</div>
                <div className="text-xs text-stone-500">Se genera con los datos del alumno. Descarga la última versión.</div>
              </div>
              <a
                href={`/api/gestor/alumnos/${id}/cedula/pdf`}
                download=""
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 bg-[var(--color-guinda-700)] text-white text-xs font-semibold rounded-lg hover:bg-[var(--color-guinda-800)] transition-colors"
              >
                <Download size={13} /> Descargar
              </a>
            </div>
          </section>
        </>
      )}

      {/* ══════════════ TAB: Plan de estudios ══════════════ */}
      {activeTab === 'plan' && (
        puedeInscribir ? (
          <PlanDeEstudiosTab
            data={convData}
            loading={convLoading}
            seleccion={convSeleccion}
            setSeleccion={setConvSeleccion}
            inscribiendo={convInscribiendo}
            onInscribir={handleInscribir}
          />
        ) : (
          <InscripcionBloqueada
            expedienteAprobado={expedienteAprobado}
            docsAprobados={docsAprobadosOblig}
            totalObligatorios={obligatorios.length}
            tieneMatricula={!!alumno.matriculaOficialDGB}
          />
        )
      )}

      {/* ══════════════ TAB: Convocatoria ══════════════ */}
      {activeTab === 'convocatoria' && (
        <ConvocatoriaTab
          data={convData}
          loading={convLoading}
          curp={alumno.curp}
          alumnoId={id!}
          configPago={configPago}
          pagoFile={pagoFile}
          setPagoFile={setPagoFile}
          pagoFecha={pagoFecha}
          setPagoFecha={setPagoFecha}
          pagoMetodo={pagoMetodo}
          setPagoMetodo={setPagoMetodo}
          pagoSubiendo={pagoSubiendo}
          onSubirPago={handleSubirPago}
        />
      )}

      {/* ══════════════ TAB: Cédula ══════════════ */}
      {activeTab === 'cedula' && id !== null && (
        <CedulaGestorTab alumnoId={id} />
      )}

      {/* ══════════════ TAB: Calificaciones ══════════════ */}
      {activeTab === 'calificaciones' && id !== null && (
        <CalificacionesTabContent estudianteId={id} readOnly={true} />
      )}

      {/* ── Modal: Editar alumno ── */}
      {editarModal && alumno && (
        <EditarAlumnoModal
          alumno={alumno}
          loading={editarLoading}
          serverFieldErrors={editarFieldErrors}
          onClose={() => { setEditarModal(false); setEditarFieldErrors({}); }}
          onSave={handleEditarAlumno}
        />
      )}

      {/* ── Modal: Reenviar credenciales ── */}
      {reenviarModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={() => { if (!reenviarLoading) { setReenviarModal(false); setReenviarResult(null); } }}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200">
              <div className="font-semibold text-stone-900">Reenviar credenciales por correo</div>
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
                    ¿Enviar credenciales de acceso a <strong>{alumno.email}</strong>?
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
                      {reenviarLoading ? 'Enviando…' : 'Enviar'}
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
                        Modo dev — contraseña temporal:
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

    </GestorLayout>
  );
}

// ─────────────────────────────────────────────────────────────────
// Sub-component: Plan de estudios tab
// Uses convocatoria modules displayed in a nivel grid for inscription
// ─────────────────────────────────────────────────────────────────

function PlanDeEstudiosTab({
  data,
  loading,
  seleccion,
  setSeleccion,
  inscribiendo,
  onInscribir,
}: {
  data: GestorConvocatoriaResponse | null;
  loading: boolean;
  seleccion: Set<number>;
  setSeleccion: React.Dispatch<React.SetStateAction<Set<number>>>;
  inscribiendo: boolean;
  onInscribir: () => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-stone-400 gap-2 text-sm">
        <Loader2 size={18} className="animate-spin" />
        Cargando módulos…
      </div>
    );
  }

  if (!data?.etapa) {
    return (
      <div className="border-2 border-dashed border-stone-200 rounded-xl p-12 text-center">
        <CalendarCheck size={36} className="mx-auto text-stone-300 mb-3" />
        <div className="text-sm font-bold text-stone-500">No hay convocatoria activa</div>
        <div className="text-xs text-stone-400 mt-1 max-w-xs mx-auto">
          Cuando se abra una convocatoria, aquí aparecerán los módulos disponibles para inscribir a examen.
        </div>
      </div>
    );
  }

  const { etapa, modulosDisponibles, costoExamen } = data;

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });

  const DIA_LABEL: Record<string, string> = { sabado: 'Sábado', domingo: 'Domingo' };
  const HORA_LABEL: Record<string, string> = { '09:00': '9:00 AM', '11:00': '11:00 AM' };
  // Fecha real de examen por día (variable de la convocatoria activa).
  const fechaDeDia = (dia: string): string | null =>
    dia === 'sabado' ? etapa.examenSabado : dia === 'domingo' ? etapa.examenDomingo : null;
  const fmtDiaCorto = (iso: string) =>
    new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });

  const pendientes = modulosDisponibles.filter((m) => !m.yaInscrito);
  const inscritos = modulosDisponibles.filter((m) => m.yaInscrito);

  function toggle(id: number) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Choque de horario: un slot "dia-hora" no puede repetirse (no se puede
  // presentar 2 exámenes el mismo día y hora). Bloquea la selección en la UI.
  type ModDisp = (typeof modulosDisponibles)[number];
  const slotDe = (m: ModDisp) => `${m.dia}-${m.hora}`;
  const inscritosSlots = new Set(inscritos.map(slotDe));
  function slotOcupado(m: ModDisp): boolean {
    if (seleccion.has(m.id)) return false;
    if (inscritosSlots.has(slotDe(m))) return true;
    return pendientes.some((x) => x.id !== m.id && seleccion.has(x.id) && slotDe(x) === slotDe(m));
  }

  function ModuloPendiente({ m }: { m: ModDisp }) {
    const checked = seleccion.has(m.id);
    const ocupado = slotOcupado(m);
    return (
      <label
        className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition-all select-none ${
          ocupado
            ? 'border-amber-300 bg-amber-50 cursor-not-allowed animate-[choque_0.45s_ease-in-out]'
            : checked
              ? 'border-[var(--color-guinda-700)] bg-[var(--color-guinda-50,#faf0f3)] cursor-pointer ring-1 ring-[var(--color-guinda-700)]'
              : 'border-stone-200 bg-white hover:bg-stone-50 cursor-pointer'
        }`}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={ocupado}
          onChange={() => !ocupado && toggle(m.id)}
          className="w-4 h-4 shrink-0 mt-0.5 accent-[var(--color-guinda-700)]"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={`text-[11px] font-bold ${checked ? 'text-[var(--color-guinda-700)]' : ocupado ? 'text-amber-700' : 'text-stone-400'}`}>
              Módulo {m.numero}
            </span>
            {m.nivel && <span className="text-[9px] font-semibold px-1.5 py-px rounded-full bg-stone-100 text-stone-500">Nivel {m.nivel}</span>}
          </div>
          <div className="text-xs text-stone-700 leading-snug">{m.nombre}</div>
          {ocupado && (
            <div className="flex items-center gap-1 text-[10px] text-amber-700 font-semibold mt-1 animate-pulse">
              <AlertTriangle size={10} className="shrink-0" />
              Ya elegiste otro módulo en este mismo día y hora
            </div>
          )}
        </div>
      </label>
    );
  }

  // Inscritos y disponibles se muestran juntos en cada celda día×hora.
  function ModuloInscrito({ m }: { m: ModDisp }) {
    return (
      <div className="flex items-start gap-2.5 p-2.5 rounded-lg border border-blue-200 bg-blue-50/60 select-none">
        <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-blue-600" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-blue-700">Módulo {m.numero}</span>
            {m.nivel && <span className="text-[9px] font-semibold px-1.5 py-px rounded-full bg-blue-100 text-blue-600">Nivel {m.nivel}</span>}
          </div>
          <div className="text-xs text-stone-600 leading-snug">{m.nombre}</div>
          <div className="text-[10px] text-blue-600 font-bold mt-0.5">✓ Ya inscrito</div>
        </div>
      </div>
    );
  }

  // Slots día×hora presentes en la convocatoria (para armar la tabla).
  const ORDEN_DIA: Record<string, number> = { sabado: 0, domingo: 1 };
  const diasOrd = [...new Set(modulosDisponibles.map((m) => m.dia))].sort((a, b) => (ORDEN_DIA[a] ?? 9) - (ORDEN_DIA[b] ?? 9));
  const horasOrd = [...new Set(modulosDisponibles.map((m) => m.hora))].sort();

  return (
    <div className="space-y-5">
      {/* Convocatoria activa — card principal (guinda) */}
      <div className="bg-[var(--color-guinda-700)] rounded-xl p-5 text-white">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/70 font-bold mb-2">
          <CalendarCheck size={13} />
          Convocatoria activa
        </div>
        <h2 className="font-serif text-xl font-bold text-white mb-4">
          {etapa.etapa} — Fase {etapa.fase}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="flex items-start gap-2">
            <Calendar size={14} className="text-white/60 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-white/60">Período de inscripción</div>
              <div className="text-white">{fmtDate(etapa.solicitudInicio)} — {fmtDate(etapa.solicitudFin)}</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Clock size={14} className="text-white/60 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-white/60">Fechas de examen</div>
              <div className="text-white">
                Sáb {fmtDate(etapa.examenSabado)} · Dom {fmtDate(etapa.examenDomingo)}
              </div>
            </div>
          </div>
          {data.sede && (
            <div className="flex items-start gap-2 sm:col-span-2">
              <MapPin size={14} className="text-white/60 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-white/60">Sede de examen</div>
                <div className="text-white">{data.sede.nombre}</div>
                <div className="text-xs text-white/70">{data.sede.direccion}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {modulosDisponibles.length === 0 ? (
        <div className="text-center py-10 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-xl">
          No hay módulos disponibles para inscribir en esta convocatoria.
        </div>
      ) : (
        <>
          {/* Horario de exámenes — tabla por día y hora */}
          <div>
            <div className="flex items-baseline justify-between mb-3 flex-wrap gap-1">
              <h3 className="text-xs font-bold uppercase tracking-widest text-stone-500">
                Horario de exámenes · elige por día y hora
              </h3>
              <span className="text-[11px] text-stone-400">
                Los módulos en un mismo bloque comparten día y hora — solo puedes inscribir uno de cada bloque.
              </span>
            </div>
            <div className="overflow-x-auto -mx-1 px-1 pb-1">
              <div
                className="grid gap-2 min-w-[560px]"
                style={{ gridTemplateColumns: `64px repeat(${diasOrd.length}, minmax(0,1fr))` }}
              >
                {/* Encabezado: días */}
                <div />
                {diasOrd.map((d) => {
                  const fecha = fechaDeDia(d);
                  return (
                    <div key={`h-${d}`} className="text-center pb-1.5 border-b-2 border-[var(--color-guinda-200,#e8c4d4)]">
                      <div className="text-xs font-bold uppercase tracking-wide text-[var(--color-guinda-700)]">{DIA_LABEL[d] ?? d}</div>
                      {fecha && <div className="text-[10px] font-medium text-stone-400 normal-case mt-0.5">{fmtDiaCorto(fecha)}</div>}
                    </div>
                  );
                })}
                {/* Filas: una por hora */}
                {horasOrd.map((h) => (
                  <Fragment key={`row-${h}`}>
                    <div className="flex items-center justify-end pr-1.5 text-[11px] font-bold text-stone-500">
                      <Clock size={11} className="mr-1 text-stone-400 shrink-0" />{HORA_LABEL[h] ?? h}
                    </div>
                    {diasOrd.map((d) => {
                      const slotMods = modulosDisponibles.filter((m) => m.dia === d && m.hora === h);
                      const selectables = slotMods.filter((m) => !m.yaInscrito);
                      return (
                        <div key={`c-${d}-${h}`} className="rounded-xl border border-stone-100 bg-stone-50/40 p-1.5 space-y-1.5">
                          {slotMods.length === 0 ? (
                            <div className="flex items-center justify-center text-[11px] text-stone-300 py-4">—</div>
                          ) : (
                            <>
                              {slotMods.map((m) => m.yaInscrito
                                ? <ModuloInscrito key={m.id} m={m} />
                                : <ModuloPendiente key={m.id} m={m} />)}
                              {selectables.length > 1 && (
                                <div className="flex items-center justify-center gap-1 text-[9px] text-amber-600 font-bold uppercase tracking-wide">
                                  <AlertTriangle size={9} /> Empalmados · solo uno
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            </div>
          </div>

          {/* Footer: count + inscribe button */}
          <div className="flex items-center justify-between pt-4 border-t border-stone-200">
            <div className="text-sm text-stone-500">
              <span className="font-bold text-stone-900">{seleccion.size}</span>{' '}
              módulo{seleccion.size !== 1 ? 's' : ''} seleccionado{seleccion.size !== 1 ? 's' : ''}
              {seleccion.size > 0 && (
                <span className="ml-2 text-stone-400 text-xs">
                  — ${(seleccion.size * costoExamen).toLocaleString('es-MX')} MXN
                </span>
              )}
            </div>
            <button
              onClick={onInscribir}
              disabled={seleccion.size === 0 || inscribiendo}
              className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-guinda-700)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--color-guinda-800)] disabled:opacity-50 transition-colors"
            >
              {inscribiendo ? <Loader2 size={14} className="animate-spin" /> : <CalendarCheck size={14} />}
              Inscribir seleccionados
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Sub-component: Inscripción tab
// Shows active inscriptions + step-by-step payment ficha
// ─────────────────────────────────────────────────────────────────

function ConvocatoriaTab({
  data,
  loading,
  curp,
  alumnoId,
  configPago,
  pagoFile,
  setPagoFile,
  pagoFecha,
  setPagoFecha,
  pagoMetodo,
  setPagoMetodo,
  pagoSubiendo,
  onSubirPago,
}: {
  data: GestorConvocatoriaResponse | null;
  loading: boolean;
  curp: string;
  alumnoId: number;
  configPago: GestorConfigPagoResponse | null;
  pagoFile: File | null;
  setPagoFile: (f: File | null) => void;
  pagoFecha: string;
  setPagoFecha: (v: string) => void;
  pagoMetodo: string;
  setPagoMetodo: (v: string) => void;
  pagoSubiendo: boolean;
  onSubirPago: () => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-stone-400 gap-2 text-sm">
        <Loader2 size={18} className="animate-spin" />
        Cargando…
      </div>
    );
  }

  if (!data?.inscripcionesActivas.length) {
    return (
      <div className="border-2 border-dashed border-stone-200 rounded-xl p-12 text-center">
        <Receipt size={36} className="mx-auto text-stone-300 mb-3" />
        <div className="text-sm font-bold text-stone-500">Sin inscripciones activas</div>
        <div className="text-xs text-stone-400 mt-2 max-w-xs mx-auto">
          Ve a la pestaña <strong>Convocatoria</strong> para seleccionar e inscribir módulos.
        </div>
      </div>
    );
  }

  const { inscripcionesActivas, costoExamen, etapa } = data;
  const db = configPago?.datosBancarios ?? null;

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });

  const DIA_LABEL: Record<string, string> = { sabado: 'Sábado', domingo: 'Domingo' };
  const HORA_LABEL: Record<string, string> = { '09:00': '9:00 AM', '11:00': '11:00 AM' };
  const total = inscripcionesActivas.length * costoExamen;

  const estadoBadge = (estado: string) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      inscrito:      { bg: 'bg-blue-100',  text: 'text-blue-800',  label: 'Inscrito' },
      pase_validado: { bg: 'bg-green-100', text: 'text-green-800', label: 'Pase validado' },
      cancelado:     { bg: 'bg-red-100',   text: 'text-red-800',   label: 'Cancelado' },
    };
    const s = map[estado] ?? { bg: 'bg-stone-100', text: 'text-stone-700', label: estado };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${s.bg} ${s.text}`}>
        {s.label}
      </span>
    );
  };

  function copyText(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  const metodoPicker = [
    { value: 'spei',               icon: <Banknote size={18} />,  label: 'SPEI / Transferencia' },
    { value: 'banco_deposito',     icon: <Building2 size={18} />, label: 'Depósito bancario' },
    { value: 'tienda_conveniencia',icon: <Store size={18} />,     label: 'Tienda de conveniencia' },
  ];

  const showPaymentForm = !data.pagoDerechos || data.pagoDerechos.estado === 'rechazado';

  return (
    <div className="space-y-5">

      {/* ── Inscripciones activas ── */}
      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-stone-900">Inscripciones activas</h3>
          <span className="text-xs font-semibold text-stone-500">
            {inscripcionesActivas.length} examen{inscripcionesActivas.length !== 1 ? 'es' : ''}
          </span>
        </div>

        <div className="divide-y divide-stone-100">
          {inscripcionesActivas.map((insc) => (
            <div key={insc.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <code className="font-mono text-xs font-bold text-[var(--color-guinda-700)] bg-stone-100 px-1.5 py-0.5 rounded">
                      {insc.folio}
                    </code>
                    {estadoBadge(insc.estado)}
                    {insc.pagoEstado === 'pagado' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 uppercase tracking-wide" title={insc.pagoFolio ?? undefined}>
                        <Lock size={10} /> Pagado
                      </span>
                    ) : insc.pagoEstado === 'en_pago' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 uppercase tracking-wide" title={insc.pagoFolio ?? undefined}>
                        <Clock size={10} /> En pago
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 uppercase tracking-wide">
                        Sin pagar
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-stone-800">
                    Módulo {insc.moduloNumero} — {insc.moduloNombre}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-stone-500">
                    <span className="flex items-center gap-1"><Clock size={11} />{DIA_LABEL[insc.dia] ?? insc.dia} · {HORA_LABEL[insc.hora] ?? insc.hora}</span>
                    <span className="flex items-center gap-1"><Calendar size={11} />{fmtDate(insc.fechaExamen)}</span>
                    <span className="flex items-center gap-1"><MapPin size={11} />{insc.sede.nombre}</span>
                  </div>
                </div>
                <div className="text-sm font-bold text-stone-700 shrink-0">
                  ${costoExamen.toLocaleString('es-MX')} MXN
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 bg-stone-50 border-t border-stone-200 flex items-center justify-between">
          <div className="text-sm text-stone-600">
            {inscripcionesActivas.length} examen{inscripcionesActivas.length !== 1 ? 'es' : ''} × ${costoExamen} MXN
          </div>
          <div className="text-base font-bold text-stone-900">
            Total: ${total.toLocaleString('es-MX')} MXN
          </div>
        </div>
      </div>

      {/* El pago del derecho de examen vive en la sección Pagos (órdenes de
          pago vía Tesorería del Estado). Aquí ya no se muestra estado de pago. */}
    </div>
  );
}

// Helper: fila de datos de la ficha de pago
function FichaRow({
  label, value, copy: canCopy, onCopy, highlight,
}: {
  label: string;
  value: string;
  copy?: boolean;
  onCopy?: () => void;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-stone-500 shrink-0 w-36">{label}</span>
      <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
        <span className={`text-sm font-mono font-bold truncate ${highlight ? 'text-[var(--color-guinda-700)]' : 'text-stone-800'}`}>
          {value}
        </span>
        {canCopy && onCopy && (
          <button
            onClick={onCopy}
            className="p-1 rounded hover:bg-stone-200 text-stone-400 hover:text-stone-700 transition-colors shrink-0"
            title="Copiar"
          >
            <Copy size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Modal: Editar información del alumno
// ─────────────────────────────────────────────────────────────────
function EditarAlumnoModal({
  alumno,
  loading,
  serverFieldErrors,
  onClose,
  onSave,
}: {
  alumno: AlumnoConMatricula;
  loading: boolean;
  serverFieldErrors: Record<string, string>;
  onClose: () => void;
  onSave: (fields: {
    nombreCompleto: string;
    telefono: string;
    direccion: string;
    fechaNacimiento: string;
    curp: string;
  }) => void;
}) {
  const [nombre, setNombre] = useState(alumno.nombreCompleto ?? '');
  const [telefono, setTelefono] = useState(alumno.telefono ?? '');
  const [direccion, setDireccion] = useState(alumno.direccion ?? '');
  const [fechaNacimiento, setFechaNacimiento] = useState(alumno.fechaNacimiento ?? '');
  const [curp, setCurp] = useState(alumno.curp ?? '');

  // Client-side field errors — merged with server errors
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  // Merge: client errors take precedence over server errors while user is editing
  const errors: Record<string, string> = { ...serverFieldErrors, ...clientErrors };

  function clearError(field: string) {
    setClientErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};

    if (!nombre.trim() || nombre.trim().length < 2) {
      errs.nombreCompleto = 'El nombre debe tener al menos 2 caracteres.';
    }
    if (curp.trim() && curp.trim().length !== 18) {
      errs.curp = `La CURP debe tener exactamente 18 caracteres (actualmente tiene ${curp.trim().length}).`;
    }
    if (telefono.trim() && !/^\d{7,15}$/.test(telefono.trim())) {
      errs.telefono = 'Ingresa solo dígitos (entre 7 y 15).';
    }

    setClientErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSave({ nombreCompleto: nombre, telefono, direccion, fechaNacimiento, curp });
  }

  const inputCls = (field: string) =>
    `w-full border rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:border-transparent ${
      errors[field]
        ? 'border-red-400 focus:ring-red-400 bg-red-50'
        : 'border-stone-300 focus:ring-[var(--color-guinda-700)]'
    }`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={() => { if (!loading) onClose(); }}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200">
          <div className="flex items-center gap-2">
            <Pencil size={15} className="text-[var(--color-guinda-700)]" />
            <span className="font-semibold text-stone-900">Editar información del alumno</span>
          </div>
          {!loading && (
            <button onClick={onClose} className="p-1 rounded hover:bg-stone-100 text-stone-400 hover:text-stone-700">
              <X size={18} />
            </button>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Nombre */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1">
              Nombre completo <span className="text-red-500">*</span>
            </label>
            <input
              value={nombre}
              onChange={(e) => { setNombre(e.target.value); clearError('nombreCompleto'); }}
              maxLength={200}
              placeholder="Nombre completo del alumno"
              className={inputCls('nombreCompleto')}
            />
            {errors.nombreCompleto && (
              <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                <AlertCircle size={11} className="shrink-0" />
                {errors.nombreCompleto}
              </p>
            )}
          </div>

          {/* CURP */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1">
              CURP
              <span className="ml-1.5 text-[10px] font-normal text-stone-400 normal-case tracking-normal">
                ({curp.trim().length}/18 caracteres)
              </span>
            </label>
            <input
              value={curp}
              onChange={(e) => { setCurp(e.target.value.toUpperCase()); clearError('curp'); }}
              maxLength={18}
              placeholder="18 caracteres"
              className={`${inputCls('curp')} font-mono`}
            />
            {errors.curp && (
              <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                <AlertCircle size={11} className="shrink-0" />
                {errors.curp}
              </p>
            )}
          </div>

          {/* Fecha de nacimiento + Teléfono */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1">
                Fecha de nacimiento
              </label>
              <input
                type="date"
                value={fechaNacimiento}
                onChange={(e) => { setFechaNacimiento(e.target.value); clearError('fechaNacimiento'); }}
                className={inputCls('fechaNacimiento')}
              />
              {errors.fechaNacimiento && (
                <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle size={11} className="shrink-0" />
                  {errors.fechaNacimiento}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1">
                Teléfono
              </label>
              <input
                value={telefono}
                onChange={(e) => { setTelefono(e.target.value); clearError('telefono'); }}
                maxLength={15}
                placeholder="10 dígitos"
                className={inputCls('telefono')}
              />
              {errors.telefono && (
                <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle size={11} className="shrink-0" />
                  {errors.telefono}
                </p>
              )}
            </div>
          </div>

          {/* Dirección */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1">
              Dirección
            </label>
            <textarea
              value={direccion}
              onChange={(e) => { setDireccion(e.target.value); clearError('direccion'); }}
              maxLength={500}
              rows={2}
              placeholder="Calle, número, colonia, municipio…"
              className={`${inputCls('direccion')} resize-none`}
            />
            {errors.direccion && (
              <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                <AlertCircle size={11} className="shrink-0" />
                {errors.direccion}
              </p>
            )}
          </div>

          {/* Email — read-only info */}
          <div className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-2.5 flex items-center gap-2 text-xs text-stone-500">
            <Mail size={13} className="shrink-0 text-stone-400" />
            <span>
              Correo: <strong className="text-stone-700">{alumno.email}</strong> — no se puede cambiar desde aquí.
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm text-stone-600 border border-stone-300 rounded-lg hover:bg-stone-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !nombre.trim()}
              className="px-5 py-2 text-sm font-semibold bg-[var(--color-guinda-700)] text-white rounded-lg hover:bg-[var(--color-guinda-800)] disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Pencil size={13} />}
              {loading ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
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

// ─── Cédula (gestor) ──────────────────────────────────────────────────────
const CEDULA_EDITABLES: (keyof CedulaDatosEditable)[] = [
  'apellidoPaterno', 'apellidoMaterno', 'nombres', 'sexo', 'estadoCivil',
  'lugarNacimiento', 'entidadNacimiento', 'calleNumero', 'colonia', 'cp',
  'ciudad', 'estado', 'ultimoEstudio',
];
const CEDULA_LABELS: Record<keyof CedulaDatosEditable, string> = {
  apellidoPaterno: 'Apellido paterno', apellidoMaterno: 'Apellido materno',
  nombres: 'Nombre(s)', sexo: 'Sexo', estadoCivil: 'Estado civil',
  lugarNacimiento: 'Lugar de nacimiento', entidadNacimiento: 'Entidad donde nació',
  calleNumero: 'Calle y número', colonia: 'Colonia', cp: 'Código postal',
  ciudad: 'Ciudad', estado: 'Estado', ultimoEstudio: 'Último estudio realizado',
  observaciones: 'Observaciones',
};

function CedulaGestorTab({ alumnoId }: { alumnoId: number }) {
  const [datos, setDatos] = useState<CedulaDatos | null>(null);
  const [form, setForm] = useState<CedulaDatosEditable | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);

  function cargar() {
    return api
      .get<CedulaDatos>(`/gestor/alumnos/${alumnoId}/cedula`)
      .then((d) => {
        setDatos(d);
        setForm({
          apellidoPaterno: d.apellidoPaterno, apellidoMaterno: d.apellidoMaterno,
          nombres: d.nombres, sexo: d.sexo, estadoCivil: d.estadoCivil,
          lugarNacimiento: d.lugarNacimiento, entidadNacimiento: d.entidadNacimiento,
          calleNumero: d.calleNumero, colonia: d.colonia, cp: d.cp,
          ciudad: d.ciudad, estado: d.estado, ultimoEstudio: d.ultimoEstudio,
          observaciones: d.observaciones,
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error al cargar'));
  }

  useEffect(() => {
    cargar().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alumnoId]);

  async function guardar() {
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/gestor/alumnos/${alumnoId}/cedula`, form);
      await cargar();
      setPreviewKey((k) => k + 1);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    'w-full border border-stone-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-guinda-700)] focus:border-transparent';

  if (loading) return <div className="text-center text-stone-400 py-12 text-sm">Cargando cédula…</div>;
  if (!datos || !form) return <div className="text-center text-stone-400 py-12 text-sm">Sin datos.</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-5">
        {!editing ? (
          /* ── Modo lectura (cerrado) con copiar ── */
          <div className="bg-white border border-stone-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-serif text-base font-bold text-stone-900 flex items-center gap-2">
                <Lock size={15} className="text-stone-400" /> Datos de la cédula
              </h3>
              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--color-guinda-700)] text-white hover:bg-[var(--color-guinda-800)] transition-colors"
              >
                <Pencil size={13} /> Editar cédula
              </button>
            </div>
            <p className="text-xs text-stone-400 mb-2">Toca <Copy size={11} className="inline -mt-0.5" /> para copiar un dato.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              <CampoCopiable label="Matrícula" value={datos.matricula} />
              <CampoCopiable label="CURP" value={datos.curp} />
              <CampoCopiable label="Nombre(s)" value={datos.nombres} />
              <CampoCopiable label="Apellido paterno" value={datos.apellidoPaterno} />
              <CampoCopiable label="Apellido materno" value={datos.apellidoMaterno} />
              <CampoCopiable label="Fecha de nacimiento" value={datos.fechaNacimiento} />
              <CampoCopiable label="Sexo" value={datos.sexo} />
              <CampoCopiable label="Estado civil" value={datos.estadoCivil} />
              <CampoCopiable label="Lugar de nacimiento" value={datos.lugarNacimiento} />
              <CampoCopiable label="Entidad de nacimiento" value={datos.entidadNacimiento} />
              <CampoCopiable label="Teléfono" value={datos.telefono} />
              <CampoCopiable label="Correo" value={datos.correo} />
              <CampoCopiable label="Calle y número" value={datos.calleNumero} />
              <CampoCopiable label="Colonia" value={datos.colonia} />
              <CampoCopiable label="Código postal" value={datos.cp} />
              <CampoCopiable label="Ciudad" value={datos.ciudad} />
              <CampoCopiable label="Estado" value={datos.estado} />
              <CampoCopiable label="Último estudio" value={datos.ultimoEstudio} />
              <CampoCopiable label="Responsable" value={datos.responsableNombre} />
              <CampoCopiable label="Observaciones" value={datos.observaciones} />
            </div>
          </div>
        ) : (
          /* ── Modo edición ── */
          <div className="bg-white border border-stone-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-serif text-base font-bold text-stone-900">Editar cédula</h3>
              <button
                onClick={() => { setEditing(false); setError(null); cargar(); }}
                className="text-xs text-stone-500 hover:text-stone-700 font-semibold"
              >
                Cancelar
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CEDULA_EDITABLES.map((k) => (
                <div key={k} className={k === 'calleNumero' ? 'sm:col-span-2' : ''}>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">{CEDULA_LABELS[k]}</label>
                  {k === 'sexo' ? (
                    <select className={inputCls} value={form.sexo} onChange={(e) => setForm({ ...form, sexo: e.target.value })}>
                      <option value="">Selecciona…</option>
                      <option value="Hombre">Hombre</option>
                      <option value="Mujer">Mujer</option>
                    </select>
                  ) : k === 'estadoCivil' ? (
                    <select className={inputCls} value={form.estadoCivil} onChange={(e) => setForm({ ...form, estadoCivil: e.target.value })}>
                      <option value="">Selecciona…</option>
                      <option value="Soltero(a)">Soltero(a)</option>
                      <option value="Casado(a)">Casado(a)</option>
                      <option value="Unión libre">Unión libre</option>
                      <option value="Divorciado(a)">Divorciado(a)</option>
                      <option value="Viudo(a)">Viudo(a)</option>
                    </select>
                  ) : (
                    <input className={inputCls} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3">
              <label className="block text-xs font-semibold text-stone-500 mb-1">Observaciones (opcional)</label>
              <textarea
                className={inputCls}
                rows={2}
                value={form.observaciones}
                onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                placeholder="Notas o comentarios adicionales para la cédula…"
              />
            </div>
            {error && (
              <div className="mt-3 text-xs text-red-600 bg-red-50 rounded p-2 flex items-center gap-1.5">
                <AlertCircle size={13} /> {error}
              </div>
            )}
            <button
              onClick={guardar}
              disabled={saving}
              className="mt-4 w-full flex items-center justify-center gap-2 py-3 bg-[var(--color-guinda-700)] text-white text-sm font-semibold rounded-xl hover:bg-[var(--color-guinda-800)] disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              Guardar y actualizar cédula
            </button>
          </div>
        )}

        <div className="bg-white border border-stone-200 rounded-xl p-5">
          <h3 className="font-serif text-base font-bold text-stone-900 mb-1 flex items-center gap-2">
            <FileSignature size={16} /> Tu firma (responsable de la inscripción)
          </h3>
          <p className="text-xs text-stone-500 mb-3">
            Fírmala una vez; se reutilizará como firma del responsable en las cédulas de tus alumnos.
          </p>
          <FirmaPad onChange={() => setPreviewKey((k) => k + 1)} />
        </div>

        {!datos.tieneFoto && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            El alumno aún no tiene fotografía en el expediente; la cédula se generará sin foto.
          </div>
        )}
      </div>

      <div className="lg:sticky lg:top-[114px] self-start space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-base font-bold text-stone-900">Vista previa</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setPreviewKey((k) => k + 1)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors"
            >
              <RefreshCw size={13} /> Actualizar
            </button>
            <a
              href={`/api/gestor/alumnos/${alumnoId}/cedula/pdf`}
              download={`${datos.apellidoPaterno || 'ALUMNO'} | ${datos.matricula || 'NA'} | CÉDULA DE INSCRIPCIÓN.pdf`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--color-guinda-700)] text-white hover:bg-[var(--color-guinda-800)] transition-colors"
            >
              <Download size={13} /> Descargar PDF
            </a>
          </div>
        </div>
        <iframe
          key={previewKey}
          title="Vista previa de la cédula"
          src={`/api/gestor/alumnos/${alumnoId}/cedula/pdf?v=${previewKey}`}
          className="w-full border border-stone-200 rounded-xl bg-stone-100"
          style={{ height: 720 }}
        />
      </div>
    </div>
  );
}

// ─── Inscripción bloqueada (requisitos incompletos) ───────────────────────
function InscripcionBloqueada({
  expedienteAprobado, docsAprobados, totalObligatorios, tieneMatricula,
}: {
  expedienteAprobado: boolean;
  docsAprobados: number;
  totalObligatorios: number;
  tieneMatricula: boolean;
}) {
  const Req = ({ ok, label }: { ok: boolean; label: string }) => (
    <div className="flex items-center gap-2.5">
      <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${ok ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
        {ok ? <CheckCircle2 size={14} /> : <Clock size={14} />}
      </span>
      <span className={`text-sm ${ok ? 'text-stone-700' : 'text-stone-500'}`}>{label}</span>
    </div>
  );
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-6 max-w-xl mx-auto text-center">
      <div className="w-12 h-12 rounded-full bg-[var(--color-crema-100)] text-[var(--color-guinda-700)] flex items-center justify-center mx-auto mb-3">
        <Lock size={22} />
      </div>
      <h3 className="font-serif text-lg font-bold text-stone-900 mb-1">Inscripción no disponible aún</h3>
      <p className="text-sm text-stone-500 mb-5">
        Para inscribirse a los módulos de la convocatoria, el expediente debe estar completo y aprobado, y la matrícula oficial registrada.
      </p>
      <div className="space-y-2.5 text-left max-w-xs mx-auto mb-5">
        <Req ok={expedienteAprobado} label={`Expediente aprobado (${docsAprobados}/${totalObligatorios} documentos)`} />
        <Req ok={tieneMatricula} label="Matrícula oficial DGB registrada" />
      </div>
      <div className="text-xs text-stone-500 bg-stone-50 border border-stone-200 rounded-lg px-4 py-3">
        La matrícula la asigna la administración cuando la <strong>Secretaría (SEP-DGB)</strong> valida el expediente.
        Para conocer el estatus de esta cuenta, contacta a la administración.
      </div>
    </div>
  );
}
