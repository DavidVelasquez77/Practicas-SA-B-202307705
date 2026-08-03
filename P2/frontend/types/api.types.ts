export interface ApiErrorResponse {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly responseBody?: ApiErrorResponse,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}