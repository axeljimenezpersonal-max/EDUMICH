# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Student Portal web app for a Mexican university (Portal Estudiantil TEC), styled after Tecnológico de Monterrey's experiencia21 portal.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite, TailwindCSS, shadcn/ui, wouter (routing)

## Artifacts

### Student Portal (`artifacts/student-portal`)
- Preview path: `/`
- Full-stack student information portal in Spanish
- Blue & white institutional design (primary: #2672EC)
- Pages: Inicio (Dashboard), Anuncios, Documentos, Estudiantes, Cursos

### API Server (`artifacts/api-server`)
- Preview path: `/api`
- Express 5 REST API
- Routes: /announcements, /documents, /students, /courses, /dashboard/summary

## Database Schema (`lib/db/src/schema/`)
- `announcements` — institutional announcements with priority levels
- `documents` — student document submissions with status tracking
- `students` — student profiles with matricula, program, semester, campus
- `courses` — course listings with professor, schedule, room info

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
