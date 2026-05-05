/**
 * Mi Convocatoria — página principal del alumno para la convocatoria DGB
 * Muestra estado actual de inscripción, próximas etapas y sede asignada.
 */

import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import {
  Calendar,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Clock,
  BookOpen,
  ChevronRight,
  FileCheck,
  XCircle,
} from 'lucide-react';
import { EstudianteLayout } from './EstudianteLayout';
import { api } from '../../lib/api';
import type { ConvocatoriaResponse, ExamenInscrito, EtapaConvocatoria } from '../../lib/api';

// ── Helpers ───────────────────────────────────────────────────────────────

const MESES_ES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

function parseFecha(dateStr: string): Date {
  // dateStr is YYYY-MM-DD; parse as UTC to avoid off-by-one timezone issues
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatFechaLarga(dateStr: string): string {
  const d = parseFecha(dateStr);
  return d.toLocaleDateString('es-MX', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'UTC',
  });
}

function formatFechaCorta(dateStr: string): string {
  const d = parseFecha(dateStr);
  return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function diasHasta(dateStr: string): number {
  const target = parseFecha(dateStr);
  const now = new Date();
  const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((target.getTime() - todayUTC) / (1000 * 60 * 60 * 24)));
}

function estadoBadge(estado: string): { label: string; cls: string } {
  switch (estado) {
    case 'inscrito':
      return { label: 'Inscrito', cls: 'bg-amber-100 text-amber-800 border border-amber-300' };
    case 'pase_descargado':
      return { label: 'Pase descargado', cls: 'bg-blue-100 text-blue-800 border border-blue-300' };
    case 'pase_validado':
      return { label: 'Pase validado', cls: 'bg-green-100 text-green-800 border border-green-300' };
    case 'presentado':
      return { label: 'Presentado', cls: 'bg-purple-100 text-purple-800 border border-purple-300' };
    case 'aprobado':
      return { label: 'Aprobado', cls: 'bg-emerald-100 text-emerald-800 border border-emerald-300' };
    case 'reprobado':
      return { label: 'Reprobado', cls: 'bg-red-100 text-red-800 border border-red-300' };
    case 'no_presento':
      return { label: 'No presentó', cls: 'bg-stone-100 text-stone-600 border border-stone-300' };
    default:
      return { label: estado, cls: 'bg-stone-100 text-stone-600 border border-stone-300' };
  }
}

function etapaEstadoBadge(estado: string): { label: string; cls: string } {
  switch (estado) {
    case 'inscripcion_abierta':
      return { label: 'Inscripción abierta', cls: 'bg-green-100 text-green-800 border border-green-300' };
    case 'inscripcion_cerrada':
      return { label: 'Inscripción cerrada', cls: 'bg-red-100 text-red-600 border border-red-300' };
    case 'finalizada':
      return { label: 'Finalizada', cls: 'bg-stone-100 text-stone-500 border border-stone-300' };
    default:
      return { label: 'Próximamente', cls: 'bg-sky-100 text-sky-700 border border-sky-300' };
  }
}

// ── Sub-componentes ───────────────────────────────────────────────────────

function DateBlock({ dateStr }: { dateStr: string }) {
  const d = parseFecha(dateStr);
  const day = d.getUTCDate();
  const month = MESES_ES[d.getUTCMonth()];
  return (
    <div className="bg-[var(--color-guinda-700)] text-white rounded-lg px-3 py-2 text-center min-w-[52px] flex-shrink-0">
      <div className="text-xl font-bold leading-none">{day}</div>
      <div className="text-xs uppercase tracking-wide mt-0.5">{month}</div>
    </div>
  );
}

function ExamenCard({ examen }: { examen: ExamenInscrito }) {
  const badge = estadoBadge(examen.estado);
  const diasRestantes = diasHasta(examen.fechaExamen);
  const showCountdown = diasRestantes <= 30 && diasRestantes > 0;

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
      <DateBlock dateStr={examen.fechaExamen} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <p className="font-semibold text-stone-900 text-sm">
              Módulo {examen.modulo.numero} — {examen.modulo.nombre}
            </p>
            <p className="text-xs text-stone-500 mt-0.5">
              Etapa {examen.etapa.clave} · {examen.dia === 'sabado' ? 'Sábado' : 'Domingo'} · {examen.hora} hrs
            </p>
            <p className="text-xs text-stone-500 flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3" />
              {examen.sede.nombre}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>
              {badge.label}
            </span>
            {showCountdown && (
              <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                {diasRestantes} días
              </span>
            )}
          </div>
        </div>
      </div>
      <Link href={`/estudiante/convocatoria/pase/${examen.id}`}>
        <button className="text-[var(--color-guinda-700)] hover:text-[var(--color-guinda-800)] flex-shrink-0 p-1" title="Ver pase">
          <ChevronRight className="w-5 h-5" />
        </button>
      </Link>
    </div>
  );
}

function SedeCard({
  sede,
}: {
  sede: NonNullable<ConvocatoriaResponse['sedeAsignada']>;
}) {
  const mapsUrl = sede.latitud && sede.longitud
    ? `https://www.google.com/maps?q=${sede.latitud},${sede.longitud}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(sede.nombre + ' ' + sede.direccion)}`;

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="bg-[var(--color-crema-100)] rounded-lg p-2">
          <MapPin className="w-5 h-5 text-[var(--color-guinda-700)]" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-stone-900">{sede.nombre}</p>
          <p className="text-sm text-stone-600 mt-0.5">{sede.direccion}</p>
          {sede.telefono && (
            <p className="text-sm text-stone-500 mt-0.5">Tel: {sede.telefono}</p>
          )}
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-[var(--color-guinda-700)] hover:underline mt-2"
          >
            Ver en mapa <ChevronRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

function ProximasEtapasSection({ etapas }: { etapas: EtapaConvocatoria[] }) {
  if (etapas.length === 0) return null;

  return (
    <div>
      <h3 className="font-semibold text-stone-800 mb-3 flex items-center gap-2">
        <Calendar className="w-4 h-4 text-[var(--color-guinda-700)]" />
        Próximas etapas
      </h3>
      <div className="space-y-3">
        {etapas.map((etapa) => {
          const badge = etapaEstadoBadge(etapa.estado);
          return (
            <div key={etapa.id} className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
                <div>
                  <span className="font-bold text-[var(--color-guinda-700)] text-sm">
                    Etapa {etapa.clave}
                  </span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>
                  {badge.label}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-stone-600">
                <div>
                  <p className="text-stone-400 uppercase tracking-wide mb-0.5">Solicitud</p>
                  <p>{formatFechaCorta(etapa.solicitudInicio)} — {formatFechaCorta(etapa.solicitudFin)}</p>
                </div>
                <div>
                  <p className="text-stone-400 uppercase tracking-wide mb-0.5">Examen</p>
                  <p>{formatFechaCorta(etapa.examenSabado)} — {formatFechaCorta(etapa.examenDomingo)}</p>
                </div>
              </div>
              {etapa.estado === 'inscripcion_abierta' && (
                <div className="mt-3">
                  <Link href="/estudiante/convocatoria/calendario">
                    <button className="w-full bg-[var(--color-guinda-700)] text-white text-sm py-2 rounded-lg hover:bg-[var(--color-guinda-800)] transition-colors">
                      Ver módulos e inscribirme
                    </button>
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────

export default function MiConvocatoria() {
  const [data, setData] = useState<ConvocatoriaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<ConvocatoriaResponse>('/estudiante/convocatoria')
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <EstudianteLayout>
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="w-8 h-8 border-4 border-[var(--color-guinda-700)] border-t-transparent rounded-full animate-spin" />
        </div>
      </EstudianteLayout>
    );
  }

  if (error || !data) {
    return (
      <EstudianteLayout>
        <div className="max-w-2xl mx-auto px-4 py-10 text-center">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-stone-600">{error || 'Error al cargar la información'}</p>
        </div>
      </EstudianteLayout>
    );
  }

  const { etapaActiva, misExamenes, sedeAsignada, proximasEtapas, requisitos } = data;
  const tieneExamenes = misExamenes.length > 0;

  return (
    <EstudianteLayout>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-serif text-2xl font-bold text-stone-900">Mi Convocatoria</h1>
          <p className="text-stone-500 text-sm mt-1">
            Consulta tu estado de inscripción, módulos programados y sede asignada.
          </p>
        </div>

        {/* Estado de expediente — si no completo */}
        {!requisitos.expedienteCompleto && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-800 text-sm">Expediente incompleto</p>
                <p className="text-amber-700 text-sm mt-1">
                  Para inscribirte a un examen necesitas tener los siguientes documentos aprobados:
                </p>
                <ul className="mt-2 space-y-1">
                  {requisitos.documentosFaltantes.map((doc) => (
                    <li key={doc} className="flex items-center gap-2 text-sm text-amber-700">
                      <XCircle className="w-3.5 h-3.5" />
                      {doc.replace(/_/g, ' ')}
                    </li>
                  ))}
                </ul>
                <Link href="/estudiante/expediente">
                  <button className="mt-3 text-sm font-medium text-amber-800 underline hover:no-underline">
                    Ir a Mi Expediente
                  </button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Banner de etapa activa — si expediente completo y hay etapa */}
        {requisitos.expedienteCompleto && etapaActiva && (
          <div className="bg-gradient-to-r from-[var(--color-guinda-800)] to-[#9b2a4e] rounded-2xl p-5 text-white">
            <div className="flex items-start gap-3">
              <div className="bg-white/20 rounded-lg p-2">
                <FileCheck className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-lg">Inscripción abierta</p>
                <p className="text-white/80 text-sm mt-0.5">
                  Etapa {etapaActiva.clave} — solicitudes del{' '}
                  {formatFechaCorta(etapaActiva.solicitudInicio)} al{' '}
                  {formatFechaCorta(etapaActiva.solicitudFin)}
                </p>
                <p className="text-white/80 text-sm">
                  Exámenes: {formatFechaCorta(etapaActiva.examenSabado)} y{' '}
                  {formatFechaCorta(etapaActiva.examenDomingo)}
                </p>
                <Link href="/estudiante/convocatoria/calendario">
                  <button className="mt-3 bg-white text-[var(--color-guinda-700)] text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[var(--color-crema-100)] transition-colors inline-flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    Ver módulos e inscribirme
                  </button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Mis exámenes inscritos */}
        {tieneExamenes && (
          <div>
            <h2 className="font-semibold text-stone-800 mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[var(--color-guinda-700)]" />
              Mis exámenes inscritos
            </h2>
            <div className="space-y-3">
              {misExamenes.map((examen) => (
                <ExamenCard key={examen.id} examen={examen} />
              ))}
            </div>
          </div>
        )}

        {/* Sede asignada */}
        {sedeAsignada && (
          <div>
            <h2 className="font-semibold text-stone-800 mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[var(--color-guinda-700)]" />
              Sede asignada
            </h2>
            <SedeCard sede={sedeAsignada} />
          </div>
        )}

        {/* Horario de atención info */}
        <div className="bg-[var(--color-crema-100)] border border-[var(--color-crema-200)] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-[var(--color-guinda-700)]" />
            <p className="font-medium text-stone-800 text-sm">Cómo funciona</p>
          </div>
          <ol className="text-sm text-stone-600 space-y-1 list-decimal list-inside">
            <li>Asegúrate de tener tu expediente completo y aprobado.</li>
            <li>Durante el período de solicitud, elige los módulos en el calendario.</li>
            <li>Descarga tu pase de examen desde esta sección.</li>
            <li>Preséntate en la sede asignada el día y hora de tu examen.</li>
          </ol>
        </div>

        {/* Próximas etapas */}
        <ProximasEtapasSection etapas={proximasEtapas} />
      </div>
    </EstudianteLayout>
  );
}
