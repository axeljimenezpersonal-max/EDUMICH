/**
 * Lista de alumnos del gestor.
 *
 * Ubicación destino: artifacts/student-portal/src/pages/gestor/AlumnosList.tsx
 */

import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { Search, Plus, Users, FileText, ChevronRight } from 'lucide-react';
import { GestorLayout } from './GestorLayout';
import { api, type AlumnoListItem } from '../../lib/api';
import { StatusBadge } from '../../components/StatusBadge';

export default function AlumnosList() {
  const [alumnos, setAlumnos] = useState<AlumnoListItem[] | null>(null);
  const [filtro, setFiltro] = useState('');

  useEffect(() => {
    api.get<{ alumnos: AlumnoListItem[] }>('/gestor/alumnos').then((r) => setAlumnos(r.alumnos));
  }, []);

  const filtered = (alumnos ?? []).filter((a) => {
    const q = filtro.trim().toLowerCase();
    if (!q) return true;
    return a.nombreCompleto.toLowerCase().includes(q) || a.curp.toLowerCase().includes(q);
  });

  return (
    <GestorLayout>
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-[var(--color-guinda-700)] font-semibold mb-1">
            Mis alumnos
          </div>
          <h1 className="font-serif text-3xl font-bold text-stone-900">
            Alumnos registrados
          </h1>
          <p className="text-stone-600 mt-1">
            {alumnos === null
              ? 'Cargando...'
              : `${alumnos.length} ${alumnos.length === 1 ? 'alumno' : 'alumnos'} en tu municipio`}
          </p>
        </div>
        <Link
          href="/gestor/alumnos/nuevo"
          className="gov-btn-primary inline-flex items-center gap-2 whitespace-nowrap"
        >
          <Plus size={16} />
          Nuevo alumno
        </Link>
      </div>

      {/* Filtro */}
      <div className="bg-white border border-stone-200 rounded-md p-3 mb-4">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
          />
          <input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar por nombre o CURP..."
            className="gov-input pl-10"
          />
        </div>
      </div>

      {/* Tabla / lista */}
      {alumnos === null ? (
        <div className="bg-white border border-stone-200 rounded-md p-12 text-center text-stone-500">
          Cargando...
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="bg-white border border-stone-200 rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-crema-100)] border-b border-stone-200">
              <tr className="text-left text-xs uppercase tracking-widest text-stone-600">
                <th className="px-4 py-3 font-semibold">Alumno</th>
                <th className="px-4 py-3 font-semibold">CURP</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold text-right">Documentos</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr
                  key={a.userId}
                  className="border-b border-stone-100 last:border-b-0 hover:bg-[var(--color-crema-50)] transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/gestor/alumnos/${a.userId}`}
                      className="font-medium text-stone-900 hover:text-[var(--color-guinda-700)]"
                    >
                      {a.nombreCompleto}
                    </Link>
                    <div className="text-xs text-stone-500 mt-0.5">
                      {a.inscripcion?.convocatoriaNombre ?? 'Sin convocatoria'}
                      {a.telefono ? ` · ${a.telefono}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-stone-700">{a.curp}</td>
                  <td className="px-4 py-3">
                    {a.inscripcion ? (
                      <StatusBadge estado={a.inscripcion.estado} />
                    ) : (
                      <span className="text-xs text-stone-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center gap-1 text-stone-700">
                      <FileText size={14} className="text-stone-400" />
                      {a.docsCount}
                    </span>
                  </td>
                  <td className="px-2 py-3">
                    <Link
                      href={`/gestor/alumnos/${a.userId}`}
                      className="text-stone-400 hover:text-[var(--color-guinda-700)] block"
                    >
                      <ChevronRight size={18} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GestorLayout>
  );
}

function EmptyState() {
  return (
    <div className="bg-white border border-stone-200 rounded-md p-12 text-center">
      <div className="w-14 h-14 rounded-full bg-[var(--color-crema-100)] flex items-center justify-center text-[var(--color-guinda-700)] mx-auto mb-3">
        <Users size={22} />
      </div>
      <h3 className="font-serif text-xl font-semibold text-stone-900 mb-1">
        Aún no tienes alumnos registrados
      </h3>
      <p className="text-sm text-stone-600 mb-4 max-w-sm mx-auto">
        Comienza registrando al primer alumno de tu municipio. Después podrás subir su
        documentación.
      </p>
      <Link href="/gestor/alumnos/nuevo" className="gov-btn-primary inline-flex items-center gap-2">
        <Plus size={16} />
        Registrar primer alumno
      </Link>
    </div>
  );
}
