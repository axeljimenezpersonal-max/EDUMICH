import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ModulaLogo from './components/ModulaLogo';
import './index.css';

function Root() {
  const [splash, setSplash] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setSplash(false), 800);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      {splash && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'linear-gradient(135deg, #6B1530 0%, #4A0E20 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            color: 'white',
            animation: 'modula-fade-out 0.4s 0.85s forwards',
          }}
        >
          {/* La marca vectorizada, no texto: el splash aparece antes de que
              termine de cargar cualquier fuente, y con texto se veía primero en
              la tipografía de respaldo y luego saltaba. */}
          <ModulaLogo
            titulo="Módula 22"
            style={{ width: 'min(72vw, 320px)', height: 'auto', marginBottom: 14 }}
          />
          <div
            style={{
              fontSize: 12,
              opacity: 0.75,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              marginBottom: 32,
              color: 'var(--color-dorado-soft)',
            }}
          >
            Plan 22 · Preparatoria Abierta
          </div>
          <div
            style={{
              width: 32,
              height: 32,
              border: '3px solid rgba(255,255,255,0.2)',
              borderTopColor: 'white',
              borderRadius: '50%',
              animation: 'modula-spin 0.8s linear infinite',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: 32,
              fontSize: 11,
              opacity: 0.5,
              letterSpacing: '0.06em',
            }}
          >
            Gobierno del Estado de Michoacán · IEMSyS
          </div>
          <style>{`
            @keyframes modula-fade-out { to { opacity: 0; visibility: hidden; } }
            @keyframes modula-spin { to { transform: rotate(360deg); } }
          `}</style>
        </div>
      )}
      <App />
    </>
  );
}

createRoot(document.getElementById('root')!).render(<Root />);
