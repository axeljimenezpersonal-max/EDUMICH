import { type ReactNode } from 'react';
import { ShieldCheck, ArrowLeft } from 'lucide-react';

function P({ children }: { children: ReactNode }) {
  return <p className="text-sm text-stone-700 leading-relaxed mb-3 last:mb-0">{children}</p>;
}

function Ul({ items }: { items: string[] }) {
  return (
    <ul className="mb-3 last:mb-0 space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="text-sm text-stone-700 leading-relaxed flex gap-2">
          <span className="mt-0.5 text-[var(--color-guinda-700)] shrink-0 select-none">–</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function CalloutSensible({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 border-l-[3px] border-pink-600 bg-pink-50 rounded-r-md px-4 py-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-pink-700 mb-2">
        <ShieldCheck size={11} />
        Datos personales sensibles — requieren consentimiento expreso
      </div>
      <div className="text-sm text-stone-700 leading-relaxed">{children}</div>
    </div>
  );
}

function CalloutDorado({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 border-l-[3px] border-amber-500 bg-amber-50 rounded-r-md px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-widest text-amber-700 mb-2">
        Finalidades secundarias — no necesarias para el servicio
      </div>
      <div className="text-sm text-stone-700 leading-relaxed">{children}</div>
    </div>
  );
}

type Seccion = { n: number; titulo: string; content: ReactNode };

const SECCIONES: Seccion[] = [
  {
    n: 1,
    titulo: 'Identidad y domicilio del responsable',
    content: (
      <>
        <P>
          <>
            El{' '}
            <strong>
              Instituto de Educación Media Superior y Superior del Estado de Michoacán (IEMSyS)
            </strong>{' '}
            (en adelante, "el Responsable"), a través de la Coordinación Estatal de Preparatoria
            Abierta, es el responsable del tratamiento de los datos personales que se recaban a
            través de la plataforma <strong>Modula</strong>, con domicilio en{' '}
            <strong>
              Av. Lázaro Cárdenas 1775, Col. Chapultepec Norte, C.P. 58260, Morelia, Michoacán
            </strong>
            , teléfono 443 298 40 99.
          </>
        </P>
        <P>
          <>
            Modula es el sistema tecnológico mediante el cual se gestiona el servicio educativo de
            Preparatoria Abierta. Su operación técnica está a cargo de un proveedor que actúa como{' '}
            <strong>encargado del tratamiento</strong>, en virtud de una licencia de uso de la
            plataforma, y que trata los datos personales únicamente por cuenta y bajo instrucciones
            del Responsable, sin facultad de uso para fines propios.
          </>
        </P>
      </>
    ),
  },
  {
    n: 2,
    titulo: 'Datos personales que se someten a tratamiento',
    content: (
      <>
        <P>
          Para las finalidades señaladas en este aviso, el Responsable trata las siguientes
          categorías de datos personales:
        </P>
        <Ul
          items={[
            'Datos de identificación y contacto: nombre completo, Clave Única de Registro de Población (CURP), fecha de nacimiento, sexo, teléfono, correo electrónico, domicilio y municipio de residencia.',
            'Datos académicos: último nivel de estudios cursado, módulos inscritos y aprobados, calificaciones, fechas y sedes de examen, matrícula oficial de la Dirección General del Bachillerato (DGB) y situación de inscripción.',
            'Datos documentales: acta de nacimiento, identificación oficial (INE), comprobante de domicilio y comprobante de pago.',
            'Datos de conexión: dirección IP, tipo de navegador y dispositivo, y registros de actividad dentro de la plataforma, recabados con fines de seguridad y trazabilidad.',
          ]}
        />
        <CalloutSensible>
          <>
            Se hace de su conocimiento que se tratan los siguientes <strong>datos personales sensibles</strong>:{' '}
            <strong>imagen / fotografía</strong> y los{' '}
            <strong>datos biométricos contenidos en la identificación oficial (INE)</strong>,
            utilizados exclusivamente para la elaboración de la credencial estudiantil digital, la
            validación de identidad y la integración del expediente. El Responsable se compromete a
            que estos datos sean tratados bajo medidas de seguridad reforzadas y con estricto apego
            al principio de finalidad.
          </>
        </CalloutSensible>
      </>
    ),
  },
  {
    n: 3,
    titulo: 'Fundamento legal',
    content: (
      <P>
        <>
          El tratamiento de sus datos personales se realiza con fundamento en los artículos 6°,
          apartado A, y 16, párrafo segundo, de la{' '}
          <strong>Constitución Política de los Estados Unidos Mexicanos</strong>; los artículos
          relativos de la{' '}
          <strong>
            Ley General de Protección de Datos Personales en Posesión de Sujetos Obligados
            (LGPDPPSO)
          </strong>{' '}
          y de la{' '}
          <strong>
            Ley de Protección de Datos Personales en Posesión de Sujetos Obligados del Estado de
            Michoacán de Ocampo
          </strong>{' '}
          (Periódico Oficial, 13 de noviembre de 2017); la Ley General de Educación y la Ley de
          Educación para el Estado de Michoacán de Ocampo; así como en el Decreto de creación del
          Instituto de Educación Media Superior y Superior del Estado de Michoacán, como organismo
          público descentralizado, de fecha 15 de febrero de 2022, y su Reglamento Interior
          (Periódico Oficial, 15 de junio de 2022).
        </>
      </P>
    ),
  },
  {
    n: 4,
    titulo: 'Finalidades del tratamiento',
    content: (
      <>
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">
          Finalidades primarias — necesarias para el servicio
        </p>
        <Ul
          items={[
            'Registrar e inscribir a las personas estudiantes en el programa de Preparatoria Abierta.',
            'Integrar y resguardar el expediente académico y documental.',
            'Verificar la identidad y autenticidad de la documentación presentada.',
            'Gestionar pagos de derechos, calificaciones, programación y aplicación de exámenes.',
            'Emitir constancias, fichas de registro, credencial estudiantil digital y la matrícula oficial.',
            'Generar reportes institucionales y dar cumplimiento a obligaciones de transparencia y rendición de cuentas.',
            'Comunicar avisos, convocatorias e información relevante del servicio educativo.',
          ]}
        />
        <CalloutDorado>
          <>
            <strong>Elaboración de estadísticas e indicadores de mejora del servicio</strong> en
            forma disociada. Si usted no desea que sus datos se traten para esta finalidad, puede
            manifestarlo a través de los medios señalados en el punto 7. Su negativa no será motivo
            para negarle el servicio educativo.
          </>
        </CalloutDorado>
      </>
    ),
  },
  {
    n: 5,
    titulo: 'Transferencias de datos',
    content: (
      <>
        <P>
          Sus datos podrán transferirse, sin requerir su consentimiento conforme a la LGPDPPSO, a:
        </P>
        <Ul
          items={[
            'La Dirección General del Bachillerato (DGB) y demás autoridades educativas federales competentes, para la asignación de la matrícula oficial y la certificación de estudios de Preparatoria Abierta.',
            'Autoridades competentes cuando exista mandato legal, requerimiento de autoridad u orden judicial.',
          ]}
        />
        <P>
          Fuera de estos supuestos, no se realizarán transferencias de sus datos sin su
          consentimiento. El proveedor que opera la plataforma y los servicios de infraestructura en
          la nube actúan como <strong>encargados</strong>, no como destinatarios de transferencias,
          y están obligados contractualmente a la confidencialidad y seguridad de la información.
        </P>
      </>
    ),
  },
  {
    n: 6,
    titulo: 'Medidas de seguridad',
    content: (
      <P>
        El Responsable ha implementado medidas de seguridad administrativas, físicas y técnicas para
        proteger sus datos personales contra daño, pérdida, alteración, destrucción o uso, acceso o
        tratamiento no autorizado, conforme a la LGPDPPSO. El cumplimiento de estas medidas es
        exigible también al encargado del tratamiento.
      </P>
    ),
  },
  {
    n: 7,
    titulo: 'Derechos ARCO y medios para ejercerlos',
    content: (
      <>
        <P>
          <>
            Usted tiene derecho a{' '}
            <strong>Acceder, Rectificar, Cancelar y Oponerse</strong> (derechos ARCO) al
            tratamiento de sus datos personales, así como a revocar el consentimiento otorgado.
          </>
        </P>
        <P>
          Para ejercerlos, deberá presentar una solicitud ante la{' '}
          <strong>Unidad de Transparencia</strong> del Responsable, por cualquiera de estos medios:
        </P>
        <Ul
          items={[
            'Domicilio: Av. Lázaro Cárdenas 1775, Col. Chapultepec Norte, C.P. 58260, Morelia, Michoacán.',
            'Correo electrónico de la Unidad de Transparencia: transparencia.iemsysem@michoacan.gob.mx',
            'Plataforma Nacional de Transparencia (PNT): www.plataformadetransparencia.org.mx',
          ]}
        />
        <P>
          La solicitud deberá contener: nombre del titular y medio para recibir notificaciones;
          documento que acredite su identidad o, en su caso, la representación; descripción clara de
          los datos y del derecho que desea ejercer.
        </P>
      </>
    ),
  },
  {
    n: 8,
    titulo: 'Revocación del consentimiento',
    content: (
      <P>
        Usted puede revocar en cualquier momento el consentimiento otorgado para el tratamiento de
        sus datos, en el entendido de que dicha revocación no podrá tener efectos retroactivos y
        que, en ciertos casos, podría implicar la imposibilidad de continuar prestando el servicio
        educativo. La solicitud se presenta por los mismos medios del punto 7.
      </P>
    ),
  },
  {
    n: 9,
    titulo: 'Datos de personas menores de edad',
    content: (
      <P>
        Cuando la persona titular sea menor de edad, su tratamiento se realizará privilegiando en
        todo momento el interés superior de la niñez y la adolescencia, y se requerirá el
        consentimiento de quien ejerza la patria potestad o tutela cuando así corresponda.
      </P>
    ),
  },
  {
    n: 10,
    titulo: 'Uso de tecnologías de rastreo en la plataforma',
    content: (
      <P>
        La plataforma Modula utiliza cookies y tecnologías análogas estrictamente necesarias para
        mantener la sesión iniciada y garantizar la seguridad del acceso. No se utilizan para fines
        publicitarios ni de elaboración de perfiles comerciales.
      </P>
    ),
  },
  {
    n: 11,
    titulo: 'Cambios al aviso de privacidad',
    content: (
      <P>
        El presente aviso podrá ser modificado. Cualquier cambio se hará de su conocimiento a través
        del portal institucional del Responsable (iemsysem.michoacan.gob.mx) y de la propia
        plataforma Modula, así como, en su caso, de la sección de avisos de privacidad de la
        Plataforma Nacional de Transparencia.
      </P>
    ),
  },
  {
    n: 12,
    titulo: 'Autoridad garante',
    content: (
      <P>
        <>
          Si considera que su derecho a la protección de datos personales ha sido vulnerado, podrá
          presentar un recurso de revisión o denuncia ante el{' '}
          <strong>
            Instituto Michoacano de Acceso a la Información y Protección de Datos Personales (IMAIP)
          </strong>
          , órgano garante en el Estado de Michoacán, con domicilio en Av. Camelinas 571, Col. Félix
          Ireta, C.P. 58070, Morelia, Michoacán; correo imaip@imaip.org.mx; o bien a través de la{' '}
          <strong>Plataforma Nacional de Transparencia</strong>{' '}
          (www.plataformadetransparencia.org.mx).
        </>
      </P>
    ),
  },
];

export default function AvisoPrivacidad() {
  return (
    <div className="min-h-screen bg-stone-50">
      {/* Banda institucional */}
      <div className="bg-[var(--color-guinda-700)] text-white text-xs">
        <div className="max-w-7xl mx-auto px-4 py-1.5">
          <span className="font-medium tracking-wide">
            GOBIERNO DEL ESTADO DE MICHOACÁN · HONESTIDAD Y TRABAJO
          </span>
        </div>
      </div>

      {/* Encabezado */}
      <div className="bg-[var(--color-guinda-700)] text-white">
        <div className="max-w-[780px] mx-auto px-4 py-6">
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-white/75 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft size={13} />
            Volver
          </button>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={17} className="opacity-80" />
            <span className="text-xs font-semibold uppercase tracking-widest opacity-75">
              Datos personales
            </span>
          </div>
          <h1
            className="font-serif font-bold text-white"
            style={{ fontSize: 26, lineHeight: 1.2 }}
          >
            Aviso de Privacidad Integral
          </h1>
          <p className="text-white/75 text-sm mt-1">
            Plataforma Modula &middot; Preparatoria Abierta &middot; Plan 22 Modular
          </p>
        </div>
      </div>

      {/* Cuerpo */}
      <div className="max-w-[780px] mx-auto px-4 py-8">
        <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
          {/* Nota legal */}
          <div className="px-8 py-3.5 bg-stone-50 border-b border-stone-200">
            <p className="text-xs text-stone-500 leading-relaxed">
              Documento elaborado conforme a la{' '}
              <strong className="text-stone-600">
                Ley General de Protección de Datos Personales en Posesión de Sujetos Obligados
                (LGPDPPSO)
              </strong>{' '}
              y su normatividad derivada.
            </p>
          </div>

          {/* Secciones */}
          <div className="px-8 py-6 divide-y divide-stone-100">
            {SECCIONES.map((s) => (
              <section key={s.n} className="py-6 first:pt-0">
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="shrink-0 w-6 h-6 rounded-full bg-[var(--color-guinda-700)] text-white flex items-center justify-center font-bold"
                    style={{ fontSize: 11 }}
                  >
                    {s.n}
                  </div>
                  <h2
                    className="font-serif font-semibold text-stone-900 pt-0.5"
                    style={{ fontSize: 15 }}
                  >
                    {s.titulo}
                  </h2>
                </div>
                <div className="ml-9">{s.content}</div>
              </section>
            ))}
          </div>

          {/* Pie */}
          <div className="px-8 py-4 bg-stone-50 border-t border-stone-200">
            <p className="text-xs text-stone-400">
              Última actualización:{' '}
              <span className="font-medium text-stone-500">
                [FECHA DE APROBACIÓN/PUBLICACIÓN — confirmar antes de publicar]
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
