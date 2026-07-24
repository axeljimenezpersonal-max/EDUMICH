/**
 * Panorama del creador — los números del negocio sin abrir la base.
 *
 * Todo sale de consultas agregadas: dinero, embudo, crecimiento, cobertura,
 * resultados y contenido. Ningún dato personal de alumnos.
 *
 * Sobre el dinero: se muestra el desglose GUARDADO y, si no cuadra, también
 * el RECALCULADO. Elegir en silencio el número que más nos guste sería la
 * peor opción: quien cobra necesita saber que hay una discrepancia.
 */

import { useEffect, useState } from 'react';
import { Loader2, AlertTriangle, TrendingUp, MapPin, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { DireccionLayout, TarjetaKPI, SeccionCard } from './DireccionLayout';
import { Tendencias } from './Tendencias';

const GUINDA = '#6B1530';
const DORADO = '#8a6f3f';
const ROJO = '#b91c1c';

interface Insights {
  dinero: {
    fichas_pagadas: number;
    examenes_pagados: number;
    cobrado: number;
    iemsys_guardado: number;
    synapsis_guardado: number;
    iemsys_recalculado: number;
    synapsis_recalculado: number;
    fichas_descuadradas: number;
    por_cobrar: number;
  };
  porMes: Array<{ mes: string; fichas: number; examenes: number; synapsis: number }>;
  embudo: {
    solicitudes: number; alumnos: number; expediente_completo: number;
    con_pago: number; inscritos_examen: number; con_calificacion: number; credenciales: number;
  };
  crecimiento: Array<{ mes: string; alumnos: number }>;
  cobertura: { con_alumnos: number; totales: number; gestores_activos: number; sedes: number };
  academico: { calificaciones: number; aprobadas: number; promedio: number | null };
  contenido: { modulos: number; preguntas: number; alumnos_practicando: number };
}

const pesos = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

export default function DireccionInsights() {
  const [d, setD] = useState<Insights | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.get<Insights>('/direccion/insights')
      .then(setD)
      .catch(() => setD(null))
      .finally(() => setCargando(false));
  }, []);

  if (cargando) {
    return (
      <DireccionLayout>
        <div className="flex items-center gap-2 py-24 text-sm" style={{ color: '#6b635e' }}>
          <Loader2 size={16} className="animate-spin" /> Calculando…
        </div>
      </DireccionLayout>
    );
  }
  if (!d) {
    return (
      <DireccionLayout>
        <p className="py-24 text-sm" style={{ color: ROJO }}>No se pudieron calcular los números.</p>
      </DireccionLayout>
    );
  }

  const descuadre = d.dinero.fichas_descuadradas > 0;
  const embudoPasos = [
    { etiqueta: 'Solicitudes de cuenta', n: d.embudo.solicitudes },
    { etiqueta: 'Alumnos dados de alta', n: d.embudo.alumnos },
    { etiqueta: 'Expediente completo', n: d.embudo.expediente_completo },
    { etiqueta: 'Con examen pagado', n: d.embudo.con_pago },
    { etiqueta: 'Inscritos a examen', n: d.embudo.inscritos_examen },
    { etiqueta: 'Con calificación', n: d.embudo.con_calificacion },
    { etiqueta: 'Con credencial activa', n: d.embudo.credenciales },
  ];
  const tope = Math.max(...embudoPasos.map((p) => p.n), 1);
  const maxAlta = Math.max(...d.crecimiento.map((c) => c.alumnos), 1);
  const tasaAprob = d.academico.calificaciones
    ? Math.round((d.academico.aprobadas / d.academico.calificaciones) * 100)
    : 0;

  return (
    <DireccionLayout>
      <div className="mb-5">
        <h1 className="font-bold" style={{ fontSize: 22, fontFamily: "'Poppins', sans-serif" }}>
          Panorama del creador
        </h1>
        <p className="text-[13px]" style={{ color: '#6b635e' }}>
          Los números del programa y del negocio, calculados en vivo desde la base.
        </p>
      </div>

      {/* Métricas de depuración para decidir la limpieza de la base. */}
      <div className="mb-4"><MetricasDepuracion /></div>

      {/* ── Dinero ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <TarjetaKPI etiqueta="Cobrado" valor={pesos(d.dinero.cobrado)}
          sub={`${d.dinero.fichas_pagadas} fichas · ${d.dinero.examenes_pagados} exámenes`} />
        <TarjetaKPI etiqueta="Parte Synapsis" valor={pesos(d.dinero.synapsis_recalculado)}
          sub="$30 por examen" acento={DORADO} />
        <TarjetaKPI etiqueta="Parte IEMSyS" valor={pesos(d.dinero.iemsys_recalculado)}
          sub="$101 por examen" acento={GUINDA} />
        <TarjetaKPI etiqueta="Por cobrar" valor={pesos(d.dinero.por_cobrar)}
          sub="fichas emitidas sin pagar" />
      </div>

      {descuadre && (
        <div className="rounded-lg border p-4 mb-5 flex gap-3"
             style={{ background: '#fdf3f3', borderColor: '#e8c9c9' }}>
          <AlertTriangle size={18} style={{ color: ROJO, flexShrink: 0, marginTop: 2 }} />
          <div className="text-[13px]" style={{ color: '#7a2a2a', lineHeight: 1.55 }}>
            <b>{d.dinero.fichas_descuadradas} fichas tienen el reparto mal grabado.</b>{' '}
            La base dice {pesos(d.dinero.synapsis_guardado)} para Synapsis, pero por
            exámenes cobrados corresponden {pesos(d.dinero.synapsis_recalculado)}.
            Las tarjetas de arriba muestran el <b>recalculado</b>, que es el correcto.
            Vienen de la migración del modelo de pago grupal viejo; el código actual
            ya calcula bien. Hasta corregir esos registros, no factures con el número
            guardado.
          </div>
        </div>
      )}

      <div className="mb-4">
        <Tendencias />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        {/* ── Embudo ─────────────────────────────────────── */}
        <SeccionCard titulo="Del registro al certificado"
          sub="Cuántos llegan a cada paso. Donde cae el número, ahí se atoran.">
          <ul className="flex flex-col gap-2.5">
            {embudoPasos.map((p, i) => {
              const prev = i > 0 ? embudoPasos[i - 1].n : null;
              const caida = prev !== null && prev > 0 ? Math.round(((prev - p.n) / prev) * 100) : 0;
              return (
                <li key={p.etiqueta}>
                  <div className="flex justify-between items-baseline gap-2 mb-1">
                    <span className="text-[13px]">{p.etiqueta}</span>
                    <span className="text-[13px] font-bold tabular-nums" style={{ color: GUINDA }}>
                      {p.n}
                      {caida > 0 && (
                        <span className="text-[11px] font-normal ml-1.5" style={{ color: ROJO }}>
                          −{caida}%
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: '#eee6dc' }}>
                    <div className="h-2 rounded-full"
                         style={{ width: `${(p.n / tope) * 100}%`, background: GUINDA }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </SeccionCard>

        <div className="flex flex-col gap-4">
          {/* ── Crecimiento ──────────────────────────────── */}
          <SeccionCard titulo="Altas de alumnos por mes" sub="Cuántos entraron cada mes">
            {d.crecimiento.length === 0 ? (
              <p className="text-[13px]" style={{ color: '#6b635e' }}>Sin datos.</p>
            ) : (
              <>
                <div className="flex items-end gap-2" style={{ height: 110 }}>
                  {d.crecimiento.map((c, i) => {
                    // El primer mes es PARCIAL (arranca a media marcha): se pinta en
                    // gris para no leerlo como un mes completo.
                    const parcial = i === 0;
                    return (
                      <div key={c.mes} className="flex-1 flex flex-col items-center gap-1.5">
                        <span className="text-[11px] font-bold tabular-nums" style={{ color: parcial ? '#a89a8e' : GUINDA }}>
                          {c.alumnos}
                        </span>
                        <div className="w-full rounded-t"
                             style={{ height: `${(c.alumnos / maxAlta) * 72}px`, background: parcial ? '#d4ccc3' : GUINDA, minHeight: 3 }} />
                        <span className="text-[10px]" style={{ color: '#6b635e' }}>{c.mes.slice(5)}</span>
                      </div>
                    );
                  })}
                </div>
                {d.crecimiento.length > 1 && (
                  <p className="text-[10px] mt-2" style={{ color: '#a89a8e' }}>
                    <span className="inline-block w-2 h-2 rounded-sm align-middle mr-1" style={{ background: '#d4ccc3' }} />
                    El primer mes es parcial: son datos de antes, aún no es un mes completo.
                  </p>
                )}
              </>
            )}
          </SeccionCard>

          {/* ── Cobertura ────────────────────────────────── */}
          <SeccionCard titulo="Alcance" sub="Hasta dónde llega el programa hoy">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2.5">
                <MapPin size={16} style={{ color: DORADO }} />
                <div>
                  <div className="text-[17px] font-bold tabular-nums">
                    {d.cobertura.con_alumnos}
                    <span className="text-[12px] font-normal" style={{ color: '#6b635e' }}>
                      {' '}de {d.cobertura.totales}
                    </span>
                  </div>
                  <div className="text-[11px]" style={{ color: '#6b635e' }}>municipios con alumnos</div>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <Users size={16} style={{ color: DORADO }} />
                <div>
                  <div className="text-[17px] font-bold tabular-nums">{d.cobertura.gestores_activos}</div>
                  <div className="text-[11px]" style={{ color: '#6b635e' }}>gestores activos</div>
                </div>
              </div>
            </div>
            <p className="text-[11.5px] mt-3" style={{ color: '#a89a8e', lineHeight: 1.5 }}>
              Quedan {d.cobertura.totales - d.cobertura.con_alumnos} municipios sin un solo
              alumno: es el margen de crecimiento que ya está pagado en infraestructura.
            </p>
          </SeccionCard>
        </div>
      </div>

      {/* ── Resultados y contenido ─────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-4">
        <SeccionCard titulo="Resultados académicos" sub="Exámenes oficiales capturados">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-[22px] font-bold tabular-nums">{d.academico.calificaciones}</div>
              <div className="text-[11px]" style={{ color: '#6b635e' }}>calificaciones</div>
            </div>
            <div>
              <div className="text-[22px] font-bold tabular-nums"
                   style={{ color: tasaAprob >= 60 ? '#2d7d46' : ROJO }}>
                {tasaAprob}%
              </div>
              <div className="text-[11px]" style={{ color: '#6b635e' }}>aprobación</div>
            </div>
            <div>
              <div className="text-[22px] font-bold tabular-nums">{d.academico.promedio ?? '—'}</div>
              <div className="text-[11px]" style={{ color: '#6b635e' }}>promedio</div>
            </div>
          </div>
          {tasaAprob < 60 && d.academico.calificaciones > 0 && (
            <p className="text-[12px] mt-3" style={{ color: '#7a2a2a', lineHeight: 1.5 }}>
              Menos de la mitad aprueba. Vale la pena cruzarlo con qué módulos se
              practican antes del examen.
            </p>
          )}
        </SeccionCard>

        <SeccionCard titulo="Contenido y práctica" sub="Lo que la plataforma ofrece y lo que se usa">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-[22px] font-bold tabular-nums">{d.contenido.modulos}</div>
              <div className="text-[11px]" style={{ color: '#6b635e' }}>módulos</div>
            </div>
            <div>
              <div className="text-[22px] font-bold tabular-nums">
                {d.contenido.preguntas.toLocaleString('es-MX')}
              </div>
              <div className="text-[11px]" style={{ color: '#6b635e' }}>preguntas</div>
            </div>
            <div>
              <div className="text-[22px] font-bold tabular-nums">{d.contenido.alumnos_practicando}</div>
              <div className="text-[11px]" style={{ color: '#6b635e' }}>alumnos practicando</div>
            </div>
          </div>
          <p className="text-[11.5px] mt-3 flex items-start gap-1.5" style={{ color: '#a89a8e', lineHeight: 1.5 }}>
            <TrendingUp size={12} style={{ flexShrink: 0, marginTop: 2 }} />
            El banco de preguntas es el activo más caro de construir y el que más
            distingue a la plataforma. Vigilar cuánto se usa dice si vale lo que costó.
          </p>
        </SeccionCard>
      </div>
    </DireccionLayout>
  );
}

// ── Métricas de cuentas sin movimiento (para depurar la base con criterio) ──
interface MetricasDep {
  sinDocumentos25d: number;
  conDocsSinInscripcion3a6m: number;
  conDocsSinInscripcion6m: number;
  enBajaLogica: number;
}
function MetricasDepuracion() {
  const [m, setM] = useState<MetricasDep | null>(null);
  useEffect(() => {
    api.get<MetricasDep>('/direccion/depuracion-metricas').then(setM).catch(() => {});
  }, []);
  if (!m) return null;
  const cards = [
    { label: 'Sin documentos (+25 días)', v: m.sinDocumentos25d, sub: 'Candidatas a baja por la regla de 30 días' },
    { label: 'Con docs, sin examen (3–6 meses)', v: m.conDocsSinInscripcion3a6m, sub: 'Se acercan a la regla de 6 meses' },
    { label: 'Con docs, sin examen (+6 meses)', v: m.conDocsSinInscripcion6m, sub: 'Ya elegibles para depuración' },
    { label: 'En baja lógica', v: m.enBajaLogica, sub: 'Por borrarse a los 90 días' },
  ];
  return (
    <SeccionCard titulo="Cuentas sin movimiento" sub="Para depurar la base con criterio, sin sobresaturarla">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-stone-200 p-3">
            <div className="text-[22px] font-bold tabular-nums" style={{ fontFamily: "'Poppins', sans-serif", color: GUINDA }}>{c.v}</div>
            <div className="text-[12px] font-semibold text-stone-700 mt-0.5">{c.label}</div>
            <div className="text-[11px] text-stone-400 mt-0.5">{c.sub}</div>
          </div>
        ))}
      </div>
    </SeccionCard>
  );
}
