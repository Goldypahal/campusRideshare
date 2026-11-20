# Multi-stage Dockerfile for CampusRideshare Node API + Client
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build frontend and backend
RUN npm run build

# Production runtime stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Copy compiled assets from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/migrations ./migrations

EXPOSE 5000

# Run compiled JS entrypoint
CMD ["node", "dist/index.js"]
