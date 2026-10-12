import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { trace } from "@opentelemetry/api";
import { correlationContext } from "./http-observability";

@Catch()
export class JsonExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const responseBody =
      exception instanceof HttpException
        ? exception.getResponse()
        : { statusCode, message: "Internal server error" };

    if (statusCode >= 500) {
      const spanContext = trace.getActiveSpan()?.spanContext();
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "ERROR",
          service: process.env.OTEL_SERVICE_NAME ?? "auth-service",
          event: "http.request.failed",
          trace_id: spanContext?.traceId ?? null,
          span_id: spanContext?.spanId ?? null,
          correlation_id: correlationContext.getStore() ?? null,
          method: request.method,
          route: request.path
            .replace(/\/[0-9]+(?=\/|$)/g, "/:id")
            .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}(?=\/|$)/gi, "/:id"),
          status_code: statusCode,
          error_type:
            exception instanceof Error
              ? exception.constructor.name
              : "UnknownError",
        }),
      );
    }

    if (response.headersSent) {
      response.end();
      return;
    }

    response.status(statusCode).json(responseBody);
  }
}
