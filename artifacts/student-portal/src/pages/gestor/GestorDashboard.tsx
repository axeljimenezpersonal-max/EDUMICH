/**
 * Dashboard del gestor: KPIs de su municipio + acceso rápido.
 *
 * Ubicación destino: artifacts/student-portal/src/pages/gestor/GestorDashboard.tsx
 */

import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { Users, FileCheck2, FilePlus2, MapPin, ArrowRight, Calendar, AlertCircle, Megaphone, X } from 'lucide-react';
import { GestorLayout } from './GestorLayout';
import { api, type DashboardGestor, type Convocatoria } from '../../lib/api';
import { safeUrl } from '../../lib/safeUrl';

interface AnuncioItem {
  id: number;
  titulo: string;
  contenido: string;
  prioridad: 'informativo' | 'importante' | 'urgente';
  ctaTexto: string | null;
  ctaUrl: string | null;
  yaVisto: boolean;
}

interface AlumnoPendienteDocs {
  id: number;
  nombreCompleto: string;
  docsFaltantes: number;
}

export default function GestorDashboard() {
  const [data, setData] = useState<DashboardGestor | null>(null);
  const [conv, setConv] = useState<Convocatoria | null>(null);
  const [alumnosPendientes, setAlumnosPendientes] = useState<AlumnoPendienteDocs[]>([]);
  const [anuncios, setAnuncios] = useState<AnuncioItem[]>([]);
  const [closedIds, setClosedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    api.get<DashboardGestor>('/gestor/dashboard').then(setData).catch(console.error);
    api
      .get<{ convocatoria: Convocatoria | null }>('/gestor/convocatoria-activa')
      .then((r) => setConv(r.convocatoria))
      .catch(console.error);
    api
      .get<{ alumnos: AlumnoPendienteDocs[] }>('/gestor/alumnos-pendientes-docs')
      .then((r) => setAlumnosPendientes(r.alumnos))
      .catch(console.error);
    api
      .get<{ anuncios: AnuncioItem[] }>('/anuncios/mios')
      .then((r) => setAnuncios(r.anuncios.filter(a => !a.yaVisto)))
      .catch(console.error);
  }, []);

  function cerrarAnuncio(id: number) {
    setClosedIds(prev => new Set(prev).add(id));
    api.post(`/anuncios/${id}/cerrar`).catch(console.error);
  }

  const visibleAnuncios = anuncios.filter(a => !closedIds.has(a.id));

  return (
    <GestorLayout>
      {/* Encabezado de página */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[var(--color-guinda-700)] font-semibold mb-1">
          <MapPin size={12} />
          {data?.municipio ?? '—'}
        </div>
        <h1 className="font-serif text-3xl font-bold text-stone-900">
          Hola, {data?.gestorNombre?.split(' ')[0] ?? 'Gestor'}
        </h1>
        <p className="text-stone-600 mt-1">
          Aquí tienes un resumen de tus alumnos y documentos pendientes.
        </p>
      </div>

      {/* Banners de anuncios */}
      {visibleAnuncios.map(a => {
        const colorMap = {
          urgente:    { bg: '#fff1f2', border: '#fecdd3', text: '#be123c', icon: '#f43f5e' },
          importante: { bg: '#fffbeb', border: '#fde68a', text: '#b45309', icon: '#f59e0b' },
          informativo:{ bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', icon: '#3b82f6' },
        };
        const c = colorMap[a.prioridad];
        return (
          <div key={a.id} className="mb-3" style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8, padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <Megaphone size={15} style={{ color: c.icon, flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: c.text, marginBottom: 2 }}>{a.titulo}</div>
              <div style={{ fontSize: 12, color: '#57534e', lineHeight: 1.4 }}>{a.contenido}</div>
              {a.ctaTexto && a.ctaUrl && (
                <a href={safeUrl(a.ctaUrl)} rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 6, fontSize: 11, fontWeight: 600, color: c.text, textDecoration: 'underline' }}>
                  {a.ctaTexto} →
                </a>
              )}
            </div>
            <button onClick={() => cerrarAnuncio(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a8a29e', flexShrink: 0, padding: 2 }}>
              <X size={13} />
            </button>
          </div>
        );
      })}

      {/* Banner: alumnos con documentos pendientes */}
      {alumnosPendientes.length > 0 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-md p-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-md bg-amber-100 flex items-center justify-center text-amber-700 flex-shrink-0 mt-0.5">
              <AlertCircle size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-amber-900 mb-2">
                {alumnosPendientes.length === 1
                  ? '1 alumno con documentos pendientes'
                  : `${alumnosPendientes.length} alumnos con documentos pendientes`}
              </div>
              <div className="flex flex-wrap gap-2">
                {alumnosPendientes.map((a) => (
                  <Link
                    key={a.id}
                    href={`/gestor/alumnos/${a.id}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-amber-300 rounded-full text-xs font-medium text-amber-800 hover:bg-amber-50 hover:border-amber-400 transition-colors"
                  >
                    {a.nombreCompleto.split(' ')[0]} — {a.docsFaltantes} doc{a.docsFaltantes > 1 ? 's' : ''}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Convocatoria activa */}
      {conv && (
        <div className="mb-6 bg-white border border-stone-200 rounded-md p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-md bg-[var(--color-crema-200)] flex items-center justify-center text-[var(--color-guinda-700)] flex-shrink-0">
            <Calendar size={18} />
          </div>
          <div className="flex-1">
            <div className="text-xs uppercase tracking-widest text-stone-500 font-semibold">
              Convocatoria activa
            </div>
            <div className="font-serif text-lg font-semibold text-stone-900">{conv.nombre}</div>
            <div className="text-sm text-stone-600 mt-0.5">
              Cierra el{' '}
              <strong className="text-stone-800">
                {new Date(conv.fechaCierre).toLocaleDateString('es-MX', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </strong>
              {conv.fechaExamen && (
                <>
                  {' · '}Examen el{' '}
                  <strong className="text-stone-800">
                    {new Date(conv.fechaExamen).toLocaleDateString('es-MX', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </strong>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <KpiCard
          icon={Users}
          label="Alumnos totales"
          value={data?.kpis.alumnosTotales ?? 0}
          accent="primary"
        />
        <KpiCard
          icon={FileCheck2}
          label="Con inscripción"
          value={data?.kpis.alumnosConInscripcion ?? 0}
          accent="neutral"
        />
        <KpiCard
          icon={FilePlus2}
          label="Documentos pendientes"
          value={data?.kpis.documentosPendientes ?? 0}
          accent="warning"
        />
      </div>

      {/* Accesos rápidos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ActionCard
          to="/gestor/alumnos/nuevo"
          icon={FilePlus2}
          title="Registrar nuevo alumno"
          desc="Captura los datos básicos y vincúlalo a la convocatoria activa."
        />
        <ActionCard
          to="/gestor/alumnos"
          icon={Users}
          title="Ver mis alumnos"
          desc="Revisa el estado y los documentos de cada uno."
        />
      </div>
    </GestorLayout>
  );
}

// ─────────────────────────────────────────────────────────────────────
function KpiCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  accent: 'primary' | 'neutral' | 'warning';
}) {
  const accentBg =
    accent === 'primary'
      ? 'bg-[var(--color-guinda-700)] text-white'
      : accent === 'warning'
        ? 'bg-amber-100 text-amber-800'
        : 'bg-stone-100 text-stone-700';
  return (
    <div className="bg-white border border-stone-200 rounded-md p-5">
      <div className="flex items-center justify-between mb-3">
        <div
          className={`w-9 h-9 rounded-md flex items-center justify-center ${accentBg}`}
          aria-hidden
        >
          <Icon size={18} />
        </div>
      </div>
      <div className="font-serif text-3xl font-bold text-stone-900">{value}</div>
      <div className="text-sm text-stone-600 mt-1">{label}</div>
    </div>
  );
}

function ActionCard({
  to,
  icon: Icon,
  title,
  desc,
}: {
  to: string;
  icon: typeof Users;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={to}
      className="group bg-white border border-stone-200 rounded-md p-5 hover:border-[var(--color-guinda-500)] hover:shadow-sm transition-all flex items-start gap-4"
    >
      <div className="w-10 h-10 rounded-md bg-[var(--color-crema-200)] flex items-center justify-center text-[var(--color-guinda-700)] flex-shrink-0">
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-serif text-lg font-semibold text-stone-900 mb-0.5">{title}</div>
        <div className="text-sm text-stone-600">{desc}</div>
      </div>
      <ArrowRight
        size={18}
        className="text-stone-400 group-hover:text-[var(--color-guinda-700)] group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-1"
      />
    </Link>
  );
}
