/**
 * Cliente HTTP simple — Preparatoria Abierta Michoacán
 * Manda credentials para que la cookie de sesión viaje en cada request.
 *
 * Ubicación destino en Replit: artifacts/student-portal/src/lib/api.ts
 */

import { demoResponse } from './demo';

const API_BASE = '/api';

/** Zod-style issue returned by the server on 400 validation errors */
export interface ApiFieldError {
  path: string[];
  message: string;
}

/** Error thrown by api.* calls. Includes field-level `detalles` when the
 *  server returns a 400 with a `detalles` array (Zod validation errors). */
export class ApiError extends Error {
  status: number;
  detalles: ApiFieldError[];

  constructor(msg: string, status: number, detalles?: ApiFieldError[]) {
    super(msg);
    this.name = 'ApiError';
    this.status = status;
    this.detalles = detalles ?? [];
  }

  /** Returns a `{ fieldName: errorMessage }` map for easy use in forms */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const d of this.detalles) {
      const key = d.path[0];
      if (key && !out[key]) out[key] = d.message;
    }
    return out;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  // Modo demo: intercepta endpoints con datos ficticios de un alumno nuevo.
  const demo = demoResponse(path, init.method ?? 'GET');
  if (demo.hit) return demo.data as T;

  // Timeout de seguridad: si el servidor no responde (p. ej. durante un
  // redeploy), abortamos en vez de dejar el spinner girando indefinidamente.
  const controller = new AbortController();
  const timeoutMs = 90_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: 'include',
      signal: init.signal ?? controller.signal,
      headers: {
        ...(init.body && !(init.body instanceof FormData)
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...init.headers,
      },
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new ApiError('La solicitud tardó demasiado (posible reinicio del servidor). Inténtalo de nuevo.', 0);
    }
    throw new ApiError('No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.', 0);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    let msg = `${res.status}`;
    let detalles: ApiFieldError[] | undefined;
    try {
      const j = await res.json();
      msg = j.error || msg;
      if (Array.isArray(j.detalles)) detalles = j.detalles;
    } catch {}
    throw new ApiError(msg, res.status, detalles);
  }
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
    }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PUT',
      body: JSON.stringify(body ?? {}),
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body ?? {}),
    }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

// ── Tipos ──────────────────────────────────────────────────────
export type Rol = 'admin' | 'gestor' | 'estudiante' | 'direccion';

export interface MeResponse {
  id: number;
  email: string;
  rol: Rol;
  passwordTemporal: boolean;
  perfil: {
    nombreCompleto?: string;
    municipio?: string;
    municipioId?: number;
    telefono?: string;
  };
}

export interface DashboardGestor {
  municipio: string;
  gestorNombre: string;
  kpis: {
    alumnosTotales: number;
    alumnosConInscripcion: number;
    documentosPendientes: number;
  };
}

export interface AlumnoListItem {
  userId: number;
  nombreCompleto: string;
  curp: string;
  telefono: string | null;
  createdAt: string;
  inscripcion: {
    id: number;
    estado: string;
    convocatoriaNombre: string | null;
  } | null;
  obligAprobados: number;
  obligRechazados: number;
  obligTotal: number;
  opcionalesFaltantes: number;
  estadoProceso: 'documento_rechazado' | 'faltan_documentos' | 'listo_inscribir' | 'pago_pendiente' | 'al_corriente';
  modulosPorPagar: number;
  modulosInscritos: number;
}

export interface DocumentoItem {
  id: number;
  nombre: string;
  archivoOriginal: string;
  tipoSugerido: string | null;
  estado: 'pendiente_revision' | 'aprobado' | 'rechazado';
  comentarioAdmin: string | null;
  createdAt: string;
}

export interface AlumnoDetalle {
  alumno: {
    userId: number;
    nombreCompleto: string;
    curp: string;
    fechaNacimiento: string | null;
    telefono: string | null;
    direccion: string | null;
    email: string;
    createdAt: string;
    passwordTemporal: boolean;
    bienvenidaEnviadaEn: string | null;
  };
  inscripciones: Array<{
    id: number;
    estado: string;
    convocatoria: string | null;
    convocatoriaId: number;
    createdAt: string;
  }>;
  documentos: DocumentoItem[];
}

export interface Convocatoria {
  id: number;
  nombre: string;
  fechaApertura: string;
  fechaCierre: string;
  fechaExamen: string | null;
  estado: string;
}

export interface SiguientePaso {
  texto: string;
  urgencia: 'baja' | 'media' | 'alta';
}

export interface ExamenInscritoDashboard {
  id: number;
  folio: string;
  estado: string;
  pagado: boolean;
  moduloNumero: number;
  moduloNombre: string;
  fechaExamen: string | null;
  dia: string;
  hora: string;
  sedeNombre: string;
  etapaClave: string;
}

export interface DashboardEstudiante {
  estudiante: {
    nombreCompleto: string;
    curp: string;
    email: string;
    municipio: string;
  };
  inscripcionActiva: {
    id: number;
    estado: string;
    convocatoriaNombre: string;
    fechaCierre: string | null;
    fechaExamen: string | null;
  } | null;
  kpis: {
    modulosAprobados: number;
    modulosTotales: number;
    documentosAprobados: number;
    documentosPendientes: number;
  };
  siguientesPasos: SiguientePaso[];
  avisosNoLeidos: number;
  folioPreregistro: string | null;
  preregistroVigenteHasta: string | null;
  matriculaOficialDGB: string | null;
  licenciaDigital: string | null;
  avisoEliminacion: {
    estadoCuenta: string;
    avisoEnviadoEn: string | null;
    diasRestantes: number;
    diasInactivo: number;
  } | null;
  examenesInscritos: ExamenInscritoDashboard[];
}

export interface Aviso {
  id: number;
  titulo: string;
  contenido: string;
  prioridad: 'informativo' | 'importante' | 'urgente';
  publicadoEn: string;
  activoHasta: string | null;
  leido: boolean;
}

// ── Módulos ─────────────────────────────────────────────────────────────
export type ProgresoEstado = 'no_iniciado' | 'en_curso' | 'aprobado';

export interface TemaDebil {
  tema: string;
  correctas: number;
  total: number;
}

export interface ProgresoModulo {
  estado: ProgresoEstado;
  intentosQuiz: number;
  mejorCalificacion: number | null;
  ultimaCalificacion: number | null;
  temasDebiles?: TemaDebil[] | null;
}

export interface ModuloListItem {
  id: number;
  numero: number;
  nivel: number | null;
  nombre: string;
  descripcionCorta: string | null;
  inscritoExamen: boolean;
  pagado: boolean;
  estadoExamen: string | null;
  progreso: ProgresoModulo;
}

export interface MisModulosResponse {
  planDesbloqueado: boolean;
  modulos: ModuloListItem[];
  resumen: {
    totalModulos: number;
    totalInscritos: number;
    aprobados: number;
    enCurso: number;
    totalQuizzes: number;
    promedioGlobal: number;
  };
}

export interface GestorPlanModularModulo {
  id: number;
  numero: number;
  nombre: string;
  nivel: number | null;
  enPlan: boolean;
}

export interface GestorPlanModularResponse {
  inscripcionId: number | null;
  modulos: GestorPlanModularModulo[];
}

export interface TemaNode {
  id: number;
  titulo: string;
  parentId: number | null;
  orden: number;
  subtemas: TemaNode[];
}

export interface UnidadDetalle {
  id: number;
  numero: number;
  titulo: string;
  proposito: string;
  temas: TemaNode[];
}

export interface MaterialModulo {
  id: number;
  tipo: string;
  nombre: string;
  tamanoBytes: number | null;
  urlDescarga: string;
}

export interface ModuloDetalleResponse {
  modulo: {
    id: number;
    numero: number;
    nivel: number | null;
    nombre: string;
    descripcionCorta: string | null;
    totalPreguntas: number | null;
    tiempoEstimadoMin: number | null;
  };
  unidades: UnidadDetalle[];
  materiales: MaterialModulo[];
  progreso: ProgresoModulo;
  intentosRecientes: unknown[];
  areasOportunidad: unknown[];
}

export interface ContactosResponse {
  gestor: {
    nombreCompleto: string;
    emailPublico: string | null;
    telefonoPublico: string | null;
    municipio: string | null;
  } | null;
  admin: {
    nombreCompleto: string;
    puesto: string | null;
    emailPublico: string | null;
    telefonoPublico: string | null;
  } | null;
}

// ── Convocatoria ──────────────────────────────────────────────────────────

export interface EtapaConvocatoria {
  id: number;
  clave: string;
  etapa: string;
  fase: string;
  solicitudInicio: string;
  solicitudFin: string;
  examenSabado: string;
  examenDomingo: string;
  estado: string;
}

export interface ExamenInscrito {
  id: number;
  folio: string;
  estado: string;
  pagado: boolean;
  calificacion: number | null;
  paseValidadoEn: string | null;
  etapa: { clave: string; examenSabado: string; examenDomingo: string };
  modulo: { id: number; numero: number; nombre: string };
  fechaExamen: string;
  hora: string;
  dia: string;
  sede: { nombre: string; direccion: string; latitud: number | null; longitud: number | null };
}

export interface ConvocatoriaResponse {
  etapaActiva: EtapaConvocatoria | null;
  misExamenes: ExamenInscrito[];
  sedeAsignada: {
    nombre: string;
    direccion: string;
    telefono: string | null;
    latitud: number | null;
    longitud: number | null;
  } | null;
  proximasEtapas: EtapaConvocatoria[];
  requisitos: {
    expedienteCompleto: boolean;
    documentosFaltantes: string[];
    tieneMatricula?: boolean;
    puedeInscribirse: boolean;
  };
}

export interface CalendarioMes {
  mes: string;
  etapas: Array<
    EtapaConvocatoria & {
      inscripcionAbierta: boolean;
      diasRestantesParaInscribirse: number;
      horariosDisponibles: {
        sabado: {
          '09:00': Array<{ id: number; numero: number; nombre: string }>;
          '11:00': Array<{ id: number; numero: number; nombre: string }>;
        };
        domingo: {
          '09:00': Array<{ id: number; numero: number; nombre: string }>;
          '11:00': Array<{ id: number; numero: number; nombre: string }>;
        };
      };
      yaInscritoEnModulos: number[];
    }
  >;
}

export interface PaseExamenData {
  folio: string;
  estado: string;
  pagado: boolean;
  paseValidadoEn: string | null;
  calificacion: number | null;
  etapa: { clave: string; examenSabado: string; examenDomingo: string };
  estudiante: { nombreCompleto: string; curp: string };
  modulo: { numero: number; nombre: string };
  fechaExamen: string;
  hora: string;
  dia: string;
  sede: {
    nombre: string;
    direccion: string;
    telefono: string | null;
    latitud: number | null;
    longitud: number | null;
  };
  qrPayload: string;
}

// ── Expediente ────────────────────────────────────────────────────────────
export type ExpedienteDocEstado = 'pendiente_revision' | 'aprobado' | 'rechazado';

export type TipoDocumento =
  | 'curp'
  | 'acta_nacimiento'
  | 'ine'
  | 'comprobante_domicilio'
  | 'foto'
  | 'certificado_secundaria'
  | 'comprobante_pago';

export interface GestorExpedienteResponse {
  documentos: Partial<Record<TipoDocumento, DocExpediente>>;
}

export interface DocExpediente {
  id: number;
  estado: ExpedienteDocEstado;
  motivoRechazo: string | null;
  nombreOriginal: string;
  tamanoBytes: number | null;
  subidoEn: string;
}

export interface ExpedienteResponse {
  datosPersonales: {
    nombreCompleto: string;
    curp: string;
    fechaNacimiento: string | null;
    telefono: string;
    direccion: string;
    municipio: string;
  };
  documentos: Partial<Record<TipoDocumento, DocExpediente>>;
  matriculaOficialDGB: string | null;
  matriculaCapturadaEn: string | null;
  folioPreregistro: string | null;
}

// ── Cédula de inscripción ───────────────────────────────────────────────────
export interface CedulaDatos {
  matricula: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombres: string;
  nombreCompleto: string;
  curp: string;
  fechaNacimiento: string;
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

/** Campos editables de la cédula (los que se guardan). */
export type CedulaDatosEditable = Pick<
  CedulaDatos,
  | 'apellidoPaterno' | 'apellidoMaterno' | 'nombres' | 'sexo' | 'estadoCivil'
  | 'lugarNacimiento' | 'entidadNacimiento' | 'calleNumero' | 'colonia'
  | 'cp' | 'ciudad' | 'estado' | 'ultimoEstudio' | 'observaciones'
>;

// ── Firmas reutilizables (hasta 2 + cuál está activa) ───────────────────────
export interface FirmaResponse {
  firma1: string | null;
  firma2: string | null;
  activa: number; // 1 | 2
}

// ── Pagos ─────────────────────────────────────────────────────────────────
export type PagoConcepto =
  | 'derecho_examen'
  | 'examen_extraordinario'
  | 'reposicion_credencial'
  | 'duplicado_acta'
  | 'otro';

export type PagoMetodo =
  | 'spei'
  | 'banco_deposito'
  | 'tienda_conveniencia'
  | 'otro';

export type PagoEstado = 'pendiente' | 'verificado' | 'rechazado';

export interface Pago {
  id: number;
  estudianteId?: number;
  concepto: PagoConcepto;
  conceptoDetalle: string | null;
  monto: string;       // numeric from DB, comes as string
  moneda: string;
  fechaPago: string;
  metodoPago: PagoMetodo;
  referenciaBancaria: string | null;
  notas: string | null;
  nombreComprobante: string | null;
  tamanoBytes: number | null;
  estado: PagoEstado;
  motivoRechazo: string | null;
  subidoPorUserId: number;
  subidoPorEmail?: string | null;
  verificadoEn: string | null;
  createdAt: string;
  // admin list only
  nombreEstudiante?: string;
  curpEstudiante?: string | null;
}

export interface PagosResponse {
  pagos: Pago[];
  resumen: {
    totalPagado: number;
    verificados: number;
    pendientes: number;
    rechazados: number;
  };
}

// ── Anuncios ──────────────────────────────────────────────────────────────
export type AnuncioPrioridad = 'informativo' | 'importante' | 'urgente';
export type AnuncioAudiencia = 'todos' | 'alumnos' | 'gestores' | 'alumnos_municipio' | 'alumnos_etapa' | 'gestor_especifico';
export type AnuncioEstado = 'borrador' | 'publicado' | 'archivado';

export interface AnuncioMio {
  id: number;
  titulo: string;
  contenido: string;
  prioridad: AnuncioPrioridad;
  ctaTexto: string | null;
  ctaUrl: string | null;
  publicadoEn: string | null;
  activoHasta: string | null;
  yaVisto: boolean;
}

export interface AnuncioAdmin {
  id: number;
  titulo: string;
  contenido: string;
  prioridad: AnuncioPrioridad;
  audiencia: AnuncioAudiencia;
  audienciaParam: string | null;
  estado: AnuncioEstado;
  ctaTexto: string | null;
  ctaUrl: string | null;
  publicadoEn: string | null;
  activoHasta: string | null;
  createdAt: string;
}

// ── Calificaciones ────────────────────────────────────────────────────────
export interface CalifRow {
  id: number;
  moduloId: number;
  etapaClave: string;
  calificacion: number;
  aprobado: boolean;
  intento: number;
  fechaExamen: string;
  notas: string | null;
  createdAt: string;
  moduloNumero: number | null;
  moduloNombre: string | null;
  moduloNivel: number | null;
  sedeNombre: string | null;
}

// CALIFICACIONES = examen pagado (con folio) + su calificación (capturada por admin)
export interface CalificacionExamen {
  inscripcionId: number;
  folio: string;
  moduloNumero: number;
  moduloNombre: string;
  calificacion: number | null;
  aprobado: boolean | null;
  fechaExamen: string | null;
  capturada: boolean;
}

export interface CalificacionesResponse {
  calificacionesExamen?: CalificacionExamen[];
  modulosAprobados: CalifRow[];
  historial: CalifRow[];
  resumen: {
    totalAprobados: number;
    promedioGlobal: number;
    examenesPresentados: number;
    porcentajeAvance: number;
  };
  pdfOficial?: { disponible: boolean; subidoEn: string | null };
}

// ── Pagos grupales (gestor paga N exámenes ante Tesorería) ─────────────────
export type PagoGrupalEstado = 'pendiente_comprobante' | 'en_revision' | 'verificado' | 'rechazado';

export interface PagoGrupalResumen {
  id: number;
  folio: string;
  cantidadExamenes: number;
  montoUnitario?: number;
  montoTotal: number;
  estado: PagoGrupalEstado;
  tieneComprobante: boolean;
  fechaPago: string | null;
  motivoRechazo?: string | null;
  creadoEn: string;
  gestorNombre?: string;
  municipio?: string | null;
}

export interface PagoGrupalExamenItem {
  alumno: string | null;
  curp?: string | null;
  folioExamen: string | null;
  moduloNumero: number | null;
  moduloNombre: string | null;
  monto: number;
}

export interface PagoGrupalDetalle extends PagoGrupalResumen {
  montoUnitario: number;
  examenes: PagoGrupalExamenItem[];
  nombreComprobante?: string | null;
  gestor?: { nombre: string; municipio: string | null };
}

export interface ExamenDisponible {
  id: number;
  folio: string;
  estudianteId: number;
  alumno: string;
  moduloId: number;
  moduloNumero: number;
  moduloNombre: string;
}

// ── Config pago gestor ────────────────────────────────────────────────────

export interface GestorDatosBancarios {
  banco: string;
  titular: string;
  clabe: string;
  numeroCuenta: string | null;
  rfc: string | null;
  convenio: string | null;
}

export interface GestorConfigPagoResponse {
  costoExamen: number;
  datosBancarios: GestorDatosBancarios | null;
}

// ── Convocatoria gestor ────────────────────────────────────────────────────

export interface GestorConvocatoriaEtapa {
  id: number;
  clave: string;
  etapa: string;
  fase: string;
  solicitudInicio: string;
  solicitudFin: string;
  examenSabado: string;
  examenDomingo: string;
  estado: string;
}

export interface GestorConvocatoriaModulo {
  id: number;
  numero: number;
  nombre: string;
  nivel: number | null;
  horarioId: number;
  dia: string;   // 'sabado' | 'domingo'
  hora: string;  // '09:00' | '11:00'
  yaInscrito: boolean;
}

export interface GestorConvocatoriaInscripcion {
  id: number;
  folio: string;
  moduloId: number;
  moduloNumero: number;
  moduloNombre: string;
  dia: string;
  hora: string;
  fechaExamen: string;
  estado: string;
  pagoEstado?: 'pagado' | 'en_pago' | 'sin_pagar';
  pagoFolio?: string | null;
  sede: { nombre: string; direccion: string };
}

export interface GestorConvocatoriaPago {
  id: number;
  estado: string;
  monto: string;
  fechaPago: string;
  createdAt: string;
}

export interface GestorConvocatoriaResponse {
  etapa: GestorConvocatoriaEtapa | null;
  modulosDisponibles: GestorConvocatoriaModulo[];
  inscripcionesActivas: GestorConvocatoriaInscripcion[];
  sede: { nombre: string; direccion: string; telefono: string | null } | null;
  costoExamen: number;
  pagoDerechos: GestorConvocatoriaPago | null;
}

// ── Banco de preguntas / Quiz ──────────────────────────────────────────────

export type Dificultad = 'facil' | 'media' | 'alta';

/** Una pregunta sin respuesta correcta (para el alumno durante el quiz) */
export interface PreguntaQuiz {
  id: number;
  preguntaDocId: string;
  unidadNum: number;
  tema: string;
  dificultad: Dificultad;
  pregunta: string;
  opcionA: string;
  opcionB: string;
  opcionC: string;
  opcionD: string;
  paraRepasar: string | null;
}

export interface QuizResponse {
  moduloNum: number;
  total: number;
  preguntas: PreguntaQuiz[];
}

/** Una pregunta corregida con retroalimentación (para resultados) */
export interface PreguntaFeedback extends PreguntaQuiz {
  respuestaCorrecta: 'A' | 'B' | 'C' | 'D';
  respuestaAlumno: 'A' | 'B' | 'C' | 'D' | null;
  acerto: boolean;
  explicacion: string;
}

export interface QuizResultado {
  moduloNum: number;
  total: number;
  correctas: number;
  incorrectas: number;
  calificacion: number;  // 0-100
  aprobado: boolean;
  feedback: PreguntaFeedback[];
}

// ── Pagos de examen (orden de pago vía Tesorería del Estado) ────────────
export type PagoExamenEstado =
  | 'pendiente_emision'
  | 'emitida'
  | 'en_revision'
  | 'pagado'
  | 'vencido'
  | 'cancelado';

export interface PagoExamenItem {
  inscripcionId: number;
  folio: string;
  moduloNumero: number;
  moduloNombre: string;
  alumno?: string;
  estudianteId?: number;
  matricula?: string | null;
}

// Método de pago declarado al subir el comprobante
export type MetodoPago = 'banco' | 'tienda' | 'linea';
export const METODOS_PAGO: { value: MetodoPago; label: string; ayuda: string }[] = [
  { value: 'banco', label: 'Ventanilla bancaria', ayuda: 'Pagaste con la línea de captura en el banco.' },
  { value: 'tienda', label: 'Tienda de conveniencia', ayuda: 'OXXO, 7-Eleven, etc., con la línea de captura.' },
  { value: 'linea', label: 'Pago en línea', ayuda: 'Portal de pago del Estado con tarjeta.' },
];

/** Vista del alumno — nunca incluye el split 115/30. */
export interface PagoExamenAlumno {
  id: number;
  folio: string | null;
  estado: PagoExamenEstado;
  concepto: string;
  cantidadExamenes: number;
  montoTotal: number;
  referencia: string | null;
  metodoPago: string | null;
  lineaCaptura: string | null;
  tieneOrden: boolean;
  linkPago: string | null;
  fechaEmision: string | null;
  fechaVencimiento: string | null;
  fechaPago: string | null;
  tieneComprobante: boolean;
  motivoRechazo: string | null;
  examenes: PagoExamenItem[];
}

/** Vista admin — incluye split interno + datos del alumno. */
export interface PagoExamenAdmin extends PagoExamenAlumno {
  estudianteId: number;
  etapaId: number | null;
  montoIemsys: number;
  montoSynapsis: number;
  notas?: string | null;
  verificadoPorUserId: number | null;
  verificadoEn: string | null;
  createdAt: string;
  alumno?: string;
  matricula?: string | null;
  curp?: string | null;
  gestor?: string | null;
  solicitante?: string;
  etapaClave?: string | null;
  fechaExamen?: string | null;
  vencimientoSugerido?: string | null;
}

export interface PagoExamenCandidato {
  id: number;
  folio: string;
  etapaId: number;
  moduloNumero: number;
  moduloNombre: string;
}

export interface PagoExamenDesglose {
  totales: { pagos: number; examenes: number; total: number; iemsys: number; synapsis: number };
  porMunicipio: { municipio: string; pagos: number; total: number; iemsys: number; synapsis: number }[];
}

export interface ExamenContable {
  id: number;
  folio: string;
  alumno: string;
  matricula: string | null;
  moduloNumero: number;
  moduloNombre: string;
  registrado: boolean;
  pagado: boolean;
  enProcesoPago: boolean;
  presentado: boolean;
  aprobado: boolean;
  calificacion: number | null;
  fichaFolio: string | null;
}

export interface ContabilidadExamenes {
  examenes: ExamenContable[];
  resumen: { total: number; pagados: number; enProcesoPago: number; presentados: number; aprobados: number };
}
