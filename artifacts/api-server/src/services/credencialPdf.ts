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
  const page = doc.addPage([612, 792]);
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

  const CW = 480, CX = (612 - CW) / 2;      // tarjeta ancha, centrada
  const HEAD = 46;                          // alto del header
  const CHF = 190, CHR = 205;               // alto frente / reverso
  const frontY = 792 - 56 - CHF;            // deja margen superior
  const backY = frontY - 26 - CHR;

  // etiqueta+valor (label arriba, valor abajo)
  const field = (label: string, value: string, x: number, y: number, vSize = 13, isMono = false, maxW = 220) => {
    txt(page, label.toUpperCase(), x, y, bold, 7.5, LABEL);
    const f = isMono ? mono : bold;
    txt(page, clipTxt(value || '—', f, vSize, maxW), x, y - 14, f, vSize, VALUE);
  };

  // ═══════════ FRENTE ═══════════
  page.drawRectangle({ x: CX, y: frontY, width: CW, height: CHF, color: BG_F, borderColor: BORDER, borderWidth: 1 });
  gradientH(page, CX, frontY + CHF - HEAD, CW, HEAD, G800, G600);
  page.drawRectangle({ x: CX, y: frontY + CHF - HEAD - 3, width: CW, height: 3, color: GOLD });
  txt(page, 'CREDENCIAL DEL ESTUDIANTE', CX + 18, frontY + CHF - 26, bold, 13, BLANCO);
  txt(page, 'Preparatoria Abierta Michoacán · IEMSyS', CX + 18, frontY + CHF - 40, reg, 9, SUB);

  const bodyBot = frontY;
  const bodyTop = frontY + CHF - HEAD - 3;
  // Foto (centrada verticalmente en el cuerpo)
  const foW = 92, foH = 112;
  const foX = CX + 18, foY = bodyBot + (bodyTop - bodyBot - foH) / 2;
  page.drawRectangle({ x: foX - 2, y: foY - 2, width: foW + 4, height: foH + 4, color: BLANCO, borderColor: GOLD, borderWidth: 2 });
  if (foto) coverImg(page, foto, foX, foY, foW, foH);
  else {
    page.drawRectangle({ x: foX, y: foY, width: foW, height: foH, color: rgb(0.937, 0.906, 0.871) });
    txt(page, 'SIN FOTO', foX + 22, foY + foH / 2 - 3, reg, 8, LABEL);
  }

  // QR a la derecha
  const qrS = 92, qrX = CX + CW - 18 - qrS, qrY = bodyBot + (bodyTop - bodyBot - qrS) / 2 + 4;
  page.drawRectangle({ x: qrX - 6, y: qrY - 6, width: qrS + 12, height: qrS + 12, color: BLANCO, borderColor: BORDER, borderWidth: 1 });
  page.drawImage(qrImg, { x: qrX, y: qrY, width: qrS, height: qrS });
  const vTxt = 'Verificable';
  txt(page, vTxt, qrX + (qrS - bold.widthOfTextAtSize(vTxt, 8)) / 2, qrY - 16, bold, 8, guinda700);

  // Datos entre la foto y el QR
  const dX = foX + foW + 18;
  const dMaxW = qrX - 12 - dX;
  const dCenter = bodyBot + (bodyTop - bodyBot) / 2;
  field('Nombre', data.nombre, dX, dCenter + 44, 13, false, dMaxW);
  field('Matrícula oficial DGB', data.matricula ?? 'Sin asignar', dX, dCenter + 2, 12, true, dMaxW);
  field('Folio de credencial', data.folio, dX, dCenter - 40, 12, true, dMaxW);

  // ═══════════ REVERSO ═══════════
  page.drawRectangle({ x: CX, y: backY, width: CW, height: CHR, color: BLANCO, borderColor: BORDER, borderWidth: 1 });
  page.drawRectangle({ x: CX, y: backY + CHR - 40, width: CW, height: 40, color: G800 });
  txt(page, 'DATOS DE LA CREDENCIAL', CX + 18, backY + CHR - 26, bold, 12, BLANCO);

  const colL = CX + 18, colR = CX + CW / 2 + 8;
  const colW = CW / 2 - 30;
  const r0 = backY + CHR - 68;
  const rowGap = 34;
  field('CURP', curp, colL, r0, 11, true, colW);
  field('Centro de servicios', data.sede || '—', colR, r0, 11, false, colW);
  field('Plan', data.plan, colL, r0 - rowGap, 11, false, colW);
  // Estado (píldora)
  txt(page, 'ESTADO', colR, r0 - rowGap, bold, 7.5, LABEL);
  const estText = vencida ? 'VENCIDA' : 'VIGENTE';
  const estBg = vencida ? rgb(0.996, 0.886, 0.886) : rgb(0.82, 0.98, 0.878);
  const estFg = vencida ? rgb(0.725, 0.11, 0.11) : rgb(0.086, 0.396, 0.204);
  const ew = bold.widthOfTextAtSize(estText, 9) + 14;
  page.drawRectangle({ x: colR, y: r0 - rowGap - 15, width: ew, height: 15, color: estBg });
  txt(page, estText, colR + 7, r0 - rowGap - 11, bold, 9, estFg);
  field('Emisión', emision ?? '—', colL, r0 - 2 * rowGap, 11, false, colW);
  field('Vigente hasta', vigencia ?? '—', colR, r0 - 2 * rowGap, 11, false, colW);

  // Convocatorias inscritas (ancho completo)
  const cvY = r0 - 3 * rowGap + 4;
  txt(page, 'CONVOCATORIAS INSCRITAS', colL, cvY, bold, 7.5, LABEL);
  const listado = convocatorias.length ? convocatorias.join('   ·   ') : 'Sin inscripciones registradas';
  txt(page, clipTxt(listado, reg, 11, CW - 36), colL, cvY - 14, reg, 11, VALUE);

  // Pie
  page.drawRectangle({ x: CX, y: backY, width: CW, height: 22, color: rgb(0.968, 0.949, 0.929) });
  txt(page, `Folio ${data.folio}  ·  verifica.edumich.michoacan.gob.mx`, CX + 14, backY + 8, reg, 8, LABEL);

  const pdf = await doc.save();
  return { pdf, folio: data.folio, matricula: data.matricula };
}
