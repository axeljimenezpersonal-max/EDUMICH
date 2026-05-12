FROM node:24-slim
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@11

# Copy workspace manifest files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* tsconfig.base.json ./

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

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
