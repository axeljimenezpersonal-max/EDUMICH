# Módula 22 — contexto para trabajar en este repo

Plataforma de **Preparatoria Abierta del estado de Michoacán**, operada por el
IEMSyS. Cuatro roles: alumno, gestor (centro de asesoría), administración y
"creador" (Synapsis). Monorepo pnpm.

| Dónde | Qué |
|---|---|
| `artifacts/api-server` | API Express + Drizzle |
| `artifacts/student-portal` | Portal React + Vite (los 4 roles) |
| `lib/db` | Esquema, semilla, respaldo y restauración |
| `docs/seguridad/` | Estrategia de ciberseguridad (8 documentos) |

---

## ⛔ Reglas que no se rompen

**1. NUNCA arranques el api-server para "probar".**
`DATABASE_URL` apunta a **Neon de producción** (no hay base local), y el
arranque ejecuta migraciones, `sincronizarEstadosEtapas()` y
`vencerPagosExamen()`, que **modifican datos reales**. Levantar el servidor ya
es escribir en producción.

Para verificar sin conectarte:
- SQL: construye la consulta con Drizzle y usa `.toSQL()` — devuelve la
  sentencia y sus parámetros sin ejecutar nada.
- Interfaz: `pnpm --filter @workspace/student-portal dev` sola es segura.
- Datos: hay modo demo del alumno en `/demo/estudiante` (`lib/demo.ts`
  intercepta las llamadas).

**2. La marca es "Modula · Plan 22". "EDUMICH" está PROHIBIDO** en texto visible.
Sigue en dominios y en el nombre del repo en GitHub — eso es aparte.

**3. NO rediseñes la credencial del alumno.** Está decidida y aprobada.

**4. Fechas: SIEMPRE `lib/fechas.ts` (portal) o `utils/fechas.ts` (API).**
La base guarda UTC sin zona; todo se presenta en `America/Mexico_City`. Nunca
`new Date()` directo sobre una cadena de la API — eso corre 6 horas.

**5. Al terminar algo verificado, commitea y empuja.** No dejes trabajo en el
árbol: puede haber **otro agente trabajando en paralelo** en este mismo repo, y
un `git add -A` ajeno se lleva tus cambios a su commit.

**6. Si tocas el esquema**, hay **dos** mecanismos y hay que actualizar los dos:
`lib/db/src/schema/index.ts` (Drizzle) y el arreglo `migrations` de
`artifacts/api-server/src/db.ts`. Después corre `pnpm run typecheck:libs`, o el
API seguirá viendo los tipos viejos.

---

## Cómo verificar

```bash
npx tsc --noEmit -p artifacts/api-server/tsconfig.json      # API
npx tsc --noEmit -p artifacts/student-portal/tsconfig.json  # portal
```

Ejecutar `pnpm` puede requerir `--config.verify-deps-before-run=false`.

**No hay pruebas automatizadas.** Lo que se verifica, se verifica a mano — y se
dice con claridad qué se comprobó y qué no.

---

## Reglas del producto

- **Sedes**: las define la **convocatoria**, el alumno elige entre ésas. No se
  deducen del municipio. Viven como pestaña dentro de Convocatorias.
- **Máximo 4 módulos** por convocatoria. El Plan 22 son 22 módulos.
- **Ventanas de solicitud con candado estricto**: fuera de la ventana no se
  puede inscribir ni pagar. Son 8 etapas al año, de 4-5 días cada una.
- **Pagos**: Módula **no cobra**. La línea de captura la emite el Estado; aquí
  sólo se almacena, se sirve y se concilia. **$131 por examen** ($101 IEMSyS +
  $30 Synapsis; el split es interno). **Un cambio de precio aplica SOLO a fichas
  nuevas**: las fichas ya creadas conservan el monto con que nacieron (no se
  recalcula hacia atrás).
- **Matrícula oficial (DGB/GIMS)**: la genera el Estado, no la app (aquí se
  captura). Estructura de 14 dígitos `AAAA 16 01 NNNNNN`: año de inscripción +
  `16` (Michoacán, INEGI) + subcódigo (`01`; era `33` en 2022) + un consecutivo
  global de 6 dígitos que **nunca reinicia** y crece con el tiempo (con huecos,
  porque el contador es compartido). No es aleatorio.
- **Expediente**: 5 documentos obligatorios (CURP, acta, identificación,
  comprobante de domicilio, certificado de secundaria).
- **Admin titular vs operativo**: `administradores.es_jefe`. El operativo NO da
  alta/baja de gestores. (Firmar la cédula sí lo pueden ambos perfiles: cada
  admin firma con la suya.)

---

## Cuentas de prueba (contraseña `demo1234`)

| Correo | Rol |
|---|---|
| `velia@gmail.com` | admin **titular** |
| `alex@gmail.com` | admin operativo |
| `UTEC@gmail.com` | gestor · Morelia |
| `axel@hotmail.com` + `alumno1..5@prueba.mx` | alumnos, expediente 5/5 aprobado, gestor UTEC |

`contacto@sinapsys.mx` es el panel del creador y **conserva su contraseña
original**.

> Los documentos de esos alumnos tienen la ruta `PRUEBA-SIN-ARCHIVO/...`: no hay
> archivo detrás. Descargarlos falla a propósito y de forma explícita.

---

## 📱 Trabajar desde el teléfono

Sí se puede, con `claude.ai/code` conectado a este repo. **Qué cambia:**

| Sí funciona | No funciona |
|---|---|
| Leer y entender el código | Acceso a la base (`.env` no está en el repo) |
| Escribir cambios y commitear | Ejecutar scripts contra Neon |
| Typecheck | Ver el portal en el navegador |
| Revisar los documentos de `docs/` | La memoria local del proyecto |

**Por eso existe este archivo:** Claude lo lee solo al abrir el repo, así que la
sesión del teléfono arranca con el contexto puesto.

### Para reportar errores desde el teléfono

Descríbelos en lenguaje llano —qué rol, qué pantalla, qué esperabas, qué pasó—
y pide que primero se **localice en el código** antes de proponer arreglo. Sin
poder abrir la aplicación, leer el código es la única forma de confirmar la
causa. Si algo no se puede verificar desde ahí, debe decirse en vez de suponer.

---

## Estado y pendientes

Todo el detalle está en **`docs/seguridad/07-hoja-de-ruta.md`**. Lo abierto más
importante:

1. **Migración a AWS** — región recomendada `mx-central-1` (México). Hoy la base
   está en `us-east-2` (Ohio): los datos ya están fuera del país.
2. **Sin alertas**: nadie se entera si el sistema se cae.
3. **El trabajo que borra cuentas** corre a las 3 AM sin lock; con más de una
   instancia se ejecutaría N veces.
4. **La bitácora es modificable** — sin valor probatorio.
5. **Los ~20 textos de respuesta del buscador** (`lib/buscador/indice.ts`) dicen
   montos y plazos a nombre de la Secretaría y **nadie los ha validado**.

Ya resuelto y probado: respaldo cifrado + restauración (`lib/db/respaldo.mjs`,
`lib/db/restaurar.mjs`, `docs/seguridad/runbook-restauracion.md`).

> ⚠️ `docs/seguridad/01-hallazgos-auditoria.md` describe debilidades explotables
> de un sistema en producción. No publicar ni compartir fuera del equipo.
