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

El hash debe ser el que esperas. **Pero que el hash esté bien NO prueba que el
despliegue vaya a llevar tu cambio**: lo que se publica es la *imagen*, no el
disco. Si el `build` corrió antes de este `fetch`, o si falló, `docker run`
levanta la imagen `modula22:latest` que ya existía y arranca sin una sola queja.
Eso se ve exactamente igual que un despliegue exitoso. Por eso el paso 3
construye con otra etiqueta y verifica antes de promover.

---

## 3. Reconstruir — y comprobar la imagen ANTES de tocar el contenedor

```bash
docker build -t modula22:nuevo . 2>&1 | tee ~/build.log
```

**`tee`, no `tail`.** `tail` retiene toda la salida hasta el final: la pantalla
se queda en blanco varios minutos y el build parece colgado. No lo está — pero
ya pasó que se interrumpiera con `Ctrl-C` creyendo que sí, y entonces la imagen
se queda vieja sin que nada avise. `tee` muestra el avance en vivo y además
deja el registro en `~/build.log`.

Tarda varios minutos (`pnpm install` y dos compilados). Debe cerrar con
`naming to docker.io/library/modula22:nuevo done`. Si tronó, el final del
registro dice dónde.

Ahora comprueba que la imagen nueva de verdad trae el cambio. Se busca dentro
del bundle ya compilado una cadena que solo exista en el código nuevo:

```bash
docker run --rm modula22:nuevo grep -rl "TEXTO_NUEVO" artifacts/student-portal/dist/public/assets/ | head -3
```

Si no imprime nada, **para aquí**: cambiar el contenedor no arregla una imagen
que no tiene el cambio.

Con la imagen verificada, ya se promueve y se cambia el contenedor:

```bash
docker rm -f modula22
docker tag modula22:nuevo modula22:latest
docker run -d --name modula22 --restart unless-stopped \
  -p 127.0.0.1:3001:3001 \
  --env-file .env.production \
  -v ~/modula22/rds-ca.pem:/app/rds-ca.pem:ro \
  -v ~/modula22-storage:/app/storage \
  modula22:latest
```

**El volumen `~/modula22-storage:/app/storage` NO es opcional.** El storage de
archivos es local (`STORAGE_DIR=/app/storage`): sin ese `-v`, los documentos
que suben los alumnos viven DENTRO del contenedor y **cada `docker rm` los
borra**. Se descubrió el 2026-08-02; hasta esa fecha no había archivos reales
que perder, pero a partir de ahí el volumen va SIEMPRE en el comando.

Caddy escucha en el 80/443 y reenvía al 3001, que solo está expuesto en
`127.0.0.1` — el contenedor no se asoma a internet por su cuenta.

El portal **sí** se compila dentro de la imagen (`Dockerfile`, línea 20) y el
api-server lo sirve como estático. No hay un despliegue aparte del frontend: si
el bundle de adentro está viejo, es la imagen.

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
docker exec -it modula22 node lib/db/importar-temarios.mjs …    # temarios PDF de los módulos
```

### Cargar los temarios de los módulos

`importar-temarios.mjs` deja el PDF de cada módulo en el almacenamiento y
registra la fila `tipo = 'temario'` que el alumno ve en "Material de estudio".
Los PDF **no viajan en la imagen**: se copian primero al EC2 y de ahí al
contenedor.

```bash
# 1. del equipo al EC2 (fuera de la sesión SSM, desde tu máquina)
scp temarios/*.pdf ubuntu@<host>:~/temarios/

# 2. del EC2 al contenedor
docker cp ~/temarios modula22:/tmp/temarios

# 3. ENSAYO — no escribe nada, solo dice qué haría y a qué módulo va cada PDF
docker exec -it modula22 node lib/db/importar-temarios.mjs /tmp/temarios

# 4. de verdad
docker exec -it modula22 node lib/db/importar-temarios.mjs /tmp/temarios --aplicar
```

**Revisa el ensayo antes del paso 4.** El módulo sale del nombre del archivo
(`TEMARIO_MODULO_7.pdf`, `Modulo-7.pdf`, `M7.pdf`…); lo que no se puede deducir
se salta con su motivo, pero el emparejamiento que sí encontró solo lo puede
confirmar una persona. Al final lista los módulos que siguen sin temario.

Es idempotente: si el módulo ya tenía temario lo reemplaza, no duplica. Los
archivos van a `/app/storage/modulos/temario-M<n>.pdf`, o sea al volumen
`~/modula22-storage` — sobreviven al `docker rm`, pero **no** están en la
imagen: si algún día se levanta el contenedor sin el `-v`, el alumno se baja un
PDF de relleno que dice "material en preparación" y nada lo avisa. El propio
script señala esas filas huérfanas al final.

---

## Si algo sale mal

| Síntoma | Causa que ya vimos |
|---|---|
| `permission denied` en cualquier `docker` | Sigues como `ssm-user`; falta `sudo su - ubuntu` |
| Todo "salió bien" y el cambio no aparece | **La causa más común.** La imagen es vieja: el build corrió antes del `fetch`, o falló, y `docker run` levantó la `:latest` anterior. Diagnóstico de un golpe: `docker exec modula22 grep -rl "TEXTO_NUEVO" artifacts/student-portal/dist/public/assets/` — si no aparece, el problema es la imagen, no el navegador |
| La imagen SÍ trae el cambio y el navegador no | Caché del navegador o de Cloudflare. `Cmd+Shift+R`. El `index.html` se sirve con `no-cache`, así que debería bastar |
| `No encontré el archivo …` dentro del contenedor | El Dockerfile copia `lib/`, `artifacts/` y `attached_assets/`, **no** `docs/`. Los datos que el contenedor necesita van en `lib/db/datos/` |
| El build "no imprime nada" y parece colgado | No está colgado: son varios minutos y `pnpm install` no da señales. Si lo lanzaste con `\| tail`, la salida no aparece hasta el final — usa `\| tee`. Interrumpirlo deja la imagen vieja **sin ningún error visible** |
| El contenedor arranca y se muere | `docker logs modula22` — casi siempre es `.env.production` o el certificado `rds-ca.pem` |
