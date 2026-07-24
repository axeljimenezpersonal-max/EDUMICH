/**
 * Landing pública de Módula 22 (raíz `/`). Puerta de entrada indexable y la cara
 * del proyecto: Módula 22 se presenta como una iniciativa NACIONAL de impacto
 * social para acercar la Preparatoria Abierta a los 32 estados de México. Abajo,
 * el visitante elige su estado; hoy solo Michoacán está disponible y es el único
 * que entra al portal.
 *
 * Los estados se ilustran con íconos de LÍNEA (nada de emojis): un guiño
 * geográfico/cultural por estado, en la paleta de la marca, con animación propia
 * (entrada escalonada + flotación; la mariposa monarca de Michoacán aletea).
 */
import { Link } from 'wouter';
import {
  ArrowRight, GraduationCap, HeartHandshake, MapPin,
  FerrisWheel, Waves, Fish, Ship, Trees, Sun, Building2, Mountain, Flame,
  TreePine, MountainSnow, Gem, TreePalm, Sprout, Guitar, Leaf, Sailboat,
  Flower, Flower2, Landmark, Shell, Droplets, Music, Wheat, Anchor, Church,
  Coffee, Pyramid, Pickaxe,
  type LucideIcon,
} from 'lucide-react';
import ModulaLogo from '../../components/ModulaLogo';

const DORADO = 'var(--color-dorado-soft, #e6c78a)';

/** Mariposa monarca de línea — símbolo de Michoacán. Alas que aletean. */
function Mariposa({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden
    >
      <path d="M12 7.6V17" />
      <path d="M12 7.6c-.4-1.2-1.2-2-2.3-2.5M12 7.6c.4-1.2 1.2-2 2.3-2.5" />
      <g className="estado-ala">
        <path d="M12 9C9 5.4 4.4 5 3.9 8.3c-.4 2.7 3.6 3.7 8.1 2.2" />
        <path d="M12 12.6c-2.6-.3-5.3.7-5.5 3.2-.15 2 2.7 2.4 5.5-.2" />
      </g>
      <g className="estado-ala">
        <path d="M12 9c3-3.6 7.6-4 8.1-.7.4 2.7-3.6 3.7-8.1 2.2" />
        <path d="M12 12.6c2.6-.3 5.3.7 5.5 3.2.15 2-2.7 2.4-5.5-.2" />
      </g>
    </svg>
  );
}

/**
 * Los 32 estados. `Icono` es un ícono de línea (o la mariposa para Michoacán,
 * el único `disponible`). Se pueden sustituir por los escudos oficiales cuando
 * se tengan como assets.
 */
type Estado = { nombre: string; Icono: LucideIcon | typeof Mariposa; disponible?: boolean };
const ESTADOS: Estado[] = [
  { nombre: 'Aguascalientes', Icono: FerrisWheel },
  { nombre: 'Baja California', Icono: Waves },
  { nombre: 'Baja California Sur', Icono: Fish },
  { nombre: 'Campeche', Icono: Ship },
  { nombre: 'Chiapas', Icono: Trees },
  { nombre: 'Chihuahua', Icono: Sun },
  { nombre: 'Ciudad de México', Icono: Building2 },
  { nombre: 'Coahuila', Icono: Mountain },
  { nombre: 'Colima', Icono: Flame },
  { nombre: 'Durango', Icono: TreePine },
  { nombre: 'Estado de México', Icono: MountainSnow },
  { nombre: 'Guanajuato', Icono: Gem },
  { nombre: 'Guerrero', Icono: TreePalm },
  { nombre: 'Hidalgo', Icono: Sprout },
  { nombre: 'Jalisco', Icono: Guitar },
  { nombre: 'Michoacán', Icono: Mariposa, disponible: true },
  { nombre: 'Morelos', Icono: Leaf },
  { nombre: 'Nayarit', Icono: Sailboat },
  { nombre: 'Nuevo León', Icono: Mountain },
  { nombre: 'Oaxaca', Icono: Flower },
  { nombre: 'Puebla', Icono: Flower2 },
  { nombre: 'Querétaro', Icono: Landmark },
  { nombre: 'Quintana Roo', Icono: Shell },
  { nombre: 'San Luis Potosí', Icono: Droplets },
  { nombre: 'Sinaloa', Icono: Music },
  { nombre: 'Sonora', Icono: Wheat },
  { nombre: 'Tabasco', Icono: Waves },
  { nombre: 'Tamaulipas', Icono: Anchor },
  { nombre: 'Tlaxcala', Icono: Church },
  { nombre: 'Veracruz', Icono: Coffee },
  { nombre: 'Yucatán', Icono: Pyramid },
  { nombre: 'Zacatecas', Icono: Pickaxe },
];

function TarjetaEstado({ estado, index }: { estado: Estado; index: number }) {
  const { Icono } = estado;
  // Retrasos escalonados: la entrada barre en cascada y la flotación queda
  // desfasada para que cada estado tenga "su propia" animación.
  const entrada = { animationDelay: `${(index * 0.035).toFixed(3)}s` };
  const flota = { animationDelay: `${(index * 0.13).toFixed(2)}s` };

  if (estado.disponible) {
    return (
      <Link
        href="/prepaabierta/michoacan"
        style={entrada}
        className="estado-card group relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-[var(--color-guinda-700)] bg-[var(--color-guinda-800)] p-4 text-center text-white shadow-lg transition-transform hover:-translate-y-1"
      >
        <span className="absolute right-2 top-2 rounded-full bg-emerald-400 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-950">
          Disponible
        </span>
        <Icono className="estado-glyph h-7 w-7" style={{ ...flota, color: DORADO }} strokeWidth={1.4} />
        <span className="text-sm font-bold leading-tight">{estado.nombre}</span>
        <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: DORADO }}>
          Entrar al portal <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
    );
  }
  return (
    <div
      style={entrada}
      className="estado-card group relative flex cursor-default flex-col items-center justify-center gap-1.5 rounded-2xl border border-stone-200 bg-white/70 p-4 text-center transition-colors hover:border-[var(--color-guinda-700)]/30"
      aria-disabled
    >
      <span className="absolute right-2 top-2 rounded-full bg-stone-200 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-stone-500">
        Pronto
      </span>
      <Icono className="estado-glyph h-7 w-7 text-[var(--color-guinda-700)]" style={flota} strokeWidth={1.4} />
      <span className="text-sm font-semibold leading-tight text-stone-600">{estado.nombre}</span>
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
            {ESTADOS.map((e, i) => (
              <TarjetaEstado key={e.nombre} estado={e} index={i} />
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
