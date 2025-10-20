export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta: ApiMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiMeta {
  timestamp: string;
  requestId: string;
  version: string;
}

export class Result<T> {
  private constructor(
    public readonly ok: boolean,
    public readonly value: T | undefined,
    public readonly error: Error | undefined
  ) {}

  static success<T>(value: T): Result<T> {
    return new Result<T>(true, value, undefined);
  }

  static failure<T>(error: Error): Result<T> {
    return new Result<T>(false, undefined, error);
  }
}
