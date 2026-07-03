/**
 * CapacitacionPortada — portada del Centro de capacitación EDUMICH (/capacitacion).
 *
 * Hero guinda centrado con un mini-demo del reproductor que rota entre vistas de
 * los tres perfiles, y tres tarjetas (Alumno, Gestor, Administrador) que enlazan
 * a su manual. 100 % presentación/mock.
 *
 * Ubicación: artifacts/student-portal/src/pages/capacitacion/CapacitacionPortada.tsx
 */

import { Link } from 'wouter';
import { GraduationCap, UsersRound, BarChart3 } from 'lucide-react';
import './capacitacion.css';

export default function CapacitacionPortada() {
  return (
    <div className="cap-root">
      {/* ── Hero ───────────────────────────────────────────── */}
      <header className="hero">
        <div className="wrap">
          <div className="eyebrow">Centro de capacitación · EDUMICH</div>
          <h1>
            Tres perfiles.
            <br />
            <span>Tres manuales.</span>
          </h1>
          <p>
            Cada persona ve y usa lo que le toca. En lugar de explicar la plataforma en vivo cada
            vez, aquí cada manual la recorre solo, pantalla por pantalla.
          </p>

          <div className="device" aria-label="Vista previa de la plataforma">
            <div className="bar">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
              <span className="url">edumich.mx / portal</span>
            </div>
            <div className="screens">
              {/* Alumno */}
              <div className="screen">
                <div className="scr-tag">
                  <span>Vista · Alumno</span>
                  <span className="pill">Mis módulos</span>
                </div>
                <div className="scr-title">Avance del plan</div>
                <div className="row"><b>Matemáticas I</b><span className="st ok">Acreditado</span></div>
                <div className="row"><b>Lengua y Comunicación</b><span className="st go">Examen listo</span></div>
                <div className="row"><b>Ciencias Sociales</b><span className="st wt">En curso</span></div>
                <div className="row"><b>Inglés I</b><span className="st wt">Por iniciar</span></div>
              </div>
              {/* Gestor */}
              <div className="screen">
                <div className="scr-tag">
                  <span>Vista · Gestor · Pátzcuaro</span>
                  <span className="pill">Mis alumnos</span>
                </div>
                <div className="scr-title">Alumnos de mi municipio</div>
                <div className="row"><b>García Ruiz, Ana</b><span className="st wt">Docs en revisión</span></div>
                <div className="row"><b>López Mtz., Juan</b><span className="st ok">Inscrito</span></div>
                <div className="row"><b>Pérez Sosa, Lucía</b><span className="st go">Calificación lista</span></div>
                <div className="row"><b>Convocatoria 2026-1</b><span className="st wt">Abierta</span></div>
              </div>
              {/* Administrador */}
              <div className="screen">
                <div className="scr-tag">
                  <span>Vista · Administrador</span>
                  <span className="pill">Tablero estatal</span>
                </div>
                <div className="scr-title">Resumen del estado</div>
                <div className="tiles">
                  <div className="tile"><div className="n">2,371</div><div className="l">Alumnos</div></div>
                  <div className="tile"><div className="n">16,238</div><div className="l">Exámenes/año</div></div>
                  <div className="tile"><div className="n">8</div><div className="l">Sedes</div></div>
                </div>
                <div className="row"><b>Recaudación del mes</b><span className="st ok">Conciliada</span></div>
                <div className="row"><b>Calendario de exámenes</b><span className="st go">Configurar</span></div>
              </div>
              <div className="playhint"><span className="tri" />Se reproduce solo</div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Perfiles ───────────────────────────────────────── */}
      <section className="profiles">
        <div className="wrap">
          <div className="eyebrow">Elige tu perfil</div>
          <h2>Una plataforma, tres recorridos</h2>
          <p className="lead">
            Cada perfil ve y usa módulos distintos. Empieza por el manual que corresponde a tu rol.
          </p>

          <div className="cards">
            {/* Alumno */}
            <article className="pcard">
              <div className="picon"><GraduationCap size={28} strokeWidth={1.7} color="#fff" /></div>
              <h3>Alumno</h3>
              <div className="tag">el que estudia y avanza</div>
              <div className="desc">
                Se inscribe a sus módulos, solicita y paga exámenes, y consulta su avance,
                calificaciones y credencial digital.
              </div>
              <div className="mlbl">Módulos que usa</div>
              <div className="mods">
                <span className="mod">Mis módulos</span>
                <span className="mod">Solicitud de examen</span>
                <span className="mod">Ficha de pago</span>
                <span className="mod">Calificaciones</span>
                <span className="mod">Credencial digital</span>
              </div>
              <div className="spacer" />
              <Link href="/capacitacion/alumno" className="btn"><span className="tri" />Ver manual</Link>
              <div className="soon">Disponible</div>
            </article>

            {/* Gestor */}
            <article className="pcard">
              <div className="picon"><UsersRound size={28} strokeWidth={1.7} color="#fff" /></div>
              <h3>Gestor</h3>
              <div className="tag">el que acompaña a sus alumnos</div>
              <div className="desc">
                Da de alta a los aspirantes de su municipio, sube sus documentos al expediente, los
                inscribe en las convocatorias de examen y consulta sus calificaciones.
              </div>
              <div className="mlbl">Módulos que usa</div>
              <div className="mods">
                <span className="mod">Mis alumnos</span>
                <span className="mod">Alta de aspirante</span>
                <span className="mod">Documentos</span>
                <span className="mod">Inscripción a convocatoria</span>
                <span className="mod">Calificaciones</span>
              </div>
              <div className="spacer" />
              <Link href="/capacitacion/gestor" className="btn"><span className="tri" />Ver manual</Link>
              <div className="soon">Disponible</div>
            </article>

            {/* Administrador */}
            <article className="pcard">
              <div className="picon"><BarChart3 size={28} strokeWidth={1.7} color="#fff" /></div>
              <h3>Administrador</h3>
              <div className="tag">el que autoriza y supervisa</div>
              <div className="desc">
                Aprueba solicitudes y asigna gestores, verifica los documentos y los pagos, gestiona
                las convocatorias y publica avisos. Consulta la recaudación y todos los reportes del
                estado.
              </div>
              <div className="mlbl">Módulos que usa</div>
              <div className="mods">
                <span className="mod">Solicitudes</span>
                <span className="mod">Verificación de documentos</span>
                <span className="mod">Convocatorias</span>
                <span className="mod">Recaudación</span>
                <span className="mod">Reportes</span>
              </div>
              <div className="spacer" />
              <Link href="/capacitacion/admin" className="btn"><span className="tri" />Ver manual</Link>
              <div className="soon">Disponible</div>
            </article>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="bs">EDUMICH</div>
        Centro de capacitación · Preparatoria Abierta
        <div className="hier">EDUMICH · Preparatoria Abierta · IEMSyS · Gobierno de Michoacán</div>
      </footer>
    </div>
  );
}
