# Build from the repository root (the starter depends on the workspace `nestforge` package):
#   docker build -f templates/starter/Dockerfile -t nestforge-starter .
FROM node:22-slim AS build
RUN npm install -g pnpm@11.2.2
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter nestforge build && pnpm --filter nestforge-starter build
# Self-contained production tree (workspace package copied in, dev dependencies dropped).
RUN pnpm --filter nestforge-starter --prod --legacy deploy /out

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out/node_modules ./node_modules
COPY --from=build --chown=node:node /out/package.json ./package.json
COPY --from=build --chown=node:node /repo/templates/starter/dist ./dist
USER node
EXPOSE 4000
# Run migrations separately: docker run --rm <image> node node_modules/typeorm/cli.js migration:run -d dist/infrastructure/data-source.js
CMD ["node", "dist/main.js"]
