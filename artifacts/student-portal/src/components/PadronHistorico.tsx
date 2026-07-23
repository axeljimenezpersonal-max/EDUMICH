/**
 * Padrón histórico — pantalla de administración/dirección (Secretaría y Sinapsis).
 * Permite CARGAR el Excel del padrón (alumnos que ya existen en la base del
 * Estado) y BUSCARLO. Es información confidencial: solo estos dos roles la ven.
 *
 * El match "este alumno ya existe" al dar de alta usa este mismo padrón, pero el
 * gestor no ve la lista completa: solo recibe la coincidencia por CURP.
 */
import { useEffect, useRef, useState } from 'react';
import { Database, Upload, Search, Loader2, CheckCircle2, AlertCircle, ShieldAlert, X, Download, ChevronLeft, ChevronRight } from 'lucide-react';
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
interface Respuesta { registros: Registro[]; total: number; totalGeneral: number; pagina: number; porPagina: number; }

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
  const [pagina, setPagina] = useState(1);
  const [data, setData] = useState<Respuesta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const POR_PAGINA = 50;

  function cargar(busqueda = q, pag = pagina) {
    setCargando(true);
    api.get<Respuesta>(`/padron-historico?q=${encodeURIComponent(busqueda.trim())}&pagina=${pag}&porPagina=${POR_PAGINA}`)
      .then(setData)
      .catch(() => setData({ registros: [], total: 0, totalGeneral: 0, pagina: 1, porPagina: POR_PAGINA }))
      .finally(() => setCargando(false));
  }

  // Cargar al montar y cada vez que cambia la búsqueda o la página (con debounce).
  useEffect(() => {
    const t = setTimeout(() => cargar(q, pagina), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, pagina]);

  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / POR_PAGINA)) : 1;

  async function subir(file: File) {
    setSubiendo(true); setAviso(null);
    try {
      const fd = new FormData();
      fd.append('archivo', file);
      const r = await api.post<{ procesados: number; sinMatricula: number; total: number }>('/padron-historico/importar', fd);
      setAviso({ ok: true, texto: `Se cargaron ${r.procesados} registro(s). El padrón tiene ahora ${r.total}.${r.sinMatricula ? ` (${r.sinMatricula} fila(s) sin matrícula se omitieron.)` : ''}` });
      setQ('');
      setPagina(1);
      cargar('', 1);
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
          onChange={(e) => { setQ(e.target.value); setPagina(1); }}
          placeholder="Buscar por CURP, matrícula o nombre…"
          className="w-full text-sm border border-stone-300 rounded-lg pl-9 pr-9 py-2.5 bg-white focus:outline-none focus:border-[var(--color-guinda-700)]"
        />
        {q && (
          <button onClick={() => { setQ(''); setPagina(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700" aria-label="Limpiar">
            <X size={16} />
          </button>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-2 px-1">
        <div className="text-[11px] text-stone-400">
          {data ? (q.trim()
            ? `${data.total} resultado(s) para «${q.trim()}» · ${data.totalGeneral} en el padrón`
            : `${data.totalGeneral} registro(s) en el padrón`) : ''}
        </div>
        <a
          href={`/api/padron-historico/exportar?q=${encodeURIComponent(q.trim())}`}
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--color-guinda-700)] border border-stone-300 rounded-lg px-3 py-1.5 hover:bg-stone-50"
        >
          <Download size={13} /> Descargar Excel{q.trim() ? ' (filtrado)' : ''}
        </a>
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
                  {data && data.totalGeneral === 0 ? 'El padrón está vacío. Sube el Excel para empezar.' : 'Sin resultados.'}
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

      {/* Paginación (hojas) */}
      {data && data.total > POR_PAGINA && (
        <div className="flex items-center justify-between gap-3 mt-3">
          <div className="text-[12px] text-stone-500">
            Página <b>{pagina}</b> de <b>{totalPaginas}</b>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              disabled={pagina <= 1 || cargando}
              className="inline-flex items-center gap-1 text-[13px] font-semibold border border-stone-300 rounded-lg px-3 py-1.5 text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={14} /> Anterior
            </button>
            <button
              onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
              disabled={pagina >= totalPaginas || cargando}
              className="inline-flex items-center gap-1 text-[13px] font-semibold border border-stone-300 rounded-lg px-3 py-1.5 text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Siguiente <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
