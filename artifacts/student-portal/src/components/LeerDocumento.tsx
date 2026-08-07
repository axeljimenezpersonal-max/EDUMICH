/**
 * "Sube tu documento y lo llenamos por ti."
 *
 * El mismo componente para el alumno que se registra solo y para el centro que
 * da de alta. No son dos versiones parecidas: es una, porque en cuanto se
 * duplica, una de las dos empieza a quedarse atrás y la gente aprende dos
 * comportamientos distintos para lo mismo.
 *
 * ── Las tres reglas de esta pantalla ────────────────────────────────────────
 *
 * 1. PROPONE, NO IMPONE. Lo leído se escribe en el formulario y se marca; la
 *    persona lo ve, lo corrige si hace falta y sigue. Nunca se guarda algo que
 *    nadie miró.
 *
 * 2. NO PISA LO YA ESCRITO. Si alguien ya tecleó su nombre, la lectura no se
 *    lo cambia por debajo. Lo que uno escribió con su mano gana.
 *
 * 3. FALLAR ES NORMAL Y BARATO. Una foto borrosa, un PDF escaneado o una
 *    credencial vieja son casos esperados, no errores. Cuando no se puede
 *    leer, se dice en una línea y el formulario sigue exactamente como estaba:
 *    a mano, como siempre. Esto es un atajo, y un atajo que estorba deja de
 *    serlo.
 */
import { useRef, useState } from 'react';
import { ScanLine, Check, Loader2, Info } from 'lucide-react';

/** Los campos que una lectura puede proponer. */
export interface CamposLeidos {
  curp?: string;
  nombres?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  fechaNacimiento?: string;
  sexo?: 'hombre' | 'mujer' | 'no_definir';
  entidadNacimiento?: string;
}

export type FuenteDato = 'pdf_curp' | 'pdf_acta' | 'ine_mrz';

interface Respuesta {
  ok: boolean;
  fuente: FuenteDato | null;
  campos: CamposLeidos;
  aviso?: string;
}

/** Cómo se le llama a cada documento delante de una persona. */
const NOMBRE_FUENTE: Record<FuenteDato, string> = {
  pdf_curp: 'tu constancia de CURP',
  pdf_acta: 'tu acta de nacimiento',
  ine_mrz: 'tu identificación',
};

const ETIQUETA_CAMPO: Record<keyof CamposLeidos, string> = {
  curp: 'CURP',
  nombres: 'Nombre(s)',
  apellidoPaterno: 'Apellido paterno',
  apellidoMaterno: 'Apellido materno',
  fechaNacimiento: 'Fecha de nacimiento',
  sexo: 'Sexo',
  entidadNacimiento: 'Entidad de nacimiento',
};

const GUINDA = 'var(--color-guinda-700)';

interface Props {
  /**
   * Recibe lo leído y decide qué aplicar. Devuelve los campos que SÍ cambió,
   * para poder decirle a la persona qué se llenó — decir "listo" sin señalar
   * qué se movió obliga a revisar todo el formulario a ojo.
   */
  onLeido: (campos: CamposLeidos, fuente: FuenteDato) => (keyof CamposLeidos)[];
  /** Texto de arriba. El alumno y el centro no hablan de lo mismo. */
  titulo?: string;
  descripcion?: string;
}

export function LeerDocumento({ onLeido, titulo, descripcion }: Props) {
  const entrada = useRef<HTMLInputElement | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [aplicados, setAplicados] = useState<{ campos: (keyof CamposLeidos)[]; fuente: FuenteDato } | null>(null);

  async function alElegir(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    // El input se limpia SIEMPRE: si no, elegir dos veces el mismo archivo no
    // vuelve a disparar el evento y parece que el botón se descompuso.
    e.target.value = '';
    if (!f) return;

    setLeyendo(true);
    setAviso(null);
    setAplicados(null);
    try {
      const fd = new FormData();
      fd.append('archivo', f);
      // `fetch` directo y no el cliente de `api`: este endpoint responde 200
      // aunque no haya podido leer —"no se pudo" es una respuesta válida— y no
      // queremos que se convierta en una excepción.
      const res = await fetch('/api/publico/leer-documento', { method: 'POST', body: fd, credentials: 'include' });
      const r: Respuesta = await res.json();

      if (!r.ok || !r.fuente) {
        setAviso(r.aviso ?? 'No se pudo leer el documento. Captura los datos a mano.');
        return;
      }
      const cambiados = onLeido(r.campos, r.fuente);
      if (cambiados.length === 0) {
        setAviso('Se leyó bien, pero todos esos datos ya estaban capturados. No se cambió nada.');
        return;
      }
      setAplicados({ campos: cambiados, fuente: r.fuente });
    } catch {
      setAviso('No se pudo leer el documento. Captura los datos a mano.');
    } finally {
      setLeyendo(false);
    }
  }

  return (
    <div className="rounded-2xl border" style={{ borderColor: '#e7dfd5', background: '#fdfbf8' }}>
      <div className="flex flex-wrap items-center gap-3 px-4 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
             style={{ background: 'var(--color-crema-100)', color: GUINDA }}>
          <ScanLine size={19} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-bold text-stone-900">
            {titulo ?? '¿Quieres que lo llenemos por ti?'}
          </p>
          <p className="text-[12.5px] leading-relaxed text-stone-500">
            {descripcion ?? 'Sube la constancia de CURP, el acta o una foto del reverso de la identificación, y tomamos de ahí los datos.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => entrada.current?.click()}
          disabled={leyendo}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-60"
          style={{ background: GUINDA }}
        >
          {leyendo
            ? <><Loader2 size={15} className="animate-spin" /> Leyendo…</>
            : <><ScanLine size={15} /> Subir documento</>}
        </button>
        <input
          ref={entrada}
          type="file"
          accept="application/pdf,image/*"
          // `capture` no se pone a propósito: en el teléfono, forzar la cámara
          // le quitaría la opción de elegir el PDF que ya tiene guardado — y el
          // PDF se lee exacto, mientras que la foto puede fallar.
          onChange={alElegir}
          className="hidden"
        />
      </div>

      {aplicados && (
        <div className="border-t px-4 py-3" style={{ borderColor: '#efe7dd', background: '#f0fdf4' }}>
          <p className="flex items-start gap-2 text-[12.5px] leading-relaxed" style={{ color: '#166534' }}>
            <Check size={15} className="mt-0.5 shrink-0" />
            <span>
              Se llenó desde {NOMBRE_FUENTE[aplicados.fuente]}:{' '}
              <strong>{aplicados.campos.map((c) => ETIQUETA_CAMPO[c]).join(', ')}</strong>.{' '}
              Revísalo y corrige lo que haga falta antes de continuar.
            </span>
          </p>
        </div>
      )}

      {aviso && (
        <div className="border-t px-4 py-3" style={{ borderColor: '#efe7dd', background: '#fff8ec' }}>
          <p className="flex items-start gap-2 text-[12.5px] leading-relaxed" style={{ color: '#7c5314' }}>
            <Info size={15} className="mt-0.5 shrink-0" />
            <span>{aviso}</span>
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Marca visual de "esto lo leímos del documento, confírmalo".
 *
 * Va pegada al campo y no en un resumen aparte: la revisión ocurre mirando el
 * formulario, no una lista en otro lado.
 */
export function MarcaLeido({ fuente }: { fuente?: FuenteDato }) {
  if (!fuente) return null;
  return (
    <span
      className="ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide align-middle"
      style={{ background: 'var(--color-crema-100)', color: GUINDA }}
      title={`Se leyó de ${NOMBRE_FUENTE[fuente]}. Revísalo.`}
    >
      <ScanLine size={10} /> Leído
    </span>
  );
}
