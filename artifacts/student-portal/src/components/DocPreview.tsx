/**
 * Vista previa de documentos del aula (estilo Canvas): las imágenes y PDFs se
 * muestran directamente en la página; cualquier archivo se puede bajar con el
 * botón "Descargar". La URL debe aceptar `?inline=1` para servir el archivo
 * con Content-Disposition inline (vista previa) — sin el parámetro descarga.
 */
import { FileText, Download, ExternalLink } from 'lucide-react';

const ES_IMAGEN = /\.(png|jpe?g|webp|gif)$/i;
const ES_PDF = /\.pdf$/i;

export function DocPreview({ url, nombre }: { url: string; nombre: string }) {
  const inlineUrl = `${url}?inline=1`;
  const esImagen = ES_IMAGEN.test(nombre);
  const esPdf = ES_PDF.test(nombre);

  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
      {/* Vista previa (imagen o PDF); otros tipos solo muestran la barra */}
      {esImagen && (
        <a href={inlineUrl} target="_blank" rel="noreferrer" title="Ver en tamaño completo" className="block bg-stone-50">
          <img src={inlineUrl} alt={nombre} loading="lazy" className="mx-auto max-h-80 w-auto object-contain" />
        </a>
      )}
      {esPdf && (
        <iframe src={inlineUrl} title={nombre} className="w-full bg-stone-50" style={{ height: 420, border: 0 }} />
      )}

      {/* Barra: nombre + acciones */}
      <div className={`flex items-center gap-2 px-3 py-2 ${esImagen || esPdf ? 'border-t border-stone-100' : ''}`}>
        <FileText size={16} className="shrink-0" style={{ color: 'var(--color-guinda-700)' }} />
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-stone-700">{nombre}</span>
        {(esImagen || esPdf) && (
          <a href={inlineUrl} target="_blank" rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-[11px] font-semibold text-stone-600 hover:bg-stone-50"
            title="Abrir en pestaña nueva">
            <ExternalLink size={12} /> Abrir
          </a>
        )}
        <a href={url}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-white"
          style={{ background: 'var(--color-guinda-700)' }}>
          <Download size={12} /> Descargar
        </a>
      </div>
    </div>
  );
}
