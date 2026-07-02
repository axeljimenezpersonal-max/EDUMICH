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
import EstudianteDashboard from './pages/estudiante/EstudianteDashboard';
import CambiarPasswordPrimerLogin from './pages/estudiante/CambiarPasswordPrimerLogin';
import Avisos from './pages/estudiante/Avisos';
import MiPerfil from './pages/estudiante/MiPerfil';
import MisModulos from './pages/estudiante/MisModulos';
import ModuloDetalle from './pages/estudiante/ModuloDetalle';
import EvaluacionPage from './pages/estudiante/EvaluacionPage';
import { EstudianteLayout } from './pages/estudiante/EstudianteLayout';
import MiExpediente from './pages/estudiante/MiExpediente';
import MiConvocatoria from './pages/estudiante/MiConvocatoria';
import CalendarioConvocatoria from './pages/estudiante/CalendarioConvocatoria';
import PaseExamen from './pages/estudiante/PaseExamen';
import MiIdentificacion from './pages/estudiante/MiIdentificacion';
import MiCedula from './pages/estudiante/MiCedula';
import AutoRegistroEmail from './pages/publico/AutoRegistroEmail';
import AutoRegistroCodigo from './pages/publico/AutoRegistroCodigo';
import AutoRegistroDatos from './pages/publico/AutoRegistroDatos';
import AutoRegistroExito from './pages/publico/AutoRegistroExito';
import SolicitarCuenta from './pages/publico/SolicitarCuenta';
import AvisoPrivacidad from './pages/publico/AvisoPrivacidad';
import RecuperarPassword from './pages/RecuperarPassword';
import ResetPassword from './pages/ResetPassword';
import PagosPendientes from './pages/admin/PagosPendientes';
import PagosAdmin from './pages/admin/PagosAdmin';
import AlumnosCalificaciones from './pages/admin/AlumnosCalificaciones';
import Solicitudes from './pages/admin/SolicitudesLista';
import AdminInicio from './pages/admin/AdminInicio';
import AdminAlumnosLista from './pages/admin/AlumnosLista';
import CapturaMasivaCalificaciones from './pages/admin/CapturaMasivaCalificaciones';
import GestoresLista from './pages/admin/GestoresLista';
import GestorDetalle from './pages/admin/GestorDetalle';
import AdminAlumnoDetalle from './pages/admin/AdminAlumnoDetalle';
import ConvocatoriasLista from './pages/admin/ConvocatoriasLista';
import ConvocatoriaDetalle from './pages/admin/ConvocatoriaDetalle';
import AnunciosLista from './pages/admin/AnunciosLista';
import CorreosEnviados from './pages/admin/CorreosEnviados';
import Reportes from './pages/admin/Reportes';
import Configuracion from './pages/admin/Configuracion';
import VerificacionPase from './pages/admin/VerificacionPase';
import Notificaciones from './pages/Notificaciones';
import DireccionPanorama from './pages/direccion/DireccionPanorama';
import DireccionAcademico from './pages/direccion/DireccionAcademico';
import DireccionOperacion from './pages/direccion/DireccionOperacion';
import DireccionSalud from './pages/direccion/DireccionSalud';
import DireccionProyecciones from './pages/direccion/DireccionProyecciones';
import DireccionReportes from './pages/direccion/DireccionReportes';
import CapacitacionPortada from './pages/capacitacion/CapacitacionPortada';
import ManualAlumno from './pages/capacitacion/ManualAlumno';
import ManualGestor from './pages/capacitacion/ManualGestor';
import ManualAdmin from './pages/capacitacion/ManualAdmin';

export default function App() {
  return (
    <Switch>
      <Route path="/login" component={Login} />

      {/* Rutas del gestor */}
      <Route path="/gestor" component={GestorDashboard} />
      <Route path="/gestor/alumnos" component={AlumnosList} />
      <Route path="/gestor/alumnos/nuevo" component={NuevoAlumno} />
      <Route path="/gestor/alumnos/:id" component={AlumnoDetalle} />

      {/* Rutas del estudiante */}
      <Route path="/estudiante/cambiar-password" component={CambiarPasswordPrimerLogin} />
      <Route path="/estudiante" component={EstudianteDashboard} />
      <Route path="/estudiante/avisos" component={Avisos} />
      <Route path="/estudiante/perfil" component={MiPerfil} />
      <Route path="/estudiante/modulos/:id/evaluacion" component={EvaluacionPage} />
      <Route path="/estudiante/modulos/:id" component={ModuloDetalle} />
      <Route path="/estudiante/modulos" component={MisModulos} />
      <Route path="/estudiante/expediente" component={MiExpediente} />
      <Route path="/estudiante/cedula" component={MiCedula} />
      <Route path="/estudiante/convocatoria/calendario" component={CalendarioConvocatoria} />
      <Route path="/estudiante/convocatoria/pase/:id" component={PaseExamen} />
      <Route path="/estudiante/convocatoria" component={MiConvocatoria} />
      <Route path="/estudiante/identificacion" component={MiIdentificacion} />

      {/* Rutas públicas de registro */}
      <Route path="/registro/email" component={AutoRegistroEmail} />
      <Route path="/registro/codigo" component={AutoRegistroCodigo} />
      <Route path="/registro/datos" component={AutoRegistroDatos} />
      <Route path="/registro/exito" component={AutoRegistroExito} />
      <Route path="/solicitar-cuenta" component={SolicitarCuenta} />
      <Route path="/aviso-privacidad" component={AvisoPrivacidad} />
      <Route path="/recuperar-password" component={RecuperarPassword} />
      <Route path="/reset-password" component={ResetPassword} />

      {/* Admin */}
      <Route path="/admin/solicitudes" component={Solicitudes} />
      <Route path="/admin/pagos" component={PagosAdmin} />
      <Route path="/admin/pagos-pendientes" component={PagosPendientes} />
      <Route path="/admin/alumnos/:id" component={AdminAlumnoDetalle} />
      <Route path="/admin/alumnos" component={AdminAlumnosLista} />
      <Route path="/admin/captura-masiva-calificaciones" component={CapturaMasivaCalificaciones} />
      <Route path="/admin/gestores/:id" component={GestorDetalle} />
      <Route path="/admin/gestores" component={GestoresLista} />
      <Route path="/admin/convocatorias/:id" component={ConvocatoriaDetalle} />
      <Route path="/admin/convocatorias" component={ConvocatoriasLista} />
      <Route path="/admin/anuncios" component={AnunciosLista} />
      <Route path="/admin/correos-enviados" component={CorreosEnviados} />
      <Route path="/admin/verificacion-pase" component={VerificacionPase} />
      <Route path="/admin/reportes" component={Reportes} />
      <Route path="/admin/configuracion/:seccion" component={Configuracion} />
      <Route path="/admin/configuracion"><Redirect to="/admin/configuracion/mi-cuenta" /></Route>
      {/* Redirects: old routes → new filtered views */}
      <Route path="/admin/documentos"><Redirect to="/admin/alumnos?filtro=docs_en_revision" /></Route>
      <Route path="/admin/pagos"><Redirect to="/admin/alumnos?filtro=pagos_pendientes" /></Route>
      <Route path="/admin/calificaciones"><Redirect to="/admin/alumnos?filtro=calif_pendientes" /></Route>
      <Route path="/admin" component={AdminInicio} />

      {/* Dirección de programa — indicadores agregados, solo lectura */}
      <Route path="/direccion/academico" component={DireccionAcademico} />
      <Route path="/direccion/operacion" component={DireccionOperacion} />
      <Route path="/direccion/salud" component={DireccionSalud} />
      <Route path="/direccion/proyecciones" component={DireccionProyecciones} />
      <Route path="/direccion/reportes" component={DireccionReportes} />
      <Route path="/direccion" component={DireccionPanorama} />

      {/* Notificaciones — accesible desde todos los perfiles */}
      <Route path="/notificaciones" component={Notificaciones} />

      {/* Centro de capacitación — público, sin login */}
      <Route path="/capacitacion" component={CapacitacionPortada} />
      <Route path="/capacitacion/alumno" component={ManualAlumno} />
      <Route path="/capacitacion/gestor" component={ManualGestor} />
      <Route path="/capacitacion/admin" component={ManualAdmin} />

      {/* Catch-all → login */}
      <Route>
        <Redirect to="/login" />
      </Route>
    </Switch>
  );
}

function AdminDashboard() {
  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center">
      <div className="bg-white border border-stone-200 rounded-xl p-10 max-w-md text-center">
        <div className="text-xs uppercase tracking-widest text-[var(--color-guinda-700)] font-semibold mb-2">Panel Administrativo</div>
        <h1 className="font-serif text-2xl font-bold text-stone-900 mb-4">Prepa Abierta Michoacán</h1>
        <div className="flex flex-col gap-2">
          <a href="/admin/solicitudes" className="block px-4 py-2 bg-[var(--color-guinda-700)] text-white rounded-lg text-sm font-semibold hover:bg-[var(--color-guinda-800)]">
            Solicitudes de cuenta
          </a>
          <a href="/admin/pagos-pendientes" className="block px-4 py-2 bg-white border border-stone-300 text-stone-700 rounded-lg text-sm font-semibold hover:bg-stone-50">
            Pagos pendientes
          </a>
          <a href="/admin/calificaciones" className="block px-4 py-2 bg-white border border-stone-300 text-stone-700 rounded-lg text-sm font-semibold hover:bg-stone-50">
            Capturar calificaciones
          </a>
        </div>
      </div>
    </div>
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
