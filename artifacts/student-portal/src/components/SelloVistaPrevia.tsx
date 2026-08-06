import { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import { EN_VISTA_PREVIA } from '../lib/preview';

/**
 * El sello de "esto es una vista previa".
 *
 * Deliberadamente pequeño y en una esquina. La tentación es poner una franja
 * ancha arriba, pero esta herramienta existe para JUZGAR la pantalla: una
 * franja empuja todo hacia abajo y ya no se está viendo lo que ve el alumno,
 * se está viendo otra cosa. Un sello en la esquina avisa sin mentir sobre el
 * diseño.
 *
 * Importa sobre todo cuando la vista previa se abre en una pestaña aparte, sin
 * el marco del panel del creador alrededor recordándolo.
 */
export default function SelloVistaPrevia() {
  const [encogido, setEncogido] = useState(false);

  // A los seis segundos se reduce a sólo el ojo. Ya cumplió su función de
  // avisar y a partir de ahí nada más estorba.
  useEffect(() => {
    if (!EN_VISTA_PREVIA) return;
    const t = setTimeout(() => setEncogido(true), 6000);
    return () => clearTimeout(t);
  }, []);

  if (!EN_VISTA_PREVIA) return null;

  return (
    <div
      onMouseEnter={() => setEncogido(false)}
      onMouseLeave={() => setEncogido(true)}
      style={{
        position: 'fixed',
        left: 12,
        bottom: 12,
        zIndex: 2147483000,
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: encogido ? '7px 8px' : '7px 13px',
        borderRadius: 999,
        background: 'rgba(28, 25, 23, 0.88)',
        backdropFilter: 'blur(6px)',
        color: '#fde68a',
        fontSize: 11.5,
        fontWeight: 600,
        letterSpacing: '0.04em',
        boxShadow: '0 4px 16px rgba(0,0,0,0.28)',
        transition: 'padding 0.25s ease',
        userSelect: 'none',
        cursor: 'default',
      }}
      title="Vista previa de sólo lectura del panel del creador"
    >
      <Eye size={13} strokeWidth={2.4} style={{ flexShrink: 0 }} />
      {!encogido && <span style={{ whiteSpace: 'nowrap' }}>Vista previa · sólo lectura</span>}
    </div>
  );
}
