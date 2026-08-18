# Build stage
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/services ./services
COPY --from=builder /app/types.ts ./types.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Install typescript/tsx globally or locally to run the TypeScript server.ts file
RUN npm install -g tsx typescript @types/node @types/express

EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000

CMD ["tsx", "server.ts"]
