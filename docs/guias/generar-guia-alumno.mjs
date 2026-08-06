/**
 * GENERADOR — Guía del estudiante en PDF.
 *
 * Compone la guía (HTML con la marca de Modula) usando las capturas de
 * `capturar-alumno.mjs` y la imprime a PDF con el Chromium de la máquina.
 * NADA se maqueta a mano: cambia la interfaz → se recapturan las fotos → se
 * corre esto → guía nueva.
 *
 * Lenguaje visual: portada editorial en guinda sólido con una frase; kickers
 * dorados en versalitas; TODO en Poppins — es la letra de Modula, no se
 * imita la del manual de otro producto—; una página = una idea, con el aire
 * como decisión; toda foto va enmarcada y con pie de foto.
 *
 * Cuando una pantalla no fotografía bien (bloques altísimos, estados que el
 * demo no puede mostrar a la vez), NO se fuerza la captura: se dibuja una
 * ilustración con el mismo estilo del portal. Eso también se decide aquí.
 *
 * Uso:
 *     node docs/guias/capturar-alumno.mjs        # 1) fotos frescas
 *     node docs/guias/generar-guia-alumno.mjs    # 2) el PDF
 *
 * Salida: docs/guias/Guia-Alumno-Modula22.pdf (ASCII, regla 7 de CLAUDE.md).
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
const CAPTURAS = path.join(AQUI, 'capturas-alumno');
const SALIDA = path.join(AQUI, 'Guia-Alumno-Modula22.pdf');

function img(nombre) {
  const ruta = path.join(CAPTURAS, `${nombre}.png`);
  if (!fs.existsSync(ruta)) {
    console.error(`✋ Falta la captura ${nombre}.png — corre primero capturar-alumno.mjs`);
    process.exit(1);
  }
  return `data:image/png;base64,${fs.readFileSync(ruta).toString('base64')}`;
}

/** Poppins es LA letra de Modula (hasta --font-serif del portal apunta a ella).
 * Va incrustada para que el PDF no dependa de qué fuentes tenga la máquina. */
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
/**
 * Una página. Lleva su propio pie dentro en vez de usar el `footerTemplate` de
 * Chromium, que se imprimía en TODAS —incluida la portada, donde repetía el
 * título con el título a tres centímetros—. Dibujarlo aquí permite que la
 * portada tenga el suyo y el resto el corrido.
 *
 * El número sale del orden en que se llama; el total se sustituye al final,
 * cuando ya se sabe cuántas son.
 */
let _pags = 0;
const pagina = (contenido, extra = '') => {
  _pags += 1;
  const n = _pags;
  const pie = extra.includes('oscura') ? '' : `
    <div class="pie-corrido">
      <span>MODULA · PLAN 22 — GUÍA DEL ESTUDIANTE</span>
      <span>${FECHA_VERSION.toUpperCase()} · PÁG. ${n} DE @@TOTAL@@</span>
    </div>`;
  return `<section class="pagina ${extra}">${contenido}${pie}</section>`;
};

/** Figura: SIEMPRE con marco y pie de foto (una foto sin pie no se entiende). */
function figura(imagen, pie, opts = {}) {
  const clase = opts.telefono ? 'fig fig-tel' : 'fig fig-ancha';
  const alto = opts.alto ? ` style="max-height:${opts.alto}"` : '';
  return `
  <figure class="${clase}">
    <div class="fig-marco"><img src="${imagen}" alt=""${alto}/></div>
    <figcaption><span class="fig-punto"></span>${esc(pie)}</figcaption>
  </figure>`;
}

/** Ilustración dibujada (no captura): mismo marco y pie que una figura. */
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

const dosCol = (izq, der) => `<div class="doscol"><div class="doscol-izq">${izq}</div><div class="doscol-der">${der}</div></div>`;
const cita = (texto) => `<div class="cita">${texto}</div>`;
/**
 * Aviso al margen. Barra fina dorada y el texto solo: acompaña la lectura en
 * vez de interrumpirla. Antes llevaba etiqueta "OJO" y barra gruesa en guinda,
 * que hacía ver de alarma algo que casi siempre es una aclaración.
 */
const ojo = (texto) => `<div class="cita ojo">${texto}</div>`;
const tarjeta = (titulo, cuerpo) => `<div class="tarjeta"><h4>${esc(titulo)}</h4><p>${cuerpo}</p></div>`;

function encabezadoCap(numero, titulo, lede) {
  return `
  ${kicker(`CAPÍTULO ${String(numero).padStart(2, '0')}`)}
  <h2 class="cap-titulo">${esc(titulo)}</h2>
  ${lede ? `<p class="lede">${lede}</p>` : ''}`;
}

/**
 * Iconos PROPIOS, dibujados con el trazo del portal (lucide): nada de emojis
 * del sistema — se ven distintos en cada aparato y baratos impresos.
 */
function icono(paths, opts = {}) {
  const t = opts.color ?? C.guinda;
  return `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="${t}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}
const I = {
  doc: () => icono('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6"/><path d="M9 17h6"/>'),
  descarga: (c) => icono('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>', { color: c }),
  subir: (c) => icono('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 8l5-5 5 5"/><path d="M12 3v12"/>', { color: c }),
  copiar: () => icono('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
  paloma: (c) => icono('<path d="M20 6L9 17l-5-5"/>', { color: c }),
  busqueda: () => icono('<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/>'),
  correo: () => icono('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/>'),
  ojoVer: () => icono('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>', { color: '#a89a8e' }),
  credencial: () => icono('<rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="8" cy="11" r="2"/><path d="M14 9h5"/><path d="M14 13h5"/><path d="M5 17c.5-1.5 1.8-2 3-2s2.5.5 3 2"/>'),
};

/** Chip de estado, igual que en el portal. */
const chip = (texto, fondo, color) =>
  `<span class="chip" style="background:${fondo};color:${color}">${esc(texto)}</span>`;

// ── Páginas ────────────────────────────────────────────────────────────────

const PORTADA = pagina(`
  <div class="kicker">MODULA · PLAN 22 · ${FECHA_VERSION.toUpperCase()}</div>
  <div class="portada-centro">
    <div class="portada-logo">M<span>22</span></div>
    <h1>Guía del<br/>estudiante</h1>
    <div class="kicker" style="margin-top:6mm">PREPARATORIA ABIERTA · VERSIÓN ${FECHA_VERSION.toUpperCase()}</div>
    <p class="portada-frase">Tu preparatoria son <span>4 pasos</span> que se repiten
    hasta el certificado.<br/>Esta guía te lleva de la mano por cada uno.</p>
  </div>
  <div class="pie-portada">
    <span>PREPA.MODULA22.MX · IEMSYS · GOBIERNO DE MICHOACÁN</span>
    <span class="pie-portada-pag">PÁG. 1 DE @@TOTAL@@</span>
  </div>
`, 'oscura');

const INDICE = pagina(`
  ${kicker('CONTENIDO')}
  <h2 class="cap-titulo">Lo que vas<br/>a encontrar</h2>
  <div class="indice">
    <div class="ind-fila"><span class="ind-n">01</span><span class="ind-t">Tu primer ingreso</span><span class="ind-d">correo, contraseña y acceso</span></div>
    <div class="ind-fila"><span class="ind-n">02</span><span class="ind-t">Conoce tu portal</span><span class="ind-d">el menú y tu Inicio</span></div>
    <div class="ind-fila"><span class="ind-n">03</span><span class="ind-t">Paso 1 · Tu expediente</span><span class="ind-d">5 documentos y tu matrícula</span></div>
    <div class="ind-fila"><span class="ind-n">04</span><span class="ind-t">Paso 2 · Inscríbete</span><span class="ind-d">la ventana y tus módulos</span></div>
    <div class="ind-fila"><span class="ind-n">05</span><span class="ind-t">Paso 3 · Paga tu examen</span><span class="ind-d">orden de pago · Tesorería del Estado</span></div>
    <div class="ind-fila"><span class="ind-n">06</span><span class="ind-t">El día del examen</span><span class="ind-d">identificación, sede y horario</span></div>
    <div class="ind-fila"><span class="ind-n">07</span><span class="ind-t">Paso 4 · Tus resultados</span><span class="ind-d">se aprueba con 6</span></div>
    <div class="ind-fila"><span class="ind-n">08</span><span class="ind-t">Herramientas</span><span class="ind-d">pruebas, preguntas y calendario</span></div>
    <div class="ind-fila"><span class="ind-n">✓</span><span class="ind-t">Tu lista de cotejo</span><span class="ind-d">para imprimir o guardar</span></div>
  </div>
`);

const CAMINO = pagina(`
  ${kicker('ANTES DE EMPEZAR')}
  <h2 class="cap-titulo">El camino son 4 pasos</h2>
  <p class="lede">Siempre en este orden. Cada convocatoria los repite, y hay 8 al año.</p>
  <div class="camino">
    <div class="cam"><div class="cam-n">1</div><h4>Expediente</h4><p>Sube tus 5 documentos y espera su aprobación.</p></div>
    <div class="cam"><div class="cam-n">2</div><h4>Inscripción</h4><p>Elige hasta 4 módulos dentro de la ventana.</p></div>
    <div class="cam"><div class="cam-n">3</div><h4>Pago</h4><p>Con tu línea de captura oficial de la Tesorería.</p></div>
    <div class="cam"><div class="cam-n">4</div><h4>Resultados</h4><p>Se aprueba con 6. Son 22 módulos en total.</p></div>
  </div>
  ${cita(`<strong>¿Tienes centro de asesoría?</strong> Entonces tu gestor te <strong>inscribe y paga por ti</strong>
   (pasos 2 y 3): tú subes tus documentos y te presentas al examen. Si llevas tu proceso por tu cuenta,
   esta guía te enseña a hacer todo tú.`)}
`);

// Lámina: el acceso, dibujado en grande (el screenshot de teléfono quedaba
// chico para lo único que importa: dónde va el correo y dónde la contraseña).
const LAMINA_LOGIN = `
  <div class="login2">
    <div class="login2-cab">
      <div class="login2-gob">GOBIERNO DE MICHOACÁN</div>
      <div class="login2-logo">MÓDULA<span>22</span></div>
      <div class="login2-plan">PLAN 22 · PREPARATORIA ABIERTA</div>
    </div>
    <div class="login2-cuerpo">
      <div class="login-kicker">ACCESO AL SISTEMA</div>
      <div class="login-titulo">Bienvenido</div>
      <div class="login2-sub">Inicia sesión con tus credenciales institucionales.</div>
      <div class="campo"><div class="campo-etq">Correo institucional</div>
        <div class="campo-caja">${I.correo()} <em>usuario@michoacan.gob.mx</em></div></div>
      <div class="campo"><div class="campo-etq">Contraseña</div>
        <div class="campo-caja">•••••••• <span class="campo-ojo">${I.ojoVer()}</span></div></div>
      <div class="login2-olvide">¿Olvidaste tu contraseña?</div>
      <div class="boton-guinda">Entrar</div>
    </div>
  </div>`;

const CAP1A = pagina(`
  ${encabezadoCap(1, 'Tu primer ingreso', 'De tu correo de bienvenida a tu portal en tres minutos.')}
  ${paso('1.1', 'Recibe tu correo de bienvenida', `Cuando tu cuenta se crea, te llega un correo de
    <strong>Preparatoria Abierta Michoacán</strong> con tus credenciales: tu usuario —el mismo
    correo que registraste— y una <strong>contraseña temporal</strong>. Si no lo ves, revisa
    <em>correo no deseado</em>.`)}
  ${paso('1.2', 'Entra al portal', `Abre <strong>prepa.modula22.mx</strong>, toca <strong>Iniciar
    sesión</strong> y escribe tu correo y contraseña. El botón del ojo te deja ver lo que escribes.`)}
  ${lamina(LAMINA_LOGIN, 'La pantalla de inicio de sesión: tu correo, tu contraseña y Entrar')}
`);

// Lámina: la opción de recuperar, en horizontal (la captura salía vertical).
const LAMINA_RECUPERAR = `
  <div class="opcion-ancha">
    <span class="oa-icono">${I.correo()}</span>
    <div><strong>Recibir correo de recuperación</strong>
      <span>Te enviamos un enlace a tu correo para crear una contraseña nueva.</span></div>
    <span class="oa-continuar">Continuar →</span>
  </div>`;

const CAP1B = pagina(`
  ${kicker('CAPÍTULO 01 · CONTINUACIÓN')}
  ${paso('1.3', 'Cambia tu contraseña', `La primera vez, el portal te pide elegir tu contraseña
    definitiva. Escríbela dos veces y guárdala donde no la pierdas.`)}
  ${paso('1.4', '¿La olvidaste? Recupérala por correo', `En el inicio de sesión toca
    <strong>Olvidé mi contraseña</strong> y elige <strong>recibir correo de recuperación</strong>:
    te llega un enlace para elegir una contraseña nueva.`)}
  ${lamina(LAMINA_RECUPERAR, 'La opción para recuperar tu contraseña por correo')}
  ${paso('1.5', '¿No sabes si ya tienes cuenta?', `En la misma pantalla de inicio de sesión está la opción
    para <strong>buscar tu cuenta</strong> con tu CURP o tu nombre, antes de solicitar una nueva.`)}
  ${figura(img('02c-opcion-buscar'), 'La opción para buscar si ya tienes cuenta', { alto: '34mm' })}
  ${ojo(`La contraseña temporal solo sirve <strong>una vez</strong>, y el enlace de recuperación
    <strong>caduca en 1 hora</strong>. Úsalo en cuanto llegue.`)}
`);

// Lámina: tu Inicio, dibujado — el saludo, qué te toca hoy y el menú de abajo.
const LAMINA_INICIO = `
  <div class="inicio">
    <div class="inicio-cab">
      <div><div class="inicio-hola">Hola, Ana</div>
        <div class="inicio-sub">Portal del estudiante</div></div>
      ${chip('Expediente 3/5', C.ambarFondo, C.ambarTexto)}
    </div>
    <div class="inicio-etq">QUÉ TE TOCA HOY</div>
    <div class="inicio-tarea">${I.doc()} Sube tu comprobante de domicilio <span class="inicio-ir">Ir →</span></div>
    <div class="inicio-tarea">${I.busqueda()} Revisa cuándo abre la próxima ventana <span class="inicio-ir">Ir →</span></div>
    <div class="inicio-menu">
      <span class="im-activo">Inicio</span><span>Expediente</span><span>Inscripción</span><span>Pagos</span><span>Más</span>
    </div>
  </div>`;

const CAP2 = pagina(`
  ${encabezadoCap(2, 'Conoce tu portal', 'Todo vive en el menú. Si te pierdes, vuelve a Inicio.')}
  ${paso('2.1', 'Tu Inicio', `Cada vez que entres verás en qué punto vas y qué te toca hacer.
    En el teléfono el menú va abajo; el botón <strong>Más</strong> abre el resto de las secciones.`)}
  ${lamina(LAMINA_INICIO, 'Tu Inicio: el saludo, tus pendientes y el menú siempre abajo')}
  <div class="glosario">
    <div><strong>Expediente</strong><span>tus documentos</span></div>
    <div><strong>Inscripción</strong><span>tus exámenes</span></div>
    <div><strong>Pagos</strong><span>fichas y comprobantes</span></div>
    <div><strong>Calificaciones</strong><span>tus resultados</span></div>
    <div><strong>Pruebas</strong><span>exámenes de práctica</span></div>
    <div><strong>ID</strong><span>tu credencial</span></div>
    <div><strong>Calendario</strong><span>fechas del ciclo</span></div>
    <div><strong>Preguntas frecuentes</strong><span>dudas resueltas</span></div>
  </div>
  ${cita(`El botón de ayuda <strong>(?)</strong> reinicia el tutorial en pantalla cuando quieras.`)}
`);

// Lámina: la lista de documentos, dibujada (el usuario pidió LISTA, no prosa).
const LAMINA_DOCS = `
  <div class="docs-lista">
    <div class="doc-item"><span class="doc-n">1</span><div><strong>CURP</strong><span>constancia oficial (PDF o foto)</span></div></div>
    <div class="doc-item"><span class="doc-n">2</span><div><strong>Acta de nacimiento</strong><span>oficial o copia certificada</span></div></div>
    <div class="doc-item"><span class="doc-n">3</span><div><strong>Identificación oficial</strong><span>INE / IFE vigente, por ambos lados</span></div></div>
    <div class="doc-item"><span class="doc-n">4</span><div><strong>Comprobante de domicilio</strong><span>no mayor a 3 meses</span></div></div>
    <div class="doc-item"><span class="doc-n">5</span><div><strong>Certificado de secundaria</strong><span>certificado o constancia, ambos lados</span></div></div>
    <div class="doc-item doc-extra"><span class="doc-n">+</span><div><strong>Tu fotografía</strong><span>tipo selfie, de frente, fondo claro — para tu credencial</span></div></div>
  </div>`;

const CAP3A = pagina(`
  ${encabezadoCap(3, 'Paso 1 · Tu expediente', 'Cinco documentos y tu fotografía. Sin esto no hay inscripción.')}
  ${paso('3.1', 'Reúne tus documentos', `Ten los seis listos antes de empezar: subirlos toma cinco minutos.
    En PDF o foto, siempre legibles.`)}
  ${lamina(LAMINA_DOCS, 'Tu lista de documentos — júntalos antes de subir nada')}
`);

// Lámina: los tres estados de un documento (el demo no puede mostrarlos juntos).
const LAMINA_ESTADOS = `
  <div class="estados">
    <div class="est-fila">
      <div class="est-doc">${I.doc()} <strong>CURP</strong></div>
      ${chip('Aprobado', C.verdeFondo, C.verde)}
      <span class="est-desc">Listo: este ya cuenta para tu 5/5.</span>
    </div>
    <div class="est-fila">
      <div class="est-doc">${I.doc()} <strong>Acta de nacimiento</strong></div>
      ${chip('En revisión', C.ambarFondo, C.ambarTexto)}
      <span class="est-desc">La administración lo está revisando. Solo espera.</span>
    </div>
    <div class="est-fila est-mal">
      <div class="est-doc">${I.doc()} <strong>Comprobante de domicilio</strong></div>
      ${chip('Rechazado', C.rojoFondo, C.rojo)}
      <span class="est-desc"><strong>Motivo: "borroso / mayor a 3 meses".</strong> Corrige y súbelo otra vez.</span>
    </div>
  </div>`;

// Lámina hermana de la de estados: la lista de subir, con el mismo formato de
// renglón horizontal (una foto vertical junto a una lámina horizontal se veía
// dispareja).
const LAMINA_SUBIR = `
  <div class="estados">
    <div class="est-fila est-subir">
      <div class="est-doc">${I.doc()} <strong>CURP</strong></div>
      <span class="est-desc">Aún sin archivo</span>
      <span class="boton-subir">${I.subir('#ffffff')} Subir PDF</span>
    </div>
    <div class="est-fila est-subir">
      <div class="est-doc">${I.doc()} <strong>Acta de nacimiento</strong></div>
      <span class="est-desc">Aún sin archivo</span>
      <span class="boton-subir">${I.subir('#ffffff')} Subir PDF</span>
    </div>
    <div class="est-fila est-subir">
      <div class="est-doc">${I.doc()} <strong>Certificado de secundaria</strong></div>
      <span class="est-desc">Aún sin archivo</span>
      <span class="boton-subir">${I.subir('#ffffff')} Subir PDF</span>
    </div>
  </div>`;

const CAP3B = pagina(`
  ${kicker('CAPÍTULO 03 · CONTINUACIÓN')}
  ${paso('3.2', 'Súbelos en Expediente', `Cada documento tiene su botón <strong>Subir</strong>.
    La lista te dice cuáles faltan.`)}
  ${lamina(LAMINA_SUBIR, 'Ejemplo: cada documento con su botón de subir')}
  ${paso('3.3', 'Espera la revisión', `Cada documento pasa por la administración y queda en uno de
    tres estados. El único que te pide algo es <strong>rechazado</strong>: trae el motivo, corriges
    y vuelves a subir.`)}
  ${lamina(LAMINA_ESTADOS, 'Ejemplo: los tres estados en que puede quedar un documento')}
`);

const CAP3C = pagina(`
  ${kicker('CAPÍTULO 03 · CONTINUACIÓN')}
  ${paso('3.4', 'Tu barra debe llegar a 5/5', `Con los cinco documentos aprobados, tu expediente está completo.`)}
  ${figura(img('05-exp-progreso'), 'Expediente completo: 5 de 5 documentos aprobados', { alto: '48mm' })}
  ${paso('3.5', 'Te asignan tu matrícula', `Con el expediente completo, la administración te asigna tu
    <strong>matrícula oficial</strong>: tu número para todo el proceso. Aparece arriba en tu Expediente.`)}
  ${figura(img('05b-exp-matricula'), 'Tu matrícula oficial, ya asignada', { alto: '62mm' })}
  ${ojo(`Sin expediente completo <strong>no puedes inscribirte</strong>, y la revisión puede tomar días.
    No lo dejes para la semana de la inscripción.`)}
  ${cita(`<strong>¿Tienes centro de asesoría?</strong> Tu gestor también puede subir estos documentos
    por ti, si se los entregas.`)}
`);

// Lámina: cómo se marcan los módulos (la captura real salía ilegible).
const LAMINA_MODULOS = `
  <div class="mods">
    <div class="mod-fila mod-sel"><span class="check check-on">✓</span>
      <div><strong>Módulo 4 · Matemáticas y representaciones</strong><span>Sábado · 09:00</span></div></div>
    <div class="mod-fila mod-sel"><span class="check check-on">✓</span>
      <div><strong>Módulo 5 · Argumentación</strong><span>Domingo · 11:00</span></div></div>
    <div class="mod-fila"><span class="check"></span>
      <div><strong>Módulo 6 · Ser social y sociedad</strong><span>Sábado · 09:00</span></div></div>
    <div class="mod-boton">Confirmar inscripción (2 módulos)</div>
  </div>`;

const CAP4A = pagina(`
  ${encabezadoCap(4, 'Paso 2 · Inscríbete', 'La ventana dura 4 o 5 días. Todo pasa dentro de ella.')}
  ${paso('4.1', 'Espera a que abra la ventana', `Cuando la inscripción está abierta, tu sección
    <strong>Inscripción</strong> la anuncia con las fechas exactas y los días que faltan para el cierre.`)}
  ${figura(img('06-insc-ventana'), 'La convocatoria abierta, con sus fechas y su cuenta regresiva', { alto: '42mm' })}
  ${paso('4.2', 'Marca tus módulos y confirma', `Palomea hasta <strong>4 módulos</strong> —cada uno con su
    día y hora— y toca <strong>Confirmar</strong>. Si hay varias sedes, elige también dónde presentas.`)}
  ${lamina(LAMINA_MODULOS, 'Ejemplo: así se marcan los módulos y se confirma')}
`);

// Lámina: exámenes inscritos con aire (la captura real salía apretada y con
// el botón de pase, que por ahora no aplica).
const LAMINA_EXAMENES = `
  <div class="exs">
    <div class="ex-fila">
      <div class="ex-fecha"><strong>22</strong><span>AGO</span><em>09:00</em></div>
      <div class="ex-info"><strong>Módulo 4 · Matemáticas y representaciones del sistema natural</strong>
        <span>Sábado · Centro de Servicios Morelia</span></div>
      ${chip('Inscripción confirmada', C.verdeFondo, C.verde)}
    </div>
    <div class="ex-fila">
      <div class="ex-fecha"><strong>23</strong><span>AGO</span><em>11:00</em></div>
      <div class="ex-info"><strong>Módulo 5 · Argumentación</strong>
        <span>Domingo · Centro de Servicios Morelia</span></div>
      ${chip('Pre-inscrito · falta pago', C.ambarFondo, C.ambarTexto)}
    </div>
  </div>`;

const CAP4B = pagina(`
  ${kicker('CAPÍTULO 04 · CONTINUACIÓN')}
  ${paso('4.3', 'Revisa tus exámenes', `Quedas como <strong>pre-inscrito</strong> y se genera tu ficha de pago.
    Tu lugar se confirma hasta que el pago se valida.`)}
  ${lamina(LAMINA_EXAMENES, 'Ejemplo: tus exámenes inscritos, cada uno con su estado')}
  ${paso('4.4', 'Tu sede queda asignada', `Con su dirección y el mapa. Es la misma para todos los módulos
    de la convocatoria.`)}
  ${figura(img('06d-insc-sede'), 'Tu sede de examen', { alto: '52mm' })}
`);

const CAP4C = pagina(`
  ${kicker('CAPÍTULO 04 · LA REGLA MÁS IMPORTANTE')}
  ${ojo(`<strong>La ventana es estricta.</strong> Fuera de esas fechas <strong>no te puedes
    inscribir</strong> — no hay excepciones: así funciona la convocatoria estatal. El pago corre
    aparte, con el vencimiento de tu ficha. Consulta el Calendario y no lo dejes para el último día.`)}
  ${cita(`<strong>¿Tienes centro de asesoría?</strong> La inscripción la hace tu gestor — es el único
    que puede inscribirte, por eso en tu portal no verás botones de inscripción. No te preocupes:
    no te falta nada. Si tienes dudas, comunícate con tu centro o con el Instituto (IEMSyS).`)}
`);

// Lámina: el camino del pago en 4 estaciones (lo que el usuario pidió ver claro).
const LAMINA_PAGO = `
  <div class="ruta-pago">
    <div class="rp"><div class="rp-n rp-hecho">1</div><strong>Solicitada</strong><span>Tocas "Solicitar orden" en Pagos. La coordinación la tramita.</span></div>
    <div class="rp"><div class="rp-n rp-hecho">2</div><strong>Emisión</strong><span>La Tesorería emite tu orden con línea de captura. ¡Ya puedes pagar!</span></div>
    <div class="rp"><div class="rp-n">3</div><strong>Pago</strong><span>Pagas en banco, tienda o en línea, y subes tu comprobante.</span></div>
    <div class="rp"><div class="rp-n">4</div><strong>Confirmado</strong><span>La coordinación valida. Tu lugar queda asegurado.</span></div>
  </div>`;

// Lámina: el examen sin cubrir con su botón de solicitar (5.2 pedía foto).
const LAMINA_SOLICITAR = `
  <div class="exs">
    <div class="ex-fila">
      <div class="ex-fecha"><strong>23</strong><span>AGO</span><em>11:00</em></div>
      <div class="ex-info"><strong>Módulo 5 · Argumentación</strong>
        <span>Domingo · Centro de Servicios Morelia</span></div>
      ${chip('Sin pagar', C.rojoFondo, C.rojo)}
    </div>
    <div class="mod-boton">Solicitar orden de pago</div>
  </div>`;

const CAP5A = pagina(`
  ${encabezadoCap(5, 'Paso 3 · Paga tu examen', 'La orden la emite la Tesorería del Estado; el costo vigente lo ves en tu portal.')}
  ${paso('5.1', 'Así es el camino completo', `Toda orden de pago pasa por <strong>4 estaciones</strong>.
    En tu sección Pagos siempre ves en cuál va la tuya:`)}
  ${lamina(LAMINA_PAGO, 'El camino de tu pago, de la solicitud a la confirmación')}
  ${paso('5.2', 'Solicita tu orden', `En <strong>Pagos</strong>, cada examen sin cubrir trae su botón
    <strong>Solicitar orden</strong>. Con un toque arranca el camino de arriba.`)}
  ${lamina(LAMINA_SOLICITAR, 'Ejemplo: un examen sin cubrir, con su botón para solicitar la orden')}
`);

// Láminas del pago, dibujadas (los recortes de pantalla no se leían bien).
const LAMINA_ORDEN = `
  <div class="orden">
    <div class="orden-fila orden-boton">${I.doc()} <div><strong>Ver / descargar orden de pago (PDF)</strong>
      <span>Documento oficial de la plataforma del Estado</span></div> ${I.descarga()}</div>
    <div class="orden-etq">LÍNEA DE CAPTURA</div>
    <div class="orden-fila orden-linea"><strong>9800&nbsp;0131&nbsp;4402&nbsp;8834</strong> ${I.copiar()}</div>
    <div class="orden-vence">Vence el <strong>4 de agosto</strong> — 7 días después de emitida</div>
  </div>`;

const LAMINA_COMPROBANTE = `
  <div class="orden">
    <div class="orden-etq">¿CÓMO PAGASTE?</div>
    <div class="metodos">
      <span class="metodo">Ventanilla bancaria</span>
      <span class="metodo metodo-sel">Tienda de conveniencia</span>
      <span class="metodo">Pago en línea</span>
    </div>
    <div class="adjuntar">${I.descarga(C.gris)} Adjunta la foto o el PDF de tu comprobante</div>
  </div>`;

const CAP5B = pagina(`
  ${kicker('CAPÍTULO 05 · CONTINUACIÓN')}
  ${paso('5.3', 'Descarga tu orden y págala', `Cuando la orden queda emitida aparece tu orden en PDF y
    tu <strong>línea de captura</strong>: cópiala y págala en banco, tienda o en línea, antes de su
    vencimiento.`)}
  ${lamina(LAMINA_ORDEN, 'Ejemplo: tu orden emitida, con su línea de captura y su vencimiento')}
  ${paso('5.4', '¿Ya pagaste? Sube tu comprobante', `En el mismo bloque, elige cómo pagaste y adjunta tu
    comprobante. Al confirmarse, tu lugar queda asegurado. Con centro de asesoría, <strong>este pago lo
    hace tu gestor por ti</strong>, igual que la inscripción.`)}
  ${lamina(LAMINA_COMPROBANTE, 'Ejemplo: elige el método y adjunta tu comprobante')}
  ${ojo(`Tu ficha <strong>vence a los 7 días</strong> de emitida, y solo lo pagado se califica.`)}
`);

// Lámina: la credencial digital, dibujada en horizontal (la captura vertical
// del teléfono no gustó; el diseño real de la credencial NO se toca — esto es
// un retrato editorial de sus datos).
const LAMINA_CREDENCIAL = `
  <div class="cred">
    <div class="cred-franja">
      <div class="cred-marca">MODULA · PLAN 22</div>
      <div class="cred-inst">Preparatoria Abierta · IEMSyS<br/>Gobierno de Michoacán</div>
    </div>
    <div class="cred-cuerpo">
      <div class="cred-foto">AR</div>
      <div class="cred-datos">
        <div class="cred-nombre">Ana Sofía Ramírez López</div>
        <div class="cred-fila"><span>CURP</span><strong>RALA****MMNMPN**</strong></div>
        <div class="cred-fila"><span>MATRÍCULA</span><strong>2026160100482</strong></div>
        <div class="cred-fila"><span>VIGENCIA</span><strong>Julio de 2027</strong></div>
      </div>
      <div class="cred-sello">${I.credencial()}<span>Credencial<br/>digital</span></div>
    </div>
  </div>`;

const CAP6 = pagina(`
  ${encabezadoCap(6, 'El día del examen', 'Identificación, tu sede y llegar con tiempo.')}
  ${paso('6.1', 'Lleva tu identificación', `Una identificación oficial (INE, o tu credencial de
    estudiante del portal). Es lo que te piden al entrar.`)}
  ${paso('6.2', 'Ubica tu sede desde antes', `La dirección y el mapa están en tu
    <strong>Inscripción</strong>. Llega con tiempo: los horarios de aplicación son exactos
    (09:00 y 11:00).`)}
  ${paso('6.3', 'Tu credencial digital', `Vive en la sección <strong>ID</strong> de tu portal, con tu
    foto. Te identifica dentro del programa.`)}
  ${lamina(LAMINA_CREDENCIAL, 'Ejemplo: tu credencial digital de estudiante')}
`);

// Lámina: descargar el historial (el zoom del recorte no gustó).
const LAMINA_DESCARGAR = `
  <div class="orden">
    <div class="orden-fila orden-boton">${I.doc()} <div><strong>Tu historial académico en PDF</strong>
      <span>Módulos aprobados, calificaciones y promedio — para cualquier trámite</span></div></div>
    <div class="boton-guinda">${I.descarga('#ffffff')} Descargar historial (PDF)</div>
  </div>`;

// Lámina: el historial con su tarjeta de avance, dibujado (la captura de
// teléfono no era intuitiva).
const LAMINA_CALIF = `
  <div class="califs">
    <div class="calif-fila">
      <div class="calif-mod"><strong>Módulo 1 · De la información al conocimiento</strong>
        <span>Etapa 2699-A</span></div>
      <div class="calif-nota">84</div>
      ${chip('Aprobado', C.verdeFondo, C.verde)}
    </div>
    <div class="calif-fila">
      <div class="calif-mod"><strong>Módulo 4 · Matemáticas y representaciones</strong>
        <span>Etapa 2699-B · presentado</span></div>
      <div class="calif-nota calif-pend">—</div>
      ${chip('En proceso', C.ambarFondo, C.ambarTexto)}
    </div>
    <div class="avance">
      <div class="av-etq">AVANCE ACADÉMICO</div>
      <div class="av-titulo">3 módulos aprobados <span>de 22 del Plan Modular</span></div>
      <div class="av-nums">
        <div><strong>8.4</strong><span>PROMEDIO</span></div>
        <div><strong>14%</strong><span>AVANCE</span></div>
      </div>
    </div>
  </div>`;

const CAP7 = pagina(`
  ${encabezadoCap(7, 'Paso 4 · Tus resultados', 'Se aprueba con 6. El certificado son 22 módulos.')}
  ${paso('7.1', 'Consulta tus calificaciones', `Después de cada etapa, cada módulo aparece con su
    calificación — y abajo, tu tarjeta de avance: cuántos de los 22 llevas aprobados y tu promedio.
    Cada módulo aprobado es un logro. ¿No aprobaste uno? No pasa nada definitivo: lo vuelves a
    presentar cuando abra la siguiente ventana.`)}
  ${lamina(LAMINA_CALIF, 'Ejemplo: tus calificaciones por módulo y tu tarjeta de avance')}
  ${paso('7.2', 'Descarga tu historial', `El botón <strong>Descargar historial (PDF)</strong> está
    arriba de tus calificaciones. Te da tu documento con todo tu avance, útil para cualquier trámite.`)}
  ${lamina(LAMINA_DESCARGAR, 'Ejemplo: el botón para llevarte tu historial')}
`);

// Lámina: una pregunta de práctica con su retroalimentación (mejor que
// cualquier captura apretada: enseña QUÉ te da una prueba).
const LAMINA_PRUEBA = `
  <div class="prueba">
    <div class="prueba-cab">Prueba de práctica · Módulo 1 — De la información al conocimiento</div>
    <div class="prueba-preg">¿Cuál de las siguientes fuentes es la más confiable para un trabajo escolar?</div>
    <div class="opcion">A · Un comentario en redes sociales</div>
    <div class="opcion opcion-ok">${I.paloma(C.verde)} B · Un artículo de una revista académica</div>
    <div class="opcion">C · Un rumor compartido por mensajería</div>
    <div class="prueba-retro"><strong>¡Correcto!</strong> Las fuentes académicas pasan por revisión antes
      de publicarse. Al terminar, la prueba te dice tus aciertos y qué temas repasar — puedes repetirla
      las veces que quieras.</div>
  </div>`;

const CAP8A = pagina(`
  ${encabezadoCap(8, 'Herramientas · Pruebas', 'Practica antes de presentar.')}
  ${paso('8.1', 'Qué son', `Evaluaciones de práctica por módulo, dentro de tu portal.
    <strong>No cuentan para tu calificación</strong> ni quedan en tu historial oficial: son un
    entrenamiento para llegar seguro al examen real.`)}
  ${paso('8.2', 'Cómo usarlas', `Entra a <strong>Pruebas</strong>, elige el módulo que vas a presentar
    y responde. El portal te da tu puntaje al momento y te dice qué repasar. Repítelas las veces
    que quieras.`)}
  ${lamina(LAMINA_PRUEBA, 'Ejemplo: así se ve una pregunta de práctica, con su explicación')}
`);

// Lámina: el centro de ayuda con una duda ya abierta (ejemplo bueno, no captura).
const LAMINA_FAQ = `
  <div class="faql">
    <div class="faq-buscador">${I.busqueda()} <span>Escribe tu pregunta…</span></div>
    <div class="faq-item faq-abierta">
      <div class="faq-preg">¿Cuándo puedo inscribirme?</div>
      <div class="faq-resp">Solo dentro de la ventana de inscripción de cada etapa (4 a 5 días).
        Consulta la sección Calendario para ver las fechas de tu ciclo.</div>
    </div>
    <div class="faq-item"><div class="faq-preg">¿Qué documentos necesita mi expediente?</div></div>
    <div class="faq-item"><div class="faq-preg">¿Qué llevo el día del examen?</div></div>
  </div>`;

const CAP8B = pagina(`
  ${kicker('CAPÍTULO 08 · PREGUNTAS FRECUENTES')}
  ${paso('8.3', 'Tu primera parada para dudas', `Las preguntas más comunes del trámite ya están
    respondidas en tu portal: inscripción, pagos, documentos y examen. Tiene buscador.`)}
  ${paso('8.4', 'Antes de llamar, busca', `Casi siempre la respuesta ya está escrita, a cualquier
    hora. Si de verdad no aparece, al pie de esa misma pantalla vienen el teléfono y el horario
    de atención.`)}
  ${lamina(LAMINA_FAQ, 'Ejemplo: buscas tu duda y la respuesta se abre ahí mismo')}
`);

// Lámina: calendario de ejemplo del ciclo (8 etapas, inscripción y examen).
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

const CAP8C = pagina(`
  ${kicker('CAPÍTULO 08 · EL CALENDARIO')}
  ${paso('8.5', 'Ocho oportunidades al año', `El ciclo tiene <strong>8 etapas</strong>. Cada una abre su
    ventana de inscripción (4–5 días) y aplica exámenes un fin de semana. En tu sección
    <strong>Calendario</strong> están las fechas exactas: morado = examen, rosa = inscripción.`)}
  ${lamina(LAMINA_CALENDARIO, 'EJEMPLO del ritmo del año — las fechas exactas de tu ciclo están en tu portal')}
  ${cita(`Los días de la ventana son <strong>los únicos</strong> en que puedes inscribirte y pagar.
    Ubica la próxima desde hoy.`)}
`);

const CAP9 = pagina(`
  ${encabezadoCap(9, '¿Necesitas ayuda?', 'En este orden llegas más rápido a la respuesta.')}
  <div class="tarjetas">
    ${tarjeta('1 · Tu gestor', `Si tienes centro de asesoría, es tu primer contacto. Sus datos están
      en tu sección Inscripción.`)}
    ${tarjeta('2 · Preguntas frecuentes', `La mayoría de las dudas ya están resueltas ahí, con buscador.`)}
    ${tarjeta('3 · Teléfono de atención', `El número y horario vigentes aparecen al pie de las Preguntas
      frecuentes del portal.`)}
    ${tarjeta('Ten a la mano', `Tu nombre completo y tu CURP: te los van a pedir para ayudarte.`)}
    ${tarjeta('Soporte de la plataforma', `Si la página falla o no puedes entrar, escribe a
      <strong>contacto@sinapsys.mx</strong> o llama al <strong>+52 443 380 7977</strong>.`)}
  </div>
`);

const ANEXO = pagina(`
  ${kicker('ANEXO · IMPRIME ESTA PÁGINA')}
  <h2 class="cap-titulo">Tu lista de cotejo</h2>
  <p class="lede">Una etapa completa, de principio a fin. Palomea conforme avanzas.</p>
  <div class="cotejo">
    <div class="cot"><span class="cuadro"></span>Mi expediente está completo (5/5) y tengo matrícula</div>
    <div class="cot"><span class="cuadro"></span>Ya sé cuándo abre la ventana (lo vi en el Calendario)</div>
    <div class="cot"><span class="cuadro"></span>Practiqué con las Pruebas de mis módulos</div>
    <div class="cot"><span class="cuadro"></span>Me inscribí DENTRO de la ventana (hasta 4 módulos)</div>
    <div class="cot"><span class="cuadro"></span>Solicité mi orden de pago</div>
    <div class="cot"><span class="cuadro"></span>Pagué antes del vencimiento (la ficha vence a los 7 días)</div>
    <div class="cot"><span class="cuadro"></span>Subí mi comprobante y me confirmaron el pago</div>
    <div class="cot"><span class="cuadro"></span>Me presenté con identificación, a tiempo, en mi sede</div>
    <div class="cot"><span class="cuadro"></span>Revisé mi calificación (se aprueba con 6 o más)</div>
  </div>
  ${cita(`Cada convocatoria repite este mismo ciclo. <strong>22 módulos aprobados = tu certificado.</strong>`)}
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
  .pie-corrido { position: absolute; left: 19mm; right: 19mm; bottom: 5.5mm;
                 display: flex; justify-content: space-between;
                 font-size: 6.5pt; letter-spacing: 0.22em; color: #a3968b;
                 text-transform: uppercase; }

  .kicker { font-size: 7.5pt; font-weight: 700; letter-spacing: 0.28em; color: ${C.dorado};
            text-transform: uppercase; margin-bottom: 6mm; }

  /* Portada */
  .oscura { background: linear-gradient(165deg, ${C.guindaNoche}, ${C.guindaOscuro} 55%, ${C.guinda}); color: #fff; }
  /* El bloque de título se ANCLA AL PIE y todo el aire queda arriba. Centrado
     dejaba un hueco muerto abajo que hacía ver la portada a medio terminar. */
  .portada-centro { margin-top: auto; }
  .portada-logo { font-size: 26pt; font-weight: 700; color: #fff; margin-bottom: 12mm; }
  .portada-logo span { color: ${C.dorado}; }
  .oscura h1 { font-size: 38pt; line-height: 1.12; font-weight: 700; letter-spacing: -0.015em; }
  .portada-frase { margin-top: 12mm; font-size: 13pt; line-height: 1.7; max-width: 134mm;
                   font-weight: 400;
                   padding-bottom: 7mm; border-bottom: 0.3mm solid rgba(255,255,255,0.22); }
  .portada-frase span { color: ${C.doradoSuave}; font-weight: 600; }
  /* Una sola línea: firma institucional a la izquierda, paginación a la
     derecha. Antes eran DOS —ésta y el pie corrido de Chromium, que
     repetía el título de la guía—. Por eso el pie va dentro de la página. */
  .pie-portada { display: flex; justify-content: space-between; align-items: baseline;
                 margin-top: 5mm; font-size: 7pt; letter-spacing: 0.22em;
                 color: rgba(255,255,255,0.55); }

  /* Índice */
  .indice { margin-top: 8mm; }
  .ind-fila { display: flex; align-items: baseline; gap: 6mm; padding: 4.4mm 0;
              border-bottom: 0.3mm solid ${C.linea}; }
  .ind-n { font-weight: 700; font-size: 11pt; color: ${C.dorado}; min-width: 10mm; }
  .ind-t { font-weight: 600; font-size: 12pt; }
  .ind-d { margin-left: auto; color: ${C.gris}; font-size: 9pt; }

  /* Títulos */
  .cap-titulo { font-size: 21pt; line-height: 1.18; color: ${C.guindaNoche}; margin-bottom: 4mm;
                font-weight: 700; letter-spacing: -0.01em; }
  .lede { font-size: 11.5pt; color: ${C.gris}; margin-bottom: 8mm; font-weight: 400; }

  /* Camino */
  .camino { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; margin: 6mm 0 8mm; }
  .cam { background: #fff; border: 0.35mm solid ${C.linea}; border-radius: 3.5mm; padding: 6mm; }
  .cam-n { width: 9mm; height: 9mm; border-radius: 50%; background: ${C.guinda}; color: #fff;
           font-weight: 700; display: flex; align-items: center; justify-content: center; margin-bottom: 3mm; }
  .cam h4 { font-size: 12pt; font-weight: 700; margin-bottom: 1.5mm; color: ${C.guindaNoche}; }
  .cam p { font-size: 9pt; color: ${C.gris}; }

  /* Pasos */
  .paso { display: flex; gap: 5mm; margin-bottom: 6.5mm; }
  .paso-n { font-size: 12.5pt; color: ${C.dorado}; font-weight: 700; min-width: 12mm; }
  .paso-c h3 { font-size: 12pt; font-weight: 700; color: ${C.guindaNoche}; margin-bottom: 1.5mm; }
  .paso-c p { color: #453d38; }

  .doscol { display: flex; gap: 9mm; align-items: flex-start; flex: 1; }
  .doscol-izq { flex: 1.15; }
  .doscol-der { flex: 0.85; display: flex; justify-content: center; }

  /* Figuras */
  .fig { margin: 0; }
  .fig-marco { background: #fff; border: 0.4mm solid ${C.linea}; border-radius: 4mm; padding: 2.5mm;
               box-shadow: 0 1.2mm 3mm rgba(46, 8, 20, 0.07); }
  .fig-marco img { display: block; width: 100%; border-radius: 2.5mm; }
  .fig-tel { width: 62mm; }
  .fig-ancha { width: 100%; margin: 2mm 0 6mm; }
  .fig-ancha .fig-marco { display: flex; justify-content: center; }
  .fig-ancha .fig-marco img { width: auto; max-width: 92%; max-height: 74mm; }
  .fig-ancha figcaption { justify-content: center; }
  figcaption { margin-top: 2.5mm; font-size: 8pt; color: ${C.gris}; display: flex; gap: 2.5mm;
               align-items: center; }
  .fig-punto { width: 2mm; height: 2mm; border-radius: 50%; background: ${C.dorado}; flex-shrink: 0; }
  .lamina { display: block; padding: 5mm; }

  /* Citas y ojo */
  .cita { border-left: 1.2mm solid ${C.dorado}; padding: 3mm 0 3mm 6mm; margin: 7mm 0;
          font-size: 11.5pt; line-height: 1.68; color: ${C.guindaNoche}; font-weight: 400; }
  .cita.ojo { border-left-color: ${C.dorado}; }
  .ojo-k { font-size: 7.5pt; font-weight: 700; letter-spacing: 0.24em; color: ${C.guinda}; margin-bottom: 1.5mm; }

  /* Glosario */
  .glosario { display: grid; grid-template-columns: 1fr 1fr; gap: 2.5mm 6mm; margin: 5mm 0; }
  .glosario > div { border-bottom: 0.3mm solid ${C.linea}; padding: 2mm 0; font-size: 9pt; }
  .glosario strong { display: block; color: ${C.guindaNoche}; font-weight: 600; }
  .glosario span { color: ${C.gris}; font-size: 8.5pt; }

  /* Chips (como el portal) */
  .chip { display: inline-flex; border-radius: 6mm; padding: 1mm 3.5mm; font-size: 8.5pt;
          font-weight: 600; white-space: nowrap; }

  /* Lámina: lista de documentos */
  .docs-lista { display: flex; flex-direction: column; gap: 2.8mm; }
  .doc-item { display: flex; gap: 5mm; align-items: center; background: ${C.cremaClaro};
              border: 0.35mm solid ${C.linea}; border-radius: 3mm; padding: 3.5mm 5mm; }
  .doc-n { width: 8mm; height: 8mm; border-radius: 50%; background: ${C.guinda}; color: #fff;
           font-weight: 700; font-size: 10pt; display: flex; align-items: center; justify-content: center;
           flex-shrink: 0; }
  .doc-item strong { display: block; font-size: 11pt; font-weight: 600; color: ${C.guindaNoche}; }
  .doc-item span { color: ${C.gris}; font-size: 9pt; }
  .doc-extra { border-style: dashed; }
  .doc-extra .doc-n { background: ${C.dorado}; }

  /* Lámina: estados */
  .estados { display: flex; flex-direction: column; gap: 3mm; }
  .est-fila { display: grid; grid-template-columns: 52mm 26mm 1fr; gap: 4mm; align-items: center;
              background: ${C.cremaClaro}; border: 0.35mm solid ${C.linea}; border-radius: 3mm;
              padding: 3.5mm 5mm; }
  .est-doc { font-size: 10pt; }
  .est-doc strong { font-weight: 600; }
  .est-desc { font-size: 9pt; color: ${C.gris}; }
  .est-subir { grid-template-columns: 52mm 1fr 32mm; }
  .boton-subir { background: ${C.guinda}; color: #fff; font-weight: 600; font-size: 9pt;
                 border-radius: 2mm; padding: 2mm 3.5mm; text-align: center; white-space: nowrap; }

  /* Lámina: selección de módulos */
  .mods { display: flex; flex-direction: column; gap: 2.8mm; max-width: 150mm; margin: 0 auto; }
  .mod-fila { display: flex; gap: 4.5mm; align-items: center; background: ${C.cremaClaro};
              border: 0.35mm solid ${C.linea}; border-radius: 3mm; padding: 2.4mm 5mm; }
  .mod-sel { border-color: ${C.guinda}; background: #fdf7f9; }
  .check { width: 6.5mm; height: 6.5mm; border: 0.5mm solid #c9bcae; border-radius: 1.8mm;
           flex-shrink: 0; display: flex; align-items: center; justify-content: center;
           font-weight: 700; color: #fff; font-size: 9pt; }
  .check-on { background: ${C.guinda}; border-color: ${C.guinda}; }
  .mod-fila strong { display: block; font-size: 10pt; font-weight: 600; color: ${C.guindaNoche}; }
  .mod-fila span { font-size: 8.5pt; color: ${C.gris}; }
  .mod-boton { margin-top: 1.5mm; background: ${C.guinda}; color: #fff; text-align: center;
               font-weight: 600; font-size: 10.5pt; border-radius: 2.5mm; padding: 2.8mm; }

  /* Lámina: ruta del pago */
  .ruta-pago { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4mm; }
  .rp { background: ${C.cremaClaro}; border: 0.35mm solid ${C.linea}; border-radius: 3mm; padding: 4.5mm; }
  .rp-n { width: 8mm; height: 8mm; border-radius: 50%; border: 0.5mm solid ${C.guinda};
          color: ${C.guinda}; font-weight: 700; display: flex; align-items: center;
          justify-content: center; margin-bottom: 2.5mm; font-size: 10pt; }
  .rp-hecho { background: ${C.guinda}; color: #fff; }
  .rp strong { display: block; font-size: 10.5pt; font-weight: 700; color: ${C.guindaNoche};
               margin-bottom: 1mm; }
  .rp span { font-size: 8.5pt; color: ${C.gris}; line-height: 1.5; display: block; }

  /* Lámina: calendario de ejemplo */
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

  /* Lámina: exámenes inscritos */
  .exs { display: flex; flex-direction: column; gap: 4mm; max-width: 158mm; margin: 0 auto; }
  .ex-fila { display: grid; grid-template-columns: 20mm 1fr 40mm; gap: 5mm; align-items: center;
             background: ${C.cremaClaro}; border: 0.35mm solid ${C.linea}; border-radius: 3mm;
             padding: 4.5mm 5mm; }
  .ex-fecha { background: ${C.guinda}; color: #fff; border-radius: 2.5mm; text-align: center;
              padding: 2.5mm 0; line-height: 1.25; }
  .ex-fecha strong { display: block; font-size: 14pt; }
  .ex-fecha span { display: block; font-size: 7.5pt; letter-spacing: 0.15em; }
  .ex-fecha em { display: block; font-style: normal; font-size: 8pt; opacity: 0.85; }
  .ex-info strong { display: block; font-size: 10.5pt; font-weight: 600; color: ${C.guindaNoche};
                    line-height: 1.4; margin-bottom: 1mm; }
  .ex-info span { font-size: 9pt; color: ${C.gris}; }
  .ex-fila .chip { justify-self: end; }

  /* Panel del gestor (en grande: quita el estrés de quien sí tiene centro) */
  .panel-gestor { background: #fdf7f9; border: 0.5mm solid ${C.rosaBorde}; border-radius: 4mm;
                  padding: 8mm; margin-top: 8mm; }
  .pg-titulo { font-size: 14pt; font-weight: 700; color: ${C.guindaNoche}; margin-bottom: 2.5mm; }
  .pg-intro { color: ${C.gris}; margin-bottom: 5mm; }
  .pg-fila { display: flex; gap: 5mm; align-items: flex-start; background: #fff;
             border: 0.35mm solid ${C.linea}; border-radius: 3mm; padding: 4.5mm 5mm;
             margin-bottom: 3mm; }
  .pg-icono { font-size: 14pt; }
  .pg-fila strong { display: block; font-size: 11.5pt; font-weight: 700; color: ${C.guindaNoche}; }
  .pg-fila span { font-size: 9.5pt; color: ${C.gris}; line-height: 1.55; }
  .pg-cierre { margin-top: 5mm; font-size: 11pt; color: ${C.guindaNoche}; }

  /* Iconos propios */
  .ico { width: 5mm; height: 5mm; flex-shrink: 0; vertical-align: -1mm; }

  /* Lámina: orden de pago / descargar historial */
  .orden { max-width: 130mm; margin: 0 auto; display: flex; flex-direction: column; gap: 3mm; }
  .orden-fila { display: flex; gap: 4mm; align-items: center; }
  .orden-boton { background: ${C.cremaClaro}; border: 0.45mm solid ${C.guinda}; border-radius: 3mm;
                 padding: 4mm 5mm; }
  .orden-boton strong { display: block; font-size: 10.5pt; font-weight: 600; color: ${C.guindaNoche}; }
  .orden-boton span { font-size: 8.5pt; color: ${C.gris}; }
  .orden-boton > div { flex: 1; }
  .orden-etq { font-size: 7.5pt; font-weight: 700; letter-spacing: 0.2em; color: ${C.gris};
               margin-top: 1mm; }
  .orden-linea { background: ${C.cremaClaro}; border: 0.35mm solid ${C.linea}; border-radius: 2.5mm;
                 padding: 3.5mm 5mm; justify-content: space-between; }
  .orden-linea strong { font-size: 13pt; letter-spacing: 0.08em; color: ${C.guindaNoche}; }
  .orden-vence { font-size: 9pt; color: ${C.gris}; }
  .metodos { display: flex; gap: 3mm; }
  .metodo { flex: 1; text-align: center; border: 0.35mm solid ${C.linea}; border-radius: 2.5mm;
            padding: 3mm; font-size: 9pt; background: #fff; color: ${C.gris}; }
  .metodo-sel { border-color: ${C.guinda}; color: ${C.guinda}; font-weight: 600; background: #fdf7f9; }
  .adjuntar { border: 0.45mm dashed #c9bcae; border-radius: 2.5mm; padding: 4mm; text-align: center;
              color: ${C.gris}; font-size: 9.5pt; display: flex; gap: 3mm; align-items: center;
              justify-content: center; }
  .boton-guinda { background: ${C.guinda}; color: #fff; font-weight: 600; font-size: 10.5pt;
                  border-radius: 2.5mm; padding: 3.5mm; text-align: center; display: flex; gap: 3mm;
                  align-items: center; justify-content: center; }

  /* Lámina: credencial (retrato editorial, horizontal) */
  .cred { max-width: 128mm; margin: 0 auto; border: 0.4mm solid ${C.linea}; border-radius: 4mm;
          overflow: hidden; box-shadow: 0 1mm 2.5mm rgba(46,8,20,0.08); background: #fff; }
  .cred-franja { background: linear-gradient(120deg, ${C.guindaNoche}, ${C.guinda}); color: #fff;
                 padding: 4mm 6mm; display: flex; justify-content: space-between; align-items: center; }
  .cred-marca { font-weight: 700; letter-spacing: 0.22em; font-size: 8.5pt; color: ${C.doradoSuave}; }
  .cred-inst { font-size: 6.5pt; text-align: right; opacity: 0.85; line-height: 1.5; }
  .cred-cuerpo { display: flex; gap: 6mm; padding: 5mm 6mm; align-items: center; }
  .cred-foto { width: 17mm; height: 17mm; border-radius: 3mm; background: ${C.crema};
               border: 0.4mm solid ${C.linea}; color: ${C.guinda}; font-weight: 700; font-size: 15pt;
               display: flex; align-items: center; justify-content: center; }
  .cred-datos { flex: 1; }
  .cred-nombre { font-weight: 700; font-size: 12pt; color: ${C.guindaNoche}; margin-bottom: 1.5mm; }
  .cred-fila { display: flex; gap: 4mm; font-size: 8.5pt; padding: 0.8mm 0; }
  .cred-fila span { min-width: 20mm; color: ${C.gris}; letter-spacing: 0.12em; font-size: 7pt;
                    font-weight: 700; padding-top: 0.4mm; }
  .cred-fila strong { font-weight: 600; color: ${C.tinta}; }
  .cred-sello { text-align: center; color: ${C.guinda}; font-size: 7pt; font-weight: 700;
                line-height: 1.4; }
  .cred-sello .ico { width: 7mm; height: 7mm; display: block; margin: 0 auto 1mm; }

  /* Lámina: pregunta de práctica */
  .prueba { max-width: 148mm; margin: 0 auto; }
  .prueba-cab { font-size: 7.5pt; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase;
                color: ${C.dorado}; margin-bottom: 3mm; }
  .prueba-preg { font-weight: 600; font-size: 11pt; color: ${C.guindaNoche}; margin-bottom: 3mm; }
  .opcion { border: 0.35mm solid ${C.linea}; border-radius: 2.5mm; background: #fff; padding: 3mm 4.5mm;
            font-size: 9.5pt; color: ${C.gris}; margin-bottom: 2.2mm; display: flex; gap: 3mm;
            align-items: center; }
  .opcion-ok { border-color: ${C.verde}; background: ${C.verdeFondo}; color: #14532d; font-weight: 600; }
  .prueba-retro { background: ${C.cremaClaro}; border-left: 1.2mm solid ${C.verde}; border-radius: 2mm;
                  padding: 3.5mm 5mm; font-size: 9.5pt; color: #374035; margin-top: 3mm; }

  /* Lámina: preguntas frecuentes */
  .faql { max-width: 140mm; margin: 0 auto; display: flex; flex-direction: column; gap: 2.6mm; }
  .faq-buscador { display: flex; gap: 3mm; align-items: center; border: 0.4mm solid ${C.linea};
                  border-radius: 6mm; background: #fff; padding: 3mm 5mm; color: #a89a8e;
                  font-size: 9.5pt; }
  .faq-item { border: 0.35mm solid ${C.linea}; border-radius: 2.5mm; background: #fff;
              padding: 3.2mm 5mm; }
  .faq-abierta { border-color: ${C.guinda}; }
  .faq-preg { font-weight: 600; font-size: 10pt; color: ${C.guindaNoche}; }
  .faq-resp { font-size: 9pt; color: ${C.gris}; margin-top: 1.5mm; line-height: 1.55; }

  /* Lámina: login */
  .login { max-width: 132mm; margin: 0 auto; }
  .login-kicker { font-size: 7.5pt; font-weight: 700; letter-spacing: 0.22em; color: ${C.guinda}; }
  .login-titulo { font-size: 17pt; font-weight: 700; color: ${C.guindaNoche}; margin: 1mm 0 4mm; }
  .login-campos { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; margin-bottom: 4mm; }
  .campo-etq { font-size: 7pt; font-weight: 700; letter-spacing: 0.16em; color: ${C.gris};
               margin-bottom: 1.5mm; }
  .campo-caja { display: flex; gap: 3mm; align-items: center; border: 0.4mm solid ${C.linea};
                border-radius: 2.5mm; background: #fff; padding: 3.5mm 4mm; font-size: 10pt;
                color: ${C.tinta}; }
  .campo-ojo { margin-left: auto; }
  .login-boton { max-width: 60mm; margin: 0 auto; }

  /* Login fiel a la página */
  .login2 { max-width: 96mm; margin: 0 auto; border: 0.4mm solid ${C.linea}; border-radius: 3.5mm;
            overflow: hidden; background: #fff; box-shadow: 0 1mm 2.5mm rgba(46,8,20,0.07); }
  .login2-cab { background: linear-gradient(150deg, ${C.guindaNoche}, ${C.guinda}); color: #fff;
                text-align: center; padding: 5mm 4mm; }
  .login2-gob { font-size: 6pt; letter-spacing: 0.24em; opacity: 0.8; }
  .login2-logo { font-size: 17pt; font-weight: 700; letter-spacing: 0.06em; margin: 1.5mm 0 0.5mm; }
  .login2-logo span { color: ${C.doradoSuave}; font-size: 10pt; vertical-align: super; }
  .login2-plan { font-size: 6pt; letter-spacing: 0.22em; color: ${C.doradoSuave}; }
  .login2-cuerpo { padding: 5mm 6mm 6mm; }
  .login2-sub { font-size: 8.5pt; color: ${C.gris}; margin: 1mm 0 4mm; }
  .login2 .campo { margin-bottom: 3mm; }
  .login2 .campo-caja em { font-style: normal; color: #a89a8e; }
  .login2-olvide { text-align: right; font-size: 8pt; font-weight: 600; color: ${C.guinda};
                   margin: -1mm 0 3mm; }
  .login2 .login-titulo { font-size: 14pt; margin-bottom: 0; }
  .login2 .login-kicker { font-size: 6.5pt; }

  /* Lámina: calificaciones */
  .califs { max-width: 150mm; margin: 0 auto; display: flex; flex-direction: column; gap: 2.8mm; }
  .calif-fila { display: grid; grid-template-columns: 1fr 16mm 30mm; gap: 4mm; align-items: center;
                background: #fff; border: 0.35mm solid ${C.linea}; border-radius: 2.5mm;
                padding: 3mm 4.5mm; }
  .calif-mod strong { display: block; font-size: 10pt; font-weight: 600; color: ${C.guindaNoche}; }
  .calif-mod span { font-size: 8pt; color: ${C.gris}; }
  .calif-nota { font-size: 14pt; font-weight: 700; color: ${C.verde}; text-align: center; }
  .calif-pend { color: #b8aca1; }
  .calif-fila .chip { justify-self: end; }
  .avance { background: linear-gradient(120deg, #14532d, ${C.verde}); color: #fff; border-radius: 3mm;
            padding: 4.5mm 6mm; display: flex; align-items: center; gap: 8mm; margin-top: 1mm; }
  .av-etq { display: none; }
  .av-titulo { flex: 1; font-size: 12.5pt; font-weight: 700; line-height: 1.3; }
  .av-titulo span { display: block; font-size: 8pt; font-weight: 400; opacity: 0.85; }
  .av-nums { display: flex; gap: 7mm; }
  .av-nums strong { display: block; font-size: 15pt; }
  .av-nums span { font-size: 6.5pt; letter-spacing: 0.18em; opacity: 0.85; }

  /* Lámina: opción ancha (recuperar) */
  .opcion-ancha { max-width: 140mm; margin: 0 auto; display: flex; gap: 5mm; align-items: center;
                  border: 0.45mm solid ${C.guinda}; border-radius: 3mm; background: ${C.cremaClaro};
                  padding: 5mm 6mm; }
  .oa-icono .ico { width: 7mm; height: 7mm; }
  .opcion-ancha > div { flex: 1; }
  .opcion-ancha strong { display: block; font-size: 11.5pt; font-weight: 700; color: ${C.guindaNoche}; }
  .opcion-ancha span { font-size: 9pt; color: ${C.gris}; }
  .oa-continuar { font-weight: 700; color: ${C.guinda}; white-space: nowrap; font-size: 9.5pt; }

  /* Lámina: inicio */
  .inicio { max-width: 140mm; margin: 0 auto; }
  .inicio-cab { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4mm; }
  .inicio-hola { font-size: 15pt; font-weight: 700; color: ${C.guindaNoche}; }
  .inicio-sub { font-size: 8.5pt; color: ${C.gris}; }
  .inicio-etq { font-size: 7pt; font-weight: 700; letter-spacing: 0.2em; color: ${C.dorado};
                margin-bottom: 2mm; }
  .inicio-tarea { display: flex; gap: 3.5mm; align-items: center; background: #fff;
                  border: 0.35mm solid ${C.linea}; border-radius: 2.5mm; padding: 3.2mm 4.5mm;
                  font-size: 9.5pt; color: ${C.tinta}; margin-bottom: 2.4mm; }
  .inicio-ir { margin-left: auto; color: ${C.guinda}; font-weight: 700; font-size: 8.5pt; }
  .inicio-menu { display: flex; justify-content: space-between; border-top: 0.35mm solid ${C.linea};
                 margin-top: 4mm; padding: 3mm 2mm 0; font-size: 8pt; color: ${C.gris}; }
  .im-activo { color: ${C.guinda}; font-weight: 700; border-top: 0.8mm solid ${C.guinda};
               margin-top: -3.2mm; padding-top: 2.4mm; }

  /* Tarjetas */
  .tarjetas { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; margin-top: 4mm; }
  .tarjeta { background: #fff; border: 0.35mm solid ${C.linea}; border-radius: 3.5mm; padding: 6mm; }
  .tarjeta h4 { font-size: 11.5pt; font-weight: 700; color: ${C.guindaNoche}; margin-bottom: 2mm; }
  .tarjeta p { font-size: 9.5pt; color: ${C.gris}; }

  /* Cotejo */
  .cotejo { margin-top: 4mm; }
  .cot { display: flex; align-items: center; gap: 5mm; padding: 4.4mm 0; font-size: 11.5pt;
         border-bottom: 0.3mm dashed ${C.linea}; }
  .cuadro { width: 6.5mm; height: 6.5mm; border: 0.6mm solid ${C.guinda}; border-radius: 1.8mm;
            flex-shrink: 0; }
</style></head>
<body>
${PORTADA}
${INDICE}
${CAMINO}
${CAP1A}
${CAP1B}
${CAP2}
${CAP3A}
${CAP3B}
${CAP3C}
${CAP4A}
${CAP4B}
${CAP4C}
${CAP5A}
${CAP5B}
${CAP6}
${CAP7}
${CAP8A}
${CAP8B}
${CAP8C}
${CAP9}
${ANEXO}
</body></html>`;

// ── Imprimir ───────────────────────────────────────────────────────────────
// Ya se sabe cuántas páginas son: se sustituye el marcador de todos los pies.
const HTML_FINAL = HTML.replaceAll('@@TOTAL@@', String(_pags));
if (process.env.GUIAS_HTML_OUT) fs.writeFileSync(process.env.GUIAS_HTML_OUT, HTML_FINAL);

const navegador = await chromium.launch({
  executablePath: process.env.GUIAS_CHROMIUM ?? '/opt/pw-browsers/chromium',
});
const page = await navegador.newPage();
await page.setContent(HTML_FINAL, { waitUntil: 'networkidle' });
await page.pdf({
  path: SALIDA,
  format: 'Letter',
  printBackground: true,
  // El pie va dentro de cada página (ver `pagina()`), no aquí.
  displayHeaderFooter: false,
  margin: { top: '0', bottom: '0', left: '0', right: '0' },
});
await navegador.close();

const kb = Math.round(fs.statSync(SALIDA).size / 1024);
console.log(`✅ ${SALIDA} (${kb} KB)`);
