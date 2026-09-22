FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/ ./packages/
COPY apps/inventory-service/ ./apps/inventory-service/
RUN npm install
RUN npm run build --workspace=@tkt/proto
RUN npm run build --workspace=@tkt/common
RUN npm run build --workspace=apps/inventory-service

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/ ./packages/
COPY --from=builder /app/apps/inventory-service/dist ./apps/inventory-service/dist
COPY --from=builder /app/apps/inventory-service/package.json ./apps/inventory-service/package.json

EXPOSE 50053
CMD ["node", "apps/inventory-service/dist/main"]
