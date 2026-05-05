import { useEffect, useState } from 'react';
import { Bell, ChevronDown, ChevronUp } from 'lucide-react';
import { EstudianteLayout } from './EstudianteLayout';
import { api, type Aviso } from '../../lib/api';

function PrioridadBadge({ prioridad }: { prioridad: Aviso['prioridad'] }) {
  const map = {
    informativo: 'bg-blue-50 text-blue-700 border-blue-200',
    importante: 'bg-amber-50 text-amber-700 border-amber-200',
    urgente: 'bg-red-50 text-red-700 border-red-200',
  };
  const labels = { informativo: 'Informativo', importante: 'Importante', urgente: 'Urgente' };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${map[prioridad]}`}>
      {labels[prioridad]}
    </span>
  );
}

export default function Avisos() {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState<number | null>(null);

  useEffect(() => {
    api
      .get<Aviso[]>('/estudiante/avisos')
      .then(setAvisos)
      .finally(() => setLoading(false));
  }, []);

  async function toggleAviso(id: number, yaLeido: boolean) {
    setExpandido((prev) => (prev === id ? null : id));
    if (!yaLeido) {
      await api.post(`/estudiante/avisos/${id}/marcar-leido`);
      setAvisos((prev) => prev.map((a) => (a.id === id ? { ...a, leido: true } : a)));
    }
  }

  return (
    <EstudianteLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Bell size={20} className="text-[var(--color-guinda-700)]" />
          <h1 className="font-serif text-xl font-bold text-stone-900">Avisos institucionales</h1>
        </div>
        <p className="text-sm text-stone-500">
          Información oficial de la administración de Prepa Abierta Michoacán.
        </p>

        {loading && (
          <div className="text-stone-400 text-sm py-8 text-center">Cargando avisos...</div>
        )}

        {!loading && avisos.length === 0 && (
          <div className="bg-white border border-stone-200 rounded-md p-8 text-center text-stone-400">
            No hay avisos activos en este momento.
          </div>
        )}

        <ul className="space-y-2">
          {avisos.map((aviso) => {
            const abierto = expandido === aviso.id;
            return (
              <li key={aviso.id} className="bg-white border border-stone-200 rounded-md overflow-hidden">
                <button
                  onClick={() => toggleAviso(aviso.id, aviso.leido)}
                  className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-stone-50 transition-colors"
                >
                  {/* Punto de no leído */}
                  <div className="mt-1 shrink-0">
                    {!aviso.leido ? (
                      <span className="w-2 h-2 rounded-full bg-[var(--color-guinda-600)] block" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-stone-200 block" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <PrioridadBadge prioridad={aviso.prioridad} />
                      {!aviso.leido && (
                        <span className="text-[10px] font-semibold text-[var(--color-guinda-700)] bg-[var(--color-guinda-50)] border border-[var(--color-guinda-200)] px-1.5 py-0.5 rounded">
                          Nuevo
                        </span>
                      )}
                    </div>
                    <div className="font-medium text-stone-900 text-sm">{aviso.titulo}</div>
                    <div className="text-[10px] text-stone-400 mt-0.5">
                      {new Date(aviso.publicadoEn).toLocaleDateString('es-MX', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </div>
                  </div>

                  <div className="shrink-0 text-stone-400 mt-1">
                    {abierto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>

                {abierto && (
                  <div className="px-4 pb-4 border-t border-stone-100">
                    <p className="text-sm text-stone-700 leading-relaxed mt-3 whitespace-pre-line">
                      {aviso.contenido}
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </EstudianteLayout>
  );
}
