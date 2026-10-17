# Build from the repository root (the starter depends on the workspace `nestforge` package):
#   docker build -f templates/starter/Dockerfile -t nestforge-starter .                    # the API
#   docker build -f templates/starter/Dockerfile --target migrate -t nestforge-migrate .   # applies migrations
FROM node:22-slim AS build
# Prisma looks for libssl at generate time; without it it prints a warning on every install.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@11.2.2
WORKDIR /repo
COPY . .
# `postinstall` runs `prisma generate`, producing templates/starter/generated/prisma.
RUN pnpm install --frozen-lockfile
RUN pnpm --filter nestforge build && pnpm --filter nestforge-starter build

# One-shot job: `prisma migrate deploy`. Kept apart from the runtime image because the Prisma CLI is large.
FROM build AS migrate
WORKDIR /repo/templates/starter
CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

# Self-contained production tree (workspace package copied in, dev dependencies dropped).
FROM build AS prune
RUN pnpm --filter nestforge-starter --prod --legacy deploy /out
# Drops the Prisma CLI and friends that pnpm keeps as an (optional) peer of @prisma/client.
RUN node templates/starter/scripts/prune-pnpm-store.mjs /out

FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prune --chown=node:node /out/node_modules ./node_modules
COPY --from=prune --chown=node:node /out/package.json ./package.json
COPY --from=build --chown=node:node /repo/templates/starter/dist ./dist
# The compiled code finds the client at ../../generated from dist/infrastructure/prisma.
COPY --from=build --chown=node:node /repo/templates/starter/generated ./generated
USER node
EXPOSE 4000
CMD ["node", "dist/main.js"]
