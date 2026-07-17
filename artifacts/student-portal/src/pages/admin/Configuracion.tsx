import { useState, useRef, lazy, Suspense } from 'react';
import { useParams, useLocation } from 'wouter';
import {
  UserCircle, Shield, Building, FileText, CreditCard,
  Calendar, MapPin, Mail, Share2, ClipboardList, Info, Trash2,
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { SectionTour } from '../../components/onboarding/SectionTour';
import { TOUR_A_CONFIGURACION, GATE_ADMIN } from '../../components/onboarding/seccionesAdmin';
import { SaveBar } from '../../components/SaveBar';
import { useAdminPerfil } from '../../lib/useAdmin';

// ─────────────────────────────────────────────────────────────
// Lazy-load section components
// ─────────────────────────────────────────────────────────────

const MiCuenta = lazy(() => import('./config/MiCuenta'));
const Seguridad = lazy(() => import('./config/Seguridad'));
const DatosInstitucionales = lazy(() => import('./config/DatosInstitucionales'));
const DocumentosRequeridos = lazy(() => import('./config/DocumentosRequeridos'));
const Pagos = lazy(() => import('./config/Pagos'));
const EtapasDGB = lazy(() => import('./config/EtapasDGB'));
const Municipios = lazy(() => import('./config/Municipios'));
const PlantillasCorreo = lazy(() => import('./config/PlantillasCorreo'));
const Integraciones = lazy(() => import('./config/Integraciones'));
const Bitacora = lazy(() => import('./config/Bitacora'));
const AcercaDe = lazy(() => import('./config/AcercaDe'));
const Depuracion = lazy(() => import('./config/Depuracion'));

// ─────────────────────────────────────────────────────────────
// Nav config
// ─────────────────────────────────────────────────────────────

const GUINDA = '#6B1530';

type Seccion =
  | 'mi-cuenta' | 'seguridad' | 'datos-institucionales'
  | 'documentos-requeridos' | 'pagos' | 'etapas-dgb'
  | 'municipios' | 'plantillas-correo' | 'integraciones' | 'bitacora' | 'depuracion' | 'acerca-de';

type NavGroup = { label: string; items: { id: Seccion; label: string; icon: React.FC<{ size?: number }> }[] };
// La sección "Supervisión" (bitácora de actividad) es una facultad de jefatura:
// solo la administradora TITULAR (Velia) puede auditar lo que hace su equipo.
function navGroups(esJefe: boolean): NavGroup[] {
  return [
    {
      label: 'PERSONAL',
      items: [
        { id: 'mi-cuenta', label: 'Mi cuenta', icon: UserCircle },
        { id: 'seguridad', label: 'Seguridad', icon: Shield },
      ],
    },
    {
      label: 'INSTITUCIÓN',
      items: [
        { id: 'documentos-requeridos', label: 'Documentos requeridos', icon: FileText },
        { id: 'etapas-dgb', label: 'Etapas DGB', icon: Calendar },
      ],
    },
    ...(esJefe ? [{
      label: 'SUPERVISIÓN',
      items: [
        { id: 'bitacora' as Seccion, label: 'Bitácora de actividad', icon: ClipboardList },
      ],
    }] : []),
    {
      label: 'SISTEMA',
      items: [
        { id: 'acerca-de', label: 'Acerca de Modula', icon: Info },
      ],
    },
  ];
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

export default function Configuracion() {
  const params = useParams<{ seccion?: string }>();
  const [, setLocation] = useLocation();
  const seccion = (params.seccion ?? 'mi-cuenta') as Seccion;
  const { esJefe } = useAdminPerfil();
  const NAV_GROUPS = navGroups(esJefe);

  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveRef = useRef<(() => Promise<void>) | null>(null);
  const discardRef = useRef<(() => void) | null>(null);

  function handleNavClick(id: Seccion) {
    if (isDirty) {
      if (!confirm('Tienes cambios sin guardar. ¿Descartar y continuar?')) return;
      discardRef.current?.();
      setIsDirty(false);
    }
    setLocation(`/admin/configuracion/${id}`);
  }

  async function handleSave() {
    if (!saveRef.current) return;
    setSaving(true);
    try {
      await saveRef.current();
      setIsDirty(false);
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    discardRef.current?.();
    setIsDirty(false);
  }

  function isActive(id: Seccion) {
    return seccion === id;
  }

  return (
    <AdminLayout>
      {/* En teléfono el menú de configuración se apila arriba del contenido;
          en md+ vuelve a ser la columna fija de 220px pegajosa. */}
      <div className="flex flex-col gap-5 md:flex-row" style={{ fontFamily: "'Poppins', sans-serif" }}>

        {/* ── Config sidebar ── */}
        <aside
          data-tour="a-cfg-nav"
          className="bg-white border border-stone-200 rounded-lg flex-shrink-0 w-full md:w-[220px] md:sticky md:overflow-y-auto md:max-h-[calc(100vh-112px)]"
          style={{ top: 96, alignSelf: 'start' }}
        >
          <div className="px-4 py-3" style={{ background: 'var(--color-guinda-700)' }}>
            <div className="text-[10px] uppercase tracking-widest text-white/70">PANEL</div>
            <div className="text-sm font-bold text-white" style={{ fontFamily: "'Poppins', sans-serif" }}>
              Configuración
            </div>
          </div>

          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="py-1.5 border-t border-stone-100">
              <div
                className="text-[9px] uppercase tracking-widest font-bold px-4 pt-2 pb-1"
                style={{ color: '#a89a8e', letterSpacing: '0.15em' }}
              >
                {group.label}
              </div>
              <ul className="list-none">
                {group.items.map(({ id, label, icon: Icon }) => {
                  const active = isActive(id);
                  return (
                    <li key={id}>
                      <button
                        onClick={() => handleNavClick(id)}
                        className="w-full flex items-center gap-2 px-4 py-2 text-[12px] border-l-[3px] text-left"
                        style={{
                          borderLeftColor: active ? 'var(--color-guinda-700)' : 'transparent',
                          background: active ? 'var(--color-crema-100)' : 'transparent',
                          color: active ? 'var(--color-guinda-800)' : '#57504a',
                          fontWeight: active ? 600 : 400,
                        }}
                      >
                        <Icon size={13} /> {label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </aside>

        {/* ── Section content ── */}
        <main className="flex-1 min-w-0">
          <Suspense fallback={
            <div className="flex items-center justify-center h-40">
              <div style={{ width: 20, height: 20, border: `2px solid ${GUINDA}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          }>
            <SectionRenderer
              seccion={seccion}
              onDirty={setIsDirty}
              registerSave={(fn) => { saveRef.current = fn; }}
              registerDiscard={(fn) => { discardRef.current = fn; }}
            />
          </Suspense>
        </main>
      </div>

      <SaveBar isDirty={isDirty} onSave={handleSave} onDiscard={handleDiscard} saving={saving} />

      <SectionTour
        steps={TOUR_A_CONFIGURACION}
        storageKey="modula_sec_a_configuracion_v1"
        gateKey={GATE_ADMIN}
        buttonLabel="Tutorial de configuración"
      />
    </AdminLayout>
  );
}

// ─────────────────────────────────────────────────────────────
// Section router
// ─────────────────────────────────────────────────────────────

interface SectionProps {
  seccion: Seccion;
  onDirty: (d: boolean) => void;
  registerSave: (fn: () => Promise<void>) => void;
  registerDiscard: (fn: () => void) => void;
}

function SectionRenderer({ seccion, onDirty, registerSave, registerDiscard }: SectionProps) {
  const commonProps = { onDirty, registerSave, registerDiscard };
  switch (seccion) {
    case 'mi-cuenta':           return <MiCuenta {...commonProps} />;
    case 'seguridad':           return <Seguridad {...commonProps} />;
    case 'datos-institucionales': return <DatosInstitucionales {...commonProps} />;
    case 'documentos-requeridos': return <DocumentosRequeridos {...commonProps} />;
    case 'pagos':               return <Pagos {...commonProps} />;
    case 'etapas-dgb':          return <EtapasDGB {...commonProps} />;
    case 'municipios':          return <Municipios {...commonProps} />;
    case 'plantillas-correo':   return <PlantillasCorreo {...commonProps} />;
    case 'integraciones':       return <Integraciones {...commonProps} />;
    case 'bitacora':            return <Bitacora {...commonProps} />;
    case 'depuracion':          return <Depuracion />;
    case 'acerca-de':           return <AcercaDe />;
    default:                    return <MiCuenta {...commonProps} />;
  }
}
