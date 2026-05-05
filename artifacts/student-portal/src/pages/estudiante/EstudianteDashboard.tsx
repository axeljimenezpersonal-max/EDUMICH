import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import {
  BookOpen,
  FileCheck2,
  Clock,
  Bell,
  ChevronRight,
  Phone,
  Mail,
  AlertCircle,
  CheckCircle2,
  Info,
  Upload,
} from 'lucide-react';
import { EstudianteLayout } from './EstudianteLayout';
import { api, type DashboardEstudiante, type Aviso, type ContactosResponse } from '../../lib/api';

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
  }, []);

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

  // Mostrar banner si tiene menos de 4 documentos aprobados
  const mostrarBannerDocs =
    data.kpis.documentosAprobados < 4 &&
    data.kpis.documentosPendientes + data.kpis.documentosAprobados < 4;

  return (
    <EstudianteLayout>
      <div className="space-y-6">
        {/* Banner: completa tu expediente */}
        {mostrarBannerDocs && (
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
                Para que tu inscripción avance necesitas subir 4 documentos: CURP, acta de
                nacimiento, identificación oficial (INE) y comprobante de domicilio. Una vez
                subidos, la administración los validará.
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

        {/* Saludo */}
        <div>
          <h1 className="font-serif text-2xl font-bold text-stone-900">
            Hola, {primerNombre}
          </h1>
          <p className="text-stone-500 text-sm mt-0.5">
            {data.estudiante.municipio
              ? `Municipio: ${data.estudiante.municipio}`
              : data.estudiante.email}
          </p>
        </div>

        {/* Estado de inscripción + siguientes pasos */}
        <div className="bg-white border border-stone-200 rounded-md p-5">
          <div className="text-xs font-semibold uppercase tracking-widest text-stone-500 mb-3">
            Estado de tu inscripción
          </div>
          {data.inscripcionActiva ? (
            <>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <EstadoBadge estado={data.inscripcionActiva.estado} />
                <span className="text-sm text-stone-500">
                  {data.inscripcionActiva.convocatoriaNombre}
                </span>
              </div>
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
            <p className="text-stone-500 text-sm">No tienes inscripción activa.</p>
          )}
        </div>

        {/* Convocatoria + cuenta regresiva */}
        {data.inscripcionActiva && (
          <div className="bg-[var(--color-guinda-700)] text-white rounded-md p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="text-xs opacity-80 mb-1">Convocatoria activa</div>
              <div className="font-serif text-lg font-bold">
                {data.inscripcionActiva.convocatoriaNombre}
              </div>
              {data.inscripcionActiva.fechaCierre && (
                <div className="text-xs opacity-75 mt-1">
                  Cierre de inscripciones: {data.inscripcionActiva.fechaCierre}
                </div>
              )}
            </div>
            {diasExamen !== null && (
              <div className="text-center sm:text-right shrink-0">
                <div className="font-serif text-4xl font-bold">{diasExamen}</div>
                <div className="text-xs opacity-80">
                  {diasExamen === 1 ? 'día para tu examen' : 'días para tu examen'}
                </div>
              </div>
            )}
          </div>
        )}

        {/* KPI cards 2×2 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white border border-stone-200 rounded-md p-4">
            <BookOpen size={18} className="text-[var(--color-guinda-600)] mb-2" />
            <div className="font-serif text-2xl font-bold text-stone-900">
              {data.kpis.modulosAprobados}
              <span className="text-stone-400 text-base font-normal">
                /{data.kpis.modulosTotales}
              </span>
            </div>
            <div className="text-xs text-stone-500 mt-0.5">Módulos aprobados</div>
          </div>

          <div className="bg-white border border-stone-200 rounded-md p-4">
            <FileCheck2 size={18} className="text-green-600 mb-2" />
            <div className="font-serif text-2xl font-bold text-stone-900">
              {data.kpis.documentosAprobados}
            </div>
            <div className="text-xs text-stone-500 mt-0.5">Docs aprobados</div>
          </div>

          <div className="bg-white border border-stone-200 rounded-md p-4">
            <Clock size={18} className="text-amber-500 mb-2" />
            <div className="font-serif text-2xl font-bold text-stone-900">
              {data.kpis.documentosPendientes}
            </div>
            <div className="text-xs text-stone-500 mt-0.5">Docs pendientes</div>
          </div>

          <div className="bg-white border border-stone-200 rounded-md p-4">
            <Bell size={18} className="text-[var(--color-guinda-500)] mb-2" />
            <div className="font-serif text-2xl font-bold text-stone-900">
              {data.avisosNoLeidos}
            </div>
            <div className="text-xs text-stone-500 mt-0.5">Avisos sin leer</div>
          </div>
        </div>

        {/* Avisos recientes */}
        <div className="bg-white border border-stone-200 rounded-md p-5">
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
          <div className="bg-white border border-stone-200 rounded-md p-5">
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
    </EstudianteLayout>
  );
}
