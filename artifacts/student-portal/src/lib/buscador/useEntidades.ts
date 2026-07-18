/**
 * Trae personas y folios del endpoint transversal (`/api/busqueda`).
 *
 * Sólo lo usan gestor y admin: el alumno no tiene a quién buscar y el perfil
 * de dirección no debe llegar a datos personales. El servidor lo vuelve a
 * verificar; esto es únicamente para no hacer llamadas inútiles.
 */

import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Resultado, RolBuscador } from './tipos';

const ROLES_CON_ENTIDADES: RolBuscador[] = ['gestor', 'admin'];

/** Pausa tras el último tecleo antes de preguntarle al servidor. */
const ESPERA_MS = 250;

export function useEntidades(rol: RolBuscador, consulta: string): Resultado[] {
  const [entidades, setEntidades] = useState<Resultado[]>([]);

  useEffect(() => {
    const q = consulta.trim();
    if (!ROLES_CON_ENTIDADES.includes(rol) || q.length < 2) {
      setEntidades([]);
      return;
    }

    // `cancelado` es lo que evita el problema clásico de estos buscadores: si
    // la respuesta de "ana" llega DESPUÉS de la de "ana sofía", sin esto los
    // resultados de la consulta vieja pisan a los de la nueva y la lista
    // parece tener vida propia.
    let cancelado = false;
    const t = setTimeout(() => {
      api
        .get<{ resultados: Resultado[] }>(`/busqueda?q=${encodeURIComponent(q)}`)
        .then((r) => { if (!cancelado) setEntidades(r.resultados ?? []); })
        // Silencioso a propósito: que falle la búsqueda de personas no debe
        // romper las respuestas y secciones, que sí funcionan sin servidor.
        .catch(() => { if (!cancelado) setEntidades([]); });
    }, ESPERA_MS);

    return () => { cancelado = true; clearTimeout(t); };
  }, [rol, consulta]);

  return entidades;
}
