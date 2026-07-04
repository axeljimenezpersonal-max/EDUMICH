/**
 * Lista de alumnos del gestor.
 *
 * Ubicación destino: artifacts/student-portal/src/pages/gestor/AlumnosList.tsx
 */

import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { Search, Plus, Users, FileText, ChevronRight, X } from 'lucide-react';
import { GestorLayout } from './GestorLayout';
import { api, type AlumnoListItem } from '../../lib/api';
import { StatusBadge } from '../../components/StatusBadge';

// Estado del alumno en el proceso (pipeline), del más urgente al final.
const ESTADO_PROCESO: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  documento_rechazado: { label: 'Documento rechazado', bg: '#fee2e2', color: '#b91c1c', dot: '#dc2626' },
  faltan_documentos:   { label: 'Faltan documentos',    bg: '#fef9c3', color: '#92400e', dot: '#d97706' },
  listo_inscribir:     { label: 'Listo para inscribir', bg: '#dbeafe', color: '#1e40af', dot: '#2563eb' },
  pago_pendiente:      { label: 'Pago pendiente',       bg: '#ffedd5', color: '#c2410c', dot: '#ea580c' },
  al_corriente:        { label: 'Al corriente',         bg: '#d1fae5', color: '#166534', dot: '#16a34a' },
};

export default function AlumnosList() {
  const [alumnos, setAlumnos] = useState<AlumnoListItem[] | null>(null);
  const [filtro, setFiltro] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  useEffect(() => {
    api.get<{ alumnos: AlumnoListItem[] }>('/gestor/alumnos').then((r) => setAlumnos(r.alumnos));
    const raw = sessionStorage.getItem('gestor_toast');
    if (raw) {
      sessionStorage.removeItem('gestor_toast');
      try {
        setToast(JSON.parse(raw));
        setTimeout(() => setToast(null), 5000);
      } catch {}
    }
  }, []);

  const filtered = (alumnos ?? []).filter((a) => {
    const q = filtro.trim().toLowerCase();
    if (!q) return true;
    return a.nombreCompleto.toLowerCase().includes(q) || a.curp.toLowerCase().includes(q);
  });

  return (
    <GestorLayout>
      {/* Toast de sesión */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 max-w-sm flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg border text-sm ${
          toast.type === 'warning'
            ? 'bg-amber-50 border-amber-200 text-amber-900'
            : 'bg-green-50 border-green-200 text-green-900'
        }`}>
          <span className="flex-1">{toast.msg}</span>
          <button onClick={() => setToast(null)} className="flex-shrink-0 opacity-60 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

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
                  style={a.obligAprobados < a.obligTotal ? { borderLeft: '3px solid #f59e0b' } : undefined}
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
                    {(() => {
                      const cfg = ESTADO_PROCESO[a.estadoProceso] ?? ESTADO_PROCESO.faltan_documentos;
                      return (
                        <div>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: cfg.bg, color: cfg.color }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
                            {cfg.label}
                          </span>
                          {a.estadoProceso === 'pago_pendiente' && a.modulosPorPagar > 0 && (
                            <div className="text-[10px] text-stone-500 mt-1 ml-0.5">
                              Faltan {a.modulosPorPagar} de {a.modulosInscritos} módulo{a.modulosInscritos === 1 ? '' : 's'} por pagar
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {a.obligAprobados < a.obligTotal ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-stone-700">
                          <FileText size={14} className="text-stone-400" />
                          {a.obligAprobados}/{a.obligTotal}
                        </span>
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">
                          Faltan {a.obligTotal - a.obligAprobados}
                        </span>
                      </span>
                    ) : (
                      <span className="inline-flex flex-col items-end gap-0.5">
                        <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold inline-flex items-center gap-1">
                          <FileText size={12} /> Obligatorios listos
                        </span>
                        {a.opcionalesFaltantes > 0 && (
                          <span className="text-[10px] text-stone-400">
                            {a.opcionalesFaltantes} opcional{a.opcionalesFaltantes !== 1 ? 'es' : ''} faltante{a.opcionalesFaltantes !== 1 ? 's' : ''}
                          </span>
                        )}
                      </span>
                    )}
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
