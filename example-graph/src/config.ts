// API Configuration
const isDevelopment = process.env.NODE_ENV === 'development'

export const API_CONFIG = {
  // Use production API by default, with local fallback for development
  API_BASE_URL: process.env.REACT_APP_API_URL ||
    (isDevelopment ? 'http://localhost:3002' : 'https://partisia.subgraph.romenet.io'),

  // WebSocket URL (if needed in future)
  WS_URL: process.env.REACT_APP_WS_URL ||
    (isDevelopment ? 'ws://localhost:3001/ws' : 'wss://partisia.subgraph.romenet.io/ws'),

  // GraphQL endpoint
  GRAPHQL_URL: process.env.REACT_APP_GRAPHQL_URL ||
    (isDevelopment ? 'http://localhost:3002/graphql' : 'https://partisia.subgraph.romenet.io/graphql')
}

// Export for easy access
export const { API_BASE_URL, WS_URL, GRAPHQL_URL } = API_CONFIG