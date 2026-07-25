/**
 * Frontera de error de toda la app.
 *
 * Problema que resuelve: las secciones se cargan con React.lazy() (import
 * dinámico). Cuando sale un deploy nuevo, el index.html que el navegador tenía
 * en caché apunta a chunks con hash viejo que YA NO existen en el servidor. Al
 * navegar a una sección aún no cargada (p. ej. la Bitácora), ese import falla,
 * <Suspense> NO atrapa el rechazo, el error sube hasta la raíz y —sin una
 * frontera— React desmonta todo: pantalla en BLANCO.
 *
 * Aquí lo atrapamos. Si el error es de carga de chunk (típico tras un deploy),
 * recargamos la página UNA vez para traer el index.html nuevo. Si no, mostramos
 * una tarjeta con botón de "Recargar" en vez de dejar la pantalla vacía.
 */
import { Component, type ReactNode } from 'react';

const RECARGA_FLAG = 'modula_recarga_chunk';

function esErrorDeChunk(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    msg.includes('dynamically imported module') ||
    msg.includes('failed to fetch dynamically') ||
    msg.includes('loading chunk') ||
    msg.includes('importing a module script failed') ||
    msg.includes('error loading')
  );
}

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Tras un deploy, el chunk viejo ya no existe. Recarga una sola vez para
    // traer el HTML nuevo; el flag evita un bucle de recargas si algo más falla.
    if (esErrorDeChunk(error)) {
      try {
        if (!sessionStorage.getItem(RECARGA_FLAG)) {
          sessionStorage.setItem(RECARGA_FLAG, '1');
          window.location.reload();
        }
      } catch { /* sessionStorage bloqueado: cae a la tarjeta de abajo */ }
    }
  }

  render() {
    if (this.state.error) {
      // Si es de chunk y ya intentamos recargar, mostramos la tarjeta (no
      // volvemos a recargar por el flag).
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#faf7f4' }}>
          <div style={{ maxWidth: 420, textAlign: 'center', background: '#fff', border: '1px solid #eadfd7', borderRadius: 16, padding: '32px 28px', boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🙏</div>
            <h1 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 18, fontWeight: 700, color: '#2a2a2a', margin: '0 0 6px' }}>
              Algo se interrumpió
            </h1>
            <p style={{ fontSize: 14, color: '#6b635e', margin: '0 0 20px', lineHeight: 1.5 }}>
              La página no cargó bien. Suele pasar justo después de una actualización.
              Recarga y debería quedar listo.
            </p>
            <button
              type="button"
              onClick={() => { try { sessionStorage.removeItem(RECARGA_FLAG); } catch { /* noop */ } window.location.reload(); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--color-guinda-700, #6B1530)', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              Recargar la página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
