import { GestorLayout } from './GestorLayout';
import { PreguntasFrecuentes } from '../../components/PreguntasFrecuentes';
import { SectionTour } from '../../components/onboarding/SectionTour';
import { TOUR_G_FAQ, GATE_GESTOR } from '../../components/onboarding/seccionesGestor';

export default function GestorFaq() {
  return (
    <GestorLayout>
      <PreguntasFrecuentes rol="gestor" />
      <SectionTour
        steps={TOUR_G_FAQ}
        storageKey="modula_sec_g_faq_v1"
        gateKey={GATE_GESTOR}
        buttonLabel="Tutorial de ayuda"
      />
    </GestorLayout>
  );
}
