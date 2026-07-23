/**
 * Inscripción en lote (gestor) — inscribe a VARIOS alumnos a uno o más módulos
 * de la etapa activa de una sola vez. Cada inscripción crea una fila en
 * examenes_inscripciones (estado 'inscrito'), que es exactamente lo que Pagos
 * reconoce como candidato para armar la ficha (individual o grupal). Así "todo
 * empata": inscribir aquí → aparece solo en Pagos → Nuevo pago.
 *
 * Flujo: elegir módulo(s) → elegir alumnos (solo los elegibles) → inscribir.
 * La inscripción individual dentro del perfil del alumno sigue disponible.
 */
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import {
  ClipboardList, Loader2, CheckCircle2, AlertCircle, Users, CalendarClock,
  CreditCard, X, Lock, Search, Clock, CalendarCheck,
} from 'lucide-react';
import { GestorLayout } from './GestorLayout';
import { api } from '../../lib/api';
import { fechaCorta } from '../../lib/fechas';

interface ModuloDisp { moduloId: number; numero: number; nombre: string; dia: string; hora: string; }
interface AlumnoElegible {
  userId: number; nombre: string; matricula: string | null;
  elegible: boolean; motivo?: string; yaInscritos: number[];
}
interface EtapaLote {
  id: number; clave: string; etapa: number; fase: string; estado: string;
  solicitudInicio: string | null; solicitudFin: string | null;
  examenSabado: string | null; examenDomingo: string | null;
}
interface DatosLote {
  etapa: EtapaLote | null;
  modulos: ModuloDisp[];
  alumnos: AlumnoElegible[];
  costoExamen: number;
}

const DIA_LABEL: Record<string, string> = { sabado: 'Sábado', domingo: 'Domingo' };
const HORA_LABEL: Record<string, string> = { '09:00': '9:00 AM', '11:00': '11:00 AM' };
interface ResultadoAlumno {
  estudianteId: number; nombre: string; elegible: boolean; motivo?: string;
  inscritos: number; folios: string[];
}
interface RespuestaLote {
  totalInscritos: number; alumnosInscritos: number; resultados: ResultadoAlumno[];
}

function diaCorto(d: string) { return d === 'sabado' ? 'Sábado' : d === 'domingo' ? 'Domingo' : d; }

export default function GestorInscripcion() {
  const [datos, setDatos] = useState<DatosLote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modulosSel, setModulosSel] = useState<Set<number>>(new Set());
  const [alumnosSel, setAlumnosSel] = useState<Set<number>>(new Set());
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<RespuestaLote | null>(null);
  const [filtroAlumno, setFiltroAlumno] = useState('');

  function cargar() {
    setLoading(true);
    api.get<DatosLote>('/gestor/inscripcion-lote/datos')
      .then(setDatos)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error al cargar'))
      .finally(() => setLoading(false));
  }
  useEffect(() => { cargar(); }, []);

  const elegibles = useMemo(() => datos?.alumnos.filter((a) => a.elegible) ?? [], [datos]);
  const noElegibles = useMemo(() => datos?.alumnos.filter((a) => !a.elegible) ?? [], [datos]);
  const elegiblesFiltrados = useMemo(() => {
    const q = filtroAlumno.trim().toLowerCase();
    if (!q) return elegibles;
    return elegibles.filter((a) => a.nombre.toLowerCase().includes(q) || (a.matricula ?? '').toLowerCase().includes(q));
  }, [elegibles, filtroAlumno]);
  const costo = datos?.costoExamen ?? 145;

  // Cuadrícula de horario: días (Sábado/Domingo) × horas, igual que la
  // inscripción individual. Un mismo día+hora es un "bloque": solo se puede
  // elegir un módulo por bloque (nadie presenta dos exámenes a la vez).
  const modulos = datos?.modulos ?? [];
  const diasOrd = useMemo(
    () => [...new Set(modulos.map((m) => m.dia))].sort((a, b) => (a === 'sabado' ? 0 : 1) - (b === 'sabado' ? 0 : 1)),
    [datos],
  );
  const horasOrd = useMemo(() => [...new Set(modulos.map((m) => m.hora))].sort(), [datos]);
  const fechaDeDia = (d: string) => (d === 'sabado' ? datos?.etapa?.examenSabado : d === 'domingo' ? datos?.etapa?.examenDomingo : null);
  function slotOcupado(m: ModuloDisp): boolean {
    if (modulosSel.has(m.moduloId)) return false;
    return modulos.some((x) => x.moduloId !== m.moduloId && modulosSel.has(x.moduloId) && x.dia === m.dia && x.hora === m.hora);
  }

  function toggleModulo(id: number) {
    setModulosSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAlumno(id: number) {
    setAlumnosSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleTodosElegibles() {
    setAlumnosSel((s) => (elegibles.length > 0 && elegibles.every((a) => s.has(a.userId)) ? new Set() : new Set(elegibles.map((a) => a.userId))));
  }

  async function inscribir() {
    if (!datos?.etapa || modulosSel.size === 0 || alumnosSel.size === 0) return;
    setEnviando(true); setError(null);
    try {
      const r = await api.post<RespuestaLote>('/gestor/inscripcion-lote', {
        etapaId: datos.etapa.id,
        modulosIds: [...modulosSel],
        estudianteIds: [...alumnosSel],
      });
      setResultado(r);
      setModulosSel(new Set());
      setAlumnosSel(new Set());
      cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo inscribir');
    } finally {
      setEnviando(false);
    }
  }

  const totalExamenes = modulosSel.size * alumnosSel.size;

  return (
    <GestorLayout>
      <div className="mb-1 text-xs font-bold uppercase tracking-widest text-[var(--color-guinda-700)] flex items-center gap-1.5">
        <ClipboardList size={14} /> Inscripción
      </div>
      <h1 className="font-serif text-2xl font-bold text-stone-900 mb-1">Inscripción en lote</h1>
      <p className="text-stone-500 text-sm mb-5">
        Inscribe a varios alumnos a uno o más módulos de golpe. Cada inscripción queda lista para
        solicitar su ficha en <b>Pagos</b> (individual o grupal). Cada examen cuesta <b>${costo} MXN</b>.
      </p>

      {loading ? (
        <div className="text-center text-stone-400 py-16 text-sm">Cargando…</div>
      ) : !datos?.etapa ? (
        <div className="border-2 border-dashed border-stone-200 rounded-xl p-12 text-center">
          <CalendarClock size={30} className="mx-auto text-stone-300 mb-3" />
          <div className="font-bold text-stone-900 mb-1">No hay una etapa con inscripción abierta</div>
          <p className="text-sm text-stone-500 max-w-md mx-auto">
            La inscripción solo está disponible dentro de la ventana de solicitud de una etapa. Vuelve cuando abra la siguiente.
          </p>
        </div>
      ) : (
        <div className="space-y-5 pb-24">
          {/* Etapa activa — destacada, con la clave en grande */}
          <div className="rounded-xl border-2 px-5 py-4 flex items-center gap-3.5" style={{ borderColor: '#e8c4d4', background: 'var(--color-crema-100)' }}>
            <div className="w-12 h-12 rounded-xl bg-[var(--color-guinda-700)] text-white flex items-center justify-center shrink-0">
              <CalendarClock size={22} />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-guinda-700)]">Etapa activa</div>
              <div className="font-serif text-xl font-bold text-stone-900 leading-tight">Etapa {datos.etapa.clave}</div>
            </div>
            <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-green-100 text-green-700">
              <span className="w-2 h-2 rounded-full bg-green-500" /> Ventana abierta
            </span>
          </div>

          {/* 1. Módulos */}
          <div className="bg-white border border-stone-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-6 h-6 rounded-full bg-[var(--color-guinda-700)] text-white text-xs font-bold flex items-center justify-center">1</span>
              <h3 className="text-sm font-bold text-stone-800">Elige el o los módulos</h3>
            </div>
            <p className="text-xs text-stone-500 mb-3 pl-8">Se inscribirá a cada alumno seleccionado en estos módulos (máx. 4 por alumno; los que ya tenga se omiten). Un mismo día y hora es un bloque: solo se elige uno de cada bloque.</p>
            {datos.modulos.length === 0 ? (
              <div className="text-sm text-stone-400 pl-8 py-2">Esta etapa no tiene módulos con horario configurado.</div>
            ) : (
              <div className="overflow-x-auto -mx-1 px-1 pb-1">
                <div className="grid gap-2 min-w-[560px]" style={{ gridTemplateColumns: `64px repeat(${diasOrd.length}, minmax(0,1fr))` }}>
                  {/* Encabezado: días con su fecha de examen */}
                  <div />
                  {diasOrd.map((d) => {
                    const fecha = fechaDeDia(d);
                    return (
                      <div key={`h-${d}`} className="text-center pb-1.5 border-b-2" style={{ borderColor: '#e8c4d4' }}>
                        <div className="text-xs font-bold uppercase tracking-wide text-[var(--color-guinda-700)]">{DIA_LABEL[d] ?? d}</div>
                        {fecha && <div className="text-[10px] font-medium text-stone-400 normal-case mt-0.5">{fechaCorta(fecha)}</div>}
                      </div>
                    );
                  })}
                  {/* Filas: una por hora */}
                  {horasOrd.map((h) => (
                    <Fragment key={`row-${h}`}>
                      <div className="flex items-center justify-end pr-1.5 text-[11px] font-bold text-stone-500">
                        <Clock size={11} className="mr-1 text-stone-400 shrink-0" />{HORA_LABEL[h] ?? h}
                      </div>
                      {diasOrd.map((d) => {
                        const slotMods = datos.modulos.filter((m) => m.dia === d && m.hora === h);
                        return (
                          <div key={`c-${d}-${h}`} className="rounded-xl border border-stone-100 bg-stone-50/40 p-1.5 space-y-1.5">
                            {slotMods.length === 0 ? (
                              <div className="flex items-center justify-center text-[11px] text-stone-300 py-4">—</div>
                            ) : (
                              <>
                                {slotMods.map((m) => {
                                  const checked = modulosSel.has(m.moduloId);
                                  const ocupado = slotOcupado(m);
                                  return (
                                    <label
                                      key={m.moduloId}
                                      className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition-all duration-200 select-none ${
                                        ocupado
                                          ? 'border-stone-200 bg-stone-50 opacity-55 cursor-not-allowed'
                                          : checked
                                            ? 'border-[var(--color-guinda-700)] bg-[var(--color-guinda-50,#faf0f3)] cursor-pointer ring-1 ring-[var(--color-guinda-700)]'
                                            : 'border-stone-200 bg-white hover:bg-stone-50 cursor-pointer'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        disabled={ocupado}
                                        onChange={() => !ocupado && toggleModulo(m.moduloId)}
                                        className="w-4 h-4 shrink-0 mt-0.5 accent-[var(--color-guinda-700)]"
                                      />
                                      <div className="min-w-0 flex-1">
                                        <div className={`text-[11px] font-bold ${checked ? 'text-[var(--color-guinda-700)]' : 'text-stone-400'}`}>Módulo {m.numero}</div>
                                        <div className="text-xs text-stone-700 leading-snug">{m.nombre}</div>
                                      </div>
                                    </label>
                                  );
                                })}
                                {slotMods.length > 1 && (
                                  <div className="text-center text-[9px] text-stone-400 font-semibold uppercase tracking-wide">Empalmados · elige uno</div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </Fragment>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 2. Alumnos */}
          <div className="bg-white border border-stone-200 rounded-xl p-4">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[var(--color-guinda-700)] text-white text-xs font-bold flex items-center justify-center">2</span>
                <h3 className="text-sm font-bold text-stone-800">Elige los alumnos</h3>
              </div>
              {elegibles.length > 0 && (
                <button onClick={toggleTodosElegibles} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--color-guinda-700)] text-[var(--color-guinda-700)] hover:bg-[var(--color-guinda-50,#faf0f3)]">
                  {elegibles.every((a) => alumnosSel.has(a.userId)) ? 'Quitar todos' : 'Seleccionar elegibles'}
                </button>
              )}
            </div>
            <p className="text-xs text-stone-500 mb-3 pl-8"><Users size={11} className="inline -mt-0.5" /> Solo se pueden inscribir alumnos con matrícula oficial y expediente 5/5 aprobado.</p>

            {/* Mini filtro de búsqueda */}
            {elegibles.length > 0 && (
              <div className="relative mb-2">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  value={filtroAlumno}
                  onChange={(e) => setFiltroAlumno(e.target.value)}
                  placeholder="Buscar alumno por nombre o matrícula…"
                  className="w-full text-sm border border-stone-300 rounded-lg pl-9 pr-8 py-2 bg-white focus:outline-none focus:border-[var(--color-guinda-700)]"
                />
                {filtroAlumno && (
                  <button onClick={() => setFiltroAlumno('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700" aria-label="Limpiar">
                    <X size={15} />
                  </button>
                )}
              </div>
            )}
            {elegibles.length > 0 && (
              <div className="text-[11px] text-stone-400 mb-1 px-1">
                {alumnosSel.size} de {elegibles.length} seleccionado(s){filtroAlumno && ` · ${elegiblesFiltrados.length} coinciden`}
              </div>
            )}

            <div className="divide-y divide-stone-100">
              {elegiblesFiltrados.map((a) => {
                const on = alumnosSel.has(a.userId);
                return (
                  <button key={a.userId} onClick={() => toggleAlumno(a.userId)} className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-stone-50 rounded-lg px-2">
                    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-[var(--color-guinda-700)] border-[var(--color-guinda-700)]' : 'border-stone-300'}`}>
                      {on && <CheckCircle2 size={12} className="text-white" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-stone-900 truncate">{a.nombre}</div>
                      <div className="text-[11px] font-mono text-stone-400">{a.matricula ?? '—'}</div>
                    </div>
                    {a.yaInscritos.length > 0 && (
                      <span className="text-[10px] text-stone-400">{a.yaInscritos.length} módulo(s) ya inscrito(s)</span>
                    )}
                  </button>
                );
              })}
              {elegibles.length === 0 && (
                <div className="text-sm text-stone-400 py-6 text-center">Ningún alumno cumple aún los requisitos (matrícula + expediente aprobado).</div>
              )}
              {elegibles.length > 0 && elegiblesFiltrados.length === 0 && (
                <div className="text-sm text-stone-400 py-6 text-center">Ningún alumno coincide con «{filtroAlumno}».</div>
              )}
            </div>

            {/* No elegibles (informativo) */}
            {noElegibles.length > 0 && (
              <details className="mt-3">
                <summary className="text-xs font-semibold text-stone-500 cursor-pointer hover:text-stone-700">No elegibles todavía ({noElegibles.length})</summary>
                <div className="mt-2 space-y-1">
                  {noElegibles.map((a) => (
                    <div key={a.userId} className="flex items-center gap-2 text-xs text-stone-500 px-2 py-1">
                      <Lock size={11} className="text-stone-400 shrink-0" />
                      <span className="truncate">{a.nombre}</span>
                      <span className="ml-auto text-amber-700">{a.motivo}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>

          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle size={15} className="shrink-0 mt-0.5" /> {error}
            </div>
          )}
        </div>
      )}

      {/* Barra de acción fija */}
      {datos?.etapa && (
        <div className="fixed bottom-0 left-0 right-0 md:left-[var(--sidebar-w,280px)] bg-white/95 backdrop-blur border-t border-stone-200 px-5 py-3 flex items-center justify-between gap-3 z-20">
          <div className="text-sm text-stone-600">
            {modulosSel.size} módulo(s) · {alumnosSel.size} alumno(s)
            {totalExamenes > 0 && <span className="text-stone-400"> · hasta {totalExamenes} examen(es)</span>}
          </div>
          <button
            onClick={inscribir}
            disabled={enviando || modulosSel.size === 0 || alumnosSel.size === 0}
            className="inline-flex items-center gap-2 py-2.5 px-5 bg-[var(--color-guinda-700)] text-white text-sm font-semibold rounded-xl hover:bg-[var(--color-guinda-800)] disabled:opacity-50 transition-colors"
          >
            {enviando ? <Loader2 size={15} className="animate-spin" /> : <ClipboardList size={15} />}
            Inscribir
          </button>
        </div>
      )}

      {/* Resultado */}
      {resultado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setResultado(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
              <h3 className="font-serif text-base font-bold text-stone-900">Resultado de la inscripción</h3>
              <button onClick={() => setResultado(null)} className="text-stone-400 hover:text-stone-700"><X size={18} /></button>
            </div>
            <div className="p-5">
              <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 p-3 mb-3">
                <CheckCircle2 size={18} className="text-green-600 shrink-0" />
                <div className="text-sm text-green-800">
                  Se inscribieron <b>{resultado.totalInscritos}</b> examen(es) en <b>{resultado.alumnosInscritos}</b> alumno(s).
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-stone-100">
                {resultado.resultados.map((r) => (
                  <div key={r.estudianteId} className="flex items-center gap-2 py-2 text-sm">
                    {r.inscritos > 0
                      ? <CheckCircle2 size={14} className="text-green-600 shrink-0" />
                      : <AlertCircle size={14} className="text-amber-500 shrink-0" />}
                    <span className="min-w-0 flex-1 truncate text-stone-800">{r.nombre}</span>
                    <span className="text-xs text-stone-500 shrink-0">
                      {r.inscritos > 0 ? `+${r.inscritos} examen(es)` : (r.motivo ?? 'sin cambios')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button onClick={() => setResultado(null)} className="flex-1 py-2.5 rounded-lg border border-stone-300 text-stone-700 text-sm font-semibold hover:bg-stone-50">
                Seguir inscribiendo
              </button>
              <Link href="/gestor/pagos" className="flex-1 py-2.5 rounded-lg bg-[var(--color-guinda-700)] text-white text-sm font-semibold hover:bg-[var(--color-guinda-800)] flex items-center justify-center gap-2">
                <CreditCard size={15} /> Ir a Pagos
              </Link>
            </div>
          </div>
        </div>
      )}
    </GestorLayout>
  );
}
