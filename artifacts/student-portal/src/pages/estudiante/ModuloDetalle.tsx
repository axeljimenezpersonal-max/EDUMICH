import { useEffect, useState } from 'react';
import { Link, useParams, useLocation } from 'wouter';
import {
  ArrowLeft,
  BookOpen,
  Download,
  Target,
  FileText,
  Trophy,
} from 'lucide-react';
import { EstudianteLayout } from './EstudianteLayout';
import {
  api,
  type ModuloDetalleResponse,
  type TemaNode,
  type UnidadDetalle,
  type ContactosResponse,
  type ProgresoEstado,
} from '../../lib/api';

const NIVEL_LABELS: Record<number, string> = {
  1: 'Nivel 1 — Comunicación y bases',
  2: 'Nivel 2 — Pensamiento matemático',
  3: 'Nivel 3 — Métodos y contextos',
  4: 'Nivel 4 — Especialidades',
};

const STATUS_STYLE: Record<ProgresoEstado, string> = {
  no_iniciado: 'bg-stone-100 text-stone-600',
  en_curso: 'bg-blue-100 text-blue-700',
  aprobado: 'bg-green-100 text-green-700',
};

const STATUS_LABEL: Record<ProgresoEstado, string> = {
  no_iniciado: 'Sin iniciar',
  en_curso: 'En curso',
  aprobado: 'Aprobado',
};

type Tab = 'temario' | 'quizzes' | 'areas';

// ─── Componente: ítem de tema (con subtemas anidados) ─────────────────────
function TemaItem({ tema }: { tema: TemaNode }) {
  return (
    <li>
      <div className="flex items-start gap-2 text-sm text-stone-700">
        <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-guinda-500)] mt-[7px] shrink-0" />
        <span>{tema.titulo}</span>
      </div>
      {tema.subtemas.length > 0 && (
        <ul className="ml-5 mt-1.5 space-y-1.5">
          {tema.subtemas.map((sub) => (
            <li key={sub.id} className="flex items-start gap-2 text-sm text-stone-500">
              <div className="w-1 h-1 rounded-full bg-stone-400 mt-[7px] shrink-0" />
              <span>{sub.titulo}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

// ─── Componente: tarjeta de unidad ────────────────────────────────────────
function UnidadCard({ unidad }: { unidad: UnidadDetalle }) {
  return (
    <div className="border border-stone-200 rounded-lg overflow-hidden">
      <div className="bg-[var(--color-crema-100)] px-5 py-4 border-b border-stone-200">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-guinda-700)] mb-1">
          Unidad {unidad.numero}
        </div>
        <h3 className="font-serif text-base font-bold text-stone-900">{unidad.titulo}</h3>
        {unidad.proposito && (
          <p className="text-sm text-stone-600 mt-1.5 leading-relaxed">{unidad.proposito}</p>
        )}
      </div>
      {unidad.temas.length > 0 && (
        <div className="px-5 py-4">
          <div className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold mb-3">
            TEMAS
          </div>
          <ul className="space-y-2.5">
            {unidad.temas.map((t) => (
              <TemaItem key={t.id} tema={t} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────
export default function ModuloDetalle() {
  const { id } = useParams<{ id: string }>();
  const moduloId = Number(id);

  const [data, setData] = useState<ModuloDetalleResponse | null>(null);
  const [contactos, setContactos] = useState<ContactosResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('temario');
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!moduloId) return;
    Promise.all([
      api.get<ModuloDetalleResponse>(`/estudiante/modulos/${moduloId}`),
      api.get<ContactosResponse>('/estudiante/contactos'),
    ])
      .then(([d, c]) => {
        setData(d);
        setContactos(c);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [moduloId]);

  if (loading) {
    return (
      <EstudianteLayout>
        <div className="text-center text-stone-400 py-16 text-sm">Cargando módulo...</div>
      </EstudianteLayout>
    );
  }

  if (!data) {
    return (
      <EstudianteLayout>
        <div className="text-center text-stone-400 py-16 text-sm">Módulo no encontrado.</div>
      </EstudianteLayout>
    );
  }

  const { modulo, unidades, materiales, progreso } = data;
  const estado = progreso.estado as ProgresoEstado;

  return (
    <EstudianteLayout>
      {/* Back link */}
      <Link href="/estudiante/modulos">
        <span className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-[var(--color-guinda-700)] mb-5 cursor-pointer transition-colors">
          <ArrowLeft size={15} />
          Volver a mis módulos
        </span>
      </Link>

      {/* Hero card */}
      <div className="bg-white border border-stone-200 rounded-lg p-6 mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {modulo.nivel && (
            <span className="text-xs px-2 py-0.5 bg-[var(--color-crema-100)] text-[var(--color-guinda-700)] rounded font-semibold border border-[var(--color-crema-200)]">
              {NIVEL_LABELS[modulo.nivel]}
            </span>
          )}
          <span className="text-xs text-stone-400">Módulo {modulo.numero} de 21</span>
        </div>

        <h1 className="font-serif text-2xl font-bold text-stone-900 mb-2">{modulo.nombre}</h1>
        {modulo.descripcionCorta && (
          <p className="text-stone-600 text-sm mb-4 leading-relaxed">{modulo.descripcionCorta}</p>
        )}

        {/* Metadata */}
        <div className="flex flex-wrap gap-4 text-sm text-stone-500 mb-5">
          <span className="flex items-center gap-1.5">
            <BookOpen size={14} />
            {unidades.length} {unidades.length === 1 ? 'unidad' : 'unidades'}
          </span>
          {modulo.totalPreguntas && (
            <span className="flex items-center gap-1.5">
              <FileText size={14} />
              Banco de preguntas disponible
            </span>
          )}
        </div>

        {/* Status + botones */}
        <div className="flex flex-wrap items-center gap-3">
          <span className={`text-sm px-3 py-1 rounded-full font-semibold ${STATUS_STYLE[estado]}`}>
            {STATUS_LABEL[estado]}
            {progreso.mejorCalificacion !== null ? ` · ${progreso.mejorCalificacion}/100` : ''}
          </span>

          {modulo.totalPreguntas ? (
            <button
              onClick={() => navigate(`/estudiante/modulos/${moduloId}/evaluacion`)}
              className="flex items-center gap-2 text-sm px-4 py-2 rounded-md bg-[var(--color-guinda-700)] text-white hover:bg-[var(--color-guinda-800)] transition-colors"
            >
              <Trophy size={15} />
              Hacer evaluación nueva
            </button>
          ) : (
            <button
              disabled
              title="Banco de preguntas no disponible aún"
              className="flex items-center gap-2 text-sm px-4 py-2 rounded-md bg-stone-100 text-stone-400 cursor-not-allowed"
            >
              <Trophy size={15} />
              Hacer evaluación nueva
            </button>
          )}

          {materiales.length > 0 && (
            <a
              href={materiales[0].urlDescarga}
              download
              className="flex items-center gap-2 text-sm px-4 py-2 rounded-md border border-[var(--color-guinda-700)] text-[var(--color-guinda-700)] hover:bg-[var(--color-crema-100)] transition-colors"
            >
              <Download size={15} />
              Descargar temario PDF
            </a>
          )}
        </div>
      </div>

      {/* Contenido: 2 columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* Columna izquierda: tabs */}
        <div>
          {/* Tab bar */}
          <div className="flex border-b border-stone-200 mb-5">
            {(
              [
                { key: 'temario', label: 'Temario', Icon: BookOpen },
                { key: 'quizzes', label: 'Evaluaciones', Icon: Trophy },
                { key: 'areas', label: 'Áreas de oportunidad', Icon: Target },
              ] as const
            ).map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  tab === key
                    ? 'border-[var(--color-guinda-700)] text-[var(--color-guinda-700)]'
                    : 'border-transparent text-stone-500 hover:text-stone-700'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {/* Tab: Temario */}
          {tab === 'temario' && (
            <div className="space-y-4">
              {unidades.length === 0 ? (
                <div className="bg-white border border-stone-200 rounded-lg p-8 text-center">
                  <BookOpen size={28} className="mx-auto mb-3 text-stone-300" />
                  <p className="text-stone-500 text-sm">
                    El temario de este módulo estará disponible próximamente.
                  </p>
                </div>
              ) : (
                unidades.map((u) => <UnidadCard key={u.id} unidad={u} />)
              )}
            </div>
          )}

          {/* Tab: Quizzes */}
          {tab === 'quizzes' && (
            <div className="bg-white border border-stone-200 rounded-lg p-8 text-center">
              <Trophy size={32} className={`mx-auto mb-3 ${modulo.totalPreguntas ? 'text-[var(--color-guinda-700)]' : 'text-stone-300'}`} />
              <h3 className="font-serif text-lg font-bold text-stone-700 mb-2">
                Evaluación oficial del módulo
              </h3>
              {modulo.totalPreguntas ? (
                <>
                  <p className="text-stone-500 text-sm mb-2">
                    Cada intento selecciona <span className="font-semibold text-stone-700">20 preguntas al azar</span>{' '}
                    — apruebas con <span className="font-semibold text-stone-700">60/100</span>.
                  </p>
                  {progreso.mejorCalificacion !== null && (
                    <div className="flex justify-center gap-6 my-4">
                      <div>
                        <div className={`text-xl font-bold ${progreso.mejorCalificacion >= 60 ? 'text-green-600' : 'text-amber-600'}`}>
                          {progreso.mejorCalificacion}/100
                        </div>
                        <div className="text-xs text-stone-400">Mejor calificación</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-stone-600">{progreso.intentosQuiz ?? 0}</div>
                        <div className="text-xs text-stone-400">Intento(s)</div>
                      </div>
                    </div>
                  )}
                  <button
                    onClick={() => navigate(`/estudiante/modulos/${moduloId}/evaluacion`)}
                    className="gov-btn-primary mt-2"
                  >
                    <Trophy size={15} className="inline mr-2" />
                    {progreso.intentosQuiz ? 'Nuevo intento' : 'Empezar evaluación'}
                  </button>
                </>
              ) : (
                <p className="text-stone-500 text-sm">
                  El banco de preguntas para este módulo estará disponible próximamente.
                </p>
              )}
              {progreso.estado === 'aprobado' && (
                <div className="mt-4 inline-flex items-center gap-1.5 text-sm text-green-700 bg-green-50 px-3 py-1.5 rounded-full">
                  <Trophy size={13} />
                  Módulo aprobado
                </div>
              )}
            </div>
          )}

          {/* Tab: Áreas de oportunidad */}
          {tab === 'areas' && (
            <div className="bg-white border border-stone-200 rounded-lg p-8 text-center">
              <Target size={32} className="mx-auto mb-3 text-stone-300" />
              <h3 className="font-serif text-lg font-bold text-stone-700 mb-2">
                Áreas de oportunidad
              </h3>
              <p className="text-stone-500 text-sm max-w-sm mx-auto">
                Aún no has hecho evaluaciones en este módulo. Cuando empieces a practicar, aquí verás
                los temas en los que te conviene reforzar.
              </p>
            </div>
          )}
        </div>

        {/* Columna derecha: sidebar */}
        <div className="space-y-4">
          {/* Materiales */}
          <div className="bg-white border border-stone-200 rounded-lg p-4">
            <h3 className="font-serif text-sm font-bold text-stone-900 mb-3 flex items-center gap-2">
              <FileText size={14} className="text-[var(--color-guinda-700)]" />
              Material de estudio
            </h3>
            {materiales.length === 0 ? (
              <p className="text-xs text-stone-400">Sin materiales disponibles aún.</p>
            ) : (
              <ul className="space-y-3">
                {materiales.map((m) => (
                  <li key={m.id}>
                    <a
                      href={m.urlDescarga}
                      download
                      className="flex items-start gap-2 text-sm text-[var(--color-guinda-700)] hover:underline"
                    >
                      <Download size={13} className="mt-0.5 shrink-0" />
                      <span className="leading-tight">{m.nombre}</span>
                    </a>
                    {m.tamanoBytes && (
                      <div className="text-xs text-stone-400 ml-5 mt-0.5">
                        {(m.tamanoBytes / 1024).toFixed(0)} KB
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Contacto del gestor */}
          {contactos?.gestor && (
            <div className="bg-white border border-stone-200 rounded-lg p-4">
              <h3 className="font-serif text-sm font-bold text-stone-900 mb-3">
                ¿Necesitas ayuda?
              </h3>
              <div className="space-y-1 text-xs text-stone-600">
                <div className="font-semibold text-stone-800 text-sm">
                  {contactos.gestor.nombreCompleto}
                </div>
                {contactos.gestor.municipio && (
                  <div className="text-stone-500">Gestor · {contactos.gestor.municipio}</div>
                )}
                {contactos.gestor.telefonoPublico && (
                  <div>{contactos.gestor.telefonoPublico}</div>
                )}
                {contactos.gestor.emailPublico && (
                  <div>
                    <a
                      href={`mailto:${contactos.gestor.emailPublico}`}
                      className="text-[var(--color-guinda-700)] hover:underline"
                    >
                      {contactos.gestor.emailPublico}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </EstudianteLayout>
  );
}
