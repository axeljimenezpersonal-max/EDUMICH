/**
 * GENERADOR — Guía de administración en PDF.
 *
 * La tercera de la familia (alumno v1 aprobada, gestor v2) y la más
 * completa: el panel de la Secretaría. USO INTERNO — no se publica.
 *
 * Diferencias editoriales de esta guía (ver guion-guia-admin.md):
 * - Se ordena por PRIORIDADES (lo de hoy → lo de cada etapa → lo ocasional),
 *   no por un "camino" como las otras dos.
 * - SIN datos de ejemplo: las láminas usan rótulos genéricos, nunca
 *   personas, montos ni fechas inventadas. Los pies dicen "Así se ve…".
 * - Nada apagado se documenta (Reportes en preparación: una línea).
 *
 * Los ayudantes se duplican A PROPÓSITO de generar-guia-gestor.mjs: los
 * artefactos aprobados no se refactorizan.
 *
 * Uso:  node docs/guias/generar-guia-admin.mjs
 * Salida: docs/guias/Guia-Administracion-Modula22.pdf
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
const SALIDA = path.join(AQUI, 'Guia-Administracion-Modula22.pdf');

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
  subir: (c) => icono('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>', { color: c }),
  paloma: (c) => icono('<path d="M20 6L9 17l-5-5"/>', { color: c }),
  busqueda: () => icono('<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/>'),
  correo: () => icono('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/>'),
  usuarios: () => icono('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  reloj: () => icono('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'),
  candado: (c) => icono('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>', { color: c }),
  pluma: (c) => icono('<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/>', { color: c }),
  qr: (c) => icono('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3z"/><path d="M20 14h1v1h-1z"/><path d="M14 20h1v1h-1z"/><path d="M19 19h2v2h-2z"/>', { color: c }),
  campana: () => icono('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>'),
  alerta: (c) => icono('<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>', { color: c }),
  edificio: () => icono('<rect x="4" y="2" width="16" height="20" rx="1"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01M12 6h.01M12 10h.01M12 14h.01"/>'),
};

// ── Portada, índice y prioridades ──────────────────────────────────────────

const PORTADA = pagina(`
  <div class="kicker">MODULA · PLAN 22 · ${FECHA_VERSION.toUpperCase()}</div>
  <div class="portada-centro">
    <div class="portada-logo">M<span>22</span></div>
    <h1>Guía de<br/>administración</h1>
    <div class="kicker" style="margin-top:6mm">USO INTERNO · SECRETARÍA · VERSIÓN ${FECHA_VERSION.toUpperCase()}</div>
    <p class="portada-frase">El programa entero pasa por este panel.<br/>
    Esta guía lo ordena por <span>prioridades</span>: primero lo de hoy,<br/>
    después lo de cada etapa, al final lo ocasional.</p>
  </div>
  <div class="pie-portada">PREPA.MODULA22.MX · IEMSYS · GOBIERNO DE MICHOACÁN</div>
`, 'oscura');

const INDICE = pagina(`
  ${kicker('CONTENIDO')}
  <h2 class="cap-titulo">Lo que vas<br/>a encontrar</h2>
  <p class="lede" style="margin-top:-2mm">En orden de prioridad: primero lo que no puede esperar.</p>
  <div class="indice indice-compacto">
    <div class="ind-fila"><span class="ind-n">01</span><span class="ind-t">El expediente</span><span class="ind-d">la prioridad de cada día</span></div>
    <div class="ind-fila"><span class="ind-n">02</span><span class="ind-t">Matrícula y credencial</span><span class="ind-d">capturar y emitir</span></div>
    <div class="ind-fila"><span class="ind-n">03</span><span class="ind-t">Fichas de pago</span><span class="ind-d">emitir, conciliar, controlar</span></div>
    <div class="ind-fila"><span class="ind-n">04</span><span class="ind-t">Cédula y módulos</span><span class="ind-d">la inscripción formal</span></div>
    <div class="ind-fila"><span class="ind-n">05</span><span class="ind-t">Alumnos · la ficha</span><span class="ind-d">acciones, correcciones y bajas</span></div>
    <div class="ind-fila"><span class="ind-n">06</span><span class="ind-t">Solicitudes de cuenta</span><span class="ind-d">la puerta de entrada</span></div>
    <div class="ind-fila"><span class="ind-n">07</span><span class="ind-t">Calificaciones</span><span class="ind-d">de la relación oficial al portal</span></div>
    <div class="ind-fila"><span class="ind-n">08</span><span class="ind-t">Convocatorias y sedes</span><span class="ind-d">la sección más delicada</span></div>
    <div class="ind-fila"><span class="ind-n">09</span><span class="ind-t">La red de gestores</span><span class="ind-d">altas, permisos y desempeño</span></div>
    <div class="ind-fila"><span class="ind-n">10</span><span class="ind-t">Comunicación</span><span class="ind-d">anuncios y preguntas frecuentes</span></div>
    <div class="ind-fila"><span class="ind-n">11</span><span class="ind-t">Padrón histórico y verificación</span><span class="ind-d">la memoria y el candado</span></div>
    <div class="ind-fila"><span class="ind-n">12</span><span class="ind-t">Titular y operativo</span><span class="ind-d">quién puede qué</span></div>
    <div class="ind-fila"><span class="ind-n">✓</span><span class="ind-t">El pulso de la administración</span><span class="ind-d">cada día y cada etapa</span></div>
  </div>
`);

const LAMINA_DIA = `
  <div class="panel">
    <div class="panel-cab">
      <div><div class="panel-hola">Inicio</div>
        <div class="panel-sub">Tu centro de control</div></div>
      ${chip('Convocatoria activa', C.verdeFondo, C.verde)}
    </div>
    <div class="panel-etq">TU DÍA DE HOY</div>
    <div class="dia">
      <div class="dc"><div class="dc-ico">${I.doc()}</div><strong>Documentos<br/>por revisar</strong></div>
      <div class="dc"><div class="dc-ico">${I.subir()}</div><strong>Pagos<br/>por emitir</strong></div>
      <div class="dc"><div class="dc-ico">${I.paloma()}</div><strong>Pagos<br/>por revisar</strong></div>
      <div class="dc"><div class="dc-ico">${I.correo()}</div><strong>Solicitudes<br/>de cuenta</strong></div>
    </div>
    <div class="dia-nota">${I.campana()} La campana concentra las notificaciones; cada tarjeta trae su contador y abre la lista ya filtrada.</div>
  </div>`;

const PRIORIDADES = pagina(`
  ${kicker('ANTES DE EMPEZAR')}
  <h2 class="cap-titulo">Tus prioridades</h2>
  <p class="lede">El alumno sigue un camino y el gestor lleva un grupo. La administración no: opera un
  tablero. Esta guía va de lo más prioritario a lo menos.</p>
  <div class="camino camino3">
    <div class="cam"><div class="cam-n">1</div><h4>Documentos y pagos</h4><p>La cadena diaria: expediente aprobado, matrícula capturada, ficha emitida y pago conciliado. Capítulos 1 al 4.</p></div>
    <div class="cam"><div class="cam-n">2</div><h4>Personas y decisiones</h4><p>La ficha del alumno, las solicitudes nuevas y las calificaciones. Capítulos 5 al 7.</p></div>
    <div class="cam"><div class="cam-n">3</div><h4>El marco</h4><p>Convocatorias, la red de gestores, comunicación y padrón. Capítulos 8 al 12.</p></div>
  </div>
  ${lamina(LAMINA_DIA, 'Así se ve tu Inicio: la convocatoria activa arriba y los pendientes del día como atajos')}
`);

// ── Cap. 1 · El ciclo de una etapa ─────────────────────────────────────────

const LAMINA_CICLO = `
  <div class="ciclo">
    <div class="ci"><span>1</span><strong>Convocatoria</strong><p>Precarga el año y define las sedes.</p></div>
    <div class="ci"><span>2</span><strong>Solicitudes</strong><p>Aprueba o rechaza cada cuenta nueva.</p></div>
    <div class="ci"><span>3</span><strong>Expedientes</strong><p>Revisa los 5 documentos de cada alumno.</p></div>
    <div class="ci"><span>4</span><strong>Matrículas</strong><p>Captura la matrícula oficial DGB.</p></div>
    <div class="ci"><span>5</span><strong>Inscripción y cédula</strong><p>Módulos inscritos y cédula firmada.</p></div>
    <div class="ci"><span>6</span><strong>Fichas de pago</strong><p>Carga la orden del Estado y su vencimiento.</p></div>
    <div class="ci"><span>7</span><strong>Conciliación</strong><p>Comprobante revisado: confirmado o rechazado.</p></div>
    <div class="ci"><span>8</span><strong>Calificaciones</strong><p>La relación oficial, leída y aplicada.</p></div>
  </div>
  <div class="ciclo-pie">${I.qr(C.dorado)} Credenciales y verificación acompañan todo el año, fuera del ciclo.</div>`;

const CAP1 = pagina(`
  ${kicker('ANTES DE EMPEZAR · EL MAPA')}\n  <h2 class="cap-titulo">El ciclo de una etapa</h2>\n  <p class="lede">Ocho estaciones, ocho veces al año. Es el orden del calendario — los capítulos van en otro: el de tus prioridades.</p>${''}
  ${lamina(LAMINA_CICLO, 'El ciclo completo: lo que la administración mueve en cada etapa, en orden')}
  ${cita(`Las estaciones 1 y 2 abren el flujo, la 6 y la 7 lo cobran y la 8 lo cierra. Si una se atora,
  las siguientes se detienen solas: <strong>el sistema no deja avanzar a quien no ha pasado por la
  estación anterior</strong> — expediente sin 5/5 no recibe matrícula, alumno sin matrícula no se
  inscribe, examen sin pagar no se califica.`)}
`);

// ── Cap. 2 · Convocatorias y sedes ─────────────────────────────────────────

const LAMINA_ETAPAS = `
  <div class="orden">
    <div class="adjuntar">${I.doc()} Convocatoria oficial de la DGB (PDF) — el sistema la lee solo</div>
    <div class="al-fila"><div class="al-quien"><strong>Etapa nueva</strong><span>Ventana de inscripción y fechas de examen</span></div>${chip('Se creará', C.verdeFondo, C.verde)}</div>
    <div class="al-fila"><div class="al-quien"><strong>Etapa ya registrada</strong><span>Sin cambios</span></div>${chip('Se omite', C.ambarFondo, C.ambarTexto)}</div>
  </div>`;

const CAP2 = pagina(`
  ${encabezadoCap(8, 'Convocatorias y sedes', 'El calendario oficial de la DGB gobierna todo el sistema.')}
  ${paso('8.1', 'Precarga el año completo', `Sube el PDF oficial de la convocatoria: el sistema lo lee y
    te muestra una <strong>previa</strong> de qué etapas se crearán y cuáles ya existían, antes de
    tocar nada. Nada se aplica sin que lo confirmes.`)}
  ${paso('8.2', 'La etapa activa gobierna', `Sus fechas abren y cierran la <strong>ventana de
    inscripción</strong> de todo el estado y aparecen en el Inicio de todos los roles. La ventana
    es estricta: fuera de fechas nadie inscribe.`)}
  ${paso('8.3', 'Las sedes son por etapa', `En la pestaña <strong>Sedes</strong> se dan de alta y se
    define cuáles se ofrecen en cada etapa. El alumno elige entre ésas — las sedes no se deducen
    de su municipio.`)}
  ${lamina(LAMINA_ETAPAS, 'Así se ve la precarga: el PDF oficial entra y el sistema propone, tú confirmas')}
  ${ojo(`Es la sección <strong>más delicada del panel</strong>: una fecha mal capturada abre o
  bloquea al estado entero. Revisa la previa antes de confirmar.`)}
`);

// ── Cap. 3 · Solicitudes de cuenta ─────────────────────────────────────────

const LAMINA_BANDEJA = `
  <div class="lista">
    <div class="tabs">
      <span class="tab tab-on">Pendientes</span><span class="tab">Aprobadas</span><span class="tab">Rechazadas</span>
    </div>
    <div class="al-fila"><div class="al-quien"><strong>Solicitud de cuenta</strong><span>Nombre, CURP y municipio de la persona</span></div>${chip('Reciente', C.verdeFondo, C.verde)}</div>
    <div class="al-fila"><div class="al-quien"><strong>Solicitud de cuenta</strong><span>Nombre, CURP y municipio de la persona</span></div>${chip('Más de 7 días', C.ambarFondo, C.ambarTexto)}</div>
    <div class="btnrow">
      <div class="btn btn-solido">${I.paloma('#fff')} Aprobar — eligiendo su gestor</div>
      <div class="btn btn-borde">Rechazar — siempre con motivo</div>
    </div>
  </div>`;

const CAP3 = pagina(`
  ${encabezadoCap(6, 'Solicitudes de cuenta', 'Nadie entra al sistema sin pasar por esta bandeja.')}
  ${paso('6.1', 'Prioriza por antigüedad', `La bandeja marca las solicitudes con <strong>más de 7 días
    esperando</strong>. Ordena por "más antigua primero" y que ninguna envejezca: detrás de cada una
    hay una persona esperando estudiar.`)}
  ${paso('6.2', 'Aprobar crea la cuenta', `Revisas los datos (la CURP ya llegó validada contra los
    alumnos y el padrón), eliges un <strong>gestor de su municipio</strong> — o ninguno, si la persona
    pidió llevar su trámite por su cuenta — y el sistema crea la cuenta y le envía sus credenciales.`)}
  ${paso('6.3', 'Rechazar lleva motivo', `El motivo le llega a la persona tal como lo escribas.
    Puedes previsualizar el correo antes de decidir, en ambos sentidos.`)}
  ${lamina(LAMINA_BANDEJA, 'Así se ve la bandeja: tres pestañas, la urgencia marcada y las dos decisiones')}
`);

// ── Cap. 4 · Alumnos ───────────────────────────────────────────────────────

const LAMINA_FICHA_A = `
  <div class="panel">
    <div class="panel-cab">
      <div><div class="panel-hola">Nombre del alumno</div>
        <div class="panel-sub">Municipio · su gestor · estado del expediente</div></div>
      ${chip('Expediente completo', C.verdeFondo, C.verde)}
    </div>
    <div class="tabs tabs-chica">
      <span class="tab tab-on">Documentos</span><span class="tab">Cédula</span><span class="tab">Módulos</span><span class="tab">Pagos</span><span class="tab">Calificaciones</span><span class="tab">Credencial</span>
    </div>
    <div class="panel-etq">ACCIONES SOBRE EL ALUMNO</div>
    <div class="btnrow btnrow-wrap">
      <div class="btn btn-borde">${I.pluma()} Editar información</div>
      <div class="btn btn-borde">Reset password</div>
      <div class="btn btn-borde">Reenviar credenciales</div>
      <div class="btn btn-borde">${I.usuarios()} Asignar gestor</div>
      <div class="btn btn-borde">Poner inactivo</div>
    </div>
  </div>`;

const CAP4A = pagina(`
  ${encabezadoCap(5, 'Alumnos · la ficha', 'La pantalla más densa del panel: todo el trámite de una persona en un solo lugar.')}
  ${paso('5.1', 'Encuentra a cualquiera', `La lista busca por nombre o CURP y filtra por municipio,
    estado del expediente, gestor y etapa. Las tarjetas del Inicio llegan aquí con el filtro ya
    puesto.`)}
  ${paso('5.2', 'Su ficha lo tiene todo', `Seis pestañas: documentos, cédula, módulos, pagos,
    calificaciones y credencial. Documentos, matrícula y cédula ya pasaron por los capítulos
    anteriores — ésta es la puerta a todos.`)}
  ${paso('5.3', 'Y ahora también se corrige', `<strong>Editar información</strong> abre el nombre, la
    CURP, la fecha de nacimiento, el teléfono y la dirección. La CURP corregida pasa por el mismo
    filtro que un alta: estructura, coherencia y duplicados. El correo no se edita: es la llave de
    la cuenta.`)}
  ${lamina(LAMINA_FICHA_A, 'Así se ve la ficha: pestañas para consultar, acciones para decidir')}
`);

const LAMINA_DOCS_A = `
  <div class="estados">
    <div class="est-fila">
      <div class="est-doc">${I.doc()}<strong>CURP</strong></div>
      ${chip('Aprobado', C.verdeFondo, C.verde)}
      <div class="est-desc">Legible y coincide con los datos: aprobado.</div>
    </div>
    <div class="est-fila">
      <div class="est-doc">${I.doc()}<strong>Acta de nacimiento</strong></div>
      ${chip('Por revisar', C.ambarFondo, C.ambarTexto)}
      <div class="est-desc">Ábrelo, míralo completo y decide.</div>
    </div>
    <div class="est-fila">
      <div class="est-doc">${I.doc()}<strong>Comprobante de domicilio</strong></div>
      ${chip('Rechazado', C.rojoFondo, C.rojo)}
      <div class="est-desc">Con su motivo — el alumno y su gestor lo leen tal cual.</div>
    </div>
  </div>`;

const CAP4B = pagina(`
  ${encabezadoCap(1, 'El expediente: revisa y decide', `Cinco documentos obligatorios y la
  fotografía. La tarjeta "Documentos por revisar" del Inicio te deja aquí: en la pestaña
  Documentos de la ficha del alumno.`)}
  ${paso('1.1', 'Los cinco que no perdonan', `CURP, acta de nacimiento, identificación oficial,
    comprobante de domicilio y certificado de secundaria. La fotografía se usa para la credencial
    y la cédula. Los suben el alumno o su gestor; los apruebas tú.`)}
  ${paso('1.2', 'Aprobar o rechazar con motivo', `El motivo del rechazo les llega tal cual: escribe
    qué está mal y qué esperas recibir ("se lee cortado, vuelve a subirlo completo"). Un documento
    rechazado se puede volver a subir de inmediato.`)}
  ${lamina(LAMINA_DOCS_A, 'Así se ve la pestaña de documentos: cada uno con su estado y su motivo')}
  ${cita(`Expediente <strong>5 de 5 aprobado</strong> es la primera compuerta del ciclo: sin ella no
  hay matrícula, y sin matrícula no hay inscripción ni credencial.`)}
`);

const LAMINA_MATRICULA = `
  <div class="alta">
    <div class="campo">
      <div class="campo-etq">MATRÍCULA OFICIAL DGB</div>
      <div class="campo-caja">La que emitió el Estado para este alumno
        <span class="alta-ok">${I.paloma(C.verde)} confirmada</span></div>
    </div>
    <div class="ruta-mini" style="margin-top:3mm">
      <div class="rm rm-ok">1 · Captura la matrícula</div>
      <div class="rm rm-ok">2 · Emite la credencial</div>
      <div class="rm">3 · Verifícala por QR</div>
    </div>
    <p class="alta-nota" style="margin-top:3mm">${I.candado(C.dorado)} Sin matrícula capturada, la credencial queda bloqueada — el orden es siempre éste.</p>
  </div>`;

const CAP4C = pagina(`
  ${encabezadoCap(2, 'Matrícula y credencial', 'La matrícula la genera el Estado. Aquí se captura — y con ella se abre todo lo demás.')}
  ${paso('2.1', 'Captura, no invención', `Cuando el expediente queda 5/5, el Estado asigna la matrícula
    oficial y tú la <strong>capturas</strong> en la pestaña Credencial, con casilla de confirmación:
    una matrícula mal escrita persigue al alumno en cada documento oficial.`)}
  ${paso('2.2', 'Emite su credencial digital', `Con la matrícula capturada se emite, se previsualiza
    por ambos lados y se descarga en PDF. Si venció se <strong>renueva</strong>; si se necesita un
    folio nuevo, se <strong>repone</strong>.`)}
  ${paso('2.3', 'Verifícala en la sede', `Desde <strong>Verificación</strong>, con el teléfono: se
    escanea el QR de la credencial y el sistema confirma que es auténtica y de quién es. El QR va
    firmado — uno falso no pasa.`)}
  ${lamina(LAMINA_MATRICULA, 'El orden de la pestaña Credencial: matrícula primero, credencial después')}
`);

const LAMINA_FIRMA = `
  <div class="orden">
    <div class="ficha-cab">
      <div><strong>Cédula de inscripción</strong><span>Datos del alumno, sus módulos y su etapa</span></div>
      ${chip('Lista para firma', C.ambarFondo, C.ambarTexto)}
    </div>
    <div class="adjuntar" style="min-height:16mm">${I.pluma(C.gris)} Firma del responsable — se traza aquí, en pantalla</div>
    <div class="btnrow">
      <div class="btn btn-solido">${I.pluma('#fff')} Firmar como responsable</div>
      <div class="btn btn-borde">${I.descarga()} Descargar cédula (PDF)</div>
    </div>
  </div>`;

const CAP4D = pagina(`
  ${encabezadoCap(4, 'Cédula y módulos', 'La inscripción formal: los módulos en el sistema y la cédula firmada.')}
  ${paso('4.1', 'Inscribe sus módulos', `Desde la pestaña Módulos, hasta <strong>4 por
    convocatoria</strong>. El sistema valida solo los choques de horario y el tope — no deja
    inscribir de más.`)}
  ${paso('4.2', 'Edita y firma la cédula', `La cédula se arma con los datos del alumno y se
    <strong>firma digitalmente en pantalla</strong>. La firma queda fija en el documento: aunque
    después cambie la firma guardada, la cédula ya emitida no se altera. Ambos perfiles de
    administración firman, cada quien con la suya.`)}
  ${lamina(LAMINA_FIRMA, 'Así se ve el editor de cédula: se firma en pantalla y se descarga con la firma incluida')}
  ${cita(`Un alumno cuenta como <strong>inscrito</strong> cuando tiene matrícula capturada
  <strong>y</strong> cédula firmada. Sin firma, es preinscrito.`)}
`);

const LAMINA_BAJA = `
  <div class="orden">
    <div class="orden-fila orden-boton">
      <div><strong>Paso 1 · Poner inactivo</strong><span>Pierde el acceso; todo su historial se conserva.</span></div>
      ${chip('Reversible', C.verdeFondo, C.verde)}
    </div>
    <div class="grupal-flecha">↓</div>
    <div class="orden-fila orden-boton" style="border-color:${C.rojo}">
      <div><strong>Paso 2 · Dar de baja definitiva</strong><span>Solo aparece ya inactivo. Pide escribir BAJA.</span></div>
      ${chip('Libera correo · teléfono · CURP', C.rojoFondo, C.rojo)}
    </div>
    <p class="alta-nota" style="margin-top:2mm">El registro no se borra: expediente, exámenes y pagos quedan
    como historial, y su rastro se conserva en el padrón histórico.</p>
  </div>`;

const CAP4E = pagina(`
  ${kicker('CAPÍTULO 05 · CIERRE')}
  <h2 class="cap-titulo">La baja, en dos pasos</h2>
  <p class="lede">Separar "ya no entra" de "ya no vuelve" evita borrar por accidente.</p>
  ${paso('5.4', 'Inactivo: la pausa', `Cierra el acceso y las sesiones, pide motivo y se deshace con
    <strong>Reactivar</strong> en la misma pantalla. Mientras esté inactivo, su correo, su teléfono
    y su CURP siguen ocupados.`)}
  ${paso('5.5', 'Definitiva: la salida', `Sobre un alumno ya inactivo aparece <strong>Dar de baja
    definitiva</strong>: libera su correo, su teléfono y su CURP para que puedan usarse en un
    registro nuevo — y conserva su registro completo como historial. Pide escribir
    <strong>BAJA</strong> porque no hay vuelta atrás.`)}
  ${lamina(LAMINA_BAJA, 'La baja en dos pasos: primero la pausa reversible, después la salida definitiva')}
  ${ojo(`La definitiva es <strong>irreversible</strong>: el correo y la CURP liberados pueden quedar
  ocupados por otra cuenta al día siguiente. Aplícala solo con la certeza — y con el motivo escrito.`)}
`);

// ── Cap. 5 · La red de gestores ────────────────────────────────────────────

const LAMINA_RED = `
  <div class="lista">
    <div class="lista-buscar">${I.busqueda()} Busca un centro por nombre o municipio…</div>
    <div class="al-fila"><div class="al-quien"><strong>Centro de asesoría</strong><span>Municipio · sus alumnos y su tasa de éxito a la vista</span></div>${chip('Activo', C.verdeFondo, C.verde)}</div>
    <div class="al-fila"><div class="al-quien"><strong>Centro de asesoría</strong><span>Municipio · sus alumnos y su tasa de éxito a la vista</span></div>${chip('Activo', C.verdeFondo, C.verde)}</div>
    <div class="btnrow">
      <div class="btn btn-solido">${I.usuarios()} Nuevo gestor</div>
      <div class="btn-nota">${I.candado(C.gris)} Exclusivo de la titular</div>
    </div>
  </div>`;

const CAP5A = pagina(`
  ${encabezadoCap(9, 'La red de gestores', 'Un aliado en cada municipio. Aquí se cuida esa red.')}
  ${paso('9.1', 'La red de un vistazo', `Cada centro con su municipio, sus alumnos y su desempeño.
    Desde aquí entras a la ficha de cualquiera.`)}
  ${paso('9.2', 'El alta es de la titular', `<strong>Nuevo gestor</strong> crea la cuenta del centro,
    la asigna a su municipio y envía las credenciales por correo. Es una de las cuatro facultades
    exclusivas de la titular (capítulo 12).`)}
  ${paso('9.3', 'Los alumnos se heredan', `Si un centro cierra o cambia, la titular
    <strong>reasigna</strong> a sus alumnos a otro gestor, con la razón registrada. Ningún alumno se
    queda huérfano por un cambio administrativo.`)}
  ${lamina(LAMINA_RED, 'Así se ve la red: cada centro con su estado, y el alta reservada a la titular')}
`);

const LAMINA_PERMISOS = `
  <div class="orden">
    <div class="ficha-cab">
      <div><strong>Centro de asesoría</strong><span>Su ficha: datos, desempeño y permisos</span></div>
      ${chip('Activo', C.verdeFondo, C.verde)}
    </div>
    <div class="tog-fila"><div><strong>Pago individual</strong><span>Fichas de un solo alumno</span></div><span class="tog tog-on"><i></i></span></div>
    <div class="tog-fila"><div><strong>Pago grupal</strong><span>Una ficha para varios alumnos</span></div><span class="tog tog-on"><i></i></span></div>
    <div class="tog-fila"><div><strong>Aula virtual</strong><span>Beneficio extra que se activa por centro</span></div><span class="tog"><i></i></span></div>
    <p class="alta-nota" style="margin-top:2mm">El sistema no deja apagar los dos permisos de pago a la vez: el centro siempre conserva una vía.</p>
  </div>`;

const CAP5B = pagina(`
  ${kicker('CAPÍTULO 09 · CONTINÚA')}
  <h2 class="cap-titulo">La ficha del centro</h2>
  <p class="lede">Cada centro se configura desde su ficha: qué puede hacer y qué tiene activo.</p>
  ${paso('9.4', 'Permisos de pago', `Por centro se habilita el pago <strong>individual</strong>, el
    <strong>grupal</strong> o ambos. Es la palanca de la administración sobre cómo paga cada centro.`)}
  ${paso('9.5', 'Aula virtual', `Un beneficio que se enciende centro por centro. Los módulos y
    pruebas del alumno son un derecho aparte: no dependen de esta llave.`)}
  ${paso('9.6', 'Cuidados mayores', `Editar sus datos y su capacidad, reenviar credenciales y reset de
    contraseña los hace cualquier perfil; <strong>activar o desactivar el centro</strong> es de la
    titular.`)}
  ${lamina(LAMINA_PERMISOS, 'Así se ve la ficha del centro: sus permisos como interruptores')}
`);

// ── Cap. 6 · Fichas de pago ────────────────────────────────────────────────

const LAMINA_ORDEN_A = `
  <div class="orden">
    <div class="ficha-cab">
      <div><strong>Orden de pago</strong><span>Su folio, sus exámenes y el centro que la pidió</span></div>
      ${chip('Solicitada', C.ambarFondo, C.ambarTexto)}
    </div>
    <div class="ruta-mini">
      <div class="rm rm-ok">Solicitada</div>
      <div class="rm">Emisión</div>
      <div class="rm">Pago</div>
      <div class="rm">Confirmado</div>
    </div>
    <div class="adjuntar">${I.subir(C.gris)} PDF de la orden oficial — obligatorio para emitir</div>
    <div class="orden-fila">
      <div class="campo" style="flex:1;margin:0"><div class="campo-etq">FECHA DE VENCIMIENTO</div><div class="campo-caja">La que trae la orden del Estado</div></div>
      <div class="campo" style="flex:1;margin:0"><div class="campo-etq">LÍNEA DE CAPTURA (OPCIONAL)</div><div class="campo-caja">Se muestra junto a la ficha</div></div>
    </div>
  </div>`;

const CAP6A = pagina(`
  ${encabezadoCap(3, 'Fichas de pago', 'Modula no cobra ni genera líneas de captura: las emite el Estado. Aquí se cargan y se concilian.')}
  ${paso('3.1', 'Nace solicitada', `El gestor —o el alumno— pide su ficha y la orden aparece en tu
    bandeja como <strong>Solicitada</strong>, con el pendiente marcado en el Inicio. La orden trae
    los datos fiscales del centro listos para copiar.`)}
  ${paso('3.2', 'Tú la emites', `Generas la línea en la plataforma del Estado y aquí cargas el
    <strong>PDF de la orden</strong> con su fecha de vencimiento — y la línea de captura si quieres
    mostrarla junto a la ficha. Al emitir, el centro la ve y puede descargarla y pagar.`)}
  ${lamina(LAMINA_ORDEN_A, 'Así se ve una orden: su camino de 4 estaciones y lo que se captura al emitirla')}
  ${cita(`El camino completo es <strong>Solicitada → Emisión → Pago → Confirmado</strong>. Tu parte
  son la segunda y la última estación; el pago en ventanilla es del centro o del alumno.`)}
`);

const LAMINA_CONCILIA = `
  <div class="orden">
    <div class="orden-fila orden-boton">
      <div><strong>Comprobante del pago</strong><span>Lo subió el centro o el alumno; ábrelo y compáralo con la orden.</span></div>
      ${I.doc()}
    </div>
    <div class="btnrow">
      <div class="btn btn-solido" style="background:${C.verde}">${I.paloma('#fff')} Conciliar — queda confirmado</div>
      <div class="btn btn-borde" style="border-color:${C.rojo};color:${C.rojo}">Rechazar comprobante — con motivo</div>
    </div>
    <div class="orden-fila" style="margin-top:2mm">
      <div class="btn btn-borde" style="flex:1">${I.descarga()} Exámenes solicitados (PDF)</div>
      <div class="btn btn-borde" style="flex:1">${I.descarga()} Inscritos pagados (PDF)</div>
    </div>
  </div>`;

const CAP6B = pagina(`
  ${kicker('CAPÍTULO 03 · CONTINÚA')}
  <h2 class="cap-titulo">Conciliar y controlar</h2>
  <p class="lede">El pago no existe hasta que tú lo confirmas contra el comprobante.</p>
  ${paso('3.3', 'Concilia cada comprobante', `Compara el comprobante con la orden: si coincide,
    <strong>Conciliar</strong> deja el pago confirmado y los exámenes quedan firmes. Si algo no
    cuadra, <strong>rechaza el comprobante con motivo</strong> y el centro lo repone. Una orden
    equivocada se puede cancelar.`)}
  ${paso('3.4', 'Tus dos documentos de control', `Por etapa y por centro se descargan la relación de
    <strong>Exámenes solicitados</strong> (lo que falta por pagar) y la de <strong>Inscritos
    pagados</strong> (lo que ya quedó firme). Con esos dos PDF se rinde cuentas de la etapa.`)}
  ${lamina(LAMINA_CONCILIA, 'Así se ve la conciliación: el comprobante, las dos decisiones y los dos PDF de control')}
  ${ojo(`<strong>Solo lo pagado se califica.</strong> Un examen presentado sin pago confirmado no
  recibe calificación — conciliar a tiempo es parte del ciclo, no un trámite posterior.`)}
`);

// ── Cap. 7 · Calificaciones ────────────────────────────────────────────────

const LAMINA_SEP = `
  <div class="orden">
    <div class="adjuntar">${I.subir(C.gris)} Relación oficial de calificaciones (PDF) — el sistema la lee solo</div>
    <div class="grupal-flecha">↓</div>
    <div class="al-fila"><div class="al-quien"><strong>Renglón leído</strong><span>Alumno y módulo reconocidos</span></div>${chip('Coincide', C.verdeFondo, C.verde)}</div>
    <div class="al-fila"><div class="al-quien"><strong>Renglón con duda</strong><span>Revísalo antes de aplicar — o captúralo a mano</span></div>${chip('Revisar', C.ambarFondo, C.ambarTexto)}</div>
    <div class="mod-boton">Aplicar calificaciones</div>
  </div>`;

const CAP7 = pagina(`
  ${encabezadoCap(7, 'Calificaciones', 'La fuente es la relación oficial. De ahí, al portal de cada alumno.')}
  ${paso('7.1', 'Sube la relación oficial', `El sistema lee el PDF y arma una <strong>previa con
    semáforos</strong>: qué renglones reconoció y cuáles piden revisión. Nada se aplica hasta que
    lo confirmes; lo dudoso se corrige o se captura a mano.`)}
  ${paso('7.2', 'Aplica y se publica', `Al aplicar, cada calificación queda en el historial del
    alumno: la ve él en su portal, la ve su gestor en sus resultados y queda en el histórico
    consultable por nombre, matrícula o CURP.`)}
  ${paso('7.3', 'El que no aprobó, vuelve', `No es definitivo: el alumno se inscribe de nuevo al
    módulo en una etapa siguiente. Su gestor planea el repaso con las pruebas del portal.`)}
  ${lamina(LAMINA_SEP, 'Así se ve la captura: la relación entra, el semáforo avisa, tú aplicas')}
`);

// ── Cap. 8 · Comunicación ──────────────────────────────────────────────────

const LAMINA_ANUNCIO = `
  <div class="alta">
    <div class="campo"><div class="campo-etq">TÍTULO DEL ANUNCIO</div><div class="campo-caja">Lo que verán alumnos y gestores en su inicio</div></div>
    <div class="campo"><div class="campo-etq">PRIORIDAD</div><div class="campo-caja" style="gap:2mm">
      ${chip('Informativo', C.cremaClaro, C.gris)} ${chip('Importante', C.ambarFondo, C.ambarTexto)} ${chip('Urgente', C.rojoFondo, C.rojo)}
    </div></div>
    <div class="campo"><div class="campo-etq">A QUIÉN LE APARECE</div><div class="campo-caja" style="gap:2mm">
      ${chip('Todos', C.verdeFondo, C.verde)} ${chip('Por municipio', C.cremaClaro, C.gris)} ${chip('Por etapa', C.cremaClaro, C.gris)} ${chip('Por gestor', C.cremaClaro, C.gris)}
    </div></div>
    <div class="btnrow">
      <div class="btn btn-solido">Publicar</div>
      <div class="btn btn-borde">Guardar como borrador</div>
    </div>
  </div>`;

const CAP8 = pagina(`
  ${encabezadoCap(10, 'Comunicación', 'Dos canales tuyos: el megáfono y el mostrador de dudas.')}
  ${paso('10.1', 'Anuncios: el megáfono', `Aparecen como banner en el inicio de alumnos y gestores.
    Tienen prioridad (informativo, importante, urgente), pueden llevar un botón con enlace y se
    <strong>segmentan</strong> por municipio, etapa o gestor: el aviso le llega solo a quien le toca.
    Lo que ya no aplica se archiva, no se deja al aire.`)}
  ${paso('10.2', 'Preguntas frecuentes: el mostrador', `Es el centro de ayuda que ven alumnos y
    gestores. Cada pregunta lleva su respuesta, su categoría y su <strong>audiencia</strong> (alumno,
    gestor o ambos). Marca como principales las 5 de cada categoría que más se repiten: el resto
    vive en el buscador.`)}
  ${lamina(LAMINA_ANUNCIO, 'Así se crea un anuncio: prioridad, destino y publicación')}
`);

// ── Cap. 9 · Padrón histórico y verificación ───────────────────────────────

const LAMINA_PADRON = `
  <div class="orden">
    <div class="adjuntar">${I.subir(C.gris)} Padrón oficial (Excel) — actualiza por matrícula, no duplica</div>
    <div class="lista-buscar">${I.busqueda()} Busca por CURP, matrícula o nombre…</div>
    <div class="btnrow">
      <div class="btn btn-borde">${I.descarga()} Descargar Excel — completo o filtrado</div>
      <div class="btn-nota">${I.candado(C.gris)} Solo administración y dirección</div>
    </div>
  </div>`;

const CAP9 = pagina(`
  ${encabezadoCap(11, 'Padrón histórico y verificación', 'La memoria del programa y el candado contra duplicados.')}
  ${paso('11.1', 'El padrón es permanente', `Todo alumno con matrícula queda registrado ahí y
    <strong>nunca se depura</strong>: aunque su cuenta desaparezca, su rastro ante el Estado se
    conserva. Es información confidencial — solo administración y dirección la ven completa.`)}
  ${paso('11.2', 'Se alimenta sin miedo', `El Excel oficial se puede volver a subir cuando haga falta:
    el sistema <strong>actualiza por matrícula</strong>, no duplica. Y al dar de alta a cualquier
    persona, la CURP se coteja contra este padrón: los duplicados se detienen en la puerta.`)}
  ${paso('11.3', 'Verificación en la sede', `Desde el teléfono, la sección <strong>Verificación</strong>
    escanea el QR de una credencial y confirma al instante que es auténtica y de quién es.`)}
  ${lamina(LAMINA_PADRON, 'Así se ve el padrón: se importa, se consulta y se exporta — sin duplicar jamás')}
`);

// ── Cap. 10 · Titular y operativo ──────────────────────────────────────────

const CAP10 = pagina(`
  ${encabezadoCap(12, 'Titular y operativo', 'Dos perfiles de administración. Casi todo lo hacen ambos — esto es lo que no.')}
  <div class="tarjetas">
    ${tarjeta('Solo la titular', `Cuatro facultades: <strong>alta de gestores</strong>,
      <strong>activar o desactivar un centro</strong>, <strong>reasignar los alumnos</strong> de un
      gestor a otro y la <strong>bitácora de actividad</strong> en Configuración.`)}
    ${tarjeta('Ambos perfiles', `Todo lo demás: solicitudes, expedientes, matrículas, cédulas
      —<strong>la firma incluida, cada quien con la suya</strong>—, fichas de pago, conciliación,
      calificaciones, credenciales, bajas, anuncios, preguntas y padrón.`)}
  </div>
  ${paso('12.1', 'Configuración: lo que sí se toca', `<strong>Mi cuenta</strong> y
    <strong>Seguridad</strong> son personales y se cambian con confianza. <strong>Documentos
    requeridos</strong> y <strong>Temarios de módulos</strong> son parámetros institucionales: se
    tocan poco y afectan a todos. El calendario de etapas no está aquí — vive en
    <strong>Convocatorias</strong>.`)}
  ${paso('12.2', 'Reportes, en preparación', `La sección existe y se habilitará con datos reales
    cuando haya un mes completo de operación. Mientras, los dos PDF de control del capítulo 3 son
    el reporte de cada etapa.`)}
  ${cita(`La etiqueta junto a tu nombre dice qué perfil eres. Si un botón no aparece, no está
  fallando el sistema: es facultad del otro perfil.`)}
`);

// ── Anexo ──────────────────────────────────────────────────────────────────

const ANEXO = pagina(`
  ${kicker('ANEXO · IMPRIME ESTA PÁGINA')}
  <h2 class="cap-titulo">El pulso de la administración</h2>
  <p class="lede">Dos ritmos. El primero no se negocia; el segundo se repite ocho veces al año.</p>
  <div class="panel-etq">CADA DÍA</div>
  <div class="cotejo cotejo-compacto">
    <div class="cot"><span class="cuadro"></span>Atendí las 4 tarjetas del Inicio: documentos, emisiones, revisiones y solicitudes</div>
    <div class="cot"><span class="cuadro"></span>Ninguna solicitud de cuenta pasó de 7 días esperando</div>
    <div class="cot"><span class="cuadro"></span>Revisé la campana de notificaciones</div>
  </div>
  <div class="panel-etq" style="margin-top:5mm">CADA ETAPA</div>
  <div class="cotejo cotejo-compacto">
    <div class="cot"><span class="cuadro"></span>Etapas del año precargadas desde el PDF oficial y revisadas</div>
    <div class="cot"><span class="cuadro"></span>Sedes de la etapa definidas ANTES de abrir la ventana</div>
    <div class="cot"><span class="cuadro"></span>Expedientes revisados y matrículas capturadas a tiempo</div>
    <div class="cot"><span class="cuadro"></span>Cédulas firmadas de los inscritos</div>
    <div class="cot"><span class="cuadro"></span>Órdenes emitidas con su PDF y su vencimiento</div>
    <div class="cot"><span class="cuadro"></span>Comprobantes conciliados — solo lo pagado se califica</div>
    <div class="cot"><span class="cuadro"></span>Relación oficial de calificaciones aplicada y revisada</div>
    <div class="cot"><span class="cuadro"></span>Credenciales emitidas de los alumnos nuevos</div>
  </div>
  ${cita(`<strong>El programa avanza al ritmo de esta oficina.</strong> Cada pendiente atendido hoy
  es un alumno que no se detuvo.`)}
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
  .portada-frase { margin-top: 14mm; font-size: 13pt; line-height: 1.75; max-width: 150mm; }
  .portada-frase span { color: ${C.doradoSuave}; font-weight: 600; }
  .pie-portada { font-size: 7.5pt; letter-spacing: 0.24em; color: rgba(255,255,255,0.55); }

  .indice { margin-top: 8mm; }
  .ind-fila { display: flex; align-items: baseline; gap: 6mm; padding: 4.4mm 0;
              border-bottom: 0.3mm solid ${C.linea}; }
  .indice-compacto .ind-fila { padding: 3.8mm 0; }
  .ind-n { font-weight: 700; font-size: 11pt; color: ${C.dorado}; min-width: 10mm; }
  .ind-t { font-weight: 600; font-size: 12pt; }
  .ind-d { margin-left: auto; color: ${C.gris}; font-size: 9pt; }

  .cap-titulo { font-size: 21pt; line-height: 1.18; color: ${C.guindaNoche}; margin-bottom: 4mm;
                font-weight: 700; letter-spacing: -0.01em; }
  .lede { font-size: 11.5pt; color: ${C.gris}; margin-bottom: 8mm; }

  .camino { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; margin: 6mm 0 8mm; }
  .camino3 { grid-template-columns: 1fr 1fr 1fr; }
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

  /* Panel / ficha */
  .panel { max-width: 155mm; margin: 0 auto; }
  .panel-cab { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4mm; }
  .panel-hola { font-size: 15pt; font-weight: 700; color: ${C.guindaNoche}; }
  .panel-sub { font-size: 8.5pt; color: ${C.gris}; }
  .panel-etq { font-size: 7pt; font-weight: 700; letter-spacing: 0.2em; color: ${C.dorado};
               margin: 3mm 0 2mm; }

  /* Tarjetas del día */
  .dia { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; }
  .dc { background: #fff; border: 0.35mm solid ${C.linea}; border-radius: 2.5mm; padding: 3.5mm 3mm;
        text-align: center; }
  .dc-ico { margin-bottom: 1.5mm; }
  .dc-ico .ico { width: 6mm; height: 6mm; }
  .dc strong { display: block; font-size: 8.5pt; color: ${C.guindaNoche}; line-height: 1.35; }
  .dia-nota { display: flex; gap: 2.5mm; align-items: center; margin-top: 3.5mm; font-size: 8.5pt;
              color: ${C.gris}; }

  /* Ciclo */
  .ciclo { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; }
  .ci { background: ${C.cremaClaro}; border: 0.35mm solid ${C.linea}; border-radius: 2.5mm;
        padding: 3.5mm; }
  .ci span { display: inline-flex; width: 7mm; height: 7mm; border-radius: 50%; background: ${C.guinda};
             color: #fff; font-weight: 700; font-size: 9pt; align-items: center; justify-content: center;
             margin-bottom: 1.5mm; }
  .ci strong { display: block; font-size: 9pt; color: ${C.guindaNoche}; line-height: 1.3;
               margin-bottom: 1mm; }
  .ci p { font-size: 7.5pt; color: ${C.gris}; line-height: 1.45; }
  .ciclo-pie { display: flex; gap: 2.5mm; align-items: center; justify-content: center;
               margin-top: 3.5mm; font-size: 8.5pt; color: ${C.gris}; }

  /* Pestañas */
  .tabs { display: flex; gap: 2mm; margin-bottom: 1mm; }
  .tab { border: 0.35mm solid ${C.linea}; border-radius: 5mm; padding: 1.2mm 4mm; font-size: 8.5pt;
         color: ${C.gris}; background: #fff; }
  .tab-on { background: ${C.guinda}; border-color: ${C.guinda}; color: #fff; font-weight: 600; }
  .tabs-chica { margin: 2mm 0 1mm; }
  .tabs-chica .tab { font-size: 7.5pt; padding: 1mm 3mm; }

  /* Botones */
  .btnrow { display: flex; gap: 3mm; align-items: center; margin-top: 2mm; }
  .btnrow-wrap { flex-wrap: wrap; }
  .btn { display: inline-flex; gap: 2mm; align-items: center; border-radius: 2.5mm;
         padding: 2.6mm 4.5mm; font-size: 9pt; font-weight: 600; justify-content: center; }
  .btn-solido { background: ${C.guinda}; color: #fff; }
  .btn-borde { border: 0.4mm solid ${C.linea}; background: #fff; color: ${C.guindaNoche}; }
  .btn-nota { display: inline-flex; gap: 2mm; align-items: center; font-size: 8.5pt; color: ${C.gris}; }

  /* Listas */
  .lista { max-width: 150mm; margin: 0 auto; display: flex; flex-direction: column; gap: 2.6mm; }
  .lista-buscar { display: flex; gap: 3mm; align-items: center; border: 0.4mm solid ${C.linea};
                  border-radius: 6mm; background: #fff; padding: 2.8mm 5mm; color: #a89a8e;
                  font-size: 9.5pt; }
  .al-fila { display: flex; gap: 4mm; align-items: center; justify-content: space-between;
             background: #fff; border: 0.35mm solid ${C.linea}; border-radius: 2.5mm;
             padding: 3mm 4.5mm; }
  .al-quien strong { display: block; font-size: 10pt; font-weight: 600; color: ${C.guindaNoche}; }
  .al-quien span { font-size: 8pt; color: ${C.gris}; }

  /* Estados de documento */
  .estados { display: flex; flex-direction: column; gap: 3mm; }
  .est-fila { display: grid; grid-template-columns: 58mm 26mm 1fr; gap: 4mm; align-items: center;
              background: ${C.cremaClaro}; border: 0.35mm solid ${C.linea}; border-radius: 3mm;
              padding: 3.5mm 5mm; }
  .est-doc { font-size: 10pt; display: flex; gap: 2.5mm; align-items: center; }
  .est-doc strong { font-weight: 600; }
  .est-desc { font-size: 9pt; color: ${C.gris}; }

  /* Formularios (alta) */
  .alta { max-width: 128mm; margin: 0 auto; }
  .campo { margin-bottom: 3mm; }
  .campo-etq { font-size: 7pt; font-weight: 700; letter-spacing: 0.16em; color: ${C.gris};
               margin-bottom: 1.5mm; }
  .campo-caja { display: flex; gap: 3mm; align-items: center; border: 0.4mm solid ${C.linea};
                border-radius: 2.5mm; background: #fff; padding: 3.5mm 4mm; font-size: 10pt; }
  .alta-ok { margin-left: auto; color: ${C.verde}; font-weight: 600; font-size: 8.5pt;
             display: flex; gap: 1.5mm; align-items: center; }
  .alta-nota { font-size: 8.5pt; color: ${C.gris}; display: flex; gap: 2mm; align-items: center; }

  /* Orden / ficha */
  .orden { max-width: 138mm; margin: 0 auto; display: flex; flex-direction: column; gap: 3mm; }
  .orden-fila { display: flex; gap: 4mm; align-items: center; }
  .orden-boton { background: ${C.cremaClaro}; border: 0.45mm solid ${C.guinda}; border-radius: 3mm;
                 padding: 4mm 5mm; }
  .orden-boton strong { display: block; font-size: 10.5pt; font-weight: 600; color: ${C.guindaNoche}; }
  .orden-boton span { font-size: 8.5pt; color: ${C.gris}; }
  .orden-boton > div { flex: 1; }
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
  .grupal-flecha { text-align: center; color: ${C.dorado}; font-size: 14pt; font-weight: 700; }
  .mod-boton { margin-top: 1.5mm; background: ${C.guinda}; color: #fff; text-align: center;
               font-weight: 600; font-size: 10.5pt; border-radius: 2.5mm; padding: 2.8mm; }

  /* Interruptores */
  .tog-fila { display: flex; justify-content: space-between; align-items: center; background: #fff;
              border: 0.35mm solid ${C.linea}; border-radius: 2.5mm; padding: 3mm 4.5mm; }
  .tog-fila strong { display: block; font-size: 10pt; font-weight: 600; color: ${C.guindaNoche}; }
  .tog-fila span:not(.tog) { font-size: 8pt; color: ${C.gris}; }
  .tog { width: 10mm; height: 5.5mm; border-radius: 3mm; background: #d8cec2; position: relative;
         flex-shrink: 0; display: inline-block; }
  .tog i { position: absolute; top: 0.7mm; left: 0.7mm; width: 4.1mm; height: 4.1mm;
           border-radius: 50%; background: #fff; }
  .tog-on { background: ${C.verde}; }
  .tog-on i { left: auto; right: 0.7mm; }

  /* Tarjetas y cotejo */
  .tarjetas { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; margin: 2mm 0 6mm; }
  .tarjeta { background: #fff; border: 0.35mm solid ${C.linea}; border-radius: 3.5mm; padding: 6mm; }
  .tarjeta h4 { font-size: 11.5pt; font-weight: 700; color: ${C.guindaNoche}; margin-bottom: 2mm; }
  .tarjeta p { font-size: 9.5pt; color: ${C.gris}; }
  .cotejo { margin-top: 1mm; }
  .cot { display: flex; align-items: center; gap: 5mm; padding: 4.2mm 0; font-size: 11.5pt;
         border-bottom: 0.3mm dashed ${C.linea}; }
  .cotejo-compacto .cot { padding: 3mm 0; font-size: 10.5pt; }
  .cuadro { width: 6.5mm; height: 6.5mm; border: 0.6mm solid ${C.guinda}; border-radius: 1.8mm;
            flex-shrink: 0; }
</style></head>
<body>
${PORTADA}
${INDICE}
${PRIORIDADES}
${CAP1}
${CAP4B}
${CAP4C}
${CAP6A}
${CAP6B}
${CAP4D}
${CAP4A}
${CAP4E}
${CAP3}
${CAP7}
${CAP2}
${CAP5A}
${CAP5B}
${CAP8}
${CAP9}
${CAP10}
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
      <span>Modula · Plan 22 — Guía de administración · Uso interno</span>
      <span>${FECHA_VERSION} · Pág. <span class="pageNumber"></span> de <span class="totalPages"></span></span>
    </div>`,
  margin: { top: '0', bottom: '0', left: '0', right: '0' },
});
await navegador.close();

const kb = Math.round(fs.statSync(SALIDA).size / 1024);
console.log(`✅ ${SALIDA} (${kb} KB)`);
