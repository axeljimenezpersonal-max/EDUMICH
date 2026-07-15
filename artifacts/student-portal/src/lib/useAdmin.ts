/**
 * Perfil del administrador en sesión. Distingue a la JEFA (titular, Velia) de
 * los administradores OPERATIVOS de su equipo. Las facultades de jefatura
 * —alta/baja de gestores y firma responsable de la cédula— solo las tiene la
 * jefa; el backend es la barrera real, esto solo oculta/avisa en la UI.
 */
import { useEffect, useState } from 'react';
import { api, type MeResponse } from './api';

export interface AdminPerfil {
  cargando: boolean;
  esJefe: boolean;
  nombre: string;
  puesto: string;
}

export function useAdminPerfil(): AdminPerfil {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [cargando, setCargando] = useState(true);
  useEffect(() => {
    let vivo = true;
    api.get<MeResponse>('/auth/me')
      .then((r) => { if (vivo) setMe(r); })
      .catch(() => {})
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, []);
  return {
    cargando,
    esJefe: !!me?.perfil?.esJefe,
    nombre: me?.perfil?.nombreCompleto ?? '',
    puesto: me?.perfil?.puesto ?? '',
  };
}
