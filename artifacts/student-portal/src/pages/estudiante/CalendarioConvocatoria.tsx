/**
 * Calendario de Convocatoria — vista por mes con módulos y horarios.
 * Permite al alumno inscribirse a módulos desde un modal.
 */

import { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import {
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  X,
  ArrowLeft,
  BookOpen,
} from 'lucide-react';
import { EstudianteLayout } from './EstudianteLayout';
import { api } from '../../lib/api';
import type { CalendarioMes } from '../../lib/api';

// ── Helpers ───────────────────────────────────────────────────────────────

const MESES = [
  { val: '2026-05', label: 'Mayo' },
  { val: '2026-06', label: 'Junio' },
  { val: '2026-07', label: 'Julio' },
  { val: '2026-08', label: 'Agosto' },
];

function formatFechaCorta(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

// ── Modal de inscripción ──────────────────────────────────────────────────

type ModItem = { id: number; numero: number; nombre: string };
type HorariosDisponibles = CalendarioMes['etapas'][0]['horariosDisponibles'];

interface InscribirseModalProps {
  etapaId: number;
  etapaClave: string;
  horariosDisponibles: HorariosDisponibles;
  yaInscritos: number[];
  onSuccess: () => void;
  onClose: () => void;
}

function InscribirseModal({
  etapaId,
  etapaClave,
  horariosDisponibles,
  yaInscritos,
  onSuccess,
  onClose,
}: InscribirseModalProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build map: moduloId → slot key for conflict detection
  const moduloSlotMap = new Map<number, string>();
  const dias = ['sabado', 'domingo'] as const;
  const horas = ['09:00', '11:00'] as const;
  for (const dia of dias) {
    for (const hora of horas) {
      const lista: ModItem[] = horariosDisponibles[dia][hora];
      for (const m of lista) {
        moduloSlotMap.set(m.id, `${dia}|${hora}`);
      }
    }
  }

  // Build occupied slots from already-inscribed modules
  const occupiedSlots = new Set<string>();
  for (const modId of yaInscritos) {
    const slot = moduloSlotMap.get(modId);
    if (slot) occupiedSlots.add(slot);
  }

  // Slots occupied by current selection
  const selectedSlots = new Set<string>();
  for (const modId of selected) {
    const slot = moduloSlotMap.get(modId);
    if (slot) selectedSlots.add(slot);
  }

  function toggleModulo(modId: number) {
    if (yaInscritos.includes(modId)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(modId)) {
        next.delete(modId);
      } else {
        next.add(modId);
      }
      return next;
    });
  }

  function isDisabled(modId: number): boolean {
    if (yaInscritos.includes(modId)) return false; // shown as checked, not disabled per se
    if (selected.has(modId)) return false;
    const slot = moduloSlotMap.get(modId);
    if (!slot) return false;
    return occupiedSlots.has(slot) || selectedSlots.has(slot);
  }

  async function handleSubmit() {
    if (selected.size === 0) return;
    setLoading(true);
    setError(null);
    try {
      await api.post('/estudiante/convocatoria/inscribirme', {
        etapaId,
        modulosIds: Array.from(selected),
      });
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al inscribirse');
    } finally {
      setLoading(false);
    }
  }

  const sections: Array<{
    title: string;
    dia: 'sabado' | 'domingo';
    hora: '09:00' | '11:00';
  }> = [
    { title: 'Sábado 09:00', dia: 'sabado', hora: '09:00' },
    { title: 'Sábado 11:00', dia: 'sabado', hora: '11:00' },
    { title: 'Domingo 09:00', dia: 'domingo', hora: '09:00' },
    { title: 'Domingo 11:00', dia: 'domingo', hora: '11:00' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200">
          <div>
            <p className="font-bold text-stone-900">Inscribirse a módulos</p>
            <p className="text-xs text-stone-500">Etapa {etapaClave}</p>
          </div>
          <button onClick={onClose} className="p-1 text-stone-400 hover:text-stone-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-start gap-2">
              <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {sections.map(({ title, dia, hora }) => {
            const lista: ModItem[] = horariosDisponibles[dia][hora];
            if (lista.length === 0) return null;
            return (
              <div key={title}>
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {title}
                </p>
                <div className="space-y-1">
                  {lista.map((m) => {
                    const isAlreadyIn = yaInscritos.includes(m.id);
                    const isSelected = selected.has(m.id);
                    const disabled = !isAlreadyIn && isDisabled(m.id);

                    return (
                      <label
                        key={m.id}
                        className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                          isAlreadyIn
                            ? 'bg-green-50 border border-green-200'
                            : isSelected
                            ? 'bg-[var(--color-crema-100)] border border-[var(--color-guinda-700)]'
                            : disabled
                            ? 'bg-stone-50 border border-stone-100 opacity-40 cursor-not-allowed'
                            : 'bg-stone-50 border border-stone-100 hover:border-stone-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isAlreadyIn || isSelected}
                          disabled={isAlreadyIn || disabled}
                          onChange={() => toggleModulo(m.id)}
                          className="w-4 h-4 accent-[var(--color-guinda-700)]"
                        />
                        <span className="text-sm text-stone-800 flex-1 min-w-0">
                          <span className="font-medium text-[var(--color-guinda-700)] mr-1">
                            M{m.numero}
                          </span>
                          <span className="truncate">{m.nombre}</span>
                        </span>
                        {isAlreadyIn && (
                          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-stone-200 flex items-center justify-between gap-3">
          <p className="text-sm text-stone-600">
            {selected.size} módulo{selected.size !== 1 ? 's' : ''} seleccionado{selected.size !== 1 ? 's' : ''}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={selected.size === 0 || loading}
              className="px-4 py-2 text-sm font-semibold bg-[var(--color-guinda-700)] text-white rounded-lg hover:bg-[var(--color-guinda-800)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Inscribiendo...' : `Inscribir ${selected.size > 0 ? selected.size : ''} módulo${selected.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── EtapaCard ─────────────────────────────────────────────────────────────

interface EtapaCardProps {
  etapa: CalendarioMes['etapas'][0];
  onInscribirse: () => void;
}

function EtapaCard({ etapa, onInscribirse }: EtapaCardProps) {
  const dias = ['sabado', 'domingo'] as const;
  const horas = ['09:00', '11:00'] as const;

  return (
    <div className={`border border-stone-200 rounded-xl overflow-hidden shadow-sm ${!etapa.inscripcionAbierta ? 'opacity-70' : ''}`}>
      {/* Header */}
      <div className="bg-[var(--color-crema-100)] px-4 py-3 border-b border-stone-200">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="bg-[var(--color-guinda-700)] text-white text-xs font-bold px-2 py-0.5 rounded">
              {etapa.clave}
            </span>
            <span className="text-sm text-stone-600">
              Solicitud: {formatFechaCorta(etapa.solicitudInicio)} — {formatFechaCorta(etapa.solicitudFin)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {etapa.inscripcionAbierta ? (
              <>
                <span className="text-xs bg-green-100 text-green-700 border border-green-300 px-2 py-0.5 rounded-full font-medium">
                  Inscripción abierta
                </span>
                {etapa.diasRestantesParaInscribirse > 0 && (
                  <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                    {etapa.diasRestantesParaInscribirse} días
                  </span>
                )}
              </>
            ) : (
              <span className="text-xs bg-stone-100 text-stone-500 border border-stone-200 px-2 py-0.5 rounded-full">
                {etapa.estado === 'programada' ? 'Próximamente' : etapa.estado}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Body: 2 cols sábado / domingo */}
      <div className="bg-white p-4 grid grid-cols-2 gap-4">
        {dias.map((dia) => (
          <div key={dia}>
            <p className="text-xs font-bold text-stone-700 uppercase tracking-wide mb-2 border-b border-stone-100 pb-1">
              {dia === 'sabado' ? 'Sábado' : 'Domingo'}{' '}
              <span className="font-normal text-stone-400 text-[11px]">
                {formatFechaCorta(dia === 'sabado' ? etapa.examenSabado : etapa.examenDomingo)}
              </span>
            </p>
            {horas.map((hora) => {
              const lista: Array<{ id: number; numero: number; nombre: string }> =
                etapa.horariosDisponibles[dia][hora];
              if (lista.length === 0) return null;
              return (
                <div key={hora} className="mb-3">
                  <p className="text-[11px] text-stone-400 font-medium mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {hora} hrs
                  </p>
                  <ul className="space-y-0.5">
                    {lista.map((m) => {
                      const isInscrito = etapa.yaInscritoEnModulos.includes(m.id);
                      return (
                        <li
                          key={m.id}
                          className={`text-xs flex items-center gap-1 px-1.5 py-0.5 rounded ${
                            isInscrito
                              ? 'bg-green-50 text-green-800'
                              : 'text-stone-700'
                          }`}
                        >
                          {isInscrito && <CheckCircle2 className="w-3 h-3 text-green-600 flex-shrink-0" />}
                          <span className="font-medium text-[var(--color-guinda-700)] mr-0.5">M{m.numero}</span>
                          <span className="truncate" title={m.nombre}>{m.nombre}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer action */}
      {etapa.inscripcionAbierta && (
        <div className="px-4 py-3 border-t border-stone-100 bg-stone-50">
          <button
            onClick={onInscribirse}
            className="w-full bg-[var(--color-guinda-700)] text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-[var(--color-guinda-800)] transition-colors flex items-center justify-center gap-2"
          >
            <BookOpen className="w-4 h-4" />
            Inscribirme a módulos
          </button>
        </div>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────

export default function CalendarioConvocatoria() {
  const [location] = useLocation();
  const params = new URLSearchParams(location.includes('?') ? location.split('?')[1] : '');
  const mesPorDefecto = params.get('mes') ?? '2026-06';

  const [mes, setMes] = useState(mesPorDefecto);
  const [data, setData] = useState<CalendarioMes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalEtapa, setModalEtapa] = useState<CalendarioMes['etapas'][0] | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const cargar = useCallback(
    (m: string) => {
      setLoading(true);
      setError(null);
      api
        .get<CalendarioMes>(`/estudiante/convocatoria/calendario?mes=${m}`)
        .then(setData)
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false));
    },
    []
  );

  useEffect(() => {
    cargar(mes);
  }, [mes, cargar]);

  function handleSuccess() {
    setModalEtapa(null);
    setExito('Inscripción completada. Ya puedes descargar tu pase de examen.');
    cargar(mes);
  }

  return (
    <EstudianteLayout>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* Back link */}
        <div>
          <a href="/estudiante/convocatoria" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-guinda-700)] hover:underline">
            <ArrowLeft className="w-4 h-4" />
            Regresar a Mi Convocatoria
          </a>
        </div>

        <div>
          <h1 className="font-serif text-2xl font-bold text-stone-900">Calendario de exámenes</h1>
          <p className="text-stone-500 text-sm mt-1">
            Elige el mes para ver etapas y módulos disponibles.
          </p>
        </div>

        {/* Éxito */}
        {exito && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-green-800 text-sm font-medium">{exito}</p>
              <a href="/estudiante/convocatoria" className="text-sm text-green-700 underline mt-1 inline-block">
                Ver mis inscripciones
              </a>
            </div>
            <button onClick={() => setExito(null)} className="text-green-400 hover:text-green-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tabs de meses */}
        <div className="flex gap-1 border-b border-stone-200">
          {MESES.map(({ val, label }) => (
            <button
              key={val}
              onClick={() => setMes(val)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                mes === val
                  ? 'border-[var(--color-guinda-700)] text-[var(--color-guinda-700)]'
                  : 'border-transparent text-stone-500 hover:text-stone-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-4 border-[var(--color-guinda-700)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-10 text-stone-500">
            <XCircle className="w-10 h-10 text-red-300 mx-auto mb-2" />
            <p>{error}</p>
          </div>
        ) : !data || data.etapas.length === 0 ? (
          <div className="text-center py-16 text-stone-400">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No hay etapas programadas para este mes.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {data.etapas.map((etapa) => (
              <EtapaCard
                key={etapa.id}
                etapa={etapa}
                onInscribirse={() => setModalEtapa(etapa)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalEtapa && (
        <InscribirseModal
          etapaId={modalEtapa.id}
          etapaClave={modalEtapa.clave}
          horariosDisponibles={modalEtapa.horariosDisponibles}
          yaInscritos={modalEtapa.yaInscritoEnModulos}
          onSuccess={handleSuccess}
          onClose={() => setModalEtapa(null)}
        />
      )}
    </EstudianteLayout>
  );
}
