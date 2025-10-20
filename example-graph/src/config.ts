// API Configuration - reads from .env file
export const API_CONFIG = {
  // API URLs from environment - use relative URLs in production
  API_BASE_URL: process.env.REACT_APP_API_URL || '',
  GRAPHQL_URL: process.env.REACT_APP_GRAPHQL_URL || '/graphql',

  // WebSocket URL (if needed in future)
  WS_URL: process.env.REACT_APP_WS_URL || 'ws://localhost:3002/ws'
}

// Export for easy access
export const { API_BASE_URL, WS_URL, GRAPHQL_URL } = API_CONFIG