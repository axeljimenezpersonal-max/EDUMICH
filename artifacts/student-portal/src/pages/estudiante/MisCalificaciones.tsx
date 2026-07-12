/**
 * Mis calificaciones — sección propia del alumno.
 *
 * Reutiliza CalificacionesTabContent (módulos aprobados por nivel, historial
 * de exámenes, evaluaciones de práctica y descarga del historial en PDF).
 */

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { EstudianteLayout } from './EstudianteLayout';
import { SectionTour } from '../../components/onboarding/SectionTour';
import { TOUR_CALIFICACIONES, GATE_ESTUDIANTE } from '../../components/onboarding/seccionesEstudiante';
import CalificacionesTabContent from '../../components/CalificacionesTabContent';
import { AyudaMensajes } from '../../components/AyudaMensajes';
import { api, type MeResponse } from '../../lib/api';

export default function MisCalificaciones() {
  const [meId, setMeId] = useState<number | null>(null);

  useEffect(() => {
    api.get<MeResponse>('/auth/me').then((me) => setMeId(me.id)).catch(() => {});
  }, []);

  return (
    <EstudianteLayout>
      {/* Header */}
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-guinda-700)] mb-1">
          MIS CALIFICACIONES
        </div>
        <h1 data-tour="calif-titulo" className="font-serif text-2xl font-bold text-stone-900">Historial académico</h1>
        <p className="text-stone-500 text-sm mt-1">
          Tus módulos aprobados, resultados de exámenes oficiales y evaluaciones de práctica.
        </p>
      </div>

      {meId === null ? (
        <div className="flex items-center justify-center py-16 text-stone-400 gap-2 text-sm">
          <Loader2 size={18} className="animate-spin" /> Cargando…
        </div>
      ) : (
        <div data-tour="calif-contenido">
          <CalificacionesTabContent estudianteId={meId} readOnly={true} />
        </div>
      )}

      <div className="mt-6">
        <AyudaMensajes contexto="tus calificaciones" />
      </div>

      <SectionTour
        steps={TOUR_CALIFICACIONES}
        storageKey="edumich_sec_calificaciones_v1"
        gateKey={GATE_ESTUDIANTE}
        buttonLabel="Tutorial de Calificaciones"
      />
    </EstudianteLayout>
  );
}
