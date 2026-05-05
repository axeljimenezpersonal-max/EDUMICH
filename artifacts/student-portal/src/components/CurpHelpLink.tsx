import { ExternalLink } from 'lucide-react';

export function CurpHelpLink() {
  return (
    <a
      href="https://www.gob.mx/curp/"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-xs text-[var(--color-guinda-700)] hover:text-[var(--color-guinda-800)] hover:underline mt-1.5 transition-colors"
    >
      <ExternalLink size={12} />
      No tengo mi CURP a la mano — consultar en gob.mx
    </a>
  );
}
