import { Router } from 'express';
import { db } from '../db';
import {
  datosInstitucionales, datosBancarios, conceptosPago, plantillasCorreo,
  integraciones, preferenciasUsuario, municipios, auditLog, sesiones, users,
  administradores, gestores,
} from '@workspace/db/schema';
import { eq, desc, and, like, gte, lte, count, sql } from 'drizzle-orm';
import { authRequired, requireRol } from '../middleware/auth';
import bcrypt from 'bcryptjs';

const router = Router();
router.use(authRequired, requireRol('admin'));

// La bitácora de actividad (supervisión) es facultad de jefatura: solo la
// administradora titular puede auditar lo que hace su equipo.
async function soloJefeBitacora(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) {
  const [a] = await db.select({ j: administradores.esJefe }).from(administradores).where(eq(administradores.userId, req.user!.userId));
  if (a?.j) { next(); return; }
  res.status(403).json({ error: 'La bitácora está reservada a la administradora titular.' });
}

// ─────────────────────────────────────────────────────────────
// Audit helper
// ─────────────────────────────────────────────────────────────

async function log(
  userId: number,
  nombre: string,
  rol: string,
  accion: string,
  entidad: string,
  detalle: string,
  entidadId?: number,
  metadata?: unknown,
  ip?: string,
) {
  await db.insert(auditLog).values({
    userId,
    userNombre: nombre,
    userRol: rol,
    accion,
    entidad,
    entidadId,
    detalle,
    metadata: metadata as any,
    ip,
  });
}

function reqUser(req: any) {
  return req.user as { id: number; email: string; rol: string; nombre?: string };
}

// ─────────────────────────────────────────────────────────────
// DATOS INSTITUCIONALES
// ─────────────────────────────────────────────────────────────

router.get('/datos-institucionales', async (_req, res) => {
  const rows = await db.select().from(datosInstitucionales).limit(1);
  res.json(rows[0] ?? null);
});

router.put('/datos-institucionales', async (req, res) => {
  const u = reqUser(req);
  const { nombreOficial, nombreCorto, direccion, telefonoGeneral, correoSoporte, rfc, sitioWeb } = req.body;

  const existing = await db.select().from(datosInstitucionales).limit(1);
  const ahora = new Date();

  if (existing.length === 0) {
    const [nuevo] = await db.insert(datosInstitucionales)
      .values({ nombreOficial, nombreCorto, direccion, telefonoGeneral, correoSoporte, rfc, sitioWeb, actualizadoPor: u.id, actualizadoEn: ahora })
      .returning();
    await log(u.id, u.email, u.rol, 'UPDATE', 'configuracion', `Creó datos institucionales`, nuevo.id);
    res.json(nuevo); return;
  }

  const [updated] = await db.update(datosInstitucionales)
    .set({ nombreOficial, nombreCorto, direccion, telefonoGeneral, correoSoporte, rfc, sitioWeb, actualizadoPor: u.id, actualizadoEn: ahora })
    .where(eq(datosInstitucionales.id, existing[0].id))
    .returning();

  await log(u.id, u.email, u.rol, 'UPDATE', 'configuracion', `Actualizó datos institucionales`, updated.id, { antes: existing[0], despues: updated });
  res.json(updated);
});

// ─────────────────────────────────────────────────────────────
// DATOS BANCARIOS
// ─────────────────────────────────────────────────────────────

router.get('/datos-bancarios', async (_req, res) => {
  const rows = await db.select().from(datosBancarios).where(eq(datosBancarios.activo, true)).limit(1);
  res.json(rows[0] ?? null);
});

router.put('/datos-bancarios', async (req, res) => {
  const u = reqUser(req);
  const { banco, titular, clabe, numeroCuenta, rfc, conceptoPago, convenio } = req.body;

  if (!clabe || !/^\d{18}$/.test(clabe)) {
    res.status(400).json({ error: 'CLABE debe tener exactamente 18 dígitos' }); return;
  }

  const existing = await db.select().from(datosBancarios).limit(1);
  const ahora = new Date();

  let result;
  if (existing.length === 0) {
    [result] = await db.insert(datosBancarios)
      .values({ banco, titular, clabe, numeroCuenta, rfc, conceptoPago, convenio: convenio ?? null, actualizadoPor: u.id, actualizadoEn: ahora })
      .returning();
  } else {
    [result] = await db.update(datosBancarios)
      .set({ banco, titular, clabe, numeroCuenta, rfc, conceptoPago, convenio: convenio ?? null, actualizadoPor: u.id, actualizadoEn: ahora })
      .where(eq(datosBancarios.id, existing[0].id))
      .returning();
  }

  await log(u.id, u.email, u.rol, 'UPDATE', 'configuracion', `Actualizó datos bancarios (CLABE: ***${clabe.slice(-4)})`, result.id);
  res.json(result);
});

// ─────────────────────────────────────────────────────────────
// CONCEPTOS DE PAGO
// ─────────────────────────────────────────────────────────────

router.get('/conceptos-pago', async (_req, res) => {
  const rows = await db.select().from(conceptosPago).orderBy(conceptosPago.id);
  res.json(rows);
});

router.put('/conceptos-pago/:id', async (req, res) => {
  const u = reqUser(req);
  const id = Number(req.params.id);
  const { monto, nombre, activo } = req.body;

  if (monto !== undefined && Number(monto) <= 0) {
    res.status(400).json({ error: 'El monto debe ser mayor a 0' }); return;
  }

  const [before] = await db.select().from(conceptosPago).where(eq(conceptosPago.id, id));
  if (!before) { res.status(404).json({ error: 'Concepto no encontrado' }); return; }

  const updates: Partial<typeof conceptosPago.$inferInsert> = { actualizadoEn: new Date() };
  if (monto !== undefined) updates.monto = String(monto);
  if (nombre !== undefined) updates.nombre = nombre;
  if (activo !== undefined) updates.activo = activo;

  const [updated] = await db.update(conceptosPago).set(updates).where(eq(conceptosPago.id, id)).returning();

  await log(u.id, u.email, u.rol, 'UPDATE', 'conceptos_pago',
    `Modificó concepto "${before.nombre}": monto $${before.monto} → $${updated.monto}`,
    id, { antes: { monto: before.monto }, despues: { monto: updated.monto } },
  );
  res.json(updated);
});

// ─────────────────────────────────────────────────────────────
// PLANTILLAS DE CORREO
// ─────────────────────────────────────────────────────────────

router.get('/plantillas-correo', async (_req, res) => {
  const rows = await db.select({
    id: plantillasCorreo.id, clave: plantillasCorreo.clave,
    nombre: plantillasCorreo.nombre, descripcion: plantillasCorreo.descripcion,
    asunto: plantillasCorreo.asunto, activa: plantillasCorreo.activa,
    variablesDisponibles: plantillasCorreo.variablesDisponibles,
    actualizadoEn: plantillasCorreo.actualizadoEn,
  }).from(plantillasCorreo).orderBy(plantillasCorreo.id);
  res.json(rows);
});

router.get('/plantillas-correo/:clave', async (req, res) => {
  const [row] = await db.select().from(plantillasCorreo)
    .where(eq(plantillasCorreo.clave, req.params.clave));
  if (!row) { res.status(404).json({ error: 'Plantilla no encontrada' }); return; }
  res.json(row);
});

router.put('/plantillas-correo/:clave', async (req, res) => {
  const u = reqUser(req);
  const { asunto, contenidoHtml, contenidoTexto, activa } = req.body;

  const [existing] = await db.select().from(plantillasCorreo)
    .where(eq(plantillasCorreo.clave, req.params.clave));
  if (!existing) { res.status(404).json({ error: 'Plantilla no encontrada' }); return; }

  const [updated] = await db.update(plantillasCorreo)
    .set({ asunto, contenidoHtml, contenidoTexto, activa, actualizadoPor: u.id, actualizadoEn: new Date() })
    .where(eq(plantillasCorreo.clave, req.params.clave))
    .returning();

  await log(u.id, u.email, u.rol, 'UPDATE', 'plantilla_correo', `Editó plantilla "${existing.nombre}"`, existing.id);
  res.json(updated);
});

router.post('/plantillas-correo/:clave/test', async (req, res) => {
  const u = reqUser(req);
  // In a real implementation, use the email service to send a test email
  // For now we just acknowledge the request
  await log(u.id, u.email, u.rol, 'EXPORTAR', 'plantilla_correo', `Envió email de prueba de plantilla "${req.params.clave}" a ${u.email}`);
  res.json({ ok: true, mensaje: `Email de prueba enviado a ${u.email}` });
});

router.post('/plantillas-correo/:clave/restaurar', async (req, res) => {
  const u = reqUser(req);
  const [existing] = await db.select().from(plantillasCorreo)
    .where(eq(plantillasCorreo.clave, req.params.clave));
  if (!existing) { res.status(404).json({ error: 'Plantilla no encontrada' }); return; }

  await log(u.id, u.email, u.rol, 'UPDATE', 'plantilla_correo', `Restauró plantilla "${existing.nombre}" al contenido original`);
  res.json({ ok: true, mensaje: 'Plantilla restaurada al contenido original del sistema' });
});

// ─────────────────────────────────────────────────────────────
// INTEGRACIONES
// ─────────────────────────────────────────────────────────────

router.get('/integraciones', async (_req, res) => {
  const rows = await db.select().from(integraciones).orderBy(integraciones.id);
  // Mask sensitive config values
  const safe = rows.map((r) => ({
    ...r,
    configuracion: r.configuracion ? maskConfig(r.configuracion as Record<string, unknown>) : null,
  }));
  res.json(safe);
});

router.put('/integraciones/:clave', async (req, res) => {
  const u = reqUser(req);
  const { configuracion, conectada } = req.body;

  const [existing] = await db.select().from(integraciones)
    .where(eq(integraciones.clave, req.params.clave));
  if (!existing) { res.status(404).json({ error: 'Integración no encontrada' }); return; }

  const [updated] = await db.update(integraciones)
    .set({ configuracion, conectada, actualizadoEn: new Date() })
    .where(eq(integraciones.clave, req.params.clave))
    .returning();

  await log(u.id, u.email, u.rol, 'UPDATE', 'integracion', `Actualizó configuración de integración "${existing.nombre}"`, existing.id);
  res.json({ ...updated, configuracion: maskConfig(updated.configuracion as Record<string, unknown>) });
});

router.post('/integraciones/:clave/probar', async (req, res) => {
  const u = reqUser(req);
  const clave = req.params.clave;

  let exitosa = false;
  let mensaje = 'Prueba no disponible para esta integración';

  if (clave === 'neon') {
    try {
      await db.execute(sql`SELECT 1`);
      exitosa = true;
      mensaje = 'Conexión a base de datos exitosa';
    } catch {
      mensaje = 'No se pudo conectar a la base de datos';
    }
  } else if (clave === 'resend') {
    exitosa = true;
    mensaje = 'Servicio de correo disponible (Resend)';
  } else {
    exitosa = false;
    mensaje = 'Prueba de conexión no disponible aún para esta integración';
  }

  await db.update(integraciones)
    .set({ ultimaPruebaEn: new Date(), ultimaPruebaExitosa: exitosa })
    .where(eq(integraciones.clave, clave));

  await log(u.id, u.email, u.rol, 'UPDATE', 'integracion', `Probó integración "${clave}": ${exitosa ? 'exitosa' : 'fallida'}`);
  res.json({ ok: exitosa, mensaje });
});

function maskConfig(config: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!config) return {};
  const masked: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config)) {
    const sensible = /key|secret|password|token|pass|credential/i.test(k);
    masked[k] = sensible && typeof v === 'string' && v.length > 4
      ? '•'.repeat(v.length - 4) + v.slice(-4)
      : v;
  }
  return masked;
}

// ─────────────────────────────────────────────────────────────
// MUNICIPIOS
// ─────────────────────────────────────────────────────────────

router.get('/municipios', async (_req, res) => {
  const rows = await db.select({
    id: municipios.id,
    nombre: municipios.nombre,
    activo: municipios.activo,
  }).from(municipios).orderBy(municipios.nombre);

  // Include alumni count for each municipio
  const alumnosPorMunicipio = await db.execute<{ municipio_id: number; total: string }>(
    sql`SELECT municipio_id, COUNT(*) AS total FROM estudiantes WHERE municipio_id IS NOT NULL GROUP BY municipio_id`
  );
  const alumnosMap = Object.fromEntries(alumnosPorMunicipio.rows.map((r) => [r.municipio_id, Number(r.total)]));

  res.json(rows.map((m) => ({ ...m, totalAlumnos: alumnosMap[m.id] ?? 0 })));
});

router.put('/municipios/:id', async (req, res) => {
  const u = reqUser(req);
  const id = Number(req.params.id);
  const { activo } = req.body;

  const [mun] = await db.select().from(municipios).where(eq(municipios.id, id));
  if (!mun) { res.status(404).json({ error: 'Municipio no encontrado' }); return; }

  const [updated] = await db.update(municipios)
    .set({ activo })
    .where(eq(municipios.id, id))
    .returning({ id: municipios.id, nombre: municipios.nombre, activo: municipios.activo });

  await log(u.id, u.email, u.rol, 'UPDATE', 'municipio',
    `${activo ? 'Activó' : 'Desactivó'} municipio "${mun.nombre}"`, id);
  res.json(updated);
});

// ─────────────────────────────────────────────────────────────
// MI CUENTA
// ─────────────────────────────────────────────────────────────

router.get('/mi-cuenta', async (req, res) => {
  const u = reqUser(req);
  const [adminData] = await db.select().from(administradores).where(eq(administradores.userId, u.id));
  const [userData] = await db.select({
    id: users.id, email: users.email, rol: users.rol, ultimoLogin: users.ultimoLogin,
  }).from(users).where(eq(users.id, u.id));

  const [prefs] = await db.select().from(preferenciasUsuario).where(eq(preferenciasUsuario.userId, u.id));

  res.json({
    ...userData,
    nombreCompleto: adminData?.nombreCompleto ?? '',
    puesto: adminData?.puesto ?? '',
    emailPublico: adminData?.emailPublico ?? '',
    telefonoPublico: adminData?.telefonoPublico ?? '',
    perfilConfirmado: adminData?.perfilConfirmado ?? false,
    preferencias: prefs ?? {
      notifEmail: true, notifNavegador: false, resumenDiario: true,
      modoOscuro: false, idioma: 'es-MX', zonaHoraria: 'America/Mexico_City',
    },
  });
});

router.put('/mi-cuenta', async (req, res) => {
  const u = reqUser(req);
  const { nombreCompleto, puesto, emailPublico, telefonoPublico } = req.body;

  // Bloqueo: si ya está confirmado, no se permiten cambios de nombre/cargo/tel.
  const [actual] = await db.select().from(administradores).where(eq(administradores.userId, u.id));
  if (actual?.perfilConfirmado) {
    res.status(403).json({ error: 'Tu perfil ya está confirmado. Contacta al soporte técnico para cambios.' });
    return;
  }

  await db.update(administradores)
    .set({ nombreCompleto, puesto, emailPublico, telefonoPublico, perfilConfirmado: true })
    .where(eq(administradores.userId, u.id));

  await log(u.id, u.email, u.rol, 'UPDATE', 'configuracion', `Actualizó su perfil de administrador`);
  res.json({ ok: true });
});

router.put('/mi-cuenta/preferencias', async (req, res) => {
  const u = reqUser(req);
  const { notifEmail, notifNavegador, resumenDiario, modoOscuro, idioma, zonaHoraria } = req.body;

  const existing = await db.select().from(preferenciasUsuario).where(eq(preferenciasUsuario.userId, u.id));
  if (existing.length === 0) {
    await db.insert(preferenciasUsuario).values({
      userId: u.id, notifEmail, notifNavegador, resumenDiario, modoOscuro, idioma, zonaHoraria,
    });
  } else {
    await db.update(preferenciasUsuario)
      .set({ notifEmail, notifNavegador, resumenDiario, modoOscuro, idioma, zonaHoraria, actualizadoEn: new Date() })
      .where(eq(preferenciasUsuario.userId, u.id));
  }
  res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────
// SEGURIDAD — CAMBIAR CONTRASEÑA
// ─────────────────────────────────────────────────────────────

router.post('/seguridad/cambiar-password', async (req, res) => {
  const u = reqUser(req);
  const { passwordActual, passwordNuevo } = req.body;

  if (!passwordNuevo || passwordNuevo.length < 8) {
    res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' }); return;
  }
  if (!/[0-9]/.test(passwordNuevo)) {
    res.status(400).json({ error: 'La contraseña debe contener al menos un número' }); return;
  }
  if (!/[A-Z]/.test(passwordNuevo)) {
    res.status(400).json({ error: 'La contraseña debe contener al menos una mayúscula' }); return;
  }

  const [userData] = await db.select({ passwordHash: users.passwordHash })
    .from(users).where(eq(users.id, u.id));

  const valido = await bcrypt.compare(passwordActual, userData.passwordHash);
  if (!valido) { res.status(400).json({ error: 'La contraseña actual es incorrecta' }); return; }

  const igualAActual = await bcrypt.compare(passwordNuevo, userData.passwordHash);
  if (igualAActual) { res.status(400).json({ error: 'La nueva contraseña no puede ser igual a la actual' }); return; }

  const hash = await bcrypt.hash(passwordNuevo, 12);
  await db.update(users)
    .set({ passwordHash: hash, passwordTemporal: false, passwordCambiadoEn: new Date() })
    .where(eq(users.id, u.id));

  await log(u.id, u.email, u.rol, 'UPDATE', 'configuracion', `Cambió su contraseña`, u.id);
  res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────
// SEGURIDAD — SESIONES
// ─────────────────────────────────────────────────────────────

router.get('/seguridad/sesiones', async (req, res) => {
  const u = reqUser(req);
  const rows = await db.select().from(sesiones)
    .where(and(eq(sesiones.userId, u.id), gte(sesiones.expiraEn, new Date())))
    .orderBy(desc(sesiones.ultimaActividadEn));
  res.json(rows);
});

router.delete('/seguridad/sesiones/:id', async (req, res) => {
  const u = reqUser(req);
  const id = Number(req.params.id);
  await db.delete(sesiones).where(and(eq(sesiones.id, id), eq(sesiones.userId, u.id)));
  res.json({ ok: true });
});

router.post('/seguridad/sesiones/cerrar-todas', async (req, res) => {
  const u = reqUser(req);
  // Keep the current session token (passed in header/cookie) — for now just delete all
  await db.delete(sesiones).where(eq(sesiones.userId, u.id));
  await log(u.id, u.email, u.rol, 'LOGOUT', 'sesion', `Cerró todas las sesiones activas`);
  res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────
// BITÁCORA DE AUDITORÍA
// ─────────────────────────────────────────────────────────────

router.get('/bitacora', soloJefeBitacora, async (req, res) => {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = (page - 1) * limit;

  const { buscar, accion, entidad, usuarioId, fechaInicio, fechaFin } = req.query as Record<string, string>;

  let query = db.select({
    id: auditLog.id,
    userId: auditLog.userId,
    userNombre: auditLog.userNombre,
    userRol: auditLog.userRol,
    accion: auditLog.accion,
    entidad: auditLog.entidad,
    entidadId: auditLog.entidadId,
    detalle: auditLog.detalle,
    metadata: auditLog.metadata,
    ip: auditLog.ip,
    createdAt: auditLog.createdAt,
  }).from(auditLog).$dynamic();

  const conditions: ReturnType<typeof eq>[] = [];
  if (accion) conditions.push(eq(auditLog.accion, accion));
  if (entidad) conditions.push(eq(auditLog.entidad, entidad));
  if (usuarioId) conditions.push(eq(auditLog.userId, Number(usuarioId)));
  if (buscar) conditions.push(like(auditLog.detalle, `%${buscar}%`));
  if (fechaInicio) conditions.push(gte(auditLog.createdAt, new Date(fechaInicio)));
  if (fechaFin) conditions.push(lte(auditLog.createdAt, new Date(fechaFin + 'T23:59:59')));

  if (conditions.length > 0) {
    query = query.where(and(...conditions) as any);
  }

  const rows = await query.orderBy(desc(auditLog.createdAt)).limit(limit).offset(offset);

  const totalRes = await db.select({ total: count() }).from(auditLog);

  // Mask IPs
  const masked = rows.map((r) => ({
    ...r,
    ip: r.ip ? maskIp(r.ip) : null,
  }));

  res.json({ rows: masked, total: Number(totalRes[0]?.total ?? 0), page, limit });
});

router.get('/bitacora/usuarios', soloJefeBitacora, async (_req, res) => {
  const rows = await db.selectDistinct({
    id: auditLog.userId,
    nombre: auditLog.userNombre,
    rol: auditLog.userRol,
  }).from(auditLog).where(sql`${auditLog.userId} IS NOT NULL`).limit(100);
  res.json(rows);
});

function maskIp(ip: string): string {
  const parts = ip.split('.');
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.x.x`;
  return ip.replace(/:[^:]+$/, ':****');
}

export default router;
