import { useEffect, useState } from 'react';
import { Pencil, AlertCircle, FileText, CreditCard, GraduationCap, Plus } from 'lucide-react';
import { EstudianteLayout } from './EstudianteLayout';
import {
  api,
  type ExpedienteResponse,
  type TipoDocumento,
  type PagosResponse,
  type MeResponse,
} from '../../lib/api';
import DocumentoUploader from '../../components/DocumentoUploader';
import PagoCard from '../../components/PagoCard';
import SubirPagoModal from '../../components/SubirPagoModal';
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

type ActiveTab = 'docs' | 'pagos' | 'calificaciones';

// ─── Página principal ─────────────────────────────────────────────────────
export default function MiExpediente() {
  const [data, setData] = useState<ExpedienteResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<ActiveTab>('docs');
  const [meId, setMeId] = useState<number | null>(null);
  const [pagosData, setPagosData] = useState<PagosResponse | null>(null);
  const [pagosLoading, setPagosLoading] = useState(false);
  const [modalPago, setModalPago] = useState(false);

  async function reload() {
    try {
      const fresh = await api.get<ExpedienteResponse>('/estudiante/expediente');
      setData(fresh);
    } catch {}
  }

  useEffect(() => {
    api
      .get<ExpedienteResponse>('/estudiante/expediente')
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));

    api.get<MeResponse>('/auth/me').then((me) => setMeId(me.id)).catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab !== 'pagos' || !meId) return;
    setPagosLoading(true);
    api.get<PagosResponse>(`/pagos/estudiantes/${meId}`)
      .then(setPagosData)
      .catch(() => {})
      .finally(() => setPagosLoading(false));
  }, [activeTab, meId]);

  const obligatorios = DOCUMENTOS.filter((d) => d.obligatorio);
  const opcionales = DOCUMENTOS.filter((d) => !d.obligatorio);

  const totalObligatorios = obligatorios.length;
  const aprobados = data
    ? obligatorios.filter((d) => data.documentos[d.tipo]?.estado === 'aprobado').length
    : 0;
  const subidos = data
    ? obligatorios.filter((d) => !!data.documentos[d.tipo]).length
    : 0;

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

      {/* TAB: Mis documentos */}
      {activeTab === 'docs' && (
        <>
          {/* Barra de progreso */}
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

          {loading && (
            <div className="text-center text-stone-400 py-16 text-sm">Cargando expediente…</div>
          )}

          {data && (
            <>
              {/* Datos personales */}
              <DatosPersonalesSection
                datos={data.datosPersonales}
                onSaved={(updated) =>
                  setData((prev) =>
                    prev
                      ? { ...prev, datosPersonales: { ...prev.datosPersonales, ...updated } }
                      : prev
                  )
                }
              />

              {/* Documentos obligatorios */}
              <section className="mb-6">
                <h2 className="font-serif text-base font-bold text-stone-900 mb-3">
                  Documentos obligatorios
                </h2>
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
              </section>

              {/* Documentos opcionales */}
              <section className="mb-6">
                <h2 className="font-serif text-base font-bold text-stone-900 mb-1">
                  Documentos opcionales
                </h2>
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

      {/* TAB: Mis pagos */}
      {activeTab === 'pagos' && (
        <>
          {pagosLoading ? (
            <div className="text-center text-stone-400 py-16 text-sm">Cargando pagos…</div>
          ) : pagosData ? (
            <>
              {/* Summary card */}
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
                  <div
                    className="text-4xl font-bold leading-none"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  >
                    {pagosData.resumen.verificados}
                  </div>
                  <div className="text-[9px] uppercase tracking-wider opacity-80 mt-1">Verificados</div>
                </div>
                <div className="text-center">
                  <div
                    className="text-4xl font-bold leading-none"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  >
                    {pagosData.resumen.pendientes}
                  </div>
                  <div className="text-[9px] uppercase tracking-wider opacity-80 mt-1">Pendientes</div>
                </div>
              </div>

              {/* Section title + button */}
              <div className="flex items-center justify-between mb-4">
                <h3
                  className="text-sm font-bold text-stone-900"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
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
                  <div
                    className="text-sm font-bold text-stone-500"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  >
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
          ) : (
            <div className="text-center text-stone-400 py-16 text-sm">Cargando…</div>
          )}

          {meId !== null && (
            <SubirPagoModal
              open={modalPago}
              onClose={() => setModalPago(false)}
              estudianteId={meId}
              onSuccess={() => {
                setPagosLoading(true);
                api.get<PagosResponse>(`/pagos/estudiantes/${meId}`)
                  .then(setPagosData)
                  .catch(() => {})
                  .finally(() => setPagosLoading(false));
              }}
            />
          )}
        </>
      )}

      {/* TAB: Mis calificaciones */}
      {activeTab === 'calificaciones' && meId !== null && (
        <CalificacionesTabContent estudianteId={meId} readOnly={true} />
      )}
    </EstudianteLayout>
  );
}
