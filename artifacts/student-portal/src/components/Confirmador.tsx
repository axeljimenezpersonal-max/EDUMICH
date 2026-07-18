/**
 * Confirmador — el reemplazo directo de `confirm()` del navegador.
 *
 * El `confirm()` nativo abre la ventana gris del sistema («la página dice…»),
 * que rompe la identidad visual y en el teléfono aparece pegada arriba. Esto
 * usa el <ConfirmModal> del proyecto (paleta correcta, hoja inferior en móvil)
 * pero conservando la forma imperativa, para que migrar un `confirm()` sea
 * cambiar una línea y no rehacer el componente:
 *
 *     if (!confirm('¿Borrar?')) return;                    // antes
 *     if (!(await confirmar({ title: '…', message: '…' }))) return;   // ahora
 *
 * `<Confirmador />` se monta UNA vez en App.tsx, igual que <Avisador>.
 *
 * Para código nuevo, montar <ConfirmModal> de forma declarativa es igual de
 * válido (así lo hace SedesLista); esto existe para no multiplicar estado en
 * páginas que solo necesitan preguntar «¿seguro?».
 */
import { useEffect, useState, type ReactNode } from 'react';
import { ConfirmModal } from './ConfirmModal';

export interface OpcionesConfirmar {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  /** Estilo rojo para acciones destructivas. */
  danger?: boolean;
  icon?: ReactNode;
  /** Exige escribir esta palabra exacta para habilitar el botón. */
  requireText?: string;
}

interface Pendiente extends OpcionesConfirmar {
  resolver: (ok: boolean) => void;
}

let pendiente: Pendiente | null = null;
const suscriptores = new Set<(p: Pendiente | null) => void>();

function emitir() {
  for (const s of suscriptores) s(pendiente);
}

/**
 * Pregunta al usuario y resuelve `true` si confirma. Si ya hay otra pregunta
 * abierta, la anterior se resuelve como cancelada para no encimar ventanas.
 */
export function confirmar(opciones: OpcionesConfirmar): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (pendiente) pendiente.resolver(false);
    pendiente = { ...opciones, resolver: resolve };
    emitir();
  });
}

export function Confirmador() {
  const [actual, setActual] = useState<Pendiente | null>(null);

  useEffect(() => {
    suscriptores.add(setActual);
    return () => { suscriptores.delete(setActual); };
  }, []);

  if (!actual) return null;

  const cerrar = (ok: boolean) => {
    actual.resolver(ok);
    pendiente = null;
    emitir();
  };

  return (
    <ConfirmModal
      icon={actual.icon}
      danger={actual.danger}
      title={actual.title}
      message={actual.message}
      confirmLabel={actual.confirmLabel ?? 'Confirmar'}
      requireText={actual.requireText}
      onConfirm={() => cerrar(true)}
      onClose={() => cerrar(false)}
    />
  );
}
