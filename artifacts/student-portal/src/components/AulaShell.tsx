/**
 * AulaShell — layout del "Aula virtual" estilo Canvas: al entrar, el panel
 * lateral IZQUIERDO se vuelve el del aula (a la misma altura que el panel
 * principal), con un enlace para volver. Lo usan el gestor y el alumno.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { api, type MeResponse } from '../lib/api';
import { InstitutionalHeader } from './InstitutionalHeader';
import { AppFooter } from './AppFooter';

export interface AulaNavItem<K extends string> { k: K; label: string; icon: React.ComponentType<{ size?: number }>; n?: number }

export function AulaShell<K extends string>({
  rol, volverHref, sec, setSec, nav, children,
}: {
  rol: 'gestor' | 'estudiante';
  volverHref: string;
  sec: K;
  setSec: React.Dispatch<React.SetStateAction<K>>;
  nav: AulaNavItem<K>[];
  children: ReactNode;
}) {
  const [, setLocation] = useLocation();
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    api.get<MeResponse>('/auth/me')
      .then((u) => { if (u.rol !== rol) setLocation('/login'); else setMe(u); })
      .catch(() => setLocation('/login'));
  }, [setLocation, rol]);

  async function handleLogout() { await api.post('/auth/logout'); setLocation('/login'); }

  const Panel = (
    <div className="bg-white border border-stone-200 rounded-md overflow-hidden">
      <Link href={volverHref} className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-stone-500 hover:text-[var(--color-guinda-700)] hover:bg-stone-50 border-b border-stone-100 transition-colors">
        <ArrowLeft size={14} /> Volver al panel
      </Link>
      <div className="px-4 py-3 bg-[var(--color-guinda-700)] text-white">
        <div className="text-[10px] tracking-widest opacity-80">PANEL</div>
        <div className="font-serif text-sm">Aula virtual</div>
      </div>
      <ul className="py-1">
        {nav.map((it) => {
          const on = sec === it.k;
          const Icon = it.icon;
          return (
            <li key={it.k}>
              <button onClick={() => setSec(it.k)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors border-l-4 ${on ? 'bg-[var(--color-crema-100)] border-[var(--color-guinda-700)] text-[var(--color-guinda-800)] font-semibold' : 'border-transparent text-stone-700 hover:bg-stone-50'}`}>
                <Icon size={16} /> <span className="flex-1 text-left">{it.label}</span>
                {typeof it.n === 'number' && it.n > 0 && <span className="text-[10px] font-bold rounded-full px-1.5 py-0.5" style={{ background: on ? 'var(--color-guinda-700)' : '#eee', color: on ? '#fff' : '#78716c' }}>{it.n}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--color-crema-100)] flex flex-col">
      <InstitutionalHeader
        userName={me?.perfil?.nombreCompleto ?? me?.email}
        userRole={rol === 'gestor' ? `Gestor · ${me?.perfil?.municipio ?? ''}` : 'Estudiante'}
        userPhotoUrl={rol === 'estudiante' ? '/api/estudiante/mi-foto' : undefined}
        onLogout={handleLogout}
      />
      <div className="flex-1 max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 sm:gap-6 w-full">
        <nav className="md:sticky md:top-[114px] self-start">{Panel}</nav>
        <main className="min-w-0">{children}</main>
      </div>
      <AppFooter />
    </div>
  );
}
