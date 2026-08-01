/**
 * GENERADOR — Guía del gestor en PDF.
 *
 * Hermana de `generar-guia-alumno.mjs` y heredera de sus 17 reglas (LEEME.md).
 * Diferencia clave: esta guía es **100 % láminas propias** — el modo demo del
 * gestor no existe y no hace falta: las láminas fueron lo mejor calificado de
 * la guía del alumno, y no envejecen cuando cambia la interfaz.
 *
 * Los ayudantes se duplican A PROPÓSITO en vez de compartirse en un módulo:
 * la guía del alumno está APROBADA como v1 y su generador no se toca; un
 * refactor compartido pondría en riesgo un artefacto ya validado.
 *
 * Uso:  node docs/guias/generar-guia-gestor.mjs
 * Salida: docs/guias/Guia-Gestor-Modula22.pdf (ASCII, regla 7 de CLAUDE.md).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

function cargarPlaywright() {
  const candidatos = [process.env.GUIAS_PW, process.cwd(), process.env.GUIAS_PW_FALLBACK].filter(Boolean);
  for (const base of candidatos) {
    try { return createRequire(path.join(base, 'package.json'))('playwright-core'); } catch { /* sigue */ }
  }
  console.error('✋ Falta playwright-core (ver encabezado de capturar-alumno.mjs).');
  process.exit(1);
}
const { chromium } = cargarPlaywright();

const AQUI = import.meta.dirname;
const SALIDA = path.join(AQUI, 'Guia-Gestor-Modula22.pdf');

function fuente(archivo) {
  return fs.readFileSync(path.join(AQUI, 'fuentes', archivo)).toString('base64');
}

const fechaCruda = new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
const FECHA_VERSION = fechaCruda.charAt(0).toUpperCase() + fechaCruda.slice(1);

// ── Paleta (manual de identidad + portal) ──────────────────────────────────
const C = {
  guinda: '#6b1530', guindaOscuro: '#4a0e20', guindaNoche: '#2e0814',
  crema: '#f7f2ed', cremaClaro: '#fcfaf7', linea: '#e7dfd5',
  dorado: '#b89968', doradoSuave: '#cdb48c',
  tinta: '#2b2320', gris: '#6b615a',
  verde: '#2d7d46', verdeFondo: '#f0fdf4',
  ambarTexto: '#a16207', ambarFondo: '#fefce8',
  rojo: '#b91c1c', rojoFondo: '#fef2f2',
  moradoExamen: '#6d28d9', rosaInscripcion: '#f7e6ec', rosaBorde: '#e3b5c4',
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// ── Piezas ─────────────────────────────────────────────────────────────────
const kicker = (t) => `<div class="kicker">${esc(t)}</div>`;
const pagina = (contenido, extra = '') => `<section class="pagina ${extra}">${contenido}</section>`;

function lamina(contenidoHtml, pie) {
  return `
  <figure class="fig fig-ancha">
    <div class="fig-marco lamina">${contenidoHtml}</div>
    <figcaption><span class="fig-punto"></span>${esc(pie)}</figcaption>
  </figure>`;
}

function paso(n, titulo, cuerpo) {
  return `
  <div class="paso">
    <div class="paso-n">${n}</div>
    <div class="paso-c">
      <h3>${esc(titulo)}</h3>
      <p>${cuerpo}</p>
    </div>
  </div>`;
}

const cita = (texto) => `<div class="cita">${texto}</div>`;
const ojo = (texto) => `<div class="cita ojo"><div class="ojo-k">OJO</div>${texto}</div>`;
const tarjeta = (titulo, cuerpo) => `<div class="tarjeta"><h4>${esc(titulo)}</h4><p>${cuerpo}</p></div>`;

function encabezadoCap(numero, titulo, lede) {
  return `
  ${kicker(`CAPÍTULO ${String(numero).padStart(2, '0')}`)}
  <h2 class="cap-titulo">${esc(titulo)}</h2>
  ${lede ? `<p class="lede">${lede}</p>` : ''}`;
}

const chip = (texto, fondo, color) =>
  `<span class="chip" style="background:${fondo};color:${color}">${esc(texto)}</span>`;

function icono(paths, opts = {}) {
  const t = opts.color ?? C.guinda;
  return `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="${t}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}
const I = {
  doc: () => icono('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6"/><path d="M9 17h6"/>'),
  descarga: (c) => icono('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>', { color: c }),
  copiar: () => icono('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
  paloma: (c) => icono('<path d="M20 6L9 17l-5-5"/>', { color: c }),
  busqueda: () => icono('<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/>'),
  correo: () => icono('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/>'),
  usuarios: () => icono('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  chat: () => icono('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
  reloj: () => icono('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'),
  candado: () => icono('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
};

// ── Portada, índice y camino ───────────────────────────────────────────────

const PORTADA = pagina(`
  <div class="kicker">MODULA · PLAN 22 · ${FECHA_VERSION.toUpperCase()}</div>
  <div class="portada-centro">
    <div class="portada-logo">M<span>22</span></div>
    <h1>Guía del<br/>gestor</h1>
    <div class="kicker" style="margin-top:6mm">CENTROS DE ASESORÍA · VERSIÓN ${FECHA_VERSION.toUpperCase()}</div>
    <p class="portada-frase">Tú llevas a tus alumnos de la mano.<br/>
    Esta guía te lleva a ti: <span>5 pasos</span> por etapa, sin perderte uno.</p>
  </div>
  <div class="pie-portada">PREPA.MODULA22.MX · IEMSYS · GOBIERNO DE MICHOACÁN</div>
`, 'oscura');

const INDICE = pagina(`
  ${kicker('CONTENIDO')}
  <h2 class="cap-titulo">Lo que vas<br/>a encontrar</h2>
  <div class="indice">
    <div class="ind-fila"><span class="ind-n">01</span><span class="ind-t">Tu panel</span><span class="ind-d">fechas, indicadores y accesos</span></div>
    <div class="ind-fila"><span class="ind-n">02</span><span class="ind-t">Paso 1 · Registra a tu alumno</span><span class="ind-d">alta, CURP y su cuenta</span></div>
    <div class="ind-fila"><span class="ind-n">03</span><span class="ind-t">Paso 2 · Su expediente</span><span class="ind-d">tus alumnos y su ficha</span></div>
    <div class="ind-fila"><span class="ind-n">04</span><span class="ind-t">Paso 3 · Inscríbelos</span><span class="ind-d">en lote, dentro de la ventana</span></div>
    <div class="ind-fila"><span class="ind-n">05</span><span class="ind-t">Paso 4 · Paga sus exámenes</span><span class="ind-d">la ficha grupal, de la solicitud al comprobante</span></div>
    <div class="ind-fila"><span class="ind-n">06</span><span class="ind-t">Paso 5 · Sus resultados</span><span class="ind-d">seguimiento y descarga</span></div>
    <div class="ind-fila"><span class="ind-n">07</span><span class="ind-t">Herramientas</span><span class="ind-d">calendario, preguntas y mi aula</span></div>
    <div class="ind-fila"><span class="ind-n">08</span><span class="ind-t">¿Necesitas ayuda?</span><span class="ind-d">a quién y con qué datos</span></div>
    <div class="ind-fila"><span class="ind-n">✓</span><span class="ind-t">Tu lista de cotejo</span><span class="ind-d">una etapa con tus alumnos</span></div>
  </div>
`);

const CAMINO = pagina(`
  ${kicker('ANTES DE EMPEZAR')}
  <h2 class="cap-titulo">Tu papel son 5 pasos</h2>
  <p class="lede">Con cada alumno, en este orden. Cada convocatoria los repite — hay 8 al año.</p>
  <div class="camino camino5">
    <div class="cam"><div class="cam-n">1</div><h4>Registra</h4><p>Su alta: datos, documentos y su cuenta.</p></div>
    <div class="cam"><div class="cam-n">2</div><h4>Documenta</h4><p>Expediente 5/5 aprobado y matrícula.</p></div>
    <div class="cam"><div class="cam-n">3</div><h4>Inscribe</h4><p>Sus módulos, dentro de la ventana.</p></div>
    <div class="cam"><div class="cam-n">4</div><h4>Paga</h4><p>Ficha ante la Tesorería y comprobante.</p></div>
    <div class="cam"><div class="cam-n">5</div><h4>Acompaña</h4><p>Sede, examen y sus resultados.</p></div>
  </div>
  ${cita(`<strong>Tú eres el único que puede inscribir y pagar por tus alumnos.</strong> Ellos ven su
    avance en su propio portal, pero esos dos trámites pasan por ti — su guía se los dice con estas
    mismas palabras, para que nadie se estrese buscando botones que no tiene.`)}
`);

// ── Cap. 1 · Tu panel ──────────────────────────────────────────────────────

const LAMINA_PANEL = `
  <div class="panel">
    <div class="panel-cab">
      <div><div class="panel-hola">Hola, Centro Guadalupe Victoria</div>
        <div class="panel-sub">Panel del gestor</div></div>
      ${chip('Etapa 2699-B · inscripción abierta', C.verdeFondo, C.verde)}
    </div>
    <div class="panel-etq">FECHAS QUE IMPORTAN</div>
    <div class="panel-fechas">
      <div class="pf"><span class="pf-punto pf-rosa"></span><div><strong>Inscripción</strong><span>27 – 31 de julio</span></div></div>
      <div class="pf"><span class="pf-punto pf-morado"></span><div><strong>Exámenes</strong><span>22 – 23 de agosto</span></div></div>
    </div>
    <div class="panel-etq">TUS INDICADORES</div>
    <div class="panel-nums">
      <div class="pn"><strong>12</strong><span>alumnos</span></div>
      <div class="pn"><strong>9</strong><span>expedientes 5/5</span></div>
      <div class="pn pn-activo"><strong>5</strong><span>en esta etapa</span></div>
      <div class="pn"><strong>2</strong><span>pagos por confirmar</span></div>
    </div>
  </div>`;

const CAP1 = pagina(`
  ${encabezadoCap(1, 'Tu panel', 'Tu día empieza aquí: qué fechas corren y cómo van tus alumnos.')}
  ${paso('1.1', 'Fechas que importan', `Arriba siempre está la etapa en curso: cuándo abre y cierra su
    inscripción y cuándo son los exámenes. Es lo primero que conviene mirar cada día.`)}
  ${paso('1.2', 'Tus indicadores', `Cuántos alumnos tienes, cuántos ya están en 5/5, cuántos van en la
    etapa actual y qué pagos siguen pendientes. Si un número no cuadra, entra y revisa.`)}
  ${lamina(LAMINA_PANEL, 'Ejemplo: tu panel — la etapa en curso, sus fechas y tus números')}
  ${cita(`Si te pierdes, vuelve a Inicio. El botón de ayuda <strong>(?)</strong> reinicia el tutorial
    de cada sección cuando quieras.`)}
`);

// ── Cap. 2 · Registra ──────────────────────────────────────────────────────

const LAMINA_ALTA = `
  <div class="alta">
    <div class="alta-stepper">
      <div class="as as-activo"><span>1</span> Sus datos</div>
      <div class="as-linea"></div>
      <div class="as"><span>2</span> Sus documentos</div>
    </div>
    <div class="campo"><div class="campo-etq">CURP</div>
      <div class="campo-caja">RATA050312MMNMRN08 <span class="alta-ok">${I.paloma(C.verde)} CURP válida</span></div></div>
    <div class="campo"><div class="campo-etq">Correo del alumno</div>
      <div class="campo-caja">${I.correo()} ana.ramirez@correo.com</div></div>
    <div class="alta-nota">A este correo le llegarán sus credenciales de acceso.</div>
  </div>`;

const CAP2 = pagina(`
  ${encabezadoCap(2, 'Paso 1 · Registra a tu alumno', 'Su alta toma cinco minutos y se puede hacer cualquier día.')}
  ${paso('2.1', 'Registrar no es inscribir', `El alta —su cuenta y su expediente— se hace
    <strong>cuando sea</strong>. Inscribirlo a examen es aparte (capítulo 4) y solo en la ventana.
    Por eso conviene registrar y documentar con calma, ANTES de que la ventana abra.`)}
  ${paso('2.2', 'Son dos pasos', `Primero sus datos; luego sus documentos. La <strong>CURP se valida
    sola</strong> —estructura, datos y duplicados al vuelo— y el sistema te avisa si esa persona ya
    existe.`)}
  ${paso('2.3', 'Cuida su correo', `Al registrarlo, el sistema le envía sus credenciales para entrar a
    su propio portal. Si no le llegan, desde su ficha puedes <strong>reenviárselas</strong>.`)}
  ${lamina(LAMINA_ALTA, 'Ejemplo: el alta en dos pasos, con la CURP validada al vuelo')}
  ${ojo(`Su registro queda <strong>pendiente de revisión</strong> hasta que la administración valida
    sus documentos. No es un error: es el candado normal del trámite.`)}
`);

// ── Cap. 3 · Su expediente ─────────────────────────────────────────────────

const LAMINA_ALUMNOS = `
  <div class="lista">
    <div class="lista-buscar">${I.busqueda()} <span>Buscar por nombre o CURP…</span></div>
    <div class="al-fila">
      <div class="al-quien"><strong>Ana Sofía Ramírez Torres</strong><span>RATA050312···</span></div>
      ${chip('Expediente 5/5', C.verdeFondo, C.verde)}
    </div>
    <div class="al-fila">
      <div class="al-quien"><strong>Luis Fernando García Mendoza</strong><span>GAML040722···</span></div>
      ${chip('Documentos 3/5', C.ambarFondo, C.ambarTexto)}
    </div>
    <div class="al-fila">
      <div class="al-quien"><strong>María José Hernández López</strong><span>HELM060118···</span></div>
      ${chip('Matrícula pendiente', '#dbeafe', '#1d4ed8')}
    </div>
  </div>`;

const CAP3A = pagina(`
  ${encabezadoCap(3, 'Paso 2 · Su expediente', 'Mis alumnos es tu lista de trabajo: ahí se ve quién está listo y a quién le falta.')}
  ${paso('3.1', 'Tus alumnos, de un vistazo', `En <strong>Mis alumnos</strong> están todos. Busca por
    nombre o CURP, filtra por etapa, y la etiqueta de cada uno te dice exactamente en qué va.`)}
  ${lamina(LAMINA_ALUMNOS, 'Ejemplo: tu lista, con la etapa de cada alumno a la vista')}
  ${paso('3.2', 'Entra a su ficha', `Toca a cualquiera y ahí vive su trámite completo, por pestañas:
    <strong>Documentos · Inscripción · Pagos · Calificaciones · Credencial</strong>. Todo lo de esa
    persona, en un solo lugar.`)}
`);

const LAMINA_DOCS_G = `
  <div class="estados">
    <div class="est-fila">
      <div class="est-doc">${I.doc()} <strong>CURP</strong></div>
      ${chip('Aprobado', C.verdeFondo, C.verde)}
      <span class="est-desc">Ya cuenta para su 5/5.</span>
    </div>
    <div class="est-fila">
      <div class="est-doc">${I.doc()} <strong>Acta de nacimiento</strong></div>
      ${chip('En revisión', C.ambarFondo, C.ambarTexto)}
      <span class="est-desc">La administración la está revisando.</span>
    </div>
    <div class="est-fila">
      <div class="est-doc">${I.doc()} <strong>Comprobante de domicilio</strong></div>
      ${chip('Rechazado', C.rojoFondo, C.rojo)}
      <span class="est-desc"><strong>Motivo: "borroso".</strong> Súbelo de nuevo corregido.</span>
    </div>
  </div>`;

const CAP3B = pagina(`
  ${kicker('CAPÍTULO 03 · CONTINUACIÓN')}
  ${paso('3.3', 'Sube sus documentos', `Los 5 obligatorios (CURP, acta, identificación, comprobante de
    domicilio, certificado de secundaria) más su fotografía. Cada uno queda en revisión de la
    administración; si algo se rechaza, ahí dice el motivo.`)}
  ${lamina(LAMINA_DOCS_G, 'Ejemplo: los tres estados de un documento en su ficha')}
  ${paso('3.4', 'Su matrícula llega sola', `Cuando su expediente queda 5/5, la administración le asigna
    su <strong>matrícula oficial</strong>. Con ella, el alumno ya es elegible para inscribirse.`)}
  ${cita(`El alumno también puede subir documentos desde su propio portal — vale lo que llegue
    primero. Si le pediste que él suba algo, no lo dupliques.`)}
`);

// ── Cap. 4 · Inscríbelos ───────────────────────────────────────────────────

const LAMINA_LOTE = `
  <div class="lote">
    <div class="lote-banner">Inscripción abierta · Etapa 2699-B — cierra en 2 días</div>
    <div class="lt-fila lt-sel">
      <span class="check check-on">✓</span>
      <div class="lt-quien"><strong>Ana Sofía Ramírez Torres</strong><span>5/5 · con matrícula</span></div>
      <div class="lt-mods">${chip('M4', C.rosaInscripcion, C.guinda)} ${chip('M5', C.rosaInscripcion, C.guinda)}</div>
    </div>
    <div class="lt-fila lt-sel">
      <span class="check check-on">✓</span>
      <div class="lt-quien"><strong>María José Hernández López</strong><span>5/5 · con matrícula</span></div>
      <div class="lt-mods">${chip('M4', C.rosaInscripcion, C.guinda)}</div>
    </div>
    <div class="lt-fila lt-no">
      <span class="check"></span>
      <div class="lt-quien"><strong>Luis Fernando García Mendoza</strong><span>Documentos 3/5 — aún no es elegible</span></div>
      <div class="lt-mods">${I.candado()}</div>
    </div>
    <div class="mod-boton">Inscribir (2 alumnos · 3 exámenes)</div>
  </div>`;

const CAP4 = pagina(`
  ${encabezadoCap(4, 'Paso 3 · Inscríbelos', 'En lote: varios alumnos y sus módulos en una sola pasada.')}
  ${paso('4.1', 'Solo con la ventana abierta', `La sección <strong>Inscripción</strong> se enciende
    cuando la etapa abre su ventana (4–5 días). Ahí eliges módulos —hasta <strong>4 por alumno</strong>—
    y marcas a quiénes inscribes.`)}
  ${paso('4.2', 'Solo aparecen los elegibles', `Un alumno es elegible con expediente
    <strong>5/5 y matrícula</strong>. Los que no, salen deshabilitados con su motivo — por eso el
    capítulo 3 se trabaja ANTES de la ventana.`)}
  ${lamina(LAMINA_LOTE, 'Ejemplo: dos alumnos listos, uno aún no elegible, y el botón del lote')}
  ${ojo(`<strong>La ventana es estricta.</strong> Fuera de esas fechas no hay inscripción — no hay
    excepciones: así funciona la convocatoria estatal. El pago corre aparte, con su ficha.`)}
`);

// ── Cap. 5 · Paga sus exámenes ─────────────────────────────────────────────

const LAMINA_GRUPAL = `
  <div class="lote">
    <div class="lt-fila lt-sel"><span class="check check-on">✓</span>
      <div class="lt-quien"><strong>Ana Sofía · M4 y M5</strong><span>2 exámenes</span></div></div>
    <div class="lt-fila lt-sel"><span class="check check-on">✓</span>
      <div class="lt-quien"><strong>María José · M4</strong><span>1 examen</span></div></div>
    <div class="grupal-flecha">↓</div>
    <div class="orden-fila orden-boton">${I.doc()} <div><strong>Una sola ficha · 3 exámenes</strong>
      <span>Folio OP-2699B-0031 — una línea de captura para todo el grupo</span></div></div>
  </div>`;

const CAP5A = pagina(`
  ${encabezadoCap(5, 'Paso 4 · Paga sus exámenes', 'Ante la Tesorería del Estado — y en grupo, que es como más te conviene.')}
  ${paso('5.1', 'Primero: que ya estén inscritos', `El pago es <strong>por examen inscrito</strong>.
    Si alguien te falta, regresa al capítulo 4 antes de solicitar nada.`)}
  ${paso('5.2', 'Solicita UNA ficha grupal', `Junta a todos tus alumnos de la etapa en una sola
    solicitud: <strong>una ficha, una línea de captura, un solo pago</strong> para todo el grupo.
    (También puedes pedirla individual, pero en grupo es un trámite en vez de diez.)`)}
  ${lamina(LAMINA_GRUPAL, 'Ejemplo: dos alumnos, tres exámenes — una sola ficha grupal')}
  ${paso('5.3', 'La Secretaría la emite', `Tu solicitud llega a la coordinación, y la Tesorería emite
    tu <strong>ficha de pago oficial</strong>. Cuando esté lista, aparece en tu panel para
    descargarla.`)}
`);

const LAMINA_FICHA = `
  <div class="orden">
    <div class="ficha-cab"><div><strong>Ficha OP-2699B-0031</strong><span>3 exámenes · grupal</span></div>
      ${chip('Lista para pagar', C.ambarFondo, C.ambarTexto)}</div>
    <div class="ruta-mini">
      <span class="rm rm-ok">Solicitada</span><span class="rm rm-ok">Emisión</span>
      <span class="rm">Pago</span><span class="rm">Confirmada</span>
    </div>
    <div class="orden-fila orden-boton">${I.doc()} <div><strong>Descargar ficha de pago (PDF)</strong>
      <span>Documento oficial de la Tesorería — trae tu línea de captura y su vencimiento</span></div>
      ${I.descarga()}</div>
    <div class="orden-etq">LÍNEA DE CAPTURA</div>
    <div class="orden-fila orden-linea"><strong>9800&nbsp;0131&nbsp;4402&nbsp;8834</strong> ${I.copiar()}</div>
    <div class="adjuntar">${I.descarga(C.gris)} Ya pagaste: adjunta el comprobante y la coordinación lo valida</div>
  </div>`;

const CAP5B = pagina(`
  ${kicker('CAPÍTULO 05 · CONTINUACIÓN')}
  ${paso('5.4', 'Descarga la ficha y págala', `Cada ficha muestra su camino:
    <strong>solicitada → emisión → pago → confirmada</strong>. Ya emitida,
    <strong>descárgala en PDF</strong> y págala con su línea de captura en banco, tienda o en
    línea, antes del vencimiento que la propia ficha indica.`)}
  ${paso('5.5', 'Adjunta el comprobante', `En la misma ficha, sube la foto o el PDF de tu
    comprobante. La coordinación lo valida y la ficha queda <strong>confirmada</strong>: tus
    alumnos aparecen como inscritos pagados.`)}
  ${lamina(LAMINA_FICHA, 'Ejemplo: la ficha emitida — descárgala, págala y adjunta tu comprobante')}
  ${ojo(`Solo lo pagado se califica: un examen presentado sin pago confirmado no tiene resultado.`)}
`);

// ── Cap. 6 · Sus resultados ────────────────────────────────────────────────

const LAMINA_RESULTADOS = `
  <div class="califs">
    <div class="calif-fila">
      <div class="calif-mod"><strong>Ana Sofía Ramírez · M1</strong><span>Etapa 2699-A</span></div>
      <div class="calif-nota">8.4</div>
      ${chip('Aprobado', C.verdeFondo, C.verde)}
    </div>
    <div class="calif-fila">
      <div class="calif-mod"><strong>María José Hernández · M1</strong><span>Etapa 2699-A</span></div>
      <div class="calif-nota">5.8</div>
      ${chip('Por presentar de nuevo', C.ambarFondo, C.ambarTexto)}
    </div>
    <div class="avance">
      <div class="av-titulo">Tu centro en la etapa 2699-A <span>9 exámenes presentados</span></div>
      <div class="av-nums">
        <div><strong>7</strong><span>APROBADOS</span></div>
        <div><strong>7.9</strong><span>PROMEDIO</span></div>
      </div>
    </div>
  </div>`;

const CAP6 = pagina(`
  ${encabezadoCap(6, 'Paso 5 · Sus resultados', 'El avance de tus alumnos: sus módulos aprobados y su promedio.')}
  ${paso('6.1', 'Dos vistas', `Por <strong>alumno</strong> (su historial completo) o por
    <strong>etapa</strong> (cómo le fue a tu grupo en esa aplicación). Tu resumen te dice de un
    vistazo cuántos aprobaron y el promedio de tu centro.`)}
  ${paso('6.2', 'El que no aprobó, vuelve', `No es definitivo: lo inscribes otra vez en una etapa
    siguiente. Úsalo para planear el repaso con las <strong>Pruebas</strong> de su portal.`)}
  ${lamina(LAMINA_RESULTADOS, 'Ejemplo: resultados por alumno y el resumen de tu centro')}
  ${paso('6.3', 'Busca, filtra y descarga', `Todo se puede filtrar por etapa o alumno, y descargar
    para tu control interno.`)}
`);

// ── Cap. 7 · Herramientas ──────────────────────────────────────────────────

const LAMINA_CALENDARIO = `
  <table class="cal-tabla">
    <thead><tr><th>Etapa</th><th><span class="punto-rosa"></span>Ventana de inscripción</th><th><span class="punto-morado"></span>Días de examen</th></tr></thead>
    <tbody>
      <tr><td>A</td><td>última semana de enero</td><td>fin de semana, mediados de febrero</td></tr>
      <tr><td>B</td><td>mediados de marzo</td><td>fin de semana, inicios de abril</td></tr>
      <tr><td>C</td><td>última semana de abril</td><td>fin de semana, mediados de mayo</td></tr>
      <tr><td>D</td><td>mediados de junio</td><td>fin de semana, inicios de julio</td></tr>
      <tr><td>E</td><td>última semana de julio</td><td>fin de semana, mediados de agosto</td></tr>
      <tr><td>F</td><td>mediados de septiembre</td><td>fin de semana, inicios de octubre</td></tr>
      <tr><td>G</td><td>última semana de octubre</td><td>fin de semana, mediados de noviembre</td></tr>
      <tr><td>H</td><td>inicios de diciembre</td><td>fin de semana, mediados de diciembre</td></tr>
    </tbody>
  </table>`;

const CAP7A = pagina(`
  ${encabezadoCap(7, 'Herramientas · El calendario', 'Tu instrumento de planeación: 8 etapas al año.')}
  ${paso('7.1', 'Planea con las ventanas', `Cada etapa abre su ventana (4–5 días) y aplica un fin de
    semana. En tu <strong>Calendario</strong> están las fechas exactas: morado = examen, rosa =
    ventana. Tu meta de gestor: llegar a cada ventana con los expedientes ya en 5/5.`)}
  ${lamina(LAMINA_CALENDARIO, 'EJEMPLO del ritmo del año — las fechas exactas de tu ciclo están en tu portal')}
`);

// Lámina: preguntas frecuentes del gestor, con una respuesta REAL del portal
// (copiada literal del contenido publicado).
const LAMINA_FAQ_G = `
  <div class="faql">
    <div class="faq-buscador">${I.busqueda()} <span>Escribe tu pregunta…</span></div>
    <div class="faq-item faq-abierta">
      <div class="faq-preg">¿Cómo doy de alta a un alumno?</div>
      <div class="faq-resp">Entra a "Nuevo alumno", captura sus datos y sube los 5 documentos
        obligatorios (CURP, acta, identificación, comprobante de domicilio y certificado de
        secundaria). La administración revisa el expediente y asigna la matrícula.</div>
    </div>
    <div class="faq-item"><div class="faq-preg">¿Qué documentos necesita el expediente?</div></div>
    <div class="faq-item"><div class="faq-preg">¿Qué hago si registré mal la CURP de un alumno?</div></div>
  </div>`;

// Lámina: Mi aula — cómo se verá el aula virtual del centro.
const LAMINA_AULA = `
  <div class="aula">
    <div class="aula-cab"><div><strong>Mi aula</strong><span>Aula virtual de tu centro</span></div>
      ${chip('En preparación', C.ambarFondo, C.ambarTexto)}</div>
    <div class="aula-clases">
      <div class="aula-clase"><strong>Módulo 4 · Matemáticas</strong>
        <span>Foro · Tareas · Materiales · Videos</span></div>
      <div class="aula-clase"><strong>Módulo 5 · Argumentación</strong>
        <span>Foro · Tareas · Materiales · Videos</span></div>
    </div>
    <div class="aula-nota">${I.candado()} Aparece con candado hasta que se habilite para tu centro.</div>
  </div>`;

const CAP7B = pagina(`
  ${kicker('CAPÍTULO 07 · PREGUNTAS FRECUENTES Y MI AULA')}
  ${paso('7.2', 'Preguntas frecuentes', `Las dudas comunes del trámite —altas, documentos,
    inscripción y pagos— ya están respondidas en tu portal, con buscador. Es tu primera parada.`)}
  ${lamina(LAMINA_FAQ_G, 'Ejemplo: buscas tu duda y la respuesta se abre ahí mismo')}
  ${paso('7.3', 'Mi aula', `El aula virtual de tu centro: clases por módulo con foro, tareas,
    materiales y videos, en línea o de forma híbrida. Está en preparación — te avisaremos cuando
    se habilite.`)}
  ${lamina(LAMINA_AULA, 'Así se verá tu aula: una clase por módulo, con todo su material')}
`);

// ── Cap. 8 · Ayuda + Anexo ─────────────────────────────────────────────────

const CAP8 = pagina(`
  ${encabezadoCap(8, '¿Necesitas ayuda?', 'En este orden llegas más rápido a la respuesta.')}
  <div class="tarjetas">
    ${tarjeta('1 · Preguntas frecuentes', `La mayoría de las dudas del trámite ya están resueltas
      ahí, con buscador.`)}
    ${tarjeta('2 · La administración', `Para casos de un alumno concreto, contacta a la
      coordinación de la Secretaría.`)}
    ${tarjeta('3 · Teléfono del Instituto', `El número y horario vigentes están al pie de las
      Preguntas frecuentes.`)}
    ${tarjeta('Ten a la mano', `Tu municipio y la CURP del alumno del que hablas: agilizan
      cualquier revisión.`)}
  </div>
`);

const ANEXO = pagina(`
  ${kicker('ANEXO · IMPRIME ESTA PÁGINA')}
  <h2 class="cap-titulo">Tu lista de cotejo</h2>
  <p class="lede">Una etapa completa con tus alumnos. Palomea conforme avanzas.</p>
  <div class="cotejo">
    <div class="cot"><span class="cuadro"></span>Registré a los alumnos nuevos (alta + documentos)</div>
    <div class="cot"><span class="cuadro"></span>Expedientes en 5/5 y con matrícula ANTES de la ventana</div>
    <div class="cot"><span class="cuadro"></span>Ubiqué la ventana en el Calendario</div>
    <div class="cot"><span class="cuadro"></span>Inscribí el lote DENTRO de la ventana (hasta 4 módulos c/u)</div>
    <div class="cot"><span class="cuadro"></span>Solicité la ficha (individual o grupal)</div>
    <div class="cot"><span class="cuadro"></span>Descargué la ficha, pagué antes de su vencimiento y subí el comprobante</div>
    <div class="cot"><span class="cuadro"></span>Confirmados: mis alumnos aparecen como inscritos pagados</div>
    <div class="cot"><span class="cuadro"></span>Les avisé sede, día y hora — y que lleven identificación</div>
    <div class="cot"><span class="cuadro"></span>Revisé sus calificaciones y planeé los reintentos</div>
  </div>
  ${cita(`Cada convocatoria repite este ciclo. <strong>Cada alumno que avanza, avanza contigo.</strong>`)}
`);

// ── Documento ──────────────────────────────────────────────────────────────
const HTML = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"/>
<style>
  @font-face { font-family: 'Poppins'; font-weight: 400;
    src: url(data:font/ttf;base64,${fuente('Poppins-Regular.ttf')}) format('truetype'); }
  @font-face { font-family: 'Poppins'; font-weight: 600;
    src: url(data:font/ttf;base64,${fuente('Poppins-SemiBold.ttf')}) format('truetype'); }
  @font-face { font-family: 'Poppins'; font-weight: 700;
    src: url(data:font/ttf;base64,${fuente('Poppins-Bold.ttf')}) format('truetype'); }

  @page { size: letter; margin: 0; }
  * { box-sizing: border-box; margin: 0; }
  body { font-family: 'Poppins', system-ui, sans-serif; color: ${C.tinta};
         font-size: 10pt; line-height: 1.62; }
  .pagina { width: 216mm; height: 279mm; padding: 20mm 19mm 16mm; background: ${C.cremaClaro};
            page-break-after: always; position: relative; overflow: hidden;
            display: flex; flex-direction: column; }
  .pagina::after { content: ''; position: absolute; left: 19mm; right: 19mm; bottom: 11mm;
                   border-top: 0.35mm solid ${C.linea}; }
  .pagina.oscura::after { display: none; }
  .kicker { font-size: 7.5pt; font-weight: 700; letter-spacing: 0.28em; color: ${C.dorado};
            text-transform: uppercase; margin-bottom: 6mm; }

  .oscura { background: linear-gradient(165deg, ${C.guindaNoche}, ${C.guindaOscuro} 55%, ${C.guinda}); color: #fff; }
  .portada-centro { margin: auto 0; }
  .portada-logo { font-size: 26pt; font-weight: 700; color: #fff; margin-bottom: 12mm; }
  .portada-logo span { color: ${C.dorado}; }
  .oscura h1 { font-size: 38pt; line-height: 1.12; font-weight: 700; letter-spacing: -0.015em; }
  .portada-frase { margin-top: 14mm; font-size: 13pt; line-height: 1.75; max-width: 132mm; }
  .portada-frase span { color: ${C.doradoSuave}; font-weight: 600; }
  .pie-portada { font-size: 7.5pt; letter-spacing: 0.24em; color: rgba(255,255,255,0.55); }

  .indice { margin-top: 8mm; }
  .ind-fila { display: flex; align-items: baseline; gap: 6mm; padding: 4.4mm 0;
              border-bottom: 0.3mm solid ${C.linea}; }
  .ind-n { font-weight: 700; font-size: 11pt; color: ${C.dorado}; min-width: 10mm; }
  .ind-t { font-weight: 600; font-size: 12pt; }
  .ind-d { margin-left: auto; color: ${C.gris}; font-size: 9pt; }

  .cap-titulo { font-size: 21pt; line-height: 1.18; color: ${C.guindaNoche}; margin-bottom: 4mm;
                font-weight: 700; letter-spacing: -0.01em; }
  .lede { font-size: 11.5pt; color: ${C.gris}; margin-bottom: 8mm; }

  .camino { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; margin: 6mm 0 8mm; }
  .camino5 { grid-template-columns: 1fr 1fr; }
  .cam { background: #fff; border: 0.35mm solid ${C.linea}; border-radius: 3.5mm; padding: 5.5mm; }
  .cam-n { width: 9mm; height: 9mm; border-radius: 50%; background: ${C.guinda}; color: #fff;
           font-weight: 700; display: flex; align-items: center; justify-content: center; margin-bottom: 2.5mm; }
  .cam h4 { font-size: 12pt; font-weight: 700; margin-bottom: 1mm; color: ${C.guindaNoche}; }
  .cam p { font-size: 9pt; color: ${C.gris}; }

  .paso { display: flex; gap: 5mm; margin-bottom: 6.5mm; }
  .paso-n { font-size: 12.5pt; color: ${C.dorado}; font-weight: 700; min-width: 12mm; }
  .paso-c h3 { font-size: 12pt; font-weight: 700; color: ${C.guindaNoche}; margin-bottom: 1.5mm; }
  .paso-c p { color: #453d38; }

  .fig { margin: 0; }
  .fig-marco { background: #fff; border: 0.4mm solid ${C.linea}; border-radius: 4mm; padding: 2.5mm;
               box-shadow: 0 1.2mm 3mm rgba(46, 8, 20, 0.07); }
  .fig-ancha { width: 100%; margin: 2mm 0 6mm; }
  figcaption { margin-top: 2.5mm; font-size: 8pt; color: ${C.gris}; display: flex; gap: 2.5mm;
               align-items: center; justify-content: center; }
  .fig-punto { width: 2mm; height: 2mm; border-radius: 50%; background: ${C.dorado}; flex-shrink: 0; }
  .lamina { display: block; padding: 5mm; }

  .cita { border-left: 1.2mm solid ${C.dorado}; padding: 3mm 0 3mm 6mm; margin: 7mm 0;
          font-size: 11.5pt; line-height: 1.68; color: ${C.guindaNoche}; }
  .cita.ojo { border-left-color: ${C.guinda}; }
  .ojo-k { font-size: 7.5pt; font-weight: 700; letter-spacing: 0.24em; color: ${C.guinda}; margin-bottom: 1.5mm; }

  .chip { display: inline-flex; border-radius: 6mm; padding: 1mm 3.5mm; font-size: 8.5pt;
          font-weight: 600; white-space: nowrap; }
  .ico { width: 5mm; height: 5mm; flex-shrink: 0; vertical-align: -1mm; }

  /* Panel del gestor */
  .panel { max-width: 150mm; margin: 0 auto; }
  .panel-cab { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4mm; }
  .panel-hola { font-size: 15pt; font-weight: 700; color: ${C.guindaNoche}; }
  .panel-sub { font-size: 8.5pt; color: ${C.gris}; }
  .panel-etq { font-size: 7pt; font-weight: 700; letter-spacing: 0.2em; color: ${C.dorado};
               margin: 3mm 0 2mm; }
  .panel-fechas { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; }
  .pf { display: flex; gap: 3mm; align-items: center; background: #fff; border: 0.35mm solid ${C.linea};
        border-radius: 2.5mm; padding: 3mm 4mm; }
  .pf strong { display: block; font-size: 9.5pt; color: ${C.guindaNoche}; }
  .pf span { font-size: 8.5pt; color: ${C.gris}; }
  .pf-punto { width: 3.5mm; height: 3.5mm; border-radius: 50%; flex-shrink: 0; }
  .pf-rosa { background: ${C.rosaInscripcion}; border: 0.4mm solid ${C.rosaBorde}; }
  .pf-morado { background: ${C.moradoExamen}; }
  .panel-nums { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; }
  .pn { background: #fff; border: 0.35mm solid ${C.linea}; border-radius: 2.5mm; padding: 3mm;
        text-align: center; }
  .pn strong { display: block; font-size: 14pt; color: ${C.guindaNoche}; }
  .pn span { font-size: 7.5pt; color: ${C.gris}; }
  .pn-activo { border-color: ${C.guinda}; background: #fdf7f9; }

  /* Alta */
  .alta { max-width: 120mm; margin: 0 auto; }
  .alta-stepper { display: flex; align-items: center; gap: 3mm; margin-bottom: 4mm; }
  .as { display: flex; gap: 2mm; align-items: center; font-size: 9pt; color: ${C.gris}; }
  .as span { width: 6.5mm; height: 6.5mm; border-radius: 50%; border: 0.5mm solid #c9bcae;
             display: flex; align-items: center; justify-content: center; font-weight: 700; }
  .as-activo { color: ${C.guinda}; font-weight: 600; }
  .as-activo span { background: ${C.guinda}; border-color: ${C.guinda}; color: #fff; }
  .as-linea { flex: 1; border-top: 0.4mm solid ${C.linea}; }
  .campo { margin-bottom: 3mm; }
  .campo-etq { font-size: 7pt; font-weight: 700; letter-spacing: 0.16em; color: ${C.gris};
               margin-bottom: 1.5mm; }
  .campo-caja { display: flex; gap: 3mm; align-items: center; border: 0.4mm solid ${C.linea};
                border-radius: 2.5mm; background: #fff; padding: 3.5mm 4mm; font-size: 10pt; }
  .alta-ok { margin-left: auto; color: ${C.verde}; font-weight: 600; font-size: 8.5pt;
             display: flex; gap: 1.5mm; align-items: center; }
  .alta-nota { font-size: 8.5pt; color: ${C.gris}; }

  /* Lista de alumnos */
  .lista { max-width: 145mm; margin: 0 auto; display: flex; flex-direction: column; gap: 2.6mm; }
  .lista-buscar { display: flex; gap: 3mm; align-items: center; border: 0.4mm solid ${C.linea};
                  border-radius: 6mm; background: #fff; padding: 2.8mm 5mm; color: #a89a8e;
                  font-size: 9.5pt; }
  .al-fila { display: flex; gap: 4mm; align-items: center; justify-content: space-between;
             background: #fff; border: 0.35mm solid ${C.linea}; border-radius: 2.5mm;
             padding: 3mm 4.5mm; }
  .al-quien strong { display: block; font-size: 10pt; font-weight: 600; color: ${C.guindaNoche}; }
  .al-quien span { font-size: 8pt; color: ${C.gris}; letter-spacing: 0.06em; }

  /* Estados de documento */
  .estados { display: flex; flex-direction: column; gap: 3mm; }
  .est-fila { display: grid; grid-template-columns: 52mm 26mm 1fr; gap: 4mm; align-items: center;
              background: ${C.cremaClaro}; border: 0.35mm solid ${C.linea}; border-radius: 3mm;
              padding: 3.5mm 5mm; }
  .est-doc { font-size: 10pt; display: flex; gap: 2.5mm; align-items: center; }
  .est-doc strong { font-weight: 600; }
  .est-desc { font-size: 9pt; color: ${C.gris}; }

  /* Lote */
  .lote { max-width: 150mm; margin: 0 auto; display: flex; flex-direction: column; gap: 2.6mm; }
  .lote-banner { background: ${C.guinda}; color: #fff; border-radius: 2.5mm; padding: 2.8mm 4.5mm;
                 font-weight: 600; font-size: 9.5pt; text-align: center; margin-bottom: 1mm; }
  .lt-fila { display: flex; gap: 4mm; align-items: center; background: #fff;
             border: 0.35mm solid ${C.linea}; border-radius: 2.5mm; padding: 3mm 4.5mm; }
  .lt-sel { border-color: ${C.guinda}; background: #fdf7f9; }
  .lt-no { opacity: 0.75; }
  .lt-quien { flex: 1; }
  .lt-quien strong { display: block; font-size: 10pt; font-weight: 600; color: ${C.guindaNoche}; }
  .lt-quien span { font-size: 8pt; color: ${C.gris}; }
  .lt-mods { display: flex; gap: 2mm; }
  .check { width: 6.5mm; height: 6.5mm; border: 0.5mm solid #c9bcae; border-radius: 1.8mm;
           flex-shrink: 0; display: flex; align-items: center; justify-content: center;
           font-weight: 700; color: #fff; font-size: 9pt; }
  .check-on { background: ${C.guinda}; border-color: ${C.guinda}; }
  .mod-boton { margin-top: 1.5mm; background: ${C.guinda}; color: #fff; text-align: center;
               font-weight: 600; font-size: 10.5pt; border-radius: 2.5mm; padding: 2.8mm; }
  .grupal-flecha { text-align: center; color: ${C.dorado}; font-size: 14pt; font-weight: 700; }

  /* Ficha / orden */
  .orden { max-width: 132mm; margin: 0 auto; display: flex; flex-direction: column; gap: 3mm; }
  .orden-fila { display: flex; gap: 4mm; align-items: center; }
  .orden-boton { background: ${C.cremaClaro}; border: 0.45mm solid ${C.guinda}; border-radius: 3mm;
                 padding: 4mm 5mm; }
  .orden-boton strong { display: block; font-size: 10.5pt; font-weight: 600; color: ${C.guindaNoche}; }
  .orden-boton span { font-size: 8.5pt; color: ${C.gris}; }
  .orden-boton > div { flex: 1; }
  .orden-etq { font-size: 7.5pt; font-weight: 700; letter-spacing: 0.2em; color: ${C.gris}; }
  .orden-linea { background: ${C.cremaClaro}; border: 0.35mm solid ${C.linea}; border-radius: 2.5mm;
                 padding: 3.5mm 5mm; justify-content: space-between; }
  .orden-linea strong { font-size: 13pt; letter-spacing: 0.08em; color: ${C.guindaNoche}; }
  .adjuntar { border: 0.45mm dashed #c9bcae; border-radius: 2.5mm; padding: 4mm; text-align: center;
              color: ${C.gris}; font-size: 9.5pt; display: flex; gap: 3mm; align-items: center;
              justify-content: center; }
  .ficha-cab { display: flex; justify-content: space-between; align-items: center; }
  .ficha-cab strong { display: block; font-size: 11pt; color: ${C.guindaNoche}; }
  .ficha-cab span { font-size: 8.5pt; color: ${C.gris}; }
  .ruta-mini { display: flex; gap: 2.5mm; }
  .rm { flex: 1; text-align: center; font-size: 8pt; border: 0.35mm solid ${C.linea};
        border-radius: 2mm; padding: 1.8mm; color: ${C.gris}; background: #fff; }
  .rm-ok { background: ${C.guinda}; border-color: ${C.guinda}; color: #fff; font-weight: 600; }

  /* Resultados */
  .califs { max-width: 150mm; margin: 0 auto; display: flex; flex-direction: column; gap: 2.8mm; }
  .calif-fila { display: grid; grid-template-columns: 1fr 13mm 44mm; gap: 3mm; align-items: center;
                background: #fff; border: 0.35mm solid ${C.linea}; border-radius: 2.5mm;
                padding: 3mm 4.5mm; }
  .calif-mod strong { display: block; font-size: 10pt; font-weight: 600; color: ${C.guindaNoche}; }
  .calif-mod span { font-size: 8pt; color: ${C.gris}; }
  .calif-nota { font-size: 14pt; font-weight: 700; color: ${C.verde}; text-align: center; }
  .calif-fila:nth-child(2) .calif-nota { color: ${C.rojo}; }
  .calif-fila .chip { justify-self: end; }
  .avance { background: linear-gradient(120deg, ${C.guindaNoche}, ${C.guinda}); color: #fff;
            border-radius: 3mm; padding: 4.5mm 6mm; display: flex; align-items: center; gap: 8mm;
            margin-top: 1mm; }
  .av-titulo { flex: 1; font-size: 12pt; font-weight: 700; line-height: 1.3; }
  .av-titulo span { display: block; font-size: 8pt; font-weight: 400; opacity: 0.85; }
  .av-nums { display: flex; gap: 7mm; }
  .av-nums strong { display: block; font-size: 15pt; }
  .av-nums span { font-size: 6.5pt; letter-spacing: 0.18em; opacity: 0.85; }

  /* Calendario ejemplo */
  .cal-tabla { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  .cal-tabla th { text-align: left; font-size: 8pt; letter-spacing: 0.12em; text-transform: uppercase;
                  color: ${C.gris}; font-weight: 700; padding: 2.5mm 4mm;
                  border-bottom: 0.6mm solid ${C.dorado}; }
  .cal-tabla td { padding: 3.2mm 4mm; border-bottom: 0.3mm solid ${C.linea}; }
  .cal-tabla td:first-child { font-weight: 700; color: ${C.guinda}; }
  .cal-tabla tr:nth-child(even) td { background: ${C.cremaClaro}; }
  .punto-rosa, .punto-morado { display: inline-block; width: 3mm; height: 3mm; border-radius: 50%;
                               margin-right: 2mm; vertical-align: middle; }
  .punto-rosa { background: ${C.rosaInscripcion}; border: 0.4mm solid ${C.rosaBorde}; }
  .punto-morado { background: ${C.moradoExamen}; }

  /* Chat */
  .chatl { max-width: 130mm; margin: 0 auto; display: flex; flex-direction: column; gap: 3mm; }
  .burbuja { max-width: 80%; border-radius: 3.5mm; padding: 3.5mm 5mm; font-size: 9.5pt;
             line-height: 1.55; }
  .b-gestor { align-self: flex-end; background: ${C.guinda}; color: #fff;
              border-bottom-right-radius: 1mm; }
  .b-secre { align-self: flex-start; background: #fff; border: 0.35mm solid ${C.linea};
             color: ${C.tinta}; border-bottom-left-radius: 1mm; }

  /* FAQ */
  .faql { max-width: 140mm; margin: 0 auto; display: flex; flex-direction: column; gap: 2.6mm; }
  .faq-buscador { display: flex; gap: 3mm; align-items: center; border: 0.4mm solid ${C.linea};
                  border-radius: 6mm; background: #fff; padding: 3mm 5mm; color: #a89a8e;
                  font-size: 9.5pt; }
  .faq-item { border: 0.35mm solid ${C.linea}; border-radius: 2.5mm; background: #fff;
              padding: 3.2mm 5mm; }
  .faq-abierta { border-color: ${C.guinda}; }
  .faq-preg { font-weight: 600; font-size: 10pt; color: ${C.guindaNoche}; }
  .faq-resp { font-size: 9pt; color: ${C.gris}; margin-top: 1.5mm; line-height: 1.55; }

  /* Mi aula */
  .aula { max-width: 140mm; margin: 0 auto; }
  .aula-cab { display: flex; justify-content: space-between; align-items: center; margin-bottom: 3mm; }
  .aula-cab strong { display: block; font-size: 12pt; color: ${C.guindaNoche}; }
  .aula-cab span { font-size: 8.5pt; color: ${C.gris}; }
  .aula-clases { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; }
  .aula-clase { background: #fff; border: 0.35mm solid ${C.linea}; border-radius: 2.5mm;
                padding: 4mm 4.5mm; }
  .aula-clase strong { display: block; font-size: 10pt; font-weight: 600; color: ${C.guindaNoche}; }
  .aula-clase span { font-size: 8pt; color: ${C.gris}; }
  .aula-nota { display: flex; gap: 2.5mm; align-items: center; margin-top: 3mm; font-size: 9pt;
               color: ${C.gris}; }

  /* Tarjetas y cotejo */
  .tarjetas { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; margin-top: 4mm; }
  .tarjeta { background: #fff; border: 0.35mm solid ${C.linea}; border-radius: 3.5mm; padding: 6mm; }
  .tarjeta h4 { font-size: 11.5pt; font-weight: 700; color: ${C.guindaNoche}; margin-bottom: 2mm; }
  .tarjeta p { font-size: 9.5pt; color: ${C.gris}; }
  .cotejo { margin-top: 4mm; }
  .cot { display: flex; align-items: center; gap: 5mm; padding: 4.2mm 0; font-size: 11.5pt;
         border-bottom: 0.3mm dashed ${C.linea}; }
  .cuadro { width: 6.5mm; height: 6.5mm; border: 0.6mm solid ${C.guinda}; border-radius: 1.8mm;
            flex-shrink: 0; }
</style></head>
<body>
${PORTADA}
${INDICE}
${CAMINO}
${CAP1}
${CAP2}
${CAP3A}
${CAP3B}
${CAP4}
${CAP5A}
${CAP5B}
${CAP6}
${CAP7A}
${CAP7B}
${CAP8}
${ANEXO}
</body></html>`;

// ── Imprimir ───────────────────────────────────────────────────────────────
if (process.env.GUIAS_HTML_OUT) fs.writeFileSync(process.env.GUIAS_HTML_OUT, HTML);

const navegador = await chromium.launch({
  executablePath: process.env.GUIAS_CHROMIUM ?? '/opt/pw-browsers/chromium',
});
const page = await navegador.newPage();
await page.setContent(HTML, { waitUntil: 'networkidle' });
await page.pdf({
  path: SALIDA,
  format: 'Letter',
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate: `
    <div style="width:100%;font-size:6.5pt;letter-spacing:0.22em;color:#a3968b;
                display:flex;justify-content:space-between;padding:0 19mm 4mm;
                font-family:'Poppins','Segoe UI',sans-serif;text-transform:uppercase;">
      <span>Modula · Plan 22 — Guía del gestor</span>
      <span>${FECHA_VERSION} · Pág. <span class="pageNumber"></span> de <span class="totalPages"></span></span>
    </div>`,
  margin: { top: '0', bottom: '0', left: '0', right: '0' },
});
await navegador.close();

const kb = Math.round(fs.statSync(SALIDA).size / 1024);
console.log(`✅ ${SALIDA} (${kb} KB)`);
