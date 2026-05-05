/**
 * API server principal — Prepa Abierta Michoacán
 *
 * Ubicación destino en Replit: artifacts/api-server/src/index.ts
 * (reemplaza el index.ts existente del template TEC)
 */

import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import authRoutes from './routes/auth';
import gestorRoutes from './routes/gestor';
// import adminRoutes from './routes/admin';      // siguiente fase
// import estudianteRoutes from './routes/estudiante'; // siguiente fase

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

// 404
app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint no existe' }));

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[API Error]', err);
  res.status(500).json({ error: err.message || 'Error interno' });
});

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Prepa Abierta Michoacán API escuchando en :${PORT}`);
});

export default app;
