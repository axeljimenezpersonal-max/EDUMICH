import { useEffect, useState, type ReactNode } from 'react';
import {
  Pencil, AlertCircle, FileText, CreditCard, GraduationCap,
  Copy, CheckCircle2, UploadCloud, Loader2, Banknote, Building2,
  Store, Download, Clock, Calendar, MapPin, ClipboardList, Landmark, Check, ExternalLink,
} from 'lucide-react';
import { EstudianteLayout } from './EstudianteLayout';
import {
  api,
  type ExpedienteResponse,
  type TipoDocumento,
  type PagosResponse,
  type MeResponse,
  type ConvocatoriaResponse,
  type GestorConfigPagoResponse,
  type PagoExamenAlumno,
  type MetodoPago,
  METODOS_PAGO,
} from '../../lib/api';
import { PagoStepper } from '../../components/PagoStepper';
import DocumentoUploader from '../../components/DocumentoUploader';
import PagoCard from '../../components/PagoCard';
import CalificacionesTabContent from '../../components/CalificacionesTabContent';

// ─── Definición de documentos ─────────────────────────────────────────────
interface DocDef {
  tipo: TipoDocumento;
  label: string;
  descripcion: string;
  obligatorio: boolean;
  acceptImages?: boolean;
}

const DOCUMENTOS: DocDef[] = [
  { tipo: 'curp', label: 'CURP', descripcion: 'Clave Única de Registro de Población (PDF oficial)', obligatorio: true },
  { tipo: 'acta_nacimiento', label: 'Acta de nacimiento', descripcion: 'Acta de nacimiento oficial o copia certificada', obligatorio: true },
  { tipo: 'ine', label: 'Identificación oficial', descripcion: 'INE / IFE vigente por ambos lados', obligatorio: true },
  { tipo: 'comprobante_domicilio', label: 'Comprobante de domicilio', descripcion: 'No mayor a 3 meses de antigüedad', obligatorio: true },
  { tipo: 'certificado_secundaria', label: 'Certificado de secundaria', descripcion: 'Certificado o constancia de secundaria (PDF, ambos lados)', obligatorio: true },
  { tipo: 'foto', label: 'Fotografía', descripcion: 'Foto tamaño infantil, fondo blanco (JPG, PNG o PDF)', obligatorio: false, acceptImages: true },
  { tipo: 'comprobante_pago', label: 'Comprobante de pago', descripcion: 'Comprobante de pago de derechos de inscripción', obligatorio: false },
];

// ─── Formulario de datos personales ──────────────────────────────────────
interface DatosForm {
  nombreCompleto: string;
  curp: string;
  fechaNacimiento: string;
  telefono: string;
  direccion: string;
}

function DatosPersonalesSection({
  datos,
  onSaved,
}: {
  datos: ExpedienteResponse['datosPersonales'];
  onSaved: (updated: Partial<ExpedienteResponse['datosPersonales']>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<DatosForm>({
    nombreCompleto: datos.nombreCompleto,
    curp: datos.curp,
    fechaNacimiento: datos.fechaNacimiento ?? '',
    telefono: datos.telefono,
    direccion: datos.direccion,
  });

  function field(key: keyof DatosForm, label: string, placeholder?: string) {
    return (
      <div>
        <label className="block text-xs font-semibold text-stone-500 mb-1 uppercase tracking-widest">
          {label}
        </label>
        {editing ? (
          <input
            className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-guinda-500)] focus:border-transparent"
            value={form[key]}
            placeholder={placeholder}
            onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          />
        ) : (
          <p className="text-sm text-stone-800">{form[key] || <span className="text-stone-400 italic">Sin registrar</span>}</p>
        )}
      </div>
    );
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await api.patch('/estudiante/datos-personales', {
        nombreCompleto: form.nombreCompleto || undefined,
        curp: form.curp || undefined,
        fechaNacimiento: form.fechaNacimiento || null,
        telefono: form.telefono || undefined,
        direccion: form.direccion || undefined,
      });
      onSaved({
        nombreCompleto: form.nombreCompleto,
        curp: form.curp,
        fechaNacimiento: form.fechaNacimiento || null,
        telefono: form.telefono,
        direccion: form.direccion,
      });
      setEditing(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-stone-200 rounded-lg p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-base font-bold text-stone-900">Datos personales</h2>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-xs text-[var(--color-guinda-700)] hover:underline font-semibold"
          >
            <Pencil size={13} />
            Editar
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setEditing(false); setError(null); }}
              className="text-xs text-stone-500 hover:text-stone-700 font-semibold"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-[var(--color-guinda-700)] text-white hover:bg-[var(--color-guinda-800)] disabled:opacity-50 transition-colors"
            >
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-3 text-xs text-red-600 bg-red-50 rounded p-2 flex items-center gap-1.5">
          <AlertCircle size={13} />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {field('nombreCompleto', 'Nombre completo')}
        {field('curp', 'CURP', 'ABCD000000HABC000')}
        {field('fechaNacimiento', 'Fecha de nacimiento', 'AAAA-MM-DD')}
        {field('telefono', 'Teléfono')}
        <div className="sm:col-span-2">{field('direccion', 'Dirección')}</div>
      </div>

      <div className="mt-3 pt-3 border-t border-stone-100">
        <p className="text-xs text-stone-500">
          Municipio: <span className="font-semibold text-stone-700">{datos.municipio || '—'}</span>
        </p>
      </div>
    </div>
  );
}

// ─── FichaRow helper ─────────────────────────────────────────────────────
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

type ActiveTab = 'docs' | 'pagos' | 'calificaciones';

// ─── Página principal ─────────────────────────────────────────────────────
export default function MiExpediente() {
  const [data, setData] = useState<ExpedienteResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<ActiveTab>('docs');
  const [meId, setMeId] = useState<number | null>(null);

  // Pagos
  const [pagosData, setPagosData] = useState<PagosResponse | null>(null);
  const [pagosLoading, setPagosLoading] = useState(false);
  const [configPago, setConfigPago] = useState<GestorConfigPagoResponse | null>(null);
  const [convData, setConvData] = useState<ConvocatoriaResponse | null>(null);

  // Flujo de pago
  const [pagoMetodo, setPagoMetodo] = useState('otro');
  const [pagoFile, setPagoFile] = useState<File | null>(null);
  const [pagoFecha, setPagoFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [pagoSubiendo, setPagoSubiendo] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function reload() {
    try {
      const fresh = await api.get<ExpedienteResponse>('/estudiante/expediente');
      setData(fresh);
    } catch {}
  }

  useEffect(() => {
    api.get<ExpedienteResponse>('/estudiante/expediente').then(setData).catch(() => {}).finally(() => setLoading(false));
    api.get<MeResponse>('/auth/me').then((me) => setMeId(me.id)).catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab !== 'pagos' || !meId) return;
    setPagosLoading(true);
    Promise.all([
      api.get<PagosResponse>(`/pagos/estudiantes/${meId}`),
      api.get<GestorConfigPagoResponse>('/estudiante/config-pago').catch(() => null),
      api.get<ConvocatoriaResponse>('/estudiante/convocatoria').catch(() => null),
    ])
      .then(([pagos, config, conv]) => {
        setPagosData(pagos);
        setConfigPago(config);
        setConvData(conv);
      })
      .catch(() => {})
      .finally(() => setPagosLoading(false));
  }, [activeTab, meId]);

  async function handleSubirPago() {
    if (!meId || !pagoFile || !convData || !configPago) return;
    const activos = convData.misExamenes.filter(
      (e) => !['cancelado', 'reprobado', 'no_presento'].includes(e.estado)
    );
    const total = activos.length * configPago.costoExamen;

    setPagoSubiendo(true);
    try {
      const form = new FormData();
      form.append('comprobante', pagoFile);
      form.append('concepto', 'derecho_examen');
      form.append('monto', String(total));
      form.append('fechaPago', pagoFecha);
      form.append('metodoPago', pagoMetodo);
      await api.post(`/pagos/estudiantes/${meId}`, form);
      showToast('Comprobante enviado — en revisión', 'success');
      setPagoFile(null);
      // Reload payments
      setPagosLoading(true);
      const fresh = await api.get<PagosResponse>(`/pagos/estudiantes/${meId}`);
      setPagosData(fresh);
    } catch (e) {
      showToast((e as Error).message || 'Error al enviar comprobante', 'error');
    } finally {
      setPagoSubiendo(false);
      setPagosLoading(false);
    }
  }

  const obligatorios = DOCUMENTOS.filter((d) => d.obligatorio);
  const opcionales = DOCUMENTOS.filter((d) => !d.obligatorio);
  const totalObligatorios = obligatorios.length;
  const aprobados = data ? obligatorios.filter((d) => data.documentos[d.tipo]?.estado === 'aprobado').length : 0;
  const subidos = data ? obligatorios.filter((d) => !!data.documentos[d.tipo]).length : 0;

  const tabItems: { key: ActiveTab; label: string; icon: React.ReactNode; badge: string }[] = [
    {
      key: 'docs',
      label: 'Mis documentos',
      icon: <FileText size={15} />,
      badge: `${subidos}/${totalObligatorios}`,
    },
    {
      key: 'pagos',
      label: 'Mis pagos',
      icon: <CreditCard size={15} />,
      badge: pagosData !== null ? String(pagosData.pagos.length) : '—',
    },
    {
      key: 'calificaciones',
      label: 'Mis calificaciones',
      icon: <GraduationCap size={15} />,
      badge: '—',
    },
  ];

  return (
    <EstudianteLayout>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm max-w-sm ${
          toast.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-guinda-700)] mb-1">
          MI EXPEDIENTE
        </div>
        <h1 className="font-serif text-2xl font-bold text-stone-900">Expediente documental</h1>
        <p className="text-stone-500 text-sm mt-1">
          Sube los documentos requeridos para completar tu expediente académico.
        </p>
      </div>

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
            >
              {icon}
              {label}
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  active ? 'bg-white/20 text-white' : 'bg-[var(--color-crema-100)] text-stone-700'
                }`}
              >
                {badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* ════ TAB: Mis documentos ════ */}
      {activeTab === 'docs' && (
        <>
          {data && (
            <div className="bg-gradient-to-r from-[var(--color-guinda-800)] to-[var(--color-guinda-600)] text-white rounded-lg p-5 mb-6">
              <div className="text-[10px] font-semibold uppercase tracking-widest opacity-70 mb-3">
                Progreso del expediente
              </div>
              <div className="flex items-end justify-between mb-3">
                <div>
                  <span className="text-3xl font-bold font-serif">{aprobados}</span>
                  <span className="text-lg opacity-50">/{totalObligatorios}</span>
                  <div className="text-xs opacity-70 mt-0.5">Documentos obligatorios aprobados</div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold font-serif">{subidos}</span>
                  <span className="text-base opacity-50">/{totalObligatorios}</span>
                  <div className="text-xs opacity-70 mt-0.5">Subidos y en revisión</div>
                </div>
              </div>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all"
                  style={{ width: `${totalObligatorios > 0 ? (aprobados / totalObligatorios) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {loading && <div className="text-center text-stone-400 py-16 text-sm">Cargando expediente…</div>}

          {data && (
            <>
              <DatosPersonalesSection
                datos={data.datosPersonales}
                onSaved={(updated) =>
                  setData((prev) => prev ? { ...prev, datosPersonales: { ...prev.datosPersonales, ...updated } } : prev)
                }
              />

              {/* Acceso a la inscripción (convocatoria) — arriba de los documentos */}
              <a
                href="/estudiante/convocatoria"
                className="mb-4 flex items-center gap-3 bg-white border border-stone-200 rounded-xl p-4 hover:border-[var(--color-guinda-700)] transition-colors group"
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-[var(--color-crema-100)] text-[var(--color-guinda-700)]">
                  <Calendar size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-stone-900">Inscribir exámenes</div>
                  <div className="text-xs text-stone-500">Inscríbete a los módulos de la convocatoria activa.</div>
                </div>
                <span className="text-xs font-semibold text-[var(--color-guinda-700)] group-hover:underline shrink-0">
                  Ver →
                </span>
              </a>

              <section className="mb-6">
                <h2 className="font-serif text-base font-bold text-stone-900 mb-3">Documentos obligatorios</h2>
                <div className="space-y-3">
                  {obligatorios.map((def) => (
                    <DocumentoUploader
                      key={def.tipo}
                      tipo={def.tipo}
                      label={def.label}
                      descripcion={def.descripcion}
                      isRequired={true}
                      doc={data.documentos[def.tipo]}
                      endpoints={{
                        upload: `/api/estudiante/expediente/documento/${def.tipo}`,
                        preview: `/api/estudiante/expediente/documento/${def.tipo}/preview`,
                        descargar: `/api/estudiante/expediente/documento/${def.tipo}/descargar`,
                      }}
                      acceptImages={def.acceptImages}
                      onUploaded={reload}
                    />
                  ))}
                </div>

                {/* Botón grande: armar la cédula de inscripción (parte del flujo) */}
                <a
                  href="/estudiante/cedula"
                  className="mt-4 flex items-center gap-4 rounded-xl p-5 text-white transition-transform hover:scale-[1.01] shadow-sm"
                  style={{ background: 'linear-gradient(135deg, var(--color-guinda-800), var(--color-guinda-600))' }}
                >
                  <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                    <ClipboardList size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-base font-bold">Armar cédula de inscripción</div>
                    <div className="text-xs opacity-80 mt-0.5">
                      Llena tus datos, firma y descarga tu cédula oficial.
                    </div>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1.5 bg-white text-[var(--color-guinda-700)] font-bold text-sm px-4 py-2 rounded-lg">
                    Armar →
                  </span>
                </a>

                {/* Vista previa de la cédula */}
                <div className="mt-3">
                  <div className="text-xs font-semibold text-stone-500 mb-1.5">Vista previa de tu cédula</div>
                  <iframe
                    title="Vista previa de la cédula"
                    src="/api/estudiante/cedula/pdf#toolbar=0&view=FitH"
                    className="w-full border border-stone-200 rounded-xl bg-stone-100"
                    style={{ height: 360 }}
                  />
                </div>
              </section>

              <section className="mb-6">
                <h2 className="font-serif text-base font-bold text-stone-900 mb-1">Documentos opcionales</h2>
                <p className="text-xs text-stone-500 mb-3">
                  No son obligatorios, pero pueden agilizar tu proceso de inscripción.
                </p>
                <div className="space-y-3">
                  {opcionales.map((def) => (
                    <DocumentoUploader
                      key={def.tipo}
                      tipo={def.tipo}
                      label={def.label}
                      descripcion={def.descripcion}
                      isRequired={false}
                      doc={data.documentos[def.tipo]}
                      endpoints={{
                        upload: `/api/estudiante/expediente/documento/${def.tipo}`,
                        preview: `/api/estudiante/expediente/documento/${def.tipo}/preview`,
                        descargar: `/api/estudiante/expediente/documento/${def.tipo}/descargar`,
                      }}
                      acceptImages={def.acceptImages}
                      onUploaded={reload}
                    />
                  ))}
                </div>
              </section>
            </>
          )}
        </>
      )}

      {/* ════ TAB: Mis pagos ════ */}
      {activeTab === 'pagos' && (
        <PagosTab
          pagosLoading={pagosLoading}
          pagosData={pagosData}
          configPago={configPago}
          convData={convData}
          curp={data?.datosPersonales.curp ?? ''}
          meId={meId}
          pagoMetodo={pagoMetodo}
          setPagoMetodo={setPagoMetodo}
          pagoFile={pagoFile}
          setPagoFile={setPagoFile}
          pagoFecha={pagoFecha}
          setPagoFecha={setPagoFecha}
          pagoSubiendo={pagoSubiendo}
          onSubirPago={handleSubirPago}
        />
      )}

      {/* ════ TAB: Mis calificaciones ════ */}
      {activeTab === 'calificaciones' && meId !== null && (
        <CalificacionesTabContent estudianteId={meId} readOnly={true} />
      )}
    </EstudianteLayout>
  );
}

// ─── Sub-component: PagosTab ──────────────────────────────────────────────

function PagosTab({
  pagosLoading,
  pagosData,
  configPago,
  convData,
  curp,
  meId,
  pagoMetodo,
  setPagoMetodo,
  pagoFile,
  setPagoFile,
  pagoFecha,
  setPagoFecha,
  pagoSubiendo,
  onSubirPago,
}: {
  pagosLoading: boolean;
  pagosData: PagosResponse | null;
  configPago: GestorConfigPagoResponse | null;
  convData: ConvocatoriaResponse | null;
  curp: string;
  meId: number | null;
  pagoMetodo: string;
  setPagoMetodo: (v: string) => void;
  pagoFile: File | null;
  setPagoFile: (f: File | null) => void;
  pagoFecha: string;
  setPagoFecha: (v: string) => void;
  pagoSubiendo: boolean;
  onSubirPago: () => void;
}) {
  // Órdenes de pago (Tesorería del Estado). Si hay una activa, el flujo interino
  // de "sube tu comprobante" se oculta para no duplicar.
  const [ordenActiva, setOrdenActiva] = useState(false);

  if (pagosLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-stone-400 gap-2 text-sm">
        <Loader2 size={18} className="animate-spin" /> Cargando…
      </div>
    );
  }

  // Inscripciones activas (que necesitan pago)
  const inscripcionesActivas = convData?.misExamenes.filter(
    (e) => !['cancelado', 'reprobado', 'no_presento'].includes(e.estado)
  ) ?? [];

  const costoExamen = configPago?.costoExamen ?? 150;
  const total = inscripcionesActivas.length * costoExamen;
  const db = configPago?.datosBancarios ?? null;

  // Pago vigente (no rechazado)
  const pagoVigente = pagosData?.pagos.find(
    (p) => p.concepto === 'derecho_examen' && p.estado !== 'rechazado'
  ) ?? null;

  // Flujo LEGACY de pago (tabla `pagos`) retirado: el pago del derecho de examen
  // vive por completo en las órdenes de pago (pagos_examen / OrdenesPagoExamen).
  void pagoVigente;
  const showPaymentForm = false;
  const showPaymentStatus = false;

  function copyText(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });

  const DIA_LABEL: Record<string, string> = { sabado: 'Sábado', domingo: 'Domingo' };

  const metodoPicker = [
    { value: 'spei',                icon: <Banknote size={18} />,  label: 'SPEI / Transferencia' },
    { value: 'banco_deposito',      icon: <Building2 size={18} />, label: 'Depósito bancario' },
    { value: 'tienda_conveniencia', icon: <Store size={18} />,     label: 'Tienda de conveniencia' },
  ];

  return (
    <div className="space-y-5">

      {/* ── Órdenes de pago (Tesorería del Estado) ── */}
      <OrdenesPagoExamen onEstado={setOrdenActiva} />

      {/* ── Sin inscripciones activas ── */}
      {inscripcionesActivas.length === 0 && !ordenActiva && (
        <div className="bg-stone-50 border border-stone-200 rounded-xl p-8 text-center">
          <CreditCard size={32} className="mx-auto text-stone-300 mb-3" />
          <div className="text-sm font-semibold text-stone-500">Sin inscripciones activas</div>
          <div className="text-xs text-stone-400 mt-1 max-w-xs mx-auto">
            Ve a <strong>Mi convocatoria</strong> para inscribirte a módulos; cuando tengas inscripciones activas verás aquí la ficha de pago.
          </div>
        </div>
      )}

      {/* ── Estado de pago vigente ── */}
      {showPaymentStatus && pagoVigente && (
        <div className={`rounded-xl border p-4 flex items-start gap-3 ${
          pagoVigente.estado === 'verificado'  ? 'bg-green-50 border-green-200'  :
          pagoVigente.estado === 'rechazado'   ? 'bg-red-50 border-red-200'      :
                                                 'bg-amber-50 border-amber-200'
        }`}>
          {pagoVigente.estado === 'verificado'
            ? <CheckCircle2 size={18} className="text-green-600 shrink-0 mt-0.5" />
            : pagoVigente.estado === 'rechazado'
              ? <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
              : <Clock size={18} className="text-amber-500 shrink-0 mt-0.5" />}
          <div>
            <div className="text-sm font-bold text-stone-800">
              {pagoVigente.estado === 'verificado' ? 'Pago verificado ✓' :
               pagoVigente.estado === 'rechazado'  ? 'Comprobante rechazado' :
                                                     'Comprobante enviado — en revisión'}
            </div>
            <div className="text-xs text-stone-500 mt-0.5">
              ${Number(pagoVigente.monto).toLocaleString('es-MX')} MXN · {fmtDate(pagoVigente.fechaPago)}
            </div>
          </div>
        </div>
      )}

      {/* ── Flujo de pago 3 pasos ── */}
      {showPaymentForm && (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-2">
            <CreditCard size={15} className="text-[var(--color-guinda-700)]" />
            <h3 className="text-sm font-bold text-stone-900">Pago de derechos de examen</h3>
          </div>

          <div className="p-5 space-y-6">

            {/* Tus módulos inscritos */}
            <div className="bg-stone-50 border border-stone-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
                <span className="text-sm font-bold text-stone-800">Módulos inscritos</span>
                <span className="text-xs text-stone-500">{inscripcionesActivas.length} examen{inscripcionesActivas.length !== 1 ? 'es' : ''}</span>
              </div>
              <div className="divide-y divide-stone-100">
                {inscripcionesActivas.map((insc) => (
                  <div key={insc.id} className="px-4 py-3 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-stone-800">
                        Módulo {insc.modulo.numero} — {insc.modulo.nombre}
                      </div>
                      <div className="flex flex-wrap gap-3 mt-1 text-xs text-stone-500">
                        <span className="flex items-center gap-1">
                          <Clock size={11} />{DIA_LABEL[insc.dia] ?? insc.dia} · {insc.hora}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar size={11} />{fmtDate(insc.fechaExamen)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin size={11} />{insc.sede.nombre}
                        </span>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-stone-700 shrink-0">${costoExamen.toLocaleString('es-MX')} MXN</span>
                  </div>
                ))}
              </div>
              <div className="px-4 py-3 bg-stone-100 border-t border-stone-200 flex justify-between items-center">
                <span className="text-sm text-stone-600">{inscripcionesActivas.length} examen{inscripcionesActivas.length !== 1 ? 'es' : ''} × ${costoExamen} MXN</span>
                <span className="text-base font-bold text-stone-900">Total: ${total.toLocaleString('es-MX')} MXN</span>
              </div>
            </div>

            {/* PASO 1 — Paga ante la Tesorería del Estado */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded-full bg-[var(--color-guinda-700)] text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
                <span className="text-sm font-bold text-stone-800">Paga ante la Tesorería del Estado</span>
              </div>
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--color-crema-100)] text-[var(--color-guinda-700)] flex items-center justify-center shrink-0">
                  <Building2 size={18} />
                </div>
                <div className="flex-1 min-w-0 text-sm text-stone-600 leading-relaxed">
                  El pago de derechos de examen se realiza ante la <strong className="text-stone-800">Tesorería / Secretaría de Finanzas del Estado de Michoacán</strong> (formato de pago de derechos).
                  Realiza el pago por <strong className="text-stone-800">${total.toLocaleString('es-MX')} MXN</strong> ({inscripcionesActivas.length} examen{inscripcionesActivas.length !== 1 ? 'es' : ''}) y conserva tu comprobante o línea de captura para subirlo abajo.
                  <div className="mt-1.5 text-[11px] text-stone-400">Si tienes gestor, confirma con él si tu pago se cubre de forma grupal.</div>
                </div>
              </div>
            </div>

            {/* PASO 2 — subir comprobante */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded-full bg-[var(--color-guinda-700)] text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
                <span className="text-sm font-bold text-stone-800">Sube tu comprobante de pago</span>
              </div>
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
                        : <span className="text-sm text-stone-500">Seleccionar archivo</span>}
                    </div>
                    <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => setPagoFile(e.target.files?.[0] ?? null)} />
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

          </div>
        </div>
      )}

      {inscripcionesActivas.length === 0 && !ordenActiva && (
        <div className="text-center text-stone-400 py-8 text-sm">Sin pagos registrados.</div>
      )}

    </div>
  );
}

// ─── Órdenes de pago de examen (Tesorería del Estado) ──────────────────────
const OP_ESTADO: Record<string, { label: string; bg: string; color: string; icon: ReactNode }> = {
  pendiente_emision: { label: 'Preparando tu orden', bg: '#fff7ed', color: '#b45309', icon: <Clock size={13} /> },
  emitida: { label: 'Lista para pagar', bg: '#eff6ff', color: '#1d4ed8', icon: <Landmark size={13} /> },
  en_revision: { label: 'Comprobante en revisión', bg: '#fefce8', color: '#a16207', icon: <Clock size={13} /> },
  pagado: { label: 'Pagado', bg: '#f0fdf4', color: '#15803d', icon: <CheckCircle2 size={13} /> },
  vencido: { label: 'Vencido', bg: '#fef2f2', color: '#b91c1c', icon: <AlertCircle size={13} /> },
  cancelado: { label: 'Cancelado', bg: '#f5f5f4', color: '#78716c', icon: <AlertCircle size={13} /> },
};

function OrdenesPagoExamen({ onEstado }: { onEstado: (activa: boolean) => void }) {
  const [ordenes, setOrdenes] = useState<PagoExamenAlumno[] | null>(null);
  const [subiendo, setSubiendo] = useState<number | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [metodoPorId, setMetodoPorId] = useState<Record<number, MetodoPago>>({});

  function cargar() {
    return api.get<{ pagos: PagoExamenAlumno[] }>('/pagos-examen/mios')
      .then((r) => {
        setOrdenes(r.pagos);
        const activas = r.pagos.filter((p) => ['pendiente_emision', 'emitida', 'en_revision', 'pagado'].includes(p.estado));
        onEstado(activas.length > 0);
      })
      .catch(() => { setOrdenes([]); onEstado(false); });
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, []);

  async function subirComprobante(id: number, file: File) {
    const metodo = metodoPorId[id];
    if (!metodo) return;
    setSubiendo(id);
    try {
      const fd = new FormData();
      fd.append('comprobante', file);
      fd.append('metodoPago', metodo);
      await api.post(`/pagos-examen/${id}/comprobante`, fd);
      await cargar();
    } catch { /* noop */ } finally { setSubiendo(null); }
  }

  async function cancelarOrden(id: number) {
    if (!confirm('¿Cancelar esta orden de pago? Podrás solicitarla de nuevo después.')) return;
    try { await api.post(`/pagos-examen/${id}/cancelar-mia`, {}); await cargar(); } catch { /* noop */ }
  }

  async function quitarExamen(id: number, inscripcionId: number) {
    if (!confirm('¿Quitar este módulo de la orden?')) return;
    try { await api.post(`/pagos-examen/${id}/quitar-examen`, { examenInscripcionId: inscripcionId }); await cargar(); } catch { /* noop */ }
  }

  const fmtMoney = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
  const fmtFecha = (iso: string | null) =>
    iso ? new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

  // Solo mostramos órdenes que no estén canceladas
  const visibles = (ordenes ?? []).filter((o) => o.estado !== 'cancelado');
  if (visibles.length === 0) return null;

  return (
    <div className="space-y-4">
      {visibles.map((o) => {
        const cfg = OP_ESTADO[o.estado] ?? OP_ESTADO.emitida;
        return (
          <div key={o.id} className="bg-white border border-stone-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Landmark size={16} className="text-[var(--color-guinda-700)]" />
                <h3 className="text-sm font-bold text-stone-900">Orden de pago — Tesorería del Estado</h3>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: cfg.bg, color: cfg.color }}>
                {cfg.icon} {cfg.label}
              </span>
            </div>

            <div className="p-5 space-y-4">
              {/* Stepper del proceso */}
              <PagoStepper estado={o.estado} />

              {/* Total + exámenes */}
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-stone-500">{o.cantidadExamenes} examen{o.cantidadExamenes !== 1 ? 'es' : ''} de derecho a examen</span>
                <span className="text-2xl font-bold text-stone-900">{fmtMoney(o.montoTotal)} <span className="text-sm font-medium text-stone-400">MXN</span></span>
              </div>
              {o.examenes.length > 0 && (() => {
                const editable = o.estado === 'pendiente_emision' || o.estado === 'emitida';
                return (
                  <div className="flex flex-wrap gap-1.5">
                    {o.examenes.map((e) => (
                      <span key={e.inscripcionId} className="text-[11px] bg-stone-100 text-stone-600 rounded-full pl-2 pr-1 py-0.5 inline-flex items-center gap-1">
                        Módulo {e.moduloNumero}
                        {editable && o.examenes.length > 1 && (
                          <button onClick={() => quitarExamen(o.id, e.inscripcionId)} title="Quitar módulo" className="text-stone-400 hover:text-red-600 text-[13px] leading-none">
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                );
              })()}

              {/* Emitida / en_revision / vencido: mostrar línea de captura + descarga */}
              {(o.estado === 'emitida' || o.estado === 'en_revision' || o.estado === 'vencido') && (
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-3">
                  <div className="text-[11px] text-stone-500">La coordinación emitió tu orden de pago. Descárgala y paga ante la Tesorería.</div>
                  {o.tieneOrden ? (
                    <a href={`/api/pagos-examen/${o.id}/orden`} target="_blank" rel="noreferrer"
                      className="flex items-center gap-3 rounded-xl border-2 border-[var(--color-guinda-700)] bg-[var(--color-guinda-50,#faf0f3)] px-4 py-3 hover:bg-[var(--color-guinda-100,#f3dbe4)] transition-colors">
                      <FileText size={22} className="text-[var(--color-guinda-700)] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-[var(--color-guinda-800)]">Ver / descargar orden de pago (PDF)</div>
                        <div className="text-[11px] text-stone-500">Documento oficial de la plataforma del Estado</div>
                      </div>
                      <Download size={18} className="text-[var(--color-guinda-700)] shrink-0" />
                    </a>
                  ) : (
                    <div className="text-xs text-stone-500 bg-white border border-stone-200 rounded-lg p-2.5">La coordinación aún no adjuntó el PDF; usa la línea de captura o el link de pago.</div>
                  )}
                  {o.lineaCaptura && (
                    <div>
                      <div className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide mb-1">Línea de captura</div>
                      <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-lg px-3 py-2">
                        <code className="flex-1 text-sm font-mono text-stone-800 break-all">{o.lineaCaptura}</code>
                        <button onClick={() => { navigator.clipboard.writeText(o.lineaCaptura!); setCopiado(true); setTimeout(() => setCopiado(false), 1500); }} className="text-stone-400 hover:text-[var(--color-guinda-700)] shrink-0">
                          {copiado ? <Check size={15} /> : <Copy size={15} />}
                        </button>
                      </div>
                    </div>
                  )}
                  {o.linkPago && (
                    <a href={o.linkPago} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border border-stone-300 text-stone-700 hover:bg-white">
                      <ExternalLink size={15} /> Pagar en línea
                    </a>
                  )}
                  {o.fechaVencimiento && (
                    <div className="text-xs text-stone-500">Vence el <strong className="text-stone-700">{fmtFecha(o.fechaVencimiento)}</strong>. Paga en banco, tienda de conveniencia o en línea.</div>
                  )}
                  {o.estado === 'vencido' && (
                    <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5 flex gap-2">
                      <AlertCircle size={14} className="shrink-0 mt-0.5" /> Esta orden venció. Solicita a tu gestor o a la coordinación una nueva orden de pago.
                    </div>
                  )}
                </div>
              )}

              {/* Subir comprobante — solo si emitida. Elige método + archivo. */}
              {o.estado === 'emitida' && (
                <div className="space-y-2.5">
                  <div className="text-xs font-semibold text-stone-600">¿Ya pagaste? Indica cómo y sube tu comprobante</div>
                  <div className="grid grid-cols-3 gap-2">
                    {METODOS_PAGO.map((m) => (
                      <button key={m.value} onClick={() => setMetodoPorId((s) => ({ ...s, [o.id]: m.value }))}
                        className={`text-left rounded-lg border-2 p-2.5 transition-colors ${metodoPorId[o.id] === m.value ? 'border-[var(--color-guinda-700)] bg-[var(--color-guinda-50,#faf0f3)]' : 'border-stone-200 hover:border-stone-300'}`}>
                        <div className="text-xs font-bold text-stone-800">{m.label}</div>
                      </button>
                    ))}
                  </div>
                  <label className={`flex items-center gap-3 border-2 border-dashed rounded-xl p-3 transition-colors ${!metodoPorId[o.id] ? 'opacity-50 cursor-not-allowed border-stone-200' : subiendo === o.id ? 'opacity-60 border-stone-300' : 'border-stone-300 hover:border-stone-400 cursor-pointer'}`}>
                    {subiendo === o.id ? <Loader2 size={18} className="animate-spin text-stone-400" /> : <UploadCloud size={18} className="text-stone-400" />}
                    <span className="text-sm text-stone-500">{subiendo === o.id ? 'Enviando…' : !metodoPorId[o.id] ? 'Primero elige el método de pago' : 'Seleccionar comprobante (PDF o imagen)'}</span>
                    <input type="file" accept="application/pdf,image/*" className="hidden" disabled={subiendo === o.id || !metodoPorId[o.id]} onChange={(e) => { const f = e.target.files?.[0]; if (f) subirComprobante(o.id, f); }} />
                  </label>
                </div>
              )}

              {o.estado === 'en_revision' && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex gap-2">
                  <Clock size={14} className="shrink-0 mt-0.5" /> Tu comprobante está en revisión. Te avisaremos cuando se confirme el pago.
                </div>
              )}
              {o.motivoRechazo && o.estado === 'emitida' && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5 flex gap-2">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" /> Tu comprobante anterior fue rechazado: {o.motivoRechazo}
                </div>
              )}
              {o.estado === 'pagado' && (
                <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3 flex gap-2">
                  <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> Pago confirmado{o.fechaPago ? ` el ${fmtFecha(o.fechaPago)}` : ''}. ¡Listo para tu examen!
                </div>
              )}
              {o.estado === 'pendiente_emision' && (
                <div className="text-xs text-stone-500 bg-stone-50 border border-stone-200 rounded-lg p-2.5 flex gap-2">
                  <Clock size={14} className="shrink-0 mt-0.5" /> La coordinación está generando tu orden de pago ante la Tesorería. Vuelve pronto.
                </div>
              )}

              {(o.estado === 'pendiente_emision' || o.estado === 'emitida') && (
                <div className="pt-1 flex items-center justify-between gap-2">
                  <button onClick={() => cancelarOrden(o.id)} className="text-xs font-semibold text-red-600 hover:underline">
                    Cancelar orden
                  </button>
                  {o.estado === 'emitida' && (
                    <span className="text-[11px] text-stone-400">Editar/quitar un módulo requiere re-emisión de la coordinación.</span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
