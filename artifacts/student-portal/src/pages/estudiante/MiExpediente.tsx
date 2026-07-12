/**
 * Mi expediente — documentos del alumno + matrícula oficial DGB.
 *
 * Pagos y Calificaciones viven ahora en sus propias secciones
 * (/estudiante/pagos y /estudiante/calificaciones), como en el detalle
 * de alumno del gestor.
 */

import { useEffect, useState } from 'react';
import {
  Pencil, AlertCircle, Award, Calendar, ClipboardList, Download, FileText, Lock, Eye, EyeOff,
} from 'lucide-react';
import { EstudianteLayout } from './EstudianteLayout';
import { AyudaMensajes } from '../../components/AyudaMensajes';
import { SectionTour } from '../../components/onboarding/SectionTour';
import { TOUR_EXPEDIENTE, GATE_ESTUDIANTE } from '../../components/onboarding/seccionesEstudiante';
import { api, type ExpedienteResponse, type TipoDocumento } from '../../lib/api';
import DocumentoUploader from '../../components/DocumentoUploader';

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
  { tipo: 'foto', label: 'Fotografía', descripcion: 'Se usa para tu credencial digital y tu cédula. Cumple los requisitos de aquí abajo.', obligatorio: false, acceptImages: true },
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
    <div data-tour="exp-datos" className="bg-white border border-stone-200 rounded-lg p-5 mb-6 scroll-mt-24">
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

// ─── Tarjeta de matrícula oficial DGB (espejo de la vista del gestor) ──────
function MatriculaCard({ data }: { data: ExpedienteResponse }) {
  if (data.matriculaOficialDGB) {
    return (
      <div
        data-tour="exp-matricula"
        className="rounded-xl border p-5 mb-6"
        style={{ borderColor: '#c9dfc9', background: 'linear-gradient(135deg, #f2faf2, #fbfdfb)' }}
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#e3f2e3', color: '#15803d' }}>
            <Award size={19} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-stone-900">Matrícula oficial DGB</div>
            <div className="text-xs text-stone-500">
              {data.matriculaCapturadaEn
                ? `Asignada el ${new Date(data.matriculaCapturadaEn).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}`
                : 'Asignada por la coordinación'}
            </div>
          </div>
        </div>

        <div className="mt-4 bg-white border border-stone-200 rounded-xl px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">Matrícula</div>
          <div className="text-2xl font-bold font-mono" style={{ color: 'var(--color-guinda-800)' }}>
            {data.matriculaOficialDGB}
          </div>
        </div>

        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => document.getElementById('cedula-inscripcion')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
            style={{ background: '#15803d' }}
          >
            <ClipboardList size={14} /> Ver cédula de inscripción
          </button>
          <a
            href="/api/estudiante/ficha-preregistro"
            target="_blank"
            rel="noreferrer"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 no-underline transition-colors"
          >
            <FileText size={14} /> Ficha de Pre-registro
          </a>
        </div>
      </div>
    );
  }

  return (
    <div
      data-tour="exp-matricula"
      className="rounded-xl border p-5 mb-6 flex items-start gap-3"
      style={{ borderColor: '#f0d9a8', background: '#fdf8ec' }}
    >
      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#f7ecd2', color: '#b45309' }}>
        <Lock size={17} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-stone-900">Matrícula oficial DGB — aún no asignada</div>
        <div className="text-xs text-stone-600 mt-1 leading-relaxed">
          La coordinación te la asigna cuando la SEP-DGB valida tu registro
          {data.folioPreregistro && (
            <> · Mientras tanto, tu folio de pre-registro es{' '}
              <span className="font-mono font-bold text-stone-800">{data.folioPreregistro}</span>
            </>
          )}
          . Completa tu expediente para agilizar el trámite.
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────
export default function MiExpediente() {
  const [data, setData] = useState<ExpedienteResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [mostrarCedula, setMostrarCedula] = useState(false);

  async function reload() {
    try {
      const fresh = await api.get<ExpedienteResponse>('/estudiante/expediente');
      setData(fresh);
    } catch {}
  }

  useEffect(() => {
    api.get<ExpedienteResponse>('/estudiante/expediente').then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Enlace profundo: /estudiante/expediente?doc=foto baja directo a la sección
  // de Fotografía (desde el widget de credencial en Inicio).
  useEffect(() => {
    if (!data) return;
    if (new URLSearchParams(window.location.search).get('doc') !== 'foto') return;
    // Reintentos: los uploaders cargan de forma asíncrona y empujan el layout,
    // así que reafirmamos el scroll unas cuantas veces hasta que quede fijo.
    const timers = [150, 500, 900, 1400].map((ms) =>
      setTimeout(() => {
        document.getElementById('doc-foto')?.scrollIntoView({ block: 'start' });
      }, ms)
    );
    return () => timers.forEach(clearTimeout);
  }, [data]);

  const obligatorios = DOCUMENTOS.filter((d) => d.obligatorio);
  const opcionales = DOCUMENTOS.filter((d) => !d.obligatorio);
  const totalObligatorios = obligatorios.length;
  const aprobados = data ? obligatorios.filter((d) => data.documentos[d.tipo]?.estado === 'aprobado').length : 0;
  const subidos = data ? obligatorios.filter((d) => !!data.documentos[d.tipo]).length : 0;

  return (
    <EstudianteLayout>
      {/* Header */}
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-guinda-700)] mb-1">
          MI EXPEDIENTE
        </div>
        <h1 data-tour="exp-titulo" className="font-serif text-2xl font-bold text-stone-900">Expediente documental</h1>
        <p className="text-stone-500 text-sm mt-1">
          Tu matrícula y los documentos requeridos para completar tu expediente académico.
        </p>
      </div>

      {loading && <div className="text-center text-stone-400 py-16 text-sm">Cargando expediente…</div>}

      {data && (
        <>
          {/* Matrícula oficial DGB */}
          <MatriculaCard data={data} />

          {/* Progreso */}
          <div data-tour="exp-progreso" className="bg-gradient-to-r from-[var(--color-guinda-800)] to-[var(--color-guinda-600)] text-white rounded-lg p-5 mb-6">
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

          <section data-tour="exp-obligatorios" className="mb-6 scroll-mt-24">
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

            {/* Cédula de inscripción — solo consulta y descarga (la elabora la administración) */}
            <div id="cedula-inscripcion" className="mt-4 bg-white border border-stone-200 rounded-xl overflow-hidden scroll-mt-24">
              <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-[var(--color-crema-100)] text-[var(--color-guinda-700)]">
                    <ClipboardList size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-stone-900">Cédula de inscripción</div>
                    <div className="text-xs text-stone-500">
                      La elabora y actualiza la administración con tus datos; aquí puedes consultarla y descargarla.
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMostrarCedula((v) => !v)}
                    aria-expanded={mostrarCedula}
                    className="inline-flex items-center gap-1.5 border border-stone-300 text-stone-700 font-semibold text-sm px-4 py-2 rounded-lg hover:bg-stone-50 transition-colors"
                  >
                    {mostrarCedula ? <EyeOff size={15} /> : <Eye size={15} />}
                    {mostrarCedula ? 'Ocultar' : 'Ver'}
                  </button>
                  <a
                    href="/api/estudiante/cedula/pdf"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 bg-[var(--color-guinda-700)] text-white font-semibold text-sm px-4 py-2 rounded-lg hover:bg-[var(--color-guinda-800)] transition-colors no-underline"
                  >
                    <Download size={14} /> Descargar PDF
                  </a>
                </div>
              </div>
              {mostrarCedula && (
                <iframe
                  title="Vista previa de la cédula"
                  src="/api/estudiante/cedula/pdf#toolbar=0&view=FitH"
                  className="w-full bg-stone-100"
                  style={{ height: 360 }}
                />
              )}
            </div>
          </section>

          <section id="doc-foto" data-tour="exp-credencial" className="mb-6 scroll-mt-24">
            <h2 className="font-serif text-base font-bold text-stone-900 mb-1">Documentos para la credencial</h2>
            <p className="text-xs text-stone-500 mb-3">
              No son obligatorios para inscribirte, pero tu fotografía se usa para emitir tu credencial (credencial digital).
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

          {/* Ayuda: dudas con el expediente → Mensajes */}
          <div className="mt-6">
            <AyudaMensajes contexto="tu expediente o tus documentos" />
          </div>
        </>
      )}

      <SectionTour
        steps={TOUR_EXPEDIENTE}
        storageKey="edumich_sec_expediente_v1"
        gateKey={GATE_ESTUDIANTE}
        buttonLabel="Tutorial de Expediente"
      />
    </EstudianteLayout>
  );
}
