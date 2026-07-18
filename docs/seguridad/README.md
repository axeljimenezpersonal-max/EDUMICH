# Estrategia de ciberseguridad — Módula 22

Elaborada el 18 de julio de 2026, previa a la migración a AWS.

Módula 22 custodia, cada año, el acta de nacimiento, la CURP, el domicilio y la
fotografía de más de veinte mil personas, muchas de ellas menores de edad. El
IEMSyS es **sujeto obligado** de la **LGPDPPSO**, así que además de proteger los
datos hay que **poder demostrarlo**.

Estos siete documentos son, en conjunto, la base del **Documento de Seguridad**
que exige el Art. 29.

| Parte | Documento | Qué contiene |
|---|---|---|
| 0 | [Marco y amenazas](00-marco-y-amenazas.md) | Obligaciones legales, nivel de riesgo (Art. 26), adversarios y rutas de ataque |
| 1 | [Hallazgos](01-hallazgos-auditoria.md) 🔒 | Estado actual por capas, con severidad |
| 2 | [Arquitectura AWS](02-arquitectura-aws.md) | Red, respaldos, bitácora inmutable, detección |
| 3 | [Identidad y acceso](03-identidad-y-acceso.md) | MFA, sesiones, contraseñas, mínimo privilegio |
| 4 | [Detección y respuesta](04-deteccion-y-respuesta.md) | Qué auditar, alertas, plan de incidentes, Arts. 32-35 |
| 5 | [Continuidad](05-continuidad.md) | Respaldos, RTO/RPO por fase del calendario, recuperación |
| 6 | [Personas y proceso](06-personas-y-proceso.md) | Residencia de datos, encargados, capacitación, cultura |
| 7 | [**Hoja de ruta**](07-hoja-de-ruta.md) | **Empezar por aquí.** Secuencia priorizada y armado del Art. 29 |

## Por dónde empezar

Lee la **Parte 7**. Trae la lista de las diez acciones con mejor relación entre
riesgo evitado y esfuerzo — cuatro de ellas no son programación, sino decidir y
escribir.

## 🔒 Confidencialidad

La **Parte 1** describe debilidades explotables de un sistema en producción. No
publicar, no adjuntar a correos externos, no subir a repositorios públicos. Su
lugar es el expediente del Documento de Seguridad, con acceso restringido.
