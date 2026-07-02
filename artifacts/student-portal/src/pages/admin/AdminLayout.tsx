import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import {
  LogOut, Users, UserCheck, Inbox, Calendar, BarChart2, Settings,
  Home, Bell, Search, Megaphone, FileText, CreditCard, UserPlus,
  CheckCircle, XCircle, Star, ChevronRight, Mail, ScanLine,
} from 'lucide-react';
import { api } from '../../lib/api';
import { safeUrl } from '../../lib/safeUrl';

// ── Types ──────────────────────────────────────────────────────────────────────

type SidebarSnapshot = {
  nombreAdmin: string;
  totalAlumnos: number;
  totalGestores: number;
  solicitudesPendientes: number;
  pagosPendientes: number;
};

type Notif = {
  id: number;
  tipo: string;
  prioridad: 'baja' | 'normal' | 'alta' | 'urgente';
  titulo: string;
  cuerpo: string;
  enlace: string | null;
  leida: boolean;
  creadaEn: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function apellido(nombre: string): string {
  const parts = nombre.trim().split(/\s+/);
  return parts[parts.length - 1] ?? nombre;
}

function tiempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

const PRIORIDAD_COLOR: Record<string, string> = {
  baja: '#a89a8e',
  normal: '#2563eb',
  alta: '#d97706',
  urgente: '#dc2626',
};

const TIPO_ICONO: Record<string, React.ComponentType<{ size?: number }>> = {
  solicitud_nueva: UserPlus,
  documento_subido_revisar: FileText,
  pago_subido_verificar: CreditCard,
  documento_aprobado: CheckCircle,
  documento_rechazado: XCircle,
  pago_verificado: CheckCircle,
  matricula_asignada: Star,
  alumno_asignado: UserPlus,
  anuncio_dirigido: Megaphone,
};

function NotifIcon({ tipo }: { tipo: string }) {
  const Icon = TIPO_ICONO[tipo] ?? Bell;
  return <Icon size={14} />;
}

function NotifItem({ notif, onLeer }: { notif: Notif; onLeer: (id: number) => void }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        padding: '10px 14px',
        background: notif.leida ? 'transparent' : '#fdf8f0',
        borderBottom: '1px solid #f7f2ed',
        cursor: 'pointer',
      }}
      onClick={() => {
        if (!notif.leida) onLeer(notif.id);
        if (notif.enlace) window.location.href = safeUrl(notif.enlace);
      }}
    >
      <div
        style={{
          width: 3,
          borderRadius: 2,
          flexShrink: 0,
          background: PRIORIDAD_COLOR[notif.prioridad] ?? '#a89a8e',
          alignSelf: 'stretch',
        }}
      />
      <div style={{ color: PRIORIDAD_COLOR[notif.prioridad] ?? '#6b635e', flexShrink: 0, marginTop: 1 }}>
        <NotifIcon tipo={notif.tipo} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: notif.leida ? 400 : 600, color: '#2a2a2a', lineHeight: 1.3 }}>
          {notif.titulo}
        </div>
        <div style={{ fontSize: 11, color: '#6b635e', marginTop: 2, lineHeight: 1.4 }}>
          {notif.cuerpo}
        </div>
        <div style={{ fontSize: 10, color: '#a89a8e', marginTop: 3 }}>
          {tiempoRelativo(notif.creadaEn)}
        </div>
      </div>
    </div>
  );
}

function NotifBell() {
  const [noLeidas, setNoLeidas] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const cargarContador = () => {
    api.get<{ noLeidas: number }>('/notificaciones/contador')
      .then(r => setNoLeidas(r.noLeidas))
      .catch(() => {});
  };

  const cargarNotifs = () => {
    api.get<{ notificaciones: Notif[] }>('/notificaciones?limit=8')
      .then(r => setNotifs(r.notificaciones))
      .catch(() => {});
  };

  useEffect(() => {
    cargarContador();
    const interval = setInterval(cargarContador, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (open) cargarNotifs();
  }, [open]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function marcarLeida(id: number) {
    api.put(`/notificaciones/${id}/leer`, {}).catch(() => {});
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n));
    setNoLeidas(prev => Math.max(0, prev - 1));
  }

  function marcarTodas() {
    api.put('/notificaciones/leer-todas', {}).catch(() => {});
    setNotifs(prev => prev.map(n => ({ ...n, leida: true })));
    setNoLeidas(0);
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="relative w-[38px] h-[38px] rounded-lg border flex items-center justify-center"
        style={{ background: open ? '#f0eae0' : '#f8f4ec', borderColor: '#eadfd7', color: '#443e39' }}
      >
        <Bell size={14} />
        {noLeidas > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 5,
              right: 5,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              background: 'var(--color-guinda-700)',
              color: 'white',
              fontSize: 9,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 3px',
              border: '2px solid white',
            }}
          >
            {noLeidas > 99 ? '99+' : noLeidas}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            width: 340,
            background: 'white',
            border: '1px solid #eadfd7',
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            zIndex: 200,
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #f7f2ed', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#2a2a2a' }}>
              Notificaciones {noLeidas > 0 && <span style={{ color: 'var(--color-guinda-700)' }}>({noLeidas})</span>}
            </span>
            {noLeidas > 0 && (
              <button
                onClick={marcarTodas}
                style={{ fontSize: 11, color: 'var(--color-guinda-700)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Marcar todas leídas
              </button>
            )}
          </div>

          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {notifs.length === 0 ? (
              <div style={{ padding: '24px 14px', textAlign: 'center', color: '#a89a8e', fontSize: 13 }}>
                Sin notificaciones
              </div>
            ) : (
              notifs.map(n => <NotifItem key={n.id} notif={n} onLeer={marcarLeida} />)
            )}
          </div>

          <a
            href="/notificaciones"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              padding: '10px 14px',
              borderTop: '1px solid #f7f2ed',
              fontSize: 12,
              color: 'var(--color-guinda-700)',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Ver todas las notificaciones <ChevronRight size={12} />
          </a>
        </div>
      )}
    </div>
  );
}

function SidebarBadge({ count }: { count: number; muted?: boolean }) {
  if (count === 0) return null;
  return (
    <span
      className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
      style={{ background: 'var(--color-guinda-800)', color: 'white' }}
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
    pagosPendientes: 0,
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
          pagosPendientes: r?.tareasPendientes?.pagosPorVerificar ?? prev.pagosPendientes,
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
      color: active ? 'var(--color-guinda-800)' : '#443e39',
      fontWeight: active ? 600 : 400,
    };
  }

  const personasItems = [
    { href: '/admin/alumnos',    icon: Users,    label: 'Alumnos',    badge: sidebar.totalAlumnos,    muted: true },
    { href: '/admin/gestores',   icon: UserCheck, label: 'Gestores',  badge: sidebar.totalGestores,   muted: true },
    { href: '/admin/solicitudes', icon: Inbox,   label: 'Solicitudes', badge: sidebar.solicitudesPendientes, muted: false },
  ];

  const otrosItems = [
    { href: '/admin/pagos',      icon: CreditCard, label: 'Pagos',   badge: sidebar.pagosPendientes, muted: false },
    { href: '/admin/verificacion-pase', icon: ScanLine,  label: 'Verificación de pase' },
    { href: '/admin/convocatorias', icon: Calendar,   label: 'Convocatorias' },
    { href: '/admin/anuncios',      icon: Megaphone,  label: 'Anuncios' },
    { href: '/admin/correos-enviados', icon: Mail,    label: 'Correos enviados' },
    { href: '/admin/reportes',      icon: BarChart2,  label: 'Reportes' },
    { href: '/admin/configuracion', icon: Settings,   label: 'Configuración' },
  ];

  return (
    <div className="min-h-screen" style={{ background: '#f2ece5', fontFamily: "'Poppins', sans-serif", color: '#2a2a2a' }}>

      {/* Banda gobierno */}
      <div
        className="flex justify-between items-center text-white text-[11px] font-medium"
        style={{ background: 'var(--color-guinda-800)', padding: '6px 16px', letterSpacing: '0.05em' }}
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
            <div style={{ fontFamily: "'Poppins', sans-serif", lineHeight: 1.15 }}>
              <div className="text-sm font-semibold" style={{ color: 'var(--color-guinda-800)' }}>Gobierno de Michoacán</div>
              <div className="text-[9px] uppercase tracking-widest" style={{ color: '#6b635e', marginTop: 2 }}>HONESTIDAD Y TRABAJO</div>
            </div>
            <div className="w-px h-9" style={{ background: '#ddd0c5' }} />
            <div style={{ fontFamily: "'Poppins', sans-serif", lineHeight: 1.15 }}>
              <div className="text-base font-bold tracking-tight" style={{ color: '#2a2a2a' }}>Prepa Abierta</div>
              <div className="text-xs" style={{ color: '#6b635e', display: 'flex', alignItems: 'center', gap: 6 }}>
                Sistema de Gestión · IEMSyS
                <span style={{
                  display: 'inline-flex', alignItems: 'center',
                  background: '#f8e8ef', color: 'var(--color-guinda-700)',
                  border: '1px solid #e8c4d4', borderRadius: 4,
                  padding: '1px 5px', fontSize: 9, fontWeight: 800, letterSpacing: '0.06em',
                }}>
                  EDUMICH
                </span>
              </div>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#6b635e' }} />
              <input
                className="pl-9 pr-3 py-2 text-[13px] rounded-lg border w-72"
                style={{ background: '#f8f4ec', borderColor: '#eadfd7', color: '#443e39' }}
                placeholder="Buscar alumno, gestor, folio..."
              />
            </div>
            <NotifBell />
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
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b635e', padding: 6 }}
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
          <div className="px-[18px] py-3.5" style={{ background: 'var(--color-guinda-800)', color: 'white' }}>
            <div className="text-[10px] uppercase tracking-widest" style={{ opacity: 0.8 }}>PANEL</div>
            <div className="text-[15px] font-bold" style={{ fontFamily: "'Poppins', sans-serif" }}>
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
              style={{ color: 'var(--color-dorado)', letterSpacing: '0.14em' }}
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
              style={{ color: 'var(--color-dorado)', letterSpacing: '0.14em' }}
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

      <footer className="bg-white" style={{ borderTop: '1px solid #eadfd7', marginTop: 0 }}>
        <div className="max-w-[1400px] mx-auto px-6 py-4 text-xs text-stone-500 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>© {new Date().getFullYear()} Gobierno del Estado de Michoacán</div>
          <div style={{ fontWeight: 500 }}>
            Powered by <strong style={{ color: 'var(--color-guinda-700)' }}>EDUMICH</strong> · Plataforma Educativa Digital
          </div>
          <div style={{ opacity: 0.7 }}>v0.1 (demo) · IEMSyS</div>
        </div>
      </footer>
    </div>
  );
}
