/**
 * /demo/estudiante — "así se ve el ingreso de un alumno NUEVO".
 *
 * Activa el modo demo (datos ficticios, sin backend ni sesión) y reinicia el
 * tour de bienvenida ANTES de montar el portal, de modo que el recorrido
 * arranque solo, tal como lo vería el alumno la primera vez. Reutiliza la UI
 * real del estudiante; la cinta "Vista demo" vive en EstudianteLayout, así que
 * persiste al navegar entre secciones.
 */

import { useState } from 'react';
import { enableDemo } from '../../lib/demo';
import { olvidarTutoriales } from '../../lib/tutoriales';
import EstudianteDashboard from '../estudiante/EstudianteDashboard';

export default function DemoEstudiante() {
  // El inicializador de useState corre UNA vez, antes de montar los hijos
  // (cuyos efectos llaman a la API), de modo que el modo demo ya esté activo.
  useState(() => {
    enableDemo('estudiante');
    // La demo es «un alumno que entra por primera vez»: sus tutoriales no
    // pueden venir dados por vistos de una visita anterior.
    olvidarTutoriales();
    return true;
  });

  return <EstudianteDashboard />;
}
