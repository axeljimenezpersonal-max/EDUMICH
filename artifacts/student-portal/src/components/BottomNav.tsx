/**
 * BottomNav — navegación inferior móvil estilo app (patrón oficial EDUMICH).
 *
 * 4 secciones principales SIEMPRE visibles + botón «Más» que abre una hoja
 * inferior con el resto. Sustituye a la barra deslizable de 9 ítems: lo más
 * usado queda a un toque fijo y nada vive escondido fuera de la pantalla.
 *
 * - Targets táctiles ≥44px y safe-area de iOS.
 * - «Más» se marca activo cuando la sección actual vive dentro de la hoja.
 * - Reutilizable por rol: el alumno y el gestor pasan sus propios ítems.
 */
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { MoreHorizontal, X, Lock } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

export interface BottomNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Se muestra con candado (p. ej. aula sin contratar); navega igual, la página explica. */
  lock?: boolean;
}

export function BottomNav({
  principales,
  extras,
  base,
}: {
  /** Las 4 secciones fijas de la barra. */
  principales: BottomNavItem[];
  /** El resto, dentro de la hoja «Más». */
  extras: BottomNavItem[];
  /** Ruta raíz del rol (p. ej. "/estudiante"): activa solo con match exacto. */
  base: string;
}) {
  const [location] = useLocation();
  const [abierto, setAbierto] = useState(false);

  // Activo = la coincidencia MÁS LARGA entre todos los ítems, para que rutas
  // anidadas no enciendan dos pestañas (p. ej. /gestor/alumnos/nuevo debe
  // encender «Nuevo», no también «Alumnos»). La raíz solo con match exacto.
  const coincide = (to: string) => (to === base ? location === base : location.startsWith(to));
  const mejor = [...principales, ...extras]
    .filter((i) => coincide(i.to))
    .sort((a, b) => b.to.length - a.to.length)[0]?.to;
  const esActivo = (to: string) => to === mejor;
  const enExtras = extras.some((i) => esActivo(i.to));

  // Al navegar se cierra la hoja; y con la hoja abierta no se desplaza el fondo.
  useEffect(() => { setAbierto(false); }, [location]);
  useEffect(() => {
    if (!abierto) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [abierto]);

  const slot = (activo: boolean) =>
    `relative flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 transition-colors ${
      activo ? 'text-[var(--color-guinda-700)]' : 'text-stone-400'
    }`;

  return (
    <>
      {/* Hoja «Más» */}
      <AnimatePresence>
        {abierto && (
          <>
            <motion.div
              className="fixed inset-0 z-[55] md:hidden"
              style={{ background: 'rgba(28,10,18,0.45)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setAbierto(false)}
            />
            <motion.div
              role="dialog"
              aria-label="Más secciones"
              className="fixed inset-x-0 bottom-0 z-[56] rounded-t-2xl bg-white md:hidden"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)', boxShadow: '0 -16px 50px -12px rgba(74,14,32,0.45)' }}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            >
              <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-stone-200" aria-hidden />
              <div className="flex items-center justify-between px-5 pt-2.5 pb-1">
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-stone-400">Más secciones</span>
                <button
                  onClick={() => setAbierto(false)}
                  aria-label="Cerrar"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1 px-3 pb-2">
                {extras.map((item) => {
                  const activo = esActivo(item.to);
                  return (
                    <Link key={item.to} href={item.to} className="block">
                      <div
                        className={`flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-xl py-2.5 transition-colors ${
                          activo ? 'bg-[var(--color-crema-100)] text-[var(--color-guinda-700)]' : 'text-stone-500 active:bg-stone-50'
                        }`}
                      >
                        <span className="relative">
                          <item.icon size={22} />
                          {item.lock && (
                            <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-stone-200 text-stone-500">
                              <Lock size={9} />
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] font-semibold leading-none">{item.label}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Barra fija */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-stone-200 bg-white md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        aria-label="Navegación principal"
      >
        <div className="flex items-stretch">
          {principales.map((item) => {
            const activo = esActivo(item.to);
            return (
              <Link key={item.to} href={item.to} className="min-w-0 flex-1">
                <div className={slot(activo)}>
                  {activo && <span className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-[var(--color-guinda-700)]" />}
                  <item.icon size={22} />
                  <span className="max-w-full truncate px-0.5 text-[10px] font-semibold leading-none">{item.label}</span>
                </div>
              </Link>
            );
          })}
          <button type="button" onClick={() => setAbierto(true)} className="min-w-0 flex-1" aria-label="Más secciones">
            <div className={slot(enExtras || abierto)}>
              {enExtras && <span className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-[var(--color-guinda-700)]" />}
              <MoreHorizontal size={22} />
              <span className="text-[10px] font-semibold leading-none">Más</span>
            </div>
          </button>
        </div>
      </nav>
    </>
  );
}
