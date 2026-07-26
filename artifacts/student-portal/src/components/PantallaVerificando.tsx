/**
 * Pantalla mínima mientras se verifica la sesión.
 *
 * Los layouts la muestran ANTES de pintar cualquier contenido protegido, hasta
 * confirmar con /auth/me que hay sesión y que el rol coincide. Así, entrar por
 * un enlace directo (p. ej. /admin/convocatorias) sin sesión no enseña ni un
 * destello del panel: se ve esto y se redirige al login.
 */
import { Loader2 } from 'lucide-react';

export function PantallaVerificando() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-crema-100)]">
      <Loader2 className="animate-spin" size={28} style={{ color: 'var(--color-guinda-700)' }} />
    </div>
  );
}
