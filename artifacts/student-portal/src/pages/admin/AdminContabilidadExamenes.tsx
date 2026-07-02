/**
 * Contabilidad de exámenes (admin) — control interno por examen (alumno + módulo).
 * Cada examen tiene su folio y su estado: registrado / pagado / aprobado.
 */
import { useEffect, useState } from 'react';
import { ClipboardList, Search, CheckCircle2, Clock, XCircle, Loader2 } from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { api, type ContabilidadExamenes, type ExamenContable } from '../../lib/api';

type Filtro = 'todos' | 'pagados' | 'sin_pagar' | 'en_proceso' | 'aprobados';

function Flag({ on, label, tone }: { on: boolean; label: string; tone: 'green' | 'blue' | 'amber' | 'stone' }) {
  const cfg = on
    ? { green: 'bg-emerald-100 text-emerald-700', blue: 'bg-blue-100 text-blue-700', amber: 'bg-amber-100 text-amber-700', stone: 'bg-stone-100 text-stone-600' }[tone]
    : 'bg-stone-50 text-stone-300';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg}`}>{label}</span>;
}

export default function AdminContabilidadExamenes() {
  const [data, setData] = useState<ContabilidadExamenes | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');

  function cargar(query = '') {
    setLoading(true);
    api.get<ContabilidadExamenes>(`/pagos-examen/contabilidad${query ? `?q=${encodeURIComponent(query)}` : ''}`)
      .then(setData).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(() => { cargar(); }, []);

  const filtrados = (data?.examenes ?? []).filter((e) => {
    if (filtro === 'pagados') return e.pagado;
    if (filtro === 'sin_pagar') return !e.pagado && !e.enProcesoPago;
    if (filtro === 'en_proceso') return e.enProcesoPago;
    if (filtro === 'aprobados') return e.aprobado;
    return true;
  });

  const FILTROS: { key: Filtro; label: string }[] = [
    { key: 'todos', label: 'Todos' },
    { key: 'pagados', label: 'Pagados' },
    { key: 'en_proceso', label: 'En proceso de pago' },
    { key: 'sin_pagar', label: 'Sin pagar' },
    { key: 'aprobados', label: 'Aprobados' },
  ];

  return (
    <AdminLayout>
      <div className="mb-5">
        <div className="text-xs uppercase tracking-widest text-[var(--color-guinda-700)] font-semibold mb-1">Control interno</div>
        <h1 className="font-serif text-3xl font-bold text-stone-900 flex items-center gap-2"><ClipboardList size={26} /> Contabilidad de exámenes</h1>
        <p className="text-stone-600 mt-1 text-sm max-w-2xl">Cada examen (alumno + módulo) con su folio y su estado: registrado, pagado y aprobado.</p>
      </div>

      {/* Resumen */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          <Tarjeta label="Exámenes registrados" val={data.resumen.total} />
          <Tarjeta label="Pagados" val={data.resumen.pagados} tone="green" />
          <Tarjeta label="En proceso de pago" val={data.resumen.enProcesoPago} tone="amber" />
          <Tarjeta label="Presentados" val={data.resumen.presentados} tone="blue" />
          <Tarjeta label="Aprobados" val={data.resumen.aprobados} tone="green" />
        </div>
      )}

      {/* Filtros + búsqueda */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && cargar(q)}
            placeholder="Buscar por alumno, folio o matrícula…" className="w-full text-sm border border-stone-300 rounded-lg pl-9 pr-3 py-2" />
        </div>
        {FILTROS.map((f) => (
          <button key={f.key} onClick={() => setFiltro(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${filtro === f.key ? 'bg-[var(--color-guinda-700)] text-white border-[var(--color-guinda-700)]' : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-stone-400 py-16 text-sm flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" /> Cargando…</div>
      ) : filtrados.length === 0 ? (
        <div className="border-2 border-dashed border-stone-200 rounded-xl p-12 text-center text-sm text-stone-500">Sin exámenes en este filtro.</div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-[var(--color-crema-100)] border-b border-stone-200 text-left text-xs uppercase tracking-widest text-stone-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Folio examen</th>
                <th className="px-4 py-3 font-semibold">Alumno</th>
                <th className="px-4 py-3 font-semibold">Módulo</th>
                <th className="px-4 py-3 font-semibold text-center">Pago</th>
                <th className="px-4 py-3 font-semibold text-center">Presentado</th>
                <th className="px-4 py-3 font-semibold text-center">Aprobado</th>
                <th className="px-4 py-3 font-semibold">Ficha</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((e: ExamenContable) => (
                <tr key={e.id} className="border-b border-stone-100 last:border-0 hover:bg-[var(--color-crema-50)]">
                  <td className="px-4 py-2.5 font-mono text-xs text-stone-700">{e.folio}</td>
                  <td className="px-4 py-2.5">
                    <div className="text-stone-900">{e.alumno}</div>
                    {e.matricula && <div className="text-[11px] text-stone-400 font-mono">{e.matricula}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-stone-700">M{e.moduloNumero} · {e.moduloNombre}</td>
                  <td className="px-4 py-2.5 text-center">
                    {e.pagado ? <Flag on label="Pagado" tone="green" />
                      : e.enProcesoPago ? <Flag on label="En proceso" tone="amber" />
                      : <Flag on={false} label="Sin pagar" tone="stone" />}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {e.presentado ? <CheckCircle2 size={16} className="text-blue-600 inline" /> : <span className="text-stone-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {e.aprobado ? <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-xs"><CheckCircle2 size={14} /> {e.calificacion ?? ''}</span>
                      : e.presentado ? <span className="inline-flex items-center gap-1 text-red-600 text-xs"><XCircle size={14} /> {e.calificacion ?? ''}</span>
                      : <span className="text-stone-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-stone-400">{e.fichaFolio ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}

function Tarjeta({ label, val, tone }: { label: string; val: number; tone?: 'green' | 'amber' | 'blue' }) {
  const color = tone === 'green' ? 'text-emerald-700' : tone === 'amber' ? 'text-amber-700' : tone === 'blue' ? 'text-blue-700' : 'text-stone-900';
  return (
    <div className="rounded-xl p-4 border bg-white border-stone-200">
      <div className="text-[10px] uppercase tracking-wide font-semibold mb-1 text-stone-400">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{val}</div>
    </div>
  );
}
