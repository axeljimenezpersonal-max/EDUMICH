/**
 * Stepper del proceso de pago del derecho de examen — compartido por el gestor
 * y el alumno. Muestra los 4 pasos (Solicitada → Emisión → Pago → Confirmado),
 * resalta el paso actual con su descripción y colorea por estado.
 */
import type { ReactNode } from 'react';
import { FileText, Landmark, UploadCloud, CheckCircle2, Check, Ban } from 'lucide-react';
import type { PagoExamenEstado } from '../lib/api';

// `desc` = texto para quien paga (gestor/alumno, 2ª persona).
// `descAdmin` = texto para la coordinación/admin (3ª persona, acción del admin).
const PASOS: { label: string; desc: string; descAdmin: string; icon: ReactNode }[] = [
  {
    label: 'Solicitada',
    desc: 'Se solicitó la ficha de pago de estos exámenes. En espera de que la coordinación la emita.',
    descAdmin: 'El gestor/alumno solicitó esta ficha. Emite la orden con su línea de captura para que pueda pagar.',
    icon: <FileText size={26} />,
  },
  {
    label: 'Emisión',
    desc: 'La coordinación revisó y emitió la orden con su línea de captura. Ya puedes pagar.',
    descAdmin: 'Orden emitida. El gestor/alumno ya puede pagar ante la Tesorería del Estado y subir su comprobante.',
    icon: <Landmark size={26} />,
  },
  {
    label: 'Pago',
    desc: 'Descarga la orden, paga ante la Tesorería del Estado y sube tu comprobante.',
    descAdmin: 'El gestor/alumno subió su comprobante de pago. Verifícalo y concilia la orden.',
    icon: <UploadCloud size={26} />,
  },
  {
    label: 'Confirmado',
    desc: 'La coordinación validó el pago. Los alumnos quedan inscritos oficialmente.',
    descAdmin: 'Validaste el pago. Los alumnos quedan inscritos oficialmente.',
    icon: <CheckCircle2 size={26} />,
  },
];

export function PagoStepper({ estado, perspectiva = 'propia' }: { estado: PagoExamenEstado; perspectiva?: 'propia' | 'admin' }) {
  const actual = estado === 'pendiente_emision' ? 0 : estado === 'emitida' ? 1 : estado === 'en_revision' ? 2 : 3;
  const terminado = estado === 'pagado';
  const cancelado = estado === 'cancelado' || estado === 'vencido';
  const accent = cancelado ? '#b91c1c' : terminado ? '#15803d' : 'var(--color-guinda-700)';
  const paso = PASOS[actual];

  return (
    <div className="relative overflow-hidden rounded-2xl border p-5 sm:p-6"
      style={{ borderColor: cancelado ? '#fecaca' : terminado ? '#bbf7d0' : '#e8c4d4', background: 'linear-gradient(135deg, #fbf7f8 0%, #ffffff 62%)' }}>
      <div className="pointer-events-none absolute -right-16 -top-16 w-48 h-48 rounded-full" style={{ background: accent, opacity: 0.05 }} />

      {/* Encabezado del paso actual */}
      <div className="relative flex items-center gap-4 mb-5">
        <div className="relative shrink-0">
          {!terminado && !cancelado && <span className="absolute inset-0 rounded-full animate-ping" style={{ background: accent, opacity: 0.22 }} />}
          <span className="relative w-14 h-14 rounded-full flex items-center justify-center text-white"
            style={{ background: cancelado ? 'linear-gradient(135deg,#b91c1c,#ef4444)' : terminado ? 'linear-gradient(135deg,#15803d,#22c55e)' : 'linear-gradient(135deg, var(--color-guinda-800), var(--color-guinda-600))' }}>
            {cancelado ? <Ban size={26} /> : paso.icon}
          </span>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] font-bold" style={{ color: accent }}>
            {cancelado ? (estado === 'vencido' ? 'Vencida' : 'Cancelada') : terminado ? 'Completado' : `Paso ${actual + 1} de 4 · En proceso`}
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-stone-900 leading-tight">
            {cancelado ? (estado === 'vencido' ? 'Ficha vencida' : 'Ficha cancelada') : paso.label}
          </h3>
        </div>
      </div>
      <p className="relative text-stone-600 text-sm sm:text-[15px] leading-relaxed max-w-2xl mb-6">
        {cancelado
          ? (estado === 'vencido'
              ? (perspectiva === 'admin' ? 'La ficha venció sin pagarse. Puedes re-emitirla con una nueva línea de captura.' : 'La ficha venció sin pagarse. Solicita una nueva a la coordinación.')
              : 'Esta ficha fue cancelada; los exámenes quedaron libres.')
          : (perspectiva === 'admin' ? paso.descAdmin : paso.desc)}
      </p>

      {/* Barra de pasos */}
      <div className="relative flex items-center">
        {PASOS.map((s, i) => {
          const done = !cancelado && (i < actual || (terminado && i === actual));
          const active = !cancelado && !terminado && i === actual;
          return (
            <div key={s.label} className="flex items-center" style={{ flex: i < PASOS.length - 1 ? 1 : '0 0 auto' }}>
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors"
                  style={{ background: done ? accent : '#fff', borderColor: done || active ? accent : '#e7e0d9', color: done ? '#fff' : active ? accent : '#d6d3d1' }}>
                  {done ? <Check size={14} /> : active ? <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: accent }} /> : i + 1}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: done ? '#57534e' : active ? accent : '#d6d3d1' }}>{s.label}</span>
              </div>
              {i < PASOS.length - 1 && <div className="flex-1 h-0.5 mx-1 rounded-full -mt-4" style={{ background: done ? accent : '#e7e0d9' }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PagoStepper;
