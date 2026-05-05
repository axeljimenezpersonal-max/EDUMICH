/**
 * Header institucional con la imagen oficial Gobierno de Michoacán + IEMSyS.
 * Reusa el mismo patrón de los temarios oficiales.
 *
 * Ubicación destino en Replit: artifacts/student-portal/src/components/InstitutionalHeader.tsx
 */

import { LogOut, User } from 'lucide-react';

interface Props {
  userName?: string;
  userRole?: string;
  onLogout?: () => void;
}

export function InstitutionalHeader({ userName, userRole, onLogout }: Props) {
  return (
    <header className="border-b-4 border-[var(--color-guinda-700)] bg-white">
      {/* Banda institucional superior */}
      <div className="bg-[var(--color-guinda-700)] text-white text-xs">
        <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center justify-between">
          <span className="font-medium tracking-wide">
            GOBIERNO DEL ESTADO DE MICHOACÁN · HONESTIDAD Y TRABAJO
          </span>
          <span className="hidden sm:inline opacity-80">prepaabierta.michoacan.gob.mx</span>
        </div>
      </div>

      {/* Cabecera con logos y branding */}
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          {/* Logo izquierdo: escudo Gobierno de Michoacán */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-sm bg-[var(--color-guinda-700)] flex items-center justify-center text-white font-serif text-lg">
              GM
            </div>
            <div className="leading-tight">
              <div className="font-serif text-sm font-semibold text-[var(--color-guinda-800)]">
                Gobierno de
              </div>
              <div className="font-serif text-sm font-semibold text-[var(--color-guinda-800)]">
                Michoacán
              </div>
              <div className="text-[10px] tracking-widest text-stone-500 mt-0.5">
                HONESTIDAD Y TRABAJO
              </div>
            </div>
          </div>

          {/* Separador */}
          <div className="hidden md:block w-px h-12 bg-stone-300"></div>

          {/* Identidad del sistema */}
          <div className="hidden md:block leading-tight">
            <div className="font-serif text-lg font-bold text-[var(--color-piedra-900)]">
              Prepa Abierta
            </div>
            <div className="text-xs text-stone-600">
              Sistema de Gestión · IEMSyS
            </div>
          </div>
        </div>

        {/* Usuario / sesión */}
        {userName && (
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right leading-tight">
              <div className="text-sm font-medium text-stone-800">{userName}</div>
              {userRole && (
                <div className="text-xs uppercase tracking-wider text-[var(--color-guinda-700)] font-semibold">
                  {userRole}
                </div>
              )}
            </div>
            <div className="w-9 h-9 rounded-full bg-[var(--color-crema-200)] flex items-center justify-center text-[var(--color-guinda-700)]">
              <User size={18} />
            </div>
            {onLogout && (
              <button
                onClick={onLogout}
                className="p-2 rounded-md text-stone-500 hover:text-[var(--color-guinda-700)] hover:bg-[var(--color-crema-100)] transition-colors"
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
              >
                <LogOut size={18} />
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
