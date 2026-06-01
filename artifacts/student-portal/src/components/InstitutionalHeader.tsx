/**
 * Header institucional con la imagen oficial Gobierno de Michoacán + IEMSyS.
 * Reusa el mismo patrón de los temarios oficiales.
 *
 * Ubicación destino en Replit: artifacts/student-portal/src/components/InstitutionalHeader.tsx
 */

import { useEffect, useRef, useState } from 'react';
import { LogOut, User, Bell, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';

interface Props {
  userName?: string;
  userRole?: string;
  userPhotoUrl?: string;
  onLogout?: () => void;
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
  baja: '#a8a29e',
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
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            width: 320,
            background: 'white',
            border: '1px solid #e7e5e4',
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            zIndex: 200,
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #f5f5f4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#2a2a2a' }}>
              Notificaciones {noLeidas > 0 && <span style={{ color: 'var(--color-guinda-700)' }}>({noLeidas})</span>}
            </span>
          </div>

          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            {notifs.length === 0 ? (
              <div style={{ padding: '24px 14px', textAlign: 'center', color: '#a8a29e', fontSize: 13 }}>
                Sin notificaciones
              </div>
            ) : (
              notifs.map(n => (
                <div
                  key={n.id}
                  onClick={() => {
                    if (!n.leida) marcarLeida(n.id);
                    if (n.enlace) window.location.href = n.enlace;
                  }}
                  style={{
                    display: 'flex',
                    gap: 10,
                    padding: '10px 14px',
                    background: n.leida ? 'transparent' : '#fdf8f0',
                    borderBottom: '1px solid #f5f5f4',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ width: 3, borderRadius: 2, background: PRIORIDAD_COLOR[n.prioridad] ?? '#a8a29e', alignSelf: 'stretch', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: n.leida ? 400 : 600, color: '#2a2a2a', lineHeight: 1.3 }}>{n.titulo}</div>
                    <div style={{ fontSize: 11, color: '#78716c', marginTop: 2, lineHeight: 1.4 }}>{n.cuerpo}</div>
                    <div style={{ fontSize: 10, color: '#a8a29e', marginTop: 3 }}>{tiempoRelativo(n.creadaEn)}</div>
                  </div>
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
              borderTop: '1px solid #f5f5f4',
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

export function InstitutionalHeader({ userName, userRole, userPhotoUrl, onLogout }: Props) {
  return (
    <header className="border-b-4 border-[var(--color-guinda-700)] bg-white sticky top-0 z-50 shadow-sm">
      {/* Banda institucional superior */}
      <div className="bg-[var(--color-guinda-700)] text-white text-xs">
        <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center justify-between">
          <span className="font-medium tracking-wide">
            GOBIERNO DEL ESTADO DE MICHOACÁN · HONESTIDAD Y TRABAJO
          </span>
          <span className="hidden sm:inline opacity-80">prepaabierta.michoacan.gob.mx</span>
        </div>
      </div>

      {/* Cabecera con logos y branding */}
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          {/* Logo izquierdo: escudo Gobierno de Michoacán */}
          <div className="flex items-center gap-3">
            <img
              src="/logo-see-michoacan-256.png"
              alt="Secretaría de Educación de Michoacán"
              className="brand-logo-img flex-shrink-0"
            />
            <div className="leading-tight">
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
          </div>

          {/* Separador */}
          <div className="hidden md:block w-px h-12 bg-stone-300"></div>

          {/* Identidad del sistema */}
          <div className="hidden md:block leading-tight">
            <div className="font-serif text-lg font-bold text-[var(--color-piedra-900)]">
              Prepa Abierta
            </div>
            <div className="text-xs text-stone-600" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              Sistema de Gestión · IEMSyS
              <span style={{
                display: 'inline-flex', alignItems: 'center',
                background: '#f8e8ef', color: 'var(--color-guinda-700)',
                border: '1px solid #e8c4d4', borderRadius: 4,
                padding: '1px 5px', fontSize: 9, fontWeight: 800, letterSpacing: '0.06em',
              }}>
                EDUMICH
              </span>
            </div>
          </div>
        </div>

        {/* Usuario / sesión */}
        {userName && (
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right leading-tight">
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
