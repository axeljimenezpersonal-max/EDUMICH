# Módula 22 — Estrategia de ciberseguridad
## Parte 7: hoja de ruta y Documento de Seguridad

> Última actualización: 2026-07-18. **Documento de cierre.**
> Consolida las partes 0 a 6 en una sola secuencia priorizada.

---

## 1. Dónde estamos

La auditoría del 18 de julio de 2026 revisó cinco capas en paralelo. El
resultado, en una frase:

> **El código de aplicación está mejor de lo típico. Lo que falta son las capas
> que nadie construyó todavía: respaldos, detección y trazabilidad.**

### Lo que salió bien, y no es poco

- **No hay IDOR en los documentos de identidad.** Se trazaron extremo a extremo
  todas las rutas que sirven archivos. **R1 —la ruta catastrófica— está cerrada.**
- Sin SSRF, sin *path traversal*, sin `eval`, sin *prototype pollution*
- Ningún `sql.raw()` recibe datos de usuario
- `.env` ignorado y **cero secretos en todo el historial de git**
- Patrón *fail-closed* en `config/env.ts`
- Sesiones sin estado: escalan sin sticky sessions
- Reseteo de contraseña y verificación pública de credenciales: bien hechos

### Lo que ya se corrigió (18 de julio)

| Hallazgo | Riesgo que cerró |
|---|---|
| Bypass de verificación `111111` | Secuestro del correo de cualquier ciudadano |
| `EMAIL_MODE` *fail-open* | Repartía contraseñas temporales en la respuesta |
| `seed.ts` sobre producción | Un despiste dejaba admin con contraseña publicada |
| Comprobante sin filtro + `inline` | Ejecución de código en la sesión del admin |
| Hoja "Gráfica" sin sanear | Fórmula que corre en la máquina del funcionario |
| Material del aula con `javascript:` | Ejecución en la sesión del alumno |

### Lo que sigue abierto, por gravedad

| # | Qué | Por qué duele |
|---|---|---|
| **P0-10** | **Sin ningún respaldo** | Único riesgo del que no se vuelve |
| **P0-11** | El trabajo que borra cuentas corre a ciegas a las 3 AM | Destructivo + no observado + sin red |
| **P0-12** | No se registran accesos ni exportaciones | 7 de 8 preguntas forenses sin respuesta |
| **P0-13** | La bitácora es modificable | Sin valor probatorio |
| P1-21 | Cambiar la contraseña no cierra las sesiones | Castiga a quien se protege |
| P1-30 | El borrado ARCO no borra los archivos | **Incumplimiento legal** |
| R3 | Sin segundo factor en cuentas administrativas | Una cuenta = el padrón completo |

---

## 2. Si sólo se hacen diez cosas

Ordenadas por **riesgo evitado ÷ esfuerzo**. Si el tiempo se acaba, que sea
después de estas.

| # | Acción | Esfuerzo | Cuándo |
|---|---|---|---|
| 1 | **Respaldo cifrado, fuera de la plataforma, y verificar que se puede leer** | Horas | **Hoy** |
| 2 | **Decidir región `mx-central-1`** y verificar servicios | Horas | **Antes de crear nada** |
| 3 | Auditar inicios de sesión, fallos, firma inválida y **exportaciones** | 1-2 días | Esta semana |
| 4 | Modo de ensayo + alerta en el trabajo de depuración | 1 día | Esta semana |
| 5 | Confirmar el correo real de la Unidad de Transparencia | Minutos | **Hoy** |
| 6 | Revocación de sesión (`sesiones_invalidadas_en`) | 2-3 días | Antes de migrar |
| 7 | Contraseña temporal con entropía + límite por cuenta | 1 día | Antes de migrar |
| 8 | Puerta de CI: typecheck, `audit --prod`, marcadores prohibidos | 1 día | Antes de migrar |
| 9 | Usuario de base sin permiso de borrar la bitácora | Horas | Con la migración |
| 10 | Criterio de prórroga de ventana, autorizado por escrito | Horas | **Antes de la próxima etapa** |

Cuatro de las diez —1, 2, 5 y 10— **no son programación**: son decidir y
escribir. Y están entre las que más riesgo quitan.

---

## 3. Secuencia completa

### Fase 0 — Esta semana (no depende de AWS)

| Acción | Parte |
|---|---|
| Respaldo verificado de lo que existe hoy | 5 |
| Decidir región y verificar disponibilidad de servicios | 6 |
| Confirmar Unidad de Transparencia y canal ARCO | 6 |
| Criterio de prórroga de ventana | 5 |
| Política de "avisar no se castiga", comunicada | 6 |
| Auditar accesos y exportaciones | 4 |
| Modo de ensayo en depuración + alerta si no corre | 2 |
| Bitácora de vulneraciones + plantilla del Art. 35 | 4 |
| Plan de respuesta escrito, **con nombres y teléfonos** | 4 |
| Congelamiento de cambios en los 56 días críticos | 5 |

### Fase 1 — Antes de migrar

| Acción | Parte |
|---|---|
| Revocación de sesión | 3 |
| Contraseña temporal con entropía + caducidad | 3 |
| Límite de intentos **por cuenta** | 3 |
| `soloJefe` en datos bancarios e integraciones | 3 |
| Política de contraseña unificada (12 caracteres) | 3 |
| Duración de sesión por rol | 3 |
| Puerta de CI + marcadores prohibidos | 6 |
| `--frozen-lockfile`; revisar `pnpm rebuild` | 1 |
| Actualizar dependencias; evaluar `canvas` | 1 |
| Borrar el árbol legacy `prepa-michoacan/` | 1 |
| Corregir el borrado ARCO de archivos | 1 |
| Sacar los crons del proceso web | 2 |
| Rate limiter con almacén compartido | 2 |
| Healthcheck que compruebe la base | 2 |

### Fase 2 — Durante la migración

| Acción | Parte |
|---|---|
| Red: RDS aislada, sin acceso desde internet | 2 |
| KMS con llave propia; cifrado declarado en el código | 2 |
| Secrets Manager; **rotar las tres credenciales** | 2 · 1 |
| S3 + migración de archivos y de las rutas guardadas | 2 |
| **Tres usuarios de base separados por función** | 2 |
| Respaldos: PITR, snapshots, copia entre regiones, Vault Lock | 5 |
| Migraciones versionadas fuera del arranque | 1 |
| Contenedor: `USER node`, base por digest, multi-stage | 1 |
| Métricas a CloudWatch | 2 |
| Alertas A1-A10 | 4 |
| CloudTrail + GuardDuty | 2 |
| Constancia de eliminación de Neon y Railway | 6 |

### Fase 3 — Después

| Acción | Parte |
|---|---|
| **MFA (TOTP) para admin, creador y gestores** | 3 |
| Convenios de confidencialidad firmados | 6 |
| Programa de capacitación con constancias | 6 |
| Restauración de prueba cronometrada | 5 |
| Segunda persona capacitada en restaurar | 5 |
| CSP activada | 1 |
| Validación por *magic bytes* en subidas | 1 |
| Recertificación semestral de accesos | 3 |
| Simulacro de incidente y de suplantación | 4 · 6 |
| Bitácora con encadenamiento de hash | 2 |

---

## 4. El Documento de Seguridad (Art. 29)

La ley exige siete contenidos. **Esta estrategia ya produjo la mayor parte.** Lo
que falta es ensamblarlo y formalizarlo.

| Art. 29 | Contenido | Estado |
|---|---|---|
| **I** | Inventario de datos personales y sistemas de tratamiento | ⚠️ **Falta**. Es lo primero por escribir |
| **II** | Funciones y obligaciones de quienes tratan datos | 🟡 Propuesto en la Parte 6 §3. Falta validar y firmar |
| **III** | Análisis de riesgos | ✅ Parte 0 (modelo de amenazas + factores del Art. 26) |
| **IV** | Análisis de brecha | ✅ Parte 1 (hallazgos por capa) |
| **V** | Plan de trabajo | ✅ **Este documento** |
| **VI** | Mecanismos de monitoreo y revisión | ✅ Parte 4 §3 y §7 |
| **VII** | Programa general de capacitación | ✅ Parte 6 §5. Falta calendarizar |

### Lo que falta: el inventario (Art. 29-I)

Es el único contenido sin avance, y no es difícil — sólo nadie lo ha escrito.
Debe listar, por cada conjunto de datos:

- Qué datos se tratan *(nombre, CURP, domicilio, fotografía, acta, certificado…)*
- Con qué **finalidad** y bajo qué **fundamento legal**
- Dónde viven *(base, almacenamiento de archivos, respaldos, correo)*
- Quién accede y con qué papel
- Cuánto se conservan y cuándo se suprimen
- A quién se transfieren *(SEP-DGB, Tesorería, encargados)*

Debe cubrir también los **datos de gestores y personal**, que suelen olvidarse.

### Mantenerlo vivo (Art. 30)

Se actualiza cuando: cambia sustancialmente el tratamiento y con ello el nivel de
riesgo *(la migración a AWS **es** uno de esos casos)*, como resultado de mejora
continua, o **tras una vulneración**. La ley asume que se aprende del incidente y
pide constancia.

---

## 5. Riesgo residual: qué queda después de todo esto

Ninguna estrategia lleva el riesgo a cero, y decirlo es parte de ser serio.

| Riesgo | Por qué persiste | Mitigación |
|---|---|---|
| **Insider con acceso legítimo** | Un gestor necesita ver expedientes para trabajar | No se elimina: se **detecta** (alertas de exportación) y se **disuade** (bitácora creíble) |
| **CURP y datos en claro en la base** | El índice único y la búsqueda lo exigen | **Riesgo aceptado documentado**: cifrado en reposo, red aislada, permisos por función |
| Vulnerabilidad desconocida en una dependencia | 736 paquetes | Actualización, escaneo en CI, contención por red |
| Error humano con datos reales | Personas trabajando | Capacitación, cultura de aviso, respaldos |
| Fallo de AWS a nivel región | Fuera de control | Copia entre regiones; RTO alto asumido y comunicado |

El riesgo residual **se documenta y se acepta formalmente**, no se esconde. Eso
es exactamente lo que el Art. 26 pide: evaluar los factores y decidir con
conocimiento.

---

## 6. Qué depende de decisiones que no son técnicas

Recopilado de las siete partes. Nada de esto lo puede resolver quien programa:

1. **Región de despliegue** — condiciona la arquitectura entera
2. **Unidad de Transparencia**: quién es y su correo real *(hoy hay un aviso público con un canal posiblemente inválido)*
3. **A quién se notifica una vulneración** (Art. 34), confirmado antes de necesitarlo
4. **Retención de la bitácora** — propuesta: 12 meses en caliente + 5 años sellados
5. **Criterio de prórroga de ventana** y quién la autoriza
6. **¿Hay cuentas de gestor compartidas?** — cambia el plan de MFA
7. **Quién recibe las alertas**, con nombre, teléfono y suplente
8. **Adendos de tratamiento** con AWS y Resend; constancias de eliminación de Neon y Railway
9. **Convenios de confidencialidad** (Art. 36)
10. **Presupuesto y calendario**: qué fases entran antes de operar

---

## 7. Una última cosa

Esta plataforma va a custodiar, cada año, el acta de nacimiento, la CURP, el
domicilio y la fotografía de más de veinte mil personas — muchas de ellas
menores de edad. No es un sistema escolar: es un archivo de identidad.

La buena noticia de la auditoría es que **lo más difícil ya está bien hecho**. El
control de acceso entre usuarios —lo que más cuesta corregir después— está
sólido. Lo que falta son capas que se construyen una vez y se mantienen: saber
qué pasó, poder volver atrás, y que nadie tenga más acceso del que necesita.

Y hay una ventana para hacerlo barato: **la migración**. Después, cada uno de
estos controles cuesta tres veces más y exige mover datos en producción.

---

### Índice de la estrategia

| Parte | Documento |
|---|---|
| 0 | [Marco normativo y modelo de amenazas](00-marco-y-amenazas.md) |
| 1 | [Hallazgos de la auditoría](01-hallazgos-auditoria.md) 🔒 |
| 2 | [Arquitectura objetivo en AWS](02-arquitectura-aws.md) |
| 3 | [Identidad y acceso](03-identidad-y-acceso.md) |
| 4 | [Detección y respuesta a incidentes](04-deteccion-y-respuesta.md) |
| 5 | [Continuidad y recuperación](05-continuidad.md) |
| 6 | [Personas, terceros y proceso](06-personas-y-proceso.md) |
| 7 | Hoja de ruta *(este documento)* |

🔒 **La Parte 1 describe debilidades de un sistema en producción.** No publicar,
no adjuntar a correos externos. Su lugar es el expediente del Documento de
Seguridad, con acceso restringido.
