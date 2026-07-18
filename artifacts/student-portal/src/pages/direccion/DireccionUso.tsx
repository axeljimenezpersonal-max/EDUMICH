/**
 * Uso de la plataforma — qué pantallas y botones usa cada perfil.
 *
 * La medición es por contadores agregados: no hay ningún dato de personas,
 * solo "el rol gestor abrió esta pantalla N veces". Ver `lib/uso.ts` y la
 * tabla `uso_diario`.
 *
 * De aquí salen los accesos rápidos del inicio de cada perfil: el sistema
 * propone según el ranking y una persona aprueba. No se reordenan solos a
 * propósito — un menú que cambia bajo el dedo del usuario es peor que uno
 * imperfecto pero estable.
 */

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, Plus, X, TrendingUp, EyeOff, Info } from 'lucide-react';
import { api } from '../../lib/api';
import { DireccionLayout, TarjetaKPI, SeccionCard } from './DireccionLayout';
import { CATALOGO, ROLES, NOMBRE_ROL, etiquetaDe, type Rol } from '../../lib/catalogoSecciones';

const GUINDA = '#6B1530';

interface FilaUso {
  rol: string;
  tipo: 'pantalla' | 'accion';
  clave: string;
  total: number;
}

interface Resumen {
  dias: number;
  cobertura: { desde: string | null; hasta: string | null; dias_con_datos: number; eventos: number };
  filas: FilaUso[];
}

interface AccesoRapido {
  clave: string;
  etiqueta: string;
}

export default function DireccionUso() {
  const [dias, setDias] = useState(30);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [cargando, setCargando] = useState(true);
  const [rolActivo, setRolActivo] = useState<Rol>('gestor');
  const [accesos, setAccesos] = useState<AccesoRapido[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState<string | null>(null);

  useEffect(() => {
    setCargando(true);
    api
      .get<Resumen>(`/uso/resumen?dias=${dias}`)
      .then(setResumen)
      .catch(() => setResumen(null))
      .finally(() => setCargando(false));
  }, [dias]);

  useEffect(() => {
    api
      .get<{ accesos: AccesoRapido[] }>(`/uso/accesos/${rolActivo}`)
      .then((r) => setAccesos(r.accesos ?? []))
      .catch(() => setAccesos([]));
    setGuardado(null);
  }, [rolActivo]);

  const delRol = useMemo(
    () => (resumen?.filas ?? []).filter((f) => f.rol === rolActivo),
    [resumen, rolActivo]
  );
  const pantallas = delRol.filter((f) => f.tipo === 'pantalla');
  const acciones = delRol.filter((f) => f.tipo === 'accion');
  const maxPantalla = pantallas[0]?.total ?? 0;

  // Lo que nadie tocó: catálogo menos lo que aparece en los contadores.
  // Es la mitad menos obvia del tablero y suele ser la más útil.
  const sinUso = useMemo(() => {
    const vistas = new Set(pantallas.map((p) => p.clave));
    return CATALOGO[rolActivo].filter((s) => !vistas.has(s.clave));
  }, [pantallas, rolActivo]);

  const yaEsAcceso = (clave: string) => accesos.some((a) => a.clave === clave);

  function agregar(clave: string, etiqueta: string) {
    if (yaEsAcceso(clave) || accesos.length >= 12) return;
    setAccesos([...accesos, { clave, etiqueta }]);
    setGuardado(null);
  }

  function quitar(clave: string) {
    setAccesos(accesos.filter((a) => a.clave !== clave));
    setGuardado(null);
  }

  function mover(indice: number, delta: number) {
    const destino = indice + delta;
    if (destino < 0 || destino >= accesos.length) return;
    const copia = [...accesos];
    [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
    setAccesos(copia);
    setGuardado(null);
  }

  async function guardar() {
    setGuardando(true);
    try {
      await api.put(`/uso/accesos/${rolActivo}`, { accesos });
      setGuardado(`Guardado: ${accesos.length} accesos para ${NOMBRE_ROL[rolActivo]}.`);
    } catch {
      setGuardado('No se pudo guardar. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  const cobertura = resumen?.cobertura;
  const sinDatos = !cargando && (cobertura?.eventos ?? 0) === 0;

  return (
    <DireccionLayout>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="font-bold" style={{ fontSize: 22, fontFamily: "'Poppins', sans-serif" }}>
            Uso de la plataforma
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: '#6b635e' }}>
            Qué abre cada perfil. Se cuenta por rol, nunca por persona.
          </p>
        </div>
        <div className="flex gap-1.5">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDias(d)}
              className="px-3 py-1.5 rounded-md text-[12px] font-semibold border transition-colors"
              style={{
                background: dias === d ? GUINDA : '#fff',
                color: dias === d ? '#fff' : '#443e39',
                borderColor: dias === d ? GUINDA : '#ddd0c5',
              }}
            >
              {d} días
            </button>
          ))}
        </div>
      </div>

      {cargando ? (
        <div className="flex items-center gap-2 text-sm py-10" style={{ color: '#6b635e' }}>
          <Loader2 size={16} className="animate-spin" /> Cargando…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <TarjetaKPI etiqueta="Eventos contados" valor={(cobertura?.eventos ?? 0).toLocaleString('es-MX')} />
            <TarjetaKPI etiqueta="Días con datos" valor={cobertura?.dias_con_datos ?? 0} sub={`de ${dias}`} />
            <TarjetaKPI etiqueta="Desde" valor={cobertura?.desde ?? '—'} />
            <TarjetaKPI etiqueta="Perfiles con actividad" valor={new Set((resumen?.filas ?? []).map((f) => f.rol)).size} />
          </div>

          {sinDatos && (
            <div
              className="rounded-lg border p-4 mb-5 flex gap-3"
              style={{ background: '#fdf8ee', borderColor: '#e6d9b8' }}
            >
              <Info size={18} style={{ color: '#8a6f3f', flexShrink: 0, marginTop: 2 }} />
              <div className="text-[13px]" style={{ color: '#5c4a26', lineHeight: 1.55 }}>
                <b>Todavía no hay nada que mostrar.</b> La medición empieza a
                contar desde que esta versión está en línea y solo registra uso
                real: la demo pública no cuenta. Con pocos usuarios activos, un
                mes de datos dirá poco — conviene esperar a tener movimiento
                real antes de decidir los accesos rápidos.
              </div>
            </div>
          )}

          {/* Selector de perfil */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {ROLES.map((r) => (
              <button
                key={r}
                onClick={() => setRolActivo(r)}
                className="px-3.5 py-2 rounded-md text-[13px] font-semibold border transition-colors"
                style={{
                  background: rolActivo === r ? '#f8f4ec' : '#fff',
                  color: rolActivo === r ? '#4a0e20' : '#443e39',
                  borderColor: rolActivo === r ? GUINDA : '#ddd0c5',
                }}
              >
                {NOMBRE_ROL[r]}
              </button>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <SeccionCard
              titulo={`Lo más abierto — ${NOMBRE_ROL[rolActivo]}`}
              sub="Pantallas ordenadas por veces abiertas"
            >
              {pantallas.length === 0 ? (
                <p className="text-[13px]" style={{ color: '#6b635e' }}>
                  Sin registros en este período.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {pantallas.map((p) => (
                    <li key={p.clave} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline gap-2">
                          <span className="text-[13px] font-medium truncate">
                            {etiquetaDe(rolActivo, p.clave)}
                          </span>
                          <span
                            className="text-[12px] font-bold tabular-nums"
                            style={{ color: GUINDA }}
                          >
                            {p.total.toLocaleString('es-MX')}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full mt-1" style={{ background: '#eee6dc' }}>
                          <div
                            className="h-1.5 rounded-full"
                            style={{
                              width: `${maxPantalla ? (p.total / maxPantalla) * 100 : 0}%`,
                              background: GUINDA,
                            }}
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => agregar(p.clave, etiquetaDe(rolActivo, p.clave))}
                        disabled={yaEsAcceso(p.clave) || accesos.length >= 12}
                        title="Proponer como acceso rápido"
                        className="p-1.5 rounded-md border disabled:opacity-35"
                        style={{ borderColor: '#ddd0c5' }}
                      >
                        <Plus size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {acciones.length > 0 && (
                <div className="mt-5 pt-4" style={{ borderTop: '1px solid #eee6dc' }}>
                  <div className="text-[11px] uppercase tracking-wider font-semibold mb-2" style={{ color: '#6b635e' }}>
                    Botones
                  </div>
                  <ul className="flex flex-col gap-1.5">
                    {acciones.map((a) => (
                      <li key={a.clave} className="flex justify-between text-[13px]">
                        <span className="font-mono text-[12px] truncate">{a.clave}</span>
                        <span className="font-bold tabular-nums" style={{ color: GUINDA }}>
                          {a.total.toLocaleString('es-MX')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </SeccionCard>

            <div className="flex flex-col gap-4">
              <SeccionCard
                titulo={`Accesos rápidos de ${NOMBRE_ROL[rolActivo]}`}
                sub="Lo que aparece en su pantalla de inicio. Máximo 12."
              >
                {accesos.length === 0 ? (
                  <p className="text-[13px]" style={{ color: '#6b635e' }}>
                    Ninguno configurado. Agrega desde el ranking de la izquierda
                    con el botón <Plus size={11} className="inline" />.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {accesos.map((a, i) => (
                      <li
                        key={a.clave}
                        className="flex items-center gap-2 px-2.5 py-2 rounded-md"
                        style={{ background: '#faf7f2', border: '1px solid #eee6dc' }}
                      >
                        <span className="text-[11px] font-bold tabular-nums w-4" style={{ color: '#a89a8e' }}>
                          {i + 1}
                        </span>
                        <span className="flex-1 text-[13px] font-medium truncate">{a.etiqueta}</span>
                        <button onClick={() => mover(i, -1)} disabled={i === 0}
                                className="px-1.5 text-[13px] disabled:opacity-30" title="Subir">↑</button>
                        <button onClick={() => mover(i, 1)} disabled={i === accesos.length - 1}
                                className="px-1.5 text-[13px] disabled:opacity-30" title="Bajar">↓</button>
                        <button onClick={() => quitar(a.clave)} className="p-1" title="Quitar">
                          <X size={13} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex items-center gap-3 mt-4">
                  <button
                    onClick={guardar}
                    disabled={guardando}
                    className="flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-semibold text-white disabled:opacity-60"
                    style={{ background: GUINDA }}
                  >
                    {guardando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Guardar
                  </button>
                  {guardado && (
                    <span className="text-[12px]" style={{ color: '#6b635e' }}>{guardado}</span>
                  )}
                </div>
              </SeccionCard>

              <SeccionCard
                titulo="Nadie las abrió"
                sub="Secciones del perfil sin un solo registro en el período"
              >
                {sinUso.length === 0 ? (
                  <p className="text-[13px] flex items-center gap-2" style={{ color: '#2d7d46' }}>
                    <TrendingUp size={14} /> Todas las secciones tuvieron uso.
                  </p>
                ) : (
                  <ul className="flex flex-wrap gap-1.5">
                    {sinUso.map((s) => (
                      <li
                        key={s.clave}
                        className="text-[12px] px-2.5 py-1 rounded-full flex items-center gap-1.5"
                        style={{ background: '#f4efe8', color: '#6b635e' }}
                      >
                        <EyeOff size={11} /> {s.etiqueta}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-[11.5px] mt-3" style={{ color: '#a89a8e', lineHeight: 1.5 }}>
                  Una sección sin uso no siempre sobra: puede estar escondida.
                  Antes de quitarla, vale la pena preguntarse si se encuentra.
                </p>
              </SeccionCard>
            </div>
          </div>
        </>
      )}
    </DireccionLayout>
  );
}
