import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import {
  LogOut, Users, UserCheck, Inbox, Calendar, BarChart2, Settings,
  Home, Bell, Search,
} from 'lucide-react';
import { api } from '../../lib/api';

// ── Types ──────────────────────────────────────────────────────────────────────

type SidebarSnapshot = {
  nombreAdmin: string;
  totalAlumnos: number;
  totalGestores: number;
  solicitudesPendientes: number;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function apellido(nombre: string): string {
  const parts = nombre.trim().split(/\s+/);
  return parts[parts.length - 1] ?? nombre;
}

function SidebarBadge({ count, muted = false }: { count: number; muted?: boolean }) {
  if (count === 0) return null;
  return (
    <span
      className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
      style={{
        background: muted ? '#d6d3d1' : 'var(--color-guinda-700)',
        color: muted ? '#44403c' : 'white',
      }}
    >
      {count}
    </span>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [sidebar, setSidebar] = useState<SidebarSnapshot>({
    nombreAdmin: 'Administrador',
    totalAlumnos: 0,
    totalGestores: 0,
    solicitudesPendientes: 0,
  });

  useEffect(() => {
    // Lightweight load: use the existing count endpoint immediately for the badge
    api.get<{ pendientes: number }>('/admin/solicitudes-cuenta/count')
      .then((r) => setSidebar((prev) => ({ ...prev, solicitudesPendientes: r.pendientes })))
      .catch(() => {});

    // Full dashboard for richer sidebar data (nombre + counts)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    api.get<any>('/admin/dashboard')
      .then((r) => {
        setSidebar((prev) => ({
          ...prev,
          nombreAdmin: r?.greeting?.nombreAdmin ?? prev.nombreAdmin,
          totalAlumnos: r?.kpisGenerales?.alumnosActivos?.total ?? prev.totalAlumnos,
          totalGestores: r?.kpisGenerales?.gestoresActivos?.total ?? prev.totalGestores,
          solicitudesPendientes: r?.tareasPendientes?.solicitudesCuenta ?? prev.solicitudesPendientes,
        }));
      })
      .catch(() => {});
  }, []);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    setLocation('/login');
  }

  function isActive(href: string, exact = false): boolean {
    if (exact || href === '/admin') return location === href;
    return location.startsWith(href);
  }

  function linkStyle(href: string, exact = false): React.CSSProperties {
    const active = isActive(href, exact);
    return {
      borderLeftColor: active ? 'var(--color-guinda-700)' : 'transparent',
      background: active ? '#f8f4ec' : 'transparent',
      color: active ? 'var(--color-guinda-800)' : '#44403c',
      fontWeight: active ? 600 : 400,
    };
  }

  const personasItems = [
    { href: '/admin/alumnos',    icon: Users,    label: 'Alumnos',    badge: sidebar.totalAlumnos,    muted: true },
    { href: '/admin/gestores',   icon: UserCheck, label: 'Gestores',  badge: sidebar.totalGestores,   muted: true },
    { href: '/admin/solicitudes', icon: Inbox,   label: 'Solicitudes', badge: sidebar.solicitudesPendientes, muted: false },
  ];

  const otrosItems = [
    { href: '/admin/convocatorias', icon: Calendar,  label: 'Convocatorias' },
    { href: '/admin/reportes',      icon: BarChart2, label: 'Reportes' },
    { href: '/admin/configuracion', icon: Settings,  label: 'Configuración' },
  ];

  return (
    <div className="min-h-screen" style={{ background: '#ececec', fontFamily: "'Inter', sans-serif", color: '#2a2a2a' }}>

      {/* Banda gobierno */}
      <div
        className="flex justify-between items-center text-white text-[11px] font-medium"
        style={{ background: 'var(--color-guinda-700)', padding: '6px 16px', letterSpacing: '0.05em' }}
      >
        <span>GOBIERNO DEL ESTADO DE MICHOACÁN · HONESTIDAD Y TRABAJO</span>
        <span style={{ opacity: 0.7 }}>prepaabierta.michoacan.gob.mx</span>
      </div>

      {/* Sticky app header */}
      <header
        className="bg-white sticky top-0 z-50"
        style={{ borderBottom: '4px solid var(--color-guinda-700)', padding: '16px 0' }}
      >
        <div className="max-w-[1400px] mx-auto px-6 flex items-center justify-between gap-6">

          {/* Brand */}
          <div className="flex items-center gap-4">
            <img
              src="/logo-see-michoacan-256.png"
              alt="Secretaría de Educación de Michoacán"
              className="brand-logo-img flex-shrink-0"
            />
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1.15 }}>
              <div className="text-sm font-semibold" style={{ color: 'var(--color-guinda-800)' }}>Gobierno de Michoacán</div>
              <div className="text-[9px] uppercase tracking-widest" style={{ color: '#78716c', marginTop: 2 }}>HONESTIDAD Y TRABAJO</div>
            </div>
            <div className="w-px h-9" style={{ background: '#d6d3d1' }} />
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1.15 }}>
              <div className="text-base font-bold tracking-tight" style={{ color: '#2a2a2a' }}>Prepa Abierta</div>
              <div className="text-xs" style={{ color: '#78716c' }}>Sistema de Gestión · IEMSyS</div>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#78716c' }} />
              <input
                className="pl-9 pr-3 py-2 text-[13px] rounded-lg border w-72"
                style={{ background: '#f8f4ec', borderColor: '#e7e5e4', color: '#44403c' }}
                placeholder="Buscar alumno, gestor, folio..."
              />
            </div>
            <button
              className="relative w-[38px] h-[38px] rounded-lg border flex items-center justify-center"
              style={{ background: '#f8f4ec', borderColor: '#e7e5e4', color: '#44403c' }}
            >
              <Bell size={14} />
              {sidebar.solicitudesPendientes > 0 && (
                <span
                  className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full border-2 border-white"
                  style={{ background: 'var(--color-guinda-700)' }}
                />
              )}
            </button>
            <div className="flex items-center gap-2.5">
              <div className="text-right" style={{ lineHeight: 1.2 }}>
                <div className="text-[13px] font-semibold" style={{ color: '#2a2a2a' }}>
                  {apellido(sidebar.nombreAdmin)}
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-guinda-700)', letterSpacing: '0.1em' }}>
                  Administrador
                </div>
              </div>
              <div
                className="w-[38px] h-[38px] rounded-full flex items-center justify-center"
                style={{ background: '#efe7d6', color: 'var(--color-guinda-700)' }}
              >
                <UserCheck size={16} />
              </div>
            </div>
            <button
              onClick={handleLogout}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#78716c', padding: 6 }}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Body: sidebar + content */}
      <div
        className="max-w-[1400px] mx-auto px-6 py-6 grid gap-6"
        style={{ gridTemplateColumns: '240px 1fr', alignItems: 'start' }}
      >
        {/* ── Sidebar ── */}
        <aside
          className="bg-white border border-stone-200 rounded-lg overflow-hidden sticky"
          style={{ top: 96 }}
        >
          {/* Header */}
          <div className="px-[18px] py-3.5" style={{ background: 'var(--color-guinda-700)', color: 'white' }}>
            <div className="text-[10px] uppercase tracking-widest" style={{ opacity: 0.8 }}>PANEL</div>
            <div className="text-[15px] font-bold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Administración
            </div>
          </div>

          {/* Inicio */}
          <div className="py-1.5 border-t border-stone-100">
            <ul className="list-none">
              <li>
                <a
                  href="/admin"
                  className="flex items-center gap-2.5 px-[18px] py-2.5 text-[13px] border-l-[3px] no-underline"
                  style={linkStyle('/admin', true)}
                >
                  <Home size={14} /> Inicio
                </a>
              </li>
            </ul>
          </div>

          {/* PERSONAS */}
          <div className="py-1.5 border-t border-stone-100">
            <div
              className="text-[10px] uppercase tracking-widest font-bold px-[18px] pt-2 pb-1.5"
              style={{ color: '#78716c', letterSpacing: '0.12em' }}
            >
              PERSONAS
            </div>
            <ul className="list-none">
              {personasItems.map(({ href, icon: Icon, label, badge, muted }) => (
                <li key={href}>
                  <a
                    href={href}
                    className="flex items-center gap-2.5 px-[18px] py-2.5 text-[13px] border-l-[3px] no-underline"
                    style={linkStyle(href)}
                  >
                    <Icon size={14} /> {label}
                    <SidebarBadge count={badge} muted={muted} />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* OTROS */}
          <div className="py-1.5 border-t border-stone-100">
            <div
              className="text-[10px] uppercase tracking-widest font-bold px-[18px] pt-2 pb-1.5"
              style={{ color: '#78716c', letterSpacing: '0.12em' }}
            >
              OTROS
            </div>
            <ul className="list-none">
              {otrosItems.map(({ href, icon: Icon, label }) => (
                <li key={href}>
                  <a
                    href={href}
                    className="flex items-center gap-2.5 px-[18px] py-2.5 text-[13px] border-l-[3px] no-underline"
                    style={linkStyle(href)}
                  >
                    <Icon size={14} /> {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* ── Page content ── */}
        <main style={{ minWidth: 0 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
