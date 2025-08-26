pkill -f "src/index.ts"

sudo -u postgres psql << EOF
DROP DATABASE IF EXISTS ls_indexer;
CREATE DATABASE ls_indexer OWNER indexer;
EOF

sudo -u postgres psql -d ls_indexer -f src/db/schema.sql

sudo -u postgres psql -d ls_indexer << EOF
GRANT ALL ON ALL TABLES IN SCHEMA public TO indexer;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO indexer;
EOF

bun run dev
