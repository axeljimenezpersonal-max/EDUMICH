/**
 * Accesos rápidos del inicio.
 *
 * Muestra lo que alguien aprobó desde el tablero de uso (Dirección → Uso de
 * la plataforma). La telemetría propone según lo más abierto; una persona
 * decide. Deliberadamente NO se reordena solo: si los botones cambian de
 * lugar entre visitas, el usuario deja de poder memorizar dónde están y el
 * atajo se vuelve un estorbo.
 *
 * Si no hay nada configurado no pinta nada — ni encabezado ni hueco.
 */

import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { ArrowUpRight } from 'lucide-react';
import { api } from '../lib/api';

interface Acceso {
  clave: string;
  etiqueta: string;
}

export function AccesosRapidos({ className = '' }: { className?: string }) {
  const [accesos, setAccesos] = useState<Acceso[]>([]);

  useEffect(() => {
    let vivo = true;
    api
      .get<{ accesos: Acceso[] }>('/uso/accesos')
      .then((r) => {
        if (vivo) setAccesos(r.accesos ?? []);
      })
      .catch(() => {
        // Silencio: un atajo que no carga no es motivo para molestar a nadie.
      });
    return () => {
      vivo = false;
    };
  }, []);

  if (accesos.length === 0) return null;

  return (
    <nav aria-label="Accesos rápidos" className={className}>
      <div
        className="text-[11px] uppercase tracking-wider font-semibold mb-2"
        style={{ color: '#6b635e' }}
      >
        Accesos rápidos
      </div>
      <ul className="flex flex-wrap gap-2">
        {accesos.map((a) => (
          <li key={a.clave}>
            <Link
              href={a.clave}
              // Se mide el uso del propio atajo: si nadie lo toca, sobra.
              data-uso={`atajo${a.clave.replace(/\//g, '.')}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-medium bg-white border transition-colors hover:border-[var(--color-guinda-400)]"
              style={{ borderColor: '#ddd0c5', color: '#443e39' }}
            >
              {a.etiqueta}
              <ArrowUpRight size={13} style={{ color: '#a89a8e' }} />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
