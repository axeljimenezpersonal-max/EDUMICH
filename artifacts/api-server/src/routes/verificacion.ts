/**
 * Verificación PÚBLICA de credenciales — GET /c/:folio?t=<firma>
 *
 * Es la URL que se codifica en el QR de la credencial (ver utils/credencialQr.ts).
 * Se abre desde el celular de quien escanea, así que NO va bajo /api, NO exige
 * sesión y responde HTML renderizado en el servidor (no depende del SPA).
 *
 * PRIVACIDAD: es una URL pública que cualquiera con el link puede abrir. Sólo se
 * expone lo mínimo para cotejar identidad ante una sede: NOMBRE y FOLIO (más
 * fechas de emisión/vigencia). Nunca CURP, correo, teléfono, dirección, matrícula
 * ni ids internos.
 *
 * Se consulta la tabla `credenciales` (historial), no `estudiantes`: así un folio
 * repuesto o cancelado SIGUE resolviendo y puede informar que ya no es válido,
 * en vez de verse como "no existe".
 */
import { Router } from 'express';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { credenciales, credencialesVerificaciones, estudiantes } from '@workspace/db/schema';
import { firmaCredencial } from '../utils/credencialQr';

const router = Router();

/** Limiter suave: es pública y consultable a ciegas, pero una sede puede escanear seguido. */
const verificacionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Demasiadas verificaciones desde esta conexión. Intenta de nuevo en unos minutos.',
});

type Resultado = 'ok' | 'sin_firma' | 'firma_invalida' | 'no_encontrada' | 'repuesta' | 'cancelada';

/** Escapa TODO dato que venga de la base antes de interpolarlo en el HTML. */
function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Comparación en tiempo constante de la firma recibida contra la esperada. */
function firmaValida(folio: string, token: string): boolean {
  const esperado = firmaCredencial(folio);
  if (token.length !== esperado.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token, 'utf8'), Buffer.from(esperado, 'utf8'));
}

function fechaMx(d: Date | string | null | undefined): string {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(String(d).replace(' ', 'T') + (String(d).endsWith('Z') ? '' : 'Z'));
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Mexico_City',
  }).format(date);
}

/** Registro de auditoría. Nunca debe tumbar la respuesta, pero tampoco se silencia. */
async function registrarVerificacion(params: {
  folio: string;
  firmaOk: boolean;
  resultado: Resultado;
  estudianteId?: number | null;
}): Promise<void> {
  try {
    await db.insert(credencialesVerificaciones).values({
      estudianteId: params.estudianteId ?? null,
      folio: params.folio.slice(0, 60),
      firmaValida: params.firmaOk,
      resultado: params.resultado,
      verificadoPor: null,
    });
  } catch (e) {
    console.error('[Verificación credencial] No se pudo registrar el escaneo:', e);
  }
}

type Tono = 'valida' | 'aviso' | 'invalida';

const TONOS: Record<Tono, { color: string; fondo: string; borde: string; icono: string }> = {
  valida: { color: '#1b6b3a', fondo: '#eaf6ee', borde: '#bfe3cb', icono: '✓' },
  aviso: { color: '#8a5a09', fondo: '#fdf4e3', borde: '#f0dcae', icono: '!' },
  invalida: { color: '#96201f', fondo: '#fdeceb', borde: '#f3c9c7', icono: '✕' },
};

function pagina(opts: {
  tono: Tono;
  titulo: string;
  mensaje: string;
  datos?: Array<[string, string]>;
  nota?: string;
}): string {
  const t = TONOS[opts.tono];
  const filas = (opts.datos ?? [])
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<div class="fila"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`
    )
    .join('');

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(opts.titulo)} · Modula · Plan 22</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;padding:24px 16px;background:#f6f2ee;color:#2c2320;
       font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
       line-height:1.5;-webkit-text-size-adjust:100%}
  .card{max-width:440px;margin:0 auto;background:#fff;border-radius:14px;
        box-shadow:0 2px 14px rgba(107,21,48,.10);overflow:hidden}
  .top{background:#6b1530;color:#fff;padding:18px 20px;border-bottom:3px solid #b89968}
  .marca{font-size:15px;font-weight:700;letter-spacing:.3px;margin:0}
  .sub{font-size:12px;opacity:.85;margin:2px 0 0}
  .estado{display:flex;align-items:center;gap:12px;padding:18px 20px;
          background:${t.fondo};border-bottom:1px solid ${t.borde}}
  .bola{flex:0 0 auto;width:38px;height:38px;border-radius:50%;background:${t.color};color:#fff;
        display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700}
  .estado h1{margin:0;font-size:17px;font-weight:700;color:${t.color}}
  .estado p{margin:3px 0 0;font-size:13px;color:#4a3f3a}
  .datos{padding:6px 20px 14px}
  .fila{display:flex;justify-content:space-between;gap:14px;padding:11px 0;
        border-bottom:1px solid #efe8e2;font-size:14px}
  .fila:last-child{border-bottom:none}
  .k{color:#7b6a62;flex:0 0 auto}
  .v{font-weight:600;text-align:right;word-break:break-word}
  .nota{padding:0 20px 18px;font-size:12.5px;color:#7b6a62}
  .pie{padding:14px 20px;background:#faf7f4;border-top:1px solid #efe8e2;
       font-size:11.5px;color:#8b7a72;text-align:center}
  @media (max-width:380px){.fila{flex-direction:column;gap:2px}.v{text-align:left}}
</style>
</head>
<body>
  <main class="card">
    <header class="top">
      <p class="marca">Modula · Plan 22</p>
      <p class="sub">Verificación de credencial</p>
    </header>
    <section class="estado">
      <div class="bola" aria-hidden="true">${t.icono}</div>
      <div>
        <h1>${esc(opts.titulo)}</h1>
        <p>${esc(opts.mensaje)}</p>
      </div>
    </section>
    ${filas ? `<section class="datos">${filas}</section>` : ''}
    ${opts.nota ? `<p class="nota">${esc(opts.nota)}</p>` : ''}
    <footer class="pie">Verificación oficial en línea · Secretaría de Educación de Michoacán</footer>
  </main>
</body>
</html>`;
}

function enviar(res: import('express').Response, status: number, html: string) {
  res
    .status(status)
    .set('Content-Type', 'text/html; charset=utf-8')
    .set('Cache-Control', 'no-store')
    .set('Referrer-Policy', 'no-referrer')
    .set('X-Robots-Tag', 'noindex, nofollow')
    .send(html);
}

router.get('/:folio', verificacionLimiter, async (req, res) => {
  const folio = String(req.params.folio ?? '').trim().slice(0, 60);
  const token = String(req.query.t ?? '').trim();

  // ── 1) Sin firma o firma inválida: NO se revela absolutamente ningún dato.
  if (!token) {
    await registrarVerificacion({ folio, firmaOk: false, resultado: 'sin_firma' });
    return enviar(
      res,
      400,
      pagina({
        tono: 'invalida',
        titulo: 'No se pudo validar esta credencial',
        mensaje: 'El código escaneado no incluye el sello de seguridad.',
        nota: 'Vuelve a escanear el código QR impreso en la credencial. Si el problema persiste, acude a tu sede.',
      })
    );
  }

  if (!/^[a-f0-9]+$/i.test(token) || !firmaValida(folio, token)) {
    await registrarVerificacion({ folio, firmaOk: false, resultado: 'firma_invalida' });
    return enviar(
      res,
      400,
      pagina({
        tono: 'invalida',
        titulo: 'No se pudo validar esta credencial',
        mensaje: 'El sello de seguridad no corresponde. Este código no fue emitido por la plataforma.',
        nota: 'No se muestra información del titular porque la credencial no pudo autenticarse.',
      })
    );
  }

  // ── 2) Firma válida: se busca el folio en el historial de credenciales.
  let fila:
    | {
        estudianteId: number;
        estado: string;
        emitidaEn: Date | null;
        vigenteHasta: Date | null;
        nombreCompleto: string | null;
      }
    | undefined;

  try {
    const rows = await db
      .select({
        estudianteId: credenciales.estudianteId,
        estado: credenciales.estado,
        emitidaEn: credenciales.emitidaEn,
        vigenteHasta: credenciales.vigenteHasta,
        nombreCompleto: estudiantes.nombreCompleto,
      })
      .from(credenciales)
      .leftJoin(estudiantes, eq(estudiantes.userId, credenciales.estudianteId))
      .where(eq(credenciales.folio, folio))
      .limit(1);
    fila = rows[0];
  } catch (e) {
    console.error('[Verificación credencial] Error al consultar el folio:', e);
    return enviar(
      res,
      500,
      pagina({
        tono: 'aviso',
        titulo: 'No se pudo completar la verificación',
        mensaje: 'Ocurrió un problema al consultar el registro. Inténtalo de nuevo en unos momentos.',
      })
    );
  }

  if (!fila) {
    await registrarVerificacion({ folio, firmaOk: true, resultado: 'no_encontrada' });
    return enviar(
      res,
      404,
      pagina({
        tono: 'invalida',
        titulo: 'Esta credencial no está registrada',
        mensaje: 'El folio no aparece en el registro de credenciales emitidas.',
        datos: [['Folio', folio]],
        nota: 'Si la credencial es física y luce auténtica, repórtala en tu sede para su revisión.',
      })
    );
  }

  const nombre = (fila.nombreCompleto ?? '').trim();

  // ── 3) Repuesta o cancelada: ya no es válida. Sólo nombre + folio + fecha.
  if (fila.estado === 'repuesta' || fila.estado === 'cancelada') {
    const resultado: Resultado = fila.estado === 'repuesta' ? 'repuesta' : 'cancelada';
    await registrarVerificacion({
      folio,
      firmaOk: true,
      resultado,
      estudianteId: fila.estudianteId,
    });
    const explicacion =
      fila.estado === 'repuesta'
        ? 'Esta credencial fue repuesta: existe una credencial más reciente que la sustituye.'
        : 'Esta credencial fue cancelada y no debe aceptarse como identificación.';
    return enviar(
      res,
      200,
      pagina({
        tono: 'aviso',
        titulo: 'Esta credencial ya no es válida',
        mensaje: explicacion,
        datos: [
          ['Titular', nombre || 'No disponible'],
          ['Folio', folio],
          [fila.estado === 'repuesta' ? 'Repuesta desde' : 'Cancelada desde', fechaMx(fila.emitidaEn)],
        ],
        nota: 'Solicita al portador la credencial vigente.',
      })
    );
  }

  // ── 4) Activa.
  await registrarVerificacion({ folio, firmaOk: true, resultado: 'ok', estudianteId: fila.estudianteId });
  const vigencia = fechaMx(fila.vigenteHasta);
  return enviar(
    res,
    200,
    pagina({
      tono: 'valida',
      titulo: 'Credencial válida',
      mensaje: 'Este código fue emitido por la plataforma y la credencial se encuentra vigente.',
      datos: [
        ['Titular', nombre || 'No disponible'],
        ['Folio', folio],
        ['Emitida el', fechaMx(fila.emitidaEn)],
        ...(vigencia ? ([['Vigente hasta', vigencia]] as Array<[string, string]>) : []),
      ],
      nota: 'Coteja el nombre y la fotografía de la credencial física con la persona que la presenta.',
    })
  );
});

export default router;
