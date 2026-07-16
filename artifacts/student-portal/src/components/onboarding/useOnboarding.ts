/**
 * Estado del recorrido de bienvenida por rol.
 * - Auto-arranca UNA sola vez por rol (persistido en localStorage), solo en
 *   escritorio (en móvil la barra lateral está oculta y el spotlight no aplica).
 * - Expone `start()` para relanzarlo desde el botón de ayuda "?".
 */

import { useCallback, useEffect, useState } from 'react';
import type { Rol } from '../../lib/api';
import { STEPS_BY_ROL, type TourStep } from './steps';

const STORAGE_PREFIX = 'edumich_tour_v1_';

function storageKey(rol: Rol): string {
  return `${STORAGE_PREFIX}${rol}`;
}

function isDone(rol: Rol): boolean {
  try { return localStorage.getItem(storageKey(rol)) === '1'; } catch { return false; }
}

function markDone(rol: Rol): void {
  try { localStorage.setItem(storageKey(rol), '1'); } catch { /* sin persistencia */ }
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
    if (isDone(rol)) return;
    // En teléfono también auto-arranca: la tarjeta del tour es una hoja
    // inferior (ver TourCard), pensada para uso móvil de primera clase.
    const t = setTimeout(() => { setIndex(0); setActive(true); }, 600);
    return () => clearTimeout(t);
  }, [rol, total]);

  const close = useCallback((done: boolean) => {
    setActive(false);
    if (done && rol) markDone(rol);
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
  const skip = useCallback(() => { close(true); }, [close]);

  const safeIndex = Math.min(Math.max(index, 0), Math.max(total - 1, 0));
  const step = steps[safeIndex];

  return { active: active && total > 0, step, index: safeIndex, total, next, prev, skip, start };
}
