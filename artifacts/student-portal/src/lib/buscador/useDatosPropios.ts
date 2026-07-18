/**
 * Capa "Tu situación": convierte el estado real del usuario en resultados de
 * búsqueda.
 *
 * Es lo que separa un buscador que navega de uno que contesta. Con esto,
 * "¿ya pagué?" responde TU pago y no el procedimiento general.
 *
 * ── Dos decisiones de rendimiento ───────────────────────────────────────────
 *
 * 1. Se pide al ABRIR el buscador, no al cargar la página. La mayoría de las
 *    visitas nunca abren el buscador; cobrarles una llamada a todas sería
 *    pagar por algo que casi nadie usa.
 *
 * 2. Se guarda en memoria un rato (`VIGENCIA_MS`). Abrir, cerrar y volver a
 *    abrir es un gesto normal, y no tiene sentido repetir la consulta cada vez.
 *
 * ── Por qué el admin usa un endpoint aparte ─────────────────────────────────
 * Sus contadores viven en `/admin/dashboard`, que hace ~25 consultas y tres
 * N+1 (gráfica por etapa, dos consultas por alumno reciente, agregaciones
 * crudas). Llamarlo al abrir un buscador sería un despropósito, así que se
 * usa `/admin/tareas-pendientes`, que devuelve sólo los cuatro contadores con
 * la MISMA definición que el tablero — si divergen, el buscador y el tablero
 * dirían números distintos y nadie sabría a cuál creerle.
 */

import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { fechaCorta } from '../fechas';
import type { Resultado, RolBuscador } from './tipos';

/** Cuánto vale lo ya pedido antes de volver a preguntar. */
const VIGENCIA_MS = 60_000;

interface Cacheado { en: number; datos: Resultado[] }
const cache = new Map<RolBuscador, Cacheado>();

// ── Formas mínimas de las respuestas que se consumen ────────────────────────

interface DashAlumno {
  folioPreregistro?: string | null;
  matriculaOficialDGB?: string | null;
  inscripcionActiva?: {
    estado?: string;
    convocatoriaNombre?: string;
    fechaCierre?: string | null;
    fechaExamen?: string | null;
  } | null;
  etapaActiva?: {
    clave?: string;
    solicitudFin?: string | null;
    totalExamenes?: number;
    pagados?: number;
    todosPagados?: boolean;
  } | null;
  kpis?: {
    documentosAprobados?: number;
    documentosPendientes?: number;
    modulosAprobados?: number;
    modulosTotales?: number;
  };
  examenesInscritos?: Array<{
    moduloNombre?: string;
    fechaExamen?: string | null;
    sedeNombre?: string | null;
    pagado?: boolean;
  }>;
}

interface DashGestor {
  kpis?: {
    alumnosTotales?: number;
    alumnosConInscripcion?: number;
    documentosPendientes?: number;
    pagosPendientes?: number;
  };
}

interface TareasAdmin {
  documentosPorRevisar?: number;
  pagosPorEmitir?: number;
  pagosPorRevisar?: number;
  solicitudesCuenta?: number;
}

// ── Traducción de estado → resultado de búsqueda ────────────────────────────

function datosAlumno(d: DashAlumno): Resultado[] {
  const out: Resultado[] = [];

  // Pago. Es la duda número uno, así que se responde con números concretos.
  const et = d.etapaActiva;
  if (et && typeof et.totalExamenes === 'number' && et.totalExamenes > 0) {
    const pagados = et.pagados ?? 0;
    const listo = et.todosPagados || pagados >= et.totalExamenes;
    out.push({
      id: 'dato-pago',
      tipo: 'dato',
      titulo: listo
        ? 'Tus exámenes de esta etapa ya están pagados'
        : `Te faltan ${et.totalExamenes - pagados} de ${et.totalExamenes} exámenes por pagar`,
      cuerpo: et.solicitudFin
        ? `La ventana de esta etapa cierra el ${fechaCorta(et.solicitudFin)}.`
        : undefined,
      ruta: '/estudiante/pagos',
      icono: listo ? 'CheckCircle2' : 'CreditCard',
      pista: listo ? 'Al corriente' : 'Pendiente',
    });
  }

  // Inscripción y sede.
  const ins = d.inscripcionActiva;
  if (ins) {
    out.push({
      id: 'dato-inscripcion',
      tipo: 'dato',
      titulo: `Estás inscrito en ${ins.convocatoriaNombre ?? 'la convocatoria activa'}`,
      cuerpo: [
        ins.fechaExamen ? `Examen el ${fechaCorta(ins.fechaExamen)}` : null,
        ins.fechaCierre ? `cierra el ${fechaCorta(ins.fechaCierre)}` : null,
      ].filter(Boolean).join(' · ') || undefined,
      ruta: '/estudiante/convocatoria',
      icono: 'CalendarClock',
      pista: d.etapaActiva?.clave ?? 'Inscripción',
    });
  } else {
    out.push({
      id: 'dato-sin-inscripcion',
      tipo: 'dato',
      titulo: 'No tienes una inscripción activa',
      cuerpo: 'Cuando se abra una etapa podrás inscribirte y elegir tu sede.',
      ruta: '/estudiante/convocatoria',
      icono: 'CalendarClock',
      pista: 'Inscripción',
    });
  }

  const examen = d.examenesInscritos?.find((e) => e.fechaExamen);
  if (examen?.sedeNombre) {
    out.push({
      id: 'dato-sede',
      tipo: 'dato',
      titulo: `Tu sede es ${examen.sedeNombre}`,
      cuerpo: examen.fechaExamen ? `Presentas el ${fechaCorta(examen.fechaExamen)}.` : undefined,
      ruta: '/estudiante/convocatoria',
      icono: 'MapPin',
      pista: 'Sede',
    });
  }

  // Expediente.
  const k = d.kpis;
  if (k && typeof k.documentosPendientes === 'number') {
    const pend = k.documentosPendientes;
    out.push({
      id: 'dato-expediente',
      tipo: 'dato',
      titulo: pend === 0
        ? 'Tu expediente está completo'
        : `Te faltan ${pend} documento${pend === 1 ? '' : 's'} por aprobar`,
      cuerpo: typeof k.documentosAprobados === 'number'
        ? `Llevas ${k.documentosAprobados} de ${k.documentosAprobados + pend} aprobados.`
        : undefined,
      ruta: '/estudiante/expediente',
      icono: pend === 0 ? 'CheckCircle2' : 'FolderOpen',
      pista: pend === 0 ? 'Completo' : 'Pendiente',
    });
  }

  // Matrícula o folio: es lo que la gente busca cuando le piden "su número".
  if (d.matriculaOficialDGB) {
    out.push({
      id: 'dato-matricula',
      tipo: 'dato',
      titulo: `Tu matrícula es ${d.matriculaOficialDGB}`,
      ruta: '/estudiante/expediente',
      icono: 'IdCard',
      pista: 'Matrícula',
    });
  } else if (d.folioPreregistro) {
    out.push({
      id: 'dato-folio',
      tipo: 'dato',
      titulo: `Tu folio de pre-registro es ${d.folioPreregistro}`,
      cuerpo: 'Tu matrícula oficial llega cuando la SEP-DGB valide tu registro.',
      ruta: '/estudiante/expediente',
      icono: 'FileText',
      pista: 'Folio',
    });
  }

  return out;
}

function datosGestor(d: DashGestor): Resultado[] {
  const k = d.kpis ?? {};
  const out: Resultado[] = [];

  if (typeof k.documentosPendientes === 'number' && k.documentosPendientes > 0) {
    out.push({
      id: 'dato-ges-docs',
      tipo: 'dato',
      titulo: `${k.documentosPendientes} documento${k.documentosPendientes === 1 ? '' : 's'} de tus alumnos por resolver`,
      ruta: '/gestor/alumnos',
      icono: 'FolderOpen',
      pista: 'Documentos',
    });
  }
  if (typeof k.pagosPendientes === 'number' && k.pagosPendientes > 0) {
    out.push({
      id: 'dato-ges-pagos',
      tipo: 'dato',
      titulo: `${k.pagosPendientes} pago${k.pagosPendientes === 1 ? '' : 's'} pendiente${k.pagosPendientes === 1 ? '' : 's'}`,
      ruta: '/gestor/pagos',
      icono: 'CreditCard',
      pista: 'Pagos',
    });
  }
  if (typeof k.alumnosTotales === 'number') {
    const sinInscribir = k.alumnosTotales - (k.alumnosConInscripcion ?? 0);
    out.push({
      id: 'dato-ges-alumnos',
      tipo: 'dato',
      titulo: `Tienes ${k.alumnosTotales} alumnos asignados`,
      cuerpo: sinInscribir > 0 ? `${sinInscribir} sin inscripción activa.` : undefined,
      ruta: '/gestor/alumnos',
      icono: 'Users',
      pista: 'Alumnos',
    });
  }
  return out;
}

function datosAdmin(t: TareasAdmin): Resultado[] {
  const filas: Array<[keyof TareasAdmin, string, string, string]> = [
    ['documentosPorRevisar', 'documento', 'por revisar', '/admin/alumnos?filtro=docs_en_revision'],
    ['pagosPorEmitir', 'pago', 'por emitir', '/admin/ordenes-pago'],
    ['pagosPorRevisar', 'pago', 'por verificar contra banco', '/admin/pagos'],
    ['solicitudesCuenta', 'solicitud', 'de cuenta por atender', '/admin/solicitudes'],
  ];
  const out: Resultado[] = [];
  for (const [campo, sustantivo, cola, ruta] of filas) {
    const n = t[campo];
    if (typeof n !== 'number' || n === 0) continue;
    // Plural del español: "solicitud" hace "solicitudes", no "solicituds".
    const plural = n === 1 ? sustantivo : sustantivo.endsWith('d') ? `${sustantivo}es` : `${sustantivo}s`;
    out.push({
      id: `dato-adm-${campo}`,
      tipo: 'dato',
      titulo: `${n} ${plural} ${cola}`,
      ruta,
      icono: 'AlertCircle',
      pista: 'Pendiente',
    });
  }
  return out;
}

/**
 * Devuelve los resultados de "Tu situación" del usuario actual.
 * `activo` debe ser true sólo mientras el buscador está abierto.
 */
export function useDatosPropios(rol: RolBuscador, activo: boolean): Resultado[] {
  const [datos, setDatos] = useState<Resultado[]>(() => cache.get(rol)?.datos ?? []);
  const pidiendo = useRef(false);

  useEffect(() => {
    if (!activo) return;

    const guardado = cache.get(rol);
    if (guardado && Date.now() - guardado.en < VIGENCIA_MS) {
      setDatos(guardado.datos);
      return;
    }
    if (pidiendo.current) return;
    pidiendo.current = true;

    let cancelado = false;
    const guardar = (r: Resultado[]) => {
      cache.set(rol, { en: Date.now(), datos: r });
      if (!cancelado) setDatos(r);
    };

    const peticion: Promise<Resultado[]> =
      rol === 'estudiante'
        ? api.get<DashAlumno>('/estudiante/dashboard').then(datosAlumno)
        : rol === 'gestor'
          ? api.get<DashGestor>('/gestor/dashboard').then(datosGestor)
          : rol === 'admin'
            ? api.get<TareasAdmin>('/admin/tareas-pendientes').then(datosAdmin)
            // Dirección no tiene "tu situación": es un perfil de indicadores
            // agregados, no un trámite propio que consultar.
            : Promise.resolve([]);

    peticion
      // Silencioso: si esto falla, el buscador sigue sirviendo respuestas y
      // secciones, que no dependen del servidor.
      .catch(() => [] as Resultado[])
      .then(guardar)
      .finally(() => { pidiendo.current = false; });

    return () => { cancelado = true; };
  }, [rol, activo]);

  return datos;
}
