# Módula 22 — Estrategia de ciberseguridad
## Parte 0: marco normativo y modelo de amenazas

> Documento vivo. Base para la migración a AWS.
> Última actualización: 2026-07-18.

---

## 1. Por qué esto no es un checklist técnico

Módula 22 lo opera el **IEMSyS**, un organismo del gobierno de Michoacán. Eso lo
convierte en **sujeto obligado** de la Ley General de Protección de Datos
Personales en Posesión de Sujetos Obligados (**LGPDPPSO**, última reforma DOF
14-11-2025). No aplica la ley de particulares (LFPDPPP): aplica la general, que
es más exigente y trae obligaciones **documentales**, no sólo técnicas.

La diferencia práctica: no basta con que la plataforma sea segura. La ley obliga
a **poder demostrar** que lo es, con artefactos concretos que hoy no existen.

### Lo que la ley obliga a tener (y hoy falta)

| Artículo | Obligación | Estado |
|---|---|---|
| **Art. 28** | Las acciones de seguridad deben estar **documentadas en un sistema de gestión** | ❌ No existe |
| **Art. 29** | **Documento de Seguridad** con 7 contenidos mínimos (ver abajo) | ❌ No existe |
| **Art. 30** | Actualizarlo ante cambios de riesgo, mejora continua o tras una vulneración | ❌ No aplica aún |
| **Art. 33** | **Bitácora de vulneraciones**: descripción, fecha, motivo y acciones correctivas | ❌ No existe |
| **Art. 34** | Informar **sin dilación alguna** al titular y a las autoridades garantes | ❌ Sin procedimiento |
| **Art. 35** | Contenido mínimo del aviso al titular afectado (5 puntos) | ❌ Sin plantilla |
| **Art. 36** | Controles de **confidencialidad** para todo el que trate datos, que **subsisten tras terminar la relación** | ❌ Sin convenios |

El **Documento de Seguridad** (Art. 29) debe contener al menos:

1. Inventario de datos personales y de los sistemas de tratamiento
2. Funciones y obligaciones de quienes tratan datos personales
3. Análisis de riesgos
4. Análisis de brecha
5. Plan de trabajo
6. Mecanismos de monitoreo y revisión de las medidas
7. Programa general de capacitación

**Esto es exactamente el entregable de esta estrategia.** No es burocracia
paralela al trabajo técnico: es su envoltorio obligatorio. Si se hace bien, la
migración a AWS produce de paso el Documento de Seguridad.

> Nota sobre la autoridad garante: la reforma de 2025 reestructuró el esquema
> (el texto vigente habla de "la Secretaría y las Autoridades garantes"). A
> nivel estatal el garante es el **IMAIP** (Michoacán). Conviene **confirmar con
> la Unidad de Transparencia del IEMSyS** a quién se notifica hoy una
> vulneración, antes de necesitarlo de urgencia.

---

## 2. Qué nivel de seguridad exige la ley aquí

El **Art. 26** enumera los factores que determinan qué tan fuertes deben ser las
medidas. No es opcional ni subjetivo: se evalúan y se documentan. Aplicados a
Módula 22:

| Factor (Art. 26) | Situación de Módula 22 | Nivel |
|---|---|---|
| I. Riesgo inherente | Documentos de identidad completos | **Alto** |
| II. Sensibilidad de los datos | Acta de nacimiento, CURP, domicilio, **fotografía**; hay **menores de edad** | **Alto** |
| III. Desarrollo tecnológico | Plataforma web pública en internet | Medio |
| IV. Consecuencias de una vulneración | **Robo de identidad** consumado, no un inconveniente | **Muy alto** |
| V. Transferencias | SEP-DGB, Tesorería del Estado, correo, (futuro) AWS | **Alto** |
| VI. Número de titulares | ~1,700 nuevos/mes → **>20,000/año**, acumulativo | **Alto** |
| VII. Vulneraciones previas | Sin incidentes conocidos | Bajo |
| VIII. **Valor para un tercero no autorizado** | Ver abajo | **Muy alto** |

### El factor VIII es el que define todo

La ley pregunta cuánto vale el dato para quien lo robe. Y aquí la respuesta es
incómoda: Módula 22 no guarda "datos de alumnos". Guarda, por cada persona y en
un solo lugar:

- Acta de nacimiento
- CURP
- Comprobante de domicilio
- Fotografía de rostro
- Certificado de estudios
- Nombre completo, teléfono y correo

Eso **no es un expediente escolar: es un kit completo de suplantación de
identidad**, listo para abrir cuentas, contratar créditos o tramitar documentos
oficiales a nombre de la víctima. Multiplicado por 20,000 personas al año, y con
menores incluidos, es un objetivo de valor real en el mercado negro — muy por
encima de lo que sugiere la frase "plataforma de preparatoria abierta".

**Conclusión normativa:** por los factores II, IV, VI y VIII, a Módula 22 le
corresponde el nivel de medidas **más alto** que contempla la ley. La ambición
de "seguridad tamaño SAT" no es exageración: es aproximadamente lo que el
Art. 26 exige cuando se cruzan esos factores.

---

## 3. Modelo de amenazas

Sin esto, cualquier lista de controles es decoración. La pregunta no es "¿qué
podría fallar?" sino "**¿quién nos quiere atacar, para qué, y por dónde entra?**".

### 3.1 La joya de la corona

Un solo activo concentra casi todo el riesgo:

> **El expediente digital del alumno** — los 5 documentos + la foto, y su
> vínculo con el nombre y la CURP.

Todo lo demás (calificaciones, pagos, credenciales) es recuperable o de bajo
valor para un tercero. El expediente **no se puede "cambiar como una
contraseña"**: un acta de nacimiento filtrada lo está para siempre.

Corolario de diseño: **la mayor parte del esfuerzo debe ir a proteger el acceso
a los archivos, no a la aplicación en abstracto.**

### 3.2 Adversarios, ordenados por probabilidad real

| # | Adversario | Motivación | Capacidad | Probabilidad |
|---|---|---|---|---|
| A1 | **Atacante oportunista automatizado** | Credenciales, minado, ransomware | Baja — escáneres masivos | **Muy alta** |
| A2 | **Insider con acceso legítimo** (gestor, admin operativo) | Curiosidad, venta de datos, favores | Media — ya está dentro | **Alta** |
| A3 | **Fraude de identidad organizado** | Robo del padrón para suplantación | Media-alta, dirigida | **Media** |
| A4 | **Alumno o gestor curioso** | Ver datos o notas de otros | Baja — manipula la interfaz | **Alta** |
| A5 | **Adversario político** | Filtrar/desprestigiar, tumbar el servicio en fecha clave | Media | **Media** |
| A6 | **Compromiso de proveedor** | Vía dependencia npm, correo, hosting | Alta | Baja-media |
| A7 | **Actor estatal / APT** | — | Alta | Muy baja |

**No optimizar para A7.** El error clásico de las estrategias de seguridad de
gobierno es diseñar contra el atacante de película e ignorar A2 y A4, que son
los que de verdad ocurren. La mayor parte del presupuesto de control debe ir a
**A1, A2 y A4**.

### 3.3 Rutas de ataque priorizadas

| Ruta | Adversario | Impacto | Estado del control |
|---|---|---|---|
| **R1.** Pedir el documento de otro alumno cambiando un id o el nombre del archivo | A2, A4 | **Catastrófico** — fuga masiva de expedientes | *En auditoría* |
| **R2.** Gestor consulta alumnos que no son suyos | A2 | Grave — fuga por municipio | Parcial: candado en `WHERE` por ruta, sin garantía central |
| **R3.** Cuenta administrativa comprometida (phishing, contraseña reutilizada) | A1, A3 | **Catastrófico** — acceso total | **Débil: no hay segundo factor** |
| **R4.** Usuario dado de baja conserva acceso | A2 | Grave | **Conocido y abierto: hasta 7 días** |
| **R5.** Exfiltración lenta vía exportaciones a Excel/PDF | A2, A3 | Grave y **silenciosa** | Sin límites ni alertas conocidas |
| **R6.** Enumeración del padrón por endpoints públicos | A3 | Medio | Parcial (límite de tasa) |
| **R7.** Fuerza bruta / relleno de credenciales | A1 | Medio-grave | Parcial (30/15min en login) |
| **R8.** Dependencia npm comprometida | A6 | Catastrófico | *En auditoría* |
| **R9.** Pérdida de datos sin respaldo probado | Ninguno (accidente) | **Catastrófico e irreversible** | *En auditoría* |
| **R10.** Denegación de servicio en cierre de convocatoria | A5 | Alto — daño reputacional y legal | Sin protección |

**R1, R3, R4 y R9 son las cuatro que quitarían el sueño.** Tres de ellas no se
arreglan con más código, sino con decisiones de arquitectura que **es mucho más
barato tomar durante la migración que después**.

### 3.4 La ventana de la migración

| Se decide durante la migración | Costo si se pospone |
|---|---|
| Dónde viven los archivos y quién los puede leer | Muy alto — hay que mover datos en producción |
| Cifrado en reposo y gestión de llaves | Muy alto — recifrar todo |
| Segmentación de red (¿la base es alcanzable desde internet?) | Alto |
| Identidad y permisos de la infraestructura | Alto |
| Bitácoras inmutables y su retención | Medio — se pierde el histórico anterior |
| Respaldos y su prueba de restauración | Medio |
| Segundo factor para cuentas administrativas | Bajo — se puede añadir después |

---

## 4. Cómo se estructura el resto de la estrategia

| Parte | Capa | Contenido |
|---|---|---|
| 0 | Marco y amenazas | *Este documento* |
| 1 | Identidad y acceso | Cuentas, MFA, sesiones, roles, mínimo privilegio, altas y bajas |
| 2 | Datos | Clasificación, cifrado, retención, borrado, respaldos, ARCO |
| 3 | Aplicación | Hallazgos de la auditoría de código + ciclo de desarrollo seguro |
| 4 | Infraestructura AWS | Red, cómputo, RDS, S3, KMS, IAM, WAF, secretos |
| 5 | Detección y respuesta | Bitácoras, alertas, plan de respuesta a incidentes, forense |
| 6 | Continuidad | RTO/RPO, recuperación ante desastre, pruebas de restauración |
| 7 | Personas y proceso | Capacitación (Art. 29 VII), confidencialidad (Art. 36), terceros |
| 8 | Hoja de ruta | Priorización, esfuerzo, secuencia respecto a la migración |

---

## Fuentes

- [LGPDPPSO — texto vigente, Cámara de Diputados (DOF 14-11-2025)](https://www.diputados.gob.mx/LeyesBiblio/pdf/LGPDPPSO.pdf)
- [Medidas de seguridad previstas por la LGPDPPSO — Secretaría Anticorrupción y Buen Gobierno](https://www.gob.mx/buengobierno/documentos/medidas-de-seguridad-previstas-por-la-lgpdppso)
- [Catálogo de Medidas de Seguridad — SCJN](https://datos-personales.scjn.gob.mx/sites/default/files/medidas-de-seguridad/Catalogo-Medidas-Seguridad.pdf)
