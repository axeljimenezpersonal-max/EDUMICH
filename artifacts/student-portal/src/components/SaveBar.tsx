import { useEffect, useState } from 'react';
import { Save, X } from 'lucide-react';

interface SaveBarProps {
  isDirty: boolean;
  onSave: () => void | Promise<void>;
  onDiscard: () => void;
  saving?: boolean;
}

export function SaveBar({ isDirty, onSave, onDiscard, saving = false }: SaveBarProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isDirty) {
      setVisible(true);
      return;
    }
    const t = setTimeout(() => setVisible(false), 300);
    return () => clearTimeout(t);
  }, [isDirty]);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 shadow-2xl"
      style={{
        background: 'white',
        borderTop: '3px solid #6B1530',
        transform: isDirty ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.25s ease-out',
      }}
    >
      <div className="flex items-center gap-3">
        <span
          className="w-2.5 h-2.5 rounded-full"
          style={{
            background: '#BF9000',
            boxShadow: '0 0 0 0 rgba(191,144,0,0.4)',
            animation: isDirty ? 'pulse-dot 1.5s infinite' : 'none',
          }}
        />
        <span className="text-sm font-medium text-stone-700">Tienes cambios sin guardar</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onDiscard}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50 disabled:opacity-50"
        >
          Descartar
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-50"
          style={{ background: '#6B1530' }}
        >
          {saving ? (
            <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <Save size={13} />
          )}
          Guardar cambios
        </button>
      </div>

      <style>{`
        @keyframes pulse-dot {
          0% { box-shadow: 0 0 0 0 rgba(191,144,0,0.5); }
          70% { box-shadow: 0 0 0 8px rgba(191,144,0,0); }
          100% { box-shadow: 0 0 0 0 rgba(191,144,0,0); }
        }
      `}</style>
    </div>
  );
}
