import { Link, useLocation } from 'wouter';
import { useEffect, useState, type ReactNode } from 'react';
import { LayoutDashboard, BookOpen, FolderOpen, Calendar, BadgeCheck } from 'lucide-react';
import { api, type MeResponse } from '../../lib/api';
import { InstitutionalHeader } from '../../components/InstitutionalHeader';

const NAV = [
  { to: '/estudiante', label: 'Inicio', icon: LayoutDashboard },
  { to: '/estudiante/expediente', label: 'Mi expediente', icon: FolderOpen },
  { to: '/estudiante/convocatoria', label: 'Mi convocatoria', icon: Calendar },
  { to: '/estudiante/modulos', label: 'Mis módulos', icon: BookOpen },
  { to: '/estudiante/identificacion', label: 'Mi identificación', icon: BadgeCheck },
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
        onLogout={handleLogout}
      />

      <div className="flex-1 max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 w-full">
        {/* Sidebar */}
        <nav className="md:sticky md:top-[114px] self-start">
          <div className="bg-white border border-stone-200 rounded-md overflow-hidden">
            <div className="px-4 py-3 bg-[var(--color-guinda-700)] text-white">
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

      <footer className="border-t border-stone-200 bg-white">
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
