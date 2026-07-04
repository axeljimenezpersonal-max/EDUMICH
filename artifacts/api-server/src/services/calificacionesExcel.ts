/**
 * Excel de calificaciones (admin):
 *  - generarPlantillaCalificaciones: libro .xlsx con los exámenes pendientes de
 *    calificar de una etapa (folio, alumno, módulo) y columnas para capturar.
 *  - parsearExcelCalificaciones: lee el .xlsx subido y devuelve filas
 *    { folio, calificacion | noPresento } listas para aplicar.
 *
 * El folio de examen es la llave de cruce (único por inscripción).
 */

import ExcelJS from 'exceljs';

const GUINDA = 'FF6B1530';
const CREMA = 'FFF8F4EC';

export interface FilaPlantilla {
  folio: string;
  alumno: string;
  curp: string;
  moduloNumero: number;
  moduloNombre: string;
  sede: string;
}

export async function generarPlantillaCalificaciones(
  etapaLabel: string,
  filas: FilaPlantilla[]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'EDUMICH';
  const ws = wb.addWorksheet('Calificaciones');

  ws.columns = [
    { width: 22 }, { width: 42 }, { width: 22 }, { width: 8 },
    { width: 40 }, { width: 26 }, { width: 16 }, { width: 14 },
  ];

  // Título + instrucciones
  ws.mergeCells('A1:H1');
  const titulo = ws.getCell('A1');
  titulo.value = `Captura de calificaciones — ${etapaLabel}`;
  titulo.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  titulo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GUINDA } };
  titulo.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 26;

  ws.mergeCells('A2:H2');
  const instr = ws.getCell('A2');
  instr.value =
    'Instrucciones: captura la CALIFICACIÓN (0 a 100) de cada folio. Si el alumno no asistió, escribe una X en NO PRESENTÓ y deja la calificación vacía. No modifiques la columna FOLIO.';
  instr.font = { italic: true, size: 10, color: { argb: 'FF6B635E' } };
  instr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CREMA } };
  instr.alignment = { vertical: 'middle', wrapText: true, indent: 1 };
  ws.getRow(2).height = 30;

  // Encabezados (fila 4)
  const headers = ['FOLIO', 'ALUMNO', 'CURP', 'MÓD.', 'MÓDULO', 'SEDE', 'CALIFICACIÓN', 'NO PRESENTÓ'];
  const headerRow = ws.getRow(4);
  headers.forEach((h, i) => {
    const c = headerRow.getCell(i + 1);
    c.value = h;
    c.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GUINDA } };
    c.alignment = { vertical: 'middle', horizontal: i >= 6 ? 'center' : 'left' };
    c.border = { bottom: { style: 'thin', color: { argb: 'FF4A0E20' } } };
  });
  headerRow.height = 18;

  // Datos
  filas.forEach((f, idx) => {
    const row = ws.getRow(5 + idx);
    row.getCell(1).value = f.folio;
    row.getCell(2).value = f.alumno;
    row.getCell(3).value = f.curp;
    row.getCell(4).value = f.moduloNumero;
    row.getCell(5).value = f.moduloNombre;
    row.getCell(6).value = f.sede;
    row.getCell(7).value = null; // CALIFICACIÓN — a capturar
    row.getCell(8).value = null; // NO PRESENTÓ — a capturar
    row.getCell(1).font = { name: 'Courier New', size: 10 };
    row.getCell(3).font = { name: 'Courier New', size: 10 };
    row.getCell(7).alignment = { horizontal: 'center' };
    row.getCell(8).alignment = { horizontal: 'center' };
    if (idx % 2 === 1) {
      for (let c = 1; c <= 8; c++) {
        row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAF6EF' } };
      }
    }
  });

  // Validación de datos en CALIFICACIÓN (0-100) para toda la columna capturable.
  if (filas.length > 0) {
    for (let i = 0; i < filas.length; i++) {
      ws.getCell(5 + i, 7).dataValidation = {
        type: 'whole',
        operator: 'between',
        formulae: [0, 100],
        allowBlank: true,
        showErrorMessage: true,
        errorTitle: 'Calificación inválida',
        error: 'Debe ser un número entero entre 0 y 100.',
      };
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

// ─────────────────────────────────────────────────────────────────────────

export interface FilaParseada {
  folio: string;
  calificacion?: number;
  noPresento?: boolean;
}

export interface ResultadoParseo {
  filas: FilaParseada[];
  errores: { fila: number; folio: string; motivo: string }[];
}

const NP_TOKENS = new Set(['NP', 'N/P', 'NO PRESENTO', 'NO PRESENTÓ', 'X', 'SI', 'SÍ', 'TRUE', '1']);

function celdaTexto(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && 'result' in v) return String((v as { result?: unknown }).result ?? '').trim();
  if (typeof v === 'object' && 'richText' in v) {
    return (v as { richText: { text: string }[] }).richText.map((t) => t.text).join('').trim();
  }
  return String(v).trim();
}

export async function parsearExcelCalificaciones(buffer: Buffer): Promise<ResultadoParseo> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return { filas: [], errores: [{ fila: 0, folio: '', motivo: 'El archivo no tiene hojas.' }] };

  // Localiza la fila de encabezados (busca FOLIO y CALIFICACIÓN en las primeras 10 filas).
  let headerRowIdx = -1;
  let colFolio = -1;
  let colCalif = -1;
  let colNP = -1;
  for (let r = 1; r <= Math.min(10, ws.rowCount); r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= Math.min(20, ws.columnCount || 20); c++) {
      const t = celdaTexto(row.getCell(c)).toUpperCase().replace(/\s+/g, ' ');
      if (t === 'FOLIO') { headerRowIdx = r; colFolio = c; }
      if (t.startsWith('CALIFICACI')) colCalif = c;
      if (t.startsWith('NO PRESENT')) colNP = c;
    }
    if (headerRowIdx === r && colFolio > 0 && colCalif > 0) break;
  }
  if (headerRowIdx < 0 || colFolio < 0 || colCalif < 0) {
    return {
      filas: [],
      errores: [{ fila: 0, folio: '', motivo: 'No se encontraron las columnas FOLIO y CALIFICACIÓN. Usa la plantilla descargable.' }],
    };
  }

  const filas: FilaParseada[] = [];
  const errores: ResultadoParseo['errores'] = [];

  for (let r = headerRowIdx + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const folio = celdaTexto(row.getCell(colFolio));
    if (!folio) continue; // fila vacía

    const califTxt = celdaTexto(row.getCell(colCalif));
    const npTxt = colNP > 0 ? celdaTexto(row.getCell(colNP)).toUpperCase() : '';
    const esNP = (npTxt && NP_TOKENS.has(npTxt)) || NP_TOKENS.has(califTxt.toUpperCase());

    if (esNP) {
      filas.push({ folio, noPresento: true });
      continue;
    }
    if (!califTxt) continue; // sin captura — se omite en silencio

    const num = Number(califTxt.replace(',', '.'));
    if (!Number.isFinite(num) || num < 0 || num > 100) {
      errores.push({ fila: r, folio, motivo: `Calificación inválida: "${califTxt}" (debe ser 0 a 100 o NP)` });
      continue;
    }
    filas.push({ folio, calificacion: Math.round(num) });
  }

  return { filas, errores };
}
