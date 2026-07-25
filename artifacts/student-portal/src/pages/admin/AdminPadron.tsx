import { AdminLayout } from './AdminLayout';
import { PadronHistorico } from '../../components/PadronHistorico';
import { SectionTour } from '../../components/onboarding/SectionTour';
import { TOUR_A_PADRON, GATE_ADMIN } from '../../components/onboarding/seccionesAdmin';

export default function AdminPadron() {
  return (
    <AdminLayout>
      <PadronHistorico />
      <SectionTour
        steps={TOUR_A_PADRON}
        storageKey="sec_admin_padron"
        gateKey={GATE_ADMIN}
        buttonLabel="Tutorial del padrón"
      />
    </AdminLayout>
  );
}
