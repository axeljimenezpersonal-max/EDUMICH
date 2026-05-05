/**
 * Detalle del alumno: datos + documentos + uploader.
 *
 * Ubicación destino: artifacts/student-portal/src/pages/gestor/AlumnoDetalle.tsx
 */

import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useRoute } from 'wouter';
import {
  ArrowLeft,
  Upload,
  FileText,
  Calendar,
  Phone,
  MapPin,
  Mail,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { GestorLayout } from './GestorLayout';
import { api, type AlumnoDetalle as AlumnoDetalleType } from '../../lib/api';
import { StatusBadge } from '../../components/StatusBadge';

const TIPOS_DOCUMENTO = [
  { value: 'curp', label: 'CURP' },
  { value: 'acta', label: 'Acta de nacimiento' },
  { value: 'ine', label: 'Identificación oficial' },
  { value: 'domicilio', label: 'Comprobante de domicilio' },
  { value: 'foto', label: 'Fotografía' },
  { value: 'pago', label: 'Comprobante de pago' },
  { value: 'otro', label: 'Otro' },
];

export default function AlumnoDetalle() {
  const [, params] = useRoute('/gestor/alumnos/:id');
  const [, setLocation] = useLocation();
  const id = params?.id ? Number(params.id) : null;
  const [data, setData] = useState<AlumnoDetalleType | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    try {
      const r = await api.get<AlumnoDetalleType>(`/gestor/alumnos/${id}`);
      setData(r);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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

  const { alumno, inscripciones, documentos } = data;
  const inscripcionActiva = inscripciones[0];

  return (
    <GestorLayout>
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
            <div className="font-mono text-sm text-stone-600">{alumno.curp}</div>
          </div>
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

      {/* Documentos */}
      <div className="bg-white border border-stone-200 rounded-md overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-xl font-bold text-stone-900">
              Documentos
            </h2>
            <p className="text-sm text-stone-600">
              {documentos.length === 0
                ? 'Aún no hay documentos cargados.'
                : `${documentos.length} ${documentos.length === 1 ? 'documento' : 'documentos'} subidos.`}
            </p>
          </div>
          {inscripcionActiva && (
            <UploadDoc inscripcionId={inscripcionActiva.id} alumnoId={alumno.userId} onUploaded={load} />
          )}
        </div>

        {documentos.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-stone-500">
            <FileText size={32} className="mx-auto text-stone-300 mb-2" />
            Sube el primer documento del alumno (CURP, acta, identificación, etc.)
          </div>
        ) : (
          <ul className="divide-y divide-stone-100">
            {documentos.map((d) => (
              <li
                key={d.id}
                className="px-6 py-4 flex items-start gap-4 hover:bg-[var(--color-crema-50)] transition-colors"
              >
                <div className="w-10 h-10 rounded-md bg-[var(--color-crema-100)] flex items-center justify-center text-[var(--color-guinda-700)] flex-shrink-0">
                  <FileText size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-stone-900">{d.nombre}</div>
                  <div className="text-xs text-stone-500 mt-0.5">
                    {d.archivoOriginal} ·{' '}
                    {new Date(d.createdAt).toLocaleDateString('es-MX', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {d.tipoSugerido ? ` · ${d.tipoSugerido}` : ''}
                  </div>
                  {d.comentarioAdmin && (
                    <div className="text-xs text-stone-600 mt-1 italic">
                      Comentario: {d.comentarioAdmin}
                    </div>
                  )}
                </div>
                <StatusBadge estado={d.estado} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </GestorLayout>
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

function UploadDoc({
  inscripcionId,
  alumnoId,
  onUploaded,
}: {
  inscripcionId: number;
  alumnoId: number;
  onUploaded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tipo, setTipo] = useState('curp');
  const [nombre, setNombre] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError('Selecciona un archivo PDF');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('archivo', file);
      fd.append('tipoSugerido', tipo);
      fd.append('nombre', nombre || file.name);
      await api.post(`/gestor/alumnos/${alumnoId}/documentos`, fd);
      setSuccess(true);
      onUploaded();
      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
        setNombre('');
        if (fileRef.current) fileRef.current.value = '';
      }, 1500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="gov-btn-primary inline-flex items-center gap-2"
      >
        <Upload size={16} />
        Subir documento
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="bg-white border border-stone-200 rounded-md shadow-xl w-full max-w-md p-6">
            <h3 className="font-serif text-xl font-bold text-stone-900 mb-1">Subir documento</h3>
            <p className="text-sm text-stone-600 mb-4">
              Quedará en estado <em>Pendiente de revisión</em> hasta que la administración lo apruebe.
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="gov-label">Tipo de documento</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="gov-input"
          >
            {TIPOS_DOCUMENTO.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="gov-label">Nombre (opcional)</label>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="gov-input"
            placeholder="Se usa el nombre del archivo si lo dejas vacío"
          />
        </div>
        <div>
          <label className="gov-label">Archivo PDF</label>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="gov-input file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:bg-[var(--color-crema-200)] file:text-[var(--color-guinda-800)] file:text-sm"
          />
          <div className="text-xs text-stone-500 mt-1">Solo PDF, máximo 10 MB</div>
        </div>
        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </div>
        )}
        {success && (
          <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2 flex items-center gap-2">
            <CheckCircle2 size={16} />
            Documento subido. Queda pendiente de revisión.
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={loading}
            className="gov-btn-primary flex-1 inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
            {loading ? 'Subiendo...' : 'Subir'}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setError(null);
            }}
            className="gov-btn-secondary"
          >
            Cancelar
          </button>
        </div>
      </form>
          </div>
        </div>
      )}
    </>
  );
}
