# Fabrica de guias — estado y reglas aprendidas

## Estado

| Guia | Version | Estado |
|---|---|---|
| **Alumno** (`Guia-Alumno-Modula22.pdf`) | **v1 · julio 2026** | ✅ APROBADA por Axel (commit `9e83f2a`). No se retoca sin pedirlo. |
| Gestor | — | En guion (`guion-guia-gestor.md`) |
| Administracion | — | Pendiente |

Regenerar la del alumno: `node docs/guias/capturar-alumno.mjs` (portal dev
corriendo) y luego `node docs/guias/generar-guia-alumno.mjs`.

## Reglas aprendidas (8 rondas de retroalimentacion — NO repetir errores)

**Identidad**
1. TODO en **Poppins** (incrustada, `fuentes/`). Nada de serif ajena: la
   identidad es nuestra, no la del manual de referencia de otro producto.
2. **Cero emojis del sistema** — se ven distintos por aparato y baratos.
   Iconos PROPIOS en SVG con trazo lucide (funcion `icono()` del generador).
3. **Nada de precios impresos**: la guia se publica y el costo vigente vive
   en el portal.
4. Sin acentos ni enye en nombres de archivo (regla 7 de CLAUDE.md); el
   contenido en espanol correcto.

**Imagenes**
5. **Lamina propia > screenshot.** Se dibuja con el estilo del portal todo lo
   que no se fotografia perfecto. Captura real SOLO si la tarjeta se lee
   completa y nitida. Nunca zoom, nunca recortes "quebrados", nunca una foto
   vertical junto a una lamina horizontal.
6. En pantallas de identidad (login), la lamina va **calcada de la pantalla
   real** — si no se parece, la persona duda de estar en el sitio correcto.
7. Toda imagen lleva **marco blanco + pie de foto** con punto dorado. Las de
   ejemplo dicen "Ejemplo:" en el pie.
8. Preferir horizontal. Telefono a columna solo si la pantalla real aporta.

**Maquetacion**
9. Cada pagina es una lamina fija de 216x279 mm: el diseno decide el corte.
   SIEMPRE revisar render por render que nada pise el folio del pie.
10. Kickers dorados en versalitas; citas con borde dorado; "OJO" en guinda
    (sin triangulo); portada oscura editorial con fecha de version GRANDE.

**Contenido**
11. La ventana estricta aplica a la INSCRIPCION; el pago corre con el
    vencimiento de su ficha (7 dias).
12. El **pase QR no esta activado**: no se menciona.
13. Fechas de calendario solo como tabla-EJEMPLO, marcada como ejemplo.
14. Avisos sobre el gestor: sobrios, al pie del paso que aplica. Nada de
    paneles con tono de hype.
15. El camino en 4 (o 5) pasos abre la guia; el anexo cierra con lista de
    cotejo imprimible.

**Proceso**
16. Todo regenerable por comando; las capturas no se retocan a mano.
17. Cada version se revisa pagina por pagina (pdf a PNG con
    `pdf2png2.mjs` del scratchpad) ANTES de enviarla.
