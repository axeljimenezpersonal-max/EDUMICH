# Runbook — redeploy de Módula 22

Pasos para publicar cambios en el servidor. Existe porque se piden cada vez y
vivían solo en la memoria de la conversación.

| Dato | Valor |
|---|---|
| Instancia EC2 | `i-0990f1a318540dd0b` |
| Región | `mx-central-1` (México) |
| Repo en el servidor | `~/modula22` |
| Contenedor | `modula22` |
| Rama que se despliega | `deploy/aws-v1` |

---

## 1. Conectarte

Consola de AWS → **EC2** → instancia `i-0990f1a318540dd0b` → botón **Connect** →
pestaña **Session Manager** → **Connect**.

Session Manager te mete como `ssm-user`, que **no tiene permisos de Docker**. El
primer comando, siempre:

```bash
sudo su - ubuntu
```

Si se te olvida, todo `docker ...` va a contestar "permission denied" y parece
que Docker está roto cuando en realidad es el usuario.

---

## 2. Traer el código

```bash
cd ~/modula22
git fetch origin deploy/aws-v1
git reset --hard origin/deploy/aws-v1
git log --oneline -1
```

**Verifica que el hash sea el que esperas antes de construir.** Esto no es
ceremonia: ya pasó una vez que el `fetch` no corrió, el `docker build` salió
100 % de caché, el despliegue "funcionó" sin un solo error y el cambio
sencillamente no estaba. Un build exitoso no prueba que el código sea nuevo.

---

## 3. Reconstruir y levantar

```bash
docker build -t modula22:latest .
docker rm -f modula22
docker run -d --name modula22 --restart unless-stopped \
  -p 127.0.0.1:3001:3001 \
  --env-file .env.production \
  -v ~/modula22/rds-ca.pem:/app/rds-ca.pem:ro \
  modula22:latest
```

Caddy escucha en el 80/443 y reenvía al 3001, que solo está expuesto en
`127.0.0.1` — el contenedor no se asoma a internet por su cuenta.

---

## 4. Comprobar que arrancó

```bash
docker logs -f modula22
```

`Ctrl-C` sale del log **sin** tumbar el contenedor.

---

## ⚠️ Qué hace el arranque, además de arrancar

El `CMD` del contenedor corre esto antes del servidor:

```
pnpm --filter '@workspace/db' run push   →   drizzle-kit push
```

Es decir: **cada arranque sincroniza el esquema de Drizzle contra la base de
producción.** Esto importa para dos cosas:

1. Es un **tercer** mecanismo de esquema, además de `lib/db/src/schema/index.ts`
   y del arreglo `migrations` de `artifacts/api-server/src/db.ts`. Un índice
   declarado solo en Drizzle igual puede terminar existiendo en la base.
2. Por eso **levantar el contenedor ya es escribir en producción**, y por eso
   nunca se arranca el api-server "para probar" desde una máquina de trabajo.

---

## Comandos de mantenimiento (dentro del contenedor)

Solo lectura, seguros de correr cuando haga falta:

```bash
docker exec -it modula22 node lib/db/ver-correos.mjs            # por qué no llegó un correo
docker exec -it modula22 node lib/db/ver-curps-duplicadas.mjs   # CURPs repetidas / índice único
```

Escriben en la base (correr a conciencia):

```bash
docker exec -it modula22 node lib/db/importar-centros.mjs       # padrón de centros de asesoría
docker exec -it modula22 node lib/db/importar-cp.mjs            # catálogo SEPOMEX
```

---

## Si algo sale mal

| Síntoma | Causa que ya vimos |
|---|---|
| `permission denied` en cualquier `docker` | Sigues como `ssm-user`; falta `sudo su - ubuntu` |
| El build pasa pero el cambio no aparece | El `git fetch` no corrió; el build salió de caché. Revisa el hash (paso 2) |
| `No encontré el archivo …` dentro del contenedor | El Dockerfile copia `lib/`, `artifacts/` y `attached_assets/`, **no** `docs/`. Los datos que el contenedor necesita van en `lib/db/datos/` |
| El contenedor arranca y se muere | `docker logs modula22` — casi siempre es `.env.production` o el certificado `rds-ca.pem` |
