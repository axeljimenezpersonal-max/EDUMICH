/**
 * Padrón de CENTROS DE ASESORÍA — vista del creador.
 *
 * Lista maestra que entregó la coordinación, cruzada con los gestores REALES
 * del sistema: cada centro muestra si ya tiene cuenta o si sigue pendiente, y
 * se puede marcar activo/inactivo sin borrarlo (se conserva la historia).
 */

import { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, Building2, CheckCircle, AlertTriangle, Search, UserX } from 'lucide-react';
import { api } from '../../lib/api';
import { DireccionLayout, TarjetaKPI, SeccionCard } from './DireccionLayout';

interface CuentaGestor {
  userId: number;
  nombre: string;
  municipio: string | null;
  alumnos: number;
}

interface CentroPadron {
  id: number;
  centro: string;
  rfc: string | null;
  contacto: string | null;
  municipio: string | null;
  activo: boolean;
  notas: string | null;
  cuenta: CuentaGestor | null;
}

interface Respuesta {
  centros: CentroPadron[];
  fueraDelPadron: Array<{ userId: number; nombre: string; centro: string | null; rfc: string | null; municipio: string | null; alumnos: number }>;
  resumen: { total: number; activos: number; conCuenta: number; sinRfc: number; sinContacto: number };
}

type Filtro = 'todos' | 'sin_cuenta' | 'con_cuenta' | 'inactivos' | 'incompletos';

export default function DireccionCentros() {
  const [data, setData] = useState<Respuesta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actualizando, setActualizando] = useState(false);
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [guardando, setGuardando] = useState<number | null>(null);

  function cargar() {
    setActualizando(true);
    api.get<Respuesta>('/direccion/centros')
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError((e as Error).message))
      .finally(() => setActualizando(false));
  }
  useEffect(cargar, []);

  async function alternarActivo(c: CentroPadron) {
    setGuardando(c.id);
    try {
      await api.patch(`/direccion/centros/${c.id}`, { activo: !c.activo });
      setData((d) => d && ({
        ...d,
        centros: d.centros.map((x) => (x.id === c.id ? { ...x, activo: !c.activo } : x)),
        resumen: { ...d.resumen, activos: d.resumen.activos + (c.activo ? -1 : 1) },
      }));
    } catch { /* se ignora: la fila queda como estaba */ } finally { setGuardando(null); }
  }

  const visibles = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    return data.centros.filter((c) => {
      if (filtro === 'sin_cuenta' && c.cuenta) return false;
      if (filtro === 'con_cuenta' && !c.cuenta) return false;
      if (filtro === 'inactivos' && c.activo) return false;
      if (filtro === 'incompletos' && c.rfc && c.contacto) return false;
      if (!term) return true;
      return [c.centro, c.rfc, c.contacto, c.municipio].some((v) => (v ?? '').toLowerCase().includes(term));
    });
  }, [data, q, filtro]);

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

  const r = data.resumen;
  const FILTROS: Array<{ k: Filtro; label: string; n: number }> = [
    { k: 'todos', label: 'Todos', n: r.total },
    { k: 'sin_cuenta', label: 'Sin cuenta', n: r.total - r.conCuenta },
    { k: 'con_cuenta', label: 'Con cuenta', n: r.conCuenta },
    { k: 'inactivos', label: 'Inactivos', n: r.total - r.activos },
    { k: 'incompletos', label: 'Datos incompletos', n: data.centros.filter((c) => !c.rfc || !c.contacto).length },
  ];

  return (
    <DireccionLayout>
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="font-bold" style={{ fontSize: 22, fontFamily: "'Poppins', sans-serif" }}>
            Centros de asesoría
          </h1>
          <p className="text-[13px]" style={{ color: '#6b635e' }}>
            Padrón de la coordinación cruzado con las cuentas de gestor del sistema
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <TarjetaKPI etiqueta="Centros en el padrón" valor={String(r.total)} sub={`${r.activos} activos`} acento="#6B1530" />
        <TarjetaKPI etiqueta="Ya con cuenta" valor={String(r.conCuenta)} sub={`${r.total - r.conCuenta} por dar de alta`} acento={r.conCuenta === r.total ? '#166534' : '#d97706'} />
        <TarjetaKPI etiqueta="Sin RFC" valor={String(r.sinRfc)} sub="no pueden facturar solos" acento={r.sinRfc ? '#d97706' : '#166534'} />
        <TarjetaKPI etiqueta="Sin contacto" valor={String(r.sinContacto)} sub="falta responsable" acento={r.sinContacto ? '#d97706' : '#166534'} />
      </div>

      {/* Buscador + filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar centro, RFC, contacto o municipio…"
            className="w-full rounded-lg border border-stone-200 bg-white py-2 pl-9 pr-3 text-[13px] focus:border-[#6B1530] focus:outline-none"
          />
        </div>
        {FILTROS.map((f) => (
          <button
            key={f.k}
            onClick={() => setFiltro(f.k)}
            className="rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors"
            style={filtro === f.k
              ? { background: '#6B1530', color: '#fff' }
              : { background: '#fff', color: '#6b635e', border: '1px solid #e7e2dc' }}
          >
            {f.label} <span className="opacity-70">{f.n}</span>
          </button>
        ))}
      </div>

      <SeccionCard titulo={`Padrón (${visibles.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]" style={{ minWidth: 780 }}>
            <thead>
              <tr className="text-left" style={{ color: '#8a827b' }}>
                <th className="pb-2 pr-3 font-semibold">Centro</th>
                <th className="pb-2 pr-3 font-semibold">RFC</th>
                <th className="pb-2 pr-3 font-semibold">Contacto</th>
                <th className="pb-2 pr-3 font-semibold">Municipio</th>
                <th className="pb-2 pr-3 font-semibold">Cuenta</th>
                <th className="pb-2 font-semibold text-right">Activo</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((c) => (
                <tr key={c.id} className="border-t border-stone-100 align-top" style={{ opacity: c.activo ? 1 : 0.55 }}>
                  <td className="py-2.5 pr-3">
                    <div className="font-semibold" style={{ color: '#443e39' }}>{c.centro}</div>
                    {c.notas && (
                      <div className="mt-0.5 flex items-start gap-1 text-[11px]" style={{ color: '#b45309' }}>
                        <AlertTriangle size={11} className="mt-0.5 shrink-0" /> {c.notas}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 pr-3">
                    {c.rfc
                      ? <span className="font-mono text-[12px]" style={{ color: '#443e39' }}>{c.rfc}</span>
                      : <span className="rounded px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: '#fef3c7', color: '#92400e' }}>Sin RFC</span>}
                  </td>
                  <td className="py-2.5 pr-3" style={{ color: c.contacto ? '#443e39' : '#a8a29e' }}>
                    {c.contacto ?? '—'}
                  </td>
                  <td className="py-2.5 pr-3" style={{ color: c.municipio ? '#443e39' : '#a8a29e' }}>
                    {c.municipio ?? '—'}
                  </td>
                  <td className="py-2.5 pr-3">
                    {c.cuenta ? (
                      <div>
                        <div className="flex items-center gap-1.5 font-semibold" style={{ color: '#166534' }}>
                          <CheckCircle size={13} /> {c.cuenta.nombre}
                        </div>
                        <div className="text-[11px]" style={{ color: '#8a827b' }}>
                          {c.cuenta.alumnos} alumno{c.cuenta.alumnos === 1 ? '' : 's'}
                        </div>
                      </div>
                    ) : (
                      <span className="rounded px-2 py-0.5 text-[11px] font-semibold" style={{ background: '#f5f5f4', color: '#78716c' }}>
                        Por dar de alta
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      onClick={() => alternarActivo(c)}
                      disabled={guardando === c.id}
                      title={c.activo ? 'Marcar como inactivo' : 'Marcar como activo'}
                      className="rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors disabled:opacity-50"
                      style={c.activo
                        ? { background: '#dcfce7', color: '#166534' }
                        : { background: '#f5f5f4', color: '#78716c' }}
                    >
                      {guardando === c.id ? '…' : c.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                </tr>
              ))}
              {visibles.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-[13px]" style={{ color: '#a8a29e' }}>
                  {data.centros.length === 0
                    ? 'El padrón está vacío. Cárgalo con el script de importación.'
                    : 'Ningún centro coincide con la búsqueda.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </SeccionCard>

      {/* Gestores con cuenta que no están en el padrón */}
      {data.fueraDelPadron.length > 0 && (
        <div className="mt-6">
          <SeccionCard titulo={`Gestores fuera del padrón (${data.fueraDelPadron.length})`} sub="Tienen cuenta en el sistema pero no aparecen en la lista de la coordinación">
            <div className="divide-y divide-stone-100">
              {data.fueraDelPadron.map((g) => (
                <div key={g.userId} className="flex items-center gap-3 py-2.5">
                  <UserX size={15} className="shrink-0" style={{ color: '#b45309' }} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold" style={{ color: '#443e39' }}>{g.nombre}</div>
                    <div className="text-[11px]" style={{ color: '#8a827b' }}>
                      {g.centro ?? 'Sin centro'}{g.municipio ? ` · ${g.municipio}` : ''} · {g.alumnos} alumno{g.alumnos === 1 ? '' : 's'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SeccionCard>
        </div>
      )}

      <p className="mt-4 flex items-start gap-1.5 text-[11px]" style={{ color: '#a8a29e' }}>
        <Building2 size={12} className="mt-0.5 shrink-0" />
        El padrón es un catálogo de referencia: un centro puede estar aquí sin tener todavía cuenta de gestor.
        Marcar un centro como inactivo no borra nada ni afecta a su cuenta.
      </p>
    </DireccionLayout>
  );
}
