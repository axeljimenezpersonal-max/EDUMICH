/**
 * Credencial digital — tarjeta RECTANGULAR (frente + reverso), diseño oficial.
 * - Admin / gestor: frente y reverso lado a lado (todo visible).
 * - Alumno (`flippable`): UNA sola tarjeta que se voltea (frente ↔ reverso/QR).
 * Recibe `basePath` (p. ej. /admin/alumnos/25 o /estudiante) y consulta
 * `${basePath}/credencial`. SIEMPRE refleja la credencial realmente emitida.
 */
import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ShieldCheck, ImageOff, RotateCcw } from 'lucide-react';
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
const CARD_W = 360;
const FLIP_H = 272; // alto fijo para que frente y reverso coincidan al voltear

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
    <div style={{ height: fill ? '100%' : undefined, display: 'flex', flexDirection: 'column', borderRadius: 16, overflow: 'hidden', border: '1px solid #e7dcd3', background: '#fbf7f5', boxShadow: '0 8px 26px rgba(74,14,32,0.10)' }}>
      <div style={{ background: GUINDA_HEADER, padding: '13px 18px', borderBottom: '3px solid #b8975a' }}>
        <div className="text-white font-bold text-[13px] tracking-wide">CREDENCIAL DEL ESTUDIANTE</div>
        <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.82)' }}>Preparatoria Abierta Michoacán · IEMSyS</div>
      </div>
      <div className="p-4 flex gap-4" style={{ flex: 1 }}>
        <div style={{ width: 88, height: 108, borderRadius: 8, overflow: 'hidden', border: '2px solid #b8975a', background: '#efe7de', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {d.fotoUrl
            ? <img src={d.fotoUrl} alt="Foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div className="flex flex-col items-center gap-1 text-[9px]" style={{ color: '#b3a596' }}><ImageOff size={18} /> Sin foto</div>}
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-2.5">
          <Campo label="Nombre" value={d.nombre} />
          <Campo label="Matrícula oficial DGB" value={d.matricula ?? 'Sin asignar'} mono />
          <Campo label="Folio de credencial" value={d.folio} mono />
        </div>
      </div>
      <div className="px-4 pb-4 flex items-end justify-between">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold" style={{ color: 'var(--color-guinda-700)' }}>
          <ShieldCheck size={13} /> Documento verificable
        </div>
        <div style={{ background: '#fff', padding: 5, borderRadius: 6, border: '1px solid #eadfd7' }}>
          <QRCodeSVG value={d.verifyUrl} size={68} fgColor="#2a1720" bgColor="#ffffff" level="M" />
        </div>
      </div>
    </div>
  );
}

/** Reverso (datos + estado + convocatorias). */
function Reverso({ d, fill }: { d: CredData; fill?: boolean }) {
  return (
    <div style={{ height: fill ? '100%' : undefined, display: 'flex', flexDirection: 'column', borderRadius: 16, overflow: 'hidden', border: '1px solid #e7dcd3', background: '#ffffff', boxShadow: '0 8px 26px rgba(74,14,32,0.10)' }}>
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

export function CredencialPreview({ basePath, flippable = false }: { basePath: string; flippable?: boolean }) {
  const [d, setD] = useState<CredData | null>(null);
  const [err, setErr] = useState(false);
  const [flipped, setFlipped] = useState(false);
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
      setScale(Math.max(1, Math.min(1.6, el.clientWidth / CARD_W)));
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
      <div className="flex flex-col items-center gap-4">
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
        <button
          onClick={() => setFlipped((f) => !f)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors"
        >
          <RotateCcw size={14} /> {flipped ? 'Ver frente' : 'Ver reverso / QR'}
        </button>
      </div>
    );
  }

  // ── Modo lado a lado (admin / gestor): todo visible ──
  return (
    <div className="flex flex-wrap gap-5 justify-center">
      <div style={{ width: CARD_W }}><Frente d={d} /></div>
      <div style={{ width: CARD_W }}><Reverso d={d} /></div>
    </div>
  );
}

export default CredencialPreview;
