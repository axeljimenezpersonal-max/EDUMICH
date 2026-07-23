import { GestorLayout } from './GestorLayout';
import { PreguntasFrecuentes } from '../../components/PreguntasFrecuentes';

export default function GestorFaq() {
  return (
    <GestorLayout>
      <PreguntasFrecuentes rol="gestor" />
    </GestorLayout>
  );
}
