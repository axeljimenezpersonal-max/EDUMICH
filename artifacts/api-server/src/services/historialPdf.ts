/**
 * Historial Académico del estudiante en PDF (Preparatoria Abierta Michoacán).
 * Documento informativo, descargable por el propio alumno: resumen de avance,
 * análisis por nivel y la tabla completa de exámenes presentados.
 */
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { calificaciones, modulos, sedes, estudiantes, municipios } from '@workspace/db/schema';
import { winAnsiSafe } from '../utils/pdfText';

const GUINDA = rgb(0.42, 0.08, 0.19);
const GUINDA_D = rgb(0.30, 0.05, 0.14);
const CREMA = rgb(0.97, 0.95, 0.91);
const VERDE = rgb(0.18, 0.49, 0.27);
const ROJO = rgb(0.72, 0.11, 0.11);
const GRIS = rgb(0.42, 0.40, 0.38);
const NEGRO = rgb(0.12, 0.12, 0.12);
const LINEA = rgb(0.85, 0.83, 0.80);

const A4 = { w: 595.28, h: 841.89 };
const M = 44;

/** Interno 0–100 → escala SEP 0–10 (6 = aprobado). 90→9, 75→7.5. */
function calif10(c: number | null | undefined): string {
  if (c === null || c === undefined) return '—';
  const v = c / 10;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function fmtFecha(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d + (String(d).length === 10 ? 'T12:00:00' : '')) : d;
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Mexico_City' });
}

interface Ctx {
  doc: PDFDocument;
  page: PDFPage;
  bold: PDFFont;
  reg: PDFFont;
  y: number;
}

function text(ctx: Ctx, s: string, x: number, size: number, opts: { font?: PDFFont; color?: ReturnType<typeof rgb> } = {}) {
  ctx.page.drawText(winAnsiSafe(s), { x, y: ctx.y, size, font: opts.font ?? ctx.reg, color: opts.color ?? NEGRO });
}

function nuevaPagina(ctx: Ctx) {
  ctx.page = ctx.doc.addPage([A4.w, A4.h]);
  ctx.y = A4.h - M;
}

export async function generarHistorialPdf(
  estudianteId: number
): Promise<{ pdf: Uint8Array; nombreArchivo: string }> {
  // ── Datos del alumno ──
  const [est] = await db
    .select({
      nombreCompleto: estudiantes.nombreCompleto,
      curp: estudiantes.curp,
      matricula: estudiantes.matriculaOficialDGB,
      apellidoPaterno: estudiantes.apellidoPaterno,
      municipioId: estudiantes.municipioId,
    })
    .from(estudiantes)
    .where(eq(estudiantes.userId, estudianteId));
  if (!est) throw new Error('Estudiante no encontrado');

  const [muni] = est.municipioId
    ? await db.select({ nombre: municipios.nombre }).from(municipios).where(eq(municipios.id, est.municipioId))
    : [null];

  // ── Calificaciones ──
  const rows = await db
    .select({
      id: calificaciones.id,
      moduloId: calificaciones.moduloId,
      etapaClave: calificaciones.etapaClave,
      calificacion: calificaciones.calificacion,
      aciertos: calificaciones.aciertos,
      aprobado: calificaciones.aprobado,
      intento: calificaciones.intento,
      fechaExamen: calificaciones.fechaExamen,
      moduloNumero: modulos.numero,
      moduloNombre: modulos.nombre,
      moduloNivel: modulos.nivel,
      sedeNombre: sedes.nombre,
    })
    .from(calificaciones)
    .leftJoin(modulos, eq(calificaciones.moduloId, modulos.id))
    .leftJoin(sedes, eq(calificaciones.sedeId, sedes.id))
    .where(eq(calificaciones.estudianteId, estudianteId))
    .orderBy(desc(calificaciones.fechaExamen));

  // Mejor calificación aprobada por módulo
  const aprobadosMap = new Map<number, (typeof rows)[number]>();
  for (const r of rows) {
    if (!r.aprobado) continue;
    const ex = aprobadosMap.get(r.moduloId);
    if (!ex || r.calificacion > ex.calificacion) aprobadosMap.set(r.moduloId, r);
  }
  const totalAprobados = aprobadosMap.size;
  const promedio = rows.length ? Math.round(rows.reduce((s, r) => s + r.calificacion, 0) / rows.length) : 0;
  const avance = Math.round((totalAprobados / 21) * 100);
  const reprobados = rows.filter((r) => !r.aprobado).length;

  // Aprobados por nivel (1-4)
  const porNivel: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const r of aprobadosMap.values()) if (r.moduloNivel && porNivel[r.moduloNivel] !== undefined) porNivel[r.moduloNivel]++;

  // ── Documento ──
  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const ctx: Ctx = { doc, page: doc.addPage([A4.w, A4.h]), bold, reg, y: 0 };

  // ── Encabezado institucional ──
  ctx.page.drawRectangle({ x: 0, y: A4.h - 92, width: A4.w, height: 92, color: GUINDA });
  ctx.page.drawRectangle({ x: 0, y: A4.h - 96, width: A4.w, height: 4, color: GUINDA_D });
  ctx.y = A4.h - 40;
  text(ctx, 'PREPARATORIA ABIERTA — MICHOACÁN', M, 9, { font: bold, color: rgb(1, 1, 1) });
  ctx.y = A4.h - 62;
  text(ctx, 'Historial Académico del Estudiante', M, 18, { font: bold, color: rgb(1, 1, 1) });
  ctx.y = A4.h - 80;
  text(ctx, 'Documento informativo · Plan Modular (21 módulos)', M, 9, { color: CREMA });

  // ── Datos del alumno ──
  ctx.y = A4.h - 120;
  const campo = (label: string, valor: string, x: number) => {
    ctx.page.drawText(winAnsiSafe(label.toUpperCase()), { x, y: ctx.y, size: 7, font: bold, color: GRIS });
    ctx.page.drawText(winAnsiSafe(valor || '—'), { x, y: ctx.y - 12, size: 10, font: reg, color: NEGRO });
  };
  campo('Alumno', est.nombreCompleto, M);
  campo('CURP', est.curp ?? '—', 320);
  ctx.y -= 30;
  campo('Matrícula oficial DGB', est.matricula ?? 'En trámite', M);
  campo('Centro de servicios', muni?.nombre ?? '—', 320);
  ctx.y -= 34;

  // ── Resumen / KPIs ──
  ctx.page.drawLine({ start: { x: M, y: ctx.y }, end: { x: A4.w - M, y: ctx.y }, thickness: 1, color: LINEA });
  ctx.y -= 22;
  const kpis: [string, string, ReturnType<typeof rgb>][] = [
    [`${totalAprobados}/21`, 'Módulos aprobados', GUINDA],
    [calif10(promedio), 'Promedio global', VERDE],
    [`${avance}%`, 'Avance', GUINDA],
    [`${rows.length}`, 'Exámenes presentados', GRIS],
    [`${reprobados}`, 'No aprobados', ROJO],
  ];
  const kw = (A4.w - 2 * M) / kpis.length;
  kpis.forEach(([val, lbl, col], i) => {
    const cx = M + i * kw;
    ctx.page.drawText(winAnsiSafe(val), { x: cx, y: ctx.y - 6, size: 20, font: bold, color: col });
    ctx.page.drawText(winAnsiSafe(lbl), { x: cx, y: ctx.y - 20, size: 7, font: reg, color: GRIS });
  });
  ctx.y -= 44;

  // ── Análisis por nivel ──
  text(ctx, 'Avance por nivel', M, 11, { font: bold, color: GUINDA });
  ctx.y -= 16;
  // metas por nivel del plan modular: N1=4, N2=6, N3=6, N4=5 (total 21)
  const metaNivel: Record<number, number> = { 1: 4, 2: 6, 3: 6, 4: 5 };
  [1, 2, 3, 4].forEach((n) => {
    const meta = metaNivel[n];
    const got = porNivel[n] ?? 0;
    const barW = 180;
    const fill = Math.max(0, Math.min(1, meta ? got / meta : 0));
    ctx.page.drawText(winAnsiSafe(`Nivel ${n}`), { x: M, y: ctx.y, size: 9, font: bold, color: NEGRO });
    ctx.page.drawRectangle({ x: M + 60, y: ctx.y - 1, width: barW, height: 9, color: rgb(0.9, 0.88, 0.85) });
    ctx.page.drawRectangle({ x: M + 60, y: ctx.y - 1, width: barW * fill, height: 9, color: GUINDA });
    ctx.page.drawText(winAnsiSafe(`${got} / ${meta} módulos`), { x: M + 60 + barW + 10, y: ctx.y, size: 9, font: reg, color: GRIS });
    ctx.y -= 16;
  });
  ctx.y -= 12;

  // ── Tabla de exámenes ──
  text(ctx, 'Historial de exámenes presentados', M, 11, { font: bold, color: GUINDA });
  ctx.y -= 6;

  const cols = [
    { t: 'MÓD', x: M, w: 34 },
    { t: 'MÓDULO', x: M + 36, w: 180 },
    { t: 'ETAPA', x: M + 220, w: 44 },
    { t: 'INT.', x: M + 266, w: 20 },
    { t: 'FECHA', x: M + 290, w: 74 },
    { t: 'CALIF', x: M + 368, w: 28 },
    { t: 'ACIER.', x: M + 400, w: 40 },
    { t: 'ESTADO', x: M + 444, w: 60 },
  ];
  const drawHeader = () => {
    ctx.y -= 16;
    ctx.page.drawRectangle({ x: M, y: ctx.y - 4, width: A4.w - 2 * M, height: 16, color: CREMA });
    cols.forEach((c) => ctx.page.drawText(winAnsiSafe(c.t), { x: c.x + 2, y: ctx.y, size: 7, font: bold, color: GUINDA }));
    ctx.y -= 14;
  };
  drawHeader();

  if (rows.length === 0) {
    ctx.y -= 6;
    text(ctx, 'Aún no hay exámenes registrados.', M + 2, 9, { color: GRIS });
  }

  for (const r of rows) {
    if (ctx.y < 70) {
      nuevaPagina(ctx);
      drawHeader();
    }
    const nombre = (r.moduloNombre ?? '').length > 36 ? (r.moduloNombre ?? '').slice(0, 35) + '…' : r.moduloNombre ?? '';
    ctx.page.drawText(winAnsiSafe(`M${r.moduloNumero ?? '?'}`), { x: cols[0].x + 2, y: ctx.y, size: 8, font: bold, color: NEGRO });
    ctx.page.drawText(winAnsiSafe(nombre), { x: cols[1].x + 2, y: ctx.y, size: 8, font: reg, color: NEGRO });
    ctx.page.drawText(winAnsiSafe(r.etapaClave ?? '—'), { x: cols[2].x + 2, y: ctx.y, size: 8, font: reg, color: GRIS });
    ctx.page.drawText(winAnsiSafe(`${r.intento}º`), { x: cols[3].x + 2, y: ctx.y, size: 8, font: reg, color: GRIS });
    ctx.page.drawText(winAnsiSafe(fmtFecha(r.fechaExamen)), { x: cols[4].x + 2, y: ctx.y, size: 8, font: reg, color: NEGRO });
    ctx.page.drawText(winAnsiSafe(calif10(r.calificacion)), { x: cols[5].x + 2, y: ctx.y, size: 9, font: bold, color: r.aprobado ? VERDE : ROJO });
    ctx.page.drawText(winAnsiSafe(r.aciertos != null ? String(r.aciertos) : '—'), { x: cols[6].x + 2, y: ctx.y, size: 8, font: reg, color: GRIS });
    ctx.page.drawText(winAnsiSafe(r.aprobado ? 'Aprobado' : 'No aprob.'), { x: cols[7].x + 2, y: ctx.y, size: 7.5, font: bold, color: r.aprobado ? VERDE : ROJO });
    ctx.y -= 3;
    ctx.page.drawLine({ start: { x: M, y: ctx.y }, end: { x: A4.w - M, y: ctx.y }, thickness: 0.5, color: LINEA });
    ctx.y -= 11;
  }

  // ── Pie de página ──
  const foot = ctx.page;
  foot.drawText(
    winAnsiSafe(`Generado el ${fmtFecha(new Date())} · Documento informativo, no constituye certificación oficial.`),
    { x: M, y: 30, size: 7, font: reg, color: GRIS }
  );
  foot.drawText(
    winAnsiSafe('Las calificaciones oficiales las emite la SEP — Dirección General de Bachillerato.'),
    { x: M, y: 20, size: 7, font: reg, color: GRIS }
  );

  const pdf = await doc.save();
  const ap = (est.apellidoPaterno || est.nombreCompleto || 'ALUMNO').trim();
  const mat = (est.matricula || '').trim() || 'NA';
  return { pdf, nombreArchivo: `${ap} | ${mat} | HISTORIAL ACADÉMICO.pdf` };
}
