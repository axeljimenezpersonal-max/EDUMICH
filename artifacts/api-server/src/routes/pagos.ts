/**
 * Rutas de pagos — accesibles por alumno (propio), gestor (su municipio), admin.
 * GET  /pagos/estudiantes/:estudianteId        → lista + resumen
 * POST /pagos/estudiantes/:estudianteId        → subir comprobante
 * GET  /pagos/:pagoId/comprobante              → servir PDF del comprobante
 */

import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import multer from 'multer';
import path from 'path';
import fsp from 'node:fs/promises';
import { createReadStream, existsSync } from 'fs';
import { z } from 'zod';
import { db } from '../db';
import {
  pagos,
  estudiantes,
  auditLog,
  users,
} from '@workspace/db/schema';
import { authRequired } from '../middleware/auth';
import { tryAuditLog } from '../utils/audit';

const router = Router();
router.use(authRequired);

const PAGOS_DIR = process.env.STORAGE_DIR
  ? path.join(process.env.STORAGE_DIR, 'pagos')
  : '/tmp/prepa-storage/pagos';

const uploadPago = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      await fsp.mkdir(PAGOS_DIR, { recursive: true });
      cb(null, PAGOS_DIR);
    },
    filename: (_req, file, cb) => {
      const ts = Date.now();
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${ts}_${safe}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      cb(new Error('Solo se aceptan archivos PDF'));
      return;
    }
    cb(null, true);
  },
});

// ── Auth helper ───────────────────────────────────────────────────────────
async function canAccessStudent(
  requestUser: { userId: number; rol: string },
  estudianteId: number
): Promise<boolean> {
  if (requestUser.rol === 'admin') return true;
  if (requestUser.rol === 'estudiante') return requestUser.userId === estudianteId;
  if (requestUser.rol === 'gestor') {
    const [est] = await db
      .select({ gestorId: estudiantes.gestorId })
      .from(estudiantes)
      .where(eq(estudiantes.userId, estudianteId));
    return !!est && est.gestorId === requestUser.userId;
  }
  return false;
}

// ── GET /pagos/estudiantes/:estudianteId ─────────────────────────────────
router.get('/estudiantes/:estudianteId', async (req, res) => {
  const estudianteId = Number(req.params.estudianteId);
  if (!estudianteId) { res.status(400).json({ error: 'ID inválido' }); return; }

  if (!(await canAccessStudent(req.user!, estudianteId))) {
    res.status(403).json({ error: 'Sin acceso' }); return;
  }

  const rows = await db
    .select({
      id: pagos.id,
      concepto: pagos.concepto,
      conceptoDetalle: pagos.conceptoDetalle,
      monto: pagos.monto,
      moneda: pagos.moneda,
      fechaPago: pagos.fechaPago,
      metodoPago: pagos.metodoPago,
      referenciaBancaria: pagos.referenciaBancaria,
      notas: pagos.notas,
      nombreComprobante: pagos.nombreComprobante,
      tamanoBytes: pagos.tamanoBytes,
      estado: pagos.estado,
      motivoRechazo: pagos.motivoRechazo,
      subidoPorUserId: pagos.subidoPorUserId,
      verificadoEn: pagos.verificadoEn,
      createdAt: pagos.createdAt,
    })
    .from(pagos)
    .where(eq(pagos.estudianteId, estudianteId))
    .orderBy(desc(pagos.fechaPago));

  // Subido por nombre
  const pagosConNombre = await Promise.all(
    rows.map(async (p) => {
      const [u] = await db
        .select({ nombreCompleto: users.email }) // use email as fallback name source
        .from(users)
        .where(eq(users.id, p.subidoPorUserId));
      return { ...p, subidoPorEmail: u?.nombreCompleto ?? null };
    })
  );

  const totalPagado = rows
    .filter((p) => p.estado === 'verificado')
    .reduce((sum, p) => sum + parseFloat(p.monto as unknown as string), 0);
  const verificados = rows.filter((p) => p.estado === 'verificado').length;
  const pendientes = rows.filter((p) => p.estado === 'pendiente').length;
  const rechazados = rows.filter((p) => p.estado === 'rechazado').length;

  res.json({
    pagos: pagosConNombre,
    resumen: { totalPagado, verificados, pendientes, rechazados },
  });
});

// ── POST /pagos/estudiantes/:estudianteId ────────────────────────────────
const subirPagoSchema = z.object({
  concepto: z.enum([
    'derecho_examen',
    'examen_extraordinario',
    'reposicion_credencial',
    'duplicado_acta',
    'otro',
  ]),
  conceptoDetalle: z.string().max(200).optional(),
  monto: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Monto inválido'),
  fechaPago: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  metodoPago: z.enum([
    'spei',
    'banco_deposito',
    'tienda_conveniencia',
    'efectivo',
    'otro',
  ]),
  referenciaBancaria: z.string().max(100).optional(),
  notas: z.string().optional(),
});

router.post(
  '/estudiantes/:estudianteId',
  uploadPago.single('comprobante'),
  async (req, res) => {
    const estudianteId = Number(req.params.estudianteId);
    const file = req.file;

    if (!file) { res.status(400).json({ error: 'Comprobante PDF requerido' }); return; }
    if (!estudianteId) {
      await fsp.unlink(file.path).catch(() => {});
      res.status(400).json({ error: 'ID inválido' }); return;
    }

    if (!(await canAccessStudent(req.user!, estudianteId))) {
      await fsp.unlink(file.path).catch(() => {});
      res.status(403).json({ error: 'Sin acceso' }); return;
    }

    const parse = subirPagoSchema.safeParse(req.body);
    if (!parse.success) {
      await fsp.unlink(file.path).catch(() => {});
      res.status(400).json({ error: 'Datos inválidos', detalles: parse.error.issues });
      return;
    }
    const data = parse.data;

    const [pago] = await db
      .insert(pagos)
      .values({
        estudianteId,
        concepto: data.concepto,
        conceptoDetalle: data.conceptoDetalle ?? null,
        monto: data.monto,
        fechaPago: data.fechaPago,
        metodoPago: data.metodoPago,
        referenciaBancaria: data.referenciaBancaria ?? null,
        notas: data.notas ?? null,
        rutaComprobante: file.path,
        nombreComprobante: file.originalname,
        tamanoBytes: file.size,
        estado: 'pendiente',
        subidoPorUserId: req.user!.userId,
      })
      .returning();

    await tryAuditLog({
      userId: req.user!.userId,
      accion: 'subir_pago',
      entidad: 'pagos',
      entidadId: pago.id,
      detalle: `Subió comprobante de pago: ${data.concepto} $${data.monto}`,
      metadata: { estudianteId, concepto: data.concepto, monto: data.monto },
      req,
    });

    res.status(201).json({ ok: true, pago });
  }
);

// ── GET /pagos/:pagoId/comprobante ────────────────────────────────────────
router.get('/:pagoId/comprobante', async (req, res) => {
  const pagoId = Number(req.params.pagoId);
  if (!pagoId) { res.status(400).json({ error: 'ID inválido' }); return; }

  const [pago] = await db
    .select()
    .from(pagos)
    .where(eq(pagos.id, pagoId));

  if (!pago) { res.status(404).json({ error: 'Pago no encontrado' }); return; }

  if (!(await canAccessStudent(req.user!, pago.estudianteId))) {
    res.status(403).json({ error: 'Sin acceso' }); return;
  }

  if (!existsSync(pago.rutaComprobante)) {
    res.status(404).json({ error: 'Archivo no disponible' }); return;
  }

  const safe = (pago.nombreComprobante ?? 'comprobante.pdf')
    .replace(/[^a-zA-Z0-9_\-. ]/g, '').trim() || 'comprobante.pdf';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${safe}"`);
  createReadStream(pago.rutaComprobante).pipe(res);
});

export default router;
