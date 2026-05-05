import { useEffect, useState } from 'react';
import { Lock, GraduationCap, Grid3x3, List } from 'lucide-react';
import { api, type CalificacionesResponse, type CalifRow } from '../lib/api';

interface Props {
  estudianteId: number;
  readOnly?: boolean;
}

type SubTab = 'aprobados' | 'historial';

export default function CalificacionesTabContent({ estudianteId, readOnly = true }: Props) {
  const [data, setData] = useState<CalificacionesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<SubTab>('aprobados');

  useEffect(() => {
    api
      .get<CalificacionesResponse>(`/calificaciones/estudiantes/${estudianteId}`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [estudianteId]);

  if (loading) {
    return (
      <div className="text-center text-stone-400 py-12 text-sm">
        Cargando calificaciones…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center text-stone-400 py-12 text-sm">
        No se pudieron cargar las calificaciones.
      </div>
    );
  }

  const { modulosAprobados, historial, resumen } = data;

  const MES_LABELS = [
    'ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN',
    'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC',
  ];

  function DateBlock({ fecha }: { fecha: string }) {
    const d = new Date(fecha + 'T12:00:00');
    return (
      <div className="bg-[var(--color-crema-100)] rounded-lg px-3.5 py-2.5 text-center min-w-[68px]">
        <div className="text-[9px] font-bold text-[var(--color-guinda-700)] uppercase tracking-wider">
          {MES_LABELS[d.getMonth()]}
        </div>
        <div
          className="text-2xl font-bold text-stone-900 leading-none my-0.5"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          {d.getDate()}
        </div>
        <div className="text-[9px] text-stone-500">{d.getFullYear()}</div>
      </div>
    );
  }

  return (
    <div>
      {/* Read-only banner */}
      {readOnly && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4 text-xs text-blue-900">
          <Lock size={14} className="text-blue-500 shrink-0" />
          <div>
            <strong>Vista de solo lectura.</strong> Las calificaciones las captura la administración.
            Puedes consultarlas e informárselas a tu alumno.
          </div>
        </div>
      )}

      {/* Summary card — green gradient */}
      <div
        className="rounded-xl p-5 mb-4 text-white"
        style={{ background: 'linear-gradient(135deg, #2d7d46 0%, #1d5128 100%)' }}
      >
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-6 items-center">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-1">
              Avance académico
            </div>
            <div
              className="text-2xl font-bold leading-none"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {resumen.totalAprobados} módulos aprobados
            </div>
            <div className="text-xs opacity-80 mt-1">de 21 del Plan Modular</div>
          </div>
          <div className="h-14 w-px bg-white/20" />
          <div className="text-center">
            <div
              className="text-4xl font-bold leading-none"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {resumen.promedioGlobal}
              <span className="text-base opacity-60 font-normal">/100</span>
            </div>
            <div className="text-[9px] uppercase tracking-wider opacity-80 mt-1">Promedio</div>
          </div>
          <div className="text-center">
            <div
              className="text-4xl font-bold leading-none"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {resumen.porcentajeAvance}
              <span className="text-base opacity-60 font-normal">%</span>
            </div>
            <div className="text-[9px] uppercase tracking-wider opacity-80 mt-1">Avance</div>
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex border-b-2 border-stone-200 mb-4 gap-0.5">
        {(['aprobados', 'historial'] as SubTab[]).map((tab) => {
          const label = tab === 'aprobados' ? 'Módulos aprobados' : 'Historial de exámenes';
          const cnt = tab === 'aprobados' ? modulosAprobados.length : historial.length;
          const active = subTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setSubTab(tab)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                active
                  ? 'text-[var(--color-guinda-700)] border-[var(--color-guinda-700)]'
                  : 'text-stone-500 border-transparent hover:text-stone-700'
              }`}
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {tab === 'aprobados' ? <Grid3x3 size={14} /> : <List size={14} />}
              {label}
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  active
                    ? 'bg-[var(--color-guinda-100)] text-[var(--color-guinda-700)]'
                    : 'bg-[var(--color-crema-200)] text-stone-700'
                }`}
              >
                {cnt}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sub-tab: Módulos aprobados */}
      {subTab === 'aprobados' && (
        <>
          {modulosAprobados.length === 0 ? (
            <EmptyState
              icon={<GraduationCap size={28} />}
              title="Sin módulos aprobados aún"
              desc="Las calificaciones aparecerán aquí una vez que el alumno presente y apruebe sus exámenes."
            />
          ) : (
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              <div className="grid grid-cols-[64px_1fr_100px_90px_110px] gap-4 px-5 py-2.5 bg-[var(--color-crema-100)] text-[10px] font-bold text-stone-500 uppercase tracking-wider border-b border-stone-200">
                <div>Módulo</div>
                <div>Nombre</div>
                <div className="text-right">Calificación</div>
                <div className="text-center">Estado</div>
                <div className="text-right">Fecha</div>
              </div>
              {modulosAprobados.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-[64px_1fr_100px_90px_110px] gap-4 px-5 py-3.5 border-b border-stone-100 last:border-0 hover:bg-stone-50 items-center"
                >
                  <div>
                    <span
                      className="inline-block bg-[var(--color-crema-100)] text-[var(--color-guinda-700)] font-bold text-sm px-2.5 py-1 rounded-md"
                      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                    >
                      M{row.moduloNumero}
                    </span>
                  </div>
                  <div>
                    <div className="font-semibold text-stone-900 text-sm leading-snug" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      {row.moduloNombre}
                    </div>
                    <div className="text-[11px] text-stone-500 mt-0.5">
                      {row.moduloNivel ? `Nivel ${row.moduloNivel} · ` : ''}Etapa {row.etapaClave}
                    </div>
                  </div>
                  <div
                    className="text-right font-bold text-emerald-600 text-xl leading-none"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  >
                    {row.calificacion}
                    <span className="text-xs font-normal text-stone-400">/100</span>
                  </div>
                  <div className="text-center">
                    <span className="inline-block bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide">
                      Aprobado
                    </span>
                  </div>
                  <div className="text-right text-xs text-stone-500">
                    {new Date(row.fechaExamen + 'T12:00:00').toLocaleDateString('es-MX', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          {modulosAprobados.length > 0 && 21 - modulosAprobados.length > 0 && (
            <div className="mt-4 border-2 border-dashed border-stone-200 rounded-xl p-6 text-center">
              <div className="w-12 h-12 bg-[var(--color-crema-100)] text-[var(--color-guinda-700)] rounded-full flex items-center justify-center mx-auto mb-3">
                <GraduationCap size={22} />
              </div>
              <div className="font-bold text-stone-900 mb-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Faltan {21 - modulosAprobados.length} módulos por aprobar
              </div>
              <p className="text-xs text-stone-500">
                Para terminar el bachillerato se necesitan acreditar los 21 módulos del Plan Modular.
              </p>
            </div>
          )}
        </>
      )}

      {/* Sub-tab: Historial */}
      {subTab === 'historial' && (
        <>
          {historial.length === 0 ? (
            <EmptyState
              icon={<List size={28} />}
              title="Sin historial de exámenes"
              desc="Aquí aparecerá el historial de todos los exámenes presentados (aprobados y reprobados)."
            />
          ) : (
            <div className="space-y-3">
              {historial.map((row: CalifRow) => (
                <div
                  key={row.id}
                  className={`bg-white border border-stone-200 border-l-4 rounded-xl px-5 py-4 flex items-center gap-4 ${
                    row.aprobado ? 'border-l-emerald-500' : 'border-l-red-500'
                  }`}
                >
                  <DateBlock fecha={row.fechaExamen} />
                  <div className="flex-1 min-w-0">
                    <span
                      className="inline-block bg-[var(--color-crema-100)] text-[var(--color-guinda-700)] text-[10px] font-bold px-2 py-0.5 rounded-full mb-1 uppercase tracking-wide"
                    >
                      M{row.moduloNumero}{row.moduloNivel ? ` · NIVEL ${row.moduloNivel}` : ''}
                    </span>
                    <div
                      className="font-semibold text-stone-900 text-sm leading-snug"
                      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                    >
                      {row.moduloNombre}
                    </div>
                    <div className="flex flex-wrap gap-x-3 text-[11px] text-stone-500 mt-0.5">
                      <span>Etapa {row.etapaClave}</span>
                      {row.sedeNombre && <span>{row.sedeNombre}</span>}
                      <span>{row.intento}º intento</span>
                    </div>
                  </div>
                  <div
                    className={`text-3xl font-bold leading-none ${row.aprobado ? 'text-emerald-600' : 'text-red-600'}`}
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  >
                    {row.calificacion}
                    <span className="text-sm font-normal text-stone-400">/100</span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${
                      row.aprobado
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {row.aprobado ? 'Aprobado' : 'No aprobado'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="border-2 border-dashed border-stone-200 rounded-xl p-10 text-center">
      <div className="w-14 h-14 bg-[var(--color-crema-100)] text-[var(--color-guinda-700)] rounded-full flex items-center justify-center mx-auto mb-3">
        {icon}
      </div>
      <div className="font-bold text-stone-900 mb-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        {title}
      </div>
      <p className="text-sm text-stone-500 max-w-sm mx-auto">{desc}</p>
    </div>
  );
}
