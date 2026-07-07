/**
 * Mi Convocatoria — vista principal del alumno.
 * Muestra etapa activa, módulos disponibles con selección inline,
 * exámenes inscritos y sede asignada.
 */

import { Fragment, useEffect, useState } from 'react';
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
  Pencil,
} from 'lucide-react';
import { EstudianteLayout } from './EstudianteLayout';
import { PageTour } from '../../components/tour/PageTour';
import { TOUR_INSCRIPCION } from '../../components/tour/estudianteToursPagina';
import { api } from '../../lib/api';
import type { ConvocatoriaResponse, CalendarioMes, ExamenInscrito, EtapaConvocatoria, ExpedienteResponse } from '../../lib/api';

// Nombres institucionales de los documentos del expediente (las claves
// internas — curp, acta_nacimiento… — nunca se muestran al alumno).
const DOCS_EXPEDIENTE: { tipo: string; label: string }[] = [
  { tipo: 'curp', label: 'CURP' },
  { tipo: 'acta_nacimiento', label: 'Acta de nacimiento' },
  { tipo: 'ine', label: 'Identificación oficial (INE)' },
  { tipo: 'comprobante_domicilio', label: 'Comprobante de domicilio' },
  { tipo: 'certificado_secundaria', label: 'Certificado de secundaria' },
];

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
  // Sin pago verificado el examen es un PRE-REGISTRO: se confirma sólo cuando
  // el pago queda validado. El pase depende de ese pago, así que no se ofrece
  // mientras esté pendiente.
  const badge = examen.pagado
    ? { label: 'Inscripción confirmada', cls: 'bg-emerald-100 text-emerald-800 border border-emerald-300' }
    : { label: 'Pre-inscrito · falta pago', cls: 'bg-amber-100 text-amber-800 border border-amber-300' };
  const diasRestantes = diasHasta(examen.fechaExamen);
  const showCountdown = diasRestantes <= 30 && diasRestantes > 0;
  const fecha = parseFecha(examen.fechaExamen);

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4">
      {/* Fecha + hora del examen (el foco de la tarjeta) */}
      <div className="bg-[var(--color-guinda-700)] text-white rounded-lg px-3 py-2 text-center min-w-[64px] flex-shrink-0">
        <div className="text-2xl font-bold leading-none">{fecha.getUTCDate()}</div>
        <div className="text-[10px] uppercase tracking-wide mt-0.5">
          {fecha.toLocaleDateString('es-MX', { month: 'short', timeZone: 'UTC' })}
        </div>
        <div className="mt-1 pt-1 border-t border-white/25 text-xs font-semibold flex items-center justify-center gap-1">
          <Clock className="w-3 h-3" /> {examen.hora}
        </div>
      </div>

      {/* Módulo + detalles */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-stone-900 text-sm leading-snug">
          Módulo {examen.modulo.numero} — {examen.modulo.nombre}
        </p>
        <p className="text-xs text-stone-500 mt-1">
          Etapa {examen.etapa.clave} · {examen.dia === 'sabado' ? 'Sábado' : 'Domingo'} {formatFechaCorta(examen.fechaExamen)}
        </p>
        <p className="text-xs text-stone-500 flex items-center gap-1 mt-0.5">
          <MapPin className="w-3 h-3 shrink-0" />
          {examen.sede.nombre}
        </p>
      </div>

      {/* Estado + acceso al pase (sólo si ya está pagado) */}
      <div className="flex flex-col items-end gap-1.5 shrink-0 text-right">
        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${badge.cls}`}>
          {badge.label}
        </span>
        {showCountdown && <span className="text-[11px] text-stone-400">Faltan {diasRestantes} días</span>}
        {examen.pagado && (
          <Link href={`/estudiante/convocatoria/pase/${examen.id}`}>
            <button className="text-xs font-semibold text-[var(--color-guinda-700)] hover:underline flex items-center gap-0.5">
              Ver pase <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </Link>
        )}
      </div>
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
  costoExamen,
  hayPreinscripcion,
  onEditarPreinscripcion,
  onSuccess,
}: {
  etapa: EtapaConvocatoria;
  calendarioEtapa: CalendarioMes['etapas'][0] | null;
  misExamenesIds: number[];  // ids de modulos ya inscritos
  costoExamen: number;
  hayPreinscripcion: boolean;
  onEditarPreinscripcion: () => void;
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
      // 1) Pre-inscribir los módulos seleccionados
      const resp = await api.post<{ ok: boolean; inscripciones: { id: number }[] }>(
        '/estudiante/convocatoria/inscribirme',
        { etapaId: etapa.id, modulosIds: Array.from(seleccion) },
      );
      // 2) Solicitar la ficha de pago para esas mismas inscripciones (mismo paso).
      const ids = (resp?.inscripciones ?? []).map((i) => i.id).filter(Boolean);
      if (ids.length > 0) {
        try {
          await api.post('/pagos-examen/solicitar', { examenInscripcionIds: ids });
        } catch {
          // Si la emisión de la ficha falla, la pre-inscripción ya quedó;
          // el alumno podrá solicitar la ficha desde la sección Pagos.
        }
      }
      setExito(true);
      setSeleccion(new Set());
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al inscribirse');
    } finally {
      setInscribiendo(false);
    }
  }

  // Estructura día×hora (tabla, como en la vista del gestor).
  const DIA_LABEL: Record<string, string> = { sabado: 'Sábado', domingo: 'Domingo' };
  const fechaDeDia = (d: 'sabado' | 'domingo') => (d === 'sabado' ? etapa.examenSabado : etapa.examenDomingo);
  const horasRows = ['09:00', '11:00'] as const;
  const diasCols = (['sabado', 'domingo'] as const).filter((d) =>
    horasRows.some((hh) => (h[d][hh] as ModItem[]).length > 0)
  );
  const todosLosModulos: ModItem[] = diasCols.flatMap((d) => horasRows.flatMap((hh) => h[d][hh] as ModItem[]));
  const hayDisponibles = todosLosModulos.some((m) => !misExamenesIds.includes(m.id));

  // Tarjeta de un módulo dentro de una celda día×hora.
  function ModuloCard({ m }: { m: ModItem }) {
    const isAlreadyIn = misExamenesIds.includes(m.id);
    const isSelected = seleccion.has(m.id);
    const disabled = !isAlreadyIn && isDisabled(m.id);

    if (isAlreadyIn) {
      return (
        <div className="flex items-start gap-2 p-2.5 rounded-lg border border-amber-200 bg-amber-50/70 select-none">
          <Clock size={15} className="shrink-0 mt-0.5 text-amber-600" />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold text-amber-700">Módulo {m.numero}</div>
            <div className="text-xs text-stone-700 leading-snug">{m.nombre}</div>
            <div className="text-[10px] font-bold text-amber-700 mt-0.5">Pre-inscrito · falta pago</div>
          </div>
        </div>
      );
    }
    return (
      <label
        className={`flex items-start gap-2 p-2.5 rounded-lg border transition-all duration-200 select-none ${
          disabled
            ? 'border-stone-200 bg-stone-50 opacity-55 cursor-not-allowed'
            : isSelected
              ? 'border-[var(--color-guinda-700)] bg-[var(--color-guinda-50,#faf0f3)] cursor-pointer ring-1 ring-[var(--color-guinda-700)]'
              : 'border-stone-200 bg-white hover:bg-stone-50 cursor-pointer'
        }`}
      >
        <input
          type="checkbox"
          checked={isSelected}
          disabled={disabled}
          onChange={() => !disabled && toggle(m.id)}
          className="w-4 h-4 shrink-0 mt-0.5 accent-[var(--color-guinda-700)]"
        />
        <div className="min-w-0 flex-1">
          <div className={`text-[11px] font-bold ${isSelected ? 'text-[var(--color-guinda-700)]' : 'text-stone-400'}`}>
            Módulo {m.numero}
          </div>
          <div className="text-xs text-stone-700 leading-snug">{m.nombre}</div>
          {disabled && (
            <div className="text-[10px] text-stone-400 mt-1">Ya elegiste otro módulo en este día y hora</div>
          )}
        </div>
      </label>
    );
  }

  return (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <BookOpen size={15} className="text-[var(--color-guinda-700)]" />
          <h3 className="text-sm font-bold text-stone-900">Módulos disponibles para inscribir</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-stone-500">
            Solicitud cierra {formatFechaCorta(etapa.solicitudFin)}
          </span>
          {hayPreinscripcion && (
            <button
              onClick={onEditarPreinscripcion}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-50 hover:text-[var(--color-guinda-700)] hover:border-[var(--color-guinda-700)] transition-colors"
            >
              <Pencil size={13} />
              Modificar
            </button>
          )}
        </div>
      </div>

      <div className="p-5 space-y-4">

        {exito && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-2.5 text-sm text-amber-900">
            <Clock size={16} className="shrink-0 text-amber-600 mt-0.5" />
            <div>
              <div className="font-bold">¡Quedaste pre-inscrito y generamos tu ficha de pago!</div>
              <div className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                Registramos tu pre-inscripción y emitimos tu <strong>ficha de pago</strong>. Para confirmar tu
                lugar, ve a la sección <strong>Pagos</strong> y cúbrela. Solo lo pagado se puede presentar.
              </div>
            </div>
            <button onClick={() => setExito(false)} className="ml-auto text-amber-400 hover:text-amber-600 shrink-0">
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

        {!hayDisponibles ? (
          <div className="text-center py-6 text-stone-400 text-sm">
            Ya estás pre-inscrito en todos los módulos disponibles para esta etapa.
          </div>
        ) : (
          <>
            <div className="flex items-baseline justify-between flex-wrap gap-1">
              <h4 className="text-xs font-bold uppercase tracking-widest text-stone-500">
                Horario de exámenes · elige por día y hora
              </h4>
              <span className="text-[11px] text-stone-400">
                Los módulos en un mismo bloque comparten día y hora — solo puedes inscribir uno.
              </span>
            </div>

            {/* Tabla día×hora */}
            <div className="overflow-x-auto -mx-1 px-1 pb-1">
              <div
                className="grid gap-2 min-w-[520px]"
                style={{ gridTemplateColumns: `52px repeat(${diasCols.length}, minmax(0,1fr))` }}
              >
                {/* Encabezado: días */}
                <div />
                {diasCols.map((d) => (
                  <div key={`h-${d}`} className="text-center pb-1.5 border-b-2" style={{ borderColor: '#e8c4d4' }}>
                    <div className="text-xs font-bold uppercase tracking-wide text-[var(--color-guinda-700)]">
                      {DIA_LABEL[d] ?? d}
                    </div>
                    <div className="text-[10px] font-medium text-stone-400 mt-0.5">{formatFechaCorta(fechaDeDia(d))}</div>
                  </div>
                ))}
                {/* Filas: una por hora */}
                {horasRows.map((hh) => (
                  <Fragment key={`row-${hh}`}>
                    <div className="flex items-center justify-end pr-1.5 text-[11px] font-bold text-stone-500">
                      <Clock size={11} className="mr-1 text-stone-400 shrink-0" />{hh}
                    </div>
                    {diasCols.map((d) => {
                      const slotMods = h[d][hh] as ModItem[];
                      const selectables = slotMods.filter((m) => !misExamenesIds.includes(m.id));
                      return (
                        <div key={`c-${d}-${hh}`} className="rounded-xl border border-stone-100 bg-stone-50/40 p-1.5 space-y-1.5">
                          {slotMods.length === 0 ? (
                            <div className="flex items-center justify-center text-[11px] text-stone-300 py-4">—</div>
                          ) : (
                            <>
                              {slotMods.map((m) => <ModuloCard key={m.id} m={m} />)}
                              {selectables.length > 1 && (
                                <div className="text-center text-[9px] text-stone-400 font-semibold uppercase tracking-wide">
                                  Empalmados · elige uno
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            </div>

            {/* Footer: conteo + total + solicitar */}
            <div className="flex items-center justify-between pt-4 border-t border-stone-200 flex-wrap gap-3">
              <div className="text-sm text-stone-500">
                <span className="font-bold text-stone-900">{seleccion.size}</span>{' '}
                módulo{seleccion.size !== 1 ? 's' : ''} seleccionado{seleccion.size !== 1 ? 's' : ''}
                {seleccion.size > 0 && (
                  <span className="ml-2 text-stone-400 text-xs">
                    — ${(seleccion.size * costoExamen).toLocaleString('es-MX')} MXN por pagar
                  </span>
                )}
              </div>
              <button
                onClick={handleInscribir}
                disabled={seleccion.size === 0 || inscribiendo}
                className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-guinda-700)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--color-guinda-800)] disabled:opacity-50 transition-colors"
              >
                {inscribiendo ? <Loader2 size={14} className="animate-spin" /> : <FileCheck size={14} />}
                {inscribiendo ? 'Solicitando…' : 'Pre-inscribir y solicitar ficha de pago'}
              </button>
            </div>
          </>
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

  // Editar pre-inscripción: confirmación + estado de la operación
  const [confirmEditar, setConfirmEditar] = useState(false);
  const [editando, setEditando] = useState(false);
  const [errorEditar, setErrorEditar] = useState<string | null>(null);

  // Expediente: estatus por documento para el checklist de requisitos
  const [expediente, setExpediente] = useState<ExpedienteResponse | null>(null);
  useEffect(() => {
    api.get<ExpedienteResponse>('/estudiante/expediente').then(setExpediente).catch(() => {});
  }, []);

  // Costo por examen (para el total al solicitar la inscripción)
  const [costoExamen, setCostoExamen] = useState(145);
  useEffect(() => {
    api.get<{ costoExamen: number }>('/estudiante/config-pago')
      .then((r) => { if (r?.costoExamen) setCostoExamen(r.costoExamen); })
      .catch(() => {});
  }, []);

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

  // Pre-inscripciones aún sin pago de la etapa activa (editables)
  const preinscritosNoPagados = etapaActiva
    ? misExamenes.filter((e) => e.etapa.clave === etapaActiva.clave && !e.pagado)
    : [];

  // Cancela todas las pre-inscripciones sin pago para que el alumno vuelva a
  // elegir módulos (esto elimina también su ficha de pago actual en el backend).
  async function handleEditarPreinscripcion() {
    setEditando(true);
    setErrorEditar(null);
    try {
      for (const e of preinscritosNoPagados) {
        await api.post(`/estudiante/convocatoria/inscripcion/${e.id}/cancelar`);
      }
      setConfirmEditar(false);
      await cargarConvocatoria();
    } catch (err) {
      setErrorEditar(err instanceof Error ? err.message : 'No se pudo editar la pre-inscripción');
    } finally {
      setEditando(false);
    }
  }

  // Etapa del calendario que corresponde a la activa
  const calendarioEtapaActiva = etapaActiva && calendarioData
    ? (calendarioData.etapas.find((e) => e.id === etapaActiva.id) ?? null)
    : null;

  return (
    <EstudianteLayout>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div>
          <h1 data-tour="insc-titulo" className="font-serif text-2xl font-bold text-stone-900">Mi Inscripción</h1>
          <p className="text-stone-500 text-sm mt-1">
            Consulta tu estado de inscripción, módulos disponibles y sede asignada.
          </p>
        </div>

        {/* Expediente incompleto — checklist de requisitos con estatus real */}
        {!requisitos.expedienteCompleto && (() => {
          const estadoDoc = (tipo: string): 'aprobado' | 'en_revision' | 'rechazado' | 'falta' => {
            const doc = expediente?.documentos?.[tipo as keyof typeof expediente.documentos];
            if (!doc) return 'falta';
            if (doc.estado === 'aprobado') return 'aprobado';
            if (doc.estado === 'rechazado') return 'rechazado';
            return 'en_revision';
          };
          const ESTADO_CFG = {
            aprobado:    { label: 'Aprobado',       icon: <CheckCircle2 size={14} className="text-emerald-600" />, chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
            en_revision: { label: 'En revisión',    icon: <Clock size={14} className="text-amber-600" />,          chip: 'bg-amber-50 text-amber-700 border-amber-200' },
            rechazado:   { label: 'Rechazado',      icon: <XCircle size={14} className="text-red-600" />,          chip: 'bg-red-50 text-red-700 border-red-200' },
            falta:       { label: 'Falta subir',    icon: <AlertTriangle size={14} className="text-stone-400" />,  chip: 'bg-stone-50 text-stone-500 border-stone-200' },
          } as const;
          const aprobadosCount = DOCS_EXPEDIENTE.filter((d) => estadoDoc(d.tipo) === 'aprobado').length;

          return (
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              {/* Encabezado con progreso */}
              <div className="px-5 py-4 border-b border-stone-100 bg-amber-50/60">
                <div className="flex items-center justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                      <FileCheck size={17} />
                    </div>
                    <div>
                      <p className="font-bold text-stone-900 text-sm">Completa tu expediente para inscribirte</p>
                      <p className="text-xs text-stone-500">Necesitas los 5 documentos aprobados por la administración.</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xl font-bold font-serif text-stone-900">{aprobadosCount}</span>
                    <span className="text-sm text-stone-400">/{DOCS_EXPEDIENTE.length}</span>
                    <div className="text-[10px] text-stone-400 uppercase tracking-wide">aprobados</div>
                  </div>
                </div>
                <div className="h-1.5 bg-white rounded-full overflow-hidden border border-amber-100">
                  <div
                    className="h-full rounded-full bg-[var(--color-guinda-700)] transition-all"
                    style={{ width: `${(aprobadosCount / DOCS_EXPEDIENTE.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Checklist de documentos */}
              <div className="divide-y divide-stone-100">
                {DOCS_EXPEDIENTE.map(({ tipo, label }) => {
                  const estado = estadoDoc(tipo);
                  const cfg = ESTADO_CFG[estado];
                  return (
                    <div key={tipo} className="px-5 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {cfg.icon}
                        <span className={`text-sm ${estado === 'aprobado' ? 'text-stone-400 line-through' : 'text-stone-800 font-medium'}`}>
                          {label}
                        </span>
                      </div>
                      <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cfg.chip}`}>
                        {cfg.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* CTA */}
              <div className="px-5 py-4 bg-stone-50 border-t border-stone-100">
                <Link href="/estudiante/expediente">
                  <button className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-[var(--color-guinda-700)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--color-guinda-800)] transition-colors">
                    Completar mi expediente <ChevronRight size={15} />
                  </button>
                </Link>
              </div>
            </div>
          );
        })()}

        {/* Expediente aprobado pero sin matrícula oficial */}
        {requisitos.expedienteCompleto && !requisitos.tieneMatricula && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-800 text-sm">Falta tu matrícula oficial</p>
                <p className="text-amber-700 text-sm mt-1">
                  Tu expediente está completo. La inscripción a exámenes se abrirá cuando la administración
                  registre tu <strong>matrícula oficial</strong>, una vez que la Secretaría (SEP-DGB) valide tu
                  expediente. Si tienes dudas del estatus de tu cuenta, contacta a tu gestor o a la administración.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Banner etapa activa */}
        {requisitos.puedeInscribirse && etapaActiva && (
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
        {requisitos.puedeInscribirse && etapaActiva && etapaActiva.estado === 'inscripcion_abierta' && (
          <ModulosInscripcion
            etapa={etapaActiva}
            calendarioEtapa={calendarioLoading ? null : calendarioEtapaActiva}
            misExamenesIds={misModulosInscritos}
            costoExamen={costoExamen}
            hayPreinscripcion={preinscritosNoPagados.length > 0}
            onEditarPreinscripcion={() => { setErrorEditar(null); setConfirmEditar(true); }}
            onSuccess={() => cargarConvocatoria()}
          />
        )}

        {/* Mis exámenes inscritos */}
        {tieneExamenes && (
          <div>
            <h2 className="font-semibold text-stone-800 flex items-center gap-2 mb-3">
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

        {/* ¿Cómo termino mi inscripción? */}
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100 bg-[var(--color-crema-100)] flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-[var(--color-guinda-700)]" />
            <p className="font-bold text-stone-900 text-sm">¿Cómo termino mi inscripción?</p>
          </div>
          <div className="p-5">
            <p className="text-sm text-stone-600 leading-relaxed mb-4">
              Al pre-inscribirte generamos tu <strong>ficha de pago</strong>. Tu lugar queda{' '}
              <strong>confirmado</strong> únicamente cuando el pago se valida — hasta entonces apareces
              como <em>pre-inscrito</em>.
            </p>
            <ol className="space-y-3">
              {[
                { n: 1, t: 'Descarga tu ficha de pago', d: 'En la sección Pagos está tu ficha con la línea de captura y el monto.' },
                { n: 2, t: 'Realiza el pago', d: 'Cúbrela en el banco o en línea antes de la fecha límite de la etapa.' },
                { n: 3, t: 'Espera la confirmación', d: 'Cuando el pago se valida, tu inscripción pasa a “confirmada”.' },
                { n: 4, t: 'Descarga tu pase', d: 'Ya confirmada, descarga tu pase y preséntate en la sede el día del examen.' },
              ].map((s) => (
                <li key={s.n} className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-[var(--color-guinda-700)] text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {s.n}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-stone-800">{s.t}</p>
                    <p className="text-xs text-stone-500 leading-snug">{s.d}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link href="/estudiante/pagos">
              <button className="mt-5 w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-[var(--color-guinda-700)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--color-guinda-800)] transition-colors">
                Ir a Pagos <ChevronRight size={15} />
              </button>
            </Link>
          </div>
        </div>

        {/* Próximas etapas */}
        <ProximasEtapasSection etapas={proximasEtapas} />

      </div>

      {/* Popup: confirmar edición de pre-inscripción */}
      {confirmEditar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-stone-900">¿Seguro que quieres modificar tu pre-inscripción?</h3>
                <p className="text-sm text-stone-600 mt-1 leading-relaxed">
                  Se eliminará la pre-inscripción actual y deberás solicitar otra{' '}
                  <strong>ficha de pago</strong> al volver a elegir tus módulos.
                </p>
              </div>
            </div>

            {errorEditar && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-2.5 flex items-start gap-2 text-xs text-red-700">
                <XCircle size={14} className="shrink-0 mt-0.5" />
                {errorEditar}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setConfirmEditar(false)}
                disabled={editando}
                className="px-4 py-2 text-sm font-semibold text-stone-600 rounded-lg hover:bg-stone-100 disabled:opacity-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleEditarPreinscripcion}
                disabled={editando}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--color-guinda-700)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--color-guinda-800)] disabled:opacity-50 transition-colors"
              >
                {editando ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />}
                {editando ? 'Eliminando…' : 'Sí, modificar'}
              </button>
            </div>
          </div>
        </div>
      )}

          <PageTour storageKey="edumich_tour_inscripcion_v1" steps={TOUR_INSCRIPCION} />
    </EstudianteLayout>
  );
}
