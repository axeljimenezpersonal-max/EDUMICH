import ExcelJS from 'exceljs';

const GUINDA = 'FF6B0F3C';
const GUINDA_LIGHT = 'FFF5E6EF';
const GOLD = 'FFBF9000';
const WHITE = 'FFFFFFFF';
const GREY_BG = 'FFF2F2F2';

export interface ReporteData {
  tipo: string;
  nombre: string;
  filtros: Record<string, unknown>;
  kpis: { label: string; valor: string | number; unidad?: string }[];
  columnas: string[];
  filas: (string | number | null)[][];
  generadoEn: Date;
  generadoPor: string;
}

// SEGURIDAD: evita "formula/CSV injection". Si una celda de texto empieza con
// = + - @ (o tab/CR), Excel la interpreta como fórmula al abrir el archivo.
// Se antepone un apóstrofe para forzar que se trate como texto.
function sanitizarCelda(val: string | number | null): string | number | null {
  if (typeof val === 'string' && /^[=+\-@\t\r]/.test(val)) {
    return `'${val}`;
  }
  return val;
}

function cabeceraEstilo(ws: ExcelJS.Worksheet, row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GUINDA } };
    cell.font = { color: { argb: WHITE }, bold: true, size: 11 };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      bottom: { style: 'thin', color: { argb: GOLD } },
    };
  });
  row.height = 22;
}

function subCabeceraEstilo(ws: ExcelJS.Worksheet, row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GUINDA_LIGHT } };
    cell.font = { bold: true, size: 10, color: { argb: GUINDA } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  row.height = 18;
}

export async function generarExcelReporte(data: ReporteData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Modula · Sistema Preparatoria Abierta';
  wb.created = data.generadoEn;

  // ── Hoja 1: Resumen ──
  const wsResumen = wb.addWorksheet('Resumen', {
    views: [{ showGridLines: false }],
  });
  wsResumen.columns = [
    { width: 30 },
    { width: 40 },
    { width: 20 },
    { width: 20 },
  ];

  // Logo / encabezado institucional
  wsResumen.mergeCells('A1:D1');
  const titleCell = wsResumen.getCell('A1');
  titleCell.value = 'Modula · Sistema Preparatoria Abierta — IEMSyS Michoacán';
  titleCell.font = { bold: true, size: 14, color: { argb: WHITE } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GUINDA } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  wsResumen.getRow(1).height = 32;

  wsResumen.mergeCells('A2:D2');
  const subtitleCell = wsResumen.getCell('A2');
  subtitleCell.value = data.nombre;
  subtitleCell.font = { bold: true, size: 12, color: { argb: GUINDA } };
  subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GUINDA_LIGHT } };
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  wsResumen.getRow(2).height = 24;

  // Metadata
  wsResumen.addRow([]);
  const metaData = [
    ['Generado el:', data.generadoEn.toLocaleString('es-MX')],
    ['Generado por:', data.generadoPor],
    ['Tipo de reporte:', data.tipo],
    ['Período:', (data.filtros.fechaInicio && data.filtros.fechaFin)
      ? `${data.filtros.fechaInicio} al ${data.filtros.fechaFin}`
      : 'General'],
  ];
  for (const [label, valor] of metaData) {
    const r = wsResumen.addRow([label, valor]);
    r.getCell(1).font = { bold: true, color: { argb: GUINDA } };
    r.getCell(2).font = { size: 10 };
    r.height = 16;
  }

  wsResumen.addRow([]);
  wsResumen.addRow([]);

  // KPIs
  const kpiTitleRow = wsResumen.addRow(['INDICADORES CLAVE']);
  wsResumen.mergeCells(`A${kpiTitleRow.number}:D${kpiTitleRow.number}`);
  cabeceraEstilo(wsResumen, kpiTitleRow);

  const kpiHeaderRow = wsResumen.addRow(['Indicador', 'Valor', 'Unidad', '']);
  subCabeceraEstilo(wsResumen, kpiHeaderRow);

  let altRow = false;
  for (const kpi of data.kpis) {
    const r = wsResumen.addRow([kpi.label, kpi.valor, kpi.unidad ?? '', '']);
    if (altRow) {
      r.eachCell((c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREY_BG } };
      });
    }
    r.getCell(1).font = { bold: true };
    r.getCell(2).font = { size: 11, bold: true, color: { argb: GUINDA } };
    r.height = 18;
    altRow = !altRow;
  }

  // ── Hoja 2: Datos Detallados ──
  const wsDatos = wb.addWorksheet('Datos Detallados', {
    views: [{ showGridLines: false, state: 'frozen', xSplit: 0, ySplit: 1 }],
  });

  // Auto-width columns
  const colWidths = data.columnas.map((col) => Math.max(col.length + 4, 14));
  for (const fila of data.filas) {
    fila.forEach((val, i) => {
      const len = String(val ?? '').length + 2;
      if (len > colWidths[i]) colWidths[i] = Math.min(len, 50);
    });
  }
  wsDatos.columns = colWidths.map((width) => ({ width }));

  const headerRow = wsDatos.addRow(data.columnas);
  cabeceraEstilo(wsDatos, headerRow);

  altRow = false;
  for (const fila of data.filas) {
    const r = wsDatos.addRow(fila.map(sanitizarCelda));
    if (altRow) {
      r.eachCell((c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREY_BG } };
      });
    }
    r.height = 16;
    altRow = !altRow;
  }

  // Border box on the data table
  const lastDataRow = wsDatos.lastRow?.number ?? 1;
  for (let rowNum = 1; rowNum <= lastDataRow; rowNum++) {
    const r = wsDatos.getRow(rowNum);
    r.eachCell({ includeEmpty: true }, (cell, colNum) => {
      if (colNum <= data.columnas.length) {
        cell.border = {
          top: { style: 'hair' },
          bottom: { style: 'hair' },
          left: colNum === 1 ? { style: 'thin', color: { argb: GUINDA } } : { style: 'hair' },
          right: colNum === data.columnas.length ? { style: 'thin', color: { argb: GUINDA } } : { style: 'hair' },
        };
      }
    });
  }

  // ── Hoja 3: Gráfica (datos para que el usuario genere la gráfica en Excel) ──
  const wsGrafica = wb.addWorksheet('Gráfica');
  wsGrafica.mergeCells('A1:C1');
  const graficaNote = wsGrafica.getCell('A1');
  graficaNote.value = '📊 Selecciona los datos de la hoja "Datos Detallados" para insertar una gráfica';
  graficaNote.font = { italic: true, color: { argb: GUINDA } };
  graficaNote.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GUINDA_LIGHT } };
  wsGrafica.getRow(1).height = 22;

  // Mirror first 2 columns for quick chart source
  if (data.filas.length > 0) {
    const chartLabelCol = data.columnas[0];
    const chartValCol = data.columnas.find((c) => /total|count|cant|núm|num|alumn|inscr/i.test(c)) ?? data.columnas[1];
    const chartLabelIdx = 0;
    const chartValIdx = data.columnas.indexOf(chartValCol);

    wsGrafica.addRow([]);
    const gcHeader = wsGrafica.addRow([chartLabelCol, chartValCol]);
    subCabeceraEstilo(wsGrafica, gcHeader);
    wsGrafica.columns = [{ width: 32 }, { width: 16 }];

    for (const fila of data.filas) {
      wsGrafica.addRow([fila[chartLabelIdx], fila[chartValIdx]]);
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
