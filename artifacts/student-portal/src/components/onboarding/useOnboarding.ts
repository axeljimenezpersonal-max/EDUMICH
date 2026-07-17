/**
 * Estado del recorrido de bienvenida por rol.
 * - Auto-arranca UNA sola vez por rol, persistido en BD (ver lib/tutoriales.ts)
 *   para que el avance viaje con la cuenta y no con el navegador.
 * - Expone `start()` para relanzarlo desde el botón de ayuda "?".
 *
 * La bienvenida NO depende de la etapa: es el mapa general del portal y se
 * enseña igual el primer día que el último. Por eso va sin `etapa` (''), a
 * diferencia de los tutoriales por sección.
 *
 * R1 también aplica aquí: saltar la bienvenida ya no la marca vista para
 * siempre; solo completarla cuenta.
 */

import { useCallback, useEffect, useState } from 'react';
import type { Rol } from '../../lib/api';
import { STEPS_BY_ROL, type TourStep } from './steps';
import { cargarTutoriales, estaVisto, marcarVisto } from '../../lib/tutoriales';

/** Identidad de la bienvenida de un rol. Debe coincidir con los GATE_* de las secciones. */
export function claveBienvenida(rol: Rol): string {
  return `bienvenida_${rol}`;
}

export interface UseOnboarding {
  active: boolean;
  step: TourStep | undefined;
  index: number;
  total: number;
  next: () => void;
  prev: () => void;
  skip: () => void;
  start: () => void;
}

export function useOnboarding(rol: Rol | null | undefined): UseOnboarding {
  const steps = rol ? STEPS_BY_ROL[rol] ?? [] : [];
  const total = steps.length;

  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!rol || total === 0) return;
    let vivo = true;
    let t: ReturnType<typeof setTimeout> | undefined;
    cargarTutoriales().then(() => {
      if (!vivo || estaVisto(claveBienvenida(rol))) return;
      // En teléfono también auto-arranca: la tarjeta del tour es una hoja
      // inferior (ver TourCard), pensada para uso móvil de primera clase.
      t = setTimeout(() => { if (vivo) { setIndex(0); setActive(true); } }, 600);
    });
    return () => { vivo = false; if (t) clearTimeout(t); };
  }, [rol, total]);

  const close = useCallback((done: boolean) => {
    setActive(false);
    if (done && rol) marcarVisto(claveBienvenida(rol));
  }, [rol]);

  const start = useCallback(() => {
    if (total === 0) return;
    setIndex(0);
    setActive(true);
  }, [total]);

  const next = useCallback(() => {
    setIndex((i) => {
      if (i >= total - 1) { close(true); return i; }
      return i + 1;
    });
  }, [total, close]);

  const prev = useCallback(() => { setIndex((i) => (i > 0 ? i - 1 : 0)); }, []);
  /**
   * En la bienvenida, saltar SÍ la da por resuelta — al revés que en los
   * tutoriales de sección (R1). Son dos casos distintos a propósito:
   *
   *  - La bienvenida es el mapa general y vive detrás del botón «?» del
   *    encabezado, siempre a un toque y bien etiquetado: descartarla no pierde
   *    nada recuperable.
   *  - Además los tutoriales de sección la esperan (`gateKey`). Si saltarla no
   *    la resolviera, quien nunca la termine no vería JAMÁS ningún tutorial de
   *    sección: el candado se quedaría cerrado para siempre.
   */
  const skip = useCallback(() => { close(true); }, [close]);

  const safeIndex = Math.min(Math.max(index, 0), Math.max(total - 1, 0));
  const step = steps[safeIndex];

  return { active: active && total > 0, step, index: safeIndex, total, next, prev, skip, start };
}
