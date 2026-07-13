/**
 * Layout del panel del gestor: header institucional + navegación lateral.
 *
 * Ubicación destino: artifacts/student-portal/src/pages/gestor/GestorLayout.tsx
 */

import { Link, useLocation } from 'wouter';
import { useEffect, useState, type ReactNode } from 'react';
import { LayoutDashboard, Users, FilePlus2, CreditCard, GraduationCap, MessageSquare, School } from 'lucide-react';
import { api, type MeResponse } from '../../lib/api';
import { InstitutionalHeader } from '../../components/InstitutionalHeader';
import { AppFooter } from '../../components/AppFooter';
import { OnboardingTour } from '../../components/onboarding/OnboardingTour';

const NAV = [
  { to: '/gestor', icon: LayoutDashboard, label: 'Inicio', tour: 'nav-inicio' },
  { to: '/gestor/alumnos/nuevo', icon: FilePlus2, label: 'Nuevo alumno', tour: 'nav-nuevo' },
  { to: '/gestor/alumnos', icon: Users, label: 'Mis alumnos', tour: 'nav-alumnos' },
  { to: '/gestor/pagos', icon: CreditCard, label: 'Pagos', tour: 'nav-pagos' },
  { to: '/gestor/calificaciones', icon: GraduationCap, label: 'Calificaciones', tour: 'nav-calificaciones' },
  { to: '/gestor/mensajes', icon: MessageSquare, label: 'Mensajes', tour: 'nav-mensajes' },
];
const NAV_AULA = { to: '/gestor/aula', icon: School, label: 'Aula virtual', tour: 'nav-aula' };

export function GestorLayout({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const [location] = useLocation();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [aula, setAula] = useState(false);

  useEffect(() => {
    api.get<{ habilitada: boolean }>('/aula/estado').then((r) => setAula(!!r.habilitada)).catch(() => {});
  }, []);

  useEffect(() => {
    api
      .get<MeResponse>('/auth/me')
      .then((u) => {
        if (u.rol !== 'gestor') {
          setLocation('/login');
        } else {
          setMe(u);
        }
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
        userRole={me ? `Gestor · ${me.perfil?.municipio ?? ''}` : undefined}
        onLogout={handleLogout}
      />

      <div className="flex-1 max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 w-full">
        {/* Sidebar */}
        <nav className="md:sticky md:top-[114px] self-start">
          <div className="bg-white border border-stone-200 rounded-md overflow-hidden">
            <div className="px-4 py-3 bg-[var(--color-guinda-700)] text-white">
              <div className="text-[10px] tracking-widest opacity-80">PANEL</div>
              <div className="font-serif text-sm">Gestor Municipal</div>
            </div>
            <ul>
              {(aula ? [...NAV, NAV_AULA] : NAV).map((item) => {
                const active =
                  item.to === '/gestor' ? location === '/gestor' : location.startsWith(item.to);
                return (
                  <li key={item.to}>
                    <Link
                      href={item.to}
                      data-tour={item.tour}
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

      <AppFooter />

      <OnboardingTour
        rol={me?.rol}
        nombre={me?.perfil?.nombreCompleto}
        municipio={me?.perfil?.municipio}
      />
    </div>
  );
}
