/**
 * Tabla pivote idéntica a la "Relación de Calificaciones y Aciertos" de la SEP:
 * una convocatoria = una sección; dentro, UN renglón por alumno (sin repetir el
 * nombre) con sus módulos en horizontal como tripletes (Módulo · Cal · Aci).
 * Compartida por el panel del admin y el del gestor para que se vean idénticas.
 */
import { Fragment, useMemo } from 'react';
import { Link } from 'wouter';
import { calif10 } from '../lib/api';

export type RelacionPivoteRow = {
  estudianteId: number;
  alumno: string | null;
  curp: string | null;
  matricula: string | null;
  etapaId: number;
  etapaClave: string;
  etapaAnio: number | null;
  moduloNumero: number;
  moduloNombre: string;
  calificacion: number | null;
  aciertos: number | null;
  estadoExamen: string;
};

type ModCell = { modulo: number; moduloNombre: string; calif: number | null; aciertos: number | null; estado: string };
type AlumnoPivote = { estudianteId: number; nombre: string; curp: string | null; matricula: string | null; mods: ModCell[] };
type GrupoConvocatoria = { etapaId: number; etapaClave: string; etapaAnio: number | null; alumnos: AlumnoPivote[]; maxMods: number };

// Color de la calificación según el estado del examen (verde aprobado / rojo no).
function colorCalif(calif: number | null, estado: string): string {
  if (estado === 'aprobado') return '#065f46';
  if (estado === 'reprobado' || estado === 'no_presento') return '#991b1b';
  if (calif === null) return '#57534e';
  return calif >= 60 ? '#065f46' : '#991b1b';
}

export function RelacionCalificacionesPivote({ rows, alumnoHref, vacioTexto = 'Ningún alumno coincide con la búsqueda.' }: {
  rows: RelacionPivoteRow[];
  alumnoHref: (estudianteId: number) => string;
  vacioTexto?: string;
}) {
  const grupos = useMemo<GrupoConvocatoria[]>(() => {
    const convMap = new Map<number, GrupoConvocatoria>();
    for (const r of rows) {
      let g = convMap.get(r.etapaId);
      if (!g) {
        g = { etapaId: r.etapaId, etapaClave: r.etapaClave, etapaAnio: r.etapaAnio, alumnos: [], maxMods: 0 };
        convMap.set(r.etapaId, g);
      }
      let a = g.alumnos.find((x) => x.estudianteId === r.estudianteId);
      if (!a) {
        a = { estudianteId: r.estudianteId, nombre: r.alumno ?? '—', curp: r.curp, matricula: r.matricula, mods: [] };
        g.alumnos.push(a);
      }
      a.mods.push({ modulo: r.moduloNumero, moduloNombre: r.moduloNombre, calif: r.calificacion, aciertos: r.aciertos, estado: r.estadoExamen });
    }
    const arr = Array.from(convMap.values());
    for (const g of arr) {
      for (const a of g.alumnos) a.mods.sort((x, y) => x.modulo - y.modulo);
      g.alumnos.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      g.maxMods = g.alumnos.reduce((mx, a) => Math.max(mx, a.mods.length), 0);
    }
    arr.sort((a, b) => `${b.etapaClave} ${b.etapaAnio}`.localeCompare(`${a.etapaClave} ${a.etapaAnio}`, 'es'));
    return arr;
  }, [rows]);

  if (grupos.length === 0) {
    return <div className="rounded-xl border border-stone-200 bg-white p-12 text-center text-sm text-stone-500">{vacioTexto}</div>;
  }

  return (
    <>
      <p className="mb-3 text-xs text-stone-500">
        Un renglón por alumno; sus módulos en horizontal, tal cual la Relación de la SEP.
        {' '}<strong className="text-stone-700">Mód</strong> = módulo · <strong className="text-stone-700">Cal</strong> = calificación 0–10 (6 aprueba) · <strong className="text-stone-700">Aci</strong> = aciertos · <span className="text-stone-400">—</span> = aún sin registrar.
      </p>
      <div className="space-y-6">
        {grupos.map((g) => (
          <div key={g.etapaId}>
            <div className="mb-2 flex items-baseline gap-2">
              <h3 className="font-serif text-lg font-bold text-stone-900">Convocatoria {g.etapaClave}</h3>
              <span className="text-xs text-stone-500">{g.etapaAnio ? `· ${g.etapaAnio} ` : ''}· {g.alumnos.length} alumno{g.alumnos.length === 1 ? '' : 's'}</span>
            </div>
            <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-stone-200 bg-[var(--color-crema-100)] text-[11px] uppercase tracking-wider text-stone-600">
                      <th className="px-3 py-2.5 text-center font-semibold">Nº</th>
                      <th className="px-4 py-2.5 text-left font-semibold" style={{ width: '100%' }}>Nombre</th>
                      <th className="px-4 py-2.5 text-left font-semibold">Matrícula</th>
                      {Array.from({ length: g.maxMods }).map((_, i) => (
                        <Fragment key={i}>
                          <th className="border-l border-stone-200 px-3 py-2.5 text-center font-semibold">Mód</th>
                          <th className="px-3 py-2.5 text-center font-semibold">Cal</th>
                          <th className="px-3 py-2.5 text-center font-semibold">Aci</th>
                        </Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {g.alumnos.map((a, idx) => (
                      <tr key={a.estudianteId} className={`border-b border-stone-100 last:border-0 ${idx % 2 ? 'bg-stone-50/40' : 'bg-white'} hover:bg-[var(--color-crema-50)]`}>
                        <td className="px-3 py-3 text-center text-xs text-stone-400">{idx + 1}</td>
                        <td className="px-4 py-3 whitespace-nowrap" style={{ width: '100%' }}>
                          <Link href={alumnoHref(a.estudianteId)} className="font-semibold text-[15px] text-stone-900 hover:text-[var(--color-guinda-700)]">{a.nombre}</Link>
                          {a.curp && <div className="font-mono text-[10px] text-stone-400">{a.curp}</div>}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-stone-600 whitespace-nowrap">{a.matricula ?? '—'}</td>
                        {Array.from({ length: g.maxMods }).map((_, i) => {
                          const m = a.mods[i];
                          if (!m) return (
                            <Fragment key={i}>
                              <td className="border-l border-stone-100 px-3 py-3" />
                              <td className="px-3 py-3" />
                              <td className="px-3 py-3" />
                            </Fragment>
                          );
                          return (
                            <Fragment key={i}>
                              <td className="border-l border-stone-100 px-3 py-3 text-center">
                                <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded px-1.5 text-xs font-bold" style={{ background: '#f8f4ec', color: 'var(--color-guinda-700)' }} title={m.moduloNombre}>{m.modulo}</span>
                              </td>
                              <td className="px-3 py-3 text-center">
                                {m.calif !== null
                                  ? <span className="font-mono text-base font-bold" style={{ color: colorCalif(m.calif, m.estado) }}>{calif10(m.calif)}</span>
                                  : <span className="font-mono text-sm text-stone-300">—</span>}
                              </td>
                              <td className="px-3 py-3 text-center font-mono text-sm text-stone-600">
                                {m.aciertos ?? <span className="text-stone-300">—</span>}
                              </td>
                            </Fragment>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
