/**
 * Chat del gestor con la Secretaría.
 */

import { GestorLayout } from './GestorLayout';
import { CitizenChat } from '../../components/chat/CitizenChat';
import { SectionTour } from '../../components/onboarding/SectionTour';
import { TOUR_G_MENSAJES, GATE_GESTOR } from '../../components/onboarding/seccionesGestor';

export default function GestorMensajes() {
  return (
    <GestorLayout>
      <CitizenChat />
      <SectionTour
        steps={TOUR_G_MENSAJES}
        storageKey="modula_sec_g_mensajes_v1"
        gateKey={GATE_GESTOR}
        buttonLabel="Tutorial de mensajes"
      />
    </GestorLayout>
  );
}
