/**
 * Credencial digital para admin y gestor: tarjeta GRANDE volteable (frente +
 * reverso, con animación como la del alumno) JUNTO a un panel "Datos de la
 * credencial" con toda la información visible de un vistazo (sin voltear).
 * Recibe `basePath` (p. ej. /admin/alumnos/25) y consulta `${basePath}/credencial`.
 * SIEMPRE refleja la credencial realmente emitida (folio, datos y foto aprobada).
 */
import { useState, useEffect, type CSSProperties } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Shield, RotateCcw, ImageOff } from 'lucide-react';
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

const G = {
  g200: '#e8c4d4', g300: '#d99bb4', g400: '#c9749a', g600: '#8a2149',
  g700: '#7b1e3a', g800: '#5c1a2e', g900: '#3c0c1c',
  crema50: '#faf6f2', crema100: '#f3ece4', crema200: '#e7dcd3',
  piedra500: '#78716c', aprobado: '#2d7d46',
};

const CARD_W = 348;
const CARD_H = 476;
const cardShadow = '0 24px 46px -20px rgba(60,12,28,.42), 0 3px 10px rgba(60,12,28,.10)';

function Campo({ label, value, mono, full }: { label: string; value: string; mono?: boolean; full?: boolean }) {
  return (
    <div style={full ? { gridColumn: '1 / -1' } : undefined}>
      <div style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: G.piedra500 }}>{label}</div>
      <div style={{ fontSize: mono ? 12.5 : 13, fontWeight: 700, color: G.g800, marginTop: 1, letterSpacing: mono ? '0.03em' : 0, fontVariantNumeric: mono ? 'tabular-nums' : undefined }}>
        {value || '—'}
      </div>
    </div>
  );
}

function CredFront({ d, onFlip }: { d: CredData; onFlip: () => void }) {
  return (
    <div style={{ height: '100%', background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: cardShadow, border: '1px solid rgba(123,30,58,.10)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', background: `linear-gradient(135deg, ${G.g800}, ${G.g600})`, color: '#fff', padding: '14px 18px 16px' }}>
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', opacity: 0.07, display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
          <div style={{ fontSize: 5.5, letterSpacing: '0.15em', color: '#fff', whiteSpace: 'nowrap', fontWeight: 700 }}>
            {'PREPARATORIA ABIERTA · MICHOACÁN · SEE · '.repeat(14)}
          </div>
        </div>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontSize: 7, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, color: 'rgba(255,255,255,.85)', lineHeight: 1.45 }}>
            Gobierno del Estado de Michoacán<br />Secretaría de Educación
          </div>
          <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 999, background: 'conic-gradient(from 0deg, #f7c6dd, #d9a7f0, #a7c7f0, #a7f0d8, #f0e3a7, #f3c8a7, #f7c6dd)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.5), 0 2px 6px rgba(0,0,0,.2)' }}>
            <div style={{ width: 24, height: 24, borderRadius: 999, background: 'rgba(78,12,34,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 6.5, fontWeight: 800, letterSpacing: '0.06em', color: '#fff', textAlign: 'center', lineHeight: 1 }}>SEE<br />26</div>
          </div>
        </div>
        <div style={{ position: 'relative', marginTop: 11, fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em', lineHeight: 1 }}>Preparatoria Abierta</div>
        <div style={{ position: 'relative', marginTop: 4, fontSize: 8.5, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700, color: G.g200 }}>Credencial del Estudiante</div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, background: `linear-gradient(90deg, ${G.g400}, ${G.g600})` }} />
      </div>

      <div style={{ position: 'relative', flex: 1, padding: '15px 18px 6px' }}>
        <div style={{ position: 'absolute', right: -28, bottom: 22, width: 130, height: 130, borderRadius: 999, background: G.g700, opacity: 0.04, pointerEvents: 'none' }} />
        <div style={{ position: 'relative', display: 'flex', gap: 15, alignItems: 'flex-start' }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: 82, height: 100, borderRadius: 12, overflow: 'hidden', background: `linear-gradient(160deg, ${G.crema100}, ${G.crema200})`, display: 'flex', alignItems: d.fotoUrl ? 'stretch' : 'center', justifyContent: 'center', border: d.fotoUrl ? `2px solid ${G.g200}` : 'none' }}>
              {d.fotoUrl ? (
                <img src={d.fotoUrl} alt="Foto oficial" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, fontSize: 8, fontWeight: 600, color: '#b3a596' }}>
                  <ImageOff size={20} /> Sin foto
                </div>
              )}
            </div>
            <div style={{ position: 'absolute', right: -6, bottom: -6, width: 21, height: 21, borderRadius: 999, background: G.g700, border: '2.5px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 2px 6px rgba(60,12,28,.35)' }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
          </div>
          <div style={{ minWidth: 0, paddingTop: 2 }}>
            <div style={{ fontWeight: 800, fontSize: 15, lineHeight: 1.18, letterSpacing: '-0.01em', color: G.g800 }}>{d.nombre}</div>
            <div style={{ fontSize: 9.5, color: G.piedra500, marginTop: 3, fontWeight: 500 }}>Estudiante inscrito/a</div>
            <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 4, background: d.vencida ? 'rgba(185,28,28,.10)' : 'rgba(45,125,70,.10)', color: d.vencida ? '#b91c1c' : G.aprobado, border: `1px solid ${d.vencida ? 'rgba(185,28,28,.25)' : 'rgba(45,125,70,.25)'}`, padding: '3px 8px', borderRadius: 999, fontSize: 9, fontWeight: 700 }}>
              {d.vencida ? 'Vencida' : 'Vigente'}
            </div>
          </div>
        </div>

        <div style={{ position: 'relative', marginTop: 13, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '11px 14px' }}>
          <Campo label="Matrícula oficial DGB" value={d.matricula ?? 'Sin asignar'} mono full />
          <Campo label="Folio de credencial" value={d.folio} mono full />
          <Campo label="Plan de estudios" value={d.plan} full />
          <Campo label="Emisión" value={d.emision ?? '—'} mono />
          <Campo label="Vigencia" value={d.vigencia ?? '—'} mono />
          <Campo label="Centro de servicios" value={d.sede} full />
        </div>
      </div>

      <div style={{ padding: '2px 18px 4px', overflow: 'hidden', height: 12 }}>
        <div style={{ fontSize: 5, letterSpacing: '0.15em', color: G.g600, opacity: 0.4, whiteSpace: 'nowrap', fontWeight: 700 }}>
          {'PREPARATORIA ABIERTA · MICHOACÁN · SEE · EDUMICH · IEMSyS · '.repeat(8)}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 18px', borderTop: `1px solid ${G.crema200}`, background: G.crema50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 7.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: G.g700, fontWeight: 700 }}>
          <Shield size={11} /> Identificación Digital
        </div>
        <button onClick={(e) => { e.stopPropagation(); onFlip(); }} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, color: G.piedra500, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <RotateCcw size={10} /> Toca para girar
        </button>
      </div>
    </div>
  );
}

function CredBack({ d }: { d: CredData }) {
  return (
    <div style={{ height: '100%', background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: cardShadow, border: '1px solid rgba(123,30,58,.10)', padding: '18px 18px 14px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ width: 7, height: 7, borderRadius: 999, background: G.g600, flexShrink: 0 }} />
        <div style={{ fontWeight: 800, fontSize: 14, color: G.g800 }}>Verificación de autenticidad</div>
      </div>
      <div style={{ fontSize: 9.5, color: G.piedra500, marginTop: 4, lineHeight: 1.45 }}>
        Escanea el código para validar identidad, plantel y vigencia en el portal oficial.
      </div>

      <div style={{ position: 'relative', margin: '12px auto 6px', width: 176, height: 176, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {([
          { top: 0, left: 0, borderTop: `2px solid ${G.g600}`, borderLeft: `2px solid ${G.g600}`, borderTopLeftRadius: 4 },
          { top: 0, right: 0, borderTop: `2px solid ${G.g600}`, borderRight: `2px solid ${G.g600}`, borderTopRightRadius: 4 },
          { bottom: 0, left: 0, borderBottom: `2px solid ${G.g600}`, borderLeft: `2px solid ${G.g600}`, borderBottomLeftRadius: 4 },
          { bottom: 0, right: 0, borderBottom: `2px solid ${G.g600}`, borderRight: `2px solid ${G.g600}`, borderBottomRightRadius: 4 },
        ] as CSSProperties[]).map((s, i) => (
          <span key={i} style={{ position: 'absolute', width: 12, height: 12, ...s }} />
        ))}
        <QRCodeSVG value={d.verifyUrl} size={152} level="M" bgColor="#ffffff" fgColor={G.g900} />
      </div>
      <div style={{ textAlign: 'center', fontSize: 8.5, letterSpacing: '0.06em', color: G.piedra500, fontWeight: 600 }}>
        verifica.edumich.michoacan.gob.mx
      </div>

      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
        <Campo label="CURP" value={d.curp} mono full />
        <Campo label="Convocatorias inscritas" value={d.convocatorias.length ? d.convocatorias.join('  ·  ') : 'Sin inscripciones'} full />
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 10, fontSize: 8, letterSpacing: '0.04em', color: G.piedra500 }}>
        Folio {d.folio} · verifica.edumich.michoacan.gob.mx
      </div>
    </div>
  );
}

/** Panel lateral con TODA la info visible de un vistazo (sin voltear). */
function DatosPanel({ d }: { d: CredData }) {
  return (
    <div style={{ width: 320, boxShadow: cardShadow }} className="bg-white rounded-2xl overflow-hidden border" >
      <div className="px-4 py-3 text-white font-bold text-[13px] tracking-wide flex items-center justify-between" style={{ background: G.g800 }}>
        <span>Datos de la credencial</span>
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={d.vencida ? { background: '#fee2e2', color: '#b91c1c' } : { background: '#d1fae5', color: '#166534' }}>
          {d.vencida ? 'VENCIDA' : 'VIGENTE'}
        </span>
      </div>
      <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-3.5">
        <Campo label="Nombre" value={d.nombre} full />
        <Campo label="CURP" value={d.curp} mono />
        <Campo label="Matrícula oficial DGB" value={d.matricula ?? 'Sin asignar'} mono />
        <Campo label="Folio de credencial" value={d.folio} mono />
        <Campo label="Plan de estudios" value={d.plan} />
        <Campo label="Centro de servicios" value={d.sede} />
        <Campo label="Emisión" value={d.emision ?? '—'} mono />
        <Campo label="Vigente hasta" value={d.vigencia ?? '—'} mono />
        <Campo label="Convocatorias inscritas" value={d.convocatorias.length ? d.convocatorias.join('  ·  ') : 'Sin inscripciones registradas'} full />
      </div>
      <div className="px-4 py-2.5 text-[9px]" style={{ background: G.crema50, color: G.piedra500 }}>
        Folio {d.folio} · verifica.edumich.michoacan.gob.mx
      </div>
    </div>
  );
}

export function CredencialPreview({ basePath }: { basePath: string }) {
  const [d, setD] = useState<CredData | null>(null);
  const [err, setErr] = useState(false);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    let alive = true;
    api.get<CredData>(`${basePath}/credencial`)
      .then((r) => { if (alive) setD(r); })
      .catch(() => { if (alive) setErr(true); });
    return () => { alive = false; };
  }, [basePath]);

  if (err) return <div className="text-sm text-center py-6" style={{ color: '#a89a8e' }}>No se pudo cargar la credencial.</div>;
  if (!d) return <div className="mx-auto animate-pulse rounded-2xl" style={{ width: CARD_W, height: CARD_H, background: '#f3ede8' }} />;
  if (!d.emitida) return null;

  return (
    <div className="flex flex-wrap gap-6 justify-center items-start">
      {/* ── Tarjeta volteable ── */}
      <div className="flex flex-col items-center gap-3">
        <div
          onClick={() => setFlipped((f) => !f)}
          style={{ width: CARD_W, height: CARD_H, perspective: 1600, cursor: 'pointer' }}
          title="Toca para girar"
        >
          <div style={{ position: 'relative', width: '100%', height: '100%', transformStyle: 'preserve-3d', transition: 'transform .6s cubic-bezier(.4,0,.2,1)', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
            <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
              <CredFront d={d} onFlip={() => setFlipped(true)} />
            </div>
            <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
              <CredBack d={d} />
            </div>
          </div>
        </div>
        <button
          onClick={() => setFlipped((f) => !f)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-50 transition-colors"
        >
          <RotateCcw size={13} /> {flipped ? 'Ver frente' : 'Ver reverso / QR'}
        </button>
      </div>

      {/* ── Panel de datos (todo visible) ── */}
      <DatosPanel d={d} />
    </div>
  );
}

export default CredencialPreview;
