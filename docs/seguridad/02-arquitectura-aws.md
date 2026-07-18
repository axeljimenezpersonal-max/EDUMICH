# Módula 22 — Estrategia de ciberseguridad
## Parte 2: arquitectura objetivo en AWS

> Última actualización: 2026-07-18.
> Prerrequisito: leer [00-marco-y-amenazas.md](00-marco-y-amenazas.md).

---

## 1. El principio que ordena todo lo demás

Hoy la aplicación tiene **una sola credencial con permisos plenos** sobre una
base accesible desde internet. Eso significa que **cualquier fallo de la
aplicación es un fallo total**: quien logre ejecutar código o filtrar el
`DATABASE_URL` obtiene el padrón completo, y además puede reescribir la bitácora
que probaría lo ocurrido.

La migración debe romper eso. El objetivo no es "una aplicación sin fallos"
—eso no existe— sino **que un fallo de la aplicación no sea el fin del mundo**.

Tres capas de contención, en orden de importancia:

1. **La base de datos no debe ser alcanzable desde internet.** Nunca.
2. **La aplicación no debe poder borrar la bitácora.** Permisos separados.
3. **Las llaves no deben vivir en ningún archivo.** Ni en `.env`, ni en la imagen.

---

## 2. Red: lo primero que se decide y lo más caro de cambiar

```
Internet
   │
   ▼
[CloudFront] ── WAF ──┐          Subred pública
   │                  │          ├── ALB (único punto expuesto)
   │                  │          └── NAT Gateway
   ▼                  ▼
[ALB] ────────────────┘          Subred privada (sin ruta a internet entrante)
   │                             ├── ECS Fargate: web (N tareas)
   ▼                             └── ECS Fargate: trabajos (1 tarea)
[ECS: web]                       
   │                             Subred aislada (sin NAT)
   ├──► [RDS PostgreSQL] ◄────── └── RDS Multi-AZ
   ├──► [S3 vía VPC Endpoint]
   └──► [Secrets Manager]
```

**Decisiones que no se deben negociar:**

| Decisión | Por qué |
|---|---|
| RDS en subred **aislada**, sin IP pública | Cierra la ruta que hoy existe: hoy la base es alcanzable con sólo tener la cadena de conexión |
| Acceso a la base **sólo** desde el grupo de seguridad de ECS | El grupo de seguridad como frontera, no una lista de IPs que envejece |
| S3 por **VPC Endpoint**, no por internet | Los expedientes nunca salen de la red de AWS |
| Un **solo** punto expuesto: el balanceador | Todo lo demás sin dirección pública |
| Acceso administrativo por **SSM Session Manager**, no por SSH | Sin llaves que repartir, sin puerto 22, y **queda registrado quién entró** |

> **Sobre el acceso del equipo a la base en producción:** debe ser por túnel SSM
> con credencial temporal, nunca con una cadena de conexión en una laptop. El
> hallazgo P0-1 (credenciales vivas en el equipo local) se cierra aquí, no con
> disciplina.

---

## 3. Los cuatro P0 abiertos, resueltos por arquitectura

### P0-10 · Respaldos — el más urgente

Lo mínimo aceptable para datos con valor legal:

| Control | Configuración | Qué protege |
|---|---|---|
| RDS *automated backups* | Retención **30 días**, PITR activo | Error humano reciente |
| Snapshots manuales | Antes de cada migración de esquema | Cambios que salen mal |
| Copia **cross-region** | Snapshots replicados | Desastre regional |
| **S3 Versioning** | Activado en el bucket de expedientes | Borrado accidental de un documento |
| **S3 Object Lock** (modo *compliance*) | Sobre la bitácora exportada | Que nadie —ni un admin de AWS— la altere |
| Backup Vault con **Vault Lock** | Retención inmutable | Ransomware que borra los respaldos |

**Definir y escribir RTO y RPO.** Propuesta para discutir:

- **RPO ≤ 5 minutos** (PITR de RDS lo permite): en el peor caso se pierden 5
  minutos de altas. Con 1,700/mes son ~0.2 alumnos. Aceptable.
- **RTO ≤ 4 horas**: restaurar y verificar. Si el examen es mañana, 4 horas es
  tolerable; 3 días no.

> **Un respaldo no probado no es un respaldo.** Debe haber una **restauración de
> prueba trimestral**, cronometrada, con un runbook escrito — y ese runbook
> **debe incluir `lib/db/verificar-secuencias.mjs`**, que hoy es conocimiento
> tribal y sin el cual los folios de pago chocan y deja de emitirse cualquier
> ficha.

### P0-11 · Los trabajos programados

Hoy los cinco *crons* viven en el mismo proceso que atiende peticiones. Con N
instancias se ejecutan N veces — y uno de ellos **borra cuentas**.

**Solución:** sacarlos del proceso web. Dos opciones:

| Opción | A favor | En contra |
|---|---|---|
| **EventBridge Scheduler → ECS task** (recomendado) | Una sola ejecución garantizada; reintentos y registro nativos; se ve en consola | Requiere separar el punto de entrada |
| `pg_advisory_lock` dentro del cron actual | Cambio mínimo | Sigue atado al ciclo de vida del web; un despliegue a mitad lo corta |

Sea cual sea: **el trabajo de depuración necesita, además**, (a) una tabla de
"ya procesado en este ciclo" para ser idempotente, (b) una **alerta si no corre**
(*dead man's switch*), y (c) **modo de ensayo** que reporte a quién borraría sin
borrarlo, ejecutado en cada despliegue. Un proceso que borra datos de ciudadanos
no debe correr jamás sin red.

### P0-13 · Bitácora inmutable

**Separar credenciales de base de datos por función:**

| Usuario | Permisos | Lo usa |
|---|---|---|
| `modula_app` | CRUD sobre las tablas de negocio; **`INSERT` únicamente sobre `audit_log`** | La aplicación |
| `modula_migraciones` | DDL | Sólo el paso de migración del despliegue |
| `modula_lectura` | `SELECT` sobre vistas sin datos personales | Tableros, análisis |

Con eso, **aunque la aplicación se comprometa por completo, la bitácora no se
puede borrar ni reescribir**: no tiene el permiso. Es la diferencia entre una
bitácora decorativa y una probatoria.

Complementos: exportación diaria a S3 con **Object Lock**, y encadenamiento de
hash (cada registro incluye el hash del anterior) para que cualquier alteración
sea detectable.

### P0-12 · Qué falta auditar

Independiente de AWS, pero es donde se define la retención. Eventos obligatorios
que hoy no se registran: **inicio de sesión exitoso y fallido**, **firma de
cookie inválida**, **403 por rol**, **exportación de reportes**, **emisión de
credenciales**, **ciclo de pago**, **lectura de expediente** y **cambio de rol**.

Retención propuesta: **12 meses en caliente** (consultable en la app) + **5 años
en S3 con Object Lock**. Confirmar el plazo legal con la Unidad de Transparencia.

---

## 4. Cifrado y llaves

| Dato | Control |
|---|---|
| Expedientes en S3 | SSE-KMS con **llave propia** (no la de AWS), declarada **en el código** — hoy `PutObject` no la declara y depende del ajuste del bucket |
| Base de datos | Cifrado RDS en reposo con KMS |
| Respaldos y snapshots | Cifrados con la misma llave |
| En tránsito | TLS 1.2+ obligatorio; política del bucket que **niegue** peticiones sin TLS |
| Secretos de aplicación | **Secrets Manager** con rotación; inyectados por ECS, nunca en la imagen ni en `.env` |

**Política de bucket que niegue explícitamente** `PutObject` sin cifrado. Que no
dependa de que alguien lo configure bien: que el intento falle.

Sobre la **CURP en claro**: es inevitable por el índice único y la búsqueda. Se
declara como **riesgo aceptado** en el Documento de Seguridad, con su mitigación
—cifrado en reposo, red aislada, permisos por función— explícita. La ley pide
gestionar el riesgo, no eliminarlo.

---

## 5. Detección: dejar de estar ciegos

Hoy **no existe una sola alerta**. Mínimo viable:

| Señal | Servicio | Umbral |
|---|---|---|
| Errores 5xx sostenidos | CloudWatch Alarm | >1% durante 5 min |
| Base de datos caída | Alarma sobre conexiones | Cualquier fallo |
| **Un cron no corrió** | EventBridge + alarma | Falta la ejecución esperada |
| Fuerza bruta | Métrica sobre 401 por cuenta | >10 en 5 min |
| Actividad anómala en AWS | **GuardDuty** | Cualquier hallazgo medio/alto |
| Cambios en la infraestructura | **CloudTrail** + alarma | Cambios de IAM o de política de bucket |
| **Exportación masiva** | Métrica sobre la nueva auditoría | Fuera de horario o volumen inusual |

La última es la que detecta a **A2/A3 del modelo de amenazas** —el insider y el
fraude organizado—, que es el escenario más probable y hoy el más invisible.

**Y algo que no es técnico:** definir **a quién le suena el teléfono**. Una
alerta sin destinatario es un registro más.

---

## 6. Lo que hay que arreglar antes de escalar

No son opcionales: con más de una instancia, **se rompen**.

1. Sacar los *crons* del proceso web
2. `STORAGE_DRIVER=s3` y migrar las rutas absolutas ya guardadas en la base
3. Límite de tasa con almacén compartido (ElastiCache), **y por cuenta**, no sólo por IP
4. *Healthcheck* que compruebe la base
5. Métricas a CloudWatch, no a un `Map` en memoria

---

## 7. Orden propuesto

| Fase | Qué | Cuándo |
|---|---|---|
| **0** | Respaldo verificado de lo que hay hoy | **Antes de tocar nada** |
| **1** | Red, RDS aislada, KMS, Secrets Manager | Semana 1 |
| **2** | S3 + migración de archivos y refs | Semana 1-2 |
| **3** | Usuarios de BD por función + bitácora inmutable | Semana 2 |
| **4** | Crons fuera del web + idempotencia | Semana 2 |
| **5** | Auditoría de accesos y exportaciones | Semana 3 |
| **6** | Alertas, GuardDuty, CloudTrail | Semana 3 |
| **7** | Migración de datos + `verificar-secuencias` | Ventana |
| **8** | Restauración de prueba cronometrada | Semana siguiente |
| **9** | Documento de Seguridad (Art. 29) | Cierre |

**La fase 0 no es simbólica.** Hoy no hay respaldo propio. Antes de mover un solo
dato, debe existir una copia verificada y restaurable — porque el momento de
mayor riesgo de pérdida total es precisamente la migración.
