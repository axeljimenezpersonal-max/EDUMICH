/**
 * Cliente HTTP simple — Prepa Abierta Michoacán
 * Manda credentials para que la cookie de sesión viaje en cada request.
 *
 * Ubicación destino en Replit: artifacts/student-portal/src/lib/api.ts
 */

const API_BASE = '/api';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body && !(init.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...init.headers,
    },
  });

  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      const j = await res.json();
      msg = j.error || msg;
    } catch {}
    throw new Error(msg);
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
export type Rol = 'admin' | 'gestor' | 'estudiante';

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
  docsCount: number;
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

export interface ProgresoModulo {
  estado: ProgresoEstado;
  intentosQuiz: number;
  mejorCalificacion: number | null;
  ultimaCalificacion: number | null;
}

export interface ModuloListItem {
  id: number;
  numero: number;
  nivel: number | null;
  nombre: string;
  descripcionCorta: string | null;
  progreso: ProgresoModulo;
}

export interface MisModulosResponse {
  planAsignado: boolean;
  modulos: ModuloListItem[];
  resumen: {
    totalModulos: number;
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
  | 'efectivo'
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

export interface CalificacionesResponse {
  modulosAprobados: CalifRow[];
  historial: CalifRow[];
  resumen: {
    totalAprobados: number;
    promedioGlobal: number;
    examenesPresentados: number;
    porcentajeAvance: number;
  };
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
