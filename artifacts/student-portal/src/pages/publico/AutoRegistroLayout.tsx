import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  paso?: number; // 1, 2, 3
}

const PASOS = ['Tu correo', 'Código', 'Tus datos'];

export function AutoRegistroLayout({ children, paso }: Props) {
  return (
    <div className="min-h-screen bg-[var(--color-crema-100)] flex flex-col">
      {/* Banda + header pegado arriba */}
      <div className="sticky top-0 z-50 shadow-sm">
        {/* Banda institucional */}
        <div className="bg-[var(--color-guinda-700)] text-white text-xs">
          <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center justify-between">
            <span className="font-medium tracking-wide">
              GOBIERNO DEL ESTADO DE MICHOACÁN · HONESTIDAD Y TRABAJO
            </span>
            <a href="/login" className="opacity-80 hover:opacity-100 underline text-xs">
              Iniciar sesión
            </a>
          </div>
        </div>

        {/* Header minificado */}
        <header className="border-b border-stone-200 bg-white">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-[var(--color-guinda-700)] text-white flex items-center justify-center font-serif font-bold text-sm">
              GM
            </div>
            <div className="leading-tight">
              <div className="font-serif text-sm font-semibold text-stone-900">
                Prepa Abierta · IEMSyS
              </div>
              <div className="text-[10px] text-stone-500">Gobierno de Michoacán</div>
            </div>
          </div>
        </header>
      </div>

      {/* Wizard indicator */}
      {paso !== undefined && (
        <div className="bg-white border-b border-stone-100">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-center gap-0">
            {PASOS.map((label, i) => {
              const num = i + 1;
              const done = num < paso;
              const active = num === paso;
              return (
                <div key={num} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                        done
                          ? 'bg-green-600 text-white'
                          : active
                          ? 'bg-[var(--color-guinda-700)] text-white'
                          : 'bg-stone-200 text-stone-500'
                      }`}
                    >
                      {done ? '✓' : num}
                    </div>
                    <div
                      className={`text-[10px] mt-1 font-medium ${
                        active
                          ? 'text-[var(--color-guinda-700)]'
                          : done
                          ? 'text-green-600'
                          : 'text-stone-400'
                      }`}
                    >
                      {label}
                    </div>
                  </div>
                  {i < PASOS.length - 1 && (
                    <div
                      className={`w-16 h-0.5 mx-2 mb-4 ${done ? 'bg-green-400' : 'bg-stone-200'}`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Contenido */}
      <div className="flex-1 flex items-start justify-center py-8 px-4">
        <div className="w-full max-w-lg">{children}</div>
      </div>
    </div>
  );
}
