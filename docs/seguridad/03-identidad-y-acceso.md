# Módula 22 — Estrategia de ciberseguridad
## Parte 3: identidad y acceso

> Última actualización: 2026-07-18.
> Prerrequisito: [00-marco-y-amenazas.md](00-marco-y-amenazas.md).

---

## 1. Por qué esta capa importa más que ninguna otra

El modelo de amenazas dice que los adversarios más probables son **A2 (insider
con acceso legítimo)** y **A4 (usuario curioso)**. Ninguno de los dos "entra" al
sistema: **ya está dentro**. Contra ellos, los cortafuegos y el cifrado no hacen
nada. Lo único que actúa es quién puede hacer qué, por cuánto tiempo, y qué queda
registrado.

Y contiene la ruta **R3** —cuenta administrativa comprometida—, que sigue
abierta y es catastrófica: un administrador ve el padrón completo.

---

## 2. Segundo factor: quién sí y quién no

Aquí está la decisión más importante de esta capa, y la respuesta correcta **no
es "MFA para todos"**.

Módula 22 tendrá más de 20,000 alumnos al año, muchos en municipios rurales,
buena parte sin teléfono inteligente propio ni correo que revisen a diario.
Exigirles segundo factor produciría, con casi total certeza: bloqueos masivos en
la fecha de cierre de convocatoria, una avalancha de recuperaciones sobre la
Secretaría, y —lo peor— **presión para inventar atajos**, que es exactamente
como nacen bypasses como el `111111` que acabamos de cerrar.

La seguridad que la gente no puede usar no se aplica: se rodea.

### Segundo factor por nivel de riesgo

| Rol | ¿MFA? | Por qué |
|---|---|---|
| **Administración titular** | **Obligatorio** | Acceso total; puede dar de alta gestores y firmar cédulas |
| **Administración operativa** | **Obligatorio** | Ve el padrón completo. R3 se cierra aquí |
| **Creador / Synapsis** (rol `direccion`) | **Obligatorio** | Indicadores de todo el estado y salud del sistema |
| **Gestor** | **Obligatorio, con acompañamiento** | Cada gestor concentra los expedientes de decenas de alumnos: una cuenta comprometida es una fuga por municipio |
| **Alumno** | **No** | Ver §3: se protege con otros controles |

Son decenas de cuentas privilegiadas, no miles. **Es perfectamente operable.**

### Qué método

**TOTP (aplicación autenticadora), no SMS.** Razones concretas, no ideológicas:

- El SMS es vulnerable a **cambio de SIM**, que en México es un fraude común y
  barato.
- El SMS cuesta por mensaje y depende de un proveedor externo — otro tercero con
  el que habría que firmar convenio de confidencialidad (Art. 36).
- TOTP funciona **sin señal**, lo cual importa en sedes rurales el día del examen.

**Códigos de recuperación obligatorios** al darse de alta: 8 códigos de un solo
uso, mostrados una vez. Para gestores, además, la titular debe poder **reiniciar
el segundo factor** tras verificar identidad por un canal distinto — con ese
reinicio registrado en la bitácora como acción auditable.

> **Cuenta de emergencia:** una sola, con MFA propio, credenciales en sobre
> sellado bajo custodia física, y **alerta automática en cuanto se use**. Sin
> ella, un fallo del segundo factor deja a la Secretaría fuera de su propio
> sistema en plena convocatoria.

---

## 3. El alumno: proteger sin estorbar

Como no lleva segundo factor, los controles compensatorios tienen que ser reales.

### 3.1 La contraseña temporal de 5 dígitos

Hoy `generarCodigoTemporal()` produce **5 dígitos: 100,000 combinaciones**, sin
caducidad hasta el primer inicio de sesión. El único freno son 30 intentos por
IP cada 15 minutos — **no hay límite por cuenta**, así que con varias direcciones
el espacio se agota en minutos.

Lo revelador es que el sistema **ya sabe hacerlo bien**: `generarPasswordTemporal()`,
que se usa para gestores, produce `Aa-1234-bc` — unos 4,500 millones de
combinaciones. Es 45,000 veces más fuerte, y sigue siendo dictable por teléfono.

**Arreglo:** usar ese mismo generador para alumnos, y **caducar el código a 72
horas**. Si expira, el gestor lo reemite — flujo que ya existe.

### 3.2 Límite por cuenta, no sólo por IP

Es el control que de verdad para la fuerza bruta. Tras 10 intentos fallidos sobre
**la misma cuenta**, retardo creciente; tras 20, bloqueo temporal con aviso al
titular. Almacén compartido (ElastiCache), porque en memoria el límite se
multiplica por el número de instancias.

### 3.3 Política de contraseña: hoy está al revés

| Ruta | Exige | Quién pasa por ahí |
|---|---|---|
| `auth.ts:117` (cambio opcional en el perfil) | Mayúscula + número | Casi nadie |
| `estudiante.ts:551` (**cambio obligatorio de primer acceso**) | Sólo 8 caracteres | **Los ~1,700 al mes** |

La regla estricta está donde nadie pasa; la laxa, donde pasan todos. Acepta
`aaaaaaaa`.

**Arreglo, y va contra la intuición:** unificar en **12 caracteres mínimo, sin
exigir composición**, más una lista de bloqueo de las contraseñas más comunes y
de las derivadas de los datos del propio alumno (su CURP, su nombre, su
municipio). Las reglas de "una mayúscula y un número" producen `Password1!` —
predecible— mientras que la longitud es lo que realmente resiste. Es la guía
vigente del NIST y encaja mejor con población no técnica: una frase es más fácil
de recordar y más difícil de romper.

---

## 4. El ciclo de vida de la sesión

Hoy la sesión es una cookie firmada, sin estado, válida **7 días para todos por
igual**, y con dos consecuencias graves:

- **R4**: un usuario dado de baja conserva acceso hasta 7 días.
- **P1-21**: cambiar la contraseña **no cierra** las sesiones abiertas. Si te
  roban la cookie y haces lo correcto —cambiar tu contraseña—, el atacante sigue
  dentro una semana. El sistema castiga a quien intenta protegerse.

### 4.1 Revocación sin pagar una consulta por petición

Este hueco se difirió antes porque "añade una consulta por request". **No hace
falta.** El diseño:

1. Columna `users.sesiones_invalidadas_en` (marca de tiempo).
2. Se actualiza al cambiar contraseña, al reiniciar el segundo factor y **al
   desactivar la cuenta**.
3. La cookie ya lleva `iat`. La regla es: **si `iat` es anterior a
   `sesiones_invalidadas_en`, la cookie no vale.**
4. Para no consultar la base en cada petición, se mantiene en caché **sólo el
   conjunto de usuarios invalidados en los últimos 7 días** — que son unos pocos
   al día, no el padrón — refrescado cada 30-60 segundos.

Coste: unos kilobytes y una consulta por minuto. Resultado: la ventana de una
sesión revocada pasa de **7 días a un minuto**. Es una mejora de cuatro órdenes
de magnitud por un cambio pequeño, y cierra R4 y P1-21 con un solo mecanismo.

### 4.2 Duración según el riesgo

7 días para una cuenta administrativa es demasiado; para un alumno que entra
cada tres semanas a ver si salió su calificación, es razonable.

| Rol | Sesión | Inactividad |
|---|---|---|
| Administración y creador | **12 horas** | 30 min |
| Gestor | **3 días** | 8 horas |
| Alumno | 7 días | — |

---

## 5. Mínimo privilegio: dos huecos concretos

### 5.1 El administrador operativo puede tocar lo que no debe

La auditoría encontró que `datos-bancarios`, `integraciones`,
`plantillas-correo` y `datos-institucionales` están protegidos con
`requireRol('admin')`, **no** con `soloJefe`. Cualquier administrador operativo
puede modificar **datos bancarios e integraciones** (posibles secretos), aunque
el modelo de roles documentado diga que eso es de la titular.

El panel ya no muestra esas secciones — **pero el backend sigue aceptándolas**.
Ocultar un botón no es un control de acceso.

### 5.2 Cuentas compartidas

**Pregunta abierta para la Secretaría, y es importante:** ¿hay centros de
asesoría donde varias personas usan la misma cuenta de gestor? Es lo habitual en
oficinas de gobierno, y si ocurre:

- La bitácora deja de identificar a **una persona**, y pierde valor probatorio.
- El segundo factor se vuelve inoperable (¿en el teléfono de quién?).
- Cuando alguien se va, la credencial se queda.

Si existe, hay que resolverlo **antes** de implantar MFA, no después.

---

## 6. Altas, bajas y el Art. 36

La ley obliga (Art. 36) a que quienes traten datos personales **guarden
confidencialidad, y esa obligación subsiste después de terminar la relación**.
Eso exige proceso, no sólo código.

| Momento | Qué debe pasar | Estado |
|---|---|---|
| **Alta** | Convenio de confidencialidad firmado **antes** del primer acceso; alta de MFA; capacitación | ❌ No existe |
| **Cambio de puesto** | Revisar permisos; quitar los que ya no correspondan | ❌ No existe |
| **Baja** | Desactivar **el mismo día**, invalidar sesiones (§4.1), recuperar dispositivos, recordar por escrito que la confidencialidad sigue vigente | ⚠️ Parcial: desactivar hoy tarda 7 días en surtir efecto |

**Recertificación de accesos cada 6 meses:** la titular revisa y firma la lista
de quién tiene cuenta administrativa y de gestor. Es un control barato que caza
lo que ningún sistema detecta solo — la cuenta de quien se fue hace ocho meses.

Debe incluir también **quién tiene acceso directo a la base de datos y a la
consola de AWS**, que suele ser la lista más olvidada y la más peligrosa.

---

## 7. Orden de implantación

| # | Acción | Esfuerzo | Cierra |
|---|---|---|---|
| 1 | Revocación de sesión por `sesiones_invalidadas_en` | Medio | **R4, P1-21** |
| 2 | Contraseña temporal con entropía + caducidad 72 h | Bajo | **P1-20** |
| 3 | Límite de intentos **por cuenta** | Bajo | Fuerza bruta |
| 4 | `soloJefe` en datos bancarios e integraciones | **Muy bajo** | 5.1 |
| 5 | Política de contraseña unificada (12 caracteres) | Bajo | **P2-22** |
| 6 | Duración de sesión por rol | Bajo | Ventana de exposición |
| 7 | **MFA (TOTP) para admin, creador y gestor** | **Alto** | **R3** |
| 8 | Convenios de confidencialidad y proceso de baja | Medio (no técnico) | **Art. 36** |
| 9 | Recertificación semestral | Bajo (recurrente) | Cuentas huérfanas |

Los puntos 1 a 6 son código acotado y **se pueden hacer antes de migrar**. El 7
es el más caro y el que más cierra: conviene arrancarlo pronto, porque su cuello
de botella no es programar sino **acompañar a los gestores** en el alta.

El 8 no es técnico y por eso suele quedarse sin dueño — pero es obligación legal
expresa, y es lo primero que pide una revisión del órgano de control.
