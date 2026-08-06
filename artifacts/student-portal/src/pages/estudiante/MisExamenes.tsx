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
 *
 * ── Sobre cómo se ve ────────────────────────────────────────────────────────
 *
 * La jerarquía la manda una sola pregunta: «¿cuándo y a qué hora?». Todo lo
 * demás —el módulo, el estado, el folio— es contexto de esa respuesta, así que
 * la cuenta regresiva, la fecha y la hora van en una banda propia, grandes, y
 * el resto abajo. La textura de puntos de esa banda es CSS, no una imagen: no
 * pesa, no se pixelea y se ve igual en un teléfono de gama baja.
 */
import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import {
  CalendarCheck, MapPin, Clock, AlertTriangle, CheckCircle2, CreditCard,
  QrCode, BookOpen, Phone, ChevronRight, Hourglass, Circle,
} from 'lucide-react';
import { EstudianteLayout } from './EstudianteLayout';
import { api, calif10, type ConvocatoriaResponse, type ExamenInscrito } from '../../lib/api';
import { fechaLarga, mayusculaInicial } from '../../lib/fechas';
import { urlComoLlegar } from '../../lib/ubicacionMaps';
import { ILLUSTRATIONS } from '../../components/onboarding/TourIllustrations';
import { QUE_LLEVAR, diasHastaExamen, cuandoEs, faseDe, type FaseExamen } from '../../lib/examen';

const GUINDA = 'var(--color-guinda-700)';

/**
 * La textura de la banda: una retícula de puntos, en CSS.
 *
 * Es lo que le da el aire técnico sin salirse de la marca institucional —un
 * degradado de colores ajenos aquí se vería como otra aplicación—. Va bajita a
 * propósito: tiene que leerse como material, no como decoración que compite con
 * la fecha, que es lo único que la persona vino a leer.
 */
const RETICULA: React.CSSProperties = {
  backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.20) 1px, transparent 1px)',
  backgroundSize: '13px 13px',
};

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

/**
 * Los cuatro pasos de un examen.
 *
 * No es adorno: contesta «¿voy bien?», que es la segunda pregunta de quien abre
 * esta pantalla. Cada paso se enciende con un dato REAL de la base —no con una
 * suposición—, así que si algo no avanza es porque de verdad no ha avanzado.
 */
function Pasos({ ex }: { ex: ExamenInscrito }) {
  const pasos = [
    { label: 'Inscrito', hecho: true },
    { label: 'Pagado', hecho: ex.pagado },
    { label: 'En la sede', hecho: ex.estado === 'pase_validado' },
    { label: 'Calificado', hecho: ex.calificacion !== null && ex.calificacion !== undefined },
  ];
  return (
    <div className="flex items-center gap-1 px-4 py-3 sm:px-5" style={{ background: '#fdfbf8' }}>
      {pasos.map((p, i) => (
        <div key={p.label} className="flex flex-1 items-center gap-1">
          <div className="flex min-w-0 flex-col items-center gap-1">
            {p.hecho
              ? <CheckCircle2 size={15} style={{ color: GUINDA }} className="shrink-0" />
              : <Circle size={15} className="shrink-0 text-stone-300" />}
            <span
              className="truncate text-[10px] font-semibold uppercase tracking-wide"
              style={{ color: p.hecho ? GUINDA : '#a8a29e' }}
            >
              {p.label}
            </span>
          </div>
          {i < pasos.length - 1 && (
            <div
              className="mb-4 h-[2px] flex-1 rounded-full"
              style={{ background: pasos[i + 1].hecho ? GUINDA : '#e7e0d7' }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function TarjetaExamen({ ex, destacado }: { ex: ExamenInscrito; destacado: boolean }) {
  const dias = diasHastaExamen(ex.fechaExamen);
  const fase = faseDe(ex);
  const f = FASES[fase];
  const ruta = urlComoLlegar(ex.sede);
  const proximo = dias !== null && dias >= 0;

  // El número grande de la cuenta regresiva. "HOY" en letra en vez de un 0:
  // un cero grandote en la pantalla del día del examen se lee como un error.
  const contador = dias === null ? '—' : dias === 0 ? 'HOY' : dias > 0 ? String(dias) : '✓';
  const contadorPie = dias === null ? '' : dias === 0 ? '' : dias === 1 ? 'día' : dias > 1 ? 'días' : 'presentado';

  return (
    <article
      className="overflow-hidden rounded-2xl border bg-white"
      style={{
        borderColor: destacado ? GUINDA : '#e7e0d7',
        borderWidth: destacado ? 2 : 1,
        boxShadow: destacado ? '0 12px 30px -18px rgba(74,14,32,0.45)' : 'none',
      }}
    >
      {/* ── Banda: cuándo, que es lo único que se vino a leer ──────────── */}
      <div
        className="relative px-4 pb-4 pt-4 text-white sm:px-5"
        style={{
          background: proximo
            ? 'linear-gradient(135deg, #6B1530 0%, #8d2043 55%, #4A0E20 100%)'
            : 'linear-gradient(135deg, #57534e 0%, #44403c 100%)',
        }}
      >
        <div className="pointer-events-none absolute inset-0" style={RETICULA} aria-hidden />

        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
                Módulo {ex.modulo.numero}
              </p>
              <h2 className="mt-0.5 font-serif text-[19px] font-bold leading-snug sm:text-[21px]">
                {ex.modulo.nombre}
              </h2>
            </div>
            <span
              className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={{ color: f.color, background: f.fondo }}
            >
              {f.etiqueta}
            </span>
          </div>

          <div className="mt-4 flex items-center gap-4">
            {/* Cuenta regresiva */}
            <div
              className="flex h-[76px] w-[76px] shrink-0 flex-col items-center justify-center rounded-2xl border"
              style={{ background: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.22)' }}
            >
              <span className="font-serif text-[30px] font-bold leading-none tracking-tight">{contador}</span>
              {contadorPie && (
                <span className="mt-1 text-[10px] font-bold uppercase tracking-widest text-white/70">
                  {contadorPie}
                </span>
              )}
            </div>

            {/* Fecha y hora: grandes y en negritas, que es lo que se pidió y
                además lo correcto — es el dato por el que se entra aquí. */}
            <div className="min-w-0">
              <p className="font-serif text-[17px] font-bold leading-tight sm:text-[19px]">
                {mayusculaInicial(fechaLarga(ex.fechaExamen))}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-[17px] font-bold sm:text-[19px]">
                <Clock size={16} className="shrink-0 text-white/70" />
                {ex.hora} h
              </p>
              {proximo && (
                <p className="mt-0.5 text-[12px] font-semibold text-white/70">{cuandoEs(dias)}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <Pasos ex={ex} />

      {/* ── Y ahora qué ───────────────────────────────────────────────── */}
      <div className="border-t px-4 py-4 sm:px-5" style={{ borderColor: '#f0eae2' }}>
        <div className="rounded-xl border px-3.5 py-3" style={{ background: f.fondo, borderColor: f.borde }}>
          <p className="text-[12.5px] leading-relaxed" style={{ color: f.color }}>{f.queSigue}</p>
          {fase === 'calificado' && ex.calificacion !== null && (
            <p className="mt-1.5 text-[14px] font-bold" style={{ color: f.color }}>
              Calificación: {calif10(ex.calificacion)}
            </p>
          )}
        </div>
      </div>

      {/* ── Dónde ─────────────────────────────────────────────────────── */}
      <div className="border-t px-4 py-4 sm:px-5" style={{ borderColor: '#f0eae2' }}>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg p-2 text-white" style={{ background: GUINDA }}>
            <MapPin size={15} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Tu sede</p>
            <p className="text-[14.5px] font-bold text-stone-900">{ex.sede.nombre}</p>
            <p className="text-[12.5px] leading-relaxed text-stone-600">{ex.sede.direccion}</p>

            {/* En una fila propia, con separación. Antes el teléfono y el botón
                eran los dos `inline-flex` sueltos, así que caían en la misma
                línea y el botón se montaba encima del número. */}
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {ex.sede.telefono && (
                // Marcable: el día del examen, perdido y con prisa, nadie copia
                // un número a mano.
                <a
                  href={`tel:${ex.sede.telefono}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold"
                  style={{ borderColor: '#e7e0d7', color: GUINDA }}
                >
                  <Phone size={13} /> {ex.sede.telefono}
                </a>
              )}
              <a
                href={ruta}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold"
                style={{ borderColor: '#e7e0d7', color: GUINDA }}
              >
                <MapPin size={13} /> Cómo llegar
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ── Qué llevar ────────────────────────────────────────────────── */}
      {fase !== 'esperando' && fase !== 'calificado' && (
        <div className="border-t px-4 py-4 sm:px-5" style={{ borderColor: '#f0eae2' }}>
          <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-stone-400">
            Qué llevar el día del examen
          </p>
          <ul className="space-y-2">
            {QUE_LLEVAR.map((q) => (
              <li key={q.texto} className="flex items-start gap-2.5">
                <CheckCircle2 size={15} className="mt-0.5 shrink-0" style={{ color: GUINDA }} />
                <span className="text-[13.5px] leading-snug text-stone-800">
                  {q.texto}
                  {q.detalle && <span className="block text-[12px] text-stone-400">{q.detalle}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Qué se puede hacer desde aquí ─────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-t px-4 py-4 sm:px-5"
           style={{ borderColor: '#f0eae2', background: '#fdfbf8' }}>
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

        <div className="ml-auto font-mono text-[11px] text-stone-400">{ex.folio}</div>
      </div>
    </article>
  );
}

/**
 * Cuando todavía no hay ningún examen.
 *
 * No es una pantalla de error ni un hueco: es la primera vez que alguien entra
 * aquí, y lo que necesita no es que le confirmen que no hay nada, sino saber
 * **cómo llegar a tenerlo**. Por eso enseña el camino completo —los mismos
 * cuatro pasos del tutorial, para que no aprenda dos modelos distintos de lo
 * mismo— y remata con la única acción que lo mueve de aquí.
 */
function SinExamenes() {
  const Camino = ILLUSTRATIONS.caminoAlumno;
  return (
    <div className="overflow-hidden rounded-2xl border bg-white" style={{ borderColor: '#e7e0d7' }}>
      <div className="relative px-5 pb-6 pt-7 text-center text-white"
           style={{ background: 'linear-gradient(135deg, #6B1530 0%, #8d2043 55%, #4A0E20 100%)' }}>
        <div className="pointer-events-none absolute inset-0" style={RETICULA} aria-hidden />
        <div className="relative">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border"
               style={{ background: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.22)' }}>
            <CalendarCheck size={22} />
          </div>
          <h2 className="font-serif text-[19px] font-bold">Todavía no tienes exámenes</h2>
          <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-white/75">
            Cuando te inscribas a una convocatoria, cada examen aparecerá aquí con su fecha,
            su hora, tu sede y todo lo que necesitas llevar.
          </p>
        </div>
      </div>

      <div className="px-5 py-6">
        <p className="mb-4 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">
          Tu camino son cuatro pasos
        </p>
        {Camino && <Camino />}

        <div className="mt-6 flex flex-col items-center gap-2.5">
          <Link href="/estudiante/convocatoria"
                className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-[14px] font-semibold text-white"
                style={{ background: GUINDA }}>
            Ir a Inscripción <ChevronRight size={16} />
          </Link>
          <Link href="/estudiante/expediente"
                className="text-[12.5px] font-semibold text-stone-500 hover:underline">
            Antes tengo que completar mi expediente
          </Link>
        </div>
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

        {!cargando && !error && examenes.length === 0 && <SinExamenes />}

        {proximos.length > 0 && (
          <div className="space-y-5">
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
            <div className="space-y-5">
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
