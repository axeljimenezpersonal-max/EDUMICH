/**
 * RELACIÓN DE EXÁMENES SOLICITADOS — documento oficial de Preparatoria Abierta
 * Michoacán (IEMSyS). Replica el formato que el centro de asesoría entrega al
 * Departamento de Preparatoria Abierta Morelia.
 *
 * Se genera por CENTRO DE ASESORÍA (gestor) + ETAPA. Autollena: sede, centro,
 * etapa/fase, día de aplicación, mes, y la tabla de alumnos con sus módulos,
 * CURP e importe (= precio de examen configurado × nº de módulos).
 * Los datos del centro (CLAVE, RFC, nombre) salen del perfil del gestor.
 */
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db';
import { gestores, municipios, convocatoriasEtapas, conceptosPago } from '@workspace/db/schema';
import { winAnsiSafe } from '../utils/pdfText';

const GUINDA = rgb(0.42, 0.08, 0.19);
const NEGRO = rgb(0.1, 0.1, 0.1);
const GRIS = rgb(0.4, 0.38, 0.36);
const LINEA = rgb(0.7, 0.68, 0.66);
const LINEA_SUAVE = rgb(0.85, 0.83, 0.8);

const LAND = { w: 841.89, h: 595.28 }; // A4 apaisado
const M = 28;

const DIAS = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

function fechaLarga(iso: string): { dia: string; mes: string } {
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
  return { dia: `${DIAS[d.getDay()]} ${d.getDate()} DE ${MESES[d.getMonth()]}`, mes: MESES[d.getMonth()] };
}

export async function generarRelacionExamenes(
  etapaId: number,
  gestorId: number
): Promise<{ pdf: Uint8Array; nombreArchivo: string }> {
  const [etapa] = await db.select().from(convocatoriasEtapas).where(eq(convocatoriasEtapas.id, etapaId));
  if (!etapa) throw new Error('Etapa no encontrada');

  const [gestor] = await db
    .select({
      nombre: gestores.nombreCompleto,
      centro: gestores.centroAsesoria,
      clave: gestores.claveCentro,
      rfc: gestores.rfcCentro,
      municipioId: gestores.municipioId,
    })
    .from(gestores).where(eq(gestores.userId, gestorId));
  if (!gestor) throw new Error('Gestor no encontrado');

  const [muni] = gestor.municipioId
    ? await db.select({ nombre: municipios.nombre }).from(municipios).where(eq(municipios.id, gestor.municipioId))
    : [null];

  const [concepto] = await db
    .select({ monto: conceptosPago.monto })
    .from(conceptosPago)
    .where(and(eq(conceptosPago.clave, 'derecho_examen'), eq(conceptosPago.activo, true)))
    .limit(1);
  const precio = concepto ? Math.round(parseFloat(String(concepto.monto))) : 131;

  // Alumnos del centro con exámenes en esta etapa (no cancelados), con sus módulos
  const rows = await db.execute<{
    matricula: string | null; apellido_paterno: string | null; apellido_materno: string | null;
    nombres: string | null; nombre_completo: string; curp: string | null; modulos: number[];
  }>(sql`
    SELECT e.matricula_oficial_dgb AS matricula, e.apellido_paterno, e.apellido_materno,
           e.nombres, e.nombre_completo, e.curp,
           array_agg(m.numero ORDER BY m.numero) AS modulos
    FROM examenes_inscripciones ei
    JOIN estudiantes e ON e.user_id = ei.estudiante_id
    JOIN modulos m ON m.id = ei.modulo_id
    WHERE ei.etapa_id = ${etapaId} AND e.gestor_id = ${gestorId} AND ei.estado <> 'cancelado'
    GROUP BY e.user_id, e.matricula_oficial_dgb, e.apellido_paterno, e.apellido_materno, e.nombres, e.nombre_completo, e.curp
    ORDER BY e.apellido_paterno NULLS LAST, e.apellido_materno NULLS LAST, e.nombres NULLS LAST
  `);

  const dia = fechaLarga(String(etapa.examenSabado));

  const pdf = await PDFDocument.create();
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([LAND.w, LAND.h]);

  const S = (s: string | null | undefined) => winAnsiSafe(s ?? '');
  const text = (p: PDFPage, s: string, x: number, y: number, size: number, font: PDFFont, color = NEGRO) =>
    p.drawText(S(s), { x, y, size, font, color });

  // Columnas de la tabla
  const cols = [
    { key: 'num', label: 'NUM', x: M, w: 26 },
    { key: 'matricula', label: 'MATRÍCULA', x: 0, w: 78 },
    { key: 'ap', label: 'APELLIDO PATERNO', x: 0, w: 92 },
    { key: 'am', label: 'APELLIDO MATERNO', x: 0, w: 92 },
    { key: 'nom', label: 'NOMBRE(S)', x: 0, w: 108 },
    { key: 'm1', label: '1', x: 0, w: 22 },
    { key: 'm2', label: '2', x: 0, w: 22 },
    { key: 'm3', label: '3', x: 0, w: 22 },
    { key: 'm4', label: '4', x: 0, w: 22 },
    { key: 'curp', label: 'CURP DEL ESTUDIANTE', x: 0, w: 118 },
    { key: 'importe', label: 'IMPORTE', x: 0, w: 54 },
    { key: 'obs', label: 'OBSERVACIONES', x: 0, w: 0 },
  ];
  let cx = M;
  for (const c of cols) { c.x = cx; cx += c.w; }
  const tableRight = LAND.w - M;
  cols[cols.length - 1].w = tableRight - cols[cols.length - 1].x;

  function encabezado(p: PDFPage): number {
    let y = LAND.h - M;
    // Título institucional
    text(p, 'PREPARATORIA ABIERTA', M, y - 4, 13, bold, GUINDA);
    const titulo = 'INSTITUTO DE EDUCACIÓN MEDIA SUPERIOR Y SUPERIOR DEL ESTADO DE MICHOACÁN';
    text(p, titulo, LAND.w / 2 - bold.widthOfTextAtSize(S(titulo), 9) / 2, y - 2, 9, bold);
    const dep = 'DEPARTAMENTO DE PREPARATORIA ABIERTA MORELIA';
    text(p, dep, LAND.w / 2 - reg.widthOfTextAtSize(S(dep), 8) / 2, y - 13, 8, reg, GRIS);
    const rel = 'RELACIÓN DE EXÁMENES SOLICITADOS';
    text(p, rel, LAND.w / 2 - bold.widthOfTextAtSize(S(rel), 11) / 2, y - 27, 11, bold);
    // Código (constante del formato)
    text(p, 'Código: 2024', tableRight - 70, y - 4, 8, bold, GRIS);
    y -= 42;

    // Campos del encabezado (dos columnas)
    const campo = (p: PDFPage, label: string, val: string, x: number, yy: number, wLabel: number) => {
      text(p, label, x, yy, 7.5, bold, GRIS);
      text(p, val, x + wLabel, yy, 8.5, reg);
      p.drawLine({ start: { x: x + wLabel, y: yy - 2 }, end: { x: x + wLabel + 180, y: yy - 2 }, thickness: 0.5, color: LINEA_SUAVE });
    };
    campo(p, 'NOMBRE DE LA SEDE:', muni?.nombre ?? '', M, y, 96);
    campo(p, 'CLAVE:', gestor.clave ?? '', LAND.w - M - 300, y, 40);
    y -= 16;
    campo(p, 'NOMBRE DE CENTRO DE ASESORÍA:', gestor.centro ?? gestor.nombre ?? '', M, y, 150);
    campo(p, 'RFC:', gestor.rfc ?? '', LAND.w - M - 300, y, 40);
    y -= 16;
    campo(p, 'ETAPA Y FASE SOLICITADA:', `${etapa.etapa} ${etapa.fase}`, M, y, 122);
    campo(p, 'MES:', dia.mes, LAND.w - M - 300, y, 40);
    y -= 16;
    campo(p, 'DÍA(S) DE APLICACIÓN:', dia.dia, M, y, 108);
    y -= 18;
    return y;
  }

  function cabeceraTabla(p: PDFPage, y: number): number {
    const h = 22;
    p.drawRectangle({ x: M, y: y - h, width: tableRight - M, height: h, color: rgb(0.96, 0.94, 0.9), borderColor: LINEA, borderWidth: 0.7 });
    // Etiqueta agrupadora de módulos
    const m1 = cols.find((c) => c.key === 'm1')!;
    const m4 = cols.find((c) => c.key === 'm4')!;
    const gx = m1.x, gw = m4.x + m4.w - m1.x;
    text(p, 'CLAVE(S) DE LOS MÓDULOS', gx + 2, y - 7, 5.5, bold, GRIS);
    for (const c of cols) {
      const label = c.label;
      const size = ['1', '2', '3', '4'].includes(label) ? 8 : 6.5;
      const yy = ['1', '2', '3', '4'].includes(label) ? y - 16 : y - 13;
      const tw = bold.widthOfTextAtSize(S(label), size);
      text(p, label, c.x + Math.max(2, (c.w - tw) / 2), yy, size, bold, NEGRO);
      if (c.x > M) p.drawLine({ start: { x: c.x, y: y - h }, end: { x: c.x, y }, thickness: 0.5, color: LINEA });
    }
    void gw;
    return y - h;
  }

  let y = encabezado(page);
  y = cabeceraTabla(page, y);

  const rowH = 15;
  let num = 1;
  let total = 0;
  for (const r of rows.rows) {
    if (y - rowH < M + 24) {
      page = pdf.addPage([LAND.w, LAND.h]);
      y = cabeceraTabla(page, LAND.h - M);
    }
    const mods = (r.modulos ?? []).filter((n) => n != null).map(Number);
    const importe = mods.length * precio;
    total += importe;

    const cell = (key: string, val: string, center = false) => {
      const c = cols.find((cc) => cc.key === key)!;
      const size = 7;
      const tw = reg.widthOfTextAtSize(S(val), size);
      const x = center ? c.x + Math.max(2, (c.w - tw) / 2) : c.x + 3;
      text(page, val, x, y - 10.5, size, reg);
    };
    cell('num', String(num), true);
    cell('matricula', r.matricula ?? '');
    cell('ap', r.apellido_paterno ?? (r.nombre_completo.split(' ')[0] ?? ''));
    cell('am', r.apellido_materno ?? '');
    cell('nom', r.nombres ?? r.nombre_completo);
    ['m1', 'm2', 'm3', 'm4'].forEach((k, i) => { if (mods[i] != null) cell(k, String(mods[i]), true); });
    cell('curp', r.curp ?? '');
    cell('importe', String(importe), true);

    // líneas verticales de la fila
    for (const c of cols) if (c.x > M) page.drawLine({ start: { x: c.x, y: y - rowH }, end: { x: c.x, y }, thickness: 0.4, color: LINEA_SUAVE });
    page.drawLine({ start: { x: M, y: y - rowH }, end: { x: tableRight, y: y - rowH }, thickness: 0.4, color: LINEA_SUAVE });
    page.drawLine({ start: { x: M, y: y - rowH }, end: { x: M, y }, thickness: 0.5, color: LINEA });
    page.drawLine({ start: { x: tableRight, y: y - rowH }, end: { x: tableRight, y }, thickness: 0.5, color: LINEA });
    y -= rowH;
    num++;
  }

  // TOTAL
  const impCol = cols.find((c) => c.key === 'importe')!;
  page.drawRectangle({ x: impCol.x - 60, y: y - 20, width: impCol.w + 60, height: 20, borderColor: LINEA, borderWidth: 0.7 });
  text(page, 'TOTAL', impCol.x - 54, y - 13, 8, bold);
  const totalStr = total.toLocaleString('es-MX');
  text(page, totalStr, impCol.x + Math.max(2, (impCol.w - reg.widthOfTextAtSize(totalStr, 8)) / 2), y - 13, 8, bold);

  const bytes = await pdf.save();
  const claveEtapa = `${etapa.etapa}${etapa.fase}`;
  const nombreArchivo = `RELACION EXAMENES ${(muni?.nombre ?? 'SEDE').toUpperCase()} ${claveEtapa}.pdf`;
  return { pdf: bytes, nombreArchivo };
}

/**
 * Relación de exámenes de TODOS los gestores de la etapa: una hoja (o varias)
 * por centro de asesoría, con su propio encabezado fiscal, fusionadas en un solo
 * PDF. Reutiliza el generador por gestor y sólo une las páginas — así el formato
 * oficial por centro se conserva intacto.
 */
export async function generarRelacionExamenesTodos(
  etapaId: number,
): Promise<{ pdf: Uint8Array; nombreArchivo: string }> {
  const [etapa] = await db.select().from(convocatoriasEtapas).where(eq(convocatoriasEtapas.id, etapaId));
  if (!etapa) throw new Error('Etapa no encontrada');

  const gestoresRows = await db.execute<{ gestor_id: number }>(sql`
    SELECT DISTINCT e.gestor_id AS gestor_id
    FROM examenes_inscripciones ei
    JOIN estudiantes e ON e.user_id = ei.estudiante_id
    WHERE ei.etapa_id = ${etapaId} AND ei.estado <> 'cancelado' AND e.gestor_id IS NOT NULL
    ORDER BY e.gestor_id
  `);

  const merged = await PDFDocument.create();
  for (const g of gestoresRows.rows) {
    const { pdf } = await generarRelacionExamenes(etapaId, Number(g.gestor_id));
    const src = await PDFDocument.load(pdf);
    const paginas = await merged.copyPages(src, src.getPageIndices());
    paginas.forEach((p) => merged.addPage(p));
  }

  // Sin ningún centro con exámenes: una hoja con el aviso, no un PDF vacío.
  if (merged.getPageCount() === 0) {
    const reg = await merged.embedFont(StandardFonts.Helvetica);
    const bold = await merged.embedFont(StandardFonts.HelveticaBold);
    const p = merged.addPage([LAND.w, LAND.h]);
    p.drawText(winAnsiSafe('RELACIÓN DE EXÁMENES SOLICITADOS'), { x: M, y: LAND.h - M - 10, size: 12, font: bold, color: GUINDA });
    p.drawText(winAnsiSafe('No hay exámenes solicitados en esta etapa.'), { x: M, y: LAND.h - M - 40, size: 10, font: reg, color: GRIS });
  }

  const bytes = await merged.save();
  const claveEtapa = `${etapa.etapa}${etapa.fase}`;
  return { pdf: bytes, nombreArchivo: `RELACION EXAMENES TODOS ${claveEtapa}.pdf` };
}
