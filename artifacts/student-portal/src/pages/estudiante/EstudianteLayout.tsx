import { Link, useLocation, useSearch } from 'wouter';
import { useEffect, useState, type ReactNode } from 'react';
import {
  LayoutDashboard, BookOpen, FolderOpen, Calendar, BadgeCheck, MessageSquare, CreditCard,
  GraduationCap, School, MessageCircle, ClipboardList, Video, ChevronDown,
} from 'lucide-react';
import { api, type MeResponse } from '../../lib/api';
import { Eye } from 'lucide-react';
import { InstitutionalHeader } from '../../components/InstitutionalHeader';
import { AppFooter } from '../../components/AppFooter';
import { OnboardingTour } from '../../components/onboarding/OnboardingTour';
import { demoActive, disableDemo } from '../../lib/demo';

const NAV = [
  { to: '/estudiante', label: 'Inicio', icon: LayoutDashboard, tour: 'nav-inicio' },
  { to: '/estudiante/expediente', label: 'Expediente', icon: FolderOpen, tour: 'nav-expediente' },
  { to: '/estudiante/convocatoria', label: 'Inscripción', icon: Calendar, tour: 'nav-convocatoria' },
  { to: '/estudiante/pagos', label: 'Pagos', icon: CreditCard, tour: 'nav-pagos' },
  { to: '/estudiante/calificaciones', label: 'Calificaciones', icon: GraduationCap, tour: 'nav-calificaciones' },
  { to: '/estudiante/modulos', label: 'Pruebas', icon: BookOpen, tour: 'nav-modulos' },
];
// "Mi aula" es un botón que se despliega (mini-portal) con sus apartados.
const NAV_AULA_SUB = [
  { to: '/estudiante/aula?sec=foro', label: 'Foro', icon: MessageCircle },
  { to: '/estudiante/aula?sec=tareas', label: 'Tareas', icon: ClipboardList },
  { to: '/estudiante/aula?sec=materiales', label: 'Materiales', icon: BookOpen },
  { to: '/estudiante/aula?sec=videos', label: 'Videos', icon: Video },
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
  const search = useSearch();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [aula, setAula] = useState(false);
  // Para la barra inferior móvil: plano — Herramientas antes que Aula.
  const navItems = [
    ...NAV,
    ...NAV_HERRAMIENTAS,
    ...(aula ? [{ to: '/estudiante/aula', label: 'Aula', icon: School, tour: 'nav-aula' }] : []),
  ];

  // "Mi aula" se despliega: abierto por defecto cuando estás dentro del aula.
  const onAula = location.startsWith('/estudiante/aula');
  const [aulaOpen, setAulaOpen] = useState(onAula);
  useEffect(() => { if (onAula) setAulaOpen(true); }, [onAula]);
  const secActual = new URLSearchParams(search).get('sec') ?? 'resumen';

  // Activo considerando ?sec= (para los apartados del aula).
  function esActivo(to: string): boolean {
    const [path, q] = to.split('?');
    if (path === '/estudiante') return location === '/estudiante';
    if (!location.startsWith(path)) return false;
    if (path === '/estudiante/aula') {
      const secItem = new URLSearchParams(q ?? '').get('sec') ?? 'resumen';
      return secItem === secActual;
    }
    return true;
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

            {/* Mi aula — botón que se despliega (mini-portal) */}
            {aula && (
              <div className="border-t border-stone-100">
                <button
                  data-tour="nav-aula"
                  onClick={() => { setAulaOpen((o) => (onAula ? !o : true)); if (!onAula) setLocation('/estudiante/aula'); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors border-l-4 ${
                    onAula && secActual === 'resumen'
                      ? 'bg-[var(--color-crema-100)] border-[var(--color-guinda-700)] text-[var(--color-guinda-800)] font-semibold'
                      : 'border-transparent text-stone-700 hover:bg-stone-50'}`}
                >
                  <School size={16} />
                  <span className="flex-1 text-left font-semibold">Mi aula</span>
                  <ChevronDown size={15} className={`transition-transform ${aulaOpen ? 'rotate-180' : ''}`} style={{ color: '#a8a29e' }} />
                </button>
                {aulaOpen && (
                  <ul className="pb-1" style={{ background: '#fdfcfa' }}>
                    {NAV_AULA_SUB.map((item) => {
                      const active = esActivo(item.to);
                      return (
                        <li key={item.to}>
                          <Link href={item.to}
                            className={`flex items-center gap-3 py-2 pl-11 pr-4 text-[13px] transition-colors border-l-4 ${
                              active ? 'bg-[var(--color-crema-100)] border-[var(--color-guinda-700)] text-[var(--color-guinda-800)] font-semibold' : 'border-transparent text-stone-600 hover:bg-stone-50'}`}>
                            <item.icon size={14} />
                            {item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        </nav>

        {/* Contenido */}
        <main className="min-w-0">{children}</main>
      </div>

      <div className="hidden md:block">
        <AppFooter />
      </div>

      {/* Bottom tab bar — solo en móvil */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-stone-200"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* 9 secciones: en móvil la barra se desliza horizontalmente */}
        <div className="flex items-stretch overflow-x-auto scrollbar-none">
          {navItems.map((item) => {
            const active =
              item.to === '/estudiante'
                ? location === '/estudiante'
                : location.startsWith(item.to);
            return (
              <Link key={item.to} href={item.to} className="flex-1 min-w-[68px]">
                <div
                  className={`flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                    active
                      ? 'text-[var(--color-guinda-700)]'
                      : 'text-stone-400'
                  }`}
                >
                  <item.icon size={20} />
                  <span className="text-[9px] font-semibold tracking-wide leading-none whitespace-nowrap">
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

      <OnboardingTour
        rol={me?.rol}
        nombre={me?.perfil?.nombreCompleto}
        municipio={me?.perfil?.municipio}
      />

      {demoActive() && (
        <div
          className="fixed left-3 bottom-20 md:bottom-3 z-[60] flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold text-white shadow-lg"
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
