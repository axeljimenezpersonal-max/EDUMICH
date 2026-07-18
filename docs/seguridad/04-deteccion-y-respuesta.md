# Módula 22 — Estrategia de ciberseguridad
## Parte 4: detección y respuesta a incidentes

> Última actualización: 2026-07-18.
> Prerrequisitos: [00-marco-y-amenazas.md](00-marco-y-amenazas.md) ·
> [01-hallazgos-auditoria.md](01-hallazgos-auditoria.md)

---

## 1. La prueba honesta

Antes de proponer nada, la pregunta que importa. Si mañana llega un requerimiento
—del órgano de control, de un juez, o de una madre que dice que alguien usó los
datos de su hijo— hay que poder contestar esto:

| Pregunta | ¿Se puede contestar hoy? |
|---|---|
| ¿Quién entró a la cuenta de esta persona, y desde dónde? | ❌ **No.** El inicio de sesión no se registra |
| ¿Quién consultó el expediente de esta persona? | ❌ **No.** Leer no deja rastro |
| ¿Quién descargó el padrón completo, y cuándo? | ❌ **No.** Las exportaciones no se auditan |
| ¿Hubo intentos de entrar por la fuerza? | ❌ **No.** Los fallos son mudos |
| ¿Alguien intentó falsificar una sesión? | ❌ **No.** Se descarta en silencio |
| ¿Se alteró la bitácora? | ❌ **No.** Es modificable y no hay forma de saberlo |
| ¿Qué cambió este administrador la semana pasada? | ⚠️ Parcial |
| ¿Quién aprobó este documento? | ✅ Sí |

**Siete de ocho preguntas no tienen respuesta.** Y la que menos se puede
contestar —quién exportó datos— es justo la vía más fácil para llevarse el
padrón completo, y el escenario más probable según el modelo de amenazas (A2, el
insider).

Esa es la brecha que cierra esta parte. No es "poner alertas": es **poder
demostrar qué pasó**, que es lo que la ley exige y lo que un incidente reclama.

---

## 2. Lo que hay que registrar, y dónde

La bitácora ya cubre bien el flujo administrativo del expediente: 44 acciones,
con IP y agente de usuario. La estructura está bien; **faltan los eventos**.

### Prioridad 1 — Acceso (sin esto no hay investigación posible)

| Evento | Dónde añadirlo | Qué debe guardar |
|---|---|---|
| Inicio de sesión **exitoso** | `routes/auth.ts:34-66` | usuario, rol, IP, agente |
| Inicio de sesión **fallido** | `routes/auth.ts:43-52` | correo intentado, IP, motivo (no existe / contraseña) |
| **Firma de cookie inválida** | `middleware/auth.ts:83-86` | IP, agente, ruta |
| **403 por rol** | `middleware/auth.ts:97-100` | usuario, rol, ruta pedida |
| Cierre de sesión | `routes/auth.ts:68-71` | usuario |

> La **firma de cookie inválida** merece atención especial: es el indicador más
> fuerte de que alguien está intentando falsificar una sesión activamente. Hoy se
> descarta con un `401` mudo. Debe generar alerta **inmediata**, no sólo registro.

### Prioridad 2 — Extracción (la vía de fuga masiva)

| Evento | Dónde | Por qué |
|---|---|---|
| **Generación de reporte** | `routes/reportes.ts` — **no importa `tryAuditLog`** | Un Excel con miles de CURP |
| **Descarga** del reporte | `routes/reportes.ts:729` | Generar y descargar son actos distintos |
| **Lectura de expediente completo** | `admin.ts`, `gestor.ts` (detalle de alumno) | Responde "¿quién vio los datos de mi hijo?" |
| Búsqueda transversal | Ya existe | Añadir **cuántos resultados** devolvió |

Cada registro de exportación debe guardar **cuántos registros** salieron. Es lo
que distingue una consulta legítima de un barrido.

### Prioridad 3 — Privilegio y dinero

Cambio de rol o de `es_jefe`, emisión de credenciales (`admin.ts:4689`,
`gestor.ts:1486`), ciclo de pago (`pagos-examen.ts` no audita nada), cambios de
configuración —hoy con un bug: `configuracion.ts:52` guarda el usuario vacío—, y
reinicio de segundo factor cuando exista.

### Lo que NO debe registrarse

Igual de importante. **Nunca** en la bitácora: contraseñas ni sus hashes,
contenido de documentos, el término tecleado en una búsqueda (suele ser el nombre
de una persona), ni tokens. La bitácora la lee mucha gente: **no puede volverse
una segunda base de datos personales**.

---

## 3. Alertas: de cero a lo mínimo defendible

Hoy no existe **ninguna**. El tablero de salud es *pull*: alguien tiene que
abrirlo y mirarlo. Nadie se entera de nada a las 3 de la mañana — que es,
precisamente, cuando corre el trabajo que borra cuentas.

| # | Señal | Umbral | Urgencia |
|---|---|---|---|
| A1 | Firma de cookie inválida | **Cualquiera** | 🔴 Inmediata |
| A2 | Fallos de acceso sobre **una misma cuenta** | >10 en 5 min | 🔴 Inmediata |
| A3 | Exportación fuera de horario hábil | Cualquiera | 🔴 Inmediata |
| A4 | Exportación de volumen inusual | >2× la mediana del mes | 🟠 Mismo día |
| A5 | Uso de la cuenta de emergencia | Cualquiera | 🔴 Inmediata |
| A6 | Cambio de rol o de `es_jefe` | Cualquiera | 🟠 Mismo día |
| A7 | Errores 5xx sostenidos | >1% por 5 min | 🟠 Mismo día |
| A8 | Base de datos inalcanzable | Cualquiera | 🔴 Inmediata |
| A9 | **Un cron no corrió** | Falta la ejecución | 🟠 Mismo día |
| A10 | Cambio de IAM o de política de bucket | Cualquiera | 🔴 Inmediata |

**A3 y A4 son las que ven al insider.** Son las más valiosas y las que ningún
producto genérico trae configuradas, porque dependen de entender que aquí el
activo es el padrón.

> **Una alerta sin destinatario es un registro más.** Hay que definir por escrito
> a quién le suena el teléfono, con nombre y número, y quién es el suplente.

---

## 4. La obligación legal, y por qué obliga a decidir antes

El **Art. 34** exige informar **"sin dilación alguna"** al titular y a las
autoridades garantes cuando la vulneración afecte de forma significativa sus
derechos patrimoniales o morales.

*Sin dilación alguna* no admite dos semanas de deliberación. Y en pleno incidente
—de madrugada, con gente nerviosa— **no es momento de decidir si hay que
notificar**. Esa decisión hay que tomarla ahora, por escrito.

### Qué cuenta como vulneración (Art. 32)

La ley es amplia a propósito. Es vulneración, **en cualquier fase del
tratamiento**:

1. Pérdida o destrucción no autorizada
2. Robo, extravío o **copia** no autorizada
3. **Uso, acceso o tratamiento no autorizado**
4. Daño, alteración o modificación no autorizada

Nótese el punto 3: **un gestor que consulta expedientes que no le corresponden ya
es una vulneración**, aunque no saque nada. No hace falta un hacker.

### Árbol de decisión

```
¿Hubo acceso, copia, alteración o pérdida no autorizada
 de datos personales?
        │
        ├── NO ──► Incidente operativo. Se registra. No se notifica.
        │
        └── SÍ ──► ES VULNERACIÓN (Art. 32)
                     │
                     ├─► SIEMPRE: anotar en la bitácora de
                     │   vulneraciones (Art. 33)
                     │
                     └─► ¿Afecta de forma significativa derechos
                         patrimoniales o morales?
                             │
                             ├── Expedientes, CURP, domicilio,
                             │   fotografía, datos de menores
                             │        └──► SÍ. NOTIFICAR (Art. 34)
                             │
                             └── Sólo datos internos, sin PII
                                      └──► Documentar y evaluar
```

**Criterio para Módula 22:** cualquier acceso no autorizado a expedientes es
significativo por definición. Contienen acta de nacimiento, CURP, domicilio y
fotografía — el kit completo de suplantación (ver Parte 0, §2). Ante la duda,
**se notifica**.

### La bitácora de vulneraciones (Art. 33)

Obligación separada y explícita. Debe describir: **qué pasó, cuándo ocurrió, el
motivo, y las acciones correctivas inmediatas y definitivas**. Es un registro
formal, no un hilo de mensajes. Hoy no existe.

### Qué se le informa al titular (Art. 35)

Cinco contenidos mínimos. Plantilla lista para usar:

> **Aviso sobre un incidente de seguridad — Módula 22 / IEMSyS**
>
> 1. **Qué ocurrió:** [naturaleza del incidente, en lenguaje llano]
> 2. **Qué datos tuyos estuvieron comprometidos:** [lista específica]
> 3. **Qué te recomendamos hacer:** [medidas concretas para proteger sus intereses]
> 4. **Qué hemos hecho de inmediato:** [acciones correctivas ya tomadas]
> 5. **Dónde obtener más información:** [canal, responsable, teléfono]

Escrita para una persona real, no para un abogado. Muchos titulares son
estudiantes y sus familias.

> ⚠️ **Capacidad de notificación — planificar antes.** Notificar a 20,000
> personas no es mandar un correo: es una operación. Hay que resolver de
> antemano el proveedor y sus límites de envío, la lista de correos válidos, un
> aviso visible en el portal para quien ya no use ese correo, y quién atiende el
> teléfono cuando empiecen a llamar. Improvisado, se tarda semanas — y el Art. 34
> dice *sin dilación alguna*.

---

## 5. Las primeras 24 horas

| Fase | Qué se hace | Regla que se suele romper |
|---|---|---|
| **0-1 h · Contener** | Aislar lo afectado. Invalidar sesiones (§4.1 de la Parte 3). Rotar credenciales expuestas | **No apagar ni reinstalar nada todavía** |
| **1-4 h · Preservar** | Snapshot de RDS. Copiar bitácoras a almacenamiento inmutable. Exportar registros de acceso | Reiniciar el servidor **borra la evidencia** |
| **4-12 h · Evaluar** | ¿Qué datos, de cuántas personas, en qué periodo? Aplicar el árbol de decisión | Subestimar el alcance por prisa |
| **12-24 h · Notificar** | Autoridad garante y titulares (Arts. 34-35) | Esperar a "tener todo claro" — el Art. 34 no lo permite |
| **Después · Corregir** | Causa raíz, plan de acción, actualizar el Documento de Seguridad | Arreglar el síntoma y cerrar el caso |

El **Art. 30-III y IV** obliga a actualizar el Documento de Seguridad tras una
vulneración. La ley asume que se aprende del incidente, y pide constancia.

### Papeles (no puestos)

En un equipo pequeño una persona lleva varios, y está bien — lo que no puede es
quedar sin dueño:

- **Quien decide** — declara el incidente y autoriza notificar. *Debe ser una sola persona.*
- **Quien investiga** — técnico, determina alcance y causa.
- **Quien comunica** — único canal hacia titulares, autoridad y prensa.
- **Quien registra** — lleva la línea de tiempo. En caliente nadie recuerda a qué hora pasó qué.

---

## 6. Sin evidencia no hay investigación

Hoy los registros van a la salida estándar de Railway, **sin retención
configurada, sin búsqueda y sin resguardo**. Si mañana hay un incidente, no hay
con qué investigar.

| Evidencia | Retención | Dónde |
|---|---|---|
| Bitácora de auditoría | 12 meses en caliente + **5 años sellados** | Base + S3 con Object Lock |
| Registros del servidor | 90 días | CloudWatch Logs |
| CloudTrail (acciones en AWS) | 12 meses | S3 con Object Lock |
| Registros de acceso del balanceador | 90 días | S3 |
| Bitácora de vulneraciones | **Permanente** | Expediente del Documento de Seguridad |

Confirmar los plazos con la Unidad de Transparencia: la normativa de archivo
puede exigir más.

---

## 7. Practicarlo antes de necesitarlo

Un plan que nunca se ensayó no es un plan. **Un simulacro al año, dos horas, sin
avisar la fecha.** Escenario recomendado el primero, porque es el más probable y
el más incómodo:

> *Un gestor exportó el padrón completo de su municipio y lo mandó a un correo
> personal. Nos enteramos por una denuncia anónima, tres semanas después.*

Ese ejercicio revela, sin tocar nada en producción, si las alertas habrían
disparado, si la bitácora permite reconstruir qué se llevó, si sabemos a quién
notificar, y si alguien sabe qué hacer. Las respuestas de la primera vez suelen
ser incómodas — y ése es exactamente el punto.

---

## 8. Orden de implantación

| # | Acción | Esfuerzo | Cierra |
|---|---|---|---|
| 1 | Auditar acceso: inicios de sesión, fallos, firma inválida, 403 | Bajo | **P0-12** (prioridad 1) |
| 2 | Auditar exportaciones con número de registros | Bajo | **P0-12** (prioridad 2) |
| 3 | Alertas A1, A2, A5, A8 | Medio | Ceguera total |
| 4 | Alertas A3, A4 (exportaciones) | Medio | **A2/A3 del modelo de amenazas** |
| 5 | Retención de evidencia | Medio | Sección 6 |
| 6 | Bitácora de vulneraciones + plantilla del Art. 35 | Bajo (no técnico) | **Arts. 33 y 35** |
| 7 | Plan de respuesta escrito, con nombres | Bajo (no técnico) | **Art. 34** |
| 8 | Primer simulacro | Bajo (recurrente) | Que el plan sea real |

Los puntos 1, 2, 6 y 7 se pueden hacer **esta semana** y son los que más cambian
la postura. Los dos primeros son código acotado; los otros dos son escribir y
decidir — y son justamente los que un órgano de control pide primero.
