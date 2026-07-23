/**
 * Aviso "en preparación" para el módulo de Reportes. Durante el primer mes la
 * prioridad es la operación administrativa; los reportes y gráficas se definen
 * con datos reales una vez que haya un mes completo. El módulo se deja visible
 * (para vista previa de dirección/Sinapsis) pero atenuado en gris.
 */
import { Construction } from 'lucide-react';

export function AvisoModuloReportes() {
  return (
    <div className="mb-5 flex items-start gap-3 rounded-xl border border-stone-300 bg-stone-100 p-4">
      <Construction size={18} className="shrink-0 mt-0.5 text-stone-500" />
      <div className="min-w-0">
        <div className="text-sm font-bold text-stone-700">Reportes en preparación · primer mes</div>
        <p className="text-[13px] mt-0.5 leading-relaxed text-stone-600">
          Durante el primer mes la prioridad es la operación administrativa. Las gráficas y reportes
          se afinarán con los datos reales cuando haya un mes completo; por ahora los ves en gris,
          a modo de vista previa.
        </p>
      </div>
    </div>
  );
}
