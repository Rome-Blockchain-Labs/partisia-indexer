// Global type definitions to fix common TypeScript errors

declare global {
  // Helper type for error handling
  type UnknownError = Error | unknown;

  // Helper function for error messages
  function getErrorMessage(error: unknown): string;
}

// Error message helper implementation
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
}

export {};