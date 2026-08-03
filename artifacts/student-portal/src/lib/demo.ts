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

import { sinPrefijoDeEstado } from './estado';

const FLAG = 'modula_demo_rol';
const FLAG_ESC = 'modula_demo_esc';

/**
 * Dos escenarios, dos momentos del camino:
 *  - 'nuevo'    → alumno recién creado, todo vacío (el tour de bienvenida).
 *  - 'avanzado' → alumno a mitad del ciclo: expediente aprobado, matrícula,
 *    exámenes inscritos, órdenes de pago en cada estado y calificaciones.
 *    Existe para la guía en PDF: sus capturas necesitan pantallas CON datos,
 *    y producirlas desde producción expondría datos de personas reales.
 */
export type DemoEscenario = 'nuevo' | 'avanzado';

export function enableDemo(rol: 'estudiante', escenario: DemoEscenario = 'nuevo'): void {
  try {
    sessionStorage.setItem(FLAG, rol);
    sessionStorage.setItem(FLAG_ESC, escenario);
  } catch { /* sin persistencia */ }
}

export function demoEscenario(): DemoEscenario {
  try { return sessionStorage.getItem(FLAG_ESC) === 'avanzado' ? 'avanzado' : 'nuevo'; } catch { return 'nuevo'; }
}

/**
 * Sesión de FOTOS: el rig de capturas de las guías marca esta bandera para que
 * ningún tutorial arranque encima de la pantalla fotografiada, sin importar el
 * escenario. La pone Playwright vía addInitScript; ninguna pantalla la activa.
 */
export function demoFotos(): boolean {
  try { return sessionStorage.getItem('modula_demo_fotos') === '1'; } catch { return false; }
}

export function disableDemo(): void {
  try {
    sessionStorage.removeItem(FLAG);
    sessionStorage.removeItem(FLAG_ESC);
  } catch { /* ignore */ }
}

export function demoActive(): boolean {
  try {
    if (sessionStorage.getItem(FLAG)) return true;
  } catch { /* ignore */ }
  // La dirección real trae el estado (`/michoacan/demo/estudiante`); hay que
  // quitárselo antes de comparar o el modo demo no se enciende nunca.
  if (typeof window === 'undefined') return false;
  return sinPrefijoDeEstado(window.location.pathname).startsWith('/demo');
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
  gestor: null,
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

// ── Escenario AVANZADO: la misma alumna, a mitad del ciclo ─────────────────
// Etapa ficticia 2699-B: inscripción del 27 al 31 de julio, examen 22-23 de
// agosto de 2026. Fechas fijas a propósito: las capturas de la guía deben
// salir iguales cada vez que se regeneren.

const ETAPA_ABIERTA = {
  id: 990, clave: '2699-B', etapa: 'B', fase: 'inscripcion',
  solicitudInicio: '2026-07-27', solicitudFin: '2026-07-31',
  examenSabado: '2026-08-22', examenDomingo: '2026-08-23',
  estado: 'inscripcion_abierta',
};

const ETAPA_SIGUIENTE = {
  id: 991, clave: '2699-C', etapa: 'C', fase: 'programada',
  solicitudInicio: '2026-09-21', solicitudFin: '2026-09-25',
  examenSabado: '2026-10-17', examenDomingo: '2026-10-18',
  estado: 'programada',
};

const AV_SEDE = {
  nombre: 'Centro de Servicios Morelia',
  direccion: 'Av. Madero Pte. 100, Centro, Morelia, Mich.',
  telefono: '443 111 1111',
  latitud: 19.7036, longitud: -101.1946,
};

const AV_EXAMENES = [
  {
    id: 9001, folio: 'EX-2699B-00311', estado: 'confirmado', pagado: true,
    calificacion: null, paseValidadoEn: null,
    etapa: { clave: '2699-B', examenSabado: '2026-08-22', examenDomingo: '2026-08-23' },
    modulo: { id: 4, numero: 4, nombre: 'Matemáticas y representaciones del sistema natural' },
    fechaExamen: '2026-08-22', hora: '09:00', dia: 'sabado',
    sede: AV_SEDE, // cada examen lleva SU sede: Pagos la pinta por renglón
  },
  {
    id: 9002, folio: 'EX-2699B-00312', estado: 'pre_inscrito', pagado: false,
    calificacion: null, paseValidadoEn: null,
    etapa: { clave: '2699-B', examenSabado: '2026-08-22', examenDomingo: '2026-08-23' },
    modulo: { id: 5, numero: 5, nombre: 'Argumentación' },
    fechaExamen: '2026-08-23', hora: '11:00', dia: 'domingo',
    sede: AV_SEDE,
  },
];

const AV_DASHBOARD = {
  ...DEMO_DASHBOARD,
  kpis: { modulosAprobados: 3, modulosTotales: 21, documentosAprobados: 5, documentosPendientes: 0 },
  siguientesPasos: [
    { texto: 'Paga tu examen de Argumentación antes del vencimiento', urgencia: 'alta' },
    { texto: 'Descarga tu pase para el examen del 22 de agosto', urgencia: 'media' },
  ],
  matriculaOficialDGB: '2026160100482',
  licenciaDigital: 'LIC-2026-00482',
  examenesInscritos: AV_EXAMENES.map((e) => ({
    id: e.id, folio: e.folio, estado: e.estado, pagado: e.pagado,
    moduloNumero: e.modulo.numero, moduloNombre: e.modulo.nombre,
    fechaExamen: e.fechaExamen, dia: e.dia, hora: e.hora,
    sedeNombre: AV_SEDE.nombre, etapaClave: e.etapa.clave,
  })),
};

function docDemo(id: number, nombre: string): unknown {
  return {
    id, estado: 'aprobado', motivoRechazo: null,
    nombreOriginal: nombre, tamanoBytes: 245760, subidoEn: '2026-07-10T10:00:00Z',
  };
}

const AV_EXPEDIENTE = {
  ...DEMO_EXPEDIENTE,
  documentos: {
    curp: docDemo(1, 'CURP_RAMIREZ-LOPEZ-AS_0.pdf'),
    acta_nacimiento: docDemo(2, 'Acta-de-nacimiento_RAMIREZ-LOPEZ-AS_0.pdf'),
    ine: docDemo(3, 'Identificacion-oficial_RAMIREZ-LOPEZ-AS_0.pdf'),
    comprobante_domicilio: docDemo(4, 'Comprobante-de-domicilio_RAMIREZ-LOPEZ-AS_0.pdf'),
    certificado_secundaria: docDemo(5, 'Certificado-de-secundaria_RAMIREZ-LOPEZ-AS_0.pdf'),
    foto: docDemo(6, 'Fotografia_RAMIREZ-LOPEZ-AS_0.jpg'),
  },
  matriculaOficialDGB: '2026160100482',
  matriculaCapturadaEn: '2026-07-15T12:00:00Z',
};

const AV_CONVOCATORIA = {
  gestor: null, // independiente: la guía enseña la auto-inscripción
  etapaActiva: ETAPA_ABIERTA,
  misExamenes: AV_EXAMENES,
  sedeAsignada: AV_SEDE,
  proximasEtapas: [ETAPA_SIGUIENTE],
  requisitos: {
    expedienteCompleto: true,
    documentosFaltantes: [],
    tieneMatricula: true,
    puedeInscribirse: true,
  },
};

// Una orden por estado del ciclo: así la guía enseña el camino completo
// (solicitada → emitida con línea de captura → pagada y confirmada).
const AV_ORDENES = [
  {
    id: 9101, folio: 'OP-2699B-0031', estado: 'pagado',
    concepto: 'Examen: M4 Matemáticas', cantidadExamenes: 1, montoTotal: 131,
    referencia: 'REF-990031', metodoPago: 'banco', lineaCaptura: '9800 0131 4402 8821',
    tieneOrden: true, linkPago: null,
    fechaEmision: '2026-07-27', fechaVencimiento: '2026-08-03', fechaPago: '2026-07-28',
    tieneComprobante: true, motivoRechazo: null,
    examenes: [{ inscripcionId: 9001, folio: 'EX-2699B-00311', moduloNumero: 4, moduloNombre: 'Matemáticas y representaciones del sistema natural' }],
  },
  {
    id: 9102, folio: 'OP-2699B-0032', estado: 'emitida',
    concepto: 'Examen: M5 Argumentación', cantidadExamenes: 1, montoTotal: 131,
    referencia: null, metodoPago: null, lineaCaptura: '9800 0131 4402 8834',
    tieneOrden: true, linkPago: 'https://tesoreria.michoacan.gob.mx/pago-demo',
    fechaEmision: '2026-07-28', fechaVencimiento: '2026-08-04', fechaPago: null,
    tieneComprobante: false, motivoRechazo: null,
    examenes: [{ inscripcionId: 9002, folio: 'EX-2699B-00312', moduloNumero: 5, moduloNombre: 'Argumentación' }],
  },
  {
    id: 9103, folio: 'OP-2699B-0033', estado: 'pendiente_emision',
    concepto: 'Examen: pendiente de emitir', cantidadExamenes: 1, montoTotal: 131,
    referencia: null, metodoPago: null, lineaCaptura: null,
    tieneOrden: false, linkPago: null,
    fechaEmision: null, fechaVencimiento: null, fechaPago: null,
    tieneComprobante: false, motivoRechazo: null,
    examenes: [],
  },
];

function califRow(id: number, moduloId: number, numero: number, nombre: string, clave: string, calif: number, fecha: string): unknown {
  return {
    id, moduloId, etapaClave: clave, calificacion: calif, aciertos: null,
    aprobado: calif >= 60, intento: 1, fechaExamen: fecha, notas: null,
    createdAt: fecha + 'T18:00:00Z', moduloNumero: numero, moduloNombre: nombre,
  };
}

const AV_CALIFICACIONES = {
  calificacionesExamen: [
    {
      inscripcionId: 9001, folio: 'EX-2699B-00311', moduloNumero: 4,
      moduloNombre: 'Matemáticas y representaciones del sistema natural',
      calificacion: null, aciertos: null, aprobado: null,
      fechaExamen: '2026-08-22', capturada: false, enProceso: true,
    },
  ],
  modulosAprobados: [
    califRow(9201, 1, 1, 'De la información al conocimiento', '2699-A', 84, '2026-06-13'),
    califRow(9202, 2, 2, 'Textos y visiones del mundo', '2699-A', 76, '2026-06-13'),
    califRow(9203, 3, 3, 'Mi mundo en otra lengua', '2699-A', 91, '2026-06-14'),
  ],
  historial: [
    califRow(9201, 1, 1, 'De la información al conocimiento', '2699-A', 84, '2026-06-13'),
    califRow(9202, 2, 2, 'Textos y visiones del mundo', '2699-A', 76, '2026-06-13'),
    califRow(9203, 3, 3, 'Mi mundo en otra lengua', '2699-A', 91, '2026-06-14'),
  ],
  resumen: { totalAprobados: 3, promedioGlobal: 83.7, examenesPresentados: 3, porcentajeAvance: 14 },
  pdfOficial: { disponible: false, subidoEn: null },
};

const AV_IDENTIFICACION = {
  tieneIdentificacion: true,
  tieneFoto: true,
  identificacion: {
    nombreCompleto: 'Ana Sofía Ramírez López',
    nombre: 'Ana Sofía', apellidos: 'Ramírez López',
    curp: 'RALA060214MMNMPN08', curpMask: 'RALA****MMNMPN**',
    sede: 'Morelia', matriculaOficialDGB: '2026160100482',
    folio: 'LIC-2026-00482', licenciaEmitidaEn: '2026-07-15',
    emision: '2026-07-15', vigencia: '2027-07-15',
    vencida: false, diasParaVencer: 349,
    plan: 'Plan 22', modulosAprobados: 3, modulosTotales: 22,
    verifyUrl: 'https://prepa.modula22.mx/verificar/DEMO',
  },
};

const AV_PASE = {
  folio: 'EX-2699B-00311', estado: 'confirmado', pagado: true,
  paseValidadoEn: null, calificacion: null,
  etapa: { clave: '2699-B', examenSabado: '2026-08-22', examenDomingo: '2026-08-23' },
  estudiante: { nombreCompleto: 'Ana Sofía Ramírez López', curp: 'RALA060214MMNMPN08' },
  modulo: { numero: 4, nombre: 'Matemáticas y representaciones del sistema natural' },
  fechaExamen: '2026-08-22', hora: '09:00', dia: 'sabado',
  sede: AV_SEDE,
  qrPayload: 'MODULA22-DEMO-NO-VALIDO',
};

const AV_MODULOS = {
  planDesbloqueado: true,
  modulos: [
    { id: 4, numero: 4, nombre: 'Matemáticas y representaciones del sistema natural', nivel: 'basico', inscrito: true, aprobado: false, quizzes: 2, promedio: 72 },
    { id: 5, numero: 5, nombre: 'Argumentación', nivel: 'basico', inscrito: true, aprobado: false, quizzes: 1, promedio: 80 },
  ],
  resumen: { totalModulos: 21, totalInscritos: 2, aprobados: 3, enCurso: 2, totalQuizzes: 3, promedioGlobal: 76 },
};

// El bloque "módulos disponibles para inscribir" pide el calendario del mes de
// la etapa. Se ofrecen unos cuantos módulos por horario, suficientes para la
// captura de la guía; `yaInscritoEnModulos` refleja los dos ya inscritos.
const AV_CALENDARIO_MES = {
  mes: '2026-08',
  etapas: [
    {
      ...ETAPA_ABIERTA,
      inscripcionAbierta: true,
      diasRestantesParaInscribirse: 2,
      horariosDisponibles: {
        sabado: {
          '09:00': [
            { id: 4, numero: 4, nombre: 'Matemáticas y representaciones del sistema natural' },
            { id: 6, numero: 6, nombre: 'Ser social y sociedad' },
          ],
          '11:00': [
            { id: 7, numero: 7, nombre: 'Universo natural' },
          ],
        },
        domingo: {
          '09:00': [
            { id: 8, numero: 8, nombre: 'Mi vida en otra lengua' },
          ],
          '11:00': [
            { id: 5, numero: 5, nombre: 'Argumentación' },
          ],
        },
      },
      yaInscritoEnModulos: [4, 5],
    },
  ],
};

const AV_SEDES_ETAPA = {
  sedes: [
    {
      id: 1, nombre: 'Centro de Servicios Morelia',
      direccion: 'Av. Madero Pte. 100, Centro, Morelia, Mich.',
      telefono: '443 111 1111', municipio: 'Morelia',
      latitud: 19.7036, longitud: -101.1946, sugerida: true,
    },
    {
      id: 2, nombre: 'Centro de Servicios Uruapan',
      direccion: 'Av. Latinoamericana 500, Uruapan, Mich.',
      telefono: '452 111 1111', municipio: 'Uruapan',
      latitud: 19.4167, longitud: -102.0667, sugerida: false,
    },
  ],
};

// Compartidos por ambos escenarios (la pantalla es la misma con o sin avance).
const DEMO_CALENDARIO = {
  hoy: '2026-07-29', // dentro de la ventana: la cuadrícula sale con ella abierta
  etapas: [
    { ...ETAPA_ABIERTA, estado: 'inscripcion' },
    { ...ETAPA_SIGUIENTE, estado: 'programada' },
  ],
};

const DEMO_FAQ = {
  preguntas: [
    { id: 1, pregunta: '¿Cuánto cuesta el examen?', respuesta: 'Cada examen cuesta $131. La orden de pago la emite la Tesorería del Estado y se paga en banco, tienda o en línea.', categoria: 'Pagos', principal: true },
    { id: 2, pregunta: '¿Cuándo puedo inscribirme?', respuesta: 'Solo dentro de la ventana de inscripción de cada etapa (4 a 5 días). Consulta el Calendario para ver las fechas.', categoria: 'Inscripción', principal: true },
    { id: 3, pregunta: '¿Qué documentos necesita mi expediente?', respuesta: 'Cinco: CURP, acta de nacimiento, identificación, comprobante de domicilio y certificado de secundaria, más tu fotografía.', categoria: 'Documentos', principal: true },
    { id: 4, pregunta: '¿Qué llevo el día del examen?', respuesta: 'Tu pase de examen con código QR (se descarga en ID) y una identificación. Llega con anticipación a tu sede.', categoria: 'Examen', principal: false },
    { id: 5, pregunta: '¿Con cuánto apruebo un módulo?', respuesta: 'Con 60 o más. El Plan 22 se completa aprobando los 22 módulos.', categoria: 'Calificaciones', principal: false },
  ],
};

const DEMO_CONTACTO_PUBLICO = {
  nombre: 'Coordinación de Preparatoria Abierta Michoacán',
  correo: 'contacto@ejemplo.mx',
  telefono: '+52 443 111 1111',
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
  const av = demoEscenario() === 'avanzado';
  switch (true) {
    case p === '/auth/me':                    return { hit: true, data: DEMO_ME };
    case p === '/estudiante/dashboard':       return { hit: true, data: av ? AV_DASHBOARD : DEMO_DASHBOARD };
    case p === '/estudiante/avisos':          return { hit: true, data: DEMO_AVISOS };
    case p === '/estudiante/contactos':       return { hit: true, data: DEMO_CONTACTOS };
    case p === '/estudiante/expediente':      return { hit: true, data: av ? AV_EXPEDIENTE : DEMO_EXPEDIENTE };
    case p.startsWith('/estudiante/convocatoria/pase/'): return { hit: true, data: AV_PASE };
    case p === '/estudiante/convocatoria/calendario': return { hit: true, data: av ? AV_CALENDARIO_MES : { mes: '', etapas: [] } };
    case p.startsWith('/estudiante/convocatoria/sedes/'): return { hit: true, data: av ? AV_SEDES_ETAPA : { sedes: [] } };
    case p === '/estudiante/convocatoria':    return { hit: true, data: av ? AV_CONVOCATORIA : DEMO_CONVOCATORIA };
    case p === '/estudiante/config-pago':     return { hit: true, data: DEMO_CONFIG_PAGO };
    case p === '/estudiante/modulos':         return { hit: true, data: av ? AV_MODULOS : DEMO_MODULOS };
    case p === '/estudiante/mi-identificacion': return { hit: true, data: av ? AV_IDENTIFICACION : DEMO_IDENTIFICACION };
    case p === '/pagos-examen/mios':          return { hit: true, data: { pagos: av ? AV_ORDENES : [] } };
    case p.startsWith('/pagos/estudiantes/'): return { hit: true, data: { pagos: [] } };
    case p.startsWith('/calificaciones/estudiantes/'): return { hit: true, data: av ? AV_CALIFICACIONES : DEMO_CALIFICACIONES };
    case p === '/anuncios/calendario-etapas': return { hit: true, data: DEMO_CALENDARIO };
    case p === '/faq':                        return { hit: true, data: DEMO_FAQ };
    case p === '/publico/contacto':           return { hit: true, data: DEMO_CONTACTO_PUBLICO };
    case p === '/chat/mi-conversacion':       return { hit: true, data: { mensajes: [] } };
    case p === '/anuncios/mios':              return { hit: true, data: { anuncios: [] } };
    case p === '/notificaciones/contador':    return { hit: true, data: { noLeidas: 0 } };
    case p.startsWith('/notificaciones'):     return { hit: true, data: { notificaciones: [] } };
    default:                                  return { hit: false };
  }
}
