/**
 * Badge de estado para documentos e inscripciones.
 *
 * Ubicación destino en Replit: artifacts/student-portal/src/components/StatusBadge.tsx
 */

import { CheckCircle2, Clock, XCircle, FileText, AlertCircle } from 'lucide-react';

const styles: Record<string, { bg: string; fg: string; icon: typeof CheckCircle2; label: string }> = {
  aprobado: {
    bg: 'bg-green-50 border-green-200',
    fg: 'text-green-800',
    icon: CheckCircle2,
    label: 'Aprobado',
  },
  pendiente_revision: {
    bg: 'bg-amber-50 border-amber-200',
    fg: 'text-amber-800',
    icon: Clock,
    label: 'Pendiente de revisión',
  },
  rechazado: {
    bg: 'bg-red-50 border-red-200',
    fg: 'text-red-800',
    icon: XCircle,
    label: 'Rechazado',
  },
  pre_registro: {
    bg: 'bg-stone-50 border-stone-200',
    fg: 'text-stone-700',
    icon: FileText,
    label: 'Pre-registro',
  },
  documentos_pendientes: {
    bg: 'bg-amber-50 border-amber-200',
    fg: 'text-amber-800',
    icon: AlertCircle,
    label: 'Documentos pendientes',
  },
  documentos_completos: {
    bg: 'bg-blue-50 border-blue-200',
    fg: 'text-blue-800',
    icon: CheckCircle2,
    label: 'Documentos completos',
  },
  pago_pendiente: {
    bg: 'bg-amber-50 border-amber-200',
    fg: 'text-amber-800',
    icon: Clock,
    label: 'Pago pendiente',
  },
  pago_verificado: {
    bg: 'bg-green-50 border-green-200',
    fg: 'text-green-800',
    icon: CheckCircle2,
    label: 'Pago verificado',
  },
  ficha_generada: {
    bg: 'bg-blue-50 border-blue-200',
    fg: 'text-blue-800',
    icon: FileText,
    label: 'Ficha generada',
  },
  registrado: {
    bg: 'bg-green-50 border-green-200',
    fg: 'text-green-800',
    icon: CheckCircle2,
    label: 'Registrado',
  },
  en_curso: {
    bg: 'bg-blue-50 border-blue-200',
    fg: 'text-blue-800',
    icon: FileText,
    label: 'En curso',
  },
  evaluado: {
    bg: 'bg-purple-50 border-purple-200',
    fg: 'text-purple-800',
    icon: CheckCircle2,
    label: 'Evaluado',
  },
};

export function StatusBadge({ estado }: { estado: string }) {
  const style = styles[estado] ?? {
    bg: 'bg-stone-50 border-stone-200',
    fg: 'text-stone-700',
    icon: FileText,
    label: estado,
  };
  const Icon = style.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${style.bg} ${style.fg}`}
    >
      <Icon size={12} />
      {style.label}
    </span>
  );
}
