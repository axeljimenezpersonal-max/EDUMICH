FROM node:24-slim
WORKDIR /app

# Reconocimiento de caracteres para leer la banda de datos del reverso del INE
# (ver services/lecturaDocumentos.ts).
#
# Va DENTRO de la imagen y no en un servicio de terceros a propósito: mandar la
# identificación o el acta de un menor a la nube de otra empresa es una
# transferencia de datos personales que la LGPDPPSO exige tener en el aviso de
# privacidad y respaldada por contrato. Aquí el documento no sale del servidor
# del Estado.
#
# Sólo el idioma español; el paquete completo son cientos de MB y no se usan.
#
# `libreoffice-writer` convierte a PDF los documentos de Word que manda la
# gente (ver services/aPdf.ts). Es lo más pesado de esta imagen — del orden de
# medio giga con sus dependencias, Java incluido — y por eso el código NO
# depende de que esté: si se quita esta palabra, las fotos se siguen
# convirtiendo (eso lo hace `pdf-lib`, sin instalar nada) y sólo los .docx se
# rechazan con un mensaje que dice qué hacer. Es decir: esta línea se puede
# borrar sin tocar una sola línea de TypeScript.
#
# `--no-install-recommends` importa aquí más que en ningún otro lado: sin él
# entran el escritorio, las fuentes y los diccionarios de todos los idiomas.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      tesseract-ocr tesseract-ocr-spa \
      libreoffice-writer \
 && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN npm install -g pnpm@11

# Copy workspace manifest files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* tsconfig.base.json .npmrc ./

# Copy all source packages
COPY lib/ lib/
COPY artifacts/ artifacts/
COPY attached_assets/ attached_assets/

# Install dependencies (skip preinstall hook that checks user agent in non-TTY envs)
RUN pnpm install --no-frozen-lockfile --ignore-scripts && \
    pnpm rebuild

# Build frontend
RUN pnpm --filter './artifacts/student-portal' run build

# Build API server
RUN pnpm --filter './artifacts/api-server' run build

EXPOSE 3001
ENV NODE_ENV=production

CMD sh -c "pnpm --filter '@workspace/db' run push && node --enable-source-maps artifacts/api-server/dist/index.mjs"
