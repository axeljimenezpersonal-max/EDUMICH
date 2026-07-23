/**
 * Padrón histórico — pantalla de administración/dirección (Secretaría y Sinapsis).
 * Permite CARGAR el Excel del padrón (alumnos que ya existen en la base del
 * Estado) y BUSCARLO. Es información confidencial: solo estos dos roles la ven.
 *
 * El match "este alumno ya existe" al dar de alta usa este mismo padrón, pero el
 * gestor no ve la lista completa: solo recibe la coincidencia por CURP.
 */
import { useEffect, useRef, useState } from 'react';
import { Database, Upload, Search, Loader2, CheckCircle2, AlertCircle, ShieldAlert, X } from 'lucide-react';
import { api } from '../lib/api';

interface Registro {
  id: number;
  matricula: string;
  curp: string | null;
  primerApellido: string | null;
  segundoApellido: string | null;
  nombre: string | null;
  sexo: string | null;
  fechaNacimiento: string | null;
  fechaAlta: string | null;
}
interface Respuesta { registros: Registro[]; total: number; mostrando: number; limite: number; }

// Fecha 'YYYY-MM-DD' → 'dd/mm/aaaa' sin crear Date (evita el corrimiento de zona).
function fechaMx(s: string | null): string {
  if (!s) return '—';
  const [y, m, d] = s.slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : s;
}
function nombreCompleto(r: Registro): string {
  return [r.primerApellido, r.segundoApellido, r.nombre].filter(Boolean).join(' ') || '—';
}

export function PadronHistorico() {
  const [q, setQ] = useState('');
  const [data, setData] = useState<Respuesta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function cargar(busqueda = q) {
    setCargando(true);
    api.get<Respuesta>(`/padron-historico?q=${encodeURIComponent(busqueda.trim())}`)
      .then(setData)
      .catch(() => setData({ registros: [], total: 0, mostrando: 0, limite: 50 }))
      .finally(() => setCargando(false));
  }
  useEffect(() => { cargar(''); /* eslint-disable-next-line */ }, []);

  // Búsqueda con pequeño debounce.
  useEffect(() => {
    const t = setTimeout(() => cargar(q), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function subir(file: File) {
    setSubiendo(true); setAviso(null);
    try {
      const fd = new FormData();
      fd.append('archivo', file);
      const r = await api.post<{ procesados: number; sinMatricula: number; total: number }>('/padron-historico/importar', fd);
      setAviso({ ok: true, texto: `Se cargaron ${r.procesados} registro(s). El padrón tiene ahora ${r.total}.${r.sinMatricula ? ` (${r.sinMatricula} fila(s) sin matrícula se omitieron.)` : ''}` });
      cargar('');
      setQ('');
    } catch (e) {
      setAviso({ ok: false, texto: e instanceof Error ? e.message : 'No se pudo cargar el archivo.' });
    } finally {
      setSubiendo(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div>
      <div className="mb-1 text-[11px] font-bold uppercase tracking-widest text-[var(--color-guinda-700)] flex items-center gap-1.5">
        <Database size={14} /> Base del Estado
      </div>
      <h1 className="font-serif text-2xl font-bold text-stone-900 mb-1">Padrón histórico</h1>
      <p className="text-stone-500 text-sm mb-5 max-w-2xl">
        Alumnos que ya existen en la base del Estado. Al dar de alta, si la CURP ya está aquí, el gestor
        ve que el alumno ya existe. Esta lista completa solo la ven la administración y dirección.
      </p>

      {/* Aviso de confidencialidad */}
      <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 mb-5 text-[13px] text-amber-800">
        <ShieldAlert size={16} className="shrink-0 mt-0.5" />
        <span>Información personal confidencial. No la compartas fuera del equipo.</span>
      </div>

      {/* Cargar Excel */}
      <div className="bg-white border border-stone-200 rounded-xl p-4 mb-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="text-sm font-bold text-stone-800">Cargar padrón (Excel)</div>
            <p className="text-xs text-stone-500 mt-0.5">
              Columnas: Matricula, CURP, Primer_Apellido, Segundo_Apellido, Nombre, Sexo, Fecha_Nacimiento, Fecha_alta.
              Volver a subir <b>actualiza</b> por matrícula, no duplica.
            </p>
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={subiendo}
            className="inline-flex items-center gap-2 py-2 px-4 rounded-lg bg-[var(--color-guinda-700)] text-white text-sm font-semibold hover:bg-[var(--color-guinda-800)] disabled:opacity-50 shrink-0"
          >
            {subiendo ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {subiendo ? 'Cargando…' : 'Subir Excel'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) subir(f); }}
          />
        </div>
        {aviso && (
          <div className={`mt-3 flex items-start gap-2 rounded-lg p-2.5 text-[13px] ${aviso.ok ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-700'}`}>
            {aviso.ok ? <CheckCircle2 size={15} className="shrink-0 mt-0.5" /> : <AlertCircle size={15} className="shrink-0 mt-0.5" />}
            {aviso.texto}
          </div>
        )}
      </div>

      {/* Buscar */}
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por CURP, matrícula o nombre…"
          className="w-full text-sm border border-stone-300 rounded-lg pl-9 pr-9 py-2.5 bg-white focus:outline-none focus:border-[var(--color-guinda-700)]"
        />
        {q && (
          <button onClick={() => setQ('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700" aria-label="Limpiar">
            <X size={16} />
          </button>
        )}
      </div>
      <div className="text-[11px] text-stone-400 mb-2 px-1">
        {data ? (q.trim()
          ? `${data.mostrando} resultado(s)${data.mostrando >= data.limite ? ` (mostrando los primeros ${data.limite})` : ''} · ${data.total} en total`
          : `${data.total} registro(s) en el padrón`) : ''}
      </div>

      {/* Tabla */}
      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-stone-400 border-b border-stone-100">
                <th className="px-3 py-2.5">Matrícula</th>
                <th className="px-3 py-2.5">CURP</th>
                <th className="px-3 py-2.5">Nombre</th>
                <th className="px-3 py-2.5">Sexo</th>
                <th className="px-3 py-2.5">Nacimiento</th>
                <th className="px-3 py-2.5">Alta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {cargando ? (
                <tr><td colSpan={6} className="px-3 py-10 text-center text-stone-400"><Loader2 size={18} className="animate-spin inline" /> Cargando…</td></tr>
              ) : (data?.registros.length ?? 0) === 0 ? (
                <tr><td colSpan={6} className="px-3 py-10 text-center text-stone-400">
                  {data && data.total === 0 ? 'El padrón está vacío. Sube el Excel para empezar.' : 'Sin resultados.'}
                </td></tr>
              ) : (
                data!.registros.map((r) => (
                  <tr key={r.id} className="hover:bg-stone-50/60">
                    <td className="px-3 py-2 font-mono text-[12px] text-stone-600">{r.matricula}</td>
                    <td className="px-3 py-2 font-mono text-[12px] text-stone-600">{r.curp ?? '—'}</td>
                    <td className="px-3 py-2 text-stone-800">{nombreCompleto(r)}</td>
                    <td className="px-3 py-2 text-stone-600">{r.sexo ?? '—'}</td>
                    <td className="px-3 py-2 text-stone-600">{fechaMx(r.fechaNacimiento)}</td>
                    <td className="px-3 py-2 text-stone-600">{fechaMx(r.fechaAlta)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
