/**
 * Ilustraciones animadas opcionales para las tarjetas del tour.
 *
 * Se mantienen SOBRIAS (es una plataforma de gobierno): paleta guinda/dorado/
 * crema, movimiento suave y en bucle, sin destellos. Un paso del tour puede
 * pedir una ilustración por clave con `illustration: 'pagoFlow'`; si la clave no
 * existe, no se dibuja nada. Respetan `prefers-reduced-motion`.
 */

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FileText, Landmark, Banknote, Upload, BadgeCheck,
  LockOpen, ClipboardCheck, GraduationCap, Lock, CheckCheck,
  MessageCircle, ClipboardList, BookOpen, PlayCircle,
  Inbox, Search, UserCheck, QrCode, ShieldCheck, FolderOpen,
  UserPlus, Mail, KeyRound, CalendarCheck, CheckCircle2,
  Users, IdCard,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';

type Paso = { Icon: React.ComponentType<LucideProps>; label: string };

const PASOS_PAGO: Paso[] = [
  { Icon: FileText, label: 'Solicitas' },
  { Icon: Landmark, label: 'Orden' },
  { Icon: Banknote, label: 'Pagas' },
  { Icon: Upload, label: 'Comprobante' },
  { Icon: BadgeCheck, label: 'Confirmado' },
];

const PASOS_PRUEBA: Paso[] = [
  { Icon: Banknote, label: 'Pagas examen' },
  { Icon: LockOpen, label: 'Prueba incluida' },
  { Icon: ClipboardCheck, label: 'Practicas' },
  { Icon: GraduationCap, label: 'Llegas listo' },
];

const PASOS_ALTA: Paso[] = [
  { Icon: FileText, label: 'Datos' },
  { Icon: Upload, label: 'Documentos' },
  { Icon: ClipboardCheck, label: 'Revisión' },
  { Icon: BadgeCheck, label: 'Aprobado' },
];

// Ciclo completo que la administración habilita para que todo funcione.
const PASOS_CICLO: Paso[] = [
  { Icon: Inbox, label: 'Solicitud' },
  { Icon: FileText, label: 'Documentos' },
  { Icon: Banknote, label: 'Pago' },
  { Icon: ClipboardCheck, label: 'Examen' },
  { Icon: GraduationCap, label: 'Egreso' },
];

// El camino del gestor, en orden: registrar → documentar → inscribir → pagar →
// calificar. Sustituye a la lista de texto del paso final del tour.
const PASOS_GESTOR: Paso[] = [
  { Icon: UserPlus, label: 'Registrar' },
  { Icon: FolderOpen, label: 'Documentar' },
  { Icon: ClipboardCheck, label: 'Inscribir' },
  { Icon: Banknote, label: 'Pagar' },
  { Icon: GraduationCap, label: 'Calificar' },
];

// Alta del alumno, en dos pasos (los del formulario): Datos → Documentos.
const PASOS_ALTA_DOS: Paso[] = [
  { Icon: FileText, label: 'Datos' },
  { Icon: FolderOpen, label: 'Documentos' },
];

// Inscripción en lote: varios alumnos × módulos → quedan inscritos.
const PASOS_INSCRIBE: Paso[] = [
  { Icon: Users, label: 'Alumnos' },
  { Icon: ClipboardCheck, label: 'Módulos' },
  { Icon: BadgeCheck, label: 'Inscritos' },
];

// Etapas del expediente, en orden (coincide con los chips de la lista de alumnos).
const PASOS_ESTADO: Paso[] = [
  { Icon: FolderOpen, label: 'Documentos' },
  { Icon: IdCard, label: 'Matrícula' },
  { Icon: ClipboardCheck, label: 'Módulos' },
  { Icon: Banknote, label: 'Pago' },
  { Icon: BadgeCheck, label: 'Activo' },
];

// Pestañas de la ficha del alumno, en el orden real del trámite.
const PASOS_FICHA: Paso[] = [
  { Icon: FolderOpen, label: 'Documentos' },
  { Icon: CalendarCheck, label: 'Inscripción' },
  { Icon: Banknote, label: 'Pago' },
  { Icon: GraduationCap, label: 'Calif.' },
  { Icon: IdCard, label: 'Credencial' },
];

const PASOS_SOLICITUD: Paso[] = [
  { Icon: Inbox, label: 'Solicita' },
  { Icon: Search, label: 'Revisas' },
  { Icon: UserCheck, label: 'Aprobada' },
];

const PASOS_VERIFICA: Paso[] = [
  { Icon: QrCode, label: 'Escaneas' },
  { Icon: ShieldCheck, label: 'Firma válida' },
  { Icon: UserCheck, label: 'Auténtica' },
  { Icon: FolderOpen, label: 'Expediente' },
];

function usePrefiereMenosMovimiento(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduce(mq.matches);
    const on = () => setReduce(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduce;
}

/**
 * Flujo animado genérico: los nodos se van "encendiendo" en secuencia y la línea
 * que los une se rellena a su paso; al completarse hace una pausa y reinicia.
 */
function FlowAnimation({ pasos }: { pasos: Paso[] }) {
  const reduce = usePrefiereMenosMovimiento();
  const N = pasos.length;
  // `activo` va de 0 a N (en N todos están encendidos → beat de "completado").
  const [activo, setActivo] = useState(reduce ? N : 0);

  useEffect(() => {
    if (reduce) { setActivo(N); return; }
    const t = setInterval(() => setActivo((v) => (v >= N ? 0 : v + 1)), 950);
    return () => clearInterval(t);
  }, [reduce, N]);

  return (
    <div
      className="mt-4 rounded-xl border px-3 py-4"
      style={{ background: 'var(--color-crema-100)', borderColor: 'var(--color-crema-200)' }}
      aria-hidden
    >
      <div className="flex items-start">
        {pasos.map((p, i) => {
          const encendido = i <= activo;
          const P = p.Icon;
          return (
            <div key={p.label} className="relative flex flex-1 flex-col items-center">
              {/* Conector hacia el nodo anterior */}
              {i > 0 && (
                <span
                  className="absolute top-[17px] right-1/2 h-[3px] w-full -translate-y-1/2 overflow-hidden rounded-full"
                  style={{ background: 'var(--color-crema-200)' }}
                >
                  <motion.span
                    className="block h-full rounded-full"
                    style={{ background: 'var(--color-dorado)' }}
                    initial={false}
                    animate={{ width: i <= activo ? '100%' : '0%' }}
                    transition={{ duration: 0.45, ease: 'easeInOut' }}
                  />
                </span>
              )}
              {/* Nodo */}
              <motion.div
                className="relative z-10 flex h-[34px] w-[34px] items-center justify-center rounded-full border-2"
                initial={false}
                animate={{
                  background: encendido ? 'var(--color-guinda-700)' : '#ffffff',
                  borderColor: encendido ? 'var(--color-guinda-700)' : 'var(--color-crema-200)',
                  scale: i === activo && !reduce ? 1.12 : 1,
                }}
                transition={{ type: 'spring', stiffness: 340, damping: 22 }}
              >
                <P size={16} color={encendido ? '#ffffff' : '#a8a29e'} strokeWidth={2.4} />
              </motion.div>
              <span
                className="mt-1.5 text-center text-[9px] font-semibold leading-tight transition-colors"
                style={{ color: encendido ? 'var(--color-guinda-700)' : '#a8a29e' }}
              >
                {p.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Aviso legal animado: el candado hace un "zoom" suave en bucle y las dos
 * etiquetas —Registrada y Almacenada— quedan encendidas con un pulso alterno.
 */
function ChatLegalAnimation() {
  const reduce = usePrefiereMenosMovimiento();
  return (
    <div
      className="mt-4 flex flex-col items-center gap-3 rounded-xl border px-4 py-4"
      style={{ background: 'var(--color-crema-100)', borderColor: 'var(--color-crema-200)' }}
      aria-hidden
    >
      <motion.div
        className="flex h-12 w-12 items-center justify-center rounded-full text-white"
        style={{ background: 'var(--color-guinda-700)' }}
        animate={reduce ? {} : {
          scale: [1, 1.1, 1],
          boxShadow: [
            '0 0 0 0 rgba(107,21,48,0)',
            '0 0 0 9px rgba(107,21,48,0.10)',
            '0 0 0 0 rgba(107,21,48,0)',
          ],
        }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Lock size={22} />
      </motion.div>
      <div className="flex gap-2">
        {['Registrada', 'Almacenada'].map((t, i) => (
          <motion.span
            key={t}
            className="rounded-full px-3 py-1 text-[11px] font-bold text-white"
            style={{ background: 'var(--color-guinda-700)' }}
            animate={reduce ? {} : { opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2.2, repeat: Infinity, delay: i * 1.1, ease: 'easeInOut' }}
          >
            {t}
          </motion.span>
        ))}
      </div>
      <p className="text-center text-[11px]" style={{ color: '#78716c' }}>
        Por motivos legales y de privacidad de datos
      </p>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex justify-start">
      <div
        className="flex items-center gap-1 rounded-2xl rounded-bl-sm border px-3 py-2.5"
        style={{ background: '#fff', borderColor: 'var(--color-crema-200)' }}
      >
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="block h-1.5 w-1.5 rounded-full"
            style={{ background: '#a8a29e' }}
            animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Ejemplo de conversación animado: aparece tu mensaje, se marca "Leído", la
 * Secretaría "escribe" y luego responde; hace una pausa y reinicia en bucle.
 */
function ChatDemoAnimation() {
  const reduce = usePrefiereMenosMovimiento();
  // 0 vacío · 1 tu mensaje · 2 leído · 3 escribiendo · 4 respuesta · 5 pausa
  const [fase, setFase] = useState(reduce ? 4 : 0);

  useEffect(() => {
    if (reduce) { setFase(4); return; }
    const t = setInterval(() => setFase((f) => (f >= 5 ? 0 : f + 1)), 1150);
    return () => clearInterval(t);
  }, [reduce]);

  return (
    <div
      className="mt-4 space-y-2 rounded-xl border p-3"
      style={{ background: 'var(--color-crema-100)', borderColor: 'var(--color-crema-200)', minHeight: 132 }}
      aria-hidden
    >
      {fase >= 1 && (
        <motion.div className="flex justify-end" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <div
            className="max-w-[82%] rounded-2xl rounded-br-sm px-3 py-2 text-[12px] leading-snug text-white"
            style={{ background: 'var(--color-guinda-700)' }}
          >
            Hola, ¿cuándo aparece mi calificación?
          </div>
        </motion.div>
      )}
      {fase >= 2 && (
        <div className="flex items-center justify-end gap-1 pr-1 text-[9px] font-semibold" style={{ color: '#78716c' }}>
          <CheckCheck size={11} style={{ color: 'var(--color-guinda-700)' }} /> Leído
        </div>
      )}
      {fase === 3 && <TypingDots />}
      {fase >= 4 && (
        <motion.div className="flex justify-start" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <div
            className="max-w-[82%] rounded-2xl rounded-bl-sm border px-3 py-2 text-[12px] leading-snug"
            style={{ background: '#fff', borderColor: 'var(--color-crema-200)', color: '#44403c' }}
          >
            En 3 a 5 días hábiles aparece en tu sección de Calificaciones. 😊
          </div>
        </motion.div>
      )}
    </div>
  );
}

/**
 * Tarjeta de clase animada (parrilla del aula): reproduce una tarjeta de módulo
 * con su franja de color, el aviso de pendientes que late y sus contadores de
 * tareas, materiales y videos. Enseña de un vistazo qué información da cada
 * tarjeta, sin que nadie tenga que explicarlo.
 */
function AulaCardAnimation() {
  const reduce = usePrefiereMenosMovimiento();
  return (
    <div
      className="mt-4 overflow-hidden rounded-xl border"
      style={{ borderColor: 'var(--color-crema-200)', background: '#fff' }}
      aria-hidden
    >
      <div
        className="relative px-3 py-2.5 text-white"
        style={{ background: 'linear-gradient(135deg, #0f766e 0%, #115e59 100%)' }}
      >
        <div className="text-[9px] font-bold uppercase tracking-[0.14em] opacity-85">Módulo 1</div>
        <motion.span
          className="absolute right-2 top-2 rounded-full bg-white/25 px-2 py-0.5 text-[9px] font-bold"
          animate={reduce ? {} : { scale: [1, 1.09, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          3 pendientes
        </motion.span>
      </div>
      <div className="p-3">
        <div className="text-[12px] font-bold leading-snug" style={{ color: '#1c1917' }}>
          M1 — De la información al conocimiento
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-[10px] font-semibold" style={{ color: '#78716c' }}>
          <span className="flex items-center gap-1"><ClipboardList size={12} /> 3 tareas</span>
          <span className="flex items-center gap-1"><BookOpen size={12} /> 3 materiales</span>
          <span className="flex items-center gap-1"><PlayCircle size={12} /> 1 video</span>
        </div>
        <div className="mt-2.5 text-[11px] font-bold" style={{ color: 'var(--color-guinda-700)' }}>
          Entrar al módulo →
        </div>
      </div>
    </div>
  );
}

const SECCIONES_AULA = [
  { Icon: MessageCircle, label: 'Foro', desc: 'Avisos del profe y tus dudas.' },
  { Icon: ClipboardCheck, label: 'Tareas', desc: 'Entrega tu trabajo con foto o archivo.' },
  { Icon: BookOpen, label: 'Materiales', desc: 'Lecturas y recursos para estudiar.' },
  { Icon: PlayCircle, label: 'Videos', desc: 'Clases y explicaciones en video.' },
];

/**
 * Menú del módulo animado: la selección recorre las cuatro secciones (Foro,
 * Tareas, Materiales, Videos) y el panel de la derecha explica para qué sirve
 * cada una. Demuestra la navegación y sus funciones por sí solo.
 */
function AulaNavAnimation() {
  const reduce = usePrefiereMenosMovimiento();
  const [i, setI] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setI((v) => (v + 1) % SECCIONES_AULA.length), 1450);
    return () => clearInterval(t);
  }, [reduce]);

  const activa = SECCIONES_AULA[i];
  const ActivaIcon = activa.Icon;

  return (
    <div
      className="mt-4 flex gap-3 rounded-xl border p-3"
      style={{ background: 'var(--color-crema-100)', borderColor: 'var(--color-crema-200)' }}
      aria-hidden
    >
      <div className="flex w-[118px] shrink-0 flex-col gap-1.5">
        {SECCIONES_AULA.map((s, idx) => {
          const on = idx === i;
          const S = s.Icon;
          return (
            <div
              key={s.label}
              className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold"
              style={{
                background: on ? 'var(--color-guinda-700)' : '#fff',
                color: on ? '#fff' : '#78716c',
                borderColor: on ? 'var(--color-guinda-700)' : 'var(--color-crema-200)',
                transition: 'background .35s, color .35s, border-color .35s',
              }}
            >
              <S size={14} /> {s.label}
            </div>
          );
        })}
      </div>
      <div
        className="flex flex-1 flex-col justify-center rounded-lg border bg-white p-3"
        style={{ borderColor: 'var(--color-crema-200)' }}
      >
        <div className="flex items-center gap-2 text-[12px] font-bold" style={{ color: 'var(--color-guinda-700)' }}>
          <ActivaIcon size={15} /> {activa.label}
        </div>
        <motion.p
          key={activa.label}
          className="mt-1 text-[11px] leading-snug"
          style={{ color: '#57534e' }}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {activa.desc}
        </motion.p>
      </div>
    </div>
  );
}

/**
 * La convocatoria es OPCIONAL: dos caminos válidos. Se alternan con un realce
 * suave para dejar claro que registrar funciona en ambos casos.
 */
function AltaConvocatoriaAnimation() {
  const reduce = usePrefiereMenosMovimiento();
  const [on, setOn] = useState(0); // 0 → fila A · 1 → fila B
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setOn((v) => (v + 1) % 2), 1800);
    return () => clearInterval(t);
  }, [reduce]);

  const filas = [
    { Icon: UserPlus, titulo: 'Registrar (aquí)', cola: 'crea su cuenta y su expediente', ColaIcon: CheckCircle2 },
    { Icon: ClipboardCheck, titulo: 'Inscribir (en Inscripción)', cola: 'lo anota a examen cuando abre la ventana', ColaIcon: CalendarCheck },
  ];

  return (
    <div
      className="mt-4 space-y-2 rounded-xl border px-3 py-3"
      style={{ background: 'var(--color-crema-100)', borderColor: 'var(--color-crema-200)' }}
      aria-hidden
    >
      {filas.map((f, i) => {
        const activa = on === i || reduce;
        const F = f.Icon;
        const Cola = f.ColaIcon;
        return (
          <motion.div
            key={f.titulo}
            className="flex items-center gap-2.5 rounded-lg border px-3 py-2"
            initial={false}
            animate={{
              background: activa ? '#ffffff' : 'transparent',
              borderColor: activa ? 'var(--color-guinda-300, #e7b4c2)' : 'transparent',
              opacity: activa ? 1 : 0.5,
            }}
            transition={{ duration: 0.4 }}
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
              style={{ background: 'var(--color-guinda-700)' }}
            >
              <F size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-bold leading-tight" style={{ color: '#44403c' }}>{f.titulo}</div>
              <div className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: 'var(--color-guinda-700)' }}>
                <Cola size={12} /> {f.cola}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/**
 * La CURP se valida sola: una barra "escanea" la CURP y aparece el sello
 * "válida". Comunica que el sistema revisa estructura, duplicados y datos.
 */
function CurpCheckAnimation() {
  const reduce = usePrefiereMenosMovimiento();
  const [fase, setFase] = useState(reduce ? 2 : 0); // 0 escanea · 1 válida · 2 pausa
  useEffect(() => {
    if (reduce) { setFase(1); return; }
    const t = setInterval(() => setFase((f) => (f >= 2 ? 0 : f + 1)), 1150);
    return () => clearInterval(t);
  }, [reduce]);

  return (
    <div
      className="mt-4 flex items-center gap-3 rounded-xl border px-3 py-4"
      style={{ background: 'var(--color-crema-100)', borderColor: 'var(--color-crema-200)' }}
      aria-hidden
    >
      <div className="relative flex-1 overflow-hidden rounded-lg border bg-white px-3 py-2" style={{ borderColor: 'var(--color-crema-200)' }}>
        <div className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: '#a8a29e' }}>CURP</div>
        <div className="font-mono text-[13px] font-bold tracking-tight" style={{ color: '#44403c' }}>GOPA950315MMN…</div>
        {fase === 0 && !reduce && (
          <motion.span
            className="absolute inset-y-0 w-1/3"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(212,163,74,0.35), transparent)' }}
            initial={{ x: '-120%' }}
            animate={{ x: '320%' }}
            transition={{ duration: 1.0, ease: 'easeInOut' }}
          />
        )}
      </div>
      <motion.span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
        style={{ background: fase >= 1 ? '#15803d' : 'var(--color-crema-200)' }}
        initial={false}
        animate={{ scale: fase >= 1 && !reduce ? [1, 1.15, 1] : 1 }}
        transition={{ duration: 0.5 }}
      >
        <BadgeCheck size={18} />
      </motion.span>
    </div>
  );
}

/**
 * Al registrar se crea la cuenta del alumno: un sobre con sus credenciales
 * "sale" hacia su correo. Explica el correo de bienvenida sin párrafos.
 */
function CuentaCorreoAnimation() {
  const reduce = usePrefiereMenosMovimiento();
  const [fase, setFase] = useState(reduce ? 2 : 0); // 0 registrado · 1 enviando · 2 recibido
  useEffect(() => {
    if (reduce) { setFase(2); return; }
    const t = setInterval(() => setFase((f) => (f >= 2 ? 0 : f + 1)), 1200);
    return () => clearInterval(t);
  }, [reduce]);

  const nodo = (activo: boolean, Icon: React.ComponentType<LucideProps>, label: string) => (
    <div className="flex flex-1 flex-col items-center gap-1.5">
      <motion.span
        className="flex h-9 w-9 items-center justify-center rounded-full border-2"
        initial={false}
        animate={{
          background: activo ? 'var(--color-guinda-700)' : '#ffffff',
          borderColor: activo ? 'var(--color-guinda-700)' : 'var(--color-crema-200)',
        }}
      >
        <Icon size={16} color={activo ? '#ffffff' : '#a8a29e'} strokeWidth={2.4} />
      </motion.span>
      <span className="text-center text-[9px] font-semibold" style={{ color: activo ? 'var(--color-guinda-700)' : '#a8a29e' }}>{label}</span>
    </div>
  );

  return (
    <div
      className="mt-4 flex items-center rounded-xl border px-3 py-4"
      style={{ background: 'var(--color-crema-100)', borderColor: 'var(--color-crema-200)' }}
      aria-hidden
    >
      {nodo(fase >= 0, UserPlus, 'Registrado')}
      <div className="relative h-[3px] flex-1 rounded-full" style={{ background: 'var(--color-crema-200)' }}>
        <motion.span
          className="absolute -top-[9px] flex h-5 w-5 items-center justify-center rounded-full text-white"
          style={{ background: 'var(--color-dorado)' }}
          initial={false}
          animate={reduce ? { left: '100%' } : { left: fase === 0 ? '0%' : fase === 1 ? '50%' : '100%' }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
        >
          <Mail size={12} />
        </motion.span>
      </div>
      {nodo(fase >= 2, KeyRound, 'Credenciales')}
    </div>
  );
}

/**
 * Elegibilidad para inscribir: DOS requisitos que se encienden —matrícula y
 * expediente 5/5— y sólo entonces el alumno queda "Elegible".
 */
function ElegibleCheckAnimation() {
  const reduce = usePrefiereMenosMovimiento();
  const [fase, setFase] = useState(reduce ? 3 : 0); // 0 · 1 matrícula · 2 exp · 3 elegible
  useEffect(() => {
    if (reduce) { setFase(3); return; }
    const t = setInterval(() => setFase((f) => (f >= 3 ? 0 : f + 1)), 900);
    return () => clearInterval(t);
  }, [reduce]);

  const chip = (activo: boolean, Icon: React.ComponentType<LucideProps>, label: string) => (
    <motion.div
      className="flex items-center gap-1.5 rounded-full border px-3 py-1.5"
      initial={false}
      animate={{
        background: activo ? 'var(--color-guinda-700)' : '#ffffff',
        borderColor: activo ? 'var(--color-guinda-700)' : 'var(--color-crema-200)',
      }}
    >
      <Icon size={13} color={activo ? '#ffffff' : '#a8a29e'} strokeWidth={2.4} />
      <span className="text-[11px] font-bold" style={{ color: activo ? '#ffffff' : '#a8a29e' }}>{label}</span>
    </motion.div>
  );

  return (
    <div
      className="mt-4 flex flex-wrap items-center justify-center gap-2 rounded-xl border px-3 py-4"
      style={{ background: 'var(--color-crema-100)', borderColor: 'var(--color-crema-200)' }}
      aria-hidden
    >
      {chip(fase >= 1, IdCard, 'Matrícula')}
      <span className="text-[13px] font-bold" style={{ color: '#a8a29e' }}>+</span>
      {chip(fase >= 2, FolderOpen, 'Expediente 5/5')}
      <span className="text-[13px] font-bold" style={{ color: '#a8a29e' }}>→</span>
      <motion.div
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-white"
        initial={false}
        animate={{ background: fase >= 3 ? '#15803d' : 'var(--color-crema-200)', scale: fase >= 3 && !reduce ? [1, 1.08, 1] : 1 }}
        transition={{ duration: 0.4 }}
      >
        <CheckCircle2 size={13} />
        <span className="text-[11px] font-bold">Elegible</span>
      </motion.div>
    </div>
  );
}

const VISTAS_CALIF = [
  { Icon: BadgeCheck, label: 'Exámenes oficiales', desc: 'Calificaciones DGB. Cuentan para el certificado.' },
  { Icon: ClipboardCheck, label: 'Evaluaciones de práctica', desc: 'Ensayos en la plataforma para prepararse.' },
];

/** Dos vistas de calificaciones: la selección alterna y explica cada una. */
function DosVistasAnimation() {
  const reduce = usePrefiereMenosMovimiento();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setI((v) => (v + 1) % VISTAS_CALIF.length), 1700);
    return () => clearInterval(t);
  }, [reduce]);
  const activa = VISTAS_CALIF[i];
  const ActivaIcon = activa.Icon;
  return (
    <div
      className="mt-4 rounded-xl border p-3"
      style={{ background: 'var(--color-crema-100)', borderColor: 'var(--color-crema-200)' }}
      aria-hidden
    >
      <div className="flex gap-2">
        {VISTAS_CALIF.map((v, idx) => {
          const on = idx === i;
          const V = v.Icon;
          return (
            <div
              key={v.label}
              className="flex flex-1 items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[11px] font-bold"
              style={{
                background: on ? 'var(--color-guinda-700)' : '#fff',
                color: on ? '#fff' : '#a8a29e',
                borderColor: on ? 'var(--color-guinda-700)' : 'var(--color-crema-200)',
                transition: 'background .35s, color .35s, border-color .35s',
              }}
            >
              <V size={13} /> {v.label}
            </div>
          );
        })}
      </div>
      <motion.div
        key={activa.label}
        className="mt-2 flex items-center gap-2 rounded-lg border bg-white px-3 py-2"
        style={{ borderColor: 'var(--color-crema-200)' }}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <ActivaIcon size={15} style={{ color: 'var(--color-guinda-700)' }} />
        <span className="text-[11px] leading-snug" style={{ color: '#57534e' }}>{activa.desc}</span>
      </motion.div>
    </div>
  );
}

/** Mini-resumen de calificaciones: tres contadores que "laten" por turnos. */
function StatsCalifAnimation() {
  const reduce = usePrefiereMenosMovimiento();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setI((v) => (v + 1) % 3), 900);
    return () => clearInterval(t);
  }, [reduce]);
  const tiles = [
    { label: 'Aprobados', value: '18', color: '#15803d', bg: '#dcfce7' },
    { label: 'No aprob.', value: '3', color: '#b91c1c', bg: '#fee2e2' },
    { label: 'Sin calif.', value: '5', color: '#b45309', bg: '#fef3c7' },
  ];
  return (
    <div
      className="mt-4 grid grid-cols-3 gap-2 rounded-xl border p-3"
      style={{ background: 'var(--color-crema-100)', borderColor: 'var(--color-crema-200)' }}
      aria-hidden
    >
      {tiles.map((t, idx) => (
        <motion.div
          key={t.label}
          className="flex flex-col items-center rounded-lg border bg-white py-2"
          style={{ borderColor: 'var(--color-crema-200)' }}
          initial={false}
          animate={{ scale: i === idx && !reduce ? 1.06 : 1, borderColor: i === idx ? t.color : 'var(--color-crema-200)' }}
          transition={{ type: 'spring', stiffness: 320, damping: 20 }}
        >
          <span className="flex h-6 items-center rounded-full px-2 text-[13px] font-bold" style={{ background: t.bg, color: t.color }}>{t.value}</span>
          <span className="mt-1 text-[9px] font-semibold" style={{ color: '#78716c' }}>{t.label}</span>
        </motion.div>
      ))}
    </div>
  );
}

/** Registro de ilustraciones disponibles por clave. */
export const ILLUSTRATIONS: Record<string, React.ComponentType> = {
  altaDosPasos: () => <FlowAnimation pasos={PASOS_ALTA_DOS} />,
  estadoFlow: () => <FlowAnimation pasos={PASOS_ESTADO} />,
  fichaFlow: () => <FlowAnimation pasos={PASOS_FICHA} />,
  dosVistas: DosVistasAnimation,
  statsCalif: StatsCalifAnimation,
  inscribeLote: () => <FlowAnimation pasos={PASOS_INSCRIBE} />,
  elegibleCheck: ElegibleCheckAnimation,
  altaConvocatoria: AltaConvocatoriaAnimation,
  curpCheck: CurpCheckAnimation,
  cuentaCorreo: CuentaCorreoAnimation,
  pagoFlow: () => <FlowAnimation pasos={PASOS_PAGO} />,
  gestorFlow: () => <FlowAnimation pasos={PASOS_GESTOR} />,
  pruebaFlow: () => <FlowAnimation pasos={PASOS_PRUEBA} />,
  altaFlow: () => <FlowAnimation pasos={PASOS_ALTA} />,
  cicloAdmin: () => <FlowAnimation pasos={PASOS_CICLO} />,
  solicitudFlow: () => <FlowAnimation pasos={PASOS_SOLICITUD} />,
  verificaFlow: () => <FlowAnimation pasos={PASOS_VERIFICA} />,
  chatLegal: ChatLegalAnimation,
  chatDemo: ChatDemoAnimation,
  aulaCard: AulaCardAnimation,
  aulaNav: AulaNavAnimation,
};
