/**
 * QR seguro de la credencial digital.
 *
 * El QR es una URL pública `…/c/<folio>?t=<firma>` donde <firma> es un HMAC-SHA256
 * (con QR_SECRET) del folio. Como el folio es legible/secuencial, la FIRMA es lo
 * que hace al QR infalsificable: sin QR_SECRET no se puede producir un token
 * válido, así que un QR "auténtico" sólo lo pudo emitir EDUMICH.
 *
 * La verificación recomputa el HMAC y lo compara en tiempo constante.
 */
import crypto from 'node:crypto';
import { QR_SECRET } from '../config/env';

const BASE = 'https://verifica.edumich.michoacan.gob.mx';

/** Firma (token) determinística del folio de credencial. 24 hex. */
export function firmaCredencial(folio: string): string {
  return crypto.createHmac('sha256', QR_SECRET).update(`credencial:${folio}`).digest('hex').slice(0, 24);
}

/** URL firmada que se codifica en el QR de la credencial. */
export function verifyUrlCredencial(folio: string): string {
  return `${BASE}/c/${folio}?t=${firmaCredencial(folio)}`;
}

/**
 * Interpreta el contenido de un QR escaneado. Acepta la URL firmada, la URL
 * vieja sin firma, o el folio pelón. Devuelve el folio y si la firma es válida.
 */
export function parseCredencialQr(raw: string): { folio: string; firmaValida: boolean } {
  const s = String(raw ?? '').trim();
  const mFolio = s.match(/\/c\/([A-Za-z0-9_-]+)/);
  const folio = (mFolio ? mFolio[1] : s.split(/[?#]/)[0]).trim();
  const mTok = s.match(/[?&]t=([A-Fa-f0-9]+)/);
  const token = mTok ? mTok[1] : '';
  const esperado = firmaCredencial(folio);
  const firmaValida =
    token.length === esperado.length &&
    crypto.timingSafeEqual(Buffer.from(token, 'utf8'), Buffer.from(esperado, 'utf8'));
  return { folio, firmaValida };
}
