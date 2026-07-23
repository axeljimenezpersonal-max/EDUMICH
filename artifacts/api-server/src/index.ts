/**
 * API server principal — Preparatoria Abierta Michoacán
 *
 * Ubicación destino en Replit: artifacts/api-server/src/index.ts
 * (reemplaza el index.ts existente del template TEC)
 */

// DEBE ir antes de cualquier import de rutas: fija STORAGE_DIR desde el volumen
// persistente de Railway antes de que los módulos de rutas lean esa variable.
import './bootstrap-storage';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import authRoutes from './routes/auth';
import gestorRoutes from './routes/gestor';
import estudianteRoutes from './routes/estudiante';
import publicoRoutes from './routes/publico';
import adminRoutes from './routes/admin';
import direccionRoutes from './routes/direccion';
import pagosRoutes from './routes/pagos';
import pagosExamenRoutes, { vencerPagosExamen } from './routes/pagos-examen';
import { sincronizarEstadosEtapas } from './services/etapasEstado';
import calificacionesRoutes from './routes/calificaciones';
import anunciosRoutes from './routes/anuncios';
import notificacionesRoutes from './routes/notificaciones';
import tutorialesRoutes from './routes/tutoriales';
import sedesRoutes from './routes/sedes';
import reportesRoutes, { ejecutarReportesProgramados } from './routes/reportes';
import configuracionRoutes from './routes/configuracion';
import depuracionRoutes from './routes/depuracion';
import bancoRoutes from './routes/banco';
import firmaRoutes from './routes/firma';
import bloqueosRoutes from './routes/bloqueos';
import faqRoutes, { adminFaqRouter } from './routes/faq';
import padronRoutes from './routes/padron';
import chatRoutes, { adminChatRouter } from './routes/chat';
import aulaRoutes from './routes/aula';
import usoRoutes from './routes/uso';
import busquedaRoutes from './routes/busqueda';
import devRoutes from './routes/dev';
import verificacionRoutes from './routes/verificacion';
import cron from 'node-cron';
import { tomarInstantanea, rellenarHistorico } from './services/metricasDiarias';
import { pool } from '@workspace/db';
import { iniciarCronDepuracion } from './services/depuracion';
import { recordarCierreDeVentana } from './utils/recordarCierreVentana';
import { runStartupMigrations } from './db';
import { metricsMiddleware } from './middleware/metrics';
import { iniciarRevocacion } from './utils/revocacion';

const app = express();

// Detrás del proxy de Railway: necesario para que express-rate-limit y las
// cookies `secure` lean correctamente la IP/protocolo del cliente.
app.set('trust proxy', 1);

// Cabeceras de seguridad (nosniff, frameguard, HSTS, etc.).
// CSP se deja desactivada por ahora para no romper el SPA + Google Fonts;
// debe afinarse y activarse en una iteración dedicada.
app.use(helmet({ contentSecurityPolicy: false }));

// CORS restringido por allowlist (antes reflejaba CUALQUIER origen con credenciales).
// Configurable con ALLOWED_ORIGINS="https://a.gob.mx,https://b.gob.mx".
const ALLOWED_ORIGINS = [
  ...(process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
    : ['https://edumich.up.railway.app']),
  ...(process.env.NODE_ENV !== 'production'
    ? ['http://localhost:5173', 'http://localhost:3001']
    : []),
];
app.use(
  cors({
    origin: (origin, cb) => {
      // Permite peticiones sin Origin (same-origin, curl, apps nativas, health checks).
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error('CORS: origen no permitido'));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// Métricas de salud del API (latencia/tráfico/errores) — consumidas por el
// panel de dirección. En memoria, costo despreciable por request.
app.use(metricsMiddleware);

// Rate limiting para frenar fuerza bruta y abuso en autenticación.
// max por ventana e IP; ajustable si hay oficinas tras NAT compartido.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Intenta de nuevo en unos minutos.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/recuperar-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);

// Healthcheck
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'prepa-michoacan-api', ts: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/gestor', gestorRoutes);
app.use('/api/estudiante', estudianteRoutes);
app.use('/api/alumno', estudianteRoutes);
app.use('/api/publico', publicoRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/direccion', direccionRoutes);
// Reportes para dirección: mismo router de reportes (valida rol adentro).
// Se monta bajo /api/direccion/reportes para no pasar por el middleware
// de adminRoutes, que exige rol admin.
app.use('/api/direccion/reportes', reportesRoutes);
app.use('/api/pagos', pagosRoutes);
app.use('/api/pagos-examen', pagosExamenRoutes);
app.use('/api/calificaciones', calificacionesRoutes);
app.use('/api/anuncios', anunciosRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/tutoriales', tutorialesRoutes);
app.use('/api/admin/sedes', sedesRoutes);
app.use('/api/admin/reportes', reportesRoutes);
app.use('/api/admin/configuracion', configuracionRoutes);
app.use('/api/admin/depuracion', depuracionRoutes);
app.use('/api/banco', bancoRoutes);
app.use('/api/firma', firmaRoutes);
app.use('/api/bloqueos', bloqueosRoutes);
app.use('/api/faq', faqRoutes);
app.use('/api/admin/faq', adminFaqRouter);
app.use('/api/padron-historico', padronRoutes);
// Búsqueda transversal del buscador global. Va en su propio prefijo, sin
// pasar por adminRoutes, porque la usan gestor y admin (valida rol adentro).
app.use('/api/busqueda', busquedaRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin/chat', adminChatRouter);
app.use('/api/aula', aulaRoutes);
// Telemetría de uso: ingesta de contadores + tablero + accesos rápidos.
app.use('/api/uso', usoRoutes);
// Rutas de mantenimiento/dev: NUNCA se montan en producción (defensa en
// profundidad, además del propio gate interno por NODE_ENV).
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/dev', devRoutes);
}

// Verificación pública de credenciales (destino del QR): se abre en el navegador
// del que escanea, por eso NO va bajo /api y debe montarse ANTES del estático y
// del catch-all del SPA para que no lo tape.
app.use('/c', verificacionRoutes);

// Cron: check programmed reports every hour
cron.schedule('0 * * * *', () => {
  ejecutarReportesProgramados().catch((e) => console.error('[Reportes Cron]', e));
});

// Cron: vencimiento de órdenes de pago de examen (cada hora)
cron.schedule('15 * * * *', () => {
  vencerPagosExamen()
    .then((n) => { if (n > 0) console.log(`[Pagos examen] ${n} orden(es) vencida(s)`); })
    .catch((e) => console.error('[Pagos examen Cron]', e));
});

// Cron: sincronizar el estado de las etapas con sus fechas (cada hora + al arrancar)
cron.schedule('20 * * * *', () => {
  sincronizarEstadosEtapas()
    .then((n) => { if (n > 0) console.log(`[Etapas] ${n} etapa(s) actualizaron su estado`); })
    .catch((e) => console.error('[Etapas Cron]', e));
});

// Cron: recordatorio de cierre de ventana, UNA vez al día a las 9:00 de
// Michoacán. Diario y a hora fija a propósito: el aviso solo se dispara faltando
// 3 días y 1 día, así que correrlo cada hora mandaría el mismo recordatorio 24
// veces. Ver utils/recordarCierreVentana.ts.
cron.schedule('0 9 * * *', () => {
  recordarCierreDeVentana()
    .then((n) => { if (n > 0) console.log(`[Cierre ventana] ${n} recordatorio(s) enviados`); })
    .catch((e) => console.error('[Cierre ventana Cron]', e));
}, { timezone: 'America/Mexico_City' });

// Cron: instantánea diaria de métricas, 23:50 de Michoacán — casi al cierre
// del día, para que la foto refleje la jornada completa. Es idempotente, así
// que repetirla no duplica. Ver services/metricasDiarias.ts.
cron.schedule('50 23 * * *', () => {
  tomarInstantanea()
    .then((n) => console.log(`[Métricas] instantánea guardada (${n} métricas)`))
    .catch((e) => console.error('[Métricas Cron]', e));
}, { timezone: 'America/Mexico_City' });

// Al arrancar: se toma la foto de hoy y se rellena el histórico reconstruible.
// Lo primero cubre el caso de que el servidor estuviera caído a las 23:50; lo
// segundo solo escribe días que falten, así que es barato repetirlo.
setTimeout(() => {
  tomarInstantanea()
    .then(() => rellenarHistorico())
    .then((n) => { if (n > 0) console.log(`[Métricas] histórico rellenado: ${n} valores`); })
    .catch((e) => console.error('[Métricas arranque]', e));
}, 8_000);

// Cron: barrer sesiones vencidas (04:10). Las filas de `sesiones` no gobiernan
// el acceso —eso lo hace la cookie firmada—, pero si no se limpian, la pantalla
// de seguridad acabaría listando sesiones muertas como si estuvieran vivas.
cron.schedule('10 4 * * *', () => {
  pool.query(`DELETE FROM sesiones WHERE expira_en < now()`)
    .then((r) => { if (r.rowCount) console.log(`[Sesiones] ${r.rowCount} vencida(s) barrida(s)`); })
    .catch((e) => console.error('[Sesiones Cron]', e));
}, { timezone: 'America/Mexico_City' });

// Cron: depuración automática de cuentas inactivas (03:00 AM Mexico City)
iniciarCronDepuracion();

// 404 para rutas /api/* no encontradas
app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint no existe' }));

// Servir frontend estático (producción monolith)
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const STATIC_DIR =
  process.env.STATIC_DIR ??
  path.resolve(__dirname, '..', '..', 'student-portal', 'dist', 'public');

if (fs.existsSync(STATIC_DIR)) {
  app.use(express.static(STATIC_DIR));
  // SPA fallback: cualquier ruta no-API sirve index.html
  app.use((_req, res) => {
    res.sendFile(path.join(STATIC_DIR, 'index.html'));
  });
  console.log(`📁 Sirviendo frontend desde ${STATIC_DIR}`);
}

// Error handler — no filtrar detalles internos al cliente en producción.
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[API Error]', err);
  const isProd = process.env.NODE_ENV === 'production';
  res.status(500).json({ error: isProd ? 'Error interno del servidor' : err.message || 'Error interno' });
});

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Preparatoria Abierta Michoacán API escuchando en :${PORT}`);
  await runStartupMigrations();
  console.log('✅ Migraciones de arranque completadas');

  // Lista de sesiones revocadas: se carga y se refresca cada minuto. Va DESPUÉS
  // de las migraciones porque depende de la columna sesiones_invalidadas_en.
  iniciarRevocacion();
  await sincronizarEstadosEtapas()
    .then((n) => console.log(`✅ Estados de etapas sincronizados (${n} cambios)`))
    .catch((e) => console.error('[Etapas] Error al sincronizar:', e));
  await vencerPagosExamen()
    .then((n) => console.log(`✅ Fichas de pago vencidas revisadas (${n} marcadas)`))
    .catch((e) => console.error('[Pagos] Error al vencer fichas:', e));
});

export default app;
