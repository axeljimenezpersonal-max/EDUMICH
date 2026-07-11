/**
 * AvisosCalendario — banners de FECHAS calculados en vivo del calendario oficial
 * de etapas (ventana de solicitud/pago abierta o próxima, y examen próximo).
 * Se usa en el inicio de alumno, gestor y admin. Siempre al día, sin cron.
 */
import { useEffect, useState } from 'react';
import { CalendarClock, CalendarCheck, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';

interface EventoCalendario {
  tipo: 'ventana_abierta' | 'ventana_proxima' | 'examen';
  clave: string;
  fecha: string;
  fechaFin?: string;
  dias: number;
  urgencia: 'alta' | 'media' | 'baja';
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fmt(s: string): string {
  const d = new Date(s + 'T00:00:00');
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
}
function rango(a: string, b: string): string {
  const da = new Date(a + 'T00:00:00'), db = new Date(b + 'T00:00:00');
  return da.getMonth() === db.getMonth()
    ? `${da.getDate()}–${db.getDate()} ${MESES[db.getMonth()]}`
    : `${da.getDate()} ${MESES[da.getMonth()]} – ${db.getDate()} ${MESES[db.getMonth()]}`;
}

const TONO = {
  alta: { bg: '#fff1f2', border: '#fecdd3', text: '#be123c', icon: '#f43f5e' },
  media: { bg: '#fffbeb', border: '#fde68a', text: '#b45309', icon: '#f59e0b' },
  baja: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', icon: '#3b82f6' },
};

function textoEvento(e: EventoCalendario): { titulo: string; detalle: string; Icon: typeof CalendarClock } {
  const enN = e.dias === 0 ? 'hoy' : e.dias === 1 ? 'mañana' : `en ${e.dias} días`;
  if (e.tipo === 'ventana_abierta') {
    return {
      Icon: e.urgencia === 'alta' ? AlertTriangle : CalendarClock,
      titulo: `Solicitud y pago abiertos — etapa ${e.clave}`,
      detalle: `La ventana para solicitar y pagar tu examen está abierta. Cierra el ${fmt(e.fecha)} (${enN}).`,
    };
  }
  if (e.tipo === 'ventana_proxima') {
    return {
      Icon: CalendarClock,
      titulo: `Próxima ventana de solicitud — etapa ${e.clave}`,
      detalle: `La solicitud y pago de exámenes abre el ${fmt(e.fecha)} (${enN}).`,
    };
  }
  return {
    Icon: CalendarCheck,
    titulo: `Examen próximo — etapa ${e.clave}`,
    detalle: `Presentación de examen el ${e.fechaFin ? rango(e.fecha, e.fechaFin) : fmt(e.fecha)} (${enN}).`,
  };
}

export function AvisosCalendario() {
  const [eventos, setEventos] = useState<EventoCalendario[]>([]);

  useEffect(() => {
    let alive = true;
    api.get<{ eventos: EventoCalendario[] }>('/anuncios/calendario')
      .then((r) => { if (alive) setEventos(r.eventos ?? []); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (eventos.length === 0) return null;

  return (
    <div className="space-y-3">
      {eventos.map((e, i) => {
        const c = TONO[e.urgencia];
        const { titulo, detalle, Icon } = textoEvento(e);
        return (
          <div key={i} className="rounded-md p-4 flex items-start gap-3" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
            <Icon size={16} style={{ color: c.icon, flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="font-semibold text-sm" style={{ color: c.text }}>{titulo}</div>
              <p className="text-xs leading-relaxed mt-0.5" style={{ color: '#57504a' }}>{detalle}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
