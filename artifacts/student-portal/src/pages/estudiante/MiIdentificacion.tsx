import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'wouter';
import { BadgeCheck, Download, Loader2, Lock, RotateCcw, Shield, RefreshCw } from 'lucide-react';
import { QRCodeSVG as QRCodeReact } from 'qrcode.react';
import { EstudianteLayout } from './EstudianteLayout';
import { api } from '../../lib/api';

// ── Paleta institucional (espejo del template) ──────────────────────────
const G = {
  g200: '#f5c2cd',
  g300: '#ec96a9',
  g400: '#dd5d7a',
  g600: '#a02440',
  g700: '#6B1530',
  g800: '#5c1428',
  g900: '#3d0d1a',
  crema50: '#fbf8f2',
  crema100: '#f8f4ec',
  crema200: '#efe7d6',
  piedra500: '#6b635e',
  piedra900: '#2a2a2a',
  aprobado: '#2d7d46',
};

interface IdentificacionData {
  nombreCompleto: string;
  nombre: string;
  apellidos: string;
  curp: string;
  curpMask: string;
  sede: string;               // municipio → centro de servicios
  matriculaOficialDGB: string | null;
  folio: string;              // licenciaDigital
  licenciaEmitidaEn: string | null;
  emision: string | null;
  vigencia: string | null;
  vencida?: boolean;
  diasParaVencer?: number | null;
  plan: string;
  modulosAprobados: number;
  modulosTotales: number;
  verifyUrl: string;
}

interface Resp {
  tieneIdentificacion: boolean;
  tieneFoto?: boolean;
  identificacion?: IdentificacionData;
}

// ── Campo de datos ──────────────────────────────────────────────────────
function Campo({
  label,
  value,
  mono = false,
  full = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  full?: boolean;
}) {
  return (
    <div style={{ gridColumn: full ? '1 / -1' : 'auto', minWidth: 0 }}>
      <div style={{
        fontSize: 8, fontWeight: 700, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: G.piedra500, marginBottom: 3,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 12, fontWeight: 700, color: G.piedra900,
        fontVariantNumeric: mono ? 'tabular-nums' : 'normal',
        letterSpacing: mono ? '0.03em' : '0',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        fontFamily: mono ? "'JetBrains Mono', 'Courier New', monospace" : 'inherit',
      }}>
        {value || '—'}
      </div>
    </div>
  );
}

// ── Cara frontal ────────────────────────────────────────────────────────
function CredFront({ id, tieneFoto, onFlip }: { id: IdentificacionData; tieneFoto: boolean; onFlip: () => void }) {
  const cardShadow = '0 24px 46px -20px rgba(60,12,28,.42), 0 3px 10px rgba(60,12,28,.10)';
  const bandBg = `linear-gradient(150deg, ${G.g700} 0%, ${G.g800} 72%, ${G.g900} 100%)`;

  return (
    <div style={{
      height: '100%', background: '#fff', borderRadius: 20, overflow: 'hidden',
      boxShadow: cardShadow, border: '1px solid rgba(123,30,58,.10)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Banda superior guinda */}
      <div style={{ background: bandBg, color: '#fff', padding: '14px 18px 15px', position: 'relative' }}>
        {/* Microtexto de fondo */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', opacity: 0.07, display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
          <div style={{ fontSize: 5.5, letterSpacing: '0.15em', color: '#fff', whiteSpace: 'nowrap', fontWeight: 700 }}>
            {'PREPARATORIA ABIERTA · MICHOACÁN · SEE · '.repeat(14)}
          </div>
        </div>

        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontSize: 7, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, color: 'rgba(255,255,255,.85)', lineHeight: 1.45 }}>
            Gobierno del Estado de Michoacán<br />Secretaría de Educación
          </div>
          {/* Sello holográfico */}
          <div style={{
            flexShrink: 0, width: 36, height: 36, borderRadius: 999,
            background: 'conic-gradient(from 0deg, #f7c6dd, #d9a7f0, #a7c7f0, #a7f0d8, #f0e3a7, #f3c8a7, #f7c6dd)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.5), 0 2px 6px rgba(0,0,0,.2)',
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: 999, background: 'rgba(78,12,34,.55)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 6.5, fontWeight: 800, letterSpacing: '0.06em',
              color: '#fff', textAlign: 'center', lineHeight: 1,
            }}>SEE<br />26</div>
          </div>
        </div>

        <div style={{ position: 'relative', marginTop: 11, fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em', lineHeight: 1 }}>
          Preparatoria Abierta
        </div>
        <div style={{ position: 'relative', marginTop: 4, fontSize: 8.5, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700, color: G.g200 }}>
          Credencial del Estudiante
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, background: `linear-gradient(90deg, ${G.g400}, ${G.g600})` }} />
      </div>

      {/* Cuerpo */}
      <div style={{ position: 'relative', flex: 1, padding: '15px 18px 6px' }}>
        {/* Marca de agua */}
        <div style={{ position: 'absolute', right: -28, bottom: 22, width: 130, height: 130, borderRadius: 999, background: G.g700, opacity: 0.04, pointerEvents: 'none' }} />

        <div style={{ position: 'relative', display: 'flex', gap: 15, alignItems: 'flex-start' }}>
          {/* Avatar / Foto oficial */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              width: 76, height: 93, borderRadius: 12, overflow: 'hidden',
              background: `linear-gradient(160deg, ${G.crema100}, ${G.crema200})`,
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
              border: tieneFoto ? `2px solid ${G.g200}` : 'none',
            }}>
              {tieneFoto ? (
                <img
                  src="/api/estudiante/mi-foto"
                  alt="Foto oficial"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <svg viewBox="0 0 100 120" width="100%" height="100%" preserveAspectRatio="xMidYMax meet">
                  <circle cx="50" cy="42" r="22" fill={G.g300} />
                  <path d="M50 70 C26 70 12 88 10 120 L90 120 C88 88 74 70 50 70 Z" fill={G.g300} />
                </svg>
              )}
            </div>
            <div style={{
              position: 'absolute', right: -6, bottom: -6, width: 21, height: 21,
              borderRadius: 999, background: G.g700, border: '2.5px solid #fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', boxShadow: '0 2px 6px rgba(60,12,28,.35)',
            }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>

          {/* Nombre + estado */}
          <div style={{ minWidth: 0, paddingTop: 2 }}>
            <div style={{ fontWeight: 800, fontSize: 15, lineHeight: 1.18, letterSpacing: '-0.01em', color: G.g800 }}>
              {id.nombre}<br />{id.apellidos}
            </div>
            <div style={{ fontSize: 9.5, color: G.piedra500, marginTop: 3, fontWeight: 500 }}>
              Estudiante inscrito/a
            </div>
            <div style={{
              marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 4,
              background: 'rgba(45,125,70,.10)', color: G.aprobado,
              border: '1px solid rgba(45,125,70,.25)',
              padding: '3px 8px', borderRadius: 999, fontSize: 9, fontWeight: 700,
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Vigente
            </div>
          </div>
        </div>

        {/* Grid de datos */}
        <div style={{ position: 'relative', marginTop: 13, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '11px 14px' }}>
          <Campo label="Matrícula" value={id.matriculaOficialDGB ?? '—'} mono full />
          <Campo label="Plan de estudios" value={id.plan} full />
          <Campo label="Emisión" value={id.emision ?? '—'} mono />
          <Campo label="Vigencia" value={id.vigencia ?? '—'} mono />
          <Campo label="Centro de servicios" value={id.sede} full />
        </div>
      </div>

      {/* Microtexto de seguridad */}
      <div style={{ padding: '2px 18px 4px', overflow: 'hidden', height: 12 }}>
        <div style={{ fontSize: 5, letterSpacing: '0.15em', color: G.g600, opacity: 0.4, whiteSpace: 'nowrap', fontWeight: 700 }}>
          {'PREPARATORIA ABIERTA · MICHOACÁN · SEE · EDUMICH · IEMSyS · '.repeat(8)}
        </div>
      </div>

      {/* Pie */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 18px', borderTop: `1px solid ${G.crema200}`, background: G.crema50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 7.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: G.g700, fontWeight: 700 }}>
          <Shield size={11} /> Identificación Digital
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onFlip(); }}
          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, color: G.piedra500, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <RotateCcw size={10} /> Toca para girar
        </button>
      </div>
    </div>
  );
}

// ── Cara trasera (QR + verificación) ───────────────────────────────────
function CredBack({ id }: { id: IdentificacionData }) {
  const cardShadow = '0 24px 46px -20px rgba(60,12,28,.42), 0 3px 10px rgba(60,12,28,.10)';

  return (
    <div style={{
      height: '100%', background: '#fff', borderRadius: 20, overflow: 'hidden',
      boxShadow: cardShadow, border: '1px solid rgba(123,30,58,.10)',
      padding: '18px 18px 14px', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ width: 7, height: 7, borderRadius: 999, background: G.g600, flexShrink: 0 }} />
        <div style={{ fontWeight: 800, fontSize: 14, color: G.g800 }}>
          Verificación de autenticidad
        </div>
      </div>
      <div style={{ fontSize: 9.5, color: G.piedra500, marginTop: 4, lineHeight: 1.45 }}>
        Escanea el código para validar identidad, plantel y vigencia en el portal oficial.
      </div>

      {/* QR con marcas de registro */}
      <div style={{ position: 'relative', margin: '12px auto 6px', width: 196, height: 196, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {([
          { top: 0, left: 0, borderTop: `2px solid ${G.g600}`, borderLeft: `2px solid ${G.g600}`, borderTopLeftRadius: 4 },
          { top: 0, right: 0, borderTop: `2px solid ${G.g600}`, borderRight: `2px solid ${G.g600}`, borderTopRightRadius: 4 },
          { bottom: 0, left: 0, borderBottom: `2px solid ${G.g600}`, borderLeft: `2px solid ${G.g600}`, borderBottomLeftRadius: 4 },
          { bottom: 0, right: 0, borderBottom: `2px solid ${G.g600}`, borderRight: `2px solid ${G.g600}`, borderBottomRightRadius: 4 },
        ] as CSSProperties[]).map((s, i) => (
          <span key={i} style={{ position: 'absolute', width: 12, height: 12, ...s }} />
        ))}
        <QRCodeReact
          value={id.verifyUrl}
          size={172}
          level="M"
          bgColor="#ffffff"
          fgColor={G.g900}
        />
      </div>
      <div style={{ textAlign: 'center', fontSize: 8.5, letterSpacing: '0.06em', color: G.piedra500, fontWeight: 600 }}>
        verifica.edumich.michoacan.gob.mx
      </div>

      {/* Matrícula */}
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: G.piedra500 }}>Matrícula</div>
        <div style={{ fontSize: 13, fontWeight: 800, color: G.g800, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.03em', marginTop: 1 }}>
          {id.matriculaOficialDGB ?? '—'}
        </div>
      </div>

      {/* CURP + Folio */}
      <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
        <div>
          <div style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: G.piedra500 }}>CURP</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: G.piedra900, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
            {id.curpMask}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: G.piedra500 }}>Folio de control</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: G.piedra900, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
            {id.folio}
          </div>
        </div>
      </div>

      {/* Nota legal */}
      <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: `1px solid ${G.crema200}`, display: 'flex', gap: 7, alignItems: 'flex-start' }}>
        <Shield size={11} style={{ color: G.g600, flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 7.5, lineHeight: 1.55, color: G.piedra500 }}>
          Documento digital emitido por la Secretaría de Educación de Michoacán. Validez sujeta
          a verificación electrónica. CURP mostrada parcialmente por seguridad.
        </div>
      </div>
    </div>
  );
}

// ── Página principal ────────────────────────────────────────────────────
export default function MiIdentificacion() {
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [descargando, setDescargando] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [mostrarRenovar, setMostrarRenovar] = useState(false);
  const [solicitando, setSolicitando] = useState(false);
  const [solicitOk, setSolicitOk] = useState(false);

  async function handleSolicitarRenovacion(motivo: 'vencimiento' | 'reposicion') {
    setSolicitando(true);
    try {
      const res = await fetch('/api/estudiante/solicitar-renovacion-credencial', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo }),
      });
      if (!res.ok) throw new Error();
      setSolicitOk(true); setMostrarRenovar(false);
    } catch {
      alert('No se pudo enviar la solicitud. Intenta de nuevo.');
    } finally { setSolicitando(false); }
  }

  useEffect(() => {
    api
      .get<Resp>('/estudiante/mi-identificacion')
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  async function handleDescargar() {
    setDescargando(true);
    try {
      const res = await fetch('/api/estudiante/mi-identificacion/descargar', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Error al generar la credencial');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'credencial-digital-preparatoria-abierta.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('No se pudo descargar la credencial. Intenta de nuevo.');
    } finally {
      setDescargando(false);
    }
  }

  if (loading) {
    return (
      <EstudianteLayout>
        <div className="flex items-center justify-center h-64 text-stone-400">
          <Loader2 size={20} className="animate-spin mr-2" /> Cargando…
        </div>
      </EstudianteLayout>
    );
  }

  // ── Sin credencial emitida ───────────────────────────────────────────
  if (!data?.tieneIdentificacion) {
    return (
      <EstudianteLayout>
        <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-guinda-700)] mb-1 flex items-center gap-1.5">
          <BadgeCheck size={12} /> Mi identificación
        </div>
        <h1 className="font-serif text-3xl font-bold text-stone-900 mb-6">
          Credencial digital
        </h1>

        <div className="bg-white border border-stone-200 rounded-xl p-10 max-w-lg text-center mx-auto">
          <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-4">
            <Lock size={28} className="text-stone-400" />
          </div>
          <h2 className="font-serif text-xl font-bold text-stone-800 mb-2">
            Aún no tienes credencial digital
          </h2>
          <p className="text-stone-500 text-sm leading-relaxed mb-6">
            Tu credencial será emitida por la administración una vez que tu matrícula oficial DGB
            haya sido asignada y tu expediente esté completo.
          </p>
          <div className="space-y-2 text-sm">
            {[
              'Completa tu expediente con los 5 documentos',
              'La administración valida y asigna tu matrícula',
              'Se emite tu credencial digital',
            ].map((paso, i) => (
              <div key={i} className="flex items-center gap-2 text-stone-600 justify-center">
                <span className="w-5 h-5 rounded-full bg-stone-100 flex items-center justify-center text-xs font-bold text-stone-400">
                  {i + 1}
                </span>
                {paso}
              </div>
            ))}
          </div>
          <div className="mt-6">
            <Link
              href="/estudiante/expediente"
              className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg"
              style={{ background: 'var(--color-guinda-700)', color: 'white' }}
            >
              Ver mi expediente →
            </Link>
          </div>
        </div>
      </EstudianteLayout>
    );
  }

  const id = data.identificacion!;

  return (
    <EstudianteLayout>
      <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-guinda-700)] mb-1 flex items-center gap-1.5">
        <BadgeCheck size={12} /> Mi identificación
      </div>
      <h1 className="font-serif text-3xl font-bold text-stone-900 mb-1">
        Credencial digital
      </h1>
      <p className="text-stone-500 text-sm mb-6">
        Emitida el {id.emision ?? '—'} · Vigente hasta {id.vigencia ?? '—'}
        {id.modulosAprobados > 0 && (
          <>
            {' · '}
            <strong className="text-stone-700">
              {id.modulosAprobados} de {id.modulosTotales}
            </strong>{' '}
            módulos aprobados
          </>
        )}
      </p>

      {/* Aviso de vigencia */}
      {id.vencida ? (
        <div className="mb-5 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800 flex items-start gap-2" style={{ maxWidth: 340 }}>
          <BadgeCheck size={14} className="shrink-0 mt-0.5 text-red-600" />
          <span>Tu credencial <strong>venció</strong>. Solicita su renovación para mantenerla vigente.</span>
        </div>
      ) : typeof id.diasParaVencer === 'number' && id.diasParaVencer <= 30 ? (
        <div className="mb-5 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 flex items-start gap-2" style={{ maxWidth: 340 }}>
          <BadgeCheck size={14} className="shrink-0 mt-0.5 text-amber-600" />
          <span>Tu credencial vence en <strong>{id.diasParaVencer} día{id.diasParaVencer !== 1 ? 's' : ''}</strong>. Puedes solicitar su renovación.</span>
        </div>
      ) : null}

      <div style={{ maxWidth: 340 }}>
        {/* ── Tarjeta con flip ────────────────────────────────────── */}
        <div
          style={{ perspective: '1400px', cursor: 'pointer', height: 468 }}
          onClick={() => setFlipped((f) => !f)}
          title={flipped ? 'Clic para ver frente' : 'Clic para ver reverso / QR'}
        >
          <div
            style={{
              position: 'relative',
              transformStyle: 'preserve-3d',
              transition: 'transform 0.65s cubic-bezier(.4,0,.2,1)',
              transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              height: '100%',
            }}
          >
            {/* Cara delantera */}
            <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden' }}>
              <CredFront id={id} tieneFoto={data?.tieneFoto ?? false} onFlip={() => setFlipped((f) => !f)} />
            </div>
            {/* Cara trasera */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
              }}
            >
              <CredBack id={id} />
            </div>
          </div>
        </div>

        {/* ── Acciones ────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mt-5 flex-wrap">
          <button
            onClick={handleDescargar}
            disabled={descargando}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
            style={{ background: 'var(--color-guinda-700)', color: 'white' }}
          >
            {descargando ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Download size={15} />
            )}
            {descargando ? 'Generando PDF…' : 'Descargar PDF'}
          </button>

          <button
            onClick={() => setFlipped((f) => !f)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border border-stone-200 text-stone-700 hover:bg-stone-50 transition-colors"
          >
            <RotateCcw size={15} />
            {flipped ? 'Ver frente' : 'Ver reverso / QR'}
          </button>

          <button
            onClick={() => { setMostrarRenovar((v) => !v); setSolicitOk(false); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border border-stone-200 text-stone-700 hover:bg-stone-50 transition-colors"
          >
            <RefreshCw size={15} /> Renovar / reponer
          </button>
        </div>

        {/* Panel de renovación */}
        {solicitOk && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
            Solicitud enviada. La administración renovará tu credencial y te avisará.
          </div>
        )}
        {mostrarRenovar && !solicitOk && (
          <div className="mt-4 bg-white border border-stone-200 rounded-xl p-4" style={{ maxWidth: 340 }}>
            <div className="text-sm font-bold text-stone-800 mb-1">¿Por qué necesitas renovarla?</div>
            <p className="text-xs text-stone-500 mb-3">La administración la renueva y te avisa. La credencial es válida por 6 meses.</p>
            <div className="space-y-2">
              <button
                onClick={() => handleSolicitarRenovacion('vencimiento')}
                disabled={solicitando}
                className="w-full text-left px-3 py-2.5 rounded-lg border border-stone-200 hover:border-[var(--color-guinda-700)] hover:bg-[var(--color-guinda-50,#faf0f3)] transition-colors disabled:opacity-50"
              >
                <div className="text-sm font-semibold text-stone-800">Venció o está por vencer</div>
                <div className="text-xs text-stone-500">Renovar la vigencia</div>
              </button>
              <button
                onClick={() => handleSolicitarRenovacion('reposicion')}
                disabled={solicitando}
                className="w-full text-left px-3 py-2.5 rounded-lg border border-stone-200 hover:border-[var(--color-guinda-700)] hover:bg-[var(--color-guinda-50,#faf0f3)] transition-colors disabled:opacity-50"
              >
                <div className="text-sm font-semibold text-stone-800">Perdí la credencial física</div>
                <div className="text-xs text-stone-500">Reposición (folio nuevo)</div>
              </button>
            </div>
            {solicitando && <div className="mt-2 text-xs text-stone-400 flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Enviando…</div>}
          </div>
        )}

        {/* ── Nota ─────────────────────────────────────────────────── */}
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-800 flex items-start gap-2">
          <BadgeCheck size={13} className="shrink-0 mt-0.5 text-blue-600" />
          <span>
            Esta credencial es un documento oficial emitido por el IEMSyS. El código QR en el reverso
            puede ser verificado en el portal oficial por cualquier institución educativa.
          </span>
        </div>
      </div>
    </EstudianteLayout>
  );
}
