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
  BarChart2, HeartPulse, Eye, ShieldCheck,
} from 'lucide-react';
import { api } from '../../lib/api';

function apellido(nombre: string): string {
  const parts = nombre.trim().split(/\s+/);
  return parts[parts.length - 1] ?? nombre;
}

export function DireccionLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [nombre, setNombre] = useState('Dirección');

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
      color: active ? 'var(--color-guinda-800)' : '#44403c',
      fontWeight: active ? 600 : 400,
    };
  }

  const items = [
    { href: '/direccion',              icon: LayoutDashboard, label: 'Panorama' },
    { href: '/direccion/academico',    icon: GraduationCap,   label: 'Académico' },
    { href: '/direccion/operacion',    icon: Activity,        label: 'Operación' },
    { href: '/direccion/salud',        icon: HeartPulse,      label: 'Salud del sistema' },
    { href: '/direccion/proyecciones', icon: TrendingUp,      label: 'Proyecciones' },
    { href: '/direccion/reportes',     icon: BarChart2,       label: 'Reportes' },
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

      {/* Header */}
      <header
        className="bg-white sticky top-0 z-50"
        style={{ borderBottom: '4px solid var(--color-guinda-700)', padding: '16px 0' }}
      >
        <div className="max-w-[1400px] mx-auto px-6 flex items-center justify-between gap-6">
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
              <div className="text-xs" style={{ color: '#78716c', display: 'flex', alignItems: 'center', gap: 6 }}>
                Dirección de Programa · IEMSyS
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

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="text-right" style={{ lineHeight: 1.2 }}>
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
              onClick={handleLogout}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#78716c', padding: 6 }}
              title="Cerrar sesión"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <div
        className="max-w-[1400px] mx-auto px-6 py-6 grid gap-6"
        style={{ gridTemplateColumns: '240px 1fr', alignItems: 'start' }}
      >
        <aside
          className="bg-white border border-stone-200 rounded-lg overflow-hidden sticky"
          style={{ top: 96 }}
        >
          <div className="px-[18px] py-3.5" style={{ background: 'var(--color-guinda-700)', color: 'white' }}>
            <div className="text-[10px] uppercase tracking-widest" style={{ opacity: 0.8 }}>PANEL</div>
            <div className="text-[15px] font-bold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Dirección
            </div>
          </div>

          <div className="py-1.5 border-t border-stone-100">
            <div
              className="text-[10px] uppercase tracking-widest font-bold px-[18px] pt-2 pb-1.5"
              style={{ color: '#78716c', letterSpacing: '0.12em' }}
            >
              INDICADORES
            </div>
            <ul className="list-none">
              {items.map(({ href, icon: Icon, label }) => (
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

          <div className="px-[18px] py-3 border-t border-stone-100" style={{ fontSize: 10.5, color: '#78716c', lineHeight: 1.5 }}>
            Este perfil muestra únicamente datos agregados del programa. No da
            acceso a expedientes ni datos personales de alumnos.
          </div>
        </aside>

        <main style={{ minWidth: 0 }}>
          {children}
        </main>
      </div>

      <footer className="bg-white" style={{ borderTop: '1px solid #e7e5e4' }}>
        <div className="max-w-[1400px] mx-auto px-6 py-4 text-xs text-stone-500 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>© {new Date().getFullYear()} Gobierno del Estado de Michoacán</div>
          <div style={{ fontWeight: 500 }}>
            Powered by <strong style={{ color: 'var(--color-guinda-700)' }}>EDUMICH</strong> · Plataforma Educativa Digital
          </div>
          <div style={{ opacity: 0.7 }}>Dirección de Programa · IEMSyS</div>
        </div>
      </footer>
    </div>
  );
}

// ── Piezas compartidas del portal de dirección ──────────────────────────────

export function TarjetaKPI({
  etiqueta, valor, sub, acento,
}: { etiqueta: string; valor: string | number; sub?: string; acento?: string }) {
  return (
    <div className="bg-white border border-stone-200 rounded-lg p-4">
      <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: '#78716c' }}>
        {etiqueta}
      </div>
      <div
        className="font-bold mt-1"
        style={{ fontSize: 26, color: acento ?? '#2a2a2a', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        {valor}
      </div>
      {sub && <div className="text-[11px] mt-0.5" style={{ color: '#a8a29e' }}>{sub}</div>}
    </div>
  );
}

export function SeccionCard({
  titulo, sub, children,
}: { titulo: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-stone-200 rounded-lg p-5">
      <div className="mb-4">
        <div className="text-sm font-bold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{titulo}</div>
        {sub && <div className="text-[11px] mt-0.5" style={{ color: '#78716c' }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}
