import { useEffect, useState } from 'react';
import {
  ClipboardList, AlertCircle, CheckCircle2, Loader2, Download, FileSignature, RefreshCw,
  Pencil, Lock, Copy,
} from 'lucide-react';
import { EstudianteLayout } from './EstudianteLayout';
import { api, type CedulaDatos, type CedulaDatosEditable } from '../../lib/api';
import FirmaPad from '../../components/FirmaPad';
import { CampoCopiable } from '../../components/CampoCopiable';

const EDITABLES: (keyof CedulaDatosEditable)[] = [
  'apellidoPaterno', 'apellidoMaterno', 'nombres', 'sexo', 'estadoCivil',
  'lugarNacimiento', 'entidadNacimiento', 'calleNumero', 'colonia', 'cp',
  'ciudad', 'estado', 'ultimoEstudio',
];

const LABELS: Record<keyof CedulaDatosEditable, string> = {
  apellidoPaterno: 'Apellido paterno',
  apellidoMaterno: 'Apellido materno',
  nombres: 'Nombre(s)',
  sexo: 'Sexo',
  estadoCivil: 'Estado civil',
  lugarNacimiento: 'Lugar de nacimiento (ciudad)',
  entidadNacimiento: 'Entidad donde nació',
  calleNumero: 'Calle y número',
  colonia: 'Colonia',
  cp: 'Código postal',
  ciudad: 'Ciudad',
  estado: 'Estado',
  ultimoEstudio: 'Último estudio realizado',
  observaciones: 'Observaciones',
};

export default function MiCedula() {
  const [datos, setDatos] = useState<CedulaDatos | null>(null);
  const [form, setForm] = useState<CedulaDatosEditable | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);

  function showToast(m: string) {
    setToast(m);
    setTimeout(() => setToast(null), 3500);
  }

  function cargar() {
    return api
      .get<CedulaDatos>('/estudiante/cedula')
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
  }, []);

  function set<K extends keyof CedulaDatosEditable>(k: K, v: string) {
    setForm((f) => (f ? { ...f, [k]: v } : f));
  }

  async function guardar() {
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      await api.patch('/estudiante/cedula', form);
      await cargar();
      setPreviewKey((k) => k + 1);
      setEditing(false);
      showToast('Cédula guardada y actualizada');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    'w-full border border-stone-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-guinda-700)] focus:border-transparent';

  return (
    <EstudianteLayout>
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm bg-emerald-50 border border-emerald-200 text-emerald-800">
          <CheckCircle2 size={16} /> {toast}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-guinda-700)] mb-1">
          MI CÉDULA
        </div>
        <h1 className="font-serif text-2xl font-bold text-stone-900 flex items-center gap-2">
          <ClipboardList size={22} /> Cédula de inscripción
        </h1>
        <p className="text-stone-500 text-sm mt-1">
          Completa tus datos y firma. La cédula se genera automáticamente para que administración solo la descargue.
        </p>
      </div>

      {loading && <div className="text-center text-stone-400 py-16 text-sm">Cargando…</div>}

      {!loading && datos && form && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── Columna izquierda: formulario ── */}
          <div className="space-y-5">
            {!editing ? (
              /* ── Modo lectura (cerrado) con botones de copiar ── */
              <div className="bg-white border border-stone-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-serif text-base font-bold text-stone-900 flex items-center gap-2">
                    <Lock size={15} className="text-stone-400" /> Datos de la cédula
                  </h2>
                  <button
                    onClick={() => setEditing(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--color-guinda-700)] text-white hover:bg-[var(--color-guinda-800)] transition-colors"
                  >
                    <Pencil size={13} /> Editar cédula
                  </button>
                </div>
                <p className="text-xs text-stone-400 mb-2">
                  Toca el ícono <Copy size={11} className="inline -mt-0.5" /> para copiar un dato.
                </p>
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
              /* ── Modo edición ── */
              <div className="bg-white border border-stone-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-serif text-base font-bold text-stone-900">Editar cédula</h2>
                  <button
                    onClick={() => { setEditing(false); setError(null); cargar(); }}
                    className="text-xs text-stone-500 hover:text-stone-700 font-semibold"
                  >
                    Cancelar
                  </button>
                </div>
                <p className="text-xs text-stone-400 mb-3">
                  Matrícula, CURP, fecha de nacimiento, teléfono y correo vienen de tu expediente.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {EDITABLES.map((k) => (
                    <div key={k} className={k === 'calleNumero' ? 'sm:col-span-2' : ''}>
                      <label className="block text-xs font-semibold text-stone-500 mb-1">{LABELS[k]}</label>
                      {k === 'sexo' ? (
                        <select className={inputCls} value={form.sexo} onChange={(e) => set('sexo', e.target.value)}>
                          <option value="">Selecciona…</option>
                          <option value="Hombre">Hombre</option>
                          <option value="Mujer">Mujer</option>
                        </select>
                      ) : k === 'estadoCivil' ? (
                        <select className={inputCls} value={form.estadoCivil} onChange={(e) => set('estadoCivil', e.target.value)}>
                          <option value="">Selecciona…</option>
                          <option value="Soltero(a)">Soltero(a)</option>
                          <option value="Casado(a)">Casado(a)</option>
                          <option value="Unión libre">Unión libre</option>
                          <option value="Divorciado(a)">Divorciado(a)</option>
                          <option value="Viudo(a)">Viudo(a)</option>
                        </select>
                      ) : (
                        <input className={inputCls} value={form[k]} onChange={(e) => set(k, e.target.value)} />
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
                    onChange={(e) => set('observaciones', e.target.value)}
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

            {/* Firma */}
            <div className="bg-white border border-stone-200 rounded-xl p-5">
              <h2 className="font-serif text-base font-bold text-stone-900 mb-1 flex items-center gap-2">
                <FileSignature size={16} /> Tu firma
              </h2>
              <p className="text-xs text-stone-500 mb-3">
                Fírmala una vez y se reutilizará automáticamente en tu cédula.
              </p>
              <FirmaPad onChange={() => setPreviewKey((k) => k + 1)} />
            </div>

            {!datos.tieneFoto && (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                Aún no has subido tu fotografía en el expediente. La cédula se generará sin foto hasta que la subas.
              </div>
            )}
          </div>

          {/* ── Columna derecha: vista previa ── */}
          <div className="lg:sticky lg:top-[114px] self-start space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-base font-bold text-stone-900">Vista previa</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setPreviewKey((k) => k + 1)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors"
                >
                  <RefreshCw size={13} /> Actualizar
                </button>
                <a
                  href="/api/estudiante/cedula/pdf"
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--color-guinda-700)] text-white hover:bg-[var(--color-guinda-800)] transition-colors"
                >
                  <Download size={13} /> Descargar PDF
                </a>
              </div>
            </div>
            <iframe
              key={previewKey}
              title="Vista previa de la cédula"
              src={`/api/estudiante/cedula/pdf?v=${previewKey}`}
              className="w-full border border-stone-200 rounded-xl bg-stone-100"
              style={{ height: 720 }}
            />
          </div>
        </div>
      )}
    </EstudianteLayout>
  );
}
