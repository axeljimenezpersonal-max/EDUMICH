import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { ChevronRight, Lock, BookOpen, CreditCard, CheckCircle2, CalendarCheck } from 'lucide-react';
import { EstudianteLayout } from './EstudianteLayout';
import { SectionTour } from '../../components/onboarding/SectionTour';
import { AyudaMensajes } from '../../components/AyudaMensajes';
import { TOUR_MODULOS, GATE_ESTUDIANTE } from '../../components/onboarding/seccionesEstudiante';
import { api, type MisModulosResponse, type ModuloListItem, type ProgresoEstado } from '../../lib/api';

const NIVEL_LABELS: Record<number, string> = {
  1: 'Comunicación y bases',
  2: 'Pensamiento matemático y textos',
  3: 'Métodos y contextos',
  4: 'Especialidades',
};

const STATUS_STYLE: Record<ProgresoEstado, string> = {
  no_iniciado: 'bg-stone-100 text-stone-500',
  en_curso:    'bg-blue-100 text-blue-700',
  aprobado:    'bg-green-100 text-green-700',
};

const STATUS_LABEL: Record<ProgresoEstado, string> = {
  no_iniciado: 'Sin iniciar',
  en_curso:    'En curso',
  aprobado:    'Aprobado',
};

const PROGRESS_BAR: Record<ProgresoEstado, string> = {
  no_iniciado: 'w-0',
  en_curso:    'w-1/2 bg-blue-400',
  aprobado:    'w-full bg-green-500',
};

// ── Tarjeta de módulo (desbloqueado) ─────────────────────────────────────────
function ModuloCard({ modulo }: { modulo: ModuloListItem }) {
  const estado = modulo.progreso.estado;
  const cal    = modulo.progreso.mejorCalificacion;

  return (
    <Link href={`/estudiante/modulos/${modulo.id}`}>
      <div
        className={`relative bg-white border rounded-lg p-5 cursor-pointer overflow-hidden
          hover:-translate-y-0.5 hover:shadow-md transition-all group
          ${modulo.pagado ? 'border-emerald-300 ring-1 ring-emerald-200' : 'border-stone-200'}`}
      >
        {/* Número decorativo */}
        <div className="absolute -top-3 -right-1 text-[72px] font-bold leading-none text-[var(--color-guinda-100)] select-none pointer-events-none">
          {modulo.numero}
        </div>

        {/* Badges top */}
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full font-semibold ${STATUS_STYLE[estado]}`}>
            {STATUS_LABEL[estado]}
          </span>
          {modulo.pagado && (
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 size={9} />
              Pagado
            </span>
          )}
        </div>

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
          <ChevronRight size={14} className="group-hover:text-[var(--color-guinda-700)] transition-colors" />
        </div>
      </div>
    </Link>
  );
}

// ── Tarjeta de módulo (bloqueado) ─────────────────────────────────────────────
// Dos variantes:
//  · gris  → módulo sin inscribir (bloqueado de fondo).
//  · ámbar → examen PRE-INSCRITO pero sin pagar: está a un pago de desbloquearse.
function ModuloCardLocked({ modulo }: { modulo: ModuloListItem }) {
  const porPagar = modulo.inscritoExamen && !modulo.pagado;

  if (porPagar) {
    return (
      <Link href="/estudiante/pagos" className="block">
        <div className="relative overflow-hidden rounded-lg border border-amber-300 bg-amber-50/70 p-5 ring-1 ring-amber-200 transition-shadow hover:shadow-md select-none cursor-pointer">
          <div className="absolute -top-3 -right-1 text-[72px] font-bold leading-none text-amber-200/70 pointer-events-none">
            {modulo.numero}
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold bg-amber-200 text-amber-800 mb-2">
            <Lock size={9} />
            Bloqueado · falta pago
          </span>
          <h3 className="font-serif text-sm font-semibold text-stone-800 leading-snug mb-3 pr-10">
            {modulo.nombre}
          </h3>
          <div className="h-1.5 bg-amber-200/70 rounded-full mb-3" />
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-amber-800">Paga tu examen para desbloquearlo</span>
            <ChevronRight size={14} className="text-amber-500" />
          </div>
        </div>
      </Link>
    );
  }

  return (
    <div className="relative bg-stone-50 border border-stone-200 rounded-lg p-5 overflow-hidden opacity-60 cursor-not-allowed select-none">
      {/* Número decorativo */}
      <div className="absolute -top-3 -right-1 text-[72px] font-bold leading-none text-stone-200 pointer-events-none">
        {modulo.numero}
      </div>

      {/* Lock pill */}
      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold bg-stone-200 text-stone-500 mb-2">
        <Lock size={9} />
        Bloqueado
      </span>

      {/* Nombre */}
      <h3 className="font-serif text-sm font-semibold text-stone-500 leading-snug mb-3 pr-10">
        {modulo.nombre}
      </h3>

      {/* Barra vacía */}
      <div className="h-1.5 bg-stone-200 rounded-full mb-3" />

      {/* Placeholder stats */}
      <div className="flex items-center justify-between text-xs text-stone-300">
        <span>0 intentos</span>
        <Lock size={14} />
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
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

  const byNivel = (nivel: number) => data?.modulos.filter((m) => m.nivel === nivel) ?? [];
  const sinNivel = data?.modulos.filter((m) => !m.nivel) ?? [];

  const desbloqueado = data?.planDesbloqueado ?? false;

  return (
    <EstudianteLayout>
      {/* Header */}
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-guinda-700)] mb-1">
          MIS PRUEBAS
        </div>
        <h1 data-tour="mod-titulo" className="font-serif text-2xl font-bold text-stone-900">Pruebas de práctica</h1>
        {data && (
          <p className="text-stone-500 text-sm mt-1">
            {data.resumen.totalModulos} pruebas · una por módulo del Plan 22
          </p>
        )}
      </div>

      {/* ── ¿Qué son los módulos? (explicación) ── */}
      <div className="mb-6 bg-[var(--color-crema-100)] border border-[var(--color-crema-200)] rounded-xl p-4 flex gap-3">
        <div className="w-9 h-9 rounded-lg bg-white/70 flex items-center justify-center shrink-0">
          <BookOpen size={18} className="text-[var(--color-guinda-700)]" />
        </div>
        <div className="text-sm text-stone-600 leading-relaxed">
          <span className="font-bold text-stone-800">¿Qué son las pruebas?</span> Son{' '}
          <strong>prácticas tipo mini-examen</strong> que la Secretaría prepara con base en los
          exámenes reales de cada módulo, para que llegues preparado a tu examen oficial. Aquí
          ejercitas los temas y mides tu avance. <strong>No son tus calificaciones ni sustituyen el
          examen oficial</strong>: cada examen real es distinto — esto es solo para practicar.
        </div>
      </div>

      {loading && (
        <div className="text-center text-stone-400 py-16 text-sm">Cargando pruebas...</div>
      )}

      {data && (
        <>
          {/* ── Aviso de bloqueo ── */}
          {!desbloqueado && (
            <div data-tour="mod-bloqueo" className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-5 flex gap-4 items-start">
              <div className="bg-amber-100 rounded-full p-2 flex-shrink-0">
                <CreditCard size={20} className="text-amber-600" />
              </div>
              <div>
                <p className="font-semibold text-amber-900 text-sm mb-1">
                  Tus pruebas están pendientes de activación
                </p>
                <p className="text-amber-700 text-xs leading-relaxed">
                  Para acceder a tus pruebas de práctica necesitas tener un{' '}
                  <strong>pago verificado</strong> de tus derechos de examen. Puedes
                  pagarlo tú desde la sección <strong>Pagos</strong> o hacerlo a través de
                  tu gestor; una vez verificado, se desbloquearán automáticamente las{' '}
                  <strong>pruebas de los módulos que inscribiste</strong> a examen.
                </p>
              </div>
            </div>
          )}

          {/* ── Progreso global ── */}
          <div data-tour="mod-progreso" className={`rounded-lg overflow-hidden mb-8 text-white p-6 ${
            desbloqueado
              ? 'bg-gradient-to-r from-[var(--color-guinda-800)] to-[var(--color-guinda-600)]'
              : 'bg-gradient-to-r from-stone-600 to-stone-500'
          }`}>
            <div className="text-[10px] font-semibold uppercase tracking-widest opacity-70 mb-4">
              Progreso global
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              <div>
                <div className="text-3xl font-bold font-serif">
                  {data.resumen.aprobados}
                  <span className="text-lg opacity-50">/{data.resumen.totalInscritos || '—'}</span>
                </div>
                <div className="text-xs opacity-70 mt-0.5">
                  Aprobados {data.resumen.totalInscritos > 0 ? `de ${data.resumen.totalInscritos} inscritos` : ''}
                </div>
              </div>
              <div>
                <div className="text-3xl font-bold font-serif">
                  {desbloqueado ? data.resumen.totalInscritos : '—'}
                </div>
                <div className="text-xs opacity-70 mt-0.5">Con examen inscrito</div>
              </div>
              <div>
                <div className="text-3xl font-bold font-serif">
                  {desbloqueado ? data.resumen.totalQuizzes : '—'}
                </div>
                <div className="text-xs opacity-70 mt-0.5">Evaluaciones hechas</div>
              </div>
              <div>
                <div className="text-3xl font-bold font-serif">
                  {desbloqueado && data.resumen.promedioGlobal > 0 ? data.resumen.promedioGlobal : '—'}
                </div>
                <div className="text-xs opacity-70 mt-0.5">Promedio global</div>
              </div>
            </div>
          </div>

          {/* ── Leyenda (solo si desbloqueado y hay inscritos) ── */}
          {desbloqueado && data.resumen.totalInscritos > 0 && (
            <div className="flex flex-wrap gap-3 mb-6 text-xs text-stone-600">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-full bg-emerald-200 border border-emerald-400" />
                Examen pagado · prueba disponible
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-full bg-amber-200 border border-amber-400" />
                Pre-inscrito · paga para desbloquear
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-green-600" />
                Módulo aprobado (examen oficial)
              </span>
            </div>
          )}

          {/* ── Módulos por nivel ── */}
          {[
            { nivel: 1, items: byNivel(1) },
            { nivel: 2, items: byNivel(2) },
            { nivel: 3, items: byNivel(3) },
            { nivel: 4, items: byNivel(4) },
          ]
            .filter(({ items }) => items.length > 0)
            .map(({ nivel, items }) => (
              <section key={nivel} className="mb-8">
                <h2 className="font-serif text-base font-bold text-stone-900 mb-3">
                  Nivel {nivel} —{' '}
                  <span className="font-normal text-stone-600">{NIVEL_LABELS[nivel] ?? ''}</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((m) =>
                    m.pagado
                      ? <ModuloCard key={m.id} modulo={m} />
                      : <ModuloCardLocked key={m.id} modulo={m} />
                  )}
                </div>
              </section>
            ))}

          {sinNivel.length > 0 && (
            <section className="mb-8">
              <h2 data-tour="mod-lista" className="font-serif text-base font-bold text-stone-900 mb-3">Otras pruebas</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {sinNivel.map((m) =>
                  m.pagado
                    ? <ModuloCard key={m.id} modulo={m} />
                    : <ModuloCardLocked key={m.id} modulo={m} />
                )}
              </div>
            </section>
          )}

          {/* ── Sin módulos ── */}
          {data.modulos.length === 0 && (
            <div className="border-2 border-dashed border-stone-200 rounded-xl p-10 text-center">
              <BookOpen size={32} className="mx-auto mb-3 text-stone-300" />
              <div className="text-sm font-semibold text-stone-600">
                No hay pruebas disponibles
              </div>
            </div>
          )}
        </>
      )}
      <div className="mt-6">
        <AyudaMensajes contexto="tus pruebas" />
      </div>
      <SectionTour
        steps={TOUR_MODULOS}
        storageKey="modula_sec_modulos_v1"
        gateKey={GATE_ESTUDIANTE}
        buttonLabel="Tutorial de Pruebas"
      />
    </EstudianteLayout>
  );
}
