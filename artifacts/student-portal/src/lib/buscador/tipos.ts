/**
 * Tipos del buscador global de Modula.
 *
 * El buscador tiene TRES capas, y ese orden es deliberado:
 *
 *  1. `dato`     — información del propio usuario ya resuelta ("tu pago vence
 *                  el 14 de agosto"). Es lo único que contesta de verdad.
 *  2. `respuesta`— ayuda escrita: la duda se resuelve leyendo, sin navegar.
 *  3. `seccion`  — a dónde ir. El clásico command palette.
 *  4. `entidad`  — personas, folios (gestor y admin). Llega en la fase 2.
 *
 * La razón de que `dato` vaya primero: el objetivo del buscador es que el
 * alumno NO tenga que escribirle a la Secretaría. Mandarlo a una pantalla es
 * el último recurso, no el primero.
 */

export type RolBuscador = 'estudiante' | 'gestor' | 'admin' | 'direccion';

export type TipoResultado = 'dato' | 'respuesta' | 'seccion' | 'entidad';

export interface Resultado {
  id: string;
  tipo: TipoResultado;
  titulo: string;
  /** Respuesta o descripción. En `respuesta` es el texto que resuelve la duda. */
  cuerpo?: string;
  /** A dónde lleva al activarlo. Sin ruta, el resultado sólo informa. */
  ruta?: string;
  /**
   * Ancla `data-tour` dentro de la ruta. Permite llevar al usuario al bloque
   * exacto, no sólo a la página.
   */
  ancla?: string;
  /** Nombre de icono de lucide-react. */
  icono?: string;
  /** Etiqueta corta a la derecha ("Pagos", "Vence en 3 días"). */
  pista?: string;
  /** Puntaje de relevancia; lo asigna el motor, no el índice. */
  puntaje?: number;
}

/**
 * Una entrada del índice estático (secciones y respuestas).
 *
 * `terminos` es la pieza que hace útil al buscador: son las palabras que la
 * gente REALMENTE escribe, no las que usa la interfaz. El alumno no busca
 * "expediente", busca "papeles", "documentos" o "acta".
 */
export interface EntradaIndice {
  id: string;
  tipo: Extract<TipoResultado, 'respuesta' | 'seccion'>;
  titulo: string;
  cuerpo?: string;
  ruta?: string;
  ancla?: string;
  icono?: string;
  pista?: string;
  /** Roles que pueden ver esta entrada. */
  roles: RolBuscador[];
  /** Sinónimos y jerga que deben encontrarla. */
  terminos: string[];
}

/** Contexto vivo del usuario, para la capa `dato`. */
export interface ContextoBuscador {
  rol: RolBuscador;
  /** Resultados ya resueltos con datos del usuario. Los arma cada layout. */
  datos?: Resultado[];
}
