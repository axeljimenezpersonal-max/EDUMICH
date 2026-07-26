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
  // false si /auth/me falló (sin sesión). Sirve para que el layout eche al
  // login a quien entra por enlace directo sin haber iniciado sesión.
  autenticado: boolean;
  rol: string | null;
  esJefe: boolean;
  nombre: string;
  puesto: string;
}

export function useAdminPerfil(): AdminPerfil {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [cargando, setCargando] = useState(true);
  const [autenticado, setAutenticado] = useState(true);
  useEffect(() => {
    let vivo = true;
    api.get<MeResponse>('/auth/me')
      .then((r) => { if (vivo) { setMe(r); setAutenticado(true); } })
      .catch(() => { if (vivo) setAutenticado(false); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, []);
  return {
    cargando,
    autenticado,
    rol: me?.rol ?? null,
    esJefe: !!me?.perfil?.esJefe,
    nombre: me?.perfil?.nombreCompleto ?? '',
    puesto: me?.perfil?.puesto ?? '',
  };
}
