#!/bin/bash

echo "Building Partisia Indexer for deployment..."

# Build the frontend
echo "Building frontend..."
cd example-graph
npm run build || {
    echo "Frontend build failed, continuing without it..."
    mkdir -p build
    echo '<!doctype html><html><head><title>Partisia API</title></head><body><h1>Partisia Blockchain Indexer API</h1><p>Use <a href="/graphql">/graphql</a> for GraphQL queries</p></body></html>' > build/index.html
}
cd ..

# Build the backend
echo "Building backend..."
bun run build

echo "Build complete!"
echo "Frontend: example-graph/build/"
echo "Backend: dist/"