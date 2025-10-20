FROM oven/bun:1.2.21-alpine

WORKDIR /app

# Install Node.js for frontend build
RUN apk add --no-cache nodejs npm

# Install backend dependencies
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy backend source
COPY src ./src
COPY tsconfig.json ./

# Copy and build frontend
COPY example-graph ./example-graph
RUN cd example-graph && npm install --legacy-peer-deps && npm run build

EXPOSE 3002

CMD ["bun", "run", "src/index.ts"]
