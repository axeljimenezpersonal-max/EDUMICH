/**
 * Modal de confirmación profesional (reemplaza confirm()/prompt() del navegador).
 *
 * - `danger` → estilo rojo para acciones destructivas.
 * - `withInput` → muestra un textarea (p. ej. motivo de rechazo); su valor va a onConfirm.
 * - `requireText` → el usuario debe escribir esa palabra exacta para habilitar el
 *   botón de confirmar (para acciones que "no deben ser tan fáciles", como reponer).
 */
import { useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { ModalHoja } from './ui/responsive';

interface Props {
  icon?: ReactNode;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  withInput?: boolean;
  inputPlaceholder?: string;
  requireText?: string;
  onConfirm: (input?: string) => void;
  onClose: () => void;
}

export function ConfirmModal({ icon, title, message, confirmLabel, danger, withInput, inputPlaceholder, requireText, onConfirm, onClose }: Props) {
  const [val, setVal] = useState('');
  const [typed, setTyped] = useState('');
  const habilitado = !requireText || typed.trim().toUpperCase() === requireText.toUpperCase();

  return (
    <ModalHoja
      onClose={onClose}
      etiqueta={title}
      pie={
        <div className="flex gap-2 border-t border-stone-100 bg-stone-50 px-5 py-3">
          <button onClick={onClose} className="min-h-[44px] flex-1 rounded-lg border border-stone-300 text-sm font-semibold text-stone-600 hover:bg-white">Cancelar</button>
          <button onClick={() => onConfirm(val)} disabled={!habilitado}
            className={`min-h-[44px] flex-1 rounded-lg text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-[var(--color-guinda-700)] hover:bg-[var(--color-guinda-800)]'}`}>
            {confirmLabel}
          </button>
        </div>
      }
    >
      <div className="p-5">
        <div className="flex items-start gap-3">
          {icon && (
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${danger ? 'bg-red-100 text-red-600' : 'bg-[var(--color-guinda-100,#f3dbe4)] text-[var(--color-guinda-700)]'}`}>
              {icon}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-serif text-lg font-bold text-stone-900">{title}</h3>
            <div className="text-sm text-stone-600 mt-1 leading-relaxed">{message}</div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="-mr-1.5 -mt-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-600"><X size={18} /></button>
        </div>

        {withInput && (
          <textarea value={val} onChange={(e) => setVal(e.target.value)} rows={2} placeholder={inputPlaceholder} autoFocus
            className="w-full mt-3 text-sm border border-stone-300 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-[var(--color-guinda-700)]" />
        )}

        {requireText && (
          <div className="mt-3">
            <label className="block text-xs font-semibold text-stone-600 mb-1">
              Para confirmar, escribe <span className="font-mono text-[var(--color-guinda-700)]">{requireText}</span>
            </label>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus
              className="w-full text-sm border border-stone-300 rounded-lg px-3 py-2 font-mono focus:outline-none focus:border-[var(--color-guinda-700)]" />
          </div>
        )}
      </div>
    </ModalHoja>
  );
}

export default ConfirmModal;
