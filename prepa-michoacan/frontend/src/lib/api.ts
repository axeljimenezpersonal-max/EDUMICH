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
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

// ── Tipos ──────────────────────────────────────────────────────
export type Rol = 'admin' | 'gestor' | 'estudiante';

export interface MeResponse {
  id: number;
  email: string;
  rol: Rol;
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
