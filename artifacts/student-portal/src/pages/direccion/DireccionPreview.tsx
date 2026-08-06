/**
 * Vista previa — panel del CREADOR (Synapsis).
 *
 * Para qué existe: la plataforma se va a seguir mejorando, y hay decisiones que
 * no se pueden tomar leyendo código —cómo se le avisa al alumno que tiene
 * examen, cómo se ve "Mi aula" desde el centro, qué encuentra un administrador
 * al entrar—. Hay que MIRARLO. Hasta hoy la única forma era pedir una
 * contraseña prestada o abrir la cuenta de alguien, y las dos son inaceptables:
 * una regala el acceso y la otra ensucia la bitácora, porque queda registrado
 * como si esa persona hubiera entrado.
 *
 * Lo que se ve aquí es la aplicación de verdad, con los datos de verdad,
 * servida por los mismos manejadores del rol real. No es una maqueta: no puede
 * quedarse vieja a la primera mejora, porque no hay una segunda copia que
 * mantener.
 *
 * Y es de SÓLO LECTURA, con el candado en el servidor y no en esta pantalla
 * (ver `middleware/preview.ts` en el API). Aquí no se puede guardar nada en
 * nombre de nadie, ni por accidente ni a propósito.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MonitorSmartphone, Search, Smartphone, Monitor, Tablet, RotateCw, ExternalLink,
  Eye, GraduationCap, Building2, ShieldCheck, Lock, X, Maximize2, Minimize2,
} from 'lucide-react';
import { DireccionLayout } from './DireccionLayout';
import { api } from '../../lib/api';
import { BASE_ESTADO } from '../../lib/estado';
import { marcaDeMarco } from '../../lib/preview';

type Rol = 'estudiante' | 'gestor' | 'admin';

interface Candidato {
  userId: number;
  nombre: string;
  email: string;
  activo: boolean;
  detalle: string;
}

const ROLES: { id: Rol; label: string; icono: typeof GraduationCap; inicio: string }[] = [
  { id: 'estudiante', label: 'Alumno',         icono: GraduationCap, inicio: '/estudiante' },
  { id: 'gestor',     label: 'Centro',         icono: Building2,     inicio: '/gestor' },
  { id: 'admin',      label: 'Administración', icono: ShieldCheck,   inicio: '/admin' },
];

/**
 * Los atajos.
 *
 * No son un menú alternativo: son las pantallas sobre las que hay que decidir
 * algo. Puestas a un clic porque la alternativa —navegar hasta ellas dentro del
 * marco, cada vez, para cada persona— es lo que hace que al final no se revisen.
 */
const ATAJOS: Record<Rol, { ruta: string; label: string }[]> = {
  estudiante: [
    { ruta: '/estudiante', label: 'Inicio' },
    { ruta: '/estudiante/convocatoria', label: 'Convocatoria' },
    { ruta: '/estudiante/modulos', label: 'Mis módulos' },
    { ruta: '/estudiante/calificaciones', label: 'Calificaciones' },
    { ruta: '/estudiante/pagos', label: 'Pagos' },
    { ruta: '/estudiante/expediente', label: 'Expediente' },
    { ruta: '/estudiante/aula', label: 'Aula' },
    { ruta: '/estudiante/avisos', label: 'Avisos' },
    { ruta: '/estudiante/calendario', label: 'Calendario' },
    { ruta: '/estudiante/perfil', label: 'Perfil' },
  ],
  gestor: [
    { ruta: '/gestor', label: 'Inicio' },
    { ruta: '/gestor/alumnos', label: 'Alumnos' },
    { ruta: '/gestor/inscripcion', label: 'Inscripción' },
    { ruta: '/gestor/calificaciones', label: 'Calificaciones' },
    { ruta: '/gestor/pagos', label: 'Pagos' },
    { ruta: '/gestor/aula', label: 'Mi aula' },
    { ruta: '/gestor/calendario', label: 'Calendario' },
    { ruta: '/gestor/faq', label: 'Preguntas' },
  ],
  admin: [
    { ruta: '/admin', label: 'Inicio' },
    { ruta: '/admin/alumnos', label: 'Alumnos' },
    { ruta: '/admin/convocatorias', label: 'Convocatorias' },
    { ruta: '/admin/gestores', label: 'Centros' },
    { ruta: '/admin/pagos', label: 'Pagos' },
    { ruta: '/admin/reportes', label: 'Reportes' },
  ],
};

/**
 * Los aparatos, con MEDIDAS REALES.
 *
 * Esto es lo que hace que la vista previa sirva para juzgar. Un marco que
 * simplemente ocupa el ancho disponible —unos 950 px dentro del panel— le hace
 * creer a la aplicación que está en una pantalla mediana, y lo que se ve es el
 * diseño de TABLETA. Se estaría revisando una pantalla que ningún usuario tiene.
 *
 * Así que el marco se pinta a su tamaño de verdad (1440 px de ancho para
 * escritorio) y después se REDUCE con `transform: scale`. La aplicación de
 * adentro sigue midiendo 1440 y aplica sus reglas de escritorio; lo que se
 * encoge es la imagen, como una maqueta a escala. Se ve más chico, pero se ve
 * lo que hay.
 *
 * El teléfono va primero porque es como entra casi toda la gente.
 */
const APARATOS = [
  { id: 'telefono',   label: 'Teléfono',   icono: Smartphone, ancho: 390,  alto: 844, radio: 26 },
  { id: 'tableta',    label: 'Tableta',    icono: Tablet,     ancho: 820,  alto: 1100, radio: 18 },
  { id: 'escritorio', label: 'Escritorio', icono: Monitor,    ancho: 1440, alto: 900, radio: 10 },
] as const;

export default function DireccionPreview() {
  const [rol, setRol] = useState<Rol>('estudiante');
  const [busqueda, setBusqueda] = useState('');
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [elegido, setElegido] = useState<Candidato | null>(null);
  const [ruta, setRuta] = useState<string>('/estudiante');
  const [aparato, setAparato] = useState<(typeof APARATOS)[number]['id']>('telefono');
  // Cuando se expande, la columna de selección se esconde y el marco se queda
  // con todo el ancho: es la diferencia entre ver el escritorio al 60% y verlo
  // casi a tamaño real.
  const [expandido, setExpandido] = useState(false);
  // Cambiar esto obliga al marco a remontarse: es la forma de recargar sin
  // depender de tocar el `contentWindow`, que aquí no hace falta.
  const [generacion, setGeneracion] = useState(0);

  // La lista, con freno: se escribe en la caja y se consulta 300 ms después de
  // parar. Sin esto son diez consultas para escribir un apellido.
  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError(null);
    const t = setTimeout(() => {
      api.get<Candidato[]>(`/direccion/preview/candidatos?rol=${rol}&q=${encodeURIComponent(busqueda)}`)
        .then((r) => { if (vivo) setCandidatos(r); })
        .catch((e) => { if (vivo) setError(e instanceof Error ? e.message : 'No se pudo cargar la lista'); })
        .finally(() => { if (vivo) setCargando(false); });
    }, 300);
    return () => { vivo = false; clearTimeout(t); };
  }, [rol, busqueda]);

  function abrir(c: Candidato) {
    setElegido(c);
    setRuta(ROLES.find((r) => r.id === rol)!.inicio);
    setGeneracion((g) => g + 1);
  }

  function irA(destino: string) {
    setRuta(destino);
    setGeneracion((g) => g + 1);
  }

  const marco = APARATOS.find((a) => a.id === aparato)!;

  // Cuánto espacio hay de verdad para pintar el marco. Se mide en lugar de
  // suponerse: cambia al esconder la columna, al girar la tableta y al
  // arrastrar el borde de la ventana.
  const cajaRef = useRef<HTMLDivElement | null>(null);
  const [anchoCaja, setAnchoCaja] = useState(0);
  const medir = useCallback((n: HTMLDivElement | null) => {
    cajaRef.current = n;
    if (n) setAnchoCaja(n.clientWidth);
  }, []);
  useEffect(() => {
    const n = cajaRef.current;
    if (!n || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setAnchoCaja(e.contentRect.width));
    ro.observe(n);
    return () => ro.disconnect();
  }, [elegido, expandido]);

  // Nunca se agranda: un marco de teléfono estirado a 1200 px sería otra
  // mentira, la contraria.
  const escala = anchoCaja > 0 ? Math.min(1, (anchoCaja - 24) / marco.ancho) : 1;
  const url = useMemo(
    () => (elegido ? `${BASE_ESTADO}${ruta}?preview=${elegido.userId}` : ''),
    [elegido, ruta],
  );

  return (
    <DireccionLayout>
      <div className="mx-auto max-w-[1400px] px-1 py-2">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: 'var(--color-crema-100)', color: 'var(--color-guinda-700)' }}>
            <MonitorSmartphone size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-stone-900">Vista previa</h1>
            <p className="mt-0.5 text-sm text-stone-500">
              Ver la plataforma con los ojos de un alumno, un centro o un administrador — sin entrar a su cuenta.
            </p>
          </div>
        </div>

        {/* Qué es y qué no es. Va arriba y no escondido en un "más información":
            quien usa esto necesita saber, antes de mirar, que lo que ve es real
            y que no puede tocarlo. */}
        <div className="mb-5 flex items-start gap-2.5 rounded-xl border px-4 py-3"
             style={{ borderColor: '#f6dfae', background: '#fff8ec' }}>
          <Lock size={15} className="mt-0.5 shrink-0" style={{ color: '#92400e' }} />
          <div className="text-[13px] leading-relaxed" style={{ color: '#7c5314' }}>
            <strong>Sólo lectura.</strong> Son los datos reales y en vivo de esa persona, servidos por
            las mismas pantallas que ella usa — pero no se puede guardar nada en su nombre: el candado
            está en el servidor. Cada vista previa queda asentada en la bitácora con quién miró y a quién.
          </div>
        </div>

        <div className={`grid gap-5 ${expandido ? '' : 'lg:grid-cols-[340px_1fr]'}`}>
          {/* ── Columna de selección ─────────────────────────────────────── */}
          <div className={`rounded-2xl border bg-white p-4 ${expandido ? 'hidden' : ''}`} style={{ borderColor: '#eadfd7' }}>
            <div className="mb-3 flex gap-1.5">
              {ROLES.map((r) => {
                const Icono = r.icono;
                const activo = r.id === rol;
                return (
                  <button
                    key={r.id}
                    onClick={() => { setRol(r.id); setBusqueda(''); }}
                    className="flex flex-1 flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-[11.5px] font-semibold transition"
                    style={{
                      borderColor: activo ? 'var(--color-guinda-700)' : '#eadfd7',
                      background: activo ? '#f8f4ec' : 'white',
                      color: activo ? 'var(--color-guinda-800)' : '#57534e',
                    }}
                  >
                    <Icono size={16} />
                    {r.label}
                  </button>
                );
              })}
            </div>

            <div className="relative mb-3">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder={rol === 'estudiante' ? 'Nombre, matrícula o correo' : 'Nombre o correo'}
                className="w-full rounded-xl border py-2 pl-9 pr-3 text-sm outline-none focus:border-stone-400"
                style={{ borderColor: '#eadfd7' }}
              />
            </div>

            <div className="max-h-[560px] overflow-y-auto pr-1">
              {cargando && <p className="px-1 py-6 text-center text-[13px] text-stone-400">Buscando…</p>}
              {error && <p className="px-1 py-6 text-center text-[13px] text-red-700">{error}</p>}
              {!cargando && !error && candidatos.length === 0 && (
                <p className="px-1 py-6 text-center text-[13px] text-stone-400">
                  {busqueda ? 'Nadie con ese nombre.' : 'No hay cuentas de este tipo.'}
                </p>
              )}
              {candidatos.map((c) => {
                const activo = elegido?.userId === c.userId;
                return (
                  <button
                    key={c.userId}
                    onClick={() => abrir(c)}
                    className="mb-1 w-full rounded-xl border px-3 py-2.5 text-left transition"
                    style={{
                      borderColor: activo ? 'var(--color-guinda-700)' : 'transparent',
                      background: activo ? '#f8f4ec' : '#faf7f3',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13.5px] font-semibold text-stone-900">{c.nombre}</span>
                      {!c.activo && (
                        <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide"
                              style={{ background: '#fee2e2', color: '#991b1b' }}>Baja</span>
                      )}
                    </div>
                    <div className="truncate text-[11.5px] text-stone-500">{c.detalle}</div>
                    <div className="truncate text-[11px] text-stone-400">{c.email}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── El marco ─────────────────────────────────────────────────── */}
          <div className="rounded-2xl border bg-white p-4" style={{ borderColor: '#eadfd7' }}>
            {!elegido ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center px-6 text-center">
                <Eye size={30} className="mb-3 text-stone-300" />
                <p className="text-[14px] font-semibold text-stone-600">Elige a alguien de la lista</p>
                <p className="mt-1 max-w-sm text-[12.5px] leading-relaxed text-stone-400">
                  Se abrirá su portal tal como lo ve, con sus datos de hoy. Empieza en el teléfono:
                  es como entra la mayoría.
                </p>
              </div>
            ) : (
              <>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-bold text-stone-900">
                      Viendo como {elegido.nombre}
                    </div>
                    <div className="truncate text-[11.5px] text-stone-500">{elegido.detalle} · {elegido.email}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {APARATOS.map((a) => {
                      const Icono = a.icono;
                      const on = a.id === aparato;
                      return (
                        <button
                          key={a.id}
                          onClick={() => setAparato(a.id)}
                          title={a.label}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border transition"
                          style={{
                            borderColor: on ? 'var(--color-guinda-700)' : '#eadfd7',
                            background: on ? '#f8f4ec' : 'white',
                            color: on ? 'var(--color-guinda-800)' : '#78716c',
                          }}
                        >
                          <Icono size={15} />
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setExpandido((v) => !v)}
                      title={expandido ? 'Mostrar la lista' : 'Esconder la lista y ganar ancho'}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border"
                      style={{ borderColor: '#eadfd7', color: '#78716c' }}
                    >
                      {expandido ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    </button>
                    <button
                      onClick={() => setGeneracion((g) => g + 1)}
                      title="Recargar"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border"
                      style={{ borderColor: '#eadfd7', color: '#78716c' }}
                    >
                      <RotateCw size={14} />
                    </button>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir en una pestaña aparte"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border"
                      style={{ borderColor: '#eadfd7', color: '#78716c' }}
                    >
                      <ExternalLink size={14} />
                    </a>
                    <button
                      onClick={() => setElegido(null)}
                      title="Cerrar"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border"
                      style={{ borderColor: '#eadfd7', color: '#78716c' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>

                <div className="mb-3 flex flex-wrap gap-1.5">
                  {ATAJOS[rol].map((a) => {
                    const on = ruta === a.ruta;
                    return (
                      <button
                        key={a.ruta}
                        onClick={() => irA(a.ruta)}
                        className="rounded-full border px-2.5 py-1 text-[11.5px] transition"
                        style={{
                          borderColor: on ? 'var(--color-guinda-700)' : '#eadfd7',
                          background: on ? '#f8f4ec' : 'white',
                          color: on ? 'var(--color-guinda-800)' : '#57534e',
                          fontWeight: on ? 600 : 400,
                        }}
                      >
                        {a.label}
                      </button>
                    );
                  })}
                </div>

                <div ref={medir} className="flex justify-center rounded-xl p-3" style={{ background: '#f2ece5' }}>
                  {/* La caja de afuera ocupa el tamaño YA REDUCIDO. Si no, el
                      marco a tamaño real seguiría empujando el ancho de la
                      página aunque visualmente se vea chico, y aparecería una
                      barra de desplazamiento horizontal que no corresponde a
                      nada. */}
                  <div style={{ width: marco.ancho * escala, height: marco.alto * escala, overflow: 'hidden' }}>
                    <iframe
                      key={`${elegido.userId}:${generacion}`}
                      // El nombre del marco es lo que le dice al portal, ya dentro,
                      // que arranque en vista previa — y sobrevive a que se navegue
                      // ahí adentro, cosa que el parámetro de la dirección no hace.
                      // Ver lib/preview.ts.
                      name={marcaDeMarco(elegido.userId)}
                      src={url}
                      title={`Vista previa de ${elegido.nombre}`}
                      style={{
                        width: marco.ancho,
                        height: marco.alto,
                        transform: `scale(${escala})`,
                        transformOrigin: 'top left',
                        border: '1px solid #ded3c8',
                        borderRadius: marco.radio,
                        background: 'white',
                        boxShadow: '0 6px 24px rgba(0,0,0,0.09)',
                      }}
                    />
                  </div>
                </div>

                <p className="mt-2.5 text-center text-[11px] leading-relaxed text-stone-400">
                  {marco.label} · {marco.ancho} × {marco.alto} px
                  {escala < 0.995 && (
                    <> · se ve al <strong>{Math.round(escala * 100)}%</strong>, pero la aplicación de adentro
                    mide {marco.ancho} px de verdad{!expandido && <> — con <Maximize2 size={10} className="inline" /> se ve más grande</>}</>
                  )}
                  <br />
                  Los botones de guardar están vivos, pero no guardan: al intentarlo aparece el aviso de
                  sólo lectura. Es a propósito — así se puede probar el recorrido completo hasta el final
                  sin tocar los datos de esta persona.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </DireccionLayout>
  );
}
