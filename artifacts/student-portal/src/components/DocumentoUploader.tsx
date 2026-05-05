/**
 * DocumentoUploader — tarjeta de documento con upload, preview y descarga.
 * Usada tanto en Mi Expediente (estudiante) como en AlumnoDetalle (gestor).
 */
import { useRef, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  XCircle,
  Upload,
  Eye,
  Download,
  FileText,
  AlertCircle,
  X,
} from 'lucide-react';
import type { TipoDocumento, DocExpediente } from '../lib/api';

interface Endpoints {
  upload: string;
  preview: string;
  descargar: string;
}

interface Props {
  tipo: TipoDocumento;
  label: string;
  descripcion: string;
  isRequired: boolean;
  doc: DocExpediente | undefined;
  endpoints: Endpoints;
  acceptImages?: boolean;
  onUploaded: () => void;
}

function EstadoPill({ estado }: { estado: DocExpediente['estado'] }) {
  if (estado === 'aprobado')
    return (
      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">
        <CheckCircle2 size={11} /> Aprobado
      </span>
    );
  if (estado === 'rechazado')
    return (
      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">
        <XCircle size={11} /> Rechazado
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">
      <Clock size={11} /> En revisión
    </span>
  );
}

export default function DocumentoUploader({
  label,
  descripcion,
  isRequired,
  doc,
  endpoints,
  acceptImages = false,
  onUploaded,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const acceptAttr = acceptImages
    ? 'application/pdf,image/jpeg,image/png'
    : 'application/pdf';

  async function handleFile(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append('archivo', file);
      const res = await fetch(endpoints.upload, {
        method: 'POST',
        body: fd,
        credentials: 'include',
      });
      if (!res.ok) {
        let msg = `${res.status}`;
        try { const j = await res.json(); msg = j.error || msg; } catch {}
        throw new Error(msg);
      }
      onUploaded();
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : 'Error al subir');
    } finally {
      setUploading(false);
    }
  }

  const iconBg = doc?.estado === 'aprobado'
    ? 'bg-green-50'
    : doc?.estado === 'rechazado'
    ? 'bg-red-50'
    : doc
    ? 'bg-amber-50'
    : 'bg-stone-100';

  const iconColor = doc?.estado === 'aprobado'
    ? 'text-green-600'
    : doc?.estado === 'rechazado'
    ? 'text-red-500'
    : doc
    ? 'text-amber-600'
    : 'text-stone-400';

  return (
    <>
      <div className="bg-white border border-stone-200 rounded-lg p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Icon + info */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
              <FileText size={16} className={iconColor} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-stone-900">{label}</span>
                {isRequired ? (
                  <span className="text-[10px] text-[var(--color-guinda-700)] font-semibold uppercase tracking-widest">
                    Obligatorio
                  </span>
                ) : (
                  <span className="text-[10px] text-stone-400 font-semibold uppercase tracking-widest">
                    Opcional
                  </span>
                )}
                {doc && <EstadoPill estado={doc.estado} />}
              </div>
              <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">{descripcion}</p>
              {doc && (
                <p className="text-[11px] text-stone-400 mt-1 truncate max-w-[220px]">
                  {doc.nombreOriginal}
                  {doc.tamanoBytes ? ` · ${(doc.tamanoBytes / 1024).toFixed(0)} KB` : ''}
                </p>
              )}
              {doc?.estado === 'rechazado' && doc.motivoRechazo && (
                <div className="mt-2 flex items-start gap-1.5 text-xs text-red-600 bg-red-50 rounded p-2">
                  <AlertCircle size={12} className="mt-0.5 shrink-0" />
                  {doc.motivoRechazo}
                </div>
              )}
              {uploadError && (
                <div className="mt-2 flex items-start gap-1.5 text-xs text-red-600 bg-red-50 rounded p-2">
                  <AlertCircle size={12} className="mt-0.5 shrink-0" />
                  {uploadError}
                  <button
                    onClick={() => setUploadError(null)}
                    className="ml-auto shrink-0 text-red-400"
                  >
                    <X size={11} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {doc && doc.estado !== 'rechazado' && (
              <button
                onClick={() => setPreviewOpen(true)}
                title="Vista previa"
                className="p-1.5 rounded hover:bg-stone-100 text-stone-500 hover:text-stone-700 transition-colors"
              >
                <Eye size={15} />
              </button>
            )}
            {doc && (
              <a
                href={endpoints.descargar}
                title="Descargar"
                className="p-1.5 rounded hover:bg-stone-100 text-stone-500 hover:text-stone-700 transition-colors"
              >
                <Download size={15} />
              </a>
            )}
            {doc?.estado !== 'aprobado' && (
              <button
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                title={doc ? 'Reemplazar' : 'Subir'}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors ${
                  uploading
                    ? 'bg-stone-100 text-stone-400 cursor-not-allowed'
                    : 'bg-[var(--color-guinda-700)] text-white hover:bg-[var(--color-guinda-800)]'
                }`}
              >
                <Upload size={12} />
                {uploading ? 'Subiendo…' : doc ? 'Reemplazar' : acceptImages ? 'Subir archivo' : 'Subir PDF'}
              </button>
            )}
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={acceptAttr}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
      </div>

      {/* Preview modal */}
      {previewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-3xl h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200">
              <span className="font-semibold text-stone-800 text-sm">{label}</span>
              <button
                onClick={() => setPreviewOpen(false)}
                className="p-1 rounded hover:bg-stone-100 text-stone-500"
              >
                <X size={18} />
              </button>
            </div>
            <iframe
              src={endpoints.preview}
              className="flex-1 w-full border-0"
              title={`Vista previa: ${label}`}
            />
          </div>
        </div>
      )}
    </>
  );
}
