/**
 * Corrige el nombre original de un archivo subido con multer/busboy.
 * Por defecto busboy interpreta el nombre como latin1, así que un archivo con
 * acentos ("Autorización.pdf") llega como mojibake ("AutorizaciÃ³n.pdf").
 * Re-decodificar latin1→utf8 lo arregla; para nombres ASCII es un no-op.
 */
export function nombreArchivoUtf8(name: string | undefined | null): string {
  if (!name) return '';
  try {
    return Buffer.from(name, 'latin1').toString('utf8');
  } catch {
    return name;
  }
}
