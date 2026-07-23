/**
 * Layout del panel del gestor: header institucional + navegación lateral.
 *
 * Ubicación destino: artifacts/student-portal/src/pages/gestor/GestorLayout.tsx
 */

import { Link, useLocation } from 'wouter';
import { useEffect, useState, type ReactNode } from 'react';
import {
  LayoutDashboard, Users, FilePlus2, CreditCard, GraduationCap, HelpCircle, School, Lock, ClipboardList,
} from 'lucide-react';
import { api, type MeResponse } from '../../lib/api';
import { InstitutionalHeader } from '../../components/InstitutionalHeader';
import { BuscadorGlobal } from '../../components/buscador/BuscadorGlobal';
import { AppFooter } from '../../components/AppFooter';
import { OnboardingTour } from '../../components/onboarding/OnboardingTour';
import { BottomNav } from '../../components/BottomNav';

const NAV = [
  { to: '/gestor', icon: LayoutDashboard, label: 'Inicio', tour: 'nav-inicio' },
  { to: '/gestor/alumnos/nuevo', icon: FilePlus2, label: 'Nuevo alumno', tour: 'nav-nuevo' },
  { to: '/gestor/alumnos', icon: Users, label: 'Mis alumnos', tour: 'nav-alumnos' },
  { to: '/gestor/inscripcion', icon: ClipboardList, label: 'Inscripción', tour: 'nav-inscripcion' },
  { to: '/gestor/pagos', icon: CreditCard, label: 'Pagos', tour: 'nav-pagos' },
  { to: '/gestor/calificaciones', icon: GraduationCap, label: 'Calificaciones', tour: 'nav-calificaciones' },
  { to: '/gestor/faq', icon: HelpCircle, label: 'Preguntas frecuentes', tour: 'nav-faq' },
];

export function GestorLayout({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const [location] = useLocation();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [aula, setAula] = useState(false);

  const onAula = location.startsWith('/gestor/aula');
  function esActivo(to: string): boolean {
    if (to === '/gestor') return location === '/gestor';
    return location.startsWith(to);
  }

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
        acciones={<BuscadorGlobal rol="gestor" />}
      />

      <div className="flex-1 max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 sm:gap-6 w-full pb-20 md:pb-6">
        {/* Sidebar — solo visible en md+; en teléfono navega la barra inferior.
            Scroll interno propio para pantallas bajitas (teléfono horizontal). */}
        <nav
          className="hidden md:block md:sticky md:top-[114px] self-start overflow-y-auto"
          style={{ maxHeight: 'calc(100vh - 130px)' }}
        >
          <div className="bg-white border border-stone-200 rounded-md overflow-hidden">
            <div className="px-4 py-3 bg-[var(--color-guinda-700)] text-white">
              <div className="text-[10px] tracking-widest opacity-80">PANEL</div>
              <div className="font-serif text-sm">Gestor Municipal</div>
            </div>
            {/* Menú principal */}
            <ul>
              {NAV.map((item) => {
                const active = esActivo(item.to);
                return (
                  <li key={item.to}>
                    <Link href={item.to} data-tour={item.tour}
                      className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors border-l-4 ${
                        active ? 'bg-[var(--color-crema-100)] border-[var(--color-guinda-700)] text-[var(--color-guinda-800)] font-semibold' : 'border-transparent text-stone-700 hover:bg-stone-50'}`}>
                      <item.icon size={16} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* Mi aula — un solo link a "Mis módulos de clase". Foro, Tareas,
                Materiales y Videos viven DENTRO de cada módulo. Si no está
                contratada, se muestra en gris con candado. */}
            <div className="border-t border-stone-100">
              <Link href="/gestor/aula" data-tour="nav-aula"
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold transition-colors border-l-4 ${
                  !aula
                    ? 'border-transparent hover:bg-stone-50'
                    : onAula
                      ? 'bg-[var(--color-crema-100)] border-[var(--color-guinda-700)] text-[var(--color-guinda-800)]'
                      : 'border-transparent text-stone-700 hover:bg-stone-50'}`}
                style={!aula ? { color: '#a8a29e' } : undefined}
                title={aula ? undefined : 'Aula Virtual no activada — contacta a la Secretaría'}>
                <School size={16} />
                <span className="flex-1 text-left">Mi aula</span>
                {!aula && <Lock size={13} />}
              </Link>
            </div>
          </div>
        </nav>

        {/* Contenido */}
        <main className="min-w-0">{children}</main>
      </div>

      <div className="hidden md:block">
        <AppFooter />
      </div>

      {/* Barra inferior móvil: 4 secciones fijas + hoja «Más» con el resto. */}
      <BottomNav
        base="/gestor"
        principales={[
          { to: '/gestor', label: 'Inicio', icon: LayoutDashboard, tour: 'nav-inicio' },
          { to: '/gestor/alumnos/nuevo', label: 'Nuevo', icon: FilePlus2, tour: 'nav-nuevo' },
          { to: '/gestor/alumnos', label: 'Alumnos', icon: Users, tour: 'nav-alumnos' },
          { to: '/gestor/pagos', label: 'Pagos', icon: CreditCard, tour: 'nav-pagos' },
        ]}
        extras={[
          { to: '/gestor/inscripcion', label: 'Inscripción', icon: ClipboardList, tour: 'nav-inscripcion' },
          { to: '/gestor/calificaciones', label: 'Calificaciones', icon: GraduationCap, tour: 'nav-calificaciones' },
          { to: '/gestor/faq', label: 'Preguntas frecuentes', icon: HelpCircle, tour: 'nav-faq' },
          { to: '/gestor/aula', label: 'Mi aula', icon: School, lock: !aula, tour: 'nav-aula' },
        ]}
      />

      <OnboardingTour
        rol={me?.rol}
        nombre={me?.perfil?.nombreCompleto}
        municipio={me?.perfil?.municipio}
      />
    </div>
  );
}
