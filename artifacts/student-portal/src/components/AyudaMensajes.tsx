/**
 * Bloque de ayuda: "¿Dudas? Escríbenos" con enlace a Mensajes (chat con la
 * Secretaría). Se coloca al final de secciones del alumno (Inscripción, Pagos,
 * Expediente) para que siempre tenga a dónde acudir.
 */
import { Link } from 'wouter';
import { MessageSquare, ChevronRight } from 'lucide-react';

export function AyudaMensajes({ contexto }: { contexto: string }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-[var(--color-crema-100)] flex items-center justify-center shrink-0">
          <MessageSquare size={17} className="text-[var(--color-guinda-700)]" />
        </div>
        <div className="text-sm text-stone-600">
          ¿Tienes alguna pregunta o problema con {contexto}? Escríbenos y te ayudamos.
        </div>
      </div>
      <Link href="/estudiante/mensajes">
        <button className="shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[var(--color-guinda-700)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--color-guinda-800)] transition-colors">
          Ir a mensajes <ChevronRight size={15} />
        </button>
      </Link>
    </div>
  );
}

export default AyudaMensajes;
