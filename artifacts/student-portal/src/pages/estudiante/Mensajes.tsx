/**
 * Chat del estudiante con la Secretaría.
 */

import { EstudianteLayout } from './EstudianteLayout';
import { CitizenChat } from '../../components/chat/CitizenChat';

export default function Mensajes() {
  return (
    <EstudianteLayout>
      <CitizenChat />
    </EstudianteLayout>
  );
}
