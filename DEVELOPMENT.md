# development

## setup

```bash
# database
createdb ls_indexer
createuser indexer -P

# env
DEPLOYMENT_BLOCK=10682802
DEPLOYMENT_TIMESTAMP=1750315778890
DB_HOST=localhost
DB_USER=indexer
DB_PASSWORD=changeme
PARTISIA_API_URL=http://127.0.0.1:58081

# tunnel required
ssh -L 58081:95.216.235.72:18080 root@helhetz02.romenet.io -N

# run
bunx tsx src/index.ts
```

## database reset

```bash
PGPASSWORD=changeme psql -h localhost -U indexer -d ls_indexer -f scripts/flush-db.sql
```