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
    // `?escenario=avanzado` muestra a la alumna a MITAD del ciclo (expediente
    // aprobado, exámenes, pagos): es lo que fotografía la guía en PDF. Sin el
    // parámetro se conserva la demo de siempre: un alumno que entra por
    // primera vez.
    const avanzado = new URLSearchParams(window.location.search).get('escenario') === 'avanzado';
    enableDemo('estudiante', avanzado ? 'avanzado' : 'nuevo');
    // En 'avanzado' los tutoriales se dan por vistos dentro de `estaVisto`
    // (ningún tour debe salir encima de una captura); aquí no hay nada que
    // marcar. En 'nuevo' es al revés: alumno de primera vez, sin nada visto.
    if (!avanzado) olvidarTutoriales();
    return true;
  });

  return <EstudianteDashboard />;
}
