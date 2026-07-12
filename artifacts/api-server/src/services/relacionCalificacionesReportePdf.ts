/**
 * RELACIÓN DE CALIFICACIONES Y ACIERTOS — reporte descargable (PDF).
 * Replica el formato oficial de Preparatoria Abierta / EDUMICH que emite la SEP:
 * encabezado institucional + tabla NÚM · NOMBRE · MATRÍCULA · (MÓD · C · A)…
 *
 * Un renglón por alumno, sus módulos en horizontal. La "C" es la calificación en
 * escala 0–10 (interno 0–100 ÷10) y la "A" son los aciertos. Se genera para una
 * convocatoria (o TODAS), y opcionalmente sólo para los alumnos de un gestor.
 */
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { winAnsiSafe } from '../utils/pdfText';

const GUINDA = rgb(0.42, 0.08, 0.19);
const GUINDA_D = rgb(0.30, 0.05, 0.14);
const NEGRO = rgb(0.1, 0.1, 0.1);
const GRIS = rgb(0.4, 0.38, 0.36);
const VERDE = rgb(0.02, 0.42, 0.28);
const ROJO = rgb(0.6, 0.07, 0.11);
const LINEA = rgb(0.7, 0.68, 0.66);
const LINEA_SUAVE = rgb(0.86, 0.84, 0.81);
const CREMA = rgb(0.97, 0.95, 0.91);

const LAND = { w: 841.89, h: 595.28 }; // A4 horizontal
const M = 28;

function calif10(c: number | null): string {
  if (c === null || c === undefined) return '';
  const v = c / 10;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

type Row = {
  estudiante_id: number; alumno: string; matricula: string | null;
  etapa_id: number; etapa_clave: string; etapa_anio: number;
  sede: string | null;
  modulo_numero: number; calificacion: number | null; aciertos: number | null; estado: string;
};

export async function generarRelacionCalificacionesReporte(opts: {
  etapaId?: number | null;
  gestorId?: number | null;
}): Promise<{ pdf: Uint8Array; nombreArchivo: string; convocatoriaEtiqueta: string }> {
  const filtros = [
    sql`(EXISTS (SELECT 1 FROM pagos_examen_inscripciones pei JOIN pagos_examen pe ON pe.id = pei.pago_examen_id AND pe.estado = 'pagado' WHERE pei.examen_inscripcion_id = ei.id)
      OR ei.calificacion IS NOT NULL OR ei.estado IN ('aprobado','reprobado','no_presento'))`,
  ];
  if (opts.etapaId) filtros.push(sql`ce.id = ${opts.etapaId}`);
  if (opts.gestorId) filtros.push(sql`es.gestor_id = ${opts.gestorId}`);
  const where = sql.join(filtros, sql` AND `);

  const result = await db.execute<Row>(sql`
    SELECT ei.estudiante_id, es.nombre_completo AS alumno, es.matricula_oficial_dgb AS matricula,
           ce.id AS etapa_id, ce.clave AS etapa_clave, ce.anio AS etapa_anio,
           mu.nombre AS sede,
           m.numero AS modulo_numero, ei.calificacion, c.aciertos, ei.estado
    FROM examenes_inscripciones ei
    JOIN estudiantes es ON es.user_id = ei.estudiante_id
    LEFT JOIN municipios mu ON mu.id = es.municipio_id
    JOIN convocatorias_etapas ce ON ce.id = ei.etapa_id
    JOIN modulos m ON m.id = ei.modulo_id
    LEFT JOIN calificaciones c ON c.inscripcion_examen_id = ei.id
    WHERE ${where}
    ORDER BY ce.clave, es.nombre_completo, m.numero
  `);

  // Agrupar por convocatoria → alumno → módulos
  type Mod = { modulo: number; calif: number | null; aciertos: number | null; estado: string };
  type Alumno = { id: number; nombre: string; matricula: string | null; mods: Mod[] };
  type Conv = { etapaId: number; clave: string; anio: number; sede: string | null; alumnos: Map<number, Alumno>; };
  const convs = new Map<number, Conv>();
  for (const r of result.rows) {
    let g = convs.get(r.etapa_id);
    if (!g) { g = { etapaId: r.etapa_id, clave: r.etapa_clave, anio: r.etapa_anio, sede: r.sede, alumnos: new Map() }; convs.set(r.etapa_id, g); }
    if (!g.sede && r.sede) g.sede = r.sede;
    let a = g.alumnos.get(r.estudiante_id);
    if (!a) { a = { id: r.estudiante_id, nombre: r.alumno, matricula: r.matricula, mods: [] }; g.alumnos.set(r.estudiante_id, a); }
    a.mods.push({ modulo: Number(r.modulo_numero), calif: r.calificacion, aciertos: r.aciertos, estado: r.estado });
  }

  const pdf = await PDFDocument.create();
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const S = (s: string) => winAnsiSafe(s ?? '');
  const text = (p: PDFPage, s: string, x: number, y: number, size: number, font: PDFFont, color = NEGRO) =>
    p.drawText(S(s), { x, y, size, font, color });
  const tableRight = LAND.w - M;

  let page = pdf.addPage([LAND.w, LAND.h]);
  const hoy = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });

  function bannerInstitucional(p: PDFPage): number {
    const y = LAND.h - M;
    p.drawRectangle({ x: 0, y: LAND.h - 6, width: LAND.w, height: 6, color: GUINDA });
    // Marca (izquierda) + fecha (derecha), en su propia línea.
    text(p, 'PREPARATORIA ABIERTA', M, y - 6, 13, bold, GUINDA);
    text(p, ' · MICHOACÁN', M + bold.widthOfTextAtSize(S('PREPARATORIA ABIERTA'), 13), y - 6, 10, bold, GRIS);
    text(p, `Generado: ${hoy}`, tableRight - reg.widthOfTextAtSize(`Generado: ${hoy}`, 7.5), y - 6, 7.5, reg, GRIS);
    // Títulos centrados, DEBAJO de la marca (sin encimarse).
    const inst = 'INSTITUTO DE EDUCACIÓN MEDIA SUPERIOR Y SUPERIOR DEL ESTADO DE MICHOACÁN';
    text(p, inst, LAND.w / 2 - reg.widthOfTextAtSize(S(inst), 8) / 2, y - 22, 8, reg, GRIS);
    const rel = 'RELACIÓN DE CALIFICACIONES Y ACIERTOS';
    text(p, rel, LAND.w / 2 - bold.widthOfTextAtSize(S(rel), 12) / 2, y - 36, 12, bold, GUINDA_D);
    return y - 50;
  }

  // Cabecera de la tabla para una convocatoria (columnas dinámicas por maxMods).
  function columnas(maxMods: number) {
    const wNum = 26, wMat = 92, tripW = 96; // (MÓD 32 + C 30 + A 34)
    const wNombre = Math.max(150, (tableRight - M) - wNum - wMat - maxMods * tripW);
    const cols: { key: string; label: string; x: number; w: number; center?: boolean }[] = [];
    let x = M;
    cols.push({ key: 'num', label: 'NÚM.', x, w: wNum, center: true }); x += wNum;
    cols.push({ key: 'nom', label: 'NOMBRE', x, w: wNombre }); x += wNombre;
    cols.push({ key: 'mat', label: 'MATRÍCULA', x, w: wMat }); x += wMat;
    for (let i = 0; i < maxMods; i++) {
      cols.push({ key: `mod${i}`, label: 'MÓD.', x, w: 32, center: true }); x += 32;
      cols.push({ key: `c${i}`, label: 'C.', x, w: 30, center: true }); x += 30;
      cols.push({ key: `a${i}`, label: 'A.', x, w: 34, center: true }); x += 34;
    }
    return cols;
  }

  function cabeceraTabla(p: PDFPage, y: number, cols: ReturnType<typeof columnas>): number {
    const h = 16;
    p.drawRectangle({ x: M, y: y - h, width: tableRight - M, height: h, color: CREMA, borderColor: LINEA, borderWidth: 0.7 });
    for (const c of cols) {
      const tw = bold.widthOfTextAtSize(S(c.label), 7);
      const tx = c.center ? c.x + (c.w - tw) / 2 : c.x + 3;
      text(p, c.label, tx, y - 11, 7, bold, GRIS);
      if (c.x > M) p.drawLine({ start: { x: c.x, y: y - h }, end: { x: c.x, y }, thickness: 0.4, color: LINEA });
    }
    return y - h;
  }

  const convList = Array.from(convs.values()).sort((a, b) => `${b.clave}`.localeCompare(`${a.clave}`, 'es'));
  let y = bannerInstitucional(page);

  for (const conv of convList) {
    const alumnos = Array.from(conv.alumnos.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    for (const a of alumnos) a.mods.sort((x, z) => x.modulo - z.modulo);
    const maxMods = alumnos.reduce((mx, a) => Math.max(mx, a.mods.length), 1);
    const cols = columnas(maxMods);

    // Bloque de convocatoria
    if (y < M + 90) { page = pdf.addPage([LAND.w, LAND.h]); y = bannerInstitucional(page); }
    y -= 6;
    text(page, `ETAPA: ${conv.clave}`, M, y - 8, 9, bold, GUINDA_D);
    text(page, `AÑO: ${conv.anio}`, M + 150, y - 8, 8.5, reg, NEGRO);
    if (conv.sede) text(page, `SEDE: ${conv.sede.toUpperCase()}`, M + 250, y - 8, 8.5, reg, NEGRO);
    text(page, `ALUMNOS: ${alumnos.length}`, tableRight - 90, y - 8, 8.5, reg, GRIS);
    y -= 18;

    y = cabeceraTabla(page, y, cols);

    const rowH = 15;
    let num = 1;
    for (const a of alumnos) {
      if (y - rowH < M + 20) { page = pdf.addPage([LAND.w, LAND.h]); y = bannerInstitucional(page); y = cabeceraTabla(page, y, cols); }
      const cell = (key: string, val: string, color = NEGRO, font = reg) => {
        const c = cols.find((cc) => cc.key === key); if (!c) return;
        const tw = font.widthOfTextAtSize(S(val), 7.5);
        const x = c.center ? c.x + Math.max(2, (c.w - tw) / 2) : c.x + 3;
        text(page, val, x, y - 10.5, 7.5, font, color);
      };
      cell('num', String(num), GRIS);
      // nombre truncado al ancho de la columna
      const cNom = cols.find((c) => c.key === 'nom')!;
      let nom = a.nombre.toUpperCase();
      while (nom.length > 4 && reg.widthOfTextAtSize(S(nom), 7.5) > cNom.w - 6) nom = nom.slice(0, -2);
      cell('nom', nom === a.nombre.toUpperCase() ? nom : nom + '…', NEGRO, bold);
      cell('mat', a.matricula ?? '—');
      a.mods.forEach((m, i) => {
        cell(`mod${i}`, String(m.modulo), GUINDA_D, bold);
        const aprob = m.estado === 'aprobado' || (m.calif != null && m.calif >= 60);
        cell(`c${i}`, calif10(m.calif) || '—', m.calif == null ? GRIS : (aprob ? VERDE : ROJO), bold);
        cell(`a${i}`, m.aciertos != null ? String(m.aciertos) : '—', GRIS);
      });
      // rejilla
      for (const c of cols) if (c.x > M) page.drawLine({ start: { x: c.x, y: y - rowH }, end: { x: c.x, y }, thickness: 0.35, color: LINEA_SUAVE });
      page.drawLine({ start: { x: M, y: y - rowH }, end: { x: tableRight, y: y - rowH }, thickness: 0.35, color: LINEA_SUAVE });
      page.drawLine({ start: { x: M, y: y - rowH }, end: { x: M, y }, thickness: 0.5, color: LINEA });
      page.drawLine({ start: { x: tableRight, y: y - rowH }, end: { x: tableRight, y }, thickness: 0.5, color: LINEA });
      y -= rowH;
      num++;
    }
    y -= 14;
  }

  // Pie: leyenda + numeración
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    text(p, 'MÓD. = módulo  ·  C. = calificación (0–10, aprueba con 6)  ·  A. = aciertos  ·  — = sin registrar', M, M - 6, 6.5, reg, GRIS);
    const pg = `Hoja ${i + 1} de ${pages.length}`;
    text(p, pg, tableRight - reg.widthOfTextAtSize(pg, 7), M - 6, 7, reg, GRIS);
  });

  const bytes = await pdf.save();
  const etiqueta = opts.etapaId && convList.length === 1 ? `${convList[0].clave}-${convList[0].anio}` : 'TODAS';
  const nombreArchivo = `CALIFICACIONES ${etiqueta}.pdf`;
  const convocatoriaEtiqueta = opts.etapaId && convList.length === 1 ? `${convList[0].clave} · ${convList[0].anio}` : 'Todas las convocatorias';
  return { pdf: bytes, nombreArchivo, convocatoriaEtiqueta };
}
