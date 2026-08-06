/**
 * Mis exámenes — todo lo que un alumno necesita saber de un examen al que ya
 * está inscrito, en una sola pantalla y con su entrada propia en el menú.
 *
 * Por qué existe: la información estaba, pero repartida y escondida. La fecha y
 * la hora vivían en una tarjeta del tablero; la sede y el "qué llevar", dentro
 * del pase — y el pase **sólo aparece cuando el pago está verificado**. O sea
 * que un alumno pre-inscrito, que es justo el que más dudas tiene, no podía ver
 * a qué hora ni a dónde tiene que ir.
 *
 * Aquí la regla es al revés: **la información nunca se cobra**. El pase con el
 * código QR sí depende del pago —eso es correcto, sólo se presenta lo pagado—,
 * pero saber cuándo, dónde y qué llevar no depende de nada.
 *
 * Lo que esta pantalla NO tiene, a propósito: un botón de "iniciar examen". El
 * examen del Plan 22 se presenta EN LA SEDE, en papel, y el QR se valida ahí.
 * Un botón que insinúe que se puede contestar en línea mandaría a alguien a
 * quedarse en su casa el día de su examen. Lo que sí se ofrece es prepararse:
 * la prueba de práctica del módulo, que sí es en línea.
 */
import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import {
  CalendarCheck, MapPin, Clock, AlertTriangle, CheckCircle2, CreditCard,
  QrCode, BookOpen, Phone, ChevronRight, GraduationCap, Hourglass,
} from 'lucide-react';
import { EstudianteLayout } from './EstudianteLayout';
import { api, calif10, type ConvocatoriaResponse, type ExamenInscrito } from '../../lib/api';
import { fechaLarga, mayusculaInicial } from '../../lib/fechas';
import { urlComoLlegar } from '../../lib/ubicacionMaps';
import { QUE_LLEVAR, diasHastaExamen, cuandoEs, faseDe, type FaseExamen } from '../../lib/examen';

const GUINDA = 'var(--color-guinda-700)';

/**
 * El estado de cada examen, dicho en una línea.
 *
 * Cada fase trae su propio "y ahora qué": un estado que sólo describe deja al
 * alumno igual de perdido que antes de leerlo.
 */
const FASES: Record<FaseExamen, {
  etiqueta: string;
  color: string;
  fondo: string;
  borde: string;
  queSigue: string;
}> = {
  sin_pago: {
    etiqueta: 'Falta el pago',
    color: '#92400e', fondo: '#fff8ec', borde: '#f6dfae',
    queSigue: 'Tu lugar está apartado, pero el pase con tu código sólo se genera cuando el pago queda verificado. Sin pase no se puede presentar.',
  },
  listo: {
    etiqueta: 'Todo listo',
    color: '#166534', fondo: '#f0fdf4', borde: '#bbf7d0',
    queSigue: 'Ya está pagado. Descarga o imprime tu pase y preséntate el día del examen.',
  },
  hoy: {
    etiqueta: 'Es hoy',
    color: '#9a3412', fondo: '#fff7ed', borde: '#fed7aa',
    queSigue: 'Lleva tu pase y una identificación oficial. Si algo se complica, llama a tu sede.',
  },
  validado: {
    etiqueta: 'Pase validado en sede',
    color: '#166534', fondo: '#f0fdf4', borde: '#bbf7d0',
    queSigue: 'Ya te registraron en la sede. No tienes que hacer nada más.',
  },
  esperando: {
    etiqueta: 'Esperando calificación',
    color: '#3730a3', fondo: '#eef2ff', borde: '#c7d2fe',
    queSigue: 'Ya presentaste. La calificación la carga la coordinación unos días después y te aparecerá en Calificaciones.',
  },
  calificado: {
    etiqueta: 'Calificado',
    color: '#166534', fondo: '#f0fdf4', borde: '#bbf7d0',
    queSigue: 'Tu resultado ya está en Calificaciones.',
  },
};

function Etiqueta({ fase }: { fase: FaseExamen }) {
  const f = FASES[fase];
  return (
    <span
      className="shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold"
      style={{ color: f.color, background: f.fondo, borderColor: f.borde }}
    >
      {f.etiqueta}
    </span>
  );
}

function TarjetaExamen({ ex, destacado }: { ex: ExamenInscrito; destacado: boolean }) {
  const dias = diasHastaExamen(ex.fechaExamen);
  const fase = faseDe(ex);
  const f = FASES[fase];
  const ruta = urlComoLlegar(ex.sede);
  const proximo = dias !== null && dias >= 0;

  return (
    <div
      className="overflow-hidden rounded-2xl border bg-white"
      style={{ borderColor: destacado ? GUINDA : '#e7e0d7', borderWidth: destacado ? 2 : 1 }}
    >
      {/* ── Encabezado: cuándo y qué ──────────────────────────────────── */}
      <div className="flex items-start gap-4 p-4 sm:p-5">
        <div
          className="flex h-[68px] w-[64px] shrink-0 flex-col items-center justify-center rounded-xl text-white"
          style={{ background: proximo ? GUINDA : '#a8a29e' }}
        >
          <span className="font-serif text-[26px] font-bold leading-none">
            {ex.fechaExamen ? Number(ex.fechaExamen.slice(8, 10)) : '—'}
          </span>
          <span className="mt-0.5 text-[10px] font-bold uppercase tracking-widest opacity-80">
            {ex.fechaExamen
              ? new Date(`${ex.fechaExamen}T12:00:00`).toLocaleDateString('es-MX', { month: 'short' }).replace('.', '')
              : ''}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="text-[15px] font-bold leading-snug text-stone-900">
              Módulo {ex.modulo.numero} — {ex.modulo.nombre}
            </h2>
            <Etiqueta fase={fase} />
          </div>
          <p className="mt-1 text-[13px] text-stone-600">
            {mayusculaInicial(fechaLarga(ex.fechaExamen))} · {ex.hora} h
          </p>
          <p className="mt-0.5 text-[12.5px] font-semibold" style={{ color: proximo ? GUINDA : '#78716c' }}>
            {cuandoEs(dias)}
          </p>
        </div>
      </div>

      {/* ── Y ahora qué ───────────────────────────────────────────────── */}
      <div className="mx-4 mb-4 rounded-xl border px-3.5 py-3 sm:mx-5"
           style={{ background: f.fondo, borderColor: f.borde }}>
        <p className="text-[12.5px] leading-relaxed" style={{ color: f.color }}>{f.queSigue}</p>
        {fase === 'calificado' && ex.calificacion !== null && (
          <p className="mt-1.5 text-[13px] font-bold" style={{ color: f.color }}>
            Calificación: {calif10(ex.calificacion)}
          </p>
        )}
      </div>

      {/* ── Dónde ─────────────────────────────────────────────────────── */}
      <div className="border-t px-4 py-4 sm:px-5" style={{ borderColor: '#f0eae2' }}>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg p-2 text-white" style={{ background: GUINDA }}>
            <MapPin size={15} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Tu sede</p>
            <p className="text-[14px] font-semibold text-stone-900">{ex.sede.nombre}</p>
            <p className="text-[12.5px] leading-relaxed text-stone-600">{ex.sede.direccion}</p>
            {ex.sede.telefono && (
              // El teléfono, marcable. El día del examen, perdido y con prisa,
              // nadie copia un número a mano.
              <a href={`tel:${ex.sede.telefono}`}
                 className="mt-1 inline-flex items-center gap-1.5 text-[12.5px] font-semibold"
                 style={{ color: GUINDA }}>
                <Phone size={12} /> {ex.sede.telefono}
              </a>
            )}
            <a href={ruta} target="_blank" rel="noopener noreferrer"
               className="mt-2 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold"
               style={{ borderColor: '#e7e0d7', color: GUINDA }}>
              <MapPin size={13} /> Cómo llegar
            </a>
          </div>
        </div>
      </div>

      {/* ── Qué llevar ────────────────────────────────────────────────── */}
      {fase !== 'esperando' && fase !== 'calificado' && (
        <div className="border-t px-4 py-4 sm:px-5" style={{ borderColor: '#f0eae2' }}>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-stone-400">
            Qué llevar el día del examen
          </p>
          <ul className="space-y-1.5">
            {QUE_LLEVAR.map((q) => (
              <li key={q.texto} className="flex items-start gap-2">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0" style={{ color: GUINDA }} />
                <span className="text-[13px] text-stone-700">
                  {q.texto}
                  {q.detalle && <span className="text-stone-400"> · {q.detalle}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Qué se puede hacer desde aquí ─────────────────────────────── */}
      <div className="flex flex-wrap gap-2 border-t px-4 py-4 sm:px-5" style={{ borderColor: '#f0eae2', background: '#fdfbf8' }}>
        {ex.pagado ? (
          <Link href={`/estudiante/convocatoria/pase/${ex.id}`}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white"
                style={{ background: GUINDA }}>
            <QrCode size={15} /> Ver mi pase
          </Link>
        ) : (
          <Link href="/estudiante/pagos"
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white"
                style={{ background: GUINDA }}>
            <CreditCard size={15} /> Ir a pagar
          </Link>
        )}

        {/* Prepararse SÍ es en línea. Es la única acción de esta pantalla que
            ocurre dentro de la plataforma, y por eso se distingue del pase. */}
        <Link href={`/estudiante/modulos/${ex.modulo.id}`}
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-semibold"
              style={{ borderColor: '#e7e0d7', color: '#57534e' }}>
          <BookOpen size={15} /> Prepararme para este módulo
        </Link>

        <div className="ml-auto self-center font-mono text-[11px] text-stone-400">{ex.folio}</div>
      </div>
    </div>
  );
}

export default function MisExamenes() {
  const [datos, setDatos] = useState<ConvocatoriaResponse | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<ConvocatoriaResponse>('/estudiante/convocatoria')
      .then(setDatos)
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudieron cargar tus exámenes'))
      .finally(() => setCargando(false));
  }, []);

  // Los próximos primero y en orden de cercanía; los ya pasados, después y del
  // más reciente al más viejo. Es el orden en que le importan al alumno.
  const examenes = [...(datos?.misExamenes ?? [])].sort((a, b) => {
    const da = diasHastaExamen(a.fechaExamen) ?? 9999;
    const db = diasHastaExamen(b.fechaExamen) ?? 9999;
    const fa = da >= 0, fb = db >= 0;
    if (fa !== fb) return fa ? -1 : 1;
    return fa ? da - db : db - da;
  });
  const proximos = examenes.filter((e) => (diasHastaExamen(e.fechaExamen) ?? -1) >= 0);
  const pasados = examenes.filter((e) => (diasHastaExamen(e.fechaExamen) ?? -1) < 0);

  return (
    <EstudianteLayout>
      <div className="mx-auto max-w-3xl px-1 py-2">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl"
               style={{ background: 'var(--color-crema-100)', color: GUINDA }}>
            <CalendarCheck size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-stone-900">Mis exámenes</h1>
            <p className="mt-0.5 text-sm text-stone-500">
              Cuándo, dónde y qué llevar. Todo lo de cada examen al que estás inscrito.
            </p>
          </div>
        </div>

        {cargando && (
          <div className="rounded-2xl border bg-white p-10 text-center text-sm text-stone-400"
               style={{ borderColor: '#e7e0d7' }}>
            Cargando tus exámenes…
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2.5 rounded-2xl border p-4"
               style={{ borderColor: '#fecaca', background: '#fef2f2' }}>
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-600" />
            <p className="text-[13px] text-red-700">{error}</p>
          </div>
        )}

        {!cargando && !error && examenes.length === 0 && (
          <div className="rounded-2xl border bg-white px-6 py-12 text-center" style={{ borderColor: '#e7e0d7' }}>
            <GraduationCap size={32} className="mx-auto mb-3 text-stone-300" />
            <p className="text-[15px] font-semibold text-stone-700">Todavía no estás inscrito a ningún examen</p>
            <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-stone-500">
              Cuando te inscribas a una convocatoria, aquí aparecerá cada examen con su fecha,
              su hora, tu sede y todo lo que necesitas llevar.
            </p>
            <Link href="/estudiante/convocatoria"
                  className="mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white"
                  style={{ background: GUINDA }}>
              Ir a Inscripción <ChevronRight size={15} />
            </Link>
          </div>
        )}

        {proximos.length > 0 && (
          <div className="space-y-4">
            {proximos.map((ex, i) => (
              <TarjetaExamen key={ex.id} ex={ex} destacado={i === 0} />
            ))}
          </div>
        )}

        {pasados.length > 0 && (
          <>
            <div className="mb-3 mt-8 flex items-center gap-2">
              <Hourglass size={15} className="text-stone-400" />
              <h2 className="text-[13px] font-bold uppercase tracking-widest text-stone-400">
                Exámenes que ya presentaste
              </h2>
            </div>
            <div className="space-y-4">
              {pasados.map((ex) => (
                <TarjetaExamen key={ex.id} ex={ex} destacado={false} />
              ))}
            </div>
          </>
        )}

        {examenes.length > 0 && (
          <div className="mt-6 flex items-start gap-2.5 rounded-xl border px-4 py-3"
               style={{ borderColor: '#e7e0d7', background: '#fdfbf8' }}>
            <Clock size={14} className="mt-0.5 shrink-0 text-stone-400" />
            <p className="text-[12px] leading-relaxed text-stone-500">
              El examen se presenta <strong>en la sede</strong>, en papel. No se contesta desde
              la plataforma: aquí llevas tu pase, tus datos y tu preparación.
            </p>
          </div>
        )}
      </div>
    </EstudianteLayout>
  );
}
