import { BookOpen, Cpu, MapPin, Users, ShieldCheck, Zap } from 'lucide-react';

export default function AcercaDe() {
  return (
    <div style={{ maxWidth: 700 }}>
      {/* Hero Modula */}
      <div
        style={{
          background: 'linear-gradient(135deg, #f8e8ef 0%, #fdf4f8 60%, #fff 100%)',
          border: '1px solid #e8c4d4',
          borderRadius: 16,
          padding: '40px 48px',
          marginBottom: 32,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 900,
            fontSize: 56,
            letterSpacing: '-0.04em',
            background: 'linear-gradient(135deg, #6B1530 0%, #4A0E20 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: 12,
            lineHeight: 1,
          }}
        >
          Modula · Plan 22
        </div>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#2a2a2a', margin: '0 0 12px', letterSpacing: '-0.01em' }}>
          Preparatoria Abierta · Gobierno de Michoacán
        </h1>
        <p style={{ fontSize: 14, color: '#6b635e', lineHeight: 1.6, margin: '0 auto', maxWidth: 480 }}>
          Modula es la iniciativa tecnológica del Gobierno de Michoacán para digitalizar y
          modernizar la gestión educativa del estado, comenzando con el sistema de Preparatoria
          Abierta del IEMSyS.
        </p>
      </div>

      {/* Info cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
        {[
          {
            icon: Zap,
            titulo: 'La plataforma',
            desc: 'Modula es la capa tecnológica que integra y moderniza los procesos institucionales del IEMSyS, comenzando por la gestión de Preparatoria Abierta.',
          },
          {
            icon: BookOpen,
            titulo: 'Preparatoria Abierta',
            desc: 'El módulo activo de Modula gestiona las inscripciones, expedientes, calificaciones y comunicación del Plan Modular de Preparatoria Abierta.',
          },
          {
            icon: Users,
            titulo: 'Gestores municipales',
            desc: 'Los gestores son el puente entre la institución y los aspirantes en cada municipio de Michoacán. Modula facilita su trabajo diario.',
          },
          {
            icon: MapPin,
            titulo: 'Cobertura estatal',
            desc: 'El sistema opera en los 113 municipios del Estado de Michoacán, con gestores municipales asignados a cada región.',
          },
          {
            icon: Cpu,
            titulo: 'Tecnología',
            desc: 'Modula está construido con tecnología moderna: Node.js, PostgreSQL, React y pnpm workspaces para garantizar rendimiento y escalabilidad.',
          },
          {
            icon: ShieldCheck,
            titulo: 'Seguridad y privacidad',
            desc: 'Cumple con la Ley General de Protección de Datos Personales (LGPDPPSO). Los datos son almacenados de forma segura en servidores del Estado.',
          },
        ].map(({ icon: Icon, titulo, desc }) => (
          <div
            key={titulo}
            style={{
              background: 'white',
              border: '1px solid #eadfd7',
              borderRadius: 12,
              padding: '20px 22px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: '#f8e8ef', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--color-guinda-700)', flexShrink: 0,
              }}>
                <Icon size={16} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#2a2a2a' }}>{titulo}</div>
            </div>
            <p style={{ fontSize: 12, color: '#6b635e', lineHeight: 1.55, margin: 0 }}>{desc}</p>
          </div>
        ))}
      </div>

      {/* Version info */}
      <div style={{ fontSize: 11, color: '#a89a8e', textAlign: 'center', lineHeight: 1.6 }}>
        Modula v0.1 (demo) · Módulo Preparatoria Abierta · {new Date().getFullYear()}<br />
        Gobierno del Estado de Michoacán · Instituto de Educación Media Superior y Superior
      </div>
    </div>
  );
}
