/**
 * Ficha de depósito de un PAGO GRUPAL (gestor) — Preparatoria Abierta Michoacán.
 *
 * El gestor paga N exámenes de una sola vez ante la Tesorería / Secretaría de
 * Finanzas del Estado de Michoacán (formato de pago de derechos) y usa esta
 * ficha como referencia interna: lista de alumnos/exámenes cubiertos, total y
 * el FOLIO con el que la administración concilia el comprobante.
 */
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import {
  pagosGrupales,
  pagosGrupalesExamenes,
  estudiantes,
  modulos,
  examenesInscripciones,
  gestores,
  municipios,
} from '@workspace/db/schema';
import { winAnsiSafe } from '../utils/pdfText';

const GUINDA = rgb(0.42, 0.08, 0.19);
const GUINDA_D = rgb(0.3, 0.05, 0.14);
const CREMA = rgb(0.97, 0.95, 0.91);
const GRIS = rgb(0.42, 0.4, 0.38);
const NEGRO = rgb(0.12, 0.12, 0.12);
const LINEA = rgb(0.85, 0.83, 0.8);

const A4 = { w: 595.28, h: 841.89 };
const M = 44;

function fmtMoney(n: number): string {
  return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
}

export async function generarFichaPagoGrupal(
  pagoGrupalId: number
): Promise<{ pdf: Uint8Array; nombreArchivo: string }> {
  const [pg] = await db.select().from(pagosGrupales).where(eq(pagosGrupales.id, pagoGrupalId));
  if (!pg) throw new Error('Pago grupal no encontrado');

  const [gestor] = await db
    .select({ nombre: gestores.nombreCompleto, municipioId: gestores.municipioId })
    .from(gestores)
    .where(eq(gestores.userId, pg.gestorId));
  const [muni] = gestor?.municipioId
    ? await db.select({ nombre: municipios.nombre }).from(municipios).where(eq(municipios.id, gestor.municipioId))
    : [null];

  const items = await db
    .select({
      alumno: estudiantes.nombreCompleto,
      curp: estudiantes.curp,
      moduloNumero: modulos.numero,
      moduloNombre: modulos.nombre,
      folioExamen: examenesInscripciones.folio,
      monto: pagosGrupalesExamenes.monto,
    })
    .from(pagosGrupalesExamenes)
    .leftJoin(estudiantes, eq(pagosGrupalesExamenes.estudianteId, estudiantes.userId))
    .leftJoin(examenesInscripciones, eq(pagosGrupalesExamenes.examenInscripcionId, examenesInscripciones.id))
    .leftJoin(modulos, eq(examenesInscripciones.moduloId, modulos.id))
    .where(eq(pagosGrupalesExamenes.pagoGrupalId, pagoGrupalId));

  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  let page = doc.addPage([A4.w, A4.h]);
  let y = 0;

  const text = (s: string, x: number, size: number, opts: { font?: PDFFont; color?: ReturnType<typeof rgb>; pg?: PDFPage } = {}) => {
    (opts.pg ?? page).drawText(winAnsiSafe(s), { x, y, size, font: opts.font ?? reg, color: opts.color ?? NEGRO });
  };

  // ── Encabezado ──
  page.drawRectangle({ x: 0, y: A4.h - 92, width: A4.w, height: 92, color: GUINDA });
  page.drawRectangle({ x: 0, y: A4.h - 96, width: A4.w, height: 4, color: GUINDA_D });
  y = A4.h - 40;
  text('PREPARATORIA ABIERTA — MICHOACÁN', M, 9, { font: bold, color: rgb(1, 1, 1) });
  y = A4.h - 62;
  text('Ficha de depósito — Pago grupal de exámenes', M, 18, { font: bold, color: rgb(1, 1, 1) });
  y = A4.h - 80;
  text('Pago de derechos ante la Tesorería del Estado de Michoacán', M, 9, { color: CREMA });

  // ── Folio + gestor ──
  y = A4.h - 124;
  page.drawRectangle({ x: M, y: y - 14, width: A4.w - 2 * M, height: 44, color: CREMA });
  text('FOLIO DE REFERENCIA', M + 12, 7, { font: bold, color: GRIS });
  y -= 14 + -26; // label arriba, folio abajo
  y = A4.h - 124 - 8;
  page.drawText(winAnsiSafe(pg.folio), { x: M + 12, y, size: 17, font: bold, color: GUINDA });
  page.drawText(winAnsiSafe(`Generada: ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Mexico_City' })}`), {
    x: A4.w - M - 150, y: y + 2, size: 9, font: reg, color: GRIS,
  });

  y = A4.h - 168;
  const campo = (label: string, valor: string, x: number) => {
    page.drawText(winAnsiSafe(label.toUpperCase()), { x, y, size: 7, font: bold, color: GRIS });
    page.drawText(winAnsiSafe(valor || '—'), { x, y: y - 12, size: 10, font: reg, color: NEGRO });
  };
  campo('Gestor responsable', gestor?.nombre ?? '—', M);
  campo('Centro de servicios', muni?.nombre ?? '—', 340);
  y -= 34;

  // ── Instrucciones ──
  page.drawLine({ start: { x: M, y }, end: { x: A4.w - M, y }, thickness: 1, color: LINEA });
  y -= 16;
  const instrucciones = [
    '1. Realiza el pago de derechos en la Tesorería / Secretaría de Finanzas del Estado (formato de pago).',
    '2. Conserva tu comprobante (línea de captura / recibo oficial).',
    `3. Sube el comprobante a la plataforma en Pagos, indicando este folio: ${pg.folio}.`,
    '4. La administración verificará el pago y los exámenes quedarán cubiertos.',
  ];
  for (const linea of instrucciones) {
    text(linea, M, 8.5, { color: GRIS });
    y -= 12;
  }
  y -= 8;

  // ── Tabla de exámenes ──
  const cols = [
    { t: '#', x: M, w: 22 },
    { t: 'ALUMNO', x: M + 24, w: 170 },
    { t: 'CURP', x: M + 198, w: 118 },
    { t: 'MÓDULO', x: M + 320, w: 130 },
    { t: 'FOLIO EXAMEN', x: M + 428, w: 80 },
    { t: 'MONTO', x: A4.w - M - 45, w: 45 },
  ];
  const header = () => {
    y -= 16;
    page.drawRectangle({ x: M, y: y - 4, width: A4.w - 2 * M, height: 16, color: CREMA });
    cols.forEach((c) => page.drawText(winAnsiSafe(c.t), { x: c.x + 2, y, size: 7, font: bold, color: GUINDA }));
    y -= 14;
  };
  header();

  let i = 0;
  for (const it of items) {
    if (y < 96) {
      page = doc.addPage([A4.w, A4.h]);
      y = A4.h - M;
      header();
    }
    i += 1;
    const alumno = (it.alumno ?? '').length > 34 ? (it.alumno ?? '').slice(0, 33) + '…' : it.alumno ?? '';
    const mod = `M${it.moduloNumero ?? '?'} · ${(it.moduloNombre ?? '').slice(0, 20)}`;
    page.drawText(winAnsiSafe(String(i)), { x: cols[0].x + 2, y, size: 8, font: reg, color: GRIS });
    page.drawText(winAnsiSafe(alumno), { x: cols[1].x + 2, y, size: 8, font: reg, color: NEGRO });
    page.drawText(winAnsiSafe(it.curp ?? '—'), { x: cols[2].x + 2, y, size: 7.5, font: reg, color: GRIS });
    page.drawText(winAnsiSafe(mod), { x: cols[3].x + 2, y, size: 8, font: reg, color: NEGRO });
    page.drawText(winAnsiSafe(it.folioExamen ?? '—'), { x: cols[4].x + 2, y, size: 7.5, font: reg, color: GRIS });
    page.drawText(winAnsiSafe(fmtMoney(Number(it.monto))), { x: cols[5].x, y, size: 8, font: bold, color: NEGRO });
    y -= 3;
    page.drawLine({ start: { x: M, y }, end: { x: A4.w - M, y }, thickness: 0.5, color: LINEA });
    y -= 11;
  }

  // ── Total ──
  y -= 8;
  page.drawRectangle({ x: A4.w - M - 240, y: y - 10, width: 240, height: 30, color: GUINDA });
  page.drawText(winAnsiSafe(`${pg.cantidadExamenes} exámenes × ${fmtMoney(Number(pg.montoUnitario))}`), {
    x: A4.w - M - 232, y: y + 6, size: 8, font: reg, color: CREMA,
  });
  page.drawText(winAnsiSafe(`TOTAL: ${fmtMoney(Number(pg.montoTotal))} MXN`), {
    x: A4.w - M - 232, y: y - 5, size: 12, font: bold, color: rgb(1, 1, 1),
  });

  // ── Pie ──
  page.drawText(
    winAnsiSafe('Documento interno de referencia — no sustituye al recibo oficial de la Tesorería del Estado.'),
    { x: M, y: 24, size: 7, font: reg, color: GRIS }
  );

  const pdf = await doc.save();
  return { pdf, nombreArchivo: `FICHA ${pg.folio}.pdf` };
}
