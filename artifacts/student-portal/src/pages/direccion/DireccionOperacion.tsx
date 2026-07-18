/**
 * Operación — backlog, tiempos de respuesta del equipo y productividad
 * de gestores (agregado por gestor: son personal del programa).
 */

import { useEffect, useState } from 'react';
import { Loader2, FileText, CreditCard, Inbox, ClipboardList, Mail } from 'lucide-react';
import { api } from '../../lib/api';
import { DireccionLayout, TarjetaKPI, SeccionCard } from './DireccionLayout';

const GUINDA = '#6B1530';

interface Operacion {
  backlog: {
    documentosPorRevisar: number;
    pagosPorVerificar: number;
    solicitudesPendientes: number;
    calificacionesPorCapturar: number;
  };
  tiemposRespuestaHoras: {
    revisionDocumentos: number;
    verificacionPagos: number;
    procesamientoSolicitudes: number;
  };
  gestores: Array<{
    nombre: string; municipio: string | null; estado: string;
    alumnos: number; conMatricula: number;
  }>;
  correos7d: { enviados: number; fallidos: number; pendientes: number };
}

function horasLegibles(h: number): string {
  if (!h) return '—';
  if (h < 24) return `${h} h`;
  return `${Math.round((h / 24) * 10) / 10} días`;
}

export default function DireccionOperacion() {
  const [data, setData] = useState<Operacion | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Operacion>('/direccion/operacion')
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

  const backlogItems = [
    { icon: FileText, label: 'Documentos por revisar', valor: data.backlog.documentosPorRevisar },
    { icon: CreditCard, label: 'Pagos por verificar', valor: data.backlog.pagosPorVerificar },
    { icon: Inbox, label: 'Solicitudes pendientes', valor: data.backlog.solicitudesPendientes },
    { icon: ClipboardList, label: 'Calificaciones por capturar', valor: data.backlog.calificacionesPorCapturar },
  ];

  const totalCorreos = data.correos7d.enviados + data.correos7d.fallidos + data.correos7d.pendientes;

  return (
    <DireccionLayout>
      <div className="mb-5">
        <h1 className="font-bold" style={{ fontSize: 22, fontFamily: "'Poppins', sans-serif" }}>
          Operación del programa
        </h1>
        <p className="text-[13px]" style={{ color: '#6b635e' }}>
          Backlog del equipo, tiempos de respuesta y productividad de gestores
        </p>
      </div>

      {/* Backlog */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {backlogItems.map(({ icon: Icon, label, valor }) => (
          <div key={label} className="bg-white border border-stone-200 rounded-lg p-4 flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: valor > 0 ? '#fdf2f4' : '#f0fdf4', color: valor > 0 ? GUINDA : '#166534' }}
            >
              <Icon size={16} />
            </div>
            <div>
              <div className="font-bold" style={{ fontSize: 20, fontFamily: "'Poppins', sans-serif" }}>{valor}</div>
              <div className="text-[11px]" style={{ color: '#6b635e' }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <TarjetaKPI
          etiqueta="Revisión de documentos"
          valor={horasLegibles(data.tiemposRespuestaHoras.revisionDocumentos)}
          sub="tiempo promedio (90 días)"
        />
        <TarjetaKPI
          etiqueta="Verificación de pagos"
          valor={horasLegibles(data.tiemposRespuestaHoras.verificacionPagos)}
          sub="tiempo promedio (90 días)"
        />
        <TarjetaKPI
          etiqueta="Procesamiento de solicitudes"
          valor={horasLegibles(data.tiemposRespuestaHoras.procesamientoSolicitudes)}
          sub="tiempo promedio (90 días)"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SeccionCard titulo="Productividad de gestores" sub="Top 10 por alumnos activos asignados">
            <div className="overflow-x-auto -mx-1 px-1 pb-1">
            <table className="w-full text-[12px] min-w-[560px]">
              <thead>
                <tr className="text-left" style={{ color: '#6b635e' }}>
                  <th className="py-2 pr-3 font-semibold">Gestor</th>
                  <th className="py-2 pr-3 font-semibold">Municipio</th>
                  <th className="py-2 pr-3 font-semibold text-center">Estado</th>
                  <th className="py-2 pr-3 font-semibold text-right">Alumnos</th>
                  <th className="py-2 font-semibold text-right">Con matrícula</th>
                </tr>
              </thead>
              <tbody>
                {data.gestores.map((g) => (
                  <tr key={g.nombre} className="border-t border-stone-100">
                    <td className="py-2 pr-3 font-medium">{g.nombre}</td>
                    <td className="py-2 pr-3" style={{ color: '#6b635e' }}>{g.municipio ?? '—'}</td>
                    <td className="py-2 pr-3 text-center">
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase"
                        style={g.estado === 'activo'
                          ? { background: '#f0fdf4', color: '#166534' }
                          : { background: '#f7f2ed', color: '#6b635e' }}
                      >
                        {g.estado}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right font-semibold">{g.alumnos}</td>
                    <td className="py-2 text-right">{g.conMatricula}</td>
                  </tr>
                ))}
                {data.gestores.length === 0 && (
                  <tr><td colSpan={5} className="py-6 text-center" style={{ color: '#a89a8e' }}>Sin gestores registrados</td></tr>
                )}
              </tbody>
            </table>
            </div>
          </SeccionCard>
        </div>

        <SeccionCard titulo="Correo institucional" sub="Últimos 7 días">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#f8f4ec', color: GUINDA }}>
              <Mail size={16} />
            </div>
            <div>
              <div className="font-bold" style={{ fontSize: 20, fontFamily: "'Poppins', sans-serif" }}>{totalCorreos}</div>
              <div className="text-[11px]" style={{ color: '#6b635e' }}>correos generados</div>
            </div>
          </div>
          <div className="space-y-2 text-[12px]">
            <div className="flex justify-between border-t border-stone-100 pt-2">
              <span style={{ color: '#443e39' }}>Enviados</span>
              <span className="font-semibold" style={{ color: '#166534' }}>{data.correos7d.enviados}</span>
            </div>
            <div className="flex justify-between border-t border-stone-100 pt-2">
              <span style={{ color: '#443e39' }}>Fallidos</span>
              <span className="font-semibold" style={{ color: data.correos7d.fallidos > 0 ? '#dc2626' : '#166534' }}>
                {data.correos7d.fallidos}
              </span>
            </div>
            <div className="flex justify-between border-t border-stone-100 pt-2">
              <span style={{ color: '#443e39' }}>Pendientes</span>
              <span className="font-semibold">{data.correos7d.pendientes}</span>
            </div>
          </div>
        </SeccionCard>
      </div>
    </DireccionLayout>
  );
}
