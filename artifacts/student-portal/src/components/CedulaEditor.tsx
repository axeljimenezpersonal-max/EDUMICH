import { useEffect, useState, type ReactNode } from 'react';
import { Lock, Pencil, Copy, AlertCircle, CheckCircle2, Loader2, Download, RefreshCw, PenLine } from 'lucide-react';
import { api, type CedulaDatos, type CedulaDatosEditable } from '../lib/api';
import { useBloqueoEdicion } from '../lib/useBloqueoEdicion';
import { CampoCopiable } from './CampoCopiable';
import FirmaPad from './FirmaPad';
import AvisoBloqueo from './AvisoBloqueo';

/**
 * Editor de cédula reutilizable (lectura por defecto + edición + preview +
 * descarga). Se parametriza con `basePath` (ej. "/admin/alumnos/123" o
 * "/gestor/alumnos/123"): pega a `${basePath}/cedula` y descarga
 * `/api${basePath}/cedula/pdf`. `firmaSlot` permite inyectar contenido extra;
 * `mostrarFirmaResponsable` muestra el pad de firma del responsable (admin) que
 * se estampa en la cédula del alumno.
 */
/**
 * Vista de la firma del responsable para quien NO puede firmar (admin
 * operativo): informa el estado real y a quién pedírsela, en vez de ofrecer un
 * pad que no serviría — su firma nunca se estampa como responsable.
 */
function FirmaResponsableSoloLectura({ nombre, registrada }: { nombre: string; registrada: boolean }) {
  return (
    <>
      <p className="text-xs text-stone-500 mb-3">
        Firmar como responsable es facultad de la persona titular. Tú puedes consultarla y descargar
        la cédula, pero no registrarla ni cambiarla.
      </p>
      <div
        className="flex items-start gap-3 rounded-xl border p-3.5"
        style={
          registrada
            ? { background: '#f0fdf4', borderColor: '#bbf7d0' }
            : { background: '#fffbeb', borderColor: '#fde68a' }
        }
      >
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={registrada ? { background: '#dcfce7', color: '#15803d' } : { background: '#fef3c7', color: '#b45309' }}
        >
          {registrada ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
        </div>
        <div className="min-w-0 text-xs leading-relaxed">
          {registrada ? (
            <>
              <div className="text-sm font-bold text-stone-900">Firma registrada</div>
              <p className="mt-0.5 text-stone-600">
                La cédula se estampa con la firma de <strong className="text-stone-800">{nombre}</strong>, la
                persona titular. Puedes verla en la vista previa de la derecha.
              </p>
            </>
          ) : (
            <>
              <div className="text-sm font-bold text-stone-900">Falta la firma del responsable</div>
              <p className="mt-0.5 text-stone-600">
                La cédula se generará <strong className="text-stone-800">sin firma</strong>. Pídele por favor a{' '}
                <strong className="text-stone-800">{nombre}</strong> que entre a su cuenta y la registre.
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}

const EDITABLES: (keyof CedulaDatosEditable)[] = [
  'apellidoPaterno', 'apellidoMaterno', 'nombres', 'sexo', 'estadoCivil',
  'lugarNacimiento', 'entidadNacimiento', 'calleNumero', 'colonia', 'cp',
  'ciudad', 'estado', 'ultimoEstudio',
];
const LABELS: Record<keyof CedulaDatosEditable, string> = {
  apellidoPaterno: 'Apellido paterno', apellidoMaterno: 'Apellido materno',
  nombres: 'Nombre(s)', sexo: 'Sexo', estadoCivil: 'Estado civil',
  lugarNacimiento: 'Lugar de nacimiento', entidadNacimiento: 'Entidad donde nació',
  calleNumero: 'Calle y número', colonia: 'Colonia', cp: 'Código postal',
  ciudad: 'Ciudad', estado: 'Estado', ultimoEstudio: 'Último estudio realizado',
  observaciones: 'Observaciones',
};

export function CedulaEditor({
  basePath,
  firmaSlot,
  mostrarFirmaResponsable,
  puedeFirmar = true,
}: {
  basePath: string;
  firmaSlot?: ReactNode;
  mostrarFirmaResponsable?: boolean;
  /**
   * Si la firma del responsable se puede REGISTRAR o solo consultar. Firmar como
   * responsable es facultad de la titular (jefa): un admin operativo la ve, pero
   * no la dibuja ni la borra. El backend ya lo respalda — la cédula siempre toma
   * la firma de un admin jefe, sin importar quién la genere.
   */
  puedeFirmar?: boolean;
}) {
  const [datos, setDatos] = useState<CedulaDatos | null>(null);
  const [form, setForm] = useState<CedulaDatosEditable | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [reintentando, setReintentando] = useState(false);

  // ── Candado de edición concurrente ───────────────────────────────────────
  // Dos personas (gestor y admin, o dos admins) pueden abrir la misma cédula.
  // Mientras una edita, la otra queda en solo lectura. La clave del recurso es
  // el id del alumno que va en `basePath` (…/alumnos/123): mismo alumno = mismo
  // candado, sin importar por qué panel se entre.
  const alumnoId = basePath.match(/(\d+)(?!.*\d)/)?.[1] ?? null;
  const recurso = alumnoId ? `alumno:${alumnoId}` : null;
  const { estado: estadoBloqueo, titular, reintentar } = useBloqueoEdicion(recurso, editing);
  const gateActivo = recurso !== null;
  // Solo mostramos el formulario cuando el candado es nuestro (o no hay gate).
  const editandoForm = editing && (!gateActivo || estadoBloqueo === 'propio');
  const bloqueadoPorOtro = editing && gateActivo && estadoBloqueo === 'ajeno';
  const verificandoCandado = editing && gateActivo && estadoBloqueo !== 'propio' && estadoBloqueo !== 'ajeno';

  async function intentarReintentar() {
    setReintentando(true);
    await reintentar();
    setReintentando(false);
  }

  function cargar() {
    return api
      .get<CedulaDatos>(`${basePath}/cedula`)
      .then((d) => {
        setDatos(d);
        setForm({
          apellidoPaterno: d.apellidoPaterno, apellidoMaterno: d.apellidoMaterno,
          nombres: d.nombres, sexo: d.sexo, estadoCivil: d.estadoCivil,
          lugarNacimiento: d.lugarNacimiento, entidadNacimiento: d.entidadNacimiento,
          calleNumero: d.calleNumero, colonia: d.colonia, cp: d.cp,
          ciudad: d.ciudad, estado: d.estado, ultimoEstudio: d.ultimoEstudio,
          observaciones: d.observaciones,
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error al cargar'));
  }

  useEffect(() => {
    cargar().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basePath]);

  async function guardar() {
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      await api.patch(`${basePath}/cedula`, form);
      await cargar();
      setPreviewKey((k) => k + 1);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    'w-full border border-stone-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-guinda-700)] focus:border-transparent';

  if (loading) return <div className="text-center text-stone-400 py-12 text-sm">Cargando cédula…</div>;
  if (!datos || !form) return <div className="text-center text-stone-400 py-12 text-sm">Sin datos.</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-5">
        {!editandoForm ? (
          <div className="bg-white border border-stone-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-serif text-base font-bold text-stone-900 flex items-center gap-2">
                <Lock size={15} className="text-stone-400" /> Datos de la cédula
              </h3>
              <button
                onClick={() => setEditing(true)}
                disabled={verificandoCandado}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--color-guinda-700)] text-white hover:bg-[var(--color-guinda-800)] transition-colors disabled:opacity-50"
              >
                {verificandoCandado ? <Loader2 size={13} className="animate-spin" /> : <Pencil size={13} />}
                {verificandoCandado ? 'Abriendo…' : 'Editar cédula'}
              </button>
            </div>
            <p className="text-xs text-stone-400 mb-2">Toca <Copy size={11} className="inline -mt-0.5" /> para copiar un dato.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              <CampoCopiable label="Matrícula" value={datos.matricula} />
              <CampoCopiable label="CURP" value={datos.curp} />
              <CampoCopiable label="Nombre(s)" value={datos.nombres} />
              <CampoCopiable label="Apellido paterno" value={datos.apellidoPaterno} />
              <CampoCopiable label="Apellido materno" value={datos.apellidoMaterno} />
              <CampoCopiable label="Fecha de nacimiento" value={datos.fechaNacimiento} />
              <CampoCopiable label="Sexo" value={datos.sexo} />
              <CampoCopiable label="Estado civil" value={datos.estadoCivil} />
              <CampoCopiable label="Lugar de nacimiento" value={datos.lugarNacimiento} />
              <CampoCopiable label="Entidad de nacimiento" value={datos.entidadNacimiento} />
              <CampoCopiable label="Teléfono" value={datos.telefono} />
              <CampoCopiable label="Correo" value={datos.correo} />
              <CampoCopiable label="Calle y número" value={datos.calleNumero} />
              <CampoCopiable label="Colonia" value={datos.colonia} />
              <CampoCopiable label="Código postal" value={datos.cp} />
              <CampoCopiable label="Ciudad" value={datos.ciudad} />
              <CampoCopiable label="Estado" value={datos.estado} />
              <CampoCopiable label="Último estudio" value={datos.ultimoEstudio} />
              <CampoCopiable label="Responsable" value={datos.responsableNombre} />
              <CampoCopiable label="Observaciones" value={datos.observaciones} />
            </div>
          </div>
        ) : (
          <div className="bg-white border border-stone-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-serif text-base font-bold text-stone-900">Editar cédula</h3>
              <button
                onClick={() => { setEditing(false); setError(null); cargar(); }}
                className="text-xs text-stone-500 hover:text-stone-700 font-semibold"
              >
                Cancelar
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {EDITABLES.map((k) => (
                <div key={k} className={k === 'calleNumero' ? 'sm:col-span-2' : ''}>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">{LABELS[k]}</label>
                  {k === 'sexo' ? (
                    <select className={inputCls} value={form.sexo} onChange={(e) => setForm({ ...form, sexo: e.target.value })}>
                      <option value="">Selecciona…</option>
                      <option value="Hombre">Hombre</option>
                      <option value="Mujer">Mujer</option>
                    </select>
                  ) : k === 'estadoCivil' ? (
                    <select className={inputCls} value={form.estadoCivil} onChange={(e) => setForm({ ...form, estadoCivil: e.target.value })}>
                      <option value="">Selecciona…</option>
                      <option value="Soltero(a)">Soltero(a)</option>
                      <option value="Casado(a)">Casado(a)</option>
                      <option value="Unión libre">Unión libre</option>
                      <option value="Divorciado(a)">Divorciado(a)</option>
                      <option value="Viudo(a)">Viudo(a)</option>
                    </select>
                  ) : (
                    <input className={inputCls} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3">
              <label className="block text-xs font-semibold text-stone-500 mb-1">Observaciones (opcional)</label>
              <textarea
                className={inputCls}
                rows={2}
                value={form.observaciones}
                onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                placeholder="Notas o comentarios adicionales para la cédula…"
              />
            </div>
            {error && (
              <div className="mt-3 text-xs text-red-600 bg-red-50 rounded p-2 flex items-center gap-1.5">
                <AlertCircle size={13} /> {error}
              </div>
            )}
            <button
              onClick={guardar}
              disabled={saving}
              className="mt-4 w-full flex items-center justify-center gap-2 py-3 bg-[var(--color-guinda-700)] text-white text-sm font-semibold rounded-xl hover:bg-[var(--color-guinda-800)] disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              Guardar y actualizar cédula
            </button>
          </div>
        )}

        {firmaSlot}

        {mostrarFirmaResponsable && (
          <div className="border border-stone-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <PenLine size={15} className="text-[var(--color-guinda-700)]" />
              <h3 className="font-serif text-sm font-bold text-stone-900">Firma del responsable de la inscripción</h3>
            </div>
            {puedeFirmar ? (
              <>
                <p className="text-xs text-stone-500 mb-3">
                  Guarda hasta dos firmas y elige cuál se estampa como responsable en las cédulas de los
                  alumnos sin gestor. Para cambiar una firma, bórrala y vuelve a dibujarla.
                </p>
                <FirmaPad onChange={() => setPreviewKey((k) => k + 1)} />
              </>
            ) : (
              <FirmaResponsableSoloLectura
                nombre={datos.responsableNombre}
                registrada={datos.tieneFirmaResponsable}
              />
            )}
          </div>
        )}

        {!datos.tieneFoto && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            El alumno aún no tiene fotografía en el expediente; la cédula se generará sin foto.
          </div>
        )}
      </div>

      <div className="lg:sticky lg:top-[114px] self-start space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-base font-bold text-stone-900">Vista previa</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setPreviewKey((k) => k + 1)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors"
            >
              <RefreshCw size={13} /> Actualizar
            </button>
            <a
              href={`/api${basePath}/cedula/pdf`}
              download=""
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--color-guinda-700)] text-white hover:bg-[var(--color-guinda-800)] transition-colors"
            >
              <Download size={13} /> Descargar PDF
            </a>
          </div>
        </div>
        <iframe
          key={previewKey}
          title="Vista previa de la cédula"
          src={`/api${basePath}/cedula/pdf?v=${previewKey}`}
          className="w-full border border-stone-200 rounded-xl bg-stone-100"
          style={{ height: 720 }}
        />
      </div>

      {bloqueadoPorOtro && (
        <AvisoBloqueo
          titular={titular}
          reintentando={reintentando}
          onSoloLectura={() => setEditing(false)}
          onReintentar={intentarReintentar}
        />
      )}
    </div>
  );
}
