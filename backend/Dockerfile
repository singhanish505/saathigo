# SaathiGo API - production-grade multi-stage Docker build.
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-fund --no-audit

FROM node:20-alpine AS runtime
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=deps /app/node_modules ./node_modules
COPY --chown=app:app . .
USER app
ENV NODE_ENV=production PORT=4000
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=4s --retries=3 CMD wget -qO- http://localhost:4000/healthz || exit 1
CMD ["node", "src/server.js"]
