/**
 * Los exámenes que vienen, para el centro de asesoría.
 *
 * NO es la pantalla del alumno reutilizada, y eso es a propósito. El alumno
 * necesita saber A DÓNDE VA; el centro necesita saber A QUIÉN LE TOCA. Repetirle
 * al gestor treinta veces "lleva pluma azul" no le sirve de nada: lo que le
 * sirve es la lista, ordenada por hora, con quién todavía no ha pagado — que es
 * la única fila sobre la que él puede actuar, y sólo mientras la ventana sigue
 * abierta.
 *
 * Es el mismo criterio con el que se escribieron los dos correos de
 * recordatorio, que son distintos por la misma razón.
 */
import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { CalendarClock, AlertTriangle, MapPin, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { fechaLarga, mayusculaInicial } from '../../lib/fechas';
import { diasHastaExamen, cuandoEs } from '../../lib/examen';

interface ExamenProximo {
  id: number;
  estudianteId: number;
  alumno: string;
  modulo: { numero: number; nombre: string };
  fecha: string;
  hora: string;
  dia: string;
  sede: string | null;
  sedeDireccion: string | null;
  estado: string;
  pagado: boolean;
}

const GUINDA = 'var(--color-guinda-700)';

export function ExamenesProximos() {
  const [examenes, setExamenes] = useState<ExamenProximo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ examenes: ExamenProximo[] }>('/gestor/examenes-proximos')
      .then((r) => setExamenes(r.examenes))
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar'));
  }, []);

  if (error) {
    return (
      <div className="flex items-start gap-2.5 rounded-2xl border px-4 py-3"
           style={{ borderColor: '#fecaca', background: '#fef2f2' }}>
        <AlertTriangle size={15} className="mt-0.5 shrink-0 text-red-600" />
        <p className="text-[13px] text-red-700">{error}</p>
      </div>
    );
  }

  if (examenes === null) {
    return (
      <div className="rounded-2xl border bg-white px-4 py-8 text-center text-[13px] text-stone-400"
           style={{ borderColor: '#e7e0d7' }}>
        Cargando los exámenes que vienen…
      </div>
    );
  }

  if (examenes.length === 0) {
    return (
      <div className="rounded-2xl border bg-white px-4 py-8 text-center" style={{ borderColor: '#e7e0d7' }}>
        <CalendarClock size={26} className="mx-auto mb-2 text-stone-300" />
        <p className="text-[13.5px] font-semibold text-stone-600">Ningún alumno tuyo tiene examen próximo</p>
        <p className="mt-1 text-[12.5px] text-stone-400">
          En cuanto inscribas a alguien, su examen aparecerá aquí con fecha, hora y sede.
        </p>
      </div>
    );
  }

  // Por día, que es como el centro organiza el trabajo: un traslado, una
  // llamada de confirmación y una persona acompañando se planean por jornada.
  const porFecha = new Map<string, ExamenProximo[]>();
  for (const ex of examenes) {
    const lista = porFecha.get(ex.fecha) ?? [];
    lista.push(ex);
    porFecha.set(ex.fecha, lista);
  }

  const sinPagar = examenes.filter((e) => !e.pagado).length;

  return (
    <div className="space-y-4">
      {sinPagar > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border px-4 py-3"
             style={{ borderColor: '#f6dfae', background: '#fff8ec' }}>
          <AlertTriangle size={15} className="mt-0.5 shrink-0" style={{ color: '#92400e' }} />
          <div className="text-[12.5px] leading-relaxed" style={{ color: '#7c5314' }}>
            <strong>{sinPagar}</strong> {sinPagar === 1 ? 'examen sigue' : 'exámenes siguen'} sin pago
            verificado. Sin pago no se genera el pase, y sin pase no se puede presentar.{' '}
            <Link href="/gestor/pagos" className="font-semibold underline">Ver pagos</Link>
          </div>
        </div>
      )}

      {[...porFecha.entries()].map(([fecha, lista]) => {
        const dias = diasHastaExamen(fecha);
        return (
          <div key={fecha} className="overflow-hidden rounded-2xl border bg-white" style={{ borderColor: '#e7e0d7' }}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3"
                 style={{ borderColor: '#f0eae2', background: '#fdfbf8' }}>
              <div>
                <p className="text-[13.5px] font-bold text-stone-900">
                  {mayusculaInicial(fechaLarga(fecha))}
                </p>
                <p className="text-[11.5px] font-semibold" style={{ color: GUINDA }}>{cuandoEs(dias)}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
                    style={{ background: 'var(--color-crema-100)', color: GUINDA }}>
                <Users size={12} /> {lista.length} {lista.length === 1 ? 'examen' : 'exámenes'}
              </span>
            </div>

            <div className="divide-y" style={{ borderColor: '#f0eae2' }}>
              {lista.map((ex) => (
                <div key={ex.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="w-[52px] shrink-0 text-[13px] font-bold" style={{ color: GUINDA }}>
                    {ex.hora}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/gestor/alumnos/${ex.estudianteId}`}
                          className="block truncate text-[13.5px] font-semibold text-stone-900 hover:underline">
                      {ex.alumno}
                    </Link>
                    <p className="truncate text-[12px] text-stone-500">
                      M{ex.modulo.numero} — {ex.modulo.nombre}
                    </p>
                    {ex.sede && (
                      <p className="mt-0.5 flex items-center gap-1 truncate text-[11.5px] text-stone-400">
                        <MapPin size={11} className="shrink-0" /> {ex.sede}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full border px-2 py-0.5 text-[10.5px] font-bold"
                        style={ex.pagado
                          ? { color: '#166534', background: '#f0fdf4', borderColor: '#bbf7d0' }
                          : { color: '#92400e', background: '#fff8ec', borderColor: '#f6dfae' }}>
                    {ex.pagado ? 'Pagado' : 'Falta pago'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
