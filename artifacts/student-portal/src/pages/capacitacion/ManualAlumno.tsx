/**
 * ManualAlumno — Manual del Alumno del Centro de capacitación (/capacitacion/alumno).
 *
 * 8 escenas reproducidas con <ManualPlayer> (navegación por chips):
 * portal · expediente · inscripción · solicitar examen · ficha de pago ·
 * mis módulos · calificaciones · credencial digital.
 *
 * 100 % presentación/mock — sin datos reales.
 *
 * Ubicación: artifacts/student-portal/src/pages/capacitacion/ManualAlumno.tsx
 */

import { Link } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import ManualPlayer, { type Escena } from './ManualPlayer';
import './capacitacion.css';

/** Ícono de documento (line-style) reutilizado en las filas del expediente. */
const DocIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
  </svg>
);

const escenas: Escena[] = [
  {
    name: 'Mi portal',
    pill: 'Inicio',
    tag: 'Vista · Alumno',
    caption: (
      <>
        Al entrar, el alumno ve su <b>panel</b>: su avance general y accesos rápidos a su
        expediente, inscripción, exámenes y credencial.
      </>
    ),
    content: (
      <>
        <div className="scr-title">Bienvenida, Ana García</div>
        <div className="tiles">
          <div className="tile"><div className="n">8</div><div className="l">Acreditados</div></div>
          <div className="tile"><div className="n">2</div><div className="l">En curso</div></div>
          <div className="tile"><div className="n">11</div><div className="l">Por cursar</div></div>
        </div>
        <div className="row"><b>Expediente</b><span className="st wt">1 documento por corregir</span></div>
        <div className="row"><b>Próximo examen · Lengua y Comunicación</b><span className="st go">14 jun</span></div>
      </>
    ),
  },
  {
    name: 'Mi expediente',
    pill: 'Mi expediente',
    tag: 'Vista · Alumno',
    caption: (
      <>
        En su <b>expediente</b> sube y consulta sus documentos: cuáles fueron aceptados, cuáles
        están en revisión y cuáles debe corregir o subir.
      </>
    ),
    content: (
      <>
        <div className="scr-title">Mis documentos</div>
        <div className="row"><span className="doc"><DocIcon /><b>Acta de nacimiento</b></span><span className="st ok">Aceptado</span></div>
        <div className="row"><span className="doc"><DocIcon /><b>CURP</b></span><span className="st ok">Aceptado</span></div>
        <div className="row"><span className="doc"><DocIcon /><b>Certificado de secundaria</b></span><span className="st wt">En revisión</span></div>
        <div className="row"><span className="doc"><DocIcon /><b>Comprobante de domicilio</b></span><span className="st no">Rechazado</span></div>
        <div className="row"><span className="doc"><DocIcon /><b>Fotografía</b></span><span className="st nu">Por subir</span></div>
      </>
    ),
  },
  {
    name: 'Inscripción',
    pill: 'Inscripción',
    tag: 'Vista · Alumno',
    caption: (
      <>
        Con su expediente en orden, elige un módulo disponible y se <b>inscribe con un clic</b>.
        Queda listo para solicitar examen.
      </>
    ),
    content: (
      <>
        <div className="scr-title">Inscribirme a un módulo</div>
        <div className="row"><b>Lengua y Comunicación</b><span className="st go">Inscribirme</span></div>
        <div className="row"><b>Inglés I</b><span className="st go">Inscribirme</span></div>
        <div className="row"><b>Cultura Digital</b><span className="st go">Inscribirme</span></div>
        <div className="mini">Al inscribirte, el módulo pasa a "En curso" y puedes solicitar examen cuando estés listo.</div>
      </>
    ),
  },
  {
    name: 'Solicitar examen',
    pill: 'Solicitud de examen',
    tag: 'Vista · Alumno',
    caption: (
      <>
        Elige el módulo, la <b>sede</b> y la <b>fecha</b> disponible, y solicita el examen. La
        plataforma genera la ficha de pago.
      </>
    ),
    content: (
      <>
        <div className="scr-title">Solicitar examen</div>
        <div className="field"><span>Módulo</span><span className="v">Lengua y Comunicación</span></div>
        <div className="field"><span>Sede</span><span className="v">Morelia</span></div>
        <div className="field"><span>Fecha disponible</span><span className="v">14 junio · 10:00</span></div>
        <div className="cta">Solicitar examen y generar ficha</div>
      </>
    ),
  },
  {
    name: 'Ficha de pago',
    pill: 'Ficha de pago',
    tag: 'Vista · Alumno',
    caption: (
      <>
        La ficha trae dos conceptos: el <b>derecho de examen ($101)</b> y la <b>cuota de uso de
        plataforma ($20)</b>. Se paga con una referencia única en banco, ventanilla o en línea.
      </>
    ),
    content: (
      <>
        <div className="scr-title">Ficha de pago</div>
        <div className="receipt">
          <div className="li"><span>Derecho de examen</span><span>$101.00</span></div>
          <div className="li"><span className="hl">Cuota de uso de plataforma</span><span className="hl">$20.00</span></div>
          <div className="li tot"><span>Total a pagar</span><span>$135.00</span></div>
          <div className="ref"><span>Referencia única</span><span className="code">EDU 2026 0014 887</span></div>
          <div className="ref"><span>Vigencia de pago</span><span>3 días · banco o en línea</span></div>
        </div>
      </>
    ),
  },
  {
    name: 'Mis módulos',
    pill: 'Mis módulos',
    tag: 'Vista · Alumno',
    caption: (
      <>
        En <b>Mis pruebas</b> ve los 22 módulos del Plan 22: cuáles ya acreditó, cuáles están en
        curso y cuáles le faltan.
      </>
    ),
    content: (
      <>
        <div className="scr-title">Avance del plan · Plan 22</div>
        <div className="row"><b>Matemáticas I</b><span className="st ok">Acreditado · 9.2</span></div>
        <div className="row"><b>Lengua y Comunicación</b><span className="st go">Examen el 14 jun</span></div>
        <div className="row"><b>Ciencias Sociales</b><span className="st wt">En curso</span></div>
        <div className="row"><b>De la Información al Conocimiento</b><span className="st wt">En curso</span></div>
        <div className="row"><b>Inglés I</b><span className="st nu">Por iniciar</span></div>
      </>
    ),
  },
  {
    name: 'Calificaciones',
    pill: 'Calificaciones',
    tag: 'Vista · Alumno',
    caption: (
      <>
        Cuando el examen se califica, el <b>resultado aparece aquí</b> y el módulo se marca como
        acreditado en su avance.
      </>
    ),
    content: (
      <>
        <div className="scr-title">Mis calificaciones</div>
        <div className="tiles">
          <div className="tile"><div className="n">8.6</div><div className="l">Promedio</div></div>
          <div className="tile"><div className="n">8</div><div className="l">Acreditados</div></div>
          <div className="tile"><div className="n">0</div><div className="l">No acreditados</div></div>
        </div>
        <div className="row"><b>Lengua y Comunicación</b><span className="st ok">Acreditado · 8.6</span></div>
        <div className="row"><b>Matemáticas I</b><span className="st ok">Acreditado · 9.2</span></div>
      </>
    ),
  },
  {
    name: 'Credencial digital',
    pill: 'Credencial digital',
    tag: 'Vista · Alumno',
    caption: (
      <>
        Su <b>credencial digital</b> está siempre disponible, con código QR para validación. La
        muestra desde el celular, sin trámites.
      </>
    ),
    content: (
      <div className="cred">
        <div className="cred-top">
          <div className="em">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.6}>
              <path d="M22 10L12 5 2 10l10 5 10-5z" />
              <path d="M6 12v5c3 3 9 3 12 0v-5" />
            </svg>
          </div>
          <div>
            <div className="ci">Preparatoria Abierta</div>
            <div className="cs">IEMSyS · Plan 22 Modular</div>
          </div>
          <div className="vig">VIGENTE</div>
        </div>
        <div className="cred-band" />
        <div className="cred-body">
          <div className="cphoto">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#B7A99E" strokeWidth={1.5}>
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
            </svg>
          </div>
          <div className="cinfo">
            <div className="cname">Ana García Ruiz</div>
            <div className="cfield"><span>Matrícula</span><b>PA-2026-00887</b></div>
            <div className="cfield"><span>Sede</span><b>Morelia</b></div>
            <div className="cfield"><span>Vigencia</span><b>Dic 2026</b></div>
          </div>
          <div className="cqr">
            <i /><i /><i /><i className="o" /><i /><i /><i className="o" /><i /><i /><i className="o" />
            <i /><i /><i /><i className="o" /><i /><i className="o" /><i /><i className="o" /><i /><i />
            <i /><i /><i className="o" /><i /><i />
          </div>
        </div>
        <div className="cred-foot">Gobierno del Estado de Michoacán · <b>Validar con QR</b></div>
      </div>
    ),
  },
];

export default function ManualAlumno() {
  return (
    <div className="cap-root">
      <div className="topbar">
        <div className="wrap">
          <Link href="/capacitacion"><ArrowLeft size={16} /> Centro de capacitación</Link>
          <span className="mtag">Manual · Alumno</span>
        </div>
      </div>

      <div className="head">
        <div className="wrap">
          <div className="eyebrow">Perfil · Alumno</div>
          <h1>Manual del Alumno</h1>
          <p>
            El recorrido completo: de su expediente y su inscripción hasta llevar la credencial en
            el celular.
          </p>
        </div>
      </div>

      <ManualPlayer escenas={escenas} url="edumich.mx / alumno" nav="chips" />

      <div className="endnote">
        Cuando termines, sigue con el siguiente perfil del recorrido. &nbsp;·&nbsp;{' '}
        <Link href="/capacitacion">Volver al centro de capacitación</Link>
      </div>
    </div>
  );
}
