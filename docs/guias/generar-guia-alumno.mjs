/**
 * GENERADOR — Guía del estudiante en PDF.
 *
 * Compone la guía (HTML con la marca de Modula) usando las capturas de
 * `capturar-alumno.mjs` y la imprime a PDF con el Chromium de la máquina.
 * NADA se maqueta a mano: cambia la interfaz → se recapturan las fotos → se
 * corre esto → guía nueva.
 *
 * Lenguaje visual (siguiendo el manual de referencia del equipo): portada
 * editorial en guinda sólido con una frase, no una lámina; kickers dorados en
 * versalitas; serif para títulos y frases; UNA página = UNA idea, con el aire
 * como decisión y no como hueco; toda foto va enmarcada y con pie de foto;
 * el folio del pie es parte del diseño de la página.
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

const fechaCruda = new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
const FECHA_VERSION = fechaCruda.charAt(0).toUpperCase() + fechaCruda.slice(1);

// ── Paleta (manual de identidad + portal) ──────────────────────────────────
const C = {
  guinda: '#6b1530', guindaOscuro: '#4a0e20', guindaNoche: '#2e0814',
  crema: '#f7f2ed', cremaClaro: '#fcfaf7', linea: '#e7dfd5',
  dorado: '#b89968', doradoSuave: '#cdb48c',
  tinta: '#2b2320', gris: '#6b615a',
  verde: '#2d7d46', ambar: '#b45309',
  moradoExamen: '#6d28d9', rosaInscripcion: '#f7e6ec',
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// ── Piezas ─────────────────────────────────────────────────────────────────

/** Kicker dorado en versalitas: "CAPÍTULO 03 · TU EXPEDIENTE". */
const kicker = (t) => `<div class="kicker">${esc(t)}</div>`;

/** Página nueva. Todo bloque de primer nivel vive dentro de una .pagina. */
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

/** Paso: número dorado + título + cuerpo (la foto va aparte, como figura). */
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

/** Dos columnas: pasos a la izquierda, figura de teléfono a la derecha. */
const dosCol = (izq, der) => `<div class="doscol"><div class="doscol-izq">${izq}</div><div class="doscol-der">${der}</div></div>`;

/** Cita/regla con borde dorado (el énfasis editorial del manual de referencia). */
const cita = (texto) => `<div class="cita">${texto}</div>`;

/** Advertencia: misma cita, pero en guinda y con OJO como kicker. */
const ojo = (texto) => `<div class="cita ojo"><div class="ojo-k">⚠ OJO</div>${texto}</div>`;

/** Tarjeta blanca (para rejillas 2×2). */
const tarjeta = (titulo, cuerpo) => `<div class="tarjeta"><h4>${esc(titulo)}</h4><p>${cuerpo}</p></div>`;

function encabezadoCap(numero, titulo, lede) {
  return `
  ${kicker(`CAPÍTULO ${String(numero).padStart(2, '0')}`)}
  <h2 class="cap-titulo">${esc(titulo)}</h2>
  ${lede ? `<p class="lede">${lede}</p>` : ''}`;
}

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
    <div class="ind-fila"><span class="ind-n">05</span><span class="ind-t">Paso 3 · Paga tu examen</span><span class="ind-d">$131 · Tesorería del Estado</span></div>
    <div class="ind-fila"><span class="ind-n">06</span><span class="ind-t">El día del examen</span><span class="ind-d">pase QR, sede y horario</span></div>
    <div class="ind-fila"><span class="ind-n">07</span><span class="ind-t">Paso 4 · Tus resultados</span><span class="ind-d">se aprueba con 60</span></div>
    <div class="ind-fila"><span class="ind-n">08</span><span class="ind-t">Herramientas</span><span class="ind-d">pruebas, calendario y ayuda</span></div>
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
    <div class="cam"><div class="cam-n">3</div><h4>Pago</h4><p>$131 por examen, con línea de captura oficial.</p></div>
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
      <strong>Preparatoria Abierta Michoacán</strong> con tu usuario y una <strong>contraseña temporal</strong>.
      Si no lo ves, revisa <em>correo no deseado</em>.`)}
    ${paso('1.2', 'Entra al portal', `Abre <strong>prepa.modula22.mx</strong>, toca <strong>Iniciar sesión</strong>
      y escribe tu correo y contraseña. El botón del ojo te deja ver lo que escribes.`)}
    ${paso('1.3', 'Cambia tu contraseña', `La primera vez, el portal te pide elegir tu contraseña definitiva.
      Escríbela dos veces y guárdala donde no la pierdas.`)}
  `, figura(img('01-login'), 'La pantalla de inicio de sesión', { telefono: true }))}
`);

const CAP1B = pagina(`
  ${kicker('CAPÍTULO 01 · CONTINUACIÓN')}
  ${dosCol(`
    ${paso('1.4', '¿La olvidaste? Recupérala', `En el inicio de sesión toca <strong>Olvidé mi contraseña</strong>:
      te llega un enlace a tu correo para elegir una nueva.`)}
    ${ojo(`La contraseña temporal solo sirve <strong>una vez</strong>, y el enlace de recuperación
      <strong>caduca en 1 hora</strong>. Úsalo en cuanto llegue.`)}
  `, figura(img('02-recuperar-password'), 'Recuperar contraseña, paso a paso', { telefono: true }))}
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
      <div><strong>ID</strong><span>credencial y pase</span></div>
      <div><strong>Calendario</strong><span>fechas del ciclo</span></div>
      <div><strong>Preguntas frecuentes</strong><span>dudas resueltas</span></div>
    </div>
    ${cita(`El botón de ayuda <strong>(?)</strong> reinicia el tutorial en pantalla cuando quieras,
      sección por sección.`)}
  `, figura(img('03-inicio-nuevo'), 'Tu Inicio: el punto de partida', { telefono: true }))}
`);

const CAP3A = pagina(`
  ${encabezadoCap(3, 'Paso 1 · Tu expediente', 'Cinco documentos y tu fotografía. Sin esto no hay inscripción.')}
  ${dosCol(`
    ${paso('3.1', 'Reúne tus documentos', `<strong>CURP</strong>, <strong>acta de nacimiento</strong>,
      <strong>identificación oficial</strong>, <strong>comprobante de domicilio</strong> (máximo 3 meses) y
      <strong>certificado de secundaria</strong>. En PDF o foto legible. Además, una <strong>fotografía</strong>
      tipo selfie para tu credencial.`)}
    ${paso('3.2', 'Súbelos en Expediente', `Toca el botón de subir en cada documento. La lista te dice
      cuáles faltan.`)}
    ${paso('3.3', 'Espera la revisión', `La administración revisa cada uno. Si algo se
      <strong>rechaza</strong>, ahí mismo dice el motivo: corrige y vuelve a subirlo.`)}
  `, figura(img('04-expediente-vacio'), 'Así se ve tu expediente recién creado', { telefono: true }))}
`);

const CAP3B = pagina(`
  ${kicker('CAPÍTULO 03 · CONTINUACIÓN')}
  ${paso('3.4', 'Tu barra debe llegar a 5/5', `Con los cinco documentos aprobados, tu expediente está completo.`)}
  ${figura(img('05-exp-progreso'), 'Expediente completo: 5 de 5 documentos aprobados', { alto: '48mm' })}
  ${paso('3.5', 'Te asignan tu matrícula', `Con el expediente completo, la administración te asigna tu
    <strong>matrícula oficial</strong>: tu número para todo el proceso. Aparece arriba en tu Expediente.`)}
  ${figura(img('05b-exp-matricula'), 'Tu matrícula oficial, ya asignada', { alto: '62mm' })}
  ${ojo(`Sin expediente completo <strong>no puedes inscribirte</strong>, y la revisión puede tomar días.
    No lo dejes para la semana de la inscripción.`)}
`);

const CAP4A = pagina(`
  ${encabezadoCap(4, 'Paso 2 · Inscríbete', 'La ventana dura 4 o 5 días. Todo pasa dentro de ella.')}
  ${paso('4.1', 'Espera a que abra la ventana', `Cuando la inscripción está abierta, tu sección
    <strong>Inscripción</strong> la anuncia con las fechas exactas y los días que faltan para el cierre.`)}
  ${figura(img('06-insc-ventana'), 'La convocatoria abierta, con sus fechas y su cuenta regresiva')}
  ${paso('4.2', 'Elige tus módulos', `Marca hasta <strong>4 módulos</strong> y confírmalos. Cada uno tiene su
    día y hora (sábado o domingo). Si la convocatoria abrió varias sedes, elige también dónde presentas.`)}
  ${figura(img('06b-insc-modulos'), 'Los módulos disponibles para esta etapa')}
`);

const CAP4B = pagina(`
  ${kicker('CAPÍTULO 04 · CONTINUACIÓN')}
  ${paso('4.3', 'Revisa tus exámenes', `Quedas como <strong>pre-inscrito</strong> y se genera tu ficha de pago.
    Tu lugar se confirma hasta que el pago se valida.`)}
  ${figura(img('06c-insc-examenes'), 'Tus exámenes inscritos, con su estado')}
  ${paso('4.4', 'Tu sede queda asignada', `Con su dirección y el mapa. Es la misma para todos los módulos
    de la convocatoria.`)}
  ${figura(img('06d-insc-sede'), 'Tu sede de examen')}
`);

const CAP4C = pagina(`
  ${kicker('CAPÍTULO 04 · LA REGLA MÁS IMPORTANTE')}
  ${ojo(`<strong>La ventana es estricta.</strong> Fuera de esas fechas no se puede inscribir ni pagar —
    no hay excepciones: así funciona la convocatoria estatal. Consulta el Calendario y no lo dejes
    para el último día.`)}
  ${figura(img('06e-insc-pasos'), 'El propio portal te deja la ruta: ficha → pago → confirmación → pase')}
  ${cita(`<strong>¿Tienes centro de asesoría?</strong> Esta parte no te toca: <strong>tu gestor te inscribe</strong>.
    En tu Inscripción están sus datos para ponerte de acuerdo. Tú sigue en el capítulo 6.`)}
`);

const CAP5A = pagina(`
  ${encabezadoCap(5, 'Paso 3 · Paga tu examen', 'Cada examen cuesta $131. La orden la emite la Tesorería del Estado.')}
  ${paso('5.1', 'Mira tu resumen', `En <strong>Pagos</strong>: cuántos exámenes llevas, cuántos ya están
    cubiertos y el costo por examen.`)}
  ${figura(img('07-pagos-resumen'), 'Tu resumen: inscritos, pagados y costo')}
  ${paso('5.2', 'Solicita tu orden de pago', `Cada examen sin pagar trae su botón
    <strong>Solicitar orden</strong>. La Tesorería la emite con tu línea de captura.`)}
  ${figura(img('07b-pagos-estado'), 'El estado de pago de cada examen inscrito')}
`);

const CAP5B = pagina(`
  ${kicker('CAPÍTULO 05 · CONTINUACIÓN')}
  ${paso('5.3', 'Paga con tu línea de captura', `Cada orden muestra en qué paso va
    (<strong>solicitada → emisión → pago → confirmado</strong>). Cuando queda emitida, copia tu
    <strong>línea de captura</strong> y págala en banco, tienda o en línea.`)}
  ${paso('5.4', 'Sube tu comprobante', `En el mismo bloque, elige cómo pagaste y adjunta la foto o PDF
    de tu comprobante. Al confirmarse, tu examen queda <strong>pagado</strong> y tu lugar asegurado.`)}
  ${figura(img('07d-linea-captura'), 'El bloque de pago: descarga tu orden, copia la línea de captura y sube tu comprobante', { alto: '108mm' })}
  ${ojo(`Tu ficha <strong>vence a los 7 días</strong> de emitida, y solo lo pagado se califica.`)}
`);

const CAP6 = pagina(`
  ${encabezadoCap(6, 'El día del examen', 'Pase, identificación, y llega con tiempo.')}
  ${dosCol(`
    ${paso('6.1', 'Descarga tu pase', `Con el pago confirmado, en <strong>ID</strong> descargas tu
      <strong>pase de examen</strong>: módulo, sede, horario y el <strong>código QR</strong> que escanean
      al entrar.`)}
    ${paso('6.2', 'Lleva contigo', `Tu pase (en el teléfono o impreso) y una <strong>identificación</strong>.
      La dirección de tu sede y el mapa están en tu Inscripción.`)}
    ${paso('6.3', 'Tu credencial digital', `También vive en <strong>ID</strong>, con tu foto: te identifica
      dentro del programa.`)}
  `, figura(img('08-pase-examen'), 'Tu pase de examen con código QR', { telefono: true }))}
`);

const CAP7 = pagina(`
  ${encabezadoCap(7, 'Paso 4 · Tus resultados', 'Se aprueba con 60. El certificado son 22 módulos.')}
  ${dosCol(`
    ${paso('7.1', 'Consulta tus calificaciones', `Después de cada etapa, cada módulo aparece con su
      calificación, cuántos de los 22 llevas aprobados y tu promedio.`)}
    ${paso('7.2', 'Descarga tu historial', `El botón de descargar te da tu historial en PDF, útil para
      cualquier trámite.`)}
    ${cita(`<strong>¿No aprobaste uno?</strong> No pasa nada definitivo: lo vuelves a presentar en una
      etapa siguiente. Inscríbelo otra vez cuando abra la ventana.`)}
  `, figura(img('10-calificaciones'), 'Tu historial académico en Calificaciones', { telefono: true }))}
`);

const CAP8A = pagina(`
  ${encabezadoCap(8, 'Herramientas que te ayudan', '')}
  ${dosCol(`
    ${paso('8.1', 'Pruebas · practica antes', `Evaluaciones de práctica por módulo.
      <strong>No cuentan para tu calificación</strong>: son para llegar preparado.`)}
    ${paso('8.2', 'Preguntas frecuentes', `Las dudas más comunes, ya resueltas. Busca ahí antes de llamar:
      casi siempre la respuesta ya está.`)}
    ${paso('8.3', 'Mi aula', `Si tu centro la activó, ahí están tus clases en línea. Con candado =
      tu centro aún no la usa.`)}
  `, figura(img('11-pruebas'), 'Pruebas: tu área de práctica', { telefono: true }))}
`);

const CAP8B = pagina(`
  ${kicker('CAPÍTULO 08 · EL CALENDARIO')}
  ${dosCol(`
    ${paso('8.4', 'Las fechas del ciclo', `Todas las etapas del año en una cuadrícula.
      Dos colores y ya:`)}
    <div class="colores">
      <div class="color-item"><span class="muestra" style="background:${C.moradoExamen}"></span>
        <div><strong>Morado</strong><br/>día de examen</div></div>
      <div class="color-item"><span class="muestra" style="background:${C.rosaInscripcion};border:1px solid #e3b5c4"></span>
        <div><strong>Rosa</strong><br/>ventana de inscripción</div></div>
    </div>
    ${cita(`Los días rosas son <strong>los únicos</strong> en que puedes inscribirte y pagar.
      Ubícalos desde antes.`)}
  `, figura(img('12-calendario'), 'El Calendario, con su leyenda de colores', { telefono: true }))}
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
    <div class="cot"><span class="cuadro"></span>Me inscribí DENTRO de la ventana (hasta 4 módulos)</div>
    <div class="cot"><span class="cuadro"></span>Solicité mi orden de pago</div>
    <div class="cot"><span class="cuadro"></span>Pagué antes del vencimiento (la ficha vence a los 7 días)</div>
    <div class="cot"><span class="cuadro"></span>Subí mi comprobante y me confirmaron el pago</div>
    <div class="cot"><span class="cuadro"></span>Descargué mi pase de examen (código QR)</div>
    <div class="cot"><span class="cuadro"></span>Me presenté con pase + identificación, a tiempo</div>
    <div class="cot"><span class="cuadro"></span>Revisé mi calificación (se aprueba con 60+)</div>
  </div>
  ${cita(`Cada convocatoria repite este mismo ciclo. <strong>22 módulos aprobados = tu certificado.</strong>`)}
`);

// ── Documento ──────────────────────────────────────────────────────────────
const HTML = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"/>
<style>
  @page { size: letter; margin: 0; }
  * { box-sizing: border-box; margin: 0; }
  body { font-family: 'Poppins', 'Segoe UI', system-ui, sans-serif; color: ${C.tinta};
         font-size: 10.5pt; line-height: 1.62; }

  /* Cada .pagina ES una página carta: el diseño decide dónde corta, no el flujo. */
  .pagina { width: 216mm; height: 279mm; padding: 20mm 19mm 16mm; background: ${C.cremaClaro};
            page-break-after: always; position: relative; overflow: hidden;
            display: flex; flex-direction: column; }
  .pagina::after { content: ''; position: absolute; left: 19mm; right: 19mm; bottom: 11mm;
                   border-top: 0.35mm solid ${C.linea}; }
  .pagina.oscura::after { display: none; }

  .kicker { font-size: 8pt; font-weight: 700; letter-spacing: 0.28em; color: ${C.dorado};
            text-transform: uppercase; margin-bottom: 6mm; }

  h1, h2, h3, h4, .cita { font-family: Georgia, 'Times New Roman', serif; }

  /* Portada */
  .oscura { background: linear-gradient(165deg, ${C.guindaNoche}, ${C.guindaOscuro} 55%, ${C.guinda}); color: #fff; }
  .portada-centro { margin: auto 0; }
  .portada-logo { font-family: Georgia, serif; font-size: 30pt; color: #fff; margin-bottom: 12mm; }
  .portada-logo span { color: ${C.dorado}; }
  .oscura h1 { font-size: 46pt; line-height: 1.05; font-weight: 700; }
  .portada-frase { margin-top: 14mm; font-family: Georgia, serif; font-size: 15pt; line-height: 1.7;
                   max-width: 130mm; }
  .portada-frase span { color: ${C.doradoSuave}; }
  .pie-portada { font-size: 8pt; letter-spacing: 0.24em; color: rgba(255,255,255,0.55); }

  /* Índice */
  .indice { margin-top: 8mm; }
  .ind-fila { display: flex; align-items: baseline; gap: 6mm; padding: 4.6mm 0;
              border-bottom: 0.3mm solid ${C.linea}; }
  .ind-n { font-family: Georgia, serif; font-size: 14pt; color: ${C.dorado}; min-width: 10mm; }
  .ind-t { font-weight: 700; font-size: 12.5pt; }
  .ind-d { margin-left: auto; color: ${C.gris}; font-size: 9.5pt; }

  /* Títulos de capítulo */
  .cap-titulo { font-size: 26pt; line-height: 1.12; color: ${C.guindaNoche}; margin-bottom: 4mm; }
  .lede { font-family: Georgia, serif; font-size: 12.5pt; color: ${C.gris}; margin-bottom: 8mm; }

  /* Camino */
  .camino { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; margin: 6mm 0 8mm; }
  .cam { background: #fff; border: 0.35mm solid ${C.linea}; border-radius: 3.5mm; padding: 6mm; }
  .cam-n { width: 9mm; height: 9mm; border-radius: 50%; background: ${C.guinda}; color: #fff;
           font-weight: 700; display: flex; align-items: center; justify-content: center; margin-bottom: 3mm; }
  .cam h4 { font-size: 13pt; margin-bottom: 1.5mm; color: ${C.guindaNoche}; }
  .cam p { font-size: 9.5pt; color: ${C.gris}; }

  /* Pasos */
  .paso { display: flex; gap: 5mm; margin-bottom: 6.5mm; }
  .paso-n { font-family: Georgia, serif; font-size: 15pt; color: ${C.dorado}; font-weight: 700;
            min-width: 12mm; }
  .paso-c h3 { font-size: 13pt; color: ${C.guindaNoche}; margin-bottom: 1.5mm; }
  .paso-c p { color: #453d38; }

  /* Dos columnas */
  .doscol { display: flex; gap: 9mm; align-items: flex-start; flex: 1; }
  .doscol-izq { flex: 1.15; }
  .doscol-der { flex: 0.85; display: flex; justify-content: center; }

  /* Figuras */
  .fig { margin: 0; }
  .fig-marco { background: #fff; border: 0.4mm solid ${C.linea}; border-radius: 4mm; padding: 2.5mm;
               box-shadow: 0 1.2mm 3mm rgba(46, 8, 20, 0.07); }
  .fig-marco img { display: block; width: 100%; border-radius: 2.5mm; }
  .fig-tel { width: 62mm; }
  /* Bloques recortados: centrados a su proporción natural y con tope de alto.
     Estirados al ancho de la página se veían inflados, y sin tope la figura se
     desbordaba y el folio del pie la pisaba. */
  .fig-ancha { width: 100%; margin: 2mm 0 6mm; }
  .fig-ancha .fig-marco { display: flex; justify-content: center; }
  .fig-ancha .fig-marco img { width: auto; max-width: 92%; max-height: 74mm; }
  .fig-ancha figcaption { justify-content: center; }
  figcaption { margin-top: 2.5mm; font-size: 8.5pt; color: ${C.gris}; display: flex; gap: 2.5mm;
               align-items: center; }
  .fig-punto { width: 2mm; height: 2mm; border-radius: 50%; background: ${C.dorado}; flex-shrink: 0; }

  /* Citas y ojo */
  .cita { border-left: 1.2mm solid ${C.dorado}; padding: 3mm 0 3mm 6mm; margin: 7mm 0;
          font-size: 12.5pt; line-height: 1.65; color: ${C.guindaNoche}; }
  .cita.ojo { border-left-color: ${C.guinda}; }
  .ojo-k { font-family: 'Poppins', sans-serif; font-size: 8pt; font-weight: 700;
           letter-spacing: 0.24em; color: ${C.guinda}; margin-bottom: 1.5mm; }

  /* Glosario del menú */
  .glosario { display: grid; grid-template-columns: 1fr 1fr; gap: 2.5mm 6mm; margin: 5mm 0; }
  .glosario > div { border-bottom: 0.3mm solid ${C.linea}; padding: 2mm 0; font-size: 9.5pt; }
  .glosario strong { display: block; color: ${C.guindaNoche}; }
  .glosario span { color: ${C.gris}; font-size: 8.5pt; }

  /* Colores del calendario */
  .colores { display: flex; flex-direction: column; gap: 4mm; margin: 5mm 0; }
  .color-item { display: flex; gap: 4mm; align-items: center; }
  .muestra { width: 11mm; height: 11mm; border-radius: 2.5mm; flex-shrink: 0; }

  /* Tarjetas */
  .tarjetas { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; margin-top: 4mm; }
  .tarjeta { background: #fff; border: 0.35mm solid ${C.linea}; border-radius: 3.5mm; padding: 6mm; }
  .tarjeta h4 { font-size: 12.5pt; color: ${C.guindaNoche}; margin-bottom: 2mm; }
  .tarjeta p { font-size: 10pt; color: ${C.gris}; }

  /* Cotejo */
  .cotejo { margin-top: 4mm; }
  .cot { display: flex; align-items: center; gap: 5mm; padding: 4.6mm 0; font-size: 12pt;
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
${CAP4A}
${CAP4B}
${CAP4C}
${CAP5A}
${CAP5B}
${CAP6}
${CAP7}
${CAP8A}
${CAP8B}
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
  // El folio va como parte del diseño: versalitas espaciadas sobre la línea
  // que cada página ya trae dibujada al pie.
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
