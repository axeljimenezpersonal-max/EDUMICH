/**
 * Integridad de los datos — "si hay un problema, verlo al instante".
 *
 * Muestra TODOS los chequeos, incluidos los sanos: saber que algo se está
 * vigilando vale tanto como ver la alarma. Los que fallan suben arriba y los
 * críticos van primero, para que el ojo no tenga que buscar.
 *
 * Cada hallazgo trae qué significa y qué hacer: un número rojo sin
 * explicación solo genera ansiedad.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Loader2, RefreshCw, ShieldCheck, AlertTriangle, AlertOctagon, HelpCircle,
} from 'lucide-react';
import { api } from '../../lib/api';

interface Chequeo {
  clave: string;
  titulo: string;
  nivel: 'critico' | 'aviso';
  significa: string;
  arreglo: string;
  hallazgos: number | null;
  error?: string;
}

interface Respuesta {
  revisadoEn: string;
  resumen: { total: number; criticos: number; avisos: number; rotos: number };
  chequeos: Chequeo[];
}

const GUINDA = '#6B1530';
const ROJO = '#b91c1c';
const AMBAR = '#c77700';
const VERDE = '#2d7d46';

export function IntegridadDatos() {
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [abierto, setAbierto] = useState<string | null>(null);

  const revisar = useCallback(() => {
    setCargando(true);
    api
      .get<Respuesta>('/direccion/integridad')
      .then(setDatos)
      .catch(() => setDatos(null))
      .finally(() => setCargando(false));
  }, []);

  useEffect(revisar, [revisar]);

  const r = datos?.resumen;
  const hayProblema = (r?.criticos ?? 0) > 0 || (r?.avisos ?? 0) > 0 || (r?.rotos ?? 0) > 0;

  // Primero lo que falla, y dentro de eso lo crítico. Lo sano al final.
  const ordenados = [...(datos?.chequeos ?? [])].sort((a, b) => {
    const peso = (c: Chequeo) =>
      c.hallazgos === null ? 0 : c.hallazgos > 0 ? (c.nivel === 'critico' ? 1 : 2) : 3;
    return peso(a) - peso(b);
  });

  return (
    <div className="bg-white border border-stone-200 rounded-lg p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <div className="text-sm font-bold" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Integridad de los datos
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: '#6b635e' }}>
            {datos
              ? `${datos.resumen.total} chequeos · revisado ${new Date(datos.revisadoEn).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`
              : 'Revisando la base…'}
          </div>
        </div>
        <button
          onClick={revisar}
          disabled={cargando}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold border disabled:opacity-50"
          style={{ borderColor: '#ddd0c5', color: '#443e39' }}
        >
          <RefreshCw size={12} className={cargando ? 'animate-spin' : ''} />
          Revisar
        </button>
      </div>

      {cargando && !datos ? (
        <div className="flex items-center gap-2 text-sm py-6" style={{ color: '#6b635e' }}>
          <Loader2 size={15} className="animate-spin" /> Revisando…
        </div>
      ) : !datos ? (
        <p className="text-[13px]" style={{ color: ROJO }}>
          No se pudo revisar la base. Si esto persiste, el problema es la conexión, no los datos.
        </p>
      ) : (
        <>
          {/* Veredicto de un vistazo */}
          <div
            className="rounded-lg px-4 py-3 mb-4 flex items-center gap-3"
            style={{
              background: hayProblema ? '#fdf6ec' : '#f0f7f1',
              border: `1px solid ${hayProblema ? '#e6d9b8' : '#c9dfc9'}`,
            }}
          >
            {hayProblema ? (
              <AlertTriangle size={20} style={{ color: AMBAR, flexShrink: 0 }} />
            ) : (
              <ShieldCheck size={20} style={{ color: VERDE, flexShrink: 0 }} />
            )}
            <div className="text-[13px]" style={{ color: '#443e39', lineHeight: 1.5 }}>
              {hayProblema ? (
                <>
                  <b>
                    {r!.criticos > 0
                      ? `${r!.criticos} crítico${r!.criticos > 1 ? 's' : ''}`
                      : 'Sin críticos'}
                  </b>
                  {r!.avisos > 0 && `, ${r!.avisos} aviso${r!.avisos > 1 ? 's' : ''}`}
                  {r!.rotos > 0 && `, ${r!.rotos} chequeo${r!.rotos > 1 ? 's' : ''} que no pudo correr`}
                  .
                </>
              ) : (
                <>Todo en orden. Los {r!.total} chequeos pasaron.</>
              )}
            </div>
          </div>

          <ul className="flex flex-col gap-1">
            {ordenados.map((c) => {
              const roto = c.hallazgos === null;
              const mal = !roto && (c.hallazgos ?? 0) > 0;
              const color = roto ? '#6b635e' : mal ? (c.nivel === 'critico' ? ROJO : AMBAR) : VERDE;
              const expandido = abierto === c.clave;
              return (
                <li key={c.clave}>
                  <button
                    onClick={() => setAbierto(expandido ? null : c.clave)}
                    aria-expanded={expandido}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left hover:bg-stone-50"
                  >
                    {roto ? (
                      <HelpCircle size={14} style={{ color, flexShrink: 0 }} />
                    ) : mal ? (
                      c.nivel === 'critico' ? (
                        <AlertOctagon size={14} style={{ color, flexShrink: 0 }} />
                      ) : (
                        <AlertTriangle size={14} style={{ color, flexShrink: 0 }} />
                      )
                    ) : (
                      <ShieldCheck size={14} style={{ color, flexShrink: 0 }} />
                    )}
                    <span className="flex-1 text-[13px]" style={{ color: mal ? '#2a2a2a' : '#57504a' }}>
                      {c.titulo}
                    </span>
                    <span className="text-[12px] font-bold tabular-nums" style={{ color }}>
                      {roto ? 'no corrió' : c.hallazgos === 0 ? 'ok' : c.hallazgos}
                    </span>
                  </button>
                  {expandido && (
                    <div
                      className="mx-2.5 mb-2 px-3 py-2.5 rounded-md text-[12.5px]"
                      style={{ background: '#faf7f2', color: '#57504a', lineHeight: 1.55 }}
                    >
                      <p>
                        <b>Qué significa.</b> {c.significa}
                      </p>
                      <p className="mt-1.5">
                        <b>Qué hacer.</b> {c.arreglo}
                      </p>
                      {c.error && (
                        <p className="mt-1.5" style={{ color: ROJO }}>
                          <b>El chequeo falló:</b> {c.error}
                        </p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <p className="text-[11px] mt-3" style={{ color: '#a89a8e', lineHeight: 1.5 }}>
            Se muestran también los chequeos sanos a propósito: ver qué se está
            vigilando importa tanto como ver la alarma.
          </p>
        </>
      )}
    </div>
  );
}
