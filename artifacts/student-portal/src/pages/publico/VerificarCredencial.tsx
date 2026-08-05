/**
 * Pantalla que ve quien ESCANEA el QR de una credencial.
 *
 * Quien llega aquí normalmente es un vigilante en la puerta de una sede, quien
 * aplica el examen o alguien de la DGB: no tiene cuenta, está de pie, con el
 * celular en la mano y con una fila detrás. Por eso la pantalla se lee de un
 * golpe —verde o rojo, nombre grande, folio— y no hay nada más que hacer en
 * ella.
 *
 * Ubicación: artifacts/student-portal/src/pages/publico/VerificarCredencial.tsx
 */
import { useEffect, useState } from 'react';
import { useRoute } from 'wouter';
import { ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';
import { InstitutionalHeader } from '../../components/InstitutionalHeader';
import { fechaLarga } from '../../lib/fechas';

type Resultado =
  | { valida: false; motivo: string }
  | {
      valida: true;
      folio: string;
      nombre: string;
      matricula: string | null;
      sede: string | null;
      vigenteHasta: string | null;
      vigente: boolean;
      motivo: string | null;
    };

export default function VerificarCredencial() {
  // Dos rutas llegan aquí: `/c/:folio` (el QR de la credencial) y
  // `/verificar/:folio` (el QR de las fichas). Se atienden las dos porque hay
  // documentos IMPRESOS con cada una y ninguno se puede reimprimir.
  const [, pC] = useRoute('/c/:folio');
  const [, pV] = useRoute('/verificar/:folio');
  const folio = pC?.folio ?? pV?.folio ?? '';

  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');
  const [r, setR] = useState<Resultado | null>(null);

  useEffect(() => {
    if (!folio) { setEstado('error'); return; }
    // La firma viaja en la URL y se reenvía tal cual: es lo único que autoriza
    // a que el servidor devuelva datos de una persona.
    const t = new URLSearchParams(window.location.search).get('t') ?? '';
    fetch(`/api/publico/credencial/${encodeURIComponent(folio)}${t ? `?t=${encodeURIComponent(t)}` : ''}`)
      .then((res) => res.json())
      .then((d: Resultado) => { setR(d); setEstado('listo'); })
      .catch(() => setEstado('error'));
  }, [folio]);

  const ok = r?.valida === true && r.vigente;

  return (
    <div className="min-h-screen bg-stone-100">
      <InstitutionalHeader />
      <div className="mx-auto max-w-md px-4 py-10">
        <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
          {estado === 'cargando' ? (
            <div className="flex flex-col items-center gap-3 p-12 text-stone-400">
              <Loader2 size={28} className="animate-spin" />
              <span className="text-sm">Verificando…</span>
            </div>
          ) : estado === 'error' || !r ? (
            <Banda ok={false} titulo="No se pudo verificar" />
          ) : !r.valida ? (
            <>
              <Banda ok={false} titulo="No se pudo verificar" />
              <div className="p-6 text-center text-sm text-stone-600">{r.motivo}</div>
            </>
          ) : (
            <>
              <Banda ok={ok} titulo={ok ? 'Credencial válida' : 'Credencial no vigente'} />
              <div className="p-6">
                <div className="text-[11px] font-semibold uppercase tracking-widest text-stone-400">Estudiante</div>
                <div className="mt-1 font-serif text-2xl font-bold leading-tight text-stone-900">{r.nombre}</div>

                <dl className="mt-5 space-y-3 border-t border-stone-100 pt-5 text-sm">
                  <Dato k="Folio" v={r.folio} mono />
                  {r.matricula && <Dato k="Matrícula" v={r.matricula} mono />}
                  {r.sede && <Dato k="Sede" v={r.sede} />}
                  {r.vigenteHasta && <Dato k="Vigente hasta" v={fechaLarga(r.vigenteHasta)} />}
                </dl>

                {!ok && r.motivo && (
                  <div className="mt-5 rounded-lg px-3 py-2.5 text-xs leading-relaxed"
                       style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' }}>
                    {r.motivo}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-stone-400">
          Esta verificación confirma que la credencial fue emitida por Módula · Plan 22.
          No muestra más datos de la persona.
        </p>
      </div>
    </div>
  );
}

function Banda({ ok, titulo }: { ok: boolean; titulo: string }) {
  return (
    <div className="flex items-center gap-3 px-6 py-5" style={{ background: ok ? '#065f46' : '#991b1b' }}>
      {ok ? <ShieldCheck size={26} className="text-white" /> : <ShieldAlert size={26} className="text-white" />}
      <span className="text-lg font-bold text-white">{titulo}</span>
    </div>
  );
}

function Dato({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-xs text-stone-500">{k}</dt>
      <dd className={`text-right font-semibold text-stone-800 ${mono ? 'font-mono text-[13px]' : ''}`}>{v}</dd>
    </div>
  );
}
