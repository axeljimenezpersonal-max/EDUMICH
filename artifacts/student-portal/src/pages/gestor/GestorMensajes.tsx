/**
 * Chat del gestor con la Secretaría.
 */

import { GestorLayout } from './GestorLayout';
import { CitizenChat } from '../../components/chat/CitizenChat';

export default function GestorMensajes() {
  return (
    <GestorLayout>
      <CitizenChat />
    </GestorLayout>
  );
}
