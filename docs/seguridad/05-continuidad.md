# Módula 22 — Estrategia de ciberseguridad
## Parte 5: continuidad y recuperación

> Última actualización: 2026-07-18.
> Contiene la respuesta a **P0-10**, el hallazgo de mayor riesgo de la auditoría.

---

## 0. Actualización 2026-07-18: ya existe un respaldo

Se construyó `lib/db/respaldo.mjs` y **se ejecutó**: 3,762 filas de 67 tablas y
las 60 secuencias, comprimido y cifrado (AES-256-GCM), **verificado
descifrando el archivo y contando fila por fila**. Vive fuera del repositorio y
está bloqueado en `.gitignore` por si acaso.

Dato que reubica la urgencia: **la base pesa 17 MB y tiene 7 estudiantes.**
Todavía es un sistema pre-producción con datos de prueba. Lo que faltaba no era
*este* respaldo — era la **capacidad** de respaldar, y eso es lo que ahora
existe y se puede repetir con un comando.

**2026-07-20: la restauración se probó de verdad y funciona.** Base desechable,
esquema aplicado, 3,783 filas y 60 secuencias restauradas, y verificado que la
base resultante es OPERABLE —no sólo que los datos están—: las secuencias no
colisionan, la integridad referencial se sostiene y `unaccent` funciona.
**Tiempo total medido: ~1.5 minutos.** Procedimiento en
[runbook-restauracion.md](runbook-restauracion.md), con tres hallazgos que sólo
aparecieron al ejecutarlo.

Sigue pendiente de la infraestructura (§ siguientes): automatizarlo y sacarlo del
equipo local. Este script no sustituye a
`pg_dump` ni a los respaldos de RDS: no guarda el esquema ni los archivos
subidos. Es la red mínima mientras llega lo demás.

---

## 1. El punto de partida que motivó esto

**No existía ninguna estrategia de respaldo.** Búsqueda exhaustiva de
`backup|dump|restore|snapshot|pg_dump` en todo el repositorio: un solo
resultado, y es un comentario.

- Sin script de respaldo, ni programado ni manual
- Sin procedimiento de restauración, sin RTO ni RPO
- **Nunca se ha probado restaurar**
- Los archivos —expedientes, fotografías, comprobantes— tampoco

La única red hoy es el PITR de Neon: es del proveedor, tiene ventana limitada
según el plan, y **desaparece el día de la migración** si no se reemplaza.

Todo lo demás en esta estrategia protege contra un atacante. Esto protege contra
algo más probable: **un error, un dedo equivocado, un `DELETE` sin `WHERE`**.

---

## 2. Módula 22 no es igual de crítico todos los días

Aquí está la particularidad que debe ordenar el diseño, y que un plan genérico
pasaría por alto.

El calendario oficial son **8 etapas al año**, cada una con una ventana de
solicitud de **4 o 5 días**, y el sistema aplica **candado estricto**: fuera de
esa ventana no se puede inscribir ni pagar, ni antes ni después.

| Clave | Solicitud | Examen |
|---|---|---|
| 2605-A | Abr 13–17 | May 9/10 |
| 2605-B | Abr 27–30 | May 23/24 |
| … | *(4–5 días cada una)* | *(~1 mes después)* |
| 2608-B | Jul 27–31 | Ago 22/23 |

### Consecuencia

Una caída de 24 horas **no cuesta lo mismo** según cuándo ocurra:

- **Un martes cualquiera entre etapas:** molesta. Nadie pierde nada irreversible.
- **Durante la ventana de solicitud:** se pierde **un quinto de la capacidad de
  inscripción de esa etapa**. Y como el candado es estricto, esos alumnos **no
  pueden recuperar el tiempo**: esperan dos semanas a la siguiente etapa, o
  pierden el ciclo.
- **El día del examen:** si falla la verificación del pase o de la credencial,
  hay gente **en la puerta de la sede** que no puede entrar.

Son unos **56 días al año de criticidad máxima** —8 ventanas de 5 días más 16
días de examen—, alrededor del 15% del tiempo. El resto es tolerante.

### RTO y RPO por fase, no un número único

| Fase | RTO | RPO | Por qué |
|---|---|---|---|
| **Ventana de solicitud** (8×5 días) | **≤ 1 hora** | ≤ 5 min | Daño irreversible: la ventana cierra |
| **Día de examen** (16 días) | **≤ 30 min** | ≤ 5 min | Hay personas esperando en la sede |
| **Resto del año** | ≤ 8 horas | ≤ 1 hora | Molesto, no irreversible |

Esto tiene una consecuencia práctica importante: **no hay que pagar
disponibilidad extrema los 365 días**. Se puede tener una postura reforzada
—guardia, ensayo previo, congelamiento de cambios— sólo en esos 56 días. Es más
barato y más honesto que prometer 99.99% todo el año y no cumplirlo.

> **Congelamiento de cambios:** nada se despliega durante una ventana de
> solicitud ni el día previo a un examen, salvo corrección de un fallo activo.
> Es el control más barato de todos y evita la causa más común de caída: el
> cambio propio.

---

## 3. La contingencia que no es técnica

Si el sistema cae el último día de la ventana de solicitud, la pregunta no es
sólo "¿cuándo vuelve?" sino **"¿se extiende la ventana?"**.

Y eso **no lo puede decidir quien esté restaurando el servidor**: las fechas
están publicadas en una convocatoria oficial. Modificarlas tiene efectos
administrativos y legales.

**Hay que resolverlo antes, por escrito:**

- ¿Quién tiene autoridad para autorizar una prórroga?
- ¿Cómo se comunica a los alumnos y a los gestores?
- ¿Hay un criterio previo — por ejemplo, "caída de más de 4 horas dentro de la
  ventana justifica prórroga automática de un día hábil"?

Sin ese criterio acordado de antemano, el sistema volverá en dos horas y la
decisión administrativa tardará dos días. **El tiempo de recuperación real es el
mayor de los dos.**

---

## 4. Qué hay que respaldar (no es sólo la base)

Restaurar "la base de datos" no restaura Módula 22. Hacen falta **cuatro cosas**,
y si falta una, el sistema no funciona:

| Pieza | Sin ella | Cómo se respalda |
|---|---|---|
| **Base de datos** | No hay nada | RDS: PITR + snapshots + copia entre regiones |
| **Archivos** (expedientes, fotos, comprobantes) | Expedientes vacíos: los alumnos no pueden inscribirse | S3 con versionado + replicación |
| **Secretos** | El servidor no arranca (`config/env.ts` es *fail-closed*) | Secrets Manager, con copia bajo custodia |
| **Configuración** (DNS, certificados, red) | Nadie llega al sistema | Infraestructura como código, versionada |

> ⚠️ **La trampa de restaurar la base a un punto anterior.** Si se restaura la
> base al momento T pero el almacenamiento siguió avanzando, quedan
> inconsistencias: filas que apuntan a archivos borrados después de T, y archivos
> sin fila. Por eso el **versionado de S3 es obligatorio** y **nunca debe haber
> borrado definitivo inmediato**: con versionado, una fila restaurada siempre
> encuentra su archivo.

### El paso obligatorio que hoy es conocimiento tribal

`lib/db/verificar-secuencias.mjs` **debe ejecutarse después de cada
restauración**. Si no, las secuencias quedan por debajo del máximo id, el
`INSERT` reutiliza un id, choca contra `UNIQUE(folio)` y **deja de emitirse
cualquier ficha de pago**.

Hoy eso vive en la cabeza de quien lo descubrió. Va en el runbook, en negritas,
como paso numerado. Un procedimiento de recuperación que depende de que una
persona concreta esté disponible **no es un procedimiento**.

---

## 5. Ransomware: por qué los respaldos normales no bastan

El ataque moderno no cifra y pide rescate: **primero borra los respaldos**, y
después cifra. Si los respaldos son accesibles con las mismas credenciales que
todo lo demás, se pierden con todo lo demás.

Por eso, en la Parte 2:

- **Backup Vault con Vault Lock** — retención inmutable, que **ni el
  administrador raíz de AWS puede acortar**
- **S3 Object Lock** en modo *compliance* sobre bitácoras exportadas
- Copia **entre regiones**, con credenciales distintas
- Versionado de S3 activado, sin borrado definitivo inmediato

La regla que resume todo: **debe existir al menos una copia que la propia
plataforma no pueda destruir**, ni por fallo ni por compromiso ni por error
humano.

---

## 6. Probarlo, o no cuenta

**Un respaldo no verificado no es un respaldo: es una carpeta con esperanza.**

### Restauración de prueba trimestral

Cronometrada, en un entorno aparte, con un runbook escrito, y ejecutada **por
alguien que no lo escribió** — es la única forma de detectar los pasos que el
autor daba por obvios.

Lista de verificación:

1. ¿Cuánto tardó de verdad? Comparar contra el RTO comprometido
2. ¿Se ejecutó `verificar-secuencias.mjs`?
3. ¿Los expedientes se abren? *(prueba real: descargar 10 documentos al azar)*
4. ¿Se puede emitir una ficha de pago nueva sin colisión de folio?
5. ¿La bitácora sobrevivió íntegra?
6. ¿Cuántos datos se perdieron? Comparar contra el RPO

Los resultados se anotan. **Si el tiempo medido supera el RTO comprometido, el
RTO está mal y hay que corregir el plan o la arquitectura** — no maquillar el
número.

### Antes de la migración

La **fase 0** de la Parte 2 no es simbólica: hay que tener un respaldo verificado
y restaurable **antes de mover un solo dato**. El momento de mayor riesgo de
pérdida total es precisamente la migración.

---

## 7. Modo degradado: servir algo en vez de nada

Cuando el sistema no está completo, hay opciones intermedias entre "todo
funciona" y "página de error":

| Situación | Modo degradado |
|---|---|
| Base de lectura disponible, escritura no | **Sólo lectura**: se consulta expediente y calificaciones; no se inscribe. Aviso claro |
| Sistema caído en ventana de solicitud | Página estática con las fechas, el criterio de prórroga y el canal de contacto |
| Almacenamiento caído | El resto funciona; sólo se bloquea subir y descargar documentos |
| Correo caído | Encolar y reintentar; **avisar en pantalla** que el correo puede tardar |

La peor experiencia no es que el sistema esté caído: es que **parezca
funcionar** y falle en silencio. Hoy el flujo de recuperación de contraseña hace
exactamente eso — si el correo está caído, el usuario ve "revisa tu correo" y no
llega nada, y nadie se entera.

---

## 8. Dependencias de terceros

Módula 22 no está solo. Si estos fallan, algo deja de funcionar:

| Dependencia | Qué se cae | Plan |
|---|---|---|
| Proveedor de correo (Resend) | Altas, verificación, recuperación, avisos | Cola con reintentos + proveedor alterno configurado |
| Tesorería del Estado | No hay líneas de captura nuevas | Es externo: definir a quién se escala y qué se le dice al alumno |
| SEP-DGB (matrículas) | No llegan matrículas oficiales | Externo: el alumno opera con folio mientras tanto |
| AWS (región) | Todo | Copia entre regiones; asumir RTO alto y comunicarlo |

Para los externos, lo que se puede controlar **no es el arreglo sino el mensaje**:
que el alumno sepa que el trámite está detenido por una causa ajena y qué pasa
con su fecha límite.

---

## 9. La dependencia más frágil es una persona

Pregunta incómoda: **si hoy hay una pérdida de datos y la persona que conoce el
sistema no está disponible, ¿alguien más puede restaurarlo?**

Hoy la respuesta es no. Y eso es un riesgo de continuidad tan real como un
incendio en el centro de datos — con la diferencia de que es mucho más probable.

Mitigación, en orden de esfuerzo:

1. **Runbook escrito** con nivel de detalle de "alguien más lo ejecuta", no de recordatorio
2. **Credenciales de emergencia** bajo custodia (Parte 3, §2)
3. **Una segunda persona** que haya ejecutado la restauración de prueba **al menos una vez**
4. Contacto de soporte de AWS con plan que incluya respuesta en incidentes

El punto 3 es el que de verdad reduce el riesgo, y el que más se pospone.

---

## 10. Orden de implantación

| # | Acción | Cuándo | Cierra |
|---|---|---|---|
| 1 | **Respaldo verificado de lo que hay hoy** | **Antes de tocar nada** | **P0-10** |
| 2 | Runbook de restauración, con `verificar-secuencias` | Semana 1 | Conocimiento tribal |
| 3 | Definir RTO/RPO por fase y acordarlos | Semana 1 (no técnico) | Expectativas |
| 4 | **Criterio de prórroga de ventana, autorizado** | Semana 1 (no técnico) | §3 |
| 5 | RDS con PITR + copia entre regiones | Con la migración | Pérdida total |
| 6 | S3 con versionado + Object Lock + Vault Lock | Con la migración | Ransomware |
| 7 | Congelamiento de cambios en los 56 días críticos | Inmediato (proceso) | Caídas autoinfligidas |
| 8 | Primera restauración de prueba cronometrada | Tras migrar | Que el plan sea real |
| 9 | Segunda persona capacitada en restaurar | Trimestre 1 | §9 |
| 10 | Modos degradados | Mejora continua | Fallo silencioso |

Los puntos **1, 3, 4 y 7 no requieren AWS ni código**, y son los que más reducen
el riesgo por unidad de esfuerzo. El 1 se puede hacer hoy: un volcado cifrado,
guardado fuera de la plataforma, y una prueba de que se puede leer.
