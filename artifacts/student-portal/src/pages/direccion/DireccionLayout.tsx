/**
 * Layout del portal de DIRECCIÓN DE PROGRAMA.
 *
 * Perfil ejecutivo de solo lectura: indicadores, proyecciones, salud del
 * sistema y reportes. No expone acciones operativas ni datos personales.
 */

import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import {
  LogOut, LayoutDashboard, GraduationCap, Activity, TrendingUp,
  BarChart2, HeartPulse, Eye, ShieldCheck, HelpCircle, Menu, X, MousePointerClick,
} from 'lucide-react';
import { api } from '../../lib/api';
import { AppFooter } from '../../components/AppFooter';
import { OnboardingTour } from '../../components/onboarding/OnboardingTour';

function apellido(nombre: string): string {
  const parts = nombre.trim().split(/\s+/);
  return parts[parts.length - 1] ?? nombre;
}

export function DireccionLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [nombre, setNombre] = useState('Dirección');
  const [menuAbierto, setMenuAbierto] = useState(false);

  // Al navegar, el cajón móvil se cierra solo: los enlaces son <a> y en móvil
  // el usuario espera que la pantalla nueva llegue sin el menú encima.
  useEffect(() => { setMenuAbierto(false); }, [location]);

  useEffect(() => {
    api.get<{ perfil?: { nombreCompleto?: string } }>('/auth/me')
      .then((r) => setNombre(r.perfil?.nombreCompleto ?? 'Dirección'))
      .catch(() => {});
  }, []);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    setLocation('/login');
  }

  function isActive(href: string): boolean {
    if (href === '/direccion') return location === href;
    return location.startsWith(href);
  }

  function linkStyle(href: string): React.CSSProperties {
    const active = isActive(href);
    return {
      borderLeftColor: active ? 'var(--color-guinda-700)' : 'transparent',
      background: active ? '#f8f4ec' : 'transparent',
      color: active ? 'var(--color-guinda-800)' : '#443e39',
      fontWeight: active ? 600 : 400,
    };
  }

  const items = [
    { href: '/direccion',              icon: LayoutDashboard, label: 'Panorama',          tour: 'nav-panorama' },
    { href: '/direccion/academico',    icon: GraduationCap,   label: 'Académico',         tour: 'nav-academico' },
    { href: '/direccion/operacion',    icon: Activity,        label: 'Operación',         tour: 'nav-operacion' },
    { href: '/direccion/salud',        icon: HeartPulse,      label: 'Salud del sistema', tour: 'nav-salud' },
    { href: '/direccion/proyecciones', icon: TrendingUp,      label: 'Proyecciones',      tour: 'nav-proyecciones' },
    { href: '/direccion/reportes',     icon: BarChart2,       label: 'Reportes',          tour: 'nav-reportes' },
    { href: '/direccion/uso',          icon: MousePointerClick, label: 'Uso de la plataforma', tour: 'nav-uso' },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f2ece5', fontFamily: "'Poppins', sans-serif", color: '#2a2a2a' }}>


      {/* Header */}
      <header
        className="bg-white sticky top-0 z-50"
        style={{ borderBottom: '4px solid var(--color-guinda-700)', padding: '16px 0' }}
      >
        <div className="max-w-[1400px] mx-auto px-3 sm:px-6 flex items-center justify-between gap-3 sm:gap-6">
          <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
            {/* Menú (solo móvil): abre el cajón con las 6 secciones */}
            <button
              onClick={() => setMenuAbierto(true)}
              aria-label="Abrir menú"
              className="md:hidden flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border"
              style={{ borderColor: '#eadfd7', color: 'var(--color-guinda-700)', background: '#faf6f0' }}
            >
              <Menu size={19} />
            </button>
            <img
              src="/logo-see-michoacan-256.png"
              alt="Secretaría de Educación de Michoacán"
              className="brand-logo-img flex-shrink-0 hidden sm:block"
            />
            <div className="hidden lg:block" style={{ fontFamily: "'Poppins', sans-serif", lineHeight: 1.15 }}>
              <div className="text-sm font-semibold" style={{ color: 'var(--color-guinda-800)' }}>Gobierno de Michoacán</div>
              <div className="text-[9px] uppercase tracking-widest" style={{ color: '#6b635e', marginTop: 2 }}>HONESTIDAD Y TRABAJO</div>
            </div>
            <div className="w-px h-9 hidden lg:block" style={{ background: '#ddd0c5' }} />
            <div className="min-w-0" style={{ fontFamily: "'Poppins', sans-serif", lineHeight: 1.15 }}>
              <div className="text-base font-bold tracking-tight" style={{ color: '#2a2a2a' }}>Modula · Plan 22</div>
              <div className="text-xs" style={{ color: '#6b635e', display: 'flex', alignItems: 'center', gap: 6 }}>
                {/* En móvil sobra la prosa, pero el sello de SOLO LECTURA no:
                    es lo que le recuerda al titular que aquí no puede tocar nada. */}
                <span className="hidden sm:inline">Preparatoria Abierta · Dirección de Programa</span>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: '#eef4ee', color: '#166534',
                  border: '1px solid #c9dfc9', borderRadius: 4,
                  padding: '1px 5px', fontSize: 9, fontWeight: 800, letterSpacing: '0.06em',
                }}>
                  <Eye size={9} /> SOLO LECTURA
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="text-right hidden sm:block" style={{ lineHeight: 1.2 }}>
                <div className="text-[13px] font-semibold" style={{ color: '#2a2a2a' }}>
                  {apellido(nombre)}
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-guinda-700)', letterSpacing: '0.1em' }}>
                  Dirección
                </div>
              </div>
              <div
                className="w-[38px] h-[38px] rounded-full flex items-center justify-center"
                style={{ background: '#efe7d6', color: 'var(--color-guinda-700)' }}
              >
                <ShieldCheck size={16} />
              </div>
            </div>
            <button
              data-tour="help-button"
              onClick={() => window.dispatchEvent(new Event('modula:start-tour'))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b635e', padding: 6 }}
              aria-label="Ver tutorial guiado"
              title="Ver tutorial guiado"
            >
              <HelpCircle size={14} />
            </button>
            <button
              onClick={handleLogout}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b635e', padding: 6 }}
              title="Cerrar sesión"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="w-full max-w-[1400px] mx-auto px-3 sm:px-6 py-4 sm:py-6 grid gap-6 flex-1 grid-cols-1 md:grid-cols-[240px_1fr] items-start">

        {/* ── Cajón móvil: las mismas 6 secciones, deslizando desde la izquierda ── */}
        {menuAbierto && (
          <div className="fixed inset-0 z-[60] md:hidden">
            <div
              className="absolute inset-0"
              style={{ background: 'rgba(28,10,18,0.5)' }}
              onClick={() => setMenuAbierto(false)}
            />
            <div
              className="absolute inset-y-0 left-0 w-[290px] max-w-[85vw] overflow-y-auto bg-white shadow-2xl"
              style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
              role="dialog"
              aria-label="Menú de dirección"
            >
              <div className="flex items-center justify-between px-[18px] py-3.5" style={{ background: 'var(--color-guinda-800)', color: 'white' }}>
                <div>
                  <div className="text-[10px] uppercase tracking-widest" style={{ opacity: 0.8 }}>PANEL</div>
                  <div className="text-[15px] font-bold">Dirección</div>
                </div>
                <button
                  onClick={() => setMenuAbierto(false)}
                  aria-label="Cerrar menú"
                  className="flex h-9 w-9 items-center justify-center rounded-full"
                  style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', cursor: 'pointer' }}
                >
                  <X size={17} />
                </button>
              </div>
              <SeccionesDireccion items={items} linkStyle={linkStyle} />
            </div>
          </div>
        )}

        {/* ── Sidebar (tablet/escritorio) — con scroll propio para pantallas bajitas ── */}
        <aside
          className="bg-white border border-stone-200 rounded-lg sticky hidden md:block overflow-y-auto"
          style={{ top: 96, maxHeight: 'calc(100vh - 112px)' }}
        >
          <div className="px-[18px] py-3.5" style={{ background: 'var(--color-guinda-800)', color: 'white' }}>
            <div className="text-[10px] uppercase tracking-widest" style={{ opacity: 0.8 }}>PANEL</div>
            <div className="text-[15px] font-bold" style={{ fontFamily: "'Poppins', sans-serif" }}>
              Dirección
            </div>
          </div>

          <SeccionesDireccion items={items} linkStyle={linkStyle} />
        </aside>

        <main style={{ minWidth: 0 }}>
          {children}
        </main>
      </div>

      <AppFooter />

      <OnboardingTour rol="direccion" nombre={nombre} />
    </div>
  );
}

// ── Piezas compartidas del portal de dirección ──────────────────────────────

type ItemNav = {
  href: string;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  tour: string;
};

/**
 * Las secciones del panel. Una sola definición que sirve a la sidebar de
 * escritorio y al cajón móvil — si se separan, se desincronizan.
 */
function SeccionesDireccion({
  items, linkStyle,
}: { items: ItemNav[]; linkStyle: (href: string) => React.CSSProperties }) {
  return (
    <>
      <div className="py-1.5 border-t border-stone-100">
        <div
          className="text-[10px] uppercase tracking-widest font-bold px-[18px] pt-2 pb-1.5"
          style={{ color: 'var(--color-dorado)', letterSpacing: '0.14em' }}
        >
          INDICADORES
        </div>
        <ul className="list-none">
          {items.map(({ href, icon: Icon, label, tour }) => (
            <li key={href}>
              <a
                href={href}
                data-tour={tour}
                className="flex items-center gap-2.5 px-[18px] py-2.5 text-[13px] border-l-[3px] no-underline"
                style={linkStyle(href)}
              >
                <Icon size={14} /> {label}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div className="px-[18px] py-3 border-t border-stone-100" style={{ fontSize: 10.5, color: '#6b635e', lineHeight: 1.5 }}>
        Este perfil muestra únicamente datos agregados del programa. No da
        acceso a expedientes ni datos personales de alumnos.
      </div>
    </>
  );
}

export function TarjetaKPI({
  etiqueta, valor, sub, acento,
}: { etiqueta: string; valor: string | number; sub?: string; acento?: string }) {
  return (
    <div className="bg-white border border-stone-200 rounded-lg p-4">
      <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: '#6b635e' }}>
        {etiqueta}
      </div>
      <div
        className="font-bold mt-1"
        style={{ fontSize: 26, color: acento ?? '#2a2a2a', fontFamily: "'Poppins', sans-serif" }}
      >
        {valor}
      </div>
      {sub && <div className="text-[11px] mt-0.5" style={{ color: '#a89a8e' }}>{sub}</div>}
    </div>
  );
}

export function SeccionCard({
  titulo, sub, children,
}: { titulo: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-stone-200 rounded-lg p-5">
      <div className="mb-4">
        <div className="text-sm font-bold" style={{ fontFamily: "'Poppins', sans-serif" }}>{titulo}</div>
        {sub && <div className="text-[11px] mt-0.5" style={{ color: '#6b635e' }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}
