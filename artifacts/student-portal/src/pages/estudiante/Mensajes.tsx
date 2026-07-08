/**
 * Chat del estudiante con la Secretaría.
 */

import { EstudianteLayout } from './EstudianteLayout';
import { SectionTour } from '../../components/onboarding/SectionTour';
import { TOUR_MENSAJES, GATE_ESTUDIANTE } from '../../components/onboarding/seccionesEstudiante';
import { CitizenChat } from '../../components/chat/CitizenChat';

export default function Mensajes() {
  return (
    <EstudianteLayout>
      <CitizenChat />
      <SectionTour
        steps={TOUR_MENSAJES}
        storageKey="edumich_sec_mensajes_v1"
        gateKey={GATE_ESTUDIANTE}
        buttonLabel="Tutorial de Mensajes"
      />
    </EstudianteLayout>
  );
}
