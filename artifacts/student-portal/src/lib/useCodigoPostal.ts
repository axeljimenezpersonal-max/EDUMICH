/**
 * Autollenado de domicilio por CÓDIGO POSTAL (catálogo SEPOMEX, Michoacán).
 *
 * Al escribir los 5 dígitos consulta `/publico/cp/:cp` y devuelve las colonias
 * de ese CP, además de estado y ciudad para rellenar lo que esté vacío. Vive
 * aquí —y no copiado en cada pantalla— porque lo usan el alta del gestor y los
 * dos formularios públicos: una sola implementación, un solo comportamiento.
 *
 * Uso:
 *   const { colonias, buscando, manual, setManual } = useCodigoPostal(form.cp, (p) =>
 *     setForm((f) => ({ ...f, estadoDomicilio: f.estadoDomicilio || p.estado || '', ... })));
 */

import { useEffect, useState } from 'react';
import { api } from './api';

export interface CpResuelto {
  estado: string | null;
  municipio: string | null;
  ciudad: string | null;
}

export interface UsoCodigoPostal {
  /** Colonias del CP consultado (vacío si no se encontró o el CP no está completo). */
  colonias: string[];
  /** Consulta en curso. */
  buscando: boolean;
  /** El usuario eligió capturar su colonia a mano ("Otra…"). */
  manual: boolean;
  setManual: (v: boolean) => void;
}

export function useCodigoPostal(cp: string, alResolver?: (datos: CpResuelto) => void): UsoCodigoPostal {
  const [colonias, setColonias] = useState<string[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [manual, setManual] = useState(false);

  useEffect(() => {
    const limpio = (cp ?? '').trim();
    if (!/^\d{5}$/.test(limpio)) { setColonias([]); return; }
    let vivo = true;
    setBuscando(true);
    // Espera breve para no consultar en cada tecla mientras se escribe el CP.
    const t = setTimeout(() => {
      api.get<{ encontrado: boolean; estado: string | null; municipio: string | null; ciudad: string | null; colonias: string[] }>(`/publico/cp/${limpio}`)
        .then((r) => {
          if (!vivo) return;
          setColonias(r.colonias ?? []);
          if (r.encontrado) {
            setManual(false);
            alResolver?.({ estado: r.estado, municipio: r.municipio, ciudad: r.ciudad });
          }
        })
        .catch(() => { if (vivo) setColonias([]); })
        .finally(() => { if (vivo) setBuscando(false); });
    }, 400);
    return () => { vivo = false; clearTimeout(t); };
    // `alResolver` se omite a propósito: se redefine en cada render del padre y
    // reiniciaría la consulta en bucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cp]);

  return { colonias, buscando, manual, setManual };
}
