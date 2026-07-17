/**
 * RELACIÓN DE CALIFICACIONES Y ACIERTOS — reporte descargable (PDF).
 * Replica el formato oficial de Preparatoria Abierta / Modula que emite la SEP:
 * encabezado institucional + tabla NÚM · NOMBRE · MATRÍCULA · (MÓD · C · A)…
 *
 * Un renglón por alumno, sus módulos en horizontal. La "C" es la calificación en
 * escala 0–10 (interno 0–100 ÷10) y la "A" son los aciertos. Se genera para una
 * convocatoria (o TODAS), y opcionalmente sólo para los alumnos de un gestor.
 */
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage, PDFImage } from 'pdf-lib';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { winAnsiSafe } from '../utils/pdfText';
import { LOGO_PREPA_ABIERTA, LOGO_PREPA_FACIL, LOGO_IEMSYS } from '../assets/relacionLogos';

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

  // Cabeceras OFICIALES guardadas al analizar el PDF de la SEP (relacion_cabeceras).
  // Solo estos datos son legítimos: OFICINA, FECHA DE APLICACIÓN, Nº DE COMUNICADO y
  // FECHA los EMITE la SEP. Si no hay relación cargada para una etapa, se dejan en
  // blanco ("—"); NUNCA se inventan.
  type Cabecera = { oficina: string | null; sede: string | null; fechaAplicacion: string | null; numeroComunicado: string | null; fechaDoc: string | null };
  const cabeceras = new Map<string, Cabecera>();
  try {
    const cab = await db.execute<{ etapa_clave: string; oficina: string | null; sede: string | null; fecha_aplicacion: string | null; numero_comunicado: string | null; fecha_doc: string | null }>(sql`
      SELECT etapa_clave, oficina, sede, fecha_aplicacion, numero_comunicado, fecha_doc FROM relacion_cabeceras
    `);
    for (const r of cab.rows) {
      cabeceras.set(String(r.etapa_clave).toUpperCase().replace(/[^A-Z0-9]/g, ''), {
        oficina: r.oficina, sede: r.sede, fechaAplicacion: r.fecha_aplicacion,
        numeroComunicado: r.numero_comunicado, fechaDoc: r.fecha_doc,
      });
    }
  } catch { /* tabla ausente en entornos viejos: seguimos sin cabecera */ }
  const cabeceraDe = (clave: string): Cabecera =>
    cabeceras.get(String(clave).toUpperCase().replace(/[^A-Z0-9]/g, '')) ??
    { oficina: null, sede: null, fechaAplicacion: null, numeroComunicado: null, fechaDoc: null };

  const pdf = await PDFDocument.create();
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const S = (s: string) => winAnsiSafe(s ?? '');
  const text = (p: PDFPage, s: string, x: number, y: number, size: number, font: PDFFont, color = NEGRO) =>
    p.drawText(S(s), { x, y, size, font, color });
  const tableRight = LAND.w - M;

  // Logos oficiales (extraídos del PDF de la SEP). Si alguno falla, se omite.
  const embedLogo = async (b64: string): Promise<PDFImage | null> => {
    try { return await pdf.embedPng(Buffer.from(b64, 'base64')); } catch { return null; }
  };
  const [logoAbierta, logoFacil, logoIemsys] = await Promise.all([
    embedLogo(LOGO_PREPA_ABIERTA), embedLogo(LOGO_PREPA_FACIL), embedLogo(LOGO_IEMSYS),
  ]);

  let page = pdf.addPage([LAND.w, LAND.h]);
  let pageNum = 0;
  const hoy = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });

  // Encabezado institucional (por página): franja + 3 logos + título centrado en
  // tres líneas, tal como el documento oficial.
  function bannerInstitucional(p: PDFPage): number {
    pageNum++;
    const top = LAND.h - M;
    p.drawRectangle({ x: 0, y: LAND.h - 6, width: LAND.w, height: 6, color: GUINDA });

    // Logos: Prepa Abierta (izq), Prepa Fácil (der), IEMSyS (extremo der).
    const logoH = 34;
    const drawLogo = (img: PDFImage | null, x: number, alignRight = false) => {
      if (!img) return;
      const w = (img.width / img.height) * logoH;
      p.drawImage(img, { x: alignRight ? x - w : x, y: top - logoH, width: w, height: logoH });
    };
    drawLogo(logoAbierta, M);
    drawLogo(logoIemsys, tableRight, true);
    if (logoFacil) {
      const w = (logoFacil.width / logoFacil.height) * logoH;
      drawLogo(logoFacil, tableRight - w - 90, false);
    }

    // Título centrado, tres líneas.
    const t1 = 'PREPARATORIA ABIERTA';
    text(p, t1, LAND.w / 2 - bold.widthOfTextAtSize(S(t1), 13) / 2, top - 10, 13, bold, GUINDA);
    const t2 = 'RELACIÓN DE CALIFICACIONES Y ACIERTOS';
    text(p, t2, LAND.w / 2 - bold.widthOfTextAtSize(S(t2), 11) / 2, top - 24, 11, bold, GUINDA_D);
    const t3 = 'NUEVO PLAN DE ESTUDIOS (NUPLES)';
    text(p, t3, LAND.w / 2 - reg.widthOfTextAtSize(S(t3), 8) / 2, top - 35, 8, reg, GRIS);
    text(p, `Generado: ${hoy}`, tableRight - reg.widthOfTextAtSize(`Generado: ${hoy}`, 7) / 1, LAND.h - M - logoH - 4, 7, reg, GRIS);

    return top - 46;
  }

  // Bloque de metadatos a dos columnas de una convocatoria, calcado del oficial:
  //   OFICINA / ETAPA / SEDE      HOJA / FECHA DE APLICACIÓN / Nº DE COMUNICADO / FECHA
  function bloqueMetadatos(p: PDFPage, y: number, conv: Conv): number {
    const cab = cabeceraDe(conv.clave);
    const sede = cab.sede || (conv.sede ? conv.sede.toUpperCase() : null);
    const dash = (v: string | null | undefined) => (v && String(v).trim() ? String(v).trim() : '—');
    const h = 50;
    p.drawRectangle({ x: M, y: y - h, width: tableRight - M, height: h, color: CREMA, borderColor: LINEA, borderWidth: 0.7 });
    const colDivX = M + (tableRight - M) * 0.52;
    p.drawLine({ start: { x: colDivX, y: y - h + 5 }, end: { x: colDivX, y: y - 5 }, thickness: 0.5, color: LINEA });

    const linea = (etq: string, val: string, x: number, yy: number, xVal: number) => {
      text(p, etq, x, yy, 7.5, bold, GRIS);
      text(p, val, xVal, yy, 8, reg, NEGRO);
    };
    // Columna izquierda (3 renglones, centrados verticalmente)
    const lx = M + 8, lv = M + 82;
    linea('OFICINA:', dash(cab.oficina), lx, y - 16, lv);
    linea('ETAPA:', dash(conv.clave), lx, y - 30, lv);
    linea('SEDE:', dash(sede), lx, y - 44, lv);
    // Columna derecha (4 renglones)
    const rx = colDivX + 10, rv = colDivX + 132;
    linea('HOJA:', String(pageNum), rx, y - 13, rv);
    linea('FECHA DE APLICACIÓN:', dash(cab.fechaAplicacion), rx, y - 25, rv);
    linea('NÚMERO DE COMUNICADO:', dash(cab.numeroComunicado), rx, y - 37, rv);
    linea('FECHA:', dash(cab.fechaDoc), rx, y - 45, rv);
    return y - h - 6;
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

    // Bloque de convocatoria (metadatos oficiales a dos columnas).
    if (y < M + 130) { page = pdf.addPage([LAND.w, LAND.h]); y = bannerInstitucional(page); }
    y -= 4;
    y = bloqueMetadatos(page, y, conv);

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
