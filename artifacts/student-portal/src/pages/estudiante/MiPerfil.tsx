import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { User, Pencil, Lock, LogOut, ChevronRight } from 'lucide-react';
import { EstudianteLayout } from './EstudianteLayout';
import CambiarPasswordModal from '../../components/CambiarPasswordModal';
import { api, type DashboardEstudiante } from '../../lib/api';

export default function MiPerfil() {
  const [, navigate] = useLocation();
  const [estudiante, setEstudiante] = useState<DashboardEstudiante['estudiante'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    api
      .get<DashboardEstudiante>('/estudiante/dashboard')
      .then((d) => setEstudiante(d.estudiante))
      .finally(() => setLoading(false));
  }, []);

  async function handleLogout() {
    await api.post('/auth/logout');
    navigate('/login');
  }

  const iniciales = estudiante?.nombreCompleto
    ? estudiante.nombreCompleto
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
    : '?';

  return (
    <EstudianteLayout>
      {loading ? (
        <div className="text-center text-stone-400 py-16 text-sm">Cargando perfil…</div>
      ) : (
        <div className="max-w-[540px] mx-auto mt-4">
          {/* Profile card */}
          <div
            className="bg-white border border-stone-200 overflow-hidden"
            style={{ borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
          >
            {/* Banner gradient */}
            <div
              className="h-[110px] relative"
              style={{
                background: 'linear-gradient(135deg, #6B1530 0%, #5C1428 100%)',
              }}
            >
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.18) 0%, transparent 50%)',
                }}
              />
            </div>

            {/* Avatar */}
            <div className="flex justify-center" style={{ marginTop: -48 }}>
              <div
                className="w-24 h-24 rounded-full bg-[var(--color-crema-200)] text-[var(--color-guinda-700)] flex items-center justify-center relative"
                style={{
                  border: '4px solid white',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                }}
              >
                {iniciales !== '?' ? (
                  <span className="font-serif text-2xl font-bold">{iniciales}</span>
                ) : (
                  <User size={44} />
                )}
              </div>
            </div>

            {/* Info */}
            <div className="px-8 pb-7 text-center">
              <h1
                className="font-serif text-2xl font-bold text-stone-900 mt-4 mb-2"
                style={{ letterSpacing: '-0.02em' }}
              >
                {estudiante?.nombreCompleto ?? '—'}
              </h1>

              <span
                className="inline-block text-[11px] font-bold uppercase px-3 py-1 rounded-full mb-5"
                style={{
                  letterSpacing: '0.15em',
                  background: 'var(--color-guinda-100, #fbe6ea)',
                  color: 'var(--color-guinda-700)',
                }}
              >
                Estudiante
              </span>

              {/* Mini stats */}
              <div
                className="flex justify-center gap-8 border-t border-stone-100 pt-5"
              >
                <div className="text-center">
                  <p
                    className="text-[10px] font-semibold uppercase text-stone-400 mb-1"
                    style={{ letterSpacing: '0.1em' }}
                  >
                    Correo
                  </p>
                  <p className="text-sm text-stone-900 font-medium">
                    {estudiante?.email ?? '—'}
                  </p>
                </div>
                <div className="text-center">
                  <p
                    className="text-[10px] font-semibold uppercase text-stone-400 mb-1"
                    style={{ letterSpacing: '0.1em' }}
                  >
                    Municipio
                  </p>
                  <p className="text-sm text-stone-900 font-medium">
                    {estudiante?.municipio || '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Action rows */}
            <div>
              <ActionRow
                icon={<Pencil size={18} />}
                title="Editar mis datos"
                desc="Actualiza tu información personal en Mi expediente"
                onClick={() => navigate('/estudiante/expediente')}
              />
              <ActionRow
                icon={<Lock size={18} />}
                title="Cambiar contraseña"
                desc="Actualiza la contraseña de tu cuenta"
                onClick={() => setModalOpen(true)}
              />
              <ActionRow
                icon={<LogOut size={18} />}
                title="Cerrar sesión"
                titleColor="#b91c1c"
                desc="Salir del sistema"
                iconDanger
                onClick={handleLogout}
              />
            </div>
          </div>

          {/* Footer text */}
          <p className="text-center text-[11px] text-stone-400 mt-4 leading-relaxed">
            Sistema de Gestión Preparatoria Abierta · IEMSyS
            <br />
            Gobierno del Estado de Michoacán
          </p>
        </div>
      )}

      <CambiarPasswordModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </EstudianteLayout>
  );
}

function ActionRow({
  icon,
  title,
  titleColor,
  desc,
  iconDanger,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  titleColor?: string;
  desc: string;
  iconDanger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3.5 px-8 py-3.5 border-t border-stone-100 text-left transition-colors hover:bg-[var(--color-crema-100,#f8f4ec)]"
    >
      <div
        className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center shrink-0"
        style={{
          background: iconDanger ? '#fef2f2' : 'var(--color-crema-100, #f8f4ec)',
          color: iconDanger ? '#b91c1c' : 'var(--color-guinda-700)',
        }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-semibold"
          style={{ color: titleColor ?? 'var(--color-piedra-900, #2a2a2a)' }}
        >
          {title}
        </p>
        <p className="text-xs text-stone-400 mt-0.5">{desc}</p>
      </div>
      <ChevronRight size={15} className="text-stone-400 shrink-0" />
    </button>
  );
}
