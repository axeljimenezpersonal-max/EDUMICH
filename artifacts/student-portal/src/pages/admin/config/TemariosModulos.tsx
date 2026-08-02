/**
 * Temarios de los módulos (PDF) — parámetro institucional.
 *
 * Es el archivo que el alumno descarga con "Descargar temario PDF" en el
 * detalle de cada módulo. Subirlo y quitarlo es facultad de la administradora
 * TITULAR; el resto del equipo ve el estado, sin botones.
 *
 * El candado real está en el servidor (`soloJefe` en POST y DELETE). Lo de aquí
 * solo evita ofrecer un botón que iba a rebotar.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BookOpen, Info, RefreshCw, CheckCircle, AlertTriangle,
  Upload, Trash2, Lock, FileText, Eye,
} from 'lucide-react';
import { api, ApiError } from '../../../lib/api';
import { fechaCorta } from '../../../lib/fechas';
import { useAdminPerfil } from '../../../lib/useAdmin';
import { confirmar } from '../../../components/Confirmador';

const GUINDA = '#6B1530';

// ─── Tipos ────────────────────────────────────────────────────────────────

type Temario = {
  id: number;
  nombre: string;
  tamanoBytes: number | null;
  subidoEn: string | null;
  /** Hay fila pero el archivo no está en el almacenamiento. */
  archivoPresente: boolean;
};

type Modulo = {
  id: number;
  numero: number;
  nombre: string;
  nivel: number | null;
  temario: Temario | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────

function tamanoLegible(bytes: number | null): string {
  if (!bytes || bytes <= 0) return 'tamaño desconocido';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

const LIMITE_MB = 20;

// ─── Aviso flotante ───────────────────────────────────────────────────────

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div
      className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white flex items-start gap-2 max-w-sm"
      style={{ background: ok ? '#2d7d46' : '#b91c1c' }}
    >
      {ok ? <CheckCircle size={15} className="flex-shrink-0 mt-0.5" /> : <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />}
      <span>{msg}</span>
    </div>
  );
}

// ─── Estado del temario de una fila ───────────────────────────────────────

function EstadoTemario({ modulo, subiendo }: { modulo: Modulo; subiendo: boolean }) {
  if (subiendo) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: GUINDA }}>
        <span
          style={{
            width: 12, height: 12, border: `2px solid ${GUINDA}`, borderTopColor: 'transparent',
            borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block',
          }}
        />
        Subiendo…
      </span>
    );
  }

  if (!modulo.temario) {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
        style={{ background: '#f7f2ed', color: '#8a807a' }}
      >
        Sin temario
      </span>
    );
  }

  if (!modulo.temario.archivoPresente) {
    return (
      <div className="flex flex-col items-start gap-0.5">
        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
          style={{ background: '#fef3c7', color: '#92400e' }}
        >
          <AlertTriangle size={10} strokeWidth={2} /> Falta el archivo
        </span>
        <span className="text-[11px]" style={{ color: '#92400e' }}>
          Registrado el {fechaCorta(modulo.temario.subidoEn)}, pero el PDF no está en el servidor. Vuelve a subirlo.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-0.5">
      <span
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
        style={{ background: '#d1fae5', color: '#2d7d46' }}
      >
        <CheckCircle size={10} strokeWidth={2} /> Cargado
      </span>
      <span className="text-[11px]" style={{ color: '#6b635e' }}>
        PDF · {tamanoLegible(modulo.temario.tamanoBytes)} · {fechaCorta(modulo.temario.subidoEn)}
      </span>
    </div>
  );
}

// ─── Pantalla ─────────────────────────────────────────────────────────────

export default function TemariosModulos() {
  const { esJefe } = useAdminPerfil();
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<number | null>(null); // número de módulo en curso
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const destinoRef = useRef<number | null>(null); // a qué módulo va el archivo elegido

  const avisar = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 5000);
  };

  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const r = await api.get<{ modulos: Modulo[] }>('/admin/modulos');
      setModulos(r.modulos);
    } catch (e) {
      setErrorCarga(e instanceof ApiError ? e.message : 'No se pudo cargar la lista de módulos.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  function elegirArchivo(numero: number) {
    destinoRef.current = numero;
    inputRef.current?.click();
  }

  async function subir(numero: number, archivo: File) {
    if (archivo.size > LIMITE_MB * 1024 * 1024) {
      avisar(`El archivo pesa ${tamanoLegible(archivo.size)} y el límite es de ${LIMITE_MB} MB.`, false);
      return;
    }
    setOcupado(numero);
    try {
      const cuerpo = new FormData();
      cuerpo.append('archivo', archivo);
      const r = await api.post<{ reemplazo: boolean }>(`/admin/modulos/${numero}/temario`, cuerpo);
      avisar(`Temario del módulo ${numero} ${r.reemplazo ? 'reemplazado' : 'cargado'} correctamente.`);
      await cargar();
    } catch (e) {
      avisar(e instanceof ApiError ? e.message : 'No se pudo subir el temario.', false);
    } finally {
      setOcupado(null);
    }
  }

  async function quitar(modulo: Modulo) {
    const ok = await confirmar({
      title: `Quitar el temario del módulo ${modulo.numero}`,
      message: `Se borrará el PDF y los alumnos dejarán de verlo en "${modulo.nombre}". Puedes volver a subirlo cuando quieras.`,
      confirmLabel: 'Quitar temario',
      danger: true,
    });
    if (!ok) return;

    setOcupado(modulo.numero);
    try {
      await api.delete(`/admin/modulos/${modulo.numero}/temario`);
      avisar(`Temario del módulo ${modulo.numero} eliminado.`);
      await cargar();
    } catch (e) {
      avisar(e instanceof ApiError ? e.message : 'No se pudo quitar el temario.', false);
    } finally {
      setOcupado(null);
    }
  }

  const conTemario = modulos.filter((m) => m.temario && m.temario.archivoPresente).length;
  const incompletos = modulos.filter((m) => m.temario && !m.temario.archivoPresente).length;

  return (
    <div style={{ fontFamily: "'Poppins', sans-serif" }}>
      {toast && <Toast msg={toast.msg} ok={toast.ok} />}

      {/* Un solo input oculto para toda la lista; `destinoRef` dice a qué módulo va. */}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          const numero = destinoRef.current;
          e.target.value = ''; // permite volver a elegir el mismo archivo
          if (archivo && numero !== null) subir(numero, archivo);
        }}
      />

      {/* Encabezado */}
      <div className="mb-5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase mb-1.5" style={{ color: GUINDA, letterSpacing: '0.12em' }}>
          <BookOpen size={12} /> CONFIGURACIÓN · INSTITUCIÓN
        </div>
        <h1 className="text-[22px] font-extrabold" style={{ color: '#1c1917', margin: 0 }}>
          Temarios de los módulos
        </h1>
        <p className="text-[13px] mt-1.5 leading-relaxed" style={{ color: '#6b635e' }}>
          El PDF que el alumno descarga desde el detalle de cada módulo, en <strong>Material de estudio</strong>.
          Un temario por módulo: al subir uno nuevo se reemplaza el anterior.
        </p>
      </div>

      {/* Aviso de facultad */}
      {esJefe ? (
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-xl border mb-5 text-sm"
          style={{ background: '#fdf8fb', borderColor: '#e8d5e0' }}
        >
          <Info size={15} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1, color: GUINDA }} />
          <span style={{ color: '#5a0e32' }}>
            Solo se aceptan archivos <strong>PDF</strong> de hasta <strong>{LIMITE_MB} MB</strong>. El cambio es
            inmediato para todos los alumnos y queda registrado en la bitácora con tu nombre.
          </span>
        </div>
      ) : (
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-xl border mb-5 text-sm"
          style={{ background: '#fafaf9', borderColor: '#eadfd7' }}
        >
          <Lock size={15} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1, color: '#8a807a' }} />
          <span style={{ color: '#57504a' }}>
            Cargar o quitar temarios es facultad de la <strong>administradora titular</strong>. Aquí puedes consultar
            qué módulos ya tienen su temario, cuáles faltan y <strong>abrir el PDF</strong> de los que sí están.
          </span>
        </div>
      )}

      {/* Resumen + recargar */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <div className="text-[13px]" style={{ color: '#57504a' }}>
          {cargando && modulos.length === 0 ? (
            'Cargando módulos…'
          ) : (
            <>
              <strong style={{ color: '#1c1917' }}>{conTemario}</strong> de {modulos.length} módulos con temario
              {incompletos > 0 && (
                <span style={{ color: '#92400e' }}> · {incompletos} con el archivo faltante</span>
              )}
            </>
          )}
        </div>
        <button
          onClick={cargar}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-white text-xs"
          style={{ borderColor: '#eadfd7', color: '#443e39' }}
        >
          <RefreshCw size={12} /> Actualizar
        </button>
      </div>

      {errorCarga && (
        <div
          className="flex items-start gap-2 px-4 py-3 rounded-xl border mb-4 text-sm"
          style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}
        >
          <AlertTriangle size={15} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{errorCarga}</span>
        </div>
      )}

      {/* Lista */}
      <div className="bg-white border rounded-xl overflow-hidden" style={{ borderColor: '#eadfd7' }}>
        <div
          className="px-5 py-3 flex items-center gap-2"
          style={{ background: GUINDA }}
        >
          <FileText size={14} strokeWidth={2} color="white" />
          <h2 className="text-sm font-semibold text-white">Plan 22 · 22 módulos</h2>
        </div>

        {cargando && modulos.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm" style={{ color: '#6b635e' }}>Cargando…</div>
        ) : modulos.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm" style={{ color: '#6b635e' }}>
            No hay módulos en el catálogo.
          </div>
        ) : (
          modulos.map((m, i) => {
            const subiendo = ocupado === m.numero;
            return (
              <div
                key={m.id}
                className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0 flex-wrap"
                style={{ borderColor: '#f2ede8', background: i % 2 === 0 ? 'white' : '#fafaf9' }}
              >
                {/* Número */}
                <span
                  className="text-[13px] font-bold font-mono flex-shrink-0"
                  style={{ color: GUINDA, width: 34 }}
                >
                  M{String(m.numero).padStart(2, '0')}
                </span>

                {/* Nombre + nivel */}
                <div className="flex-1" style={{ minWidth: 180 }}>
                  <div className="text-[13px] font-semibold" style={{ color: '#1c1917' }}>{m.nombre}</div>
                  {m.nivel !== null && (
                    <div className="text-[11px]" style={{ color: '#8a807a' }}>Nivel {m.nivel}</div>
                  )}
                </div>

                {/* Estado */}
                <div style={{ minWidth: 190 }}>
                  <EstadoTemario modulo={m} subiendo={subiendo} />
                </div>

                {/* Acciones. "Ver PDF" es consulta y la tienen los dos perfiles;
                    subir y quitar siguen siendo de la titular. */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {m.temario?.archivoPresente && (
                    <a
                      href={`/api/admin/modulos/${m.numero}/temario`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Abrir el temario del módulo ${m.numero} para revisarlo`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-white no-underline"
                      style={{ borderColor: '#eadfd7', color: '#443e39', textDecoration: 'none' }}
                    >
                      <Eye size={12} /> Ver PDF
                    </a>
                  )}
                  {esJefe && (
                    <>
                      <button
                        onClick={() => elegirArchivo(m.numero)}
                        disabled={ocupado !== null}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border"
                        style={{
                          background: m.temario ? 'white' : GUINDA,
                          color: m.temario ? '#443e39' : 'white',
                          borderColor: m.temario ? '#eadfd7' : GUINDA,
                          opacity: ocupado !== null ? 0.5 : 1,
                          cursor: ocupado !== null ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <Upload size={12} /> {m.temario ? 'Reemplazar' : 'Subir PDF'}
                      </button>
                      {m.temario && (
                        <button
                          onClick={() => quitar(m)}
                          disabled={ocupado !== null}
                          title="Quitar el temario"
                          className="p-1.5 rounded-lg border bg-white"
                          style={{
                            borderColor: '#eadfd7',
                            opacity: ocupado !== null ? 0.5 : 1,
                            cursor: ocupado !== null ? 'not-allowed' : 'pointer',
                          }}
                        >
                          <Trash2 size={13} style={{ color: '#b91c1c' }} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Nota al pie */}
      <div className="mt-4 text-[11px] flex items-start gap-2" style={{ color: '#a89a8e' }}>
        <Info size={12} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          Para una carga masiva (los 22 de una vez) el área de sistemas puede usar el script de importación desde el
          servidor: escribe exactamente lo mismo que esta pantalla, así que ningún temario se duplica.
        </span>
      </div>
    </div>
  );
}
