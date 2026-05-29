/**
 * Mi Convocatoria — vista principal del alumno.
 * Muestra etapa activa, módulos disponibles con selección inline,
 * exámenes inscritos y sede asignada.
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
  Loader2,
  X,
} from 'lucide-react';
import { EstudianteLayout } from './EstudianteLayout';
import { api } from '../../lib/api';
import type { ConvocatoriaResponse, CalendarioMes, ExamenInscrito, EtapaConvocatoria } from '../../lib/api';

// ── Helpers ───────────────────────────────────────────────────────────────

function parseFecha(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatFechaCorta(dateStr: string): string {
  const d = parseFecha(dateStr);
  return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function formatFechaLarga(dateStr: string): string {
  const d = parseFecha(dateStr);
  return d.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function diasHasta(dateStr: string): number {
  const target = parseFecha(dateStr);
  const now = new Date();
  const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((target.getTime() - todayUTC) / (1000 * 60 * 60 * 24)));
}

function estadoBadge(estado: string): { label: string; cls: string } {
  switch (estado) {
    case 'inscrito':      return { label: 'Inscrito',       cls: 'bg-amber-100 text-amber-800 border border-amber-300' };
    case 'pase_descargado': return { label: 'Pase descargado', cls: 'bg-blue-100 text-blue-800 border border-blue-300' };
    case 'pase_validado': return { label: 'Pase validado',  cls: 'bg-green-100 text-green-800 border border-green-300' };
    case 'presentado':    return { label: 'Presentado',     cls: 'bg-purple-100 text-purple-800 border border-purple-300' };
    case 'aprobado':      return { label: 'Aprobado',       cls: 'bg-emerald-100 text-emerald-800 border border-emerald-300' };
    case 'reprobado':     return { label: 'Reprobado',      cls: 'bg-red-100 text-red-800 border border-red-300' };
    case 'no_presento':   return { label: 'No presentó',    cls: 'bg-stone-100 text-stone-600 border border-stone-300' };
    default:              return { label: estado,           cls: 'bg-stone-100 text-stone-600 border border-stone-300' };
  }
}

// ── ExamenCard ────────────────────────────────────────────────────────────

function ExamenCard({ examen }: { examen: ExamenInscrito }) {
  const badge = estadoBadge(examen.estado);
  const diasRestantes = diasHasta(examen.fechaExamen);
  const showCountdown = diasRestantes <= 30 && diasRestantes > 0;

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="bg-[var(--color-guinda-700)] text-white rounded-lg px-3 py-2 text-center min-w-[52px] flex-shrink-0">
        <div className="text-xl font-bold leading-none">{parseFecha(examen.fechaExamen).getUTCDate()}</div>
        <div className="text-xs uppercase tracking-wide mt-0.5">
          {parseFecha(examen.fechaExamen).toLocaleDateString('es-MX', { month: 'short', timeZone: 'UTC' })}
        </div>
      </div>
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
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>{badge.label}</span>
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

// ── SedeCard ──────────────────────────────────────────────────────────────

function SedeCard({ sede }: { sede: NonNullable<ConvocatoriaResponse['sedeAsignada']> }) {
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
          {sede.telefono && <p className="text-sm text-stone-500 mt-0.5">Tel: {sede.telefono}</p>}
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-[var(--color-guinda-700)] hover:underline mt-2">
            Ver en mapa <ChevronRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

// ── ModulosInscripcion ────────────────────────────────────────────────────
// Selector inline de módulos para la etapa activa

type ModItem = { id: number; numero: number; nombre: string };
type Horariso = CalendarioMes['etapas'][0]['horariosDisponibles'];

function ModulosInscripcion({
  etapa,
  calendarioEtapa,
  misExamenesIds,
  onSuccess,
}: {
  etapa: EtapaConvocatoria;
  calendarioEtapa: CalendarioMes['etapas'][0] | null;
  misExamenesIds: number[];  // ids de modulos ya inscritos
  onSuccess: () => void;
}) {
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
  const [inscribiendo, setInscribiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  if (!calendarioEtapa) {
    return (
      <div className="text-center py-8 text-stone-400 text-sm">
        <Loader2 size={18} className="animate-spin mx-auto mb-2" />
        Cargando módulos disponibles…
      </div>
    );
  }

  const h: Horariso = calendarioEtapa.horariosDisponibles;

  // Construir mapa de módulo → slot para conflictos
  const moduloSlotMap = new Map<number, string>();
  const dias = ['sabado', 'domingo'] as const;
  const horas = ['09:00', '11:00'] as const;
  for (const dia of dias) {
    for (const hora of horas) {
      const lista = h[dia][hora] as ModItem[];
      for (const m of lista) moduloSlotMap.set(m.id, `${dia}|${hora}`);
    }
  }

  // Slots ocupados por ya-inscritos
  const occupiedSlots = new Set<string>();
  for (const modId of misExamenesIds) {
    const slot = moduloSlotMap.get(modId);
    if (slot) occupiedSlots.add(slot);
  }

  // Slots ocupados por selección actual
  const selectedSlots = new Set<string>();
  for (const modId of seleccion) {
    const slot = moduloSlotMap.get(modId);
    if (slot) selectedSlots.add(slot);
  }

  function toggle(modId: number) {
    if (misExamenesIds.includes(modId)) return;
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(modId)) next.delete(modId); else next.add(modId);
      return next;
    });
  }

  function isDisabled(modId: number): boolean {
    if (misExamenesIds.includes(modId)) return false;
    if (seleccion.has(modId)) return false;
    const slot = moduloSlotMap.get(modId);
    if (!slot) return false;
    return occupiedSlots.has(slot) || selectedSlots.has(slot);
  }

  async function handleInscribir() {
    if (seleccion.size === 0) return;
    setInscribiendo(true);
    setError(null);
    try {
      await api.post('/estudiante/convocatoria/inscribirme', {
        etapaId: etapa.id,
        modulosIds: Array.from(seleccion),
      });
      setExito(true);
      setSeleccion(new Set());
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al inscribirse');
    } finally {
      setInscribiendo(false);
    }
  }

  const sections = [
    { title: 'Sábado 09:00', dia: 'sabado' as const, hora: '09:00' as const, fecha: etapa.examenSabado },
    { title: 'Sábado 11:00', dia: 'sabado' as const, hora: '11:00' as const, fecha: etapa.examenSabado },
    { title: 'Domingo 09:00', dia: 'domingo' as const, hora: '09:00' as const, fecha: etapa.examenDomingo },
    { title: 'Domingo 11:00', dia: 'domingo' as const, hora: '11:00' as const, fecha: etapa.examenDomingo },
  ];

  const todosLosModulos: ModItem[] = sections.flatMap(({ dia, hora }) => h[dia][hora] as ModItem[]);
  const hayDisponibles = todosLosModulos.some((m) => !misExamenesIds.includes(m.id));

  return (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen size={15} className="text-[var(--color-guinda-700)]" />
          <h3 className="text-sm font-bold text-stone-900">Módulos disponibles para inscribir</h3>
        </div>
        <span className="text-xs text-stone-500">
          Solicitud cierra {formatFechaCorta(etapa.solicitudFin)}
        </span>
      </div>

      <div className="p-5 space-y-4">

        {exito && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2 text-sm text-emerald-800">
            <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
            ¡Inscripción completada! Ve a <strong>Mis pagos</strong> en el expediente para pagar tus derechos.
            <button onClick={() => setExito(false)} className="ml-auto text-emerald-400 hover:text-emerald-600">
              <X size={14} />
            </button>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2 text-sm text-red-700">
            <XCircle size={15} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {!hayDisponibles && (
          <div className="text-center py-6 text-stone-400 text-sm">
            Ya estás inscrito en todos los módulos disponibles para esta etapa.
          </div>
        )}

        {sections.map(({ title, dia, hora, fecha }) => {
          const lista = h[dia][hora] as ModItem[];
          if (lista.length === 0) return null;
          return (
            <div key={title}>
              <p className="text-xs font-bold text-stone-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Clock size={12} /> {title}
                <span className="font-normal text-stone-400 ml-1">— {formatFechaLarga(fecha)}</span>
              </p>
              <div className="space-y-1.5">
                {lista.map((m) => {
                  const isAlreadyIn = misExamenesIds.includes(m.id);
                  const isSelected = seleccion.has(m.id);
                  const disabled = !isAlreadyIn && isDisabled(m.id);

                  return (
                    <label
                      key={m.id}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors select-none ${
                        isAlreadyIn
                          ? 'bg-emerald-50 border border-emerald-200'
                          : isSelected
                            ? 'bg-[var(--color-guinda-50,#faf0f3)] border border-[var(--color-guinda-700)]'
                            : disabled
                              ? 'bg-stone-50 border border-stone-100 opacity-40 cursor-not-allowed'
                              : 'bg-stone-50 border border-stone-100 hover:border-stone-300 hover:bg-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isAlreadyIn || isSelected}
                        disabled={isAlreadyIn || disabled}
                        onChange={() => toggle(m.id)}
                        className="w-4 h-4 accent-[var(--color-guinda-700)] shrink-0"
                      />
                      <span className="flex-1 min-w-0 text-sm text-stone-800">
                        <span className={`font-bold mr-1 ${isAlreadyIn ? 'text-emerald-700' : 'text-[var(--color-guinda-700)]'}`}>
                          M{m.numero}
                        </span>
                        {m.nombre}
                      </span>
                      {isAlreadyIn && <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />}
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}

        {hayDisponibles && (
          <div className="flex items-center justify-between pt-4 border-t border-stone-200">
            <div className="text-sm text-stone-500">
              <span className="font-bold text-stone-900">{seleccion.size}</span>{' '}
              módulo{seleccion.size !== 1 ? 's' : ''} seleccionado{seleccion.size !== 1 ? 's' : ''}
            </div>
            <button
              onClick={handleInscribir}
              disabled={seleccion.size === 0 || inscribiendo}
              className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-guinda-700)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--color-guinda-800)] disabled:opacity-50 transition-colors"
            >
              {inscribiendo ? <Loader2 size={14} className="animate-spin" /> : <BookOpen size={14} />}
              {inscribiendo ? 'Inscribiendo…' : 'Inscribirme'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Próximas etapas ───────────────────────────────────────────────────────

function ProximasEtapasSection({ etapas }: { etapas: EtapaConvocatoria[] }) {
  if (etapas.length === 0) return null;
  return (
    <div>
      <h3 className="font-semibold text-stone-800 mb-3 flex items-center gap-2">
        <Calendar className="w-4 h-4 text-[var(--color-guinda-700)]" />
        Próximas etapas
      </h3>
      <div className="space-y-3">
        {etapas.map((etapa) => (
          <div key={etapa.id} className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
              <span className="font-bold text-[var(--color-guinda-700)] text-sm">Etapa {etapa.clave}</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-sky-100 text-sky-700 border border-sky-300">
                Próximamente
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
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────

export default function MiConvocatoria() {
  const [data, setData] = useState<ConvocatoriaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calendario para la etapa activa (módulos disponibles)
  const [calendarioData, setCalendarioData] = useState<CalendarioMes | null>(null);
  const [calendarioLoading, setCalendarioLoading] = useState(false);

  async function cargarConvocatoria() {
    try {
      const d = await api.get<ConvocatoriaResponse>('/estudiante/convocatoria');
      setData(d);
      return d;
    } catch (e: Error | unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
      return null;
    }
  }

  useEffect(() => {
    cargarConvocatoria().finally(() => setLoading(false));
  }, []);

  // Cuando hay etapa activa, cargar el calendario de ese mes
  useEffect(() => {
    if (!data?.etapaActiva) return;
    const mes = data.etapaActiva.examenSabado.slice(0, 7);
    setCalendarioLoading(true);
    api.get<CalendarioMes>(`/estudiante/convocatoria/calendario?mes=${mes}`)
      .then(setCalendarioData)
      .catch(() => {})
      .finally(() => setCalendarioLoading(false));
  }, [data?.etapaActiva?.id]);

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

  // IDs de módulos ya inscritos en la etapa activa
  const misModulosInscritos = etapaActiva
    ? misExamenes
        .filter((e) => e.etapa.clave === etapaActiva.clave)
        .map((e) => e.modulo.id)
    : [];

  // Etapa del calendario que corresponde a la activa
  const calendarioEtapaActiva = etapaActiva && calendarioData
    ? (calendarioData.etapas.find((e) => e.id === etapaActiva.id) ?? null)
    : null;

  return (
    <EstudianteLayout>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div>
          <h1 className="font-serif text-2xl font-bold text-stone-900">Mi Convocatoria</h1>
          <p className="text-stone-500 text-sm mt-1">
            Consulta tu estado de inscripción, módulos disponibles y sede asignada.
          </p>
        </div>

        {/* Expediente incompleto */}
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

        {/* Banner etapa activa */}
        {requisitos.expedienteCompleto && etapaActiva && (
          <div className="bg-[var(--color-guinda-700)] rounded-2xl p-5 text-white">
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
              </div>
            </div>
          </div>
        )}

        {/* Módulos disponibles para inscribir (inline) */}
        {requisitos.expedienteCompleto && etapaActiva && etapaActiva.estado === 'inscripcion_abierta' && (
          <ModulosInscripcion
            etapa={etapaActiva}
            calendarioEtapa={calendarioLoading ? null : calendarioEtapaActiva}
            misExamenesIds={misModulosInscritos}
            onSuccess={() => cargarConvocatoria()}
          />
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

        {/* Sin etapa activa */}
        {!etapaActiva && !loading && (
          <div className="bg-[var(--color-crema-100)] border border-[var(--color-crema-200)] rounded-xl p-6 text-center">
            <Calendar className="w-10 h-10 mx-auto text-[var(--color-guinda-700)] opacity-40 mb-3" />
            <p className="font-semibold text-stone-700 text-sm">No hay convocatoria activa en este momento</p>
            <p className="text-xs text-stone-500 mt-1">Cuando se abra una convocatoria, aquí podrás inscribirte a tus exámenes.</p>
          </div>
        )}

        {/* Cómo funciona */}
        <div className="bg-[var(--color-crema-100)] border border-[var(--color-crema-200)] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-[var(--color-guinda-700)]" />
            <p className="font-medium text-stone-800 text-sm">Cómo funciona</p>
          </div>
          <ol className="text-sm text-stone-600 space-y-1 list-decimal list-inside">
            <li>Asegúrate de tener tu expediente completo y aprobado.</li>
            <li>Durante el período de solicitud, selecciona los módulos de arriba e inscríbete.</li>
            <li>Paga tus derechos de examen desde <strong>Mi expediente → Mis pagos</strong>.</li>
            <li>Descarga tu pase de examen y preséntate en la sede el día indicado.</li>
          </ol>
        </div>

        {/* Próximas etapas */}
        <ProximasEtapasSection etapas={proximasEtapas} />

      </div>
    </EstudianteLayout>
  );
}
