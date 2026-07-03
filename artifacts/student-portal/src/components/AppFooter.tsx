/**
 * Pie de página institucional — barra guinda, siempre presente en todos los
 * perfiles (alumno, gestor, admin, dirección).
 */
export function AppFooter() {
  return (
    <footer
      className="text-white text-[11px]"
      style={{ background: 'var(--color-guinda-800)' }}
    >
      <div className="max-w-[1400px] mx-auto px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
        <span className="font-medium">© {new Date().getFullYear()} Gobierno del Estado de Michoacán</span>
        <span style={{ opacity: 0.85 }}>
          Powered by <strong>EDUMICH</strong> · Plataforma Educativa Digital
        </span>
        <span style={{ opacity: 0.6 }}>IEMSyS · Preparatoria Abierta</span>
      </div>
    </footer>
  );
}
