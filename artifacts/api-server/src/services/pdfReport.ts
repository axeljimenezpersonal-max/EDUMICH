import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from 'pdf-lib';
import type { ReporteData } from './excelGenerator';
import { winAnsiSafe } from '../utils/pdfText';

const GUINDA = rgb(0.42, 0.06, 0.24);
const GUINDA_LIGHT = rgb(0.96, 0.9, 0.94);
const GOLD = rgb(0.75, 0.56, 0.0);
const WHITE = rgb(1, 1, 1);
const BLACK = rgb(0, 0, 0);
const GREY = rgb(0.5, 0.5, 0.5);
const GREY_BG = rgb(0.95, 0.95, 0.95);

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;

function drawRect(page: PDFPage, x: number, y: number, w: number, h: number, fill: ReturnType<typeof rgb>) {
  page.drawRectangle({ x, y, width: w, height: h, color: fill });
}

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  color = BLACK,
  maxWidth?: number
) {
  const safeText = winAnsiSafe(text).slice(0, 200);
  if (maxWidth) {
    let display = safeText;
    while (display.length > 3 && font.widthOfTextAtSize(display, size) > maxWidth) {
      display = display.slice(0, -1);
    }
    if (display !== safeText) display = display.slice(0, -3) + '...';
    page.drawText(display, { x, y, size, font, color });
  } else {
    page.drawText(safeText, { x, y, size, font, color });
  }
}

function addHeader(page: PDFPage, boldFont: PDFFont, regularFont: PDFFont, title: string, pageNum: number, total: number) {
  // Guinda header bar
  drawRect(page, 0, PAGE_H - 50, PAGE_W, 50, GUINDA);
  drawText(page, 'PREPARATORIA ABIERTA MICHOACAN — Sistema de Gestion Escolar', MARGIN, PAGE_H - 20, boldFont, 11, WHITE);
  drawText(page, title, MARGIN, PAGE_H - 38, regularFont, 9, GOLD);
  const pageLabel = `Pag. ${pageNum}/${total}`;
  const pw = regularFont.widthOfTextAtSize(pageLabel, 9);
  drawText(page, pageLabel, PAGE_W - MARGIN - pw, PAGE_H - 34, regularFont, 9, WHITE);
}

function addFooter(page: PDFPage, regularFont: PDFFont, generadoEn: Date) {
  const footerY = 20;
  drawRect(page, 0, 0, PAGE_W, footerY + 10, GUINDA);
  const dateStr = generadoEn.toLocaleString('es-MX');
  drawText(page, `Generado: ${dateStr}`, MARGIN, footerY, regularFont, 7, WHITE);
  const disclaimer = 'EDUMICH · Preparatoria Abierta · IEMSyS Michoacan';
  const dw = regularFont.widthOfTextAtSize(disclaimer, 7);
  drawText(page, disclaimer, PAGE_W - MARGIN - dw, footerY, regularFont, 7, GOLD);
}

export async function generarPDFReporte(data: ReporteData): Promise<Buffer> {
  // ── Pre-calculate page count ──
  const ROWS_PER_PAGE = 30;
  const dataPages = Math.max(1, Math.ceil(data.filas.length / ROWS_PER_PAGE));
  const totalPages = 1 + 1 + dataPages; // portada + resumen + data pages

  const pdfDoc = await PDFDocument.create();
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // ────────────────────────────────────────────────────────────
  // Página 1 — Portada
  // ────────────────────────────────────────────────────────────
  const portada = pdfDoc.addPage([PAGE_W, PAGE_H]);

  // Full guinda top block
  drawRect(portada, 0, PAGE_H - 220, PAGE_W, 220, GUINDA);

  // Institution name
  drawText(portada, 'EDUMICH · Preparatoria Abierta', MARGIN, PAGE_H - 80, boldFont, 22, WHITE);
  drawText(portada, 'Sistema de Gestion Escolar — IEMSyS Michoacan', MARGIN, PAGE_H - 105, regularFont, 13, GOLD);

  // Gold divider
  drawRect(portada, MARGIN, PAGE_H - 125, CONTENT_W, 2, GOLD);

  // Report name
  const reportTitle = data.nombre.toUpperCase();
  drawText(portada, reportTitle, MARGIN, PAGE_H - 160, boldFont, 16, WHITE, CONTENT_W);

  // Type badge
  const badge = data.tipo.replace(/_/g, ' ').toUpperCase();
  drawRect(portada, MARGIN, PAGE_H - 195, 180, 22, GOLD);
  drawText(portada, badge, MARGIN + 8, PAGE_H - 186, boldFont, 9, GUINDA);

  // Metadata block
  const metaY = PAGE_H - 300;
  drawRect(portada, MARGIN, metaY - 10, CONTENT_W, 110, GUINDA_LIGHT);

  const metas: [string, string][] = [
    ['Generado el:', data.generadoEn.toLocaleString('es-MX')],
    ['Generado por:', data.generadoPor],
    ['Total registros:', String(data.filas.length)],
    [
      'Periodo:',
      data.filtros.fechaInicio && data.filtros.fechaFin
        ? `${data.filtros.fechaInicio} al ${data.filtros.fechaFin}`
        : 'General',
    ],
  ];
  metas.forEach(([label, val], i) => {
    const y = metaY + 80 - i * 22;
    drawText(portada, label, MARGIN + 12, y, boldFont, 10, GUINDA);
    drawText(portada, val, MARGIN + 140, y, regularFont, 10, BLACK);
  });

  // KPIs in boxes
  const kpiY = metaY - 60;
  const kpiBoxW = (CONTENT_W - 20) / Math.min(data.kpis.length, 4);
  data.kpis.slice(0, 4).forEach((kpi, i) => {
    const bx = MARGIN + i * (kpiBoxW + 5);
    drawRect(portada, bx, kpiY - 55, kpiBoxW, 60, GUINDA_LIGHT);
    drawRect(portada, bx, kpiY + 5 - 55, kpiBoxW, 4, GUINDA);
    drawText(portada, String(kpi.valor), bx + 8, kpiY - 20, boldFont, 16, GUINDA, kpiBoxW - 16);
    drawText(portada, kpi.label, bx + 8, kpiY - 40, regularFont, 8, GREY, kpiBoxW - 16);
  });

  addFooter(portada, regularFont, data.generadoEn);

  // ────────────────────────────────────────────────────────────
  // Página 2 — Resumen de KPIs
  // ────────────────────────────────────────────────────────────
  const resumen = pdfDoc.addPage([PAGE_W, PAGE_H]);
  addHeader(resumen, boldFont, regularFont, data.nombre, 2, totalPages);
  addFooter(resumen, regularFont, data.generadoEn);

  drawText(resumen, 'INDICADORES CLAVE DE RENDIMIENTO', MARGIN, PAGE_H - 75, boldFont, 13, GUINDA);
  drawRect(resumen, MARGIN, PAGE_H - 82, CONTENT_W, 2, GOLD);

  // KPI table
  let kpiTableY = PAGE_H - 100;
  for (const kpi of data.kpis) {
    drawRect(resumen, MARGIN, kpiTableY - 22, CONTENT_W, 24, GUINDA_LIGHT);
    drawText(resumen, kpi.label, MARGIN + 8, kpiTableY - 14, regularFont, 10, BLACK, CONTENT_W / 2);
    const valStr = `${kpi.valor}${kpi.unidad ? ' ' + kpi.unidad : ''}`;
    const vw = boldFont.widthOfTextAtSize(valStr, 12);
    drawText(resumen, valStr, PAGE_W - MARGIN - vw - 8, kpiTableY - 13, boldFont, 12, GUINDA);
    kpiTableY -= 28;
    if (kpiTableY < 60) break;
  }

  // ────────────────────────────────────────────────────────────
  // Páginas de datos
  // ────────────────────────────────────────────────────────────
  const COL_W = Math.floor(CONTENT_W / Math.min(data.columnas.length, 8));
  const visibleCols = data.columnas.slice(0, 8);

  for (let p = 0; p < dataPages; p++) {
    const dataPage = pdfDoc.addPage([PAGE_W, PAGE_H]);
    addHeader(dataPage, boldFont, regularFont, data.nombre, p + 3, totalPages);
    addFooter(dataPage, regularFont, data.generadoEn);

    let rowY = PAGE_H - 75;

    // Column headers
    drawRect(dataPage, MARGIN, rowY - 18, CONTENT_W, 22, GUINDA);
    visibleCols.forEach((col, ci) => {
      drawText(dataPage, col, MARGIN + ci * COL_W + 4, rowY - 12, boldFont, 8, WHITE, COL_W - 8);
    });
    rowY -= 24;

    const startRow = p * ROWS_PER_PAGE;
    const endRow = Math.min(startRow + ROWS_PER_PAGE, data.filas.length);

    for (let ri = startRow; ri < endRow; ri++) {
      const fila = data.filas[ri];
      const isAlt = (ri - startRow) % 2 === 1;
      if (isAlt) drawRect(dataPage, MARGIN, rowY - 14, CONTENT_W, 17, GREY_BG);

      visibleCols.forEach((_col, ci) => {
        const val = fila[ci] == null ? '—' : String(fila[ci]);
        drawText(dataPage, val, MARGIN + ci * COL_W + 4, rowY - 10, regularFont, 7.5, BLACK, COL_W - 8);
      });
      rowY -= 17;
    }
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}
