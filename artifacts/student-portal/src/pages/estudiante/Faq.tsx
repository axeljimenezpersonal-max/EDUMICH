import { EstudianteLayout } from './EstudianteLayout';
import { PreguntasFrecuentes } from '../../components/PreguntasFrecuentes';

export default function Faq() {
  return (
    <EstudianteLayout>
      <PreguntasFrecuentes rol="estudiante" />
    </EstudianteLayout>
  );
}
