FROM oven/bun:1.2.21-alpine

WORKDIR /app

# Install backend dependencies
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy backend source
COPY src ./src
COPY tsconfig.json ./

# Copy pre-built frontend (build locally before deploying)
COPY example-graph/build ./example-graph/build

EXPOSE 3002

CMD ["bun", "run", "src/index.ts"]
