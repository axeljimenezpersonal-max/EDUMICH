/**
 * ManualAdmin — Manual del Administrador del Centro de capacitación (/capacitacion/admin).
 *
 * Consola con MENÚ LATERAL (10 secciones, íconos lucide) reproducida con
 * <ManualPlayer nav="sidebar">:
 * Inicio · Solicitudes · Documentos · Pagos · Convocatorias · Gestores ·
 * Calificaciones · Anuncios · Reportes · Verificación QR.
 *
 * El administrador aprueba/asigna, verifica documentos y pagos, gestiona
 * convocatorias, publica anuncios, captura calificaciones, ve recaudación y los
 * 8 reportes, y valida credenciales por QR en sede (registra asistencia).
 *
 * 100 % presentación/mock — sin datos reales.
 *
 * Ubicación: artifacts/student-portal/src/pages/capacitacion/ManualAdmin.tsx
 */

import { Link } from 'wouter';
import {
  ArrowLeft, LayoutGrid, Inbox, FileCheck, CreditCard, Calendar,
  Users, GraduationCap, Megaphone, BarChart3, QrCode, Check,
} from 'lucide-react';
import ManualPlayer, { type Escena } from './ManualPlayer';
import './capacitacion.css';

/** Ícono de documento (line-style) para las filas de verificación. */
const DocIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
  </svg>
);

const escenas: Escena[] = [
  {
    name: 'Inicio',
    pill: 'Tablero',
    tag: 'Vista · Administrador',
    icon: <LayoutGrid size={13} />,
    caption: (
      <>
        El <b>tablero</b> abre con todo el pulso del estado: alumnos, inscripciones, gestores y
        recaudación, las tareas pendientes del día y las inscripciones por etapa de la convocatoria.
      </>
    ),
    content: (
      <>
        <div className="ghi">Hola, Dirección de Preparatoria Abierta · <b>8 tareas pendientes hoy</b></div>
        <div className="ktiles">
          <div className="ktile"><div className="n">2,371</div><div className="l">Alumnos activos</div></div>
          <div className="ktile"><div className="n">1,284</div><div className="l">Inscritos 2026-1</div></div>
          <div className="ktile"><div className="n">8</div><div className="l">Gestores</div></div>
          <div className="ktile"><div className="n">$26,200</div><div className="l">Recaudación jun</div></div>
        </div>
        <div className="clbl">Inscripciones por etapa</div>
        <div className="chart">
          <div className="bx"><div className="bar" style={{ height: '55%' }} /><div className="cl">Et. 1</div></div>
          <div className="bx"><div className="bar" style={{ height: '82%' }} /><div className="cl">Et. 2</div></div>
          <div className="bx"><div className="bar" style={{ height: '48%' }} /><div className="cl">Et. 3</div></div>
          <div className="bx"><div className="bar" style={{ height: '70%' }} /><div className="cl">Et. 4</div></div>
          <div className="bx"><div className="bar" style={{ height: '33%' }} /><div className="cl">Et. 5</div></div>
        </div>
      </>
    ),
  },
  {
    name: 'Solicitudes',
    pill: 'Solicitudes de cuenta',
    tag: 'Vista · Administrador',
    icon: <Inbox size={13} />,
    caption: (
      <>
        Revisa las <b>solicitudes públicas</b> de cuenta. Al aprobar, asigna un gestor del municipio
        con cupo disponible y el sistema crea la cuenta del alumno y le envía sus accesos.
      </>
    ),
    content: (
      <>
        <div className="scr-title">Solicitudes de cuenta</div>
        <div className="row"><span className="doc"><b>Torres Reyes, María C.</b> · Pátzcuaro</span><span className="acts"><span className="act acc">Aprobar</span><span className="act rej">Rechazar</span></span></div>
        <div className="row"><span className="doc"><b>Vargas Mendoza, Roberto</b> · Morelia</span><span className="acts"><span className="act acc">Aprobar</span><span className="act rej">Rechazar</span></span></div>
        <div className="field"><span>Asignar gestor (municipio)</span><span className="v">Pátzcuaro · 34/40</span></div>
        <div className="mini">Al aprobar se crea la cuenta y se envían las credenciales por correo.</div>
      </>
    ),
  },
  {
    name: 'Documentos',
    pill: 'Verificación de documentos',
    tag: 'Vista · Administrador',
    icon: <FileCheck size={13} />,
    caption: (
      <>
        El administrador <b>verifica los documentos</b> que subió el gestor: los aprueba o los
        rechaza con un motivo. Esa decisión es la que ven el gestor y el alumno en el expediente.
      </>
    ),
    content: (
      <>
        <div className="scr-title">Verificar expediente · Ana García</div>
        <div className="row"><span className="doc"><DocIcon /><b>Acta de nacimiento</b></span><span className="acts"><span className="act acc">Aprobar</span><span className="act rej">Rechazar</span></span></div>
        <div className="row"><span className="doc"><DocIcon /><b>CURP</b></span><span className="st ok">Aprobado</span></div>
        <div className="row"><span className="doc"><DocIcon /><b>Certificado de secundaria</b></span><span className="acts"><span className="act acc">Aprobar</span><span className="act rej">Rechazar</span></span></div>
        <div className="row"><span className="doc"><DocIcon /><b>Comprobante de domicilio</b></span><span className="st no">Rechazado</span></div>
      </>
    ),
  },
  {
    name: 'Pagos',
    pill: 'Pagos por verificar',
    tag: 'Vista · Administrador',
    icon: <CreditCard size={13} />,
    caption: (
      <>
        Revisa los <b>comprobantes de pago</b> y los verifica. El pago verificado libera la
        inscripción del alumno y suma a la recaudación del mes.
      </>
    ),
    content: (
      <>
        <div className="scr-title">Pagos por verificar</div>
        <div className="row"><span className="doc"><b>García Ruiz, Ana</b> · $135.00</span><span className="acts"><span className="act acc">Verificar</span><span className="act rej">Rechazar</span></span></div>
        <div className="row"><span className="doc"><b>López Mtz., Juan</b> · $135.00</span><span className="st ok">Verificado</span></div>
        <div className="row"><span className="doc"><b>Pérez Sosa, Lucía</b> · $135.00</span><span className="acts"><span className="act acc">Verificar</span><span className="act rej">Rechazar</span></span></div>
        <div className="mini">Cada pago verificado se refleja en el reporte financiero y la recaudación.</div>
      </>
    ),
  },
  {
    name: 'Convocatorias',
    pill: 'Convocatorias',
    tag: 'Vista · Administrador',
    icon: <Calendar size={13} />,
    caption: (
      <>
        Crea y administra las <b>convocatorias</b>: etapas, fechas de solicitud y de examen, módulos
        y sedes. Es lo que abre el periodo para que los gestores inscriban a sus alumnos.
      </>
    ),
    content: (
      <>
        <div className="scr-title">Convocatoria 2026-1</div>
        <div className="field"><span>Estado</span><span className="v">Abierta</span></div>
        <div className="field"><span>Solicitudes</span><span className="v">1 – 20 junio</span></div>
        <div className="field"><span>Examen</span><span className="v">Sáb 21 y Dom 22 jun</span></div>
        <div className="field"><span>Sedes</span><span className="v">8 · Morelia, Pátzcuaro…</span></div>
        <div className="cta">Nueva convocatoria</div>
      </>
    ),
  },
  {
    name: 'Gestores',
    pill: 'Gestores',
    tag: 'Vista · Administrador',
    icon: <Users size={13} />,
    caption: (
      <>
        Da de alta y administra a los <b>gestores municipales</b>, define su cupo de alumnos y revisa
        su productividad por municipio.
      </>
    ),
    content: (
      <>
        <div className="scr-title">Gestores municipales</div>
        <div className="row"><b>Pátzcuaro</b><span className="st wt">34 / 40 alumnos</span></div>
        <div className="row"><b>Morelia</b><span className="st ok">120 / 150 alumnos</span></div>
        <div className="row"><b>Uruapan</b><span className="st nu">Sin asignar</span></div>
        <div className="cta">Dar de alta un gestor</div>
      </>
    ),
  },
  {
    name: 'Calificaciones',
    pill: 'Captura de calificaciones',
    tag: 'Vista · Administrador',
    icon: <GraduationCap size={13} />,
    caption: (
      <>
        Captura las <b>calificaciones</b> de los exámenes —una por una o de forma masiva por
        convocatoria— y se reflejan al instante en el avance de cada alumno.
      </>
    ),
    content: (
      <>
        <div className="scr-title">Captura de calificaciones</div>
        <div className="field"><span>Ana García · Lengua y Comunicación</span><span className="v">8.6</span></div>
        <div className="field"><span>Juan López · Matemáticas I</span><span className="v">9.0</span></div>
        <div className="field"><span>Lucía Pérez · Ciencias Sociales</span><span className="v">7.8</span></div>
        <div className="cta">Guardar calificaciones</div>
      </>
    ),
  },
  {
    name: 'Anuncios',
    pill: 'Anuncios',
    tag: 'Vista · Administrador',
    icon: <Megaphone size={13} />,
    caption: (
      <>
        Publica <b>avisos y anuncios</b> dirigidos a alumnos, gestores o a todos: convocatorias,
        recordatorios de examen o material nuevo.
      </>
    ),
    content: (
      <>
        <div className="scr-title">Publicar anuncio</div>
        <div className="field"><span>Título</span><span className="v">Examen Convocatoria 2026-1</span></div>
        <div className="field"><span>Prioridad</span><span className="v">Importante</span></div>
        <div className="field"><span>Dirigido a</span><span className="v">Todos</span></div>
        <div className="cta">Publicar anuncio</div>
      </>
    ),
  },
  {
    name: 'Reportes',
    pill: 'Reportes',
    tag: 'Vista · Administrador',
    icon: <BarChart3 size={13} />,
    caption: (
      <>
        Genera <b>ocho reportes</b> —inscripciones, expedientes, financiero, académico, gestores,
        convocatorias, solicitudes y el ejecutivo consolidado— en Excel o PDF, con filtros por
        fecha, municipio y gestor.
      </>
    ),
    content: (
      <>
        <div className="scr-title">Reportes institucionales</div>
        <div className="rgrid">
          <div className="rc"><div className="t">Inscripciones</div><div className="d">Por convocatoria y municipio</div></div>
          <div className="rc"><div className="t">Financiero</div><div className="d">Pagos y recaudación</div></div>
          <div className="rc"><div className="t">Expedientes</div><div className="d">Documentos por alumno</div></div>
          <div className="rc"><div className="t">Académico</div><div className="d">Calificaciones y aprobación</div></div>
          <div className="rc"><div className="t">Gestores</div><div className="d">Productividad por gestor</div></div>
          <div className="rc"><div className="t">Ejecutivo</div><div className="d">KPIs consolidados</div></div>
        </div>
        <div className="mini">También: Convocatorias y Solicitudes · exporta en Excel o PDF.</div>
      </>
    ),
  },
  {
    name: 'Verificación QR',
    pill: 'Verificación por QR',
    tag: 'Vista · Administrador',
    icon: <QrCode size={13} />,
    caption: (
      <>
        En la sede, el administrador <b>escanea con la cámara el QR</b> de la credencial digital del
        alumno. El sistema valida la firma, confirma su identidad y su módulo, y <b>registra su
        asistencia</b> al examen.
      </>
    ),
    content: (
      <>
        <div className="scr-title">Validar credencial en sede</div>
        <div className="cam">
          <div className="frame">
            <span className="cnr tl" /><span className="cnr tr" /><span className="cnr bl" /><span className="cnr br" />
            <div className="qrmini">
              <i /><i /><i className="o" /><i /><i /><i /><i className="o" /><i /><i className="o" /><i />
              <i className="o" /><i /><i /><i /><i className="o" /><i /><i className="o" /><i /><i className="o" /><i />
              <i /><i /><i className="o" /><i /><i />
            </div>
            <div className="scanline" />
          </div>
          <div className="camhint">Apunta al código QR de la credencial</div>
        </div>
        <div className="vok">
          <span className="vchk"><Check size={17} strokeWidth={2.4} /></span>
          <div>
            <div className="vname">Pase válido · Ana García Ruiz</div>
            <div className="vsub">Lengua y Comunicación · Asistencia registrada</div>
          </div>
        </div>
      </>
    ),
  },
];

export default function ManualAdmin() {
  return (
    <div className="cap-root cap-admin">
      <div className="topbar">
        <div className="wrap">
          <Link href="/capacitacion"><ArrowLeft size={16} /> Centro de capacitación</Link>
          <span className="mtag">Manual · Administrador</span>
        </div>
      </div>

      <div className="head">
        <div className="wrap">
          <div className="eyebrow">Perfil · Administrador</div>
          <h1>Manual del Administrador</h1>
          <p>
            El panel de la coordinación: aprueba, verifica, convoca y supervisa todo el estado.
            Recorre sus diez secciones desde el menú.
          </p>
        </div>
      </div>

      <ManualPlayer
        escenas={escenas}
        url="edumich.mx / admin"
        nav="sidebar"
        sideHeading="Panel"
        counterLabel="Sección"
        durationMs={6500}
      />

      <div className="endnote">
        Con esto cierra el recorrido de los tres perfiles. &nbsp;·&nbsp;{' '}
        <Link href="/capacitacion">Volver al centro de capacitación</Link>
      </div>
    </div>
  );
}
