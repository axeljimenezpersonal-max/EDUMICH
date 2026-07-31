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
 *
 * Mientras se escribe, el número se agrupa solo: `443 123 4567`. Los espacios
 * son presentación pura —lo que se guarda son los diez dígitos— pero hacen que
 * el número se pueda revisar de un vistazo en vez de contar dígitos pegados.
 */
import { useLayoutEffect, useRef } from 'react';

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

/**
 * `4431234567` → `443 123 4567`.
 *
 * Se agrupa 3-3-4 porque así se dicta un teléfono en México y así se lee de un
 * vistazo para comprobarlo. Los espacios son SOLO presentación: lo que se
 * guarda siguen siendo los diez dígitos pelones.
 */
export function agruparTelefono(digitos: string): string {
  const d = digitos.slice(0, 10);
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 10)].filter(Boolean).join(' ');
}

/**
 * En qué posición del texto ya agrupado quedan `n` dígitos a la izquierda.
 *
 * Es lo que permite devolver el cursor a su lugar después de reformatear: la
 * posición en caracteres cambia cuando entran o salen espacios, pero "voy en el
 * quinto dígito" no cambia, y eso es lo que la persona tiene en la cabeza.
 */
function posicionTrasNDigitos(texto: string, n: number): number {
  if (n <= 0) return 0;
  let vistos = 0;
  for (let i = 0; i < texto.length; i++) {
    if (/\d/.test(texto[i])) {
      vistos++;
      if (vistos === n) return i + 1;
    }
  }
  return texto.length;
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
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Dónde debe quedar el cursor después de que React repinte con el texto ya
  // agrupado. Sin esto, cada espacio que entra empuja el cursor al final y
  // corregir un dígito de en medio se vuelve imposible.
  const caretPendiente = useRef<number | null>(null);

  const mostrado = agruparTelefono(soloDiezDigitos(value));

  useLayoutEffect(() => {
    if (caretPendiente.current === null || !inputRef.current) return;
    inputRef.current.setSelectionRange(caretPendiente.current, caretPendiente.current);
    caretPendiente.current = null;
  });

  function alCambiar(e: React.ChangeEvent<HTMLInputElement>) {
    const crudo = e.target.value;
    const caret = e.target.selectionStart ?? crudo.length;
    // Lo único que sobrevive al reformateo es cuántos DÍGITOS quedaron a la
    // izquierda del cursor: los espacios los pone el campo, no la persona.
    const digitosAntes = crudo.slice(0, caret).replace(/\D/g, '').length;
    const digitos = soloDiezDigitos(crudo);
    caretPendiente.current = posicionTrasNDigitos(
      agruparTelefono(digitos),
      Math.min(digitosAntes, digitos.length),
    );
    onChange(digitos ? `+52 ${digitos}` : '');
  }

  function alTeclear(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Backspace') return;
    const input = e.currentTarget;
    const pos = input.selectionStart ?? 0;
    // Con texto seleccionado, o al inicio, el comportamiento normal ya sirve.
    if (input.selectionEnd !== pos || pos === 0) return;
    if (input.value[pos - 1] !== ' ') return;
    // Borrar el espacio no borraría nada visible —el campo lo vuelve a poner— y
    // la tecla parecería descompuesta. Se borra el dígito de antes, que es lo
    // que la persona quiso.
    e.preventDefault();
    const restante = input.value.slice(0, pos - 2) + input.value.slice(pos);
    const digitos = soloDiezDigitos(restante);
    caretPendiente.current = posicionTrasNDigitos(agruparTelefono(digitos), pos - 2);
    onChange(digitos ? `+52 ${digitos}` : '');
  }

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
          ref={inputRef}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          required={required}
          disabled={disabled}
          value={mostrado}
          onChange={alCambiar}
          onKeyDown={alTeclear}
          placeholder={placeholder}
          // 10 dígitos + los 2 espacios que pone el propio campo.
          maxLength={12}
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
