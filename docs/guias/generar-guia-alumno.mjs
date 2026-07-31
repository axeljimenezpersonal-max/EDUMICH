/**
 * GENERADOR — Guía del estudiante en PDF.
 *
 * Compone la guía (HTML con la marca de Modula) usando las capturas de
 * `capturar-alumno.mjs` y la imprime a PDF con el Chromium de la máquina.
 * NADA se maqueta a mano: cambia la interfaz → se recapturan las fotos → se
 * corre esto → guía nueva. La fecha de versión sale en portada y pie.
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

/** Imagen como data-URI (el PDF debe ser autocontenido, sin rutas locales). */
function img(nombre) {
  const ruta = path.join(CAPTURAS, `${nombre}.png`);
  if (!fs.existsSync(ruta)) {
    console.error(`✋ Falta la captura ${nombre}.png — corre primero capturar-alumno.mjs`);
    process.exit(1);
  }
  return `data:image/png;base64,${fs.readFileSync(ruta).toString('base64')}`;
}

const FECHA_VERSION = new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });

// ── Paleta del portal (index.css) ──────────────────────────────────────────
const C = {
  guinda: '#6b1530', guindaOscuro: '#4a0e20', guindaSuave: '#fbf1f4',
  crema: '#f7f2ed', linea: '#eadfd7', dorado: '#b89968',
  tinta: '#221c1a', gris: '#57504a', verde: '#15803d',
  ambarFondo: '#fffbeb', ambarBorde: '#f59e0b', ambarTexto: '#92400e',
  moradoExamen: '#6d28d9', rosaInscripcion: '#f7e6ec',
};

// ── Piezas de maquetación ──────────────────────────────────────────────────
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** Paso numerado: texto a la izquierda, foto a la derecha (o abajo si es ancha). */
function paso(n, titulo, texto, imagen, opts = {}) {
  const anchoImg = opts.ancha ? '100%' : '46%';
  const flexDir = opts.ancha ? 'column' : 'row';
  return `
  <div class="paso" style="flex-direction:${flexDir}">
    <div class="paso-texto">
      <div class="paso-num">${n}</div>
      <div>
        <div class="paso-titulo">${esc(titulo)}</div>
        <div class="paso-cuerpo">${texto}</div>
      </div>
    </div>
    ${imagen ? `<img class="paso-img" style="width:${anchoImg}" src="${imagen}" alt="" />` : ''}
  </div>`;
}

function ojo(texto) {
  return `<div class="ojo"><span class="ojo-icono">⚠️</span><div><strong>Ojo:</strong> ${texto}</div></div>`;
}

function recuadro(titulo, texto) {
  return `<div class="recuadro"><div class="recuadro-titulo">${esc(titulo)}</div><div>${texto}</div></div>`;
}

function capitulo(num, titulo, sub, contenido) {
  return `
  <section class="capitulo">
    <div class="cap-encabezado">
      <div class="cap-num">${num}</div>
      <div>
        <h2>${esc(titulo)}</h2>
        ${sub ? `<p class="cap-sub">${esc(sub)}</p>` : ''}
      </div>
    </div>
    ${contenido}
  </section>`;
}

// ── Contenido (sigue el guion aprobado: guion-guia-alumno.md) ──────────────

const PORTADA = `
<section class="portada">
  <div class="portada-franja"></div>
  <div class="portada-cuerpo">
    <div class="portada-marca">MODULA · PLAN 22</div>
    <h1>Guía del<br/>estudiante</h1>
    <p class="portada-sub">Tu camino en la Preparatoria Abierta,<br/>paso a paso y con imágenes.</p>
    <div class="portada-pie">
      <div>Preparatoria Abierta · IEMSyS<br/>Gobierno de Michoacán</div>
      <div class="portada-version">Versión: ${FECHA_VERSION}</div>
    </div>
  </div>
</section>`;

const CAMINO = `
<section class="capitulo">
  <div class="cap-encabezado"><div class="cap-num">★</div><div><h2>Cómo usar esta guía</h2></div></div>
  <p>Tu proceso completo son <strong>4 pasos</strong>, siempre en este orden. Cada uno tiene su capítulo:</p>
  <div class="camino">
    <div class="camino-paso"><div class="camino-n">1</div><div><strong>Expediente</strong><br/>Sube tus documentos</div></div>
    <div class="camino-flecha">→</div>
    <div class="camino-paso"><div class="camino-n">2</div><div><strong>Inscripción</strong><br/>Elige tus exámenes</div></div>
    <div class="camino-flecha">→</div>
    <div class="camino-paso"><div class="camino-n">3</div><div><strong>Pago</strong><br/>$131 por examen</div></div>
    <div class="camino-flecha">→</div>
    <div class="camino-paso"><div class="camino-n">4</div><div><strong>Resultados</strong><br/>Aprueba con 60+</div></div>
  </div>
  <p>El Plan 22 se completa aprobando <strong>22 módulos</strong>. Cada convocatoria puedes presentar hasta 4,
  así que el camino se recorre etapa por etapa — hay 8 al año.</p>
  ${recuadro('🤝 ¿Tienes centro de asesoría?', `Si un gestor te acompaña, <strong>él te inscribe y paga por ti</strong>:
  tú solo subes tus documentos y te presentas al examen. En tu portal verás sus datos de contacto.
  Si llevas tu proceso por tu cuenta, esta guía te enseña a hacer todo tú.`)}
</section>`;

const CAP1 = capitulo(1, 'Tu primer ingreso', 'De tu correo a tu portal', `
  ${paso('1.1', 'Recibe tu correo de bienvenida',
    `Cuando tu cuenta se crea, te llega un correo de <strong>Preparatoria Abierta Michoacán</strong> con tu
     usuario (tu correo) y una <strong>contraseña temporal</strong>. Si no lo ves, revisa la carpeta de
     <em>correo no deseado</em>.`, null)}
  ${paso('1.2', 'Entra al portal',
    `Abre <strong>prepa.modula22.mx</strong> en tu teléfono o computadora y toca <strong>Iniciar sesión</strong>.
     Escribe tu correo y tu contraseña. El botón del ojo 👁 te deja ver lo que escribes.`, img('01-login'))}
  ${paso('1.3', 'Cambia tu contraseña',
    `La primera vez, el portal te pide elegir tu contraseña definitiva. Escríbela dos veces y guárdala
     donde no la pierdas.`, null)}
  ${paso('1.4', '¿La olvidaste? Recupérala',
    `En la pantalla de inicio de sesión toca <strong>Olvidé mi contraseña</strong>: te llega un enlace a tu
     correo para elegir una nueva.`, img('02-recuperar-password'))}
  ${ojo(`la contraseña temporal solo sirve una vez, y el enlace de recuperación <strong>caduca en 1 hora</strong>.
   Úsalo en cuanto llegue.`)}
`);

const CAP2 = capitulo(2, 'Conoce tu portal', 'Todo está en el menú', `
  ${paso('2.1', 'Tu Inicio',
    `Cada vez que entres verás tu <strong>Inicio</strong>: en qué punto vas y qué te toca hacer.
     Si te pierdes, vuelve aquí. En el teléfono, el menú va abajo; el botón <strong>Más</strong> abre el resto
     de las secciones.`, img('03-inicio-nuevo'))}
  ${paso('2.2', 'Las secciones, en una línea',
    `<strong>Expediente</strong>: tus documentos. · <strong>Inscripción</strong>: tus exámenes.
     · <strong>Pagos</strong>: tus fichas y comprobantes. · <strong>Calificaciones</strong>: tus resultados.
     · <strong>Pruebas</strong>: exámenes de práctica. · <strong>ID</strong>: tu credencial y tu pase.
     · <strong>Calendario</strong>: las fechas del ciclo. · <strong>Preguntas frecuentes</strong>: dudas resueltas.`, null)}
  ${recuadro('¿Prefieres que te lo enseñe el portal?', `El botón de ayuda <strong>(?)</strong> arriba a la derecha
   reinicia el tutorial en pantalla cuando quieras, sección por sección.`)}
`);

const CAP3 = capitulo(3, 'Paso 1 · Tu expediente', 'Sin esto no hay inscripción', `
  ${paso('3.1', 'Reúne tus 5 documentos',
    `<strong>CURP</strong>, <strong>acta de nacimiento</strong>, <strong>identificación oficial</strong>,
     <strong>comprobante de domicilio</strong> (no mayor a 3 meses) y <strong>certificado de secundaria</strong>.
     En PDF o foto legible. Además, una <strong>fotografía</strong> tipo selfie para tu credencial.`, null)}
  ${paso('3.2', 'Súbelos en Expediente',
    `Entra a <strong>Expediente</strong> y toca el botón de subir en cada documento. La lista te dice cuáles
     faltan.`, img('04b-exp-subir'), { ancha: true })}
  ${paso('3.3', 'Espera la revisión',
    `La administración revisa cada documento. Verás su estado: <span class="chip chip-rev">En revisión</span>
     <span class="chip chip-ok">Aprobado</span> <span class="chip chip-mal">Rechazado</span>.
     Si algo se rechaza, ahí mismo dice el motivo — corrige y vuelve a subirlo.`, null)}
  ${paso('3.4', 'Tu barra debe llegar a 5/5',
    `Con los cinco aprobados, tu expediente está completo.`, img('05-exp-progreso'), { ancha: true })}
  ${paso('3.5', 'Te asignan tu matrícula',
    `Con el expediente completo, la administración te asigna tu <strong>matrícula oficial</strong>. Aparece
     arriba en tu Expediente — es tu número para todo el proceso.`, img('05b-exp-matricula'), { ancha: true })}
  ${ojo(`sin expediente completo <strong>no puedes inscribirte a ningún examen</strong>. Es lo primero que hay
   que terminar, y la revisión puede tomar días: no lo dejes para la semana de la inscripción.`)}
`);

const CAP4 = capitulo(4, 'Paso 2 · Inscríbete', 'Solo en la ventana de inscripción', `
  ${paso('4.1', 'Espera a que abra la ventana',
    `Cada etapa tiene una <strong>ventana de inscripción</strong> de 4 a 5 días. Cuando está abierta,
     tu sección <strong>Inscripción</strong> la muestra con las fechas y los días que faltan.`,
    img('06-insc-ventana'), { ancha: true })}
  ${paso('4.2', 'Elige tus módulos (hasta 4)',
    `Marca los módulos que vas a presentar y confirma. Cada uno tiene su día y hora de examen
     (sábado o domingo).`, img('06b-insc-modulos'), { ancha: true })}
  ${paso('4.3', 'Elige tu sede (si hay varias)',
    `Si la convocatoria abrió más de una sede, escoge dónde presentas: la misma para todos tus módulos.
     Te sugerimos la de tu municipio.`, null)}
  ${paso('4.4', 'Revisa tus exámenes inscritos',
    `Quedas como <strong>pre-inscrito</strong> y se genera tu ficha de pago. Tu lugar se confirma
     hasta que el pago se valida.`, img('06c-insc-examenes'), { ancha: true })}
  ${paso('4.5', 'Así se termina',
    `El propio portal te deja los pasos que siguen: descargar tu ficha, pagar, esperar la confirmación
     y descargar tu pase.`, img('06e-insc-pasos'), { ancha: true })}
  ${ojo(`<strong>la ventana es estricta.</strong> Fuera de esas fechas no se puede inscribir ni pagar — no hay
   excepciones, así funciona la convocatoria estatal. Revisa el Calendario (capítulo 8) y no lo dejes
   para el último día.`)}
  ${recuadro('🤝 ¿Tienes centro de asesoría?', `Entonces esta parte no te toca a ti: <strong>tu gestor te
   inscribe</strong>. En tu Inscripción verás sus datos para ponerte de acuerdo. Tú sigue en el capítulo 6.`)}
`);

const CAP5 = capitulo(5, 'Paso 3 · Paga tu examen', '$131 por examen, ante la Tesorería del Estado', `
  ${paso('5.1', 'Tu resumen',
    `En <strong>Pagos</strong> ves cuántos exámenes tienes inscritos, cuántos ya están cubiertos y el costo
     por examen (<strong>$131</strong>).`, img('07-pagos-resumen'), { ancha: true })}
  ${paso('5.2', 'Solicita tu orden de pago',
    `Cada examen sin pagar tiene su botón <strong>Solicitar orden</strong>. La orden la emite la
     <strong>Tesorería del Estado</strong> con tu línea de captura.`, img('07b-pagos-estado'), { ancha: true })}
  ${paso('5.3', 'Paga con tu línea de captura',
    `Cuando la orden está emitida aparece tu <strong>línea de captura</strong>: cópiala y paga en el banco,
     en tienda o en línea.`, img('07c-pagos-ordenes'), { ancha: true })}
  ${paso('5.4', 'Sube tu comprobante',
    `En el mismo bloque de la orden, sube la foto o PDF de tu comprobante. La coordinación lo revisa y,
     al confirmarse, tu examen queda <strong>pagado</strong> y tu lugar confirmado.`, null)}
  ${ojo(`tu ficha <strong>vence a los 7 días</strong> de emitida. Y solo lo pagado se califica: un examen
   presentado sin pago confirmado no tiene resultado.`)}
`);

const CAP6 = capitulo(6, 'El día del examen', 'Pase, identificación y a tiempo', `
  ${paso('6.1', 'Descarga tu pase',
    `Con el pago confirmado, en <strong>ID</strong> (o desde tu Inscripción) descargas tu
     <strong>pase de examen</strong>: trae tu módulo, tu sede, tu horario y un <strong>código QR</strong>
     que escanean al entrar.`, img('08-pase-examen'))}
  ${paso('6.2', 'Tu credencial digital',
    `En <strong>ID</strong> también vive tu credencial de estudiante, con tu foto. Sirve para identificarte
     dentro del programa.`, img('09-identificacion'))}
  ${paso('6.3', 'Qué llevar',
    `Tu <strong>pase</strong> (en el teléfono o impreso) y una <strong>identificación</strong>. Llega con
     tiempo: la dirección de tu sede y el mapa están en tu Inscripción.`, null)}
`);

const CAP7 = capitulo(7, 'Paso 4 · Tus resultados', 'Se aprueba con 60', `
  ${paso('7.1', 'Consulta tus calificaciones',
    `Después de cada etapa, tus resultados aparecen en <strong>Calificaciones</strong>: cada módulo con su
     calificación. Se aprueba con <strong>60 o más</strong>.`, img('10-calificaciones'), { ancha: true })}
  ${paso('7.2', 'Mira tu avance',
    `La misma pantalla lleva tu cuenta: cuántos de los <strong>22 módulos</strong> ya aprobaste y tu promedio.
     Puedes descargar tu historial en PDF.`, null)}
  ${paso('7.3', '¿No aprobaste uno?',
    `No pasa nada definitivo: lo vuelves a presentar en una etapa siguiente. Inscríbelo otra vez cuando
     abra la ventana.`, null)}
`);

const CAP8 = capitulo(8, 'Herramientas que te ayudan', '', `
  ${paso('8.1', 'Pruebas · practica antes',
    `Evaluaciones de práctica por módulo. <strong>No cuentan para tu calificación</strong> — son para llegar
     preparado.`, img('11-pruebas'))}
  ${paso('8.2', 'Calendario · las fechas del ciclo',
    `Todas las etapas del año. Los colores: <span class="chip" style="background:${C.moradoExamen};color:#fff">morado</span>
     = día de examen, <span class="chip" style="background:${C.rosaInscripcion};color:${C.guinda}">rosa</span> =
     ventana de inscripción — los únicos días en que puedes inscribirte y pagar.`, img('12-calendario'))}
  ${paso('8.3', 'Preguntas frecuentes',
    `Las dudas más comunes del trámite, ya resueltas. Busca ahí antes de llamar: casi siempre la respuesta
     ya está.`, img('13-faq'))}
  ${paso('8.4', 'Mi aula',
    `Si tu centro de asesoría la activó, ahí están tus clases en línea (foro, tareas, materiales).
     Si aparece con candado, tu centro aún no la usa.`, null)}
`);

const CAP9 = capitulo(9, '¿Necesitas ayuda?', '', `
  <p>Si algo no avanza o tienes un problema con tu cuenta:</p>
  <ul class="lista-ayuda">
    <li><strong>¿Tienes gestor?</strong> Él es tu primer contacto — sus datos están en tu Inscripción.</li>
    <li><strong>Preguntas frecuentes</strong> del portal: la mayoría de las dudas se resuelven ahí.</li>
    <li><strong>Teléfono de atención:</strong> el número y horario vigentes aparecen al pie de las
        Preguntas frecuentes del portal. Ten a la mano tu nombre completo y tu CURP.</li>
  </ul>
`);

const ANEXO = `
<section class="capitulo anexo">
  <div class="cap-encabezado"><div class="cap-num">✓</div><div><h2>Tu lista de cotejo — una etapa completa</h2>
  <p class="cap-sub">Imprime esta página o tómale captura. Palomea conforme avanzas.</p></div></div>
  <div class="cotejo">
    <div class="cotejo-item"><span class="cuadro"></span> Mi expediente está completo (5/5 aprobados) y tengo matrícula</div>
    <div class="cotejo-item"><span class="cuadro"></span> Vi en el Calendario cuándo abre la ventana de inscripción</div>
    <div class="cotejo-item"><span class="cuadro"></span> Me inscribí DENTRO de la ventana (hasta 4 módulos)</div>
    <div class="cotejo-item"><span class="cuadro"></span> Solicité mi orden de pago</div>
    <div class="cotejo-item"><span class="cuadro"></span> Pagué antes del vencimiento (la ficha vence a los 7 días)</div>
    <div class="cotejo-item"><span class="cuadro"></span> Subí mi comprobante y esperé la confirmación</div>
    <div class="cotejo-item"><span class="cuadro"></span> Descargué mi pase de examen (código QR)</div>
    <div class="cotejo-item"><span class="cuadro"></span> Me presenté con pase + identificación, a tiempo</div>
    <div class="cotejo-item"><span class="cuadro"></span> Revisé mi calificación (se aprueba con 60+)</div>
  </div>
  <p class="anexo-pie">Cada convocatoria repite este mismo ciclo. 22 módulos aprobados = certificado. 💪</p>
</section>`;

const INDICE = `
<section class="capitulo indice">
  <h2 class="indice-titulo">Contenido</h2>
  <ol>
    <li>Tu primer ingreso</li>
    <li>Conoce tu portal</li>
    <li>Paso 1 · Tu expediente</li>
    <li>Paso 2 · Inscríbete</li>
    <li>Paso 3 · Paga tu examen</li>
    <li>El día del examen</li>
    <li>Paso 4 · Tus resultados</li>
    <li>Herramientas que te ayudan</li>
    <li>¿Necesitas ayuda?</li>
  </ol>
  <div class="indice-anexo">Anexo · Tu lista de cotejo</div>
</section>`;

// ── Documento ──────────────────────────────────────────────────────────────
const HTML = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"/>
<style>
  @page { size: letter; margin: 16mm 15mm 18mm 15mm; }
  * { box-sizing: border-box; margin: 0; }
  body { font-family: 'Poppins', 'Segoe UI', system-ui, sans-serif; color: ${C.tinta};
         font-size: 11.5pt; line-height: 1.55; }
  p { margin: 6px 0; }

  /* Portada */
  .portada { height: 240mm; background: linear-gradient(160deg, ${C.guindaOscuro}, ${C.guinda});
             color: #fff; border-radius: 6mm; display: flex; page-break-after: always; overflow: hidden; }
  .portada-franja { width: 10mm; background: ${C.dorado}; }
  .portada-cuerpo { padding: 22mm 16mm; display: flex; flex-direction: column; }
  .portada-marca { letter-spacing: 0.3em; font-weight: 700; font-size: 10pt; color: ${C.dorado}; }
  .portada h1 { font-family: Georgia, serif; font-size: 42pt; line-height: 1.08; margin-top: 10mm; }
  .portada-sub { margin-top: 8mm; font-size: 13pt; opacity: 0.9; }
  .portada-pie { margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end;
                 font-size: 10pt; opacity: 0.95; }
  .portada-version { background: rgba(255,255,255,0.14); padding: 3mm 5mm; border-radius: 3mm;
                     font-weight: 700; text-transform: capitalize; }

  /* Índice */
  .indice { page-break-after: always; }
  .indice-titulo { font-family: Georgia, serif; font-size: 22pt; color: ${C.guinda}; margin-bottom: 8mm; }
  .indice ol { font-size: 13pt; line-height: 2.3; padding-left: 8mm; }
  .indice-anexo { margin-top: 6mm; font-weight: 700; color: ${C.gris}; }

  /* Capítulos */
  .capitulo { page-break-before: always; }
  .capitulo:first-of-type { page-break-before: avoid; }
  .cap-encabezado { display: flex; gap: 6mm; align-items: center; border-bottom: 1mm solid ${C.guinda};
                    padding-bottom: 4mm; margin-bottom: 6mm; }
  .cap-num { width: 14mm; height: 14mm; border-radius: 4mm; background: ${C.guinda}; color: #fff;
             font-size: 16pt; font-weight: 700; display: flex; align-items: center; justify-content: center;
             flex-shrink: 0; }
  .cap-encabezado h2 { font-family: Georgia, serif; font-size: 19pt; color: ${C.guindaOscuro}; }
  .cap-sub { color: ${C.gris}; font-size: 11pt; }

  /* Pasos */
  .paso { display: flex; gap: 6mm; align-items: flex-start; margin: 6mm 0; page-break-inside: avoid; }
  .paso-texto { display: flex; gap: 4mm; flex: 1; }
  .paso-num { min-width: 11mm; height: 11mm; padding: 0 2mm; border-radius: 3mm; background: ${C.crema};
              border: 0.6mm solid ${C.guinda}; color: ${C.guinda}; font-weight: 700; font-size: 11pt;
              display: flex; align-items: center; justify-content: center; }
  .paso-titulo { font-weight: 700; font-size: 12.5pt; margin-bottom: 1.5mm; }
  .paso-cuerpo { color: ${C.gris}; }
  .paso-img { border: 0.5mm solid ${C.linea}; border-radius: 3mm; align-self: center; }

  /* Recuadros */
  .ojo { display: flex; gap: 4mm; background: ${C.ambarFondo}; border: 0.5mm solid ${C.ambarBorde};
         border-left: 2mm solid ${C.ambarBorde}; color: ${C.ambarTexto}; border-radius: 3mm;
         padding: 4mm 5mm; margin: 6mm 0; page-break-inside: avoid; }
  .ojo-icono { font-size: 14pt; }
  .recuadro { background: ${C.guindaSuave}; border: 0.5mm solid ${C.linea}; border-left: 2mm solid ${C.guinda};
              border-radius: 3mm; padding: 4mm 5mm; margin: 6mm 0; page-break-inside: avoid; }
  .recuadro-titulo { font-weight: 700; color: ${C.guinda}; margin-bottom: 1.5mm; }

  /* Camino de 4 pasos */
  .camino { display: flex; align-items: center; gap: 3mm; margin: 7mm 0; }
  .camino-paso { flex: 1; background: ${C.crema}; border: 0.5mm solid ${C.linea}; border-radius: 3mm;
                 padding: 4mm; font-size: 9.5pt; text-align: center; }
  .camino-n { width: 8mm; height: 8mm; margin: 0 auto 2mm; border-radius: 50%; background: ${C.guinda};
              color: #fff; font-weight: 700; display: flex; align-items: center; justify-content: center; }
  .camino-flecha { color: ${C.dorado}; font-size: 16pt; font-weight: 700; }

  /* Chips de estado */
  .chip { display: inline-block; border-radius: 2mm; padding: 0.5mm 2.5mm; font-size: 9.5pt; font-weight: 700; }
  .chip-ok { background: #f0fdf4; color: ${C.verde}; }
  .chip-rev { background: #fefce8; color: #a16207; }
  .chip-mal { background: #fef2f2; color: #b91c1c; }

  .lista-ayuda { padding-left: 6mm; line-height: 2; }

  /* Anexo */
  .cotejo { margin: 6mm 0; }
  .cotejo-item { display: flex; align-items: center; gap: 4mm; padding: 3.5mm 0;
                 border-bottom: 0.3mm dashed ${C.linea}; font-size: 12.5pt; }
  .cuadro { width: 6mm; height: 6mm; border: 0.6mm solid ${C.guinda}; border-radius: 1.5mm; flex-shrink: 0; }
  .anexo-pie { margin-top: 8mm; text-align: center; color: ${C.gris}; }
</style></head>
<body>
${PORTADA}
${INDICE}
${CAMINO}
${CAP1}
${CAP2}
${CAP3}
${CAP4}
${CAP5}
${CAP6}
${CAP7}
${CAP8}
${CAP9}
${ANEXO}
</body></html>`;

// ── Imprimir ───────────────────────────────────────────────────────────────
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
    <div style="width:100%;font-size:8pt;color:#8a8178;display:flex;justify-content:space-between;padding:0 15mm;">
      <span>Modula · Plan 22 — Guía del estudiante (${FECHA_VERSION})</span>
      <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
    </div>`,
  margin: { top: '16mm', bottom: '18mm', left: '15mm', right: '15mm' },
});
await navegador.close();

const kb = Math.round(fs.statSync(SALIDA).size / 1024);
console.log(`✅ ${SALIDA} (${kb} KB)`);
