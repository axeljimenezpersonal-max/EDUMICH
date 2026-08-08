# Comprobaciones sueltas

Este proyecto no tiene pruebas automatizadas y esto no las introduce: son dos
guiones que se corren a mano cuando se toca la lógica que comprueban.

Están aquí, y no en `src/`, para que el compilador no los incluya en el
paquete que se despliega. No tocan la base ni la red — sólo llaman funciones.

```bash
cd artifacts/api-server
npx tsx pruebas/lectura-nombre.mts    # partir el nombre usando la CURP
npx tsx pruebas/curp-validacion.mts   # que validarCurp no reclame de más
```

`lectura-nombre.mts` sale con código 1 si algún caso falla.

## Por qué existen justo para esto

La partición del nombre no se puede revisar leyendo el código: hay que probar
que "MARÍA DE LOS ÁNGELES DE LA CRUZ GARCÍA" se parte donde va y que un texto
sin nombre no propone nada. Ya pasó una vez que un cambio razonable —excluir
los nombres de las entidades para que "MICHOACAN DE OCAMPO" no se confundiera
con un nombre— metiera `DE` a la lista de palabras ignoradas y rompiera todos
los apellidos compuestos. Se vio aquí, no en producción.

Las CURP de los casos inventados llevan su dígito 18 recalculado (`fix()`):
sin eso fallan la verificación oficial y el error tapa lo que se quería probar.
La CURP `AOTA060308HMNLNDA8` sí es la de un documento real que se subió al
portal, y es la que dio origen a todo esto.
