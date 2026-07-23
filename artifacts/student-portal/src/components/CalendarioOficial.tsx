/**
 * CalendarioOficial — calendario visual de las etapas (convocatorias) de Prepa
 * Abierta. Muestra, por día, la ventana de INSCRIPCIÓN Y PAGO y los DÍAS DE
 * EXAMEN de cada etapa. Colapsado por defecto (toggle con ojito, como la cédula).
 *
 * Se usa en el inicio de alumno y gestor. Datos: GET /anuncios/calendario-etapas.
 */
import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, ChevronLeft, ChevronRight, CalendarDays, Download, CalendarClock, CalendarCheck } from 'lucide-react';
import { api } from '../lib/api';

interface Etapa {
  clave: string; etapa: string; fase: string; anio: number;
  solicitudInicio: string | null; solicitudFin: string | null;
  examenSabado: string | null; examenDomingo: string | null;
  estado: 'finalizada' | 'inscripcion' | 'proxima' | 'espera_examen';
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DOW = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const GUINDA = 'var(--color-guinda-700)';

function fmt(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function parse(s: string) { return new Date(s + 'T00:00:00'); }
function eachDay(a: string, b: string): string[] {
  const out: string[] = []; const d = parse(a); const end = parse(b);
  let guard = 0;
  while (d <= end && guard++ < 400) { out.push(fmt(d)); d.setDate(d.getDate() + 1); }
  return out;
}
function fechaLarga(s: string) { const d = parse(s); return `${d.getDate()} de ${MESES[d.getMonth()].toLowerCase()}`; }
function rango(a: string | null, b: string | null) {
  if (!a) return '—';
  const da = parse(a); const db = b ? parse(b) : da;
  if (!b || a === b) return `${da.getDate()} ${MES_C[da.getMonth()]}`;
  return da.getMonth() === db.getMonth()
    ? `${da.getDate()}–${db.getDate()} ${MES_C[db.getMonth()]}`
    : `${da.getDate()} ${MES_C[da.getMonth()]} – ${db.getDate()} ${MES_C[db.getMonth()]}`;
}

const ESTADO_BADGE: Record<Etapa['estado'], { label: string; bg: string; color: string }> = {
  inscripcion: { label: 'Inscripción abierta', bg: '#dcfce7', color: '#166534' },
  proxima: { label: 'Próxima', bg: '#dbeafe', color: '#1e40af' },
  espera_examen: { label: 'Rumbo al examen', bg: '#fef3c7', color: '#92400e' },
  finalizada: { label: 'Finalizada', bg: '#f1f0ee', color: '#78716c' },
};

/** Una tarjeta de etapa en la agenda lateral (inscripción + examen). */
function TarjetaEtapa({ e }: { e: Etapa }) {
  const badge = ESTADO_BADGE[e.estado];
  const dim = e.estado === 'finalizada';
  return (
    <div className={`rounded-lg border p-3 ${dim ? 'border-stone-100 opacity-60' : 'border-stone-200'}`}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="font-bold text-sm text-stone-900">Etapa {e.clave}</div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-stone-600">
        <CalendarClock size={12} className="text-amber-600 shrink-0" /> Inscripción y pago: <b className="text-stone-800">{rango(e.solicitudInicio, e.solicitudFin)}</b>
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-stone-600 mt-0.5">
        <CalendarCheck size={12} className="text-[var(--color-guinda-700)] shrink-0" /> Examen: <b className="text-stone-800">{rango(e.examenSabado, e.examenDomingo)}</b>
      </div>
    </div>
  );
}

export function CalendarioOficial() {
  const [abierto, setAbierto] = useState(false);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [hoy, setHoy] = useState<string>(fmt(new Date()));
  const [cursor, setCursor] = useState<{ y: number; m: number }>(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [sel, setSel] = useState<string | null>(null);
  const [cargado, setCargado] = useState(false);
  const [verFinalizadas, setVerFinalizadas] = useState(false);

  useEffect(() => {
    if (!abierto || cargado) return;
    api.get<{ etapas: Etapa[]; hoy: string }>('/anuncios/calendario-etapas')
      .then((r) => {
        setEtapas(r.etapas ?? []);
        setHoy(r.hoy ?? fmt(new Date()));
        // Posiciona el calendario en el mes de la próxima fecha relevante.
        const futuras = (r.etapas ?? [])
          .flatMap((e) => [e.solicitudInicio, e.examenSabado])
          .filter((s): s is string => !!s && s >= (r.hoy ?? ''))
          .sort();
        const base = futuras[0] ? parse(futuras[0]) : new Date();
        setCursor({ y: base.getFullYear(), m: base.getMonth() });
      })
      .catch(() => {})
      .finally(() => setCargado(true));
  }, [abierto, cargado]);

  // Mapa día → marcadores (etapas con inscripción / examen ese día).
  const marks = useMemo(() => {
    const map = new Map<string, { solicitud: string[]; examen: string[] }>();
    const add = (day: string, kind: 'solicitud' | 'examen', clave: string) => {
      const m = map.get(day) ?? { solicitud: [], examen: [] };
      if (!m[kind].includes(clave)) m[kind].push(clave);
      map.set(day, m);
    };
    for (const e of etapas) {
      if (e.solicitudInicio && e.solicitudFin) for (const d of eachDay(e.solicitudInicio, e.solicitudFin)) add(d, 'solicitud', e.clave);
      if (e.examenSabado) add(e.examenSabado, 'examen', e.clave);
      if (e.examenDomingo) add(e.examenDomingo, 'examen', e.clave);
    }
    return map;
  }, [etapas]);

  // Celdas del mes (lunes primero).
  const celdas = useMemo(() => {
    const primero = new Date(cursor.y, cursor.m, 1);
    const offset = (primero.getDay() + 6) % 7; // Lun=0
    const dias = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const arr: (string | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= dias; d++) arr.push(fmt(new Date(cursor.y, cursor.m, d)));
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [cursor]);

  const mover = (delta: number) => {
    setSel(null);
    setCursor((c) => { const d = new Date(c.y, c.m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  };

  function descargarICS() {
    const dt = (s: string) => s.replace(/-/g, '');
    const nextDay = (s: string) => { const d = parse(s); d.setDate(d.getDate() + 1); return fmt(d).replace(/-/g, ''); };
    const ev: string[] = [];
    const push = (uid: string, summary: string, start: string, endExcl: string) =>
      ev.push('BEGIN:VEVENT', `UID:${uid}@edumich`, `DTSTART;VALUE=DATE:${start}`, `DTEND;VALUE=DATE:${endExcl}`, `SUMMARY:${summary}`, 'END:VEVENT');
    for (const e of etapas) {
      if (e.solicitudInicio && e.solicitudFin) push(`insc-${e.clave}`, `Inscripción y pago · Etapa ${e.clave}`, dt(e.solicitudInicio), nextDay(e.solicitudFin));
      if (e.examenSabado) push(`exs-${e.clave}`, `Examen · Etapa ${e.clave} (sábado)`, dt(e.examenSabado), nextDay(e.examenSabado));
      if (e.examenDomingo) push(`exd-${e.clave}`, `Examen · Etapa ${e.clave} (domingo)`, dt(e.examenDomingo), nextDay(e.examenDomingo));
    }
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Modula//Calendario//ES', 'CALSCALE:GREGORIAN', ...ev, 'END:VCALENDAR'].join('\r\n');
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    const a = document.createElement('a'); a.href = url; a.download = 'calendario-preparatoria-abierta.ics';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  const selMark = sel ? marks.get(sel) : null;
  const etapasOrden = useMemo(() =>
    [...etapas].sort((a, b) => (a.solicitudInicio ?? '9') < (b.solicitudInicio ?? '9') ? -1 : 1)
      .sort((a, b) => (a.estado === 'finalizada' ? 1 : 0) - (b.estado === 'finalizada' ? 1 : 0)),
    [etapas]);
  const activas = useMemo(() => etapasOrden.filter((e) => e.estado !== 'finalizada'), [etapasOrden]);
  const finalizadas = useMemo(() => etapasOrden.filter((e) => e.estado === 'finalizada'), [etapasOrden]);

  return (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
      {/* Encabezado + toggle */}
      <div className="px-5 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-[var(--color-crema-100)] text-[var(--color-guinda-700)]">
            <CalendarDays size={18} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-stone-900">Calendario oficial de exámenes</div>
            <div className="text-xs text-stone-500">Fechas de inscripción, pago y presentación de cada etapa.</div>
          </div>
        </div>
        <button
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          className="shrink-0 inline-flex items-center gap-1.5 border border-stone-300 text-stone-700 font-semibold text-sm px-4 py-2 rounded-lg hover:bg-stone-50 transition-colors"
        >
          {abierto ? <EyeOff size={15} /> : <Eye size={15} />}
          {abierto ? 'Ocultar' : 'Ver calendario'}
        </button>
      </div>

      {abierto && (
        <div className="border-t border-stone-100 p-5">
          {!cargado ? (
            <div className="h-64 rounded-xl animate-pulse bg-stone-100" />
          ) : (
            <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-6">
              {/* Calendario */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <button onClick={() => mover(-1)} className="w-8 h-8 rounded-lg border border-stone-200 flex items-center justify-center hover:bg-stone-50" aria-label="Mes anterior"><ChevronLeft size={16} /></button>
                  <div className="font-serif text-lg font-bold text-stone-900">{MESES[cursor.m]} {cursor.y}</div>
                  <button onClick={() => mover(1)} className="w-8 h-8 rounded-lg border border-stone-200 flex items-center justify-center hover:bg-stone-50" aria-label="Mes siguiente"><ChevronRight size={16} /></button>
                </div>

                <div className="grid grid-cols-7 gap-1 mb-1">
                  {DOW.map((d, i) => <div key={i} className="text-center text-[10px] font-bold uppercase text-stone-400 py-1">{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {celdas.map((day, i) => {
                    if (!day) return <div key={i} />;
                    const m = marks.get(day);
                    const esExamen = !!m?.examen.length;
                    const esSolic = !!m?.solicitud.length;
                    const esHoy = day === hoy;
                    const num = parse(day).getDate();
                    const clickable = esExamen || esSolic;
                    let style: React.CSSProperties = {};
                    let cls = 'text-stone-600';
                    if (esExamen) { style = { background: GUINDA, color: '#fff' }; cls = 'font-bold'; }
                    else if (esSolic) { style = { background: '#fef3c7', color: '#92400e' }; cls = 'font-semibold'; }
                    return (
                      <button
                        key={i}
                        onClick={() => clickable && setSel(sel === day ? null : day)}
                        className={`aspect-square rounded-lg text-sm flex items-center justify-center relative transition-all ${cls} ${clickable ? 'cursor-pointer hover:ring-2 hover:ring-[var(--color-guinda-300)]' : 'cursor-default'} ${sel === day ? 'ring-2 ring-[var(--color-guinda-600)]' : ''}`}
                        style={{ ...style, outline: esHoy ? '2px solid var(--color-guinda-600)' : undefined, outlineOffset: esHoy ? -2 : undefined }}
                      >
                        {num}
                      </button>
                    );
                  })}
                </div>

                {/* Leyenda */}
                <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-stone-600">
                  <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded" style={{ background: '#fef3c7', border: '1px solid #fcd34d' }} /> Inscripción y pago</span>
                  <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded" style={{ background: GUINDA }} /> Examen</span>
                  <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded ring-2 ring-[var(--color-guinda-600)]" /> Hoy</span>
                </div>

                {/* Detalle del día seleccionado */}
                {sel && selMark && (
                  <div className="mt-4 rounded-lg border border-stone-200 bg-[var(--color-crema-50)] p-3">
                    <div className="text-xs font-bold text-stone-800 mb-1.5">{fechaLarga(sel)}</div>
                    {selMark.examen.map((c) => (
                      <div key={'e' + c} className="flex items-center gap-2 text-xs text-stone-700 mb-1">
                        <CalendarCheck size={13} className="text-[var(--color-guinda-700)]" /> <b>Examen</b> · Etapa {c}
                      </div>
                    ))}
                    {selMark.solicitud.map((c) => (
                      <div key={'s' + c} className="flex items-center gap-2 text-xs text-stone-700">
                        <CalendarClock size={13} className="text-amber-600" /> Inscripción y pago · Etapa {c}
                      </div>
                    ))}
                  </div>
                )}

                <button onClick={descargarICS} className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-guinda-700)] border border-stone-300 rounded-lg px-3 py-2 hover:bg-stone-50 transition-colors">
                  <Download size={13} /> Añadir a mi calendario (.ics)
                </button>
              </div>

              {/* Agenda de etapas — por defecto solo las vigentes; las finalizadas
                  se ocultan tras un botón para no saturar la vista. */}
              <div className="min-w-0">
                <div className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">Próximas etapas</div>
                <div className="space-y-2">
                  {activas.map((e) => <TarjetaEtapa key={e.clave} e={e} />)}
                  {activas.length === 0 && finalizadas.length === 0 && (
                    <div className="text-sm text-stone-400 text-center py-8">Aún no hay etapas cargadas.</div>
                  )}
                  {activas.length === 0 && finalizadas.length > 0 && (
                    <div className="text-sm text-stone-400 text-center py-6">No hay etapas próximas por ahora.</div>
                  )}

                  {finalizadas.length > 0 && (
                    <>
                      <button
                        onClick={() => setVerFinalizadas((v) => !v)}
                        className="w-full text-xs font-semibold text-stone-500 hover:text-stone-700 border border-stone-200 rounded-lg px-3 py-2 hover:bg-stone-50 transition-colors"
                      >
                        {verFinalizadas ? 'Ocultar finalizadas' : `Ver etapas finalizadas (${finalizadas.length})`}
                      </button>
                      {verFinalizadas && finalizadas.map((e) => <TarjetaEtapa key={e.clave} e={e} />)}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CalendarioOficial;
