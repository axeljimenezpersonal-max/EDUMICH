/**
 * MODO DEMO — "así se ve el ingreso de un alumno nuevo".
 *
 * Cuando está activo, `api.request` (ver api.ts) intercepta un conjunto acotado
 * de endpoints GET y devuelve datos ficticios de un estudiante recién creado,
 * sin tocar el backend ni requerir sesión. Sirve para mostrar el portal y el
 * tour de bienvenida tal como los vería un alumno al entrar por primera vez.
 *
 * El modo se activa desde la ruta /demo/estudiante y persiste en sessionStorage
 * mientras dure la pestaña (para que la navegación no rebote a /login).
 */

const FLAG = 'modula_demo_rol';

export function enableDemo(rol: 'estudiante'): void {
  try { sessionStorage.setItem(FLAG, rol); } catch { /* sin persistencia */ }
}

export function disableDemo(): void {
  try { sessionStorage.removeItem(FLAG); } catch { /* ignore */ }
}

export function demoActive(): boolean {
  try {
    if (sessionStorage.getItem(FLAG)) return true;
  } catch { /* ignore */ }
  return typeof window !== 'undefined' && window.location.pathname.startsWith('/demo');
}

// ── Datos ficticios de un alumno NUEVO ─────────────────────────
const DEMO_ME = {
  id: 0,
  email: 'alumno.demo@edumich.mx',
  rol: 'estudiante',
  passwordTemporal: false,
  perfil: {
    nombreCompleto: 'Ana Sofía Ramírez López',
    municipio: 'Morelia',
  },
};

const DEMO_DASHBOARD = {
  estudiante: {
    nombreCompleto: 'Ana Sofía Ramírez López',
    curp: 'RALA060214MMNMPN08',
    email: 'alumno.demo@edumich.mx',
    municipio: 'Morelia',
  },
  inscripcionActiva: null,
  kpis: {
    modulosAprobados: 0,
    modulosTotales: 21,
    documentosAprobados: 0,
    documentosPendientes: 5,
  },
  siguientesPasos: [
    { texto: 'Sube tus 5 documentos obligatorios en tu Expediente', urgencia: 'alta' },
    { texto: 'Agrega tu fotografía para tu credencial', urgencia: 'media' },
    { texto: 'Inscríbete a los módulos de la convocatoria activa', urgencia: 'baja' },
  ],
  avisosNoLeidos: 1,
  folioPreregistro: 'PRE-2026-000482',
  preregistroVigenteHasta: '2026-08-31',
  matriculaOficialDGB: null,
  licenciaDigital: null,
  avisoEliminacion: null,
  examenesInscritos: [],
};

const DEMO_AVISOS = [
  {
    id: 1,
    titulo: '¡Bienvenida a Preparatoria Abierta Michoacán!',
    contenido:
      'Nos da mucho gusto tenerte. Empieza por completar tu expediente; cualquier duda, escríbenos por Mensajes.',
    prioridad: 'informativo',
    publicadoEn: '2026-07-07',
    activoHasta: null,
    leido: false,
  },
];

const DEMO_EXPEDIENTE = {
  datosPersonales: {
    nombreCompleto: 'Ana Sofía Ramírez López',
    curp: 'RALA060214MMNMPN08',
    fechaNacimiento: '2006-02-14',
    telefono: '443 000 0000',
    direccion: 'Av. Madero Pte. 100, Centro, Morelia',
    municipio: 'Morelia',
  },
  documentos: {},
  matriculaOficialDGB: null,
  matriculaCapturadaEn: null,
  folioPreregistro: 'PRE-2026-000482',
};

const DEMO_CONFIG_PAGO = { costoExamen: 131, datosBancarios: null };

const DEMO_CONVOCATORIA = {
  etapaActiva: null,
  misExamenes: [],
  sedeAsignada: null,
  proximasEtapas: [],
  requisitos: {
    expedienteCompleto: false,
    documentosFaltantes: [
      'CURP', 'Acta de nacimiento', 'Identificación oficial',
      'Comprobante de domicilio', 'Certificado de secundaria',
    ],
    tieneMatricula: false,
    puedeInscribirse: false,
  },
};

const DEMO_MODULOS = {
  planDesbloqueado: false,
  modulos: [],
  resumen: {
    totalModulos: 21,
    totalInscritos: 0,
    aprobados: 0,
    enCurso: 0,
    totalQuizzes: 0,
    promedioGlobal: 0,
  },
};

const DEMO_CALIFICACIONES = {
  calificacionesExamen: [],
  modulosAprobados: [],
  historial: [],
  resumen: { totalAprobados: 0, promedioGlobal: 0, examenesPresentados: 0, porcentajeAvance: 0 },
  pdfOficial: { disponible: false, subidoEn: null },
};

const DEMO_IDENTIFICACION = { tieneIdentificacion: false, tieneFoto: false };

const DEMO_CONTACTOS = {
  gestor: {
    nombreCompleto: 'Lic. Jorge Medina Sánchez',
    emailPublico: 'gestor.morelia@edumich.mx',
    telefonoPublico: '443 000 0000',
    municipio: 'Morelia',
  },
  admin: {
    nombreCompleto: 'Coordinación Estatal Modula',
    puesto: 'Administración de Preparatoria Abierta',
    emailPublico: 'contacto@edumich.mx',
    telefonoPublico: '443 111 1111',
  },
};

/**
 * Devuelve `{ hit: true, data }` si el modo demo debe responder a este GET.
 * `hit: false` deja pasar la petición al backend real.
 */
export function demoResponse(path: string, method: string): { hit: boolean; data?: unknown } {
  if (!demoActive()) return { hit: false };
  if (method && method.toUpperCase() !== 'GET') {
    // En demo no se persiste nada: los POST/PUT devuelven algo benigno.
    return { hit: true, data: {} };
  }

  const p = path.split('?')[0];
  switch (true) {
    case p === '/auth/me':                    return { hit: true, data: DEMO_ME };
    case p === '/estudiante/dashboard':       return { hit: true, data: DEMO_DASHBOARD };
    case p === '/estudiante/avisos':          return { hit: true, data: DEMO_AVISOS };
    case p === '/estudiante/contactos':       return { hit: true, data: DEMO_CONTACTOS };
    case p === '/estudiante/expediente':      return { hit: true, data: DEMO_EXPEDIENTE };
    case p === '/estudiante/convocatoria':    return { hit: true, data: DEMO_CONVOCATORIA };
    case p === '/estudiante/config-pago':     return { hit: true, data: DEMO_CONFIG_PAGO };
    case p === '/estudiante/modulos':         return { hit: true, data: DEMO_MODULOS };
    case p === '/estudiante/mi-identificacion': return { hit: true, data: DEMO_IDENTIFICACION };
    case p === '/pagos-examen/mios':          return { hit: true, data: { pagos: [] } };
    case p.startsWith('/pagos/estudiantes/'): return { hit: true, data: { pagos: [] } };
    case p.startsWith('/calificaciones/estudiantes/'): return { hit: true, data: DEMO_CALIFICACIONES };
    case p === '/chat/mi-conversacion':       return { hit: true, data: { mensajes: [] } };
    case p === '/anuncios/mios':              return { hit: true, data: { anuncios: [] } };
    case p === '/notificaciones/contador':    return { hit: true, data: { noLeidas: 0 } };
    case p.startsWith('/notificaciones'):     return { hit: true, data: { notificaciones: [] } };
    default:                                  return { hit: false };
  }
}
