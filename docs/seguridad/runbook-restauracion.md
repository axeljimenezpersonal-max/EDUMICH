# Runbook: restaurar Módula 22 desde un respaldo

> **Probado de verdad el 2026-07-20.** Los tiempos son medidos, no estimados.
> Escrito para que lo ejecute alguien que NO lo escribió.

---

## Antes de empezar

Necesitas tres cosas. Si te falta una, no sigas:

| Qué | Dónde está |
|---|---|
| El archivo `.enc` **y** su `.meta.json` | `respaldos-modula/` — **los dos**, el segundo trae el vector y la etiqueta |
| La clave `RESPALDO_KEY` (64 hex) | Gestor de contraseñas. **Sin ella el archivo no se puede leer** |
| Una base de datos **vacía** de destino | Nunca la de producción, salvo recuperación real |

---

## Los pasos

### 1 · Crear la base de destino

En Neon, conectado a la base actual:

```sql
CREATE DATABASE modula_restauracion;
```

El nombre **debe** contener `restaur`, `prueba` o `test`: el script se niega a
escribir en cualquier otra cosa a menos que se lo fuerces. Es a propósito.

### 2 · Aplicar el esquema  ⏱️ ~37 s

```bash
DATABASE_URL=<destino> pnpm --filter @workspace/db run push --force
```

El respaldo **no** trae el esquema, sólo los datos.

### 3 · Habilitar `unaccent`  ⏱️ instantáneo

```sql
CREATE EXTENSION IF NOT EXISTS unaccent;
```

Va por base, no por servidor. **Sin esto la búsqueda de cuenta y el buscador
global fallan**, y el sistema parece sano hasta que alguien busca.

### 4 · Restaurar  ⏱️ ~30 s (3,783 filas)

```bash
RESPALDO_KEY=<clave> DATABASE_URL=<destino> \
  node lib/db/restaurar.mjs respaldos-modula/modula-<fecha>.jsonl.gz.enc
```

Restaura los datos **y las 60 secuencias**, y verifica contando fila por fila.

> ⚠️ **Lee los avisos de "DERIVA DE ESQUEMA".** Si el respaldo trae columnas que
> el esquema actual ya no tiene, el script las descarta y te lo dice. Esos datos
> **no se restauran**. Ver la sección de hallazgos.

### 5 · Comprobar que la base sirve

Contar filas no basta. Hay que verificar que se puede **seguir operando**:

```sql
-- ¿Alguna secuencia quedó por debajo de su máximo? Debe devolver 0 filas.
SELECT c.relname AS secuencia
FROM pg_class c JOIN pg_depend d ON d.objid = c.oid
JOIN pg_class t ON t.oid = d.refobjid
JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
WHERE c.relkind = 'S'
  AND (SELECT last_value FROM pg_sequences WHERE sequencename = c.relname)
      < (SELECT COALESCE(max(id),0) FROM pg_class WHERE relname = t.relname);
```

Y la prueba que de verdad importa: **emitir una ficha de pago nueva**. Si la
secuencia quedó mal, choca contra `UNIQUE(folio)` y ahí se acaba el trámite.

### 6 · Apuntar al nuevo destino

Cambiar `DATABASE_URL` en el entorno y reiniciar. **Verificar antes** que
`SESSION_SECRET` y `QR_SECRET` sigan puestos: sin ellos el servidor no arranca.

---

## Tiempo total medido

| Paso | Tiempo |
|---|---|
| Crear base | ~5 s |
| Aplicar esquema | **37 s** |
| Extensión | ~1 s |
| Restaurar 3,783 filas | **30 s** |
| Verificar | ~10 s |
| **Total** | **~1.5 min** |

Con **17 MB y 3,783 filas**. Con el padrón real (20,000 alumnos/año) hay que
volver a medirlo — y por eso el ensayo es trimestral, no de una sola vez.

El RTO comprometido en ventana de solicitud es **≤ 1 hora**. Hoy el proceso
técnico cabe de sobra; lo que consume el presupuesto es **decidir** que hay que
restaurar y conseguir la clave.

---

## Hallazgos de la primera prueba (2026-07-20)

Todo esto apareció al ejecutar de verdad. Ninguno se habría visto leyendo el
código.

### 🔴 Deriva de esquema: producción tiene columnas que el código no declara

`chat_mensajes` en producción tiene `adjunto_ruta`, `adjunto_nombre` y
`adjunto_mime`. Una base creada desde cero con el esquema actual **no las
tiene**.

Consecuencia: **restaurar producción en una base nueva pierde esas columnas y
lo que guarden**. Hoy da igual porque el chat no usa adjuntos, pero es la señal
de un problema mayor: `drizzle-kit push` añade columnas y no quita las viejas,
así que producción acumula estructura que el código ya no conoce. En una
recuperación real, esa diferencia se traduce en pérdida silenciosa.

*Acción pendiente:* comparar el esquema real de producción contra el del código
y decidir qué se conserva. Va con la migración a AWS (P1-5).

### 🟠 Neon no permite desactivar los disparadores de integridad

`SET session_replication_role = replica` —lo que usa `pg_restore`— no está
disponible para el rol dueño. El script calcula el **orden de dependencias**
desde el catálogo de llaves foráneas. Funciona, pero es más lento y frágil que
la vía estándar.

*Con RDS en AWS esto probablemente deja de ser problema:* conviene revisarlo
entonces.

### 🟠 Las columnas JSON con arreglos se corrompían al reinsertarse

El driver de Postgres traduce un arreglo de JavaScript a arreglo de Postgres
(`{1,2,3}`) en vez de a JSON. Para una columna `jsonb` que guarda un arreglo,
eso rompe la inserción. Corregido serializando a mano las columnas JSON.

**Este fallo era invisible en el respaldo:** el archivo estaba perfecto. Sólo
apareció al intentar volver a meter los datos. Es exactamente el motivo por el
que un respaldo sin restauración probada no cuenta.

---

## Lo que este runbook NO cubre

- **Los archivos subidos** (expedientes, fotografías, comprobantes). Van aparte
  y hoy **no tienen respaldo**. Restaurar la base deja los expedientes
  apuntando a archivos que no existen.
- **Los secretos.** Sin `SESSION_SECRET` ni `QR_SECRET` el servidor no arranca.
- **La configuración** de DNS, certificados y red.

Con RDS y S3 esto cambia: los respaldos automáticos cubren la base, y el
versionado de S3 los archivos. Este procedimiento es la red mínima mientras
tanto.

---

## Próxima prueba

Trimestral, cronometrada, y **ejecutada por alguien que no escribió esto**. Si
el tiempo medido supera el RTO comprometido, se corrige el plan o la
arquitectura — no se maquilla el número.
