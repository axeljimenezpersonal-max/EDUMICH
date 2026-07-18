/**
 * Catálogo de secciones por rol.
 *
 * Sirve para dos cosas que la telemetría por sí sola no puede hacer:
 *
 *  1. Ponerle nombre legible a una clave. La base guarda `/gestor/alumnos`;
 *     el tablero debe decir "Mis alumnos".
 *  2. Saber qué NO se usó. Los contadores solo tienen filas de lo que alguien
 *     abrió; sin este catálogo no hay forma de listar lo que nadie tocó, que
 *     suele ser el dato más accionable.
 *
 * Las claves son las rutas ya normalizadas (ver `normalizarRuta` en uso.ts).
 * Si se agrega una sección a un menú, agrégala también aquí o aparecerá en el
 * tablero como clave cruda y sin nombre.
 */

export type Rol = 'estudiante' | 'gestor' | 'admin' | 'direccion';

export interface SeccionCatalogo {
  clave: string;
  etiqueta: string;
}

export const CATALOGO: Record<Rol, SeccionCatalogo[]> = {
  estudiante: [
    { clave: '/estudiante', etiqueta: 'Inicio' },
    { clave: '/estudiante/expediente', etiqueta: 'Expediente' },
    { clave: '/estudiante/convocatoria', etiqueta: 'Inscripción' },
    { clave: '/estudiante/pagos', etiqueta: 'Pagos' },
    { clave: '/estudiante/calificaciones', etiqueta: 'Calificaciones' },
    { clave: '/estudiante/modulos', etiqueta: 'Pruebas' },
    { clave: '/estudiante/identificacion', etiqueta: 'Identificación' },
    { clave: '/estudiante/mensajes', etiqueta: 'Mensajes' },
    { clave: '/estudiante/perfil', etiqueta: 'Mi perfil' },
    { clave: '/estudiante/avisos', etiqueta: 'Avisos' },
    { clave: '/estudiante/aula', etiqueta: 'Aula virtual' },
  ],
  gestor: [
    { clave: '/gestor', etiqueta: 'Inicio' },
    { clave: '/gestor/alumnos', etiqueta: 'Mis alumnos' },
    { clave: '/gestor/alumnos/nuevo', etiqueta: 'Nuevo alumno' },
    { clave: '/gestor/pagos', etiqueta: 'Pagos' },
    { clave: '/gestor/calificaciones', etiqueta: 'Calificaciones' },
    { clave: '/gestor/mensajes', etiqueta: 'Mensajes' },
    { clave: '/gestor/aula', etiqueta: 'Aula virtual' },
  ],
  admin: [
    { clave: '/admin', etiqueta: 'Inicio' },
    { clave: '/admin/alumnos', etiqueta: 'Alumnos' },
    { clave: '/admin/gestores', etiqueta: 'Gestores' },
    { clave: '/admin/solicitudes', etiqueta: 'Solicitudes' },
    { clave: '/admin/ordenes-pago', etiqueta: 'Pagos' },
    { clave: '/admin/calificaciones', etiqueta: 'Calificaciones' },
    { clave: '/admin/verificacion-pase', etiqueta: 'Verificación de pase' },
    { clave: '/admin/convocatorias', etiqueta: 'Convocatorias' },
    { clave: '/admin/sedes', etiqueta: 'Sedes' },
    { clave: '/admin/anuncios', etiqueta: 'Anuncios' },
    { clave: '/admin/chat', etiqueta: 'Chat en vivo' },
    { clave: '/admin/reportes', etiqueta: 'Reportes' },
    { clave: '/admin/configuracion', etiqueta: 'Configuración' },
  ],
  direccion: [
    { clave: '/direccion', etiqueta: 'Panorama' },
    { clave: '/direccion/academico', etiqueta: 'Académico' },
    { clave: '/direccion/operacion', etiqueta: 'Operación' },
    { clave: '/direccion/salud', etiqueta: 'Salud del sistema' },
    { clave: '/direccion/proyecciones', etiqueta: 'Proyecciones' },
    { clave: '/direccion/reportes', etiqueta: 'Reportes' },
    { clave: '/direccion/uso', etiqueta: 'Uso de la plataforma' },
  ],
};

export const ROLES: Rol[] = ['estudiante', 'gestor', 'admin', 'direccion'];

export const NOMBRE_ROL: Record<Rol, string> = {
  estudiante: 'Alumno',
  gestor: 'Gestor',
  admin: 'Administración',
  direccion: 'Dirección',
};

/** Nombre legible de una clave; si no está en el catálogo, la clave cruda. */
export function etiquetaDe(rol: Rol, clave: string): string {
  return CATALOGO[rol]?.find((s) => s.clave === clave)?.etiqueta ?? clave;
}
