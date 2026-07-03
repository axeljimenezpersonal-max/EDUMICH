import { useEffect, useState, useCallback } from 'react';
import DOMPurify from 'dompurify';
import { safeUrl } from '../../../lib/safeUrl';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import {
  Mail, Edit2, Eye, Send, ArrowLeft, RotateCcw, Save, RefreshCw,
  Bold, Italic, Underline as UnderlineIcon, Heading1, Heading2,
  List, ListOrdered, Link2, Quote, Minus, Smartphone, Monitor,
  X, CheckCircle,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────

type Plantilla = {
  clave: string;
  nombre: string;
  descripcion: string;
  asunto: string;
  contenidoHtml: string;
  activa: boolean;
  variables: string[];
};

// ─── Demo variable values ─────────────────────────────────────────────────

const DEMO_VALS: Record<string, string> = {
  nombreCompleto: 'Ana Cristina Lopez',
  email: 'ana.lopez@correo.com',
  passwordTemporal: 'DemoPass2026',
  gestorNombre: 'Mario Ramirez',
  linkPortal: 'https://prepa.michoacan.gob.mx',
  folio: 'PRE-2026-MICH-000001',
  codigo: '847291',
};

function applyDemoVars(html: string): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => DEMO_VALS[key] ?? `{{${key}}}`);
}

// ─── Toolbar button ───────────────────────────────────────────────────────

function ToolbarBtn({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className="p-1.5 rounded text-stone-700 hover:bg-stone-100"
      style={{
        background: active ? '#f5e6ef' : 'transparent',
        color: active ? '#6B1530' : undefined,
      }}
    >
      {children}
    </button>
  );
}

// ─── TipTap editor toolbar ────────────────────────────────────────────────

function EditorToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;

  function setLink() {
    const url = window.prompt('URL del enlace:');
    if (!url) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    // SEGURIDAD: solo se aceptan rutas internas, http(s) o mailto;
    // se bloquean esquemas peligrosos (javascript:, data:).
    const safe = safeUrl(url);
    if (safe === '#') {
      window.alert('Enlace no válido. Usa una URL http(s) o mailto.');
      return;
    }
    editor.chain().focus().setLink({ href: safe }).run();
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-stone-200 bg-stone-50">
      <ToolbarBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrita">
        <Bold size={14} strokeWidth={2} />
      </ToolbarBtn>
      <ToolbarBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Cursiva">
        <Italic size={14} strokeWidth={2} />
      </ToolbarBtn>
      <ToolbarBtn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Subrayado">
        <UnderlineIcon size={14} strokeWidth={2} />
      </ToolbarBtn>
      <div className="w-px h-5 bg-stone-200 mx-1" />
      <ToolbarBtn active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Titulo 1">
        <Heading1 size={14} strokeWidth={2} />
      </ToolbarBtn>
      <ToolbarBtn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Titulo 2">
        <Heading2 size={14} strokeWidth={2} />
      </ToolbarBtn>
      <div className="w-px h-5 bg-stone-200 mx-1" />
      <ToolbarBtn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista sin orden">
        <List size={14} strokeWidth={2} />
      </ToolbarBtn>
      <ToolbarBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada">
        <ListOrdered size={14} strokeWidth={2} />
      </ToolbarBtn>
      <div className="w-px h-5 bg-stone-200 mx-1" />
      <ToolbarBtn active={editor.isActive('link')} onClick={setLink} title="Enlace">
        <Link2 size={14} strokeWidth={2} />
      </ToolbarBtn>
      <ToolbarBtn active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Cita">
        <Quote size={14} strokeWidth={2} />
      </ToolbarBtn>
      <ToolbarBtn active={false} onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Separador">
        <Minus size={14} strokeWidth={2} />
      </ToolbarBtn>
    </div>
  );
}

// ─── Email preview wrapper ────────────────────────────────────────────────

function EmailPreview({ html, mobile }: { html: string; mobile: boolean }) {
  // SEGURIDAD: el HTML proviene del editor TipTap y de la API; se sanitiza con
  // DOMPurify antes de inyectarlo para evitar XSS almacenado (scripts, onerror,
  // javascript: URIs) en el navegador de quien previsualiza la plantilla.
  const content = DOMPurify.sanitize(applyDemoVars(html));
  return (
    <div
      className="border border-stone-200 rounded-lg overflow-hidden"
      style={{ maxWidth: mobile ? 375 : '100%', margin: '0 auto' }}
    >
      {/* Govt header */}
      <div style={{ background: '#6B1530', padding: '10px 16px' }}>
        <div className="text-white text-[11px] font-bold tracking-wider uppercase">
          Gobierno de Michoacan
        </div>
        <div className="text-white/70 text-[9px] tracking-widest uppercase mt-0.5">
          Honestidad y Trabajo
        </div>
      </div>
      {/* Body */}
      <div
        className="bg-white px-5 py-4 prose prose-sm max-w-none"
        style={{ fontSize: 13, lineHeight: 1.7, color: '#2a2a2a' }}
        dangerouslySetInnerHTML={{ __html: content }}
      />
      {/* Footer */}
      <div
        className="px-5 py-3 text-[10px] text-stone-500 border-t border-stone-100"
        style={{ background: '#f8f4ec' }}
      >
        <div className="font-semibold mb-0.5">Preparatoria Abierta Michoacan</div>
        <div>prepaabierta.michoacan.gob.mx · Morelia, Michoacan</div>
        <div className="mt-1 text-[9px] text-stone-400">
          Este correo es generado automaticamente, no responder a esta direccion.
        </div>
      </div>
    </div>
  );
}

// ─── Vista previa modal ───────────────────────────────────────────────────

function PreviewModal({ plantilla, onClose }: { plantilla: Plantilla; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-stone-200 flex-shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-stone-800">{plantilla.nombre}</h3>
            <p className="text-xs text-stone-400 mt-0.5">Vista previa con datos de ejemplo</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-stone-100"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-3 px-3 py-2 bg-stone-50 rounded border border-stone-200 text-xs">
            <span className="text-stone-400 font-semibold">Asunto:</span>{' '}
            <span className="text-stone-700">{applyDemoVars(plantilla.asunto)}</span>
          </div>
          <EmailPreview html={plantilla.contenidoHtml} mobile={false} />
        </div>
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div
      className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white flex items-center gap-2"
      style={{ background: ok ? '#2d7d46' : '#b91c1c' }}
    >
      {ok ? <CheckCircle size={14} strokeWidth={2} /> : <X size={14} strokeWidth={2} />}
      {msg}
    </div>
  );
}

// ─── Editor view ─────────────────────────────────────────────────────────

function EditorView({
  plantilla,
  onBack,
  onSaved,
}: {
  plantilla: Plantilla;
  onBack: () => void;
  onSaved: (p: Plantilla) => void;
}) {
  const [asunto, setAsunto] = useState(plantilla.asunto);
  const [htmlContent, setHtmlContent] = useState(plantilla.contenidoHtml);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [previewMobile, setPreviewMobile] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const editor = useEditor({
    extensions: [StarterKit, Underline, Link.configure({ openOnClick: false })],
    content: plantilla.contenidoHtml,
    onUpdate: ({ editor: e }) => {
      const h = e.getHTML();
      setHtmlContent(h);
      setDirty(true);
    },
  });

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2800);
  }

  function insertVariable(varName: string) {
    if (!editor) return;
    editor.chain().focus().insertContent(`{{${varName}}}`).run();
    setDirty(true);
  }

  function handleAsuntoChange(v: string) {
    setAsunto(v);
    setDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/configuracion/plantillas-correo/${plantilla.clave}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asunto, contenidoHtml: htmlContent }),
      });
      if (!res.ok) throw new Error();
      const updated: Plantilla = { ...plantilla, asunto, contenidoHtml: htmlContent };
      onSaved(updated);
      setDirty(false);
      showToast('Plantilla guardada correctamente');
    } catch {
      showToast('Error al guardar', false);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    try {
      const res = await fetch(`/api/admin/configuracion/plantillas-correo/${plantilla.clave}/test`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error();
      showToast('Correo de prueba enviado');
    } catch {
      showToast('Error al enviar prueba', false);
    } finally {
      setTesting(false);
    }
  }

  function handleRestore() {
    if (!confirm('Restaurar el contenido original de esta plantilla? Se perderan los cambios actuales.')) return;
    editor?.commands.setContent(plantilla.contenidoHtml);
    setAsunto(plantilla.asunto);
    setHtmlContent(plantilla.contenidoHtml);
    setDirty(false);
  }

  const allVars = Array.from(new Set([...plantilla.variables, ...Object.keys(DEMO_VALS)]));

  return (
    <div>
      {/* Editor header */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden mb-4">
        <div className="px-5 py-3 flex items-center justify-between" style={{ background: '#6B1530' }}>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 text-white/80 hover:text-white text-xs font-medium"
            >
              <ArrowLeft size={14} strokeWidth={2} />
              Volver
            </button>
            <div className="w-px h-4 bg-white/30" />
            <span className="text-sm font-semibold text-white">{plantilla.nombre}</span>
            {dirty && (
              <span
                className="px-2 py-0.5 rounded text-[10px] font-bold"
                style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}
              >
                Sin guardar
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRestore}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-white/30 text-white/80 hover:bg-white/10"
            >
              <RotateCcw size={12} strokeWidth={2} />
              Restaurar original
            </button>
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-white/30 text-white/80 hover:bg-white/10 disabled:opacity-50"
            >
              {testing ? <RefreshCw size={12} strokeWidth={2} className="animate-spin" /> : <Send size={12} strokeWidth={2} />}
              Probar envio
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !dirty}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold text-white disabled:opacity-50"
              style={{ background: dirty ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.4)' }}
            >
              {saving ? <RefreshCw size={12} strokeWidth={2} className="animate-spin" /> : <Save size={12} strokeWidth={2} />}
              Guardar
            </button>
          </div>
        </div>
      </div>

      {/* Split layout */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '55% 1fr' }}>
        {/* Left: editor */}
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden flex flex-col">
          <div className="px-4 py-2.5 border-b border-stone-200 bg-stone-50">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Editor</span>
          </div>

          {/* Asunto */}
          <div className="px-4 pt-4 pb-3 border-b border-stone-100">
            <label className="text-xs font-semibold text-stone-500 block mb-1">Asunto</label>
            <input
              className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#6B1530]"
              value={asunto}
              onChange={(e) => handleAsuntoChange(e.target.value)}
              placeholder="Asunto del correo..."
            />
          </div>

          {/* Variables insertables */}
          <div className="px-4 py-2.5 border-b border-stone-100">
            <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-2">
              Variables disponibles (clic para insertar)
            </div>
            <div className="flex flex-wrap gap-1.5">
              {allVars.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVariable(v)}
                  className="px-2 py-0.5 rounded text-[11px] font-mono border hover:bg-stone-50 transition-colors"
                  style={{ borderColor: '#ddd0c5', color: '#6B1530' }}
                >
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
          </div>

          {/* TipTap */}
          <div className="flex-1 flex flex-col">
            <style>{`.ProseMirror { outline: none; min-height: 200px; }`}</style>
            <EditorToolbar editor={editor} />
            <EditorContent
              editor={editor}
              className="flex-1 prose prose-sm max-w-none p-3 focus:outline-none overflow-y-auto"
            />
          </div>
        </div>

        {/* Right: preview */}
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden flex flex-col">
          <div className="px-4 py-2.5 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Vista previa</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPreviewMobile(false)}
                className="p-1.5 rounded transition-colors"
                style={{
                  background: !previewMobile ? '#f5e6ef' : 'transparent',
                  color: !previewMobile ? '#6B1530' : '#6b635e',
                }}
              >
                <Monitor size={13} strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => setPreviewMobile(true)}
                className="p-1.5 rounded transition-colors"
                style={{
                  background: previewMobile ? '#f5e6ef' : 'transparent',
                  color: previewMobile ? '#6B1530' : '#6b635e',
                }}
              >
                <Smartphone size={13} strokeWidth={2} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-3 px-3 py-2 bg-stone-50 rounded border border-stone-200 text-xs">
              <span className="text-stone-400 font-semibold">Asunto:</span>{' '}
              <span className="text-stone-700">{applyDemoVars(asunto)}</span>
            </div>
            <EmailPreview html={htmlContent} mobile={previewMobile} />
          </div>
        </div>
      </div>

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </div>
  );
}

// ─── List view ────────────────────────────────────────────────────────────

function ListView({
  plantillas,
  onEdit,
}: {
  plantillas: Plantilla[];
  onEdit: (p: Plantilla) => void;
}) {
  const [previewPlantilla, setPreviewPlantilla] = useState<Plantilla | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2800);
  }

  async function handleTest(clave: string) {
    try {
      const res = await fetch(`/api/admin/configuracion/plantillas-correo/${clave}/test`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error();
      showToast('Correo de prueba enviado');
    } catch {
      showToast('Error al enviar prueba', false);
    }
  }

  return (
    <div>
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="px-5 py-3" style={{ background: '#6B1530' }}>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Mail size={14} strokeWidth={2} />
            Plantillas de correo
          </h2>
        </div>
        <div className="divide-y divide-stone-100">
          {plantillas.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-stone-400">
              No se encontraron plantillas.
            </div>
          )}
          {plantillas.map((p) => (
            <div key={p.clave} className="flex items-center gap-4 px-5 py-4 hover:bg-stone-50 transition-colors">
              {/* Icon */}
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: '#f5e6ef' }}
              >
                <Mail size={16} strokeWidth={2} style={{ color: '#6B1530' }} />
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-stone-800">{p.nombre}</div>
                <div className="text-xs text-stone-400 mt-0.5 truncate">{p.descripcion}</div>
              </div>
              {/* Pill */}
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase flex-shrink-0"
                style={
                  p.activa
                    ? { background: '#d1fae5', color: '#2d7d46' }
                    : { background: '#f7f2ed', color: '#6b635e' }
                }
              >
                {p.activa ? 'ACTIVA' : 'INACTIVA'}
              </span>
              {/* Actions */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => onEdit(p)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-50"
                >
                  <Edit2 size={11} strokeWidth={2} />
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewPlantilla(p)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-50"
                >
                  <Eye size={11} strokeWidth={2} />
                  Vista previa
                </button>
                <button
                  type="button"
                  onClick={() => handleTest(p.clave)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-50"
                >
                  <Send size={11} strokeWidth={2} />
                  Probar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {previewPlantilla && (
        <PreviewModal plantilla={previewPlantilla} onClose={() => setPreviewPlantilla(null)} />
      )}
      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────

export default function PlantillasCorreo({ onDirty }: { onDirty?: (d: boolean) => void }) {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<Plantilla | null>(null);

  useEffect(() => {
    fetch('/api/admin/configuracion/plantillas-correo', { credentials: 'include' })
      .then((r) => r.json())
      .then((data: Plantilla[]) => setPlantillas(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleEdit = useCallback(
    (p: Plantilla) => {
      setEditando(p);
      onDirty?.(false);
    },
    [onDirty],
  );

  const handleBack = useCallback(() => {
    setEditando(null);
    onDirty?.(false);
  }, [onDirty]);

  const handleSaved = useCallback(
    (updated: Plantilla) => {
      setPlantillas((prev) => prev.map((p) => (p.clave === updated.clave ? updated : p)));
      setEditando(updated);
    },
    [],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw size={20} className="animate-spin" style={{ color: '#6B1530' }} />
      </div>
    );
  }

  if (editando) {
    return <EditorView plantilla={editando} onBack={handleBack} onSaved={handleSaved} />;
  }

  return <ListView plantillas={plantillas} onEdit={handleEdit} />;
}
