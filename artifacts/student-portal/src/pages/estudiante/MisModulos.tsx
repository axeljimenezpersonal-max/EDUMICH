import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { ChevronRight, Lock } from 'lucide-react';
import { EstudianteLayout } from './EstudianteLayout';
import { api, type MisModulosResponse, type ModuloListItem, type ProgresoEstado } from '../../lib/api';

const NIVEL_LABELS: Record<number, string> = {
  1: 'Comunicación y bases',
  2: 'Pensamiento matemático y textos',
  3: 'Métodos y contextos',
  4: 'Especialidades',
};

const STATUS_STYLE: Record<ProgresoEstado, string> = {
  no_iniciado: 'bg-stone-100 text-stone-500',
  en_curso: 'bg-blue-100 text-blue-700',
  aprobado: 'bg-green-100 text-green-700',
};

const STATUS_LABEL: Record<ProgresoEstado, string> = {
  no_iniciado: 'Sin iniciar',
  en_curso: 'En curso',
  aprobado: 'Aprobado',
};

const PROGRESS_BAR: Record<ProgresoEstado, string> = {
  no_iniciado: 'w-0',
  en_curso: 'w-1/2 bg-blue-400',
  aprobado: 'w-full bg-green-500',
};

function ModuloCard({ modulo }: { modulo: ModuloListItem }) {
  const estado = modulo.progreso.estado;
  const cal = modulo.progreso.mejorCalificacion;

  return (
    <Link href={`/estudiante/modulos/${modulo.id}`}>
      <div
        className="relative bg-white border border-stone-200 rounded-lg p-5 cursor-pointer overflow-hidden
          hover:-translate-y-0.5 hover:shadow-md transition-all group"
      >
        {/* Número decorativo en la esquina */}
        <div
          className="absolute -top-3 -right-1 text-[72px] font-bold leading-none
            text-[var(--color-guinda-100)] select-none pointer-events-none"
        >
          {modulo.numero}
        </div>

        {/* Status pill */}
        <span
          className={`inline-block text-[11px] px-2 py-0.5 rounded-full font-semibold mb-2 ${STATUS_STYLE[estado]}`}
        >
          {STATUS_LABEL[estado]}
        </span>

        {/* Nombre */}
        <h3 className="font-serif text-sm font-semibold text-stone-900 leading-snug mb-3 pr-10">
          {modulo.nombre}
        </h3>

        {/* Barra de progreso */}
        <div className="h-1.5 bg-stone-100 rounded-full mb-3 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${PROGRESS_BAR[estado]}`} />
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-xs text-stone-400">
          <span>
            {modulo.progreso.intentosQuiz}{' '}
            {modulo.progreso.intentosQuiz === 1 ? 'intento' : 'intentos'}
          </span>
          {cal !== null && (
            <span className="font-semibold text-stone-600">{cal}/100</span>
          )}
          <ChevronRight
            size={14}
            className="group-hover:text-[var(--color-guinda-700)] transition-colors"
          />
        </div>
      </div>
    </Link>
  );
}

export default function MisModulos() {
  const [data, setData] = useState<MisModulosResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<MisModulosResponse>('/estudiante/modulos')
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const nivel1 = data?.modulos.filter((m) => m.nivel === 1) ?? [];
  const nivel2 = data?.modulos.filter((m) => m.nivel === 2) ?? [];
  const nivel3y4 = data?.modulos.filter((m) => (m.nivel ?? 0) >= 3) ?? [];

  return (
    <EstudianteLayout>
      {/* Header de página */}
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-guinda-700)] mb-1">
          MIS MÓDULOS
        </div>
        <h1 className="font-serif text-2xl font-bold text-stone-900">Plan Modular</h1>
        <p className="text-stone-500 text-sm mt-1">
          21 módulos organizados en 4 niveles de avance
        </p>
      </div>

      {/* Progress overview card */}
      {data && (
        <div className="rounded-lg overflow-hidden mb-8 bg-gradient-to-r from-[var(--color-guinda-800)] to-[var(--color-guinda-600)] text-white p-6">
          <div className="text-[10px] font-semibold uppercase tracking-widest opacity-70 mb-4">
            Progreso global
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <div>
              <div className="text-3xl font-bold font-serif">
                {data.resumen.aprobados}
                <span className="text-lg opacity-50">/{data.resumen.totalModulos}</span>
              </div>
              <div className="text-xs opacity-70 mt-0.5">Aprobados</div>
            </div>
            <div>
              <div className="text-3xl font-bold font-serif">{data.resumen.enCurso}</div>
              <div className="text-xs opacity-70 mt-0.5">En curso</div>
            </div>
            <div>
              <div className="text-3xl font-bold font-serif">{data.resumen.totalQuizzes}</div>
              <div className="text-xs opacity-70 mt-0.5">Evaluaciones hechas</div>
            </div>
            <div>
              <div className="text-3xl font-bold font-serif">
                {data.resumen.promedioGlobal > 0 ? data.resumen.promedioGlobal : '—'}
              </div>
              <div className="text-xs opacity-70 mt-0.5">Promedio global</div>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="text-center text-stone-400 py-16 text-sm">Cargando módulos...</div>
      )}

      {/* Nivel 1 */}
      {nivel1.length > 0 && (
        <section className="mb-8">
          <h2 className="font-serif text-base font-bold text-stone-900 mb-3">
            Nivel 1 —{' '}
            <span className="font-normal text-stone-600">{NIVEL_LABELS[1]}</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {nivel1.map((m) => (
              <ModuloCard key={m.id} modulo={m} />
            ))}
          </div>
        </section>
      )}

      {/* Nivel 2 */}
      {nivel2.length > 0 && (
        <section className="mb-8">
          <h2 className="font-serif text-base font-bold text-stone-900 mb-3">
            Nivel 2 —{' '}
            <span className="font-normal text-stone-600">{NIVEL_LABELS[2]}</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {nivel2.map((m) => (
              <ModuloCard key={m.id} modulo={m} />
            ))}
          </div>
        </section>
      )}

      {/* Niveles 3 y 4 — bloqueados */}
      {nivel3y4.length > 0 && (
        <section className="mb-8">
          <h2 className="font-serif text-base font-bold text-stone-700 mb-3">
            Niveles 3 y 4 —{' '}
            <span className="font-normal text-stone-500">Métodos, contextos y especialidades</span>
          </h2>
          <div className="border-2 border-dashed border-stone-300 rounded-lg p-8 text-center">
            <Lock size={22} className="mx-auto mb-2 text-stone-300" />
            <div className="text-sm font-medium text-stone-500">
              Disponibles cuando avances tu plan de estudios
            </div>
            <div className="text-xs text-stone-400 mt-1.5">
              {nivel3y4.length} módulos · Niveles 3 (Métodos y contextos) y 4 (Especialidades)
            </div>
          </div>
        </section>
      )}
    </EstudianteLayout>
  );
}
