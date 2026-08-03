import {
  ApiErrorResponse,
  ApiRequestError,
} from '@/types/api.types';

interface RequestOptions extends RequestInit {
  body?: string;
}

function extractErrorMessage(
  body: ApiErrorResponse,
  fallback: string,
): string {
  if (Array.isArray(body.message)) {
    return body.message.join(', ');
  }

  if (typeof body.message === 'string') {
    return body.message;
  }

  return fallback;
}

export async function apiRequest<T>(
  url: string,
  options: RequestOptions = {},
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(options.body
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...options.headers,
    },
  });

  let responseBody: unknown;

  try {
    responseBody = await response.json();
  } catch {
    responseBody = {};
  }

  if (!response.ok) {
    const errorBody = responseBody as ApiErrorResponse;

    throw new ApiRequestError(
      extractErrorMessage(
        errorBody,
        `La solicitud falló con código ${response.status}`,
      ),
      response.status,
      errorBody,
    );
  }

  return responseBody as T;
}