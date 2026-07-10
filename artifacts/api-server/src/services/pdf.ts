/**
 * Generador de fichas PDF — Preparatoria Abierta Michoacán
 * pdf-lib (puro JS, sin canvas/chromium).
 */

import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage, degrees, pushGraphicsState, popGraphicsState, moveTo, lineTo, closePath, clip, endPath } from 'pdf-lib';
import { winAnsiSafe } from '../utils/pdfText';
import QRCode from 'qrcode';
import { archivoBuffer, archivoExiste } from './storage';

// ── Color palette ─────────────────────────────────────────────────────────
const GUINDA   = rgb(0.50, 0.05, 0.12);  // #800d1f approx — guinda Michoacán
const GUINDA_L = rgb(0.94, 0.91, 0.86);  // crema claro
const VERDE    = rgb(0.08, 0.49, 0.22);  // #16a34a
const VERDE_L  = rgb(0.87, 0.99, 0.90);  // verde claro
const NEGRO    = rgb(0.13, 0.13, 0.13);
const GRIS     = rgb(0.46, 0.44, 0.42);
const GRIS_L   = rgb(0.96, 0.95, 0.93);
const BLANCO   = rgb(1, 1, 1);

const PAGE_W = 595.28;   // A4 width in points
const PAGE_H = 841.89;   // A4 height in points
const MARGIN = 44;

// ── Helpers ───────────────────────────────────────────────────────────────

function fmtFecha(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Mexico_City' });
}

function drawRect(page: PDFPage, x: number, y: number, w: number, h: number, color: ReturnType<typeof rgb>) {
  page.drawRectangle({ x, y, width: w, height: h, color });
}

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  color = NEGRO,
  maxWidth?: number,
) {
  let t = winAnsiSafe(text);
  const original = t;
  if (maxWidth) {
    while (t.length > 3 && font.widthOfTextAtSize(t, size) > maxWidth) {
      t = t.slice(0, -1);
    }
    if (t !== original) t = t.slice(0, -1) + '...';
  }
  page.drawText(t, { x, y, size, font, color });
}

function drawLine(page: PDFPage, x1: number, y1: number, x2: number, y2: number) {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.5, color: rgb(0.87, 0.85, 0.82) });
}

function row(
  page: PDFPage,
  labelFont: PDFFont,
  valueFont: PDFFont,
  label: string,
  value: string,
  x: number,
  y: number,
  colW = 240,
) {
  drawText(page, label.toUpperCase(), x, y, labelFont, 7, GRIS);
  drawText(page, value || '—', x, y - 12, valueFont, 10, NEGRO, colW);
}

// ── Header institucional ──────────────────────────────────────────────────

function drawHeader(page: PDFPage, bold: PDFFont, regular: PDFFont) {
  const y = PAGE_H - MARGIN;

  // Left guinda stripe
  drawRect(page, MARGIN, y - 36, 4, 48, GUINDA);

  // Titles
  drawText(page, 'GOBIERNO DEL ESTADO DE MICHOACÁN', MARGIN + 12, y, bold, 8, GUINDA);
  drawText(page, 'Instituto de Educación Media Superior y Superior (IEMSyS)', MARGIN + 12, y - 11, regular, 8, NEGRO);
  drawText(page, 'Preparatoria Abierta — Plan Modular', MARGIN + 12, y - 21, regular, 8, GRIS);

  // Right stamp
  const stampX = PAGE_W - MARGIN - 120;
  drawText(page, 'prepaabierta.michoacan.gob.mx', stampX, y - 14, regular, 7.5, GRIS);

  // Separator line
  drawLine(page, MARGIN, y - 42, PAGE_W - MARGIN, y - 42);
}

// ── Banner band ──────────────────────────────────────────────────────────

function drawBand(
  page: PDFPage,
  bold: PDFFont,
  regular: PDFFont,
  title: string,
  subtitle: string,
  color: ReturnType<typeof rgb>,
  y: number,
): number {
  const bandH = 42;
  drawRect(page, MARGIN, y - bandH, PAGE_W - 2 * MARGIN, bandH, color);
  drawText(page, title, MARGIN + 16, y - 17, bold, 14, BLANCO);
  drawText(page, subtitle, MARGIN + 16, y - 31, regular, 9, BLANCO);
  return y - bandH - 12;
}

// ── Box with crema background ─────────────────────────────────────────────

function drawBox(
  page: PDFPage,
  bold: PDFFont,
  regular: PDFFont,
  lines: { label: string; value: string }[],
  x: number,
  y: number,
  w: number,
  bg = GUINDA_L,
): number {
  const lineH = 16;
  const padV = 12;
  const h = padV * 2 + lines.length * lineH;
  drawRect(page, x, y - h, w, h, bg);
  page.drawRectangle({ x, y: y - h, width: w, height: h, borderColor: GUINDA, borderWidth: 0.5, opacity: 0 });

  let cy = y - padV - 4;
  for (const { label, value } of lines) {
    drawText(page, label.toUpperCase() + ':', x + 14, cy, bold, 8, GUINDA);
    const lw = bold.widthOfTextAtSize(label.toUpperCase() + ':', 8);
    drawText(page, value, x + 14 + lw + 4, cy, regular, 9, NEGRO, w - 28 - lw - 4);
    cy -= lineH;
  }
  return y - h - 10;
}

// ── Section heading ───────────────────────────────────────────────────────

function drawSectionHeading(page: PDFPage, bold: PDFFont, text: string, y: number): number {
  drawText(page, text.toUpperCase(), MARGIN, y, bold, 7.5, GUINDA);
  drawLine(page, MARGIN, y - 4, PAGE_W - MARGIN, y - 4);
  return y - 16;
}

// ── Footer ────────────────────────────────────────────────────────────────

function drawFooter(page: PDFPage, regular: PDFFont, folio: string, extra?: string) {
  const y = 32;
  drawLine(page, MARGIN, y + 10, PAGE_W - MARGIN, y + 10);
  drawText(page, folio, MARGIN, y - 2, regular, 7.5, GRIS);
  if (extra) drawText(page, extra, MARGIN + 200, y - 2, regular, 7.5, GRIS);
  drawText(page, 'EDUMICH · Preparatoria Abierta · IEMSyS Michoacán', PAGE_W / 2 - 100, y - 2, regular, 7.5, GRIS);
  drawText(page, 'edumich.michoacan.gob.mx', PAGE_W - MARGIN - 120, y - 2, regular, 7.5, GRIS);
}

// ── Decorative L-corners ─────────────────────────────────────────────────

function drawCorners(page: PDFPage, margin = 16, size = 22, thickness = 2.5) {
  const W = page.getWidth();
  const H = page.getHeight();
  const c = GUINDA;
  const t = thickness;
  // top-left
  page.drawLine({ start: { x: margin, y: H - margin }, end: { x: margin + size, y: H - margin }, thickness: t, color: c });
  page.drawLine({ start: { x: margin, y: H - margin }, end: { x: margin, y: H - margin - size }, thickness: t, color: c });
  // top-right
  page.drawLine({ start: { x: W - margin, y: H - margin }, end: { x: W - margin - size, y: H - margin }, thickness: t, color: c });
  page.drawLine({ start: { x: W - margin, y: H - margin }, end: { x: W - margin, y: H - margin - size }, thickness: t, color: c });
  // bottom-left
  page.drawLine({ start: { x: margin, y: margin }, end: { x: margin + size, y: margin }, thickness: t, color: c });
  page.drawLine({ start: { x: margin, y: margin }, end: { x: margin, y: margin + size }, thickness: t, color: c });
  // bottom-right
  page.drawLine({ start: { x: W - margin, y: margin }, end: { x: W - margin - size, y: margin }, thickness: t, color: c });
  page.drawLine({ start: { x: W - margin, y: margin }, end: { x: W - margin, y: margin + size }, thickness: t, color: c });
}

// ── Diagonal watermark ────────────────────────────────────────────────────

function drawWatermark(page: PDFPage, font: PDFFont, text: string, opacity = 0.04) {
  const W = page.getWidth();
  const H = page.getHeight();
  page.drawText(winAnsiSafe(text), {
    x: W / 2 - 140,
    y: H / 2 - 30,
    size: 72,
    font,
    color: rgb(0.42, 0.04, 0.15),
    opacity,
    rotate: degrees(42),
  });
}

// ── Paso a paso list ─────────────────────────────────────────────────────

function drawStepList(page: PDFPage, bold: PDFFont, regular: PDFFont, steps: string[], x: number, y: number): number {
  let cy = y;
  for (let i = 0; i < steps.length; i++) {
    const num = String(i + 1);
    drawRect(page, x, cy - 10, 16, 16, GUINDA);
    drawText(page, num, x + (16 - bold.widthOfTextAtSize(num, 8)) / 2, cy - 3, bold, 8, BLANCO);
    drawText(page, steps[i], x + 22, cy - 3, regular, 9, NEGRO, PAGE_W - MARGIN - x - 22);
    cy -= 20;
  }
  return cy;
}

// ── Extra color palette for payment fichas ────────────────────────────────
const AZUL    = rgb(0.04, 0.31, 0.65);  // SPEI / transferencia
const AZUL_L  = rgb(0.90, 0.95, 1.00);
const NARANJA = rgb(0.60, 0.25, 0.00);  // Tienda de conveniencia
const NARANJA_L = rgb(1.00, 0.95, 0.86);

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC: Ficha de pago (derecho de examen)
// ═══════════════════════════════════════════════════════════════════════════

export type MetodoPagoFicha = 'spei' | 'banco_deposito' | 'tienda_conveniencia';

export interface FichaPagoData {
  // Student
  nombreCompleto: string;
  curp: string | null;
  // Convocatoria
  etapaClave: string;
  etapaNombre: string;   // e.g. "2026-1 — Fase A"
  // Payment
  metodo: MetodoPagoFicha;
  monto: number;
  referencia: string;    // curp or generated ref
  // Bank config (from DB)
  banco: string;
  titular: string;
  clabe: string;
  numeroCuenta: string | null;
  convenio: string | null;
  // Generation
  generadoEn: Date;
}

export async function generarFichaPago(data: FichaPagoData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const bold    = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);

  const METODO_LABELS: Record<MetodoPagoFicha, string> = {
    spei: 'TRANSFERENCIA ELECTRÓNICA — SPEI',
    banco_deposito: 'DEPÓSITO BANCARIO EN VENTANILLA',
    tienda_conveniencia: 'PAGO EN TIENDA DE CONVENIENCIA',
  };

  const METODO_COLOR: Record<MetodoPagoFicha, ReturnType<typeof rgb>> = {
    spei: AZUL,
    banco_deposito: VERDE,
    tienda_conveniencia: NARANJA,
  };

  const METODO_COLOR_L: Record<MetodoPagoFicha, ReturnType<typeof rgb>> = {
    spei: AZUL_L,
    banco_deposito: VERDE_L,
    tienda_conveniencia: NARANJA_L,
  };

  const mainColor  = METODO_COLOR[data.metodo];
  const lightColor = METODO_COLOR_L[data.metodo];

  // Watermark
  drawWatermark(page, bold, 'FICHA DE PAGO', 0.04);

  // Header
  drawHeader(page, bold, regular);
  let y = PAGE_H - MARGIN - 56;

  // Band
  y = drawBand(page, bold, regular, 'FICHA DE PAGO — DERECHO DE EXAMEN',
    `${data.etapaNombre} · ${METODO_LABELS[data.metodo]}`, mainColor, y);

  // ── Datos del solicitante ─────────────────────────────────────────────
  y = drawSectionHeading(page, bold, 'Datos del solicitante', y);
  const col1 = MARGIN;
  const col2 = MARGIN + (PAGE_W - 2 * MARGIN) / 2 + 10;
  const colW = (PAGE_W - 2 * MARGIN) / 2 - 20;

  row(page, bold, regular, 'Nombre completo', data.nombreCompleto, col1, y, colW * 2 + 20);
  y -= 24;
  row(page, bold, regular, 'CURP', data.curp ?? '—', col1, y, colW);
  row(page, bold, regular, 'Convocatoria', data.etapaNombre, col2, y, colW);
  y -= 24;
  drawLine(page, MARGIN, y + 8, PAGE_W - MARGIN, y + 8);
  y -= 14;

  // ── Instrucciones de pago ─────────────────────────────────────────────
  y = drawSectionHeading(page, bold, 'Instrucciones de pago', y);

  if (data.metodo === 'spei') {
    y = drawBox(page, bold, regular, [
      { label: 'Banco destino',   value: data.banco },
      { label: 'Beneficiario',    value: data.titular },
      { label: 'CLABE interbancaria', value: data.clabe },
      { label: 'Concepto',        value: `PREPARATORIA ABIERTA — ${data.referencia}` },
      { label: 'Monto exacto',    value: `$${data.monto.toFixed(2)} MXN` },
    ], MARGIN, y, PAGE_W - 2 * MARGIN, lightColor);

    y -= 8;
    y = drawStepList(page, bold, regular, [
      'Accede a tu banca en línea o app de tu banco.',
      'Selecciona "Transferencia SPEI" e ingresa la CLABE de 18 dígitos mostrada arriba.',
      'Ingresa el monto EXACTO de $' + data.monto.toFixed(2) + ' MXN.',
      `En el campo "Concepto" o "Referencia" escribe: PREPARATORIA ABIERTA — ${data.referencia}`,
      'Guarda el comprobante con número de operación y súbelo al portal.',
    ], MARGIN, y - 4);

  } else if (data.metodo === 'banco_deposito') {
    y = drawBox(page, bold, regular, [
      { label: 'Banco',           value: data.banco },
      { label: 'Beneficiario',    value: data.titular },
      { label: 'CLABE',           value: data.clabe },
      ...(data.numeroCuenta ? [{ label: 'Número de cuenta', value: data.numeroCuenta }] : []),
      { label: 'Referencia',      value: data.referencia },
      { label: 'Monto exacto',    value: `$${data.monto.toFixed(2)} MXN` },
    ], MARGIN, y, PAGE_W - 2 * MARGIN, lightColor);

    y -= 8;
    y = drawStepList(page, bold, regular, [
      'Acude a cualquier sucursal del banco indicado.',
      'Solicita un "Depósito en ventanilla" con los datos de esta ficha.',
      `Indica la referencia: ${data.referencia} y el monto EXACTO de $${data.monto.toFixed(2)} MXN.`,
      'Conserva el ticket con sello y número de autorización del banco.',
      'Sube el comprobante escaneado o fotografiado al portal.',
    ], MARGIN, y - 4);

  } else {
    // tienda_conveniencia
    const convenioStr = data.convenio ?? '(ver con tu gestor)';
    y = drawBox(page, bold, regular, [
      { label: 'Empresa / Institución', value: data.titular },
      ...(data.convenio ? [{ label: 'Número de convenio CIE', value: convenioStr }] : []),
      { label: 'Referencia de pago',   value: data.referencia },
      { label: 'Monto exacto',         value: `$${data.monto.toFixed(2)} MXN` },
      { label: 'Establecimientos',     value: 'OXXO · 7-Eleven · Farmacias del Ahorro · Círculo K' },
    ], MARGIN, y, PAGE_W - 2 * MARGIN, lightColor);

    y -= 8;
    y = drawStepList(page, bold, regular, [
      'Acude a cualquier tienda participante: OXXO, 7-Eleven, Farmacias del Ahorro o Círculo K.',
      'Indica al cajero que deseas realizar un "Pago de servicio" o "Pago de convenio".',
      ...(data.convenio ? [`Proporciona el número de convenio CIE: ${convenioStr}`] : []),
      `Proporciona la referencia: ${data.referencia} y el monto de $${data.monto.toFixed(2)} MXN.`,
      'Conserva el ticket impreso de la tienda y súbelo al portal.',
    ], MARGIN, y - 4);
  }

  y -= 14;

  // ── Monto destacado ───────────────────────────────────────────────────
  const montoBoxH = 52;
  drawRect(page, MARGIN, y - montoBoxH, PAGE_W - 2 * MARGIN, montoBoxH, lightColor);
  page.drawRectangle({ x: MARGIN, y: y - montoBoxH, width: PAGE_W - 2 * MARGIN, height: montoBoxH, borderColor: mainColor, borderWidth: 1, opacity: 0 });

  drawText(page, 'MONTO A PAGAR (EXACTO)', MARGIN + 16, y - 14, bold, 8, mainColor);
  const montoStr = `$${data.monto.toFixed(2)} MXN`;
  drawText(page, montoStr, MARGIN + 16, y - 34, bold, 22, mainColor);
  drawText(page, `Referencia: ${data.referencia}`, PAGE_W - MARGIN - 180, y - 26, regular, 9, GRIS);
  drawText(page, `Generado: ${fmtFecha(data.generadoEn)}`, PAGE_W - MARGIN - 180, y - 38, regular, 8.5, GRIS);

  y = y - montoBoxH - 14;

  // ── Nota legal ────────────────────────────────────────────────────────
  const notaH = 48;
  drawRect(page, MARGIN, y - notaH, PAGE_W - 2 * MARGIN, notaH, GRIS_L);
  drawText(page, 'IMPORTANTE', MARGIN + 12, y - 14, bold, 8, mainColor);
  const notas = [
    '• El monto debe ser EXACTO. Pagos con diferencia de centavos no serán reconocidos.',
    '• Una vez realizado el pago, súbelo al portal en la sección "Inscripción" dentro de los siguientes 3 días hábiles.',
    '• Esta ficha tiene validez para la convocatoria indicada y no puede ser utilizada para otros conceptos.',
  ];
  let ny = y - 26;
  for (const nota of notas) {
    drawText(page, nota, MARGIN + 12, ny, regular, 7.5, GRIS, PAGE_W - 2 * MARGIN - 24);
    ny -= 11;
  }

  // Footer
  drawFooter(page, regular, `CURP: ${data.curp ?? '—'}`, `Convocatoria: ${data.etapaClave}`);

  // Corners
  drawCorners(page);

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC: Ficha de pre-registro
// ═══════════════════════════════════════════════════════════════════════════

export interface PreregistroData {
  folio: string;
  generadoEn: Date | string;
  vigenteHasta: Date | string | null;
  nombreCompleto: string;
  curp: string | null;
  fechaNacimiento: Date | string | null;
  genero: string | null;
  nacionalidad: string | null;
  telefono: string | null;
  email: string;
  municipio: string | null;
  gestor: { nombre: string; email: string | null } | null;
  fotoPath: string | null;
  qrVerifUrl: string;
}

export async function generarFichaPreregistro(data: PreregistroData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const bold    = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);

  const ahora = new Date();
  const vigencia = data.vigenteHasta ? new Date(data.vigenteHasta) : null;
  const estaVencido = vigencia ? vigencia < ahora : false;
  const diasRestantes = vigencia ? Math.ceil((vigencia.getTime() - ahora.getTime()) / 86400000) : null;

  // Watermark background
  drawWatermark(page, bold, 'PREPARATORIA ABIERTA');
  if (estaVencido) {
    drawWatermark(page, bold, 'VENCIDO', 0.12);
  }

  // Header
  drawHeader(page, bold, regular);
  let y = PAGE_H - MARGIN - 56;

  // Band
  y = drawBand(page, bold, regular, 'FICHA DE PRE-REGISTRO', 'Comprobante de inicio de trámite · Norma DGB22DR-001', GUINDA, y);

  // ── Folio box with vigencia pill ───────────────────────────────────────
  const folioBoxH = 72;
  const folioBoxY = y;
  const folioBoxBg = estaVencido ? rgb(0.99, 0.94, 0.94) : rgb(0.97, 0.95, 0.91);
  drawRect(page, MARGIN, folioBoxY - folioBoxH, PAGE_W - 2 * MARGIN, folioBoxH, folioBoxBg);
  page.drawRectangle({ x: MARGIN, y: folioBoxY - folioBoxH, width: 4, height: folioBoxH, color: GUINDA });

  // Folio label
  drawText(page, 'FOLIO DE PRE-REGISTRO', MARGIN + 16, folioBoxY - 16, bold, 7, GUINDA);
  // Folio value (large monospace-like)
  drawText(page, data.folio, MARGIN + 16, folioBoxY - 34, bold, 16, GUINDA);

  // Vigencia pill
  const pillLabel = estaVencido ? 'VENCIDO' : (diasRestantes !== null && diasRestantes <= 3 ? 'POR VENCER' : '15 días hábiles');
  const pillBg = estaVencido ? rgb(0.99, 0.86, 0.86) : (diasRestantes !== null && diasRestantes <= 3 ? rgb(1, 0.96, 0.8) : rgb(1, 0.97, 0.85));
  const pillColor = estaVencido ? rgb(0.72, 0.08, 0.08) : (diasRestantes !== null && diasRestantes <= 3 ? rgb(0.7, 0.4, 0.02) : rgb(0.55, 0.37, 0));
  const pillW = 80;
  const pillX = PAGE_W - MARGIN - pillW - 12;
  drawRect(page, pillX, folioBoxY - 30, pillW, 18, pillBg);
  drawText(page, pillLabel, pillX + 6, folioBoxY - 22, bold, 7, pillColor);

  // Dates row
  drawText(page, `Generado: ${fmtFecha(data.generadoEn)}`, MARGIN + 16, folioBoxY - 54, regular, 8.5, GRIS);
  if (vigencia) {
    const vigLabel = estaVencido ? `Venció: ${fmtFecha(vigencia)}` : `Vigente hasta: ${fmtFecha(vigencia)}`;
    drawText(page, vigLabel, MARGIN + 220, folioBoxY - 54, regular, 8.5, estaVencido ? rgb(0.72, 0.08, 0.08) : GRIS);
  }

  y = folioBoxY - folioBoxH - 14;

  // ── Datos del aspirante ───────────────────────────────────────────────
  y = drawSectionHeading(page, bold, 'Datos del aspirante', y);

  // Photo slot — right column, if photo available
  let fotoEmbedded = false;
  const fotoW = 72;
  const fotoH = 90;
  const fotoX = PAGE_W - MARGIN - fotoW;
  const fotoY = y + 4;

  if (data.fotoPath && (await archivoExiste(data.fotoPath))) {
    try {
      const fotoBytes = await archivoBuffer(data.fotoPath);
      const fotoImg = fotoBytes[0] === 0x89 // PNG magic bytes
        ? await doc.embedPng(fotoBytes)
        : await doc.embedJpg(fotoBytes);
      page.drawRectangle({ x: fotoX - 3, y: fotoY - fotoH - 3, width: fotoW + 6, height: fotoH + 6, color: GUINDA });
      // Foto estilo "cover": llena el recuadro sin deformar (escala al lado mayor)
      // y recorta el sobrante con un clip.
      const bx = fotoX, by = fotoY - fotoH;
      const s = Math.max(fotoW / fotoImg.width, fotoH / fotoImg.height);
      const w = fotoImg.width * s, h = fotoImg.height * s;
      page.pushOperators(
        pushGraphicsState(),
        moveTo(bx, by), lineTo(bx + fotoW, by), lineTo(bx + fotoW, by + fotoH), lineTo(bx, by + fotoH), closePath(),
        clip(), endPath(),
      );
      page.drawImage(fotoImg, { x: bx + (fotoW - w) / 2, y: by + (fotoH - h) / 2, width: w, height: h });
      page.pushOperators(popGraphicsState());
      fotoEmbedded = true;
    } catch { /* skip photo if unreadable */ }
  }

  const contentMaxX = fotoEmbedded ? fotoX - 12 : PAGE_W - MARGIN;
  const col1 = MARGIN;
  const col2 = MARGIN + (contentMaxX - MARGIN) / 2 + 8;
  const colW = (contentMaxX - MARGIN) / 2 - 16;

  row(page, bold, regular, 'Nombre completo', data.nombreCompleto, col1, y, fotoEmbedded ? contentMaxX - MARGIN : colW * 2);
  y -= 22;
  row(page, bold, regular, 'CURP', data.curp ?? '—', col1, y, colW);
  row(page, bold, regular, 'Fecha de nacimiento', fmtFecha(data.fechaNacimiento), col2, y, colW);
  y -= 22;
  row(page, bold, regular, 'Género', data.genero ?? 'No especificado', col1, y, colW);
  row(page, bold, regular, 'Nacionalidad', data.nacionalidad ?? 'Mexicana', col2, y, colW);
  y -= 22;

  // If photo was embedded, ensure y doesn't overlap with photo
  if (fotoEmbedded) {
    y = Math.min(y, fotoY - fotoH - 12);
  }

  drawLine(page, MARGIN, y + 6, PAGE_W - MARGIN, y + 6);
  y -= 14;

  // ── Datos de contacto ─────────────────────────────────────────────────
  y = drawSectionHeading(page, bold, 'Datos de contacto', y);
  row(page, bold, regular, 'Correo electrónico', data.email, col1, y, colW * 2 + 20);
  y -= 22;
  row(page, bold, regular, 'Teléfono', data.telefono ?? '—', col1, y, colW);
  row(page, bold, regular, 'Municipio / Estado', `${data.municipio ?? '—'}, Michoacán`, col2, y, colW);
  y -= 22;

  drawLine(page, MARGIN, y + 6, PAGE_W - MARGIN, y + 6);
  y -= 14;

  // ── Gestor municipal ──────────────────────────────────────────────────
  y = drawSectionHeading(page, bold, 'Gestor municipal asignado', y);
  if (data.gestor) {
    row(page, bold, regular, 'Nombre del gestor', data.gestor.nombre, col1, y, colW);
    if (data.gestor.email) {
      row(page, bold, regular, 'Correo del gestor', data.gestor.email, col2, y, colW);
    }
  } else {
    drawText(page, 'Sin gestor asignado · Auto-gestión', col1, y, regular, 9, GRIS);
  }
  y -= 22;

  drawLine(page, MARGIN, y + 6, PAGE_W - MARGIN, y + 6);
  y -= 14;

  // ── Siguientes pasos ─────────────────────────────────────────────────
  y = drawSectionHeading(page, bold, 'Siguientes pasos para completar tu inscripción', y);
  y = drawStepList(page, bold, regular, [
    'Subir los documentos requeridos: CURP, acta de nacimiento, identificación oficial (INE) y certificado de secundaria.',
    'Esperar la validación de los documentos por parte de la administración (3 a 5 días hábiles).',
    'Asistir a la plática informativa requerida por la DGB.',
    'Una vez asignada tu matrícula oficial por la SEP-DGB, solicita la inscripción a tus módulos (exámenes) con tu gestor o administrador.',
  ], MARGIN, y - 4);

  y -= 12;

  // ── Notas legales + QR ────────────────────────────────────────────────
  const notasH = 68;
  const qrSize = 62;
  const qrX = PAGE_W - MARGIN - qrSize;
  const qrY = y - notasH + qrSize + 4;

  drawRect(page, MARGIN, y - notasH, PAGE_W - 2 * MARGIN, notasH, GRIS_L);
  drawText(page, 'NOTAS LEGALES', MARGIN + 12, y - 14, bold, 7.5, GUINDA);
  const notas = [
    '• Este documento NO sustituye la matrícula oficial DGB.',
    `• Vigencia: 15 días hábiles a partir de la fecha de generación (norma DGB22DR-001).`,
    '• La matrícula oficial es asignada exclusivamente por la Secretaría de Educación Pública (SEP-DGB).',
    '• Escanee el código QR para verificar la autenticidad de este documento.',
  ];
  let ny = y - 26;
  const notasMaxX = qrX - MARGIN - 16;
  for (const nota of notas) {
    drawText(page, nota, MARGIN + 12, ny, regular, 7.5, GRIS, notasMaxX - 12);
    ny -= 11;
  }

  // Embed QR code
  try {
    const qrBuf = await QRCode.toBuffer(data.qrVerifUrl, { width: 180, margin: 1, color: { dark: '#1c1917', light: '#f5f5f4' } });
    const qrImg = await doc.embedPng(qrBuf);
    page.drawImage(qrImg, { x: qrX, y: qrY - qrSize, width: qrSize, height: qrSize });
    drawText(page, 'Verificar', qrX + (qrSize - bold.widthOfTextAtSize('Verificar', 6.5)) / 2, qrY - qrSize - 8, regular, 6.5, GRIS);
  } catch { /* skip QR if fails */ }

  // Footer
  drawFooter(page, regular, `Folio: ${data.folio}`, `Generado: ${fmtFecha(data.generadoEn)}`);

  // Decorative corners (on top of everything)
  drawCorners(page);

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC: Ficha de registro oficial
// ═══════════════════════════════════════════════════════════════════════════

export interface ExamenInscritoRegistro {
  moduloNumero: number;
  moduloNombre: string;
  fechaExamen: string | null;
  dia: string;
  hora: string;
  sedeNombre: string;
  etapaClave: string;
}

export interface RegistroOficialData {
  matricula: string;
  folio: string;
  nombreCompleto: string;
  curp: string | null;
  fechaNacimiento: Date | string | null;
  telefono: string | null;
  email: string;
  municipio: string | null;
  gestor: { nombre: string } | null;
  matriculaCapturadaEn: Date | string | null;
  documentosValidados: { tipo: string; validadoEn: Date | string | null }[];
  pagos: { concepto: string; monto: string; verificadoEn: Date | string | null }[];
  examenesInscritos?: ExamenInscritoRegistro[];
}

export async function generarFichaRegistro(data: RegistroOficialData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_W, PAGE_H]);

  const bold    = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);

  // Header
  drawHeader(page, bold, regular);
  let y = PAGE_H - MARGIN - 56;

  // Band — green
  y = drawBand(page, bold, regular, 'FICHA DE REGISTRO OFICIAL', 'Constancia de inscripción a Preparatoria Abierta', VERDE, y);

  // Matrícula box — green
  y = drawBox(page, bold, regular, [
    { label: 'Matrícula oficial DGB', value: data.matricula },
    { label: 'Folio interno',         value: data.folio },
    { label: 'Estado',                value: 'ACTIVO' },
    { label: 'Fecha de registro',     value: fmtFecha(data.matriculaCapturadaEn) },
  ], MARGIN, y, PAGE_W - 2 * MARGIN, VERDE_L);

  // Datos del estudiante
  y = drawSectionHeading(page, bold, 'Datos del estudiante', y);

  const col1 = MARGIN;
  const col2 = MARGIN + (PAGE_W - 2 * MARGIN) / 2 + 10;
  const colW = (PAGE_W - 2 * MARGIN) / 2 - 20;

  row(page, bold, regular, 'Nombre completo', data.nombreCompleto, col1, y, colW * 2);
  y -= 30;
  row(page, bold, regular, 'CURP', data.curp ?? '—', col1, y, colW);
  row(page, bold, regular, 'Fecha de nacimiento', fmtFecha(data.fechaNacimiento), col2, y, colW);
  y -= 30;
  row(page, bold, regular, 'Correo electrónico', data.email, col1, y, colW);
  row(page, bold, regular, 'Teléfono', data.telefono ?? '—', col2, y, colW);
  y -= 30;
  row(page, bold, regular, 'Municipio', `${data.municipio ?? '—'}, Michoacán`, col1, y, colW);
  if (data.gestor) row(page, bold, regular, 'Gestor municipal', data.gestor.nombre, col2, y, colW);
  y -= 30;

  row(page, bold, regular, 'Coordinación', 'Michoacán', col1, y, colW);
  row(page, bold, regular, 'Plan de estudios', 'Modular — 21 módulos', col2, y, colW);
  y -= 30;

  drawLine(page, MARGIN, y + 8, PAGE_W - MARGIN, y + 8);
  y -= 12;

  // Documentos validados
  if (data.documentosValidados.length > 0) {
    y = drawSectionHeading(page, bold, 'Validación documental', y);
    const TIPO_LABELS: Record<string, string> = {
      curp: 'CURP',
      acta_nacimiento: 'Acta de nacimiento',
      ine: 'Identificación oficial (INE)',
      comprobante_domicilio: 'Comprobante de domicilio',
      foto: 'Fotografía',
      certificado_secundaria: 'Certificado de secundaria',
      comprobante_pago: 'Comprobante de pago',
    };
    for (const doc of data.documentosValidados) {
      const label = TIPO_LABELS[doc.tipo] ?? doc.tipo;
      drawText(page, '[OK]', col1, y, bold, 7.5, VERDE);
      drawText(page, label, col1 + 14, y, regular, 9, NEGRO);
      if (doc.validadoEn) {
        drawText(page, `validado el ${fmtFecha(doc.validadoEn)}`, col2, y, regular, 8.5, GRIS);
      }
      y -= 16;
    }
    y -= 8;
    drawLine(page, MARGIN, y + 4, PAGE_W - MARGIN, y + 4);
    y -= 12;
  }

  // ── Convocatoria e inscripción a exámenes ─────────────────────────────────
  if (data.examenesInscritos && data.examenesInscritos.length > 0) {
    y = drawSectionHeading(page, bold, 'Convocatoria e inscripcion a examenes', y);

    const etapaClave = data.examenesInscritos[0].etapaClave;
    drawText(page, `Convocatoria: ${etapaClave}`, col1, y, bold, 9, NEGRO);
    y -= 20;

    const MESES_CORTO = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

    function fmtFechaCorta(ds: string | null): string {
      if (!ds) return '—';
      const [yr, mo, dy] = ds.split('-').map(Number);
      return `${dy} ${MESES_CORTO[mo - 1]} ${yr}`;
    }

    for (const ex of data.examenesInscritos) {
      const diaSemana = ex.dia === 'sabado' ? 'Sab' : 'Dom';
      const fechaStr  = fmtFechaCorta(ex.fechaExamen);
      const horaStr   = `${ex.hora} hrs`;
      const lineLeft  = `M${ex.moduloNumero}  ${ex.moduloNombre}`;
      const lineRight = `${diaSemana} ${fechaStr} · ${horaStr} · ${ex.sedeNombre}`;

      drawText(page, lineLeft,  col1,       y, bold,    8.5, NEGRO, colW * 2 - 10);
      drawText(page, lineRight, col1,       y - 12, regular, 7.5, GRIS, PAGE_W - 2 * MARGIN);
      y -= 26;
    }

    drawLine(page, MARGIN, y + 4, PAGE_W - MARGIN, y + 4);
    y -= 12;
  }

  // Notas legales
  const notasH = 60;
  drawRect(page, MARGIN, y - notasH, PAGE_W - 2 * MARGIN, notasH, GRIS_L);
  drawText(page, 'NOTAS LEGALES', MARGIN + 12, y - 14, bold, 7.5, VERDE);
  const notas = [
    '• Este documento certifica el registro del estudiante en el sistema estatal de Preparatoria Abierta Michoacan.',
    '• La matricula oficial DGB es UNICA, INTRANSFERIBLE y VALIDA EN TODO EL PAIS.',
    '• Conserve este documento para futuros tramites con la SEP-DGB.',
  ];
  let ny = y - 26;
  for (const nota of notas) {
    drawText(page, nota, MARGIN + 12, ny, regular, 8, GRIS, PAGE_W - 2 * MARGIN - 24);
    ny -= 12;
  }

  // Footer
  drawFooter(page, regular, `Matricula: ${data.matricula}`, `Folio interno: ${data.folio}`);

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
