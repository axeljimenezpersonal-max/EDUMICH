/**
 * Académico — tasas de aprobación por módulo, distribución de avance
 * hacia los 21 módulos y alumnos en riesgo (agregado).
 */

import { useEffect, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from 'recharts';
import { api } from '../../lib/api';
import { DireccionLayout, TarjetaKPI, SeccionCard } from './DireccionLayout';

const GUINDA = '#6B1530';

interface Academico {
  resumen: { promedioGlobal: number; examenesTotales: number; tasaAprobacion: number };
  porModulo: Array<{
    numero: number; nombre: string; nivel: number | null;
    presentados: number; aprobados: number; promedio: number; tasaAprobacion: number;
  }>;
  distribucionAvance: Array<{ rango: string; alumnos: number }>;
  riesgo: { total: number; criticos: number; porMunicipio: Array<{ nombre: string; total: number }> };
}

export default function DireccionAcademico() {
  const [data, setData] = useState<Academico | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Academico>('/direccion/academico')
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
          Indicadores académicos
        </h1>
        <p className="text-[13px]" style={{ color: '#78716c' }}>
          Desempeño en exámenes DGB y avance del plan modular (21 módulos)
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <TarjetaKPI etiqueta="Promedio global" valor={data.resumen.promedioGlobal || '—'} sub="calificación promedio DGB" acento={GUINDA} />
        <TarjetaKPI etiqueta="Exámenes capturados" valor={data.resumen.examenesTotales.toLocaleString('es-MX')} sub="histórico" />
        <TarjetaKPI etiqueta="Tasa de aprobación" valor={`${data.resumen.tasaAprobacion}%`} sub="de exámenes presentados" acento="#166534" />
        <TarjetaKPI etiqueta="Alumnos en riesgo" valor={data.riesgo.total} sub={`${data.riesgo.criticos} críticos (180+ días sin actividad)`} acento="#b45309" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <SeccionCard titulo="Distribución de avance" sub="Cuántos alumnos activos llevan N módulos aprobados">
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={data.distribucionAvance}>
              <XAxis dataKey="rango" tick={{ fontSize: 10 }} interval={0} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
              <Tooltip />
              <Bar dataKey="alumnos" radius={[4, 4, 0, 0]}>
                {data.distribucionAvance.map((d, i) => (
                  <Cell key={d.rango} fill={i === data.distribucionAvance.length - 1 ? '#166534' : GUINDA} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </SeccionCard>

        <SeccionCard titulo="Riesgo por municipio" sub="Alumnos activos con 90+ días sin actividad">
          {data.riesgo.porMunicipio.length === 0 ? (
            <div className="text-[13px] py-8 text-center" style={{ color: '#a8a29e' }}>Sin alumnos en riesgo 🎉</div>
          ) : (
            <div className="space-y-2.5 pt-1">
              {data.riesgo.porMunicipio.map((m) => {
                const max = data.riesgo.porMunicipio[0]?.total ?? 1;
                return (
                  <div key={m.nombre} className="flex items-center gap-3">
                    <AlertTriangle size={12} style={{ color: '#b45309', flexShrink: 0 }} />
                    <div className="text-[12px] w-32 truncate" style={{ color: '#44403c' }}>{m.nombre}</div>
                    <div className="flex-1 h-[8px] rounded-full" style={{ background: '#f5f5f4' }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.max(Math.round((m.total / max) * 100), 3)}%`, background: '#d97706' }}
                      />
                    </div>
                    <div className="text-[12px] font-semibold w-10 text-right">{m.total}</div>
                  </div>
                );
              })}
            </div>
          )}
        </SeccionCard>
      </div>

      <SeccionCard titulo="Desempeño por módulo" sub="Exámenes DGB presentados, aprobación y promedio por módulo del plan">
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left" style={{ color: '#78716c' }}>
                <th className="py-2 pr-3 font-semibold">#</th>
                <th className="py-2 pr-3 font-semibold">Módulo</th>
                <th className="py-2 pr-3 font-semibold text-center">Nivel</th>
                <th className="py-2 pr-3 font-semibold text-right">Presentados</th>
                <th className="py-2 pr-3 font-semibold text-right">Aprobados</th>
                <th className="py-2 pr-3 font-semibold text-right">Promedio</th>
                <th className="py-2 font-semibold" style={{ width: 160 }}>Tasa de aprobación</th>
              </tr>
            </thead>
            <tbody>
              {data.porModulo.map((m) => (
                <tr key={m.numero} className="border-t border-stone-100">
                  <td className="py-2 pr-3 font-semibold" style={{ color: GUINDA }}>{m.numero}</td>
                  <td className="py-2 pr-3">{m.nombre}</td>
                  <td className="py-2 pr-3 text-center">{m.nivel ?? '—'}</td>
                  <td className="py-2 pr-3 text-right">{m.presentados}</td>
                  <td className="py-2 pr-3 text-right">{m.aprobados}</td>
                  <td className="py-2 pr-3 text-right">{m.promedio || '—'}</td>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-[6px] rounded-full" style={{ background: '#f5f5f4' }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${m.tasaAprobacion}%`,
                            background: m.tasaAprobacion >= 70 ? '#166534' : m.tasaAprobacion >= 40 ? '#d97706' : '#dc2626',
                          }}
                        />
                      </div>
                      <span className="font-semibold" style={{ width: 34, textAlign: 'right' }}>
                        {m.presentados > 0 ? `${m.tasaAprobacion}%` : '—'}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SeccionCard>
    </DireccionLayout>
  );
}
