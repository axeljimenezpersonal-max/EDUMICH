# Temarios de los modulos (PDF)

Los temarios oficiales que el alumno descarga desde la pantalla de cada
modulo ("Material de estudio" → "Descargar temario PDF").

**Viven aqui a proposito.** El Dockerfile copia `lib/`, asi que estos PDF
viajan DENTRO de la imagen y no hace falta transferirlos al servidor: quien
opera el despliegue entra por Session Manager (navegador) y no tiene `scp`.

## Como cargarlos

Despues de un redeploy, dentro del contenedor:

```bash
# ensayo — no escribe nada, solo dice a que modulo iria cada PDF
docker exec -it modula22 node lib/db/importar-temarios.mjs lib/db/datos/temarios

# de verdad
docker exec -it modula22 node lib/db/importar-temarios.mjs lib/db/datos/temarios --aplicar
```

El script copia cada PDF al almacenamiento (`/app/storage/modulos/`, que es el
volumen `~/modula22-storage`) y registra la fila `tipo='temario'`. Es
idempotente: volver a correrlo reemplaza, no duplica.

## Nombres de archivo

`TEMARIO_MODULO_<numero>.pdf` — ASCII, sin acentos (regla 7 de CLAUDE.md). El
script tambien acepta `Modulo-7.pdf`, `M7.pdf` y variantes, pero conviene
mantener este formato por claridad.

## Estado

Cargados: del 1 al 18.

**Faltan: 19, 20, 21 y 22.**
