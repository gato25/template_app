# Stage 1: Build
FROM oven/bun:slim AS builder
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install

# Copy codebase and compile SvelteKit
COPY . .
RUN bun run build

# Prune development dependencies to keep the production image tiny!
RUN rm -rf node_modules bun.lock && bun install --production

# Stage 2: Runner
FROM oven/bun:slim AS runner
WORKDIR /app

# Copy built files, manifest and node modules from builder
COPY --from=builder /app/package.json ./
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules

ENV PORT=3000
ENV HOST=0.0.0.0
EXPOSE 3000

CMD ["bun", "build/index.js"]
