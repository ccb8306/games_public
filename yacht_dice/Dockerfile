# syntax=docker/dockerfile:1
FROM node:24.21.0-bookworm-slim AS manifests
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
COPY shared/package.json ./shared/package.json

FROM manifests AS build
RUN npm ci
COPY tsconfig.base.json ./
COPY client ./client
COPY server ./server
COPY shared ./shared
RUN npm run build

FROM manifests AS production-dependencies
RUN npm ci --omit=dev --workspace=@yacht/server --workspace=@yacht/shared --include-workspace-root=false && npm cache clean --force

FROM node:24.21.0-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DISCONNECT_GRACE_SECONDS=60
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=production-dependencies /app/package.json ./package.json
COPY --from=production-dependencies /app/server/package.json ./server/package.json
COPY --from=production-dependencies /app/shared/package.json ./shared/package.json
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/client/dist ./client/dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/dist/index.js"]
