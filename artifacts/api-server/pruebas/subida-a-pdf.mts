/**
 * Comprueba la conversion a PDF de lo que se sube al expediente.
 *
 * La rama de IMAGEN se prueba de verdad aqui (pdf-lib no necesita nada
 * externo). La rama de WORD depende de LibreOffice: si `soffice` no esta en
 * esta maquina, el caso comprueba lo OTRO que importa —que se rechace con un
 * motivo legible en vez de romperse— que es exactamente como se comportaria la
 * imagen de produccion si se quitara del Dockerfile.
 */
import { mkdtemp, writeFile, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { dejarEnPdf, NoSePudoConvertir } from '../src/services/aPdf';

// PNG y JPEG minimos, validos.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const JPG = Buffer.from('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');

let fallos = 0;
const dir = await mkdtemp(path.join(tmpdir(), 'prueba-apdf-'));

function ok(cond: boolean, etiqueta: string, detalle = '') {
  if (!cond) fallos++;
  console.log(`${cond ? '  ok  ' : 'FALLA '} ${etiqueta}${detalle ? `  (${detalle})` : ''}`);
}

async function esPdf(ruta: string): Promise<boolean> {
  const b = await readFile(ruta);
  return b.subarray(0, 5).toString('latin1') === '%PDF-';
}

async function existe(ruta: string): Promise<boolean> {
  return access(ruta).then(() => true, () => false);
}

try {
  // ── Imagen → PDF ─────────────────────────────────────────────────────────
  for (const [nombre, bytes, mime] of [['foto.png', PNG, 'image/png'], ['foto.jpg', JPG, 'image/jpeg']] as const) {
    const origen = path.join(dir, nombre);
    await writeFile(origen, bytes);
    const r = await dejarEnPdf(origen, mime);
    ok(r.convertidoDe === 'imagen', `${mime} se marca como convertido desde imagen`, String(r.convertidoDe));
    ok(await esPdf(r.ruta), `${mime} produce un PDF real`);
    ok(r.ruta.endsWith('.pdf'), `${mime} deja el archivo con extension .pdf`, r.ruta);
    ok(!(await existe(origen)), `${mime} borra el original (no quedan dos archivos)`);
  }

  // ── PDF → se deja igual, byte por byte ───────────────────────────────────
  const pdfOrigen = path.join(dir, 'ya.pdf');
  const contenidoPdf = Buffer.from('%PDF-1.4\n% documento oficial que no hay que tocar\n');
  await writeFile(pdfOrigen, contenidoPdf);
  const rPdf = await dejarEnPdf(pdfOrigen, 'application/pdf');
  ok(rPdf.convertidoDe === null, 'un PDF no se marca como convertido');
  ok(rPdf.ruta === pdfOrigen, 'un PDF conserva su ruta');
  ok((await readFile(rPdf.ruta)).equals(contenidoPdf), 'un PDF NO se reescribe (documento oficial intacto)');

  // ── Un archivo que dice ser PDF y no lo es ───────────────────────────────
  const falso = path.join(dir, 'falso.pdf');
  await writeFile(falso, Buffer.from('esto no es un pdf'));
  try {
    await dejarEnPdf(falso, 'application/pdf');
    ok(false, 'un PDF falso se rechaza');
  } catch (e) {
    ok(e instanceof NoSePudoConvertir, 'un PDF falso se rechaza con motivo legible', (e as Error).message);
  }

  // ── Imagen corrupta ──────────────────────────────────────────────────────
  const rota = path.join(dir, 'rota.png');
  await writeFile(rota, Buffer.from('no soy una imagen'));
  try {
    await dejarEnPdf(rota, 'image/png');
    ok(false, 'una imagen corrupta se rechaza');
  } catch (e) {
    ok(e instanceof NoSePudoConvertir, 'una imagen corrupta se rechaza con motivo legible', (e as Error).message);
  }

  // ── Word ─────────────────────────────────────────────────────────────────
  const docx = path.join(dir, 'certificado.docx');
  await writeFile(docx, Buffer.from('PK no es un docx de verdad'));
  const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  try {
    const r = await dejarEnPdf(docx, MIME_DOCX);
    ok(await esPdf(r.ruta), 'LibreOffice esta: el .docx produce un PDF real');
  } catch (e) {
    ok(e instanceof NoSePudoConvertir,
       'sin LibreOffice (o con un .docx invalido) se rechaza con motivo legible, no revienta',
       (e as Error).message);
  }
} finally {
  await rm(dir, { recursive: true, force: true }).catch(() => {});
}

console.log(fallos === 0 ? '\n== TODOS LOS CASOS PASAN ==\n' : `\n== ${fallos} CASO(S) FALLAN ==\n`);
process.exit(fallos === 0 ? 0 : 1);
