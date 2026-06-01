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
  BookOpen,
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
} from 'lucide-react';
import { GestorLayout } from './GestorLayout';
import {
  api,
  type AlumnoDetalle as AlumnoDetalleType,
  type GestorExpedienteResponse,
  type TipoDocumento,
  type GestorConvocatoriaResponse,
  type GestorConvocatoriaPago,
  type GestorConfigPagoResponse,
} from '../../lib/api';
import { StatusBadge } from '../../components/StatusBadge';
import DocumentoUploader from '../../components/DocumentoUploader';
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

const NIVEL_LABELS: Record<number, string> = {
  1: 'Comunicación y bases',
  2: 'Pensamiento matemático y textos',
  3: 'Métodos y contextos',
  4: 'Especialidades',
};


type ActiveTab = 'docs' | 'plan' | 'convocatoria' | 'calificaciones';

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
      showToast((e as Error).message || 'Error al actualizar', 'error');
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
      badge: `${docsCount}/6`,
      badgeVariant: docsCount < 4 ? 'warn' : 'default', // 4 obligatorios
    },
    {
      key: 'plan',
      label: 'Convocatoria',
      icon: <CalendarCheck size={15} />,
      badge: convBadgeLoading ? '…' : (modulosDisponiblesCount > 0 ? String(modulosDisponiblesCount) : '—'),
    },
    {
      key: 'convocatoria',
      label: 'Inscripción',
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
                <div className="text-xs text-stone-500 mt-0.5">Pendiente de asignación por la administración.</div>
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-stone-500 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2">
                  <Lock size={10} className="shrink-0" />
                  Se asigna una vez que el expediente completo sea validado.
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

      {/* ══════════════ TAB: Plan de estudios ══════════════ */}
      {activeTab === 'plan' && (
        <PlanDeEstudiosTab
          data={convData}
          loading={convLoading}
          seleccion={convSeleccion}
          setSeleccion={setConvSeleccion}
          inscribiendo={convInscribiendo}
          onInscribir={handleInscribir}
        />
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

      {/* ══════════════ TAB: Calificaciones ══════════════ */}
      {activeTab === 'calificaciones' && id !== null && (
        <CalificacionesTabContent estudianteId={id} readOnly={true} />
      )}

      {/* ── Modal: Editar alumno ── */}
      {editarModal && alumno && (
        <EditarAlumnoModal
          alumno={alumno}
          loading={editarLoading}
          onClose={() => setEditarModal(false)}
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

      {/* ── Modal: aprobar documento ── */}
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

      {/* ── Modal: rechazar documento ── */}
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

  const niveles = [1, 2, 3, 4];

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
          {/* Modules by nivel */}
          {niveles.map((nivel) => {
            const pend = pendientes.filter((m) => m.nivel === nivel);
            const insc = inscritos.filter((m) => m.nivel === nivel);
            if (pend.length === 0 && insc.length === 0) return null;
            return (
              <section key={nivel}>
                <h3 className="text-xs font-bold uppercase tracking-widest text-stone-500 mb-3">
                  Nivel {nivel} — {NIVEL_LABELS[nivel]}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {insc.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-stone-200 bg-stone-50 select-none"
                    >
                      <input type="checkbox" checked disabled className="w-4 h-4 shrink-0 accent-[var(--color-guinda-700)]" />
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-bold text-stone-400">Módulo {m.numero}</div>
                        <div className="text-xs text-stone-600 leading-snug truncate">{m.nombre}</div>
                        <div className="text-[10px] text-stone-400 mt-0.5">
                          {DIA_LABEL[m.dia] ?? m.dia} · {HORA_LABEL[m.hora] ?? m.hora}
                        </div>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold shrink-0">
                        ✓ Inscrito
                      </span>
                    </div>
                  ))}
                  {pend.map((m) => {
                    const checked = seleccion.has(m.id);
                    return (
                      <label
                        key={m.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors select-none ${
                          checked
                            ? 'border-[var(--color-guinda-700)] bg-[var(--color-guinda-50,#faf0f3)]'
                            : 'border-stone-200 bg-white hover:bg-stone-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(m.id)}
                          className="w-4 h-4 shrink-0 accent-[var(--color-guinda-700)]"
                        />
                        <div className="min-w-0 flex-1">
                          <div className={`text-[11px] font-bold ${checked ? 'text-[var(--color-guinda-700)]' : 'text-stone-400'}`}>
                            Módulo {m.numero}
                          </div>
                          <div className="text-xs text-stone-700 leading-snug truncate">{m.nombre}</div>
                          <div className="text-[10px] text-stone-400 mt-0.5">
                            {DIA_LABEL[m.dia] ?? m.dia} · {HORA_LABEL[m.hora] ?? m.hora}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {/* Modules without nivel */}
          {(() => {
            const pend = pendientes.filter((m) => !m.nivel);
            const insc = inscritos.filter((m) => !m.nivel);
            if (pend.length === 0 && insc.length === 0) return null;
            return (
              <section>
                <h3 className="text-xs font-bold uppercase tracking-widest text-stone-500 mb-3">Otros módulos</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {insc.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border border-stone-200 bg-stone-50 select-none">
                      <input type="checkbox" checked disabled className="w-4 h-4 shrink-0 accent-[var(--color-guinda-700)]" />
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-bold text-stone-400">Módulo {m.numero}</div>
                        <div className="text-xs text-stone-600 leading-snug truncate">{m.nombre}</div>
                        <div className="text-[10px] text-stone-400 mt-0.5">{DIA_LABEL[m.dia] ?? m.dia} · {HORA_LABEL[m.hora] ?? m.hora}</div>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold shrink-0">✓ Inscrito</span>
                    </div>
                  ))}
                  {pend.map((m) => {
                    const checked = seleccion.has(m.id);
                    return (
                      <label
                        key={m.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors select-none ${checked ? 'border-[var(--color-guinda-700)] bg-[var(--color-guinda-50,#faf0f3)]' : 'border-stone-200 bg-white hover:bg-stone-50'}`}
                      >
                        <input type="checkbox" checked={checked} onChange={() => toggle(m.id)} className="w-4 h-4 shrink-0 accent-[var(--color-guinda-700)]" />
                        <div className="min-w-0 flex-1">
                          <div className={`text-[11px] font-bold ${checked ? 'text-[var(--color-guinda-700)]' : 'text-stone-400'}`}>Módulo {m.numero}</div>
                          <div className="text-xs text-stone-700 leading-snug truncate">{m.nombre}</div>
                          <div className="text-[10px] text-stone-400 mt-0.5">{DIA_LABEL[m.dia] ?? m.dia} · {HORA_LABEL[m.hora] ?? m.hora}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </section>
            );
          })()}

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

      {/* ── Pago de derechos ── */}
      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-2">
          <Receipt size={15} className="text-[var(--color-guinda-700)]" />
          <h3 className="text-sm font-bold text-stone-900">Pago de derechos de examen</h3>
        </div>

        <div className="p-5 space-y-6">

          {/* Status si ya hay pago */}
          {data.pagoDerechos && (
            <div className={`rounded-xl border p-4 flex items-start gap-3 ${
              data.pagoDerechos.estado === 'verificado'   ? 'bg-green-50 border-green-200' :
              data.pagoDerechos.estado === 'rechazado'    ? 'bg-red-50 border-red-200'     :
                                                            'bg-amber-50 border-amber-200'
            }`}>
              {data.pagoDerechos.estado === 'verificado'  ? <CheckCircle2 size={18} className="text-green-600 shrink-0 mt-0.5" /> :
               data.pagoDerechos.estado === 'rechazado'   ? <AlertCircle  size={18} className="text-red-600 shrink-0 mt-0.5" />   :
                                                            <Clock        size={18} className="text-amber-500 shrink-0 mt-0.5" />}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-stone-800">
                  {data.pagoDerechos.estado === 'verificado' ? 'Pago verificado ✓' :
                   data.pagoDerechos.estado === 'rechazado'  ? 'Comprobante rechazado' :
                                                               'Comprobante enviado — en revisión'}
                </div>
                <div className="text-xs text-stone-500 mt-0.5">
                  ${Number(data.pagoDerechos.monto).toLocaleString('es-MX')} MXN · {fmtDate(data.pagoDerechos.fechaPago)}
                </div>
                {data.pagoDerechos.estado === 'rechazado' && (
                  <p className="text-xs text-red-700 mt-1.5">
                    El administrador rechazó este comprobante. Sube uno nuevo para confirmar.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Flujo de pago paso a paso */}
          {showPaymentForm && (
            <>
              {/* PASO 1 — método */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-full bg-[var(--color-guinda-700)] text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
                  <span className="text-sm font-bold text-stone-800">Selecciona cómo vas a pagar</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {metodoPicker.map((m) => {
                    const active = pagoMetodo === m.value;
                    return (
                      <button
                        key={m.value}
                        onClick={() => setPagoMetodo(m.value)}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-center ${
                          active
                            ? 'border-[var(--color-guinda-700)] bg-[var(--color-guinda-50,#faf0f3)] text-[var(--color-guinda-700)]'
                            : 'border-stone-200 bg-white text-stone-500 hover:border-stone-300 hover:bg-stone-50'
                        }`}
                      >
                        <span className={active ? 'text-[var(--color-guinda-700)]' : 'text-stone-400'}>
                          {m.icon}
                        </span>
                        <span className="text-[11px] font-semibold leading-tight">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* PASO 2 — ficha de pago */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-full bg-[var(--color-guinda-700)] text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
                  <span className="text-sm font-bold text-stone-800">Realiza el pago con estos datos</span>
                </div>

                {pagoMetodo === 'spei' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 bg-blue-600 flex items-center gap-2">
                      <Banknote size={14} className="text-white" />
                      <span className="text-xs font-bold text-white uppercase tracking-widest">SPEI / Transferencia bancaria</span>
                    </div>
                    <div className="p-4 space-y-2.5">
                      <FichaRow label="CLABE interbancaria" value={db?.clabe ?? '— no configurado —'} copy={!!db?.clabe} onCopy={() => copyText(db!.clabe)} />
                      <FichaRow label="Banco"               value={db?.banco ?? '—'} />
                      <FichaRow label="Beneficiario"        value={db?.titular ?? '—'} />
                      <FichaRow label="Referencia"          value={curp} copy onCopy={() => copyText(curp)} />
                      <FichaRow label="Monto exacto"        value={`$${total.toLocaleString('es-MX')} MXN`} copy onCopy={() => copyText(String(total))} highlight />
                      <FichaRow label="Concepto"            value="Derecho de examen — Prepa Abierta Michoacán" />
                    </div>
                    <div className="px-4 py-2.5 bg-blue-100 border-t border-blue-200 flex items-center justify-between gap-3">
                      <span className="text-[11px] text-blue-700">💡 Usa el número de referencia exacto para que la institución identifique tu pago.</span>
                      <a
                        href={`/api/gestor/alumnos/${alumnoId}/ficha-pago?metodo=spei`}
                        target="_blank"
                        rel="noopener"
                        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white text-[11px] font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Download size={11} /> Descargar ficha PDF
                      </a>
                    </div>
                  </div>
                )}

                {pagoMetodo === 'banco_deposito' && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 bg-emerald-600 flex items-center gap-2">
                      <Building2 size={14} className="text-white" />
                      <span className="text-xs font-bold text-white uppercase tracking-widest">Depósito bancario en ventanilla</span>
                    </div>
                    <div className="p-4 space-y-2.5">
                      <FichaRow label="Banco"             value={db?.banco ?? '—'} />
                      {db?.numeroCuenta && (
                        <FichaRow label="Número de cuenta" value={db.numeroCuenta} copy onCopy={() => copyText(db!.numeroCuenta!)} />
                      )}
                      <FichaRow label="CLABE"             value={db?.clabe ?? '— no configurado —'} copy={!!db?.clabe} onCopy={() => copyText(db!.clabe)} />
                      <FichaRow label="A nombre de"       value={db?.titular ?? '—'} />
                      <FichaRow label="Referencia"        value={curp} copy onCopy={() => copyText(curp)} />
                      <FichaRow label="Monto exacto"      value={`$${total.toLocaleString('es-MX')} MXN`} copy onCopy={() => copyText(String(total))} highlight />
                    </div>
                    <div className="px-4 py-2.5 bg-emerald-100 border-t border-emerald-200 flex items-center justify-between gap-3">
                      <span className="text-[11px] text-emerald-700">💡 Acude a cualquier sucursal del banco e indica el número de cuenta y la referencia.</span>
                      <a
                        href={`/api/gestor/alumnos/${alumnoId}/ficha-pago?metodo=banco_deposito`}
                        target="_blank"
                        rel="noopener"
                        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 text-white text-[11px] font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
                      >
                        <Download size={11} /> Descargar ficha PDF
                      </a>
                    </div>
                  </div>
                )}

                {pagoMetodo === 'tienda_conveniencia' && (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 bg-orange-500 flex items-center gap-2">
                      <Store size={14} className="text-white" />
                      <span className="text-xs font-bold text-white uppercase tracking-widest">Pago en tienda de conveniencia</span>
                    </div>
                    <div className="p-4 space-y-2.5">
                      <FichaRow label="Servicio / empresa" value={db?.titular ?? '—'} />
                      {db?.convenio && (
                        <FichaRow label="Número de convenio" value={db.convenio} copy onCopy={() => copyText(db!.convenio!)} />
                      )}
                      <FichaRow label="Referencia"         value={curp} copy onCopy={() => copyText(curp)} />
                      <FichaRow label="Monto exacto"       value={`$${total.toLocaleString('es-MX')} MXN`} copy onCopy={() => copyText(String(total))} highlight />
                      <FichaRow label="Establecimientos"   value="OXXO · 7-Eleven · Farmacias del Ahorro · Círculo K" />
                    </div>
                    <div className="px-4 py-2.5 bg-orange-100 border-t border-orange-200 flex items-center justify-between gap-3">
                      <span className="text-[11px] text-orange-700">💡 Ve a la caja de cualquier tienda, indica que quieres pagar a <strong>Prepa Abierta Michoacán</strong>, proporciona el número de convenio y la referencia (tu CURP).</span>
                      <a
                        href={`/api/gestor/alumnos/${alumnoId}/ficha-pago?metodo=tienda_conveniencia`}
                        target="_blank"
                        rel="noopener"
                        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 bg-orange-500 text-white text-[11px] font-semibold rounded-lg hover:bg-orange-600 transition-colors"
                      >
                        <Download size={11} /> Descargar ficha PDF
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* PASO 3 — subir comprobante */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-full bg-[var(--color-guinda-700)] text-white text-xs font-bold flex items-center justify-center shrink-0">3</span>
                  <span className="text-sm font-bold text-stone-800">Sube el comprobante de pago</span>
                </div>

                {etapa && (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800 mb-3">
                    <AlertTriangle size={13} className="shrink-0 mt-0.5 text-amber-500" />
                    Sube el comprobante antes del <strong>{fmtDate(etapa.solicitudFin)}</strong> para confirmar tu inscripción.
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-1">Fecha en que realizaste el pago</label>
                    <input
                      type="date"
                      value={pagoFecha}
                      onChange={(e) => setPagoFecha(e.target.value)}
                      className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[var(--color-guinda-700)]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-1">Comprobante (PDF o imagen)</label>
                    <label className={`flex items-center gap-3 border-2 border-dashed rounded-xl p-4 cursor-pointer transition-colors ${
                      pagoFile
                        ? 'border-[var(--color-guinda-700)] bg-[var(--color-guinda-50,#faf0f3)]'
                        : 'border-stone-300 hover:border-stone-400 bg-white'
                    }`}>
                      <UploadCloud size={20} className={pagoFile ? 'text-[var(--color-guinda-700)]' : 'text-stone-400'} />
                      <div className="flex-1 min-w-0">
                        {pagoFile
                          ? <span className="text-sm font-semibold text-[var(--color-guinda-700)] truncate block">{pagoFile.name}</span>
                          : <span className="text-sm text-stone-500">Seleccionar archivo del comprobante</span>
                        }
                      </div>
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        className="hidden"
                        onChange={(e) => setPagoFile(e.target.files?.[0] ?? null)}
                      />
                    </label>
                  </div>

                  <button
                    onClick={onSubirPago}
                    disabled={!pagoFile || pagoSubiendo}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-[var(--color-guinda-700)] text-white text-sm font-semibold rounded-xl hover:bg-[var(--color-guinda-800)] disabled:opacity-50 transition-colors"
                  >
                    {pagoSubiendo ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
                    {pagoSubiendo ? 'Enviando…' : `Enviar comprobante — $${total.toLocaleString('es-MX')} MXN`}
                  </button>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
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
  onClose,
  onSave,
}: {
  alumno: AlumnoConMatricula;
  loading: boolean;
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({ nombreCompleto: nombre, telefono, direccion, fechaNacimiento, curp });
  }

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
              onChange={(e) => setNombre(e.target.value)}
              required
              minLength={2}
              maxLength={200}
              placeholder="Nombre completo del alumno"
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[var(--color-guinda-700)] focus:border-transparent"
            />
          </div>

          {/* CURP */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1">
              CURP
            </label>
            <input
              value={curp}
              onChange={(e) => setCurp(e.target.value.toUpperCase())}
              maxLength={18}
              placeholder="CURP de 18 caracteres"
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm font-mono text-stone-800 focus:outline-none focus:ring-2 focus:ring-[var(--color-guinda-700)] focus:border-transparent"
            />
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
                onChange={(e) => setFechaNacimiento(e.target.value)}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[var(--color-guinda-700)] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1">
                Teléfono
              </label>
              <input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                maxLength={30}
                placeholder="10 dígitos"
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[var(--color-guinda-700)] focus:border-transparent"
              />
            </div>
          </div>

          {/* Dirección */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1">
              Dirección
            </label>
            <textarea
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Calle, número, colonia, municipio…"
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[var(--color-guinda-700)] focus:border-transparent resize-none"
            />
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
