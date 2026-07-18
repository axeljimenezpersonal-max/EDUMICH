# Marca Módula 22

Archivos maestros del logotipo. Todos son vectores con los contornos ya
convertidos: **no dependen de que ninguna tipografía esté instalada**, así que
se pueden mandar a imprenta o pegar en un oficio sin sorpresas.

En pantalla dentro de la plataforma **no se usan estos archivos**: ahí va el
componente `src/components/ModulaLogo.tsx`, que es la misma geometría.

## Cuál usar

| Situación | Archivo |
|---|---|
| Pantalla y papel a color | `wordmark-full-color.svg` |
| Oficio impreso a un solo color | `wordmark-una-tinta-guinda.svg` |
| Sobre fondo guinda | `wordmark-blanco.svg` |
| Fotocopia, fax, sello | `wordmark-negro-mono.svg` |
| Documentos legales y oficiales | `lockup-institucional-neutro.svg` |
| Portadas y difusión | `lockup-full-color.svg` |
| Avatar, sello, marca de agua | `isotipo-guinda.svg` / `isotipo-blanco.svg` |

## Regla de tamaño

La Ó es un anillo de 22 arcos, uno por módulo del Plan 22. Los arcos necesitan
espacio para leerse:

- **Wordmark: mínimo 205 px de ancho** (o 55 mm impreso). Por debajo de eso los
  huecos entre arcos se cierran y la O se ensucia — ahí va
  `wordmark-solido-chico.svg`, que es el mismo anillo sin cortes.
- **Isotipo: mínimo 32 px.** Por debajo, `isotipo-solido-16-24px.svg`.

Esto no es una precaución teórica: se rasterizó y se midió. A 16 px la versión
segmentada se convierte en un anillo continuo.

## Zona de respeto

Ver `zona-de-respeto.svg`. La unidad **m** es el alto del "22" y se deja libre a
los cuatro lados. Nada entra en esa zona, tampoco el escudo institucional.

## Lo que no se hace

- No se recolorea fuera de la paleta (guinda `#6b1530`, dorado `#b89968`).
- No se estira ni se le cambia la proporción.
- No se le agregan sombras, contornos ni degradados.
- No se funde con el escudo del Gobierno de Michoacán, del IEMSyS ni de la SEP:
  la plataforma se licencia, no forma parte de la institución.
- En documentos legales no se usa guinda, porque data el documento a la
  administración en turno. Ahí va el lockup neutro.
