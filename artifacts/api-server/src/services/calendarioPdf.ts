/**
 * Lector del calendario oficial de exámenes ordinarios (DGB, Plan 22).
 *
 * El PDF es una TABLA: ocho columnas (una por etapa) y una fila por módulo. No
 * se puede leer por orden de lectura, porque el orden de los fragmentos de texto
 * dentro del PDF no siempre sigue las columnas. Se lee por POSICIÓN: cada valor
 * se asigna a la columna cuyo encabezado está más cerca en el eje X.
 *
 * Lo que saca del documento:
 *   - las 8 etapas con su clave (2605-A …), su ventana de solicitud y los dos
 *     días de examen (sábado y domingo);
 *   - el horario de CADA módulo en CADA etapa (día + hora), que es el dato que
 *     hasta ahora había que copiar a mano de una etapa previa.
 *
 * Nunca crea nada: devuelve lo leído para que un humano lo revise. Si el formato
 * del documento cambiara en un ciclo futuro, lo peor que pasa es que la lectura
 * salga incompleta y se corrija a mano — no que ensucie la base en silencio.
 */
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

export interface HorarioLeido {
  moduloNumero: number;
  dia: 'sabado' | 'domingo';
  hora: string; // 'HH:MM'
}

export interface EtapaLeida {
  clave: string;   // '2605-A'
  etapa: string;   // '2605'
  fase: string;    // 'A'
  anio: number;
  solicitudInicio: string; // 'YYYY-MM-DD'
  solicitudFin: string;
  examenSabado: string;
  examenDomingo: string;
  horarios: HorarioLeido[];
}

export interface CalendarioLeido {
  anio: number;
  etapas: EtapaLeida[];
  /** Lo que no cuadró. Se muestra al admin junto a la vista previa. */
  advertencias: string[];
}

interface Item { x: number; y: number; t: string }

const MESES: Record<string, number> = {
  ene: 1, enero: 1, feb: 2, febrero: 2, mar: 3, marzo: 3, abr: 4, abril: 4,
  may: 5, mayo: 5, jun: 6, junio: 6, jul: 7, julio: 7, ago: 8, agosto: 8,
  sep: 9, sept: 9, septiembre: 9, oct: 10, octubre: 10, nov: 11, noviembre: 11,
  dic: 12, diciembre: 12,
};

function mesDe(texto: string): number | null {
  const k = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
  return MESES[k] ?? null;
}

const fecha = (a: number, m: number, d: number) =>
  `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** Agrupa items en filas por su Y (con tolerancia: la misma fila varía un poco). */
function porFilas(items: Item[], tolerancia = 3): Item[][] {
  const mapa = new Map<number, Item[]>();
  for (const it of items) {
    const k = Math.round(it.y / tolerancia) * tolerancia;
    if (!mapa.has(k)) mapa.set(k, []);
    mapa.get(k)!.push(it);
  }
  return [...mapa.entries()]
    .sort((a, b) => b[0] - a[0])              // de arriba hacia abajo
    .map(([, fila]) => fila.sort((a, b) => a.x - b.x));
}

/** Índice de la columna cuyo ancla está más cerca en X (o -1 si queda lejos). */
function columnaMasCercana(x: number, anclas: number[], maxDistancia = 26): number {
  let mejor = -1;
  let dist = Infinity;
  anclas.forEach((ax, i) => {
    const d = Math.abs(x - ax);
    if (d < dist) { dist = d; mejor = i; }
  });
  return dist <= maxDistancia ? mejor : -1;
}

export async function parsearCalendarioPdf(buffer: Buffer): Promise<CalendarioLeido> {
  const doc = await getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
  const advertencias: string[] = [];

  const items: Item[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    for (const raw of tc.items as Array<{ str?: string; transform?: number[] }>) {
      const t = (raw.str ?? '').trim();
      if (!t || !raw.transform) continue;
      items.push({ x: Math.round(raw.transform[4]), y: Math.round(raw.transform[5]), t });
    }
  }
  if (items.length === 0) throw new Error('El PDF no contiene texto legible (¿es un escaneo?).');

  const filas = porFilas(items);

  // ── Año del ciclo ─────────────────────────────────────────────────────────
  const anioItem = items.find((i) => /^20\d{2}$/.test(i.t));
  const anio = anioItem ? Number(anioItem.t) : new Date().getFullYear();
  if (!anioItem) advertencias.push('No se encontró el año en el documento; se asumió el año en curso.');

  // ── Encabezado de etapas: fila con varios códigos de 4 dígitos ────────────
  const filaEtapas = filas.find((f) => f.filter((i) => /^\d{4}$/.test(i.t)).length >= 4);
  if (!filaEtapas) throw new Error('No se encontró la fila de etapas (códigos como 2605, 2606…).');

  const columnas: Array<{ clave: string; etapa: string; fase: string; x: number }> = [];
  for (const it of filaEtapas.filter((i) => /^\d{4}$/.test(i.t))) {
    // La fase (A/B) es la letra suelta inmediatamente a la derecha del código.
    const fase = filaEtapas
      .filter((o) => /^[A-Z]$/.test(o.t) && o.x > it.x && o.x - it.x < 60)
      .sort((a, b) => a.x - b.x)[0];
    if (!fase) { advertencias.push(`La etapa ${it.t} no tiene fase legible; se omitió.`); continue; }
    columnas.push({ clave: `${it.t}-${fase.t}`, etapa: it.t, fase: fase.t, x: it.x });
  }
  columnas.sort((a, b) => a.x - b.x);
  if (columnas.length === 0) throw new Error('No se pudo leer ninguna etapa del encabezado.');

  const anclasEtapa = columnas.map((c) => c.x);

  // ── Ventana de solicitud: «Abr 13 al 17» ──────────────────────────────────
  const RE_SOLICITUD = /^([A-Za-zÁÉÍÓÚáéíóú]{3,10})\.?\s+(\d{1,2})\s+al\s+(\d{1,2})$/;
  const solicitudPorColumna = new Map<number, { mes: number; d1: number; d2: number }>();
  for (const fila of filas) {
    for (const it of fila) {
      const m = RE_SOLICITUD.exec(it.t);
      if (!m) continue;
      const mes = mesDe(m[1]);
      if (!mes) continue;
      // El texto arranca a la altura de su columna (alineado a la izquierda).
      const col = columnaMasCercana(it.x, anclasEtapa, 30);
      if (col >= 0 && !solicitudPorColumna.has(col)) {
        solicitudPorColumna.set(col, { mes, d1: Number(m[2]), d2: Number(m[3]) });
      }
    }
  }

  // ── Días de examen: «SÁB 09» / «DOM 10» ───────────────────────────────────
  const RE_DIA = /^(SÁB|SAB|DOM)\.?\s*(\d{1,2})$/i;
  const filaDias = filas.find((f) => f.filter((i) => RE_DIA.test(i.t)).length >= 4);
  if (!filaDias) throw new Error('No se encontró la fila de días de examen (SÁB / DOM).');

  // Anclas finas: cada etapa tiene su sábado y su domingo en X distintos. Con
  // ellas se decide, más abajo, si el horario de un módulo cae en sábado o en
  // domingo.
  const anclasDia: Array<{ col: number; dia: 'sabado' | 'domingo'; x: number; num: number }> = [];
  for (const it of filaDias) {
    const m = RE_DIA.exec(it.t);
    if (!m) continue;
    const col = columnaMasCercana(it.x, anclasEtapa, 40);
    if (col < 0) continue;
    anclasDia.push({
      col,
      dia: /^dom/i.test(m[1]) ? 'domingo' : 'sabado',
      x: it.x,
      num: Number(m[2]),
    });
  }

  // ── Mes de examen por columna (encabezados MAYO / JUNIO / …) ──────────────
  // Cada mes abarca dos etapas, así que se asigna por cercanía a la columna.
  const mesExamenPorColumna = new Map<number, number>();
  const filaMeses = filas.find((f) => f.filter((i) => mesDe(i.t) !== null && /^[A-ZÁÉÍÓÚ]+$/.test(i.t)).length >= 3);
  if (filaMeses) {
    const meses = filaMeses
      .filter((i) => mesDe(i.t) !== null && /^[A-ZÁÉÍÓÚ]+$/.test(i.t))
      .map((i) => ({ mes: mesDe(i.t)!, x: i.x }));
    columnas.forEach((c, idx) => {
      let mejor = meses[0];
      for (const m of meses) if (Math.abs(m.x - c.x) < Math.abs(mejor.x - c.x)) mejor = m;
      if (mejor) mesExamenPorColumna.set(idx, mejor.mes);
    });
  }
  // Respaldo: la clave codifica el mes (2605 → mes 05). Si el encabezado falló,
  // o si no coincide, mandan los dos últimos dígitos de la etapa.
  columnas.forEach((c, idx) => {
    const mesClave = Number(c.etapa.slice(2));
    if (mesClave >= 1 && mesClave <= 12) {
      const leido = mesExamenPorColumna.get(idx);
      if (leido !== mesClave) {
        if (leido) advertencias.push(`En ${c.clave} el mes del encabezado (${leido}) no coincide con la clave (${mesClave}); se usó la clave.`);
        mesExamenPorColumna.set(idx, mesClave);
      }
    }
  });

  // ── Horarios por módulo ───────────────────────────────────────────────────
  const RE_HORA = /^\d{1,2}:\d{2}$/;
  const horariosPorColumna = new Map<number, HorarioLeido[]>();
  for (const fila of filas) {
    // Una fila de módulo empieza con su número, pegado al margen izquierdo.
    const numItem = fila.find((i) => /^\d{1,2}$/.test(i.t) && i.x < 80);
    const horas = fila.filter((i) => RE_HORA.test(i.t));
    if (!numItem || horas.length === 0) continue;
    const moduloNumero = Number(numItem.t);
    if (moduloNumero < 1 || moduloNumero > 99) continue;

    for (const h of horas) {
      // Se elige el ancla de día (sáb/dom) más cercana: eso define columna Y día.
      let mejor = anclasDia[0];
      let dist = Infinity;
      for (const a of anclasDia) {
        const d = Math.abs(a.x - h.x);
        if (d < dist) { dist = d; mejor = a; }
      }
      if (!mejor || dist > 30) continue;
      const lista = horariosPorColumna.get(mejor.col) ?? [];
      // Un módulo solo puede tener un horario por etapa: si se repite, gana el
      // primero y se avisa (sería señal de que la lectura se desalineó).
      if (lista.some((x) => x.moduloNumero === moduloNumero)) {
        advertencias.push(`El módulo ${moduloNumero} aparece dos veces en ${columnas[mejor.col]?.clave ?? '?'}; se conservó el primero.`);
        continue;
      }
      lista.push({ moduloNumero, dia: mejor.dia, hora: h.t });
      horariosPorColumna.set(mejor.col, lista);
    }
  }

  // ── Armado final ──────────────────────────────────────────────────────────
  const etapas: EtapaLeida[] = [];
  columnas.forEach((c, idx) => {
    const sol = solicitudPorColumna.get(idx);
    const dias = anclasDia.filter((a) => a.col === idx);
    const sab = dias.find((d) => d.dia === 'sabado');
    const dom = dias.find((d) => d.dia === 'domingo');
    const mesEx = mesExamenPorColumna.get(idx);

    if (!sol || !sab || !dom || !mesEx) {
      advertencias.push(`La etapa ${c.clave} quedó incompleta en el documento y se omitió.`);
      return;
    }

    // La solicitud puede caer en el año anterior si el examen es de enero.
    const anioSolicitud = sol.mes > mesEx ? anio - 1 : anio;

    etapas.push({
      clave: c.clave,
      etapa: c.etapa,
      fase: c.fase,
      anio,
      solicitudInicio: fecha(anioSolicitud, sol.mes, sol.d1),
      solicitudFin: fecha(anioSolicitud, sol.mes, sol.d2),
      examenSabado: fecha(anio, mesEx, sab.num),
      examenDomingo: fecha(anio, mesEx, dom.num),
      horarios: (horariosPorColumna.get(idx) ?? []).sort((a, b) => a.moduloNumero - b.moduloNumero),
    });
  });

  if (etapas.length === 0) throw new Error('No se pudo leer ninguna etapa completa del documento.');

  // Aviso útil: si una etapa trae muchos menos módulos que el resto, la lectura
  // probablemente se desalineó en esa columna.
  const maxModulos = Math.max(...etapas.map((e) => e.horarios.length));
  for (const e of etapas) {
    if (maxModulos > 0 && e.horarios.length < maxModulos) {
      advertencias.push(`${e.clave} trae ${e.horarios.length} horarios y otras etapas traen ${maxModulos}. Revísala antes de crear.`);
    }
  }

  return { anio, etapas, advertencias };
}
