/**
 * ChatAdjunto — muestra el adjunto de un mensaje con preview (sin descarga).
 * - Imagen: miniatura que abre el preview en una pestaña nueva.
 * - PDF/otros: chip "Ver documento" que abre el preview inline.
 */

import { FileText, Eye } from 'lucide-react';

export function ChatAdjunto({
  previewUrl, mime, nombre, mio,
}: {
  previewUrl: string;
  mime?: string | null;
  nombre?: string | null;
  mio: boolean;
}) {
  const esImagen = (mime ?? '').startsWith('image/');

  if (esImagen) {
    return (
      <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block">
        <img
          src={previewUrl}
          alt={nombre ?? 'Imagen'}
          className="max-h-56 w-auto max-w-full rounded-lg border border-black/10 object-cover"
          loading="lazy"
        />
      </a>
    );
  }

  return (
    <a
      href={previewUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1 flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors"
      style={
        mio
          ? { background: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.25)', color: '#fff' }
          : { background: '#faf7f2', borderColor: '#eaddd0', color: '#292524' }
      }
    >
      <FileText size={18} className="flex-shrink-0" style={{ opacity: 0.85 }} />
      <span className="min-w-0 flex-1 truncate">{nombre ?? 'Documento'}</span>
      <Eye size={14} className="flex-shrink-0" style={{ opacity: 0.8 }} />
    </a>
  );
}
