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
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#0e0e11', fontFamily: "'Poppins', system-ui, sans-serif" }}>
          <div style={{ width: '100%', maxWidth: 380, background: '#17171b', border: '1px solid #26262c', borderRadius: 14, padding: '28px 26px' }}>
            {/* Marca de estado: glifo de línea, monocromático */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid #33333b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e5e5ea" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 9v4" />
                  <path d="M12 17h.01" />
                  <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                </svg>
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6f6f79' }}>
                Error de carga
              </div>
            </div>

            <h1 style={{ fontSize: 17, fontWeight: 600, color: '#f4f4f6', margin: '0 0 6px', letterSpacing: '-0.01em' }}>
              La vista se interrumpió
            </h1>
            <p style={{ fontSize: 13.5, color: '#9a9aa4', margin: '0 0 22px', lineHeight: 1.55 }}>
              No se cargó bien, normalmente por una actualización reciente. Recarga para traer la versión más nueva.
            </p>

            <button
              type="button"
              onClick={() => { try { sessionStorage.removeItem(RECARGA_FLAG); } catch { /* noop */ } window.location.reload(); }}
              style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#f4f4f6', color: '#111114', border: 'none', borderRadius: 9, padding: '11px 18px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M8 16H3v5" />
              </svg>
              Recargar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
