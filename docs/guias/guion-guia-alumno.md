# Guion — Guía del Alumno (PDF)

Fase 1 de la fábrica de guías. Este archivo es el **guion aprobable**: qué
capítulos lleva la guía, qué captura ilustra cada paso y qué advertencias van
en recuadro. La redacción final vive en la plantilla HTML (fase 3); aquí se
decide la estructura.

**Fuente:** los tours en pantalla ya validados (`steps.ts` +
`seccionesEstudiante.ts`). La guía no inventa contenido: lo traduce a papel.

**Criterios de redacción (alumno):**
- Una acción por paso, en imperativo: "Toca **Expediente**", "Sube tu CURP".
- Cada paso con su foto al lado. Capturas de **vista de teléfono** (así lo usa
  la mayoría), datos 100 % ficticios (modo demo).
- Recuadros "⚠️ Ojo" SOLO para lo que puede salir mal de verdad.
- Letra grande: se leerá impresa o en pantallas chicas.

---

## Estructura de capítulos

### Portada
Modula · Plan 22 — "Guía del estudiante" — Preparatoria Abierta · IEMSyS ·
Gobierno de Michoacán. Fecha de versión GRANDE (una guía impresa vieja debe
delatarse sola).

### Cómo usar esta guía (media página)
El camino son 4 pasos: Expediente → Inscripción → Pago → Resultados. Diagrama
del camino (la misma idea del tour `caminoAlumno`). "Si tienes centro de
asesoría, ellos te acompañan en los pasos 2 y 3" — remite al recuadro del cap. 4.

### Cap. 1 — Tu primer ingreso
| Paso | Captura |
|---|---|
| El correo con tus credenciales (qué llega y de parte de quién) | maqueta del correo |
| Entrar a prepa.modula22.mx e iniciar sesión (ojo del password) | `/login` |
| Cambiar tu contraseña temporal | `/estudiante/cambiar-password` |
| Si la olvidas: recuperar contraseña | `/recuperar-password` |

⚠️ Ojo: la contraseña temporal solo sirve una vez; el enlace de recuperación
caduca en 1 hora.

### Cap. 2 — Conoce tu portal (2 páginas)
Captura del Inicio con el menú señalizado (números sobre la foto). Qué es cada
sección en una línea — mismo orden del tour. El botón (?) reinicia el tutorial
en pantalla.

### Cap. 3 — Paso 1: Tu expediente
| Paso | Captura |
|---|---|
| Los 5 documentos + foto: cuáles son y en qué formato | `/estudiante/expediente` |
| Cómo subir un documento (botón, elegir archivo, confirmar) | modal de subida |
| Estados: en revisión / aprobado / rechazado (y qué hacer si rechazan) | chips de estado |
| Tu matrícula: te la asigna la administración cuando todo está aprobado | bloque matrícula |
| Tu credencial digital aparece al estar completo | `/estudiante/identificacion` |

⚠️ Ojo: sin expediente completo NO hay inscripción. Es lo primero.

### Cap. 4 — Paso 2: Inscríbete a tus exámenes
| Paso | Captura |
|---|---|
| La ventana de inscripción: fechas exactas y cuenta regresiva | bloque convocatoria abierta |
| Elige tus módulos (hasta 4) y confirma | lista de módulos |
| Elige tu sede (si hay varias) — es la misma para todos tus módulos | selector de sede |
| Tus exámenes inscritos y su estado | bloque exámenes |

⚠️ Ojo (recuadro grande): **la ventana es estricta**. Son 4–5 días; fuera de
ellos no se puede inscribir ni pagar. El calendario (cap. 8) te dice cuándo.

🤝 Recuadro "¿Tienes centro de asesoría?": tu gestor te inscribe y paga por
ti; en tu portal solo consultas. Aparecen sus datos de contacto en Inscripción.

### Cap. 5 — Paso 3: Paga tu examen
| Paso | Captura |
|---|---|
| Cuánto cuesta: $131 por examen | resumen de pagos |
| Solicita tu orden de pago | botón solicitar |
| Te llega la línea de captura: cópiala y paga (banco/tienda/en línea) | orden emitida |
| Sube tu comprobante en el mismo bloque | subir comprobante |
| La coordinación confirma → quedas listo | estado confirmado |

⚠️ Ojo: la ficha **vence a los 7 días** de emitida. Solo lo pagado se
califica.

### Cap. 6 — El día del examen
| Paso | Captura |
|---|---|
| Descarga tu pase con código QR (en ID) | pase de examen |
| Qué llevar: pase + identificación | — |
| Tu sede: dirección y mapa | bloque sede |

### Cap. 7 — Paso 4: Tus resultados
| Paso | Captura |
|---|---|
| Calificaciones por módulo; se aprueba con 60 | `/estudiante/calificaciones` |
| Tu avance: X de 22 módulos, tu promedio | barra de avance |
| Descarga tu historial en PDF | botón descargar |

### Cap. 8 — Herramientas que te ayudan
- **Pruebas**: evaluaciones de práctica; no cuentan para calificación (captura).
- **Calendario**: los colores — morado = día de examen, rosa = ventana de
  inscripción (captura con la leyenda nueva).
- **Preguntas frecuentes**: busca tu duda antes de llamar (captura).
- **Mi aula**: solo si tu centro la activó; con candado = no activada (captura).

### Cap. 9 — ¿Necesitas ayuda?
Teléfono de atención (el de Datos institucionales) + horario. Con gestor: su
contacto primero.

### Anexo — Lista de cotejo de una etapa (1 página imprimible)
☐ Expediente completo → ☐ Me inscribí dentro de la ventana → ☐ Pagué antes del
vencimiento → ☐ Subí comprobante → ☐ Descargué mi pase → ☐ Presenté → ☐ Vi mi
calificación.

---

## Cobertura del modo demo (para la fase 2)

Ya cubiertas: dashboard, avisos, contactos, expediente, convocatoria,
config-pago, modulos, mi-identificacion.

Por agregar a `lib/demo.ts` (solo frontend, sin riesgo):
- calificaciones (para cap. 7)
- calendario / anuncios de etapas (cap. 8)
- pagos con una orden en cada estado (cap. 5: solicitada → emitida → pagada → confirmada)
- pase de examen con QR de mentira (cap. 6)
- FAQ (cap. 8)

Pantallas públicas (login, recuperar) no necesitan demo: no requieren sesión.

## Decisiones tomadas (cambiables)
- Capturas en vista de teléfono (390 px), 2 por fila en el PDF.
- Tamaño carta, portada guinda, tipografía del portal.
- Archivo: `Guia-Alumno-Modula22.pdf` (ASCII, regla 7).
- El PDF se regenera con un solo comando; las capturas no se retocan a mano.
