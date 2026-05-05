# Prepa Abierta Michoacán — Vista del Gestor (Demo)

Sistema de gestión institucional para la coordinación, gestores municipales y estudiantes del Plan Modular de Prepa Abierta del Instituto de Educación Media Superior y Superior del Estado de Michoacán (IEMSyS).

**Esta entrega:** capa completa para el perfil **Gestor**, lista para presentar el demo del martes.

---

## Qué se incluye

### Base de datos (Drizzle + Postgres)
- `db/schema/index.ts` — schema completo con 12 tablas, 4 enums y todas las relaciones.
- `db/seed/municipios.ts` — los 113 municipios oficiales de Michoacán.
- `db/seed/modulos.ts` — los 21 módulos del Plan Modular oficial.
- `db/seed.ts` — script que siembra catálogos + crea usuario gestor demo de Pátzcuaro y admin demo.

### API (Express 5)
- `api/middleware/auth.ts` — auth por cookie firmada (HMAC), middleware `authRequired` y `requireRol`.
- `api/routes/auth.ts` — `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`.
- `api/routes/gestor.ts` — todos los endpoints del gestor (dashboard, CRUD alumnos, upload PDF).
- `api/index.ts` — server principal.

### Frontend (React + Vite + Tailwind v4 + wouter)
- `frontend/src/index.css` — design tokens institucionales (paleta guinda Michoacán).
- `frontend/src/lib/api.ts` — cliente HTTP + tipos TypeScript.
- `frontend/src/components/InstitutionalHeader.tsx` — header oficial con logos.
- `frontend/src/components/StatusBadge.tsx` — badges visuales de estado.
- `frontend/src/pages/Login.tsx` — pantalla de inicio de sesión institucional.
- `frontend/src/pages/gestor/GestorLayout.tsx` — layout con sidebar.
- `frontend/src/pages/gestor/GestorDashboard.tsx` — dashboard con KPIs.
- `frontend/src/pages/gestor/AlumnosList.tsx` — listado de "mis alumnos".
- `frontend/src/pages/gestor/NuevoAlumno.tsx` — formulario de alta.
- `frontend/src/pages/gestor/AlumnoDetalle.tsx` — detalle + uploader de PDFs.
- `frontend/src/App.tsx` — routing.

---

## Pasos de integración en el Replit (orden estricto)

### 1. Reemplazar el schema de la BD

Copia `db/schema/index.ts` a `lib/db/src/schema/index.ts` (sobrescribe el existente). Si hay archivos sueltos como `lib/db/src/schema/announcements.ts`, `documents.ts`, `students.ts`, `courses.ts` — los puedes **eliminar**, ya no aplican.

Asegúrate de que `lib/db/src/index.ts` siga exportando el schema:

```typescript
export * from './schema';
```

### 2. Instalar dependencias nuevas

En la raíz del Replit:

```bash
pnpm --filter @workspace/db add bcryptjs
pnpm --filter @workspace/db add -D @types/bcryptjs

pnpm --filter @workspace/api-server add bcryptjs cookie-parser cors multer
pnpm --filter @workspace/api-server add -D @types/bcryptjs @types/cookie-parser @types/cors @types/multer
```

### 3. Push del schema a la BD

```bash
pnpm --filter @workspace/db run push
```

Esto crea todas las tablas en Postgres.

### 4. Copiar y ejecutar el seed

Copia:
- `db/seed/municipios.ts` → `lib/db/src/seed/municipios.ts`
- `db/seed/modulos.ts` → `lib/db/src/seed/modulos.ts`
- `db/seed.ts` → `lib/db/src/seed.ts`

Agrega el script al `package.json` de `lib/db`:

```json
{
  "scripts": {
    "seed": "tsx src/seed.ts"
  }
}
```

Ejecuta:

```bash
pnpm --filter @workspace/db run seed
```

Deberías ver:
```
🌱 Iniciando seed de Prepa Abierta Michoacán...
📍 Sembrando municipios... ✓ 113 municipios en BD
📚 Sembrando módulos... ✓ 21 módulos en BD
📅 Creando convocatoria activa de demo... ✓
👤 Creando gestor demo de Pátzcuaro... ✓ gestor.patzcuaro@michoacan.gob.mx / demo1234
👤 Creando administrador demo... ✓ admin@michoacan.gob.mx / demo1234
```

### 5. Reemplazar las rutas del API

Copia los archivos de `api/` a `artifacts/api-server/src/`:

- `api/middleware/auth.ts` → `artifacts/api-server/src/middleware/auth.ts`
- `api/routes/auth.ts` → `artifacts/api-server/src/routes/auth.ts`
- `api/routes/gestor.ts` → `artifacts/api-server/src/routes/gestor.ts`
- `api/index.ts` → `artifacts/api-server/src/index.ts` (sobrescribe)

**Importante:** crea `artifacts/api-server/src/db.ts` con el cliente Drizzle:

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@workspace/db/schema';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
```

### 6. Reemplazar el frontend

Copia los archivos de `frontend/src/` a `artifacts/student-portal/src/` respetando rutas:

- `frontend/src/index.css` → `artifacts/student-portal/src/index.css` (sobrescribe — verifica que se preserve cualquier import de tailwind v4 que ya tengas)
- `frontend/src/lib/api.ts` → `artifacts/student-portal/src/lib/api.ts`
- `frontend/src/components/InstitutionalHeader.tsx` → `artifacts/student-portal/src/components/InstitutionalHeader.tsx`
- `frontend/src/components/StatusBadge.tsx` → `artifacts/student-portal/src/components/StatusBadge.tsx`
- `frontend/src/pages/Login.tsx` → `artifacts/student-portal/src/pages/Login.tsx`
- `frontend/src/pages/gestor/*` → `artifacts/student-portal/src/pages/gestor/*`
- `frontend/src/App.tsx` → `artifacts/student-portal/src/App.tsx`

Las páginas anteriores (`Inicio`, `Anuncios`, `Documentos`, `Estudiantes`, `Cursos`) del template TEC ya **no se usan**. Puedes borrarlas o dejarlas para referencia, pero el `App.tsx` nuevo no las enruta.

### 7. Cargar fuentes (opcional pero recomendado)

En `artifacts/student-portal/index.html`, dentro de `<head>`, agrega:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Lora:wght@500;600;700&display=swap" rel="stylesheet" />
```

### 8. Variables de entorno

En el Replit, asegúrate de tener:

```
DATABASE_URL=postgresql://...     # ya existe
SESSION_SECRET=alguna_cadena_larga_aleatoria
STORAGE_DIR=/tmp/prepa-storage    # opcional, por defecto /tmp/prepa-storage
```

### 9. Typecheck y arrancar

```bash
pnpm run typecheck
pnpm run dev    # o lo que uses para arrancar el proyecto
```

---

## Recorrido del demo (orden sugerido)

1. **Pantalla de login** — entras con `gestor.patzcuaro@michoacan.gob.mx` / `demo1234`.
2. **Dashboard del gestor** — muestras KPIs en cero y la convocatoria activa.
3. **Mis alumnos** — vacío (empty state institucional).
4. **Nuevo alumno** — capturas a "Ana María González Pérez" con CURP ficticia (18 caracteres) en vivo.
5. Sale la pantalla de éxito con credenciales temporales.
6. Click en "Subir documentos ahora" → vas al detalle del alumno.
7. Subes un PDF de prueba (cualquier PDF que tengas a mano) — queda en estado **Pendiente de revisión**.
8. Vuelves a "Mis alumnos" → ahora aparece Ana en la lista con su badge de estado y conteo de documentos.

---

## Credenciales de demo

| Rol | Email | Contraseña |
|-----|-------|------------|
| Gestor (Pátzcuaro) | `gestor.patzcuaro@michoacan.gob.mx` | `demo1234` |
| Admin | `admin@michoacan.gob.mx` | `demo1234` |

---

## Lo que NO está incluido (siguiente fase)

- Panel del administrador (aprobar pagos, generar fichas, calificar)
- Panel del estudiante (módulos, quizzes, perfil)
- Audit log con UI (la tabla y los inserts ya están — falta visualización)
- Importación del banco de preguntas (de la otra plataforma cloud)
- Aviso de privacidad como modal de primer login con consentimiento registrado
- Notificaciones por email
- Pagos (queda como UI placeholder)
- Migración de storage a Replit Object Storage / S3 (hoy: filesystem local)

---

## Paleta visual

| Token | Hex | Uso |
|-------|-----|-----|
| `--color-guinda-700` | `#7B1E3A` | Color institucional principal (Gobierno de Michoacán) |
| `--color-guinda-800` | `#5C1428` | Hover de botones primarios |
| `--color-guinda-600` | `#A02440` | Acentos secundarios |
| `--color-crema-100` | `#F8F4EC` | Fondo de aplicación |
| `--color-piedra-900` | `#2A2A2A` | Texto principal |
| `--color-aprobado` | `#2D7D46` | Estados aprobados |
| `--color-pendiente` | `#C77700` | Estados pendientes |
| `--color-rechazado` | `#B91C1C` | Estados rechazados |

Tipografía:
- **Lora** (serif) — títulos institucionales, números KPI
- **Inter** (sans) — cuerpo, formularios, navegación

---

## Notas técnicas

- El typecheck del schema, backend y frontend pasan **0 errores** en ambiente aislado.
- La auth es por cookie HMAC firmada (no JWT) — más simple, suficiente para el demo. En producción se sustituye por sessions tabla o JWT con refresh.
- El upload usa multer con disk storage. Para producción migrar a Replit Object Storage / S3.
- Las inscripciones se crean automáticamente al alta del alumno, vinculadas a la convocatoria activa.
- El estado de la inscripción avanza automáticamente al subir el primer documento (`pre_registro` → `documentos_pendientes`).

---

## Logos institucionales

El header usa un placeholder textual `GM` para el escudo de Gobierno de Michoacán. Para reemplazar por el SVG/PNG oficial:

1. Coloca el archivo en `artifacts/student-portal/public/escudo-michoacan.svg`
2. En `InstitutionalHeader.tsx`, reemplaza el div con clase `bg-[var(--color-guinda-700)]` por:
   ```tsx
   <img src="/escudo-michoacan.svg" alt="Gobierno de Michoacán" className="w-12 h-12" />
   ```

Lo mismo aplica al logo del IEMSyS si quieres mostrarlo en el lateral derecho del header.
