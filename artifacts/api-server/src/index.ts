/**
 * API server principal — Prepa Abierta Michoacán
 *
 * Ubicación destino en Replit: artifacts/api-server/src/index.ts
 * (reemplaza el index.ts existente del template TEC)
 */

import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import authRoutes from './routes/auth';
import gestorRoutes from './routes/gestor';
import estudianteRoutes from './routes/estudiante';
import publicoRoutes from './routes/publico';
import adminRoutes from './routes/admin';
import pagosRoutes from './routes/pagos';
import calificacionesRoutes from './routes/calificaciones';
import anunciosRoutes from './routes/anuncios';
import notificacionesRoutes from './routes/notificaciones';
import reportesRoutes, { ejecutarReportesProgramados } from './routes/reportes';
import configuracionRoutes from './routes/configuracion';
import depuracionRoutes from './routes/depuracion';
import bancoRoutes from './routes/banco';
import devRoutes from './routes/dev';
import cron from 'node-cron';
import { iniciarCronDepuracion } from './services/depuracion';

const app = express();

app.use(
  cors({
    origin: (origin, cb) => cb(null, true), // permite mismo host del Replit
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

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
app.use('/api/pagos', pagosRoutes);
app.use('/api/calificaciones', calificacionesRoutes);
app.use('/api/anuncios', anunciosRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/admin/reportes', reportesRoutes);
app.use('/api/admin/configuracion', configuracionRoutes);
app.use('/api/admin/depuracion', depuracionRoutes);
app.use('/api/banco', bancoRoutes);
app.use('/api/dev', devRoutes);

// Cron: check programmed reports every hour
cron.schedule('0 * * * *', () => {
  ejecutarReportesProgramados().catch((e) => console.error('[Reportes Cron]', e));
});

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

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[API Error]', err);
  res.status(500).json({ error: err.message || 'Error interno' });
});

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Prepa Abierta Michoacán API escuchando en :${PORT}`);
});

export default app;
