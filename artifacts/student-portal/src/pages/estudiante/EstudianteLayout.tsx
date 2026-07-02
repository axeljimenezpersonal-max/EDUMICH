import { Link, useLocation } from 'wouter';
import { useEffect, useState, type ReactNode } from 'react';
import { LayoutDashboard, BookOpen, FolderOpen, Calendar, BadgeCheck, ClipboardList } from 'lucide-react';
import { api, type MeResponse } from '../../lib/api';
import { InstitutionalHeader } from '../../components/InstitutionalHeader';

const NAV = [
  { to: '/estudiante', label: 'Inicio', icon: LayoutDashboard },
  { to: '/estudiante/expediente', label: 'Expediente', icon: FolderOpen },
  { to: '/estudiante/cedula', label: 'Cédula', icon: ClipboardList },
  { to: '/estudiante/convocatoria', label: 'Inscripción', icon: Calendar },
  { to: '/estudiante/modulos', label: 'Módulos', icon: BookOpen },
  { to: '/estudiante/identificacion', label: 'ID', icon: BadgeCheck },
];

export function EstudianteLayout({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const [location] = useLocation();
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    api
      .get<MeResponse>('/auth/me')
      .then((u) => {
        if (u.rol !== 'estudiante') {
          setLocation('/login');
          return;
        }
        if (u.passwordTemporal) {
          setLocation('/estudiante/cambiar-password');
          return;
        }
        setMe(u);
      })
      .catch(() => setLocation('/login'));
  }, [setLocation]);

  async function handleLogout() {
    await api.post('/auth/logout');
    setLocation('/login');
  }

  return (
    <div className="min-h-screen bg-[var(--color-crema-100)] flex flex-col">
      <InstitutionalHeader
        userName={me?.perfil?.nombreCompleto ?? me?.email}
        userRole="Estudiante"
        userPhotoUrl="/api/estudiante/mi-foto"
        onLogout={handleLogout}
      />

      <div className="flex-1 max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 sm:gap-6 w-full pb-20 md:pb-6">
        {/* Sidebar — solo visible en md+ */}
        <nav className="hidden md:block md:sticky md:top-[114px] self-start">
          <div className="bg-white border border-stone-200 rounded-md overflow-hidden">
            <div className="px-4 py-3 bg-[var(--color-guinda-800)] text-white">
              <div className="text-[10px] tracking-widest opacity-80">PORTAL</div>
              <div className="font-serif text-sm">Estudiante</div>
            </div>
            <ul>
              {NAV.map((item) => {
                const active =
                  item.to === '/estudiante'
                    ? location === '/estudiante'
                    : location.startsWith(item.to);
                return (
                  <li key={item.to}>
                    <Link
                      href={item.to}
                      className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors border-l-4 ${
                        active
                          ? 'bg-[var(--color-crema-100)] border-[var(--color-guinda-700)] text-[var(--color-guinda-800)] font-semibold'
                          : 'border-transparent text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      <item.icon size={16} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        {/* Contenido */}
        <main className="min-w-0">{children}</main>
      </div>

      {/* Bottom tab bar — solo en móvil */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-stone-200"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-stretch">
          {NAV.map((item) => {
            const active =
              item.to === '/estudiante'
                ? location === '/estudiante'
                : location.startsWith(item.to);
            return (
              <Link key={item.to} href={item.to} className="flex-1">
                <div
                  className={`flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                    active
                      ? 'text-[var(--color-guinda-700)]'
                      : 'text-stone-400'
                  }`}
                >
                  <item.icon size={20} />
                  <span className="text-[9px] font-semibold tracking-wide leading-none">
                    {item.label}
                  </span>
                  {active && (
                    <span className="absolute top-0 left-0 right-0 h-0.5 bg-[var(--color-guinda-700)]" />
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </nav>

      <footer className="hidden md:block border-t border-stone-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 py-4 text-xs text-stone-500 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>© {new Date().getFullYear()} Gobierno del Estado de Michoacán</div>
          <div style={{ fontWeight: 500 }}>
            Powered by <strong style={{ color: 'var(--color-guinda-700)' }}>EDUMICH</strong> · Plataforma Educativa Digital
          </div>
          <div className="opacity-70">v0.1 (demo) · IEMSyS</div>
        </div>
      </footer>
    </div>
  );
}
