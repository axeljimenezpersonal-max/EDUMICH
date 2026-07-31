/**
 * CampoTelefono — captura de teléfono con el `+52` FIJO.
 *
 * Regla del sistema: todos los números se guardan como `+52 NNNNNNNNNN`. El
 * prefijo se muestra pegado al campo pero no se puede editar ni borrar, y solo
 * se aceptan 10 dígitos. Así la base queda uniforme: sin números con lada, sin
 * paréntesis, sin unos con +52 y otros sin él.
 *
 * Se usa en TODA la plataforma (alumno, gestor, admin, creador, sedes y
 * formularios públicos) para que capturar un teléfono se sienta igual en todas
 * las pantallas y el dato salga siempre parejo.
 */

/**
 * Deja solo los 10 dígitos nacionales de un valor guardado.
 *
 * El prefijo se reconoce POR SU FORMA (`+52 …`), no contando dígitos. Contarlos
 * fallaba mientras se escribía: con el número a medias hay menos de diez, así
 * que el `52` del prefijo no se quitaba y se mostraba como parte del número.
 * Al teclear, ese texto volvía a entrar y se le pegaba otro `+52` encima, de
 * modo que cada tecla agrandaba la bola: `1` → `521` → `525211` → …
 */
export function soloDiezDigitos(valor: string | null | undefined): string {
  const texto = (valor ?? '').trim();
  // Forma canónica que emite este mismo campo, completa o a medio escribir.
  const canonico = texto.match(/^\+\s?52[\s.-]?(\d{0,10})$/);
  if (canonico) return canonico[1];
  // Cualquier otra procedencia (carga vieja, pegado desde WhatsApp): ahí sí se
  // cuenta, porque no hay una forma conocida en la cual apoyarse.
  const d = texto.replace(/\D/g, '');
  const sinPais = d.length > 10 && d.startsWith('52') ? d.slice(2) : d;
  return sinPais.slice(0, 10);
}

/** Formato canónico para guardar: `+52 NNNNNNNNNN` (vacío si no hay número). */
export function telefonoCanonico(valor: string | null | undefined): string {
  const d = soloDiezDigitos(valor);
  return d ? `+52 ${d}` : '';
}

interface Props {
  /** Valor guardado (con o sin +52: se normaliza para mostrarlo). */
  value: string | null | undefined;
  /** Devuelve SIEMPRE el formato canónico `+52 NNNNNNNNNN`, o '' si se vació. */
  onChange: (canonico: string) => void;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /** Texto de ayuda bajo el campo. */
  ayuda?: string;
}

export function CampoTelefono({
  value, onChange, id, required, disabled,
  placeholder = '443 123 4567', className = '', ayuda,
}: Props) {
  return (
    <div className={className}>
      <div className="flex">
        {/* Prefijo fijo: parte del campo, no un dato que se pueda alterar. */}
        <span
          className="flex select-none items-center rounded-l-lg border border-r-0 px-3 text-sm font-semibold"
          style={{ borderColor: 'var(--color-crema-200, #e7e2dc)', background: 'var(--color-crema-100, #f7f2ed)', color: '#57534e' }}
          aria-hidden
        >
          +52
        </span>
        <input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          required={required}
          disabled={disabled}
          value={soloDiezDigitos(value)}
          onChange={(e) => onChange(telefonoCanonico(e.target.value))}
          placeholder={placeholder}
          maxLength={10}
          className="gov-input"
          style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
          aria-describedby={ayuda && id ? `${id}-ayuda` : undefined}
        />
      </div>
      <p id={ayuda && id ? `${id}-ayuda` : undefined} className="mt-1 text-[11px] text-stone-400">
        {ayuda ?? '10 dígitos, sin lada de país.'}
      </p>
    </div>
  );
}
