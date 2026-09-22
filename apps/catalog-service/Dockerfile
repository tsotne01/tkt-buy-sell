FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/ ./packages/
COPY apps/catalog-service/ ./apps/catalog-service/
RUN npm install
RUN npm run build --workspace=@tkt/proto
RUN npm run build --workspace=@tkt/common
RUN npm run build --workspace=apps/catalog-service

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/ ./packages/
COPY --from=builder /app/apps/catalog-service/dist ./apps/catalog-service/dist
COPY --from=builder /app/apps/catalog-service/package.json ./apps/catalog-service/package.json

EXPOSE 50052
CMD ["node", "apps/catalog-service/dist/main"]
