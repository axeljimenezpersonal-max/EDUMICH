import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { safeUrl } from '../../lib/safeUrl';
import {
  BookOpen,
  FileCheck2,
  Clock,
  Bell,
  ChevronRight,
  Phone,
  Mail,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Upload,
  Megaphone,
  X,
  FileText,
  Award,
  Download,
  CalendarClock,
  BadgeCheck,
  MapPin,
  CalendarCheck,
  Sparkles,
  FileCheck,
} from 'lucide-react';
import { EstudianteLayout } from './EstudianteLayout';
import { AvisosCalendario } from '../../components/AvisosCalendario';
import { CalendarioOficial } from '../../components/CalendarioOficial';
import { SectionTour } from '../../components/onboarding/SectionTour';
import { TOUR_INICIO, GATE_ESTUDIANTE } from '../../components/onboarding/seccionesEstudiante';
import { api, type DashboardEstudiante, type Aviso, type ContactosResponse, type ExamenInscritoDashboard } from '../../lib/api';

interface AnuncioItem {
  id: number;
  titulo: string;
  contenido: string;
  prioridad: 'informativo' | 'importante' | 'urgente';
  ctaTexto: string | null;
  ctaUrl: string | null;
  yaVisto: boolean;
}

function diasHasta(fechaStr: string | null): number | null {
  if (!fechaStr) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fecha = new Date(fechaStr);
  fecha.setHours(0, 0, 0, 0);
  return Math.ceil((fecha.getTime() - hoy.getTime()) / 86_400_000);
}

function PrioridadBadge({ prioridad }: { prioridad: Aviso['prioridad'] }) {
  const map = {
    informativo: 'bg-blue-50 text-blue-700 border-blue-200',
    importante: 'bg-amber-50 text-amber-700 border-amber-200',
    urgente: 'bg-red-50 text-red-700 border-red-200',
  };
  const labels = { informativo: 'Informativo', importante: 'Importante', urgente: 'Urgente' };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${map[prioridad]}`}>
      {labels[prioridad]}
    </span>
  );
}

function UrgenciaIcon({ urgencia }: { urgencia: 'baja' | 'media' | 'alta' }) {
  if (urgencia === 'alta')
    return <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />;
  if (urgencia === 'media')
    return <Clock size={15} className="text-amber-500 shrink-0 mt-0.5" />;
  return <CheckCircle2 size={15} className="text-green-500 shrink-0 mt-0.5" />;
}

function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, string> = {
    pre_registro: 'bg-stone-100 text-stone-700',
    documentos_pendientes: 'bg-amber-100 text-amber-800',
    documentos_completos: 'bg-blue-100 text-blue-800',
    pago_pendiente: 'bg-orange-100 text-orange-800',
    pago_verificado: 'bg-teal-100 text-teal-800',
    ficha_generada: 'bg-purple-100 text-purple-800',
    confirmado_alumno: 'bg-green-100 text-green-800',
    registrado: 'bg-green-100 text-green-800',
    en_curso: 'bg-green-100 text-green-800',
    evaluado: 'bg-stone-100 text-stone-700',
  };
  const labels: Record<string, string> = {
    pre_registro: 'Pre-registro',
    documentos_pendientes: 'Documentos pendientes',
    documentos_completos: 'Documentos completos',
    pago_pendiente: 'Pago pendiente',
    pago_verificado: 'Pago verificado',
    ficha_generada: 'Ficha generada',
    confirmado_alumno: 'Confirmado',
    registrado: 'Registrado',
    en_curso: 'En curso',
    evaluado: 'Evaluado',
  };
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${map[estado] ?? 'bg-stone-100 text-stone-700'}`}>
      {labels[estado] ?? estado}
    </span>
  );
}

export default function EstudianteDashboard() {
  const [data, setData] = useState<DashboardEstudiante | null>(null);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [contactos, setContactos] = useState<ContactosResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [anuncios, setAnuncios] = useState<AnuncioItem[]>([]);
  const [closedAnuncioIds, setClosedAnuncioIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    Promise.all([
      api.get<DashboardEstudiante>('/estudiante/dashboard'),
      api.get<Aviso[]>('/estudiante/avisos'),
      api.get<ContactosResponse>('/estudiante/contactos'),
    ])
      .then(([d, a, c]) => {
        setData(d);
        setAvisos(a);
        setContactos(c);
      })
      .finally(() => setLoading(false));

    api
      .get<{ anuncios: AnuncioItem[] }>('/anuncios/mios')
      .then(r => setAnuncios(r.anuncios.filter(a => !a.yaVisto)))
      .catch(console.error);
  }, []);

  function cerrarAnuncio(id: number) {
    setClosedAnuncioIds(prev => new Set(prev).add(id));
    api.post(`/anuncios/${id}/cerrar`).catch(console.error);
  }

  const visibleAnuncios = anuncios.filter(a => !closedAnuncioIds.has(a.id));

  if (loading) {
    return (
      <EstudianteLayout>
        <div className="flex items-center justify-center h-64 text-stone-400">Cargando...</div>
      </EstudianteLayout>
    );
  }

  if (!data) {
    return (
      <EstudianteLayout>
        <div className="text-red-600">Error al cargar el dashboard.</div>
      </EstudianteLayout>
    );
  }

  const primerNombre = data.estudiante.nombreCompleto.split(' ')[0];
  const diasExamen = data.inscripcionActiva?.fechaExamen
    ? diasHasta(data.inscripcionActiva.fechaExamen)
    : null;
  const avisosRecientes = avisos.slice(0, 3);

  // Mostrar banner si tiene menos de 5 documentos aprobados
  const mostrarBannerDocs =
    data.kpis.documentosAprobados < 5 &&
    data.kpis.documentosPendientes + data.kpis.documentosAprobados < 5;

  // Vigencia del pre-registro
  const diasVigencia = diasHasta(data.preregistroVigenteHasta);

  // Aviso de eliminación de cuenta
  const aviso = data.avisoEliminacion;
  const mostrarBannerVigenciaRojo = data.folioPreregistro && !data.matriculaOficialDGB && diasVigencia !== null && diasVigencia <= 0;
  const mostrarBannerVigenciaAmarillo = data.folioPreregistro && !data.matriculaOficialDGB && diasVigencia !== null && diasVigencia > 0 && diasVigencia <= 3;

  // ── Fase del alumno: define un inicio distinto según dónde va en su trámite ──
  //   nuevo       → aún sin folio ni matrícula (debe subir documentos)
  //   preinscrito → tiene folio de pre-registro, espera su matrícula oficial
  //   inscrito    → ya tiene matrícula DGB (trámite consumado)
  const fase: 'nuevo' | 'preinscrito' | 'inscrito' = data.matriculaOficialDGB
    ? 'inscrito'
    : data.folioPreregistro
    ? 'preinscrito'
    : 'nuevo';
  const faseCfg = {
    nuevo:       { label: 'Registro en proceso', bg: '#f5f5f4', color: '#57534e', dot: '#a8a29e', nudge: 'Sube tus documentos para comenzar tu registro en Preparatoria Abierta.' },
    preinscrito: { label: 'Pre-registrado',       bg: '#eff6ff', color: '#1d4ed8', dot: '#3b82f6', nudge: 'Completa tu expediente para que la administración te asigne tu matrícula oficial.' },
    inscrito:    { label: 'Inscrito',              bg: '#dcfce7', color: '#15803d', dot: '#22c55e', nudge: 'Estás inscrito oficialmente. Revisa tus exámenes y prepárate para presentar.' },
  }[fase];
  // Documentos del expediente pendientes: solo relevante antes de estar inscrito.
  const mostrarExpediente = fase !== 'inscrito' && mostrarBannerDocs;

  return (
    <EstudianteLayout>
      <div className="space-y-6">
        {/* ── 1. SALUDO (siempre primero) ── */}
        <div className="overflow-hidden rounded-xl border border-stone-200/80 bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(74,14,32,0.04),0_10px_28px_-14px_rgba(74,14,32,0.12)]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-guinda-700)]">
                Portal del estudiante
              </div>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold leading-tight text-stone-900">
                Hola, {primerNombre}
              </h1>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={{ background: faseCfg.bg, color: faseCfg.color }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: faseCfg.dot }} />
                  {faseCfg.label}
                </span>
                {fase === 'inscrito' && data.matriculaOficialDGB && (
                  <span className="text-xs text-stone-400">
                    Matrícula <span className="font-mono font-semibold text-stone-600">{data.matriculaOficialDGB}</span>
                  </span>
                )}
                {fase === 'preinscrito' && data.folioPreregistro && (
                  <span className="text-xs text-stone-400">
                    Folio <span className="font-mono font-semibold text-stone-600">{data.folioPreregistro}</span>
                  </span>
                )}
                {data.estudiante.municipio && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-xs text-stone-400">
                    <MapPin size={11} /> {data.estudiante.municipio}
                  </span>
                )}
              </div>
              <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-stone-500">{faseCfg.nudge}</p>
            </div>
            <button
              onClick={() => window.dispatchEvent(new Event('edumich:start-tour'))}
              className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-stone-50"
              style={{ color: 'var(--color-guinda-700)' }}
            >
              <Sparkles size={14} /> Ver tutorial
            </button>
          </div>
        </div>

        {/* ── Fechas del calendario oficial (ventana de solicitud/pago, examen) ── */}
        <AvisosCalendario ocultarExamen />

        {/* ── Calendario oficial completo (colapsable) ── */}
        <CalendarioOficial />

        {/* ── 2. ANUNCIOS institucionales ── */}
        {visibleAnuncios.map(a => {
          const colorMap = {
            urgente:    { bg: '#fff1f2', border: '#fecdd3', text: '#be123c', icon: '#f43f5e' },
            importante: { bg: '#fffbeb', border: '#fde68a', text: '#b45309', icon: '#f59e0b' },
            informativo:{ bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', icon: '#3b82f6' },
          };
          const c = colorMap[a.prioridad];
          return (
            <div key={a.id} className="rounded-md p-4 flex items-start gap-3" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
              <Megaphone size={16} style={{ color: c.icon, flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="font-semibold text-sm" style={{ color: c.text, marginBottom: 2 }}>{a.titulo}</div>
                <p className="text-xs leading-relaxed" style={{ color: '#57504a' }}>{a.contenido}</p>
                {a.ctaTexto && a.ctaUrl && (
                  <a href={safeUrl(a.ctaUrl)} rel="noopener noreferrer" className="inline-block mt-2 text-xs font-semibold" style={{ color: c.text, textDecoration: 'underline' }}>
                    {a.ctaTexto} →
                  </a>
                )}
              </div>
              <button onClick={() => cerrarAnuncio(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a89a8e', flexShrink: 0, padding: 2 }}>
                <X size={13} />
              </button>
            </div>
          );
        })}

        {/* Banner: cuenta en riesgo de eliminación */}
        {aviso && (
          <div
            className="rounded-md p-4 flex items-start gap-3"
            style={{ background: '#fff1f2', border: '2px solid #fca5a5' }}
          >
            <AlertTriangle size={18} style={{ color: '#dc2626', flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="font-semibold text-sm" style={{ color: '#991b1b', marginBottom: 4 }}>
                ⚠ Tu cuenta será eliminada en {aviso.diasRestantes} {aviso.diasRestantes === 1 ? 'día' : 'días'}
              </div>
              <p className="text-xs leading-relaxed" style={{ color: '#7f1d1d', marginBottom: 8 }}>
                Llevas <strong>{aviso.diasInactivo} días</strong> sin subir documentos ni realizar pagos.
                Para conservar tu cuenta debes subir al menos un documento antes de que venza el plazo.
              </p>
              <Link
                href="/estudiante/expediente"
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md"
                style={{ background: '#dc2626', color: 'white', textDecoration: 'none' }}
              >
                <Upload size={13} />
                Subir documento ahora
              </Link>
            </div>
          </div>
        )}

        {/* Banner: ficha de pre-registro vencida */}
        {mostrarBannerVigenciaRojo && (
          <div
            className="rounded-md p-4 flex items-start gap-3"
            style={{ background: '#fff1f2', border: '1px solid #fca5a5' }}
          >
            <CalendarClock size={16} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="font-semibold text-sm" style={{ color: '#b91c1c', marginBottom: 2 }}>
                Tu ficha de pre-registro ha vencido
              </div>
              <p className="text-xs leading-relaxed" style={{ color: '#57504a' }}>
                Tu folio <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{data.folioPreregistro}</span> ya no es válido. Comunícate con tu gestor o con la administración para renovarlo.
              </p>
            </div>
          </div>
        )}

        {/* Banner: ficha de pre-registro por vencer */}
        {mostrarBannerVigenciaAmarillo && (
          <div
            className="rounded-md p-4 flex items-start gap-3"
            style={{ background: '#fffbeb', border: '1px solid #fde68a' }}
          >
            <CalendarClock size={16} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="font-semibold text-sm" style={{ color: '#b45309', marginBottom: 2 }}>
                Tu ficha de pre-registro vence pronto
              </div>
              <p className="text-xs leading-relaxed" style={{ color: '#57504a' }}>
                Tu folio <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{data.folioPreregistro}</span> vence en{' '}
                <strong>{diasVigencia} {diasVigencia === 1 ? 'día' : 'días'}</strong>. Descárgala antes de que expire.
              </p>
            </div>
          </div>
        )}

        {/* Fichas PDF */}
        {(data.folioPreregistro || data.matriculaOficialDGB || data.licenciaDigital) && (
          <div data-tour="dash-ficha" className="grid grid-cols-1 sm:grid-cols-3 gap-3">

            {/* ── Cédula de inscripción (ya inscrito) o Ficha de pre-registro ── */}
            {/* Una vez inscrito (con matrícula), la ficha de pre-registro ya no
                aporta: se muestra la cédula de inscripción, que sí es el
                documento oficial del alumno. */}
            {data.matriculaOficialDGB ? (
              <div style={{ background: '#fff', border: '1px solid #eadfd7', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '16px 18px 14px', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: '#f3dbe4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FileCheck size={16} style={{ color: 'var(--color-guinda-700)' }} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b635e', lineHeight: 1.3 }}>
                      Cédula de<br />inscripción
                    </span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-guinda-800)' }}>
                    Documento oficial
                  </div>
                  <div style={{ fontSize: 11, marginTop: 5, color: '#6b635e', lineHeight: 1.4 }}>
                    Tu cédula de inscripción a Preparatoria Abierta.
                  </div>
                </div>
                <div style={{ borderTop: '1px solid #f7f2ed', padding: '10px 18px' }}>
                  <a
                    href="/api/estudiante/cedula/pdf"
                    target="_blank"
                    rel="noopener"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 0', background: 'var(--color-guinda-700)', color: 'white', borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}
                  >
                    <Download size={13} /> Descargar PDF
                  </a>
                </div>
              </div>
            ) : data.folioPreregistro ? (
              <div style={{ background: '#fff', border: '1px solid #eadfd7', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '16px 18px 14px', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: '#efe7d6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FileText size={16} style={{ color: 'var(--color-guinda-700)' }} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b635e', lineHeight: 1.3 }}>
                      Ficha de<br />pre-registro
                    </span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-guinda-700)', letterSpacing: '0.03em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {data.folioPreregistro}
                  </div>
                  {data.preregistroVigenteHasta && (
                    <div style={{ fontSize: 11, marginTop: 5, color: diasVigencia !== null && diasVigencia <= 0 ? '#b91c1c' : diasVigencia !== null && diasVigencia <= 3 ? '#b45309' : '#6b635e' }}>
                      {diasVigencia !== null && diasVigencia <= 0
                        ? '⚠ Vencida'
                        : `Vigente hasta ${new Date(data.preregistroVigenteHasta + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                    </div>
                  )}
                </div>
                <div style={{ borderTop: '1px solid #f7f2ed', padding: '10px 18px' }}>
                  <a
                    href="/api/alumno/ficha-preregistro"
                    target="_blank"
                    rel="noopener"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 0', background: 'var(--color-guinda-700)', color: 'white', borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}
                  >
                    <Download size={13} /> Descargar PDF
                  </a>
                </div>
              </div>
            ) : null}

            {/* ── Matrícula ── */}
            {data.matriculaOficialDGB && (
              <div style={{ background: 'linear-gradient(160deg, #f0fdf4 0%, #ffffff 100%)', border: '1px solid #86efac', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '18px 20px 16px', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Award size={16} style={{ color: '#16a34a' }} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#15803d', lineHeight: 1.3 }}>
                      Matrícula
                    </span>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: '#15803d', letterSpacing: '0.05em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 8 }}>
                    {data.matriculaOficialDGB}
                  </div>
                  <div style={{ fontSize: 11, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 7, height: 7, borderRadius: 999, background: '#4ade80', display: 'inline-block', flexShrink: 0 }} />
                    Inscripción confirmada · SEP-DGB
                  </div>
                </div>
                <div style={{ borderTop: '1px solid #bbf7d0', padding: '12px 20px' }}>
                  <a
                    href="/api/alumno/ficha-registro"
                    target="_blank"
                    rel="noopener"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 0', background: '#16a34a', color: 'white', borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}
                  >
                    <Download size={13} /> Ficha de registro
                  </a>
                </div>
              </div>
            )}

            {/* ── Credencial / credencial digital ── */}
            {data.licenciaDigital && (
              <div style={{ background: 'linear-gradient(150deg, #7B1F3A 0%, #4a0e20 100%)', border: '1px solid #9f2d4a', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '16px 18px 14px', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <BadgeCheck size={16} style={{ color: '#fff' }} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.7)', lineHeight: 1.3 }}>
                      Identificación<br />digital
                    </span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: '#fff', letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {data.licenciaDigital}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 5 }}>
                    Emitida por IEMSyS · Preparatoria Abierta Michoacán
                  </div>
                </div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)', padding: '10px 18px' }}>
                  <Link
                    href="/estudiante/identificacion"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 0', background: 'rgba(255,255,255,0.18)', color: 'white', borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.25)' }}
                  >
                    <BadgeCheck size={13} /> Ver credencial
                  </Link>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ── 6. Estado de inscripción + siguientes pasos ── */}
        {(data.inscripcionActiva || fase !== 'nuevo') && (
          <div data-tour="dash-estado" className="bg-white border border-stone-200 rounded-xl p-5 shadow-[0_1px_2px_rgba(74,14,32,0.04),0_8px_24px_-14px_rgba(74,14,32,0.10)]">
            <div className="text-xs font-semibold uppercase tracking-widest text-stone-500 mb-3">
              Estado de tu inscripción
            </div>
            {data.inscripcionActiva ? (
              <>
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  {/* Si ya tiene matrícula DGB, la inscripción está confirmada:
                      se muestra en verde, sin el estado interno que confunde. */}
                  {data.inscripcionActiva.confirmada ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">
                      <CheckCircle2 size={14} /> Inscripción confirmada
                    </span>
                  ) : (
                    <EstadoBadge estado={data.inscripcionActiva.estado} />
                  )}
                  <span className="text-sm text-stone-500">
                    {data.inscripcionActiva.convocatoriaNombre}
                  </span>
                </div>
                {data.inscripcionActiva.confirmada && (
                  <p className="mb-3 text-sm text-stone-500">
                    Tu matrícula oficial ya fue asignada por la SEP-DGB. Tu lugar está asegurado.
                  </p>
                )}
                <ul className="space-y-2">
                  {data.siguientesPasos.slice(0, 3).map((paso, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-stone-700">
                      <UrgenciaIcon urgencia={paso.urgencia} />
                      {paso.texto}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-stone-500 text-sm">Aún no tienes una inscripción activa a convocatoria.</p>
            )}
          </div>
        )}

        {/* ── 6b. Estado de la credencial (widget de acción fijo) ── */}
        {(() => {
          const cred = data.credencial;
          if (!cred) return null;
          // Deriva estado + mensaje + acción.
          let cfg: { icon: typeof BadgeCheck; iconColor: string; ring: string; bg: string; titulo: string; texto: string; cta: string; href: string; ctaBg: string };
          if (!cred.emitida) {
            cfg = { icon: AlertCircle, iconColor: '#78716c', ring: '#e7e5e4', bg: '#fafaf9', titulo: 'Credencial aún no emitida', texto: 'Se emite al completar tu inscripción y tu expediente.', cta: 'Ir a mi expediente', href: '/estudiante/expediente', ctaBg: '#57534e' };
          } else if (cred.fotoPerdida) {
            // Hay registro de foto pero el archivo ya no está: la credencial sale sin foto.
            cfg = { icon: AlertTriangle, iconColor: '#b91c1c', ring: '#fca5a5', bg: '#fff1f2', titulo: 'No encontramos tu fotografía', texto: 'Tu credencial se está mostrando sin foto. Vuelve a subir tu fotografía en el expediente para que aparezca.', cta: 'Volver a subir mi foto', href: '/estudiante/expediente?doc=foto', ctaBg: '#dc2626' };
          } else if (cred.fotoEstado === 'aprobado') {
            cfg = { icon: BadgeCheck, iconColor: '#15803d', ring: '#bbf7d0', bg: 'linear-gradient(160deg,#f0fdf4,#ffffff)', titulo: 'Tu credencial está lista', texto: 'Emitida con tu fotografía oficial. Ya puedes descargarla y usarla.', cta: 'Ver mi credencial', href: '/estudiante/identificacion', ctaBg: '#16a34a' };
          } else if (cred.fotoEstado === 'pendiente_revision') {
            cfg = { icon: Clock, iconColor: '#b45309', ring: '#fde68a', bg: '#fffbeb', titulo: 'Tu fotografía está en revisión', texto: 'La administración está validando tu foto. En cuanto se apruebe aparecerá en tu credencial.', cta: 'Ver mi fotografía', href: '/estudiante/expediente?doc=foto', ctaBg: '#b45309' };
          } else if (cred.fotoEstado === 'rechazado') {
            cfg = { icon: AlertTriangle, iconColor: '#b91c1c', ring: '#fca5a5', bg: '#fff1f2', titulo: 'Tu fotografía fue rechazada', texto: 'Súbela de nuevo para completar tu credencial con tu foto oficial.', cta: 'Volver a subir mi foto', href: '/estudiante/expediente?doc=foto', ctaBg: '#dc2626' };
          } else {
            cfg = { icon: Upload, iconColor: '#b45309', ring: '#fde68a', bg: 'linear-gradient(160deg,#fffbeb,#ffffff)', titulo: 'Falta tu fotografía', texto: 'Tu credencial está emitida pero aún sin foto. Súbela en tu expediente para completarla.', cta: 'Subir mi fotografía', href: '/estudiante/expediente?doc=foto', ctaBg: 'var(--color-guinda-700)' };
          }
          const Icon = cfg.icon;
          return (
            <div className="overflow-hidden rounded-xl border border-stone-200/80 shadow-[0_1px_2px_rgba(74,14,32,0.04),0_8px_24px_-14px_rgba(74,14,32,0.10)]" style={{ background: cfg.bg }}>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-5">
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white" style={{ boxShadow: `0 0 0 2px ${cfg.ring}` }}>
                    <Icon size={20} style={{ color: cfg.iconColor }} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-0.5">Estado de tu credencial</div>
                    <div className="font-semibold text-stone-900">{cfg.titulo}</div>
                    <p className="mt-0.5 text-sm leading-relaxed text-stone-500">{cfg.texto}</p>
                  </div>
                </div>
                <Link
                  href={cfg.href}
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: cfg.ctaBg }}
                >
                  {cfg.cta} <ChevronRight size={15} />
                </Link>
              </div>
            </div>
          );
        })()}

        {/* ── 7. Etapa activa: DOS fechas + cuenta regresiva inteligente ── */}
        {data.etapaActiva ? (() => {
          const ea = data.etapaActiva!;
          const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
          const parse = (s: string | null) => (s ? new Date(s + 'T00:00:00') : null);
          const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
          const dias = (d: Date | null) => (d ? Math.ceil((d.getTime() - hoy.getTime()) / 86400000) : null);
          const dd = (d: Date) => d.getDate();
          const rango = (a: string | null, b: string | null) => {
            const da = parse(a), db2 = parse(b);
            if (!da || !db2) return '—';
            return da.getMonth() === db2.getMonth()
              ? `${dd(da)}–${dd(db2)} ${MESES[db2.getMonth()]}`
              : `${dd(da)} ${MESES[da.getMonth()]} – ${dd(db2)} ${MESES[db2.getMonth()]}`;
          };
          const sf = parse(ea.solicitudFin);
          const ex = parse(ea.examenSabado);
          // Antes de pagar (dentro de ventana) → cuenta al cierre de pago; ya pagado → al examen.
          const enVentanaPago = !ea.todosPagados && sf !== null && (dias(sf) ?? -1) >= 0;
          const targetDias = enVentanaPago ? dias(sf) : dias(ex);
          const cdLabel = enVentanaPago ? (targetDias === 1 ? 'día para pagar' : 'días para pagar') : (targetDias === 1 ? 'día para tu examen' : 'días para tu examen');
          const urgente = enVentanaPago; // pagar apremia más
          const porPagar = ea.totalExamenes - ea.pagados;
          return (
            <div className="bg-[var(--color-guinda-700)] text-white rounded-xl p-5 shadow-[0_10px_28px_-14px_rgba(74,14,32,0.5)]">
              {/* Encabezado: título claro + estado de pago */}
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-white/70">Tu próximo examen</div>
                {ea.todosPagados ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/15">
                    <CheckCircle2 size={12} /> Examen pagado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(251,191,36,0.22)', color: '#fde68a' }}>
                    <AlertTriangle size={12} /> Falta pagar {porPagar}
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-serif text-2xl font-bold uppercase leading-tight">Convocatoria {ea.clave}</div>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2.5">
                      <CalendarCheck size={18} className="shrink-0 text-white/80" />
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-white/60">Presentación del examen</div>
                        <div className="text-base font-bold">{rango(ea.examenSabado, ea.examenDomingo)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <CalendarClock size={15} className="shrink-0 text-white/60" />
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-white/60">Solicitud y pago</div>
                        <div className="text-sm font-semibold text-white/90">{rango(ea.solicitudInicio, ea.solicitudFin)}</div>
                      </div>
                    </div>
                  </div>
                </div>
                {targetDias !== null && targetDias >= 0 && (
                  <div className="text-center shrink-0 rounded-2xl px-6 py-3.5 bg-white/12">
                    <div className="font-serif text-5xl font-bold leading-none">{targetDias}</div>
                    <div className="text-[11px] text-white/80 mt-1.5 max-w-[120px]">{cdLabel}</div>
                    {enVentanaPago && sf && (
                      <div className="text-[10px] text-white/60 mt-1">cierra {dd(sf)} {MESES[sf.getMonth()]}</div>
                    )}
                  </div>
                )}
              </div>

              {enVentanaPago && porPagar > 0 ? (
                <Link href="/estudiante/pagos" className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/25 transition-colors">
                  <Upload size={13} /> Pagar mis exámenes ({porPagar} por pagar) <ChevronRight size={13} />
                </Link>
              ) : ea.todosPagados ? (
                <div className="mt-4 flex items-center gap-1.5 text-xs text-white/75">
                  <CheckCircle2 size={13} className="shrink-0" /> Ya está pagado. Solo preséntate el día del examen con tu credencial.
                </div>
              ) : null}
            </div>
          );
        })() : data.inscripcionActiva && diasExamen !== null && (
          <div className="bg-[var(--color-guinda-700)] text-white rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-[0_10px_28px_-14px_rgba(74,14,32,0.5)]">
            <div>
              <div className="text-xs opacity-80 mb-1">Convocatoria activa</div>
              <div className="font-serif text-lg font-bold">{data.inscripcionActiva.convocatoriaNombre}</div>
            </div>
            <div className="text-center sm:text-right shrink-0">
              <div className="font-serif text-4xl font-bold">{diasExamen}</div>
              <div className="text-xs opacity-80">{diasExamen === 1 ? 'día para tu examen' : 'días para tu examen'}</div>
            </div>
          </div>
        )}

        {/* ── 8. Módulos inscritos en convocatoria ── */}
        {data.examenesInscritos && data.examenesInscritos.length > 0 && (
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarCheck size={15} className="text-[var(--color-guinda-700)]" />
                <span className="text-xs font-semibold uppercase tracking-widest text-stone-500">
                  Mis exámenes inscritos
                </span>
              </div>
              <Link
                href="/estudiante/convocatoria"
                className="text-xs text-[var(--color-guinda-700)] hover:underline flex items-center gap-1"
              >
                Ver detalle <ChevronRight size={12} />
              </Link>
            </div>

            {/* Etapa / convocatoria */}
            <div className="px-5 py-3 bg-[var(--color-crema-100)] border-b border-stone-100">
              <span className="text-xs text-stone-500">Convocatoria: </span>
              <span className="text-xs font-semibold text-stone-700">
                {data.examenesInscritos[0].etapaClave}
              </span>
            </div>

            <div className="divide-y divide-stone-100">
              {data.examenesInscritos.map((ex) => {
                const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
                let fechaStr = '—';
                if (ex.fechaExamen) {
                  const [y, m, d] = ex.fechaExamen.split('-').map(Number);
                  fechaStr = `${d} ${MESES[m - 1]} ${y}`;
                }
                // Inscripción y pago SIEMPRE relacionados: un examen inscrito sin
                // pago consumado está "pre-inscrito" (ámbar); con pago va en verde.
                // "Calificación en proceso": ya presentó (examen pagado y su fecha
                // pasó) pero aún no hay calificación (~4-5 días después del examen).
                const hoyStr = new Date().toISOString().slice(0, 10);
                const examPasado = !!ex.fechaExamen && ex.fechaExamen < hoyStr;
                const yaPresento = ex.pagado || ex.estado === 'pase_validado' || ex.estado === 'pase_descargado';
                let badgeCls = 'bg-stone-100 text-stone-600';
                let badgeLabel = ex.estado;
                if (ex.estado === 'cancelado') {
                  badgeCls = 'bg-stone-100 text-stone-500'; badgeLabel = 'Cancelado';
                } else if (ex.estado === 'aprobado') {
                  badgeCls = 'bg-emerald-50 text-emerald-700'; badgeLabel = 'Aprobado';
                } else if (ex.estado === 'reprobado') {
                  badgeCls = 'bg-red-50 text-red-700'; badgeLabel = 'No aprobado';
                } else if (examPasado && yaPresento) {
                  badgeCls = 'bg-indigo-50 text-indigo-700'; badgeLabel = 'Calificación en proceso';
                } else if (ex.estado === 'pase_validado') {
                  badgeCls = 'bg-green-50 text-green-700'; badgeLabel = 'Validado en sede';
                } else if (ex.estado === 'pase_descargado') {
                  badgeCls = 'bg-sky-50 text-sky-700'; badgeLabel = 'Pase descargado';
                } else if (ex.pagado) {
                  badgeCls = 'bg-green-50 text-green-700'; badgeLabel = 'Inscrito';
                } else {
                  badgeCls = 'bg-amber-50 text-amber-700'; badgeLabel = 'Pre-inscrito · falta pago';
                }
                return (
                  <Link key={ex.id} href={`/estudiante/convocatoria/pase/${ex.id}`}>
                    <div className="px-3 sm:px-5 py-3 sm:py-3.5 flex items-center gap-3 sm:gap-4 hover:bg-stone-50 transition-colors cursor-pointer">
                      {/* Número módulo */}
                      <div className="w-9 h-9 rounded-lg bg-[var(--color-guinda-50)] flex items-center justify-center flex-shrink-0 border border-[var(--color-guinda-100)]">
                        <span className="text-xs font-bold text-[var(--color-guinda-700)]">M{ex.moduloNumero}</span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-stone-900 truncate">{ex.moduloNombre}</div>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          <span className="text-xs text-stone-500 flex items-center gap-1">
                            <Clock size={10} />
                            {ex.hora} hrs · {ex.dia === 'sabado' ? 'Sábado' : 'Domingo'} {fechaStr}
                          </span>
                          <span className="hidden sm:flex items-center gap-1 text-xs text-stone-500">
                            <MapPin size={10} />
                            {ex.sedeNombre}
                          </span>
                        </div>
                      </div>

                      {/* Estado */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${badgeCls}`}>
                          {badgeLabel}
                        </span>
                        <ChevronRight size={13} className="text-stone-300" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Banner: completa tu expediente (solo antes de estar inscrito) */}
        {mostrarExpediente && (
          <div
            className="rounded-md p-4 flex flex-col sm:flex-row sm:items-start gap-3"
            style={{
              background: 'linear-gradient(135deg, #fef9c3 0%, #fde68a 100%)',
              border: '1px solid #fbbf24',
            }}
          >
            <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-amber-900 text-sm">
                Completa tu expediente
              </div>
              <p className="text-amber-800 text-xs mt-0.5 leading-relaxed">
                Para que tu inscripción avance necesitas subir 5 documentos: CURP, acta de
                nacimiento, identificación oficial (INE), comprobante de domicilio y certificado
                de secundaria. Una vez subidos, la administración los validará.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Link
                  href="/estudiante/expediente"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold bg-amber-700 text-white px-3 py-1.5 rounded-md hover:bg-amber-800 transition-colors"
                >
                  <Upload size={13} />
                  Subir mis documentos
                </Link>
                <Link
                  href="/estudiante/convocatoria"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white border border-amber-400 text-amber-800 px-3 py-1.5 rounded-md hover:bg-amber-50 transition-colors"
                >
                  Ver fechas importantes
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* KPI cards 2×2 — cada tarjeta lleva a su sección */}
        <div data-tour="dash-kpis" className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Link
            href="/estudiante/calificaciones"
            className="group bg-white border border-stone-200 rounded-xl p-4 shadow-[0_1px_2px_rgba(74,14,32,0.03)] transition-all hover:border-[var(--color-guinda-300)] hover:shadow-md"
          >
            <div className="flex items-center justify-between mb-2">
              <BookOpen size={18} className="text-[var(--color-guinda-600)]" />
              <ChevronRight size={15} className="text-stone-300 group-hover:text-[var(--color-guinda-500)] transition-colors" />
            </div>
            <div className="font-serif text-2xl font-bold text-stone-900">
              {data.kpis.modulosAprobados}
              <span className="text-stone-400 text-base font-normal">
                /{data.kpis.modulosTotales}
              </span>
            </div>
            <div className="text-xs text-stone-500 mt-0.5">Módulos aprobados</div>
          </Link>

          <Link
            href="/estudiante/expediente"
            className="group bg-white border border-stone-200 rounded-xl p-4 shadow-[0_1px_2px_rgba(74,14,32,0.03)] transition-all hover:border-green-300 hover:shadow-md"
          >
            <div className="flex items-center justify-between mb-2">
              <FileCheck2 size={18} className="text-green-600" />
              <ChevronRight size={15} className="text-stone-300 group-hover:text-green-500 transition-colors" />
            </div>
            <div className="font-serif text-2xl font-bold text-stone-900">
              {data.kpis.documentosAprobados}
            </div>
            <div className="text-xs text-stone-500 mt-0.5">Docs aprobados</div>
          </Link>

          <Link
            href="/estudiante/expediente"
            className="group bg-white border border-stone-200 rounded-xl p-4 shadow-[0_1px_2px_rgba(74,14,32,0.03)] transition-all hover:border-amber-300 hover:shadow-md"
          >
            <div className="flex items-center justify-between mb-2">
              <Clock size={18} className="text-amber-500" />
              <ChevronRight size={15} className="text-stone-300 group-hover:text-amber-500 transition-colors" />
            </div>
            <div className="font-serif text-2xl font-bold text-stone-900">
              {data.kpis.documentosPendientes}
            </div>
            <div className="text-xs text-stone-500 mt-0.5">Docs pendientes</div>
          </Link>

          <Link
            href="/estudiante/avisos"
            className="group bg-white border border-stone-200 rounded-xl p-4 shadow-[0_1px_2px_rgba(74,14,32,0.03)] transition-all hover:border-[var(--color-guinda-300)] hover:shadow-md"
          >
            <div className="flex items-center justify-between mb-2">
              <Bell size={18} className="text-[var(--color-guinda-500)]" />
              <ChevronRight size={15} className="text-stone-300 group-hover:text-[var(--color-guinda-500)] transition-colors" />
            </div>
            <div className="font-serif text-2xl font-bold text-stone-900">
              {data.avisosNoLeidos}
            </div>
            <div className="text-xs text-stone-500 mt-0.5">Avisos sin leer</div>
          </Link>
        </div>

        {/* Avisos recientes */}
        <div data-tour="dash-avisos" className="bg-white border border-stone-200 rounded-md p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-stone-500">
              Avisos importantes
            </div>
            <Link
              href="/estudiante/avisos"
              className="text-xs text-[var(--color-guinda-700)] hover:underline flex items-center gap-1"
            >
              Ver todos <ChevronRight size={13} />
            </Link>
          </div>

          {avisosRecientes.length === 0 ? (
            <p className="text-stone-400 text-sm">No hay avisos activos.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {avisosRecientes.map((aviso) => (
                <li key={aviso.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <PrioridadBadge prioridad={aviso.prioridad} />
                        {!aviso.leido && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-guinda-600)] shrink-0" />
                        )}
                      </div>
                      <div className="font-medium text-sm text-stone-900">{aviso.titulo}</div>
                      <div className="text-xs text-stone-500 mt-0.5 line-clamp-2">
                        {aviso.contenido}
                      </div>
                    </div>
                    <div className="text-[10px] text-stone-400 shrink-0 mt-0.5">
                      {new Date(aviso.publicadoEn).toLocaleDateString('es-MX', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Contactos */}
        {(contactos?.gestor || contactos?.admin) && (
          <div data-tour="dash-ayuda" className="bg-white border border-stone-200 rounded-md p-5">
            <div className="flex items-center gap-2 mb-4">
              <Info size={15} className="text-[var(--color-guinda-600)]" />
              <div className="text-xs font-semibold uppercase tracking-widest text-stone-500">
                ¿Necesitas ayuda?
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {contactos.gestor && (
                <div className="border border-stone-100 rounded-md p-4 bg-stone-50">
                  <div className="text-[10px] uppercase tracking-widest text-stone-400 mb-1">
                    Tu gestor municipal
                  </div>
                  <div className="font-medium text-stone-900 text-sm">
                    {contactos.gestor.nombreCompleto}
                  </div>
                  {contactos.gestor.municipio && (
                    <div className="text-xs text-stone-500">{contactos.gestor.municipio}</div>
                  )}
                  <div className="mt-2 space-y-1">
                    {contactos.gestor.telefonoPublico && (
                      <div className="flex items-center gap-1.5 text-xs text-stone-600">
                        <Phone size={12} />
                        {contactos.gestor.telefonoPublico}
                      </div>
                    )}
                    {contactos.gestor.emailPublico && (
                      <div className="flex items-center gap-1.5 text-xs text-stone-600">
                        <Mail size={12} />
                        {contactos.gestor.emailPublico}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {contactos.admin && (
                <div className="border border-stone-100 rounded-md p-4 bg-stone-50">
                  <div className="text-[10px] uppercase tracking-widest text-stone-400 mb-1">
                    Administración
                  </div>
                  <div className="font-medium text-stone-900 text-sm">
                    {contactos.admin.nombreCompleto}
                  </div>
                  {contactos.admin.puesto && (
                    <div className="text-xs text-stone-500">{contactos.admin.puesto}</div>
                  )}
                  <div className="mt-2 space-y-1">
                    {contactos.admin.telefonoPublico && (
                      <div className="flex items-center gap-1.5 text-xs text-stone-600">
                        <Phone size={12} />
                        {contactos.admin.telefonoPublico}
                      </div>
                    )}
                    {contactos.admin.emailPublico && (
                      <div className="flex items-center gap-1.5 text-xs text-stone-600">
                        <Mail size={12} />
                        {contactos.admin.emailPublico}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <SectionTour
        steps={TOUR_INICIO}
        storageKey="edumich_sec_inicio_v1"
        gateKey={GATE_ESTUDIANTE}
        buttonLabel="Tutorial de Inicio"
      />
    </EstudianteLayout>
  );
}
