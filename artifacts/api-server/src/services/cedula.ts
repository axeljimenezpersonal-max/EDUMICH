/**
 * Generador de la Cédula de Inscripción (Preparatoria Abierta Michoacán).
 *
 * Carga la plantilla AcroForm `assets/cedula-inscripcion.pdf`, autollena los
 * campos con los datos del alumno (que ahora viven desglosados en `estudiantes`),
 * incrusta la fotografía del expediente y las firmas guardadas del alumno y del
 * gestor, aplana el formulario y devuelve los bytes del PDF final.
 *
 * IMPORTANTE: la cédula ya NO tiene datos propios; jala todo de `estudiantes`.
 * "Completar la cédula" = completar los datos del alumno.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { winAnsiSafe } from '../utils/pdfText';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { estudiantes, users, gestores, firmasUsuario, expedienteDocumentos } from '@workspace/db/schema';
import { armarNombreCompleto, armarDireccion } from '../utils/estudianteDatos';

// ── Resolución de la plantilla (funciona en dev y en Docker/Railway) ────────
function resolverPlantilla(): string {
  const candidatos = [
    path.join(process.cwd(), 'assets', 'cedula-inscripcion.pdf'),
    path.join(process.cwd(), 'artifacts', 'api-server', 'assets', 'cedula-inscripcion.pdf'),
  ];
  for (const c of candidatos) if (existsSync(c)) return c;
  throw new Error('No se encontró la plantilla de la cédula (assets/cedula-inscripcion.pdf)');
}

// ── Helpers de CURP ─────────────────────────────────────────────────────────
const ENTIDADES_CURP: Record<string, string> = {
  AS: 'Aguascalientes', BC: 'Baja California', BS: 'Baja California Sur', CC: 'Campeche',
  CL: 'Coahuila', CM: 'Colima', CS: 'Chiapas', CH: 'Chihuahua', DF: 'Ciudad de México',
  DG: 'Durango', GT: 'Guanajuato', GR: 'Guerrero', HG: 'Hidalgo', JC: 'Jalisco',
  MC: 'México', MN: 'Michoacán', MS: 'Morelos', NT: 'Nayarit', NL: 'Nuevo León',
  OC: 'Oaxaca', PL: 'Puebla', QT: 'Querétaro', QR: 'Quintana Roo', SP: 'San Luis Potosí',
  SL: 'Sinaloa', SR: 'Sonora', TC: 'Tabasco', TS: 'Tamaulipas', TL: 'Tlaxcala',
  VZ: 'Veracruz', YN: 'Yucatán', ZS: 'Zacatecas', NE: 'Nacido en el Extranjero',
};

function sexoDesdeCurp(curp?: string | null): string {
  if (!curp || curp.length < 11) return '';
  const s = curp[10]?.toUpperCase();
  return s === 'H' ? 'Hombre' : s === 'M' ? 'Mujer' : '';
}

function entidadDesdeCurp(curp?: string | null): string {
  if (!curp || curp.length < 13) return '';
  return ENTIDADES_CURP[curp.slice(11, 13).toUpperCase()] ?? '';
}

/** Etiqueta legible del sexo guardado ('hombre'|'mujer'|'no_definir'). */
function sexoLabel(sexo?: string | null): string {
  switch ((sexo ?? '').toLowerCase()) {
    case 'hombre': return 'Hombre';
    case 'mujer': return 'Mujer';
    case 'no_definir': return 'No definir';
    default: return sexo ?? '';
  }
}

function fmtFechaCorta(d: Date | string | null | undefined): string {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d + (d.length === 10 ? 'T00:00:00' : '')) : d;
  if (isNaN(dt.getTime())) return '';
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${dt.getFullYear()}`;
}

// ── Datos consolidados de la cédula (para autollenar la vista previa) ────────
export interface CedulaDatosResueltos {
  matricula: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombres: string;
  nombreCompleto: string;
  curp: string;
  fechaNacimiento: string; // dd/mm/yyyy
  sexo: string;
  estadoCivil: string;
  lugarNacimiento: string;
  entidadNacimiento: string;
  calleNumero: string;
  colonia: string;
  cp: string;
  ciudad: string;
  estado: string;
  telefono: string;
  correo: string;
  ultimoEstudio: string;
  observaciones: string;
  responsableNombre: string;
  tieneFoto: boolean;
  tieneFirmaAlumno: boolean;
  tieneFirmaResponsable: boolean;
}

async function reunirDatos(estudianteId: number): Promise<{
  datos: CedulaDatosResueltos;
  fotoPath: string | null;
  firmaAlumno: string | null;
  firmaResponsable: string | null;
}> {
  const [est] = await db.select().from(estudiantes).where(eq(estudiantes.userId, estudianteId));
  if (!est) throw new Error('Estudiante no encontrado');

  const [userRow] = await db.select({ email: users.email }).from(users).where(eq(users.id, estudianteId));

  const firmaActiva = (row: { imagenDataUrl: string | null; imagenDataUrl2: string | null; activa: number } | undefined) =>
    row ? (row.activa === 2 ? row.imagenDataUrl2 : row.imagenDataUrl) ?? null : null;

  // Gestor responsable
  let responsableNombre = '';
  let firmaResponsable: string | null = null;
  if (est.gestorId) {
    const [g] = await db.select({ nombre: gestores.nombreCompleto }).from(gestores).where(eq(gestores.userId, est.gestorId));
    responsableNombre = g?.nombre ?? '';
    const [fr] = await db.select().from(firmasUsuario).where(eq(firmasUsuario.userId, est.gestorId));
    firmaResponsable = firmaActiva(fr);
  }

  // Firma del alumno (la activa)
  const [fa] = await db.select().from(firmasUsuario).where(eq(firmasUsuario.userId, estudianteId));
  const firmaAlumno = firmaActiva(fa);

  // Fotografía del expediente (tipo 'foto')
  const [foto] = await db
    .select()
    .from(expedienteDocumentos)
    .where(and(eq(expedienteDocumentos.estudianteId, estudianteId), eq(expedienteDocumentos.tipo, 'foto')));
  const fotoPath = foto && existsSync(foto.rutaArchivo) ? foto.rutaArchivo : null;

  const datos: CedulaDatosResueltos = {
    matricula: est.matriculaOficialDGB ?? '',
    apellidoPaterno: est.apellidoPaterno ?? '',
    apellidoMaterno: est.apellidoMaterno ?? '',
    nombres: est.nombres ?? '',
    nombreCompleto: est.nombreCompleto,
    curp: est.curp ?? '',
    fechaNacimiento: fmtFechaCorta(est.fechaNacimiento),
    sexo: sexoLabel(est.sexo) || sexoDesdeCurp(est.curp),
    estadoCivil: est.estadoCivil ?? '',
    lugarNacimiento: est.lugarNacimiento ?? '',
    entidadNacimiento: est.entidadNacimiento || entidadDesdeCurp(est.curp),
    calleNumero: est.calleNumero || (est.direccion ?? ''),
    colonia: est.colonia ?? '',
    cp: est.cp ?? '',
    ciudad: est.ciudad ?? '',
    estado: est.estadoDomicilio ?? '',
    telefono: est.telefono ?? '',
    correo: userRow?.email ?? '',
    ultimoEstudio: est.ultimoEstudio || 'Secundaria',
    observaciones: est.observaciones ?? '',
    responsableNombre,
    tieneFoto: fotoPath !== null,
    tieneFirmaAlumno: firmaAlumno !== null,
    tieneFirmaResponsable: firmaResponsable !== null,
  };

  return { datos, fotoPath, firmaAlumno, firmaResponsable };
}

/** Devuelve los datos consolidados (para la vista previa web). */
export async function obtenerDatosCedula(estudianteId: number): Promise<CedulaDatosResueltos> {
  return (await reunirDatos(estudianteId)).datos;
}

// ── Guardar/completar los datos de la cédula = actualizar los datos del alumno ─
export const cedulaDatosSchema = z.object({
  apellidoPaterno: z.string().max(100).optional(),
  apellidoMaterno: z.string().max(100).optional(),
  nombres: z.string().max(120).optional(),
  sexo: z.string().max(20).optional(),
  estadoCivil: z.string().max(30).optional(),
  lugarNacimiento: z.string().max(120).optional(),
  entidadNacimiento: z.string().max(80).optional(),
  calleNumero: z.string().max(200).optional(),
  colonia: z.string().max(120).optional(),
  cp: z.string().max(10).optional(),
  ciudad: z.string().max(120).optional(),
  estado: z.string().max(80).optional(), // → estado_domicilio
  ultimoEstudio: z.string().max(120).optional(),
  observaciones: z.string().max(1000).optional(),
});

export type CedulaDatosInput = z.infer<typeof cedulaDatosSchema>;

/** Escribe los campos desglosados en `estudiantes` y re-deriva nombreCompleto/direccion. */
export async function guardarDatosCedula(estudianteId: number, data: CedulaDatosInput): Promise<void> {
  const [est] = await db.select().from(estudiantes).where(eq(estudiantes.userId, estudianteId));
  if (!est) throw new Error('Estudiante no encontrado');

  const set: Partial<typeof estudiantes.$inferInsert> = { updatedAt: new Date() };
  if (data.apellidoPaterno !== undefined) set.apellidoPaterno = data.apellidoPaterno;
  if (data.apellidoMaterno !== undefined) set.apellidoMaterno = data.apellidoMaterno;
  if (data.nombres !== undefined) set.nombres = data.nombres;
  if (data.sexo !== undefined) set.sexo = data.sexo;
  if (data.estadoCivil !== undefined) set.estadoCivil = data.estadoCivil;
  if (data.lugarNacimiento !== undefined) set.lugarNacimiento = data.lugarNacimiento;
  if (data.entidadNacimiento !== undefined) set.entidadNacimiento = data.entidadNacimiento;
  if (data.calleNumero !== undefined) set.calleNumero = data.calleNumero;
  if (data.colonia !== undefined) set.colonia = data.colonia;
  if (data.cp !== undefined) set.cp = data.cp;
  if (data.ciudad !== undefined) set.ciudad = data.ciudad;
  if (data.estado !== undefined) set.estadoDomicilio = data.estado;
  if (data.ultimoEstudio !== undefined) set.ultimoEstudio = data.ultimoEstudio;
  if (data.observaciones !== undefined) set.observaciones = data.observaciones;

  // Re-derivar nombreCompleto y direccion desde las partes (mezclando lo nuevo con lo existente)
  const nombres = data.nombres ?? est.nombres;
  const apellidoPaterno = data.apellidoPaterno ?? est.apellidoPaterno;
  const apellidoMaterno = data.apellidoMaterno ?? est.apellidoMaterno;
  const nc = armarNombreCompleto({ nombres, apellidoPaterno, apellidoMaterno });
  if (nc) set.nombreCompleto = nc;

  const dir = armarDireccion({
    calleNumero: data.calleNumero ?? est.calleNumero,
    colonia: data.colonia ?? est.colonia,
    cp: data.cp ?? est.cp,
    ciudad: data.ciudad ?? est.ciudad,
    estadoDomicilio: data.estado ?? est.estadoDomicilio,
  });
  if (dir) set.direccion = dir;

  await db.update(estudiantes).set(set).where(eq(estudiantes.userId, estudianteId));
}

function dataUrlABytes(dataUrl: string): { bytes: Uint8Array; esPng: boolean } | null {
  const m = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(dataUrl.trim());
  if (!m) return null;
  const esPng = m[1].toLowerCase() === 'png';
  return { bytes: Buffer.from(m[2], 'base64'), esPng };
}

/** Nombre de archivo de la cédula: "APELLIDO | MATRÍCULA (o NA) | CÉDULA DE INSCRIPCIÓN.pdf" */
export function nombreArchivoCedula(apellidoPaterno: string, matricula: string): string {
  const ap = (apellidoPaterno || 'ALUMNO').trim();
  const mat = (matricula || '').trim() || 'NA';
  return `${ap} | ${mat} | CÉDULA DE INSCRIPCIÓN.pdf`;
}

/** Header Content-Disposition con nombre en UTF-8 (soporta acentos y "|"). */
export function dispositionCedula(nombreArchivo: string): string {
  const ascii =
    nombreArchivo.normalize('NFKD').replace(/[^\x20-\x7E]/g, '').replace(/"/g, '') || 'cedula-inscripcion.pdf';
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nombreArchivo)}`;
}

/** Genera el PDF de la cédula rellenado y aplanado. Devuelve bytes + nombre de archivo. */
export async function generarCedulaPdf(
  estudianteId: number
): Promise<{ pdf: Uint8Array; nombreArchivo: string }> {
  const { datos, fotoPath, firmaAlumno, firmaResponsable } = await reunirDatos(estudianteId);

  const doc = await PDFDocument.load(readFileSync(resolverPlantilla()), { ignoreEncryption: true });
  const form = doc.getForm();
  const page = doc.getPage(0);

  const set = (campo: string, valor: string) => {
    try {
      form.getTextField(campo).setText(valor ?? '');
    } catch {
      /* campo ausente en la plantilla: se ignora */
    }
  };

  set('Matrícula', datos.matricula);
  set('Fecha', fmtFechaCorta(new Date()));
  set('Apellido P', datos.apellidoPaterno);
  set('Apellido M', datos.apellidoMaterno);
  set('Nombre completo', datos.nombres || datos.nombreCompleto);
  set('Fecha de nacimiento', datos.fechaNacimiento);
  set('Sexo', datos.sexo);
  set('Estado civil', datos.estadoCivil);
  set('Lugar de nacimiento', datos.lugarNacimiento);
  set('Curp', datos.curp);
  set('Calle y número', datos.calleNumero);
  set('Colonia', datos.colonia);
  set('C.P', datos.cp);
  set('Teléfono', datos.telefono);
  set('Entidad o localidad donde nació', datos.entidadNacimiento);
  set('Cuidad', datos.ciudad);
  set('Estado', datos.estado);
  set('Correo electrónico', datos.correo);
  set('Ultimo estudio realizado', datos.ultimoEstudio);
  set('Nombre completo y firma estudiante', datos.nombreCompleto);
  set('Nombre y firma del responsable de la inscripción', datos.responsableNombre);

  // ── Fotografía (recuadro superior izquierdo) ──
  if (fotoPath) {
    try {
      const bytes = readFileSync(fotoPath);
      const esPng = bytes[0] === 0x89 && bytes[1] === 0x50;
      const esJpg = bytes[0] === 0xff && bytes[1] === 0xd8;
      if (esPng || esJpg) {
        const img = esPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
        const boxW = 116, boxH = 118, boxX = 58, boxY = 560;
        const escala = Math.min(boxW / img.width, boxH / img.height);
        const w = img.width * escala, h = img.height * escala;
        page.drawImage(img, { x: boxX + (boxW - w) / 2, y: boxY + (boxH - h) / 2, width: w, height: h });
      }
    } catch {
      /* foto ilegible: se omite */
    }
  }

  // ── Firmas (se dibujan sobre la línea de firma) ──
  const dibujarFirma = async (dataUrl: string | null, x: number, y: number) => {
    if (!dataUrl) return;
    const parsed = dataUrlABytes(dataUrl);
    if (!parsed) return;
    try {
      const img = parsed.esPng ? await doc.embedPng(parsed.bytes) : await doc.embedJpg(parsed.bytes);
      const maxW = 150, maxH = 40;
      const escala = Math.min(maxW / img.width, maxH / img.height);
      page.drawImage(img, { x, y, width: img.width * escala, height: img.height * escala });
    } catch {
      /* firma ilegible: se omite */
    }
  };
  await dibujarFirma(firmaAlumno, 60, 118);
  await dibujarFirma(firmaResponsable, 362, 118);

  // ── Observaciones (opcional) ──
  // La plantilla no tiene campo AcroForm para observaciones, así que se dibuja.
  // Se intenta también por si la plantilla llegara a tener el campo.
  set('Observaciones', datos.observaciones);
  if (datos.observaciones && datos.observaciones.trim()) {
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText(winAnsiSafe(`Observaciones: ${datos.observaciones.trim()}`), {
      x: 50,
      y: 150,
      size: 8,
      font,
      color: rgb(0.15, 0.15, 0.15),
      maxWidth: 500,
      lineHeight: 10,
    });
  }

  form.flatten();
  const pdf = await doc.save();
  return { pdf, nombreArchivo: nombreArchivoCedula(datos.apellidoPaterno, datos.matricula) };
}
