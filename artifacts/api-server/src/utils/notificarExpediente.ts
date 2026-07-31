/**
 * Avisos del expediente — fuente única.
 *
 * El gestor administra alumnos pero no se enteraba de nada de lo que hacían: los
 * tres tipos creados para él (`mi_alumno_*`) existían en el enum y NUNCA se
 * disparaban. Tenía que entrar a revisar alumno por alumno para saber si alguien
 * había subido un documento.
 *
 * Aquí vive lo que se avisa cuando el expediente se mueve. El ciclo de la orden
 * de pago vive aparte, en `notificarPago.ts`.
 */
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import { estudiantes, expedienteDocumentos, solicitudesCuenta } from '@workspace/db/schema';
import { notificar, notificarATodosLosAdmins } from './notificar';
import { DOCUMENTOS_OBLIGATORIOS } from '../config/reglas';

/** Nombre y gestor del alumno, para dirigir y redactar el aviso. */
async function datosAlumno(
  estudianteId: number,
): Promise<{ nombre: string; gestorId: number | null; registroTipo: string | null; curp: string | null } | null> {
  const [e] = await db
    .select({
      nombre: estudiantes.nombreCompleto,
      gestorId: estudiantes.gestorId,
      registroTipo: estudiantes.registroTipo,
      curp: estudiantes.curp,
    })
    .from(estudiantes)
    .where(eq(estudiantes.userId, estudianteId))
    .limit(1);
  if (!e) return null;
  return {
    nombre: e.nombre ?? 'Un alumno',
    gestorId: e.gestorId ?? null,
    registroTipo: e.registroTipo ?? null,
    curp: e.curp ?? null,
  };
}

/**
 * ¿Esta persona eligió llevar su proceso POR SU CUENTA?
 *
 * Importa para no empujar a la administración a asignarle un centro. Llevar la
 * prepa sin gestor es un camino válido del sistema, no un pendiente; y el
 * candado anticorrupción prohíbe expresamente asignarle centro a quien pidió
 * auto-gestión. Un aviso que diga "asígnale uno" contradice esa regla.
 *
 * Se deduce de dos señales, en orden:
 *  - quien se auto-registró en el portal entró solo, sin más que averiguar;
 *  - quien mandó solicitud lo dejó dicho en `modalidadPreferida`.
 */
async function vaPorSuCuenta(alumno: { registroTipo: string | null; curp: string | null }): Promise<boolean> {
  if (alumno.registroTipo === 'auto_registro') return true;
  if (!alumno.curp) return false;
  const [sol] = await db
    .select({ modalidad: solicitudesCuenta.modalidadPreferida })
    .from(solicitudesCuenta)
    .where(eq(solicitudesCuenta.curp, alumno.curp))
    .limit(1);
  return sol?.modalidad === 'auto_gestion';
}

/** Nombre legible del tipo de documento para el texto del aviso. */
const NOMBRE_DOC: Record<string, string> = {
  curp: 'CURP',
  acta_nacimiento: 'acta de nacimiento',
  ine: 'identificación oficial',
  comprobante_domicilio: 'comprobante de domicilio',
  certificado_secundaria: 'certificado de secundaria',
  foto: 'fotografía',
};

function nombreDoc(tipo: string): string {
  return NOMBRE_DOC[tipo] ?? tipo.replace(/_/g, ' ');
}

/**
 * El alumno subió un documento por su cuenta.
 *
 * Antes esta ruta no avisaba a NADIE: el documento quedaba esperando revisión
 * sin que administración lo supiera y sin que el gestor se enterara. (Cuando es
 * el gestor quien sube, `routes/gestor.ts` ya avisaba a administración.)
 */
export async function avisarDocumentoSubidoPorAlumno(estudianteId: number, tipo: string): Promise<void> {
  const alumno = await datosAlumno(estudianteId);
  if (!alumno) return;

  await notificarATodosLosAdmins({
    tipo: 'documento_subido_revisar',
    prioridad: 'normal',
    titulo: 'Documento por revisar',
    cuerpo: `${alumno.nombre} subió su ${nombreDoc(tipo)}.`,
    enlace: '/admin/alumnos?filtro=docs_en_revision',
  });

  if (alumno.gestorId) {
    await notificar({
      userId: alumno.gestorId,
      tipo: 'mi_alumno_subio_documento',
      prioridad: 'baja',
      titulo: 'Tu alumno subió un documento',
      cuerpo: `${alumno.nombre} subió su ${nombreDoc(tipo)}. Queda en revisión de la administración.`,
      enlace: '/gestor/alumnos',
    });
  }
}

/**
 * Se aprobó un documento: avisa SOLO si esa aprobación fue la que completó el
 * expediente (la transición de 4 → 5 obligatorios aprobados).
 *
 * Así no se repite el aviso cada vez que se aprueba un documento extra después
 * de que el expediente ya estaba completo.
 */
export async function avisarSiExpedienteQuedoCompleto(estudianteId: number, tipoAprobado: string): Promise<void> {
  const obligatorios = DOCUMENTOS_OBLIGATORIOS as readonly string[];
  // Si lo aprobado no es obligatorio, no pudo completar nada.
  if (!obligatorios.includes(tipoAprobado)) return;

  const aprobados = await db
    .select({ tipo: expedienteDocumentos.tipo })
    .from(expedienteDocumentos)
    .where(
      and(
        eq(expedienteDocumentos.estudianteId, estudianteId),
        eq(expedienteDocumentos.estado, 'aprobado'),
        inArray(expedienteDocumentos.tipo, [...obligatorios]),
      ),
    );

  const distintos = new Set(aprobados.map((a) => a.tipo));
  // Exactamente completo: si fueran más, el aviso ya se envió antes.
  if (distintos.size !== obligatorios.length) return;

  const alumno = await datosAlumno(estudianteId);
  if (!alumno) return;

  await notificarATodosLosAdmins({
    tipo: 'expediente_completo',
    prioridad: 'normal',
    titulo: 'Expediente completo',
    cuerpo: `${alumno.nombre} ya tiene sus ${obligatorios.length} documentos obligatorios aprobados. Puede asignársele matrícula oficial.`,
    enlace: '/admin/alumnos',
  });

  if (alumno.gestorId) {
    await notificar({
      userId: alumno.gestorId,
      tipo: 'mi_alumno_completo_expediente',
      prioridad: 'normal',
      titulo: 'Tu alumno completó su expediente',
      cuerpo: `${alumno.nombre} tiene sus ${obligatorios.length} documentos aprobados. Ya solo falta su matrícula para poder inscribirse.`,
      enlace: '/gestor/alumnos',
    });
  } else if (await vaPorSuCuenta(alumno)) {
    // NO es un pendiente: es el camino que la persona eligió. El aviso existe
    // solo para que la administración sepa que ahí no hay centro a quién
    // avisarle, y dice expresamente que no se le asigne uno —asignárselo es
    // justo lo que el candado anticorrupción prohíbe—.
    await notificarATodosLosAdmins({
      tipo: 'alumno_sin_gestor',
      prioridad: 'normal',
      titulo: 'Expediente completo · alumno por su cuenta',
      cuerpo: `${alumno.nombre} completó su expediente y lleva su proceso por su cuenta, sin centro de asesoría. No se le asigna centro: él mismo se inscribe y paga. Solo falta su matrícula oficial.`,
      enlace: '/admin/alumnos',
    });
  } else {
    // Aquí sí es una anomalía: venía acompañado y se quedó sin centro (lo dieron
    // de baja, lo reasignaron y no llegó). Por eso se pregunta antes de mover
    // nada: puede que ya prefiera seguir solo.
    await notificarATodosLosAdmins({
      tipo: 'alumno_sin_gestor',
      prioridad: 'normal',
      titulo: 'Expediente completo · se quedó sin centro',
      cuerpo: `${alumno.nombre} completó su expediente y ya no tiene centro de asesoría asignado. Confirma con él si quiere que se le asigne otro o prefiere seguir por su cuenta.`,
      enlace: '/admin/alumnos',
    });
  }
}
