/**
 * Landing pública de Módula 22 (raíz `/`). Es la puerta de entrada indexable por
 * buscadores: contenido real, encabezados y palabras clave ("Preparatoria
 * Abierta Michoacán", "Plan 22", "bachillerato", "IEMSyS"). El portal interno
 * sigue detrás del login; aquí solo se explica el programa y se invita a entrar
 * o a solicitar cuenta.
 */
import { Link } from 'wouter';
import { GraduationCap, FileText, CalendarCheck, Award, ArrowRight, CheckCircle2 } from 'lucide-react';
import ModulaLogo from '../../components/ModulaLogo';

const GUINDA = 'var(--color-guinda-800)';

function BotonEntrar({ className = '' }: { className?: string }) {
  return (
    <Link href="/login" className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${className}`}>
      Iniciar sesión
    </Link>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-[var(--color-crema-100)] text-stone-800">
      {/* Barra superior */}
      <header className="sticky top-0 z-30 border-b border-[var(--color-guinda-900,#3d0a1c)]/10 bg-[var(--color-guinda-800)] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5 min-w-0">
            <ModulaLogo solido titulo="Módula 22" acento="var(--color-dorado-soft, #e6c78a)" />
          </div>
          <nav className="flex items-center gap-2">
            <Link href="/solicitar-cuenta" className="hidden sm:inline-flex items-center rounded-lg border border-white/30 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">
              Solicitar cuenta
            </Link>
            <BotonEntrar className="bg-white text-[var(--color-guinda-800)] hover:bg-white/90" />
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden text-white" style={{ background: 'linear-gradient(135deg, var(--color-guinda-800), var(--color-guinda-600))' }}>
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-28 left-10 h-64 w-64 rounded-full bg-white/5" />
        <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white/75">
            <span className="h-1.5 w-1.5 rounded-full bg-white" /> Gobierno de Michoacán · IEMSyS
          </div>
          <h1 className="font-serif text-3xl font-bold leading-tight sm:text-5xl sm:leading-[1.1] max-w-3xl">
            Preparatoria Abierta en Michoacán
          </h1>
          <p className="mt-4 max-w-2xl text-base text-white/90 sm:text-lg">
            Termina tu <strong>bachillerato</strong> con el <strong>Plan 22</strong>: 22 módulos, a tu ritmo y con
            validez oficial. Módula 22 es la plataforma del <strong>IEMSyS</strong> para llevar tu avance, tus
            exámenes y tu certificado, desde cualquier lugar.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/solicitar-cuenta" className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-bold text-[var(--color-guinda-800)] hover:bg-white/90">
              Solicitar cuenta <ArrowRight size={16} />
            </Link>
            <Link href="/login" className="inline-flex items-center gap-2 rounded-lg border border-white/40 px-5 py-3 text-sm font-bold text-white hover:bg-white/10">
              Ya tengo cuenta
            </Link>
          </div>
        </div>
      </section>

      {/* Qué es */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="font-serif text-2xl font-bold text-stone-900 sm:text-3xl">¿Qué es Módula 22?</h2>
        <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-stone-600">
          Es la plataforma de <strong>Preparatoria Abierta</strong> del Instituto de Educación Media Superior y
          Superior del Estado de Michoacán (<strong>IEMSyS</strong>). Con el <strong>Plan 22</strong> presentas los
          22 módulos del bachillerato a tu ritmo, con acompañamiento de un centro de asesoría cercano a ti, y al
          acreditarlos obtienes tu <strong>certificado de bachillerato con validez oficial</strong>.
        </p>
      </section>

      {/* Cómo funciona */}
      <section className="bg-white/60">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="font-serif text-2xl font-bold text-stone-900 sm:text-3xl">Cómo funciona</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            {[
              { icon: FileText, n: '1', t: 'Solicita tu cuenta', d: 'Regístrate en línea y arma tu expediente con tus 5 documentos. Un centro de asesoría te acompaña.' },
              { icon: CalendarCheck, n: '2', t: 'Inscríbete a tus exámenes', d: 'En cada convocatoria eliges los módulos que vas a presentar y en qué sede. Hasta 4 por convocatoria.' },
              { icon: Award, n: '3', t: 'Presenta y avanza', d: 'Acreditas módulo por módulo hasta completar los 22 del Plan y obtener tu certificado.' },
            ].map((p) => (
              <div key={p.n} className="rounded-2xl border border-stone-200 bg-white p-6">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-crema-100)]" style={{ color: GUINDA }}>
                  <p.icon size={22} />
                </div>
                <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: GUINDA }}>Paso {p.n}</div>
                <h3 className="mt-0.5 text-lg font-bold text-stone-900">{p.t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Para quién / beneficios */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="font-serif text-2xl font-bold text-stone-900 sm:text-3xl">¿Para quién es?</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            'Personas de 15 años o más que quieren terminar la preparatoria en Michoacán.',
            'Estudia a tu ritmo: presentas los módulos cuando estés listo, sin horarios de clase.',
            'Con validez oficial: tu certificado es el de bachillerato del sistema DGB/SEP.',
            'Acompañamiento de un centro de asesoría cercano en tu municipio.',
          ].map((t) => (
            <div key={t} className="flex items-start gap-2.5 rounded-xl border border-stone-200 bg-white p-4">
              <CheckCircle2 size={18} className="shrink-0 mt-0.5" style={{ color: GUINDA }} />
              <span className="text-sm text-stone-700">{t}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="text-white" style={{ background: 'linear-gradient(135deg, var(--color-guinda-800), var(--color-guinda-700))' }}>
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-14 text-center sm:px-6">
          <GraduationCap size={34} className="text-white/90" />
          <h2 className="font-serif text-2xl font-bold sm:text-3xl">Empieza tu preparatoria hoy</h2>
          <p className="max-w-xl text-white/85">Solicita tu cuenta en línea y da el primer paso hacia tu certificado de bachillerato.</p>
          <Link href="/solicitar-cuenta" className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-bold text-[var(--color-guinda-800)] hover:bg-white/90">
            Solicitar cuenta <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[var(--color-guinda-900,#2f0714)] text-white/80" style={{ background: '#2f0714' }}>
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <div className="font-serif text-base font-bold text-white">Módula · Plan 22</div>
            <div className="text-white/60">Preparatoria Abierta · IEMSyS · Gobierno de Michoacán</div>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-white/70">
            <Link href="/solicitar-cuenta" className="hover:text-white">Solicitar cuenta</Link>
            <Link href="/login" className="hover:text-white">Iniciar sesión</Link>
            <Link href="/capacitacion" className="hover:text-white">Centro de ayuda</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
