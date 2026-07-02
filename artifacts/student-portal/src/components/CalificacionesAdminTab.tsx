import { useEffect, useRef, useState } from 'react';
import { Upload, Download, RefreshCw, Loader2, FileText, CheckCircle2 } from 'lucide-react';
import { api, type CalificacionesResponse } from '../lib/api';

/**
 * Calificaciones (admin): la administración SUBE un PDF de calificaciones por
 * alumno. Preview horizontal (arriba, ancho completo) + descarga + reemplazo.
 */
export function CalificacionesAdminTab({ estudianteId }: { estudianteId: number }) {
  const [disponible, setDisponible] = useState(false);
  const [subidoEn, setSubidoEn] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  function cargar() {
    return api
      .get<CalificacionesResponse>(`/calificaciones/estudiantes/${estudianteId}`)
      .then((r) => {
        setDisponible(!!r.pdfOficial?.disponible);
        setSubidoEn(r.pdfOficial?.subidoEn ?? null);
      })
      .catch(() => {});
  }

  useEffect(() => {
    cargar().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estudianteId]);

  async function subir(file: File) {
    if (file.type !== 'application/pdf') { setError('Solo se acepta PDF.'); return; }
    setSubiendo(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('archivo', file);
      await api.post(`/admin/alumnos/${estudianteId}/calificaciones-pdf`, fd);
      await cargar();
      setPreviewKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir el PDF');
    } finally {
      setSubiendo(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  if (loading) return <div className="text-center text-stone-400 py-12 text-sm">Cargando…</div>;

  return (
    <div className="space-y-4">
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) subir(f); }}
      />

      {!disponible ? (
        // Sin PDF: zona de carga
        <label
          className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-stone-300 rounded-xl py-12 cursor-pointer hover:border-[var(--color-guinda-700)] hover:bg-stone-50 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          {subiendo ? <Loader2 size={28} className="animate-spin text-[var(--color-guinda-700)]" /> : <Upload size={28} className="text-stone-400" />}
          <div className="text-sm font-semibold text-stone-700">
            {subiendo ? 'Subiendo…' : 'Subir PDF de calificaciones'}
          </div>
          <div className="text-xs text-stone-500">La administración carga el documento oficial de calificaciones (PDF).</div>
        </label>
      ) : (
        <>
          {/* Barra de acciones */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm text-emerald-700 font-semibold">
              <CheckCircle2 size={16} /> Calificaciones cargadas
              {subidoEn && (
                <span className="text-xs text-stone-400 font-normal">
                  · {new Date(subidoEn).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPreviewKey((k) => k + 1)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors"
              >
                <RefreshCw size={13} /> Actualizar
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={subiendo}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors disabled:opacity-50"
              >
                {subiendo ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Reemplazar
              </button>
              <a
                href={`/api/calificaciones/estudiantes/${estudianteId}/pdf-oficial`}
                download=""
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--color-guinda-700)] text-white hover:bg-[var(--color-guinda-800)] transition-colors"
              >
                <Download size={13} /> Descargar
              </a>
            </div>
          </div>

          {/* Preview horizontal, ancho completo */}
          <iframe
            key={previewKey}
            title="Calificaciones"
            src={`/api/calificaciones/estudiantes/${estudianteId}/pdf-oficial?v=${previewKey}`}
            className="w-full border border-stone-200 rounded-xl bg-stone-100"
            style={{ height: 560 }}
          />
        </>
      )}

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 flex items-center gap-1.5">
          <FileText size={13} /> {error}
        </div>
      )}
    </div>
  );
}
