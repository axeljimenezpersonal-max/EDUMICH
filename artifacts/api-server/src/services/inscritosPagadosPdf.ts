/**
 * RELACIÓN DE INSCRITOS PAGADOS — documento consolidado por ETAPA (todos los
 * centros). Mismo lenguaje visual que la Relación de exámenes solicitados
 * (encabezado del IEMSyS, tabla con módulos, CURP e importe), pero:
 *  - consolidado: una sola tabla con TODOS los alumnos de la etapa;
 *  - solo incluye a quienes YA PAGARON (ficha en estado 'pagado');
 *  - agrega una columna CENTRO DE ASESORÍA en vez del encabezado fiscal por
 *    centro (que solo aplica al formato por-gestor).
 */
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib';
import { eq, and } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { convocatoriasEtapas, conceptosPago } from '@workspace/db/schema';
import { winAnsiSafe } from '../utils/pdfText';

const GUINDA = rgb(0.42, 0.08, 0.19);
const NEGRO = rgb(0.1, 0.1, 0.1);
const GRIS = rgb(0.4, 0.38, 0.36);
const LINEA = rgb(0.7, 0.68, 0.66);
const LINEA_SUAVE = rgb(0.85, 0.83, 0.8);

const LAND = { w: 841.89, h: 595.28 };
const M = 28;

const DIAS = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

function fechaLarga(iso: string): { dia: string; mes: string } {
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
  return { dia: `${DIAS[d.getDay()]} ${d.getDate()} DE ${MESES[d.getMonth()]}`, mes: MESES[d.getMonth()] };
}

export async function generarInscritosPagados(
  etapaId: number,
  gestorId?: number,
): Promise<{ pdf: Uint8Array; nombreArchivo: string }> {
  const [etapa] = await db.select().from(convocatoriasEtapas).where(eq(convocatoriasEtapas.id, etapaId));
  if (!etapa) throw new Error('Etapa no encontrada');
  const filtroGestor = gestorId ? sql`AND e.gestor_id = ${gestorId}` : sql``;

  const [concepto] = await db
    .select({ monto: conceptosPago.monto })
    .from(conceptosPago)
    .where(and(eq(conceptosPago.clave, 'derecho_examen'), eq(conceptosPago.activo, true)))
    .limit(1);
  const precio = concepto ? Math.round(parseFloat(String(concepto.monto))) : 145;

  // Alumnos con exámenes PAGADOS en esta etapa (ficha en estado 'pagado').
  // Los módulos agregados son solo los cubiertos por una ficha pagada.
  const rows = await db.execute<{
    matricula: string | null; apellido_paterno: string | null; apellido_materno: string | null;
    nombres: string | null; nombre_completo: string; curp: string | null;
    centro: string | null; modulos: number[];
  }>(sql`
    SELECT e.matricula_oficial_dgb AS matricula, e.apellido_paterno, e.apellido_materno,
           e.nombres, e.nombre_completo, e.curp,
           COALESCE(g.centro_asesoria, g.nombre_completo) AS centro,
           array_agg(m.numero ORDER BY m.numero) AS modulos
    FROM examenes_inscripciones ei
    JOIN estudiantes e ON e.user_id = ei.estudiante_id
    JOIN modulos m ON m.id = ei.modulo_id
    LEFT JOIN gestores g ON g.user_id = e.gestor_id
    JOIN pagos_examen_inscripciones pei ON pei.examen_inscripcion_id = ei.id
    JOIN pagos_examen pe ON pe.id = pei.pago_examen_id AND pe.estado = 'pagado'
    WHERE ei.etapa_id = ${etapaId} AND ei.estado <> 'cancelado' ${filtroGestor}
    GROUP BY e.user_id, e.matricula_oficial_dgb, e.apellido_paterno, e.apellido_materno,
             e.nombres, e.nombre_completo, e.curp, g.centro_asesoria, g.nombre_completo
    ORDER BY centro NULLS LAST, e.apellido_paterno NULLS LAST, e.apellido_materno NULLS LAST, e.nombres NULLS LAST
  `);

  const dia = etapa.examenSabado ? fechaLarga(String(etapa.examenSabado)) : { dia: '', mes: '' };

  const pdf = await PDFDocument.create();
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([LAND.w, LAND.h]);

  const S = (s: string | null | undefined) => winAnsiSafe(s ?? '');
  const text = (p: PDFPage, s: string, x: number, y: number, size: number, font: PDFFont, color = NEGRO) =>
    p.drawText(S(s), { x, y, size, font, color });

  // Recorta un texto para que quepa en un ancho dado (con "…").
  const ajustar = (s: string, w: number, size: number, font: PDFFont) => {
    let t = S(s);
    if (font.widthOfTextAtSize(t, size) <= w) return t;
    while (t.length > 1 && font.widthOfTextAtSize(t + '…', size) > w) t = t.slice(0, -1);
    return t + '…';
  };

  const cols = [
    { key: 'num', label: 'NUM', x: M, w: 26 },
    { key: 'matricula', label: 'MATRÍCULA', x: 0, w: 76 },
    { key: 'ap', label: 'APELLIDO PATERNO', x: 0, w: 84 },
    { key: 'am', label: 'APELLIDO MATERNO', x: 0, w: 84 },
    { key: 'nom', label: 'NOMBRE(S)', x: 0, w: 96 },
    { key: 'centro', label: 'CENTRO DE ASESORÍA', x: 0, w: 118 },
    { key: 'm1', label: '1', x: 0, w: 20 },
    { key: 'm2', label: '2', x: 0, w: 20 },
    { key: 'm3', label: '3', x: 0, w: 20 },
    { key: 'm4', label: '4', x: 0, w: 20 },
    { key: 'curp', label: 'CURP DEL ESTUDIANTE', x: 0, w: 118 },
    { key: 'importe', label: 'IMPORTE', x: 0, w: 0 },
  ];
  let cx = M;
  for (const c of cols) { c.x = cx; cx += c.w; }
  const tableRight = LAND.w - M;
  cols[cols.length - 1].w = tableRight - cols[cols.length - 1].x;

  function encabezado(p: PDFPage): number {
    let y = LAND.h - M;
    text(p, 'PREPARATORIA ABIERTA', M, y - 4, 13, bold, GUINDA);
    const titulo = 'INSTITUTO DE EDUCACIÓN MEDIA SUPERIOR Y SUPERIOR DEL ESTADO DE MICHOACÁN';
    text(p, titulo, LAND.w / 2 - bold.widthOfTextAtSize(S(titulo), 9) / 2, y - 2, 9, bold);
    const dep = 'DEPARTAMENTO DE PREPARATORIA ABIERTA MORELIA';
    text(p, dep, LAND.w / 2 - reg.widthOfTextAtSize(S(dep), 8) / 2, y - 13, 8, reg, GRIS);
    const rel = 'RELACIÓN DE INSCRITOS PAGADOS';
    text(p, rel, LAND.w / 2 - bold.widthOfTextAtSize(S(rel), 11) / 2, y - 27, 11, bold);
    text(p, 'Código: 2024', tableRight - 70, y - 4, 8, bold, GRIS);
    y -= 42;

    const campo = (label: string, val: string, x: number, yy: number, wLabel: number) => {
      text(p, label, x, yy, 7.5, bold, GRIS);
      text(p, val, x + wLabel, yy, 8.5, reg);
      p.drawLine({ start: { x: x + wLabel, y: yy - 2 }, end: { x: x + wLabel + 180, y: yy - 2 }, thickness: 0.5, color: LINEA_SUAVE });
    };
    campo('ETAPA Y FASE:', `${etapa.etapa} ${etapa.fase}`, M, y, 82);
    campo('MES:', dia.mes, LAND.w - M - 300, y, 40);
    y -= 16;
    campo('DÍA(S) DE APLICACIÓN:', dia.dia, M, y, 108);
    y -= 18;
    return y;
  }

  function cabeceraTabla(p: PDFPage, y: number): number {
    const h = 22;
    p.drawRectangle({ x: M, y: y - h, width: tableRight - M, height: h, color: rgb(0.96, 0.94, 0.9), borderColor: LINEA, borderWidth: 0.7 });
    const m1 = cols.find((c) => c.key === 'm1')!;
    const m4 = cols.find((c) => c.key === 'm4')!;
    text(p, 'MÓDULOS', m1.x + 2, y - 7, 5.5, bold, GRIS);
    void m4;
    for (const c of cols) {
      const label = c.label;
      const size = ['1', '2', '3', '4'].includes(label) ? 8 : 6.5;
      const yy = ['1', '2', '3', '4'].includes(label) ? y - 16 : y - 13;
      const tw = bold.widthOfTextAtSize(S(label), size);
      text(p, label, c.x + Math.max(2, (c.w - tw) / 2), yy, size, bold, NEGRO);
      if (c.x > M) p.drawLine({ start: { x: c.x, y: y - h }, end: { x: c.x, y }, thickness: 0.5, color: LINEA });
    }
    return y - h;
  }

  let y = encabezado(page);
  y = cabeceraTabla(page, y);

  const rowH = 15;
  let num = 1;
  let total = 0;

  if (rows.rows.length === 0) {
    text(page, 'No hay alumnos pagados en esta etapa.', M + 4, y - 14, 9, reg, GRIS);
  }

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
      const t = ajustar(val, c.w - 5, size, reg);
      const tw = reg.widthOfTextAtSize(t, size);
      const x = center ? c.x + Math.max(2, (c.w - tw) / 2) : c.x + 3;
      page.drawText(t, { x, y: y - 10.5, size, font: reg, color: NEGRO });
    };
    cell('num', String(num), true);
    cell('matricula', r.matricula ?? '');
    cell('ap', r.apellido_paterno ?? (r.nombre_completo.split(' ')[0] ?? ''));
    cell('am', r.apellido_materno ?? '');
    cell('nom', r.nombres ?? r.nombre_completo);
    cell('centro', r.centro ?? '—');
    ['m1', 'm2', 'm3', 'm4'].forEach((k, i) => { if (mods[i] != null) cell(k, String(mods[i]), true); });
    cell('curp', r.curp ?? '');
    cell('importe', String(importe), true);

    for (const c of cols) if (c.x > M) page.drawLine({ start: { x: c.x, y: y - rowH }, end: { x: c.x, y }, thickness: 0.4, color: LINEA_SUAVE });
    page.drawLine({ start: { x: M, y: y - rowH }, end: { x: tableRight, y: y - rowH }, thickness: 0.4, color: LINEA_SUAVE });
    page.drawLine({ start: { x: M, y: y - rowH }, end: { x: M, y }, thickness: 0.5, color: LINEA });
    page.drawLine({ start: { x: tableRight, y: y - rowH }, end: { x: tableRight, y }, thickness: 0.5, color: LINEA });
    y -= rowH;
    num++;
  }

  const impCol = cols.find((c) => c.key === 'importe')!;
  page.drawRectangle({ x: impCol.x - 60, y: y - 20, width: impCol.w + 60, height: 20, borderColor: LINEA, borderWidth: 0.7 });
  text(page, 'TOTAL', impCol.x - 54, y - 13, 8, bold);
  const totalStr = total.toLocaleString('es-MX');
  text(page, totalStr, impCol.x + Math.max(2, (impCol.w - reg.widthOfTextAtSize(totalStr, 8)) / 2), y - 13, 8, bold);
  text(page, `${num - 1} alumno(s) pagado(s)`, M, y - 13, 8, bold, GRIS);

  const bytes = await pdf.save();
  const claveEtapa = `${etapa.etapa}${etapa.fase}`;
  return { pdf: bytes, nombreArchivo: `INSCRITOS PAGADOS ${claveEtapa}.pdf` };
}
