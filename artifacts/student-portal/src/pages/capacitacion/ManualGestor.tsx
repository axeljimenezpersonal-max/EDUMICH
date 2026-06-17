/**
 * ManualGestor — Manual del Gestor del Centro de capacitación (/capacitacion/gestor).
 *
 * 6 escenas reproducidas con <ManualPlayer> (navegación por chips):
 * mi panel · mis alumnos · alta de aspirante · documentos · inscripción a
 * convocatoria · calificaciones.
 *
 * OJO (fuente de verdad): el gestor SUBE documentos pero NO los verifica; NO crea
 * convocatorias ni programa exámenes; NO tiene recaudación ni reportes. Eso es del
 * administrador.
 *
 * 100 % presentación/mock — sin datos reales.
 *
 * Ubicación: artifacts/student-portal/src/pages/capacitacion/ManualGestor.tsx
 */

import { Link } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import ManualPlayer, { type Escena } from './ManualPlayer';
import './capacitacion.css';

/** Ícono de documento (line-style). */
const DocIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
  </svg>
);

/** Ícono "+" (subir fotografía). */
const PlusIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const escenas: Escena[] = [
  {
    name: 'Mi panel',
    pill: 'Inicio',
    tag: 'Vista · Gestor · Pátzcuaro',
    caption: (
      <>
        El gestor entra y ve a los alumnos de su <b>municipio</b>: cuántos tiene, cuántos ya tienen
        inscripción y cuántos documentos siguen pendientes de revisión del administrador.
      </>
    ),
    content: (
      <>
        <div className="scr-title">Panel · Gestor municipal</div>
        <div className="tiles">
          <div className="tile"><div className="n">34</div><div className="l">Mis alumnos</div></div>
          <div className="tile"><div className="n">21</div><div className="l">Con inscripción</div></div>
          <div className="tile"><div className="n">5</div><div className="l">Docs pendientes</div></div>
        </div>
        <div className="row"><b>Convocatoria 2026-1</b><span className="st go">Abierta · hasta 20 jun</span></div>
        <div className="row"><b>Aspirantes nuevos</b><span className="st wt">2 esta semana</span></div>
      </>
    ),
  },
  {
    name: 'Mis alumnos',
    pill: 'Mis alumnos',
    tag: 'Vista · Gestor · Pátzcuaro',
    caption: (
      <>
        Ve a <b>todos los alumnos que tiene a su cargo</b> en el municipio, con su estatus, y entra
        al detalle de cualquiera para acompañarlo en su proceso.
      </>
    ),
    content: (
      <>
        <div className="scr-title">Mis alumnos · Pátzcuaro</div>
        <div className="row"><b>García Ruiz, Ana</b><span className="st wt">Docs en revisión</span></div>
        <div className="row"><b>López Martínez, Juan</b><span className="st ok">Inscrito</span></div>
        <div className="row"><b>Pérez Sosa, Lucía</b><span className="st go">Calificación lista</span></div>
        <div className="row"><b>Hernández Gil, Mario</b><span className="st nu">Alta nueva</span></div>
        <div className="row"><b>Ramírez Díaz, Sofía</b><span className="st ok">Inscrito</span></div>
      </>
    ),
  },
  {
    name: 'Alta de aspirante',
    pill: 'Alta de aspirante',
    tag: 'Vista · Gestor · Pátzcuaro',
    caption: (
      <>
        Da de alta a un <b>nuevo aspirante</b> de su municipio con sus datos. El sistema le crea su
        cuenta y queda listo para integrar su expediente.
      </>
    ),
    content: (
      <>
        <div className="scr-title">Dar de alta a un aspirante</div>
        <div className="field"><span>Nombre completo</span><span className="v">Mario Hernández Gil</span></div>
        <div className="field"><span>CURP</span><span className="v">HEGM050714HMN…</span></div>
        <div className="field"><span>Correo</span><span className="v">mario.hg@correo.mx</span></div>
        <div className="field"><span>Municipio</span><span className="v">Pátzcuaro</span></div>
        <div className="cta">Registrar aspirante</div>
      </>
    ),
  },
  {
    name: 'Documentos',
    pill: 'Documentos',
    tag: 'Vista · Gestor · Pátzcuaro',
    caption: (
      <>
        El gestor <b>sube los documentos</b> de cada alumno al expediente. El <b>administrador es
        quien los verifica</b>: por eso aparecen como 'en revisión', 'aceptado' o 'rechazado'.
      </>
    ),
    content: (
      <>
        <div className="scr-title">Expediente · Ana García</div>
        <div className="row"><span className="doc"><DocIcon /><b>Acta de nacimiento</b></span><span className="st ok">Aceptado</span></div>
        <div className="row"><span className="doc"><DocIcon /><b>CURP</b></span><span className="st ok">Aceptado</span></div>
        <div className="row"><span className="doc"><DocIcon /><b>Certificado de secundaria</b></span><span className="st wt">En revisión</span></div>
        <div className="row"><span className="doc"><DocIcon /><b>Comprobante de domicilio</b></span><span className="st no">Rechazado</span></div>
        <div className="row"><span className="doc"><PlusIcon /><b>Fotografía</b></span><span className="st go">Subir</span></div>
      </>
    ),
  },
  {
    name: 'Inscripción',
    pill: 'Inscripción a convocatoria',
    tag: 'Vista · Gestor · Pátzcuaro',
    caption: (
      <>
        Dentro de la <b>convocatoria abierta</b> por la coordinación, el gestor inscribe a su
        alumno: elige el módulo, el día y la hora. Se genera el folio y los datos para el pago del
        examen.
      </>
    ),
    content: (
      <>
        <div className="scr-title">Inscribir · Convocatoria 2026-1</div>
        <div className="field"><span>Alumno</span><span className="v">Ana García Ruiz</span></div>
        <div className="field"><span>Módulo</span><span className="v">Lengua y Comunicación</span></div>
        <div className="field"><span>Día y hora</span><span className="v">Sábado · 09:00</span></div>
        <div className="cta">Generar inscripción y folio de pago</div>
      </>
    ),
  },
  {
    name: 'Calificaciones',
    pill: 'Calificaciones',
    tag: 'Vista · Gestor · Pátzcuaro',
    caption: (
      <>
        Cuando se aplican y califican los exámenes, el gestor <b>consulta las calificaciones</b> de
        sus alumnos y les da seguimiento.
      </>
    ),
    content: (
      <>
        <div className="scr-title">Calificaciones de mis alumnos</div>
        <div className="row"><b>García Ruiz · Lengua y Comunicación</b><span className="st ok">8.6</span></div>
        <div className="row"><b>López Mtz. · Matemáticas I</b><span className="st ok">9.0</span></div>
        <div className="row"><b>Pérez Sosa · Ciencias Sociales</b><span className="st ok">7.8</span></div>
        <div className="row"><b>Ramírez D. · Inglés I</b><span className="st wt">Pendiente</span></div>
      </>
    ),
  },
];

export default function ManualGestor() {
  return (
    <div className="cap-root">
      <div className="topbar">
        <div className="wrap">
          <Link href="/capacitacion"><ArrowLeft size={16} /> Centro de capacitación</Link>
          <span className="mtag">Manual · Gestor</span>
        </div>
      </div>

      <div className="head">
        <div className="wrap">
          <div className="eyebrow">Perfil · Gestor</div>
          <h1>Manual del Gestor</h1>
          <p>
            Acompaña a los alumnos de su municipio: los da de alta, sube sus documentos, los
            inscribe en las convocatorias y consulta sus calificaciones.
          </p>
        </div>
      </div>

      <ManualPlayer escenas={escenas} url="edumich.mx / gestor" nav="chips" />

      <div className="endnote">
        Cuando termines, sigue con el siguiente perfil del recorrido. &nbsp;·&nbsp;{' '}
        <Link href="/capacitacion">Volver al centro de capacitación</Link>
      </div>
    </div>
  );
}
