/**
 * Alertas de operación: que alguien se entere cuando algo se rompe.
 *
 * Hasta ahora, cuando el sistema fallaba, el rastro iba a la consola de un
 * proceso que nadie mira. La depuración que BORRA cuentas corre a las 3 de la
 * mañana; si truena, se sabía cuando alguien llamaba a decir que su cuenta
 * desapareció.
 *
 * ── Lo que esto NO puede hacer ──────────────────────────────────────────────
 * Si el servidor está caído, no puede avisar que está caído. Un aviso que sale
 * DESDE el sistema solo cubre "sigo vivo pero algo se rompió". Para "estoy
 * muerto" hace falta que alguien pregunte desde afuera: ver `GET /healthz`, que
 * responde 503 cuando la base no contesta, y un vigilante externo que lo
 * consulte cada pocos minutos. Los dos se necesitan; ninguno reemplaza al otro.
 *
 * ── Por qué hay freno ───────────────────────────────────────────────────────
 * Un endpoint roto puede fallar mil veces por minuto. Mil correos no son mil
 * veces más información que uno: son un buzón inservible y una alerta que se
 * empieza a ignorar. Cada clave de alerta se manda una vez y se calla el resto
 * de la ventana, contando cuántas veces volvió a pasar.
 */
import { sendEmail } from './email';
import { CONTACTO_CORREO } from '../config/contacto';
import { escapeHtml } from '../utils/escapeHtml';

export type Gravedad = 'critica' | 'alta' | 'aviso';

/** Ventana de silencio por clave. Una hora: suficiente para no repetir. */
const VENTANA_MS = 60 * 60 * 1000;

/** Cuándo se mandó por última vez cada clave, y cuántas se callaron desde entonces. */
const ultimaVez = new Map<string, { en: number; silenciadas: number }>();

/**
 * A dónde se avisa.
 *
 * `ALERTAS_EMAIL` es lo primero porque una alerta no va al buzón de atención
 * ciudadana: va a quien puede levantar el servicio. Si no está configurada, se
 * cae al buzón institucional para no quedarse sin destino — pero eso es un
 * respaldo, no el diseño.
 */
function destinos(): string[] {
  const crudo =
    process.env.ALERTAS_EMAIL?.trim() ||
    process.env.INSTITUTIONAL_CC_EMAIL?.trim() ||
    CONTACTO_CORREO;

  // Admite varias direcciones separadas por coma o punto y coma. Es lo normal:
  // una alerta a las 3 de la mañana que sólo llega a una persona depende de que
  // esa persona esté despierta.
  //
  // Va un correo POR destinatario, no uno con varios en el "para". Así cada
  // envío queda por separado en el outbox y el fallo de un buzón —rebote,
  // dirección dada de baja— no se lleva por delante el aviso a los demás.
  const lista = crudo.split(/[,;]/).map((d) => d.trim()).filter(Boolean);
  return lista.length > 0 ? lista : [CONTACTO_CORREO];
}

const COLOR: Record<Gravedad, string> = {
  critica: '#991b1b',
  alta: '#b45309',
  aviso: '#3f3a35',
};

const ETIQUETA: Record<Gravedad, string> = {
  critica: 'CRITICA',
  alta: 'ALTA',
  aviso: 'AVISO',
};

export interface Alerta {
  /** Identifica el TIPO de falla, no la ocurrencia. Es la unidad del freno. */
  clave: string;
  titulo: string;
  detalle?: string;
  gravedad?: Gravedad;
  /** Datos sueltos que ayuden a diagnosticar. No meter aquí datos de personas. */
  contexto?: Record<string, unknown>;
}

/**
 * Manda una alerta. NUNCA lanza: una falla avisando de una falla no puede
 * tumbar lo que quedaba en pie.
 */
export async function alertar(a: Alerta): Promise<void> {
  const gravedad = a.gravedad ?? 'alta';
  try {
    const ahora = Date.now();
    const previa = ultimaVez.get(a.clave);
    if (previa && ahora - previa.en < VENTANA_MS) {
      previa.silenciadas += 1;
      return;
    }
    const repetidas = previa?.silenciadas ?? 0;
    ultimaVez.set(a.clave, { en: ahora, silenciadas: 0 });

    // En la consola SIEMPRE, aunque el correo no salga: es el único rastro que
    // queda si el propio envío está roto.
    console.error(`[ALERTA:${gravedad}] ${a.clave} — ${a.titulo}`, a.detalle ?? '', a.contexto ?? '');

    const filas = Object.entries(a.contexto ?? {})
      .map(([k, v]) => `<tr><td style="padding:2px 10px 2px 0;color:#78716c;font-size:12px;">${escapeHtml(k)}</td><td style="font-size:12px;font-family:monospace;">${escapeHtml(String(v))}</td></tr>`)
      .join('');

    const html = `
      <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:600px;">
        <div style="background:${COLOR[gravedad]};color:#fff;padding:14px 18px;border-radius:10px 10px 0 0;">
          <div style="font-size:10px;letter-spacing:2px;font-weight:bold;opacity:.85;">MODULA · PLAN 22 · ALERTA ${ETIQUETA[gravedad]}</div>
          <div style="font-size:17px;font-weight:bold;margin-top:4px;">${escapeHtml(a.titulo)}</div>
        </div>
        <div style="border:1px solid #e7e5e4;border-top:0;border-radius:0 0 10px 10px;padding:16px 18px;">
          ${a.detalle ? `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#3f3a35;">${escapeHtml(a.detalle)}</p>` : ''}
          ${filas ? `<table style="border-collapse:collapse;">${filas}</table>` : ''}
          ${repetidas > 0 ? `<p style="margin:12px 0 0;font-size:12px;color:#92400e;">Esto ya había pasado <strong>${repetidas}</strong> ${repetidas === 1 ? 'vez' : 'veces'} en la hora anterior sin avisar.</p>` : ''}
          <p style="margin:14px 0 0;font-size:11px;color:#a8a29e;">
            Clave <code>${escapeHtml(a.clave)}</code>. No se vuelve a avisar de esto durante una hora.
          </p>
        </div>
      </div>`;

    const para = destinos();
    for (const direccion of para) {
      try {
        await sendEmail({
          to: direccion,
          subject: `[${ETIQUETA[gravedad]}] ${a.titulo} · Modula`,
          html,
          textPlain: `${ETIQUETA[gravedad]} — ${a.titulo}\n\n${a.detalle ?? ''}\n\n${JSON.stringify(a.contexto ?? {}, null, 2)}\n\nClave: ${a.clave}`,
          evento: 'alerta_operacion',
          metadata: { clave: a.clave, gravedad, repetidas, destinatarios: para.length },
        });
      } catch (unoSolo) {
        console.error(`[ALERTA] no se pudo enviar a ${direccion}:`, unoSolo);
      }
    }
  } catch (e) {
    // Sin re-alertar: si avisar falla, avisar de que falló avisar es un bucle.
    console.error('[ALERTA] no se pudo enviar la alerta:', e);
  }
}

/**
 * Engancha las fallas del proceso.
 *
 * Una excepción sin capturar deja el proceso en un estado que ya no es de fiar;
 * Node lo va a tumbar. Lo único que se puede hacer es dejar constancia antes de
 * que se apague, y por eso aquí se espera al envío en vez de soltarlo.
 */
export function engancharAlertasDelProceso(): void {
  process.on('unhandledRejection', (motivo) => {
    void alertar({
      clave: 'proceso:promesa-rechazada',
      titulo: 'Promesa rechazada sin capturar',
      detalle: motivo instanceof Error ? motivo.message : String(motivo),
      gravedad: 'alta',
      contexto: { stack: motivo instanceof Error ? (motivo.stack ?? '').slice(0, 500) : '—' },
    });
  });

  process.on('uncaughtException', async (err) => {
    await alertar({
      clave: 'proceso:excepcion',
      titulo: 'Excepción sin capturar — el proceso va a reiniciar',
      detalle: err.message,
      gravedad: 'critica',
      contexto: { stack: (err.stack ?? '').slice(0, 500) },
    });
    process.exit(1);
  });
}
