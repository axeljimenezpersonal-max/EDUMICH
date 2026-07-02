/**
 * Panorama — dashboard principal de dirección.
 * KPIs, funnel de inscripción (modelo "leaky bucket"), inscripciones por
 * etapa DGB, tendencia mensual y distribución por municipio.
 */

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  AreaChart, Area, CartesianGrid,
} from 'recharts';
import { api } from '../../lib/api';
import { DireccionLayout, TarjetaKPI, SeccionCard } from './DireccionLayout';

const GUINDA = '#6B1530';

interface Panorama {
  director: { nombre: string; puesto: string | null };
  kpis: {
    alumnosActivos: { total: number; nuevosSemana: number };
    gestoresActivos: { total: number; municipiosCubiertos: number };
    accesosHoy: number;
    egresados: number;
  };
  funnel: Array<{ etapa: string; total: number }>;
  inscripcionesPorEtapa: Array<{ clave: string; inscritos: number; activa: boolean; futura: boolean }>;
  tendenciaRegistros: Array<{ mes: string; total: number }>;
  municipiosTop: Array<{ nombre: string; total: number }>;
}

export default function DireccionPanorama() {
  const [data, setData] = useState<Panorama | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Panorama>('/direccion/panorama')
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
        <div className="flex items-center justify-center py-24 text-stone-400">
          <Loader2 className="animate-spin" size={22} />
        </div>
      </DireccionLayout>
    );
  }

  const maxFunnel = Math.max(1, ...data.funnel.map((f) => f.total));

  return (
    <DireccionLayout>
      <div className="mb-5">
        <h1 className="font-bold" style={{ fontSize: 22, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Panorama del programa
        </h1>
        <p className="text-[13px]" style={{ color: '#78716c' }}>
          Indicadores generales de Prepa Abierta Michoacán · datos agregados en tiempo real
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <TarjetaKPI
          etiqueta="Alumnos activos"
          valor={data.kpis.alumnosActivos.total.toLocaleString('es-MX')}
          sub={`+${data.kpis.alumnosActivos.nuevosSemana} esta semana`}
          acento={GUINDA}
        />
        <TarjetaKPI
          etiqueta="Gestores activos"
          valor={data.kpis.gestoresActivos.total}
          sub={`${data.kpis.gestoresActivos.municipiosCubiertos} municipios cubiertos`}
        />
        <TarjetaKPI etiqueta="Accesos hoy" valor={data.kpis.accesosHoy} sub="usuarios con login hoy" />
        <TarjetaKPI etiqueta="Egresados" valor={data.kpis.egresados} sub="21 módulos aprobados" acento="#166534" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Funnel */}
        <SeccionCard
          titulo="Funnel de inscripción"
          sub="Dónde se queda la gente: de la solicitud al egreso"
        >
          <div className="space-y-2.5">
            {data.funnel.map((f, i) => {
              const pct = Math.round((f.total / maxFunnel) * 100);
              const prev = i > 0 ? data.funnel[i - 1].total : null;
              const conversion = prev && prev > 0 ? Math.round((f.total / prev) * 100) : null;
              return (
                <div key={f.etapa}>
                  <div className="flex justify-between text-[12px] mb-1">
                    <span style={{ color: '#44403c' }}>{f.etapa}</span>
                    <span className="font-semibold">
                      {f.total.toLocaleString('es-MX')}
                      {conversion !== null && (
                        <span style={{ color: '#a8a29e', fontWeight: 400 }}> · {conversion}% del paso anterior</span>
                      )}
                    </span>
                  </div>
                  <div className="h-[10px] rounded-full" style={{ background: '#f5f5f4' }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.max(pct, 2)}%`, background: GUINDA, opacity: 1 - i * 0.1 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </SeccionCard>

        {/* Inscripciones por etapa */}
        <SeccionCard
          titulo="Inscripciones a examen por etapa DGB"
          sub={`Etapas del año ${new Date().getFullYear()}`}
        >
          {data.inscripcionesPorEtapa.length === 0 ? (
            <div className="text-[13px] py-8 text-center" style={{ color: '#a8a29e' }}>Sin etapas registradas este año</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.inscripcionesPorEtapa}>
                <XAxis dataKey="clave" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
                <Tooltip />
                <Bar dataKey="inscritos" radius={[4, 4, 0, 0]}>
                  {data.inscripcionesPorEtapa.map((e) => (
                    <Cell key={e.clave} fill={e.activa ? GUINDA : e.futura ? '#d6d3d1' : '#a8848f'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </SeccionCard>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Tendencia */}
        <SeccionCard titulo="Nuevos alumnos por mes" sub="Últimos 12 meses">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data.tendenciaRegistros}>
              <defs>
                <linearGradient id="gradGuinda" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={GUINDA} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={GUINDA} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
              <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
              <Tooltip />
              <Area type="monotone" dataKey="total" stroke={GUINDA} strokeWidth={2} fill="url(#gradGuinda)" name="Registros" />
            </AreaChart>
          </ResponsiveContainer>
        </SeccionCard>

        {/* Municipios */}
        <SeccionCard titulo="Alumnos por municipio" sub="Top 8 municipios con más alumnos">
          <div className="space-y-2">
            {data.municipiosTop.map((m) => {
              const max = data.municipiosTop[0]?.total ?? 1;
              return (
                <div key={m.nombre} className="flex items-center gap-3">
                  <div className="text-[12px] w-32 truncate" style={{ color: '#44403c' }}>{m.nombre}</div>
                  <div className="flex-1 h-[8px] rounded-full" style={{ background: '#f5f5f4' }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.max(Math.round((m.total / max) * 100), 3)}%`, background: GUINDA }}
                    />
                  </div>
                  <div className="text-[12px] font-semibold w-10 text-right">{m.total}</div>
                </div>
              );
            })}
            {data.municipiosTop.length === 0 && (
              <div className="text-[13px] py-6 text-center" style={{ color: '#a8a29e' }}>Sin datos</div>
            )}
          </div>
        </SeccionCard>
      </div>
    </DireccionLayout>
  );
}
