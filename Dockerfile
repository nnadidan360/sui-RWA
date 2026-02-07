# Backend Dockerfile for RWA Lending Protocol

# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY ../shared-types/ ./shared-types/

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS runner

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 backend
RUN adduser --system --uid 1001 backend

# Install production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application
COPY --from=builder --chown=backend:backend /app/dist ./dist
COPY --from=builder --chown=backend:backend /app/shared-types ./shared-types

# Create logs directory
RUN mkdir -p logs && chown backend:backend logs

USER backend

EXPOSE 3001

ENV NODE_ENV production
ENV PORT 3001

CMD ["node", "dist/server.js"]