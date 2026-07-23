/**
 * Buscador global de Modula.
 *
 * Se abre con el botón del header, con Ctrl/⌘+K, o con "/" desde cualquier
 * parte. Escribe y resuelve: primero tus datos, luego respuestas que se leen
 * ahí mismo, y al final a dónde ir.
 *
 * Por qué esto NO usa cmdk ni `components/ui/command.tsx`:
 *  - cmdk filtra y ordena con su propio scorer, y aquí el orden lo decide
 *    nuestro motor (`lib/buscador/motor.ts`); había que desactivarlo entero.
 *  - el componente shadcn trae tokens de tema (bg-popover,
 *    text-popover-foreground) que no son la paleta guinda/crema del portal.
 *  - con `shouldFilter={false}` su manejo de Enter dejó de activar el elemento
 *    seleccionado. Lo único que aportaba era el teclado, y eso son las ~40
 *    líneas de `alTeclearEnLista` de aquí abajo. Menos dependencia, menos
 *    comportamiento ajeno que adivinar.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'wouter';
import * as Icons from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import { Search, CornerDownLeft, X } from 'lucide-react';
import { buscar } from '../../lib/buscador/motor';
import { INDICE } from '../../lib/buscador/indice';
import { useEntidades } from '../../lib/buscador/useEntidades';
import { useDatosPropios } from '../../lib/buscador/useDatosPropios';
import type { Resultado, RolBuscador, TipoResultado } from '../../lib/buscador/tipos';
import { useEsTelefono } from '../../lib/useMedia';

const GUINDA = 'var(--color-guinda-700)';

function Icono({ nombre, ...props }: { nombre?: string } & LucideProps) {
  const C = (nombre ? (Icons as unknown as Record<string, unknown>)[nombre] : null) as
    | React.ComponentType<LucideProps>
    | undefined;
  const Final = C ?? Icons.Circle;
  return <Final {...props} />;
}

/** Encabezado de cada grupo. El orden refleja la utilidad, no el alfabeto. */
const GRUPOS: { tipo: TipoResultado; titulo: string }[] = [
  { tipo: 'dato', titulo: 'Tu situación' },
  { tipo: 'respuesta', titulo: 'Respuestas' },
  { tipo: 'entidad', titulo: 'Personas y folios' },
  { tipo: 'seccion', titulo: 'Ir a' },
];

/** Sugerencias al abrir, cuando aún no se escribe nada. */
const SUGERENCIAS: Record<RolBuscador, string[]> = {
  estudiante: ['inscripción', 'ya pagué', 'qué documentos necesito', 'dónde presento mi examen'],
  gestor: ['dar de alta un alumno', 'pago grupal', 'documento rechazado', 'calificaciones'],
  admin: ['solicitudes', 'cargar calificaciones', 'pago grupal', 'verificar pase'],
  direccion: ['panorama', 'aprobación por módulo', 'salud del sistema', 'reportes'],
};

interface Props {
  rol: RolBuscador;
  /**
   * Datos propios adicionales, si alguna pantalla quiere aportar los suyos.
   * Lo normal es no pasar nada: `useDatosPropios` ya trae el estado del
   * usuario al abrir el buscador.
   */
  datos?: Resultado[];
}

export function BuscadorGlobal({ rol, datos }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [consulta, setConsulta] = useState('');
  const [, setLocation] = useLocation();
  const esTelefono = useEsTelefono();
  const inputRef = useRef<HTMLInputElement>(null);

  // Atajos: ⌘/Ctrl+K siempre; "/" sólo si no estás escribiendo en otro campo,
  // porque si no, sería imposible teclear una barra en cualquier formulario.
  useEffect(() => {
    function alTeclear(e: KeyboardEvent) {
      const enCampo = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName ?? '')
        || (e.target as HTMLElement)?.isContentEditable;
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setAbierto((v) => !v);
      } else if (e.key === '/' && !enCampo && !abierto) {
        e.preventDefault();
        setAbierto(true);
      } else if (e.key === 'Escape' && abierto) {
        setAbierto(false);
      }
    }
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [abierto]);

  // Al cerrar se limpia: reabrir con la búsqueda anterior a medias confunde.
  useEffect(() => {
    if (!abierto) setConsulta('');
  }, [abierto]);

  // Las entidades vienen del servidor y NO pasan por el motor de puntaje: el
  // servidor ya decidió que casan, y ordenarlas contra respuestas escritas a
  // mano sería comparar cosas distintas. Se muestran en su propio grupo.
  const entidades = useEntidades(rol, consulta);

  // Se piden al ABRIR, no al cargar la página: la mayoría de las visitas nunca
  // abren el buscador y no tiene por qué costarles una llamada.
  const mios = useDatosPropios(rol, abierto);
  const datosVivos = useMemo(() => [...mios, ...(datos ?? [])], [mios, datos]);

  const resultados = useMemo(
    () => (consulta.trim() ? buscar(consulta, INDICE, { rol, datos: datosVivos }, { limite: 14 }) : []),
    [consulta, rol, datosVivos],
  );

  const todos = useMemo(() => [...resultados, ...entidades], [resultados, entidades]);

  // Los resultados se muestran agrupados, pero el teclado los recorre como una
  // sola lista plana: para quien navega con flechas, los encabezados no existen.
  const planos = useMemo(
    () => GRUPOS.flatMap(({ tipo }) => todos.filter((r) => r.tipo === tipo)),
    [todos],
  );

  const [activo, setActivo] = useState(0);
  useEffect(() => { setActivo(0); }, [consulta]);

  const activar = useCallback((r: Resultado | undefined) => {
    if (!r?.ruta) return;
    // El ancla viaja en el hash para que la página destino pueda enfocar el
    // bloque exacto (los data-tour ya existen en todo el portal).
    setLocation(r.ancla ? `${r.ruta}#${r.ancla}` : r.ruta);
    setAbierto(false);
  }, [setLocation]);

  /** Flechas, Enter y Escape sobre la lista de resultados. */
  function alTeclearEnLista(e: React.KeyboardEvent) {
    if (planos.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActivo((i) => (i + 1) % planos.length);          // da la vuelta
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActivo((i) => (i - 1 + planos.length) % planos.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      activar(planos[activo]);
    }
  }

  return (
    <>
      <BotonAbrir onClick={() => setAbierto(true)} compacto={esTelefono} />

      {/* El diálogo se monta en <body> con un portal, NO donde vive el botón.
          El botón está dentro del header, que es `sticky z-50` y por tanto crea
          un contexto de apilamiento propio: ahí dentro, un z-[120] sólo compite
          contra sus hermanos, y el chat flotante y la barra inferior (z-55,
          fixed y fuera del header) se dibujaban ENCIMA del buscador. */}
      {abierto && createPortal(
        <div
          className="fixed inset-0 z-[120] flex items-start justify-center"
          style={{ paddingTop: esTelefono ? 0 : '10vh' }}
        >
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(28,10,18,0.55)' }}
            onClick={() => setAbierto(false)}
          />

          <div
            className="relative w-full sm:max-w-[640px] bg-white sm:rounded-xl shadow-2xl overflow-hidden flex flex-col"
            style={{
              maxHeight: esTelefono ? '100dvh' : '72vh',
              height: esTelefono ? '100dvh' : undefined,
              paddingBottom: esTelefono ? 'env(safe-area-inset-bottom, 0px)' : undefined,
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Buscador"
          >
            <div className="flex flex-col min-h-0 flex-1">
              <div className="flex items-center gap-2 px-3 sm:px-4 border-b border-stone-200 shrink-0">
                <Search size={17} style={{ color: GUINDA }} className="shrink-0" />
                <input
                  ref={inputRef}
                  autoFocus
                  value={consulta}
                  onChange={(e) => setConsulta(e.target.value)}
                  onKeyDown={alTeclearEnLista}
                  placeholder="Busca lo que necesites…"
                  aria-label="Busca lo que necesites"
                  className="flex-1 h-12 sm:h-14 bg-transparent outline-none text-[15px]"
                  style={{ color: '#2a2a2a' }}
                />
                <button
                  onClick={() => setAbierto(false)}
                  aria-label="Cerrar buscador"
                  className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full"
                  style={{ background: '#f5efe7', color: '#6b635e', border: 'none', cursor: 'pointer' }}
                >
                  <X size={15} />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 min-h-0 py-2">
                {!consulta.trim() && (
                  <Sugerencias
                    opciones={SUGERENCIAS[rol]}
                    onElegir={(s) => { setConsulta(s); inputRef.current?.focus(); }}
                  />
                )}

                {consulta.trim() && todos.length === 0 && (
                  <SinResultados rol={rol} onIrAMensajes={() => {
                    setLocation(rol === 'gestor' ? '/gestor/faq' : '/estudiante/faq');
                    setAbierto(false);
                  }} />
                )}

                {GRUPOS.map(({ tipo, titulo }) => {
                  const items = todos.filter((r) => r.tipo === tipo);
                  if (items.length === 0) return null;
                  return (
                    <div key={tipo} role="group" aria-label={titulo}>
                      <div
                        className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[0.15em]"
                        style={{ color: '#b39a56' }}
                      >
                        {titulo}
                      </div>
                      {items.map((r) => (
                        <Fila
                          key={r.id}
                          r={r}
                          seleccionado={planos[activo]?.id === r.id}
                          onActivar={() => activar(r)}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>

              {!esTelefono && <PieAtajos />}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

// ── Piezas ──────────────────────────────────────────────────────────────────

function BotonAbrir({ onClick, compacto }: { onClick: () => void; compacto: boolean }) {
  if (compacto) {
    return (
      <button
        onClick={onClick}
        aria-label="Buscar"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border"
        style={{ borderColor: '#eadfd7', color: GUINDA, background: '#faf6f0', cursor: 'pointer' }}
      >
        <Search size={18} />
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 pl-3 pr-2 py-2 rounded-lg border text-[13px]"
      style={{ background: '#f8f4ec', borderColor: '#eadfd7', color: '#6b635e', cursor: 'pointer' }}
    >
      <Search size={14} />
      <span className="hidden lg:inline">Buscar…</span>
      <kbd
        className="hidden lg:inline text-[10px] font-semibold px-1.5 py-0.5 rounded"
        style={{ background: 'white', border: '1px solid #eadfd7', color: '#a89a8e' }}
      >
        ⌘K
      </kbd>
    </button>
  );
}

function Fila({
  r, seleccionado, onActivar,
}: { r: Resultado; seleccionado: boolean; onActivar: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  // Que la selección del teclado no se salga de la vista.
  useEffect(() => {
    if (seleccionado) ref.current?.scrollIntoView({ block: 'nearest' });
  }, [seleccionado]);

  // Las respuestas y los datos muestran su texto completo: si hay que abrir
  // otra pantalla para leer la respuesta, el buscador no resolvió nada.
  const explica = r.tipo === 'respuesta' || r.tipo === 'dato';
  return (
    <div
      ref={ref}
      role="option"
      aria-selected={seleccionado}
      tabIndex={-1}
      onClick={onActivar}
      className="mx-2 px-3 py-2.5 rounded-lg cursor-pointer flex gap-3 items-start"
      style={{ background: seleccionado ? '#f8f4ec' : 'transparent' }}
    >
      <div
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
        style={{
          background: r.tipo === 'dato' ? '#efe7d6' : r.tipo === 'respuesta' ? '#f8e8ef' : '#f5efe7',
          color: GUINDA,
        }}
      >
        <Icono nombre={r.icono} size={14} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13.5px] font-semibold truncate" style={{ color: '#2a2a2a' }}>
            {r.titulo}
          </span>
          {r.pista && (
            <span
              className="shrink-0 text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{ background: '#f5efe7', color: '#8a7d72' }}
            >
              {r.pista}
            </span>
          )}
        </div>
        {r.cuerpo && (
          <div
            className={`text-[12px] mt-0.5 ${explica ? '' : 'truncate'}`}
            style={{ color: '#6b635e', lineHeight: 1.45 }}
          >
            {r.cuerpo}
          </div>
        )}
      </div>
    </div>
  );
}

function Sugerencias({ opciones, onElegir }: { opciones: string[]; onElegir: (s: string) => void }) {
  return (
    <div className="px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.15em] mb-2" style={{ color: '#b39a56' }}>
        Prueba con
      </div>
      <div className="flex flex-wrap gap-2">
        {opciones.map((o) => (
          <button
            key={o}
            onClick={() => onElegir(o)}
            className="text-[12px] px-2.5 py-1.5 rounded-full border"
            style={{ borderColor: '#eadfd7', background: '#faf6f0', color: '#6b635e', cursor: 'pointer' }}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Sin resultados NO es un callejón sin salida: se ofrece ir a Preguntas
 * frecuentes, donde están las dudas comunes ya resueltas.
 */
function SinResultados({ rol, onIrAMensajes }: { rol: RolBuscador; onIrAMensajes: () => void }) {
  const tieneFaq = rol === 'estudiante' || rol === 'gestor';
  return (
    <div className="px-5 py-8 text-center">
      <div className="text-[13px] font-semibold" style={{ color: '#2a2a2a' }}>
        No encontré nada con esas palabras
      </div>
      <div className="text-[12px] mt-1" style={{ color: '#6b635e' }}>
        Prueba con otra palabra{tieneFaq ? ', o revisa las preguntas frecuentes.' : '.'}
      </div>
      {tieneFaq && (
        <button
          onClick={onIrAMensajes}
          className="mt-3 text-[12.5px] font-semibold px-3.5 py-2 rounded-lg text-white"
          style={{ background: GUINDA, border: 'none', cursor: 'pointer' }}
        >
          Ver preguntas frecuentes
        </button>
      )}
    </div>
  );
}

function PieAtajos() {
  return (
    <div
      className="shrink-0 flex items-center gap-4 px-4 py-2 border-t border-stone-100 text-[10.5px]"
      style={{ color: '#a89a8e' }}
    >
      <span className="flex items-center gap-1">
        <CornerDownLeft size={11} /> abrir
      </span>
      <span>↑↓ moverse</span>
      <span>esc cerrar</span>
    </div>
  );
}
