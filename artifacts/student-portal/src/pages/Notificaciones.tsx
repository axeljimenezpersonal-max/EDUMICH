import { useEffect, useState } from 'react';
import {
  Bell, Check, Trash2, FileText, CreditCard, UserPlus,
  CheckCircle, XCircle, Star, Megaphone, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { api } from '../lib/api';
import { safeUrl } from '../lib/safeUrl';

type Notif = {
  id: number;
  tipo: string;
  prioridad: 'baja' | 'normal' | 'alta' | 'urgente';
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

const PRIORIDAD_LABEL: Record<string, string> = {
  baja: 'Baja',
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
};

const TIPO_ICONO: Record<string, React.ComponentType<{ size?: number }>> = {
  solicitud_nueva: UserPlus,
  documento_subido_revisar: FileText,
  pago_subido_verificar: CreditCard,
  documento_aprobado: CheckCircle,
  documento_rechazado: XCircle,
  pago_verificado: CheckCircle,
  matricula_asignada: Star,
  alumno_asignado: UserPlus,
  anuncio_dirigido: Megaphone,
  mi_alumno_subio_documento: FileText,
  mi_alumno_subio_pago: CreditCard,
};

function NotifIcon({ tipo }: { tipo: string }) {
  const Icon = TIPO_ICONO[tipo] ?? Bell;
  return <Icon size={16} />;
}

function tiempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Ahora mismo';
  if (m < 60) return `Hace ${m} minutos`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Hace ${h} hora${h !== 1 ? 's' : ''}`;
  const d = Math.floor(h / 24);
  return `Hace ${d} día${d !== 1 ? 's' : ''}`;
}

const PAGE_SIZE = 15;

export default function Notificaciones() {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [soloNoLeidas, setSoloNoLeidas] = useState(false);
  const [loading, setLoading] = useState(true);

  const cargar = (p: number, noLeidas: boolean) => {
    setLoading(true);
    api.get<{ notificaciones: Notif[]; total: number; pages: number }>(
      `/notificaciones?page=${p}&limit=${PAGE_SIZE}${noLeidas ? '&noLeidas=true' : ''}`
    )
      .then(r => {
        setNotifs(r.notificaciones);
        setTotal(r.total);
        setPages(r.pages);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    cargar(page, soloNoLeidas);
  }, [page, soloNoLeidas]);

  function marcarLeida(id: number) {
    api.put(`/notificaciones/${id}/leer`, {}).catch(() => {});
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n));
  }

  function eliminar(id: number) {
    api.delete(`/notificaciones/${id}`).catch(() => {});
    setNotifs(prev => prev.filter(n => n.id !== id));
    setTotal(prev => Math.max(0, prev - 1));
  }

  function marcarTodas() {
    api.put('/notificaciones/leer-todas', {}).catch(() => {});
    setNotifs(prev => prev.map(n => ({ ...n, leida: true })));
  }

  const noLeidasCount = notifs.filter(n => !n.leida).length;

  return (
    <div style={{ minHeight: '100vh', background: '#f7f2ed', fontFamily: "'Poppins', sans-serif" }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 16px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <a
              href="javascript:history.back()"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#6b635e', textDecoration: 'none', marginBottom: 8 }}
            >
              <ChevronLeft size={14} /> Volver
            </a>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#2a2a2a', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Bell size={20} /> Notificaciones
              {total > 0 && (
                <span style={{ fontSize: 13, fontWeight: 400, color: '#6b635e' }}>({total})</span>
              )}
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { setSoloNoLeidas(v => !v); setPage(1); }}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: `1px solid ${soloNoLeidas ? 'var(--color-guinda-700)' : '#eadfd7'}`,
                background: soloNoLeidas ? '#fdf8f0' : 'white',
                color: soloNoLeidas ? 'var(--color-guinda-700)' : '#443e39',
                fontSize: 12,
                fontWeight: soloNoLeidas ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              Solo no leídas
            </button>
            {noLeidasCount > 0 && (
              <button
                onClick={marcarTodas}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: '1px solid #eadfd7',
                  background: 'white',
                  color: '#443e39',
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Check size={12} /> Marcar todas leídas
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #eadfd7', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: '#a89a8e', fontSize: 14 }}>
              Cargando...
            </div>
          ) : notifs.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center' }}>
              <Bell size={32} style={{ color: '#ddd0c5', margin: '0 auto 12px' }} />
              <div style={{ fontSize: 15, color: '#6b635e', fontWeight: 500 }}>Sin notificaciones</div>
              <div style={{ fontSize: 13, color: '#a89a8e', marginTop: 4 }}>
                {soloNoLeidas ? 'No tienes notificaciones pendientes de lectura.' : 'No tienes notificaciones aún.'}
              </div>
            </div>
          ) : (
            notifs.map((n, i) => (
              <div
                key={n.id}
                style={{
                  display: 'flex',
                  gap: 14,
                  padding: '14px 18px',
                  background: n.leida ? 'transparent' : '#fdf8f0',
                  borderBottom: i < notifs.length - 1 ? '1px solid #f7f2ed' : 'none',
                }}
              >
                {/* Priority bar */}
                <div
                  style={{
                    width: 4,
                    borderRadius: 2,
                    flexShrink: 0,
                    background: PRIORIDAD_COLOR[n.prioridad] ?? '#a89a8e',
                    alignSelf: 'stretch',
                  }}
                />

                {/* Icon */}
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: n.leida ? '#f7f2ed' : '#f0eae0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: PRIORIDAD_COLOR[n.prioridad] ?? '#6b635e',
                  }}
                >
                  <NotifIcon tipo={n.tipo} />
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: n.leida ? 400 : 600, color: '#2a2a2a', lineHeight: 1.3 }}>
                      {n.titulo}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: PRIORIDAD_COLOR[n.prioridad] ?? '#a89a8e',
                        background: `${PRIORIDAD_COLOR[n.prioridad]}18`,
                        padding: '2px 7px',
                        borderRadius: 4,
                        flexShrink: 0,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {PRIORIDAD_LABEL[n.prioridad]}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: '#6b635e', marginTop: 4, lineHeight: 1.5 }}>
                    {n.cuerpo}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                    <span style={{ fontSize: 11, color: '#a89a8e' }}>{tiempoRelativo(n.creadaEn)}</span>
                    {n.enlace && (
                      <a
                        href={safeUrl(n.enlace)}
                        style={{ fontSize: 11, color: 'var(--color-guinda-700)', textDecoration: 'none', fontWeight: 600 }}
                      >
                        Ver detalle →
                      </a>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                  {!n.leida && (
                    <button
                      onClick={() => marcarLeida(n.id)}
                      title="Marcar como leída"
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        border: '1px solid #eadfd7',
                        background: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#6b635e',
                      }}
                    >
                      <Check size={12} />
                    </button>
                  )}
                  <button
                    onClick={() => eliminar(n.id)}
                    title="Eliminar"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      border: '1px solid #eadfd7',
                      background: 'white',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#a89a8e',
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20 }}>
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px solid #eadfd7',
                background: 'white',
                cursor: page === 1 ? 'not-allowed' : 'pointer',
                color: page === 1 ? '#ddd0c5' : '#443e39',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 13,
              }}
            >
              <ChevronLeft size={14} /> Anterior
            </button>
            <span style={{ fontSize: 13, color: '#6b635e' }}>
              Página {page} de {pages}
            </span>
            <button
              disabled={page === pages}
              onClick={() => setPage(p => p + 1)}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px solid #eadfd7',
                background: 'white',
                cursor: page === pages ? 'not-allowed' : 'pointer',
                color: page === pages ? '#ddd0c5' : '#443e39',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 13,
              }}
            >
              Siguiente <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
