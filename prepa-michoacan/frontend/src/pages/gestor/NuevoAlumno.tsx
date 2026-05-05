/**
 * Formulario de alta de nuevo alumno.
 *
 * Ubicación destino: artifacts/student-portal/src/pages/gestor/NuevoAlumno.tsx
 */

import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, UserPlus, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { GestorLayout } from './GestorLayout';
import { api, type Convocatoria } from '../../lib/api';

export default function NuevoAlumno() {
  const [, setLocation] = useLocation();
  const [conv, setConv] = useState<Convocatoria | null>(null);
  const [form, setForm] = useState({
    nombreCompleto: '',
    curp: '',
    email: '',
    telefono: '',
    fechaNacimiento: '',
    direccion: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creado, setCreado] = useState<{
    nombreCompleto: string;
    email: string;
    credencialTemporal: string;
    userId: number;
  } | null>(null);

  useEffect(() => {
    api
      .get<{ convocatoria: Convocatoria | null }>('/gestor/convocatoria-activa')
      .then((r) => setConv(r.convocatoria));
  }, []);

  function update<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!conv) {
      setError('No hay convocatoria activa');
      return;
    }
    if (form.curp.length !== 18) {
      setError('La CURP debe tener exactamente 18 caracteres');
      return;
    }
    setLoading(true);
    try {
      const r = await api.post<{
        alumno: { userId: number; nombreCompleto: string; email: string };
        credencialTemporal: string;
      }>('/gestor/alumnos', {
        ...form,
        curp: form.curp.toUpperCase(),
        convocatoriaId: conv.id,
      });
      setCreado({
        userId: r.alumno.userId,
        nombreCompleto: r.alumno.nombreCompleto,
        email: r.alumno.email,
        credencialTemporal: r.credencialTemporal,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (creado) {
    return (
      <GestorLayout>
        <button
          onClick={() => setLocation('/gestor/alumnos')}
          className="text-sm text-stone-600 hover:text-[var(--color-guinda-700)] inline-flex items-center gap-1.5 mb-6"
        >
          <ArrowLeft size={14} />
          Volver a mis alumnos
        </button>

        <div className="bg-white border border-stone-200 rounded-md p-8 max-w-xl">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center text-green-700 mb-4">
            <CheckCircle2 size={24} />
          </div>
          <h1 className="font-serif text-2xl font-bold text-stone-900 mb-2">
            Alumno registrado correctamente
          </h1>
          <p className="text-stone-600 mb-6">
            <strong>{creado.nombreCompleto}</strong> ha sido registrado y vinculado a la
            convocatoria activa. Comparte sus credenciales para que pueda acceder al portal del
            estudiante.
          </p>

          <div className="bg-[var(--color-crema-100)] border border-stone-200 rounded-md p-4 mb-6">
            <div className="text-xs uppercase tracking-widest text-stone-500 font-semibold mb-2">
              Credenciales temporales
            </div>
            <div className="space-y-1 text-sm font-mono">
              <div>
                <span className="text-stone-500">Correo:</span>{' '}
                <span className="text-stone-900">{creado.email}</span>
              </div>
              <div>
                <span className="text-stone-500">Contraseña:</span>{' '}
                <span className="text-stone-900">{creado.credencialTemporal}</span>
              </div>
            </div>
            <div className="text-xs text-stone-500 mt-2">
              El alumno deberá cambiarla en su primer ingreso.
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setLocation(`/gestor/alumnos/${creado.userId}`)}
              className="gov-btn-primary"
            >
              Subir documentos ahora
            </button>
            <button
              onClick={() => {
                setCreado(null);
                setForm({
                  nombreCompleto: '',
                  curp: '',
                  email: '',
                  telefono: '',
                  fechaNacimiento: '',
                  direccion: '',
                });
              }}
              className="gov-btn-secondary"
            >
              Registrar otro alumno
            </button>
          </div>
        </div>
      </GestorLayout>
    );
  }

  return (
    <GestorLayout>
      <button
        onClick={() => setLocation('/gestor/alumnos')}
        className="text-sm text-stone-600 hover:text-[var(--color-guinda-700)] inline-flex items-center gap-1.5 mb-4"
      >
        <ArrowLeft size={14} />
        Volver a mis alumnos
      </button>

      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[var(--color-guinda-700)] font-semibold mb-1">
        <UserPlus size={12} />
        Nuevo alumno
      </div>
      <h1 className="font-serif text-3xl font-bold text-stone-900 mb-1">
        Registrar nuevo alumno
      </h1>
      <p className="text-stone-600 mb-6">
        Captura los datos del alumno. Será inscrito automáticamente a la convocatoria activa.
      </p>

      {conv && (
        <div className="bg-[var(--color-crema-100)] border border-stone-200 rounded-md px-4 py-3 mb-6 text-sm flex items-center gap-2">
          <span className="text-stone-500 uppercase tracking-widest text-xs font-semibold">
            Inscripción a:
          </span>
          <strong className="text-stone-800">{conv.nombre}</strong>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-stone-200 rounded-md p-6 max-w-3xl space-y-5"
      >
        <div>
          <label className="gov-label" htmlFor="nombre">
            Nombre completo <span className="text-red-600">*</span>
          </label>
          <input
            id="nombre"
            required
            value={form.nombreCompleto}
            onChange={(e) => update('nombreCompleto', e.target.value)}
            className="gov-input"
            placeholder="Ej. Ana María González Pérez"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="gov-label" htmlFor="curp">
              CURP <span className="text-red-600">*</span>
            </label>
            <input
              id="curp"
              required
              maxLength={18}
              value={form.curp}
              onChange={(e) => update('curp', e.target.value.toUpperCase())}
              className="gov-input font-mono uppercase"
              placeholder="GOPA950315MMNNRN09"
            />
            <div className="text-xs text-stone-500 mt-1">18 caracteres exactos</div>
          </div>
          <div>
            <label className="gov-label" htmlFor="fnac">
              Fecha de nacimiento
            </label>
            <input
              id="fnac"
              type="date"
              value={form.fechaNacimiento}
              onChange={(e) => update('fechaNacimiento', e.target.value)}
              className="gov-input"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="gov-label" htmlFor="email">
              Correo electrónico <span className="text-red-600">*</span>
            </label>
            <input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              className="gov-input"
              placeholder="alumno@correo.com"
            />
          </div>
          <div>
            <label className="gov-label" htmlFor="tel">
              Teléfono
            </label>
            <input
              id="tel"
              value={form.telefono}
              onChange={(e) => update('telefono', e.target.value)}
              className="gov-input"
              placeholder="434-123-4567"
            />
          </div>
        </div>

        <div>
          <label className="gov-label" htmlFor="dir">
            Dirección
          </label>
          <textarea
            id="dir"
            rows={2}
            value={form.direccion}
            onChange={(e) => update('direccion', e.target.value)}
            className="gov-input"
            placeholder="Calle, número, colonia..."
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading || !conv}
            className="gov-btn-primary inline-flex items-center gap-2 disabled:opacity-60"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : <UserPlus size={16} />}
            {loading ? 'Registrando...' : 'Registrar alumno'}
          </button>
          <button
            type="button"
            onClick={() => setLocation('/gestor/alumnos')}
            className="gov-btn-secondary"
          >
            Cancelar
          </button>
        </div>
      </form>
    </GestorLayout>
  );
}
