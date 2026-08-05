/**
 * Comprobación de integridad de la bitácora.
 *
 * Cada entrada firma su contenido junto con la huella de la anterior. Este
 * botón recorre la cadena y dice si alguien la tocó — y dónde.
 *
 * Va a petición y no al cargar la pantalla: recorre la tabla entera, y una
 * comprobación que se dispara sola cada vez acaba siendo una consulta pesada
 * que además nadie mira. Que sea un acto deliberado también le da sentido:
 * se comprueba cuando alguien necesita afirmar que el registro está íntegro.
 */
import { useState } from 'react';
import { ShieldCheck, ShieldAlert, Loader2, FileCheck2 } from 'lucide-react';
import { fechaHoraCorta } from '../lib/fechas';

type Resultado = {
  intacta: boolean;
  totalEntradas: number;
  sinCadena: number;
  verificadas: number;
  primeraRota: null | { id: number; createdAt: string; accion: string; motivo: string };
  revisadaEn: string;
};

const MOTIVO: Record<string, string> = {
  contenido_alterado: 'el contenido de esa entrada no corresponde a su huella: fue editada',
  eslabon_no_coincide: 'esa entrada no encadena con la anterior: se borró o se insertó algo',
};

export function IntegridadBitacora({ endpoint }: { endpoint: string }) {
  const [estado, setEstado] = useState<'quieto' | 'revisando'>('quieto');
  const [r, setR] = useState<Resultado | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function revisar() {
    setEstado('revisando');
    setError(null);
    try {
      const res = await fetch(endpoint, { credentials: 'include' });
      if (!res.ok) throw new Error('No se pudo verificar');
      setR(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo verificar');
    } finally {
      setEstado('quieto');
    }
  }

  return (
    <div className="mb-5 rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <FileCheck2 size={18} className="mt-0.5 shrink-0 text-stone-400" />
          <div>
            <div className="text-sm font-semibold text-stone-800">Integridad del registro</div>
            <p className="mt-0.5 text-xs leading-relaxed text-stone-500">
              Cada entrada va firmada junto con la anterior. Si alguien editó o borró
              una, la cadena se rompe y aquí se ve dónde.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={revisar}
          disabled={estado === 'revisando'}
          className="shrink-0 inline-flex items-center gap-2 rounded-lg border border-stone-200 px-3.5 py-2 text-xs font-semibold text-stone-700 hover:border-stone-300 disabled:opacity-50"
        >
          {estado === 'revisando' ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
          {estado === 'revisando' ? 'Revisando…' : 'Comprobar ahora'}
        </button>
      </div>

      {error && <p className="mt-3 text-xs font-medium text-red-700">{error}</p>}

      {r && (
        <div
          className="mt-3 rounded-lg px-3.5 py-3"
          style={
            r.intacta
              ? { background: '#ecfdf5', border: '1px solid #a7f3d0' }
              : { background: '#fef2f2', border: '1px solid #fecaca' }
          }
        >
          <div className="flex items-center gap-2">
            {r.intacta
              ? <ShieldCheck size={16} style={{ color: '#065f46' }} />
              : <ShieldAlert size={16} style={{ color: '#991b1b' }} />}
            <span className="text-sm font-bold" style={{ color: r.intacta ? '#065f46' : '#991b1b' }}>
              {r.intacta ? 'La cadena está intacta' : 'La cadena está rota'}
            </span>
          </div>

          <div className="mt-2 text-xs leading-relaxed" style={{ color: r.intacta ? '#065f46' : '#991b1b' }}>
            {r.intacta ? (
              <>Se comprobaron <strong>{r.verificadas}</strong> de {r.totalEntradas} entradas y ninguna fue alterada.</>
            ) : (
              <>
                Se rompe en la entrada <strong>#{r.primeraRota?.id}</strong> ({r.primeraRota?.accion}),
                del {fechaHoraCorta(r.primeraRota?.createdAt)}: {MOTIVO[r.primeraRota?.motivo ?? ''] ?? 'no cuadra'}.
              </>
            )}
          </div>

          {r.sinCadena > 0 && (
            <div className="mt-2 border-t pt-2 text-[11px] leading-relaxed"
                 style={{ borderColor: r.intacta ? '#a7f3d0' : '#fecaca', color: '#78716c' }}>
              <strong>{r.sinCadena}</strong> {r.sinCadena === 1 ? 'entrada es anterior' : 'entradas son anteriores'} a
              la protección y no {r.sinCadena === 1 ? 'tiene huella' : 'tienen huella'}:
              de ésas no se puede afirmar nada.
            </div>
          )}

          <div className="mt-2 text-[11px] text-stone-400">Revisado {fechaHoraCorta(r.revisadaEn)}</div>
        </div>
      )}
    </div>
  );
}
