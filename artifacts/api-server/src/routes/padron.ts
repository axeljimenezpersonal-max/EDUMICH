/**
 * Padrón histórico — alumnos que YA existen en la base del Estado (antes del
 * portal). Se importa desde un Excel y sirve para que, al dar de alta, si la
 * CURP ya está aquí, se marque "este alumno ya existe" y se precargue su info.
 *
 *  - POST /padron-historico/importar  (admin, direccion)  → sube y carga el Excel.
 *  - GET  /padron-historico            (admin, direccion)  → busca/lista el padrón.
 *  - GET  /padron-historico/resumen    (admin, direccion)  → total cargado.
 *  - GET  /padron-historico/por-curp   (gestor, admin, direccion) → match por CURP.
 *
 * El padrón completo solo lo ven administración (Secretaría) y dirección
 * (Sinapsis). El gestor únicamente recibe la señal "ya existe" al capturar una
 * CURP que coincide. Los datos NUNCA viven en el repositorio: se cargan aquí.
 */
import { Router } from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { eq, or, ilike, sql, asc } from 'drizzle-orm';
import { db } from '../db';
import { padronHistorico } from '@workspace/db/schema';
import { authRequired, requireRol } from '../middleware/auth';
import { tryAuditLog } from '../utils/audit';

const router = Router();
router.use(authRequired);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const norm = (v: unknown): string | null => {
  if (v == null) return null;
  // exceljs puede devolver objetos (rich text, hyperlink, fórmula): tomar el texto.
  const s = typeof v === 'object' && v !== null && 'text' in v ? String((v as { text: unknown }).text) : String(v);
  const t = s.trim();
  return t === '' ? null : t;
};
const aFecha = (v: unknown): string | null => {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = norm(v);
  return s ? s.slice(0, 10) : null;
};

interface FilaPadron {
  matricula: string;
  curp: string | null;
  primerApellido: string | null;
  segundoApellido: string | null;
  nombre: string | null;
  sexo: string | null;
  fechaNacimiento: string | null;
  fechaAlta: string | null;
}

// ─── POST /padron-historico/importar ────────────────────────────────────────
router.post('/importar', requireRol('admin', 'direccion'), upload.single('archivo'), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: 'No se recibió el archivo' }); return; }
  let ws: ExcelJS.Worksheet | undefined;
  try {
    const wb = new ExcelJS.Workbook();
    // Cast por desajuste nominal de tipos Buffer entre @types/node y exceljs.
    await wb.xlsx.load(req.file.buffer as never);
    ws = wb.worksheets[0];
  } catch {
    res.status(400).json({ error: 'No se pudo leer el Excel. ¿Es un .xlsx válido?' }); return;
  }
  if (!ws) { res.status(400).json({ error: 'El archivo no tiene hojas' }); return; }

  // Mapear columnas por su encabezado (fila 1), tolerante a mayúsculas/espacios.
  const idx: Record<string, number> = {};
  ws.getRow(1).eachCell((cell, col) => {
    const h = String(cell.value ?? '').trim().toLowerCase().replace(/\s+/g, '_');
    if (h) idx[h] = col;
  });
  const col = (...names: string[]) => { for (const n of names) if (idx[n]) return idx[n]; return null; };
  const cMat = col('matricula', 'matrícula');
  const cCurp = col('curp');
  const cPA = col('primer_apellido', 'primerapellido');
  const cSA = col('segundo_apellido', 'segundoapellido');
  const cNom = col('nombre', 'nombres');
  const cSexo = col('sexo');
  const cFN = col('fecha_nacimiento', 'fechanacimiento');
  const cFA = col('fecha_alta', 'fechaalta');
  if (!cMat) { res.status(400).json({ error: 'No encuentro la columna "Matricula" en la primera fila.' }); return; }

  const filas: FilaPadron[] = [];
  let sinMatricula = 0;
  const total = ws.rowCount;
  for (let r = 2; r <= total; r++) {
    const row = ws.getRow(r);
    const matricula = norm(row.getCell(cMat).value);
    if (!matricula) { sinMatricula++; continue; }
    filas.push({
      matricula,
      curp: cCurp ? (norm(row.getCell(cCurp).value)?.toUpperCase() ?? null) : null,
      primerApellido: cPA ? norm(row.getCell(cPA).value) : null,
      segundoApellido: cSA ? norm(row.getCell(cSA).value) : null,
      nombre: cNom ? norm(row.getCell(cNom).value) : null,
      sexo: cSexo ? (norm(row.getCell(cSexo).value)?.slice(0, 1).toUpperCase() ?? null) : null,
      fechaNacimiento: cFN ? aFecha(row.getCell(cFN).value) : null,
      fechaAlta: cFA ? aFecha(row.getCell(cFA).value) : null,
    });
  }
  if (filas.length === 0) { res.status(400).json({ error: 'No se encontraron filas con matrícula.' }); return; }

  // Upsert por matrícula, en lotes (idempotente: re-subir actualiza, no duplica).
  let procesados = 0;
  const LOTE = 500;
  for (let i = 0; i < filas.length; i += LOTE) {
    const lote = filas.slice(i, i + LOTE);
    await db.insert(padronHistorico).values(lote).onConflictDoUpdate({
      target: padronHistorico.matricula,
      set: {
        curp: sql`excluded.curp`,
        primerApellido: sql`excluded.primer_apellido`,
        segundoApellido: sql`excluded.segundo_apellido`,
        nombre: sql`excluded.nombre`,
        sexo: sql`excluded.sexo`,
        fechaNacimiento: sql`excluded.fecha_nacimiento`,
        fechaAlta: sql`excluded.fecha_alta`,
        updatedAt: sql`now()`,
      },
    });
    procesados += lote.length;
  }

  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(padronHistorico);
  await tryAuditLog({
    userId: req.user!.userId, accion: 'importar_padron_historico', entidad: 'padron_historico', entidadId: 0,
    detalle: `Importó ${procesados} registro(s) al padrón histórico (total ${Number(n)})`,
    metadata: { procesados, sinMatricula }, req,
  });
  res.json({ ok: true, procesados, sinMatricula, total: Number(n) });
});

// ─── GET /padron-historico/resumen ──────────────────────────────────────────
router.get('/resumen', requireRol('admin', 'direccion'), async (_req, res) => {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(padronHistorico);
  res.json({ total: Number(n) });
});

// Filtro de búsqueda reutilizado por el listado y por la exportación.
function filtroBusqueda(q: string) {
  if (!q) return undefined;
  const patron = `%${q}%`;
  return or(
    ilike(padronHistorico.curp, patron),
    ilike(padronHistorico.matricula, patron),
    ilike(padronHistorico.nombre, patron),
    ilike(padronHistorico.primerApellido, patron),
    ilike(padronHistorico.segundoApellido, patron),
  );
}

// ─── GET /padron-historico — búsqueda/listado paginado (Secretaría y dirección) ──
router.get('/', requireRol('admin', 'direccion'), async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  const porPagina = Math.min(Math.max(Number(req.query.porPagina) || 50, 10), 200);
  const pagina = Math.max(1, Number(req.query.pagina) || 1);
  const where = filtroBusqueda(q);
  const registros = await db.select().from(padronHistorico).where(where)
    .orderBy(asc(padronHistorico.primerApellido), asc(padronHistorico.segundoApellido))
    .limit(porPagina).offset((pagina - 1) * porPagina);
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(padronHistorico).where(where);
  const [{ g }] = await db.select({ g: sql<number>`count(*)::int` }).from(padronHistorico);
  res.json({ registros, total: Number(n), totalGeneral: Number(g), pagina, porPagina });
});

// ─── GET /padron-historico/exportar — descarga el padrón (filtrado) en Excel ──
router.get('/exportar', requireRol('admin', 'direccion'), async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  const rows = await db.select().from(padronHistorico).where(filtroBusqueda(q))
    .orderBy(asc(padronHistorico.primerApellido), asc(padronHistorico.segundoApellido));

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Padrón');
  ws.columns = [
    { header: 'Matricula', key: 'matricula', width: 18 },
    { header: 'CURP', key: 'curp', width: 20 },
    { header: 'Primer_Apellido', key: 'primerApellido', width: 20 },
    { header: 'Segundo_Apellido', key: 'segundoApellido', width: 20 },
    { header: 'Nombre', key: 'nombre', width: 26 },
    { header: 'Sexo', key: 'sexo', width: 8 },
    { header: 'Fecha_Nacimiento', key: 'fechaNacimiento', width: 16 },
    { header: 'Fecha_alta', key: 'fechaAlta', width: 16 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const r of rows) ws.addRow(r);

  await tryAuditLog({
    userId: req.user!.userId, accion: 'exportar_padron_historico', entidad: 'padron_historico', entidadId: 0,
    detalle: `Exportó ${rows.length} registro(s) del padrón histórico${q ? ` (búsqueda "${q}")` : ''}`, req,
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="padron-historico.xlsx"');
  await wb.xlsx.write(res);
  res.end();
});

// ─── GET /padron-historico/por-curp — match para "Nuevo alumno" ─────────────
// El gestor solo obtiene la señal "ya existe" + los datos de esa CURP; no puede
// listar ni navegar el padrón completo.
router.get('/por-curp', requireRol('gestor', 'admin', 'direccion'), async (req, res) => {
  const curp = String(req.query.curp ?? '').trim().toUpperCase();
  if (curp.length < 10) { res.json({ existe: false, registro: null }); return; }
  const [registro] = await db.select().from(padronHistorico).where(eq(padronHistorico.curp, curp)).limit(1);
  res.json({ existe: !!registro, registro: registro ?? null });
});

export default router;
