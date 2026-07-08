/**
 * Vista previa (frente + reverso) de la credencial digital del estudiante.
 * Reutilizable por admin y gestor: recibe `basePath` (p. ej. /admin/alumnos/25
 * o /gestor/alumnos/25) y consulta `${basePath}/credencial`.
 */
import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ShieldCheck, ImageOff } from 'lucide-react';
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

function Campo({ label, value, mono, light }: { label: string; value: string; mono?: boolean; light?: boolean }) {
  return (
    <div>
      <div className="text-[8px] font-bold uppercase tracking-[0.14em]" style={{ color: light ? 'rgba(255,255,255,0.6)' : '#a89a8e' }}>{label}</div>
      <div className={`${mono ? 'font-mono' : ''} font-bold leading-tight`} style={{ fontSize: mono ? 12 : 13, color: light ? '#fff' : '#2a2320', letterSpacing: mono ? '0.02em' : 0 }}>
        {value || '—'}
      </div>
    </div>
  );
}

export function CredencialPreview({ basePath }: { basePath: string }) {
  const [d, setD] = useState<CredData | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let alive = true;
    api.get<CredData>(`${basePath}/credencial`)
      .then((r) => { if (alive) setD(r); })
      .catch(() => { if (alive) setErr(true); });
    return () => { alive = false; };
  }, [basePath]);

  if (err) return <div className="text-sm text-center py-6" style={{ color: '#a89a8e' }}>No se pudo cargar la credencial.</div>;
  if (!d) return <div className="h-64 rounded-2xl animate-pulse" style={{ background: '#f3ede8' }} />;
  if (!d.emitida) return null;

  return (
    <div className="flex flex-wrap gap-5 justify-center">
      {/* ═══ FRENTE ═══ */}
      <div style={{ width: 360, borderRadius: 16, overflow: 'hidden', border: '1px solid #e7dcd3', background: '#fbf7f5', boxShadow: '0 8px 26px rgba(74,14,32,0.10)' }}>
        <div style={{ background: GUINDA_HEADER, padding: '13px 18px', borderBottom: '3px solid #b8975a' }}>
          <div className="text-white font-bold text-[13px] tracking-wide">CREDENCIAL DEL ESTUDIANTE</div>
          <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.82)' }}>Preparatoria Abierta Michoacán · IEMSyS</div>
        </div>
        <div className="p-4 flex gap-4">
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
          <div style={{ background: '#fff', padding: 4, borderRadius: 6, border: '1px solid #eadfd7' }}>
            <QRCodeSVG value={d.verifyUrl} size={54} fgColor="#2a1720" bgColor="#ffffff" level="M" />
          </div>
        </div>
      </div>

      {/* ═══ REVERSO ═══ */}
      <div style={{ width: 360, borderRadius: 16, overflow: 'hidden', border: '1px solid #e7dcd3', background: '#ffffff', boxShadow: '0 8px 26px rgba(74,14,32,0.10)' }}>
        <div style={{ background: 'var(--color-guinda-800)', padding: '11px 18px' }}>
          <div className="text-white font-bold text-[12px] tracking-wide">DATOS DE LA CREDENCIAL</div>
        </div>
        <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-3">
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
        </div>
        <div className="px-4 pb-3">
          <div className="text-[8px] font-bold uppercase tracking-[0.14em] mb-1" style={{ color: '#a89a8e' }}>Convocatorias inscritas</div>
          <div className="text-[12px] font-medium" style={{ color: '#2a2320' }}>
            {d.convocatorias.length ? d.convocatorias.join('  ·  ') : 'Sin inscripciones registradas'}
          </div>
        </div>
        <div className="px-4 py-2.5 text-[9px]" style={{ background: '#f7f2ee', color: '#a89a8e' }}>
          Folio {d.folio} · verifica.edumich.michoacan.gob.mx
        </div>
      </div>
    </div>
  );
}

export default CredencialPreview;
