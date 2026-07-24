/**
 * Landing pública de Módula 22 (raíz `/`). Puerta de entrada indexable y, sobre
 * todo, la cara del proyecto: Módula 22 se presenta como una iniciativa
 * NACIONAL para acercar la Preparatoria Abierta a los 32 estados de México, con
 * un fuerte acento social. Abajo, el visitante elige su estado; hoy solo
 * Michoacán está disponible y es el único que entra al portal. El resto se
 * muestran como "Próximamente" para dejar clara la vocación nacional.
 */
import { Link } from 'wouter';
import { ArrowRight, GraduationCap, HeartHandshake, MapPin } from 'lucide-react';
import ModulaLogo from '../../components/ModulaLogo';

const DORADO = 'var(--color-dorado-soft, #e6c78a)';

/**
 * Los 32 estados. `emoji` es un guiño representativo (placeholder: se pueden
 * sustituir por los escudos oficiales cuando se tengan como assets). Solo
 * Michoacán está `disponible`; entrar ahí lleva al portal.
 */
type Estado = { nombre: string; emoji: string; disponible?: boolean };
const ESTADOS: Estado[] = [
  { nombre: 'Aguascalientes', emoji: '🎡' },
  { nombre: 'Baja California', emoji: '🌊' },
  { nombre: 'Baja California Sur', emoji: '🐋' },
  { nombre: 'Campeche', emoji: '🏰' },
  { nombre: 'Chiapas', emoji: '🌿' },
  { nombre: 'Chihuahua', emoji: '🏜️' },
  { nombre: 'Ciudad de México', emoji: '🏙️' },
  { nombre: 'Coahuila', emoji: '🦕' },
  { nombre: 'Colima', emoji: '🌋' },
  { nombre: 'Durango', emoji: '🌵' },
  { nombre: 'Estado de México', emoji: '🏔️' },
  { nombre: 'Guanajuato', emoji: '⛏️' },
  { nombre: 'Guerrero', emoji: '🏖️' },
  { nombre: 'Hidalgo', emoji: '🌾' },
  { nombre: 'Jalisco', emoji: '🥃' },
  { nombre: 'Michoacán', emoji: '🦋', disponible: true },
  { nombre: 'Morelos', emoji: '🌸' },
  { nombre: 'Nayarit', emoji: '🏝️' },
  { nombre: 'Nuevo León', emoji: '⛰️' },
  { nombre: 'Oaxaca', emoji: '🎭' },
  { nombre: 'Puebla', emoji: '🌶️' },
  { nombre: 'Querétaro', emoji: '🏛️' },
  { nombre: 'Quintana Roo', emoji: '🐠' },
  { nombre: 'San Luis Potosí', emoji: '🏜️' },
  { nombre: 'Sinaloa', emoji: '🎶' },
  { nombre: 'Sonora', emoji: '🌵' },
  { nombre: 'Tabasco', emoji: '🐊' },
  { nombre: 'Tamaulipas', emoji: '🌊' },
  { nombre: 'Tlaxcala', emoji: '🌽' },
  { nombre: 'Veracruz', emoji: '☕' },
  { nombre: 'Yucatán', emoji: '🏛️' },
  { nombre: 'Zacatecas', emoji: '⛏️' },
];

function TarjetaEstado({ estado }: { estado: Estado }) {
  if (estado.disponible) {
    return (
      <Link
        href="/login"
        className="group relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-[var(--color-guinda-700)] bg-[var(--color-guinda-800)] p-4 text-center text-white shadow-lg transition-transform hover:-translate-y-0.5"
      >
        <span className="absolute right-2 top-2 rounded-full bg-emerald-400 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-950">
          Disponible
        </span>
        <span className="text-3xl leading-none" aria-hidden>{estado.emoji}</span>
        <span className="text-sm font-bold leading-tight">{estado.nombre}</span>
        <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-dorado-soft,#e6c78a)]">
          Entrar al portal <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
    );
  }
  return (
    <div
      className="relative flex cursor-default flex-col items-center justify-center gap-1.5 rounded-2xl border border-stone-200 bg-white/70 p-4 text-center"
      aria-disabled
    >
      <span className="absolute right-2 top-2 rounded-full bg-stone-200 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-stone-500">
        Pronto
      </span>
      <span className="text-3xl leading-none opacity-40 grayscale" aria-hidden>{estado.emoji}</span>
      <span className="text-sm font-semibold leading-tight text-stone-500">{estado.nombre}</span>
      <span className="mt-0.5 text-[11px] text-stone-400">Próximamente</span>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-[var(--color-crema-100)] text-stone-800">
      {/* Barra superior mínima */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[var(--color-guinda-800)] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <ModulaLogo titulo="Módula 22" acento={DORADO} className="h-6 w-auto" />
          <Link
            href="/login"
            className="inline-flex items-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[var(--color-guinda-800)] hover:bg-white/90"
          >
            Iniciar sesión
          </Link>
        </div>
      </header>

      {/* Hero: logo grande + misión nacional y social */}
      <section
        className="relative overflow-hidden text-white"
        style={{ background: 'linear-gradient(135deg, var(--color-guinda-800), var(--color-guinda-600))' }}
      >
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-28 left-6 h-64 w-64 rounded-full bg-white/5" />
        <div className="relative mx-auto flex max-w-4xl flex-col items-center px-4 py-16 text-center sm:px-6 sm:py-24">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white/90">
            <HeartHandshake size={14} /> Iniciativa nacional · Educación para todas y todos
          </span>

          {/* Logo grande — la marca es el centro */}
          <ModulaLogo titulo="Módula 22" acento={DORADO} className="h-20 w-auto sm:h-28" />

          <h1 className="mt-8 font-serif text-3xl font-bold leading-tight sm:text-5xl sm:leading-[1.1]">
            Preparatoria Abierta para todo México
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/90 sm:text-lg">
            Somos una <strong>iniciativa nacional de impacto social</strong>: acercar el
            bachillerato con validez oficial a cada persona de cada estado, sin importar dónde
            viva ni cuánto tiempo tenga. Estudiar la prepa es un <strong>derecho</strong>, y
            Módula 22 existe para que nadie se quede sin terminarla.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-white/85">
            <span className="inline-flex items-center gap-2"><MapPin size={16} /> 32 estados, una misión</span>
            <span className="inline-flex items-center gap-2"><GraduationCap size={16} /> 22 módulos a tu ritmo</span>
            <span className="inline-flex items-center gap-2"><HeartHandshake size={16} /> Gratuito y con acompañamiento</span>
          </div>

          <a
            href="#estados"
            className="mt-9 inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-bold text-[var(--color-guinda-800)] hover:bg-white/90"
          >
            Elige tu estado <ArrowRight size={16} />
          </a>
        </div>
      </section>

      {/* Qué es — tono social */}
      <section className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6">
        <h2 className="font-serif text-2xl font-bold text-stone-900 sm:text-3xl">¿Qué es Módula 22?</h2>
        <p className="mt-4 text-[15px] leading-relaxed text-stone-600">
          Un movimiento para que la <strong>Preparatoria Abierta</strong> llegue a todos los
          rincones del país. Presentas los <strong>22 módulos</strong> del bachillerato cuando
          estés listo, con el acompañamiento de un centro de asesoría cercano, y al acreditarlos
          obtienes tu <strong>certificado con validez oficial</strong>. Sin horarios, sin dejar
          tu trabajo ni a tu familia. Empezamos en Michoacán y vamos por los 32 estados.
        </p>
      </section>

      {/* Selector de estados */}
      <section id="estados" className="scroll-mt-16 bg-white/60">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="text-center">
            <h2 className="font-serif text-2xl font-bold text-stone-900 sm:text-3xl">Elige tu estado</h2>
            <p className="mx-auto mt-3 max-w-xl text-[15px] text-stone-600">
              Vamos estado por estado. Hoy <strong>Michoacán</strong> ya está en marcha; los demás
              se irán sumando. Toca tu estado para entrar.
            </p>
          </div>

          <div className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {ESTADOS.map((e) => (
              <TarjetaEstado key={e.nombre} estado={e} />
            ))}
          </div>

          <p className="mt-8 text-center text-xs text-stone-400">
            ¿Tu estado aún no está? Está por llegar. Módula 22 es un proyecto en expansión.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-white/80" style={{ background: '#2f0714' }}>
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <ModulaLogo titulo="Módula 22" acento={DORADO} className="h-6 w-auto text-white" />
            <span className="text-sm text-white/60">Preparatoria Abierta · Iniciativa nacional</span>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/70">
            <Link href="/login" className="hover:text-white">Iniciar sesión</Link>
            <Link href="/solicitar-cuenta" className="hover:text-white">Solicitar cuenta</Link>
            <Link href="/capacitacion" className="hover:text-white">Centro de ayuda</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
