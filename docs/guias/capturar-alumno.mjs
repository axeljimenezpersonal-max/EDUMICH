/**
 * RIG DE CAPTURAS — guía del alumno.
 *
 * Recorre el portal en modo demo (datos 100 % ficticios, sin backend) y guarda
 * un PNG por pantalla del guion (`guion-guia-alumno.md`). Las capturas NO se
 * retocan a mano: si la interfaz cambia, se corre esto otra vez y ya.
 *
 * Uso (con el portal de desarrollo corriendo):
 *
 *     pnpm --filter @workspace/student-portal dev          # terminal 1
 *     node docs/guias/capturar-alumno.mjs [urlBase]        # terminal 2
 *
 * Por omisión apunta a http://localhost:5173. Deja los PNG en
 * docs/guias/capturas-alumno/ (nombres ASCII, regla 7 de CLAUDE.md).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

/**
 * `playwright-core` NO es dependencia del monorepo a propósito: solo lo usa
 * esta fábrica, y meterlo al package.json engordaría cada `pnpm install` del
 * Docker build. Se busca donde exista; si no hay, se dice cómo tenerlo.
 * El navegador ya está en la máquina (PLAYWRIGHT_BROWSERS_PATH).
 */
function cargarPlaywright() {
  const candidatos = [
    process.env.GUIAS_PW,            // ruta explícita, si se quiere
    process.cwd(),                   // por si algún día se instala local
    process.env.GUIAS_PW_FALLBACK,   // scratchpad de la sesión de Claude
  ].filter(Boolean);
  for (const base of candidatos) {
    try {
      return createRequire(path.join(base, 'package.json'))('playwright-core');
    } catch { /* siguiente */ }
  }
  console.error('✋ Falta playwright-core. Instálalo en una carpeta y pásala en GUIAS_PW:');
  console.error('   npm i playwright-core && GUIAS_PW=$PWD node docs/guias/capturar-alumno.mjs');
  process.exit(1);
}
const { chromium } = cargarPlaywright();

const BASE = process.argv[2] ?? 'http://localhost:5173';
const SALIDA = path.join(import.meta.dirname, 'capturas-alumno');

// Vista de teléfono: así usa el portal la mayoría del alumnado.
const VIEWPORT = { width: 390, height: 844 };

/**
 * Guion de capturas. `demo` es la ruta que ACTIVA el modo demo antes de
 * navegar; después cada paso va directo a su ruta (el sessionStorage del demo
 * sobrevive dentro de la misma pestaña).
 *
 * `escenario`: 'nuevo' = alumno recién llegado; 'avanzado' = a mitad del ciclo.
 */
/**
 * Cada paso produce UN PNG:
 *  - sin `elemento` → la primera pantalla (viewport), como la ve el alumno al
 *    entrar. Proporción de teléfono: dos caben lado a lado en la página carta.
 *  - con `elemento` → SOLO ese bloque (los `data-tour` que ya usa el tutorial).
 *    Un bloque recortado se imprime nítido; la página completa de 5000 px de
 *    alto, reducida a una columna, no se puede leer.
 */
const PASOS = [
  // Cap. 1 — primer ingreso (pantallas públicas: no requieren demo)
  { archivo: '01-login', ruta: '/login', publico: true },
  { archivo: '02-recuperar-password', ruta: '/recuperar-password', publico: true },

  // Cap. 2 — conoce tu portal (alumno nuevo)
  { archivo: '03-inicio-nuevo', ruta: '/estudiante', escenario: 'nuevo' },

  // Cap. 3 — expediente
  { archivo: '04-expediente-vacio', ruta: '/estudiante/expediente', escenario: 'nuevo' },
  { archivo: '04b-exp-subir', ruta: '/estudiante/expediente', escenario: 'nuevo', elemento: '[data-tour="exp-obligatorios"]' },
  { archivo: '05-exp-progreso', ruta: '/estudiante/expediente', escenario: 'avanzado', elemento: '[data-tour="exp-progreso"]' },
  { archivo: '05b-exp-matricula', ruta: '/estudiante/expediente', escenario: 'avanzado', elemento: '[data-tour="exp-matricula"]' },
  { archivo: '05c-exp-docs-aprobados', ruta: '/estudiante/expediente', escenario: 'avanzado', elemento: '[data-tour="exp-obligatorios"]' },

  // Cap. 4 — inscripción
  { archivo: '06-insc-ventana', ruta: '/estudiante/convocatoria', escenario: 'avanzado', elemento: '[data-tour="insc-abierta"]' },
  { archivo: '06b-insc-modulos', ruta: '/estudiante/convocatoria', escenario: 'avanzado', elemento: '[data-tour="insc-modulos"]' },
  { archivo: '06c-insc-examenes', ruta: '/estudiante/convocatoria', escenario: 'avanzado', elemento: '[data-tour="insc-examenes"]' },
  { archivo: '06d-insc-sede', ruta: '/estudiante/convocatoria', escenario: 'avanzado', elemento: '[data-tour="insc-sede"]' },
  { archivo: '06e-insc-pasos', ruta: '/estudiante/convocatoria', escenario: 'avanzado', elemento: '[data-tour="insc-pasos"]' },

  // Cap. 5 — pagos
  { archivo: '07-pagos-resumen', ruta: '/estudiante/pagos', escenario: 'avanzado', elemento: '[data-tour="pagos-resumen"]' },
  { archivo: '07b-pagos-estado', ruta: '/estudiante/pagos', escenario: 'avanzado', elemento: '[data-tour="pagos-inscripciones"]' },
  { archivo: '07c-pagos-ordenes', ruta: '/estudiante/pagos', escenario: 'avanzado', elemento: '[data-tour="pagos-ordenes"]' },

  // Cap. 6 — día del examen
  { archivo: '08-pase-examen', ruta: '/estudiante/convocatoria/pase/9001', escenario: 'avanzado' },
  { archivo: '09-identificacion', ruta: '/estudiante/identificacion', escenario: 'avanzado' },

  // Cap. 7 — resultados
  { archivo: '10-calificaciones', ruta: '/estudiante/calificaciones', escenario: 'avanzado', elemento: '[data-tour="calif-contenido"]' },

  // Cap. 8 — herramientas
  { archivo: '11-pruebas', ruta: '/estudiante/modulos', escenario: 'avanzado' },
  { archivo: '12-calendario', ruta: '/estudiante/calendario', escenario: 'avanzado' },
  { archivo: '13-faq', ruta: '/estudiante/faq', escenario: 'avanzado' },

  // Cap. 2 también: el inicio con avance (para el anexo)
  { archivo: '14-inicio-avanzado', ruta: '/estudiante', escenario: 'avanzado' },
];

fs.mkdirSync(SALIDA, { recursive: true });

// El ejecutable explícito evita el choque de versiones entre el paquete y los
// navegadores preinstalados (/opt/pw-browsers/chromium es un enlace estable).
const navegador = await chromium.launch({
  executablePath: process.env.GUIAS_CHROMIUM ?? '/opt/pw-browsers/chromium',
});
let ok = 0;
const fallos = [];

for (const paso of PASOS) {
  // Contexto NUEVO por paso: cada captura arranca de cero, sin estado heredado
  // de la anterior (ni tours a medias, ni sessionStorage de otro escenario).
  const ctx = await navegador.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, locale: 'es-MX' });
  const page = await ctx.newPage();
  try {
    if (!paso.publico) {
      // Activa el demo en el escenario del paso y deja que la SPA se asiente.
      await page.goto(`${BASE}/demo/estudiante?escenario=${paso.escenario}`, { waitUntil: 'networkidle' });
    }

    // Hasta 3 intentos: en el servidor de desarrollo un chunk perezoso a veces
    // se corta a media carga y la app enseña su pantalla de "recargar". Esa
    // pantalla NO es la captura que queremos, así que se detecta y se reintenta
    // en lugar de fotografiarla.
    let listo = false;
    for (let intento = 1; intento <= 3 && !listo; intento++) {
      await page.goto(`${BASE}${paso.ruta}`, { waitUntil: 'networkidle' });
      // Margen para animaciones de entrada (framer-motion) y fuentes.
      await page.waitForTimeout(1500);
      const roto = await page.evaluate(() =>
        /La vista se interrumpió|Cargando módulos disponibles|Cargando…/.test(document.body.innerText),
      );
      if (!roto) listo = true;
      else await page.waitForTimeout(1500);
    }

    // La cinta "Vista demo" orienta a un humano que navega la demo, pero en la
    // guía sería ruido impreso en cada foto. Solo se oculta aquí.
    await page.addStyleTag({ content: '[data-demo-cinta]{display:none !important}' });
    await page.waitForTimeout(200);

    const destino = path.join(SALIDA, `${paso.archivo}.png`);
    if (paso.elemento) {
      const el = page.locator(paso.elemento).first();
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await el.screenshot({ path: destino });
    } else {
      await page.screenshot({ path: destino }); // primera pantalla, sin scroll
    }
    console.log(`  ✅ ${paso.archivo}`);
    ok++;
  } catch (e) {
    console.log(`  ❌ ${paso.archivo}: ${e.message.split('\n')[0]}`);
    fallos.push(paso.archivo);
  } finally {
    await ctx.close();
  }
}

await navegador.close();
console.log(`\n${ok}/${PASOS.length} capturas en ${SALIDA}`);
if (fallos.length) {
  console.log(`Fallaron: ${fallos.join(', ')}`);
  process.exit(1);
}
