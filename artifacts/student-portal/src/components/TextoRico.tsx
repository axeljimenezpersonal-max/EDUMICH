/**
 * Texto con formato ligero (estilo Canvas, sin complicarse): los textos se
 * guardan como texto plano con marcas markdown-lite y se renderizan bonito.
 *
 *  - **negritas**
 *  - líneas que empiezan con "- " → lista con viñetas
 *  - líneas que empiezan con "1. " → lista numerada
 *
 * `BarraFormato` es la barra de botones que inserta las marcas en un textarea
 * (gestor al redactar tareas/materiales, alumno en comentarios). `TextoRico`
 * renderiza el resultado. Sin HTML crudo → sin riesgo de inyección.
 */
import { useRef, type RefObject, type ReactNode } from 'react';
import { Bold, List, ListOrdered } from 'lucide-react';

// ── Render ───────────────────────────────────────────────────────────────────

/** Negritas en línea: **texto** → <strong>. */
function inline(texto: string): ReactNode[] {
  const partes: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0; let m: RegExpExecArray | null; let k = 0;
  while ((m = re.exec(texto)) !== null) {
    if (m.index > last) partes.push(texto.slice(last, m.index));
    partes.push(<strong key={`b${k++}`} className="font-semibold text-stone-900">{m[1]}</strong>);
    last = m.index + m[0].length;
  }
  if (last < texto.length) partes.push(texto.slice(last));
  return partes;
}

export function TextoRico({ texto, className }: { texto: string; className?: string }) {
  const lineas = texto.split('\n');
  const bloques: ReactNode[] = [];
  let lista: { tipo: 'ul' | 'ol'; items: string[] } | null = null;
  let k = 0;

  const cierraLista = () => {
    if (!lista) return;
    const items = lista.items.map((it, i) => <li key={i}>{inline(it)}</li>);
    bloques.push(lista.tipo === 'ul'
      ? <ul key={`l${k++}`} className="list-disc pl-5 space-y-0.5">{items}</ul>
      : <ol key={`l${k++}`} className="list-decimal pl-5 space-y-0.5">{items}</ol>);
    lista = null;
  };

  for (const linea of lineas) {
    const vineta = /^- (.*)$/.exec(linea);
    const numero = /^\d+\. (.*)$/.exec(linea);
    if (vineta) {
      if (lista?.tipo !== 'ul') { cierraLista(); lista = { tipo: 'ul', items: [] }; }
      lista.items.push(vineta[1]);
    } else if (numero) {
      if (lista?.tipo !== 'ol') { cierraLista(); lista = { tipo: 'ol', items: [] }; }
      lista.items.push(numero[1]);
    } else {
      cierraLista();
      bloques.push(linea.trim() === ''
        ? <div key={`s${k++}`} className="h-2" />
        : <p key={`p${k++}`} className="whitespace-pre-wrap break-words">{inline(linea)}</p>);
    }
  }
  cierraLista();
  return <div className={className ?? 'space-y-1'}>{bloques}</div>;
}

// ── Barra de formato ─────────────────────────────────────────────────────────

interface BarraProps {
  /** ref del textarea al que se le aplica el formato */
  areaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (v: string) => void;
}

export function BarraFormato({ areaRef, value, onChange }: BarraProps) {
  // Aplica un cambio y devuelve el foco al textarea con el cursor bien puesto.
  function aplicar(nuevo: string, selStart: number, selEnd: number) {
    onChange(nuevo);
    requestAnimationFrame(() => {
      const el = areaRef.current;
      if (el) { el.focus(); el.setSelectionRange(selStart, selEnd); }
    });
  }

  function negritas() {
    const el = areaRef.current; if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    const sel = value.slice(a, b) || 'texto';
    const nuevo = value.slice(0, a) + `**${sel}**` + value.slice(b);
    aplicar(nuevo, a + 2, a + 2 + sel.length);
  }

  function porLinea(prefijo: (i: number) => string) {
    const el = areaRef.current; if (!el) return;
    let { selectionStart: a, selectionEnd: b } = el;
    // Expande al inicio de la primera línea seleccionada
    a = value.lastIndexOf('\n', a - 1) + 1;
    if (b < a) b = a;
    const antes = value.slice(0, a);
    const seleccion = value.slice(a, b) || '';
    const despues = value.slice(b);
    const lineas = (seleccion || 'elemento').split('\n');
    const marcadas = lineas.map((l, i) => `${prefijo(i)}${l.replace(/^(- |\d+\. )/, '')}`).join('\n');
    aplicar(antes + marcadas + despues, a, a + marcadas.length);
  }

  const btn = 'flex h-7 w-7 items-center justify-center rounded-md text-stone-500 hover:bg-stone-100 hover:text-[var(--color-guinda-700)] transition-colors';
  return (
    <div className="flex items-center gap-0.5 rounded-t-lg border border-b-0 border-stone-300 bg-stone-50 px-1.5 py-1">
      <button type="button" onClick={negritas} className={btn} title="Negritas" aria-label="Negritas"><Bold size={14} /></button>
      <button type="button" onClick={() => porLinea(() => '- ')} className={btn} title="Lista con viñetas" aria-label="Viñetas"><List size={15} /></button>
      <button type="button" onClick={() => porLinea((i) => `${i + 1}. `)} className={btn} title="Lista numerada" aria-label="Numerada"><ListOrdered size={15} /></button>
      <span className="ml-1 text-[10px] text-stone-400">Selecciona texto y aplica formato</span>
    </div>
  );
}

/** Textarea con barra de formato integrada (atajo para no repetir el patrón). */
export function AreaConFormato({ value, onChange, rows = 4, placeholder }: {
  value: string; onChange: (v: string) => void; rows?: number; placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  return (
    <div>
      <BarraFormato areaRef={ref} value={value} onChange={onChange} />
      <textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder}
        className="w-full rounded-b-lg border border-stone-300 px-3 py-2 text-sm focus:border-[var(--color-guinda-500)] focus:outline-none" />
    </div>
  );
}
