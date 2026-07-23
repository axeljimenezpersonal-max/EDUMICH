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

import { PDFDocument, StandardFonts, rgb, TextAlignment, pushGraphicsState, popGraphicsState, moveTo, lineTo, closePath, clip, endPath } from 'pdf-lib';
import { winAnsiSafe } from '../utils/pdfText';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { estudiantes, users, gestores, administradores, firmasUsuario, expedienteDocumentos, municipios } from '@workspace/db/schema';
import { rutaFotoAprobada } from '../utils/fotoExpediente';
import { archivoBuffer } from './storage';
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

/** Devuelve la firma "en uso" (la del slot activo) de una fila de firmas_usuario. */
function firmaActiva(
  row: { imagenDataUrl: string | null; imagenDataUrl2: string | null; activa: number } | undefined
): string | null {
  return row ? (row.activa === 2 ? row.imagenDataUrl2 : row.imagenDataUrl) ?? null : null;
}

/**
 * Resuelve el "Responsable de la inscripción" cuando el alumno NO tiene gestor.
 * Firmar la cédula es facultad de CUALQUIER administrador (titular u operativo):
 * cada quien firma con la suya. Si quien genera la cédula aún no registró su
 * firma, se toma la de otro admin para no dejar el documento sin firmar.
 */
async function resolverAdminResponsable(
  responsableUserId?: number
): Promise<{ nombre: string; firma: string | null }> {
  // 1) Quien procesa la cédula, si es admin (titular u operativo) y YA tiene
  //    firma registrada: firma con la suya.
  if (responsableUserId) {
    const [a] = await db
      .select({ nombre: administradores.nombreCompleto })
      .from(administradores)
      .where(eq(administradores.userId, responsableUserId));
    if (a) {
      const [f] = await db.select().from(firmasUsuario).where(eq(firmasUsuario.userId, responsableUserId));
      const firma = firmaActiva(f);
      if (firma) return { nombre: a.nombre, firma };
    }
  }
  // 2) Cualquier admin con la firma guardada más reciente (para no dejar la
  //    cédula sin firmar cuando quien la genera aún no registró la suya).
  const [row] = await db
    .select({
      nombre: administradores.nombreCompleto,
      imagenDataUrl: firmasUsuario.imagenDataUrl,
      imagenDataUrl2: firmasUsuario.imagenDataUrl2,
      activa: firmasUsuario.activa,
    })
    .from(administradores)
    .innerJoin(firmasUsuario, eq(firmasUsuario.userId, administradores.userId))
    .orderBy(desc(firmasUsuario.updatedAt))
    .limit(1);
  if (row) return { nombre: row.nombre, firma: firmaActiva(row) };
  // 3) Ningún admin con firma: al menos el nombre de un admin (línea en blanco).
  const [a0] = await db.select({ nombre: administradores.nombreCompleto }).from(administradores).limit(1);
  return { nombre: a0?.nombre ?? '', firma: null };
}

async function reunirDatos(estudianteId: number, responsableUserId?: number): Promise<{
  datos: CedulaDatosResueltos;
  fotoPath: string | null;
  firmaAlumno: string | null;
  firmaResponsable: string | null;
}> {
  const [est] = await db.select().from(estudiantes).where(eq(estudiantes.userId, estudianteId));
  if (!est) throw new Error('Estudiante no encontrado');

  const [userRow] = await db.select({ email: users.email }).from(users).where(eq(users.id, estudianteId));

  // Municipio de residencia → sirve como Ciudad cuando no se capturó por separado.
  let municipioNombre = '';
  if (est.municipioId) {
    const [m] = await db.select({ nombre: municipios.nombre }).from(municipios).where(eq(municipios.id, est.municipioId));
    municipioNombre = m?.nombre ?? '';
  }

  // Responsable de la inscripción: el gestor si el alumno tiene uno asignado y ese
  // gestor YA registró su firma. Si el alumno no tiene gestor —o su gestor aún no
  // tiene firma— firma el administrador que procesa la cédula (nombre + firma
  // juntos, para que el documento sea coherente y nunca salga la línea en blanco).
  let responsableNombre = '';
  let firmaResponsable: string | null = null;
  let firmaGestor: string | null = null;
  if (est.gestorId) {
    const [g] = await db.select({ nombre: gestores.nombreCompleto }).from(gestores).where(eq(gestores.userId, est.gestorId));
    const [fr] = await db.select().from(firmasUsuario).where(eq(firmasUsuario.userId, est.gestorId));
    firmaGestor = firmaActiva(fr);
    if (firmaGestor) {
      responsableNombre = g?.nombre ?? '';
      firmaResponsable = firmaGestor;
    }
  }
  // Sin gestor, o gestor sin firma registrada → responsable = administrador.
  if (!firmaResponsable) {
    const admin = await resolverAdminResponsable(responsableUserId);
    responsableNombre = admin.nombre || responsableNombre;
    firmaResponsable = admin.firma;
  }

  // Firma del alumno (la activa)
  const [fa] = await db.select().from(firmasUsuario).where(eq(firmasUsuario.userId, estudianteId));
  const firmaAlumno = firmaActiva(fa);

  // Fotografía del expediente — SOLO si está aprobada (regla única).
  const fotoPath = await rutaFotoAprobada(estudianteId);

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
    // Si no se capturó ciudad/estado por separado, se derivan del municipio de
    // residencia (ciudad) y del estado de la plataforma (Michoacán).
    ciudad: est.ciudad || municipioNombre,
    estado: est.estadoDomicilio || (est.municipioId ? 'Michoacán' : ''),
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
export async function obtenerDatosCedula(estudianteId: number, responsableUserId?: number): Promise<CedulaDatosResueltos> {
  return (await reunirDatos(estudianteId, responsableUserId)).datos;
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
  estudianteId: number,
  responsableUserId?: number
): Promise<{ pdf: Uint8Array; nombreArchivo: string }> {
  const { datos, fotoPath, firmaAlumno, firmaResponsable } = await reunirDatos(estudianteId, responsableUserId);

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

  // Nombres bajo la línea de firma: centrados sobre la línea.
  const setCentrado = (campo: string, valor: string) => {
    try {
      const f = form.getTextField(campo);
      f.setText(valor ?? '');
      f.setAlignment(TextAlignment.Center);
    } catch {
      /* campo ausente: se ignora */
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
  setCentrado('Nombre completo y firma estudiante', datos.nombreCompleto);
  setCentrado('Nombre y firma del responsable de la inscripción', datos.responsableNombre);

  // ── Fotografía (recuadro rotulado "FOTOGRAFÍA", lado derecho) ──
  // Se ajusta SIEMPRE al recuadro con aspect-fit y se centra, sin importar el
  // tamaño/orientación de la imagen subida, para que quepa y se vea consistente.
  if (fotoPath) {
    try {
      const bytes = await archivoBuffer(fotoPath);
      const esPng = bytes[0] === 0x89 && bytes[1] === 0x50;
      const esJpg = bytes[0] === 0xff && bytes[1] === 0xd8;
      if (esPng || esJpg) {
        const img = esPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
        // Recuadro "FOTOGRAFÍA" real de la plantilla, medido pixel a pixel sobre
        // el borde impreso (página 612×792). Antes la caja era más ancha y su
        // centro caía a la derecha del recuadro; con estas medidas la foto queda
        // centrada dentro del recuadro real (centro X ≈ 486).
        const boxW = 72, boxH = 81, boxX = 450, boxY = 493;
        // La plantilla trae impreso el texto "FOTOGRAFÍA": lo tapamos con un
        // fondo blanco (dentro del marco) para que no se asome tras la foto.
        page.drawRectangle({ x: boxX + 2, y: boxY + 2, width: boxW - 4, height: boxH - 4, color: rgb(1, 1, 1) });
        // Foto estilo "cover": llena TODO el recuadro (escala al lado mayor) y se
        // recorta el sobrante con un clip, sin franjas blancas ni desbordes.
        const escala = Math.max(boxW / img.width, boxH / img.height);
        const w = img.width * escala, h = img.height * escala;
        page.pushOperators(
          pushGraphicsState(),
          moveTo(boxX, boxY), lineTo(boxX + boxW, boxY), lineTo(boxX + boxW, boxY + boxH), lineTo(boxX, boxY + boxH), closePath(),
          clip(), endPath(),
        );
        page.drawImage(img, { x: boxX + (boxW - w) / 2, y: boxY + (boxH - h) / 2, width: w, height: h });
        page.pushOperators(popGraphicsState());
      }
    } catch {
      /* foto ilegible: se omite */
    }
  }

  // ── Firmas: centradas sobre su línea, tamaño uniforme, siempre derechas ──
  const dibujarFirma = async (dataUrl: string | null, centerX: number, y: number) => {
    if (!dataUrl) return;
    const parsed = dataUrlABytes(dataUrl);
    if (!parsed) return;
    try {
      const img = parsed.esPng ? await doc.embedPng(parsed.bytes) : await doc.embedJpg(parsed.bytes);
      const maxW = 150, maxH = 42;
      const escala = Math.min(maxW / img.width, maxH / img.height);
      const w = img.width * escala, h = img.height * escala;
      // centerX = centro de la línea de firma; x se calcula para centrar.
      page.drawImage(img, { x: centerX - w / 2, y, width: w, height: h });
    } catch {
      /* firma ilegible: se omite */
    }
  };
  // Centros de las líneas "Nombre y firma": estudiante (x≈150) y responsable (x≈452).
  await dibujarFirma(firmaAlumno, 150, 120);
  await dibujarFirma(firmaResponsable, 452, 120);

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
