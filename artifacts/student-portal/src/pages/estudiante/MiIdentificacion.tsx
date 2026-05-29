import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { BadgeCheck, Download, Loader2, Lock, QrCode } from 'lucide-react';
import QRCodeReact from 'qrcode.react';
import { EstudianteLayout } from './EstudianteLayout';
import { api } from '../../lib/api';

interface IdentificacionData {
  nombreCompleto: string;
  curp: string;
  email: string;
  municipio: string;
  matriculaOficialDGB: string;
  licenciaDigital: string;
  licenciaEmitidaEn: string;
}

interface Resp {
  tieneIdentificacion: boolean;
  identificacion?: IdentificacionData;
}

export default function MiIdentificacion() {
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [descargando, setDescargando] = useState(false);

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
      if (!res.ok) throw new Error('Error al generar la identificación');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'identificacion-digital-prepa-abierta.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('No se pudo descargar la identificación. Intenta de nuevo.');
    } finally {
      setDescargando(false);
    }
  }

  if (loading) {
    return (
      <EstudianteLayout>
        <div className="flex items-center justify-center h-64 text-stone-400">
          <Loader2 size={20} className="animate-spin mr-2" /> Cargando...
        </div>
      </EstudianteLayout>
    );
  }

  // Sin identificación emitida aún
  if (!data?.tieneIdentificacion) {
    return (
      <EstudianteLayout>
        <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-guinda-700)] mb-1 flex items-center gap-1.5">
          <BadgeCheck size={12} /> Mi identificación
        </div>
        <h1 className="font-serif text-3xl font-bold text-stone-900 mb-6">
          Identificación digital
        </h1>

        <div className="bg-white border border-stone-200 rounded-xl p-10 max-w-lg text-center mx-auto">
          <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-4">
            <Lock size={28} className="text-stone-400" />
          </div>
          <h2 className="font-serif text-xl font-bold text-stone-800 mb-2">
            Aún no tienes identificación digital
          </h2>
          <p className="text-stone-500 text-sm leading-relaxed mb-6">
            Tu identificación digital será emitida por la administración una vez que tu
            matrícula oficial DGB haya sido asignada y tu expediente esté completo.
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-stone-600 justify-center">
              <span className="w-5 h-5 rounded-full bg-stone-100 flex items-center justify-center text-xs font-bold text-stone-400">1</span>
              Completa tu expediente con los 4 documentos
            </div>
            <div className="flex items-center gap-2 text-stone-600 justify-center">
              <span className="w-5 h-5 rounded-full bg-stone-100 flex items-center justify-center text-xs font-bold text-stone-400">2</span>
              La administración valida y asigna tu matrícula
            </div>
            <div className="flex items-center gap-2 text-stone-600 justify-center">
              <span className="w-5 h-5 rounded-full bg-stone-100 flex items-center justify-center text-xs font-bold text-stone-400">3</span>
              Se emite tu identificación digital
            </div>
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
  // QR encodes the licencia + CURP as a verifiable payload
  const qrValue = JSON.stringify({
    licencia: id.licenciaDigital,
    curp: id.curp,
    nombre: id.nombreCompleto,
    matricula: id.matriculaOficialDGB,
  });

  const fechaEmision = id.licenciaEmitidaEn
    ? new Date(id.licenciaEmitidaEn).toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '—';

  return (
    <EstudianteLayout>
      <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-guinda-700)] mb-1 flex items-center gap-1.5">
        <BadgeCheck size={12} /> Mi identificación
      </div>
      <h1 className="font-serif text-3xl font-bold text-stone-900 mb-1">
        Identificación digital
      </h1>
      <p className="text-stone-500 text-sm mb-6">
        Emitida el {fechaEmision} · Prepa Abierta Michoacán / IEMSyS
      </p>

      {/* ── Credencial visual ── */}
      <div className="max-w-2xl">
        {/* Tarjeta */}
        <div
          className="rounded-2xl overflow-hidden shadow-lg mb-5"
          style={{ background: 'linear-gradient(135deg, #7B1F3A 0%, #5C1428 100%)' }}
        >
          {/* Header de la tarjeta */}
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <div className="text-white text-[10px] font-bold uppercase tracking-widest opacity-70">
                GOBIERNO DEL ESTADO DE MICHOACÁN
              </div>
              <div className="text-white text-sm font-bold mt-0.5">
                Prepa Abierta · IEMSyS
              </div>
            </div>
            <div className="text-right">
              <div className="text-white/60 text-[9px] uppercase tracking-widest">IDENTIFICACIÓN</div>
              <div className="text-white text-[10px] font-bold">DIGITAL OFICIAL</div>
            </div>
          </div>

          {/* Cuerpo crema */}
          <div
            className="px-6 py-5 grid gap-5"
            style={{
              background: '#F5ECD7',
              gridTemplateColumns: '1fr auto',
            }}
          >
            {/* Datos */}
            <div className="space-y-3">
              <div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-stone-400 mb-0.5">
                  Nombre completo
                </div>
                <div className="font-bold text-stone-900 text-base leading-tight">
                  {id.nombreCompleto}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-stone-400 mb-0.5">
                    CURP
                  </div>
                  <div className="font-mono text-xs font-bold text-stone-800 tracking-wide">
                    {id.curp}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-stone-400 mb-0.5">
                    Municipio
                  </div>
                  <div className="text-xs font-semibold text-stone-800">{id.municipio}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-stone-400 mb-0.5">
                    Matrícula DGB
                  </div>
                  <div className="font-mono text-sm font-bold text-green-700 tracking-wide">
                    {id.matriculaOficialDGB}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-stone-400 mb-0.5">
                    Licencia digital
                  </div>
                  <div
                    className="font-mono text-sm font-bold tracking-wide"
                    style={{ color: '#7B1F3A' }}
                  >
                    {id.licenciaDigital}
                  </div>
                </div>
              </div>

              <div
                className="text-[10px] text-stone-400 pt-1 border-t border-stone-200"
              >
                Emitida: {fechaEmision}
              </div>
            </div>

            {/* QR */}
            <div className="flex flex-col items-center justify-center pl-4">
              <div className="bg-white rounded-lg p-2 shadow-sm">
                <QRCodeReact
                  value={qrValue}
                  size={110}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#1a1a1a"
                />
              </div>
              <div className="text-[9px] text-stone-400 mt-1.5 text-center font-semibold uppercase tracking-widest">
                Escanear
              </div>
            </div>
          </div>

          {/* Footer de la tarjeta */}
          <div
            className="px-6 py-2 flex items-center justify-between"
            style={{ background: 'rgba(0,0,0,0.25)' }}
          >
            <div className="text-white/60 text-[9px] font-semibold uppercase tracking-widest">
              EDUMICH · Sistema de Gestión IEMSyS
            </div>
            <div className="flex items-center gap-1 text-white/50 text-[9px]">
              <QrCode size={9} />
              Verificación por QR
            </div>
          </div>
        </div>

        {/* Botón de descarga */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleDescargar}
            disabled={descargando}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            style={{ background: 'var(--color-guinda-700)', color: 'white' }}
          >
            {descargando ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Download size={15} />
            )}
            {descargando ? 'Generando PDF...' : 'Descargar identificación (PDF)'}
          </button>
        </div>

        {/* Nota informativa */}
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-800 flex items-start gap-2">
          <BadgeCheck size={13} className="shrink-0 mt-0.5 text-blue-600" />
          <span>
            Esta identificación es un documento oficial emitido por el IEMSyS. El código QR contiene
            tus datos de manera segura y puede ser verificado por cualquier institución educativa.
          </span>
        </div>
      </div>
    </EstudianteLayout>
  );
}
