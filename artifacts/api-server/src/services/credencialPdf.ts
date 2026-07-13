/**
 * Credencial digital del estudiante — carnet en PDF (frente + reverso).
 *
 * Se genera bajo demanda para alumno, gestor y administrador. Reúne los mismos
 * datos que la credencial en pantalla (mi-identificación) y agrega la lista de
 * convocatorias en las que el alumno se ha inscrito a examen.
 *
 * REGLA: la fotografía solo se incrusta si el documento 'foto' está APROBADO.
 */
import { PDFDocument, rgb, StandardFonts, pushGraphicsState, popGraphicsState, moveTo, lineTo, closePath, clip, endPath, type PDFFont, type PDFPage, type PDFImage } from 'pdf-lib';
import QRCode from 'qrcode';
import { archivoBuffer } from './storage';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import {
  estudiantes,
  municipios,
  expedienteDocumentos,
  examenesInscripciones,
  convocatoriasEtapas,
} from '@workspace/db/schema';
import { VIGENCIA_CREDENCIAL_MESES } from '../config/reglas';
import { rutaFotoAprobada } from '../utils/fotoExpediente';
import { verifyUrlCredencial } from '../utils/credencialQr';

const GUINDA = rgb(0.42, 0.09, 0.19);
const GUINDA_D = rgb(0.30, 0.05, 0.13);
const DORADO = rgb(0.72, 0.55, 0.20);
const CREMA = rgb(0.98, 0.965, 0.94);
const PIEDRA_900 = rgb(0.11, 0.10, 0.09);
const PIEDRA_500 = rgb(0.42, 0.39, 0.36);
const BLANCO = rgb(1, 1, 1);

function txt(page: PDFPage, s: string, x: number, y: number, font: PDFFont, size: number, color = PIEDRA_900) {
  page.drawText(s ?? '', { x, y, size, font, color });
}

/** Degradado horizontal (aproxima el header guinda del portal). */
function gradientH(page: PDFPage, x: number, y: number, w: number, h: number, c1: ReturnType<typeof rgb>, c2: ReturnType<typeof rgb>, steps = 48) {
  const sw = w / steps;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const col = rgb(c1.red + (c2.red - c1.red) * t, c1.green + (c2.green - c1.green) * t, c1.blue + (c2.blue - c1.blue) * t);
    page.drawRectangle({ x: x + sw * i, y, width: sw + 0.7, height: h, color: col });
  }
}

/** Trunca con "…" si el texto excede maxW. */
function clipTxt(s: string, font: PDFFont, size: number, maxW: number): string {
  if (!s) return '—';
  if (font.widthOfTextAtSize(s, size) <= maxW) return s;
  let t = s;
  while (t.length > 1 && font.widthOfTextAtSize(t + '…', size) > maxW) t = t.slice(0, -1);
  return t + '…';
}

/**
 * Dibuja la imagen llenando TODO el recuadro (estilo object-fit: cover): escala
 * al lado mayor y recorta el sobrante con un clip, para que no queden franjas
 * blancas ni se desborde sobre el resto de la credencial.
 */
function coverImg(page: PDFPage, img: PDFImage, bx: number, by: number, bw: number, bh: number) {
  const s = Math.max(bw / img.width, bh / img.height);
  const w = img.width * s, h = img.height * s;
  page.pushOperators(
    pushGraphicsState(),
    moveTo(bx, by), lineTo(bx + bw, by), lineTo(bx + bw, by + bh), lineTo(bx, by + bh), closePath(),
    clip(), endPath(),
  );
  page.drawImage(img, { x: bx + (bw - w) / 2, y: by + (bh - h) / 2, width: w, height: h });
  page.pushOperators(popGraphicsState());
}

export interface CredencialData {
  folio: string;
  nombre: string;
  matricula: string | null;
  curp: string;
  sede: string;
  plan: string;
  emision: string | null;
  vigencia: string | null;
  vencida: boolean;
  convocatorias: string[];
  verifyUrl: string;
  tieneFoto: boolean;
}

async function reunirDatosCredencial(
  estudianteId: number
): Promise<{ data: CredencialData; fotoPath: string | null } | null> {
  const [est] = await db
    .select({
      nombreCompleto: estudiantes.nombreCompleto,
      curp: estudiantes.curp,
      municipioId: estudiantes.municipioId,
      matriculaOficialDGB: estudiantes.matriculaOficialDGB,
      licenciaDigital: estudiantes.licenciaDigital,
      licenciaEmitidaEn: estudiantes.licenciaEmitidaEn,
    })
    .from(estudiantes)
    .where(eq(estudiantes.userId, estudianteId));

  if (!est || !est.licenciaDigital) return null;

  const [muni] = est.municipioId
    ? await db.select({ nombre: municipios.nombre }).from(municipios).where(eq(municipios.id, est.municipioId))
    : [null];

  const fotoPath = await rutaFotoAprobada(estudianteId);

  const convsRaw = await db
    .selectDistinct({ clave: convocatoriasEtapas.clave, anio: convocatoriasEtapas.anio })
    .from(examenesInscripciones)
    .innerJoin(convocatoriasEtapas, eq(examenesInscripciones.etapaId, convocatoriasEtapas.id))
    .where(eq(examenesInscripciones.estudianteId, estudianteId));
  const convocatorias = convsRaw.map((c) => `${c.clave}-${c.anio}`).sort();

  const fmtDate = (d: Date) =>
    d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Mexico_City' });
  const emisionDate = est.licenciaEmitidaEn ? new Date(est.licenciaEmitidaEn) : null;
  const vigenciaDate = emisionDate ? new Date(emisionDate.getTime()) : null;
  if (vigenciaDate) vigenciaDate.setMonth(vigenciaDate.getMonth() + VIGENCIA_CREDENCIAL_MESES);

  return {
    data: {
      folio: est.licenciaDigital,
      nombre: est.nombreCompleto ?? '',
      matricula: est.matriculaOficialDGB ?? null,
      curp: est.curp ?? '',
      sede: muni?.nombre ?? '',
      plan: 'Plan 22 · Modular',
      emision: emisionDate ? fmtDate(emisionDate) : null,
      vigencia: vigenciaDate ? fmtDate(vigenciaDate) : null,
      vencida: vigenciaDate ? vigenciaDate.getTime() < Date.now() : false,
      convocatorias,
      verifyUrl: verifyUrlCredencial(est.licenciaDigital ?? ''),
      tieneFoto: fotoPath !== null,
    },
    fotoPath,
  };
}

/** Datos de la credencial para render en pantalla (preview). null si no hay credencial. */
export async function obtenerDatosCredencial(estudianteId: number): Promise<CredencialData | null> {
  const r = await reunirDatosCredencial(estudianteId);
  return r?.data ?? null;
}

export async function generarCredencialPdf(
  estudianteId: number
): Promise<{ pdf: Uint8Array; folio: string; matricula: string | null } | null> {
  const reunido = await reunirDatosCredencial(estudianteId);
  if (!reunido) return null;
  const { data, fotoPath } = reunido;
  const { curp, verifyUrl, convocatorias, vencida } = data;
  const emision = data.emision;
  const vigencia = data.vigencia;

  // ── Documento ──
  const doc = await PDFDocument.create();
  doc.setTitle(data.folio);
  doc.setSubject('Credencial digital del estudiante');
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const mono = await doc.embedFont(StandardFonts.CourierBold);

  const qrImg = await doc.embedPng(await QRCode.toBuffer(verifyUrl, { width: 220, margin: 0, color: { dark: '#2a1720', light: '#ffffff' } }));
  let foto: PDFImage | null = null;
  if (fotoPath) {
    try {
      const b = await archivoBuffer(fotoPath);
      foto = b[0] === 0x89 ? await doc.embedPng(b) : await doc.embedJpg(b);
    } catch { /* foto ilegible */ }
  }

  // ── Paleta EXACTA del portal (CredencialPreview) ──
  const G800 = rgb(0.36, 0.06, 0.15);       // guinda-800
  const G600 = rgb(0.55, 0.13, 0.24);       // guinda-600
  const GOLD = rgb(0.722, 0.592, 0.353);    // #b8975a
  const BG_F = rgb(0.984, 0.969, 0.961);    // #fbf7f5
  const BORDER = rgb(0.906, 0.863, 0.827);  // #e7dcd3
  const LABEL = rgb(0.66, 0.60, 0.56);      // #a89a8e
  const VALUE = rgb(0.165, 0.137, 0.125);   // #2a2320
  const SUB = rgb(0.93, 0.87, 0.89);
  const guinda700 = rgb(0.47, 0.10, 0.20);

  // Cada CARA ocupa TODA su hoja (a sangre, sin borde blanco): página 1 = frente,
  // página 2 = reverso. La hoja ES la credencial.
  const W = 520, M = 28, HEAD = 70;
  const HF = 320, HR = 344;
  const pageF = doc.addPage([W, HF]);
  const pageR = doc.addPage([W, HR]);

  // etiqueta+valor (label arriba, valor abajo)
  const field = (p: PDFPage, label: string, value: string, x: number, y: number, vSize: number, isMono = false, maxW = 220) => {
    txt(p, label.toUpperCase(), x, y, bold, 8.5, LABEL);
    const f = isMono ? mono : bold;
    txt(p, clipTxt(value || '—', f, vSize, maxW), x, y - 16, f, vSize, VALUE);
  };

  // ═══════════ FRENTE (hoja completa) ═══════════
  pageF.drawRectangle({ x: 0, y: 0, width: W, height: HF, color: BG_F });
  gradientH(pageF, 0, HF - HEAD, W, HEAD, G800, G600);
  pageF.drawRectangle({ x: 0, y: HF - HEAD - 3, width: W, height: 3, color: GOLD });
  txt(pageF, 'CREDENCIAL DEL ESTUDIANTE', M, HF - 40, bold, 20, BLANCO);
  txt(pageF, 'Preparatoria Abierta Michoacán · IEMSyS', M, HF - 62, reg, 12, SUB);

  const bodyTop = HF - HEAD - 3;
  const foW = 106, foH = 168;
  const foX = M, foY = (bodyTop - foH) / 2;
  pageF.drawRectangle({ x: foX - 2.5, y: foY - 2.5, width: foW + 5, height: foH + 5, color: BLANCO, borderColor: GOLD, borderWidth: 2.5 });
  if (foto) coverImg(pageF, foto, foX, foY, foW, foH);
  else {
    pageF.drawRectangle({ x: foX, y: foY, width: foW, height: foH, color: rgb(0.937, 0.906, 0.871) });
    txt(pageF, 'SIN FOTO', foX + foW / 2 - 24, foY + foH / 2 - 4, reg, 10, LABEL);
  }

  const qrS = 118, qrX = W - M - qrS, qrY = (bodyTop - qrS) / 2 + 8;
  pageF.drawRectangle({ x: qrX - 7, y: qrY - 7, width: qrS + 14, height: qrS + 14, color: BLANCO, borderColor: BORDER, borderWidth: 1 });
  pageF.drawImage(qrImg, { x: qrX, y: qrY, width: qrS, height: qrS });
  const vTxt = 'Verificable';
  txt(pageF, vTxt, qrX + (qrS - bold.widthOfTextAtSize(vTxt, 10)) / 2, qrY - 20, bold, 10, guinda700);

  const dX = foX + foW + 22, dMaxW = qrX - 16 - dX, dCenter = bodyTop / 2;
  field(pageF, 'Nombre', data.nombre, dX, dCenter + 58, 16, false, dMaxW);
  field(pageF, 'Matrícula oficial DGB', data.matricula ?? 'Sin asignar', dX, dCenter + 2, 15, true, dMaxW);
  field(pageF, 'Folio de credencial', data.folio, dX, dCenter - 54, 14, true, dMaxW);

  // ═══════════ REVERSO (hoja completa) ═══════════
  pageR.drawRectangle({ x: 0, y: 0, width: W, height: HR, color: BLANCO });
  pageR.drawRectangle({ x: 0, y: HR - 56, width: W, height: 56, color: G800 });
  txt(pageR, 'DATOS DE LA CREDENCIAL', M, HR - 36, bold, 16, BLANCO);

  const colL = M, colR = W / 2 + 12, colW = W / 2 - M - 14;
  const r0 = HR - 56 - 42, rowGap = 46;
  field(pageR, 'CURP', curp, colL, r0, 14, true, colW);
  field(pageR, 'Centro de servicios', data.sede || '—', colR, r0, 14, false, colW);
  field(pageR, 'Plan', data.plan, colL, r0 - rowGap, 14, false, colW);
  txt(pageR, 'ESTADO', colR, r0 - rowGap, bold, 8.5, LABEL);
  const estText = vencida ? 'VENCIDA' : 'VIGENTE';
  const estBg = vencida ? rgb(0.996, 0.886, 0.886) : rgb(0.82, 0.98, 0.878);
  const estFg = vencida ? rgb(0.725, 0.11, 0.11) : rgb(0.086, 0.396, 0.204);
  const ew = bold.widthOfTextAtSize(estText, 11) + 18;
  pageR.drawRectangle({ x: colR, y: r0 - rowGap - 19, width: ew, height: 19, color: estBg });
  txt(pageR, estText, colR + 9, r0 - rowGap - 14, bold, 11, estFg);
  field(pageR, 'Emisión', emision ?? '—', colL, r0 - 2 * rowGap, 14, false, colW);
  field(pageR, 'Vigente hasta', vigencia ?? '—', colR, r0 - 2 * rowGap, 14, false, colW);

  const cvY = r0 - 3 * rowGap + 2;
  txt(pageR, 'CONVOCATORIAS INSCRITAS', colL, cvY, bold, 8.5, LABEL);
  const listado = convocatorias.length ? convocatorias.join('   ·   ') : 'Sin inscripciones registradas';
  txt(pageR, clipTxt(listado, reg, 14, W - 2 * M), colL, cvY - 18, reg, 14, VALUE);

  pageR.drawRectangle({ x: 0, y: 0, width: W, height: 28, color: rgb(0.968, 0.949, 0.929) });
  txt(pageR, `Folio ${data.folio}  ·  verifica.edumich.michoacan.gob.mx`, M, 10, reg, 9.5, LABEL);

  const pdf = await doc.save();
  return { pdf, folio: data.folio, matricula: data.matricula };
}
