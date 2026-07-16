/**
 * Credencial digital — tarjeta RECTANGULAR (frente + reverso), diseño oficial.
 * - Admin / gestor: frente y reverso lado a lado (todo visible).
 * - Alumno (`flippable`): UNA sola tarjeta que se voltea (frente ↔ reverso/QR),
 *   con modo PRESENTAR a pantalla completa (ver `Presentacion` abajo).
 * Recibe `basePath` (p. ej. /admin/alumnos/25 o /estudiante) y consulta
 * `${basePath}/credencial`. SIEMPRE refleja la credencial realmente emitida.
 *
 * El DISEÑO de la tarjeta es fijo y no se toca: todo lo de aquí es tamaño y
 * presentación, nunca maquetación de las caras.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { ShieldCheck, ImageOff, RotateCcw, Maximize2, X } from 'lucide-react';
import { api } from '../lib/api';

interface CredData {
  emitida: boolean;
  folio: string;
  nombre: string;
  matricula: string | null;
  curp: string;
  sede: string;
  plan: string;
  emision: string | null;
  vigencia: string | null;
  vencida: boolean;
  convocatorias: string[];
  verifyUrl: string;
  fotoUrl: string | null;
}

const GUINDA_HEADER = 'linear-gradient(90deg, var(--color-guinda-800) 0%, var(--color-guinda-600) 100%)';
const CARD_W = 460; // más ancha (proporción de credencial) — frente y reverso iguales
const FLIP_H = 210; // alto fijo de respaldo; en modo volteable se mide dinámicamente

function Campo({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[8px] font-bold uppercase tracking-[0.14em]" style={{ color: '#a89a8e' }}>{label}</div>
      <div className={`${mono ? 'font-mono' : ''} font-bold leading-tight`} style={{ fontSize: mono ? 12 : 13, color: '#2a2320', letterSpacing: mono ? '0.02em' : 0 }}>
        {value || '—'}
      </div>
    </div>
  );
}

/** Frente. `fill` estira a la altura del contenedor (modo volteable). */
function Frente({ d, fill }: { d: CredData; fill?: boolean }) {
  return (
    <div style={{ width: '100%', height: fill ? '100%' : undefined, display: 'flex', flexDirection: 'column', borderRadius: 16, overflow: 'hidden', border: '1px solid #e7dcd3', background: '#fbf7f5', boxShadow: '0 8px 26px rgba(74,14,32,0.10)' }}>
      <div style={{ background: GUINDA_HEADER, padding: '13px 18px', borderBottom: '3px solid #b8975a' }}>
        <div className="text-white font-bold text-[13px] tracking-wide">CREDENCIAL DEL ESTUDIANTE</div>
        <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.82)' }}>Preparatoria Abierta Michoacán · IEMSyS</div>
      </div>
      {/* Cuerpo en 3 columnas: foto · datos · QR (al lado, no debajo) */}
      <div className="p-4 flex gap-4 items-center" style={{ flex: 1 }}>
        <div style={{ width: 92, height: 112, borderRadius: 8, overflow: 'hidden', border: '2px solid #b8975a', background: '#efe7de', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {d.fotoUrl
            ? <img src={d.fotoUrl} alt="Foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div className="flex flex-col items-center gap-1 text-[9px]" style={{ color: '#b3a596' }}><ImageOff size={18} /> Sin foto</div>}
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-2.5">
          <Campo label="Nombre" value={d.nombre} />
          <Campo label="Matrícula oficial DGB" value={d.matricula ?? 'Sin asignar'} mono />
          <Campo label="Folio de credencial" value={d.folio} mono />
        </div>
        <div className="shrink-0 flex flex-col items-center gap-1.5">
          <div style={{ background: '#fff', padding: 6, borderRadius: 8, border: '1px solid #eadfd7' }}>
            <QRCodeSVG value={d.verifyUrl} size={92} fgColor="#2a1720" bgColor="#ffffff" level="M" />
          </div>
          <div className="flex items-center gap-1 text-[9px] font-semibold" style={{ color: 'var(--color-guinda-700)' }}>
            <ShieldCheck size={11} /> Verificable
          </div>
        </div>
      </div>
    </div>
  );
}

/** Reverso (datos + estado + convocatorias). */
function Reverso({ d, fill }: { d: CredData; fill?: boolean }) {
  return (
    <div style={{ width: '100%', height: fill ? '100%' : undefined, display: 'flex', flexDirection: 'column', borderRadius: 16, overflow: 'hidden', border: '1px solid #e7dcd3', background: '#ffffff', boxShadow: '0 8px 26px rgba(74,14,32,0.10)' }}>
      <div style={{ background: 'var(--color-guinda-800)', padding: '11px 18px' }}>
        <div className="text-white font-bold text-[12px] tracking-wide">DATOS DE LA CREDENCIAL</div>
      </div>
      <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-3" style={{ flex: 1, alignContent: 'start' }}>
        <Campo label="CURP" value={d.curp} mono />
        <Campo label="Centro de servicios" value={d.sede || '—'} />
        <Campo label="Plan" value={d.plan} />
        <div>
          <div className="text-[8px] font-bold uppercase tracking-[0.14em]" style={{ color: '#a89a8e' }}>Estado</div>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full mt-0.5" style={d.vencida ? { background: '#fee2e2', color: '#b91c1c' } : { background: '#d1fae5', color: '#166534' }}>
            {d.vencida ? 'VENCIDA' : 'VIGENTE'}
          </span>
        </div>
        <Campo label="Emisión" value={d.emision ?? '—'} />
        <Campo label="Vigente hasta" value={d.vigencia ?? '—'} />
        <div style={{ gridColumn: '1 / -1' }}>
          <div className="text-[8px] font-bold uppercase tracking-[0.14em] mb-1" style={{ color: '#a89a8e' }}>Convocatorias inscritas</div>
          <div className="text-[12px] font-medium" style={{ color: '#2a2320' }}>
            {d.convocatorias.length ? d.convocatorias.join('  ·  ') : 'Sin inscripciones registradas'}
          </div>
        </div>
      </div>
      <div className="px-4 py-2.5 text-[9px]" style={{ background: '#f7f2ee', color: '#a89a8e' }}>
        Folio {d.folio} · verifica.edumich.michoacan.gob.mx
      </div>
    </div>
  );
}

/**
 * Modo PRESENTAR — la credencial a pantalla completa, para enseñarla a alguien
 * o que le escaneen el QR.
 *
 * El problema que resuelve es de aritmética, no de gusto: la tarjeta se diseña a
 * 460px de ancho, y en un teléfono vertical solo hay ~347px útiles → escala 0.75
 * y el QR (92px de diseño) aterriza en ~69px, casi inescaneable. Girada 90° la
 * tarjeta dispone del ALTO de la pantalla (~780px) → escala ~1.6 y el QR sube a
 * ~150px: más del doble.
 *
 * Por eso no se gira "porque sí en teléfono": se calculan las dos escalas
 * posibles y gana la mayor. Así el iPad y el teléfono en horizontal —donde de
 * frente ya cabe holgada— se muestran sin girar, y solo el teléfono vertical
 * rota. Se adapta solo a cualquier pantalla, incluso al rotar el aparato.
 *
 * Notas de implementación:
 *  - Va en un portal a <body> a la fuerza: la tarjeta vive dentro de un
 *    contenedor con `transform`/`perspective`, y un ancestro transformado es
 *    bloque contenedor de los `position: fixed` que cuelgan de él — sin portal
 *    la capa se anclaría a la tarjeta en vez de a la pantalla.
 *  - Wake Lock mantiene la pantalla encendida mientras se muestra. El brillo NO
 *    se puede subir desde la web (no existe esa API); eso es exclusivo de una
 *    app nativa o de un pase de Wallet.
 */
function Presentacion({
  d, alto, flipped, onFlip, onClose,
}: {
  d: CredData;
  alto: number;
  flipped: boolean;
  onFlip: () => void;
  onClose: () => void;
}) {
  const [vp, setVp] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const medir = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    medir();
    window.addEventListener('resize', medir);
    window.addEventListener('orientationchange', medir);
    return () => {
      window.removeEventListener('resize', medir);
      window.removeEventListener('orientationchange', medir);
    };
  }, []);

  // El fondo no se desplaza detrás de la credencial.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Escape cierra.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // La pantalla no se apaga mientras enseñas la credencial (iOS 16.4+/Android).
  // Si el navegador no lo soporta, simplemente no pasa nada.
  useEffect(() => {
    let lock: { release?: () => Promise<void> } | undefined;
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: string) => Promise<typeof lock> } }).wakeLock;
    wl?.request('screen').then((l) => { lock = l; }).catch(() => {});
    return () => { lock?.release?.().catch(() => {}); };
  }, []);

  if (!vp.w) return null;

  const MARGEN = 28;
  const dispW = Math.max(0, vp.w - MARGEN);
  const dispH = Math.max(0, vp.h - MARGEN);
  const escDerecha = Math.min(dispW / CARD_W, dispH / alto);
  const escGirada = Math.min(dispW / alto, dispH / CARD_W);
  // Girar es un RESCATE, no una optimización: solo cuando de frente la tarjeta
  // saldría encogida (por debajo de su tamaño de diseño) y de lado sí crece.
  // Ojo: maximizar a secas estaría mal. En un iPad vertical girada da MÁS escala
  // que derecha (2.16 vs 1.61), pero ahí la tarjeta ya se lee holgada y nadie
  // quiere ladear la cabeza; el giro solo se gana el estorbo en el teléfono
  // vertical, donde de frente cabe apenas al 0.75.
  const girar = escDerecha < 1 && escGirada > escDerecha;
  const esc = girar ? escGirada : escDerecha;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden"
      style={{ background: 'var(--color-guinda-900)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Credencial a pantalla completa"
    >
      <div
        onClick={(e) => { e.stopPropagation(); onFlip(); }}
        style={{
          width: CARD_W,
          // `flexShrink: 0` es obligatorio: la capa es flex y la tarjeta mide 460.
          // En una pantalla más angosta flex la encogería por debajo de su ancho
          // de DISEÑO, el texto se reacomodaría (el nombre parte en dos líneas) y
          // además la escala partiría de una base falsa. La tarjeta debe medir
          // siempre 460 y ser el `transform` —que no afecta al maquetado— quien
          // la ajuste a la pantalla.
          flexShrink: 0,
          height: alto,
          transform: `${girar ? 'rotate(90deg) ' : ''}scale(${esc})`,
          transformOrigin: 'center center',
          perspective: 1400,
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            position: 'relative', width: '100%', height: '100%', transformStyle: 'preserve-3d',
            transition: 'transform .6s cubic-bezier(.4,0,.2,1)',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
            <Frente d={d} fill />
          </div>
          <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
            <Reverso d={d} fill />
          </div>
        </div>
      </div>

      {/* Controles: fuera de la tarjeta girada, siempre derechos y legibles. */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label="Cerrar"
        className="absolute right-3 flex h-11 w-11 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
      >
        <X size={22} />
      </button>
      <div
        className="pointer-events-none absolute inset-x-0 text-center text-[11px] font-semibold uppercase tracking-[0.15em] text-white/45"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)' }}
      >
        Toca la credencial para girarla
      </div>
    </div>,
    document.body,
  );
}

export function CredencialPreview({ basePath, flippable = false }: { basePath: string; flippable?: boolean }) {
  const [d, setD] = useState<CredData | null>(null);
  const [err, setErr] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [presentando, setPresentando] = useState(false);
  // Escala responsiva: la credencial volteable llena el ancho disponible
  // (hasta 1.6x) para verse GRANDE con el QR fácil de escanear.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  // Altura NATURAL de cada cara (medida en un render oculto a ancho de diseño):
  // el contenedor del flip usa la mayor, así NINGUNA cara se corta.
  const frenteRef = useRef<HTMLDivElement>(null);
  const reversoRef = useRef<HTMLDivElement>(null);
  const [faceH, setFaceH] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    api.get<CredData>(`${basePath}/credencial`)
      .then((r) => { if (alive) setD(r); })
      .catch(() => { if (alive) setErr(true); });
    return () => { alive = false; };
  }, [basePath]);

  useEffect(() => {
    if (!flippable) return;
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      // Se achica para caber en móvil (la tarjeta es ancha) y crece hasta 1.5x en pantallas grandes.
      setScale(Math.max(0.5, Math.min(1.5, el.clientWidth / CARD_W)));
      const fh = frenteRef.current?.offsetHeight ?? 0;
      const rh = reversoRef.current?.offsetHeight ?? 0;
      if (fh || rh) setFaceH(Math.max(fh, rh));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (frenteRef.current) ro.observe(frenteRef.current);
    if (reversoRef.current) ro.observe(reversoRef.current);
    return () => ro.disconnect();
  }, [flippable, d]);

  if (err) return <div className="text-sm text-center py-6" style={{ color: '#a89a8e' }}>No se pudo cargar la credencial.</div>;
  if (!d) return <div className="h-64 rounded-2xl animate-pulse" style={{ background: '#f3ede8' }} />;
  if (!d.emitida) return null;

  // ── Modo volteable (alumno): una sola tarjeta GRANDE que gira ──
  if (flippable) {
    const H = faceH ?? FLIP_H;
    return (
      <div data-tour="id-credencial" className="flex flex-col items-center gap-4">
        <div ref={wrapRef} style={{ width: '100%' }}>
          {/* Medidor oculto: caras a ancho de diseño para conocer su altura real */}
          <div style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none', width: CARD_W, left: -9999, top: 0 }} aria-hidden>
            <div ref={frenteRef}><Frente d={d} /></div>
            <div ref={reversoRef}><Reverso d={d} /></div>
          </div>
          {/* Contenedor que reserva el tamaño ESCALADO */}
          <div style={{ width: CARD_W * scale, height: H * scale, marginInline: 'auto' }}>
            {/* Escalador (agranda toda la tarjeta y el QR) + perspectiva para el flip */}
            <div
              onClick={() => setFlipped((f) => !f)}
              style={{ width: CARD_W, height: H, transform: `scale(${scale})`, transformOrigin: 'top left', perspective: 1400, cursor: 'pointer' }}
              title="Toca para girar"
            >
              <div style={{ position: 'relative', width: '100%', height: '100%', transformStyle: 'preserve-3d', transition: 'transform .6s cubic-bezier(.4,0,.2,1)', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
                <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
                  <Frente d={d} fill />
                </div>
                <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                  <Reverso d={d} fill />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            data-tour="id-voltear"
            onClick={() => setFlipped((f) => !f)}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-stone-300 px-4 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-50"
          >
            <RotateCcw size={14} /> {flipped ? 'Ver frente' : 'Ver reverso / QR'}
          </button>
          {/* En teléfono la tarjeta cabe al 0.75 y el QR queda en ~69px: aquí se
              ve al doble. Es la vía para que se la escaneen. */}
          <button
            data-tour="id-presentar"
            onClick={() => setPresentando(true)}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-4 text-sm font-semibold text-white transition-colors"
            style={{ background: 'var(--color-guinda-700)' }}
          >
            <Maximize2 size={14} /> Ver en grande
          </button>
        </div>

        {presentando && (
          <Presentacion
            d={d}
            alto={H}
            flipped={flipped}
            onFlip={() => setFlipped((f) => !f)}
            onClose={() => setPresentando(false)}
          />
        )}
      </div>
    );
  }

  // ── Modo lado a lado (admin / gestor): ambas del MISMO tamaño (items-stretch
  //    + fill hace que las dos tomen la altura de la más alta). ──
  return (
    <div className="flex flex-wrap gap-5 justify-center items-stretch">
      <div style={{ width: CARD_W, maxWidth: '100%', flexShrink: 0, display: 'flex' }}><Frente d={d} fill /></div>
      <div style={{ width: CARD_W, maxWidth: '100%', flexShrink: 0, display: 'flex' }}><Reverso d={d} fill /></div>
    </div>
  );
}

export default CredencialPreview;
