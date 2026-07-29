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

      {/* Leyenda: qué significa cada color de la cuadrícula */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5 rounded-xl border border-stone-200 bg-white px-4 py-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600">
          <Info size={13} className="text-stone-400" /> Cómo leerlo:
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs text-stone-600">
          <span className="h-4 w-4 rounded" style={{ background: 'var(--color-guinda-700)' }} /> Día de examen
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs text-stone-600">
          <span className="h-4 w-4 rounded" style={{ background: '#fef3c7', border: '1px solid #fde68a' }} /> Ventana de inscripción
        </span>
        <span className="text-xs text-stone-400">Toca un día marcado para ver su detalle.</span>
      </div>

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
                  {e.estado === 'activa' && (
                    <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-green-700">
                      En curso
                    </span>
                  )}
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div className="flex items-start gap-2">
                    <CalendarClock size={15} className="mt-0.5 shrink-0 text-amber-600" />
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wide text-stone-400">Inscripción</div>
                      <div className="text-sm text-stone-700">{rango(e.solicitudInicio, e.solicitudFin)}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CalendarCheck size={15} className="mt-0.5 shrink-0 text-[var(--color-guinda-700)]" />
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
