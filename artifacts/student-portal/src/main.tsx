import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
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
            animation: 'edumich-fade-out 0.4s 0.85s forwards',
          }}
        >
          <div
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 900,
              fontSize: 64,
              letterSpacing: '-0.05em',
              marginBottom: 6,
              lineHeight: 1,
            }}
          >
            EDUMICH
          </div>
          <div
            style={{
              fontSize: 13,
              opacity: 0.8,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginBottom: 32,
            }}
          >
            Plataforma Educativa Digital
          </div>
          <div
            style={{
              width: 32,
              height: 32,
              border: '3px solid rgba(255,255,255,0.2)',
              borderTopColor: 'white',
              borderRadius: '50%',
              animation: 'edumich-spin 0.8s linear infinite',
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
            @keyframes edumich-fade-out { to { opacity: 0; visibility: hidden; } }
            @keyframes edumich-spin { to { transform: rotate(360deg); } }
          `}</style>
        </div>
      )}
      <App />
    </>
  );
}

createRoot(document.getElementById('root')!).render(<Root />);
