FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/ ./packages/
COPY apps/order-service/ ./apps/order-service/
RUN npm install
RUN npm run build --workspace=@tkt/proto
RUN npm run build --workspace=@tkt/common
RUN npm run build --workspace=apps/order-service

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/ ./packages/
COPY --from=builder /app/apps/order-service/dist ./apps/order-service/dist
COPY --from=builder /app/apps/order-service/package.json ./apps/order-service/package.json

EXPOSE 50054
CMD ["node", "apps/order-service/dist/main"]
