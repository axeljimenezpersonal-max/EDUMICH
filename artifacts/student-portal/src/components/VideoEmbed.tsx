/**
 * Embed de YouTube compartido (aula del gestor y del alumno).
 * Usa youtube-nocookie + referrerPolicy explícito y los permisos que exige el
 * reproductor: sin ellos YouTube marca "Error 153" (configuración del reproductor).
 */
export function ytEmbed(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
  return m ? `https://www.youtube-nocookie.com/embed/${m[1]}` : null;
}

export function VideoFrame({ src, titulo }: { src: string; titulo: string }) {
  return (
    <iframe
      src={src} title={titulo} className="h-full w-full"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      referrerPolicy="strict-origin-when-cross-origin"
      allowFullScreen
    />
  );
}
