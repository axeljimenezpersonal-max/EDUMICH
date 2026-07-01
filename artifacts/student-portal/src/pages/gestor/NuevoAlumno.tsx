import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import {
  ArrowLeft,
  UserPlus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  CreditCard,
  FileBadge,
  MapPin,
  GraduationCap,
} from 'lucide-react';
import { format } from 'date-fns';
import { GestorLayout } from './GestorLayout';
import { DatePicker } from '../../components/DatePicker';
import { CurpHelpLink } from '../../components/CurpHelpLink';
import { api, type Convocatoria } from '../../lib/api';

// ── Types ──────────────────────────────────────────────────────────────────

interface DatosPersonales {
  nombreCompleto: string;
  curp: string;
  email: string;
  telefono: string;
  fechaNacimiento: Date | undefined;
  direccion: string;
}

type DocKey = 'curp' | 'acta' | 'ine' | 'domicilio' | 'certificado';

interface Archivos {
  curp: File | null;
  acta: File | null;
  ine: File | null;
  domicilio: File | null;
  certificado: File | null;
}

interface RegistroExito {
  alumno: { userId: number; nombreCompleto: string; email: string; curp: string };
  inscripcionId: number;
  credencialTemporal: string;
  documentos: Array<{ id: number; nombre: string; tipoSugerido: string | null }>;
}

const DOC_DEFS: Array<{
  key: DocKey;
  nombre: string;
  subtitulo: string;
  fieldName: string;
  icon: React.ReactNode;
}> = [
  {
    key: 'curp',
    nombre: 'CURP',
    subtitulo: 'Hoja de CURP vigente',
    fieldName: 'doc_curp',
    icon: <FileText size={20} />,
  },
  {
    key: 'acta',
    nombre: 'Acta de nacimiento',
    subtitulo: 'Acta original o digitalizada',
    fieldName: 'doc_acta',
    icon: <FileBadge size={20} />,
  },
  {
    key: 'ine',
    nombre: 'Identificación oficial',
    subtitulo: 'INE / IFE vigente',
    fieldName: 'doc_ine',
    icon: <CreditCard size={20} />,
  },
  {
    key: 'domicilio',
    nombre: 'Comprobante de domicilio',
    subtitulo: 'No mayor a 3 meses',
    fieldName: 'doc_domicilio',
    icon: <MapPin size={20} />,
  },
  {
    key: 'certificado',
    nombre: 'Certificado de secundaria',
    subtitulo: 'Certificado o constancia (ambos lados)',
    fieldName: 'doc_certificado',
    icon: <GraduationCap size={20} />,
  },
];

const DATOS_INIT: DatosPersonales = {
  nombreCompleto: '',
  curp: '',
  email: '',
  telefono: '',
  fechaNacimiento: undefined,
  direccion: '',
};

const ARCHIVOS_INIT: Archivos = { curp: null, acta: null, ine: null, domicilio: null, certificado: null };

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function emailValido(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

// ── Step indicator ─────────────────────────────────────────────────────────

function StepPill({
  num,
  label,
  active,
  done,
}: {
  num: number;
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
        done
          ? 'bg-green-100 text-green-700'
          : active
          ? 'bg-[var(--color-guinda-700)] text-white'
          : 'bg-stone-100 text-stone-400'
      }`}
    >
      {done ? (
        <CheckCircle2 size={14} />
      ) : (
        <span className="w-4 h-4 flex items-center justify-center rounded-full border border-current text-xs">
          {num}
        </span>
      )}
      {label}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function NuevoAlumno() {
  const [, setLocation] = useLocation();

  const [conv, setConv] = useState<Convocatoria | null>(null);
  const [convCargando, setConvCargando] = useState(true);

  const [paso, setPaso] = useState<1 | 2>(1);
  const [datos, setDatos] = useState<DatosPersonales>(DATOS_INIT);
  const [archivos, setArchivos] = useState<Archivos>(ARCHIVOS_INIT);
  const [dragOver, setDragOver] = useState<Partial<Record<DocKey, boolean>>>({});
  const [fileErrors, setFileErrors] = useState<Partial<Record<DocKey, string>>>({});

  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ curp?: string; email?: string }>({});
  const [exito, setExito] = useState<RegistroExito | null>(null);
  const [mostrarModalSinDocs, setMostrarModalSinDocs] = useState(false);

  // One ref per file input
  const inputRefs = useRef<Record<DocKey, HTMLInputElement | null>>({
    curp: null,
    acta: null,
    ine: null,
    domicilio: null,
    certificado: null,
  });

  // ── Fetch convocatoria ───────────────────────────────────────────────
  useEffect(() => {
    api
      .get<{ convocatoria: Convocatoria | null }>('/gestor/convocatoria-activa')
      .then((r) => setConv(r.convocatoria))
      .finally(() => setConvCargando(false));
  }, []);

  // ── Beforeunload ─────────────────────────────────────────────────────
  const hayProgreso =
    datos.nombreCompleto.trim() !== '' ||
    datos.curp !== '' ||
    archivos.curp !== null ||
    archivos.acta !== null ||
    archivos.ine !== null ||
    archivos.domicilio !== null ||
    archivos.certificado !== null;

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hayProgreso) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hayProgreso]);

  // ── Navigation guard ─────────────────────────────────────────────────
  function handleSalir() {
    if (hayProgreso) {
      const ok = window.confirm(
        '¿Salir sin guardar? Se perderá toda la información capturada y el alumno NO quedará registrado.'
      );
      if (!ok) return;
    }
    setLocation('/gestor/alumnos');
  }

  // ── File processing ──────────────────────────────────────────────────
  function showFileError(key: DocKey, msg: string) {
    setFileErrors((prev) => ({ ...prev, [key]: msg }));
    setTimeout(() => setFileErrors((prev) => { const next = { ...prev }; delete next[key]; return next; }), 4000);
  }

  function processFile(file: File, key: DocKey) {
    if (file.type !== 'application/pdf') {
      showFileError(key, 'Solo se aceptan archivos PDF');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showFileError(key, 'El archivo supera el límite de 10 MB');
      return;
    }
    setArchivos((prev) => ({ ...prev, [key]: file }));
  }

  // ── Step 1 validation ────────────────────────────────────────────────
  const paso1Valid =
    datos.nombreCompleto.trim().length > 0 &&
    datos.curp.length === 18 &&
    emailValido(datos.email) &&
    conv !== null &&
    !fieldErrors.curp &&
    !fieldErrors.email;

  // ── Step 2 counters ──────────────────────────────────────────────────
  const faltanCount = ([archivos.curp, archivos.acta, archivos.ine, archivos.domicilio, archivos.certificado] as (File | null)[]).filter(
    (f) => !f
  ).length;

  const btnLabel =
    faltanCount === 0
      ? 'Mandar a validar'
      : `Faltan ${faltanCount} documento${faltanCount > 1 ? 's' : ''}`;

  // ── Manejar errores de unicidad (409) ────────────────────────────────
  function handleConflictError(err: unknown) {
    const msg = (err as Error).message ?? '';
    // La API devuelve { error, campo } en 409 — el cliente de api lanza el mensaje
    if (msg.includes('correo') || msg.toLowerCase().includes('email')) {
      setFieldErrors((prev) => ({ ...prev, email: msg }));
      setPaso(1);
    } else if (msg.includes('CURP') || msg.toLowerCase().includes('curp')) {
      setFieldErrors((prev) => ({ ...prev, curp: msg }));
      setPaso(1);
    } else {
      setSubmitError(msg);
    }
  }

  // ── Submit ───────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!conv || faltanCount > 0) return;
    setLoading(true);
    setSubmitError(null);
    setFieldErrors({});

    const fd = new FormData();
    fd.append('nombreCompleto', datos.nombreCompleto.trim());
    fd.append('curp', datos.curp.toUpperCase());
    fd.append('email', datos.email.toLowerCase());
    fd.append('telefono', datos.telefono);
    if (datos.fechaNacimiento) fd.append('fechaNacimiento', format(datos.fechaNacimiento, 'yyyy-MM-dd'));
    fd.append('direccion', datos.direccion);
    fd.append('convocatoriaId', String(conv.id));
    fd.append('doc_curp', archivos.curp!);
    fd.append('doc_acta', archivos.acta!);
    fd.append('doc_ine', archivos.ine!);
    fd.append('doc_domicilio', archivos.domicilio!);
    fd.append('doc_certificado', archivos.certificado!);

    try {
      const r = await api.post<RegistroExito>('/gestor/alumnos/registro-completo', fd);
      setExito(r);
    } catch (err) {
      handleConflictError(err);
    } finally {
      setLoading(false);
    }
  }

  // ── Guardar sin documentos completos ─────────────────────────────────
  async function handleGuardarSinDocs() {
    if (!conv) return;
    setMostrarModalSinDocs(false);
    setLoading(true);
    setSubmitError(null);
    setFieldErrors({});

    const fd = new FormData();
    fd.append('nombreCompleto', datos.nombreCompleto.trim());
    fd.append('curp', datos.curp.toUpperCase());
    fd.append('email', datos.email.toLowerCase());
    fd.append('telefono', datos.telefono);
    if (datos.fechaNacimiento) fd.append('fechaNacimiento', format(datos.fechaNacimiento, 'yyyy-MM-dd'));
    fd.append('direccion', datos.direccion);
    fd.append('convocatoriaId', String(conv.id));
    if (archivos.curp) fd.append('doc_curp', archivos.curp);
    if (archivos.acta) fd.append('doc_acta', archivos.acta);
    if (archivos.ine) fd.append('doc_ine', archivos.ine);
    if (archivos.domicilio) fd.append('doc_domicilio', archivos.domicilio);
    if (archivos.certificado) fd.append('doc_certificado', archivos.certificado);

    try {
      const r = await api.post<RegistroExito>('/gestor/alumnos/registro-completo', fd);
      sessionStorage.setItem(
        'gestor_toast',
        JSON.stringify({
          msg: `${r.alumno.nombreCompleto} registrado. Recuerda subir los documentos faltantes (${faltanCount} pendiente${faltanCount > 1 ? 's' : ''}).`,
          type: 'warning',
        })
      );
      setLocation('/gestor/alumnos');
    } catch (err) {
      handleConflictError(err);
    } finally {
      setLoading(false);
    }
  }

  // ── Success screen ───────────────────────────────────────────────────
  if (exito) {
    return (
      <GestorLayout>
        <button
          onClick={() => setLocation('/gestor/alumnos')}
          className="text-sm text-stone-600 hover:text-[var(--color-guinda-700)] inline-flex items-center gap-1.5 mb-6"
        >
          <ArrowLeft size={14} />
          Volver a mis alumnos
        </button>

        <div className="gov-card p-8 max-w-2xl">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center text-green-700 mb-5">
            <CheckCircle2 size={26} />
          </div>
          <h1 className="font-serif text-2xl font-bold text-stone-900 mb-2">
            Alumno registrado correctamente
          </h1>
          <p className="text-stone-600 mb-6">
            <strong>{exito.alumno.nombreCompleto}</strong> fue registrado e inscrito a la
            convocatoria activa con sus documentos enviados.
          </p>

          {/* Credenciales */}
          <div className="bg-[var(--color-crema-100)] border border-stone-200 rounded-md p-4 mb-4">
            <div className="text-xs uppercase tracking-widest text-stone-500 font-semibold mb-2">
              Credenciales temporales
            </div>
            <div className="space-y-1 text-sm font-mono">
              <div>
                <span className="text-stone-500">Correo:</span>{' '}
                <span className="text-stone-900">{exito.alumno.email}</span>
              </div>
              <div>
                <span className="text-stone-500">Contraseña:</span>{' '}
                <span className="text-stone-900">{exito.credencialTemporal}</span>
              </div>
            </div>
            <div className="text-xs text-stone-500 mt-2">
              El alumno deberá cambiarla en su primer ingreso.
            </div>
          </div>

          {/* Documentos subidos */}
          <div className="border border-stone-200 rounded-md p-4 mb-6">
            <div className="text-xs uppercase tracking-widest text-stone-500 font-semibold mb-3">
              Documentos enviados
            </div>
            <div className="space-y-2">
              {exito.documentos.map((doc) => (
                <div key={doc.id} className="flex items-center gap-2 text-sm text-stone-700">
                  <CheckCircle2 size={14} className="text-green-600 flex-shrink-0" />
                  {doc.nombre}
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-start gap-1.5 text-xs text-stone-500">
              <AlertCircle size={12} className="flex-shrink-0 mt-px" />
              <span>
                Los documentos quedaron en estado{' '}
                <strong>Pendiente de revisión</strong>. La administración los validará en
                los próximos días.
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setLocation(`/gestor/alumnos/${exito.alumno.userId}`)}
              className="gov-btn-primary"
            >
              Ver detalle del alumno
            </button>
            <button
              onClick={() => {
                setExito(null);
                setDatos(DATOS_INIT);
                setArchivos(ARCHIVOS_INIT);
                setPaso(1);
              }}
              className="gov-btn-secondary"
            >
              Registrar otro alumno
            </button>
          </div>
        </div>
      </GestorLayout>
    );
  }

  // ── Wizard ───────────────────────────────────────────────────────────
  return (
    <GestorLayout>
      {/* Back */}
      <button
        onClick={handleSalir}
        className="text-sm text-stone-600 hover:text-[var(--color-guinda-700)] inline-flex items-center gap-1.5 mb-4"
      >
        <ArrowLeft size={14} />
        Volver a mis alumnos
      </button>

      {/* Header */}
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[var(--color-guinda-700)] font-semibold mb-1">
        <UserPlus size={12} />
        Nuevo alumno
      </div>
      <h1 className="font-serif text-3xl font-bold text-stone-900 mb-4">
        Registrar nuevo alumno
      </h1>

      {/* Convocatoria banner */}
      {!convCargando && (
        conv ? (
          <div className="bg-[var(--color-crema-100)] border border-stone-200 rounded-md px-4 py-3 mb-5 text-sm flex items-center gap-2">
            <span className="text-stone-500 uppercase tracking-widest text-xs font-semibold">
              Inscripción a:
            </span>
            <strong className="text-stone-800">{conv.nombre}</strong>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-4 py-3 mb-5">
            <AlertCircle size={15} />
            No hay una convocatoria activa. No es posible registrar alumnos en este momento.
          </div>
        )
      )}

      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-6">
        <StepPill num={1} label="Datos personales" active={paso === 1} done={paso > 1} />
        <div className="h-px w-10 bg-stone-300" />
        <StepPill num={2} label="Documentos" active={paso === 2} done={false} />
      </div>

      {/* ── PASO 1: Datos personales ─────────────────────────────────── */}
      {paso === 1 && (
        <div className="gov-card p-6 max-w-3xl space-y-5">
          <div>
            <label className="gov-label" htmlFor="nombre">
              Nombre completo <span className="text-red-600">*</span>
            </label>
            <input
              id="nombre"
              value={datos.nombreCompleto}
              onChange={(e) => setDatos((d) => ({ ...d, nombreCompleto: e.target.value }))}
              className="gov-input"
              placeholder="Ej. Ana María González Pérez"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="gov-label" htmlFor="curp">
                CURP <span className="text-red-600">*</span>
              </label>
              <input
                id="curp"
                maxLength={18}
                value={datos.curp}
                onChange={(e) => {
                  setDatos((d) => ({ ...d, curp: e.target.value.toUpperCase() }));
                  if (fieldErrors.curp) setFieldErrors((prev) => ({ ...prev, curp: undefined }));
                }}
                className={`gov-input font-mono uppercase ${fieldErrors.curp ? 'border-red-500 focus:ring-red-400' : ''}`}
                placeholder="GOPA950315MMNNRN09"
              />
              {fieldErrors.curp ? (
                <div className="flex items-center gap-1.5 text-xs text-red-700 mt-1">
                  <AlertCircle size={12} className="flex-shrink-0" />
                  {fieldErrors.curp}
                </div>
              ) : (
                <div
                  className={`text-xs mt-1 ${
                    datos.curp.length === 18
                      ? 'text-green-600'
                      : datos.curp.length > 0
                      ? 'text-amber-600'
                      : 'text-stone-500'
                  }`}
                >
                  {datos.curp.length}/18 caracteres
                </div>
              )}
              <CurpHelpLink />
            </div>
            <div>
              <label className="gov-label" htmlFor="fnac">
                Fecha de nacimiento
              </label>
              <DatePicker
                id="fnac"
                value={datos.fechaNacimiento}
                onChange={(d) => setDatos((prev) => ({ ...prev, fechaNacimiento: d }))}
                maxDate={new Date()}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="gov-label" htmlFor="email">
                Correo electrónico <span className="text-red-600">*</span>
              </label>
              <input
                id="email"
                type="email"
                value={datos.email}
                onChange={(e) => {
                  setDatos((d) => ({ ...d, email: e.target.value }));
                  if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                }}
                className={`gov-input ${fieldErrors.email ? 'border-red-500 focus:ring-red-400' : ''}`}
                placeholder="alumno@correo.com"
              />
              {fieldErrors.email && (
                <div className="flex items-center gap-1.5 text-xs text-red-700 mt-1">
                  <AlertCircle size={12} className="flex-shrink-0" />
                  {fieldErrors.email}
                </div>
              )}
            </div>
            <div>
              <label className="gov-label" htmlFor="tel">
                Teléfono
              </label>
              <input
                id="tel"
                value={datos.telefono}
                onChange={(e) => setDatos((d) => ({ ...d, telefono: e.target.value }))}
                className="gov-input"
                placeholder="434-123-4567"
              />
            </div>
          </div>

          <div>
            <label className="gov-label" htmlFor="dir">
              Dirección
            </label>
            <textarea
              id="dir"
              rows={2}
              value={datos.direccion}
              onChange={(e) => setDatos((d) => ({ ...d, direccion: e.target.value }))}
              className="gov-input"
              placeholder="Calle, número, colonia..."
            />
          </div>

          <div className="pt-2">
            <button
              onClick={() => setPaso(2)}
              disabled={!paso1Valid}
              className="gov-btn-primary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continuar →
            </button>
            {!paso1Valid && datos.nombreCompleto.trim().length > 0 && (
              <span className="ml-3 text-xs text-stone-500">
                {fieldErrors.curp
                  ? 'Corrige el CURP antes de continuar'
                  : fieldErrors.email
                  ? 'Corrige el correo antes de continuar'
                  : datos.curp.length < 18
                  ? 'Completa los 18 caracteres de la CURP'
                  : !emailValido(datos.email)
                  ? 'Ingresa un correo válido'
                  : !conv
                  ? 'No hay convocatoria activa'
                  : ''}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── PASO 2: Documentos ───────────────────────────────────────── */}
      {paso === 2 && (
        <div className="max-w-3xl space-y-5">
          {/* Resumen paso 1 */}
          <div className="gov-card p-4 flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="font-semibold text-stone-900">{datos.nombreCompleto}</div>
              <div className="font-mono text-sm text-stone-600 tracking-wide">
                {datos.curp}
              </div>
              <div className="text-sm text-stone-500">
                {datos.email}
                {datos.telefono && ` · ${datos.telefono}`}
                {datos.fechaNacimiento && ` · Nac. ${format(datos.fechaNacimiento, 'dd/MM/yyyy')}`}
              </div>
            </div>
            <button
              onClick={() => setPaso(1)}
              className="text-xs text-[var(--color-guinda-700)] hover:underline font-medium flex-shrink-0"
            >
              Editar datos
            </button>
          </div>

          {/* Zonas de upload en grid 2×2 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {DOC_DEFS.map(({ key, nombre, subtitulo, icon }) => {
              const archivo = archivos[key];
              const isDragOver = !!dragOver[key];
              const error = fileErrors[key];

              return (
                <div key={key}>
                  {/* Hidden input */}
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    ref={(el) => { inputRefs.current[key] = el; }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) processFile(f, key);
                      e.target.value = '';
                    }}
                  />

                  <div
                    onClick={() => !archivo && inputRefs.current[key]?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver((p) => ({ ...p, [key]: true }));
                    }}
                    onDragLeave={() => setDragOver((p) => ({ ...p, [key]: false }))}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver((p) => ({ ...p, [key]: false }));
                      const f = e.dataTransfer.files[0];
                      if (f) processFile(f, key);
                    }}
                    className={`rounded-md border-2 p-4 transition-colors min-h-[120px] flex flex-col
                      ${archivo
                        ? 'border-green-400 bg-green-50 cursor-default'
                        : isDragOver
                        ? 'border-[var(--color-guinda-500)] bg-[var(--color-guinda-50)] cursor-copy'
                        : 'border-dashed border-stone-300 bg-white hover:border-[var(--color-guinda-400)] hover:bg-[var(--color-crema-50)] cursor-pointer'
                      }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`${archivo ? 'text-green-600' : 'text-[var(--color-guinda-700)]'}`}
                      >
                        {archivo ? <CheckCircle2 size={20} /> : icon}
                      </span>
                      <div>
                        <div className="text-sm font-semibold text-stone-800">{nombre}</div>
                        <div className="text-xs text-stone-500">{subtitulo} · PDF · máx 10 MB</div>
                      </div>
                    </div>

                    {archivo ? (
                      <div className="mt-auto">
                        <div className="text-xs text-green-700 font-medium truncate">
                          {archivo.name}
                        </div>
                        <div className="text-xs text-stone-500">{fmtSize(archivo.size)}</div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            inputRefs.current[key]?.click();
                          }}
                          className="mt-1 text-xs text-[var(--color-guinda-700)] hover:underline"
                        >
                          Reemplazar
                        </button>
                      </div>
                    ) : (
                      <div className="mt-auto text-xs text-stone-400 text-center pt-2">
                        {isDragOver
                          ? 'Suelta el PDF aquí'
                          : 'Arrastra el PDF aquí o haz click'}
                      </div>
                    )}
                  </div>

                  {/* Inline error toast */}
                  {error && (
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                      <AlertCircle size={11} />
                      {error}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Error global */}
          {submitError && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
              {submitError}
            </div>
          )}

          {/* Botones */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={() => setPaso(1)}
              className="gov-btn-secondary inline-flex items-center gap-1.5"
            >
              <ArrowLeft size={14} />
              Volver al paso 1
            </button>

            {faltanCount > 0 && (
              <button
                onClick={() => setMostrarModalSinDocs(true)}
                disabled={loading || !conv}
                className="gov-btn-secondary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Guardar y subir docs después
              </button>
            )}

            <button
              onClick={handleSubmit}
              disabled={faltanCount > 0 || loading || !conv}
              className="gov-btn-primary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Registrando...
                </>
              ) : (
                btnLabel
              )}
            </button>
          </div>
        </div>
      )}

      {/* Modal: guardar sin documentos completos */}
      {mostrarModalSinDocs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="font-serif text-xl font-bold text-stone-900 mb-2">
              ¿Guardar sin todos los documentos?
            </h3>
            <p className="text-sm text-stone-600 mb-4">
              El alumno quedará registrado, pero deberás subir los documentos faltantes antes de que pueda ser validado.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-4">
              <div className="text-xs uppercase tracking-widest text-amber-700 font-semibold mb-2">
                Documentos faltantes ({faltanCount})
              </div>
              <div className="space-y-1">
                {DOC_DEFS.filter((d) => !archivos[d.key]).map((d) => (
                  <div key={d.key} className="flex items-center gap-2 text-sm text-amber-800">
                    <AlertCircle size={13} className="flex-shrink-0" />
                    {d.nombre}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setMostrarModalSinDocs(false)}
                className="gov-btn-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardarSinDocs}
                disabled={loading}
                className="gov-btn-primary inline-flex items-center gap-2 disabled:opacity-50"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                Sí, guardar sin documentos
              </button>
            </div>
          </div>
        </div>
      )}
    </GestorLayout>
  );
}
