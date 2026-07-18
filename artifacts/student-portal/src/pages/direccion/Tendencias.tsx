/**
 * Tendencias — la historia de los indicadores, no solo su foto de hoy.
 *
 * Se alimenta de las instantáneas diarias (services/metricasDiarias.ts).
 *
 * Distingue dos familias, y la distinción no es un tecnicismo: las métricas
 * `acumulada` se reconstruyeron desde el primer registro del sistema, así que
 * su historia es real. Las de tipo `estado` empiezan el día que se instaló la
 * medición, porque el pasado de un estado no se puede inventar. Se avisa en
 * pantalla para que nadie lea un tramo corto como un desplome.
 */

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Info } from 'lucide-react';
import { api } from '../../lib/api';
import { SeccionCard } from './DireccionLayout';

const GUINDA = '#6B1530';
const DORADO = '#b89968';

interface Punto { dia: string; clave: string; valor: number }
interface MetricaCat { clave: string; titulo: string; familia: 'acumulada' | 'estado' }
interface Respuesta { dias: number; metricas: MetricaCat[]; puntos: Punto[] }

export function Tendencias() {
  const [d, setD] = useState<Respuesta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [clave, setClave] = useState('alumnos_total');
  const [dias, setDias] = useState(90);

  useEffect(() => {
    setCargando(true);
    api.get<Respuesta>(`/direccion/tendencias?dias=${dias}`)
      .then(setD)
      .catch(() => setD(null))
      .finally(() => setCargando(false));
  }, [dias]);

  const serie = useMemo(
    () => (d?.puntos ?? []).filter((p) => p.clave === clave),
    [d, clave]
  );
  const meta = d?.metricas.find((m) => m.clave === clave);
  const max = Math.max(...serie.map((p) => p.valor), 1);
  const primero = serie[0]?.valor ?? 0;
  const ultimo = serie[serie.length - 1]?.valor ?? 0;
  const delta = ultimo - primero;

  // Polilínea normalizada al alto del recuadro.
  const ALTO = 120;
  const puntos = serie
    .map((p, i) => {
      const x = serie.length > 1 ? (i / (serie.length - 1)) * 100 : 0;
      const y = ALTO - (p.valor / max) * (ALTO - 8);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <SeccionCard
      titulo="Tendencia"
      sub="Cómo se movió cada indicador, día a día"
    >
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          className="px-3 py-1.5 rounded-md text-[13px] border bg-white"
          style={{ borderColor: '#ddd0c5', color: '#443e39' }}
        >
          {(d?.metricas ?? []).map((m) => (
            <option key={m.clave} value={m.clave}>{m.titulo}</option>
          ))}
        </select>
        <div className="flex gap-1.5">
          {[30, 90, 365].map((n) => (
            <button
              key={n}
              onClick={() => setDias(n)}
              className="px-2.5 py-1.5 rounded-md text-[12px] font-semibold border"
              style={{
                background: dias === n ? GUINDA : '#fff',
                color: dias === n ? '#fff' : '#443e39',
                borderColor: dias === n ? GUINDA : '#ddd0c5',
              }}
            >
              {n === 365 ? '1 año' : `${n} d`}
            </button>
          ))}
        </div>
      </div>

      {cargando ? (
        <div className="flex items-center gap-2 text-sm py-8" style={{ color: '#6b635e' }}>
          <Loader2 size={15} className="animate-spin" /> Cargando…
        </div>
      ) : serie.length === 0 ? (
        <p className="text-[13px] py-6" style={{ color: '#6b635e' }}>
          Todavía no hay instantáneas de este indicador. La primera se guarda
          esta noche.
        </p>
      ) : (
        <>
          <div className="flex items-baseline gap-3 mb-2">
            <span className="text-[26px] font-bold tabular-nums" style={{ color: GUINDA }}>
              {ultimo.toLocaleString('es-MX')}
            </span>
            {serie.length > 1 && (
              <span
                className="text-[13px] font-semibold tabular-nums"
                style={{ color: delta > 0 ? '#2d7d46' : delta < 0 ? '#b91c1c' : '#6b635e' }}
              >
                {delta > 0 ? '+' : ''}{delta.toLocaleString('es-MX')} en el período
              </span>
            )}
          </div>

          <svg viewBox={`0 0 100 ${ALTO}`} preserveAspectRatio="none"
               style={{ width: '100%', height: 140, display: 'block' }}
               role="img" aria-label={`Tendencia de ${meta?.titulo ?? clave}`}>
            <polyline
              points={`0,${ALTO} ${puntos} 100,${ALTO}`}
              fill={DORADO} fillOpacity="0.18" stroke="none"
            />
            <polyline
              points={puntos} fill="none" stroke={GUINDA}
              strokeWidth="1.4" vectorEffect="non-scaling-stroke"
              strokeLinejoin="round" strokeLinecap="round"
            />
          </svg>
          <div className="flex justify-between text-[10.5px] mt-1" style={{ color: '#a89a8e' }}>
            <span>{serie[0]?.dia}</span>
            <span>{serie[serie.length - 1]?.dia}</span>
          </div>

          {meta?.familia === 'estado' && (
            <div className="flex gap-2 mt-3 text-[11.5px]" style={{ color: '#6b635e', lineHeight: 1.5 }}>
              <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                Este indicador es una foto del momento, así que su historia
                empieza el día que se instaló la medición: un tramo corto no
                significa que antes valiera cero.
              </span>
            </div>
          )}
        </>
      )}
    </SeccionCard>
  );
}
