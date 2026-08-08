/**
 * La zona donde se adjunta el comprobante de pago.
 *
 * Existe para que arrastrar y soltar funcione también aquí. El bloque estaba
 * escrito a mano dentro de un `.map` en dos pantallas —la del alumno y la del
 * centro— y el estado de "hay un archivo encima" es de cada zona, así que no
 * podía vivir en el componente que las recorre: los hooks no se pueden llamar
 * dentro de un bucle.
 *
 * El comprobante NO se convierte a PDF como los documentos del expediente
 * (ver `services/aPdf.ts`): aquí una foto del recibo se guarda como foto, que
 * es lo que la conciliación espera.
 */
import { Loader2, UploadCloud } from 'lucide-react';
import { useRef } from 'react';
import { useSoltarArchivo } from '../lib/useSoltarArchivo';

interface Props {
  /** Recibe el archivo elegido o soltado. */
  onArchivo: (archivo: File) => void;
  /** Se está enviando: la zona se apaga para no mandar dos veces. */
  subiendo?: boolean;
  /**
   * Por qué no se puede todavía (p. ej. "Primero elige el método de pago").
   * Con esto puesto, la zona queda inhabilitada y lo dice.
   */
  bloqueadoPor?: string | null;
  /** Nombre del archivo ya elegido, si la pantalla lo conserva antes de enviar. */
  nombreArchivo?: string | null;
  /** `compacta` es la fila del alumno; la otra es el recuadro alto del centro. */
  variante?: 'compacta' | 'alta';
}

export function ZonaComprobante({
  onArchivo,
  subiendo = false,
  bloqueadoPor = null,
  nombreArchivo = null,
  variante = 'compacta',
}: Props) {
  const input = useRef<HTMLInputElement>(null);
  const inhabilitada = subiendo || !!bloqueadoPor;
  const zona = useSoltarArchivo(onArchivo, !inhabilitada);

  const borde = inhabilitada
    ? 'border-stone-200 opacity-60 cursor-not-allowed'
    : zona.encima
      ? 'border-[var(--color-guinda-700)] bg-[var(--color-guinda-50,#faf0f3)] cursor-copy'
      : nombreArchivo
        ? 'border-[var(--color-guinda-700)] bg-[var(--color-guinda-50,#faf0f3)] cursor-pointer'
        : 'border-stone-300 hover:border-[var(--color-guinda-700)] cursor-pointer';

  const texto = subiendo
    ? 'Enviando…'
    : bloqueadoPor
      ? bloqueadoPor
      : zona.encima
        ? 'Suelta aquí el comprobante'
        : nombreArchivo
          ? nombreArchivo
          : 'Arrastra el comprobante aquí o toca para elegirlo (PDF o imagen)';

  const campo = (
    <input
      ref={input}
      type="file"
      accept="application/pdf,image/*"
      className="hidden"
      disabled={inhabilitada}
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) onArchivo(f);
        // Siempre: si no, volver a elegir el MISMO archivo no dispara el
        // evento y parece que el campo se descompuso.
        e.currentTarget.value = '';
      }}
    />
  );

  if (variante === 'alta') {
    return (
      <div
        {...zona.props}
        onClick={() => !inhabilitada && input.current?.click()}
        className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl py-7 px-4 text-center transition-colors ${borde}`}
      >
        {subiendo
          ? <Loader2 size={30} className="animate-spin text-stone-400" />
          : <UploadCloud size={30} className={nombreArchivo || zona.encima ? 'text-[var(--color-guinda-700)]' : 'text-stone-400'} />}
        <div className="text-sm font-bold uppercase tracking-wide text-stone-700">Comprobante</div>
        <span className="text-xs text-stone-500 truncate max-w-full">{texto}</span>
        {campo}
      </div>
    );
  }

  return (
    <div
      {...zona.props}
      onClick={() => !inhabilitada && input.current?.click()}
      className={`flex items-center gap-3 border-2 border-dashed rounded-xl p-3 transition-colors ${borde}`}
    >
      {subiendo
        ? <Loader2 size={18} className="animate-spin text-stone-400" />
        : <UploadCloud size={18} className={zona.encima ? 'text-[var(--color-guinda-700)]' : 'text-stone-400'} />}
      <span className="text-sm text-stone-500">{texto}</span>
      {campo}
    </div>
  );
}
