import { aplanarAcentos } from './nombreArchivo';

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

/**
 * El nombre con el que se GUARDA un archivo subido: ASCII, siempre.
 *
 * Quien revisa la base o baja los archivos lo hace desde herramientas que no
 * todas respetan UTF-8, y un `Acta Muñoz.pdf` llega roto o no llega. El orden
 * importa: primero se arregla el mojibake de multer, después se aplanan los
 * acentos a su letra base, y solo al final se sanea. Saneando de golpe,
 * `Muñoz` acababa como `Mu_oz` —ASCII sí, pero ya no se reconoce—.
 */
export function nombreArchivoAscii(name: string | undefined | null): string {
  const limpio = aplanarAcentos(nombreArchivoUtf8(name))
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^[_.]+/, '')
    .slice(0, 120);
  return limpio || 'archivo';
}
