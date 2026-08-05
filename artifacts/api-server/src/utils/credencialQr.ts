/**
 * QR seguro de la credencial digital.
 *
 * El QR es una URL pública `…/c/<folio>?t=<firma>` donde <firma> es un HMAC-SHA256
 * (con QR_SECRET) del folio. Como el folio es legible/secuencial, la FIRMA es lo
 * que hace al QR infalsificable: sin QR_SECRET no se puede producir un token
 * válido, así que un QR "auténtico" sólo lo pudo emitir Modula.
 *
 * La verificación recomputa el HMAC y lo compara en tiempo constante.
 */
import crypto from 'node:crypto';
import { QR_SECRET } from '../config/env';
import { urlPortalEstado } from './portal';

/**
 * A dónde apunta el QR impreso.
 *
 * Antes era `https://verifica.edumich.michoacan.gob.mx`, un dominio que NO
 * EXISTE (comprobado por DNS: NXDOMAIN). Cada credencial impresa llevaba un QR
 * que al escanearse daba "no se puede acceder al sitio" — el documento parecía
 * verificable y no lo era.
 *
 * Ahora apunta al portal vivo. Las credenciales ya impresas con el dominio
 * muerto no se arreglan solas —hay que reimprimirlas—, pero ninguna empeora:
 * ya estaban rotas.
 */
function baseVerificacion(): string {
  return urlPortalEstado();
}

/** Firma (token) determinística del folio de credencial. 24 hex. */
export function firmaCredencial(folio: string): string {
  return crypto.createHmac('sha256', QR_SECRET).update(`credencial:${folio}`).digest('hex').slice(0, 24);
}

/** URL firmada que se codifica en el QR de la credencial. */
export function verifyUrlCredencial(folio: string): string {
  return `${baseVerificacion()}/c/${folio}?t=${firmaCredencial(folio)}`;
}

/**
 * Lo mismo para el QR de las FICHAS, que llevan el folio de preregistro en vez
 * del de la credencial.
 *
 * Antes apuntaban a `/verificar/<folio>` SIN firma: la ruta no existía y, si
 * hubiera existido, un folio secuencial y sin firma habría dejado recorrer el
 * padrón entero probando números. Con la misma firma que la credencial, el QR
 * de una ficha vale exactamente lo que vale haberla tenido en la mano.
 */
export function verifyUrlFicha(folio: string): string {
  return `${baseVerificacion()}/c/${folio}?t=${firmaCredencial(folio)}`;
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
