/**
 * AvisosCalendario — banners de FECHAS calculados en vivo del calendario oficial
 * de etapas. Regla general del portal: cuando la ventana de INSCRIPCIÓN Y PAGO de
 * una etapa está abierta, se muestra un banner PROMINENTE con la etapa en grande,
 * el rango de fechas (del → al) y la cuenta regresiva. Igual para el examen próximo.
 * Se usa en el inicio de alumno, gestor y admin. Siempre al día, sin cron.
 */
import { useEffect, useState } from 'react';
import { CalendarClock, CalendarCheck, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';

interface EventoCalendario {
  tipo: 'ventana_abierta' | 'ventana_proxima' | 'examen';
  clave: string;
  fecha: string;
  fechaInicio?: string;
  fechaFin?: string;
  dias: number;
  urgencia: 'alta' | 'media' | 'baja';
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function d(s: string) { return new Date(s + 'T00:00:00'); }
function fmtLargo(s: string): string { const x = d(s); return `${x.getDate()} de ${MESES[x.getMonth()]}`; }
function rangoLargo(a: string, b: string): string {
  const da = d(a), db = d(b);
  return da.getMonth() === db.getMonth()
    ? `Del ${da.getDate()} al ${db.getDate()} de ${MESES[db.getMonth()]}`
    : `Del ${da.getDate()} de ${MESES[da.getMonth()]} al ${db.getDate()} de ${MESES[db.getMonth()]}`;
}
function rangoCorto(a: string, b: string): string {
  const da = d(a), db = d(b);
  return da.getMonth() === db.getMonth()
    ? `${da.getDate()}–${db.getDate()} ${MES_C[db.getMonth()]}`
    : `${da.getDate()} ${MES_C[da.getMonth()]} – ${db.getDate()} ${MES_C[db.getMonth()]}`;
}
function enDias(dias: number): string { return dias <= 0 ? 'hoy' : dias === 1 ? 'mañana' : `en ${dias} días`; }

const POPPINS = "'Poppins', sans-serif";

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
        if (e.tipo === 'ventana_abierta') return <BannerVentanaAbierta key={i} e={e} />;
        if (e.tipo === 'examen') return <BannerExamen key={i} e={e} />;
        return <BannerVentanaProxima key={i} e={e} />;
      })}
    </div>
  );
}

// ── Banner PROMINENTE: inscripción y pago abiertos ──────────────────────────
function BannerVentanaAbierta({ e }: { e: EventoCalendario }) {
  const urgente = e.urgencia === 'alta';
  const acento = urgente ? '#be123c' : '#b45309';
  const borde = urgente ? '#fecdd3' : '#fde68a';
  return (
    <div
      className="overflow-hidden rounded-2xl border-2 shadow-sm"
      style={{ borderColor: borde, background: `linear-gradient(135deg, ${urgente ? '#fff1f2' : '#fffbeb'} 0%, #ffffff 70%)` }}
    >
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: acento }}>
            {urgente ? <AlertTriangle size={13} /> : <CalendarClock size={13} />}
            Inscripción y pago abiertos
          </div>
          <div className="mt-1 font-serif text-xl font-bold uppercase tracking-tight text-stone-900 sm:text-2xl">
            Etapa {e.clave}
          </div>
          <p className="mt-1.5 max-w-xl text-[13px] text-stone-600 sm:text-sm">
            La ventana para <strong className="text-stone-800">inscribir y pagar tu examen</strong> está abierta.
          </p>
          {e.fechaInicio && (
            <div
              className="mt-2.5 inline-flex items-center gap-2 rounded-lg border bg-white/80 px-3 py-1.5 text-[13px] font-bold"
              style={{ borderColor: borde, color: acento }}
            >
              <CalendarClock size={14} />
              {rangoLargo(e.fechaInicio, e.fecha)}
            </div>
          )}
        </div>
        <div
          className="flex shrink-0 flex-col items-center justify-center rounded-2xl px-4 py-2.5 text-center"
          style={{ background: urgente ? '#fee2e2' : '#fef3c7' }}
        >
          <div className="text-3xl font-bold leading-none" style={{ color: acento, fontFamily: POPPINS }}>{Math.max(0, e.dias)}</div>
          <div className="mt-1 whitespace-pre-line text-[9px] font-semibold uppercase leading-tight tracking-wide" style={{ color: acento }}>
            {e.dias <= 1 ? (e.dias === 0 ? 'cierra hoy' : 'cierra mañana') : 'días para\nel cierre'}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Banner PROMINENTE: examen próximo ───────────────────────────────────────
function BannerExamen({ e }: { e: EventoCalendario }) {
  const urgente = e.urgencia === 'alta';
  const acento = urgente ? '#be123c' : '#b45309';
  const borde = urgente ? '#fecdd3' : '#fde68a';
  return (
    <div
      className="overflow-hidden rounded-2xl border-2 shadow-sm"
      style={{ borderColor: borde, background: `linear-gradient(135deg, ${urgente ? '#fff1f2' : '#fffbeb'} 0%, #ffffff 70%)` }}
    >
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: acento }}>
            <CalendarCheck size={13} /> Examen próximo
          </div>
          <div className="mt-1 font-serif text-xl font-bold uppercase tracking-tight text-stone-900 sm:text-2xl">
            Etapa {e.clave}
          </div>
          <p className="mt-1.5 max-w-xl text-[13px] text-stone-600 sm:text-sm">
            Presentación del <strong className="text-stone-800">examen oficial</strong>.
          </p>
          <div
            className="mt-2.5 inline-flex items-center gap-2 rounded-lg border bg-white/80 px-3 py-1.5 text-[13px] font-bold"
            style={{ borderColor: borde, color: acento }}
          >
            <CalendarCheck size={14} />
            {e.fechaFin ? rangoCorto(e.fecha, e.fechaFin) : fmtLargo(e.fecha)}
          </div>
        </div>
        <div
          className="flex shrink-0 flex-col items-center justify-center rounded-2xl px-4 py-2.5 text-center"
          style={{ background: urgente ? '#fee2e2' : '#fef3c7' }}
        >
          <div className="text-3xl font-bold leading-none" style={{ color: acento, fontFamily: POPPINS }}>{Math.max(0, e.dias)}</div>
          <div className="mt-1 whitespace-pre-line text-[9px] font-semibold uppercase leading-tight tracking-wide" style={{ color: acento }}>
            {e.dias <= 1 ? (e.dias === 0 ? 'es hoy' : 'es mañana') : 'días\nrestantes'}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Banner ligero: próxima ventana (aún no abre) ────────────────────────────
function BannerVentanaProxima({ e }: { e: EventoCalendario }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border p-4" style={{ background: '#eff6ff', borderColor: '#bfdbfe' }}>
      <CalendarClock size={16} style={{ color: '#3b82f6', flexShrink: 0, marginTop: 2 }} />
      <div className="min-w-0">
        <div className="text-sm font-semibold" style={{ color: '#1d4ed8' }}>
          Próxima inscripción y pago — <span className="uppercase">Etapa {e.clave}</span>
        </div>
        <p className="mt-0.5 text-xs leading-relaxed" style={{ color: '#57504a' }}>
          Abre el <strong>{fmtLargo(e.fecha)}</strong> ({enDias(e.dias)}){e.fechaFin ? ` y cierra el ${fmtLargo(e.fechaFin)}` : ''}.
        </p>
      </div>
    </div>
  );
}
