FROM oven/bun:1.2.21-alpine

WORKDIR /app

COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile

COPY src ./src
COPY tsconfig.json ./

EXPOSE 3001

CMD ["bun", "run", "src/index.ts"]
