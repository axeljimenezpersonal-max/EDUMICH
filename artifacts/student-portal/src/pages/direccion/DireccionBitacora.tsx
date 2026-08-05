/**
 * Bitácora de actividad — panel del CREADOR (Sinapsis).
 *
 * A diferencia de la bitácora del admin (que oculta lo que hace el creador),
 * aquí se ve TODO el historial del sistema: sirve para auditar quién hizo qué
 * dentro del equipo. Reutiliza el mismo componente de tabla del admin, solo que
 * apunta al endpoint /api/direccion/bitacora.
 */
import { ClipboardList } from 'lucide-react';
import { DireccionLayout } from './DireccionLayout';
import Bitacora from '../admin/config/Bitacora';
import { IntegridadBitacora } from '../../components/IntegridadBitacora';

export default function DireccionBitacora() {
  return (
    <DireccionLayout>
      <div className="mx-auto max-w-6xl px-1 py-2">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: 'var(--color-crema-100)', color: 'var(--color-guinda-700)' }}>
            <ClipboardList size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-stone-900">Bitácora de actividad</h1>
            <p className="mt-0.5 text-sm text-stone-500">
              Quién hizo qué en todo el sistema — incluye la operación del creador.
            </p>
          </div>
        </div>
        <IntegridadBitacora endpoint="/api/direccion/bitacora/integridad" />
        <Bitacora endpoint="/api/direccion/bitacora" />
      </div>
    </DireccionLayout>
  );
}
