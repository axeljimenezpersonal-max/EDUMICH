/**
 * Lo que suben, convertido a PDF antes de guardarlo.
 *
 * ── El problema real ────────────────────────────────────────────────────────
 *
 * El expediente pide PDF, y con razón: todo lo que viene después —la vista de
 * revisión, la descarga, el cotejo— asume PDF, y el sistema entero sirve esos
 * archivos con `Content-Type: application/pdf`. Pero la gente manda lo que
 * tiene: la foto del acta que tomó con el teléfono, o el certificado que en la
 * secundaria le entregaron en Word. Rechazarlos obligaba a la persona a
 * convertirlos por su cuenta, y quien no sabe hacerlo simplemente no completa
 * su expediente.
 *
 * ── La decisión ─────────────────────────────────────────────────────────────
 *
 * Se convierte AL SUBIR, no al servir. Es lo que hace que este cambio no toque
 * nada más: en el momento en que el archivo llega a `expediente_documentos` ya
 * es un PDF, así que las ~15 rutas que lo sirven, la revisión, la descarga y el
 * cotejo siguen exactamente igual. Convertir al servir habría significado
 * hacerlo una y otra vez, y dejar en la base documentos que el resto del
 * sistema no sabe leer.
 *
 * Y se convierte EN SILENCIO. La pantalla sigue pidiendo PDF, porque es lo que
 * queremos que manden: si se anuncia que se acepta cualquier cosa, llega
 * cualquier cosa —capturas de pantalla, fotos torcidas, documentos de tres
 * megas— y la revisión se vuelve impracticable. Esto es una red por debajo para
 * quien no pudo cumplir, no una invitación.
 *
 * ── Word depende de algo que puede no estar ─────────────────────────────────
 *
 * Las imágenes se convierten con `pdf-lib`, que ya era dependencia: sin
 * instalar nada, sin proceso externo. Word necesita LibreOffice, que son
 * cientos de megas en la imagen. Por eso este módulo NO da por hecho que esté:
 * si `soffice` no existe, el documento de Word se rechaza con un mensaje claro
 * y todo lo demás sigue funcionando. Instalarlo o quitarlo es una línea del
 * Dockerfile, y el código no cambia en ninguno de los dos casos.
 */
import { spawn } from 'node:child_process';
import { readFile, writeFile, unlink, mkdtemp, rm, stat, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';

/**
 * Lo que se acepta al subir un documento del expediente.
 *
 * `application/octet-stream` NO está: es lo que manda un navegador cuando no
 * reconoce el archivo, y aceptarlo sería aceptar cualquier cosa. Lo que decide
 * es el tipo declarado más la comprobación del contenido que hace la
 * conversión: un `.pdf` que en realidad es otra cosa no sobrevive.
 */
export const MIMES_SUBIDA_EXPEDIENTE = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  // Word y OpenDocument. Se aceptan aquí y se rechazan más adelante si el
  // convertidor no está disponible, para poder dar un motivo concreto en vez
  // de un "tipo de archivo no permitido" que no explica nada.
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
] as const;

const MIMES_IMAGEN = new Set(['image/jpeg', 'image/png']);
const MIMES_OFIMATICA = new Set([
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
]);

export interface Convertido {
  /** Ruta del PDF resultante. Puede ser la misma que llegó, si ya era PDF. */
  ruta: string;
  /** De qué se convirtió, o null si ya venía en PDF. Para la bitácora. */
  convertidoDe: 'imagen' | 'word' | null;
}

/** Un PDF de verdad empieza con `%PDF-`. Barato y ataja el archivo mal nombrado. */
async function pareceUnPdf(ruta: string): Promise<boolean> {
  const buf = await readFile(ruta);
  return buf.length > 4 && buf.subarray(0, 5).toString('latin1') === '%PDF-';
}

/** A4 en puntos. Es el tamaño en que se imprimen estos expedientes. */
const A4 = { ancho: 595.28, alto: 841.89 };

/**
 * Una imagen, como una página A4.
 *
 * Se ajusta a la página conservando la proporción y centrada, en vez de dejar
 * la página del tamaño exacto de la foto: un acta fotografiada con el teléfono
 * son 3000×4000 px y saldría como una hoja gigante que nadie puede imprimir.
 * No se recorta nada — recortar el borde de un acta es perder un sello.
 */
async function imagenAPdf(rutaOrigen: string, mime: string, rutaDestino: string): Promise<void> {
  const bytes = await readFile(rutaOrigen);
  const pdf = await PDFDocument.create();
  const img = mime === 'image/png' ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);

  const escala = Math.min(A4.ancho / img.width, A4.alto / img.height);
  const ancho = img.width * escala;
  const alto = img.height * escala;

  const pagina = pdf.addPage([A4.ancho, A4.alto]);
  pagina.drawImage(img, {
    x: (A4.ancho - ancho) / 2,
    y: (A4.alto - alto) / 2,
    width: ancho,
    height: alto,
  });
  await writeFile(rutaDestino, await pdf.save());
}

/**
 * Un documento de Word/ODT, con LibreOffice.
 *
 * Devuelve `null` si LibreOffice no está instalado en la imagen — que es un
 * estado esperado, no un error: ver el encabezado de este archivo.
 *
 * Cada conversión corre con su PROPIO perfil (`-env:UserInstallation`). Sin
 * eso, dos conversiones simultáneas se pelean por el perfil compartido de
 * `~/.config/libreoffice` y la segunda se queda colgada hasta el tiempo límite.
 * Con dos gestores subiendo documentos a la vez eso pasa el primer día.
 */
async function wordAPdf(rutaOrigen: string, destino: string): Promise<boolean> {
  const perfil = await mkdtemp(path.join(tmpdir(), 'lo-perfil-'));
  // LibreOffice decide el nombre de su salida (el mismo base, extensión .pdf) y
  // no acepta que se le diga otro. Se le da un directorio propio para que ese
  // nombre no pueda pisar nada, y de ahí se mueve al destino ya reservado.
  const dirTrabajo = await mkdtemp(path.join(tmpdir(), 'lo-salida-'));
  try {
    const salida = await new Promise<string | null>((resolve) => {
      const p = spawn('soffice', [
        `-env:UserInstallation=file://${perfil}`,
        '--headless',
        '--norestore',
        // Sin esto, un documento que quiera abrir algo de la red haría que la
        // conversión se quedara esperando en un servidor ajeno.
        '--nolockcheck',
        '--convert-to', 'pdf:writer_pdf_Export',
        '--outdir', dirTrabajo,
        rutaOrigen,
      ], { stdio: 'ignore' });

      // LibreOffice arrancando en frío tarda; 60 s es holgado para un documento
      // de expediente y corta en seco el que se quedó pegado.
      const corte = setTimeout(() => { p.kill('SIGKILL'); resolve(null); }, 60_000);

      p.on('error', () => { clearTimeout(corte); resolve(null); }); // no está instalado
      p.on('close', (codigo) => {
        clearTimeout(corte);
        if (codigo !== 0) { resolve(null); return; }
        // LibreOffice escribe con el mismo nombre base y extensión .pdf.
        resolve(path.join(dirTrabajo, `${path.basename(rutaOrigen, path.extname(rutaOrigen))}.pdf`));
      });
    });

    if (!salida) return false;
    // Que el proceso saliera con 0 no garantiza un PDF utilizable.
    if (!(await pareceUnPdf(salida).catch(() => false))) return false;
    // `copyFile` y no `rename`: el temporal y las subidas pueden estar en
    // sistemas de archivos distintos, y ahí `rename` falla con EXDEV.
    await copyFile(salida, destino);
    return true;
  } finally {
    await rm(perfil, { recursive: true, force: true }).catch(() => {});
    await rm(dirTrabajo, { recursive: true, force: true }).catch(() => {});
  }
}

/** Se lanza cuando el archivo no se pudo convertir. El mensaje lo lee una persona. */
export class NoSePudoConvertir extends Error {}

/**
 * Un `<base>.pdf` que no exista todavía en `dir`.
 *
 * Al convertir, la extensión desaparece: `acta.png` y `acta.jpg` querían ser
 * los dos `acta.pdf`, y el segundo pisaba al primero en silencio. Multer
 * antepone la marca de tiempo en milisegundos, pero los cinco documentos de un
 * mismo registro llegan en el mismo instante y pueden compartirla. El precio de
 * equivocarse aquí es que el certificado de alguien quede guardado como su
 * acta, y eso no se nota hasta que alguien abre el expediente.
 */
async function rutaLibre(dir: string, base: string): Promise<string> {
  for (let i = 0; ; i++) {
    const ruta = path.join(dir, i === 0 ? `${base}.pdf` : `${base}-${i}.pdf`);
    try {
      await stat(ruta);
    } catch {
      return ruta; // no existe: es la buena
    }
  }
}

/**
 * Deja el archivo subido como PDF.
 *
 * Si ya era PDF lo devuelve tal cual —sin reescribirlo, para no alterar un
 * documento oficial que ya estaba bien—. Si no, escribe el PDF convertido al
 * lado y BORRA el original: lo que queda en disco es siempre un solo archivo, y
 * es el que se guarda.
 *
 * Lanza `NoSePudoConvertir` con un motivo en español si no se puede.
 */
export async function dejarEnPdf(rutaSubida: string, mime: string): Promise<Convertido> {
  if (mime === 'application/pdf') {
    if (!(await pareceUnPdf(rutaSubida))) {
      throw new NoSePudoConvertir('Ese archivo dice ser PDF pero no lo es. Vuelve a guardarlo como PDF e inténtalo de nuevo.');
    }
    return { ruta: rutaSubida, convertidoDe: null };
  }

  const destino = await rutaLibre(path.dirname(rutaSubida), path.basename(rutaSubida, path.extname(rutaSubida)));

  if (MIMES_IMAGEN.has(mime)) {
    try {
      await imagenAPdf(rutaSubida, mime, destino);
    } catch {
      throw new NoSePudoConvertir('No se pudo leer esa imagen. Súbela de nuevo como JPG o PNG, o conviértela a PDF.');
    }
    await unlink(rutaSubida).catch(() => {});
    return { ruta: destino, convertidoDe: 'imagen' };
  }

  if (MIMES_OFIMATICA.has(mime)) {
    if (!(await wordAPdf(rutaSubida, destino))) {
      throw new NoSePudoConvertir('No se pudo convertir ese documento de Word. Ábrelo y guárdalo como PDF (Archivo → Guardar como → PDF), o súbelo como foto.');
    }
    await unlink(rutaSubida).catch(() => {});
    return { ruta: destino, convertidoDe: 'word' };
  }

  throw new NoSePudoConvertir('Ese tipo de archivo no se puede usar. Sube el documento en PDF.');
}

/**
 * Lo mismo, pero dejando el objeto de multer apuntando ya al PDF.
 *
 * Se MODIFICA el objeto en vez de devolver uno nuevo, y es a propósito: así
 * `guardarSubida(req.file, …)`, `nombreArchivoAscii(req.file.originalname)` y
 * `req.file.size` —que están repartidos por varias rutas— siguen escritos
 * igual y guardan el PDF sin enterarse de que hubo una conversión. Es el punto
 * exacto donde este cambio deja de propagarse al resto del sistema.
 *
 * Devuelve de qué se convirtió, para la bitácora, o `null` si ya era PDF.
 */
export async function dejarArchivoEnPdf(file: Express.Multer.File): Promise<'imagen' | 'word' | null> {
  const r = await dejarEnPdf(file.path, file.mimetype);
  if (!r.convertidoDe) return null;

  const { size } = await stat(r.ruta);
  file.path = r.ruta;
  file.mimetype = 'application/pdf';
  file.size = size;
  // El nombre visible también: guardar "CERTIFICADO.docx" sobre un archivo que
  // ya es PDF hace que quien lo descargue no pueda abrirlo.
  file.originalname = `${path.basename(file.originalname, path.extname(file.originalname))}.pdf`;
  return r.convertidoDe;
}
