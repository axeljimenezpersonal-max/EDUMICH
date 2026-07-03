import { useEffect, useState } from 'react';
import { Lock, GraduationCap, Grid3x3, List, Download, Award, ClipboardCheck, Clock } from 'lucide-react';
import { api, type CalificacionesResponse, type CalifRow, type CalificacionExamen } from '../lib/api';

// Metas del Plan Modular por nivel (total 21)
const META_NIVEL: Record<number, number> = { 1: 4, 2: 6, 3: 6, 4: 5 };

interface Props {
  estudianteId: number;
  readOnly?: boolean;
}

type SubTab = 'aprobados' | 'historial';
type Vista = 'calificaciones' | 'evaluaciones';

export default function CalificacionesTabContent({ estudianteId, readOnly = true }: Props) {
  const [data, setData] = useState<CalificacionesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<SubTab>('aprobados');
  const [vista, setVista] = useState<Vista>('calificaciones');

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
  const calificacionesExamen: CalificacionExamen[] = data.calificacionesExamen ?? [];

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
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          {d.getDate()}
        </div>
        <div className="text-[9px] text-stone-500">{d.getFullYear()}</div>
      </div>
    );
  }

  // Aprobados por nivel (para el análisis)
  const porNivel: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const m of modulosAprobados) {
    if (m.moduloNivel && porNivel[m.moduloNivel] !== undefined) porNivel[m.moduloNivel]++;
  }

  return (
    <div>
      {/* Encabezado con descarga del historial */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="font-serif text-base font-bold text-stone-900">Calificaciones y evaluaciones</h2>
        <a
          href={`/api/calificaciones/estudiantes/${estudianteId}/pdf`}
          download=""
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-[var(--color-guinda-700)] text-white hover:bg-[var(--color-guinda-800)] transition-colors shrink-0"
        >
          <Download size={13} /> Descargar historial (PDF)
        </a>
      </div>

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

      {/* ── Tabs principales: Calificaciones / Evaluaciones ── */}
      <div className="flex border-b-2 border-stone-200 mb-4 gap-0.5">
        {(['calificaciones', 'evaluaciones'] as Vista[]).map((v) => {
          const active = vista === v;
          const cnt = v === 'calificaciones' ? calificacionesExamen.length : modulosAprobados.length;
          return (
            <button
              key={v}
              onClick={() => setVista(v)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                active ? 'text-[var(--color-guinda-700)] border-[var(--color-guinda-700)]' : 'text-stone-500 border-transparent hover:text-stone-700'
              }`}
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              {v === 'calificaciones' ? <Award size={15} /> : <ClipboardCheck size={15} />}
              {v === 'calificaciones' ? 'Calificaciones' : 'Evaluaciones'}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${active ? 'bg-[var(--color-guinda-100)] text-[var(--color-guinda-700)]' : 'bg-[var(--color-crema-200)] text-stone-700'}`}>{cnt}</span>
            </button>
          );
        })}
      </div>

      {/* ── VISTA: Calificaciones (exámenes pagados con folio; automático) ── */}
      {vista === 'calificaciones' && (
        <div className="mb-2">
          <p className="text-xs text-stone-500 mb-3">
            Exámenes que el alumno pagó. La calificación aparece automáticamente cuando la administración la captura.
          </p>
          {calificacionesExamen.length === 0 ? (
            <EmptyState icon={<Award size={22} />} title="Sin exámenes pagados aún"
              desc="Aquí aparecerán los exámenes pagados con su folio; la calificación se registra automáticamente al capturarla la administración." />
          ) : (
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-crema-100)] border-b border-stone-200 text-left text-xs uppercase tracking-widest text-stone-600">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Folio</th>
                    <th className="px-4 py-2.5 font-semibold">Módulo</th>
                    <th className="px-4 py-2.5 font-semibold text-center">Calificación</th>
                    <th className="px-4 py-2.5 font-semibold text-right">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {calificacionesExamen.map((c) => (
                    <tr key={c.inscripcionId} className="border-b border-stone-100 last:border-0">
                      <td className="px-4 py-2.5 font-mono text-xs text-stone-700">{c.folio}</td>
                      <td className="px-4 py-2.5 text-stone-800">Módulo {c.moduloNumero} — {c.moduloNombre}</td>
                      <td className="px-4 py-2.5 text-center">
                        {c.capturada
                          ? <span className={`font-bold ${c.aprobado ? 'text-emerald-700' : 'text-red-600'}`}>{c.calificacion}</span>
                          : <span className="text-stone-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {c.capturada
                          ? <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${c.aprobado ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{c.aprobado ? 'Aprobado' : 'No aprobado'}</span>
                          : <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"><Clock size={11} /> Pendiente de captura</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── VISTA: Evaluaciones (módulos del Plan Modular) ── */}
      {vista === 'evaluaciones' && (<>
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
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              {resumen.totalAprobados} módulos aprobados
            </div>
            <div className="text-xs opacity-80 mt-1">de 21 del Plan Modular</div>
          </div>
          <div className="h-14 w-px bg-white/20" />
          <div className="text-center">
            <div
              className="text-4xl font-bold leading-none"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              {resumen.promedioGlobal}
              <span className="text-base opacity-60 font-normal">/100</span>
            </div>
            <div className="text-[9px] uppercase tracking-wider opacity-80 mt-1">Promedio</div>
          </div>
          <div className="text-center">
            <div
              className="text-4xl font-bold leading-none"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              {resumen.porcentajeAvance}
              <span className="text-base opacity-60 font-normal">%</span>
            </div>
            <div className="text-[9px] uppercase tracking-wider opacity-80 mt-1">Avance</div>
          </div>
        </div>
      </div>

      {/* Análisis por nivel */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 mb-4">
        <div className="text-xs font-bold uppercase tracking-widest text-stone-500 mb-3">
          Avance por nivel del Plan Modular
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
          {[1, 2, 3, 4].map((n) => {
            const meta = META_NIVEL[n];
            const got = porNivel[n] ?? 0;
            const pct = meta ? Math.min(100, Math.round((got / meta) * 100)) : 0;
            const completo = got >= meta;
            return (
              <div key={n} className="flex items-center gap-3">
                <span className="text-xs font-semibold text-stone-700 w-14 shrink-0" style={{ fontFamily: "'Poppins', sans-serif" }}>
                  Nivel {n}
                </span>
                <div className="flex-1 h-2.5 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: completo ? '#2d7d46' : 'var(--color-guinda-700)' }}
                  />
                </div>
                <span className="text-[11px] font-semibold text-stone-500 w-16 text-right shrink-0">
                  {got}/{meta}
                </span>
              </div>
            );
          })}
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
              style={{ fontFamily: "'Poppins', sans-serif" }}
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
                      style={{ fontFamily: "'Poppins', sans-serif" }}
                    >
                      M{row.moduloNumero}
                    </span>
                  </div>
                  <div>
                    <div className="font-semibold text-stone-900 text-sm leading-snug" style={{ fontFamily: "'Poppins', sans-serif" }}>
                      {row.moduloNombre}
                    </div>
                    <div className="text-[11px] text-stone-500 mt-0.5">
                      {row.moduloNivel ? `Nivel ${row.moduloNivel} · ` : ''}Etapa {row.etapaClave}
                    </div>
                  </div>
                  <div
                    className="text-right font-bold text-emerald-600 text-xl leading-none"
                    style={{ fontFamily: "'Poppins', sans-serif" }}
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
              <div className="font-bold text-stone-900 mb-1" style={{ fontFamily: "'Poppins', sans-serif" }}>
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
                      style={{ fontFamily: "'Poppins', sans-serif" }}
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
                    style={{ fontFamily: "'Poppins', sans-serif" }}
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
      </>)}
    </div>
  );
}

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="border-2 border-dashed border-stone-200 rounded-xl p-10 text-center">
      <div className="w-14 h-14 bg-[var(--color-crema-100)] text-[var(--color-guinda-700)] rounded-full flex items-center justify-center mx-auto mb-3">
        {icon}
      </div>
      <div className="font-bold text-stone-900 mb-1" style={{ fontFamily: "'Poppins', sans-serif" }}>
        {title}
      </div>
      <p className="text-sm text-stone-500 max-w-sm mx-auto">{desc}</p>
    </div>
  );
}
