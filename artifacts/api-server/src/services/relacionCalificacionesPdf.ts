/**
 * Parser de la "RELACIÓN DE CALIFICACIONES Y ACIERTOS" oficial de Prepa Abierta
 * (Nuevo Plan de Estudios / NUPLES) que emite la SEP.
 *
 * El PDF es un reporte tabular de ancho fijo. Cada renglón de alumno trae:
 *   NÚM | NOMBRE | MATRÍCULA(12 díg) | [ MÓD, CALIF(0-10), ACIERTOS ] × N
 * Tras la matrícula, los tokens numéricos vienen en TRIPLETES perfectos
 * (verificado con archivos reales: 0 filas con resto). Extraemos con pdfjs
 * (tokeniza limpio y con coordenadas), agrupamos por renglón (coordenada Y) y
 * partimos en tripletes.
 *
 * IMPORTANTE: la calificación del PDF está en escala 0-10 (6 = aprobado). La
 * plataforma almacena 0-100, así que quien consuma esto multiplica ×10.
 */
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

export interface CalificacionPdf {
  modulo: number;      // número de módulo (1-22)
  calificacion: number; // escala 0-10 tal como viene en el PDF
  aciertos: number;
}

export interface AlumnoPdf {
  num: number | null;      // número de renglón en el reporte
  nombre: string;
  matricula: string;       // 12 dígitos
  calificaciones: CalificacionPdf[];
}

export interface RelacionPdf {
  cabecera: {
    oficina: string | null;   // "1601 MORELIA"
    sede: string | null;      // "009 ZAMORA"
    etapa: string | null;     // "2401-B"
    fechaAplicacion: string | null; // texto tal cual
    fecha: string | null;     // "2024-FEB-06"
    fechaExamenISO: string | null;  // fecha derivada YYYY-MM-DD para almacenar
  };
  alumnos: AlumnoPdf[];
  totalCalificaciones: number;
  filasConProblema: number; // renglones cuyos números no cuadraron en tripletes
}

interface Token { x: number; y: number; t: string }

const MESES: Record<string, string> = {
  ENE: '01', FEB: '02', MAR: '03', ABR: '04', MAY: '05', JUN: '06',
  JUL: '07', AGO: '08', SEP: '09', OCT: '10', NOV: '11', DIC: '12',
};

/** Deriva una fecha YYYY-MM-DD para `fecha_examen`. */
function derivarFechaISO(fechaAplicacion: string | null, fecha: string | null): string | null {
  // 1) De "FECHA:2024-FEB-06" tomamos el año, y de la aplicación el día/mes.
  const anioMatch = fecha?.match(/(\d{4})/);
  const anio = anioMatch ? anioMatch[1] : null;
  // "27, 28  DE ENERO" → primer día + mes en palabra
  if (fechaAplicacion && anio) {
    const dia = fechaAplicacion.match(/(\d{1,2})/);
    const mesPal = fechaAplicacion.toUpperCase().match(/DE\s+([A-ZÑ]+)/);
    if (dia && mesPal) {
      const nombreMes = mesPal[1].slice(0, 3);
      const mm = MESES[nombreMes];
      if (mm) return `${anio}-${mm}-${dia[1].padStart(2, '0')}`;
    }
  }
  // 2) Fallback: la propia "FECHA: 2024-FEB-06"
  if (fecha) {
    const m = fecha.match(/(\d{4})-([A-ZÑ]{3})-(\d{1,2})/i);
    if (m) {
      const mm = MESES[m[2].toUpperCase()];
      if (mm) return `${m[1]}-${mm}-${m[3].padStart(2, '0')}`;
    }
  }
  return null;
}

/** Extrae el texto que sigue a una etiqueta dentro de la línea de encabezado. */
function valorTrasEtiqueta(tokens: Token[], etiqueta: RegExp): string | null {
  const base = tokens.find((t) => etiqueta.test(t.t));
  if (!base) return null;
  // Tokens de la MISMA línea (misma Y aprox) a la derecha de la etiqueta,
  // ordenados por X. pdfjs no garantiza orden de lectura, así que filtramos por
  // coordenada, no por posición en el arreglo. Cortamos al llegar a la siguiente
  // etiqueta (cualquier token con ':' o palabra de encabezado conocida).
  const finReg = /:|OFICINA|SEDE|ETAPA|HOJA|FECHA|N[UÚ]MERO|COMUNICADO|APLICACI/i;
  const partes: string[] = [];
  const misma = tokens
    .filter((t) => t !== base && Math.abs(t.y - base.y) < 3 && t.x > base.x)
    .sort((a, b) => a.x - b.x);
  for (const tk of misma) {
    if (finReg.test(tk.t)) break;
    partes.push(tk.t);
    if (partes.join(' ').length > 40) break;
  }
  const val = partes.join(' ').trim();
  return val || null;
}

export async function parsearRelacionCalificaciones(buffer: Buffer | Uint8Array): Promise<RelacionPdf> {
  // pdfjs exige un Uint8Array PLANO (rechaza Buffer, aunque herede de Uint8Array).
  const data = new Uint8Array(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  );
  const doc = await getDocument({ data, useSystemFonts: true, isEvalSupported: false }).promise;

  const alumnos: AlumnoPdf[] = [];
  let filasConProblema = 0;
  let totalCalificaciones = 0;
  const cabecera: RelacionPdf['cabecera'] = {
    oficina: null, sede: null, etapa: null, fechaAplicacion: null, fecha: null, fechaExamenISO: null,
  };

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const tokens: Token[] = tc.items
      .map((i: any) => ({ x: i.transform[4] as number, y: Math.round(i.transform[5] as number), t: (i.str as string).trim() }))
      .filter((i: Token) => i.t.length > 0);

    // Cabecera: solo de la primera página (se repite en todas).
    if (p === 1) {
      cabecera.oficina = valorTrasEtiqueta(tokens, /^OFICINA/i);
      cabecera.sede = valorTrasEtiqueta(tokens, /^SEDE/i);
      cabecera.etapa = valorTrasEtiqueta(tokens, /^ETAPA/i);
      cabecera.fechaAplicacion = valorTrasEtiqueta(tokens, /APLICACI[ÓO]N/i);
      const fechaTok = tokens.find((t) => /FECHA:/i.test(t.t) || /^\d{4}-[A-ZÑ]{3}-\d{1,2}/i.test(t.t));
      if (fechaTok) cabecera.fecha = fechaTok.t.replace(/^FECHA:\s*/i, '').trim();
    }

    // Agrupar tokens por renglón (Y con tolerancia).
    const lineas = new Map<number, Token[]>();
    for (const tk of tokens) {
      let clave = [...lineas.keys()].find((k) => Math.abs(k - tk.y) < 3);
      if (clave === undefined) clave = tk.y;
      if (!lineas.has(clave)) lineas.set(clave, []);
      lineas.get(clave)!.push(tk);
    }

    for (const cells of lineas.values()) {
      cells.sort((a, b) => a.x - b.x);
      const mat = cells.find((c) => /^\d{12}$/.test(c.t));
      if (!mat) continue; // no es renglón de alumno

      // NÚM: primer token numérico corto ANTES del nombre (x pequeña).
      const numTok = cells.find((c) => c.x < mat.x && /^\d{1,3}$/.test(c.t));
      // NOMBRE: tokens alfabéticos entre el NÚM y la matrícula.
      const nombre = cells
        .filter((c) => c.x < mat.x && /[A-ZÁÉÍÓÚÑ]/i.test(c.t) && !/^\d+$/.test(c.t))
        .map((c) => c.t)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Números DESPUÉS de la matrícula → tripletes [módulo, calif, aciertos].
      const nums = cells
        .filter((c) => c.x > mat.x && /^\d+$/.test(c.t))
        .map((c) => parseInt(c.t, 10));

      const califs: CalificacionPdf[] = [];
      for (let i = 0; i + 2 < nums.length; i += 3) {
        califs.push({ modulo: nums[i], calificacion: nums[i + 1], aciertos: nums[i + 2] });
      }
      // Un renglón "sano" tiene un múltiplo de 3 de números y módulos válidos.
      const resto = nums.length % 3;
      const moduloInvalido = califs.some((c) => c.modulo < 1 || c.modulo > 22);
      if (resto !== 0 || moduloInvalido) filasConProblema++;

      totalCalificaciones += califs.length;
      alumnos.push({
        num: numTok ? parseInt(numTok.t, 10) : null,
        nombre,
        matricula: mat.t,
        calificaciones: califs,
      });
    }
  }

  cabecera.fechaExamenISO = derivarFechaISO(cabecera.fechaAplicacion, cabecera.fecha);

  return { cabecera, alumnos, totalCalificaciones, filasConProblema };
}
