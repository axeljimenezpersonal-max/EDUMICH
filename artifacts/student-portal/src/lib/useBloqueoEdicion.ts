/**
 * useBloqueoEdicion — candado de edición concurrente para el portal.
 *
 * Reutilizable en cualquier pantalla que edite un recurso sensible (cédula,
 * inscripción, convocatoria…). Mientras `activo` sea true:
 *   - toma el candado del `recurso` al montar,
 *   - lo renueva con un latido cada 10s (el servidor lo da por vivo 30s),
 *   - lo suelta al desactivarse, al desmontar y al cerrar/recargar la pestaña.
 *
 * Devuelve el `estado` del candado para que la pantalla decida qué mostrar:
 *   'inactivo' | 'cargando' | 'propio' (puedes editar) | 'ajeno' (lo tiene otro).
 *
 * Diseño anti-falsos-positivos: un latido que falla por red NO marca 'ajeno'
 * (se conserva el estado); y como el candado del servidor expira solo si el
 * cliente deja de latir, nadie queda bloqueado por una sesión que ya se fue.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

export type EstadoBloqueo = 'inactivo' | 'cargando' | 'propio' | 'ajeno';

export interface TitularBloqueo {
  userId: number;
  nombre: string;
  rol: string;
  desde: string;
}

interface RespBloqueo {
  ok: boolean;
  propio: boolean;
  titular: TitularBloqueo | null;
}

const LATIDO_MS = 10_000;

function rutaBloqueo(recurso: string) {
  return `/bloqueos/${encodeURIComponent(recurso)}`;
}

export function useBloqueoEdicion(recurso: string | null, activo: boolean) {
  const [estado, setEstado] = useState<EstadoBloqueo>('inactivo');
  const [titular, setTitular] = useState<TitularBloqueo | null>(null);

  const latir = useCallback(async (r: string) => {
    try {
      const resp = await api.post<RespBloqueo>(rutaBloqueo(r));
      setTitular(resp.titular);
      setEstado(resp.propio ? 'propio' : 'ajeno');
      return resp.propio;
    } catch {
      // Fallo transitorio (red/servidor): NO inventamos un bloqueo ajeno ni
      // expulsamos a quien ya estaba editando. Se conserva el estado actual.
      return null;
    }
  }, []);

  const reintentar = useCallback(() => {
    if (!recurso) return Promise.resolve(null);
    setEstado('cargando');
    return latir(recurso);
  }, [recurso, latir]);

  useEffect(() => {
    if (!activo || !recurso) {
      setEstado('inactivo');
      setTitular(null);
      return;
    }

    let vivo = true;
    setEstado('cargando');
    void latir(recurso);
    const timer = window.setInterval(() => {
      if (vivo) void latir(recurso);
    }, LATIDO_MS);

    // Soltar el candado si el usuario cierra o recarga la pestaña. `keepalive`
    // permite que la petición sobreviva al unload (fetch normal se cancelaría).
    const soltarEnUnload = () => {
      try {
        fetch(`/api${rutaBloqueo(recurso)}`, { method: 'DELETE', credentials: 'include', keepalive: true });
      } catch {
        /* en unload no hay nada más que hacer */
      }
    };
    window.addEventListener('beforeunload', soltarEnUnload);

    return () => {
      vivo = false;
      clearInterval(timer);
      window.removeEventListener('beforeunload', soltarEnUnload);
      // Soltar al salir de la edición o desmontar la pantalla.
      api.delete(rutaBloqueo(recurso)).catch(() => {});
    };
  }, [recurso, activo, latir]);

  return { estado, titular, reintentar };
}
