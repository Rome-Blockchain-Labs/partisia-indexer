# development/deployment

## quick start

tunnel to server from your local machine
```bash
ssh -L 58081:95.216.235.72:18080 root@helhetz02.romenet.io -N -v
```

```bash
git clone repo
cd partisia-indexer
cp .env.example .env
# edit .env
docker compose up -d
```

## manual setup

### requirements
- node 18+ or bun
- postgres 14+

### database
```sql
createdb ls_indexer
createuser indexer -P
grant all on database ls_indexer to indexer;
```

### environment
```bash
# .env
API_PORT=3002
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ls_indexer
DB_USER=indexer
DB_PASSWORD=changeme

PARTISIA_API_URL=https://reader.partisiablockchain.com
LS_CONTRACT=02fc82abf81cbb36acfe196faa1ad49ddfa7abdda6
DEPLOYMENT_BLOCK=10682802

COINGECKO_API_KEY=optional
```

### run
```bash
bun install
bun run dev        # development
bun run build && bun start  # production
```

## docker

```yaml
# docker-compose.yml
services:
  api:
    build: .
    ports: ["3002:3002"]
    environment:
      DB_HOST: postgres
      DB_PASSWORD: changeme
    depends_on: [postgres]

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: ls_indexer
      POSTGRES_USER: indexer
      POSTGRES_PASSWORD: changeme
    volumes: [postgres_data:/var/lib/postgresql/data]

volumes:
  postgres_data:
```

## production

### reverse proxy (nginx)
```nginx
location / {
    proxy_pass http://localhost:3002;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

### process management (pm2)
```bash
npm i -g pm2
pm2 start bun --name indexer -- run start
pm2 save
pm2 startup
```

### monitoring
- health: `curl localhost:3002/health`
- indexer: `curl localhost:3002/status`
- logs: `pm2 logs indexer`

### backup
```bash
# backup
pg_dump ls_indexer > backup.sql

# restore
psql ls_indexer < backup.sql
```

## performance

indexer processes ~75 blocks/second with:
- batch size: 100 blocks
- concurrency: 10 workers
- interval: 10 seconds

database connection pool: 20 connections, 2s timeout.

api response time: ~8ms for basic endpoints.

## security

- use strong postgres passwords
- configure cors for production
- enable ssl/tls
- rotate api keys regularly
- run behind reverse proxy

## troubleshooting

### port in use
```bash
lsof -i :3002
kill <pid>
```

### database connection
check postgres is running, credentials, network.

### indexer stuck
check partisia api availability, rate limits.

### no price data
verify coingecko api key, check rate limits.
