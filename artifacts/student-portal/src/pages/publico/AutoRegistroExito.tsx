import { useLocation } from 'wouter';
import { CheckCircle2, ChevronRight } from 'lucide-react';
import { AutoRegistroLayout } from './AutoRegistroLayout';

export default function AutoRegistroExito() {
  const [, setLocation] = useLocation();
  const email = sessionStorage.getItem('reg_email') ?? '';

  function irAlDashboard() {
    // Limpiamos el sessionStorage de registro
    sessionStorage.removeItem('reg_email');
    sessionStorage.removeItem('reg_codigo_dev');
    sessionStorage.removeItem('reg_modo');
    sessionStorage.removeItem('reg_token');
    setLocation('/estudiante');
  }

  return (
    <AutoRegistroLayout>
      <div className="text-center">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 size={44} className="text-green-600" />
          </div>
        </div>

        <h1 className="font-serif text-3xl font-bold text-stone-900 mb-2">
          ¡Cuenta creada!
        </h1>
        <p className="text-stone-500 mb-8">
          Tu cuenta de estudiante fue creada exitosamente.
        </p>

        {/* Credenciales */}
        <div className="bg-white border border-stone-200 rounded-md p-5 text-left mb-6">
          <div className="text-xs font-semibold uppercase tracking-widest text-stone-500 mb-3">
            Tus datos de acceso
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-stone-500">Correo</dt>
              <dd className="whitespace-nowrap font-medium text-stone-900 text-right">{email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-stone-500">Contraseña</dt>
              <dd className="font-medium text-stone-900">La que tú elegiste</dd>
            </div>
          </dl>
        </div>

        {/* Próximos pasos */}
        <div className="bg-[var(--color-crema-100)] border border-stone-200 rounded-md p-5 text-left mb-6">
          <div className="text-xs font-semibold uppercase tracking-widest text-stone-500 mb-3">
            ¿Qué sigue?
          </div>
          <ul className="space-y-2 text-sm text-stone-700">
            {[
              'Tu cuenta está activa y puedes acceder ahora.',
              'Sube tus 5 documentos desde el panel (CURP, acta, INE, domicilio, certificado de secundaria).',
              'La administración los revisará y validará en días hábiles.',
              'Cuando todo esté aprobado, recibirás confirmación de tu inscripción.',
            ].map((paso, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-[var(--color-guinda-700)] text-white text-[10px] flex items-center justify-center shrink-0 mt-0.5 font-bold">
                  {i + 1}
                </span>
                {paso}
              </li>
            ))}
          </ul>
        </div>

        <button
          onClick={irAlDashboard}
          className="gov-btn-primary w-full flex items-center justify-center gap-2"
        >
          Ir a mi panel
          <ChevronRight size={18} />
        </button>
      </div>
    </AutoRegistroLayout>
  );
}
