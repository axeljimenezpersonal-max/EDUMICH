/**
 * EvaluacionPage — Pantalla de evaluación de módulo
 * Ruta: /estudiante/modulos/:id/evaluacion
 *
 * Flujo: cargando → examen (20 preguntas, 20 min countdown) → resultados + revisión
 */

import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'wouter';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Trophy,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  RotateCcw,
  BookOpen,
  Loader2,
} from 'lucide-react';
import { api, type ModuloDetalleResponse } from '../../lib/api';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Pregunta {
  id: number;
  unidadNum: number;
  tema: string;
  dificultad: 'facil' | 'media' | 'alta';
  pregunta: string;
  opcionA: string;
  opcionB: string;
  opcionC: string;
  opcionD: string;
  paraRepasar: string | null;
}

interface FeedbackItem {
  id: number;
  pregunta: string;
  tema: string;
  dificultad: string;
  opcionA: string;
  opcionB: string;
  opcionC: string;
  opcionD: string;
  respuestaCorrecta: OpcionKey;
  respuestaAlumno: OpcionKey | null;
  acerto: boolean;
  explicacion: string | null;
  paraRepasar: string | null;
}

interface ResultadoQuiz {
  total: number;
  correctas: number;
  incorrectas: number;
  calificacion: number;
  aprobado: boolean;
  feedback: FeedbackItem[];
}

type Fase = 'cargando' | 'examen' | 'enviando' | 'resultados' | 'error';
type OpcionKey = 'A' | 'B' | 'C' | 'D';

// ── Constantes ────────────────────────────────────────────────────────────────

const TIEMPO_LIMITE_SECS = 20 * 60;

const DIFICULTAD_COLOR: Record<string, string> = {
  facil: 'bg-green-100 text-green-700',
  media: 'bg-amber-100 text-amber-700',
  alta: 'bg-red-100 text-red-700',
};
const DIFICULTAD_LABEL: Record<string, string> = {
  facil: 'Fácil',
  media: 'Media',
  alta: 'Alta',
};

const OPCIONES: OpcionKey[] = ['A', 'B', 'C', 'D'];

function textoOpcion(p: Pregunta | FeedbackItem, k: OpcionKey): string {
  return k === 'A' ? p.opcionA : k === 'B' ? p.opcionB : k === 'C' ? p.opcionC : p.opcionD;
}

function formatTimer(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Subcomponentes ────────────────────────────────────────────────────────────

/** Anillo SVG de calificación */
function ScoreRing({ score, size = 152 }: { score: number; size?: number }) {
  const r = size / 2 - 12;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 60 ? '#16a34a' : '#d97706';
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eadfd7" strokeWidth="12" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="12"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1.2s ease' }}
      />
    </svg>
  );
}

/** Botón de opción durante el examen */
function OpcionBtn({
  letra, texto, seleccionada, onClick,
}: {
  letra: OpcionKey; texto: string; seleccionada: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-5 sm:px-6 py-5 rounded-2xl border-2 text-left transition-all duration-150 ${
        seleccionada
          ? 'border-[var(--color-guinda-700)] bg-[var(--color-guinda-700)] text-white shadow-lg scale-[1.01]'
          : 'border-stone-300 bg-stone-50 text-stone-900 shadow-sm hover:border-[var(--color-guinda-500)] hover:bg-white hover:shadow-md'
      }`}
    >
      <span
        className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold border-2 transition-colors ${
          seleccionada
            ? 'border-white/50 bg-white/15 text-white'
            : 'border-stone-300 bg-white text-stone-600'
        }`}
      >
        {letra}
      </span>
      <span className="text-base sm:text-lg font-medium leading-relaxed">{texto}</span>
    </button>
  );
}

/** Tarjeta de revisión en resultados */
function FeedbackCard({ item, idx }: { item: FeedbackItem; idx: number }) {
  return (
    <div className={`border rounded-2xl overflow-hidden ${item.acerto ? 'border-green-200' : 'border-red-200'}`}>
      {/* Header de la pregunta */}
      <div className={`px-5 py-4 flex items-start gap-3 ${item.acerto ? 'bg-green-50' : 'bg-red-50'}`}>
        {item.acerto
          ? <CheckCircle2 size={20} className="text-green-600 mt-0.5 shrink-0" />
          : <XCircle size={20} className="text-red-500 mt-0.5 shrink-0" />
        }
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="text-xs text-stone-400 font-medium">{idx + 1}.</span>
            {item.dificultad && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${DIFICULTAD_COLOR[item.dificultad] ?? ''}`}>
                {DIFICULTAD_LABEL[item.dificultad] ?? item.dificultad}
              </span>
            )}
            {item.tema && (
              <span className="text-[10px] text-stone-400 truncate max-w-[200px]">{item.tema}</span>
            )}
          </div>
          <p className="text-sm font-semibold text-stone-900 leading-snug">{item.pregunta}</p>
        </div>
      </div>

      {/* Opciones coloreadas */}
      <div className="px-5 py-4 bg-white space-y-2">
        {OPCIONES.map((k) => {
          const esCor = k === item.respuestaCorrecta;
          const esAlumnoError = k === item.respuestaAlumno && !esCor;
          let rowCls = 'border-stone-100 bg-stone-50 text-stone-500';
          let badgeCls = 'border-stone-200 text-stone-400 bg-white';
          if (esCor) {
            rowCls = 'border-green-200 bg-green-50 text-green-900';
            badgeCls = 'border-green-400 text-green-700 bg-green-100';
          } else if (esAlumnoError) {
            rowCls = 'border-red-200 bg-red-50 text-red-900';
            badgeCls = 'border-red-400 text-red-600 bg-red-100';
          }
          return (
            <div key={k} className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg border ${rowCls}`}>
              <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold border ${badgeCls}`}>
                {k}
              </span>
              <span className="text-sm leading-snug flex-1">{textoOpcion(item, k)}</span>
              {esCor && <CheckCircle2 size={14} className="text-green-500 shrink-0" />}
              {esAlumnoError && <XCircle size={14} className="text-red-400 shrink-0" />}
            </div>
          );
        })}
      </div>

      {/* Explicación + Para repasar */}
      {(item.explicacion || item.paraRepasar) && (
        <div className="px-5 pb-5 bg-white space-y-2.5">
          {item.explicacion && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1.5">
                Explicacion
              </p>
              <p className="text-sm text-blue-900 leading-relaxed">{item.explicacion}</p>
            </div>
          )}
          {item.paraRepasar && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5">
              <p className="text-xs text-amber-800">
                <span className="font-semibold">Para repasar:</span> {item.paraRepasar}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Pantalla de carga / enviando ──────────────────────────────────────────────
function PantallaCarga({ mensaje }: { mensaje: string }) {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 size={36} className="animate-spin text-[var(--color-guinda-500)] mx-auto" />
        <p className="text-stone-500 text-sm">{mensaje}</p>
      </div>
    </div>
  );
}

// ── Pantalla principal ────────────────────────────────────────────────────────
export default function EvaluacionPage() {
  const { id } = useParams<{ id: string }>();
  const moduloId = Number(id);

  const [fase, setFase] = useState<Fase>('cargando');
  const [moduloInfo, setModuloInfo] = useState<{ num: number; nombre: string } | null>(null);
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [respuestas, setRespuestas] = useState<Record<number, OpcionKey>>({});
  const [indice, setIndice] = useState(0);
  const [resultado, setResultado] = useState<ResultadoQuiz | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [timerSecs, setTimerSecs] = useState(TIEMPO_LIMITE_SECS);

  // Ref para que el timer pueda llamar siempre la última versión de handleEnviar
  const handleEnviarRef = useRef<() => void>(() => {});

  // ── Carga inicial: módulo → preguntas ──
  useEffect(() => {
    if (!moduloId) return;
    setFase('cargando');
    api.get<ModuloDetalleResponse>(`/estudiante/modulos/${moduloId}`)
      .then((d) => {
        setModuloInfo({ num: d.modulo.numero, nombre: d.modulo.nombre });
        return api.get<{ preguntas: Pregunta[] }>(`/banco/modulo/${d.modulo.numero}/quiz`);
      })
      .then((q) => {
        setPreguntas(q.preguntas);
        setRespuestas({});
        setIndice(0);
        setResultado(null);
        setFase('examen');
      })
      .catch(() => {
        setErrorMsg('No se pudo cargar la evaluacion. Verifica tu conexion e intenta de nuevo.');
        setFase('error');
      });
  }, [moduloId]);

  // ── Timer: arranca/reinicia cuando entra a 'examen' ──
  useEffect(() => {
    if (fase !== 'examen') return;
    setTimerSecs(TIEMPO_LIMITE_SECS);
    const interval = setInterval(() => {
      setTimerSecs((s) => {
        if (s <= 1) {
          clearInterval(interval);
          // Llama siempre la versión más reciente via ref
          setTimeout(() => handleEnviarRef.current(), 0);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [fase]);

  // ── Enviar respuestas ──
  async function handleEnviar() {
    if (!moduloInfo || fase !== 'examen') return;
    setFase('enviando');
    try {
      const body: Record<string, OpcionKey> = {};
      preguntas.forEach((p) => {
        if (respuestas[p.id]) body[String(p.id)] = respuestas[p.id];
      });
      const r = await api.post<ResultadoQuiz>(
        `/banco/modulo/${moduloInfo.num}/quiz/verificar`,
        { respuestas: body }
      );
      setResultado(r);
      setFase('resultados');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setErrorMsg('Error al enviar las respuestas. Intenta de nuevo.');
      setFase('error');
    }
  }

  // Mantener ref actualizada
  handleEnviarRef.current = handleEnviar;

  // ── Reintentar: nuevas preguntas aleatorias ──
  function reintentar() {
    if (!moduloInfo) return;
    setFase('cargando');
    api.get<{ preguntas: Pregunta[] }>(`/banco/modulo/${moduloInfo.num}/quiz`)
      .then((q) => {
        setPreguntas(q.preguntas);
        setRespuestas({});
        setIndice(0);
        setResultado(null);
        setFase('examen');
      })
      .catch(() => {
        setErrorMsg('Error al cargar nuevas preguntas.');
        setFase('error');
      });
  }

  // ── Derivados ──
  const contestadas = Object.keys(respuestas).length;
  const total = preguntas.length;
  const todasContestadas = total > 0 && contestadas === total;
  const porcentaje = total > 0 ? Math.round((contestadas / total) * 100) : 0;

  const timerColor =
    timerSecs <= 120 ? 'text-red-600 font-bold' :
    timerSecs <= 300 ? 'text-amber-600 font-semibold' :
    'text-stone-500';
  const timerPulse = timerSecs <= 120 ? 'animate-pulse' : '';

  // ── Renders por fase ──────────────────────────────────────────────────────

  if (fase === 'cargando') return <PantallaCarga mensaje="Preparando tu evaluacion..." />;
  if (fase === 'enviando') return <PantallaCarga mensaje="Enviando respuestas..." />;

  if (fase === 'error') {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-stone-200 p-8 max-w-md w-full text-center shadow-sm">
          <AlertTriangle size={40} className="mx-auto mb-4 text-amber-500" />
          <h2 className="font-serif text-xl font-bold text-stone-800 mb-2">Algo salio mal</h2>
          <p className="text-stone-500 text-sm mb-6">{errorMsg}</p>
          <Link href={`/estudiante/modulos/${moduloId}`}>
            <button className="px-5 py-2.5 rounded-lg border border-stone-200 text-stone-700 text-sm hover:bg-stone-50 transition-colors">
              Volver al modulo
            </button>
          </Link>
        </div>
      </div>
    );
  }

  // ── Pantalla de resultados ──────────────────────────────────────────────────
  if (fase === 'resultados' && resultado) {
    return (
      <div className="min-h-screen bg-stone-50">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-white border-b border-stone-200 px-4 sm:px-6 py-3 flex items-center gap-3">
          <Link href={`/estudiante/modulos/${moduloId}`}>
            <button className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-[var(--color-guinda-700)] transition-colors">
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Volver al modulo</span>
            </button>
          </Link>
          <div className="flex-1 text-center">
            <span className="text-xs text-stone-400 truncate block max-w-xs mx-auto">
              {moduloInfo?.nombre}
            </span>
          </div>
          <div className="w-16" />
        </header>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          {/* Card principal de puntaje */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-8 text-center">
            <div className="relative inline-block mb-5">
              <ScoreRing score={resultado.calificacion} size={152} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                  className={`text-4xl font-bold leading-none ${resultado.aprobado ? 'text-green-700' : 'text-amber-600'}`}
                >
                  {resultado.calificacion}
                </span>
                <span className="text-xs text-stone-400 mt-1">de 100</span>
              </div>
            </div>

            <h2 className={`font-serif text-2xl font-bold mb-2 ${resultado.aprobado ? 'text-green-700' : 'text-amber-600'}`}>
              {resultado.aprobado ? '¡Modulo aprobado!' : 'Sigue practicando'}
            </h2>
            <p className="text-stone-500 text-sm max-w-sm mx-auto mb-7">
              {resultado.aprobado
                ? 'Obtuviste calificacion aprobatoria. ¡Excelente trabajo!'
                : 'Necesitas 60 puntos para aprobar. Revisa las respuestas a continuacion y vuelve a intentarlo cuando quieras.'}
            </p>

            {/* Estadísticas */}
            <div className="flex justify-center gap-10 mb-8">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{resultado.correctas}</div>
                <div className="text-xs text-stone-400 mt-1 uppercase tracking-wide">Correctas</div>
              </div>
              <div className="w-px bg-stone-200" />
              <div className="text-center">
                <div className="text-3xl font-bold text-red-500">{resultado.incorrectas}</div>
                <div className="text-xs text-stone-400 mt-1 uppercase tracking-wide">Incorrectas</div>
              </div>
              <div className="w-px bg-stone-200" />
              <div className="text-center">
                <div className="text-3xl font-bold text-stone-600">{resultado.total}</div>
                <div className="text-xs text-stone-400 mt-1 uppercase tracking-wide">Total</div>
              </div>
            </div>

            {/* Acciones */}
            <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={reintentar}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[var(--color-guinda-700)] text-white text-sm font-semibold hover:bg-[var(--color-guinda-800)] transition-colors"
              >
                <RotateCcw size={15} />
                Nuevo intento
              </button>
              <Link href={`/estudiante/modulos/${moduloId}`}>
                <button className="flex items-center gap-2 px-6 py-2.5 rounded-xl border border-stone-200 text-stone-600 text-sm hover:bg-stone-50 transition-colors">
                  <BookOpen size={15} />
                  Volver al modulo
                </button>
              </Link>
            </div>
          </div>

          {/* Revisión pregunta por pregunta */}
          <div>
            <h3 className="font-serif text-lg font-bold text-stone-800 mb-4 flex items-center gap-2">
              <BookOpen size={18} className="text-[var(--color-guinda-700)]" />
              Revision de respuestas
            </h3>
            <p className="text-sm text-stone-500 mb-5">
              Revisa cada pregunta, la respuesta correcta y la explicacion para reforzar tu aprendizaje.
            </p>
            <div className="space-y-4">
              {resultado.feedback.map((item, i) => (
                <FeedbackCard key={item.id} item={item} idx={i} />
              ))}
            </div>
          </div>

          {/* Botón final */}
          <div className="flex flex-wrap justify-center gap-3 pb-8">
            <button
              onClick={reintentar}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[var(--color-guinda-700)] text-white text-sm font-semibold hover:bg-[var(--color-guinda-800)] transition-colors"
            >
              <RotateCcw size={15} />
              Nuevo intento
            </button>
            <Link href={`/estudiante/modulos/${moduloId}`}>
              <button className="flex items-center gap-2 px-6 py-2.5 rounded-xl border border-stone-200 text-stone-600 text-sm hover:bg-stone-50 transition-colors">
                <ArrowLeft size={15} />
                Volver al modulo
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Pantalla de examen ──────────────────────────────────────────────────────
  const pregunta = preguntas[indice];
  if (!pregunta) return null;
  const respuestaSel = respuestas[pregunta.id] ?? null;

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Header sticky */}
      <header className="sticky top-0 z-20 bg-white border-b border-stone-200 shadow-sm">
        {/* Barra de progreso (preguntas contestadas) */}
        <div className="h-1 bg-stone-100">
          <div
            className="h-1 bg-[var(--color-guinda-500)] transition-all duration-500"
            style={{ width: `${porcentaje}%` }}
          />
        </div>

        <div className="px-4 sm:px-6 py-3 flex items-center gap-3">
          {/* Salir */}
          <Link href={`/estudiante/modulos/${moduloId}`}>
            <button className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-[var(--color-guinda-700)] transition-colors shrink-0">
              <ArrowLeft size={16} />
              <span className="hidden sm:inline text-xs">Salir</span>
            </button>
          </Link>

          {/* Módulo */}
          <div className="flex-1 min-w-0 text-center px-2">
            <span className="text-base font-semibold text-stone-700 truncate block">
              {moduloInfo?.nombre}
            </span>
            <span className="text-sm text-stone-400">
              {contestadas} de {total} contestadas
            </span>
          </div>

          {/* Timer */}
          <div className={`flex items-center gap-1.5 text-base shrink-0 ${timerColor} ${timerPulse}`}>
            <Clock size={16} />
            {formatTimer(timerSecs)}
          </div>
        </div>

        {/* Mapa de puntos numerados — scroll horizontal en móvil si no caben */}
        <div className="pb-3 flex items-center gap-2 overflow-x-auto px-4 sm:px-6 scrollbar-none justify-start sm:justify-center">
          {preguntas.map((p, i) => {
            const contestada = !!respuestas[p.id];
            const actual = i === indice;
            return (
              <button
                key={p.id}
                onClick={() => setIndice(i)}
                aria-label={`Pregunta ${i + 1}${contestada ? ' (contestada)' : ''}`}
                className={`shrink-0 w-9 h-9 rounded-full text-sm font-bold transition-all duration-150 ${
                  actual
                    ? 'bg-[var(--color-guinda-700)] text-white ring-2 ring-[var(--color-guinda-300)] ring-offset-1 scale-110'
                    : contestada
                    ? 'bg-[var(--color-guinda-100)] text-[var(--color-guinda-700)] border border-[var(--color-guinda-300)]'
                    : 'bg-stone-100 text-stone-400 border border-stone-200 hover:border-stone-300 hover:text-stone-500'
                }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </header>

      {/* Área de pregunta */}
      <main className="flex-1 flex items-start justify-center px-4 sm:px-6 py-8">
        <div className="w-full max-w-3xl space-y-6">
          {/* Tarjeta de pregunta */}
          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6 sm:p-10">
            {/* Meta */}
            <div className="flex flex-wrap items-center gap-2.5 mb-6">
              <span className="text-sm font-semibold text-[var(--color-guinda-700)]">
                Pregunta {indice + 1} de {total}
              </span>
              {pregunta.dificultad && (
                <span className={`text-xs px-2 py-0.5 rounded-md font-bold ${DIFICULTAD_COLOR[pregunta.dificultad]}`}>
                  {DIFICULTAD_LABEL[pregunta.dificultad]}
                </span>
              )}
              {pregunta.tema && (
                <span className="text-xs text-stone-400 truncate max-w-[180px] sm:max-w-[300px]">
                  {pregunta.tema}
                </span>
              )}
            </div>

            {/* Texto de la pregunta */}
            <p className="text-stone-900 font-bold text-2xl sm:text-3xl leading-snug mb-8">
              {pregunta.pregunta}
            </p>

            {/* Opciones */}
            <div className="space-y-3.5">
              {OPCIONES.map((k) => (
                <OpcionBtn
                  key={k}
                  letra={k}
                  texto={textoOpcion(pregunta, k)}
                  seleccionada={respuestaSel === k}
                  onClick={() => setRespuestas((r) => ({ ...r, [pregunta.id]: k }))}
                />
              ))}
            </div>
          </div>

          {/* Navegación */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIndice((i) => Math.max(0, i - 1))}
              disabled={indice === 0}
              className="flex items-center gap-2 px-6 py-4 rounded-2xl border-2 border-stone-200 text-base font-semibold text-stone-700 bg-white hover:bg-stone-50 hover:border-stone-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={20} />
              Anterior
            </button>

            <div className="flex-1" />

            {indice < total - 1 ? (
              <button
                onClick={() => setIndice((i) => Math.min(total - 1, i + 1))}
                className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-stone-800 text-white text-base font-semibold hover:bg-stone-700 shadow-sm hover:shadow transition-all"
              >
                Siguiente
                <ChevronRight size={20} />
              </button>
            ) : (
              <button
                onClick={handleEnviar}
                disabled={!todasContestadas}
                title={!todasContestadas ? `Falta(n) ${total - contestadas} pregunta(s) por contestar` : ''}
                className={`flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-semibold transition-colors ${
                  todasContestadas
                    ? 'bg-[var(--color-guinda-700)] text-white hover:bg-[var(--color-guinda-800)] shadow-md'
                    : 'bg-stone-100 text-stone-400 cursor-not-allowed'
                }`}
              >
                <Trophy size={18} />
                Enviar evaluacion
              </button>
            )}
          </div>

          {/* Texto de ayuda bajo navegación */}
          {!todasContestadas ? (
            <p className="text-center text-sm text-stone-400">
              Usa los puntos de arriba para navegar entre preguntas
            </p>
          ) : indice < total - 1 ? (
            <div className="flex justify-center">
              <button
                onClick={handleEnviar}
                className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-[var(--color-guinda-700)] text-white text-base font-semibold hover:bg-[var(--color-guinda-800)] shadow-md transition-colors"
              >
                <Trophy size={18} />
                Enviar evaluacion
              </button>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
