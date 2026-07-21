# Módula 22 — Estrategia de ciberseguridad
## Parte 6: personas, terceros y proceso

> Última actualización: 2026-07-18.
> Cubre los Arts. 27-I/II, 29-II, 29-VII y 36 de la LGPDPPSO.

---

## 1. La capa que decide si todo lo demás funciona

Las partes 1 a 5 son controles. Esta parte es **quién los opera**, y sin ella los
demás se degradan solos: la alerta que nadie atiende, el respaldo que nadie
prueba, la cuenta que nadie da de baja.

Además, el modelo de amenazas dice que los adversarios más probables son **A2
(insider) y A4 (curioso)** — es decir, **personas con acceso legítimo**. Contra
ellos, esta capa *es* el control.

Y la ley la exige explícitamente: definir funciones y obligaciones (Arts. 27-II y
29-II), un programa general de capacitación (Art. 29-VII), y confidencialidad que
**subsiste tras terminar la relación** (Art. 36).

---

## 2. 🔴 Hallazgo nuevo: dónde se alojan los datos es una decisión legal

El **Art. 26-V** obliga a considerar *"las transferencias de datos personales que
se realicen"* al determinar las medidas de seguridad. Y alojar datos de personas
mexicanas —incluidos **menores de edad**— en servidores fuera del país constituye
una **transferencia internacional**, con requisitos adicionales.

> 🔴 **Hallazgo 2026-07-20: la transferencia ya está ocurriendo.**
> La base de producción vive hoy en **`us-east-2` (Ohio, Estados Unidos)**,
> verificado en la cadena de conexión. Es decir, los expedientes —acta, CURP,
> domicilio, fotografía, con menores incluidos— **ya están almacenados fuera de
> México**, sin que esa transferencia esté identificada ni fundamentada en
> ningún documento.
>
> Esto reencuadra la decisión: elegir `mx-central-1` no es *evitar* una
> transferencia futura, es **corregir una que ya existe**. Hoy el riesgo es
> acotado porque sólo hay cuentas de prueba; deja de serlo con el primer alumno
> real.

**Existe la región AWS México (Central), `mx-central-1`, con tres zonas de
disponibilidad.**

### Recomendación

**Desplegar en `mx-central-1`.** Razones, en orden de peso:

1. **Elimina la discusión jurídica de raíz.** Sin transferencia internacional, no
   hay que fundamentarla, documentarla ni defenderla ante el garante.
2. **Residencia de datos**, que es lo que un ente público debe poder afirmar
   sobre el padrón estudiantil de su estado.
3. Menor latencia para usuarios en Michoacán.
4. Es más fácil de explicar y defender políticamente: *"los datos de los
   michoacanos están en México"*.

> ⚠️ **Verificar antes de comprometerse:** las regiones nuevas no traen todos los
> servicios desde el día uno. Hay que confirmar en *AWS Services by Region* que
> estén disponibles **RDS PostgreSQL Multi-AZ, ECS Fargate, S3 con Object Lock,
> KMS, Secrets Manager, CloudTrail, GuardDuty y Backup con Vault Lock**. Si
> faltara alguno crítico, la decisión se vuelve un balance —y entonces hay que
> **documentar la transferencia internacional** como corresponde, no ignorarla.
>
> Para la **copia entre regiones** de la Parte 5, si `mx-central-1` es la
> principal, la secundaria debería ser otra región y **quedar documentada como
> transferencia**, aunque sea sólo de respaldos cifrados.

Esta decisión hay que tomarla **antes** de crear la infraestructura: mover
regiones después es rehacer la migración.

---

## 3. Quién responde por qué (Arts. 27-II y 29-II)

La ley pide que esto esté escrito. Propuesta a validar con el IEMSyS:

| Papel | Quién | Responsabilidad |
|---|---|---|
| **Responsable** (figura legal) | **IEMSyS** | Titular de las obligaciones ante la ley y el garante |
| **Unidad de Transparencia** | Área designada del IEMSyS | Atiende derechos ARCO; interlocutor con el garante; **destinatario de la notificación del Art. 34** |
| **Administración titular** | Titular del programa | Autoriza altas y bajas de gestores; aprueba accesos privilegiados |
| **Administración operativa** | Equipo | Opera el trámite. **Sin** acceso a datos bancarios ni integraciones |
| **Responsable técnico** | Quien desarrolla y opera | Controles técnicos, respaldos, respuesta a incidentes |
| **Gestor** | Por centro de asesoría | Trata datos de **sus** alumnos, y sólo de ellos |

**Lo que falta escribir**, y la ley lo pide como parte del Documento de Seguridad:
para cada papel, a qué datos accede, para qué finalidad, y qué **no** puede hacer.
Ese último punto es el que casi nunca se redacta y el que resuelve las dudas
reales.

> **Pregunta pendiente:** ¿quién es hoy formalmente la Unidad de Transparencia
> del IEMSyS, y su correo? En la memoria del proyecto figura
> `transparencia.iemsysem@michoacan.gob.mx` marcado como **intuido**. Ese dato
> aparece en el aviso de privacidad publicado: si está mal, hay un aviso público
> con un canal ARCO inválido — que es un incumplimiento en sí mismo.

---

## 4. Terceros: quién más toca los datos

Bajo la LGPDPPSO, quien trata datos personales por cuenta del responsable es un
**encargado**, y esa relación debe estar formalizada.

| Tercero | Qué datos toca | Formalizado |
|---|---|---|
| **AWS** (tras migrar) | **Todo**: base, expedientes, respaldos | ❓ Requiere aceptar el adendo de tratamiento de datos y archivarlo |
| **Resend** (correo) | Nombre y correo de todos; **contraseñas temporales en el cuerpo** | ❓ Sin constancia |
| **Neon** (hoy) | Todo | ❓ Sin constancia. Termina con la migración |
| **Railway** (hoy) | Todo | ❓ Sin constancia. Termina con la migración |

**Acción:** inventario de encargados, con el instrumento firmado o aceptado, la
finalidad, y qué pasa con los datos al terminar la relación. Va como anexo del
Documento de Seguridad.

> Detalle que suele pasarse por alto: **la migración es también una baja de
> encargados**. Hay que exigir a Neon y Railway constancia de eliminación de los
> datos, no sólo dejar de pagarles. Mientras no exista esa constancia, el padrón
> sigue en manos de terceros con los que ya no hay relación.

---

## 5. Programa de capacitación (Art. 29-VII)

Contenido mínimo del Documento de Seguridad. Debe ser **por papel**, no una
charla genérica anual.

### Gestor — el más importante

Es quien más datos personales toca y el que más lejos está del equipo técnico.

| Tema | Por qué |
|---|---|
| Qué es un dato personal sensible y por qué el expediente lo es | Sin esto, todo lo demás es abstracto |
| **Sólo se consultan expedientes de los propios alumnos** | Consultar de más **ya es una vulneración** (Art. 32-III), aunque no se saque nada |
| Nada de cuentas compartidas ni contraseñas prestadas | Rompe la trazabilidad y el segundo factor |
| Cómo reconocer un correo de suplantación | Con la clave de correo se puede escribir **como `@michoacan.gob.mx`** |
| Qué hacer si se equivocó, y a quién avisar | Ver §7 |
| No sacar el padrón a hojas de cálculo personales | La vía de fuga más común y más silenciosa |

### Administración

Lo anterior más: manejo de exportaciones (**quedan registradas**), criterio para
aprobar o rechazar documentos, uso del segundo factor y de los códigos de
recuperación, y qué hacer ante una alerta.

### Responsable técnico

Runbook de restauración, plan de respuesta a incidentes, manejo de secretos,
y el ciclo de desarrollo seguro (§6).

### Frecuencia y evidencia

Al ingresar (**antes del primer acceso**), y refuerzo anual. Con **constancia
firmada**: sin registro de quién se capacitó y cuándo, para la ley la
capacitación no ocurrió.

---

## 6. Proceso de cambios: una lección reciente

Durante esta misma auditoría pasó algo que ilustra el problema mejor que
cualquier teoría: **tres correcciones de seguridad acabaron dentro de un commit
ajeno**, porque otro proceso ejecutó `git add -A` mientras estaban en el árbol de
trabajo. El código llegó bien — pero quien audite ese commit no encontrará ahí
los arreglos que contiene.

Con despliegue automático a producción y **sin ninguna puerta de calidad**
(P1-4), eso significa que **lo que corre en producción no es necesariamente lo
que alguien revisó**. Para una plataforma de gobierno, esa trazabilidad es parte
del control, no una comodidad.

### Mínimo exigible

| Control | Por qué |
|---|---|
| Puerta de CI: typecheck + `pnpm audit --prod` + **búsqueda de marcadores prohibidos** | El bypass `111111` decía "QUITAR antes de producción" y se quedó. Un `grep` lo habría cazado el día uno |
| Un cambio, un commit, con su motivo | Trazabilidad |
| Revisión por segunda persona en lo que toca autenticación, permisos o datos personales | Los cuatro hallazgos críticos eran visibles leyendo |
| **Congelamiento** en los 56 días críticos (Parte 5) | El cambio propio es la causa más común de caída |
| Migraciones de esquema **versionadas y revisadas**, fuera del arranque | Hoy se aplican solas en cada reinicio, contra producción |

---

## 7. La cultura: que se pueda avisar de un error

Este es el control más barato del documento y el más difícil de instalar.

Si un gestor hace clic en un correo de suplantación y **teme el castigo**, no
avisa. Y las horas siguientes son justo las que deciden si el incidente se
contiene o se convierte en una fuga del padrón. Lo mismo con quien manda un
archivo al destinatario equivocado o sube el documento de otro alumno.

**Regla explícita, escrita y comunicada:**

> Avisar de inmediato de un posible incidente **nunca** tendrá consecuencia
> negativa para quien avisa, aunque el error haya sido suyo. Lo que sí tiene
> consecuencia es **ocultarlo**.

Necesita un canal claro —persona, teléfono, correo, y que funcione en fin de
semana— y que la primera vez que alguien lo use, **la respuesta confirme la
regla**. Una sola reacción punitiva la anula para siempre.

### Simulacro de suplantación

Dos veces al año, con correos realistas. **Sin señalar a nadie**: la métrica es
del sistema, no de la persona. Quien caiga recibe capacitación, no una
llamada de atención — porque el objetivo es que el día real avisen, no que
aprendan a esconderse.

Es especialmente pertinente aquí: R3 (cuenta administrativa comprometida) sigue
siendo la ruta abierta más grave, y la clave de correo permite escribir con
identidad gubernamental legítima contra el propio padrón.

---

## 8. Orden de implantación

| # | Acción | Esfuerzo | Cierra |
|---|---|---|---|
| 1 | **Decidir región AWS (`mx-central-1`)** y verificar servicios | Bajo, **urgente** | §2 · Art. 26-V |
| 2 | Confirmar Unidad de Transparencia y su correo real | Muy bajo | Canal ARCO válido |
| 3 | Inventario de encargados + adendos de tratamiento | Medio | §4 |
| 4 | Matriz de papeles: a qué accede cada uno y qué **no** puede | Medio | Arts. 27-II, 29-II |
| 5 | Convenios de confidencialidad firmados | Bajo | **Art. 36** |
| 6 | Puerta de CI con marcadores prohibidos | Bajo | P1-4 |
| 7 | Programa de capacitación con constancias | Medio | **Art. 29-VII** |
| 8 | Política de "avisar no se castiga", comunicada | Muy bajo | §7 |
| 9 | Constancia de eliminación de Neon y Railway | Bajo | §4 |
| 10 | Primer simulacro de suplantación | Bajo | R3 |

**El punto 1 es urgente** porque condiciona la arquitectura: cambiar de región
después es rehacer la migración. Los puntos 2, 5 y 8 cuestan casi nada y son de
los primeros que revisa un órgano de control.
