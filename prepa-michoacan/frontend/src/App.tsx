/**
 * Punto de entrada del frontend.
 * Routing con wouter — define las rutas de cada perfil.
 *
 * Ubicación destino: artifacts/student-portal/src/App.tsx
 */

import { Switch, Route, Redirect } from 'wouter';
import Login from './pages/Login';
import GestorDashboard from './pages/gestor/GestorDashboard';
import AlumnosList from './pages/gestor/AlumnosList';
import NuevoAlumno from './pages/gestor/NuevoAlumno';
import AlumnoDetalle from './pages/gestor/AlumnoDetalle';

export default function App() {
  return (
    <Switch>
      <Route path="/login" component={Login} />

      {/* Rutas del gestor */}
      <Route path="/gestor" component={GestorDashboard} />
      <Route path="/gestor/alumnos" component={AlumnosList} />
      <Route path="/gestor/alumnos/nuevo" component={NuevoAlumno} />
      <Route path="/gestor/alumnos/:id" component={AlumnoDetalle} />

      {/* Placeholders para siguientes fases */}
      <Route path="/admin">
        <PlaceholderPage perfil="Administrador" />
      </Route>
      <Route path="/estudiante">
        <PlaceholderPage perfil="Estudiante" />
      </Route>

      {/* Catch-all → login */}
      <Route>
        <Redirect to="/login" />
      </Route>
    </Switch>
  );
}

function PlaceholderPage({ perfil }: { perfil: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-crema-100)]">
      <div className="bg-white border border-stone-200 rounded-md p-10 max-w-lg text-center">
        <div className="text-xs uppercase tracking-widest text-[var(--color-guinda-700)] font-semibold mb-2">
          Próximamente
        </div>
        <h1 className="font-serif text-2xl font-bold text-stone-900 mb-2">
          Panel del {perfil}
        </h1>
        <p className="text-stone-600 mb-6">
          Esta sección estará disponible en la siguiente fase del proyecto. Por ahora estamos
          enfocando esfuerzos en el panel del Gestor Municipal.
        </p>
        <a href="/login" className="gov-btn-primary inline-block">
          Volver al inicio
        </a>
      </div>
    </div>
  );
}
