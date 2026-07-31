/**
 * CALENDARIO — sección propia, compartida por gestor y alumno.
 *
 * Antes el calendario vivía apretado como una tarjeta desplegable dentro del
 * Inicio. Aquí es el contenido principal: el calendario completo del ciclo, con
 * la leyenda de qué significa cada color y las próximas fechas en texto, para
 * quien prefiere leerlas que interpretarlas en la cuadrícula.
 */

import { useEffect, useState } from 'react';
import { CalendarDays, CalendarClock, CalendarCheck, Info } from 'lucide-react';
import { CalendarioOficial } from '../components/CalendarioOficial';
import { GestorLayout } from './gestor/GestorLayout';
import { EstudianteLayout } from './estudiante/EstudianteLayout';
import { api } from '../lib/api';
import { CAL_INSCRIPCION, CAL_EXAMEN } from '../lib/coloresCalendario';

interface EtapaCal {
  clave: string;
  solicitudInicio: string | null;
  solicitudFin: string | null;
  examenSabado: string | null;
  examenDomingo: string | null;
  estado: string;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function fecha(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s + 'T00:00:00');
  return `${d.getDate()} de ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}
function rango(a: string | null, b: string | null): string {
  if (!a || !b) return '—';
  const da = new Date(a + 'T00:00:00'), db = new Date(b + 'T00:00:00');
  return da.getMonth() === db.getMonth()
    ? `${da.getDate()} al ${db.getDate()} de ${MESES[db.getMonth()]}`
    : `${da.getDate()} de ${MESES[da.getMonth()]} al ${db.getDate()} de ${MESES[db.getMonth()]}`;
}

function Contenido() {
  const [etapas, setEtapas] = useState<EtapaCal[]>([]);
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    api.get<{ etapas: EtapaCal[] }>('/anuncios/calendario-etapas')
      .then((r) => setEtapas(r.etapas ?? []))
      .catch(() => setEtapas([]))
      .finally(() => setCargado(true));
  }, []);

  const proximas = etapas.filter((e) => e.estado !== 'finalizada');

  return (
    <>
      <div className="mb-5">
        <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-guinda-700)] mb-1">
          Fechas oficiales
        </div>
        <h1 className="font-serif text-2xl font-bold text-stone-900">Calendario</h1>
        <p className="mt-1 text-sm text-stone-500">
          Todas las etapas del ciclo: cuándo se inscribe, cuándo se paga y cuándo se presenta el examen.
        </p>
      </div>

      {/* Leyenda: qué significa cada color de la cuadrícula.
          Va en grande y con la muestra IGUAL a la casilla real: la leyenda es
          lo que vuelve legible el resto de la pantalla, y en la versión chica
          —cuadritos de 16 px y letra de 12— se perdía justo debajo del título.
          Quien no descifra los colores no puede usar el calendario. */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <div
          className="flex items-center gap-4 rounded-2xl border-2 p-4"
          style={{ borderColor: CAL_EXAMEN.borde, background: CAL_EXAMEN.fondoSuave }}
        >
          <div
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl font-serif text-xl font-bold text-white shadow-sm"
            style={{ background: CAL_EXAMEN.fondo }}
            aria-hidden
          >
            18
          </div>
          <div className="min-w-0">
            <div className="text-base font-bold leading-tight" style={{ color: CAL_EXAMEN.texto }}>
              Día de examen
            </div>
            <p className="mt-0.5 text-[13px] leading-snug text-stone-600">
              Morado relleno. Es el día que te presentas a aplicar.
            </p>
          </div>
        </div>

        <div
          className="flex items-center gap-4 rounded-2xl border-2 p-4"
          style={{ borderColor: CAL_INSCRIPCION.borde, background: CAL_INSCRIPCION.fondoSuave }}
        >
          <div
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl font-serif text-xl font-bold shadow-sm"
            style={{ background: CAL_INSCRIPCION.fondo, color: CAL_INSCRIPCION.texto, border: `2px solid ${CAL_INSCRIPCION.borde}` }}
            aria-hidden
          >
            14
          </div>
          <div className="min-w-0">
            <div className="text-base font-bold leading-tight" style={{ color: CAL_INSCRIPCION.texto }}>
              Ventana de inscripción
            </div>
            <p className="mt-0.5 text-[13px] leading-snug text-stone-600">
              Rosa claro. Son los únicos días en que puedes inscribirte y pagar.
            </p>
          </div>
        </div>
      </div>

      <p className="mb-4 flex items-center gap-1.5 text-[13px] text-stone-500">
        <Info size={14} className="flex-shrink-0 text-stone-400" />
        Toca cualquier día marcado para ver su detalle.
      </p>

      <CalendarioOficial seccion />

      {/* Las mismas fechas, en texto: más fácil de leer que la cuadrícula. */}
      <div className="mt-6">
        <h2 className="mb-3 text-sm font-bold text-stone-900">Próximas etapas</h2>
        {!cargado ? (
          <div className="h-24 animate-pulse rounded-xl bg-stone-100" />
        ) : proximas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-300 bg-white/60 p-6 text-center text-sm text-stone-400">
            No hay etapas próximas publicadas por ahora.
          </div>
        ) : (
          <div className="space-y-2.5">
            {proximas.map((e) => (
              <div key={e.clave} className="rounded-xl border border-stone-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-serif text-lg font-bold uppercase text-stone-900">Etapa {e.clave}</div>
                  {e.estado === 'inscripcion' && (
                    <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-green-700">
                      Inscripción abierta
                    </span>
                  )}
                  {e.estado === 'espera_examen' && (
                    <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide"
                      style={{ background: CAL_EXAMEN.fondoSuave, color: CAL_EXAMEN.texto }}>
                      Rumbo al examen
                    </span>
                  )}
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div className="flex items-start gap-2">
                    <CalendarClock size={15} className="mt-0.5 shrink-0" style={{ color: CAL_INSCRIPCION.texto }} />
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wide text-stone-400">Inscripción</div>
                      <div className="text-sm text-stone-700">{rango(e.solicitudInicio, e.solicitudFin)}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CalendarCheck size={15} className="mt-0.5 shrink-0" style={{ color: CAL_EXAMEN.texto }} />
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wide text-stone-400">Examen</div>
                      <div className="text-sm text-stone-700">
                        {fecha(e.examenSabado)}{e.examenDomingo ? ` y ${fecha(e.examenDomingo)}` : ''}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="mt-4 flex items-start gap-1.5 text-[11px] text-stone-400">
        <CalendarDays size={12} className="mt-0.5 shrink-0" />
        Las fechas de inscripción son solo para inscribir. El pago se realiza después, en las fechas que indica la Secretaría.
      </p>
    </>
  );
}

export function CalendarioGestor() {
  return <GestorLayout><Contenido /></GestorLayout>;
}

export function CalendarioEstudiante() {
  return <EstudianteLayout><Contenido /></EstudianteLayout>;
}
