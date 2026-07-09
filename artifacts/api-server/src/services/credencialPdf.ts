/**
 * Credencial digital del estudiante — carnet en PDF (frente + reverso).
 *
 * Se genera bajo demanda para alumno, gestor y administrador. Reúne los mismos
 * datos que la credencial en pantalla (mi-identificación) y agrega la lista de
 * convocatorias en las que el alumno se ha inscrito a examen.
 *
 * REGLA: la fotografía solo se incrusta si el documento 'foto' está APROBADO.
 */
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage, type PDFImage } from 'pdf-lib';
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

function fitImg(page: PDFPage, img: PDFImage, bx: number, by: number, bw: number, bh: number) {
  const s = Math.min(bw / img.width, bh / img.height);
  const w = img.width * s, h = img.height * s;
  page.drawImage(img, { x: bx + (bw - w) / 2, y: by + (bh - h) / 2, width: w, height: h });
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
      verifyUrl: `https://verifica.edumich.michoacan.gob.mx/c/${est.licenciaDigital}`,
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

  const qrImg = await doc.embedPng(await QRCode.toBuffer(verifyUrl, { width: 220, margin: 0, color: { dark: '#2a1720', light: '#ffffff' } }));
  let foto: PDFImage | null = null;
  if (fotoPath) {
    try {
      const b = await archivoBuffer(fotoPath);
      foto = b[0] === 0x89 ? await doc.embedPng(b) : await doc.embedJpg(b);
    } catch { /* foto ilegible */ }
  }

  const CW = 348, CH = 214, CX = (612 - CW) / 2;

  // Sin título de hoja: solo el carnet (frente + reverso).

  // ═══ FRENTE ═══
  const fY = 500;
  page.drawRectangle({ x: CX, y: fY, width: CW, height: CH, color: CREMA, borderColor: rgb(0.85, 0.80, 0.74), borderWidth: 1 });
  // Banda superior guinda
  page.drawRectangle({ x: CX, y: fY + CH - 40, width: CW, height: 40, color: GUINDA });
  page.drawRectangle({ x: CX, y: fY + CH - 43, width: CW, height: 3, color: DORADO });
  txt(page, 'CREDENCIAL DEL ESTUDIANTE', CX + 16, fY + CH - 24, bold, 11, BLANCO);
  txt(page, 'Preparatoria Abierta Michoacán', CX + 16, fY + CH - 35, reg, 7, rgb(0.95, 0.88, 0.9));

  // Foto
  const foX = CX + 16, foY = fY + 22, foW = 78, foH = 96;
  page.drawRectangle({ x: foX - 2, y: foY - 2, width: foW + 4, height: foH + 4, color: rgb(1, 1, 1), borderColor: DORADO, borderWidth: 1.5 });
  if (foto) fitImg(page, foto, foX, foY, foW, foH);
  else {
    page.drawRectangle({ x: foX, y: foY, width: foW, height: foH, color: rgb(0.93, 0.90, 0.86) });
    txt(page, 'SIN FOTO', foX + 16, foY + foH / 2, reg, 7, PIEDRA_500);
  }

  // Datos a la derecha de la foto
  const dX = foX + foW + 16;
  const campo = (label: string, valor: string, y: number, mono = false) => {
    txt(page, label, dX, y, bold, 6.5, PIEDRA_500);
    txt(page, valor || '—', dX, y - 12, mono ? bold : bold, mono ? 11 : 12, PIEDRA_900);
  };
  campo('NOMBRE', data.nombre, fY + CH - 62);
  campo('MATRÍCULA OFICIAL DGB', data.matricula ?? 'Sin asignar', fY + CH - 100, true);
  campo('FOLIO DE CREDENCIAL', data.folio, fY + CH - 138, true);

  // QR frente
  const qrS = 52;
  page.drawImage(qrImg, { x: CX + CW - qrS - 14, y: fY + 14, width: qrS, height: qrS });
  txt(page, 'Verifica', CX + CW - qrS - 14, fY + 6, reg, 6, PIEDRA_500);

  // ═══ REVERSO ═══
  const bY = 240;
  page.drawRectangle({ x: CX, y: bY, width: CW, height: CH, color: rgb(1, 1, 1), borderColor: rgb(0.85, 0.80, 0.74), borderWidth: 1 });
  page.drawRectangle({ x: CX, y: bY + CH - 30, width: CW, height: 30, color: GUINDA_D });
  txt(page, 'DATOS DE LA CREDENCIAL', CX + 16, bY + CH - 20, bold, 9, BLANCO);

  const rowY = (i: number) => bY + CH - 48 - i * 26;
  const dato = (label: string, valor: string, i: number, col = 0) => {
    const x = col === 0 ? CX + 16 : CX + CW / 2 + 6;
    txt(page, label, x, rowY(i), bold, 6, PIEDRA_500);
    txt(page, valor || '—', x, rowY(i) - 11, reg, 9, PIEDRA_900);
  };
  dato('CURP', curp, 0, 0);
  dato('CENTRO DE SERVICIOS', data.sede || '—', 0, 1);
  dato('PLAN', data.plan, 1, 0);
  dato('ESTADO', vencida ? 'VENCIDA' : 'VIGENTE', 1, 1);
  dato('EMISIÓN', emision ?? '—', 2, 0);
  dato('VIGENTE HASTA', vigencia ?? '—', 2, 1);

  // Convocatorias inscritas
  const cvY = rowY(3) + 2;
  txt(page, 'CONVOCATORIAS INSCRITAS', CX + 16, cvY, bold, 6, PIEDRA_500);
  const listado = convocatorias.length ? convocatorias.join('   ·   ') : 'Sin inscripciones registradas';
  txt(page, listado.length > 78 ? listado.slice(0, 75) + '…' : listado, CX + 16, cvY - 12, reg, 8.5, PIEDRA_900);

  // Pie
  page.drawRectangle({ x: CX, y: bY, width: CW, height: 18, color: rgb(0.96, 0.94, 0.90) });
  txt(page, `Folio ${data.folio}  ·  verifica.edumich.michoacan.gob.mx`, CX + 12, bY + 6, reg, 6.5, PIEDRA_500);

  const pdf = await doc.save();
  return { pdf, folio: data.folio, matricula: data.matricula };
}
