/**
 * Proyecciones — series históricas mensuales con proyección por regresión
 * lineal (3 meses) y ritmo estimado de egreso.
 */

import { useEffect, useState } from 'react';
import { Loader2, Info } from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { api } from '../../lib/api';
import { DireccionLayout, TarjetaKPI, SeccionCard } from './DireccionLayout';

const GUINDA = '#6B1530';

interface Serie {
  historia: Array<{ mes: string; total: number }>;
  proyeccion: Array<{ mes: string; total: number }>;
}

interface Proyecciones {
  registrosAlumnos: Serie;
  inscripcionesExamen: Serie;
  modulosAprobados: Serie;
  ritmoEgreso: {
    alumnosActivos: number;
    modulosAprobadosPorMes: number;
    avancePromedioModulos: number;
    mesesParaEgresoPromedio: number | null;
  };
  nota: string;
}

/** Une historia y proyección en un dataset para graficar con dos trazos. */
function combinar(serie: Serie) {
  const historia = serie.historia.map((p) => ({ mes: p.mes, real: p.total, proyectado: null as number | null }));
  // Ancla la proyección al último punto real para que la línea conecte.
  const ultimo = serie.historia[serie.historia.length - 1];
  const proyeccion = [
    ...(ultimo ? [{ mes: ultimo.mes, real: ultimo.total, proyectado: ultimo.total }] : []),
    ...serie.proyeccion.map((p) => ({ mes: p.mes, real: null as number | null, proyectado: p.total })),
  ];
  const mapa = new Map<string, { mes: string; real: number | null; proyectado: number | null }>();
  for (const p of [...historia, ...proyeccion]) {
    const prev = mapa.get(p.mes);
    mapa.set(p.mes, { mes: p.mes, real: p.real ?? prev?.real ?? null, proyectado: p.proyectado ?? prev?.proyectado ?? null });
  }
  return [...mapa.values()];
}

function GraficaProyeccion({ titulo, sub, serie }: { titulo: string; sub: string; serie: Serie }) {
  const data = combinar(serie);
  return (
    <SeccionCard titulo={titulo} sub={sub}>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data}>
          <defs>
            <linearGradient id={`grad-${titulo}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={GUINDA} stopOpacity={0.3} />
              <stop offset="100%" stopColor={GUINDA} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
          <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Area
            type="monotone" dataKey="real" name="Histórico"
            stroke={GUINDA} strokeWidth={2} fill={`url(#grad-${titulo})`} connectNulls={false}
          />
          <Line
            type="monotone" dataKey="proyectado" name="Proyección"
            stroke="#b45309" strokeWidth={2} strokeDasharray="6 4" dot={{ r: 3 }} connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </SeccionCard>
  );
}

export default function DireccionProyecciones() {
  const [data, setData] = useState<Proyecciones | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Proyecciones>('/direccion/proyecciones')
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, []);

  if (error) {
    return (
      <DireccionLayout>
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">{error}</div>
      </DireccionLayout>
    );
  }
  if (!data) {
    return (
      <DireccionLayout>
        <div className="flex items-center justify-center py-24 text-stone-400"><Loader2 className="animate-spin" size={22} /></div>
      </DireccionLayout>
    );
  }

  return (
    <DireccionLayout>
      <div className="mb-5">
        <h1 className="font-bold" style={{ fontSize: 22, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Proyecciones
        </h1>
        <p className="text-[13px]" style={{ color: '#78716c' }}>
          Tendencias históricas (12 meses) con proyección estadística a 3 meses
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <TarjetaKPI etiqueta="Alumnos activos" valor={data.ritmoEgreso.alumnosActivos.toLocaleString('es-MX')} />
        <TarjetaKPI etiqueta="Módulos aprobados / mes" valor={data.ritmoEgreso.modulosAprobadosPorMes} sub="promedio últimos 6 meses" acento={GUINDA} />
        <TarjetaKPI etiqueta="Avance promedio" valor={`${data.ritmoEgreso.avancePromedioModulos} / 21`} sub="módulos por alumno con avance" />
        <TarjetaKPI
          etiqueta="Egreso estimado"
          valor={data.ritmoEgreso.mesesParaEgresoPromedio !== null ? `~${data.ritmoEgreso.mesesParaEgresoPromedio} meses` : '—'}
          sub="al ritmo actual del programa"
          acento="#166534"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <GraficaProyeccion
          titulo="Nuevos alumnos"
          sub="Registros mensuales + proyección"
          serie={data.registrosAlumnos}
        />
        <GraficaProyeccion
          titulo="Inscripciones a examen"
          sub="Inscripciones DGB mensuales + proyección"
          serie={data.inscripcionesExamen}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <GraficaProyeccion
          titulo="Módulos aprobados"
          sub="Exámenes aprobados por mes + proyección"
          serie={data.modulosAprobados}
        />
        <div className="bg-white border border-stone-200 rounded-lg p-5 flex gap-3">
          <Info size={16} style={{ color: '#78716c', flexShrink: 0, marginTop: 2 }} />
          <div className="text-[12px] leading-relaxed" style={{ color: '#57534e' }}>
            <div className="font-semibold mb-1" style={{ color: '#2a2a2a' }}>Cómo leer estas proyecciones</div>
            {data.nota} La línea punteada extiende la tendencia de los últimos 6 meses;
            eventos como la apertura de una convocatoria o campañas de difusión pueden
            cambiarla significativamente. Úsala para dimensionar capacidad (gestores,
            sedes, revisión de documentos), no como compromiso de resultados.
          </div>
        </div>
      </div>
    </DireccionLayout>
  );
}
