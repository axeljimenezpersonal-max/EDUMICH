/**
 * Salud del sistema — "golden signals" del API (latencia, tráfico, errores),
 * base de datos, correo y tareas programadas.
 */

import { useEffect, useState } from 'react';
import { Loader2, RefreshCw, Database, Mail, Clock, CheckCircle, XCircle } from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { api } from '../../lib/api';
import { useEsTelefono } from '../../lib/useMedia';
import { DireccionLayout, TarjetaKPI, SeccionCard } from './DireccionLayout';
import { IntegridadDatos } from './IntegridadDatos';

const GUINDA = '#6B1530';

interface ResumenVentana {
  ventanaMinutos: number;
  totalRequests: number;
  requestsPorMinuto: number;
  errores4xx: number;
  errores5xx: number;
  tasaError: number;
  latenciaPromedioMs: number;
  latenciaP50Ms: number;
  latenciaP95Ms: number;
  latenciaMaxMs: number;
  porGrupo: Array<{ grupo: string; total: number; errores: number; promedioMs: number }>;
}

interface Salud {
  uptime: { desdeMs: number; segundos: number };
  api: {
    ultimaHora: ResumenVentana;
    ultimas24h: ResumenVentana;
    seriePorMinuto: Array<{ minuto: string; requests: number; errores: number; promedioMs: number }>;
  };
  baseDatos: { ok: boolean; pingMs: number };
  correo24h: { enviados: number; fallidos: number; pendientes: number };
  tareasProgramadas: Array<{ nombre: string; horario: string }>;
}

function uptimeLegible(seg: number): string {
  const d = Math.floor(seg / 86400);
  const h = Math.floor((seg % 86400) / 3600);
  const m = Math.floor((seg % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function DireccionSalud() {
  const esTelefono = useEsTelefono();
  const [data, setData] = useState<Salud | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actualizando, setActualizando] = useState(false);

  function cargar() {
    setActualizando(true);
    api.get<Salud>('/direccion/salud')
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError((e as Error).message))
      .finally(() => setActualizando(false));
  }

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 30_000);
    return () => clearInterval(t);
  }, []);

  if (error && !data) {
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

  const h1 = data.api.ultimaHora;
  const serie = data.api.seriePorMinuto.map((p) => ({
    ...p,
    hora: new Date(p.minuto).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
  }));

  return (
    <DireccionLayout>
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="font-bold" style={{ fontSize: 22, fontFamily: "'Poppins', sans-serif" }}>
            Salud del sistema
          </h1>
          <p className="text-[13px]" style={{ color: '#6b635e' }}>
            Integridad de los datos y señales del API · se actualiza cada 30 s
          </p>
        </div>
        <button
          onClick={cargar}
          className="flex items-center gap-2 text-[12px] font-semibold px-3 py-2 rounded-lg border border-stone-200 bg-white hover:bg-stone-50"
          style={{ color: '#443e39' }}
        >
          <RefreshCw size={13} className={actualizando ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>

      {/* La integridad de los datos va antes que la latencia: un servidor
          rápido sirviendo números falsos es peor que uno lento. */}
      <div className="mb-6">
        <IntegridadDatos />
      </div>

      {/* Golden signals (última hora) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <TarjetaKPI
          etiqueta="Latencia p95 (1 h)"
          valor={`${h1.latenciaP95Ms} ms`}
          sub={`promedio ${h1.latenciaPromedioMs} ms · máx ${h1.latenciaMaxMs} ms`}
          acento={h1.latenciaP95Ms > 1000 ? '#dc2626' : h1.latenciaP95Ms > 500 ? '#d97706' : '#166534'}
        />
        <TarjetaKPI
          etiqueta="Tráfico (1 h)"
          valor={h1.totalRequests.toLocaleString('es-MX')}
          sub={`${h1.requestsPorMinuto} req/min`}
        />
        <TarjetaKPI
          etiqueta="Tasa de error 5xx (1 h)"
          valor={`${h1.tasaError}%`}
          sub={`${h1.errores5xx} errores · ${h1.errores4xx} rechazos 4xx`}
          acento={h1.tasaError > 1 ? '#dc2626' : '#166534'}
        />
        <TarjetaKPI
          etiqueta="Uptime del proceso"
          valor={uptimeLegible(data.uptime.segundos)}
          sub={`desde ${new Date(data.uptime.desdeMs).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}`}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <SeccionCard titulo="Tráfico y latencia por minuto" sub="Última hora — barras: requests · línea: latencia promedio (ms)">
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={serie}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f7f2ed" />
                <XAxis dataKey="hora" tick={{ fontSize: 10 }} minTickGap={30} />
                {/* En teléfono los dos ejes se comen el área de trazado: se
                    oculta el secundario y la latencia se lee en el tooltip. */}
                <YAxis yAxisId="req" allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
                <YAxis yAxisId="ms" orientation="right" tick={{ fontSize: 11 }} width={40} hide={esTelefono} />
                <Tooltip />
                <Bar yAxisId="req" dataKey="requests" fill="#d6cfc0" radius={[2, 2, 0, 0]} name="Requests" />
                <Line yAxisId="ms" type="monotone" dataKey="promedioMs" stroke={GUINDA} strokeWidth={2} dot={false} name="Latencia (ms)" />
              </ComposedChart>
            </ResponsiveContainer>
          </SeccionCard>
        </div>

        <div className="space-y-4">
          {/* Base de datos */}
          <div className="bg-white border border-stone-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#f8f4ec', color: GUINDA }}>
                  <Database size={14} />
                </div>
                <div>
                  <div className="text-[13px] font-semibold">Base de datos</div>
                  <div className="text-[11px]" style={{ color: '#6b635e' }}>ping {data.baseDatos.pingMs} ms</div>
                </div>
              </div>
              {data.baseDatos.ok
                ? <CheckCircle size={18} style={{ color: '#166534' }} />
                : <XCircle size={18} style={{ color: '#dc2626' }} />}
            </div>
          </div>

          {/* Correo */}
          <div className="bg-white border border-stone-200 rounded-lg p-4">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#f8f4ec', color: GUINDA }}>
                <Mail size={14} />
              </div>
              <div className="text-[13px] font-semibold">Correo (24 h)</div>
            </div>
            <div className="text-[12px] space-y-1.5">
              <div className="flex justify-between"><span style={{ color: '#6b635e' }}>Enviados</span><span className="font-semibold" style={{ color: '#166534' }}>{data.correo24h.enviados}</span></div>
              <div className="flex justify-between"><span style={{ color: '#6b635e' }}>Fallidos</span><span className="font-semibold" style={{ color: data.correo24h.fallidos > 0 ? '#dc2626' : '#166534' }}>{data.correo24h.fallidos}</span></div>
              <div className="flex justify-between"><span style={{ color: '#6b635e' }}>Pendientes</span><span className="font-semibold">{data.correo24h.pendientes}</span></div>
            </div>
          </div>

          {/* Cron */}
          <div className="bg-white border border-stone-200 rounded-lg p-4">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#f8f4ec', color: GUINDA }}>
                <Clock size={14} />
              </div>
              <div className="text-[13px] font-semibold">Tareas programadas</div>
            </div>
            <div className="text-[11px] space-y-1.5">
              {data.tareasProgramadas.map((t) => (
                <div key={t.nombre}>
                  <div style={{ color: '#443e39', fontWeight: 500 }}>{t.nombre}</div>
                  <div style={{ color: '#a89a8e' }}>{t.horario}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <SeccionCard titulo="Tráfico por área del API" sub="Últimas 24 horas, agrupado por prefijo de ruta">
        <div className="overflow-x-auto -mx-1 px-1 pb-1">
        <table className="w-full text-[12px] min-w-[480px]">
          <thead>
            <tr className="text-left" style={{ color: '#6b635e' }}>
              <th className="py-2 pr-3 font-semibold">Área</th>
              <th className="py-2 pr-3 font-semibold text-right">Requests</th>
              <th className="py-2 pr-3 font-semibold text-right">Errores</th>
              <th className="py-2 font-semibold text-right">Latencia promedio</th>
            </tr>
          </thead>
          <tbody>
            {data.api.ultimas24h.porGrupo.map((g) => (
              <tr key={g.grupo} className="border-t border-stone-100">
                <td className="py-2 pr-3 font-medium">/api/{g.grupo}</td>
                <td className="py-2 pr-3 text-right">{g.total.toLocaleString('es-MX')}</td>
                <td className="py-2 pr-3 text-right" style={{ color: g.errores > 0 ? '#d97706' : '#166534' }}>{g.errores}</td>
                <td className="py-2 text-right font-semibold">{g.promedioMs} ms</td>
              </tr>
            ))}
            {data.api.ultimas24h.porGrupo.length === 0 && (
              <tr><td colSpan={4} className="py-6 text-center" style={{ color: '#a89a8e' }}>
                Sin tráfico registrado aún (las métricas se acumulan desde el último reinicio del servidor)
              </td></tr>
            )}
          </tbody>
        </table>
        </div>
      </SeccionCard>
    </DireccionLayout>
  );
}
