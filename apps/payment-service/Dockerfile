FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/ ./packages/
COPY apps/payment-service/ ./apps/payment-service/
RUN npm install
RUN npm run build --workspace=@tkt/proto
RUN npm run build --workspace=@tkt/common
RUN npm run build --workspace=apps/payment-service

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/ ./packages/
COPY --from=builder /app/apps/payment-service/dist ./apps/payment-service/dist
COPY --from=builder /app/apps/payment-service/package.json ./apps/payment-service/package.json

CMD ["node", "apps/payment-service/dist/main"]
