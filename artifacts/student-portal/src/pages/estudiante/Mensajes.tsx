/**
 * Chat del estudiante con la Secretaría.
 */

import { EstudianteLayout } from './EstudianteLayout';
import { PageTour } from '../../components/tour/PageTour';
import { TOUR_MENSAJES } from '../../components/tour/estudianteToursPagina';
import { CitizenChat } from '../../components/chat/CitizenChat';

export default function Mensajes() {
  return (
    <EstudianteLayout>
      <CitizenChat />
          <PageTour storageKey="edumich_tour_mensajes_v1" steps={TOUR_MENSAJES} />
    </EstudianteLayout>
  );
}
