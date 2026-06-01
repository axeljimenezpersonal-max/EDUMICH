/**
 * Modal de evaluación — 20 preguntas aleatorias del banco oficial.
 * Flujo: carga → responde → envía → resultados con feedback.
 */

import { useEffect, useState } from 'react';
import {
  X, CheckCircle2, XCircle, Trophy, RotateCcw, ChevronRight, ChevronLeft, Loader2,
} from 'lucide-react';
import { api } from '../../lib/api';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Pregunta {
  id: number;
  preguntaDocId: string;
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
  opcionA: string; opcionB: string; opcionC: string; opcionD: string;
  respuestaCorrecta: 'A' | 'B' | 'C' | 'D';
  respuestaAlumno: 'A' | 'B' | 'C' | 'D' | null;
  acerto: boolean;
  explicacion: string;
  paraRepasar: string | null;
  tema: string;
}

interface ResultadoQuiz {
  moduloNum: number;
  total: number;
  correctas: number;
  incorrectas: number;
  calificacion: number;
  aprobado: boolean;
  feedback: FeedbackItem[];
}

type Fase = 'cargando' | 'quiz' | 'enviando' | 'resultado' | 'error';

const DIFICULTAD_COLOR: Record<string, string> = {
  facil: 'bg-green-100 text-green-700',
  media: 'bg-amber-100 text-amber-700',
  alta:  'bg-red-100 text-red-700',
};
const DIFICULTAD_LABEL: Record<string, string> = {
  facil: 'Fácil', media: 'Media', alta: 'Alta',
};

const OPCION_KEYS = ['A', 'B', 'C', 'D'] as const;
type OpcionKey = typeof OPCION_KEYS[number];

function opcionTexto(p: Pregunta, k: OpcionKey) {
  return k === 'A' ? p.opcionA : k === 'B' ? p.opcionB : k === 'C' ? p.opcionC : p.opcionD;
}

// ── Subcomponentes ────────────────────────────────────────────────────────────

function PreguntaCard({
  pregunta, index, total, respuesta, onSelect,
}: {
  pregunta: Pregunta;
  index: number;
  total: number;
  respuesta: OpcionKey | null;
  onSelect: (k: OpcionKey) => void;
}) {
  return (
    <div className="space-y-5">
      {/* Header de pregunta */}
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-semibold text-stone-400 shrink-0 mt-1">
          {index + 1} / {total}
        </span>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-stone-400">{pregunta.tema}</span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${DIFICULTAD_COLOR[pregunta.dificultad]}`}>
            {DIFICULTAD_LABEL[pregunta.dificultad]}
          </span>
        </div>
      </div>

      {/* Pregunta */}
      <p className="font-serif text-base font-semibold text-stone-900 leading-relaxed">
        {pregunta.pregunta}
      </p>

      {/* Opciones */}
      <div className="space-y-2.5">
        {OPCION_KEYS.map((k) => {
          const selected = respuesta === k;
          return (
            <button
              key={k}
              onClick={() => onSelect(k)}
              className={`w-full text-left flex items-start gap-3 px-4 py-3 rounded-lg border transition-all text-sm
                ${selected
                  ? 'border-[var(--color-guinda-700)] bg-[var(--color-guinda-50)] text-[var(--color-guinda-800)] font-semibold'
                  : 'border-stone-200 bg-white hover:border-stone-400 hover:bg-stone-50 text-stone-700'
                }`}
            >
              <span className={`shrink-0 w-6 h-6 rounded-full border text-xs font-bold flex items-center justify-center
                ${selected ? 'bg-[var(--color-guinda-700)] border-[var(--color-guinda-700)] text-white' : 'border-stone-300 text-stone-500'}`}>
                {k}
              </span>
              <span className="leading-relaxed">{opcionTexto(pregunta, k)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ResultadoScreen({
  resultado, moduloNombre, onCerrar, onReintentar,
}: {
  resultado: ResultadoQuiz;
  moduloNombre: string;
  onCerrar: () => void;
  onReintentar: () => void;
}) {
  const [verFeedback, setVerFeedback] = useState(false);

  const pct = resultado.calificacion;
  const color = resultado.aprobado ? 'text-green-600' : 'text-red-500';
  const bgRing = resultado.aprobado ? 'ring-green-400' : 'ring-red-400';

  return (
    <div className="space-y-6">
      {/* Score */}
      <div className="text-center py-4">
        <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full ring-4 ${bgRing} mb-4`}>
          <span className={`font-serif text-3xl font-bold ${color}`}>{pct}</span>
        </div>
        <div className={`text-lg font-bold ${color} mb-1`}>
          {resultado.aprobado ? '¡Módulo aprobado!' : 'No aprobado'}
        </div>
        <div className="text-stone-500 text-sm">{moduloNombre}</div>
        <div className="flex items-center justify-center gap-6 mt-4 text-sm text-stone-600">
          <span className="flex items-center gap-1.5 text-green-600">
            <CheckCircle2 size={14} /> {resultado.correctas} correctas
          </span>
          <span className="flex items-center gap-1.5 text-red-500">
            <XCircle size={14} /> {resultado.incorrectas} incorrectas
          </span>
        </div>
        {!resultado.aprobado && (
          <p className="text-xs text-stone-400 mt-3">Se requiere mínimo 60 puntos para aprobar</p>
        )}
      </div>

      {/* Botones de acción */}
      <div className="flex gap-3">
        <button
          onClick={onReintentar}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-[var(--color-guinda-700)] text-[var(--color-guinda-700)] text-sm font-semibold rounded-lg hover:bg-[var(--color-crema-100)] transition-colors"
        >
          <RotateCcw size={14} /> Nuevo intento
        </button>
        <button
          onClick={onCerrar}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--color-guinda-700)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--color-guinda-800)] transition-colors"
        >
          Cerrar
        </button>
      </div>

      {/* Feedback detallado */}
      <div>
        <button
          onClick={() => setVerFeedback(v => !v)}
          className="w-full text-sm text-[var(--color-guinda-700)] font-semibold py-2 border-t border-stone-100 hover:underline"
        >
          {verFeedback ? 'Ocultar respuestas' : 'Ver respuestas y explicaciones'}
        </button>

        {verFeedback && (
          <div className="space-y-4 mt-4">
            {resultado.feedback.map((item, i) => (
              <div
                key={item.id}
                className={`rounded-lg border p-4 text-sm ${item.acerto ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}
              >
                <div className="flex items-start gap-2 mb-3">
                  {item.acerto
                    ? <CheckCircle2 size={15} className="text-green-600 shrink-0 mt-0.5" />
                    : <XCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
                  }
                  <p className="font-medium text-stone-900 leading-snug">
                    {i + 1}. {item.pregunta}
                  </p>
                </div>

                <div className="space-y-1.5 mb-3">
                  {OPCION_KEYS.map((k) => {
                    const isCorrecta = item.respuestaCorrecta === k;
                    const isAlumno   = item.respuestaAlumno === k;
                    const texto = k === 'A' ? item.opcionA : k === 'B' ? item.opcionB : k === 'C' ? item.opcionC : item.opcionD;
                    return (
                      <div
                        key={k}
                        className={`flex items-start gap-2 px-3 py-2 rounded text-xs
                          ${isCorrecta ? 'bg-green-100 text-green-800 font-semibold'
                            : isAlumno && !isCorrecta ? 'bg-red-100 text-red-700 line-through'
                            : 'text-stone-500'}`}
                      >
                        <span className="font-bold shrink-0">{k}.</span>
                        <span>{texto}</span>
                        {isCorrecta && <CheckCircle2 size={11} className="ml-auto shrink-0 mt-0.5 text-green-600" />}
                      </div>
                    );
                  })}
                </div>

                <div className="bg-white rounded p-3 border border-stone-200">
                  <p className="text-xs font-semibold text-stone-500 mb-1">Explicación</p>
                  <p className="text-xs text-stone-700 leading-relaxed">{item.explicacion}</p>
                  {item.paraRepasar && (
                    <p className="text-xs text-[var(--color-guinda-700)] mt-2 font-medium">
                      Para repasar: {item.paraRepasar}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Modal principal ───────────────────────────────────────────────────────────

export function QuizModal({
  moduloNum,
  moduloNombre,
  onClose,
  onAprobado,
}: {
  moduloNum: number;
  moduloNombre: string;
  onClose: () => void;
  onAprobado?: () => void;
}) {
  const [fase, setFase] = useState<Fase>('cargando');
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [respuestas, setRespuestas] = useState<Record<number, OpcionKey>>({});
  const [indice, setIndice] = useState(0);
  const [resultado, setResultado] = useState<ResultadoQuiz | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  function cargarQuiz() {
    setFase('cargando');
    setRespuestas({});
    setIndice(0);
    setResultado(null);
    api
      .get<{ preguntas: Pregunta[] }>(`/banco/modulo/${moduloNum}/quiz`)
      .then((r) => {
        setPreguntas(r.preguntas);
        setFase('quiz');
      })
      .catch((e: Error) => {
        setErrorMsg(e.message || 'No hay preguntas disponibles para este módulo.');
        setFase('error');
      });
  }

  useEffect(() => { cargarQuiz(); }, [moduloNum]);

  async function handleEnviar() {
    if (Object.keys(respuestas).length < preguntas.length) {
      alert(`Responde todas las preguntas (faltan ${preguntas.length - Object.keys(respuestas).length})`);
      return;
    }
    setFase('enviando');
    try {
      const res = await api.post<ResultadoQuiz>(`/banco/modulo/${moduloNum}/quiz/verificar`, {
        respuestas: Object.fromEntries(
          Object.entries(respuestas).map(([id, r]) => [id, r])
        ),
      });
      setResultado(res);
      setFase('resultado');
      if (res.aprobado) onAprobado?.();
    } catch (e: unknown) {
      setErrorMsg((e as Error).message || 'Error al enviar respuestas');
      setFase('error');
    }
  }

  const respondidas = Object.keys(respuestas).length;
  const total = preguntas.length;
  const preguntaActual = preguntas[indice];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 shrink-0">
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-wide">Evaluación</p>
            <p className="font-semibold text-stone-900 text-sm truncate max-w-sm">{moduloNombre}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-stone-400 hover:text-stone-600 rounded-md hover:bg-stone-100">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* Cargando */}
          {fase === 'cargando' && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-stone-400">
              <Loader2 size={32} className="animate-spin" />
              <p className="text-sm">Cargando preguntas...</p>
            </div>
          )}

          {/* Error */}
          {fase === 'error' && (
            <div className="text-center py-12 space-y-4">
              <XCircle size={40} className="mx-auto text-red-400" />
              <p className="text-stone-600 text-sm">{errorMsg}</p>
              <button onClick={cargarQuiz} className="text-sm text-[var(--color-guinda-700)] underline">
                Reintentar
              </button>
            </div>
          )}

          {/* Quiz */}
          {fase === 'quiz' && preguntaActual && (
            <PreguntaCard
              pregunta={preguntaActual}
              index={indice}
              total={total}
              respuesta={respuestas[preguntaActual.id] ?? null}
              onSelect={(k) => setRespuestas(prev => ({ ...prev, [preguntaActual.id]: k }))}
            />
          )}

          {/* Enviando */}
          {fase === 'enviando' && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-stone-400">
              <Loader2 size={32} className="animate-spin" />
              <p className="text-sm">Calificando...</p>
            </div>
          )}

          {/* Resultado */}
          {fase === 'resultado' && resultado && (
            <ResultadoScreen
              resultado={resultado}
              moduloNombre={moduloNombre}
              onCerrar={onClose}
              onReintentar={cargarQuiz}
            />
          )}
        </div>

        {/* Footer — solo en fase quiz */}
        {fase === 'quiz' && (
          <div className="border-t border-stone-200 px-6 py-4 shrink-0">
            {/* Barra de progreso */}
            <div className="mb-3">
              <div className="flex justify-between text-xs text-stone-400 mb-1">
                <span>{respondidas} de {total} respondidas</span>
                <span>{Math.round((respondidas / total) * 100)}%</span>
              </div>
              <div className="h-1.5 bg-stone-100 rounded-full">
                <div
                  className="h-full bg-[var(--color-guinda-700)] rounded-full transition-all"
                  style={{ width: `${(respondidas / total) * 100}%` }}
                />
              </div>
            </div>

            {/* Navegación + enviar */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIndice(i => Math.max(0, i - 1))}
                disabled={indice === 0}
                className="p-2 rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>

              {/* Mapa de puntos */}
              <div className="flex-1 flex flex-wrap gap-1 justify-center">
                {preguntas.map((p, i) => (
                  <button
                    key={p.id}
                    onClick={() => setIndice(i)}
                    className={`w-6 h-6 rounded text-[10px] font-bold transition-colors
                      ${i === indice
                        ? 'bg-[var(--color-guinda-700)] text-white'
                        : respuestas[p.id]
                        ? 'bg-[var(--color-guinda-200)] text-[var(--color-guinda-800)]'
                        : 'bg-stone-100 text-stone-400'
                      }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              {indice < total - 1 ? (
                <button
                  onClick={() => setIndice(i => Math.min(total - 1, i + 1))}
                  className="p-2 rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50"
                >
                  <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  onClick={handleEnviar}
                  className="flex items-center gap-2 px-4 py-2 bg-[var(--color-guinda-700)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--color-guinda-800)] transition-colors"
                >
                  <Trophy size={14} />
                  Enviar
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
