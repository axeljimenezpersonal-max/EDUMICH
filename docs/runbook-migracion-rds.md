# Runbook — mudanza de la base: Neon (Ohio) → RDS (mx-central-1)

Es el pendiente #1 de la hoja de ruta: los datos hoy viven fuera del país.
La mudanza reutiliza el respaldo/restauración **ya probados** el 2026-07-20
(`lib/db/respaldo.mjs`, `lib/db/restaurar.mjs`, runbook-restauracion.md).
Con el tamaño actual (~17 MB) el corte completo cabe en **10-15 minutos**.

**Qué se muda:** TODO lo que vive en la base — alumnos, expedientes, los 22
módulos con sus temarios y pruebas, convocatorias, pagos, calificaciones,
secuencias. **Qué NO se muda con esto:** los archivos subidos (viven en el
almacenamiento configurado en `STORAGE_DRIVER`, aparte de la base) y los
secretos del `.env.production` (no cambian).

---

## Fase 0 — preparación (sin downtime, se puede hacer días antes)

### 0.1 Crear la RDS en mx-central-1

Consola AWS → RDS → **Create database**:

| Opción | Valor |
|---|---|
| Engine | PostgreSQL 16 |
| Template | Free tier o Dev/Test según presupuesto |
| Instancia | `db.t4g.micro` (sobra para 17 MB; se sube después) |
| Storage | 20 GB gp3 |
| VPC | **La misma del EC2** `i-0990f1a318540dd0b` |
| Public access | **No** |
| Security group | Nuevo: entrada 5432 SOLO desde el security group del EC2 |
| Initial database name | `modula` |
| Backups automáticos | Activados, 7 días mínimo |

Guardar usuario y contraseña maestros en el gestor de contraseñas.
Anotar el **endpoint** (algo como `modula.xxxx.mx-central-1.rds.amazonaws.com`).

### 0.2 Verificar el certificado

`~/modula22/rds-ca.pem` ya existe en el servidor. Si hiciera falta refrescarlo,
es el paquete global oficial:

```bash
curl -o ~/modula22/rds-ca.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
```

### 0.3 Probar conexión desde el EC2

```bash
sudo apt-get install -y postgresql-client
psql "postgresql://USUARIO:PASSWORD@ENDPOINT:5432/modula?sslmode=require" -c "select version();"
```

Si esto no conecta, es el security group — arreglarlo ANTES del día de corte.

### 0.4 La URL nueva (formato ya documentado en `lib/db/src/seed-produccion.ts`)

```
postgresql://USUARIO:PASSWORD@ENDPOINT:5432/modula?sslmode=verify-full&sslrootcert=/app/rds-ca.pem
```

### 0.5 Tener a la mano

- `RESPALDO_KEY` (64 hex) del gestor de contraseñas — la de la prueba de julio.
- Confirmar que **NO hay ventana de solicitud abierta** ni examen ese día.

---

## Fase 1 — el corte (10-15 min de portal apagado)

Todo como `ubuntu` en el EC2 (`sudo su - ubuntu`), desde `~/modula22`.

### 1.1 Congelar: nadie escribe

```bash
docker stop modula22
```

### 1.2 Respaldo final desde Neon

El contenedor está parado; se usa la MISMA imagen solo para correr el script
(al sobreescribir el comando no arranca el servidor ni toca nada):

```bash
mkdir -p ~/respaldos-modula
docker run --rm --env-file .env.production \
  -e RESPALDO_KEY=<LA_CLAVE_64_HEX> \
  -v ~/respaldos-modula:/app/respaldos-modula \
  modula22:latest node lib/db/respaldo.mjs respaldos-modula
```

Debe terminar con la verificación de filas en verde. Quedan DOS archivos en
`~/respaldos-modula/`: el `.enc` y su `.meta.json`.

### 1.3 Esquema en la RDS  (~40 s)

```bash
docker run --rm \
  -e DATABASE_URL='postgresql://USUARIO:PASSWORD@ENDPOINT:5432/modula?sslmode=verify-full&sslrootcert=/app/rds-ca.pem' \
  -v ~/modula22/rds-ca.pem:/app/rds-ca.pem:ro \
  modula22:latest pnpm --filter @workspace/db run push --force
```

### 1.4 Extensión `unaccent` (sin ella el buscador falla en silencio)

```bash
psql "postgresql://USUARIO:PASSWORD@ENDPOINT:5432/modula?sslmode=require" \
  -c "CREATE EXTENSION IF NOT EXISTS unaccent;"
```

### 1.5 Restaurar  (~1 min)

La base destino se llama `modula` (no "prueba"), así que el candado del script
pide decirlo explícito — aquí SÍ es la restauración real:

```bash
docker run --rm \
  -e DATABASE_URL='postgresql://USUARIO:PASSWORD@ENDPOINT:5432/modula?sslmode=verify-full&sslrootcert=/app/rds-ca.pem' \
  -e RESPALDO_KEY=<LA_CLAVE_64_HEX> \
  -e DESTINO_ES_DESECHABLE=si \
  -v ~/modula22/rds-ca.pem:/app/rds-ca.pem:ro \
  -v ~/respaldos-modula:/resp \
  modula22:latest node lib/db/restaurar.mjs /resp/<archivo>.jsonl.gz.enc
```

Leer los avisos de **DERIVA DE ESQUEMA** si aparecen (columnas que producción
tenía y el código ya no declara: se descartan y el script lo dice).

### 1.6 Verificar secuencias (la consulta del runbook de restauración)

Debe devolver **0 filas** — está en `docs/seguridad/runbook-restauracion.md`
paso 5. Y un conteo de cordura:

```bash
psql "...sslmode=require" -c "select count(*) from modulos;"   # deben ser 22
```

### 1.7 Apuntar el servidor a la RDS

```bash
nano ~/modula22/.env.production
# DATABASE_URL=postgresql://USUARIO:PASSWORD@ENDPOINT:5432/modula?sslmode=verify-full&sslrootcert=/app/rds-ca.pem
# (SESSION_SECRET, QR_SECRET y todo lo demás NO se tocan)
```

### 1.8 Levantar

El env se lee al CREAR el contenedor, no al arrancarlo: hay que recrearlo.

```bash
docker rm modula22
docker run -d --name modula22 --restart unless-stopped \
  -p 127.0.0.1:3001:3001 \
  --env-file .env.production \
  -v ~/modula22/rds-ca.pem:/app/rds-ca.pem:ro \
  modula22:latest
docker logs -f modula22
```

El arranque corre `drizzle-kit push` y las migraciones **contra la RDS** — es
lo esperado.

### 1.9 Humo (5 min, en el navegador)

1. Entrar como admin y como alumno de prueba.
2. Ver un módulo con su temario y abrir una prueba (los 22 viajaron en la base).
3. **Emitir una ficha de pago de prueba** — la prueba reina de las secuencias.
4. Buscar un alumno por nombre con acento (prueba `unaccent`).
5. Abrir un documento de expediente (los archivos NO se movieron: deben seguir
   sirviéndose igual, porque viven en el storage, no en la base).

---

## Rollback (si algo huele mal en el humo)

Neon quedó **intacta y congelada** — nada escribió en ella desde el paso 1.1:

```bash
nano ~/modula22/.env.production   # regresar DATABASE_URL a la de Neon
docker rm -f modula22
docker run -d --name modula22 ... (el mismo comando de 1.8)
```

Pérdida de datos: cero. Se reintenta otro día.

---

## Después (misma semana)

- Neon se queda viva 7 días como red de seguridad; luego se da de baja.
- El job de las 3 AM y los correos siguen igual (no dependen de la región).
- Revisar en calma la **deriva de esquema** que reporte 1.5.
- Pendiente aparte (no urgente): mover el bucket de archivos a mx-central-1
  (`aws s3 sync` + cambiar `S3_BUCKET`/región en el env). La base ya estaría
  en México; los archivos son la segunda mitad de ese pendiente.
- Actualizar `docs/seguridad/07-hoja-de-ruta.md`: pendiente #1 cerrado.
