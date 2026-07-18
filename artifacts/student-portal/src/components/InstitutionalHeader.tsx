/**
 * Header institucional con la imagen oficial Gobierno de Michoacán + IEMSyS.
 * Reusa el mismo patrón de los temarios oficiales.
 *
 * Ubicación destino en Replit: artifacts/student-portal/src/components/InstitutionalHeader.tsx
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { LogOut, User, Bell, ChevronRight, X, Check, HelpCircle } from 'lucide-react';
import { api } from '../lib/api';
import { safeUrl } from '../lib/safeUrl';
import { BrandLogo } from './BrandLogo';

interface Props {
  userName?: string;
  userRole?: string;
  userPhotoUrl?: string;
  onLogout?: () => void;
  /**
   * Acciones a la izquierda del bloque de usuario (hoy: el buscador global).
   * Va aquí y no dentro del header para que cada rol decida qué ofrece, sin
   * que este componente tenga que saber de buscadores ni de roles.
   */
  acciones?: ReactNode;
}

type Notif = {
  id: number;
  tipo: string;
  prioridad: string;
  titulo: string;
  cuerpo: string;
  enlace: string | null;
  leida: boolean;
  creadaEn: string;
};

const PRIORIDAD_COLOR: Record<string, string> = {
  baja: '#a89a8e',
  normal: '#2563eb',
  alta: '#d97706',
  urgente: '#dc2626',
};

function tiempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

function HeaderNotifBell() {
  const [noLeidas, setNoLeidas] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const cargarContador = () => {
    api.get<{ noLeidas: number }>('/notificaciones/contador')
      .then(r => setNoLeidas(r.noLeidas))
      .catch(() => {});
  };

  useEffect(() => {
    cargarContador();
    const interval = setInterval(cargarContador, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (open) {
      api.get<{ notificaciones: Notif[] }>('/notificaciones?limit=6')
        .then(r => setNotifs(r.notificaciones))
        .catch(() => {});
    }
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

  function borrarNotif(id: number, eraNoLeida: boolean) {
    api.delete(`/notificaciones/${id}`).catch(() => {});
    setNotifs(prev => prev.filter(n => n.id !== id));
    if (eraNoLeida) setNoLeidas(prev => Math.max(0, prev - 1));
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
        className="p-2 rounded-md text-stone-500 hover:text-[var(--color-guinda-700)] hover:bg-[var(--color-crema-100)] transition-colors relative"
        aria-label="Notificaciones"
      >
        <Bell size={18} />
        {noLeidas > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
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
            position: 'fixed',
            right: 8,
            top: 'auto',
            marginTop: 8,
            width: 'min(320px, calc(100vw - 16px))',
            background: 'white',
            border: '1px solid #eadfd7',
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            zIndex: 200,
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #f7f2ed', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#2a2a2a' }}>
              Notificaciones {noLeidas > 0 && <span style={{ color: 'var(--color-guinda-700)' }}>({noLeidas})</span>}
            </span>
            {noLeidas > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); marcarTodas(); }}
                title="Marcar todas como leídas"
                style={{
                  display: 'flex', alignItems: 'center', gap: 3,
                  fontSize: 11, color: '#6b635e', background: 'none',
                  border: '1px solid #eadfd7', borderRadius: 5,
                  padding: '3px 8px', cursor: 'pointer',
                }}
              >
                <Check size={10} /> Leer todas
              </button>
            )}
          </div>

          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            {notifs.length === 0 ? (
              <div style={{ padding: '24px 14px', textAlign: 'center', color: '#a89a8e', fontSize: 13 }}>
                Sin notificaciones
              </div>
            ) : (
              notifs.map(n => (
                <div
                  key={n.id}
                  onClick={() => {
                    if (!n.leida) marcarLeida(n.id);
                    if (n.enlace) window.location.href = safeUrl(n.enlace);
                  }}
                  style={{
                    display: 'flex',
                    gap: 10,
                    padding: '10px 14px',
                    background: n.leida ? 'transparent' : '#fdf8f0',
                    borderBottom: '1px solid #f7f2ed',
                    cursor: n.enlace ? 'pointer' : 'default',
                    position: 'relative',
                  }}
                >
                  <div style={{ width: 3, borderRadius: 2, background: PRIORIDAD_COLOR[n.prioridad] ?? '#a89a8e', alignSelf: 'stretch', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: n.leida ? 400 : 600, color: '#2a2a2a', lineHeight: 1.3, paddingRight: 20 }}>{n.titulo}</div>
                    <div style={{ fontSize: 11, color: '#6b635e', marginTop: 2, lineHeight: 1.4 }}>{n.cuerpo}</div>
                    <div style={{ fontSize: 10, color: '#a89a8e', marginTop: 3 }}>{tiempoRelativo(n.creadaEn)}</div>
                  </div>
                  {/* Dismiss button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); borrarNotif(n.id, !n.leida); }}
                    title="Quitar notificación"
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 10,
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#a89a8e',
                      padding: 0,
                      opacity: 0.7,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))
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
            Ver todas <ChevronRight size={12} />
          </a>
        </div>
      )}
    </div>
  );
}

export function InstitutionalHeader({ userName, userRole, userPhotoUrl, onLogout, acciones }: Props) {
  return (
    <header className="border-b-4 border-[var(--color-guinda-700)] bg-white sticky top-0 z-50 shadow-sm">
      {/* Cabecera con logos y branding */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-4 flex items-center justify-between gap-3 sm:gap-6">
        <div className="flex items-center gap-5">
          {/* Logo izquierdo: escudo Gobierno de Michoacán */}
          <div className="flex items-center gap-2 sm:gap-3">
            <BrandLogo
              alt="Secretaría de Educación de Michoacán"
              className="brand-logo-img flex-shrink-0 w-8 h-8 sm:w-14 sm:h-14"
            />
            <div className="leading-tight hidden sm:block">
              <div className="font-serif text-sm font-semibold text-[var(--color-guinda-800)]">
                Gobierno de
              </div>
              <div className="font-serif text-sm font-semibold text-[var(--color-guinda-800)]">
                Michoacán
              </div>
              <div className="text-[10px] tracking-widest text-stone-500 mt-0.5">
                HONESTIDAD Y TRABAJO
              </div>
            </div>
            {/* Mobile: solo nombre corto */}
            <div className="sm:hidden leading-tight">
              <div className="font-serif text-xs font-bold text-[var(--color-guinda-800)]">Preparatoria Abierta</div>
              <div className="text-[9px] text-stone-500">Modula · IEMSyS</div>
            </div>
          </div>

          {/* Separador */}
          <div className="hidden md:block w-px h-12 bg-stone-300"></div>

          {/* Identidad del sistema */}
          <div className="hidden md:block leading-tight">
            <div className="font-serif text-lg font-bold text-[var(--color-piedra-900)]">
              Preparatoria Abierta
            </div>
            <div className="text-xs text-stone-600" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              Sistema de Gestión · IEMSyS
              <span style={{
                display: 'inline-flex', alignItems: 'center',
                background: '#f8e8ef', color: 'var(--color-guinda-700)',
                border: '1px solid #e8c4d4', borderRadius: 4,
                padding: '1px 5px', fontSize: 9, fontWeight: 800, letterSpacing: '0.06em',
              }}>
                Modula · Plan 22
              </span>
            </div>
          </div>
        </div>

        {/* Usuario / sesión */}
        {userName && (
          <div className="flex items-center gap-2 sm:gap-3">
            {acciones}
            <div className="hidden md:block text-right leading-tight">
              <div className="text-sm font-medium text-stone-800">{userName}</div>
              {userRole && (
                <div className="text-xs uppercase tracking-wider text-[var(--color-guinda-700)] font-semibold">
                  {userRole}
                </div>
              )}
            </div>
            <div className="w-9 h-9 rounded-full bg-[var(--color-crema-200)] flex items-center justify-center text-[var(--color-guinda-700)] overflow-hidden flex-shrink-0">
              {userPhotoUrl ? (
                <img
                  src={userPhotoUrl}
                  alt="Foto"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                    (e.currentTarget.nextSibling as HTMLElement | null)?.removeAttribute('style');
                  }}
                />
              ) : null}
              <User size={18} style={userPhotoUrl ? { display: 'none' } : {}} />
            </div>
            {/* Ayuda: relanza el recorrido de bienvenida del rol actual.
                El evento lo escucha <OnboardingTour/> montado en cada layout. */}
            <button
              data-tour="help-button"
              onClick={() => window.dispatchEvent(new Event('modula:start-tour'))}
              className="p-2 rounded-md text-stone-500 hover:text-[var(--color-guinda-700)] hover:bg-[var(--color-crema-100)] transition-colors"
              aria-label="Ver tutorial guiado"
              title="Ver tutorial guiado"
            >
              <HelpCircle size={18} />
            </button>
            <HeaderNotifBell />
            {onLogout && (
              <button
                onClick={onLogout}
                className="p-2 rounded-md text-stone-500 hover:text-[var(--color-guinda-700)] hover:bg-[var(--color-crema-100)] transition-colors"
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
              >
                <LogOut size={18} />
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
