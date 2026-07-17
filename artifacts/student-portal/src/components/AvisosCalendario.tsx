/**
 * AvisosCalendario — banners de FECHAS calculados en vivo del calendario oficial
 * de etapas. Regla general del portal: cuando la ventana de INSCRIPCIÓN Y PAGO de
 * una etapa está abierta, se muestra un banner PROMINENTE con la etapa en grande,
 * el rango de fechas (del → al) y la cuenta regresiva. Igual para el examen próximo.
 * Se usa en el inicio de alumno, gestor y admin. Siempre al día, sin cron.
 */
import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { CalendarClock, CalendarCheck, AlertTriangle, ChevronRight, Download } from 'lucide-react';
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

/**
 * `ocultarExamen`: en el inicio del ALUMNO no mostramos el banner GENÉRICO de
 * "examen próximo" del calendario (puede ser de otra etapa donde el alumno no
 * está inscrito y confunde). El alumno tiene su tarjeta personal "Tu próximo
 * examen". El gestor sí ve el calendario completo.
 */
export function AvisosCalendario({ ocultarExamen = false, hrefInscripcion, dataTour, examenGestor = false }: { ocultarExamen?: boolean; hrefInscripcion?: string; dataTour?: string; examenGestor?: boolean } = {}) {
  const [eventos, setEventos] = useState<EventoCalendario[]>([]);

  useEffect(() => {
    let alive = true;
    api.get<{ eventos: EventoCalendario[] }>('/anuncios/calendario')
      .then((r) => { if (alive) setEventos(r.eventos ?? []); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const visibles = ocultarExamen ? eventos.filter((e) => e.tipo !== 'examen') : eventos;
  // Si no hay ventana/examen próximo no renderiza nada: así el tour de esta
  // sección no encuentra el anclaje y su tarjeta se centra (caso alumno nuevo).
  if (visibles.length === 0) return null;

  return (
    <div data-tour={dataTour} className="space-y-3">
      {visibles.map((e, i) => {
        if (e.tipo === 'ventana_abierta') return <BannerVentanaAbierta key={i} e={e} href={hrefInscripcion} />;
        if (e.tipo === 'examen') return <BannerExamen key={i} e={e} gestor={examenGestor} />;
        return <BannerVentanaProxima key={i} e={e} />;
      })}
    </div>
  );
}

// ── Banner PROMINENTE: inscripción y pago abiertos ──────────────────────────
// Si recibe `href`, todo el banner es clickeable y lleva a la inscripción.
function BannerVentanaAbierta({ e, href }: { e: EventoCalendario; href?: string }) {
  const urgente = e.urgencia === 'alta';
  const acento = urgente ? '#be123c' : '#b45309';
  const borde = urgente ? '#fecdd3' : '#fde68a';
  const contenido = (
    <div className="relative flex flex-col gap-3 overflow-hidden p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      {/* Circulitos decorativos (estilo Modula) */}
      <div className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full" style={{ background: `${acento}0d` }} />
      <div className="pointer-events-none absolute right-20 -bottom-16 h-36 w-36 rounded-full" style={{ background: `${acento}08` }} />
      <div className="pointer-events-none absolute -left-8 -bottom-12 h-28 w-28 rounded-full" style={{ background: `${acento}06` }} />
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: acento }}>
          {urgente ? <AlertTriangle size={13} /> : <CalendarClock size={13} />}
          Inscripción y pago abiertos
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 font-serif text-xl font-bold uppercase tracking-tight text-stone-900 sm:text-2xl">
          Etapa {e.clave}
          {href && <ChevronRight size={20} className="transition-transform group-hover:translate-x-1" style={{ color: acento }} />}
        </div>
        <p className="mt-1.5 max-w-xl text-[13px] text-stone-600 sm:text-sm">
          La ventana para <strong className="text-stone-800">inscribir y pagar tu examen</strong> está abierta.
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {e.fechaInicio && (
            <span
              className="inline-flex items-center gap-2 rounded-lg border bg-white/80 px-3 py-1.5 text-[13px] font-bold"
              style={{ borderColor: borde, color: acento }}
            >
              <CalendarClock size={14} />
              {rangoLargo(e.fechaInicio, e.fecha)}
            </span>
          )}
          {e.fechaInicio && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold"
              style={{ borderColor: borde, background: urgente ? '#fff1f2' : '#fffbeb', color: acento }}
            >
              <CalendarCheck size={12} />
              Solo en estas fechas
            </span>
          )}
        </div>
        <p className="mt-1.5 text-[11px] text-stone-500">
          Fuera de estas fechas no es posible inscribir ni pagar el examen.
        </p>
        {href && (
          <span className="mt-2 inline-flex items-center gap-1 text-[13px] font-bold underline decoration-2 underline-offset-2" style={{ color: acento }}>
            Ir a mi inscripción <ChevronRight size={14} />
          </span>
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
  );
  const cls = 'block overflow-hidden rounded-2xl border-2 shadow-sm';
  const style = { borderColor: borde, background: `linear-gradient(135deg, ${urgente ? '#fff1f2' : '#fffbeb'} 0%, #ffffff 70%)` };
  return href ? (
    <Link href={href} className={`${cls} group cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md`} style={style} aria-label={`Ir a la inscripción de la etapa ${e.clave}`}>
      {contenido}
    </Link>
  ) : (
    <div className={cls} style={style}>{contenido}</div>
  );
}

// ── Banner PROMINENTE: examen próximo ───────────────────────────────────────
// Para el GESTOR el examen NO es urgencia suya: él no evalúa, solo acompaña a
// sus alumnos. Por eso se muestra en tono MORADO (informativo) y con un botón
// para descargar la lista de alumnos que participan. Para el alumno/admin
// mantiene el tono de urgencia (rojo/ámbar) según los días restantes.
function BannerExamen({ e, gestor = false }: { e: EventoCalendario; gestor?: boolean }) {
  const urgente = !gestor && e.urgencia === 'alta';
  const acento = gestor ? '#6d28d9' : urgente ? '#be123c' : '#b45309';
  const borde = gestor ? '#ddd6fe' : urgente ? '#fecdd3' : '#fde68a';
  const bg = gestor ? '#f5f3ff' : urgente ? '#fff1f2' : '#fffbeb';
  const countBg = gestor ? '#ede9fe' : urgente ? '#fee2e2' : '#fef3c7';
  return (
    <div
      className="overflow-hidden rounded-2xl border-2 shadow-sm"
      style={{ borderColor: borde, background: `linear-gradient(135deg, ${bg} 0%, #ffffff 70%)` }}
    >
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: acento }}>
            <CalendarCheck size={13} /> {gestor ? 'Examen de tus alumnos' : 'Examen próximo'}
          </div>
          <div className="mt-1 font-serif text-xl font-bold uppercase tracking-tight text-stone-900 sm:text-2xl">
            Etapa {e.clave}
          </div>
          <p className="mt-1.5 max-w-xl text-[13px] text-stone-600 sm:text-sm">
            {gestor
              ? <>Tus alumnos presentan su <strong className="text-stone-800">examen oficial</strong>. Acompáñalos y ten lista tu documentación.</>
              : <>Presentación del <strong className="text-stone-800">examen oficial</strong>.</>}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <div
              className="inline-flex items-center gap-2 rounded-lg border bg-white/80 px-3 py-1.5 text-[13px] font-bold"
              style={{ borderColor: borde, color: acento }}
            >
              <CalendarCheck size={14} />
              {e.fechaFin ? rangoCorto(e.fecha, e.fechaFin) : fmtLargo(e.fecha)}
            </div>
            {gestor && (
              <a
                href={`/api/gestor/etapas/${encodeURIComponent(e.clave)}/participantes.csv`}
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-bold transition-colors hover:bg-white"
                style={{ borderColor: borde, background: '#ffffffcc', color: acento }}
              >
                <Download size={14} /> Descargar lista de alumnos
              </a>
            )}
          </div>
        </div>
        <div
          className="flex shrink-0 flex-col items-center justify-center rounded-2xl px-4 py-2.5 text-center"
          style={{ background: countBg }}
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
