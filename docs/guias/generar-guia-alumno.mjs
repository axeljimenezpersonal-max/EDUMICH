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
const pagina = (contenido, extra = '') => `<section class="pagina ${extra}">${contenido}</section>`;

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
const ojo = (texto) => `<div class="cita ojo"><div class="ojo-k">⚠ OJO</div>${texto}</div>`;
const tarjeta = (titulo, cuerpo) => `<div class="tarjeta"><h4>${esc(titulo)}</h4><p>${cuerpo}</p></div>`;

function encabezadoCap(numero, titulo, lede) {
  return `
  ${kicker(`CAPÍTULO ${String(numero).padStart(2, '0')}`)}
  <h2 class="cap-titulo">${esc(titulo)}</h2>
  ${lede ? `<p class="lede">${lede}</p>` : ''}`;
}

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
  <div class="pie-portada">PREPA.MODULA22.MX · IEMSYS · GOBIERNO DE MICHOACÁN</div>
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
    <div class="ind-fila"><span class="ind-n">07</span><span class="ind-t">Paso 4 · Tus resultados</span><span class="ind-d">se aprueba con 60</span></div>
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
    <div class="cam"><div class="cam-n">4</div><h4>Resultados</h4><p>Se aprueba con 60. Son 22 módulos en total.</p></div>
  </div>
  ${cita(`<strong>¿Tienes centro de asesoría?</strong> Entonces tu gestor te <strong>inscribe y paga por ti</strong>
   (pasos 2 y 3): tú subes tus documentos y te presentas al examen. Si llevas tu proceso por tu cuenta,
   esta guía te enseña a hacer todo tú.`)}
`);

const CAP1A = pagina(`
  ${encabezadoCap(1, 'Tu primer ingreso', 'De tu correo de bienvenida a tu portal en tres minutos.')}
  ${dosCol(`
    ${paso('1.1', 'Recibe tu correo de bienvenida', `Cuando tu cuenta se crea, te llega un correo de
      <strong>Preparatoria Abierta Michoacán</strong> con tus credenciales: tu usuario —el mismo
      correo que registraste— y una <strong>contraseña temporal</strong>. Si no lo ves, revisa
      <em>correo no deseado</em>.`)}
    ${paso('1.2', 'Entra al portal', `Abre <strong>prepa.modula22.mx</strong>, toca <strong>Iniciar sesión</strong>
      y escribe tu correo y contraseña. El botón del ojo te deja ver lo que escribes.`)}
    ${paso('1.3', 'Cambia tu contraseña', `La primera vez, el portal te pide elegir tu contraseña definitiva.
      Escríbela dos veces y guárdala donde no la pierdas.`)}
  `, figura(img('01-login'), 'La pantalla de inicio de sesión', { telefono: true }))}
`);

const CAP1B = pagina(`
  ${kicker('CAPÍTULO 01 · CONTINUACIÓN')}
  ${paso('1.4', '¿La olvidaste? Recupérala por correo', `En el inicio de sesión toca
    <strong>Olvidé mi contraseña</strong> y elige <strong>recibir correo de recuperación</strong>:
    te llega un enlace para elegir una contraseña nueva.`)}
  ${figura(img('02b-opcion-correo'), 'La opción para recuperar tu contraseña por correo', { alto: '44mm' })}
  ${paso('1.5', '¿No sabes si ya tienes cuenta?', `En la misma pantalla de inicio de sesión está la opción
    para <strong>buscar tu cuenta</strong> con tu CURP o tu nombre, antes de solicitar una nueva.`)}
  ${figura(img('02c-opcion-buscar'), 'La opción para buscar si ya tienes cuenta', { alto: '34mm' })}
  ${ojo(`La contraseña temporal solo sirve <strong>una vez</strong>, y el enlace de recuperación
    <strong>caduca en 1 hora</strong>. Úsalo en cuanto llegue.`)}
`);

const CAP2 = pagina(`
  ${encabezadoCap(2, 'Conoce tu portal', 'Todo vive en el menú. Si te pierdes, vuelve a Inicio.')}
  ${dosCol(`
    ${paso('2.1', 'Tu Inicio', `Cada vez que entres verás en qué punto vas y qué te toca hacer.
      En el teléfono el menú va abajo; el botón <strong>Más</strong> abre el resto de las secciones.`)}
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
    ${cita(`El botón de ayuda <strong>(?)</strong> reinicia el tutorial en pantalla cuando quieras,
      sección por sección.`)}
  `, figura(img('03-inicio-nuevo'), 'Tu Inicio: el punto de partida', { telefono: true }))}
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
      <div class="est-doc">📄 <strong>CURP</strong></div>
      ${chip('Aprobado', C.verdeFondo, C.verde)}
      <span class="est-desc">Listo: este ya cuenta para tu 5/5.</span>
    </div>
    <div class="est-fila">
      <div class="est-doc">📄 <strong>Acta de nacimiento</strong></div>
      ${chip('En revisión', C.ambarFondo, C.ambarTexto)}
      <span class="est-desc">La administración lo está revisando. Solo espera.</span>
    </div>
    <div class="est-fila est-mal">
      <div class="est-doc">📄 <strong>Comprobante de domicilio</strong></div>
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
      <div class="est-doc">📄 <strong>CURP</strong></div>
      <span class="est-desc">Aún sin archivo</span>
      <span class="boton-subir">⬆ Subir PDF</span>
    </div>
    <div class="est-fila est-subir">
      <div class="est-doc">📄 <strong>Acta de nacimiento</strong></div>
      <span class="est-desc">Aún sin archivo</span>
      <span class="boton-subir">⬆ Subir PDF</span>
    </div>
    <div class="est-fila est-subir">
      <div class="est-doc">📄 <strong>Certificado de secundaria</strong></div>
      <span class="est-desc">Aún sin archivo</span>
      <span class="boton-subir">⬆ Subir PDF</span>
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
  <div class="panel-gestor">
    <div class="pg-titulo">🤝 ¿Tienes centro de asesoría? Respira: casi todo esto lo hace tu gestor</div>
    <p class="pg-intro">Si un gestor te acompaña, no te estreses con estos trámites. Esto es lo que
      hace <strong>él por ti</strong>:</p>
    <div class="pg-fila"><span class="pg-icono">📄</span><div><strong>Tus documentos</strong>
      <span>Puede subirlos por ti al expediente, si se los entregas.</span></div></div>
    <div class="pg-fila"><span class="pg-icono">📝</span><div><strong>La inscripción</strong>
      <span>La hace él — es el único que puede inscribirte. Por eso en tu portal no verás botones
      de inscripción: no te falta nada, así debe ser.</span></div></div>
    <div class="pg-fila"><span class="pg-icono">🏦</span><div><strong>El pago</strong>
      <span>Él solicita la ficha ante la Tesorería, paga y sube el comprobante.</span></div></div>
    <p class="pg-cierre">Tú te encargas de lo importante: <strong>estudiar y presentarte el día del
      examen</strong>. Sus datos de contacto están en tu sección Inscripción.</p>
  </div>
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

const CAP5B = pagina(`
  ${kicker('CAPÍTULO 05 · CONTINUACIÓN')}
  ${paso('5.3', 'Descarga tu orden y págala', `Cuando la orden queda emitida aparece este bloque:
    descarga tu orden en PDF, copia la <strong>línea de captura</strong> y págala en banco, tienda o
    en línea, antes de su vencimiento.`)}
  ${figura(img('07d-linea-captura'), 'Paso 1 del bloque: tu orden, tu línea de captura y el vencimiento', { alto: '56mm' })}
  ${paso('5.4', '¿Ya pagaste? Sube tu comprobante', `En el mismo bloque, elige cómo pagaste y adjunta la
    foto o PDF de tu comprobante. Al confirmarse, tu lugar queda asegurado. Si tienes centro de
    asesoría, <strong>este pago lo hace tu gestor por ti</strong>, igual que la inscripción.`)}
  ${figura(img('07e-comprobante'), 'Paso 2 del bloque: elige el método y sube tu comprobante', { alto: '44mm' })}
  ${ojo(`Tu ficha <strong>vence a los 7 días</strong> de emitida, y solo lo pagado se califica.`)}
`);

const CAP6 = pagina(`
  ${encabezadoCap(6, 'El día del examen', 'Identificación, tu sede y llegar con tiempo.')}
  ${dosCol(`
    ${paso('6.1', 'Lleva tu identificación', `Una identificación oficial (INE, o tu credencial de
      estudiante del portal). Es lo que te piden al entrar.`)}
    ${paso('6.2', 'Ubica tu sede desde antes', `La dirección y el mapa están en tu
      <strong>Inscripción</strong>. Llega con tiempo: los horarios de aplicación son exactos
      (09:00 y 11:00).`)}
    ${paso('6.3', 'Tu credencial digital', `Vive en <strong>ID</strong>, con tu foto. Te identifica
      dentro del programa.`)}
  `, figura(img('09-identificacion'), 'Tu credencial de estudiante, en la sección ID', { telefono: true }))}
`);

const CAP7 = pagina(`
  ${encabezadoCap(7, 'Paso 4 · Tus resultados', 'Se aprueba con 60. El certificado son 22 módulos.')}
  ${dosCol(`
    ${paso('7.1', 'Consulta tus calificaciones', `Después de cada etapa, cada módulo aparece con su
      calificación — y abajo, tu tarjeta de avance: cuántos de los 22 llevas aprobados y tu promedio.
      Cada módulo aprobado es un logro: ¡míralo crecer!`)}
    ${cita(`<strong>¿No aprobaste uno?</strong> No pasa nada definitivo: lo vuelves a presentar en una
      etapa siguiente. Inscríbelo otra vez cuando abra la ventana.`)}
  `, figura(img('10-calificaciones'), 'Tu historial y tu tarjeta de avance', { telefono: true }))}
  ${paso('7.2', 'Descarga tu historial', `El botón <strong>Descargar historial (PDF)</strong> te da tu
    documento con todo tu avance, útil para cualquier trámite.`)}
  ${figura(img('10b-calif-descargar'), 'El botón para descargar tu historial en PDF', { alto: '40mm' })}
`);

const CAP8A = pagina(`
  ${encabezadoCap(8, 'Herramientas · Pruebas', 'Practica antes de presentar.')}
  ${dosCol(`
    ${paso('8.1', 'Qué son', `Evaluaciones de práctica por módulo, dentro de tu portal.
      <strong>No cuentan para tu calificación</strong> ni quedan en tu historial oficial: son un
      entrenamiento para llegar seguro al examen real.`)}
    ${paso('8.2', 'Cómo usarlas', `Entra a <strong>Pruebas</strong>, elige el módulo que vas a presentar
      y responde. Puedes repetirlas las veces que quieras; el portal te da tu puntaje al momento.`)}
    ${cita(`Presentar sin practicar es ir a ciegas. Una prueba antes del examen te dice exactamente
      qué repasar.`)}
  `, figura(img('11-pruebas'), 'Pruebas: tu área de práctica por módulo', { telefono: true }))}
`);

const CAP8B = pagina(`
  ${kicker('CAPÍTULO 08 · PREGUNTAS FRECUENTES')}
  ${dosCol(`
    ${paso('8.3', 'Tu primera parada para dudas', `Las preguntas más comunes del trámite ya están
      respondidas ahí: inscripción, pagos, documentos y examen. Tiene buscador.`)}
    ${paso('8.4', 'Antes de llamar, busca', `Casi siempre la respuesta ya está escrita, a cualquier
      hora. Si de verdad no aparece, al pie de esa misma pantalla vienen el teléfono y el horario
      de atención.`)}
  `, figura(img('13-faq'), 'Preguntas frecuentes, con su buscador', { telefono: true }))}
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
    <div class="cot"><span class="cuadro"></span>Revisé mi calificación (se aprueba con 60+)</div>
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

  .kicker { font-size: 7.5pt; font-weight: 700; letter-spacing: 0.28em; color: ${C.dorado};
            text-transform: uppercase; margin-bottom: 6mm; }

  /* Portada */
  .oscura { background: linear-gradient(165deg, ${C.guindaNoche}, ${C.guindaOscuro} 55%, ${C.guinda}); color: #fff; }
  .portada-centro { margin: auto 0; }
  .portada-logo { font-size: 26pt; font-weight: 700; color: #fff; margin-bottom: 12mm; }
  .portada-logo span { color: ${C.dorado}; }
  .oscura h1 { font-size: 38pt; line-height: 1.12; font-weight: 700; letter-spacing: -0.015em; }
  .portada-frase { margin-top: 14mm; font-size: 13pt; line-height: 1.75; max-width: 132mm; font-weight: 400; }
  .portada-frase span { color: ${C.doradoSuave}; font-weight: 600; }
  .pie-portada { font-size: 7.5pt; letter-spacing: 0.24em; color: rgba(255,255,255,0.55); }

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
  .cita.ojo { border-left-color: ${C.guinda}; }
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
      <span>Modula · Plan 22 — Guía del estudiante</span>
      <span>${FECHA_VERSION} · Pág. <span class="pageNumber"></span> de <span class="totalPages"></span></span>
    </div>`,
  margin: { top: '0', bottom: '0', left: '0', right: '0' },
});
await navegador.close();

const kb = Math.round(fs.statSync(SALIDA).size / 1024);
console.log(`✅ ${SALIDA} (${kb} KB)`);
