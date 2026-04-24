# Build stage
FROM node:22-bookworm AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source and build frontend
COPY . .
RUN npm run build

# Production stage
FROM node:22-bookworm

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm install --omit=dev && npm rebuild sqlite3 --build-from-source

# Copy build artifacts and necessary files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/src ./src
COPY --from=builder /app/workspace ./workspace
# We need tsx to run server.ts in production as it uses ESM + TS
RUN npm install -g tsx

# Create non-root user for security
RUN useradd -m -u 1001 trailflow && chown -R trailflow:trailflow /app
USER trailflow

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" || exit 1

# Start the application
CMD ["tsx", "server.ts"]
