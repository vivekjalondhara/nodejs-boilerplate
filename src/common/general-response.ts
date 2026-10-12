import type { Response } from 'express';

export function generalResponse<T>(
  response: Response,
  data: T,
  message = '',
  responseType: 'success' | 'error' = 'success',
  toast = false,
  statusCode = 200,
): Response {
  return response.status(statusCode).json({ data, message, toast, responseType });
}
