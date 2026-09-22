FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/ ./packages/
COPY apps/notification-service/ ./apps/notification-service/
RUN npm install
RUN npm run build --workspace=@tkt/proto
RUN npm run build --workspace=@tkt/common
RUN npm run build --workspace=apps/notification-service

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/ ./packages/
COPY --from=builder /app/apps/notification-service/dist ./apps/notification-service/dist
COPY --from=builder /app/apps/notification-service/package.json ./apps/notification-service/package.json

CMD ["node", "apps/notification-service/dist/main"]
