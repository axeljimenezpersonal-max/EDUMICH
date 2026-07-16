import { Link, useLocation } from 'wouter';
import { useEffect, useState, type ReactNode } from 'react';
import {
  LayoutDashboard, BookOpen, FolderOpen, Calendar, BadgeCheck, MessageSquare, CreditCard,
  GraduationCap, School, Lock,
} from 'lucide-react';
import { api, type MeResponse } from '../../lib/api';
import { Eye } from 'lucide-react';
import { InstitutionalHeader } from '../../components/InstitutionalHeader';
import { AppFooter } from '../../components/AppFooter';
import { OnboardingTour } from '../../components/onboarding/OnboardingTour';
import { BottomNav } from '../../components/BottomNav';
import { demoActive, disableDemo } from '../../lib/demo';

const NAV = [
  { to: '/estudiante', label: 'Inicio', icon: LayoutDashboard, tour: 'nav-inicio' },
  { to: '/estudiante/expediente', label: 'Expediente', icon: FolderOpen, tour: 'nav-expediente' },
  { to: '/estudiante/convocatoria', label: 'Inscripción', icon: Calendar, tour: 'nav-convocatoria' },
  { to: '/estudiante/pagos', label: 'Pagos', icon: CreditCard, tour: 'nav-pagos' },
  { to: '/estudiante/calificaciones', label: 'Calificaciones', icon: GraduationCap, tour: 'nav-calificaciones' },
  { to: '/estudiante/modulos', label: 'Pruebas', icon: BookOpen, tour: 'nav-modulos' },
];
const NAV_HERRAMIENTAS = [
  { to: '/estudiante/identificacion', label: 'ID', icon: BadgeCheck, tour: 'nav-identificacion' },
  { to: '/estudiante/mensajes', label: 'Mensajes', icon: MessageSquare, tour: 'nav-mensajes' },
];

function SeccionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-[0.15em] border-t border-stone-100" style={{ color: '#b39a56' }}>
      {children}
    </div>
  );
}

export function EstudianteLayout({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const [location] = useLocation();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [aula, setAula] = useState(false);

  const onAula = location.startsWith('/estudiante/aula');
  function esActivo(to: string): boolean {
    if (to === '/estudiante') return location === '/estudiante';
    return location.startsWith(to);
  }

  useEffect(() => {
    api.get<{ habilitada: boolean }>('/aula/estado').then((r) => setAula(!!r.habilitada)).catch(() => {});
  }, []);

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
            <div className="px-4 py-3 bg-[var(--color-guinda-700)] text-white">
              <div className="text-[10px] tracking-widest opacity-80">PORTAL</div>
              <div className="font-serif text-sm">Estudiante</div>
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

            {/* Herramientas (siempre primero, sobre el aula) */}
            <SeccionLabel>Herramientas</SeccionLabel>
            <ul className="pb-1">
              {NAV_HERRAMIENTAS.map((item) => {
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

            {/* Mi aula — un solo link a "Mis clases". Todo lo demás (Foro,
                Tareas, Materiales, Videos) vive DENTRO de cada módulo.
                Si el centro no tiene aula, se muestra en gris con candado. */}
            <div className="border-t border-stone-100">
              <Link href="/estudiante/aula" data-tour="nav-aula"
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold transition-colors border-l-4 ${
                  !aula
                    ? 'border-transparent hover:bg-stone-50'
                    : onAula
                      ? 'bg-[var(--color-crema-100)] border-[var(--color-guinda-700)] text-[var(--color-guinda-800)]'
                      : 'border-transparent text-stone-700 hover:bg-stone-50'}`}
                style={!aula ? { color: '#a8a29e' } : undefined}
                title={aula ? undefined : 'Tu centro aún no cuenta con Aula Virtual'}>
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
        base="/estudiante"
        principales={[
          { to: '/estudiante', label: 'Inicio', icon: LayoutDashboard },
          { to: '/estudiante/expediente', label: 'Expediente', icon: FolderOpen },
          { to: '/estudiante/convocatoria', label: 'Inscripción', icon: Calendar },
          { to: '/estudiante/pagos', label: 'Pagos', icon: CreditCard },
        ]}
        extras={[
          { to: '/estudiante/calificaciones', label: 'Calificaciones', icon: GraduationCap },
          { to: '/estudiante/modulos', label: 'Pruebas', icon: BookOpen },
          { to: '/estudiante/identificacion', label: 'ID', icon: BadgeCheck },
          { to: '/estudiante/mensajes', label: 'Mensajes', icon: MessageSquare },
          { to: '/estudiante/aula', label: 'Mi aula', icon: School, lock: !aula },
        ]}
      />

      <OnboardingTour
        rol={me?.rol}
        nombre={me?.perfil?.nombreCompleto}
        municipio={me?.perfil?.municipio}
      />

      {demoActive() && (
        <div
          className="fixed left-3 bottom-20 md:bottom-3 z-[45] flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold text-white shadow-lg"
          style={{ background: 'var(--color-guinda-800)' }}
        >
          <Eye size={14} />
          Vista demo · alumno nuevo
          <button
            onClick={() => { disableDemo(); window.location.href = '/login'; }}
            className="ml-1 rounded-full bg-white/20 px-2 py-0.5 hover:bg-white/30 transition-colors"
          >
            Salir
          </button>
        </div>
      )}
    </div>
  );
}
