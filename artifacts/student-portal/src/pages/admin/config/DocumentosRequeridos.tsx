import { Info, FileText, User, GraduationCap, CreditCard } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────

type DocDef = {
  icon: React.ElementType;
  titulo: string;
  descripcion: string;
};

const DOCUMENTOS: DocDef[] = [
  {
    icon: FileText,
    titulo: 'Acta de nacimiento',
    descripcion: 'PDF · Max 10 MB · Original o digitalizada',
  },
  {
    icon: User,
    titulo: 'Hoja de CURP',
    descripcion: 'PDF · Max 10 MB · CURP vigente',
  },
  {
    icon: GraduationCap,
    titulo: 'Certificado de secundaria',
    descripcion: 'PDF · Max 10 MB · Original o ambos lados',
  },
  {
    icon: CreditCard,
    titulo: 'Identificacion oficial (INE/IFE)',
    descripcion: 'PDF · Max 10 MB · Vigente, ambos lados',
  },
];

// ─── DocCard ──────────────────────────────────────────────────────────────

function DocCard({ doc }: { doc: DocDef }) {
  const Icon = doc.icon;
  return (
    <div
      className="bg-white rounded-xl border border-stone-200 p-4 flex items-start gap-3"
      style={{ borderLeft: '3px solid #6B1530' }}
    >
      {/* Icon circle */}
      <div
        className="flex-shrink-0 flex items-center justify-center rounded-full"
        style={{ width: 36, height: 36, background: '#efe7d6' }}
      >
        <Icon size={16} strokeWidth={2} style={{ color: '#6B1530' }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold mb-1" style={{ color: '#1a1a1a', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          {doc.titulo}
        </div>
        <div className="text-xs mb-2.5" style={{ color: '#78716c' }}>
          {doc.descripcion}
        </div>
        {/* Badges */}
        <div className="flex flex-wrap gap-1.5">
          <span
            className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full text-white"
            style={{ background: '#6B1530' }}
          >
            OBLIGATORIO
          </span>
          <span
            className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full"
            style={{ background: '#f5f5f4', color: '#57534e' }}
          >
            NORMA DGB22DR-001
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────

export default function DocumentosRequeridos({ onDirty: _onDirty }: { onDirty: (d: boolean) => void }) {
  return (
    <div>
      {/* Info banner */}
      <div
        className="flex items-start gap-3 px-4 py-3 rounded-xl border mb-5 text-sm"
        style={{ background: '#fdf8fb', border: '1px solid #e8d5e0' }}
      >
        <Info size={15} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1, color: '#6B1530' }} />
        <span style={{ color: '#5a0e32' }}>
          Los 4 documentos requeridos estan establecidos por la norma oficial <strong>DGB22DR-001</strong> de la
          Secretaria de Educacion Publica. No es posible modificarlos desde este sistema.
        </span>
      </div>

      {/* Section header card */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden mb-5">
        <div className="px-5 py-3" style={{ background: '#6B1530' }}>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <FileText size={14} strokeWidth={2} /> Documentos requeridos para inscripcion
          </h2>
        </div>
        <div className="p-5">
          <p className="text-sm mb-4" style={{ color: '#78716c' }}>
            Todos los aspirantes deben presentar los siguientes 4 documentos en formato PDF para completar
            su expediente de inscripcion. El sistema valida automaticamente que cada documento haya sido
            revisado y aprobado antes de proceder al registro definitivo.
          </p>

          {/* 2-column grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {DOCUMENTOS.map((doc) => (
              <DocCard key={doc.titulo} doc={doc} />
            ))}
          </div>

          {/* Footer note */}
          <div
            className="mt-5 pt-4 border-t border-stone-100 text-xs flex items-center gap-2"
            style={{ color: '#a8a29e' }}
          >
            <Info size={12} strokeWidth={2} />
            Para solicitar modificaciones a los requisitos documentales, comunicate con la Direccion General de
            Bachillerato de la SEP.
          </div>
        </div>
      </div>
    </div>
  );
}
