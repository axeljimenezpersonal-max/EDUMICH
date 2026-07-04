/**
 * BrandLogo — escudo oficial (Gobierno de Michoacán / SEE) a prueba de fallos.
 *
 * REGLA DE ORO: el logo institucional NUNCA debe mostrarse roto.
 *  1. El PNG se importa como asset de Vite (se empaqueta con hash bajo /assets/,
 *     se emite siempre y se sirve con permisos correctos). NO se usa una ruta
 *     pública suelta como "/logo.png", que puede faltar o quedar con permisos 600.
 *  2. Si aun así fallara la carga, `onError` sustituye por un monograma inline
 *     (CSS puro, sin red), de modo que jamás se ve el ícono de imagen rota.
 *
 * Si agregas otro logo, síguelo igual: import del asset + fallback inline.
 */

import { useState } from 'react';
import logoMichoacan from '../assets/logo-see-michoacan-256.png';
import logoBlanco from '../assets/logo-see-blanco-256.png';

type Variante = 'color' | 'blanco';

interface Props {
  variante?: Variante;
  className?: string;
  alt?: string;
}

export function BrandLogo({ variante = 'color', className = '', alt = 'Secretaría de Educación de Michoacán' }: Props) {
  const [falló, setFalló] = useState(false);
  const src = variante === 'blanco' ? logoBlanco : logoMichoacan;

  if (falló) {
    // Fallback inline: monograma guinda (sin dependencia de red).
    const esBlanco = variante === 'blanco';
    return (
      <span
        aria-label={alt}
        role="img"
        className={`inline-flex items-center justify-center font-serif font-bold select-none ${className}`}
        style={{
          background: esBlanco ? 'rgba(255,255,255,0.15)' : 'var(--color-guinda-700)',
          color: '#fff',
          borderRadius: 8,
          letterSpacing: '-0.02em',
        }}
      >
        <span style={{ fontSize: '0.62em', lineHeight: 1 }}>SEE</span>
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="eager"
      decoding="async"
      onError={() => setFalló(true)}
    />
  );
}
