/**
 * Placeholder del módulo de Reportes mientras no está listo. Durante el primer
 * mes la prioridad es la operación administrativa; los reportes y gráficas se
 * habilitarán con datos reales cuando haya un mes completo. Hasta entonces el
 * módulo NO muestra panel ni gráficas (nada clickeable), solo este aviso.
 *
 * Para reactivar todo el módulo, pon REPORTES_LISTOS en true (un solo lugar).
 */
import { Construction } from 'lucide-react';

export const REPORTES_LISTOS = false;

export function AvisoModuloReportes() {
  return (
    <div className="max-w-lg mx-auto text-center py-20">
      <div className="w-14 h-14 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto mb-4">
        <Construction size={26} className="text-stone-400" />
      </div>
      <h2 className="font-serif text-xl font-bold text-stone-800 mb-1.5">Reportes en preparación</h2>
      <p className="text-sm text-stone-500 leading-relaxed">
        Durante el primer mes la prioridad es la operación administrativa. Las gráficas y reportes
        se habilitarán con los datos reales, una vez que haya un mes completo.
      </p>
    </div>
  );
}
