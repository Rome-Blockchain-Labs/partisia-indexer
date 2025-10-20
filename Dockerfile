FROM oven/bun:1.2.21-alpine

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY src ./src
COPY tsconfig.json ./
COPY example-graph ./example-graph

EXPOSE 3002

CMD ["bun", "run", "src/index.ts"]
