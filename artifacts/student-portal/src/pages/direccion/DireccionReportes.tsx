/**
 * Reportes — acceso de dirección a los mismos reportes institucionales
 * del sistema (vista de solo consulta: preview, descarga e historial;
 * la programación de reportes recurrentes es exclusiva del admin).
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Users, FileText, DollarSign, GraduationCap, UserCheck, Calendar,
  Inbox, TrendingUp, Download, RefreshCw, Loader2,
} from 'lucide-react';
import { DireccionLayout, SeccionCard } from './DireccionLayout';

type ReporteTipo =
  | 'inscripciones' | 'expedientes' | 'financiero' | 'academico'
  | 'productividad_gestores' | 'convocatorias' | 'solicitudes' | 'ejecutivo';

type Formato = 'excel' | 'pdf';

interface KPI { label: string; valor: string | number; unidad?: string }

interface Preview {
  kpis: KPI[];
  columnas: string[];
  preview: (string | number | null)[][];
  totalRegistros: number;
}

interface Historial {
  id: number;
  tipo: string;
  formato: string;
  nombre: string;
  estado: string;
  totalRegistros: number | null;
  generadoEn: string | null;
  createdAt: string;
}

const REPORTES: { tipo: ReporteTipo; label: string; desc: string; icon: React.FC<{ size?: number }> }[] = [
  { tipo: 'ejecutivo',              label: 'Ejecutivo',             desc: 'Dashboard consolidado con todos los KPI institucionales',     icon: TrendingUp },
  { tipo: 'inscripciones',          label: 'Inscripciones',         desc: 'Estado de inscripciones por convocatoria, municipio y gestor', icon: Users },
  { tipo: 'expedientes',            label: 'Expedientes',           desc: 'Revisión de documentos por alumno y estado de aprobación',     icon: FileText },
  { tipo: 'financiero',             label: 'Financiero',            desc: 'Pagos recibidos, verificados y pendientes con montos',         icon: DollarSign },
  { tipo: 'academico',              label: 'Académico',             desc: 'Calificaciones, tasas de aprobación y progreso modular',       icon: GraduationCap },
  { tipo: 'productividad_gestores', label: 'Gestores',              desc: 'Productividad por gestor: alumnos, documentos y matrículas',   icon: UserCheck },
  { tipo: 'convocatorias',          label: 'Convocatorias',         desc: 'Inscritos por etapa, módulo y sede de examen',                 icon: Calendar },
  { tipo: 'solicitudes',            label: 'Solicitudes de Cuenta', desc: 'Flujo de solicitudes públicas por estado y municipio',        icon: Inbox },
];

const GUINDA = '#6B1530';

function fechaCorta(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
}

export default function DireccionReportes() {
  const [selected, setSelected] = useState<ReporteTipo | null>(null);
  const [formato, setFormato] = useState<Formato>('excel');
  const [filtros, setFiltros] = useState({ fechaInicio: '', fechaFin: '' });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingDescarga, setLoadingDescarga] = useState(false);
  const [historial, setHistorial] = useState<Historial[]>([]);
  const [error, setError] = useState<string | null>(null);

  const cargarHistorial = useCallback(() => {
    fetch('/api/direccion/reportes/historial?limit=20', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then(setHistorial)
      .catch(() => {});
  }, []);

  useEffect(() => { cargarHistorial(); }, [cargarHistorial]);

  const cargarPreview = useCallback(async () => {
    if (!selected) return;
    setLoadingPreview(true);
    setPreview(null);
    setError(null);
    try {
      const res = await fetch('/api/direccion/reportes/preview', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: selected, filtros }),
      });
      if (!res.ok) throw new Error('No se pudo generar la vista previa');
      setPreview(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingPreview(false);
    }
  }, [selected, filtros]);

  const descargar = useCallback(async () => {
    if (!selected) return;
    setLoadingDescarga(true);
    setError(null);
    try {
      const res = await fetch('/api/direccion/reportes/generar', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: selected, formato, filtros }),
      });
      if (!res.ok) throw new Error('No se pudo generar el reporte');
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') ?? '';
      const match = /filename="([^"]+)"/.exec(cd);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = match?.[1] ?? `reporte_${selected}.${formato === 'excel' ? 'xlsx' : 'pdf'}`;
      a.click();
      URL.revokeObjectURL(a.href);
      cargarHistorial();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingDescarga(false);
    }
  }, [selected, formato, filtros, cargarHistorial]);

  return (
    <DireccionLayout>
      <div className="mb-5">
        <h1 className="font-bold" style={{ fontSize: 22, fontFamily: "'Poppins', sans-serif" }}>
          Reportes institucionales
        </h1>
        <p className="text-[13px]" style={{ color: '#6b635e' }}>
          Los mismos reportes del sistema, en modo consulta · Excel o PDF
        </p>
      </div>


      {/* Selección de tipo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {REPORTES.map(({ tipo, label, desc, icon: Icon }) => {
          const activo = selected === tipo;
          return (
            <button
              key={tipo}
              onClick={() => { setSelected(tipo); setPreview(null); }}
              className="text-left bg-white rounded-lg p-3.5 border transition-colors"
              style={{
                borderColor: activo ? GUINDA : '#eadfd7',
                boxShadow: activo ? `0 0 0 1px ${GUINDA}` : 'none',
                cursor: 'pointer',
              }}
            >
              <div className="flex items-center gap-2 mb-1.5" style={{ color: activo ? GUINDA : '#57504a' }}>
                <Icon size={15} />
                <span className="text-[13px] font-bold">{label}</span>
              </div>
              <div className="text-[11px] leading-snug" style={{ color: '#a89a8e' }}>{desc}</div>
            </button>
          );
        })}
      </div>

      {selected && (
        <SeccionCard titulo={`Generar: ${REPORTES.find((r) => r.tipo === selected)?.label}`} sub="Filtra por rango de fechas si lo necesitas">
          {/* En móvil los campos ocupan el ancho completo y los dos botones
              comparten la última fila; en pantalla ancha vuelve a ser una barra. */}
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div className="w-full sm:w-auto">
              <label className="text-[11px] font-semibold block mb-1" style={{ color: '#6b635e' }}>Desde</label>
              <input
                type="date" value={filtros.fechaInicio}
                onChange={(e) => setFiltros((f) => ({ ...f, fechaInicio: e.target.value }))}
                className="border border-stone-200 rounded-lg px-3 py-2 text-[13px] w-full"
              />
            </div>
            <div className="w-full sm:w-auto">
              <label className="text-[11px] font-semibold block mb-1" style={{ color: '#6b635e' }}>Hasta</label>
              <input
                type="date" value={filtros.fechaFin}
                onChange={(e) => setFiltros((f) => ({ ...f, fechaFin: e.target.value }))}
                className="border border-stone-200 rounded-lg px-3 py-2 text-[13px] w-full"
              />
            </div>
            <div className="w-full sm:w-auto">
              <label className="text-[11px] font-semibold block mb-1" style={{ color: '#6b635e' }}>Formato</label>
              <select
                value={formato}
                onChange={(e) => setFormato(e.target.value as Formato)}
                className="border border-stone-200 rounded-lg px-3 py-2 text-[13px] bg-white w-full"
              >
                <option value="excel">Excel (.xlsx)</option>
                <option value="pdf">PDF</option>
              </select>
            </div>
            <button
              onClick={cargarPreview}
              disabled={loadingPreview}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 text-[12px] font-semibold px-3.5 py-2 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-60"
            >
              {loadingPreview ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Vista previa
            </button>
            <button
              onClick={descargar}
              disabled={loadingDescarga}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 text-[12px] font-semibold px-3.5 py-2 rounded-lg text-white disabled:opacity-60"
              style={{ background: GUINDA }}
            >
              {loadingDescarga ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Descargar
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-[12px] mb-4">{error}</div>
          )}

          {preview && (
            <>
              <div className="flex flex-wrap gap-3 mb-4">
                {preview.kpis.map((k) => (
                  <div key={k.label} className="border border-stone-200 rounded-lg px-3.5 py-2.5">
                    <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#6b635e' }}>{k.label}</div>
                    <div className="text-[17px] font-bold" style={{ fontFamily: "'Poppins', sans-serif" }}>
                      {k.valor}{k.unidad ? ` ${k.unidad}` : ''}
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-[11px] mb-2" style={{ color: '#6b635e' }}>
                Mostrando {Math.min(50, preview.preview.length)} de {preview.totalRegistros.toLocaleString('es-MX')} registros
              </div>
              <div style={{ overflowX: 'auto', maxHeight: 360, overflowY: 'auto' }} className="border border-stone-100 rounded-lg">
                <table className="w-full text-[11.5px]">
                  <thead>
                    <tr className="text-left sticky top-0" style={{ background: '#f8f4ec', color: '#57504a' }}>
                      {preview.columnas.map((c) => (
                        <th key={c} className="py-2 px-2.5 font-semibold whitespace-nowrap">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.preview.map((fila, i) => (
                      <tr key={i} className="border-t border-stone-100">
                        {fila.map((celda, j) => (
                          <td key={j} className="py-1.5 px-2.5 whitespace-nowrap">{celda ?? '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </SeccionCard>
      )}

      {/* Historial */}
      <div className="mt-6">
        <SeccionCard titulo="Historial de reportes generados" sub="Últimos 20 del sistema (todos los perfiles)">
          <div className="overflow-x-auto -mx-1 px-1 pb-1">
          <table className="w-full text-[12px] min-w-[480px]">
            <thead>
              <tr className="text-left" style={{ color: '#6b635e' }}>
                <th className="py-2 pr-3 font-semibold">Reporte</th>
                <th className="py-2 pr-3 font-semibold">Formato</th>
                <th className="py-2 pr-3 font-semibold text-right">Registros</th>
                <th className="py-2 font-semibold text-right">Generado</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((h) => (
                <tr key={h.id} className="border-t border-stone-100">
                  <td className="py-2 pr-3 font-medium">{h.nombre}</td>
                  <td className="py-2 pr-3 uppercase" style={{ color: '#6b635e' }}>{h.formato}</td>
                  <td className="py-2 pr-3 text-right">{h.totalRegistros ?? '—'}</td>
                  <td className="py-2 text-right" style={{ color: '#6b635e' }}>{fechaCorta(h.generadoEn ?? h.createdAt)}</td>
                </tr>
              ))}
              {historial.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center" style={{ color: '#a89a8e' }}>Aún no hay reportes generados</td></tr>
              )}
            </tbody>
          </table>
          </div>
        </SeccionCard>
      </div>
    </DireccionLayout>
  );
}
