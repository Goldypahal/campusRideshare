import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  code?: string;
  invalidParams?: Array<{ field: string; message: string }>;
  message?: string; // Backwards compatibility for existing tests & client
}

export class AppError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly type: string;
  public readonly title: string;
  public readonly detail: string;
  public readonly invalidParams?: Array<{ field: string; message: string }>;

  constructor(options: {
    status: number;
    title: string;
    detail: string;
    code?: string;
    type?: string;
    invalidParams?: Array<{ field: string; message: string }>;
  }) {
    super(options.detail);
    this.name = this.constructor.name;
    this.status = options.status;
    this.title = options.title;
    this.detail = options.detail;
    this.code = options.code || "APP_ERROR";
    this.type = options.type || "about:blank";
    this.invalidParams = options.invalidParams;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(detail: string, invalidParams?: Array<{ field: string; message: string }>) {
    super({
      status: 400,
      title: "Validation Error",
      detail,
      code: "VALIDATION_ERROR",
      type: "urn:problem:validation-error",
      invalidParams,
    });
  }
}

export class UnauthorizedError extends AppError {
  constructor(detail: string = "Authentication required") {
    super({
      status: 401,
      title: "Unauthorized",
      detail,
      code: "UNAUTHORIZED",
      type: "urn:problem:unauthorized",
    });
  }
}

export class ForbiddenError extends AppError {
  constructor(detail: string = "Access denied", code: string = "FORBIDDEN") {
    super({
      status: 403,
      title: "Forbidden",
      detail,
      code,
      type: "urn:problem:forbidden",
    });
  }
}

export class NotFoundError extends AppError {
  constructor(detail: string = "Resource not found") {
    super({
      status: 404,
      title: "Not Found",
      detail,
      code: "NOT_FOUND",
      type: "urn:problem:not-found",
    });
  }
}

export class ConflictError extends AppError {
  constructor(detail: string, code: string = "CONFLICT") {
    super({
      status: 409,
      title: "Conflict",
      detail,
      code,
      type: "urn:problem:conflict",
    });
  }
}

export class RateLimitError extends AppError {
  constructor(detail: string = "Too many requests. Please try again later.") {
    super({
      status: 429,
      title: "Too Many Requests",
      detail,
      code: "RATE_LIMITED",
      type: "urn:problem:rate-limited",
    });
  }
}

export function formatError(err: unknown, req?: Request): ProblemDetails {
  const instance = req ? req.originalUrl || req.url : undefined;

  if (err instanceof ZodError) {
    const invalidParams = err.errors.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    }));
    const detail = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
    return {
      type: "urn:problem:validation-error",
      title: "Validation Error",
      status: 400,
      detail,
      instance,
      code: "VALIDATION_ERROR",
      invalidParams,
      message: detail,
    };
  }

  if (err instanceof AppError) {
    return {
      type: err.type,
      title: err.title,
      status: err.status,
      detail: err.detail,
      instance,
      code: err.code,
      invalidParams: err.invalidParams,
      message: err.detail,
    };
  }

  const errorObj = err as any;
  const status = typeof errorObj?.status === "number" ? errorObj.status : 500;
  const isProduction = process.env.NODE_ENV === "production";

  if (status >= 500) {
    console.error("[InternalServerError]", err);
  }

  const detail = (status >= 500 && isProduction)
    ? "An unexpected internal server error occurred."
    : (errorObj?.message || "An unexpected internal server error occurred.");

  return {
    type: status >= 500 ? "urn:problem:internal-server-error" : "urn:problem:error",
    title: status >= 500 ? "Internal Server Error" : "Error",
    status,
    detail,
    instance,
    code: errorObj?.code || (status >= 500 ? "INTERNAL_ERROR" : "ERROR"),
    message: detail,
  };
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const problem = formatError(err, req);
  res.setHeader("Content-Type", "application/problem+json");
  res.status(problem.status).json(problem);
}
